"""Função 11 Trabalho: DCA anual; RREO só para conferência, nunca soma.
Reutiliza respostas oficiais completas capturadas pelo pipeline OBEE.
Ausência da linha não é zero; recursos municipais não medem todos os programas.
"""
import gzip,json,hashlib,re,sys,urllib.request,urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
from pipeline.eficiencia.entes import CAPITAIS
from pipeline.eficiencia.padroniza import fatores_ipca
ROOT=Path(__file__).resolve().parents[2]
SEED=ROOT/'pipeline/eficiencia_trabalho/seed/rreo'
OUT=ROOT/'public/eficiencia/trabalho-renda/recursos.json'
API='https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo'

def capture(cod,ano):
 params={'an_exercicio':ano,'nr_periodo':6,'co_tipo_demonstrativo':'RREO','no_anexo':'RREO-Anexo 02','co_esfera':'M','id_ente':cod}
 url=API+'?'+urllib.parse.urlencode(params)
 dest=SEED/f'{cod}_{ano}.json.gz'
 if dest.exists():return
 try:
  rows=[]; offset=0
  while True:
   request=url+('&offset='+str(offset) if offset else '')
   with urllib.request.urlopen(request,timeout=45) as r:data=json.load(r)
   rows+=data.get('items',[])
   if not data.get('hasMore'):break
   offset+=data.get('limit',5000)
  raw=json.dumps(rows,ensure_ascii=False,sort_keys=True).encode()
  filtered=[r for r in rows if r.get('conta')=='Trabalho']
  result={'sha256Linhas':hashlib.sha256(json.dumps(filtered,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'url':url,'capturadoEm':datetime.now(timezone.utc).isoformat(),'sha256Resposta':hashlib.sha256(raw).hexdigest(),'linhas':filtered,'linhasResposta':len(rows)}
  dest.write_bytes(gzip.compress(json.dumps(result,ensure_ascii=False,sort_keys=True).encode(),mtime=0))
 except Exception as e:print('RREO indisponível',cod,ano,type(e).__name__,flush=True)

def build():
 manifest=json.loads((ROOT/'pipeline/eficiencia/seed/manifesto.json').read_text())['capturas']['siconfi_dca_anexo_i_e']['arquivos']
 fatores,_=fatores_ipca();obs=[];sub=[];sources=[]
 for cod,nome,uf in CAPITAIS:
  for ano in range(2021,2026):
   key=f'{cod}_{ano}';src=manifest.get(key);p=ROOT/'pipeline/eficiencia/seed/siconfi/dca_anexo_i_e'/f'{key}.json.gz'
   if not src or not p.exists():continue
   assert hashlib.sha256(gzip.decompress(p.read_bytes())).hexdigest()==src['sha256'],key
   rows=json.load(gzip.open(p,'rt'));liq=[r for r in rows if r.get('coluna')=='Despesas Liquidadas']
   totals=[r for r in liq if r.get('conta')=='11 - Trabalho'];v=float(totals[0]['valor']) if len(totals)==1 else None
   parts=[r for r in liq if re.match(r'^11\.\d{3} - ',r.get('conta','')) or r.get('conta','').startswith('FU11 ')]
   soma=sum(float(r['valor']) for r in parts);reconciled=v is not None and abs(soma-v)<=1
   rp=SEED/f'{key}.json.gz';r=json.load(gzip.open(rp,'rt')) if rp.exists() else None
   rr=[x for x in (r or {}).get('linhas',[]) if x.get('coluna')=='DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)' and 'Exceto' in x.get('rotulo','')]
   # Rótulo da coluna é conferido diretamente no contrato da API; nenhum fallback para empenhado.
   rv=float(rr[0]['valor']) if len(rr)==1 else None
   state='NAO_CONFERIDO' if rv is None or v is None else 'CONFERE' if abs(v-rv)<=1 else 'DIVERGENTE'
   provenance={'dca':src,'rreo':None if not r else {k:r[k] for k in ['url','capturadoEm','sha256Resposta','sha256Linhas']}}
   sources.append({'territorioId':str(cod),'periodo':str(ano),**provenance})
   obs.append({'territorioId':str(cod),'periodo':str(ano),'periodoNome':str(ano),'valor':v,'real2025':None if v is None else round(v*fatores[ano],2),'fatorIpca':fatores[ano],'status':'OBSERVADO' if v is not None else 'AUSENTE','conferencia':state,'rreoValor':rv,'diferencaRreo':None if v is None or rv is None else round(v-rv,2),'composicaoReconcilia':reconciled,'residuoComposicao':None if v is None else round(v-soma,2),'elegivelComparacao':state=='CONFERE','notaMaterial':v is not None and state!='CONFERE','nota':'DCA sem linha da função Trabalho; ausência não significa despesa zero.' if v is None else ('DCA e RREO divergem em R$ '+format(abs(v-rv),',.2f').replace(',','@').replace('.',',').replace('@','.')+'. Valor declarado na DCA, fora das referências comparativas enquanto não reconciliado.' if state=='DIVERGENTE' else 'Valor declarado na DCA sem conferência independente pelo RREO. Fora das referências comparativas.' if state=='NAO_CONFERIDO' else 'DCA e RREO conferem. Despesa declarada na função 11 pelo município; não representa toda a política pública de trabalho no território.')})
   for row in parts:sub.append({'territorioId':str(cod),'periodo':str(ano),'codigo':row['conta'].split(' - ')[0],'nome':row['conta'].split(' - ')[-1],'valor':float(row['valor']),'reconcilia':reconciled})
 out={'capturadoEm':max(s['dca']['capturado_em'] for s in sources),'universo':'Execução declarada das 26 prefeituras das capitais estaduais, função 11 Trabalho. Distrito Federal fora por acumular competências estaduais e municipais. Não inclui a execução federal ou estadual nem ações classificadas em outras funções.','unidade':'R$','estagio':'Despesas Liquidadas','baseReal':'Reais de 2025 pelo IPCA médio anual','periodos':['2021','2022','2023','2024','2025'],'territorios':[{'id':str(c),'nome':n+' ('+u+')','nivel':'municipio'} for c,n,u in CAPITAIS],'observacoes':obs,'subfuncoes':sub,'proveniencia':sources,'fontes':[{'id':'siconfi-trabalho','nome':'Tesouro Nacional — Siconfi / DCA Anexo I-E','url':'https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos','limitacoes':'A classificação funcional não cobre todas as ações de emprego e renda. DCA e RREO são conferidos separadamente. Divergências não demonstram eficiência ou desperdício.'}]}
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('Recursos',len(obs),'observações;',sum(x['valor'] is not None for x in obs),'com linha;',sum(x['conferencia']=='CONFERE' for x in obs),'conferem RREO',flush=True)
if __name__=='__main__':
 if '--coletar' in sys.argv:
  with ThreadPoolExecutor(max_workers=4) as ex:
   for f in as_completed([ex.submit(capture,c,y) for c,_,_ in CAPITAIS for y in range(2021,2026)]):f.result()
 build()
