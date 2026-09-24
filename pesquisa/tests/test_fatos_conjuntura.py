"""Testes do pacote de fatos da nota de conjuntura (stdlib, sem rede).

Rodar: python3 -m unittest discover -s pesquisa/tests -t .
"""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest

from pesquisa import fatos_conjuntura as fc

RAIZ = fc.RAIZ
GOLD = fc.GOLD_PUBLICADA


def _serie(unidade, pares, codigo="0", yoy=None, yoy_real=None):
    s = {"tipo": "DADO OBSERVADO",
         "meta": {"source": "BCB/SGS", "series_code": codigo, "unit": unidade},
         "obs": [{"ref": r, "v": v} for r, v in pares]}
    if yoy is not None:
        s["yoy"] = [{"ref": r, "v": v} for r, v in yoy]
    if yoy_real is not None:
        s["yoy_real"] = [{"ref": r, "v": v} for r, v in yoy_real]
    return s


def _meses(ini_ano, ini_mes, n):
    out = []
    a, m = ini_ano, ini_mes
    for _ in range(n):
        out.append(f"{a:04d}-{m:02d}-01")
        m += 1
        if m == 13:
            a, m = a + 1, 1
    return out


def _gold_sintetica(dirpath, **troca):
    refs = _meses(2025, 1, 14)  # 2025-01 .. 2026-02
    series = {
        "saldo_total": _serie("R$ milhões", [(r, 1_000_000.0 + i * 10_000) for i, r in enumerate(refs)], "20539",
                              yoy=[(refs[-1], 12.345)], yoy_real=[(refs[-1], 7.891)]),
        "inad_total": _serie("%", [(r, 3.0 + i * 0.01) for i, r in enumerate(refs)], "21082"),
        # defasada um mês, como endividamento e comprometimento na gold real
        "endividamento": _serie("%", [(r, 48.0) for r in refs[:-1]], "29037"),
        # só 3 meses de história: delta em 12 meses tem de virar lacuna, nunca estimativa
        "spread_total": _serie("p.p.", [(r, 20.0 - i * 0.5) for i, r in enumerate(refs[-3:])], "20783"),
    }
    series.update(troca)
    with open(os.path.join(dirpath, "pulse.json"), "w", encoding="utf-8") as f:
        json.dump({"gerado_em": "2026-03-20T00:00:00+00:00", "series": series}, f)
    with open(os.path.join(dirpath, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"gerado_em": "2026-03-20T00:00:00+00:00", "vintages": {"sgs": "2026-02"}}, f)


def _por_id(pacote):
    return {f["id"]: f for f in pacote["fatos"]}


class GoldSintetica(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        _gold_sintetica(self.tmp.name)
        self.p = fc.construir(self.tmp.name)
        self.f = _por_id(self.p)

    def tearDown(self):
        self.tmp.cleanup()

    def test_data_base_vem_da_serie_ancora(self):
        self.assertEqual(self.p["data_base"], "2026-02")
        self.assertEqual(self.p["serie_ancora"], "saldo_total")

    def test_nivel_observado_e_o_valor_da_gold(self):
        f = self.f["inad_total.nivel"]
        self.assertEqual(f["tipo"], "observado")
        self.assertAlmostEqual(f["valor"], 3.13)
        self.assertEqual(f["texto"], "3,13%")
        self.assertEqual(f["fonte"], "BCB/SGS 21082")
        self.assertEqual(f["origem"], {"arquivo": "pulse.json", "serie": "inad_total", "campo": "obs",
                                       "ref": "2026-02-01"})

    def test_calculados_declaram_formula_e_insumos(self):
        d = self.f["inad_total.delta_12m_pp"]
        self.assertEqual(d["tipo"], "calculado_pacote")
        self.assertEqual(d["formula"], "diferenca")
        self.assertEqual([i["ref"] for i in d["insumos"]], ["2026-02-01", "2025-02-01"])
        self.assertAlmostEqual(d["valor"], 0.12)
        self.assertEqual(d["texto"], "+0,12 p.p.")
        self.assertEqual(d["texto_abs"], "0,12 p.p.")
        self.assertEqual(d["sinal"], "+")
        v = self.f["saldo_total.var_mes_pct"]
        self.assertAlmostEqual(v["valor"], (1_130_000 / 1_120_000 - 1) * 100, places=5)

    def test_variacao_do_pipeline_e_lida_nao_recalculada(self):
        f = self.f["saldo_total.var_12m_pct"]
        self.assertEqual(f["tipo"], "calculado_pipeline")
        self.assertEqual(f["valor"], 12.345)
        self.assertEqual(f["texto"], "+12,3%")
        self.assertEqual(self.f["saldo_total.var_12m_real_pct"]["valor"], 7.891)

    def test_negativo_usa_sinal_de_menos_nunca_hifen(self):
        f = self.f["spread_total.delta_mes_pp"]
        self.assertEqual(f["sinal"], fc.MENOS)
        self.assertEqual(f["texto"], f"{fc.MENOS}0,50 p.p.")
        for fato in self.p["fatos"]:
            self.assertNotIn("-", fato["texto"], fato["id"])
            self.assertNotIn("–", fato["texto"], fato["id"])
            self.assertNotIn("—", fato["texto"], fato["id"])

    def test_historia_curta_vira_lacuna_nao_estimativa(self):
        self.assertNotIn("spread_total.delta_12m_pp", self.f)
        lac = [l for l in self.p["lacunas"] if l["fato"] == "spread_total.delta_12m_pp"]
        self.assertEqual(len(lac), 1)
        self.assertIn("não estimada", lac[0]["motivo"])

    def test_serie_ausente_e_declarada(self):
        self.assertIn({"fato": "concessoes_total.*", "motivo": "série concessoes_total ausente em pulse.json"},
                      self.p["lacunas"])

    def test_serie_defasada_usa_a_propria_ref_e_declara(self):
        f = self.f["endividamento.nivel"]
        self.assertEqual(f["data_ref"], "2026-01")
        self.assertIn({"serie": "endividamento", "data_ref": "2026-01", "data_base": "2026-02",
                       "nota": "divulgação com defasagem própria; citar com a data de referência do fato"},
                      self.p["defasagens"])

    def test_unidade_fora_do_contrato_nao_entra(self):
        with tempfile.TemporaryDirectory() as t:
            _gold_sintetica(t, inad_total=_serie("índice", [("2026-02-01", 1.0)]))
            p = fc.construir(t)
        self.assertNotIn("inad_total.nivel", _por_id(p))
        self.assertTrue(any(l["fato"] == "inad_total.*" and "unidade" in l["motivo"] for l in p["lacunas"]))

    def test_sem_serie_ancora_nao_ha_pacote(self):
        with tempfile.TemporaryDirectory() as t:
            _gold_sintetica(t, saldo_total=_serie("R$ milhões", []))
            with self.assertRaises(ValueError):
                fc.construir(t)

    def test_deterministico(self):
        p2 = fc.construir(self.tmp.name)
        self.assertEqual(json.dumps(self.p, sort_keys=True), json.dumps(p2, sort_keys=True))
        self.assertEqual(self.p["sha256_fatos"], fc.sha256_fatos(self.p["fatos"]))

    def test_verificacao_limpa_contra_a_mesma_gold(self):
        self.assertEqual(fc.verificar(self.p, self.tmp.name), [])

    def test_verificacao_acusa_numero_adulterado(self):
        p = copy.deepcopy(self.p)
        alvo = next(f for f in p["fatos"] if f["id"] == "inad_total.nivel")
        alvo["valor"] = 3.14
        p["sha256_fatos"] = fc.sha256_fatos(p["fatos"])  # adulteração que recalcula o hash
        div = fc.verificar(p, self.tmp.name)
        self.assertEqual([d["fato"] for d in div], ["inad_total.nivel"])
        self.assertEqual(div[0]["problema"], "valor diverge da gold")

    def test_verificacao_acusa_pacote_editado_sem_recalcular_hash(self):
        p = copy.deepcopy(self.p)
        p["fatos"][0]["texto"] = "qualquer coisa"
        div = fc.verificar(p, self.tmp.name)
        self.assertEqual(div[0]["fato"], "*")

    def test_revisao_da_fonte_aparece_na_verificacao(self):
        with tempfile.TemporaryDirectory() as t:
            refs = _meses(2025, 1, 14)
            revisada = _serie("%", [(r, 3.0 + i * 0.01) for i, r in enumerate(refs)], "21082")
            revisada["obs"][-2]["v"] = 3.99  # BCB revisa o mês anterior
            _gold_sintetica(t, inad_total=revisada)
            div = fc.verificar(self.p, t)
        self.assertEqual(sorted(d["fato"] for d in div), ["inad_total.delta_mes_pp"])


class Formatacao(unittest.TestCase):
    def test_niveis_em_reais(self):
        self.assertEqual(fc._nivel_texto(7_372_243.0, "R$ milhões"), "R$ 7,37 trilhões")
        self.assertEqual(fc._nivel_texto(736_820.0, "R$ milhões"), "R$ 736,8 bilhões")
        self.assertEqual(fc._nivel_texto(512.0, "R$ milhões"), "R$ 512 milhões")

    def test_niveis_em_taxa(self):
        self.assertEqual(fc._nivel_texto(32.08, "% a.a."), "32,08% a.a.")
        self.assertEqual(fc._nivel_texto(20.88, "p.p."), "20,88 p.p.")
        self.assertEqual(fc._nivel_texto(4.88, "%"), "4,88%")

    def test_zero_sem_sinal(self):
        self.assertEqual(fc._com_sinal(0.001, 2, " p.p."), "0,00 p.p.")
        self.assertEqual(fc._sinal(-0.001, 2), "0")


@unittest.skipUnless(os.path.exists(os.path.join(GOLD, "pulse.json")), "gold publicada ausente")
class GoldPublicada(unittest.TestCase):
    """O mesmo contrato contra a gold que está no ar (public/obs/data/gold)."""

    @classmethod
    def setUpClass(cls):
        cls.p = fc.construir(GOLD)
        with open(os.path.join(GOLD, "pulse.json"), encoding="utf-8") as f:
            cls.pulse = json.load(f)

    def test_escopo_completo_sem_lacuna_de_serie(self):
        series = {l["fato"] for l in self.p["lacunas"] if l["fato"].endswith(".*")}
        self.assertEqual(series, set())
        ids = {f["id"] for f in self.p["fatos"]}
        for key, _r, _fam in fc.ESCOPO:
            self.assertIn(f"{key}.nivel", ids)

    def test_data_base_e_a_ultima_do_saldo_total(self):
        ultima = self.pulse["series"]["saldo_total"]["obs"][-1]["ref"][:7]
        self.assertEqual(self.p["data_base"], ultima)

    def test_cada_nivel_confere_com_releitura_independente(self):
        for f in self.p["fatos"]:
            if f["tipo"] != "observado":
                continue
            obs = self.pulse["series"][f["origem"]["serie"]]["obs"]
            v = next(o["v"] for o in obs if o["ref"] == f["origem"]["ref"])
            self.assertEqual(f["valor"], v, f["id"])

    def test_pacote_reproduzivel_contra_a_propria_gold(self):
        self.assertEqual(fc.verificar(self.p, GOLD), [])

    def test_nenhum_numero_fora_do_contrato(self):
        for f in self.p["fatos"]:
            self.assertIn(f["tipo"], {"observado", "calculado_pipeline", "calculado_pacote"})
            if f["tipo"] == "calculado_pacote":
                self.assertIn(f["formula"], {"diferenca", "variacao_pct"})
                self.assertEqual(len(f["insumos"]), 2)

    def test_linha_de_comando_grava_e_verifica(self):
        with tempfile.TemporaryDirectory() as t:
            saida = os.path.join(t, "pacote.json")
            r = subprocess.run([sys.executable, "-m", "pesquisa.fatos_conjuntura", "--saida", saida],
                               cwd=RAIZ, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            r = subprocess.run([sys.executable, "-m", "pesquisa.fatos_conjuntura", "--verificar", saida],
                               cwd=RAIZ, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("0 divergências", r.stdout)


if __name__ == "__main__":
    unittest.main()
