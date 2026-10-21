"""Contrato do importador por função e subfunção (importar-funcoes.py): sem rede, sobre as respostas guardadas."""
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('funcoes', Path(__file__).with_name('importar-funcoes.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
SNAPSHOT = json.loads(mod.DESTINO.read_text())


def brutos(ano):
    fa, ta = mod._arquivos(ano)
    return gzip.decompress(fa.read_bytes()), gzip.decompress(ta.read_bytes())


class Reproducao(unittest.TestCase):
    def test_snapshot_refeito_das_respostas_guardadas(self):
        self.assertEqual(mod.de_fontes(SNAPSHOT), SNAPSHOT)

    def test_hashes_das_respostas(self):
        for e in SNAPSHOT['exercicios']:
            bf, bt = brutos(e['ano'])
            self.assertEqual(hashlib.sha256(bf).hexdigest(), e['sha256']['funcoes'], e['ano'])
            self.assertEqual(hashlib.sha256(bt).hexdigest(), e['sha256']['totais'], e['ano'])

    def test_serie_continua_desde_o_primeiro_grafo(self):
        anos = [e['ano'] for e in SNAPSHOT['exercicios']]
        self.assertEqual(anos[0], 2000)
        self.assertEqual(anos, list(range(2000, anos[-1] + 1)))

    def test_mesmo_total_da_consulta_por_esfera_do_painel_de_execucao(self):
        # 2025 está encerrado: a captura por função e a de importar.py (dados.json) leem a mesma base
        dados = json.loads((mod.ROOT / 'src/lib/contas-publicas/snapshots/dados.json').read_text())
        execucao = next(o for o in dados['orcamento'] if o['ano'] == 2025)
        funcoes = next(e for e in SNAPSHOT['exercicios'] if e['ano'] == 2025)
        if funcoes['atualizacao'] == execucao['esferas'][0]['atualizacao']:
            for c in mod.CAMPOS:
                self.assertAlmostEqual(funcoes['total'][c], execucao['total'][c], places=2)

    def test_estagio_incompleto_na_fonte_fica_null_nunca_zero(self):
        e2014 = next(e for e in SNAPSHOT['exercicios'] if e['ano'] == 2014)
        self.assertIsNone(e2014['total']['atualizada'])
        self.assertEqual(e2014['itensSemValor'], {'atualizada': 77})
        i = SNAPSHOT['colunas'].index('atualizada')
        self.assertTrue(all(r[i] is None for r in SNAPSHOT['registros'] if r[0] == 2014))
        self.assertTrue(all(r[i] is not None for r in SNAPSHOT['registros'] if r[0] != 2014))


class Rejeicao(unittest.TestCase):
    ANO = 2025

    def setUp(self):
        self.bf, self.bt = brutos(self.ANO)
        self.f = json.loads(self.bf)
        self.t = json.loads(self.bt)

    def falha(self, f=None, t=None):
        with self.assertRaises(ValueError):
            mod.transformar(self.ANO, json.dumps(f or self.f).encode(), json.dumps(t or self.t).encode())

    def linha(self, d=None):
        return (d or self.f)['results']['bindings']

    def test_valido(self):
        r = mod.transformar(self.ANO, self.bf, self.bt)
        self.assertTrue(all(v is not None for v in r['total'].values()))

    def test_funcao_fora_da_classificacao(self):
        f = copy.deepcopy(self.f)
        self.linha(f)[0]['funcao']['value'] = '29'
        self.falha(f=f)

    def test_subfuncao_mal_formada(self):
        f = copy.deepcopy(self.f)
        self.linha(f)[0]['subfuncao']['value'] = '84'
        self.falha(f=f)

    def test_linha_sem_resultado_primario(self):
        f = copy.deepcopy(self.f)
        del self.linha(f)[0]['rp']
        self.falha(f=f)

    def test_valor_nao_finito(self):
        for v in ['NaN', 'Infinity']:
            f = copy.deepcopy(self.f)
            self.linha(f)[0]['pago']['value'] = v
            self.falha(f=f)

    def test_soma_diverge_do_total(self):
        f = copy.deepcopy(self.f)
        l = self.linha(f)[0]
        l['pago']['value'] = str(float(l['pago']['value']) + 1000)
        self.falha(f=f)

    def test_esfera_ausente(self):
        t = copy.deepcopy(self.t)
        t['results']['bindings'] = t['results']['bindings'][:1]
        self.falha(t=t)

    def test_linha_duplicada(self):
        f = copy.deepcopy(self.f)
        self.linha(f).append(copy.deepcopy(self.linha(f)[0]))
        self.falha(f=f)

    def test_estagio_completo_no_total_mas_sem_valor_por_funcao(self):
        f = copy.deepcopy(self.f)
        l = self.linha(f)[0]
        l['coberturaPago']['value'] = str(int(l['itens']['value']) - 1)
        self.falha(f=f)

    def test_estagio_incompleto_vira_null(self):
        t = copy.deepcopy(self.t)
        e = t['results']['bindings'][0]
        e['coberturaLiquidado']['value'] = str(int(e['itens']['value']) - 1)
        r = mod.transformar(self.ANO, self.bf, json.dumps(t).encode())
        self.assertIsNone(r['total']['liquidado'])
        self.assertTrue(all(x[4 + mod.CAMPOS.index('liquidado')] is None for x in r['linhas']))
        self.assertIsNotNone(r['total']['pago'])


if __name__ == '__main__':
    unittest.main()
