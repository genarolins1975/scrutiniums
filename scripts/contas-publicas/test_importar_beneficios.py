"""Contrato dos gastos tributários (Receita Federal, DGT Bases Efetivas 2023)."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('beneficios', Path(__file__).with_name('importar-beneficios.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Contrato(unittest.TestCase):
    def setUp(self):
        self.quadros = json.loads((mod.ORIGEM / 'quadros.json').read_text())
        self.manifesto = json.loads((mod.ORIGEM / 'manifesto.json').read_text())

    def test_reproducao(self):
        atual = json.loads(mod.DESTINO.read_text())
        self.assertEqual(mod.transformar(self.quadros, self.manifesto), atual)

    def test_edicao_nova_recusada(self):
        with self.assertRaisesRegex(ValueError, 'edição'):
            mod.transformar(self.quadros, {**self.manifesto, 'sha256': '0' * 64})

    def test_soma_que_nao_fecha(self):
        q = copy.deepcopy(self.quadros)
        linha = next(l for l in q['Q VI'] if str(l[0]).startswith('Imposto sobre Importação'))
        linha[1] += 1000
        with self.assertRaisesRegex(ValueError, 'não somam'):
            mod.transformar(q, self.manifesto)

    def test_projecao_separada_do_efetivo(self):
        s = mod.transformar(self.quadros, self.manifesto)['serie']
        self.assertEqual([x['natureza'] for x in s], ['efetivo'] * 3 + ['projecao'] * 3)
        self.assertEqual(s[2]['ano'], mod.ANO_BASE)

    def test_cabecalho_alterado(self):
        q = copy.deepcopy(self.quadros)
        i = next(k for k, l in enumerate(q['Q XXVI']) if l[0] == 'TRIBUTO / GASTO TRIBUTÁRIO')
        q['Q XXVI'][i][4] = 'EFETIVO'
        with self.assertRaisesRegex(ValueError, 'cabeçalho'):
            mod.transformar(q, self.manifesto)


if __name__ == '__main__':
    unittest.main()
