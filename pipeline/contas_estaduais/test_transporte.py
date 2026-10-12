"""Limites da fonte são respeitados sem transformar falha em ausência."""
import io
import unittest
from urllib.error import HTTPError
from unittest.mock import patch
from .coletar import requisitar, espera_retry


def erro(codigo, espera=None):
    return HTTPError('https://exemplo.test', codigo, 'resposta',
                     {} if espera is None else {'Retry-After': espera}, None)


class TransporteTest(unittest.TestCase):
    @patch('pipeline.contas_estaduais.coletar.time.sleep')
    @patch('pipeline.contas_estaduais.coletar.urlopen')
    def test_respeita_429_e_preserva_bytes(self, abrir, dormir):
        abrir.side_effect = [erro(429, '9'), io.BytesIO(b'{"items":[]}')]
        self.assertEqual(requisitar('https://exemplo.test'), b'{"items":[]}')
        self.assertEqual([c.args[0] for c in dormir.call_args_list], [1, 9, 1])

    @patch('pipeline.contas_estaduais.coletar.time.sleep')
    @patch('pipeline.contas_estaduais.coletar.urlopen')
    def test_nao_antecipa_retry_after_longo(self, abrir, dormir):
        abrir.side_effect = erro(429, '120')
        with self.assertRaises(HTTPError): requisitar('https://exemplo.test')
        self.assertEqual(abrir.call_count, 1)
        self.assertEqual(dormir.call_count, 1)

    @patch('pipeline.contas_estaduais.coletar.time.sleep')
    @patch('pipeline.contas_estaduais.coletar.urlopen')
    def test_falha_persistente_tem_limite(self, abrir, dormir):
        abrir.side_effect = erro(503)
        with self.assertRaises(HTTPError): requisitar('https://exemplo.test')
        self.assertEqual(abrir.call_count, 3)

    @patch('pipeline.contas_estaduais.coletar.time.sleep')
    @patch('pipeline.contas_estaduais.coletar.urlopen')
    def test_erro_permanente_nao_e_repetido(self, abrir, dormir):
        abrir.side_effect = erro(404)
        with self.assertRaises(HTTPError): requisitar('https://exemplo.test')
        self.assertEqual(abrir.call_count, 1)

    def test_data_http_futura_nao_e_ignorada(self):
        self.assertIsNone(espera_retry('Thu, 01 Jan 2099 00:00:00 GMT', 0))
        self.assertEqual(espera_retry('invalido', 1), 4)
