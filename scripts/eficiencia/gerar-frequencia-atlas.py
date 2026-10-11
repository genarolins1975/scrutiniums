"""Materializa frequência escolar contextual; exige captura íntegra e recortes completos."""
import csv
import hashlib
import itertools
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/obee/calibracao/evidencias'
AGES={'99749':'0 a 3 anos','47813':'4 a 5 anos','31615':'6 a 14 anos','2792':'15 a 17 anos'}

def build():
    manifest=json.loads((SOURCE/'frequencia-manifesto.json').read_text())
    for source in manifest['sources']:
        if hashlib.sha256((SOURCE/source['file']).read_bytes()).hexdigest()!=source['sha256']:
            raise ValueError('Hash divergente')
    cities=json.loads((ROOT/'src/lib/eficiencia/atlas-resumo.json').read_text())['cities']
    labels={p['id']:p['name'] for p in cities}; labels['1']='Brasil'
    output=[];seen=set()
    for source,territory in [('capitais','Município'),('brasil','Brasil')]:
        data=json.loads((SOURCE/f'ibge-10056-{source}.json').read_text());columns={v:k for k,v in data[0].items()}
        for row in data[1:]:
            f=lambda k:row[columns[k]]
            code,age=f(territory+' (Código)'),f('Grupo de idade (Código)')
            if (code,age) in seen: raise ValueError('Duplicata')
            seen.add((code,age))
            if (f('Ano'),f('Variável (Código)'),f('Sexo (Código)'),f('Cor ou raça (Código)'),f('Unidade de Medida'))!=('2022','3795','6794','95251','%'):
                raise ValueError('Recorte incompatível')
            raw=f('Valor');value=None if raw in ('...','..','-','X') else float(raw)
            if value is not None and not 0<=value<=100:raise ValueError('Taxa inválida')
            output.append(dict(territory=code,name=labels[code],age=age,value=value,raw=raw))
    if seen!=set(itertools.product(labels,AGES)):raise ValueError('Cobertura incompatível com o Atlas')
    return dict(period=2022,source='IBGE · Censo Demográfico',table='10056',variable='3795',
        capturedAt=manifest['captured_at'],role='CONTEXTO_NAO_ESCORE',
        ages=[dict(id=k,label=v) for k,v in AGES.items()],observations=output,sources=manifest['sources'])

if __name__=='__main__':
    data=build()
    (ROOT/'src/lib/eficiencia/frequencia-escolar.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    target=ROOT/'public/eficiencia/atlas';target.mkdir(parents=True,exist_ok=True)
    with (target/'frequencia-escolar-2022.csv').open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['codigo','territorio','ano','grupo_idade','taxa_percentual_fonte','papel'])
        for r in data['observations']:w.writerow([r['territory'],r['name'],data['period'],AGES[r['age']],r['raw'],data['role']])
    print(f"{len(data['observations'])} observações contextuais materializadas")
