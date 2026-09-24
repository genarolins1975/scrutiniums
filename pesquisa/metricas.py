"""Métricas do piloto por ciclo e critério de degrau (piloto, PR 6).

Por ciclo (notas/AAAA-MM/metricas.json):
    tokens e modelo que respondeu, por papel (uso/*.json)
    rodadas de devolução do validador mecânico e decisão final; decisão constitucional
    concordância replicador × analistas: Jaccard dos cinco destaques e leitura por recorte
    minutos de editor e erros factuais que ele encontrou (editor.json)
    recall do validador na bateria sentinela e falso bloqueio

Nada aqui é estimado: campo sem dado fica null.

Uso: python3 -m pesquisa.metricas notas/            (resume todos os ciclos e o degrau)
"""
import datetime as dt
import glob
import json
import os
import re
import sys

from pesquisa import registro
from pesquisa import sentinela

TIPO_NOTA = "conjuntura"
N_MINIMO_DEGRAU_2 = 6  # proposta; o número vale quando o editor o fixar (constituição, art. 9)
CODIGOS_NUMERICOS = {"numero_digitado", "fato_inexistente", "pacote", "direcao", "recorte"}


def _json(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _texto(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return f.read()


def _linha(texto, chave):
    m = re.search(rf"^{chave}:\s*(.+)$", texto or "", flags=re.M)
    return m.group(1).strip() if m else None


def _ids(v):
    return {x.strip() for x in (v or "").split(",") if x.strip()}


def _jaccard(a, b):
    return round(len(a & b) / len(a | b), 4) if a and b else None


def concordancia(ciclo):
    rep = _texto(os.path.join(ciclo, "saidas", "replicador.md"))
    out = {}
    for recorte, etapa in (("familias", "analista_familias"), ("empresas", "analista_empresas")):
        ana = _texto(os.path.join(ciclo, "saidas", f"{etapa}.md"))
        d_a, d_r = _ids(_linha(ana, "DESTAQUES")), _ids(_linha(rep, f"DESTAQUES_{recorte.upper()}"))
        l_a, l_r = _linha(ana, "LEITURA"), _linha(rep, f"LEITURA_{recorte.upper()}")
        out[recorte] = {"jaccard_destaques": _jaccard(d_a, d_r),
                        "leitura_analista": l_a, "leitura_replicador": l_r,
                        "leitura_concorda": (l_a == l_r) if l_a and l_r else None}
    return out


def uso(ciclo):
    por_papel = {}
    for p in sorted(glob.glob(os.path.join(ciclo, "uso", "*.json"))):
        u = _json(p)
        x = por_papel.setdefault(u.get("papel", os.path.basename(p)[:-5]),
                                 {"chamadas": 0, "input_tokens": 0, "output_tokens": 0, "modelos": [], "fallbacks": 0})
        x["chamadas"] += 1
        x["input_tokens"] += u.get("input_tokens") or 0
        x["output_tokens"] += u.get("output_tokens") or 0
        if u.get("modelo_respondeu") and u["modelo_respondeu"] not in x["modelos"]:
            x["modelos"].append(u["modelo_respondeu"])
        x["fallbacks"] += 1 if u.get("fallback") else 0
    total = {"input_tokens": sum(x["input_tokens"] for x in por_papel.values()),
             "output_tokens": sum(x["output_tokens"] for x in por_papel.values())}
    return {"por_papel": por_papel, "total": total if por_papel else None,
            "nota": None if por_papel else "sem chamadas de API registradas (backend manual ou ciclo não executado)"}


def editor(ciclo):
    e = _json(os.path.join(ciclo, "editor.json")) or {}
    minutos = e.get("minutos")
    if minutos is None and e.get("inicio") and e.get("fim"):
        try:
            minutos = round((dt.datetime.fromisoformat(e["fim"]) - dt.datetime.fromisoformat(e["inicio"])).total_seconds() / 60, 1)
        except ValueError:
            minutos = None
    return {"minutos": minutos, "decisao": e.get("decisao"),
            "erros_factuais_encontrados": len(e.get("erros_factuais_encontrados") or []),
            "preenchido": e.get("decisao") is not None}


def do_ciclo(ciclo):
    estado = _json(os.path.join(ciclo, "estado.json")) or {}
    v = _json(os.path.join(ciclo, "validacao_mecanica.json")) or {}
    bateria = sentinela.rodar()
    numericas = [c for k, c in bateria["recall_por_categoria"].items() if k in CODIGOS_NUMERICOS]
    return {
        "ciclo": os.path.basename(os.path.normpath(ciclo)),
        "data_base": estado.get("data_base"),
        "retrospectivo": estado.get("retro", False),
        "validador_mecanico": {"decisao_final": v.get("decisao"), "falhas_finais": v.get("falhas"),
                               "devolucoes": estado.get("devolucoes"), "rodadas_revisao": estado.get("rodada_revisao")},
        "validador_constitucional": estado.get("decisao_constitucional"),
        "concordancia": concordancia(ciclo),
        "uso": uso(ciclo),
        "editor": editor(ciclo),
        "sentinelas": {"recall_total": bateria["recall_total"], "n_casos": bateria["n_casos"],
                       "recall_numerico": (round(sum(c["detectados"] for c in numericas) / sum(c["n"] for c in numericas), 4)
                                           if numericas else None),
                       "falso_bloqueio": bateria["falso_bloqueio"], "versao_validador": bateria["versao_validador"]},
    }


def ciclo_limpo(m):
    """Limpo = editor revisou, não achou erro factual que o validador deixou passar, e a nota
    não foi bloqueada no fim. Ciclo sem revisão do editor não conta (nem a favor, nem contra)."""
    if not m["editor"]["preenchido"]:
        return None
    return m["editor"]["erros_factuais_encontrados"] == 0 and m["validador_mecanico"]["decisao_final"] == "aprovar"


def degrau(metricas_ciclos, reg=None, n_minimo=N_MINIMO_DEGRAU_2):
    """Degrau em que o tipo de nota pode operar. Retrospectivos não contam para promoção."""
    reg = reg or registro.carregar()
    vivos = [m for m in sorted(metricas_ciclos, key=lambda m: m.get("data_base") or "") if not m.get("retrospectivo")]
    consecutivos = 0
    for m in reversed(vivos):
        limpo = ciclo_limpo(m)
        if limpo is None:
            continue
        if not limpo:
            break
        consecutivos += 1
    rebaixado = registro.erro_relevante_publicado(reg, TIPO_NOTA)
    ult = vivos[-1]["sentinelas"] if vivos else None
    sentinela_ok = bool(ult and ult["recall_numerico"] == 1 and ult["falso_bloqueio"] == 0 and ult["n_casos"] >= 50)
    apto = consecutivos >= n_minimo and not rebaixado and sentinela_ok
    motivos = []
    if consecutivos < n_minimo:
        motivos.append(f"{consecutivos} de {n_minimo} ciclos limpos consecutivos")
    if rebaixado:
        motivos.append("erro relevante publicado no registro: rebaixado ao degrau 1")
    if not sentinela_ok:
        motivos.append("bateria sentinela abaixo do critério (recall numérico de 100%, zero falso bloqueio, pelo menos 50 casos)")
    return {"degrau": 2 if apto else 1, "ciclos_limpos_consecutivos": consecutivos, "n_minimo": n_minimo,
            "motivos_para_permanecer_no_1": motivos}


def main(argv=None):
    base = (argv or sys.argv[1:] or ["notas"])[0]
    ms = [_json(p) for p in sorted(glob.glob(os.path.join(base, "**", "metricas.json"), recursive=True))]
    ms = [m for m in ms if m]
    for m in ms:
        print(f"{m['ciclo']:10s} base {m['data_base']} retro={m['retrospectivo']} validador={m['validador_mecanico']['decisao_final']} "
              f"devoluções={m['validador_mecanico']['devolucoes']} editor={m['editor']['minutos']} min")
    print(json.dumps(degrau(ms), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
