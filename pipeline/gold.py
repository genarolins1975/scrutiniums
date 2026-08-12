"""Camada gold: monta os JSON analíticos consumidos pelo front-end.

Contrato: cada payload inclui tipo epistemológico (observado/estimativa/previsão/demo),
metadados de fonte e qualidade, e referência de linhagem.
"""
import json
import os
from datetime import date

from pipeline import common
from pipeline.indicators import (_yoy, build_exposures, build_ibcc, build_institution_scores,
                                 build_openfinance, build_sector_stress, series_quality)
from pipeline.models import forecast as fc
from pipeline.sources.demo_data import OPEN_FINANCE_DEMO, RJ_DEMO


def _ipca_acc12(con):
    ipca = common.get_series(con, "ipca")
    acc = {}
    for i in range(12, len(ipca)):
        fator = 1.0
        for j in range(i - 11, i + 1):
            fator *= 1 + ipca[j][1] / 100
        acc[ipca[i][0]] = (fator - 1) * 100
    return acc


def _series_payload(con, key, tail=200, with_yoy=True, ipca_acc=None):
    s = common.get_series(con, key)
    meta = common.get_meta(con, key)
    if not s or not meta:
        return None
    q = series_quality(con, key)
    payload = {
        "tipo": "DADO OBSERVADO",
        "meta": meta,
        "qualidade": q,
        "obs": [{"ref": d, "v": v} for d, v in s[-tail:]],
    }
    if with_yoy:
        yy = _yoy(s)
        payload["yoy"] = [{"ref": d, "v": round(v, 3)} for d, v in yy[-tail:]]
        # crescimento real (deflacionado pelo IPCA acumulado 12m) para séries em R$
        if ipca_acc and "R$" in (meta.get("unit") or ""):
            real = [{"ref": d, "v": round(((1 + v / 100) / (1 + ipca_acc[d] / 100) - 1) * 100, 3)}
                    for d, v in yy if d in ipca_acc]
            payload["yoy_real"] = real[-tail:]
            payload["yoy_real_nota"] = "DADO CALCULADO: variação a/a nominal deflacionada pelo IPCA acumulado 12m (IBGE via SGS 433)"
    return payload


def build_all(con, cfg, fetch_status):
    today = date.today().isoformat()
    horizons = cfg["forecast"]["horizons"]
    bt_pts = cfg["forecast"]["backtest_points"]
    min_hist = cfg["forecast"]["min_history"]

    # ---- Módulo 1: pulso do crédito ----
    pulse_keys = ["saldo_total", "saldo_pf", "saldo_pj", "concessoes_total", "concessoes_pf",
                  "concessoes_pj", "taxa_total", "taxa_pf", "taxa_pj", "spread_total", "spread_pf",
                  "spread_pj", "inad_total", "inad_pf", "inad_pj", "credito_pib", "endividamento",
                  "comprometimento", "selic_meta", "ipca", "ibc_br", "desemprego", "papelao", "cambio"]
    ipca_acc = _ipca_acc12(con)
    pulse = {"gerado_em": common.now_utc(), "series": {}}
    for k in pulse_keys:
        p = _series_payload(con, k, ipca_acc=ipca_acc)
        if p:
            pulse["series"][k] = p

    forecasts = {}
    for target in cfg["forecast"]["targets"]:
        s = common.get_series(con, target)
        if len(s) < min_hist:
            forecasts[target] = {"ok": False, "motivo": "histórico insuficiente"}
            continue
        dates = [d for d, _ in s]
        values = [v for _, v in s]
        forecasts[target] = fc.forecast_series(dates, values, horizons, bt_pts, min_hist)
        forecasts[target]["ultima_obs"] = {"ref": dates[-1], "v": values[-1]}
    pulse["previsoes"] = forecasts
    common.write_gold("pulse.json", pulse)

    # ---- IBCC (total + variantes PF/PJ com o mesmo método) ----
    from pipeline.indicators import IBCC_SEGMENT_COMPONENTS
    ibcc = build_ibcc(con, cfg)
    ibcc["segmentos"] = {
        seg: build_ibcc(con, cfg, components=comps, segment=seg)
        for seg, comps in IBCC_SEGMENT_COMPONENTS.items()
    }
    common.write_gold("ibcc.json", ibcc)

    # ---- Módulo 2: setores ----
    sectors = build_sector_stress(con, cfg, RJ_DEMO)
    common.write_gold("sectors.json", sectors)

    # ---- elasticidades empíricas (antes das instituições: alimentam a vulnerabilidade) ----
    from pipeline.models import elasticidades as ela_mod
    getter = lambda k: common.get_series(con, k)
    elast = ela_mod.estimate(getter, cfg["scenario"]["elasticities_inad_total"])

    # ---- Módulo 3: instituições (com capital real e vulnerabilidade a cenário severo) ----
    inst = build_institution_scores(con, cfg, elast["elasticidades"],
                                    cfg["scenario"]["presets"]["severamente_adverso"])
    common.write_gold("institutions.json", inst)

    # ---- Painel de inadimplência por instituição (v0.16) ----
    from pipeline import npl as npl_mod
    try:
        common.write_gold("npl.json", npl_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("npl.json", {"ok": False, "error": str(e)})

    # ---- Indicadores operacionais Fase 0: gente, rede e auditoria ----
    from pipeline import operacional as oper_mod
    try:
        common.write_gold("operacional.json", oper_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("operacional.json", {"disponivel": False, "error": str(e)})

    # ---- Compra de folha de servidores pelos bancos (curado + PNCP) ----
    from pipeline import folha_bancos as folha_mod
    try:
        folha_mod.build(con, cfg)
    except Exception as e:
        common.write_gold("folha_bancos.json", {"disponivel": False, "error": str(e)})

    # ---- Timeline regulatória transversal (curado) ----
    from pipeline import regulacao as reg_mod
    try:
        reg_mod.build(con, cfg)
    except Exception as e:
        common.write_gold("regulacao.json", {"disponivel": False, "error": str(e)})

    # ---- Guidance × entregue (Fase 2 — publica só aprovado) ----
    from pipeline import guidance_bancos as guid_mod
    try:
        guid_mod.build(con, cfg)
    except Exception as e:
        common.write_gold("guidance.json", {"disponivel": False, "error": str(e)})

    # ---- Exposição do sistema por setor e porte (carteiras reais) ----
    exposures = build_exposures(con, cfg)
    common.write_gold("exposures.json", exposures)

    # ---- Módulo 4: Open Finance (REAL desde a v0.12; demo apenas como fallback) ----
    from pipeline.indicators import build_openfinance_real
    of = build_openfinance_real(con, inst)
    if of is None:
        of = build_openfinance(OPEN_FINANCE_DEMO)
    common.write_gold("openfinance.json", of)

    # ---- Recuperações & Falências: séries REAIS (CNJ/DataJud) + fichas demo seladas ----
    rj = dict(RJ_DEMO)
    dj_cfg = cfg.get("datajud", {})
    tribs = dj_cfg.get("tribunais", [])
    series_reais = {}
    for slug in ("recuperacao_judicial", "falencia"):
        agg = _series_payload(con, f"{slug}_agregado", tail=120)
        por_trib = {}
        for t in tribs:
            p = _series_payload(con, f"{slug}_{t}", tail=120, with_yoy=False)
            if p:
                por_trib[t.upper()] = p
        if agg:
            fc_rj = None
            s_raw = common.get_series(con, f"{slug}_agregado")
            if len(s_raw) >= 48:
                fc_rj = fc.forecast_series([d for d, _ in s_raw], [v for _, v in s_raw],
                                           horizons, bt_pts, min_history=48)
                if fc_rj.get("ok"):  # contagens não podem ser negativas: trunca em zero
                    for p in fc_rj["pontos"]:
                        p["p10"] = max(p["p10"], 0.0)
                        p["p50"] = max(p["p50"], 0.0)
                        p["p90"] = max(p["p90"], 0.0)
                    fc_rj["limitacoes"] = (fc_rj.get("limitacoes", "") +
                                           " Quantis truncados em zero (série de contagem).")
            series_reais[slug] = {"agregado": agg, "por_tribunal": por_trib, "previsao": fc_rj,
                                  "cobertura": ", ".join(t.upper() for t in tribs)}
    rj["series_reais"] = series_reais
    # fichas nominais reais (DJEN/Comunica PJe)
    try:
        cur = con.execute("""SELECT numero_processo, tribunal, orgao, classe, empresas, cnpjs,
                                    valor_mencionado, tipos_documento, ultima_publicacao,
                                    n_publicacoes, link FROM rj_fichas
                             ORDER BY ultima_publicacao DESC LIMIT 60""")
        cols = ["numero_processo", "tribunal", "orgao", "classe", "empresas", "cnpjs",
                "valor_mencionado", "tipos_documento", "ultima_publicacao", "n_publicacoes", "link"]
        casos_reais = []
        for row in cur.fetchall():
            d = dict(zip(cols, row))
            d["empresas"] = json.loads(d["empresas"])
            d["cnpjs"] = json.loads(d["cnpjs"])
            d["tipos_documento"] = json.loads(d["tipos_documento"])
            casos_reais.append(d)
        # merge credores/passivo (rj_credores) + cadastro Receita (cnpj_cache)
        cred_map = {}
        try:
            for num, bancos, passivo, cnpjs_c, pclasses in con.execute(
                    "SELECT numero_processo, bancos, passivo_total, cnpjs, passivo_classes FROM rj_credores").fetchall():
                cred_map[num] = {"bancos": json.loads(bancos or "[]"), "passivo": passivo,
                                 "cnpjs": json.loads(cnpjs_c or "[]"),
                                 "passivo_classes": json.loads(pclasses or "{}")}
        except Exception:
            pass

        def _brl(v):
            try:
                return float(v.replace(".", "").replace(",", "."))
            except Exception:
                return None

        # cascata de passivo: (1) QGC por classe -> (2) citado no ato -> (3) estimado -> (4) não identificado
        obs_vals = [x for x in (_brl(c["passivo"]) for c in cred_map.values()) if x and x > 1e4]
        est_int = None
        if len(obs_vals) >= 8:
            sv = sorted(obs_vals)
            q = lambda p: sv[min(int(p * (len(sv) - 1)), len(sv) - 1)]
            est_int = [q(0.25), q(0.75)]
        for c in cred_map.values():
            if c["passivo_classes"]:
                c["nivel_passivo"] = "QGC por classe publicado"
            elif c["passivo"]:
                c["nivel_passivo"] = "citado no ato"
            elif est_int:
                c["nivel_passivo"] = "estimado (mediana da janela)"
                c["passivo_estimado_intervalo"] = est_int
            else:
                c["nivel_passivo"] = "não identificado"
        n_obs = sum(1 for c in cred_map.values() if c["passivo"])
        n_est = sum(1 for c in cred_map.values() if c.get("passivo_estimado_intervalo"))
        rj["passivo_janela"] = {
            "tipo": "APROXIMAÇÃO ESTATÍSTICA",
            "casos_total": len(cred_map), "casos_com_passivo_citado": n_obs,
            "passivo_citado_soma_brl": round(sum(obs_vals)) if obs_vals else None,
            "casos_estimados": n_est,
            "intervalo_por_caso_estimado_brl": est_int,
            "intervalo_estimado_total_brl": ([round(n_est * est_int[0]), round(n_est * est_int[1])]
                                             if est_int and n_est else None),
            "metodo": "Casos com passivo citado somados diretamente; casos sem valor recebem o intervalo "
                      "interquartil (p25–p75) dos passivos citados na mesma janela — NÍVEL ESTIMADO, nunca ponto.",
            "limitacoes": "Valores citados podem ser um único crédito e não o passivo total; a estimativa por "
                          "quartis assume que casos sem valor se distribuem como os com valor (viés provável: "
                          "casos maiores publicam mais). Somar níveis distintos exige cautela — exibidos separados.",
        }
        cnpj_map = {}
        try:
            for row in con.execute("SELECT cnpj, razao, cnae, cnae_desc, porte, uf, municipio, situacao FROM cnpj_cache").fetchall():
                cnpj_map[row[0]] = dict(zip(["cnpj", "razao", "cnae", "cnae_desc", "porte", "uf", "municipio", "situacao"], row))
        except Exception:
            pass
        import re as _re
        import unicodedata as _ud

        def _sem_acento(s):
            return _ud.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()

        _ALIAS = {"BRADESCO": "BANCO BRADESCO", "ITAU": "ITAU UNIBANCO", "SANTANDER": "BANCO SANTANDER"}

        def _canon_banco(nome):
            n = _sem_acento(nome).strip()
            return _ALIAS.get(n, n)

        _GENERICOS = {"INDUSTRIA", "COMERCIO", "IMPORTACAO", "EXPORTACAO", "LTDA", "EIRELI",
                      "BRASIL", "EMPRESA", "EMPREENDIMENTOS", "PARTICIPACOES", "SERVICOS",
                      "TRANSPORTES", "ALIMENTOS", "CONSTRUTORA", "COMERCIAL", "DISTRIBUIDORA",
                      "ATACADISTA", "VAREJISTA", "MASSA", "FALIDA", "RECUPERACAO", "JUDICIAL",
                      "AGRICOLA", "AGROPECUARIA", "PRODUTOS", "MATERIAIS", "EQUIPAMENTOS",
                      "SOLUCOES", "SISTEMAS", "GRUPO", "HOLDING", "COMPANHIA"}

        def _toks(s):
            # tokens distintivos: nomes genéricos de atividade/forma societária não contam
            return set(_re.findall(r"[A-Z]{4,}", _sem_acento(s))) - _GENERICOS

        def _match_cadastro(f):
            """Associa cadastro->recuperanda só com razão social compatível (>=2 tokens)."""
            # apenas CNPJs citados nos textos DO PRÓPRIO processo — sem busca global
            # (a varredura por razão social em todo o cache gera falsos vínculos)
            candidatos = [cnpj_map.get(_re.sub(r"\D", "", c))
                          for c in f.get("cnpjs", []) + f.get("credores", {}).get("cnpjs", [])]
            candidatos = [c for c in candidatos if c]
            for cad in candidatos:
                if not cad.get("razao"):
                    continue
                toks_cad = _toks(cad["razao"])
                for emp in f.get("empresas", []):
                    comum = toks_cad & _toks(emp)
                    # exige 2+ tokens distintivos, ou 1 token longo (>=7) e raro
                    if len(comum) >= 2 or any(len(t) >= 7 for t in comum):
                        return {**cad, "associacao": "razão social compatível"}
            return None
        if casos_reais:
            for f in casos_reais:
                cr_extra = cred_map.get(f["numero_processo"])
                if cr_extra:
                    f["credores"] = cr_extra
                cad = _match_cadastro(f)
                if cad:
                    f["cadastro_receita"] = cad
            # exposição agregada por banco na janela (níveis observada/parcialmente observada)
            expo = {}
            for num, c in cred_map.items():
                vistos_no_caso = set()
                for b in c["bancos"]:
                    canon = _canon_banco(b["nome"])
                    e = expo.setdefault(canon, {"banco": canon, "casos": 0,
                                                "com_valor": 0, "valores": []})
                    if canon in vistos_no_caso:
                        if b["valor"]:
                            e["com_valor"] += 1
                            e["valores"].append(b["valor"])
                        continue
                    vistos_no_caso.add(canon)
                    e["casos"] += 1
                    if b["valor"]:
                        e["com_valor"] += 1
                        e["valores"].append(b["valor"])
            rj["exposicao_citada"] = {
                "tipo": "DADO OBSERVADO (extração automática)",
                "janela_dias": 60,
                "bancos": sorted(expo.values(), key=lambda x: -x["casos"])[:20],
                "casos_com_credores": len(cred_map),
                "metodo": "Instituições financeiras citadas em publicações com 'relação de credores' "
                          "(DJEN) de processos de RJ/falência; 'observada' = valor adjacente ao nome no texto; "
                          "'parcialmente observada' = citação sem valor.",
                "limitacoes": "Presença em lista de credores NÃO mede a exposição total do banco; valores são "
                              "os citados no ato (podem ser um único crédito); janela de 60 dias, 8 tribunais; "
                              "nomes normalizados por regex podem fragmentar o mesmo conglomerado. "
                              "Casos sem menção = exposição NÃO IDENTIFICADA (ausência não é zero).",
            }
        if casos_reais:
            rj["casos_reais"] = {
                "tipo": "DADO OBSERVADO (extração automática)", "fichas": casos_reais,
                "janela_dias": cfg.get("djen", {}).get("janela_dias"),
                "metodo": "Comunicações do DJEN (API pública Comunica PJe/CNJ) das classes de RJ/falência, "
                          "agrupadas por processo. Empresas: destinatários com forma societária identificada "
                          "(pessoas físicas não são exibidas). CNPJ e valores: regex sobre o texto oficial.",
                "limitacoes": "Cobertura = processos COM publicação na janela (casos ativos), não o universo. "
                              "Valor mencionado é o citado no ato (crédito/habilitação), NÃO o passivo total — "
                              "conferir no processo. Extração automática sujeita a erros de regex.",
            }
    except Exception:
        pass
    # séries mensais por marco (convolações/extinções) — quando coletadas
    marcos_series = {}
    for mslug, mtitle in (("convolacao_falencia_agregado", "Convolações em falência/mês"),
                          ("extincao_rj_agregado", "Extinções de RJ/mês")):
        p = _series_payload(con, mslug, tail=90, with_yoy=True)
        if p:
            marcos_series[mslug] = {**p, "titulo": mtitle}
    if marcos_series:
        rj["marcos_series"] = marcos_series

    # funil processual real (marcos TPU por tribunal)
    try:
        cur = con.execute("""SELECT tribunal, codigo, nome, docs, total_classe FROM datajud_funil
                             ORDER BY tribunal, codigo""")
        funil_rows = cur.fetchall()
    except Exception:
        funil_rows = []
    if funil_rows:
        por_trib = {}
        for trib, cod, nome, docs, total in funil_rows:
            por_trib.setdefault(trib.upper(), {"total_classe129_docs": total, "marcos": []})
            por_trib[trib.upper()]["marcos"].append({"codigo": cod, "nome": nome, "processos_docs": docs})
        agg_marcos = {}
        agg_total = 0
        for t, d in por_trib.items():
            agg_total += d["total_classe129_docs"]
            for m in d["marcos"]:
                a = agg_marcos.setdefault(m["codigo"], {"codigo": m["codigo"], "nome": m["nome"], "processos_docs": 0})
                a["processos_docs"] += m["processos_docs"]
        rj["funil_processual"] = {
            "tipo": "DADO OBSERVADO", "por_tribunal": por_trib,
            "agregado": {"total_classe129_docs": agg_total,
                         "marcos": sorted(agg_marcos.values(), key=lambda x: -x["processos_docs"])},
            "metodo": "Nº de processos da classe 129 cujo histórico registra cada movimento-marco da TPU "
                      "(agregação no CNJ/DataJud). Rótulos = nome oficial do movimento nos próprios dados.",
            "limitacoes": "Contagem por documento do índice (G1/G2 podem duplicar levemente); movimentos "
                          "genéricos da TPU (ex.: 'Concessão', 'Extinção') lidos no contexto da classe 129; "
                          "'Homologação de Transação' não distingue plano de RJ de outros acordos.",
        }
    rj["series_reais_nota"] = ("Séries de ajuizamentos REAIS (CNJ/DataJud, dados abertos), cobertura restrita aos "
                               "tribunais listados e sujeita à completude do DataJud por período. Fichas nominais "
                               "REAIS via DJEN/Comunica PJe (empresas em RJ com publicação recente). O painel "
                               "demonstrativo permanece apenas para os campos ainda sem fonte pública "
                               "(lista de credores, exposição por banco, valor total declarado).")
    conf_to_class = {"declarada": "parcialmente observada", "lista_credores": "parcialmente observada",
                     "plano": "estimada", "estimada": "estimada"}
    casos = []
    for c in RJ_DEMO["casos"]:
        fin = c["divida_declarada_rmi"] * c["credores_financeiros_pct"] / 100
        casos.append({**c, "exposicao_financeira": {
            "classificacao": conf_to_class.get(c["confianca_divida"], "não identificada"),
            "intervalo_rmi": [round(fin * 0.7), round(fin * 1.3)],
            "metodo": "dívida declarada × % de credores financeiros, com banda de ±30% refletindo a incerteza da fonte",
            "aviso": "Exposição aproximada — nunca tratar como valor exato.",
        }})
    rj["casos"] = casos
    total_lo = sum(c["exposicao_financeira"]["intervalo_rmi"][0] for c in casos)
    total_hi = sum(c["exposicao_financeira"]["intervalo_rmi"][1] for c in casos)
    rj["exposicao_total_rmi"] = {"intervalo": [total_lo, total_hi],
                                 "aviso": "Soma de estimativas DEMONSTRATIVAS; duplicidades entre credores não eliminadas."}
    common.write_gold("rj.json", rj)

    # ---- Módulo 5: cenários ----
    scenario = {
        "tipo": "CENÁRIO",
        "elasticidades": cfg["scenario"]["elasticities_inad_total"],
        "presets": cfg["scenario"]["presets"],
        "nota": cfg["scenario"]["note"] + " Elasticidades estimadas para o agregado; aplicá-las a PF/PJ é aproximação adicional (sinalizada).",
        "base_forecast_inad_total": forecasts.get("inad_total"),
        "base_forecasts": {seg: forecasts.get(f"inad_{seg}") for seg in ("total", "pf", "pj")},
    }
    # scenario.json é gravado adiante, após a estimação das elasticidades empíricas

    # ---- Fase 2: antecedentes e regimes ----
    from pipeline.models import antecedentes as ant_mod, regimes as reg_mod
    antecedentes = {"targets": {}, "gerado_em": common.now_utc()}
    for tgt in ("inad_total", "inad_pf", "inad_pj"):
        r = ant_mod.evaluate_candidates(getter, tgt)
        if r:
            antecedentes["targets"][tgt] = r
    common.write_gold("antecedentes.json", antecedentes)

    regimes = reg_mod.detect(getter, [
        ("inad_total", "diff", "Inadimplência total (Δ mensal)", True),
        ("inad_pf", "diff", "Inadimplência PF (Δ mensal)", True),
        ("inad_pj", "diff", "Inadimplência PJ (Δ mensal)", True),
        ("concessoes_total", "yoy", "Concessões (var. interanual)", False),
        ("saldo_total", "yoy", "Saldo de crédito (var. interanual)", False),
        ("spread_total", "diff", "Spread médio (Δ mensal)", True),
    ])
    common.write_gold("regimes.json", regimes)

    scenario["elasticidades"] = elast["elasticidades"]
    scenario["elasticidades_origem"] = elast["origem"]
    scenario["elasticidades_detalhe"] = elast["detalhe"]
    common.write_gold("scenario.json", scenario)

    # ---- Alertas (com histórico, recorrência e hipóteses de regime) ----
    from pipeline import alerts as alerts_mod
    alert_list = alerts_mod.evaluate(con, cfg)
    def _months_ago(iso):
        return (int(today[:4]) - int(iso[:4])) * 12 + int(today[5:7]) - int(iso[5:7])
    for r in regimes["series"]:
        br = r.get("quebra_estrutural")
        # alerta apenas para quebras recentes (<=24 meses): quebra antiga é contexto, não notícia
        if (br and br["significativa"] and br["direcao"] == "deterioração"
                and r["estado_hipotese"] != "estabilização/melhora" and _months_ago(br["data_quebra"]) <= 24):
            alert_list.append({
                "id": f"regime:{r['serie']}", "nivel": "atencao",
                "titulo": f"Hipótese de mudança de regime: {r['label']}",
                "explicacao": (f"Quebra estrutural candidata em {br['data_quebra']} (sup-F {br['supF']} > "
                               f"crítico aprox. {br['critico_5pct_aprox']}); média passou de {br['media_antes']} "
                               f"para {br['media_depois']}. CUSUM: {r['cusum']['ultimo_disparo']['data'] if r['cusum'] and r['cusum']['ultimo_disparo'] else 'sem disparo'}. "
                               "HIPÓTESE ESTATÍSTICA, não fato — sujeita a revisões."),
                "serie": r["serie"], "valor": br["supF"], "limiar": br["critico_5pct_aprox"],
                "fonte": "detector de regimes (calculado)",
            })
    common.write_gold("alerts.json", {"gerado_em": common.now_utc(), "alertas": alert_list,
                                      "historico": alerts_mod.history(con),
                                      "regras_configuradas": cfg["alerts"]["rules"],
                                      "niveis": ["informativo", "atencao", "relevante", "critico"]})

    # ---- Visão geral analítica (diagnóstico + mudanças) ----
    from pipeline import overview as ov
    changes = ov.build_changes(con)
    qvals = []
    cur = con.execute("SELECT key FROM series_meta")
    for (k,) in cur.fetchall():
        q = series_quality(con, k, today)
        if q:
            qvals.append(q["score"])
    qavg = sum(qvals) / len(qvals) if qvals else None
    diagnosis = ov.build_diagnosis(con, ibcc, changes, sectors, qavg)
    common.write_gold("overview.json", {
        "gerado_em": common.now_utc(),
        "diagnostico": diagnosis,
        "mudancas": changes,
        "ibcc_posicao": ov.build_ibcc_position(ibcc),
        "projecoes_resumo": {
            "inad_total": forecasts.get("inad_total"),
            "concessoes_total": forecasts.get("concessoes_total"),
            "spread_total": forecasts.get("spread_total"),
            "rj": (
                {"demo": False, "selo": "PREVISÃO",
                 "previsao": series_reais["recuperacao_judicial"]["previsao"],
                 "cobertura": series_reais["recuperacao_judicial"]["cobertura"],
                 "nota": "Ajuizamentos de RJ (CNJ/DataJud) — agregado dos tribunais cobertos."}
                if series_reais.get("recuperacao_judicial", {}).get("previsao", {}) and
                   series_reais["recuperacao_judicial"]["previsao"] and
                   series_reais["recuperacao_judicial"]["previsao"].get("ok")
                else {"demo": True, "selo": "DADO DEMONSTRATIVO",
                      "nota": "Projeção de RJ aguarda histórico suficiente do DataJud."}),
        },
    })

    # ---- Metodologia viva ----
    model_cards = ov.build_model_cards(forecasts, ibcc, inst, sectors)
    for card in model_cards:
        card["atualizado_em"] = common.now_utc()
    common.write_gold("method.json", {
        "dicionario_indicadores": ov.INDICATOR_DICTIONARY,
        "model_cards": model_cards,
        "score_cards": ov.SCORE_CARDS,
        "changelog": ov.CHANGELOG,
        "fontes_status": fetch_status,
    })

    # ---- Páginas individuais de instituições (universo completo, formato v0.14) ----
    from pipeline import inst_pages as ip_mod
    from pipeline import inst_pages_all as ipa_mod
    try:
        inst_pages_payload = ip_mod.build(con, cfg, inst, of, None)
        common.write_gold("inst_pages.json", inst_pages_payload)  # pilotos + cobertura (§22)
    except Exception as e:
        common.write_gold("inst_pages.json", {"ok": False, "error": str(e)})
    try:
        res_all = ipa_mod.build_all(con, cfg, inst, of)
        print(f"  [inst_pages_all] {res_all.get('paginas')} páginas geradas")
    except Exception as e:
        common.write_gold("inst_index.json", {"ok": False, "error": str(e)})

    # ---- Fase 6: relatório automático + RSS de alertas ----
    quality_tmp = {}
    cur = con.execute("SELECT key FROM series_meta")
    for (k,) in cur.fetchall():
        q = series_quality(con, k, today)
        if q:
            quality_tmp[k] = q
    from pipeline import report as report_mod
    report_mod.build(cfg, {
        "overview": json.load(open(os.path.join(common.GOLD, "overview.json"), encoding="utf-8")),
        "pulse": pulse, "sectors": sectors, "institutions": inst, "rj": rj,
        "alerts": {"alertas": alert_list}, "scenario": scenario, "quality": quality_tmp,
    })

    # ---- Qualidade e linhagem ----
    cur = con.execute("SELECT key FROM series_meta ORDER BY key")
    quality = {}
    for (k,) in cur.fetchall():
        q = series_quality(con, k, today)
        if q:
            meta = common.get_meta(con, k)
            quality[k] = {**q, "nome": meta["name"], "fonte": meta["source"]}
    common.write_gold("quality.json", quality)

    cur = con.execute("SELECT gold_object, bronze_file, sha256, transform, created_at FROM lineage ORDER BY created_at DESC LIMIT 200")
    lineage_rows = [dict(zip(["gold_object", "bronze_file", "sha256", "transform", "created_at"], r)) for r in cur.fetchall()]
    cur = con.execute("SELECT COUNT(*) FROM revisions")
    n_rev = cur.fetchone()[0]
    cur = con.execute("SELECT key, ref_date, old_value, new_value, detected_at FROM revisions ORDER BY detected_at DESC LIMIT 50")
    revs = [dict(zip(["key", "ref_date", "old_value", "new_value", "detected_at"], r)) for r in cur.fetchall()]
    common.write_gold("lineage.json", {"linhagem_recente": lineage_rows, "n_revisoes_total": n_rev, "revisoes_recentes": revs})

    # ---- Meta ----
    # ---- Camada de pesquisa: catálogo de métricas + produtos ----
    try:
        from pipeline import compare as compare_mod
        print("compare:", compare_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("compare.json", {"ok": False, "error": str(e)})
    try:
        from pipeline import leading as leading_mod
        print("leading:", leading_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("leading.json", {"ok": False, "error": str(e)})
    try:
        from pipeline import judicial as judicial_mod
        print("judicial:", judicial_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("judicial.json", {"disponivel": False, "error": str(e)})
    try:
        from pipeline import pix as pix_mod
        print("pix:", pix_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("pix.json", {"disponivel": False, "error": str(e)})
    try:
        from pipeline import panorama as panorama_mod
        print("panorama:", panorama_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("panorama.json", {"disponivel": False, "error": str(e)})
    try:
        from pipeline import trends as trends_mod
        print("trends:", trends_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("trends.json", {"disponivel": False, "error": str(e)})
    try:
        from pipeline import market as market_mod
        print("market:", market_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("market.json", {"ok": False, "error": str(e)})
    try:
        from pipeline import products as products_mod
        print("products:", products_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("products.json", {"ok": False, "error": str(e)})
    try:
        from pipeline import pgfn as pgfn_mod
        print("pgfn:", pgfn_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("pgfn.json", {"disponivel": False, "error": str(e)})

    # ---- Central de alertas: consolida as cinco famílias num só arquivo ----
    # Precisa vir DEPOIS de leading e panorama: lê os gold já escritos (alerts,
    # panorama, openfinance, leading) e normaliza. Rodando antes, leria a
    # execução anterior — ou nada, num checkout limpo. O feed alerts.xml mantém
    # a URL: quem já assinava passa a receber todas as famílias, não só a macro.
    try:
        from pipeline import penetracao as pen_mod
        print("penetracao:", pen_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("penetracao.json", {"disponivel": False, "error": str(e)})

    try:
        from pipeline import desenrola as desenrola_mod
        print("desenrola:", desenrola_mod.build(con, cfg))
    except Exception as e:
        common.write_gold("desenrola.json", {"disponivel": False, "error": str(e)})

    # Moradia depende das mesmas tabelas que penetracao (estban_*, censo_*) mais
    # mi_serie. Fica depois dela para que a exclusão da data-base subcoletada, que
    # penetracao define, já esteja aplicada.
    try:
        from pipeline import moradia as moradia_mod
        r_mor = moradia_mod.build(con, cfg)
        common.write_gold("moradia.json", r_mor)
        print(f"  [moradia] {r_mor['totais']['municipios_com_saldo']} municípios com saldo, "
              f"{r_mor['totais']['instituicoes_no_169']} instituições no verbete 169")
    except Exception as e:
        common.write_gold("moradia.json", {"disponivel": False, "error": str(e)})

    # Consignado depende de censo_idade, prev_mun, scr_uf_ocup_produto, series_obs (IPCA e
    # séries do consignado) e reclam_consig_*. Fica por último entre os módulos municipais
    # porque reaproveita helpers de penetracao e moradia.
    try:
        from pipeline import consignado as consig_mod
        r_cg = consig_mod.build(con, cfg)
        common.write_gold("consignado.json", r_cg)
        if r_cg.get("ok"):
            print(f"  [consignado] {r_cg['totais']['municipios']} municípios, "
                  f"correlação observada {r_cg['circularidade']['correlacao_observada']} "
                  f"contra mecânica {r_cg['circularidade']['correlacao_mecanica']}")
        else:
            print(f"  [consignado] indisponível: {r_cg.get('motivo')}")
    except Exception as e:
        common.write_gold("consignado.json", {"ok": False, "error": str(e)})

    # Os três golds municipais carregam um array de 5.570 municípios que domina o
    # tamanho do arquivo (até 7 MB) e muda em ritmo diferente do resto: municípios na
    # data-base mensal, agregados e séries na rodada diária. Separar o array em
    # {nome}_mun.json dá ao navegador cache granular — o arquivo grande só é rebaixado
    # quando a data-base muda — e o front carrega os dois em paralelo pelo manifesto.
    def separa_municipios(nome):
        import json as _json
        caminho = os.path.join(common.GOLD, f"{nome}.json")
        if not os.path.exists(caminho):
            return
        with open(caminho, encoding="utf-8") as f:
            g = _json.load(f)
        muns = g.pop("municipios", None)
        if muns is None:
            return
        g["municipios_arquivo"] = f"{nome}_mun.json"
        common.write_gold(f"{nome}_mun.json", {"municipios": muns})
        common.write_gold(f"{nome}.json", g)
        print(f"  [{nome}] municípios separados: {len(muns)} em {nome}_mun.json")
    for _nome in ("penetracao", "moradia", "consignado"):
        separa_municipios(_nome)


    from pipeline import central_alertas
    central = central_alertas.build()
    common.write_gold_text("alerts.xml", central_alertas.rss(central))
    print(f"  [central_alertas] {central['total']} alertas em "
          f"{len([f for f in central['familias'] if f['ativos']])} famílias ativas")

    # vintages reais por fonte (a UI mostra "dados até X · processado em Y" por página)
    def _vg(sql):
        try:
            v = con.execute(sql).fetchone()[0]
            if v is None:
                return None
            v = str(v)
            return f"{v[:4]}-{v[4:6]}" if len(v) == 6 and v.isdigit() else v[:7]
        except Exception:
            return None
    vintages = {
        "sgs": _vg("SELECT MAX(ref_date) FROM series_obs WHERE key='inad_total'"),
        "ifdata": _vg("SELECT MAX(anomes) FROM institution_metrics"),
        "scr": _vg("SELECT MAX(data) FROM scr_uf"),
        "b3": _vg("SELECT MAX(date) FROM market_prices"),
        "fidc": _vg("SELECT MAX(anomes) FROM fidc_agg"),
        "datajud": _vg("SELECT MAX(ref_date) FROM series_obs WHERE key='recuperacao_judicial_agregado'"),
        "trends": _vg("SELECT MAX(anomes) FROM trends_series WHERE anomes < '2026-07'"),
        "txjuros": _vg("SELECT MAX(fim) FROM taxas_inst"),
    }
    # as três inadimplências, com valores vivos do MESMO acervo (verbete + chips na UI)
    inad = {}
    try:
        v, d = con.execute("SELECT value, ref_date FROM series_obs WHERE key='inad_total' ORDER BY ref_date DESC LIMIT 1").fetchone()
        inad["sgs"] = {"v": round(v, 2), "ref": d[:7],
                       "def": "parcelas em atraso superior a 90 dias ÷ carteira do crédito referencial (BCB/SGS 21082)."}
    except Exception:
        pass
    try:
        r = con.execute("SELECT SUM(inad), SUM(saldo), MAX(data) FROM scr_uf WHERE data=(SELECT MAX(data) FROM scr_uf)").fetchone()
        inad["scr"] = {"v": round(r[0] / r[1] * 100, 2), "ref": r[2],
                       "def": "inadimplência ARRASTADA: operações com qualquer parcela vencida >90d contadas por inteiro ÷ carteira ativa (SCR.data)."}
    except Exception:
        pass
    inad["atraso15"] = {"v": None, "ref": vintages.get("ifdata"),
                        "def": "atraso ≥15 dias por operação (coluna 'Vencido a Partir de 15 Dias', IF.data) — varia por produto e instituição; não existe como taxa única nacional."}
    common.write_gold("meta.json", {
        "plataforma": cfg["platform"],
        "gerado_em": common.now_utc(),
        "vintages": vintages,
        "inad_conceitos": inad,
        "fontes_status": fetch_status,
        "fontes_reais": ["BCB/SGS", "BCB/IF.data (Olinda)", "IBGE", "Ipeadata"],
        "fontes_demo": ["Open Finance Brasil (dashboard)", "Recuperação judicial (tribunais)"],
    })

    # ---- Módulos curados (Riscos emergentes: bets, fraudes, ...) ----
    # Dados administrativos de publicação semestral/anual, pesquisas oficiais
    # e bibliotecas de evidências mantidos por curadoria manual documentada
    # (FONTES_BETS.md, FONTES_FRAUDES.md). Sem API pública consolidada: cada
    # arquivo curado é a fonte de verdade e é copiado ao gold para sobreviver
    # ao rsync --delete do CI. Nunca gerar série sintética a partir deles.
    curated_dir = os.path.join(os.path.dirname(__file__), "curated")
    if os.path.isdir(curated_dir):
        for fname in sorted(os.listdir(curated_dir)):
            if fname.endswith(".json"):
                with open(os.path.join(curated_dir, fname), encoding="utf-8") as f:
                    common.write_gold(fname, json.load(f))

    # ---- EPAE: fluxos Pix da seção CNAE de artes, cultura, esporte e recreação ----
    # Insumo público dos estudos que atribuem parcela às bets. Republicado como
    # dado OBSERVADO da seção inteira; a atribuição a apostas fica com quem a faz.
    from pipeline import epae as epae_mod
    epae_mod.build(con)

    # ---- Presença bancária física por município (dependências + correspondentes) ----
    from pipeline import presenca as presenca_mod
    presenca_mod.build(con, cfg)

    # ---- Taxas de juros por modalidade × IF (txjuros) ----
    from pipeline import juros as juros_mod
    juros_mod.build(con)
