"""O passo real do Actions preserva falhas do pipeline mesmo com tee (sem rede)."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from pipeline.tests.test_energia_meta import passos


class TestWorkflowColeta(unittest.TestCase):
    def executar(self, sem_coleta, codigo):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            script = raiz / "pipeline/energia/run.py"
            script.parent.mkdir(parents=True)
            script.write_text(
                "import sys\n"
                "print('argumentos=' + ','.join(sys.argv[1:]))\n"
                "print('REGRESSOES_ENERGIA=[]')\n"
                f"sys.exit({codigo})\n", encoding="utf-8")
            output = raiz / "output"
            _, shell = passos()["Executar pipeline de energia"]
            # bash -e é o shell implícito do Actions: sem pipefail externo ao passo.
            resultado = subprocess.run(
                ["bash", "-e", "-c", shell], cwd=raiz,
                env={**os.environ, "SEM_COLETA": sem_coleta, "GITHUB_OUTPUT": str(output)},
                capture_output=True, text=True, timeout=10)
            return (resultado.returncode, (raiz / "energia.log").read_text(),
                    output.read_text() if output.exists() else "")

    def test_falha_nao_vira_sucesso_do_tee(self):
        for modo in ("true", "false", ""):
            with self.subTest(sem_coleta=modo):
                codigo, log, output = self.executar(modo, 7)
                self.assertEqual(codigo, 7)
                self.assertIn("REGRESSOES_ENERGIA=[]", log)
                self.assertEqual(output, "", "não anuncia conclusão depois da falha")

    def test_sucesso_preserva_log_e_saida_nos_dois_modos(self):
        for modo in ("true", "false", ""):
            with self.subTest(sem_coleta=modo):
                codigo, log, output = self.executar(modo, 0)
                self.assertEqual(codigo, 0)
                self.assertIn("argumentos=" + ("--sem-coleta" if modo == "true" else "") + "\n", log)
                self.assertEqual(output, "regressoes=[]\n")


if __name__ == "__main__":
    unittest.main()
