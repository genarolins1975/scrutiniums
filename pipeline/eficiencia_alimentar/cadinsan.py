from pipeline.eficiencia_alimentar.textos import normalizar_textos
"""Official modeled CadINSAN risk, January2025; never municipal EBIA population prevalence."""
import pathlib,json,re,gzip,hashlib,datetime,subprocess,tempfile,urllib.request,sys
import openpyxl
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'public/eficiencia/seguranca-alimentar'
URL='https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADINSAN2025.pdf'
MUNIC='https://ftp.ibge.gov.br/Perfil_Municipios/Seguranca_Alimentar_2024/Base_de_dados_Seguranca_Alimentar_MUNIC.xlsx'
def load(path,url):
 if '--coletar' in sys.argv or not path.exists():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(gzip.compress(urllib.request.urlopen(url,timeout=60).read(),mtime=0))
 return gzip.decompress(path.read_bytes())
def build():
 raw=load(OUT/'brutos/cadinsan-2025.pdf.gz',URL);xlsx=load(OUT/'brutos/munic-san-2024.xlsx.gz',MUNIC)
 with tempfile.TemporaryDirectory() as folder:
  p=pathlib.Path(folder);(p/'source.pdf').write_bytes(raw);subprocess.run(['pdftotext','-layout',str(p/'source.pdf'),str(p/'source.txt')],check=True,capture_output=True);text=(p/'source.txt').read_text()
  (p/'munic.xlsx').write_bytes(xlsx);w=openpyxl.load_workbook(p/'munic.xlsx',read_only=True,data_only=True)
  municipios={str(r[0]):{'id':str(r[0]),'nome':r[3],'nivel':'municipio','uf':r[1]} for r in list(w['Órgão gestor perfil do titular'].iter_rows(values_only=True))[1:] if isinstance(r[0],int)}
 starts=list(re.finditer(r'^\s*(\d{7})\s+',text,re.M));pattern=re.compile(r'(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+)%\s+([\d,]+)%');records=[]
 for index,m in enumerate(starts):
  block=text[m.end():starts[index+1].start() if index+1<len(starts) else len(text)];values=pattern.search(block)
  if not values:raise ValueError('Municipal row not parsed: '+m.group(1))
  code=m.group(1)
  if code not in municipios:raise ValueError('Municipal code not reconciled: '+code)
  a,b,n,pa,pb=values.groups();records.append({'territorioId':code,'comPbf':int(a),'semPbf':int(b),'familiasAnalisadas':int(n),'proporcaoComPbf':float(pa.replace(',','.')),'proporcaoSemPbf':float(pb.replace(',','.')),'paginaPdf':text[:m.start()].count('\f')+1})
 if len(records)!=5570 or len({r['territorioId'] for r in records})!=5570:raise ValueError('Official report municipal coverage changed')
 OUT.joinpath('brutos/cadinsan-linhas-extraidas.json.gz').write_bytes(gzip.compress(json.dumps(records,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 source={'id':'cadinsan-2025','nome':'MDS · CadINSAN 2025 · Relatório publicado em 2026','url':URL,'consulta':URL,'periodo':{'frequencia':'retrato','inicio':202501,'fim':202501},'universo':'Famílias do Cadastro Único com cadastro atualizado nos 12 meses anteriores, base janeiro de 2025; risco de insegurança alimentar grave previsto por modelo treinado na PNAD 2024.','limitacoes':['Risco modelado entre famílias cadastradas selecionadas; não é prevalência observada pela EBIA nem representa toda a população municipal.','O corpo do relatório informa 21.460.006 famílias atualizadas em 12 meses. O anexo municipal soma 21.236.683; diferença 223.323 não reconciliada. Agregados desta interface representam somente a soma do anexo.','Modelo atualizado entre edições e faixas regionais de renda alteradas; não tratar2024 e 2025 como série diretamente comparável.','Em 270 municípios, o cenário sem PBF tem valor menor que comPBF, como publicado. Não pressupor redução ou monotonicidade causal.', 'Coluna sem PBF é cenário de modelagem desconsiderando benefícios, não efeito causal nem contagem de famílias que perderam benefício.','Proporções municipais publicadas com uma casa decimal. Totais Brasil/UF calculados por soma municipal e razão entre contagens, identificados como calculados.'],'capturadoEm':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'bruto':'/eficiencia/seguranca-alimentar/brutos/cadinsan-2025.pdf.gz','documentacao':['https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADinsan/'], 'transformacoes':['Extração textual pdftotext-layout:5570 códigos municipais únicos, com cinco campos numéricos por linha; página PDF preservada no arquivo de extração.','Nomes municipais eUF reconciliados por código com a base oficial MUNIC 2024.']}
 indicators=[]
 CONFIG=[('cadinsan-risco-familias','Famílias em risco estimado, considerando PBF','famílias','comPbf'),('cadinsan-risco-percentual','Proporção em risco estimado, considerando PBF','%','proporcaoComPbf'),('cadinsan-familias-analisadas','Famílias analisadas no anexo municipal do CadINSAN','famílias','familiasAnalisadas'),('cadinsan-cenario-sem-pbf-familias','Famílias em risco estimado no cenário sem PBF','famílias','semPbf'),('cadinsan-cenario-sem-pbf-percentual','Proporção em risco estimado no cenário sem PBF','%','proporcaoSemPbf')]
 for id,name,unit,field in CONFIG:indicators.append({'id':id,'nome':name,'unidade':unit,'fonteId':source['id'],'universo':source['universo'],'limitacao':source['limitacoes'][0]+(' Cenário sem PBFnão demonstra efeito causal.' if 'cenario' in id else ''),'frequencia':'retrato','perimetro':'cadastro atualizado 12 meses'})
 obs=[];sums={}
 for r in records:
  for id,name,unit,field in CONFIG:
   obs.append({'indicadorId':id,'territorioId':r['territorioId'],'periodo':'202501','periodoNome':'Janeiro de 2025','grupo':'Total','dimensao':'total','valor':r[field],'status':'observado','cv':None,'fonteId':source['id'],'nota':'Estimativa modelada do relatório, não prevalência populacional.','paginaPdf':r['paginaPdf']})
  for tid in ['1',r['territorioId'][:2]]:
   if tid not in sums:sums[tid]={'comPbf':0,'semPbf':0,'familiasAnalisadas':0}
   for field in ['comPbf','semPbf','familiasAnalisadas']:sums[tid][field]+=r[field]
 for tid,r in sums.items():
  r['proporcaoComPbf']=round(100*r['comPbf']/r['familiasAnalisadas'],1);r['proporcaoSemPbf']=round(100*r['semPbf']/r['familiasAnalisadas'],1)
  for id,name,unit,field in CONFIG:obs.append({'indicadorId':id,'territorioId':tid,'periodo':'202501','periodoNome':'Janeiro de 2025','grupo':'Total','dimensao':'total','valor':r[field],'status':'calculado','cv':None,'fonteId':source['id'],'nota':'Soma municipal das contagens; proporção calculada entre contagens agregadas. Não é prevalência populacional.'})
 ebia=json.loads(OUT.joinpath('snapshot.json').read_text());ts={t['id']:t for t in ebia['territorios']};ts.update(municipios)
 result={'versao':1,'capturadoEm':source['capturadoEm'],'fontes':[source],'territorios':list(ts.values()),'indicadores':indicators,'observacoes':obs,'notas':source['limitacoes']}
 OUT.joinpath('cadinsan.json').write_text(json.dumps(normalizar_textos(result),ensure_ascii=False,separators=(',',':')))
 print('CadINSAN',len(records),'municípios',len(obs),'observações; soma analisadas',sums['1']['familiasAnalisadas'])
if __name__=='__main__':build()
