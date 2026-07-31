"""Produtos de crédito — agregados por modalidade a partir do IF.data (carteira × instituição).

Fonte: IF.data UI relatórios 123 (PF por modalidade) e 128 (PJ por modalidade), 5 trimestres,
nível conglomerado prudencial/instituição individual, valores em R$.

Honestidade metodológica:
- Tamanho do mercado = SOMA das carteiras reportadas no IF.data (universo IF.data — não
  necessariamente o total SGS do sistema, que inclui outras estruturas de consolidação).
- Crescimento = amostra PAREADA (só instituições presentes nos dois períodos) — evita
  confundir entrada/saída de reportantes com crescimento.
- Inadimplência exibida na matriz é a TOTAL da instituição (não específica do produto) —
  o IF.data público não cruza NPL com modalidade. Sempre rotulada.
- Indisponíveis (nunca estimados): taxa por produto×IF, clientes, operações, ticket,
  perfil por renda/região do produto (exigem SCR.data/txjuros não integrados).
"""
from pipeline import common

MIN_COVERAGE = 50  # produto só entra com pelo menos 50 instituições reportando

# slug -> (metric_key, nome, seg, natureza, definicao, nota)
TAXONOMY = {
    "cartao-de-credito-pf": ("cart_pf_mod:cartao_de_credito", "Cartão de crédito", "pf", "livre",
        "Carteira ativa total de cartão de crédito de pessoas físicas (todas as submodalidades).",
        "O corte integrado do IF.data não separa rotativo, parcelado e compras à vista — o SGS separa apenas no agregado do sistema."),
    "consignado-pf": ("cart_pf_mod:emprestimo_com_consignacao_em_folha", "Crédito consignado", "pf", "livre",
        "Empréstimos com consignação em folha de pagamento a pessoas físicas.", ""),
    "credito-pessoal-pf": ("cart_pf_mod:emprestimo_sem_consignacao_em_folha", "Crédito pessoal não consignado", "pf", "livre",
        "Empréstimos sem consignação em folha a pessoas físicas.", ""),
    "veiculos-pf": ("cart_pf_mod:veiculos", "Financiamento de veículos", "pf", "livre",
        "Financiamentos de veículos a pessoas físicas (garantia do próprio bem).", ""),
    "imobiliario-pf": ("cart_pf_mod:habitacao", "Crédito imobiliário (habitação)", "pf", "direcionado",
        "Financiamentos habitacionais a pessoas físicas (majoritariamente recursos direcionados SFH/SFI).", ""),
    "rural-pf": ("cart_pf_mod:rural_e_agroindustrial", "Crédito rural PF", "pf", "direcionado",
        "Crédito rural e agroindustrial a pessoas físicas.", ""),
    "capital-de-giro-pj": ("cart_pj_mod:capital_de_giro", "Capital de giro", "pj", "livre",
        "Operações de capital de giro para pessoas jurídicas.", ""),
    "conta-garantida-pj": ("cart_pj_mod:cheque_especial_e_conta_garantida", "Cheque especial e conta garantida", "pj", "livre",
        "Limites rotativos de cheque especial e conta garantida para PJ.", ""),
    "recebiveis-pj": ("cart_pj_mod:operacoes_com_recebiveis", "Antecipação de recebíveis", "pj", "livre",
        "Operações com recebíveis (duplicatas, cartões e afins) para PJ.", ""),
    "investimento-pj": ("cart_pj_mod:investimento", "Financiamento de investimentos", "pj", "livre/direcionado",
        "Financiamentos de investimento para PJ (inclui repasses).", ""),
    "comercio-exterior-pj": ("cart_pj_mod:comercio_exterior", "Comércio exterior", "pj", "livre",
        "Financiamentos à exportação/importação (ACC/ACE e afins).", ""),
    "infraestrutura-pj": ("cart_pj_mod:financiamento_de_infraestrutura_desenvolvimento_", "Infraestrutura e desenvolvimento", "pj", "direcionado",
        "Financiamento de infraestrutura, desenvolvimento e projeto.", ""),
    "rural-pj": ("cart_pj_mod:rural_e_agroindustrial", "Crédito rural PJ", "pj", "direcionado",
        "Crédito rural e agroindustrial a pessoas jurídicas.", ""),
}

SEG_TOTALS = {"pf": "cart_pf_mod:total_da_carteira_de_pessoa_fisica",
              "pj": "cart_pj:total_da_carteira_de_pessoa_juridica"}

INDISPONIVEIS = [
    {"metrica": "Inadimplência >90d (Res. 4.966) por produto × instituição",
     "razao": "IF.data público não cruza o NPL >90d com modalidade. O que existe por modalidade é o ATRASO ≥15 dias (rel. 123/128) — exibido na matriz com essa rotulagem."},
    {"metrica": "Clientes, operações e ticket médio por produto", "razao": "relatórios de clientes do IF.data e SCR.data não integrados."},
    {"metrica": "Perfil por renda/ocupação/região", "razao": "exige SCR.data (agregado mensal), não integrado."},
]



# Correspondência produto × modalidade txjuros (VALIDADA contra censo da fonte 2026-07).
# Conceitos distintos: taxa = novas operações da modalidade txjuros; carteira = estoque IF.data.
TAXAS_MAP = {
    "cartao-de-credito-pf": [("PESSOA FÍSICA", "Cartão de crédito - rotativo total - Prefixado"),
                             ("PESSOA FÍSICA", "Cartão de crédito - parcelado - Prefixado")],
    "consignado-pf": [("PESSOA FÍSICA", "Crédito pessoal consignado INSS - Prefixado"),
                      ("PESSOA FÍSICA", "Crédito pessoal consignado privado - Prefixado"),
                      ("PESSOA FÍSICA", "Crédito pessoal consignado público - Prefixado")],
    "credito-pessoal-pf": [("PESSOA FÍSICA", "Crédito pessoal não consignado - Prefixado")],
    "veiculos-pf": [("PESSOA FÍSICA", "Aquisição de veículos - Prefixado")],
    "capital-de-giro-pj": [("PESSOA JURÍDICA", "Capital de giro com prazo até 365 dias - Prefixado"),
                           ("PESSOA JURÍDICA", "Capital de giro com prazo superior a 365 dias - Prefixado"),
                           ("PESSOA JURÍDICA", "Capital de giro com prazo até 365 dias - Pós-fixado referenciado em juros flutuantes"),
                           ("PESSOA JURÍDICA", "Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes")],
    "conta-garantida-pj": [("PESSOA JURÍDICA", "Conta garantida - Prefixado"),
                           ("PESSOA JURÍDICA", "Conta garantida - Pós-fixado referenciado em juros flutuantes"),
                           ("PESSOA JURÍDICA", "Cheque especial - Prefixado")],
    "recebiveis-pj": [("PESSOA JURÍDICA", "Desconto de duplicatas - Prefixado"),
                      ("PESSOA JURÍDICA", "Antecipação de faturas de cartão de crédito - Prefixado"),
                      ("PESSOA JURÍDICA", "Desconto de cheques - Prefixado")],
    "comercio-exterior-pj": [("PESSOA JURÍDICA", "Adiantamento sobre contratos de câmbio (ACC) - Pós-fixado referenciado em moeda estrangeira")],
}
TAXAS_INDISPONIVEL = {
    "imobiliario-pf": "modalidades de crédito direcionado (SFH/SFI) não constam do conjunto txjuros integrado.",
    "rural-pf": "taxas de crédito rural (direcionado) não constam do conjunto txjuros integrado.",
    "rural-pj": "taxas de crédito rural (direcionado) não constam do conjunto txjuros integrado.",
    "investimento-pj": "sem modalidade txjuros correspondente validada (repasses/BNDES fora do conjunto).",
    "infraestrutura-pj": "sem modalidade txjuros correspondente validada.",
}
TAXAS_NOTA = ("Taxa média das NOVAS operações contratadas na janela divulgada (metodologia BCB/txjuros), "
              "por instituição individual (cnpj8) — conceito distinto do estoque da carteira IF.data. "
              "Correspondência produto×modalidade aproximada e explícita; modalidades nunca são misturadas.")


def _quantile(arr, p):
    arr = sorted(arr)
    return arr[min(len(arr) - 1, max(0, round(p * (len(arr) - 1))))]


def _load_taxas(con):
    """{(segmento, modalidade): {inicio: {"fim":…, "rows": [...]}}} — todas as janelas coletadas."""
    try:
        cur = con.execute("SELECT segmento, modalidade, inicio, fim, cnpj8, nome, taxa_am, taxa_aa, posicao FROM taxas_inst")
    except Exception:
        return {}
    out = {}
    for seg, mod, ini, fim, cnpj8, nome, am, aa, pos in cur.fetchall():
        out.setdefault((seg, mod), {}).setdefault(ini, {"fim": fim, "rows": []})["rows"].append(
            {"cnpj8": cnpj8, "nome": nome, "taxa_am": am, "taxa_aa": aa, "posicao": pos})
    return out


def _taxas_for(slug, taxas_db, congl_of):
    if slug in TAXAS_INDISPONIVEL:
        return {"disponivel": False, "razao": TAXAS_INDISPONIVEL[slug]}
    itens = []
    for seg, mod in TAXAS_MAP.get(slug, []):
        janelas = taxas_db.get((seg, mod))
        if not janelas:
            continue
        latest = max(janelas)
        t = janelas[latest]
        rows = sorted(t["rows"], key=lambda r: (r["posicao"] is None, r["posicao"]))
        aas = [r["taxa_aa"] for r in rows if r["taxa_aa"] is not None]
        if not aas:
            continue
        # série histórica agregada: mediana e quartis do universo por janela (nunca por IF isolada aqui).
        # As janelas da fonte são móveis (início diário); rarefeito para ~semanal (≥6 dias entre pontos).
        serie = []
        import datetime as _dt
        last_kept = None
        ordered = sorted(janelas)
        for idx_j, ini in enumerate(ordered):
            vs = [r["taxa_aa"] for r in janelas[ini]["rows"] if r["taxa_aa"] is not None]
            if len(vs) < 5:
                continue
            d = _dt.date.fromisoformat(ini)
            if last_kept is not None and (d - last_kept).days < 6 and idx_j != len(ordered) - 1:
                continue
            last_kept = d
            serie.append({"inicio": ini, "mediana_aa": round(_quantile(vs, 0.5), 2),
                          "p25_aa": round(_quantile(vs, 0.25), 2), "p75_aa": round(_quantile(vs, 0.75), 2),
                          "n": len(vs)})
        itens.append({
            "segmento": seg, "modalidade": mod, "inicio": latest, "fim": t["fim"],
            "n_inst": len(rows),
            "mediana_aa": round(_quantile(aas, 0.5), 2), "p25_aa": round(_quantile(aas, 0.25), 2),
            "p75_aa": round(_quantile(aas, 0.75), 2),
            "min_aa": round(min(aas), 2), "max_aa": round(max(aas), 2),
            "moeda_estrangeira": "moeda estrangeira" in mod.lower(),
            "serie": serie,
            "ranking": [{**r, "cod_congl": congl_of.get(r["cnpj8"])} for r in rows],
        })
    if not itens:
        return {"disponivel": False, "razao": "sem janela recente coletada para as modalidades mapeadas."}
    return {"disponivel": True, "fonte": "BCB txjuros (Olinda v2)", "nota": TAXAS_NOTA, "itens": itens}

def _pivot(con, metric_keys):
    """{metric_key: {anomes: {cod: valor}}}"""
    qmarks = ",".join("?" for _ in metric_keys)
    cur = con.execute(f"SELECT metric, anomes, cod_inst, value FROM institution_metrics WHERE metric IN ({qmarks})",
                      list(metric_keys))
    out = {k: {} for k in metric_keys}
    for metric, anomes, cod, value in cur.fetchall():
        out[metric].setdefault(str(anomes), {})[cod] = value
    return out


def _matched_growth(cur_map, prev_map):
    """Crescimento % da soma sobre amostra pareada; None se não comparável."""
    if not cur_map or not prev_map:
        return None, 0
    common_cods = set(cur_map) & set(prev_map)
    if len(common_cods) < 10:
        return None, len(common_cods)
    a = sum(prev_map[c] for c in common_cods)
    b = sum(cur_map[c] for c in common_cods)
    if not a:
        return None, len(common_cods)
    return (b / a - 1) * 100.0, len(common_cods)


def venc_key(metric_key):
    """cart_pf_mod:veiculos → cart_pf_mod_venc15:veiculos (subcoluna 'Vencido a Partir de 15 Dias')."""
    pref, cat = metric_key.split(":", 1)
    return f"{pref}_venc15:{cat}"


def build(con, cfg):
    keys = {v[0] for v in TAXONOMY.values()} | set(SEG_TOTALS.values())
    keys |= {venc_key(v[0]) for v in TAXONOMY.values()}
    # métricas institucionais para a matriz (última data)
    inst_keys = {"qual:inadimplencia_brl", "qual:carteira_total_geral_brl", "indice_basileia",
                 "carteira_credito", "ativo_total"}
    piv = _pivot(con, keys | inst_keys)
    anomes_list = sorted({a for m in piv.values() for a in m})
    if not anomes_list:
        common.write_gold("products.json", {"ok": False, "error": "sem dados de carteiras"})
        return {"ok": False}
    latest = anomes_list[-1]
    prev_tri = anomes_list[-2] if len(anomes_list) >= 2 else None
    prev_ano = anomes_list[-5] if len(anomes_list) >= 5 else None
    cur = con.execute("SELECT cod_inst, name, sr FROM institutions")
    names = {r[0]: {"nome": r[1], "sr": r[2]} for r in cur.fetchall()}
    try:
        cur = con.execute("SELECT cod_inst, cod_congl_prud FROM institutions WHERE cod_congl_prud IS NOT NULL")
        congl_of = {r[0]: r[1] for r in cur.fetchall()}
    except Exception:
        congl_of = {}
    taxas_db = _load_taxas(con)

    npl_num = piv["qual:inadimplencia_brl"].get(latest, {})
    npl_den = piv["qual:carteira_total_geral_brl"].get(latest, {})
    basileia = piv["indice_basileia"].get(latest, {})
    cart_total_inst = piv["carteira_credito"].get(latest, {})

    products = []
    for slug, (key, nome, seg, natureza, definicao, nota) in TAXONOMY.items():
        by_anomes = piv.get(key, {})
        cur_map = by_anomes.get(latest, {})
        if len(cur_map) < MIN_COVERAGE:
            continue  # correspondência/cobertura insuficiente — produto não exibido
        total = sum(cur_map.values())
        venc_by_anomes = piv.get(venc_key(key), {})
        venc_map = venc_by_anomes.get(latest, {})
        # atraso ≥15d: só instituições com carteira E vencido reportados no MESMO período
        atraso_serie = []
        for a in anomes_list:
            cm, vm = by_anomes.get(a, {}), venc_by_anomes.get(a, {})
            pares = [(cm[c], vm[c]) for c in cm if c in vm and cm[c] > 0]
            if len(pares) >= 10:
                atraso_serie.append({"anomes": a,
                                     "agg_pct": round(sum(v for _, v in pares) / sum(t for t, _ in pares) * 100, 2),
                                     "n": len(pares)})
        atraso_pcts = sorted(vm2 / cm2 * 100 for cm2, vm2 in
                             [(cur_map[c], venc_map[c]) for c in cur_map if c in venc_map and cur_map[c] > 0])
        atraso_agg = atraso_serie[-1] if atraso_serie and atraso_serie[-1]["anomes"] == latest else None
        serie = [{"anomes": a, "total_brl": sum(by_anomes[a].values()), "n_inst": len(by_anomes[a])}
                 for a in anomes_list if by_anomes.get(a)]
        g4, n4 = _matched_growth(cur_map, by_anomes.get(prev_ano, {})) if prev_ano else (None, 0)
        g1, n1 = _matched_growth(cur_map, by_anomes.get(prev_tri, {})) if prev_tri else (None, 0)
        seg_total_map = piv[SEG_TOTALS[seg]].get(latest, {})
        seg_total = sum(seg_total_map.values()) if seg_total_map else None
        share_seg = total / seg_total * 100 if seg_total else None

        # concentração sobre o universo IF.data do produto
        shares = sorted((v / total for v in cur_map.values()), reverse=True)
        hhi = round(sum((s * 100) ** 2 for s in shares))
        conc = {"top1_pct": round(shares[0] * 100, 1),
                "top5_pct": round(sum(shares[:5]) * 100, 1),
                "top10_pct": round(sum(shares[:10]) * 100, 1),
                "hhi": hhi, "n_inst": len(shares),
                "nota": "shares sobre o universo IF.data do produto (todas as instituições reportantes)."}

        # matriz: TODAS as instituições reportantes
        rows = []
        for cod, v in sorted(cur_map.items(), key=lambda x: -x[1]):
            prev4 = by_anomes.get(prev_ano, {}).get(cod) if prev_ano else None
            prev1 = by_anomes.get(prev_tri, {}).get(cod) if prev_tri else None
            npl = (npl_num[cod] / npl_den[cod] * 100) if (cod in npl_num and npl_den.get(cod)) else None
            venc = venc_map.get(cod)
            rows.append({
                "cod": cod, "nome": names.get(cod, {}).get("nome") or cod,
                "sr": names.get(cod, {}).get("sr"),
                "nivel": "conglomerado" if cod.startswith("C") else "individual",
                "carteira_brl": v,
                "atraso15_pct": round(venc / v * 100, 2) if (venc is not None and v > 0) else None,
                "share_pct": round(v / total * 100, 2),
                "d4t_pct": round((v / prev4 - 1) * 100, 1) if prev4 else None,
                "d1t_pct": round((v / prev1 - 1) * 100, 1) if prev1 else None,
                "pct_carteira_inst": round(v / cart_total_inst[cod] * 100, 1) if cart_total_inst.get(cod) else None,
                "npl_inst_pct": round(npl, 2) if npl is not None else None,
                "basileia_pct": round(basileia[cod] * 100, 2) if cod in basileia else None,  # fração → %
            })

        # síntese determinística com regras explícitas
        frases = []
        if g4 is not None:
            frases.append(f"carteira {'cresceu' if g4 >= 0 else 'recuou'} {abs(g4):.1f}% em 4 trimestres (amostra pareada, n={n4})")
        if share_seg is not None:
            frases.append(f"representa {share_seg:.1f}% da carteira {seg.upper()} no universo IF.data")
        if atraso_agg:
            frases.append(f"atraso ≥15d agregado de {atraso_agg['agg_pct']:.1f}% da carteira (n={atraso_agg['n']})")
        frases.append(f"top-5 concentra {conc['top5_pct']:.0f}% (HHI {hhi})")
        sintese = (f"{nome}: " + "; ".join(frases) + ".") if frases else None

        products.append({
            "slug": slug, "nome": nome, "seg": seg, "natureza": natureza,
            "definicao": definicao, "nota_taxonomia": nota,
            "modalidade_original": key.split(":", 1)[1],
            "data_base": latest,
            "mercado_total_brl": total,
            "n_instituicoes": len(cur_map),
            "share_segmento_pct": round(share_seg, 2) if share_seg is not None else None,
            "crescimento_4t_pct": round(g4, 2) if g4 is not None else None,
            "crescimento_4t_n_pareado": n4,
            "crescimento_1t_pct": round(g1, 2) if g1 is not None else None,
            "serie": serie,
            "atraso15": {
                "agg_pct": atraso_agg["agg_pct"] if atraso_agg else None,
                "n": atraso_agg["n"] if atraso_agg else 0,
                "mediana_pct": round(_quantile(atraso_pcts, 0.5), 2) if len(atraso_pcts) >= 10 else None,
                "p25_pct": round(_quantile(atraso_pcts, 0.25), 2) if len(atraso_pcts) >= 10 else None,
                "p75_pct": round(_quantile(atraso_pcts, 0.75), 2) if len(atraso_pcts) >= 10 else None,
                "serie": atraso_serie,
                "fonte": "BCB IF.data — subcoluna 'Vencido a Partir de 15 Dias' dos relatórios 123 (PF) / 128 (PJ), por modalidade × instituição",
                "nota": ("Carteira da modalidade com parcelas vencidas há 15 dias ou mais ÷ carteira total da modalidade. "
                         "Conceito de ATRASO (arrears) — NÃO é a inadimplência >90d (Res. 4.966), que a fonte pública não cruza com modalidade. "
                         "Zero é zero real quando a modalidade é reportada."),
            },
            "concentracao": conc,
            "sintese": sintese,
            "sintese_regras": "crescimento = Δ da soma em amostra pareada 4T; participação = produto ÷ total do segmento (mesmo universo/data); concentração sobre reportantes do produto.",
            "matriz": rows,
            "taxas": _taxas_for(slug, taxas_db, congl_of),
            "indisponiveis": INDISPONIVEIS,
        })

    comum = {
        "gerado_em": common.now_utc(),
        "fonte": "BCB IF.data — carteiras por modalidade (relatórios 123/128), conglomerados prudenciais e instituições individuais",
        "frequencia": "trimestral",
        "anomes_list": anomes_list,
        "data_base": latest,
        "consolidacao_nota": "Valores por conglomerado prudencial (códigos C…) e instituições individuais; a soma do mercado usa o universo IF.data.",
        "npl_nota": ("A matriz traz DOIS conceitos distintos, sempre rotulados: (1) atraso ≥15d NO PRODUTO "
                     "(vencido ≥15d ÷ carteira da modalidade, IF.data rel. 123/128 — específico do produto); "
                     "(2) inadimplência >90d TOTAL da instituição (Res. 4.966 — não específica do produto)."),
    }
    # products.json = RESUMO (leve, para Visão geral e índice); prod/{slug}.json = completo (matriz + taxas)
    resumo = []
    for p in products:
        lider = p["matriz"][0] if p["matriz"] else None
        r = {k: v for k, v in p.items() if k not in ("matriz", "taxas", "indisponiveis")}
        r["lider"] = {"cod": lider["cod"], "nome": lider["nome"], "share_pct": lider["share_pct"]} if lider else None
        r["taxas_disponiveis"] = bool(p.get("taxas", {}).get("disponivel"))
        resumo.append(r)
        common.write_gold(f"prod/{p['slug']}.json", {**comum, "produto": p})
    common.write_gold("products.json", {**comum, "produtos": resumo})
    return {"ok": True, "produtos": len(products)}
