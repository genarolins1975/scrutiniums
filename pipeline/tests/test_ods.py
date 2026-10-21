import csv
import gzip
import io
import json
import unittest
from pathlib import Path

from pipeline.observatorio_saneamento import ods

RAIZ = Path(__file__).resolve().parents[2]
GOLD = RAIZ / "public" / "saneamento" / "gold" / "ods.json"


def linha(area, ano, valor, dims=None, nature="C", nome=None):
    return {"geoAreaCode": str(area), "geoAreaName": nome or f"area {area}", "timePeriodStart": float(ano), "value": str(valor),
            "attributes": {"Nature": nature, "Units": "PERCENT"}, "dimensions": dims if dims is not None else {"Reporting Type": "G"}, "source": "fonte"}


class LinhasDaSerie(unittest.TestCase):
    def test_so_a_versao_global_e_o_recorte_fixo(self):
        serie = {"codigo": "X", "fixo": {"Activity": "TOTAL"}}
        resp = {"data": [
            linha(76, 2023, 1.4, {"Reporting Type": "G", "Activity": "TOTAL"}),
            linha(76, 2023, 9.9, {"Reporting Type": "N", "Activity": "TOTAL"}),
            linha(76, 2023, 0.3, {"Reporting Type": "G", "Activity": "INDUSTRIES"}),
        ]}
        saida = ods.linhas_da_serie(resp, serie)
        self.assertEqual(len(saida), 1)
        self.assertEqual(saida[0][3], "1.4")

    def test_linha_repetida_faz_a_coleta_falhar(self):
        resp = {"data": [linha(76, 2022, 43.4), linha(76, 2022, 44.0)]}
        with self.assertRaises(ValueError):
            ods.linhas_da_serie(resp, {"codigo": "X"})


class ConstruirSerie(unittest.TestCase):
    def _linhas(self, brutas):
        saida = []
        for m49, ano, valor, dims in brutas:
            saida.append({"m49": m49, "area": "", "ano": ano, "valor": valor, "natureza": "C", "unidade": "PERCENT",
                          "dims": dims, "dimensoes": json.dumps(dims), "fonte": "f"})
        return saida

    def test_ano_comparado_e_o_ultimo_do_brasil_e_regioes_nao_entram_como_pais(self):
        paises = [{"m49": 76, "nome_onu": "Brazil", "regioes": []}, {"m49": 32, "nome_onu": "Argentina", "regioes": []}, {"m49": 999, "nome_onu": "Ilha", "regioes": []}]
        linhas = self._linhas([
            (76, 2020, 40.0, {}), (76, 2022, 43.4, {}),
            (32, 2022, 50.0, {}), (32, 2024, 55.0, {}), (999, 2022, 10.0, {}),
            (1, 2022, 57.8, {}), (1, 2024, 55.8, {}), (419, 2022, 45.9, {}),
        ])
        s = ods.construir_serie({"codigo": "X", "indicador": "6.3.1"}, linhas, paises, {76: "Brasil", 32: "Argentina"})
        self.assertEqual(s["ano_comparado"], 2022)
        self.assertEqual(s["mundo"]["valor"], 57.8)
        self.assertEqual(s["alc"]["valor"], 45.9)
        self.assertEqual([p["m49"] for p in s["paises"]], [32, 76, 999])
        self.assertEqual({p["m49"]: p["nome_origem"] for p in s["paises"]}, {32: "IBGE", 76: "IBGE", 999: "ONU"})
        self.assertEqual(s["historico"]["brasil"], [[2020, 40.0], [2022, 43.4]])

    def test_brasil_sem_valor_no_recorte_principal_falha(self):
        linhas = self._linhas([(32, 2022, 50.0, {})])
        with self.assertRaises(ValueError):
            ods.construir_serie({"codigo": "X", "indicador": "6.3.1"}, linhas, [{"m49": 32, "nome_onu": "Argentina", "regioes": []}], {})

    def test_recorte_ausente_fica_none(self):
        linhas = self._linhas([
            (76, 2024, 55.0, {"Location": "ALLAREA"}), (76, 2024, 56.6, {"Location": "URBAN"}),
            (1, 2024, 58.5, {"Location": "ALLAREA"}), (1, 2024, 48.5, {"Location": "RURAL"}),
        ])
        s = ods.construir_serie({"codigo": "X", "indicador": "6.2.1", "recorte": ("Location", ["ALLAREA", "URBAN", "RURAL"])},
                                linhas, [{"m49": 76, "nome_onu": "Brazil", "regioes": []}], {76: "Brasil"})
        self.assertIsNone(s["recortes"]["RURAL"]["brasil"])
        self.assertEqual(s["recortes"]["RURAL"]["mundo"]["valor"], 48.5)


class GoldPublicada(unittest.TestCase):
    """A gold publicada confere com o seed lido por outro caminho (CSV direto, sem o construtor)."""

    @classmethod
    def setUpClass(cls):
        cls.gold = json.loads(GOLD.read_text(encoding="utf-8"))
        cls.manifesto = json.loads((ods.SEED / "manifesto.json").read_text(encoding="utf-8"))

    def _seed(self, codigo):
        a = self.manifesto["arquivos"][codigo]
        texto = gzip.decompress((ods.SEED / a["arquivo"]).read_bytes()).decode("utf-8")
        return list(csv.DictReader(io.StringIO(texto), delimiter=";"))

    def test_todas_as_series_e_a_mesma_edicao(self):
        self.assertEqual(sorted(self.gold["series"]), sorted(s["codigo"] for s in ods.SERIES))
        self.assertEqual({s["edicao"] for s in self.gold["series"].values()}, {"2026.Q3.G.01"})

    def test_valores_de_brasil_mundo_e_regiao_reproduzem_do_seed(self):
        casos = {"EN_WWT_WWDS": ({}, 2022), "SH_STA_WASHARI": ({}, 2019), "ER_H2O_STRESS": ({"Activity": "TOTAL"}, 2023), "SH_H2O_SAFE": ({"Location": "ALLAREA"}, 2024)}
        for codigo, (dims, ano) in casos.items():
            linhas = [l for l in self._seed(codigo) if all(json.loads(l["dimensoes"]).get(k) == v for k, v in dims.items())]
            valor = {int(l["m49"]): float(l["valor"]) for l in linhas if int(l["ano"]) == ano and l["valor"] != ""}
            g = self.gold["series"][codigo]
            self.assertEqual(g["ano_comparado"], ano, codigo)
            self.assertEqual(g["brasil"]["valor"], valor[76], codigo)
            self.assertEqual(g["mundo"]["valor"], valor[1], codigo)
            self.assertEqual(g["alc"]["valor"], valor[419], codigo)
            self.assertEqual(max(int(l["ano"]) for l in linhas if int(l["m49"]) == 76 and l["valor"] != ""), ano, codigo)

    def test_valores_conferidos_na_consulta(self):
        s = self.gold["series"]
        self.assertAlmostEqual(s["EN_WWT_WWDS"]["brasil"]["valor"], 43.41, places=2)
        self.assertEqual(s["EN_WWT_WWDS"]["brasil"]["natureza"], "E")
        self.assertAlmostEqual(s["SH_STA_WASHARI"]["mundo"]["valor"], 18.21, places=2)
        self.assertAlmostEqual(s["ER_H2O_STRESS"]["brasil"]["valor"], 1.43, places=2)
        self.assertEqual(s["ER_H2O_IWRMD"]["brasil"]["valor"], 51.0)
        self.assertIsNone(s["DC_TOF_WASHL"]["mundo"])
        self.assertIsNone(s["SH_SAN_SAFE"]["recortes"]["RURAL"]["brasil"])

    def test_paises_so_da_classificacao_da_onu_e_brasil_entre_eles(self):
        paises_onu = {p["m49"] for p in json.loads(gzip.decompress((ods.SEED / "paises_onu.json.gz").read_bytes()))}
        for codigo, s in self.gold["series"].items():
            m49s = [p["m49"] for p in s["paises"]]
            self.assertTrue(set(m49s) <= paises_onu, codigo)
            self.assertNotIn(1, m49s, codigo)
            self.assertNotIn(419, m49s, codigo)
            br = [p for p in s["paises"] if p["m49"] == 76]
            self.assertEqual(len(br), 1, codigo)
            self.assertEqual(br[0]["valor"], s["brasil"]["valor"], codigo)
            self.assertEqual(br[0]["nome"], "Brasil", codigo)


if __name__ == "__main__":
    unittest.main()
