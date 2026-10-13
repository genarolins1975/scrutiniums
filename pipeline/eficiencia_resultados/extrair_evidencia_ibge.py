"""Extract contextual IBGE tables from a local download. Requires openpyxl only for extraction."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile


def extract(download_dir, output):
    import openpyxl
    root = Path(__file__).resolve().parents[2]
    ids = {r['id'] for r in json.loads((root/'docs/obee/resultados/saude-contagens-2021-2023.json').read_bytes())['rows']}
    base = 'https://ftp.ibge.gov.br/Estatisticas_Vitais/Estimativas_sub_registro_nascimentos/2023/xlsx/'
    out = {'version':'ibge-registration-scope-2023-v1','reference_year':2023,
           'retrieved_at':'2026-10-12',
           'scope':'Context only; not correction factors for the 2021-2023 municipal infant rates',
           'sources':[], 'tables':[]}
    names = ['01nascidosvivos_xlsx_20260610.zip','02obitos_xlsx_20260610.zip','indice_tabelas_sub_registro_2023_20260610.xlsx']
    expected = json.loads((Path(__file__).parent/'seed/saude/ibge-subnotificacao-2023.json').read_bytes())
    hashes = {r['url'].split('/')[-1]:r['sha256'] for r in expected['sources']}
    for name in names:
        sha = hashlib.sha256((download_dir/name).read_bytes()).hexdigest()
        if sha != hashes[name]: raise ValueError('IBGE source changed; review before replacing snapshot: '+name)
        out['sources'].append({'url':base+name,'sha256':sha})
    specs = [(names[0],'Tabela 1.2.xlsx','municipality_live_births'),
             (names[1],'Tabela 2.2.xlsx','municipality_all_age_deaths'),
             (names[1],'Tabela 2.9.xlsx','state_infant_deaths')]
    for archive, table, scope in specs:
        with zipfile.ZipFile(download_dir/archive) as z: raw = z.read(table)
        workbook = openpyxl.load_workbook(io.BytesIO(raw),data_only=True)
        sheet = workbook.active; values = list(sheet.values)
        selected = [{'row':i,'values':list(row)} for i,row in enumerate(values[2:],3)
                    if (scope=='state_infant_deaths' and row[0] is not None)
                    or (len(row)>2 and str(row[2]) in ids)]
        if scope.startswith('municipality') and len(selected)!=26: raise ValueError('Incomplete IBGE capital cohort')
        out['tables'].append({'archive':archive,'member':table,
            'member_sha256':hashlib.sha256(raw).hexdigest(),'sheet':sheet.title,
            'title':values[0][0],'headers':list(values[1]),'scope':scope,'rows':selected})
    workbook = openpyxl.load_workbook(download_dir/names[2],data_only=True)
    out['table_index'] = [str(v) for sheet in workbook for row in sheet.values for v in row if isinstance(v,str) and v.startswith('Tabela ')]
    output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--downloads',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); extract(args.downloads,args.output)
