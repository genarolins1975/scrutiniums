from pipeline.eficiencia_alimentar.textos import normalizar_textos
"""Official PNAD EBIA counts and within-group prevalence. SIDRA composition percentages are NOT prevalence."""
import pathlib,json,urllib.request,gzip,hashlib,datetime,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'public/eficiencia/seguranca-alimentar'
JOBS=[(9552,'area'),(9553,'sexo-responsavel'),(9554,'cor-responsavel'),(9555,'instrucao-responsavel'),(9556,'ocupacao-responsavel'),(9557,'moradores'),(9558,'renda'),(9559,'menores-5'),(9560,'idosos'),(9562,'menores-18')]
STATES={'109098':('segura','Com segurança alimentar'),'109099':('insan-total','Com insegurança alimentar'),'109100':('leve','Insegurança alimentar leve'),'109101':('moderada','Insegurança alimentar moderada'),'109102':('grave','Insegurança alimentar grave'),'109107':('moderada-grave','Insegurança alimentar moderada ou grave')}
def fetch(url):
 r=urllib.request.urlopen(url,timeout=60).read();return gzip.decompress(r) if r[:2]==b'\x1f\x8b' else r
def territory_id(r):return "regiao-"+r["D1C"] if r["NC"]=="2" else r["D1C"]
def number(x):return 0.0 if x=='-' else None if x in ['X','...','..',''] else float(x)
def grab(job):
 table,dimension=job;meta_raw=fetch(f'https://servicodados.ibge.gov.br/api/v3/agregados/{table}/metadados');meta=json.loads(meta_raw)
 geo='/n1/all/n2/all/n3/all' if table==9552 else '/n1/all';classifications=''.join(f'/c{c["id"]}/'+('6795' if table==9558 and c['id']==1 else 'all') for c in meta['classificacoes'])
 url=f'https://apisidra.ibge.gov.br/values/t/{table}{geo}/v/162,5123/p/all{classifications}'
 raw=fetch(url);rows=json.loads(raw)
 if not isinstance(rows,list) or len(rows)<2:raise ValueError(f'Official table {table} failed')
 OUT.joinpath('brutos').mkdir(parents=True,exist_ok=True);name=f'ebia-{table}.json.gz';OUT.joinpath('brutos',name).write_bytes(gzip.compress(raw,mtime=0));OUT.joinpath('brutos',f'ebia-{table}-metadados.json.gz').write_bytes(gzip.compress(meta_raw,mtime=0))
 source={'id':f'ebia-{table}','nome':f'IBGE · PNAD Contínua · Segurança alimentar · tabela {table}','url':meta['URL'],'consulta':url,'periodo':meta['periodicidade'],'universo':meta['nome'],'limitacoes':['Domicílios particulares permanentes na PNAD Contínua; estimativas amostrais. A EBIA mede experiência de acesso aos alimentos nos três meses anteriores à entrevista.','Valores absolutos publicados em mil domicílios, com arredondamento da fonte. Proporções desta interface são calculadas por classe / total do mesmo recorte, não são os percentuais de composição do SIDRA.','Coeficiente de variação da contagem não é coeficiente da proporção calculada. Diferença pequena não demonstra significância estatística.','Recortes sociais desta tabela limitam-se ao Brasil.' if table!=9552 else 'Brasil, Grandes Regiões e UFs. Não há estimativa municipal EBIA nesta tabela.'],'capturadoEm':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'bruto':f'/eficiencia/seguranca-alimentar/brutos/{name}','transformacoes':['Hífen SIDRA convertido em zero absoluto; X/../... preservados como null.','Razão percentual = 100 × contagem da classe / contagem Total, no mesmo ano, território e grupo; uma casa decimal. Sem intervalo ou CV inferido.']}
 header=rows[0];classification_prefixes={c['id']:next(k[:-1] for k,v in header.items() if v==c['nome']+' (Código)') for c in meta['classificacoes']};status_prefix=classification_prefixes[12404]
 other=[p for id,p in classification_prefixes.items() if id!=12404 and not(table==9558 and id==1)]
 lookup={};territories={}
 for r in rows[1:]:
  group=' · '.join(r[p+'N'] for p in other);group='Total' if group=='Total' else group
  key=(territory_id(r),r['D3C'],group,r[status_prefix+'C'],r['D2C']);lookup[key]=number(r['V'])
  territories[territory_id(r)]={'id':territory_id(r),'nome':r['D1N'],'nivel':{'1':'brasil','2':'regiao','3':'uf'}[r['NC']]}
 obs=[]
 for r in rows[1:]:
  if r['D2C']!='162':continue
  code=r[status_prefix+'C'];group=' · '.join(r[p+'N'] for p in other);dim='total' if table==9552 and group=='Total' else dimension
  if table!=9552 and group=='Total':continue
  value=number(r['V']);tid=territory_id(r);p=r['D3C'];denominator=lookup.get((tid,p,group,'109106','162'));cv=lookup.get((tid,p,group,code,'5123'))
  base={'territorioId':tid,'periodo':p,'periodoNome':p,'grupo':group,'dimensao':dim,'fonteId':source['id'],'nota':None}
  if code=='109106':obs.append({**base,'indicadorId':'ebia-total-domicilios','valor':value,'status':'ausente' if value is None else 'observado','cv':cv});continue
  if code not in STATES:continue
  id,_=STATES[code];obs.append({**base,'indicadorId':'ebia-domicilios-'+id,'valor':value,'status':'ausente' if value is None else 'observado','cv':cv})
  ratio=round(100*value/denominator,1) if value is not None and denominator not in [None,0] else None
  obs.append({**base,'indicadorId':'ebia-'+id,'valor':ratio,'status':'ausente' if ratio is None else 'calculado','cv':None,'numerador':value,'denominador':denominator,'formula':'100 × numerador / denominador','nota':'Percentual calculado de contagens oficiais em mil domicílios; denominador: total do mesmo recorte.'})
 return source,list(territories.values()),obs
if __name__=='__main__':
 fontes=[];territories={};obs=[]
 for source,ts,os in concurrent.futures.ThreadPoolExecutor(4).map(grab,JOBS):
  fontes.append(source);territories.update({t['id']:t for t in ts});obs+=os;print(source['id'],len(os),flush=True)
 indicators=[{'id':'ebia-total-domicilios','nome':'Domicílios do recorte','unidade':'mil domicílios','fonteId':'ebia-9552','universo':'Domicílios particulares permanentes do recorte selecionado.','limitacao':'Estimativa amostral em mil domicílios; valores arredondados pelo IBGE.','frequencia':'anual','perimetro':'residência'}]
 for _,(id,name) in STATES.items():
  for rate in [False,True]:
   indicators.append({'id':('ebia-' if rate else 'ebia-domicilios-')+id,'nome':name+(' — proporção' if rate else ' — domicílios'),'unidade':'%' if rate else 'mil domicílios','fonteId':'ebia-9552','universo':'Domicílios particulares permanentes na classe EBIA e recorte selecionados.','limitacao':'Proporção calculada: contagem da classe / Total do mesmo recorte. Sem CV ou intervalo inferido.' if rate else 'Quantidade amostral publicada em mil domicílios; moradores, famílias e domicílios são universos distintos.','frequencia':'anual','perimetro':'residência'})
 snapshot={'versao':1,'capturadoEm':max(s['capturadoEm'] for s in fontes),'fontes':fontes,'territorios':list(territories.values()),'indicadores':indicators,'observacoes':obs,'notas':['Não atribuir EBIA municipal: PNAD desta extração alcança UF.','Recortes sociais limitados ao Brasil; não aplicar estimativa nacional ao estado selecionado.','Insegurança alimentar leve, moderada e grave são classes distintas; não somar Insegurança total às suas parcelas.']}
 OUT.joinpath('snapshot.json').write_text(json.dumps(normalizar_textos(snapshot),ensure_ascii=False,separators=(',',':')))
 print('EBIA',len(obs),'observações',flush=True)
