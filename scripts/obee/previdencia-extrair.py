"""Reproduz o snapshot a partir das tabelas HTML oficiais preservadas, sem dependências."""
from html.parser import HTMLParser
from pathlib import Path
import csv, hashlib, json, re, zipfile

ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / 'data/previdencia/originais'
OUT = ROOT / 'public/eficiencia/previdencia'

class Tabela(HTMLParser):
    def __init__(self):
        super().__init__(); self.on = False; self.rows = []; self.row = None; self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == 'table' and dict(attrs).get('class') == 'table': self.on = True
        if self.on and tag == 'tr': self.row = []
        if self.on and tag in ('td', 'th'): self.cell = ''
    def handle_data(self, data):
        if self.cell is not None: self.cell += data
    def handle_endtag(self, tag):
        if self.on and tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(self.cell.split())); self.cell = None
        if self.on and tag == 'tr' and self.row: self.rows.append(self.row); self.row = None
        if tag == 'table': self.on = False

def numero(raw):
    if raw in ('-', '...', '..', ''): return None
    if not re.fullmatch(r'[\d.,]+', raw): raise ValueError('Número inesperado: '+raw)
    value = float(raw.replace('.', '').replace(',', '.'))
    return int(value) if value.is_integer() else value

def extrair():
    manifest = json.loads((ROOT / 'data/previdencia/manifest.json').read_text())
    archive = zipfile.ZipFile(OUT / 'originais.zip')
    sources = manifest if isinstance(manifest, list) else manifest['sources']
    tables = {}
    for source in sources:
        file = Path(source['file']).name
        raw = archive.read(file)
        assert hashlib.sha256(raw).hexdigest() == source['sha256'], file
        parser = Tabela(); parser.feed(raw.decode('utf8'))
        rows = [r for r in parser.rows if len(r)>1 and not r[0].isdigit() and any(re.fullmatch(r'[\d.,]+', v) for v in r[1:])]
        key = Path(file).stem
        if key not in ('b.16','b.17','43.1','43.2'):
            assert any(r==['2022','2023','2024']*3 for r in parser.rows), key
        if key in ('b.16','b.17'):
            assert len(rows) == 66 and all(len(r)==7 for r in rows)
            rows = [a+b[1:] for a,b in zip(rows[:33],rows[33:]) if a[0]==b[0]]
            assert len(rows)==33
        else:
            assert len(rows)==(32 if key in ('b.1','b.2','b.3') else 26 if key=='a.1' else 33), (key,len(rows))
        tables[key] = [{'id':str(i),'name':r[0], 'territory':re.sub(r'\s*\(\d+\)','',r[0]).strip(), 'values':[numero(v) for v in r[1:]]} for i,r in enumerate(rows)]
        assert all(len(r['values'])==(12 if key in ('b.16','b.17','43.1','43.2') else 9) for r in tables[key]),key
        source['id'] = key
    # Validação cruzada de totais publicados; valores monetários permanecem em R$ mil.
    for a,b in [('b.1','b.13'),('b.2','b.14'),('b.3','b.15'),('a.1','a.14')]:
        assert tables[a][0]['values']==tables[b][0]['values'], (a,b)
    assert tables['b.16'][0]['values'][-1] == tables['b.13'][0]['values'][2]
    for key in ('b.13','a.14','43.1','43.2'):
        rs=tables[key]; ufs=[r for r in rs if r['territory'] not in ('BRASIL','NORTE','NORDESTE','SUDESTE','SUL','CENTRO-OESTE')]
        assert len(ufs)==27
        for col in range(len(rs[0]['values'])):
            if rs[0]['values'][col] is not None and all(r['values'][col] is not None for r in ufs):
                assert sum(r['values'][col] for r in ufs)==rs[0]['values'][col],(key,col)
    OUT.mkdir(parents=True,exist_ok=True)
    snapshot = {'edition':'AEPS 2024','years':[2022,2023,2024],'sources':sources,'tables':tables}
    (OUT/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n')
    (OUT/'fontes.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
    with (OUT/'tabelas.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.writer(f,delimiter=';');writer.writerow(['Tabela','Linha original','Rótulo original','Coluna (base 0)','Valor original','Unidade original','URL da fonte'])
        for source in sources:
            key=source['id']
            for row in tables[key]:
                for col,value in enumerate(row['values']):
                    writer.writerow([key,int(row['id'])+1,row['name'],col,'' if value is None else str(value).replace('.',','),'R$ mil' if key in ('b.2','b.3','b.14','b.15','b.17') else 'contagem',source['url']])
    print(f'{len(tables)} tabelas, {sum(len(r) for r in tables.values())} linhas, validações cruzadas OK')

if __name__ == '__main__': extrair()
