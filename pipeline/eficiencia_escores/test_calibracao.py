import copy
import unittest
from .calibracao import weighted_score, weight_sensitivity, reference_sensitivity, demo
from .fundacao import aggregate

class CalibrationTests(unittest.TestCase):
    context=dict(territory='SYNTHETIC',edition='TEST',comparison_window='TEST')
    ids=['access','response','quality']
    def rows(self, values=(80,60,75)):
        return [dict(id=k,value=v,validated=True,state='CALCULAVEL_EXPERIMENTAL',**self.context)
                for k,v in zip(self.ids,values)]
    def test_equal_weights_match_foundation(self):
        rows=self.rows()
        a=aggregate(rows,self.ids,**self.context)
        b=weighted_score(rows,self.ids,dict.fromkeys(self.ids,1),**self.context)
        self.assertAlmostEqual(a['value'],b['value'])
    def test_balance_invariant_under_weights(self):
        r=weight_sensitivity(self.rows((70,70,70)),self.ids,**self.context)
        for s in r['scenarios']: self.assertAlmostEqual(s['value'],70)
    def test_missing_and_invalid_never_reweighted(self):
        variants=[self.rows((80,None,75)),self.rows()[:2],self.rows((80,float('nan'),75))]
        unvalidated=self.rows();unvalidated[0]['validated']=False;variants.append(unvalidated)
        wrong=self.rows();wrong[0]['territory']='OTHER';variants.append(wrong)
        for rows in variants:
            r=weight_sensitivity(rows,self.ids,**self.context)
            self.assertIsNone(r['scenario_range'])
            self.assertTrue(all(s['value'] is None for s in r['scenarios']))
    def test_zero_remains_zero(self):
        r=weight_sensitivity(self.rows((80,0,75)),self.ids,**self.context)
        self.assertTrue(all(s['value']==0 for s in r['scenarios']))
    def test_weak_pillar_more_weight_lowers_score(self):
        r=weight_sensitivity(self.rows((95,95,20)),self.ids,**self.context)
        selected=next(s for s in r['scenarios'] if s['component']=='quality' and s['relative_change']>0)
        self.assertLess(selected['delta_points'],0)
        self.assertEqual(set(selected['weights']),set(self.ids))
        self.assertAlmostEqual(sum(selected['weights'].values()),1)
    def test_invalid_weights_and_steps(self):
        for w in (0,-1,True,float('inf')):
            with self.assertRaises(ValueError):
                weighted_score(self.rows(),self.ids,dict(access=w,response=1,quality=1),**self.context)
        for step in (0,1,float('nan')):
            with self.assertRaises(ValueError): weight_sensitivity(self.rows(),self.ids,relative_change=step,**self.context)
    def test_reference_changes_are_isolated_and_directional(self):
        ref=dict(validated=True,lower=0,upper=100,direction='higher');before=copy.deepcopy(ref)
        result=reference_sensitivity(70,ref)
        self.assertEqual(ref,before)
        self.assertLess(next(s['value'] for s in result['scenarios'] if s['bound']=='upper' and s['shift']>0),70)
        self.assertEqual(reference_sensitivity(70,{**ref,'validated':False})['scenarios'],[])
        self.assertEqual(reference_sensitivity(None,ref)['state'],'BLOQUEADO')
    def test_synthetic_separated_from_real(self):
        r=demo()
        self.assertEqual(r['real_scores_released'],0)
        self.assertEqual(r['real_card_readiness'],dict(cards=15,validated_references=0))
        self.assertFalse(r['methodology_approved'])

if __name__=='__main__': unittest.main()
