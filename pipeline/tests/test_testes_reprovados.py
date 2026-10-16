"""Texto da issue de retenção (scripts/testes_reprovados.py).

16/10/2026: o vitest foi abortado com código 134 (falta de memória, depois de um
ENOBUFS no guarda de worktree) sem reprovar teste algum, as duas suítes Python
passaram (pipeline=0 pesquisa=0) e a issue disse "a reprovação veio das suítes
Python". A causa certa estava só no log.
"""
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_spec = importlib.util.spec_from_file_location("testes_reprovados", os.path.join(RAIZ, "scripts", "testes_reprovados.py"))
tr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tr)

SEM_REPROVACAO = {"testResults": []}
COM_REPROVACAO = {"testResults": [{"name": os.path.join(os.getcwd(), "src/tests/rural-data.test.ts"), "status": "failed",
                                   "assertionResults": [{"status": "failed", "fullName": "rural.json UFs somam 100%",
                                                         "failureMessages": ["AssertionError: expected 0 to be 27\n  at ..."]}]}]}

LOG_UNITTEST = """\
.....F..E
======================================================================
FAIL: test_janela (pipeline.tests.test_sicor_rural.OrdemDaColeta.test_janela)
----------------------------------------------------------------------
AssertionError: 1 != 2
======================================================================
ERROR: test_x (pipeline.tests.test_outro.Caso.test_x)
----------------------------------------------------------------------
Ran 9 tests in 0.1s

FAILED (failures=1, errors=1)
"""


class TextoDaIssue(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def _arq(self, nome, conteudo):
        p = os.path.join(self.dir, nome)
        with open(p, "w", encoding="utf-8") as f:
            f.write(conteudo if isinstance(conteudo, str) else json.dumps(conteudo))
        return p

    def _roda(self, *args):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            tr.main(*args)
        return saida.getvalue()

    def test_vitest_abortado_sem_reprovar_teste_nao_culpa_o_python(self):
        rel = self._arq("v.json", SEM_REPROVACAO)
        cod = self._arq("c.txt", "vitest=134 pipeline=0 pesquisa=0\n")
        texto = self._roda(rel, cod)
        self.assertIn("código 134", texto)
        self.assertIn("falta de memória", texto)
        self.assertIn("não do conteúdo", texto)
        self.assertNotIn("Python", texto)

    def test_testes_do_vitest_reprovados_seguem_listados(self):
        rel = self._arq("v.json", COM_REPROVACAO)
        cod = self._arq("c.txt", "vitest=1 pipeline=0 pesquisa=0\n")
        texto = self._roda(rel, cod)
        self.assertIn("rural.json UFs somam 100%", texto)
        self.assertIn("expected 0 to be 27", texto)
        self.assertNotIn("sem reprovar nenhum teste", texto, "com teste reprovado, o processo não é o culpado")

    def test_python_reprovado_lista_os_testes(self):
        rel = self._arq("v.json", SEM_REPROVACAO)
        cod = self._arq("c.txt", "vitest=0 pipeline=1 pesquisa=0\n")
        log = self._arq("p.log", LOG_UNITTEST)
        texto = self._roda(rel, cod, log)
        self.assertIn("suíte Python `pipeline` reprovou (código 1)", texto)
        self.assertIn("FAIL: test_janela (pipeline.tests.test_sicor_rural.OrdemDaColeta.test_janela)", texto)
        self.assertIn("ERROR: test_x", texto)
        self.assertNotIn("vitest terminou", texto)

    def test_tudo_zero_nao_atribui_causa(self):
        rel = self._arq("v.json", SEM_REPROVACAO)
        cod = self._arq("c.txt", "vitest=0 pipeline=0 pesquisa=0\n")
        texto = self._roda(rel, cod)
        self.assertIn("todos zero", texto)
        self.assertNotIn("Python", texto)

    def test_chamada_antiga_sem_codigos_nao_culpa_ninguem(self):
        rel = self._arq("v.json", SEM_REPROVACAO)
        texto = self._roda(rel)
        self.assertNotIn("veio das suítes Python", texto)
        self.assertIn("sem códigos de saída", texto)

    def test_relatorio_ausente(self):
        texto = self._roda(os.path.join(self.dir, "nao-existe.json"))
        self.assertIn("ausente ou ilegível", texto)

    def test_vitest_ausente_mas_codigo_registra_o_aborto(self):
        # o aborto pode impedir o relatório JSON: o código ainda explica
        cod = self._arq("c.txt", "vitest=137 pipeline=0 pesquisa=0\n")
        texto = self._roda(os.path.join(self.dir, "nao-existe.json"), cod)
        self.assertIn("código 137", texto)
        self.assertIn("SIGKILL", texto)

    def test_codigos(self):
        self.assertEqual(tr.codigos("vitest=134 pipeline=0 pesquisa=1\nlixo"), {"vitest": 134, "pipeline": 0, "pesquisa": 1})
        self.assertEqual(tr.codigos(""), {})


class WorkflowEntregaOsCodigos(unittest.TestCase):
    def test_o_passo_grava_codigos_e_logs_e_a_retencao_os_usa(self):
        w = open(os.path.join(RAIZ, ".github", "workflows", "atualizar-dados.yml"), encoding="utf-8").read()
        self.assertIn('echo "vitest=$V pipeline=$P pesquisa=$Q" | tee testes-codigos.txt', w)
        self.assertIn("P=${PIPESTATUS[0]}", w)
        self.assertIn("Q=${PIPESTATUS[0]}", w)
        self.assertIn("scripts/testes_reprovados.py vitest-resultado.json testes-codigos.txt pipeline-testes.log pesquisa-testes.log", w)
        for nome in ("testes-codigos.txt", "pipeline-testes.log", "pesquisa-testes.log"):
            self.assertIn("/" + nome, open(os.path.join(RAIZ, ".gitignore"), encoding="utf-8").read(), nome)


if __name__ == "__main__":
    unittest.main()
