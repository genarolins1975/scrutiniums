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
  campos que a Visão geral lê).

As reconciliações releem os arquivos da fonte com código escrito aqui (csv da biblioteca
padrão, somas explícitas) e comparam com números concretos; os testes do motor de estados
usam sequências com resultado calculado à mão.
"""
import copy
import csv
import gzip
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
        q = s.qualidade_frase("carga", f["valores"], None, None, None, {"2026-09-26": [2190.77], "2026-09-10": [0.03]}, HOJE)
        self.assertEqual(q["revisoes"]["referencias_revisadas_na_janela"], 1)
        self.assertIn("2.190,77%", q["revisoes"]["texto"])

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
        self.assertEqual(linha["2026-09-28"]["carga_ano_anterior"], 65828.0)  # 28/09/2025, mesmo regime

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
        # registro das emissões no silver da família: segunda execução sem mudança não grava estado novo
        n1 = con.execute("SELECT COUNT(*) FROM registros WHERE dataset=?", (v.DS_ALERTAS,)).fetchone()[0]
        v.construir(con, {"hoje": HOJE, "golds": _golds(), "con_principal": None})
        n2 = con.execute("SELECT COUNT(*) FROM registros WHERE dataset=?", (v.DS_ALERTAS,)).fetchone()[0]
        self.assertGreater(n1, 0)
        self.assertEqual(n1, n2)
        self.assertTrue(os.path.exists(os.path.join(base.SERIES, "sintese_multiplos.csv")))


if __name__ == "__main__":
    unittest.main()
