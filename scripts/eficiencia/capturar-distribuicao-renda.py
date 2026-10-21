#!/usr/bin/env python3
"""Annual household-income mean and exhaustive, non-overlapping decile groups."""
import json,urllib.request,pathlib,datetime,hashlib,gzip
OUT=pathlib.Path(__file__).resolve().parents[2]/'public/eficiencia/trabalho-renda'
def fetch(url):
 raw=urllib.request.urlopen(url,timeout=90).read();return gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw
s=json.loads((OUT/'snapshot.json').read_text());now=datetime.datetime.now(datetime.timezone.utc).isoformat()
JOBS=[('pnad-deciles',7533,'/n1/all/n3/all/v/10816,10817/p/all/c1019/49243,49246,49247,49248,49249,49250,49251,49252,49253,49254,49255','renda-por-decil','Renda média por faixa da distribuição')]
for key,table,path,id,name in JOBS:
 url=f'https://apisidra.ibge.gov.br/values/t/{table}{path}';raw=fetch(url);rows=json.loads(raw);meta=json.loads(fetch(f'https://servicodados.ibge.gov.br/api/v3/agregados/{table}/metadados'))
 (OUT/'brutos'/f'{key}.json').write_bytes(raw);(OUT/'brutos'/f'{key}-metadados.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 limit=['Renda domiciliar per capita de todas as fontes; não equivale ao rendimento individual do trabalho.','Estimativa amostral anual, revisável. Valores reais a preços médios do último ano divulgado (2025 nesta captura).','Anos 2020 a 2022 utilizam quinta visita em lugar da primeira; ler notas da divulgação anual.']
 if table==7533:limit+=['Grupos são intervalos de percentis disjuntos, cada um com aproximadamente 10% das pessoas. Cada valor é a renda média dentro da faixa, não o limite superior do percentil.','Não somar as médias para obter renda total. Não confundir comparação de médias por decil com histograma de contagens.']
 source={'id':key,'nome':f'IBGE · PNAD Contínua anual · tabela {table}','url':meta['URL'],'consulta':url,'periodo':meta['periodicidade'],'universo':meta['nome'],'limitacoes':limit,'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':f'/eficiencia/trabalho-renda/brutos/{key}.json'}
 source['limitacoes']=[l.replace('(2025 nesta captura)',f'({meta["periodicidade"]["fim"]} nesta captura)') for l in source['limitacoes']]
 s['fontes']=[f for f in s['fontes'] if f['id']!=key]+[source];s['indicadores']=[i for i in s['indicadores'] if i['id']!=id];s['observacoes']=[o for o in s['observacoes'] if o['indicadorId']!=id]
 s['indicadores'].append({'id':id,'nome':name,'unidade':'R$','fonteId':key,'universo':meta['nome'],'limitacao':'Valores reais a preços médios de 2025. Conceito domiciliar per capita de todas as fontes.'})
 valuevar='4196' if table==7395 else '10816';cvvar='4197' if table==7395 else '10817'
 lookup={(r['D1C'],r['D3C'],r.get('D4C','Total'),r['D2C']):r['V'] for r in rows[1:]}
 for row in rows[1:]:
  if row['D2C']!=valuevar:continue
  val=0.0 if row['V']=='-' else (None if row['V'] in ['...','..','X'] else float(row['V']));c=lookup.get((row['D1C'],row['D3C'],row.get('D4C','Total'),cvvar));cv=0.0 if c=='-' else (None if c in [None,'...','..','X'] else float(c))
  s['observacoes'].append({'indicadorId':id,'territorioId':row['D1C'],'periodo':row['D3C'],'periodoNome':row['D3N'],'valor':val,'sexo':'total','grupo':row.get('D4N','Total'),'status':'observado' if val is not None else 'ausente','cv':cv,'fonteId':key})
 print(key,len(rows)-1)
s['fontes']=[f for f in s['fontes'] if f['id']!='pnad-renda-domiciliar']
s['observacoes']=[o for o in s['observacoes'] if o['indicadorId']!='renda-domiciliar-real']
s['indicadores']=[i for i in s['indicadores'] if i['id']!='renda-domiciliar-real']
s['indicadores'].append({'id':'renda-domiciliar-real','nome':'Renda domiciliar per capita real','unidade':'R$','fonteId':'pnad-deciles','universo':'Rendimento domiciliar per capita de todas as fontes, total da tabela 7533, mesmo universo das faixas de distribuição.','limitacao':'Valores reais a preços médios de 2025; não equivale ao salário individual nem à renda nominal do Censo 2022.'})
s['observacoes'] += [{**o,'indicadorId':'renda-domiciliar-real'} for o in s['observacoes'] if o['indicadorId']=='renda-por-decil' and o['grupo']=='Total']
(OUT/'snapshot.json').write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
