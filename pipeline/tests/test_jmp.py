import gzip
import hashlib
import json
import unittest

from pipeline.observatorio_saneamento import jmp


def linha(nome="Testlândia", iso="TST", ano="2024", basal="60", lim="10", unimp="20", ns="10", sm="40", prefixo="wat", area="t"):
    l = {c: "" for c in jmp.IDENT + jmp.COLUNAS_AGUA + jmp.COLUNAS_ESGOTO}
    l.update({"name": nome, "iso3": iso, "year": ano, "pop_t": "1000", "prop_u": "50", "region_sdg": "Região", "region_income": "Renda"})
    l.update({f"{prefixo}_basal_{area}": basal, f"{prefixo}_lim_{area}": lim, f"{prefixo}_unimp_{area}": unimp, f"{prefixo}_ns_{area}": ns, f"{prefixo}_sm_{area}": sm})
    return l


class Auxiliares(unittest.TestCase):
    def test_numero_trata_vazio_traco_e_texto_como_ausencia(self):
        self.assertEqual(jmp.numero("12.5"), 12.5)
        self.assertEqual(jmp.numero(3), 3.0)
        self.assertEqual(jmp.numero(0), 0.0)  # zero é zero
        for v in (None, "", "-", "n/a", True):
            self.assertIsNone(jmp.numero(v), repr(v))

    def test_edicao_do_arquivo_le_data_e_periodo_ou_interrompe(self):
        r = jmp.edicao_do_arquivo(["Water, sanitation and hygiene", "(2000-2024)", "Updated August 2025", "www.washdata.org"])
        self.assertEqual(r, ("August 2025", (2000, 2024)))
        self.assertEqual(jmp.mes_da_edicao("August 2025"), "2025-08")
        with self.assertRaisesRegex(ValueError, "formato novo"):
            jmp.edicao_do_arquivo(["sem data"])

    def test_degraus_que_nao_somam_cem_ou_gerenciado_acima_de_basico_interrompem(self):
        ok = jmp._conferir([linha()], "wat", "água")
        self.assertEqual(ok["estimativas"], 1)
        with self.assertRaisesRegex(ValueError, "degraus somam"):
            jmp._conferir([linha(ns="12")], "wat", "água")
        with self.assertRaisesRegex(ValueError, "gerenciado"):
            jmp._conferir([linha(sm="61")], "wat", "água")

    def test_linha_sem_estimativa_nao_entra_na_conferencia_e_degrau_ausente_conta_como_zero_na_soma(self):
        vazia = linha(basal="", lim="", unimp="", ns="", sm="")
        self.assertEqual(jmp._conferir([vazia], "wat", "água")["estimativas"], 0)
        # Brasil 2022 na fonte: degrau "superficial" ausente, soma 100 com os outros três
        self.assertEqual(jmp._conferir([linha(basal="99.61", lim="0", unimp="0.39", ns="", sm="87.12")], "wat", "água")["estimativas"], 1)


class SeedPublicado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifesto = json.loads((jmp.SEED / "manifesto.json").read_text(encoding="utf-8"))
        cls.gold, cls.meta = jmp.construir()
        cls.por_iso = {p["iso3"]: p for p in cls.gold["paises"]}

    def test_arquivos_do_seed_conferem_com_o_manifesto(self):
        for a in self.manifesto["arquivos"].values():
            bruto = gzip.decompress((jmp.SEED / a["arquivo"]).read_bytes())
            self.assertEqual(hashlib.sha256(bruto).hexdigest(), a["sha256"], a["arquivo"])
            self.assertEqual(len(bruto), a["bytes"])
        self.assertRegex(self.manifesto["xlsx"]["sha256"], r"^[a-f0-9]{64}$")
        self.assertEqual(self.manifesto["periodo"], [2000, 2024])

    def test_os_quatro_seeds_tem_sha256_e_a_leitura_recusa_seed_alterado(self):
        self.assertEqual(set(self.manifesto["arquivos"]), {"agua", "esgoto", "brasil_fontes", "paises_ibge"})
        for chave, a in self.manifesto["arquivos"].items():
            jmp._bruto(self.manifesto, chave)  # confere o conteúdo contra o sha256 e o tamanho registrados
            self.assertRegex(a["sha256"], r"^[a-f0-9]{64}$", chave)
        adulterado = json.loads(json.dumps(self.manifesto))
        adulterado["arquivos"]["paises_ibge"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "seed do JMP alterado"):
            jmp._bruto(adulterado, "paises_ibge")
        adulterado["arquivos"]["brasil_fontes"]["bytes"] += 1
        with self.assertRaisesRegex(ValueError, "seed do JMP alterado"):
            jmp._bruto(adulterado, "brasil_fontes")

    def test_so_as_colunas_usadas_entram_no_seed(self):
        for chave, colunas in (("agua", jmp.COLUNAS_AGUA), ("esgoto", jmp.COLUNAS_ESGOTO)):
            bruto = gzip.decompress((jmp.SEED / self.manifesto["arquivos"][chave]["arquivo"]).read_bytes()).decode("utf-8")
            self.assertEqual(bruto.splitlines()[0].split(";"), jmp.IDENT + colunas)

    def test_um_pais_por_codigo_com_nome_em_portugues_do_ibge_quando_ha(self):
        self.assertEqual(len(self.por_iso), len(self.gold["paises"]))
        self.assertEqual(self.por_iso["BRA"]["nome"], "Brasil")
        self.assertEqual(self.por_iso["BRA"]["nome_origem"], "IBGE")
        self.assertEqual(self.por_iso["BRA"]["nome_jmp"], "Brazil")
        for p in self.gold["paises"]:
            if p["nome_origem"] == "JMP":
                self.assertEqual(p["nome"], p["nome_jmp"], p["iso3"])
        self.assertEqual(len(self.meta["sem_nome_ibge"]), sum(1 for p in self.gold["paises"] if p["nome_origem"] == "JMP"))

    def test_todo_pais_tem_ano_comparado_e_degraus_que_somam_cem(self):
        for p in self.gold["paises"]:
            self.assertEqual(p["ano"], self.meta["ano_comparado"], p["iso3"])
            for servico, ladder in (("agua", ("basica", "limitada", "nao_melhorada", "ruim")), ("esgoto", ("basica", "limitada", "nao_melhorada", "ruim"))):
                for area, b in (p[servico] or {}).items():
                    if b["basica"] is None:
                        continue
                    self.assertAlmostEqual(sum(b[k] or 0 for k in ladder), 100, delta=jmp.TOLERANCIA_ESCADA, msg=f"{p['iso3']} {servico} {area}")
                    if b["gerenciada"] is not None:
                        self.assertLessEqual(b["gerenciada"], b["basica"] + 0.01, f"{p['iso3']} {servico} {area}")

    def test_cobertura_da_meta_bate_com_os_dados(self):
        self.assertEqual(self.meta["areas"], len(self.gold["paises"]))
        self.assertEqual(self.meta["com_agua_gerenciada"], sum(1 for p in self.gold["paises"] if p["agua"] and p["agua"]["t"]["gerenciada"] is not None))
        self.assertEqual(self.meta["com_esgoto_gerenciado"], sum(1 for p in self.gold["paises"] if p["esgoto"] and p["esgoto"]["t"]["gerenciada"] is not None))
        self.assertEqual(self.meta["edicao_mes"], "2025-08")

    def test_serie_do_brasil_cobre_todos_os_anos_e_o_ultimo_e_o_ano_comparado(self):
        anos = [s["ano"] for s in self.gold["brasil"]]
        self.assertEqual(anos, list(range(2000, 2025)))
        ultimo = self.gold["brasil"][-1]
        bra = self.por_iso["BRA"]
        self.assertEqual(ultimo["agua"]["t"], bra["agua"]["t"])
        self.assertEqual(ultimo["esgoto"]["t"], bra["esgoto"]["t"])
        # valores do Brasil lidos direto da fonte em 17/10/2026 (aba wat e san, arquivo de agosto de 2025)
        self.assertAlmostEqual(bra["agua"]["t"]["gerenciada"], 88.62, places=2)
        self.assertAlmostEqual(bra["esgoto"]["t"]["gerenciada"], 54.96, places=2)
        self.assertAlmostEqual(bra["esgoto"]["t"]["basica"], 92.4, places=1)

    def test_csv_tem_uma_linha_por_pais_e_o_cabecalho(self):
        cab, linhas = jmp.linhas_csv(self.gold)
        self.assertEqual(len(linhas), len(self.gold["paises"]))
        self.assertEqual(len(cab), len(linhas[0]))


if __name__ == "__main__":
    unittest.main()
