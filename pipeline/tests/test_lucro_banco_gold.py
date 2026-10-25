"""Contrato empírico do snapshot oficial e da publicação: sem rede."""
from copy import deepcopy
from decimal import Decimal
import json
import unittest
from pipeline.lucro_banco_gold import construir, serializar, combinar, DESTINO, montar_periodo
from pipeline.sources.ifdata_dre import ler_seed


class GoldLucroBanco(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.gold = construir()

    def test_seed_e_gold_reproduziveis(self):
        self.assertEqual(json.loads(serializar(self.gold)), json.loads(DESTINO.read_text()))

    def test_seis_conferencias_oficiais_e_sinais(self):
        provas = self.gold['validacao_empirica']
        self.assertEqual(len(provas), 6)
        self.assertEqual(len({p['id'] for p in provas}), 3)
        for p in provas:
            self.assertTrue(p['reconciliacao']['reconciliado'], p)
            self.assertLessEqual(abs(p['reconciliacao']['diferenca']), 1)
            self.assertEqual(p['relatorio'], 116)
        # Âncoras de unidade e relatório (o HTML oficial exibe R$ mil).
        seed = ler_seed()
        if '202606' in seed['periodos']:
            rs = montar_periodo('202606', seed['periodos']['202606'])
            itau = next(r for r in rs if r['id'] == 'C0080099')
            self.assertAlmostEqual(float(itau['lucro']), 24670305939.7, places=2)
            self.assertLess(itau['rubricas']['g']['valor'], 0)
            self.assertLess(itau['rubricas']['f3']['valor'], 0)

    def test_conglomerados_sem_membros_duplicados(self):
        bancos = self.gold['instituicoes']
        self.assertGreater(len(bancos), 100)
        self.assertEqual(len(bancos), len({b['id'] for b in bancos}))
        self.assertTrue(all(b['id'].startswith('C') for b in bancos))
        self.assertTrue(any(b['lucro'] is None for b in bancos))

    def test_agregados_somam_so_dres_conciliadas(self):
        for meses, chave in [(12, 'sistema'), (6, 'sistema_semestral')]:
            linhas = [b['doze_meses'] if meses == 12 else b for b in self.gold['instituicoes']]
            linhas = [b for b in linhas if b and b['reconciliacao']['reconciliado']]
            s = self.gold[chave]
            self.assertEqual(s['n'], len(linhas))
            self.assertEqual(s['lucro'], sum(b['lucro'] for b in linhas))
            self.assertEqual(s['meses'], meses)
            self.assertTrue(s['reconciliacao']['reconciliado'])

    def test_ttm_conserva_fluxo_e_estoque_nao_e_somado(self):
        for b in self.gold['instituicoes']:
            t = b['doze_meses']
            if not t:
                continue
            self.assertEqual(t['meses'], 12)
            self.assertEqual(t['rateio']['total_provisao'], b['rateio']['total_provisao'])
            for campo, total in [('provisao', 'total_provisao'), ('despesa', 'total_despesa')]:
                for metodo in ['saldo', 'vencido15']:
                    vals = [l[campo][metodo] for l in t['rateio']['linhas'] if l[campo] and l[campo][metodo] is not None]
                    if vals:
                        self.assertLessEqual(abs(sum(vals) - t['rateio'][total]), Decimal('0.01'))

    def test_bloqueia_combinacao_de_perimetros_e_planos(self):
        b = deepcopy(self.gold['instituicoes'][0])
        a = deepcopy(b)
        a['data_base'] = '202412'
        self.assertIsNone(combinar(b, a))
        a['data_base'] = b['data_base']; a['id'] = 'outro'
        self.assertIsNone(combinar(b, a))
        a['id'] = b['id']; a['plano'] = 'outro'
        self.assertIsNone(combinar(b, a))

    def test_fontes_e_incerteza_explicitas(self):
        self.assertFalse(self.gold['clientes']['disponivel_para_tarifa'])
        self.assertIn('não intervalo de confiança', self.gold['metodo']['rateio'])
        for f in self.gold['fontes']:
            self.assertTrue(f['url'].startswith('https://www3.bcb.gov.br/ifdata/rest/'))
            self.assertEqual(len(f['sha256']), 64)
        for b in self.gold['instituicoes']:
            for r in b['rubricas'].values():
                self.assertGreater(r['lid'], 0)
                self.assertTrue(r['en'])


if __name__ == '__main__':
    unittest.main()
