"""Portão mecânico da curadoria Fase 2 (constituição v2, art. 1.3): sem revisão humana,
valor extraído de documento só publica se o código achar o valor no trecho literal."""
import unittest

from pipeline import curadoria as c


class Portao(unittest.TestCase):
    def test_formas_brasileiras(self):
        self.assertTrue(c.valor_no_trecho(2857449, "Outros recebíveis 2.857.449 mil"))
        self.assertTrue(c.valor_no_trecho(3.1, "Carteira de Crédito 3% e 6% | 3,1%"))
        self.assertTrue(c.valor_no_trecho(20700000000, "Lucro R$ 20,7 bi"))
        self.assertFalse(c.valor_no_trecho(3.1, "Carteira 13,1%"))
        self.assertFalse(c.valor_no_trecho(7.6, "trecho resumido …"))
        self.assertFalse(c.valor_no_trecho(None, "qualquer"))

    def test_nenhuma_aprovacao_nova_sem_trecho_literal(self):
        self.assertEqual(c.violacoes_novas(), [])

    def test_catraca_do_legado(self):
        # o legado só encolhe: item corrigido (trecho completo) precisa sair da lista
        atuais = {v.split(": valor")[0] for v in c.violacoes()}
        self.assertEqual(c.LEGADO_SEM_TRECHO - atuais, set())


if __name__ == "__main__":
    unittest.main()
