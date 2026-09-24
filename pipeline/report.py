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

MESES = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")
MENOS = "\u2212"  # sinal de menos: número negativo não usa hífen


def _tag(kind):
    return f'<span class="tag {kind}">{TAGS[kind]}</span>'


def _fmt(v, d=2):
    """Número em formato brasileiro; negativo com sinal de menos tipográfico."""
    if v is None:
        return "n/d"
    s = f"{abs(v):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{MENOS}{s}" if v < 0 and round(v, d) != 0 else s


def _fmt_sinal(v, d=2):
    if v is None:
        return "n/d"
    s = _fmt(v, d)
    return f"+{s}" if v > 0 and round(v, d) != 0 else s


def _mes(ref):
    """'2026-07-01' → 'jul/2026'."""
    r = str(ref or "")
    if len(r) >= 7 and r[4] == "-" and r[5:7].isdigit() and 1 <= int(r[5:7]) <= 12:
        return f"{MESES[int(r[5:7]) - 1]}/{r[:4]}"
    return r


def _ultimo_ano_completo(obs):
    """Último ano civil com os 12 meses presentes na série (nunca ano fixo no código)."""
    por_ano = {}
    for o in obs:
        if o.get("v") is not None:
            por_ano.setdefault(o["ref"][:4], set()).add(o["ref"][5:7])
    completos = [a for a, ms in por_ano.items() if len(ms) == 12]
    return max(completos) if completos else None


def _p(kind, text):
    return f"<p>{_tag(kind)} {text}</p>"


def build(cfg, ctx):
    """ctx: dict com payloads gold (pulse, overview, ibcc, sectors, institutions, rj,
    exposures, alerts, scenario, quality). Regra nominal (docs/CONSTITUICAO.md, art. 5):
    nenhum score, faixa ou variação de score aparece ao lado de nome de instituição, e
    nenhuma instituição é nomeada por casamento de nome em listas de credores."""
    plat = cfg["platform"]
    ov, pulse = ctx["overview"], ctx["pulse"]
    diag = ov.get("diagnostico", {})
    chg = ov.get("mudancas", {})
    gerado = common.now_utc()

    parts = [f"<h1>{plat['name']}: relatório automático</h1>",
             f'<p class="meta">Gerado pelo pipeline em {gerado} · versão {plat["version"]} · '
             f'Este texto é produzido por regras determinísticas auditáveis sobre dados públicos; '
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
        parts.append(_p("obs", f"A inadimplência total (acima de 90 dias) está em {_fmt(last['v'])}% "
                              f"(referência {_mes(last['ref'])}, BCB/SGS 21082)."))
        parts.append(_p("prev", f"Projeção para {_mes(p12['ref_date'])}: {_fmt(p12['p50'])}% "
                               f"[{_fmt(p12['p10'])} a {_fmt(p12['p90'])}], conjunto de modelos com backtest; "
                               f"bandas por quantis de resíduos fora da amostra."))

    # 2. pulso e mudanças
    parts.append("<h2>2 · Pulso do crédito e mudanças desde a última atualização</h2>")
    det = chg.get("top_deterioracoes", [])
    mel = chg.get("top_melhoras", [])

    def _mud(r):
        un = r.get("unidade") or ""
        dun = " p.p." if un.startswith("%") or un == "p.p." else f" {un}".rstrip()
        return (f"{r['indicador']} ({_fmt_sinal(r.get('delta_1m'))}{dun} no mês; "
                f"{_fmt(r.get('relevancia_z'))} desvios do padrão histórico de variações)")
    if det:
        parts.append(_p("calc", "Principais deteriorações no mês, ordenadas pela variação normalizada "
                                "pelo padrão histórico: " + "; ".join(_mud(r) for r in det[:5]) + "."))
    if mel:
        parts.append(_p("calc", "Principais melhoras: " + "; ".join(_mud(r) for r in mel[:5]) + "."))
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
        parts.append(_p("calc", "Maior estresse (score de 0 a 100; componentes de atividade e condições de "
                        "crédito observados): "
                        + "; ".join(f"{s['nome']} ({_fmt(s['score'], 1)}, {s['tendencia']})" for s in worst) + "."))
        parts.append(_p("calc", "Menor estresse: " + "; ".join(f"{s['nome']} ({_fmt(s['score'], 1)})" for s in best) + "."))

    # 5. instituições: só métricas observadas (regra nominal)
    inst = ctx["institutions"]
    parts.append("<h2>5 · Instituições financeiras</h2>")
    if inst.get("ok"):
        com_bas = [i for i in inst["instituicoes"][:5] if i.get("basileia_pct") is not None]
        if com_bas:
            parts.append(_p("obs", f"Índice de Basileia dos cinco maiores conglomerados por ativo (IF.data, "
                                   f"data base {inst['anomes'][:4]}/{inst['anomes'][4:]}): "
                            + "; ".join(f"{i['nome']} {_fmt(i['basileia_pct'], 1)}%" for i in com_bas) + "."))
        parts.append(_p("interp", "Score composto e faixa de risco não são publicados por instituição nomeada "
                                  "(regra editorial de 24/09/2026): as faixas não foram calibradas contra desfechos. "
                                  "A distribuição anônima do score por grupo de pares está em institutions.json."))

    # 6. recuperação judicial
    rj = ctx["rj"]
    parts.append("<h2>6 · Recuperações judiciais e falências</h2>")
    sr = rj.get("series_reais", {})
    if sr.get("recuperacao_judicial"):
        agg = sr["recuperacao_judicial"]["agregado"]
        last = agg["obs"][-1]
        ano = _ultimo_ano_completo(agg["obs"])
        soma = f"; {_fmt(sum(o['v'] for o in agg['obs'] if o['ref'][:4] == ano), 0)} em {ano}" if ano else ""
        parts.append(_p("obs", f"Ajuizamentos de RJ (CNJ/DataJud, {sr['recuperacao_judicial']['cobertura']}): "
                              f"{_fmt(last['v'], 0)} em {_mes(last['ref'])}{soma}. Os meses mais recentes "
                              f"podem estar incompletos por latência de registro na fonte."))
        fr = sr["recuperacao_judicial"].get("previsao")
        if fr and fr.get("ok"):
            p = fr["pontos"][-1]
            parts.append(_p("prev", f"Projeção em 12 meses: {_fmt(p['p50'], 0)} [{_fmt(p['p10'], 0)} a {_fmt(p['p90'], 0)}] processos por mês."))
    ex = rj.get("exposicao_citada")
    if ex:
        parts.append(_p("obs", f"Casos com credores financeiros citados em listas de credores ({ex['janela_dias']} dias): "
                              f"{_fmt(ex['casos_com_credores'], 0)}. As instituições não são nomeadas aqui: "
                              f"as listas não trazem CNPJ do credor."))
    pjw = rj.get("passivo_janela")
    if pjw and pjw.get("passivo_citado_soma_brl"):
        parts.append(_p("obs", f"Passivo citado em atos: R$ {_fmt(pjw['passivo_citado_soma_brl']/1e9)} bilhões "
                              f"em {_fmt(pjw['casos_com_passivo_citado'], 0)} casos."))
        if pjw.get("intervalo_estimado_total_brl"):
            lo, hi = pjw["intervalo_estimado_total_brl"]
            parts.append(_p("cen", f"Para os {_fmt(pjw['casos_estimados'], 0)} casos sem valor citado, o intervalo "
                                  f"interquartil implica de R$ {_fmt(lo/1e6, 0)} milhões a R$ {_fmt(hi/1e9)} bilhões "
                                  f"(aproximação estatística; níveis nunca somados)."))

    # 7. open finance
    parts.append("<h2>7 · Open Finance</h2>")
    parts.append(_p("obs", "Indicadores agregados do Open Finance Brasil na aba própria. Dados por participante "
                           "não entram neste relatório: a fonte pública não traz CNPJ."))

    # 8. projeções e cenários
    parts.append("<h2>8 · Projeções e cenários</h2>")
    for tgt, label, unit in (("concessoes_total", "Concessões", " R$ milhões"), ("spread_total", "Spread", " p.p.")):
        f = pulse["previsoes"].get(tgt, {})
        if f.get("ok"):
            p = f["pontos"][-1]
            parts.append(_p("prev", f"{label} em {_mes(p['ref_date'])}: {_fmt(p['p50'], 1)}{unit} "
                                   f"[{_fmt(p['p10'], 1)} a {_fmt(p['p90'], 1)}]."))
    scn = ctx["scenario"]
    parts.append(_p("cen", f"Elasticidades de cenário ({scn.get('elasticidades_origem', 'ilustrativa')}): "
                    + "; ".join(f"{k} {_fmt(v['value'], 3)} [{_fmt(v['range'][0], 3)} a {_fmt(v['range'][1], 3)}]"
                                for k, v in scn["elasticidades"].items())
                    + ". Resultados de cenário são condicionais às hipóteses do usuário."))

    # 9. metodologia, fontes e limitações
    parts.append("<h2>9 · Metodologia, fontes e limitações</h2>")
    parts.append(_p("obs", "Fontes, linhagem (bronze para gold com SHA-256) e catálogo completo na aba "
                           "Metodologia & Fontes."))
    qv = ctx["quality"]
    if qv:
        media = sum(q["score"] for q in qv.values()) / len(qv)
        parts.append(_p("calc", f"Qualidade média das {len(qv)} séries: {_fmt(media, 0)}/100."))
    parts.append(_p("interp", "Limitações na aba Metodologia & Fontes e nos rodapés de cada visualização. "
                              "Scores e projeções não constituem rating nem recomendação."))

    html = (f"<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
            f"<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>{plat['name']}: relatório</title><style>{CSS}</style></head><body>"
            + "\n".join(parts)
            + "<script>/* imprimível: Ctrl/Cmd+P gera o PDF */</script></body></html>")
    path = common.write_gold_text("report.html", html)
    return path
