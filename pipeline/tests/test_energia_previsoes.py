"""Módulo Previsões: calendário do alvo, variáveis sem olhar para o futuro, modelos,
avaliação, arquivo imutável de emissões e governança.

Sem rede. As amostras em pipeline/tests/dados/energia_previsoes/ são recortes reais:
- PLD horário da CCEE, linhas copiadas sem alteração da captura versionada do projeto
  (pipeline/energia/seed/ccee_pld_horario/v20260927T154402Z, capturada em 27/09/2026 15h44
  UTC): outubro de 2024 (formato com aspas, preço alto de seca), outubro de 2025 e
  01/08/2026 a 27/09/2026;
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
import gzip
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, governanca as g, metricas  # noqa: E402
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
        ms = [m for m in metricas.todas() if m["gold"] == "previsoes_desempenho.json"]
        self.assertGreaterEqual(len(ms), 10)


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
        caminho = os.path.join(base.SERIES, "previsoes_desempenho.csv")
        with open(caminho, encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        for x in self.g["desempenho"].get("por_horizonte", []):
            l_ = next(r for r in linhas if r["recorte"] == "horizonte" and r["modelo"] == x["modelo"] and r["horizonte"] == x["horizonte"]
                      and r["periodo"] == x["periodo"])
            self.assertEqual(int(l_["linhas"]), x["linhas"])
            if x["mae"] is not None:
                self.assertAlmostEqual(float(l_["mae"]), x["mae"], places=2)


class Rotina(unittest.TestCase):
    def test_rotina_so_e_comprovada_com_execucoes_agendadas(self):
        manual = [{"origem": "2026-09-30", "modo": "manual", "no_prazo": False, "falha": False}]
        r = mod._rotina(manual, date(2026, 9, 30))
        self.assertFalse(r["comprovada"])
        self.assertEqual(r["execucoes_agendadas"], 0)
        dias = [date(2026, 10, 1) + timedelta(days=i) for i in range(8)]
        ag = [{"origem": d.isoformat(), "modo": "agendada", "no_prazo": True, "falha": False} for d in dias if d != date(2026, 10, 4)]
        r = mod._rotina(ag + manual, date(2026, 10, 8))
        self.assertFalse(r["comprovada"])                      # 04/10 sem rodada
        self.assertEqual(r["dias_sem_rodada"], ["2026-10-04"])
        ag.append({"origem": "2026-10-04", "modo": "agendada", "no_prazo": False, "falha": False})
        r = mod._rotina(ag, date(2026, 10, 8))
        self.assertTrue(r["comprovada"])                       # 7 no prazo, 1 atrasada, nenhum dia faltante
        self.assertEqual(r["atrasadas"], 1)


if __name__ == "__main__":
    unittest.main()
