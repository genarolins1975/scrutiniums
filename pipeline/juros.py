"""Taxas de juros por modalidade × instituição — gold juros.json.

Fonte primária: BCB txjuros (Olinda, TaxasJurosDiariaPorInicioPeriodo), já
coletada em silver.taxas_inst: taxa média (a.m./a.a.) das operações
CONTRATADAS por cada IF em janelas móveis de ~5 dias úteis, por modalidade
(20 modalidades PF/PJ, ~200 IFs, histórico desde 2023).

Conceitos declarados (nunca misturados):
- taxa txjuros = média ponderada pelo valor das NOVAS operações da IF na
  janela; não inclui tarifas/seguros (não é CET) e cobre modalidades
  prefixadas/pós listadas pelo BC;
- carteira SCR.data = ESTOQUE nacional da modalidade (todas as safras);
- spread aqui = mediana entre IFs menos a meta Selic vigente (aproximação
  declarada; o spread oficial do BC usa custo de captação).

Agregações (o gold nunca publica as ~365 mil linhas cruas):
- por modalidade: ranking completo da última janela consolidada, série
  MENSAL de mediana/p25/p75/min entre IFs, persistência de liderança
  (quantas vezes cada IF fechou entre as 3 mais baratas em 26 semanas);
- por IF: perfil transversal (posição em cada modalidade na última janela);
- carteira associada por modalidade via mapa explícito para o produto SCR.
"""
import statistics
from collections import defaultdict

from pipeline import common

# modalidade txjuros -> produto SCR (carteira) — mapa explícito e auditável
MOD_PRODUTO_SCR = {
    "Cartão de crédito - rotativo total - Prefixado": ("PF", "Cartão — rotativo"),
    "Cartão de crédito - parcelado - Prefixado": ("PF", "Cartão — parcelado/financiado"),
    "Crédito pessoal consignado INSS - Prefixado": ("PF", "Consignado"),
    "Crédito pessoal consignado privado - Prefixado": ("PF", "Consignado"),
    "Crédito pessoal consignado público - Prefixado": ("PF", "Consignado"),
    "Crédito pessoal não consignado - Prefixado": ("PF", "Crédito pessoal"),
    "Aquisição de veículos - Prefixado": ("PF", "Veículos"),
    "Cheque especial - Prefixado": None,  # PF e PJ compartilham o nome; resolvido pelo segmento
    "Capital de giro com prazo até 365 dias - Prefixado": ("PJ", "Capital de giro"),
    "Capital de giro com prazo superior a 365 dias - Prefixado": ("PJ", "Capital de giro"),
    "Capital de giro com prazo até 365 dias - Pós-fixado referenciado em juros flutuantes": ("PJ", "Capital de giro"),
    "Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes": ("PJ", "Capital de giro"),
    "Conta garantida - Prefixado": ("PJ", "Capital de giro"),
    "Conta garantida - Pós-fixado referenciado em juros flutuantes": ("PJ", "Capital de giro"),
    "Desconto de duplicatas - Prefixado": ("PJ", "Recebíveis descontados"),
    "Desconto de cheques - Prefixado": ("PJ", "Recebíveis descontados"),
    "Antecipação de faturas de cartão de crédito - Prefixado": ("PJ", "Recebíveis descontados"),
    "Adiantamento sobre contratos de câmbio (ACC) - Pós-fixado referenciado em moeda estrangeira": ("PJ", "Comércio exterior"),
    "Vendor - Prefixado": ("PJ", "Capital de giro"),
}

TOP_PERSISTENCIA = 3       # "entre as N mais baratas"
JANELAS_PERSISTENCIA = 26  # ~26 janelas ≈ meio ano de contratações


def _pct(vals, p):
    if not vals:
        return None
    vs = sorted(vals)
    k = (len(vs) - 1) * p
    f = int(k)
    c = min(f + 1, len(vs) - 1)
    return round(vs[f] + (vs[c] - vs[f]) * (k - f), 2)


def _stats(vals):
    return {
        "n": len(vals), "min": round(min(vals), 2), "p25": _pct(vals, 0.25),
        "mediana": _pct(vals, 0.5), "p75": _pct(vals, 0.75), "max": round(max(vals), 2),
    }


def build(con):
    # Selic vigente (para o spread declarado como aproximação)
    row = con.execute("SELECT value FROM series_obs WHERE key='selic_meta' ORDER BY ref_date DESC LIMIT 1").fetchone()
    selic = row[0] if row else None

    # carteira SCR por produto (última data-base): saldo + inadimplência arrastada
    scr_ultima = con.execute("SELECT MAX(data) FROM scr_uf_produto").fetchone()[0]
    carteira = {}
    for cli, prod, saldo, inad, v1590 in con.execute(
            "SELECT cliente, produto, SUM(saldo), SUM(inad), SUM(v1590) FROM scr_uf_produto WHERE data=? GROUP BY cliente, produto",
            (scr_ultima,)):
        if saldo:
            carteira[(cli, prod)] = {"saldo": round(saldo), "inad": round(inad / saldo * 100, 2),
                                     "atraso15_90": round(v1590 / saldo * 100, 2)}

    modalidades = con.execute(
        "SELECT DISTINCT segmento, modalidade FROM taxas_inst ORDER BY segmento, modalidade").fetchall()

    gold_mods = []
    perfil_if = defaultdict(lambda: {"nome": None, "modalidades": []})

    for seg, mod in modalidades:
        rows = con.execute(
            "SELECT inicio, cnpj8, nome, taxa_am, taxa_aa FROM taxas_inst WHERE segmento=? AND modalidade=? ORDER BY inicio",
            (seg, mod)).fetchall()
        if not rows:
            continue
        por_janela = defaultdict(dict)  # inicio -> cnpj8 -> (nome, am, aa)
        for ini, cnpj8, nome, am, aa in rows:
            if aa is not None:
                por_janela[ini][cnpj8] = (nome, am, aa)
        janelas = sorted(por_janela)
        # última janela CONSOLIDADA: a mais recente com nº de IFs >= 80% do pico
        pico = max(len(v) for v in por_janela.values())
        ultima = next((j for j in reversed(janelas) if len(por_janela[j]) >= 0.8 * pico), janelas[-1])

        atual = por_janela[ultima]
        taxas_aa = [v[2] for v in atual.values()]
        st = _stats(taxas_aa)
        ranking = sorted(
            ({"cnpj8": c, "nome": v[0], "taxa_am": v[1], "taxa_aa": v[2]} for c, v in atual.items()),
            key=lambda r: r["taxa_aa"])
        for pos, r in enumerate(ranking, 1):
            r["posicao"] = pos
            r["vs_mediana"] = round(r["taxa_aa"] - st["mediana"], 2)

        # série mensal (mediana/p25/p75/min entre IFs; última janela de cada mês)
        por_mes = {}
        for j in janelas:
            por_mes[j[:7]] = j  # sobrescreve até ficar a última janela do mês
        serie = []
        for mes, j in sorted(por_mes.items()):
            vals = [v[2] for v in por_janela[j].values()]
            if len(vals) >= 5:
                s2 = _stats(vals)
                serie.append({"ref": f"{mes}-01", "mediana": s2["mediana"], "p25": s2["p25"],
                              "p75": s2["p75"], "min": s2["min"], "n": s2["n"]})

        # persistência: quem mais fechou entre as TOP_PERSISTENCIA mais baratas
        contagem = defaultdict(lambda: [0, None])
        recentes = janelas[-JANELAS_PERSISTENCIA:]
        for j in recentes:
            top = sorted(por_janela[j].items(), key=lambda kv: kv[1][2])[:TOP_PERSISTENCIA]
            for cnpj8, v in top:
                contagem[cnpj8][0] += 1
                contagem[cnpj8][1] = v[0]
        persistentes = sorted(
            ({"cnpj8": c, "nome": nv[1], "vezes": nv[0], "de": len(recentes)} for c, nv in contagem.items()),
            key=lambda x: -x["vezes"])[:5]

        chave_scr = ("PF", "Cheque especial") if mod.startswith("Cheque especial") and seg == "PESSOA FÍSICA" else \
                    ("PJ", "Cheque especial") if mod.startswith("Cheque especial") else MOD_PRODUTO_SCR.get(mod)
        cart = carteira.get(chave_scr) if chave_scr else None

        mod_id = f"{'pf' if seg == 'PESSOA FÍSICA' else 'pj'}:{mod}"
        gold_mods.append({
            "id": mod_id, "segmento": "PF" if seg == "PESSOA FÍSICA" else "PJ", "modalidade": mod,
            "janela": {"inicio": ultima,
                       "fim": (con.execute("SELECT MAX(fim) FROM taxas_inst WHERE segmento=? AND modalidade=? AND inicio=?",
                                            (seg, mod, ultima)).fetchone() or [None])[0]},
            "stats": st, "spread_selic": round(st["mediana"] - selic, 2) if selic is not None else None,
            "delta_3m": (round(serie[-1]["mediana"] - serie[-4]["mediana"], 2) if len(serie) >= 4 else None),
            "ranking": ranking, "serie_mensal": serie, "persistentes": persistentes,
            "carteira_scr": ({"produto": chave_scr[1], "cliente": chave_scr[0], **cart, "data_base": scr_ultima}
                             if cart else None),
        })

        for r in ranking:
            perfil_if[r["cnpj8"]]["nome"] = r["nome"]
            perfil_if[r["cnpj8"]]["modalidades"].append({
                "id": mod_id, "taxa_aa": r["taxa_aa"], "posicao": r["posicao"],
                "n": st["n"], "mediana": st["mediana"]})

    # perfil por IF: apenas IFs presentes em >= 2 modalidades (foco de comparação)
    perfis = [{"cnpj8": c, "nome": p["nome"], "modalidades": p["modalidades"]}
              for c, p in perfil_if.items() if len(p["modalidades"]) >= 1]
    perfis.sort(key=lambda p: (-len(p["modalidades"]), p["nome"] or ""))

    common.write_gold("juros.json", {
        "gerado_em": common.now_utc(),
        "tipo": "DADO OBSERVADO",
        "fonte": "BCB txjuros (Olinda) — taxas médias das operações contratadas por IF, por modalidade",
        "selic_meta": selic,
        "conceitos": {
            "taxa": "média ponderada pelo valor das operações CONTRATADAS pela IF na janela de ~5 dias úteis divulgada pelo BC; % a.a. (e % a.m.). NÃO é CET: tarifas, seguros e tributos ficam fora.",
            "janela": "última janela consolidada (cobertura ≥ 80% do pico de IFs da modalidade) — janelas muito recentes chegam incompletas e são ignoradas até consolidar.",
            "mediana_vs_media_bc": "a mediana ENTRE IFs dá o mesmo peso a cada instituição; difere da taxa média da modalidade do SGS, ponderada pelo valor contratado (dominada pelos grandes).",
            "spread_selic": "mediana entre IFs menos a meta Selic vigente — APROXIMAÇÃO declarada; o spread oficial do BC usa custo de captação, não a Selic.",
            "carteira": "estoque nacional do PRODUTO correspondente no SCR.data (todas as safras), com inadimplência ARRASTADA. O SCR não separa as modalidades do txjuros: as três variantes do consignado (INSS, público e privado) compartilham a mesma carteira do produto Consignado, e o estoque da modalidade isolada não é observável ali — para o consignado do INSS, a série específica é a do SGS. Conceito distinto das novas operações a que a taxa se refere.",
            "persistencia": f"quantas das últimas {JANELAS_PERSISTENCIA} janelas a IF fechou entre as {TOP_PERSISTENCIA} mais baratas da modalidade.",
        },
        "modalidades": gold_mods,
        "perfis_if": perfis,
    })
    return {"ok": True, "modalidades": len(gold_mods), "ifs": len(perfis)}
