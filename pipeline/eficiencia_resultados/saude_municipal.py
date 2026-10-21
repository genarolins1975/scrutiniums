"""Audit registered infant mortality counts; never promote health to the score automatically."""
import csv
import hashlib
from html import unescape
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SEED = Path(__file__).parent/'seed/saude'
YEARS = ('2021', '2022', '2023')
LABELS = {'sim': 'Óbitos p/Residênc por Ano do Óbito segundo Município',
          'sinasc': 'Nascim p/resid.mãe por Ano do nascimento segundo Município'}


def parse_table(html, cities, system):
    if system not in LABELS: raise ValueError('Unknown system')
    plain = unescape(html)
    if LABELS[system] not in plain or '2021-2023<PRE>' not in plain:
        raise ValueError('Wrong residence measure or period')
    if 'Dados finais disponíveis até 2024' not in plain:
        raise ValueError('Review source final/preliminary status')
    match = re.search(r'<PRE>(.*?)</PRE>', plain, re.S | re.I)
    if not match: raise ValueError('Missing TabNet table')
    rows = list(csv.reader(io.StringIO(match.group(1).strip()), delimiter=';'))
    if rows[0] != ['Município', *YEARS, 'Total']:
        raise ValueError('Unexpected table columns')
    codes = {c['id'][:6]: c for c in cities}
    if len(codes) != 26 or len(cities) != 26:
        raise ValueError('Ambiguous municipality code mapping')
    result = {}; total = None
    for line, row in enumerate(rows[1:], 2):
        if not row or row == ['&']: continue  # TabNet terminates PRE export with &
        if len(row) != 5: raise ValueError('Unexpected table row')
        vals = [0 if v == '-' else int(v) if re.fullmatch(r'\d+', v) else None for v in row[1:]]
        if any(v is None for v in vals) or sum(vals[:3]) != vals[3]:
            raise ValueError('Invalid counts or row total')
        if row[0] == 'Total':
            if total is not None: raise ValueError('Duplicate total')
            total = vals
        elif row[0][:6] in codes:
            city = codes[row[0][:6]]
            if city['id'] in result: raise ValueError('Duplicate city')
            result[city['id']] = {**city, 'source_label': row[0], 'source_row': line,
                                  'annual': dict(zip(YEARS, vals[:3])), 'total': vals[3]}
        elif any(vals):
            raise ValueError('Nonzero territory outside selected cohort')
    if len(result) != 26 or total != [sum(r['annual'][y] for r in result.values()) for y in YEARS] + [sum(r['total'] for r in result.values())]:
        raise ValueError('Incomplete cohort or table total mismatch')
    return result


def combine(deaths, births):
    if set(deaths) != set(births) or len(deaths) != 26:
        raise ValueError('Health cohorts differ')
    result = []
    for code in sorted(deaths):
        d, n = deaths[code], births[code]
        if set(d['annual']) != set(YEARS) or set(n['annual']) != set(YEARS):
            raise ValueError('Incomplete health window')
        if any(n['annual'][y] <= 0 for y in YEARS):
            raise ValueError('Nonpositive birth denominator')
        if any(d['annual'][y] < 0 for y in YEARS):
            raise ValueError('Negative death count')
        if d['total'] != sum(d['annual'].values()) or n['total'] != sum(n['annual'].values()):
            raise ValueError('Window total mismatch')
        result.append({'id': code, 'name': d['name'],
                       'deaths': d['annual'], 'live_births': n['annual'],
                       'deaths_total': d['total'], 'live_births_total': n['total'],
                       'annual_rates_per_1000': {y: 1000*d['annual'][y]/n['annual'][y] for y in YEARS},
                       'pooled_rate_per_1000': 1000*d['total']/n['total'],
                       'source_rows': {'sim': d['source_row'], 'sinasc': n['source_row']},
                       'score_eligible': False, 'eligibility_reason': 'Coverage/subregistration and precision review pending'})
    return result


def build():
    manifest = json.loads((SEED/'manifest.json').read_bytes())
    for name, sha in manifest['input_sha256'].items():
        if hashlib.sha256((SEED/name).read_bytes()).hexdigest() != sha:
            raise ValueError('Frozen health source changed: '+name)
    cities = json.loads((ROOT/'src/lib/eficiencia/panorama-atlas.json').read_bytes())['cities']
    counts = {system: parse_table((SEED/(system+'-2021-2023.html')).read_text(), cities, system) for system in LABELS}
    return {'version': 'irc-health-counts-2021-2023-v1', 'years': list(YEARS),
            'score_eligible': False, 'publication_ready': False,
            'coverage': {'territories': 26, 'years': 3, 'count_series': 2, 'observed_cells': 156,
                         'note': 'Completeness of extraction, not completeness of vital registration'},
            'rows': combine(counts['sim'], counts['sinasc']), 'source_manifest': manifest,
            'limitations': ['Registered period rates; not a linked birth cohort',
                            'No correction for underregistration', 'No confidence intervals yet',
                            'Health dimension remains missing in the score']}


if __name__ == '__main__':
    result = build(); out = ROOT/'docs/obee/resultados'
    (out/'saude-contagens-2021-2023.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    with (out/'saude-contagens-2021-2023.csv').open('w', newline='') as f:
        w = csv.writer(f); w.writerow(['id', 'name', 'year', 'infant_deaths', 'live_births', 'registered_rate_per_1000', 'score_eligible'])
        for r in result['rows']:
            for y in YEARS: w.writerow([r['id'], r['name'], y, r['deaths'][y], r['live_births'][y], r['annual_rates_per_1000'][y], 'false'])
    print(json.dumps({'coverage': result['coverage'], 'examples': [r for r in result['rows'] if r['id'] in ('2611606', '4106902')]}, ensure_ascii=False))
