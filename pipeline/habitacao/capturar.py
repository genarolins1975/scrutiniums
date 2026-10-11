"""FJP 2024. Fontes XLSX e tabela 30 do relatório; reprodução determinística sem rede."""
import argparse,csv,gzip,hashlib,io,json,re
from pathlib import Path
from pipeline.justica.capturar import read_sheet
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/eficiencia/habitacao'; SEED=ROOT/'pipeline/habitacao/seed'
GRUPOS={'Norte':[('RO','Rondônia'),('AC','Acre'),('AM','Amazonas'),('RR','Roraima'),('PA','Pará'),('AP','Amapá'),('TO','Tocantins')], 'Nordeste':[('MA','Maranhão'),('PI','Piauí'),('CE','Ceará'),('RN','Rio Grande do Norte'),('PB','Paraíba'),('PE','Pernambuco'),('AL','Alagoas'),('SE','Sergipe'),('BA','Bahia')], 'Sudeste':[('MG','Minas Gerais'),('ES','Espírito Santo'),('RJ','Rio de Janeiro'),('SP','São Paulo')], 'Sul':[('PR','Paraná'),('SC','Santa Catarina'),('RS','Rio Grande do Sul')], 'Centro-Oeste':[('MS','Mato Grosso do Sul'),('MT','Mato Grosso'),('GO','Goiás'),('DF','Distrito Federal')]}
TERRITORIOS={nome:(uf,'UF',reg) for reg,ufs in GRUPOS.items() for uf,nome in ufs}
TERRITORIOS.update({reg:(reg,'Região',reg) for reg in GRUPOS});TERRITORIOS['Brasil']=('BR','Brasil','Brasil')
ABAS={'inadequados':'Inadequados','infraestrutura':'Inadequação_de_Infraestrutura','agua':'Abastecimento','esgoto':'Esgotamento','lixo':'Coleta_de_Lixo','energia':'Energia_Elétrica','edilicia':'Inadequação_Edilícias','armazenamento':'Aramazenamento','dormitorios':'Cômodos_Dormitório','cobertura':'Cobertura','banheiro':'Ausência_Banheiro','piso':'Piso','fundiariaExclusiva':'Inadeq_Fundiária','urbanosDuraveis':'Domicílios_urbanos_duráveis'}
IDS={'deficit.xlsx':'1AwlL17JBmASv8Jurnkb6zhfXc0fzGQwp','inadequacao.xlsx':'1Qg5DSnJRrsvqoZeCItJ-KPHNtuMf_JE6','deficit.pdf':'1wcGG-95LHqzhjXbtTvCnFh2XX2vL0xyW','inadequacao.pdf':'1mJwFkcxnOBR1J2JG2uVFyXcw7N3FVIj2'}
def index(path,sheet,key):
 return {str(c[key]).strip():(row,c) for row,c in read_sheet(path,sheet) if key in c and str(c[key]).strip() in TERRITORIOS}
def validate(d):
 rows=d['territorios']; assert len(rows)==33 and len({r['id'] for r in rows})==33
 assert len([r for r in rows if r['tipo']=='UF'])==27
 for r in rows:
  assert abs(r['deficit']/r['domicilios']-r['relativoPublicado'])<1e-6
  assert abs(r['urbano']+r['rural']-r['deficit'])<1
  assert abs(r['precaria']+r['coabitacao']+r['aluguel']-r['deficit'])<1
  assert abs(sum(r[k] for k in ['renda1','renda2','renda3','rendaMais3'])-r['rendaTotal'])<1
  assert 0<=r['inadequados']<=r['urbanosDuraveis']
  assert r['fundiariaExclusiva']<=r['fundiaria']<=r['inadequados']
  for k in ABAS:assert isinstance(r[k],(int,float)) and r[k]>=0
 br=next(r for r in rows if r['id']=='BR')
 assert round(br['deficit'])==5773983 and br['inadequados']==27861107
 assert abs(sum(r['deficit'] for r in rows if r['tipo']=='UF')-br['deficit'])<1

def collect(folder):
 folder=Path(folder);dp=folder/'deficit.xlsx';ip=folder/'inadequacao.xlsx'
 deficit=index(dp,'Deficit_habitacional','B');comp=index(dp,'DH_Componentes','B');renda=index(dp,'DH_faixa_renda','B');dom=index(dp,'Total_domicilios_ocupados','A');ina={k:index(ip,a,'D') for k,a in ABAS.items()}
 text=(folder/'inadequacao.txt').read_text();start=text.index('Tabela 30: Domicílios duráveis urbanos ocupados com Inadequação Fundiária',text.index('3.250.536 domicílios'))
 table=text[start:text.index('A Tabela 31 apresenta',start)]
 rows=[]
 for nome,(id,tipo,regiao) in TERRITORIOS.items():
  line,a=deficit[nome];lc,b=comp[nome];lr,c=renda[nome];ld,e=dom[nome]
  r=dict(id=id,nome=nome,tipo=tipo,regiao=regiao,ano=2024,deficit=a['E'],urbano=a['C'],rural=a['D'],relativoPublicado=a['F'],domicilios=e['D'],precaria=b['E'],improvisados=b['C'],rusticos=b['D'],coabitacao=b['H'],comodos=b['F'],conviventes=b['G'],aluguel=b['I'],renda1=c['C'],renda2=c['D'],renda3=c['E'],rendaMais3=c['F'],rendaTotal=c['G'],origem={'deficit':f'Deficit_habitacional!C{line}:F{line}','componentes':f'DH_Componentes!C{lc}:J{lc}','renda':f'DH_faixa_renda!C{lr}:G{lr}','domicilios':f'Total_domicilios_ocupados!D{ld}'})
  for k,aba in ABAS.items():
   li,v=ina[k][nome];r[k]=v['E'];r['origem'][k]=f'{aba}!E{li}'
  match=re.findall(r'^\s*'+re.escape(nome)+r'\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$',table,re.M)
  assert len(match)==1,(nome,match)
  r['fundiaria']=int(match[0][2].replace('.',''));r['origem']['fundiaria']='Relatório Inadequação 2024, tabela 30, pp. 87–89 (numeração impressa)'
  rows.append(r)
 fontes=[dict(arquivo=f,url='https://drive.google.com/uc?export=download&id='+id,sha256=hashlib.sha256((folder/f).read_bytes()).hexdigest()) for f,id in IDS.items()]
 d=dict(versao=1,ano=2024,capturadoEm='2026-10-10',edicao='FJP 2026 — bases de 11/06/2026',territorios=rows,fontes=fontes)
 validate(d);SEED.mkdir(parents=True,exist_ok=True)
 (SEED/'recorte.json.gz').write_bytes(gzip.compress(json.dumps(d,ensure_ascii=False,sort_keys=True).encode(),mtime=0));(SEED/'tabela30.txt').write_text(table)
 return d

def publish(d,out=OUT):
 validate(d);out.mkdir(parents=True,exist_ok=True)
 (out/'snapshot.json').write_text(json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
 (out/'fontes.json').write_text(json.dumps(d['fontes'],ensure_ascii=False,sort_keys=True,indent=2)+'\n')
 tables={'deficit':['deficit','relativoPublicado','domicilios','urbano','rural'],'componentes':['precaria','improvisados','rusticos','coabitacao','comodos','conviventes','aluguel'],'renda':['renda1','renda2','renda3','rendaMais3','rendaTotal'],'inadequacao':list(ABAS)+['fundiaria']}
 for name,cols in tables.items():
  fields=['id','nome','tipo','regiao','ano']+cols+['origem'];s=io.StringIO();w=csv.DictWriter(s,fieldnames=fields,delimiter=';');w.writeheader()
  for r in d['territorios']:w.writerow({k:json.dumps(r[k],ensure_ascii=False,sort_keys=True) if k=='origem' else r[k] for k in fields})
  (out/(name+'.csv')).write_text('\ufeff'+s.getvalue(),encoding='utf-8')
 print('Publicado:',len(d['territorios']),'territórios')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--fontes');p.add_argument('--reproduzir',action='store_true');a=p.parse_args()
 d=json.loads(gzip.decompress((SEED/'recorte.json.gz').read_bytes())) if a.reproduzir else collect(a.fontes);publish(d)
