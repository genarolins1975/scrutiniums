import copy
import csv
import json
import unittest

from .cesta_conjunta import (BASE_PATH, BASE_DIMS, MATERIAL, ROOT, align, build,
                            change_decomposition, validate_baseline, weights_for)


class JointBasketTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before = BASE_PATH.read_bytes()
        cls.result = build()
        cls.scenarios = {s['id']: s for s in cls.result['scenarios']}

    def test_explicit_budget_and_invalid_candidates(self):
        for added in [(), ('habitacao',), ('conectividade',), ('habitacao', 'conectividade')]:
            weights = weights_for(added, 'materiais_40pct')
            self.assertAlmostEqual(sum(weights.values()), 1)
            self.assertAlmostEqual(sum(w for d, w in weights.items() if d in MATERIAL), .4)
            for d in ('educacao', 'mobilidade', 'seguranca'):
                self.assertEqual(weights[d], .2)
        equal = weights_for(('habitacao', 'conectividade'), 'iguais')
        self.assertAlmostEqual(sum(equal[d] for d in MATERIAL), 4 / 7)
        for added, model in [(('saude',), 'iguais'), (('habitacao', 'habitacao'), 'iguais'), ((), 'otimizado')]:
            with self.assertRaises(ValueError):
                weights_for(added, model)

    def test_alignment_is_by_identity_and_rejects_cohort_drift(self):
        rows = [{'id': 'a', 'value': 1}, {'id': 'b', 'value': 2}]
        self.assertEqual(align(rows[::-1], ['a', 'b']), rows)
        for invalid in [rows[:1], rows + [rows[0]], rows + [{'id': 'c'}]]:
            with self.assertRaises(ValueError):
                align(invalid, ['a', 'b'])

    def test_baseline_contract_and_no_imputation(self):
        original = json.loads(self.before)
        for change in ('score', 'component', 'year', 'duplicate'):
            pilot = copy.deepcopy(original)
            if change == 'score':
                pilot['rows'][0]['pilot_five']['score'] += 1
            elif change == 'component':
                pilot['rows'][0]['indicator_scores']['educacao'] = None
            elif change == 'year':
                pilot['reference']['reference_year'] = 2023
            else:
                pilot['rows'][-1] = pilot['rows'][0]
            with self.assertRaises(ValueError):
                validate_baseline(pilot)
        components = dict.fromkeys(BASE_DIMS, 50)
        components['conectividade'] = None
        with self.assertRaises(ValueError):
            change_decomposition(components, weights_for(('conectividade',), 'iguais'))

    def test_centered_decomposition_known_case(self):
        # v2=50; novos escores 100 e 0 se compensam no bloco material.
        components = dict.fromkeys(BASE_DIMS, 50)
        components.update(habitacao=100, conectividade=0)
        result = change_decomposition(components, weights_for(('habitacao', 'conectividade'), 'materiais_40pct'))
        self.assertEqual(result['added_centered'], {'habitacao': 5, 'conectividade': -5})
        self.assertEqual(result['added_total'], 0)
        self.assertEqual(result['reweighting_total'], 0)

    def test_reproduction_gates_and_complete_exports(self):
        self.assertEqual(self.before, BASE_PATH.read_bytes())
        saved = json.loads((ROOT / 'docs/obee/resultados/cesta-conjunta.json').read_text())
        self.assertEqual(self.result, saved)
        self.assertEqual(len(self.scenarios), 18)
        self.assertFalse(saved['publication_ready'])
        self.assertFalse(saved['score_eligible'])
        self.assertFalse(saved['is_full_obee_score'])
        self.assertIsNone(saved['approved_weights'])
        self.assertIn(saved['review_proposal']['scenario'], self.scenarios)
        with (ROOT / 'docs/obee/resultados/cesta-conjunta.csv').open() as stream:
            exported = list(csv.DictReader(stream))
        self.assertEqual(len(exported), 468)
        self.assertEqual(len({(r['scenario'], r['id']) for r in exported}), 468)
        for row in exported:
            expected = next(r for r in self.scenarios[row['scenario']]['rows'] if r['id'] == row['id'])
            self.assertEqual(float(row['scenario_score']), expected['scenario_score'])
            self.assertEqual(float(row['composition_delta']), expected['composition_delta'])
        for s in saved['scenarios']:
            self.assertEqual([r['id'] for r in s['rows']], saved['cohort'])
            self.assertEqual(s['versus_v2']['pairs'], 325)
            self.assertAlmostEqual(s['mean_score'], 50)
            for row in s['rows']:
                decomposition = row['decomposition']
                self.assertAlmostEqual(row['composition_delta'], decomposition['added_total'] + decomposition['reweighting_total'])
                self.assertNotIn('saude', row['indicator_scores'])

    def test_housing_only_reconciles_previous_experiment(self):
        previous = json.loads((ROOT / 'docs/obee/resultados/habitacao-cenarios.json').read_text())
        for old in previous['scenarios']:
            model = 'iguais' if old['weight_model'] == 'seis_iguais' else old['weight_model']
            new = self.scenarios[f'habitacao__{old["definition"]}__{model}']
            self.assertEqual(old['versus_v2'], new['versus_v2'])
            self.assertEqual(old['weights'], new['weights'])
            for a, b in zip(old['rows'], new['rows']):
                self.assertEqual(a['id'], b['id'])
                self.assertAlmostEqual(a['scenario_score'], b['scenario_score'])

    def test_joint_sentinels_and_comparisons(self):
        fixed = self.scenarios['conjunta__domicilios_gt2__materiais_40pct']
        equal = self.scenarios['conjunta__domicilios_gt2__iguais']
        self.assertEqual(fixed['versus_v2'], {'strict_reversals': 8, 'baseline_ties_broken': 3, 'ties_reached': 0, 'pairs': 325})
        self.assertEqual(equal['versus_v2']['strict_reversals'], 27)
        cities = {r['id']: r for r in fixed['rows']}
        self.assertAlmostEqual(cities['2611606']['scenario_score'], 35.76923076923077)
        self.assertAlmostEqual(cities['4106902']['scenario_score'], 77.6923076923077)
        self.assertAlmostEqual(cities['2611606']['decomposition']['added_total'], -0.7692307692307683)
        for key, count in [('incremental_comparisons', 16), ('definition_comparisons', 24), ('weight_comparisons', 9)]:
            comparisons = self.result[key]
            self.assertEqual(len(comparisons), count)
            self.assertEqual(len({(c['a'], c['b']) for c in comparisons}), count)
            self.assertTrue(all(c['pairs'] == 325 and c['a'] != c['b'] for c in comparisons))

    def test_redundancy_matrix_reconciles_acquisition(self):
        old = json.loads((ROOT / 'docs/obee/resultados/conectividade-auditoria.json').read_text())
        matrix = self.result['correlations_oriented']
        for dimension in ('trabalho', 'saneamento'):
            self.assertAlmostEqual(matrix['conectividade'][dimension], old['rank_correlations_oriented'][dimension])
        for a, row in matrix.items():
            self.assertAlmostEqual(row[a], 1)
            for b, value in row.items():
                self.assertAlmostEqual(value, matrix[b][a])
                self.assertTrue(-1.000000001 <= value <= 1.000000001)


if __name__ == '__main__':
    unittest.main()
