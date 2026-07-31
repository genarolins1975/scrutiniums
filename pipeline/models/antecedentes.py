"""Protocolo estatístico de indicadores antecedentes (SPEC §9 e §12).

Um candidato só é PROMOVIDO a antecedente quando cumpre TODOS os critérios:
1. racional econômico documentado;
2. liderança temporal (melhor defasagem >= 1 mês na correlação cruzada);
3. causalidade de Granger significativa a 5% (aproximação qui-quadrado para o teste F);
4. ganho fora da amostra: AR(1)+candidato reduz MAE vs. AR(1) puro em backtest walk-forward;
5. estabilidade: correlação com mesmo sinal e magnitude mínima nas duas metades da amostra.

Tudo em variáveis estacionarizadas (diferenças ou variação interanual) para evitar
correlação espúria de tendências. Sem look-ahead: previsões OOS usam apenas dados até o corte.
Múltiplos testes: nº de candidatos é pequeno e fixo (definido por racional econômico ex-ante,
não por busca em massa) — ainda assim o resultado reporta o nº de testes executados.
"""
import math

# qui-quadrado 95% para df=1..12 (aprox. do teste F com denominador grande)
CHI2_95 = [3.841, 5.991, 7.815, 9.488, 11.070, 12.592, 14.067, 15.507, 16.919, 18.307, 19.675, 21.026]

# candidatos com racional econômico ex-ante (chave da série, transformação, racional)
CANDIDATES = [
    ("papelao", "yoy", "Expedição de papelão antecipa produção e vendas; queda reduz renda e capacidade de pagamento."),
    ("ibc_br", "yoy", "Atividade agregada antecede renda e emprego, que determinam a capacidade de servir dívidas."),
    ("desemprego", "diff", "Desemprego reduz renda das famílias; efeito defasado sobre atrasos e inadimplência."),
    ("cambio", "yoy", "Depreciação encarece insumos e dívidas indexadas; pressiona margens de empresas."),
    ("selic_meta", "mdiff", "Juros elevam serviço da dívida com defasagem de repactuação e novas concessões."),
    ("comprometimento", "diff", "Comprometimento de renda alto precede incapacidade de pagamento das famílias."),
    ("spread_total", "diff", "Spread embute expectativa de perda dos bancos; sobe antes da inadimplência realizada."),
    ("concessoes_total", "yoy", "Aperto de concessões antecipa restrição de refinanciamento e realização de atrasos."),
]


def _monthly_mean(series):
    """Série diária -> média mensal [(YYYY-MM-01, mean)]."""
    buckets = {}
    for d, v in series:
        buckets.setdefault(d[:7], []).append(v)
    return [(k + "-01", sum(vs) / len(vs)) for k, vs in sorted(buckets.items())]


def transform(series, op):
    if op == "mdiff":
        series = _monthly_mean(series)
        op = "diff"
    if op == "yoy":
        by = dict(series)
        out = []
        for d, v in series:
            prev = f"{int(d[:4]) - 1:04d}{d[4:]}"
            if prev in by and abs(by[prev]) > 1e-9:
                out.append((d, (v / by[prev] - 1) * 100))
        return out
    if op == "diff":
        return [(series[i][0], series[i][1] - series[i - 1][1]) for i in range(1, len(series))]
    return series


def _align(a, b):
    """Retorna listas pareadas por data comum, ordenadas."""
    db = dict(b)
    pairs = [(d, va, db[d]) for d, va in a if d in db]
    pairs.sort()
    return [p[1] for p in pairs], [p[2] for p in pairs], [p[0] for p in pairs]


def _corr(x, y):
    n = len(x)
    if n < 10:
        return None
    mx, my = sum(x) / n, sum(y) / n
    sx = math.sqrt(sum((v - mx) ** 2 for v in x))
    sy = math.sqrt(sum((v - my) ** 2 for v in y))
    if sx < 1e-12 or sy < 1e-12:
        return None
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sx * sy)


def cross_correlation(target, cand, max_lag=12):
    """corr(target_t, cand_{t-k}) para k=0..max_lag. Retorna lista e melhor defasagem >=1."""
    y, x, _ = _align(target, cand)
    out = []
    for k in range(0, max_lag + 1):
        if k == 0:
            c = _corr(y, x)
        else:
            c = _corr(y[k:], x[:-k])
        out.append({"lag": k, "corr": round(c, 3) if c is not None else None})
    lead = [o for o in out if o["lag"] >= 1 and o["corr"] is not None]
    best = max(lead, key=lambda o: abs(o["corr"])) if lead else None
    return out, best


def _solve(A, b):
    """Resolve A x = b por eliminação gaussiana com pivoteamento parcial (matrizes pequenas)."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-12:
            return None
        M[col], M[piv] = M[piv], M[col]
        for r in range(col + 1, n):
            f = M[r][col] / M[col][col]
            for c in range(col, n + 1):
                M[r][c] -= f * M[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (M[r][n] - sum(M[r][c] * x[c] for c in range(r + 1, n))) / M[r][r]
    return x


def ols(X, y):
    """MQO: retorna (betas, rss). X = lista de linhas (com constante já incluída)."""
    k = len(X[0])
    XtX = [[sum(X[i][a] * X[i][b] for i in range(len(X))) for b in range(k)] for a in range(k)]
    Xty = [sum(X[i][a] * y[i] for i in range(len(X))) for a in range(k)]
    beta = _solve(XtX, Xty)
    if beta is None:
        return None, None
    rss = sum((y[i] - sum(X[i][a] * beta[a] for a in range(k))) ** 2 for i in range(len(X)))
    return beta, rss


def granger(target, cand, p=3):
    """Teste de Granger: AR(p) restrito vs. + p defasagens do candidato.
    F aproximado por qui-quadrado/p (denominador grande). Retorna (F, significativo, n)."""
    y, x, _ = _align(target, cand)
    n = len(y)
    if n < p * 2 + 20:
        return None, False, n
    rows_r, rows_u, yy = [], [], []
    for t in range(p, n):
        ylags = [y[t - j] for j in range(1, p + 1)]
        xlags = [x[t - j] for j in range(1, p + 1)]
        rows_r.append([1.0] + ylags)
        rows_u.append([1.0] + ylags + xlags)
        yy.append(y[t])
    _, rss_r = ols(rows_r, yy)
    _, rss_u = ols(rows_u, yy)
    if rss_r is None or rss_u is None or rss_u < 1e-12:
        return None, False, n
    nobs = len(yy)
    kk = 1 + 2 * p
    f = ((rss_r - rss_u) / p) / (rss_u / max(nobs - kk, 1))
    crit = CHI2_95[p - 1] / p
    return round(f, 2), f > crit, nobs


def oos_gain(target, cand, best_lag, n_test=24):
    """Walk-forward h=1: MAE de AR(1)+cand_lag vs. AR(1). Ganho % = (1 - MAE_arx/MAE_ar)*100."""
    y, x, _ = _align(target, cand)
    n = len(y)
    lag = max(best_lag, 1)
    start = max(n - n_test, lag + 24)
    if start >= n - 4:
        return None
    e_ar, e_arx = [], []
    for t in range(start, n):
        ytr = y[:t]
        rows_ar = [[1.0, ytr[i - 1]] for i in range(1, t)]
        rows_arx = [[1.0, ytr[i - 1], x[i - lag]] for i in range(max(1, lag), t)]
        yar = ytr[1:]
        yarx = [ytr[i] for i in range(max(1, lag), t)]
        b_ar, _ = ols(rows_ar, yar)
        b_arx, _ = ols(rows_arx, yarx)
        if b_ar is None or b_arx is None:
            continue
        pred_ar = b_ar[0] + b_ar[1] * y[t - 1]
        pred_arx = b_arx[0] + b_arx[1] * y[t - 1] + b_arx[2] * x[t - lag]
        e_ar.append(abs(pred_ar - y[t]))
        e_arx.append(abs(pred_arx - y[t]))
    if not e_ar:
        return None
    mae_ar = sum(e_ar) / len(e_ar)
    mae_arx = sum(e_arx) / len(e_arx)
    if mae_ar < 1e-12:
        return None
    return round((1 - mae_arx / mae_ar) * 100, 1)


def stability(target, cand, best_lag):
    """Correlação na melhor defasagem nas duas metades: mesmo sinal e |corr|>=0,15 em ambas."""
    y, x, _ = _align(target, cand)
    k = max(best_lag, 1)
    ya, xa = y[k:], x[:-k]
    n = len(ya)
    if n < 40:
        return None, None, False
    h = n // 2
    c1, c2 = _corr(ya[:h], xa[:h]), _corr(ya[h:], xa[h:])
    ok = (c1 is not None and c2 is not None and c1 * c2 > 0 and abs(c1) >= 0.15 and abs(c2) >= 0.15)
    return (round(c1, 3) if c1 is not None else None, round(c2, 3) if c2 is not None else None, ok)


def evaluate_candidates(get_series, target_key, target_op="diff"):
    """Roda o protocolo completo para um alvo. get_series(key) -> [(date, value)]."""
    raw_t = get_series(target_key)
    if not raw_t:
        return None
    target = transform(raw_t, target_op)
    results = []
    for key, op, rationale in CANDIDATES:
        if key == target_key:
            continue
        raw_c = get_series(key)
        if not raw_c:
            continue
        cand = transform(raw_c, op)
        ccf, best = cross_correlation(target, cand)
        if not best or best["corr"] is None:
            continue
        f_stat, granger_ok, n = granger(target, cand)
        gain = oos_gain(target, cand, best["lag"])
        c1, c2, stable = stability(target, cand, best["lag"])
        leads = best["lag"] >= 1 and abs(best["corr"]) >= 0.2
        gain_ok = gain is not None and gain > 2.0
        crits = {"lideranca_temporal": leads, "granger_5pct": bool(granger_ok),
                 "ganho_oos": bool(gain_ok), "estabilidade": bool(stable)}
        n_ok = sum(crits.values())
        status = "promovido" if n_ok == 4 else "em triagem" if n_ok >= 2 else "reprovado"
        results.append({
            "candidato": key, "transformacao": op, "racional": rationale,
            "melhor_defasagem_meses": best["lag"], "correlacao_melhor_defasagem": best["corr"],
            "ccf": ccf, "granger_F": f_stat, "granger_significativo_5pct": bool(granger_ok),
            "ganho_oos_pct": gain, "estabilidade_metade1": c1, "estabilidade_metade2": c2,
            "estavel": bool(stable), "criterios": crits, "criterios_atendidos": f"{n_ok}/4",
            "status": status, "n_obs": n,
        })
    order = {"promovido": 0, "em triagem": 1, "reprovado": 2}
    results.sort(key=lambda r: (order[r["status"]], -abs(r["correlacao_melhor_defasagem"] or 0)))
    return {
        "alvo": target_key, "transformacao_alvo": target_op, "candidatos": results,
        "n_testes_executados": len(results),
        "metodo": ("Alvo e candidatos estacionarizados (diferença mensal / variação interanual). "
                   "Correlação cruzada k=0..12; Granger AR(3) com F aproximado por qui-quadrado (5%); "
                   "ganho fora da amostra: AR(1)+candidato vs. AR(1) em walk-forward h=1 (24 cortes); "
                   "estabilidade: mesmo sinal e |corr|>=0,15 nas duas metades. "
                   "Promoção exige os 4 critérios; candidatos definidos ex-ante por racional econômico."),
        "limitacoes": ("Aproximação qui-quadrado no teste F; sem controle formal de múltiplos testes "
                       "(mitigado por lista ex-ante pequena); ganho OOS medido em h=1 — horizontes "
                       "longos na integração ao ensemble (Fase 2b); dados revisados podem diferir do "
                       "vintage disponível em tempo real (nowcasting na Fase 2b)."),
    }
