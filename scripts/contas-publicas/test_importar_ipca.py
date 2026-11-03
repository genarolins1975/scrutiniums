import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('ipca', Path(__file__).with_name('importar-ipca.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
# Resposta da API v3 (edição de julho de 2026): contrato do formato v3, base das mutações abaixo.
ORIGEM = mod.ROOT/'data/contas-publicas/ipca-2026-10-12'
# Resposta do SIDRA (edição de setembro de 2026): a origem do snapshot publicado.
ORIGEM_SIDRA = mod.ROOT/'data/contas-publicas/ipca-2026-11-03'


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
        raw = (ORIGEM_SIDRA/'ipca.json').read_bytes()
        self.assertEqual(mod.transformar(raw, json.loads((ORIGEM_SIDRA/'manifesto.json').read_text())), esperado)

    def test_v3_continua_valida(self):
        self.assertEqual(mod.transformar(self.raw, self.manifesto)['basePrecos'], '2026-07')


class ContratoSidra(unittest.TestCase):
    def setUp(self):
        self.raw = (ORIGEM_SIDRA/'ipca.json').read_bytes()
        self.manifesto = json.loads((ORIGEM_SIDRA/'manifesto.json').read_text())

    def invalido(self, mutacao):
        dados = json.loads(self.raw)
        mutacao(dados)
        raw = json.dumps(dados).encode()
        with self.assertRaises(ValueError):
            mod.transformar(raw, {**self.manifesto, 'sha256': hashlib.sha256(raw).hexdigest()})

    def test_os_dois_formatos_concordam_nos_meses_comuns(self):
        v3 = mod.transformar((ORIGEM/'ipca.json').read_bytes(), json.loads((ORIGEM/'manifesto.json').read_text()))
        sidra = {r['periodo']: r['indice'] for r in mod.transformar(self.raw, self.manifesto)['registros']}
        for r in v3['registros']:
            self.assertEqual(sidra[r['periodo']], r['indice'])

    def test_hash(self):
        with self.assertRaises(ValueError):
            mod.transformar(self.raw+b' ', self.manifesto)

    def test_lacuna(self):
        self.invalido(lambda d: d.pop(5))

    def test_duplicado(self):
        self.invalido(lambda d: d.append(dict(d[5])))

    def test_unidade(self):
        self.invalido(lambda d: d[3].update(MN='%'))

    def test_variavel(self):
        self.invalido(lambda d: d[3].update(D2C='63'))

    def test_territorio(self):
        self.invalido(lambda d: d[3].update(D1C='2'))

    def test_cabecalho(self):
        self.invalido(lambda d: d.pop(0))

    def test_indice_invalido(self):
        for valor in ['...', '0', '-1', 'NaN']:
            self.invalido(lambda d: d[4].update(V=valor))
