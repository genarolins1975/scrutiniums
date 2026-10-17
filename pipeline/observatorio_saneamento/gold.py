"""Camada gold do Observatório Brasileiro do Saneamento (só biblioteca padrão).

Lê o recorte versionado em seed/ (gerado por coletar.py, com sha256 de cada
original) e escreve public/saneamento/gold/. Determinístico: o mesmo seed
produz os mesmos bytes.

Contrato (ver docs/saneamento/METODOLOGIA.md):
- cada observação fica no seu grão: município, prestador × município,
  prestador, estação ou território agregado;
- UF, região e Brasil do SINISA vêm da consolidação oficial (os mesmos arquivos
  do OBEE); nunca de média de percentuais municipais;
- contagens do Censo vêm das tabulações do IBGE em cada nível;
- zero, ausência, "não calculado" e "não participou" são estados distintos;
- população do Censo 2022 (moradores em domicílios particulares permanentes
  ocupados) e estimativa de 2024 (DFE0001 do SINISA) nunca se misturam numa razão.

Uso:
    python3 -m pipeline.observatorio_saneamento.gold
"""
import csv
import gzip
import io
import json
import math
import os
import re
import unicodedata
from collections import Counter, defaultdict

from . import controle
from . import jmp
from . import saude
from .desigualdades import SPECS as SPECS_DESIGUALDADES
from .desigualdades import construir as construir_desigualdades
from . import sisagua
from . import sisagua_quimicos

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
SEED = os.path.join(AQUI, "seed")
DESTINO = os.path.join(RAIZ, "public", "saneamento", "gold")

REGIOES = {
    "1": ("R-N", "Norte"), "2": ("R-NE", "Nordeste"), "3": ("R-SE", "Sudeste"),
    "4": ("R-S", "Sul"), "5": ("R-CO", "Centro-Oeste"),
}
NOME_REGIAO_ID = {nome: rid for rid, nome in REGIOES.values()}
UF_COD = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}
UF_NOME = {
    "RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima", "PA": "Pará", "AP": "Amapá", "TO": "Tocantins",
    "MA": "Maranhão", "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte", "PB": "Paraíba", "PE": "Pernambuco",
    "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia", "MG": "Minas Gerais", "ES": "Espírito Santo",
    "RJ": "Rio de Janeiro", "SP": "São Paulo", "PR": "Paraná", "SC": "Santa Catarina", "RS": "Rio Grande do Sul",
    "MS": "Mato Grosso do Sul", "MT": "Mato Grosso", "GO": "Goiás", "DF": "Distrito Federal",
}
UF_REGIAO = {uf: REGIOES[cod[0]][0] for cod, uf in UF_COD.items()}

# Metas gerais do art. 11-B da Lei 11.445/2007 (redação da Lei 14.026/2020).
META_AGUA = 99.0
META_ESGOTO = 90.0
DATA_META = "2033-12-31"


# ---------------------------------------------------------------------------
# leitura do seed
# ---------------------------------------------------------------------------

def ler_seed(nome):
    with open(os.path.join(SEED, nome), "rb") as f:
        return json.loads(gzip.decompress(f.read()))


def planilha(chave):
    d = ler_seed(f"sinisa_{chave}.json.gz")
    cods = [c["codigo"] for c in d["colunas"]]
    linhas = [dict(zip(cods, r["v"]), _linha=r["linha"]) for r in d["registros"]]
    return d, linhas


NUM_BR = re.compile(r"^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$")


def num(v):
    """Número da planilha ou None. Texto "50,76" (planilhas por prestador) vira 50.76."""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        t = v.strip()
        if NUM_BR.match(t):
            return float(t.replace(".", "").replace(",", "."))
    return None


def estado_indicador(v):
    """Por que não há número: preserva a classe de motivo publicada pelo SINISA."""
    if num(v) is not None:
        return None
    if isinstance(v, str):
        t = v.lower()
        if "divisão por zero" in t:
            return "nao_calculado_divisao_zero"
        if "condições não atendidas" in t:
            return "nao_calculado_condicoes"
        if "campos obrigatórios" in t:
            return "nao_calculado_campos_vazios"
        if t.startswith("consultar dado por prestador"):
            return "ver_prestador"
    return "nao_informado"


def somar(xs):
    """Soma independente da versão do Python: inteiros exatos; reais por math.fsum
    (arredondamento correto), porque sum() de reais mudou no Python 3.12."""
    xs = list(xs)
    if all(isinstance(x, int) and not isinstance(x, bool) for x in xs):
        return sum(xs)
    return math.fsum(xs)


def soma(*vals):
    """Soma só quando todas as parcelas existem."""
    if any(v is None for v in vals):
        return None
    return somar(vals)


def soma_parcial(vals):
    xs = [v for v in vals if v is not None]
    return somar(xs) if xs else None


def r2(v, casas=2):
    return None if v is None else round(v, casas)


def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def cnpj(v):
    d = re.sub(r"\D", "", str(v or ""))
    return d if len(d) == 14 else None


def gm_valor(v):
    """Módulo Gestão Municipal: "null" marca município que não respondeu; vira None."""
    if v is None or (isinstance(v, str) and v.strip().lower() in ("null", "")):
        return None
    return v


URL_VALIDA = re.compile(r"^https?://[^\s@]+\.[^\s@]+$", re.I)


def gm_link(v):
    """Só publica endereço web bem formado e sem "@" (o campo livre tem e-mails e lixo)."""
    v = gm_valor(v)
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v if URL_VALIDA.match(v) else None


def censo_int(v):
    """SIDRA: "-" é zero absoluto; "X" é sigilo; "..", "..." não se aplica ou indisponível."""
    if isinstance(v, int):
        return v
    if v == "-":
        return 0
    return None


# ---------------------------------------------------------------------------
# Censo
# ---------------------------------------------------------------------------

AGUA_2022 = {
    "rede": "72144",          # possui ligação e a utiliza como forma principal
    "lig_outra": "72145",     # possui ligação, mas utiliza principalmente outra forma
    "sem_ligacao": "72153",   # não possui ligação com a rede geral
    "total": "72129",
}
AGUA_2022_SEM_LIGACAO = {
    "poco_profundo": "72154", "poco_raso": "72155", "nascente": "72156", "carro_pipa": "72157",
    "chuva": "72158", "rio": "72159", "outra": "72160",
}
ESGOTO_2022 = {
    "total": "46292",
    "rede": "46290",            # rede geral, rede pluvial ou fossa ligada à rede
    "rede_pluvial": "72110",
    "fossa_ligada": "72111",
    "septica": "72112",         # fossa séptica ou fossa filtro não ligada à rede
    "rudimentar": "72113",
    "vala": "92858",
    "corpo_dagua": "72114",
    "outra": "72115",
    "sem_banheiro": "92861",
}


def bloco_censo22(agua, esgoto):
    if not agua or not esgoto:
        return None
    g = lambda d, c: censo_int(d.get(c))  # noqa: E731
    out = {k: g(agua, c) for k, c in AGUA_2022.items()}
    out["sem_ligacao_fontes"] = {k: g(agua, c) for k, c in AGUA_2022_SEM_LIGACAO.items()}
    out = {"agua": out, "esgoto": {k: g(esgoto, c) for k, c in ESGOTO_2022.items()}}
    e = out["esgoto"]
    parc = [e["rudimentar"], e["vala"], e["corpo_dagua"], e["outra"]]
    e["sem_rede_nem_septica"] = None if any(v is None for v in parc + [e["sem_banheiro"]]) else somar(parc + [e["sem_banheiro"]])
    return out


def bloco_censo10(agua, esgoto):
    if not agua or not esgoto:
        return None
    total = censo_int(agua.get("0"))
    rede = censo_int(agua.get("92853"))
    es_total = censo_int(esgoto.get("0"))
    a, b = censo_int(esgoto.get("2945")), censo_int(esgoto.get("2959"))
    return {
        "moradores": total,
        "agua_rede": rede,
        "esgoto_moradores": es_total,
        "esgoto_rede_pluvial": None if a is None or b is None else a + b,
    }


# ---------------------------------------------------------------------------
# SINISA
# ---------------------------------------------------------------------------

IND_AGUA = ["IAG0001", "IAG0002", "IAG0003", "IAG0004", "IAG1003", "IAG2002", "IAG2006", "IAG2013", "IAG2015",
            "IAG3004", "IAG3005", "IAG3007", "IAG3008", "IFA1001", "IFA2001", "IFA2004"]
IND_ESGOTO = ["IES0001", "IES0002", "IES0003", "IES0004", "IES0007", "IES2002", "IES2003", "IES2004", "IES3002",
              "IFE1001", "IFE2001", "IFE2004"]

TEC_AGUA = ["GTA0019", "GTA0001", "GTA0002", "GTA0003", "GTA0007", "GTA0009", "GTA0016", "GTA0014", "GTA0018", "GTA3001", "GTA3002",
            "GTA3003", "GTA3005", "GTA3006", "GTA3007", "GTA3008", "GTA3101", "GTA3102", "GTA3106", "GTA3107"]
TEC_ESGOTO = ["GTE0023", "GTE0001", "GTE0002", "GTE0003", "GTE0005", "GTE0009", "GTE0019", "GTE0014", "GTE0015", "GTE0022",
              "GTE1002", "GTE1014", "GTE3001", "GTE3006"]

INV_AGUA = {
    "prestador": "GFI2024", "estado": "GFI2036",
    "prestador_fontes": {"proprios": "GFI2021", "onerosos": "GFI2022", "nao_onerosos": "GFI2023"},
    "estado_fontes": {"proprios": "GFI2033", "onerosos": "GFI2034", "nao_onerosos": "GFI2035"},
    "prestador_destino": {"reposicao_producao": "GFI2025", "ampliacao_producao": "GFI2026",
                          "reposicao_distribuicao": "GFI2028", "ampliacao_distribuicao": "GFI2029", "outras": "GFI2031"},
    "estado_destino": {"reposicao_producao": "GFI2037", "ampliacao_producao": "GFI2038",
                       "reposicao_distribuicao": "GFI2040", "ampliacao_distribuicao": "GFI2041", "outras": "GFI2043"},
}
INV_ESGOTO = {
    "prestador": "GFI2124", "estado": "GFI2136",
    "prestador_fontes": {"proprios": "GFI2121", "onerosos": "GFI2122", "nao_onerosos": "GFI2123"},
    "estado_fontes": {"proprios": "GFI2133", "onerosos": "GFI2134", "nao_onerosos": "GFI2135"},
    "prestador_destino": {"reposicao_coleta": "GFI2125", "ampliacao_coleta": "GFI2126",
                          "reposicao_tratamento": "GFI2128", "ampliacao_tratamento": "GFI2129", "outras": "GFI2131"},
    "estado_destino": {"reposicao_coleta": "GFI2137", "ampliacao_coleta": "GFI2138",
                       "reposicao_tratamento": "GFI2140", "ampliacao_tratamento": "GFI2141", "outras": "GFI2143"},
}

TARIFA_AGUA = ["GFI1008", "GFI1016", "GFI1016A", "GFI1017", "GFI1018", "GFI1019", "GFI1020", "GFI1021", "GFI1022",
               "GFI1023", "GFI1024", "GFI1025", "GFI1030", "GFI1031", "GFI1033", "GFI1036", "GFI1037"]
COBRANCA_ESGOTO = ["GFI1108", "GFI1109", "GFI1109A"]


def indicadores(linha, codigos):
    out, motivos = {}, {}
    for c in codigos:
        v = linha.get(c)
        n = num(v)
        out[c] = r2(n) if isinstance(n, float) else n
        e = estado_indicador(v)
        if e:
            motivos[c] = e
    return out, motivos


def bloco_investimento(linha, mapa):
    def g(c):
        return num(linha.get(c))
    p, e = g(mapa["prestador"]), g(mapa["estado"])
    # Total = parcelas informadas, como na consolidação oficial (a soma dos municípios
    # reproduz o consolidado Brasil). "estado_informado" diz se a parcela do Estado existe.
    return {
        "total": r2(soma_parcial([p, e])),
        "estado_informado": e is not None,
        "prestador": r2(p),
        "estado": r2(e),
        "prestador_fontes": {k: r2(g(c)) for k, c in mapa["prestador_fontes"].items()},
        "estado_fontes": {k: r2(g(c)) for k, c in mapa["estado_fontes"].items()},
        "prestador_destino": {k: r2(g(c)) for k, c in mapa["prestador_destino"].items()},
        "estado_destino": {k: r2(g(c)) for k, c in mapa["estado_destino"].items()},
    }


def texto(v):
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip() or None
    return v


def chave_prestador(l):
    nome = str(texto(l.get("CAD0005")) or "").strip()
    sigla = str(texto(l.get("CAD0006")) or "").strip()
    if (l.get("CAD0003") or "").strip() == "Local":
        return slug(f"{sigla or nome}-{l['cod_IBGE']}")
    return slug(f"{sigla}-{nome}" if sigla else nome)


def _tec(f, servico):
    return (f["sinisa"][servico].get("tecnica") or {}) if f["sinisa"][servico]["situacao"] != "nao_participou" else {}


def bloco_factiveis(fichas):
    """Ligações possíveis ainda não feitas: imóveis com rede disponível e sem ligação (conexões factíveis)."""
    out = {}
    for servico, cod in (("agua", "GTA0007"), ("esgoto", "GTE0005")):
        vals = [_tec(f, servico).get(cod) for f in fichas]
        inf = [v for v in vals if v is not None]
        out[servico] = {"imoveis": somar(inf) if inf else None, "municipios_informantes": len(inf)}
    return out


def bloco_continuidade(fichas):
    """Somas das declarações municipais de paralisações, interrupções sistemáticas e colapso (GTA30xx)."""
    tec = [_tec(f, "agua") for f in fichas]
    tec = [t for t in tec if t]
    def s(c):
        xs = [t.get(c) for t in tec if t.get(c) is not None]
        return (somar(xs), len(xs)) if xs else (None, 0)
    par, n_par = s("GTA3001")
    eco_par, _ = s("GTA3002")
    h_par, _ = s("GTA3007")
    intr, n_intr = s("GTA3003")
    eco_intr, _ = s("GTA3005")
    h_intr, _ = s("GTA3008")
    col, n_col = s("GTA3006")
    motivos = Counter()
    for f in fichas:
        m = f["sinisa"]["agua"].get("motivo_interrupcoes")
        if m and (f["sinisa"]["agua"].get("tecnica") or {}).get("GTA3003"):
            motivos[m] += 1
    return {
        "municipios_participantes": len(tec),
        "paralisacoes": par, "municipios_informaram_paralisacoes": n_par,
        "economias_atingidas_paralisacoes": eco_par, "horas_paralisacoes": h_par,
        "interrupcoes_sistematicas": intr, "municipios_informaram_interrupcoes": n_intr,
        "municipios_com_interrupcoes": sum(1 for t in tec if (t.get("GTA3003") or 0) > 0),
        "economias_atingidas_interrupcoes": eco_intr, "horas_interrupcoes": h_intr,
        "dias_colapso": col, "municipios_informaram_colapso": n_col,
        "municipios_com_colapso": sum(1 for t in tec if (t.get("GTA3006") or 0) > 0),
        "motivos_interrupcoes": dict(sorted(motivos.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


def bloco_gestao(fichas):
    """Contagem das respostas do módulo Gestão Municipal: plano, política, regulação, conselho."""
    gm = [f.get("gestao_municipal") for f in fichas]
    resp = [g for g in gm if g and g.get("respondeu") == "Sim"]
    c = lambda fn: sum(1 for g in resp if fn(g))  # noqa: E731
    anos = Counter(_ano((g.get("plano") or {}).get("data")) for g in resp if (g.get("plano") or {}).get("existe") == "Sim")
    return {
        "respondentes": len(resp),
        "nao_respondentes": len(fichas) - len(resp),
        "plano_sim": c(lambda g: (g.get("plano") or {}).get("existe") == "Sim"),
        "plano_nao": c(lambda g: (g.get("plano") or {}).get("existe") == "Não"),
        "plano_em_elaboracao": c(lambda g: (g.get("plano") or {}).get("em_elaboracao") == "Sim"),
        "plano_com_link": c(lambda g: bool((g.get("plano") or {}).get("link"))),
        "plano_anos": {str(k): v for k, v in sorted(anos.items(), key=lambda kv: (kv[0] is None, kv[0] or 0)) if k is not None},
        "plano_sem_ano": anos.get(None, 0),
        "politica_sim": c(lambda g: (g.get("politica") or {}).get("existe") == "Sim"),
        "regulacao_agua_sim": c(lambda g: (g.get("regulacao_declarada") or {}).get("agua") == "Sim"),
        "regulacao_esgoto_sim": c(lambda g: (g.get("regulacao_declarada") or {}).get("esgoto") == "Sim"),
        "conselho_especifico_sim": c(lambda g: (g.get("conselho") or {}).get("especifico") == "Sim"),
        "ouvidoria_sim": c(lambda g: g.get("ouvidoria") == "Sim"),
        "consorcio_sim": c(lambda g: (g.get("consorcio") or {}).get("participa") == "Sim"),
    }


def _ano(v):
    v = gm_valor(v)
    if not isinstance(v, str):
        return None
    m = re.search(r"(19|20)\d{2}", v)
    return int(m.group(0)) if m else None


def _siglas(regs):
    s = sorted({r["sigla"] or r["nome"] for r in regs if r.get("existe") == "Sim" and (r.get("sigla") or r.get("nome"))})
    return " / ".join(s) if s else None


# ---------------------------------------------------------------------------
# construção
# ---------------------------------------------------------------------------

def construir():
    desigualdades = construir_desigualdades()
    censo = ler_seed("censo.json.gz")
    manifesto = ler_seed("sinisa_manifesto.json.gz")
    T = censo["tabelas"]

    def cens(tab, nivel, cod):
        return T[tab]["valores"].get(f"{nivel}:{cod}")

    pop24 = censo["populacao_2024"]["valores"]
    municipios_ibge = censo["municipios"]["lista"]

    # --- SINISA por município (consolidação oficial do município)
    _, ag_ind = planilha("agua_indicadores_municipio")
    _, ag_tec = planilha("agua_tecnica_municipio")
    _, ag_fin = planilha("agua_financeira_municipio")
    _, es_ind = planilha("esgoto_indicadores_municipio")
    _, es_tec = planilha("esgoto_tecnica_municipio")
    _, es_fin = planilha("esgoto_financeira_municipio")
    por = lambda ls: {str(l["cod_IBGE"]): l for l in ls}  # noqa: E731
    ag_ind, ag_tec, ag_fin = por(ag_ind), por(ag_tec), por(ag_fin)
    es_ind, es_tec, es_fin = por(es_ind), por(es_tec), por(es_fin)

    # --- SINISA prestador × município
    _, ag_pm_tec = planilha("agua_tecnica_prestador")
    _, ag_pm_fin = planilha("agua_financeira_prestador")
    _, ag_pm_ind = planilha("agua_indicadores_prestador")
    _, es_pm_tec = planilha("esgoto_tecnica_prestador")
    _, es_pm_fin = planilha("esgoto_financeira_prestador")
    _, bal_ag = planilha("agua_balanco_prestador")
    _, bal_es = planilha("esgoto_balanco_prestador")
    _, etes = planilha("esgoto_ete")

    def indexa_pm(ls):
        d = {}
        for l in ls:
            d[(str(l["cod_IBGE"]), chave_prestador(l))] = l
        return d

    ag_pm_fin_i, ag_pm_ind_i, es_pm_fin_i = indexa_pm(ag_pm_fin), indexa_pm(ag_pm_ind), indexa_pm(es_pm_fin)

    prest_mun = defaultdict(list)  # cod_IBGE -> lista de vínculos
    prestadores = {}

    def registra_prestador(l, servico):
        k = chave_prestador(l)
        p = prestadores.setdefault(k, {
            "id": k,
            "nome": texto(l.get("CAD0005")),
            "sigla": texto(l.get("CAD0006")),
            "natureza": texto(l.get("CAD0002")),
            "abrangencia": texto(l.get("CAD0003")),
            "ufs": set(),
            "municipios_agua": [],
            "municipios_esgoto": [],
        })
        p["ufs"].add(l["UF"])
        p["municipios_agua" if servico == "agua" else "municipios_esgoto"].append(str(l["cod_IBGE"]))
        return k

    for l in ag_pm_tec:
        cod = str(l["cod_IBGE"])
        k = registra_prestador(l, "agua")
        fin = ag_pm_fin_i.get((cod, k), {})
        ind = ag_pm_ind_i.get((cod, k), {})
        ii, mot = indicadores(ind, IND_AGUA)
        prest_mun[cod].append({
            "servico": "agua",
            "prestador": k,
            "area": texto(l.get("CAD2001")),
            "forma": texto(l.get("CAD2002")),
            "atividades": texto(l.get("CAD2003")),
            "instrumento": texto(l.get("CAD2004")),
            "inicio": texto(l.get("CAD2005")),
            "termino": texto(l.get("CAD2006")),
            "populacao_atendida": num(l.get("GTA0019")),
            "indicadores": ii,
            "motivos": mot,
            "investimento": bloco_investimento(fin, INV_AGUA),
            "tarifa": {c: texto(fin.get(c)) if not isinstance(fin.get(c), (int, float)) else fin.get(c) for c in TARIFA_AGUA},
        })
    for l in es_pm_tec:
        cod = str(l["cod_IBGE"])
        k = registra_prestador(l, "esgoto")
        fin = es_pm_fin_i.get((cod, k), {})
        prest_mun[cod].append({
            "servico": "esgoto",
            "prestador": k,
            "area": texto(l.get("CAD2101")),
            "forma": texto(l.get("CAD2102")),
            "atividades": texto(l.get("CAD2103")),
            "instrumento": texto(l.get("CAD2104")),
            "inicio": texto(l.get("CAD2105")),
            "termino": texto(l.get("CAD2106")),
            "populacao_atendida": num(l.get("GTE0023")),
            "investimento": bloco_investimento(fin, INV_ESGOTO),
            "cobranca": {c: texto(fin.get(c)) for c in COBRANCA_ESGOTO},
        })

    # --- ETEs por município
    ete_mun = defaultdict(list)
    lista_etes = []
    for l in etes:
        cap = num(l.get("GTE2111"))
        vol = num(l.get("GTE2119"))
        # utilização: volume anual tratado / capacidade nominal anual (l/s × 31.536 = mil m³/ano)
        uso = None
        if cap and cap > 0 and vol is not None:
            uso = r2(vol / (cap * 31.536) * 100, 1)
        e = {
            "codigo": texto(l.get("GTE2100")),
            "nome": texto(l.get("GTE2101")),
            "municipio": str(l["cod_IBGE"]),
            "uf": l["UF"],
            "prestador": chave_prestador(l),
            "em_operacao": texto(l.get("GTE2126")),
            "nivel": texto(l.get("GTE2106")),
            "capacidade_nominal_ls": cap,
            "volume_tratado_mil_m3": vol,
            "utilizacao_pct": uso,
            "eficiencia_dbo_pct": num(l.get("GTE2108")),
            "corpo_receptor": texto(l.get("GTE2105")),
            "linha": l["_linha"],
        }
        lista_etes.append(e)
        ete_mun[e["municipio"]].append(e)

    # --- Gestão Municipal: plano, política, regulador e prestadores declarados pelo município
    gm_seed = ler_seed("sinisa_gestao_municipal.json.gz")
    cad_seed = ler_seed("cadunico.json.gz")
    CAD_MES, CAD_MES_ATUAL = "202412", "202609"

    def cad(cod, mes, campo="cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i"):
        # o MDS publica o código do município com 6 dígitos (sem o verificador)
        return (cad_seed["meses"][mes]["municipios"].get(cod[:6]) or {}).get(campo)

    def bloco_tarifa_social(vinc):
        """Declaração de tarifa social de água (GFI1019, GFI1036) somada sobre os prestadores de água do município.
        oferece: algum prestador declara tarifa social; nao_oferece: todos respondem que não; None: sem resposta."""
        resp = [(v.get("tarifa") or {}) for v in vinc if v["servico"] == "agua"]
        sim = [t for t in resp if t.get("GFI1019") == "Sim"]
        if sim:
            econ = [t.get("GFI1036") for t in sim]
            ok = all(isinstance(e, (int, float)) and not isinstance(e, bool) for e in econ)
            return "oferece", (somar(econ) if ok else None)
        if resp and all(t.get("GFI1019") == "Não" for t in resp):
            return "nao_oferece", 0
        return None, None

    def aba(nome):
        a = gm_seed["abas"][nome]
        cods = [c["codigo"] for c in a["colunas"]]
        return [dict(zip(cods, r["v"]), _linha=r["linha"]) for r in a["registros"]]

    gm = {str(int(l["Cod_IBGE"])): l for l in aba("GM")}
    SERV = {"Abastecimento de Água": "agua", "Esgotamento Sanitário": "esgoto"}
    gm_reg = defaultdict(lambda: {"agua": [], "esgoto": []})
    reguladores = {}
    for l in aba("Detalhamento Reguladores"):
        s = SERV.get(l.get("Tipo de serviço regulado no município"))
        if not s:
            continue
        cod = str(int(l["Cod_IBGE"]))
        existe = gm_valor(l.get("Existe a regulação do serviço no município?"))
        c = cnpj(l.get("Número do CNPJ da entidade responsável pela regulação do serviço no município"))
        reg = {
            "existe": existe,
            "cnpj": c,
            "nome": gm_valor(l.get("Nome da entidade responsável pela regulação do no município")),
            "sigla": gm_valor(l.get("Sigla da entidade responsável pela regulação do serviço no município")),
            "abrangencia": gm_valor(l.get("Abrangência da entidade responsável pela regulação do serviço no município")),
        }
        gm_reg[cod][s].append(reg)
        if existe == "Sim" and c:
            r = reguladores.setdefault(c, {"cnpj": c, "nomes": Counter(), "siglas": Counter(), "abrangencias": Counter(),
                                           "municipios_agua": set(), "municipios_esgoto": set(), "ufs": set()})
            r["nomes"][reg["nome"]] += 1
            r["siglas"][reg["sigla"]] += 1
            r["abrangencias"][reg["abrangencia"]] += 1
            r["municipios_" + s].add(cod)
            r["ufs"].add(UF_COD[cod[:2]])
    gm_prest = defaultdict(lambda: {"agua": [], "esgoto": []})
    for l in aba("Detalhamento Prestadores Serv"):
        s = SERV.get(l.get("Tipo de serviço prestado"))
        if not s:
            continue
        gm_prest[str(int(l["Cod_IBGE"]))][s].append({
            "existe": gm_valor(l.get("Existe a prestação do serviço no município?")),
            "cnpj": cnpj(l.get("Número do CNPJ do prestador de serviços no município")),
            "natureza": gm_valor(l.get("Natureza jurídica do prestador de serviços")),
            "nome": gm_valor(l.get("Nome do prestador de serviços no município")),
            "sigla": gm_valor(l.get("Sigla do prestador de serviços no município")),
            "servicos": gm_valor(l.get("Quais os serviços realizados pelo prestador de serviços")),
        })

    def bloco_gm(cod):
        l = gm.get(cod)
        if not l:
            return None
        g = lambda c: gm_valor(l.get(c))  # noqa: E731
        respondeu = l.get("Respondeu ao Módulo Gestão Municipal do SINISA 2024")
        sol = {
            "agua_urbana_pocos": {"usa": g("OGM5006"), "populacao": num(g("OGM5007")), "domicilios": num(g("OGM5008"))},
            "agua_urbana_cisterna": {"usa": g("OGM5009"), "populacao": num(g("OGM5010")), "domicilios": num(g("OGM5011"))},
            "agua_rural_pocos": {"usa": g("OGM5024"), "populacao": num(g("OGM5025")), "domicilios": num(g("OGM5026"))},
            "agua_rural_cisterna": {"usa": g("OGM5027"), "populacao": num(g("OGM5028")), "domicilios": num(g("OGM5029"))},
            "esgoto_urbano_fossa": {"usa": g("OGM5105"), "populacao": num(g("OGM5106")), "domicilios_sem_rede": num(g("OGM5107"))},
            "esgoto_rural_fossa": {"usa": g("OGM5122"), "populacao": num(g("OGM5123")), "domicilios_sem_rede": num(g("OGM5124"))},
        }
        return {
            "respondeu": respondeu,
            "linha": l["_linha"],
            "domicilios_ogm4006": num(g("OGM4006")),
            "politica": {"existe": g("OGM3001"), "data": g("OGM3003")},
            "plano": {
                "existe": g("OGM3004"), "instrumento": g("OGM3005"), "numero": g("OGM3006"), "data": g("OGM3007"),
                "componentes": g("OGM3008"), "conteudo": g("OGM3009"), "area": g("OGM3010"), "link": gm_link(l.get("OGM3011")),
                "em_elaboracao": g("OGM3012"),
            },
            "evtef": {"existe": g("OGM3015"), "componentes": g("OGM3028")},
            "conselho": {"especifico": g("OGM3201"), "afim": g("OGM3204")},
            "consorcio": {"participa": g("OGM3301"), "nome": g("OGM3303"), "sigla": g("OGM3312")},
            "ouvidoria": g("OGM3208"),
            "regulacao_declarada": {"agua": g("OGM2001"), "esgoto": g("OGM2101")},
            "reguladores": gm_reg.get(cod, {"agua": [], "esgoto": []}),
            "prestadores": gm_prest.get(cod, {"agua": [], "esgoto": []}),
            "solucoes_alternativas": sol,
        }

    # --- municípios
    ids_censo = {k.split(":")[1] for k in T["agua_2022"]["valores"] if k.startswith("6:")}
    regs = []
    detalhes_uf = defaultdict(dict)
    for m in municipios_ibge:
        cod = m["id"]
        uf = UF_COD[cod[:2]]
        c22 = bloco_censo22(cens("agua_2022", 6, cod), cens("esgoto_2022", 6, cod))
        d22 = bloco_censo22(cens("agua_dom_2022", 6, cod), cens("esgoto_dom_2022", 6, cod))
        c10 = bloco_censo10(cens("agua_2010", 6, cod), cens("esgoto_2010", 6, cod))
        p24 = pop24.get(f"6:{cod}")
        p24 = p24 if isinstance(p24, int) else None

        a_ind, a_mot = indicadores(ag_ind.get(cod, {}), IND_AGUA)
        e_ind, e_mot = indicadores(es_ind.get(cod, {}), IND_ESGOTO)
        at = ag_tec.get(cod)
        et = es_tec.get(cod)
        af = ag_fin.get(cod)
        ef = es_fin.get(cod)

        if at is not None:
            s_ag = "participou"
        else:
            s_ag = "nao_participou"
        if cod in es_ind:
            s_es = "participou"
        elif et is not None and (texto(et.get("CAD2101")) or "").startswith("Com delegação sem atendimento"):
            s_es = "delegacao_sem_atendimento"
        elif et is not None:
            s_es = "informacoes_sem_indicadores"
        else:
            s_es = "nao_participou"

        tec_a = {c: num(at.get(c)) for c in TEC_AGUA} if at else None
        tec_e = {c: num(et.get(c)) for c in TEC_ESGOTO} if et else None
        pop_at_a = soma(tec_a["GTA0001"], tec_a["GTA0002"]) if tec_a else None
        pop_at_e = soma(tec_e["GTE0001"], tec_e["GTE0002"]) if tec_e else None
        dfe = num(at.get("DFE0001")) if at else (num(et.get("DFE0001")) if et else None)
        inv_a = bloco_investimento(af, INV_AGUA) if af else None
        inv_e = bloco_investimento(ef, INV_ESGOTO) if ef else None
        motivos_ag = texto(at.get("GTA3004")) if at else None

        # NR ANA 8/2024, fichas IAA e IAE: economias residenciais ativas (de água; de esgoto
        # com tratamento) sobre domicílios residenciais ocupados existentes, estimados pela
        # população TCU dividida pela média de moradores por domicílio do último Censo.
        # Calculado aqui só com a parcela de rede pública: soluções alternativas previstas
        # pela entidade reguladora não são informadas ao SINISA.
        dom_est = None
        if p24 and c22 and d22 and c22["agua"]["total"] and d22["agua"]["total"]:
            dom_est = round(p24 / (c22["agua"]["total"] / d22["agua"]["total"]))
        nr8_ag_num = soma(tec_a["GTA0009"], tec_a["GTA0016"]) if tec_a else None
        nr8_es_num = soma(tec_e["GTE0009"], tec_e["GTE0019"]) if tec_e else None
        iaa_rede = r2(nr8_ag_num / dom_est * 100) if nr8_ag_num is not None and dom_est else None
        iae_rede = r2(nr8_es_num / dom_est * 100) if nr8_es_num is not None and dom_est else None

        vinc = prest_mun.get(cod, [])
        n_pa = sum(1 for v in vinc if v["servico"] == "agua")
        n_pe = sum(1 for v in vinc if v["servico"] == "esgoto")
        nat = lambda s: sorted({prestadores[v["prestador"]]["natureza"] for v in vinc if v["servico"] == s})  # noqa: E731

        ts_estado, ts_econ = bloco_tarifa_social(vinc)
        regs.append({
            "id": cod, "nome": m["nome"], "uf": uf, "regiao": UF_REGIAO[uf],
            "censo": cod in ids_censo,
            "pop22": c22["agua"]["total"] if c22 else None,
            "pop24": p24,
            "dfe0001": dfe,
            "c22_ag_rede": c22["agua"]["rede"] if c22 else None,
            "c22_ag_lig_outra": c22["agua"]["lig_outra"] if c22 else None,
            "c22_ag_sem": c22["agua"]["sem_ligacao"] if c22 else None,
            "c22_es_rede": c22["esgoto"]["rede"] if c22 else None,
            "c22_es_rede_pluvial": c22["esgoto"]["rede_pluvial"] if c22 else None,
            "c22_es_septica": c22["esgoto"]["septica"] if c22 else None,
            "c22_es_precario": (c22["esgoto"]["sem_rede_nem_septica"] - c22["esgoto"]["sem_banheiro"])
            if c22 and c22["esgoto"]["sem_rede_nem_septica"] is not None else None,
            "c22_es_sem_banheiro": c22["esgoto"]["sem_banheiro"] if c22 else None,
            "c10_mor": c10["moradores"] if c10 else None,
            "c10_ag_rede": c10["agua_rede"] if c10 else None,
            "c10_es_rede": c10["esgoto_rede_pluvial"] if c10 else None,
            "s_ag": s_ag, "s_es": s_es,
            "ag_pop_at": pop_at_a,
            "IAG0001": a_ind["IAG0001"], "IAG2013": a_ind["IAG2013"], "IAG3004": a_ind["IAG3004"],
            "ag_paralisacoes": tec_a["GTA3001"] if tec_a else None,
            "ag_interrupcoes": tec_a["GTA3003"] if tec_a else None,
            "es_pop_at": pop_at_e,
            "IES0001": e_ind["IES0001"], "IES0004": e_ind["IES0004"], "IES0007": e_ind["IES0007"],
            "IES2003": e_ind["IES2003"], "IES2004": e_ind["IES2004"],
            "dom_est24": dom_est,
            "nr8_ag_num": nr8_ag_num, "iaa_rede": iaa_rede,
            "nr8_es_num": nr8_es_num, "iae_rede": iae_rede,
            "inv_ag": inv_a["total"] if inv_a else None,
            "inv_es": inv_e["total"] if inv_e else None,
            "n_prest_ag": n_pa, "n_prest_es": n_pe,
            "nat_ag": nat("agua")[0] if len(nat("agua")) == 1 else ("Mais de uma natureza" if nat("agua") else None),
            "nat_es": nat("esgoto")[0] if len(nat("esgoto")) == 1 else ("Mais de uma natureza" if nat("esgoto") else None),
            "gm_respondeu": (gm.get(cod) or {}).get("Respondeu ao Módulo Gestão Municipal do SINISA 2024"),
            "plano": gm_valor((gm.get(cod) or {}).get("OGM3004")),
            "plano_ano": _ano((gm.get(cod) or {}).get("OGM3007")),
            "reg_ag": _siglas(gm_reg.get(cod, {}).get("agua", [])),
            "reg_es": _siglas(gm_reg.get(cod, {}).get("esgoto", [])),
            "ts_estado": ts_estado,
            "ts_economias": ts_econ,
            "cad_fam_ms": cad(cod, CAD_MES),
            "cad_fam_ms_atual": cad(cod, CAD_MES_ATUAL),
        })

        etes_m = ete_mun.get(cod, [])
        detalhes_uf[uf][cod] = {
            "id": cod, "nome": m["nome"], "uf": uf, "regiao": UF_REGIAO[uf],
            "censo2022": {"moradores": c22, "domicilios": d22},
            "censo2010": c10,
            "pop24": p24,
            "sinisa": {
                "agua": {
                    "situacao": s_ag,
                    "dfe0001": num(at.get("DFE0001")) if at else None,
                    "linha": {"tecnica": at["_linha"] if at else None, "indicadores": ag_ind[cod]["_linha"] if cod in ag_ind else None},
                    "indicadores": a_ind, "motivos": a_mot,
                    "tecnica": tec_a,
                    "motivo_interrupcoes": motivos_ag,
                    "investimento": inv_a,
                },
                "esgoto": {
                    "situacao": s_es,
                    "dfe0001": num(et.get("DFE0001")) if et else None,
                    "linha": {"tecnica": et["_linha"] if et else None, "indicadores": es_ind[cod]["_linha"] if cod in es_ind else None},
                    "indicadores": e_ind, "motivos": e_mot,
                    "tecnica": tec_e,
                    "investimento": inv_e,
                    "etes": [{k: e[k] for k in ("codigo", "nome", "em_operacao", "nivel", "capacidade_nominal_ls",
                                               "volume_tratado_mil_m3", "utilizacao_pct", "eficiencia_dbo_pct")} for e in etes_m],
                },
                "prestadores": vinc,
            },
            "gestao_municipal": bloco_gm(cod),
            "tarifa_social": {
                "estado": ts_estado,
                "economias": ts_econ,
                "cadunico": {mes: {
                    "familias_ate_meio_sm": cad(cod, mes),
                    "familias_atualizadas_ate_meio_sm": cad(cod, mes, "cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i"),
                    "pessoas_ate_meio_sm": cad(cod, mes, "cadun_qtd_pessoas_cadastradas_rfpc_ate_meio_sm_i"),
                    "familias_cadastradas": cad(cod, mes, "cadun_qtd_familias_cadastradas_i"),
                } for mes in (CAD_MES, CAD_MES_ATUAL)},
            },
        }

    # --- prestadores: agregação por soma de campos declarados
    pm_tec_a = defaultdict(list)
    for l in ag_pm_tec:
        pm_tec_a[chave_prestador(l)].append(l)
    pm_tec_e = defaultdict(list)
    for l in es_pm_tec:
        pm_tec_e[chave_prestador(l)].append(l)
    pm_fin_a = defaultdict(list)
    for l in ag_pm_fin:
        pm_fin_a[chave_prestador(l)].append(l)
    pm_fin_e = defaultdict(list)
    for l in es_pm_fin:
        pm_fin_e[chave_prestador(l)].append(l)
    balancos = defaultdict(list)
    for servico, ls in (("agua", bal_ag), ("esgoto", bal_es)):
        for l in ls:
            balancos[chave_prestador(l)].append({
                "planilha": servico,
                "tipo_servico": texto(l.get("Tipo de Serviço")),
                "ativo_total": num(l.get("GFI3001")), "patrimonio_liquido": num(l.get("GFI3006")),
                "passivo_circulante": num(l.get("GFI3004")), "passivo_nao_circulante": num(l.get("GFI3005")),
                "receita_bruta": num(l.get("GFI3007")), "receita_liquida": num(l.get("GFI3008")),
                "resultado_operacional_com_depreciacao": num(l.get("GFI3009")),
                "lucro_liquido_com_depreciacao": num(l.get("GFI3011")),
                "linha": l["_linha"],
            })

    def somaf(ls, c):
        return soma_parcial([num(l.get(c)) for l in ls])

    lista_prest = []
    for k, p in prestadores.items():
        ta, te, fa, fe = pm_tec_a.get(k, []), pm_tec_e.get(k, []), pm_fin_a.get(k, []), pm_fin_e.get(k, [])
        # perdas na distribuição pela fórmula do IAG2013 sobre as somas declaradas
        vol = {c: r2(somaf(ta, c)) for c in ("GTA1001", "GTA1009", "GTA1203", "GTA1207", "GTA1211", "GTA1221", "GTA1214")}
        perdas = None
        if all(vol[c] is not None for c in ("GTA1001", "GTA1009", "GTA1203", "GTA1207", "GTA1211")):
            entrada = vol["GTA1001"] + vol["GTA1009"]
            if entrada > 0:
                perdas = r2((entrada - vol["GTA1207"] - vol["GTA1211"] - vol["GTA1203"]) / entrada * 100)
        receita_ag = somaf(fa, "GFI1001")
        faturado = vol["GTA1221"]
        dex_ag = somaf(fa, "GFI2008")
        lista_prest.append({
            "id": k,
            "nome": p["nome"], "sigla": p["sigla"], "natureza": p["natureza"], "abrangencia": p["abrangencia"],
            "ufs": sorted(p["ufs"]),
            "municipios_agua": sorted(set(p["municipios_agua"])),
            "municipios_esgoto": sorted(set(p["municipios_esgoto"])),
            "populacao_atendida_agua": somaf(ta, "GTA0019"),
            "populacao_atendida_esgoto": somaf(te, "GTE0023"),
            "ligacoes_agua": somaf(ta, "GTA0003"),
            "ligacoes_esgoto": somaf(te, "GTE0003"),
            "volumes_mil_m3": vol,
            "perdas_distribuicao_pct": perdas,
            "receita_direta_usuarios_agua": r2(receita_ag),
            "despesa_exploracao_agua": r2(dex_ag),
            "receita_por_m3_faturado_agua": r2(receita_ag / (faturado * 1000)) if receita_ag and faturado else None,
            # parcelas informadas de prestador e Estado, cada uma por si (a ausência de uma não apaga a outra)
            "investimento_agua": r2(soma_parcial([num(l.get(c)) for l in fa for c in ("GFI2024", "GFI2036")])),
            "investimento_esgoto": r2(soma_parcial([num(l.get(c)) for l in fe for c in ("GFI2124", "GFI2136")])),
            "investimento_agua_prestador": r2(somaf(fa, "GFI2024")),
            "investimento_esgoto_prestador": r2(somaf(fe, "GFI2124")),
            "pessoal_agua": somaf(fa, "GFI2047"),
            "balanco": balancos.get(k, []),
            "etes": sum(1 for e in lista_etes if e["prestador"] == k),
        })
    lista_prest.sort(key=lambda p: (-(p["populacao_atendida_agua"] or 0), p["nome"] or ""))

    # --- agregados: Censo (tabulação do IBGE em cada nível) + SINISA consolidado oficial
    _, ag_uf_ind = planilha("agua_indicadores_uf")
    _, es_uf_ind = planilha("esgoto_indicadores_uf")
    meta_ag_uf_tec, ag_uf_tec = planilha("agua_tecnica_uf")
    _, es_uf_tec = planilha("esgoto_tecnica_uf")
    _, ag_uf_fin = planilha("agua_financeira_uf")
    _, es_uf_fin = planilha("esgoto_financeira_uf")

    def id_consolidado(l):
        nome = (l.get("UF/Macrorregião") or "").strip()
        if nome == "Brasil":
            return "BR"
        if nome in NOME_REGIAO_ID:
            return NOME_REGIAO_ID[nome]
        for uf, n in UF_NOME.items():
            if n == nome:
                return uf
        return None

    def idx_cons(ls):
        return {id_consolidado(l): l for l in ls if id_consolidado(l)}

    ag_uf_ind, es_uf_ind = idx_cons(ag_uf_ind), idx_cons(es_uf_ind)
    ag_uf_tec, es_uf_tec = idx_cons(ag_uf_tec), idx_cons(es_uf_tec)
    ag_uf_fin, es_uf_fin = idx_cons(ag_uf_fin), idx_cons(es_uf_fin)

    territorios = [("BR", "Brasil", "Brasil", 1, "1")]
    territorios += [(rid, nome, "Região", 2, cod) for cod, (rid, nome) in REGIOES.items()]
    territorios += [(uf, UF_NOME[uf], "UF", 3, cod) for cod, uf in UF_COD.items()]
    agregados = []
    for tid, nome, tipo, nivel, cod in territorios:
        c22 = bloco_censo22(cens("agua_2022", nivel, cod), cens("esgoto_2022", nivel, cod))
        d22 = bloco_censo22(cens("agua_dom_2022", nivel, cod), cens("esgoto_dom_2022", nivel, cod))
        c10 = bloco_censo10(cens("agua_2010", nivel, cod), cens("esgoto_2010", nivel, cod))
        membros = [r for r in regs if tid == "BR" or r["uf"] == tid or r["regiao"] == tid]
        ids_m = [r["id"] for r in membros]
        fichas = [detalhes_uf[r["uf"]][r["id"]] for r in membros]
        ai, _ = indicadores(ag_uf_ind.get(tid, {}), IND_AGUA)
        ei, _ = indicadores(es_uf_ind.get(tid, {}), IND_ESGOTO)
        at = ag_uf_tec.get(tid, {})
        et = es_uf_tec.get(tid, {})
        af = ag_uf_fin.get(tid, {})
        ef = es_uf_fin.get(tid, {})
        p = pop24.get(f"{nivel}:{cod}")
        agregados.append({
            "id": tid, "nome": nome, "tipo": tipo,
            "censo2022": {"moradores": c22, "domicilios": d22},
            "censo2010": c10,
            "pop24": p if isinstance(p, int) else None,
            "municipios": len(membros),
            "factiveis": bloco_factiveis(fichas),
            "continuidade": bloco_continuidade(fichas),
            "gestao": bloco_gestao(fichas),
            "tarifa_social": {
                "municipios_oferece": sum(1 for r in membros if r["ts_estado"] == "oferece"),
                "municipios_nao_oferece": sum(1 for r in membros if r["ts_estado"] == "nao_oferece"),
                "municipios_sem_resposta": sum(1 for r in membros if r["ts_estado"] is None),
                # razão no mesmo universo: municípios com economias conhecidas e famílias do CadÚnico em dez/2024
                "economias": soma_parcial([r["ts_economias"] for r in membros
                                           if r["ts_economias"] is not None and r["cad_fam_ms"] is not None]),
                "familias_mesmo_universo": soma_parcial([r["cad_fam_ms"] for r in membros
                                                         if r["ts_economias"] is not None and r["cad_fam_ms"] is not None]),
                "municipios_mesmo_universo": sum(1 for r in membros if r["ts_economias"] is not None and r["cad_fam_ms"] is not None),
            },
            "cadunico": {mes: soma_parcial([cad(r["id"], mes) for r in membros]) for mes in (CAD_MES, CAD_MES_ATUAL)},
            "cobertura_sinisa": {
                "agua_participantes": sum(1 for r in membros if r["s_ag"] == "participou"),
                "esgoto_participantes": sum(1 for r in membros if r["s_es"] == "participou"),
                "esgoto_delegacao_sem_atendimento": sum(1 for r in membros if r["s_es"] == "delegacao_sem_atendimento"),
                "agua_dfe0001": num(at.get("DFE0001")),
                "esgoto_dfe0001": num(et.get("DFE0001")),
            },
            "sinisa": {
                "agua": {"indicadores": ai, "pop_atendida": soma(num(at.get("GTA0001")), num(at.get("GTA0002"))),
                         "investimento": bloco_investimento(af, INV_AGUA) if af else None,
                         "linha_indicadores": ag_uf_ind.get(tid, {}).get("_linha")},
                "esgoto": {"indicadores": ei, "pop_atendida": soma(num(et.get("GTE0001")), num(et.get("GTE0002"))),
                           "investimento": bloco_investimento(ef, INV_ESGOTO) if ef else None,
                           "linha_indicadores": es_uf_ind.get(tid, {}).get("_linha")},
            },
        })

    # --- conferências registradas (divergências entre bases)
    def soma_mun(campo, filtro=lambda r: True):
        return soma_parcial([r[campo] for r in regs if filtro(r)])

    conferencias = []
    br = next(a for a in agregados if a["id"] == "BR")
    dfe_es_part = soma_parcial([num(es_tec[c].get("DFE0001")) for c in es_ind if c in es_tec])
    dfe_es_dsa = soma_parcial([num(l.get("DFE0001")) for c, l in es_tec.items()
                               if (texto(l.get("CAD2101")) or "").startswith("Com delegação sem atendimento")])
    conferencias.append({
        "id": "esgoto_populacao_universos",
        "descricao": "População do módulo de esgoto: relatório (participantes com indicadores) versus planilha técnica e financeira.",
        "valores": {
            "dfe0001_municipios_com_indicadores": dfe_es_part,
            "dfe0001_municipios_delegacao_sem_atendimento": dfe_es_dsa,
            "soma": soma(dfe_es_part, dfe_es_dsa),
            "dfe0001_consolidado_brasil": br["cobertura_sinisa"]["esgoto_dfe0001"],
            "municipios_com_indicadores": len(es_ind),
            "municipios_delegacao_sem_atendimento": br["cobertura_sinisa"]["esgoto_delegacao_sem_atendimento"],
        },
        "conclusao": "A diferença entre 173.640.502 e 188.255.906 residentes corresponde exatamente aos municípios com "
                     "delegação sem atendimento (DSA) incluídos nas planilhas de informações e excluídos do cálculo dos indicadores."
        if soma(dfe_es_part, dfe_es_dsa) == br["cobertura_sinisa"]["esgoto_dfe0001"] else
        "A soma não reproduz o consolidado; divergência mantida em aberto.",
    })
    pop_at_mun = soma_mun("ag_pop_at")
    pop_at_br = br["sinisa"]["agua"]["pop_atendida"]
    dif_pop = None if pop_at_mun is None or pop_at_br is None else pop_at_mun - pop_at_br
    conferencias.append({
        "id": "agua_retificacao",
        "descricao": "População atendida com rede de água (GTA0001 + GTA0002): soma da base municipal retificada "
                     "contra o consolidado Brasil.",
        "valores": {
            "soma_municipal_retificada": pop_at_mun,
            "consolidado_brasil": pop_at_br,
            "diferenca": dif_pop,
        },
        "conclusao": "A soma municipal reproduz o consolidado Brasil, sem diferença. As colunas de ligações e economias "
                     "têm conferência própria, logo abaixo; UF, região e Brasil usam o consolidado oficial e os "
                     "municípios usam a base retificada."
        if dif_pop == 0 else
        "A soma municipal difere do consolidado Brasil. UF, região e Brasil usam o consolidado oficial; municípios "
        "usam a base retificada. A diferença é publicada e não é redistribuída.",
    })

    # Contagens de ligações e economias: soma dos municípios (base retificada) contra o consolidado por UF, coluna a coluna.
    unid_tec = {c["codigo"]: c["unidade"] for c in meta_ag_uf_tec["colunas"]}
    nome_tec = {c["codigo"]: c["nome"] for c in meta_ag_uf_tec["colunas"]}
    cols_cont = [c for c, u in unid_tec.items() if u in ("Ligações", "economias")]
    por_uf_col = defaultdict(list)
    for cod, l in ag_tec.items():
        uf_m = UF_COD.get(cod[:2])
        for c in cols_cont:
            v = num(l.get(c))
            if v is not None:
                por_uf_col[(uf_m, c)].append(v)
    detalhe_cont, comparacoes_cont = [], 0
    for tid, l in sorted(ag_uf_tec.items()):
        if tid not in UF_NOME:
            continue
        for c in cols_cont:
            cons = num(l.get(c))
            if cons is None:
                continue
            comparacoes_cont += 1
            soma_m = somar(por_uf_col.get((tid, c), []))
            if abs(soma_m - cons) >= 1:
                detalhe_cont.append({
                    "uf": tid, "codigo": c, "nome": nome_tec[c], "soma_municipal": soma_m, "consolidado_uf": cons,
                    "diferenca_pct": r2((soma_m - cons) / cons * 100, 2) if cons else None,
                })
    detalhe_cont.sort(key=lambda d: (d["uf"], d["codigo"]))
    ufs_div = sorted({d["uf"] for d in detalhe_cont})
    pm, pu = manifesto["planilhas"]["agua_tecnica_municipio"], manifesto["planilhas"]["agua_tecnica_uf"]

    def data_do_cabecalho(planilha_manifesto, rotulo):
        """Data que a própria planilha declara no cabeçalho ("Data de publicação: dd/mm/aaaa"), em ISO; nulo se não declara."""
        for linha in planilha_manifesto["cabecalho"]:
            m = re.match(rf"\s*{rotulo}:\s*(\d{{2}})/(\d{{2}})/(\d{{4}})", str(linha))
            if m:
                return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        return None

    datas_ret = {
        "municipal_publicacao": data_do_cabecalho(pm, "Data de publicação"),
        "municipal_retificacao": data_do_cabecalho(pm, "Data de retificação"),
        "consolidado_uf_publicacao": data_do_cabecalho(pu, "Data de publicação"),
        "consolidado_uf_retificacao": data_do_cabecalho(pu, "Data de retificação"),
    }
    br_data = lambda iso: "/".join(reversed(iso.split("-")))  # noqa: E731
    texto_datas = (
        f"A planilha técnica municipal declara publicação em {br_data(datas_ret['municipal_publicacao'])}"
        + (f" e retificação em {br_data(datas_ret['municipal_retificacao'])}" if datas_ret["municipal_retificacao"] else "")
        + f"; a consolidada por UF declara publicação em {br_data(datas_ret['consolidado_uf_publicacao'])}"
        + (f" e retificação em {br_data(datas_ret['consolidado_uf_retificacao'])}." if datas_ret["consolidado_uf_retificacao"] else ", sem data de retificação.")
    )
    conferencias.append({
        "id": "agua_retificacao_contagens",
        "descricao": "Ligações, economias e domicílios de água (GTA0003 a GTA0018): soma dos municípios (base retificada) "
                     "contra o consolidado de cada UF.",
        "valores": {
            "colunas_comparadas": len(cols_cont),
            "comparacoes_uf_coluna": comparacoes_cont,
            "comparacoes_com_diferenca": len(detalhe_cont),
            "ufs_com_diferenca": len(ufs_div),
            "maior_diferenca_relativa_pct": max((abs(d["diferenca_pct"]) for d in detalhe_cont if d["diferenca_pct"] is not None), default=0),
        },
        "datas": datas_ret,
        "detalhe": detalhe_cont,
        "conclusao": (f"{texto_datas} Em {len(detalhe_cont)} das {comparacoes_cont} comparações por UF e coluna a soma dos "
                      f"municípios difere do consolidado, todas em {', '.join(ufs_div)}; nas demais as somas coincidem. "
                      "UF e Brasil usam o consolidado oficial; os municípios usam a base retificada. A diferença é "
                      "publicada e não é redistribuída.")
        if detalhe_cont else
        f"{texto_datas} As somas municipais coincidem com o consolidado de todas as UF nas {comparacoes_cont} comparações.",
    })
    # Colunas em que a soma dos municípios não é o consolidado da UF, e o que reproduz cada uma (GTA0019, GTA3006, volumes).
    def tec_uf(tid, c):
        return num(ag_uf_tec[tid].get(c))

    por_uf = defaultdict(lambda: defaultdict(list))
    n19_igual = n19_vazio = n19_dif = 0
    vazios_por_uf = Counter()
    for cod, l in ag_tec.items():
        uf_m = UF_COD.get(cod[:2])
        for c in ("GTA0019", "GTA3006", "GTA1009", "GTA1014"):
            v = num(l.get(c))
            if v is not None:
                por_uf[uf_m][c].append(v)
        a19, g1, g2 = num(l.get("GTA0019")), num(l.get("GTA0001")), num(l.get("GTA0002"))
        if g1 is None and g2 is None:
            continue
        if a19 is None:
            n19_vazio += 1
            vazios_por_uf[uf_m] += 1
        elif a19 == (g1 or 0) + (g2 or 0):
            n19_igual += 1
        else:
            n19_dif += 1
    ufs_ids = sorted(UF_NOME)
    ufs19_igual = sum(1 for t in ufs_ids if tec_uf(t, "GTA0019") == soma(tec_uf(t, "GTA0001"), tec_uf(t, "GTA0002")))
    ufs19_dif = sum(1 for t in ufs_ids if somar(por_uf[t]["GTA0019"]) != tec_uf(t, "GTA0019"))
    # GTA3006: o consolidado é a parte inteira da média de dias por município que informou o campo (vazio quando é zero)
    ufs3006_media = 0
    for t in ufs_ids:
        xs = por_uf[t]["GTA3006"]
        media = somar(xs) / len(xs) if xs else 0
        v = tec_uf(t, "GTA3006") or 0
        if v <= media < v + 1:
            ufs3006_media += 1
    dias_br = somar([x for t in ufs_ids for x in por_uf[t]["GTA3006"]])
    # GTA1014: diferença para a soma municipal contra a água importada (GTA1009) que o consolidado não repete
    ufs1014_dif = ufs1014_fecha = 0
    for t in ufs_ids:
        c14, c09 = tec_uf(t, "GTA1014"), (tec_uf(t, "GTA1009") or 0)
        if c14 is None:
            continue
        d14 = c14 - somar(por_uf[t]["GTA1014"])
        if abs(d14) <= 0.05:
            continue
        ufs1014_dif += 1
        if abs(d14 + (somar(por_uf[t]["GTA1009"]) - c09)) <= 0.05:
            ufs1014_fecha += 1
    maior_vazio = vazios_por_uf.most_common(1)[0] if vazios_por_uf else None
    conferencias.append({
        "id": "agua_colunas_sem_soma",
        "descricao": "Colunas técnicas de água em que a soma dos municípios não é o consolidado da UF: população total "
                     "atendida (GTA0019), dias de colapso (GTA3006) e volume de entrada (GTA1014).",
        "valores": {
            "gta0019_municipios_iguais_a_gta0001_mais_gta0002": n19_igual,
            "gta0019_municipios_vazios": n19_vazio,
            "gta0019_municipios_diferentes": n19_dif,
            "gta0019_ufs_consolidado_igual_a_gta0001_mais_gta0002": ufs19_igual,
            "gta0019_ufs_com_soma_municipal_diferente": ufs19_dif,
            "gta3006_ufs_consolidado_igual_a_media_truncada": ufs3006_media,
            "gta3006_soma_municipal_dias": r2(dias_br),
            "gta3006_consolidado_brasil": tec_uf("BR", "GTA3006"),
            "gta1014_ufs_com_diferenca": ufs1014_dif,
            "gta1014_ufs_que_fecham_com_agua_importada": ufs1014_fecha,
        },
        "conclusao": (
            f"GTA0019: o consolidado de {ufs19_igual} das {len(ufs_ids)} UFs é igual a GTA0001 + GTA0002, a soma que o "
            f"Observatório usa no município; a coluna GTA0019 da planilha municipal está vazia em {n19_vazio} municípios"
            + (f" ({maior_vazio[1]} em {maior_vazio[0]})" if maior_vazio else "")
            + f" e difere dessa soma em {n19_dif}, por isso a soma municipal de GTA0019 não fecha em {ufs19_dif} UFs. "
            f"GTA3006: em {ufs3006_media} das {len(ufs_ids)} UFs o consolidado é a parte inteira da média de dias por município "
            "que informou o campo, vazio quando é zero, e não a soma de dias; o painel de resiliência usa a soma municipal e a "
            "rotula como tal. "
            f"GTA1014: das {ufs1014_dif} UFs com diferença, {ufs1014_fecha} fecham exatamente com a água importada (soma "
            "municipal de GTA1009 menos o GTA1009 consolidado); nas demais a diferença não se reproduz e a causa não foi "
            "estabelecida. A planilha não declara essas agregações no cabeçalho: as regras de GTA0019 e GTA3006 foram "
            "deduzidas dos números."
        ),
    })
    inv_mun = soma_mun("inv_ag")
    inv_cons = br["sinisa"]["agua"]["investimento"]["total"] if br["sinisa"]["agua"]["investimento"] else None
    conferencias.append({
        "id": "agua_investimento_municipal_vs_consolidado",
        "descricao": "Investimento em água (prestador + Estado): soma dos municípios versus consolidado Brasil.",
        "valores": {"soma_municipal": r2(inv_mun), "consolidado_brasil": inv_cons,
                    "diferenca": None if inv_mun is None or inv_cons is None else r2(inv_mun - inv_cons)},
        "conclusao": "O total municipal soma as parcelas informadas (prestador e Estado), como a consolidação oficial; "
                     "a soma dos municípios deve reproduzir o consolidado Brasil.",
    })

    consistentes, inconsistentes = 0, 0
    for mes in (CAD_MES, CAD_MES_ATUAL):
        for v in cad_seed["meses"][mes]["municipios"].values():
            t = [v.get(k) for k in ("cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i",
                                    "cadun_qtd_familias_cadastradas_rfpc_acima_meio_sm_i", "cadun_qtd_familias_cadastradas_i")]
            if None in t:
                continue
            if t[0] + t[1] == t[2]:
                consistentes += 1
            else:
                inconsistentes += 1
    conferencias.append({
        "id": "cadunico_faixas_de_renda",
        "descricao": "CadÚnico: famílias até meio salário-mínimo mais famílias acima somam o total de famílias cadastradas, "
                     "município a município, nos dois meses usados.",
        "valores": {"registros_consistentes": consistentes, "registros_inconsistentes": inconsistentes,
                    "diferenca": inconsistentes,
                    "familias_ate_meio_sm_dez2024": br["cadunico"][CAD_MES],
                    "familias_ate_meio_sm_mais_recente": br["cadunico"][CAD_MES_ATUAL]},
        "conclusao": "As faixas de renda fecham com o total em todos os municípios publicados; o denominador da razão de "
                     "tarifa social é a faixa até meio salário-mínimo."
        if inconsistentes == 0 else "Há municípios em que as faixas não fecham com o total; ver registros_inconsistentes.",
    })

    meta = {
        "observatorio": "Observatório Brasileiro do Saneamento",
        "gerado_de": "pipeline/observatorio_saneamento/seed (sha256 de cada original no manifesto)",
        "sinisa": {
            "edicao": "SINISA 2025",
            "ano_referencia": 2024,
            "publicacao": "2025-12-18",
            "retificacao_agua_municipal": "2026-05-25",
            "capturado_em": manifesto["capturado_em"],
            "pagina": manifesto["pagina"],
            "zips": manifesto["zips"],
            "planilhas": {k: {kk: v[kk] for kk in ("arquivo", "zip", "sha256", "data_no_zip", "aba", "registros")}
                          for k, v in manifesto["planilhas"].items()},
        },
        "censo": {
            "capturado_em": censo["capturado_em"],
            "tabelas": {k: {"tabela": t["tabela"], "titulo": t["titulo"], "ano": t["ano"],
                            "consultas": len(t["consultas"]),
                            "sha256_consultas": [c["sha256"] for c in t["consultas"]]}
                        for k, t in T.items()},
            "populacao_2024": {"tabela": censo["populacao_2024"]["tabela"], "ano": 2024},
            "municipios": {"url": censo["municipios"]["url"], "sha256": censo["municipios"]["sha256"],
                           "total": len(municipios_ibge)},
        },
        "cadunico": {
            "fonte": "MDS, SAGI, API MI Social (base do VIS Data)",
            "url": cad_seed["fonte"],
            "capturado_em": cad_seed["capturado_em"],
            "criterio": "Famílias cadastradas com renda familiar per capita até meio salário-mínimo (Lei 14.898/2024, art. 2º)",
            "mes_referencia": CAD_MES,
            "mes_mais_recente": CAD_MES_ATUAL,
            "meses": {m: {"url": v["url"], "sha256": v["sha256"], "registros": v["registros"]}
                      for m, v in sorted(cad_seed["meses"].items())},
        },
        "metas": {"agua": META_AGUA, "esgoto": META_ESGOTO, "data": DATA_META,
                  "base_legal": "Lei 11.445/2007, art. 11-B, redação da Lei 14.026/2020"},
        "cobertura": {
            "municipios_ibge": len(municipios_ibge),
            "municipios_censo_2022": sum(1 for r in regs if r["censo"]),
            "municipios_censo_2010": sum(1 for r in regs if r["c10_mor"] is not None),
            "agua_participantes": sum(1 for r in regs if r["s_ag"] == "participou"),
            "esgoto_participantes": sum(1 for r in regs if r["s_es"] == "participou"),
            "esgoto_delegacao_sem_atendimento": sum(1 for r in regs if r["s_es"] == "delegacao_sem_atendimento"),
            "esgoto_informacoes_sem_indicadores": sum(1 for r in regs if r["s_es"] == "informacoes_sem_indicadores"),
            "prestadores": len(lista_prest),
            "etes": len(lista_etes),
        },
        "conferencias": conferencias,
    }
    lista_reg = []
    for c, r in reguladores.items():
        lista_reg.append({
            "cnpj": c,
            "nome": r["nomes"].most_common(1)[0][0],
            "sigla": r["siglas"].most_common(1)[0][0],
            "abrangencia": r["abrangencias"].most_common(1)[0][0],
            "variantes_nome": sorted(n for n in r["nomes"] if n),
            "ufs": sorted(r["ufs"]),
            "municipios_agua": sorted(r["municipios_agua"]),
            "municipios_esgoto": sorted(r["municipios_esgoto"]),
        })
    lista_reg.sort(key=lambda r: (-len(r["municipios_agua"]), r["nome"] or ""))
    meta["cobertura"]["gestao_municipal_respondentes"] = sum(1 for l in gm.values()
                                                          if l.get("Respondeu ao Módulo Gestão Municipal do SINISA 2024") == "Sim")
    meta["cobertura"]["reguladores_cnpj"] = len(lista_reg)
    meta["sinisa"]["gestao_municipal"] = {"url": gm_seed["url"], "sha256": gm_seed["sha256"], "capturado_em": gm_seed["capturado_em"]}
    # Tabulações oficiais por grupo e nível territorial, sem média de percentuais.
    SPECS = SPECS_DESIGUALDADES
    for r in regs:
        valores = desigualdades["territorios"].get("6:" + r["id"], {})
        for spec in SPECS:
            num_, den_ = valores.get(spec["id"], [None, None])
            r["des_" + spec["id"] + "_num"] = num_
            r["des_" + spec["id"] + "_den"] = den_
        detalhes_uf[r["uf"]][r["id"]]["desigualdades"] = valores
    for a in agregados:
        cod = "1:1" if a["id"] == "BR" else ("3:" + next(k for k, v in UF_COD.items() if v == a["id"]) if a["tipo"] == "UF" else "2:" + next(k for k, (rid, _) in REGIOES.items() if rid == a["id"]))
        a["desigualdades"] = desigualdades["territorios"].get(cod, {})
    meta["desigualdades"] = {k: v for k, v in desigualdades.items() if k != "territorios"}
    br_des = next(a for a in agregados if a["id"] == "BR")
    meta["desigualdades"]["residuos_cor_raca"] = {
        "universo": br_des["censo2022"]["moradores"]["agua"]["total"] - sum(br_des["desigualdades"][s["id"]][1] for s in SPECS if s["tabela"] == 6894),
        "agua": br_des["censo2022"]["moradores"]["agua"]["sem_ligacao"] - sum(br_des["desigualdades"][s["id"]][0] for s in SPECS if s["tabela"] == 6894),
        "esgoto": br_des["censo2022"]["moradores"]["esgoto"]["sem_rede_nem_septica"] - sum(br_des["desigualdades"][s["id"]][0] for s in SPECS if s["tabela"] == 7555),
    }
    # Qualidade da água (SISAGUA): contadores municipais por ano, em arquivo próprio.
    ids6 = [r["id"][:6] for r in regs]
    uf6 = {r["id"][:6]: r["uf"] for r in regs}
    qualidade, meta["sisagua"] = sisagua.construir(ids6, uf6)
    quimicos, meta["sisagua"]["quimicos"] = sisagua_quimicos.construir(ids6, uf6)
    for i, campos_q in quimicos.items():
        qualidade[i].update(campos_q)
    for r in regs:
        r.update(qualidade[r["id"][:6]])
        detalhes_uf[r["uf"]][r["id"]]["qualidade"] = qualidade[r["id"][:6]]
    # Saúde e ambiente (SIH e SIM): contagens municipais da janela, em arquivo próprio.
    saude_campos, meta["saude"] = saude.construir(ids6, uf6)
    for r in regs:
        r.update(saude_campos[r["id"][:6]])
    # Controle societário das companhias abertas (CVM, FRE), ligado aos prestadores por CNPJ: arquivo próprio.
    controle_gold, meta["cvm"] = controle.construir(controle.declarados(aba("Detalhamento Prestadores Serv")), lista_prest)
    # Comparação internacional (JMP, OMS e UNICEF): estimativas por país, arquivo próprio.
    jmp_gold, meta["jmp"] = jmp.construir()
    return {
        "reguladores": lista_reg,
        "meta": meta,
        "municipios": regs,
        "detalhes_uf": detalhes_uf,
        "agregados": agregados,
        "prestadores": lista_prest,
        "etes": lista_etes,
        "controle": controle_gold,
        "jmp": jmp_gold,
    }


# ---------------------------------------------------------------------------
# escrita
# ---------------------------------------------------------------------------

CAMPOS_MUNICIPIOS = [
    ("id", "Código IBGE"), ("nome", "Município"), ("uf", "UF"), ("regiao", "Região"),
    ("pop22", "Moradores em domicílios particulares permanentes ocupados, Censo 2022"),
    ("pop24", "População residente estimada 2024 (IBGE)"),
    ("dfe0001", "População total residente usada pelo SINISA (DFE0001)"),
    ("c22_ag_rede", "Censo 2022: moradores com ligação à rede geral de água usada como forma principal"),
    ("c22_ag_lig_outra", "Censo 2022: moradores com ligação à rede geral que usam principalmente outra forma"),
    ("c22_ag_sem", "Censo 2022: moradores sem ligação à rede geral de água"),
    ("c22_es_rede", "Censo 2022: moradores com rede geral, rede pluvial ou fossa ligada à rede"),
    ("c22_es_rede_pluvial", "Censo 2022: moradores com rede geral ou pluvial (sem fossa ligada à rede)"),
    ("c22_es_septica", "Censo 2022: moradores com fossa séptica ou fossa filtro não ligada à rede"),
    ("c22_es_precario", "Censo 2022: moradores com fossa rudimentar, vala, rio, lago ou mar, ou outra forma"),
    ("c22_es_sem_banheiro", "Censo 2022: moradores sem banheiro nem sanitário"),
    ("c10_mor", "Censo 2010: moradores em domicílios particulares permanentes"),
    ("c10_ag_rede", "Censo 2010: moradores com rede geral como forma de abastecimento"),
    ("c10_es_rede", "Censo 2010: moradores com rede geral de esgoto ou pluvial"),
    ("s_ag", "SINISA 2024: situação no módulo água"),
    ("s_es", "SINISA 2024: situação no módulo esgoto"),
    ("ag_pop_at", "SINISA 2024: população atendida com rede de água (GTA0001 + GTA0002)"),
    ("IAG0001", "SINISA 2024: atendimento da população total com rede de água (%)"),
    ("IAG2013", "SINISA 2024: perdas totais de água na distribuição (%)"),
    ("IAG3004", "SINISA 2024: duração média das paralisações (horas)"),
    ("ag_paralisacoes", "SINISA 2024: paralisações com falta de água (GTA3001)"),
    ("ag_interrupcoes", "SINISA 2024: interrupções sistemáticas (GTA3003)"),
    ("es_pop_at", "SINISA 2024: população atendida com rede de esgoto (GTE0001 + GTE0002)"),
    ("IES0001", "SINISA 2024: atendimento da população total com rede coletora de esgoto (%)"),
    ("IES0004", "SINISA 2024: atendimento dos domicílios totais com rede coletora (%)"),
    ("IES0007", "SINISA 2024: atendimento dos domicílios totais com coleta e tratamento (%)"),
    ("IES2003", "SINISA 2024: esgoto tratado referido à água consumida (%)"),
    ("IES2004", "SINISA 2024: esgoto tratado referido ao esgoto coletado (%)"),
    ("dom_est24", "Domicílios ocupados estimados para 2024 (população estimada ÷ moradores por domicílio do Censo 2022), critério da NR ANA 8/2024"),
    ("nr8_ag_num", "SINISA 2024: economias residenciais ativas de água (GTA0009 + GTA0016)"),
    ("iaa_rede", "IAA da NR ANA 8/2024, parcela de rede pública, calculado pelo Observatório (%)"),
    ("nr8_es_num", "SINISA 2024: economias residenciais ativas com tratamento de esgoto (GTE0009 + GTE0019)"),
    ("iae_rede", "IAE da NR ANA 8/2024, parcela de rede pública com tratamento, calculado pelo Observatório (%)"),
    ("inv_ag", "SINISA 2024: investimento em água, prestador + Estado (R$ correntes)"),
    ("inv_es", "SINISA 2024: investimento em esgoto, prestador + Estado (R$ correntes)"),
    ("n_prest_ag", "SINISA 2024: prestadores de água declarados no município"),
    ("n_prest_es", "SINISA 2024: prestadores de esgoto declarados no município"),
    ("nat_ag", "SINISA 2024: natureza jurídica do prestador de água"),
    ("nat_es", "SINISA 2024: natureza jurídica do prestador de esgoto"),
    ("gm_respondeu", "SINISA 2024, Gestão Municipal: respondeu ao módulo"),
    ("plano", "SINISA 2024, Gestão Municipal: declara Plano de Saneamento Básico (municipal ou regional)"),
    ("plano_ano", "SINISA 2024, Gestão Municipal: ano do instrumento de aprovação do plano"),
    ("reg_ag", "SINISA 2024, Gestão Municipal: entidade reguladora declarada para água"),
    ("reg_es", "SINISA 2024, Gestão Municipal: entidade reguladora declarada para esgoto"),
    ("ts_estado", "SINISA 2024: tarifa social de água (oferece, nao_oferece; vazio sem resposta)"),
    ("ts_economias", "SINISA 2024: economias residenciais com tarifa social de água (GFI1036, soma dos prestadores)"),
    ("cad_fam_ms", "CadÚnico dez/2024: famílias com renda per capita até meio salário-mínimo"),
    ("cad_fam_ms_atual", "CadÚnico set/2026: famílias com renda per capita até meio salário-mínimo"),
]


# Capítulo 2 (Censo 2022 por grupo): arquivo próprio, carregado só pelo atlas do capítulo,
# para não pesar a tabela municipal que todos os atlas baixam.
CAMPOS_DESIGUALDADES = [("id", "Código IBGE do município")] + [
    ("des_" + s["id"] + "_" + c, s["rotulo"] + ": " + s["medida"] + ", " + rotulo + " (" + s["unidade"] + ", Censo 2022)")
    for s in SPECS_DESIGUALDADES for c, rotulo in [("num", "carência"), ("den", "universo")]
]


# Capítulo 3 (SISAGUA): arquivo próprio, carregado só pelo atlas da qualidade da água.
ROTULOS_QUALIDADE = {
    "ctrl_ecoli": "controle, amostras com presença de E. coli",
    "ctrl_colif": "controle, amostras com presença de coliformes totais",
    "ctrl_cloro": "controle, amostras com cloro residual livre abaixo de 0,2 mg/L",
    "ctrl_turb": "controle, amostras com turbidez acima de 5,0 uT",
    "vig_ecoli": "vigilância (rotina), amostras com presença de E. coli",
    "vig_cloro": "vigilância (rotina), amostras com cloro residual livre abaixo de 0,2 mg/L",
    "plano": "plano de amostragem, análises de coliformes totais exigidas e cobertas no sistema de distribuição de SAA",
    "ctrl_cor": "controle, amostras com cor aparente acima de 15 uH",
    "ctrl_fluor": "controle, amostras com fluoreto acima de 1,5 mg/L",
    "vig_fluor": "vigilância (rotina), amostras com fluoreto acima de 1,5 mg/L",
    "plano_sac": "plano de amostragem, análises de coliformes totais exigidas e cobertas no ponto de consumo de SAC",
    "pop_saa": "cadastro, população estimada sob SAA com registro de controle no ano",
    "pop_sac": "cadastro, população estimada sob SAC com registro de controle no ano",
    "ctrl_agro": "controle semestral, análises de agrotóxicos acima do VMP na água tratada",
    "ctrl_quim": "controle semestral, análises de substâncias inorgânicas, orgânicas e subprodutos da desinfecção acima do VMP na água tratada",
    "ctrl_organol": "controle semestral, análises do padrão organoléptico acima do VMP na água tratada",
    "vig_quim": "vigilância (rotina), análises de agrotóxicos e demais substâncias químicas acima do VMP na água tratada",
}


def _rotulo_qualidade(c):
    partes = c.split("_")
    ano = next(p for p in partes if p.isdigit())
    if partes[1] == "reg":
        return f"SISAGUA {ano}: município com registro de {'controle' if partes[2] == 'ctrl' else 'vigilância'} (1 sim, 0 não)"
    mid = "_".join(partes[1:partes.index(ano)])
    papel = {"num": "numerador", "den": "denominador"}[partes[-1]]
    if mid.startswith("plano"):
        papel = {"num": "análises cobertas", "den": "análises exigidas"}[partes[-1]]
    elif mid.startswith("pop"):
        papel = {"num": "população sob formas com controle", "den": "população cadastrada"}[partes[-1]]
    elif papel == "denominador":
        papel = "amostras com resultado válido"
    else:
        papel = "amostras com o resultado medido"
    return f"SISAGUA {ano}, {ROTULOS_QUALIDADE[mid]}: {papel}"


CAMPOS_QUALIDADE = [("id", "Código IBGE do município")] + [(c, _rotulo_qualidade(c)) for c in sisagua.campos() + sisagua_quimicos.campos()]


# Capítulo 13 (saúde e ambiente): arquivo próprio, carregado só pelo atlas do capítulo.
def _rotulo_saude(c):
    _, grupo, sistema, medida = c.split("_")
    nome = "total dos três grupos" if grupo == "total" else next(g["rotulo"] + " (CID-10 " + g["cid"] + ")" for g in saude.GRUPOS if g["id"] == grupo)
    rotulo = next(m[5] for m in saude.MEDIDAS if m[0] == sistema and m[1] == medida)
    return f"Saúde {saude.ANOS[0]} a {saude.ANOS[-1]}, {nome}: {rotulo}, soma dos anos"


CAMPOS_SAUDE = [("id", "Código IBGE do município")] + [(c, _rotulo_saude(c)) for c in saude.campos()]


def json_bytes(obj):
    return (json.dumps(obj, ensure_ascii=False, sort_keys=False, separators=(",", ":")) + "\n").encode()


def csv_bytes(cab, linhas):
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(cab)
    for l in linhas:
        w.writerow(["" if v is None else (str(v).replace(".", ",") if isinstance(v, float) else v) for v in l])
    return ("﻿" + buf.getvalue()).encode()


def compacto(obj):
    """Remove chaves com None nas fichas detalhadas: chave ausente = não informado.

    Zero continua zero. Listas preservam posição (None fica)."""
    if isinstance(obj, dict):
        return {k: compacto(v) for k, v in obj.items() if v is not None and v != {}}
    if isinstance(obj, list):
        return [compacto(v) for v in obj]
    return obj


def arquivos(g):
    """Dicionário nome → bytes de tudo o que vai para public/saneamento/gold."""
    out = {}
    campos = [c for c, _ in CAMPOS_MUNICIPIOS]
    out["municipios.json"] = json_bytes({
        "campos": campos,
        "rotulos": dict(CAMPOS_MUNICIPIOS),
        "linhas": [[r[c] for c in campos] for r in g["municipios"]],
    })
    out["indice.json"] = json_bytes([[r["id"], r["nome"], r["uf"]] for r in g["municipios"]])
    for uf, d in sorted(g["detalhes_uf"].items()):
        out[f"uf/{uf}.json"] = json_bytes(compacto(d))
    out["agregados.json"] = json_bytes(g["agregados"])
    out["prestadores.json"] = json_bytes(g["prestadores"])
    out["etes.json"] = json_bytes(g["etes"])
    out["meta.json"] = json_bytes(g["meta"])
    out["reguladores.json"] = json_bytes(g["reguladores"])
    out["municipios.csv"] = csv_bytes([r for _, r in CAMPOS_MUNICIPIOS], [[r[c] for c in campos] for r in g["municipios"]])
    campos_des = [c for c, _ in CAMPOS_DESIGUALDADES]
    out["desigualdades_municipios.json"] = json_bytes({
        "campos": campos_des,
        "rotulos": dict(CAMPOS_DESIGUALDADES),
        "linhas": [[r[c] for c in campos_des] for r in g["municipios"]],
    })
    out["desigualdades_municipios.csv"] = csv_bytes([r for _, r in CAMPOS_DESIGUALDADES], [[r[c] for c in campos_des] for r in g["municipios"]])
    campos_qa = [c for c, _ in CAMPOS_QUALIDADE]
    out["qualidade_municipios.json"] = json_bytes({
        "campos": campos_qa,
        "rotulos": dict(CAMPOS_QUALIDADE),
        "linhas": [[r[c] for c in campos_qa] for r in g["municipios"]],
    })
    out["qualidade_municipios.csv"] = csv_bytes([r for _, r in CAMPOS_QUALIDADE], [[r[c] for c in campos_qa] for r in g["municipios"]])
    campos_sd = [c for c, _ in CAMPOS_SAUDE]
    out["saude_municipios.json"] = json_bytes({
        "campos": campos_sd,
        "rotulos": dict(CAMPOS_SAUDE),
        "linhas": [[r[c] for c in campos_sd] for r in g["municipios"]],
    })
    out["saude_municipios.csv"] = csv_bytes([r for _, r in CAMPOS_SAUDE], [[r[c] for c in campos_sd] for r in g["municipios"]])
    out["controle_societario.json"] = json_bytes(g["controle"])
    cab_cs, linhas_cs = controle.linhas_csv(g["controle"])
    out["controle_societario.csv"] = csv_bytes(cab_cs, linhas_cs)
    out["jmp_paises.json"] = json_bytes(g["jmp"])
    cab_j, linhas_j = jmp.linhas_csv(g["jmp"])
    out["jmp_paises.csv"] = csv_bytes(cab_j, linhas_j)
    cab_p = ["id", "nome", "sigla", "natureza", "abrangencia", "ufs", "municipios_agua", "municipios_esgoto",
             "populacao_atendida_agua", "populacao_atendida_esgoto", "perdas_distribuicao_pct",
             "investimento_agua", "investimento_esgoto"]
    out["prestadores.csv"] = csv_bytes(cab_p, [[
        p["id"], p["nome"], p["sigla"], p["natureza"], p["abrangencia"], ",".join(p["ufs"]),
        len(p["municipios_agua"]), len(p["municipios_esgoto"]), p["populacao_atendida_agua"],
        p["populacao_atendida_esgoto"], p["perdas_distribuicao_pct"], p["investimento_agua"], p["investimento_esgoto"],
    ] for p in g["prestadores"]])
    cab_e = ["codigo", "nome", "municipio", "uf", "prestador", "em_operacao", "nivel", "capacidade_nominal_ls",
             "volume_tratado_mil_m3", "utilizacao_pct", "eficiencia_dbo_pct", "corpo_receptor"]
    out["etes.csv"] = csv_bytes(cab_e, [[e[c] for c in cab_e] for e in g["etes"]])
    return out


def materializar(destino=DESTINO):
    g = construir()
    arqs = arquivos(g)
    for nome, b in arqs.items():
        caminho = os.path.join(destino, nome)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, "wb") as f:
            f.write(b)
    return g, arqs


if __name__ == "__main__":
    g, arqs = materializar()
    tam = sum(len(b) for b in arqs.values())
    print(f"{len(arqs)} arquivos, {tam / 1e6:.1f} MB em {DESTINO}")
    print(json.dumps(g["meta"]["cobertura"], ensure_ascii=False))
    for c in g["meta"]["conferencias"]:
        print(c["id"], json.dumps(c["valores"], ensure_ascii=False))
