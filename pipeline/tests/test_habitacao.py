import gzip,json,tempfile,unittest
from pathlib import Path
from pipeline.habitacao.capturar import SEED,OUT,validate,publish
class HabitacaoTests(unittest.TestCase):
 def setUp(self):self.d=json.loads(gzip.decompress((SEED/'recorte.json.gz').read_bytes()))
 def test_integridade(self):validate(self.d)
 def test_reproducao(self):
  with tempfile.TemporaryDirectory() as folder:
   out=Path(folder);publish(self.d,out)
   for file in out.iterdir():self.assertEqual(file.read_bytes(),(OUT/file.name).read_bytes(),file.name)
 def test_divergencias_documentadas(self):
  rows={r['id']:r for r in self.d['territorios']}
  self.assertGreater(rows['PI']['rendaTotal'],rows['PI']['deficit']);self.assertLess(rows['CE']['rendaTotal'],rows['CE']['deficit'])
  self.assertEqual(rows['BR']['fundiaria'],3250536);self.assertEqual(round(rows['BR']['fundiariaExclusiva']),2153611)
 def test_niveis_nao_somados(self):
  br=next(r for r in self.d['territorios'] if r['id']=='BR')
  self.assertAlmostEqual(sum(r['deficit'] for r in self.d['territorios'] if r['tipo']=='UF'),br['deficit'],places=4)
