"""Módulo Previsões: calendário do alvo, variáveis sem olhar para o futuro, modelos,
avaliação, arquivo imutável de emissões e governança.

Sem rede. As amostras em pipeline/tests/dados/energia_previsoes/ são recortes reais:
- PLD horário da CCEE, linhas copiadas sem alteração da captura versionada do projeto
  (pipeline/energia/seed/ccee_pld_horario/v20260927T154402Z, capturada em 27/09/2026 15h44
  UTC): outubro de 2024 (formato com aspas, preço alto de seca), outubro de 2025 e
  01/08/2026 a 27/09/2026; e a semana de 04 a 10/01/2025 (as 168 horas no piso de R$ 58,60
  nos quatro submercados), recortada do pld_horario_2025 do mesmo seed;
- EAR e ENA diárias por subsistema do ONS (arquivos de 2026 baixados em 30/09/2026 às 22h
  UTC; sha256 a73378b0... e e0bcbdd3...), de 25/08 a 29/09/2026;
- atos da ANEEL com os limites do PLD de 2024 a 2026 (esquema do módulo Regulação).

Os valores esperados de médias foram calculados por outro programa (awk sobre os mesmos
arquivos originais) e estão escritos nos testes; não são recalculados pelo código testado.
Onde um teste precisa de um instante de captura que não aconteceu (revisão depois do corte,
captura antes do corte), a simulação é declarada no próprio teste.
"""
import copy
import csv
import glob
import gzip
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, evidencia as ev, governanca as g, metricas  # noqa: E402
from pipeline.energia.fontes import ccee, ons  # noqa: E402
from pipeline.energia.gold import modelos as gold_modelos  # noqa: E402
from pipeline.energia.modulos import previsoes as mod  # noqa: E402
from pipeline.energia.previsoes import arquivo as arq  # noqa: E402
from pipeline.energia.previsoes import avaliacao as av  # noqa: E402
from pipeline.energia.previsoes import calendario as cal  # noqa: E402
from pipeline.energia.previsoes import emissao as em  # noqa: E402
from pipeline.energia.previsoes import modelos_pld as mp  # noqa: E402
from pipeline.energia.previsoes import variaveis as v  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_previsoes")
CAPTURA_SEED = "2026-09-27T15:44:02Z"   # captura real do seed da CCEE
CAPTURA_ONS = "2026-09-30T22:01:37Z"    # metadata_modified do conjunto de EAR no dia do download

# médias por awk sobre os arquivos originais (R$/MWh)
SEMANA_0919 = {"SE": 124.091131, "S": 120.863571, "NE": 124.088571, "N": 124.093393}
AGOSTO_2026 = {"SE": 128.117500, "S": 128.100309, "NE": 125.269919, "N": 126.702352}
OUTUBRO_2024 = {"SE": 480.784503, "S": 480.764274, "NE": 449.829368, "N": 482.540148}
SEMANA_20251004 = {"SE": 258.330179, "S": 258.322857, "NE": 212.085060, "N": 258.224762}
MM4_0829_0925 = {"SE": 134.455833, "S": 133.304896, "NE": 134.043899, "N": 134.297009}
EAR_0925_MENOS_0828 = {"SE": 57.2526 - 58.6157, "S": 81.8491 - 81.0961, "NE": 69.7123 - 76.6285, "N": 74.0371 - 82.7334}
ENA7_0919_0925 = {"SE": 183.289529, "S": 280.089743, "NE": 72.236943, "N": 47.974500}


def _texto_gz(nome):
    with gzip.open(os.path.join(DADOS, nome), "rt", encoding="utf-8-sig") as f:
        return f.read()


def _pld():
    pontos = {sm: [] for sm in cal.SUBMERCADOS}
    for nome in ("pld_horario_2024_10.csv.gz", "pld_horario_2025_10_2026_08_09.csv.gz"):
        for serie, ref, val in ccee.parse_pld(_texto_gz(nome)):
            pontos[serie.split(".")[1]].append((ref, val))
    return pontos


def _hidro():
    ear, ena = {sm: {} for sm in cal.SUBMERCADOS}, {sm: {} for sm in cal.SUBMERCADOS}
    with open(os.path.join(DADOS, "ear_diario_subsistema_2026_recorte.csv"), encoding="utf-8") as f:
        for serie, ref, val in ons.parse_ear(f.read()):
            if serie.startswith("ear_pct."):
                ear[serie.split(".")[1]][date.fromisoformat(ref)] = val
    with open(os.path.join(DADOS, "ena_diario_subsistema_2026_recorte.csv"), encoding="utf-8") as f:
        for serie, ref, val in ons.parse_ena(f.read()):
            if serie.startswith("ena_bruta_pct_mlt."):
                ena[serie.split(".")[1]][date.fromisoformat(ref)] = val
    return ear, ena


def _le(caminho):
    with open(caminho, encoding="utf-8") as f:
        return f.read()


def _grava(caminho, texto):
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(texto)


def _limites():
    with open(os.path.join(DADOS, "limites_pld_recorte.json"), encoding="utf-8") as f:
        return mp.LimitesConhecidos(json.load(f)["atos"])


def _info(pld=None):
    ear, ena = _hidro()
    return v.Informacao.de_pontos(pld or _pld(), ear, ena)


def _silver(captura_pld=CAPTURA_SEED, pld=None):
    """Silver em memória com o recorte do PLD numa vintage capturada em `captura_pld` e EAR e
    ENA numa vintage do ONS; mesmo esquema e mesmas funções de gravação do pipeline."""
    con = base.conecta(":memory:")
    pld = pld or _pld()
    vid, _ = base.registra_vintage(con, v.DS_PLD, "recorte", "https://dadosabertos.ccee.org.br/dataset/pld_horario",
                                   captura_pld, None, "a" * 64, 1, "teste", None)
    base.grava_observacoes(con, v.DS_PLD, vid, [(f"pld.{sm}", r, x) for sm, ps in pld.items() for r, x in ps])
    ear, ena = _hidro()
    for ds, serie, dados in ((v.DS_EAR, v.SERIE_EAR, ear), (v.DS_ENA, v.SERIE_ENA, ena)):
        vid, _ = base.registra_vintage(con, ds, "recorte", "https://dados.ons.org.br", CAPTURA_ONS, None, "b" * 64, 1, "teste", None)
        base.grava_observacoes(con, ds, vid, [(f"{serie}.{sm}", d.isoformat(), x) for sm, dd in dados.items() for d, x in dd.items()])
    con.commit()
    return con


class Calendario(unittest.TestCase):
    def test_semana_de_sabado_a_sabado_e_w1_depois_da_origem(self):
        # sexta: W1 começa no dia seguinte; sábado: a semana em curso não conta
        self.assertEqual(cal.entrega(date(2026, 10, 2), "W1")["inicio"], date(2026, 10, 3))
        self.assertEqual(cal.entrega(date(2026, 10, 3), "W1")["inicio"], date(2026, 10, 10))
        w4 = cal.entrega(date(2026, 9, 30), "W4")
        self.assertEqual((w4["inicio"], w4["fim"], w4["horas"]), (date(2026, 10, 24), date(2026, 10, 31), 168))
        self.assertEqual(w4["inicio"].weekday(), cal.SABADO)

    def test_meses_civis_e_mes_ja_iniciado_nao_e_m1(self):
        self.assertEqual(cal.entrega(date(2026, 9, 30), "M1")["id"], "M2026-10")
        self.assertEqual(cal.entrega(date(2026, 10, 1), "M1")["id"], "M2026-11")   # às 07h o mês já começou
        m3 = cal.entrega(date(2026, 11, 15), "M3")
        self.assertEqual((m3["id"], m3["horas"]), ("M2027-02", 28 * 24))
        self.assertEqual(cal.entrega(date(2023, 12, 31), "M2")["horas"], 29 * 24)   # fevereiro de 2024

    def test_convencao_confere_com_a_rodada_da_pesquisa(self):
        """Reconciliação com o registro externo de 27/09/2026 (arquivo.jsonl): mesma entrega
        W1, mesmo corte e mesmo prazo, pelo nosso calendário."""
        legado = arq.le_legado()
        r = next(x for x in legado if x["horizonte"] == "W1")
        e = cal.entrega(date.fromisoformat(r["origem"]), "W1")
        self.assertEqual((e["id"], e["inicio_utc"], e["fim_utc"]), (r["entrega"]["id"], r["entrega"]["inicio"], r["entrega"]["fim"]))
        self.assertEqual(cal.utc_iso(cal.corte_de(date.fromisoformat(r["origem"]))), r["cutoff"])
        self.assertEqual(cal.utc_iso(cal.prazo_de(date.fromisoformat(r["origem"]))), r["prazo"])

    def test_elegibilidade_lat1d(self):
        # origem quarta 30/09: último dia 28/09, semana de 19/09, agosto
        o = date(2026, 9, 30)
        self.assertEqual(cal.ultimo_dia_elegivel(o), date(2026, 9, 28))
        self.assertEqual(cal.ultima_semana_elegivel(o), date(2026, 9, 19))
        self.assertEqual(cal.ultimo_mes_elegivel(o), date(2026, 8, 1))
        # origem sábado 26/09: a semana que terminou à meia-noite só é elegível no dia seguinte às 07h
        self.assertEqual(cal.ultima_semana_elegivel(date(2026, 9, 26)), date(2026, 9, 12))
        self.assertEqual(cal.ultima_semana_elegivel(date(2026, 9, 27)), date(2026, 9, 19))
        # 1º de outubro: setembro ainda não é elegível; 2 de outubro já é
        self.assertEqual(cal.ultimo_mes_elegivel(date(2026, 10, 1)), date(2026, 8, 1))
        self.assertEqual(cal.ultimo_mes_elegivel(date(2026, 10, 2)), date(2026, 9, 1))
        # LAT3D recua dois dias em relação ao LAT1D
        self.assertEqual(cal.ultimo_dia_elegivel(o, 3), date(2026, 9, 26))


class Variaveis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.info = _info()

    def test_b0_confere_com_awk_nos_quatro_submercados(self):
        for sm in cal.SUBMERCADOS:
            w = v.basicas(self.info, date(2026, 9, 30), "W", sm)
            m = v.basicas(self.info, date(2026, 9, 30), "M", sm)
            self.assertAlmostEqual(w["b0"]["valor"], SEMANA_0919[sm], places=5)
            self.assertAlmostEqual(m["b0"]["valor"], AGOSTO_2026[sm], places=5)
            self.assertEqual((w["b0"]["inicio"], w["b0"]["fim"]), ("2026-09-19", "2026-09-26"))

    def test_extremo_de_2024_no_formato_antigo(self):
        """Mês de preço alto (outubro de 2024, seca) no arquivo com aspas e zeros à esquerda."""
        for sm in cal.SUBMERCADOS:
            m = v.basicas(self.info, date(2024, 11, 30), "M", sm)
            self.assertAlmostEqual(m["b0"]["valor"], OUTUBRO_2024[sm], places=5)

    def test_variaveis_do_c2_conferem_com_awk(self):
        o = date(2026, 9, 27)
        e = cal.entrega(o, "W1")
        for sm in cal.SUBMERCADOS:
            bas = v.basicas(self.info, o, "W", sm, hidrologia=True)
            saz = v.sazonal(self.info, e, sm)
            self.assertEqual(saz["inicio"], "2025-10-04")
            self.assertAlmostEqual(saz["valor"], SEMANA_20251004[sm], places=5)
            self.assertAlmostEqual(bas["mm"]["valor"], MM4_0829_0925[sm], places=5)
            self.assertAlmostEqual(bas["d7"]["valor"], SEMANA_0919[sm], places=5)   # 19 a 25/09 = D−8 a D−2
            self.assertAlmostEqual(bas["ear28"]["valor"], EAR_0925_MENOS_0828[sm], places=4)
            self.assertAlmostEqual(bas["ena7"]["valor"], ENA7_0919_0925[sm], places=5)
            x, nomeado = v.vetor(bas, saz, True)
            self.assertAlmostEqual(nomeado["ena7_menos_100"], ENA7_0919_0925[sm] - 100, places=5)
            self.assertAlmostEqual(x[0], MM4_0829_0925[sm] - SEMANA_0919[sm], places=5)

    def test_hora_ausente_deixa_o_periodo_sem_media(self):
        pld = _pld()
        pld["SE"] = [(r, x) for r, x in pld["SE"] if r != "2026-09-22T13:00"]
        info = _info(pld)
        self.assertIsNone(v.basicas(info, date(2026, 9, 30), "W", "SE")["b0"]["valor"])   # nunca média de 167 horas
        self.assertAlmostEqual(v.basicas(info, date(2026, 9, 30), "M", "SE")["b0"]["valor"], AGOSTO_2026["SE"], places=5)
        self.assertAlmostEqual(v.basicas(info, date(2026, 9, 30), "W", "N")["b0"]["valor"], SEMANA_0919["N"], places=5)
        x, _ = v.vetor(v.basicas(info, date(2026, 9, 27), "W", "SE"), v.sazonal(info, cal.entrega(date(2026, 9, 27), "W1"), "SE"), False)
        self.assertIsNone(x)

    def test_realizado_so_com_entrega_completa(self):
        # setembro de 2026 só tem até o dia 27 no recorte: sem realizado (nem média parcial)
        self.assertIsNone(v.realizado(self.info, cal.entrega_por_id("M2026-09"), "SE"))
        self.assertAlmostEqual(v.realizado(self.info, cal.entrega_por_id("M2026-08"), "SE"), AGOSTO_2026["SE"], places=5)
        self.assertEqual(self.info.horas_disponiveis("SE", date(2026, 9, 26), date(2026, 10, 3)), 48)


class LimitesDePreco(unittest.TestCase):
    def test_ato_so_vale_depois_de_publicado(self):
        lim = _limites()
        jan25 = cal.entrega_por_id("M2025-01")
        lo, hi, prov, _ = lim.faixa(jan25, date(2024, 11, 30))      # despacho de 2025 saiu em 17/12/2024
        self.assertAlmostEqual(lo, 61.07, places=9)
        self.assertAlmostEqual(hi, 716.80, places=9)
        self.assertTrue(prov)
        lo, hi, prov, _ = lim.faixa(jan25, date(2024, 12, 18))
        self.assertAlmostEqual(lo, 58.60, places=9)
        self.assertAlmostEqual(hi, 751.73, places=9)
        self.assertFalse(prov)
        lo, _, prov, _ = lim.faixa(jan25, date(2024, 12, 17))       # publicado no próprio dia não conta às 07h
        self.assertTrue(prov)

    def test_semana_na_virada_pondera_os_dias(self):
        lim = _limites()
        lo, hi, prov, atos = lim.faixa({"id": "W2024-12-28", "inicio": date(2024, 12, 28), "fim": date(2025, 1, 4)}, date(2024, 12, 20))
        self.assertAlmostEqual(lo, (4 * 61.07 + 3 * 58.60) / 7, places=9)
        self.assertAlmostEqual(hi, (4 * 716.80 + 3 * 751.73) / 7, places=9)
        self.assertFalse(prov)
        self.assertEqual(len(atos), 2)

    def test_restricao_e_quantis_nao_cruzam(self):
        q = mp.quantis_residuos([-300.0, -120.0, -5.0, 0.0, 3.0, 40.0, 90.0])
        fin = mp.quantis_finais(100.0, q, 61.07, 716.8)
        vals = [fin[r] for r in mp.ROTULOS_NIVEIS]
        self.assertEqual(vals, sorted(vals))
        self.assertEqual(fin["p05"], 61.07)                          # abaixo do piso vira o piso, sem cruzar
        self.assertTrue(all(61.07 <= x <= 716.8 for x in vals))
        self.assertEqual(mp.restringe(-211.87, 61.07, 716.8), (61.07, True))
        self.assertEqual(mp.restringe(None, 61.07, 716.8), (None, False))


class ModelosEAvaliacao(unittest.TestCase):
    def test_ridge_de_uma_variavel_confere_com_forma_fechada(self):
        xs, zs, lam = [[1.0], [2.0], [3.0], [4.0]], [2.0, 4.0, 6.0, 8.5], 0.1
        ac = mp.Acumulados(xs, zs)
        xx, xz, _, n = ac.intervalo(0, 4)
        esc = [((1 + 4 + 9 + 16) / 4) ** 0.5]
        beta = mp.ajuste_ridge(xx, xz, n, lam, esc)
        esperado = (62.0 / esc[0]) / (30.0 / esc[0] ** 2 + lam * 4)
        self.assertAlmostEqual(beta[0], esperado, places=12)
        self.assertEqual(mp.ajuste_ridge(xx, xz, n, "ZERO", esc), [0.0])

    def test_ajuste_nao_usa_entrega_posterior_e_exige_treino_minimo(self):
        origens = [date(2022, 1, 1) + timedelta(days=i) for i in range(560)]
        fins = [cal.entrega(o, "W1")["fim"] for o in origens]
        xs = [[((i * 37) % 11) - 5.0, ((i * 13) % 7) - 3.0] for i in range(len(origens))]
        zs = [0.5 * a - 0.2 * b for a, b in xs]
        ac = mp.Acumulados(xs, zs)
        corte = date(2023, 3, 5)
        from bisect import bisect_right
        i_fim = bisect_right(fins, corte - timedelta(days=1))
        aj = mp.ajusta_c2(ac, fins, origens, i_fim, 1, "W")
        self.assertTrue(aj["ok"])
        self.assertTrue(all(f <= corte - timedelta(days=1) for f in fins[:aj["linhas_treino"]]))
        # treino interno termina antes da primeira origem de validação menos 1 dia
        v0 = aj["linhas_treino"] - aj["linhas_validacao"]
        j = aj["linhas_treino_interno"]
        self.assertLessEqual(fins[j - 1], origens[v0] - timedelta(days=1))
        self.assertGreater(fins[j], origens[v0] - timedelta(days=1))
        curto = mp.ajusta_c2(ac, fins, origens, bisect_right(fins, date(2022, 6, 1)), 1, "W")
        self.assertEqual((curto["ok"], curto["motivo"]), (False, "TREINO_INSUFICIENTE"))

    def test_pinball_e_calibracao_por_entregas_distintas(self):
        self.assertAlmostEqual(mp.pinball(10.0, 8.0, 0.9), 1.8)
        self.assertAlmostEqual(mp.pinball(10.0, 12.0, 0.9), 0.2)
        self.assertEqual(av.calibracao({"cobertura_p10_p90": 0.80, "entregas_com_quantis": 90}, 100), "AMOSTRA_INSUFICIENTE")
        self.assertEqual(av.calibracao({"cobertura_p10_p90": 0.80, "entregas_com_quantis": 120}, 100), "CALIBRADO")
        self.assertEqual(av.calibracao({"cobertura_p10_p90": 0.60, "entregas_com_quantis": 120}, 100), "DESCALIBRADO")
        self.assertEqual(av.calibracao({"cobertura_p10_p90": None, "entregas_com_quantis": 0}, 100), "SEM_AVALIACAO")

    def test_bootstrap_deterministico_e_sem_intervalo_com_poucos_blocos(self):
        blocos = {i: (float(i % 3), 1) for i in range(12)}
        self.assertEqual(av.bootstrap_media(blocos), av.bootstrap_media(blocos))
        lo, hi = av.bootstrap_media(blocos)
        self.assertLessEqual(lo, 1.0)
        self.assertGreaterEqual(hi, 1.0)
        self.assertEqual(av.bootstrap_media({0: (1.0, 1), 1: (2.0, 1)}), (None, None))

    def test_teste_retrospectivo_no_recorte(self):
        """Com o recorte real, o B0 do teste retrospectivo em 30/11/2024 é a média de outubro
        de 2024 (awk), restrita à faixa conhecida no dia; o C2 fica sem previsão por falta de
        treino (nunca vira B0)."""
        info, lim = _info(), _limites()
        aj = []
        linhas = av.executa(info, lim, [date(2024, 11, 30), date(2026, 9, 30)], k=1, ajustes=aj)
        self.assertEqual(len(linhas), 2 * 28)
        ln = next(x for x in linhas if x.origem == date(2024, 11, 30) and x.h == "M1" and x.sm == "NE")
        self.assertAlmostEqual(ln.prev["B0"], OUTUBRO_2024["NE"], places=5)
        self.assertIsNone(ln.prev["C2-P"])
        self.assertEqual(ln.motivo["C2-P"], "VARIAVEL_AUSENTE")
        ln2 = next(x for x in linhas if x.origem == date(2026, 9, 30) and x.h == "W2" and x.sm == "S")
        self.assertAlmostEqual(ln2.prev["B0"], SEMANA_0919["S"], places=5)
        self.assertTrue(all(a["ok"] is False for a in aj))


class Emissao(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.pasta = os.path.join(self.tmp, "emissoes")
        self.legado = os.path.join(self.tmp, "arquivo.jsonl")
        shutil.copy(arq.LEGADO, self.legado)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def _emite(self, con, origem, emitido, **kw):
        return em.emitir(con, origem, agora=emitido, emitido_em=emitido, versao_codigo="teste", pasta=self.pasta,
                         legado=self.legado, lim=_limites(), **kw)

    def test_a08_sem_captura_ate_o_corte_nao_ha_numero(self):
        """Causa do achado A08: o seed foi capturado às 15h44 UTC de 27/09, depois do corte das
        10h00 UTC; a rodada daquele dia não podia ter número."""
        con = _silver()
        regs = self._emite(con, date(2026, 9, 27), datetime(2026, 9, 27, 19, 10, 13, tzinfo=timezone.utc))
        self.assertEqual(len(regs), 28)
        self.assertEqual({(r["status"], r["motivo"]) for r in regs}, {("INDISPONIVEL", "SEM_PERIODO_ELEGIVEL_CAPTURADO_ATE_O_CORTE")})
        self.assertTrue(all("ATRASADO_APOS_08H" in r["alertas"] and r["previsao"] is None for r in regs))

    def test_rodada_com_dado_capturado_confere_com_awk_e_nao_ve_revisao_posterior(self):
        con = _silver()
        # simulação: uma revisão do PLD capturada depois do corte (29/09 02h43 UTC, horário real
        # da captura direta seguinte) altera uma hora da semana usada pelo B0
        vid, _ = base.registra_vintage(con, v.DS_PLD, "recorte", "x", "2026-09-29T02:43:41Z", None, "c" * 64, 1, "teste", None)
        original = dict(_pld()["SE"])["2026-09-22T13:00"]
        base.grava_observacoes(con, v.DS_PLD, vid, [("pld.SE", "2026-09-22T13:00", original + 100.0)])
        regs = self._emite(con, date(2026, 9, 28), datetime(2026, 9, 28, 10, 30, tzinfo=timezone.utc))
        por = {(r["horizonte"], r["submercado"]): r for r in regs}
        for sm in cal.SUBMERCADOS:
            self.assertAlmostEqual(por[("W1", sm)]["previsao"], SEMANA_0919[sm], places=4)
            self.assertAlmostEqual(por[("M3", sm)]["previsao"], AGOSTO_2026[sm], places=4)
        r = por[("W1", "SE")]
        self.assertEqual(r["tipo"], "REFERENCIA_EXPERIMENTAL")
        self.assertEqual(r["features_usadas"][0]["capturado_em"], CAPTURA_SEED)
        self.assertLessEqual(r["features_usadas"][0]["capturado_em"], r["cutoff"])
        self.assertEqual((r["fracao_conhecida"], r["quantis"], r["atraso_min"]), (0.0, None, 0.0))
        self.assertNotIn("ATRASADO_APOS_08H", r["alertas"])
        self.assertEqual(g.valida_arquivo(arq.le_tudo(self.pasta, self.legado), {m["codigo"]: m for m in em.le_registro()["modelos"]},
                                          resultados_liberados=False), [])
        # depois da captura da revisão, a rodada de 30/09 enxerga o valor revisado
        regs30 = self._emite(con, date(2026, 9, 30), datetime(2026, 9, 30, 10, 20, tzinfo=timezone.utc))
        w1 = next(x for x in regs30 if x["horizonte"] == "W1" and x["submercado"] == "SE")
        self.assertAlmostEqual(w1["previsao"], SEMANA_0919["SE"] + 100.0 / 168, places=4)

    def test_horas_ja_publicadas_sao_separadas_da_previsao(self):
        """Simulação: captura datada antes do corte de uma origem de domingo (20/09), cuja W1
        (26/09 a 03/10) já tem 26 e 27/09 no recorte. A previsão cobre só o desconhecido e a
        combinação com o PLD publicado é explícita."""
        con = _silver(captura_pld="2026-09-20T09:00:00Z")
        regs = self._emite(con, date(2026, 9, 20), datetime(2026, 9, 20, 10, 5, tzinfo=timezone.utc))
        r = next(x for x in regs if x["horizonte"] == "W1" and x["submercado"] == "N")
        self.assertEqual(r["horas_capturadas_ate_corte"], 48)
        self.assertIn("ENTREGA_COM_HORAS_JA_PUBLICADAS", r["alertas"])
        info = _info()
        conhecida = info.media_horas("N", date(2026, 9, 26), date(2026, 9, 28))
        b0 = v.basicas(info, date(2026, 9, 20), "W", "N")["b0"]["valor"]
        self.assertAlmostEqual(r["previsao"], (conhecida * 48 + b0 * 120) / 168, places=4)
        self.assertAlmostEqual(r["previsao_parte_desconhecida"], b0, places=4)

    def test_falha_vira_registro_sem_numero(self):
        con = _silver()
        regs = em.emitir(con, date(2026, 9, 30), falha="RuntimeError: teste", versao_codigo="teste", pasta=self.pasta,
                         legado=self.legado, emitido_em=datetime(2026, 9, 30, 11, 30, tzinfo=timezone.utc),
                         agora=datetime(2026, 9, 30, 11, 30, tzinfo=timezone.utc))
        self.assertTrue(all(r["status"] == "INDISPONIVEL" and r["motivo"] == "FALHA_NA_EXECUCAO" and "FALHA" in r["alertas"] for r in regs))
        self.assertFalse(em.ja_emitida(date(2026, 9, 30), self.pasta, self.legado))

    def test_emissao_antes_do_corte_e_recusada(self):
        with self.assertRaises(ValueError):
            self._emite(_silver(), date(2026, 9, 30), datetime(2026, 9, 30, 9, 59, tzinfo=timezone.utc))

    def test_cadeia_detecta_edicao_e_remocao(self):
        con = _silver()
        self._emite(con, date(2026, 9, 28), datetime(2026, 9, 28, 10, 30, tzinfo=timezone.utc))
        caminho = os.path.join(self.pasta, "2026-09.jsonl")
        linhas = _le(caminho).splitlines()
        self.assertEqual(arq.valida_particoes(self.pasta, self.legado), [])
        # edição de um registro do meio com o sha256 recalculado (quem edita refaz o hash)
        r = json.loads(linhas[5])
        r["previsao"] = 1.0
        linhas_ed = list(linhas)
        linhas_ed[5] = json.dumps(arq.sela(r), ensure_ascii=False, sort_keys=True)
        _grava(caminho, "\n".join(linhas_ed) + "\n")
        self.assertTrue(any("cadeia quebrada" in x for x in arq.valida_particoes(self.pasta, self.legado)))
        # remoção de um registro do meio
        _grava(caminho, "\n".join(linhas[:5] + linhas[6:]) + "\n")
        self.assertTrue(any("cadeia quebrada" in x for x in arq.valida_particoes(self.pasta, self.legado)))

    def test_particao_publicada_nao_pode_perder_registro(self):
        con = _silver()
        self._emite(con, date(2026, 9, 28), datetime(2026, 9, 28, 10, 30, tzinfo=timezone.utc))
        series = os.path.join(self.tmp, "series")
        os.makedirs(series)
        prev, _ = gold_modelos.construir(None, pasta=self.pasta, legado=self.legado, destino_series=series)
        self.assertEqual(prev["emissoes"]["registros"], 28)
        self.assertEqual(len(prev["arquivo"]), 28)   # só os registros anteriores ao particionamento
        # a partição publicada tem um registro que sumiu do arquivo versionado
        publicada = json.loads(_le(os.path.join(series, "previsoes_emissoes_2026-09.json")))
        publicada["registros"].append({**publicada["registros"][0], "forecast_id": "sumido", "sha256": "0" * 64})
        _grava(os.path.join(series, "previsoes_emissoes_2026-09.json"), json.dumps(publicada))
        with self.assertRaises(g.ViolacaoGovernanca):
            gold_modelos.construir(None, pasta=self.pasta, legado=self.legado, destino_series=series, escrever_particoes=False)


class Governanca(unittest.TestCase):
    def setUp(self):
        self.registro = em.le_registro()
        self.modelos = {m["codigo"]: m for m in self.registro["modelos"]}
        self.rec = next(r for r in g.le_jsonl(os.path.join(arq.PASTA, "2026-09.jsonl")) if r["status"] == "DISPONIVEL")

    def test_registro_arquivado_e_conforme(self):
        self.assertEqual(g.valida_registro(self.rec, self.modelos), [])

    def test_referencia_experimental_com_faixa_nao_calibrada_e_recusada(self):
        r = arq.sela({**self.rec, "quantis": {"p10": 100.0, "p90": 150.0, "rotulo_faixa": "faixa não calibrada"}})
        self.assertTrue(any("quantis sem calibração" in x for x in g.valida_registro(r, self.modelos)))

    def test_referencia_experimental_exige_rotulo_e_autorizacao(self):
        r = arq.sela({**self.rec, "rotulo": "B0"})
        self.assertTrue(any("identificação no rótulo" in x for x in g.valida_registro(r, self.modelos)))
        r = arq.sela({**self.rec, "modelo": "C2-P"})
        self.assertTrue(any("sem autorização" in x for x in g.valida_registro(r, self.modelos)))
        mods = copy.deepcopy(self.modelos)
        mods["B0"]["referencia_experimental"]["condicoes"][0]["verificada"] = False
        self.assertTrue(any("condições verificadas" in x for x in g.valida_registro(self.rec, mods)))

    def test_captura_depois_do_corte_e_recusada(self):
        f = dict(self.rec["features_usadas"][0], capturado_em="2026-09-30T10:00:01Z")
        r = arq.sela({**self.rec, "features_usadas": [f]})
        self.assertTrue(any("look-ahead" in x for x in g.valida_registro(r, self.modelos)))

    def test_candidato_em_rodada_interna_segue_retido(self):
        r = arq.sela({**self.rec, "tipo": "RODADA_INTERNA", "modelo": "C2-P"})
        v_ = g.valida_arquivo([r], self.modelos, resultados_liberados=False)
        self.assertTrue(any("retida" in x for x in v_))

    def test_lista_fixa_de_registros_arquivados(self):
        """P015: nada registrado é reescrito. Lista fixa escrita no momento da gravação."""
        with open(os.path.join(DADOS, "emissoes_publicadas.json"), encoding="utf-8") as f:
            fixos = json.load(f)["registros"]
        atuais = {r["forecast_id"]: r["sha256"] for r in arq.le_tudo()}
        self.assertEqual(len(fixos), 28)
        for fid, sha in fixos:
            self.assertEqual(atuais.get(fid), sha, fid)
        self.assertEqual(arq.valida_particoes(), [])

    def test_reexecucao_reproduz_a_rodada_arquivada(self):
        """P014: refazer o B0 de cada célula da rodada de 30/09/2026 a partir do arquivo
        original da CCEE (recorte) reproduz o número arquivado dentro de R$ 0,005/MWh."""
        info = _info()
        regs = [r for r in arq.le_tudo() if r["run_id"].startswith("prosp_2026-09-30") and r["modelo"] == "B0"]
        self.assertEqual(len(regs), 28)
        for r in regs:
            bas = v.basicas(info, date.fromisoformat(r["origem"]), r["frequencia"], r["submercado"])
            lim = r["limites"]
            refeito, _ = mp.restringe(bas["b0"]["valor"], lim["piso_medio"], lim["teto_estrutural_medio"])
            self.assertLessEqual(abs(refeito - r["previsao"]), mod.TOL_REEXECUCAO, r["forecast_id"])

    def test_configuracao_congelada_confere_com_o_registro(self):
        self.assertEqual(self.registro["validacao_observatorio"]["configuracao_sha256"], mp.sha_configuracao())

    def test_metricas_do_modulo_validas(self):
        ms = [m for m in metricas.todas() if m["arquivo"].endswith("/previsoes.py")]
        self.assertGreaterEqual(len(ms), 10)

    def test_metrica_retida_nao_aponta_para_a_gold_publicada(self):
        """Defeito da verificação de 01/10/2026: MAE, ganho e cobertura apontavam
        gold = previsoes_desempenho.json, que sob retenção não os contém."""
        publicar = mod.publicacao_desempenho(self.registro)[0]
        from pipeline.energia.metricas import previsoes as mprev
        for m in metricas.todas():
            if not m["arquivo"].endswith("/previsoes.py"):
                continue
            self.assertIn(m["publicacao"]["estado"], ("PUBLICADA", "RETIDA"), m["id"])
            if m["id"] in mprev.RETIDAS_SEM_LIBERACAO and not publicar:
                self.assertEqual(m["publicacao"]["estado"], "RETIDA", m["id"])
                self.assertNotEqual(m["gold"], "previsoes_desempenho.json", m["id"])
            if m["publicacao"]["estado"] == "PUBLICADA":
                self.assertEqual(m["gold"], "previsoes_desempenho.json", m["id"])


class Gold(unittest.TestCase):
    """Contrato da gold publicada (quando existir no checkout)."""

    @classmethod
    def setUpClass(cls):
        caminho = os.path.join(base.GOLD, "previsoes_desempenho.json")
        if not os.path.exists(caminho):
            raise unittest.SkipTest("gold ainda não gerada")
        with open(caminho, encoding="utf-8") as f:
            cls.g = json.load(f)

    def test_disponivel_validacoes_e_periodos(self):
        self.assertTrue(self.g["disponivel"])
        self.assertTrue(all(t["resultado"] == "aprovado" for t in self.g["validacoes"]), self.g["validacoes"])
        d = self.g["desempenho"]
        if d["publicado"]:
            self.assertEqual({x["periodo"] for x in d["por_celula"]}, {"teste"})
            self.assertEqual({x["periodo"] for x in d["por_horizonte"]}, {"desenvolvimento", "teste"})

    def test_estado_de_calibracao_segue_a_regra(self):
        for x in self.g["desempenho"].get("por_celula", []):
            esperado = av.calibracao({"cobertura_p10_p90": x["cobertura_p10_p90"], "entregas_com_quantis": x["entregas_com_quantis"]},
                                     g.CALIBRACAO_N_MIN)
            self.assertEqual(x["calibracao"], esperado, (x["modelo"], x["horizonte"], x["submercado"]))

    def test_ganho_e_diferenca_de_maes_pareados(self):
        """Onde o modelo tem previsão em todas as células do B0 (mesmo número de linhas), o
        ganho publicado é a diferença entre os MAE publicados; o intervalo é ordenado."""
        ph = self.g["desempenho"].get("por_horizonte", [])
        for x in ph:
            if x["modelo"] == "B0" or x["ganho_vs_b0"] is None:
                continue
            b0 = next(y for y in ph if y["modelo"] == "B0" and y["horizonte"] == x["horizonte"] and y["periodo"] == x["periodo"])
            if x["linhas"] == b0["linhas"]:
                self.assertAlmostEqual(x["mae_b0_pareado"], b0["mae"], delta=0.011)
                self.assertAlmostEqual(x["ganho_vs_b0"], b0["mae"] - x["mae"], delta=0.021)
            if x["ganho_ic90"] and x["ganho_ic90"][0] is not None:
                self.assertLessEqual(x["ganho_ic90"][0], x["ganho_ic90"][1])

    def test_previsao_atual_sem_faixa_nao_calibrada_e_sem_c2(self):
        at = self.g["previsao_atual"]
        if not at.get("celulas"):
            return
        for c_ in at["celulas"]:
            if c_["quantis"]:
                self.assertEqual(c_["calibracao"], "CALIBRADO")
            if c_["previsao"] is not None:
                lim = c_["limites"]
                self.assertTrue(lim["piso_medio"] - 1e-9 <= c_["previsao"] <= lim["teto_estrutural_medio"] + 1e-9)
        self.assertFalse(at["candidatos"]["emitidos"])
        self.assertFalse(self.g["rotina"]["comprovada"] and self.g["rotina"]["execucoes_agendadas"] < 7)

    def test_csv_de_desempenho_confere_com_a_gold(self):
        """Com a publicação liberada, o CSV do portal confere com a gold; retida, o CSV e o
        JSON internos (data/energia/previsoes/validacao_interna) conferem entre si."""
        if self.g["desempenho"]["publicado"]:
            caminho, por_horizonte = os.path.join(base.SERIES, "previsoes_desempenho.csv"), self.g["desempenho"]["por_horizonte"]
        else:
            caminho = os.path.join(mod.DIR_INTERNO, "previsoes_desempenho.csv")
            interno = os.path.join(mod.DIR_INTERNO, mod.JSON_INTERNO)
            if not (os.path.exists(caminho) and os.path.exists(interno)):
                self.skipTest("resultados retidos ainda não gerados neste checkout (executar_modulo.py previsoes)")
            with open(interno, encoding="utf-8") as f:
                por_horizonte = json.load(f)["desempenho"]["por_horizonte"]
        with open(caminho, encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        self.assertTrue(por_horizonte)
        for x in por_horizonte:
            l_ = next(r for r in linhas if r["recorte"] == "horizonte" and r["modelo"] == x["modelo"] and r["horizonte"] == x["horizonte"]
                      and r["periodo"] == x["periodo"])
            self.assertEqual(int(l_["linhas"]), x["linhas"])
            if x["mae"] is not None:
                self.assertAlmostEqual(float(l_["mae"]), x["mae"], places=2)


def _utc(*a):
    return datetime(*a, tzinfo=timezone.utc)


class GoldRetida(unittest.TestCase):
    """Estado da publicação no portal (o que está em public/energia), com asserções que não
    passam no vazio: sob retenção, nenhum número de desempenho em lugar nenhum do portal."""

    @classmethod
    def setUpClass(cls):
        caminho = os.path.join(base.GOLD, "previsoes_desempenho.json")
        if not os.path.exists(caminho):
            raise unittest.SkipTest("gold ainda não gerada")
        with open(caminho, encoding="utf-8") as f:
            cls.g = json.load(f)
        cls.publicar = mod.publicacao_desempenho(em.le_registro())[0]

    def test_estado_da_gold_segue_o_registro(self):
        self.assertEqual(self.g["publicacao_desempenho"]["publicado"], self.publicar)
        self.assertEqual(self.g["desempenho"]["publicado"], self.publicar)

    def test_retida_sem_numero_de_desempenho_na_gold(self):
        if self.publicar:
            self.skipTest("publicação liberada")
        self.assertEqual(_numeros_de_desempenho(self.g), [])
        for bloco in ("selecao", "regimes", "sensibilidade_latencia", "g23_r1"):
            self.assertIsNone(self.g[bloco], bloco)
        self.assertIsNone(self.g["prospectivo"]["metricas"])
        self.assertTrue(self.g["desempenho"]["calculado"])
        self.assertFalse(any(k.startswith("mae_") for k in self.g["evidencias"]))
        self.assertNotIn("MAE", self.g["proveniencia"]["formula"])      # a proveniência descreve o que é publicado
        self.assertNotEqual(self.g["proveniencia"]["natureza"], "CALCULADO")
        self.assertNotIn("ver calibração em P016", self.g["previsao_atual"].get("bandas", ""))

    def test_retida_sem_csv_do_teste_retrospectivo_no_portal(self):
        if self.publicar:
            self.skipTest("publicação liberada")
        urls = {d["url"] for d in self.g["downloads"]}
        for url in mod.ARQUIVOS_P016:
            self.assertFalse(os.path.exists(os.path.join(base.SERIES, os.path.basename(url))), url)
            self.assertNotIn(url, urls)
            self.assertNotIn(url, mod.REGISTRO["arquivos"])

    def test_particoes_publicadas_sem_numero_de_desempenho(self):
        """Falha se houver cobertura (ou outro número de desempenho) em
        public/energia/series/previsoes_emissoes_*.json com a publicação retida."""
        caminhos = sorted(glob.glob(os.path.join(base.SERIES, "previsoes_emissoes_*.json")))
        self.assertTrue(caminhos)
        versionados = {r["forecast_id"]: r["sha256"] for r in arq.le_tudo()}
        for caminho in caminhos:
            with open(caminho, encoding="utf-8") as f:
                part = json.load(f)
            if not self.publicar:
                self.assertEqual(_numeros_de_desempenho(part), [], caminho)
            for r in part["registros"]:
                self.assertEqual(versionados.get(r["forecast_id"]), r["sha256"], r["forecast_id"])   # projeção, não reescrita

    def test_previsoes_json_sem_numero_de_desempenho(self):
        if self.publicar:
            self.skipTest("publicação liberada")
        for nome in ("previsoes.json", "modelos.json"):
            with open(os.path.join(base.GOLD, nome), encoding="utf-8") as f:
                self.assertEqual(_numeros_de_desempenho(json.load(f)), [], nome)

    def test_numeros_de_p013_com_evidencia_e_proveniencia(self):
        at = self.g["previsao_atual"]
        if not at.get("celulas"):
            self.skipTest("sem rodada da referência experimental")
        self.assertEqual(at["proveniencia"]["natureza"], "PREVISTO")
        for c_ in at["celulas"]:
            if c_["previsao"] is None:
                continue
            e = self.g["evidencias"][c_["evidencia"]]
            self.assertEqual(ev.validar(e), [], c_["forecast_id"])
            self.assertAlmostEqual(e["valor_calculo"], c_["previsao"], places=9)
            self.assertTrue(all(t["resultado"] == "aprovado" for t in e["testes"]), e["testes"])
        pub = at["ja_publicado_no_corte"]
        if pub:
            self.assertEqual(pub["proveniencia"]["natureza"], "OBSERVADO")
            for sm, x in pub["submercados"].items():
                if x["horas"]:
                    e = self.g["evidencias"][x["evidencia"]]
                    self.assertEqual(ev.validar(e), [], sm)
                    self.assertAlmostEqual(e["valor_calculo"], x["media"], delta=0.005)

    def test_csv_de_emissoes_confere_com_as_rodadas_da_gold(self):
        with open(os.path.join(base.SERIES, "previsoes_emissoes.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        por_run = {x["run_id"]: x for x in self.g["prospectivo"]["rodadas"]}
        self.assertTrue(linhas)
        for ln in linhas:
            rd = por_run.get(ln["run_id"])
            if rd is None:
                continue
            self.assertEqual(float(ln["atraso_min"]) if ln["atraso_min"] else None, rd["atraso_min"], ln["forecast_id"])
            self.assertEqual(ln["modo"], rd["modo"], ln["forecast_id"])


class Documento(unittest.TestCase):
    """O documento do módulo confere com a execução que ele descreve. Cada seção numérica
    declara a data do PLD da execução; com dado mais novo (rodada diária) o teste sai como
    pulado com o motivo, para não travar a publicação diária por um texto datado."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(RAIZ, "docs", "observatorios", "energia", "modulos", "previsoes.md"), encoding="utf-8") as f:
            cls.doc = f.read()
        caminho = os.path.join(base.GOLD, "previsoes_desempenho.json")
        cls.g = None
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                cls.g = json.load(f)
        interno = os.path.join(mod.DIR_INTERNO, mod.JSON_INTERNO)
        cls.interno = None
        if os.path.exists(interno):
            with open(interno, encoding="utf-8") as f:
                cls.interno = json.load(f)

    def _mesma_execucao(self):
        if not self.g:
            self.skipTest("gold ainda não gerada")
        m = re.search(r"com o PLD até (\d\d)/(\d\d)/(\d{4})", self.doc)
        self.assertIsNotNone(m, "o documento precisa declarar a data do PLD da execução descrita")
        data = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        if data != self.g["dados"]["ultimo_dia_pld"]:
            self.skipTest(f"documento descreve a execução com PLD até {data}; gold atual até {self.g['dados']['ultimo_dia_pld']}")

    @staticmethod
    def _br(x, casas=0):
        t = f"{x:,.{casas}f}"
        return t.replace(",", "X").replace(".", ",").replace("X", ".")

    def test_estado_de_p016_segue_a_publicacao(self):
        if not self.g:
            self.skipTest("gold ainda não gerada")
        linha = next(ln for ln in self.doc.splitlines() if ln.startswith("| P016"))
        if not self.g["desempenho"]["publicado"]:
            self.assertNotIn("Concluído", linha)
            self.assertIn("Bloqueado", linha)
            self.assertNotIn("Resultados publicados", self.doc)
            self.assertIn("Resultados calculados e retidos", self.doc)

    def test_cobertura_do_b0_no_documento_e_a_da_regra_corrigida(self):
        self._mesma_execucao()
        if not self.interno:
            self.skipTest("resultados retidos ainda não gerados neste checkout")
        ph = self.interno["desempenho"]["por_horizonte"]
        for x in ph:
            if x["modelo"] != "B0" or x["periodo"] != "teste":
                continue
            linha = next(ln for ln in self.doc.splitlines() if ln.startswith(f"| {x['horizonte']} |"))
            self.assertIn(f"{self._br(100 * x['cobertura_p10_p90'], 1)}%", linha, x["horizonte"])
            self.assertIn(self._br(x["mae"], 2), linha, x["horizonte"])

    def test_contagens_do_g23_no_documento_sao_as_do_codigo(self):
        self._mesma_execucao()
        if not self.interno:
            self.skipTest("resultados retidos ainda não gerados neste checkout")
        for x in self.interno["g23_r1"]["fora_da_faixa_antes_da_restricao"]:
            texto = f"{self._br(x['abaixo_do_piso'])} de {self._br(x['previsoes'])}"
            self.assertIn(texto, self.doc, (x["modelo"], x["frequencia"]))
            if x["negativas"]:
                self.assertIn(f"{self._br(x['negativas'])} negativas", self.doc, (x["modelo"], x["frequencia"]))

    def test_primeira_entrega_a_terminar(self):
        if not self.g or not self.g["previsao_atual"].get("celulas"):
            self.skipTest("sem rodada da referência experimental")
        cel = min(self.g["previsao_atual"]["celulas"], key=lambda c_: c_["entrega"]["fim"])
        m = re.search(r"primeira entrega a terminar é (\S+)", self.doc)
        self.assertIsNotNone(m)
        run = self.g["previsao_atual"]["run_id"]
        if run not in self.doc:
            self.skipTest(f"documento descreve outra rodada; atual {run}")
        self.assertEqual(m.group(1).strip(" ,.()"), cel["entrega"]["id"])

    def test_periodo_integrado_de_ear_e_ena(self):
        self._mesma_execucao()
        for campo in ("ultimo_dia_ear", "ultimo_dia_ena"):
            d = date.fromisoformat(self.g["dados"][campo])
            self.assertIn(f"integrado até {d.strftime('%d/%m/%Y')}", self.doc, campo)


class Rotina(unittest.TestCase):
    def test_rotina_so_e_comprovada_com_execucoes_agendadas(self):
        # instantes com fuso: a rotina compara com o prazo das 08h00 de Brasília (11h00 UTC)
        manual = [{"origem": "2026-09-30", "modo": "manual", "no_prazo": False, "falha": False}]
        r = mod._rotina(manual, _utc(2026, 9, 30, 12))
        self.assertFalse(r["comprovada"])
        self.assertEqual(r["execucoes_agendadas"], 0)
        dias = [date(2026, 10, 1) + timedelta(days=i) for i in range(8)]
        ag = [{"origem": d.isoformat(), "modo": "agendada", "no_prazo": True, "falha": False} for d in dias if d != date(2026, 10, 4)]
        r = mod._rotina(ag + manual, _utc(2026, 10, 8, 12))
        self.assertFalse(r["comprovada"])                      # 04/10 sem rodada
        self.assertEqual(r["dias_sem_rodada"], ["2026-10-04"])
        self.assertEqual(r["dias_vencidos_ate"], "2026-10-08")
        ag.append({"origem": "2026-10-04", "modo": "agendada", "no_prazo": False, "falha": False})
        r = mod._rotina(ag, _utc(2026, 10, 8, 12))
        self.assertTrue(r["comprovada"])                       # 7 no prazo, 1 atrasada, nenhum dia faltante
        self.assertEqual(r["atrasadas"], 1)

    def test_dia_ainda_no_prazo_nao_conta_como_faltante(self):
        """Às 07h30 de Brasília de 09/10 (10h30 UTC) a rodada de 09/10 ainda está no prazo:
        não é dia faltante. Às 21h30 de Brasília de 08/10 (00h30 UTC de 09/10) a data UTC já
        é 09/10, mas o último dia vencido continua 08/10."""
        dias = [date(2026, 10, 1) + timedelta(days=i) for i in range(8)]
        ag = [{"origem": d.isoformat(), "modo": "agendada", "no_prazo": True, "falha": False} for d in dias]
        r = mod._rotina(ag, _utc(2026, 10, 9, 10, 30))
        self.assertEqual((r["dias_vencidos_ate"], r["dias_sem_rodada"], r["comprovada"]), ("2026-10-08", [], True))
        self.assertEqual(mod.ultimo_dia_vencido(_utc(2026, 10, 9, 0, 30)), date(2026, 10, 8))
        self.assertEqual(mod.ultimo_dia_vencido(_utc(2026, 10, 9, 11, 0)), date(2026, 10, 9))   # 08h00 em ponto: venceu
        r = mod._rotina(ag, _utc(2026, 10, 9, 11, 5))
        self.assertEqual((r["dias_sem_rodada"], r["comprovada"]), (["2026-10-09"], False))


# ---------------------------------------------------------------- verificação de 01/10/2026

CHAVES_DESEMPENHO = {"mae", "mae_b0_pareado", "vies", "rmse", "ganho_vs_b0", "ganho_ic90", "skill", "perda_quantilica",
                     "cobertura_p10_p90", "cobertura_p05_p95", "largura_p10_p90", "abaixo_p10", "acima_p90",
                     "cobertura_gravada", "cobertura_recalculada"}


def _numeros_de_desempenho(obj, caminho=""):
    """Caminhos de campos de desempenho com valor numérico em qualquer profundidade."""
    out = []
    if isinstance(obj, dict):
        for k, x in obj.items():
            if k in CHAVES_DESEMPENHO and (isinstance(x, (int, float)) and not isinstance(x, bool)
                                           or isinstance(x, list) and any(isinstance(y, (int, float)) for y in x)):
                out.append(f"{caminho}.{k}")
            out.extend(_numeros_de_desempenho(x, f"{caminho}.{k}"))
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            out.extend(_numeros_de_desempenho(x, f"{caminho}[{i}]"))
    return out


def _registro_liberado():
    """Registro de modelos com a liberação simulada (só no teste; o real segue retido)."""
    reg = copy.deepcopy(em.le_registro())
    reg["validacao_observatorio"]["publicar"] = True
    reg["validacao_observatorio"]["decisao_publicacao"] = {"estado": "LIBERADA", "decidido_por": "teste",
                                                           "decidido_em": "2026-10-01", "escopo_decidido": "teste"}
    return reg


class Retencao(unittest.TestCase):
    """Defeito alto da verificação de 01/10/2026: a cobertura do teste retrospectivo, número
    de desempenho retido, era gravada em todo registro novo e publicada na partição mensal."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.pasta = os.path.join(self.tmp, "emissoes")
        self.legado = os.path.join(self.tmp, "arquivo.jsonl")
        shutil.copy(arq.LEGADO, self.legado)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def _emite(self, registro, origem=date(2026, 9, 28)):
        quando = datetime(origem.year, origem.month, origem.day, 10, 30, tzinfo=timezone.utc)
        return em.emitir(_silver(), origem, agora=quando, emitido_em=quando, versao_codigo="teste", pasta=self.pasta,
                         legado=self.legado, lim=_limites(), registro=registro)

    def test_regra_de_publicacao_exige_decisao_com_nome_e_data(self):
        reg = copy.deepcopy(em.le_registro())
        reg["validacao_observatorio"]["publicar"] = True
        reg["validacao_observatorio"]["decisao_publicacao"] = {"estado": "PENDENTE"}
        self.assertEqual(em.publicacao_desempenho(reg)[0], False)        # publicar = true sozinho não libera
        self.assertEqual(em.publicacao_desempenho(_registro_liberado())[0], True)
        self.assertEqual(mod.publicacao_desempenho(reg), em.publicacao_desempenho(reg))   # o módulo delega à mesma regra

    def test_rodada_retida_grava_so_o_estado_de_calibracao(self):
        reg = copy.deepcopy(em.le_registro())
        reg["validacao_observatorio"]["publicar"] = False
        regs = self._emite(reg)
        self.assertEqual(len(regs), 28)
        for r in regs:
            self.assertNotIn("cobertura_p10_p90", r["calibracao"], r["forecast_id"])
            self.assertIn("cobertura_retida", r["calibracao"])
            self.assertIn(r["calibracao"]["status"], ("CALIBRADO", "DESCALIBRADO", "AMOSTRA_INSUFICIENTE", "SEM_AVALIACAO"))
        self.assertEqual(_numeros_de_desempenho(arq.le_tudo(self.pasta, self.legado)), [])

    def test_rodada_liberada_grava_a_cobertura(self):
        regs = self._emite(_registro_liberado())
        self.assertTrue(all("cobertura_p10_p90" in r["calibracao"] and "cobertura_retida" not in r["calibracao"] for r in regs))

    def test_particao_publicada_omite_cobertura_sem_reescrever_o_registro(self):
        """Registro gravado com a cobertura (como a rodada de 30/09/2026): o arquivo
        versionado continua igual, e a partição pública sai sem o número, com o mesmo sha256
        e com a omissão declarada. A comparação com a publicação anterior segue válida."""
        regs = self._emite(_registro_liberado())
        antes = _le(os.path.join(self.pasta, "2026-09.jsonl"))
        series = os.path.join(self.tmp, "series")
        os.makedirs(series)
        with mock.patch.object(em, "publicacao_desempenho", return_value=(False, {"estado": "RETIDA"})):
            prev, _ = gold_modelos.construir(None, pasta=self.pasta, legado=self.legado, destino_series=series)
            publicada = json.loads(_le(os.path.join(series, "previsoes_emissoes_2026-09.json")))
            self.assertEqual(_numeros_de_desempenho(publicada), [])
            self.assertEqual(publicada["projecao"]["campos_omitidos"], ["calibracao.cobertura_p10_p90"])
            self.assertEqual([r["sha256"] for r in publicada["registros"]], [r["sha256"] for r in regs])
            self.assertTrue(all(r["omitido_na_publicacao"] == ["calibracao.cobertura_p10_p90"] for r in publicada["registros"]))
            self.assertEqual(prev["emissoes"]["particoes"][0]["registros_com_campos_omitidos"], 28)
            gold_modelos.construir(None, pasta=self.pasta, legado=self.legado, destino_series=series, escrever_particoes=False)
        self.assertEqual(_le(os.path.join(self.pasta, "2026-09.jsonl")), antes)
        self.assertEqual(arq.valida_particoes(self.pasta, self.legado), [])
        # liberada, a publicação traz o registro inteiro
        with mock.patch.object(em, "publicacao_desempenho", return_value=(True, {"estado": "LIBERADA"})):
            gold_modelos.construir(None, pasta=self.pasta, legado=self.legado, destino_series=series)
            publicada = json.loads(_le(os.path.join(series, "previsoes_emissoes_2026-09.json")))
            self.assertNotIn("projecao", publicada)
            self.assertEqual(publicada["registros"], regs)


class CoberturaNoPiso(unittest.TestCase):
    """A métrica de cobertura declarava um teste da regra inclusiva no piso que não existia."""

    def test_semana_de_04_01_2025_no_piso_conta_como_coberta(self):
        pld = _pld()
        for serie, ref, val in ccee.parse_pld(_texto_gz("pld_horario_2025_01_04_a_10.csv.gz")):
            pld[serie.split(".")[1]].append((ref, val))
        info, lim = _info(pld), _limites()
        origem = date(2024, 12, 31)
        e = cal.entrega(origem, "W1")
        self.assertEqual(e["id"], "W2025-01-04")
        lo, hi, prov, _ = lim.faixa(e, origem)        # despacho de 2025 publicado em 17/12/2024: piso de R$ 58,60
        self.assertFalse(prov)
        self.assertAlmostEqual(lo, 58.60, places=9)
        # simulação declarada: resíduos que levam o P10 abaixo do piso; a restrição o limita ao piso
        q = mp.quantis_finais(lo + 5.0, mp.quantis_residuos([-60.0, -40.0, -20.0, -5.0, 0.0, 5.0, 10.0]), lo, hi)
        self.assertEqual(q["p10"], lo)
        linhas = []
        for sm in cal.SUBMERCADOS:
            y = v.realizado(info, e, sm)                # média por somas acumuladas, como no teste retrospectivo
            self.assertAlmostEqual(y, 58.60, places=9)  # awk: as 168 horas valem 58,60 nos quatro submercados
            self.assertLess(y, q["p10"])                 # pela comparação estrita a semana sairia descoberta (o defeito)
            self.assertTrue(av.dentro(y, q["p10"], q["p90"]))
            self.assertFalse(av.abaixo(y, q["p10"]))
            ln = av.Linha(origem, "W1", sm, e)
            ln.y, ln.prev, ln.q = y, {"B0": lo + 5.0}, {"B0": q}
            linhas.append(ln)
        res = av.resumo(linhas, "B0", "W")
        self.assertEqual((res["cobertura_p10_p90"], res["abaixo_p10"], res["acima_p90"]), (1.0, 0.0, 0.0))
        # um centavo abaixo do piso já é descoberto: a tolerância é ruído binário, não folga
        self.assertFalse(av.dentro(58.59, q["p10"], q["p90"]))


def _silver_por_ano(captura_pld=CAPTURA_SEED):
    """Silver com o recorte do PLD em vintages por ano, com o sha256 do arquivo de teste de
    onde cada ano veio (o pipeline guarda pld_horario_AAAA)."""
    con = base.conecta(":memory:")
    arquivos = {"2024": "pld_horario_2024_10.csv.gz", "2025": "pld_horario_2025_10_2026_08_09.csv.gz",
                "2026": "pld_horario_2025_10_2026_08_09.csv.gz"}
    por_ano = defaultdict(list)
    for sm, ps in _pld().items():
        for r, x in ps:
            por_ano[r[:4]].append((f"pld.{sm}", r, x))
    for ano, obs in sorted(por_ano.items()):
        caminho = os.path.join(DADOS, arquivos[ano])
        with open(caminho, "rb") as f:
            sha = base.sha256_bytes(f.read())
        vid, _ = base.registra_vintage(con, v.DS_PLD, f"pld_horario_{ano}", "https://dadosabertos.ccee.org.br/dataset/pld_horario",
                                       captura_pld, None, sha, 1, "teste", os.path.relpath(caminho, RAIZ))
        base.grava_observacoes(con, v.DS_PLD, vid, obs)
    ear, ena = _hidro()
    for ds, serie, dados in ((v.DS_EAR, v.SERIE_EAR, ear), (v.DS_ENA, v.SERIE_ENA, ena)):
        vid, _ = base.registra_vintage(con, ds, "recorte", "https://dados.ons.org.br", CAPTURA_ONS, None, "b" * 64, 1, "teste", None)
        base.grava_observacoes(con, ds, vid, [(f"{serie}.{sm}", d.isoformat(), x) for sm, dd in dados.items() for d, x in dd.items()])
    con.commit()
    return con


class EvidenciaP013(unittest.TestCase):
    """Os números publicados de P013 (grade B0 e PLD já publicado no corte) não tinham
    evidência nem proveniência própria."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.pasta = os.path.join(self.tmp, "emissoes")
        self.legado = os.path.join(self.tmp, "arquivo.jsonl")
        shutil.copy(arq.LEGADO, self.legado)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_evidencia_da_grade_b0_confere_com_awk(self):
        con = _silver_por_ano()
        quando = _utc(2026, 9, 30, 10, 20)
        regs = em.emitir(con, date(2026, 9, 30), agora=quando, emitido_em=quando, versao_codigo="teste", pasta=self.pasta,
                         legado=self.legado, lim=_limites())
        evs, por_celula = mod._evidencias_b0(con, regs, regs[0]["run_id"], {"divergentes": []}, {"revisoes": None})
        self.assertEqual(len(evs), 8)                                  # 2 frequências × 4 submercados
        self.assertEqual(len(por_celula), 28)                          # toda célula com número aponta para uma evidência
        with open(os.path.join(DADOS, "pld_horario_2025_10_2026_08_09.csv.gz"), "rb") as f:
            sha_2026 = base.sha256_bytes(f.read())
        for sm in cal.SUBMERCADOS:
            w, m = evs[f"b0_semanal_{sm}"], evs[f"b0_mensal_{sm}"]
            self.assertEqual(ev.validar(w), [])
            self.assertAlmostEqual(w["numerador"]["valor"] / w["denominador"]["valor"], SEMANA_0919[sm], places=5)
            self.assertEqual(w["denominador"]["valor"], 168)
            self.assertAlmostEqual(w["valor_calculo"], SEMANA_0919[sm], places=4)
            self.assertAlmostEqual(m["numerador"]["valor"] / m["denominador"]["valor"], AGOSTO_2026[sm], places=5)
            self.assertEqual(m["denominador"]["valor"], 744)
            self.assertEqual((w["periodo"]["inicio"], w["periodo"]["fim"]), ("2026-09-19", "2026-09-25"))
            self.assertTrue(all(t["resultado"] == "aprovado" for t in w["testes"]), w["testes"])
            self.assertEqual({a["sha256"] for a in w["fonte"]["arquivos"]}, {sha_2026})
        # valor arquivado diferente do refeito: a evidência reprova (não confirma por construção)
        adulterado = [dict(r, previsao=r["previsao"] + 0.01) if r["submercado"] == "SE" else r for r in regs]
        evs2, _ = mod._evidencias_b0(con, adulterado, regs[0]["run_id"], {"divergentes": []}, {"revisoes": None})
        self.assertEqual(evs2["b0_semanal_SE"]["testes"][0]["resultado"], "reprovado")
        self.assertEqual(evs2["b0_semanal_S"]["testes"][0]["resultado"], "aprovado")

    def test_pld_ja_publicado_no_corte_com_evidencia(self):
        """Simulação declarada: captura às 09h00 UTC de 27/09 (antes do corte das 10h00 UTC);
        a real é das 15h44. Médias de 27/09, 07h a 23h, por awk sobre o arquivo original."""
        con = _silver_por_ano(captura_pld="2026-09-27T09:00:00Z")
        run = {"cutoff": "2026-09-27T10:00:00Z", "origem": "2026-09-27", "registrado_no_portal_em": "2026-09-27"}
        evs = {}
        out = mod._ja_publicado(con, run, evs)
        awk = {"SE": 72.797647, "S": 72.794118, "NE": 72.795294, "N": 72.799412}
        for sm in cal.SUBMERCADOS:
            x = out["submercados"][sm]
            self.assertEqual((x["horas"], x["primeira"], x["ultima"]), (17, "2026-09-27T07:00", "2026-09-27T23:00"))
            e = evs[x["evidencia"]]
            self.assertEqual(ev.validar(e), [])
            self.assertAlmostEqual(e["valor_calculo"], awk[sm], places=5)
            self.assertEqual(e["denominador"]["valor"], 17)
        # sem captura até o corte não há número nem evidência
        vazio = {}
        out = mod._ja_publicado(_silver_por_ano(), run, vazio)
        self.assertEqual((out["submercados"]["SE"]["horas"], out["submercados"]["SE"]["evidencia"], vazio), (0, None, {}))


class EmissoesCsv(unittest.TestCase):
    def test_atraso_e_modo_do_csv_sao_os_da_rodada(self):
        """Rodada transcrita de 27/09/2026 sem atraso gravado: o CSV traz o mesmo atraso
        derivado e o mesmo modo da gold, com a derivação declarada."""
        registros = arq.le_tudo()
        rodadas = mod._rodadas(registros)
        r27 = next(x for x in rodadas if x["run_id"].startswith("prosp_2026-09-27"))
        self.assertEqual((r27["atraso_min"], r27["atraso_origem"], r27["modo"]),
                         (490.2, mod.ORIGEM_ATRASO_CALCULADO, mod.MODO_TRANSCRITO))   # 19h10m13s − 11h00 UTC
        destino = tempfile.mkdtemp()
        try:
            with mock.patch.object(base, "SERIES", destino):
                mod._escreve_emissoes(registros, [], rodadas)
            with open(os.path.join(destino, "previsoes_emissoes.csv"), encoding="utf-8") as f:
                linhas = list(csv.DictReader(f, delimiter=";"))
        finally:
            shutil.rmtree(destino)
        por_run = {x["run_id"]: x for x in rodadas}
        self.assertEqual(len(linhas), len(registros))
        for ln in linhas:
            rd = por_run[ln["run_id"]]
            self.assertEqual(float(ln["atraso_min"]), rd["atraso_min"], ln["forecast_id"])
            self.assertEqual(ln["modo"], rd["modo"], ln["forecast_id"])

    def test_campos_guardados_no_registro_vao_ao_csv(self):
        """P015 (emissão, entrega, quantis, versão, falha e realizado): o CSV publica, como
        gravados, versão do código, dia de inclusão no arquivo, P10 e P90, alertas, correção e
        encadeamento. Valores conferidos nas linhas de jsonl originais, não na função."""
        registros = arq.le_tudo()
        rodadas = mod._rodadas(registros)
        destino = tempfile.mkdtemp()
        try:
            with mock.patch.object(base, "SERIES", destino):
                mod._escreve_emissoes(registros, [], rodadas)
            with open(os.path.join(destino, "previsoes_emissoes.csv"), encoding="utf-8") as f:
                linhas = {x["forecast_id"]: x for x in csv.DictReader(f, delimiter=";")}
        finally:
            shutil.rmtree(destino)
        # rodada transcrita de 27/09/2026: sem versão do código, incluída no arquivo em 28/09 (depois da emissão)
        t = linhas["prosp_2026-09-27_20260927T191013Z:W1:SE"]
        self.assertEqual((t["versao_codigo"], t["registrado_no_portal_em"], t["p10"], t["p90"], t["anterior"]),
                         ("", "2026-09-28", "", "", ""))
        self.assertEqual((t["status"], t["motivo"], t["alertas"]), ("INDISPONIVEL", "SEM_PLD_CAPTURADO_ATE_O_CORTE", "ATRASADO_APOS_08H"))
        # rodada do observatório de 30/09/2026: versão gravada, sem faixa, encadeada ao registro anterior
        o = linhas["prosp_2026-09-30_20260930T233117Z:W1:SE:B0"]
        self.assertEqual((o["versao_codigo"], o["registrado_no_portal_em"], o["p10"], o["p90"]), ("30ad85ccb171+alterado", "2026-09-30", "", ""))
        self.assertTrue(o["anterior"].startswith("921ad4fc7dc9"), o["anterior"])
        self.assertEqual(sorted(o["alertas"].split(",")), ["ATRASADO_APOS_08H", "CODIGO_NAO_COMMITADO", "EXECUCAO_MANUAL"])
        self.assertEqual(o["substitui"], "")


if __name__ == "__main__":
    unittest.main()
