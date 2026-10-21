#!/usr/bin/env python3
"""Reprodução independente do numerador da despesa de aplicação direta por matrícula, usando só o que a página Dados e métodos
documenta (modalidades 90, 93 e 94; menos subfunção 364; menos elementos 01, 03 e 05 do grupo 3.1; MSC de dezembro, função 12,
contas 6.2.2.1.3.03, .04 e .07; saldo líquido C soma, D subtrai; intraorçamentárias, modalidade 91, fora).
Compara com a gold (numerador e razão) nos 130 pares capital × exercício. Uso: python3 -I reproduz_despesa_matricula.py <raiz> <saida>"""
import csv, gzip, json, sys
from pathlib import Path
R = Path(sys.argv[1]); S = Path(sys.argv[2])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: c["nome"] for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
linhas = []
for cod in CAPS:
    for ano in range(2021, 2026):
        arq = R / f"pipeline/eficiencia/seed/siconfi/msc_funcao12/{cod}_{ano}_12.json.gz"
        msc = json.load(gzip.open(arq, "rt", encoding="utf-8")) if arq.exists() else []
        contas = ("622130300", "622130400", "622130700")
        tot = num = intra = 0.0; n_linhas = 0; sem_nat = 0
        for r in msc:
            if r["funcao"] != "12" or r["conta_contabil"] not in contas: continue
            n_linhas += 1
            if r["natureza_conta"] not in ("C", "D") or not r.get("natureza_despesa"): sem_nat += 1; continue
            v = r["valor"] if r["natureza_conta"] == "C" else -r["valor"]
            nd = r["natureza_despesa"]; cat, grupo, mod, elem = nd[0], nd[1], nd[2:4], nd[4:6]
            if mod == "91": intra += v; continue
            tot += v
            if mod in ("90", "93", "94") and r["subfuncao"] != "364" and not (cat == "3" and grupo == "1" and elem in ("01", "03", "05")):
                num += v
        dca = OBS[("edu.despesa.funcao_educacao", cod, ano, None, "nominal")]["valor"]
        o = OBS[("edu.despesa.aplicacao_direta_por_matricula", cod, ano, None, "nominal")]
        gnum = (o.get("calculo") or {}).get("numerador"); gden = (o.get("calculo") or {}).get("denominador")
        mat = OBS[("edu.matriculas.rede_municipal", cod, ano, "total", None)]["valor"]
        razao = num / mat if mat else None
        linhas.append([CAPS[cod], ano, n_linhas, round(tot, 2), dca, round(tot - dca, 2), round(num, 2), gnum, "" if gnum is None else round(num - gnum, 2), razao, o["valor"], o["status"],
                       "" if (o["valor"] is None or razao is None) else round(razao - o["valor"], 6)])
with open(S / "reproducao_despesa_matricula.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["capital", "ano", "linhas_msc_f12", "msc_total_sem_intra", "dca", "msc_menos_dca", "numerador_reproduzido", "numerador_gold", "dif_numerador", "razao_reproduzida", "razao_gold", "status_gold", "dif_razao"]); w.writerows(linhas)
com = [l for l in linhas if l[7] is not None]
print("pares com valor na gold:", len(com), "; maior |dif numerador|:", max(abs(l[8]) for l in com), "; maior |dif razão|:", max(abs(l[12]) for l in com))
sem = [l for l in linhas if l[7] is None]
print("pares sem valor na gold:", len(sem))
for l in sem: print("  ", l[0], l[1], "linhas f12:", l[2], "MSC-DCA:", l[5], l[11])
