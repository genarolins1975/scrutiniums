"""Edição nova mantém a fórmula e exige uma sequência mensal completa e verificável."""
import copy
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('importar_ipca', ROOT/'scripts/contas-publicas/importar-ipca.py')
IPCA = importlib.util.module_from_spec(spec); spec.loader.exec_module(IPCA)


class EdicaoIPCA(unittest.TestCase):
    def setUp(self):
        pasta = ROOT/'data/contas-publicas/ipca-2026-10-12'
        self.raw = (pasta/'ipca.json').read_bytes()
        self.man = json.loads((pasta/'manifesto.json').read_text())

    def test_edicao_publicada_reproduz_exatamente(self):
        publicado = json.loads((ROOT/'src/lib/contas-publicas/snapshots/ipca.json').read_text())
        self.assertEqual(IPCA.transformar(self.raw, self.man), publicado)

    def test_edicao_sintetica_posterior_preserva_historico_e_formula(self):
        dados = json.loads(self.raw)
        serie = dados[0]['resultados'][0]['series'][0]['serie']
        serie['202608'] = serie['202607']  # caso sintético explícito, não captura oficial
        novo = json.dumps(dados).encode()
        man = {**self.man, 'basePrecos': '2026-08', 'sha256': hashlib.sha256(novo).hexdigest()}
        antes = IPCA.transformar(self.raw, self.man)
        depois = IPCA.transformar(novo, man)
        self.assertEqual(depois['registros'][:-1], antes['registros'])
        self.assertEqual(depois['metodo'], antes['metodo'])
        self.assertEqual(depois['basePrecos'], '2026-08')

    def test_mes_ausente_hash_errado_ou_valor_invalido_reprovam(self):
        with self.assertRaises(ValueError):
            IPCA.transformar(self.raw, {**self.man, 'sha256': 'incorreto'})
        for valor in [None, 'NaN', '0', '-1']:
            dados = json.loads(self.raw)
            serie = dados[0]['resultados'][0]['series'][0]['serie']
            if valor is None: del serie['202607']
            else: serie['202607'] = valor
            raw = json.dumps(dados).encode()
            with self.subTest(valor=valor), self.assertRaises(ValueError):
                IPCA.transformar(raw, {**self.man, 'sha256': hashlib.sha256(raw).hexdigest()})


if __name__ == '__main__':
    unittest.main()
