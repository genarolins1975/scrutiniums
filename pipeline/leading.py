"""Sinais Antecedentes de Estresse de Crédito — gold leading.json (MVP Fase 1).

Distinção conceitual obrigatória (§1 da especificação):
    coincidente · antecedente candidato · contexto · associação exploratória.
Correlações defasadas aqui calculadas classificam no MÁXIMO como "antecedente
candidato"; a promoção plena ("promovido") permanece exclusiva do protocolo da aba
Antecedentes (defasagem + Granger + ganho fora da amostra + estabilidade).

Subíndices (z-scores decompostos; componentes 100% reais):
    pressao_familias · garantias · consumidor · empresarial_judicial · nao_bancario.
IAEC composto: NÃO calculado nesta fase (validação prévia dos componentes pendente).
Buscas (Google Trends): INDISPONÍVEL por licença — estrutura documentada.
"""
import statistics
from datetime import date

from pipeline import common

COBERTURA_MINIMA_SUBINDICES = 4  # síntese geral só com ≥4 subíndices com dado


def _z_series(vals):
    """z-score sobre a própria história (janela completa disponível, declarada)."""
    xs = [v for _d, v in vals if v is not None]
    if len(xs) < 12:
        return None
    m = statistics.fmean(xs)
    sd = statistics.pstdev(xs)
    if sd == 0:
        return None
    return [(d, (v - m) / sd if v is not None else None) for d, v in vals]


def _yoy(vals):
    out = []
    idx = {d: v for d, v in vals}
    for d, v in vals:
        prev = f"{int(d[:4]) - 1}{d[4:]}"
        if v is not None and idx.get(prev):
            out.append((d, (v / idx[prev] - 1) * 100))
    return out


def _lag_corr(sig, target, max_lag=12):
    """Correlação de Pearson entre sinal_t e alvo_{t+k} (mensal); n mínimo 24."""
    s_idx = {d: v for d, v in sig if v is not None}
    t_list = [(d, v) for d, v in target if v is not None]
    out = []
    for k in range(0, max_lag + 1):
        pares = []
        for i, (d, tv) in enumerate(t_list):
            if i - k < 0:
                continue
            sd = t_list[i - k][0] if k else d
            sv = s_idx.get(sd)  # sinal defasado k meses antes do alvo
            if sv is not None:
                pares.append((sv, tv))
        if len(pares) < 24:
            out.append({"lag": k, "corr": None, "n": len(pares)})
            continue
        xs, ys = [p[0] for p in pares], [p[1] for p in pares]
        mx, my = statistics.fmean(xs), statistics.fmean(ys)
        num = sum((x - mx) * (y - my) for x, y in pares)
        den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
        out.append({"lag": k, "corr": round(num / den, 3) if den else None, "n": len(pares)})
    return out


def _mensal_sgs(con, key):
    rows = common.get_series(con, key)
    return [(d[:7].replace("-", ""), v) for d, v in rows]


def build(con, cfg):
    gerado = common.now_utc()
    catalog, series, validacao, alertas = [], {}, [], []

    def add_signal(sid, nome, categoria, racional, fonte, freq, transform, classe, unit, vals, sinal_esperado):
        if not vals:
            return None
        series[sid] = [{"p": d, "v": round(v, 3) if v is not None else None} for d, v in vals[-72:]]
        catalog.append({
            "signal_id": sid, "name": nome, "category": categoria, "description": racional.split(".")[0] + ".",
            "economic_rationale": racional, "source_id": fonte, "frequency": freq,
            "geography_level": "Brasil", "original_unit": unit, "transformation": transform,
            "expected_sign": sinal_esperado, "quality_status": "observado/calculado",
            "license_status": "dados abertos", "methodology_version": "v1.0",
            "classificacao_conceitual": classe,
        })
        return vals

    # ---------- alvo: inadimplência total (coincidente) ----------
    inad = _mensal_sgs(con, "inad_total")
    add_signal("inad_total", "Inadimplência >90d (alvo)", "alvo",
               "Indicador COINCIDENTE de materialização do risco. É o alvo contra o qual as defasagens são medidas.",
               "BCB/SGS 21082", "mensal", "nível %", "coincidente", "%", inad, "+")

    # ---------- 1. pressão financeira das famílias ----------
    comp = _mensal_sgs(con, "comprometimento")
    end = _mensal_sgs(con, "endividamento")
    add_signal("comprometimento", "Comprometimento de renda das famílias", "pressao_familias",
               "Parcela da renda consumida pelo serviço da dívida. Quando elevada, choques de renda ou juros transbordam mais rápido para atraso. Nível alto é CONTEXTO de vulnerabilidade; a variação pode anteceder deterioração.",
               "BCB/SGS 29034", "mensal", "nível % (z-score)", "contexto", "%", comp, "+")
    add_signal("endividamento", "Endividamento das famílias / renda 12m", "pressao_familias",
               "Estoque de dívida sobre renda anual: mede alavancagem das famílias — vulnerabilidade estrutural, não gatilho imediato.",
               "BCB/SGS 29037", "mensal", "nível % (z-score)", "contexto", "%", end, "+")

    # ---------- 2. garantias (IVG-R real) ----------
    ivgr = _mensal_sgs(con, "ivgr")
    ipca = _mensal_sgs(con, "ipca")
    ivgr_real_yoy = []
    if ivgr and ipca:
        ipca_idx = {}
        acc = 100.0
        for d, v in sorted(ipca):
            acc *= (1 + (v or 0) / 100)
            ipca_idx[d] = acc
        real = [(d, v / ipca_idx[d] * 100) for d, v in ivgr if d in ipca_idx]
        ivgr_real_yoy = _yoy(real)
    add_signal("ivgr_real_yoy", "IVG-R real — variação 12m", "garantias",
               "Valor real (deflacionado pelo IPCA) das garantias imobiliárias residenciais. Queda real reduz a recuperação esperada em caso de default e pode elevar a severidade da perda (LGD); alta protege o credor. NÃO mede a carteira de garantias de cada banco.",
               "BCB/SGS 21340 (IVG-R) + 433 (IPCA), cálculo próprio", "mensal", "variação real 12m (%)", "antecedente candidato", "%", ivgr_real_yoy, "-")

    # ---------- 3. consumidor (reclamações BCB) ----------
    recl = con.execute("""SELECT ano, trimestre, indice FROM reclamacoes WHERE indice IS NOT NULL""").fetchall()
    por_tri = {}
    for ano, tri, idx in recl:
        por_tri.setdefault((ano, tri), []).append(idx)
    recl_med = sorted(((f"{a}{(int(t[0]) if str(t)[0].isdigit() else int(str(t)[-1])) * 3:02d}" if False else f"{a}T{t}", statistics.median(v))
                       for (a, t), v in por_tri.items()))
    # normaliza rótulo AAAA T# -> usa fim do trimestre como mês
    recl_m = []
    for (a_t, med) in recl_med:
        a, t = a_t.split("T")
        mes = int(str(t)[-1]) * 3
        recl_m.append((f"{a}{mes:02d}", med))
    add_signal("reclamacoes_mediana", "Reclamações BCB — mediana do índice (top instituições)", "consumidor",
               "Reclamações procedentes por milhão de clientes. Alta generalizada pode indicar atrito de cobrança/renegociação e pressão sobre consumidores ANTES do atraso — mas também mudanças de conduta ou de metodologia do ranking.",
               "BCB rdrweb (ranking trimestral)", "trimestral", "mediana do índice (z-score)", "associação exploratória", "índice", recl_m, "+")

    # ---------- 4. empresarial/judicial (RJ e falências, CNJ) ----------
    rj_rows = common.get_series(con, "recuperacao_judicial_agregado") or []
    fal_rows = common.get_series(con, "falencia_agregado") or []
    def _norm_cnj(rows):
        return [(d[:7].replace("-", ""), v) for d, v in rows]
    rj_m, fal_m = _norm_cnj(rj_rows), _norm_cnj(fal_rows)
    rj_yoy = _yoy(rj_m)
    add_signal("rj_yoy", "Recuperações judiciais ajuizadas — var. 12m", "empresarial_judicial",
               "Empresas em RJ sinalizam estresse de caixa do setor produtivo; tendem a anteceder perdas em crédito PJ e cadeias de fornecedores. Cobertura: 8 tribunais estaduais (declarada).",
               "CNJ/DataJud (classe 129)", "mensal", "variação 12m (%)", "antecedente candidato", "%", rj_yoy, "+")
    fal_yoy = _yoy(fal_m)
    add_signal("falencias_yoy", "Falências ajuizadas — var. 12m", "empresarial_judicial",
               "Falência é o estágio terminal do estresse empresarial — mais coincidente/defasada que a RJ, mas confirma a tendência.",
               "CNJ/DataJud (classe 108)", "mensal", "variação 12m (%)", "contexto", "%", fal_yoy, "+")

    # ---------- 5. crédito não bancário (FIDC) ----------
    fidc = con.execute("SELECT anomes, n_fundos, carteira, venc_inad FROM fidc_agg ORDER BY anomes").fetchall()
    fidc_pct = [(am, vi / c * 100) for am, _n, c, vi in fidc if c]
    add_signal("fidc_inad_pct", "FIDCs — créditos vencidos inadimplentes / carteira", "nao_bancario",
               "FIDCs concentram crédito originado fora dos bancos (recebíveis, consignado privado, PMEs). Deterioração aqui pode anteceder o sistema bancário — originadores mais arriscados sentem o ciclo primeiro. Atraso ≠ perda: subordinação e garantias absorvem parte (estruturas heterogêneas).",
               "CVM — informes mensais FIDC (tab I)", "mensal", "% da carteira agregada", "antecedente candidato", "%", fidc_pct, "+")

    # ---------- subíndices (z médio dos componentes, decomposto) ----------
    SUB_DEF = {
        "pressao_familias": ["comprometimento", "endividamento"],
        "garantias": ["ivgr_real_yoy"],
        "consumidor": ["reclamacoes_mediana"],
        "empresarial_judicial": ["rj_yoy", "falencias_yoy"],
        "nao_bancario": ["fidc_inad_pct"],
    }
    SUB_NOMES = {"pressao_familias": "Pressão Financeira das Famílias", "garantias": "Garantias e Patrimônio",
                 "consumidor": "Consumidor (reclamações)", "empresarial_judicial": "Estresse Empresarial e Judicial",
                 "nao_bancario": "Crédito Não Bancário (FIDCs)"}
    SINAL_INVERTIDO = {"ivgr_real_yoy"}  # queda do valor real das garantias = MAIS estresse
    subindices = {}
    for sid_grupo, comps in SUB_DEF.items():
        zs_comp = {}
        for c in comps:
            raw = [(x["p"], x["v"]) for x in series.get(c, [])]
            z = _z_series(raw)
            if z:
                zs_comp[c] = {d: (-v if c in SINAL_INVERTIDO and v is not None else v) for d, v in z}
        if not zs_comp:
            continue
        datas = sorted(set.union(*[set(m) for m in zs_comp.values()]))
        serie_sub = []
        for d in datas:
            vals = [m[d] for m in zs_comp.values() if m.get(d) is not None]
            if vals:
                serie_sub.append({"p": d, "z": round(sum(vals) / len(vals), 2), "n_comp": len(vals)})
        if len(serie_sub) < 6:
            continue
        atual = serie_sub[-1]
        tres_atras = serie_sub[-4] if len(serie_sub) >= 4 else serie_sub[0]
        contrib = {}
        for c, m in zs_comp.items():
            ult = [v for d, v in sorted(m.items()) if v is not None]
            if ult:
                contrib[c] = round(ult[-1], 2)
        subindices[sid_grupo] = {
            "nome": SUB_NOMES[sid_grupo], "z_atual": atual["z"], "delta_3m": round(atual["z"] - tres_atras["z"], 2),
            "tendencia": "subindo" if atual["z"] - tres_atras["z"] > 0.15 else ("caindo" if atual["z"] - tres_atras["z"] < -0.15 else "estável"),
            "cobertura": f"{atual['n_comp']}/{len(comps)} componentes", "confianca": "moderada" if atual["n_comp"] == len(comps) else "baixa",
            "contribuicoes": contrib, "serie": serie_sub[-48:],
            "ultima_ref": atual["p"],
        }

    # ---------- validação exploratória de defasagens vs. inadimplência ----------
    for sid in ("ivgr_real_yoy", "rj_yoy", "fidc_inad_pct", "comprometimento", "reclamacoes_mediana"):
        sraw = [(x["p"], x["v"]) for x in series.get(sid, [])]
        if not sraw or not inad:
            continue
        corrs = _lag_corr(sraw, inad, 12)
        validos = [c for c in corrs if c["corr"] is not None]
        if not validos:
            validacao.append({"signal_id": sid, "status": "amostra insuficiente", "corrs": corrs})
            continue
        melhor = max(validos, key=lambda c: abs(c["corr"]))
        cont = next((c for c in validos if c["lag"] == 0), None)
        antecede = melhor["lag"] > 0 and cont and abs(melhor["corr"]) > abs(cont["corr"]) + 0.03
        validacao.append({
            "signal_id": sid, "corrs": corrs, "melhor_lag": melhor["lag"], "melhor_corr": melhor["corr"],
            "n": melhor["n"],
            "status": ("antecedente candidato (correlação defasada > contemporânea)" if antecede
                       else "associação contemporânea/exploratória"),
            "ressalva": "correlação NÃO valida antecedência: promoção plena exige Granger + ganho fora da amostra + estabilidade (protocolo da aba Antecedentes).",
        })

    # ---------- alertas (regra transparente: z>1 com alta 3m e persistência ≥2 meses) ----------
    for gid, s in subindices.items():
        serie = s["serie"]
        if len(serie) >= 3 and serie[-1]["z"] > 1.0 and serie[-2]["z"] > 1.0 and s["delta_3m"] > 0:
            alertas.append({
                "alert_id": f"lead_{gid}", "signal_id": gid, "reference_date": s["ultima_ref"],
                "severity": "atencao" if serie[-1]["z"] < 1.5 else "relevante",
                "threshold": "z > 1,0 por ≥2 meses com Δ3m > 0", "observed_value": s["z_atual"],
                "persistence": sum(1 for x in serie[-6:] if x["z"] > 1.0),
                "explanation": f"{s['nome']} está {s['z_atual']:.1f} desvios acima da média histórica e subindo — pressão acima do padrão histórico do próprio indicador.",
                "fonte": [c for c in s["contribuicoes"]],
            })

    # ---------- síntese determinística ----------
    n_up = sum(1 for s in subindices.values() if s["tendencia"] == "subindo")
    n_down = sum(1 for s in subindices.values() if s["tendencia"] == "caindo")
    inad_last = [v for _d, v in inad if v is not None][-1] if inad else None
    inad_prev3 = [v for _d, v in inad if v is not None][-4] if len(inad) >= 4 else None
    inad_reagiu = inad_last is not None and inad_prev3 is not None and (inad_last - inad_prev3) > 0.1
    if len(subindices) >= COBERTURA_MINIMA_SUBINDICES:
        piores = sorted(subindices.values(), key=lambda s: -s["delta_3m"])[:2]
        sintese = (f"{n_up} de {len(subindices)} famílias de sinais estão em deterioração e {n_down} em melhora. "
                   + (f"As maiores pressões vêm de {piores[0]['nome'].lower()} e {piores[1]['nome'].lower()}. " if len(piores) >= 2 and piores[0]["delta_3m"] > 0 else "")
                   + ("A inadimplência observada também já subiu no período — sinais e materialização caminham juntos."
                      if inad_reagiu else "A inadimplência observada ainda não apresentou deterioração equivalente."))
        confianca = "moderada"
    else:
        sintese = "Cobertura insuficiente de subíndices para uma síntese geral nesta data."
        confianca = "baixa"

    # ---------- regional (RJ por tribunal → UF) ----------
    regional = []
    for uf, key in (("SP", "TJSP"), ("RJ", "TJRJ"), ("MG", "TJMG"), ("RS", "TJRS"),
                    ("PR", "TJPR"), ("SC", "TJSC"), ("BA", "TJBA"), ("GO", "TJGO")):
        rows = common.get_series(con, f"recuperacao_judicial_{key.lower()}") or []
        m = _norm_cnj(rows)
        if len(m) < 15:
            continue
        yy = _yoy(m)
        if yy:
            regional.append({"uf": uf, "tribunal": key, "rj_mes": m[-1][1], "rj_yoy_pct": round(yy[-1][1], 1),
                             "tendencia": "subindo" if yy[-1][1] > 10 else ("caindo" if yy[-1][1] < -10 else "estável")})

    common.write_gold("leading.json", {
        "gerado_em": gerado,
        "versao_metodologica": "v1.0 (MVP Fase 1)",
        "principio": ("Nenhum indicador isolado determina a conclusão. Coincidente ≠ antecedente ≠ contexto ≠ associação. "
                      "'Antecedente candidato' aqui NÃO é validação plena — a promoção usa o protocolo da aba Antecedentes."),
        "sintese": {"texto": sintese, "confianca": confianca, "n_deteriorando": n_up, "n_melhorando": n_down,
                    "inad_reagiu": inad_reagiu, "cobertura": f"{len(subindices)}/6 subíndices (Buscas integrado via exportação manual — página Tendências de Busca)"},
        "subindices": subindices,
        "catalogo": catalog,
        "series": series,
        "validacao": validacao,
        "alertas": alertas,
        "regional": {"linhas": regional, "nota": "RJ ajuizadas por tribunal estadual (CNJ/DataJud) — cobertura de 8 UFs, declarada; não representa o Brasil inteiro."},
        "iaec": {"disponivel": False, "motivo": "índice composto só após validação individual dos componentes (spec §6); cobertura mínima e pesos serão publicados com a versão metodológica."},
        "buscas": {"disponivel": True,
                   "modo": "exportação manual autorizada — o usuário exportou os dados da interface pública oficial do Google Trends em 29/07/2026 e os depositou no pipeline (data/manual/). A coleta automatizada permanece NÃO licenciada e não é realizada.",
                   "pagina": "trends",
                   "resumo": "21 termos em 5 famílias (29 testados; exclusões documentadas), jan/2011–jun/2026 mensal, com lotes comparáveis por âncora comum. Painel completo na página Tendências de Busca.",
                   "familias": ["Dificuldade financeira", "Procura por crédito", "Estresse empresarial", "Emprego e renda", "Financiamentos"]},
        "licencas": [
            {"fonte": "BCB/SGS, rdrweb", "status": "dados abertos", "uso": "integrado"},
            {"fonte": "CVM FIDC", "status": "dados abertos", "uso": "integrado"},
            {"fonte": "CNJ/DataJud", "status": "API pública documentada", "uso": "integrado (8 tribunais)"},
            {"fonte": "Google Trends", "status": "coleta automatizada segue sem licença; exportação manual da interface oficial é uso pessoal legítimo", "uso": "integrado via carga manual (29/07/2026) — página Tendências de Busca"},
            {"fonte": "Consumidor.gov.br", "status": "download exige autenticação", "uso": "NÃO integrado"},
            {"fonte": "PGFN dívida ativa", "status": "dados abertos (1,3 GB/trimestre)", "uso": "fase 2"},
            {"fonte": "FIPE veículos", "status": "consulta pública sem API aberta", "uso": "NÃO integrado"},
        ],
    })
    return {"ok": True, "subindices": len(subindices), "sinais": len(catalog), "alertas": len(alertas)}
