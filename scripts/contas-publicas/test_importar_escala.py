"""Falhas materiais do contrato de denominadores (executar com unittest)."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('escala', Path(__file__).with_name('importar-escala.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
ORIGEM = mod.ROOT/'data/contas-publicas/escala-2026-10-12'


class Contrato(unittest.TestCase):
    def setUp(self):
        self.manifesto = json.loads((ORIGEM/'manifesto.json').read_text())
        self.pib = (ORIGEM/'pib.json').read_bytes()
        self.pop = (ORIGEM/'populacao.json').read_bytes()

    def test_hash_modificado(self):
        with self.assertRaises(AssertionError):
            mod.transformar(self.pib+b' ', self.pop, self.manifesto)

    def test_trimestre_ausente(self):
        dado = json.loads(self.pib)
        del dado[0]['resultados'][0]['series'][0]['serie']['202504']
        raw = json.dumps(dado).encode()
        manifesto = copy.deepcopy(self.manifesto)
        manifesto['pib']['sha256'] = hashlib.sha256(raw).hexdigest()
        with self.assertRaisesRegex(AssertionError, 'quatro trimestres'):
            mod.transformar(raw, self.pop, manifesto)

    def test_unidade_e_territorio(self):
        dado = json.loads(self.pop)
        dado[0]['unidade'] = 'Mil pessoas'
        with self.assertRaises(AssertionError):
            mod.serie(json.dumps(dado), '9324', 'Pessoas')
        dado[0]['unidade'] = 'Pessoas'
        dado[0]['resultados'][0]['series'][0]['localidade']['nivel']['id'] = 'N3'
        with self.assertRaisesRegex(AssertionError, 'Brasil'):
            mod.serie(json.dumps(dado), '9324', 'Pessoas')

    def test_reproducao(self):
        atual = json.loads((mod.ROOT/'src/lib/contas-publicas/snapshots/escala.json').read_text())
        self.assertEqual(mod.transformar(self.pib, self.pop, self.manifesto), atual)


if __name__ == '__main__':
    unittest.main()
