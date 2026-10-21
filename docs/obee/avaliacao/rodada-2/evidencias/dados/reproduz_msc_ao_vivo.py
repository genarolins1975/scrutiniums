#!/usr/bin/env python3
"""Reproduz, ao vivo na API do Siconfi (MSC agregada de dezembro, classe 6), o numerador da despesa de aplicação direta por matrícula
de Aracaju 2025 pela regra documentada no painel. Esperado (gold): total sem intra 566422643.48 e numerador 561863001.98.
Executado em 2026-10-09. Uso: python3 -I reproduz_msc_ao_vivo.py"""
import json, subprocess
base = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/msc_orcamentaria?id_ente=2800308&an_referencia=2025&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance"
itens = []; off = 0
while True:
    d = json.loads(subprocess.run(["curl", "-s", "-m", "120", base + f"&offset={off}"], capture_output=True, text=True).stdout)
    itens += d["items"]
    if not d.get("hasMore"): break
    off += len(d["items"])
num = tot = 0
for r in itens:
    if r.get("funcao") != "12" or r["conta_contabil"] not in ("622130300", "622130400", "622130700"): continue
    v = r["valor"] if r["natureza_conta"] == "C" else -r["valor"]; nd = r["natureza_despesa"]; mod, elem = nd[2:4], nd[4:6]
    if mod == "91": continue
    tot += v
    if mod in ("90", "93", "94") and r["subfuncao"] != "364" and not (nd[0] == "3" and nd[1] == "1" and elem in ("01", "03", "05")): num += v
print(len(itens), "linhas;", "total sem intra", round(tot, 2), "numerador", round(num, 2), "(gold 561863001.98)")
