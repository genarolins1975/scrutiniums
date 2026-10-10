import copy,tempfile,unittest
from pathlib import Path
from pipeline.eficiencia_alimentar.run import le,valida,promove
class AlimentarTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.data,cls.manifest,cls.catalog=le()
    def test_recorte_e_estados(self):
        self.assertEqual(len(valida(self.data,self.catalog)),5570)
        self.assertTrue(any(r['raw']=='-' and r['status']!='OBSERVADO' for m in self.data['metrics'] for r in m['rows']))
    def test_gate_impede_publicacao_sem_ficha(self):
        cat=copy.deepcopy(self.catalog);del cat['indicadores'][0]['fonte']
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/'public'
            with self.assertRaises(ValueError):promove(self.data,self.manifest,cat,dest)
            self.assertFalse(dest.exists())
    def test_duplicidade_bloqueia(self):
        data=copy.deepcopy(self.data);data['needs'][0]=data['needs'][1]
        with self.assertRaises(ValueError):valida(data,self.catalog)
