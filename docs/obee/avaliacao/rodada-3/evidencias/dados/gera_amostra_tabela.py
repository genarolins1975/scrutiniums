import json
B = "/eficiencia-estatal/educacao-municipal-capitais"
out = []
def u(rota, **kw):
    q = "&".join(f"{k}={v}" for k, v in kw.items() if v not in ("", None))
    return f"{B}{rota}?{q}"
for med in ["despesa", "despesa_hab", "despesa_mat"]:
    for ano in [2021, 2023, 2025]:
        for cap in ["", "campo-grande", "recife"]:
            out.append({"id": f"TS|G|{med}|{ano}|{cap}", "url": u("/gastos", med=med, ano=ano, vis="tabela", cap=cap), "csv": True})
for med, ets in [("matriculas", ["total", "creche", "anos_finais"]), ("atu", ["creche", "anos_finais"]), ("conveniadas", ["total", "pre_escola"])]:
    for et in ets:
        for ano in [2022, 2025]:
            out.append({"id": f"TS|A|{med}|{ano}|{et}", "url": u("/atendimento", med=med, ano=ano, etapa=et, vis="tabela"), "csv": True})
for med, ets, anos in [("aprovacao", ["anos_iniciais", "anos_finais"], [2021, 2025]), ("ideb", ["anos_iniciais", "anos_finais"], [2013, 2017, 2025]), ("saeb", ["anos_iniciais", "anos_finais"], [2021, 2025])]:
    for et in ets:
        for ano in anos:
            out.append({"id": f"TS|R|{med}|{ano}|{et}", "url": u("/resultados", med=med, ano=ano, etapa=et, vis="tabela", disc="portugues" if med == "saeb" else ""), "csv": True})
json.dump(out, open("amostra_tabela_simples.json", "w"), ensure_ascii=False)
print(len(out))
