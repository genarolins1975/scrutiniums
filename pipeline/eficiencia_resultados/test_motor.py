import unittest
from .motor import aggregate, percentile
from .piloto import build


class MotorTests(unittest.TestCase):
    def test_ties_and_polarity(self):
        self.assertEqual(percentile(20,[10,20,20,30],'higher'),50)
        self.assertEqual(percentile(10,[10,20,20,30],'lower'),87.5)

    def test_missing_not_zero(self):
        self.assertIsNone(percentile(None,[0,10],'higher'))
        self.assertEqual(percentile(0,[0,10],'higher'),25)

    def test_fixed_reference_and_extremes(self):
        reference=[10,20,30]
        self.assertEqual(percentile(25,reference,'higher'),200/3)
        self.assertEqual(percentile(40,reference,'higher'),100)
        self.assertEqual(percentile(0,reference,'higher'),0)
        self.assertEqual(reference,[10,20,30])

    def test_invalid_values(self):
        for x in [True,float('nan'),float('inf'),'10']:
            with self.assertRaises(ValueError):percentile(x,[1,2],'higher')
        for ref in [[],[None],[float('nan')]]:
            with self.assertRaises(ValueError):percentile(1,ref,'higher')
        with self.assertRaises(ValueError):percentile(1,[1],'other')

    def test_identification_bounds(self):
        r=aggregate({'known':72.5,'missing':None},{'known':.8,'missing':.2})
        self.assertIsNone(r['score'])
        self.assertEqual((r['lower'],r['upper']),(58,78))
        self.assertEqual(r['coverage_weight'],.8)

    def test_all_missing_and_actual_zero(self):
        self.assertEqual(aggregate({'a':None},{'a':1})['upper'],100)
        self.assertEqual(aggregate({'a':0},{'a':1})['score'],0)

    def test_rejects_implicit_renormalization(self):
        for scores,weights in [({'a':50},{'a':.8}),({'a':50},{'a':.5,'b':.5}),({'a':50,'b':None},{'a':1.1,'b':-.1})]:
            with self.assertRaises(ValueError):aggregate(scores,weights)

    def test_hierarchical_bounds(self):
        chapter=aggregate({'x':50,'y':None},{'x':.5,'y':.5})
        # When one chapter is partial, preserve its internal information by
        # flattening the effective weights instead of replacing it with zero.
        whole=aggregate({'x':50,'y':None,'z':80},{'x':.25,'y':.25,'z':.5})
        self.assertEqual((whole['lower'],whole['upper']),(52.5,77.5))
        self.assertEqual(chapter['coverage_weight'],.5)


class PilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.pilot=build()

    def test_coverage_scope(self):
        p=self.pilot
        self.assertEqual(len(p['rows']),26)
        self.assertFalse(p['publication_ready'])
        self.assertFalse(p['is_full_obee_score'])
        self.assertEqual(len(p['reference']['basket']),3)
        self.assertFalse(next(r for r in p['coverage_matrix'] if r['id']=='saude')['included_in_pilot'])

    def test_percentile_mean_and_symmetry(self):
        rows=self.pilot['rows']
        for key in ['educacao','trabalho','mobilidade']:
            self.assertAlmostEqual(sum(r['indicator_scores'][key] for r in rows)/26,50)
        self.assertAlmostEqual(sum(r['score'] for r in rows)/26,50)

    def test_sensitivity_is_not_false_precision(self):
        s=self.pilot['sensitivity']
        self.assertEqual(len(s['weights']),8)
        self.assertEqual(s['pairwise_comparisons'],325)
        self.assertGreater(s['pairs_with_sign_reversal'],0)
        for r in self.pilot['rows']:
            lo,hi=r['weight_sensitivity_range']
            self.assertLessEqual(lo,r['score']+1e-10)
            self.assertGreaterEqual(hi,r['score']-1e-10)
            self.assertEqual(len(r['leave_one_out']),3)


if __name__=='__main__':unittest.main()
