"""Leitura do seed em registros tipados. Nenhum cálculo além de somar o que a fonte já desagrega."""
import csv
import io
import json
from collections import defaultdict

from pipeline.gas import base


def _csv(nome, encoding="utf-8-sig", delimitador=";"):
    texto = base.ler_seed(nome).decode(encoding)
    return list(csv.DictReader(io.StringIO(texto), delimiter=delimitador))


def balanco_producao():
    """{parcela: {(mes, uf, local): mil m³}} para produção, reinjeção, queima, consumo próprio e disponível."""
    arquivos = {
        "producao": ("anp/producao-gas-natural-1000m3.csv.gz", "PRODUÇÃO"),
        "reinjecao": ("anp/reinjecao-gn-1000m3.csv.gz", "REINJETADO"),
        "queima": ("anp/queima-e-perda-gn-1000m3.csv.gz", "QUEIMADO"),
        "consumo_proprio": ("anp/consumo-proprio-gn1000m3.csv.gz", "CONSUMO"),
        "disponivel": ("anp/gn-disponivel-1000m3.csv.gz", "DISPONÍVEL"),
    }
    saida = {}
    for parcela, (nome, coluna) in arquivos.items():
        d = defaultdict(float)
        for r in _csv(nome):
            v = base.numero_br(r[coluna])
            if v is None:
                continue
            uf = base.UF_SIGLA[r["UNIDADE DA FEDERAÇÃO"].strip().upper()]
            local = "mar" if r["LOCALIZAÇÃO"].strip().upper() == "MAR" else "terra"
            d[(base.mes_iso(r["ANO"], r["MÊS"]), uf, local)] += v
        saida[parcela] = dict(d)
    return saida


def importacao_anp():
    """{mes: (mil m³, US$)}"""
    out = {}
    for r in _csv("anp/importacao-gas-natural.csv.gz"):
        out[base.mes_iso(r["ANO"], r["MÊS"])] = (base.numero_br(r["IMPORTADO"]), base.numero_br(r["DISPÊNDIO"]))
    return out


def _ppg(nome):
    texto = base.ler_seed(nome).decode("utf-16")
    linhas = list(csv.reader(io.StringIO(texto), delimiter=";"))
    cab = [c.strip() for c in linhas[0]]
    out = []
    for l in linhas[1:]:
        if len(l) < len(cab):
            continue
        r = dict(zip(cab, (c.strip() for c in l)))
        out.append(r)
    return out


def vendas_distribuidoras():
    """[(mes, mercado, regiao, R$/MMBtu, mil m³/dia)]"""
    out = []
    for r in _ppg("anp/vendas-distribuidoras-consumidores-livres.csv.gz"):
        out.append((base.mes_iso(r["Ano"], r["Mês"]), r["TipoMercado"], r["RegiãoAgregada"],
                    base.numero_br(r["Preço em Reais por MMBtu"]), base.numero_br(r["Volume em mil metros cúbicos/dia"])))
    return out


def vendas_produtores():
    """[(mes, bacia, R$/MMBtu, mil m³/dia)]"""
    return [(base.mes_iso(r["Ano"], r["Mês"]), r["BaciaAgregada"], base.numero_br(r["Preço em Reais por MMBtu"]),
             base.numero_br(r["Volume em mil metros cúbicos/dia"])) for r in _ppg("anp/vendas-entre-produtores.csv.gz")]


def vendas_comercializadores():
    """[(mes, R$/MMBtu, mil m³/dia)]"""
    return [(base.mes_iso(r["Ano"], r["Mês"]), base.numero_br(r["Preço em Reais por MMBtu"]),
             base.numero_br(r["Volume em mil metros cúbicos/dia"])) for r in _ppg("anp/vendas-aos-comercializadores.csv.gz")]


def glp_vasilhame():
    """{(mes, uf, 'ate_p13'|'outros'): m³}"""
    out = defaultdict(float)
    for r in _csv("anp/vendas-glp-tipo-vasilhame-m3.csv.gz"):
        v = base.numero_br(r["VENDAS"])
        if v is None:
            continue
        tipo = "ate_p13" if "P13" in r["VASILHAME"] else "outros"
        out[(base.mes_iso(r["ANO"], r["MÊS"]), base.UF_SIGLA[r["UNIDADE DA FEDERAÇÃO"].strip().upper()], tipo)] += v
    return dict(out)


def _num_planilha(v):
    return base.numero_ponto(v)


def precos_estados():
    """[{mes, produto, uf, postos, medio, desvio, minimo, maximo, margem, distribuicao}]"""
    out = []
    for r in _csv("anp/precos-mensais-estados-glp-gnv.csv.gz", "utf-8"):
        out.append({
            "mes": r["MÊS"], "produto": r["PRODUTO"].strip().upper(), "uf": base.UF_SIGLA[r["ESTADO"].strip().upper()],
            "postos": _num_planilha(r["NÚMERO DE POSTOS PESQUISADOS"]), "medio": _num_planilha(r["PREÇO MÉDIO REVENDA"]),
            "desvio": _num_planilha(r["DESVIO PADRÃO REVENDA"]), "minimo": _num_planilha(r["PREÇO MÍNIMO REVENDA"]),
            "maximo": _num_planilha(r["PREÇO MÁXIMO REVENDA"]), "margem": _num_planilha(r["MARGEM MÉDIA REVENDA"]),
            "distribuicao": _num_planilha(r["PREÇO MÉDIO DISTRIBUIÇÃO"]),
        })
    return out


def precos_brasil():
    out = []
    for r in _csv("anp/precos-mensais-brasil-glp-gnv.csv.gz", "utf-8"):
        out.append({
            "mes": r["MÊS"], "produto": r["PRODUTO"].strip().upper(), "postos": _num_planilha(r["NÚMERO DE POSTOS PESQUISADOS"]),
            "medio": _num_planilha(r["PREÇO MÉDIO REVENDA"]), "minimo": _num_planilha(r["PREÇO MÍNIMO REVENDA"]),
            "maximo": _num_planilha(r["PREÇO MÁXIMO REVENDA"]), "margem": _num_planilha(r["MARGEM MÉDIA REVENDA"]),
            "distribuicao": _num_planilha(r["PREÇO MÉDIO DISTRIBUIÇÃO"]),
        })
    return out


def autorizacoes():
    # único conjunto da ANP desta lista separado por vírgula
    return _csv("anp/autorizacoes-gas-natural.csv.gz", "utf-8-sig", ",")


def movimentacao():
    return [{**r, "volume": float(r["volume_realizado_mil_m3"])} for r in _csv("anp/movimentacao-gasodutos-mensal.csv.gz", "utf-8")]


def comex():
    """[(mes, ncm, pais, kg, US$ FOB)]"""
    d = json.loads(base.ler_seed("mdic/comex-gas-natural.json.gz"))
    return [(f"{x['year']}-{int(x['monthNumber']):02d}", x["coNcm"], x["country"], float(x["metricKG"]), float(x["metricFOB"]))
            for x in d["list"]]


CATEGORIAS_IPCA = {"7169": "geral", "7482": "botijao", "7483": "encanado", "107657": "veicular"}


def ipca():
    """{(subitem, 'mensal'|'12m'): {mes: %}}"""
    d = json.loads(base.ler_seed("ibge/ipca-gas.json.gz"))
    out = defaultdict(dict)
    for tabela in ("1419", "7060"):
        for var in d[tabela]:
            chave_var = "mensal" if var["id"] == "63" else "12m"
            for r in var["resultados"]:
                cat = next(iter(r["classificacoes"][0]["categoria"]))
                for periodo, v in r["series"][0]["serie"].items():
                    n = base.numero_ponto(v)
                    if n is not None:
                        out[(CATEGORIAS_IPCA[cat], chave_var)][f"{periodo[:4]}-{periodo[4:]}"] = n
    return dict(out)


def ptax():
    """{mes: R$/US$}"""
    d = json.loads(base.ler_seed("bcb/sgs-3698.json.gz"))
    out = {}
    for x in d:
        dia, mes, ano = x["data"].split("/")
        out[f"{ano}-{mes}"] = float(x["valor"])
    return out


def pinksheet():
    """{mes: {henry_hub, ttf, gnl_japao, brent}} em US$/MMBtu (Brent em US$/barril)."""
    out = {}
    for r in _csv("bancomundial/pinksheet-gas.csv.gz", "utf-8"):
        out[r["mes"]] = {k: base.numero_ponto(r[k]) for k in ("henry_hub", "ttf", "gnl_japao", "brent")}
    return out
