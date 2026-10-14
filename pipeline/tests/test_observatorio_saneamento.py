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

    def test_investimento_dos_prestadores_reproduz_o_consolidado(self):
        br = next(a for a in self.g["agregados"] if a["id"] == "BR")
        for campo, servico in (("investimento_agua", "agua"), ("investimento_esgoto", "esgoto")):
            soma = gold.soma_parcial([p[campo] for p in self.g["prestadores"]])
            self.assertAlmostEqual(soma, br["sinisa"][servico]["investimento"]["total"], places=2, msg=campo)

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

    def test_desigualdades_hashes_e_totais_oficiais(self):
        from pipeline.observatorio_saneamento.desigualdades import construir, SPECS, numero
        d = construir()  # valida cada SHA-256, classificação, chave e limite de universo
        self.assertEqual(len(SPECS), 14)
        self.assertEqual(d["territorios"]["1:1"]["parda-esgoto"], [28509481, 91613309])
        self.assertEqual(d["territorios"]["1:1"]["quilombolas-esgoto"], [936282, 1327483])
        self.assertEqual(numero("-"), 0)
        for v in ("X", "..", "...", ""):
            self.assertIsNone(numero(v))
        with self.assertRaises(ValueError):
            numero("erro da API")

    def test_desigualdades_divergencias_sao_publicadas_sem_redistribuir(self):
        conf = self.g["meta"]["desigualdades"]["conferencias"]
        divergencias = {(c["id"], c["nivel"], c["campo"]): c["diferenca"] for c in conf if c["diferenca"]}
        self.assertEqual(divergencias, {
            ("favelas-agua", 6, "numerador"): -259,
            ("favelas-esgoto", 6, "numerador"): -679,
            ("favelas-esgoto", 6, "denominador"): -819,
        })
        self.assertEqual(self.g["meta"]["desigualdades"]["residuos_cor_raca"], {"universo": 7164, "agua": 596, "esgoto": 1276})
        for c in conf:
            if c["diferenca"]:
                self.assertEqual(c["ausentes"], 3)
        br = next(a for a in self.g["agregados"] if a["id"] == "BR")
        self.assertEqual(br["desigualdades"]["favelas-esgoto"], [4360958, 16349896])
        self.assertEqual(sum(m["des_favelas-esgoto_num"] is not None and (m["des_favelas-esgoto_den"] or 0) > 0 for m in self.g["municipios"]), 652)

    def test_desigualdades_catalogo_e_regioes(self):
        import json
        from pathlib import Path
        from pipeline.observatorio_saneamento.desigualdades import SPECS
        catalogo = json.loads((Path(gold.__file__).resolve().parents[2] / "src/lib/saneamento/dados/desigualdades.json").read_text())
        self.assertEqual(catalogo, [{k: s[k] for k in ["id", "grupo", "rotulo", "medida", "tabela", "unidade", "universo"]} for s in SPECS])
        for a in self.g["agregados"]:
            self.assertEqual(len(a["desigualdades"]), 14, a["id"])
        self.assertEqual(next(s for s in SPECS if s["id"] == "favelas-agua")["unidade"], "domicílios")
        self.assertEqual(next(s for s in SPECS if s["id"] == "favelas-esgoto")["unidade"], "moradores")


if __name__ == "__main__":
    unittest.main()
