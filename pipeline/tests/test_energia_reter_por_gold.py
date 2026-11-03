"""Publicação por gold do Setor Elétrico depois dos testes (scripts/energia_reter_por_gold.py), sem rede nem git."""
import hashlib
import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("reter", RAIZ / "scripts/energia_reter_por_gold.py")
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)

MAPA = {
    "arquivos": {
        "energia-carga.test.ts": {"classe": "dado", "golds": ["carga.json", "carga_detalhe.json"]},
        "energia-mercado.test.ts": {"classe": "dado", "golds": ["mercado.json"]},
        "energia-conteudo-r8-M1.test.ts": {"classe": "dado", "golds": ["expansao.json", "geracao.json", "mercado.json"]},
        "energia-listadas.test.ts": {"classe": "dado", "golds": ["empresas.json", "listadas.json"]},
        "energia-i18n-html.test.ts": {"classe": "interface", "golds": []},
        "energia-gold-contrato.test.ts": {"classe": "tudo", "golds": []},
    },
    "python": {"test_energia_agua": ["agua_detalhe.json", "hidrologia.json"], "test_energia_avaliacao": "tudo"},
}
PAGINAS = {"/mercado": {"mercado.json"}, "/expansao": {"expansao.json"}, "/carga": {"carga.json", "carga_detalhe.json"}}
DEPENDENCIAS = {"leiloes": ("empresas.json",), "listadas": ("empresas.json",)}
CODIGOS = {"vitest": 1, "pipeline": 0, "build": 0}


def resultado(*arquivos):
    """Resultado do vitest com os arquivos dados reprovados; cada item: (arquivo, [nomes das asserções reprovadas])."""
    return {"testResults": [{"name": f"/r/src/tests/{a}", "status": "failed",
                             "assertionResults": [{"status": "failed", "fullName": n} for n in nomes]} for a, nomes in arquivos]}


class Decisao(unittest.TestCase):
    def decidir(self, res, codigos=CODIGOS, log=""):
        return R.decidir(res, codigos, MAPA, PAGINAS, DEPENDENCIAS, log)

    def test_teste_de_dado_retem_so_as_suas_golds(self):
        d = self.decidir(resultado(("energia-carga.test.ts", ["série mensal"])))
        self.assertEqual(d["modo"], "parcial")
        # a síntese nunca é retida: é reconstruída sobre a publicação recomposta (recompor)
        self.assertEqual(set(d["golds"]), {"carga.json", "carga_detalhe.json"})
        self.assertIn("energia-carga.test.ts", d["golds"]["carga.json"][0])

    def test_teste_de_interface_nao_retem_e_vai_para_a_lista(self):
        d = self.decidir(resultado(("energia-i18n-html.test.ts", ["/en/x", "/en/y"])))
        self.assertEqual(d["modo"], "nada")
        self.assertEqual(d["interface"], ["energia-i18n-html.test.ts (2 testes)"])

    def test_asserção_que_cita_rota_restringe_a_retencao(self):
        d = self.decidir(resultado(("energia-conteudo-r8-M1.test.ts", ["conciliação: mercado livre (/mercado) os dois percentuais"])))
        self.assertEqual(set(d["golds"]), {"mercado.json"})
        d = self.decidir(resultado(("energia-conteudo-r8-M1.test.ts", ["sem rota no nome"])))
        self.assertEqual(set(d["golds"]), {"expansao.json", "geracao.json", "mercado.json"})

    def test_dependentes_entram_com_a_gold(self):
        d = self.decidir(resultado(("energia-listadas.test.ts", ["empresas.json: potência"])))
        self.assertEqual(set(d["golds"]), {"empresas.json", "listadas.json", "leiloes.json"})
        self.assertEqual(d["golds"]["leiloes.json"], ["dependência retida: empresas.json"])

    def test_classe_tudo_retem_tudo_e_arquivo_de_outro_dominio_nao_decide(self):
        self.assertEqual(self.decidir(resultado(("energia-gold-contrato.test.ts", ["x"])))["modo"], "tudo")
        # arquivo fora do mapa não lê a gold de energia (cobertura exigida em MapaCompleto): não decide, só é listado
        d = self.decidir(resultado(("credito-residual-browser.test.ts", ["x"])))
        self.assertEqual(d["modo"], "nada")
        self.assertEqual(d["desconhecidos"], ["credito-residual-browser.test.ts"])
        self.assertIn("outros domínios", R.relatorio(d))

    def test_build_ou_vitest_abortado_retem_tudo(self):
        for c in ({"vitest": 0, "pipeline": 0, "build": 1}, {"vitest": 134, "pipeline": 0, "build": 0}, {"vitest": 1, "pipeline": 2, "build": 0}):
            self.assertEqual(self.decidir(resultado(), c)["modo"], "tudo", c)

    def test_tudo_verde_nao_retem_nada(self):
        d = self.decidir({"testResults": [{"name": "/r/src/tests/energia-carga.test.ts", "status": "passed", "assertionResults": []}]},
                         {"vitest": 0, "pipeline": 0, "build": 0})
        self.assertEqual(d["modo"], "nada")

    def test_suite_python_por_gold(self):
        log = ("FAIL: test_mlt (pipeline.tests.test_energia_agua.TestGoldPublicada.test_mlt)\n"
               "ERROR: test_x (pipeline.tests.test_energia_agua.TestGoldPublicada.test_x)\n")
        d = self.decidir(resultado(), {"vitest": 0, "pipeline": 1, "build": 0}, log)
        self.assertEqual(d["modo"], "parcial")
        self.assertEqual(set(d["golds"]), {"agua_detalhe.json", "hidrologia.json"})
        # classe sem Gold: código do pipeline quebrado, tudo retido; módulo de controle idem
        for log in ("FAIL: test_y (pipeline.tests.test_energia_agua.TestLeitores.test_y)\n",
                    "FAIL: test_y (pipeline.tests.test_energia_avaliacao.GoldPublicada.test_y)\n",
                    "FAIL: test_y (pipeline.tests.test_energia_meta.TestEstadoMeta.test_y)\n", ""):
            self.assertEqual(self.decidir(resultado(), {"vitest": 0, "pipeline": 1, "build": 0}, log)["modo"], "tudo", log)

    def test_rodada_1_amplia_para_as_golds_inteiras_dos_testes_reprovados(self):
        retidas = {"carga.json": ["energia-carga.test.ts: x"], "carga_detalhe.json": ["energia-carga.test.ts: x"]}
        res = resultado(("energia-conteudo-r8-M1.test.ts", ["conciliação (/mercado)"]))
        d = R.expandir(res, CODIGOS, MAPA, DEPENDENCIAS, retidas)
        self.assertEqual(d["modo"], "parcial")
        self.assertEqual(set(d["golds"]), {"carga.json", "carga_detalhe.json", "expansao.json", "geracao.json", "mercado.json"})
        # sem gold nova a reter, a rodada seguinte não resolveria: tudo retido
        d = R.expandir(resultado(("energia-carga.test.ts", ["y"])), CODIGOS, MAPA, DEPENDENCIAS, retidas)
        self.assertEqual(d["modo"], "tudo")
        # a síntese nunca entra; o teste de interface não amplia
        d = R.expandir(resultado(("energia-i18n-html.test.ts", ["z"])), CODIGOS, MAPA, DEPENDENCIAS, retidas)
        self.assertEqual(d["modo"], "tudo")

    def test_codigos(self):
        self.assertEqual(R.codigos("vitest=1 pipeline=0 build=0"), {"vitest": 1, "pipeline": 0, "build": 0})
        self.assertEqual(R.codigos(""), {})


class MapaCompleto(unittest.TestCase):
    def test_todo_teste_que_le_a_gold_de_energia_esta_classificado(self):
        mapa = R.carregar_mapa()["arquivos"]
        faltam = [a for a in R.arquivos_de_teste_energia() if a not in mapa]
        self.assertEqual(faltam, [], "classificar em pipeline/energia/testes_golds.json (dado, interface ou tudo)")
        for nome, c in mapa.items():
            self.assertIn(c["classe"], ("dado", "interface", "tudo"), nome)
            if c["classe"] == "dado":
                self.assertTrue(c["golds"], nome)
                for g in c["golds"]:
                    self.assertNotIn(g, R.CONTROLE, nome)
                    self.assertTrue((RAIZ / R.GOLD / g).exists() or g in ("modelos.json", "previsoes.json", "previsoes_desempenho.json"), f"{nome}: {g}")

    def test_mapa_python_cobre_os_modulos_com_classe_gold(self):
        mapa = R.carregar_mapa()["python"]
        for p in sorted((RAIZ / "pipeline/tests").glob("test_energia_*.py")):
            texto = p.read_text(encoding="utf-8")
            if "Gold" in "".join(l for l in texto.splitlines() if l.startswith("class ")):
                self.assertIn(p.stem, mapa, p.name)


class Retencao(unittest.TestCase):
    """reter() devolve a gold, os arquivos dela, as séries da operação, meta e arquivos.json à versão publicada."""

    def setUp(self):
        self.raiz = Path(tempfile.mkdtemp(prefix="reter-"))
        self.addCleanup(shutil.rmtree, self.raiz, ignore_errors=True)
        gold = self.raiz / R.GOLD
        series = self.raiz / "public/energia/series"
        gold.mkdir(parents=True)
        series.mkdir(parents=True)
        self.pub = {}

        def publicado(rel, conteudo):
            self.pub[rel] = conteudo if isinstance(conteudo, bytes) else json.dumps(conteudo).encode()

        publicado(f"{R.GOLD}/carga.json", {"gold": "carga.json", "gerado_em": "2026-10-01T00:00:00Z", "disponivel": True, "v": 1})
        publicado(f"{R.GOLD}/carga_detalhe.json", {"gold": "carga_detalhe.json", "gerado_em": "2026-10-01T00:00:01Z", "disponivel": True})
        publicado("public/energia/series/carga_diaria.csv", b"dia;mw\n2026-09-30;1\n")
        publicado("public/energia/series/carga_horaria.csv", b"hora;mw\n1;1\n")
        publicado(f"{R.GOLD}/arquivos.json", {"arquivos": {"/energia/series/carga_diaria.csv": {"gold": "carga.json"},
                                                             "/energia/series/carga_horaria.csv": {"gold": "carga_detalhe.json"},
                                                             "/energia/series/pld_diario.csv": {"gold": "pld.json"}}})
        # versão nova (candidata) no disco: carga mudou, ganhou um arquivo novo; pld é novo também
        (gold / "carga.json").write_text(json.dumps({"gold": "carga.json", "gerado_em": "2026-11-03T04:00:00Z", "disponivel": True, "v": 2}))
        (gold / "carga_detalhe.json").write_text(json.dumps({"gold": "carga_detalhe.json", "gerado_em": "2026-11-03T04:00:01Z", "disponivel": True}))
        (gold / "pld.json").write_text(json.dumps({"gold": "pld.json", "gerado_em": "2026-11-03T04:00:02Z", "disponivel": True}))
        (series / "carga_diaria.csv").write_bytes(b"dia;mw\n2026-11-02;2\n")
        (series / "carga_horaria.csv").write_bytes(b"hora;mw\n1;2\n")
        (series / "carga_nova.csv").write_bytes(b"x\n1\n")
        (series / "pld_diario.csv").write_bytes(b"dia;pld\n2026-11-02;3\n")
        (gold / "arquivos.json").write_text(json.dumps({"arquivos": {"/energia/series/carga_diaria.csv": {"gold": "carga.json", "novo": True},
                                                                      "/energia/series/carga_horaria.csv": {"gold": "carga_detalhe.json"},
                                                                      "/energia/series/carga_nova.csv": {"gold": "carga_detalhe.json"},
                                                                      "/energia/series/pld_diario.csv": {"gold": "pld.json"}}}))
        (gold / "meta.json").write_text(json.dumps({"gerado_em": "2026-11-03T05:00:00Z", "regressoes": [],
                                                     "golds": {"carga.json": {"disponivel": True, "gerado_em": "2026-11-03T04:00:00Z"},
                                                               "pld.json": {"disponivel": True, "gerado_em": "2026-11-03T04:00:02Z"}}}))
        itens = []
        for rel in ("energia/gold/carga.json", "energia/gold/carga_detalhe.json", "energia/gold/pld.json",
                    "energia/series/carga_diaria.csv", "energia/series/carga_horaria.csv", "energia/series/carga_nova.csv", "energia/series/pld_diario.csv"):
            b = (self.raiz / "public" / rel).read_bytes()
            itens.append({"caminho": "/" + rel, "tipo": "gold" if rel.endswith(".json") else "serie", "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()})
        (gold / "manifesto.json").write_text(json.dumps({"id_publicacao": "antes", "totais": {"arquivos": len(itens)}, "arquivos": itens}))

    def test_retencao_devolve_a_versao_publicada_e_registra_a_regressao(self):
        import pipeline.energia.fontes.publicacao_dados as pub
        anterior = pub.PUBLICO
        pub.PUBLICO = str(self.raiz / "public")
        self.addCleanup(setattr, pub, "PUBLICO", anterior)
        golds = {"carga.json": ["energia-carga.test.ts: série mensal"], "carga_detalhe.json": ["energia-carga.test.ts: série mensal"]}
        refeitos, removidos = R.reter(golds, self.raiz, lambda rel: self.pub.get(rel))
        R.manifesto(self.raiz)
        gold = self.raiz / R.GOLD
        self.assertEqual(json.loads((gold / "carga.json").read_text())["v"], 1)
        self.assertEqual((self.raiz / "public/energia/series/carga_diaria.csv").read_bytes(), b"dia;mw\n2026-09-30;1\n")
        self.assertFalse((self.raiz / "public/energia/series/carga_nova.csv").exists(), "arquivo que só a candidata tinha sai")
        self.assertEqual((self.raiz / "public/energia/series/pld_diario.csv").read_bytes(), b"dia;pld\n2026-11-02;3\n", "gold não retida fica nova")
        self.assertIn("public/energia/series/carga_nova.csv", removidos)
        meta = json.loads((gold / "meta.json").read_text())
        self.assertEqual(meta["golds"]["carga.json"]["gerado_em"], "2026-10-01T00:00:00Z")
        self.assertEqual(meta["golds"]["carga_detalhe.json"]["gerado_em"], "2026-10-01T00:00:01Z")
        self.assertEqual(meta["golds"]["pld.json"]["gerado_em"], "2026-11-03T04:00:02Z")
        self.assertEqual([r["gold"] for r in meta["regressoes"]], ["carga.json", "carga_detalhe.json"])
        self.assertEqual(meta["regressoes"][0]["motivo"], "conferência da publicação reprovada: energia-carga.test.ts")
        arq = json.loads((gold / "arquivos.json").read_text())["arquivos"]
        self.assertNotIn("novo", arq["/energia/series/carga_diaria.csv"])
        self.assertNotIn("/energia/series/carga_nova.csv", arq)
        self.assertIn("/energia/series/pld_diario.csv", arq)
        man = json.loads((gold / "manifesto.json").read_text())
        por = {i["caminho"]: i for i in man["arquivos"]}
        self.assertNotIn("/energia/series/carga_nova.csv", por)
        self.assertEqual(por["/energia/series/carga_diaria.csv"]["sha256"], hashlib.sha256(b"dia;mw\n2026-09-30;1\n").hexdigest())
        self.assertEqual(por["/energia/gold/carga.json"]["gerado_em"], "2026-10-01T00:00:00Z")
        self.assertNotEqual(man["id_publicacao"], "antes")
        self.assertEqual(man["totais"]["arquivos"], len(man["arquivos"]))

    def test_motivo_curto(self):
        self.assertEqual(R.motivo_curto("x", ["a.test.ts: 1", "a.test.ts: 2", "b.test.ts: 3"]), "conferência da publicação reprovada: a.test.ts, b.test.ts")
        self.assertEqual(R.motivo_curto("x", ["dependência retida: empresas.json"]), "dependência retida: empresas.json")


if __name__ == "__main__":
    unittest.main()
