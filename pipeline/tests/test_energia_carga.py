"""Módulo Carga (P025, P026, P027 e achados A07 e A11): validação física com quarentena,
curva horária, carga verificada da API (carga global, MMGD e carga líquida), calendário
oficial, temperatura ponderada e decomposição estatística fora da amostra.

Sem rede. Amostras reais recortadas em pipeline/tests/dados/energia_carga/:
- carga_diaria_vintages_silver.csv: carga diária do ONS como gravada no silver principal
  nas capturas de 29/09/2026 02:42 UTC e 30/09/2026 02:19 UTC (o arquivo bruto de 29/09
  não está no bronze deste ambiente; o silver guarda o valor de cada captura);
- curva_carga_2026_20260920.csv, curva_carga_2015_sul_0101_0106.csv e
  curva_carga_2018_1104.csv: linhas do CURVA_CARGA_2026.csv, do CURVA_CARGA_2015.csv e do
  CURVA_CARGA_2018.csv capturados em 30/09/2026 (o de 2018 com a hora inexistente do
  início do horário de verão, 04/11/2018 00h: vazia no SE, NE e N e "0E-8" no Sul);
- balanco_2018_ne_0824_0826.csv e balanco_2015_sul_0105_0109.csv: linhas do
  BALANCO_ENERGIA_SUBSISTEMA_2018.csv (Nordeste, 24 a 26/08/2018) e do de 2015 (Sul, 05 a
  09/01/2015), capturados em 01/10/2026 00:36 UTC;
- carga_energia_2013_recorte.csv: linhas do CARGA_ENERGIA_2013.csv capturado em
  01/10/2026 00:37 UTC (01/12/2013 com as quatro células vazias; a linha extra do Sul em
  02/02/2013 00:00:01, vazia, ao lado da linha com valor);
- api_seco_20260920.json e api_seco_fev2019_trecho.json: respostas da API de carga
  verificada (texto bruto, com os campos vazios que a API emite);
  api_s_ne_n_20260920_campos.json: os 144 registros do S, NE e N de 20/09/2026 das
  respostas capturadas em 30/09/2026 23:36 UTC, só com os campos usados aqui;
- power_sp_recorte.json, sidra_6579_uf.json, ibge_centroide_3550308.json e
  senado_lei_14759_2023.json: respostas da NASA POWER, do IBGE e do Senado;
- modelo_sin_2023_2024.csv: carga diária do SIN aceita e temperatura ponderada do SIN.

Os valores esperados vêm de caminho independente do código testado: o arquivo da Carga
de Energia Diária publicado pelo ONS para a média da curva (é o mesmo produto em outro
grão, então a conferência prova a agregação, não o valor); os componentes do Balanço de
Energia nos Subsistemas (outro conjunto do ONS) para a conferência de valor atípico; a
carga líquida publicada pelo ONS na API (val_cargaglobalsmmgd, não a subtração feita
aqui) para o perfil e a série recente; o arquivo transicao_ons_mmgd_diario.csv do módulo
Transição (mesma API, outro código) para a carga verificada; a gold carga.json do commit
d95d8f8b4 para o +10,5% do achado A07; datas de Páscoa do calendário gregoriano
publicadas em qualquer tabela eclesiástica."""
import csv
import json
import math
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import calendario_carga as cal  # noqa: E402
from pipeline.energia.fontes import clima_carga as clima  # noqa: E402
from pipeline.energia.fontes import modelo_carga as modelo  # noqa: E402
from pipeline.energia.fontes import ons_carga as ons  # noqa: E402
from pipeline.energia.gold import carga as gcarga  # noqa: E402
from pipeline.energia.modulos import carga_detalhe as mod  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_carga")
GOLD = os.path.join(base.GOLD, "carga_detalhe.json")
SMS = ("SE", "S", "NE", "N")


def _ler(nome, modo="r"):
    with open(os.path.join(DADOS, nome), modo) as f:
        return f.read()


def _curva(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
        return ons.le_curva(csv.DictReader(f, delimiter=";"))


def _silver_vintages(sem_series=()):
    """Silver em memória com as duas capturas reais da carga diária (e a de 2025)."""
    con = base.conecta(":memory:")
    por_vintage = {}
    with open(os.path.join(DADOS, "carga_diaria_vintages_silver.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["serie"] in sem_series:
                continue
            por_vintage.setdefault((r["recurso"], r["capturado_em"], r["sha256"]), []).append((r["serie"], r["ref"], float(r["valor"])))
    for (rec, cap, sha), linhas in sorted(por_vintage.items(), key=lambda x: x[0][1]):
        vid, _ = base.registra_vintage(con, "carga_energia_di", rec, "u", cap, None, sha, 1, "coleta_direta", "x")
        base.grava_observacoes(con, "carga_energia_di", vid, linhas)
    return con


def _balanco(nome):
    """{dia: {componente: média diária}} de um recorte real do balanço de energia."""
    with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
        obs = list(ons.agrega_balanco(csv.DictReader(f, delimiter=";")))
    out = {}
    for serie, dia, v in obs:
        campo = serie.split(".")[0]
        if campo.endswith("_dia"):
            out.setdefault(dia, {})[campo[:-4]] = v
    return out


# Carga de Energia Diária publicada pelo ONS (silver principal, captura vigente).
NE_AGO_2018 = {"2018-08-17": 10569.76320833, "2018-08-18": 9907.567, "2018-08-19": 9171.732, "2018-08-20": 10141.09429167,
               "2018-08-21": 10281.005, "2018-08-22": 10275.04633333, "2018-08-23": 10348.78445833, "2018-08-24": 10451.19820833,
               "2018-08-25": 3969.773875, "2018-08-26": 9196.70604167}
S_JAN_2015 = {"2014-12-26": 9168.97190553, "2014-12-27": 8623.62131404, "2014-12-28": 8132.38096921, "2014-12-29": 9581.72277013,
              "2014-12-30": 9911.45894023, "2014-12-31": 8897.80226336, "2015-01-01": 7717.62003968, "2015-01-02": 8512.00149159,
              "2015-01-03": 8511.20885024, "2015-01-04": 8228.55667125, "2015-01-05": 10872.02928158, "2015-01-06": 12307.82897049,
              "2015-01-07": 12696.97940387, "2015-01-08": 12378.04140136}


class CurvaHoraria(unittest.TestCase):
    def test_media_das_24_horas_reproduz_a_carga_diaria_publicada(self):
        # Carga de Energia Diária (CARGA_ENERGIA_2026.csv, captura de 30/09/2026 02:19 UTC), 20/09/2026
        diaria = {"SE": 39166.81475, "S": 10576.379041666669, "NE": 12676.229041666673, "N": 9422.691875000002}
        obs = {(s, r): v for s, r, v in ons.agrega_curva(_curva("curva_carga_2026_20260920.csv"))}
        for sm, esperado in diaria.items():
            self.assertAlmostEqual(obs[(f"media_dia.{sm}", "2026-09-20")], esperado, delta=0.01, msg=sm)
        self.assertAlmostEqual(obs[("media_dia.SIN", "2026-09-20")], sum(diaria.values()), delta=0.04)

    def test_pico_do_sin_e_maximo_da_soma_horaria_nao_soma_dos_picos(self):
        h = _curva("curva_carga_2026_20260920.csv")
        obs = {(s, r): v for s, r, v in ons.agrega_curva(h)}
        soma_picos = sum(obs[(f"pico_dia.{sm}", "2026-09-20")] for sm in SMS)
        self.assertLess(obs[("pico_dia.SIN", "2026-09-20")], soma_picos)
        hora = int(obs[("hora_pico.SIN", "2026-09-20")])
        self.assertAlmostEqual(obs[("pico_dia.SIN", "2026-09-20")], sum(h[(sm, f"2026-09-20T{hora:02d}:00")] for sm in SMS), places=6)

    def test_hora_ausente_nao_vira_zero_nem_media(self):
        h = _curva("curva_carga_2026_20260920.csv")
        del h[("NE", "2026-09-20T13:00")]
        obs = {(s, r): v for s, r, v in ons.agrega_curva(h)}
        self.assertEqual(obs[("horas_dia.NE", "2026-09-20")], 23.0)
        self.assertNotIn(("media_dia.NE", "2026-09-20"), obs)
        self.assertNotIn(("media_dia.SIN", "2026-09-20"), obs)  # SIN só com os quatro completos
        self.assertIn(("media_dia.SE", "2026-09-20"), obs)

    def test_zero_na_hora_inexistente_do_horario_de_verao_e_ausencia(self):
        # CURVA_CARGA_2018.csv, 04/11/2018 (início do horário de verão): a hora das 00h não
        # existe; o ONS deixa a célula vazia no SE, NE e N e põe "0E-8" no Sul
        descartados = []
        with open(os.path.join(DADOS, "curva_carga_2018_1104.csv"), encoding="utf-8") as f:
            h = ons.le_curva(csv.DictReader(f, delimiter=";"), descartados)
        self.assertEqual(descartados, [("S", "2018-11-04T00:00", "0E-8")])
        self.assertNotIn(("S", "2018-11-04T00:00"), h)
        obs = {(s, r): v for s, r, v in ons.agrega_curva(h)}
        for sm in SMS:
            self.assertEqual(obs[(f"horas_dia.{sm}", "2018-11-04")], 23.0, sm)
            self.assertNotIn((f"media_dia.{sm}", "2018-11-04"), obs)
            self.assertNotIn((f"pico_dia.{sm}", "2018-11-04"), obs)
        self.assertNotIn(("media_dia.SIN", "2018-11-04"), obs)
        # CARGA_ENERGIA_2018.csv (capturado em 01/10/2026 00:37 UTC), Sul em 04/11/2018:
        # 8.314,64278275 MWmed = soma das 23 horas reais ÷ 23. Com o zero lido como carga, a
        # média de 24 horas daria 7.968,2 (4,2% abaixo)
        s23 = [v for (sm, hr), v in h.items() if sm == "S"]
        self.assertEqual(len(s23), 23)
        self.assertAlmostEqual(sum(s23) / 23, 8314.64278275, delta=0.01)
        self.assertGreater(abs(sum(s23) / 24 - 8314.64278275), 300)

    def test_horario_so_desde_2019_agregados_de_todos_os_anos(self):
        obs = list(ons.agrega_curva(_curva("curva_carga_2015_sul_0101_0106.csv")))
        self.assertFalse([o for o in obs if o[0].startswith("carga_ho.")])
        self.assertTrue([o for o in obs if o[0] == "media_dia.S"])


class CargaVerificadaApi(unittest.TestCase):
    def test_campo_vazio_da_api_e_ausencia(self):
        regs = ons.parse_api(_ler("api_seco_fev2019_trecho.json"))
        vazios = [x for x in regs if x["dat_referencia"] == "2019-02-14"]
        self.assertTrue(vazios)
        self.assertTrue(all(x["val_cargammgd"] is None for x in vazios))
        horas, _ = ons.agrega_api(regs)
        obs = {(s, r) for s, r, _ in ons.observacoes_api(horas)}
        self.assertIn(("global_ho.SE", "2019-02-14T18:00"), obs)
        self.assertNotIn(("mmgd_ho.SE", "2019-02-14T18:00"), obs)

    def test_horario_de_verao_mapeado_pelo_fuso(self):
        # até 16/02/2019 Brasília estava em UTC−2: com UTC−3 fixo o dia local ficaria errado
        regs = ons.parse_api(_ler("api_seco_fev2019_trecho.json"))
        horas, ctl = ons.agrega_api(regs)
        self.assertEqual(ctl["data_divergente"], 0)
        # a hora das 23h de 16/02/2019 aconteceu duas vezes (fim do horário de verão): 4 meias horas, hora descartada
        self.assertEqual(horas[("SE", "2019-02-16T23:00")]["n_global"], 4)
        obs = {(s, r) for s, r, _ in ons.observacoes_api(horas)}
        self.assertNotIn(("global_ho.SE", "2019-02-16T23:00"), obs)
        self.assertIn(("global_ho.SE", "2019-02-17T00:00"), obs)

    def test_identidade_e_reconciliacao_com_o_modulo_transicao(self):
        regs = ons.parse_api(_ler("api_seco_20260920.json"))
        horas, ctl = ons.agrega_api(regs)
        self.assertEqual(ctl["identidade_falha"], 0)
        self.assertEqual(ctl["identidade_conferida"], 48)
        g = sum(a["global_mwh"] for (sm, h), a in horas.items() if h.startswith("2026-09-20"))
        m = sum(a["mmgd_mwh"] for (sm, h), a in horas.items() if h.startswith("2026-09-20"))
        # transicao_ons_mmgd_diario.csv, 2026-09-20;SE: carga_global_mwh 972659.5; mmgd_mwh 113618.5
        self.assertAlmostEqual(g, 972659.5, delta=0.1)
        self.assertAlmostEqual(m, 113618.5, delta=0.1)
        obs = {(s, r): v for s, r, v in ons.observacoes_api(horas)}
        # meia hora 12:00-12:30 e 12:30-13:00 do SECO: a hora cheia é a média das duas
        meias = [x["val_cargaglobal"] for x in regs if x["din_referenciautc"] in ("2026-09-20T15:30:00.000Z", "2026-09-20T16:00:00.000Z")]
        self.assertAlmostEqual(obs[("global_ho.SE", "2026-09-20T12:00")], sum(meias) / 2, places=6)

    def test_dia_em_curso_na_captura_e_descartado(self):
        regs = ons.parse_api(_ler("api_seco_20260920.json"))
        horas, ctl = ons.agrega_api(regs, dia_limite="2026-09-20")
        self.assertEqual(horas, {})
        self.assertEqual(ctl["descartadas_dia_em_curso"], 48)


class ValidacaoFisica(unittest.TestCase):
    def test_valor_negativo_da_captura_de_29_09_fica_em_quarentena(self):
        con = _silver_vintages()
        serie = dict(base.como_estava_em(con, "carga_energia_di", "carga_mwmed.NE", "2026-09-29T12:00:00Z"))
        self.assertEqual(serie["2026-09-26"], -668.879)
        aceitos, ocorr = gcarga.valida_serie("NE", serie, curva={"2026-09-26": 14006.457})
        self.assertNotIn("2026-09-26", aceitos)
        self.assertEqual([(o["dia"], o["regras"], o["situacao"]) for o in ocorr], [("2026-09-26", ["F1"], "quarentena")])
        # fora do domínio não tem conferência que o torne válido: nem a curva nem o balanço
        # são consultados (balanco = None), e a curva só aparece no registro
        self.assertEqual(ocorr[0]["conferencia"], "fora do domínio do dicionário do ONS: quarentena sem conferência")
        self.assertIsNone(ocorr[0]["balanco"])
        self.assertEqual(ocorr[0]["curva_horaria_media"], 14006.457)

    def test_historico_registra_a_revisao_da_fonte(self):
        con = _silver_vintages()
        hist = gcarga.historico_violacoes(con)
        self.assertEqual(len(hist), 1)
        h = hist[0]
        self.assertEqual((h["sm"], h["dia"], h["valor"], h["situacao"]), ("NE", "2026-09-26", -668.879, "revisado_pela_fonte"))
        self.assertAlmostEqual(h["revisado_para"], 13984.69575, places=5)
        self.assertEqual(h["revisado_em"], "2026-09-30T02:19:48Z")

    def test_sin_do_dia_em_quarentena_fica_ausente(self):
        con = _silver_vintages()
        val = {sm: dict(base.como_estava_em(con, "carga_energia_di", f"carga_mwmed.{sm}", "2026-09-29T12:00:00Z")) for sm in SMS}
        aceitos = {sm: gcarga.valida_serie(sm, val[sm])[0] for sm in SMS}
        sin = mod._soma_sin(aceitos)
        self.assertNotIn("2026-09-26", sin)
        self.assertIn("2026-09-25", sin)
        self.assertAlmostEqual(sin["2026-09-25"], 84671.539, delta=0.01)

    def test_atipico_do_sul_em_06_01_2015_confirmado_pelo_balanco(self):
        # Sul, 06 a 08/01/2015: salto de mais de 40% sobre a semana do fim de ano (F3). O
        # balanço de energia (outro conjunto do ONS) não tem lacuna de geração nesses dias e
        # fecha: geração menos intercâmbio = 12.307,8 MWmed em 06/01, igual ao valor diário
        bal = _balanco("balanco_2015_sul_0105_0109.csv")
        aceitos, ocorr = gcarga.valida_serie("S", S_JAN_2015, balanco=bal)
        self.assertEqual([(o["dia"], o["regras"], o["situacao"]) for o in ocorr],
                         [("2015-01-06", ["F3"], "atipico_conferido"), ("2015-01-07", ["F3"], "atipico_conferido"),
                          ("2015-01-08", ["F3"], "atipico_conferido")])
        self.assertIn("2015-01-06", aceitos)
        det = ocorr[0]["balanco"]
        self.assertEqual(det["lacunas"], [])
        self.assertEqual(det["geracao_menos_intercambio"], 12307.8)
        self.assertEqual(det["dia"]["carga"], 12307.8)
        # sem balanço não há conferência independente: o mesmo valor fica em quarentena,
        # e a curva (o mesmo produto em outro grão) não muda isso
        obs = {(s, r): v for s, r, v in ons.agrega_curva(_curva("curva_carga_2015_sul_0101_0106.csv"))}
        curva = {r: v for (s, r), v in obs.items() if s == "media_dia.S"}
        aceitos2, ocorr2 = gcarga.valida_serie("S", S_JAN_2015, curva=curva)
        self.assertNotIn("2015-01-06", aceitos2)
        self.assertEqual(ocorr2[0]["situacao"], "quarentena")
        self.assertIn("sem balanço", ocorr2[0]["conferencia"])

    def test_nordeste_em_25_08_2018_e_lacuna_de_geracao_em_quarentena(self):
        # 3.969,8 MWmed contra cerca de 10.300 nos dias vizinhos (F2 e F3). No balanço, a
        # eólica do NE vai de 6.686,7 (24/08) a 219,7 (25/08) e volta a 6.305,7 (26/08): é
        # lacuna de dado de geração, não carga real
        bal = _balanco("balanco_2018_ne_0824_0826.csv")
        self.assertAlmostEqual(bal["2018-08-24"]["eolica"], 6686.7, delta=0.05)
        self.assertAlmostEqual(bal["2018-08-25"]["eolica"], 219.7, delta=0.05)
        self.assertAlmostEqual(bal["2018-08-26"]["eolica"], 6305.7, delta=0.05)
        # a carga do próprio balanço repete o valor errado: conferir só a carga não serve
        self.assertAlmostEqual(bal["2018-08-25"]["carga"], NE_AGO_2018["2018-08-25"], delta=0.05)
        # a curva horária também repete o valor (mesmo produto): passá-la não confirma nada
        aceitos, ocorr = gcarga.valida_serie("NE", NE_AGO_2018, curva={"2018-08-25": 3969.773875}, balanco=bal)
        self.assertNotIn("2018-08-25", aceitos)
        self.assertIn("2018-08-26", aceitos)
        # só F3 aqui: F2 exige 365 dias de histórico, que o recorte não tem (no histórico
        # inteiro o dia viola F2 e F3, ver a gold publicada)
        self.assertEqual([(o["dia"], o["regras"], o["situacao"]) for o in ocorr], [("2018-08-25", ["F3"], "quarentena")])
        self.assertIn("lacuna de dado de geração", ocorr[0]["conferencia"])
        self.assertEqual([x["componente"] for x in ocorr[0]["balanco"]["lacunas"]], ["eolica"])
        ok, texto, det = gcarga.confere_balanco("2018-08-25", NE_AGO_2018["2018-08-25"], bal)
        self.assertFalse(ok)
        self.assertEqual(det["lacunas"][0]["valor_dia"], 219.7)

    def test_zero_nao_e_carga(self):
        aceitos, ocorr = gcarga.valida_serie("N", {"2026-01-01": 0.0, "2026-01-02": 8000.0})
        self.assertEqual(list(aceitos), ["2026-01-02"])
        self.assertEqual(ocorr[0]["regras"], ["F1"])


class RegistrosEsperados(unittest.TestCase):
    """A1: dia ausente é registrado com o estado conferido no arquivo atual da fonte."""

    def _familia(self):
        con = base.conecta(":memory:")
        arq = os.path.join(DADOS, "carga_energia_2013_recorte.csv")
        vid, _ = base.registra_vintage(con, gcarga.DS_DIARIA_FONTE, "Carga_Energia-2013",
                                       ons.URL_S3_DIARIA + "CARGA_ENERGIA_2013.csv", "2026-10-01T00:37:52Z", None,
                                       "36d5891e85d29ed9dc15a8033fc87d7cdb5c409745d4d9c3128101535aab851f", 1, "ckan", arq)
        mod.importa_diaria_fonte(con, {"vintage_id": vid, "arquivo": arq})
        return con

    def test_celula_vazia_distinta_de_linha_extra(self):
        with open(os.path.join(DADOS, "carga_energia_2013_recorte.csv"), encoding="utf-8") as f:
            valores, vazias = ons.le_diaria_fonte(csv.DictReader(f, delimiter=";"))
        self.assertEqual(sorted(vazias), sorted((sm, "2013-12-01") for sm in SMS))
        # 02/02/2013: linha das 00:00:00 com valor e linha extra das 00:00:01 vazia no Sul
        self.assertNotIn(("S", "2013-02-02"), vazias)
        self.assertEqual(valores[("S", "2013-02-02")], 10941.04154167)

    def test_estado_de_cada_ausencia(self):
        con = self._familia()
        est = gcarga.estados_ausencia(con, [("SE", "2013-12-01"), ("S", "2013-02-02"), ("N", "2014-02-01")])
        self.assertEqual(est[("SE", "2013-12-01")], ("celula_vazia_na_fonte", None))
        self.assertEqual(est[("S", "2013-02-02")], ("presente_no_arquivo_atual", 10941.04154167))
        self.assertEqual(est[("N", "2014-02-01")], ("nao_conferido", None))  # ano sem arquivo capturado aqui

    def test_validacao_conta_esperados_e_registra_ausentes(self):
        fam = self._familia()
        prin = base.conecta(":memory:")
        vid, _ = base.registra_vintage(prin, "carga_energia_di", "CARGA_ENERGIA_2013", "u", "2026-09-29T02:42:48Z", None, "a" * 64, 1,
                                       "coleta_direta", "x")
        with open(os.path.join(DADOS, "carga_energia_2013_recorte.csv"), encoding="utf-8") as f:
            valores, _ = ons.le_diaria_fonte(csv.DictReader(f, delimiter=";"))
        base.grava_observacoes(prin, "carga_energia_di", vid,
                               [(f"carga_mwmed.{sm}", d, v) for (sm, d), v in valores.items() if d >= "2013-11-30"])
        val = gcarga.validacao_fisica(prin, fam)
        reg = val["registro"]
        self.assertEqual(reg["registros_esperados"]["SE"]["esperados"], 3)  # 30/11 a 02/12/2013
        self.assertEqual(reg["registros_esperados"]["SE"]["ausentes"], 1)
        self.assertEqual([(a["sm"], a["dia"], a["estado"]) for a in reg["ausentes"]],
                         [(sm, "2013-12-01", "celula_vazia_na_fonte") for sm in SMS])
        self.assertNotIn("2013-12-01", val["aceitos"]["SE"])


class AchadoA07(unittest.TestCase):
    def test_reproduz_o_mais_10_5_com_a_captura_da_epoca(self):
        con = _silver_vintages()
        s = {sm: dict(base.como_estava_em(con, "carga_energia_di", f"carga_mwmed.{sm}", mod.A07["gerado_em"])) for sm in SMS}
        sin = mod._soma_sin(s)
        c = mod.comparacao(sin, mod._dias("2026-09-22", "2026-09-28"), mod._dias("2025-09-22", "2025-09-28"), "mesmas_datas")
        self.assertAlmostEqual(c["variacao_pct"], 10.54, places=2)
        self.assertEqual(round(c["variacao_pct"], 1), mod.A07["variacao_publicada_pct"])
        self.assertTrue(c["mesmo_regime"])
        self.assertTrue(c["calendario_equivalente"])
        self.assertEqual(c["eventos"] + c["eventos_ant"], [])

    def test_captura_de_29_09_nao_tinha_a_janela(self):
        con = _silver_vintages()
        s = {sm: dict(base.como_estava_em(con, "carga_energia_di", f"carga_mwmed.{sm}", "2026-09-29T12:00:00Z")) for sm in SMS}
        sin = mod._soma_sin(s)
        self.assertIsNone(mod.comparacao(sin, mod._dias("2026-09-22", "2026-09-28"), mod._dias("2025-09-22", "2025-09-28"), "mesmas_datas"))

    def test_mesmos_dias_da_semana_364_dias_antes(self):
        con = _silver_vintages()
        s = {sm: dict(base.serie_vigente(con, "carga_energia_di", f"carga_mwmed.{sm}")) for sm in SMS}
        sin = mod._soma_sin(s)
        a = mod._dias("2026-09-22", "2026-09-28")
        e = mod.comparacao(sin, a, mod._desloca(a, 364), "equivalente")
        self.assertEqual((e["inicio_ant"], e["fim_ant"]), ("2025-09-23", "2025-09-29"))
        self.assertAlmostEqual(e["variacao_pct"], 11.45, places=2)

    def test_comparacao_atravessando_regime_nao_tem_variacao(self):
        serie = {d: 70000.0 for d in mod._dias("2023-04-17", "2023-05-10")}
        c = mod.comparacao(serie, mod._dias("2023-04-25", "2023-05-02"), mod._dias("2023-04-17", "2023-04-24"), "x")
        self.assertFalse(c["mesmo_regime"])
        self.assertIsNone(c["variacao_pct"])

    def test_dias_de_transicao_bloqueiam_variacao(self):
        serie = {d: 70000.0 for d in mod._dias("2023-05-01", "2024-06-01")}
        serie.update({"2023-04-29": 68000.0, "2023-04-30": 62000.0})
        mod._TRANSICAO.clear()
        mod._TRANSICAO.update({"2023-04-29", "2023-04-30"})
        try:
            c = mod.comparacao(serie, mod._dias("2024-04-28", "2024-05-04"), mod._desloca(mod._dias("2024-04-28", "2024-05-04"), 364), "equivalente")
            self.assertIsNone(c["variacao_pct"])
        finally:
            mod._TRANSICAO.clear()


class Calendario(unittest.TestCase):
    def test_pascoa_e_datas_moveis(self):
        self.assertEqual(cal.pascoa(2024), date(2024, 3, 31))
        self.assertEqual(cal.pascoa(2025), date(2025, 4, 20))
        self.assertEqual(cal.pascoa(2026), date(2026, 4, 5))
        ev26 = {d: (n, c) for d, n, c, _ in cal.eventos_do_ano(2026)}
        self.assertEqual(ev26[date(2026, 2, 16)][1], "ponto_facultativo")
        self.assertEqual(ev26[date(2026, 4, 3)], ("Sexta-feira da Paixão", "paixao"))
        self.assertEqual(ev26[date(2026, 6, 4)][0], "Corpus Christi")

    def test_consciencia_negra_so_desde_2024(self):
        self.assertIsNone(cal.evento("2023-11-20"))
        self.assertEqual(cal.evento("2024-11-20")[2], "lei_14759_2023")

    def test_classes_e_composicao(self):
        self.assertEqual(cal.classifica("2026-09-07"), "domingo_feriado")  # Independência numa segunda
        self.assertEqual(cal.classifica("2026-02-17"), "domingo_feriado")  # terça de Carnaval
        self.assertEqual(cal.classifica("2026-02-18"), "util")             # Cinzas: meio expediente
        self.assertEqual(cal.classifica("2026-09-26"), "sabado")
        self.assertIsNone(cal.classifica("2002-05-01"))                    # antes da Lei nº 10.607/2002
        comp = cal.composicao(mod._dias("2026-09-01", "2026-09-28"))
        self.assertEqual(comp["classes"]["util"], 19)
        self.assertEqual(cal.feriados_em_dia_util(mod._dias("2025-09-01", "2025-09-28")), [])  # 7/9/2025 foi domingo

    def test_senado_confere_a_lei(self):
        dado = json.loads(_ler("senado_lei_14759_2023.json"))
        lei = next(x for x in cal.LEIS if x["id"] == "lei_14759_2023")
        ok, ementa, ident = cal.confere_senado(lei, dado)
        self.assertTrue(ok)
        self.assertIn("Consciência Negra", ementa)
        self.assertFalse(cal.confere_senado({**lei, "norma": "LEI-662-1949-04-06"}, dado)[0])


class Temperatura(unittest.TestCase):
    def test_power_ausente_e_menos_999(self):
        serie, fontes = clima.parse_power(_ler("power_sp_recorte.json"))
        self.assertNotIn("2026-09-28", serie)
        self.assertEqual(serie["2026-09-27"][0], 20.79)
        self.assertIn("GEOSIT", fontes)

    def test_centroide_do_ibge(self):
        lat, lon = clima.parse_centroide(_ler("ibge_centroide_3550308.json"))
        self.assertAlmostEqual(lat, -23.6501, places=4)
        self.assertAlmostEqual(lon, -46.6481, places=4)

    def test_pesos_populacionais(self):
        pop, ano = clima.parse_populacao(_ler("sidra_6579_uf.json"))
        self.assertEqual(len(pop), 27)
        self.assertEqual(ano, "2026")
        w = clima.pesos(pop)
        for sm in ("SE", "S", "NE", "N", "SIN"):
            self.assertAlmostEqual(sum(w[sm].values()), 1.0, places=12)
        self.assertEqual(max(w["SE"], key=w["SE"].get), "SP")
        sem_rs = clima.pesos({k: v for k, v in pop.items() if k != "RS"})
        self.assertNotIn("RS", sem_rs["S"])
        self.assertAlmostEqual(sum(sem_rs["S"].values()), 1.0, places=12)

    def test_dia_sem_cobertura_minima_fica_sem_valor(self):
        pesos = {"RS": 0.357, "PR": 0.379, "SC": 0.264}
        por_uf = {"RS": {"2026-09-20": 15.0}, "PR": {"2026-09-20": 17.0, "2026-09-21": 18.0}, "SC": {"2026-09-20": 16.0, "2026-09-21": 17.0}}
        t = clima.temperatura_ponderada(por_uf, pesos)
        self.assertAlmostEqual(t["2026-09-20"], 0.357 * 15 + 0.379 * 17 + 0.264 * 16, places=9)
        self.assertNotIn("2026-09-21", t)  # sem RS: 64,3% do peso


class Modelo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.carga, cls.tm, cls.tx = {}, {}, {}
        with open(os.path.join(DADOS, "modelo_sin_2023_2024.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                cls.carga[r["data"]] = float(r["carga_sin_mwmed"])
                if r["temperatura_media_c"]:
                    cls.tm[r["data"]] = float(r["temperatura_media_c"])
                    cls.tx[r["data"]] = float(r["temperatura_maxima_c"])

    def test_resolve(self):
        x = modelo.resolve([[4.0, 1.0, 0.0], [1.0, 3.0, 1.0], [0.0, 1.0, 2.0]], [1.0, 2.0, 3.0])
        for a, b in zip(x, [2 / 9, 1 / 9, 13 / 9]):
            self.assertAlmostEqual(a, b, places=12)
        with self.assertRaises(ValueError):
            modelo.resolve([[1.0, 2.0], [2.0, 4.0]], [1.0, 2.0])

    def test_sem_olhar_o_futuro(self):
        r1 = modelo.avaliar(self.carga, self.tm, self.tx, "principal", inicio_regime="2023-05-01")
        futuro = {d: (v * 3 if d >= "2024-06-01" else v) for d, v in self.carga.items()}
        r2 = modelo.avaliar(futuro, self.tm, self.tx, "principal", inicio_regime="2023-05-01")
        mai1 = [x for x in r1["previsoes"] if x["d"] < "2024-06-01"]
        mai2 = [x for x in r2["previsoes"] if x["d"] < "2024-06-01"]
        self.assertTrue(mai1)
        for a, b in zip(mai1, mai2):
            self.assertAlmostEqual(a["previsto"], b["previsto"], places=9)
            self.assertAlmostEqual(a["p90"], b["p90"], places=9)
        self.assertTrue(all(x["origem"] <= x["d"] for x in r1["previsoes"]))

    def test_metricas_fora_da_amostra_e_contribuicoes_somam(self):
        r = modelo.avaliar(self.carga, self.tm, self.tx, "principal", inicio_regime="2023-05-01")
        m = r["metricas"]
        self.assertEqual(m["origens"], 3)  # maio, junho e julho de 2024
        self.assertLess(m["mape_pct"], 10.0)
        self.assertTrue(0 <= m["cobertura_80_pct"] <= m["cobertura_95_pct"] <= 100)
        self.assertEqual(r["nos_temperatura"][0] < r["nos_temperatura"][1], True)
        # a previsão é a média do treino mais a soma das contribuições por grupo
        u = r["ultimo_ajuste"]
        media_prev = sum(u["beta"][j] * u["media_x"][j] for j in u["ativas"])
        for x in r["previsoes"][-5:]:
            self.assertAlmostEqual(math.log(x["previsto"]), media_prev + sum(x["contrib_log"].values()), places=9)

    def test_diferenca_decomposta_fecha_com_o_real(self):
        r = modelo.avaliar(self.carga, self.tm, self.tx, "principal", inicio_regime="2023-05-01")
        a, b = mod._dias("2024-07-01", "2024-07-07"), mod._dias("2023-07-03", "2023-07-09")
        x = modelo.contribuicoes_diferenca(r, a, b)
        self.assertAlmostEqual(x["previsto_log100"] + x["residuo_log100"], x["real_log100"], places=9)
        self.assertAlmostEqual(sum(x["contribuicoes_log100"].values()), x["previsto_log100"], places=9)
        self.assertIsNone(modelo.contribuicoes_diferenca(r, ["2030-01-01"], b))  # dia sem dado não vira zero

    def test_sem_temperatura_nao_usa_temperatura(self):
        r = modelo.avaliar(self.carga, {}, {}, "sem_temperatura", inicio_regime="2023-05-01")
        self.assertFalse([v for v in r["variaveis"] if v["grupo"] == "temperatura"])
        self.assertIsNone(modelo.avaliar(self.carga, {}, {}, "principal", inicio_regime="2023-05-01"))


def _dados_20260920():
    """Curva (quatro subsistemas) e API (quatro submercados) reais de 20/09/2026, no
    formato que a gold usa, montados pelos parsers a partir das amostras brutas."""
    curva = _curva("curva_carga_2026_20260920.csv")
    curva_h = {sm: {h: v for (s, h), v in curva.items() if s == sm} for sm in SMS}
    curva_h["SIN"] = mod._soma_sin(curva_h)
    curva_d = {sm: {k: {} for k in ("media_dia", "pico_dia", "hora_pico", "horas_dia")} for sm in mod.TODOS}
    for serie, ref, v in ons.agrega_curva(curva):
        campo, sm = serie.split(".")
        if campo in curva_d.get(sm, {}):
            curva_d[sm][campo][ref] = v
    regs = ons.parse_api(_ler("api_seco_20260920.json")) + json.loads(_ler("api_s_ne_n_20260920_campos.json"))
    horas, _ = ons.agrega_api(regs)
    api = {"global_ho": {sm: {} for sm in SMS}, "mmgd_ho": {sm: {} for sm in SMS}}
    for serie, h, v in ons.observacoes_api(horas):
        campo, sm = serie.split(".")
        api[campo][sm][h] = v
    g, m = api["global_ho"], api["mmgd_ho"]
    g["SIN"], m["SIN"] = mod._soma_sin(g), mod._soma_sin(m)
    return {"curva_h": curva_h, "curva_d": curva_d, "api_g": g, "api_m": m}, curva, regs


def _api_bruta_por_hora(regs, campo, areas):
    """Média por hora local (início) do campo publicado pela API, somando as áreas; feita
    aqui sem os parsers: fim da meia hora em UTC − 30 min − 3 h (sem horário de verão em 2026)."""
    from datetime import datetime, timedelta
    por = {}
    for x in regs:
        if x["cod_areacarga"] not in areas or x[campo] is None:
            continue
        ini = datetime.fromisoformat(x["din_referenciautc"][:19]) - timedelta(minutes=210)
        por.setdefault(ini.strftime("%Y-%m-%dT%H:00"), []).append(float(x[campo]))
    return {h: sum(v) / 2 for h, v in por.items() if len(v) == 2 * len(areas)}


class MmgdNaoSeMisturaComACurva(unittest.TestCase):
    """O perfil típico e a série recente publicam a curva como o ONS a publica (sem somar
    nem subtrair a MMGD da API) e a carga líquida como a API a publica."""

    @classmethod
    def setUpClass(cls):
        cls.dados, cls.curva, cls.regs = _dados_20260920()
        cls.liq = _api_bruta_por_hora(cls.regs, "val_cargaglobalsmmgd", ("SECO", "S", "NE", "N"))
        cls.glob = _api_bruta_por_hora(cls.regs, "val_cargaglobal", ("SECO", "S", "NE", "N"))
        cls.mmgd = _api_bruta_por_hora(cls.regs, "val_cargammgd", ("SECO", "S", "NE", "N"))
        cls.liq_se = _api_bruta_por_hora(cls.regs, "val_cargaglobalsmmgd", ("SECO",))

    def test_perfil_tipico(self):
        perf = {(p["sm"], p["classe"]): p for p in mod.perfis(self.dados, ["2026-09"], ("SE", "SIN"))}
        p_se, p_sin = perf[("SE", "domingo_feriado")], perf[("SIN", "domingo_feriado")]  # 20/09/2026, domingo
        self.assertEqual((p_se["dias_curva"], p_se["dias_api"]), (1, 1))
        for h in range(24):
            k = f"2026-09-20T{h:02d}:00"
            self.assertEqual(p_se["carga"][h], round(self.curva[("SE", k)]), h)
            self.assertEqual(p_sin["carga"][h], round(sum(self.curva[(sm, k)] for sm in SMS)), h)
            self.assertAlmostEqual(p_sin["liquida"][h], self.liq[k], delta=1.0)
            self.assertAlmostEqual(p_se["liquida"][h], self.liq_se[k], delta=1.0)
        # ao meio-dia a MMGD é grande: curva menos MMGD (a mistura proibida) fica longe do publicado
        self.assertGreater(self.mmgd["2026-09-20T12:00"], 10000)
        self.assertGreater(abs(p_sin["carga"][12] - (sum(self.curva[(sm, "2026-09-20T12:00")] for sm in SMS) - self.mmgd["2026-09-20T12:00"])), 10000)

    def test_serie_recente(self):
        p026 = mod.bloco_p026(self.dados, "2026-09-20")
        self.assertEqual(p026["ultimo_dia"], "2026-09-20")
        linhas = [x for x in p026["recente"] if x["h"].startswith("2026-09-20")]
        self.assertEqual(len(linhas), 24)
        for x in linhas:
            for sm in SMS:
                self.assertEqual(x[sm], round(self.curva[(sm, x["h"])]), (sm, x["h"]))
            self.assertEqual(x["SIN"], round(sum(self.curva[(sm, x["h"])] for sm in SMS)))
            self.assertAlmostEqual(x["global"], self.glob[x["h"]], delta=1.0)
            self.assertAlmostEqual(x["mmgd"], self.mmgd[x["h"]], delta=1.0)
            self.assertAlmostEqual(x["liquida"], self.liq[x["h"]], delta=1.0)


class ResumosPublicados(unittest.TestCase):
    def test_mediana_das_revisoes_com_numero_par(self):
        # sem o Norte, a amostra real tem 22 revisões com percentual (número par)
        con = _silver_vintages(sem_series=("carga_mwmed.N",))
        dados = {"curva_d": {sm: {"media_dia": {}} for sm in SMS}, "val": {"brutas": {sm: {} for sm in SMS}}}
        r = mod.bloco_revisoes(con, dados)
        # caminho independente: pares de valores das duas capturas de 2026 lidos do CSV
        pares = {}
        with open(os.path.join(DADOS, "carga_diaria_vintages_silver.csv"), encoding="utf-8") as f:
            for x in csv.DictReader(f, delimiter=";"):
                if x["recurso"] == "CARGA_ENERGIA_2026" and x["serie"] != "carga_mwmed.N":
                    pares.setdefault((x["serie"], x["ref"]), {})[x["capturado_em"]] = float(x["valor"])
        d = sorted(abs(100 * (p["2026-09-30T02:19:48Z"] / p["2026-09-29T02:42:48Z"] - 1))
                   for p in pares.values() if len(p) == 2 and p["2026-09-29T02:42:48Z"] > 0)
        self.assertEqual(len(d), 22)
        self.assertEqual(r["revisoes_com_percentual"], 22)
        self.assertAlmostEqual(r["mediana_abs_pct"], (d[10] + d[11]) / 2, places=4)
        self.assertNotAlmostEqual(r["mediana_abs_pct"], round(d[11], 4), places=4)  # não é o elemento de cima

    def test_acumulado_do_ano_com_calendario_diferente(self):
        # 01/01 a 28/09/2026 contra 02/01 a 29/09/2025 (364 dias antes): mesmos dias da semana,
        # mas 01/01, 21/04 e 07/09/2026 caem em dia útil e 07/09/2025 caiu num domingo
        serie = {d: 70000.0 for d in mod._dias("2025-01-01", "2026-09-28")}
        diaria = {sm: serie for sm in mod.TODOS}
        _, acum = mod.bloco_anual(diaria, "2026-09-28")
        self.assertEqual((acum["inicio_ant"], acum["fim_ant"]), ("2025-01-02", "2025-09-29"))
        self.assertEqual((acum["classes"]["util"], acum["classes"]["sabado"], acum["classes"]["domingo_feriado"]), (186, 39, 46))
        self.assertEqual((acum["classes_ant"]["util"], acum["classes_ant"]["sabado"], acum["classes_ant"]["domingo_feriado"]), (188, 39, 44))
        self.assertFalse(acum["calendario_equivalente"])
        for d in ("2026-01-01", "2026-04-21", "2026-09-07"):
            self.assertIn(d, acum["feriados_dia_util"])
        self.assertNotIn("2025-09-07", acum["feriados_dia_util_ant"])

    def test_regime_de_transicao_no_csv(self):
        mod._TRANSICAO.clear()
        mod._TRANSICAO.update({"2023-04-29", "2023-04-30"})
        try:
            self.assertEqual([mod._regime_csv(d) for d in ("2023-04-28", "2023-04-29", "2023-04-30", "2023-05-01")],
                             [2, "transicao", "transicao", 3])
        finally:
            mod._TRANSICAO.clear()

    def test_open_meteo_nao_declarado_como_utilizado(self):
        # nenhum número publicado lê o Open-Meteo (cobertura parcial): não pode constar como utilizado
        d = next(x for x in mod.REGISTRO["datasets"] if x["dataset_silver"] == mod.DS_OPENMETEO)
        self.assertFalse(d["estado"].startswith("UTILIZADO"))
        import inspect
        self.assertNotIn("DS_OPENMETEO", inspect.getsource(mod.construir))


class GoldPublicada(unittest.TestCase):
    """Contrato da gold publicada (lida do disco, como a interface lê)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(GOLD):
            raise unittest.SkipTest("gold carga_detalhe.json ainda não gerada")
        with open(GOLD, encoding="utf-8") as f:
            cls.g = json.load(f)

    def test_disponivel_e_tamanho(self):
        self.assertTrue(self.g["disponivel"])
        self.assertLess(os.path.getsize(GOLD), 450 * 1024)

    def test_a07_reproduzido(self):
        self.assertTrue(self.g["a07"]["reproducao"]["confere_publicado"])
        self.assertTrue(any("atividade econômica" in t for t in self.g["a07"]["textos"]))

    def test_nenhuma_variacao_entre_regimes(self):
        for s in self.g["p025"]["comparacoes"]["subsistemas"]:
            for j in s["janelas"].values():
                for x in j.values():
                    if x and not x["mesmo_regime"]:
                        self.assertIsNone(x["variacao_pct"])

    def test_validacao_publicada(self):
        v = self.g["p025"]["validacao"]
        self.assertEqual([(q["sm"], q["dia"], q["regras"]) for q in v["quarentena"]], [("NE", "2018-08-25", ["F2", "F3"])])
        self.assertEqual([(q["sm"], q["dia"]) for q in v["atipicos_conferidos"]],
                         [("S", "2015-01-06"), ("S", "2015-01-07"), ("S", "2015-01-08")])
        self.assertTrue(all("balanço" in q["conferencia"] for q in v["atipicos_conferidos"]))
        self.assertEqual(sorted({a["dia"] for a in v["ausentes"]}), ["2013-12-01", "2014-02-01", "2015-04-09"])
        self.assertEqual(v["registros_esperados"]["NE"]["quarentena"], 1)
        anual = {x["ano"]: x for x in self.g["p025"]["anual"]}
        # com o NE de 25/08/2018 em quarentena, 2018 não é ano completo: sem variação em 2018 e 2019
        self.assertFalse(anual[2018]["completo"])
        self.assertIsNone(anual[2018]["variacao_pct"])
        self.assertIsNone(anual[2019]["variacao_pct"])

    def test_carga_json_e_csv_diario_com_ausencia_visivel(self):
        with open(os.path.join(base.GOLD, "carga.json"), encoding="utf-8") as f:
            cj = json.load(f)
        self.assertEqual([(q["sm"], q["dia"]) for q in cj["validacao"]["quarentena"]], [("NE", "2018-08-25")])
        linhas = {}
        with open(os.path.join(base.SERIES, "carga_diaria.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if r["data"] in ("2013-12-01", "2014-02-01", "2015-04-09", "2018-08-25"):
                    linhas[r["data"]] = r
        for d in ("2013-12-01", "2014-02-01", "2015-04-09"):
            self.assertEqual([linhas[d][k] for k in ("SE", "S", "NE", "N", "SIN_calculado")], [""] * 5, d)
        self.assertEqual((linhas["2018-08-25"]["NE"], linhas["2018-08-25"]["SIN_calculado"]), ("", ""))
        self.assertNotEqual(linhas["2018-08-25"]["SE"], "")

    def test_acumulado_do_ano_publica_o_calendario(self):
        a = self.g["p025"]["acumulado_ano"]
        for campo in ("classes", "classes_ant", "calendario_equivalente", "eventos", "eventos_ant"):
            self.assertIn(campo, a)
        if a["inicio"] == "2026-01-01" and a["fim"] == "2026-09-28":
            self.assertEqual((a["classes"]["util"], a["classes_ant"]["util"]), (186, 188))
            self.assertFalse(a["calendario_equivalente"])

    def test_regime_de_transicao_nos_csvs(self):
        regimes = {}
        with open(os.path.join(base.SERIES, "carga_pico_diario.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if r["submercado"] == "SE" and "2023-04-28" <= r["data"] <= "2023-05-01":
                    regimes[r["data"]] = r["regime"]
                if r["submercado"] == "S" and r["data"] == "2018-11-04":
                    dst = r
        self.assertEqual(regimes, {"2023-04-28": "2", "2023-04-29": "transicao", "2023-04-30": "transicao", "2023-05-01": "3"})
        # dia de início do horário de verão: linha presente, sem média nem pico, 23 horas
        self.assertEqual((dst["media_mwmed"], dst["pico_mwmed"], dst["horas"]), ("", "", "23"))

    def test_a07_textos_nao_confundem_as_janelas(self):
        a = self.g["a07"]
        rep = a["reproducao"]
        dec = next(t for t in a["textos"] if t.startswith("Na decomposição estatística"))
        br = lambda d: f"{d[8:10]}/{d[5:7]}/{d[:4]}"  # noqa: E731
        lidos = [x for x in a["decomposicao"] if x["sm"] == "SIN" and x["variante"] == "principal"
                 and f"de {br(x['inicio'])} a {br(x['fim'])} contra {br(x['inicio_ant'])} a {br(x['fim_ant'])}" in dec]
        self.assertEqual(len(lidos), 1)
        x = lidos[0]
        if (x["inicio"], x["fim"], x["inicio_ant"], x["fim_ant"]) != (rep["inicio"], rep["fim"], rep["inicio_ant"], rep["fim_ant"]):
            # a variação da comparação decomposta aparece e o texto diz que não é a do achado
            self.assertIn(f"{x['variacao_real_pct']:+.2f}%".replace(".", ","), dec)
            self.assertIn("não é a de", dec)
        res = next(t for t in a["textos"] if t.startswith("Fora da amostra"))
        self.assertNotIn("mesmos dias de 2025", res)  # janelas com datas e contagens próprias
        self.assertIn("dias previstos", res)

    def test_textos_sem_a_data_declarada_como_inicio(self):
        txt = json.dumps(self.g, ensure_ascii=False)
        self.assertNotIn("desde 29/04/2023", txt)
        self.assertEqual(self.g["p027"]["especificacao"]["inicio_treino"], self.g["a11_carga"]["observado_carga"])

    def test_revisoes_mediana_e_leis_e_natureza(self):
        r = self.g["p025"]["revisoes"]
        d = sorted(abs(x["diferenca_pct"]) for x in r["linhas"] if x["diferenca_pct"] is not None)
        self.assertEqual(r["revisoes_com_percentual"], len(d))
        if len(d) % 2 == 0:  # mediana de n par = média dos dois centrais (arredondamento das linhas: 0,001)
            self.assertAlmostEqual(r["mediana_abs_pct"], (d[len(d) // 2 - 1] + d[len(d) // 2]) / 2, delta=0.001)
        leis = {x["id"]: x for x in self.g["calendario"]["leis"]}
        self.assertFalse(leis["lei_9093_1995"]["conferida_texto"])
        self.assertTrue(leis["lei_9093_1995"]["conferida_ementa"])
        self.assertTrue(all("conferida" not in x for x in leis.values()))
        nat = {x["serie"]: x["natureza"] for x in self.g["proveniencia"]["api"]["natureza_por_serie"]}
        self.assertEqual(nat, {"mmgd": "ESTIMADO", "liquida": "OBSERVADO", "global": "OBSERVADO"})

    def test_backtest_periodo_e_cobertura(self):
        p = self.g["p027"]
        ultimo = None
        with open(os.path.join(base.SERIES, "carga_decomposicao_diaria.csv"), encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if r["submercado"] == "SIN":
                    ultimo = r["data"]
        self.assertEqual(p["periodo_avaliacao"]["fim"], ultimo)
        e = self.g["evidencias"]["p027_mape_sin"]
        self.assertEqual(e["periodo"]["fim"], ultimo)
        m = p["metricas"]["SIN"]
        res = {t["nome"]: t["resultado"] for t in e["testes"]}
        self.assertEqual(res["cobertura do intervalo de 80%"], "aprovado" if m["cobertura_80_pct"] >= 80 else "ressalva")
        self.assertEqual(res["cobertura do intervalo de 95%"], "aprovado" if m["cobertura_95_pct"] >= 95 else "ressalva")

    def test_arquivos_das_evidencias_existem_ou_sao_declarados_indisponiveis(self):
        if not os.path.isdir(os.path.join(base.RAIZ, "data", "energia", "bronze")):
            self.skipTest("bronze ausente neste ambiente")
        for nome, e in self.g["evidencias"].items():
            f = e["fonte"]
            for a in [f] + list(f.get("arquivos") or []):
                if a.get("arquivo"):
                    self.assertTrue(os.path.exists(os.path.join(base.RAIZ, a["arquivo"])), f"{nome}: {a['arquivo']}")
                elif a.get("sha256"):  # caminho vazio: a evidência diz por quê
                    self.assertTrue(any(a["recurso"] in x and "indisponível" in x for x in e["filtros"]), f"{nome}: {a['recurso']}")

    def test_evidencias_validas(self):
        self.assertTrue(self.g["evidencias"])
        for nome, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], nome)

    def test_decomposicao_chamada_de_estatistica(self):
        self.assertIn("não causal", self.g["p027"]["nome"])
        self.assertEqual(self.g["p027"]["natureza"], "ESTIMADO")


if __name__ == "__main__":
    unittest.main()
