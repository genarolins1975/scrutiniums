import os
import unittest

from pipeline.observatorio_saneamento import gold


class ObservatorioSaneamento(unittest.TestCase):
    """A gold publicada é reproduzível a partir do seed e as conferências fecham."""

    @classmethod
    def setUpClass(cls):
        cls.g = gold.construir()
        cls.arqs = gold.arquivos(cls.g)

    def test_gold_reproduzivel_byte_a_byte(self):
        for nome, b in self.arqs.items():
            caminho = os.path.join(gold.DESTINO, nome)
            with open(caminho, "rb") as f:
                self.assertEqual(f.read(), b, nome)

    def test_conferencias_fecham(self):
        conf = {c["id"]: c["valores"] for c in self.g["meta"]["conferencias"]}
        esg = conf["esgoto_populacao_universos"]
        self.assertEqual(esg["soma"], esg["dfe0001_consolidado_brasil"])
        self.assertEqual(esg["dfe0001_municipios_com_indicadores"] + esg["dfe0001_municipios_delegacao_sem_atendimento"], esg["soma"])
        for c in self.g["meta"]["conferencias"]:
            if "diferenca" in c["valores"]:
                self.assertEqual(c["valores"]["diferenca"], 0, c["id"])

    def test_cobertura(self):
        cob = self.g["meta"]["cobertura"]
        self.assertEqual(cob["municipios_ibge"], 5571)
        self.assertEqual(cob["municipios_censo_2022"], 5570)
        self.assertEqual(cob["agua_participantes"], 5144)
        self.assertEqual(cob["esgoto_participantes"], 2749)
        self.assertEqual(cob["esgoto_delegacao_sem_atendimento"], 1154)

    def test_ausencia_nao_vira_zero(self):
        fora = [m for m in self.g["municipios"] if m["s_ag"] == "nao_participou"]
        self.assertTrue(fora)
        for m in fora:
            self.assertIsNone(m["IAG0001"], m["id"])
            self.assertIsNone(m["ag_pop_at"], m["id"])


if __name__ == "__main__":
    unittest.main()
