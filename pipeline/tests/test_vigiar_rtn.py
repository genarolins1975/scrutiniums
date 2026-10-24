"""Vigia de edição nova do RTN (scripts/contas-publicas/vigiar_rtn.py), sem rede."""
import contextlib
import datetime as dt
import importlib.util
import io
import json
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("vigiar_rtn", RAIZ / "scripts/contas-publicas/vigiar_rtn.py")
V = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(V)

DADOS = json.loads((RAIZ / "src/lib/contas-publicas/snapshots/dados.json").read_text())


def tesouro(publicados=(), planilha=None, falhar=False):
    def buscar(url):
        if falhar:
            raise TimeoutError("tempo esgotado")
        if "/ckan/api/" in url:
            recurso = {"id": "527ccdb1-3059-42f3-bf23-b5e3ab4c6dc6", "url": planilha or DADOS["fonteRTN"]}
            return 200, json.dumps({"result": {"resources": [{"id": "outro", "url": "x"}, recurso]}}).encode()
        ano, mes = map(int, url.rstrip("/").rsplit("/", 2)[1:])
        conteudo = f"<html><title>Resultado do Tesouro Nacional — {V.MESES[mes-1]} de {ano}</title></html>".encode()
        return (200, conteudo) if (ano, mes) in publicados else (404, b"")
    return buscar


class VigiaRTN(unittest.TestCase):
    def test_meses_seguintes_param_no_mes_anterior_ao_corrente(self):
        self.assertEqual(V.meses_seguintes("2026-07", dt.date(2026, 10, 19)), [(2026, 8), (2026, 9)])
        self.assertEqual(V.meses_seguintes("2026-11", dt.date(2027, 1, 3)), [(2026, 12)])
        self.assertEqual(V.meses_seguintes("2026-09", dt.date(2026, 10, 1)), [])

    def test_nada_novo_e_silencio(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(V.main(buscar=tesouro(), hoje=dt.date(2026, 8, 20)), 0)

    def test_boletim_publicado_vira_issue_com_assinatura(self):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            codigo = V.main(buscar=tesouro(publicados={(2026, 8)}), hoje=dt.date(2026, 10, 19))
        self.assertEqual(codigo, 3)
        texto = saida.getvalue()
        self.assertIn("agosto de 2026", texto)
        self.assertIn("Integração manual", texto)
        self.assertIn("Assinatura: 2026-08", texto)

    def test_planilha_nova_no_ckan(self):
        nova = DADOS["fonteRTN"].replace("jul26", "ago26")
        publicados, planilha, nv = V.verificar(DADOS, tesouro(planilha=nova), dt.date(2026, 8, 20))
        self.assertEqual((publicados, planilha, nv), ([], nova, []))
        self.assertIn("|" + nova, V.corpo(DADOS, publicados, planilha, nv))

    def test_fonte_fora_do_ar_nao_e_silencio(self):
        publicados, planilha, nv = V.verificar(DADOS, tesouro(falhar=True), dt.date(2026, 10, 19))
        self.assertEqual(publicados, [])
        self.assertEqual(len(nv), 3)  # agosto, setembro e o CKAN
        self.assertIn("Não verificado", V.corpo(DADOS, publicados, planilha, nv))

    def test_200_vazio_ou_desafio_nao_confirma_edicao(self):
        for conteudo in [b'', b'<html>Access denied</html>', b'<html>Login</html>']:
            with self.subTest(conteudo=conteudo):
                publicados, planilha, nv = V.verificar(DADOS, lambda _: (200, conteudo), dt.date(2026, 10, 24))
                self.assertEqual(publicados, [])
                self.assertIsNone(planilha)
                self.assertTrue(nv)

    def test_menu_com_mes_e_ano_nao_prova_edicao_da_pagina(self):
        pagina = b'<title>Resultado do Tesouro Nacional</title><nav>agosto de 2026 setembro de 2026</nav>'
        publicados, _, nv = V.verificar(DADOS, lambda _: (200, pagina), dt.date(2026, 10, 24))
        self.assertFalse(publicados)
        self.assertTrue(nv)
        self.assertIn("inconclusiva", V.corpo(DADOS, publicados, None, nv))

    def test_indisponibilidade_tem_codigo_diferente_de_edicao_nova(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(V.main(buscar=tesouro(falhar=True), hoje=dt.date(2026, 10, 24)), 4)


if __name__ == "__main__":
    unittest.main()
