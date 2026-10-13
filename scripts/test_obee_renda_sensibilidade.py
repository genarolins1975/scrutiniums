import copy
import json
import unittest
from fractions import Fraction as F
from scripts.obee_renda_sensibilidade import build, extract, percentiles, compare, RAW, DOCS


class IncomeSensitivityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = build()
        cls.raw = json.loads(RAW.read_text())
        cls.pilot = json.loads((DOCS / 'piloto-2022-v2.json').read_text())

    def test_coverage_and_reference_values(self):
        rows = {r['capital']: r for r in self.result['rows']}
        self.assertEqual(len(rows), 26)
        self.assertEqual(rows['Rio de Janeiro']['mediana_nominal'], 1212)
        self.assertEqual(rows['Porto Velho']['mediana_nominal'], 866.67)
        self.assertEqual(rows['São Luís']['mediana_nominal'], 866.67)
        self.assertEqual(len(self.result['scenarios']), 8)
        self.assertTrue(all(len(s['rows']) == 26 for s in self.result['scenarios']))
        self.assertFalse(self.result['publication_ready'])
        self.assertIsNone(self.result['approved_weights'])

    def test_ties_and_exact_pair_changes(self):
        self.assertEqual(percentiles([1, 2, 2, 3]), [F(25, 2), F(50), F(50), F(175, 2)])
        self.assertEqual(compare([F(0), F(0), F(1)], [F(1), F(0), F(0)]),
                         {'pairs': 3, 'strict_reversals': 1, 'ties_created': 1,
                          'ties_broken': 1, 'ties_preserved': 0})

    def test_rejects_missing_duplicate_universe_and_median(self):
        selected = next(i for i, r in enumerate(self.raw) if r.get('D1C') == '1100205')
        missing = self.raw[:selected] + self.raw[selected+1:]
        with self.assertRaises(ValueError):
            extract(missing, self.pilot)
        with self.assertRaises(ValueError):
            extract(self.raw + [self.raw[selected]], self.pilot)
        for field, value in [('D3C', '2010'), ('D4C', '4'), ('V', 'nan')]:
            raw = copy.deepcopy(self.raw)
            raw[selected][field] = value
            with self.assertRaises(ValueError):
                extract(raw, self.pilot)
        pilot = copy.deepcopy(self.pilot)
        pilot['rows'][0]['raw_values']['trabalho'] += 1
        with self.assertRaises(ValueError):
            extract(self.raw, pilot)

    def test_only_income_contributes_to_delta(self):
        rows = {r['id']: r for r in self.result['rows']}
        for scenario in self.result['scenarios']:
            for r in scenario['rows']:
                self.assertAlmostEqual(r['delta'], rows[r['id']]['delta_percentil'] * scenario['weights']['trabalho'])


if __name__ == '__main__':
    unittest.main()
