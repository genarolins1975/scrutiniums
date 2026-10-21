"""Falhas de transporte/integridade nunca viram captura bem-sucedida."""
import hashlib
import io
import json
from pathlib import Path
import ssl
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import zipfile
from .capturar_educacao import CADEIAS_ADICIONAIS, capturar, codigo_saida, coletar, contexto_tls


def pacote(nome="dados.xlsx"):
    dados = io.BytesIO()
    with zipfile.ZipFile(dados, "w") as z:
        z.writestr(nome, b"bytes preservados para verificacao posterior")
    return dados.getvalue()


class CapturaEducacaoTest(unittest.TestCase):
    def rodar(self, respostas):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("urllib.request.urlopen", side_effect=respostas):
                sucesso = capturar(tmp)
            manifesto = json.loads((Path(tmp)/"manifesto.json").read_text())
            arquivos = {p.name: p.read_bytes() for p in Path(tmp).glob("*.zip")}
        return sucesso, manifesto, arquivos

    def test_preserva_bytes_e_hash_sem_promover_observacoes(self):
        dados = pacote()
        ok, m, arquivos = self.rodar([io.BytesIO(dados), io.BytesIO(dados)])
        self.assertTrue(ok)
        self.assertEqual(len(arquivos), 2)
        for f in m["fontes"]:
            self.assertEqual(f["sha256"], hashlib.sha256(arquivos[f["arquivo"]]).hexdigest())
            self.assertEqual(f["bytes"], len(dados))
        self.assertNotIn("observacoes", m)

    def test_html_com_http_200_nao_e_planilha(self):
        ok, m, arquivos = self.rodar([io.BytesIO(b"<html>erro</html>"), io.BytesIO(pacote())])
        self.assertFalse(ok)
        self.assertEqual(m["fontes"][0]["status"], "falha")
        self.assertNotIn("sha256", m["fontes"][0])
        self.assertEqual(len(arquivos), 1)

    def test_pacote_sem_planilha_e_erro_de_rede_preservados(self):
        ok, m, arquivos = self.rodar([io.BytesIO(pacote("leia-me.txt")), TimeoutError("timeout")])
        self.assertFalse(ok)
        self.assertFalse(arquivos)
        self.assertTrue(all(f["status"] == "falha" for f in m["fontes"]))
        self.assertIn("TimeoutError", m["fontes"][1]["erro"])


class TransporteEducacaoTest(unittest.TestCase):
    """Fonte inacessível, TLS reprovado e pacote inválido não se confundem."""

    def rodar(self, respostas, tentativas=3):
        with tempfile.TemporaryDirectory() as tmp:
            with patch("urllib.request.urlopen", side_effect=respostas) as urlopen, \
                    patch("time.sleep") as espera:
                manifesto = coletar(tmp, tentativas=tentativas)
        return manifesto, urlopen, espera

    def test_conexao_reiniciada_e_repetida_ate_capturar(self):
        reset = URLError(ConnectionResetError(104, "Connection reset by peer"))
        m, urlopen, espera = self.rodar([reset, io.BytesIO(pacote()), io.BytesIO(pacote())])
        self.assertTrue(all(f["status"] == "capturado" for f in m["fontes"]))
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(espera.call_count, 1)
        self.assertEqual(codigo_saida(m, tolerar_indisponivel=False), 0)

    def test_fonte_indisponivel_vira_aviso_somente_quando_tolerada(self):
        reset = URLError(ConnectionResetError(104, "Connection reset by peer"))
        m, urlopen, _ = self.rodar([reset] * 3 + [HTTPError("u", 503, "x", {}, None)] * 3)
        self.assertEqual(urlopen.call_count, 6)
        for f in m["fontes"]:
            self.assertEqual((f["status"], f["motivo"]), ("falha", "fonte_indisponivel"))
            self.assertIn("3 tentativa", f["erro"])
            self.assertNotIn("sha256", f)
        self.assertEqual(codigo_saida(m, tolerar_indisponivel=False), 1)
        with patch("builtins.print") as saida:
            self.assertEqual(codigo_saida(m, tolerar_indisponivel=True), 0)
        self.assertTrue(all(c.args[0].startswith("::warning") for c in saida.call_args_list))
        self.assertEqual(saida.call_count, 2)

    def test_tls_reprovado_http_4xx_e_html_falham_mesmo_tolerando(self):
        tls = URLError(ssl.SSLCertVerificationError(1, "unable to get local issuer certificate"))
        m, urlopen, espera = self.rodar([tls, HTTPError("u", 404, "x", {}, None)])
        self.assertEqual(urlopen.call_count, 2)
        espera.assert_not_called()
        self.assertTrue(all(f["motivo"] == "captura_invalida" for f in m["fontes"]))
        self.assertEqual(codigo_saida(m, tolerar_indisponivel=True), 1)
        m, _, _ = self.rodar([io.BytesIO(b"<html>erro</html>"), io.BytesIO(pacote())])
        self.assertEqual(m["fontes"][0]["motivo"], "captura_invalida")
        self.assertEqual(codigo_saida(m, tolerar_indisponivel=True), 1)

    def test_intermediario_versionado_so_completa_a_cadeia_do_inep(self):
        m, urlopen, _ = self.rodar([io.BytesIO(pacote()), io.BytesIO(pacote())])
        contexto = urlopen.call_args.kwargs["context"]
        self.assertEqual(contexto.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(contexto.check_hostname)
        self.assertFalse(contexto.verify_flags & ssl.VERIFY_X509_PARTIAL_CHAIN)
        emissores = [dict(x[0] for x in c["subject"]).get("commonName") for c in contexto.get_ca_certs()]
        self.assertIn("RNP ICPEdu GR46 OV TLS CA 2025", emissores)
        outro = contexto_tls("example.org")
        self.assertNotIn("RNP ICPEdu GR46 OV TLS CA 2025",
                         [dict(x[0] for x in c["subject"]).get("commonName") for c in outro.get_ca_certs()])

    def test_intermediario_alterado_e_recusado(self):
        caminho, _ = CADEIAS_ADICIONAIS["download.inep.gov.br"]
        with patch.dict(CADEIAS_ADICIONAIS, {"download.inep.gov.br": (caminho, "0" * 64)}):
            with self.assertRaises(ValueError):
                contexto_tls("download.inep.gov.br")
