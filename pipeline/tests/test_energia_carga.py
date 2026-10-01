"""Módulo Carga (P025, P026, P027 e achados A07 e A11): validação física com quarentena,
curva horária, carga verificada da API (carga global, MMGD e carga líquida), calendário
oficial, temperatura ponderada e decomposição estatística fora da amostra.

Sem rede. Amostras reais recortadas em pipeline/tests/dados/energia_carga/:
- carga_diaria_vintages_silver.csv: carga diária do ONS como gravada no silver principal
  nas capturas de 29/09/2026 02:42 UTC e 30/09/2026 02:19 UTC (o arquivo bruto de 29/09
  não está no bronze deste ambiente; o silver guarda o valor de cada captura);
- curva_carga_2026_20260920.csv e curva_carga_2015_sul_0101_0106.csv: linhas do
  CURVA_CARGA_2026.csv e do CURVA_CARGA_2015.csv capturados em 30/09/2026;
- api_seco_20260920.json e api_seco_fev2019_trecho.json: respostas da API de carga
  verificada (texto bruto, com os campos vazios que a API emite);
- power_sp_recorte.json, sidra_6579_uf.json, ibge_centroide_3550308.json e
  senado_lei_14759_2023.json: respostas da NASA POWER, do IBGE e do Senado;
- modelo_sin_2023_2024.csv: carga diária do SIN aceita e temperatura ponderada do SIN.

Os valores esperados vêm de caminho independente do código testado: a Carga de Energia
Diária publicada pelo ONS (outro arquivo, outro produto) para a média da curva; o arquivo
transicao_ons_mmgd_diario.csv do módulo Transição (mesma API, outro código) para a carga
verificada; a gold carga.json do commit d95d8f8b4 para o +10,5% do achado A07; datas de
Páscoa do calendário gregoriano publicadas em qualquer tabela eclesiástica."""
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


def _silver_vintages():
    """Silver em memória com as duas capturas reais da carga diária (e a de 2025)."""
    con = base.conecta(":memory:")
    por_vintage = {}
    with open(os.path.join(DADOS, "carga_diaria_vintages_silver.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            por_vintage.setdefault((r["recurso"], r["capturado_em"], r["sha256"]), []).append((r["serie"], r["ref"], float(r["valor"])))
    for (rec, cap, sha), linhas in sorted(por_vintage.items(), key=lambda x: x[0][1]):
        vid, _ = base.registra_vintage(con, "carga_energia_di", rec, "u", cap, None, sha, 1, "coleta_direta", "x")
        base.grava_observacoes(con, "carga_energia_di", vid, linhas)
    return con


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
        # a curva não "salva" um valor fora do domínio
        self.assertEqual(ocorr[0]["conferencia"], "curva não confirma o valor")

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

    def test_atipico_conferido_na_curva_e_publicado(self):
        # Sul, 06/01/2015: salto de mais de 40% sobre a semana do fim de ano (F3), confirmado pela curva
        obs = {(s, r): v for s, r, v in ons.agrega_curva(_curva("curva_carga_2015_sul_0101_0106.csv"))}
        curva = {r: v for (s, r), v in obs.items() if s == "media_dia.S"}
        # carga diária publicada pelo ONS no Sul, 26/12/2014 a 06/01/2015 (silver principal)
        serie = {"2014-12-26": 9169.0, "2014-12-27": 8624.0, "2014-12-28": 8132.0, "2014-12-29": 9582.0, "2014-12-30": 9911.0,
                 "2014-12-31": 8898.0, "2015-01-01": 7718.0, "2015-01-02": 8512.0, "2015-01-03": 8511.0, "2015-01-04": 8229.0,
                 "2015-01-05": 10872.0, "2015-01-06": 12307.82897049}
        aceitos, ocorr = gcarga.valida_serie("S", serie, curva=curva)
        self.assertIn("2015-01-06", aceitos)
        self.assertEqual([(o["dia"], o["regras"], o["situacao"]) for o in ocorr], [("2015-01-06", ["F3"], "atipico_conferido")])
        # sem a curva (ou com curva divergente) o mesmo valor fica em quarentena
        aceitos2, ocorr2 = gcarga.valida_serie("S", serie, curva={"2015-01-06": 11000.0})
        self.assertNotIn("2015-01-06", aceitos2)
        self.assertEqual(ocorr2[0]["situacao"], "quarentena")

    def test_zero_nao_e_carga(self):
        aceitos, ocorr = gcarga.valida_serie("N", {"2026-01-01": 0.0, "2026-01-02": 8000.0})
        self.assertEqual(list(aceitos), ["2026-01-02"])
        self.assertEqual(ocorr[0]["regras"], ["F1"])


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

    def test_mmgd_nunca_somada_nem_subtraida_da_curva(self):
        for h in self.g["p026"]["recente"]:
            if h["global"] is not None and h["mmgd"] is not None:
                self.assertAlmostEqual(h["liquida"], h["global"] - h["mmgd"], delta=1.0)

    def test_evidencias_validas(self):
        self.assertTrue(self.g["evidencias"])
        for nome, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], nome)

    def test_decomposicao_chamada_de_estatistica(self):
        self.assertIn("não causal", self.g["p027"]["nome"])
        self.assertEqual(self.g["p027"]["natureza"], "ESTIMADO")


if __name__ == "__main__":
    unittest.main()
