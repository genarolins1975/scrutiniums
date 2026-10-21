"""Verificação externa: busca DCA (Siconfi/Tesouro) e população (IBGE SIDRA) direto nas APIs e compara com a gold."""
import json, urllib.request, urllib.parse, sys
R="/home/user/scrutiniums"
G=json.load(open(f"{R}/public/eficiencia/gold/educacao_capitais.json"))
obs={(o["indicador"],o["ente"],o["ano"],o["etapa"],o["componente"]):o for o in G["observacoes"]}
amostra={"São Paulo":3550308,"Palmas":1721000,"Recife":2611606,"Boa Vista":1400100,"Campo Grande":5002704,"Porto Alegre":4314902,"Belém":1501402}
def get(u):
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"aval"}),timeout=60))
        except Exception as e:
            err=e
    raise err
out=[]
for nome,cod in amostra.items():
    for ano in (2021,2023,2024,2025):
        u=f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={ano}&no_anexo=DCA-Anexo%20I-E&id_ente={cod}"
        try:
            j=get(u)
        except Exception as e:
            out.append((nome,ano,"erro",str(e)[:80])); continue
        its=j["items"]
        # paginação
        while j.get("hasMore"):
            off=len(its); j=get(u+f"&offset={off}"); its+=j["items"]
        v=[i for i in its if i["conta"]=="12 - Educação" and i["coluna"]=="Despesas Liquidadas"]
        g=obs[("edu.despesa.funcao_educacao",cod,ano,None,"nominal")]["valor"]
        out.append((nome,ano,"DCA liquidada função 12",[x["valor"] for x in v],g, "confere" if len(v)==1 and abs(v[0]["valor"]-g)<0.01 else "DIVERGE"))
for nome,cod in amostra.items():
    j=get(f"https://apisidra.ibge.gov.br/values/t/6579/n6/{cod}/v/9324/p/2021,2024,2025")
    for r in j[1:]:
        ano=int(r["D3C"]); g=obs[("ctx.populacao.residente",cod,ano,None,None)]["valor"]
        out.append((nome,ano,"pop SIDRA 6579",int(r["V"]),g,"confere" if int(r["V"])==g else "DIVERGE"))
    j=get(f"https://apisidra.ibge.gov.br/values/t/4714/n6/{cod}/v/93/p/2022")
    for r in j[1:]:
        g22=obs[("ctx.populacao.residente",cod,2022,None,None)]["valor"]; g23=obs[("ctx.populacao.residente",cod,2023,None,None)]["valor"]
        out.append((nome,2022,"pop Censo 4714",int(r["V"]),(g22,g23),"confere" if int(r["V"])==g22==g23 else "DIVERGE"))
j=get("https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/202412|202512|202101/variaveis/2266?localidades=N1[all]")
out.append(("IPCA",None,"n.indice 2021-01,2024-12,2025-12",j[0]["resultados"][0]["series"][0]["serie"],None,""))
json.dump(out,open("externo_saida.json","w"),ensure_ascii=False,indent=1)
for o in out: print(o)
