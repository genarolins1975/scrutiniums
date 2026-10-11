import copy
import unittest
from .ancoras import compare_references, demo
from .hierarquia import demo as hierarchy_demo

class AnchorsTests(unittest.TestCase):
    def setUp(self):
        profiles=hierarchy_demo()['input_profiles']; self.a=profiles['a']; self.b=profiles['b']
        self.basket=['education','health','work','food','assistance']
        self.refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True) for r in self.a['records']}
    def run_case(self):
        return compare_references(self.a,self.b,self.basket,self.refs)
    def test_hierarchy_and_hypotheses(self):
        result=self.run_case(); self.assertEqual(len(result['scenarios']),60)
        for s in result['scenarios']:
            self.assertFalse(s['candidate_reference']['validated'])
            chapter=s['component'].split('.')[0]
            for label in ('a','b'):
                for actual,base in zip(s[label]['chapters'],result['baseline'][label]['chapters']):
                    if actual['id']!=chapter: self.assertEqual(actual,base)
        self.assertFalse(result['publishable'])
    def test_pending_reference_blocks(self):
        self.refs['education.access']['validated']=False
        r=self.run_case(); self.assertEqual(r['state'],'BLOQUEADO'); self.assertEqual(r['scenarios'],[])
    def test_missing_blocks(self):
        self.a['records'][0]['raw_value']=None
        self.assertEqual(self.run_case()['state'],'BLOQUEADO')
    def test_incompatible_context_blocks(self):
        self.a['records'][0]['territory']='OUTRO'
        self.assertEqual(self.run_case()['state'],'BLOQUEADO')
        self.a['context']['edition']='OUTRA'
        with self.assertRaises(ValueError): self.run_case()
    def test_zero_and_floor(self):
        self.a['records'][0]['raw_value']=0
        result=self.run_case(); self.assertEqual(result['baseline']['a']['aggregate']['value'],0)
        scenario=next(s for s in result['scenarios'] if s['component']=='education.access' and s['bound']=='lower' and s['shift']>0)
        self.assertEqual(scenario['a']['aggregate']['value'],0)
        self.assertTrue(scenario['at_boundary']['a'])
    def test_lower_direction(self):
        self.refs['education.access']['direction']='lower'
        r=self.run_case()
        s=next(s for s in r['scenarios'] if s['component']=='education.access' and s['bound']=='upper' and s['shift']>0)
        self.assertGreater(s['delta_aggregate']['a'],0)
    def test_immutable_and_equal_profiles(self):
        before=copy.deepcopy((self.a,self.b,self.refs)); self.run_case()
        self.assertEqual((self.a,self.b,self.refs),before)
        self.b=copy.deepcopy(self.a)
        r=self.run_case(); self.assertTrue(all(s['relation']=='EMPATE_NUMERICO' for s in r['scenarios']))
    def test_invalid_inputs(self):
        for value in (True,0,.5,float('nan')):
            with self.assertRaises(ValueError): compare_references(self.a,self.b,self.basket,self.refs,span_fraction=value)
        self.a['records'].append(copy.deepcopy(self.a['records'][0]))
        with self.assertRaises(ValueError): self.run_case()
    def test_demo_remains_synthetic(self):
        result=demo(); self.assertEqual(result['real_scores_released'],0)
        self.assertFalse(result['methodology_approved'])

if __name__=='__main__': unittest.main()
