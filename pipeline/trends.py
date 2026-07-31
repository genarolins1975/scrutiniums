"""Tendências de Busca — gold trends.json.

Base: exportação manual autorizada do Google Trends (ver sources/trends_manual.py).
Tudo aqui herda o selo ASSOCIAÇÃO EXPLORATÓRIA: índices relativos de busca (0–100
por consulta), sem volume absoluto, sem causalidade, nenhum sinal validado.

Cálculos próprios (selados como calculado, metodologia declarada):
  - sazonalidade: média do z-score da própria série por mês do calendário
    (mês parcial jul/2026 excluído);
  - defasagens: correlação de Pearson sinal_t vs inadimplência_{t+k} (BCB/SGS 21082),
    k=0..12 meses, n mínimo 24 — reutiliza leading._lag_corr; classifica no máximo
    como associação exploratória (promoção exige o protocolo da aba Antecedentes).
"""
import json
import statistics

from pipeline import common
from pipeline.leading import _lag_corr

SELO = ("ASSOCIAÇÃO EXPLORATÓRIA — índices relativos de busca (0–100 por consulta); "
        "não representam volume absoluto, não implicam causalidade e nenhum sinal é tratado como validado.")
DISCLAIMER = ("O índice do Google Trends mede o interesse RELATIVO de busca (0–100 dentro de cada consulta), "
              "não a quantidade absoluta de pessoas ou pesquisas, e não mede inadimplência efetiva.")


def _meta(con):
    return {k: json.loads(v) for k, v in con.execute("SELECT k, v FROM trends_meta")}


def build(con, cfg):
    meta = _meta(con)
    if not meta:
        common.write_gold("trends.json", {
            "disponivel": False,
            "motivo": ("Nenhuma exportação manual do Google Trends foi depositada em data/manual/. "
                       "A coleta automatizada permanece não licenciada."),
        })
        return {"ok": False, "error": "sem dados manuais"}
    parcial = meta.get("mes_parcial")

    # ---------- catálogo ----------
    catalogo = [dict(zip(["termo", "familia", "tipo", "status_coleta", "volume", "ambiguidade",
                          "periodo", "pct_zeros", "menor_que_1", "mes_parcial", "ancora", "obs"], r))
                for r in con.execute("SELECT * FROM trends_catalogo")]
    usados = [c["termo"] for c in catalogo if (c["status_coleta"] or "").startswith("Coletado")]

    # ---------- séries individuais ----------
    series, zseries = {}, {}
    for termo, usado in con.execute("SELECT DISTINCT termo, usado FROM trends_series"):
        rows = con.execute("SELECT anomes, valor FROM trends_series WHERE termo=? ORDER BY anomes",
                           (termo,)).fetchall()
        series[termo] = {"usado": bool(usado),
                         "obs": [{"p": d, "v": round(v)} for d, v in rows]}
        completos = [(d, v) for d, v in rows if d != parcial]
        xs = [v for _d, v in completos]
        if len(xs) >= 36:
            m, sd = statistics.fmean(xs), statistics.pstdev(xs)
            if sd > 0:
                zseries[termo] = [(d, (v - m) / sd) for d, v in completos]

    # ---------- painel + famílias ----------
    cat_by_termo = {c["termo"]: c for c in catalogo}
    painel = []
    for r in con.execute("SELECT * FROM trends_painel"):
        p = dict(zip(["termo", "familia", "valor_atual", "var1m", "var3m", "var12m", "media12m",
                      "z", "percentil", "direcao", "intensidade", "aceleracao", "qualidade", "status"], r))
        c = cat_by_termo.get(p["termo"], {})
        p["ambiguidade"] = c.get("ambiguidade")
        p["pct_zeros"] = c.get("pct_zeros")
        p["obs_qualidade"] = c.get("obs")
        painel.append(p)
    painel.sort(key=lambda p: -(p["var12m"] or 0))

    familias = []
    for r in con.execute("SELECT * FROM trends_familias"):
        f = dict(zip(["familia", "termos", "aquecendo", "arrefecendo", "var12m_mediana",
                      "var3m_mediana", "temperatura", "leitura"], r))
        f["detalhe"] = [p for p in painel if p["familia"] == f["familia"] or
                        (f["familia"] == "Pressão das famílias" and p["familia"] == "Dificuldade financeira") or
                        (f["familia"] == "Demanda por crédito" and p["familia"] == "Procura por crédito")]
        familias.append(f)

    # ---------- lotes comparáveis ----------
    lotes = {}
    for lote, termo, anomes, valor, familia, ancora in con.execute(
            "SELECT lote, termo, anomes, valor, familia, ancora FROM trends_lotes ORDER BY lote, termo, anomes"):
        L = lotes.setdefault(lote, {"termos": {}, "ancora": None})
        t = L["termos"].setdefault(termo, {"obs": [], "ancora": bool(ancora)})
        t["obs"].append({"p": anomes, "v": round(valor)})
        if ancora:
            L["ancora"] = termo

    # ---------- sazonalidade (calculado) ----------
    sazonalidade = {}
    for termo in usados:
        zz = zseries.get(termo)
        if not zz:
            continue
        by_month = {}
        for d, z in zz:
            by_month.setdefault(int(d[5:7]), []).append(z)
        sazonalidade[termo] = [round(statistics.fmean(by_month[m]), 2) if by_month.get(m) else None
                               for m in range(1, 13)]

    # ---------- defasagens vs inadimplência (calculado, exploratório) ----------
    inad = [(d[:7].replace("-", ""), v) for d, v in common.get_series(con, "inad_total")]
    defasagens = []
    for termo in usados:
        zz = zseries.get(termo)
        if not zz:
            continue
        sig = [(d.replace("-", ""), z) for d, z in zz]
        prof = _lag_corr(sig, inad, 12)
        validos = [p for p in prof if p["corr"] is not None]
        if not validos:
            continue
        best = max(validos, key=lambda p: abs(p["corr"]))
        defasagens.append({"termo": termo, "familia": cat_by_termo.get(termo, {}).get("familia"),
                           "melhor_lag": best["lag"], "corr": best["corr"], "n": best["n"],
                           "perfil": prof,
                           "classificacao_conceitual": "associação exploratória"})
    defasagens.sort(key=lambda d: -abs(d["corr"] or 0))

    common.write_gold("trends.json", {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "selo": SELO,
        "disclaimer": DISCLAIMER,
        "meta": {k: meta.get(k) for k in ["fonte", "modo", "coleta", "config", "ultimo_mes_completo",
                                          "mes_parcial", "diagnostico", "limitacoes", "notas_painel",
                                          "registro_lotes", "sha256_arquivo"]},
        "licenca": ("Exportação manual da interface pública oficial fornecida pelo usuário (uso pessoal legítimo). "
                    "A coleta automatizada de termos arbitrários permanece NÃO licenciada e NÃO é realizada."),
        "familias": familias,
        "painel": painel,
        "series": series,
        "lotes": lotes,
        "sazonalidade": sazonalidade,
        "defasagens": {"alvo": "Inadimplência >90d total (BCB/SGS 21082), coincidente",
                       "metodo": ("Correlação de Pearson entre o z-score mensal do termo e a inadimplência k meses "
                                  "à frente (k=0..12; n mínimo 24; mês parcial excluído). Associação ≠ causalidade; "
                                  "nenhum termo é promovido a antecedente sem o protocolo formal da aba Antecedentes."),
                       "linhas": defasagens},
        "catalogo": catalogo,
    })
    return {"ok": True, "termos_usados": len(usados), "series": len(series),
            "lotes": len(lotes), "defasagens": len(defasagens)}
