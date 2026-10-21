#!/usr/bin/env python3
"""Reproduce MTE CNAP authorized-course files. No vacancies, enrollment or effectiveness claims."""
import argparse,csv,datetime,hashlib,io,json,pathlib,shutil,urllib.request,zipfile,collections
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/eficiencia/trabalho-renda/cursos'
URL='https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/aprendizagem-profissional/arquivos-aprendizagem-profissional/consulta-cursos-aprovados-ods'
PAGE='https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/aprendizagem-profissional'
SIGLAS=set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split())
def parse_date(value):
 try:return datetime.datetime.strptime(value.strip(),'%d/%m/%Y').date()
 except ValueError:return None
def classify(approval,validity,reference):
 if approval is None or validity is None:return 'sem-data'
 if approval>reference:return 'futuro'
 if validity<reference:return 'vencido'
 return 'vigente'
def generate(archive,capture,reference):
 rawzip=archive.read_bytes();z=zipfile.ZipFile(io.BytesIO(rawzip));names=[n for n in z.namelist() if n.lower().endswith('.csv')]
 if len(names)!=1:raise ValueError('Expected one official CSV file in archive')
 rawcsv=z.read(names[0]);reader=csv.reader(io.StringIO(rawcsv.decode('cp1252')),delimiter=';');next(reader);header=next(reader)
 required=['Código do Curso','Nome do Curso','Nome do Programa','Razão Social','Estado','Cidade','Modalidade do Curso','Carga Horária Total','CBO(s) Associadas','Título da(s) CBO(s) Associadas','Data Aprovação','Data Validade','UF modalidade À distância','Município modalidade À distância']
 if any(c not in header for c in required):raise ValueError('Official column contract changed')
 byuf=collections.defaultdict(list);codes=set();states=collections.Counter();modes=collections.Counter();locality=collections.Counter();previous_line=reader.line_num;rodape=[]
 for row in reader:
  original=previous_line+1;previous_line=reader.line_num
  if not any(cell.strip() for cell in row):continue
  if len(row)!=len(header):raise ValueError(f'Unexpected number of columns in source line{original}')
  r=dict(zip(header,row));id=r['Código do Curso'].strip()
  if id.startswith('Consulta realizada') and not any(c.strip() for c in row[1:]):rodape.append(id);continue
  if not id.isdigit():raise ValueError(f'Missing course code in source line{original}')
  modality=r['Modalidade do Curso'].strip();eaduf=r['UF modalidade À distância'].strip().upper();eadcity=r['Município modalidade À distância'].strip()
  uf=eaduf if eaduf and eadcity else r['Estado'].strip().upper();city=eadcity if eaduf and eadcity else r['Cidade'].strip()
  if uf not in SIGLAS:raise ValueError(f'Invalid UF {uf!r} in source line{original}')
  local='oferta-ead' if eaduf and eadcity else 'sede'
  approval=parse_date(r['Data Aprovação']);validity=parse_date(r['Data Validade']);status=classify(approval,validity,reference)
  hours=r['Carga Horária Total'].strip().replace('.','').replace(',','.')
  record={'id':id,'nome':r['Nome do Curso'].strip(),'programa':r['Nome do Programa'].strip(),'entidade':r['Razão Social'].strip(),'uf':uf,'cidade':city,'modalidade':modality,'horasTotal':float(hours) if hours else None,'cbo':r['CBO(s) Associadas'].strip(),'ocupacoes':r['Título da(s) CBO(s) Associadas'].strip(),'aprovacaoISO':approval.isoformat() if approval else None,'validadeISO':validity.isoformat() if validity else None,'status':status,'originalLinha':original,'localidade':local}
  byuf[uf].append(record);codes.add(id);states[status]+=1;modes[modality]+=1;locality[local]+=1
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'brutos').mkdir(exist_ok=True)
 originalzip=OUT/'brutos/original.zip'
 if archive.resolve()!=originalzip.resolve():shutil.copyfile(archive,originalzip)
 stats=[]
 for uf,records in sorted(byuf.items()):
  (OUT/f'uf-{uf}.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')))
  stats.append({'uf':uf,'registros':len(records),'vigentes':sum(r['status']=='vigente' for r in records),'codigos':len({r['id'] for r in records}),'localidades':len({r['cidade'] for r in records})})
 index={'versao':1,'porUF':stats,'fonte':{'nome':'MTE · CNAP · Cursos de aprendizagem profissional autorizados','url':URL,'pagina':PAGE,'capturadoEm':capture,'dataSituacao':reference.isoformat(),'sha256Zip':hashlib.sha256(rawzip).hexdigest(),'sha256Csv':hashlib.sha256(rawcsv).hexdigest(),'arquivoCsv':names[0],'bruto':'/eficiencia/trabalho-renda/cursos/brutos/original.zip','referencia':'Planilha de outubro de 2026; cursos autorizados de 01/02/2024 a 05/10/2026, conforme rodapé oficial; captura em 09/10/2026.','rodape':rodape,'limitacoes':['Cursos autorizados no cadastro oficial; autorização não significa turma aberta, vaga disponível, matrícula ou conclusão.','Registros podem repetir o mesmo código em locais de oferta distintos, especialmente ensino à distância. Códigos distintos não são contagem de turmas.','Localidade é de oferta EAD quando UF e município específicos estão preenchidos. Nos demais registros é a sede indicada na planilha, não promessa de oferta presencial atual.','Situação é calculada pelas datas de aprovação e validade na data de referência da captura. Não equivale a confirmação operacional do MTE.','Aprovação posterior à data de referência é classificada futuro; falta ou erro de qualquer data é sem-data. Os originais são preservados no ZIP.']},'totais':{'registros':sum(len(rs) for rs in byuf.values()),'codigos':len(codes),'localidades':len({(r['uf'],r['cidade']) for rs in byuf.values() for r in rs}),**{st:states[st] for st in ['vigente','vencido','futuro','sem-data']}},'modalidades':[{'nome':k,'registros':v} for k,v in sorted(modes.items())],'localidadesTipos':dict(locality)}
 (OUT/'indice.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
 print(json.dumps(index['totais'],ensure_ascii=False))
 return index
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--arquivo',type=pathlib.Path,default=OUT/'brutos/original.zip');parser.add_argument('--coletar',action='store_true');parser.add_argument('--data',default=datetime.date.today().isoformat());args=parser.parse_args()
 if args.coletar:
  args.arquivo.parent.mkdir(parents=True,exist_ok=True)
  for attempt in range(3):
   try:
    raw=urllib.request.urlopen(URL,timeout=60).read();zipfile.ZipFile(io.BytesIO(raw)).testzip();args.arquivo.write_bytes(raw);break
   except Exception:
    if attempt==2:raise
 generate(args.arquivo,datetime.datetime.now(datetime.timezone.utc).isoformat(),datetime.date.fromisoformat(args.data))
