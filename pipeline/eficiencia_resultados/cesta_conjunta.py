"""Experimento de composição Habitação + Conectividade, sem promover a v2.

Execute como módulo. Somente os dois arquivos cesta-conjunta.* são escritos.
Os cenários são condicionais às estimativas, sem inferência amostral.
"""
import csv
import hashlib
import json
import math
from itertools import combinations

from .habitacao import ROOT, build as audit_housing, pearson
from .conectividade import build as audit_connectivity
from .habitacao_cenarios import DEFINITIONS, aggregate, compare_pairs, percentiles_lower

BASE_DIMS = ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca')
BASE_WEIGHTS = dict.fromkeys(BASE_DIMS, .2)
MATERIAL = {'trabalho', 'saneamento', 'habitacao', 'conectividade'}
MODELS = ('iguais', 'materiais_40pct')
BASE_PATH = ROOT / 'docs/obee/resultados/piloto-2022-v2.json'
PRIMARY = 'domicilios_gt2'


def weights_for(added, model):
    if (len(set(added)) != len(added) or not set(added) <= {'habitacao', 'conectividade'}
            or model not in MODELS):
        raise ValueError('Candidatos/modelo inválidos')
    dims = BASE_DIMS + tuple(added)
    material_count = len(set(dims) & MATERIAL)
    return {d: 1 / len(dims) if model == 'iguais' else
            (.4 / material_count if d in MATERIAL else .2) for d in dims}


def validate_baseline(pilot):
    reference, rows = pilot['reference'], pilot['rows']
    ids = [r['id'] for r in rows]
    if (pilot['version'] != 'irc-piloto-2022-v2' or reference['reference_year'] != 2022
            or len(ids) != 26 or len(set(ids)) != 26 or '5300108' in ids
            or set(ids) != set(reference['territories'])):
        raise ValueError('Edição/coorte divergente')
    basket = reference['basket']
    if len(basket) != 5 or {d['id']: d['weight'] for d in basket} != BASE_WEIGHTS:
        raise ValueError('Cesta v2 divergente')
    for row in rows:
        if set(row['indicator_scores']) != set(BASE_DIMS):
            raise ValueError('Componentes da v2 divergentes')
        expected = aggregate(row['indicator_scores'], BASE_WEIGHTS)
        actual = row['pilot_five']['score']
        if actual is None or not math.isfinite(actual) or not math.isclose(expected, actual, abs_tol=1e-9):
            raise ValueError('Escore v2 não reconcilia')
    return ids


def align(rows, ids):
    by_id = {r['id']: r for r in rows}
    if len(by_id) != len(rows) or set(by_id) != set(ids):
        raise ValueError('Coorte ausente, adicional ou duplicada')
    return [by_id[ident] for ident in ids]


def change_decomposition(components, weights):
    # A centralização evita apresentar contribuição sempre positiva como ganho.
    aggregate(components, weights)  # valida inclusive ausências
    if not set(BASE_DIMS) <= set(components):
        raise ValueError('Cesta de referência incompleta')
    added = {d: weights[d] * (components[d] - 50) for d in weights if d not in BASE_WEIGHTS}
    reweighted = {d: (weights[d] - BASE_WEIGHTS[d]) * (components[d] - 50) for d in BASE_DIMS}
    return {'added_centered': added, 'existing_reweighting_centered': reweighted,
            'added_total': sum(added.values()), 'reweighting_total': sum(reweighted.values())}


def build():
    pilot = json.loads(BASE_PATH.read_text())
    ids = validate_baseline(pilot)
    housing, connectivity = audit_housing(), audit_connectivity()
    if housing['reference_year'] != 2022 or connectivity['reference_year'] != 2022:
        raise ValueError('Ano dos candidatos divergente')
    connected = align(connectivity['rows'], ids)
    conn_raw = [r['connected_pct'] for r in connected]
    conn_scores = percentiles_lower([-v for v in conn_raw])
    baseline = [r['pilot_five']['score'] for r in pilot['rows']]
    definitions = {}
    for definition, (unit, field) in DEFINITIONS.items():
        raw = [r[field] for r in align(housing[unit], ids)]
        definitions[definition] = (raw, percentiles_lower(raw))

    variants = [('conectividade', None, ('conectividade',))]
    variants += [('habitacao', d, ('habitacao',)) for d in DEFINITIONS]
    variants += [('conjunta', d, ('habitacao', 'conectividade')) for d in DEFINITIONS]
    scenarios = []
    for inclusion, definition, added in variants:
        for model in MODELS:
            weights = weights_for(added, model)
            rows = []
            for i, source in enumerate(pilot['rows']):
                components = dict(source['indicator_scores'])
                candidate_raw = {}
                if 'habitacao' in added:
                    candidate_raw['habitacao'] = definitions[definition][0][i]
                    components['habitacao'] = definitions[definition][1][i]
                if 'conectividade' in added:
                    candidate_raw['conectividade'] = conn_raw[i]
                    components['conectividade'] = conn_scores[i]
                score = aggregate(components, weights)
                decomposition = change_decomposition(components, weights)
                delta = score - baseline[i]
                if not math.isclose(delta, decomposition['added_total'] + decomposition['reweighting_total'], abs_tol=1e-9):
                    raise ValueError('Decomposição não reconcilia')
                rows.append({'id': source['id'], 'name': source['name'],
                             'candidate_raw_pct': candidate_raw, 'indicator_scores': components,
                             'baseline_score': baseline[i], 'scenario_score': score,
                             'composition_delta': delta, 'decomposition': decomposition})
            scores = [r['scenario_score'] for r in rows]
            scenarios.append({'id': f'{inclusion}__{definition or "sem_habitacao"}__{model}',
                              'inclusion': inclusion, 'housing_definition': definition,
                              'weight_model': model, 'weights': weights,
                              'material_weight': sum(w for d, w in weights.items() if d in MATERIAL),
                              'versus_v2': compare_pairs(baseline, scores),
                              'mean_score': sum(scores) / len(scores),
                              'mean_absolute_change': sum(abs(r['composition_delta']) for r in rows) / len(rows),
                              'max_absolute_change': max(abs(r['composition_delta']) for r in rows),
                              'rows': rows})

    def comparison(a, b):
        return {'a': a['id'], 'b': b['id'],
                **compare_pairs([r['scenario_score'] for r in a['rows']],
                                [r['scenario_score'] for r in b['rows']])}

    incremental, definition_comparisons, weight_comparisons = [], [], []
    for a, b in combinations(scenarios, 2):
        same_model = a['weight_model'] == b['weight_model']
        same_definition = a['housing_definition'] == b['housing_definition']
        if same_model and b['inclusion'] == 'conjunta' and (a['inclusion'] == 'conectividade' or
                (a['inclusion'] == 'habitacao' and same_definition)):
            incremental.append(comparison(a, b))
        if same_model and a['inclusion'] == b['inclusion'] and not same_definition:
            definition_comparisons.append(comparison(a, b))
        if not same_model and a['inclusion'] == b['inclusion'] and same_definition:
            weight_comparisons.append(comparison(a, b))

    vectors = {d: [r['indicator_scores'][d] for r in pilot['rows']] for d in BASE_DIMS}
    vectors.update({'habitacao': definitions[PRIMARY][1], 'conectividade': conn_scores})
    correlations = {a: {b: pearson(x, y) for b, y in vectors.items()} for a, x in vectors.items()}
    sources = [BASE_PATH]
    for folder in ('habitacao', 'conectividade'):
        seed = ROOT / 'pipeline/eficiencia_resultados/seed' / folder
        manifest = json.loads((seed / 'manifest.json').read_text())
        sources += [seed / 'manifest.json'] + [seed / source['path'] for source in manifest['sources']]
    evidence = [{'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                for path in sources]
    return {'version': 'cesta-conjunta-diagnostico-v1', 'baseline': pilot['version'],
            'reference_year': 2022, 'cohort': ids, 'publication_ready': False,
            'score_eligible': False, 'is_full_obee_score': False, 'approved_weights': None,
            'nature': 'cenarios_condicionais_sem_inferencia_amostral',
            'normalization': '100*(piores+0.5*iguais)/26; coorte fixa, empates preservados',
            'primary_housing_definition': PRIMARY, 'input_evidence': evidence,
            'correlations_oriented': correlations, 'scenarios': scenarios,
            'incremental_comparisons': incremental, 'definition_comparisons': definition_comparisons,
            'weight_comparisons': weight_comparisons,
            'review_proposal': {'status': 'proposta_para_revisao_nao_aprovada',
                                'scenario': f'conjunta__{PRIMARY}__materiais_40pct',
                                'reason': 'Examinar duas condições distintas mantendo o peso material da v2; não otimizar ranking.',
                                'pending': ['validade_de_conteudo_e_agrupamento', 'precisao_ou_regra_de_divulgacao_municipal',
                                            'aprovacao_normativa_dos_pesos', 'revisao_metodologica_independente']}}


def write_outputs(result):
    folder = ROOT / 'docs/obee/resultados'
    (folder / 'cesta-conjunta.json').write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    fields = ['scenario', 'housing_definition', 'weight_model', 'material_weight', 'id', 'name',
              'baseline_score', 'scenario_score', 'composition_delta', 'added_total', 'reweighting_total']
    with (folder / 'cesta-conjunta.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for scenario in result['scenarios']:
            for row in scenario['rows']:
                writer.writerow({'scenario': scenario['id'],
                                 **{k: scenario[k] for k in ('housing_definition', 'weight_model', 'material_weight')},
                                 **{k: row[k] for k in ('id', 'name', 'baseline_score', 'scenario_score', 'composition_delta')},
                                 **{k: row['decomposition'][k] for k in ('added_total', 'reweighting_total')}})


if __name__ == '__main__':
    write_outputs(build())
