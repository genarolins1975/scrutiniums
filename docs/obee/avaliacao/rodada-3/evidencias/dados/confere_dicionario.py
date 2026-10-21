#!/usr/bin/env python3
"""Confere que toda coluna dos CSV baixáveis do navegador tem descrição no dicionário também baixado do navegador.
Uso: python3 -I confere_dicionario.py <jsonl>"""
import csv, io, json, sys
dic = {}
cabs = {}
for l in open(sys.argv[1]):
    r = json.loads(l)
    for nome, c in (r.get("csvs") or {}).items():
        if not c: print("(botão ausente)", r["id"], nome); continue
        rows = list(csv.reader(io.StringIO(c["conteudo"].lstrip("﻿")), delimiter=";"))
        if c["arquivo"].startswith("obee_dicionario"):
            for a in rows[1:]: dic[(a[0], a[1])] = a[2]
        else:
            cabs[c["arquivo"]] = rows[0]
print("arquivos de dados:", list(cabs))
nomes_dic = {k[1] for k in dic}
vazios = [k for k, v in dic.items() if not v.strip()]
print("entradas do dicionário:", len(dic), "sem texto:", vazios)
for arq, cols in cabs.items():
    sem = [c for c in cols if c not in nomes_dic]
    print(arq, len(cols), "colunas; sem descrição no dicionário:", sem)
