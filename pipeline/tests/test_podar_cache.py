"""Poda dos caches de estado (scripts/podar_cache.sh) e onde os workflows a chamam.

O cache do repositório tem limite de 10 GB. Uma cópia do estado da energia tem ~7,2 GB
(15/10/2026); a energia e a previsão do PLD gravavam a cópia nova sem apagar a anterior,
o total passava do limite e o GitHub despejava o estado do crédito (03/10 e 15/10/2026).
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT = os.path.join(RAIZ, "scripts", "podar_cache.sh")
WF = os.path.join(RAIZ, ".github", "workflows")

# gh falso: lista os caches de $FAKE_CACHES filtrando ramo e prefixo, mais recentes
# primeiro; delete registra o id em $FAKE_LOG
GH_FALSO = r"""#!/usr/bin/env python3
import json, os, sys
a = sys.argv[1:]
if a[:2] == ["cache", "list"]:
    ref = a[a.index("--ref") + 1]; chave = a[a.index("--key") + 1]
    cs = [c for c in json.load(open(os.environ["FAKE_CACHES"])) if c["ref"] == ref and c["key"].startswith(chave)]
    cs.sort(key=lambda c: c["createdAt"], reverse=True)
    print(json.dumps([{"id": c["id"], "key": c["key"], "sizeInBytes": c["sizeInBytes"]} for c in cs]))
elif a[:2] == ["cache", "delete"]:
    open(os.environ["FAKE_LOG"], "a").write(a[2] + "\n")
else:
    sys.exit(9)
"""

CACHES = [
    {"id": 1, "key": "energia-estado-100", "ref": "refs/heads/main", "createdAt": "2026-10-14T04:00:00Z", "sizeInBytes": 7_499_419_127},
    {"id": 2, "key": "energia-estado-previsao-110", "ref": "refs/heads/main", "createdAt": "2026-10-14T10:00:00Z", "sizeInBytes": 7_500_000_000},
    {"id": 3, "key": "energia-estado-200", "ref": "refs/pull/9/merge", "createdAt": "2026-10-15T04:00:00Z", "sizeInBytes": 7_000_000_000},
    {"id": 4, "key": "pipeline-estado-300", "ref": "refs/heads/main", "createdAt": "2026-10-14T16:00:00Z", "sizeInBytes": 924_427_809},
    {"id": 5, "key": "pipeline-estado-400", "ref": "refs/heads/main", "createdAt": "2026-10-15T16:00:00Z", "sizeInBytes": 981_993_902},
]


@unittest.skipUnless(shutil.which("bash") and shutil.which("jq"), "requer bash e jq")
class PodarCache(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.dir, "bin"))
        gh = os.path.join(self.dir, "bin", "gh")
        open(gh, "w").write(GH_FALSO)
        os.chmod(gh, 0o755)
        caches = os.path.join(self.dir, "caches.json")
        json.dump(CACHES, open(caches, "w"))
        self.log = os.path.join(self.dir, "apagados")
        self.env = dict(os.environ, PATH=os.path.join(self.dir, "bin") + os.pathsep + os.environ["PATH"],
                        FAKE_CACHES=caches, FAKE_LOG=self.log, GITHUB_REPOSITORY="o/r", GITHUB_REF="refs/heads/main")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def _poda(self, prefixo, manter):
        r = subprocess.run(["bash", SCRIPT, prefixo, str(manter)], env=self.env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        apagados = open(self.log).read().split() if os.path.exists(self.log) else []
        return sorted(int(x) for x in apagados), r.stdout

    def test_energia_antes_de_gravar_apaga_todas_as_copias_do_ramo(self):
        apagados, saida = self._poda("energia-estado-", 0)
        # a cópia da previsão também sai; o cache do ramo de PR fica
        self.assertEqual(apagados, [1, 2])
        self.assertIn("7152 MB", saida)

    def test_credito_mantem_so_a_mais_recente(self):
        apagados, _ = self._poda("pipeline-estado-", 1)
        self.assertEqual(apagados, [4])

    def test_nada_a_podar(self):
        apagados, _ = self._poda("pipeline-estado-", 5)
        self.assertEqual(apagados, [])


def _passos(nome):
    """Lista (nome do passo, bloco de texto) do workflow, na ordem."""
    txt = open(os.path.join(WF, nome), encoding="utf-8").read()
    partes = re.split(r"\n      - name: ", txt)
    return txt, [(p.split("\n", 1)[0], p) for p in partes[1:]]


class WorkflowsPodamAntesDeGravar(unittest.TestCase):
    def _ordem(self, nome, guardar):
        txt, passos = _passos(nome)
        nomes = [n for n, _ in passos]
        i_poda = nomes.index("Liberar a cópia anterior do estado antes de gravar")
        self.assertEqual(nomes[i_poda + 1], guardar, "a poda vem imediatamente antes de gravar")
        bloco = passos[i_poda][1]
        self.assertIn("steps.restaurar.outputs.cache-matched-key != ''", bloco,
                      "só poda quando o estado completo foi restaurado")
        self.assertIn("scripts/podar_cache.sh energia-estado- 0", bloco)
        self.assertIn("actions: write", txt)

    def test_energia(self):
        self._ordem("atualizar-energia.yml", "Guardar estado")

    def test_previsao_pld(self):
        self._ordem("previsao-pld.yml", "Guardar estado (vintages coletadas antes do corte)")

    def test_credito_mantem_uma_copia(self):
        txt, passos = _passos("atualizar-dados.yml")
        nomes = [n for n, _ in passos]
        self.assertLess(nomes.index("Guardar estado do pipeline"), nomes.index("Podar caches antigos do estado"))
        self.assertIn("scripts/podar_cache.sh pipeline-estado- 1", txt)


if __name__ == "__main__":
    unittest.main()
