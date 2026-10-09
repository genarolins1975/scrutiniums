#!/usr/bin/env python3
"""Recalcula a parcela intraorçamentária da função Educação (RREO, 6º bimestre) a partir do seed (e de uma amostra ao vivo
no Siconfi) e compara com a gold e com os extremos exibidos no painel. Uso: python3 -I confere_intra_rreo.py <raiz> <saida>"""
import csv, gzip, json, subprocess, sys
from pathlib import Path
R = Path(sys.argv[1]); S = Path(sys.argv[2])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: f'{c["nome"]} ({c["uf"]})' for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["componente"]): o for o in G["observacoes"] if o["indicador"] == "edu.despesa.funcao_educacao"}
def parcelas(itens):
    # o rótulo do bloco intraorçamentário muda entre exercícios ("Total das Despesas Intra-Orçamentárias" / "Total de Despesas"); o cod_conta é estável
    ex = [r["valor"] for r in itens if r["conta"] == "Educação" and r["coluna"].startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE") and r["cod_conta"] == "RREO2TotalDespesas"]
    it = [r["valor"] for r in itens if r["conta"] == "Educação" and r["coluna"].startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE") and r["cod_conta"] == "RREO2TotalDespesasIntra"]
    return (ex[0] if len(ex) == 1 else None), (it[0] if len(it) == 1 else (0.0 if not it else None))
linhas = []; por_ano = {}
for cod in CAPS:
    for ano in range(2021, 2026):
        itens = json.load(gzip.open(R / f"pipeline/eficiencia/seed/siconfi/rreo_anexo_02_b6/{cod}_{ano}.json.gz", "rt", encoding="utf-8"))
        ex, it = parcelas(itens)
        o = OBS[("edu.despesa.funcao_educacao", cod, ano, "nominal")]
        g = (o.get("conferencia") or {}).get("rreo") or {}
        pct = None if ex is None or it is None else 100 * it / (ex + it)
        por_ano.setdefault(ano, []).append((pct, CAPS[cod]))
        linhas.append([CAPS[cod], ano, ex, it, g.get("exceto_intra"), g.get("intra"), "" if pct is None else round(pct, 4),
                       "ok" if (ex == g.get("exceto_intra") and (it == g.get("intra") or (it in (0, None) and g.get("intra") in (0, None)))) else "DIVERGE"])
with open(S / "intra_rreo_recalculo.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["capital", "ano", "rreo_exceto_intra_seed", "rreo_intra_seed", "rreo_exceto_intra_gold", "rreo_intra_gold", "parcela_intra_pct_recalculada", "resultado"]); w.writerows(linhas)
print("divergências seed x gold:", sum(1 for l in linhas if l[-1] != "ok"), "de", len(linhas))
for ano, v in sorted(por_ano.items()):
    v = [x for x in v if x[0] is not None]; v.sort()
    print(ano, "n", len(v), "menor", v[0][1], f"{v[0][0]:.1f}%", "maior", v[-1][1], f"{v[-1][0]:.1f}%")
# amostra ao vivo
amostra = [(4314902, 2025), (1600303, 2025), (3550308, 2023), (4314902, 2023), (2800308, 2022)]
for cod, ano in amostra:
    out = subprocess.run(["curl", "-s", "-m", "90", f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio={ano}&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&co_esfera=M&id_ente={cod}"], capture_output=True, text=True).stdout
    try:
        d = json.loads(out)["items"]; ex, it = parcelas(d)
        print("AO VIVO", CAPS[cod], ano, ex, it, None if ex is None else f"{100*it/(ex+it):.2f}%")
    except Exception as e:
        print("AO VIVO falhou", CAPS[cod], ano, str(e)[:80])
