"""Extrai arquivos oficiais baixados, sem alterar os originais.
Uso: python -m pipeline.assistencia.capturar DIRETORIO_ORIGINAIS
O único reparo permitido é remover controles XML 1.0 proibidos em cópia temporária.
"""
import collections,csv,gzip,hashlib,io,json,re,sys,tempfile,zipfile
from pathlib import Path
from pipeline.eficiencia.fontes.xlsx import linhas
ROOT=Path(__file__).parent
BASE='https://aplicacoes.mds.gov.br/snas/defeso/censosuas/2025/'
RMA_URL='https://aplicacoes.mds.gov.br/sagi/dicivip_datain/ckfinder/userfiles/files/RMA_CRAS_Criterios_2025_divulgacao_150526.xlsx'
SPECS={
 'CRAS': [('q2_1','Dias de funcionamento','categoria','2025'),('q2_2','Horas de funcionamento','categoria','2025'),('q9_1','Acesso principal: acessibilidade declarada','categoria','2025'),('q9_4','Banheiro: acessibilidade declarada','categoria','2025'),('q12_12','Acompanhamento de encaminhamentos no PAIF','binario','2025'),('q12_14','Plano de acompanhamento familiar no PAIF','binario','2025'),('q34','Oferta de proteção básica no domicílio','binario','2025'),('q36_1','Atendidos no domicílio: total declarado','contagem','agosto de 2025'),('q36_2','Atendidos no domicílio: idosos','contagem','agosto de 2025'),('q36_3','Atendidos no domicílio: pessoas com deficiência','contagem','agosto de 2025'),('q51_1','Espera entre agendamento e atendimento do Cadastro Único','dias','2025')],
 'CREAS': [('q4_1','Dias de funcionamento','categoria','2025'),('q4_2','Horas de funcionamento','categoria','2025'),('q9_1','Acesso principal: acessibilidade declarada','categoria','2025'),('q9_4','Banheiro: acessibilidade declarada','categoria','2025'),('q12_4','Acompanhamento de encaminhamentos no PAEFI','binario','2025'),('q12_6','Plano de acompanhamento familiar ou individual no PAEFI','binario','2025')],
 'DIA': [('q3_1','Dias de funcionamento','categoria','2025'),('q3_2','Horas de funcionamento','categoria','2025'),('q15_1','Acesso principal: acessibilidade declarada','categoria','2025'),('q15_4','Banheiro: acessibilidade declarada','categoria','2025'),('q23','Frequência média de uso do serviço','categoria','2025'),('q24','Permanência média na unidade','categoria','2025')]
}
def text(v):return '' if v is None else str(v).strip()
def identifier(v):
 s=text(v).strip("'")
 return str(int(float(s))) if re.fullmatch(r'\d+(\.0+)?',s) else s

def observation(raw,kind,not_applicable=False):
 s=text(raw)
 if not_applicable:return {'raw':s or None,'value':None,'status':'NAO_APLICAVEL'}
 if not s:return {'raw':None,'value':None,'status':'NAO_INFORMADO'}
 if kind in ('contagem','dias'):
  if not re.fullmatch(r'\d+(\.0+)?',s):return {'raw':s,'value':None,'status':'NAO_INFORMADO'}
  return {'raw':s,'value':int(float(s)),'status':'OBSERVADO'}
 return {'raw':s,'value':s,'status':'OBSERVADO'}

def clean_xlsx(p,audit):
 tmp=tempfile.NamedTemporaryFile(suffix='.xlsx',delete=False);tmp.close();dest=Path(tmp.name)
 with zipfile.ZipFile(p) as z,zipfile.ZipFile(dest,'w') as w:
  for n in z.namelist():
   b=z.read(n)
   if n.endswith('.xml'):
    count=len(re.findall(rb'[\x00-\x08\x0b\x0c\x0e-\x1f]',b))
    if count:audit.append({'file':p.name,'member':n,'removed_xml_controls':count})
    b=re.sub(rb'[\x00-\x08\x0b\x0c\x0e-\x1f]',b'',b)
   w.writestr(n,b)
 return dest

def capture(directory):
 sources=[];audit=[];units=[];catalog=[];counts={}
 for kind,archive in [('CRAS','1_CRAS.zip'),('CREAS','2_CREAS.zip'),('DIA','6_CENTRO_DIA.zip')]:
  original=directory/archive;digest=hashlib.sha256(original.read_bytes()).hexdigest()
  sources.append({'file':archive,'url':BASE+archive,'sha256':digest})
  p=next(directory.rglob('*'+('Centro_Dia' if kind=='DIA' else kind)+'_Dados_Gerais.'+('xlsx' if kind=='DIA' else 'csv')))
  if kind=='DIA':
   clean=clean_xlsx(p,audit);it=linhas(clean);headers=next(it);rows=[dict(zip(headers,r)) for r in it if r];clean.unlink()
  else:rows=list(csv.DictReader(io.StringIO(p.read_bytes().decode('cp1252')),delimiter=';'))
  counts[kind]=len(rows)
  descriptions={}
  if kind!='DIA':
   d=next(directory.rglob('*'+kind+'_Dicionario de Variaveis.xlsx'))
   descriptions={r[0]:r[1] for r in linhas(d) if len(r)>1 and r[0]}
  for key,name,typ,period in SPECS[kind]:
   if key not in rows[0]:raise ValueError('Variável ausente: '+kind+key)
   catalog.append({'id':kind+'.'+key,'variable':key,'kind':kind,'name':name,'definition':descriptions.get(key,name+'; questionário Centro Dia 2025, questão '+key[1:].split('_')[0]),'universe':'Unidades respondentes '+kind+' do Censo SUAS 2025; não é população elegível','period':period,'frequency':'Anual','formula':'Resposta oficial por unidade, preservada; proporções usam apenas respostas observadas, com cobertura explícita','numerator':'Unidades na categoria selecionada ou contagem declarada','denominator':'Respostas observadas do mesmo tipo, variável, período e recorte; não se aplica às contagens','unit':typ,'source':'MDS / Censo SUAS 2025','record':archive+' / '+p.name+' / '+key,'coverage':len(rows),'missing':'Branco preservado como não informado; q36 depende de q34; q51 sinaliza não realização','breaks':'Sem série histórica integrada; não comparar diretamente formulários de edições diferentes','score_role':'Evidência de oferta/capacidade; não completa escore do serviço','reference':'Sem referência de pontuação validada','limitations':'Autodeclaração; não comprova realização individual, resolução ou conformidade auditada; faltam demanda elegível e resultados','publication':'PUBLICADO_DESCRITIVO'})
  for r in rows:
   uid=identifier(r['NU_IDENTIFICADOR']);code=identifier(r.get('IBGE7'));uf=text(r.get('UF') if kind!='DIA' else r.get('q0_9'))
   regional=(kind=='CREAS' and text(r.get('q1'))!='Municipal') or (kind=='DIA' and text(r.get('q1'))=='ESTADUAL')
   if not uid:raise ValueError('Identificador ausente')
   if not regional and not re.fullmatch(r'\d{7}',code):raise ValueError('Código IBGE inválido: '+code)
   vals={}
   for key,_,typ,_ in SPECS[kind]:
    na=kind=='CRAS' and ((key.startswith('q36_') and text(r.get('q34')).startswith('Não')) or (key=='q51_1' and text(r.get('q51_1_1'))=='Sim'))
    vals[key]=observation(r.get(key),typ,na)
   units.append({'id':uid,'kind':kind,'code':None if regional else code,'city':('Rede estadual' if kind=='DIA' else 'Rede regional') if regional else text(r.get('Município')),'uf':uf,'scope':('Estadual' if kind=='DIA' else 'Regional') if regional else ('Distrital' if uf=='DF' else 'Local'),'nature':text(r.get('q4')) if kind=='DIA' else 'Unidade pública SUAS','complete':text(r.get('Q_incompleto')),'values':vals})
 # Recursos humanos: número de vínculos declarados, não trabalhadores únicos.
 for kind in ['CRAS','CREAS']:
  p=next(directory.rglob('*'+kind+'_RH.csv'));counter=collections.Counter(identifier(r.get('NU_IDENTIFICADOR')) for r in csv.DictReader(io.StringIO(p.read_bytes().decode('cp1252')),delimiter=';'))
  for u in units:
   if u['kind']==kind:u['values']['rh_vinculos']=observation(counter.get(u['id']),'contagem') # ausência não vira zero
  catalog.append({**next(c for c in catalog if c['kind']==kind),'id':kind+'.rh_vinculos','variable':'rh_vinculos','name':'Registros de vínculos de trabalhadores','definition':'Quantidade de linhas de RH ligadas ao identificador da unidade, sem divulgar dados de trabalhadores','formula':'Contagem de registros RH por NU_IDENTIFICADOR','unit':'contagem','numerator':'Registros da base RH da unidade','denominator':'Não se aplica','record':('1_CRAS.zip' if kind=='CRAS' else '2_CREAS.zip')+' / '+p.name,'limitations':'Vínculos declarados, não pessoas únicas; ausência na base RH não é zero; não mede adequação da equipe ou carga horária'}); audit.append({'file':p.name,'staff_records':sum(counter.values()),'unmatched_unit_records':sum(v for k,v in counter.items() if k not in {u['id'] for u in units if u['kind']==kind})})
 p=directory/'rma-cras-2025.xlsx';sources.append({'file':p.name,'url':RMA_URL,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 it=linhas(p,'Base tratada');h=next(it);monthly=[]
 for row in it:
  if not row:continue
  r=dict(zip(h,row));uid=identifier(r.get('NU_IDENTIFICADOR'));code=identifier(r.get('IBGE7'));month=identifier(r.get('mes'));year=identifier(r.get('ano'))
  if year!='2025' or month not in [str(i) for i in range(1,13)] or not re.fullmatch(r'\d{7}',code):raise ValueError('Chave RMA inválida')
  values=[]
  for k in ['a1','a2','c1','c5']:
   for suffix in ['', '_original']:
    v=r.get(k+suffix)
    if v is not None and (not isinstance(v,(float,int)) or v<0 or int(v)!=v):raise ValueError('Contagem RMA inválida')
    values.append(None if v is None else int(v))
  monthly.append([uid,code,text(r.get('UF_A')),int(month),*values])
 if len(set((r[0],r[3]) for r in monthly))!=len(monthly):raise ValueError('Duplicidade RMA unidade/mês')
 if len(set((u['kind'],u['id']) for u in units))!=len(units):raise ValueError('Duplicidade Censo')
 for k,n in [('a1','Famílias em acompanhamento PAIF'),('a2','Novas famílias inseridas no PAIF'),('c1','Atendimentos particularizados'),('c5','Atendimentos com encaminhamento ao CREAS')]:
  catalog.append({**catalog[0],'id':'RMA.'+k,'variable':k,'kind':'RMA','name':n,'definition':n+' no mês de referência; definição do dicionário oficial RMA 2025','universe':'Formulários CRAS presentes na Base tratada do RMA 2025','period':'Janeiro a dezembro de 2025; cada mês separadamente','frequency':'Mensal','formula':'Soma apenas dos valores tratados observados por UF/mês; cobertura por variável; nenhuma soma anual de a1','numerator':'Contagens tratadas observadas','denominator':'Não se aplica; cobertura = formulários com valor observado / formulários presentes no recorte','unit':'contagem','source':'MDS / RMA CRAS 2025','record':p.name+' / Base tratada / '+k+'; coluna '+k+'_original preservada','coverage':len(monthly),'missing':'Nulo da base tratada preservado; original publicado separadamente; meses sem formulário não são zero','breaks':'Base tratada elimina formulários inteiramente zero e valores discrepantes pelos critérios oficiais; composição pode mudar por mês','score_role':'Volume de serviço, sem inferência de cobertura elegível ou resolução','limitations':'Famílias podem reaparecer em vários meses e unidades; atendimentos não são pessoas únicas; encaminhamento não comprova recepção no CREAS'})
 seed={'year':2025,'units':units,'monthly':monthly,'catalog':catalog,'counts':counts}
 payload=json.dumps(seed,ensure_ascii=False,separators=(',',':')).encode();packed=gzip.compress(payload,mtime=0)
 (ROOT/'seed/recorte.json.gz').write_bytes(packed)
 manifest={'captured_at':'2026-10-10','period':'2025; cuidado no domicílio: agosto de 2025','sources':sources,'seed_sha256':hashlib.sha256(packed).hexdigest(),'counts':counts,'rma_rows':len(monthly),'audit':audit,'rma_columns':['unit_id','code','uf','month','a1','a1_original','a2','a2_original','c1','c1_original','c5','c5_original']}
 (ROOT/'seed/manifesto.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'counts':counts,'rma_rows':len(monthly),'seed_bytes':len(packed),'audit':audit},ensure_ascii=False))
if __name__=='__main__':capture(Path(sys.argv[1]))
