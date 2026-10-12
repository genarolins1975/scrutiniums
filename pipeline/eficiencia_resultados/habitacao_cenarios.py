"""Cenários diagnósticos de composição; não altera referência ou publicação."""
import json
import math
from itertools import combinations
from .habitacao import ROOT, build as audit_housing, pearson

DEFINITIONS = {
    'domicilios_gt2': ('households', 'above_two_pct'),
    'domicilios_gt3': ('households', 'above_three_pct'),
    'moradores_gt2': ('residents', 'above_two_pct'),
    'moradores_gt3': ('residents', 'above_three_pct'),
}
DIMS = ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca', 'habitacao')
WEIGHTS = {
    'seis_iguais': {d: 1 / 6 for d in DIMS},
    'materiais_40pct': {d: (.4 / 3 if d in ('trabalho', 'saneamento', 'habitacao') else .2) for d in DIMS},
}


def percentiles_lower(values):
    if not values or any(not math.isfinite(v) for v in values):
        raise ValueError('Valores inválidos')
    return [100 * (sum(v > x for v in values) + sum(v == x for v in values) / 2) / len(values) for x in values]


def aggregate(components, weights):
    if set(components) != set(weights) or not math.isclose(sum(weights.values()), 1):
        raise ValueError('Cesta/pesos inválidos')
    if any(v is None or not math.isfinite(v) or not 0 <= v <= 100 for v in components.values()):
        raise ValueError('Componente inválido ou ausente')
    if any(not math.isfinite(w) or w < 0 for w in weights.values()):
        raise ValueError('Peso inválido')
    return sum(components[k] * weights[k] for k in weights)


def sign(x):
    return 0 if abs(x) <= 1e-9 else (1 if x > 0 else -1)


def compare_pairs(base, alternative):
    if len(base) != len(alternative):
        raise ValueError('Coortes distintas')
    result = {'strict_reversals': 0, 'baseline_ties_broken': 0, 'ties_reached': 0, 'pairs': 0}
    for i, j in combinations(range(len(base)), 2):
        a, b = sign(base[i] - base[j]), sign(alternative[i] - alternative[j])
        result['pairs'] += 1
        result['strict_reversals'] += int(a * b == -1)
        result['baseline_ties_broken'] += int(a == 0 and b != 0)
        result['ties_reached'] += int(a != 0 and b == 0)
    return result


def build():
    housing = audit_housing()
    pilot = json.loads((ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_text())
    base = [r['pilot_five']['score'] for r in pilot['rows']]
    ids = [r['id'] for r in pilot['rows']]
    scenarios = []
    for definition, (unit, field) in DEFINITIONS.items():
        if ids != [r['id'] for r in housing[unit]]:
            raise ValueError('Coorte/ordem divergente')
        raw = [r[field] for r in housing[unit]]
        perc = percentiles_lower(raw)
        correlations = {d: pearson(perc, [r['indicator_scores'][d] for r in pilot['rows']]) for d in ('trabalho', 'saneamento')}
        for model, weights in WEIGHTS.items():
            scores = [aggregate({**r['indicator_scores'], 'habitacao': p}, weights) for r, p in zip(pilot['rows'], perc)]
            rows = [{'id': r['id'], 'name': r['name'], 'housing_raw_pct': v, 'housing_percentile': p,
                     'baseline_score': b, 'scenario_score': s, 'composition_delta': s - b}
                    for r, v, p, b, s in zip(pilot['rows'], raw, perc, base, scores)]
            scenarios.append({'id': definition + '__' + model, 'definition': definition, 'weight_model': model,
                              'weights': weights, 'correlations_oriented': correlations,
                              'versus_v2': compare_pairs(base, scores), 'rows': rows})
    comparisons = []
    for model in WEIGHTS:
        subset = [s for s in scenarios if s['weight_model'] == model]
        for a, b in combinations(subset, 2):
            comparisons.append({'a': a['id'], 'b': b['id'],
                                **compare_pairs([r['scenario_score'] for r in a['rows']], [r['scenario_score'] for r in b['rows']])})
    return {'version': 'habitacao-cenarios-v1', 'reference_year': 2022,
            'publication_ready': False, 'score_eligible': False, 'recommended_weights': None,
            'nature': 'cenarios_condicionais_de_composicao_sem_inferencia_amostral',
            'baseline': 'piloto-2022-v2', 'scenarios': scenarios, 'definition_comparisons': comparisons}


if __name__ == '__main__':
    output = ROOT / 'docs/obee/resultados/habitacao-cenarios.json'
    output.write_text(json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(output)
