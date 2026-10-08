"""Infraestrutura dos módulos temáticos de Energia: coletor CKAN (política de recoleta,
vintages idênticas), registros textuais com revisão, silver por família, registro de
módulos e catálogo de métricas."""
import csv
import io
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas, modulos  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402


class _Ambiente(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.multiple(base, BRONZE=os.path.join(self.tmp.name, "bronze"),
                                     SILVER=os.path.join(self.tmp.name, "silver"))
        self.p.start()
        self.con = base.conecta(":memory:")

    def tearDown(self):
        self.con.close()
        self.p.stop()
        self.tmp.cleanup()


def _baixador(conteudo):
    def f(url, caminho):
        with open(caminho, "wb") as fh:
            fh.write(conteudo)
        return caminho, len(conteudo)
    return f


class ColetorCkan(_Ambiente):
    def test_download_novo_identico_e_pulado(self):
        kw = dict(orgao="ANEEL", dataset="teste", recurso="r1", url="https://x/r1.csv", ext="csv")
        r1 = ckan.baixar_recurso(self.con, publicado_em="2026-09-01T10:00:00", baixador=_baixador(b"a;b\n1;2\n"),
                                 max_idade_dias=0, **kw)
        self.assertEqual(r1["status"], "nova")
        self.assertEqual(r1["vintage"]["publicado_em"], "2026-09-01T10:00:00Z")  # CKAN sem fuso = UTC
        # mesmo conteúdo: não cria vintage
        r2 = ckan.baixar_recurso(self.con, publicado_em="2026-09-02T10:00:00", baixador=_baixador(b"a;b\n1;2\n"),
                                 max_idade_dias=0, **kw)
        self.assertEqual(r2["status"], "identica")
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 1)
        # captura recente e publicação igual: nem baixa
        chamado = []
        def nao_deveria(url, caminho):
            chamado.append(url)
            raise AssertionError("não deveria baixar")
        r3 = ckan.baixar_recurso(self.con, publicado_em="2026-09-01T10:00:00", baixador=nao_deveria, max_idade_dias=7, **kw)
        self.assertEqual(r3["status"], "pulada")
        self.assertEqual(chamado, [])
        # publicação nova na fonte: baixa mesmo com captura recente, e conteúdo novo vira vintage
        r4 = ckan.baixar_recurso(self.con, publicado_em="2026-09-20T10:00:00", baixador=_baixador(b"a;b\n1;3\n"),
                                 max_idade_dias=7, **kw)
        self.assertEqual(r4["status"], "nova")
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 2)

    def test_falha_de_download_nao_cria_vintage(self):
        def falha(url, caminho):
            raise RuntimeError("503")
        r = ckan.baixar_recurso(self.con, orgao="ANEEL", dataset="t", recurso="r", url="u", baixador=falha)
        self.assertEqual(r["status"], "falha")
        self.assertIsNone(r["vintage"])
        self.assertEqual(self.con.execute("SELECT ok FROM coletas").fetchone()[0], 0)

    def test_leitura_csv_latin1_com_ponto_e_virgula(self):
        corpo = "Distribuidora;Valor\nCompanhia Energética;1.234,5\nSão João;\n".encode("latin-1")
        r = ckan.baixar_recurso(self.con, orgao="ANEEL", dataset="t", recurso="r", url="u", baixador=_baixador(corpo))
        linhas = list(ckan.le_csv_bronze(os.path.join(base.RAIZ, r["vintage"]["arquivo"])))
        self.assertEqual(linhas[1]["Distribuidora"], "São João")
        self.assertEqual(ckan.numero_br(linhas[0]["Valor"]), 1234.5)
        self.assertIsNone(ckan.numero_br(linhas[1]["Valor"]))  # vazio é ausência, não zero

    def test_numero_br(self):
        self.assertEqual(ckan.numero_br("1.234.567,89"), 1234567.89)
        self.assertEqual(ckan.numero_br("1234.5"), 1234.5)
        self.assertEqual(ckan.numero_br("1,234.5"), 1234.5)
        self.assertEqual(ckan.numero_br("-0,5"), -0.5)
        self.assertIsNone(ckan.numero_br("NA"))


class Registros(_Ambiente):
    def _vintage(self, sha, quando):
        vid, _ = base.registra_vintage(self.con, "cad", "r", "u", quando, None, sha, 1, "coleta_direta", None)
        return vid

    def test_revisao_e_reconstituicao_temporal(self):
        v1 = self._vintage("a" * 64, "2026-01-01T00:00:00Z")
        self.assertEqual(base.grava_registros(self.con, "cad", v1, [("U1", "fase", "construção"), ("U1", "data", "2026-06")]), (2, 0))
        v2 = self._vintage("b" * 64, "2026-03-01T00:00:00Z")
        # data revisada, fase igual (não regrava), campo novo
        self.assertEqual(base.grava_registros(self.con, "cad", v2, [("U1", "fase", "construção"), ("U1", "data", "2026-09"),
                                                                    ("U2", "fase", "outorga")]), (1, 1))
        self.assertEqual(base.registros_como_estavam_em(self.con, "cad", "2026-02-01T00:00:00Z")["U1"]["data"], "2026-06")
        self.assertEqual(base.registros_como_estavam_em(self.con, "cad")["U1"]["data"], "2026-09")
        self.assertNotIn("U2", base.registros_como_estavam_em(self.con, "cad", "2026-02-01T00:00:00Z"))
        self.assertEqual([v for _, v in base.historico_registro(self.con, "cad", "U1", "data")], ["2026-06", "2026-09"])

    def test_campo_apagado_pela_fonte_fica_no_historico(self):
        v1 = self._vintage("c" * 64, "2026-01-01T00:00:00Z")
        base.grava_registros(self.con, "cad", v1, [("U1", "obs", "atrasada")])
        v2 = self._vintage("d" * 64, "2026-02-01T00:00:00Z")
        base.grava_registros(self.con, "cad", v2, [("U1", "obs", None)])
        self.assertNotIn("obs", base.registros_como_estavam_em(self.con, "cad")["U1"])
        self.assertEqual([v for _, v in base.historico_registro(self.con, "cad", "U1", "obs")], ["atrasada", ""])


class SilverPorFamilia(_Ambiente):
    def test_familia_valida_e_isolada(self):
        c = base.conecta_familia("aneel_distribuicao")
        c.close()
        self.assertTrue(os.path.exists(os.path.join(base.SILVER, "aneel_distribuicao.db")))
        with self.assertRaises(ValueError):
            base.conecta_familia("../fora")


class RegistroEMetricas(unittest.TestCase):
    def test_modulos_descobertos_sao_validos(self):
        mods = modulos.descobrir()
        golds = [m.REGISTRO["gold"] for m in mods]
        self.assertEqual(len(golds), len(set(golds)))
        for m in mods:
            for d in m.REGISTRO["datasets"]:
                for campo in ("orgao", "nome", "slug", "titulo", "estado", "paginas"):
                    self.assertIn(campo, d, f"{m.REGISTRO['id']}: dataset sem {campo}")

    def test_catalogo_de_metricas_valido(self):
        metricas.todas()  # lança se algum arquivo tiver métrica inválida

    def test_validacao_recusa_metrica_incompleta(self):
        self.assertTrue(metricas.validar({"id": "x", "natureza_transformacao": "CALCULADO"}))
        self.assertIn("x: denominador sem numerador", metricas.validar({"id": "x", "denominador": "d"}))


if __name__ == "__main__":
    unittest.main()


class CsvDeDownload(unittest.TestCase):
    """O CSV que o leitor baixa precisa ter o número de colunas do cabeçalho em toda linha."""

    def test_campo_com_ponto_e_virgula_vai_entre_aspas_e_volta_inteiro(self):
        with tempfile.TemporaryDirectory() as d:
            base.escreve_csv("t.csv", ["id", "valor", "detalhe"],
                             [(1, 2.5, "horas no piso SE:4; dia inteiro N"), (2, None, 'diz "oi"'), (3, 1.23456789, "simples")], destino=d)
            bruto = open(os.path.join(d, "t.csv"), encoding="utf-8", newline="").read()
            linhas = list(csv.reader(io.StringIO(bruto), delimiter=";"))
        self.assertEqual(linhas[0], ["id", "valor", "detalhe"])
        self.assertEqual(linhas[1], ["1", "2.5", "horas no piso SE:4; dia inteiro N"])
        self.assertEqual(linhas[2], ["2", "", 'diz "oi"'])           # ausência é campo vazio, nunca zero
        self.assertEqual(linhas[3], ["3", "1.2346", "simples"])       # o arredondamento em quatro casas não mudou
        self.assertTrue(all(len(x) == 3 for x in linhas))
        self.assertIn('1;2.5;"horas no piso SE:4; dia inteiro N"\n', bruto)
        self.assertIn('3;1.2346;simples\n', bruto)                    # sem caractere especial, o texto é o mesmo de antes

    def test_todo_csv_publicado_tem_o_numero_de_colunas_do_cabecalho(self):
        serie = os.path.join(base.RAIZ, "public", "energia", "series")
        ruins = {}
        for nome in sorted(os.listdir(serie)):
            if not nome.endswith(".csv"):
                continue
            with open(os.path.join(serie, nome), encoding="utf-8", newline="") as f:
                linhas = list(csv.reader(f, delimiter=";"))
            if not linhas:
                continue
            n = len(linhas[0])
            fora = sum(1 for r in linhas[1:] if len(r) != n)
            if fora:
                ruins[nome] = fora
        self.assertEqual(ruins, {}, "CSV com linhas de número de colunas diferente do cabeçalho")

