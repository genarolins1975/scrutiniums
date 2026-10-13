"""Crédito rural (MDCR/Sicor): as duas travas da pane de 03 a 13/10/2026.

1. A coleta roda os recursos pesados (município primeiro) ANTES da cauda histórica
   dos leves, com orçamento próprio: a recarga da história nunca mais deixa a janela
   publicada sem município.
2. A janela publicada só termina num mês que existe no nacional E no municipal;
   o recuo é declarado no payload e nas cautelas.
"""
import sqlite3
import unittest
from datetime import date
from unittest import mock

from pipeline import rural
from pipeline.sources import sicor


def _mes(delta):
    """Mês-calendário `delta` meses antes do corrente, como 'AAAA-MM'."""
    hoje = date.today()
    y, m = hoje.year, hoje.month - delta
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}"


class OrdemDaColeta(unittest.TestCase):
    def test_pesados_antes_da_cauda_historica_dos_leves(self):
        con = sqlite3.connect(":memory:")
        ordem = []

        def fake(recurso):
            def fn(_con, mes):
                ordem.append((recurso, mes))
                raise RuntimeError("HTTP Error 500")  # falha não pode travar a ordem
            return fn

        alvos = {f"_coleta_{r}": fake(r) for r in ("uf", "fonte", "faixa", "genero", "if", "mun", "produto")}
        alvos["_coleta_nomes"] = lambda _con, _mes: (0, {})
        with mock.patch.multiple(sicor, **alvos), mock.patch.object(sicor, "CAP_LEVES", 8):
            sicor.collect(con, {})
        recursos = [r for r, _ in ordem]
        self.assertEqual(recursos[0], "mun", "o municipal é o primeiro recurso coletado")
        ultimo_pesado = max(i for i, r in enumerate(recursos) if r in ("mun", "if", "produto"))
        primeiro_leve = min(i for i, r in enumerate(recursos) if r in ("uf", "fonte", "faixa", "genero"))
        self.assertLess(ultimo_pesado, primeiro_leve, "nenhum leve antes de esgotar os pesados")
        # a janela do municipal cobre o atraso de até dois meses da Olinda
        meses_mun = [m for r, m in ordem if r == "mun"]
        self.assertIn(_mes(15), meses_mun)

    def test_orcamentos_separados(self):
        self.assertGreater(sicor.ORCAMENTO_PESADOS_S, 0)
        self.assertGreater(sicor.ORCAMENTO_S, 0)
        self.assertLessEqual(sicor.ORCAMENTO_PESADOS_S + sicor.ORCAMENTO_S, 1500,
                             "o SICOR não pode tomar mais do que os 25 min de antes do orçamento global")


def _linha(mes, valor):
    return (valor, valor, 0, 0.0, 0, 0.0, 0, 0.0)


class JanelaAlinhadaAoMunicipal(unittest.TestCase):
    def _con(self, meses_fonte, meses_mun):
        con = sqlite3.connect(":memory:")
        sicor._ensure(con)
        for m in meses_fonte:
            con.execute("INSERT INTO sicor_fonte VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (m, "RECURSOS LIVRES", "0001", "0", "1", 1, 100.0, 0, 0.0, 0, 0.0, 0, 0.0))
        for m in meses_mun:
            con.execute("INSERT INTO sicor_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (m, "3550308", "0001", "0430", "1", 1, 100.0, 0, 0.0, 0, 0.0, 0, 0.0, 0.0, 0.0))
        return con

    def _build(self, con):
        with mock.patch.object(rural.common, "ler_gold_opcional", return_value={}):
            return rural.build(con)

    def test_municipal_atrasado_recua_a_janela_e_declara(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]          # nacional até o mês corrente
        mun = [_mes(d) for d in range(30, 2, -1)]             # municipal parado 3 meses atrás
        g = self._build(self._con(fonte, mun))
        self.assertEqual(g["mes_fechado"], _mes(3))
        self.assertEqual(g["janela"]["fim"], _mes(3))
        self.assertEqual(g["janela_recuada"], {"fim_nacional": _mes(2), "fim_municipal": _mes(3)})
        self.assertTrue(any("recorte municipal" in c and _mes(2) in c for c in g["cautelas"]))
        self.assertEqual(g["municipios_meta"]["janela"]["meses"], 12)

    def test_buraco_no_meio_do_municipal_recua_ate_janela_inteira(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]
        mun = [_mes(d) for d in range(30, 1, -1) if d != 6]   # falta um mês no meio
        g = self._build(self._con(fonte, mun))
        # a primeira janela de 12 meses inteiros nos dois recortes termina antes do buraco
        self.assertEqual(g["janela"]["fim"], _mes(7))
        self.assertEqual(g["janela_recuada"], {"fim_nacional": _mes(2), "fim_municipal": _mes(7)})
        self.assertEqual(g["municipios_meta"]["janela"]["meses"], 12)
        self.assertEqual(len(g["ufs"]), 1)

    def test_sem_atraso_nada_muda(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]
        g = self._build(self._con(fonte, fonte))
        self.assertEqual(g["janela"]["fim"], _mes(2))
        self.assertIsNone(g["janela_recuada"])
        self.assertFalse(any("recorte municipal da MDCR ainda" in c for c in g["cautelas"]))


if __name__ == "__main__":
    unittest.main()
