import json
import unittest
from decimal import Decimal

from pipeline.observatorio_saneamento import tarifas


class TabelaI(unittest.TestCase):
    def test_tarifas_minimas_e_cadeia_de_reajustes_conferem(self):
        self.assertEqual(tarifas.confere_corsan(), [])

    def test_tarifa_minima_alterada_e_apontada(self):
        original = tarifas.CORSAN_T1["2026-07"]["res_b"]
        tarifas.CORSAN_T1["2026-07"]["res_b"] = original[:2] + (134.90,) + original[3:]
        try:
            erros = tarifas.confere_corsan()
        finally:
            tarifas.CORSAN_T1["2026-07"]["res_b"] = original
        self.assertTrue(any("2026-07 res_b" in e and "134.9" in e for e in erros), erros)

    def test_o_expoente_da_industrial_vem_da_linha_de_30_m3_da_coluna_ind(self):
        # número oficial: 154,64 + 11,83 × 30^1,03 = 547,66; com 1,02 daria 534,52
        sb, pb = Decimal("154.64"), Decimal("11.83")
        q = lambda x: x.quantize(Decimal("0.01"))
        self.assertEqual(q(sb + pb * (Decimal(30) ** Decimal("1.03"))), Decimal("547.66"))
        self.assertEqual(q(sb + pb * (Decimal(30) ** Decimal("1.02"))), Decimal("534.52"))

    def test_expoente_da_faixa_e_o_da_ultima_linha_que_nao_passa_do_consumo(self):
        e = tarifas.corsan["categorias"]["residencial"]["agua"]["exponencial"]
        esperados = {10: "1.0", 20: "1.0", 21: "1.01", 30: "1.09", 31: "1.09", 35: "1.09", 36: "1.10", 50: "1.11", 51: "1.11", 100: "1.11", 101: "1.13", 150: "1.13", 151: "1.1287", 200: "1.1287", 201: "1.1275", 9001: "1.0858"}
        for c, n in esperados.items():
            self.assertEqual(tarifas.expoente(e, c), Decimal(n), f"{c} m³")


class ResidencialB(unittest.TestCase):
    def conta(self, m3):
        return tarifas.conta(tarifas.corsan["categorias"]["residencial"], m3)

    def test_exemplos_do_gerador(self):
        for m3, esperado in tarifas.corsan["exemplos"]["residencial"].items():
            self.assertEqual(self.conta(int(m3)), Decimal(str(esperado)), f"{m3} m³")

    def test_ate_10_m3_cobra_o_minimo_de_agua_e_de_esgoto(self):
        self.assertEqual(self.conta(0), Decimal("198.89"))  # 134,89 + 64,00
        self.assertEqual(self.conta(7), Decimal("198.89"))

    def test_fracao_de_metro_cubico_e_desprezada(self):
        self.assertEqual(self.conta(Decimal("35.99")), self.conta(35))
        self.assertEqual(self.conta(Decimal("10.9")), self.conta(10))

    def test_esgoto_e_70_por_cento_do_preco_base_por_m3_sem_expoente(self):
        esgoto = tarifas.corsan["categorias"]["residencial"]["esgoto"]
        self.assertEqual(tarifas.conta_servico(esgoto, 30), Decimal("192.00"))  # 6,40 × 30, sem 30^1,09
        self.assertEqual(tarifas.conta_servico(esgoto, 5), Decimal("64.00"))

    def test_municipios_sao_os_298_do_apendice_1_dentro_do_vinculo_sinisa(self):
        with open(tarifas.CORSAN_APENDICE, encoding="utf-8") as fh:
            ap = json.load(fh)
        self.assertEqual(len(ap["municipios"]), 298)
        self.assertEqual(len(set(ap["municipios"])), 298)
        self.assertRegex(ap["sha256"], r"^[a-f0-9]{64}$")
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            t = {x["id"]: x for x in json.load(fh)["tarifas"]}["corsan-2026"]
        self.assertEqual(len(t["municipios"]), 298)
        self.assertTrue(all(m.startswith("43") for m in t["municipios"]))
        for fora in ("4304606", "4307005", "4307708", "4316808"):  # Canoas, Erechim, Esteio, Santa Cruz do Sul
            self.assertNotIn(fora, t["municipios"])

    def test_json_publicado_traz_a_mesma_tabela(self):
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            publicada = {t["id"]: t for t in json.load(fh)["tarifas"]}["corsan-2026"]
        esperada = json.loads(json.dumps(tarifas.corsan))
        publicada.pop("municipios")
        esperada.pop("municipios", None)
        self.assertEqual(publicada, esperada)

    def test_fontes_tem_sha256_e_url_https(self):
        self.assertGreaterEqual(len(tarifas.corsan["fontes"]), 6)
        for f in tarifas.corsan["fontes"]:
            self.assertRegex(f["sha256"], r"^[a-f0-9]{64}$")
            self.assertTrue(f["url"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()
