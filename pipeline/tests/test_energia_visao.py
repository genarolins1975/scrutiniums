"""Testes do módulo Visão geral (P004 a P007), sem rede, com recortes reais em
pipeline/tests/dados/energia_visao/:

* ear_subsistema_2026-09-28.csv: as 4 linhas de 28/09/2026 do arquivo EAR_DIARIO_SUBSISTEMA_2026
  do ONS (cópia de conferência do módulo Água, captura de 30/09/2026 23:51 UTC, sha256 a73378b0...);
* carga_energia_2026_22a28set.csv e carga_energia_2025_22a28set.csv: linhas de 22 a 28/09 dos
  arquivos Carga_Energia do ONS (cópias de conferência do módulo Carga, capturas de 01/10/2026
  00:38 UTC, sha256 45c8cd14... e 18d5f6ad...);
* carga_sin_2022-04_a_2023-06.csv: carga diária do SIN somada dos quatro subsistemas dos
  arquivos Carga_Energia 2022 e 2023 do ONS (mesmas cópias), em torno da quebra de 29/04/2023;
* pld_horario_2026-09-30.csv: as 96 horas de 30/09/2026 do PLD como integradas no silver
  principal (arquivo pld_horario_2026 da CCEE, captura de 30/09/2026 02:20 UTC, sha256 b8fc7539...);
* pld_limites_diario_recorte.csv: linhas reais do CSV publicado pelo módulo PLD (18/04 a
  02/05/2025 e 25/08 a 10/09/2026);
* restricao_eolica_total_2026-08.csv: linhas TOTAL da eólica de ago/2026 do CSV diário publicado
  pelo módulo Geração;
* golds_recorte_2026-10-01.json.gz: recorte das golds publicadas em 30/09 e 01/10/2026 (só os
  campos que a Visão geral lê);
* ear_subsistema_28set_2001a2026.csv: EAR em %, verificada e máxima (MWmês) dos quatro subsistemas
  em 28/09 de cada ano de 2001 a 2026, lida do silver principal (arquivos EAR_DIARIO_SUBSISTEMA_<ano>
  do ONS; a linha de 2026 é a captura de 30/09/2026 02:19 UTC, a mesma que a gold usou);
* ena_subsistema_30d_ate_28set_2001a2026.csv.gz: ENA bruta (MWmed e % da MLT) dos quatro
  subsistemas nos 30 dias terminados em 28/09 de cada ano de 2001 a 2026 (silver principal,
  arquivos ENA_DIARIO_SUBSISTEMA_<ano>, 2026 na captura de 30/09/2026 02:19 UTC);
* agua_sin_diario_2000-12_a_2026-09.csv.gz: somas diárias dos quatro subsistemas (EAR verificada e
  máxima em MWmês, ENA bruta e MLT implícita em MWmed) de 01/12/2000 a 28/09/2026, somadas do silver
  principal por código à parte do módulo (cerca de 140 KB: é o que reproduz 25 anos de distribuição);
* restricao_sin_diaria_total.csv.gz: linhas TOTAL de geracao_restricao_diaria.csv (módulo Geração,
  publicação de 01/10/2026) somadas nas regiões, por fonte e dia;
* series_golds_operacao_recorte.json.gz: geracao.json#serie_sin desde 29/04/2023 e
  carga.json#serie (SIN) desde 01/09/2025, das golds publicadas em 01/10/2026;
* carga_diaria_sin_2023-04_a_2026-09.csv: coluna SIN_calculado de carga_diaria.csv (publicado pelo
  builder de carga.json em 01/10/2026) de 29/04/2023 a 28/09/2026.

As reconciliações releem os arquivos da fonte com código escrito aqui (csv da biblioteca
padrão, somas explícitas) e comparam com números concretos; os testes do motor de estados
usam sequências com resultado calculado à mão. Os números escritos nos testes das regras
(EAR do SIN de 61,647% com 10º, 50º e 90º percentis de 25,53, 49,26 e 67,51; ENA de 30 dias
de 168,62%; frequências de disparo de 23,6% e 26,8% na faixa usual) foram conferidos de forma
independente contra os arquivos do ONS na verificação de 01/10/2026.
"""
import copy
import csv
import gzip
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.gold import sintese as s  # noqa: E402
from pipeline.energia.modulos import visao as v  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_visao")
HOJE = date(2026, 10, 1)


def _csv(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _golds():
    with gzip.open(os.path.join(DADOS, "golds_recorte_2026-10-01.json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)


def _conjuntos(golds):
    out = {}
    for x in golds["publicacao.json"]["conjuntos"]:
        out.setdefault(x["id"].split("/")[-1], x)
    return out


def _rev(serie, ref, de, para, cap="2026-09-30T02:19:46Z"):
    """Revisão no formato que o módulo lê do silver (revisoes_silver)."""
    return {"serie": serie, "ref": ref, "de": de, "para": para, "relativa_pct": 100.0 * abs(para - de) / abs(de),
            "capturado_para": cap}


def _csv_gz(nome):
    with gzip.open(os.path.join(DADOS, nome), "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _ear_28set():
    """{campo: {sm: {dia: valor}}} do recorte de 28/09 de 2001 a 2026."""
    out = {k: {sm: {} for sm in s.SMS} for k in ("ear_pct", "ear_mwmes", "ear_max_mwmes")}
    for x in _csv("ear_subsistema_28set_2001a2026.csv"):
        for k in out:
            out[k][x["sm"]][x["dia"]] = float(x[k])
    return out


def _ena_30d():
    out = {k: {sm: {} for sm in s.SMS} for k in ("ena_bruta_mwmed", "ena_bruta_pct_mlt")}
    for x in _csv_gz("ena_subsistema_30d_ate_28set_2001a2026.csv.gz"):
        for k in out:
            out[k][x["sm"]][x["dia"]] = float(x[k])
    return out


def _series_golds():
    with gzip.open(os.path.join(DADOS, "series_golds_operacao_recorte.json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)


def _resolve(golds, caminho):
    """Leitor independente dos caminhos publicados ("gold#a[CHAVE].b.c"): [X] escolhe o
    elemento da lista cujo sm, par ou id é X."""
    nome, resto = caminho.split("#", 1)
    x = golds[nome]
    for parte in resto.split("."):
        if "[" in parte:
            campo, chave = parte[:-1].split("[")
            x = next(e for e in x[campo] if chave in (e.get("sm"), e.get("par"), e.get("id")))
        else:
            x = x[parte]
    return x


# ---------------------------------------------------------------- reconciliação com a fonte

class ReconciliacaoComAFonte(unittest.TestCase):
    def test_ear_do_sin_refeita_do_arquivo_do_ons(self):
        linhas = _csv("ear_subsistema_2026-09-28.csv")
        self.assertEqual(len(linhas), 4)
        num = sum(float(x["ear_verif_subsistema_mwmes"]) for x in linhas)
        den = sum(float(x["ear_max_subsistema"]) for x in linhas)
        ear = 100 * num / den
        self.assertAlmostEqual(ear, 61.654, places=3)  # 180.071,504 ÷ 292.068,192 MWmês
        g = _golds()
        frase = s.frase("reservatorios", g, {}, HOJE)
        self.assertEqual(frase["valores"]["ear_pct"]["valor"], 61.6)
        self.assertIn("61,6% da energia armazenável máxima", frase["texto"])
        # NE: 68,97% publicado pelo ONS, acima do 90º percentil da data (68,0%) na gold de hidrologia
        ne = next(x for x in linhas if x["id_subsistema"].strip() == "NE")
        self.assertAlmostEqual(float(ne["ear_verif_subsistema_percentual"]), 68.97, places=2)
        sub = next(x for x in g["hidrologia.json"]["subsistemas"] if x["sm"] == "NE")["ear"]
        self.assertEqual((sub["p90"], sub["faixa"]), (68.0, "acima"))

    def test_carga_de_7_dias_refeita_do_arquivo_do_ons(self):
        def media(nome):
            por_dia = {}
            for x in _csv(nome):
                por_dia[x["din_instante"][:10]] = por_dia.get(x["din_instante"][:10], 0.0) + float(x["val_cargaenergiamwmed"])
            self.assertEqual(len(por_dia), 7)
            return sum(por_dia.values()) / 7
        m25, m26 = media("carga_energia_2025_22a28set.csv"), media("carga_energia_2026_22a28set.csv")
        g = _golds()
        u7 = next(x for x in g["carga.json"]["subsistemas"] if x["sm"] == "SIN")["ult7"]
        # 2025: arquivo já consolidado, igual à gold ao arredondamento do MWmed
        self.assertAlmostEqual(m25, 75783.77, places=2)
        self.assertLessEqual(abs(m25 - u7["media_ano_anterior"]), 0.5)
        # 2026: a gold usa a captura de 30/09; o arquivo capturado em 01/10 trouxe revisão do ONS
        # nos dias recentes (83.790,45 contra 83.771 MWmed, 0,023%). Tolerância de 0,05% da média:
        # o ONS consolida a carga dos últimos dias entre publicações.
        self.assertAlmostEqual(m26, 83790.45, places=2)
        self.assertLess(abs(m26 / u7["media"] - 1), 0.0005)
        # a revisão muda o arredondamento da variação exibida: 10,54% (gold) contra 10,57% (01/10)
        self.assertEqual(round(100 * (u7["media"] / u7["media_ano_anterior"] - 1), 1), 10.5)
        self.assertEqual(round(100 * (m26 / m25 - 1), 1), 10.6)
        frase = s.frase("carga", g, {}, HOJE)
        self.assertIn("10,5% acima dos mesmos dias de 2025", frase["texto"])

    def test_pld_medio_amplitude_e_horas_no_piso_refeitos_das_horas(self):
        horas = _csv("pld_horario_2026-09-30.csv")
        self.assertEqual(len(horas), 24)
        medias = {sm: sum(float(h[sm]) for h in horas) / 24 for sm in ("SE", "S", "NE", "N")}
        self.assertAlmostEqual(medias["SE"], 135.2458, places=4)
        self.assertEqual(round(medias["SE"], 2), 135.25)
        self.assertAlmostEqual(max(medias.values()) - min(medias.values()), 10.32, places=2)
        piso = 57.31  # Despacho ANEEL nº 3.850/2025
        no_piso = {sm: sum(1 for h in horas if abs(float(h[sm]) - piso) <= 0.005) for sm in medias}
        self.assertEqual(no_piso, {"SE": 10, "S": 14, "NE": 10, "N": 10})
        g = _golds()
        frase = s.frase("pld", g, {}, HOJE)
        self.assertIn("R$ 135,25/MWh", frase["texto"])
        self.assertIn("R$ 10,32/MWh entre o maior e o menor submercado", frase["texto"])

    def test_taxa_mensal_de_restricao_eolica_refeita_do_csv_diario(self):
        linhas = _csv("restricao_eolica_total_2026-08.csv")
        ng = sum(float(x["energia_nao_gerada_mwh"]) for x in linhas)
        ver = sum(float(x["geracao_verificada_mwh"]) for x in linhas)
        self.assertEqual(len({x["data"] for x in linhas}), 31)
        # geracao_detalhe.json#restricoes.eolica.mensal_sin publica 26,72% para 2026-08 (ago completo)
        self.assertAlmostEqual(100 * ng / (ng + ver), 26.72, delta=0.005)
        # e a função da Visão geral soma as mesmas linhas
        num, den = v._restricao_diaria(linhas, "eolica")
        self.assertAlmostEqual(sum(num.values()), ng, places=3)
        self.assertAlmostEqual(sum(den.values()), ng + ver, places=3)


# ---------------------------------------------------------------- P004: frases

class Frases(unittest.TestCase):
    def setUp(self):
        self.g = _golds()
        self.fr = s.frases(self.g, {"conjuntos": _conjuntos(self.g), "revisoes_refs": {}}, HOJE)

    def test_seis_frases_refeitas_dos_valores_publicados(self):
        self.assertEqual([f["id"] for f in self.fr], ["reservatorios", "afluencias", "carga", "termica", "pld", "rede"])
        for f in self.fr:
            refeita = s.MODELOS[f["modelo"]](copy.deepcopy(f["valores"]))
            self.assertEqual(refeita, f["trechos"], f["id"])
            self.assertEqual(s.texto_de(refeita), f["texto"], f["id"])
            for t in f["trechos"]:
                if t.get("href"):
                    self.assertTrue(t.get("evidencia"), f["id"])

    def test_cada_valor_aponta_para_o_campo_da_gold_de_origem(self):
        conferidos = 0
        for f in self.fr:
            for k, x in f["valores"].items():
                cam = x["caminho"]
                if "(" in cam and not cam.endswith("(módulo)"):
                    continue  # caminho descritivo (janela, sentido): sem campo único
                lido = _resolve(self.g, cam.replace(" (módulo)", ""))
                self.assertEqual(abs(lido) if cam.endswith("(módulo)") else lido, x["valor"], f"{f['id']}.{k}")
                conferidos += 1
        self.assertGreaterEqual(conferidos, 15)

    def test_rede_le_o_sentido_pelo_sinal(self):
        f = next(x for x in self.fr if x["id"] == "rede")
        maior = max(self.g["rede.json"]["fronteiras"], key=lambda x: abs(x["fluxo_media_30d"]))
        self.assertEqual(f["valores"]["par"]["valor"], maior["par"])
        if maior["fluxo_media_30d"] < 0:
            self.assertEqual((f["valores"]["de"]["valor"], f["valores"]["para"]["valor"]), (maior["para"], maior["de"]))
        self.assertNotIn("congestion", f["texto"])

    def test_qualidade_traz_natureza_defasagem_atualidade_e_revisao(self):
        for f in self.fr:
            q = f["qualidade"]
            self.assertIn(q["natureza"], ("OBSERVADO", "CALCULADO", "ESTIMADO"), f["id"])
            self.assertEqual(q["defasagem_dias"], (HOJE - date.fromisoformat(f["ref"])).days, f["id"])
            self.assertEqual(q["atualidade"]["situacao"], "EM DIA", f["id"])
            self.assertTrue(q["revisoes"]["texto"])
        pld = next(x for x in self.fr if x["id"] == "pld")
        self.assertEqual(pld["qualidade"]["defasagem_dias"], 1)

    def test_janela_da_carga_inclui_o_ano_anterior_e_conta_revisoes_nela(self):
        f = next(x for x in self.fr if x["id"] == "carga")
        self.assertEqual(f["qualidade"]["janelas"], [{"inicio": "2026-09-22", "fim": "2026-09-28"}, {"inicio": "2025-09-22", "fim": "2025-09-28"}])
        # revisão real do silver: NE de 26/09/2026 passou de −668,879 para 13.984,70 MWmed
        revs = [_rev("carga_mwmed.NE", "2026-09-26", -668.879, 13984.69575), _rev("carga_mwmed.NE", "2026-09-10", 1000.0, 1000.3)]
        q = s.qualidade_frase("carga", f["valores"], None, None, None, revs, HOJE)
        self.assertEqual(q["revisoes"]["referencias_revisadas_na_janela"], 1)
        self.assertIn("2.190,77%", q["revisoes"]["texto"])
        self.assertEqual(q["revisoes"]["maior"]["serie"], "carga_mwmed.NE")

    def test_frase_sem_dado_nao_e_emitida(self):
        g = copy.deepcopy(self.g)
        next(x for x in g["carga.json"]["subsistemas"] if x["sm"] == "SIN")["ult7"]["variacao_pct"] = None
        g["hidrologia.json"]["disponivel"] = False
        ids = [f["id"] for f in s.frases(g, {}, HOJE)]
        self.assertEqual(ids, ["termica", "pld", "rede"])


class DataDeProcessamento(unittest.TestCase):
    def test_defasagem_sem_o_defeito_do_zero_dias(self):
        # 30/09/2026 02:20 UTC é 29/09/2026 23:20 em Brasília: o PLD de 30/09 já está publicado
        instante = datetime(2026, 9, 30, 2, 20, tzinfo=timezone.utc)
        try:
            from zoneinfo import ZoneInfo
            hoje_br = instante.astimezone(ZoneInfo("America/Sao_Paulo")).date()
        except Exception:
            self.skipTest("sem base de fusos")
        self.assertEqual(hoje_br, date(2026, 9, 29))
        self.assertEqual(s.defasagem_dias("2026-09-30", hoje_br), -1)
        t = s.texto_defasagem("2026-09-30", hoje_br)
        self.assertIn("1 dia depois da data de processamento (29/09/2026)", t)
        self.assertNotIn("0 dias", t)
        self.assertIn("a própria data de processamento", s.texto_defasagem("2026-10-01", HOJE))
        self.assertIn("3 dias antes", s.texto_defasagem("2026-09-28", HOJE))

    def test_regra_de_defasagem_do_pld_usa_a_data_recebida(self):
        g = _golds()
        obs, *_ = v.avaliar_regras(g, {}, _conjuntos(g), date(2026, 9, 29))
        d = next(o for o in obs if o["id"] == "pld_defasagem")
        self.assertEqual((d["defasagem_dias"], d["ativo"]), (-1, False))
        self.assertIn("29/09/2026", d["evidencia"])
        obs, *_ = v.avaliar_regras(g, {}, _conjuntos(g), date(2026, 10, 3))
        d = next(o for o in obs if o["id"] == "pld_defasagem")
        self.assertEqual((d["defasagem_dias"], d["ativo"]), (3, True))


# ---------------------------------------------------------------- P007: máquina de estados

def _serie(cadeia, inicio="2026-01-01"):
    """'TTF-' → [(dia, True), (dia, True), (dia, False), (dia, None)], um dia por caractere."""
    d0 = date.fromisoformat(inicio)
    return [((d0 + timedelta(days=i)).isoformat(), {"T": True, "F": False, "-": None}[ch]) for i, ch in enumerate(cadeia)]


class Estados(unittest.TestCase):
    def test_duracao_minima_e_retorno(self):
        # TT (curta) F TTTT FF T FFF: com duração 3 e retorno 3 há um episódio, do 4º ao 9º dia
        r = s.episodios(_serie("TTFTTTTFFTFFF"), 3, 3)
        self.assertEqual(len(r["episodios"]), 1)
        e = r["episodios"][0]
        self.assertEqual((e["inicio"], e["confirmado_em"], e["fim"], e["normalizado_em"]),
                         ("2026-01-04", "2026-01-06", "2026-01-10", "2026-01-13"))
        self.assertEqual(e["dias_condicao"], 5)
        self.assertEqual([x["dias"] for x in r["sequencias"]], [2, 4, 1])
        self.assertEqual(r["estado"], "normal")
        h = s.resumo_historico(_serie("TTFTTTTFFTFFF"), 3, 3)
        # a sequência de 1 dia (10/01) cai dentro do episódio: não conta como acionamento descartado
        self.assertEqual((h["acionamentos_brutos"], h["acionamentos_curtos_descartados"], h["episodios"]), (3, 1, 1))
        self.assertEqual(h["dias_exibidos"], 7)  # de 06/01 (confirmação) a 12/01 (véspera do retorno)
        self.assertIsNone(h["episodios_por_ano"])  # 13 dias não estimam taxa anual
        self.assertTrue(h["historico_curto"])

    def test_dia_sem_dado_interrompe_a_entrada_e_nao_normaliza(self):
        r = s.episodios(_serie("TT-TTT"), 3, 2)
        self.assertEqual(r["episodios"][0]["inicio"], "2026-01-04")
        r = s.episodios(_serie("TTTF-F-"), 3, 2)
        self.assertEqual(r["estado"], "sem_dado")
        self.assertEqual(r["episodios"][0]["normalizado_em"], "2026-01-06")

    def test_estados_do_ultimo_dia(self):
        self.assertEqual(s.episodios(_serie("FFTT"), 3, 3)["estado"], "em_observacao")
        self.assertEqual(s.episodios(_serie("TTTF"), 3, 3)["estado"], "em_retorno")
        self.assertEqual(s.episodios(_serie("TTTT"), 3, 3)["estado"], "ativo")
        self.assertEqual(s.episodios(_serie("TTT-"), 3, 3)["estado"], "ativo")
        self.assertEqual(s.episodios(_serie("FFF-"), 3, 3)["estado"], "sem_dado")

    def test_sensibilidade_a_duracao(self):
        h = s.resumo_historico(_serie("TFTTFTTTTFFFFFFF"), 3, 3, sensibilidade=(1, 2, 3))
        self.assertEqual([x["episodios"] for x in h["sensibilidade_duracao"]], [1, 1, 1])
        h = s.resumo_historico(_serie("TFFFTTFFFTTTTFFF"), 3, 3, sensibilidade=(1, 2, 3))
        self.assertEqual([x["episodios"] for x in h["sensibilidade_duracao"]], [3, 2, 1])


class RegrasComDadosReais(unittest.TestCase):
    def test_piso_e_teto_no_recorte_do_modulo_pld(self):
        lim = v._limites_linhas(_csv("pld_limites_diario_recorte.csv"))
        piso = s.condicoes_limites(lim, "2025-04-18", "2025-05-02", "piso")
        dias_piso = [d for d, c, _ in piso if c]
        # 18/04/2025: um dia isolado com as 24 horas no piso (acionamento curto); 23 a 25/04: episódio
        self.assertEqual(dias_piso[:4], ["2025-04-18", "2025-04-23", "2025-04-24", "2025-04-25"])
        self.assertEqual(piso[0][2]["submercados"], ["NE", "N"])  # Nordeste e Norte com as 24 horas em R$ 58,60
        r = s.episodios([(d, c) for d, c, _ in piso], 3, 3)
        e = r["episodios"][0]
        self.assertEqual((e["inicio"], e["confirmado_em"], e["fim"], e["normalizado_em"]), ("2025-04-23", "2025-04-25", "2025-04-25", "2025-04-28"))
        teto = s.condicoes_limites(lim, "2026-08-25", "2026-09-10", "teto")
        self.assertEqual([d for d, c, _ in teto if c], ["2026-08-31", "2026-09-01"])
        r = s.episodios([(d, c) for d, c, _ in teto], 1, 7)
        e = r["episodios"][0]
        self.assertEqual((e["inicio"], e["fim"], e["normalizado_em"]), ("2026-08-31", "2026-09-01", "2026-09-08"))
        self.assertEqual(teto[6][2]["horas_no_teto_horario"]["SE"], 1)  # 31/08/2026, uma hora em R$ 1.611,04
        self.assertEqual(teto[6][2]["pld_max_horario"], 1611.04)

    def test_carga_nao_compara_atraves_da_quebra_de_regime(self):
        serie = {x["dia"]: float(x["carga_sin_mwmed"]) for x in _csv("carga_sin_2022-04_a_2023-06.csv")}
        regimes = _golds()["carga.json"]["regimes"]
        cond = {d: c for d, c, _ in s.condicoes_carga(serie, regimes, "2023-04-20", "2023-05-10")}
        self.assertIsNotNone(cond["2023-04-20"])  # 364 dias anteriores dentro de 01/03/2021 a 28/04/2023
        self.assertIsNone(cond["2023-04-29"])     # primeiro dia do regime com MMGD
        self.assertIsNone(cond["2023-05-10"])
        # dia de base incompleta (antes de abril/2022 não está no recorte): não avaliado
        cond = {d: c for d, c, _ in s.condicoes_carga(serie, regimes, "2022-04-30", "2022-04-30")}
        self.assertIsNone(cond["2022-04-30"])

    def test_descolamento_usa_limiar_relativo_e_absoluto(self):
        g = _golds()
        c30 = s.condicoes_descolamento(g["pld.json"]["diario"], "2026-09-30", "2026-09-30")[0]
        self.assertFalse(c30[1])
        self.assertAlmostEqual(c30[2]["amplitude"], 10.32, places=2)
        self.assertAlmostEqual(c30[2]["limiar"], 13.08, places=2)  # 10% de (135,25 + 127,86 + 124,93 + 135,25) ÷ 4
        # perto do piso a diferença absoluta mínima de R$ 5 decide
        dia = [{"d": "2026-01-01", "SE": 57.31, "S": 61.0, "NE": 57.31, "N": 57.31}]
        self.assertFalse(s.condicoes_descolamento(dia, "2026-01-01", "2026-01-01")[0][1])

    def test_janela_movel_exige_365_janelas_no_mesmo_regime(self):
        num = {d: 10.0 for d in s.calendario("2023-01-01", "2024-12-31")}
        den = {d: 100.0 for d in num}
        cond = {d: c for d, c, _ in s.condicoes_janela_movel(num, den, "2024-04-01", "2024-06-30", regime_inicio="2023-04-29")}
        self.assertIsNone(cond["2024-04-01"])        # janelas anteriores atravessam 29/04/2023
        self.assertIs(cond["2024-06-30"], False)     # 365 janelas inteiras no regime, valor constante


class Revisoes(unittest.TestCase):
    def test_materialidade_em_pares_reais_do_silver(self):
        self.assertTrue(v.material("carga_mwmed.NE", -668.879, 13984.69575))     # 26/09/2026: valor fora do domínio corrigido
        self.assertTrue(v.material("ena_bruta_pct_mlt.N", 46.6503, 48.6916))     # 4,38% e 2,04 p.p.
        self.assertFalse(v.material("ear_pct.NE", 69.8332, 69.9687))             # 0,19%: não muda a leitura
        self.assertFalse(v.material("carga.SIN", 90725.95, 91083.13))            # 0,39% numa hora do balanço
        self.assertFalse(v.material("termica.N", 1863.365, 1863.367))            # abaixo do piso de 10 MWmed
        self.assertTrue(v.material("solar.SIN", 1.0, 16.76))                    # perto de zero: conta pelo piso absoluto
        self.assertFalse(v.material("pld.SE", 135.25, 135.25))

    def test_revisoes_lidas_de_um_silver_com_duas_capturas(self):
        con = base.conecta(":memory:")
        for i, cap in enumerate(("2026-09-29T02:42:48Z", "2026-09-30T02:19:48Z")):
            vid, _ = base.registra_vintage(con, "carga_energia_di", "CARGA_ENERGIA_2026", "u", cap, None, "ab"[i] * 64, 1, "coleta_direta", None)
            base.grava_observacoes(con, "carga_energia_di", vid, [("carga_mwmed.NE", "2026-09-26", -668.879 if i == 0 else 13984.69575),
                                                                  ("carga_mwmed.SE", "2026-09-26", 42435.102 if i == 0 else 42435.102)])
        revs, dias = v.revisoes_silver(con, ("carga_energia_di",))
        self.assertEqual(len(revs), 1)
        self.assertEqual((revs[0]["serie"], revs[0]["material"], revs[0]["dia_captura"]), ("carga_mwmed.NE", True, "2026-09-29"))
        self.assertEqual(dias["carga_energia_di"], ["2026-09-29"])
        cond = v.condicao_revisoes(revs, dias, "2026-10-01")
        por_dia = {d: c for d, c, _ in cond}
        self.assertIsNone(por_dia["2026-09-28"])   # antes da primeira captura comparável
        self.assertTrue(por_dia["2026-10-01"])     # captura com revisão material há 2 dias


# ---------------------------------------------------------------- P005 e P006

class Multiplos(unittest.TestCase):
    def setUp(self):
        self.g = _golds()
        self.m = v.multiplos(self.g, HOJE)

    def test_celulas_iguais_as_golds_de_origem(self):
        conferidas, erros = v.confere_multiplos(self.m, self.g)
        self.assertEqual(erros, [])
        self.assertGreater(conferidas, 900)
        linha = {x["d"]: x for x in self.m["dados"]}
        self.assertEqual(linha["2026-09-30"]["preco_SE"], 135.25)
        self.assertEqual(linha["2026-09-28"]["agua_SIN"], 61.65)
        self.assertEqual(linha["2026-09-28"]["carga_SIN"], 88896.0)
        # referência = mesmo dia da semana 364 dias antes: segunda 29/09/2025 (77.549 MWmed), e não
        # o domingo 28/09/2025 (65.828), cuja diferença de 35% seria só de calendário
        self.assertEqual(linha["2026-09-28"]["carga_ano_anterior"], 77549.0)
        self.assertEqual(date(2026, 9, 28).weekday(), date(2025, 9, 29).weekday())
        serie = {x["d"]: x["SIN"] for x in self.g["carga.json"]["serie"]}
        self.assertEqual(serie["2025-09-28"], 65828.0)

    def test_datas_de_referencia_diferentes_ficam_explicitas(self):
        self.assertEqual(self.m["datas_referencia"]["preco"], "2026-09-30")
        self.assertEqual(self.m["datas_referencia"]["agua"], "2026-09-28")
        self.assertIn("preço até 30/09/2026", self.m["aviso_datas"])
        self.assertIn("até 28/09/2026", self.m["aviso_datas"])
        linha = {x["d"]: x for x in self.m["dados"]}
        # depois do último dia da hidrologia a coluna fica vazia (nem zero, nem repetida)
        self.assertIsNone(linha["2026-09-30"]["agua_SIN"])
        self.assertIsNone(linha["2026-09-29"]["carga_SIN"])
        self.assertEqual(len(self.m["dados"]), 90)

    def test_rede_sem_alegacao_de_congestionamento(self):
        rede = next(p for p in self.m["paineis"] if p["id"] == "rede")
        self.assertIn("não indica congestionamento", rede["nota"])
        texto = json.dumps(self.m, ensure_ascii=False)
        self.assertEqual(texto.count("congestionamento"), texto.count("não indica congestionamento"))


class Sociedade(unittest.TestCase):
    def setUp(self):
        self.g = _golds()
        self.soc = v.sociedade(self.g, _conjuntos(self.g), HOJE)
        self.itens = {x["id"]: x for x in self.soc["itens"]}

    def test_quatro_indicadores_com_periodo_proprio(self):
        self.assertEqual(sorted(self.itens), ["beneficios", "continuidade", "perdas", "tarifa"])
        for x in self.itens.values():
            self.assertIs(x["nao_e_situacao_do_dia"], True)
            self.assertTrue(x["cobertura"])
            self.assertTrue(x["href"].startswith("/setor-eletrico/"))
        self.assertEqual(self.itens["tarifa"]["periodo"]["tipo"], "vigencia")
        self.assertEqual((self.itens["continuidade"]["periodo"]["inicio"], self.itens["continuidade"]["periodo"]["fim"]), ("2025-01", "2025-12"))
        self.assertEqual((self.itens["beneficios"]["periodo"]["tipo"], self.itens["beneficios"]["periodo"]["fim"]), ("mensal", "2025-05"))

    def test_valores_iguais_aos_das_evidencias_de_origem(self):
        self.assertEqual(self.itens["tarifa"]["valor"], 821.18)
        self.assertEqual(self.itens["tarifa"]["valor_exibido"], "R$ 0,8212/kWh")
        self.assertEqual(round(self.itens["continuidade"]["evidencia"]["valor_calculo"], 2), self.itens["continuidade"]["valor"])
        self.assertEqual(round(self.itens["perdas"]["evidencia"]["valor_calculo"], 2), self.itens["perdas"]["valor"])
        self.assertEqual(self.itens["beneficios"]["valor"], 17246524.0)

    def test_dec_em_horas_e_minutos_sem_confundir_centesimos(self):
        self.assertEqual(self.itens["continuidade"]["equivalente"], "9 h 20 min")  # 9,334 h; não "9 h 33 min"
        self.assertEqual(v._horas_minutos(10.5), "10 h 30 min")

    def test_fonte_atrasada_aparece_na_defasagem(self):
        b = self.itens["beneficios"]
        self.assertEqual(b["atualidade"]["situacao"], "ATRASADO")
        self.assertEqual(b["defasagem"]["meses"], 17)
        self.assertIn("ATRASADO", b["defasagem"]["texto"])

    def test_indicador_sem_gold_fica_ausente_com_motivo(self):
        g = copy.deepcopy(self.g)
        del g["perdas.json"]
        soc = v.sociedade(g, {}, HOJE)
        self.assertNotIn("perdas", {x["id"] for x in soc["itens"]})
        self.assertEqual(soc["ausentes"], [{"id": "perdas", "motivo": "perdas.json indisponível"}])


# ---------------------------------------------------------------- construção completa

class Construcao(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._gold, self._series = base.GOLD, base.SERIES
        base.GOLD = os.path.join(self.tmp.name, "gold")
        base.SERIES = os.path.join(self.tmp.name, "series")
        os.makedirs(base.SERIES)
        os.makedirs(base.GOLD)
        with open(os.path.join(DADOS, "pld_limites_diario_recorte.csv"), encoding="utf-8") as f, \
                open(os.path.join(base.SERIES, "pld_limites_diario.csv"), "w", encoding="utf-8") as g:
            g.write(f.read())

    def tearDown(self):
        base.GOLD, base.SERIES = self._gold, self._series
        self.tmp.cleanup()

    def test_stub_sem_golds_de_operacao(self):
        g = v.construir(base.conecta(":memory:"), {"hoje": HOJE, "golds": {}})
        self.assertFalse(g["disponivel"])
        self.assertIn("nenhuma gold de operação", g["motivo"])

    def test_gold_completa_a_partir_do_recorte(self):
        con = base.conecta(":memory:")
        g = v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        self.assertTrue(g["disponivel"], g.get("motivo"))
        self.assertEqual(g["data_processamento"], "2026-10-01")
        self.assertEqual(len(g["frases"]), 6)
        self.assertLessEqual(len(g["destaques"]["itens"]), 3)
        for d in g["destaques"]["itens"]:
            self.assertEqual(next(o for o in g["observar"] if o["id"] == d["regra"])["assunto"], "sistema")
        ids = {o["id"] for o in g["observar"]}
        self.assertTrue({"pld_piso", "pld_teto", "pld_defasagem", "atualidade_fontes", "cmo_semana"} <= ids)
        # sem silver principal as regras de EAR, ENA e revisão ficam declaradas como sem dado
        self.assertTrue({"ear_faixa", "ena_faixa", "revisao_material"} <= {x["id"] for x in g["observar_sem_dado"]})
        for o in g["observar"]:
            self.assertTrue(o["condicao"] and o["regra_retorno"] and o["nao_implica"], o["id"])
            if o["tipo"] == "regra":
                self.assertIsNotNone(o["duracao_minima_dias"], o["id"])
                self.assertIn("pct_dias_exibidos", o["historico"], o["id"])
        for t in ("pressiona", "termômetro", "preço de curto prazo", "se compensam no SIN"):
            self.assertNotIn(t, json.dumps(g, ensure_ascii=False))
        self.assertTrue(os.path.exists(os.path.join(base.SERIES, "sintese_multiplos.csv")))

    def test_registro_so_grava_publicacao_aceita(self):
        """O registro dos alertas emitidos vem da gold publicada (aceita pela sentinela), não do
        que a execução construiu: uma gold que vira stub ou não é publicada não conta."""
        con = base.conecta(":memory:")
        n = lambda: con.execute("SELECT COUNT(*) FROM vintages WHERE dataset=?", (v.DS_ALERTAS,)).fetchone()[0]  # noqa: E731
        g1 = v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        self.assertTrue(g1["disponivel"])
        self.assertEqual(n(), 0)  # nada publicado ainda: nada registrado
        # a sentinela rejeitou (gold publicada é um stub): não registra
        base.escreve_gold(v.GOLD, {"disponivel": False, "motivo": "teste"})
        v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        self.assertEqual(n(), 0)
        # a gold g1 foi aceita e publicada: a execução seguinte registra os estados dela, uma vez
        base.escreve_gold(v.GOLD, g1)
        g2 = v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        self.assertEqual(n(), 1)
        cap = con.execute("SELECT capturado_em FROM vintages WHERE dataset=?", (v.DS_ALERTAS,)).fetchone()[0]
        self.assertEqual(cap, g1["processado_em"])
        self.assertTrue(g2["historico_regras"]["registro_publicacoes"]["publicacao_anterior_registrada_nesta_execucao"])
        v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        self.assertEqual(n(), 1)
        reg = next(o for o in g2["observar"] if o["id"] == "pld_piso")["registro_emissoes"]
        self.assertEqual(reg["publicacoes_registradas"], 1)

    def test_origens_dizem_de_onde_veio_cada_gold(self):
        os.makedirs(base.GOLD, exist_ok=True)
        golds = _golds()
        base.escreve_gold("pld.json", golds["pld.json"])                                   # publicado igual ao contexto
        base.escreve_gold("carga.json", {**golds["carga.json"], "gerado_em": "2026-09-01T00:00:00Z"})  # publicado diferente
        base.escreve_gold("perdas.json", golds["perdas.json"])                             # só no disco
        ctx_golds = {k: x for k, x in golds.items() if k != "perdas.json"}
        g = v.construir(base.conecta(":memory:"), {"hoje": HOJE, "golds": ctx_golds, "con_principal": None})
        o = {x["gold"]: x for x in g["origens"]}
        self.assertTrue(o["pld.json"]["igual_ao_publicado"])
        self.assertIn("igual ao arquivo publicado", o["pld.json"]["origem"])
        self.assertFalse(o["carga.json"]["igual_ao_publicado"])
        self.assertIn("arquivo publicado (lido pela Visão geral", o["perdas.json"]["origem"])
        self.assertEqual(o["pld.json"]["lida_em"], g["processado_em"])
        self.assertGreater(o["pld.json"]["idade_horas"], 0)


# ---------------------------------------------------------------- P007: regras de água com recortes reais

def _agua_sin():
    """Série diária do SIN (EAR em % e ENA bruta e % da MLT) a partir das somas do recorte."""
    ear, mw, pct = {}, {}, {}
    for x in _csv_gz("agua_sin_diario_2000-12_a_2026-09.csv.gz"):
        if x["ear_mwmes_sin"] and x["ear_max_mwmes_sin"]:
            ear[x["dia"]] = 100.0 * float(x["ear_mwmes_sin"]) / float(x["ear_max_mwmes_sin"])
        if x["ena_bruta_mwmed_sin"] and x["mlt_mwmed_sin"]:
            mw[x["dia"]] = float(x["ena_bruta_mwmed_sin"])
            pct[x["dia"]] = 100.0 * mw[x["dia"]] / float(x["mlt_mwmed_sin"])
    return ear, mw, pct


class RegrasDeAguaComRecorteReal(unittest.TestCase):
    def test_ear_do_sin_e_faixa_de_28_09_2026(self):
        e = _ear_28set()
        sin = s.ear_sin(e["ear_mwmes"], e["ear_max_mwmes"])
        # razão de somas: 180.052,264 ÷ 292.068,192 MWmês (captura de 30/09 02:19 UTC); a média simples
        # dos quatro percentuais daria 70,37% (prática proibida pela seção 11.6)
        self.assertAlmostEqual(sum(e["ear_mwmes"][sm]["2026-09-28"] for sm in s.SMS), 180052.264, places=3)
        self.assertAlmostEqual(sum(e["ear_max_mwmes"][sm]["2026-09-28"] for sm in s.SMS), 292068.192, places=3)
        self.assertAlmostEqual(sin["2026-09-28"], 61.6473, places=4)
        # faixa da data com os anos de 2001 a 2025 (25 anos): 10º, 50º e 90º percentis
        p10, p50, p90, n = s.bandas_por_ano(sin, [2026])[2026]["09-28"]
        self.assertEqual(n, 25)
        self.assertAlmostEqual(p10, 25.53, places=2)
        self.assertAlmostEqual(p50, 49.26, places=2)
        self.assertAlmostEqual(p90, 67.51, places=2)
        # limiares da regra (5º e 95º percentis)
        p5, _, p95, _ = s.bandas_por_ano(sin, [2026], q=s.Q_EXTREMO)[2026]["09-28"]
        self.assertAlmostEqual(p5, 23.78, places=2)
        self.assertAlmostEqual(p95, 70.65, places=2)
        # a gold de hidrologia publica os mesmos valores com uma casa
        h = next(x for x in _golds()["hidrologia.json"]["subsistemas"] if x["sm"] == "SIN")["ear"]
        self.assertEqual((h["p10"], h["mediana_historica"], h["p90"], h["valor"]), (25.5, 49.3, 67.5, 61.6))

    def test_variante_por_subsistema_dispara_com_um_so_subsistema(self):
        e = _ear_28set()
        ear = {**e["ear_pct"], "SIN": s.ear_sin(e["ear_mwmes"], e["ear_max_mwmes"])}
        dia, cond, det = s.condicoes_ear(ear, "2026-09-28", "2026-09-28", entidades=s.SMS)[0]
        # só o Nordeste (68,92%) passa do 90º percentil da data (67,95%): basta um subsistema
        self.assertIs(cond, True)
        self.assertEqual(det["fora"], ["NE"])
        self.assertAlmostEqual(det["valores"]["NE"]["p_sup"], 67.95, places=2)
        # o SIN fica dentro da faixa usual e da faixa extrema
        self.assertIs(s.condicoes_ear(ear, "2026-09-28", "2026-09-28")[0][1], False)
        self.assertIs(s.condicoes_ear(ear, "2026-09-28", "2026-09-28", q=s.Q_EXTREMO)[0][1], False)

    def test_ena_de_30_dias_do_sin_e_faixa(self):
        e = _ena_30d()
        mw, pct = s.ena_sin(e["ena_bruta_mwmed"], e["ena_bruta_pct_mlt"])
        e30 = s.ena30_serie(mw, pct)
        # Σ ENA bruta de 30 dias ÷ Σ MLT implícita = 1.849.715,012 ÷ 1.096.963,204 (captura de 30/09 02:19 UTC);
        # a média dos quatro percentuais de 30 dias daria 130,11%
        self.assertAlmostEqual(e30["2026-09-28"], 168.6214, places=4)
        self.assertEqual(round(e30["2026-09-28"], 1), next(x for x in _golds()["hidrologia.json"]["subsistemas"] if x["sm"] == "SIN")["ena"]["pct_mlt_30d"])
        self.assertEqual(len(e30), 26)  # uma janela completa por ano, de 2001 a 2026
        _, cond, det = s.condicoes_ena({"SIN": e30}, "2026-09-28", "2026-09-28")[0]
        x = det["valores"]["SIN"]
        self.assertAlmostEqual(x["p_inf"], 56.37, places=2)   # hidrologia.json: 56,4
        self.assertAlmostEqual(x["p_sup"], 128.54, places=2)  # hidrologia.json: 128,5
        self.assertAlmostEqual(x["mediana"], 80.94, places=2)
        _, cond, det = s.condicoes_ena({"SIN": e30}, "2026-09-28", "2026-09-28", q=s.Q_EXTREMO)[0]
        self.assertIs(cond, True)
        self.assertAlmostEqual(det["valores"]["SIN"]["p_inf"], 51.24, places=2)
        self.assertAlmostEqual(det["valores"]["SIN"]["p_sup"], 143.95, places=2)

    def test_janela_de_30_dias_exige_os_30_dias(self):
        e = _ena_30d()
        del e["ena_bruta_mwmed"]["SE"]["2026-09-10"]  # um dia a menos num subsistema: o SIN não tem esse dia
        mw, pct = s.ena_sin(e["ena_bruta_mwmed"], e["ena_bruta_pct_mlt"])
        self.assertNotIn("2026-09-10", mw)
        self.assertNotIn("2026-09-28", s.ena30_serie(mw, pct))  # 29 dias não fazem a janela de 30

    def test_frequencia_de_disparo_no_historico_desde_2021(self):
        ear, mw, pct = _agua_sin()
        e30 = s.ena30_serie(mw, pct)
        self.assertAlmostEqual(ear["2026-09-28"], 61.6473, places=4)
        self.assertAlmostEqual(e30["2026-09-28"], 168.6214, places=4)
        casos = {
            # (regra, quantis): (% dos dias avaliados em alerta, episódios)
            ("ear", s.Q_USUAL): (23.6, 5), ("ear", s.Q_EXTREMO): (15.7, 4),
            ("ena", s.Q_USUAL): (26.8, 15), ("ena", s.Q_EXTREMO): (17.3, 7),
        }
        for (regra, q), (pct_alerta, eps) in casos.items():
            if regra == "ear":
                serie = s.condicoes_ear({"SIN": ear}, "2021-01-01", "2026-09-28", q=q)
            else:
                serie = s.condicoes_ena({"SIN": e30}, "2021-01-01", "2026-09-28", q=q)
            h = s.resumo_historico([(d, c) for d, c, _ in serie], 7, 7)
            self.assertEqual((h["dias_avaliados"], h["pct_dias_exibidos"], h["episodios"]), (2097, pct_alerta, eps), (regra, q))
        # no último dia a ENA está acima do 95º percentil há 6 dias: condição sem a duração mínima
        serie = s.condicoes_ena({"SIN": e30}, "2021-01-01", "2026-09-28", q=s.Q_EXTREMO)
        r = s.episodios([(d, c) for d, c, _ in serie], 7, 7)
        self.assertEqual(r["estado"], "em_observacao")
        self.assertEqual(r["sequencia_atual"], {"inicio": "2026-09-23", "fim": "2026-09-28", "dias": 6})


class RegrasDeOperacaoComRecorteReal(unittest.TestCase):
    def test_termica_compara_com_janelas_de_7_a_371_dias(self):
        sg = _series_golds()
        fontes = ("hidraulica", "termica", "eolica", "solar")
        num = {x["d"]: x["termica"] for x in sg["geracao.json#serie_sin"]}
        den = {x["d"]: sum(x[f] for f in fontes) for x in sg["geracao.json#serie_sin"]}
        _, _, det = s.condicoes_janela_movel(num, den, "2026-09-28", "2026-09-28", regime_inicio="2023-04-29")[0]
        self.assertAlmostEqual(det["valor"], 10.6321, places=4)
        self.assertEqual(det["janelas"], 365)
        # geracao.json#termica_contexto publica 9,2 e 17,4 (10º e 90º percentis) e mediana de 12,4
        self.assertAlmostEqual(det["p_inf"], 9.1657, places=4)
        self.assertAlmostEqual(det["p_sup"], 17.4012, places=4)
        self.assertAlmostEqual(det["p50"], 12.36, places=2)
        _, cond, det = s.condicoes_janela_movel(num, den, "2026-09-28", "2026-09-28", regime_inicio="2023-04-29", q=s.Q_EXTREMO)[0]
        self.assertIs(cond, False)
        self.assertAlmostEqual(det["p_inf"], 8.7882, places=4)
        self.assertAlmostEqual(det["p_sup"], 18.0023, places=4)
        serie = s.condicoes_janela_movel(num, den, "2021-01-01", "2026-09-28", regime_inicio="2023-04-29", q=s.Q_EXTREMO)
        h = s.resumo_historico([(d, c) for d, c, _ in serie], 7, 7)
        self.assertEqual(h["primeiro_dia_avaliado"], "2024-05-10")
        self.assertEqual((h["pct_dias_exibidos"], h["episodios"]), (18.9, 4))
        serie = s.condicoes_janela_movel(num, den, "2021-01-01", "2026-09-28", regime_inicio="2023-04-29")
        h = s.resumo_historico([(d, c) for d, c, _ in serie], 7, 7)
        self.assertEqual((h["pct_dias_exibidos"], h["episodios"]), (25.5, 6))

    def test_carga_extrema_no_dia_usa_o_95_percentil(self):
        sg = _series_golds()
        sc = {x["d"]: x["SIN"] for x in sg["carga.json#serie"] if x["SIN"] is not None}
        regimes = _golds()["carga.json"]["regimes"]
        _, cond, det = s.condicoes_carga(sc, regimes, "2026-09-28", "2026-09-28")[0]
        # 88.896 MWmed contra o 95º percentil dos 364 dias anteriores, 89.143,15 MWmed (o arquivo do ONS dá 89.142,9)
        self.assertEqual(det["valor"], 88896.0)
        self.assertAlmostEqual(det["p95"], 89143.15, places=2)
        self.assertEqual(det["dias_base"], 364)
        self.assertIs(cond, False)

    def test_carga_extrema_com_a_serie_longa_do_modulo_carga(self):
        sc = {x["data"]: float(x["SIN_calculado"]) for x in _csv("carga_diaria_sin_2023-04_a_2026-09.csv") if x["SIN_calculado"]}
        regimes = _golds()["carga.json"]["regimes"]
        _, cond, det = s.condicoes_carga(sc, regimes, "2026-09-28", "2026-09-28")[0]
        # 95º percentil sem o arredondamento da gold: 89.142,93 MWmed (o arquivo do ONS dá 89.142,9)
        self.assertAlmostEqual(det["p95"], 89142.93, places=2)
        self.assertIs(cond, False)
        serie = s.condicoes_carga(sc, regimes, "2021-01-01", "2026-09-28")
        h = s.resumo_historico([(d, c) for d, c, _ in serie], 2, 3)
        # primeiro dia com os 364 dias anteriores no regime com MMGD (desde 29/04/2023)
        self.assertEqual((h["primeiro_dia_avaliado"], h["dias_avaliados"], h["pct_dias_com_condicao"]), ("2024-04-27", 885, 4.5))
        self.assertEqual((h["pct_dias_exibidos"], h["episodios"]), (5.5, 7))
        # o módulo usa a série longa quando o CSV existe e confere com carga.json nos dias comuns
        g = _golds()
        cond, controles, _, ins = v.condicoes_das_regras(g, None, {"carga_diaria": sc})
        self.assertEqual(ins["carga_fonte"], "carga_diaria.csv")
        ctl = next(x for x in controles if x["nome"].startswith("carga_extrema"))
        self.assertEqual(ctl["resultado"], "aprovado", ctl["detalhe"])

    def test_restricao_so_do_lado_de_cima_e_no_95_percentil(self):
        rest = _csv_gz("restricao_sin_diaria_total.csv.gz")
        cond, _, alt, _ = v.condicoes_das_regras({}, None, {"restricoes": rest})
        eol = cond["restricao_eolica"]
        dia, c_, det = eol[-1]
        self.assertEqual(dia, "2026-09-29")
        self.assertAlmostEqual(det["valor"], 21.3908, places=4)
        self.assertAlmostEqual(det["p_sup"], 31.6025, places=4)
        self.assertIs(c_, False)
        # dias com a taxa abaixo do 5º percentil existem e nunca disparam a regra (restrição baixa não é alerta)
        baixos = [x for x in eol if x[2].get("faixa") == "abaixo"]
        self.assertGreater(len(baixos), 10)
        self.assertTrue(all(x[1] is False for x in baixos))
        casos = {"restricao_eolica": ("2022-10-13", 12.2, 11, 26.0, 14), "restricao_solar": ("2025-04-13", 10.5, 3, 23.4, 6)}
        for rid, (primeiro, pct_alerta, eps, pct_p90, eps_p90) in casos.items():
            h = s.resumo_historico([(d, c) for d, c, _ in cond[rid]], 7, 7)
            self.assertEqual((h["primeiro_dia_avaliado"], h["pct_dias_exibidos"], h["episodios"]), (primeiro, pct_alerta, eps), rid)
            aid, _, aserie = alt[rid][0]
            ha = s.resumo_historico([(d, c) for d, c, _ in aserie], 7, 7)
            self.assertEqual((aid, ha["pct_dias_exibidos"], ha["episodios"]), ("p90", pct_p90, eps_p90), rid)


class DestaquesERevisao(unittest.TestCase):
    @staticmethod
    def _obs(rid, pct, estado, inicio, confirmado, ref, primeiro="2021-01-01", dias_av=2097, eps=5):
        dur = (date.fromisoformat(ref) - date.fromisoformat(inicio)).days + 1
        return {"id": rid, "tipo": "regra", "assunto": "sistema", "titulo": f"Regra {rid}", "estado": estado, "referencia": ref,
                "evidencia": "Valor do dia.", "regra_retorno": "Volta ao normal.", "retorno_dias": 7, "hipoteses": [], "nao_implica": "Não implica causa.",
                "href": "/setor-eletrico", "valor": {"valor": 1.0}, "evidencia_numero": {"valor_calculo": 1.0}, "dias_sem_condicao_no_retorno": 2,
                "historico": {"pct_dias_exibidos": pct, "primeiro_dia_avaliado": primeiro, "dias_avaliados": dias_av, "episodios": eps},
                "episodio_atual": {"inicio": inicio, "confirmado_em": confirmado, "fim": ref, "duracao_dias": dur,
                                   "dias_desde_confirmacao": (date.fromisoformat(ref) - date.fromisoformat(confirmado)).days}}

    def test_ordem_pela_raridade_limite_e_novidade(self):
        obs = [self._obs("restricao_solar", 23.4, "em_retorno", "2026-09-17", "2026-09-23", "2026-09-29", "2025-04-13", 535, 6),
               self._obs("ena_faixa", 26.8, "ativo", "2026-09-05", "2026-09-11", "2026-09-28", eps=15),   # confirmado há 17 dias
               self._obs("descolamento", 17.5, "ativo", "2026-09-23", "2026-09-25", "2026-09-30", eps=13),
               self._obs("pld_teto", 6.1, "ativo", "2026-09-20", "2026-09-20", "2026-09-30", eps=5),
               self._obs("termica", 25.5, "ativo", "2026-09-21", "2026-09-27", "2026-09-28", "2024-05-10", 872, 6)]
        d = v.destaques(obs)
        self.assertEqual([x["regra"] for x in d["itens"]], ["pld_teto", "descolamento", "restricao_solar"])
        self.assertEqual([x["regra"] for x in d["outras_regras_em_alerta"]], ["termica", "ena_faixa"])
        self.assertIn("limite de 3", d["outras_regras_em_alerta"][0]["motivo"])
        self.assertIn("há 17 dias", d["outras_regras_em_alerta"][1]["motivo"])
        solar = d["itens"][2]
        # o histórico citado é o avaliável da regra, não o início comum da série
        self.assertIn("No histórico avaliável desde 13/04/2025 (535 dias)", solar["texto"])
        self.assertNotIn("01/01/2021", solar["texto"])
        self.assertIn("o retorno exige 7", solar["texto"])
        self.assertEqual(solar["evidencia_caminho"], "sintese.json#observar[restricao_solar].evidencia_numero")
        self.assertEqual(solar["evidencia"], {"valor_calculo": 1.0})
        self.assertIsNone(d["vazio"])

    def test_novidade_tem_limite_de_14_dias(self):
        self.assertTrue(s.em_destaque("2026-09-30", "2026-09-17"))   # 13 dias depois da confirmação
        self.assertFalse(s.em_destaque("2026-10-01", "2026-09-17"))  # 14 dias
        self.assertTrue(s.em_destaque("2026-12-31", "2026-09-17", None))

    def test_frequencia_conjunta_calculada_a_mao(self):
        a = {f"2026-01-{i:02d}": "2026-01-01" for i in range(1, 21)}  # alerta de 20 dias confirmado em 01/01
        b = {"2026-01-05": "2026-01-05"}
        f = s.frequencia_conjunta({"a": a, "b": b}, "2026-01-01", "2026-01-31")
        # com novidade de 14 dias, a fica na caixa de 01 a 14/01 e b em 05/01 (junto com a)
        self.assertEqual((f["dias"], f["dias_com_destaque"], f["pct_dias_com_destaque"]), (31, 14, 45.2))
        self.assertEqual(f["distribuicao_regras_simultaneas"], [{"regras": 0, "dias": 17}, {"regras": 1, "dias": 13}, {"regras": 2, "dias": 1}])
        f = s.frequencia_conjunta({"a": a, "b": b}, "2026-01-01", "2026-01-31", None)
        self.assertEqual(f["dias_com_destaque"], 20)

    def test_revisao_material_vale_por_7_dias(self):
        cond = {d: c for d, c, _ in s.condicoes_revisao({"2026-09-28": 0, "2026-09-29": 58}, "2026-09-20", "2026-10-10")}
        self.assertIsNone(cond["2026-09-27"])   # antes da primeira captura comparável
        self.assertIs(cond["2026-09-28"], False)
        self.assertTrue(all(cond[f"2026-{m}"] for m in ("09-29", "09-30", "10-01", "10-02", "10-03", "10-04", "10-05")))
        self.assertIs(cond["2026-10-06"], False)  # 7 dias depois da captura
        r = s.episodios(sorted(cond.items()), 1, 1)
        self.assertEqual((r["episodios"][0]["inicio"], r["episodios"][0]["normalizado_em"]), ("2026-09-29", "2026-10-06"))


class RevisoesPorSerieUsada(unittest.TestCase):
    def test_frase_termica_ignora_series_do_balanco_que_nao_usa(self):
        g = _golds()
        f = next(x for x in s.frases(g, {}, HOJE) if x["id"] == "termica")
        # pares reais da captura de 30/09/2026: carga.NE (série que a frase não usa) e eólica do SIN (usada)
        revs = [_rev("carga.NE", "2026-09-26T08:00", 63.185, 13115.052), _rev("eolica.SIN", "2026-09-26T05:00", 542.5, 18429.685),
                _rev("termica.SIN", "2026-09-26T05:00", 9000.0, 9001.0), _rev("termica.NE", "2026-09-25T10:00", 100.0, 200.0)]
        q = s.qualidade_frase("termica", f["valores"], None, None, None, revs, HOJE)["revisoes"]
        self.assertEqual(q["maior"]["serie"], "eolica.SIN")
        self.assertAlmostEqual(q["maior"]["relativa_pct"], 3297.18, places=2)
        self.assertEqual((q["referencias_revisadas_na_janela"], q["pares_serie_referencia"]), (1, 2))  # uma hora, duas séries
        self.assertIn("3.297,18%", q["texto"])
        self.assertNotIn("20.656", q["texto"])

    def test_frase_de_afluencias_ignora_ena_armazenavel(self):
        g = _golds()
        f = next(x for x in s.frases(g, {}, HOJE) if x["id"] == "afluencias")
        revs = [_rev("ena_arm_mwmed.N", "2026-09-27", 1058.118, 1124.242), _rev("ena_bruta_pct_mlt.N", "2026-09-27", 46.9209, 49.8465)]
        q = s.qualidade_frase("afluencias", f["valores"], None, None, None, revs, HOJE)["revisoes"]
        self.assertEqual(q["maior"]["serie"], "ena_bruta_pct_mlt.N")
        self.assertIn("6,24%", q["texto"])  # a ENA armazenável daria 6,25%

    def test_unidade_real_da_serie(self):
        casos = {"ear_mwmes.N": "MWmês", "ear_max_mwmes.SE": "MWmês", "ear_pct.NE": "%", "ena_bruta_pct_mlt.S": "% da MLT",
                 "ena_bruta_mwmed.S": "MWmed", "carga_mwmed.NE": "MWmed", "carga.NE": "MWmed", "fluxo.NE_SE": "MWmed",
                 "pld.SE": "R$/MWh", "cmo_semanal.N": "R$/MWh"}
        for serie, un in casos.items():
            self.assertEqual(v._unidade_serie(serie)[0], un, serie)
        self.assertNotIn("MW", {v._unidade_serie(x)[0] for x in casos})

    def test_regra_conta_so_revisao_de_serie_usada(self):
        revs = [{"material": True, "usada_na_pagina": True, "dia_captura": "2026-09-29"},
                {"material": True, "usada_na_pagina": False, "dia_captura": "2026-09-29"},
                {"material": False, "usada_na_pagina": True, "dia_captura": "2026-09-29"}]
        cond = v.condicao_revisoes(revs, {"x": ["2026-09-28"]}, "2026-10-01")
        por_dia = {d: det for d, _, det in cond}
        self.assertEqual(por_dia["2026-10-01"]["capturas"], {"2026-09-28": 0, "2026-09-29": 1})
        self.assertIn("ena_bruta_pct_mlt.N", v.SERIES_PAGINA)
        self.assertNotIn("ena_arm_mwmed.N", v.SERIES_PAGINA)
        self.assertNotIn("carga.NE", v.SERIES_PAGINA)
        self.assertNotIn("eolica.NE", v.SERIES_PAGINA)


class NuloECamposDoCsv(unittest.TestCase):
    def test_contagem_vazia_no_csv_do_pld_e_ausencia(self):
        linhas = _csv("pld_limites_diario_recorte.csv")
        alvo = [x for x in linhas if x["data"] == "2025-04-23"]
        alvo[0]["horas_no_piso"] = ""
        alvo[1]["horas_no_teto_horario"] = ""
        lim = v._limites_linhas(linhas)
        self.assertIsNone(next(x for x in lim if x["data"] == "2025-04-23" and x["sm"] == alvo[0]["sm"])["horas_no_piso"])
        piso = {d: c for d, c, _ in s.condicoes_limites(lim, "2025-04-22", "2025-04-24", "piso")}
        teto = {d: c for d, c, _ in s.condicoes_limites(lim, "2025-04-22", "2025-04-24", "teto")}
        self.assertIsNone(piso["2025-04-23"])   # sem a contagem não há como dizer se ficou no piso
        self.assertIsNone(teto["2025-04-23"])
        self.assertIs(piso["2025-04-24"], True)

    def test_valor_e_limiares_do_piso_e_do_teto(self):
        lim = v._limites_linhas(_csv("pld_limites_diario_recorte.csv"))
        ult = s.condicoes_limites(lim, "2025-04-23", "2025-04-23", "piso")[0]
        self.assertEqual(v._num_regra("pld_piso", ult), (24, None, 24))
        # 23/04/2025: Nordeste e Norte com as 24 horas no piso, Sudeste/Centro-Oeste com 6 e Sul com 4
        self.assertEqual(v._detalhe_csv("pld_piso", ult[2]), "horas no piso SE:6 S:4 NE:24 N:24; dia inteiro NE N")
        ult = s.condicoes_limites(lim, "2026-08-31", "2026-08-31", "teto")[0]
        self.assertEqual(v._num_regra("pld_teto", ult), (1, None, 0))
        self.assertIn("horas no teto horário SE:1", v._detalhe_csv("pld_teto", ult[2]))


class Ancoras(unittest.TestCase):
    def test_links_apontam_para_ancoras_existentes(self):
        import re
        raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        hrefs = {r["href"] for r in v.REGRAS} | {h["onde_verificar"] for r in v.REGRAS for h in r["hipoteses"]}
        hrefs |= {t["href"] for f in s.frases(_golds(), {}, HOJE) for t in f["trechos"] if t.get("href")}
        verificados = 0
        for h in sorted(x for x in hrefs if "#" in x):
            rota, ancora = h.split("#")
            pagina = os.path.join(raiz, "src", "app", rota.strip("/"), "page.tsx")
            self.assertTrue(os.path.exists(pagina), h)
            with open(pagina, encoding="utf-8") as f:
                texto = f.read()
            self.assertRegex(texto, r'id=\{?"' + re.escape(ancora) + '"', h)
            verificados += 1
        self.assertGreaterEqual(verificados, 8)


class NaturezaEMetricas(unittest.TestCase):
    def test_componentes_estimados_preservados_na_frase(self):
        fr = {f["id"]: f for f in s.frases(_golds(), {}, HOJE)}
        comp = {x["natureza"] for x in fr["carga"]["qualidade"]["componentes_natureza"]}
        self.assertEqual(comp, {"PREVISTO", "ESTIMADO"})
        self.assertEqual([x["natureza"] for x in fr["termica"]["qualidade"]["componentes_natureza"]], ["ESTIMADO"])
        self.assertNotIn("geração verificada", fr["termica"]["texto"])
        self.assertIn("micro e minigeração distribuída estimada", fr["termica"]["texto"])
        self.assertEqual(fr["pld"]["qualidade"]["componentes_natureza"], [])

    def test_natureza_da_fonte_nas_metricas(self):
        from pipeline.energia.metricas import visao as mv
        m = {x["id"]: x for x in mv.METRICAS}
        self.assertEqual(m["visao_regra_restricao"]["natureza_fonte"], "ESTIMADO")
        self.assertEqual({x["natureza"] for x in m["visao_regra_carga_extrema"]["componentes_natureza"]}, {"PREVISTO", "ESTIMADO"})
        self.assertEqual([x["natureza"] for x in m["visao_regra_termica"]["componentes_natureza"]], ["ESTIMADO"])
        self.assertIn("referências distintas", m["visao_revisoes_janela_frase"]["definicao"])
        self.assertIn("visao_frequencia_conjunta_destaques", m)


class DefasagemDaColetaCcee(unittest.TestCase):
    def test_texto_traz_data_da_tentativa_e_bloqueio_registrado(self):
        g = _golds()
        g["pld_detalhe.json"] = {"disponivel": True, "conceito": {"bloqueios": [{
            "fonte": "CCEE: regras de comercialização (módulo Preço de Liquidação das Diferenças) e painéis de preços",
            "evidencia": "HTTP 403 com página \"Acesso bloqueado\" do firewall da origem em 30/09/2026, também para o portal de dados abertos e para o servidor de download"}]}}
        obs, *_ = v.avaliar_regras(g, {}, _conjuntos(g), HOJE)
        d = next(o for o in obs if o["id"] == "pld_defasagem")
        self.assertIn("30/09/2026 às 02:20 UTC, bem-sucedida", d["evidencia"])
        self.assertIn("HTTP 403", d["evidencia"])
        self.assertEqual(d["coleta_direta"]["tentado_em"], "2026-09-30T02:20:15Z")
        self.assertEqual(len(d["bloqueios_registrados"]), 1)


# ---------------------------------------------------------------- construção com silver em memória

REVISAO_N = {  # pares reais da captura de 30/09/2026 02:19 UTC (Norte, 27/09/2026)
    "ena_bruta_mwmed.N": (1060.509, 1126.632), "ena_bruta_pct_mlt.N": (46.9209, 49.8465),
    "ena_arm_mwmed.N": (1058.118, 1124.242), "ena_arm_pct_mlt.N": (46.8152, 49.7407)}


def _silver_agua():
    """Silver principal em memória com os recortes reais de EAR e ENA; o arquivo de ENA de 2026
    entra em duas capturas, com os pares reais de revisão do Norte em 27/09/2026 (dois em séries
    que a página usa, dois na ENA armazenável, que ela não usa)."""
    con = base.conecta(":memory:")
    ear, ena = _ear_28set(), _ena_30d()

    def vintage(ds, rec, cap, linhas):
        sha = hashlib.sha256((rec + cap + repr(sorted(linhas))).encode()).hexdigest()
        vid, _ = base.registra_vintage(con, ds, rec, f"https://ons-aws-prod-opendata.s3.amazonaws.com/{rec}.csv", cap, None, sha,
                                       len(linhas), "coleta_direta", f"bronze/ons/{ds}/{rec}.csv")
        base.grava_observacoes(con, ds, vid, linhas)

    for ano in range(2001, 2027):
        a = str(ano)
        vintage("ear_subsistema_di", f"EAR_DIARIO_SUBSISTEMA_{ano}", "2026-09-30T02:19:44Z",
                [(f"{k}.{sm}", d, x) for k in ear for sm in s.SMS for d, x in ear[k][sm].items() if d[:4] == a])
        linhas = [(f"{k}.{sm}", d, x) for k in ena for sm in s.SMS for d, x in ena[k][sm].items() if d[:4] == a]
        if ano < 2026:
            vintage("ena_subsistema_di", f"ENA_DIARIO_SUBSISTEMA_{ano}", "2026-09-30T02:19:46Z", linhas)
            continue
        antes = {k: de for k, (de, _) in REVISAO_N.items()}
        l1 = [(se, d, antes[se] if d == "2026-09-27" and se in antes else x) for se, d, x in linhas] + \
             [(k, "2026-09-27", antes[k]) for k in ("ena_arm_mwmed.N", "ena_arm_pct_mlt.N")]
        vintage("ena_subsistema_di", "ENA_DIARIO_SUBSISTEMA_2026", "2026-09-29T02:42:43Z", l1)
        l2 = linhas + [(k, "2026-09-27", REVISAO_N[k][1]) for k in ("ena_arm_mwmed.N", "ena_arm_pct_mlt.N")]
        vintage("ena_subsistema_di", "ENA_DIARIO_SUBSISTEMA_2026", "2026-09-30T02:19:46Z", l2)
    # carga de 22 a 28/09/2026 do arquivo Carga_Energia 2026 capturado em 01/10 (revisado pelo ONS
    # depois da captura usada nas golds): o determinante de carga tem de acusar a diferença
    vintage("carga_energia_di", "CARGA_ENERGIA_2026", "2026-10-01T00:38:00Z",
            [(f"carga_mwmed.{x['id_subsistema'].strip()}", x["din_instante"][:10], float(x["val_cargaenergiamwmed"]))
             for x in _csv("carga_energia_2026_22a28set.csv")])
    # arquivos do PLD horário da CCEE (só a vintage: as horas do piso e do teto vêm do CSV do módulo PLD)
    for ano, cap in ((2025, "2026-09-27T21:10:00Z"), (2026, "2026-09-30T02:20:15Z")):
        rec = f"pld_horario_{ano}"
        base.registra_vintage(con, "ccee_pld_horario", rec, f"https://pda-download.ccee.org.br/{rec}.csv", cap, None,
                              hashlib.sha256(rec.encode()).hexdigest(), 1, "coleta_direta", f"bronze/ccee/{rec}.csv")
    con.commit()
    return con


class ConstrucaoComSilver(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls._gold, cls._series = base.GOLD, base.SERIES
        base.GOLD = os.path.join(cls.tmp.name, "gold")
        base.SERIES = os.path.join(cls.tmp.name, "series")
        os.makedirs(base.SERIES)
        os.makedirs(base.GOLD)
        with open(os.path.join(DADOS, "pld_limites_diario_recorte.csv"), encoding="utf-8") as f, \
                open(os.path.join(base.SERIES, "pld_limites_diario.csv"), "w", encoding="utf-8") as g:
            g.write(f.read())
        cls.con_p = _silver_agua()
        cls.g = v.construir(base.conecta(":memory:"), {"hoje": HOJE, "golds": _golds(), "con_principal": cls.con_p})
        cls.obs = {o["id"]: o for o in cls.g["observar"]}
        cls.fr = {f["id"]: f for f in cls.g["frases"]}
        with open(os.path.join(base.SERIES, "sintese_regras_diario.csv"), encoding="utf-8") as f:
            cls.csv_regras = {(x["data"], x["regra"]): x for x in csv.DictReader(f, delimiter=";")}

    @classmethod
    def tearDownClass(cls):
        base.GOLD, base.SERIES = cls._gold, cls._series
        cls.tmp.cleanup()

    def test_silver_em_memoria_tem_os_valores_atuais(self):
        self.assertAlmostEqual(dict(base.serie_vigente(self.con_p, "ena_subsistema_di", "ena_bruta_mwmed.N"))["2026-09-27"], 1126.632, places=6)
        self.assertTrue(self.g["disponivel"], self.g.get("motivo"))

    def test_evidencia_e_csv_da_ear(self):
        o = self.obs["ear_faixa"]
        self.assertEqual(o["estado"], "normal")
        self.assertEqual(o["valor"], {"valor": 61.6473, "limiar_inferior": 23.7837, "limiar_superior": 70.6513})
        e = o["evidencia_numero"]
        self.assertAlmostEqual(e["valor_calculo"], 61.64733748, places=6)
        self.assertEqual((e["numerador"]["valor"], e["denominador"]["valor"]), (180052.264, 292068.192))
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        self.assertEqual([t["resultado"] for t in e["testes"]], ["aprovado", "aprovado"])
        self.assertEqual(len(e["fonte"]["arquivos"]), 26)  # arquivos de 2001 a 2026 (distribuição e dia)
        ln = self.csv_regras[("2026-09-28", "ear_faixa")]
        self.assertEqual((ln["condicao"], ln["valor"], ln["limiar_inferior"], ln["limiar_superior"], ln["detalhe"]),
                         ("0", "61.6473", "23.7837", "70.6513", "SIN:dentro"))
        # a alternativa com os quatro subsistemas dispara no dia (Nordeste acima da faixa usual)
        alt = {a["id"]: a for a in o["alternativas_avaliadas"]}
        self.assertEqual(set(alt), {"faixa_usual_sin", "qualquer_subsistema"})
        self.assertEqual(alt["qualquer_subsistema"]["pct_dias_com_condicao"], 100.0)
        controle = next(x for x in self.g["validacao"] if x["nome"].startswith("ear_faixa: faixa usual"))
        self.assertEqual(controle["resultado"], "aprovado")

    def test_evidencia_e_csv_da_ena(self):
        o = self.obs["ena_faixa"]
        e = o["evidencia_numero"]
        self.assertAlmostEqual(e["valor_calculo"], 168.6214, places=4)
        self.assertEqual((e["numerador"]["valor"], e["denominador"]["valor"]), (1849715.012, 1096963.204))
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        ln = self.csv_regras[("2026-09-28", "ena_faixa")]
        self.assertEqual((ln["condicao"], ln["valor"], ln["limiar_inferior"], ln["limiar_superior"]), ("1", "168.6214", "51.2438", "143.9527"))

    def test_evidencia_do_piso_e_do_teto(self):
        for rid in ("pld_piso", "pld_teto"):
            e = self.obs[rid]["evidencia_numero"]
            self.assertIsNotNone(e, rid)
            self.assertEqual(e["unidade"], "horas")
            self.assertEqual([t["resultado"] for t in e["testes"]], ["aprovado", "aprovado"], rid)
            self.assertTrue(any("horas no" in x for x in e["filtros"]), rid)

    def test_revisao_material_conta_so_series_usadas(self):
        o = self.obs["revisao_material"]
        self.assertEqual(o["estado"], "ativo")
        self.assertEqual(o["valor"]["valor"], 2)  # ENA bruta em MWmed e em % da MLT; a ENA armazenável não conta
        e = o["evidencia_numero"]
        self.assertEqual([t["resultado"] for t in e["testes"]], ["aprovado", "aprovado", "aprovado"])
        with open(os.path.join(base.SERIES, "sintese_revisoes.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        self.assertEqual(len(linhas), 4)
        un = {x["serie"]: (x["unidade"], x["usada_na_pagina"], x["material"]) for x in linhas}
        self.assertEqual(un["ena_bruta_mwmed.N"], ("MWmed", "1", "1"))
        self.assertEqual(un["ena_bruta_pct_mlt.N"], ("% da MLT", "1", "1"))
        self.assertEqual(un["ena_arm_mwmed.N"], ("MWmed", "0", "1"))
        q = self.fr["afluencias"]["qualidade"]["revisoes"]
        self.assertEqual((q["referencias_revisadas_na_janela"], q["pares_serie_referencia"]), (1, 2))
        self.assertEqual(q["maior"]["serie"], "ena_bruta_pct_mlt.N")

    def test_evidencia_das_frases_com_valor_antes_do_arredondamento(self):
        e = self.fr["reservatorios"]["evidencia"]
        self.assertAlmostEqual(e["valor_calculo"], 61.6473, places=4)   # exibido 61,6
        self.assertEqual(e["numerador"]["valor"], 180052.264)
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        self.assertEqual(len(e["fonte"]["arquivos"]), 26)  # a mediana usa os anos de 2001 a 2025
        e = self.fr["afluencias"]["evidencia"]
        self.assertAlmostEqual(e["valor_calculo"], 168.6214, places=4)
        self.assertEqual(e["denominador"]["valor"], 1096963.204)
        for fid in ("reservatorios", "afluencias"):
            self.assertEqual([t["resultado"] for t in self.fr[fid]["evidencia"]["testes"]], ["aprovado", "aprovado"], fid)
        # sem o arquivo do balanço no silver não há como comprovar a térmica: a evidência não é
        # emitida e a ausência vira ressalva na validação (nunca um "aprovado" sem conferência)
        self.assertIsNone(self.fr["termica"]["evidencia"])
        self.assertTrue(any("sha256" in x for x in self.fr["termica"]["evidencia_problemas"]))
        self.assertTrue(any(x["nome"] == "evidência da frase termica" and x["resultado"] == "ressalva" for x in self.g["validacao"]))

    def test_evidencia_dos_determinantes(self):
        pa = {p["id"]: p for p in self.g["multiplos"]["paineis"]}
        # água: mesmo número da frase de reservatórios, refeito das somas em MWmês
        e = pa["agua"]["evidencia"]
        self.assertEqual(pa["agua"]["valor_atual"]["valor_exibido"], "61,6% da EAR máxima")
        self.assertEqual(e["valor_exibido"], "61,6% da EAR máxima")
        self.assertAlmostEqual(e["valor_calculo"], 61.6473, places=4)
        self.assertEqual((e["numerador"]["valor"], e["denominador"]["valor"]), (180052.264, 292068.192))
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        # relido na gold (61,6) e célula do dia no recorte (61,65), iguais na casa exibida
        self.assertEqual([t["resultado"] for t in e["testes"]], ["aprovado", "aprovado"])
        # carga: o arquivo de 01/10 soma 88.914,2006 MWmed em 28/09 (N 9.922,720 + NE 15.075,621 +
        # S 14.915,921 + SE 48.999,938), contra 88.896 da gold (captura de 30/09, com NE 15.064,236 e
        # S 14.909,434): a reconciliação reprova e a validação registra a ressalva, sem esconder o
        # número publicado
        e = pa["carga"]["evidencia"]
        self.assertEqual(e["valor_exibido"], "88.896 MWmed")
        self.assertAlmostEqual(e["valor_calculo"], 88914.2006, places=3)
        self.assertEqual(e["reconciliacao"]["resultado"], "reprovado")
        self.assertTrue(any(x["nome"] == "evidência do determinante carga: conferências" and x["resultado"] == "ressalva" for x in self.g["validacao"]))
        # preço: há a vintage do arquivo, mas não as horas no silver do teste: reconciliação pendente
        e = pa["preco"]["evidencia"]
        self.assertEqual(e["valor_exibido"], "R$ 135,25/MWh")
        self.assertEqual(e["reconciliacao"]["resultado"], "ressalva")
        # rede: sem arquivo no silver não há evidência, e a falta vira ressalva (nunca "aprovado" sem conferência)
        self.assertIsNone(pa["rede"]["evidencia"])
        self.assertTrue(any(x["nome"] == "evidência do determinante rede" for x in self.g["validacao"]))

    def test_atualidade_avalia_os_conjuntos_que_a_pagina_publica(self):
        o = self.obs["atualidade_fontes"]
        self.assertTrue({"ear_subsistema_di", "ena_subsistema_di", "cmo_se", "ccee_pld_horario", "aneel_scs"} <= set(o["conjuntos_avaliados"]))

    def test_frequencia_conjunta_publicada(self):
        f = self.g["destaques"]["frequencia_conjunta"]
        self.assertEqual(f["meta_pct"], 33.3)
        self.assertEqual([x["novidade_dias"] for x in f["sensibilidade_novidade"]], [7, 14, 21, 30, None])
        self.assertIn("ena_faixa", f["regras"])


class ConferenciasDaEvidencia(unittest.TestCase):
    """As conferências da evidência derivam o resultado de uma comparação: alteradas, reprovam."""

    def test_valor_relido_diferente_reprova(self):
        g = _golds()
        f = next(x for x in s.frases(g, {}, HOJE) if x["id"] == "reservatorios")
        self.assertEqual(v.confere_valores_frase(f, g)[0], "aprovado")
        f["valores"]["ear_pct"]["valor"] = 61.7
        res, det = v.confere_valores_frase(f, g)
        self.assertEqual(res, "reprovado")
        self.assertIn("ear_pct", det)
        r = next(x for x in s.frases(g, {}, HOJE) if x["id"] == "rede")
        self.assertEqual(v.confere_valores_frase(r, g)[0], "aprovado")
        r["valores"]["de"]["valor"], r["valores"]["para"]["valor"] = r["valores"]["para"]["valor"], r["valores"]["de"]["valor"]
        self.assertEqual(v.confere_valores_frase(r, g)[0], "reprovado")

    def test_csv_publicado_diferente_reprova(self):
        o = {"id": "pld_teto", "referencia": "2026-09-02", "condicao_no_dia": False, "valor": {"valor": 0.0}, "estado": "em_retorno",
             "duracao_minima_dias": 1, "retorno_dias": 7}
        lim = v._limites_linhas(_csv("pld_limites_diario_recorte.csv"))
        serie = s.condicoes_limites(lim, "2026-08-25", "2026-09-02", "teto")
        csvr = {(d, "pld_teto"): {"condicao": "" if c is None else ("1" if c else "0"), "valor": "0"} for d, c, _ in serie}
        self.assertEqual([t["resultado"] for t in v._testes_csv_regra(o, csvr)], ["aprovado", "aprovado"])
        csvr[("2026-09-02", "pld_teto")]["valor"] = "3"
        csvr[("2026-08-31", "pld_teto")]["condicao"] = "0"
        csvr[("2026-09-01", "pld_teto")]["condicao"] = "0"
        self.assertEqual([t["resultado"] for t in v._testes_csv_regra(o, csvr)], ["reprovado", "reprovado"])


if __name__ == "__main__":
    unittest.main()
