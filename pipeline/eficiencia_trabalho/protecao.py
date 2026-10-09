"""Cadastro Único / MI Social: contagens municipais, nunca taxa de pobreza.
Família cadastrada não é domicílio da PNAD nem beneficiária automática.
"""
import json,urllib.request,urllib.parse,hashlib,gzip
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2]
API='https://aplicacoes.mds.gov.br/sagi/servicos/misocial'
FIELDS={'cadun_qtd_familias_cadastradas_i':('cad-familias','Famílias inscritas no Cadastro Único'),'cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i':('cad-baixa-renda','Famílias cadastradas com renda por pessoa até meio salário mínimo'),'cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i':('cad-atualizadas','Famílias de até meio salário mínimo com cadastro atualizado')}
PERIODS=['202312','202412','202512','202609']

def capture(period):
 query={'q':'*:*','fq':f'anomes_s:{period}','rows':6000,'wt':'json','fl':'codigo_ibge,municipio,sigla_uf,anomes_s,'+','.join(FIELDS)}
 url=API+'?'+urllib.parse.urlencode(query)
 with urllib.request.urlopen(url,timeout=60) as r:raw=r.read()
 d=json.loads(raw);docs=d['response']['docs'];assert len(docs)==d['response']['numFound'],period
 p=ROOT/'public/eficiencia/trabalho-renda/brutos'/f'mds-cadunico-{period}.json.gz';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(gzip.compress(raw,mtime=0))
 return period,docs,{'id':'mds-cadunico-'+period,'nome':'MDS — Cadastro Único, MI Social','url':API,'consulta':url,'periodo':{'frequencia':'mensal','inicio':int(period),'fim':int(period)},'universo':'Famílias inscritas no Cadastro Único, segundo registro municipal.','limitacoes':['Inscrição no Cadastro Único não implica recebimento de benefício.','O cadastro cobre famílias inscritas, não toda a população de baixa renda.','Não comparar diretamente família cadastrada com domicílio da PNAD.','Cadastro atualizado significa atualização nos últimos dois anos.','Totais de Brasil e UF são somas municipais desta extração, sem deduplicação de pessoas.'],'capturadoEm':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'bruto':'/eficiencia/trabalho-renda/brutos/'+p.name}

def build(results):
 ref=json.loads((ROOT/'public/eficiencia/trabalho-renda/snapshot.json').read_text());territorios=list(ref['territorios']);
 for municipio in json.load(gzip.open(ROOT/'public/eficiencia/trabalho-renda/brutos/ibge-municipios-atuais.json.gz','rt')):
  if not any(t['id']==str(municipio['id']) for t in territorios):territorios.append({'id':str(municipio['id']),'nome':municipio['nome'],'nivel':'municipio'})
 lookup={t['id'][:6]:t['id'] for t in territorios if t['nivel']=='municipio'};obs=[];sources=[]
 for period,docs,source in results:
  sources.append(source);values={};coverage={}
  for doc in docs:
   c=str(doc.get('codigo_ibge',''));cod=lookup.get(c)
   if not cod:raise ValueError('Município MDS sem correspondência oficial: '+c)
   for field,(iid,name) in FIELDS.items():
    v=doc.get(field);v=float(v) if isinstance(v,(int,float)) else None
    for group in ['1',cod[:2]]:
     if v is not None:values[group,iid]=values.get((group,iid),0)+v;coverage[group,iid]=coverage.get((group,iid),0)+1
    if period==PERIODS[-1]:obs.append({'indicadorId':iid,'territorioId':cod,'periodo':period,'periodoNome':period[4:]+'/'+period[:4],'valor':v,'sexo':'total','grupo':'Total','status':'observado' if v is not None else 'ausente','cv':None,'fonteId':source['id']})
  for (tid,iid),v in values.items():obs.append({'indicadorId':iid,'territorioId':tid,'periodo':period,'periodoNome':period[4:]+'/'+period[:4],'valor':v,'sexo':'total','grupo':'Total','status':'observado','cv':None,'fonteId':source['id'],'municipiosComDado':coverage[tid,iid]})
 snapshot={'versao':1,'capturadoEm':max(s['capturadoEm'] for s in sources),'fontes':sources,'territorios':territorios,'indicadores':[{'id':iid,'nome':name,'unidade':'famílias','fonteId':sources[-1]['id'],'universo':'Famílias inscritas no Cadastro Único. Totais nacionais/UF calculados por soma municipal.','limitacao':'Inscrição não é benefício recebido nem estimativa de pobreza. Séries nacionais/UF exibem dezembro de 2023, 2024, 2025 e setembro de 2026; os pontos não representam todo o intervalo.'} for iid,name in FIELDS.values()],'observacoes':obs,'notas':['Retrato municipal de setembro de 2026; referências Brasil/UF são somas dos registros municipais.','Número de famílias cadastradas pode variar por inclusão, exclusão e atualização cadastral.']}
 p=ROOT/'public/eficiencia/trabalho-renda/cadastro.json';p.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n');print('Cadastro',len(obs),'observações',flush=True)
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=4) as ex:build(list(ex.map(capture,PERIODS)))
