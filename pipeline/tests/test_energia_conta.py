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
- cde_custeio_amostra.csv: todas as linhas de 2022, 2023 e 2026 do CSV de custeio da CDE;
- lei_15235_2025_trecho.html e aneel_gd_trecho.html: trechos do HTML oficial;
- tarifas_incorporacao_amostra.csv: linhas B1 residenciais de aplicação de 2017 a 2019
  da CPFL Jaguari (hoje CPFL Santa Cruz), das quatro CPFL incorporadas por ela, da RGE
  antiga (CNPJ 02016439000138) e da RGE Sul (02016440000162), para as incorporações;
- tarifas_ubp_amostra.csv e componentes_ubp_2026.parquet: tarifa B1 residencial vigente
  em 30/09/2026 e as componentes (Parquet de 2025) de EAC, ERO e CEA, com o valor
  negativo de TE_CFURH (crédito do repasse da UBP), mais três linhas fora do recorte;
- samp_2025_amostra.parquet: linhas B1 residenciais do SAMP de 2025 (receita de energia e
  ICMS, mercado regular cativo) da CEMIG-D e da CERCOS.

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
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_conta as fa  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import ibge_conta as fi  # noqa: E402
from pipeline.energia.modulos import conta  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_conta")
CEMIG = "06981180000116"
CERACA = "09364804000144"
CEA = "05965546000109"
RGE = "02016440000162"
RGE_ANTIGA = "02016439000138"
CPFL_SANTA_CRUZ = "53859112000169"
CERNHE = "53176038000186"
EAC = "04065033000170"
ERO = "05914650000166"


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

    def test_incorporacao_da_rge_nao_e_mudanca_de_sigla(self):
        # A RGE SUL incorporou a Rio Grande Energia (REA nº 7.499/2018) e passou a usar a
        # sigla RGE com o CNPJ da incorporadora. A série do CNPJ continua, mas o evento de
        # 19/06/2019 compara a tarifa da área da RGE SUL com a da área somada: é mudança de
        # perímetro, marcada, e não reajuste comum.
        self.silver_tarifas()
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        linha, _ = conta.linha_do_tempo(segs[(RGE, "B1", "Residencial", "TA")])
        self.assertEqual(linha[0]["inicio"], "2018-04-19")
        self.assertEqual(linha[-1]["fim"], "2021-06-18")
        mais_recente, todas, _, _, _, _ = conta._siglas(self.con)
        self.assertEqual(todas[RGE], ["RGE", "RGE SUL"])
        self.assertEqual(mais_recente[RGE], "RGE")
        evs = {e["data"]: e for e in conta.eventos_tarifa(linha, {}, conta.mudancas_de_perimetro(RGE))}
        self.assertEqual(evs["2019-06-19"]["mudanca_perimetro"]["ato"], "REA nº 7.499/2018")
        self.assertEqual(evs["2019-06-19"]["mudanca_perimetro"]["incorporadas"], [RGE_ANTIGA])
        # o evento anterior (19/04/2019, mesma área) não é mudança de perímetro
        self.assertIsNone(evs["2019-04-19"]["mudanca_perimetro"])


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

    def test_data_de_referencia_em_brasilia(self):
        from datetime import datetime, timezone
        # 30/09/2026 às 23h30 em UTC ainda é 30/09 às 20h30 em Brasília; 01/10 às 02h UTC é 30/09 às 23h
        self.assertEqual(conta.data_brasilia(datetime(2026, 10, 1, 2, 0, tzinfo=timezone.utc)).isoformat(), "2026-09-30")
        self.assertEqual(conta.data_brasilia(datetime(2026, 10, 1, 3, 0, tzinfo=timezone.utc)).isoformat(), "2026-10-01")

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


class LeituraEmLotes(_Ambiente):
    def test_lotes_pequenos_dao_o_mesmo_resultado(self):
        # o Parquet é lido em lotes para caber na memória; a divisão não pode mudar o resultado
        v = self.vintage(conta.DS_COMP, "componentes-tarifarias-2026.parquet", "componentes_cemig_2026.parquet", "parquet")
        c1, c2 = {}, {}
        inteiro = list(fa.linhas_componentes(v["arquivo"], c1))
        em_lotes = list(fa.linhas_componentes(v["arquivo"], c2, lote=10))   # 126 linhas em 13 lotes
        self.assertEqual(inteiro, em_lotes)
        self.assertEqual(c1, c2)

    def test_parcela_cde_confere_com_releitura_do_parquet(self):
        import pyarrow.parquet as pq
        v = self.vintage(conta.DS_COMP, "componentes-tarifarias-2026.parquet", "componentes_cemig_2026.parquet", "parquet")
        comps = {l["componente"]: l["valor"] for l in fa.linhas_componentes(v["arquivo"])}
        # releitura independente: todas as linhas de aplicação B1 residencial com CDE no código
        t = pq.read_table(os.path.join(DADOS, "componentes_cemig_2026.parquet")).to_pylist()
        esperado = sum((D(str(r["VlrComponenteTarifario"])) for r in t
                        if r["DscSubGrupoTarifario"] == "B1" and r["DscBaseTarifaria"] == "Tarifa de Aplicação"
                        and r["DscSubClasseConsumidor"] == "Residencial" and "CDE" in r["DscComponenteTarifario"]), D(0))
        self.assertAlmostEqual(conta.parcela_cde(comps), float(esperado), places=9)
        # ausência de todas as componentes CDE não vira zero
        self.assertIsNone(conta.parcela_cde({"TE": 300.0, "TUSD": 500.0}))


class CusteioCde(_Ambiente):
    def _vint(self):
        return self.vintage(conta.DS_CDE, "cde-custeio-beneficios-tarifarios.csv", "cde_custeio_amostra.csv", "csv")

    def test_ausencia_zero_e_rubrica_aparada(self):
        cont = {}
        linhas = fa.linhas_cde_custeio(self._vint()["arquivo"], cont)
        self.assertEqual(cont["linhas_lidas"], 86)
        val = {(x["ano"], x["tipo"], x["fonte"]): x["valor"] for x in linhas}
        self.assertIsNone(val[("2026", "Despesa", "Verba MME")])                      # vazio publicado: ausência
        self.assertEqual(val[("2026", "Despesa", "Subsídio Água-esgoto-saneamento")], 0.0)  # "0" publicado: zero
        # 'RGR' (2022) e 'RGR ' (2023, com espaço) são a mesma rubrica depois de aparada
        self.assertIn(("2022", "Receita", "RGR"), val)
        self.assertIn(("2023", "Receita", "RGR"), val)
        self.assertNotIn("rubrica_repetida_com_valor_diferente", cont)

    def test_identidade_e_quotas_2026_contra_releitura_independente(self):
        conta._processa_cde(self.con, self._vint())
        obs = conta.valores_vigentes(self.con, conta.DS_CDE)
        sem_valor = {(ch.split("|")[1], ch.split("|", 2)[2], k.split("|")[1])
                     for ch, campos in base.registros_como_estavam_em(self.con, conta.DS_CDE).items() if ch.startswith("rubrica|")
                     for k, v_ in campos.items() if k.startswith("ano|") and v_ == "vazio"}
        ag = conta.agrega_cde(obs, sem_valor)
        t26 = next(t for t in ag["totais"] if t["ano"] == "2026")
        # releitura com o módulo csv e Decimal
        desp = rec = quotas = D(0)
        for r in csv.DictReader(io.StringIO(_ler("cde_custeio_amostra.csv").decode("utf-8-sig")), delimiter=";"):
            if r["AnoReferencia"] != "2026" or not r["VlrCusteio"].strip():
                continue
            x = D(r["VlrCusteio"].replace(",", "."))
            if r["DscTipoFonte"] == "Despesa":
                desp += x
            else:
                rec += x
                quotas += x if r["DscFonte"].startswith("Quotas CDE") else D(0)
        self.assertEqual(round(desp, 2), D("52660050882.84"))
        self.assertAlmostEqual(t26["despesa"], float(desp), places=2)
        self.assertAlmostEqual(t26["receita"], float(rec), places=2)
        self.assertTrue(t26["fecha"])
        self.assertAlmostEqual(t26["grupos"]["quotas_tarifa"], float(quotas), places=2)   # 50.743.043.602,87
        self.assertAlmostEqual(t26["quotas_pct"], float(100 * quotas / rec), places=9)    # 96,36%
        self.assertEqual(t26["rubricas_sem_valor"],
                         ["CDE Eletrobras - Lei 14.182", "Indenização das Concessões", "Subvenção RTE", "Verba MME"])
        # rubrica sem valor fica nula na série da rubrica, não zero
        verba = next(l for l in ag["linhas"] if l["fonte"] == "Verba MME")
        self.assertIsNone(verba["valores"]["2026"])
        # a Tarifa Social é a rubrica Subsídio Baixa Renda; descontos a categorias ficam em outro grupo
        self.assertEqual(conta.grupo_cde("Despesa", "Subsídio Baixa Renda"), "tarifa_social")
        self.assertEqual(conta.grupo_cde("Despesa", "Subsídio Rural"), "descontos_tarifarios")
        self.assertEqual(conta.grupo_cde("Despesa", "Subsídio GD - Lei 14.300"), "descontos_tarifarios")
        self.assertEqual(conta.grupo_cde("Receita", "Quotas CDE - GD"), "quotas_tarifa")
        self.assertEqual(conta.grupo_cde("Receita", "Recursos da União"), "outras_receitas")

    def test_ano_que_nao_fecha_fica_marcado(self):
        obs = {"Despesa|CCC": {"2030": 100.0}, "Receita|Quotas CDE Uso": {"2030": 90.0}}
        t = conta.agrega_cde(obs)["totais"][0]
        self.assertFalse(t["fecha"])
        self.assertAlmostEqual(t["quotas_pct"], 100.0, places=9)


class Gold(_Ambiente):
    """Gold construída de ponta a ponta a partir das amostras reais."""

    def _monta(self):
        # as linhas das incorporações completam a série da RGE da amostra principal (a RGE
        # antiga termina na véspera da tarifa unificada da RGE SUL)
        conta._processa_tarifas(self.con, self.vintage(conta.DS_TARIFAS, "t-incorporacao.csv",
                                                       "tarifas_incorporacao_amostra.csv", "csv"))
        self.silver_tarifas()
        conta._processa_componentes(self.con, self.vintage(conta.DS_COMP, "componentes-tarifarias-2026.parquet",
                                                           "componentes_cemig_2026.parquet", "parquet"))
        for rec, arq in (("Bandeira Tarifária - Adicional", "bandeira_adicional.csv"),
                         ("Bandeira Tarifária - Acionamento", "bandeira_acionamento.csv")):
            conta._processa_bandeiras(self.con, self.vintage(conta.DS_BAND, rec, arq, "csv"))
        conta._processa_subsidios(self.con, self.vintage(conta.DS_SUBS, "Subsídios Tarifários", "subsidios_amostra.csv", "csv"))
        conta._processa_ipca(self.con, self.vintage(conta.DS_IPCA, "sidra_1737_ipca", "sidra_ipca_amostra.json", "json", orgao="IBGE"))
        conta._processa_cde(self.con, self.vintage(conta.DS_CDE, "cde-custeio-beneficios-tarifarios.csv", "cde_custeio_amostra.csv", "csv"))
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
        # só a lei foi capturada nesta amostra: a Tarifa Social tem parte na página da ANEEL
        # (não capturada) e fica parcial; o custo de disponibilidade não tem parte conferida
        self.assertEqual(sim["estado_regras"]["tarifa_social"], "PARCIAL")
        self.assertEqual(sim["estado_regras"]["custo_disponibilidade"], "NAO_CONFERIDA")
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

    def test_evidencias_validas_e_historico_fora_da_gold(self):
        g = self._monta()
        evs = {"mediana": g["tarifas"]["evidencia_mediana"], "composicao": g["composicao"]["evidencia"],
               "simulador": g["simulador"]["evidencia"], "reajuste": g["reajustes"]["evidencia"],
               "bandeira": g["bandeiras"]["evidencia"], "cde": g["financiamento_cde"]["evidencia"]}
        # a amostra de subsídios não tem ano completo de competência: a evidência fica nula,
        # em vez de comprovar um total anual que não existe
        self.assertIsNone(g["subsidios"]["ultimo_ano_completo"])
        self.assertIsNone(g["subsidios"]["evidencia"])
        for nome, e in evs.items():
            self.assertIsNotNone(e, nome)
            self.assertEqual(ev.validar(e), [], nome)
            self.assertRegex(e["fonte"]["sha256"] or "", r"^[0-9a-f]{64}$", nome)
        # mediana de uma distribuidora só = a própria tarifa da CEMIG-D
        self.assertEqual(evs["mediana"]["valor_calculo"], 903.29)
        self.assertEqual(evs["mediana"]["valor_exibido"], "R$ 0,9033/kWh")
        # simulador: 150 kWh residenciais com a amarela de set/2026 na CEMIG-D
        esperado = D(150) * D("903.29") / 1000 + D(150) * D("18.85") / 1000         # 135,4935 + 2,8275
        self.assertAlmostEqual(evs["simulador"]["valor_calculo"], float(esperado), places=9)
        # composição: encargos da CEMIG-D ÷ 903,29, numerador e denominador publicados
        self.assertAlmostEqual(evs["composicao"]["numerador"]["valor"] / evs["composicao"]["denominador"]["valor"] * 100,
                               evs["composicao"]["valor_calculo"], places=9)
        # quotas da CDE em 2026 (ano mais recente da amostra)
        self.assertEqual(g["financiamento_cde"]["ultimo_ano"], "2026")
        self.assertEqual(evs["cde"]["periodo"], {"inicio": "2026", "fim": "2026"})
        # histórico por distribuidora publicado fora da gold, com as vigências resolvidas
        self.assertNotIn("historico", g["tarifas"])
        with open(os.path.join(base.SERIES, conta.JSON_HIST), encoding="utf-8") as f:
            hist = json.load(f)
        cemig = hist["distribuidoras"][CEMIG]
        self.assertEqual(cemig["vigencias"][-1], ["2026-05-28", "2027-05-27", "REH 3.589/2026", 310.21, 593.08, 903.29])
        ev26 = next(e for e in cemig["eventos"] if e[0] == "2026-05-28")
        var = (D("310.21") + D("593.08")) / (D("317.28") + D("541.30")) - 1
        self.assertEqual(ev26[5], float(round(100 * var, 2)))                            # 5,21%
        # último evento de cada distribuidora do ranking na gold
        self.assertEqual(g["reajustes"]["ultimos"][0][:3], [CEMIG, "CEMIG-D", "2026-05-28"])
        # efeito médio do processo tarifário: declarado como não integrado, com motivo
        self.assertFalse(g["reajustes"]["efeito_medio"]["disponivel"])
        with open(os.path.join(base.SERIES, conta.CSV_JAN), encoding="utf-8") as f:
            self.assertIn(CEMIG, f.read())

    def test_natureza_da_proveniencia_igual_a_da_metrica(self):
        from pipeline.energia.metricas import conta as mc
        g = self._monta()
        metr = {m["id"]: m for m in mc.METRICAS}
        for bloco, mid in conta.METRICA_DO_BLOCO.items():
            self.assertEqual(g[bloco]["proveniencia"]["natureza"], metr[mid]["natureza_transformacao"], bloco)
        sim = g["simulador"]["proveniencia"]
        # o simulador tem proveniência própria: estimativa, com tarifas, bandeiras e normas
        self.assertNotEqual(sim, g["tarifas"]["proveniencia"])
        self.assertEqual(sim["natureza"], "ESTIMADO")
        self.assertIn("Bandeira", sim["fonte"]["recurso"])
        self.assertIn("lei_15235_2025", sim["fonte"]["recurso"])
        self.assertEqual(sim["formula"], g["simulador"]["formula"])
        self.assertTrue(any("não conferidas" in x and "Tarifa Social acima de 80 kWh" in x for x in sim["limitacoes"]))
        # CDE: orçamento (previsto), com a identidade como controle interno e a conferência
        # com os orçamentos da ANEEL como reconciliação externa
        fin = g["financiamento_cde"]
        self.assertEqual(fin["proveniencia"]["natureza"], "PREVISTO")
        self.assertIn("orçamento", fin["natureza_valores"])
        self.assertTrue(any(t["nome"].startswith("controle interno: despesa = receita") for t in fin["evidencia"]["testes"]))
        self.assertIn("orçamento da CDE divulgado pela ANEEL", fin["evidencia"]["reconciliacao"]["descricao"])
        self.assertEqual(fin["evidencia"]["reconciliacao"]["resultado"], "ressalva")
        # subsídios: a soma contra a linha Total do mesmo arquivo é controle interno, não reconciliação
        self.assertIsNone(g["subsidios"]["evidencia"])

    def test_validacao_fisica_critica_vira_stub_e_atipico_vira_ressalva(self):
        g = self._monta()
        self.assertEqual(g["validacao"]["ressalvas"], [])
        # CNPJ repetido no ranking é violação crítica
        g2 = json.loads(json.dumps(g))
        g2["tarifas"]["vigentes"].append(dict(g2["tarifas"]["vigentes"][0]))
        criticas, _, _ = conta.valida_gold(g2)
        self.assertTrue(any("CNPJ repetido" in x for x in criticas))
        # valor atípico não é descartado: vira ressalva visível
        g3 = json.loads(json.dumps(g))
        g3["tarifas"]["vigentes"][0]["total"] = 3500.0
        criticas, ressalvas, _ = conta.valida_gold(g3)
        self.assertEqual(criticas, [])
        self.assertTrue(any("atípica" in x for x in ressalvas))

    def test_sem_tarifas_no_silver_vira_stub(self):
        g = conta.construir(self.con, {"hoje": date(2026, 9, 30)})
        self.assertFalse(g["disponivel"])


class Incorporacoes(_Ambiente):
    """Mudança societária não é troca de sigla: amostras reais da CPFL (REA nº 6.723/2017)
    e da RGE (REA nº 7.499/2018)."""

    def _linhas(self):
        v = self.vintage(conta.DS_TARIFAS, "t-incorporacao.csv", "tarifas_incorporacao_amostra.csv", "csv")
        conta._processa_tarifas(self.con, v)
        segs = conta.segmentos_tarifas(conta.valores_vigentes(self.con, conta.DS_TARIFAS))
        return {k[0]: conta.linha_do_tempo(ss)[0] for k, ss in segs.items()
                if k[1:] == ("B1", "Residencial", "TA")}

    def test_incorporacoes_confirmadas_nos_dados(self):
        linhas = self._linhas()
        por_id = {i["id"]: i for i in conta.INCORPORACOES}
        for id_ in ("cpfl_santa_cruz_2018", "rge_2019"):
            conf = conta.confere_incorporacao(por_id[id_], linhas)
            self.assertTrue(conf["confirmada_nos_dados"], id_)
        # as quatro CPFL incorporadas terminam na véspera da tarifa unificada (releitura do CSV)
        fins = {r["NumCNPJDistribuidora"]: r["DatFimVigencia"] for r in csv.DictReader(
            io.StringIO(_ler("tarifas_incorporacao_amostra.csv").decode("utf-8")), delimiter=";")
            if r["NumCNPJDistribuidora"] in por_id["cpfl_santa_cruz_2018"]["incorporadas"]}
        self.assertEqual(set(fins.values()), {"2018-03-21"})
        # registro com data errada não se confirma (e vira ressalva na gold)
        errado = {**por_id["rge_2019"], "tarifa_unificada_desde": "2019-04-19"}
        conf = conta.confere_incorporacao(errado, linhas)
        self.assertEqual((conf["confirmada_nos_dados"], conf["situacao"]), (False, "divergente"))
        # nenhum dos CNPJs no conjunto: nada a conferir, sem ressalva
        self.assertEqual(conta.confere_incorporacao(por_id["epb_2023"], linhas)["situacao"], "sem_dados")

    def test_evento_que_atravessa_incorporacao_sai_marcado(self):
        linhas = self._linhas()
        evs = {e["data"]: e for e in conta.eventos_tarifa(linhas[CPFL_SANTA_CRUZ], {},
                                                             conta.mudancas_de_perimetro(CPFL_SANTA_CRUZ))}
        e = evs["2018-03-22"]
        # a variação publicada antes (+17,63%) comparava a tarifa da CPFL Jaguari com a da
        # área somada das cinco concessões; confere com a releitura, mas sai marcada
        rows = [r for r in csv.DictReader(io.StringIO(_ler("tarifas_incorporacao_amostra.csv").decode("utf-8")), delimiter=";")
                if r["NumCNPJDistribuidora"] == CPFL_SANTA_CRUZ]
        antes = next(r for r in rows if r["DatInicioVigencia"] == "2017-03-22")
        depois = next(r for r in rows if r["DatInicioVigencia"] == "2018-03-22")
        var = (_dec(depois["VlrTE"]) + _dec(depois["VlrTUSD"])) / (_dec(antes["VlrTE"]) + _dec(antes["VlrTUSD"])) - 1
        self.assertAlmostEqual(e["variacao"], float(var), places=9)
        self.assertEqual(round(100 * var, 2), D("17.63"))
        self.assertEqual(e["mudanca_perimetro"]["ato"], "REA nº 6.723/2017")
        self.assertIsNone(evs["2019-03-22"]["mudanca_perimetro"])
        # janelas: a de 120 meses terminada em ago/2026 atravessa a incorporação; a de 12 meses, não
        self.assertTrue(conta.atravessa_perimetro(CPFL_SANTA_CRUZ, "2016-08-31", "2026-08-31"))
        self.assertTrue(conta.atravessa_perimetro(RGE, "2016-08-31", "2026-08-31"))
        self.assertFalse(conta.atravessa_perimetro(CPFL_SANTA_CRUZ, "2025-08-31", "2026-08-31"))
        # a janela que começa no próprio dia da tarifa unificada já compara a mesma área
        self.assertFalse(conta.atravessa_perimetro(CPFL_SANTA_CRUZ, "2018-03-22", "2026-08-31"))

    def test_gold_marca_incorporadas_e_eventos(self):
        v = self.vintage(conta.DS_TARIFAS, "t-incorporacao.csv", "tarifas_incorporacao_amostra.csv", "csv")
        conta._processa_tarifas(self.con, v)
        v2 = self.vintage(conta.DS_TARIFAS, "t-cemig.csv", "tarifas_amostra.csv", "csv")
        conta._processa_tarifas(self.con, v2)
        g = conta.construir(self.con, {"hoje": date(2026, 9, 30)})
        sem = {x["cnpj"]: x for x in g["tarifas"]["sem_vigente"]}
        self.assertEqual(sem[RGE_ANTIGA]["incorporada_por"], RGE)
        self.assertIn("REA nº 7.499/2018", sem[RGE_ANTIGA]["motivo"])
        self.assertIn("incorporada", sem["52503802000118"]["motivo"])            # CPFL Mococa
        inc = {i["id"]: i for i in g["incorporacoes"]}
        self.assertTrue(inc["rge_2019"]["confirmada_nos_dados"])
        with open(os.path.join(base.SERIES, conta.JSON_HIST), encoding="utf-8") as f:
            hist = json.load(f)["distribuidoras"]
        ev = next(e for e in hist[CPFL_SANTA_CRUZ]["eventos"] if e[0] == "2018-03-22")
        self.assertEqual(ev[11], "REA nº 6.723/2017")
        with open(os.path.join(base.SERIES, conta.CSV_REAJ), encoding="utf-8") as f:
            linhas = [l for l in f.read().splitlines() if l.startswith(CPFL_SANTA_CRUZ) and ";2018-03-22;" in l]
        self.assertTrue(linhas and linhas[0].endswith("REA nº 6.723/2017"))


class ComposicaoCreditoUbp(_Ambiente):
    """Linhas reais de EAC, ERO e CEA (vigência em 30/09/2026): TE_CFURH negativo é crédito
    (repasse da UBP), não encargo; somado aos encargos deixava o grupo negativo."""

    ESPERADO_CFURH = {"EAC": D("-139.67140016"), "ERO": D("-256.662649608"), "CEA": D("-267.431324938")}

    def _comps(self):
        import pyarrow.parquet as pq
        v = self.vintage(conta.DS_COMP, "componentes-tarifarias-2025.parquet", "componentes_ubp_2026.parquet", "parquet")
        cont = {}
        linhas = list(fa.linhas_componentes(v["arquivo"], cont))
        self.assertEqual(cont["linhas_lidas"], 208)   # 205 do recorte e 3 de base econômica, fora
        por = {}
        for l in linhas:
            por.setdefault((l["sigla"], l["inicio"], l["ato"]), {})[l["componente"]] = l["valor"]
        # releitura independente do Parquet (pyarrow, sem o leitor do módulo)
        t = pq.read_table(os.path.join(DADOS, "componentes_ubp_2026.parquet")).to_pylist()
        cfurh = {(r["SigNomeAgente"], str(r["DatInicioVigencia"])[:10]): D(str(r["VlrComponenteTarifario"])) for r in t
                 if r["DscComponenteTarifario"] == "TE_CFURH" and r["DscBaseTarifaria"] == "Tarifa de Aplicação"
                 and r["DscSubClasseConsumidor"] == "Residencial"}
        return por, cfurh

    def test_credito_sai_dos_encargos(self):
        por, cfurh = self._comps()
        vig = {"EAC": ("EAC", "2026-08-26", "REH 3.318/2026"), "ERO": ("ERO", "2026-08-26", "REH 3.320/2026"),
               "CEA": ("CEA", "2026-04-13", "sem ato informado")}
        for sig, chave in vig.items():
            comps = por[chave]
            self.assertEqual(D(str(comps["TE_CFURH"])), self.ESPERADO_CFURH[sig])
            self.assertEqual(cfurh[(sig, chave[1])], self.ESPERADO_CFURH[sig])
            grupos, chk = conta.grupos_componentes(comps)
            # crédito no grupo próprio, com o valor publicado
            self.assertAlmostEqual(grupos["creditos"], float(self.ESPERADO_CFURH[sig]), places=9)
            self.assertEqual([r_["codigo"] for r_ in chk["reclassificadas"]], ["TE_CFURH"])
            # nada somado por fora: os grupos continuam fechando com a TE e a TUSD publicadas
            self.assertLess(abs(sum(grupos.values()) - (comps["TE"] + comps["TUSD"])), 0.02)
            # encargos positivos e a parcela CDE (subconjunto) não passa do grupo
            self.assertGreater(grupos["encargos"], 0, sig)
            self.assertLessEqual(conta.parcela_cde(comps), grupos["encargos"] + 0.01, sig)
            # pelo código apenas (leitura antiga), CEA e ERO tinham encargos negativos
            enc_pelo_codigo = sum(v for cd, v in comps.items() if conta.GRUPO_DE.get(cd) == "encargos" and v is not None)
            if sig in ("CEA", "ERO"):
                self.assertLess(enc_pelo_codigo, 0, sig)
            self.assertGreater(conta.parcela_cde(comps), enc_pelo_codigo, sig)

    def _gold(self):
        conta._processa_tarifas(self.con, self.vintage(conta.DS_TARIFAS, "t-ubp.csv", "tarifas_ubp_amostra.csv", "csv"))
        conta._processa_tarifas(self.con, self.vintage(conta.DS_TARIFAS, "t-amostra.csv", "tarifas_amostra.csv", "csv"))
        conta._processa_componentes(self.con, self.vintage(conta.DS_COMP, "componentes-tarifarias-2025.parquet",
                                                           "componentes_ubp_2026.parquet", "parquet"))
        return conta.construir(self.con, {"hoje": date(2026, 9, 30)})

    def test_gold_publica_credito_atipico_e_ressalva(self):
        g = self._gold()
        comp = g["composicao"]
        cred = {x["sigla"]: x for x in comp["creditos"]["distribuidoras"]}
        self.assertEqual(sorted(cred), ["CEA", "EAC", "ERO"])
        self.assertEqual(cred["CEA"]["valor"], -267.43)
        dist = {x["sigla"]: x for x in comp["distribuidoras"]}
        for sig in ("CEA", "ERO", "EAC"):
            self.assertGreater(dist[sig]["grupos"]["encargos"], 0)
            self.assertLessEqual(dist[sig]["cde"], dist[sig]["grupos"]["encargos"])
            self.assertEqual(dist[sig]["reclassificadas"][0]["grupo_usado"], "creditos")
        # atípicas: sinal contrário à natureza do grupo (encargos), acima de 5% da tarifa
        atip = {(a["sigla"], a["codigo"]) for a in comp["componentes_atipicas"]}
        self.assertTrue({("CEA", "TE_CFURH"), ("ERO", "TE_CFURH"), ("EAC", "TE_CFURH")} <= atip)
        ress = g["validacao"]["ressalvas"]
        self.assertTrue(any("crédito" in r and "CEA -267.43" in r for r in ress))
        self.assertTrue(any(r.startswith("ERO: componente TE_CFURH") for r in ress))
        self.assertFalse(any("grupo de custo com soma negativa" in r for r in ress))
        # CEMIG-D tem tarifa vigente sem componentes nesta amostra: reconciliação com cobertura
        # parcial não é aprovação
        self.assertEqual(comp["reconciliacao"]["sem_componentes"], ["CEMIG-D"])
        self.assertEqual(g["tarifas"]["evidencia_mediana"]["reconciliacao"]["resultado"], "ressalva")
        # composição média fecha com o total; as medianas não (e dizem isso)
        m = comp["media"]
        self.assertAlmostEqual(sum(m["grupos_rs_mwh"].values()), m["total_rs_mwh"], delta=0.05)
        self.assertAlmostEqual(sum(m["grupos_pct"].values()), 100.0, delta=0.05)
        self.assertFalse(comp["mediana"]["fecha_com_total"])
        # razão de somas conferida à mão: Σ creditos ÷ Σ tarifas das três
        tot = D("58.85") + D("703.59") + D("113.86") + D("715.85") + D("41.05") + D("784.10")
        creditos = sum(self.ESPERADO_CFURH.values())
        self.assertAlmostEqual(m["grupos_pct"]["creditos"], float(round(100 * creditos / tot, 2)), places=6)

    def test_sem_reclassificacao_a_validacao_pega_o_defeito(self):
        # a leitura antiga (TE_CFURH sempre nos encargos) precisa virar ressalva visível
        with mock.patch.dict(conta.RECLASSIFICA_SE_NEGATIVO, {}, clear=True):
            g = self._gold()
        ress = g["validacao"]["ressalvas"]
        self.assertTrue(any(r.startswith("CEA: grupo de custo com soma negativa (encargos -113.0") for r in ress), ress)
        self.assertTrue(any(r.startswith("ERO: grupo de custo com soma negativa") for r in ress))
        self.assertTrue(any(r.startswith("EAC: parcela CDE") for r in ress))


class SampAvaliado(_Ambiente):
    def test_samp_no_bronze_e_meses_atipicos_da_cemig(self):
        import pyarrow.parquet as pq
        v = self.vintage(conta.DS_SAMP, conta.RECURSO_SAMP, "samp_2025_amostra.parquet", "parquet")
        serie, n = fa.samp_residencial_mensal(v["arquivo"])
        self.assertEqual(n, 48)
        # releitura independente
        t = pq.read_table(os.path.join(DADOS, "samp_2025_amostra.parquet")).to_pylist()
        jul = sum(D(str(r["VlrMercado"])) for r in t if r["NumCNPJAgenteDistribuidora"] == 6981180000116
                  and r["DscDetalheMercado"] == "Receita Energia (R$)" and str(r["DatCompetencia"]).startswith("2025-07"))
        self.assertEqual(jul, D("7085601982.0"))
        self.assertAlmostEqual(serie[(CEMIG, "CEMIG-D", "Receita Energia (R$)")]["2025-07"], float(jul), places=2)
        conta._processa_tarifas(self.con, self.vintage(conta.DS_TARIFAS, "t.csv", "tarifas_amostra.csv", "csv"))
        g = conta.construir(self.con, {"hoje": date(2026, 9, 30)})
        alt = g["tarifa_media_fornecimento"]["alternativa_avaliada"]
        self.assertRegex(alt["sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(alt["recurso"], "samp-2025.parquet")
        meses = {(a["sigla"], a["linha"], a["mes"]) for a in alt["meses_atipicos"]}
        self.assertEqual(meses, {("CEMIG-D", "ICMS (R$)", "2025-06"), ("CEMIG-D", "Receita Energia (R$)", "2025-07"),
                                 ("CEMIG-D", "Receita Energia (R$)", "2025-10")})
        self.assertEqual((alt["distribuidoras_no_recorte"], alt["distribuidoras_com_mes_atipico"]), (2, 1))
        self.assertFalse(g["tarifa_media_fornecimento"]["disponivel"])


class RegrasENatureza(_Ambiente):
    def test_leitura_nao_conferida_nao_herda_o_estado_da_norma(self):
        todas = {n["id"]: "CONFERIDA" for n in conta.NORMAS}
        regras, estados = conta.estado_das_regras(conta.REGRAS_TEXTO, todas)
        self.assertEqual(estados["tarifa_social"], "CONFERIDA")
        # o trecho da página de geração distribuída está conferido, mas a regra do mínimo na
        # Tarifa Social acima de 80 kWh é leitura declarada: a regra fica parcial
        self.assertEqual(estados["custo_disponibilidade"], "PARCIAL")
        cd = next(r_ for r_ in regras if r_["id"] == "custo_disponibilidade")
        parte = next(p_ for p_ in cd["partes"] if "acima de 80 kWh" in p_["texto"])
        self.assertEqual(parte["estado"], "NAO_CONFERIDA")
        self.assertEqual(estados["desconto_social"], "PARCIAL")
        self.assertEqual(estados["bandeira"], "PARCIAL")
        # norma não capturada: nenhuma parte conferida
        _, est2 = conta.estado_das_regras(conta.REGRAS_TEXTO, {})
        self.assertEqual(set(est2.values()), {"NAO_CONFERIDA"})

    def test_orcamento_cde_contra_titulos_da_aneel(self):
        v = self.vintage(conta.DS_CDE, "cde-custeio-beneficios-tarifarios.csv", "cde_custeio_amostra.csv", "csv")
        conta._processa_cde(self.con, v)
        ag = conta.agrega_cde(conta.valores_vigentes(self.con, conta.DS_CDE))
        rec = {x["ano"]: x for x in conta.reconcilia_orcamento_cde(ag["totais"])}
        # 2026: R$ 52.660.050.882,84 no arquivo contra R$ 52,7 bilhões previstos (meia unidade: 0,05 bilhão)
        self.assertEqual(rec["2026"]["publicado_rs"], 52.7e9)
        self.assertAlmostEqual(rec["2026"]["diferenca_rs"], float(D("52660050882.84") - D("52700000000")), places=1)
        self.assertTrue(rec["2026"]["confere"])
        # 2023: R$ 34.985.700.578,16 contra R$ 34,99 bilhões (tolerância de 0,005 bilhão)
        self.assertEqual(rec["2023"]["tolerancia_rs"], 5e6)
        self.assertTrue(rec["2023"]["confere"])
        self.assertIsNone(rec["2025"]["confere"])      # 2025 não está na amostra: sem par, sem resultado
        self.assertEqual(conta.valor_do_titulo_bilhoes("orçamento de R$ 34,99 bilhões"), (34.99e9, 5e6))


class CatalogoDeMetricas(unittest.TestCase):
    def test_metricas_do_modulo_validas(self):
        from pipeline.energia.metricas import conta as mc
        for m in mc.METRICAS:
            self.assertEqual(metricas.validar(m), [], m["id"])
            self.assertEqual(m["gold"], "conta.json")


class LinhasCsvSubsidios(unittest.TestCase):
    """O CSV de subsídios traz a linha da categoria Total além das categorias: eh_total a identifica, e somar valor_rs sem o filtro
    dobra o valor (R$ 37,6 bilhões em vez de R$ 18,8 bilhões em 2025, achado da avaliação independente)."""

    csv_s = {
        (2025, "01229747000189", "Rural", "Total"): [100.005, 3],
        (2025, "01229747000189", "Irrigação e Aquicultura", "Total"): [50.0, 3],
        (2025, "01229747000189", "Total", "Total"): [150.005, 3],
    }

    def test_coluna_eh_total_marca_so_a_categoria_total(self):
        linhas = conta.linhas_csv_subsidios(self.csv_s, {"01229747000189": "CERGAPA"})
        self.assertEqual(len(conta.COLUNAS_CSV_SUBS), len(linhas[0]))
        self.assertEqual(conta.COLUNAS_CSV_SUBS[-1], "eh_total")
        marcadas = {l[3]: l[-1] for l in linhas}
        self.assertEqual(marcadas, {"Irrigação e Aquicultura": "nao", "Rural": "nao", "Total": "sim"})

    def test_soma_filtrando_eh_total_nao_dobra(self):
        linhas = conta.linhas_csv_subsidios(self.csv_s, {})
        sem_filtro = sum(l[5] for l in linhas)
        so_categorias = sum(l[5] for l in linhas if l[-1] == "nao")
        so_total = sum(l[5] for l in linhas if l[-1] == "sim")
        self.assertAlmostEqual(sem_filtro, 2 * so_total, places=2)
        self.assertAlmostEqual(so_categorias, so_total, places=2)

    def test_valor_em_reais_com_meio_para_cima(self):
        # 100,005 é guardado como 100,00499999999999545: o round() do Python dava 100,0
        linhas = conta.linhas_csv_subsidios(self.csv_s, {})
        rural = next(l for l in linhas if l[3] == "Rural")
        self.assertEqual(rural[5], 100.01)


if __name__ == "__main__":
    unittest.main()
