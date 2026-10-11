"""Verificações do resumo versionado que alimenta a entrada OBEE."""
import csv
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'src/lib/eficiencia/atlas-resumo.json').read_text())

    def test_hashes_and_periods(self):
        for key in ('education', 'food'):
            meta = self.data[key]
            self.assertEqual(hashlib.sha256((ROOT / meta['path']).read_bytes()).hexdigest(), meta['sha256'])
        self.assertEqual(self.data['education']['period'], '2023')
        self.assertEqual(self.data['food']['period'], '2024')

    def test_every_city_matches_source_and_eligibility(self):
        with (ROOT / self.data['education']['path']).open(encoding='utf-8-sig', newline='') as f:
            rows = {r['codigo_ibge']: r for r in csv.DictReader(f) if r['ano']=='2023'
                and r['etapa']=='Ensino fundamental, anos iniciais' and r['componente']=='portugues'}
        self.assertEqual(len(self.data['cities']), 26)
        self.assertEqual({r['id'] for r in self.data['cities']}, set(rows))
        for city in self.data['cities']:
            raw = rows[city['id']]
            eligible = raw['status']=='OBSERVADO' and raw['elegivel_comparacao']=='sim' and raw['valor']!=''
            self.assertEqual(city['value'], float(raw['valor']) if eligible else None)

    def test_regions_not_municipal_estimates(self):
        raw = json.loads((ROOT / self.data['food']['path']).read_text())
        expected = {r['territory']: r['secure'] for r in raw['needs'] if r['year']==2024}
        self.assertEqual({r['id']: r['value'] for r in self.data['regions']}, expected)
        self.assertNotIn('Recife', expected)


if __name__ == '__main__':
    unittest.main()
