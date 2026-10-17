"""Referências mundiais por capítulo: séries da base global de indicadores dos ODS da ONU.

Fonte: UN Statistics Division, SDG Global Database (unstats.un.org/sdgapi), edição registrada por série no
manifesto. Cada série é a que a agência custodiante publica (OMS e UNICEF no JMP, OMS e UN-Habitat no esgoto,
FAO no estresse hídrico, PNUMA na gestão integrada, OCDE na ajuda oficial); a base da ONU só as reúne.

Só a versão global de cada série é lida (dimensão "Reporting Type" igual a G): a mesma área e ano podem vir
também na versão nacional, e duas linhas para a mesma chave fazem a coleta falhar, em vez de escolher uma.

Nomes de países em português vêm da API de países do IBGE, pelo código M49. Áreas que o IBGE não lista
(territórios) ficam com o nome em inglês da ONU, marcado como tal. Nenhuma tradução é feita à mão.

A gold guarda os valores como a ONU os publica, a natureza de cada dado (dado do país, estimativa, modelado,
agregado) e, por série, o ano mais recente em que o Brasil tem valor: é nesse ano que Brasil, mundo, América
Latina e Caribe e os demais países são postos lado a lado. Posição e comparações entram na camada de
apresentação.

Coleta: python3 -m pipeline.observatorio_saneamento.ods --coletar
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed" / "ods"
API = "https://unstats.un.org/sdgapi/v1/sdg"
URL_PAISES_IBGE = "https://servicodados.ibge.gov.br/api/v1/paises/all"
UA = "ObservatorioBrasileiroDoSaneamento coleta ods"

BRASIL, MUNDO, ALC = 76, 1, 419  # códigos M49

# Série, indicador, recorte fixo de dimensões (além de Reporting Type = G) e recortes publicados lado a lado.
# "recortes" usa a dimensão indicada; o primeiro valor é o principal.
SERIES = [
    {"codigo": "SH_H2O_SAFE", "indicador": "6.1.1", "recorte": ("Location", ["ALLAREA", "URBAN", "RURAL"])},
    {"codigo": "SH_SAN_SAFE", "indicador": "6.2.1", "recorte": ("Location", ["ALLAREA", "URBAN", "RURAL"])},
    {"codigo": "EN_WWT_WWDS", "indicador": "6.3.1"},
    {"codigo": "EN_H2O_WBAMBQ", "indicador": "6.3.2"},
    {"codigo": "ER_H2O_STRESS", "indicador": "6.4.2", "fixo": {"Activity": "TOTAL"}},
    {"codigo": "ER_H2O_IWRMD", "indicador": "6.5.1", "fixo": {"Level/Status": "_T"}},
    {"codigo": "DC_TOF_WASHL", "indicador": "6.a.1"},
    {"codigo": "SH_STA_WASHARI", "indicador": "3.9.2"},
]
CABECALHO = ["m49", "area", "ano", "valor", "natureza", "unidade", "dimensoes", "fonte"]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def numero(v):
    if v is None or isinstance(v, bool) or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# coleta
# ---------------------------------------------------------------------------

def _baixar(url, timeout=300, tentativas=4):
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"}), timeout=timeout) as r:
                return r.read()
        except OSError:
            if i == tentativas - 1:
                raise
            time.sleep(2 ** (i + 1))


def _gravar_gz(nome, bruto, **extra):
    (SEED / f"{nome}.gz").write_bytes(gzip.compress(bruto, mtime=0))
    return {"arquivo": f"{nome}.gz", "sha256": sha(bruto), "bytes": len(bruto), **extra}


def _dimensoes(r, serie):
    """Dimensões da linha sem Reporting Type; None quando a linha não é da versão global ou foge do recorte fixo."""
    dims = dict(r.get("dimensions") or {})
    if dims.pop("Reporting Type", "G") != "G":
        return None
    for k, v in (serie.get("fixo") or {}).items():
        if dims.get(k) != v:
            return None
    return dims


def linhas_da_serie(resposta, serie):
    """Linhas da resposta da API reduzidas ao seed: versão global, recorte fixo, uma linha por área, ano e dimensões."""
    saida, vistas = [], set()
    for r in resposta["data"]:
        dims = _dimensoes(r, serie)
        if dims is None:
            continue
        chave = (int(r["geoAreaCode"]), int(r["timePeriodStart"]), json.dumps(dims, sort_keys=True))
        if chave in vistas:
            raise ValueError(f"{serie['codigo']}: linha repetida para {chave}")
        vistas.add(chave)
        at = r.get("attributes") or {}
        saida.append([chave[0], r["geoAreaName"], chave[1], r["value"], at.get("Nature"), at.get("Units"), chave[2], r.get("source") or ""])
    return sorted(saida, key=lambda l: (l[0], l[2], l[6]))


def _csv(cabecalho, linhas):
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(cabecalho)
    for l in linhas:
        w.writerow(["" if v is None else v for v in l])
    return buf.getvalue().encode("utf-8")


def _paises_da_arvore(arvore):
    """Países e territórios (tipo Country) sob 'World (total) by SDG regions', com a região ODS de cada um."""
    raiz = next(n for n in arvore if n["geoAreaCode"] == MUNDO)
    saida = []

    def anda(n, caminho):
        if n.get("type") == "Country":
            saida.append({"m49": int(n["geoAreaCode"]), "nome_onu": n["geoAreaName"], "regioes": caminho})
        for c in n.get("children") or []:
            anda(c, caminho + ([n["geoAreaName"]] if n.get("type") == "Region" and n is not raiz else []))

    anda(raiz, [])
    return sorted(saida, key=lambda p: p["m49"])


def coletar():
    SEED.mkdir(parents=True, exist_ok=True)
    capturado = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    lista = json.loads(_baixar(f"{API}/Goal/List?includechildren=true"))
    edicoes = {}
    for g in lista:
        for t in g["targets"]:
            for i in t["indicators"]:
                for s in i.get("series") or []:
                    if s.get("release", "") > edicoes.get(s["code"], ""):
                        edicoes[s["code"]] = s["release"]
    descricoes = {}
    for g in lista:
        for t in g["targets"]:
            for i in t["indicators"]:
                for s in i.get("series") or []:
                    if s.get("release") == edicoes.get(s["code"]):
                        descricoes[s["code"]] = s["description"]
    arquivos = {}
    for serie in SERIES:
        c = serie["codigo"]
        url = f"{API}/Series/Data?{urllib.parse.urlencode({'seriesCode': c, 'pageSize': 100000})}"
        bruto = _baixar(url)
        resposta = json.loads(bruto)
        if resposta.get("totalElements") != len(resposta.get("data", [])):
            raise ValueError(f"{c}: a API devolveu {len(resposta.get('data', []))} de {resposta.get('totalElements')} linhas")
        linhas = linhas_da_serie(resposta, serie)
        if not linhas:
            raise ValueError(f"{c}: nenhuma linha na versão global")
        arquivos[c] = _gravar_gz(f"{c}.csv", _csv(CABECALHO, linhas), linhas=len(linhas), url=url,
                                 resposta={"sha256": sha(bruto), "bytes": len(bruto), "linhas": len(resposta["data"])},
                                 edicao=edicoes.get(c), descricao_onu=descricoes.get(c))
    arvore_bruta = _baixar(f"{API}/GeoArea/Tree")
    paises = _paises_da_arvore(json.loads(arvore_bruta))
    arquivos["paises_onu"] = _gravar_gz("paises_onu.json", json.dumps(paises, ensure_ascii=False, sort_keys=True).encode("utf-8"),
                                        linhas=len(paises), url=f"{API}/GeoArea/Tree", resposta={"sha256": sha(arvore_bruta), "bytes": len(arvore_bruta)})
    ibge_bruto = _baixar(URL_PAISES_IBGE, 120)
    ibge = json.loads(gzip.decompress(ibge_bruto) if ibge_bruto[:2] == b"\x1f\x8b" else ibge_bruto)
    reduzido = sorted(({"m49": int(p["id"]["M49"]), "nome": p["nome"]["abreviado"]} for p in ibge), key=lambda p: p["m49"])
    arquivos["paises_ibge"] = _gravar_gz("paises_ibge.json", json.dumps(reduzido, ensure_ascii=False, sort_keys=True).encode("utf-8"),
                                         linhas=len(reduzido), url=URL_PAISES_IBGE, resposta={"sha256": sha(ibge_bruto), "bytes": len(ibge_bruto)})
    manifesto = {"capturado_em": capturado, "api": API, "arquivos": arquivos}
    (SEED / "manifesto.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("ODS:", {k: (v["linhas"], v.get("edicao")) for k, v in arquivos.items()}, flush=True)


# ---------------------------------------------------------------------------
# construção da gold
# ---------------------------------------------------------------------------

def _bruto(manifesto, chave):
    """Conteúdo descomprimido de um seed, conferido contra o sha256 do manifesto."""
    a = manifesto["arquivos"][chave]
    bruto = gzip.decompress((SEED / a["arquivo"]).read_bytes())
    if sha(bruto) != a["sha256"] or len(bruto) != a["bytes"]:
        raise ValueError(f"seed dos ODS alterado: {a['arquivo']}")
    return bruto


def _ler(manifesto, codigo):
    linhas = list(csv.DictReader(io.StringIO(_bruto(manifesto, codigo).decode("utf-8")), delimiter=";"))
    for l in linhas:
        l["m49"], l["ano"], l["valor"] = int(l["m49"]), int(l["ano"]), numero(l["valor"])
        l["dims"] = json.loads(l["dimensoes"])
    return linhas


def _ponto(l):
    return None if l is None else {"ano": l["ano"], "valor": l["valor"], "natureza": l["natureza"] or None}


def construir_serie(serie, linhas, paises, nomes_ibge):
    """Uma série na gold: Brasil, mundo e América Latina e Caribe no ano comparado, a série histórica dos três e os
    países com valor nesse ano. Ano comparado: o mais recente em que o Brasil tem valor no recorte principal."""
    dim, valores = serie.get("recorte") or (None, [None])

    def do_recorte(v):
        return [l for l in linhas if (dim is None or l["dims"].get(dim) == v)]

    def bloco(v):
        ls = do_recorte(v)
        por = {}
        for l in ls:
            por.setdefault(l["m49"], {})[l["ano"]] = l
        anos_br = sorted(por.get(BRASIL, {}))
        return ls, por, anos_br

    ls, por, anos_br = bloco(valores[0])
    if not anos_br:
        raise ValueError(f"{serie['codigo']}: o Brasil não tem valor no recorte principal")
    ano = anos_br[-1]
    em_paises = {p["m49"]: p for p in paises}
    lista = []
    for m49, anos in por.items():
        if m49 not in em_paises or ano not in anos or anos[ano]["valor"] is None:
            continue
        nome = nomes_ibge.get(m49)
        lista.append({"m49": m49, "nome": nome or em_paises[m49]["nome_onu"], "nome_origem": "IBGE" if nome else "ONU",
                      "valor": anos[ano]["valor"], "natureza": anos[ano]["natureza"] or None})
    lista.sort(key=lambda p: p["m49"])

    def historico(m49, v):
        _, p, _ = bloco(v)
        return [[a, p[m49][a]["valor"]] for a in sorted(p.get(m49, {})) if p[m49][a]["valor"] is not None]

    def tres(v):
        _, p, _ = bloco(v)
        return {nome: _ponto(p.get(m, {}).get(ano)) for nome, m in (("brasil", BRASIL), ("mundo", MUNDO), ("alc", ALC))}

    fontes = sorted({l["fonte"] for l in ls if l["m49"] == BRASIL and l["ano"] == ano and l["fonte"]})
    unidades = sorted({l["unidade"] for l in ls if l["unidade"]})
    if len(unidades) != 1:
        raise ValueError(f"{serie['codigo']}: unidades {unidades} no recorte principal")
    out = {
        "codigo": serie["codigo"],
        "indicador": serie["indicador"],
        "unidade_onu": unidades[0],
        "ano_comparado": ano,
        **tres(valores[0]),
        "fonte_brasil": fontes,
        "historico": {nome: historico(m, valores[0]) for nome, m in (("brasil", BRASIL), ("mundo", MUNDO), ("alc", ALC))},
        "paises": lista,
    }
    if dim:
        out["recortes"] = {v: tres(v) for v in valores[1:]}
        out["recorte_dimensao"] = dim
    return out


def construir():
    manifesto = json.loads((SEED / "manifesto.json").read_text(encoding="utf-8"))
    paises = json.loads(_bruto(manifesto, "paises_onu"))
    nomes_ibge = {p["m49"]: p["nome"] for p in json.loads(_bruto(manifesto, "paises_ibge"))}
    series = {}
    for serie in SERIES:
        a = manifesto["arquivos"][serie["codigo"]]
        s = construir_serie(serie, _ler(manifesto, serie["codigo"]), paises, nomes_ibge)
        s["edicao"] = a["edicao"]
        s["descricao_onu"] = a["descricao_onu"]
        series[serie["codigo"]] = s
    meta = {
        "fonte": manifesto["api"],
        "capturado_em": manifesto["capturado_em"],
        "edicoes": sorted({s["edicao"] for s in series.values()}),
        "paises_onu": len(paises),
        "paises_ibge": len(nomes_ibge),
        "series": {c: {"ano_comparado": s["ano_comparado"], "paises": len(s["paises"]), "sha256": manifesto["arquivos"][c]["sha256"]} for c, s in series.items()},
    }
    return {"series": series}, meta


def linhas_csv(ods):
    cab = ["serie", "indicador", "edicao", "ano", "m49", "pais", "valor", "natureza", "unidade"]
    saida = []
    for c, s in ods["series"].items():
        for p in s["paises"]:
            saida.append([c, s["indicador"], s["edicao"], s["ano_comparado"], p["m49"], p["nome"], p["valor"], p["natureza"], s["unidade_onu"]])
    return cab, saida


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--coletar", action="store_true", help="baixa as séries da base dos ODS e a lista de países do IBGE e grava o seed (precisa de rede)")
    if ap.parse_args().coletar:
        coletar()
    else:
        ap.print_help()
