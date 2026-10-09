#!/usr/bin/env python3
"""Append PNAD annual inequality and declared social-program receipt; no administrative claims."""
import json,urllib.request,pathlib,datetime,hashlib,gzip
OUT=pathlib.Path(__file__).resolve().parents[2]/'public/eficiencia/trabalho-renda'
def fetch(url):
 raw=urllib.request.urlopen(url,timeout=90).read();return gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw
s=json.loads((OUT/'snapshot.json').read_text());now=datetime.datetime.now(datetime.timezone.utc).isoformat()
JOBS=[('pnad-gini',7435,'/n1/all/n3/all/v/10681,10682/p/all'),('pnad-programas',7457,'/n1/all/n3/all/v/9784,9785/p/all/c1035/49238,49239,82225')]
for key,table,path in JOBS:
 url=f'https://apisidra.ibge.gov.br/values/t/{table}{path}';raw=fetch(url);rows=json.loads(raw);meta=json.loads(fetch(f'https://servicodados.ibge.gov.br/api/v3/agregados/{table}/metadados'))
 (OUT/'brutos'/f'{key}.json').write_bytes(raw);(OUT/'brutos'/f'{key}-metadados.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 limit=['Estimativas da PNAD Contínua anual; domicílios segundo declaração do entrevistado, não cadastros de beneficiários.','Programas podem coexistir no mesmo domicílio. Não somar Bolsa Família e BPC para obter domicílios únicos.','Mudanças na coleta durante a pandemia: os anos 2020 a 2022 usam a quinta visita em lugar da primeira; consultar documentação da divulgação anual.'] if table==7457 else ['Índice entre 0 e 1, com maior valor indicando maior desigualdade da renda domiciliar per capita; não mede pobreza nem renda absoluta.','Estimativa amostral revisável; anos da pandemia devem ser lidos à luz das notas de coleta da PNAD anual.']
 source={'id':key,'nome':f'IBGE · PNAD Contínua anual · tabela {table}','url':meta['URL'],'consulta':url,'periodo':meta['periodicidade'],'universo':meta['nome'],'limitacoes':limit,'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':f'/eficiencia/trabalho-renda/brutos/{key}.json'}
 s['fontes']=[f for f in s['fontes'] if f['id']!=key]+[source]
 conf={'gini':('Índice de Gini da renda domiciliar per capita','índice',None)} if table==7435 else {'domicilios-bolsa-familia':('Domicílios com recebimento de Bolsa Família','%', '49238'),'domicilios-bpc':('Domicílios com recebimento de BPC','%','49239'),'domicilios-programas-sociais':('Domicílios com recebimento de programa social','%','82225')}
 for id,(name,unit,category) in conf.items():
  s['indicadores']=[i for i in s['indicadores'] if i['id']!=id];s['observacoes']=[o for o in s['observacoes'] if o['indicadorId']!=id]
  s['indicadores'].append({'id':id,'nome':name,'unidade':unit,'fonteId':key,'universo':('Domicílios em que algum morador declarou receber o programa / total de domicílios.' if table==7457 else 'Distribuição do rendimento domiciliar per capita na PNAD anual.'),'limitacao':limit[0]})
  for row in rows[1:]:
   if row['D2C'] not in ['10681','9784'] or (category and row['D4C']!=category):continue
   cv=next((r for r in rows[1:] if r['D1C']==row['D1C'] and r['D3C']==row['D3C'] and r['D2C'] in ['10682','9785'] and (not category or r['D4C']==category)),None)
   val=0.0 if row['V']=='-' else (None if row['V'] in ['...','..','X'] else float(row['V']))
   cvval=float(cv['V']) if cv and cv['V'] not in ['...','..','X','-'] else None
   s['observacoes'].append({'indicadorId':id,'territorioId':row['D1C'],'periodo':row['D3C'],'periodoNome':row['D3N'],'valor':val,'sexo':'total','grupo':'Total','status':'observado' if val is not None else 'ausente','cv':cvval,'fonteId':key})
 print(key,len(rows)-1)
(OUT/'snapshot.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
