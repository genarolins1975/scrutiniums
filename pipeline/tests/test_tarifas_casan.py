import json
import unittest
from decimal import Decimal

from pipeline.observatorio_saneamento import tarifas


class ReajusteDe2026(unittest.TestCase):
    def test_tabela_de_2026_reproduz_a_de_2025_reajustada_em_5_80_por_cento(self):
        self.assertEqual(tarifas.confere_reajuste_casan(), [])

    def test_valor_alterado_e_apontado(self):
        original = tarifas.CASAN_2026["residencial"]["precos"][1]
        tarifas.CASAN_2026["residencial"]["precos"][1] = 14.32
        try:
            erros = tarifas.confere_reajuste_casan()
        finally:
            tarifas.CASAN_2026["residencial"]["precos"][1] = original
        # o valor errado quebra a reprodução da aba 2025 e também a igualdade com as faixas da social federal
        self.assertTrue(any("residencial faixa 2" in e for e in erros), erros)
        self.assertTrue(any("social federal" in e for e in erros), erros)

    def test_social_da_lei_federal_e_metade_da_residencial_na_tfdi_e_na_primeira_faixa(self):
        res, soc = tarifas.CASAN_2026["residencial"], tarifas.CASAN_SOCIAL_FEDERAL
        self.assertEqual(Decimal(str(soc["tfdi"])) * 2, Decimal(str(res["tfdi"])))
        self.assertEqual(Decimal(str(soc["precos"][0])) * 2, Decimal(str(res["precos"][0])))
        self.assertEqual(soc["precos"][1:], res["precos"][1:])


class TabelaDaCasan(unittest.TestCase):
    def conta(self, cat, m3):
        return tarifas.conta(tarifas.casan["categorias"][cat], m3)

    def test_exemplos_oficiais_da_planilha(self):
        for cat, ex in tarifas.casan["exemplosOficiais"].items():
            for m3, esperado in ex.items():
                self.assertEqual(self.conta(cat, int(m3)), Decimal(str(esperado)), f"{cat} {m3} m³")

    def test_exemplos_manuais_da_social_anterior(self):
        for m3, esperado in tarifas.casan["exemplos"]["social_anterior"].items():
            self.assertEqual(self.conta("social_anterior", int(m3)), Decimal(str(esperado)))

    def test_esgoto_repete_a_agua_inclusive_a_tfdi(self):
        for cat in tarifas.casan["categorias"].values():
            self.assertEqual(cat["esgoto"], {"percentual": 100})
        self.assertEqual(self.conta("residencial", 0), Decimal("92.68"))  # 2 × 46,34

    def test_faixas_sao_blocos_que_comecam_em_0_10_25_e_50(self):
        faixas = tarifas.casan["categorias"]["residencial"]["agua"]["faixas"]
        self.assertEqual([(f["de"], f["ate"]) for f in faixas], [(0, 10), (10, 25), (25, 50), (50, None)])
        social = tarifas.casan["categorias"]["social"]["agua"]["faixas"]
        self.assertEqual([(f["de"], f["ate"]) for f in social], [(0, 15), (15, 25), (25, 50), (50, None)])

    def test_json_publicado_traz_a_mesma_tabela(self):
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            publicada = {t["id"]: t for t in json.load(fh)["tarifas"]}["casan-2026"]
        esperada = json.loads(json.dumps(tarifas.casan))
        publicada.pop("municipios")
        esperada.pop("municipios", None)
        self.assertEqual(publicada, esperada)
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            municipios = {t["id"]: t for t in json.load(fh)["tarifas"]}["casan-2026"]["municipios"]
        self.assertTrue(all(m.startswith("42") for m in municipios))

    def test_fontes_tem_sha256_e_url_https(self):
        self.assertGreaterEqual(len(tarifas.casan["fontes"]), 5)
        for f in tarifas.casan["fontes"]:
            self.assertRegex(f["sha256"], r"^[a-f0-9]{64}$")
            self.assertTrue(f["url"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()
