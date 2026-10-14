"""Testes do pipeline do Observatório Brasileiro de Gás Natural (pipeline/gas). Sem rede: tudo sai do seed versionado."""
import gzip
import hashlib
import json
import os
import unittest

from pipeline.gas import base, gold, ler, validacoes, xlsx
from pipeline.gas.fontes import FONTES


class TestSeed(unittest.TestCase):
    def test_toda_fonte_tem_seed_e_manifesto(self):
        m = base.ler_manifesto()
        for fid, f in FONTES.items():
            self.assertIn(fid, m, fid)
            self.assertTrue(os.path.exists(os.path.join(base.SEED, f["seed"])), f["seed"])
            self.assertRegex(m[fid]["sha256_original"], r"^[0-9a-f]{64}$", fid)
            self.assertTrue(m[fid]["capturado_em"].endswith("Z"), fid)

    def test_seed_inteiro_confere_com_o_sha256_do_original(self):
        # fonte sem recorte: o seed descomprimido é o próprio arquivo baixado
        m = base.ler_manifesto()
        for fid, f in FONTES.items():
            if f.get("recorte") or fid == "anp_movimentacao":
                continue
            with self.subTest(fid=fid):
                self.assertEqual(hashlib.sha256(base.ler_seed(f["seed"])).hexdigest(), m[fid]["sha256_original"])

    def test_gzip_do_seed_e_deterministico(self):
        dados = b"a;b\n1;2\n"
        self.assertEqual(gzip.compress(dados, compresslevel=9, mtime=0), gzip.compress(dados, compresslevel=9, mtime=0))


class TestConversoes(unittest.TestCase):
    def test_numero_br(self):
        self.assertEqual(base.numero_br("1.234,5"), 1234.5)
        self.assertEqual(base.numero_br("3089,647"), 3089.647)
        self.assertIsNone(base.numero_br(""))
        self.assertIsNone(base.numero_br("-"))
        self.assertEqual(base.numero_br("0"), 0.0)

    def test_mes_e_dias(self):
        self.assertEqual(base.mes_iso("2026", "FEV"), "2026-02")
        self.assertEqual(base.mes_iso(2026, 9), "2026-09")
        self.assertEqual(base.dias_no_mes("2024-02"), 29)
        self.assertEqual(base.dias_no_mes("2026-12"), 31)

    def test_data_serial_excel(self):
        self.assertEqual(xlsx.data_serial("41275").isoformat(), "2013-01-01")

    def test_indice_encadeado(self):
        idx = gold._indice_encadeado({"2026-01": 1.0, "2026-02": 2.0}, "2026-01")
        self.assertAlmostEqual(idx["2026-02"], 100 * 1.01 * 1.02)

    def test_janela_de_meses(self):
        self.assertEqual(gold._meses_ate("2026-02", 3), ["2025-12", "2026-01", "2026-02"])
        self.assertEqual(gold._mes_menos("2026-03", 12), "2025-03")


class TestValidacoes(unittest.TestCase):
    def test_lacuna_de_transportadora_relevante_marca_o_mes(self):
        meses = [f"2025-{m:02d}" for m in range(1, 13)]
        entrega = {(m, "A"): 100.0 for m in meses} | {(m, "B"): 5.0 for m in meses}
        entrega[("2025-06", "A")] = 0.0
        entrega[("2025-07", "B")] = 500.0  # pequena e fora de escala: o par sai, o mês continua completo
        f = validacoes.cobertura_movimentacao(meses, ["A", "B"], entrega)
        self.assertIn("2025-06", f)
        self.assertNotIn("2025-07", f)
        self.assertIn(("2025-07", "B"), f["_pares"])

    def test_quebra_de_patamar_vira_anotacao(self):
        meses = [f"{2024 + (i // 12)}-{(i % 12) + 1:02d}" for i in range(18)]
        entrega = {(m, "A"): (100.0 if i < 14 else 30.0) for i, m in enumerate(meses)}
        q = validacoes.quebras_de_patamar(meses, ["A"], entrega, {"A": "A"})
        self.assertTrue(q)
        self.assertEqual(q[0]["mes"], meses[14])


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = gold.Saida()
        nac, meses = gold.producao_e_aproveitamento(cls.s)
        gold.importacao(cls.s, nac, meses)
        gold.precos(cls.s)
        gold.consumidor(cls.s)
        gold.mercado_e_infraestrutura(cls.s)
        gold.meta(cls.s)
        validacoes.conferir(cls.s)

    def test_gold_publicada_igual_a_reconstruida(self):
        # a gold do repositório é exatamente a que o código gera a partir do seed
        for nome, g in self.s.golds.items():
            with self.subTest(gold=nome):
                with open(os.path.join(base.GOLD, f"{nome}.json"), encoding="utf-8") as f:
                    publicada = json.load(f)
                self.assertEqual(json.loads(json.dumps(g, ensure_ascii=False)), publicada)

    def test_mar_mais_terra_igual_ao_total(self):
        for x in self.s.golds["producao"]["serie"]:
            self.assertAlmostEqual(x["mar"] + x["terra"], x["total"], places=2)

    def test_mes_inconsistente_sai_sem_parcelas(self):
        for x in self.s.golds["aproveitamento"]["serie"]:
            if x["situacao"] == "inconsistente":
                self.assertIsNone(x["disponivel"])
                self.assertIsNone(x["reinjecao"])
                self.assertIsNotNone(x["producao"])

    def test_ausencia_nunca_vira_zero_na_movimentacao(self):
        for x in self.s.golds["mercado"]["carregadores"]:
            if x["cobertura"] == "incompleta":
                self.assertIsNone(x["ativos"])

    def test_media_ponderada_brasil(self):
        g = self.s.golds["precos"]
        vd = ler.vendas_distribuidoras()
        u = g["ultimo_mes"]
        linhas = [(p, v) for m, merc, reg, p, v in vd if m == u and merc == "Não Térmico"]
        esperado = sum(p * v for p, v in linhas) / sum(v for _, v in linhas)
        serie = next(x for x in g["serie"] if x["mes"] == u)
        self.assertAlmostEqual(serie["nao_termico"], round(esperado, 2), places=2)

    def test_conversao_em_dolar_usa_ptax_do_mesmo_mes(self):
        g = self.s.golds["precos"]
        ptax = ler.ptax()
        for x in g["internacional"]:
            if x["brasil_nao_termico_usd"] is not None:
                nt = next(s["nao_termico"] for s in g["serie"] if s["mes"] == x["mes"])
                self.assertAlmostEqual(x["brasil_nao_termico_usd"], round(nt / ptax[x["mes"]], 2), places=2)

    def test_preco_real_do_mes_base_igual_ao_nominal(self):
        g = self.s.golds["gas-de-cozinha"]
        base_ = next(x for x in g["serie"] if x["mes"] == g["mes_base_real"])
        self.assertAlmostEqual(base_["medio_real"], base_["medio"], places=2)

    def test_todo_indicador_calculado_tem_formula(self):
        for nome, g in self.s.golds.items():
            for chave, ind in (g.get("indicadores") or {}).items():
                if ind["natureza"] == "CALCULADO":
                    self.assertTrue(ind.get("formula"), f"{nome}.{chave}")

    def test_um_terminal_de_gnl_por_linha(self):
        nomes = [t["terminal"] for t in self.s.golds["infraestrutura"]["terminais_gnl"]]
        self.assertEqual(len(nomes), len(set(nomes)))
        self.assertIn("Pecém", nomes)
        self.assertIn("Baía de Guanabara", nomes)

    def test_janela_do_aproveitamento_so_com_meses_completos(self):
        bal = ler.balanco_producao()
        nac = {k: {m for (m, _, _) in d} for k, d in bal.items()}
        ap = self.s.golds["aproveitamento"]
        ini, fim = ap["indicadores"]["disponivel"]["periodo"].split(" a ")
        for m in gold._meses_ate(fim, 12):
            for k, meses in nac.items():
                self.assertIn(m, meses, f"{k} sem {m} na janela publicada")

    def test_parcela_ausente_nao_vira_zero_na_janela(self):
        # o último mês da produção sem as demais parcelas desloca a janela para trás, em vez de somar zero
        s = gold.Saida()
        original = ler.balanco_producao
        def com_mes_extra():
            b = original()
            ultimo = max(m for m, _, _ in b["producao"])
            a, mm = (int(x) for x in ultimo.split("-"))
            novo = f"{a + (mm == 12):04d}-{(mm % 12) + 1:02d}"
            b["producao"] = {**b["producao"], (novo, "RJ", "mar"): 5_000_000.0}
            return b
        ler.balanco_producao = com_mes_extra
        try:
            gold.producao_e_aproveitamento(s)
        finally:
            ler.balanco_producao = original
        ap = s.golds["aproveitamento"]
        self.assertEqual(ap["ultimo_mes"], self.s.golds["aproveitamento"]["ultimo_mes"])
        self.assertEqual(ap["indicadores"]["disponivel"]["valor"], self.s.golds["aproveitamento"]["indicadores"]["disponivel"]["valor"])

    def test_series_csv_publicadas_existem(self):
        for nome in self.s.series:
            self.assertTrue(os.path.exists(os.path.join(base.SERIES, f"{nome}.csv")), nome)


if __name__ == "__main__":
    unittest.main()
