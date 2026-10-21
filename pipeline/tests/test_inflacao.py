"""Testes do pipeline do IPCA por área (pipeline/inflacao). Sem rede: tudo sai do seed versionado.

Os casos sintéticos provam que cada validação retém a publicação: pesos que não somam 100, mês faltando,
variação fora da faixa plausível, 12 meses que não confere com o encadeamento, área a mais ou a menos e
coleta que volta no tempo.
"""
import copy
import csv
import io
import json
import re
import unittest

from pipeline.inflacao import coleta, gold, run, validacoes
from pipeline.inflacao import fontes as F


def seed():
    return run.ler_seed()


class TestFonte(unittest.TestCase):
    def test_dezesseis_areas_e_o_brasil_nove_grupos(self):
        self.assertEqual(len(F.AREAS), 17)
        self.assertEqual(len({a[0] for a in F.AREAS}), 17)
        self.assertEqual(sum(1 for a in F.AREAS if a[3] == "regiao_metropolitana"), 10)
        self.assertEqual(sum(1 for a in F.AREAS if a[3] == "municipio"), 6)
        self.assertEqual([g[1] for g in F.GRUPOS], [str(i) for i in range(1, 10)])

    def test_valor_do_sidra(self):
        self.assertEqual(coleta.valor("4.58"), 4.58)
        self.assertEqual(coleta.valor("-0.12"), -0.12)
        self.assertIsNone(coleta.valor("..."))
        self.assertEqual(coleta.valor("-"), "-")
        with self.assertRaises(ValueError):
            coleta.valor("X")

    def test_meses(self):
        self.assertEqual(coleta.mes_anterior("202609", 11), "202510")
        self.assertEqual(coleta.mes_anterior("202601", 1), "202512")
        self.assertEqual(validacoes.mes_seguinte("202512"), "202601")


class TestSeedVersionado(unittest.TestCase):
    def test_seed_passa_em_todas_as_validacoes(self):
        self.assertEqual(validacoes.validar_seed(seed()), [])

    def test_manifesto_com_sha256_e_captura(self):
        m = json.loads(run.MANIFESTO.read_text(encoding="utf-8"))
        self.assertTrue(m["capturado_em"].endswith("Z"))
        self.assertEqual(m["capturado_em"], seed()["capturado_em"])
        self.assertGreaterEqual(len(m["originais"]), 5)
        for url, o in m["originais"].items():
            self.assertRegex(o["sha256"], r"^[0-9a-f]{64}$", url)
            self.assertEqual(o["status"], 200, url)
            self.assertGreater(o["bytes"], 0, url)
            self.assertTrue(url.startswith(("https://apisidra.ibge.gov.br/", "https://servicodados.ibge.gov.br/")), url)

    def test_publicacao_versionada_e_a_do_seed(self):
        for caminho, texto in run.saidas(seed(), None).items():
            self.assertEqual(caminho.read_text(encoding="utf-8"), texto, str(caminho))

    def test_doze_meses_ausente_so_em_2020(self):
        s = seed()
        doze = s["grupos"][F.BRASIL][F.GERAL][F.V_DOZE]
        sem = [m for m, x in zip(s["meses"], doze) if x is None]
        self.assertEqual(sem, sorted(F.SEM_DOZE_MESES))


class TestValidacoesRetem(unittest.TestCase):
    """Cada caso estraga uma cópia do seed e espera a retenção (GoldInvalida) com o motivo."""

    def reprova(self, s, trecho):
        with self.assertRaises(gold.GoldInvalida) as ctx:
            gold.construir(s)
        self.assertIn(trecho, str(ctx.exception))

    def test_pesos_que_nao_somam_100(self):
        s = copy.deepcopy(seed())
        s["grupos"]["3501"]["7170"][F.V_PESO][-1] += 0.5
        self.reprova(s, "pesos dos nove grupos somam")

    def test_peso_de_subitem_que_nao_soma_100(self):
        s = copy.deepcopy(seed())
        k = next(k for k, x in s["subitens"]["valores"]["1"].items() if x[2] != "-")
        s["subitens"]["valores"]["1"][k][2] += 1
        self.reprova(s, "pesos dos subitens no último mês")

    def test_mes_faltando_no_meio_da_serie(self):
        s = copy.deepcopy(seed())
        i = 30
        del s["meses"][i]
        for pora in s["grupos"].values():
            for porv in pora.values():
                for v in porv.values():
                    del v[i]
        self.reprova(s, "mês faltando")

    def test_valor_faltando_num_mes(self):
        s = copy.deepcopy(seed())
        s["grupos"]["2301"]["7625"][F.V_MENSAL][40] = "ausente"
        self.reprova(s, "faltando")

    def test_valor_nao_disponivel_fora_de_2020(self):
        s = copy.deepcopy(seed())
        s["grupos"]["2301"]["7625"][F.V_DOZE][40] = None
        self.reprova(s, "sem valor")

    def test_variacao_fora_da_faixa(self):
        s = copy.deepcopy(seed())
        s["grupos"]["4101"][F.GERAL][F.V_MENSAL][-1] = 7.5
        self.reprova(s, "fora da faixa plausível")

    def test_doze_meses_que_nao_confere_com_o_encadeamento(self):
        s = copy.deepcopy(seed())
        s["grupos"]["4301"]["7445"][F.V_DOZE][-3] += 0.8
        self.reprova(s, "encadeado")

    def test_area_a_menos(self):
        s = copy.deepcopy(seed())
        del s["grupos"]["5300108"]
        self.reprova(s, "áreas diferentes")

    def test_area_renomeada_na_fonte(self):
        s = copy.deepcopy(seed())
        s["areas_fonte"]["1501"] = "Manaus - AM"
        self.reprova(s, "chamada 'Manaus - AM'")

    def test_subitem_com_traco_em_parte_dos_campos(self):
        s = copy.deepcopy(seed())
        k = next(k for k, x in s["subitens"]["valores"]["1501"].items() if x[0] == "-")
        s["subitens"]["valores"]["1501"][k][0] = 3.0
        self.reprova(s, "só em parte dos campos")

    def test_coleta_que_volta_no_tempo(self):
        g = gold.construir(seed())
        publicada = {**g, "ultimo_mes": "2099-01"}
        with self.assertRaises(gold.GoldInvalida) as ctx:
            gold.construir(seed(), publicada)
        self.assertIn("já vai até 2099-01", str(ctx.exception))


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = json.loads(run.GOLD.read_text(encoding="utf-8"))

    def test_identidade_e_datas(self):
        g = self.g
        self.assertEqual(g["fonte"]["tabela"], "7060")
        self.assertEqual(g["primeiro_mes"], "2020-01")
        self.assertEqual(g["primeiro_mes_doze"], "2020-12")
        self.assertRegex(g["ultimo_mes"], r"^\d{4}-\d{2}$")
        self.assertEqual(g["meses"][-12], g["inicio_janela"])
        self.assertRegex(g["fonte"]["divulgado_em"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertGreater(g["fonte"]["divulgado_em"], g["ultimo_mes"])
        p = g["fonte"]["proxima_divulgacao"]
        if p:
            self.assertGreater(p["data"], g["fonte"]["divulgado_em"])
            self.assertGreater(p["referencia"], g["ultimo_mes"])
        self.assertRegex(g["hash_dados"], r"^[0-9a-f]{64}$")

    def test_series_alinhadas_aos_meses(self):
        for a in F.IDS_AREAS:
            self.assertEqual(len(self.g["serie"][a]["mensal"]), len(self.g["meses"]))
            self.assertEqual(len(self.g["serie"][a]["doze"]), len(self.g["meses"]))

    def test_contribuicoes_somam_o_indice_e_o_residuo_e_de_arredondamento(self):
        for a, u in self.g["ultimo"].items():
            soma = sum(x["contribuicao_pp"] for x in u["grupos"].values())
            self.assertAlmostEqual(soma, u["soma_contribuicoes_pp"], delta=0.005)
            self.assertLessEqual(abs(u["residuo_pp"]), F.TOL_CONTRIBUICOES, a)
            for x in u["grupos"].values():
                self.assertAlmostEqual(x["contribuicao_pp"], x["peso_inicio"] * x["doze"] / 100, delta=0.001)

    def test_diferenca_para_o_brasil_em_pontos_percentuais(self):
        br = self.g["ultimo"][F.BRASIL]["geral"]["doze"]
        for u in self.g["ultimo"].values():
            self.assertAlmostEqual(u["geral"]["dif_brasil_pp"], u["geral"]["doze"] - br, delta=0.006)
        self.assertEqual(self.g["ultimo"][F.BRASIL]["geral"]["dif_brasil_pp"], 0)

    def test_destaques_so_com_peso_minimo_e_em_ordem(self):
        for a in F.IDS_AREAS:
            por_id = {x["id"]: x for x in self.g["subitens"][a]}
            d = self.g["destaques"][a]
            self.assertEqual(d["na_cesta"], len(por_id))
            for chave, ordem in (("sobem", -1), ("caem", 1)):
                itens = [por_id[i] for i in d[chave]]
                self.assertEqual(len(itens), 10)
                self.assertTrue(all(x["peso"] >= F.PESO_MINIMO_DESTAQUE for x in itens), a)
                v = [ordem * x["doze"] for x in itens]
                self.assertEqual(v, sorted(v), f"{a} {chave}")

    def test_subitem_fora_da_cesta_nao_vira_zero(self):
        s = seed()
        fora = [k for k, x in s["subitens"]["valores"]["1501"].items() if x[0] == "-"]
        self.assertGreater(len(fora), 0)
        ids = {x["id"] for x in self.g["subitens"]["1501"]}
        self.assertFalse(ids & set(fora))

    def test_nomes_sem_hifen_como_pontuacao(self):
        self.assertEqual(gold.nome_limpo("1106008.Banana - prata"), "Banana, prata")
        self.assertEqual(gold.nome_limpo("1101002.Arroz"), "Arroz")
        self.assertNotIn(" - ", self.g["fonte"]["nome_tabela"])
        for a in F.IDS_AREAS:
            for x in self.g["subitens"][a]:
                self.assertNotIn(" - ", x["nome"])

    def test_grupos_com_os_principais_itens_da_fonte(self):
        self.assertEqual([g["nome"] for g in self.g["grupos"]], [g[2] for g in F.GRUPOS])
        for g in self.g["grupos"]:
            self.assertEqual(len(g["principais"]), 3, g["nome"])
            for n in g["principais"]:
                self.assertNotRegex(n, r"^\d")


class TestArquivos(unittest.TestCase):
    def test_csv_com_ponto_e_virgula_e_virgula_decimal(self):
        texto = run.CSV_GRUPOS.read_text(encoding="utf-8")
        linhas = list(csv.reader(io.StringIO(texto), delimiter=";"))
        s = seed()
        self.assertEqual(len(linhas) - 1, 17 * 10 * len(s["meses"]))
        self.assertEqual(linhas[0][0], "area_codigo_ibge")
        br = [l for l in linhas if l[0] == "1" and l[3] == F.GERAL]
        self.assertEqual(br[-1][7], f"{s['grupos']['1'][F.GERAL][F.V_DOZE][-1]:.2f}".replace(".", ","))
        # 12 meses de jan/2020 vem vazio, nunca zero
        self.assertEqual(br[0][7], "")
        for l in linhas[1:200]:
            for c in l[5:]:
                self.assertNotIn(".", c)

    def test_csv_de_subitens_so_com_a_cesta_da_area(self):
        g = json.loads(run.GOLD.read_text(encoding="utf-8"))
        linhas = list(csv.reader(io.StringIO(run.CSV_SUBITENS.read_text(encoding="utf-8")), delimiter=";"))
        self.assertEqual(len(linhas) - 1, sum(len(v) for v in g["subitens"].values()))
        self.assertTrue(all(re.fullmatch(r"\d{4}-\d{2}", l[2]) for l in linhas[1:]))


if __name__ == "__main__":
    unittest.main()
