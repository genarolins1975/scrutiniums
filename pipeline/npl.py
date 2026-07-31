"""Painel de inadimplência por instituição financeira (v0.16).

Fonte: IF.data — relatório "Carteira de crédito ativa por carteiras de instrumentos
financeiros" (estrutura Res. 4.966, vigente desde 2025-03): carteira inadimplente (>90d),
ativos problemáticos e total geral por conglomerado prudencial; provisões (perda esperada
de operações de crédito) do relatório Ativo. Trimestral; nossa amostra INICIA já na nova
metodologia (2025-T1) — não há quebra interna, e isso é declarado.

Regras analíticas de tendência (parametrizáveis; NÃO são limites regulatórios):
melhora < -0,20 p.p. em 4 trimestres; estável ±0,20; piora moderada +0,20 a +0,50;
piora relevante > +0,50.
"""
from pipeline import common
from pipeline.indicators import PEER_GROUP_LABELS

TREND_RULES = {"melhora": -0.20, "estavel_max": 0.20, "piora_moderada_max": 0.50}


def _percentil(vals, v):
    if not vals or v is None:
        return None
    below = sum(1 for x in vals if x < v)
    return round(below / max(len(vals) - 1, 1) * 100, 1)


def _med(vals):
    if not vals:
        return None
    sv = sorted(vals)
    return sv[len(sv) // 2]


def _quart(vals):
    if len(vals) < 8:
        return None
    sv = sorted(vals)
    return {"q1": round(sv[len(sv) // 4], 2), "mediana": round(sv[len(sv) // 2], 2),
            "q3": round(sv[3 * len(sv) // 4], 2)}


def tendencia(d_ano):
    if d_ano is None:
        return "histórico insuficiente"
    if d_ano < TREND_RULES["melhora"]:
        return "melhora"
    if d_ano <= TREND_RULES["estavel_max"]:
        return "estável"
    if d_ano <= TREND_RULES["piora_moderada_max"]:
        return "piora moderada"
    return "piora relevante"


def build(con, cfg):
    periods = [r[0] for r in con.execute(
        "SELECT DISTINCT anomes FROM institution_metrics WHERE metric='qual:inadimplencia_brl' ORDER BY anomes").fetchall()]
    if not periods:
        return {"ok": False, "motivo": "qualidade da carteira ainda não coletada"}
    anomes = periods[-1]
    lbl = {"202603": "2026-T1", "202512": "2025-T4", "202509": "2025-T3",
           "202506": "2025-T2", "202503": "2025-T1"}

    hist = {}
    for cod, a, m, v in con.execute(
            """SELECT cod_inst, anomes, metric, value FROM institution_metrics
               WHERE metric LIKE 'qual:%' ORDER BY anomes""").fetchall():
        hist.setdefault(cod, {}).setdefault(m, {})[a] = v
    cad = {r[0]: {"name": r[1], "sr": r[2] or "S?"} for r in
           con.execute("SELECT cod_inst, name, sr FROM institutions").fetchall()}

    insts = []
    for cod, mets in hist.items():
        inad = mets.get("qual:inadimplencia_brl", {})
        tot = mets.get("qual:carteira_total_geral_brl", {})
        if anomes not in inad or anomes not in tot or tot[anomes] < 1e7:
            continue
        serie = []
        for a in periods:
            if a in inad and a in tot and tot[a] > 0:
                serie.append({"p": lbl.get(a, a), "anomes": a,
                              "inad_pct": round(inad[a] / tot[a] * 100, 2),
                              "carteira_brl": tot[a]})
        if not serie:
            continue
        atual = serie[-1]
        d_tri = round(atual["inad_pct"] - serie[-2]["inad_pct"], 2) if len(serie) > 1 else None
        d_ano = round(atual["inad_pct"] - serie[0]["inad_pct"], 2) if len(serie) >= 5 else None
        cresc = (round((atual["carteira_brl"] / serie[0]["carteira_brl"] - 1) * 100, 1)
                 if len(serie) >= 5 and serie[0]["carteira_brl"] else None)
        prob = mets.get("qual:ativos_problematicos_brl", {}).get(anomes)
        prov = mets.get("qual:provisao_credito_brl", {}).get(anomes)
        prov_ant = mets.get("qual:provisao_credito_brl", {}).get(periods[-2]) if len(periods) > 1 else None
        inad_ant = inad.get(periods[-2])
        cobertura = round(prov / inad[anomes] * 100, 1) if prov and inad[anomes] > 0 else None
        cobertura_ant = (round(prov_ant / inad_ant * 100, 1)
                         if prov_ant and inad_ant and inad_ant > 0 else None)
        insts.append({
            "cod_inst": cod, "nome": (cad.get(cod, {}).get("name") or cod)[:44],
            "grupo": cad.get(cod, {}).get("sr", "S?"),
            "inad_pct": atual["inad_pct"], "d_tri_pp": d_tri, "d_ano_pp": d_ano,
            "tendencia": tendencia(d_ano),
            "carteira_brl": atual["carteira_brl"], "cresc_carteira_4t_pct": cresc,
            "ativos_problematicos_pct": round(prob / tot[anomes] * 100, 2) if prob else None,
            "cobertura_pct": cobertura,
            "d_cobertura_pp": (round(cobertura - cobertura_ant, 1)
                               if cobertura is not None and cobertura_ant is not None else None),
            "serie": serie,
        })

    # estatísticas por grupo e sistema (mediana, nunca média ponderada)
    grupos = {}
    for i in insts:
        grupos.setdefault(i["grupo"], []).append(i)
    gstats = {}
    for g, mem in grupos.items():
        vals = [m["inad_pct"] for m in mem]
        gstats[g] = {"label": PEER_GROUP_LABELS.get(g, g), "n": len(mem),
                     "mediana": round(_med(vals), 2) if vals else None,
                     "quartis": _quart(vals),
                     "valores": [round(v, 2) for v in sorted(vals)][:600]}
    for i in insts:
        vals = [m["inad_pct"] for m in grupos[i["grupo"]]]
        i["mediana_pares"] = round(_med(vals), 2)
        i["percentil_pares"] = _percentil(vals, i["inad_pct"])
        # matriz crescimento × inadimplência (quadrante)
        if i["cresc_carteira_4t_pct"] is not None and i["d_ano_pp"] is not None:
            cvals = [m["cresc_carteira_4t_pct"] for m in grupos[i["grupo"]]
                     if m["cresc_carteira_4t_pct"] is not None]
            alto = i["cresc_carteira_4t_pct"] > (_med(cvals) or 0)
            piora = i["d_ano_pp"] > TREND_RULES["estavel_max"]
            i["quadrante"] = (("crescimento acima da mediana" if alto else "crescimento abaixo da mediana")
                              + " + " + ("inadimplência em alta" if piora else
                                         "inadimplência em queda" if i["d_ano_pp"] < TREND_RULES["melhora"] else "inadimplência estável"))
        # alertas institucionais (§10)
        al = []
        if i["d_tri_pp"] is not None and i["d_tri_pp"] > 0.5:
            al.append({"regra": "Δ trimestral > 0,50 p.p.", "valor": i["d_tri_pp"], "severidade": "atencao"})
        if i["d_ano_pp"] is not None and i["d_ano_pp"] > 1.0:
            al.append({"regra": "Δ em 4 trimestres > 1,00 p.p.", "valor": i["d_ano_pp"], "severidade": "relevante"})
        if i["percentil_pares"] is not None and i["percentil_pares"] >= 90 and len(grupos[i["grupo"]]) >= 10:
            al.append({"regra": "percentil >= 90 no grupo de pares", "valor": i["percentil_pares"], "severidade": "atencao"})
        if (i["cresc_carteira_4t_pct"] is not None and i["d_ano_pp"] is not None):
            cvals = sorted(m["cresc_carteira_4t_pct"] for m in grupos[i["grupo"]]
                           if m["cresc_carteira_4t_pct"] is not None)
            p75 = cvals[3 * len(cvals) // 4] if len(cvals) >= 8 else None
            if p75 is not None and i["cresc_carteira_4t_pct"] > p75 and i["d_ano_pp"] > 0.5:
                al.append({"regra": "crescimento > p75 dos pares E Δinad 12m > 0,50 p.p.",
                           "valor": i["cresc_carteira_4t_pct"], "severidade": "relevante"})
        if (i["d_cobertura_pp"] is not None and i["d_cobertura_pp"] < 0
                and i["d_tri_pp"] is not None and i["d_tri_pp"] > 0):
            al.append({"regra": "cobertura caiu com inadimplência subindo", "valor": i["d_cobertura_pp"], "severidade": "atencao"})
        i["alertas"] = al

    com_dano = [i for i in insts if i["d_ano_pp"] is not None]
    up_tri = sum(1 for i in insts if (i["d_tri_pp"] or 0) > 0)
    up_ano = sum(1 for i in com_dano if i["d_ano_pp"] > 0)
    det = sorted(com_dano, key=lambda i: -i["d_ano_pp"])[:5]
    mel = sorted(com_dano, key=lambda i: i["d_ano_pp"])[:5]
    todas_inad = sorted(i["inad_pct"] for i in insts)
    disp = _quart([i["inad_pct"] for i in insts])

    # frases determinísticas (§5) — cada uma com regra e base
    frases = []
    for g in ("S1", "S2", "S3"):
        gs = gstats.get(g)
        if gs:
            n_up = sum(1 for i in grupos[g] if (i["d_tri_pp"] or 0) > 0)
            frases.append({"texto": f"{n_up} das {gs['n']} instituições do grupo {g} apresentaram aumento da inadimplência no trimestre.",
                           "regra": "contagem de Δ trimestral > 0", "base": f"IF.data {lbl.get(anomes)}"})
    combo = [i for i in insts if (i["cresc_carteira_4t_pct"] or 0) > 15 and (i["d_ano_pp"] or 0) > 0.5]
    if combo:
        frases.append({"texto": f"{len(combo)} instituições combinaram crescimento da carteira acima de 15% em 4 trimestres com aumento de inadimplência superior a 0,5 p.p.",
                       "regra": "crescimento_4T > 15% E Δinad_4T > 0,5 p.p.", "base": f"IF.data {lbl.get(anomes)}"})

    return {
        "ok": True, "tipo": "OBSERVADO REGULATÓRIO (razões CALCULADAS)",
        "anomes": anomes, "data_base": lbl.get(anomes, anomes),
        "nivel_consolidacao": "conglomerado prudencial (IF.data tipo 2)",
        "n_instituicoes": len(insts),
        "sistema": {"mediana_inad_pct": round(_med(todas_inad), 2), "dispersao_quartis": disp,
                    "subindo_no_trimestre": up_tri, "subindo_em_4_trimestres": up_ano,
                    "com_historico_4t": len(com_dano)},
        "grupos": gstats,
        "top_deterioracoes": [{k: i[k] for k in ("cod_inst", "nome", "grupo", "inad_pct", "d_ano_pp",
                                                 "cresc_carteira_4t_pct", "d_cobertura_pp", "tendencia")} for i in det],
        "top_melhoras": [{k: i[k] for k in ("cod_inst", "nome", "grupo", "inad_pct", "d_ano_pp",
                                            "cresc_carteira_4t_pct", "d_cobertura_pp", "tendencia")} for i in mel],
        "frases": frases,
        "instituicoes": sorted(insts, key=lambda i: -i["carteira_brl"]),
        "regras_tendencia": TREND_RULES,
        "metodo": "Inadimplência = carteira com atraso >90d ÷ carteira ativa total (relatório por instrumentos "
                  "financeiros, Res. 4.966); cobertura contábil aproximada = perda esperada de operações de "
                  "crédito ÷ carteira inadimplente. Medianas simples por grupo prudencial (nunca média "
                  "ponderada). Tendência por regras analíticas parametrizáveis — não são limites regulatórios.",
        "limitacoes": "Estrutura vigente desde 2025-03: o histórico disponível começa na nova metodologia "
                      "(sem quebra interna; máximo 5 trimestres — máx/mín de 3 anos indisponível e declarado). "
                      "Cobertura usa provisão total de crédito (inclui perdas esperadas de operações em dia) — "
                      "não é razão regulatória. Sem decomposição de inadimplência por modalidade/instituição "
                      "neste corte público. Inadimplência isolada NÃO mede solvência.",
    }
