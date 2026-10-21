import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('auditar-robustez-piloto.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class RobustnessTests(unittest.TestCase):
    def test_ties_are_not_reversals(self):
        result = m.compare([1, 1, 0], [[0, 2, 1]])
        self.assertEqual(result['pairs'], 3)
        self.assertEqual(result['strict_reversal'], 1)
        self.assertEqual(result['baseline_tie_broken'], 1)

    def test_floating_residue_is_tie(self):
        self.assertEqual(m.sign(1e-12), 0)
        self.assertEqual(m.compare([1, 0], [[1e-12, 0]])['strict_reversal'], 0)
        self.assertEqual(m.compare([1, 0], [[1e-12, 0]])['tie_reached'], 1)

    def test_correlation_contract(self):
        self.assertAlmostEqual(m.correlation([1, 2, 3], [3, 2, 1]), -1)
        self.assertIsNone(m.correlation([1, 1], [1, 2]))

    def test_frozen_audit_reconciles(self):
        data = json.loads(m.INPUT.read_bytes())
        result = m.audit(data)
        self.assertEqual(result['weights']['strict_reversal'], data['sensitivity']['pairs_with_sign_reversal'])
        self.assertEqual(result['distinct_weight_vectors'], 31)
        self.assertAlmostEqual(sum(result['variance_share'].values()), 1)
        self.assertFalse(result['publication_ready'])
        data['rows'][0]['pilot_five']['score'] += 1
        with self.assertRaises(ValueError):
            m.audit(data)

if __name__ == '__main__':
    unittest.main()
