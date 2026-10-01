"""Testes do módulo Rede (detalhe): parsers, cálculos e conferências com amostras reais.

As amostras em pipeline/tests/dados/energia_rede/ são recortes dos arquivos originais do
ONS baixados em 30/09/2026 (bronze do módulo): linhas copiadas sem alteração. Os valores
esperados foram calculados fora do módulo, direto das linhas do recorte (somas por
sentido com awk, contas à mão na hora 18h de 29/09/2026), e escritos aqui como números:
um erro de orientação, de sinal ou de soma no código muda o resultado e o teste falha.

Sem rede: nada aqui baixa arquivo.
"""
import json
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan, ons_rede  # noqa: E402
from pipeline.energia.modulos import rede_detalhe as rd  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_rede")
GOLD = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "public", "energia", "gold", "rede_detalhe.json")


def texto(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
        return f.read()


def linhas(nome):
    return list(ckan.le_csv_bronze(os.path.join(DADOS, nome), encoding="utf-8-sig", separador=";"))


def serie(obs, nome):
    return {ref: v for s, ref, v in obs if s == nome and v is not None}


class TestOrientacaoESinal(unittest.TestCase):
    """Achado A05: o arquivo de fronteiras mudou de forma entre 2025 e 2026."""

    def test_2021_orientacao_fixa_sul_sudeste_invertida(self):
        obs, rel = ons_rede.parse_intercambio_nacional(linhas("intercambio_nacional_2021_amostra.csv"))
        self.assertFalse(rel["tem_programado"])
        self.assertEqual(rel["orientacoes"], {"N->NE": 3, "N->SE": 3, "NE->SE": 3, "SE->S": 3})
        s_se = serie(obs, "verificado.S_SE")
        # linha publicada "SE → S = 5406,916": na orientação canônica S→SE vira negativo
        self.assertAlmostEqual(s_se["2021-01-01T00:00"], -5406.916, places=6)
        n_ne = serie(obs, "verificado.N_NE")
        self.assertAlmostEqual(n_ne["2021-01-01T00:00"], -3177.549, places=6)
        self.assertEqual(serie(obs, "programado.N_NE"), {})  # programado ausente não vira zero

    def test_2026_linha_no_sentido_do_fluxo_e_programado_com_o_mesmo_sinal(self):
        obs, rel = ons_rede.parse_intercambio_nacional(linhas("intercambio_nacional_2026_amostra.csv"))
        self.assertTrue(rel["tem_programado"])
        self.assertIn("SE->NE", rel["orientacoes"])
        self.assertIn("NE->N", rel["orientacoes"])
        self.assertEqual(sum(v for k, v in rel["sinais_verificado"].items() if k.endswith(":negativo")), 0)
        ne_se = serie(obs, "verificado.NE_SE")
        prog = serie(obs, "programado.NE_SE")
        # "2026-01-01 04:00;SE;NE;431,794;−504,500": fluxo SE→NE e programa NE→SE
        self.assertAlmostEqual(ne_se["2026-01-01T04:00"], -431.794, places=6)
        self.assertAlmostEqual(prog["2026-01-01T04:00"], 504.5, places=6)
        self.assertTrue(rd.inversao(prog["2026-01-01T04:00"], ne_se["2026-01-01T04:00"]))

    def test_linha_duplicada_deixa_a_hora_sem_valor(self):
        ls = linhas("intercambio_nacional_2026_amostra.csv")
        dup = dict(ls[-1])
        dup["val_intercambiomwmed"] = "999.000"
        obs, rel = ons_rede.parse_intercambio_nacional(ls + [dup])
        self.assertEqual(len(rel["conflitos"]), 1)
        par, ref = rel["conflitos"][0].split(" ")
        self.assertNotIn(ref, serie(obs, f"verificado.{par}"))

    def test_par_desconhecido_nao_entra(self):
        ls = linhas("intercambio_nacional_2021_amostra.csv")
        estranho = dict(ls[0])
        estranho["id_subsistema_destino"] = "XX"
        obs, rel = ons_rede.parse_intercambio_nacional([estranho])
        self.assertEqual(obs, [])
        self.assertEqual(rel["pares_desconhecidos"], {"N->XX": 1})

    def test_internacional_sinal_e_paises_com_preenchimento(self):
        obs, rel = ons_rede.parse_intercambio_internacional(linhas("intercambio_internacional_2026_amostra.csv"))
        self.assertEqual(set(rel["paises"]), {"ARGENTINA", "URUGUAI"})
        arg = serie(obs, "verificado.ARGENTINA")
        self.assertAlmostEqual(arg["2026-09-29T18:00"], -794.573, places=6)   # importação: negativo
        self.assertAlmostEqual(serie(obs, "programado.ARGENTINA")["2026-09-29T18:00"], -500.0, places=6)
        self.assertEqual(ons_rede.pais("Uruguai                       "), "URUGUAI")


class TestBrutoLiquido(unittest.TestCase):
    """P028: o saldo esconde reversões. Esperados somados com awk direto das linhas."""

    @classmethod
    def setUpClass(cls):
        obs, _ = ons_rede.parse_intercambio_nacional(linhas("intercambio_nacional_2026_amostra.csv"))
        cls.fluxo = {p: serie(obs, f"verificado.{p}") for p in ons_rede.PARES}
        cls.prog = {p: serie(obs, f"programado.{p}") for p in ons_rede.PARES}
        cls.horas = rd.horas_do_dia("2026-09-29")

    def resumo(self, par):
        return rd.resumo_fluxo([self.fluxo[par].get(h) for h in self.horas])

    def test_norte_sudeste_reversao_unica(self):
        r = self.resumo("N_SE")
        self.assertEqual(r["horas"], 24)
        self.assertAlmostEqual(r["canonico_mwh"], 39588.211, places=3)
        self.assertAlmostEqual(r["inverso_mwh"], 3076.958, places=3)
        self.assertAlmostEqual(r["liquido_mwh"], 36511.253, places=3)
        self.assertAlmostEqual(r["contra_saldo_mwh"], 3076.958, places=3)
        self.assertEqual((r["horas_inverso"], r["horas_canonico"], r["reversoes"]), (6, 18, 1))

    def test_sul_sudeste_duas_reversoes(self):
        r = self.resumo("S_SE")
        self.assertAlmostEqual(r["canonico_mwh"], 51257.451, places=3)
        self.assertAlmostEqual(r["inverso_mwh"], 25729.410, places=3)
        self.assertEqual((r["horas_inverso"], r["reversoes"]), (8, 2))

    def test_norte_nordeste_todo_no_sentido_inverso(self):
        r = self.resumo("N_NE")
        self.assertEqual(r["canonico_mwh"], 0)
        self.assertAlmostEqual(r["inverso_mwh"], 94244.491, places=3)
        self.assertEqual((r["contra_saldo_mwh"], r["reversoes"], r["horas_inverso"]), (0, 0, 24))

    def test_programado_canonico_do_dia(self):
        self.assertAlmostEqual(sum(self.prog["NE_SE"][h] for h in self.horas), 135889.5, places=3)

    def test_hora_ausente_interrompe_a_sequencia_e_nao_vira_zero(self):
        vals = [self.fluxo["S_SE"].get(h) for h in self.horas]
        vals[7] = None   # primeira hora no sentido inverso some
        r = rd.resumo_fluxo(vals)
        self.assertEqual(r["horas"], 23)
        self.assertEqual(r["reversoes"], 1)   # a troca +→− das 7h não é contada sem a hora
        self.assertIsNone(rd.resumo_fluxo([None, None])["liquido_mwh"])

    def test_nulo_dentro_da_faixa_nao_conta_sentido(self):
        r = rd.resumo_fluxo([5.0, 0.5, -0.8, 6.0])
        self.assertEqual((r["horas_nulas"], r["reversoes"], r["horas_inverso"]), (2, 0, 0))
        self.assertAlmostEqual(r["inverso_mwh"], 0.8)   # a energia entra na soma mesmo na faixa nula


class TestPrecoNaMesmaHora(unittest.TestCase):
    def test_classificacao(self):
        self.assertEqual(rd.pld_na_hora(500.0, 100.0, 100.005), "juntos")
        self.assertEqual(rd.pld_na_hora(500.0, 100.0, 150.0), "para_mais_caro")
        self.assertEqual(rd.pld_na_hora(-500.0, 100.0, 150.0), "para_mais_barato")
        self.assertEqual(rd.pld_na_hora(0.4, 100.0, 150.0), "fluxo_nulo")
        self.assertIsNone(rd.pld_na_hora(500.0, None, 150.0))
        self.assertIsNone(rd.pld_na_hora(None, 100.0, 150.0))


class TestBalancoA05(unittest.TestCase):
    """Identidades do balanço com as linhas reais de três conjuntos do ONS."""

    @staticmethod
    def carrega(ano):
        o_bal, _ = ons_rede.parse_balanco(linhas(f"balanco_{ano}_amostra.csv"))
        o_in, _ = ons_rede.parse_intercambio_nacional(linhas(f"intercambio_nacional_{ano}_amostra.csv"))
        o_ii, _ = ons_rede.parse_intercambio_internacional(linhas(f"intercambio_internacional_{ano}_amostra.csv"))
        bal = {(k, sm): serie(o_bal, f"{k}.{sm}") for k in rd.PARCELAS_BALANCO
               for sm in ons_rede.SUBSISTEMAS + ("SIN",)}
        fluxo = {p: serie(o_in, f"verificado.{p}") for p in ons_rede.PARES}
        ext = {p: serie(o_ii, f"verificado.{p}") for p in rd.PAISES}
        return bal, fluxo, ext

    def test_hora_que_fecha_2026_09_29_18h(self):
        bal, fluxo, ext = self.carrega(2026)
        h = "2026-09-29T18:00"
        fh = {p: fluxo[p][h] for p in ons_rede.PARES}
        eh = {p: ext[p].get(h) for p in rd.PAISES}
        esperado = {"N": 1479.302, "NE": 8029.802, "SE": -10643.42, "S": 339.742}
        for sm, v in esperado.items():
            self.assertAlmostEqual(bal[("intercambio", sm)][h], v, places=3)
            self.assertAlmostEqual(sum(rd.contribuicoes(sm, fh, eh)), v, delta=rd.TOL_IDENT)
        self.assertAlmostEqual(bal[("intercambio", "SIN")][h], ext["ARGENTINA"][h], delta=rd.TOL_IDENT)
        for sm in ons_rede.SUBSISTEMAS + ("SIN",):
            parc = {k: bal[(k, sm)][h] for k in rd.PARCELAS_BALANCO}
            self.assertLessEqual(abs(rd.residuo_balanco(parc)), rd.TOL_IDENT, sm)
        # Sul exporta ao Sudeste e importa da Argentina na mesma hora: trânsito
        exp, imp, transito = rd.bruto_subsistema(rd.contribuicoes("S", fh, eh))
        self.assertAlmostEqual(exp, 1134.316, places=3)
        self.assertAlmostEqual(imp, 794.573, places=3)
        self.assertTrue(transito)

    def test_residuo_de_geracao_em_2026_01_16(self):
        bal, _, _ = self.carrega(2026)
        h = "2026-01-16T01:00"
        parc = {k: bal[(k, "NE")][h] for k in rd.PARCELAS_BALANCO}
        self.assertAlmostEqual(rd.residuo_balanco(parc), -17540.435, places=2)

    def test_exterior_fora_do_balanco_em_2024(self):
        bal, fluxo, ext = self.carrega(2024)
        horas = ["2024-10-16T00:00", "2024-09-26T15:00"]
        for h in horas:
            fh = {p: fluxo[p][h] for p in ons_rede.PARES}
            eh = {p: ext[p].get(h) for p in rd.PAISES}
            res = bal[("intercambio", "S")][h] - sum(rd.contribuicoes("S", fh, eh))
            self.assertGreater(abs(res), 100, h)
            # Norte, Nordeste e Sudeste fecham com as fronteiras na mesma hora
            for sm in ("N", "NE", "SE"):
                self.assertAlmostEqual(bal[("intercambio", sm)][h], sum(rd.contribuicoes(sm, fh, eh)), delta=rd.TOL_IDENT)
        diag = rd.diagnostico_perimetro_sul(horas, bal, fluxo, ext)
        self.assertEqual(diag["balanco_coerente"], 2)
        self.assertEqual(diag["exterior_zero_no_balanco"], 1)   # 16/10 00h: SIN = 0 com Uruguai importando
        self.assertEqual(diag["exterior_menor_no_balanco"], 1)  # 26/09 15h: o balanço só tem o Uruguai (−499,79)
        self.assertAlmostEqual(bal[("intercambio", "SIN")]["2024-09-26T15:00"], ext["URUGUAI"]["2024-09-26T15:00"], places=6)

    def test_parcela_ausente_nao_vira_zero(self):
        self.assertIsNone(rd.residuo_balanco({"geracao": None, "carga": 2.0, "intercambio": 0.0}))
        linha = dict(linhas("balanco_2026_amostra.csv")[0])
        linha["val_gereolica"] = ""   # fonte vazia: a geração da hora fica ausente, não somada como zero
        obs, rel = ons_rede.parse_balanco([linha])
        self.assertEqual(serie(obs, f"geracao.{linha['id_subsistema'].strip()}"), {})
        self.assertEqual(rel["nulos"], {"eolica": 1})


class TestAtls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.obs, cls.rel = ons_rede.parse_atls(linhas("atls_amostra.csv"))

    def test_unidade_e_fracao_nao_percentual(self):
        self.assertLessEqual(self.rel["maior_atls"], 1.0)
        h = serie(self.obs, "horas_violacao.RSUL.ME")
        a = serie(self.obs, "atls.RSUL.ME")
        # maio de 2026: 0,175 h em 744 h → 1 − 0,175/744 = 0,99976478...
        self.assertAlmostEqual(rd.atls_horas_implicitas(a["2026-05"], h["2026-05"]), 744.0, places=3)
        self.assertEqual(rd.horas_calendario("2026-05"), 744)

    def test_fevereiro_de_2023_com_uma_hora_a_mais(self):
        h = serie(self.obs, "horas_violacao.FNS.ME")
        a = serie(self.obs, "atls.FNS.ME")
        self.assertAlmostEqual(rd.atls_horas_implicitas(a["2023-02"], h["2023-02"]), 673.0, places=2)
        self.assertEqual(rd.horas_calendario("2023-02"), 672)
        self.assertIsNone(rd.atls_horas_implicitas(1.0, 0.0))

    def test_acumulado_anual_publicado_e_soma_dos_meses(self):
        me = serie(self.obs, "horas_violacao.FNS.ME")
        an = serie(self.obs, "horas_violacao.FNS.AN")
        for m in an:
            soma = sum(me[f"2023-{k:02d}"] for k in range(1, int(m[5:7]) + 1))
            self.assertAlmostEqual(soma, an[m], places=6, msg=m)
        self.assertAlmostEqual(an["2023-12"], 2.525, places=6)


class TestInterrupcoes(unittest.TestCase):
    def test_chaves_estaveis_e_repeticoes(self):
        ls = linhas("interrupcoes_amostra.csv")
        eventos, rel = ons_rede.parse_interrupcoes(ls)
        self.assertEqual(rel["linhas"], 7)
        self.assertEqual(rel["linhas_repetidas"], 1)
        embaralhadas = list(ls)
        random.Random(7).shuffle(embaralhadas)
        eventos2, _ = ons_rede.parse_interrupcoes(embaralhadas)
        self.assertEqual({e["chave"]: e["val_cargainterrompida_mw"] for e in eventos},
                         {e["chave"]: e["val_cargainterrompida_mw"] for e in eventos2})
        goias = sorted(e["chave"] for e in eventos if e["cod_perturbacao"] == "5982/2008")
        self.assertEqual(len(goias), 2)
        self.assertTrue(goias[0].endswith("|1") and goias[1].endswith("|2"))

    def test_energia_igual_a_carga_vezes_tempo(self):
        eventos, rel = ons_rede.parse_interrupcoes(linhas("interrupcoes_amostra.csv"))
        amapa = next(e for e in eventos if e["cod_perturbacao"] == "6814/2020")
        self.assertAlmostEqual(amapa["val_energianaosuprida_mwh"], 159.25 * 29203.0 / 60, places=4)
        self.assertAlmostEqual(amapa["val_energianaosuprida_mwh"], 77509.629, places=2)
        self.assertEqual(rel["abaixo_de_100mw"], 4)   # o arquivo traz cortes menores que 100 MW


class TestProgramaPdo(unittest.TestCase):
    def test_patamar_vira_meia_hora_e_so_conversoras(self):
        obs, rel = ons_rede.parse_pdo_conversoras(linhas("pdo_2026_09_29_amostra.csv"))
        self.assertEqual(rel["patamares"], 48)
        self.assertEqual(set(rel["elementos"]), set(ons_rede.CONVERSORAS_PDO))
        g2 = serie(obs, "pdo.GARABI 2B - T1")
        self.assertEqual(g2["2026-09-29T18:00"], 500.0)   # patamar 37
        self.assertEqual(g2["2026-09-29T23:00"], 0.0)     # patamar 47

    def test_programado_internacional_igual_ao_pdo(self):
        obs, _ = ons_rede.parse_pdo_conversoras(linhas("pdo_2026_09_29_amostra.csv"))
        o_ii, _ = ons_rede.parse_intercambio_internacional(linhas("intercambio_internacional_2026_amostra.csv"))
        prog = serie(o_ii, "programado.ARGENTINA")
        conferem = 0
        for hh in range(24):
            h = f"2026-09-29T{hh:02d}:00"
            pdo = -sum((serie(obs, f"pdo.{el}")[f"2026-09-29T{hh:02d}:00"] + serie(obs, f"pdo.{el}")[f"2026-09-29T{hh:02d}:30"]) / 2
                       for el, p in ons_rede.CONVERSORAS_PDO.items() if p == "ARGENTINA")
            conferem += abs(prog[h] - pdo) <= 0.5
        self.assertEqual(conferem, 24)
        self.assertEqual(sum(1 for h, v in prog.items() if v != 0), 5)   # 18h a 22h: −500 MWmed


class TestMaterialidade(unittest.TestCase):
    def test_limiar_e_inversao(self):
        self.assertTrue(rd.material(-1000.0))
        self.assertFalse(rd.material(999.9))
        self.assertTrue(rd.material(600.0, 500.0))
        self.assertFalse(rd.inversao(0.5, -800.0))   # programa nulo não é inversão
        self.assertTrue(rd.inversao(1732.977, -10.0))


class TestDicionariosEDocumentos(unittest.TestCase):
    def test_versoes_e_permissoes_do_dicionario(self):
        txt = texto("dicionario_intercambio_nacional.txt")
        versoes = ons_rede.versoes_dicionario(txt)
        self.assertEqual([(v["versao"], v["data"]) for v in versoes], [("1.0", "26-08-2022"), ("1.1", "13-09-2022"), ("1.2", "04-05-2026")])
        perm = ons_rede.permissoes_dicionario(txt)
        self.assertTrue(perm["val_intercambiomwmed"]["negativo"])
        self.assertTrue(ons_rede.confere_passagem(txt, "Relatório Quadrimestral de Limites de Intercâmbio para o Modelo Newave"))
        self.assertTrue(ons_rede.confere_passagem(txt, "disponível Portal SINtegre - ONS"))
        bal = texto("dicionario_balanco.txt")
        self.assertEqual([(v["versao"], v["data"]) for v in ons_rede.versoes_dicionario(bal)], [("1.0", "02-05-2023")])
        self.assertNotIn("positivo", bal.lower())   # o dicionário do balanço não define o sinal

    def test_passagem_com_quebra_de_linha_e_hifen_real(self):
        txt = texto("rt_ons_dpl_0131_2023_trecho.txt")
        self.assertTrue(ons_rede.confere_passagem(txt, "Interligação Nordeste-Norte (FNEN)"))
        self.assertFalse(ons_rede.confere_passagem(txt, "Interligação NordesteNorte (FNEN)x"))
        self.assertFalse(ons_rede.confere_passagem(txt, "limite de 9.999 MW"))


class TestAmostraPdo(unittest.TestCase):
    def test_dias_da_amostra_sao_fixos(self):
        disp = [f"2026-09-{d:02d}" for d in range(1, 31)] + ["2025-12-01", "2026-01-01", "2026-01-15", "2026-01-20"]
        dias = rd.dias_amostra_pdo(None, disp)
        self.assertIn("2026-01-15", dias)
        self.assertNotIn("2026-01-20", dias)
        self.assertNotIn("2025-12-01", dias)


@unittest.skipUnless(os.path.exists(GOLD), "gold do módulo ainda não gerada")
class TestGoldPublicada(unittest.TestCase):
    """Invariantes da gold publicada (não repetem a fórmula: conferem coerência entre blocos)."""

    @classmethod
    def setUpClass(cls):
        with open(GOLD, encoding="utf-8") as f:
            cls.g = json.load(f)

    def test_disponivel_e_tamanho(self):
        self.assertTrue(self.g["disponivel"])
        self.assertLess(os.path.getsize(GOLD), 450 * 1024)

    def test_resumo_30d_coerente(self):
        for r in self.g["circulacao"]["resumo_30d"]:
            self.assertAlmostEqual(r["canonico_mwh"] - r["inverso_mwh"], r["liquido_mwh"], delta=1.0)
            self.assertLessEqual(r["contra_saldo_mwh"], min(r["canonico_mwh"], r["inverso_mwh"]) + 1)
            # soma dos mínimos diários ≤ mínimo das somas: a janela também conta dias inteiros contra o saldo
            self.assertLessEqual(r["contra_saldo_dias_mwh"], r["contra_saldo_mwh"] + 1)
            self.assertLessEqual(r["horas_separados_fluxo_para_mais_caro"] + r["horas_separados_fluxo_para_mais_barato"],
                                 r["horas_precos_separados"])

    def test_evidencias_validas(self):
        for k, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], k)

    def test_sem_utilizacao_de_rede(self):
        self.assertFalse(self.g["restricoes"]["limites"]["integrados"])
        texto = json.dumps(self.g, ensure_ascii=False).lower()
        self.assertNotIn("utilizacao_pct", texto)
        self.assertNotIn("congestionad", json.dumps(self.g["regras"], ensure_ascii=False).lower())

    def test_identidades_nao_forcam_zero(self):
        ids = {x["id"]: x for x in self.g["balanco"]["identidades"]}
        for x in ids.values():
            self.assertEqual(x["horas_fecham"] + x["horas_residuo"], x["horas"])
        # o resíduo do Sul é exatamente o do SIN (exterior), nunca redistribuído
        self.assertEqual(ids["perimetro.S"]["horas_residuo"], ids["perimetro.SIN"]["horas_residuo"])

    def test_definicoes_atls_so_quando_conferidas(self):
        docs = self.g["restricoes"]["documentos"]
        for f in self.g["restricoes"]["atls"]["fluxos"]:
            if f["definicao"]:
                trechos = {t["id"]: t["confere"] for t in docs[f["documento_definicao"]]["trechos"]}
                self.assertTrue(trechos.get(f["fluxo"]), f["fluxo"])


if __name__ == "__main__":
    unittest.main()
