import tempfile,unittest
from pathlib import Path
from pipeline.saneamento.capturar import construir,materializar,numero,ROOT
class SaneamentoTest(unittest.TestCase):
 def test_reproducao_byte_a_byte(self):
  with tempfile.TemporaryDirectory() as out:
   materializar(out)
   for p in Path(out).iterdir():self.assertEqual(p.read_bytes(),(ROOT/'public/eficiencia/saneamento'/p.name).read_bytes(),p.name)
 def test_contratos(self):
  d=construir();self.assertEqual(len(d['indicadores']),29);self.assertEqual(len(d['valores']),768)
  self.assertEqual(len({(r['indicador'],r['id']) for r in d['valores']}),768)
 def test_ausencia_nao_zero(self):
  self.assertIsNone(numero('Não calculado'));self.assertIsNone(numero(None));self.assertEqual(numero(0),0)
 def test_investimentos_publicados(self):
  d=construir();b={r['indicador']:r['valor'] for r in d['valores'] if r['id']=='BR'}
  self.assertAlmostEqual(b['AG_INVESTIMENTO'],14592643032.54,places=2)
  self.assertAlmostEqual(b['ES_INVESTIMENTO'],13681999367.15,places=2)
