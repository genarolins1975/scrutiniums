import json
import unittest
from decimal import Decimal

from pipeline.observatorio_saneamento import tarifas


class ReajusteDe2026(unittest.TestCase):
    def test_tabela_de_2026_reproduz_a_de_2025_reajustada(self):
        self.assertEqual(tarifas.confere_reajuste_2026(), [])

    def test_valor_alterado_na_tabela_de_2026_e_apontado(self):
        original = tarifas.SG_NORMAL["agua"][2]
        tarifas.SG_NORMAL["agua"][2] = 7.46
        try:
            erros = tarifas.confere_reajuste_2026()
        finally:
            tarifas.SG_NORMAL["agua"][2] = original
        self.assertEqual(len(erros), 1)
        self.assertIn("normal agua faixa 3", erros[0])

    def test_esgoto_e_80_e_20_da_agua_ao_centavo_exceto_na_primeira_faixa(self):
        # Resolução AGR 42/2005, art. 2º; a primeira faixa sai do preço de água ainda sem arredondar (5,7665)
        for tabela in (tarifas.SG_NORMAL, tarifas.SG_SOCIAL):
            for i, agua in enumerate(tabela["agua"]):
                coleta = Decimal(str(tabela["coleta"][i]))
                trat = Decimal(str(tabela["tratamento"][i]))
                self.assertLessEqual(abs(coleta + trat - Decimal(str(agua))), Decimal("0.01"))
                self.assertLessEqual(abs(coleta - Decimal(str(agua)) * Decimal("0.8")), Decimal("0.01"))


class TabelaDaSaneago(unittest.TestCase):
    def conta(self, cat, m3):
        return tarifas.conta(tarifas.saneago["categorias"][cat], m3)

    def test_exemplos_do_gerador(self):
        for cat, ex in tarifas.saneago["exemplos"].items():
            for m3, esperado in ex.items():
                self.assertEqual(self.conta(cat, int(m3)), Decimal(str(esperado)), f"{cat} {m3} m³")

    def test_tarifa_basica_soma_a_conta_e_esgoto_nao_tem_parte_fixa(self):
        res = tarifas.saneago["categorias"]["residencial"]
        self.assertEqual(res["agua"]["fixo"], 17.46)
        self.assertNotIn("fixo", res["esgoto"])
        self.assertEqual(self.conta("residencial", 0), Decimal("17.46"))

    def test_esgoto_da_primeira_faixa_e_a_soma_das_colunas_do_ato(self):
        # 4,61 + 1,15 = 5,76, um centavo abaixo da água (5,77); nas demais faixas a soma é o preço da água
        faixas = tarifas.saneago["categorias"]["residencial"]["esgoto"]["faixas"]
        self.assertEqual(faixas[0]["preco"], 5.76)
        agua = tarifas.saneago["categorias"]["residencial"]["agua"]["faixas"]
        self.assertEqual([f["preco"] for f in faixas[1:]], [f["preco"] for f in agua[1:]])

    def test_social_para_no_teto_de_20_m3(self):
        social = tarifas.saneago["categorias"]["social"]
        self.assertEqual(social["consumoMaximo"], 20)
        self.assertEqual(social["agua"]["faixas"][-1]["ate"], 20)

    def test_progressivo_e_preco_unico_da_faixa_diferem_acima_de_10_m3(self):
        # número citado no texto de metodoNaoVerificado
        res = tarifas.saneago["categorias"]["residencial"]["agua"]
        progressivo = tarifas.conta_servico({"faixas": res["faixas"]}, 20)
        self.assertEqual(progressivo, Decimal("127.50"))
        self.assertEqual(Decimal("20") * Decimal("7.45"), Decimal("149.00"))
        self.assertIn("R$ 127,50", tarifas.saneago["metodoNaoVerificado"])
        self.assertIn("R$ 149,00", tarifas.saneago["metodoNaoVerificado"])

    def test_json_publicado_traz_a_mesma_tabela(self):
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            publicada = {t["id"]: t for t in json.load(fh)["tarifas"]}["saneago-2026"]
        esperada = json.loads(json.dumps(tarifas.saneago))
        publicada.pop("municipios")
        esperada.pop("municipios", None)
        self.assertEqual(publicada, esperada)

    def test_fontes_tem_sha256_e_url_https(self):
        self.assertGreaterEqual(len(tarifas.saneago["fontes"]), 5)
        for f in tarifas.saneago["fontes"]:
            self.assertRegex(f["sha256"], r"^[a-f0-9]{64}$")
            self.assertTrue(f["url"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()
