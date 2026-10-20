"""Testes do pipeline do capítulo 7.1 do Saneamento (pipeline/saneamento_divida). Sem rede: tudo sai do seed versionado.

Os casos sintéticos provam que cada validação retém a publicação: balanço que não fecha, dívida que não soma as
subcontas, escala trocada, companhia esperada ausente, seed adulterado e universo que não se reproduz. Provam também a
regra de ausência (EBITDA negativo, patrimônio líquido negativo e resultado financeiro sem abertura viram None com o
motivo, nunca zero) e conferem os indicadores contra as contas publicadas.
"""
import copy
import json
import re
import unittest

from pipeline.saneamento_divida import fontes as F
from pipeline.saneamento_divida import gold, indicadores, run, universo, validacoes

SABESP = "43776517000180"


def seed():
    return gold.ler_seed()


def _conta(linhas, cnpj, fonte, data, escopo, conta, ordem="ÚLTIMO", ini=None):
    for l in linhas:
        if (l["CNPJ_CIA"], l["fonte"], l["DT_REFER"], l["escopo"], l["CD_CONTA"], l["ORDEM_EXERC"]) == (cnpj, fonte, data, escopo, conta, ordem) and (
            ini is None or l["DT_INI_EXERC"] == ini
        ):
            return l
    raise KeyError((cnpj, fonte, data, escopo, conta, ordem, ini))


class TestSeedVersionado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seed()
        cls.g, cls.linhas = gold.construir(cls.s)

    def test_publicacao_versionada_e_a_do_seed(self):
        for caminho, texto in run.saidas(self.s).items():
            self.assertTrue(caminho.exists(), caminho)
            self.assertEqual(caminho.read_bytes().decode("utf-8"), texto, f"{caminho} não é a do seed: rode python3 -m pipeline.saneamento_divida.run")

    def test_originais_com_sha256_e_endereco_oficial(self):
        m = self.s["manifesto"]
        self.assertEqual(m["cadastro"]["url"], F.URL_CADASTRO)
        anos_dfp = [o["ano"] for o in m["originais"] if o["fonte"] == "DFP"]
        anos_itr = [o["ano"] for o in m["originais"] if o["fonte"] == "ITR"]
        self.assertEqual(anos_dfp, list(range(F.PRIMEIRO_ANO_DFP, anos_dfp[-1] + 1)))
        self.assertEqual(anos_itr, list(range(F.PRIMEIRO_ANO_ITR, anos_itr[-1] + 1)))
        for o in m["originais"]:
            self.assertEqual(o["url"], (F.URL_DFP if o["fonte"] == "DFP" else F.URL_ITR).format(ano=o["ano"]))
            self.assertRegex(o["sha256"], r"^[0-9a-f]{64}$")
            for nome, mem in o["membros"].items():
                self.assertRegex(mem["sha256"], r"^[0-9a-f]{64}$", nome)
        self.assertTrue(m["capturado_em"].endswith("Z"))

    def test_universo_por_cnpj_com_esperadas_e_holdings(self):
        cnpjs = {u["cnpj"] for u in self.s["manifesto"]["universo"]}
        for c in F.ESPERADAS:
            self.assertIn(c, cnpjs)
        papeis = {u["cnpj"]: u for u in self.s["manifesto"]["universo"]}
        # Aegea é holding e controla Corsan e Prolagos pela cadeia declarada no FRE (CNPJ, não nome)
        self.assertEqual(papeis["08827501000158"]["papel"], "holding")
        self.assertIn("92802784000190", papeis["08827501000158"]["controladas"])
        self.assertIn("08827501000158", papeis["92802784000190"]["holdings"])
        # nenhuma distribuidora de gás nem empresa de resíduos entra: só CNPJ declarado ou controlador de declarado
        self.assertNotIn("61856571000117", cnpjs)  # Comgás
        self.assertNotIn("11421994000136", cnpjs)  # Orizon
        self.assertEqual(validacoes.validar_universo(self.s["manifesto"]["universo"], self.s["manifesto"]["universo"], indicadores.agrupar(self.s["demonstracoes"])), [])

    def test_seed_sem_conta_fora_da_lista(self):
        permitidas = {c for v in F.CONTAS.values() for c in v}
        self.assertTrue(all(l["CD_CONTA"] in permitidas for l in self.s["demonstracoes"]))

    def test_divida_bruta_e_soma_das_contas_publicadas(self):
        """Exemplo real: Copasa, DFP de 2025, consolidado."""
        copasa = next(c for c in self.g["companhias"] if c["cnpj"] == "17.281.106/0001-03")
        p = next(x for x in copasa["anual"] if x["periodo"] == "2025")
        L = self.s["demonstracoes"]
        v = lambda conta: float(_conta(L, "17281106000103", "DFP", "2025-12-31", p["escopo"], conta)["VL_CONTA"])  # noqa: E731
        self.assertEqual(p["escopo"], "con")
        bruta = v("2.01.04.01") + v("2.01.04.02") + v("2.02.01.01") + v("2.02.01.02")
        self.assertAlmostEqual(p["divida_bruta"], bruta, places=3)
        self.assertAlmostEqual(p["caixa"], v("1.01.01") + v("1.01.02"), places=3)
        self.assertAlmostEqual(p["divida_liquida"], bruta - v("1.01.01") - v("1.01.02"), places=3)
        self.assertAlmostEqual(p["ebitda"], v("3.05") + abs(float(_conta(L, "17281106000103", "DFP", "2025-12-31", "con", "7.04.01")["VL_CONTA"])), places=3)
        self.assertAlmostEqual(p["dl_ebitda"], round(p["divida_liquida"] / p["ebitda"], 4), places=4)
        self.assertAlmostEqual(p["parcela_cp"], round((v("2.01.04.01") + v("2.01.04.02")) / bruta * 100, 4), places=4)

    def test_ebitda_de_12_meses_no_trimestre(self):
        """EBITDA do trimestre = acumulado do ano + exercício anterior − acumulado do mesmo período do ano anterior."""
        L = self.s["demonstracoes"]
        sab = next(c for c in self.g["companhias"] if c["cnpj"] == "43.776.517/0001-80")
        p = next(x for x in sab["trimestral"] if x["periodo"] == "2T2026")
        e = lambda fonte, data, ordem, ini: float(_conta(L, SABESP, fonte, data, "con", "3.05", ordem, ini)["VL_CONTA"]) + abs(  # noqa: E731
            float(_conta(L, SABESP, fonte, data, "con", "7.04.01", ordem, ini)["VL_CONTA"]))
        esperado = e("ITR", "2026-06-30", "ÚLTIMO", "2026-01-01") + e("DFP", "2025-12-31", "ÚLTIMO", None) - e("ITR", "2026-06-30", "PENÚLTIMO", "2025-01-01")
        self.assertAlmostEqual(p["ebitda"], esperado, places=3)

    def test_ausencia_tem_motivo_e_nunca_zero(self):
        for c in self.g["companhias"]:
            for x in c["anual"] + c["trimestral"]:
                if x.get("retido"):
                    self.assertTrue(all(x[k] is None for k in gold.CAMPOS_VALOR + gold.CAMPOS_RAZAO))
                    continue
                for campo in ("dl_ebitda", "dl_pl", "parcela_cp", "cobertura"):
                    if x[campo] is None:
                        self.assertIn(campo, x["motivos"], f"{c['nome']} {x['periodo']}")
        # Sabesp passou a publicar só o resultado financeiro líquido: cobertura ausente com motivo, não zero
        sab = next(c for c in self.g["companhias"] if c["cnpj"] == "43.776.517/0001-80")
        self.assertIsNone(sab["ultimo"]["cobertura"])
        self.assertEqual(sab["ultimo"]["motivos"]["cobertura"], indicadores.SEM_ABERTURA_FINANCEIRA)

    def test_inconsistencias_conhecidas_viram_ausencia(self):
        chaves = {(re.sub(r"\D", "", i["cnpj"]), i["fonte"], i["data"]) for i in self.g["inconsistencias"]}
        self.assertEqual(chaves, set(F.INCONSISTENCIAS_CONHECIDAS))
        for i in self.g["inconsistencias"]:
            self.assertTrue(i["motivo"].startswith("demonstração publicada inconsistente"))

    def test_csv_tem_uma_linha_por_ponto(self):
        self.assertEqual(len(self.linhas["anual"]), sum(len(c["anual"]) for c in self.g["companhias"]))
        self.assertEqual(len(self.linhas["trimestral"]), sum(len(c["trimestral"]) for c in self.g["companhias"]))
        self.assertTrue(gold.csv_texto(self.linhas["anual"]).startswith("﻿cnpj;companhia"))

    def test_referencias_e_hash(self):
        self.assertEqual(self.g["ultima_dfp"], "2025-12-31")
        self.assertRegex(self.g["referencia_trimestral"], r"^\d{4}-(03-31|06-30|09-30|12-31)$")
        self.assertRegex(self.g["hash_dados"], r"^[0-9a-f]{64}$")


class TestValidacoesRetem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = seed()

    def _mudar(self, cnpj, fonte, data, conta, fator=None, valor=None, escopo="con"):
        s = copy.deepcopy(self.base)
        alvo = _conta(s["demonstracoes"], cnpj, fonte, data, escopo, conta)
        alvo["VL_CONTA"] = str(valor if valor is not None else float(alvo["VL_CONTA"]) * fator)
        return s

    def _reprova(self, s, trecho):
        with self.assertRaises(gold.GoldInvalida) as ctx:
            gold.construir(s, recalcular_universo=False)
        self.assertIn(trecho, str(ctx.exception))

    def test_seed_integro_constroi(self):
        g, _ = gold.construir(copy.deepcopy(self.base), recalcular_universo=False)
        self.assertGreaterEqual(len(g["companhias"]), F.UNIVERSO_MINIMO)

    def test_ativo_diferente_do_passivo(self):
        self._reprova(self._mudar(SABESP, "DFP", "2025-12-31", "1", fator=1.01), "diferente do passivo total")

    def test_passivo_diferente_dos_grupos(self):
        s = self._mudar(SABESP, "DFP", "2025-12-31", "2.03", fator=0.5)
        self._reprova(s, "diferente da soma de circulante, não circulante e patrimônio líquido")

    def test_divida_que_nao_soma_as_subcontas(self):
        self._reprova(self._mudar("17281106000103", "DFP", "2025-12-31", "2.02.01.02", fator=1.5), "diferentes da soma das subcontas")

    def test_escala_trocada(self):
        s = copy.deepcopy(self.base)
        for l in s["demonstracoes"]:
            if (l["CNPJ_CIA"], l["fonte"], l["DT_REFER"]) == ("17281106000103", "DFP", "2025-12-31"):
                l["ESCALA_MOEDA"] = "UNIDADE"
        self._reprova(s, "a escala declarada (unidade de real) pode estar trocada")

    def test_depreciacao_positiva(self):
        self._reprova(self._mudar("17281106000103", "DFP", "2025-12-31", "7.04.01", fator=-1), "depreciação da DVA com sinal positivo")

    def test_companhia_esperada_ausente(self):
        s = copy.deepcopy(self.base)
        s["demonstracoes"] = [l for l in s["demonstracoes"] if not (l["CNPJ_CIA"] == "76484013000145" and l["DT_REFER"] == "2025-12-31" and l["fonte"] == "DFP")]
        self._reprova(s, "companhia esperada sem a DFP de 2025: Sanepar")

    def test_universo_que_nao_se_reproduz(self):
        u = self.base["manifesto"]["universo"]
        recalculado = [x for x in u if x["cnpj"] != "46119855000137"]
        g = indicadores.agrupar(self.base["demonstracoes"])
        self.assertIn("universo do manifesto diferente", " ".join(validacoes.validar_universo(u, recalculado, g)))

    def test_universo_abaixo_do_minimo(self):
        u = self.base["manifesto"]["universo"][: F.UNIVERSO_MINIMO - 1]
        g = indicadores.agrupar(self.base["demonstracoes"])
        self.assertIn("abaixo do mínimo", " ".join(validacoes.validar_universo(u, u, g)))

    def test_seed_adulterado(self):
        import tempfile
        import shutil
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "seed"
            shutil.copytree(gold.SEED, p)
            m = json.loads((p / "manifesto.json").read_text(encoding="utf-8"))
            m["arquivos"]["demonstracoes"]["sha256"] = "0" * 64
            (p / "manifesto.json").write_text(json.dumps(m), encoding="utf-8")
            with self.assertRaises(gold.GoldInvalida):
                gold.ler_seed(p)


class TestIndicadores(unittest.TestCase):
    def test_ebitda_negativo_e_pl_negativo_viram_ausencia(self):
        bal = {"1": 100.0, "1.01.01": 5.0, "1.01.02": 5.0, "2.01.04": 10.0, "2.01.04.01": 10.0, "2.02.01": 40.0, "2.02.01.02": 40.0, "2.03": -3.0}
        p = indicadores.ponto(bal, -2.0, 4.0, None)
        self.assertIsNone(p["dl_ebitda"])
        self.assertIn("EBITDA negativo", p["motivos"]["dl_ebitda"])
        self.assertIsNone(p["dl_pl"])
        self.assertIn("patrimônio líquido negativo", p["motivos"]["dl_pl"])
        self.assertIsNone(p["cobertura"])
        self.assertEqual(p["divida_bruta"], 50.0)
        self.assertEqual(p["divida_liquida"], 40.0)
        self.assertEqual(p["parcela_cp"], 20.0)

    def test_linha_sem_abertura_usa_o_total_e_marca(self):
        bal = {"2.01.04": 30.0, "2.01.04.01": 0.0, "2.01.04.02": 0.0, "2.01.04.03": 0.0, "2.02.01": 70.0, "2.02.01.01": 70.0, "2.02.01.02": 0.0, "2.02.01.03": 5.0}
        d = indicadores.divida(bal)
        self.assertEqual(d["divida_bruta"], 100.0)
        self.assertEqual(d["sem_abertura"], ["2.01.04"])

    def test_arrendamento_fica_fora_da_divida(self):
        bal = {"2.01.04": 15.0, "2.01.04.01": 10.0, "2.01.04.02": 0.0, "2.01.04.03": 5.0, "2.02.01": 0.0}
        self.assertEqual(indicadores.divida(bal)["divida_bruta"], 10.0)

    def test_resultado_financeiro_sem_abertura(self):
        e, df = indicadores.ebitda_de({"3.05": 10.0, "7.04.01": -2.0, "3.06": -4.0, "3.06.01": 0.0, "3.06.02": 0.0})
        self.assertEqual(e, 12.0)
        self.assertIsNone(df)

    def test_cnpj_e_universo_sem_nome(self):
        self.assertEqual(universo.cnpj14("43.776.517/0001-80"), SABESP)
        cad = [{"CNPJ_CIA": "11.111.111/0001-11", "SETOR_ATIV": "Saneamento, Serv. Água e Gás"}]
        c = universo.candidatos({"22222222000122": {"1"}}, {"22222222000122": [("11111111000111", 2), ("33333333000133", 1)]}, cad)
        self.assertEqual(c["11111111000111"]["papel"], "holding")
        self.assertNotIn("33333333000133", c)  # controlador fora do setor de saneamento não entra


if __name__ == "__main__":
    unittest.main()
