"""Captura oficial RAP/AFFO; execução manual, nunca no build.
Python 3 + openpyxl + requests. --cache usa originais já baixados.
"""
import argparse, collections, csv, datetime, hashlib, io, json, math, pathlib, re, tempfile, zipfile
from decimal import Decimal
import openpyxl, requests
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCES={
 'rap2026.xlsx':'https://www.tesourotransparente.gov.br/ckan/dataset/5eba054b-84d7-4eff-9bd7-e8cabbf940e5/resource/60affecf-6165-4d7d-bcb9-040913d17752/download/dadosrelatoriorap2026.xlsx',
 'metas.zip':'https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:acompanhamentoorcamentario_2025jandez_20260522_ascii.zip',
}
REPORT='https://www.tesourotransparente.gov.br/publicacoes/relatorio-de-avaliacao-dos-restos-a-pagar/2026/114'
DIC='https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/acesso_publico:dados_abertos:dicionario_de_dados_affo_2025_final_v22-05-2026.pdf'
def require(ok,msg):
 if not ok:raise ValueError(msg)
def number(s):
 s=s.strip()
 if s in ('','NA'):return None
 require(bool(re.fullmatch(r'-?\d+(?:,\d+)?',s)),'Número AFFO inválido')
 v=float(s.replace(',','.'));require(math.isfinite(v),'Valor não finito');return v
def money(v):return float(round(v,2))
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cache',type=pathlib.Path);args=ap.parse_args()
 cache=args.cache or pathlib.Path(tempfile.mkdtemp(prefix='contas-etapa3-'))
 if not args.cache:
  for n,u in SOURCES.items():
   r=requests.get(u,timeout=120);r.raise_for_status();(cache/n).write_bytes(r.content)
 capture=datetime.datetime.now(datetime.timezone.utc).isoformat()
 provenance={n:{'url':u,'sha256':hashlib.sha256((cache/n).read_bytes()).hexdigest()} for n,u in SOURCES.items()}
 w=openpyxl.load_workbook(cache/'rap2026.xlsx',read_only=True,data_only=True)
 it=iter(w['Base Geral'].values);header=next(it)
 require(header[0]=='MES_LANCAMENTO' and header[-1]=='CATEGORIA_RTN','Esquema RAP mudou')
 groups={};orgs={};totals={};counts=collections.Counter();maxres=Decimal(0)
 for line,row in enumerate(it,start=2):
  d=dict(zip(header,row));period=d['MES_LANCAMENTO'];origin=d['NE_CCOR'];org=str(d['ORGAO_CODIGO']);orgs[org]=d['ORGAO_DESCRICAO']
  require(period in ['000/2026','DEZ/2025','DEZ/2024'],'Período RAP inesperado')
  require(isinstance(origin,int) and origin<int(period[-4:]),'Origem incompatível')
  require(all(isinstance(d[k],(int,float)) and math.isfinite(d[k]) and d[k]>=0 for k in header[24:43]),f'Valor RAP inválido na linha {line}')
  def val(k):return Decimal(str(d[k]))
  residual=abs(val('RP_INSCRITOS_TOTAL')-val('RP_CANCELADOS_TOTAL')-val('RP_PAGOS_TOTAL')-val('RP_A_PAGAR_TOTAL'))
  require(residual<Decimal('.01'),'Ponte RAP não concilia por registro');maxres=max(maxres,residual)
  require(abs(val('RP_A_PAGAR_TOTAL')-val('RP_PROC_A_PAGAR')-val('RPNP_A_PAGAR'))<Decimal('.01'),'Tipos não conciliam')
  counts[period]+=1
  t=totals.setdefault(period,collections.defaultdict(Decimal))
  for k in ['RP_INSCRITOS_TOTAL','RP_CANCELADOS_TOTAL','RP_PAGOS_TOTAL','RP_A_PAGAR_TOTAL']:t[k]+=val(k)
  for tipo,prefix in [('processados','RP_PROC'),('nao-processados','RPNP')]:
   key=(period,org,origin,tipo)
   g=groups.setdefault(key,collections.defaultdict(Decimal))
   for out,suffix in [('inscritos','INSCRITOS'),('reinscritos','REINSCRITOS'),('pagos','PAGOS'),('cancelados','CANCELADOS'),('saldo','A_PAGAR')]:g[out]+=val(prefix+'_'+suffix)
 require(sum(counts.values())==67456,'Mudança de universo RAP: revisar publicação')
 records=[{'periodo':p,'orgao':o,'origem':a,'tipo':t,**{k:money(v) for k,v in g.items()}} for (p,o,a,t),g in sorted(groups.items())]
 checks=[]
 # Referência externa: relatório 2026, tabela 2, páginas 9–10, R$ bi com 1 decimal.
 published={'000/2026':[391.5,None,None,391.5],'DEZ/2025':[312.5,14.9,231.2,66.4],'DEZ/2024':[285.5,21.1,204.4,60.0]}
 for period,expected in published.items():
  fields=['RP_INSCRITOS_TOTAL','RP_CANCELADOS_TOTAL','RP_PAGOS_TOTAL','RP_A_PAGAR_TOTAL']
  for k,e in zip(fields,expected):
   if e is None:continue  # Travessões no relatório: fluxo ainda não aplicável à abertura.
   require(round(float(totals[period][k])/1e9,1)==e,'Divergência com relatório RAP')
   checks.append({'periodo':period,'campo':k,'reais':money(totals[period][k]),'relatorioBilhoes':e})
  for name,key in [('pagos','RP_PAGOS_TOTAL'),('cancelados','RP_CANCELADOS_TOTAL'),('saldo','RP_A_PAGAR_TOTAL')]:
   require(abs(sum(Decimal(str(r[name])) for r in records if r['periodo']==period)-totals[period][key])<Decimal('1'),'Agregação RAP divergente')
 rap={'captura':capture,'publicacao':'2026-01-29','fonte':provenance['rap2026.xlsx'],'relatorio':REPORT,'unidade':'R$ correntes','contagemFonte':dict(counts),'orgaos':orgs,'registros':records,'conferencia':checks,'residuoMaximoRegistroReais':float(maxres),'nota2025':'A edição 2026 incorpora aproximadamente R$ 1,9 bilhão de revalidações à base de RAP de 2025; não é uma coorte inicial imutável.'}
 z=zipfile.ZipFile(cache/'metas.zip');member=next(n for n in z.namelist() if n.endswith('_FisicoFinanceiro.csv'));raw=z.read(member)
 rows=list(csv.DictReader(io.StringIO(raw.decode('latin1')),delimiter=';'))
 locals=[r for r in rows if r['tipocaptacao']=='Captação por Localizador']
 require(len(rows)==21249 and len(locals)==7392,'Universo AFFO mudou: revisar')
 dictionaries={k:{} for k in ['orgaos','uos','funcoes','programas','acoes','localizadores','produtos','unidades']}
 mapping=[('orgaos','orgao','descricaoorgao'),('uos','unidadeorcamentaria','descricaounidadeorcamentaria'),('funcoes','funcao','descricaofuncao'),('programas','programa','tituloprograma'),('acoes','acao','tituloacao'),('produtos','produto','descricaoproduto'),('unidades','unidademedida','descricaounidademedida')]
 columns=['id','orgao','uo','funcao','programa','acao','localizador','produto','unidade','metaOriginal','metaAtual','metaReprogramada','realizado','apuracao','realizadoRAP','apuracaoRAP','autorizado','liquidado','pago','sinalCaptacao','linhaFonte','esfera']
 recordsM=[];seen=set();coverage=collections.Counter();flags=collections.defaultdict(lambda:collections.Counter())
 for line,r in enumerate(rows,start=2):
  if r['tipocaptacao']!='Captação por Localizador':continue
  require(r['exercicio']=='2025' and r['esfera'] in ['10','20'],'Perímetro AFFO inesperado')
  identity='-'.join(r[k] for k in ['exercicio','esfera','orgao','unidadeorcamentaria','programa','acao','localizador'])
  require(identity not in seen,'Programação duplicada');seen.add(identity)
  for key,code,label in mapping:
   code=r[code].strip();label=r[label].strip()
   if code:
    require(code not in dictionaries[key] or dictionaries[key][code]==label,f'Dicionário não unívoco: {key} {code}')
    dictionaries[key][code]=label
  # Localizadores não são códigos geográficos universais: chave com ação e UO.
  dictionaries['localizadores'][identity]=r['descricaolocalizador']
  values=[number(r[k]) for k in ['qtdemetaloa','qtdemetaatual','reprogramadofisico','realizadoloa','realizadorap','autorizado','liquidado','pago']]
  original,current,revised,real,realrap,authorized,liquidated,paid=values
  if not r['produto'].strip() or not r['unidademedida'].strip():status='sem-produto-unidade'
  elif real is None or current is None:status='ausente'
  elif current<=0 or real<0:status='inelegivel'
  elif not r['dataapuracaorealizadoloa'].strip():status='sem-data'
  else:status='calculavel'
  coverage[status]+=1;flags[r['elementosemcaptacao']][status]+=1
  for date in ['dataapuracaorealizadoloa','dataapuracaorealizadorap']:
   if r[date].strip():datetime.datetime.strptime(r[date],'%d/%m/%Y')
  recordsM.append([identity,r['orgao'],r['unidadeorcamentaria'],r['funcao'],r['programa'],r['acao'],r['localizador'],r['produto'].strip(),r['unidademedida'].strip(),original,current,revised,real,r['dataapuracaorealizadoloa'] or None,realrap,r['dataapuracaorealizadorap'] or None,authorized,liquidated,paid,r['elementosemcaptacao'],line,r['esfera']])
 metas={'captura':capture,'referencia':'2025-01/2025-12','edicaoArquivo':'2026-05-22','publicacao':None,'fonte':{**provenance['metas.zip'],'membro':member,'sha256CSV':hashlib.sha256(raw).hexdigest()},'dicionario':DIC,'nivel':'localizador','unidadeFinanceira':'R$ correntes','contagemFonte':{'total':len(rows),'localizadores':len(locals),'planosOrcamentariosExcluidos':len(rows)-len(locals)},'cobertura':dict(coverage),'sinalCaptacaoPorEstado':{k:dict(v) for k,v in flags.items()},'dicionarios':dictionaries,'colunas':columns,'registros':recordsM}
 dest=ROOT/'src/lib/contas-publicas/snapshots';dump(dest/'rap.json',rap);dump(dest/'metas.json',metas)
 print('RAP:',len(records),'agregados;',len(checks),'totais conferidos com relatório. AFFO:',len(recordsM),'localizadores;',dict(coverage))
if __name__=='__main__':main()
