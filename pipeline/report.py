"""Relatório automático (Fase 6) — HTML autocontido gerado pelo pipeline.

Texto produzido por REGRAS DETERMINÍSTICAS sobre a camada gold, com cada parágrafo
classificado: [OBSERVAÇÃO], [INTERPRETAÇÃO], [CALCULADO], [PREVISÃO], [CENÁRIO] ou
[DEMONSTRATIVO] (briefing §28). Imprimível para PDF pelo navegador.
Saída: data/gold/report.html (publicada junto com os dados).
"""
from pipeline import common

CSS = """
body{font-family:Georgia,'Iowan Old Style',serif;max-width:820px;margin:24px auto;padding:0 20px;
color:#1a2332;line-height:1.55;font-size:14.5px}
h1{font-size:24px;border-bottom:3px solid #14243a;padding-bottom:8px}
h2{font-size:17px;margin-top:26px;color:#14243a}
.meta{color:#667;font-size:12px}
.tag{display:inline-block;font-family:Helvetica,Arial,sans-serif;font-size:9.5px;font-weight:700;
letter-spacing:.5px;padding:1px 6px;border-radius:3px;vertical-align:middle;margin-right:6px}
.obs{background:#e7f3ec;color:#2f7d4f}.interp{background:#eef2f7;color:#1d4e89}
.calc{background:#eef4f0;color:#33635a}.prev{background:#e8eef7;color:#1d4e89}
.cen{background:#efe9f7;color:#6b46a3}.demo{background:#fdf0e3;color:#b45309;border:1px dashed #b45309}
table{border-collapse:collapse;width:100%;font-size:13px;font-family:Helvetica,Arial,sans-serif}
th,td{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left}
th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#556}
.src{color:#778;font-size:11.5px}
.aviso{background:#fdf6ec;border:1px solid #e8d5b0;border-radius:6px;padding:10px 14px;font-size:12.5px}
@media print{body{margin:8mm}h2{break-after:avoid}table,p{break-inside:avoid}}
"""

TAGS = {"obs": "OBSERVAÇÃO", "interp": "INTERPRETAÇÃO", "calc": "CALCULADO",
        "prev": "PREVISÃO", "cen": "CENÁRIO", "demo": "DEMONSTRATIVO"}


def _tag(kind):
    return f'<span class="tag {kind}">{TAGS[kind]}</span>'


def _fmt(v, d=2):
    if v is None:
        return "–"
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _p(kind, text):
    return f"<p>{_tag(kind)} {text}</p>"


def build(cfg, ctx):
    """ctx: dict com payloads gold (pulse, overview, ibcc, sectors, institutions, rj,
    exposures, alerts, scenario, quality)."""
    plat = cfg["platform"]
    ov, pulse = ctx["overview"], ctx["pulse"]
    diag = ov.get("diagnostico", {})
    chg = ov.get("mudancas", {})
    pos = ov.get("ibcc_posicao", {})
    gerado = common.now_utc()

    parts = [f"<h1>{plat['name']} — Relatório automático</h1>",
             f'<p class="meta">Gerado pelo pipeline em {gerado} · versão {plat["version"]} · '
             f'Este texto é produzido por regras determinísticas auditáveis sobre dados públicos — '
             f'não é redação livre de modelo de linguagem.</p>',
             f'<div class="aviso">{plat["disclaimer"]}</div>']

    # 1. sumário executivo
    parts.append("<h2>1 · Sumário executivo</h2>")
    if diag.get("ok"):
        parts.append(_p("calc", f"{diag['frase']} (confiança {diag['confianca']}: {diag['confianca_motivo']})"))
    inad = pulse["series"].get("inad_total")
    f12 = pulse["previsoes"].get("inad_total", {})
    if inad and f12.get("ok"):
        last = inad["obs"][-1]
        p12 = f12["pontos"][-1]
        parts.append(_p("obs", f"A inadimplência total (>90 dias) está em {_fmt(last['v'])}% "
                              f"(ref. {last['ref'][:7]}, BCB/SGS 21082)."))
        parts.append(_p("prev", f"Projeção para {p12['ref_date'][:7]}: {_fmt(p12['p50'])}% "
                               f"[{_fmt(p12['p10'])}–{_fmt(p12['p90'])}] — ensemble com backtest, "
                               f"bandas por quantis de resíduos fora da amostra."))

    # 2. pulso e mudanças
    parts.append("<h2>2 · Pulso do crédito e mudanças desde a última atualização</h2>")
    det = chg.get("top_deterioracoes", [])
    mel = chg.get("top_melhoras", [])
    if det:
        parts.append(_p("calc", "Principais deteriorações no mês (Δ normalizado pelo padrão histórico): "
                        + "; ".join(f"{r['indicador']} ({r['delta_1m']:+.2f})" for r in det[:5]) + "."))
    if mel:
        parts.append(_p("calc", "Principais melhoras: "
                        + "; ".join(f"{r['indicador']} ({r['delta_1m']:+.2f})" for r in mel[:5]) + "."))
    parts.append(_p("interp", "Leituras de variação mensal devem considerar sazonalidade e revisões; "
                              "as classificações acima usam a direção econômica de cada indicador."))

    # 3. alertas
    al = ctx["alerts"].get("alertas", [])
    parts.append("<h2>3 · Alertas ativos</h2>")
    if al:
        rows = "".join(f"<tr><td>{a['nivel']}</td><td>{a['titulo']}</td><td class='src'>{a.get('fonte','')}</td></tr>" for a in al[:10])
        parts.append(f"<table><tr><th>Nível</th><th>Alerta</th><th>Fonte</th></tr>{rows}</table>")
    else:
        parts.append(_p("obs", "Nenhum alerta ativo na execução atual."))

    # 4. setores
    sec = ctx["sectors"]
    parts.append("<h2>4 · Risco setorial</h2>")
    if sec.get("ok"):
        worst = sec["setores"][:5]
        best = sorted(sec["setores"], key=lambda s: s["score"])[:3]
        parts.append(_p("calc", "Maior estresse (score 0–100; componentes de atividade e condições de "
                        "crédito observados; RJ e emprego demonstrativos): "
                        + "; ".join(f"{s['nome']} ({s['score']}, {s['tendencia']})" for s in worst) + "."))
        parts.append(_p("calc", "Menor estresse: " + "; ".join(f"{s['nome']} ({s['score']})" for s in best) + "."))

    # 5. instituições
    inst = ctx["institutions"]
    parts.append("<h2>5 · Instituições financeiras</h2>")
    if inst.get("ok"):
        top = [i for i in inst["instituicoes"] if i.get("score_delta") is not None]
        top.sort(key=lambda i: -abs(i["score_delta"]))
        parts.append(_p("calc", f"Score de risco relativo aos pares (IF.data {inst['anomes']}; "
                        "maior = mais risco no grupo prudencial). Maiores variações no trimestre: "
                        + "; ".join(f"{i['nome']} ({i['score']}, {i['score_delta']:+.1f})" for i in top[:5]) + "."))
        parts.append(_p("obs", "Basileia dos cinco maiores por ativo: "
                        + "; ".join(f"{i['nome']} {_fmt(i['basileia_pct'], 1)}%" for i in inst["instituicoes"][:5] if i.get("basileia_pct")) + "."))
        parts.append(_p("interp", inst.get("aviso", "")))

    # 6. recuperação judicial
    rj = ctx["rj"]
    parts.append("<h2>6 · Recuperações judiciais e falências</h2>")
    sr = rj.get("series_reais", {})
    if sr.get("recuperacao_judicial"):
        agg = sr["recuperacao_judicial"]["agregado"]
        last = agg["obs"][-1]
        y = sum(o["v"] for o in agg["obs"] if o["ref"][:4] == "2025")
        parts.append(_p("obs", f"Ajuizamentos de RJ (CNJ/DataJud, {sr['recuperacao_judicial']['cobertura']}): "
                              f"{int(last['v'])} em {last['ref'][:7]}; {int(y)} em 2025."))
        fr = sr["recuperacao_judicial"].get("previsao")
        if fr and fr.get("ok"):
            p = fr["pontos"][-1]
            parts.append(_p("prev", f"Projeção 12m: {int(p['p50'])} [{int(p['p10'])}–{int(p['p90'])}] processos/mês."))
    ex = rj.get("exposicao_citada")
    if ex:
        parts.append(_p("obs", f"Credores financeiros citados em listas de credores ({ex['janela_dias']} dias, "
                              f"{ex['casos_com_credores']} casos): "
                        + "; ".join(f"{b['banco']} ({b['casos']} casos)" for b in ex["bancos"][:5]) + "."))
        parts.append(_p("interp", "Presença em lista de credores não mede exposição total; ver limitações no site."))
    pjw = rj.get("passivo_janela")
    if pjw and pjw.get("passivo_citado_soma_brl"):
        parts.append(_p("obs", f"Passivo citado em atos: R$ {_fmt(pjw['passivo_citado_soma_brl']/1e9)} bi "
                              f"em {pjw['casos_com_passivo_citado']} casos."))
        if pjw.get("intervalo_estimado_total_brl"):
            lo, hi = pjw["intervalo_estimado_total_brl"]
            parts.append(_p("cen", f"Para os {pjw['casos_estimados']} casos sem valor citado, o intervalo "
                                  f"interquartil implica R$ {_fmt(lo/1e6, 0)} mi – R$ {_fmt(hi/1e9)} bi "
                                  f"(aproximação estatística; níveis nunca somados)."))

    # 7. open finance (demo)
    parts.append("<h2>7 · Open Finance</h2>")
    parts.append(_p("demo", "Módulo integralmente demonstrativo: não há via pública estável para os dados "
                            "nominais do dashboard Open Finance Brasil. Método pronto para substituição."))

    # 8. projeções e cenários
    parts.append("<h2>8 · Projeções e cenários</h2>")
    for tgt, label, unit in (("concessoes_total", "Concessões", " R$ mi"), ("spread_total", "Spread", " p.p.")):
        f = pulse["previsoes"].get(tgt, {})
        if f.get("ok"):
            p = f["pontos"][-1]
            parts.append(_p("prev", f"{label} em {p['ref_date'][:7]}: {_fmt(p['p50'], 1)}{unit} "
                                   f"[{_fmt(p['p10'], 1)}–{_fmt(p['p90'], 1)}]."))
    scn = ctx["scenario"]
    parts.append(_p("cen", f"Elasticidades de cenário ({scn.get('elasticidades_origem', 'ilustrativa')}): "
                    + "; ".join(f"{k} {v['value']} [{v['range'][0]}–{v['range'][1]}]"
                                for k, v in scn["elasticidades"].items())
                    + ". Resultados de cenário são condicionais às hipóteses do usuário."))

    # 9. metodologia, fontes e limitações
    parts.append("<h2>9 · Metodologia, fontes e limitações</h2>")
    parts.append(_p("obs", "Fontes reais: BCB/SGS, BCB/IF.data (Olinda e interface), IBGE, Ipeadata, "
                           "CNJ/DataJud, CNJ/DJEN, BrasilAPI/Receita. Linhagem bronze→gold com SHA-256 "
                           "e catálogo completo na aba Metodologia & Fontes."))
    qv = ctx["quality"]
    if qv:
        media = sum(q["score"] for q in qv.values()) / len(qv)
        parts.append(_p("calc", f"Qualidade média das {len(qv)} séries: {_fmt(media, 0)}/100."))
    parts.append(_p("interp", "Limitações completas em docs/LIMITACOES.md e nos rodapés de cada visualização. "
                              "Scores e projeções não constituem rating nem recomendação."))

    html = (f"<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
            f"<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>{plat['name']} — Relatório</title><style>{CSS}</style></head><body>"
            + "\n".join(parts)
            + "<script>/* imprimível: Ctrl/Cmd+P gera o PDF */</script></body></html>")
    path = common.write_gold_text("report.html", html)
    return path
