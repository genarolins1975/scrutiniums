"""Aceites BMC: referências reais, comparabilidade, ausências e pacote imutável."""
import copy
import csv
import io
import json
import unittest
from pathlib import Path

from pipeline.eficiencia_comparavel.contrato import ROOT, PRIMARY, SAMPLE_WARNING, compare, read_catalog, validate_measure, validate_peer_variables, verify_frozen
from pipeline.eficiencia_comparavel.gold import build, csv_bytes, quantile
from pipeline.eficiencia_comparavel.padroniza import cell, normalize
from pipeline.eficiencia_comparavel.validacoes import validate


class ContratoBMCTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build(only_capitals=True)
        cls.measures = {m["id"]: m for m in cls.data["medidas"]}

    def test_208_observacoes_reconciliam_exatamente_com_as_entradas_auditadas(self):
        pilot = json.loads((ROOT / "docs/obee/resultados/piloto-2022-v2.json").read_text())
        candidate = json.loads((ROOT / "docs/obee/resultados/cesta-conjunta.json").read_text())
        scenario = next(s for s in candidate["scenarios"] if s["id"] == "conjunta__domicilios_gt2__materiais_40pct")
        additions = {r["id"]: r["candidate_raw_pct"] for r in scenario["rows"]}
        health = json.loads((ROOT / "docs/obee/resultados/saude-contagens-2021-2023.json").read_text())
        counts = {r["id"]: r for r in health["rows"]}
        rows = {(r["municipio"], r["medida"]): r for r in self.data["capitais"]}
        self.assertEqual(len(rows), 208)
        for city in pilot["rows"]:
            for new, old in (("educacao", "educacao"), ("renda", "trabalho"), ("mobilidade", "mobilidade"), ("saneamento", "saneamento"), ("homicidios", "seguranca")):
                self.assertEqual(rows[city["id"], new]["valor"], city["raw_values"][old])
            self.assertEqual(rows[city["id"], "habitacao"]["valor"], additions[city["id"]]["habitacao"])
            self.assertEqual(rows[city["id"], "internet"]["valor"], additions[city["id"]]["conectividade"])
            self.assertEqual(rows[city["id"], "mortalidade_infantil"]["valor"], counts[city["id"]]["pooled_rate_per_1000"])
            self.assertEqual({k[1] for k in rows if k[0] == city["id"]}, set(PRIMARY))

    def test_medida_c_e_medida_b_sem_marca_sao_recusadas(self):
        aps = self.data["capacidade_servicos"][0]
        with self.assertRaisesRegex(ValueError, "Medida C"):
            compare(aps, aps, self.measures["aps"])
        b = next(r for r in self.data["capitais"] if r["alinhamento"] == "B")
        with self.assertRaisesRegex(ValueError, "marca"):
            compare(b, b, self.measures[b["medida"]], marked_b=False)
        unmarked = dict(b, marca_alinhamento="")
        with self.assertRaisesRegex(ValueError, "sem marca"):
            compare(unmarked, b, self.measures[b["medida"]])
        changed = dict(self.measures["homicidios"], desvios=["modelo", "outro desvio"])
        with self.assertRaisesRegex(ValueError, "exatamente um"):
            validate_measure(changed)

    def test_ressalva_em_cada_valor_e_em_cada_linha_do_csv(self):
        export = list(csv.DictReader(io.StringIO(csv_bytes(self.data).decode("utf-8-sig")), delimiter=";"))
        self.assertEqual(len(export), 208)
        for row in self.data["capitais"]:
            measure = self.measures[row["medida"]]
            self.assertEqual(row["ressalva_precisao"], measure["ressalva_precisao"])
            exported = next(r for r in export if (r["municipio"], r["medida"]) == (row["municipio"], row["medida"]))
            self.assertEqual(exported["ressalva_precisao"], row["ressalva_precisao"])
            self.assertEqual(exported["alinhamento"], row["alinhamento"])
            if measure["amostra_censo"]:
                self.assertEqual(row["ressalva_precisao"], SAMPLE_WARNING)
            if measure["precisao"] != "QUANTIFICADA":
                self.assertIsNone(row["erro_padrao"])
                self.assertIsNone(row["intervalo_95"])
                self.assertEqual(exported["erro_padrao"], "")

    def test_pares_nao_podem_usar_variavel_de_resultado(self):
        for outcome in PRIMARY:
            with self.subTest(outcome=outcome), self.assertRaises(ValueError):
                validate_peer_variables(["grande_regiao", outcome])
        validate_peer_variables(["grande_regiao", "populacao_censo_2022"])

    def test_54_hashes_e_manifesto_original_conferem(self):
        self.assertEqual(verify_frozen()["arquivos"], 54)
        self.assertNotIn("5300108", {r["municipio"] for r in self.data["capitais"]})

    def test_zero_ausencia_e_denominador_invalido_nao_se_confundem(self):
        self.assertEqual(cell("0"), (0.0, "OBSERVADO"))
        self.assertEqual(cell("-"), (None, "NAO_DISPONIVEL"))
        self.assertEqual(cell("-", zero_absoluto=True), (0.0, "OBSERVADO"))
        self.assertEqual(cell("..."), (None, "NAO_DISPONIVEL"))
        self.assertEqual(cell("X"), (None, "SUPRIMIDO"))
        sample = next(r for r in self.data["capitais"] if r["medida"] == "renda")
        absent = dict(sample, valor=None, estado="NAO_DISPONIVEL")
        self.assertIsNone(compare(absent, sample, self.measures["renda"]))
        self.assertEqual(compare(dict(sample, valor=0), sample, self.measures["renda"]), -sample["valor"])

    def test_precisao_da_saude_e_condicional_a_contagens_registradas(self):
        row = next(r for r in self.data["capitais"] if r["medida"] == "mortalidade_infantil" and r["municipio"] == "2611606")
        self.assertEqual((row["numerador"], row["denominador"]), (581, 52484))
        self.assertAlmostEqual(row["valor"], 11.070040393262708, places=12)
        self.assertAlmostEqual(row["intervalo_95"][0], 10.19, places=2)
        self.assertAlmostEqual(row["intervalo_95"][1], 12.01, places=2)
        self.assertIn("subnotificação", row["ressalva_precisao"])
        self.assertEqual(row["alinhamento"], "B")

    def test_particao_6805_rejeita_dupla_contagem_e_unidade_errada(self):
        data = json.loads((ROOT / "pipeline/eficiencia_resultados/seed/sidra6805-values.json").read_text())
        cities = self.data["municipios"]
        valid = normalize(6805, data, cities)
        self.assertAlmostEqual(valid["2611606"]["valor"], 77.83129757188183)
        wrong = copy.deepcopy(data)
        wrong[1]["MN"] = "Pessoas"
        with self.assertRaisesRegex(ValueError, "Unidade"):
            normalize(6805, wrong, cities)
        wrong = copy.deepcopy(data)
        row = next(r for r in wrong[1:] if r["D1C"] == "2611606" and r["D4C"] == "46290")
        row["V"] = str(int(row["V"]) + 1)
        with self.assertRaisesRegex(ValueError, "Hierarquia"):
            normalize(6805, wrong, cities)

    def test_quartis_tipo_sete_e_estado_de_precisao(self):
        values = [0, 10, 20, 30]
        self.assertEqual([quantile(values, p) for p in (.25, .5, .75)], [7.5, 15, 22.5])
        self.assertIsNone(quantile([], .5))
        validate(self.data, require_universe=False)
        wrong = copy.deepcopy(self.data)
        wrong["observacoes"][0]["intervalo_95"] = [0, 100]
        with self.assertRaisesRegex(ValueError, "Incerteza não quantificada"):
            validate(wrong, require_universe=False)


class UniversoBMCTest(unittest.TestCase):
    def test_318_municipios_sem_df_reconciliam_as_26_capitais(self):
        data = validate(build())
        self.assertEqual(len(data["municipios"]), 318)
        self.assertEqual(sum(c["capital"] for c in data["municipios"]), 26)
        self.assertEqual(len(data["reconciliacao"]["consultas"]), 26 * 6)
        frozen = {(r["municipio"], r["medida"]): r["valor"] for r in data["capitais"]}
        for row in data["observacoes"]:
            if row["municipio"] in {c["id"] for c in data["municipios"] if c["capital"]}:
                self.assertEqual(row["valor"], frozen[row["municipio"], row["medida"]])


if __name__ == "__main__":
    unittest.main()
