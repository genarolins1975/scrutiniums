"""Materializa recorte SINISA 2025 (referência 2024), sem rede ou dependências externas."""
import csv,gzip,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).parent
URL='https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/'
REGIOES=['Norte','Nordeste','Sudeste','Sul','Centro-Oeste']
IDS=['BR','R-N','R-NE','R-SE','R-S','R-CO']
NOMES=['Brasil',*REGIOES]
INDICADORES={'agua':['IAG0001','IAG0002','IAG0003','IAG2002','IAG2003','IAG2013','IAG3004','IAG3005'], 'esgoto':['IES0001','IES0002','IES0003','IES2003','IES2004','IES3002']}
NOTAS={
'IAG0001':'População atendida por rede nos municípios representados pelo módulo. Não mede potabilidade, continuidade ou atendimento por soluções alternativas.',
'IAG0002':'Usa a população urbana do universo elegível ao indicador; não a população total.',
'IAG0003':'Usa a população rural do universo elegível. Soluções alternativas, como poços e cisternas, não são atendimento por rede.',
'IAG2002':'Volume micromedido dividido pelo volume consumido. Mede a presença de medição; não comprova precisão dos medidores.',
'IAG2003':'Na agregação por UF, região e Brasil, o SINISA zera as parcelas de água importada indicadas na nota metodológica. Valores superiores a 100% são preservados e exigem cautela.',
'IAG2013':'Inclui perdas reais e aparentes; não equivale apenas a vazamentos. Em nível Brasil, a fonte zera água importada e exportada na fórmula.',
'IAG3004':'Horas de paralisação divididas pela quantidade de paralisações declaradas. Não é duração anual média da falta de água por morador.',
'IAG3005':'Horas de interrupções sistemáticas divididas pelas ocorrências declaradas. O universo pode diferir do indicador de paralisações.',
'IES0001':'População atendida por rede coletora no universo do módulo de esgoto. Não inclui toda solução individual e não assegura tratamento.',
'IES0002':'População urbana atendida por rede coletora, em relação à população urbana elegível.',
'IES0003':'População rural atendida por rede coletora. Zero declarado é diferente de ausência de cálculo.',
'IES2003':'Volume tratado referido ao consumo de água. O consumo é uma aproximação da geração de esgoto; não equivale ao percentual de pessoas com tratamento.',
'IES2004':'Volume tratado referido ao volume coletado, com importações e exportações conforme a fórmula oficial. Uma taxa alta pode coexistir com acesso limitado à rede.',
'IES3002':'Tempo declarado de reparos dividido pelos extravasamentos reparados. Não representa espera de todos os usuários.'}

def numero(v):
 return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else None

def construir():
 seed=json.loads(gzip.decompress((BASE/'fontes.json.gz').read_bytes()))
 metrics=[];rows=[];sources=[]
 for p in seed['planilhas']:
  modulo=p['modulo'];s=p['abas'][0];linhas=s['linhas'];headers=11 if 'Indicadores' in p['arquivo'] and modulo=='agua' else 10
  codes=linhas[headers]; nomes=linhas[headers-2];units=linhas[headers-1]
  zipname='SINISA_Resultados_Ref2024.zip' if modulo=='agua' else 'SINISA_ESGOTO_Planilhas_2024.zip'
  sid=modulo+('-indicadores' if 'Indicadores' in p['arquivo'] else '-financeiro' if 'Administrativa' in p['arquivo'] else '-tecnico')
  sources.append({'id':sid,'arquivo':p['arquivo'],'url':URL+zipname,'sha256':p['sha256'],'aba':s['nome']})
  records=[]
  for ridx,r in enumerate(linhas[headers+1:],headers+2):
   if not r[0] or not r[1]:continue
   nome=r[0];tipo='Brasil' if nome=='Brasil' else 'Região' if nome in REGIOES else 'UF';id=r[1] if tipo!='Região' else IDS[NOMES.index(nome)]
   records.append((ridx,r,{'id':id,'nome':nome,'tipo':tipo}))
  if 'Indicadores' in p['arquivo']:
   meth={r[0]:r for r in p['abas'][1]['linhas'] if r and r[0] in INDICADORES[modulo]}
   for code in INDICADORES[modulo]:
    col=codes.index(code);me=meth[code];ag=modulo=='agua';formula=me[3 if ag else 2];bloqueio=me[5 if ag else 4] or 'Campos obrigatórios válidos e denominador diferente de zero.'
    metrics.append({'id':code,'grupo':modulo,'nome':nomes[col].strip(),'unidade':units[col].replace('Percentual','%'),'casas':2,'formula':formula,'base':'Universo elegível ao indicador na base municipal do SINISA; aplica campos obrigatórios e exclusões da nota metodológica.','nota':NOTAS[code],'regras':bloqueio,'fonte':sid})
    for ridx,r,t in records:rows.append({**t,'indicador':code,'valor':numero(r[col]),'numerador':None,'denominador':None,'origem':f"{s['nome']} · linha {ridx} · {code}"})
  elif 'Administrativa' in p['arquivo']:
   pref='AG' if modulo=='agua' else 'ES';desp='GFI2020' if modulo=='agua' else 'GFI2120';inv=['GFI2024','GFI2036'] if modulo=='agua' else ['GFI2124','GFI2136']
   for suffix,nome,cs in [('DESPESA','Despesa total', [desp]),('INVESTIMENTO','Investimento declarado',inv)]:
    for per in [False,True]:
     code=pref+'_'+suffix+('_HAB' if per else '')
     metrics.append({'id':code,'grupo':'recursos','nome':nome+(' por residente' if per else '')+' · '+('água' if modulo=='agua' else 'esgoto'),'unidade':'R$/habitante/ano' if per else 'R$/ano','casas':2,'formula':'('+' + '.join(cs)+')'+(' / DFE0001' if per else ''),'base':'População total residente consolidada na planilha financeira do módulo '+modulo+'.' if per else 'Total consolidado declarado ao módulo '+modulo+'.','nota':'Reais correntes de 2024. Inclui prestadores de diferentes naturezas; não é execução orçamentária exclusivamente pública. '+('Razão calculada pelo OBEE usando a população do módulo, não somente usuários atendidos. Campos financeiros ausentes não são imputados; a razão não corrige subdeclaração.' if per else 'Investimentos de prestadores e Estado são somados apenas na medida de investimento. Despesa e investimento não são somados.'),'regras':'Ausência não vira zero; denominador deve ser positivo.','fonte':sid})
     for ridx,r,t in records:
      vals=[numero(r[codes.index(c)]) for c in cs];v=sum(vals) if all(v is not None for v in vals) else None;den=numero(r[codes.index('DFE0001')]);value=v/den if per and v is not None and den and den>0 else None if per else v
      rows.append({**t,'indicador':code,'valor':value,'numerador':v if per else None,'denominador':den if per else None,'origem':f"{s['nome']} · linha {ridx} · {' + '.join(cs)}"})
 # Agregados publicados em relatórios: transcrição explícita, sem arredondamento inventado.
 for src in seed['relatorios']:sources.append({'id':src['modulo']+'-relatorio','arquivo':src['arquivo'],'url':URL+src['arquivo'],'sha256':src['sha256'],'aba':'Relatório'})
 def report(code,group,name,unit,vals,page,base,note,formula='Indicador publicado no relatório; sem recálculo pelo OBEE.'):
  metrics.append({'id':code,'grupo':group,'nome':name,'unidade':unit,'casas':2 if code in ['IRS3010','IGR0002'] else 1,'formula':formula,'base':base,'nota':note,'regras':'Valores publicados com a precisão da fonte. Ausências não imputadas.','fonte':group+'-relatorio'})
  for id,nome,v in zip(IDS,NOMES,vals):rows.append({'id':id,'nome':nome,'tipo':'Brasil' if id=='BR' else 'Região','indicador':code,'valor':v,'numerador':None,'denominador':None,'origem':f'Relatório {group}, p. {page}'})
 report('IRS0006','residuos','Cobertura urbana com coleta seletiva','%',[43.1,10.4,7.9,54.1,74.9,49.8],23,'População urbana do universo do indicador de coleta seletiva.','Cobertura de serviço não é massa efetivamente recuperada. Não comparar como se tivesse o mesmo denominador da taxa de recuperação.')
 report('IRS3010','residuos','Recuperação de recicláveis secos e orgânicos','%',[2.17,.52,.58,2.39,5.67,2.48],37,'Quantidade total coletada considerada pelo indicador.','Massa recuperada em relação à coletada; não é percentual da população atendida.')
 report('IRS3002','residuos','Disposição final inadequada','%',[23.2,55.0,33.1,11.9,2.3,48.7],43,'Massa de resíduos urbanos coletada e não recuperada nos municípios da amostra.','Encaminhamento para lixões e aterros controlados. Não confundir com estimativas de massa para todos os municípios ou com quantidade de unidades.')
 report('IAP0002','drenagem','Vias urbanas com redes subterrâneas pluviais','%',[32.7,22.5,16.0,33.3,52.8,26.6],21,'Extensão de vias públicas urbanas do universo elegível.','Rede subterrânea é uma parte da infraestrutura; o indicador não mede toda solução de drenagem nem proteção contra enchentes.','(GAP0305 / GAP0304) × 100')
 report('IGR0002','drenagem','População urbana impactada por eventos hidrológicos','%',[.55,1.75,.43,.16,1.54,.07],32,'População urbana no universo elegível; numerador: desabrigados e desalojados.','Autodeclarações municipais de 2024. Não representa todas as pessoas afetadas nem um cadastro deduplicado de indivíduos. Não equivale ao total do S2ID.','[(GAP2212 + GAP2213) / DFE0002] × 100')
 report('DOM_RISCO','drenagem','Domicílios sujeitos ao risco de inundação','domicílios',[2694600,196365,496518,1233459,612597,155661],39,'Domicílios identificados em áreas urbanas de risco pelos municípios informantes.','Soma de domicílios em municípios críticos e não críticos. É exposição declarada, não ocorrência no ano nem probabilidade estimada.','Domicílios em municípios críticos + não críticos')
 report('PLANO_DRENAGEM','drenagem','Municípios com Plano Diretor de Drenagem Urbana','municípios',[231,9,20,145,43,14],27,'Municípios participantes do módulo de águas pluviais.','Existência declarada do plano; não mede implementação, atualização ou qualidade.')
 coverage=[{'modulo':'Água','municipios':5144,'populacao':206818783,'fonte':'Relatório Água, p. 17'},{'modulo':'Esgoto','municipios':2749,'populacao':173640502,'fonte':'Relatório Esgoto, p. 17; planilha técnica publica DFE0001 = 188.255.906, universo distinto preservado nas razões financeiras'},{'modulo':'Resíduos','municipios':4854,'populacao':201110435,'fonte':'Relatório Resíduos, p. 18'},{'modulo':'Drenagem','municipios':4845,'populacao':197796894,'fonte':'Relatório Águas Pluviais, p. 17'}]
 return {'referencia':2024,'edicao':'SINISA 2025','captura':'2026-10-11','indicadores':metrics,'valores':rows,'fontes':sources,'cobertura':coverage}

def materializar(out=None):
 out=Path(out) if out else ROOT/'public/eficiencia/saneamento';out.mkdir(parents=True,exist_ok=True);d=construir()
 for name,obj in [('snapshot.json',d),('fontes.json',d['fontes'])]: (out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
 for grupo in ['agua','esgoto','recursos','residuos','drenagem']:
  ms={m['id']:m for m in d['indicadores'] if m['grupo']==grupo}
  with (out/(grupo+'.csv')).open('w',newline='',encoding='utf-8-sig') as f:
   w=csv.writer(f,delimiter=';',lineterminator='\n');w.writerow(['territorio','tipo','indicador','nome','valor','unidade','ano','numerador','denominador','universo','origem','fonte'])
   for r in d['valores']:
    if r['indicador'] in ms:
     m=ms[r['indicador']];w.writerow([r['nome'],r['tipo'],m['id'],m['nome'],r['valor'],m['unidade'],2024,r['numerador'],r['denominador'],m['base'],r['origem'],m['fonte']])
 return d
if __name__=='__main__':
 d=materializar();print(f"{len(d['indicadores'])} indicadores; {len(d['valores'])} observações")
