"""Passo de commit da rodada diária da previsão do PLD (.github/workflows/previsao-pld.yml).

De 02 a 18/10/2026, as 84 execuções agendadas emitiram a rodada e falharam no commit: o
módulo reescreve metricas.json e arquivos.json, que a rodada não publica, e o
`git pull --rebase` recusava rodar com esses arquivos alterados ("You have unstaged
changes"). Nenhuma rodada chegou ao main. O teste executa o bloco shell real do passo
contra um repositório temporário com remoto e um commit concorrente no main.
"""
import os
import subprocess
import tempfile
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WF = os.path.join(RAIZ, ".github", "workflows", "previsao-pld.yml")
PASSO = "      - name: Commit do arquivo de emissões (e da gold, se os testes passaram)\n"


def _bloco(testes="success"):
    texto = open(WF, encoding="utf-8").read()
    bloco = texto.split(PASSO, 1)[1].split("\n      - name:", 1)[0]
    corpo = bloco.split("        run: |\n", 1)[1]
    shell = "\n".join(l[10:] if l.startswith("          ") else l for l in corpo.splitlines())
    return shell.replace("${{ steps.testes.outcome }}", testes)


def _git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, text=True, capture_output=True).stdout


class CommitDaRodada(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        t = self.tmp.name
        self.remoto, self.runner, self.outro = (os.path.join(t, n) for n in ("remoto.git", "runner", "outro"))
        subprocess.run(["git", "init", "--bare", "-b", "main", self.remoto], check=True, capture_output=True)
        subprocess.run(["git", "clone", "-q", self.remoto, self.runner], check=True, capture_output=True)
        for cwd in (self.runner,):
            _git(cwd, "config", "user.name", "teste")
            _git(cwd, "config", "user.email", "teste@exemplo")
        os.makedirs(os.path.join(self.runner, "pipeline/energia/previsoes/emissoes"))
        os.makedirs(os.path.join(self.runner, "public/energia/gold"))
        os.makedirs(os.path.join(self.runner, "public/energia/series"))
        for rel, conteudo in (("public/energia/gold/metricas.json", "{}\n"), ("public/energia/gold/arquivos.json", "{}\n"),
                              ("public/energia/gold/previsoes.json", "{}\n"), ("public/energia/gold/modelos.json", "{}\n"),
                              ("public/energia/gold/previsoes_desempenho.json", "{}\n"),
                              ("public/energia/series/previsoes_apuracao.csv", "a\n"), ("README", "x\n")):
            open(os.path.join(self.runner, rel), "w").write(conteudo)
        _git(self.runner, "add", "-A")
        _git(self.runner, "commit", "-qm", "base")
        _git(self.runner, "push", "-q", "origin", "main")
        # commit concorrente no main durante a rodada (a coleta noturna, por exemplo)
        subprocess.run(["git", "clone", "-q", self.remoto, self.outro], check=True, capture_output=True)
        _git(self.outro, "config", "user.name", "outro")
        _git(self.outro, "config", "user.email", "outro@exemplo")
        open(os.path.join(self.outro, "README"), "w").write("y\n")
        _git(self.outro, "commit", "-qam", "concorrente")
        _git(self.outro, "push", "-q", "origin", "main")
        # o que a rodada produz: a emissão (publicada), a gold (publicada se os testes passaram)
        # e derivados que ela não publica, alterados e novos
        open(os.path.join(self.runner, "pipeline/energia/previsoes/emissoes/2026-10.jsonl"), "w").write('{"origem": "2026-10-19"}\n')
        open(os.path.join(self.runner, "public/energia/gold/previsoes.json"), "w").write('{"rodada": 1}\n')
        open(os.path.join(self.runner, "public/energia/gold/metricas.json"), "w").write('{"reescrito": true}\n')
        open(os.path.join(self.runner, "public/energia/gold/arquivos.json"), "w").write('{"reescrito": true}\n')
        open(os.path.join(self.runner, "public/energia/gold/manifesto.json"), "w").write('{"novo": true}\n')
        # sleep falso: as retentativas não esperam de verdade no teste
        self.bin = os.path.join(t, "bin")
        os.makedirs(self.bin)
        with open(os.path.join(self.bin, "sleep"), "w") as f:
            f.write("#!/bin/sh\nexit 0\n")
        os.chmod(os.path.join(self.bin, "sleep"), 0o755)

    def _roda(self, testes="success"):
        env = {**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "MODO": "agendada"}
        return subprocess.run(["bash", "-e", "-c", _bloco(testes)], cwd=self.runner, env=env, text=True,
                              capture_output=True, timeout=60)

    def _arquivos_no_main(self):
        _git(self.runner, "fetch", "-q", "origin")
        return set(_git(self.runner, "ls-tree", "-r", "--name-only", "origin/main").split())

    def test_rodada_chega_ao_main_com_derivados_alterados_e_commit_concorrente(self):
        p = self._roda()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        log = _git(self.runner, "log", "--format=%s", "origin/main")
        self.assertIn("Previsão do PLD: rodada de", log.splitlines()[0])
        self.assertIn("concorrente", log)
        self.assertIn("pipeline/energia/previsoes/emissoes/2026-10.jsonl", self._arquivos_no_main())
        self.assertEqual(_git(self.runner, "show", "origin/main:public/energia/gold/previsoes.json"), '{"rodada": 1}\n')
        # derivados que a rodada não publica não entram no main (aqui o manifesto não pode ser refeito: não há pipeline)
        self.assertEqual(_git(self.runner, "show", "origin/main:public/energia/gold/metricas.json"), "{}\n")
        self.assertNotIn("public/energia/gold/manifesto.json", self._arquivos_no_main())

    def _python_falso(self):
        """python3 falso: grava o manifesto como escreve_manifesto faria, sobre a árvore já rebaseada."""
        with open(os.path.join(self.bin, "python3"), "w") as f:
            f.write('#!/bin/sh\nprintf \'{"refeito": true}\\n\' > public/energia/gold/manifesto.json\n')
        os.chmod(os.path.join(self.bin, "python3"), 0o755)

    def test_manifesto_refeito_depois_do_rebase_acompanha_a_gold(self):
        # rodada de 19/10/2026: a gold entrou no main sem o manifesto e o sha256 dela divergiu do publicado
        self._python_falso()
        p = self._roda()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        log = _git(self.runner, "log", "--format=%s", "origin/main").splitlines()
        self.assertEqual(log[0], "Setor Elétrico: manifesto acompanha a rodada da previsão do PLD")
        self.assertIn("Previsão do PLD: rodada de", log[1])
        self.assertEqual(_git(self.runner, "show", "origin/main:public/energia/gold/manifesto.json"), '{"refeito": true}\n')
        self.assertEqual(_git(self.runner, "show", "origin/main:public/energia/gold/metricas.json"), "{}\n")

    def test_sem_gold_publicada_o_manifesto_nao_muda(self):
        self._python_falso()
        p = self._roda(testes="failure")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertNotIn("public/energia/gold/manifesto.json", self._arquivos_no_main())

    def test_testes_reprovados_registram_so_a_emissao(self):
        p = self._roda(testes="failure")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("pipeline/energia/previsoes/emissoes/2026-10.jsonl", self._arquivos_no_main())
        self.assertEqual(_git(self.runner, "show", "origin/main:public/energia/gold/previsoes.json"), "{}\n")


if __name__ == "__main__":
    unittest.main()


class DisparoExterno(unittest.TestCase):
    """O cron do GitHub disparou entre 09h48 e 11h08 de Brasília em 18/10/2026, depois do prazo das 08h00.
    Um agendador externo chama o workflow_dispatch no horário com agendador=externo: a rodada do próprio
    dia conta como agendada e o gatilho fica no arquivo; disparo à mão ou com origem retroativa é manual."""

    def setUp(self):
        self.texto = open(WF, encoding="utf-8").read()

    def _env(self, nome):
        return next(l.split(": ", 1)[1] for l in self.texto.splitlines() if l.strip().startswith(f"{nome}: ${{{{"))

    @staticmethod
    def _avalia(expr, evento, agendador="manual", origem=""):
        """Avalia a expressão do Actions (só &&, || e ==) com os valores dados."""
        corpo = expr.strip()[3:-2].strip()
        py = (corpo.replace("github.event_name", repr(evento)).replace("inputs.agendador", repr(agendador))
              .replace("inputs.origem", repr(origem)).replace("&&", " and ").replace("||", " or "))
        return eval(py, {"__builtins__": {}})  # noqa: S307 (expressão do próprio workflow, com literais)

    def test_modo_e_gatilho_por_tipo_de_disparo(self):
        modo, gatilho = self._env("MODO"), self._env("GATILHO")
        casos = [(("schedule",), "agendada", "cron do GitHub"),
                 (("workflow_dispatch", "externo", ""), "agendada", "agendador externo"),
                 (("workflow_dispatch", "manual", ""), "manual", "manual"),
                 (("workflow_dispatch", "externo", "2026-10-10"), "manual", "manual")]
        for args, m, g in casos:
            self.assertEqual(self._avalia(modo, *args), m, args)
            self.assertEqual(self._avalia(gatilho, *args), g, args)

    def test_entrada_agendador_e_gatilho_chegam_a_emissao(self):
        self.assertRegex(self.texto, r'agendador:\n(?:.*\n)*?\s+options: \["manual", "externo"\]')
        self.assertEqual(self.texto.count('--gatilho "$GATILHO" --acionado-por "$ACIONADO_POR"'), 2)
        self.assertIn("ACIONADO_POR: ${{ github.triggering_actor }}", self.texto)
