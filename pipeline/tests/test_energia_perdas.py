"""Testes do módulo Perdas (P055 a P058) com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_perdas/ (tirados dos arquivos oficiais em 30/09/2026):
- samp_balanco_recorte.parquet e samp_balanco_recorte.csv.gz: as MESMAS linhas do SAMP Balanço
  lidas do Parquet oficial e do CSV oficial (recursos independentes do mesmo conjunto). O módulo
  lê o Parquet; os testes de reconciliação releem o CSV com código próprio, sem as funções do
  módulo. Agentes: CEMIG-D (2023 inteiro, trocas de percentual técnico em 2018 e 2023, meses de
  2005 e 2025), Sulgipe (nov/2025, linha TOTAL de 1 kWh), COCEL (nov/2013, linha repetida),
  CERAL Anitápolis (2023, só a linha antiga de perdas), RGE (2019, série encerrada em maio),
  Manaus Energia (2006, perda maior que a injetada), EMT (jun/2025, leiaute novo), COCEL
  (fev/2026, linha "Total (todos os níveis)" da injetada divergente da linha TOTAL), COPREL
  (ago/2024, divergência arbitrada pelo fechamento do balanço) e EFLJC (jan a ago de 2025 e jan
  a jul de 2026, acumulado do ano aberto);
- mmgd_so_mmgd_recorte.csv: empreendimentos de MMGD (só CNPJ da distribuidora, município e
  sigla; sem dado pessoal) de quatro municípios fora da relação de conjuntos;
- componentes_b1_cemig.csv.gz: componentes tarifárias da CEMIG-D (REH 2.396/2018 e 3.459/2025);
- indqual_municipio_recorte.csv, limites_continuidade_recorte.csv, mmgd_recorte.csv: conjuntos
  da EPB (Santa Rita), Neoenergia PE (Oratório), RGE Sul (Veranópolis), Elektro (Paraibuna) e
  CEDRAP, com as linhas originais e as primeiras linhas de MMGD de cada par;
- ibge_*_recorte.json: respostas reais da API do IBGE filtradas aos municípios acima.
"""
import collections
import csv
import gzip
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import metricas  # noqa: E402
from pipeline.energia.fontes import aneel_perdas as ap  # noqa: E402
from pipeline.energia.metricas import perdas as metricas_perdas  # noqa: E402
from pipeline.energia.modulos import perdas as mod  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_perdas")
CEMIG, SULGIPE, COCEL, CERAL = "06981180000116", "13255658000196", "75805895000130", "75826404000138"
RGE, MANAUS, EMT = "02016439000138", "02341467100020", "03467321000199"
COPREL, EFLJC = "90660754000160", "86301124000122"
EPB, ELEKTRO, CEDRAP, RGESUL, NEO_PE = "09095183000140", "02328280000197", "60196987000193", "02016440000162", "10835932000108"


def _mensal():
    meses, cadastro, dup = ap.pivota(ap.linhas_parquet(os.path.join(DADOS, "samp_balanco_recorte.parquet")))
    out = collections.defaultdict(dict)
    for (cnpj, comp), d in meses.items():
        out[cnpj][comp] = ap.mes_balanco(d)
    return out, cadastro, dup


def _csv_samp():
    with gzip.open(os.path.join(DADOS, "samp_balanco_recorte.csv.gz"), "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


class ReconciliacaoComArquivoOriginal(unittest.TestCase):
    """Caminho independente: o CSV oficial relido com código próprio contra o resultado do
    módulo sobre o Parquet oficial."""

    @classmethod
    def setUpClass(cls):
        cls.mensal, cls.cad, cls.dup = _mensal()
        cls.csv = _csv_samp()

    def _soma_csv(self, cnpj, ano, modalidade, caracteristica):
        return sum(int(r["VlrEnergia"]) for r in self.csv
                   if r["NumCPFCNPJ"] == cnpj and r["AnoReferenciaBalanco"] == str(ano)
                   and r["DscModalidadeBalanco"] == modalidade and r["DscCctBalanco"] == caracteristica)

    def test_perdas_totais_anuais_iguais_no_csv_e_no_parquet(self):
        # valores concretos da fonte (kWh), somados no CSV linha a linha
        esperado = {(CEMIG, 2023): 6_691_132_265, (MANAUS, 2006): 1_991_209_900, (RGE, 2019): 472_220_789}
        for (cnpj, ano), kwh in esperado.items():
            self.assertEqual(self._soma_csv(cnpj, ano, "Perdas na Distribuição (valor medido)", "Perdas Totais"), kwh)
            self.assertEqual(ap.anual(self.mensal[cnpj], ano)["perdas_totais_med"], kwh)

    def test_tecnicas_e_nao_tecnicas_somam_o_total_cemig_2023(self):
        a = ap.anual(self.mensal[CEMIG], 2023)
        self.assertEqual(a["perdas_tecnicas"], self._soma_csv(CEMIG, 2023, "Perdas na Distribuição (valor medido)", "Perdas Técnicas"))
        # a fonte arredonda cada linha mensal ao kWh: técnica + não técnica difere do total em até
        # 1 kWh por mês (2 kWh em 2023); diferença maior indicaria linha trocada
        self.assertLessEqual(abs(a["perdas_tecnicas"] + a["pnt_med"] - a["perdas_totais_med"]), 12)
        self.assertEqual(a["perdas_tecnicas"] + a["pnt_med"] - a["perdas_totais_med"], 2)
        self.assertEqual((a["perdas_tecnicas"], a["pnt_med"]), (4_843_305_434, 1_847_826_833))

    def test_identidade_do_balanco_cemig_junho_2023(self):
        # injetada − fornecida − irregular = perda publicada, com os números da fonte
        m = self.mensal[CEMIG]["2023-06"]
        self.assertEqual(m["injetada"], 4_586_352_923)
        self.assertEqual(m["fornecida_med"], 2_204_773_465 + 2_207_037 + 1_930_724_152 + 27_499_275)
        self.assertEqual(m["irregular"], 15_580_000 + 170_000)
        self.assertEqual(m["perdas_totais_med"], 405_398_994)
        self.assertEqual(m["residuo"], 0)
        # a técnica é a mesma nas bases medida e faturada; a não técnica faturada é negativa
        self.assertEqual(m["perdas_tecnicas"], 367_531_978)
        self.assertEqual(m["pnt_fat"], -1_016_760)

    def test_ano_inteiro_da_cemig_fecha(self):
        a = ap.anual(self.mensal[CEMIG], 2023)
        self.assertEqual(a["residuo"], 0)
        self.assertEqual(ap.estado_reconciliacao(a), "fecha")
        self.assertEqual(round(ap.taxa(a["perdas_totais_med"], a["injetada_ref"]), 3), 11.481)

    def test_mercado_bt_releitura_independente(self):
        # BT medido = cativo + consumo próprio + livre, linhas "- BT (Menor que 2,3 kV)"
        bt = sum(int(r["VlrEnergia"]) for r in self.csv
                 if r["NumCPFCNPJ"] == CEMIG and r["AnoReferenciaBalanco"] == "2023"
                 and r["DscDetalheBalanco"] == "Energia Medida (kWh) - BT (Menor que 2,3 kV)"
                 and r["DscCctBalanco"] in ("Fornecimento - Cativo", "Fornecimento - consumo próprio", "Mercado Livre"))
        self.assertEqual(ap.anual(self.mensal[CEMIG], 2023)["bt_med"], bt)
        self.assertEqual(bt, 22_316_536_867)


class RepresentacoesEResiduo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mensal, _, _ = _mensal()

    def test_sulgipe_linha_total_de_1_kwh_nao_vira_injetada(self):
        m = self.mensal[SULGIPE]["2025-11"]
        self.assertEqual(m["injetada"], 55_284_970)
        self.assertEqual(m["injetada_repr"], "todos=niveis")
        self.assertIn("injetada", m["conflitos"])
        self.assertEqual(m["residuo"], 0)

    def test_cocel_residuo_e_publicado_e_nao_escondido(self):
        m = self.mensal[COCEL]["2013-11"]
        # a linha "Uso Distribuidoras" repete o cativo; a perda da fonte não a desconta
        self.assertEqual(m["fornecida_partes"]["uso_distribuidoras"], 25_167_078)
        self.assertEqual(m["residuo"], -25_167_078)
        self.assertEqual(m["perdas_totais_med"], 1_041_386)
        self.assertEqual(m["injetada_ref"], m["injetada"])  # leiaute antigo: injetada publicada

    def test_emt_leiaute_2024_usa_a_injetada_do_calculo_da_fonte(self):
        m = self.mensal[EMT]["2025-06"]
        self.assertEqual(m["injetada"], 1_471_289_259)
        self.assertEqual(m["fornecida_med"], 709_663_270 + 814_241 + 298_043_938 + 331_410)
        self.assertEqual(m["injetada_ref"], 1_008_852_859 + 4_757_709 + 181_187_877)
        self.assertEqual(m["injetada_ref_origem"], "requerida")
        self.assertEqual(m["residuo"], 276_490_814)
        self.assertAlmostEqual(ap.taxa(m["perdas_totais_med"], m["injetada_ref"]), 15.1647, places=3)

    def test_ceral_linha_antiga_nao_entra_na_serie_medida(self):
        a = ap.anual(self.mensal[CERAL], 2023)
        self.assertEqual(a["meses"], 12)
        self.assertIsNone(a["perdas_totais_med"])  # ausência, não zero
        self.assertEqual(a["meses_perdas_legado"], 12)
        self.assertGreater(a["perdas_legado"], 0)
        m = self.mensal[CERAL]["2023-01"]
        self.assertEqual(m["perdas_legado"], 247_686)
        self.assertEqual(m["injetada"] - 1_140_926, 247_686)  # injetada − mercado de referência


class RobustezEAusencia(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mensal, cls.cad, _ = _mensal()

    def test_grande_cemig_completa_sem_alerta(self):
        a = mod._anual_distribuidora(self.mensal[CEMIG], 2023)
        self.assertTrue(a["completo"])
        self.assertEqual(a["alertas"], [])
        self.assertEqual(a["origem_injetada"], "publicada")
        self.assertAlmostEqual(a["pnt_bt"], 100 * 1_847_826_833 / 22_316_536_867, places=9)

    def test_mudanca_societaria_rge_serie_encerrada_em_maio_de_2019(self):
        a = mod._anual_distribuidora(self.mensal[RGE], 2019)
        self.assertEqual(a["meses"], 5)
        self.assertFalse(a["completo"])
        self.assertEqual(max(self.mensal[RGE]), "2019-05")
        self.assertFalse(mod._valido_para_agregado(a))

    def test_valor_extremo_manaus_2006_perda_maior_que_injetada(self):
        a = mod._anual_distribuidora(self.mensal[MANAUS], 2006)
        self.assertTrue(a["completo"])
        self.assertIn("perda_total_maior_que_injetada", a["alertas"])
        self.assertFalse(mod._valido_para_agregado(a))
        self.assertGreater(a["taxa_total"], 100)  # o valor da fonte continua visível, com alerta

    def test_ausencias_distintas_de_zero(self):
        self.assertIsNone(self.mensal[CEMIG]["2005-06"]["bt_med"])  # sem níveis de tensão antes de 2010
        self.assertIsNone(self.mensal[CEMIG]["2025-06"]["perdas_tecnicas"])  # não publicada em 2025
        self.assertIsNone(self.mensal[CEMIG]["2025-06"]["pnt_med"])
        self.assertIsNone(ap.soma_completa([10, None, 5]))
        self.assertEqual(ap.soma_completa([0, 0]), 0)
        self.assertIsNone(ap.taxa(5, 0))
        a = ap.anual(self.mensal[CEMIG], 2025)  # só junho no recorte
        self.assertEqual(a["meses"], 1)
        self.assertIsNone(a["perdas_tecnicas"])

    def test_agregado_e_razao_de_somas_nao_media_de_taxas(self):
        cemig = mod._anual_distribuidora(self.mensal[CEMIG], 2023)
        manaus = mod._anual_distribuidora(self.mensal[MANAUS], 2006)
        manaus["alertas"] = []  # só para exercitar a soma com duas bases muito diferentes
        manaus["completo"] = True
        anuais = {(CEMIG, 2023): cemig, (MANAUS, 2023): manaus}
        linha = next(x for x in mod._nacional(anuais, {CEMIG: "concessionaria", MANAUS: "concessionaria"}, [2023])
                     if x["universo"] == "concessionarias")
        esperado = 100 * (6_691_132_265 + 1_991_209_900) / (58_278_685_296 + 1_793_575_675)
        self.assertAlmostEqual(linha["taxa_total_pct"], round(esperado, 2), places=2)
        media_simples = (cemig["taxa_total"] + manaus["taxa_total"]) / 2
        self.assertGreater(abs(media_simples - esperado), 40)

    def test_cadastro_nome_e_sigla_da_fonte(self):
        sig, nome = mod._nome_sigla(self.cad[CEMIG]["nomes"])
        self.assertEqual(sig, "CEMIG-D")
        self.assertTrue(nome.startswith("CEMIG DISTRIBUI"))
        # universo: agente com linhas "Perdas na Distribuição" é distribuidora
        meses, _, _ = ap.pivota(ap.linhas_parquet(os.path.join(DADOS, "samp_balanco_recorte.parquet")))
        por = collections.defaultdict(list)
        for (cnpj, _), d in meses.items():
            por[cnpj].append(d)
        self.assertTrue(ap.eh_distribuidora(por[CERAL]) is False)  # no recorte de 2023 só há a linha antiga
        self.assertTrue(ap.eh_distribuidora(por[CEMIG]))


class PercentualTecnicoRegulatorio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mensal, _, _ = _mensal()
        linhas = list(csv.DictReader(io.TextIOWrapper(gzip.open(os.path.join(DADOS, "componentes_b1_cemig.csv.gz")),
                                                      encoding="utf-8"), delimiter=";"))
        cls.tarifa = ap.filtra_componentes_b1(linhas)

    def test_trechos_constantes_e_troca_pro_rata_em_2023(self):
        segs = ap.segmentos_pt(self.mensal[CEMIG])
        self.assertIn({"inicio": "2023-01", "fim": "2023-04", "pct": 8.766, "meses": 4}, segs)
        self.assertIn({"inicio": "2023-06", "fim": "2023-12", "pct": 8.014, "meses": 7}, segs)
        m = self.mensal[CEMIG]["2023-05"]
        pct_maio = 100 * m["perdas_tecnicas"] / m["injetada"]
        self.assertEqual(round(pct_maio, 3), 8.669)
        self.assertEqual(ap.dia_inicio_prorata(pct_maio, 8.766, 8.014, 2023, 5), 28)

    def test_troca_de_2018_coincide_com_vigencia_da_reh_2396(self):
        m = self.mensal[CEMIG]["2018-05"]
        pct = 100 * m["perdas_tecnicas"] / m["injetada"]
        self.assertEqual(round(pct, 3), 7.959)
        antes = round(100 * self.mensal[CEMIG]["2018-04"]["perdas_tecnicas"] / self.mensal[CEMIG]["2018-04"]["injetada"], 3)
        self.assertEqual(antes, 7.84)
        dia = ap.dia_inicio_prorata(pct, 7.84, 8.766, 2018, 5)
        self.assertEqual(dia, 28)
        reh = self.tarifa[(CEMIG, "2018-05-28", "Base Econômica")]
        self.assertIn("2.396", reh["resolucao"])
        self.assertEqual(reh["inicio"], f"2018-05-{dia:02d}")


class TarifaB1(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        linhas = list(csv.DictReader(io.TextIOWrapper(gzip.open(os.path.join(DADOS, "componentes_b1_cemig.csv.gz")),
                                                      encoding="utf-8"), delimiter=";"))
        cls.linhas = linhas
        cls.sel = ap.filtra_componentes_b1(linhas)

    def test_componentes_de_perdas_da_reh_3459_2025(self):
        e = self.sel[(CEMIG, "2025-05-28", "Base Econômica")]
        v = e["valores"]
        self.assertAlmostEqual(v["TUSD_PT"], 43.293939106, places=9)
        self.assertAlmostEqual(v["TUSD_PNT"], 16.720990253, places=9)
        self.assertAlmostEqual(v["TUSD_Per_RB_D"], 0.907021371, places=9)
        self.assertAlmostEqual(v["TE_Per_RB"], 3.766534376, places=9)
        r = ap.resumo_tarifa(e)
        self.assertAlmostEqual(r["total"], 521.43 + 318.75, places=6)
        self.assertAlmostEqual(r["participacao_perdas_pct"], 100 * (43.293939106 + 16.720990253 + 0.907021371 + 3.766534376) / 840.18, places=9)

    def test_tusd_e_a_soma_das_componentes_na_fonte(self):
        # identidade interna da fonte, conferida nas linhas originais (não pelo filtro do módulo)
        soma = collections.defaultdict(float)
        total = {}
        for r in self.linhas:
            if (r["DatInicioVigencia"][:10] != "2025-05-28" or r["DscBaseTarifaria"] != "Base Econômica"
                    or r["DscSubClasseConsumidor"] != "Residencial"):
                continue
            comp, v = r["DscComponenteTarifario"], float(r["VlrComponenteTarifario"])
            if comp in ("TUSD", "TE"):
                total[comp] = v
            elif comp.startswith("TUSD"):
                soma["TUSD"] += v
            elif comp.startswith("TE_"):
                soma["TE"] += v
        self.assertAlmostEqual(soma["TUSD"], total["TUSD"], delta=0.01)
        self.assertAlmostEqual(soma["TE"], total["TE"], delta=0.01)

    def test_filtro_exclui_baixa_renda(self):
        self.assertFalse(any("Baixa" in str(k) for k in self.sel))
        self.assertEqual({k[2] for k in self.sel}, {"Base Econômica", "Tarifa de Aplicação"})


class RelacaoMunicipal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DADOS, "indqual_municipio_recorte.csv"), encoding="latin-1", newline="") as f:
            cls.indqual = list(csv.DictReader(f, delimiter=";"))
        with open(os.path.join(DADOS, "limites_continuidade_recorte.csv"), encoding="latin-1", newline="") as f:
            cls.limites = list(csv.DictReader(f, delimiter=";"))
        with open(os.path.join(DADOS, "mmgd_recorte.csv"), encoding="utf-8", newline="") as f:
            cls.mmgd = ap.contagem_mmgd(csv.DictReader(f, delimiter=";"))
        with open(os.path.join(DADOS, "ibge_localidades_recorte.json"), encoding="utf-8") as f:
            cls.loc = ap.municipios_ibge(f.read())
        cls.vinc, cls.siglas, cls.sem = ap.relacao_municipios(cls.indqual, cls.limites, 2026)

    def test_vinculo_por_conjunto_sem_nome(self):
        self.assertIn((EPB, "2507507"), self.vinc)  # João Pessoa, conjunto Santa Rita
        self.assertEqual(self.vinc[(EPB, "2507507")]["conjuntos"], {"16852"})
        self.assertEqual(self.siglas[EPB], "EPB")

    def test_erro_de_codigo_homonimo_fica_nao_confirmado(self):
        # a relação oficial liga o conjunto "Santa Rita" da EPB (PB) ao código de Santa Rita (MA)
        self.assertIn((EPB, "2110203"), self.vinc)
        self.assertEqual(self.vinc[(EPB, "2110203")]["uf"], "MA")
        self.assertEqual(self.mmgd.get((EPB, "2110203"), 0), 0)
        self.assertGreater(self.mmgd.get((EPB, "2507507"), 0), 0)

    def test_municipio_compartilhado_paraibuna(self):
        dists = {c for (c, cod) in self.vinc if cod == "3535606"}
        self.assertEqual(dists, {ELEKTRO, CEDRAP})
        self.assertTrue(all(self.mmgd.get((c, "3535606"), 0) > 0 for c in dists))

    def test_multiestadual_neoenergia_pe_em_municipio_da_paraiba(self):
        self.assertIn((NEO_PE, "2511202"), self.vinc)  # Pedras de Fogo (PB)
        self.assertEqual(self.vinc[(NEO_PE, "2511202")]["uf"], "PB")

    def test_codigo_ibge_inexistente_marcado(self):
        self.assertIn((RGESUL, "4314530"), self.vinc)
        self.assertNotIn("4314530", self.loc)
        self.assertIn("4322806", self.loc)  # Veranópolis existe

    def test_ano_da_relacao_respeitado(self):
        v2025, _, _ = ap.relacao_municipios(self.indqual, self.limites, 2025)
        v2027, _, _ = ap.relacao_municipios(self.indqual, self.limites, 2027)
        self.assertEqual(set(v2025), set(self.vinc))
        self.assertEqual(v2027, {})  # sem limite no ano, sem vínculo (nada é herdado de outro ano)


class ContextoIBGE(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DADOS, "ibge_10295_recorte.json"), encoding="utf-8") as f:
            corpo = f.read()
        cls.renda = ap.serie_sidra_v3(corpo, 13431)
        cls.moradores = ap.serie_sidra_v3(corpo, 13604)
        with open(os.path.join(DADOS, "ibge_4714_recorte.json"), encoding="utf-8") as f:
            cls.pop = ap.serie_sidra_v3(f.read(), 93)

    def test_media_ponderada_por_moradores_nao_media_simples(self):
        cods = ["2507507", "2501807"]  # João Pessoa e Bayeux
        num = sum(self.renda[c] * self.moradores[c] for c in cods)
        den = sum(self.moradores[c] for c in cods)
        media, n = ap.media_ponderada(self.renda, self.moradores, cods)
        self.assertEqual(n, 2)
        self.assertAlmostEqual(media, num / den, places=9)
        self.assertNotAlmostEqual(media, (self.renda[cods[0]] + self.renda[cods[1]]) / 2, places=0)

    def test_municipio_sem_dado_fica_fora_e_e_contado(self):
        media, n = ap.media_ponderada(self.renda, self.moradores, ["2507507", "4314530"])
        self.assertEqual(n, 1)
        self.assertAlmostEqual(media, self.renda["2507507"], places=9)

    def test_valores_do_ibge_lidos_como_publicados(self):
        self.assertIn("2507507", self.pop)
        self.assertGreater(self.pop["2507507"], self.moradores["2507507"])  # moradores em DPP ocupados < residentes

    def test_spearman_com_empates(self):
        rho, n = ap.spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])
        self.assertEqual(n, 5)
        self.assertAlmostEqual(rho, 0.8, places=9)
        rho, n = ap.spearman([1, 2, 2, 3, 4], [1, 2, 2, 3, 4])
        self.assertAlmostEqual(rho, 1.0, places=9)
        self.assertEqual(ap.spearman([1, 2, 3], [1, 2, 3]), (None, 3))


class ContratoDoModulo(unittest.TestCase):
    def test_metricas_validas(self):
        erros = [e for m in metricas_perdas.METRICAS for e in metricas.validar(m)]
        self.assertEqual(erros, [])

    def test_registro(self):
        reg = mod.REGISTRO
        self.assertEqual((reg["id"], reg["gold"], reg["familia"], reg["ordem"]), ("perdas", "perdas.json", "aneel_distribuicao", 40))
        for d in reg["datasets"]:
            for campo in ("orgao", "nome", "slug", "dataset_silver", "titulo", "estado", "url", "licenca", "paginas", "downloads"):
                self.assertTrue(d.get(campo), f"{d.get('nome')}: {campo}")
        for url in {u for d in reg["datasets"] for u in d["downloads"]}:
            self.assertIn(url, reg["arquivos"])

    def test_reconciliacao_2024_intervalo(self):
        # intervalo implícito nos números do relatório (44,6 TWh = 7,4%; 40,2 TWh = 6,6%):
        # 605,2 TWh (injetada de referência) cabe; 620,7 TWh (injetada bruta publicada) não
        dentro = mod._reconc_2024([{"ano": 2024, "universo": "concessionarias", "injetada_mwh": 605_200_000}])
        fora = mod._reconc_2024([{"ano": 2024, "universo": "concessionarias", "injetada_mwh": 620_700_000}])
        self.assertEqual(dentro[0], "aprovado")
        self.assertIn("[604,5; 606,8]", dentro[1])
        self.assertEqual(fora[0], "reprovado")
        self.assertEqual(mod._reconc_2024([]), (None, "sem dado de 2024"))


class ConflitosDeRepresentacao(unittest.TestCase):
    """Divergência entre as linhas que representam a mesma grandeza: arbitrada pela soma dos
    níveis, pelo fechamento do balanço do mês, ou aberta (alerta)."""

    @classmethod
    def setUpClass(cls):
        cls.mensal, _, _ = _mensal()
        cls.csv = _csv_samp()

    def _linha(self, cnpj, ano, mes, modalidade, caracteristica, detalhe):
        v = [int(r["VlrEnergia"]) for r in self.csv if r["NumCPFCNPJ"] == cnpj and r["AnoReferenciaBalanco"] == str(ano)
             and r["MesReferenciaBalanco"] == str(mes) and r["DscModalidadeBalanco"] == modalidade
             and r["DscCctBalanco"].strip() == caracteristica and r["DscDetalheBalanco"] == detalhe]
        self.assertEqual(len(v), 1)
        return v[0]

    def test_sulgipe_arbitrada_pela_soma_dos_niveis_sem_alerta(self):
        m = self.mensal[SULGIPE]["2025-11"]
        self.assertEqual(m["conflitos"], ["injetada"])
        self.assertEqual(m["conflitos_sem_niveis"], [])
        self.assertEqual(m["conflitos_abertos"], [])

    def test_coprel_arbitrada_pelo_fechamento_do_balanco(self):
        m = self.mensal[COPREL]["2024-08"]
        self.assertEqual(sorted(m["conflitos"]), ["cativo", "injetada"])
        self.assertEqual(m["conflitos_sem_niveis"], ["injetada"])  # sem linhas por nível da injetada
        self.assertEqual(m["residuo"], 0)  # a perda da fonte fecha com a injetada escolhida
        self.assertEqual(m["conflitos_abertos"], [])
        self.assertEqual(m["injetada"], 50_489_683)

    def test_cocel_divergencia_aberta_gera_alerta(self):
        todos = self._linha(COCEL, 2026, 2, "Energia Injetada Total", "Energia Injetada",
                            "Energia Medida (kWh) - Total (todos os níveis de tensão)")
        total = self._linha(COCEL, 2026, 2, "Energia Injetada Total", "Energia Injetada Total", "Energia Medida (kWh)")
        self.assertEqual((todos, total), (981_016, 33_132_240))
        m = self.mensal[COCEL]["2026-02"]
        self.assertEqual(m["conflitos_abertos"], ["injetada"])
        # o denominador do leiaute novo não depende da linha escolhida: é o implícito na perda
        self.assertEqual(m["injetada_ref"], 33_132_240)
        a = mod._anual_distribuidora(self.mensal[COCEL], 2026)
        self.assertIn("representacoes_conflitantes", a["alertas"])
        self.assertFalse(mod._valido_para_agregado(a))


class AcumuladoDoAnoAberto(unittest.TestCase):
    """Ano aberto comparado só com o mesmo período do ano anterior, sobre as mesmas
    distribuidoras. Valores esperados relidos do CSV oficial com código próprio."""

    FORN = {("Energia Vendida", "Fornecimento - Cativo"), ("Energia Vendida", "Fornecimento - consumo próprio"),
            ("Energia Vendida", "Suprimento (Sem CUSD associado)"), ("Energia Entregue", "Mercado Livre"),
            ("Energia Entregue", "Uso Distribuição e Suprimento")}

    @classmethod
    def setUpClass(cls):
        cls.mensal, cls.cad, _ = _mensal()
        cls.csv = _csv_samp()

    def _csv_periodo(self, cnpj, ano, ate):
        """(perdas totais, fornecida + irregular + perdas) em kWh, janeiro..ate, a partir das
        linhas "Total (todos os níveis de tensão)" do CSV."""
        perdas = req = 0
        for r in self.csv:
            if r["NumCPFCNPJ"] != cnpj or r["AnoReferenciaBalanco"] != str(ano) or int(r["MesReferenciaBalanco"]) > ate:
                continue
            mod_, cct, det, v = r["DscModalidadeBalanco"], r["DscCctBalanco"].strip(), r["DscDetalheBalanco"], int(r["VlrEnergia"])
            if mod_ == "Perdas na Distribuição (valor medido)" and cct == "Perdas Totais":
                perdas += v
                req += v
            elif (mod_, cct) in self.FORN and det == "Energia Medida (kWh) - Total (todos os níveis de tensão)":
                req += v
            elif cct == "Energia associada à cobrança por procedimento irregular" and "Total (todos" in det:
                req += v
        return perdas, req

    def test_efljc_janeiro_a_julho_nos_dois_anos(self):
        for ano, perdas, req in ((2025, 733_862, 14_990_823), (2026, 675_133, 13_957_308)):
            self.assertEqual(self._csv_periodo(EFLJC, ano, 7), (perdas, req))
            a = mod._anual_distribuidora(self.mensal[EFLJC], ano, 7)
            self.assertTrue(a["completo"])
            self.assertEqual((a["perdas_totais_med"], a["injetada_ref"]), (perdas, req))
        # agosto de 2025 está no recorte e não entra no acumulado até julho
        self.assertEqual(ap.anual(self.mensal[EFLJC], 2025)["meses"], 8)
        self.assertFalse(mod._anual_distribuidora(self.mensal[EFLJC], 2025)["completo"])

    def test_agregado_do_acumulado_e_razao_de_somas_das_mesmas_distribuidoras(self):
        cad = {EFLJC: self.cad[EFLJC]}
        por, agreg = mod._acumulado(self.mensal, cad, {EFLJC: "concessionaria"}, 2026, 7)
        self.assertTrue(por[EFLJC]["comparavel"])
        conc = next(x for x in agreg if x["universo"] == "concessionarias")
        self.assertEqual(conc["n_distribuidoras"], 1)
        self.assertEqual(conc["atual"]["taxa_total_pct"], round(100 * 675_133 / 13_957_308, 2))  # 4,84%
        self.assertEqual(conc["anterior"]["taxa_total_pct"], round(100 * 733_862 / 14_990_823, 2))  # 4,90%
        # a fonte não publica a separação técnica no ano aberto: ausência, não zero
        self.assertIsNone(conc["atual"]["pnt_bt_pct"])
        self.assertEqual(conc["atual"]["n_com_pnt_bt"], 0)

    def test_mes_faltando_tira_a_distribuidora_sem_completar(self):
        m = {k: v for k, v in self.mensal[EFLJC].items() if k != "2026-03"}
        mensal = {EFLJC: m}
        por, agreg = mod._acumulado(mensal, {EFLJC: self.cad[EFLJC]}, {EFLJC: "concessionaria"}, 2026, 7)
        atual = por[EFLJC]["atual"]
        self.assertFalse(por[EFLJC]["comparavel"])
        self.assertFalse(atual["completo"])
        self.assertEqual(atual["meses"], 6)
        # a soma fica nos 6 meses publicados, rotulada como incompleta: não é escalada para 7
        # meses nem preenchida com o mês vizinho
        marco = sum(int(r["VlrEnergia"]) for r in self.csv if r["NumCPFCNPJ"] == EFLJC and r["AnoReferenciaBalanco"] == "2026"
                    and r["MesReferenciaBalanco"] == "3" and r["DscModalidadeBalanco"] == "Perdas na Distribuição (valor medido)"
                    and r["DscCctBalanco"] == "Perdas Totais")
        self.assertEqual(atual["perdas_totais_med"], 675_133 - marco)
        self.assertEqual(agreg, [])

    def test_sem_mes_no_ano_aberto_nao_ha_recorte(self):
        cemig = mod._anual_distribuidora(self.mensal[CEMIG], 2023)
        self.assertIsNone(mod._mes_fim_parcial(self.mensal, {(CEMIG, 2023): cemig}, 2023, 2024))


class NacionalSemDadoNaoViraZero(unittest.TestCase):
    def test_ano_sem_distribuidora_valida_fica_ausente(self):
        mensal, _, _ = _mensal()
        rge = mod._anual_distribuidora(mensal[RGE], 2019)
        linha = next(x for x in mod._nacional({(RGE, 2019): rge}, {RGE: "concessionaria"}, [2019], 2018)
                     if x["universo"] == "concessionarias")
        self.assertEqual(linha["n_distribuidoras"], 0)
        self.assertEqual(linha["n_publicadas"], 1)
        self.assertTrue(linha["parcial"])
        for campo in ("injetada_mwh", "perdas_totais_mwh", "taxa_total_pct", "pnt_bt_pct"):
            self.assertIsNone(linha[campo], campo)
        self.assertEqual(linha["excluidos"], {"ano_incompleto": 1})


class VinculoSoPeloCadastroDeMMGD(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DADOS, "mmgd_so_mmgd_recorte.csv"), encoding="utf-8", newline="") as f:
            cls.mmgd = ap.contagem_mmgd(csv.DictReader(f, delimiter=";"))

    def test_criterio_minimo_contra_erro_de_cadastro(self):
        eq_ma, eq_pi, eletrocar, coprel, alianca = ("06272793000184", "06840748000189", "88446034000155",
                                                    COPREL, "83647990000181")
        self.assertEqual(self.mmgd[(eq_ma, "2101772")], 108)
        self.assertEqual(self.mmgd[(eq_pi, "2101772")], 1)
        v = ap.vinculos_so_mmgd({"2101772", "2109056", "4220000", "4305603"}, self.mmgd)
        # Bela Vista do Maranhão: 1 registro da Equatorial Piauí é tratado como erro de cadastro
        self.assertEqual(v["2101772"], [(eq_ma, 108)])
        # Colorado (RS): duas distribuidoras com participação relevante
        self.assertEqual(v["4305603"], [(eletrocar, 320), (coprel, 68)])
        self.assertEqual(v["4220000"], [(alianca, 14)])
        # Porto Rico do Maranhão: 5 empreendimentos não bastam; o município fica sem vínculo
        self.assertNotIn("2109056", v)
        # só municípios pedidos: a função não cria vínculo onde a relação oficial já existe
        self.assertEqual(ap.vinculos_so_mmgd({"4305603"}, self.mmgd).keys(), {"4305603"})


class LeituraDoBronze(unittest.TestCase):
    def test_camadas_gzip_da_api_do_ibge(self):
        import gzip as gz
        with open(os.path.join(DADOS, "ibge_4714_recorte.json"), "rb") as f:
            corpo = f.read()
        self.assertEqual(ap.descomprime_camadas(gz.compress(gz.compress(corpo))), corpo)
        self.assertEqual(ap.descomprime_camadas(corpo), corpo)
        pop = ap.serie_sidra_v3(ap.descomprime_camadas(gz.compress(corpo)), 93)
        self.assertIn("2507507", pop)


class GoldPublicada(unittest.TestCase):
    """Contrato da gold publicada (public/energia/gold/perdas.json) conferido por caminhos
    independentes: CSV de download, malha do IBGE e validador de evidências."""

    RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    @classmethod
    def setUpClass(cls):
        caminho = os.path.join(cls.RAIZ, "public", "energia", "gold", "perdas.json")
        if not os.path.exists(caminho):
            raise unittest.SkipTest("gold ainda não gerada")
        with open(caminho, encoding="utf-8") as f:
            cls.gold = json.load(f)
        cls.tamanho = os.path.getsize(caminho)

    def _serie(self, nome):
        return os.path.join(self.RAIZ, "public", "energia", "series", nome)

    def test_disponivel_e_dentro_do_orcamento(self):
        self.assertTrue(self.gold["disponivel"])
        self.assertLessEqual(self.tamanho, 420 * 1024)

    def test_evidencias_validas(self):
        from pipeline.energia import evidencia
        for nome, ev in self.gold["evidencias"].items():
            if ev is not None:
                self.assertEqual(evidencia.validar(ev), [], nome)

    def test_taxa_nacional_refeita_a_partir_do_csv(self):
        ano = self.gold["referencia"]["ano"]
        num = den = 0.0
        with open(self._serie("perdas_distribuidoras.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if (r["ano"] == str(ano) and r["classificacao"].startswith("Concession") and r["completo"] == "1"
                        and not r["alertas"] and r["perdas_totais_mwh"] and r["injetada_referencia_mwh"]):
                    num += float(r["perdas_totais_mwh"])
                    den += float(r["injetada_referencia_mwh"])
        nac = next(x for x in self.gold["nacional"] if x["ano"] == ano and x["universo"] == "concessionarias")
        self.assertAlmostEqual(nac["taxa_total_pct"], round(100 * num / den, 2), places=6)
        self.assertEqual(nac["perdas_totais_mwh"], round(num))

    def test_linha_nacional_sem_distribuidora_nao_tem_zero(self):
        for x in self.gold["nacional"]:
            if x["n_distribuidoras"] == 0:
                self.assertIsNone(x["injetada_mwh"])
                self.assertIsNone(x["taxa_total_pct"])

    def test_municipios_ligados_a_malha_do_ibge(self):
        with open(os.path.join(self.RAIZ, "public", "energia", "geo", "municipios.json"), encoding="utf-8") as f:
            malha = {x["id"] for x in json.load(f)["features"]}
        with open(self._serie("perdas_municipios.json"), encoding="utf-8") as f:
            mun = json.load(f)
        mapa = self.gold["mapa"]
        self.assertEqual(set(mun["municipios"]) - malha, set(mapa["codigos_invalidos"]))
        self.assertEqual(malha - set(mun["municipios"]), set(mapa["municipios_sem_vinculo"]))
        # índice da distribuidora aponta para um CNPJ publicado na gold (que tem valor de perdas)
        cnpjs = {d["cnpj"] for d in self.gold["distribuidoras"]}
        self.assertTrue(set(mun["distribuidoras"]) <= cnpjs)
        self.assertTrue(all(e in (0, 1, 2) for m in mun["municipios"].values() for _, e in m["d"]))

    def test_acumulado_compara_mesmo_recorte(self):
        ac = self.gold["acumulado"]
        if not ac:
            self.skipTest("sem ano aberto")
        self.assertEqual(ac["mes_fim"], self.gold["referencia"]["mes_fim_acumulado"])
        for d in self.gold["distribuidoras"]:
            if d["parcial"] and d["parcial"]["comparavel"]:
                self.assertEqual(d["parcial"]["meses"], ac["mes_fim"])


if __name__ == "__main__":
    unittest.main()
