"""Gold do capítulo 7.1: série anual (DFP), série trimestral (ITR e DFP) e fotografia mais recente por companhia.

Lê só o seed versionado (sem rede), confere o sha256 de cada arquivo, refaz o universo a partir dos seeds do SINISA, do
FRE e do cadastro, valida cada demonstração usada e calcula os indicadores (indicadores.py). Reprovada qualquer
validação, levanta GoldInvalida e nada é gravado.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

from . import fontes as F
from . import indicadores as I
from . import universo as U
from . import validacoes as V

AQUI = Path(__file__).resolve().parent
SEED = AQUI / "seed"
CAMPOS_VALOR = (
    "ativo_total", "divida_bruta", "divida_cp", "divida_lp", "emprestimos", "debentures", "arrendamento", "caixa",
    "divida_liquida", "patrimonio_liquido", "ebitda", "despesas_financeiras",
)
CAMPOS_RAZAO = ("dl_ebitda", "dl_pl", "parcela_cp", "cobertura")


class GoldInvalida(Exception):
    pass


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def ler_seed(pasta: Path = SEED) -> dict:
    manifesto = json.loads((pasta / "manifesto.json").read_text(encoding="utf-8"))
    saida = {"manifesto": manifesto}
    for chave, a in manifesto["arquivos"].items():
        bruto = gzip.decompress((pasta / a["arquivo"]).read_bytes())
        if sha(bruto) != a["sha256"]:
            raise GoldInvalida(f"seed alterado: {a['arquivo']} não confere com o sha256 do manifesto")
        saida[chave] = list(csv.DictReader(io.StringIO(bruto.decode("utf-8")), delimiter=";"))
    return saida


def _registro(cadastro: list[dict], cnpj: str) -> dict:
    linhas = [r for r in cadastro if U.cnpj14(r["CNPJ_CIA"]) == cnpj]
    ativo = [r for r in linhas if r["SIT"] == "ATIVO"]
    r = (ativo or sorted(linhas, key=lambda x: x["DT_CANCEL"] or "")[-1:] or [{}])[0]
    return {
        "denominacao": r.get("DENOM_SOCIAL") or None,
        "cd_cvm": r.get("CD_CVM") or None,
        "situacao": r.get("SIT") or None,
        "cancelado_em": (r.get("DT_CANCEL") or None) if not ativo else None,
        "setor": r.get("SETOR_ATIV") or None,
    }


def _documento(docs: list[dict], cnpj: str, fonte: str, data: str) -> dict | None:
    d = [x for x in docs if x["CNPJ_CIA"] == cnpj and x["fonte"] == fonte and x["DT_REFER"] == data]
    if not d:
        return None
    x = max(d, key=lambda y: int(y["VERSAO"]))
    return {"versao": int(x["VERSAO"]), "recebido_em": x["DT_RECEB"], "link": x["LINK_DOC"]}


def _arred(p: dict) -> dict:
    out = dict(p)
    for c in CAMPOS_VALOR:
        if out.get(c) is not None:
            out[c] = round(out[c], 3)
    for c in CAMPOS_RAZAO:
        if out.get(c) is not None:
            out[c] = round(out[c], 4)
    return out


def _retido(data: str, periodo: str, fonte: str, escopo: str, problemas: list) -> dict:
    motivo = "demonstração publicada inconsistente, ponto fora da série: " + "; ".join(m for _t, m in problemas)
    p = {c: None for c in CAMPOS_VALOR + CAMPOS_RAZAO}
    p.update({"data": data, "periodo": periodo, "fonte": fonte, "escopo": escopo, "retido": motivo, "sem_abertura": [], "motivos": {}})
    return p


def construir(seed: dict, recalcular_universo: bool = False) -> tuple[dict, dict[str, list[list]]]:
    """Gold e linhas dos CSV a partir do seed.

    O universo fica congelado no manifesto da coleta. `recalcular_universo=True` (usado logo depois da coleta) confere
    que ele é o que os seeds atuais do SINISA, do FRE e do cadastro produzem; a reconstrução comum não o refaz, para
    que uma recoleta do capítulo 7 (FRE) ou do SINISA não invalide esta publicação até a próxima coleta trimestral."""
    m = seed["manifesto"]
    universo = m["universo"]
    g = I.agrupar(seed["demonstracoes"])
    problemas: list[str] = []

    if recalcular_universo:
        docs_fre, pos_fre = U.ler_fre()
        cands = U.candidatos(U.declarados(), U.controladores_pj(docs_fre, pos_fre), seed["cadastro"])
        # o seed guarda só as linhas do universo: presença na base é ter linha no seed
        recalc = U.universo(cands, {k[0] for k in g})
    else:
        recalc = universo
    problemas += V.validar_universo(universo, recalc, g)

    nome = {u["cnpj"]: F.NOME_CURTO.get(u["cnpj"]) or _registro(seed["cadastro"], u["cnpj"])["denominacao"] or u["cnpj"] for u in universo}
    inconsistencias, exclusoes, companhias = [], [], []
    for u in universo:
        c = u["cnpj"]
        reg = _registro(seed["cadastro"], c)
        anuais, trimestrais = [], []
        for fonte, datas in (("DFP", I.datas(g, c, "DFP")), ("ITR", I.datas(g, c, "ITR"))):
            for data in datas:
                esc = I.escopo_da_data(g, c, fonte, data)
                if esc is None:
                    continue
                if fonte == "DFP" and not data.endswith("-12-31"):
                    exclusoes.append({"cnpj": U.cnpj_fmt(c), "nome": nome[c], "fonte": fonte, "data": data,
                                      "motivo": "DFP com exercício encerrado fora de 31 de dezembro: fora das séries anual e trimestral"})
                    continue
                periodo = data[:4] if fonte == "DFP" else I.trimestre_de(data)
                probs = V.validar_bloco((c, fonte, data, esc), g[(c, fonte, data, esc)])
                if probs and V.aceito((c, fonte, data, esc), probs):
                    x = _retido(data, periodo, fonte, esc, probs)
                    inconsistencias.append({"cnpj": U.cnpj_fmt(c), "nome": nome[c], "fonte": fonte, "data": data, "motivo": x["retido"]})
                elif probs:
                    problemas += [f"{nome[c]} {fonte} {data} ({esc}): {msg}" for _t, msg in probs]
                    continue
                else:
                    x = I.anual(g, c, data) if fonte == "DFP" else I.trimestral(g, c, data)
                x["documento"] = _documento(seed["documentos"], c, fonte, data)
                if fonte == "DFP":
                    anuais.append(_arred(x))
                    q = dict(x)
                    q["periodo"] = I.trimestre_de(data)
                    trimestrais.append(_arred(q))
                else:
                    trimestrais.append(_arred(x))
        trimestrais.sort(key=lambda p: p["data"])
        anuais.sort(key=lambda p: p["data"])
        validos = [p for p in trimestrais if not p.get("retido")]
        companhias.append({
            "cnpj": U.cnpj_fmt(c),
            "nome": nome[c],
            "papel": u["papel"],
            "municipios_declarados": u["municipios_declarados"],
            "holdings": [{"cnpj": U.cnpj_fmt(h), "nome": nome[h]} for h in u["holdings"]],
            "controladas": [{"cnpj": U.cnpj_fmt(h), "nome": nome[h]} for h in u["controladas"]],
            "registro": reg,
            "primeiro_periodo": trimestrais[0]["periodo"] if trimestrais else None,
            "ultimo": validos[-1] if validos else None,
            "anual": anuais,
            "trimestral": trimestrais,
        })
    problemas += V.validar_pontos(companhias)
    if problemas:
        raise GoldInvalida("publicação retida:\n- " + "\n- ".join(problemas[:60]))

    cnpjs = {u["cnpj"] for u in universo}
    ultima_dfp = V.ultima_dfp(g, cnpjs)
    datas_tri = sorted({p["data"] for c in companhias for p in c["trimestral"] if not p.get("retido")})
    ativos = [c for c in companhias if c["registro"]["situacao"] == "ATIVO"]
    referencia = max((d for d in datas_tri if sum(1 for c in ativos if any(p["data"] == d for p in c["trimestral"])) * 2 >= len(ativos)), default=None)
    companhias.sort(key=lambda c: (c["papel"] != "operadora", -(c["ultimo"]["divida_bruta"] or 0) if c["ultimo"] else 0, c["nome"]))

    fora = []
    for r in seed["cadastro"]:
        c = U.cnpj14(r["CNPJ_CIA"])
        if c in cnpjs or F.SETOR_SANEAMENTO not in r["SETOR_ATIV"] or any(f["cnpj"] == U.cnpj_fmt(c) for f in fora):
            continue
        fora.append({"cnpj": U.cnpj_fmt(c), "denominacao": r["DENOM_SOCIAL"], "setor": r["SETOR_ATIV"], "situacao": r["SIT"],
                     "motivo": "não declarada por município como prestadora de água ou esgoto no SINISA 2024 nem controladora de uma prestadora declarada"})
    fora.sort(key=lambda f: f["denominacao"])

    dados = {
        "referencia_trimestral": referencia,
        "ultima_dfp": ultima_dfp,
        "companhias": companhias,
        "inconsistencias": inconsistencias,
        "exclusoes": exclusoes,
        "fora_do_recorte": fora,
    }
    hash_dados = sha(json.dumps(dados, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    gold = {
        "versao": 1,
        "unidade": "mil reais nominais (valores da data ou do período, sem correção pela inflação); razões em vezes; parcela em %",
        "capturado_em": m["capturado_em"],
        "hash_dados": hash_dados,
        "fontes": {
            "cadastro": {**m["cadastro"], "pagina": F.PAGINA_CADASTRO},
            "dfp": {"pagina": F.PAGINA_DFP, "primeiro_ano": F.PRIMEIRO_ANO_DFP, "arquivos": _originais(m, "DFP")},
            "itr": {"pagina": F.PAGINA_ITR, "primeiro_ano": F.PRIMEIRO_ANO_ITR, "arquivos": _originais(m, "ITR")},
        },
        "criterio": m["criterio"],
        **dados,
    }
    return gold, csvs(companhias)


def resumo(g: dict) -> dict:
    """Contagens e datas da publicação, sem série nem valor de companhia (lidas pela página aberta do Saneamento)."""
    com_ponto = [c for c in g["companhias"] if c["ultimo"]]
    anuais = [p["periodo"] for c in com_ponto for p in c["anual"] if not p.get("retido")]
    return {
        "capturado_em": g["capturado_em"],
        "companhias": len(com_ponto),
        "operadoras": sum(1 for c in com_ponto if c["papel"] == "operadora"),
        "holdings": sum(1 for c in com_ponto if c["papel"] == "holding"),
        "primeiro_ano": min(anuais) if anuais else None,
        "ultima_dfp": g["ultima_dfp"],
        "referencia_trimestral": g["referencia_trimestral"],
        "hash_dados": g["hash_dados"],
    }


def _originais(m: dict, fonte: str) -> list[dict]:
    """Arquivos originais da fonte, sem a lista de membros (que fica no manifesto do seed)."""
    return [{k: v for k, v in o.items() if k != "membros"} for o in m["originais"] if o["fonte"] == fonte]


CAB_CSV = [
    "cnpj", "companhia", "papel", "periodo", "data_referencia", "fonte", "demonstracao", "versao_documento",
    "divida_bruta_mil_reais", "divida_ate_12_meses_mil_reais", "divida_apos_12_meses_mil_reais", "emprestimos_financiamentos_mil_reais",
    "debentures_mil_reais", "arrendamento_fora_da_divida_mil_reais", "caixa_aplicacoes_mil_reais", "divida_liquida_mil_reais",
    "patrimonio_liquido_mil_reais", "ebitda_mil_reais", "base_ebitda", "despesas_financeiras_mil_reais", "divida_liquida_sobre_ebitda_vezes",
    "divida_liquida_sobre_pl_vezes", "parcela_ate_12_meses_pct", "cobertura_despesas_financeiras_vezes", "linha_sem_abertura", "ausencias_e_motivos",
]


def _linha(c: dict, p: dict, serie: str) -> list:
    esc = {"con": "consolidada", "ind": "individual"}[p["escopo"]]
    base = "exercício" if serie == "anual" or p["fonte"] == "DFP" else "12 meses"
    if p.get("inicio_resultado") and not p["inicio_resultado"].endswith("-01-01"):
        base = f"de {p['inicio_resultado']} a {p['data']}"
    motivos = p.get("retido") or "; ".join(f"{k}: {v}" for k, v in sorted(p["motivos"].items()))
    return [
        c["cnpj"], c["nome"], c["papel"], p["periodo"], p["data"], p["fonte"], esc, (p.get("documento") or {}).get("versao"),
        p["divida_bruta"], p["divida_cp"], p["divida_lp"], p["emprestimos"], p["debentures"], p["arrendamento"], p["caixa"],
        p["divida_liquida"], p["patrimonio_liquido"], p["ebitda"], base, p["despesas_financeiras"], p["dl_ebitda"], p["dl_pl"],
        p["parcela_cp"], p["cobertura"], ",".join(p["sem_abertura"]), motivos,
    ]


def csvs(companhias: list[dict]) -> dict[str, list[list]]:
    return {
        "anual": [_linha(c, p, "anual") for c in companhias for p in c["anual"]],
        "trimestral": [_linha(c, p, "trimestral") for c in companhias for p in c["trimestral"]],
    }


def csv_texto(linhas: list[list]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(CAB_CSV)
    def fmt(v):
        if v is None:
            return ""
        if isinstance(v, float):
            return str(int(v)) if v.is_integer() else f"{v}".replace(".", ",")
        return v

    for l in linhas:
        w.writerow([fmt(v) for v in l])
    return "﻿" + buf.getvalue()
