"""Cópia durável do estado do crédito (scripts/estado_duravel.sh).

O cache do repositório (10 GB) despejou o estado do crédito em 03/10 e 15/10/2026,
quando o job de energia gravou uma cópia nova de ~7,2 GB. A release pipeline-estado
guarda o mesmo estado fora do cache. Aqui o gh e o zstd são trocados por
equivalentes locais: o teste cobre o empacotamento, as partes, o manifesto e a
recusa de cópia incompleta, não a API do GitHub.
"""
import hashlib
import os
import shutil
import subprocess
import tempfile
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT = os.path.join(RAIZ, "scripts", "estado_duravel.sh")

GH_FALSO = r"""#!/usr/bin/env bash
[ "$1" = release ] || exit 9; sub="$2"; shift 2; tag="$1"; shift
D="$FAKE_REL/$tag"
case "$sub" in
  view) [ -d "$D" ] || exit 1; if [ "${3:-}" = "--json" ]; then ls "$D"; fi ;;
  create) mkdir -p "$D" ;;
  upload) if [ -n "${FAKE_FALHA:-}" ] && [[ "$1" == *"$FAKE_FALHA"* ]]; then exit 1; fi
          [ -e "$D/$(basename "$1")" ] && exit 3; cp "$1" "$D/" ;;
  download) pat=""; dir=""; while [ $# -gt 0 ]; do case "$1" in --pattern) pat="$2"; shift 2;; --dir) dir="$2"; shift 2;; *) shift;; esac; done
            [ -f "$D/$pat" ] || exit 1; cp "$D/$pat" "$dir/" ;;
  delete-asset) rm "$D/$1" ;;
esac
"""

ZSTD_FALSO = r"""#!/usr/bin/env bash
out=""; dec=0
while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; -d) dec=1; shift;; *) shift;; esac; done
if [ $dec = 1 ]; then gzip -dc; else gzip -c > "$out"; fi
"""


def _sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


@unittest.skipUnless(shutil.which("bash") and shutil.which("split") and shutil.which("sha256sum"), "requer bash e coreutils")
class EstadoDuravel(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.bin = os.path.join(self.dir, "bin")
        self.rel = os.path.join(self.dir, "rel")
        self.w = os.path.join(self.dir, "w")
        os.makedirs(self.bin)
        for nome, corpo in (("gh", GH_FALSO), ("zstd", ZSTD_FALSO)):
            p = os.path.join(self.bin, nome)
            open(p, "w").write(corpo)
            os.chmod(p, 0o755)
        os.makedirs(os.path.join(self.w, "data", "silver"))
        os.makedirs(os.path.join(self.w, "data", "bronze", "fonte"))
        self.env = dict(os.environ, PATH=self.bin + os.pathsep + os.environ["PATH"], FAKE_REL=self.rel,
                        GITHUB_REPOSITORY="o/r", ESTADO_TMP=os.path.join(self.dir, "tmp"), ESTADO_TAMANHO_PARTE="1m")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _roda(self, cmd):
        return subprocess.run(["bash", SCRIPT, cmd], cwd=self.w, env=self.env, capture_output=True, text=True)

    def _silver(self, n):
        p = os.path.join(self.w, "data", "silver", "observatorio.db")
        open(p, "wb").write(os.urandom(n))
        return _sha(p)

    def _ativos(self):
        return sorted(os.listdir(os.path.join(self.rel, "pipeline-estado")))

    def _salvar(self, geracao, falha=None):
        env = dict(self.env, ESTADO_GERACAO=geracao)
        if falha:
            env["FAKE_FALHA"] = falha
        return subprocess.run(["bash", SCRIPT, "salvar"], cwd=self.w, env=env, capture_output=True, text=True)

    def test_salva_em_partes_e_restaura_identico(self):
        open(os.path.join(self.w, "data", "bronze", "fonte", "a.json"), "w").write("{}")
        sha = self._silver(2_500_000)
        r = self._salvar("20261016000000")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._ativos(), ["pipeline-estado.20261016000000.manifesto",
                                          "pipeline-estado.20261016000000.tar.zst.00",
                                          "pipeline-estado.20261016000000.tar.zst.01",
                                          "pipeline-estado.20261016000000.tar.zst.02"])
        shutil.rmtree(os.path.join(self.w, "data"))
        r = self._roda("restaurar")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(_sha(os.path.join(self.w, "data", "silver", "observatorio.db")), sha)
        self.assertTrue(os.path.exists(os.path.join(self.w, "data", "bronze", "fonte", "a.json")))

    def test_geracao_nova_inteira_apaga_a_anterior(self):
        self._silver(2_500_000)
        self._salvar("20261016000000")
        sha = self._silver(500_000)
        r = self._salvar("20261017000000")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self._ativos(), ["pipeline-estado.20261017000000.manifesto",
                                          "pipeline-estado.20261017000000.tar.zst.00"])
        shutil.rmtree(os.path.join(self.w, "data"))
        self._roda("restaurar")
        self.assertEqual(_sha(os.path.join(self.w, "data", "silver", "observatorio.db")), sha)

    def test_envio_interrompido_preserva_a_copia_anterior(self):
        sha = self._silver(1_500_000)
        self._salvar("20261016000000")
        self._silver(2_500_000)
        r = self._salvar("20261017000000", falha="20261017000000.tar.zst.01")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("pipeline-estado.20261016000000.manifesto", self._ativos())
        self.assertNotIn("pipeline-estado.20261017000000.manifesto", self._ativos())
        shutil.rmtree(os.path.join(self.w, "data"))
        r = self._roda("restaurar")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(_sha(os.path.join(self.w, "data", "silver", "observatorio.db")), sha)

    def test_geracao_corrompida_cai_para_a_anterior(self):
        sha = self._silver(1_500_000)
        self._salvar("20261016000000")
        # a anterior só sai depois do manifesto novo; aqui ela é recolocada para simular
        # duas gerações e a mais nova corrompida
        guardados = {n: open(os.path.join(self.rel, "pipeline-estado", n), "rb").read() for n in self._ativos()}
        self._silver(500_000)
        self._salvar("20261017000000")
        for n, corpo in guardados.items():
            open(os.path.join(self.rel, "pipeline-estado", n), "wb").write(corpo)
        with open(os.path.join(self.rel, "pipeline-estado", "pipeline-estado.20261017000000.tar.zst.00"), "ab") as f:
            f.write(b"lixo")
        shutil.rmtree(os.path.join(self.w, "data"))
        r = self._roda("restaurar")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(_sha(os.path.join(self.w, "data", "silver", "observatorio.db")), sha)

    def test_unica_copia_corrompida_ou_release_ausente_falha_sem_extrair(self):
        self._silver(1_500_000)
        self._salvar("20261016000000")
        with open(os.path.join(self.rel, "pipeline-estado", "pipeline-estado.20261016000000.tar.zst.00"), "ab") as f:
            f.write(b"lixo")
        shutil.rmtree(os.path.join(self.w, "data"))
        self.assertNotEqual(self._roda("restaurar").returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.w, "data", "silver")))
        shutil.rmtree(self.rel)
        self.assertNotEqual(self._roda("restaurar").returncode, 0)


class WorkflowUsaCopiaDuravel(unittest.TestCase):
    def test_restaura_antes_de_semear_e_salva_depois_do_pipeline(self):
        w = open(os.path.join(RAIZ, ".github", "workflows", "atualizar-dados.yml"), encoding="utf-8").read()
        i_cache = w.index("id: cache")
        i_rest = w.index("scripts/estado_duravel.sh restaurar")
        i_semear = w.index("Semear histórico na primeira execução")
        i_pipe = w.index("id: pipeline")
        i_salvar = w.index("scripts/estado_duravel.sh salvar")
        self.assertLess(i_cache, i_rest)
        self.assertLess(i_rest, i_semear)
        self.assertLess(i_pipe, i_salvar)
        self.assertIn("if: steps.cache.outputs.cache-matched-key == ''", w[i_cache:i_semear])
        self.assertIn("if: steps.pipeline.outcome == 'success' && github.ref == 'refs/heads/main'", w[i_pipe:i_salvar])


if __name__ == "__main__":
    unittest.main()
