import copy
import unittest
from .hierarquia import demo, hierarchy, compare_profiles, normalize_profile, relation
from .fundacao import PILLARS

class HierarchyTests(unittest.TestCase):
    def setUp(self):
        d=demo();self.a=d['input_profiles']['a'];self.b=d['input_profiles']['b']
        self.basket=['education','health','work','food','assistance']
    def calc(self,p):
        return hierarchy(p['records'],self.basket,dict.fromkeys(self.basket,1),dict.fromkeys(PILLARS,1),**p['context'])
    def test_fifteen_components_to_five_chapters(self):
        r=self.calc(self.b)
        self.assertEqual(len(r['chapters']),5);self.assertAlmostEqual(r['aggregate']['value'],70)
        self.assertFalse(r['publishable'])
    def test_detects_reversal(self):
        r=compare_profiles(self.a,self.b,self.basket)
        self.assertEqual(r['summary']['scenarios'],16)
        self.assertEqual(r['baseline']['relation'],'B_MAIOR')
        self.assertGreater(r['summary']['order_reversals'],0)
    def test_missing_pillar_propagates_to_aggregate(self):
        a=copy.deepcopy(self.a);a['records'].pop()
        r=compare_profiles(a,self.b,self.basket)
        self.assertEqual(r['summary']['assessment'],'BLOQUEADO')
        self.assertEqual(r['summary']['comparable'],0)
        chapter=r['baseline']['a']['chapters'][-1]
        self.assertIsNone(chapter['value']);self.assertTrue(chapter['reasons'])
    def test_zero_propagates(self):
        a=copy.deepcopy(self.a);a['records'][0]['value']=0
        self.assertEqual(self.calc(a)['aggregate']['value'],0)
    def test_context_mismatch_and_duplicate(self):
        a=copy.deepcopy(self.a);a['records'][0]['territory']='OTHER'
        self.assertIsNone(self.calc(a)['aggregate']['value'])
        a=copy.deepcopy(self.a);a['context']['edition']='OTHER'
        with self.assertRaises(ValueError): compare_profiles(a,self.b,self.basket)
        a=copy.deepcopy(self.a);a['records'].append(a['records'][0])
        with self.assertRaises(ValueError): self.calc(a)
    def test_pending_reference_stays_blocked(self):
        a=copy.deepcopy(self.a)
        refs={r['id']:dict(lower=0,upper=100,direction='higher',validated=True) for r in a['records']}
        refs[a['records'][0]['id']]['validated']=False
        a['records']=normalize_profile(a['records'],refs)
        self.assertIsNone(self.calc(a)['aggregate']['value'])
    def test_different_references_cannot_be_compared(self):
        a=copy.deepcopy(self.a);a['records'][0]['reference_context']['upper']=110
        with self.assertRaises(ValueError): compare_profiles(a,self.b,self.basket)

    def test_tie_is_not_reversal(self):
        r=compare_profiles(self.b,self.b,self.basket)
        self.assertEqual(r['summary']['order_reversals'],0)
        self.assertTrue(all(s['relation']=='EMPATE_NUMERICO' for s in r['scenarios']))
        self.assertEqual(relation(None,70),'INCOMPARAVEL')
    def test_inputs_unchanged_and_order_invariant(self):
        before=copy.deepcopy(self.a);compare_profiles(self.a,self.b,self.basket)
        self.assertEqual(self.a,before)
        self.a['records'].reverse()
        self.assertEqual(self.calc(self.a),self.calc(before))

if __name__=='__main__': unittest.main()
