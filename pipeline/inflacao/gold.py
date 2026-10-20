"""Gold do IPCA por área (public/inflacao/gold/ipca.json) e arquivos para baixar (public/inflacao/series).

Nada aqui estima: os números são os publicados pelo IBGE. O que a gold acrescenta, sempre marcado como
cálculo da Scrutiniums: a contribuição de cada grupo e de cada subitem para a variação em 12 meses, em
pontos percentuais (peso no primeiro mês da janela × variação em 12 meses ÷ 100), a diferença de cada área
para o Brasil, em pontos percentuais, e a lista de destaques de produtos e serviços com peso mínimo.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime

from . import fontes as F
from .validacoes import _num, contribuicoes, validar_seed

VERSAO = "inflacao-1.0.0"


class GoldInvalida(ValueError):
    pass


def iso_mes(m: str) -> str:
    return f"{m[:4]}-{m[4:]}"


def data_br_iso(d: str | None) -> str | None:
    if not d:
        return None
    try:
        return datetime.strptime(d, "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def nome_limpo(nome: str) -> str:
    """'1101002.Arroz' vira 'Arroz'; '1.Alimentação e bebidas' vira 'Alimentação e bebidas'."""
    return nome.split(".", 1)[1].strip() if "." in nome and nome.split(".", 1)[0].isdigit() else nome.strip()


def r(x, casas):
    return None if x is None else round(x, casas)


def construir(seed: dict, publicada: dict | None = None) -> dict:
    problemas = validar_seed(seed)
    if problemas:
        raise GoldInvalida("publicação retida: " + "; ".join(problemas[:20]) + (f" (e mais {len(problemas) - 20})" if len(problemas) > 20 else ""))
    meses = seed["meses"]
    ultimo, inicio = meses[-1], meses[-12]
    if publicada and publicada.get("ultimo_mes", "") > iso_mes(ultimo):
        raise GoldInvalida(f"a coleta traz até {iso_mes(ultimo)}, mas a publicação no ar já vai até {publicada['ultimo_mes']}")
    i, i0 = len(meses) - 1, len(meses) - 12
    cats = seed["categorias"]
    sub = seed["subitens"]["valores"]
    G = seed["grupos"]

    areas = [{"id": c, "nome": n, "uf": uf, "tipo": t, "rotulo": rot} for c, n, uf, t, rot in F.AREAS]

    # os três subitens de maior peso no Brasil em cada grupo: "o que entra" no grupo, lido da própria fonte
    def principais(numero: str) -> list[str]:
        doBr = [(x[2], k) for k, x in sub[F.BRASIL].items() if _num(x[2]) and cats[k]["nome"].startswith(numero)]
        return [nome_limpo(cats[k]["nome"]) for _, k in sorted(doBr, reverse=True)[:3]]

    grupos = [{"id": gid, "numero": int(n), "nome": nome, "principais": principais(n)} for gid, n, nome in F.GRUPOS]

    serie = {a: {"mensal": G[a][F.GERAL][F.V_MENSAL], "doze": G[a][F.GERAL][F.V_DOZE]} for a in F.IDS_AREAS}

    doze_br = G[F.BRASIL][F.GERAL][F.V_DOZE][i]
    ultimo_por_area = {}
    for a in F.IDS_AREAS:
        contrib, soma = contribuicoes(seed, a)
        geral = G[a][F.GERAL]
        ultimo_por_area[a] = {
            "geral": {"mensal": geral[F.V_MENSAL][i], "ano": geral[F.V_ANO][i], "doze": geral[F.V_DOZE][i],
                      "dif_brasil_pp": r(geral[F.V_DOZE][i] - doze_br, 2)},
            "grupos": {
                g: {
                    "mensal": G[a][g][F.V_MENSAL][i], "ano": G[a][g][F.V_ANO][i], "doze": G[a][g][F.V_DOZE][i],
                    "peso": G[a][g][F.V_PESO][i], "peso_inicio": G[a][g][F.V_PESO][i0],
                    "contribuicao_pp": r(contrib[g], 3),
                    "dif_brasil_pp": r(G[a][g][F.V_DOZE][i] - G[F.BRASIL][g][F.V_DOZE][i], 2),
                }
                for g in F.IDS_GRUPOS
            },
            "soma_contribuicoes_pp": r(soma, 3),
            "residuo_pp": r(geral[F.V_DOZE][i] - soma, 3),
        }

    subitens = {}
    destaques = {}
    for a in F.IDS_AREAS:
        lista = []
        for k, (doze, p0, p1) in sub[a].items():
            if doze == "-":
                continue  # fora da cesta da área
            numero = cats[k]["nome"][0]
            lista.append({"id": k, "nome": nome_limpo(cats[k]["nome"]), "grupo": F.GRUPO_DO_NUMERO[numero],
                          "doze": doze, "peso": p1, "peso_inicio": p0, "contribuicao_pp": r(p0 * doze / 100, 3)})
        lista.sort(key=lambda x: (-x["peso"], x["nome"]))
        subitens[a] = lista
        elegiveis = [x for x in lista if x["peso"] >= F.PESO_MINIMO_DESTAQUE]
        sobem = sorted(elegiveis, key=lambda x: (-x["doze"], x["nome"]))
        caem = sorted(elegiveis, key=lambda x: (x["doze"], x["nome"]))
        destaques[a] = {
            "elegiveis": len(elegiveis), "na_cesta": len(lista),
            "peso_elegiveis": r(sum(x["peso"] for x in elegiveis), 2),
            "sobem": [x["id"] for x in sobem[:10]], "caem": [x["id"] for x in caem[:10]],
        }

    divulgado = data_br_iso(seed["periodos"][-1].get("modificacao"))
    proxima = None
    for d in (seed.get("calendario") or {}).get("divulgacoes", []):
        if d["referencia"] > iso_mes(ultimo) and (divulgado is None or d["data"] > divulgado):
            proxima = d
            break

    dados = {
        "primeiro_mes": iso_mes(meses[0]),
        "ultimo_mes": iso_mes(ultimo),
        "inicio_janela": iso_mes(inicio),
        "primeiro_mes_doze": iso_mes(next(m for m, x in zip(meses, G[F.BRASIL][F.GERAL][F.V_DOZE]) if _num(x))),
        "meses": [iso_mes(m) for m in meses],
        "areas": areas,
        "grupos": grupos,
        "serie": serie,
        "ultimo": ultimo_por_area,
        "subitens": subitens,
        "destaques": destaques,
        "regras": {"peso_minimo_destaque": F.PESO_MINIMO_DESTAQUE},
    }
    hash_dados = hashlib.sha256(json.dumps(dados, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {
        "versao": VERSAO,
        "fonte": {
            "orgao": "IBGE",
            "pesquisa": "Índice Nacional de Preços ao Consumidor Amplo (IPCA)",
            "tabela": F.TABELA,
            "nome_tabela": seed.get("nome_tabela"),
            "url_tabela": F.URL_TABELA,
            "url_metodo": F.URL_METODO,
            "divulgado_em": divulgado,
            "proxima_divulgacao": proxima,
        },
        "capturado_em": seed["capturado_em"],
        "hash_dados": hash_dados,
        **dados,
    }


def _br(x, casas) -> str:
    if x is None or x == "-":
        return ""
    return f"{x:.{casas}f}".replace(".", ",")


def csv_grupos(seed: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(["area_codigo_ibge", "area", "mes", "categoria_codigo_sidra", "categoria", "variacao_mensal_pct", "variacao_no_ano_pct", "variacao_12_meses_pct", "peso_pct"])
    cats = seed["categorias"]
    nomes = {c: rot for c, _n, _uf, _t, rot in F.AREAS}
    for a in F.IDS_AREAS:
        for c in [F.GERAL, *F.IDS_GRUPOS]:
            porv = seed["grupos"][a][c]
            for k, m in enumerate(seed["meses"]):
                w.writerow([a, nomes[a], iso_mes(m), c, nome_limpo(cats[c]["nome"]),
                            _br(porv[F.V_MENSAL][k], 2), _br(porv[F.V_ANO][k], 2), _br(porv[F.V_DOZE][k], 2), _br(porv[F.V_PESO][k], 4)])
    return buf.getvalue()


def csv_subitens(gold: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(["area_codigo_ibge", "area", "mes", "subitem_codigo_sidra", "subitem", "grupo", "variacao_12_meses_pct", "peso_inicio_janela_pct", "peso_pct", "contribuicao_pp"])
    nomes = {x["id"]: x["rotulo"] for x in gold["areas"]}
    grupos = {g["id"]: g["nome"] for g in gold["grupos"]}
    for a in F.IDS_AREAS:
        for x in gold["subitens"][a]:
            w.writerow([a, nomes[a], gold["ultimo_mes"], x["id"], x["nome"], grupos[x["grupo"]], _br(x["doze"], 2), _br(x["peso_inicio"], 4), _br(x["peso"], 4), _br(x["contribuicao_pp"], 3)])
    return buf.getvalue()
