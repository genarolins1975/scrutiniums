"""Seed auditável → padronização → validação → promoção da publicação Cultura."""
import csv, hashlib, json, math
from pathlib import Path
ROOT=Path(__file__).parent
DEST=ROOT.parents[1]/'public/eficiencia/cultura'
TIPOS=['Arquivo','Bem tombado','Biblioteca','Cinema','Museu','Ponto de Cultura','Teatro']
ESFERAS=['TOTAL','FEDERAL','ESTADUAL','MUNICIPAL']
TITULOS={
 'A3':('rede','Distribuição por região','Participação de cada região no universo de cada tipo; não é cobertura da população.'),
 'A4':('rede','Natureza jurídica','Público e privado no mesmo universo. A natureza não identifica a origem de todos os recursos.'),
 'B3C':('acesso','Computadores para o público','Equipamentos que disponibilizam computadores para uso do público.'),
 'B5':('acesso','Uso de internet pela instituição','Equipamentos que usaram internet nos últimos 12 meses; não implica acesso oferecido ao público.'),
 'B10':('acesso','Wi-Fi para o público','Equipamentos que disponibilizam Wi-Fi para o público; não mede qualidade ou velocidade.'),
 'C3':('acesso','Website próprio','Equipamentos que possuem website próprio; presença em sites de terceiros ou redes sociais é outra medida.'),
 'C11':('atividades','Atividades realizadas','Uma instituição pode realizar várias atividades; percentuais não devem ser somados.'),
 'D1':('acervos','Possui acervo','Existência de acervo; não mede preservação, acessibilidade ou qualidade.'),
 'D2':('acervos','Digitaliza acervo','Equipamentos que digitalizam acervo; não é percentual de itens digitalizados.'),
 'D4B':('acervos','Acervo digital na internet','Equipamentos que disponibilizam acervo digital para o público na internet; não é percentual do acervo disponível.'),
 'D8':('acervos','Catálogo na internet','Equipamentos que disponibilizam catálogo do acervo na internet; catálogo não equivale ao conteúdo do acervo.')}
def build():
 manifest=json.loads((ROOT/'seed/manifesto.json').read_text())
 assert hashlib.sha256((ROOT/'seed/celulas.csv').read_bytes()).hexdigest()==manifest['recorteSha256'],'Hash do seed difere'
 with (ROOT/'seed/celulas.csv').open(encoding='utf-8',newline='') as f:rows=list(csv.DictReader(f))
 tic=[];gastos=[];ufs=[];pesos={}
 for r in rows:
  v=float(r['valor']);assert math.isfinite(v) and v>=0
  origem={k:r[k] for k in ['fonte','aba']};origem.update(linha=int(r['linha']),coluna=int(r['coluna']))
  if r['fonte']=='tic':
   m=float(r['margem']);assert 0<=v<=100 and math.isfinite(m) and 0<=m<=100
   assert r['entidade'] in TIPOS
   tic.append({'aba':r['aba'],'tipo':r['entidade'],'categoria':r['categoria'],'valor':v,'margem':m,'origem':origem})
  elif r['aba']=='Tabela 3.2':pesos[(int(r['ano']),r['entidade'])]=v
  else:
   obj={'ano':int(r['ano']),'entidade':r['entidade'].title(),'valor':v,'origem':origem}
   (gastos if r['aba']=='Tabela 3.1' else ufs).append(obj)
 for r in gastos:r['pesoOrcamento']=pesos[(r['ano'],r['entidade'].upper())]
 assert len(tic)==210 and len(gastos)==44 and len(ufs)==297
 assert len({(r['aba'],r['tipo'],r['categoria']) for r in tic})==len(tic)
 checks=[]
 for ano in range(2013,2024):
  g=[r for r in gastos if r['ano']==ano]
  total=next(r['valor'] for r in g if r['entidade']=='Total')
  subtotal=sum(r['valor'] for r in g if r['entidade']!='Total')
  assert abs(total-subtotal)<.01
  estadual=next(r['valor'] for r in g if r['entidade']=='Estadual')
  assert abs(estadual-sum(r['valor'] for r in ufs if r['ano']==ano))<.01
  checks.append({'ano':ano,'esferasReconciliadas':True,'ufsReconciliadas':True})
 for aba in ['A3','A4']:
  for tipo in TIPOS:assert abs(sum(r['valor'] for r in tic if r['aba']==aba and r['tipo']==tipo)-100)<.01
 catalog=[]
 for aba,(capitulo,titulo,limite) in TITULOS.items():
  catalog.append({'id':'cultura.'+aba.lower()+'.equipamento','nome':titulo,'familia':capitulo,'pergunta':titulo+'?','o_que_mede':'Percentual publicado da categoria no universo de cada tipo de equipamento cultural listado nos cadastros oficiais.','o_que_nao_mede':limite,'formula':'Transcrição da estimativa e da margem de erro da publicação; sem reponderação.','numerador':'Estimativa ponderada de equipamentos na categoria','denominador':'Total do mesmo tipo de equipamento no universo da pesquisa','unidade':'% de equipamentos; margem em pontos percentuais','fontes':['tic'],'localizacao_registro':aba+'; arquivo de proporções e de margens de erro, mesma linha e coluna','periodo':'2024; últimas atividades conforme janela do questionário','perimetro':'Brasil; sete tipos de equipamentos; inclui públicos e privados','ausencias':'Nenhuma ausência convertida em zero; respostas não publicadas no recorte não são inferidas por complemento.','transformacoes':'Sem alteração de estimativas; intervalos visuais valor ± margem limitados a 0–100%.','estado_publicacao':'publicado','limites':limite+' Margens com confiança de 95%; diferenças pequenas não demonstram diferença estatística.'})
 catalog.append({'id':'cultura.despesa.governo','nome':'Despesa com cultura','familia':'recursos','pergunta':'Quanto registram as esferas e governos estaduais?','o_que_mede':'Despesa publicada no SIIC, com classificação e consolidação da STN; por esfera e por governo estadual/distrital.','o_que_nao_mede':'Custo por atendimento, renúncia fiscal, captação incentivada, despesa de uma capital ou efeito de políticas.','formula':'Valor de origem em mil reais × 1.000; participação no orçamento da Tabela 3.2 × 100.','numerador':'Despesa com cultura','denominador':'Despesa total da própria esfera, somente na medida de participação','unidade':'R$ nominais; % da despesa da esfera','fontes':['ibge'],'localizacao_registro':'Tabelas 3.1, 3.2 e 3.7; células no seed','periodo':'2013–2023','perimetro':'Brasil; federal, estadual e municipal; 26 estados e DF na comparação estadual','ausencias':'Ausência não vira zero. Todos os 27 governos estaduais/distrital disponíveis.','transformacoes':'Conversão de unidade; sem deflator, per capita ou soma com renúncia fiscal.','estado_publicacao':'publicado','limites':'Valores correntes de cada ano; variação nominal não mede variação do poder de compra. DF tem competências próprias; origem do recurso não é separada nesta tabela.'})
 return {'versao':'1.0','capturadoEm':manifest['capturadoEm'],'fontes':manifest['fontes'],'tipos':TIPOS,'tic':tic,'gastos':gastos,'ufs':ufs,'catalogo':catalog,'validacoes':checks}
def main():
 data=build();DEST.mkdir(parents=True,exist_ok=True)
 (DEST/'snapshot.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (DEST/'celulas.csv').write_bytes((ROOT/'seed/celulas.csv').read_bytes())
 (DEST/'manifesto.json').write_bytes((ROOT/'seed/manifesto.json').read_bytes())
 print(f"Cultura: {len(data['tic'])} estimativas TIC, {len(data['gastos'])} registros por esfera, {len(data['ufs'])} registros estaduais. 11 anos reconciliados.")
if __name__=='__main__':main()
