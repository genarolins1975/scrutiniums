import copy
import hashlib
import json
import unittest
from fractions import Fraction as F

from scripts.obee_sensibilidade_pares import SOURCE, OUTPUT, build, classify, interval


class PairSensitivityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = SOURCE.read_bytes()
        cls.data = json.loads(cls.raw)
        cls.sha = hashlib.sha256(cls.raw).hexdigest()
        cls.result = build(cls.data, cls.sha)

    def test_exact_crossing_interior_boundary_and_constant(self):
        low, high, root = interval(F(10), F(-10))
        self.assertEqual((low, high, root), (F(2), F(-10, 7), F(1, 2)))
        self.assertEqual(classify(min(low, high), max(low, high)), 'order_changes')
        low, high, root = interval(F(2), F(-3))
        self.assertEqual(root, F(2, 5))
        self.assertEqual(classify(min(low, high), max(low, high)), 'tie_possible')
        self.assertEqual(interval(F(0), F(0)), (0, 0, None))
        self.assertEqual(classify(F(0), F(0)), 'always_tied')
        self.assertEqual(interval(F(1), F(1)), (1, 1, None))

    def test_affine_interior_is_bounded_by_endpoints(self):
        for material, other in [(F(-7), F(3)), (F(11), F(-12)), (F(2), F(2))]:
            lo, hi, _ = interval(other, material)
            for budget in [F(2, 5), F(5, 11), F(1, 2), F(4, 7)]:
                value = (1 - budget) * other + budget * material
                self.assertLessEqual(min(lo, hi), value)
                self.assertGreaterEqual(max(lo, hi), value)

    def test_frozen_outputs_reproduce_and_no_approval(self):
        self.assertEqual(self.result, json.loads(OUTPUT.read_text()))
        self.assertEqual(self.result['summary'], dict(pairs=325, strict_order_preserved=294,
                         order_changes=30, tie_possible=1, always_tied=0, dominance_all_definitions=55))
        self.assertFalse(self.result['publication_ready'])
        self.assertFalse(self.result['independent_review'])
        self.assertEqual(self.raw, SOURCE.read_bytes())

    def test_pair_sentinels_and_every_pair_present(self):
        pairs = self.result['pairs']
        self.assertEqual(len({frozenset((p['a'], p['b'])) for p in pairs}), 325)
        recife = next(p for p in pairs if {p['a'], p['b']} == {'2611606', '4106902'})
        self.assertIn(recife['state'], ('a_always_higher', 'b_always_higher'))
        self.assertAlmostEqual(max(abs(recife['min_gap']), abs(recife['max_gap'])), 46.7032967032967)
        aracaju = next(p for p in pairs if {p['a'], p['b']} == {'2800308', '2211001'})
        self.assertEqual(aracaju['state'], 'order_changes')
        for pair in pairs:
            self.assertEqual(len(pair['definitions']), 4)
            if pair['componentwise_dominance_all_definitions'] is not None:
                self.assertIn(pair['state'], ('a_always_higher', 'b_always_higher'))

    def test_row_order_is_irrelevant(self):
        data = copy.deepcopy(self.data)
        for scenario in data['scenarios']:
            scenario['rows'].reverse()
        self.assertEqual(build(data, self.sha), self.result)

    def test_incomplete_duplicate_and_invalid_components_fail(self):
        for kind in ('scenario', 'duplicate', 'percentile', 'weights', 'score'):
            with self.subTest(kind=kind):
                data = copy.deepcopy(self.data)
                scenario = next(s for s in data['scenarios'] if s['inclusion'] == 'conjunta')
                if kind == 'scenario':
                    data['scenarios'].remove(scenario)
                elif kind == 'duplicate':
                    scenario['rows'][-1] = scenario['rows'][0]
                elif kind == 'percentile':
                    scenario['rows'][0]['indicator_scores']['habitacao'] = 51.123
                elif kind == 'weights':
                    scenario['weights']['habitacao'] = 0.5
                else:
                    scenario['rows'][0]['scenario_score'] = 0
                with self.assertRaises(ValueError):
                    build(data, self.sha)


if __name__ == '__main__':
    unittest.main()
