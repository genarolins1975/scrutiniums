#!/usr/bin/env python3
"""Census2022 occupational income and PNAD annual hours with explicit unit discrepancy."""
import json,urllib.request,pathlib,datetime,hashlib,gzip
OUT=pathlib.Path(__file__).resolve().parents[2]/'public/eficiencia/trabalho-renda'
def fetch(url):
 raw=urllib.request.urlopen(url,timeout=90).read();return gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw
s=json.loads((OUT/'snapshot.json').read_text());now=datetime.datetime.now(datetime.timezone.utc).isoformat()
JOBS=[('censo-ocupacoes',10282,'/n1/all/n3/all/v/13535,13536,13537/p/2022/c2/all/c86/95251/c12064/all'),('pnad-jornada',10370,'/n1/all/n3/all/v/8190,8191/p/all/c58/all')]
for key,table,path in JOBS:
 url=f'https://apisidra.ibge.gov.br/values/t/{table}{path}';raw=fetch(url);rows=json.loads(raw);meta=json.loads(fetch(f'https://servicodados.ibge.gov.br/api/v3/agregados/{table}/metadados'))
 if not isinstance(rows,list) or len(rows)<2:raise ValueError('Invalid official response')
 (OUT/'brutos'/f'{key}.json').write_bytes(raw);(OUT/'brutos'/f'{key}-metadados.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 limit=['Censo 2022, resultados preliminares da amostra, semana de 25 a 31 de julho de 2022. Valores nominais, sem correção monetária.','Ocupação é classificada pelo trabalho principal; renda se refere a todos os trabalhos.','Quantidade é de pessoas ocupadas COM rendimento de trabalho, não todos os ocupados, nem postos formais; Brasil eUF nesta captura.'] if table==10282 else ['Média de horas habitualmente trabalhadas por semana em todos os trabalhos; pessoas de 14 anos ou mais. Não corresponde a percentual da população nem à jornada legal.','Divergência de unidade na origem: campo MN e metadados da API registram %, enquanto título e nome da variável identificam média de horas. Unidade apresentada como horas/semana conforme definição textual da fonte; dados originais preservados.','Tabela não contém os anos 2020, 2021 e 2022 nesta captura; lacunas preservadas, sem interpolação.']
 source={'id':key,'nome':f'IBGE · {meta["pesquisa"]} · tabela {table}','url':meta['URL'],'consulta':url,'periodo':meta['periodicidade'],'universo':meta['nome'],'limitacoes':limit,'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':f'/eficiencia/trabalho-renda/brutos/{key}.json'}
 s['fontes']=[f for f in s['fontes'] if f['id']!=key]+[source]
 conf={13535:('ocupacoes-pessoas','Pessoas ocupadas com rendimento por ocupação','pessoas'),13536:('ocupacoes-renda-media','Renda média de todos os trabalhos por ocupação','R$'),13537:('ocupacoes-renda-mediana','Renda mediana de todos os trabalhos por ocupação','R$')} if table==10282 else {8190:('jornada-habitual','Jornada semanal habitual em todos os trabalhos','horas/semana')}
 for variable,(id,name,unit) in conf.items():
  s['indicadores']=[i for i in s['indicadores'] if i['id']!=id];s['observacoes']=[o for o in s['observacoes'] if o['indicadorId']!=id]
  universe=meta['nome'];indicator_limit=limit[0]+(' '+limit[1] if table==10370 else '')
  if id=='ocupacoes-pessoas':
   universe='Pessoas de 14 anos ou mais, ocupadas na semana de referência e com rendimento de trabalho, classificadas pela ocupação no trabalho principal.'
   indicator_limit='Censo 2022, resultados preliminares da amostra. Quantidade de pessoas ocupadas com rendimento; não corresponde a todos os ocupados nem a vínculos de emprego. Referência: semana de 25 a 31 de julho de 2022.'
  s['indicadores'].append({'id':id,'nome':name,'unidade':unit,'fonteId':key,'universo':universe,'limitacao':indicator_limit})
  lookup={(r['D1C'],r['D3C'],r.get('D4C','Total'),r['D2C']):r['V'] for r in rows[1:]}
  for row in rows[1:]:
   if row['D2C']!=str(variable):continue
   val=0.0 if row['V']=='-' else (None if row['V'] in ['...','..','X'] else float(row['V']))
   c=lookup.get((row['D1C'],row['D3C'],row.get('D4C','Total'),'8191')) if table==10370 else None;cv=0.0 if c=='-' else (None if c in [None,'...','..','X'] else float(c))
   sex={'6794':'total','4':'homens','5':'mulheres'}[row['D4C']] if table==10282 else 'total'
   s['observacoes'].append({'indicadorId':id,'territorioId':row['D1C'],'periodo':row['D3C'],'periodoNome':row['D3N'],'valor':val,'sexo':sex,'grupo':row['D6N'] if table==10282 else row['D4N'],'status':'observado' if val is not None else 'ausente','cv':cv,'fonteId':key})
 print(key,len(rows)-1)
(OUT/'snapshot.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
