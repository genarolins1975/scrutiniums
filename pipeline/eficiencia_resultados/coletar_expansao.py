"""Acquire official sources and audit the five-dimension 2022 pilot; stdlib + Poppler."""
import argparse
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SEED = Path(__file__).parent / 'seed'
PDF_URL = 'https://repositorio.ipea.gov.br/bitstream/11058/14031/5/AtlasViolencia2024_Retrato_dos_municipios_brasileros.pdf'
HEALTH_URL = 'https://demas-dados-abertos.s3.amazonaws.com/csv/mgdi_ms_k5p.csv.zip'
FQI_URL = 'https://www.ripsa.org.br/wp-content/uploads/fichasidb/2025/MRT.1.01.pdf'
META_URL = 'https://servicodados.ibge.gov.br/api/v3/agregados/6805/metadados'
CATEGORIES = {'46292', '46290', '72110', '72111', '72112', '72113', '92858', '72114', '72115', '92861'}
LEVEL_ONE = {'46290', '72112', '72113', '92858', '72114', '72115', '92861'}


def sanitation(rows, cities):
    ids = {c['id'] for c in cities}
    cells = {k: {} for k in ids}
    locators = {k: {} for k in ids}
    ufs = {}
    for index, row in enumerate(rows[1:], 2):
        if (row['NC'], row['D2C'], row['D3C'], row['MN']) != ('6', '381', '2022', 'Unidades'):
            raise ValueError('Unexpected SIDRA scope, variable, year or unit')
        city, category = row['D1C'], row['D4C']
        if city not in ids or category not in CATEGORIES or category in cells[city]:
            raise ValueError('Unexpected/duplicate SIDRA cell')
        if row['V'] != '-' and not re.fullmatch(r'\d+', row['V']):
            raise ValueError('SIDRA missing/noninteger value; do not impute zero')
        cells[city][category] = 0 if row['V'] == '-' else int(row['V'])
        locators[city][category] = index
        name, uf = row['D1N'].rsplit(' (', 1)
        expected = next(c['name'] for c in cities if c['id'] == city)
        if name != expected or not re.fullmatch(r'[A-Z]{2}\)', uf):
            raise ValueError('Municipality label mismatch')
        if city in ufs and ufs[city] != uf[:-1]:
            raise ValueError('Conflicting UF')
        ufs[city] = uf[:-1]
    result = []
    for city in cities:
        code = city['id']; values = cells[code]
        if set(values) != CATEGORIES:
            raise ValueError('Incomplete sanitation categories')
        if values['46290'] != values['72110'] + values['72111']:
            raise ValueError('Nested sewer categories inconsistent')
        total = values['46292']
        if total <= 0 or total != sum(values[k] for k in LEVEL_ONE):
            raise ValueError('Sanitation denominator inconsistent')
        numerator = values['46290'] + values['72112']
        if not 0 <= numerator <= total:
            raise ValueError('Sanitation numerator inconsistent')
        result.append({**city, 'uf': ufs[code], 'numerator': numerator,
                       'denominator': total, 'value': 100 * numerator / total,
                       'network_only_value': 100 * values['46290'] / total,
                       'categories': values, 'raw_rows_1_based': locators[code]})
    return result


def violence(table, cities, ufs):
    pattern = re.compile(r'^\s*(\d+)\s+(.+?)\s+([A-Z]{2})\s+(N|NE|CO|SE|S)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+,\d)\s*$', re.M)
    rows = pattern.findall(table)
    if len(rows) != 27 or {int(r[0]) for r in rows} != set(range(1, 28)):
        raise ValueError('Expected exactly 27 Atlas rows')
    names = {c['name']: c for c in cities}
    result = []
    for rank, name, uf, region, pop, registered, hidden, total, rate in rows:
        pop, registered, hidden, total = [int(v.replace('.', '')) for v in (pop, registered, hidden, total)]
        rate = float(rate.replace(',', '.'))
        if pop <= 0 or registered + hidden != total or abs(total * 100000 / pop - rate) > .051:
            raise ValueError('Atlas counts/rate do not reconcile')
        if uf == 'DF':
            if name != 'Brasília': raise ValueError('Unexpected DF row')
            continue
        if name not in names or ufs[names[name]['id']] != uf:
            raise ValueError('Atlas city/UF outside cohort')
        result.append({**names[name], 'uf': uf, 'population': pop, 'registered': registered,
                       'hidden_estimated': hidden, 'total_estimated': total, 'value': rate,
                       'registered_rate': registered * 100000 / pop,
                       'source_page': 18, 'source_table': 3, 'source_row': int(rank)})
    if len(result) != 26 or len({r['id'] for r in result}) != 26:
        raise ValueError('Atlas cohort missing or duplicated')
    return sorted(result, key=lambda r: r['id'])


def get(url, path):
    request = urllib.request.Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'OBEE-research/0.2'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read(20_000_001)
    if len(data) > 20_000_000: raise ValueError('Source exceeds acquisition limit')
    if data[:2] == b'\x1f\x8b': data = gzip.decompress(data)
    path.write_bytes(data)


def collect(cache, acquire=False):
    cache = Path(cache); cache.mkdir(parents=True, exist_ok=True)
    cities = json.loads((ROOT / 'src/lib/eficiencia/panorama-atlas.json').read_bytes())['cities']
    urls = {'sidra6805-metadata.json': META_URL,
            'sidra6805-values.json': 'https://apisidra.ibge.gov.br/values/t/6805/n6/' + ','.join(c['id'] for c in cities) + '/v/381/p/2022/c11558/all',
            'atlas-2024.pdf': PDF_URL, 'mgdi_ms_k5p.csv.zip': HEALTH_URL, 'mrt101.pdf': FQI_URL}
    manifest = []
    for name, url in urls.items():
        path = cache / name
        if acquire: get(url, path)
        data = path.read_bytes()
        manifest.append({'file': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                         'local_file_mtime_utc': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()})
    metadata = json.loads((cache / 'sidra6805-metadata.json').read_bytes())
    if metadata['id'] != 6805 or metadata['classificacoes'][0]['id'] != 11558:
        raise ValueError('Unexpected SIDRA metadata')
    san = sanitation(json.loads((cache / 'sidra6805-values.json').read_bytes()), cities)
    subprocess.run(['pdftotext', '-f', '18', '-l', '18', '-layout', str(cache/'atlas-2024.pdf'), str(cache/'atlas-tabela3.txt')], check=True)
    atlas = violence((cache / 'atlas-tabela3.txt').read_text(), cities, {r['id']: r['uf'] for r in san})
    subprocess.run(['pdftotext', '-layout', str(cache/'mrt101.pdf'), str(cache/'mrt101.txt')], check=True)
    fqi = (cache/'mrt101.txt').read_text()
    if 'resultados por município não são disponibilizados' not in fqi or 'Unidades da Federação.' not in fqi:
        raise ValueError('Health source scope changed; inspect FQI')
    with zipfile.ZipFile(cache / 'mgdi_ms_k5p.csv.zip') as z:
        reader = csv.DictReader(io.StringIO(z.read('mgdi_ms_k5p.csv').decode('utf-8-sig')))
        health_rows = list(reader); fields = reader.fieldnames
    if fields != ['Indicador', 'Ano', 'UF', 'Numerador - Obitos infantis estimados', 'Denominador - Nascidos vivos estimados', 'Fator']:
        raise ValueError('Health schema changed')
    if any(r['Indicador'] != 'MRT.1.01' or len(r['UF']) != 2 for r in health_rows):
        raise ValueError('Unexpected health geography or indicator')
    evidence = {'version': 'irc-expansao-2022-evidence-v2', 'inspected_at_utc': datetime.now(timezone.utc).isoformat(),
                'source_manifest': manifest, 'sanitation': san, 'violence': atlas,
                'health_review': {'status': 'municipal_score_not_qualified', 'geography': 'UF', 'fields': fields,
                                  'rows': len(health_rows), 'years': sorted({int(r['Ano']) for r in health_rows}),
                                  'decision': 'Do not impute state rates to capitals; municipal SIM/SINASC eligibility remains pending; see the separate health audit.'}}
    SEED.mkdir(parents=True, exist_ok=True)
    for name in ['sidra6805-metadata.json', 'sidra6805-values.json', 'atlas-tabela3.txt']:
        shutil.copyfile(cache/name, SEED/name)
    (SEED/'expansao-2022.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
    return evidence


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', required=True)
    parser.add_argument('--acquire', action='store_true')
    args = parser.parse_args()
    evidence = collect(args.cache, args.acquire)
    print(json.dumps({'sanitation': len(evidence['sanitation']), 'violence': len(evidence['violence']),
                      'health': evidence['health_review']['status']}))
