"""Marca de retrato (pipeline/tests/retrato.py): com TESTES_SEM_RETRATO=1 o teste é pulado com o motivo; sem a
variável ele roda; a marca fica no teste para o executor à parte (scripts/testes_retrato.py) escolhê-lo."""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.tests import retrato as r  # noqa: E402
from scripts import testes_retrato as executor  # noqa: E402


def _caso(marcar):
    class Caso(unittest.TestCase):
        @marcar
        def test_numero_do_retrato(self):
            self.assertEqual(1, 2)

        def test_regra(self):
            self.assertEqual(1, 1)
    return Caso


class MarcaDeRetrato(unittest.TestCase):
    def _rodar(self, caso):
        res = unittest.TestResult()
        unittest.TestLoader().loadTestsFromTestCase(caso).run(res)
        return res

    def test_pulado_na_barreira_com_o_motivo(self):
        with mock.patch.dict(os.environ, {r.VARIAVEL: "1"}):
            caso = _caso(r.retrato("SIGA de 30/09/2026"))
        res = self._rodar(caso)
        self.assertEqual((res.testsRun, len(res.failures)), (2, 0))
        self.assertEqual([m for _, m in res.skipped], ["retrato (SIGA de 30/09/2026): roda à parte, em npm run testes:retrato"])

    def test_roda_sem_a_variavel_e_carrega_a_marca(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(r.VARIAVEL, None)
            caso = _caso(r.retrato("SIGA de 30/09/2026"))
        res = self._rodar(caso)
        self.assertEqual((res.testsRun, len(res.failures), len(res.skipped)), (2, 1, 0))
        testes = list(unittest.TestLoader().loadTestsFromTestCase(caso))
        self.assertEqual({t._testMethodName: executor._de_que(t) for t in testes},
                         {"test_numero_do_retrato": "SIGA de 30/09/2026", "test_regra": None})


if __name__ == "__main__":
    unittest.main()
