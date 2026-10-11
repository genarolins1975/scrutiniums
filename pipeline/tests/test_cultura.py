import unittest
from pipeline.cultura.run import build
class Cultura(unittest.TestCase):
 def test_publicacao_reconciliada_e_sem_ausencia_convertida(self):
  b=build()
  self.assertEqual(len(b['validacoes']),11)
  self.assertTrue(all(v['esferasReconciliadas'] and v['ufsReconciliadas'] for v in b['validacoes']))
  self.assertTrue(all(r['origem']['linha']>0 and r['origem']['coluna']>0 for r in b['tic']))
 def test_universos_nao_intercambiaveis(self):
  b=build()
  wifi=next(r for r in b['tic'] if r['aba']=='B10' and r['tipo']=='Biblioteca')
  natureza=next(r for r in b['tic'] if r['aba']=='A4' and r['tipo']=='Biblioteca' and r['categoria']=='Público municipal')
  self.assertAlmostEqual(wifi['valor'],64.8432)
  self.assertAlmostEqual(wifi['margem'],5.563)
  self.assertAlmostEqual(natureza['valor'],92.9582)
  self.assertFalse(any(r['ano']==2024 for r in b['gastos']))
if __name__=='__main__':unittest.main()
