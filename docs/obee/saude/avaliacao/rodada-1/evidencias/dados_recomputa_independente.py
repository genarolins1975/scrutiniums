"""Recomputação independente (avaliador de dados): lê o seed bruto e a gold, calcula com código próprio e compara.
Não importa nenhuma função de pipeline/. Uso: python3 -I recomputa.py <repo> <saida_dir>
"""
import csv, gzip, io, json, math, os, sys, collections

REPO, OUT = sys.argv[1], sys.argv[2]
SEED = os.path.join(REPO, "pipeline/eficiencia_saude/seed")
SEED_EDU = os.path.join(REPO, "pipeline/eficiencia/seed")
GOLD = json.load(open(os.path.join(REPO, "public/eficiencia/gold/saude_capitais.json"), encoding="utf-8"))

def jgz(p):
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)

def cgz(p):
    with gzip.open(p, "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

CAP = {c["cod_ibge"]: c for c in GOLD["universo"]["capitais"]}
ANOS = [2021, 2022, 2023, 2024, 2025]
ANOS_R = [2021, 2022, 2023, 2024]

# --- gold indexada por (indicador, ente, ano, componente)
G = {}
for o in GOLD["observacoes"]:
    G[(o["indicador"], o["ente"], o["ano"], o.get("componente"))] = o

# --- população própria
pop = {}
for r in jgz(os.path.join(SEED_EDU, "ibge_populacao/populacao_capitais.json.gz")):
    pop[(r["cod"], r["ano"])] = r["valor"]
for r in jgz(os.path.join(SEED_EDU, "ibge_populacao/relacao_2023_capitais.json.gz")):
    pop[(r["cod"], 2023)] = r["valor"]

# --- IPCA próprio: fator = média anual 2025 / média anual do ano
ser = jgz(os.path.join(SEED_EDU, "ibge_ipca/ipca_numero_indice_2021_2025.json.gz"))[0]["resultados"][0]["series"][0]["serie"]
med = collections.defaultdict(list)
for per, v in ser.items():
    med[int(per[:4])].append(float(v))
med = {a: sum(v) / len(v) for a, v in med.items() if len(v) == 12}
fator = {a: med[2025] / med[a] for a in ANOS}

checks = []  # dicts

def reg(grupo, cap, ano, comp, recalc, gold_v, unid="", obs=""):
    if recalc is None and gold_v is None:
        dif = 0.0; ok = True
    elif recalc is None or gold_v is None:
        dif = None; ok = False
    else:
        dif = float(recalc) - float(gold_v)
        tol = max(0.011, abs(gold_v) * 1e-9) if unid in ("R$", "R$/hab", "%", "100mil", "10mil", "pontos") else 0.0
        # tolerância: reais ao centavo (0,011); razões: 1e-4 relativo; contagens exatas
        if unid in ("R$/hab", "100mil", "10mil", "%cob", "R$real"):
            tol = max(1e-4, abs(gold_v) * 1e-7)
        if unid == "R$real":
            tol = 0.011 + abs(gold_v) * 1e-9
        ok = abs(dif) <= tol
    checks.append(dict(grupo=grupo, capital=CAP[cap]["nome"], uf=CAP[cap]["uf"], regiao=CAP[cap]["regiao"], ano=ano, componente=comp or "",
                       recalculado=recalc, gold=gold_v, diferenca=dif, ok=ok, unidade=unid, obs=obs))

# ============ 1. Despesa liquidada função 10 (DCA I-E), real_2025, por habitante, subfunções
dca_tot = {}
for cod in CAP:
    for ano in ANOS:
        p = os.path.join(SEED, f"siconfi/dca_anexo_i_e/{cod}_{ano}.json.gz")
        linhas = jgz(p)
        liq = [x for x in linhas if x["coluna"] == "Despesas Liquidadas"]
        tot = [x["valor"] for x in liq if x["conta"] == "10 - Saúde"]
        assert len(tot) == 1, (cod, ano, len(tot))
        v = float(tot[0])
        dca_tot[(cod, ano)] = v
        reg("despesa_nominal", cod, ano, "nominal", round(v, 2), G[("sau.despesa.funcao_saude", cod, ano, "nominal")]["valor"], "R$")
        reg("despesa_real_2025", cod, ano, "real_2025", round(v * fator[ano], 2), G[("sau.despesa.funcao_saude", cod, ano, "real_2025")]["valor"], "R$real")
        pp = pop[(cod, ano)]
        reg("despesa_por_habitante", cod, ano, "nominal", v / pp, G[("sau.despesa.por_habitante", cod, ano, "nominal")]["valor"], "R$/hab")
        reg("despesa_por_habitante", cod, ano, "real_2025", v * fator[ano] / pp, G[("sau.despesa.por_habitante", cod, ano, "real_2025")]["valor"], "R$/hab")
        reg("populacao", cod, ano, "", pp, G[("ctx.populacao.residente", cod, ano, None)]["valor"], "hab")
        # subfunções: soma dos componentes 10.xxx e FU10 na própria DCA contra o total; e contra a gold
        subs = {}
        for x in liq:
            c = x["conta"]
            if c.startswith("10.") and c[3:6].isdigit():
                subs[c[3:6]] = float(x["valor"])
            elif c.startswith("FU10"):
                subs["FU10"] = float(x["valor"])
        soma_dca = sum(subs.values())
        soma_gold = sum(G[k]["valor"] for k in [k for k in G if k[0] == "sau.despesa.subfuncao" and k[1] == cod and k[2] == ano])
        reg("soma_subfuncoes_vs_total_dca", cod, ano, "", round(soma_dca, 2), round(v, 2), "R$", "soma das subfunções na DCA (10.xxx e FU10) contra o total 10 - Saúde")
        reg("soma_subfuncoes_gold_vs_total_gold", cod, ano, "", round(soma_gold, 2), G[("sau.despesa.funcao_saude", cod, ano, "nominal")]["valor"], "R$", "soma das subfunções na gold contra a despesa da gold")
        for s, vv in subs.items():
            g = G.get(("sau.despesa.subfuncao", cod, ano, s))
            reg("subfuncao", cod, ano, s, round(vv, 2), g["valor"] if g else None, "R$")

# ============ 2. ASPS (SIOPS RREO Anexo 12): III (6020 col3), XVI (6047 col1), pct (6052 col1)
asps_info = {}
for cod in CAP:
    for ano in ANOS:
        linhas = jgz(os.path.join(SEED, f"siops/rreo_anexo_12/{cod}_{ano}.json.gz"))
        by = collections.defaultdict(list)
        for l in linhas:
            by[l["coItem"]].append(l)
        iii = by["6020"][0]["vl_coluna3"]
        xvi = by["6047"][0]["vl_coluna1"]
        xvi_liq = by["6047"][0]["vl_coluna2"]
        pct = by["6052"][0]["vl_coluna1"]
        rec = xvi / iii * 100
        asps_info[(cod, ano)] = dict(iii=iii, xvi=xvi, xvi_liq=xvi_liq, pct=pct, rec=rec)
        reg("asps_percentual_publicado", cod, ano, "", pct, G[("sau.asps.percentual_aplicado", cod, ano, None)]["valor"], "%")
        reg("asps_percentual_recalculado_XVI_sobre_III", cod, ano, "", round(rec, 2), G[("sau.asps.percentual_aplicado", cod, ano, None)]["valor"], "%",
            "XVI÷III arredondado a duas casas; diferença de até 0,01 ponto indica truncamento na fonte" if abs(round(rec, 2) - pct) > 0 else "")
        reg("asps_valor_aplicado", cod, ano, "nominal", xvi, G[("sau.asps.valor_aplicado", cod, ano, "nominal")]["valor"], "R$")
        reg("asps_base_receita", cod, ano, "nominal", iii, G[("sau.asps.base_receita", cod, ano, "nominal")]["valor"], "R$")

# ============ 3. UBS (CNES): série de dezembro e retrato
hist = jgz(os.path.join(SEED, "cnes/historico_aps_dezembros.json.gz"))
m6 = {str(c)[:6]: c for c in CAP}
cont = collections.defaultdict(lambda: collections.Counter())
vistos = collections.Counter()
for co, h in hist.items():
    for l in h["linhas"]:
        c = m6.get(str(l.get("co_ibge")))
        comp = str(l["nu_comp"])
        if c is None or not comp.endswith("12"):
            continue
        ano = int(comp[:4])
        if ano not in ANOS:
            continue
        vistos[(co, comp)] += 1
        if str(l["tp_unidade"])[:2] not in ("01", "02"):
            continue
        if l["ds_status"].strip().upper() != "ATIVO":
            continue
        k = (c, ano)
        cont[k]["total"] += 1
        if l["no_grupo_nat_jur"].strip().upper() == "PUBLICO":
            cont[k]["publicas"] += 1
        cont[k]["gestao_" + l["tp_gestao"].strip().lower()] += 1
dups = sum(1 for v in vistos.values() if v > 1)
for cod in CAP:
    for ano in ANOS:
        c = cont[(cod, ano)]
        reg("ubs_serie_total_ativas", cod, ano, "total_ativas", c["total"], G[("sau.rede.ubs_publicas", cod, ano, "total_ativas")]["valor"], "n")
        reg("ubs_serie_publicas", cod, ano, "publicas", c["publicas"], G[("sau.rede.ubs_publicas", cod, ano, "publicas")]["valor"], "n")
        reg("ubs_serie_gestao_municipal", cod, ano, "gestao_municipal", c["gestao_municipal"], G[("sau.rede.ubs_publicas", cod, ano, "gestao_municipal")]["valor"], "n")
        reg("ubs_por_10mil", cod, ano, "publicas", c["publicas"] / pop[(cod, ano)] * 10000, G[("sau.rede.ubs_publicas_por_10mil", cod, ano, "publicas")]["valor"], "10mil")

ret = cgz(os.path.join(SEED, "cnes/estabelecimentos_aps_capitais.csv.gz"))
rc = collections.defaultdict(collections.Counter)
for r in ret:
    c = m6.get(r["CO_IBGE"])
    if c is None or r["CO_MOTIVO_DESAB"]:
        continue
    if r["TP_UNIDADE"] not in ("01", "02"):
        continue
    rc[c]["total"] += 1
    if r["CO_NATUREZA_JUR"].startswith("1"):
        rc[c]["publicas"] += 1
        if r["TP_GESTAO"] == "M":
            rc[c]["pub_mun"] += 1
        if r["CO_AMBULATORIAL_SUS"].upper() == "SIM":
            rc[c]["pub_sus"] += 1
    if r["TP_GESTAO"] == "M":
        rc[c]["gestao_mun"] += 1
for cod in CAP:
    reg("ubs_retrato_total_ativas", cod, 2026, "total_ativas", rc[cod]["total"], G[("sau.rede.ubs_retrato", cod, 2026, "total_ativas")]["valor"], "n")
    reg("ubs_retrato_publicas", cod, 2026, "publicas", rc[cod]["publicas"], G[("sau.rede.ubs_retrato", cod, 2026, "publicas")]["valor"], "n")
    reg("ubs_retrato_gestao_municipal", cod, 2026, "gestao_municipal", rc[cod]["gestao_mun"], G[("sau.rede.ubs_retrato", cod, 2026, "gestao_municipal")]["valor"], "n")

# ============ 4. Equipes e cobertura potencial APS (dezembro)
for cod in CAP:
    linhas = jgz(os.path.join(SEED, f"relatorio_aps/cobertura_aps_{cod}.json.gz"))
    dez = {l["nuComp"]: l for l in linhas}
    for ano in ANOS:
        l = dez[f"12/{ano}"]
        reg("aps_esf", cod, ano, "esf", l["qtEsf"], G[("sau.aps.equipes", cod, ano, "esf")]["valor"], "n")
        reg("aps_eap20", cod, ano, "eap20", l["qtEap20"], G[("sau.aps.equipes", cod, ano, "eap20")]["valor"], "n")
        reg("aps_eap30", cod, ano, "eap30", l["qtEap30"], G[("sau.aps.equipes", cod, ano, "eap30")]["valor"], "n")
        reg("aps_esf_por_10mil", cod, ano, "esf", l["qtEsf"] / pop[(cod, ano)] * 10000, G[("sau.aps.equipes_por_10mil", cod, ano, "esf")]["valor"], "10mil")
        reg("aps_eap_por_10mil", cod, ano, "eap", (l["qtEap20"] + l["qtEap30"]) / pop[(cod, ano)] * 10000, G[("sau.aps.equipes_por_10mil", cod, ano, "eap")]["valor"], "10mil")
        cap = l["qtEsf"] * 3500 + l["qtEap20"] * 1750 + l["qtEap30"] * 2625 + l["qtCadastroEquipeEsfrEcrEapp"]
        cob = cap / l["qtPopulacao"] * 100
        go = G[("sau.aps.cobertura_potencial", cod, ano, None)]
        reg("aps_cobertura_potencial_serv", cod, ano, "", l["qtCobertura"], go["valor"], "%cob", "valor do serviço contra a gold (2021 fora da regra vigente)")
        reg("aps_cobertura_potencial_formula_NT2", cod, ano, "", cob, go["valor"], "pontos", f"capacidade pela NT 2/2025 = {cap}; serviço informa {l['qtCapacidadeEquipe']}; fórmula/pop=({cob:.4f})")

# ============ 5. ICSAP
ic = {(int(r["codigo_ibge_6"]), int(r["ano"])): r for r in cgz(os.path.join(SEED, "ripsa/mrb402_icsap_capitais_2021_2024.csv.gz"))}
it = {(int(r["codigo_ibge_6"]), int(r["ano"])): r for r in cgz(os.path.join(SEED, "ripsa/cob201_internacoes_capitais_2021_2024.csv.gz"))}
for cod in CAP:
    for ano in ANOS_R:
        r = ic[(int(str(cod)[:6]), ano)]
        tot = int(r["icsap_total"]); pr = int(r["populacao_denominador"])
        grupos = [int(r[f"grupo_{i}"]) for i in range(1, 20)]
        reg("icsap_numero", cod, ano, "", tot, G[("sau.icsap.internacoes", cod, ano, None)]["valor"], "n")
        reg("icsap_taxa_ripsa", cod, ano, "ripsa", tot / pr * 1e5, G[("sau.icsap.taxa", cod, ano, "ripsa")]["valor"], "100mil")
        reg("icsap_taxa_pop_ibge", cod, ano, "populacao_ibge_obee", tot / pop[(cod, ano)] * 1e5, G[("sau.icsap.taxa", cod, ano, "populacao_ibge_obee")]["valor"], "100mil")
        reg("icsap_soma_grupos_vs_total", cod, ano, "", sum(grupos), tot, "n", "soma dos 19 grupos do seed contra o total do seed")
        gsum = sum(G[("sau.icsap.grupos", cod, ano, f"g{i:02d}")]["valor"] for i in range(1, 20))
        reg("icsap_soma_grupos_gold_vs_total_gold", cod, ano, "", gsum, G[("sau.icsap.internacoes", cod, ano, None)]["valor"], "n")
        for i in range(1, 20):
            reg("icsap_grupo", cod, ano, f"g{i:02d}", grupos[i - 1], G[("sau.icsap.grupos", cod, ano, f"g{i:02d}")]["valor"], "n")
        i2 = it[(int(str(cod)[:6]), ano)]
        reg("icsap_participacao", cod, ano, "", tot / int(i2["internacoes_sus"]) * 100, G[("sau.icsap.participacao", cod, ano, None)]["valor"], "%cob")


# ============ 5b. Natureza da despesa (MSC de dezembro, função 10, contas 6.2.2.1.3.03/.04/.07, saldo líquido C menos D, sem modalidade 91)
CONTAS = ("6221303", "6221304", "6221307")
GRUPO = {"31": "pessoal", "32": "outras_correntes", "33": "outras_correntes", "44": "capital", "45": "capital", "46": "capital"}
for cod in CAP:
    for ano in ANOS:
        linhas = jgz(os.path.join(SEED, f"siconfi/msc_funcao10/{cod}_{ano}_12.json.gz"))
        soma = {"pessoal": 0.0, "outras_correntes": 0.0, "capital": 0.0}
        desconhecido = 0.0
        for x in linhas:
            if str(x.get("funcao")) != "10" or str(x["conta_contabil"])[:7] not in CONTAS:
                continue
            nat = str(x.get("natureza_despesa") or "")
            if nat[2:4] == "91":
                continue
            v = float(x["valor"]) * (1 if x["natureza_conta"] == "C" else -1)
            g_ = GRUPO.get(nat[:2])
            if g_ is None:
                desconhecido += v
            else:
                soma[g_] += v
        total_msc = sum(soma.values())
        reconcilia = abs(total_msc - dca_tot[(cod, ano)]) <= 1.0 and abs(desconhecido) < 0.005
        publicada = G[("sau.despesa.natureza", cod, ano, "pessoal")]["status"] == "OBSERVADO"
        checks.append(dict(grupo="natureza_publicacao_coerente", capital=CAP[cod]["nome"], uf=CAP[cod]["uf"], regiao=CAP[cod]["regiao"], ano=ano, componente="",
                           recalculado=1 if reconcilia else 0, gold=1 if publicada else 0, diferenca=(1 if reconcilia else 0) - (1 if publicada else 0), ok=(reconcilia == publicada), unidade="bool",
                           obs=f"MSC liquida {total_msc:.2f} (sem natureza identificavel {desconhecido:.2f}) vs DCA {dca_tot[(cod, ano)]:.2f}; linhas MSC {len(linhas)}"))
        if publicada:
            for k in soma:
                reg("natureza_valor", cod, ano, k, round(soma[k], 2), G[("sau.despesa.natureza", cod, ano, k)]["valor"], "R$")

# ============ 5c. Despesa por fonte (SIOPS): nove fontes e total, estágio empenhado, ano > 2020 (valor1..valor10)
COLS = [("recursos_ordinarios", "vl_coluna1"), ("impostos_saude", "vl_coluna2"), ("sus_uniao", "vl_coluna3"), ("sus_estado", "vl_coluna4"), ("convenios", "vl_coluna5"),
        ("operacoes_credito", "vl_coluna6"), ("lc173_uniao", "vl_coluna7"), ("royalties", "vl_coluna8"), ("outros", "vl_coluna9")]
for cod in CAP:
    for ano in ANOS:
        linhas = jgz(os.path.join(SEED, f"siops/despesas_por_fonte/{cod}_{ano}.json.gz"))
        tot = [l for l in linhas if str(l["grupo"]) == "17"][0]
        soma = sum(float(tot.get(c) or 0) for _, c in COLS)
        fecha = abs(soma - float(tot["vl_coluna10"])) <= 1.0
        pub = G[("sau.despesa.por_fonte", cod, ano, "convenios")]["status"] == "OBSERVADO" if ("sau.despesa.por_fonte", cod, ano, "convenios") in G else False
        checks.append(dict(grupo="fonte_publicacao_coerente", capital=CAP[cod]["nome"], uf=CAP[cod]["uf"], regiao=CAP[cod]["regiao"], ano=ano, componente="",
                           recalculado=1 if fecha else 0, gold=1 if pub else 0, diferenca=(1 if fecha else 0) - (1 if pub else 0), ok=(fecha == pub), unidade="bool",
                           obs=f"soma das 9 fontes {soma:.2f} vs total {float(tot['vl_coluna10']):.2f}"))
        if pub:
            for k, c in COLS:
                reg("fonte_valor", cod, ano, k, round(float(tot[c] or 0), 2), G[("sau.despesa.por_fonte", cod, ano, k)]["valor"], "R$")

# ============ 6. Saída
ok = sum(1 for c in checks if c["ok"]); n = len(checks)
print(f"checagens: {n}; ok: {ok}; falhas: {n-ok}; duplicatas CNES dezembro (estab×competência): {dups}")
bad = [c for c in checks if not c["ok"]]
bycat = collections.Counter((c["grupo"], c["ok"]) for c in checks)
for (g, o), v in sorted(bycat.items()):
    if not o:
        print("FALHA", g, v)
os.makedirs(OUT, exist_ok=True)
json.dump(checks, open(os.path.join(OUT, "checagens_completas.json"), "w", encoding="utf-8"), ensure_ascii=False)
json.dump(bad, open(os.path.join(OUT, "falhas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(bad[:60], ensure_ascii=False, indent=0)[:6000])
