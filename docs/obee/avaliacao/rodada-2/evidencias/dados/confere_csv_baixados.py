#!/usr/bin/env python3
"""Confere os CSV baixados do site (Playwright) contra a gold e contra o dicionário baixado.
Uso: python3 -I confere_csv_baixados.py <raiz> <pasta downloads>"""
import csv, json, math, statistics, sys, re
from pathlib import Path
R = Path(sys.argv[1]); D = Path(sys.argv[2])
G = json.load(open(R / "public/eficiencia/gold/educacao_capitais.json"))
CAPS = {c["cod_ibge"]: c for c in G["universo"]["capitais"]}
OBS = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in G["observacoes"]}
def le(n): return list(csv.DictReader(open(D / n, encoding="utf-8-sig"), delimiter=";"))
def quartil(v, p):
    s = sorted(v); pos = (len(s) - 1) * p; lo = math.floor(pos); hi = math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo)
dic = le("dicionario_colunas.csv")
descr = {(r["arquivo"], r["coluna"]): r["descricao"] for r in dic}
ok = True
def falha(msg):
    global ok; ok = False; print("FALHA:", msg)
ARQ = {  # arquivo -> (indicador, ano, etapa, componente, grupo_regiao|None, nome do dicionário)
    "gastos_despesa_mat_2022_nominal.csv": ("edu.despesa.aplicacao_direta_por_matricula", 2022, None, "nominal", None),
    "gastos_despesa_hab_2023_nominal.csv": ("edu.despesa.por_habitante", 2023, None, "nominal", None),
    "gastos_despesa_hab_2021_real.csv": ("edu.despesa.por_habitante", 2021, None, "real_2025", None),
    "resultados_ideb_2022_anos_finais.csv": ("edu.ideb.rede_municipal", 2021, "anos_finais", "ideb", None),
    "resultados_saeb_2023_ai_portugues.csv": ("edu.saeb.rede_municipal", 2023, "anos_iniciais", "portugues", None),
    "atendimento_atu_2024_creche.csv": ("edu.atu.rede_municipal", 2024, "creche", None, None),
    "comparar_despesa_hab_2023_NE.csv": ("edu.despesa.por_habitante", 2023, None, "nominal", "NE"),
}
for arq, (ind, ano, et, comp, reg) in ARQ.items():
    rows = le(arq)
    cols = list(rows[0].keys())
    univ = [c for c in CAPS.values() if reg is None or c["regiao"] == reg]
    if len(rows) != len(univ): falha(f"{arq}: {len(rows)} linhas, esperado {len(univ)}")
    inc = []
    for r in rows:
        cod = int(r["codigo_ibge"]); o = OBS[(ind, cod, ano, et, comp)]
        elig = o["status"] == "OBSERVADO" and o["valor"] is not None and o["elegivel_comparacao"]
        if (r["incluida_na_comparacao"] == "sim") != elig: falha(f"{arq} {r['capital']}: inclusão diverge da gold")
        if elig:
            inc.append(float(r["valor_numerico"]))
            if abs(float(r["valor_numerico"]) - o["valor"]) > 1e-6 * max(1, abs(o["valor"])): falha(f"{arq} {r['capital']}: valor")
        elif o["status"] == "OBSERVADO" and o["valor"] is not None:
            if r["valor_numerico"] == "": falha(f"{arq} {r['capital']}: valor oficial disponível mas vazio (fora da comparação)")
            if r["elegivel_comparacao"] != "nao": falha(f"{arq} {r['capital']}: elegível?")
        else:
            if r["valor_numerico"] not in ("",): falha(f"{arq} {r['capital']}: sem valor na gold mas CSV tem {r['valor_numerico']}")
            if r["valor_numerico"] == "0": falha("ausência virou zero")
        if not elig and not r["motivo_exclusao"]: falha(f"{arq} {r['capital']}: exclusão sem motivo")
    st = rows[0]
    if inc:
        checks = {"mediana_das_incluidas": statistics.median(inc), "media_simples_das_incluidas": statistics.mean(inc), "minimo_das_incluidas": min(inc), "maximo_das_incluidas": max(inc)}
        if len(inc) >= 8: checks.update(primeiro_quartil=quartil(inc, .25), terceiro_quartil=quartil(inc, .75))
        for k, v in checks.items():
            if abs(float(st[k]) - v) > 1e-6 * max(1, abs(v)): falha(f"{arq}: {k} {st[k]} x {v}")
        if int(st["capitais_incluidas"]) != len(inc): falha(f"{arq}: capitais_incluidas")
    sem_desc = [c for c in cols if not descr.get(("comparação de um indicador", c))]
    if sem_desc: falha(f"{arq}: colunas sem descrição no dicionário: {sem_desc}")
    if {r["hash_dados"] for r in rows} != {G["meta"]["hash_dados"]}: falha(f"{arq}: hash_dados")
    if {r["dados_gerados_em"] for r in rows} != {G["meta"]["gerado_em"]}: falha(f"{arq}: dados_gerados_em")
    print(f"{arq}: {len(rows)} linhas, {len(inc)} incluídas, {len(cols)} colunas, mediana CSV {st['mediana_das_incluidas']}")
# série
ev = le("evolucao_recife_despesa_hab.csv"); print("evolução:", len(ev), list(ev[0].keys()))
for r in ev:
    o = OBS[("edu.despesa.por_habitante", 2611606, int(r["ano"]), None, "nominal")]
    if abs(float(r["valor_numerico"]) - o["valor"]) > 1e-6 * o["valor"]: falha("série Recife " + r["ano"])
    print(r["ano"], r["valor_exibido"], r["elegivel_comparacao"], "mudanca_de_base=", r["mudanca_de_base"], "mediana=", r["mediana_das_capitais"], r["capitais_na_mediana"])
sem = [c for c in ev[0].keys() if not descr.get(("série ao longo dos anos", c))]
if sem: falha(f"série: colunas sem descrição {sem}")
# tabela comparativa
tc = le("comparar_tabela_completa_2023.csv"); print("tabela comparativa:", len(tc), "linhas", list(tc[0].keys()))
sem = [c for c in tc[0].keys() if not descr.get(("tabela comparativa", c))]
if sem: falha(f"tabela comparativa: colunas sem descrição {sem}")
print("TODOS OS CONFERIDOS" if ok else "HÁ FALHAS")
