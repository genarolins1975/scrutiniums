"""Regras de borda que retiveram emprego-setores-ufs (06/11/2026) e recordes (13/11/2026) na publicação diária."""
import unittest

from pipeline import emprego, recordes


def _faixa_do_teste_de_interface(z):
    # A mesma regra de src/tests/emprego-data.test.ts, aplicada ao z publicado.
    return "contração" if z <= -1 else "fraco" if z < -0.5 else "na média" if z <= 0.5 else "forte" if z < 1 else "aquecido"


class FaixaDoZPublicado(unittest.TestCase):
    def test_faixa_sai_do_z_arredondado_que_o_leitor_ve(self):
        for z in (0.996, -0.996, 0.504, -0.504, 0.4951, -0.4951, 1.004, -1.004, 0.0, 2.3, -2.3):
            publicado = emprego._r(z)
            self.assertEqual(emprego._faixa(z), _faixa_do_teste_de_interface(publicado), z)
        self.assertEqual(emprego._faixa(0.996), "aquecido")  # publicado como 1,00; antes saía "forte"
        self.assertEqual(emprego._faixa(-0.996), "contração")
        self.assertIsNone(emprego._faixa(None))


class JanelaMinimaDosRecordes(unittest.TestCase):
    def test_recorde_historico_exige_a_janela_minima_em_meses(self):
        # 30 observações em 5 meses (série com mais de uma observação por mês), a última é o máximo.
        densa = [(f"2026-{1 + i // 6:02d}-{1 + 4 * (i % 6):02d}", float(i)) for i in range(30)]
        self.assertGreater(len(densa), recordes.MIN_MESES)
        self.assertIsNone(recordes._recorde_da_serie(densa))
        self.assertIsNone(recordes._recorde_da_serie([(r, -v) for r, v in densa]))  # mínimo histórico idem

    def test_recorde_historico_com_janela_suficiente_continua_saindo(self):
        mensal = [(f"{2023 + i // 12}-{1 + i % 12:02d}", float(i)) for i in range(30)]
        tipo, desde, meses = recordes._recorde_da_serie(mensal)
        self.assertEqual((tipo, desde, meses), ("maximo_historico", "2023-01", 29))
        self.assertGreaterEqual(meses, recordes.MIN_MESES)


if __name__ == "__main__":
    unittest.main()
