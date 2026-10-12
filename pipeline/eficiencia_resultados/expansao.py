"""Frozen five-dimension pilot and separate six-dimension missing-data contract."""
import csv
import hashlib
import itertools
import json
from pathlib import Path
from .coletar_expansao import sanitation, violence
from .motor import aggregate, percentile
from .piloto import build as build_v1

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
OUT = ROOT / 'docs/obee/resultados'


def build():
    config = json.loads((HERE / 'referencia-2022-v2.json').read_bytes())
    for path, expected in config['input_sha256'].items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest() != expected:
            raise ValueError('Frozen input changed: ' + path)
    old = build_v1()
    cities = [{k: r[k] for k in ('id', 'name')} for r in old['rows']]
    seed = HERE/'seed'
    evidence = json.loads((seed/'expansao-2022.json').read_bytes())
    san = sanitation(json.loads((seed/'sidra6805-values.json').read_bytes()), cities)
    atlas = violence((seed/'atlas-tabela3.txt').read_text(), cities, {r['id']: r['uf'] for r in san})
    if san != evidence['sanitation'] or atlas != evidence['violence']:
        raise ValueError('Derived observations differ from versioned sources')
    maps = {'saneamento': {r['id']: r for r in san}, 'seguranca': {r['id']: r for r in atlas}}
    raw = {r['id']: {**r['raw_values'], **{k: m[r['id']]['value'] for k, m in maps.items()}} for r in old['rows']}
    ids = sorted(raw)
    if ids != config['territories']:
        raise ValueError('Frozen cohort mismatch')
    basket = config['basket']
    weights = {b['id']: b['weight'] for b in basket}
    if len(weights) != 5 or set(weights) != {'educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca'}:
        raise ValueError('Unexpected pilot basket')
    for b in basket:
        if sorted(raw[k][b['id']] for k in ids) != b['reference']:
            raise ValueError('Frozen reference mismatch')
    scenarios = []
    for factors in itertools.product((.8, 1.2), repeat=5):
        w = {b['id']: b['weight'] * f for b, f in zip(basket, factors)}
        total = sum(w.values())
        scenarios.append({k: v/total for k, v in w.items()})
    alternate_refs = {
        'network_only': sorted(r['network_only_value'] for r in san),
        'registered_only': sorted(r['registered_rate'] for r in atlas)}
    rows = []
    for city in cities:
        code = city['id']
        scores = {b['id']: percentile(raw[code][b['id']], b['reference'], b['direction']) for b in basket}
        variants = [aggregate(scores, w)['score'] for w in scenarios]
        leave = {}
        for excluded in weights:
            kept = {k: v for k, v in weights.items() if k != excluded}
            total = sum(kept.values())
            leave[excluded] = aggregate({k: scores[k] for k in kept}, {k: v/total for k, v in kept.items()})['score']
        alt_san = {**scores, 'saneamento': percentile(maps['saneamento'][code]['network_only_value'], alternate_refs['network_only'], 'higher')}
        alt_violence = {**scores, 'seguranca': percentile(maps['seguranca'][code]['registered_rate'], alternate_refs['registered_only'], 'lower')}
        rows.append({**city, 'raw_values': raw[code], 'indicator_scores': scores,
                     'pilot_five': aggregate(scores, weights),
                     'extended_six': aggregate({**scores, 'saude': None}, config['extended_six_weights']),
                     'weight_scenarios': variants, 'weight_sensitivity_range': [min(variants), max(variants)],
                     'leave_one_out': leave,
                     'definition_sensitivity': {'network_only': aggregate(alt_san, weights)['score'],
                                               'registered_only': aggregate(alt_violence, weights)['score']}})
    pairwise = []
    for a, b in itertools.combinations(rows, 2):
        baseline = a['pilot_five']['score'] - b['pilot_five']['score']
        differences = [x-y for x, y in zip(a['weight_scenarios'], b['weight_scenarios'])]
        pairwise.append({'a': a['id'], 'b': b['id'], 'baseline_difference': baseline,
                         'difference_range': [min(differences), max(differences)],
                         'sign_reversal': any(x * baseline < -1e-10 for x in differences)})
    return {'version': config['version'], 'publication_ready': False, 'is_full_obee_score': False,
            'role': 'PILOTO_TECNICO_CINCO_DIMENSOES_2022', 'reference': config,
            'coverage': {'territories': 26, 'dimensions_observed': 5, 'observations': 130,
                         'extended_dimensions': 6, 'missing_dimensions': ['saude']},
            'source_evidence_path': 'pipeline/eficiencia_resultados/seed/expansao-2022.json',
            'health_review': evidence['health_review'], 'rows': rows,
            'sensitivity': {'type': 'Deterministic methodological sensitivity; not confidence intervals',
                            'weights': scenarios, 'definition_references': alternate_refs,
                            'pairwise_comparisons': len(pairwise),
                            'pairs_with_sign_reversal': sum(p['sign_reversal'] for p in pairwise),
                            'pairwise': pairwise}}


def export(result):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'piloto-2022-v2.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    with (OUT/'piloto-2022-v2.csv').open('w', newline='') as f:
        fields = ['id', 'name', 'pilot_five_score', 'extended_six_score', 'extended_six_lower', 'extended_six_upper',
                  'extended_six_coverage', 'educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca',
                  'weight_min', 'weight_max', 'definition_network_only', 'definition_registered_only']
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for r in result['rows']:
            writer.writerow({'id': r['id'], 'name': r['name'], 'pilot_five_score': r['pilot_five']['score'],
                             'extended_six_score': r['extended_six']['score'], 'extended_six_lower': r['extended_six']['lower'],
                             'extended_six_upper': r['extended_six']['upper'], 'extended_six_coverage': r['extended_six']['coverage_weight'],
                             **r['indicator_scores'], 'weight_min': r['weight_sensitivity_range'][0], 'weight_max': r['weight_sensitivity_range'][1],
                             'definition_network_only': r['definition_sensitivity']['network_only'],
                             'definition_registered_only': r['definition_sensitivity']['registered_only']})


if __name__ == '__main__':
    result = build(); export(result)
    print(json.dumps({'coverage': result['coverage'], 'pair_reversals': result['sensitivity']['pairs_with_sign_reversal'],
                      'examples': [{k: r[k] for k in ('name', 'pilot_five', 'extended_six')} for r in result['rows']
                                   if r['id'] in ('2611606', '4106902')]}, ensure_ascii=False))
