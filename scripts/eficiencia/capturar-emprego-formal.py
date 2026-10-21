#!/usr/bin/env python3
"""Append fresh national Novo Caged stock, republished by BCB; no stale UF fallback."""
import json,urllib.request,pathlib,datetime,hashlib
OUT=pathlib.Path(__file__).resolve().parents[2]/'public/eficiencia/trabalho-renda'
url='https://api.bcb.gov.br/dados/serie/bcdata.sgs.28763/dados?formato=json&dataInicial=01/08/2023&dataFinal='+datetime.date.today().strftime('%d/%m/%Y')
raw=urllib.request.urlopen(url,timeout=60).read();rows=json.loads(raw)
(OUT/'brutos'/'caged-sgs.json').write_bytes(raw)
s=json.loads((OUT/'snapshot.json').read_text());now=datetime.datetime.now(datetime.timezone.utc).isoformat();monthnames=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
series=sorted([(r['data'][6:10]+'-'+r['data'][3:5],float(r['valor'])) for r in rows])
source={'id':'caged-sgs','nome':'MTE · Novo Caged, republicado pelo Banco Central · SGS 28763','url':'https://www3.bcb.gov.br/sgspub/','consulta':url,'periodo':{'frequencia':'mensal','inicio':int(series[1][0].replace('-','')),'fim':int(series[-1][0].replace('-',''))},'universo':'Vínculos formais celetistas ativos nos estabelecimentos; Brasil; estoque sem ajuste sazonal.','limitacoes':['Vínculos não são pessoas: uma pessoa pode ter mais de um vínculo. Localização do estabelecimento, não residência do trabalhador.','Novo Caged é revisável; o último mês é preliminar. Não cobre informais nem todos os regimes estatutários.','Saldo calculado pela variação entre estoques consecutivos, na mesma captura. Corte nacional; não atribuir a municípios ou UFs.'],'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':'/eficiencia/trabalho-renda/brutos/caged-sgs.json'}
s['fontes']=[f for f in s['fontes'] if f['id']!='caged-sgs']+[source]
ids=['estoque-formal','saldo-formal'];s['indicadores']=[i for i in s['indicadores'] if i['id'] not in ids];s['observacoes']=[o for o in s['observacoes'] if o['indicadorId'] not in ids]
for id,name in [('estoque-formal','Estoque de vínculos formais'),('saldo-formal','Variação mensal do estoque formal')]:
 universe=source['universo'];limitation='Registro administrativo revisável; último mês preliminar. Vínculos não equivalem a trabalhadores únicos.'
 if id=='saldo-formal':
  universe='Diferença entre os estoques nacionais de vínculos formais dos meses consecutivos t e t−1, na mesma captura da série SGS 28763, sem ajuste sazonal.'
  limitation='Calculado como estoque(t) − estoque(t−1). Não equivale necessariamente ao saldo oficial de admissões menos desligamentos: revisões, ajustes e mudanças da base de estoque podem produzir diferenças. Último mês preliminar.'
 s['indicadores'].append({'id':id,'nome':name,'unidade':'vínculos','fonteId':'caged-sgs','universo':universe,'limitacao':limitation})
 for index,(period,value) in enumerate(series):
  if index==0:continue
  nameperiod=f'{monthnames[int(period[5:])-1]} de {period[:4]}'
  s['observacoes'].append({'indicadorId':id,'territorioId':'1','periodo':period,'periodoNome':nameperiod,'valor':value if id=='estoque-formal' else value-series[index-1][1],'sexo':'total','grupo':'Total','status':'observado','cv':None,'fonteId':'caged-sgs'})
for f in s['fontes']:
 if f['id']=='pnad-rendimento':f['documentacao']=['https://ftp.ibge.gov.br/Trabalho_e_Rendimento/Pesquisa_Nacional_por_Amostra_de_Domicilios_continua/Trimestral/Microdados/Documentacao/PNADcIBGE_Deflator_Trimestral.pdf']
(OUT/'snapshot.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
print('Formal:',len(series)-1,'meses',series[-1])
