"""Fixtures inteiramente sintéticas: não constituem validação empírica do IF.data."""
from copy import deepcopy
from decimal import Decimal
from random import Random
import unittest

from pipeline.lucro_banco import (
    catalogar_rubricas, doze_meses, numero, periodo, ratear_pdd,
    reconciliar, simular_perda,
)


class PeriodosTest(unittest.TestCase):
    def test_acumulo_semestral(self):
        for mes, meses, inicio in (("03", 3, "01"), ("06", 6, "01"), ("09", 3, "07"), ("12", 6, "07")):
            with self.subTest(mes=mes):
                p = periodo("2026" + mes)
                self.assertEqual((p["meses"], p["inicio"]), (meses, "2026" + inicio))

    def test_data_invalida_nao_vira_semestre(self):
        for data in (202601, 202613, "2026-06", None, True):
            with self.subTest(data=data), self.assertRaises(ValueError):
                periodo(data)

    def test_doze_meses_nao_soma_quatro_acumulados(self):
        series = {"202509": {"lucro": 10}, "202512": {"lucro": 30},
                  "202603": {"lucro": 20}, "202606": {"lucro": 50}}
        resultado = doze_meses(series, "202606", ["lucro", "tarifas"])
        self.assertEqual(resultado["valores"], {"lucro": 80, "tarifas": None})
        self.assertEqual(resultado["componentes"], ["202512", "202606"])
        self.assertEqual(resultado["meses"], 12)

    def test_semestre_aberto_lacuna_e_quebra(self):
        self.assertEqual(doze_meses({}, 202603, ["lucro"])["motivo"], "semestre_aberto")
        self.assertEqual(doze_meses({"202506": {}}, 202512, ["lucro"])["motivo"], "semestre_ausente")
        self.assertEqual(doze_meses({"202412": {}, "202506": {}}, 202506, ["lucro"])["motivo"], "quebra_plano_2025")

    def test_zero_publicado_e_ausencia_parcial(self):
        r = doze_meses({"202506": {"lucro": 0, "tarifas": 10}, "202512": {"lucro": 0}}, 202512, ["lucro", "tarifas"])
        self.assertEqual(r["valores"], {"lucro": 0, "tarifas": None})


class CatalogoTest(unittest.TestCase):
    def test_ids_vem_do_template_e_info_da_data(self):
        template = {"c": [{"ifd": 10}, {"ifd": 20, "sc": [{"ifd": 21}]}]}
        info = [{"id": 10, "n": "Instituição", "lid": -1},
                {"id": 20, "n": "Receitas\n financeiras", "lid": 901},
                {"id": 21, "n": "Operações de crédito", "lid": 902}]
        r = catalogar_rubricas(template, info, 999)
        self.assertEqual([v["lid"] for v in r], [901, 902])
        self.assertEqual(r[1]["caminho"], ["Receitas financeiras", "Operações de crédito"])
        self.assertTrue(r[0]["tem_subcolunas"])
        self.assertFalse(r[1]["tem_subcolunas"])
        info[2]["lid"] = 123456
        self.assertEqual(catalogar_rubricas(template, info, 999)[1]["lid"], 123456)

    def test_referencia_quebrada_e_ambiguidade(self):
        with self.assertRaises(ValueError):
            catalogar_rubricas({"c": [{"ifd": 12}]}, [], 999)
        with self.assertRaises(ValueError):
            catalogar_rubricas({}, [{"id": 1}, {"id": 1}], 999)


class ReconciliacaoTest(unittest.TestCase):
    def test_receitas_despesas_e_credito_tributario_assinados(self):
        r = reconciliar({"receita": 100, "captacao": -40, "perda": -20,
                         "servicos": 10, "pessoal": -20, "tributos": 5}, 35)
        self.assertTrue(r["reconciliado"])
        self.assertEqual(r["diferenca"], 0)

    def test_prejuizo_e_tolerancia_absoluta_inclusiva(self):
        self.assertTrue(reconciliar({"receita": 10, "despesa": -30}, -20)["reconciliado"])
        self.assertTrue(reconciliar({"receita": "100.00"}, "99.00")["reconciliado"])
        self.assertFalse(reconciliar({"receita": "100.01"}, "99.00")["reconciliado"])
        self.assertFalse(reconciliar({"receita": "100000000000.01"}, "99999999999")["reconciliado"])

    def test_divergencia_nao_e_plugada_em_outras(self):
        degraus = {"receita": 100, "despesa": -10}
        r = reconciliar(degraus, 70)
        self.assertFalse(r["reconciliado"])
        self.assertEqual(r["diferenca"], 20)
        self.assertEqual(degraus, {"receita": 100, "despesa": -10})

    def test_ausencia_nao_vira_zero(self):
        for valores, lucro in (({}, 0), ({"receita": None}, 0), ({"receita": 0}, None)):
            with self.subTest(valores=valores, lucro=lucro):
                r = reconciliar(valores, lucro)
                self.assertFalse(r["reconciliado"])
                self.assertIsNone(r["soma"])
        self.assertTrue(reconciliar({"receita": 0}, 0)["reconciliado"])

    def test_invalidos_nao_chegam_ao_grafico(self):
        for valor in (True, "NaN", float("inf"), "abc"):
            with self.subTest(valor=valor), self.assertRaises(ValueError):
                numero(valor)
        with self.assertRaises(ValueError):
            reconciliar({"receita": 1}, 1, -1)


class RateioTest(unittest.TestCase):
    def setUp(self):
        self.linhas = [{"id": "pf:cartao", "saldo": 100, "vencido15": 20},
                       {"id": "pj:giro", "saldo": 300, "vencido15": 10}]

    def test_dois_metodos_fecham_estoque_e_fluxo(self):
        r = ratear_pdd(self.linhas, 60, -30)
        a, b = r["linhas"]
        self.assertEqual(a["provisao"]["faixa"], [15, 40])
        self.assertEqual(b["provisao"]["faixa"], [20, 45])
        self.assertEqual(a["cobertura"]["vencido15"], 2)
        self.assertEqual(a["participacao_carteira"], Decimal("0.25"))
        for metodo in ("vencido15", "saldo"):
            self.assertEqual(sum(l["provisao"][metodo] for l in r["linhas"]), 60)
            self.assertEqual(sum(l["despesa"][metodo] for l in r["linhas"]), -30)
            self.assertEqual(sum(l["participacao_pdd"][metodo] for l in r["linhas"]), 1)
        self.assertTrue(all(l["estimativa_de_modelo"] for l in r["linhas"]))

    def test_fracoes_periodicas_preservam_total_sem_ratear_em_base_zero(self):
        linhas = [{"id": str(i), "saldo": 1, "vencido15": 1} for i in range(3)]
        linhas.append({"id": "zero", "saldo": 0, "vencido15": 0})
        r = ratear_pdd(linhas, 1, -1)
        for medida, esperado in (("provisao", 1), ("despesa", -1)):
            for metodo in ("vencido15", "saldo"):
                self.assertEqual(sum(l[medida][metodo] for l in r["linhas"]), esperado)
                self.assertEqual(r["linhas"][-1][medida][metodo], 0)

    def test_sem_vencido_nao_recebe_sensibilidade(self):
        self.linhas.append({"id": "ausente", "saldo": 100, "vencido15": None})
        r = ratear_pdd(self.linhas, 60, -30)
        self.assertTrue(r["universo_condicional"])
        self.assertEqual(r["sem_base"], ["ausente"])
        self.assertIsNone(r["linhas"][-1]["provisao"])
        self.assertEqual(sum(l["provisao"]["saldo"] for l in r["linhas"][:2]), 60)
        self.assertEqual(r["linhas"][0]["participacao_carteira"], Decimal("0.2"))

    def test_todos_sem_atraso_nao_inventa_faixa(self):
        for linha in self.linhas:
            linha["vencido15"] = 0
        r = ratear_pdd(self.linhas, 60, -30)
        self.assertEqual(r["nao_alocado"]["vencido15"], {"provisao": 60, "despesa": -30})
        self.assertIsNone(r["linhas"][0]["provisao"]["faixa"])
        self.assertIsNone(r["linhas"][0]["cobertura"]["saldo"])

    def test_estoque_ausente_fluxo_zero_e_reversao(self):
        r = ratear_pdd(self.linhas, None, 0)
        self.assertIsNone(r["linhas"][0]["provisao"]["faixa"])
        self.assertEqual(r["linhas"][0]["despesa"]["faixa"], [0, 0])
        r = ratear_pdd(self.linhas, 60, 30)
        self.assertEqual(sum(l["despesa"]["vencido15"] for l in r["linhas"]), 30)

    def test_sem_linhas_nao_perde_total(self):
        r = ratear_pdd([], 60, -30)
        self.assertEqual(r["linhas"], [])
        self.assertEqual(r["nao_alocado"]["saldo"]["provisao"], 60)

    def test_soma_exata_em_carteiras_com_ate_cem_modalidades(self):
        gerador = Random(4966)
        for quantidade in range(1, 101):
            linhas = []
            for i in range(quantidade):
                saldo = gerador.randrange(1, 100000)
                linhas.append({"id": str(i), "saldo": saldo, "vencido15": gerador.randrange(1, saldo + 1)})
            r = ratear_pdd(linhas, Decimal("1234567.89"), Decimal("-987654.32"))
            for medida, total in (("provisao", Decimal("1234567.89")), ("despesa", Decimal("-987654.32"))):
                for metodo in ("saldo", "vencido15"):
                    with self.subTest(quantidade=quantidade, medida=medida, metodo=metodo):
                        self.assertEqual(sum(l[medida][metodo] for l in r["linhas"]), total)

    def test_sem_mutacao_e_com_validacao_de_universo(self):
        antes = deepcopy(self.linhas)
        ratear_pdd(self.linhas, 60, -30)
        self.assertEqual(self.linhas, antes)
        for linhas in ([self.linhas[0], self.linhas[0]],
                       [{"id": "a", "saldo": 10, "vencido15": 11}],
                       [{"id": "a", "saldo": -1, "vencido15": 0}]):
            with self.subTest(linhas=linhas), self.assertRaises(ValueError):
                ratear_pdd(linhas, 60, -30)


class SimulacaoTest(unittest.TestCase):
    def test_efeito_linear_com_tributos_fixos(self):
        self.assertEqual(simular_perda(100, -20, 10, 15, 100)["lucro_simulado"], 90)
        self.assertEqual(simular_perda(100, -20, 10, 5, 100)["lucro_simulado"], 110)
        self.assertEqual(simular_perda(100, -20, 10, 10, 100)["impacto_lucro"], 0)

    def test_sem_base_e_limites(self):
        for despesa, vencido in ((None, 1), (-20, 0), (10, 1), (0, 1)):
            self.assertFalse(simular_perda(100, despesa, vencido, 10, 100)["disponivel"])
        for novo in (-1, 101):
            with self.assertRaises(ValueError):
                simular_perda(100, -20, 10, novo, 100)


if __name__ == "__main__":
    unittest.main()
