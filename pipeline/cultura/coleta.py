"""Extrai células das publicações originais; não publica automaticamente."""
import argparse, csv, hashlib, json, tempfile, urllib.request, zipfile
from pathlib import Path
from pipeline.eficiencia.fontes.xlsx import linhas
ROOT = Path(__file__).parent
SOURCES = {
 'tic': {'url':'https://cetic.br/media/microdados/942/tic_cultura_2024_tabelas_xlsx_v1.0.zip','titulo':'TIC Cultura 2024 · tabelas v1.0','publicadoEm':'2025-10-07','referencia':'2024','metodo':'https://cetic.br/media/microdados/990/tic_cultura_2024_relatorio_metodologico_v1.0.pdf'},
 'ibge': {'url':'https://ftp.ibge.gov.br/Indicadores_Sociais/Sistema_de_Informacoes_e_Indicadores_Culturais/2024/xlsx/3_gastos_da_administracao_publica_20260310.xlsx','titulo':'IBGE · SIIC 2013–2024 · gastos da administração pública','publicadoEm':'2025-12-12','revisaoArquivo':'2026-03-10','referencia':'2013–2023'}
}
ABAS = ['A3','A4','B3C','B5','B10','C3','C11','D1','D2','D4B','D8']
def coleta(tic, ibge):
 rows=[]
 with tempfile.TemporaryDirectory() as tmp:
  with zipfile.ZipFile(tic) as z:z.extractall(tmp)
  p=Path(tmp)/'tic_cultura_2024_tabela_proporcao_v1.0.xlsx'
  m=Path(tmp)/'tic_cultura_2024_tabela_margem_de_erro_v1.0.xlsx'
  for aba in ABAS:
   prop=list(linhas(p,aba)); erros=list(linhas(m,aba))
   assert prop[0]==erros[0]
   for ri in range(4,11):
    assert prop[ri][:2]==erros[ri][:2]
    for ci in range(2,len(prop[ri])):
     # A3/A4: todas as categorias. Demais: resposta Sim, preservando denominador original.
     if aba not in ['A3','A4'] and prop[3][ci]!='Sim':continue
     v,e=prop[ri][ci],erros[ri][ci]
     assert isinstance(v,(int,float)) and isinstance(e,(int,float))
     categoria=prop[2][ci] if aba in ['A3','A4','C11'] else 'Sim'
     rows.append(['tic',aba,ri+1,ci+1,2024,prop[ri][1],categoria,v,e,'percentual'])
 for aba in ['Tabela 3.1','Tabela 3.2','Tabela 3.7']:
  rs=list(linhas(ibge,aba))
  if aba=='Tabela 3.2':
   ano=None
   for ri,r in enumerate(rs):
    if r and isinstance(r[0],float):ano=int(r[0])
    if r and r[0] in ['TOTAL','FEDERAL','ESTADUAL','MUNICIPAL'] and ano:
     # Cabeçalho diz %, mas célula armazena razão decimal; validação recalcula numerador/denominador.
     assert abs(r[1]/r[2]-r[3])<1e-10
     rows.append(['ibge',aba,ri+1,4,ano,r[0],'Participação da cultura na despesa',r[3]*100,'','percentual'])
  else:
   for ri,r in enumerate(rs):
    if not r or not isinstance(r[0],str) or len(r)<23 or not isinstance(r[1],(int,float)):continue
    if aba=='Tabela 3.7' and r[0] in ['BRASIL','NORTE','NORDESTE','SUDESTE','SUL','CENTRO-OESTE']:continue
    for i,ano in enumerate(range(2013,2024)):
     ci=1+i*2
     rows.append(['ibge',aba,ri+1,ci+1,ano,r[0],'Despesa com cultura',r[ci]*1000,'','reais nominais'])
 out=ROOT/'seed';out.mkdir(exist_ok=True)
 with (out/'celulas.csv').open('w',newline='',encoding='utf-8') as f:
  w=csv.writer(f,lineterminator="\n");w.writerow(['fonte','aba','linha','coluna','ano','entidade','categoria','valor','margem','unidade']);w.writerows(rows)
 manifest={'capturadoEm':'2026-10-11','fontes':[{**s,'id':id,'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest()} for id,s,path in [('tic',SOURCES['tic'],tic),('ibge',SOURCES['ibge'],ibge)]],'recorteSha256':hashlib.sha256((out/'celulas.csv').read_bytes()).hexdigest()}
 (out/'manifesto.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--tic',required=True);p.add_argument('--ibge',required=True);a=p.parse_args();coleta(a.tic,a.ibge)
