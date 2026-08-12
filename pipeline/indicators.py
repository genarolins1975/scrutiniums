"""Indicadores sintéticos: IBCC, estresse setorial, score de instituições, qualidade.

Todos explicáveis: cada saída inclui componentes, contribuições e limitações.
"""
import json
import math
from datetime import date

from pipeline import common


def _mean_std(vals):
    m = sum(vals) / len(vals)
    var = sum((v - m) ** 2 for v in vals) / max(len(vals) - 1, 1)
    return m, math.sqrt(var)


def _zscore_series(series):
    """series: [(date, value)] -> dict date->z, usando média/desvio da amostra completa."""
    vals = [v for _, v in series]
    if len(vals) < 24:
        return None
    m, s = _mean_std(vals)
    if s < 1e-9:
        return None
    return {d: (v - m) / s for d, v in series}


def _yoy(series):
    """Variação interanual % a partir de [(date, value)] mensal."""
    by_date = dict(series)
    out = []
    for d, v in series:
        y, m, dd = d.split("-")
        prev = f"{int(y)-1:04d}-{m}-{dd}"
        if prev in by_date and abs(by_date[prev]) > 1e-9:
            out.append((d, (v / by_date[prev] - 1) * 100))
    return out


def _transform(con, spec):
    """Resolve 'key', 'key:yoy', 'key:inv', 'key:yoy_real' em série [(date, value)]."""
    parts = spec.split(":")
    key, op = parts[0], (parts[1] if len(parts) > 1 else None)
    s = common.get_series(con, key)
    if not s:
        return None, key, op
    if op == "yoy":
        s = _yoy(s)
    elif op == "inv":
        s = [(d, -v) for d, v in s]
    elif op == "yoy_real":
        ipca = common.get_series(con, "ipca")
        # deflaciona yoy nominal pelo IPCA acumulado 12m
        acc = {}
        for i in range(12, len(ipca)):
            fator = 1.0
            for j in range(i - 11, i + 1):
                fator *= 1 + ipca[j][1] / 100
            acc[ipca[i][0]] = (fator - 1) * 100
        nom = _yoy(s)
        s = [(d, ((1 + v / 100) / (1 + acc[d] / 100) - 1) * 100) for d, v in nom if d in acc]
    return s, key, op


# variantes segmentadas do IBCC: mesmas regras, séries do segmento correspondente.
# PJ não possui séries públicas de capacidade de pagamento equivalentes ao SGS 29034/29037 —
# a versão PJ omite esse componente (documentado no payload).
IBCC_SEGMENT_COMPONENTS = {
    "pf": {
        "preco": {"series": ["taxa_pf", "spread_pf"], "invert": True, "label": "Preço do crédito (PF)"},
        "qualidade": {"series": ["inad_pf"], "invert": True, "label": "Qualidade da carteira (PF)"},
        "capacidade": {"series": ["comprometimento", "endividamento"], "invert": True, "label": "Capacidade de pagamento"},
        "atividade": {"series": ["ibc_br:yoy", "desemprego:inv"], "invert": False, "label": "Atividade econômica"},
        "oferta": {"series": ["concessoes_pf:yoy_real"], "invert": False, "label": "Oferta de crédito (PF)"},
        "antecedentes": {"series": ["papelao:yoy"], "invert": False, "label": "Indicadores antecedentes"},
    },
    "pj": {
        "preco": {"series": ["taxa_pj", "spread_pj"], "invert": True, "label": "Preço do crédito (PJ)"},
        "qualidade": {"series": ["inad_pj"], "invert": True, "label": "Qualidade da carteira (PJ)"},
        "atividade": {"series": ["ibc_br:yoy", "desemprego:inv"], "invert": False, "label": "Atividade econômica"},
        "oferta": {"series": ["concessoes_pj:yoy_real"], "invert": False, "label": "Oferta de crédito (PJ)"},
        "antecedentes": {"series": ["papelao:yoy"], "invert": False, "label": "Indicadores antecedentes"},
    },
}


def build_ibcc(con, cfg, components=None, segment="total"):
    """IBCC = média dos z-scores por componente, reescalada para base 100 (+10 por z).
    `components` permite variantes segmentadas (PF/PJ) com o mesmo método."""
    comps_cfg = components or cfg["ibcc"]["components"]
    comp_z = {}       # comp -> {date: mean_z}
    comp_detail = {}
    for comp, spec in comps_cfg.items():
        zs = []
        used = []
        for serie_spec in spec["series"]:
            s, key, op = _transform(con, serie_spec)
            if not s:
                continue
            z = _zscore_series(s)
            if z:
                sign = -1 if spec.get("invert") else 1
                zs.append({d: sign * v for d, v in z.items()})
                used.append(serie_spec)
        if not zs:
            continue
        dates = set(zs[0])
        for z in zs[1:]:
            dates &= set(z)
        comp_z[comp] = {d: sum(z[d] for z in zs) / len(zs) for d in dates}
        comp_detail[comp] = {"label": spec["label"], "series_usadas": used, "invertido": bool(spec.get("invert"))}

    if not comp_z:
        return {"ok": False}
    common_dates = None
    for z in comp_z.values():
        common_dates = set(z) if common_dates is None else common_dates & set(z)
    common_dates = sorted(common_dates)[-120:]
    base = cfg["ibcc"]["base_value"]
    serie = []
    for d in common_dates:
        vals = {c: z[d] for c, z in comp_z.items()}
        idx = base + 10 * (sum(vals.values()) / len(vals))
        serie.append({"ref": d, "valor": round(idx, 2),
                      "contribuicoes": {c: round(10 * v / len(vals), 2) for c, v in vals.items()}})
    last = serie[-1]
    prev3 = serie[-4]["valor"] if len(serie) > 3 else last["valor"]
    fase = ("expansão" if last["valor"] >= base and last["valor"] >= prev3 else
            "desaceleração" if last["valor"] >= base else
            "recuperação" if last["valor"] < base and last["valor"] > prev3 else "contração")
    return {
        "ok": True, "tipo": "DADO CALCULADO", "segmento": segment,
        "serie": serie, "componentes": comp_detail,
        "atual": last, "fase_ciclo": fase,
        "metodo": "Z-score de cada série vs. histórico completo; média por componente; média igual entre componentes; índice = 100 + 10×z médio. Acima de 100 = condições melhores que a média histórica.",
        "limitacoes": ("Pesos iguais entre componentes (versão explicável); PCA/fatores dinâmicos previstos na Fase 2. Sujeito a revisões das séries de origem."
                       + (" Versão PJ sem componente de capacidade de pagamento (não há série pública equivalente ao SGS 29034/29037 para PJ)." if segment == "pj" else "")),
    }


CNAE_SECAO_MAP = {  # PIM cobre indústria; mapeamos atividades PIM para rótulos setoriais
    "129314": ("industria_geral", "Indústria geral"),
    "129315": ("extrativa", "Indústrias extrativas"),
    "129316": ("transformacao", "Indústrias de transformação"),
}


def build_sector_stress(con, cfg, rj_demo):
    """Estresse setorial 0-100 com 4 componentes (atividade e condições de crédito observados;
    capacidade financeira e estresse empresarial demonstrativos), separando nível, tendência
    e velocidade de deterioração."""
    # condições de crédito PJ (observadas, comuns a todos os setores no MVP — corte setorial na Fase 1)
    cred_z = 0.0
    cred_detail = "indisponível"
    inad_pj = common.get_series(con, "inad_pj")
    spread_pj = common.get_series(con, "spread_pj")
    zs = []
    for s in (inad_pj, spread_pj):
        z = _zscore_series(s) if s else None
        if z:
            zs.append(z[max(z)])
    if zs:
        cred_z = sum(zs) / len(zs)
        cred_detail = f"média dos z-scores de inadimplência PJ e spread PJ (comum a todos os setores no MVP)"

    cur = con.execute("SELECT key, name FROM series_meta WHERE key LIKE 'pim_%'")
    sectors = []
    for key, name in cur.fetchall():
        s = common.get_series(con, key)
        if len(s) < 30:
            continue
        yoy = _yoy(s)
        if len(yoy) < 8:
            continue
        z = _zscore_series(yoy)
        if not z:
            continue
        atividade_z = -z[max(z)]  # queda de produção => estresse
        trend_3m = yoy[-1][1] - yoy[-4][1]                      # tendência: Δ do yoy em 3m
        trend_prev = yoy[-4][1] - yoy[-7][1]
        velocity = trend_3m - trend_prev                        # velocidade: aceleração da tendência
        short = name.replace("PIM-PF (2022=100) — ", "")
        code = key.replace("pim_", "")
        demo_comp = rj_demo["componentes_setoriais"].get(
            "B" if "extrativa" in short.lower() else "C", {"rj_z": 0.5, "emprego_z": 0.0})
        comps = {
            "atividade": {"z": round(atividade_z, 2), "peso": 0.45, "fonte": "IBGE PIM-PF", "status": "observado"},
            "condicoes_credito": {"z": round(cred_z, 2), "peso": 0.20, "fonte": "BCB/SGS (inad. e spread PJ)", "status": "observado", "nota": cred_detail},
            "estresse_empresarial": {"z": demo_comp["rj_z"], "peso": 0.20, "fonte": "DEMONSTRATIVO (RJ)", "status": "demonstrativo"},
            "capacidade_financeira": {"z": round(-demo_comp["emprego_z"], 2), "peso": 0.15, "fonte": "DEMONSTRATIVO (emprego)", "status": "demonstrativo"},
        }
        score_z = sum(c["z"] * c["peso"] for c in comps.values())
        score = max(0, min(100, 50 + 20 * score_z))
        sectors.append({
            "serie_obs": [{"ref": d, "v": v} for d, v in s[-48:]],
            "serie_yoy": [{"ref": d, "v": round(v, 2)} for d, v in yoy[-48:]],
            "codigo": code, "nome": short, "score": round(score, 1),
            "faixa": ("baixo" if score < 35 else "atenção" if score < 55 else "elevado" if score < 75 else "crítico"),
            "tendencia": ("piorando" if trend_3m < -0.5 else "melhorando" if trend_3m > 0.5 else "estável"),
            "tendencia_valor_pp": round(trend_3m, 2),
            "velocidade": ("momento piorando" if velocity < -0.5 else "momento melhorando" if velocity > 0.5 else "constante"),
            "velocidade_valor_pp": round(velocity, 2),
            "yoy_producao_pct": round(yoy[-1][1], 2), "ref": yoy[-1][0],
            "contribuicoes": {k: round(20 * c["z"] * c["peso"], 1) for k, c in comps.items()},
            "componentes": comps,
        })
    sectors.sort(key=lambda x: -x["score"])
    return {
        "ok": bool(sectors), "tipo": "DADO CALCULADO (componentes mistos)", "setores": sectors,
        "metodo": "Score = 50 + 20×Σ(peso×z): atividade 0,45 (queda da produção física a/a vs. histórico, IBGE), "
                  "condições de crédito 0,20 (inadimplência e spread PJ vs. histórico, BCB), "
                  "estresse empresarial 0,20 e capacidade financeira 0,15 (DEMONSTRATIVOS). "
                  "Tendência = Δ3m do crescimento a/a; velocidade = aceleração dessa tendência.",
        "limitacoes": "Cobertura restrita à indústria (PIM). Condições de crédito ainda sem corte setorial "
                      "(usa agregado PJ). Componentes de RJ e emprego são DEMONSTRATIVOS — ver selo por componente. "
                      "Normalização por nº de empresas/estoque de crédito setorial entra com Caged/SCR (Fases 1/4).",
        "aviso_demo": "Componentes estresse_empresarial e capacidade_financeira são demonstrativos; atividade e condições de crédito são observados.",
    }


PEER_GROUP_LABELS = {
    "S1": "S1 — grandes (≥10% do PIB ou atividade internacional)",
    "S2": "S2 — porte entre 1% e 10% do PIB",
    "S3": "S3 — porte entre 0,1% e 1% do PIB",
    "S4": "S4 — porte inferior a 0,1% do PIB",
    "S5": "S5 — porte reduzido / metodologia simplificada",
}


def _pct_rank(vals, v):
    below = sum(1 for x in vals if x < v)
    return below / max(len(vals) - 1, 1) * 100


def _quartiles(vals):
    sv = sorted(vals)
    def q(p):
        pos = p * (len(sv) - 1)
        lo, hi = int(pos), min(int(pos) + 1, len(sv) - 1)
        frac = pos - lo
        return sv[lo] * (1 - frac) + sv[hi] * frac
    return {"q1": round(q(0.25), 2), "mediana": round(q(0.5), 2), "q3": round(q(0.75), 2)}


def _inst_snapshot(con, anomes):
    cur = con.execute(
        """SELECT m.cod_inst, i.name, i.tcb, i.uf, i.sr, m.metric, m.value
           FROM institution_metrics m LEFT JOIN institutions i ON i.cod_inst = m.cod_inst
           WHERE m.anomes = ?""", (anomes,))
    insts = {}
    for cod, name, tcb, uf, sr, metric, value in cur.fetchall():
        d = insts.setdefault(cod, {"cod_inst": cod, "nome": name or cod, "tcb": tcb, "uf": uf,
                                   "sr": sr or "S?", "m": {}})
        d["m"][metric] = value
    return [d for d in insts.values()
            if all(k in d["m"] for k in ("ativo_total", "patrimonio_liquido", "carteira_credito",
                                         "lucro_liquido", "captacoes"))
            and d["m"]["ativo_total"] > 0 and d["m"]["patrimonio_liquido"] > 0]


CART_NAO_SETOR = {"total_exterior_pessoa_juridica", "atividade_nao_informada_ou_nao_se_aplica",
                  "total_nao_individualizado_pessoa_juridica"}


def carteira_profile(m):
    """Perfil de carteira a partir das métricas cart_*: HHI setorial (carteira PJ doméstica
    individualizada), participação PME e principais categorias. None quando não reportado."""
    cnae = {k.split(":", 1)[1]: v for k, v in m.items()
            if k.startswith("cart_pj_cnae:") and k.split(":", 1)[1] not in CART_NAO_SETOR}
    porte = {k.split(":", 1)[1]: v for k, v in m.items() if k.startswith("cart_pj_porte:")}
    mod_pf = {k.split(":", 1)[1]: v for k, v in m.items()
              if k.startswith("cart_pf_mod:") and not k.split(":", 1)[1].startswith("total_")}
    mod_pj = {k.split(":", 1)[1]: v for k, v in m.items()
              if k.startswith("cart_pj_mod:") and not k.split(":", 1)[1].startswith("total_")}
    out = {}
    tot_cnae = sum(cnae.values())
    if tot_cnae > 0 and len(cnae) >= 2:
        shares = {k: v / tot_cnae for k, v in cnae.items()}
        out["hhi_setorial"] = round(sum(s * s for s in shares.values()) * 10000)
        out["top_cnae"] = sorted(((k, round(s * 100, 1)) for k, s in shares.items()),
                                 key=lambda x: -x[1])[:5]
    porte_class = {k: v for k, v in porte.items() if k in ("micro", "pequena", "media", "grande")}
    tot_porte = sum(porte_class.values())
    if tot_porte > 0:
        out["pme_share_pct"] = round((porte_class.get("micro", 0) + porte_class.get("pequena", 0))
                                     / tot_porte * 100, 1)
    for label, mods in (("top_mod_pf", mod_pf), ("top_mod_pj", mod_pj)):
        tot = sum(mods.values())
        if tot > 0:
            out[label] = sorted(((k, round(v / tot * 100, 1)) for k, v in mods.items()),
                                key=lambda x: -x[1])[:4]
    return out or None


def _ratios(d):
    m = d["m"]
    r = {
        "roe_pct": m["lucro_liquido"] / m["patrimonio_liquido"] * 100,  # acumulado do período IF.data
        "alavancagem": m["ativo_total"] / m["patrimonio_liquido"],
        "carteira_ativo_pct": m["carteira_credito"] / m["ativo_total"] * 100,
        "captacoes_ativo_pct": m["captacoes"] / m["ativo_total"] * 100,
    }
    if m.get("indice_basileia"):
        r["basileia_pct"] = m["indice_basileia"] * 100
    prof = carteira_profile(m)
    if prof and "hhi_setorial" in prof:
        r["hhi_setorial"] = prof["hhi_setorial"]
    return r

DIM_DEFS = {  # dimensão: (métrica, maior_metrica_significa_mais_risco?)
    "capital_basileia": ("basileia_pct", False),
    "rentabilidade": ("roe_pct", False),
    "alavancagem": ("alavancagem", True),
    "concentracao_credito": ("carteira_ativo_pct", True),
    "dependencia_captacoes": ("captacoes_ativo_pct", True),
    "concentracao_setorial": ("hhi_setorial", True),
}


def _score_snapshot(snapshot, top_n):
    """Calcula scores por percentil DENTRO do grupo de pares (segmento prudencial Sr).
    Grupos com menos de 5 membros no corte caem para o conjunto completo, com sinalização."""
    snapshot.sort(key=lambda d: -d["m"]["ativo_total"])
    universe = snapshot[:top_n]
    by_group = {}
    for d in universe:
        by_group.setdefault(d["sr"], []).append(d)
    all_r = {d["cod_inst"]: _ratios(d) for d in universe}
    out = {}
    group_stats = {}
    for grp, members in by_group.items():
        pool = members if len(members) >= 5 else universe
        pool_fallback = len(members) < 5
        stats = {}
        for dim, (met, _) in DIM_DEFS.items():
            vals = [all_r[m["cod_inst"]][met] for m in pool if met in all_r[m["cod_inst"]]]
            if len(vals) >= 5:
                stats[met] = _quartiles(vals)
        group_stats[grp] = {"n": len(members), "pool_fallback": pool_fallback, "stats": stats}
        for d in members:
            r = all_r[d["cod_inst"]]
            dims = {}
            for dim, (met, higher_risk) in DIM_DEFS.items():
                if met not in r or met not in stats:
                    continue  # métrica não reportada => dimensão omitida (nunca imputada)
                vals = [all_r[m["cod_inst"]][met] for m in pool if met in all_r[m["cod_inst"]]]
                p = _pct_rank(vals, r[met])
                dims[dim] = {"valor": round(r[met], 2), "percentil_pares": round(p, 1),
                             "risco": round(p if higher_risk else 100 - p, 1),
                             "mediana_pares": stats[met]["mediana"],
                             "q1_pares": stats[met]["q1"], "q3_pares": stats[met]["q3"]}
            if not dims:
                continue
            score = sum(x["risco"] for x in dims.values()) / len(dims)
            out[d["cod_inst"]] = {"d": d, "dims": dims, "score": round(score, 1),
                                  "pool_fallback": pool_fallback,
                                  "dimensoes_disponiveis": f"{len(dims)}/{len(DIM_DEFS)}"}
    return out, group_stats


def _vulnerability(d, elasticidades, severe_shocks):
    """Vulnerabilidade a cenário severo (CENÁRIO/ESTIMADO): Δinadimplência agregada projetada
    aplicada à carteira da instituição com LGD 45% (padrão Basileia); impacto expresso em
    pontos de Basileia via RWA. Aproximação forte (choque agregado, sem heterogeneidade de
    carteira) — sempre exibida como intervalo, nunca ponto."""
    m = d["m"]
    rwa = m.get("rwa")
    basileia = m.get("indice_basileia")
    if not rwa or not basileia or rwa <= 0:
        return None
    d_inad, d_lo, d_hi = 0.0, 0.0, 0.0
    for k, shock in severe_shocks.items():
        e = elasticidades.get(k)
        if not e or not shock:
            continue
        if e.get("sinal_esperado_ok") is False:
            continue  # elasticidade com sinal contraintuitivo não entra no estresse (documentado)
        d_inad += e["value"] * shock
        lo, hi = sorted((e["range"][0] * shock, e["range"][1] * shock))
        d_lo += lo
        d_hi += hi
    lgd = 0.45
    def impact(delta_pp):
        perda = m["carteira_credito"] * max(delta_pp, 0) / 100 * lgd
        return perda / rwa * 100  # em pontos percentuais de Basileia
    return {
        "tipo": "CENÁRIO",
        "cenario": "severamente adverso",
        "delta_inad_pp": [round(d_lo, 2), round(d_hi, 2)],
        "impacto_basileia_pp": [round(-impact(d_hi), 2), round(-impact(d_lo), 2)],
        "basileia_atual_pct": round(basileia * 100, 2),
        "basileia_pos_choque_pct": [round(basileia * 100 - impact(d_hi), 2),
                                    round(basileia * 100 - impact(d_lo), 2)],
        "metodo": "Δinad agregada (elasticidades × choques severos; elasticidades com sinal "
                  "contraintuitivo são excluídas) × carteira × LGD 45% ÷ RWA. Aproximação: choque "
                  "agregado aplicado uniformemente; sem mitigação de garantias/hedge.",
    }


def _bloco_captacao(m, m_prev, anomes):
    """Custo de captação estimado (DADO CALCULADO) a partir do IF.data UI.

    A DRE do IF.data acumula POR SEMESTRE (mar/set = 3 meses; jun/dez = 6):
    a anualização declara os meses do período — nunca um ×4 cego. Denominador
    = média das captações totais na ponta atual e anterior (quando a anterior
    existe; senão a ponta atual, sinalizado em `media_pontas`). Custo fora de
    0–100% a.a. é descartado (unidade/tradução suspeita), nunca publicado."""
    juros = m.get("dre:despesa_juros_captacoes")
    capt = m.get("fund:captacoes")
    if juros is None or not capt or capt <= 0:
        return None
    mes = int(str(anomes)[-2:])
    meses = 3 if mes in (3, 9) else 6
    capt_ant = (m_prev or {}).get("fund:captacoes")
    media = bool(capt_ant and capt_ant > 0)
    denom = (capt + capt_ant) / 2 if media else capt
    custo_aa = abs(juros) * (12 / meses) / denom * 100
    # piso de 0,05: guard no valor BRUTO — a lição do Banco Clássico (custo
    # 0,004% passou no `> 0` e virou 0,00 publicado após o arredondamento)
    if not (0.05 <= custo_aa < 100):
        return None
    mix = None
    dep_total = m.get("fund:dep_total")
    if dep_total and dep_total > 0:
        rotulos = {"fund:dep_vista": "vista", "fund:dep_poupanca": "poupanca",
                   "fund:dep_prazo": "prazo", "fund:dep_interf": "interfinanceiro",
                   "fund:dep_outros": "outros"}
        mix = {rot: round(m[k] / dep_total * 100, 1)
               for k, rot in rotulos.items() if m.get(k) is not None}
    return {
        "tipo": "DADO CALCULADO",
        "custo_aa_pct": round(custo_aa, 2),
        "meses_dre": meses,
        "media_pontas": media,
        "captacoes_brl": capt,
        "dep_total_brl": dep_total,
        "dep_captacoes_pct": round(dep_total / capt * 100, 1) if dep_total and dep_total > 0 else None,
        "mix_depositos_pct": mix,
        "formula": (f"|despesa de juros de captações acumulada em {meses} meses (DRE IF.data)| × 12/{meses} "
                    f"÷ {'média das captações totais nas pontas atual e anterior' if media else 'captações totais na ponta atual (única disponível)'}"),
        "limitacoes": ("Aproximação: estoque de pontas de trimestre, não saldo médio diário; mistura "
                       "funding de varejo e mercado; a DRE do IF.data acumula por semestre."),
    }


def _bloco_modelo_negocio(m):
    """Como a instituição ganha dinheiro (DADO CALCULADO): peso dos serviços na
    receita operacional e balanço-síntese (crédito/ativo, captações/ativo).
    O perfil de carteira (produto dominante PF/PJ, PME, HHI) já viaja em
    carteira_perfil. Métrica ausente => campo omitido, nunca imputado."""
    out = {}
    interm = m.get("dre:resultado_intermediacao")
    partes = [m.get(k) for k in ("dre:serv_pagamentos", "dre:tarifas", "dre:outras_rendas_servicos")]
    serv = sum(v for v in partes if v is not None) if any(v is not None for v in partes) else None
    if serv is not None and interm is not None and interm > 0 and serv >= 0:
        out["receita_servicos_pct"] = round(serv / (interm + serv) * 100, 1)
        out["receita_servicos_conceito"] = (
            "serviços (pagamentos + tarifas + outras rendas) ÷ (resultado de intermediação "
            "financeira + serviços); DRE IF.data acumulada por semestre — proxy do peso de "
            "receitas de serviço, omitida quando a intermediação é negativa")
    pes, adm = m.get("dre:despesas_pessoal"), m.get("dre:despesas_admin")
    if pes is not None and adm is not None and interm is not None and interm > 0:
        # numerador e denominador acumulam pelo MESMO período semestral da DRE:
        # a razão é consistente sem anualização
        rec_op = interm + max(serv or 0, 0)
        ef = (abs(pes) + abs(adm)) / rec_op * 100
        if 0.5 <= ef < 300:  # fora disso = unidade/tradução suspeita (piso evita o 0,0 arredondado); omitido, nunca publicado
            out["eficiencia_pct"] = round(ef, 1)
            out["eficiencia_conceito"] = (
                "(|despesas de pessoal| + |despesas administrativas|) ÷ (resultado de intermediação "
                "financeira + rendas de serviços), DRE IF.data do mesmo período — quanto MENOR, mais "
                "eficiente; omitido quando a intermediação é negativa. Não inclui despesas "
                "tributárias nem outras operacionais.")
            out["despesas_pessoal_brl"] = pes
            out["despesas_admin_brl"] = adm
    if m.get("ativo_total"):
        at = m["ativo_total"]
        out["credito_ativo_pct"] = round(m["carteira_credito"] / at * 100, 1)
        out["captacoes_ativo_pct"] = round(m["captacoes"] / at * 100, 1)
    return out or None


def build_institution_scores(con, cfg, elasticidades=None, severe_shocks=None):
    """Score 0-100 (maior = mais risco relativo AOS PARES do mesmo segmento prudencial),
    com dimensão de capital (Basileia real), decomposição, quartis, histórico e
    vulnerabilidade a choques (cenário)."""
    top_n = cfg["ifdata"]["top_n_by_assets"]
    cur = con.execute("SELECT DISTINCT anomes FROM institution_metrics ORDER BY anomes DESC")
    periods = [r[0] for r in cur.fetchall()]
    if not periods:
        return {"ok": False}
    anomes = periods[0]
    snap = _inst_snapshot(con, anomes)
    if len(snap) < 5:
        return {"ok": False}
    scored, group_stats = _score_snapshot(snap, top_n)
    prev_scored = {}
    history = {}  # cod_inst -> [(anomes, score)]
    for p in reversed(periods):
        s_p = _inst_snapshot(con, p)
        if len(s_p) < 5:
            continue
        sc_p, _ = _score_snapshot(s_p, top_n)
        if p == (periods[1] if len(periods) > 1 else None):
            prev_scored = sc_p
        for cod, s in sc_p.items():
            history.setdefault(cod, []).append({"anomes": p, "score": s["score"]})

    out = []
    for cod, s in scored.items():
        d = s["d"]
        prev = prev_scored.get(cod)
        vul = _vulnerability(d, elasticidades, severe_shocks) if elasticidades and severe_shocks else None
        out.append({
            "carteira_perfil": carteira_profile(d["m"]),
            "captacao": _bloco_captacao(d["m"], prev["d"]["m"] if prev else None, anomes),
            "modelo_negocio": _bloco_modelo_negocio(d["m"]),
            "basileia_pct": round(d["m"]["indice_basileia"] * 100, 2) if d["m"].get("indice_basileia") else None,
            "capital_principal_pct": round(d["m"]["indice_capital_principal"] * 100, 2) if d["m"].get("indice_capital_principal") else None,
            "rwa_brl": d["m"].get("rwa"),
            "historico_score": history.get(cod, []),
            "vulnerabilidade": vul,
            "dimensoes_disponiveis": s.get("dimensoes_disponiveis"),
            "cod_inst": cod, "nome": d["nome"], "tcb": d["tcb"], "uf": d["uf"],
            "grupo_pares": d["sr"], "grupo_pares_label": PEER_GROUP_LABELS.get(d["sr"], d["sr"]),
            "grupo_fallback": s["pool_fallback"],
            "ativo_total_brl": d["m"]["ativo_total"], "carteira_brl": d["m"]["carteira_credito"],
            "pl_brl": d["m"]["patrimonio_liquido"], "lucro_brl": d["m"]["lucro_liquido"],
            "score": s["score"],
            "score_anterior": prev["score"] if prev else None,
            "score_delta": round(s["score"] - prev["score"], 1) if prev else None,
            "faixa": ("risco muito baixo" if s["score"] <= 20 else "risco baixo" if s["score"] <= 40 else
                      "atenção" if s["score"] <= 60 else "risco elevado" if s["score"] <= 80 else "risco muito elevado"),
            "dimensoes": s["dims"],
        })
    out.sort(key=lambda x: -x["ativo_total_brl"])
    return {
        "ok": True, "tipo": "DADO CALCULADO", "anomes": anomes,
        "anomes_anterior": periods[1] if len(periods) > 1 else None,
        "instituicoes": out, "grupos": {g: {**gs, "label": PEER_GROUP_LABELS.get(g, g)} for g, gs in group_stats.items()},
        "metodo": (f"Grupos de pares = segmento prudencial (Res. 4.553): percentil de cada razão dentro do "
                   f"próprio grupo (IF.data {anomes}); grupos com <5 membros no corte dos {top_n} maiores usam "
                   f"o conjunto completo (sinalizado). Score = média das dimensões disponíveis — até 5: capital "
                   f"(Índice de Basileia, invertido), rentabilidade (ROE, invertido), alavancagem, concentração "
                   f"em crédito e dependência de captações. Basileia/RWA da interface IF.data (relatório "
                   f"Informações de Capital, indisponível na Olinda). Histórico de score em {len(periods)} trimestres "
                   f"(backfill do Resumo desde 2015 via Olinda; períodos até 2024 usam a Carteira de Crédito "
                   f"Classificada do plano contábil antigo — a fronteira 2024/2025 da Res. 4.966 atravessa a série e "
                   f"está marcada na aba Regulação; a segmentação prudencial ATUAL é aplicada retroativamente aos "
                   f"períodos antigos). Vulnerabilidade a choques = CENÁRIO severo via elasticidades (intervalo, nunca ponto)."),
        "limitacoes": "Sem liquidez, inadimplência por IF ou qualidade de resultado (Fase 3b). ROE acumulado do "
                      "período IF.data, não anualizado. Score relativo ao grupo, não absoluto. Instituições sem "
                      "capital reportado têm a dimensão omitida (nunca imputada; nº de dimensões exibido). "
                      "Vulnerabilidade usa choque agregado uniforme — sem heterogeneidade de carteira. "
                      "Custo de captação é estimativa (fórmula declarada por instituição): estoque de pontas, "
                      "não saldo médio diário; DRE do IF.data acumula por semestre (mar/set=3m, jun/dez=6m).",
        "aviso": cfg["platform"]["disclaimer"],
    }


def build_exposures(con, cfg):
    """Exposição do sistema por setor (CNAE) e por porte, a partir das carteiras reais por
    instituição (IF.data UI). Tudo DADO OBSERVADO; shares calculadas."""
    cur = con.execute("SELECT DISTINCT anomes FROM institution_metrics WHERE source_report='Carteiras(UI)' ORDER BY anomes DESC LIMIT 1")
    row = cur.fetchone()
    if not row:
        return {"ok": False}
    anomes = row[0]
    cur = con.execute(
        """SELECT m.cod_inst, i.name, m.metric, m.value
           FROM institution_metrics m LEFT JOIN institutions i ON i.cod_inst = m.cod_inst
           WHERE m.anomes = ? AND m.source_report='Carteiras(UI)'""", (anomes,))
    by_inst = {}
    names = {}
    for cod, name, metric, value in cur.fetchall():
        by_inst.setdefault(cod, {})[metric] = value
        names[cod] = name or cod
    setores = {}
    portes = {"micro": 0.0, "pequena": 0.0, "media": 0.0, "grande": 0.0}
    pme_rank = []
    for cod, m in by_inst.items():
        tot_pj = m.get("cart_pj:total_da_carteira_de_pessoa_juridica", 0)
        for k, v in m.items():
            if k.startswith("cart_pj_cnae:"):
                slug = k.split(":", 1)[1]
                if slug in CART_NAO_SETOR:
                    continue
                s = setores.setdefault(slug, {"total_brl": 0.0, "instituicoes": []})
                s["total_brl"] += v
                if tot_pj > 1e9:  # exposição relativa só p/ carteiras PJ relevantes (>= R$ 1 bi)
                    s["instituicoes"].append({"cod_inst": cod, "nome": names[cod], "volume_brl": v,
                                              "share_da_propria_carteira_pj_pct": round(v / tot_pj * 100, 1)})
            elif k.startswith("cart_pj_porte:"):
                slug = k.split(":", 1)[1]
                if slug in portes:
                    portes[slug] += v
        prof = carteira_profile(m)
        if prof and "pme_share_pct" in prof and tot_pj > 1e9:  # só instituições com carteira PJ relevante
            pme_rank.append({"cod_inst": cod, "nome": names[cod], "pme_share_pct": prof["pme_share_pct"],
                             "carteira_pj_brl": tot_pj})
    for s in setores.values():
        s["instituicoes"].sort(key=lambda x: -x["volume_brl"])
        s["top_volume"] = s["instituicoes"][:5]
        s["top_exposicao_relativa"] = sorted(s["instituicoes"],
                                             key=lambda x: -x["share_da_propria_carteira_pj_pct"])[:5]
        del s["instituicoes"]
    tot_porte = sum(portes.values())
    pme_rank.sort(key=lambda x: -x["pme_share_pct"])
    return {
        "ok": True, "tipo": "DADO OBSERVADO", "anomes": anomes,
        "setores": dict(sorted(setores.items(), key=lambda kv: -kv[1]["total_brl"])),
        "portes_sistema": {k: {"total_brl": v, "share_pct": round(v / tot_porte * 100, 1) if tot_porte else None}
                           for k, v in portes.items()},
        "pme_share_sistema_pct": round((portes["micro"] + portes["pequena"]) / tot_porte * 100, 1) if tot_porte else None,
        "ranking_pme": pme_rank[:15],
        "metodo": "Somas das carteiras PJ por CNAE/porte reportadas por instituição (IF.data UI, "
                  f"{anomes}, valores em R$). Shares relativas à carteira PJ da própria instituição; "
                  "rankings de exposição relativa e PME restritos a carteiras PJ >= R$ 1 bi. "
                  "Setores excluem exterior, atividade não informada e não individualizado.",
        "limitacoes": "Cobertura: instituições que reportam o detalhamento (grandes cobrem a quase totalidade). "
                      "CNAE em 9 grupos amplos (abertura por divisão exige SCR agregado, fase futura). "
                      "Exposição ao setor ≠ risco: não considera garantias nem qualidade das operações.",
    }


def _spearman(pairs):
    """Correlação de postos (aprox.) para análise exploratória — associação, não causalidade."""
    n = len(pairs)
    if n < 5:
        return None
    def ranks(vals):
        order = sorted(range(n), key=lambda i: vals[i])
        r = [0] * n
        for pos, i in enumerate(order):
            r[i] = pos + 1
        return r
    rx = ranks([p[0] for p in pairs])
    ry = ranks([p[1] for p in pairs])
    d2 = sum((a - b) ** 2 for a, b in zip(rx, ry))
    return round(1 - 6 * d2 / (n * (n * n - 1)), 2)


def build_openfinance_real(con, inst_gold=None):
    """Módulo Open Finance com dados REAIS (Dashboard do Cidadão + diretório oficial)."""
    keys = ["of_consentimentos_transmitidos", "of_consentimentos_recebidos",
            "of_chamadas_dados_transacionais", "of_chamadas_dados_abertos",
            "of_chamadas_iniciacao_pagamento", "of_sucesso_dados_transacionais",
            "of_sucesso_dados_abertos", "of_sucesso_iniciacao_pagamento"]
    series = {}
    for k in keys:
        s = common.get_series(con, k)
        meta = common.get_meta(con, k)
        if s and meta:
            series[k] = {"meta": meta, "obs": [{"ref": d, "v": v} for d, v in s],
                         "qualidade": series_quality(con, k)}
    if "of_consentimentos_transmitidos" not in series:
        return None

    rank_rows = con.execute("SELECT organisation, chamadas FROM of_ranking ORDER BY chamadas DESC").fetchall()
    total_chamadas = sum(r[1] for r in rank_rows) or 1.0
    parts = {}
    for org_id, nome, status, n_as, fams, papeis, _ in con.execute(
            "SELECT * FROM of_participants").fetchall():
        parts[nome.upper()] = {"nome": nome, "status": status, "n_auth_servers": n_as,
                               "familias": json.loads(fams or "[]"),
                               "papeis": json.loads(papeis or "[]")}
    def _match_dir(org_name):
        up = org_name.upper()
        if up in parts:
            return parts[up]
        toks = [t for t in up.replace("BANCO", "").split() if len(t) >= 4]
        for nome, p in parts.items():
            if toks and all(t in nome for t in toks[:2]):
                return p
        return None

    ranking = []
    for nome, chamadas in rank_rows:
        d = _match_dir(nome)
        share = chamadas / total_chamadas * 100
        fams = len(d["familias"]) if d else None
        ranking.append({
            "organisation": nome, "chamadas_semana": chamadas, "share_pct": round(share, 1),
            "familias_api": fams, "papeis": d["papeis"] if d else None,
            "match_diretorio": bool(d),
        })
    por_papel = {}
    for p in parts.values():
        for r in p["papeis"]:
            por_papel[r] = por_papel.get(r, 0) + 1
    tx = series["of_consentimentos_transmitidos"]["obs"]

    # ---- rankings por fase + concentração (universo divulgado = top-20; HHI PARCIAL) ----
    fases_lbl = {"transactional-data": "dados_transacionais", "open-data": "dados_abertos",
                 "payment-initiation": "iniciacao_pagamento"}
    rankings_fase, concentracao = {}, {}
    for phase, slug in fases_lbl.items():
        rows = con.execute("SELECT organisation, chamadas FROM of_ranking WHERE phase=? ORDER BY chamadas DESC",
                           (phase,)).fetchall()
        tot = sum(r[1] for r in rows) or 1.0
        rankings_fase[slug] = [{"organisation": n, "chamadas": v, "share_pct": round(v / tot * 100, 1)}
                               for n, v in rows]
        shares = [v / tot for _, v in rows]
        concentracao[slug] = {
            "top1_pct": round(shares[0] * 100, 1) if shares else None,
            "top5_pct": round(sum(shares[:5]) * 100, 1) if len(shares) >= 5 else None,
            "top10_pct": round(sum(shares[:10]) * 100, 1) if len(shares) >= 10 else None,
            "fora_top5_pct": round((1 - sum(shares[:5])) * 100, 1) if len(shares) >= 5 else None,
            "hhi_parcial": round(sum(s * s for s in shares) * 10000),
            "nota": "shares sobre o universo DIVULGADO (top-20 do dashboard) — HHI é limite inferior parcial",
        }
    endpoints_top = {}
    for phase, slug in fases_lbl.items():
        eps = con.execute("""SELECT nome, chamadas FROM of_endpoints WHERE phase=? AND tipo='endpoint'
                             ORDER BY chamadas DESC LIMIT 10""", (phase,)).fetchall()
        fams = con.execute("""SELECT nome, chamadas FROM of_endpoints WHERE phase=? AND tipo='familia'
                              ORDER BY chamadas DESC""", (phase,)).fetchall()
        endpoints_top[slug] = {"endpoints": [{"nome": n, "chamadas": v} for n, v in eps],
                               "familias": [{"nome": n, "chamadas": v} for n, v in fams]}

    # ---- 4 índices separados (nunca um índice genérico) ----
    def _growth(obs, k):
        if len(obs) <= k or not obs[-1 - k]["v"]:
            return None
        return round((obs[-1]["v"] / obs[-1 - k]["v"] - 1) * 100, 2)
    cons_tx, cons_rx = series["of_consentimentos_transmitidos"]["obs"], series.get("of_consentimentos_recebidos", {}).get("obs", [])
    cham = series.get("of_chamadas_dados_transacionais", {}).get("obs", [])
    suc = {s: series.get(f"of_sucesso_{s}", {}).get("obs", []) for s in fases_lbl.values()}
    hist_semanas = len(cons_tx)
    conf_txt = f"histórico de {hist_semanas} semanas nas rotas públicas — variação anual indisponível (declarado)"
    indices = {
        "adocao": {"versao": "1.0", "cobertura": "sistema (por organização indisponível)",
                   "confianca": "moderada", "confianca_motivo": conf_txt,
                   "componentes": [
                       {"nome": "consentimentos transmitidos (nível)", "valor": cons_tx[-1]["v"], "peso": "—"},
                       {"nome": "crescimento 4 semanas (transmitidos)", "valor": _growth(cons_tx, 4), "peso": 0.5},
                       {"nome": "crescimento 4 semanas (recebidos)", "valor": _growth(cons_rx, 4) if cons_rx else None, "peso": 0.5}]},
        "utilizacao": {"versao": "1.0", "cobertura": "sistema", "confianca": "moderada", "confianca_motivo": conf_txt,
                       "componentes": [
                           {"nome": "chamadas transacionais por consentimento ativo (semana)", "peso": 1.0,
                            "valor": round(cham[-1]["v"] / cons_tx[-1]["v"], 1) if cham and cons_tx[-1]["v"] else None},
                           {"nome": "crescimento das chamadas 4 semanas (%)", "valor": _growth(cham, 4), "peso": "—"}]},
        "conversao": {"indisponivel": "O funil de consentimentos/pagamentos não é publicado nas rotas do "
                                      "Dashboard do Cidadão — índice não calculado (nunca estimado)."},
        "qualidade_tecnica": {"versao": "1.0", "cobertura": "sistema por fase (por organização indisponível)",
                              "confianca": "moderada", "confianca_motivo": conf_txt,
                              "componentes": [
                                  {"nome": f"taxa de sucesso — {s.replace('_', ' ')}", "peso": round(1 / 3, 2),
                                   "valor": round(suc[s][-1]["v"], 2) if suc[s] else None,
                                   "tendencia_4s_pp": (round(suc[s][-1]["v"] - suc[s][-5]["v"], 2)
                                                      if len(suc[s]) > 4 else None)}
                                  for s in fases_lbl.values()]},
    }

    # ---- alertas OF (regras transparentes; persistência = semanas consecutivas) ----
    alertas = []
    def _persist(obs, cond):
        k = 0
        for o in reversed(obs):
            if cond(o["v"]):
                k += 1
            else:
                break
        return k
    for s in fases_lbl.values():
        if suc[s]:
            v = suc[s][-1]["v"]
            if v < 97:
                alertas.append({"indicador": f"taxa de sucesso — {s.replace('_', ' ')}", "valor": round(v, 2),
                                "limiar": 97, "severidade": "relevante" if v < 95 else "atencao",
                                "persistencia_semanas": _persist(suc[s], lambda x: x < 97),
                                "data": suc[s][-1]["ref"], "fonte": "Dashboard do Cidadão",
                                "regra": "sucesso < 97% (relevante se < 95%)"})
    if len(cons_tx) > 1 and cons_tx[-1]["v"] < cons_tx[-2]["v"]:
        alertas.append({"indicador": "consentimentos transmitidos", "valor": cons_tx[-1]["v"],
                        "limiar": cons_tx[-2]["v"], "severidade": "atencao",
                        "persistencia_semanas": _persist(cons_tx[1:], lambda x: False) or 1,
                        "data": cons_tx[-1]["ref"], "fonte": "Dashboard do Cidadão",
                        "regra": "queda semanal de consentimentos ativos"})
    g4 = _growth(cham, 1)
    if g4 is not None and g4 < -10:
        alertas.append({"indicador": "chamadas transacionais", "valor": g4, "limiar": -10,
                        "severidade": "atencao", "persistencia_semanas": 1,
                        "data": cham[-1]["ref"], "fonte": "Dashboard do Cidadão",
                        "regra": "queda semanal de chamadas > 10%"})

    # ---- relação exploratória OF × crédito (associação, NÃO causalidade) ----
    relacao_credito = None
    if inst_gold and inst_gold.get("ok"):
        import unicodedata as _ud, re as _re
        def _norm2(s):
            return _ud.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
        tot_cart = sum(i["carteira_brl"] for i in inst_gold["instituicoes"]) or 1.0
        pares = []
        for r in rankings_fase["dados_transacionais"]:
            toks = [t for t in _re.findall(r"[A-Z0-9]{4,}", _norm2(r["organisation"]))
                    if t not in ("BANCO", "BRASIL")][:2]
            hit = next((i for i in inst_gold["instituicoes"]
                        if toks and all(t in _norm2(i["nome"]) for t in toks)), None)
            if hit:
                pares.append({"organisation": r["organisation"],
                              "share_chamadas_pct": r["share_pct"],
                              "share_carteira_pct": round(hit["carteira_brl"] / tot_cart * 100, 2)})
        rho = _spearman([(p["share_chamadas_pct"], p["share_carteira_pct"]) for p in pares])
        relacao_credito = {
            "pares": pares, "spearman_rho": rho, "n": len(pares),
            "leitura": "Associação de POSTOS entre participação nas chamadas transacionais do Open Finance e "
                       "participação na carteira de crédito (universo top-30 IF.data ∩ top-20 OF). "
                       "Associação exploratória — NÃO implica causalidade; amostra pequena e truncada.",
        }

    return {
        "ok": True, "tipo": "DADO OBSERVADO", "demo": False,
        "series": series, "ranking": ranking,
        "rankings_fase": rankings_fase, "concentracao": concentracao,
        "endpoints_top": endpoints_top, "indices": indices,
        "alertas_of": alertas, "relacao_credito": relacao_credito,
        "qualidade_dados": {
            "semanas_por_serie": {k: len(v["obs"]) for k, v in series.items()},
            "orgs_ranking_sem_match_diretorio": sum(1 for r in ranking if not r.get("match_diretorio")),
            "indisponiveis": ["consentimentos por organização", "clientes únicos", "funil de consentimentos",
                              "funil de pagamentos", "sucesso/falha por organização", "latência/disponibilidade",
                              "pagamentos concluídos (apenas chamadas da fase)"],
            "nota": "Ausência de organização no ranking divulgado (top-20) NÃO significa atividade zero.",
        },
        "consentimentos_atual": tx[-1],
        "participantes": {"total": len(parts), "por_papel": por_papel},
        "metodo": "Séries semanais das rotas públicas do Dashboard do Cidadão (consentimentos por papel, "
                  "chamadas e taxa de sucesso por fase; ranking de chamadas por organização) + diretório "
                  "oficial de participantes (papéis e famílias de API).",
        "limitacoes": "Rotas do dashboard não são formalmente documentadas (risco de quebra monitorado pelo "
                      "pipeline); histórico curto (semanas recentes); ranking cobre as maiores organizações "
                      "divulgadas; latência e conversão por organização não são públicas.",
        "fonte_nota": "Open Finance Brasil — Dashboard do Cidadão e diretório oficial de participantes (dados abertos).",
    }


def build_openfinance(of_demo):
    """Ranking DEMONSTRATIVO normalizado por consentimento (fallback quando não há dado real)."""
    insts = of_demo["instituicoes"]
    ranking = sorted(insts, key=lambda x: -x["consentimentos_ativos_recebidos"])
    return {
        "ok": True, "demo": True, "selo": of_demo["selo"], "motivo": of_demo["motivo"],
        "ref_period": of_demo["ref_period"], "ranking": ranking,
        "serie_consentimentos_total": of_demo["serie_consentimentos_total"],
        "metodo": "Ranking demonstrativo ordenado por consentimentos ativos recebidos; indicadores por consentimento evitam confundir volume com uso.",
        "limitacoes": "TODOS os dados deste módulo são DEMONSTRATIVOS. Método pronto para dados reais do dashboard Open Finance Brasil quando houver via de acesso estável.",
    }


def series_quality(con, key, today=None):
    """Score 0-100 por série: completude, atualidade, histórico, estabilidade, transparência."""
    s = common.get_series(con, key)
    meta = common.get_meta(con, key)
    if not s or not meta:
        return None
    today = today or date.today().isoformat()
    n = len(s)
    first, last = s[0][0], s[-1][0]
    months_span = max((int(today[:4]) - int(first[:4])) * 12 + int(today[5:7]) - int(first[5:7]), 1)
    completude = min(n / months_span, 1.0) * 100
    stale_days = (date.fromisoformat(today) - date.fromisoformat(last)).days
    freq = (meta.get("freq") or "").lower()
    expected = 45 if "mensal" in freq else 10 if "diária" in freq else 120
    atualidade = max(0.0, min(1.0, 2 - stale_days / expected)) * 100 if stale_days > expected else 100.0
    historico = min(n / 120, 1.0) * 100
    cur = con.execute("SELECT COUNT(*) FROM revisions WHERE key=?", (key,))
    n_rev = cur.fetchone()[0]
    estabilidade = max(0.0, 1 - n_rev / max(n, 1) * 5) * 100
    transparencia = 100.0 if meta.get("methodology") and meta.get("url") else 50.0
    comps = {"completude": round(completude, 1), "atualidade": round(atualidade, 1),
             "historico": round(historico, 1), "estabilidade": round(estabilidade, 1),
             "transparencia": round(transparencia, 1)}
    w = {"completude": 0.2, "atualidade": 0.3, "historico": 0.2, "estabilidade": 0.15, "transparencia": 0.15}
    total = sum(comps[k] * w[k] for k in comps)
    return {"score": round(total, 1), "componentes": comps, "dias_sem_atualizar": stale_days,
            "ultima_ref": last, "n_obs": n, "n_revisoes": n_rev}
