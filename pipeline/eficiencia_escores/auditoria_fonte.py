"""Audita o recorte urbano contra a planilha primária Saeb 2023."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from .cobertura import ROOT, build

SNAPSHOT = 'docs/obee/cobertura/saeb-2023-capitais-fonte.json'
FIELDS = ['ANO_SAEB', 'CO_MUNICIPIO', 'NO_MUNICIPIO', 'DEPENDENCIA_ADM',
          'LOCALIZACAO', 'MEDIA_5_LP', 'MEDIA_5_MT', 'MEDIA_9_LP', 'MEDIA_9_MT']


def compare(snapshot, report):
    expected = {r['territory'] for r in report['observations']}
    index = {}
    for r in snapshot['rows']:
        key = (str(int(r['CO_MUNICIPIO'])), r['LOCALIZACAO'])
        if key in index:
            raise ValueError('Fonte com chave duplicada')
        if key[0] not in expected or key[1] not in ('Urbana', 'Total') or r['DEPENDENCIA_ADM'] != 'Municipal' or r['ANO_SAEB'] != 2023:
            raise ValueError('Recorte inesperado na fonte')
        index[key] = r
    if set(index) != {(code, loc) for code in expected for loc in ('Urbana', 'Total')}:
        raise ValueError('Extração primária incompleta')
    output = []
    for r in report['observations']:
        col = 'MEDIA_'+('5' if 'iniciais' in r['stage'] else '9')+'_'+('LP' if r['subject']=='portugues' else 'MT')
        for location in ('Urbana', 'Total'):
            source = index[(r['territory'], location)]
            value, existing = source[col], r['raw_value']
            if value is None and existing is None:
                status = 'AMBOS_AUSENTES'
            elif value is None or existing is None:
                status = 'DISPONIBILIDADE_DIFERENTE'
            elif abs(value-existing) <= 0.0051:
                status = 'VALOR_COINCIDE'
            else:
                status = 'VALOR_DIFERENTE'
            output.append({'territory': r['territory'], 'name': r['name'], 'stage': r['stage'],
                'subject': r['subject'], 'school_location': location,
                'integrated_value': existing, 'primary_value': value, 'comparison': status,
                'source_locator': f"Municípios!linha {source['row']}; coluna {col}"})
    return {'source_url': snapshot['source_url'], 'workbook_sha256': snapshot['workbook_sha256'],
        'meaning': 'Conciliação numérica; ausência coincidente não valida o motivo de supressão.',
        'counts': {loc: dict(Counter(r['comparison'] for r in output if r['school_location']==loc))
                   for loc in ('Urbana','Total')}, 'observations': output}


def extract(workbook, archive, roster):
    from pyxlsb import open_workbook
    codes = {int(c['id']) for c in roster['cities']}
    rows = []
    with open_workbook(str(workbook)) as w:
        with w.get_sheet('Municípios') as s:
            iterator = s.rows()
            headers = [c.v for c in next(iterator)]
            if not set(FIELDS).issubset(headers):
                raise ValueError('Layout oficial mudou')
            for row in iterator:
                data = dict(zip(headers, [c.v for c in row]))
                if data['CO_MUNICIPIO'] in codes and data['DEPENDENCIA_ADM']=='Municipal' and data['LOCALIZACAO'] in ('Total','Urbana'):
                    rows.append({'row':row[0].r+1, **{k:data[k] for k in FIELDS}})
    return {'source_url':'https://download.inep.gov.br/saeb/resultados/planilha_de_resultados_2023.rar',
        'retrieved_on':'2026-10-11', 'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
        'workbook':workbook.name, 'workbook_sha256':hashlib.sha256(workbook.read_bytes()).hexdigest(),
        'sheet':'Municípios', 'filters':{'ANO_SAEB':2023,'DEPENDENCIA_ADM':'Municipal','LOCALIZACAO':['Total','Urbana']},
        'municipal_headers':headers, 'rows':rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workbook', type=Path)
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    if bool(args.workbook) != bool(args.archive):
        parser.error('Forneça workbook e archive juntos')
    if args.workbook:
        snapshot = extract(args.workbook, args.archive, json.loads((ROOT/'src/lib/eficiencia/atlas-resumo.json').read_text()))
    else:
        snapshot = json.loads((ROOT/SNAPSHOT).read_text())
    report = compare(snapshot, build())
    if args.workbook:
        (ROOT/SNAPSHOT).write_text(json.dumps(snapshot,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    (ROOT/'docs/obee/cobertura/conciliacao-saeb-2023.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps(report['counts'],ensure_ascii=False))

if __name__ == '__main__':
    main()
