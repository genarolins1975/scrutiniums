import copy
import json
import unittest
from .cobertura import ROOT, build
from .auditoria_fonte import SNAPSHOT, compare

class PrimarySourceTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads((ROOT/SNAPSHOT).read_text())
        self.report = build()

    def test_real_urban_reconciliation_and_total_difference(self):
        counts = compare(self.snapshot, self.report)['counts']
        self.assertEqual(counts['Urbana'], {'VALOR_COINCIDE':96, 'AMBOS_AUSENTES':8})
        self.assertEqual(counts['Total'], {'VALOR_COINCIDE':49, 'AMBOS_AUSENTES':6,
            'VALOR_DIFERENTE':47, 'DISPONIBILIDADE_DIFERENTE':2})
        self.assertTrue(all(r['school_location']=='Urbana' for r in self.report['observations']))

    def test_incomplete_duplicate_or_wrong_network_rejected(self):
        variants=[]
        for kind in ('missing','duplicate','network'):
            s=copy.deepcopy(self.snapshot)
            if kind=='missing': s['rows'].pop()
            if kind=='duplicate': s['rows'].append(s['rows'][0])
            if kind=='network': s['rows'][0]['DEPENDENCIA_ADM']='Estadual'
            variants.append(s)
        for s in variants:
            with self.assertRaises(ValueError): compare(s,self.report)

    def test_primary_value_change_detected(self):
        s=copy.deepcopy(self.snapshot)
        row=next(r for r in s['rows'] if r['LOCALIZACAO']=='Urbana')
        row['MEDIA_5_LP']+=1
        self.assertEqual(compare(s,self.report)['counts']['Urbana']['VALOR_DIFERENTE'],1)

if __name__=='__main__': unittest.main()
