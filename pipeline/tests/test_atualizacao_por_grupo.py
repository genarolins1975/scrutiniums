"""Motor da atualização agendada por grupo (scripts/atualizacao_por_grupo.py).

Cada teste monta um repositório Git de verdade com um remoto nu, um domínio de brinquedo (dois
grupos de fontes, uma gold reconstruída do seed e um teste que reprova o valor "ruim") e roda o
ciclo e a publicação como o workflow roda. Sem rede.
"""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import atualizacao_por_grupo as A  # noqa: E402

COLETAR = textwrap.dedent("""
    import datetime, json, os, sys
    grupo = sys.argv[1]
    fonte = open(os.path.join(os.environ["FONTE_DIR"], grupo + ".txt")).read().strip()
    if fonte == "FALHA":
        print("fonte fora do ar"); sys.exit(2)
    os.makedirs("seed", exist_ok=True)
    json.dump({"valor": fonte, "capturado_em": datetime.datetime.now().isoformat()}, open(f"seed/{grupo}.json", "w"))
""")
CONSTRUIR = textwrap.dedent("""
    import datetime, glob, json, os
    os.makedirs("gold", exist_ok=True)
    dados = {os.path.basename(p)[:-5]: json.load(open(p))["valor"] for p in sorted(glob.glob("seed/*.json"))}
    json.dump({"dados": dados, "gerado_em": datetime.datetime.now().isoformat()}, open("gold/out.json", "w"), sort_keys=True)
""")
CONFERIR = textwrap.dedent("""
    import json, sys
    d = json.load(open("gold/out.json"))["dados"]
    ruins = [k for k, v in d.items() if v == "ruim"]
    if ruins:
        print("valor reprovado em", ruins); sys.exit(1)
""")

CONFIG = {
    "dominio": "brinquedo",
    "titulo": "Domínio de teste",
    "codigo": ["construir.py"],
    "reconstruir": [[sys.executable, "construir.py"]],
    "saidas": ["gold"],
    "sinal_de_mudanca": [{"arquivo": "gold/out.json", "json_sem": ["gerado_em"]}],
    "testes": [{"nome": "conteúdo", "comando": [sys.executable, "conferir.py"]}],
    "grupos": [
        {"id": "a", "nome": "Fonte A", "coleta": [[sys.executable, "coletar.py", "a"]], "caminhos": ["seed/a.json"]},
        {"id": "b", "nome": "Fonte B", "coleta": [[sys.executable, "coletar.py", "b"]], "caminhos": ["seed/b.json"]},
    ],
}


def git(cwd, *args):
    r = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


class Ambiente:
    def __init__(self, tmp: Path):
        self.tmp = tmp
        self.remoto = tmp / "remoto.git"
        self.repo = tmp / "repo"
        self.fontes = tmp / "fontes"
        self.fontes.mkdir()
        git(tmp, "init", "-q", "--bare", "-b", "main", str(self.remoto))
        git(tmp, "init", "-q", "-b", "main", str(self.repo))
        for k, v in (("user.name", "teste"), ("user.email", "teste@exemplo"), ("commit.gpgsign", "false")):
            git(self.repo, "config", k, v)
        (self.repo / "coletar.py").write_text(COLETAR)
        (self.repo / "construir.py").write_text(CONSTRUIR)
        (self.repo / "conferir.py").write_text(CONFERIR)
        (self.repo / ".gitignore").write_text(".atualizacao/\n")
        self.fonte("a", "1")
        self.fonte("b", "1")
        subprocess.run([sys.executable, "coletar.py", "a"], cwd=self.repo, env=self.env(), check=True)
        subprocess.run([sys.executable, "coletar.py", "b"], cwd=self.repo, env=self.env(), check=True)
        subprocess.run([sys.executable, "construir.py"], cwd=self.repo, check=True)
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "inicial")
        git(self.repo, "remote", "add", "origin", str(self.remoto))
        git(self.repo, "push", "-q", "origin", "main")
        self.cfg = json.loads(json.dumps(CONFIG))

    def env(self):
        return dict(os.environ, FONTE_DIR=str(self.fontes))

    def fonte(self, grupo, valor):
        (self.fontes / f"{grupo}.txt").write_text(valor)

    def ciclo(self, **kw):
        os.environ["FONTE_DIR"] = str(self.fontes)
        with contextlib.redirect_stdout(io.StringIO()):
            codigo = A.ciclo(A.carregar_config_dict(self.cfg), self.repo, **kw)
        return codigo, json.loads((self.repo / ".atualizacao/brinquedo/resultado.json").read_text())

    def publicar(self):
        with contextlib.redirect_stdout(io.StringIO()) as saida:
            codigo = A.publicar(A.carregar_config_dict(self.cfg), self.repo, "main", espera=0)
        return codigo, saida.getvalue()

    def gold(self, ref=None):
        if ref:
            return json.loads(git(self.repo, "show", f"{ref}:gold/out.json"))["dados"]
        return json.loads((self.repo / "gold/out.json").read_text())["dados"]

    def situacoes(self, r):
        return {g["id"]: g["situacao"] for g in r["grupos"]}


class CicloPorGrupo(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.amb = Ambiente(Path(self._tmp.name))

    def tearDown(self):
        os.environ.pop("FONTE_DIR", None)
        self._tmp.cleanup()

    def test_fonte_igual_nao_gera_mudanca_nem_publicacao(self):
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 0)
        # o coletor regrava a data de captura: o seed muda, o dado não
        self.assertEqual(self.amb.situacoes(r), {"a": A.SEM_MUDANCA_DADO, "b": A.SEM_MUDANCA_DADO})
        self.assertFalse(r["publicavel"])
        self.assertEqual(git(self.amb.repo, "status", "--porcelain"), "")

    def test_grupo_reprovado_e_retido_e_o_aprovado_publica(self):
        self.amb.fonte("a", "2")
        self.amb.fonte("b", "ruim")
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 1)
        self.assertEqual(self.amb.situacoes(r), {"a": A.PUBLICADO, "b": A.RETIDO_TESTES})
        self.assertTrue(r["publicavel"])
        self.assertEqual(self.amb.gold(), {"a": "2", "b": "1"})
        retido = next(g for g in r["grupos"] if g["id"] == "b")
        self.assertIn("valor reprovado", retido["reprovados"][0]["saida"])
        relatorio = (self.amb.repo / ".atualizacao/brinquedo/relatorio.md").read_text()
        self.assertIn("Fonte B", relatorio)
        self.assertIn("testes reprovaram", relatorio)
        self.assertIn("Publicados nesta execução: Fonte A", relatorio)
        codigo, _ = self.amb.publicar()
        self.assertEqual(codigo, 0)
        git(self.amb.repo, "fetch", "-q", "origin")
        self.assertEqual(self.amb.gold("origin/main"), {"a": "2", "b": "1"})
        self.assertEqual(json.loads(git(self.amb.repo, "show", "origin/main:seed/b.json"))["valor"], "1")

    def test_coleta_que_falha_mantem_o_seed_e_nao_bloqueia_o_outro_grupo(self):
        self.amb.fonte("a", "FALHA")
        self.amb.fonte("b", "3")
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 1)
        self.assertEqual(self.amb.situacoes(r), {"a": A.COLETA_FALHOU, "b": A.PUBLICADO})
        self.assertIn("fonte fora do ar", next(g for g in r["grupos"] if g["id"] == "a")["saida"])
        self.assertEqual(self.amb.gold(), {"a": "1", "b": "3"})
        self.assertEqual(json.loads((self.amb.repo / "seed/a.json").read_text())["valor"], "1")

    def test_guarda_reprova_coleta_que_troca_dado_por_erro(self):
        manifesto = self.amb.repo / "seed/manifesto.txt"
        manifesto.write_text(json.dumps({"capturas": {"x": {"arquivos": {"1": {"sha256": "abc"}}}}}))
        git(self.amb.repo, "add", "-A")
        git(self.amb.repo, "commit", "-qm", "manifesto")
        self.amb.cfg["grupos"][0]["caminhos"].append("seed/manifesto.txt")
        self.amb.cfg["grupos"][0]["guardas"] = [{"tipo": "manifesto_sem_erro_novo", "arquivo": "seed/manifesto.txt"}]
        self.amb.cfg["grupos"][0]["coleta"].append([sys.executable, "-c",
            "import json; json.dump({'capturas': {'x': {'arquivos': {'1': {'erro': 'HTTP 500'}}}}}, open('seed/manifesto.txt', 'w'))"])
        self.amb.fonte("a", "9")
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 1)
        self.assertEqual(self.amb.situacoes(r)["a"], A.COLETA_DEGRADADA)
        self.assertIn("HTTP 500", next(g for g in r["grupos"] if g["id"] == "a")["saida"])
        self.assertEqual(json.loads((self.amb.repo / "seed/a.json").read_text())["valor"], "1")

    def test_sem_coleta_publica_a_reproducao_quando_a_gold_nao_se_reproduz(self):
        (self.amb.repo / "gold/out.json").write_text(json.dumps({"dados": {"a": "velho"}, "gerado_em": "x"}))
        git(self.amb.repo, "commit", "-qam", "gold antiga")
        codigo, r = self.amb.ciclo(sem_coleta=True)
        self.assertEqual(codigo, 0)
        self.assertEqual(self.amb.situacoes(r)["reconstrucao"], A.PUBLICADO)
        self.assertEqual(self.amb.gold(), {"a": "1", "b": "1"})

    def test_reproducao_reprovada_retem_todos_os_grupos(self):
        (self.amb.repo / "construir.py").write_text(CONSTRUIR.replace('["valor"]', '["valor"] and "ruim"'))
        git(self.amb.repo, "commit", "-qam", "código quebrado")
        self.amb.fonte("a", "5")
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 1)
        s = self.amb.situacoes(r)
        self.assertEqual(s["reconstrucao"], A.RETIDO_TESTES)
        self.assertEqual(s["a"], A.RETIDO_BASE)
        self.assertFalse(r["publicavel"])
        self.assertEqual(git(self.amb.repo, "status", "--porcelain"), "")

    def test_publicar_recusa_quando_os_dados_mudaram_no_remoto(self):
        self.amb.fonte("a", "2")
        self.amb.ciclo()
        outro = self.amb.tmp / "outro"
        git(self.amb.tmp, "clone", "-q", str(self.amb.remoto), str(outro))
        for k, v in (("user.name", "x"), ("user.email", "x@x")):
            git(outro, "config", k, v)
        (outro / "seed/b.json").write_text(json.dumps({"valor": "7", "capturado_em": "y"}))
        git(outro, "commit", "-qam", "dado mudou no main")
        git(outro, "push", "-q", "origin", "main")
        codigo, saida = self.amb.publicar()
        self.assertEqual(codigo, 1)
        self.assertIn("mudaram no ramo", saida)
        git(self.amb.repo, "fetch", "-q", "origin")
        self.assertEqual(self.amb.gold("origin/main"), {"a": "1", "b": "1"})

    def test_publicar_retesta_quando_o_codigo_mudou_no_remoto(self):
        self.amb.fonte("a", "2")
        self.amb.ciclo()
        outro = self.amb.tmp / "outro"
        git(self.amb.tmp, "clone", "-q", str(self.amb.remoto), str(outro))
        for k, v in (("user.name", "x"), ("user.email", "x@x")):
            git(outro, "config", k, v)
        (outro / "construir.py").write_text(CONSTRUIR.replace('"dados": dados', '"dados": dados, "versao": 2'))
        git(outro, "commit", "-qam", "código novo")
        git(outro, "push", "-q", "origin", "main")
        codigo, saida = self.amb.publicar()
        self.assertEqual(codigo, 0, saida)
        self.assertIn("reconstruindo e testando", saida)
        git(self.amb.repo, "fetch", "-q", "origin")
        publicado = json.loads(git(self.amb.repo, "show", "origin/main:gold/out.json"))
        self.assertEqual(publicado["dados"], {"a": "2", "b": "1"})
        self.assertEqual(publicado["versao"], 2)

    def test_publicar_nao_empurra_se_o_codigo_novo_reprova(self):
        self.amb.fonte("a", "2")
        self.amb.ciclo()
        outro = self.amb.tmp / "outro"
        git(self.amb.tmp, "clone", "-q", str(self.amb.remoto), str(outro))
        for k, v in (("user.name", "x"), ("user.email", "x@x")):
            git(outro, "config", k, v)
        (outro / "construir.py").write_text(CONSTRUIR.replace('["valor"]', '["valor"] and "ruim"'))
        git(outro, "commit", "-qam", "código novo que reprova")
        git(outro, "push", "-q", "origin", "main")
        codigo, saida = self.amb.publicar()
        self.assertEqual(codigo, 1)
        self.assertIn("testes reprovaram", saida)
        self.assertEqual(git(self.amb.repo, "rev-parse", "origin/main"), git(outro, "rev-parse", "HEAD"))

    def test_mudanca_com_mesmo_stat_do_indice_e_detectada_e_revertida(self):
        # mesmo tamanho e mesma data de modificação do índice: o Git dá o arquivo por inalterado
        # (aconteceu de forma intermitente neste motor antes da comparação por conteúdo)
        repo = A.Repo(self.amb.repo)
        alvo = self.amb.repo / "seed/a.json"
        original = alvo.read_bytes()
        git(self.amb.repo, "config", "core.trustctime", "false")
        git(self.amb.repo, "update-index", "--refresh")
        st = alvo.stat()
        alvo.write_bytes(original.replace(b'"1"', b'"9"'))
        os.utime(alvo, ns=(st.st_atime_ns, st.st_mtime_ns))
        # índice gravado depois: a entrada deixa de ser "racy" e o Git confia só no stat
        indice = self.amb.repo / ".git/index"
        os.utime(indice, ns=(st.st_mtime_ns + 5_000_000_000, st.st_mtime_ns + 5_000_000_000))
        self.assertEqual(git(self.amb.repo, "status", "--porcelain", "--", "seed/a.json"), "")
        self.assertEqual(repo.alterados(["seed"]), ["seed/a.json"])
        repo.reverter(["seed"])
        self.assertEqual(alvo.read_bytes(), original)

    def test_arvore_suja_no_dominio_e_falha_de_infraestrutura(self):
        (self.amb.repo / "seed/a.json").write_text("{}")
        codigo, r = self.amb.ciclo()
        self.assertEqual(codigo, 2)
        self.assertIn("mudanças nos caminhos do domínio", r["erro"])
        self.assertFalse(r["publicavel"])


class Configuracao(unittest.TestCase):
    def test_sobreposicao(self):
        self.assertTrue(A._sobrepoe("seed", "seed/a.json"))
        self.assertTrue(A._sobrepoe("seed/sinisa_*.json.gz", "seed/sinisa_x.json.gz"))
        self.assertTrue(A._sobrepoe("seed/sinisa_*.json.gz", "seed"))
        self.assertFalse(A._sobrepoe("seed/sinisa_*.json.gz", "seed/cvm"))
        self.assertFalse(A._sobrepoe("seed/a.json", "seed/b.json"))
        self.assertFalse(A._sobrepoe("public/x/gold", "public/x/golden"))

    def test_carimbos_ignorados_no_sinal(self):
        meta = {"capturado_em": "x", "cadunico": {"capturado_em": "y", "meses": {"202412": {"sha256": "a", "registros": 1}}},
                "sisagua": {"arquivos": [{"sha256": "b", "capturado_em": "z"}]}}
        limpo = A._sem_chaves(meta, {"capturado_em", "cadunico.meses.*.sha256"})
        # a resposta da API do CadÚnico muda de bytes a cada consulta; o sha256 do SISAGUA continua contando
        self.assertEqual(limpo, {"cadunico": {"meses": {"202412": {"registros": 1}}}, "sisagua": {"arquivos": [{"sha256": "b"}]}})

    def test_caminhos_sobrepostos_sao_recusados(self):
        cfg = json.loads(json.dumps(CONFIG))
        cfg["grupos"][1]["caminhos"] = ["seed"]
        with self.assertRaises(A.ErroConfiguracao):
            A.carregar_config_dict(cfg)
        cfg = json.loads(json.dumps(CONFIG))
        cfg["grupos"][1]["caminhos"] = ["gold/out.json"]
        with self.assertRaises(A.ErroConfiguracao):
            A.carregar_config_dict(cfg)

    def test_configuracoes_versionadas(self):
        raiz = Path(__file__).resolve().parents[2]
        arquivos = sorted((raiz / "config/atualizacao").glob("*.json"))
        self.assertEqual([p.stem for p in arquivos], ["contas-publicas", "eficiencia", "inflacao", "previdencia", "saneamento", "seguranca"])
        for p in arquivos:
            cfg = A.carregar_config(p)
            for g in cfg["grupos"]:
                for c in g["caminhos"]:
                    self.assertTrue(list(raiz.glob(c)), f"{p.name}: caminho inexistente {c}")
                for cmd in g["coleta"]:
                    if cmd[:2] == ["python3", "-m"]:
                        modulo = raiz / (cmd[2].replace(".", "/") + ".py")
                        self.assertTrue(modulo.exists(), f"{p.name}: módulo inexistente {cmd[2]}")
                    elif cmd[0] == "python3":
                        self.assertTrue((raiz / cmd[1]).exists(), f"{p.name}: script inexistente {cmd[1]}")
            for s in cfg["saidas"]:
                self.assertTrue((raiz / s).exists(), f"{p.name}: saída inexistente {s}")
            for t in cfg["testes"]:
                if t["comando"][:3] == ["python3", "-m", "unittest"]:
                    for alvo in t["comando"][3:]:
                        if alvo.startswith("pipeline."):
                            self.assertTrue((raiz / (alvo.replace(".", "/") + ".py")).exists(), alvo)
                if t["comando"][:3] == ["npx", "vitest", "run"]:
                    for alvo in t["comando"][3:]:
                        if alvo.startswith("src/"):
                            self.assertTrue(list(raiz.glob(alvo + "*")), alvo)
            # o sinal de mudança precisa ler a publicação atual sem erro
            self.assertTrue(A.sinal(raiz, cfg["sinal_de_mudanca"]))


class TempoEsgotado(unittest.TestCase):
    def test_tempo_esgotado_encerra_tambem_os_processos_filhos(self):
        # bash -c com dois comandos não faz exec: o sleep é filho do shell e herda o pipe de saída.
        # Matar só o shell deixaria a leitura presa até o sleep acabar (30 s).
        import time
        with tempfile.TemporaryDirectory() as d:
            raiz = Path(d)
            inicio = time.monotonic()
            with contextlib.redirect_stdout(io.StringIO()):
                rc, cauda = A.rodar(["bash", "-c", "sleep 30; echo fim"], raiz, timeout_min=0.02, log=raiz / "log.txt")
            self.assertEqual(rc, 124)
            self.assertIn("tempo esgotado", cauda)
            self.assertLess(time.monotonic() - inicio, 15)


if __name__ == "__main__":
    unittest.main()
