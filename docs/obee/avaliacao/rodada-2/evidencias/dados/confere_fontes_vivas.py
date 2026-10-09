#!/usr/bin/env python3
"""Conferência contra as fontes originais acessadas ao vivo em 2026-10-09 (Siconfi API de dados abertos e SIDRA/IBGE).
Compara com a gold (nada do pipeline é importado). Saída: fontes_vivas.csv.
Uso: python3 -I confere_fontes_vivas.py <raiz> <saida>
"""
import csv, json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(sys.argv[1]); SAIDA = Path(sys.argv[2])
G = json.load(open(RAIZ / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: c["nome"] for c in G["universo"]["capitais"]}
ix = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def get(url):
    for _ in range(3):
        r = subprocess.run(["curl", "-s", "-m", "90", url], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            try: return json.loads(r.stdout)
            except Exception: pass
    return None

def dca(args):
    cod, ano = args
    d = get(f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={ano}&no_anexo=DCA-Anexo+I-E&id_ente={cod}")
    if not d: return (cod, ano, None, "sem resposta")
    v = [r["valor"] for r in d["items"] if r["conta"] == "12 - Educação" and r["coluna"] == "Despesas Liquidadas"]
    return (cod, ano, v[0] if len(v) == 1 else None, f"{len(v)} linhas; hasMore={d.get('hasMore')}")

linhas = []
with ThreadPoolExecutor(8) as ex:
    for cod, ano, v, nota in ex.map(dca, [(c, a) for c in CAPS for a in range(2021, 2026)]):
        g = ix[("edu.despesa.funcao_educacao", cod, ano, None, "nominal")]["valor"]
        linhas.append(["Siconfi DCA I-E liquidada função 12", CAPS[cod], ano, g, v, "" if v is None else abs(g - v), nota, agora])

# SIDRA: tabela 6579 (estimativas 2021, 2024, 2025) e 4714 (Censo 2022)
cods = ",".join(str(c) for c in CAPS)
for tab, var, anos in (("6579", "9324", [2021, 2024, 2025]), ("4714", "93", [2022])):
    for ano in anos:
        extra = "" if tab == "6579" else "/c2/6794"
        d = get(f"https://apisidra.ibge.gov.br/values/t/{tab}/n6/{cods}/v/{var}/p/{ano}")
        if not d:
            linhas.append([f"SIDRA {tab}", "", ano, "", "", "", "sem resposta", agora]); continue
        for r in d[1:]:
            cod = int(r["D1C"]); v = r["V"]
            g = ix[("ctx.populacao.residente", cod, ano, None, None)]["valor"]
            vv = None if v in ("...", "-", "X") else float(v)
            linhas.append([f"SIDRA {tab} v{var}", CAPS[cod], ano, g, vv, "" if vv is None else abs(g - vv), "", agora])
    # população 2023 = Censo 2022
for cod in CAPS:
    g23 = ix[("ctx.populacao.residente", cod, 2023, None, None)]["valor"]
    g22 = ix[("ctx.populacao.residente", cod, 2022, None, None)]["valor"]
    linhas.append(["Gold 2023 = gold 2022 (Censo 2022)", CAPS[cod], 2023, g23, g22, abs(g23 - g22), "", agora])

with open(SAIDA / "fontes_vivas.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["fonte_consultada", "capital", "ano", "valor_gold", "valor_na_fonte", "diferenca_absoluta", "nota", "consultado_em_utc"])
    w.writerows(linhas)
fora = [l for l in linhas if l[4] == "" or l[4] is None or (l[5] != "" and l[5] > 0.011)]
print("linhas:", len(linhas), "fora da tolerância ou sem valor:", len(fora))
for l in fora[:40]: print(l)
