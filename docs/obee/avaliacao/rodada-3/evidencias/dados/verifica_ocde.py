#!/usr/bin/env python3
"""Confere o tamanho médio de turma do Brasil (ISCED 1 e 2, instituições públicas e todas, 2023 e 2024) da gold contra a API SDMX
da OCDE (consulta ao vivo em 2026-10-09). Uso: python3 -I verifica_ocde.py <csv sdmx baixado>"""
import csv, json, sys
RAIZ = "/home/user/scrutiniums"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
ref = {(r["EDUCATION_LEV: Education level"].split(":")[0], r["INST_TYPE_EDU: Type of educational institution"].split(":")[0], r["TIME_PERIOD: Time period"]): r["OBS_VALUE"]
       for r in rows if r["REF_AREA: Reference area"].startswith("BRA")}
inst = {"publicas": "INST_EDU_PUB", "todas": "INST_EDU"}
out = []
for x in g["referencias_internacionais"]:
    if x["conjunto"] != "ocde_tamanho_turma": continue
    v = ref.get((x["nivel"], inst[x["instituicoes"]], str(x["ano"])))
    out.append((x["nivel"], x["instituicoes"], x["ano"], v, x["brasil"], "ok" if v and abs(float(v) - x["brasil"]) < 1e-9 else "DIVERGE"))
with open(f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados/verificacao_ocde_tamanho_turma.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["nivel", "instituicoes", "ano", "brasil_api_sdmx_ao_vivo", "brasil_gold", "resultado"]); w.writerows(out)
print(out)
