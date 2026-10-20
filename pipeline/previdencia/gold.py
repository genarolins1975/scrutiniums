"""Gold do painel Previdência e INSS (public/previdencia/gold).

- previdencia.json: o mês mais recente do BEPS (tipos de benefício no Brasil e RGPS por UF), a série mensal por grandes
  grupos, os dezembros do arquivo municipal somados por UF e no Brasil, o resultado do RGPS por ano (RTN) e as fontes.
- municipios/{UF}.json: cada município da UF, dezembro a dezembro desde 2019, por grupo de espécie.

Nada aqui estima nem interpola. O que a gold calcula, sempre a partir de números publicados e marcado como cálculo da
Scrutiniums: valor médio (valor ÷ quantidade), somas por UF dos municípios (pelo prefixo do código IBGE), resultado do
RGPS (arrecadação líquida menos benefícios previdenciários, a mesma conta do Tesouro e do Ministério), as razões em %
do PIB (a do Tesouro é conferida) e a parte rural. Divisão urbana e rural, BPC e sentenças judiciais que o RTN só passou
a segregar em certo ano aparecem como zero na planilha antes disso: aqui viram ausência (null), não zero.
"""
from __future__ import annotations

import hashlib
import json

from . import fontes as F
from .validacoes import validar_beps, validar_cruzado, validar_municipios, validar_rtn

VERSAO = "previdencia-1.0.0"


class GoldInvalida(ValueError):
    pass


def r2(x):
    return None if x is None else round(x, 2)


def medio(v, q):
    return None if v is None or not q else round(v / q, 2)


def _brasil_mes(beps: dict) -> dict:
    linhas = beps["tabela15"]["linhas"]
    tipos = []
    for (i, _rot, pai), l in zip(F.TABELA_15, linhas):
        tipos.append({
            "id": i, "pai": pai, "rotulo_fonte": l["rotulo"],
            "q": int(l["q"]), "v": r2(l["v"]), "medio": medio(l["v"], l["q"]),
            "q_urbana": None if l.get("q_urbana") is None else int(l["q_urbana"]),
            "q_rural": None if l.get("q_rural") is None else int(l["q_rural"]),
        })
    return {"referencia": beps["referencia"], "tipos": tipos}


def _uf_mes(u: dict) -> dict:
    return {
        "q": int(u["q"]), "v": r2(u["v"]), "medio": medio(u["v"], u["q"]),
        "q_urbana": int(u["q_urbana"]), "q_rural": int(u["q_rural"]),
        "medio_urbana": medio(u["v_urbana"], u["q_urbana"]), "medio_rural": medio(u["v_rural"], u["q_rural"]),
        "pct_rural": round(100 * u["q_rural"] / u["q"], 2) if u["q"] else None,
    }


def _ufs_mes(beps: dict) -> dict:
    t19 = beps["tabela19"]
    rgps15 = int(beps["tabela15"]["linhas"][1]["q"])
    ufs = [{"uf": s, "nome": F.NOME_UF[s], "regiao": F.REGIAO_UF[s], **_uf_mes(t19["ufs"][s])} for s in F.SIGLAS]
    return {
        "referencia": beps["referencia"],
        "brasil": _uf_mes(t19["brasil"]),
        "sem_localizacao": rgps15 - int(t19["brasil"]["q"]),
        "notas": t19.get("notas") or [],
        "ufs": ufs,
    }


def _serie(beps: dict) -> dict:
    s = beps["tabela14"]["serie"]
    g = lambda grupo, campo: [None if x[campo].get(grupo) is None else (int(x[campo][grupo]) if campo == "q" else r2(x[campo][grupo])) for x in s]
    return {
        "meses": [x["mes"] for x in s],
        "abono": [bool(x.get("abono")) for x in s],
        "q": {k: g(k, "q") for k in ("total", "rgps", "assist", "ble")},
        "v": {k: g(k, "v") for k in ("total", "rgps", "assist", "ble")},
    }


CAMPOS_Q_GOLD = ["total", "previdenciarios", "aposentadorias", "apo_idade", "apo_invalidez", "apo_tempo", "pensoes", "auxilios", "outros_prev", "assistenciais"]
CAMPOS_V_GOLD = ["total", "aposentadorias", "pensoes", "auxilios", "outros_prev", "assistenciais"]


def _linha_gold(linha) -> tuple[list, list]:
    """Do formato do seed para as listas da gold, na ordem de CAMPOS_Q_GOLD e CAMPOS_V_GOLD."""
    _nome, q, v, tq, tv, apos, prev = linha
    idade, inval, tempo, pens, aux, outros, assist = q
    va, vp, vx, vo, vs = v
    return [tq, prev, apos, idade, inval, tempo, pens, aux, outros, assist], [tv, va, vp, vx, vo, vs]


def _anual(mun: dict) -> tuple[dict, dict]:
    anos = [a["ano"] for a in mun["anos"]]
    por_uf: dict[str, dict[str, list]] = {s: {} for s in F.SIGLAS}
    brasil: dict[str, list] = {}
    municipios: dict[str, dict[str, dict]] = {s: {} for s in F.SIGLAS}
    for i, a in enumerate(mun["anos"]):
        soma_uf = {s: ([0] * len(CAMPOS_Q_GOLD), [0.0] * len(CAMPOS_V_GOLD)) for s in F.SIGLAS}
        soma_br = ([0] * len(CAMPOS_Q_GOLD), [0.0] * len(CAMPOS_V_GOLD))
        for cod, linha in a["municipios"].items():
            uf = F.UF_DO_PREFIXO[cod[:2]]
            q, v = _linha_gold(linha)
            for alvo in (soma_uf[uf], soma_br):
                for k, x in enumerate(q):
                    alvo[0][k] += x
                for k, x in enumerate(v):
                    alvo[1][k] += x
            m = municipios[uf].setdefault(cod, {"id": cod, "nome": linha[0], "q": [None] * len(anos), "v": [None] * len(anos)})
            m["nome"] = linha[0]  # o nome do ano mais recente
            m["q"][i] = q
            m["v"][i] = [r2(x) for x in v]
        for s in F.SIGLAS:
            por_uf[s][str(a["ano"])] = {"q": soma_uf[s][0], "v": [r2(x) for x in soma_uf[s][1]], "municipios": sum(1 for c in a["municipios"] if F.UF_DO_PREFIXO[c[:2]] == s)}
        brasil[str(a["ano"])] = {"q": soma_br[0], "v": [r2(x) for x in soma_br[1]], "municipios": len(a["municipios"])}
    anual = {
        "anos": anos,
        "campos_q": CAMPOS_Q_GOLD,
        "campos_v": CAMPOS_V_GOLD,
        "brasil": brasil,
        "ufs": por_uf,
    }
    arquivos = {}
    for s in F.SIGLAS:
        lista = sorted(municipios[s].values(), key=lambda m: m["nome"])
        arquivos[s] = {"versao": VERSAO, "uf": s, "nome_uf": F.NOME_UF[s], "anos": anos, "campos_q": CAMPOS_Q_GOLD, "campos_v": CAMPOS_V_GOLD, "municipios": lista}
    return anual, arquivos


def _primeiro_nao_zero(valores: list) -> int | None:
    for i, x in enumerate(valores):
        if x:
            return i
    return None


def _rgps(rtn: dict) -> dict:
    anos = rtn["anos"]
    L = rtn["linhas"]
    n = len(anos)

    def serie(chave):
        """Zero antes do primeiro ano com valor é linha ainda não segregada pelo Tesouro: vira ausência."""
        v = L[chave]
        ini = _primeiro_nao_zero(v)
        return [None if ini is None or i < ini else round(v[i], 1) for i in range(n)]

    out = {k: serie(k) for k in ("arrecadacao_urbana", "arrecadacao_rural", "beneficios_urbano", "beneficios_rural", "sentencas_urbano", "sentencas_rural", "bpc_rmv", "sentencas_bpc")}
    out["arrecadacao"] = [round(x, 1) for x in L["arrecadacao"]]
    out["beneficios"] = [round(x, 1) for x in L["beneficios"]]
    out["compensacao"] = [round(x, 1) for x in L["compensacao"]]
    out["despesa_total"] = [round(x, 1) for x in L["despesa_total"]]
    out["pib"] = [round(x, 1) for x in rtn["pib"]]
    # o resultado sai das parcelas como publicadas na gold (arredondadas a R$ 0,1 milhão): a diferença mostrada fecha com elas
    dif = lambda a, b, i: None if out[a][i] is None or out[b][i] is None else round(out[a][i] - out[b][i], 1)
    out["resultado"] = [dif("arrecadacao", "beneficios", i) for i in range(n)]
    out["resultado_urbano"] = [dif("arrecadacao_urbana", "beneficios_urbano", i) for i in range(n)]
    out["resultado_rural"] = [dif("arrecadacao_rural", "beneficios_rural", i) for i in range(n)]
    pct = lambda k: [None if out[k][i] is None else round(100 * (L[k][i] if k in L else out[k][i]) / rtn["pib"][i], 3) for i in range(n)]
    out["pct_pib"] = {k: pct(k) for k in ("arrecadacao", "beneficios", "resultado", "bpc_rmv")}
    out["pct_despesa_primaria"] = [round(100 * L["beneficios"][i] / L["despesa_total"][i], 2) for i in range(n)]
    out["anos"] = anos
    out["unidade"] = "R$ milhões correntes"
    out["inicio_divisao_urbana_rural"] = anos[_primeiro_nao_zero(L["beneficios_urbano"]) or 0]
    out["inicio_bpc"] = anos[_primeiro_nao_zero(L["bpc_rmv"]) or 0]
    out["inicio_sentencas"] = anos[_primeiro_nao_zero(L["sentencas_urbano"]) or 0]
    return out


def _fontes(beps: dict, mun: dict, rtn: dict) -> dict:
    return {
        "beps": {
            "orgao": F.ORGAO_MPS, "nome": F.NOME_BEPS, "edicao": beps.get("edicao"), "referencia": beps["referencia"],
            "url": beps["arquivo"].get("url"), "pagina": beps.get("pagina", F.PAGINA_BEPS), "sha256": beps["arquivo"].get("sha256"),
            "capturado_em": beps.get("capturado_em"),
            "tabelas": {"14": beps["tabela14"]["titulo"], "15": beps["tabela15"]["titulo"], "19": beps["tabela19"]["titulo"]},
        },
        "municipios": {
            "orgao": F.ORGAO_MPS, "nome": F.NOME_MUNICIPIOS, "pagina": mun.get("pagina", F.PAGINA_MUNICIPIOS),
            "referencia": f"{mun['anos'][-1]['ano']}-12", "capturado_em": mun.get("capturado_em"),
            "arquivos": [{"ano": a["ano"], "url": (a.get("arquivo") or {}).get("url"), "sha256": (a.get("arquivo") or {}).get("sha256")} for a in mun["anos"]],
        },
        "rtn": {
            "orgao": F.ORGAO_TESOURO, "nome": F.NOME_RTN, "edicao": rtn.get("edicao"), "publicado_em": rtn.get("publicado_em"),
            "url": (rtn.get("arquivo") or {}).get("url"), "pagina": F.PAGINA_RTN, "sha256": (rtn.get("arquivo") or {}).get("sha256"),
            "capturado_em": rtn.get("capturado_em"), "tabela": rtn.get("titulo"), "unidade": rtn.get("unidade"),
            "metodo_resultado": F.PAGINA_RESULTADO_RGPS,
        },
    }


def _sem_captura(obj):
    """Cópia sem datas de captura nem sha256 dos arquivos: o hash do dado não muda só porque a coleta rodou de novo."""
    if isinstance(obj, dict):
        return {k: _sem_captura(v) for k, v in obj.items() if k not in ("capturado_em", "sha256")}
    if isinstance(obj, list):
        return [_sem_captura(x) for x in obj]
    return obj


def construir(seeds: dict) -> tuple[dict, dict[str, dict]]:
    beps, mun, rtn = seeds["beps"], seeds["municipios"], seeds["rtn"]
    problemas = (
        [f"BEPS: {x}" for x in validar_beps(beps)]
        + [f"municípios: {x}" for x in validar_municipios(mun)]
        + [f"RTN: {x}" for x in validar_rtn(rtn)]
        + [f"cruzada: {x}" for x in validar_cruzado(beps, mun)]
    )
    if problemas:
        raise GoldInvalida("gold não publicada:\n- " + "\n- ".join(problemas[:40]))
    anual, por_uf = _anual(mun)
    gold = {
        "versao": VERSAO,
        "gerado_por": "pipeline/previdencia",
        "capturado_em": max(x for x in (beps.get("capturado_em"), mun.get("capturado_em"), rtn.get("capturado_em")) if x),
        "referencia": beps["referencia"],
        "fontes": _fontes(beps, mun, rtn),
        "brasil_mes": _brasil_mes(beps),
        "ufs_mes": _ufs_mes(beps),
        "serie": _serie(beps),
        "anual": anual,
        "municipios": {"anos": anual["anos"], "por_uf": {s: len(por_uf[s]["municipios"]) for s in F.SIGLAS}, "total": sum(len(por_uf[s]["municipios"]) for s in F.SIGLAS)},
        "rgps": _rgps(rtn),
    }
    corpo = json.dumps({"gold": _sem_captura(gold), "ufs": por_uf}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    gold["hash_dados"] = hashlib.sha256(corpo.encode("utf-8")).hexdigest()
    return gold, por_uf
