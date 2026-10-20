"""Contrato da dívida bruta do governo geral (Banco Central, SGS 13761 e 13762)."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('divida', Path(__file__).with_name('importar-divida.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Contrato(unittest.TestCase):
    def setUp(self):
        self.brutos = {c: mod._arquivo(c).read_bytes() for c in mod.SERIES}
        self.atual = json.loads(mod.DESTINO.read_text())

    def refazer(self, **mudado):
        return mod.transformar({**self.brutos, **mudado}, {c: self.atual['captura'] for c in mod.SERIES})

    def test_reproducao(self):
        self.assertEqual(self.refazer(), self.atual)

    def test_meses_diferentes_entre_series(self):
        dados = json.loads(self.brutos['13762'])[:-1]
        with self.assertRaisesRegex(ValueError, 'mesmos meses'):
            self.refazer(**{'13762': json.dumps(dados).encode()})

    def test_lacuna(self):
        for c in mod.SERIES:
            dados = json.loads(self.brutos[c])
            del dados[100]
            self.brutos[c] = json.dumps(dados).encode()
        with self.assertRaisesRegex(ValueError, 'Lacuna'):
            self.refazer()

    def test_valor_invalido_e_mes_repetido(self):
        dados = json.loads(self.brutos['13761'])
        dados[5]['valor'] = '0'
        with self.assertRaisesRegex(ValueError, 'inválido'):
            self.refazer(**{'13761': json.dumps(dados).encode()})
        dados = json.loads(self.brutos['13761'])
        dados.append(dados[-1])
        with self.assertRaisesRegex(ValueError, 'repetido'):
            self.refazer(**{'13761': json.dumps(dados).encode()})

    def test_unidades_plausiveis(self):
        for r in self.atual['registros']:
            self.assertTrue(30 < r['pctPIB'] < 150, r)
            self.assertTrue(r['milhoes'] > 1e6, r)


if __name__ == '__main__':
    unittest.main()
