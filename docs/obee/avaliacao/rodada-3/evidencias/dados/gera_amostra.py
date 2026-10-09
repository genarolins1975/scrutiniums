#!/usr/bin/env python3
"""Gera a lista de URLs da amostra estratificada (avaliador de dados, rodada 3). Saída: amostra_<nome>.json"""
import json, itertools, sys, os
B = "/eficiencia-estatal/educacao-municipal-capitais"
OUT = os.path.dirname(os.path.abspath(__file__))
CAPS_G = ["", "recife", "campo-grande", "boa-vista", "macapa", "porto-alegre", "sao-paulo", "palmas", "vitoria"]
def u(rota, **kw):
    q = "&".join(f"{k}={v}" for k, v in kw.items() if v not in ("", None))
    return f"{B}{rota}" + (f"?{q}" if q else "")
lotes = {}
# A. gastos: gráfico + CSV
A = []
for med in ["despesa", "despesa_hab", "despesa_mat"]:
    for ano in range(2021, 2026):
        for moeda in ["nominal", "real"]:
            for cap in CAPS_G:
                for grp in (["todas", "regiao"] if cap else ["todas"]):
                    A.append({"id": f"G|{med}|{ano}|{moeda}|{cap}|{grp}", "url": u("/gastos", med=med, ano=ano, moeda=moeda, cap=cap, grp=grp if grp == "regiao" else ""), "csv": True})
lotes["gastos"] = A
# B. gastos: tabela simples e evolução (sem CSV extra)
Bt = []
for med in ["despesa", "despesa_hab", "despesa_mat"]:
    for moeda in ["nominal", "real"]:
        for cap in CAPS_G:
            Bt.append({"id": f"GE|{med}|{moeda}|{cap}", "url": u("/gastos", med=med, moeda=moeda, cap=cap, vis="evolucao"), "csv": True, "csvBotoes": ["Baixar esta série \\(CSV\\)"]})
lotes["gastos_evolucao"] = Bt
# C. atendimento
C = []
et_mat = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"]
for med, ets in [("matriculas", et_mat), ("conveniadas", et_mat), ("atu", ["creche", "pre_escola", "anos_iniciais", "anos_finais"])]:
    for ano in range(2021, 2026):
        for et in ets:
            for cap in ["", "recife", "rio-branco", "sao-paulo", "palmas"]:
                C.append({"id": f"A|{med}|{ano}|{et}||{cap}", "url": u("/atendimento", med=med, ano=ano, etapa=et, cap=cap), "csv": True})
lotes["atendimento"] = C
# D. resultados
D = []
for ano in range(2021, 2026):
    for et in ["anos_iniciais", "anos_finais"]:
        for cap in ["", "recife", "natal", "sao-paulo", "boa-vista"]:
            D.append({"id": f"R|aprovacao|{ano}|{et}||{cap}", "url": u("/resultados", med="aprovacao", ano=ano, etapa=et, cap=cap), "csv": True})
for med in ["ideb", "saeb"]:
    for ano in range(2005, 2026):
        for et in ["anos_iniciais", "anos_finais"]:
            for disc in (["matematica", "portugues"] if med == "saeb" else [""]):
                for cap in ["", "recife", "natal", "sao-paulo"]:
                    if ano % 2 == 0 and cap not in ("", "recife"): continue
                    D.append({"id": f"R|{med}|{ano}|{et}|{disc}|{cap}", "url": u("/resultados", med=med, ano=ano, etapa=et, disc=disc, cap=cap), "csv": True})
lotes["resultados"] = D
# E. comparar: tabela completa
E = []
for ano in range(2021, 2026):
    for et in ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio"]:
        for moeda in ["nominal", "real"]:
            for reg in ["", "NE"]:
                E.append({"id": f"C|tab|{ano}|{et}|{moeda}|{reg}", "url": u("/comparar", vis="tabela", ano=ano, etapa=et, moeda=moeda, reg=reg, med="despesa_hab"), "csv": True, "csvBotoes": ["Baixar esta tabela \\(CSV\\)"]})
# ano par com ideb/saeb na tabela completa
for ano in (2024, 2022, 2020):
    for et in ["anos_iniciais", "anos_finais"]:
        E.append({"id": f"C|tab|{ano}|{et}|nominal|", "url": u("/comparar", vis="tabela", ano=ano, etapa=et, med="ideb"), "csv": True, "csvBotoes": ["Baixar esta tabela \\(CSV\\)"]})
lotes["comparar_tabela"] = E
# F. comparar: gráfico, todos os indicadores
F = []
for med, anos, ets in [("despesa", range(2021, 2026), [""]), ("despesa_hab", range(2021, 2026), [""]), ("despesa_mat", range(2021, 2026), [""]),
                       ("matriculas", range(2021, 2026), et_mat), ("conveniadas", range(2021, 2026), et_mat), ("atu", range(2021, 2026), ["creche", "pre_escola", "anos_iniciais", "anos_finais"]),
                       ("aprovacao", range(2021, 2026), ["anos_iniciais", "anos_finais"]), ("ideb", range(2019, 2026), ["anos_iniciais", "anos_finais"]), ("saeb", range(2019, 2026), ["anos_iniciais", "anos_finais"])]:
    for ano in anos:
        for et in ets:
            for reg in ["", "S"]:
                F.append({"id": f"CG|{med}|{ano}|{et}||{reg}", "url": u("/comparar", med=med, ano=ano, etapa=et, reg=reg), "csv": True})
lotes["comparar_grafico"] = F
for k, v in lotes.items():
    json.dump(v, open(f"{OUT}/amostra_{k}.json", "w"), ensure_ascii=False)
    print(k, len(v))
