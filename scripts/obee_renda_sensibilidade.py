"""Sensibilidade separada à média de renda, sem substituir a mediana congelada."""
import argparse
import base64
from fractions import Fraction as F
import gzip
import hashlib
from itertools import combinations
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.eficiencia_resultados.cesta_conjunta import validate_baseline
from pipeline.eficiencia_resultados.habitacao import pearson
from scripts.obee_sensibilidade_pares import rational_percentile, build as validate_family

DOCS = ROOT / 'docs/obee/resultados'
RAW = ROOT / 'public/eficiencia/trabalho-renda/brutos/censo-renda.json'
PAYLOAD = RAW.parent.parent / 'snapshot.payload.gz.b64'
OUTPUT = DOCS / 'sensibilidade-renda-media-v3.json'
EXPECTED_HASH = 'f3a411db4391e3603e391837688935e2c5749244fbd80bec757f4592859af83a'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract(raw, pilot):
    ids = validate_baseline(pilot)
    result = {i: {} for i in ids}
    for r in raw[1:]:
        if r['NC'] != '6' or r['D1C'] not in result:
            continue
        if (r['D2C'] not in {'13431', '13534'} or r['D3C'] != '2022'
                or r['MC'] != '38' or r['D4C'] != '6794'
                or r['D5C'] != '95251' or r['D6C'] != '95253'):
            raise ValueError('Universo/variável/ano/unidade divergente')
        row = result[r['D1C']]
        if r['D2C'] in row:
            raise ValueError('Capital/variável duplicada')
        value = float(r['V'])
        if not math.isfinite(value) or value <= 0:
            raise ValueError('Renda ausente ou inválida')
        row[r['D2C']] = value
    for city in pilot['rows']:
        row = result[city['id']]
        if set(row) != {'13431', '13534'}:
            raise ValueError('Exigidas média e mediana nas 26 capitais')
        if row['13534'] != city['raw_values']['trabalho']:
            raise ValueError('Mediana não reconcilia com a cesta congelada')
    return result


def percentiles(values):
    return [F(100 * (2 * sum(x < v for x in values) + values.count(v)), 2 * len(values))
            for v in values]


def compare(a, b):
    signs = lambda v: (v > 0) - (v < 0)
    pairs = [(signs(a[i] - a[j]), signs(b[i] - b[j])) for i, j in combinations(range(len(a)), 2)]
    return {'pairs': len(pairs), 'strict_reversals': sum(x * y == -1 for x, y in pairs),
            'ties_created': sum(x != 0 and y == 0 for x, y in pairs),
            'ties_broken': sum(x == 0 and y != 0 for x, y in pairs),
            'ties_preserved': sum(x == y == 0 for x, y in pairs)}


def build():
    if sha(RAW) != EXPECTED_HASH:
        raise ValueError('Hash da aquisição SIDRA divergente')
    source = next(f for f in json.loads(gzip.decompress(base64.b64decode(PAYLOAD.read_bytes())))['fontes']
                  if f['id'] == 'censo-renda')
    if source['sha256'] != EXPECTED_HASH:
        raise ValueError('Manifesto da aquisição não reconcilia')
    pilot = json.loads((DOCS / 'piloto-2022-v2.json').read_text())
    raw = extract(json.loads(RAW.read_text()), pilot)
    ids = [r['id'] for r in pilot['rows']]
    medians, means = [[raw[i][variable] for i in ids] for variable in ('13534', '13431')]
    pmedian, pmean = percentiles(medians), percentiles(means)
    basket = json.loads((DOCS / 'cesta-conjunta.json').read_text())
    validate_family(basket, sha(DOCS / 'cesta-conjunta.json'))
    scenarios = []
    for s in basket['scenarios']:
        if s['inclusion'] != 'conjunta':
            continue
        rows = {r['id']: r for r in s['rows']}
        weights = {d: F(1, 7) if s['weight_model'] == 'iguais' else
                   F(1, 10) if d in {'trabalho', 'saneamento', 'habitacao', 'conectividade'} else F(1, 5)
                   for d in s['weights']}
        before, after, result = [], [], []
        for j, i in enumerate(ids):
            components = {k: rational_percentile(v) for k, v in rows[i]['indicator_scores'].items()}
            if components['trabalho'] != pmedian[j]:
                raise ValueError('Percentil da mediana não reconcilia')
            a = sum(weights[k] * v for k, v in components.items())
            b = a + weights['trabalho'] * (pmean[j] - pmedian[j])
            before.append(a)
            after.append(b)
            result.append({'id': i, 'score_mediana': float(a), 'score_media': float(b),
                           'delta': float(b - a), 'delta_exact': str(b - a)})
        scenarios.append({'id': s['id'], 'housing_definition': s['housing_definition'],
                          'weight_model': s['weight_model'], 'weights': s['weights'],
                          'comparison': compare(before, after),
                          'max_absolute_score_change': float(max(abs(a-b) for a, b in zip(before, after))),
                          'rows': result})
    rows = [{'id': r['id'], 'capital': r['name'], 'mediana_nominal': medians[j],
             'media_nominal': means[j], 'percentil_mediana': float(pmedian[j]),
             'percentil_media': float(pmean[j]), 'delta_percentil': float(pmean[j]-pmedian[j])}
            for j, r in enumerate(pilot['rows'])]
    return {'version': 'sensibilidade-renda-media-v1', 'reference': 'julho de 2022',
            'unit': 'R$ nominais; sem ajuste espacial de preços', 'publication_ready': False,
            'approved_weights': None, 'basket_unchanged': True,
            'source': {**source, 'local_path': str(RAW.relative_to(ROOT)),
                       'reutilizacao_verificada_em': '2026-10-13',
                       'acquisition': 'Coleta oficial já preservada; não é nova captura de rede'},
            'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p)} for p in
                       (RAW, PAYLOAD, DOCS / 'piloto-2022-v2.json', DOCS / 'cesta-conjunta.json')],
            'method': 'Substituição apenas do estimando de renda nos oito cenários conjuntos; mesmos percentis de postos médios, coorte, demais medidas e pesos. Comparações com frações exatas.',
            'caveat': 'Média é mais sensível à cauda superior; não corrige preços, amontoamento ou erros amostrais. Precisão municipal não quantificada. Experimento condicional, sem inferência ou escolha normativa.',
            'summary': {'rank_correlation': pearson([float(v) for v in pmedian], [float(v) for v in pmean]),
                        'max_absolute_percentile_change': float(max(abs(a-b) for a, b in zip(pmedian, pmean))),
                        'income_pairs': compare(pmedian, pmean)},
            'rows': rows, 'scenarios': scenarios}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    content = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit('Experimento de renda desatualizado')
    else:
        OUTPUT.write_text(content)
    print(json.dumps(result['summary'], ensure_ascii=False))
