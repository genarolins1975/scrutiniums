#!/usr/bin/env python3
"""Confere o RREO do 6º bimestre (Anexo 02, Educação, despesas liquidadas até o bimestre, com e sem intraorçamentárias) da gold
contra o Siconfi, consulta ao vivo em 2026-10-09, para as 130 declarações. A parcela intraorçamentária exibida no painel
depende dessas duas linhas. Saída: verificacao_fontes_rreo.csv"""
import csv, json, time, urllib.request
RAIZ = "/home/user/scrutiniums"
OUT = f"{RAIZ}/docs/obee/avaliacao/rodada-3/evidencias/dados"
g = json.load(open(f"{RAIZ}/public/eficiencia/gold/educacao_capitais.json"))
idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in g["observacoes"]}
def get(url):
    for i in range(4):
        try: return json.load(urllib.request.urlopen(url, timeout=90))
        except Exception as e: err = e; time.sleep(2 * (i + 1))
    raise err
linhas = []
for c in g["universo"]["capitais"]:
    for ano in g["periodos"]["financeiros"]:
        url = f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio={ano}&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&id_ente={c['cod_ibge']}"
        itens, off = [], 0
        while True:
            d = get(url + (f"&offset={off}" if off else ""))
            itens += d["items"]
            if not d.get("hasMore"): break
            off += d["limit"]
        ex = intra = None
        for x in itens:
            if x.get("conta") == "Educação" and str(x.get("coluna", "")).startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE"):
                if "Exceto" in x.get("rotulo", ""): ex = x["valor"]
                else: intra = x["valor"]
        o = idx[("edu.despesa.funcao_educacao", c["cod_ibge"], ano, None, "nominal")]
        r = (o.get("conferencia") or {}).get("rreo") or {}
        ok = (ex == r.get("exceto_intra")) and (intra == r.get("intra"))
        pct_f = round(100 * intra / (ex + intra), 1) if (ex is not None and intra is not None and ex + intra > 0) else None
        linhas.append((c["nome"], ano, ex, r.get("exceto_intra"), intra, r.get("intra"), pct_f, "ok" if ok else "DIVERGE"))
        print(linhas[-1], flush=True)
with open(f"{OUT}/verificacao_fontes_rreo.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["capital", "ano", "rreo_exceto_intra_siconfi", "rreo_exceto_intra_gold", "rreo_intra_siconfi", "rreo_intra_gold", "parcela_intra_pct", "resultado"]); w.writerows(linhas)
print("divergências:", sum(1 for l in linhas if l[-1] != "ok"), "de", len(linhas))
