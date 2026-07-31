"""Mercado & Valor — gold market.json (piloto: Itaú, BTG, ABC Brasil).

Cálculos e metodologia (tudo declarado no payload):
- Retorno TOTAL: reinvestimento do provento no 1º pregão pós-ex — fator
  (close_i + prov_ex_i) / close_{i-1}, provento bruto de IR (JCP tributável).
- BPAC11 (unit = 1 ON + 2 PNA): provento por unit derivado aritmeticamente da
  composição quando a fonte não publica a classe UNT (identidade contábil, não estimativa).
- Valor de mercado: Itaú = ON×preço_ON + PN×preço_PN; BTG = total_ações × (preço_unit ÷ 3)
  (aproximação declarada: ON ≈ PNA); ABC = total_ações × preço_PN (ON não negociada).
- P/L e P/VP por AGREGADOS (mcap ÷ lucro dos controladores; mcap ÷ PL) — evita mistura de classes.
- ROE da companhia = lucro controladores (último exercício) ÷ PL médio (fim ex. anterior/atual)
  — distinto do ROE IF.data do conglomerado (rotulado).
- Payout = Σ(valor por ação × ações da classe, data ex no exercício) ÷ lucro controladores.
- Ausência ≠ zero; nada aqui constitui recomendação de investimento.
"""
import math
from datetime import date, timedelta

from pipeline import common
from pipeline.sources.b3_market import COMPANIES

MAIN_TICKER = {c["company_id"]: c["main_ticker"] for c in COMPANIES}
BY_CID = {c["company_id"]: c for c in COMPANIES}
AVISO = ("Plataforma acadêmica e analítica. Nada nesta área constitui recomendação de compra ou "
         "venda de valores mobiliários, rating ou aconselhamento de investimento.")


def _series(con, ticker):
    cur = con.execute("SELECT date, close, volume FROM market_prices WHERE ticker=? ORDER BY date", (ticker,))
    return cur.fetchall()


def _divs(con, company_id):
    cur = con.execute("SELECT type_stock, last_cum, value, kind, approved FROM market_dividends WHERE company_id=? ORDER BY last_cum", (company_id,))
    return cur.fetchall()


def _per_share_events(divs, company_id):
    """Proventos por ação do ticker principal (div_mode da empresa): classe única
    ou unit derivada da composição (identidade contábil; classe UNT precede)."""
    mode = BY_CID[company_id]["div_mode"]
    ev = {}
    if "class" in mode:
        alvo = mode["class"]
        for ts, cum, val, kind, approved in divs:
            if ts != alvo:
                continue
            ev.setdefault(cum, {"DIV": 0.0, "JCP": 0.0})
            ev[cum][kind] += val
        return ev
    comp = mode["unit"]  # ex.: {"ON": 1, "PNA": 2}
    by_cum = {}
    for ts, cum, val, kind, approved in divs:
        by_cum.setdefault(cum, {}).setdefault(ts, {}).setdefault(kind, 0.0)
        by_cum[cum][ts][kind] += val
    for cum, classes in by_cum.items():
        if "UNT" in classes:
            ev[cum] = {k: classes["UNT"].get(k, 0.0) for k in ("DIV", "JCP")}
        else:
            ev[cum] = {k: sum(mult * classes.get(cl, {}).get(k, 0.0) for cl, mult in comp.items())
                       for k in ("DIV", "JCP")}
    return ev


def _compute(dates, closes, events):
    """base100, retorno total base100, drawdown (sobre total), vol 21d anualizada."""
    n = len(dates)
    base = [100.0] * n
    tr = [100.0] * n
    for i in range(1, n):
        base[i] = base[i - 1] * closes[i] / closes[i - 1]
        prov = sum((events.get(dates[i - 1]) or {}).values())
        tr[i] = tr[i - 1] * (closes[i] + prov) / closes[i - 1]
    dd = []
    peak = -1e18
    for v in tr:
        peak = max(peak, v)
        dd.append((v / peak - 1) * 100)
    rets = [math.log(tr[i] / tr[i - 1]) for i in range(1, n)]
    vol = [None] * n
    for i in range(21, n):
        w = rets[i - 21:i]
        m = sum(w) / len(w)
        vol[i] = math.sqrt(sum((x - m) ** 2 for x in w) / (len(w) - 1)) * math.sqrt(252) * 100
    return base, tr, dd, vol


def _window_ret(dates, serie, days):
    if not dates:
        return None
    target = (date.fromisoformat(dates[-1]) - timedelta(days=days)).isoformat()
    i0 = 0
    for i, d in enumerate(dates):
        if d >= target:
            i0 = i
            break
    if i0 >= len(serie) - 1:
        return None
    return (serie[-1] / serie[i0] - 1) * 100


def build(con, cfg):
    payload_emp, series_out, janelas, eventos_out = [], {}, {}, {}
    valuation = []
    tr_map = {}

    for c in COMPANIES:
        cid = c["company_id"]
        tk = MAIN_TICKER[cid]
        rows = _series(con, tk)
        if not rows:
            continue
        dates = [r[0] for r in rows]
        closes = [r[1] for r in rows]
        divs = _divs(con, cid)
        events = _per_share_events(divs, cid)
        base, tr, dd, vol = _compute(dates, closes, events)
        tr_map[tk] = (dates, tr)
        series_out[tk] = {"dates": dates, "close": [round(x, 2) for x in closes],
                          "base100": [round(x, 2) for x in base],
                          "total100": [round(x, 2) for x in tr],
                          "drawdown": [round(x, 2) for x in dd],
                          "vol21": [round(x, 1) if x is not None else None for x in vol]}
        ytd0 = next((i for i, d in enumerate(dates) if d >= f"{dates[-1][:4]}-01-01"), 0)
        janelas[tk] = {
            "preco": {"m1": _window_ret(dates, base, 30), "m3": _window_ret(dates, base, 91),
                      "m6": _window_ret(dates, base, 182), "a12": _window_ret(dates, base, 365),
                      "a36": _window_ret(dates, base, 1095),
                      "ytd": (base[-1] / base[ytd0] - 1) * 100 if ytd0 < len(base) - 1 else None,
                      "desde_inicio": base[-1] - 100},
            "total": {"m1": _window_ret(dates, tr, 30), "m3": _window_ret(dates, tr, 91),
                      "m6": _window_ret(dates, tr, 182), "a12": _window_ret(dates, tr, 365),
                      "a36": _window_ret(dates, tr, 1095),
                      "ytd": (tr[-1] / tr[ytd0] - 1) * 100 if ytd0 < len(tr) - 1 else None,
                      "desde_inicio": tr[-1] - 100},
        }
        # drawdown máximo e atual
        mdd_i = min(range(len(dd)), key=lambda i: dd[i])
        janelas[tk]["drawdown"] = {"atual": dd[-1], "maximo": dd[mdd_i], "data_maximo": dates[mdd_i],
                                   "vol21_atual": vol[-1]}
        eventos_out[tk] = sorted([{"ex_ref": cum, "div": round(v.get("DIV", 0), 6), "jcp": round(v.get("JCP", 0), 6)}
                                  for cum, v in events.items() if cum >= dates[0]], key=lambda x: x["ex_ref"])

        # ---- proventos por ano (por ação do ticker principal) ----
        por_ano = {}
        for cum, v in events.items():
            ano = cum[:4]
            por_ano.setdefault(ano, {"DIV": 0.0, "JCP": 0.0})
            por_ano[ano]["DIV"] += v.get("DIV", 0.0)
            por_ano[ano]["JCP"] += v.get("JCP", 0.0)

        # ---- financeiros CVM ----
        cur = con.execute("SELECT period_end, kind, stmt, lucro, lucro_controladores, pl_total FROM market_fin WHERE company_id=? ORDER BY period_end", (cid,))
        fin = [dict(zip(["period_end", "kind", "stmt", "lucro", "lucro_ctrl", "pl"], r)) for r in cur.fetchall()]
        anuais = [f for f in fin if f["kind"] == "anual"]
        ult_anual = anuais[-1] if anuais else None
        pl_recente = fin[-1] if fin else None
        sh = con.execute("SELECT common, preferred, total FROM market_shares WHERE company_id=?", (cid,)).fetchone()
        shares = {"common": sh[0], "preferred": sh[1], "total": sh[2]} if sh else None

        # ---- valor de mercado (metodologia por empresa, declarada) ----
        mcap = nota_mcap = None
        if shares and shares.get("total"):
            udiv = c.get("unit_divisor")
            if cid == "itau":
                on_rows = _series(con, "ITUB3")
                p_on = on_rows[-1][1] if on_rows else closes[-1]
                mcap = shares["common"] * p_on + shares["preferred"] * closes[-1]
                nota_mcap = "ON×preço ITUB3 + PN×preço ITUB4"
            elif udiv:
                mcap = shares["total"] * closes[-1] / udiv
                nota_mcap = f"total de ações × (preço da unit ÷ {udiv}) — composição {c['div_mode'].get('unit')}; assume preços das classes ≈ (aproximação declarada)"
            else:
                mcap = shares["total"] * closes[-1]
                nota_mcap = f"total de ações × preço de {tk} (classes não negociadas avaliadas ao mesmo preço — aproximação declarada)"

        # ---- valuation e capacidade de distribuição ----
        v = {"company_id": cid, "ticker": tk, "preco": closes[-1], "data_preco": dates[-1],
             "mcap": mcap, "nota_mcap": nota_mcap, "shares": shares}
        if ult_anual and shares and mcap:
            lucro = ult_anual["lucro_ctrl"] or ult_anual["lucro"]
            v["lucro_ref"] = lucro
            v["exercicio_ref"] = ult_anual["period_end"][:4]
            v["stmt"] = ult_anual["stmt"]
            v["pl_ratio"] = mcap / lucro if lucro else None
            v["lpa"] = lucro / shares["total"] if lucro else None
            if pl_recente and pl_recente["pl"]:
                v["pvp"] = mcap / pl_recente["pl"]
                v["vpa"] = pl_recente["pl"] / shares["total"]
                v["pl_base"] = pl_recente["period_end"]
            if lucro and len(anuais) >= 2 and anuais[-1]["pl"] and anuais[-2]["pl"]:
                pl_medio = (anuais[-1]["pl"] + anuais[-2]["pl"]) / 2
                v["roe_cia"] = lucro / pl_medio * 100
            # payout do exercício: Σ (valor/ação da classe × ações da classe) com ex no ano
            ex_ano = ult_anual["period_end"][:4]
            dist = 0.0
            for ts, cum, val, kind, approved in divs:
                if not cum.startswith(ex_ano):
                    continue
                if ts == "ON" and shares.get("common"):
                    dist += val * shares["common"]
                elif ts in ("PN", "PNA", "PNB") and shares.get("preferred"):
                    dist += val * shares["preferred"]
            if dist and lucro:
                v["dist_exercicio"] = dist
                v["payout"] = dist / lucro * 100
                v["retencao"] = 100 - v["payout"]
                if v.get("roe_cia") is not None:
                    v["g_sustentavel"] = v["roe_cia"] * v["retencao"] / 100
        # yield 12m por ação
        corte = (date.fromisoformat(dates[-1]) - timedelta(days=365)).isoformat()
        prov12 = sum(sum(vv.values()) for cum, vv in events.items() if cum >= corte)
        v["prov_12m_por_acao"] = round(prov12, 4)
        v["yield_12m"] = prov12 / closes[-1] * 100 if closes[-1] else None
        valuation.append(v)

        payload_emp.append({**{k: c[k] for k in ("company_id", "legal_name", "cnpj", "cvm_code", "tickers",
                                                 "listing_segment", "natureza", "perfil", "main_ticker")},
                            "congl_cod": c.get("congl_hint") if str(c.get("congl_hint", "")).startswith("C0") else None,
                            "shares": shares, "fin": fin, "proventos_por_ano": por_ano})

    # ---- cesta igual-ponderada (referência transparente; IBOV indisponível em fonte oficial gratuita) ----
    cesta = None
    if len(tr_map) == len(COMPANIES):
        all_dates = sorted(set.intersection(*[set(d) for d, _t in tr_map.values()]))
        idx = {tk: {d: v for d, v in zip(ds, tr)} for tk, (ds, tr) in tr_map.items()}
        vals = [100.0]
        for i in range(1, len(all_dates)):
            f = sum(idx[tk][all_dates[i]] / idx[tk][all_dates[i - 1]] for tk in tr_map) / len(tr_map)
            vals.append(vals[-1] * f)
        cesta = {"dates": all_dates, "total100": [round(x, 2) for x in vals],
                 "nota": "média igual-ponderada dos retornos totais diários dos 3 pilotos (rebalanceamento diário) — referência interna; excesso vs. Ibovespa INDISPONÍVEL (série pública oficial descontinuada em 2019)."}

    # ---- fases 4-6 ----
    dre = _dre_lines()
    pontes = {}
    for c in COMPANIES:
        b = _bridge_company(dre.get(c["company_id"], {}))
        if b:
            pontes[c["company_id"]] = b
    congl_lookup = {}
    for c in COMPANIES:
        hint = c.get("congl_hint")
        if not hint:
            congl_lookup[c["company_id"]] = None
            continue
        if str(hint).startswith("C0"):
            congl_lookup[c["company_id"]] = hint
            continue
        # busca por nome em duas passadas: preferindo código que reporta capital (PR);
        # sem PR ainda vincula a entidade (o waterfall de capital simplesmente não sai)
        r = con.execute("""SELECT i.cod_inst FROM institutions i
            WHERE UPPER(REPLACE(i.name,'-',' ')) LIKE ? AND i.cod_inst LIKE 'C%'
            ORDER BY EXISTS (SELECT 1 FROM institution_metrics m
                             WHERE m.cod_inst=i.cod_inst AND m.metric='patrimonio_referencia') DESC
            LIMIT 1""", (f"%{hint}%",)).fetchone()
        congl_lookup[c["company_id"]] = r[0] if r else None
    capital = {}
    val_by_cid = {v["company_id"]: v for v in valuation}
    for cid, congl in congl_lookup.items():
        cw = _capital_observavel(con, congl, val_by_cid.get(cid, {}))
        if cw:
            capital[cid] = cw
    common.write_gold("screener.json", _screener(con))

    common.write_gold("market.json", {
        "gerado_em": common.now_utc(),
        "aviso": AVISO,
        "piloto": False,
        "universo": "bancos e holdings bancárias listados na B3 (18 companhias validadas em 2026-07; BDRs excluídos — demonstrações fora do padrão CVM DFP)",
        "fontes": {
            "precos": "B3 — COTAHIST oficial (fechamento não ajustado, mercado à vista, lote padrão)",
            "proventos": "B3 — proventos em dinheiro por classe (GetListedCashDividends)",
            "acoes": "B3 — ações em circulação (GetListedSupplementCompany)",
            "financeiros": "CVM dados abertos — DFP (exercício auditado) e ITR (PL mais recente), consolidado ou individual conforme entrega da companhia",
        },
        "metodologia": {
            "retorno_total": "reinvestimento do provento (bruto de IR — JCP é tributável) no 1º pregão pós-ex; preço exibido é o nominal",
            "payout": "proventos com data ex no exercício ÷ lucro atribuível aos controladores do mesmo exercício",
            "roe_cia": "lucro dos controladores (exercício) ÷ PL médio (fim do exercício anterior e atual) — companhia listada, NÃO o conglomerado prudencial",
            "g_sustentavel": "g = ROE × retenção — aproximação de crescimento sustentável sob hipóteses fortes (payout e ROE constantes)",
        },
        "empresas": payload_emp,
        "series": series_out,
        "janelas": janelas,
        "eventos": eventos_out,
        "valuation": valuation,
        "cesta": cesta,
        "pontes": pontes,
        "capital": capital,
        "congl_lookup": congl_lookup,
    })
    return {"ok": True, "empresas": len(payload_emp)}

# ================= FASES 4-6: ponte do lucro, capital observável, screener =================
import glob as _glob
import re as _re

def _fmt_cnpj14(c):
    return f"{c[0:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:14]}"

_CNPJ_TO_CID = {_fmt_cnpj14(c["cnpj"]): c["company_id"] for c in COMPANIES}


def _dre_lines():
    """Lê as linhas de DRE dos extratos bronze da CVM (DFP 2024/2025) — sem novo download.
    Retorna {cid: {ano: [(cd, ds, valor)]}} com escala MIL aplicada."""
    out = {}
    for ano in (2024, 2025):
        import os as _os
        paths = [p for p in _glob.glob(f"data/bronze/cvm/*/dfp_{ano}_extrato.*") if not p.endswith(".meta.json")]
        if not paths:
            continue
        raw = open(max(paths, key=_os.path.getmtime), encoding="utf-8").read()
        for ln in raw.splitlines():
            parts = ln.split(";")
            if len(parts) < 6:
                continue
            cnpj, fim, cd, ds, vl, esc = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
            cid = _CNPJ_TO_CID.get(cnpj)
            if not cid or not cd.startswith("3.") or not fim.startswith(str(ano)):
                continue
            try:
                v = float(vl)
            except ValueError:
                continue
            if esc == "MIL":
                v *= 1000.0
            out.setdefault(cid, {}).setdefault(ano, []).append((cd, ds.strip(), v))
    return out


def _concept(lines, patterns, exclude=None):
    """Maior linha (|valor|) cujo DS casa com os padrões — evita pai zerado × filho com valor."""
    best = 0.0
    for cd, ds, v in lines:
        low = ds.lower()
        if exclude and any(e in low for e in exclude):
            continue
        if any(_re.search(p, low) for p in patterns) and abs(v) > abs(best):
            best = v
    return best


def _bridge_company(lines_by_year):
    """Ponte do lucro 2024→2025 por conceitos (match textual; identidade fechada com resíduo)."""
    if 2024 not in lines_by_year or 2025 not in lines_by_year:
        return None
    def conceitos(lines):
        d = {}
        d["lucro"] = _concept(lines, [r"lucro/preju[íi]zo consolidado do per[íi]odo", r"lucro ou preju[íi]zo l[íi]quido do per[íi]odo"])
        d["margem"] = _concept(lines, [r"resultado bruto.*intermedia"])
        d["pdd"] = _concept(lines, [r"provis.*(perda|duvidosa|risco de cr)"])
        d["servicos"] = _concept(lines, [r"presta[çc][ãa]o de servi[çc]os"])
        d["pessoal"] = _concept(lines, [r"despesas? (de |com )?pessoal"])
        d["admin"] = _concept(lines, [r"administrativas"])
        d["tributarias"] = _concept(lines, [r"tribut[áa]rias"])
        d["impostos"] = _concept(lines, [r"imposto de renda e contribui"])
        d["participacoes"] = _concept(lines, [r"participa[çc][õo]es nos lucros"])
        return d
    a, b = conceitos(lines_by_year[2024]), conceitos(lines_by_year[2025])
    if not a["lucro"] or not b["lucro"]:
        return None
    # margem no plano IF é líquida de PDD quando a PDD está em 3.02; ex-PDD = margem − pdd (pdd é negativa)
    passos = [
        ("Margem financeira (ex-provisões)", (b["margem"] - b["pdd"]) - (a["margem"] - a["pdd"]),
         "resultado bruto de intermediação antes da despesa de provisão"),
        ("Provisões p/ perdas (PDD)", b["pdd"] - a["pdd"], "despesa de provisão — variação negativa reduz o lucro"),
        ("Receitas de serviços", b["servicos"] - a["servicos"], "prestação de serviços e tarifas"),
        ("Pessoal", b["pessoal"] - a["pessoal"], "despesas de pessoal"),
        ("Administrativas", b["admin"] - a["admin"], "outras despesas administrativas"),
        ("Tributárias", b["tributarias"] - a["tributarias"], "despesas tributárias"),
        ("IR/CSLL", b["impostos"] - a["impostos"], "imposto de renda e contribuição social"),
        ("Participações", b["participacoes"] - a["participacoes"], "participações nos lucros e estatutárias"),
    ]
    soma = sum(v for _l, v, _e in passos)
    residuo = (b["lucro"] - a["lucro"]) - soma
    passos.append(("Outros (não decompostos)", residuo, "componentes sem linha identificável no plano da companhia (tesouraria, outras operacionais, extraordinários)"))
    fecha = abs(residuo) <= max(abs(b["lucro"] - a["lucro"]) * 0.35, 0.02 * abs(b["lucro"]))
    frase = None
    if fecha:
        efeitos = sorted([p for p in passos[:-1] if abs(p[1]) > 0], key=lambda x: -abs(x[1]))
        pos = next((p for p in efeitos if p[1] > 0), None)
        neg = next((p for p in efeitos if p[1] < 0), None)
        if pos and neg:
            frase = (f"{pos[0]} foi o principal fator positivo (+R$ {pos[1]/1e9:.1f} bi), "
                     f"parcialmente compensado por {neg[0].lower()} (R$ {neg[1]/1e9:.1f} bi).")
        elif pos:
            frase = f"{pos[0]} foi o principal fator (+R$ {pos[1]/1e9:.1f} bi)."
    comp = {k: {"2024": a[k], "2025": b[k]} for k in a}
    return {"lucro_ini": a["lucro"], "lucro_fim": b["lucro"], "passos": [
        {"label": l, "v": v, "expl": e} for l, v, e in passos],
        "residuo": residuo, "decomposicao_fecha": fecha, "frase": frase, "conceitos": comp,
        "nota": "componentes por correspondência textual das contas (planos variam entre companhias); 'Outros' fecha a identidade contábil — quando grande demais, a leitura automática é suprimida."}


def _capital_observavel(con, congl_cod, valuation_row):
    """Movimentos observáveis do capital do CONGLOMERADO entre 1º e último trimestre disponíveis."""
    if not congl_cod:
        return None
    cur = con.execute("""SELECT anomes, metric, value FROM institution_metrics
        WHERE cod_inst=? AND metric IN ('patrimonio_referencia','rwa','indice_basileia','lucro_liquido')""", (congl_cod,))
    m = {}
    for anomes, met, v in cur.fetchall():
        m.setdefault(str(anomes), {})[met] = v
    anomes = sorted(m)
    if len(anomes) < 2:
        return None
    a0, a1 = anomes[0], anomes[-1]
    pr0, pr1 = m[a0].get("patrimonio_referencia"), m[a1].get("patrimonio_referencia")
    if not pr0 or not pr1:
        return None
    # lucro no intervalo: lucro_liquido é acumulado no ano — soma dos fechamentos de ano + parcial corrente
    lucro = 0.0
    ultimo_por_ano = {}
    for a in anomes[1:]:
        ultimo_por_ano[a[:4]] = m[a].get("lucro_liquido") or 0.0
    lucro = sum(ultimo_por_ano.values())
    return {"congl": congl_cod, "de": a0, "ate": a1,
            "pr_inicial": pr0, "pr_final": pr1,
            "lucro_acumulado_periodo": lucro,
            "proventos_periodo": valuation_row.get("dist_exercicio"),
            "outros": pr1 - pr0 - lucro + (valuation_row.get("dist_exercicio") or 0.0),
            "rwa_inicial": m[a0].get("rwa"), "rwa_final": m[a1].get("rwa"),
            "basileia_inicial": (m[a0].get("indice_basileia") or 0) * 100,
            "basileia_final": (m[a1].get("indice_basileia") or 0) * 100,
            "nota": ("PR e RWA são do CONGLOMERADO PRUDENCIAL (IF.data); lucro = fechamentos anuais + parcial corrente do IF.data; "
                     "proventos = distribuição da COMPANHIA LISTADA no último exercício (aproximação de correspondência declarada). "
                     "'Outros' = OCI, emissões/recompras, ajustes prudenciais e diferenças de perímetro — não decompostos na fonte pública.")}


def _screener(con):
    """screener.json — fundamentos das reguladas (universo IF.data) + bloco de mercado das listadas."""
    from pipeline.compare import _load_values, _metric_value
    vals = _load_values(con)
    cur = con.execute("SELECT cod_inst, name, sr FROM institutions")
    names = {r[0]: {"nome": r[1], "sr": r[2]} for r in cur.fetchall()}
    anomes_all = sorted({a for v in vals.values() for a in v})
    latest, prev4 = anomes_all[-1], (anomes_all[-5] if len(anomes_all) >= 5 else None)
    rows = []
    for cod, periods in vals.items():
        pv = periods.get(latest)
        if not pv:
            continue
        ativo = _metric_value(pv, "ativo_total")
        if not ativo:
            continue
        cart = _metric_value(pv, "carteira_credito")
        cart_prev = _metric_value(periods.get(prev4, {}), "carteira_credito") if prev4 else None
        rows.append({
            "cod": cod, "nome": (names.get(cod, {}).get("nome") or cod)[:40], "sr": names.get(cod, {}).get("sr"),
            "nivel": "congl" if cod.startswith("C") else "indiv",
            "ativo": ativo, "carteira": cart,
            "roe": _metric_value(pv, "roe_periodo"),
            "basileia": _metric_value(pv, "indice_basileia"),
            "npl": _metric_value(pv, "npl_pct"),
            "cobertura": _metric_value(pv, "cobertura_pct"),
            "cart_ativo": _metric_value(pv, "cart_ativo_pct"),
            "cresc4t": (cart / cart_prev - 1) * 100 if (cart and cart_prev) else None,
        })
    return {"data_base": latest, "n": len(rows), "linhas": rows,
            "aviso": "Ferramenta de pesquisa. Não constitui recomendação de investimento.",
            "nota": "fundamentos IF.data (trimestral); métricas de mercado existem apenas para as listadas do piloto — 'não aplicável' para as demais."}
