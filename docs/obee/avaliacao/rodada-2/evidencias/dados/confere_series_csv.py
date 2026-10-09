#!/usr/bin/env python3
"""Confere os CSV estáticos de public/eficiencia/series contra a gold (valor, estado, elegibilidade, nota, versão, hash).
Uso: python3 -I confere_series_csv.py <raiz>"""
import csv, json, sys
from pathlib import Path
R = Path(sys.argv[1])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
ET = {e["nome"]: e["id"] for e in G["etapas"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
VER = {i["id"]: i["versao_metodologica"] for i in G["indicadores"]}
tot = bad = 0; vistos = set(); por_arq = {}
for f in sorted((R / "public/eficiencia/series").glob("*.csv")):
    rows = list(csv.DictReader(open(f, encoding="utf-8")))
    if "indicador_id" not in rows[0] or "codigo_ibge" not in rows[0] or "hash_dados" not in rows[0]: continue
    n = b = 0
    for r in rows:
        k = (r["indicador_id"], int(r["codigo_ibge"]), int(r["ano"]), ET.get(r["etapa"]) if r["etapa"] else None, r["componente"] or None)
        o = OBS.get(k); n += 1; vistos.add(k)
        if o is None: b += 1; print("sem obs na gold:", k); continue
        v = r["valor"]; ok = (v == "" and o["valor"] is None) or (v != "" and o["valor"] is not None and abs(float(v) - o["valor"]) <= 1e-9 * max(1, abs(o["valor"])))
        ok = ok and r["status"] == o["status"] and (r["elegivel_comparacao"] == "sim") == bool(o["elegivel_comparacao"]) and r["versao_metodologica"] == VER[r["indicador_id"]]
        if v == "" and r["status"] == "OBSERVADO": ok = False
        if not ok: b += 1; print("DIVERGE", f.name, k, v, o["valor"], r["status"], o["status"])
    por_arq[f.name] = (n, b); tot += n; bad += b
print("CSV estáticos conferidos:", tot, "linhas; divergentes:", bad)
for k, v in por_arq.items(): print(" ", k, v)
falt = [k for k in OBS if k not in vistos]
print("observações da gold ausentes dos CSV:", len(falt), falt[:3])
