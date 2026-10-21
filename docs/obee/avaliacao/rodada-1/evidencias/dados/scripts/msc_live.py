import json,urllib.request
from lib import *
def get(u):
    for i in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"aval"}),timeout=120))
        except Exception as e: err=e
    raise err
out=[]
for cap,ano in [("rio-branco",2024),("palmas",2023),("recife",2025),("natal",2025),("boa-vista",2024),("porto-alegre",2021)]:
    cod=BYID[cap]['cod_ibge']
    u=f"https://apidatalake.tesouro.gov.br/ords/siconfi/tt/msc_orcamentaria?id_ente={cod}&an_referencia={ano}&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance"
    j=get(u); its=j['items']
    while j.get('hasMore'): j=get(u+f"&offset={len(its)}"); its+=j['items']
    num=tot=0.0
    for x in its:
        if str(x['funcao'])!='12' or str(x['conta_contabil'])[:7] not in('6221303','6221304','6221307'): continue
        v=x['valor'] if x['natureza_conta']=='C' else -x['valor']; nd=str(x.get('natureza_despesa') or ''); mod=nd[2:4]
        if mod=='91': continue
        tot+=v
        if mod in('90','93','94') and str(x['subfuncao'])!='364' and not (nd[:2]=='31' and nd[4:6] in('01','03','05')): num+=v
    g=OBS[('edu.despesa.aplicacao_direta_por_matricula',cod,ano,None,'nominal')]
    gn=g.get('calculo',{}).get('numerador'); d=OBS[('edu.despesa.funcao_educacao',cod,ano,None,'nominal')]['valor']
    out.append((cap,ano,len(its),round(num,2),gn,round(tot,2),d))
    print(cap,ano,'linhas',len(its),'numerador ao vivo',round(num,2),'gold',gn,'| MSC sem intra',round(tot,2),'DCA',d,flush=True)
