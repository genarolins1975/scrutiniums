import copy
import json
import math
from pathlib import Path
import unittest
from .coletar_expansao import sanitation, violence
from .expansao import build

HERE = Path(__file__).parent


class ExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = build()
        cls.cities = [{k: r[k] for k in ('id', 'name')} for r in cls.result['rows']]
        cls.raw = json.loads((HERE/'seed/sidra6805-values.json').read_bytes())
        cls.san = sanitation(cls.raw, cls.cities)
        cls.ufs = {r['id']: r['uf'] for r in cls.san}
        cls.table = (HERE/'seed/atlas-tabela3.txt').read_text()

    def test_complete_five_basket_is_not_full_obee(self):
        self.assertEqual(len(self.result['rows']), 26)
        self.assertEqual(sum(len(r['raw_values']) for r in self.result['rows']), 130)
        self.assertFalse(self.result['publication_ready'])
        self.assertFalse(self.result['is_full_obee_score'])
        for r in self.result['rows']:
            self.assertEqual(r['pilot_five']['coverage_weight'], 1)
            self.assertAlmostEqual(r['pilot_five']['score'], sum(r['indicator_scores'].values())/5)

    def test_health_missing_preserves_weight_without_point(self):
        for r in self.result['rows']:
            six = r['extended_six']
            self.assertIsNone(six['score'])
            self.assertEqual(six['missing'], ['saude'])
            self.assertAlmostEqual(six['upper']-six['lower'], 100/6)
            self.assertAlmostEqual(six['lower'], r['pilot_five']['score']*5/6)
        self.assertEqual(self.result['health_review']['geography'], 'UF')

    def test_sanitation_nested_categories_not_double_counted(self):
        for r in self.san:
            c = r['categories']
            self.assertEqual(r['numerator'], c['46290']+c['72112'])
            self.assertEqual(c['46290'], c['72110']+c['72111'])
            self.assertLessEqual(r['value'], 100)
            self.assertLessEqual(r['network_only_value'], r['value'])

    def test_sanitation_rejects_wrong_scope_duplicates_and_missing(self):
        for key, value in [('NC', '3'), ('D2C', '1000381'), ('D3C', '2023'), ('V', '...'), ('V', '-1')]:
            raw = copy.deepcopy(self.raw); raw[1][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                sanitation(raw, self.cities)
        with self.assertRaises(ValueError): sanitation(self.raw+[self.raw[1]], self.cities)
        with self.assertRaises(ValueError): sanitation(self.raw[:-1], self.cities)

    def test_sanitation_rejects_wrong_denominator(self):
        raw = copy.deepcopy(self.raw)
        total = next(r for r in raw[1:] if r['D4C']=='46292')
        total['V'] = str(int(total['V'])+1)
        with self.assertRaises(ValueError): sanitation(raw, self.cities)

    def test_violence_reconciles_and_excludes_df(self):
        rows = violence(self.table, self.cities, self.ufs)
        self.assertEqual(len(rows), 26)
        self.assertNotIn('DF', {r['uf'] for r in rows})
        sp = next(r for r in rows if r['name']=='São Paulo')
        self.assertEqual((sp['registered'], sp['hidden_estimated'], sp['total_estimated']), (344,1418,1762))
        with self.assertRaises(ValueError): violence(self.table.replace('1.762', '1.763'), self.cities, self.ufs)
        wrong = {**self.ufs, sp['id']: 'RJ'}
        with self.assertRaises(ValueError): violence(self.table, self.cities, wrong)

    def test_sensitivity_and_reference_invariants(self):
        s = self.result['sensitivity']
        self.assertEqual(len(s['weights']), 32)
        self.assertEqual(s['pairwise_comparisons'], math.comb(26, 2))
        self.assertEqual(s['pairs_with_sign_reversal'], 37)
        self.assertAlmostEqual(sum(r['pilot_five']['score'] for r in self.result['rows'])/26, 50)
        for r in self.result['rows']:
            self.assertEqual(len(r['weight_scenarios']), 32)
            self.assertEqual(len(r['leave_one_out']), 5)
            self.assertLessEqual(r['weight_sensitivity_range'][0], r['pilot_five']['score']+1e-10)
            self.assertGreaterEqual(r['weight_sensitivity_range'][1]+1e-10, r['pilot_five']['score'])

    def test_alternative_definitions_and_recovery_regression(self):
        rows = {r['id']: r for r in self.result['rows']}
        sp = rows['3550308']
        self.assertNotAlmostEqual(sp['pilot_five']['score'], sp['definition_sensitivity']['registered_only'])
        self.assertAlmostEqual(rows['2611606']['pilot_five']['score'], 33.46153846153847)
        self.assertAlmostEqual(rows['4106902']['pilot_five']['score'], 77.3076923076923)


if __name__ == '__main__': unittest.main()
