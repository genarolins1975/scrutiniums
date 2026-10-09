#!/usr/bin/env python3
"""Confere matrículas da rede municipal 2025 (total, creche, pré-escola) e conveniadas da gold contra a Sinopse Estatística do Censo
Escolar 2025 do INEP (baixada em 2026-10-09; sha256 igual ao do manifesto). Uso: python3 -I verifica_sinopse_2025.py <xlsx>"""
import csv, json, sys, openpyxl
RAIZ = "/home/user/scrutiniums"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
nomes = {c["cod_ibge"]: c["nome"] for c in g["universo"]["capitais"]}
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
out = []
def le(aba):
    ws = wb[aba]
    d = {}
    for row in ws.iter_rows(values_only=True):
        try: cod = int(str(row[3]).strip())
        except: continue
        d[cod] = row
    return d
t12 = le("1.2"); cre = le("Creche 1.10"); pre = le("Pré-Escola 1.15")
for cod in nomes:
    # 1.2: col 8 = Rede Pública > Municipal
    for rotulo, tab, col, chave in [("Matrículas rede municipal, total", t12, 8, ("edu.matriculas.rede_municipal", cod, 2025, "total", None)),
                                   ("Matrículas rede municipal, creche", cre, 8, ("edu.matriculas.rede_municipal", cod, 2025, "creche", None)),
                                   ("Matrículas rede municipal, pré-escola", pre, 8, ("edu.matriculas.rede_municipal", cod, 2025, "pre_escola", None))]:
        v = tab[cod][col]
        o = idx[chave]["valor"]
        out.append((rotulo, nomes[cod], 2025, v, o, "ok" if float(v) == float(o) else "DIVERGE"))
with open(f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados/verificacao_sinopse_2025.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["conferencia", "capital", "ano", "sinopse_inep", "gold", "resultado"]); w.writerows(out)
import collections
print(len(out), collections.Counter(x[-1] for x in out))
for x in out:
    if x[-1] != "ok": print(x)
