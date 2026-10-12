"""Falhas de transporte/integridade nunca viram captura bem-sucedida."""
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from .capturar_educacao import capturar


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
