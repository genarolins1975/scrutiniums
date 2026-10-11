"""Fixtures artificiais somente para testes; nunca são publicadas."""
import unittest
from pipeline.eficiencia_mobilidade.oportunidades_normalizar import aggregate, number


def fixture():
    return {'schemaVersion': 1, 'referenceYear': 2019, 'populationYear': 2010,
            'metrics': [{'id': 'CMATT30'}], 'cities': [{'id': '2611606', 'name': 'Recife'}],
            'sources': [], 'metadata': {},
            'population': [['2611606', 'a', 10, 1], ['2611606', 'b', 30, 10],
                           ['2611606', 'c', 20, None], ['2611606', 'd', 0, None]],
            'access': [['2611606', 'a', 'walk', 'na', 0], ['2611606', 'b', 'walk', 'na', 100]]}


class OpportunitiesTest(unittest.TestCase):
    def all(self, s=None):
        return aggregate(s or fixture())['records'][0]['groups'][0]

    def test_weighted_mean_not_sum_or_simple_mean(self):
        x = self.all()
        self.assertEqual(x['mean'], 75)
        self.assertEqual(x['numerator'], 3000)
        self.assertEqual(x['coveredPopulation'], 40)

    def test_missing_origin_not_imputed_zero(self):
        x = self.all()
        self.assertEqual(x['totalPopulation'], 60)
        self.assertAlmostEqual(x['coverage'], 100*40/60)
        self.assertEqual(x['zeroShare'], 25)

    def test_zero_is_observed(self):
        s = fixture(); s['access'][1][-1] = 0
        self.assertEqual(self.all(s)['mean'], 0)
        self.assertEqual(self.all(s)['zeroShare'], 100)

    def test_empty_cells_null_result(self):
        s = fixture()
        for row in s['access']: row[-1] = None
        self.assertIsNone(self.all(s)['mean'])
        self.assertIsNone(self.all(s)['zeroShare'])
        self.assertEqual(self.all(s)['coverage'], 0)

    def test_groups_reconcile_without_reclassification(self):
        x = aggregate(fixture())['records'][0]['groups']
        self.assertEqual(x[1]['mean'], 0)
        self.assertEqual(x[10]['mean'], 100)
        self.assertEqual(x[-1]['totalPopulation'], 20)
        self.assertEqual(sum(g['totalPopulation'] for g in x[1:]), x[0]['totalPopulation'])
        self.assertEqual(sum(g['coveredPopulation'] for g in x[1:]), x[0]['coveredPopulation'])

    def test_duplicate_origin_rejected(self):
        s=fixture(); s['access'].append(s['access'][0])
        with self.assertRaises(ValueError): aggregate(s)

    def test_duplicate_population_rejected(self):
        s=fixture(); s['population'].append(s['population'][0])
        with self.assertRaises(ValueError): aggregate(s)

    def test_unknown_population_excluded_and_counted(self):
        s=fixture(); s['population'][0][2]=None
        x=self.all(s)
        self.assertEqual(x['mean'], 100)
        self.assertEqual(x['missingWeightCells'], 1)
        self.assertEqual(x['totalPopulation'], 50)

    def test_unmatched_origin_not_assumed_uninhabited(self):
        s=fixture(); s['access'].append(['2611606', 'x', 'walk', 'na', 999])
        r=aggregate(s)['records'][0]
        self.assertEqual(r['unmatchedCells'], 1)
        self.assertEqual(r['groups'][0]['mean'], 75)

    def test_peak_not_merged(self):
        s=fixture(); s['access']=[['2611606', 'a', 'car', '1', 10],['2611606', 'a', 'car', '0', 30]]
        r=aggregate(s)['records']
        self.assertEqual(len(r),2)
        self.assertEqual([(x['peak'],x['groups'][0]['mean'])for x in r],[('0',30),('1',10)])

    def test_numerical_states(self):
        self.assertEqual(number('0'),0)
        for x in [None,'','NA','NaN']: self.assertIsNone(number(x))
        for x in ['Inf','-1','abc']:
            with self.assertRaises(ValueError): number(x)

    def test_zero_decile_not_reassigned(self):
        s=fixture(); s['population'][0][3]=0
        gs=aggregate(s)['records'][0]['groups']
        self.assertIsNone(gs[1]['mean'])
        self.assertEqual(gs[-1]['coveredPopulation'],10)
        self.assertEqual(gs[0]['mean'],75)

if __name__=='__main__': unittest.main()
