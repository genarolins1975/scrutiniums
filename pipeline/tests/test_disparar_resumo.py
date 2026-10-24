"""Continuação de lotes sem rede, credenciais ou mensagens reais."""
import unittest
import contextlib
import io
import os
import urllib.request
import urllib.error
from datetime import date
from unittest.mock import Mock, patch
from scripts.disparar_resumo import executar, main, FalhaLote, SemRedirecionamento


class LotesResumo(unittest.TestCase):
    def test_continua_lote_semanal_na_mesma_segunda_ate_concluir(self):
        disparo = Mock(side_effect=[{'enviados':400,'falhas':0,'pendentes':150},
                                   {'enviados':150,'falhas':0,'pendentes':0}])
        self.assertEqual(executar(disparo,simular=False,dia=lambda:date(2026,10,26),registrar=lambda _:None),550)
        self.assertEqual(disparo.call_count,2)

    def test_simulacao_e_uma_chamada_sem_envio(self):
        disparo = Mock(return_value={'simulacao':True,'enviados':0,'falhas':0,'destinatarios':550})
        self.assertEqual(executar(disparo,registrar=lambda _:None),0)
        disparo.assert_called_once_with(True)

    def test_falha_do_provedor_nao_e_repetida(self):
        disparo = Mock(return_value={'enviados':1,'falhas':1,'pendentes':3})
        with self.assertRaises(RuntimeError): executar(disparo,simular=False,registrar=lambda _:None)
        self.assertEqual(disparo.call_count,1)

    def test_timeout_nao_e_repetido(self):
        disparo = Mock(side_effect=TimeoutError('tempo esgotado'))
        with self.assertRaises(TimeoutError): executar(disparo,simular=False,registrar=lambda _:None)
        self.assertEqual(disparo.call_count,1)

    def test_limite_com_pendentes_nao_termina_verde(self):
        disparo = Mock(return_value={'enviados':1,'falhas':0,'pendentes':1})
        with self.assertRaisesRegex(RuntimeError,'não concluído'):
            executar(disparo,simular=False,max_lotes=2,registrar=lambda _:None)
        self.assertEqual(disparo.call_count,2)

    def test_virada_do_dia_nao_apaga_pendencia_por_filtro_de_periodicidade(self):
        dias = Mock(side_effect=[date(2026,10,26),date(2026,10,26),date(2026,10,27)])
        disparo = Mock(return_value={'enviados':1,'falhas':0,'pendentes':1})
        with self.assertRaisesRegex(RuntimeError,'Janela diária'):
            executar(disparo,simular=False,dia=dias,registrar=lambda _:None)
        self.assertEqual(disparo.call_count,1)

    def test_erro_de_cabecalho_nao_expoe_credencial_sintetica(self):
        fixture = 'somente-fixture-de-teste\n'
        saida = io.StringIO()
        with patch.dict(os.environ, {'BOLETIM_SECRET':fixture}), \
             patch('urllib.request.OpenerDirector.open',side_effect=ValueError(f'Invalid header value {fixture!r}')), \
             contextlib.redirect_stderr(saida):
            self.assertEqual(main(),1)
        self.assertNotIn('somente-fixture',saida.getvalue())
        self.assertIn('ValueError',saida.getvalue())

    def test_redirecionamento_nao_encaminha_autorizacao_a_outro_destino(self):
        req = urllib.request.Request('https://scrutiniums.com/api/resumo/enviar')
        for codigo in [301,302,303,307,308]:
            with self.subTest(codigo=codigo), self.assertRaises(urllib.error.HTTPError):
                SemRedirecionamento().redirect_request(req,None,codigo,'redirect',{},'https://outro.test/')

    def test_resposta_invalida_ou_simulacao_nao_confirmada_e_erro(self):
        for resposta, simular in [({},False),({'enviados':0},True),
                                  ({'enviados':0,'falhas':0,'pendentes':-1},False)]:
            with self.subTest(resposta=resposta), self.assertRaises(FalhaLote):
                executar(Mock(return_value=resposta),simular=simular,registrar=lambda _:None)


if __name__ == '__main__': unittest.main()
