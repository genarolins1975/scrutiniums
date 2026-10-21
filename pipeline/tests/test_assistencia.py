import copy,unittest
from pipeline.assistencia.padroniza import le
from pipeline.assistencia.validacoes import valida
from pipeline.assistencia.capturar import observation
class Assistencia(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data,cls.manifest=le()
 def test_chaves_cobertura_e_fichas(self):
  r=valida(self.data,self.manifest)
  self.assertEqual(r,dict(units=14050,rma=103847,catalog=29,regional_creas=36,state_day=5))
 def test_ausencias_salto_e_zero_legitimo(self):
  self.assertEqual(observation(' ','contagem')['status'],'NAO_INFORMADO')
  self.assertEqual(observation('0','dias')['value'],0)
  self.assertEqual(observation(' ','contagem',True)['status'],'NAO_APLICAVEL')
  self.assertEqual(observation('Não sabe','contagem')['value'],None)
 def test_gate_rejeita_valor_em_ausencia(self):
  d=copy.deepcopy(self.data);d['units'][0]['values']['q2_1']['status']='NAO_INFORMADO'
  with self.assertRaises(ValueError):valida(d,self.manifest)
 def test_originais_rma_preservados_e_tratamento_explicito(self):
  changed=[r for r in self.data['monthly'] if any(r[i]!=r[i+1] for i in (4,6,8,10))]
  self.assertGreater(len(changed),0)
  self.assertTrue(any(r[4] is None and r[5] is not None for r in changed))
 def test_subgrupos_nao_superam_total_domiciliar(self):
  for u in self.data['units']:
   if u['kind']!='CRAS':continue
   v=u['values'];total=v['q36_1']['value']
   if total is None:continue
   for k in ['q36_2','q36_3']:
    if v[k]['value'] is not None:self.assertLessEqual(v[k]['value'],total)
