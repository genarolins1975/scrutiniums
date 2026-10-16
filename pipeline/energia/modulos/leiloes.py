"""Módulo Leilões: o que o ambiente de contratação regulada (ACR) comprou em leilão de
geração desde 2005, a que preço, onde, de quem e o que já foi entregue; e os leilões de
transmissão em reais de hoje.

Perguntas e regras publicadas:

- Quanto se contratou: energia vendida em MWmédio (VlrEnergiaVendida), somável entre
  leilões porque cada linha é um contrato; potência em MW só por leilão ou por
  empreendimento distinto (uma usina vendida em mais de um leilão repete a potência).
- Preço: preço de venda (ou ICB nas termelétricas por disponibilidade, como publicado)
  médio ponderado pela energia vendida, nominal e corrigido pelo IPCA do mês do leilão ao
  último mês publicado pelo IBGE. Deságio agregado = 100 × (1 − Σ preço × energia ÷ Σ teto
  × energia).
- O que foi entregue: situação atual de cada empreendimento pelo núcleo do CEG, cruzando
  o cadastro do SIGA e os atos de encerramento de outorga publicados pelo módulo Expansão
  na mesma execução (public/energia/series/expansao_*.csv). Não é auditoria de contrato:
  cronogramas alterados por ato, rescisões e substituições não estão nos arquivos.
- Quem venceu: a vencedora como publicada pela ANEEL (texto, sem CNPJ) e, à parte, o
  grupo que controla a usina hoje pelo vínculo provado do módulo Empresas (proprietário
  com mais de 50% no SIGA e o topo da sua cadeia de controle declarada). O grupo atual não
  é a vencedora na data do leilão.
- Transmissão: os lotes do arquivo publicado pelo módulo Expansão
  (expansao_leiloes_transmissao.csv), com RAP e investimento corrigidos pelo IPCA e o
  deságio por lote; nenhuma coleta própria.

Cobertura: a base aberta traz leilões de energia nova (A-3 a A-6 no arquivo), de energia de
reserva, de fontes alternativas e de projetos estruturantes, de 2005 a 2025. Leilões de
energia existente, de ajuste, de reserva de capacidade, de sistemas isolados e o
procedimento competitivo simplificado de 2021 não estão no arquivo: ausência na base não é
prova de que o leilão não ocorreu.
"""
import hashlib
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_leiloes as al  # noqa: E402
from pipeline.energia.fontes import ckan, ibge_pld  # noqa: E402
from pipeline.energia.fontes.ibge_conta import LICENCA_IBGE  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "leiloes.json"
FAMILIA = "aneel_leiloes"
ROTA = "/setor-eletrico/leiloes"
ROTA_TRANSMISSAO = f"{ROTA}/transmissao"
PAGINAS = [{"rotulo": "Leilões do ACR", "href": ROTA}]
PAGINAS_T = [{"rotulo": "Leilões de transmissão", "href": ROTA_TRANSMISSAO}]
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"

DS_LEILOES = "aneel_leiloes_geracao"
DS_IPCA = "ibge_ipca"
PACOTE = "resultado-de-leiloes"
URL_LEILOES = "https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes"
RECURSO_IPCA = "sidra_1737_ipca_indice"

FONTE_LEILOES = {"orgao": "ANEEL", "dataset": "Resultado de leilões de geração e transmissão de energia elétrica",
                 "recurso": al.RECURSO, "url_dataset": URL_LEILOES, "licenca": LICENCA_ANEEL}
FONTE_IPCA = {"orgao": "IBGE", "dataset": "IPCA: número-índice (base dezembro de 1993 = 100), tabela SIDRA 1737",
              "recurso": "variável 2266", "url_dataset": ibge_pld.URL_TABELA, "url_primaria": ibge_pld.URL_SIDRA,
              "licenca": LICENCA_IBGE}

SERIES_URL = "/energia/series/"
DOWNLOADS = {
    "empreendimentos": SERIES_URL + "leiloes_empreendimentos.csv",
    "leiloes": SERIES_URL + "leiloes_por_leilao.csv",
    "preco": SERIES_URL + "leiloes_preco_fonte_ano.csv",
    "grupos": SERIES_URL + "leiloes_grupos_controle.csv",
    "transmissao": SERIES_URL + "leiloes_transmissao_real.csv",
    "pontos": SERIES_URL + "leiloes_empreendimentos.json",
}

# Insumos publicados por outros módulos na mesma execução (ordem 30 e 60): lidos de
# public/energia/series, com sha256 registrado na gold.
INSUMOS = {
    "siga": ("expansao_usinas_siga.csv", "expansao"),
    "encerramentos": ("expansao_encerramentos_outorga.csv", "expansao"),
    "ralie": ("expansao_carteira_ralie.csv", "expansao"),
    "transmissao": ("expansao_leiloes_transmissao.csv", "expansao"),
    "ativos": ("empresas_ativos.csv", "empresas"),
    "cadeia": ("empresas_cadeia.json", "empresas"),
    "grupos": ("empresas_grupos.csv", "empresas"),
}

COLUNAS = {
    "empreendimentos": [
        ("linha", "posição no arquivo da ANEEL"), ("data_leilao", None), ("leilao", "NumLeilao"), ("nome_leilao", "DscNumeroLeilaoCCEE com a grafia normalizada"),
        ("tipo", "DscTipoLeilao"), ("ano_a", "ano do leilão + x nos produtos A-x; vazio nos demais"), ("empreendimento", None),
        ("ceg", None), ("nucleo_ceg", None), ("tipo_geracao", None), ("fonte", "DscFonteEnergia"), ("detalhe_fonte", None),
        ("categoria", "categoria do observatório"), ("uf", "UF principal"), ("mw", "potência instalada, MW"),
        ("garantia_fisica_mwmed", "vazio = 0 na fonte (não preenchido)"), ("energia_mwmed", "energia vendida, MWmédio"),
        ("preco_teto_rs_mwh", None), ("preco_rs_mwh", "preço de venda ou ICB, R$/MWh nominais; vazio = 0 na fonte"),
        ("desagio_pct", "como publicado; vazio sem preço"), ("fator_ipca", "I(último mês) ÷ I(mês do leilão)"),
        ("preco_real_rs_mwh", "preço × fator_ipca"), ("investimento_rs", "R$ nominais; vazio = 0 na fonte"),
        ("duracao_anos", None), ("vencedora", "DscEmpresaVencedora como publicada (empresa ou cotista do consórcio)"),
        ("situacao", "operacao, construcao, nao_iniciada, encerrada, sem_registro ou sem_ceg"), ("fase_siga", None),
        ("entrada_operacao_siga", "vazio = sem data no SIGA"), ("entrada_vs_ano_a", "antes_do_leilao, ate_ano_a, depois_ano_a, sem_data; vazio sem ano A ou fora de operação"),
        ("ato_encerramento", "1 = há ato de revogação ou extinção desde 2015 para o núcleo"),
        ("situacao_obra_ralie", "só para usinas no RALIE"), ("controle_atual", "controlada, sem_majoritario, sem_proprietario ou fora_do_cadastro"),
        ("proprietario_majoritario_cnpj", None), ("grupo_controle_cnpj", "topo da cadeia de controle declarada à ANEEL"),
        ("grupo_controle_nome", None), ("ceg_repetido_no_leilao", "1 = o núcleo aparece em mais de uma linha do mesmo leilão")],
    "leiloes": [
        ("leilao", None), ("data", None), ("nome_leilao", None), ("tipo", None), ("ano_a", None), ("empreendimentos", None),
        ("mw", "soma da potência das linhas"), ("energia_mwmed", None), ("preco_medio_rs_mwh", "ponderado pela energia, linhas com preço"),
        ("preco_medio_real_rs_mwh", "idem, corrigido pelo IPCA"), ("teto_medio_rs_mwh", "ponderado pela energia"),
        ("desagio_agregado_pct", "100 × (1 − Σ preço × energia ÷ Σ teto × energia)"), ("investimento_rs_mi", "linhas com investimento informado"),
        ("energia_operacao_mwmed", None), ("energia_construcao_mwmed", None), ("energia_nao_iniciada_mwmed", None),
        ("energia_encerrada_mwmed", None), ("energia_sem_registro_mwmed", None), ("energia_sem_ceg_mwmed", None)],
    "preco": [("ano", None), ("categoria", None), ("leiloes", None), ("empreendimentos", None), ("energia_mwmed", None),
              ("preco_medio_rs_mwh", "nominal, ponderado pela energia"), ("preco_medio_real_rs_mwh", "IPCA até o último mês publicado"),
              ("teto_medio_rs_mwh", None), ("desagio_agregado_pct", None)],
    "grupos": [("grupo_controle_cnpj", None), ("grupo_controle_nome", None), ("empreendimentos", "linhas de leilão"),
               ("usinas", "núcleos do CEG distintos"), ("energia_mwmed", None), ("cadeia_cnpjs", "CNPJs da cadeia de controle, separados por |")],
    "transmissao": [("ano", None), ("lotes_contratados", None), ("rap_vencedora_rs_mi", "nominal"), ("rap_vencedora_real_rs_mi", "IPCA até o último mês publicado"),
                    ("rap_edital_rs_mi", "nominal"), ("investimento_rs_mi", "nominal, lotes com investimento"), ("investimento_real_rs_mi", None),
                    ("desagio_agregado_pct", "pela RAP"), ("desagio_mediano_lote_pct", "mediana dos lotes"), ("desagio_p25_pct", None), ("desagio_p75_pct", None)],
}

REGISTRO = {
    "id": "leiloes", "gold": GOLD, "familia": FAMILIA, "ordem": 65,
    "datasets": [
        {"orgao": "ANEEL", "nome": PACOTE, "slug": "aneel-resultado-leiloes", "dataset_silver": DS_LEILOES,
         "titulo": "Resultado de leilões de geração (ACR, desde 2005)", "estado": "UTILIZADO EM INDICADOR", "url": URL_LEILOES,
         "licenca": LICENCA_ANEEL, "paginas": PAGINAS + PAGINAS_T,
         "downloads": [DOWNLOADS["empreendimentos"], DOWNLOADS["leiloes"], DOWNLOADS["preco"], DOWNLOADS["grupos"]], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-1737", "slug": "ibge-ipca-1737", "dataset_silver": DS_IPCA,
         "titulo": "IPCA: número-índice (base dezembro de 1993 = 100), tabela SIDRA 1737", "estado": "UTILIZADO EM INDICADOR",
         "url": ibge_pld.URL_TABELA, "licenca": LICENCA_IBGE, "tema": "precos",
         "descricao": "Número-índice mensal do IPCA, usado para expressar preços de leilão e RAP de transmissão em reais do último mês publicado.",
         "paginas": PAGINAS + PAGINAS_T, "downloads": [DOWNLOADS["preco"], DOWNLOADS["transmissao"]], "quebras": []},
    ],
    "arquivos": {DOWNLOADS[k]: "; ".join(f"{n} ({d})" if d else n for n, d in v) for k, v in COLUNAS.items()} | {
        DOWNLOADS["pontos"]: "JSON compacto para a dispersão de preço por empreendimento: colunas e linhas na ordem de 'colunas'; carregado sob demanda."},
}

REPRODUCAO = ("python3 pipeline/energia/executar_modulo.py leiloes --sem-coleta refaz a gold a partir do silver da família "
              "aneel_leiloes e dos CSV publicados pelos módulos Expansão e Empresas em public/energia/series")


# ===================================================================== coleta

def coletar(con, ctx):
    """Resultado de leilões de geração (CKAN da ANEEL) e número-índice do IPCA (SIDRA)."""
    status = {}
    if ctx.get("sem_rede"):
        return {"sem_rede": True}
    st, _, vint = ckan.coleta_pacote(
        con, orgao="ANEEL", nome=PACOTE, dataset=DS_LEILOES,
        filtro_recurso=lambda r: (r.get("name") or "").strip() in (al.RECURSO, al.RECURSO_DICIONARIO),
        max_idade_dias=7)
    v = vint.get(al.RECURSO)
    if v:
        st["registros"] = _grava_silver(con, v)
        con.commit()
    status[DS_LEILOES] = st
    res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IPCA, recurso=RECURSO_IPCA, url=ibge_pld.URL_SIDRA,
                              publicado_em=None, ext="json", max_idade_dias=3, baixador=http_download)
    out = {"status": res["status"], "detalhe": res["detalhe"]}
    if res["vintage"] and res["status"] in ("nova", "pulada", "identica"):
        with base.abre_bronze(res["vintage"]["arquivo"]) as f:
            linhas = ibge_pld.parse_ipca_sidra(f.read().decode("utf-8"))
        novas, rev = base.grava_observacoes(con, DS_IPCA, res["vintage"]["vintage_id"], linhas)
        con.commit()
        out["observacoes"] = {"novas": novas, "revisoes": rev, "meses": len(linhas)}
    status[DS_IPCA] = out
    return status


def _le_regs(vintage):
    return al.le_linhas(ckan.le_csv_bronze(vintage["arquivo"], encoding=al.ENCODING, separador=";"))


def _grava_silver(con, vintage):
    regs = _le_regs(vintage)
    campos = ("data", "leilao", "tipo", "empreendimento", "nucleo", "categoria", "mw", "gf_mwmed", "energia_mwmed",
              "preco_teto", "preco", "desagio_pct", "investimento_rs", "uf", "vencedora")
    linhas = [(f"lote:{r['chave']}", k, r[k]) for r in regs for k in campos]
    novas, revisoes = base.grava_registros(con, DS_LEILOES, vintage["vintage_id"], linhas)
    return {"linhas": len(regs), "campos_novos": novas, "revisoes": revisoes}


# ===================================================================== insumos

def _sha256_arquivo(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _insumos(ctx, raiz=None):
    """{chave: {arquivo, url, sha256, bytes, modulo, gerado_em}} ou None quando ausente."""
    pasta = raiz or base.SERIES
    golds = ctx.get("golds") or {}
    out = {}
    for k, (nome, mod) in INSUMOS.items():
        cam = os.path.join(pasta, nome)
        if not os.path.exists(cam):
            out[k] = None
            continue
        g = golds.get(f"{mod}.json") or base.le_gold(f"{mod}.json") or {}
        out[k] = {"chave": k, "arquivo": nome, "url": SERIES_URL + nome, "caminho": cam, "sha256": _sha256_arquivo(cam),
                  "bytes": os.path.getsize(cam), "modulo": mod, "gerado_em": g.get("gerado_em")}
    return out


def _le_csv(caminho):
    import csv
    with open(caminho, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _int(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


# ===================================================================== agregações

def _soma(rs, k):
    return sum(r[k] for r in rs if r.get(k) is not None)


def agrega(rs):
    """Agregado de um conjunto de linhas: contagens, energia, potência, preços ponderados
    pela energia (nominal e real), teto, deságio agregado e investimento."""
    e = _soma(rs, "energia_mwmed")
    com_p = [r for r in rs if r["preco"] is not None]
    e_p = sum(r["energia_mwmed"] for r in com_p)
    com_real = [r for r in com_p if r.get("fator_ipca") is not None]
    e_real = sum(r["energia_mwmed"] for r in com_real)
    com_teto = [r for r in com_p if r["preco_teto"] is not None]
    pe = sum(r["preco"] * r["energia_mwmed"] for r in com_teto)
    te = sum(r["preco_teto"] * r["energia_mwmed"] for r in com_teto)
    com_inv = [r for r in rs if r["investimento_rs"] is not None and r["mw"] is not None]
    inv = sum(r["investimento_rs"] for r in com_inv)
    inv_real = sum(r["investimento_rs"] * r["fator_ipca"] for r in com_inv if r.get("fator_ipca") is not None)
    mw_inv = sum(r["mw"] for r in com_inv)
    return {
        "empreendimentos": len(rs),
        "energia_mwmed": c.r(e, 1),
        "mw": c.r(_soma(rs, "mw"), 1),
        "preco_medio": c.r(sum(r["preco"] * r["energia_mwmed"] for r in com_p) / e_p, 2) if e_p else None,
        "preco_medio_real": c.r(sum(r["preco"] * r["fator_ipca"] * r["energia_mwmed"] for r in com_real) / e_real, 2) if e_real else None,
        "teto_medio": c.r(te / sum(r["energia_mwmed"] for r in com_teto), 2) if com_teto else None,
        "desagio_agregado_pct": c.r(100 * (1 - pe / te), 2) if te else None,
        "sem_preco": len(rs) - len(com_p),
        "investimento_rs_mi": c.r(inv / 1e6, 1) if com_inv else None,
        "investimento_real_rs_mi": c.r(inv_real / 1e6, 1) if com_inv else None,
        "investimento_rs_mi_por_mw": c.r(inv / 1e6 / mw_inv, 3) if mw_inv else None,
        "investimento_real_rs_mi_por_mw": c.r(inv_real / 1e6 / mw_inv, 3) if mw_inv else None,
        "com_investimento": len(com_inv),
    }


def _quartis(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return {"n": 0, "p25": None, "mediana": None, "p75": None, "min": None, "max": None}
    return {"n": len(xs), "p25": c.r(c.quantil(xs, 0.25), 2), "mediana": c.r(c.quantil(xs, 0.5), 2),
            "p75": c.r(c.quantil(xs, 0.75), 2), "min": c.r(min(xs), 2), "max": c.r(max(xs), 2)}


def _ordem_cat(k):
    ids = [x[0] for x in al.CATEGORIAS]
    return ids.index(k) if k in ids else 99


def _ordem_tipo(k):
    ids = [x[0] for x in al.TIPOS]
    return ids.index(k) if k in ids else 99


def cruza(regs, siga, encerr, ralie, controle, nos, nomes_grupo, indice_ipca, mes_ipca):
    """Acrescenta a cada linha: fator do IPCA, situação atual, entrada em operação, controle
    atual (grupo e cadeia). Devolve as linhas enriquecidas (cópias)."""
    rep = {(x["leilao"], x["nucleo"]) for x in al.repetidos_no_leilao(regs)}
    fases = {k: v["fase"] for k, v in siga.items()}
    out = []
    for r0 in regs:
        r = dict(r0)
        r["mes"] = r["data"][:7]
        r["fator_ipca"] = al.fator_ipca(indice_ipca, r["mes"], mes_ipca)
        r["preco_real"] = r["preco"] * r["fator_ipca"] if (r["preco"] is not None and r["fator_ipca"] is not None) else None
        r["ano_a"] = int(r["ano"]) + r["antecedencia"] if r["antecedencia"] is not None and r["ano"].isdigit() else None
        s = siga.get(r["nucleo"]) if r["nucleo"] is not None else None
        r["fase_siga"] = s["fase"] if s else None
        r["entrada_operacao"] = s["entrada"] if s else None
        r["situacao"] = al.situacao(r["nucleo"], fases, encerr)
        r["ato_encerramento"] = r["nucleo"] in encerr if r["nucleo"] is not None else False
        r["entrada_vs_ano_a"] = (al.entrada_vs_produto(r["data"], r["ano_a"], r["entrada_operacao"])
                                 if r["situacao"] == "operacao" else None)
        r["situacao_obra"] = (ralie.get(r["nucleo"]) or {}).get("situacao_obra") if r["nucleo"] is not None else None
        r["ceg_repetido"] = (r["leilao"], r["nucleo"]) in rep
        ctl = controle.get(r["nucleo"]) if r["nucleo"] is not None else None
        if r["nucleo"] is None:
            r["controle"] = "sem_ceg"
        elif ctl is None:
            r["controle"] = "fora_do_cadastro"
        else:
            r["controle"] = ctl["estado"]
        if ctl and ctl["estado"] == "controlada":
            r["proprietario_cnpj"] = ctl["proprietario_cnpj"]
            r["grupo_cnpj"] = ctl["grupo_cnpj"]
            r["grupo_nome"] = nomes_grupo.get(ctl["grupo_cnpj"]) or (nos.get(ctl["grupo_cnpj"]) or [None])[0]
            cad = al.cadeia_de_controle(ctl["proprietario_cnpj"], nos)
            if ctl["grupo_cnpj"] not in cad:
                cad.append(ctl["grupo_cnpj"])
            r["cadeia"] = cad
        else:
            r["proprietario_cnpj"] = r["grupo_cnpj"] = r["grupo_nome"] = None
            r["cadeia"] = []
        out.append(r)
    return out


ROTULO_CONTROLE = {
    "sem_ceg": "Linha sem código da usina (CEG)",
    "fora_do_cadastro": "Usina fora do cadastro aberto do SIGA",
    "sem_majoritario": "Usina sem proprietário com mais de 50%",
    "sem_proprietario": "Usina sem proprietário com CNPJ no SIGA",
}


def _bloco_grupos(rs, limite=25):
    por = defaultdict(list)
    for r in rs:
        if r["controle"] == "controlada":
            por[r["grupo_cnpj"]].append(r)
    grupos = []
    for g, xs in por.items():
        cad = []
        for x in xs:
            for k in x["cadeia"]:
                if k not in cad:
                    cad.append(k)
        grupos.append({"cnpj": g, "nome": xs[0]["grupo_nome"], "empreendimentos": len(xs),
                       "usinas": len({x["nucleo"] for x in xs}), "energia_mwmed": c.r(_soma(xs, "energia_mwmed"), 1),
                       "leiloes": len({x["leilao"] for x in xs}),
                       "categorias": sorted({x["categoria"] for x in xs if x["categoria"]}, key=_ordem_cat),
                       "cadeia_cnpjs": cad})
    grupos.sort(key=lambda x: (-(x["energia_mwmed"] or 0), x["cnpj"]))
    sem = []
    for k in ("fora_do_cadastro", "sem_majoritario", "sem_proprietario", "sem_ceg"):
        xs = [r for r in rs if r["controle"] == k]
        sem.append({"id": k, "rotulo": ROTULO_CONTROLE[k], "empreendimentos": len(xs),
                    "energia_mwmed": c.r(_soma(xs, "energia_mwmed"), 1)})
    demais = grupos[limite:]
    return {
        "regra": ("Grupo que controla a usina hoje: proprietário com mais de 50% da usina no SIGA (vínculo pelo CNPJ publicado no "
                  "mesmo registro) e o topo da sua cadeia de controladores únicos declarada à ANEEL (Composição Societária), como no "
                  "módulo Empresas. Não é a vencedora na data do leilão: a usina pode ter mudado de dono, e a vencedora publicada pode "
                  "ser um cotista do consórcio."),
        "grupos_total": len(grupos),
        "energia_vinculada_mwmed": c.r(sum(g["energia_mwmed"] for g in grupos), 1),
        "maiores": grupos[:limite],
        "demais": {"grupos": len(demais), "empreendimentos": sum(g["empreendimentos"] for g in demais),
                   "energia_mwmed": c.r(sum(g["energia_mwmed"] for g in demais), 1)},
        "sem_vinculo": sem,
        "todos": grupos,
    }


def _bloco_vencedoras(rs, limite=20):
    por = defaultdict(list)
    for r in rs:
        por[r["vencedora"] or ""].append(r)
    lista = [{"nome": k or None, "empreendimentos": len(xs), "energia_mwmed": c.r(_soma(xs, "energia_mwmed"), 1),
              "leiloes": len({x["leilao"] for x in xs}),
              "categorias": sorted({x["categoria"] for x in xs if x["categoria"]}, key=_ordem_cat)}
             for k, xs in por.items()]
    lista.sort(key=lambda x: (-(x["energia_mwmed"] or 0), x["nome"] or ""))
    return {"nomes_distintos": len(lista), "maiores": lista[:limite],
            "regra": ("Nome como publicado em DscEmpresaVencedora, que o dicionário descreve como a empresa vencedora ou o nome do "
                      "cotista do consórcio. O arquivo não traz CNPJ: grafias diferentes da mesma empresa ficam separadas e nenhum "
                      "nome é fundido por semelhança.")}


def _transmissao(linhas, indice_ipca, mes_ipca):
    """Lotes de transmissão (CSV do módulo Expansão) com RAP e investimento corrigidos pelo IPCA."""
    lotes = []
    for x in linhas:
        if (x.get("contratado") or "") != "sim":
            continue
        data = x.get("data") or ""
        f = al.fator_ipca(indice_ipca, data[:7], mes_ipca)
        rv, re_, inv = _num(x.get("rap_vencedor_rs")), _num(x.get("rap_edital_rs")), _num(x.get("investimento_rs"))
        des = c.r(100 * (1 - rv / re_), 2) if (rv is not None and re_) else None
        lotes.append({"ano": x.get("ano"), "data": data, "leilao": x.get("leilao"), "lote": x.get("lote"), "f": f,
                      "rv": rv, "re": re_, "inv": inv if inv else None, "des": des, "vencedor": (x.get("vencedor") or "").strip() or None,
                      "km": _num(x.get("km")), "uf": x.get("uf") or None})
    por_ano = []
    for ano in sorted({l["ano"] for l in lotes}):
        ls = [l for l in lotes if l["ano"] == ano]
        com = [l for l in ls if l["rv"] is not None and l["re"]]
        rv = sum(l["rv"] for l in com)
        re_ = sum(l["re"] for l in com)
        rvr = sum(l["rv"] * l["f"] for l in com if l["f"] is not None)
        inv = [l for l in ls if l["inv"]]
        q = _quartis([l["des"] for l in com])
        por_ano.append({
            "ano": ano, "lotes_contratados": len(ls), "rap_vencedora_rs_mi": c.r(rv / 1e6, 1),
            "rap_vencedora_real_rs_mi": c.r(rvr / 1e6, 1) if all(l["f"] is not None for l in com) else None,
            "rap_edital_rs_mi": c.r(re_ / 1e6, 1),
            "investimento_rs_mi": c.r(sum(l["inv"] for l in inv) / 1e6, 1) if inv else None,
            "investimento_real_rs_mi": c.r(sum(l["inv"] * l["f"] for l in inv if l["f"] is not None) / 1e6, 1) if inv else None,
            "desagio_agregado_pct": c.r(100 * (1 - rv / re_), 2) if re_ else None,
            "desagio_mediano_lote_pct": q["mediana"], "desagio_p25_pct": q["p25"], "desagio_p75_pct": q["p75"],
        })
    venc = defaultdict(list)
    for l in lotes:
        venc[l["vencedor"] or ""].append(l)
    vencedores = sorted(({"nome": k or None, "lotes": len(v),
                          "rap_vencedora_real_rs_mi": c.r(sum(l["rv"] * l["f"] for l in v if l["rv"] is not None and l["f"] is not None) / 1e6, 1)}
                         for k, v in venc.items()), key=lambda x: (-x["lotes"], -(x["rap_vencedora_real_rs_mi"] or 0), x["nome"] or ""))
    des = [l["des"] for l in lotes if l["des"] is not None]
    return {
        "lotes_contratados": len(lotes),
        "lotes_com_rap": sum(1 for l in lotes if l["rv"] is not None and l["re"]),
        "periodo": {"inicio": min((l["data"] for l in lotes), default=None), "fim": max((l["data"] for l in lotes), default=None)},
        "por_ano": por_ano,
        "desagio_lotes": _quartis(des),
        "desagios": [l["des"] for l in sorted(lotes, key=lambda l: (l["data"], l["leilao"] or "", _int(l["lote"]) or 0)) if l["des"] is not None],
        "lotes_desagio_zero": sum(1 for d in des if d == 0),
        "vencedores": vencedores[:15],
        "vencedores_distintos": len(vencedores),
        "regra_desagio": ("Deságio de cada lote = 100 × (1 − RAP vencedora ÷ RAP do edital), recalculado das RAPs publicadas; "
                          "o agregado do ano pondera pela RAP do edital. Lotes sem vencedor não entram."),
        "regra_real": "RAP e investimento de cada lote × I(último mês) ÷ I(mês do leilão), número-índice do IPCA (IBGE).",
    }


# ===================================================================== construção

def _proveniencia(con, ds, fonte, **kw):
    snap = c.snapshot_de(con, ds)
    f = {**fonte, "url_primaria": fonte.get("url_primaria") or fonte["url_dataset"]}
    return c.proveniencia(fonte=f, snapshot=snap, capturado_em=c.ultima_captura(snap), **kw)


def _snap_insumos(ins, chaves):
    itens = [ins[k] for k in chaves if ins.get(k)]
    h = hashlib.sha256("".join(x["sha256"] for x in itens).encode()).hexdigest()
    datas = sorted(x["gerado_em"] for x in itens if x.get("gerado_em"))
    return {"id": f"leiloes_insumos@{datas[-1] if datas else 'sem_data'}", "sha256": h, "capturas": [],
            "publicacao_confiavel": False}


def construir(con, ctx):
    v = base.ultima_vintage(con, DS_LEILOES, al.RECURSO)
    if not v:
        return c.stub(GOLD, "resultado dos leilões de geração ausente no silver da família aneel_leiloes")
    regs = _le_regs(v)
    criticos, ressalvas = al.validar(regs)
    if criticos:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticos))
    ipca = dict(base.serie_vigente(con, DS_IPCA, "ipca.indice"))
    if not ipca:
        return c.stub(GOLD, "número-índice do IPCA ausente no silver")
    mes_ipca = max(ipca)
    ins = _insumos(ctx)
    faltam = [k for k in ("siga", "encerramentos", "transmissao") if not ins.get(k)]
    if faltam:
        return c.stub(GOLD, f"insumo do módulo Expansão ausente: {', '.join(faltam)}")
    siga = {}
    for x in _le_csv(ins["siga"]["caminho"]):
        n = _int(x.get("nucleo_ceg"))
        if n is not None:
            siga[n] = {"fase": x.get("fase"), "entrada": x.get("entrada_operacao") or None}
    encerr = {_int(x.get("nucleo_ceg")) for x in _le_csv(ins["encerramentos"]["caminho"]) if _int(x.get("nucleo_ceg")) is not None}
    ralie = {}
    if ins.get("ralie"):
        for x in _le_csv(ins["ralie"]["caminho"]):
            n = _int(x.get("nucleo_ceg"))
            if n is not None:
                ralie[n] = {"situacao_obra": x.get("situacao_obra") or None, "data_base": x.get("data_base_ralie")}
    controle, nos, nomes_grupo = {}, {}, {}
    if ins.get("ativos") and ins.get("cadeia"):
        controle = al.controle_atual(_le_csv(ins["ativos"]["caminho"]))
        with open(ins["cadeia"]["caminho"], encoding="utf-8") as f:
            nos = json.load(f).get("nos") or {}
        if ins.get("grupos"):
            nomes_grupo = {x["grupo_cnpj"]: x.get("nome") or None for x in _le_csv(ins["grupos"]["caminho"])}
    else:
        ressalvas.append("Insumos do módulo Empresas ausentes: o grupo controlador atual não é publicado nesta atualização.")

    rs = cruza(regs, siga, encerr, ralie, controle, nos, nomes_grupo, ipca, mes_ipca)
    sem_fator = [r for r in rs if r["fator_ipca"] is None]
    if sem_fator:
        ressalvas.append(f"{len(sem_fator)} linhas sem IPCA para o mês do leilão: ficam fora dos preços reais.")
    exp = (ctx.get("golds") or {}).get("expansao.json") or base.le_gold("expansao.json") or {}
    ref_exp = exp.get("referencias") or {}

    g = c.cabecalho(GOLD)
    g["referencias"] = {
        "arquivo_gerado_em": next((r["data_geracao"] for r in rs if r["data_geracao"]), None),
        "publicado_pela_fonte_em": (v.get("publicado_em") or "")[:10] or None,
        "capturado_em": v.get("capturado_em"),
        "primeiro_leilao": min(r["data"] for r in rs), "ultimo_leilao": max(r["data"] for r in rs),
        "ipca_ate": mes_ipca, "ipca_desde": min(ipca),
        "siga": ref_exp.get("siga"), "atos": ref_exp.get("atos"), "ralie": ref_exp.get("ralie"),
        "encerramentos_desde": "2015",
        "leiloes_transmissao_ate": ref_exp.get("leiloes_transmissao"),
    }
    g["regras"] = {
        "energia": "Energia vendida (VlrEnergiaVendida) em MWmédio: cada linha é um contrato, então a soma entre leilões é válida. "
                   "A potência (MW) de uma usina vendida em mais de um leilão se repete em cada um e não é somada entre leilões.",
        "preco": "Preço de venda por empreendimento (VlrPrecoLeilao), em R$/MWh nominais da data do leilão; nas termelétricas "
                 "contratadas por disponibilidade, o campo traz o Índice de Custo Benefício (ICB), como diz o dicionário. "
                 "Média ponderada pela energia vendida das linhas com preço.",
        "preco_real": f"Preço real = preço × I({c.mes_br(mes_ipca)}) ÷ I(mês do leilão), com o número-índice do IPCA do IBGE "
                      "(tabela 1737). É uma régua de comparação entre anos, não o preço vigente de cada contrato, que segue o "
                      "reajuste próprio do edital e do contrato.",
        "desagio": "Deságio por empreendimento como publicado (VlrDesagio, %), conferido contra 100 × (1 − preço ÷ teto). "
                   "Agregado = 100 × (1 − Σ preço × energia ÷ Σ teto × energia).",
        "zeros": "Zero que é campo não preenchido vira ausência: preço 0 (1 linha, com deságio 100%), garantia física 0 com energia "
                 "vendida (2 linhas) e investimento 0 (ampliações e usinas existentes, em geral).",
        "situacao": "Situação atual pelo núcleo do CEG: a fase no SIGA prevalece; fora do SIGA, o ato de revogação ou extinção "
                    "publicado desde 2015 classifica como outorga encerrada; o resto fica sem situação identificada. Não é "
                    "cumprimento de contrato: prazos alterados por ato, rescisões, substituições e descontratações não estão nos arquivos.",
        "ano_a": "Nos produtos A-x, o ano A (início do suprimento) é o ano do leilão mais x. A entrada em operação comparada é a "
                 "data do SIGA para a usina inteira; ampliação ou usina que já operava antes do leilão fica numa classe própria.",
        "categoria": "Categoria de fonte = DscFonteEnergia, com a hídrica separada em UHE e em PCH ou CGH pelo tipo de geração.",
    }
    tipos_presentes = sorted({r["tipo"] for r in rs}, key=_ordem_tipo)
    anos = sorted({int(r["ano"]) for r in rs if r["ano"].isdigit()})
    lacunas_numeracao = {}
    for sigla in ("LEN", "LER", "LFA"):
        ns = sorted({_int("".join(ch for ch in r["ccee"].split(" ")[0] if ch.isdigit())) for r in rs if sigla in r["ccee"]} - {None})
        if ns:
            lacunas_numeracao[sigla] = [n for n in range(1, ns[-1] + 1) if n not in ns]
    g["cobertura"] = {
        "linhas": len(rs), "leiloes": len({r["leilao"] for r in rs}),
        "usinas_distintas": len({r["nucleo"] for r in rs if r["nucleo"] is not None}),
        "linhas_sem_ceg": sum(1 for r in rs if r["nucleo"] is None),
        "tipos_presentes": [{"id": t, "rotulo": al.NOME_TIPO.get(t, t)} for t in tipos_presentes],
        "anos": [anos[0], anos[-1]] if anos else None,
        "anos_sem_leilao_na_base": [a for a in range(anos[0], anos[-1] + 1) if a not in anos] if anos else [],
        "lacunas_numeracao_ccee": lacunas_numeracao,
        "descricao_fonte": ("O dicionário da ANEEL (versão 1.0, 30/03/2023) descreve o conjunto como os resultados dos leilões de energia "
                            "do Ambiente de Contratação Regulada realizados desde 2005, com o tipo de leilão entre energia nova (A-3 a "
                            "A-7), energia de reserva, estruturante e fontes alternativas."),
        "ausentes": ("Não estão no arquivo os leilões de energia existente e de ajuste, os de reserva de capacidade, os de sistemas "
                     "isolados e os procedimentos competitivos simplificados. Ausência na base não prova que não houve leilão."),
    }
    g["categorias"] = [{"id": k, "rotulo": n} for k, n in al.CATEGORIAS]
    g["tipos"] = [{"id": k, "rotulo": n, "antecedencia": al.antecedencia(k)} for k, n in al.TIPOS if k in tipos_presentes]
    g["situacoes"] = [{"id": k, "rotulo": n, "definicao": d} for k, n, d in al.SITUACOES]
    g["totais"] = {**agrega(rs), "usinas_distintas": g["cobertura"]["usinas_distintas"]}

    # por leilão
    leiloes = []
    for lei in sorted({r["leilao"] for r in rs}, key=lambda k: (min(r["data"] for r in rs if r["leilao"] == k), k)):
        xs = [r for r in rs if r["leilao"] == lei]
        x0 = xs[0]
        sit = {s: c.r(_soma([r for r in xs if r["situacao"] == s], "energia_mwmed"), 1) for s, _, _ in al.SITUACOES}
        leiloes.append({"leilao": lei, "data": x0["data"], "ano": x0["ano"], "nome": x0["nome_leilao"], "tipo": x0["tipo"],
                        "ano_a": x0["ano_a"], **agrega(xs),
                        "por_categoria": {k: c.r(_soma([r for r in xs if r["categoria"] == k], "energia_mwmed"), 1)
                                          for k in sorted({r["categoria"] for r in xs if r["categoria"]}, key=_ordem_cat)},
                        "situacao_mwmed": sit})
        if len({r["data"] for r in xs}) > 1 or len({r["tipo"] for r in xs}) > 1:
            ressalvas.append(f"Leilão {lei} com mais de uma data ou tipo no arquivo.")
    g["leiloes"] = leiloes

    # por ano
    por_ano = []
    for a in anos:
        xs = [r for r in rs if r["ano"] == str(a)]
        por_ano.append({"ano": str(a), "leiloes": len({r["leilao"] for r in xs}), **agrega(xs),
                        "por_categoria": {k: c.r(_soma([r for r in xs if r["categoria"] == k], "energia_mwmed"), 1) for k, _ in al.CATEGORIAS},
                        "por_tipo": {t: c.r(_soma([r for r in xs if r["tipo"] == t], "energia_mwmed"), 1) for t in tipos_presentes}})
    g["por_ano"] = por_ano

    # por categoria (todo o período) e preço por ano × categoria
    por_cat = []
    preco_ano = []
    for k, nome in al.CATEGORIAS:
        xs = [r for r in rs if r["categoria"] == k]
        if not xs:
            continue
        ds = [r["data"] for r in xs]
        com_p = sorted((r for r in xs if r["preco"] is not None), key=lambda r: r["data"])
        primeiro = [r for r in com_p if r["ano"] == com_p[0]["ano"]] if com_p else []
        ultimo = [r for r in com_p if r["ano"] == com_p[-1]["ano"]] if com_p else []
        por_cat.append({"id": k, "rotulo": nome, **agrega(xs), "leiloes": len({r["leilao"] for r in xs}),
                        "primeiro": min(ds), "ultimo": max(ds),
                        "primeiro_ano": {"ano": primeiro[0]["ano"], **agrega(primeiro)} if primeiro else None,
                        "ultimo_ano": {"ano": ultimo[0]["ano"], **agrega(ultimo)} if ultimo else None,
                        "desagio": _quartis([r["desagio_pct"] for r in xs]),
                        "preco_real_quartis": _quartis([r["preco_real"] for r in xs])})
        for a in sorted({r["ano"] for r in xs}):
            ys = [r for r in xs if r["ano"] == a]
            ag = agrega(ys)
            preco_ano.append({"ano": a, "categoria": k, "leiloes": len({r["leilao"] for r in ys}), **ag})
    g["por_categoria"] = por_cat
    g["preco_ano_categoria"] = preco_ano

    # por tipo de leilão
    g["por_tipo"] = [{"id": t, "rotulo": al.NOME_TIPO.get(t, t), "leiloes": len({r["leilao"] for r in rs if r["tipo"] == t}),
                      **agrega([r for r in rs if r["tipo"] == t])} for t in tipos_presentes]

    # deságio: distribuição por empreendimento
    g["desagio"] = {
        "geral": _quartis([r["desagio_pct"] for r in rs]),
        "zero": sum(1 for r in rs if r["desagio_pct"] == 0),
        "confere": sum(1 for r in rs if al.desagio_confere(r) is True),
        "nao_confere": [{"linha": r["linha"], "leilao": r["leilao"], "empreendimento": r["empreendimento"]}
                        for r in rs if al.desagio_confere(r) is False],
        "valores": [c.r(r["desagio_pct"], 2) for r in rs if r["desagio_pct"] is not None],
        "categorias": [_ordem_cat(r["categoria"]) for r in rs if r["desagio_pct"] is not None],
        "por_ano": [{"ano": str(a), **_quartis([r["desagio_pct"] for r in rs if r["ano"] == str(a)]),
                     "agregado_pct": agrega([r for r in rs if r["ano"] == str(a)])["desagio_agregado_pct"]} for a in anos],
    }

    # UF
    ufs = []
    for uf in sorted({r["uf"] for r in rs if r["uf"]}):
        xs = [r for r in rs if r["uf"] == uf]
        ufs.append({"uf": uf, **agrega(xs), "usinas": len({r["nucleo"] for r in xs if r["nucleo"] is not None}),
                    "por_categoria": {k: c.r(_soma([r for r in xs if r["categoria"] == k], "energia_mwmed"), 1)
                                      for k in sorted({r["categoria"] for r in xs if r["categoria"]}, key=_ordem_cat)}})
    g["por_uf"] = ufs

    # o que foi entregue
    def sit_de(xs):
        return {s: {"empreendimentos": sum(1 for r in xs if r["situacao"] == s),
                    "energia_mwmed": c.r(_soma([r for r in xs if r["situacao"] == s], "energia_mwmed"), 1),
                    "mw": c.r(_soma([r for r in xs if r["situacao"] == s], "mw"), 1)} for s, _, _ in al.SITUACOES}
    entrada = {}
    for t in tipos_presentes:
        if al.antecedencia(t) is None:
            continue
        xs = [r for r in rs if r["tipo"] == t and r["situacao"] == "operacao"]
        entrada[t] = {k: {"empreendimentos": sum(1 for r in xs if r["entrada_vs_ano_a"] == k),
                          "energia_mwmed": c.r(_soma([r for r in xs if r["entrada_vs_ano_a"] == k], "energia_mwmed"), 1)}
                      for k in ("antes_do_leilao", "ate_ano_a", "depois_ano_a", "sem_data")}
    g["entrega"] = {
        "total": sit_de(rs),
        "por_categoria": [{"id": k, **{"situacao": sit_de([r for r in rs if r["categoria"] == k])}} for k, _ in al.CATEGORIAS
                          if any(r["categoria"] == k for r in rs)],
        "por_tipo": [{"id": t, "situacao": sit_de([r for r in rs if r["tipo"] == t])} for t in tipos_presentes],
        "por_ano": [{"ano": str(a), "situacao": sit_de([r for r in rs if r["ano"] == str(a)])} for a in anos],
        "entrada_vs_ano_a": entrada,
        "operacao_com_ato_encerramento": sum(1 for r in rs if r["situacao"] == "operacao" and r["ato_encerramento"]),
        "ceg_repetido": al.repetidos_no_leilao(regs),
        "ralie_situacao_obra": {k: sum(1 for r in rs if r["situacao"] in ("construcao", "nao_iniciada") and r["situacao_obra"] == k)
                                for k in sorted({r["situacao_obra"] for r in rs if r["situacao"] in ("construcao", "nao_iniciada") and r["situacao_obra"]})},
        "nao_operando_fora_do_ralie": sum(1 for r in rs if r["situacao"] in ("construcao", "nao_iniciada") and not r["situacao_obra"]),
    }

    g["vencedoras"] = _bloco_vencedoras(rs)
    grupos = _bloco_grupos(rs) if controle else None
    if grupos:
        g["grupos_controle"] = {k: v for k, v in grupos.items() if k != "todos"}
    else:
        g["grupos_controle"] = None

    # transmissão em reais de hoje
    g["transmissao"] = _transmissao(_le_csv(ins["transmissao"]["caminho"]), ipca, mes_ipca)

    # últimos dados citáveis
    ult = leiloes[-1]
    g["ultimo_leilao"] = ult
    g["insumos"] = [{k2: x[k2] for k2 in ("chave", "arquivo", "url", "sha256", "bytes", "modulo", "gerado_em")}
                    for x in ins.values() if x]
    g["conferencias"] = {
        "estruturantes_mwmed": [{"empreendimento": r["empreendimento"], "leilao": r["leilao"], "energia_mwmed": r["energia_mwmed"],
                                 "garantia_fisica_mwmed": r["gf_mwmed"]} for r in rs if r["tipo"] == "Estruturante"],
        "desagio_publicado_confere": f"{g['desagio']['confere']} de {sum(1 for r in rs if al.desagio_confere(r) is not None)} linhas com preço e teto",
        "energia_acima_da_garantia_fisica": [{"linha": r["linha"], "leilao": r["leilao"], "empreendimento": r["empreendimento"],
                                              "energia_mwmed": r["energia_mwmed"], "garantia_fisica_mwmed": r["gf_mwmed"]}
                                             for r in rs if r["gf_mwmed"] is not None and r["energia_mwmed"] > r["gf_mwmed"] + 0.01],
        "zeros_tratados": {"preco": sum(1 for r in rs if r["preco_zero_na_fonte"]),
                           "garantia_fisica": sum(1 for r in rs if r["gf_mwmed"] is None),
                           "investimento": sum(1 for r in rs if r["investimento_rs"] is None)},
    }
    g["ressalvas"] = ressalvas
    g["downloads"] = [
        {"rotulo": "Empreendimentos contratados, com situação atual e grupo de controle (CSV)", "url": DOWNLOADS["empreendimentos"]},
        {"rotulo": "Resumo por leilão (CSV)", "url": DOWNLOADS["leiloes"]},
        {"rotulo": "Preço médio por fonte e ano, nominal e real (CSV)", "url": DOWNLOADS["preco"]},
        {"rotulo": "Energia contratada por grupo que controla a usina hoje (CSV)", "url": DOWNLOADS["grupos"]},
        {"rotulo": "Leilões de transmissão por ano em reais de hoje (CSV)", "url": DOWNLOADS["transmissao"]},
    ]
    g["proveniencia"] = _proveniencias(con, g, ins)
    g["evidencias"] = _evidencias(g, rs, v, ins)
    _escreve_arquivos(rs, g, grupos)
    return g


def _proveniencias(con, g, ins):
    ref = g["referencias"]
    per = {"inicio": ref["primeiro_leilao"], "fim": ref["ultimo_leilao"]}
    lim_base = [
        g["cobertura"]["ausentes"],
        "A vencedora publicada é texto, sem CNPJ, e pode ser o cotista do consórcio; grafias diferentes da mesma empresa ficam separadas.",
        "Zeros de preço, garantia física e investimento que indicam campo não preenchido viram ausência.",
        "MW de uma usina vendida em mais de um leilão se repete em cada linha; somas de potência só por leilão.",
    ]
    snap_exp = _snap_insumos(ins, ("siga", "encerramentos", "ralie"))
    snap_emp = _snap_insumos(ins, ("ativos", "cadeia", "grupos"))
    snap_t = _snap_insumos(ins, ("transmissao",))
    return {
        "resultado": _proveniencia(con, DS_LEILOES, FONTE_LEILOES, indicador="Energia contratada, preço e deságio nos leilões de geração do ACR",
                                   natureza="CALCULADO", unidade="MWmédio, MW, R$/MWh nominais e %", frequencia="mensal segundo o dicionário",
                                   periodo=per, cobertura=per,
                                   transformacoes=["leitura do CSV em Windows-1252, vírgula decimal", "zeros-marcadores viram ausência",
                                                   "categoria de fonte com a hídrica separada em UHE e PCH ou CGH",
                                                   "soma da energia vendida e médias de preço ponderadas pela energia"],
                                   formula="preço médio = Σ preço × energia ÷ Σ energia; deságio agregado = 100 × (1 − Σ preço × energia ÷ Σ teto × energia)",
                                   limitacoes=lim_base, download=DOWNLOADS["empreendimentos"]),
        "preco_real": _proveniencia(con, DS_IPCA, FONTE_IPCA, indicador="Preço dos leilões em reais do último mês do IPCA",
                                    natureza="CALCULADO", unidade=f"R$/MWh de {c.mes_br(ref['ipca_ate'])}", frequencia="mensal",
                                    periodo=per, cobertura={"inicio": ref["ipca_desde"], "fim": ref["ipca_ate"]},
                                    transformacoes=["fator = I(último mês) ÷ I(mês do leilão), número-índice do IPCA"],
                                    formula="preço real = preço × I(último mês) ÷ I(mês do leilão)",
                                    limitacoes=["Régua de comparação entre anos: não é o preço vigente de cada contrato, que segue o reajuste do seu edital e contrato.",
                                                "O IPCA mede preços ao consumidor; custos de equipamentos e de capital variam de outra forma."],
                                    download=DOWNLOADS["preco"]),
        "situacao": c.proveniencia(
            indicador="Situação atual dos empreendimentos contratados", natureza="CALCULADO", unidade="MWmédio e empreendimentos",
            fonte={"orgao": "ANEEL", "dataset": "SIGA e atos de outorgas de geração, como publicados pelo módulo Expansão",
                   "recurso": "expansao_usinas_siga.csv, expansao_encerramentos_outorga.csv, expansao_carteira_ralie.csv",
                   "url_dataset": "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel",
                   "url_primaria": "/setor-eletrico/expansao/carteira", "licenca": LICENCA_ANEEL},
            frequencia="semanal (SIGA) e mensal (atos)", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
            cobertura={"inicio": per["inicio"], "fim": ref["siga"]}, capturado_em=ref["capturado_em"], snapshot=snap_exp,
            publicacao_informada=False, revisoes=None,
            transformacoes=["junção pelo núcleo do CEG", "fase do SIGA prevalece; fora dele, ato de encerramento desde 2015"],
            formula="situação = fase do SIGA; senão outorga encerrada se há ato; senão sem situação identificada",
            limitacoes=["Não é cumprimento de contrato: alterações de cronograma, rescisões e substituições não estão nos arquivos.",
                        "Atos de encerramento só desde 2015: usina revogada antes fica sem situação identificada.",
                        "Em 4 pares leilão × núcleo a fonte repete o CEG em empreendimentos diferentes; a situação vem da usina do CEG.",
                        "A entrada em operação do SIGA é da usina inteira, não da parcela vendida no leilão."],
            download=DOWNLOADS["empreendimentos"]),
        "controle": c.proveniencia(
            indicador="Grupo que controla hoje as usinas contratadas", natureza="CALCULADO", unidade="MWmédio e empreendimentos",
            fonte={"orgao": "ANEEL", "dataset": "SIGA (proprietários) e Composição Societária, como publicados pelo módulo Empresas",
                   "recurso": "empresas_ativos.csv, empresas_cadeia.json, empresas_grupos.csv",
                   "url_dataset": "https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero",
                   "url_primaria": "/setor-eletrico/empresas/controle", "licenca": LICENCA_ANEEL},
            frequencia="trimestral (Composição Societária)", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
            cobertura={"inicio": ref["siga"], "fim": ref["siga"]}, capturado_em=ref["capturado_em"], snapshot=snap_emp,
            publicacao_informada=False, revisoes=None,
            transformacoes=["proprietário com mais de 50% da usina no SIGA", "topo da cadeia de controladores únicos"],
            formula="grupo(usina) = topo da cadeia do proprietário com controle majoritário",
            limitacoes=["O grupo de hoje não é a vencedora na data do leilão.",
                        "Usina sem proprietário com mais de 50% fica sem grupo; nenhuma participação minoritária é somada a um grupo."],
            download=DOWNLOADS["grupos"]),
        "transmissao": c.proveniencia(
            indicador="Leilões de transmissão em reais de hoje", natureza="CALCULADO", unidade=f"R$ milhões de {c.mes_br(ref['ipca_ate'])} e %",
            fonte={"orgao": "ANEEL", "dataset": "Resultado de leilões de transmissão, como publicado pelo módulo Expansão",
                   "recurso": "expansao_leiloes_transmissao.csv", "url_dataset": URL_LEILOES,
                   "url_primaria": "/setor-eletrico/expansao/geracao-e-transmissao", "licenca": LICENCA_ANEEL},
            frequencia="mensal segundo o dicionário",
            periodo=g["transmissao"]["periodo"], cobertura=g["transmissao"]["periodo"], capturado_em=ref["capturado_em"],
            snapshot=snap_t, publicacao_informada=False, revisoes=None,
            transformacoes=["lotes contratados", "RAP e investimento × fator do IPCA", "deságio recalculado das RAPs por lote"],
            formula="deságio(lote) = 100 × (1 − RAP vencedora ÷ RAP do edital)",
            limitacoes=[f"O arquivo de leilões de transmissão termina em {c.data_br(ref['leiloes_transmissao_ate'])}." if ref.get("leiloes_transmissao_ate") else "Data do último leilão de transmissão não informada.",
                        "RAP do leilão é a receita anual do lote na data do leilão; a RAP vigente é reajustada e revista pela ANEEL.",
                        "Investimento é o previsto no edital, não o realizado."],
            download=DOWNLOADS["transmissao"]),
    }


def _evidencias(g, rs, v, ins):
    fonte = ev.fonte_de_vintage("ANEEL", FONTE_LEILOES["dataset"], URL_LEILOES, v)
    t = g["totais"]
    rev = g["proveniencia"]["resultado"]["revisoes_conhecidas"]
    per = {"inicio": g["referencias"]["primeiro_leilao"], "fim": g["referencias"]["ultimo_leilao"]}
    testes_base = [ev.teste("unidade da energia", "aprovado",
                            "Belo Monte 3.199, Jirau 1.382 e Santo Antônio 1.552 MWmédio vendidos ao ACR, iguais aos resultados dos leilões estruturantes"),
                   ev.teste("deságio publicado", "aprovado" if not g["desagio"]["nao_confere"] else "ressalva",
                            f"{g['conferencias']['desagio_publicado_confere']} conferem com 100 × (1 − preço ÷ teto)")]
    out = {}
    out["energia_total"] = ev.construir(
        indicador="Energia contratada nos leilões de geração do ACR", valor_exibido=f"{c.r(t['energia_mwmed'], 0):,.0f} MWmédio".replace(",", "."),
        valor_calculo=t["energia_mwmed"], unidade="MWmédio", periodo=per,
        entidade="empreendimentos vencedores dos leilões de geração na base aberta da ANEEL",
        universo=f"{t['empreendimentos']} linhas de {g['cobertura']['leiloes']} leilões", fonte=fonte,
        chaves_origem=[r["chave"] for r in rs], manifesto={"rotulo": "Empreendimentos (CSV)", "url": DOWNLOADS["empreendimentos"]},
        formula="Σ VlrEnergiaVendida de todas as linhas", cobertura=g["cobertura"]["ausentes"], revisoes=rev,
        tratamento_ausencia="nenhuma linha sem energia vendida (validado)",
        testes=testes_base, download=[{"rotulo": "Empreendimentos (CSV)", "url": DOWNLOADS["empreendimentos"]}], reproducao=REPRODUCAO)
    u = g["ultimo_leilao"]
    us = [r for r in rs if r["leilao"] == u["leilao"]]
    if u["preco_medio"] is not None:
        out["ultimo_preco"] = ev.construir(
            indicador=f"Preço médio do último leilão da base ({u['nome']})", valor_exibido=f"R$ {u['preco_medio']:.2f}/MWh".replace(".", ","),
            valor_calculo=u["preco_medio"], unidade="R$/MWh", periodo={"inicio": u["data"], "fim": u["data"]},
            entidade=f"leilão {u['leilao']} ({u['tipo']})", universo=f"{u['empreendimentos']} empreendimentos", fonte=fonte,
            chaves_origem=[r["chave"] for r in us], manifesto={"rotulo": "Empreendimentos (CSV)", "url": DOWNLOADS["empreendimentos"]},
            formula="Σ preço × energia ÷ Σ energia", revisoes=rev,
            numerador={"descricao": "Σ preço × energia vendida (R$/MWh × MWmédio)", "valor": c.r(sum(r["preco"] * r["energia_mwmed"] for r in us if r["preco"] is not None), 2)},
            denominador={"descricao": "Σ energia vendida das linhas com preço (MWmédio)", "valor": c.r(sum(r["energia_mwmed"] for r in us if r["preco"] is not None), 2)},
            cobertura="todas as linhas do leilão", tratamento_ausencia="linha com preço 0 na fonte fica fora", testes=testes_base,
            download=[{"rotulo": "Resumo por leilão (CSV)", "url": DOWNLOADS["leiloes"]}], reproducao=REPRODUCAO)
    op = g["entrega"]["total"]["operacao"]["energia_mwmed"]
    pct = 100 * op / t["energia_mwmed"] if t["energia_mwmed"] else None
    exp_sha = ins["siga"]["sha256"] if ins.get("siga") else None
    out["pct_operacao"] = ev.construir(
        indicador="Energia contratada de usinas hoje em operação no SIGA", valor_exibido=f"{pct:.1f}%".replace(".", ",") if pct is not None else None,
        valor_calculo=pct, unidade="% da energia contratada", periodo=per,
        entidade="empreendimentos vencedores dos leilões de geração na base aberta da ANEEL",
        universo=f"{t['empreendimentos']} linhas", fonte=fonte,
        chaves_origem=[r["chave"] for r in rs if r["situacao"] == "operacao"],
        manifesto={"rotulo": "Empreendimentos com situação (CSV)", "url": DOWNLOADS["empreendimentos"]},
        formula="100 × Σ energia das linhas com fase Operação no SIGA ÷ Σ energia de todas as linhas", revisoes=rev,
        numerador={"descricao": "energia das linhas em operação (MWmédio)", "valor": op},
        denominador={"descricao": "energia de todas as linhas (MWmédio)", "valor": t["energia_mwmed"]},
        cobertura=f"SIGA de {c.data_br(g['referencias']['siga'])} (expansao_usinas_siga.csv, sha256 {exp_sha[:12] if exp_sha else 'sem arquivo'})" if g["referencias"].get("siga") else "SIGA sem data",
        tratamento_ausencia="linha sem CEG e usina fora do SIGA ficam no denominador e fora do numerador",
        testes=testes_base + [ev.teste("situações exaustivas", "aprovado" if sum(x["empreendimentos"] for x in g["entrega"]["total"].values()) == t["empreendimentos"] else "reprovado",
                                       "toda linha cai em exatamente uma situação")],
        download=[{"rotulo": "Empreendimentos (CSV)", "url": DOWNLOADS["empreendimentos"]}], reproducao=REPRODUCAO)
    return out


def _escreve_arquivos(rs, g, grupos):
    def nomes(k):
        return [n for n, _ in COLUNAS[k]]
    base.escreve_csv(os.path.basename(DOWNLOADS["empreendimentos"]), nomes("empreendimentos"), [
        [r["linha"], r["data"], r["leilao"], r["nome_leilao"], r["tipo"], r["ano_a"], r["empreendimento"], r["ceg"], r["nucleo"],
         r["tipo_geracao"], r["fonte"], r["detalhe_fonte"], r["categoria"], r["uf"], r["mw"], r["gf_mwmed"], r["energia_mwmed"],
         r["preco_teto"], r["preco"], r["desagio_pct"], c.r(r["fator_ipca"], 6), c.r(r["preco_real"], 2), r["investimento_rs"],
         r["duracao_anos"], r["vencedora"], r["situacao"], r["fase_siga"], r["entrada_operacao"], r["entrada_vs_ano_a"],
         1 if r["ato_encerramento"] else 0, r["situacao_obra"], r["controle"], r["proprietario_cnpj"], r["grupo_cnpj"],
         r["grupo_nome"], 1 if r["ceg_repetido"] else 0] for r in rs])
    base.escreve_csv(os.path.basename(DOWNLOADS["leiloes"]), nomes("leiloes"), [
        [x["leilao"], x["data"], x["nome"], x["tipo"], x["ano_a"], x["empreendimentos"], x["mw"], x["energia_mwmed"], x["preco_medio"],
         x["preco_medio_real"], x["teto_medio"], x["desagio_agregado_pct"], x["investimento_rs_mi"],
         *[x["situacao_mwmed"][s] for s in ("operacao", "construcao", "nao_iniciada", "encerrada", "sem_registro", "sem_ceg")]]
        for x in g["leiloes"]])
    base.escreve_csv(os.path.basename(DOWNLOADS["preco"]), nomes("preco"), [
        [x["ano"], x["categoria"], x["leiloes"], x["empreendimentos"], x["energia_mwmed"], x["preco_medio"], x["preco_medio_real"],
         x["teto_medio"], x["desagio_agregado_pct"]] for x in g["preco_ano_categoria"]])
    base.escreve_csv(os.path.basename(DOWNLOADS["grupos"]), nomes("grupos"), [
        [x["cnpj"], x["nome"], x["empreendimentos"], x["usinas"], x["energia_mwmed"], "|".join(x["cadeia_cnpjs"])]
        for x in (grupos or {}).get("todos", [])])
    base.escreve_csv(os.path.basename(DOWNLOADS["transmissao"]), nomes("transmissao"), [
        [x[k] for k, _ in COLUNAS["transmissao"]] for x in g["transmissao"]["por_ano"]])
    cats = [k for k, _ in al.CATEGORIAS]
    sits = [k for k, _, _ in al.SITUACOES]
    pontos = {"gerado_em": base.agora_utc(), "ipca_ate": g["referencias"]["ipca_ate"],
              "colunas": ["data", "leilao", "empreendimento", "categoria", "uf", "energia_mwmed", "preco_rs_mwh", "preco_real_rs_mwh",
                          "preco_teto_rs_mwh", "desagio_pct", "situacao", "vencedora"],
              "categorias": cats, "situacoes": sits,
              "linhas": [[r["data"], r["leilao"], r["empreendimento"], cats.index(r["categoria"]) if r["categoria"] in cats else None,
                          r["uf"], r["energia_mwmed"], r["preco"], c.r(r["preco_real"], 2), r["preco_teto"], r["desagio_pct"],
                          sits.index(r["situacao"]), r["vencedora"]] for r in rs]}
    base.escreve_gold(os.path.basename(DOWNLOADS["pontos"]), pontos, destino=base.SERIES)
