import copy
import unittest
from .conjunta import compare_joint, factorial_scenarios, demo
from .hierarquia import demo as hierarchy_demo
from .ancoras import compare_references

class JointTests(unittest.TestCase):
    def setUp(self):
        p=hierarchy_demo()['input_profiles'];self.a=p['a'];self.b=p['b']
        self.basket=['education','health','work','food','assistance']
        self.refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True) for r in self.a['records']}
        self.scenarios=factorial_scenarios(self.basket)
    def run_case(self): return compare_joint(self.a,self.b,self.basket,self.refs,self.scenarios)
    def test_factorial(self):
        r=self.run_case();self.assertEqual(len(r['scenarios']),16)
        self.assertFalse(r['publishable'])
        for s in r['scenarios']:
            self.assertEqual(len(s['candidate_references']),2)
            self.assertTrue(all(v['validated'] is False for v in s['candidate_references'].values()))
            for w in s['effective_weights'].values():self.assertAlmostEqual(sum(w.values()),1)
    def test_identity_and_isolated_equivalence(self):
        self.scenarios=[{'id':'identity'},{'id':'anchor','reference_shifts':{'education.access':{'lower':.1}}}]
        r=self.run_case();self.assertEqual(r['baseline'],{k:r['scenarios'][0][k] for k in r['baseline']})
        isolated=compare_references(self.a,self.b,self.basket,self.refs)
        s=next(s for s in isolated['scenarios'] if s['component']=='education.access' and s['bound']=='lower' and s['shift']>0)
        self.assertAlmostEqual(s['a']['aggregate']['value'],r['scenarios'][1]['a']['aggregate']['value'])
    def test_missing_and_pending_block(self):
        self.a['records'][0]['raw_value']=None
        self.assertEqual(self.run_case()['state'],'BLOQUEADO')
        self.a['records'][0]['raw_value']=95;self.refs['education.access']['validated']=1
        self.assertEqual(self.run_case()['state'],'BLOQUEADO')
    def test_context(self):
        self.a['context']['edition']='OUTRA'
        with self.assertRaises(ValueError):self.run_case()
    def test_invalid_scenarios(self):
        for scenarios in ([],[{'id':'x'},{'id':'x'}],[{'id':'x','unknown':1}],
                [{'id':'x','chapter_weights':{'education':1}}],
                [{'id':'x','reference_shifts':{'education.access':{'lower':True}}}],
                [{'id':'x','reference_shifts':{'unknown':{'lower':.1}}}]):
            self.scenarios=scenarios
            with self.assertRaises(ValueError):self.run_case()
    def test_immutable_and_reproducible(self):
        before=copy.deepcopy((self.a,self.b,self.refs,self.scenarios)); first=self.run_case()
        self.assertEqual(first,self.run_case());self.assertEqual(before,(self.a,self.b,self.refs,self.scenarios))
    def test_equal_profiles(self):
        self.b=copy.deepcopy(self.a)
        self.assertTrue(all(s['relation']=='EMPATE_NUMERICO' for s in self.run_case()['scenarios']))
    def test_zero_preserved(self):
        self.a['records'][-1]['raw_value']=0
        self.assertTrue(all(s['a']['aggregate']['value']==0 for s in self.run_case()['scenarios']))
    def test_synthetic(self):self.assertEqual(demo()['real_scores_released'],0)

if __name__=='__main__':unittest.main()
