"""Métricas do piloto por ciclo e critério de degrau (piloto, PR 6).

Por ciclo (notas/AAAA-MM/metricas.json):
    tokens e modelo que respondeu, por papel (uso/*.json)
    rodadas de devolução do validador mecânico e decisão final; decisão constitucional
    concordância replicador × analistas: Jaccard dos cinco destaques e leitura por recorte
    decisão final e pareceres dos três revisores por rodada (decisao.json); concordância
    entre revisores; independência comprometida quando dois revisores foram servidos pelo
    mesmo modelo; erros factuais achados pelo auditor (auditoria.json)
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
N_MINIMO_DEGRAU_2 = 3  # constituição v2, art. 9.2
RECALL_SEMANTICO_MINIMO = 0.9
REVISORES = ["validador_constitucional", "revisor_independente", "terceiro_revisor"]
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


def revisores(ciclo):
    d = _json(os.path.join(ciclo, "decisao.json")) or {}
    rodadas = d.get("rodadas") or []
    pares = {}
    for a, b in ((REVISORES[0], REVISORES[1]), (REVISORES[0], REVISORES[2]), (REVISORES[1], REVISORES[2])):
        comuns = [r for r in rodadas if r.get(a) and r.get(b)]
        pares[f"{a}×{b}"] = (round(sum(r[a] == r[b] for r in comuns) / len(comuns), 4) if comuns else None)
    servidos = {}
    for p in glob.glob(os.path.join(ciclo, "uso", "*.json")):
        u = _json(p)
        if u.get("papel") in REVISORES and u.get("modelo_respondeu"):
            servidos.setdefault(u["papel"], set()).add(u["modelo_respondeu"])
    modelos = [m for ms in servidos.values() for m in ms]
    return {"decisao_final": d.get("decisao"), "rodadas": rodadas,
            "concordancia_entre_revisores": pares,
            "modelos_que_responderam": {k: sorted(v) for k, v in servidos.items()} or None,
            "independencia_comprometida": (len(modelos) != len(set(modelos))) if modelos else None}


def auditoria(ciclo):
    a = _json(os.path.join(ciclo, "auditoria.json"))
    if not a:
        return {"auditado": False, "erros_factuais": None}
    return {"auditado": True, "auditado_em": a.get("auditado_em"), "erros_factuais": len(a.get("erros_factuais") or []),
            "fatos_revisados_pela_fonte": a.get("fatos_revisados_pela_fonte")}


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
        "concordancia": concordancia(ciclo),
        "uso": uso(ciclo),
        "revisores": revisores(ciclo),
        "auditoria": auditoria(ciclo),
        "sentinelas": {"recall_total": bateria["recall_total"], "n_casos": bateria["n_casos"],
                       "recall_numerico": (round(sum(c["detectados"] for c in numericas) / sum(c["n"] for c in numericas), 4)
                                           if numericas else None),
                       "falso_bloqueio": bateria["falso_bloqueio"], "versao_validador": bateria["versao_validador"]},
    }


def ciclo_limpo(m):
    """Limpo = nota aprovada pelos três revisores e auditada sem erro factual. Ciclo ainda
    não auditado não conta (nem a favor, nem contra). Nota rejeitada não é erro: não saiu."""
    if m["revisores"]["decisao_final"] != "aprovada":
        return None
    if not m["auditoria"]["auditado"]:
        return None
    return m["auditoria"]["erros_factuais"] == 0 and not m["revisores"].get("independencia_comprometida")


def degrau(metricas_ciclos, reg=None, n_minimo=N_MINIMO_DEGRAU_2, semantica=None):
    """Degrau do tipo de nota (constituição v2, art. 9). Retrospectivos contam para os três
    ciclos; `semantica` é o resultado mais recente da bateria semântica dos revisores."""
    reg = reg or registro.carregar()
    ms = sorted(metricas_ciclos, key=lambda m: (m.get("data_base") or "", m.get("retrospectivo", False)))
    consecutivos = 0
    for m in reversed(ms):
        limpo = ciclo_limpo(m)
        if limpo is None:
            continue
        if not limpo:
            break
        consecutivos += 1
    rebaixado = registro.erro_relevante_publicado(reg, TIPO_NOTA)
    ult = ms[-1]["sentinelas"] if ms else None
    mecanica_ok = bool(ult and ult["recall_numerico"] == 1 and ult["falso_bloqueio"] == 0)
    atrib = (semantica or {}).get("recall_painel_atribuido")
    sem_ok = bool(semantica and (semantica.get("recall_painel") or 0) >= RECALL_SEMANTICO_MINIMO
                  and (atrib is None or atrib >= RECALL_SEMANTICO_MINIMO)
                  and semantica.get("rejeicao_indevida", 1) == 0)
    apto = consecutivos >= n_minimo and not rebaixado and mecanica_ok and sem_ok
    motivos = []
    if consecutivos < n_minimo:
        motivos.append(f"{consecutivos} de {n_minimo} ciclos aprovados e auditados sem erro factual")
    if rebaixado:
        motivos.append("erro relevante publicado no registro: rebaixado ao degrau 1")
    if not ult:
        motivos.append("bateria mecânica sem medida em ciclo (nenhum ciclo no formato da constituição v2)")
    elif not mecanica_ok:
        motivos.append("bateria mecânica abaixo do critério (recall numérico de 100% e zero falso bloqueio)")
    if not sem_ok:
        motivos.append(f"bateria semântica dos revisores abaixo do critério (painel pegando pelo menos "
                       f"{RECALL_SEMANTICO_MINIMO:.0%} dos erros plantados, também quando se exige que o parecer cite o "
                       f"trecho plantado, e zero rejeição indevida) ou não medida")
    return {"degrau": 2 if apto else 1, "ciclos_limpos_consecutivos": consecutivos, "n_minimo": n_minimo,
            "motivos_para_permanecer_no_1": motivos}


def main(argv=None):
    base = (argv or sys.argv[1:] or ["notas"])[0]
    ms = [_json(p) for p in sorted(glob.glob(os.path.join(base, "**", "metricas.json"), recursive=True))]
    ms = [m for m in ms if m]
    for m in [m for m in ms if "revisores" not in m]:
        print(f"{m['ciclo']:10s} base {m.get('data_base')}: formato anterior à constituição v2, não conta para degrau")
    ms = [m for m in ms if "revisores" in m]
    for m in ms:
        print(f"{m['ciclo']:10s} base {m['data_base']} retro={m['retrospectivo']} validador={m['validador_mecanico']['decisao_final']} "
              f"devoluções={m['validador_mecanico']['devolucoes']} decisão={m['revisores']['decisao_final']} "
              f"auditoria={m['auditoria']['erros_factuais']}")
    from pesquisa import sentinela_semantica  # importação tardia: o orquestrador importa este módulo
    print(json.dumps(degrau(ms, semantica=sentinela_semantica.ultimo_resultado()), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
