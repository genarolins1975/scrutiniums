"""Falhas HTTP 200 não contaminam o silver nem interrompem recursos independentes."""
import json
import os
import tempfile
import unittest
from datetime import date
from unittest.mock import patch

from pipeline.energia import base
from pipeline.energia.fontes import ccee, ons


class ColetaTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.con = base.conecta(":memory:")
        self.addCleanup(self.con.close)
        for attr in ("DADOS", "BRONZE"):
            p = patch.object(base, attr, os.path.join(self.tmp.name, attr))
            p.start()
            self.addCleanup(p.stop)
        p = patch.object(base, "agora_utc", return_value="2026-11-07T12:00:00Z")
        p.start()
        self.addCleanup(p.stop)

    def baixar(self, recursos, corpos):
        def get(url, **kwargs):
            if "package_show" in url:
                return json.dumps({"success": True, "result": {"resources": recursos}}).encode(), {}
            return corpos[url], {}
        return get

    def ons(self, corpos):
        recursos = [{"url": f"https://fonte.test/CARGA_ENERGIA_{ano}.csv", "format": "CSV"}
                    for ano in corpos]
        get = self.baixar(recursos, {r["url"]: corpos[ano] for r, ano in zip(recursos, corpos)})
        return ons.coleta_dataset(self.con, "carga_energia_di", hoje=date(2026, 11, 7), baixar=get)

    def ccee(self, corpos):
        recursos = [{"name": f"pld_horario_{ano}", "url": f"https://fonte.test/{ano}.csv"}
                    for ano in corpos]
        get = self.baixar(recursos, {r["url"]: corpos[ano] for r, ano in zip(recursos, corpos)})
        return ccee.coleta_direta(self.con, baixar=get)

    CARGA = b"id_subsistema;din_instante;val_cargaenergiamwmed\nSE;2026-11-01;123\n"
    PLD = b"MES_REFERENCIA;SUBMERCADO;DIA;HORA;PLD_HORA\n202611;SUDESTE;1;0;123\n"

    def test_ons_isola_resposta_html_e_continua_coleta(self):
        status = self.ons({2025: b"<html>indisponivel</html>", 2026: self.CARGA})
        self.assertFalse(status["ok"])
        self.assertEqual(status["arquivos"], 1)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 1)
        self.assertEqual(base.serie_vigente(self.con, "carga_energia_di", "carga_mwmed.SE"), [("2026-11-01", 123)])
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM coletas WHERE ok=0").fetchone()[0], 1)

    def test_ccee_isola_csv_invalido_e_tenta_novamente(self):
        status = self.ccee({2025: b"MES_REFERENCIA;SUBMERCADO\n202510;SUDESTE", 2026: self.PLD})
        self.assertFalse(status["ok"])
        self.assertEqual(status["arquivos"], 1)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 1)
        # A resposta corrigida do mesmo recurso deve entrar na próxima captura.
        status = self.ccee({2025: self.PLD.replace(b"202611", b"202510")})
        self.assertTrue(status["ok"])
        self.assertEqual(len(base.serie_vigente(self.con, ccee.DATASET, "pld.SE")), 2)

    def test_rollback_de_escrita_preserva_silver_anterior(self):
        self.ons({2026: self.CARGA})
        original = base.grava_observacoes
        def grava_e_falha(*args):
            original(*args)
            raise ValueError("falha após escrita")
        with patch.object(base, "grava_observacoes", side_effect=grava_e_falha):
            status = self.ons({2026: self.CARGA.replace(b"123", b"456")})
        self.assertFalse(status["ok"])
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 1)
        self.assertEqual(base.serie_vigente(self.con, "carga_energia_di", "carga_mwmed.SE"), [("2026-11-01", 123)])

    def test_catalogo_sem_recurso_e_csv_vazio_nao_sao_sucesso(self):
        for coletar in (self.ons, self.ccee):
            with self.subTest(coletor=coletar.__name__):
                self.assertFalse(coletar({})["ok"])
                self.assertFalse(coletar({2026: b""})["ok"])
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM vintages").fetchone()[0], 0)

    def test_historico_identico_conta_ultima_tentativa_sem_redatar_vintage(self):
        ds, recurso = "carga_energia_di", "CARGA_ENERGIA_2020"
        cap = "2020-01-01T00:00:00Z"
        arq, sha = base.salva_bronze("ons", ds, recurso, self.CARGA, "csv", cap)
        base.registra_vintage(self.con, ds, recurso, "u", cap, "2020-01-01", sha, len(self.CARGA), "teste", arq)
        base.registra_coleta(self.con, ds, recurso, True, "conteúdo idêntico")
        self.assertFalse(ons._precisa_recoletar(self.con, ds, recurso, 2020, date(2026, 11, 8)))
        self.assertTrue(ons._precisa_recoletar(self.con, ds, recurso, 2020, date(2026, 12, 8)))
        self.assertTrue(ons._precisa_recoletar(self.con, ds, recurso, 2020, date(2026, 11, 8), publicado_em="2026-11-08"))
        self.assertEqual(base.ultima_vintage(self.con, ds, recurso)["capturado_em"], cap)
        os.remove(base.caminho_bronze(arq))
        self.assertTrue(ons._precisa_recoletar(self.con, ds, recurso, 2020, date(2026, 11, 8)))

    def test_metadado_revisado_com_bytes_identicos_nao_forca_coleta_diaria(self):
        ds, recurso = "carga_energia_di", "CARGA_ENERGIA_2020"
        recursos = [{"url": "https://fonte.test/CARGA_ENERGIA_2020.csv", "format": "CSV",
                     "last_modified": "2026-10-01"}]
        baixar = self.baixar(recursos, {recursos[0]["url"]: self.CARGA})
        self.assertTrue(ons.coleta_dataset(self.con, ds, date(2026, 11, 7), baixar)["ok"])
        recursos[0]["last_modified"] = "2026-11-07"
        segunda = ons.coleta_dataset(self.con, ds, date(2026, 11, 7), baixar)
        self.assertEqual(segunda["arquivos"], 1)
        terceira = ons.coleta_dataset(self.con, ds, date(2026, 11, 8), baixar)
        self.assertEqual(terceira["arquivos"], 0)
        self.assertEqual(base.ultima_vintage(self.con, ds, recurso)["publicado_em"], "2026-10-01")


if __name__ == "__main__":
    unittest.main()
