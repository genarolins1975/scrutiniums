import json
import unittest

from .precisao_candidatas import BASE_PATH, DOCS, build, descriptive_record


class CandidatePrecisionTests(unittest.TestCase):
    def test_reproducible_full_cohort_and_unchanged_baseline(self):
        before = BASE_PATH.read_bytes()
        result = build()
        self.assertEqual(result, json.loads((DOCS / 'precisao-candidatas.json').read_text()))
        self.assertEqual(before, BASE_PATH.read_bytes())
        self.assertEqual(len(result['rows']), 52)
        self.assertEqual(len({(r['indicator'], r['id']) for r in result['rows']}), 52)
        self.assertFalse(result['publication_ready'])
        self.assertFalse(result['is_full_obee_score'])
        for row in result['rows']:
            self.assertNotEqual(row['id'], '5300108')
            self.assertIsNone(row['standard_error_pp'])
            self.assertIsNone(row['confidence_interval_pct'])
            self.assertFalse(row['statistical_difference_claim_allowed'])
            self.assertFalse(row['rank_confidence_claim_allowed'])
            self.assertFalse(row['score_eligible'])

    def test_expanded_totals_never_become_sample_size(self):
        small = {'id': '2611606', 'name': 'Recife', 'total': 100, 'yes': 90}
        big = dict(small, total=1000000, yes=900000)
        for source in (small, big):
            row = descriptive_record('conectividade', source, 'yes', ['2611606'])
            self.assertEqual(row['estimate_pct'], 90)
            self.assertIsNone(row['standard_error_pp'])
            self.assertIsNone(row['confidence_interval_pct'])

    def test_invalid_estimates_and_reference_fail_closed(self):
        row = {'id': '2611606', 'name': 'Recife', 'total': 100, 'yes': 90}
        for key, value in [('total', 0), ('total', -1), ('yes', None), ('yes', -1),
                           ('yes', 101), ('yes', float('nan')), ('total', float('inf')),
                           ('yes', True), ('yes', '90')]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                descriptive_record('conectividade', dict(row, **{key: value}), 'yes', ['2611606'])
        for indicator, ids, year in [('energia', ['2611606'], 2022),
                                     ('conectividade', ['4106902'], 2022),
                                     ('conectividade', ['2611606'], 2023)]:
            with self.assertRaises(ValueError):
                descriptive_record(indicator, row, 'yes', ids, year)

    def test_known_municipal_ratios_and_zero_is_not_missing(self):
        rows = {(r['indicator'], r['id']): r for r in build()['rows']}
        self.assertAlmostEqual(rows['habitacao', '2611606']['estimate_pct'], 100 * 51354 / 547539)
        self.assertAlmostEqual(rows['conectividade', '4106902']['estimate_pct'], 100 * 645858 / 685739)
        zero = descriptive_record('habitacao', {'id': '2611606', 'name': 'Recife', 'total': 10, 'n': 0}, 'n', ['2611606'])
        self.assertEqual(zero['estimate_pct'], 0)
        self.assertIsNone(zero['standard_error_pp'])

    def test_annex_is_not_a_municipal_precision_source(self):
        inventory = json.loads((DOCS / 'precisao-anexo-inventario.json').read_text())
        names = [s['name'] for s in inventory['sheets']]
        self.assertEqual(len(names), 33)
        self.assertEqual(len(set(names)), 33)
        self.assertEqual(sum(n.startswith('Região ') for n in names), 5)
        self.assertIn('Brasil', names)
        self.assertIn('Distrito Federal', names)
        self.assertNotIn('Recife', names)
        self.assertNotIn('Curitiba', names)
        for sheet in inventory['sheets']:
            self.assertEqual(sheet['estimate_types'], ['Pessoas', 'Domicílios'])
        evidence = json.loads((DOCS / 'precisao-candidatas-evidencia.json').read_text())
        self.assertFalse(evidence['decision']['municipal_precision_resolved'])
        self.assertEqual(evidence['microdata_release']['public_max_geography'], 'UF')


if __name__ == '__main__':
    unittest.main()
