"""Saúde e ambiente (capítulo 13): internações (SIH/SUS) e óbitos (SIM) por local de residência.

Fonte: Ministério da Saúde, DATASUS, TabNet (tabulações públicas sobre o SIH/SUS e o SIM). Cada consulta é
gravada como veio, em gzip, com o sha256 do original, e o manifesto guarda os parâmetros e as notas da
própria fonte (data de extração, dados preliminares). A gold sai desses originais, sem rede.

Recorte, deliberadamente estreito e documentado:
- Grupos: infecções intestinais (CID-10 A00 a A09), leptospirose (A27) e esquistossomose (B65). Dengue e
  outras doenças de vetor, hepatite A e doenças da pele ficam fora: a ligação com o saneamento é indireta
  ou o grupo não é separável na Lista de Morbidade do SIH.
- Janela: 2022 a 2024, os três últimos anos com dados finais do SIM na extração de 02/12/2025.
- Município de residência, não de internação ou ocorrência. Contagens, sem taxa: o denominador (moradores
  do Censo 2022) entra na camada de apresentação.

Coleta: python3 -m pipeline.observatorio_saneamento.saude --coletar
"""
import argparse
import datetime as dt
import gzip
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed" / "saude"
TABNET = "http://tabnet.datasus.gov.br/cgi"
DEF = {"sim": "sim/cnv/obt10br.def", "sih": "sih/cnv/nrbr.def"}
ANOS = (2022, 2023, 2024)
UA = "ObservatorioBrasileiroDeCredito coleta saude"

# Rótulos da Lista de Morbidade CID-10 do SIH que formam cada grupo; códigos CID-10 do SIM.
GRUPOS = [
    {
        "id": "intestinais",
        "rotulo": "Infecções intestinais",
        "cid": "A00 a A09",
        "sim": [f"A0{i}" for i in range(10)],
        "sih": [
            "Cólera",
            "Febres tifóide e paratifóide",
            "Shiguelose",
            "Amebíase",
            "Diarréia e gastroenterite origem infecc presumível",
            "Outras doenças infecciosas intestinais",
        ],
    },
    {
        "id": "leptospirose",
        "rotulo": "Leptospirose",
        "cid": "A27",
        "sim": ["A27"],
        "sih": ["Leptospirose icterohemorrágica", "Outras formas de leptospirose", "Leptospirose não especificada"],
    },
    {
        "id": "esquistossomose",
        "rotulo": "Esquistossomose",
        "cid": "B65",
        "sim": ["B65"],
        "sih": ["Esquistossomose"],
    },
]

# sistema, medida (nome curto do campo), incremento do TabNet, coluna do TabNet, seleção do TabNet, rótulo
MEDIDAS = [
    ("sih", "int", "Internações", "Ano_atendimento", "SLista_Morb__CID-10", "Internações hospitalares no SUS (SIH), por residência, ano de atendimento"),
    ("sih", "obt", "Óbitos", "Ano_atendimento", "SLista_Morb__CID-10", "Óbitos em internação hospitalar no SUS (SIH), por residência, ano de atendimento"),
    ("sim", "obt", "Óbitos_p/Residênc", "Ano_do_Óbito", "SCategoria_CID-10", "Óbitos pelo SIM, por residência, ano do óbito"),
]


def campo(grupo, sistema, medida):
    return f"sd_{grupo}_{sistema}_{medida}"


def campos():
    """Colunas municipais, na ordem em que entram no arquivo: cada grupo e, depois, o total dos grupos."""
    return [campo(g, s, m) for g in [x["id"] for x in GRUPOS] + ["total"] for s, m, *_ in MEDIDAS]


def sha(b):
    return hashlib.sha256(b).hexdigest()


# ---------------------------------------------------------------------------
# consulta ao TabNet
# ---------------------------------------------------------------------------

def _opcoes(def_html, nome):
    m = re.search(r'<select[^>]*name="%s"[^>]*>(.*?)</select>' % re.escape(nome), def_html, flags=re.S | re.I)
    if not m:
        raise ValueError(f"campo {nome} ausente na definição do TabNet")
    return [(v, html.unescape(x.strip())) for v, x in re.findall(r'<option[^>]*value="?([^">]*)"?[^>]*>([^<]*)', m.group(1), flags=re.I)]


def indices(def_html, selecao, rotulos, por_codigo):
    """Valores do TabNet para os rótulos pedidos; rótulo ausente ou ambíguo interrompe a coleta."""
    opcoes = _opcoes(def_html, selecao)
    achados = []
    for r in rotulos:
        if por_codigo:  # "A00 Cólera" ou "@A05 Outras..." → casa pelo código no início
            c = [(v, x) for v, x in opcoes if re.match(r"@?%s\b" % re.escape(r), x)]
        else:
            c = [(v, x) for v, x in opcoes if x == r]
        if len(c) != 1:
            raise ValueError(f"{selecao}: {r!r} casou {len(c)} opções")
        achados.append({"valor": c[0][0], "rotulo": c[0][1]})
    return achados


def arquivos_tabnet(def_html, sistema):
    """Arquivos mensais (SIH) ou anuais (SIM) que cobrem a janela, conferidos na lista da própria definição."""
    existentes = {v for v, _ in _opcoes(def_html, "Arquivos")}
    if sistema == "sim":
        pedidos = [f"obtbr{a % 100:02d}.dbf" for a in ANOS]
    else:
        # processamento até o fim do ano seguinte à janela: atendimento de dezembro pode ser processado depois
        pedidos = [f"nrbr{a % 100:02d}{m:02d}.dbf" for a in range(ANOS[0], ANOS[-1] + 2) for m in range(1, 13)]
    faltam = [p for p in pedidos if p not in existentes]
    if faltam:
        raise ValueError(f"arquivos ausentes no TabNet: {faltam[:5]}")
    return pedidos


def especificacoes(defs):
    """Uma consulta por grupo e medida, com os parâmetros já resolvidos contra as definições do TabNet."""
    out = []
    for g in GRUPOS:
        for sistema, medida, incremento, coluna, selecao, rotulo in MEDIDAS:
            d = defs[sistema]
            alvo = g["sim"] if sistema == "sim" else g["sih"]
            out.append({
                "id": f"{sistema}-{g['id']}-{medida}",
                "sistema": sistema,
                "grupo": g["id"],
                "medida": medida,
                "rotulo": f"{g['rotulo']} (CID-10 {g['cid']}): {rotulo}",
                "def": DEF[sistema],
                "incremento": incremento,
                "coluna": coluna,
                "selecao": selecao,
                "itens": indices(d, selecao, alvo, por_codigo=(sistema == "sim")),
                "arquivos": arquivos_tabnet(d, sistema),
            })
    return out


def corpo(spec):
    campos_ = [("Linha", "Município"), ("Coluna", spec["coluna"]), ("Incremento", spec["incremento"])]
    campos_ += [("Arquivos", a) for a in spec["arquivos"]]
    campos_.append(("SMunicípio", "TODAS_AS_CATEGORIAS__"))
    campos_ += [(spec["selecao"], i["valor"]) for i in spec["itens"]]
    campos_ += [("formato", "prn"), ("mostre", "Mostra"), ("zeradas", "exibirlz")]
    return campos_


def _post(spec):
    dados = urllib.parse.urlencode(corpo(spec), encoding="latin-1").encode("ascii")
    req = urllib.request.Request(
        f"{TABNET}/tabcgi.exe?{spec['def']}", data=dados,
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=180) as r:
        return r.read()


def coletar():
    SEED.mkdir(parents=True, exist_ok=True)
    defs, defs_sha = {}, {}
    for s, caminho in DEF.items():
        b = _get(f"{TABNET}/deftohtm.exe?{caminho}")
        defs[s] = b.decode("latin-1")
        defs_sha[s] = {"url": f"{TABNET}/deftohtm.exe?{caminho}", "sha256": sha(b)}
    consultas = []
    for spec in especificacoes(defs):
        bruto = _post(spec)
        texto = bruto.decode("latin-1")
        r = interpretar(texto, spec)  # erro de interpretação ou resposta vazia interrompe antes de gravar
        nome = f"{spec['id']}.html.gz"
        (SEED / nome).write_bytes(gzip.compress(bruto, mtime=0))
        consultas.append(dict(spec, arquivo=nome, sha256=sha(bruto), bytes=len(bruto), notas=r["notas"]))
        print(spec["id"], len(r["municipios"]), "municípios", flush=True)
    manifesto = {"capturado_em": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "definicoes": defs_sha, "consultas": consultas}
    (SEED / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# interpretação da resposta
# ---------------------------------------------------------------------------

def _inteiro(v):
    v = v.strip()
    if v == "-":  # convenção do TabNet: zero absoluto
        return 0
    if re.fullmatch(r"\d+", v):
        return int(v)
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", v):
        return int(v.replace(".", ""))
    raise ValueError(f"valor do TabNet desconhecido: {v!r}")


def interpretar(texto, spec=None):
    """Resposta do TabNet (formato prn) → contagens por município (código de 6 dígitos) e ano.

    Confere cada linha (soma dos anos = coluna Total) e cada ano (soma das linhas = linha Total)."""
    i, j = texto.find("<PRE>"), texto.find("</PRE>")
    if i < 0 or j < 0:
        raise ValueError("resposta do TabNet sem tabela")
    # o TabNet fecha o bloco com uma linha "&" solta; só entram as linhas de tabela
    linhas = [l.strip() for l in html.unescape(texto[i + 5:j]).strip().split("\n") if l.strip().startswith('"')]
    cab = [c.strip('"') for c in linhas[0].split(";")]
    if cab[0] != "Município" or cab[-1] != "Total":
        raise ValueError(f"cabeçalho inesperado: {cab[:3]}")
    anos = [int(c) for c in cab[1:-1]]
    municipios, ignorados, total = {}, {}, None
    for l in linhas[1:]:
        celulas = l.split(";")
        rotulo = celulas[0].strip('"')
        valores = [_inteiro(c) for c in celulas[1:]]
        if len(valores) != len(anos) + 1:
            raise ValueError(f"colunas inesperadas: {l[:60]}")
        if sum(valores[:-1]) != valores[-1]:
            raise ValueError(f"soma dos anos diverge do total na linha {rotulo!r}")
        por_ano = dict(zip(anos, valores[:-1]))
        m = re.match(r"(\d{6}) ", rotulo)
        if m and m.group(1) == "000000":  # residência ignorada ou no exterior
            ignorados["EXTERIOR_OU_IGNORADO"] = por_ano
        elif m:
            if m.group(1) in municipios:
                raise ValueError("município repetido: " + m.group(1))
            municipios[m.group(1)] = por_ano
        elif rotulo.strip().startswith("MUNICIPIO IGNORADO"):
            uf = rotulo.rsplit("-", 1)[-1].strip()
            ignorados[uf] = por_ano
        elif rotulo == "Total":
            total = por_ano
        else:
            raise ValueError(f"linha não reconhecida: {rotulo!r}")
    if total is None:
        raise ValueError("resposta sem linha Total")
    for a in anos:
        soma = sum(v[a] for v in municipios.values()) + sum(v[a] for v in ignorados.values())
        if soma != total[a]:
            raise ValueError(f"soma das linhas de {a} ({soma}) diverge da linha Total ({total[a]})")
    notas = ""
    m = re.search(r"Fonte:(.*?)Legenda:", html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", texto[j:]))))
    if m:
        notas = ("Fonte:" + m.group(1)).strip()
    return {"anos": anos, "municipios": municipios, "ignorados": ignorados, "total": total, "notas": notas}


def ler(registro):
    b = gzip.decompress((SEED / registro["arquivo"]).read_bytes())
    if sha(b) != registro["sha256"]:
        raise ValueError("SHA-256 divergente: " + registro["arquivo"])
    return b.decode("latin-1")


# ---------------------------------------------------------------------------
# gold
# ---------------------------------------------------------------------------

def construir(ids6, uf6):
    """(campos por município de 6 dígitos, bloco de meta). Município sem linha na fonte fica com None.

    A janela entra pela soma dos anos de ANOS; os anos fora dela, que o TabNet devolve nos arquivos de
    processamento, não entram em nenhuma conta."""
    manifesto = json.loads((SEED / "manifesto.json").read_text(encoding="utf-8"))
    por_id = {c["id"]: c for c in manifesto["consultas"]}
    municipais = {i: {c: None for c in campos()} for i in ids6}
    conferencias, totais, ignorados_uf, fora = [], {}, {}, {}
    for g in GRUPOS:
        for sistema, medida, *_ in MEDIDAS:
            reg = por_id[f"{sistema}-{g['id']}-{medida}"]
            r = interpretar(ler(reg), reg)
            for a in ANOS:
                if a not in r["anos"]:
                    raise ValueError(f"ano {a} ausente em {reg['id']}")
            soma_mun = {i: sum(v[a] for a in ANOS) for i, v in r["municipios"].items()}
            for i, n in soma_mun.items():
                if i in municipais:
                    municipais[i][campo(g["id"], sistema, medida)] = n
                else:
                    fora[i] = fora.get(i, 0) + n
            ign = sum(sum(v[a] for a in ANOS) for v in r["ignorados"].values())
            total = sum(r["total"][a] for a in ANOS)
            presentes = sum(n for i, n in soma_mun.items() if i in municipais)
            totais[reg["id"]] = total
            ignorados_uf[reg["id"]] = ign
            conferencias.append({
                "id": reg["id"],
                "municipios_gold": presentes,
                "municipios_fora_do_cadastro": sum(n for i, n in soma_mun.items() if i not in municipais),
                "municipio_ignorado": ign,
                "total_tabnet": total,
                "diferenca": presentes + sum(n for i, n in soma_mun.items() if i not in municipais) + ign - total,
            })
    for i, c in municipais.items():
        for sistema, medida, *_ in MEDIDAS:
            partes = [c[campo(g["id"], sistema, medida)] for g in GRUPOS]
            c[campo("total", sistema, medida)] = None if any(p is None for p in partes) else sum(partes)
    bloco = {
        "periodo": list(ANOS),
        "grupos": [{k: g[k] for k in ("id", "rotulo", "cid")} for g in GRUPOS],
        "consultas": [{k: c[k] for k in ("id", "sistema", "grupo", "medida", "rotulo", "def", "incremento", "coluna", "selecao", "itens", "arquivo", "sha256", "bytes", "notas")} for c in manifesto["consultas"]],
        "definicoes": manifesto["definicoes"],
        "capturado_em": manifesto["capturado_em"],
        "totais_tabnet": totais,
        "municipio_ignorado": ignorados_uf,
        "conferencias": conferencias,
        "municipios_sem_linha": sorted(i for i in ids6 if municipais[i][campos()[0]] is None),
    }
    return municipais, bloco


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--coletar", action="store_true")
    a = p.parse_args()
    if a.coletar:
        coletar()
    else:
        print(json.dumps({"campos": campos()}, ensure_ascii=False))
