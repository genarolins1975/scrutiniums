"""Módulo Conta de luz (P047 a P050): leitura das bases da ANEEL e do IBGE,
reconciliação por caminho independente, regras de vigência, simulador e gold.

Todas as amostras em pipeline/tests/dados/energia_conta/ são recortes de arquivos
reais capturados em 30/09/2026 (linhas copiadas sem alteração):
- tarifas_amostra.csv: linhas do CSV de tarifas homologadas da ANEEL (CEMIG-D,
  Ceraçá, CEA, RGE/RGE SUL, CERNHE, CERES);
- componentes_cemig_2026.parquet: linhas do Parquet de componentes tarifárias de
  2026 da CEMIG-D (vigência iniciada em 28/05/2026) mais três linhas de outro subgrupo;
- bandeira_adicional.csv e bandeira_acionamento.csv: os dois recursos inteiros;
- subsidios_amostra.csv: três pares distribuidora-mês do CSV de subsídios;
- sidra_ipca_amostra.json: resposta do SIDRA (tabela 1737) de jul/2025 a ago/2026;
- lei_15235_2025_trecho.html e aneel_gd_trecho.html: trechos do HTML oficial.

Os valores esperados são escritos por extenso e conferidos com aritmética decimal
própria do teste, não com as funções do módulo.
"""
import csv
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal as D
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas  # noqa: E402
from pipeline.energia.fontes import aneel_conta as fa  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import ibge_conta as fi  # noqa: E402
from pipeline.energia.modulos import conta  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_conta")
CEMIG = "06981180000116"
CERACA = "09364804000144"
CEA = "05965546000109"
RGE = "02016440000162"
CERNHE = "53176038000186"


def _ler(nome, modo="rb"):
    with open(os.path.join(DADOS, nome), modo) as f:
        return f.read()


def _baixador(conteudo):
    def f(url, caminho):
        with open(caminho, "wb") as fh:
            fh.write(conteudo)
        return caminho, len(conteudo)
    return f


class _Ambiente(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.multiple(base, BRONZE=os.path.join(self.tmp.name, "bronze"),
                                     SILVER=os.path.join(self.tmp.name, "silver"),
                                     SERIES=os.path.join(self.tmp.name, "series"),
                                     DADOS=os.path.join(self.tmp.name, "dados"))
        self.p.start()
        self.con = base.conecta(":memory:")

    def tearDown(self):
        self.con.close()
        self.p.stop()
        self.tmp.cleanup()

    def vintage(self, dataset, recurso, nome_arquivo, ext, orgao="ANEEL", conteudo=None):
        corpo = conteudo if conteudo is not None else _ler(nome_arquivo)
        r = ckan.baixar_recurso(self.con, orgao=orgao, dataset=dataset, recurso=recurso, url=f"https://exemplo/{recurso}",
                                publicado_em="2026-09-30T10:01:51", ext=ext, baixador=_baixador(corpo), max_idade_dias=0)
        self.assertIn(r["status"], ("nova", "identica"))
        return r["vintage"]

    def silver_tarifas(self):
        v = self.vintage(conta.DS_TARIFAS, "tarifas-homologadas-distribuidoras-energia-eletrica.csv",
                         "tarifas_amostra.csv", "csv")
        return conta._processa_tarifas(self.con, v)


def _csv_amostra():
    """Releitura independente do CSV de amostra (módulo csv e Decimal)."""
    texto = _ler("tarifas_amostra.csv").decode("utf-8")
    return list(csv.DictReader(io.StringIO(texto), delimiter=";"))


def _dec(s):
    s = s.strip()
    return D(s.replace(",", ".")) if s else None


class Atos(unittest.TestCase):
    def test_variantes_reais_do_campo_de_ato(self):
        self.assertEqual(fa.ato("RESOLUÇÃO HOMOLOGATÓRIA Nº 3.589, DE 26 DE MAIO DE 2026"), ("REH 3.589/2026", "2026-05-26"))
        self.assertEqual(fa.ato("RESOLUÇÃO HOMOLOGATÓRIA N° 1.870, DE 7 DE ABRIL DE 2015"), ("REH 1.870/2015", "2015-04-07"))
        self.assertEqual(fa.ato("DSP RETIFICAÇÃO DE 24 DE NOVEMBRO DE 2016"), ("DSP-RET 2016-11-24", "2016-11-24"))
        self.assertEqual(fa.ato("DESPACHO Nº 2.783, DE 27 DE NOVEMBRO DE 2018"), ("DSP 2.783/2018", "2018-11-27"))
        # texto vazio: a data do ato não é inventada
        self.assertEqual(fa.ato(""), ("sem ato informado", None))


class LeituraTarifas(_Ambiente):
    def test_recorte_e_motivos_de_exclusao(self):
        res = self.silver_tarifas()
        u = res["universo"]
        self.assertEqual(u["linhas_lidas"], 82)
        self.assertEqual(u["fora_baixa_tensao_b1_b2_b3"], 1)   # linha A2 em kW da CEMIG-D
        self.assertEqual(u["detalhe_especifico"], 1)            # linha SCEE (compensação de MMGD)
        self.assertEqual(u["no_recorte"], 80)

    def test_unidade_diferente_nao_e_convertida_em_silencio(self):
        # caso de robustez: linha real B1 da CEMIG-D com o campo de unidade trocado para kW
        linhas = _ler("tarifas_amostra.csv").decode("utf-8").split("\r\n")
        cab, alvo = linhas[0], next(l for l in linhas if '"CEMIG-D"' in l and '"B1"' in l and '"Residencial";"Residencial"' in l)
        mutada = alvo.replace('"MWh"', '"kW"')
        v = self.vintage(conta.DS_TARIFAS, "t.csv", None, "csv", conteudo=(cab + "\r\n" + mutada + "\r\n").encode("utf-8"))
        cont = {}
        self.assertEqual(list(fa.linhas_tarifas(v["arquivo"], cont)), [])
        self.assertEqual(cont["unidade_diferente_de_mwh"], 1)

    def test_cabecalho_diferente_falha_alto(self):
        v = self.vintage(conta.DS_TARIFAS, "t2.csv", None, "csv", conteudo='"DatGeracao";"DscResolucaoHomologatoria"\r\n"x";"y"\r\n'.encode())
        with self.assertRaises(fa.EsquemaInesperado):
            list(fa.linhas_tarifas(v["arquivo"]))

    def test_tarifa_vigente_cemig_confere_com_releitura_do_csv(self):
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        linha, _ = conta.linha_do_tempo(segs[(CEMIG, "B1", "Residencial", "TA")])
        p = conta.em(linha, "2026-09-30")
        # releitura independente do arquivo
        ref = next(r for r in _csv_amostra() if r["SigAgente"] == "CEMIG-D" and r["DscSubGrupo"] == "B1"
                   and r["DscSubClasse"] == "Residencial" and r["DscBaseTarifaria"] == "Tarifa de Aplicação"
                   and r["DatInicioVigencia"] == "2026-05-28" and r["DscDetalhe"] == "Não se aplica")
        self.assertEqual(D(str(p["tusd"])), _dec(ref["VlrTUSD"]))  # 593,08
        self.assertEqual(D(str(p["te"])), _dec(ref["VlrTE"]))      # 310,21
        self.assertEqual((p["inicio"], p["fim"], p["ato"]), ("2026-05-28", "2027-05-27", "REH 3.589/2026"))
        # custo do perfil de 200 kWh: 200 × 903,29 ÷ 1000 = 180,658
        self.assertAlmostEqual(conta.custo_perfil(conta.total_rs_mwh(p), 200), float(D(200) * D("903.29") / 1000), places=9)
        # base econômica e tarifa de aplicação ficam separadas
        be = conta.em(conta.linha_do_tempo(segs[(CEMIG, "B1", "Residencial", "BE")])[0], "2026-09-30")
        self.assertEqual((be["tusd"], be["te"]), (553.12, 292.88))

    def test_zero_publicado_e_ausencia_sao_estados_distintos(self):
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        # CERES 2010, B2 cooperativa: a fonte publica ',00' nas duas parcelas
        ceres = [s for k, ss in segs.items() if k[1] == "B2" and k[2] == "Cooperativa de eletrificação rural" for s in ss]
        self.assertEqual((ceres[0]["te"], ceres[0]["tusd"]), (0.0, 0.0))
        self.assertIsNone(conta.total_rs_mwh(ceres[0]))
        # CERNHE: vigência terminou em 29/07/2026 sem sucessora na amostra: ausência, não repetição
        linha, _ = conta.linha_do_tempo(segs[(CERNHE, "B1", "Residencial", "TA")])
        self.assertIsNotNone(conta.em(linha, "2026-07-29"))
        self.assertIsNone(conta.em(linha, "2026-09-30"))


class Sobreposicao(_Ambiente):
    def test_ceraca_vigencias_sobrepostas_regra_publicada(self):
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        ss = segs[(CERACA, "B1", "Residencial", "TA")]
        # 15/10/2025 é coberto por duas linhas do mesmo ato: 723,72 (até 31/12/2025) e 567,80 (até 29/09/2026)
        esc, conf = conta.vigente_em(ss, "2025-10-15")
        self.assertEqual(esc["tusd"], 723.72)  # vigência mais curta
        self.assertEqual([a["tusd"] for a in conf["alternativas"]], [567.80])
        # em 2026 as linhas que cobrem a data têm o mesmo valor: não é conflito
        esc, conf = conta.vigente_em(ss, "2026-03-01")
        self.assertEqual((esc["tusd"], conf), (567.80, None))
        linha, conflitos = conta.linha_do_tempo(ss)
        self.assertEqual([(p["inicio"], p["fim"], p["tusd"], p["te"]) for p in linha],
                         [("2025-09-30", "2025-12-31", 723.72, 227.70), ("2026-01-01", "2026-09-29", 567.80, 227.70)])
        self.assertEqual(len(conflitos), 1)
        # valor extremo não é descartado: 723,72 + 227,70 = 951,42 R$/MWh fica na linha do tempo
        self.assertAlmostEqual(conta.total_rs_mwh(linha[0]), 951.42, places=6)

    def test_cea_dois_atos_para_a_mesma_vigencia_vence_o_mais_recente(self):
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        _, _, datas, _, _, _ = conta._siglas(self.con)
        esc, conf = conta.vigente_em(segs[(CEA, "B1", "Residencial", "TA")], "2021-12-01", datas)
        self.assertEqual((esc["ato"], esc["tusd"], esc["te"]), ("REH 3.001/2021", 362.45, 142.80))
        self.assertEqual(conf["alternativas"][0]["ato"], "REH 2.979/2021")

    def test_mudanca_de_sigla_com_mesmo_cnpj_nao_quebra_a_serie(self):
        # RGE SUL incorporou a RGE e passou a usar a sigla RGE com o mesmo CNPJ (2019)
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        linha, _ = conta.linha_do_tempo(segs[(RGE, "B1", "Residencial", "TA")])
        self.assertEqual(linha[0]["inicio"], "2018-04-19")
        self.assertEqual(linha[-1]["fim"], "2021-06-18")
        mais_recente, todas, _, _, _, _ = conta._siglas(self.con)
        self.assertEqual(todas[RGE], ["RGE", "RGE SUL"])
        self.assertEqual(mais_recente[RGE], "RGE")
        # evento de 19/06/2019 (primeira vigência com a sigla RGE) aparece como mudança da mesma série
        evs = conta.eventos_tarifa(linha, {})
        self.assertIn("2019-06-19", [e["data"] for e in evs])


class ComponentesReconciliacao(_Ambiente):
    def test_componentes_somam_te_e_tusd_do_outro_conjunto(self):
        v = self.vintage(conta.DS_COMP, "componentes-tarifarias-2026.parquet", "componentes_cemig_2026.parquet", "parquet")
        cont = {}
        linhas = list(fa.linhas_componentes(v["arquivo"], cont))
        self.assertEqual(cont["linhas_lidas"], 126)
        self.assertEqual(len(linhas), 41)  # só tarifa de aplicação B1 residencial; A2, base econômica e CVA fora
        comps = {l["componente"]: l["valor"] for l in linhas}
        # totais do conjunto de componentes = TE e TUSD do conjunto de tarifas (outro recurso da ANEEL)
        ref = next(r for r in _csv_amostra() if r["SigAgente"] == "CEMIG-D" and r["DscSubGrupo"] == "B1"
                   and r["DscSubClasse"] == "Residencial" and r["DscBaseTarifaria"] == "Tarifa de Aplicação"
                   and r["DatInicioVigencia"] == "2026-05-28" and r["DscDetalhe"] == "Não se aplica")
        self.assertEqual(D(str(comps["TUSD"])), _dec(ref["VlrTUSD"]))
        self.assertEqual(D(str(comps["TE"])), _dec(ref["VlrTE"]))
        grupos, chk = conta.grupos_componentes(comps)
        # parcelas com nove casas somam os totais de duas casas: diferença de arredondamento < 0,01
        self.assertLess(abs(chk["soma_tusd"] - 593.08), 0.01)
        self.assertLess(abs(chk["soma_te"] - 310.21), 0.01)
        self.assertEqual(chk["desconhecidos"], [])
        # grupos conferidos com os valores publicados (Parquet de 2026)
        self.assertAlmostEqual(grupos["distribuicao"], 268.193, places=3)                 # TUSD_FioB
        self.assertAlmostEqual(grupos["energia"], 252.1269 + 11.7469, places=3)          # TE_ENERGIA + TE_ANGRA
        self.assertAlmostEqual(sum(grupos.values()), chk["soma_te"] + chk["soma_tusd"], places=9)
        self.assertLess(abs(sum(grupos.values()) - 903.29), 0.02)
        # nada somado por fora: grupos não incluem os totais TE e TUSD
        self.assertNotIn("TE", conta.GRUPO_DE)
        self.assertNotIn("TUSD", conta.GRUPO_DE)


class Simulador(unittest.TestCase):
    # tarifas publicadas da CEMIG-D, REH 3.589/2026 (R$/MWh): (TE, TUSD)
    T = {"residencial": (310.21, 593.08), "ts1": (297.02, 418.31), "ts2": (297.02, 418.31),
         "ds1": (308.76, 427.67), "ds2": (310.21, 593.08)}
    AMARELA = 18.85

    def test_residencial_abaixo_do_minimo_monofasico(self):
        r = conta.simular(self.T, "residencial", 20, "monofasico", 0.0)
        self.assertEqual(r["kwh_faturado"], 30)
        self.assertAlmostEqual(r["total"], float(D(30) * D("903.29") / 1000), places=9)  # 27,0987

    def test_residencial_200_kwh_com_amarela(self):
        r = conta.simular(self.T, "residencial", 200, "bifasico", self.AMARELA)
        esperado = D(200) * D("903.29") / 1000 + D(200) * D("18.85") / 1000       # 180,658 + 3,77
        self.assertAlmostEqual(r["total"], float(esperado), places=9)
        self.assertAlmostEqual(r["total"], 184.428, places=9)

    def test_trifasico_50_kwh_fatura_100(self):
        r = conta.simular(self.T, "residencial", 50, "trifasico", 0.0)
        self.assertAlmostEqual(r["total"], 90.329, places=9)
        # bandeira incide no consumo, não no mínimo faturado
        r = conta.simular(self.T, "residencial", 50, "trifasico", self.AMARELA)
        self.assertAlmostEqual(r["bandeira"], 50 * 18.85 / 1000, places=9)

    def test_tarifa_social_gratuidade_ate_80_kwh(self):
        r = conta.simular(self.T, "tarifa_social", 80, "trifasico", self.AMARELA)
        self.assertAlmostEqual(r["total"], 0.0, places=9)
        r = conta.simular(self.T, "tarifa_social", 150, "monofasico", self.AMARELA)
        faixa2 = D(70) * (D("297.02") + D("418.31")) / 1000                         # 50,0731
        band = D(70) * D("18.85") / 1000                                             # 1,3195
        self.assertAlmostEqual(r["total"], float(faixa2 + band), places=9)
        # o desconto aparece como linha própria (custeado pela CDE), igual ao valor bruto da faixa 01
        bruto, desconto = r["linhas"][0]["valor"], r["linhas"][1]["valor"]
        self.assertAlmostEqual(bruto + desconto, 0.0, places=9)
        self.assertAlmostEqual(bruto, float(D(80) * D("715.33") / 1000), places=9)

    def test_desconto_social_por_parcela(self):
        r = conta.simular(self.T, "desconto_social", 150, "monofasico", 0.0)
        esperado = D(120) * D("736.43") / 1000 + D(30) * D("903.29") / 1000       # 88,3716 + 27,0987
        self.assertAlmostEqual(r["total"], float(esperado), places=9)
        r = conta.simular(self.T, "desconto_social", 10, "monofasico", 0.0)
        self.assertAlmostEqual(r["total"], float(D(30) * D("736.43") / 1000), places=9)

    def test_classe_sem_tarifa_fica_indisponivel_sem_substituto(self):
        r = conta.simular({"residencial": (310.21, 593.08)}, "tarifa_social", 100, "monofasico", 0.0)
        self.assertFalse(r["disponivel"])
        r = conta.simular(self.T, "rural", 100, "monofasico", 0.0)
        self.assertFalse(r["disponivel"])
        self.assertFalse(conta.simular(self.T, "residencial", 100, "quadrifasico")["disponivel"])


class Bandeiras(_Ambiente):
    def test_adicionais_conferem_com_a_pagina_oficial_e_unidade_e_mwh(self):
        v = self.vintage(conta.DS_BAND, "Bandeira Tarifária - Adicional", "bandeira_adicional.csv", "csv")
        linhas = fa.linhas_bandeira_adicional(v["arquivo"])
        vig = {l["bandeira"]: l["rs_mwh"] for l in linhas if l["vigencia"] == "2024-04-01"}
        # página oficial da ANEEL (Sobre Bandeiras Tarifárias, consultada em 30/09/2026):
        # R$ 0,01885, R$ 0,04463 e R$ 0,07877 por kWh
        self.assertEqual(D(str(vig["Amarela"])) / 1000, D("0.01885"))
        self.assertEqual(D(str(vig["Vermelha P1"])) / 1000, D("0.04463"))
        self.assertEqual(D(str(vig["Vermelha P2"])) / 1000, D("0.07877"))
        self.assertEqual([l["rs_mwh"] for l in linhas if l["bandeira"] == "Escassez Hídrica"], [142.0])

    def test_acionamento_mensal(self):
        v = self.vintage(conta.DS_BAND, "Bandeira Tarifária - Acionamento", "bandeira_acionamento.csv", "csv")
        ac = {l["mes"]: (l["bandeira"], l["rs_mwh"]) for l in fa.linhas_bandeira_acionamento(v["arquivo"])}
        self.assertEqual(ac["2026-09"], ("Amarela", 18.85))
        self.assertEqual(ac["2026-01"], ("Verde", 0.0))   # verde: zero publicado, sem acréscimo
        self.assertEqual(ac["2025-08"], ("Vermelha P2", 78.77))
        self.assertNotIn("2026-10", ac)                   # outubro ainda não publicado: não é preenchido


class Ipca(unittest.TestCase):
    def test_razao_de_indices_confere_com_variacao_publicada(self):
        linhas = fi.linhas_ipca(_ler("sidra_ipca_amostra.json"))
        idx = {m: v for var, m, v in linhas if var == "indice"}
        pub = {m: v for var, m, v in linhas if var == "var12m"}
        self.assertEqual((idx["2025-08"], idx["2026-08"]), (7323.91, 7633.23))
        calc = conta.ipca_entre(idx, "2025-08", "2026-08")
        self.assertAlmostEqual(calc, float(D("7633.23") / D("7323.91") - 1), places=12)
        self.assertLessEqual(abs(100 * calc - pub["2026-08"]), 0.01)   # 4,2233 contra 4,22 publicado
        self.assertIsNone(conta.ipca_entre(idx, "2025-08", "2026-09"))  # mês não publicado não é inventado

    def test_calendario(self):
        self.assertEqual(conta.mes_anterior("2026-01"), "2025-12")
        self.assertEqual(conta.soma_meses("2026-08", -12), "2025-08")
        self.assertEqual(conta.soma_meses("2026-08", -120), "2016-08")
        self.assertEqual(conta.fim_do_mes("2028-02"), "2028-02-29")


class Subsidios(_Ambiente):
    def _obs(self):
        v = self.vintage(conta.DS_SUBS, "Subsídios Tarifários", "subsidios_amostra.csv", "csv")
        conta._processa_subsidios(self.con, v)
        return conta.valores_vigentes(self.con, conta.DS_SUBS)

    def test_totais_conferencias_e_competencia_futura(self):
        ag = conta.agrega_subsidios(self._obs(), "2026-09")
        self.assertEqual(ag["futuros"], 1)   # Energisa AC, competência 11/2026 (posterior à referência): fora
        chk = ag["checagem"]["total_vs_categorias"]
        self.assertEqual(chk["comparacoes"], 2)
        self.assertEqual(chk["divergem"], 1)  # 06/2017, CNPJ 07522669000192: categorias 3.209.009,18 x Total 3.299.852,83
        self.assertAlmostEqual(chk["maior_diferenca_rs"], float(D("3299852.83") - D("3209009.18")), places=2)
        # a linha Total publicada nunca entra na soma por categoria
        self.assertNotIn("Total", ag["anual"])
        # previsão e ajuste só no bronze; a conferência Total = previsão + ajuste é feita na ingestão
        series = conta.valores_vigentes(self.con, conta.DS_SUBS)
        self.assertTrue(all(s_.split("|")[1] == "Total" for s_ in series))
        v = [x for x in base.vintages_do_dataset(self.con, conta.DS_SUBS)][-1]
        uni = base.registros_como_estavam_em(self.con, conta.DS_SUBS)[f"__universo__|{v['vintage_id']}"]
        self.assertEqual(int(uni["total_vs_previsao_mais_ajuste_divergem"]), 0)
        self.assertGreater(int(uni["total_vs_previsao_mais_ajuste_comparacoes"]), 0)
        self.assertAlmostEqual(ag["anual"]["Rural"]["2017"], 1572824.07, places=2)

    def test_energisa_ac_abril_2025_releitura_independente(self):
        ag = conta.agrega_subsidios(self._obs(), "2026-09")
        texto = _ler("subsidios_amostra.csv").decode("utf-8")
        esperado = sum((_dec(r["VlrSubsidio"]) for r in csv.DictReader(io.StringIO(texto), delimiter=";")
                        if r["NumCNPJDistribuidora"] == "04065033000170" and r["DatSubsidio"] == "01/04/2025"
                        and r["DscTipoMontante"] == "Total" and r["DscTipoSubsidio"] != "Total"), D(0))
        obtido = sum(v for (cn, ano), cats in ag["por_dist_ano"].items() if cn == "04065033000170" and ano == "2025"
                     for v in cats.values())
        self.assertAlmostEqual(obtido, float(esperado), places=2)


class Normas(unittest.TestCase):
    def test_trechos_conferidos_no_texto_oficial(self):
        lei = conta.texto_de_html(_ler("lei_15235_2025_trecho.html"))
        self.assertTrue(all(conta.confere_trechos(lei, conta.NORMAS[0]["trechos"]).values()))
        gd = conta.texto_de_html(_ler("aneel_gd_trecho.html"))
        self.assertTrue(all(conta.confere_trechos(gd, conta.NORMAS[2]["trechos"]).values()))

    def test_texto_alterado_derruba_a_conferencia(self):
        lei = conta.texto_de_html(_ler("lei_15235_2025_trecho.html")).replace("80 kWh/mês", "100 kWh/mês")
        res = conta.confere_trechos(lei, conta.NORMAS[0]["trechos"])
        self.assertFalse(res[conta.NORMAS[0]["trechos"][0]])


class Gold(_Ambiente):
    """Gold construída de ponta a ponta a partir das amostras reais."""

    def _monta(self):
        self.silver_tarifas()
        conta._processa_componentes(self.con, self.vintage(conta.DS_COMP, "componentes-tarifarias-2026.parquet",
                                                           "componentes_cemig_2026.parquet", "parquet"))
        for rec, arq in (("Bandeira Tarifária - Adicional", "bandeira_adicional.csv"),
                         ("Bandeira Tarifária - Acionamento", "bandeira_acionamento.csv")):
            conta._processa_bandeiras(self.con, self.vintage(conta.DS_BAND, rec, arq, "csv"))
        conta._processa_subsidios(self.con, self.vintage(conta.DS_SUBS, "Subsídios Tarifários", "subsidios_amostra.csv", "csv"))
        conta._processa_ipca(self.con, self.vintage(conta.DS_IPCA, "sidra_1737_ipca", "sidra_ipca_amostra.json", "json", orgao="IBGE"))
        conta._processa_norma(self.con, conta.NORMAS[0], self.vintage(conta.DS_NORMAS, "lei_15235_2025", "lei_15235_2025_trecho.html", "html", orgao="camara"))
        return conta.construir(self.con, {"hoje": date(2026, 9, 30)})

    def test_gold_ponta_a_ponta(self):
        g = self._monta()
        self.assertTrue(g["disponivel"])
        vig = {v["cnpj"]: v for v in g["tarifas"]["vigentes"]}
        self.assertEqual(sorted(vig), [CEMIG])  # Ceraçá e CERNHE sem vigência em 30/09/2026 na amostra
        self.assertEqual(vig[CEMIG]["total"], 903.29)
        self.assertEqual(vig[CEMIG]["perfis"], {"100": 90.33, "200": 180.66, "300": 270.99})
        sem = {s["cnpj"] for s in g["tarifas"]["sem_vigente"]}
        self.assertTrue({CERACA, CERNHE} <= sem)
        comp = g["composicao"]["distribuidoras"][0]
        self.assertTrue(comp["fecha_com_total"] and comp["confere_com_tarifas"])
        self.assertEqual(g["composicao"]["reconciliacao"]["conferidas"], 1)
        # simulador: tarifas da CEMIG-D e bandeira de setembro de 2026
        sim = g["simulador"]
        self.assertEqual(sim["bandeira_vigente"]["mes"], "2026-09")
        self.assertEqual(sim["bandeira_vigente"]["bandeira"], "Amarela")
        # setembro/2026 é o mês de referência e está publicado: sem aviso de defasagem
        self.assertIsNone(sim["bandeira_vigente"]["aviso"])
        self.assertEqual(sim["estado_regras"]["tarifa_social"], "CONFERIDA")
        self.assertEqual(sim["estado_regras"]["custo_disponibilidade"], "NAO_CAPTURADA")
        casos = {tuple(x[:4]): x[4] for x in sim["casos_referencia"]["casos"]}
        self.assertEqual(casos[("residencial", 25, "monofasico", "Verde")], 27.1)     # 30 × 0,90329
        self.assertEqual(casos[("tarifa_social", 80, "trifasico", "Amarela")], 0.0)
        b2 = next(r for r in _csv_amostra() if r["SigAgente"] == "CEMIG-D" and r["DscSubGrupo"] == "B2"
                  and r["DscSubClasse"] == "Não se aplica" and r["DscBaseTarifaria"] == "Tarifa de Aplicação"
                  and r["DatInicioVigencia"] == "2026-05-28" and r["DscDetalhe"] == "Não se aplica")
        rural = D(100) * (_dec(b2["VlrTE"]) + _dec(b2["VlrTUSD"])) / 1000
        self.assertAlmostEqual(casos[("rural", 150, "monofasico", "Verde")], float(round(rural * D("1.5"), 2)), places=6)
        # comparação com a inflação em 12 meses: tarifa em 31/08/2026 contra 31/08/2025
        j12 = g["reajustes"]["comparacao_inflacao"]["janelas"][0]
        self.assertEqual((j12["de"], j12["ate"], j12["meses"]), ("2025-08-31", "2026-08-31", 12))
        cemig = next(x for x in j12["distribuidoras"] if x[0] == CEMIG)
        esperado = (D("310.21") + D("593.08")) / (D("317.28") + D("541.30")) - 1           # REH 3.589/2026 x vigência de 2025
        self.assertAlmostEqual(cemig[2], float(round(100 * esperado, 2)), places=6)        # 5,21%
        self.assertEqual(j12["ipca_pct"], 4.22)
        self.assertTrue(g["reajustes"]["comparacao_inflacao"]["conferencia_ipca_12m"]["confere"])
        # conflitos da fonte ficam visíveis
        self.assertTrue(any(cf["cnpj"] == CERACA for cf in g["conflitos_fonte"]["b1_residencial"]))
        self.assertGreaterEqual(g["conflitos_fonte"]["total"], len(g["conflitos_fonte"]["b1_residencial"]))
        with open(os.path.join(base.SERIES, conta.CSV_CONF), encoding="utf-8") as f:
            self.assertIn(CERACA, f.read())
        # ausência declarada com motivo: vigência recém-encerrada e sucessora não publicada
        cernhe = next(x for x in g["tarifas"]["sem_vigente"] if x["cnpj"] == CERNHE)
        self.assertEqual(cernhe["dias_sem_tarifa"], 63)
        self.assertIn("ainda não consta", cernhe["motivo"])
        # subsídios: competência posterior à referência fica fora; conferências publicadas
        self.assertEqual(g["subsidios"]["competencias_futuras_excluidas"], 1)
        self.assertEqual(g["subsidios"]["checagem"]["total_vs_categorias"]["divergem"], 1)
        # proveniência completa em todos os blocos
        for chave in ("proveniencia",):
            for bloco in ("tarifas", "composicao", "reajustes", "bandeiras", "subsidios", "simulador"):
                prov = g[bloco][chave]
                self.assertTrue(prov["limitacoes"])
                self.assertRegex(prov["fonte"]["url_dataset"], r"^https://")
                self.assertRegex(prov["snapshot"]["sha256"] or "", r"^[0-9a-f]{64}$")
        # a gold serializa em JSON estrito (sem NaN) e cabe no limite
        texto = json.dumps(g, ensure_ascii=False, allow_nan=False)
        self.assertLess(len(texto.encode()), 400 * 1024)
        # CSV publicado: ausência é campo vazio
        with open(os.path.join(base.SERIES, conta.CSV_VIGENTES), encoding="utf-8") as f:
            t = f.read()
        self.assertNotRegex(t, r";(nan|None|null)(;|\n)")

    def test_sem_tarifas_no_silver_vira_stub(self):
        g = conta.construir(self.con, {"hoje": date(2026, 9, 30)})
        self.assertFalse(g["disponivel"])


class CatalogoDeMetricas(unittest.TestCase):
    def test_metricas_do_modulo_validas(self):
        from pipeline.energia.metricas import conta as mc
        for m in mc.METRICAS:
            self.assertEqual(metricas.validar(m), [], m["id"])
            self.assertEqual(m["gold"], "conta.json")


if __name__ == "__main__":
    unittest.main()
