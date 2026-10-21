#!/usr/bin/env python3
"""Confere despesa (DCA, Siconfi) e população (SIDRA 6579/4714) da gold contra as APIs oficiais, consultadas ao vivo
em 2026-10-09 (avaliador de dados, rodada 3). TLS verificado (proxy do ambiente com CA própria).
Saída: verificacao_fontes_dca_sidra.csv
"""
import csv, json, sys, time, urllib.request, urllib.parse, os

RAIZ = "/home/user/scrutiniums"
OUT = f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
caps = g["universo"]["capitais"]

def get(url, tent=4):
    for i in range(tent):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "avaliador-obee/1"}), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            err = e; time.sleep(2 * (i + 1))
    raise err

linhas = []
# --- DCA
for c in caps:
    for ano in g["periodos"]["financeiros"]:
        url = f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={ano}&no_anexo=DCA-Anexo+I-E&id_ente={c['cod_ibge']}"
        items = []
        off = 0
        while True:
            d = get(url + (f"&offset={off}" if off else ""))
            items += d["items"]
            if not d.get("hasMore"): break
            off += d["limit"]
        def val(prefix_conta, col):
            vs = [i["valor"] for i in items if i["conta"].startswith(prefix_conta) and i["coluna"] == col]
            return vs
        liq = val("12 - Educação", "Despesas Liquidadas")
        gold = idx[("edu.despesa.funcao_educacao", c["cod_ibge"], ano, None, "nominal")]["valor"]
        ok = len(liq) == 1 and abs(liq[0] - gold) < 0.005
        linhas.append(("DCA função 12 liquidada", c["nome"], ano, liq[0] if len(liq) == 1 else f"n={len(liq)} {liq}", gold, "" if len(liq) != 1 else round(liq[0] - gold, 2), "ok" if ok else "DIVERGE"))
        print(c["nome"], ano, linhas[-1][3:], flush=True)

# --- População SIDRA 6579 (estimativas) 2021, 2024, 2025 e Censo 2022 (4714)
cods = ",".join(str(c["cod_ibge"]) for c in caps)
for ano, url in [
    (2021, f"https://apisidra.ibge.gov.br/values/t/6579/n6/{cods}/v/9324/p/2021"),
    (2024, f"https://apisidra.ibge.gov.br/values/t/6579/n6/{cods}/v/9324/p/2024"),
    (2025, f"https://apisidra.ibge.gov.br/values/t/6579/n6/{cods}/v/9324/p/2025"),
    (2022, f"https://apisidra.ibge.gov.br/values/t/4714/n6/{cods}/v/93/p/2022"),
]:
    d = get(url)
    for r in d[1:]:
        cod = int(r["D1C"]); v = r["V"]
        gold = idx[("ctx.populacao.residente", cod, ano, None, None)]["valor"]
        nome = next(c["nome"] for c in caps if c["cod_ibge"] == cod)
        try: vv = float(v)
        except: vv = None
        ok = vv is not None and abs(vv - gold) < 0.5
        linhas.append((f"População SIDRA ({'4714 Censo' if ano == 2022 else '6579 estimativa'})", nome, ano, v, gold, "" if vv is None else vv - gold, "ok" if ok else "DIVERGE"))
with open(f"{OUT}/verificacao_fontes_dca_sidra.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["conferencia", "capital", "ano", "fonte_oficial_consulta_ao_vivo", "gold", "diferenca", "resultado"]); w.writerows(linhas)
print("total", len(linhas), "divergências", sum(1 for l in linhas if l[-1] != "ok"))
