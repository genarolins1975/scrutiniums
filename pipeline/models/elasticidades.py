"""Elasticidades empíricas para os cenários (Fase 2).

Regressão MQO da variação de 12 meses da inadimplência sobre choques macro defasados:
    Δ12 inad_t = a + b1·Δ12 selic_{t-6} + b2·Δ12 desemprego_t + b3·(IBC-Br yoy)_{t-3}
                 + b4·(câmbio yoy/10)_{t-3} + e_t

Intervalos = coeficiente ± 2 erros-padrão (MQO clássico — sem correção HAC no protótipo,
o que tende a SUBESTIMAR a incerteza com dados mensais sobrepostos; documentado).
ASSOCIAÇÃO CONDICIONAL, NÃO CAUSALIDADE. Se a regressão falhar ou os sinais forem
economicamente implausíveis, o pipeline cai para as elasticidades ilustrativas do config.
"""
import math

from pipeline.models.antecedentes import _monthly_mean, ols, _solve


def _d12(series):
    by = dict(series)
    out = []
    for d, v in series:
        prev = f"{int(d[:4]) - 1:04d}{d[4:]}"
        if prev in by:
            out.append((d, v - by[prev]))
    return out


def _yoy(series):
    by = dict(series)
    out = []
    for d, v in series:
        prev = f"{int(d[:4]) - 1:04d}{d[4:]}"
        if prev in by and abs(by[prev]) > 1e-9:
            out.append((d, (v / by[prev] - 1) * 100))
    return out


def _lag(series, k):
    """Desloca a série k meses à frente: valor de t-k passa a valer em t."""
    if k == 0:
        return series
    out = []
    for d, v in series:
        y, m = int(d[:4]), int(d[5:7])
        m += k
        y += (m - 1) // 12
        m = (m - 1) % 12 + 1
        out.append((f"{y:04d}-{m:02d}-01", v))
    return out


def estimate(get_series, fallback):
    """Retorna dict de elasticidades no formato do scenario.json, com proveniência."""
    inad = get_series("inad_total")
    selic = get_series("selic_meta")
    desemp = get_series("desemprego")
    ibc = get_series("ibc_br")
    cambio = get_series("cambio")
    if not all([inad, selic, desemp, ibc, cambio]):
        return _fallback(fallback, "séries insuficientes")

    y_map = dict(_d12(inad))
    regs = {
        "selic_pp": dict(_lag(_d12(_monthly_mean(selic)), 6)),
        "desemprego_pp": dict(_d12(desemp)),
        "pib_pp": dict(_lag(_yoy(ibc), 3)),                       # IBC-Br yoy como proxy de PIB
        "cambio_pct10": dict(_lag([(d, v / 10) for d, v in _yoy(cambio)], 3)),
    }
    dates = sorted(set(y_map) & set.intersection(*[set(r) for r in regs.values()]))
    if len(dates) < 60:
        return _fallback(fallback, f"amostra curta ({len(dates)} meses)")
    X = [[1.0] + [regs[k][d] for k in regs] for d in dates]
    y = [y_map[d] for d in dates]
    beta, rss = ols(X, y)
    if beta is None:
        return _fallback(fallback, "regressão singular")

    # erros-padrão: diag((X'X)^-1)·s²
    n, k = len(X), len(X[0])
    XtX = [[sum(X[i][a] * X[i][b] for i in range(n)) for b in range(k)] for a in range(k)]
    s2 = rss / max(n - k, 1)
    ses = []
    for j in range(k):
        e = [1.0 if i == j else 0.0 for i in range(k)]
        col = _solve([row[:] for row in XtX], e)
        ses.append(math.sqrt(max(col[j], 0) * s2) if col else float("nan"))

    expected_sign = {"selic_pp": 1, "desemprego_pp": 1, "pib_pp": -1, "cambio_pct10": 1}
    out = {}
    plausible = 0
    for j, key in enumerate(regs, start=1):
        b, se = beta[j], ses[j]
        sign_ok = b * expected_sign[key] > 0
        plausible += sign_ok
        out[key] = {
            "value": round(b, 3),
            "range": [round(b - 2 * se, 3), round(b + 2 * se, 3)],
            "lag_desc": fallback[key]["lag_desc"],
            "fonte": "empírico" if sign_ok else "empírico (sinal contraintuitivo — usar com cautela)",
            "erro_padrao": round(se, 3), "sinal_esperado_ok": sign_ok,
        }
    if plausible < 2:
        return _fallback(fallback, "sinais majoritariamente implausíveis — mantidas as ilustrativas")
    return {
        "elasticidades": out, "origem": "empírico",
        "detalhe": (f"MQO sobre Δ12m da inadimplência total, {len(dates)} meses "
                    f"({dates[0][:7]} a {dates[-1][:7]}); Selic defasada 6m, IBC-Br e câmbio 3m; "
                    "IBC-Br yoy como proxy de PIB. Intervalos = ±2 EP clássicos (sem HAC — incerteza "
                    "provavelmente subestimada). Associação condicional, NÃO causalidade."),
        "r2_info": {"n": n, "rss": round(rss, 3)},
    }


def _fallback(fallback, motivo):
    return {"elasticidades": {k: {**v, "fonte": "ilustrativo"} for k, v in fallback.items()},
            "origem": "ilustrativo", "detalhe": f"Elasticidades ilustrativas do config ({motivo})."}
