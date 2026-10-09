#!/usr/bin/env python3
"""Capture official SIDRA responses. Never substitutes missing values or mixes universes."""
import json,urllib.request,hashlib,datetime,pathlib,concurrent.futures,gzip
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/eficiencia/trabalho-renda'; OUT.mkdir(parents=True,exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
JOBS=[
 ('pnad-trabalho',4093,'/n1/all/n3/all/v/4099,4103,4096,4100,4097,4101,12466,12467/p/last%2016/c2/all'),
 ('pnad-rendimento',5436,'/n1/all/n3/all/v/5933,5941/p/last%2016/c2/all'),
 ('pnad-subutilizacao',4099,'/n1/all/n3/all/v/4118,4119/p/last%2016'),
 ('censo-renda',10295,'/n1/all/n3/all/n6/all/v/13431,13534/p/2022/c2/6794/c86/95251/c58/95253'),
 ('censo-renda-sexo',10295,'/n1/all/n3/all/v/13431,13534/p/2022/c2/4,5/c86/95251/c58/95253'),
 ('censo-renda-raca',10295,'/n1/all/n3/all/v/13431,13534/p/2022/c2/6794/c86/2776,2777,2778,2779,2780/c58/95253'),
]
CONFIG={4099:('desocupacao','Taxa de desocupação','%',4103,'Pessoas desocupadas / pessoas na força de trabalho, com 14 anos ou mais.'),4096:('participacao','Participação na força de trabalho','%',4100,'Pessoas na força de trabalho / pessoas de 14 anos ou mais.'),4097:('ocupacao','Nível de ocupação','%',4101,'Pessoas ocupadas / pessoas de 14 anos ou mais.'),12466:('informalidade','Taxa de informalidade','%',12467,'Pessoas ocupadas em situação de informalidade / pessoas ocupadas, com 14 anos ou mais.'),5933:('rendimento-trabalho','Rendimento real habitual do trabalho','R$',5941,'Pessoas de 14 anos ou mais ocupadas, com rendimento de trabalho; todos os trabalhos.'),4118:('subutilizacao','Subutilização da força de trabalho','%',4119,'Pessoas desocupadas, subocupadas por insuficiência de horas e força de trabalho potencial / força de trabalho ampliada.'),13431:('renda-media','Renda domiciliar per capita média','R$',None,'Moradores em domicílios particulares permanentes ocupados, excluídos pensionistas, empregados domésticos e seus parentes.'),13534:('renda-mediana','Renda domiciliar per capita mediana','R$',None,'Moradores em domicílios particulares permanentes ocupados, excluídos pensionistas, empregados domésticos e seus parentes.')}
def number(v):
 if v == '-':return 0.0  # SIDRA: zero absoluto, preservado também no bruto.
 if v in ['...','..','X',''] :return None
 return float(v.replace(',','.'))
def fetch(url):
 raw=urllib.request.urlopen(url,timeout=120).read()
 return gzip.decompress(raw) if raw[:2]==b"\x1f\x8b" else raw
def grab(job):
 key,table,path=job;url=f'https://apisidra.ibge.gov.br/values/t/{table}{path}'
 req=urllib.request.Request(url,headers={'User-Agent':'Scrutiniums OBEE reproducible capture'})
 raw=fetch(req);rows=json.loads(raw)
 if not isinstance(rows,list) or len(rows)<2:raise ValueError(f'{key}: empty or API error {raw[:200]}')
 (OUT/'brutos'/f'{key}.json').write_bytes(raw)
 meta=json.loads(fetch(f'https://servicodados.ibge.gov.br/api/v3/agregados/{table}/metadados'))
 (OUT/'brutos'/f'{key}-metadados.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
 return key,table,url,rows,meta,hashlib.sha256(raw).hexdigest()
UF_SIGLAS={'11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'}
territories={};observations=[];sources=[];indicators={}
for key,table,url,rows,meta,sha in concurrent.futures.ThreadPoolExecutor(4).map(grab,JOBS):
 header=rows[0]
 variable=next(k[:-1] for k,v in header.items() if v=='Variável (Código)');period=next(k[:-1] for k,v in header.items() if v.endswith('(Código)') and ('Trimestre' in v or 'Ano' in v))
 dimensions={v.split(' (Código)')[0]:k[:-1] for k,v in header.items() if v.endswith('(Código)')}
 sources.append({'id':key,'nome':f'IBGE · {meta["pesquisa"]} · tabela {table}','url':meta['URL'],'consulta':url,'periodo':meta['periodicidade'],'universo':meta['nome'],'limitacoes':['PNAD é amostral; diferenças não constituem significância estatística. Coeficientes de variação são disponibilizados por observação; não são intervalos de confiança.','Séries são uma fotografia da captura e podem ser revisadas pelo IBGE.'] if table!=10295 else ['Resultados preliminares da amostra do Censo2022; valores nominais de julho de 2022, sem atualização pela inflação.','Não comparar diretamente com rendimento real do trabalho da PNAD: população e conceito distintos.'],'capturadoEm':now,'sha256':sha,'bruto':f'/eficiencia/trabalho-renda/brutos/{key}.json'})
 lookup={}
 for row in rows[1:]:
  v=int(row[variable+'C']);sex=row.get(dimensions.get('Sexo','')+'C','6794');race=row.get(dimensions.get('Cor ou raça','')+'N','Total')
  lookup[(row['D1C'],row[period+'C'],sex,race,v)]=number(row['V'])
 for row in rows[1:]:
  v=int(row[variable+'C'])
  if v not in CONFIG:continue
  id,name,unit,cv,universe=CONFIG[v];tid=row['D1C'];level={'1':'brasil','3':'uf','6':'municipio'}[row['NC']]
  territories[tid]={'id':tid,'nome':row['D1N'],'nivel':level}
  if level!='brasil':territories[tid]['uf']=UF_SIGLAS[tid[:2]]
  sexcode=row.get(dimensions.get('Sexo','')+'C','6794');sex={'6794':'total','4':'homens','5':'mulheres'}[sexcode]
  race=row.get(dimensions.get('Cor ou raça','')+'N','Total');p=row[period+'C'];val=number(row['V'])
  if id not in indicators:indicators[id]={'id':id,'nome':name,'unidade':unit,'fonteId':key,'universo':universe,'limitacao':'Valores reais, a preços médios do último trimestre divulgado na tabela; revisões podem alterar toda a série.' if id=='rendimento-trabalho' else ('Valores nominais de julho de 2022; resultados preliminares da amostra.' if table==10295 else 'Estimativa amostral; não interpretar diferenças pequenas como estatisticamente significativas.')}
  observations.append({'indicadorId':id,'territorioId':tid,'periodo':p,'periodoNome':row[period+'N'],'valor':val,'sexo':sex,'grupo':race,'status':'observado' if val is not None else 'ausente','cv':lookup.get((tid,p,sexcode,race,cv)) if cv else None,'fonteId':key})
 print(key,len(rows)-1,flush=True)
snapshot={'versao':1,'capturadoEm':now,'fontes':sources,'territorios':sorted(territories.values(),key=lambda x:(x['nivel'],x['nome'])),'indicadores':list(indicators.values()),'observacoes':observations,'notas':['Valores não disponíveis preservados como null; hífen SIDRA significa zero absoluto, conforme legenda da fonte.','Taxas e rendimentos não podem ser somados para criar média entre territórios.','PNAD é territorializada pela residência; renda do Censo é domiciliar por morador. Não há vínculo de eficácia causal com políticas públicas.']}
(OUT/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')))
print('Snapshot',len(territories),'territorios',len(observations),'observacoes')
