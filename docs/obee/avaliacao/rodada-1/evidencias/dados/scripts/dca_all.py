import json,urllib.request,sys
from lib import *
def get(u):
    for i in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"aval"}),timeout=90))
        except Exception as e: err=e
    raise err
res=[];bad=0
for c in CAPS:
    for ano in range(2021,2026):
        u=f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio={ano}&no_anexo=DCA-Anexo%20I-E&id_ente={c['cod_ibge']}"
        j=get(u); its=j["items"]
        while j.get("hasMore"):
            j=get(u+f"&offset={len(its)}"); its+=j["items"]
        v=[i["valor"] for i in its if i["conta"]=="12 - Educação" and i["coluna"]=="Despesas Liquidadas"]
        g=OBS[("edu.despesa.funcao_educacao",c['cod_ibge'],ano,None,"nominal")]["valor"]
        ok=len(v)==1 and abs(v[0]-g)<0.01
        if not ok: bad+=1
        res.append((c['nome'],ano,v,g,ok))
        print(c['nome'],ano,v,g,"ok" if ok else "DIVERGE",flush=True)
json.dump(res,open("dca_all.json","w"),ensure_ascii=False)
print("TOTAL",len(res),"divergências",bad)
