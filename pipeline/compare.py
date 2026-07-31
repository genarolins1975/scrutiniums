"""Camada de pesquisa — catálogo universal de métricas + valores por instituição.

Gera:
    compare.json      — metric_catalog com metadados completos (fonte, campo original,
                        frequência, cobertura, período, consolidação, status, restrições)
                        + estatísticas de universo por métrica/período (mediana, quartis,
                        média, desvio) para normalizações honestas no front.
    cmp/{cod}.json    — valores e histórico (até 5 trimestres) por instituição,
                        carregados sob demanda pelo comparador (2–10 por vez).

Princípios: ausência ≠ zero (métrica sem valor é omitida); derivadas só quando os
insumos existem no MESMO período; nível de consolidação sempre explícito.
"""
import statistics

from pipeline import common

# métricas base: (id, metric_key_silver, nome, categoria, unidade, status, campo_original, descricao, normalizacoes)
BASE_METRICS = [
    ("ativo_total", "ativo_total", "Ativos totais", "escala", "R$", "observado contábil",
     "Ativo Total (Resumo)", "Ativo total do conglomerado prudencial no fim do trimestre.",
     ["abs", "d4t", "base100", "rank", "vs_mediana"]),
    ("patrimonio_liquido", "patrimonio_liquido", "Patrimônio líquido", "escala", "R$", "observado contábil",
     "Patrimônio Líquido (Resumo)", "Patrimônio líquido contábil.",
     ["abs", "d4t", "base100", "rank", "vs_mediana"]),
    ("carteira_credito", "carteira_credito", "Carteira de crédito classificada", "escala", "R$", "observado regulatório",
     "Carteira de Crédito Classificada (Resumo)", "Carteira de crédito classificada total.",
     ["abs", "d4t", "base100", "rank", "vs_mediana", "pct_ativo"]),
    ("carteira_pf", "cart_pf_mod:total_da_carteira_de_pessoa_fisica", "Carteira PF", "carteira", "R$", "observado regulatório",
     "Total da Carteira de Pessoa Física (rel. 123)", "Carteira ativa de pessoas físicas.",
     ["abs", "d4t", "base100", "rank", "vs_mediana", "pct_carteira"]),
    ("carteira_pj", "cart_pj:total_da_carteira_de_pessoa_juridica", "Carteira PJ", "carteira", "R$", "observado regulatório",
     "Total da Carteira de Pessoa Jurídica (rel. 128)", "Carteira ativa de pessoas jurídicas.",
     ["abs", "d4t", "base100", "rank", "vs_mediana", "pct_carteira"]),
    ("captacoes", "captacoes", "Captações", "escala", "R$", "observado contábil",
     "Captações (Resumo)", "Captações totais (funding).",
     ["abs", "d4t", "base100", "rank", "vs_mediana"]),
    ("lucro_liquido", "lucro_liquido", "Lucro líquido (acum. ano IF.data)", "rentabilidade", "R$", "observado contábil",
     "Lucro Líquido (DRE)", "Lucro acumulado no ano-calendário até o trimestre (IF.data). Não anualizado; T1 reinicia a base.",
     ["abs", "rank", "vs_mediana"]),
    ("indice_basileia", "indice_basileia", "Índice de Basileia", "capital", "%", "observado regulatório",
     "Índice de Basileia (Informações de Capital)", "PR ÷ RWA. Requerimento mínimo varia por segmento.",
     ["abs", "d4t", "rank", "vs_mediana", "zscore"]),
    ("indice_capital_principal", "indice_capital_principal", "Capital principal (CET1)", "capital", "%", "observado regulatório",
     "Índice de Capital Principal", "Capital principal ÷ RWA.",
     ["abs", "d4t", "rank", "vs_mediana", "zscore"]),
    ("indice_capital_nivel1", "indice_capital_nivel1", "Capital nível I", "capital", "%", "observado regulatório",
     "Índice de Capital Nível I", "Capital nível I ÷ RWA.",
     ["abs", "d4t", "rank", "vs_mediana", "zscore"]),
    ("patrimonio_referencia", "patrimonio_referencia", "Patrimônio de referência", "capital", "R$", "observado regulatório",
     "Patrimônio de Referência", "PR total para fins prudenciais.",
     ["abs", "d4t", "base100", "rank", "vs_mediana"]),
    ("rwa", "rwa", "Ativos ponderados pelo risco (RWA)", "capital", "R$", "observado regulatório",
     "RWA", "Ativos ponderados pelo risco.",
     ["abs", "d4t", "base100", "rank", "vs_mediana"]),
    ("razao_alavancagem", "razao_alavancagem", "Razão de alavancagem", "capital", "%", "observado regulatório",
     "Razão de Alavancagem", "Nível I ÷ exposição total (quando reportada).",
     ["abs", "d4t", "rank", "vs_mediana", "zscore"]),
    ("provisao_credito", "qual:provisao_credito_brl", "Provisão de crédito (perda esperada)", "qualidade", "R$", "observado contábil",
     "Perda esperada — op. de crédito (Ativo, e2)", "Provisão/perda esperada associada a operações de crédito (valor absoluto).",
     ["abs", "d4t", "rank", "vs_mediana", "pct_carteira"]),
]

# derivadas: id -> (nome, categoria, unidade, formula, insumos, descricao, normalizacoes, status)
DERIVED = {
    "roe_periodo": ("ROE do período", "rentabilidade", "%", "lucro_liquido ÷ patrimonio_liquido × 100",
                    ("lucro_liquido", "patrimonio_liquido"),
                    "Lucro acumulado do ano IF.data sobre PL do trimestre. NÃO anualizado — comparável apenas entre trimestres iguais.",
                    ["abs", "rank", "vs_mediana", "zscore"], "calculado"),
    "npl_pct": ("Inadimplência (>90d)", "qualidade", "%", "carteira inadimplente ÷ carteira total × 100",
                ("qual:inadimplencia_brl", "qual:carteira_total_geral_brl"),
                "Carteira com atraso >90d sobre carteira total de instrumentos (Res. 4.966, estrutura vigente desde 2025-T1). Inadimplência TOTAL da instituição — não específica de produto.",
                ["abs", "d4t", "rank", "vs_mediana", "zscore"], "calculado"),
    "ativos_problematicos_pct": ("Ativos problemáticos", "qualidade", "%", "ativos problemáticos ÷ carteira total × 100",
                                 ("qual:ativos_problematicos_brl", "qual:carteira_total_geral_brl"),
                                 "Conceito Res. 4.966 (inclui reestruturados/estágio 3) sobre carteira total.",
                                 ["abs", "d4t", "rank", "vs_mediana", "zscore"], "calculado"),
    "cobertura_pct": ("Cobertura contábil aprox.", "qualidade", "%", "provisão de crédito ÷ carteira inadimplente × 100",
                      ("qual:provisao_credito_brl", "qual:inadimplencia_brl"),
                      "Provisão total de crédito sobre carteira >90d. Aproximação analítica — a provisão cobre também operações em dia; não é razão regulatória.",
                      ["abs", "d4t", "rank", "vs_mediana"], "calculado"),
    "cart_ativo_pct": ("Carteira ÷ ativos", "estrutura", "%", "carteira_credito ÷ ativo_total × 100",
                       ("carteira_credito", "ativo_total"),
                       "Peso do crédito no balanço — proxy de especialização em crédito.",
                       ["abs", "d4t", "rank", "vs_mediana", "zscore"], "calculado"),
}

FONTE = "BCB IF.data (Olinda + interface, conglomerados prudenciais tipo 2 e instituições individuais)"

# ---- atraso ≥15d por produto: 13 métricas geradas da taxonomia de produtos ----
from pipeline.products import TAXONOMY as _PROD_TAXONOMY, venc_key as _prod_venc_key

PRODUCT_ATRASO = {}  # metric_id -> (nome, cart_key, venc_key, slug)
for _slug, (_pkey, _pnome, _pseg, _nat, _defi, _nota) in _PROD_TAXONOMY.items():
    _mid = "atraso15_" + _slug.replace("-", "_")
    PRODUCT_ATRASO[_mid] = (f"Atraso ≥15d — {_pnome} ({_pseg.upper()})", _pkey, _prod_venc_key(_pkey), _slug)
PROD_ATRASO_NOTA = ("Carteira da modalidade vencida há ≥15 dias ÷ carteira total da modalidade (IF.data rel. 123/128). "
                    "Conceito de ATRASO específico do produto — não é a inadimplência >90d (Res. 4.966). "
                    "Zero é zero real quando a modalidade é reportada; instituição sem o produto não tem valor.")




# ---- "Instituições semelhantes" — regras EXPLÍCITAS (sem algoritmo opaco) ----
SIM_CRITERIOS = ("mesmo nível de consolidação; ativos entre 1/3 e 3× dos ativos da instituição; "
                 "especialização em crédito (carteira÷ativos) dentro de ±15 p.p. quando ambas reportam; "
                 "mix PF (carteira PF ÷ carteira PF+PJ) dentro de ±20 p.p. quando ambas reportam; "
                 "ordenadas pela proximidade de porte (razão de ativos). Máx. 8.")

def _similares(per_inst, names, latest):
    import math
    feats = {}
    for cod, m in per_inst.items():
        at = m.get("ativo_total", {}).get(latest)
        if not at or at <= 0:
            continue
        ct = m.get("carteira_credito", {}).get(latest)
        pf = m.get("carteira_pf", {}).get(latest)
        pj = m.get("carteira_pj", {}).get(latest)
        feats[cod] = {
            "nivel": "C" if cod.startswith("C") else "I",
            "ativo": at,
            "espec": (ct / at * 100) if ct else None,
            "mixpf": (pf / (pf + pj) * 100) if (pf is not None and pj is not None and pf + pj > 0) else None,
        }
    out = {}
    cods = list(feats)
    for cod in cods:
        f = feats[cod]
        cands = []
        for other in cods:
            if other == cod:
                continue
            g = feats[other]
            if g["nivel"] != f["nivel"]:
                continue
            ratio = g["ativo"] / f["ativo"]
            if ratio < 1 / 3 or ratio > 3:
                continue
            if f["espec"] is not None and g["espec"] is not None and abs(f["espec"] - g["espec"]) > 15:
                continue
            if f["mixpf"] is not None and g["mixpf"] is not None and abs(f["mixpf"] - g["mixpf"]) > 20:
                continue
            cands.append((abs(math.log(ratio)), other))
        cands.sort()
        if cands:
            out[cod] = [{"cod": c, "nome": names.get(c, {}).get("nome") or c,
                         "sr": names.get(c, {}).get("sr"), "ativo_brl": feats[c]["ativo"]}
                        for _, c in cands[:8]]
    return out


def _load_values(con):
    """{cod: {anomes: {metric_key: value}}} — só o que existe (ausência ≠ zero)."""
    cur = con.execute("SELECT cod_inst, anomes, metric, value FROM institution_metrics")
    vals = {}
    for cod, anomes, metric, value in cur.fetchall():
        vals.setdefault(cod, {}).setdefault(str(anomes), {})[metric] = value
    return vals


# razões de capital chegam do IF.data como FRAÇÃO (0.1423) — exibimos em % como as derivadas
SCALE_100 = {"indice_basileia", "indice_capital_principal", "indice_capital_nivel1", "razao_alavancagem"}


def _metric_value(period_vals, mid):
    """Valor de uma métrica (base ou derivada) num período; None quando insumo falta."""
    base = {m[0]: m[1] for m in BASE_METRICS}
    if mid in base:
        v = period_vals.get(base[mid])
        if v is not None and mid in SCALE_100:
            return v * 100.0
        return v
    if mid in DERIVED:
        _, _, _, _, inputs, _, _, _ = DERIVED[mid]
        a, b = period_vals.get(inputs[0]), period_vals.get(inputs[1])
        if a is None or b is None or not b:
            return None
        return a / b * 100.0
    if mid in PRODUCT_ATRASO:
        _, cart_key, vk, _slug2 = PRODUCT_ATRASO[mid]
        cart, venc = period_vals.get(cart_key), period_vals.get(vk)
        if cart is None or cart <= 0 or venc is None:
            return None
        return venc / cart * 100.0
    return None


def all_metric_ids():
    return [m[0] for m in BASE_METRICS] + list(DERIVED.keys()) + list(PRODUCT_ATRASO.keys())


def build(con, cfg):
    vals = _load_values(con)
    anomes_list = sorted({a for v in vals.values() for a in v})
    latest = anomes_list[-1] if anomes_list else None
    cur = con.execute("SELECT cod_inst, name, sr, cod_congl_prud FROM institutions")
    names = {r[0]: {"nome": r[1], "sr": r[2], "congl": r[3]} for r in cur.fetchall()}

    # ---- valores por instituição/período para todas as métricas ----
    per_inst = {}
    for cod, periods in vals.items():
        m = {}
        for mid in all_metric_ids():
            serie = {}
            for anomes in anomes_list:
                pv = periods.get(anomes)
                if not pv:
                    continue
                v = _metric_value(pv, mid)
                if v is not None:
                    serie[anomes] = v
            if serie:
                m[mid] = serie
        if m:
            per_inst[cod] = m

    # ---- catálogo com cobertura e estatísticas de universo ----
    catalog = []
    stats = {}
    for mid in all_metric_ids():
        cross = {}  # anomes -> [valores]
        for cod, m in per_inst.items():
            for anomes, v in m.get(mid, {}).items():
                cross.setdefault(anomes, []).append(v)
        if not cross:
            continue
        st = {}
        for anomes, arr in cross.items():
            arr = sorted(arr)
            n = len(arr)
            q = lambda p: arr[min(n - 1, max(0, round(p * (n - 1))))]
            st[anomes] = {"n": n, "mediana": q(0.5), "q1": q(0.25), "q3": q(0.75),
                          "p10": q(0.10), "p90": q(0.90),
                          "media": statistics.fmean(arr),
                          "dp": statistics.pstdev(arr) if n > 1 else None}
        stats[mid] = st
        if mid in PRODUCT_ATRASO:
            nome, cart_key, vk, _slug3 = PRODUCT_ATRASO[mid]
            cat, unit, status = "atraso por produto", "%", "calculado"
            formula = "vencido ≥15d da modalidade ÷ carteira da modalidade × 100"
            campo = f"{vk} ÷ {cart_key} (rel. 123/128)"
            desc = PROD_ATRASO_NOTA
            norms = ["abs", "d4t", "rank", "vs_mediana", "zscore"]
        elif mid in DERIVED:
            nome, cat, unit, formula, inputs, desc, norms, status = DERIVED[mid]
            campo = " + ".join(inputs)
        else:
            b = next(x for x in BASE_METRICS if x[0] == mid)
            nome, cat, unit, status, campo, desc, norms = b[2], b[3], b[4], b[5], b[6], b[7], b[8]
            formula = "valor reportado"
        catalog.append({
            "metric_id": mid, "slug": mid.replace("_", "-"), "name": nome, "category": cat,
            "formula": formula, "unit": unit, "frequency": "trimestral", "source": FONTE,
            "original_field": campo, "consolidation_level": "conglomerado prudencial ou instituição individual (nunca misturar)",
            "aggregation_method": "fim de período", "supported_normalizations": norms,
            "first_reference": anomes_list[0], "last_reference": latest,
            "coverage_count": len(cross.get(latest, [])), "quality_status": status,
            "comparability_notes": desc, "methodology_version": "v1.0", "is_experimental": False,
        })

    common.write_gold("compare.json", {
        "gerado_em": common.now_utc(),
        "anomes_list": anomes_list,
        "fonte": FONTE,
        "consolidacao_nota": ("Códigos iniciados em 'C' são conglomerados prudenciais (IF.data tipo 2); códigos numéricos "
                              "são instituições individuais (CNPJ). O comparador bloqueia a mistura dos dois níveis."),
        "metric_catalog": catalog,
        "stats": stats,
        "universo": {"n_total": len(per_inst),
                     "n_conglomerados": sum(1 for c in per_inst if c.startswith("C")),
                     "n_individuais": sum(1 for c in per_inst if not c.startswith("C"))},
    })

    # ---- semelhantes por regras explícitas ----
    similares = _similares(per_inst, names, latest) if latest else {}

    # ---- arquivos por instituição (sob demanda) ----
    n_files = 0
    for cod, m in per_inst.items():
        info = names.get(cod, {})
        payload = {
            "cod": cod,
            "nome": info.get("nome") or cod,
            "sr": info.get("sr"),
            "nivel": "conglomerado prudencial" if cod.startswith("C") else "instituição individual",
            "anomes_list": anomes_list,
            "fonte": FONTE,
            "metrics": m,
            "gerado_em": common.now_utc(),
        }
        if cod in similares:
            payload["semelhantes"] = {"criterios": SIM_CRITERIOS, "lista": similares[cod]}
        common.write_gold(f"cmp/{cod}.json", payload)
        n_files += 1
    return {"metricas": len(catalog), "instituicoes": n_files}
