"""Penetração e gap de crédito municipal.

Cruza o saldo de crédito do ESTBAN (município da dependência bancária) com a estrutura
demográfica e de renda do Censo 2022, e estima quanto crédito um município teria se se
parecesse com seus pares.

As três regras que sustentam tudo o que sai daqui:

1. **O numerador é do ESTBAN, nunca do SCR.** A base pública do SCR.data tem
   granularidade estadual. Nada neste módulo desagrega SCR para município, e nenhum
   número do ESTBAN é rebatizado de SCR. O SCR entra apenas como reconciliação estadual
   — para mostrar o quanto o ESTBAN cobre da exposição de crédito de cada UF.

2. **Estoque contra fluxo.** Crédito é estoque; renda é fluxo. A razão só aparece como
   percentual da renda ANUAL ou como meses equivalentes de renda, nunca crua.

3. **Ausência não é zero.** Município sem linha no ESTBAN não tem dependência bancária
   reportando saldo — o que é diferente de ter crédito zero. Fica fora dos rankings de
   gap, entra numa contagem própria e é declarado.

O gap é contrafactual: "quanto crédito haveria se este município se parecesse com seus
pares". Não é demanda comprovada, não é dinheiro que falta e não é promessa de mercado.
O vocabulário do painel inteiro segue essa regra.
"""
import json
import math

from pipeline import common

REGIOES = {"N": "Norte", "NE": "Nordeste", "SE": "Sudeste", "S": "Sul", "CO": "Centro-Oeste"}

# Cortes mínimos do ranking principal. Sem eles, municípios minúsculos ocupam o topo
# por terem denominador pequeno — o painel publica as duas versões.
MIN_ADULTOS = 20000
MIN_RENDA_ANUAL = 200e6


def _rows(con, sql, args=()):
    cur = con.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# --------------------------------------------------------------------------------------
# Mínimos quadrados em biblioteca padrão: equações normais resolvidas por eliminação
# de Gauss com pivotamento parcial. Cinco regressores e cinco dummies de região — porte
# em que a solução direta é estável e dispensa dependência externa.
# --------------------------------------------------------------------------------------
def _ols(X, y):
    n, k = len(X), len(X[0])
    xtx = [[sum(X[i][a] * X[i][b] for i in range(n)) for b in range(k)] for a in range(k)]
    xty = [sum(X[i][a] * y[i] for i in range(n)) for a in range(k)]
    m = [linha[:] + [xty[a]] for a, linha in enumerate(xtx)]
    for c in range(k):
        piv = max(range(c, k), key=lambda r: abs(m[r][c]))
        if abs(m[piv][c]) < 1e-12:
            return None
        m[c], m[piv] = m[piv], m[c]
        for r in range(k):
            if r == c:
                continue
            f = m[r][c] / m[c][c]
            for j in range(c, k + 1):
                m[r][j] -= f * m[c][j]
    beta = [m[a][k] / m[a][a] for a in range(k)]
    pred = [sum(X[i][a] * beta[a] for a in range(k)) for i in range(n)]
    res = [y[i] - pred[i] for i in range(n)]
    ybar = sum(y) / n
    sqt = sum((v - ybar) ** 2 for v in y)
    sqr = sum(r * r for r in res)
    r2 = 1 - sqr / sqt if sqt else None
    gl = n - k
    sigma = math.sqrt(sqr / gl) if gl > 0 else None
    return {"beta": beta, "r2": r2, "sigma": sigma, "n": n, "k": k,
            "r2_aj": 1 - (1 - r2) * (n - 1) / gl if (r2 is not None and gl > 0) else None,
            "residuos": res, "duan": sum(math.exp(r) for r in res) / n}


def _quantil(vals, q):
    v = sorted(x for x in vals if x is not None)
    if not v:
        return None
    p = q * (len(v) - 1)
    lo, hi = int(math.floor(p)), int(math.ceil(p))
    return v[lo] if lo == hi else v[lo] + (v[hi] - v[lo]) * (p - lo)


def _faixa(v, cortes):
    for i, c in enumerate(cortes):
        if v <= c:
            return i
    return len(cortes)


def build(con, cfg=None):
    try:
        datas = [r["data_base"] for r in _rows(con, "SELECT data_base FROM estban_coleta ORDER BY data_base DESC")]
    except Exception:
        datas = []
    if not datas:
        common.write_gold("penetracao.json", {"disponivel": False, "motivo": "ESTBAN ainda não coletado"})
        return {"ok": False}
    atual = datas[0]

    censo = {r["cod_ibge"]: r for r in _rows(con, "SELECT * FROM censo_mun")}
    ident = {r["cod_ibge"]: r for r in _rows(con, "SELECT * FROM ibge_municipios")}
    estban = {r["cod_ibge"]: r for r in _rows(con,
              "SELECT * FROM estban_mun WHERE data_base=?", (atual,))}
    malha = {r["cod_ibge"]: r["svg_d"] for r in _rows(con, "SELECT * FROM censo_malha")}
    meta_malha = {r["chave"]: r["valor"] for r in _rows(con, "SELECT * FROM censo_meta")}

    # ---- monta a base municipal ------------------------------------------------------
    muns = []
    for cod, ig in ident.items():
        c = censo.get(cod)
        if not c or not c.get("pop_18mais") or not c.get("renda_dom_mensal"):
            continue
        e = estban.get(cod)
        renda_anual = c["renda_dom_mensal"] * 12
        credito = e["credito"] if e else None
        m = {
            "cod": cod, "nome": ig["nome"], "uf": ig["uf"], "regiao": REGIOES.get(ig["regiao"], ig["regiao"]),
            "pop_total": c["pop_total"], "adultos": c["pop_18mais"],
            "moradores": c["moradores_dpp"], "renda_pc": c["renda_pc_mensal"],
            "renda_mensal": c["renda_dom_mensal"], "renda_anual": renda_anual,
            "urbanizacao": c["urbanizacao"],
            "credito": credito,
            "instituicoes": e["instituicoes"] if e else 0,
            "agencias": e["agencias"] if e else 0,
            "depositos": e["depositos"] if e else None,
            "no_estban": bool(e),
        }
        if credito is not None and credito > 0:
            m["cred_adulto"] = credito / c["pop_18mais"]
            m["cred_hab"] = credito / c["pop_total"] if c["pop_total"] else None
            m["penetracao"] = 100 * credito / renda_anual          # % da renda anual
            m["meses_renda"] = credito / c["renda_dom_mensal"]      # meses equivalentes
            m["cred_deposito"] = credito / e["depositos"] if e and e["depositos"] else None
        muns.append(m)

    com_credito = [m for m in muns if m.get("credito")]
    sem_estban = [m for m in muns if not m["no_estban"]]

    # participações dentro da UF
    tot_uf = {}
    for m in muns:
        t = tot_uf.setdefault(m["uf"], {"credito": 0.0, "renda": 0.0, "adultos": 0.0})
        t["credito"] += m.get("credito") or 0
        t["renda"] += m["renda_anual"]
        t["adultos"] += m["adultos"]
    for m in muns:
        t = tot_uf[m["uf"]]
        m["part_cred_uf"] = round(100 * (m.get("credito") or 0) / t["credito"], 3) if t["credito"] else None
        m["part_renda_uf"] = round(100 * m["renda_anual"] / t["renda"], 3) if t["renda"] else None
        m["part_adultos_uf"] = round(100 * m["adultos"] / t["adultos"], 3) if t["adultos"] else None

    # ---- método 1: benchmark por pares ----------------------------------------------
    cortes_adultos = [_quantil([m["adultos"] for m in com_credito], q) for q in (0.25, 0.5, 0.75, 0.95)]
    cortes_renda_pc = [_quantil([m["renda_pc"] for m in com_credito], q) for q in (0.33, 0.66)]
    for m in muns:
        m["_grupo"] = (m["regiao"], _faixa(m["adultos"], cortes_adultos),
                       _faixa(m["renda_pc"], cortes_renda_pc),
                       1 if (m["urbanizacao"] or 0) >= 75 else 0)
    grupos = {}
    for m in com_credito:
        grupos.setdefault(m["_grupo"], []).append(m["penetracao"])
    for m in muns:
        pares = grupos.get(m["_grupo"], [])
        if len(pares) >= 8:
            med = _quantil(pares, 0.5)
            m["pares_n"] = len(pares)
            m["pares_penetracao"] = round(med, 3)
            m["pares_credito_esperado"] = med / 100 * m["renda_anual"]
        else:
            m["pares_n"] = len(pares)
            m["pares_penetracao"] = None
            m["pares_credito_esperado"] = None

    # ---- método 2: modelo log-log ----------------------------------------------------
    # ln(renda anual) e ln(adultos) têm correlação de 0,957 — renda ≈ moradores ×
    # renda per capita. Mantê-las juntas produzia elasticidade-renda NEGATIVA, que não
    # tem leitura econômica. Escala (adultos) e prosperidade (renda per capita) são
    # quase ortogonais entre si (corr 0,06) e dão o mesmo R² com coeficientes legíveis.
    regs = ["ln_adultos", "ln_renda_pc", "urb"]
    regioes_ord = sorted({m["regiao"] for m in com_credito})
    amostra = [m for m in com_credito if m["renda_anual"] > 0 and m["adultos"] > 0 and m["renda_pc"] > 0]
    X, y = [], []
    for m in amostra:
        linha = [1.0, math.log(m["adultos"]), math.log(m["renda_pc"]), (m["urbanizacao"] or 0) / 100]
        linha += [1.0 if m["regiao"] == r else 0.0 for r in regioes_ord[1:]]
        X.append(linha)
        y.append(math.log(m["credito"]))
    mod = _ols(X, y) if len(X) > 50 else None

    if mod:
        for m, res in zip(amostra, mod["residuos"]):
            m["_residuo"] = res
        for m in muns:
            if m["renda_anual"] <= 0 or m["adultos"] <= 0 or not m["renda_pc"]:
                continue
            linha = [1.0, math.log(m["adultos"]), math.log(m["renda_pc"]), (m["urbanizacao"] or 0) / 100]
            linha += [1.0 if m["regiao"] == r else 0.0 for r in regioes_ord[1:]]
            lnhat = sum(linha[a] * mod["beta"][a] for a in range(len(linha)))
            # exp(lnhat) é a MEDIANA condicional, e é ela que serve de referência:
            # metade dos municípios comparáveis fica acima, metade abaixo — que é o
            # sentido de "parecido com seus pares", e o mesmo critério do benchmark.
            # A média condicional (exp(lnhat) × fator de Duan, 46% maior por causa da
            # assimetria da log-normal) deixaria a maioria abaixo do esperado por
            # construção, e o gap mediria a assimetria da distribuição, não falta de
            # crédito. Fica publicada ao lado, para quem precisar somar volume.
            m["modelo_credito_esperado"] = math.exp(lnhat)
            m["modelo_media_condicional"] = math.exp(lnhat) * mod["duan"]
            if m.get("_residuo") is not None and mod["sigma"]:
                m["residuo_padronizado"] = round(m["_residuo"] / mod["sigma"], 3)
            # intervalo de referência: ±1 desvio residual, no espaço original
            if mod["sigma"]:
                m["modelo_faixa"] = [math.exp(lnhat - mod["sigma"]), math.exp(lnhat + mod["sigma"])]

    # ---- gaps -------------------------------------------------------------------------
    for m in muns:
        for metodo, campo in (("pares", "pares_credito_esperado"), ("modelo", "modelo_credito_esperado")):
            esp = m.get(campo)
            obs = m.get("credito")
            if esp and obs is not None:
                m[f"gap_abs_{metodo}"] = max(0.0, esp - obs)
                m[f"gap_rel_{metodo}"] = round(100 * (esp - obs) / esp, 2)
            else:
                m[f"gap_abs_{metodo}"] = None
                m[f"gap_rel_{metodo}"] = None

    # ---- selo de confiabilidade -------------------------------------------------------
    p99_cred_adulto = _quantil([m["cred_adulto"] for m in com_credito], 0.99)
    for m in muns:
        motivos = []
        if not m["no_estban"]:
            m["confianca"] = "baixa"
            m["confianca_motivo"] = ("Município sem dependência bancária reportando ao ESTBAN. "
                                     "Ausência de saldo não significa crédito zero.")
            continue
        if m.get("cred_adulto") and p99_cred_adulto and m["cred_adulto"] > 3 * p99_cred_adulto:
            motivos.append("crédito por adulto muito acima do universo — forte indício de contabilização centralizada")
        if m.get("meses_renda") and m["meses_renda"] > 120:
            motivos.append("saldo equivalente a mais de 10 anos de renda local")
        if m["instituicoes"] <= 1:
            motivos.append("uma única instituição reportando")
        if m.get("credito") and m["credito"] < 1e5:
            motivos.append("saldo muito pequeno, sensível a arredondamento")
        m["confianca"] = "baixa" if len([x for x in motivos if "centraliz" in x or "10 anos" in x]) else \
                         ("media" if motivos else "alta")
        m["confianca_motivo"] = "; ".join(motivos) or "Múltiplas instituições e penetração dentro da faixa do universo."

    # ---- rankings ---------------------------------------------------------------------
    def corta(lista, minimos=True):
        base = [m for m in lista if m.get("credito") and m["confianca"] != "baixa"]
        if minimos:
            base = [m for m in base if m["adultos"] >= MIN_ADULTOS and m["renda_anual"] >= MIN_RENDA_ANUAL]
        return base

    def top(lista, chave, n=25, rev=True):
        v = [m for m in lista if m.get(chave) is not None]
        v.sort(key=lambda m: m[chave], reverse=rev)
        return [_resumo(m) for m in v[:n]]

    universo = corta(muns)
    universo_sem_corte = corta(muns, minimos=False)

    # oportunidade com escala: combina gap absoluto, gap relativo e porte, em postos
    # normalizados — evita que uma escala domine a outra
    if universo:
        def posto(lista, chave, rev=True):
            v = sorted([m for m in lista if m.get(chave) is not None], key=lambda m: m[chave], reverse=rev)
            return {m["cod"]: (i + 1) / len(v) for i, m in enumerate(v)}
        p_abs = posto(universo, "gap_abs_modelo")
        p_rel = posto(universo, "gap_rel_modelo")
        p_por = posto(universo, "adultos")
        for m in universo:
            partes = [p_abs.get(m["cod"]), p_rel.get(m["cod"]), p_por.get(m["cod"])]
            if all(x is not None for x in partes):
                # menor posto médio = melhor colocado nas três dimensões
                m["escore_oportunidade"] = round(100 * (1 - sum(partes) / 3), 2)

    rankings = {
        "gap_absoluto": top(universo, "gap_abs_modelo"),
        "gap_relativo": top(universo, "gap_rel_modelo"),
        "menor_credito_adulto": top(universo, "cred_adulto", rev=False),
        "menor_penetracao": top(universo, "penetracao", rev=False),
        "oportunidade_escala": top(universo, "escore_oportunidade"),
        "maior_penetracao": top(universo, "penetracao"),
        "mais_atipicos": sorted([_resumo(m) for m in universo if m.get("residuo_padronizado") is not None],
                                key=lambda m: abs(m["residuo_padronizado"]), reverse=True)[:25],
        "gap_absoluto_sem_corte": top(universo_sem_corte, "gap_abs_modelo", n=15),
        "menor_credito_adulto_sem_corte": top(universo_sem_corte, "cred_adulto", n=15, rev=False),
    }

    # ---- agregados e achados -----------------------------------------------------------
    cred_total = sum(m["credito"] for m in com_credito)
    renda_total = sum(m["renda_anual"] for m in muns)
    adultos_total = sum(m["adultos"] for m in muns)
    abaixo = [m for m in universo if (m.get("gap_abs_modelo") or 0) > 0]
    gap_total = sum(m["gap_abs_modelo"] for m in abaixo)
    adultos_abaixo = sum(m["adultos"] for m in abaixo)

    por_regiao_gap = {}
    for m in rankings["gap_absoluto"]:
        por_regiao_gap[m["regiao"]] = por_regiao_gap.get(m["regiao"], 0) + 1
    reg_lider = max(por_regiao_gap.items(), key=lambda kv: kv[1]) if por_regiao_gap else None

    grandes = [m for m in universo if m["adultos"] >= 100000]
    menor_pen_grande = min(grandes, key=lambda m: m["penetracao"]) if grandes else None

    achados = []
    if menor_pen_grande:
        achados.append({
            "texto": (f"Entre os {len(grandes)} municípios com mais de 100 mil adultos, "
                      f"{menor_pen_grande['nome']} ({menor_pen_grande['uf']}) apresenta a menor relação entre "
                      f"crédito e renda: {menor_pen_grande['penetracao']:.1f}% da renda domiciliar anual, "
                      f"equivalente a {menor_pen_grande['meses_renda']:.1f} meses de renda."),
            "selo": "calculado", "filtro": "municípios com ≥ 100 mil adultos e confiabilidade não baixa",
            "periodo": atual, "universo": f"{len(grandes)} municípios",
            "ressalva": "Saldo do ESTBAN é o contabilizado nas dependências do município, não o crédito dos residentes.",
        })
    achados.append({
        "texto": (f"Os {len(abaixo)} municípios abaixo do esperado pelo modelo concentram cerca de "
                  f"R$ {gap_total / 1e9:.1f} bilhões de gap estimado, e neles vivem "
                  f"{adultos_abaixo / 1e6:.1f} milhões de adultos."),
        "selo": "estimado", "filtro": f"≥ {MIN_ADULTOS:,} adultos e renda anual ≥ R$ {MIN_RENDA_ANUAL/1e6:.0f} mi".replace(",", "."),
        "periodo": atual, "universo": f"{len(universo)} municípios elegíveis",
        "ressalva": "Gap é contrafactual do modelo, não demanda comprovada nem dinheiro que falta.",
    })
    if reg_lider:
        achados.append({
            "texto": (f"A região {reg_lider[0]} reúne {reg_lider[1]} dos 25 maiores gaps absolutos estimados."),
            "selo": "estimado", "filtro": "ranking de gap absoluto pelo modelo",
            "periodo": atual, "universo": "25 primeiros",
            "ressalva": "Concentração regional do gap acompanha a concentração da própria renda.",
        })
    achados.append({
        "texto": (f"{len(sem_estban)} dos {len(muns)} municípios não têm nenhuma dependência bancária "
                  f"reportando saldo ao ESTBAN — neles vivem {sum(m['adultos'] for m in sem_estban)/1e6:.1f} "
                  f"milhões de adultos. Ausência de saldo não é crédito zero."),
        "selo": "observado", "filtro": "todos os municípios", "periodo": atual,
        "universo": f"{len(muns)} municípios", "ressalva": "Estes municípios ficam fora dos rankings de gap.",
    })
    top1 = max(com_credito, key=lambda m: m["credito"])
    achados.append({
        "texto": (f"{top1['nome']} ({top1['uf']}) concentra {100*top1['credito']/cred_total:.1f}% de todo o saldo "
                  f"municipal do país, e os dez maiores somam "
                  f"{100*sum(sorted((m['credito'] for m in com_credito), reverse=True)[:10])/cred_total:.1f}%."),
        "selo": "observado", "filtro": "todos os municípios com saldo", "periodo": atual,
        "universo": f"{len(com_credito)} municípios",
        "ressalva": ("Concentração reflete sede administrativa e contabilização centralizada de grandes "
                     "instituições, não necessariamente crédito tomado por residentes."),
    })

    # ---- reconciliação estadual com o SCR ----------------------------------------------
    reconc = {"disponivel": False, "motivo": "SCR.data estadual não disponível neste armazém"}
    try:
        scr = _rows(con, """SELECT uf, SUM(saldo) saldo FROM scr_uf
                            WHERE data=(SELECT MAX(data) FROM scr_uf) GROUP BY uf""")
        if scr:
            por_uf_estban = {}
            for m in com_credito:
                por_uf_estban[m["uf"]] = por_uf_estban.get(m["uf"], 0) + m["credito"]
            linhas = []
            for r in scr:
                eb = por_uf_estban.get(r["uf"])
                if eb and r["saldo"]:
                    linhas.append({"uf": r["uf"], "estban": round(eb, 2), "scr": round(r["saldo"], 2),
                                   "razao": round(eb / r["saldo"], 3)})
            reconc = {"disponivel": True, "linhas": sorted(linhas, key=lambda x: -x["razao"]),
                      "nota": ("Razão entre o saldo contabilizado no ESTBAN e a exposição do SCR na mesma UF. "
                               "Não é erro de medição: são conceitos diferentes, e a razão acima de 1 indica "
                               "contabilização de operações de tomadores de outras UFs.")}
    except Exception:
        pass

    payload = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "data_base_credito": atual,
        "datas_credito": datas,
        "ano_base_censo": 2022,
        "fontes": {
            "credito": "BCB — ESTBAN, Estatística Bancária Mensal por município (documento 4500), verbete 160",
            "demografia": "IBGE — Censo Demográfico 2022, tabelas 9514, 10295 e 9923",
            "malha": "IBGE — malha municipal, qualidade mínima, códigos de 7 dígitos",
        },
        "cobertura": {
            "municipios_brasil": len(muns),
            "com_saldo_estban": len(com_credito),
            "sem_saldo_estban": len(sem_estban),
            "adultos_sem_estban": sum(m["adultos"] for m in sem_estban),
            "elegiveis_ranking": len(universo),
            "min_adultos": MIN_ADULTOS, "min_renda_anual": MIN_RENDA_ANUAL,
        },
        "totais": {
            "credito": round(cred_total, 2),
            "renda_anual": round(renda_total, 2),
            "adultos": adultos_total,
            "cred_adulto_br": round(cred_total / adultos_total, 2),
            "penetracao_br": round(100 * cred_total / renda_total, 2),
            "gap_estimado": round(gap_total, 2),
            "municipios_abaixo": len(abaixo),
            "adultos_abaixo": adultos_abaixo,
        },
        "modelo": None if not mod else {
            "especificacao": ("ln(crédito) = β₀ + β₁·ln(população 18+) + β₂·ln(renda domiciliar per capita) "
                              "+ β₃·urbanização + efeitos fixos de região"),
            "por_que_assim": ("Renda domiciliar total e população adulta têm correlação de 0,957 entre si — "
                              "a renda é, por construção, moradores vezes renda per capita. Estimadas juntas, "
                              "produziam elasticidade-renda negativa, sem leitura econômica possível. Escala e "
                              "prosperidade separadas são quase ortogonais (correlação de 0,06), entregam o mesmo "
                              "R² e dão coeficientes interpretáveis."),
            "n": mod["n"], "r2": round(mod["r2"], 4), "r2_ajustado": round(mod["r2_aj"], 4),
            "sigma_residual": round(mod["sigma"], 4), "fator_duan": round(mod["duan"], 4),
            "coeficientes": dict(zip(["intercepto"] + regs + [f"regiao:{r}" for r in regioes_ord[1:]],
                                     [round(b, 4) for b in mod["beta"]])),
            "referencia": ("O crédito esperado é a MEDIANA condicional, exp(ln estimado). Metade dos "
                           "municípios comparáveis fica acima dela e metade abaixo — mesmo critério do "
                           "benchmark de pares, o que torna os dois métodos comparáveis."),
            "nota": ("A média condicional, que multiplica a mediana pelo fator de Duan, também é publicada "
                     "por município. Ela é maior porque a distribuição em logaritmo é assimétrica; usá-la "
                     "como referência deixaria a maioria dos municípios 'abaixo do esperado' por construção. "
                     "O modelo descreve a relação média entre porte econômico e saldo contabilizado; não "
                     "identifica oferta nem demanda."),
        },
        "benchmark_pares": {
            "criterio": "região × faixa de população adulta (quartis) × faixa de renda per capita (tercis) × urbanização (≥75%)",
            "estatistica": "mediana da penetração do grupo",
            "minimo_grupo": 8,
            "grupos": len(grupos),
            "cobertos": sum(1 for m in muns if m.get("pares_penetracao") is not None),
        },
        "rankings": rankings,
        "achados": achados,
        "reconciliacao_scr": reconc,
        "municipios": [_resumo(m, completo=True) for m in muns],
    }
    # a geometria vai para arquivo próprio: mantém o JSON de dados leve para teste,
    # exportação e leitura, e deixa o mapa ser carregado só quando a página abre
    common.write_gold("penetracao_malha.json",
                      {"viewBox": meta_malha.get("malha_viewbox"),
                       "transform": meta_malha.get("malha_transform"),
                       "paths": malha, "municipios": len(malha),
                       "fonte": "IBGE — malha municipal, qualidade mínima"})
    payload["malha_arquivo"] = "penetracao_malha.json"
    common.write_gold("penetracao.json", payload)
    return {"ok": True, "municipios": len(muns), "com_saldo": len(com_credito),
            "gap_bi": round(gap_total / 1e9, 1), "r2": payload["modelo"]["r2"] if mod else None}


def _resumo(m, completo=False):
    base = {
        "cod": m["cod"], "nome": m["nome"], "uf": m["uf"], "regiao": m["regiao"],
        "adultos": m["adultos"], "pop_total": m["pop_total"],
        "renda_anual": round(m["renda_anual"], 2), "renda_pc": m["renda_pc"],
        "urbanizacao": m["urbanizacao"],
        "credito": round(m["credito"], 2) if m.get("credito") is not None else None,
        "cred_adulto": round(m["cred_adulto"], 2) if m.get("cred_adulto") else None,
        "penetracao": round(m["penetracao"], 3) if m.get("penetracao") else None,
        "meses_renda": round(m["meses_renda"], 2) if m.get("meses_renda") else None,
        "gap_abs_modelo": round(m["gap_abs_modelo"], 2) if m.get("gap_abs_modelo") is not None else None,
        "gap_rel_modelo": m.get("gap_rel_modelo"),
        "gap_abs_pares": round(m["gap_abs_pares"], 2) if m.get("gap_abs_pares") is not None else None,
        "gap_rel_pares": m.get("gap_rel_pares"),
        "residuo_padronizado": m.get("residuo_padronizado"),
        "confianca": m.get("confianca"),
        "no_estban": m["no_estban"],
        "escore_oportunidade": m.get("escore_oportunidade"),
    }
    if completo:
        base.update({
            "instituicoes": m["instituicoes"], "agencias": m["agencias"],
            "cred_hab": round(m["cred_hab"], 2) if m.get("cred_hab") else None,
            "part_cred_uf": m.get("part_cred_uf"), "part_renda_uf": m.get("part_renda_uf"),
            "part_adultos_uf": m.get("part_adultos_uf"),
            "pares_penetracao": m.get("pares_penetracao"), "pares_n": m.get("pares_n"),
            "modelo_esperado": round(m["modelo_credito_esperado"], 2) if m.get("modelo_credito_esperado") else None,
            "modelo_media": round(m["modelo_media_condicional"], 2) if m.get("modelo_media_condicional") else None,
            "modelo_faixa": [round(x, 2) for x in m["modelo_faixa"]] if m.get("modelo_faixa") else None,
            "confianca_motivo": m.get("confianca_motivo"),
        })
    return base
