#!/usr/bin/env python3
"""Confere Ideb (2005 a 2025), Saeb, aprovação 2025 e ATU 2025 da gold contra os arquivos oficiais do INEP, baixados em
2026-10-09 (HTTP simples, porque o TLS de download.inep.gov.br falha neste ambiente; a integridade foi validada pelo sha256
registrado no manifesto da gold). Uso: python3 -I verifica_fontes_inep.py <pasta com x_* extraídos>"""
import csv, json, sys, os, openpyxl

PASTA = sys.argv[1]
RAIZ = "/home/user/scrutiniums"
OUT = f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
caps = {c["cod_ibge"]: c["nome"] for c in g["universo"]["capitais"]}
linhas = []

def num(s):
    try: return float(str(s).replace(",", "."))
    except: return None

def cmp(rotulo, cod, ano, chave, bruto):
    o = idx.get(chave)
    v = num(bruto)
    if o is None:
        linhas.append((rotulo, caps[cod], ano, bruto, "", "", "SEM_OBS_NA_GOLD")); return
    if v is None:
        res = "ok" if o["valor"] is None else "DIVERGE"
        linhas.append((rotulo, caps[cod], ano, bruto, o["valor"], o["status"], res + " (fonte sem valor numérico)")); return
    ok = o["valor"] is not None and abs(o["valor"] - v) < 1e-9 + 1e-6 * abs(v)
    linhas.append((rotulo, caps[cod], ano, bruto, o["valor"], o["status"], "ok" if ok else "DIVERGE"))

def le(p, cab_linha, cols):
    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    cab = None
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == cab_linha: cab = [str(x) if x is not None else "" for x in row]; continue
        if cab is None or i < cab_linha: continue
        yield dict(zip(cab, row))

# Ideb / Saeb
for etapa, arq in [("anos_iniciais", "x_divulgacao_anos_iniciais_municipios_2025/divulgacao_anos_iniciais_municipios_2025/divulgacao_anos_iniciais_municipios_2025.xlsx"),
                   ("anos_finais", "x_divulgacao_anos_finais_municipios_2025/divulgacao_anos_finais_municipios_2025/divulgacao_anos_finais_municipios_2025.xlsx")]:
    for r in le(f"{PASTA}/{arq}", 9, None):
        try: cod = int(r["CO_MUNICIPIO"])
        except: continue
        if cod not in caps or r["REDE"] != "Municipal": continue
        for ano in range(2005, 2026, 2):
            cmp("Ideb " + etapa, cod, ano, ("edu.ideb.rede_municipal", cod, ano, etapa, "ideb"), r.get(f"VL_OBSERVADO_{ano}"))
            cmp("Ideb P " + etapa, cod, ano, ("edu.ideb.rede_municipal", cod, ano, etapa, "p_rendimento"), r.get(f"VL_INDICADOR_REND_{ano}"))
            cmp("Ideb N " + etapa, cod, ano, ("edu.ideb.rede_municipal", cod, ano, etapa, "n_nota_padronizada"), r.get(f"VL_NOTA_MEDIA_{ano}"))
            cmp("Saeb mat " + etapa, cod, ano, ("edu.saeb.rede_municipal", cod, ano, etapa, "matematica"), r.get(f"VL_NOTA_MATEMATICA_{ano}"))
            cmp("Saeb port " + etapa, cod, ano, ("edu.saeb.rede_municipal", cod, ano, etapa, "portugues"), r.get(f"VL_NOTA_PORTUGUES_{ano}"))
# ATU 2025
for r in le(f"{PASTA}/x_ATU_2025/ATU_2025_MUNICIPIOS/ATU_MUNICIPIOS_2025.xlsx", 8, None):
    try: cod = int(r["CO_MUNICIPIO"])
    except: continue
    if cod not in caps or r["NO_CATEGORIA"] != "Total" or r["NO_DEPENDENCIA"] != "Municipal": continue
    for et, col in [("creche", "CRE_CAT_0"), ("pre_escola", "PRE_CAT_0"), ("anos_iniciais", "FUN_AI_CAT_0"), ("anos_finais", "FUN_AF_CAT_0")]:
        cmp("ATU " + et, cod, 2025, ("edu.atu.rede_municipal", cod, 2025, et, None), r[col])
# aprovação 2025
for r in le(f"{PASTA}/x_txrend_2025/tx_rend_municipios_2025/tx_rend_municipios_2025.xlsx", 8, None):
    try: cod = int(r["CO_MUNICIPIO"])
    except: continue
    if cod not in caps or r["NO_CATEGORIA"] != "Total" or r["NO_DEPENDENCIA"] != "Municipal": continue
    for et, col in [("anos_iniciais", "1_CAT_FUN_AI"), ("anos_finais", "1_CAT_FUN_AF")]:
        cmp("Aprovação " + et, cod, 2025, ("edu.aprovacao.rede_municipal", cod, 2025, et, None), r[col])

with open(f"{OUT}/verificacao_fontes_inep.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["conferencia", "capital", "ano", "fonte_inep_bruto", "gold", "status_gold", "resultado"]); w.writerows(linhas)
import collections
print(len(linhas), collections.Counter(l[-1].split(" ")[0] for l in linhas))
for l in linhas:
    if not l[-1].startswith("ok"): print(l)
