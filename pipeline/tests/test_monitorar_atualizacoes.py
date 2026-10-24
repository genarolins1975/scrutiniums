import unittest
from scripts.monitorar_atualizacoes import diagnosticar, posterior, prazo_vintage, relatorio


class Monitoramento(unittest.TestCase):
    def test_tres_causas_diferentes(self):
        base = dict(referencia='2026-08', captura='2026-10-24', prazo='2026-11-15', hoje='2026-10-24')
        self.assertEqual(diagnosticar(**base, fonte_verificada=True, referencia_fonte='2026-08')[1],
                         'fonte_sem_edicao_nova_confirmada')
        self.assertEqual(diagnosticar(**base, falha='timeout', referencia_fonte='2026-09')[1],
                         'coleta_falhou_com_dado_disponivel')
        self.assertEqual(diagnosticar(**base, retida=True)[1], 'publicacao_retida')

    def test_bloqueio_nao_prova_disponibilidade_nem_ausencia(self):
        estado, causa, _ = diagnosticar(referencia='2026-08', captura=None, hoje='2026-10-24', falha='HTTP 403')
        self.assertEqual(estado, 'retida')
        self.assertEqual(causa, 'coleta_falhou_disponibilidade_na_origem_nao_confirmada')

    def test_sem_sla_nao_inventa_prazo(self):
        self.assertIsNone(prazo_vintage('2026-08', 'fonte_sem_contrato'))
        self.assertEqual(prazo_vintage('2026-08', 'sgs'), '2026-11-15')

    def test_falhas_auxiliares_identificam_data_do_registro_sem_simular_coleta_atual(self):
        r = relatorio(hoje='2026-10-24')
        for prefixo in ['pilar3:', 'datajud:', 'trends_manual:', 'reclamacoes_consig:']:
            registros = [x for x in r['registros'] if x['id'].startswith(prefixo)]
            self.assertTrue(registros, prefixo)
            for x in registros:
                self.assertTrue(x['falha'])
                self.assertTrue(x['falha_registrada_em'])
                self.assertIsNone(x['captura'])
                self.assertIsNone(x['disponivel_na_origem'])

    def test_relatorio_preserva_grupos_e_separa_producao(self):
        r = relatorio(hoje='2026-10-24', execucoes={'credito': {'retida': True}, 'energia': {'retida': True}})
        judicial = next(x for x in r['registros'] if x['id'] == 'judicial')
        self.assertEqual(judicial['prazo_existente'], prazo_vintage(judicial['referencia'], 'datajud'))
        self.assertIsNotNone(judicial['prazo_existente'])
        pix = next(x for x in r['registros'] if x['id'] == 'pix')
        self.assertNotEqual(pix['situacao'], 'retida')
        energia = [x for x in r['registros'] if x['dominio'] == 'energia']
        self.assertTrue(energia)
        self.assertTrue(all(x['situacao'] == 'retida' for x in energia))
        for x in r['registros']:
            self.assertTrue({'fonte','referencia','captura','publicacao','periodicidade','integridade_declarada',
                             'situacao','historico','falha','acao'} <= x.keys())
            if x['publicacao']: self.assertIsNone(x['publicacao']['producao_em'])
            self.assertIsNone(x['disponivel_na_origem'])

    def test_diagnostico_do_topo_nao_vale_para_arquivo_publicado_depois(self):
        # 24/10/2026: Desenrola coletado às 13:23 e publicado às 15:02; o topo de meta.json
        # (falha de HTML e restauração) era de 18/10 e o inventário dizia "retida"
        topo = '2026-10-18T15:09:35+00:00'
        self.assertTrue(posterior('2026-10-24T13:23:24+00:00', topo))
        self.assertFalse(posterior('2026-09-24T15:25:02+00:00', topo))
        self.assertFalse(posterior(None, topo))
        self.assertFalse(posterior('2026-10-24T13:23:24Z', None))
        self.assertTrue(posterior('2026-10-24T13:23:24Z', topo))

    def test_cada_registro_de_credito_respeita_a_data_do_proprio_arquivo(self):
        r = relatorio(hoje='2026-10-24')
        topo = __import__('json').loads((__import__('pathlib').Path(__file__).resolve().parents[2]
                                         / 'public/obs/data/gold/meta.json').read_text())['gerado_em']
        for x in r['registros']:
            if x['id'] in {'desenrola', 'judicial', 'scr', 'ifdata', 'pix'} and posterior(x['captura'], topo):
                self.assertIsNone(x['falha_registrada_em'], x['id'])
                self.assertNotEqual(x['diagnostico'], 'publicacao_retida', x['id'])


if __name__ == '__main__':
    unittest.main()
