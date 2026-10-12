"""Reconciliação alternativa, com frações exatas, sem importar o motor OBEE.

Parte dos valores originais nas auditorias preservadas; não reextrai o SIDRA.
Não é parecer independente e não concede autorização de publicação.
"""
import argparse
import csv
import hashlib
import json
import math
import re
from fractions import Fraction as F
from itertools import combinations, groupby
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca')
HIGHER = {'educacao', 'trabalho', 'saneamento', 'conectividade'}
MATERIAL = {'trabalho', 'saneamento', 'habitacao', 'conectividade'}
DEFINITIONS = {
    'domicilios_gt2': ('households', 'above_two_pct'),
    'domicilios_gt3': ('households', 'above_three_pct'),
    'moradores_gt2': ('residents', 'above_two_pct'),
    'moradores_gt3': ('residents', 'above_three_pct'),
}


def require(condition, label):
    if not condition:
        raise ValueError(label)


def ranks(values, higher):
    """Ordena do pior ao melhor e atribui o ponto médio exato de cada empate."""
    require(bool(values) and all(type(v) in (int, float) and math.isfinite(v)
                                for v in values.values()), 'Valores originais inválidos')
    result, offset = {}, 0
    ordered = sorted(values, key=values.get, reverse=not higher)
    for _, group in groupby(ordered, key=values.get):
        ids = list(group)
        percentile = F(100 * (2 * offset + len(ids)), 2 * len(values))
        result.update(dict.fromkeys(ids, percentile))
        offset += len(ids)
    return result


def pair_counts(a, b):
    counts = dict(strict_reversals=0, baseline_ties_broken=0, ties_reached=0, pairs=0)
    for i, j in combinations(a, 2):
        x, y = a[i] - a[j], b[i] - b[j]
        counts['pairs'] += 1
        counts['strict_reversals'] += int(x * y < 0)
        counts['baseline_ties_broken'] += int(x == 0 and y != 0)
        counts['ties_reached'] += int(x != 0 and y == 0)
    return counts


def audit(folder):
    evidence, errors = {}, []

    def read(name):
        raw = (folder / name).read_bytes()
        evidence[name] = hashlib.sha256(raw).hexdigest()
        return raw.decode('utf-8')

    def close(actual, expected, label):
        require(type(actual) in (int, float) and math.isfinite(actual), label + ': não finito')
        error = abs(float(actual) - float(expected))
        require(error <= 1e-9, label + ': divergência')
        errors.append(error)

    pilot = json.loads(read('piloto-2022-v2.json'))
    housing = json.loads(read('habitacao-adensamento-auditoria.json'))
    connection = json.loads(read('conectividade-auditoria.json'))
    joint = json.loads(read('cesta-conjunta.json'))
    ids = pilot['reference']['territories']
    require(len(ids) == len(set(ids)) == 26 and '5300108' not in ids, 'Coorte inválida')
    require(pilot['reference']['reference_year'] == housing['reference_year'] ==
            connection['reference_year'] == joint['reference_year'] == 2022, 'Ano divergente')
    require(len(joint['cohort']) == 26 and set(joint['cohort']) == set(ids), 'Coorte da candidata divergente')
    require(joint['publication_ready'] is False and joint['score_eligible'] is False
            and joint['is_full_obee_score'] is False and joint['approved_weights'] is None,
            'Estado editorial divergente')

    def index(rows):
        result = {r['id']: r for r in rows}
        require(len(rows) == len(result) == 26 and set(result) == set(ids), 'Coorte incompleta/duplicada')
        return result

    baseline_rows = index(pilot['rows'])
    raw = {d: {i: r['raw_values'][d] for i, r in baseline_rows.items()} for d in BASE}
    for definition, (unit, field) in DEFINITIONS.items():
        raw[definition] = {i: r[field] for i, r in index(housing[unit]).items()}
    raw['conectividade'] = {i: r['connected_pct'] for i, r in index(connection['rows']).items()}
    percentiles = {d: ranks(values, d in HIGHER) for d, values in raw.items()}
    baseline = {i: sum(percentiles[d][i] for d in BASE) / 5 for i in ids}
    for i, row in baseline_rows.items():
        for d in BASE:
            close(row['indicator_scores'][d], percentiles[d][i], 'Percentil v2')
        close(row['pilot_five']['score'], baseline[i], 'Nota v2')

    expected_ids = {f'{inc}__{definition}__{model}'
                    for inc in ('conectividade', 'habitacao', 'conjunta')
                    for definition in (['sem_habitacao'] if inc == 'conectividade' else DEFINITIONS)
                    for model in ('iguais', 'materiais_40pct')}
    scenarios = {s['id']: s for s in joint['scenarios']}
    require(len(joint['scenarios']) == 18 and set(scenarios) == expected_ids, 'Cenários incompletos/duplicados')
    recomputed, exported = {}, {}
    for sid, scenario in scenarios.items():
        inclusion, definition, model = sid.split('__')
        require(scenario['inclusion'] == inclusion and scenario['weight_model'] == model
                and scenario['housing_definition'] == (None if definition == 'sem_habitacao' else definition),
                'Rótulos do cenário divergentes')
        added = (('habitacao', 'conectividade') if inclusion == 'conjunta' else (inclusion,))
        dims = BASE + added
        weights = {d: F(1, len(dims)) if model == 'iguais' else
                   (F(2, 5 * len(set(dims) & MATERIAL)) if d in MATERIAL else F(1, 5)) for d in dims}
        require(set(scenario['weights']) == set(dims), 'Dimensões dos pesos divergentes')
        for d in dims:
            close(scenario['weights'][d], weights[d], 'Peso')
        close(scenario['material_weight'], sum(weights[d] for d in dims if d in MATERIAL), 'Peso material')
        scores = {}
        for i, row in index(scenario['rows']).items():
            require(row['name'] == baseline_rows[i]['name'], 'Nome da capital divergente')
            components = {d: percentiles[definition if d == 'habitacao' else d][i] for d in dims}
            require(set(row['indicator_scores']) == set(dims), 'Componentes divergentes')
            for d in dims:
                close(row['indicator_scores'][d], components[d], 'Percentil candidata')
            require(set(row['candidate_raw_pct']) == set(added), 'Valores originais dos candidatos divergentes')
            for d in added:
                close(row['candidate_raw_pct'][d], raw[definition if d == 'habitacao' else d][i], 'Valor original candidato')
            score = sum(components[d] * weights[d] for d in dims)
            added_parts = {d: weights[d] * (components[d] - 50) for d in added}
            old_parts = {d: (weights[d] - F(1, 5)) * (components[d] - 50) for d in BASE}
            delta = score - baseline[i]
            require(delta == sum(added_parts.values()) + sum(old_parts.values()), 'Identidade exata da decomposição')
            expected = dict(baseline_score=baseline[i], scenario_score=score, composition_delta=delta,
                            added_total=sum(added_parts.values()), reweighting_total=sum(old_parts.values()))
            for key, value in expected.items():
                close(row[key] if key in row else row['decomposition'][key], value, key)
            for key, parts in [('added_centered', added_parts), ('existing_reweighting_centered', old_parts)]:
                require(set(row['decomposition'][key]) == set(parts), 'Parcelas divergentes')
                for d, value in parts.items():
                    close(row['decomposition'][key][d], value, 'Parcela centrada')
            scores[i] = score
            exported[(sid, i)] = expected
        require(scenario['versus_v2'] == pair_counts(baseline, scores), 'Comparação de pares vs v2')
        require(sum(scores.values()) / 26 == 50, 'Centro exato da distribuição')
        close(scenario['mean_score'], 50, 'Média')
        close(scenario['mean_absolute_change'], sum(abs(scores[i] - baseline[i]) for i in ids) / 26, 'Mudança média')
        close(scenario['max_absolute_change'], max(abs(scores[i] - baseline[i]) for i in ids), 'Mudança máxima')
        recomputed[sid] = scores
    comparisons = 0
    for group, count in [('incremental_comparisons', 16), ('definition_comparisons', 24), ('weight_comparisons', 9)]:
        records = joint[group]
        require(len(records) == count and len({(r['a'], r['b']) for r in records}) == count, 'Conjunto de comparações')
        for comparison in records:
            expected = pair_counts(recomputed[comparison['a']], recomputed[comparison['b']])
            require(all(comparison[k] == v for k, v in expected.items()), 'Comparação entre cenários')
            comparisons += 1

    csv_rows = list(csv.DictReader(read('cesta-conjunta.csv').splitlines()))
    require(len(csv_rows) == 468 and {(r['scenario'], r['id']) for r in csv_rows} == set(exported), 'CSV incompleto/duplicado')
    for row in csv_rows:
        scenario = scenarios[row['scenario']]
        require(row['name'] == baseline_rows[row['id']]['name']
                and row['weight_model'] == scenario['weight_model']
                and row['housing_definition'] == (scenario['housing_definition'] or ''), 'Rótulos do CSV')
        close(float(row['material_weight']), scenario['material_weight'], 'Peso material do CSV')
        for key, value in exported[(row['scenario'], row['id'])].items():
            close(float(row[key]), value, 'CSV ' + key)
    html = read('revisao-interativa-v3.html')
    payload = json.loads(re.search(r'<script id="data" type="application/json">([\s\S]*?)</script>', html)[1])
    require(payload['sha256'] == evidence['cesta-conjunta.json'], 'HTML aponta para outra versão')
    require(len(payload['scenarios']) == 18 and {s['id'] for s in payload['scenarios']} == expected_ids, 'Cenários do HTML')
    for scenario in payload['scenarios']:
        sid = scenario['id']
        require(scenario['weights'] == scenarios[sid]['weights'], 'Pesos do HTML')
        require(scenario['versus_v2'] == scenarios[sid]['versus_v2'], 'Comparações do HTML')
        close(scenario['material_weight'], scenarios[sid]['material_weight'], 'Peso material do HTML')
        source_rows = index(scenarios[sid]['rows'])
        for i, row in index(scenario['rows']).items():
            require(row['name'] == baseline_rows[i]['name'], 'Nome da capital no HTML')
            require(row['indicator_scores'] == source_rows[i]['indicator_scores'], 'Percentis do HTML')
            for key, value in exported[(sid, i)].items():
                close(row[key] if key in row else row['decomposition'][key], value, 'HTML ' + key)
    return {'version': 'reconciliacao-racional-v3-v1', 'status': 'pass', 'scenarios': 18,
            'city_scenario_rows': 468, 'csv_rows': len(csv_rows), 'scenario_comparisons': comparisons,
            'numeric_checks': len(errors), 'max_absolute_difference': max(errors), 'tolerance': 1e-9,
            'input_sha256': evidence, 'independent_methodological_review': False, 'publication_ready': False,
            'scope': 'Recalculo racional desde os valores originais nas auditorias; sem nova extração SIDRA ou inferência amostral.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, default=ROOT / 'docs/obee/resultados')
    args = parser.parse_args()
    print(json.dumps(audit(args.folder), ensure_ascii=False, indent=2, allow_nan=False))
