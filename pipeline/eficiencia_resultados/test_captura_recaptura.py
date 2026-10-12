"""Scope regression checks: do not turn UF evidence into municipal eligibility."""
import copy
import json
import unittest
from .captura_recaptura import SNAPSHOT, audit, review_frozen


class CaptureRecaptureTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))

    def test_review_keeps_health_unavailable(self):
        result = review_frozen()
        self.assertEqual(sum(t['selected_cells'] for t in result['tables']), 297)
        self.assertEqual(result['expected_municipal_infant_coverage_cells'], 78)
        self.assertEqual(result['available_municipal_infant_coverage_cells_in_inspected_files'], 0)
        self.assertFalse(result['score_eligible'])
        self.assertIsNone(result['health_score'])

    def test_homonymous_states_cannot_become_cities(self):
        for name in ['São Paulo', 'Rio de Janeiro']:
            with self.subTest(name=name):
                payload = copy.deepcopy(self.snapshot)
                row = next(r for r in payload['sources'][0]['tables'][0]['rows'] if r['name'] == name)
                row['geography_level'] = 'municipality'
                with self.assertRaisesRegex(ValueError, 'Geographic level'):
                    audit(payload)

    def test_missing_values_and_invalid_coverage_are_rejected(self):
        for value in [None, True, -1, 101, float('nan'), float('inf')]:
            with self.subTest(value=value):
                payload = copy.deepcopy(self.snapshot)
                payload['sources'][0]['tables'][0]['rows'][0]['values']['2022'] = value
                with self.assertRaises(ValueError):
                    audit(payload)

    def test_scope_revision_and_duplicates_require_review(self):
        mutations = [
            lambda p: p['selected_years'].pop(),
            lambda p: p['sources'][0].update(sha256='0' * 64),
            lambda p: p['sources'][0]['tables'][0].update(geography_header='Município'),
            lambda p: p['sources'][0]['tables'].pop(),
            lambda p: p['sources'][0]['tables'][0]['rows'].append(p['sources'][0]['tables'][0]['rows'][0]),
        ]
        for mutate in mutations:
            payload = copy.deepcopy(self.snapshot)
            mutate(payload)
            with self.assertRaises(ValueError):
                audit(payload)


if __name__ == '__main__':
    unittest.main()
