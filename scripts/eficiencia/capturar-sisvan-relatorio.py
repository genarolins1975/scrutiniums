"""Extrai a tabela 10 do Relatório de Gestão MS 2025; não integra o gráfico 19."""
import pathlib,json,re,gzip,hashlib,datetime,urllib.request
import pdfplumber
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'public/eficiencia/seguranca-alimentar'
CACHE=ROOT.parent/'seguranca-fontes'
CACHE.mkdir(parents=True,exist_ok=True)
URL='https://www.gov.br/saude/pt-br/acesso-a-informacao/auditorias/2025/relatorio-de-gestao-integrado/@@download/file/Relat%C3%B3rio%20de%20Gest%C3%A3o%20Integrado.pdf'
p=CACHE/'saude2025.pdf'
if not p.exists():p.write_bytes(urllib.request.urlopen(URL,timeout=90).read())
b=p.read_bytes();assert b.startswith(b'%PDF')
with pdfplumber.open(p) as pdf:
    text=pdf.pages[56].extract_text().replace('\x07',' ')
assert 'Tabela 10' in text and 'gestantes não estão contabilizadas' in text
pattern=r'^(Crianças menores de 5 anos|Crianças entre 5 e 9 anos|Adolescentes|Adultos|Idosos)\s+([\d.]+)\s+([\d,]+)%'
rows=re.findall(pattern,text,re.M);assert len(rows)==5
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
raw=(text+'\n').encode();(OUT/'brutos').mkdir(parents=True,exist_ok=True)
(OUT/'brutos/ms-sisvan-tabela10-2025.txt.gz').write_bytes(gzip.compress(raw,mtime=0))
limits=['Dados nacionais preliminares de 2025 publicados na tabela 10, página 56 do relatório do Ministério da Saúde. Gestantes não estão contabilizadas.','Indivíduos com peso e altura avaliados nos serviços de Atenção Primária à Saúde; acompanhamento não equivale a insegurança alimentar ou a desnutrição.','Cobertura por fase da vida é transcrita da publicação. O denominador detalhado não está documentado na tabela; não recalculamos nem agregamos esses percentuais.','Não há recorte municipal, série temporal ou distribuição de estado nutricional incorporados nesta extração.','O gráfico 19 apresenta cobertura total que não foi reconciliada com os valores por fase da vida da tabela 10; sua série não foi integrada.']
f=dict(id='ms-sisvan-relatorio',nome='Ministério da Saúde · SISVAN · Relatório de Gestão 2025, tabela 10',url=URL+'#page=57',consulta=URL,periodo=dict(frequencia='anual',inicio=2025,fim=2025),universo='Indivíduos com peso e altura avaliados na APS, Brasil, por fase da vida; gestantes excluídas.',limitacoes=limits,capturadoEm=now,sha256=hashlib.sha256(raw).hexdigest(),bruto='/eficiencia/seguranca-alimentar/brutos/ms-sisvan-tabela10-2025.txt.gz',documentacao=[f'SHA-256 do PDF original: {hashlib.sha256(b).hexdigest()}. O arquivo bruto versionado é a extração textual da página; o PDF original permanece na fonte oficial.'])
inds=[dict(id='sisvan-avaliados',nome='Indivíduos com peso e altura avaliados',unidade='indivíduos avaliados',fonteId=f['id'],universo=f['universo'],limitacao=limits[1]),dict(id='sisvan-cobertura',nome='Cobertura do acompanhamento por fase da vida',unidade='%',fonteId=f['id'],universo=f['universo'],limitacao=limits[2])]
obs=[]
for group,q,c in rows:
    for i,v in zip(inds,[int(q.replace('.','')),float(c.replace(',','.'))]):obs.append(dict(indicadorId=i['id'],territorioId='1',periodo='2025',periodoNome='2025 · preliminar',valor=v,status='observado',fonteId=f['id'],grupo=group,dimensao='Fase da vida',cv=None,nota='Tabela 10 · dados preliminares; gestantes excluídas.'))
out=dict(versao=1,capturadoEm=now,fontes=[f],territorios=[dict(id='1',nome='Brasil',nivel='brasil')],indicadores=inds,observacoes=obs,notas=limits)
(OUT/'saude.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(rows)
