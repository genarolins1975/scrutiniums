"""Fontes públicas: FNDE/PNAE e IBGE/IPCA. Usa bytes originais e universos separados."""
import json, gzip, csv, io, hashlib, datetime, pathlib, urllib.request, unicodedata, collections
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/eficiencia/seguranca-alimentar'
CACHE=ROOT.parent/'seguranca-fontes'
CACHE.mkdir(parents=True,exist_ok=True)
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'brutos').mkdir(exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
URL_PNAE='https://www.fnde.gov.br/plataforma-antonieta-de-barros-api/products/data-products/82/artifact'
URL_IPCA='https://servicodados.ibge.gov.br/api/v3/agregados/7060/periodos/202301-202609/variaveis/63|2265?localidades=N1[all]&classificacao=315[7169,7170,7171,7432]'
URL_MUN='https://servicodados.ibge.gov.br/api/v1/localidades/municipios'
def capture(name,url):
    p=CACHE/name
    if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=90).read())
    return p.read_bytes()
def unpack(b):return gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s.upper()) if not unicodedata.combining(c) and c.isalnum())
def save(name,data):
    (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def raw(name,b):
    (OUT/'brutos'/name).write_bytes(b)
    return '/eficiencia/seguranca-alimentar/brutos/'+name
def source(id,nome,url,consulta,b,bruto,inicio,fim,universo,limits,freq='anual'):
    return dict(id=id,nome=nome,url=url,consulta=consulta,periodo=dict(frequencia=freq,inicio=inicio,fim=fim),universo=universo,limitacoes=limits,capturadoEm=NOW,sha256=hashlib.sha256(b).hexdigest(),bruto=bruto)
def obs(id,ter,per,value,fid,grupo='Total',dim='Total',nota=None):
    meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
    nome=f'{meses[int(str(per)[4:])-1]} de {str(per)[:4]}' if len(str(per))==6 else str(per)
    return dict(indicadorId=id,territorioId=str(ter),periodo=str(per),periodoNome=nome,valor=value,status='ausente' if value is None else 'observado',fonteId=fid,grupo=grupo,dimensao=dim,cv=None,nota=nota)
mun_raw=unpack(capture('municipios.json',URL_MUN)); mun=json.loads(mun_raw)
ufs={}
territorios=[dict(id='1',nome='Brasil',nivel='brasil')]
mapping={}
for m in mun:
    uf=(m.get('microrregiao') or {}).get('mesorregiao',{}).get('UF') or m['regiao-imediata']['regiao-intermediaria']['UF']
    ufs[uf['sigla']]=dict(id=str(uf['id']),nome=uf['nome'],nivel='uf',uf=uf['sigla'])
    t=dict(id=str(m['id']),nome=m['nome'],nivel='municipio',uf=uf['sigla'])
    territorios.append(t);mapping[uf['sigla'],norm(m['nome'])]=t
territorios+=sorted(ufs.values(),key=lambda x:x['nome'])
raw('ibge-municipios.json.gz',gzip.compress(mun_raw,mtime=0))
b=unpack(capture('ipca.json',URL_IPCA));prices=json.loads(b)
price_limits=['IPCA mede variação de preços ao consumidor, não o custo em reais de uma cesta nem o preço no atacado.','Cobertura Brasil nesta publicação. A série não é um índice municipal e não estima comprometimento da renda de cada família.','Variação em 12 meses é a medida oficial da fonte, não a soma de taxas mensais.']
price_source=source('ibge-ipca','IBGE · IPCA · tabela 7060','https://sidra.ibge.gov.br/tabela/7060',URL_IPCA,b,raw('ibge-ipca.json.gz',gzip.compress(b,mtime=0)),2023,2026,'Preços ao consumidor do IPCA, Brasil; população-objetivo da pesquisa.',price_limits,'mensal')
price_source['documentacao']=['SHA-256 refere-se aos bytes JSON descomprimidos. O bruto disponível é a compressão gzip, sem alteração do conteúdo JSON; descomprimir antes de conferir o hash.']
inds=[];observacoes=[]
names={'7169':'Índice geral','7170':'Alimentação e bebidas','7171':'Alimentação no domicílio','7432':'Alimentação fora do domicílio'}
for variable in prices:
    for result in variable['resultados']:
        cat=next(iter(result['classificacoes'][0]['categoria']))
        id='ipca-'+cat+'-'+variable['id']
        label='variação mensal' if variable['id']=='63' else 'variação em 12 meses'
        inds.append(dict(id=id,nome=names[cat]+' · '+label,unidade='%',fonteId='ibge-ipca',universo=price_source['universo'],limitacao=price_limits[0],categoria='Preços',frequencia='mensal'))
        for serie in result['series']:
            for period,v in serie['serie'].items():observacoes.append(obs(id,'1',period,float(v) if v not in ['...','-','X','..'] else None,'ibge-ipca'))
save('precos.json',dict(versao=1,capturadoEm=NOW,fontes=[price_source],territorios=[territorios[0]],indicadores=inds,observacoes=observacoes,notas=price_limits))
b=capture('pnae.gz',URL_PNAE)
rows=list(csv.DictReader(io.StringIO(gzip.decompress(b).decode('utf-8-sig')),delimiter=';'))
assert len({(r['Ano_Exercicio'],r['CNPJ_Responsavel']) for r in rows})==len(rows),'Duplicidade entidade/ano'
for r in rows:
    assert r['UF'] in ufs
    assert int(r['Quantidade_Alunos'])>=0 and int(r['Quantidade_Escolas'])>=0
    if r['Valor_Repasse'] is not None:assert Decimal(r['Valor_Repasse'])>=0
groups=collections.defaultdict(list);unmatched=[]
for r in rows:
    year=r['Ano_Exercicio']; uf=ufs[r['UF']]['id']
    rede='Rede estadual/distrital' if r['Entidade_Responsavel'].startswith(('SECRET','SECR','MINAS')) else 'Rede municipal'
    for ter in ['1',uf]:
        groups[ter,year,rede].append(r);groups[ter,year,'Conjunto das redes'].append(r)
    if year=='2025' and rede=='Rede municipal':
        t=mapping.get((r['UF'],norm(r['Municipio'])))
        if t:groups[t['id'],year,rede].append(r)
        else:unmatched.append({'uf':r['UF'],'municipio':r['Municipio'],'entidade':r['CNPJ_Responsavel']})
limits=['São transferências federais informadas pelo FNDE, em reais nominais; não são despesa executada pelo ente, custo da refeição ou refeições efetivamente servidas.','Alunos e escolas são quantidades registradas no arquivo por entidade/ano, sem verificação de pessoas únicas ou frequência à alimentação.','2026 é exercício em curso: valor acumulado na captura, sem comparação automática com exercício completo.','Valores de repasse ausentes permanecem ausentes. A soma dos valores informados tem cobertura declarada por entidade; ausência não significa zero.','Brasil e UF agregam entidades por rede; repasses da rede estadual/distrital não são atribuídos ao município sede. Municípios têm apenas a rede municipal de 2025 nesta publicação.','Identificação municipal por UF e nome normalizado na lista oficial atual do IBGE; nomes não conciliados ficam fora do recorte municipal, preservados na agregação estadual e nacional.']
f=source('fnde-pnae','FNDE · PNAE · repasses, alunos e escolas','https://www.fnde.gov.br/plataforma-antonieta-de-barros/dados/produtos-de-dados/visualizar/82',URL_PNAE,b,raw('fnde-pnae.txt.gz',b),2009,2026,'Entidades executoras das redes municipais e estaduais/distrital presentes no arquivo FNDE; agregação pelo ente responsável.',limits)
f['documentacao']=['SHA-256 refere-se aos bytes do artefato gzip original recebido do FNDE e disponível em bruto, antes de descomprimir. Lista de municípios não conciliados e contagem de ausências: /eficiencia/seguranca-alimentar/brutos/pnae-conciliacao.json.']
inds=[dict(id=id,nome=nome,unidade=unit,fonteId=f['id'],universo=f['universo'],limitacao=limit,categoria='Alimentação escolar',frequencia='anual') for id,nome,unit,limit in [
    ('pnae-repasses','Repasses federais informados','R$',limits[0]+' '+limits[3]),
    ('pnae-alunos','Alunos registrados no PNAE','alunos registrados',limits[1]),
    ('pnae-escolas','Escolas registradas no PNAE','escolas registradas',limits[1]),
    ('pnae-cobertura','Entidades com valor de repasse informado','%',limits[3])]]
observacoes=[]
for (ter,year,group),rs in sorted(groups.items()):
    known=[r for r in rs if r['Valor_Repasse'] is not None]
    note=f'{len(known)} de {len(rs)} entidades com valor de repasse informado.'+(' Exercício em curso; acumulado na captura.' if year=='2026' else '')
    vals=[float(sum((Decimal(r['Valor_Repasse']) for r in known),Decimal('0'))) if known else None,sum(int(r['Quantidade_Alunos']) for r in rs),sum(int(r['Quantidade_Escolas']) for r in rs),100*len(known)/len(rs)]
    for i,v in zip(inds,vals):observacoes.append(obs(i['id'],ter,year,v,f['id'],group,'Rede executora',note))
save('escolar.json',dict(versao=1,capturadoEm=NOW,fontes=[f],territorios=territorios,indicadores=inds,observacoes=observacoes,notas=limits))
save('brutos/pnae-conciliacao.json',dict(registrosOriginais=len(rows),repassesAusentes=sum(r['Valor_Repasse'] is None for r in rows),naoConciliadosMunicipais2025=unmatched,observacoes=len(observacoes),territorios=len(territorios),sha256=hashlib.sha256(b).hexdigest()))
print('IPCA',len(prices),'PNAE',len(rows),'obs',len(observacoes),'unmatched',unmatched)
