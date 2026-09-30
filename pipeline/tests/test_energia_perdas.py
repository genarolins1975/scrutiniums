"""Testes do módulo Perdas (P055 a P058) com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_perdas/ (tirados dos arquivos oficiais em 30/09/2026):
- samp_balanco_recorte.parquet e samp_balanco_recorte.csv.gz: as MESMAS linhas do SAMP Balanço
  lidas do Parquet oficial e do CSV oficial (recursos independentes do mesmo conjunto). O módulo
  lê o Parquet; os testes de reconciliação releem o CSV com código próprio, sem as funções do
  módulo. Agentes: CEMIG-D (2023 inteiro, trocas de percentual técnico em 2018 e 2023, meses de
  2005 e 2025), Sulgipe (nov/2025, linha TOTAL de 1 kWh), COCEL (nov/2013, linha repetida),
  CERAL Anitápolis (2023, só a linha antiga de perdas), RGE (2019, série encerrada em maio),
  Manaus Energia (2006, perda maior que a injetada) e EMT (jun/2025, leiaute novo);
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
        # intervalo implícito nos números do relatório (44,6 TWh = 7,4%; 40,2 TWh = 6,6%)
        dentro = mod._reconc_2024([{"ano": 2024, "universo": "concessionarias", "injetada_mwh": 605_200_000}])
        fora = mod._reconc_2024([{"ano": 2024, "universo": "concessionarias", "injetada_mwh": 620_700_000}])
        self.assertTrue(dentro.startswith("aprovado"))
        self.assertTrue(fora.startswith("divergente"))


if __name__ == "__main__":
    unittest.main()
