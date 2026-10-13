import copy
import json
import unittest
from .habitacao import SEED, ROOT, audit_table, build


class HabitacaoTests(unittest.TestCase):
    def setUp(self):
        self.meta = json.loads((SEED / '9934-metadata.json').read_text())
        self.data = json.loads((SEED / '9934-data.json').read_text())
        self.cohort = json.loads((SEED / 'manifest.json').read_text())['cohort']

    def audit(self, data=None, meta=None):
        return audit_table(meta or self.meta, data or self.data, self.cohort, 9934)

    def test_complete_and_frozen(self):
        result = build()
        self.assertEqual(result, json.loads((ROOT / 'docs/obee/resultados/habitacao-adensamento-auditoria.json').read_text()))
        self.assertEqual(len(result['households']), 26)
        self.assertEqual(result['observations_checked'], 520)
        self.assertFalse(result['score_eligible'])
        self.assertFalse(result['publication_ready'])

    def test_units_and_numerators(self):
        result = build()
        a = next(r for r in result['households'] if r['id'] == '2611606')
        b = next(r for r in result['residents'] if r['id'] == '2611606')
        self.assertEqual(a['above_two'], 51354)
        self.assertAlmostEqual(a['above_two_pct'], 100 * 51354 / 547539)
        self.assertEqual(b['above_two'], 231523)
        self.assertNotEqual(a['above_two_pct'], b['above_two_pct'])
        self.assertLessEqual(max(abs(r['partition_residual']) for r in result['households']), 1)

    def test_missing_and_invalid_are_not_zero(self):
        for value in ('...', '-', 'X', 'nan', 'inf', '-1', None, True):
            with self.subTest(value=value):
                data = copy.deepcopy(self.data)
                data[1]['V'] = value
                with self.assertRaises(ValueError):
                    self.audit(data)

    def test_geography_period_unit_and_universe(self):
        for key, value in [('NC', '3'), ('D1C', '5300108'), ('D1N', 'Outra cidade'), ('D3C', '2023'), ('D5C', '73104'), ('D6C', '73109'), ('MN', 'Pessoas'), ('MC', '45')]:
            with self.subTest(key=key):
                data = copy.deepcopy(self.data)
                data[1][key] = value
                with self.assertRaises(ValueError):
                    self.audit(data)

    def test_duplicates_and_reconciliation(self):
        data = copy.deepcopy(self.data)
        data[2] = copy.deepcopy(data[1])
        with self.assertRaises(ValueError):
            self.audit(data)
        data = copy.deepcopy(self.data)
        data[2]['V'] = str(float(data[2]['V']) + 20)
        with self.assertRaises(ValueError):
            self.audit(data)
        data = copy.deepcopy(self.data)
        next(r for r in data[1:] if r['D2C'] == '1000381')['V'] = '99'
        with self.assertRaises(ValueError):
            self.audit(data)

    def test_metadata_contract(self):
        meta = copy.deepcopy(self.meta)
        meta['classificacoes'][0]['categorias'][2]['nivel'] = 2
        with self.assertRaises(ValueError):
            self.audit(meta=meta)
        meta = copy.deepcopy(self.meta)
        meta['periodicidade']['fim'] = 2023
        with self.assertRaises(ValueError):
            self.audit(meta=meta)


if __name__ == '__main__':
    unittest.main()
