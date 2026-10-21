"""Arredondamento da gold e dos CSV: decimal, meio para cima, como a interface exibe."""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402


class MeioParaCima(unittest.TestCase):
    def test_empates_que_o_round_do_python_resolvia_para_baixo(self):
        # 70,175 e 2,675 são guardados como 70,17499... e 2,67499...; 0,125 é empate exato e o round() vai ao par
        self.assertEqual(round(70.175, 2), 70.17)
        self.assertEqual(c.r(70.175, 2), 70.18)
        self.assertEqual(c.r(2.675, 2), 2.68)
        self.assertEqual(round(0.125, 2), 0.12)
        self.assertEqual(c.r(0.125, 2), 0.13)

    def test_longe_do_zero_nos_negativos(self):
        self.assertEqual(c.r(-2.675, 2), -2.68)
        self.assertEqual(c.r(-0.125, 2), -0.13)

    def test_sem_casas_e_com_mais_casas(self):
        self.assertEqual(c.r(1234.5, 0), 1235.0)
        self.assertEqual(c.r(0.5, 0), 1.0)
        self.assertEqual(c.r(1.00005, 4), 1.0001)
        self.assertEqual(c.r(0.1 + 0.2, 2), 0.3)

    def test_ausencia_continua_ausencia_e_nao_numero_vira_ausencia(self):
        self.assertIsNone(c.r(None))
        self.assertIsNone(c.r(float("nan")))
        self.assertIsNone(c.r(float("inf")))
        self.assertEqual(c.r(0, 2), 0.0)  # zero é valor

    def test_inteiro_entra_e_sai_como_float(self):
        self.assertEqual(c.r(5, 0), 5.0)
        self.assertIsInstance(c.r(5, 0), float)

    def test_valor_grande_nao_levanta(self):
        self.assertEqual(c.r(1e27, 2), 1e27)

    def test_valores_ja_arredondados_nao_mudam(self):
        for v in (0.0, 1.0, 12.34, 70.17, 99.99, 1234567.89):
            self.assertEqual(c.r(v, 2), v)
        self.assertFalse(math.isnan(c.r(3.14159, 3)))
        self.assertEqual(c.r(3.14159, 3), 3.142)

    def test_csv_usa_a_mesma_regra(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            base.escreve_csv("t.csv", ["a", "b"], [[70.175, 0.12345], [None, 2.0]], destino=d)
            with open(os.path.join(d, "t.csv"), encoding="utf-8") as f:
                linhas = f.read().splitlines()
        self.assertEqual(linhas, ["a;b", "70.175;0.1235", ";2.0"])


if __name__ == "__main__":
    unittest.main()
