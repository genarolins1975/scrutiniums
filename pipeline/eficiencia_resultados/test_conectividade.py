import copy
import json
import unittest
from .conectividade import SEED, ROOT, audit, build


class ConnectivityTests(unittest.TestCase):
    def setUp(self):
        self.metadata = json.loads((SEED / 'metadata.json').read_text())
        self.data = json.loads((SEED / 'data.json').read_text())
        self.cohort = json.loads((ROOT / 'docs/obee/resultados/piloto-2022-v2.json').read_text())['rows']

    def test_frozen_complete(self):
        result = build()
        self.assertEqual(result, json.loads((ROOT / 'docs/obee/resultados/conectividade-auditoria.json').read_text()))
        self.assertEqual(len(result['rows']), 26)
        self.assertEqual(result['observations_checked'], 156)
        self.assertFalse(result['score_eligible'])
        for row in result['rows']:
            self.assertAlmostEqual(row['connected_pct'], 100 * row['connected'] / row['total'])

    def test_scope_mutations(self):
        for key, value in [('NC', '3'), ('D3C', '2025'), ('D1C', '5300108'), ('D5C', '73554'), ('D6C', '6815'), ('MN', 'Pessoas'), ('MC', '45')]:
            data = copy.deepcopy(self.data)
            data[1][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                audit(self.metadata, data, self.cohort)

    def test_missing_invalid_and_duplicates(self):
        for value in ('...', '-', 'X', 'nan', 'inf', '-1', True, None):
            data = copy.deepcopy(self.data)
            data[1]['V'] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                audit(self.metadata, data, self.cohort)
        data = copy.deepcopy(self.data)
        data[2] = copy.deepcopy(data[1])
        with self.assertRaises(ValueError):
            audit(self.metadata, data, self.cohort)

    def test_reconciliation_and_metadata(self):
        data = copy.deepcopy(self.data)
        data[2]['V'] = str(float(data[2]['V']) + 10)
        with self.assertRaises(ValueError):
            audit(self.metadata, data, self.cohort)
        metadata = copy.deepcopy(self.metadata)
        metadata['classificacoes'][0]['categorias'][1]['nome'] = 'Não'
        with self.assertRaises(ValueError):
            audit(metadata, self.data, self.cohort)


if __name__ == '__main__':
    unittest.main()
