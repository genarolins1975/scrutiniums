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


def carrega_balanco(ano):
    """Balanço, fronteiras e exterior das amostras de um ano, no formato do silver."""
    o_bal, _ = ons_rede.parse_balanco(linhas(f"balanco_{ano}_amostra.csv"))
    o_in, _ = ons_rede.parse_intercambio_nacional(linhas(f"intercambio_nacional_{ano}_amostra.csv"))
    o_ii, _ = ons_rede.parse_intercambio_internacional(linhas(f"intercambio_internacional_{ano}_amostra.csv"))
    bal = {(k, sm): serie(o_bal, f"{k}.{sm}") for k in rd.PARCELAS_BALANCO for sm in ons_rede.SUBSISTEMAS + ("SIN",)}
    fluxo = {p: serie(o_in, f"verificado.{p}") for p in ons_rede.PARES}
    ext = {p: serie(o_ii, f"verificado.{p}") for p in rd.PAISES}
    horas = sorted(set().union(*(set(v) for v in bal.values())))
    return bal, fluxo, ext, horas


class TestQuebraMmgd(unittest.TestCase):
    """P029, seção 11.1: a solar e a carga do balanço incluem a MMGD estimada desde 29/04/2023.
    Amostra: as 48 linhas SIN de 28 e 29/04/2023 do BALANCO_ENERGIA_SUBSISTEMA_2023.csv; somas
    esperadas feitas com awk sobre o recorte."""

    def test_degrau_no_arquivo_original(self):
        d = rd.degrau_mmgd(linhas("balanco_2023_mmgd_amostra.csv"))
        self.assertEqual((d["dia_anterior"], d["dia"], d["horas_dia_anterior"], d["horas_dia"]), ("2023-04-28", "2023-04-29", 24, 24))
        self.assertAlmostEqual(d["solar_12h_dia_anterior_mwmed"], 5688.69, places=3)
        self.assertAlmostEqual(d["solar_12h_dia_mwmed"], 14987.696, places=3)
        self.assertAlmostEqual(d["solar_mwh_dia_anterior"], 47791.725, places=3)
        self.assertAlmostEqual(d["solar_mwh_dia"], 105039.356, places=3)
        # a carga acompanha a solar: o balanço fecha nas 24 horas dos dois dias (sem a MMGD na carga,
        # o resíduo das 12h de 29/04 seria da ordem de 9 GWmed)
        self.assertEqual((d["horas_balanco_fecha_dia_anterior"], d["horas_balanco_fecha_dia"]), (24, 24))
        self.assertGreater(d["razao_solar_dia"], 2.0)

    def test_regime_por_mes_e_registro(self):
        self.assertEqual([rd.regime_mmgd(m) for m in ("2021-01", "2023-03", "2023-04", "2023-05", "2026-09")],
                         ["sem", "sem", "parcial", "com", "com"])
        quebras = next(x for x in rd.REGISTRO["datasets"] if x["dataset_silver"] == rd.DS_BAL)["quebras"]
        self.assertEqual(len(quebras), 1)
        q = quebras[0]
        # quebra datada, com origem: o balanço não declara a mudança, a plataforma a identifica no dado
        self.assertEqual((q["data"], q["origem"]), ("2023-04-29", "PLATAFORMA"))
        self.assertIn("29/04/2023", q["descricao"])
        # os números citados no REGISTRO são os do arquivo (conferidos no teste acima)
        self.assertIn("5.688,69", q["descricao"])
        self.assertIn(rd._fmt(14987.696, 2), q["descricao"])

    def test_natureza_mista_nas_metricas(self):
        from pipeline.energia.metricas import rede as m_rede
        m = {x["id"]: x for x in m_rede.METRICAS}
        self.assertIn("ESTIMADO", m["rede_residuo_balanco"]["natureza_fonte"])
        self.assertIn("ESTIMADO", {c_["natureza"] for c_ in m["rede_residuo_balanco"]["natureza_componentes"]})
        self.assertIn("PREVISTO", m["rede_desvio_programado"]["natureza_fonte"])
        self.assertEqual(m["rede_atls_horas_violacao"]["natureza_transformacao"], "CALCULADO")


class TestExteriorAgregado(unittest.TestCase):
    """Resumo de 12 meses: país sem hora na janela vira nulo; zero publicado continua zero."""

    @classmethod
    def setUpClass(cls):
        o_ii, _ = ons_rede.parse_intercambio_internacional(linhas("intercambio_internacional_2025_amostra.csv"))
        cls.ext = {p: serie(o_ii, f"verificado.{p}") for p in rd.PAISES}
        cls.ext["PARAGUAI"] = {}   # o arquivo de 2025 não tem nenhuma linha do Paraguai
        cls.prog = {p: {} for p in rd.PAISES}

    def test_pais_ausente_na_janela_vira_nulo(self):
        mensal = rd.agrega_exterior(self.ext, self.prog, "2025-06-15")
        meses = sorted({m for m, _ in mensal})
        resumo, m12 = rd.resumo_exterior_12m(mensal, meses, "2025-06-15")
        self.assertEqual(m12, ["2025-03", "2025-05"])
        py = resumo["PARAGUAI"]
        self.assertEqual(py["horas"], 0)
        self.assertIsNone(py["exportacao_mwh"])
        self.assertIsNone(py["importacao_mwh"])
        self.assertIsNone(py["horas_com_fluxo"])
        # Argentina: só 08/03/2025 12h (269,09 MWmed exportados); 07 e 08/05/2025 sem nenhuma linha
        self.assertEqual((resumo["ARGENTINA"]["horas"], resumo["ARGENTINA"]["exportacao_mwh"],
                          resumo["ARGENTINA"]["importacao_mwh"]), (1, 269.0, 0.0))
        # Uruguai: 25 horas publicadas com valor 0,0 (zero real, não ausência)
        self.assertEqual((resumo["URUGUAI"]["horas"], resumo["URUGUAI"]["exportacao_mwh"],
                          resumo["URUGUAI"]["horas_com_fluxo"]), (25, 0.0, 0))

    def test_cobertura_por_pais(self):
        dias = rd.cobertura_dias({p: self.ext[p] for p in rd.PAISES_SUL}, ["2025-05-07", "2025-05-08"])
        self.assertEqual(dias[0], {"dia": "2025-05-07", "horas": 0, "horas_max": 0, "por_serie": {"ARGENTINA": 0, "URUGUAI": 0}})
        # 08/05/2025: o Uruguai tem as 24 horas e só a Argentina falta (não é dia sem nenhum dado)
        self.assertEqual(dias[1], {"dia": "2025-05-08", "horas": 0, "horas_max": 24, "por_serie": {"ARGENTINA": 0, "URUGUAI": 24}})


class TestBalancoMensal(unittest.TestCase):
    """Somas mensais do balanço: cada grupo sobre as mesmas horas, e a linha fecha."""

    def test_intercambio_e_fronteiras_nas_mesmas_horas(self):
        # 08/03/2025 12h tem exterior; 09/03/2025 12h não tem nenhuma linha no conjunto internacional
        bal, fluxo, ext, horas = carrega_balanco(2025)
        _, mensal, _, _ = rd.agrega_balanco(bal, fluxo, ext, horas)
        lin = {(x["mes"], x["sm"]): x for x in rd.linhas_balanco_mensal(mensal)}
        s_ = lin[("2025-03", "S")]
        self.assertEqual((s_["horas"], s_["horas_completas"], s_["horas_perimetro"]), (2, 2, 1))
        self.assertAlmostEqual(s_["intercambio_mwh"], -3219.919 - 5651.353, places=3)       # as duas horas
        self.assertAlmostEqual(s_["intercambio_perimetro_mwh"], -3219.919, places=3)        # só a hora com exterior
        self.assertAlmostEqual(s_["fronteiras_exterior_mwh"], -3489.012 + 269.09 + 0.0, places=3)
        self.assertAlmostEqual(s_["residuo_perimetro_mwh"], 0.003, places=3)
        for x in lin.values():
            self.assertAlmostEqual(x["geracao_mwh"] - x["carga_mwh"] - x["intercambio_mwh"], x["residuo_balanco_mwh"], places=2)
            if x["horas_perimetro"]:
                self.assertAlmostEqual(x["intercambio_perimetro_mwh"] - x["fronteiras_exterior_mwh"], x["residuo_perimetro_mwh"],
                                       places=2)
        self.assertEqual(s_["mmgd_estimada"], "com")

    def test_14_09_2022_sul_e_soma_iguais_a_menos_a_argentina(self):
        # 14/09/2022 não está no arquivo de fronteiras; balanço e exterior estão
        bal, fluxo, ext, horas = carrega_balanco(2022)
        ident, _, residuos, _ = rd.agrega_balanco(bal, fluxo, ext, horas)
        self.assertEqual(ident["balanco.S"]["horas_residuo_lista"], ["2022-09-14T12:00"])
        self.assertEqual(ident["balanco.S"]["igual_menos_exterior"], 1)
        self.assertEqual(ident["soma_sin"]["horas_residuo_lista"], ["2022-09-14T12:00"])
        self.assertEqual(ident["soma_sin"]["igual_menos_exterior"], 1)
        res = {(r[1], r[2]): r[3] for r in residuos}
        # (13.570,499 + 1.362,229 + 870,1 + 3) − 11.775,119 − 5.582,029 = −1.551,32 = −Argentina
        self.assertAlmostEqual(res[("balanco", "S")], -1551.32, places=2)
        self.assertAlmostEqual(res[("soma_sin", "SIN")], -1551.32, places=2)
        # 13/09/2022 12h fecha em todas as identidades; o perímetro de 14/09 não é calculado (sem fronteiras)
        self.assertEqual(ident["perimetro.N"]["horas"], 1)
        self.assertEqual(ident["balanco.SIN"]["residuo"], 0)


class TestCsvHorario(unittest.TestCase):
    def test_hora_sem_fronteira_continua_no_csv(self):
        bal, fluxo, ext, _ = carrega_balanco(2022)
        vazio = {p: {} for p in ons_rede.PARES}
        por_ano = rd.linhas_horarias(fluxo, vazio, ext, {p: {} for p in rd.PAISES_SUL},
                                     {sm: {} for sm in ons_rede.SUBSISTEMAS}, bal)
        lin = {x[0]: dict(zip(rd.CAB_HORARIO, x)) for x in por_ano["2022"]}
        self.assertEqual(sorted(lin), ["2022-09-13T12:00", "2022-09-14T12:00"])
        h = lin["2022-09-14T12:00"]
        self.assertIsNone(h["fluxo_S_SE"])                      # ausência no arquivo de fronteiras: vazio
        self.assertAlmostEqual(h["saldo_S"], 5582.029, places=3)
        self.assertAlmostEqual(h["saldo_SIN"], 1551.32, places=3)
        self.assertAlmostEqual(h["ext_ARGENTINA"], 1551.32, places=3)


class TestInterrupcoesAgregadas(unittest.TestCase):
    """Todos os 35 registros do Sul em 2026 (recorte do INTERRUPCAO_CARGA.csv); somas com awk."""

    @classmethod
    def setUpClass(cls):
        cls.eventos, _ = ons_rede.parse_interrupcoes(linhas("interrupcoes_2026_sul_amostra.csv"))

    def test_ens_anual_do_sul_em_2026(self):
        a = rd.anual_interrupcoes(self.eventos, 2026)
        self.assertEqual((a["anos"], a["parcial"]), (["2026"], [True]))
        s_ = a["por_sm"]["S"]
        self.assertEqual((s_["registros"], s_["perturbacoes"], s_["registros_rede_basica"], s_["registros_100mw"]),
                         ([35], [32], [35], [1]))
        self.assertEqual(s_["ens_mwh"], [2514.5])
        self.assertEqual(a["por_sm"]["SIN"]["ens_mwh"], [2514.5])
        self.assertEqual(a["por_sm"]["SE"]["registros"], [0])   # nenhum registro no recorte: zero eventos

    def test_janela_de_12_meses(self):
        r = rd.resumo_interrupcoes_12m(self.eventos)
        self.assertEqual((r["inicio"], r["fim"], r["registros"], r["perturbacoes"]), ("2025-09-28", "2026-09-27", 35, 32))
        self.assertAlmostEqual(r["_ens"], 2514.534667, places=4)


class TestProgramaRepetido(unittest.TestCase):
    """P031, seção 11.7: em 22/08/2026 o programado de NE→SE/CO vale exatamente 0 nas 24 horas.
    Amostras: as 96 linhas de 22/08/2026 e as de 29/09/2026 do INTERCAMBIO_NACIONAL_2026.csv."""

    @classmethod
    def setUpClass(cls):
        obs, _ = ons_rede.parse_intercambio_nacional(linhas("intercambio_nacional_2026_amostra.csv")
                                                     + linhas("intercambio_nacional_2026_08_22_amostra.csv"))
        cls.fluxo = {p: serie(obs, f"verificado.{p}") for p in ons_rede.PARES}
        cls.prog = {p: serie(obs, f"programado.{p}") for p in ons_rede.PARES}

    def test_sequencia_detectada_e_dia_rotulado(self):
        seqs, dias = rd.programa_repetido(self.prog)
        self.assertEqual(dias, ["2026-08-22"])
        self.assertEqual(seqs, [{"par": "NE_SE", "inicio": "2026-08-22T00:00", "fim": "2026-08-22T23:00", "horas": 24,
                                 "valor_mwmed": 0.0}])
        # no mesmo dia a exportação programada do Nordeste vai toda para o Norte (somas com awk)
        hs = rd.horas_do_dia("2026-08-22")
        self.assertAlmostEqual(sum(self.prog["N_NE"][h] for h in hs), -198909.999, places=3)
        self.assertAlmostEqual(sum(self.fluxo["N_NE"][h] for h in hs), -75278.045, places=3)
        self.assertAlmostEqual(sum(self.fluxo["NE_SE"][h] for h in hs), 94464.903, places=3)

    def test_sequencia_curta_nao_rotula(self):
        self.assertEqual(rd.sequencias_repetidas({"2026-05-15T08:00": -8440.0, "2026-05-15T09:00": -8440.0,
                                                  "2026-05-15T10:00": -8000.0}), [])
        # hora ausente interrompe a sequência
        serie_ = {f"2026-01-01T{h:02d}:00": 0.0 for h in range(24) if h != 5}
        self.assertEqual([(a, b, n) for a, b, n, _ in rd.sequencias_repetidas(serie_)],
                         [("2026-01-01T06:00", "2026-01-01T23:00", 18)])

    def test_distribuicao_de_uma_fronteira_com_e_sem_o_dia(self):
        todas = sorted(h for h in self.prog["NE_SE"] if h[:10] in ("2026-08-22", "2026-09-29"))
        sem = [h for h in todas if h[:10] != "2026-08-22"]
        d = rd.distribuicao_desvios(self.prog["NE_SE"], self.fluxo["NE_SE"], sem)
        # 29/09/2026, NE→SE/CO, 24 horas: valores calculados com awk sobre o recorte
        self.assertEqual(d["horas"], 24)
        self.assertEqual((d["vies_mwmed"], d["desvio_abs_medio_mwmed"], d["p50_abs_mwmed"], d["max_abs_mwmed"]),
                         (201.7, 538.1, 549.5, 1195.1))
        self.assertEqual(d["horas_materiais"], {"500": 12, "1000": 2, "2000": 0})
        self.assertEqual(d["horas_inversao"], 0)
        com = rd.distribuicao_desvios(self.prog["NE_SE"], self.fluxo["NE_SE"], todas)
        self.assertEqual(com["horas"], 48)
        self.assertGreater(com["max_abs_mwmed"], d["max_abs_mwmed"])


class TestTextosA05(unittest.TestCase):
    """Textos do A05 gerados dos contadores: cada afirmação só aparece quando o contador a sustenta."""

    @classmethod
    def setUpClass(cls):
        bal, fluxo, ext, horas = carrega_balanco(2022)
        ident, _, _, _ = rd.agrega_balanco(bal, fluxo, ext, horas)
        cls.idm = {}
        for k, x in ident.items():
            por_ano = {}
            for h in x["horas_residuo_lista"]:
                por_ano[h[:4]] = por_ano.get(h[:4], 0) + 1
            cls.idm[k] = {"horas": x["horas"], "horas_fecham": x["fecham"], "horas_residuo": x["residuo"],
                          "horas_residuo_por_ano": por_ano, "horas_residuo_igual_menos_exterior": x["igual_menos_exterior"],
                          "dias_residuo_igual_menos_exterior": sorted(x["dias_igual_menos_exterior"]),
                          "maior_residuo_mwmed": x["max_abs"] if x["residuo"] else None, "maior_residuo_em": x["max_em"],
                          "primeira_hora_residuo": (x["horas_residuo_lista"] or [None])[0],
                          "ultima_hora_residuo": (x["horas_residuo_lista"] or [None])[-1]}
        cls.diag = {"horas": 0, "balanco_coerente": 0, "exterior_zero_no_balanco": 0, "exterior_menor_no_balanco": 0,
                    "exterior_outro_no_balanco": 0, "meses": []}

    def test_sul_em_14_09_2022_aparece_nas_frases(self):
        t = rd.textos_a05(self.idm, self.diag, 0)
        sul = next(f for f in t["frases"] if f.startswith("Sul, balanço interno"))
        self.assertIn("igual a menos o intercâmbio internacional", sul)
        self.assertIn("14/09/2022", sul)
        self.assertTrue(any(f.startswith("Sistema Interligado Nacional, soma dos subsistemas") and "14/09/2022" in f
                            for f in t["frases"]))
        self.assertTrue(t["status"].startswith("fechado com resíduos sinalizados: 2 horas-identidade"))
        self.assertIn("em todas as horas no perímetro de Norte", t["perdas"])
        # sem diagnóstico do Sul, a frase de que a diferença está no exterior do balanço não aparece
        self.assertFalse(any("diferença está no valor do exterior" in f for f in t["frases"]))

    def test_ramos_condicionais(self):
        idm = json.loads(json.dumps(self.idm))
        idm["perimetro.N"]["horas_residuo"] = 3
        idm["perimetro.N"]["horas_fecham"] -= 3
        t = rd.textos_a05(idm, self.diag, 0)
        self.assertNotIn("em todas as horas", t["perdas"])
        diag = {"horas": 5, "balanco_coerente": 5, "exterior_zero_no_balanco": 4, "exterior_menor_no_balanco": 1,
                "exterior_outro_no_balanco": 0, "meses": ["2024-04"]}
        idm["perimetro.S"]["horas_residuo"] = 5
        self.assertTrue(any("diferença está no valor do exterior" in f for f in rd.textos_a05(idm, diag, 0)["frases"]))
        diag["exterior_outro_no_balanco"], diag["exterior_menor_no_balanco"] = 1, 0
        self.assertFalse(any("diferença está no valor do exterior" in f for f in rd.textos_a05(idm, diag, 0)["frases"]))
        zero = {k: {**x, "horas_residuo": 0, "horas_fecham": x["horas"]} for k, x in self.idm.items()}
        self.assertEqual(rd.textos_a05(zero, self.diag, 0)["status"], "fechado: todas as identidades fecham em todas as horas")


class TestDefinicoesAtls(unittest.TestCase):
    def test_definicao_contida_no_trecho_conferido(self):
        for fl, (definicao, doc) in rd.DEFINICOES_ATLS.items():
            trecho = dict(rd.DOCUMENTOS[doc]["trechos"]).get(fl)
            self.assertIsNotNone(trecho, fl)
            self.assertTrue(ons_rede.confere_passagem(trecho, definicao), fl)
        self.assertNotIn("EXP_NE", rd.DEFINICOES_ATLS)
        txt = texto("rt_ons_dpl_0131_2023_trecho.txt")
        self.assertTrue(ons_rede.confere_passagem(txt, "Interligação Nordeste-Norte (FNEN)"))
        self.assertFalse(ons_rede.confere_passagem(txt, "Exportação Nordeste (ExpNE)"))

    def test_busca_de_limites_registra_os_decks_da_ccee(self):
        deck = [b for b in rd.BUSCA_LIMITES if "NEWAVE" in b["onde"]]
        self.assertEqual(len(deck), 1)
        self.assertIn("403", deck[0]["resultado"])
        self.assertIn("limites de modelo", deck[0]["resultado"])


@unittest.skipUnless(os.path.exists(GOLD), "gold do módulo ainda não gerada")
class TestGoldPublicada(unittest.TestCase):
    """Invariantes da gold publicada (não repetem a fórmula: conferem coerência entre blocos)."""

    @classmethod
    def setUpClass(cls):
        with open(GOLD, encoding="utf-8") as f:
            cls.g = json.load(f)

    def test_disponivel_e_tamanho(self):
        self.assertTrue(self.g["disponivel"])
        self.assertLess(os.path.getsize(GOLD), 400 * 1024)   # contrato: gold até ~400 KB
        j = self.g["circulacao"]["janela_horaria"]
        caminho = os.path.join(os.path.dirname(GOLD), "..", "series", os.path.basename(j["url"]))
        with open(caminho, encoding="utf-8") as f:
            janela = json.load(f)
        self.assertEqual((janela["horas"][0], janela["horas"][-1], len(janela["horas"])), (j["inicio"], j["fim"], j["horas"]))

    def test_balanco_mensal_fecha_linha_a_linha(self):
        m = self.g["balanco"]["mensal"]
        for sm, col in m["por_sm"].items():
            for i, mes in enumerate(m["meses"]):
                g_, c_, ic, rb = (col[k][i] for k in ("geracao_mwh", "carga_mwh", "intercambio_mwh", "residuo_balanco_mwh"))
                if None not in (g_, c_, ic, rb):
                    self.assertLessEqual(abs(g_ - c_ - ic - rb), 2.0, f"{sm} {mes}")   # quatro arredondamentos de 0,5 MWh
                ip, fe, rp = (col[k][i] for k in ("intercambio_perimetro_mwh", "fronteiras_exterior_mwh", "residuo_perimetro_mwh"))
                if None not in (ip, fe, rp):
                    self.assertLessEqual(abs(ip - fe - rp), 1.5, f"{sm} {mes}")
                self.assertLessEqual(col["horas_perimetro"][i] or 0, col["horas"][i] or 0)
        # março de 2025 no Sul: 6 dias sem exterior ficam fora do perímetro, não do balanço
        i = m["meses"].index("2025-03")
        s_ = m["por_sm"]["S"]
        self.assertEqual((s_["horas"][i], s_["horas_perimetro"][i]), (744, 600))
        self.assertNotEqual(s_["intercambio_mwh"][i], s_["intercambio_perimetro_mwh"][i])
        self.assertEqual(m["mmgd_estimada"][m["meses"].index("2023-04")], "parcial")
        self.assertEqual(m["mmgd_estimada"][m["meses"].index("2023-03")], "sem")

    def test_quebra_mmgd_conferida(self):
        q = self.g["balanco"]["quebras"][0]
        self.assertEqual(q["dia"], "2023-04-29")
        self.assertTrue(q["degrau_observado_no_dia"])
        self.assertAlmostEqual(q["conferencia_arquivo"]["solar_12h_dia_mwmed"], 14987.696, places=3)
        self.assertNotEqual(q["declaracao"]["confere"], False)
        prov = self.g["proveniencia"]["balanco"]
        self.assertIn("ESTIMADO", {x["natureza"] for x in prov["natureza_componentes"]})
        self.assertTrue(any("MMGD" in x for x in prov["limitacoes"]))
        self.assertEqual({x["natureza"] for x in self.g["proveniencia"]["programado"]["natureza_componentes"]},
                         {"OBSERVADO", "PREVISTO"})
        self.assertEqual(self.g["proveniencia"]["atls"]["natureza"], "CALCULADO")

    def test_exterior_ausente_nao_vira_zero(self):
        for p, r in self.g["exterior"]["resumo_12m"].items():
            if r["horas"] == 0:
                self.assertIsNone(r["exportacao_mwh"], p)
                self.assertIsNone(r["importacao_mwh"], p)
                self.assertNotIn(self.g["paises"][[x["pais"] for x in self.g["paises"]].index(p)]["nome"],
                                 self.g["evidencias"]["exterior_12m"]["entidade"])
            else:
                self.assertIsNotNone(r["exportacao_mwh"], p)
        cob = self.g["cobertura"]["exterior"]
        self.assertEqual(cob["dias_sem_nenhum_dado"] + cob["dias_parciais"], cob["dias_incompletos"])
        for d in cob["lista"]:
            self.assertEqual((d["horas"], d["horas_max"]), (min(d["por_serie"].values()), max(d["por_serie"].values())))

    def test_programa_repetido_rotulado(self):
        pr = self.g["programado"]
        rotulados = {d["dia"] for d in pr["programa_repetido"]["dias"]}
        for m in pr["maiores_desvios"] + pr["maiores_desvios_fora_dos_dias_rotulados"]:
            self.assertEqual(m["dia_rotulado"], m["hora"][:10] in rotulados and m["par"] in ("N_NE", "N_SE", "NE_SE", "S_SE"))
        self.assertFalse(any(m["dia_rotulado"] for m in pr["maiores_desvios_fora_dos_dias_rotulados"]))
        for p, x in pr["distribuicao"].items():
            sem = x["sem_dias_rotulados"]
            self.assertEqual(sem["horas"] + 24 * x["dias_rotulados"], x["horas"], p)
        pdo = pr["versao_programa"]["conferencia_pdo"]
        self.assertEqual(pdo["dias_comparados"] + len(pdo["dias_sem_programado_no_conjunto"]), pdo["dias"])
        self.assertEqual(pdo["horas"], 24 * 2 * pdo["dias_comparados"])

    def test_textos_a05_coerentes_com_os_contadores(self):
        ids = {x["id"]: x for x in self.g["balanco"]["identidades"]}
        a05 = self.g["achados"]["A05"]
        tudo_nne = all(ids[f"perimetro.{sm}"]["horas_residuo"] == 0 for sm in ("N", "NE", "SE"))
        self.assertEqual("em todas as horas no perímetro" in a05["perdas"], tudo_nne)
        for k in ("balanco.S", "soma_sin"):
            if ids[k]["horas_residuo_igual_menos_exterior"]:
                dia = rd.c.data_br(ids[k]["dias_residuo_igual_menos_exterior"][0])
                self.assertTrue(any(dia in f and "igual a menos o intercâmbio internacional" in f for f in a05["frases"]), k)
        total = sum(x["horas_residuo"] for x in ids.values())
        self.assertIn(rd._fmt(total), a05["status"])

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
                trechos = {t["id"]: t for t in docs[f["documento_definicao"]]["trechos"]}
                t = trechos.get(f["fluxo"])
                self.assertTrue(t and t["confere"], f["fluxo"])
                # a definição publicada está escrita no trecho conferido
                self.assertTrue(ons_rede.confere_passagem(t["texto"], f["definicao"]), f["fluxo"])
            if f["fluxo"] == "EXP_NE":
                self.assertIsNone(f["definicao"])


if __name__ == "__main__":
    unittest.main()
