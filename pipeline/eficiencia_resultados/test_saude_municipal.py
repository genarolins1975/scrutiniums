import copy
import json
import unittest
from .saude_municipal import ROOT, SEED, build, combine, parse_table


class MunicipalHealthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = build()
        cls.cities = json.loads((ROOT/'src/lib/eficiencia/panorama-atlas.json').read_bytes())['cities']
        cls.html = (SEED/'sim-2021-2023.html').read_text()
        cls.deaths = parse_table(cls.html, cls.cities, 'sim')
        cls.births = parse_table((SEED/'sinasc-2021-2023.html').read_text(), cls.cities, 'sinasc')

    def test_156_cells_do_not_prove_registration_coverage(self):
        self.assertEqual(sum(len(r['deaths'])+len(r['live_births']) for r in self.result['rows']), 156)
        self.assertFalse(self.result['score_eligible'])
        self.assertTrue(all(not r['score_eligible'] for r in self.result['rows']))

    def test_ratio_of_sums_not_simple_average(self):
        recife = next(r for r in self.result['rows'] if r['id']=='2611606')
        self.assertEqual((recife['deaths_total'], recife['live_births_total']), (581, 52484))
        self.assertAlmostEqual(recife['pooled_rate_per_1000'], 1000*581/52484)
        self.assertNotAlmostEqual(recife['pooled_rate_per_1000'], sum(recife['annual_rates_per_1000'].values())/3)

    def test_wrong_residence_period_or_final_status_rejected(self):
        for a, b in [('Óbitos p/Resid&ecirc;nc', 'Óbitos p/Ocorr&ecirc;nc'), ('2021-2023<PRE>', '2020-2022<PRE>'), ('Dados finais disponíveis até 2024', 'Dados preliminares')]:
            # Response is HTML with entities. Assert the intended mutation took effect.
            if a not in self.html:
                a, b = a.replace('Ó', '&Oacute;'), b.replace('Ó', '&Oacute;')
            changed = self.html.replace(a, b)
            self.assertNotEqual(changed, self.html)
            with self.assertRaises(ValueError): parse_table(changed, self.cities, 'sim')

    def test_missing_city_total_and_duplicate_rejected(self):
        row = '"261160 RECIFE";182;189;210;581'
        self.assertIn(row, self.html)
        for changed in [self.html.replace(row, ''), self.html.replace(row, row+'\n'+row), self.html.replace(row, row.replace(';581',';582'))]:
            with self.assertRaises(ValueError): parse_table(changed, self.cities, 'sim')

    def test_zero_denominator_or_missing_year_rejected(self):
        for mode in ('zero', 'missing'):
            births = copy.deepcopy(self.births)
            if mode == 'zero': births['2611606']['annual']['2022'] = 0
            else: del births['2611606']['annual']['2022']
            with self.assertRaises(ValueError): combine(self.deaths, births)

    def test_municipal_code_mapping_must_be_unique(self):
        cities = self.cities + [self.cities[0]]
        with self.assertRaises(ValueError): parse_table(self.html, cities, 'sim')


if __name__ == '__main__': unittest.main()
