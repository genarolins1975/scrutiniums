import gzip,json,unittest
from pathlib import Path
from pipeline.justica.capturar import months,number,validate

class JusticaTest(unittest.TestCase):
    def test_durations(self):
        self.assertEqual(months('3a e 11m'),47)
        self.assertEqual(months('10m'),10)
        self.assertEqual(months('4a'),48)
        with self.assertRaises(ValueError): months('não informado')
    def test_missing_is_not_zero(self):
        self.assertIsNone(number('Não possuo condições de informar.'))
        self.assertIsNone(number(None))
        self.assertEqual(number(0),0)
    def test_published_seed(self):
        p=Path(__file__).resolve().parents[1]/'justica/seed/recorte.json.gz'
        d=json.loads(gzip.decompress(p.read_bytes()));validate(d)
        d['comarcas'].append(d['comarcas'][0])
        with self.assertRaises(AssertionError):validate(d)
