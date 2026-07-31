"""Detecção de regimes e quebras estruturais (SPEC §26).

Dois detectores complementares, ambos tratando mudança de regime como HIPÓTESE
estatística, nunca fato:

1. CUSUM sobre resíduos padronizados de AR(1): acumula desvios acima de k=0,5σ;
   sinaliza quando |CUSUM| excede h=5σ (parâmetros clássicos de carta CUSUM).
2. Quebra estrutural na média (Chow/sup-F simplificado): busca o ponto que maximiza
   a estatística F de diferença de médias no trecho central (15%–85%) da série
   estacionarizada; compara com valor crítico aproximado de Andrews (~8,85 a 5%
   para 1 parâmetro). Aproximação documentada — Bai-Perron completo na Fase 2b.
"""
import math

SUPF_CRIT_5PCT = 8.85  # Andrews (1993), 1 parâmetro, trimming 15% — aproximação


def _ar1_residuals(y):
    n = len(y)
    if n < 24:
        return None
    x = y[:-1]
    z = y[1:]
    mx, mz = sum(x) / len(x), sum(z) / len(z)
    den = sum((v - mx) ** 2 for v in x)
    phi = sum((a - mx) * (b - mz) for a, b in zip(x, z)) / den if den > 1e-12 else 0.0
    c = mz - phi * mx
    res = [z[i] - (c + phi * x[i]) for i in range(len(z))]
    m = sum(res) / len(res)
    sd = math.sqrt(sum((r - m) ** 2 for r in res) / max(len(res) - 1, 1))
    if sd < 1e-12:
        return None
    return [(r - m) / sd for r in res]


def cusum(y, dates, k=0.5, h=5.0):
    """CUSUM bilateral sobre resíduos AR(1) padronizados. Retorna estado atual e último disparo."""
    res = _ar1_residuals(y)
    if res is None:
        return None
    hi = lo = 0.0
    last_trigger = None
    for i, r in enumerate(res):
        hi = max(0.0, hi + r - k)
        lo = min(0.0, lo + r + k)
        if hi > h or lo < -h:
            last_trigger = {"data": dates[i + 1], "direcao": "alta" if hi > h else "baixa",
                            "estatistica": round(hi if hi > h else lo, 2)}
            hi = lo = 0.0  # reinicia após disparo
    return {"ultimo_disparo": last_trigger, "cusum_atual": round(max(hi, -lo), 2), "limiar": h}


def structural_break(y, dates, trim=0.15):
    """Sup-F de quebra na média do trecho central. Retorna melhor candidato e significância."""
    n = len(y)
    if n < 40:
        return None
    lo_i, hi_i = int(n * trim), int(n * (1 - trim))
    best = None
    for b in range(lo_i, hi_i):
        y1, y2 = y[:b], y[b:]
        m1, m2 = sum(y1) / len(y1), sum(y2) / len(y2)
        rss_u = sum((v - m1) ** 2 for v in y1) + sum((v - m2) ** 2 for v in y2)
        m = sum(y) / n
        rss_r = sum((v - m) ** 2 for v in y)
        if rss_u < 1e-12:
            continue
        f = (rss_r - rss_u) / (rss_u / (n - 2))
        if best is None or f > best["F"]:
            best = {"F": f, "idx": b}
    if best is None:
        return None
    sig = best["F"] > SUPF_CRIT_5PCT
    y_pre, y_pos = y[:best["idx"]], y[best["idx"]:]
    m_pre, m_pos = sum(y_pre) / len(y_pre), sum(y_pos) / len(y_pos)
    return {"data_quebra": dates[best["idx"]], "supF": round(best["F"], 1),
            "critico_5pct_aprox": SUPF_CRIT_5PCT, "significativa": sig,
            "media_antes": round(m_pre, 3), "media_depois": round(m_pos, 3),
            "direcao": "deterioração" if m_pos > m_pre else "melhora"}


def detect(get_series, specs):
    """specs: [(key, op, label, sobe_e_ruim)] com op em ('diff','yoy','level').
    Retorna diagnóstico de regime por série."""
    from pipeline.models.antecedentes import transform
    out = []
    for key, op, label, sobe_e_ruim in specs:
        s = get_series(key)
        if not s or len(s) < 40:
            continue
        ts = transform(s, op) if op != "level" else s
        y = [v for _, v in ts]
        dates = [d for d, _ in ts]
        cs = cusum(y, dates)
        br = structural_break(y, dates)
        recent = sum(y[-6:]) / 6
        older = sum(y[-18:-6]) / 12 if len(y) >= 18 else recent
        drift = recent - older
        piora = (drift > 0) == sobe_e_ruim
        estado = ("deterioração persistente" if piora and abs(drift) > 0.05 * (abs(older) + 1e-9) + 1e-9 and br and br["significativa"] and br["direcao"] == ("deterioração" if sobe_e_ruim else "melhora")
                  else "aceleração" if piora else "estabilização/melhora")
        out.append({
            "serie": key, "label": label, "transformacao": op,
            "estado_hipotese": estado, "drift_6m_vs_12m_previos": round(drift, 3),
            "cusum": cs, "quebra_estrutural": br,
            "aviso": "Mudança de regime é hipótese estatística sujeita a revisão de dados — não é fato.",
        })
    return {
        "series": out,
        "metodo": ("CUSUM (k=0,5σ, h=5σ) sobre resíduos AR(1) padronizados + sup-F de quebra na média "
                   "(trimming 15%, crítico aproximado de Andrews 8,85 a 5%). Séries estacionarizadas antes dos testes."),
        "limitacoes": ("Detecção univariada; uma única quebra por busca (Bai-Perron múltiplo na Fase 2b); "
                       "valores críticos aproximados; sensível a revisões das séries."),
    }
