"""Previsão por ensemble de modelos concorrentes com validação walk-forward.

Protocolo (SPEC §14):
- modelos-base simples e auditáveis (naive, sazonal, drift, média móvel, AR(1) em diferenças, Holt);
- backtest walk-forward com janela expansiva: para cada corte t, cada modelo prevê t+h usando
  SOMENTE dados até t (sem look-ahead);
- pesos do ensemble ∝ 1/MAE fora da amostra, por horizonte; modelos piores que o naive são descartados;
- bandas p10/p50/p90 a partir dos QUANTIS EMPÍRICOS dos resíduos de backtest por horizonte
  (sem hipótese gaussiana);
- métricas (MAE, RMSE, MAE/MAE_naive) reportadas junto à projeção.
"""
import math


def _naive(y, h):
    return y[-1]


def _seasonal_naive(y, h):
    if len(y) >= 12:
        idx = len(y) + h - 1 - 12
        if idx >= 0:
            return y[idx]
    return y[-1]


def _drift(y, h):
    if len(y) < 2:
        return y[-1]
    slope = (y[-1] - y[0]) / (len(y) - 1)
    return y[-1] + slope * h


def _moving_avg(y, h, k=6):
    kk = min(k, len(y))
    return sum(y[-kk:]) / kk


def _ar1_diff(y, h):
    """AR(1) sobre primeiras diferenças, MQO sem intercepto sofisticado."""
    if len(y) < 8:
        return y[-1]
    d = [y[i] - y[i - 1] for i in range(1, len(y))]
    x, z = d[:-1], d[1:]
    mx = sum(x) / len(x)
    mz = sum(z) / len(z)
    denom = sum((xi - mx) ** 2 for xi in x)
    phi = sum((xi - mx) * (zi - mz) for xi, zi in zip(x, z)) / denom if denom > 1e-12 else 0.0
    phi = max(-0.95, min(0.95, phi))
    c = mz - phi * mx
    last_d, level, dd = d[-1], y[-1], 0.0
    for _ in range(h):
        dd = c + phi * (last_d if _ == 0 else dd)
        level += dd
    return level


def _holt(y, h, alpha=0.4, beta=0.15):
    if len(y) < 4:
        return y[-1]
    level, trend = y[0], y[1] - y[0]
    for v in y[1:]:
        prev = level
        level = alpha * v + (1 - alpha) * (level + trend)
        trend = beta * (level - prev) + (1 - beta) * trend
    return level + trend * h

MODELS = {
    "ultimo_valor": _naive,
    "sazonal_ingenuo": _seasonal_naive,
    "drift": _drift,
    "media_movel_6m": _moving_avg,
    "ar1_diferencas": _ar1_diff,
    "holt": _holt,
}


def _quantile(sorted_vals, q):
    if not sorted_vals:
        return 0.0
    pos = q * (len(sorted_vals) - 1)
    lo, hi = int(math.floor(pos)), int(math.ceil(pos))
    if lo == hi:
        return sorted_vals[lo]
    frac = pos - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def backtest(y, horizons, n_points=24, min_history=48):
    """Walk-forward: retorna {h: {model: {mae, rmse, residuals[], preds[]}}}.

    preds = [(idx_do_realizado, previsto, realizado)] em ordem cronológica —
    é o que permite reconstruir o ensemble por origem e publicar o
    previsto × realizado (backtest publicado, P1 da auditoria de 12/08).
    """
    out = {h: {m: {"errs": [], "preds": []} for m in MODELS} for h in horizons}
    max_h = max(horizons)
    first_cut = max(min_history, len(y) - n_points - max_h)
    for t in range(first_cut, len(y) - 1):
        hist = y[:t]
        for h in horizons:
            if t + h - 1 >= len(y):
                continue
            actual = y[t + h - 1]
            for name, fn in MODELS.items():
                try:
                    pred = fn(hist, h)
                    out[h][name]["errs"].append(pred - actual)
                    out[h][name]["preds"].append((t + h - 1, pred, actual))
                except Exception:
                    pass
    result = {}
    for h in horizons:
        result[h] = {}
        for name in MODELS:
            errs = out[h][name]["errs"]
            if not errs:
                continue
            mae = sum(abs(e) for e in errs) / len(errs)
            rmse = math.sqrt(sum(e * e for e in errs) / len(errs))
            result[h][name] = {"mae": mae, "rmse": rmse, "residuals": errs,
                               "preds": out[h][name]["preds"], "n": len(errs)}
    return result


def _ensemble_por_origem(eligible, weights):
    """Previsões do ensemble por origem do walk-forward, cronológicas.

    Aproximação declarada: os pesos são os finais (derivados do backtest
    inteiro), aplicados retroativamente a cada origem — um pseudo-backtest do
    ensemble, suficiente para publicar erro e cobertura, e dito assim.
    Só entram origens em que TODOS os modelos elegíveis produziram previsão.
    """
    por_modelo = {}
    for name, s in eligible.items():
        por_modelo[name] = {idx: (p, a) for idx, p, a in s.get("preds", [])}
    if not por_modelo:
        return []
    idx_comuns = set.intersection(*[set(m.keys()) for m in por_modelo.values()])
    saida = []
    for idx in sorted(idx_comuns):
        pred = sum(por_modelo[n][idx][0] * w for n, w in weights.items())
        actual = next(iter(por_modelo.values()))[idx][1]
        saida.append((idx, pred, actual))
    return saida


def _cobertura_split(origens):
    """Cobertura da banda 10–90 medida FORA da calibração: a primeira metade
    (cronológica) dos erros calibra os quantis; a segunda mede quantos
    realizados caem na banda. Amostras pequenas — n publicado junto."""
    if len(origens) < 10:
        return None
    erros = [p - a for _, p, a in origens]
    meio = len(erros) // 2
    calib = sorted(erros[:meio])
    q10, q90 = _quantile(calib, 0.10), _quantile(calib, 0.90)
    teste = erros[meio:]
    dentro = sum(1 for e in teste if q10 <= e <= q90)
    pct = round(100 * dentro / len(teste), 1)
    if pct >= 65:
        leitura = "compatível com o nominal de 80%, dada a amostra pequena"
    elif pct >= 40:
        leitura = "abaixo do nominal — a banda deve ser lida como indicativa, não como garantia"
    else:
        leitura = ("os erros mudaram de regime entre as duas metades do backtest — a banda publicada "
                   "(calibrada com todos os resíduos) deve ser lida como piso de incerteza, não como garantia de 80%")
    return {"cobertura_oos_pct": pct, "nominal_pct": 80.0,
            "n_calibracao": meio, "n_teste": len(teste), "leitura": leitura}


def forecast_series(dates, values, horizons, n_points=24, min_history=48):
    """Retorna projeção com ensemble, bandas empíricas e diagnóstico completo.

    dates: ISO 'YYYY-MM-01' mensais; values: floats alinhados.
    """
    y = list(values)
    if len(y) < min_history:
        return {"ok": False, "motivo": f"histórico insuficiente ({len(y)} < {min_history} observações)"}
    bt = backtest(y, horizons, n_points, min_history)
    last_date = dates[-1]
    yy, mm = int(last_date[:4]), int(last_date[5:7])

    points, diagnostics = [], {}
    for h in horizons:
        stats = bt.get(h, {})
        naive_mae = stats.get("ultimo_valor", {}).get("mae")
        eligible = {}
        for name, s in stats.items():
            if naive_mae and s["mae"] > naive_mae * 1.15 and name != "ultimo_valor":
                continue  # pior que o ingênuo com folga => descartado do ensemble
            eligible[name] = s
        if not eligible:
            eligible = {"ultimo_valor": stats.get("ultimo_valor", {"mae": 1.0, "residuals": [0], "rmse": 1.0, "n": 0})}
        inv = {n: 1.0 / max(s["mae"], 1e-9) for n, s in eligible.items()}
        tot = sum(inv.values())
        weights = {n: w / tot for n, w in inv.items()}

        point = sum(MODELS[n](y, h) * w for n, w in weights.items())
        # quantis preditivos no estilo conformal: ponto - quantis dos resíduos de backtest
        # (corrige viés sistemático e garante p10 <= p50 <= p90 por monotonicidade)
        mixed = []
        for n, w in weights.items():
            mixed.extend(eligible[n]["residuals"])
        mixed.sort()
        p50 = point - _quantile(mixed, 0.50)
        p10 = point - _quantile(mixed, 0.90)
        p90 = point - _quantile(mixed, 0.10)
        fy, fm = yy, mm + h
        fy += (fm - 1) // 12
        fm = (fm - 1) % 12 + 1
        points.append({
            "h": h, "ref_date": f"{fy:04d}-{fm:02d}-01",
            "p50": round(p50, 4), "p10": round(p10, 4), "p90": round(p90, 4),
        })
        ens_mae = sum(eligible[n]["mae"] * w for n, w in weights.items())
        origens = _ensemble_por_origem(eligible, weights)
        diagnostics[str(h)] = {
            "pesos": {n: round(w, 3) for n, w in weights.items()},
            "mae_ensemble_backtest": round(ens_mae, 4),
            "mae_naive_backtest": round(naive_mae, 4) if naive_mae else None,
            "ganho_vs_naive_pct": round((1 - ens_mae / naive_mae) * 100, 1) if naive_mae else None,
            "n_backtests": max((s["n"] for s in eligible.values()), default=0),
            # backtest PUBLICADO: cobertura da banda validada fora da própria
            # calibração (split temporal) — a banda promete 80%; o que entrega
            # fica registrado, inclusive quando entrega menos
            "cobertura_banda": _cobertura_split(origens),
        }
        # trajetória previsto × realizado no horizonte de 12 meses: o gráfico
        # que mostra como o modelo TERIA previsto — inclusive quando errou
        if h == 12 and origens:
            diagnostics[str(h)]["trajetoria"] = [
                {"ref": dates[idx], "previsto": round(p, 4), "realizado": round(a, 4)}
                for idx, p, a in origens[-24:] if idx < len(dates)]
    return {
        "ok": True, "tipo": "PREVISÃO", "pontos": points, "diagnostico": diagnostics,
        "metodo": "Ensemble ponderado por 1/MAE em backtest walk-forward (janela expansiva); "
                  "quantis preditivos (p10/p50/p90) por deslocamento dos quantis empíricos dos "
                  "resíduos fora da amostra por horizonte (calibração tipo conformal).",
        "limitacoes": "Modelos univariados simples; não incorporam covariáveis nem quebras estruturais. "
                      "Bandas refletem erro histórico recente, não risco de eventos inéditos.",
    }
