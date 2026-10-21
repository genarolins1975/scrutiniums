"""Resposta parcial do DataJud (shards recusados com HTTP 200) nunca vira dado.

Caso real: execução diária de 25/09/2026 (run 36147018389). O recorte "todos" de busca e
apreensão ficou abaixo do bancário (508.932 contra 518.068 casos em 12 meses) e o teste
de conteúdo reteve a publicação. No diagnóstico do mesmo dia, consultas ao DataJud
voltaram com HTTP 200 e shards recusados (es_rejected_execution_exception).

Rodar: python3 -m unittest discover -s pipeline/tests -t .
"""
import io
import json
import sqlite3
import unittest
from unittest import mock

from pipeline.sources import datajud
from pipeline.sources import datajud_cobranca as dc
from pipeline.sources import judicial

COMPLETA = {"timed_out": False, "_shards": {"total": 20, "successful": 20, "skipped": 0, "failed": 0},
            "hits": {"total": {"value": 10}}}
PARCIAL = {"timed_out": False, "_shards": {"total": 20, "successful": 17, "skipped": 0, "failed": 3, "failures": [
    {"shard": 3, "reason": {"type": "es_rejected_execution_exception", "reason": "queue capacity = 1000"}}]},
    "hits": {"total": {"value": 7}}}
ESTOURADA = {"timed_out": True, "_shards": {"total": 1, "successful": 1, "failed": 0}, "hits": {"total": {"value": 7}}}


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _respostas(*corpos):
    fila = [_Resp(json.dumps(c).encode()) for c in corpos]
    return mock.patch("urllib.request.urlopen", side_effect=lambda *a, **k: fila.pop(0))


class RespostaCompleta(unittest.TestCase):
    def test_completa_passa(self):
        self.assertIs(datajud.exige_resposta_completa(COMPLETA), COMPLETA)

    def test_shard_recusado_e_falha(self):
        with self.assertRaisesRegex(RuntimeError, "3 de 20 shards.*es_rejected_execution_exception"):
            datajud.exige_resposta_completa(PARCIAL)

    def test_timed_out_e_falha(self):
        with self.assertRaisesRegex(RuntimeError, "parcial"):
            datajud.exige_resposta_completa(ESTOURADA)


@mock.patch("time.sleep", lambda s: None)
class TresClientes(unittest.TestCase):
    """Os três clientes do DataJud tentam de novo diante da resposta parcial e nunca a devolvem."""

    def test_cobranca_tenta_de_novo_e_fica_com_a_completa(self):
        with _respostas(PARCIAL, COMPLETA):
            self.assertEqual(dc._es("http://x", "k", "tjsp", {}), COMPLETA)

    def test_cobranca_esgota_e_falha(self):
        with _respostas(PARCIAL, PARCIAL, PARCIAL), self.assertRaisesRegex(RuntimeError, "parcial"):
            dc._es("http://x", "k", "tjsp", {})

    def test_rj_esgota_e_falha(self):
        with _respostas(PARCIAL, PARCIAL, PARCIAL), self.assertRaisesRegex(RuntimeError, "parcial"):
            datajud._post("http://x", {}, "k")

    def test_judicial_esgota_e_falha(self):
        with _respostas(ESTOURADA, ESTOURADA), self.assertRaisesRegex(RuntimeError, "parcial"):
            judicial._es("http://x", "k", "tjsp", {})


class SilverIncoerente(unittest.TestCase):
    """Tribunal gravado com resposta parcial antes da trava volta na execução seguinte, fora da cota."""

    def setUp(self):
        self.con = sqlite3.connect(":memory:")
        dc._ensure(self.con)
        for i, trib in enumerate(dc.TRIBUNAIS):
            self.con.execute("INSERT INTO cobranca_tribunal VALUES(?,?,?,?,?,?,?,?)",
                             (trib, dc.TRIBUNAIS[trib], "busca_apreensao", "todos", 1, 1, 1, f"2026-09-{i + 1:02d}T00:00:00+00:00"))
            for recorte, casos in (("todos", 100), ("bancario", 98)):
                self.con.execute("INSERT INTO cobranca_mensal VALUES(?,?,?,?,?,?,?)",
                                 (trib, dc.TRIBUNAIS[trib], "busca_apreensao", recorte, "2026-06", casos, casos))
        # o mais recente no rodízio, com o "todos" parcial
        self.con.execute("UPDATE cobranca_mensal SET casos = 40 WHERE tribunal = 'tjto' AND recorte = 'todos'")

    def test_incoerentes_acha_so_o_tribunal_invertido(self):
        self.assertEqual(dc.incoerentes(self.con), ["tjto"])

    def test_collect_refaz_o_incoerente_alem_da_cota(self):
        feitos = []
        with mock.patch.object(dc, "coleta_tribunal", side_effect=lambda con, cfg, t: feitos.append(t) or 1):
            dc.collect(self.con, {})
        self.assertEqual(feitos[0], "tjto")
        self.assertEqual(len(feitos), dc.TRIBUNAIS_POR_EXECUCAO + 1)
        self.assertEqual(feitos[1:], sorted(dc.TRIBUNAIS, key=lambda t: f"2026-09-{list(dc.TRIBUNAIS).index(t) + 1:02d}")[:dc.TRIBUNAIS_POR_EXECUCAO])

    def test_sem_incoerencia_o_rodizio_nao_muda(self):
        self.con.execute("UPDATE cobranca_mensal SET casos = 100 WHERE tribunal = 'tjto' AND recorte = 'todos'")
        feitos = []
        with mock.patch.object(dc, "coleta_tribunal", side_effect=lambda con, cfg, t: feitos.append(t) or 1):
            dc.collect(self.con, {})
        self.assertEqual(feitos, list(dc.TRIBUNAIS)[:dc.TRIBUNAIS_POR_EXECUCAO])


if __name__ == "__main__":
    unittest.main()
