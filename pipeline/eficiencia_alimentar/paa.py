"""MDS public MI Social extract: annual registered suppliers and payments, with explicit municipal coverage."""
import pathlib,json,urllib.request,urllib.parse,gzip,hashlib,datetime,sys
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'public/eficiencia/seguranca-alimentar';API='https://aplicacoes.mds.gov.br/sagi/servicos/misocial'
FIELDS={'agricultores_fornec_paa_i':('paa-fornecedores','Fornecedores registrados no PAA','registros de fornecedores','002'),'recur_pagos_agricul_paa_f':('paa-pagamentos','Pagamentos registrados a fornecedores do PAA','R$','003')}
PERIODS=['202312','202412','202512']
def capture(name,url):
 p=OUT/'brutos'/name
 if '--coletar' in sys.argv or not p.exists():
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.compress(urllib.request.urlopen(url,timeout=60).read(),mtime=0))
 return gzip.decompress(p.read_bytes())
def build():
 # Reconcile municipal identifiers using the official relation already captured by this observatory.
 rawmunicip=gzip.decompress(OUT.joinpath('brutos/ibge-municipios.json.gz').read_bytes());municipios=json.loads(rawmunicip);lookup={str(m['id'])[:6]:str(m['id']) for m in municipios}
 if len(lookup)!=len(municipios):raise ValueError('Ambiguous current municipal identifiers')
 ebia=json.loads(OUT.joinpath('snapshot.json').read_text());territorios={t['id']:t for t in ebia['territorios'] if t['nivel']!='regiao'}
 for m in municipios:
  uf=(m.get('microrregiao') or {}).get('mesorregiao',{}).get('UF') or m.get('regiao-imediata',{}).get('regiao-intermediaria',{}).get('UF')
  if not uf:raise ValueError('Municipality without UF: '+str(m['id']))
  territorios[str(m['id'])]={'id':str(m['id']),'nome':m['nome'],'nivel':'municipio','uf':uf['sigla']}
 now=datetime.datetime.now(datetime.timezone.utc).isoformat();sources=[];obs=[];metadata=[]
 for n in ['002','003']:
  url='https://wiki-sagi.mds.gov.br/home/DS/PAA/I/IN'+n;name='mds-paa-IN'+n+'.html.gz';raw=capture(name,url)
  metadata.append({'id':'paa-ficha-IN'+n,'nome':'MDS · Documenta Wiki · Ficha PAA IN'+n,'url':url,'consulta':url,'periodo':{'frequencia':'metadados','inicio':2011 if n=='002' else 2014,'fim':2025},'universo':'Definição metodológica oficial do indicador anual de fornecedores' if n=='002' else 'Definição metodológica oficial do indicador anual de pagamentos a fornecedores.','limitacoes':['Ficha conceitual; não é uma segunda fonte de valores para somar ao extrato.'],'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':'/eficiencia/seguranca-alimentar/brutos/'+name})
 for period in PERIODS:
  query={'q':'*:*','fq':'anomes_s:'+period,'rows':6000,'wt':'json','fl':'codigo_ibge,municipio,sigla_uf,anomes_s,'+','.join(FIELDS)};url=API+'?'+urllib.parse.urlencode(query);name='mds-paa-'+period+'.json.gz';raw=capture(name,url);payload=json.loads(raw);docs=payload['response']['docs']
  if len(docs)!=payload['response']['numFound']:raise ValueError('Truncated official extract: '+period)
  if len({str(d.get('codigo_ibge')) for d in docs})!=len(docs):raise ValueError('Duplicate municipal row in original extract')
  source={'id':'mds-paa-'+period,'nome':'MDS · PAA · MI Social · referência dezembro de '+period[:4],'url':API,'consulta':url,'periodo':{'frequencia':'anual','inicio':int(period[:4]),'fim':int(period[:4])},'universo':'Extrato municipal dos campos agricultores_fornec_paa_i e recur_pagos_agricul_paa_f. Fichas IN002/IN003: fornecimento e pagamentos no ano, modalidades Compra com Doação Simultânea e PAA-Leite.','limitacoes':['Referência de dezembro; indicadores anuais segundo as fichas oficiais. Não somar meses ou anos para obter pessoas únicas.','Agregados Brasil e UF são somas das contagens municipais publicadas, sem deduplicação entre municípios. Fornecedores registrados não são beneficiários consumidores.','Campo ausente é ausência de informação nesta extração, não zero nem ausência de programa. Cobertura de municípios com dado acompanha todos os agregados.','Pagamentos a fornecedores não são dotação, valor de projetos aprovados ou execução de toda a política PAA; não incluem por inferência modalidades diferentes das fichas.','Valores monetários nominais do respectivo ano, sem correção pela inflação. Não há volume de alimentos, toneladas ou quantidade de refeições nesta base.','Totais mostram os registros disponíveis neste extrato, não um total nacional reconciliado com todos os relatórios de execução do PAA.'],'capturadoEm':now,'sha256':hashlib.sha256(raw).hexdigest(),'bruto':'/eficiencia/seguranca-alimentar/brutos/'+name,'documentacao':[x['url'] for x in metadata],'transformacoes':['Código municipal MI Social de seis dígitos reconciliado ao código oficial IBGE de sete dígitos.','Soma por Brasil e UF dos valores conhecidos; cobertura e universo municipal preservados. Valores ausentes não são imputados.','Somatório monetário em Decimal, convertido para número ao final; não arredondar parcelas antes da agregação.']}
  sources.append(source);aggregates={};year=period[:4]
  for doc in docs:
   tid=lookup.get(str(doc.get('codigo_ibge','')))
   if tid is None:raise ValueError('Municipality not reconciled: '+str(doc.get('codigo_ibge')))
   if str(doc.get('anomes_s'))!=period:raise ValueError('Mismatched reference period')
   for field,(id,label,unit,fiche) in FIELDS.items():
    rawvalue=doc.get(field);v=Decimal(str(rawvalue)) if isinstance(rawvalue,(int,float)) and not isinstance(rawvalue,bool) else None
    obs.append({'indicadorId':id,'territorioId':tid,'periodo':year,'periodoNome':year+' · referência dezembro','grupo':'Total','dimensao':'total','valor':float(v) if v is not None else None,'status':'observado' if v is not None else 'ausente','cv':None,'fonteId':source['id'],'campoFonte':field,'nota':'Extrato municipal anual. Ausência do campo não é zero; fornecedores não são pessoas únicas ao agregar municípios.'})
    for aid in ['1',tid[:2]]:
     if (aid,id) not in aggregates:aggregates[aid,id]={'sum':Decimal(0),'known':0,'all':0}
     a=aggregates[aid,id];a['all']+=1
     if v is not None:a['sum']+=v;a['known']+=1
  for (aid,id),a in aggregates.items():obs.append({'indicadorId':id,'territorioId':aid,'periodo':year,'periodoNome':year+' · referência dezembro','grupo':'Total','dimensao':'total','valor':float(a['sum']) if a['known'] else None,'status':'calculado' if a['known'] else 'ausente','cv':None,'fonteId':source['id'],'nota':f'Soma dos valores registrados em {a["known"]} de {a["all"]} municípios. Ausências não imputadas; contagens de fornecedores sem deduplicação entre municípios.','municipiosComDado':a['known'],'municipiosUniverso':a['all']})
 indicators=[{'id':id,'nome':label,'unidade':unit,'fonteId':sources[-1]['id'],'universo':sources[-1]['universo'],'limitacao':sources[-1]['limitacoes'][1] if field=='agricultores_fornec_paa_i' else 'Pagamentos anuais nominais publicados no extrato; não são valor de projetos aprovados, orçamento de todo PAA ou alimentos entregues.','categoria':'paa-execucao','frequencia':'anual','perimetro':'registro municipal MI Social','campoFonte':field} for field,(id,label,unit,fiche) in FIELDS.items()]
 result={'versao':1,'capturadoEm':now,'fontes':sources+metadata,'territorios':list(territorios.values()),'indicadores':indicators,'observacoes':obs,'notas':['Extrato disponível, com cobertura parcial de campos por município. Não substituir informação ausente por zero.','Fornecedores são contagens anuais registradas; soma municipal não assegura pessoas únicas.','Pagamentos são valores nominais; volume de alimentos não disponível neste conjunto.']}
 OUT.joinpath('paa.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 print('PAA',len(obs),'observações')
 for o in obs:
  if o['territorioId']=='1':print(o['periodo'],o['indicadorId'],o['valor'],o['municipiosComDado'],o['municipiosUniverso'])
if __name__=='__main__':build()
