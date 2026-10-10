"""Recorte público de Acesso à Justiça. Python stdlib; --reproduzir usa a semente.
Coleta: python3 -m pipeline.justica.capturar --xlsx ARQUIVO --cnj-text TEXTO --cnj-pdf PDF
"""
import argparse, csv, gzip, hashlib, io, json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/justica/seed'
OUT = ROOT / 'public/eficiencia/justica'
NS = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
XLSX_URL = 'https://pesquisanacionaldefensoria.com.br/download/bases_de_dados_da_pesquisa_nacional_da_defensoria_publica-2025.xlsx'
CNJ_URL = 'https://bibliotecadigital.cnj.jus.br/bitstream/123456789/1126/1/relatorio_justica_em_numeros2026_1.pdf'

def read_sheet(path, name):
    with zipfile.ZipFile(path) as z:
        strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rels = {n.attrib['Id']: n.attrib['Target'] for n in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS)
        sheet = next(n for n in sheets if n.attrib['name'] == name)
        target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        for row in ET.fromstring(z.read('xl/'+target.lstrip('/'))).find('m:sheetData', NS):
            cells = {}
            for c in row:
                v = c.find('m:v', NS)
                if v is None: continue
                raw = v.text
                if c.attrib.get('t') == 's': val = strings[int(raw)]
                else:
                    try: val = float(raw); val = int(val) if val.is_integer() else val
                    except (ValueError, TypeError): val = raw
                cells[re.sub(r'\d','',c.attrib['r'])] = val
            yield int(row.attrib['r']), cells

def number(v):
    return v if isinstance(v, (int,float)) and not isinstance(v,bool) else None

def months(s):
    a = re.search(r'(\d+)a',s); m = re.search(r'(\d+)m',s)
    if not a and not m: raise ValueError(s)
    return (int(a[1])*12 if a else 0)+(int(m[1]) if m else 0)

def validate(d):
    cs=d['comarcas']; assert len(cs)==len({(c['uf'],c['codigo']) for c in cs})
    assert set(c['situacao'] for c in cs) <= {'SIM','PARCIALMENTE','NÃO'}
    assert len({c['uf'] for c in cs})==27
    assert len(d['tribunais'])==27 and len({t['uf'] for t in d['tribunais']})==27
    for c in cs: assert c['populacao']>0 and c['municipios']>0
    for r in d['defensorias']:
        for key in ['defensores','atendimentos','acordos','executado']:
            assert r[key] is None or (isinstance(r[key],(int,float)) and r[key]>=0)
    assert len({(r['uf'],r['ano']) for r in d['defensorias']})==len(d['defensorias'])
    assert len([r for r in d['defensorias'] if r['ano']==2024])==27

def collect(args):
    comarcas=[]; names={}
    for row,c in read_sheet(args.xlsx,'Comarcas'):
        if not isinstance(c.get('A'),int): continue
        names[c['D'].casefold()]=c['E']
        comarcas.append(dict(codigo=str(c['A']),nome=c['B'],uf=c['E'],estado=c['D'].title(),populacao=c['F'],municipios=c['H'],situacao=c['I'],linha=row))
    defensorias=[]
    for row,c in read_sheet(args.xlsx,'Relatório Administrativo'):
        if c.get('B') not in [2021,2022,2023,2024] or str(c.get('A','')).casefold() not in names: continue
        defensorias.append(dict(uf=names[c['A'].casefold()],estado=c['A'],ano=c['B'],defensores=number(c.get('D')),atendimentos=number(c.get('S')),acordos=number(c.get('AC')),executado=number(c.get('AT')),notaAtendimentos=str(c.get('T','')),notaAcordos=str(c.get('AD','')),linha=row))
    pages=Path(args.cnj_text).read_text().split('\f')
    tribunais=[]
    for line in pages[332].splitlines():
        m=re.match(r'\s*(.*?)\s+(TJ[A-Z]+)\s+(.*?)\s*$',line)
        if m: tribunais.append(dict(tribunal=m[2],uf='DF' if m[2]=='TJDFT' else m[2][2:],baixados=months(m[1]),pendentes=months(m[3]),pagina=333))
    national=dict(ano=2025,novosMilhoes=40.9,baixadosMilhoes=45.2,pendentesMilhoes=75.5,tempoBaixados=28,tempoPendentes=43,tempoBaixadosFiscal=98,tempoBaixadosSemFiscal=18,tempoPendentesFiscal=76,tempoPendentesSemFiscal=33,conciliacao=11.2,cejuscs=[{'ramo':'Estadual','valor':1843},{'ramo':'Federal','valor':154},{'ramo':'Trabalho','valor':144}],conciliacaoSerie=[{'ano':y,'valor':v} for y,v in zip(range(2015,2026),[11.1,13.6,13.5,12.8,12.4,11.8,13.2,12.9,13.0,11.0,11.2])])
    d=dict(versao=1,capturadoEm='2026-10-10',coberturaEm='2025-04-24',comarcas=comarcas,defensorias=defensorias,tribunais=tribunais,cnj=national,fontes=[dict(id='defensoria',nome='Pesquisa Nacional da Defensoria Pública 2025',url=XLSX_URL,sha256=hashlib.sha256(Path(args.xlsx).read_bytes()).hexdigest(),referencia='Comarcas: 24/04/2025; população estimada: 2024; administração: 2021–2024',localizadores='Comarcas: A–I; Relatório Administrativo: A, B, D, S, T, AC, AD, AT. Número da linha preservado.'),dict(id='cnj',nome='CNJ — Justiça em Números 2026',url=CNJ_URL,sha256=hashlib.sha256(Path(args.cnj_pdf).read_bytes()).hexdigest(),referencia='Ano-base 2025; edição 2026',localizadores='Páginas 22–24 (volumes e duração); 232–234 (conciliação); figura 285, p. 333 (27 tribunais).')])
    validate(d)
    SEED.mkdir(parents=True,exist_ok=True)
    (SEED/'recorte.json.gz').write_bytes(gzip.compress(json.dumps(d,ensure_ascii=False,sort_keys=True).encode(),mtime=0))
    # Texto dos quadros usados, preservado para conferência do recorte; sem o relatório integral.
    (SEED/'cnj-quadros.txt').write_text('\n\n'.join(f'PÁGINA {n}\n{pages[n-1]}' for n in [22,23,24,232,233,234,333]))
    return d

def publish(d):
    validate(d); OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'snapshot.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
    for key in ['comarcas','defensorias','tribunais']:
        s=io.StringIO(); writer=csv.DictWriter(s,fieldnames=list(d[key][0]),delimiter=';');writer.writeheader();writer.writerows(d[key])
        (OUT/(key+'.csv')).write_text('\ufeff'+s.getvalue(),encoding='utf-8')
    (OUT/'fontes.json').write_text(json.dumps(d['fontes'],ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'comarcas':len(d['comarcas']),'defensorias_uf_ano':len(d['defensorias']),'tribunais':len(d['tribunais']),'snapshot_sha256':hashlib.sha256((OUT/'snapshot.json').read_bytes()).hexdigest()}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--reproduzir',action='store_true');p.add_argument('--xlsx');p.add_argument('--cnj-text');p.add_argument('--cnj-pdf');a=p.parse_args()
    d=json.loads(gzip.decompress((SEED/'recorte.json.gz').read_bytes())) if a.reproduzir else collect(a)
    publish(d)
