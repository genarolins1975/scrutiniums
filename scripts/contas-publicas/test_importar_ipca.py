import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ipca', Path(__file__).with_name('importar-ipca.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ORIGEM = mod.ROOT/'data/contas-publicas/ipca-2026-10-12'


class Contrato(unittest.TestCase):
    def setUp(self):
        self.raw = (ORIGEM/'ipca.json').read_bytes()
        self.manifesto = json.loads((ORIGEM/'manifesto.json').read_text())

    def verificar_invalido(self, mutacao):
        dados = json.loads(self.raw)
        mutacao(dados)
        raw = json.dumps(dados).encode()
        manifesto = {**self.manifesto, 'sha256': hashlib.sha256(raw).hexdigest()}
        with self.assertRaises(ValueError):
            mod.transformar(raw, manifesto)

    def test_hash(self):
        with self.assertRaises(ValueError):
            mod.transformar(self.raw+b' ', self.manifesto)

    def test_lacuna(self):
        self.verificar_invalido(lambda d: d[0]['resultados'][0]['series'][0]['serie'].pop('202501'))

    def test_unidade(self):
        self.verificar_invalido(lambda d: d[0].update(unidade='%'))

    def test_territorio(self):
        self.verificar_invalido(lambda d: d[0]['resultados'][0]['series'][0]['localidade'].update(id='2'))

    def test_indice_ausente_ou_invalido(self):
        for valor in ['...', '0', '-1', 'NaN', 'Infinity']:
            self.verificar_invalido(lambda d: d[0]['resultados'][0]['series'][0]['serie'].update({'202501': valor}))

    def test_reproducao(self):
        esperado = json.loads((mod.ROOT/'src/lib/contas-publicas/snapshots/ipca.json').read_text())
        self.assertEqual(mod.transformar(self.raw, self.manifesto), esperado)
