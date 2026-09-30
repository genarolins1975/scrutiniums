"""Decomposição estatística da carga diária em calendário, temperatura, sazonalidade e
tendência (painel P027), com estimação só no passado e avaliação fora da amostra.

É uma DECOMPOSIÇÃO ESTATÍSTICA, não um modelo causal: os coeficientes descrevem
associações médias no período de treino. "Contribuição da temperatura" quer dizer
"quanto a previsão do modelo muda quando a temperatura muda e o resto fica igual", não
"quanto a temperatura causou". O que o modelo não explica fica no resíduo, publicado.

Especificação principal (por subsistema e SIN), mínimos quadrados ordinários em
ln(carga diária, MWmed):
    constante + tendência linear (anos)
    + dia da semana (6 variáveis, quarta-feira como base)
    + feriado nacional ou Paixão em dia útil, feriado no sábado, segunda e terça de Carnaval,
      Quarta de Cinzas, Corpus Christi, dia de ponte, fim de ano (24 a 31/12 e 2/1)
    + sazonalidade anual (senos e cossenos, 2 harmônicos)
    + temperatura média ponderada do dia (linear e duas dobras, em nós fixados pelos
      tercis da temperatura na PRIMEIRA janela de treino, sem olhar o futuro)
    + temperatura do dia anterior (inércia térmica).
Janela de treino: desde 29/04/2023 (regime atual do ONS, com a estimativa de MMGD dentro
da carga). Avaliação: origens no primeiro dia de cada mês a partir de 01/05/2024; em cada
origem o modelo é estimado com os dias ANTERIORES e prevê os dias do mês, com a
temperatura e o calendário realizados (é decomposição ex post, não previsão de carga:
não há previsão de temperatura aqui).

Intervalo: quantis empíricos dos erros fora da amostra das origens anteriores (80% e
95%), quando há pelo menos 60 dias deles; antes disso, quantis dos resíduos do treino
(e a cobertura efetiva é publicada, para que o leitor veja se o intervalo foi curto).

Álgebra: equações normais acumuladas (X'X e X'y crescem com os dias novos a cada
origem) e eliminação de Gauss com pivoteamento parcial. Variável sem variação no treino
(um feriado que ainda não ocorreu) sai do ajuste e é declarada.
"""
import math
from datetime import date, timedelta

from pipeline.energia.fontes import calendario_carga as cal

INICIO_REGIME = "2023-04-29"
INICIO_JANELA_LONGA = "2021-03-01"
PRIMEIRA_ORIGEM = "2024-05-01"
MIN_ERROS_INTERVALO = 60
DIAS_SEMANA = ("seg", "ter", "qui", "sex", "sab", "dom")  # quarta é a base
GRUPOS = ("nivel_tendencia", "calendario", "sazonalidade", "temperatura")

VARIANTES = {
    "principal": {"rotulo": "Principal: temperatura média com dobras e defasagem, calendário completo",
                  "temperatura": "media", "dobras": True, "defasagem": True, "facultativos": True,
                  "inicio": INICIO_REGIME},
    "sem_temperatura": {"rotulo": "Sem temperatura (só calendário, sazonalidade e tendência)",
                        "temperatura": None, "dobras": False, "defasagem": False, "facultativos": True,
                        "inicio": INICIO_REGIME},
    "temperatura_linear": {"rotulo": "Temperatura média só linear (sem dobras nem defasagem)",
                           "temperatura": "media", "dobras": False, "defasagem": False, "facultativos": True,
                           "inicio": INICIO_REGIME},
    "temperatura_maxima": {"rotulo": "Temperatura máxima em vez da média",
                           "temperatura": "maxima", "dobras": True, "defasagem": True, "facultativos": True,
                           "inicio": INICIO_REGIME},
    "sem_pontos_facultativos": {"rotulo": "Só feriados por lei (sem Carnaval, Cinzas, Corpus Christi, pontes e fim de ano)",
                                "temperatura": "media", "dobras": True, "defasagem": True, "facultativos": False,
                                "inicio": INICIO_REGIME},
    "janela_longa": {"rotulo": "Treino desde 01/03/2021 com degrau no regime de 29/04/2023",
                     "temperatura": "media", "dobras": True, "defasagem": True, "facultativos": True,
                     "inicio": INICIO_JANELA_LONGA},
}


# ---------------------------------------------------------------- álgebra

def resolve(a, b):
    """Resolve a·x = b (a quadrada, listas) por eliminação de Gauss com pivoteamento
    parcial. Levanta ValueError se a matriz for singular."""
    n = len(a)
    m = [list(a[i]) + [b[i]] for i in range(n)]
    for c in range(n):
        p = max(range(c, n), key=lambda i: abs(m[i][c]))
        if abs(m[p][c]) < 1e-10:
            raise ValueError(f"matriz singular na coluna {c}")
        m[c], m[p] = m[p], m[c]
        piv = m[c][c]
        for j in range(c, n + 1):
            m[c][j] /= piv
        for i in range(n):
            if i != c and m[i][c] != 0.0:
                f = m[i][c]
                linha_c = m[c]
                linha_i = m[i]
                for j in range(c, n + 1):
                    linha_i[j] -= f * linha_c[j]
    return [m[i][n] for i in range(n)]


def quantil(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    pos = (len(xs) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


# ---------------------------------------------------------------- variáveis

def _eh_feriado(x):
    ev = cal.evento(x)
    return bool(ev and ev[1] in ("feriado_nacional", "paixao"))


def _ponte(x):
    """Dia útil entre um feriado (ou Corpus Christi) de terça ou quinta e o fim de semana."""
    wd = x.weekday()
    if wd == 0:  # segunda antes de feriado na terça
        t = x + timedelta(days=1)
        return _eh_feriado(t)
    if wd == 4:  # sexta depois de feriado ou Corpus Christi na quinta
        q = x - timedelta(days=1)
        ev = cal.evento(q)
        return bool(ev and (ev[1] in ("feriado_nacional", "paixao") or ev[0] == "Corpus Christi"))
    return False


def variaveis(dia, temp, temp_ant, cfg, nos, inicio_janela):
    """(nomes, grupos, valores) das variáveis de um dia, ou None se faltar temperatura."""
    x = date.fromisoformat(dia)
    nomes, grupos, vals = ["constante", "tendencia"], ["nivel_tendencia", "nivel_tendencia"], [1.0, (x - date(2023, 4, 29)).days / 365.25]
    if cfg["inicio"] < INICIO_REGIME:
        nomes.append("regime_2023")
        grupos.append("nivel_tendencia")
        vals.append(1.0 if dia >= INICIO_REGIME else 0.0)
    wd = x.weekday()
    for i, nome in zip((0, 1, 3, 4, 5, 6), DIAS_SEMANA):
        nomes.append(f"dia_{nome}")
        grupos.append("calendario")
        vals.append(1.0 if wd == i else 0.0)
    ev = cal.evento(x)
    feriado = bool(ev and ev[1] in ("feriado_nacional", "paixao"))
    nomes += ["feriado_dia_util", "feriado_sabado"]
    grupos += ["calendario", "calendario"]
    vals += [1.0 if feriado and wd < 5 else 0.0, 1.0 if feriado and wd == 5 else 0.0]
    if cfg["facultativos"]:
        nome_ev = ev[0] if ev else ""
        fim_ano = (x.month == 12 and x.day >= 24 and not feriado) or (x.month == 1 and x.day == 2)
        for n_, v_ in (("carnaval", nome_ev.startswith("Carnaval")), ("cinzas", nome_ev.startswith("Quarta-feira de Cinzas")),
                       ("corpus_christi", nome_ev == "Corpus Christi"), ("ponte", _ponte(x)), ("fim_de_ano", fim_ano)):
            nomes.append(n_)
            grupos.append("calendario")
            vals.append(1.0 if v_ else 0.0)
    doy = x.timetuple().tm_yday
    for k in (1, 2):
        ang = 2 * math.pi * k * doy / 365.25
        nomes += [f"sen{k}", f"cos{k}"]
        grupos += ["sazonalidade", "sazonalidade"]
        vals += [math.sin(ang), math.cos(ang)]
    if cfg["temperatura"]:
        if temp is None or (cfg["defasagem"] and temp_ant is None):
            return None
        nomes.append("temperatura")
        grupos.append("temperatura")
        vals.append(temp)
        if cfg["dobras"]:
            for i, k in enumerate(nos):
                nomes.append(f"temperatura_acima_{i + 1}")
                grupos.append("temperatura")
                vals.append(max(temp - k, 0.0))
        if cfg["defasagem"]:
            nomes.append("temperatura_dia_anterior")
            grupos.append("temperatura")
            vals.append(temp_ant)
    return nomes, grupos, vals


def nos_temperatura(temps, inicio, origem):
    """Tercis da temperatura na primeira janela de treino [inicio, origem)."""
    xs = [v for d, v in temps.items() if inicio <= d < origem]
    if len(xs) < 60:
        return []
    return [round(quantil(xs, 1 / 3), 2), round(quantil(xs, 2 / 3), 2)]


# ---------------------------------------------------------------- ajuste e avaliação

def _origens(dias, primeira=PRIMEIRA_ORIGEM):
    """Primeiro dia de cada mês de `primeira` até o mês do último dia."""
    if not dias:
        return []
    ult = date.fromisoformat(dias[-1])
    x = date.fromisoformat(primeira)
    out = []
    while x <= ult:
        out.append(x.isoformat())
        x = date(x.year + (x.month == 12), x.month % 12 + 1, 1)
    return out


def avaliar(carga, temps_media, temps_max, variante="principal", primeira_origem=PRIMEIRA_ORIGEM):
    """Estima o modelo em origens mensais e prevê cada mês fora da amostra.

    `carga`: {dia: MWmed}; `temps_*`: {dia: °C}. Retorna dict com previsões diárias
    fora da amostra (real, previsto, intervalos, contribuições por grupo), métricas por
    origem e no total, cobertura dos intervalos, coeficientes da última origem."""
    cfg = VARIANTES[variante]
    temps = temps_media if cfg["temperatura"] != "maxima" else temps_max
    dias = sorted(d for d in carga if d >= cfg["inicio"] and carga[d] and carga[d] > 0)
    origens = _origens(dias, primeira_origem)
    if not origens:
        return None
    nos = nos_temperatura(temps or {}, cfg["inicio"], origens[0]) if cfg["temperatura"] and cfg["dobras"] else []
    linhas = {}
    nomes_ref, grupos_ref = None, None
    for d in dias:
        t = (temps or {}).get(d)
        ta = (temps or {}).get((date.fromisoformat(d) - timedelta(days=1)).isoformat())
        v = variaveis(d, t, ta, cfg, nos, cfg["inicio"])
        if v is None:
            continue
        nomes_ref, grupos_ref = v[0], v[1]
        linhas[d] = (v[2], math.log(carga[d]))
    if not linhas:
        return None
    p = len(nomes_ref)
    xtx = [[0.0] * p for _ in range(p)]
    xty = [0.0] * p
    soma_x = [0.0] * p
    n_treino = 0
    dias_modelo = sorted(linhas)
    i_prox = 0
    erros_fora = []   # (dia, erro em log) das origens anteriores
    previsoes, por_origem = [], []
    ultimo = None
    for o in origens:
        while i_prox < len(dias_modelo) and dias_modelo[i_prox] < o:
            xs, y = linhas[dias_modelo[i_prox]]
            for a in range(p):
                xa = xs[a]
                if xa == 0.0:
                    continue
                soma_x[a] += xa
                xty[a] += xa * y
                ra = xtx[a]
                for b in range(p):
                    xb = xs[b]
                    if xb != 0.0:
                        ra[b] += xa * xb
            n_treino += 1
            i_prox += 1
        if n_treino < 300:
            continue
        # colunas sem variação no treino (evento ainda não observado) saem do ajuste
        ativas = [a for a in range(p) if a == 0 or (xtx[a][a] > 1e-12 and abs(xtx[a][a] - soma_x[a] ** 2 / n_treino) > 1e-9)]
        try:
            beta_a = resolve([[xtx[a][b] for b in ativas] for a in ativas], [xty[a] for a in ativas])
        except ValueError:
            continue
        beta = [0.0] * p
        for k, a in enumerate(ativas):
            beta[a] = beta_a[k]
        media_x = [s / n_treino for s in soma_x]
        # resíduos do treino (para o intervalo enquanto não há erros fora da amostra)
        res_treino = []
        for d in dias_modelo[:i_prox]:
            xs, y = linhas[d]
            res_treino.append(y - sum(beta[a] * xs[a] for a in ativas))
        base_int = [e for _, e in erros_fora] if len(erros_fora) >= MIN_ERROS_INTERVALO else res_treino
        fonte_int = "erros fora da amostra de origens anteriores" if len(erros_fora) >= MIN_ERROS_INTERVALO else "resíduos do treino"
        qs = {q: quantil(base_int, q) for q in (0.025, 0.1, 0.9, 0.975)}
        fim_mes = date.fromisoformat(o)
        fim_mes = (date(fim_mes.year + (fim_mes.month == 12), fim_mes.month % 12 + 1, 1) - timedelta(days=1)).isoformat()
        novos, ape = [], []
        for d in dias_modelo[i_prox:]:
            if d > fim_mes:
                break
            xs, y = linhas[d]
            yhat = sum(beta[a] * xs[a] for a in ativas)
            contrib = {g: 0.0 for g in GRUPOS}
            for a in ativas:
                if a == 0:
                    continue
                contrib[grupos_ref[a]] += beta[a] * (xs[a] - media_x[a])
            real = math.exp(y)
            prev = math.exp(yhat)
            e = y - yhat
            novos.append((d, e))
            ape.append(abs(real / prev - 1))
            previsoes.append({
                "d": d, "origem": o, "real": real, "previsto": prev, "erro_log": e,
                "p10": prev * math.exp(qs[0.1]), "p90": prev * math.exp(qs[0.9]),
                "p025": prev * math.exp(qs[0.025]), "p975": prev * math.exp(qs[0.975]),
                "contrib_log": contrib, "fonte_intervalo": fonte_int,
            })
        if novos:
            por_origem.append({"origem": o, "dias_treino": n_treino, "dias_previstos": len(novos),
                               "mape_pct": 100 * sum(ape) / len(ape),
                               "vies_pct": 100 * sum(math.exp(e) - 1 for _, e in novos) / len(novos),
                               "fonte_intervalo": fonte_int})
        erros_fora.extend(novos)
        ultimo = {"origem": o, "beta": beta, "ativas": ativas, "media_x": media_x, "n_treino": n_treino,
                  "ultimo_dia_treino": dias_modelo[i_prox - 1] if i_prox else None,
                  "residuos_treino_dp": math.sqrt(sum(r * r for r in res_treino) / max(1, len(res_treino) - len(ativas)))}
    if not previsoes:
        return None
    erros_pct = [100 * (x["real"] / x["previsto"] - 1) for x in previsoes]
    mwmed = [x["real"] - x["previsto"] for x in previsoes]
    cob80 = sum(1 for x in previsoes if x["p10"] <= x["real"] <= x["p90"]) / len(previsoes)
    cob95 = sum(1 for x in previsoes if x["p025"] <= x["real"] <= x["p975"]) / len(previsoes)
    # modelo de referência ingênuo: mesmo dia da semana 52 semanas antes (364 dias)
    ing = []
    for x in previsoes:
        ant = (date.fromisoformat(x["d"]) - timedelta(days=364)).isoformat()
        if ant in carga and carga[ant]:
            ing.append(abs(x["real"] / carga[ant] - 1))
    return {
        "variante": variante, "rotulo": cfg["rotulo"], "inicio_treino": cfg["inicio"], "nos_temperatura": nos,
        "variaveis": [{"nome": n, "grupo": g} for n, g in zip(nomes_ref, grupos_ref)],
        "previsoes": previsoes, "por_origem": por_origem,
        "metricas": {
            "dias": len(previsoes), "origens": len(por_origem),
            "mape_pct": sum(abs(e) for e in erros_pct) / len(erros_pct),
            "vies_pct": sum(erros_pct) / len(erros_pct),
            "mae_mwmed": sum(abs(e) for e in mwmed) / len(mwmed),
            "rmse_mwmed": math.sqrt(sum(e * e for e in mwmed) / len(mwmed)),
            "cobertura_80_pct": 100 * cob80, "cobertura_95_pct": 100 * cob95,
            "mape_referencia_364d_pct": 100 * sum(ing) / len(ing) if ing else None,
            "dias_referencia_364d": len(ing),
        },
        "ultimo_ajuste": ultimo,
        "_linhas": linhas, "_nomes": nomes_ref, "_grupos": grupos_ref,
    }


def contribuicoes_diferenca(resultado, dias_a, dias_b):
    """Decomposição da diferença de ln(carga) média entre dois conjuntos de dias com os
    coeficientes do último ajuste: Δ previsto = Σ_grupo β·(x̄_A − x̄_B) e resíduo =
    Δ real − Δ previsto. Valores em log × 100 (aproximadamente pontos percentuais)."""
    u = resultado["ultimo_ajuste"]
    linhas, grupos = resultado["_linhas"], resultado["_grupos"]
    a = [linhas[d] for d in dias_a if d in linhas]
    b = [linhas[d] for d in dias_b if d in linhas]
    if len(a) != len(dias_a) or len(b) != len(dias_b) or not a:
        return None
    p = len(grupos)
    xa = [sum(r[0][j] for r in a) / len(a) for j in range(p)]
    xb = [sum(r[0][j] for r in b) / len(b) for j in range(p)]
    ya = sum(r[1] for r in a) / len(a)
    yb = sum(r[1] for r in b) / len(b)
    contrib = {g: 0.0 for g in GRUPOS}
    for j in u["ativas"]:
        contrib[grupos[j]] += u["beta"][j] * (xa[j] - xb[j])
    prev = sum(contrib.values())
    return {"real_log100": 100 * (ya - yb), "previsto_log100": 100 * prev,
            "residuo_log100": 100 * ((ya - yb) - prev),
            "contribuicoes_log100": {g: 100 * v for g, v in contrib.items()},
            "variacao_real_pct": 100 * (math.exp(ya - yb) - 1)}


def resposta_temperatura(resultado, grade):
    """Efeito da temperatura no ln(carga) previsto, relativo à média do treino, mantendo
    a temperatura do dia anterior igual à do dia (efeito de um dia típico com aquela
    temperatura). Em log × 100."""
    u = resultado["ultimo_ajuste"]
    nomes = resultado["_nomes"]
    nos = resultado["nos_temperatura"]
    out = []
    ref = None
    for t in grade:
        x = {"temperatura": t, "temperatura_dia_anterior": t}
        for i, k in enumerate(nos):
            x[f"temperatura_acima_{i + 1}"] = max(t - k, 0.0)
        v = sum(u["beta"][j] * (x[n] - u["media_x"][j]) for j, n in enumerate(nomes) if n in x and j in u["ativas"])
        out.append([t, v])
    if out:
        ref = min(out, key=lambda z: z[1])[1]
    return [[t, 100 * v] for t, v in out], (100 * ref if ref is not None else None)
