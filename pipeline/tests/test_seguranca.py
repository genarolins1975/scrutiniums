"""Testes do pipeline Segurança pública por UF (pipeline/seguranca). Sem rede: tudo sai dos seeds versionados.

Os casos sintéticos provam que cada validação retém a publicação (ano faltando, evento renomeado, UF a menos,
revisão acima do limite, total do TabNet que não fecha, população que não soma, despesa fora da faixa) e que a
regra de ausência separa zero de falta de envio.
"""
import copy
import csv
import io
import json
import math
import tempfile
import unittest
from pathlib import Path

from pipeline.seguranca import coleta, gold, run, validacoes
from pipeline.seguranca import fontes as F


def seeds():
    return run.ler_seeds()


class TestSeedsVersionados(unittest.TestCase):
    def test_seeds_passam_em_todas_as_validacoes(self):
        self.assertEqual(validacoes.validar_seeds(seeds()), [])

    def test_publicacao_versionada_e_a_dos_seeds(self):
        for caminho, texto in run.saidas(seeds()).items():
            self.assertTrue(caminho.exists(), caminho)
            self.assertEqual(caminho.read_bytes().decode("utf-8"), texto, f"{caminho} não é a dos seeds: rode python3 -m pipeline.seguranca.run")

    def test_originais_com_sha256_e_endereco_oficial(self):
        s = seeds()
        for a, f in s["sinesp"]["arquivos"].items():
            self.assertRegex(f["sha256"], r"^[0-9a-f]{64}$", a)
            self.assertTrue(f["url"].startswith("https://www.gov.br/mj/"), a)
            self.assertGreater(f["linhas"], 100_000, a)
        for url, o in s["sim"]["originais"].items():
            self.assertTrue(url.startswith("http://tabnet.datasus.gov.br/"), url)
            self.assertRegex(o["sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(s["ibge"]["original"]["url"].startswith("https://ftp.ibge.gov.br/"))
        for k, o in s["siconfi"]["originais"].items():
            self.assertTrue(o["url"].startswith(F.API_SICONFI), k)
        for fonte in s.values():
            self.assertTrue(fonte["capturado_em"].endswith("Z"))


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()
        cls.g = gold.construir(cls.s)

    def test_taxa_e_contagem_sobre_a_populacao_do_mesmo_ano(self):
        g = self.g
        for ind in g["indicadores"]:
            den = ind["denominador"]
            if not den or ind["id"] in ("indeterminadas_pct", "despesa_participacao"):
                continue
            for uf in F.SIGLAS:
                x = g["series"][ind["id"]][uf]
                for k, a in enumerate(g["anos"]):
                    n = x["n"][k]
                    if n is None:
                        self.assertIsNone(x["taxa"][k])
                        continue
                    pop = g["populacao"][uf]["mulheres" if den == "mulheres" else "total"][k]
                    self.assertAlmostEqual(x["taxa"][k], n / pop * ind["escala"], delta=0.006, msg=f"{ind['id']} {uf} {a}")

    def test_ausencia_nunca_vira_zero(self):
        g = self.g
        for ind in g["indicadores"]:
            for uf in F.SIGLAS:
                x = g["series"][ind["id"]][uf]
                if "situacao" not in x or "motivo" not in x:
                    continue
                for k in range(len(g["anos"])):
                    if x["situacao"][k] in ("incompleto", "sem_registro"):
                        self.assertIsNone(x["n"][k])
                        self.assertTrue(x["motivo"][k])
                    elif x["situacao"][k] == "ok":
                        self.assertIsNotNone(x["n"][k])

    def test_brasil_e_a_soma_das_ufs_com_dado_e_declara_a_cobertura(self):
        g = self.g
        for ind in g["indicadores"]:
            br = g["series"][ind["id"]][F.BRASIL]
            if "cobertura" not in br or "fora" not in br:
                continue
            for k in range(len(g["anos"])):
                ok = [uf for uf in F.SIGLAS if g["series"][ind["id"]][uf]["situacao"][k] == "ok"]
                self.assertEqual(br["cobertura"][k], len(ok))
                self.assertEqual(sorted(br["fora"][k]), sorted(set(F.SIGLAS) - set(ok)))
                if br["n"][k] is not None:
                    self.assertAlmostEqual(br["n"][k], sum(g["series"][ind["id"]][uf]["n"][k] for uf in ok), places=2)
                    self.assertEqual(br["situacao"][k], "ok" if len(ok) == 27 else "parcial")
                if br["variacao"][k] is not None:
                    self.assertEqual(br["situacao"][k], "ok")
                    self.assertEqual(br["situacao"][k - 1], "ok")

    def test_posicao_e_diferenca_para_o_brasil(self):
        g = self.g
        h = g["series"]["homicidio"]
        for k in range(len(g["anos"])):
            taxas = {uf: h[uf]["taxa"][k] for uf in F.SIGLAS if h[uf]["taxa"][k] is not None}
            for uf, t in taxas.items():
                self.assertEqual(h[uf]["posicao"][k], 1 + sum(1 for v in taxas.values() if v > t))
                self.assertAlmostEqual(h[uf]["diferenca"][k], t - h[F.BRASIL]["taxa"][k], delta=0.011)
            self.assertEqual(h[F.BRASIL]["comparadas"][k], len(taxas))

    def test_sim_bate_com_o_tabnet_e_o_ultimo_ano_final_e_o_das_notas(self):
        g, s = self.g, self.s
        ag = s["sim"]["consultas"]["agressoes"]
        for k, a in enumerate(g["anos"]):
            if str(a) in ag["total"]:
                self.assertEqual(g["series"]["agressoes"][F.BRASIL]["n"][k], ag["total"][str(a)])
        self.assertEqual(g["fontes"]["sim"]["final_ate"], s["sim"]["notas"]["final_ate"])
        self.assertTrue(all(v in ("final", "preliminar") for v in g["fontes"]["sim"]["situacao"].values()))

    def test_comparacao_policia_saude(self):
        g = self.g
        for uf in [*F.SIGLAS, F.BRASIL]:
            for k in range(len(g["anos"])):
                r = g["policia_saude"][uf][k]
                h, a = g["series"]["homicidio"][uf], g["series"]["agressoes"][uf]
                if r is not None:
                    self.assertAlmostEqual(r, h["n"][k] / a["n"][k], places=3)

    def test_csv_tem_uma_linha_por_indicador_territorio_e_ano(self):
        texto = gold.csv_taxas(self.g)
        self.assertTrue(texto.startswith("﻿"))
        linhas = list(csv.reader(io.StringIO(texto.lstrip("﻿")), delimiter=";"))
        self.assertEqual(len(linhas) - 1, len(self.g["indicadores"]) * 28 * len(self.g["anos"]))
        cab = linhas[0]
        br = [l for l in linhas[1:] if l[0] == "homicidio" and l[4] == "Brasil"]
        k = len(self.g["anos"]) - 1
        self.assertEqual(br[k][cab.index("contagem")], str(self.g["series"]["homicidio"][F.BRASIL]["n"][k]))

    def test_hash_ignora_a_data_de_captura(self):
        s2 = copy.deepcopy(self.s)
        for v in s2.values():
            v["capturado_em"] = "2030-01-01T00:00:00Z"
        self.assertEqual(gold.construir(s2)["hash_dados"], self.g["hash_dados"])


def _vde_minimo(anos=(2015, 2016), meses_ultimo=12, valor=10):
    arquivos, valores = {}, {}
    for a in anos:
        m = meses_ultimo if a == anos[-1] else 12
        arquivos[str(a)] = {"url": "u", "status": 200, "bytes": 1, "sha256": "0" * 64, "linhas": 1, "meses": m,
                            "ufs": list(F.SIGLAS), "eventos": [e[1] for e in F.EVENTOS], "abrangencias": ["Estadual"]}
        valores[str(a)] = {e: {uf: [valor * (20 if e == "homicidio" else 1)] * m for uf in F.SIGLAS} for e in F.IDS_EVENTOS}
    return {"arquivos": arquivos, "valores": valores}


class TestValidacoesRetem(unittest.TestCase):
    def test_vde_minimo_passa(self):
        self.assertEqual(validacoes.validar_vde(_vde_minimo()), [])

    def test_vde_ano_faltando_evento_renomeado_e_uf_a_menos(self):
        v = _vde_minimo((2015, 2017))
        self.assertTrue(any("sem o ano 2016" in p for p in validacoes.validar_vde(v)))
        v = _vde_minimo()
        v["arquivos"]["2016"]["eventos"].remove("Feminicídio")
        self.assertTrue(any("Feminicídio" in p for p in validacoes.validar_vde(v)))
        v = _vde_minimo()
        v["arquivos"]["2015"]["ufs"].remove("SP")
        self.assertTrue(any("UFs diferentes" in p for p in validacoes.validar_vde(v)))

    def test_vde_so_o_ultimo_ano_pode_ser_parcial(self):
        self.assertEqual(validacoes.validar_vde(_vde_minimo(meses_ultimo=9)), [])
        v = _vde_minimo(meses_ultimo=9)
        v["arquivos"]["2015"]["meses"] = 11
        self.assertTrue(any("só o último ano pode ser parcial" in p for p in validacoes.validar_vde(v)))

    def test_vde_revisao_acima_do_limite_e_volta_no_tempo(self):
        ant = _vde_minimo()
        novo = _vde_minimo(valor=12)
        self.assertTrue(any("revisão acima" in p for p in validacoes.validar_vde(novo, ant)))
        self.assertTrue(any("voltou no tempo" in p for p in validacoes.validar_vde(_vde_minimo((2015,)), ant)))

    def test_vde_negativo_e_total_implausivel(self):
        v = _vde_minimo()
        v["valores"]["2015"]["homicidio"]["SP"][0] = -1
        self.assertTrue(any("valor -1" in p for p in validacoes.validar_vde(v)))
        v = _vde_minimo(valor=1)
        self.assertTrue(any("faixa plausível" in p for p in validacoes.validar_vde(v)))

    def test_sim_total_que_nao_fecha_e_mulheres_acima_do_total(self):
        s = copy.deepcopy(seeds()["sim"])
        s["consultas"]["agressoes"]["total"]["2020"] += 1
        self.assertTrue(any("diferente da soma" in p for p in validacoes.validar_sim(s)))
        s = copy.deepcopy(seeds()["sim"])
        s["consultas"]["agressoes_mulheres"]["ufs"]["SP"]["2020"] = s["consultas"]["agressoes"]["ufs"]["SP"]["2020"] + 1
        s["consultas"]["agressoes_mulheres"]["total"]["2020"] = s["consultas"]["agressoes_mulheres"]["total"]["2020"] + s["consultas"]["agressoes"]["ufs"]["SP"]["2020"] + 1 - seeds()["sim"]["consultas"]["agressoes_mulheres"]["ufs"]["SP"]["2020"]
        self.assertTrue(any("contra mulheres" in p for p in validacoes.validar_sim(s)))

    def test_sim_ultimo_ano_final_nao_recua(self):
        s = seeds()["sim"]
        ant = copy.deepcopy(s)
        ant["notas"]["final_ate"] = s["notas"]["final_ate"] + 1
        self.assertTrue(any("recuou" in p for p in validacoes.validar_sim(s, ant)))

    def test_populacao_que_nao_soma(self):
        i = copy.deepcopy(seeds()["ibge"])
        i["populacao"]["SP"]["total"]["2020"] += 1
        self.assertTrue(any("soma das UFs" in p for p in validacoes.validar_ibge(i)))

    def test_despesa_fora_da_faixa(self):
        s = copy.deepcopy(seeds())
        s["siconfi"]["valores"]["SP"]["2020"]["seguranca"] = s["siconfi"]["valores"]["SP"]["2020"]["total"] * 0.5
        self.assertTrue(any("fora da faixa" in p for p in validacoes.validar_siconfi(s["siconfi"])))
        s = copy.deepcopy(seeds())
        s["siconfi"]["valores"]["AC"]["2020"]["seguranca"] = 1000.0
        self.assertTrue(any("por habitante" in p or "fora da faixa" in p for p in validacoes.validar_seeds(s)))

    def test_gold_retida_quando_um_seed_reprova(self):
        s = copy.deepcopy(seeds())
        del s["sinesp"]["arquivos"]["2016"]
        with self.assertRaises(gold.GoldInvalida):
            gold.construir(s)


class TestRegraDeAusencia(unittest.TestCase):
    def _sit(self, meses_sp, outros=20, anos=(2015, 2016)):
        v = _vde_minimo(anos)
        for a in anos:
            for uf in F.SIGLAS:
                v["valores"][str(a)]["feminicidio"][uf] = [outros] * 12
        v["valores"][str(anos[-1])]["feminicidio"]["SP"] = meses_sp
        ibge = seeds()["ibge"]
        ev = next(e for e in F.EVENTOS if e[0] == "feminicidio")
        return gold.situacao_vde(v, ibge, ev, list(anos))["SP"][anos[-1]]

    def test_ano_zerado_com_esperado_alto_e_sem_registro(self):
        n, sit, motivo = self._sit([0] * 12)
        self.assertEqual((n, sit), (None, "sem_registro"))
        self.assertIn("falta de envio", motivo)

    def test_ano_zerado_com_esperado_baixo_e_zero(self):
        self.assertEqual(self._sit([0] * 12, outros=0)[:2], (0, "ok"))

    def test_mes_zerado_improvavel_torna_o_ano_incompleto(self):
        n, sit, motivo = self._sit([12] * 11 + [0])
        self.assertEqual((n, sit), (None, "incompleto"))
        self.assertIn("dez", motivo)

    def test_mes_zerado_provavel_e_zero_de_verdade(self):
        self.assertEqual(self._sit([4] * 11 + [0])[:2], (44, "ok"))

    def test_mes_sem_valor_na_base_torna_o_ano_incompleto(self):
        n, sit, motivo = self._sit([12] * 11 + [None])
        self.assertEqual((n, sit), (None, "incompleto"))
        self.assertIn("sem valor na base", motivo)

    def test_chance_de_meses_zerados(self):
        self.assertAlmostEqual(gold.chance_zerados(1, 12), 1 - (1 - math.exp(-12)) ** 12, places=12)
        self.assertGreater(gold.chance_zerados(1, 4), F.PROB_MESES_ZERADOS)
        self.assertLess(gold.chance_zerados(1, 12), F.PROB_MESES_ZERADOS)
        self.assertAlmostEqual(gold.chance_zerados(0, 5), 1.0, places=12)


class TestLeitoresDasFontes(unittest.TestCase):
    def test_tabela_do_tabnet(self):
        resp = ('<PRE>"Unidade da Federa&ccedil;&atilde;o";"2023";"2024";"Total"\n"11 Rond&ocirc;nia";547;520;1067\n'
                '"35 S&atilde;o Paulo";2917;-;2917\n"00 Ignorado/exterior";1;-;1\n"Total";3465;520;3985\n</PRE>')
        t = coleta.tabela_prn(resp)
        self.assertEqual(t["anos"], [2023, 2024])
        self.assertEqual(t["ufs"], {"RO": [547, 520], "SP": [2917, 0]})
        self.assertEqual(t["outras"], {"00 Ignorado/exterior": [1, 0]})
        self.assertEqual(t["total"], [3465, 520])

    def test_notas_do_tabnet(self):
        form = ("<li>Dados finais dispon&iacute;veis at&eacute; 2024 - data de extra&ccedil;&atilde;o 02/12/2025.\n"
                "<li>Dados de 2025 - Preliminares - data de extra&ccedil;&atilde;o 28/07/2026.\n"
                "<li>Dados de 2026 - 2a pr&eacute;via - data de extra&ccedil;&atilde;o 01/09/2026.")
        n = coleta.notas_sim(form)
        self.assertEqual(n["final_ate"], 2024)
        self.assertEqual(n["preliminares"], {"2025": "28/07/2026"})
        self.assertEqual(n["previas"]["2026"]["edicao"], 2)

    def test_dca_com_os_dois_nomes_do_total(self):
        for total in F.CONTAS_TOTAL:
            itens = [
                {"conta": total, "coluna": "Despesas Liquidadas", "cod_conta": "TotalDespesas", "valor": 1000},
                {"conta": "06 - Segurança Pública", "coluna": "Despesas Liquidadas", "cod_conta": "TotalDespesas", "valor": 80},
                {"conta": "06 - Segurança Pública", "coluna": "Despesas Empenhadas", "cod_conta": "TotalDespesas", "valor": 90},
            ]
            self.assertEqual(coleta.despesa_dca(itens), {"seguranca": 80.0, "total": 1000.0})

    @unittest.skipUnless(__import__("importlib").util.find_spec("openpyxl"), "openpyxl não instalado")
    def test_agrega_planilha_do_vde_so_estadual_e_com_meses_sem_valor(self):
        import openpyxl
        from datetime import datetime

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(list(F.COLUNAS_VDE))
        def linha(uf, ev, mes, tv, tot, abr="Estadual"):
            ws.append([uf, "X", ev, datetime(2024, mes, 1), None, None, None, 0, 0, 0, tv, tot, None, abr])
        for mes in (1, 2):
            for uf in F.SIGLAS:
                linha(uf, "Homicídio doloso", mes, 3, None)
            linha("SP", "Homicídio doloso", mes, 2, None)  # segundo município
            linha("SP", "Homicídio doloso", mes, 50, None, "Polícia Federal")
            linha("RJ", "Roubo de veículo", mes, None, 7)
        linha("RJ", "Roubo de veículo", 2, None, None)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.xlsx"
            wb.save(p)
            r = coleta.agregar_vde(str(p), 2024)
        self.assertEqual(r["meses"], 2)
        self.assertEqual(r["valores"]["homicidio"]["SP"], [5, 5])
        self.assertEqual(r["valores"]["roubo_veiculo"]["RJ"], [7, 7])
        self.assertEqual(r["valores"]["roubo_veiculo"]["SP"], [None, None])
        self.assertIn("Polícia Federal", r["abrangencias"])


if __name__ == "__main__":
    unittest.main()
