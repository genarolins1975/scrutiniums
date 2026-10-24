"""Falhas de fonte não podem substituir o silver íntegro; sem rede ou credenciais."""
import hashlib
import json
import sqlite3
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from pipeline import common
from pipeline.sources import bcb_sgs, desenrola, djen, djen_credores

HEADER = ('DATA_BASE;TIPO_DESENROLA;UNIDADE_FEDERACAO;COD_CONGLOMERADO_FINANCEIRO;'
          'NOME_CONGLOMERADO_FINANCEIRO;NUMERO_OPERACOES;VOLUME_OPERACOES\n')
VALID = HEADER + '202608;1;SP;123;Banco;2;1.200,50\n'


class DesenrolaIntegro(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(':memory:')
        self.addCleanup(self.con.close)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.bronze = patch.object(common, 'BRONZE', self.tmp.name)
        self.bronze.start(); self.addCleanup(self.bronze.stop)
        self.lineage = patch.object(common, 'record_lineage')
        self.lineage.start(); self.addCleanup(self.lineage.stop)
        self.assertTrue(self.collect(VALID)[0]['ok'])

    def collect(self, text):
        with patch.object(common, 'http_get', return_value=(text.encode(), {'status': 200})):
            return desenrola.collect(self.con)

    def snapshot(self):
        return self.con.execute('SELECT * FROM desenrola_op').fetchall()

    def test_arquivo_invalido_preserva_todas_as_linhas_anteriores(self):
        anterior = self.snapshot()
        casos = ['', HEADER, '<html>bloqueio</html>', 'coluna_nova\n1\n',
                 VALID + '202609;1;RJ;456;Outro;inválido;5\n',
                 VALID.replace('1.200,50', ''), VALID.replace('1.200,50', 'NaN'),
                 VALID.replace(';2;', ';-1;'), VALID.replace('202608', '202613'),
                 VALID + '202608;1;SP;123;Banco;3;1.200,50\n']
        for texto in casos:
            with self.subTest(texto=texto):
                try:
                    resultado = self.collect(texto)
                except Exception:
                    resultado = [{'ok': False}]
                self.con.commit()  # o orquestrador faz commit inclusive após falha de um coletor
                self.assertFalse(resultado[0]['ok'])
                self.assertEqual(self.snapshot(), anterior)

    def test_zero_explicito_e_idempotencia(self):
        texto = VALID.replace(';2;', ';0;').replace('1.200,50', '0,00')
        self.assertTrue(self.collect(texto)[0]['ok'])
        antes = self.snapshot()
        self.assertEqual(antes[0][5:7], (0, 0.0))
        self.assertTrue(self.collect(texto)[0]['ok'])
        self.assertEqual(self.snapshot(), antes)

    def test_retificacao_preserva_valor_anterior_e_retorno_a_hash_antigo(self):
        self.assertTrue(self.collect(VALID.replace('1.200,50', '1.201,00'))[0]['ok'])
        old_sha = hashlib.sha256(VALID.encode()).hexdigest()
        old = self.con.execute('SELECT volume FROM desenrola_historico WHERE bronze_sha=?', (old_sha,)).fetchone()
        self.assertEqual(old, (1200.5,))
        self.assertTrue(self.collect(VALID)[0]['ok'])
        self.assertEqual(self.snapshot()[0][6], 1200.5)


class SGSIntegro(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.db = patch.object(common, 'DB_PATH', str(Path(self.tmp.name)/'silver.db'))
        self.db.start(); self.addCleanup(self.db.stop)
        self.bronze = patch.object(common, 'BRONZE', self.tmp.name)
        self.bronze.start(); self.addCleanup(self.bronze.stop)
        self.con = common.get_db(); self.addCleanup(self.con.close)
        self.cfg = {'sgs_start_date': '01/01/2026', 'sgs_series': [{'code': 1, 'key': 'teste',
                    'name': 'Série de teste', 'unit': '%', 'freq': 'mensal', 'methodology': 'teste', 'url': 'https://api.bcb.gov.br/'}]}
        common.insert_obs(self.con, 'teste', [('2026-01-01', 2)], 'anterior'); self.con.commit()

    def collect(self, body):
        with patch.object(common, 'http_get', return_value=(body, {})):
            return bcb_sgs.collect(self.con, self.cfg)

    def test_resposta_invalida_nao_atualiza_nem_marca_coleta_bem_sucedida(self):
        for body in [b'', b'<html>bloqueado</html>', b'[]', b'{}',
                     b'[{"data":"01/01/2026","valor":"NaN"}]',
                     b'[{"data":"31/02/2026","valor":"1"}]',
                     b'[{"data":"01/01/2026","valor":"3"},{"data":"02/01/2026","valor":""}]']:
            with self.subTest(body=body):
                self.assertFalse(self.collect(body)[0]['ok'])
                self.con.commit()
                self.assertEqual(common.get_series(self.con, 'teste'), [('2026-01-01', 2)])
                self.assertIsNone(common.get_meta(self.con, 'teste'))

    def test_retificacao_registrada_sem_duplicar_na_repeticao(self):
        body = b'[{"data":"01/01/2026","valor":"3"}]'
        self.assertTrue(self.collect(body)[0]['ok'])
        self.assertTrue(self.collect(body)[0]['ok'])
        self.assertEqual(self.con.execute('SELECT old_value,new_value FROM revisions').fetchall(), [(2, 3)])

    def test_403_nao_muda_a_janela_nem_repete_com_data_fixa(self):
        with patch.object(common, 'http_get', side_effect=RuntimeError('HTTP 403')) as http:
            self.assertFalse(bcb_sgs.collect(self.con, self.cfg)[0]['ok'])
            self.assertEqual(http.call_count, 1)

    def test_janela_diaria_preserva_inicio_historico_e_so_grava_apos_todas(self):
        self.cfg['sgs_start_date'] = '01/01/2012'
        self.cfg['sgs_series'][0]['freq'] = 'diária'
        with patch.object(common, 'http_get', side_effect=[(b'[{"data":"01/01/2012","valor":"4"}]', {}),
                                                        TimeoutError('sem resposta')]) as http:
            self.assertFalse(bcb_sgs.collect(self.con, self.cfg)[0]['ok'])
            self.assertGreaterEqual(http.call_count, 2)
            self.assertIn('01/01/2012', http.call_args_list[0].args[0])
            self.assertEqual(common.get_series(self.con, 'teste'), [('2026-01-01', 2)])


class Transporte(unittest.TestCase):
    def test_bloqueio_nao_e_retentado(self):
        erro = urllib.error.HTTPError('https://fonte.gov.br', 403, 'Forbidden', {}, None)
        with patch('urllib.request.urlopen', side_effect=erro) as abrir, patch('time.sleep') as pausa:
            with self.assertRaises(common.CollectionError) as ctx:
                common.http_get('https://fonte.gov.br')
            self.assertEqual(abrir.call_count, 1)
            pausa.assert_not_called()
            self.assertEqual((ctx.exception.status, ctx.exception.kind), (403, 'acesso_negado'))

    def test_timeout_e_503_tem_limite_e_backoff_sem_espera_final(self):
        for erro in [TimeoutError('timeout'), urllib.error.HTTPError('https://fonte.gov.br', 503, 'Unavailable', {}, None)]:
            with self.subTest(erro=erro), patch('urllib.request.urlopen', side_effect=erro) as abrir, patch('time.sleep') as pausa:
                with self.assertRaises(common.CollectionError) as ctx:
                    common.http_get('https://fonte.gov.br', retries=3, backoff=2)
                self.assertEqual(abrir.call_count, 3)
                self.assertEqual([c.args[0] for c in pausa.call_args_list], [2, 4])
                self.assertEqual(ctx.exception.attempts, 3)


class DJENIntegro(unittest.TestCase):
    def test_falha_nao_apaga_tribunal_e_outro_tribunal_pode_atualizar(self):
        cfg = {'djen': {'base_url': 'https://fonte.jus.br', 'tribunais': ['TJSP', 'TJRJ'],
                        'janela_dias': 30, 'max_paginas_por_tribunal': 2, 'itens_por_pagina': 100, 'pausa_s': 0}}
        for mod, tabela, colunas in [(djen, 'rj_fichas', 12), (djen_credores, 'rj_credores', 10)]:
            with self.subTest(modulo=mod.__name__):
                con = sqlite3.connect(':memory:')
                self.addCleanup(con.close)
                with patch.object(common, 'http_get', side_effect=RuntimeError('HTTP 403')), \
                     patch.object(djen_credores, 'enrich_cnpjs', return_value=[]):
                    mod.collect(con, cfg)
                for tribunal in cfg['djen']['tribunais']:
                    linha = [tribunal+'-processo', tribunal] + [None]*(colunas-2)
                    con.execute(f'INSERT INTO {tabela} VALUES({",".join("?" for _ in linha)})', linha)
                con.commit()
                with patch.object(common, 'http_get', side_effect=[RuntimeError('HTTP 403'), (b'{"items":[]}', {})]), \
                     patch.object(common, 'save_bronze', return_value=('bronze', 'hash')), \
                     patch.object(common, 'record_lineage'), patch.object(djen_credores, 'enrich_cnpjs', return_value=[]):
                    resultado = mod.collect(con, cfg)
                con.commit()
                self.assertFalse(resultado[0]['ok'])
                self.assertTrue(resultado[1]['ok'])  # lista vazia explícita é resposta válida deste tribunal
                self.assertEqual(con.execute(f'SELECT tribunal FROM {tabela}').fetchall(), [('TJSP',)])

    def test_esquema_sem_items_nao_significa_ausencia_de_processos(self):
        cfg = {'djen': {'base_url': 'https://fonte.jus.br', 'tribunais': ['TJSP'],
                        'janela_dias': 30, 'max_paginas_por_tribunal': 2, 'itens_por_pagina': 100, 'pausa_s': 0}}
        for mod in (djen, djen_credores):
            with self.subTest(modulo=mod.__name__), patch.object(common, 'http_get', return_value=(b'{}', {})), \
                 patch.object(common, 'save_bronze', return_value=('bronze', 'hash')), \
                 patch.object(common, 'record_lineage'), patch.object(djen_credores, 'enrich_cnpjs', return_value=[]):
                con = sqlite3.connect(':memory:'); self.addCleanup(con.close)
                self.assertFalse(mod.collect(con, cfg)[0]['ok'])


if __name__ == '__main__':
    unittest.main()
