"""Compara pares na família contínua entre material 40% e sete pesos iguais.

Mantém a cesta de sete medidas e quatro definições de habitação. Não promove
publicação, não estima probabilidades e não modifica o pacote congelado.
"""
import hashlib
import json
import math
from collections import Counter
from fractions import Fraction as F
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/obee/resultados/cesta-conjunta.json'
OUTPUT = SOURCE.with_name('sensibilidade-pares-v3.json')
MATERIAL = ('trabalho', 'saneamento', 'habitacao', 'conectividade')
OTHER = ('educacao', 'mobilidade', 'seguranca')
DEFINITIONS = ('domicilios_gt2', 'domicilios_gt3', 'moradores_gt2', 'moradores_gt3')
LOW, HIGH = F(2, 5), F(4, 7)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def rational_percentile(value):
    require(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 100,
            'Percentil inválido')
    exact = F(round(value * 52 / 100) * 100, 52)
    require(abs(float(exact) - value) <= 1e-9, 'Percentil fora da grade da coorte')
    return exact


def interval(d_other, d_material):
    """Diferença (1-b)*d_other + b*d_material; extremos e raiz exatos."""
    at40 = (1 - LOW) * d_other + LOW * d_material
    at_equal = (1 - HIGH) * d_other + HIGH * d_material
    slope = d_material - d_other
    root = -d_other / slope if slope else None
    root = root if root is not None and LOW <= root <= HIGH else None
    return at40, at_equal, root


def classify(lo, hi):
    if lo > 0:
        return 'a_always_higher'
    if hi < 0:
        return 'b_always_higher'
    if lo == hi == 0:
        return 'always_tied'
    if lo < 0 < hi:
        return 'order_changes'
    return 'tie_possible'


def build(data, source_hash):
    require(data['reference_year'] == 2022 and data['publication_ready'] is False,
            'Edição de pesquisa divergente')
    ids = data['cohort']
    require(len(ids) == len(set(ids)) == 26 and '5300108' not in ids, 'Coorte divergente')
    sources = [s for s in data['scenarios'] if s['inclusion'] == 'conjunta']
    expected = {(d, m) for d in DEFINITIONS for m in ('materiais_40pct', 'iguais')}
    require(len(sources) == 8 and {(s['housing_definition'], s['weight_model']) for s in sources} == expected,
            'Oito cenários conjuntos exigidos')
    scenarios = {(s['housing_definition'], s['weight_model']): s for s in sources}
    components, scores = {}, {}
    names = {}
    for definition in DEFINITIONS:
        for model, budget in [('materiais_40pct', LOW), ('iguais', HIGH)]:
            s = scenarios[definition, model]
            rows = {r['id']: r for r in s['rows']}
            require(len(s['rows']) == len(rows) == 26 and set(rows) == set(ids), 'Cidades ausentes/duplicadas')
            weights = {d: budget / 4 if d in MATERIAL else (1 - budget) / 3 for d in MATERIAL + OTHER}
            require(set(s['weights']) == set(weights) and all(abs(s['weights'][d] - float(w)) < 1e-9
                    for d, w in weights.items()), 'Pesos fora da família declarada')
            for i, row in rows.items():
                require(set(row['indicator_scores']) == set(weights), 'Cesta incompleta')
                vector = {d: rational_percentile(v) for d, v in row['indicator_scores'].items()}
                if (definition, i) in components:
                    require(vector == components[definition, i], 'Componentes mudam com os pesos')
                components[definition, i] = vector
                scores[definition, model, i] = sum(vector[d] * w for d, w in weights.items())
                require(abs(float(scores[definition, model, i]) - row['scenario_score']) < 1e-9,
                        'Nota publicada não reconcilia')
                require(i not in names or names[i] == row['name'], 'Nome divergente')
                names[i] = row['name']

    pairs = []
    for a, b in combinations(ids, 2):
        definitions, endpoints, component_deltas = [], [], []
        for definition in DEFINITIONS:
            ca, cb = components[definition, a], components[definition, b]
            delta = {d: ca[d] - cb[d] for d in ca}
            component_deltas.append(list(delta.values()))
            d_m = sum(delta[d] for d in MATERIAL) / 4
            d_o = sum(delta[d] for d in OTHER) / 3
            at40, at_equal, crossing = interval(d_o, d_m)
            require(at40 == scores[definition, 'materiais_40pct', a] - scores[definition, 'materiais_40pct', b]
                    and at_equal == scores[definition, 'iguais', a] - scores[definition, 'iguais', b], 'Extremos inconsistentes')
            endpoints.extend((at40, at_equal))
            definitions.append({'definition': definition, 'gap40': float(at40), 'gap_equal': float(at_equal),
                                'tie_budget': None if crossing is None else float(crossing),
                                'tie_budget_exact': None if crossing is None else str(crossing),
                                'tied_entire_interval': at40 == at_equal == 0})
        lo, hi = min(endpoints), max(endpoints)
        # Todos os componentes em todas as quatro definições: condição suficiente,
        # distinta da estabilidade numa família restrita de pesos.
        dominance = ('a' if all(min(d) >= 0 and max(d) > 0 for d in component_deltas) else
                     'b' if all(max(d) <= 0 and min(d) < 0 for d in component_deltas) else None)
        pairs.append({'a': a, 'b': b, 'a_name': names[a], 'b_name': names[b],
                      'state': classify(lo, hi), 'min_gap': float(lo), 'max_gap': float(hi),
                      'componentwise_dominance_all_definitions': dominance, 'definitions': definitions})
    states = Counter(p['state'] for p in pairs)
    return {'version': 'sensibilidade-pares-v3-v1', 'source_sha256': source_hash, 'reference_year': 2022,
            'publication_ready': False, 'independent_review': False,
            'family': {'material_budget': [float(LOW), float(HIGH)], 'material_budget_exact': [str(LOW), str(HIGH)],
                       'material_dimensions': list(MATERIAL), 'other_dimensions': list(OTHER),
                       'within_group_weights': 'equal', 'housing_definitions': list(DEFINITIONS),
                       'aggregation': 'arithmetic_mean_of_oriented_percentiles'},
            'summary': {'pairs': len(pairs), 'strict_order_preserved': states['a_always_higher'] + states['b_always_higher'],
                        'order_changes': states['order_changes'], 'tie_possible': states['tie_possible'],
                        'always_tied': states['always_tied'],
                        'dominance_all_definitions': sum(p['componentwise_dominance_all_definitions'] is not None for p in pairs)},
            'limits': ['Não é intervalo de confiança, probabilidade ou significância estatística.',
                       'Família restrita: pesos iguais dentro dos dois blocos; não abrange todos os pesos possíveis.',
                       'Mantém sete medidas, dados e normalização fixos; não testa erros das fontes ou outros indicadores.'],
            'pairs': pairs}


if __name__ == '__main__':
    raw = SOURCE.read_bytes()
    result = build(json.loads(raw), hashlib.sha256(raw).hexdigest())
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
