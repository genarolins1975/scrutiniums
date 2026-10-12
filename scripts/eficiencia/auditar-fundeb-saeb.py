"""Audita os XLSX públicos do VAAR; nunca os promove ao piloto municipal urbano."""
import argparse
import hashlib
import json
from pathlib import Path
import posixpath
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

BASE = 'https://download.inep.gov.br/fundeb/2025/'
FILES = ['resultados_dicionario_de_dados.xlsx', 'resultados_indicador_aprendizagem_vaar_fundeb_financeiro_2025_v5.xlsx']
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def sheets(path):
    with zipfile.ZipFile(path) as z:
        strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
        rels = {x.get('Id'): x.get('Target') for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for s in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            target = rels[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
            rows = []
            for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row', NS):
                values = {}
                for c in row:
                    v = c.find('m:v', NS)
                    text = strings[int(v.text)] if v is not None and c.get('t') == 's' else v.text if v is not None else ''.join(c.itertext())
                    column = ''.join(x for x in c.get('r') if x.isalpha())
                    values[column] = text
                rows.append({'row': int(row.get('r')), 'cells': values})
            result[s.get('name')] = rows
        return result

def audit(root, cities):
    dictionary = sheets(root / FILES[0])
    results = sheets(root / FILES[1])
    drows = next(iter(dictionary.values()))
    variables = [r['cells'].get('A') for r in drows if r['cells'].get('A', '').isidentifier() and '_' in r['cells']['A']]
    if not {'ID_MUNICIPIO', 'ID_DEPENDENCIA_ADM', 'ID_SERIE'}.issubset(variables):
        raise ValueError('Dicionário mudou: revisar contrato')
    target = [(name, rows) for name, rows in results.items() if any(r['cells'].get('A') == 'CO_ENTE' for r in rows)]
    if len(target) != 1:
        raise ValueError('Tabela de resultados não identificada univocamente')
    name, rows = target[0]
    header = next(r for r in rows if r['cells'].get('A') == 'CO_ENTE')
    columns = {v:k for k,v in header['cells'].items()}
    records = [r for r in rows if r['row'] > header['row'] and r['cells'].get('A', '').isdigit()]
    observations = []
    for city in cities:
        matched = [r for r in records if r['cells'].get(columns['CO_ENTE']) == city['id']]
        if len(matched) != 1:
            raise ValueError('Capital ausente ou duplicada: ' + city['id'])
        r = matched[0]
        value = float(r['cells'][columns['IPSAEB_23']])
        if not 0 <= value <= 1:
            raise ValueError('Participação fora da escala')
        observations.append({'municipality_ibge':city['id'], 'name':r['cells'][columns['NO_ENTE']], 'excel_row':r['row'], 'ipsaeb_2023':value, 'eligible_for_current_pilot':False})
    return {
        'review_date':'2026-10-12', 'role':'DILIGENCIA_NAO_ESCORE',
        'sources':[{'url':BASE+f,'bytes':(root/f).stat().st_size,'sha256':hashlib.sha256((root/f).read_bytes()).hexdigest()} for f in FILES],
        'dictionary_variables':variables,
        'municipality_semantics':'Código IBGE nesta base específica; não altera as máscaras do arquivo TS_ESCOLA.',
        'network_semantics':'2 = Estadual; 3 = Municipal.',
        'dictionary_has_school_location':any('LOCALIZ' in v for v in variables),
        'results_sheet':name,'results_header_row':header['row'],'results_headers':header['cells'],
        'entity_rows':len(records),'capital_rows':len(observations),'observations':observations,
        'eligible_for_current_pilot':False,
        'blocking_reasons':['IPSaeb municipal publicado agrega 5º e 9º anos, conforme notas do XLSX.', 'Não há localização urbana no dicionário revisado.', 'Microbase filtrada exclui estudantes sem proficiência/peso; contagem dessas linhas não constitui população elegível.'],
        'limits':['ZIP de microdados VAAR não adquirido nem inspecionado; evidências referentes aos dois XLSX.', 'Participação agregada não comprova representatividade do recorte municipal urbano do 5º ano.', 'Não unir alunos mascarados entre bases.'],
        'next_step':'Obter tabulação agregada oficial com etapa e localização; preparar especificação do pedido sem envio externo.'
    }

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache-dir',type=Path,required=True);p.add_argument('--cities',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--acquire',action='store_true');a=p.parse_args()
    a.cache_dir.mkdir(parents=True,exist_ok=True)
    if a.acquire:
        for f in FILES:
            with urllib.request.urlopen(BASE+f,timeout=40) as r:
                data=r.read(10_000_001)
            if len(data)>10_000_000:raise ValueError('Arquivo excede limite')
            (a.cache_dir/f).write_bytes(data)
    out=audit(a.cache_dir,json.loads(a.cities.read_text())['cities'])
    a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:out[k] for k in ['entity_rows','capital_rows','eligible_for_current_pilot']}))
