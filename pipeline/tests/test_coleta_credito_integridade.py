"""Falhas de fonte não podem substituir o silver íntegro; sem rede ou credenciais."""
import gzip
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



class DesenrolaContrato(unittest.TestCase):
    """24/10/2026: o código anterior ao contrato gravou o CSV de 08/2026 descartando o
    tipo 4 sem aviso; o arquivo inalterado não pode repetir esse silver no build."""
    COM_TIPO_4 = VALID + '202608;4;SP;123;Banco;377130;759.760.000,00\n'

    def setUp(self):
        self.con = sqlite3.connect(':memory:')
        self.addCleanup(self.con.close)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for alvo, valor in [('BRONZE', self.tmp.name), ('GOLD', self.tmp.name)]:
            p = patch.object(common, alvo, valor); p.start(); self.addCleanup(p.stop)
        p = patch.object(common, 'record_lineage'); p.start(); self.addCleanup(p.stop)

    def collect(self, text):
        with patch.object(common, 'http_get', return_value=(text.encode(), {'status': 200})):
            return desenrola.collect(self.con)

    def build(self):
        from pipeline import desenrola as builder
        resultado = builder.build(self.con)
        return resultado, json.loads((Path(self.tmp.name) / 'desenrola.json').read_text())

    def veredito(self, texto):
        sha = hashlib.sha256(texto.encode()).hexdigest()
        return self.con.execute('SELECT aceito, motivo FROM desenrola_contrato WHERE bronze_sha=?', (sha,)).fetchone()

    # 25/10/2026: pacote C autorizado para implementar a recomendação D2;
    # merge ainda depende do dono. Tipo desconhecido não é mais falha global;
    # a garantia anterior de não descartar em silêncio passa a exigir ressalva.
    def test_tipo_nao_documentado_separado_com_bronze_e_ressalva(self):
        self.assertTrue(self.collect(VALID)[0]['ok'])
        resultado = self.collect(self.COM_TIPO_4)[0]
        self.assertTrue(resultado['ok'])
        self.assertEqual(resultado['fora_do_recorte']['linhas'], 1)
        self.assertEqual(resultado['fora_do_recorte']['tipos'], ['4'])
        self.assertEqual(self.veredito(self.COM_TIPO_4)[0], 1)
        self.assertEqual(self.veredito(VALID)[0], 1)
        saida, gold = self.build()
        self.assertTrue(saida['ok'])
        self.assertEqual(gold['totais_scr']['operacoes'], 2)
        self.assertEqual(gold['fora_do_recorte'], resultado['fora_do_recorte'])
        repetida = self.collect(self.COM_TIPO_4)[0]
        self.assertIn('note', repetida)
        self.assertEqual(repetida['fora_do_recorte'], gold['fora_do_recorte'])
        registro = self.con.execute('SELECT registro FROM desenrola_tipos_nao_documentados').fetchone()
        self.assertEqual(json.loads(registro[0])['NUMERO_OPERACOES'], '377130')
        self.assertTrue(any(p.read_bytes() == self.COM_TIPO_4.encode() for p in Path(self.tmp.name).rglob('*.json') if not p.name.endswith('.meta.json')))

    def test_silver_gravado_antes_do_contrato_e_revalidado_com_ressalva(self):
        # estado deixado pela rodada de 24/10: silver e coleta do arquivo com tipo 4,
        # só com os tipos 1 a 3, e nenhum veredito do contrato
        desenrola._ensure(self.con)
        sha = hashlib.sha256(self.COM_TIPO_4.encode()).hexdigest()
        self.con.execute("INSERT INTO desenrola_op VALUES('2026-08','faixa1','SP','123','Banco',2,1200.5,?)", (sha,))
        self.con.execute("INSERT INTO desenrola_coleta VALUES('2026-10-24T13:23:24+00:00',?,1,1,'2026-08','2026-08')", (sha,))
        resultado = self.collect(self.COM_TIPO_4)[0]
        # Regra D2 do pacote C, autorizada em 25/10/2026; não aceita o legado sem reconferir.
        self.assertTrue(resultado['ok'])
        self.assertNotIn('note', resultado)
        self.assertEqual(self.veredito(self.COM_TIPO_4)[0], 1)
        saida, gold = self.build()
        self.assertTrue(saida['ok'])
        self.assertIs(gold['disponivel'], True)
        self.assertEqual(gold['bronze_sha'], sha)
        self.assertEqual(gold['fora_do_recorte']['linhas'], 1)

    def test_silver_sem_veredito_nao_e_publicado_mesmo_sem_coleta_no_dia(self):
        desenrola._ensure(self.con)
        self.con.execute("INSERT INTO desenrola_op VALUES('2026-08','faixa1','SP','123','Banco',2,1200.5,'legado')")
        self.con.execute("INSERT INTO desenrola_coleta VALUES('2026-10-24T13:23:24+00:00','legado',1,1,'2026-08','2026-08')")
        saida, gold = self.build()
        self.assertFalse(saida['ok'])
        self.assertIn('sem validação registrada', gold['motivo'])

    def test_arquivo_aceito_segue_para_o_build_e_o_atalho_de_inalterado(self):
        self.assertTrue(self.collect(VALID)[0]['ok'])
        self.assertIn('note', self.collect(VALID)[0])
        saida, gold = self.build()
        self.assertNotEqual(saida.get('motivo'), 'silver fora do contrato')
        self.assertIsNot(gold.get('disponivel'), False)

    def test_arquivo_novo_valido_depois_de_rejeicao_volta_a_publicar(self):
        # D2 (25/10/2026): conserva a rejeição por outra falha, mesmo com tipo 4.
        self.assertFalse(self.collect(self.COM_TIPO_4.replace('1.200,50', 'NaN'))[0]['ok'])
        self.assertTrue(self.collect(VALID)[0]['ok'])
        saida, gold = self.build()
        self.assertIsNot(gold.get('disponivel'), False)

    def test_tipo_desconhecido_com_outra_falha_retem_tudo(self):
        self.assertTrue(self.collect(VALID)[0]['ok'])
        anterior = self.con.execute('SELECT * FROM desenrola_op').fetchall()
        for texto in [
            self.COM_TIPO_4.replace('1.200,50', 'NaN'),
            self.COM_TIPO_4.replace('759.760.000,00', ''),
            self.COM_TIPO_4.replace(';4;SP;', ';4;XX;'),
            self.COM_TIPO_4.replace(';377130;', ';-1;'),
            self.COM_TIPO_4.replace('202608;4;', '202613;4;'),
            self.COM_TIPO_4 + self.COM_TIPO_4.splitlines()[-1] + '\n',
            self.COM_TIPO_4.replace('202608;1;', '202609;1;'),
        ]:
            with self.subTest(texto=texto):
                self.assertFalse(self.collect(texto)[0]['ok'])
                self.con.commit()
                self.assertEqual(self.con.execute('SELECT * FROM desenrola_op').fetchall(), anterior)
                self.assertEqual(self.veredito(texto)[0], 0)
                self.assertEqual(self.con.execute('SELECT COUNT(*) FROM desenrola_tipos_nao_documentados').fetchone()[0], 0)

    def test_csv_real_tipos_1_a_4_preserva_recorte_e_retorna_a_hash_anterior(self):
        arquivo = Path(__file__).parent / 'fixtures/desenrola/bcb-2026-10-24.csv.gz'
        bruto = gzip.decompress(arquivo.read_bytes())
        self.assertEqual(hashlib.sha256(bruto).hexdigest(), '14b4deec1cc239fd4e293a2b12e96190d4660ea8fa83cb31872d3b91e9a414f7')
        resultado = self.collect(bruto.decode('utf-8-sig'))[0]
        self.assertTrue(resultado['ok'])
        self.assertEqual(resultado['linhas'], 11242)
        recorte = resultado['fora_do_recorte']
        self.assertEqual((recorte['linhas'], recorte['tipos'], recorte['periodo_inicio'], recorte['periodo_fim']), (2396, ['4'], '2026-05', '2026-08'))
        saida, gold = self.build()
        self.assertTrue(saida['ok'])
        self.assertEqual(gold['fora_do_recorte'], recorte)
        self.assertEqual(gold['data_base'], '2026-08')
        self.assertEqual({r[0] for r in self.con.execute('SELECT DISTINCT tipo FROM desenrola_op')}, {'faixa1', 'faixa2', 'pequenos_negocios'})
        self.assertEqual(self.con.execute('SELECT COUNT(*) FROM desenrola_tipos_nao_documentados').fetchone()[0], recorte['linhas'])
        self.assertTrue(all(str(v) in recorte['ressalva'] for v in ['2.396', '2026-05', '2026-08']))
        # A mesma captura aceita não perde a ressalva na execução seguinte.
        self.assertEqual(self.collect(bruto.decode('utf-8-sig'))[0]['fora_do_recorte'], recorte)
        # Sem o tipo desconhecido, a ressalva some; o histórico do bronze fica.
        sem_tipo4 = '\n'.join(l for l in bruto.decode('utf-8-sig').splitlines() if ';4;' not in l) + '\n'
        self.assertTrue(self.collect(sem_tipo4)[0]['ok'])
        self.assertEqual(self.build()[1]['fora_do_recorte']['linhas'], 0)
        self.assertTrue(self.collect(bruto.decode('utf-8-sig'))[0]['ok'])
        self.assertEqual(self.build()[1]['fora_do_recorte'], recorte)


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
