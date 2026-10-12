"""RFC 2025: extrai tabelas do PDF oficial. Python 3 + pypdf; fora do build."""
import argparse, datetime, hashlib, json, pathlib, re, urllib.request
from pypdf import PdfReader
ROOT=pathlib.Path(__file__).resolve().parents[2]
URL='https://cdn.tesouro.gov.br/sistemas-internos/apex/producao/sistemas/thot/arquivos/publicacoes/54904_1706197/RFC_2025%20de%2017_06_2026.pdf'
LANDING='https://www.tesourotransparente.gov.br/publicacoes/relatorio-foco-em-custos-rfc/2025/114'
EXPECTED='a4f30c1c0e6c1010a9e71eb3fb65c889ae412907c3884ab58343684c14c0d400'
def number(s):return float(s.replace('*','').replace('.','').replace(',','.').replace('%',''))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--pdf',type=pathlib.Path);a=ap.parse_args()
 raw=a.pdf.read_bytes() if a.pdf else urllib.request.urlopen(URL,timeout=90).read()
 assert hashlib.sha256(raw).hexdigest()==EXPECTED,'Edição mudou: revisar tabelas antes de atualizar'
 import io
 pdf=PdfReader(io.BytesIO(raw));records=[]
 def row(page,label,id,parent):
  lines=pdf.pages[page-1].extract_text().splitlines()
  hits=[s for s in lines if s.startswith(label+' ') and re.match(r'\s+\*?\d',s[len(label):]) and re.search(r'\d,\d',s)]
  assert hits and len(set(hits))==1,(label,hits)
  s=hits[0];vs=re.findall(r'-?\*?[\d.]+,\d%?',s[len(label):]);assert len(vs)==5,(label,vs)
  now,before,diff,nominal,real=map(number,vs)
  records.append(dict(id=id,parent=parent,nome=label,ano2025=now,ano2024=before,diferencaPublicada=diff,nominalPublicado=nominal,realPublicado=real,pagina=page))
 row(9,'Custos','total',None)
 for label,id in [('Mão de Obra e Funcionamento','operacao'),('Transferências e Incentivos','transferencias'),('Previdenciários e Assistenciais','previdencia'),('Financeiros','financeiros'),('Outros Custos','outros')]:row(9,label,id,'total')
 for label,id in [('Mão de Obra','mao-obra'),('Funcionamento','funcionamento')]:row(9,label,id,'operacao')
 for label,id in [('Outras Reduções Patrimoniais','reducoes'),('Repartição de Receita','reparticao')]:row(9,label,id,'fora-custos')
 for label,id in [('Mão de Obra Civil','civil'),('Mão de Obra Militar','militar')]:row(11,label,id,'mao-obra')
 for label,id in [('Serviços','servicos'),('Material de Consumo','material'),('Depreciação, Amortização e Exaustão','depreciacao'),('Juros e Encargos de Mora','mora')]:row(15,label,id,'funcionamento')
 for label,id in [('Serviços de Apoio','apoio'),('Serviços Técnicos','tecnicos'),('Diárias, Transportes e Passagens','diarias'),('Outros Serviços','outros-servicos'),('Energia Elétrica e Água','energia-agua'),('Locação e Manutenção de Bens','locacao')]:row(15,label,id,'servicos')
 for label,id in [('Material para Uso','material-uso'),('Material para Distribuição Gratuita','material-gratuito')]:row(15,label,id,'material')
 for label,id in [('Depreciação de Bens Móveis','moveis'),('Depreciação de Bens Imóveis','imoveis'),('Amortização','amortizacao')]:row(15,label,id,'depreciacao')
 checks=[]
 for parent in ['total','operacao','mao-obra','funcionamento','servicos','material','depreciacao']:
  p=next(r for r in records if r['id']==parent);children=[r for r in records if r['parent']==parent]
  for year in [2024,2025]:
   field='ano'+str(year);s=sum(r[field] for r in children);res=round(p[field]-s,6)
   assert abs(res)<=(len(children)+1)*.05+.000001,(parent,year,res)
   checks.append(dict(grupo=parent,ano=year,totalPublicado=p[field],somaParcelas=round(s,1),residuoMilhoes=res))
 out=dict(fonte=dict(nome='Tesouro Nacional · RFC 2025',url=URL,pagina=LANDING,sha256=EXPECTED,publicacao='2026-06-17'),captura=datetime.datetime.now(datetime.timezone.utc).isoformat(),unidade='R$ milhões correntes',periodo=[2024,2025],metodo='Extração das tabelas das páginas 9, 11 e 15; percentuais reais reproduzidos da fonte, calculados por ela com IPCA médio.',registros=records,conferencia=checks,notaRevisao='A edição 2025 revisou a classificação de 2024 entre Previdenciários e Assistenciais e Outros Custos, devido à metodologia da Proteção Social dos Militares. Comparações usam os dois anos desta mesma edição.',notaPrecisao='A tabela da página 9 informa totais de 3.661.983,6 e 3.429.963,1 milhões; o sumário informa 3.661.983,5 e 3.429.963,2 milhões, respectivamente. Mantêm-se os valores da tabela, sem ajustar parcelas. Resíduos de soma estão documentados no download.')
 target=ROOT/'src/lib/contas-publicas/snapshots/custos.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print(len(records),'linhas;',len(checks),'pontes conferidas; maior resíduo:',max(abs(c['residuoMilhoes']) for c in checks),'milhões')
if __name__=='__main__':main()
