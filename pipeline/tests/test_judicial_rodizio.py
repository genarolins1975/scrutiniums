"""Coleta do DataJud com orçamento por execução: a fila começa pelo tribunal mais atrasado (issue #27, 03/11/2026).

Até 03/11/2026 a ordem era fixa e o orçamento acabava sempre nos mesmos tribunais; os do fim da lista nunca eram coletados e a
camada nacional ficou retida desde 24/09/2026 com 28 pares tribunal/categoria sem dado."""
import sqlite3
import unittest
from unittest import mock

from pipeline.sources import judicial as j

TAX = {"falencia": {"codigos": {1: "Falência"}}, "rj": {"codigos": {2: "Recuperação"}}}


def _resposta(*_a, **_k):
    return {"hits": {"total": {"value": 10}}, "aggregations": {"unicos": {"value": 7}}}


class Rodizio(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(":memory:")
        j._ensure(self.con)

    def _coleta(self, tribunais, limite):
        chamadas = {"n": 0}

        def estourou():
            chamadas["n"] += 1
            return chamadas["n"] > limite

        with mock.patch.object(j, "_es", side_effect=_resposta), mock.patch.object(j.time, "sleep"):
            return j._coleta_ramo(self.con, "b", "k", tribunais, TAX, "civel", 0, estourou)

    def test_execucoes_seguidas_cobrem_todos_os_tribunais(self):
        tribunais = ["t1", "t2", "t3", "t4"]
        vistos = set()
        for _ in range(4):
            # orçamento para um tribunal inteiro por execução (1 consulta de entrada + 2 categorias)
            self._coleta(tribunais, 3)
            vistos |= {t for (t,) in self.con.execute("SELECT DISTINCT tribunal FROM jud_assunto")}
        self.assertEqual(vistos, set(tribunais))

    def test_tribunal_interrompido_nao_vira_coletado_e_volta_primeiro(self):
        r = self._coleta(["t1", "t2"], 2)  # entra em t1, coleta uma categoria e o orçamento acaba
        self.assertIn("t1", r["pulados"])
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM jud_tribunal").fetchone()[0], 0)
        self.assertEqual(j._ordem_por_idade(self.con, ["t2", "t1"])[0], "t2")  # nunca coletados: ordem da lista
        self.con.execute("INSERT INTO jud_tribunal VALUES('t2','civel','SP',1,'2026-11-01T00:00:00Z')")
        self.assertEqual(j._ordem_por_idade(self.con, ["t2", "t1"]), ["t1", "t2"])

    def test_ramo_mais_atrasado_comeca(self):
        self.con.execute("INSERT INTO jud_tribunal VALUES('a','civel','SP',1,'2026-11-02T00:00:00Z')")
        ramos = [("jud_civel", ["a"], TAX, "civel"), ("jud_trabalhista", ["b"], TAX, "trabalhista")]
        self.assertEqual([r[0] for r in j.ordem_dos_ramos(self.con, ramos)], ["jud_trabalhista", "jud_civel"])


if __name__ == "__main__":
    unittest.main()
