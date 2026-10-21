#!/usr/bin/env python3
"""Recálculo independente (avaliador de dados, rodada 3) a partir da gold e dos CSV.

Não usa nenhum código de pipeline/eficiencia. Lê só public/eficiencia/gold/educacao_capitais.json
e public/eficiencia/series/*.csv. Escreve CSVs de resultado em evidencias/dados/.
Uso: python3 recalculo_gold.py
"""
import csv, json, math, statistics, collections, sys, os, hashlib

RAIZ = "/home/user/scrutiniums"
OUT = os.path.join(RAIZ, "docs/obee/avaliacao/rodada-3/evidencias/dados")
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
obs = g["observacoes"]
caps = {c["cod_ibge"]: c for c in g["universo"]["capitais"]}
reg_de = {cod: c["regiao"] for cod, c in caps.items()}

def q7(v, p):
    s = sorted(v)
    pos = (len(s) - 1) * p
    lo = math.floor(pos); hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)

# --- 1. estatísticas de grupo recalculadas x gold.referencias
idx = {}
for o in obs:
    idx[(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])] = o

elegiveis = collections.defaultdict(list)  # (ind,comp,etapa,ano) -> [(cod, valor)]
for o in obs:
    if o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]:
        elegiveis[(o["indicador"], o["componente"], o["etapa"], o["ano"])].append((o["ente"], o["valor"]))

GR = {"todas": None, "N": "N", "NE": "NE", "SE": "SE", "S": "S", "CO": "CO"}
dif_stat = []
nref = 0
refmap = {}
for r in g["referencias"]:
    refmap[(r["indicador"], r["componente"], r["etapa"], r["ano"], r["grupo"])] = r
for (ind, comp, et, ano), lst in elegiveis.items():
    for gr, rg in GR.items():
        sel = [(c, v) for c, v in lst if rg is None or reg_de[c] == rg]
        r = refmap.get((ind, comp, et, ano, gr))
        if not sel:
            if r is not None and r["capitais_com_valor"] > 0:
                dif_stat.append((ind, comp, et, ano, gr, "grupo_vazio_mas_gold_tem", "", ""))
            continue
        vs = [v for _, v in sel]
        calc = {"n": len(vs), "media": sum(vs) / len(vs), "mediana": statistics.median(vs), "minimo": min(vs), "maximo": max(vs)}
        if len(vs) >= 1:
            calc["q1"] = q7(vs, .25); calc["q3"] = q7(vs, .75)
        if r is None:
            dif_stat.append((ind, comp, et, ano, gr, "sem_referencia_na_gold", "", ""))
            continue
        nref += 1
        for k in ["n", "media", "mediana", "minimo", "maximo"]:
            gv = r[k]
            if gv is None or abs(gv - calc[k]) > 1e-6 * max(1, abs(calc[k])):
                dif_stat.append((ind, comp, et, ano, gr, k, calc[k], gv))
        if r["quartis_exibicao"]:
            for k in ["q1", "q3"]:
                if abs(r[k] - calc[k]) > 1e-6 * max(1, abs(calc[k])):
                    dif_stat.append((ind, comp, et, ano, gr, k, calc[k], r[k]))
        # extremos com empate
        cmin = sorted(c for c, v in sel if v == calc["minimo"]); cmax = sorted(c for c, v in sel if v == calc["maximo"])
        if sorted(r["capitais_minimo"]) != cmin: dif_stat.append((ind, comp, et, ano, gr, "capitais_minimo", cmin, r["capitais_minimo"]))
        if sorted(r["capitais_maximo"]) != cmax: dif_stat.append((ind, comp, et, ano, gr, "capitais_maximo", cmax, r["capitais_maximo"]))
        # quartis exibidos só com n >= 8
        if (len(vs) >= g["politica_referencias"]["limiar_quartis"]) != bool(r["quartis_exibicao"]):
            dif_stat.append((ind, comp, et, ano, gr, "quartis_exibicao", len(vs) >= 8, r["quartis_exibicao"]))
# referências da gold sem base de observações
for k, r in refmap.items():
    ind, comp, et, ano, gr = k
    if r["capitais_com_valor"] > 0 and (ind, comp, et, ano) not in elegiveis:
        dif_stat.append((ind, comp, et, ano, gr, "ref_sem_observacoes_elegiveis", "", r["n"]))
with open(f"{OUT}/recalculo_estatisticas_grupo.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["indicador", "componente", "etapa", "ano", "grupo", "campo", "recalculado", "gold"]); w.writerows(dif_stat)
print("1. referências comparadas:", nref, "divergências:", len(dif_stat))
for d in dif_stat[:15]: print("  ", d)

# --- 2. razão agregada: soma(numerador)/soma(denominador) nos mesmos pares
def valor(ind, cod, ano, et=None, comp=None):
    o = idx.get((ind, cod, ano, et, comp))
    return None if o is None else o

dif_raz = []
n_raz = 0
for (ind, comp, et, ano, gr), r in refmap.items():
    if r["razao_agregada"] is None: continue
    sel = [c for c, v in elegiveis[(ind, comp, et, ano)] if GR[gr] is None or reg_de[c] == GR[gr]]
    num = den = 0.0
    for c in sel:
        if ind == "edu.despesa.por_habitante":
            d = idx[("edu.despesa.funcao_educacao", c, ano, None, comp)]["valor"]
            p = idx[("ctx.populacao.residente", c, ano, None, None)]["valor"]
            num += d; den += p
        elif ind == "edu.despesa.aplicacao_direta_por_matricula":
            # numerador = ponte (ad_demais + ad_indeterminado) , denominador = matrículas totais da rede
            a = idx[("edu.despesa.ponte_matricula", c, ano, None, "ad_demais_elementos")]
            b = idx[("edu.despesa.ponte_matricula", c, ano, None, "ad_beneficiario_indeterminado")]
            m = idx[("edu.matriculas.rede_municipal", c, ano, "total", None)]["valor"]
            k = 1.0 if comp == "nominal" else (g["ipca"]["fatores_para_2025"][str(ano)])
            num += (a["valor"] + b["valor"]) * k; den += m
    if den:
        n_raz += 1
        rz = num / den
        if abs(rz - r["razao_agregada"]) > 1e-6 * rz:
            dif_raz.append((ind, comp, et, ano, gr, rz, r["razao_agregada"]))
print("2. razões agregadas recalculadas:", n_raz, "divergências:", len(dif_raz))
for d in dif_raz[:10]: print("  ", d)
with open(f"{OUT}/recalculo_razao_agregada.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["indicador", "componente", "etapa", "ano", "grupo", "recalculado", "gold"]); w.writerows(dif_raz)

# --- 3. derivados: por habitante, real (IPCA), por matrícula, soma subfunções
fat = {int(k): v for k, v in g["ipca"]["fatores_para_2025"].items()}
dif_der = []
cnt = collections.Counter()
for c in caps:
    for ano in g["periodos"]["financeiros"]:
        dn = idx.get(("edu.despesa.funcao_educacao", c, ano, None, "nominal"))
        dr = idx.get(("edu.despesa.funcao_educacao", c, ano, None, "real_2025"))
        pop = idx.get(("ctx.populacao.residente", c, ano, None, None))
        ph_n = idx.get(("edu.despesa.por_habitante", c, ano, None, "nominal"))
        ph_r = idx.get(("edu.despesa.por_habitante", c, ano, None, "real_2025"))
        if dn and dr and dn["valor"] is not None:
            cnt["real"] += 1
            e = dn["valor"] * fat[ano]
            if abs(e - dr["valor"]) > 0.01 + 1e-9 * e: dif_der.append(("real_2025", c, ano, e, dr["valor"]))
        if dn and pop and ph_n and dn["valor"] is not None:
            cnt["hab_nom"] += 1
            e = dn["valor"] / pop["valor"]
            if abs(e - ph_n["valor"]) > 1e-4: dif_der.append(("por_hab_nominal", c, ano, e, ph_n["valor"]))
        if dn and pop and ph_r and dn["valor"] is not None:
            cnt["hab_real"] += 1
            e = dn["valor"] * fat[ano] / pop["valor"]
            if abs(e - ph_r["valor"]) > 1e-2: dif_der.append(("por_hab_real", c, ano, e, ph_r["valor"]))
        # razão por matrícula
        for comp in ("nominal", "real_2025"):
            pm = idx.get(("edu.despesa.aplicacao_direta_por_matricula", c, ano, None, comp))
            a = idx.get(("edu.despesa.ponte_matricula", c, ano, None, "ad_demais_elementos"))
            b = idx.get(("edu.despesa.ponte_matricula", c, ano, None, "ad_beneficiario_indeterminado"))
            m = idx.get(("edu.matriculas.rede_municipal", c, ano, "total", None))
            if pm and pm["valor"] is not None and a and b and m:
                cnt["mat_" + comp] += 1
                k = 1.0 if comp == "nominal" else fat[ano]
                e = (a["valor"] + b["valor"]) * k / m["valor"]
                if abs(e - pm["valor"]) > 1e-3 * (1 if comp == "nominal" else 2): dif_der.append(("por_matricula_" + comp, c, ano, e, pm["valor"]))
        # soma subfunções = total
        subs = [o for (i, cc, aa, et, co), o in idx.items() if i == "edu.despesa.subfuncao" and cc == c and aa == ano and o["valor"] is not None]
        # a gold guarda valor em % (participação) e valor em R$? checa
        if subs and dn and dn["valor"]:
            cnt["subf"] += 1
            sp = sum(o["participacao"] or 0 for o in subs)
            sv = sum(o["valor"] for o in subs)
            if abs(sp - 100) > 0.01: dif_der.append(("soma_participacao_subfuncoes", c, ano, 100, sp))
            if abs(sv - dn["valor"]) > 1.0: dif_der.append(("soma_valor_subfuncoes", c, ano, dn["valor"], sv))
print("3. derivados verificados:", dict(cnt), "divergências:", len(dif_der))
for d in dif_der[:15]: print("  ", d)
with open(f"{OUT}/recalculo_derivados.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["tipo", "cod_ibge", "ano", "recalculado", "gold"]); w.writerows(dif_der)

# --- 4. CSV das séries x gold
sdir = f"{RAIZ}/public/eficiencia/series"
mapa_arq = {}
dif_csv = []
tot = 0
gold_by_key = {}
for o in obs:
    gold_by_key[(o["indicador"], str(o["ente"]), str(o["ano"]), o["etapa"] or "", o["componente"] or "")] = o
csv_keys = set()
for fn in sorted(os.listdir(sdir)):
    if not fn.startswith("edu_") and not fn.startswith("ctx_"): continue
    if fn in ("edu_diagnostico_pares_msc.csv",): continue
    rows = list(csv.DictReader(open(f"{sdir}/{fn}", encoding="utf-8")))
    for r in rows:
        tot += 1
        etapa_nome = r["etapa"]
        # etapa no csv é nome; mapear de volta
        nm2id = {e["nome"]: e["id"] for e in g["etapas"]}
        eid = nm2id.get(etapa_nome, etapa_nome) if etapa_nome else ""
        k = (r["indicador_id"], r["codigo_ibge"], r["ano"], eid, r["componente"])
        csv_keys.add(k)
        o = gold_by_key.get(k)
        if o is None:
            dif_csv.append((fn, k, "sem_correspondente_na_gold", "", "")); continue
        v = r["valor"]
        if v == "" and o["valor"] is not None: dif_csv.append((fn, k, "valor", v, o["valor"]))
        elif v != "" and (o["valor"] is None or abs(float(v) - o["valor"]) > 1e-6 * max(1, abs(o["valor"]))): dif_csv.append((fn, k, "valor", v, o["valor"]))
        if r["status"] != o["status"]: dif_csv.append((fn, k, "status", r["status"], o["status"]))
        if (r["elegivel_comparacao"] == "sim") != bool(o["elegivel_comparacao"]) and o["status"] == "OBSERVADO": dif_csv.append((fn, k, "elegivel", r["elegivel_comparacao"], o["elegivel_comparacao"]))
        if r["hash_dados"] != g["meta"]["hash_dados"]: dif_csv.append((fn, k, "hash_dados", r["hash_dados"], g["meta"]["hash_dados"]))
        if r["dados_gerados_em"] != g["meta"]["gerado_em"]: dif_csv.append((fn, k, "dados_gerados_em", r["dados_gerados_em"], g["meta"]["gerado_em"]))
nao_csv = [k for k in gold_by_key if k not in csv_keys]
for k in nao_csv: dif_csv.append(("(gold)", k, "observacao_da_gold_ausente_dos_csv", "", ""))
print("4. linhas de CSV de séries:", tot, "observações da gold:", len(obs), "divergências:", len(dif_csv))
for d in dif_csv[:15]: print("  ", d)
with open(f"{OUT}/recalculo_csv_x_gold.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["arquivo", "chave", "campo", "csv", "gold"]); w.writerows([(a, "|".join(map(str, b)), c, d, e) for a, b, c, d, e in dif_csv])
