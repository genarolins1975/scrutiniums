import json
import unittest
from .habitacao_cenarios import ROOT, WEIGHTS, aggregate, percentiles_lower, compare_pairs, build


class ScenarioTests(unittest.TestCase):
    def test_percentiles_direction_and_ties(self):
        self.assertEqual(percentiles_lower([1, 2, 2, 3]), [87.5, 50, 50, 12.5])
        with self.assertRaises(ValueError):
            percentiles_lower([float('nan')])

    def test_weight_contract_and_missing(self):
        for weights in WEIGHTS.values():
            self.assertAlmostEqual(sum(weights.values()), 1)
            self.assertAlmostEqual(aggregate({d: 50 for d in weights}, weights), 50)
            values = {d: 50 for d in weights}
            values['habitacao'] = None
            with self.assertRaises(ValueError):
                aggregate(values, weights)
        self.assertAlmostEqual(sum(WEIGHTS['materiais_40pct'][d] for d in ('trabalho', 'saneamento', 'habitacao')), .4)
        self.assertAlmostEqual(sum(WEIGHTS['seis_iguais'][d] for d in ('trabalho', 'saneamento', 'habitacao')), .5)
        with self.assertRaises(ValueError):
            aggregate({'a': 50}, {'a': .5})

    def test_pair_categories(self):
        self.assertEqual(compare_pairs([1, 2, 2], [3, 1, 2]), {'strict_reversals': 2, 'baseline_ties_broken': 1, 'ties_reached': 0, 'pairs': 3})
        self.assertEqual(compare_pairs([1, 2], [1, 1])['ties_reached'], 1)
        self.assertEqual(compare_pairs([1, 2], [1, 1 + 1e-12])['ties_reached'], 1)

    def test_frozen_output_and_baseline(self):
        before = (ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_bytes()
        result = build()
        self.assertEqual(before, (ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_bytes())
        self.assertEqual(result, json.loads((ROOT / 'docs/obee/resultados/habitacao-cenarios.json').read_text()))
        self.assertEqual(len(result['scenarios']), 8)
        self.assertEqual(len(result['definition_comparisons']), 12)
        self.assertFalse(result['publication_ready'])
        self.assertIsNone(result['recommended_weights'])
        for s in result['scenarios']:
            self.assertEqual(s['versus_v2']['pairs'], 325)
            self.assertEqual(len(s['rows']), 26)
            self.assertAlmostEqual(sum(r['scenario_score'] for r in s['rows']) / 26, 50)
            for r in s['rows']:
                self.assertAlmostEqual(r['composition_delta'], r['scenario_score'] - r['baseline_score'])


if __name__ == '__main__':
    unittest.main()
