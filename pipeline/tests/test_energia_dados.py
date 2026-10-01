"""Testes do módulo Dados e metodologia (P067 a P070): catálogo recurso a recurso, saúde e
SLA de atualidade, revisões, validador genérico, Parquet equivalente, manifesto e
afirmações de integração.

As amostras em pipeline/tests/dados/energia_dados/ são recortes reais, sem alteração de
valor:

* ckan_amostra.json: conjuntos das listagens package_search do ONS (carga-energia), da
  ANEEL (componentes-tarifarias e o descontinuado projetos-por-tipologia) e da CCEE
  (agente_qtd_contabilizacao e pld_media_diaria) colhidas em 01/10/2026, com campos e
  recursos reduzidos;
* silver_amostra.json: linhas das tabelas vintages e observacoes dos silvers em
  01/10/2026: a carga diária do Nordeste (ONS, CARGA_ENERGIA_2026) de 20 a 28/09/2026 nas
  capturas de 29/09 02:42 UTC e 30/09 02:19 UTC (o dia 26/09 veio −668,879 MWmed na
  primeira e 13.984,69575 MWmed na segunda: revisão real da fonte), a TUSD de aplicação
  da distribuidora de CNPJ 05.965.546/0001-09 em 30/11/2021 nos arquivos anuais 2020 e
  2021 da ANEEL (362,45 e 432,18: dois arquivos diferentes, não uma revisão) e as
  capturas do conjunto agente_qtd_contabilizacao da CCEE feitas pelo módulo Mercado;
* conta_tarifas_b1_vigentes_amostra.csv e empresas_distribuidoras_amostra.csv: linhas
  copiadas de dois CSV publicados (CNPJ com zero à esquerda e células vazias).

Os valores esperados foram lidos das linhas do recorte e escritos aqui como números; os
testes de revisão recalculam o resultado por um caminho independente (dicionário em
Python puro, sem SQL). Sem rede.
"""
import csv
import hashlib
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, catalogo, validacoes as val  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan_dados as ck  # noqa: E402
from pipeline.energia.fontes import publicacao_dados as pub  # noqa: E402
from pipeline.energia.fontes import silver_dados as sd  # noqa: E402
from pipeline.energia.metricas import dados as met  # noqa: E402
from pipeline.energia import metricas  # noqa: E402
from pipeline.energia.modulos import dados  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, "dados", "energia_dados")
RAIZ = os.path.dirname(os.path.dirname(AQUI))
GOLD = os.path.join(RAIZ, "public", "energia", "gold")
SERIES = os.path.join(RAIZ, "public", "energia", "series")


def json_amostra(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8") as f:
        return json.load(f)


def silver_de_amostra(*chaves):
    """Silver em memória com o esquema de base.conecta e as linhas reais da amostra."""
    s = json_amostra("silver_amostra.json")
    con = base.conecta(":memory:")
    for k in chaves:
        for v in s[k]["vintages"]:
            con.execute("INSERT INTO vintages VALUES (?,?,?,?,?,?,?,?,?,?)", v)
        for o in s[k].get("observacoes", []):
            con.execute("INSERT INTO observacoes VALUES (?,?,?,?,?)", o)
        for r in s[k].get("registros", []):
            con.execute("INSERT INTO registros VALUES (?,?,?,?,?)", r)
    con.commit()
    return con


def le_gold(nome):
    with open(os.path.join(GOLD, nome), encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- revisões


class TestRevisoes(unittest.TestCase):
    """Revisão = mesmo arquivo, captura seguinte, valor diferente (seção 11.6)."""

    def test_revisao_real_da_carga_do_nordeste(self):
        con = silver_de_amostra("carga_energia_di")
        rv = sd.revisoes(con, "carga_energia_di")
        # caminho independente: valores por (série, ref, recurso) em ordem de captura
        s = json_amostra("silver_amostra.json")["carga_energia_di"]
        cap = {v[0]: v[4] for v in s["vintages"]}
        por_chave = {}
        for _, serie, ref, valor, vid in sorted(s["observacoes"], key=lambda o: (o[1], o[2], cap[o[4]])):
            por_chave.setdefault((serie, ref), []).append(valor)
        mudaram = {k: v for k, v in por_chave.items() if len(v) > 1 and abs(v[-1] - v[0]) > 1e-9}
        self.assertEqual(rv["observacoes_revisadas"], len(mudaram))
        # 20 a 26/09 mudaram; 27 e 28/09 só existem na segunda captura (referências novas)
        self.assertEqual(rv["observacoes_revisadas"], 7)
        self.assertEqual(rv["referencias_revisadas"], 7)  # uma só série: cada par é um dia distinto
        self.assertEqual(rv["series_afetadas"], 1)
        self.assertEqual((rv["ref_min"], rv["ref_max"]), ("2026-09-20", "2026-09-26"))
        m = rv["maior_abs"]
        self.assertEqual((m["serie"], m["ref"]), ("carga_mwmed.NE", "2026-09-26"))
        self.assertAlmostEqual(m["de"], -668.879, places=6)
        self.assertAlmostEqual(m["para"], 13984.69575, places=6)
        self.assertEqual((m["capturado_de"], m["capturado_para"]), ("2026-09-29T02:42:48Z", "2026-09-30T02:19:48Z"))
        self.assertAlmostEqual(m["delta"], 14653.57475, places=5)
        # relativa = |Δ| ÷ |anterior| = 14.653,57475 ÷ 668,879
        self.assertAlmostEqual(100 * m["relativa"], 2190.7662, places=3)
        self.assertEqual(rv["por_captura"], {"2026-09-30": 7})
        self.assertEqual(rv["conflitos_entre_recursos"], 0)

    def test_arquivos_anuais_sobrepostos_nao_sao_revisao(self):
        con = silver_de_amostra("aneel_componentes_tarifarias_b1")
        rv = sd.revisoes(con, "aneel_componentes_tarifarias_b1")
        self.assertEqual(rv["eventos"], 0)
        self.assertIsNone(rv["maior_abs"])
        self.assertEqual(rv["conflitos_entre_recursos"], 2)
        ex = {e["serie"]: e["valores"] for e in rv["exemplos_conflito"]}
        self.assertEqual(ex["TA.TUSD.05965546000109"],
                         {"componentes-tarifarias-2020.parquet": 362.45, "componentes-tarifarias-2021.parquet": 432.18})

    def test_resumo_publicado_separa_conflito(self):
        con = silver_de_amostra("aneel_componentes_tarifarias_b1")
        an = {"revisoes": sd.revisoes(con, "aneel_componentes_tarifarias_b1"), "revisoes_registros": None}
        r = dados._resumo_revisao(an)
        self.assertNotIn("eventos", r)
        self.assertEqual(r["conflitos_entre_recursos"]["referencias"], 2)

    def test_observacoes_e_referencias_revisadas_sao_contagens_diferentes(self):
        # 25 e 26/09/2026: as quatro séries da carga diária mudaram entre as capturas de 29 e
        # 30/09 (recontado no energia.db: 33 pares em 17 dias no conjunto inteiro). No recorte,
        # 8 pares (série, referência) em 2 referências; a do Norte em 24/09 não mudou.
        con = silver_de_amostra("carga_energia_di_4sub")
        rv = sd.revisoes(con, "carga_energia_di")
        self.assertEqual((rv["observacoes_revisadas"], rv["referencias_revisadas"], rv["series_afetadas"]), (8, 2, 4))
        self.assertEqual((rv["ref_min"], rv["ref_max"]), ("2026-09-25", "2026-09-26"))
        r = dados._resumo_revisao({"revisoes": rv, "revisoes_registros": None})
        self.assertEqual((r["observacoes"], r["referencias"]), (8, 2))

    def test_ausencia_numa_captura_nao_e_revisao(self):
        # 27 e 28/09 existem só na segunda captura: entraram como referências novas, não como revisão
        con = silver_de_amostra("carga_energia_di")
        rv = sd.revisoes(con, "carga_energia_di")
        self.assertFalse(any(e["ref"] in ("2026-09-27", "2026-09-28") for e in rv["maiores"]))


class TestRevisoesRegistros(unittest.TestCase):
    """Cadastros e atos: mudança só entre capturas do mesmo arquivo (mesma regra das
    observações); arquivos diferentes são conflito entre recursos."""

    def test_arquivos_anuais_que_divergem_sao_conflito_e_nao_mudanca(self):
        # aneel_manifestacoes: a distribuidora de CNPJ 01.543.032/0001-04 é 'Enel GO' no arquivo
        # de 2023 e 'Equatorial GO' no de 2024 (mudança societária entre edições, não revisão)
        con = silver_de_amostra("aneel_manifestacoes")
        rr = sd.revisoes_registros(con, "aneel_manifestacoes")
        self.assertEqual(rr["mudancas"], 0)
        self.assertEqual(rr["por_captura"], {})
        self.assertEqual((rr["conflitos_entre_recursos"], rr["chaves_em_conflito"]), (1, 1))
        self.assertEqual(rr["exemplos_conflito"][0], {"chave": "dist:01543032000104", "campo": "sigla",
                                                      "valores": {"manif-2023": "Enel GO", "manif-2024": "Equatorial GO"}})
        r = dados._resumo_revisao({"revisoes": None, "revisoes_registros": rr})
        self.assertNotIn("mudancas", r["registros"])
        self.assertEqual(r["registros"]["conflitos_entre_recursos"]["campos"], 1)

    def test_mesmo_arquivo_reeditado_e_mudanca_e_data_de_geracao_e_metadado(self):
        # agentes-setor-eletrico da ANEEL, edições de 01/09 e 01/10/2026 capturadas em 01/10:
        # o nome do CNPJ 02.341.470/0001-44 mudou; gerado_em mudou porque o arquivo é outro
        con = silver_de_amostra("aneel_agentes_mercado")
        rr = sd.revisoes_registros(con, "aneel_agentes_mercado")
        self.assertEqual((rr["mudancas"], rr["chaves_afetadas"], rr["campos"]), (1, 1, {"nome": 1}))
        self.assertEqual(rr["metadado_do_arquivo"], 1)
        self.assertEqual(rr["por_captura"], {"2026-10-01": 1})
        self.assertEqual(rr["conflitos_entre_recursos"], 0)
        self.assertNotIn("gerado_em", rr["campos"])


# ---------------------------------------------------------------- completude e grão


class TestCompletude(unittest.TestCase):
    def test_lacuna_real_no_recorte(self):
        con = silver_de_amostra("carga_energia_di")
        c = sd.completude(con, "carga_energia_di", hoje=date(2026, 10, 1))
        g = c["grupos"][0]
        self.assertEqual((g["formato"], g["passo"], g["granularidade"]), ("diaria", 1, "diária"))
        # 9 dias de 20 a 28/09, todos presentes: completude 1
        self.assertEqual(g["refs_esperadas"], 9)
        self.assertEqual(g["completude_interna"], 1.0)
        self.assertEqual(g["ref_max_ate_hoje"], "2026-09-28")
        # sem o dia 24 a série tem lacuna interna: 8 ÷ 9
        con.execute("DELETE FROM observacoes WHERE ref='2026-09-24'")
        g2 = sd.completude(con, "carga_energia_di", hoje=date(2026, 10, 1))["grupos"][0]
        self.assertEqual(g2["refs_presentes"], 8)
        self.assertAlmostEqual(g2["completude_interna"], 8 / 9, places=6)
        self.assertEqual(g2["series_com_lacuna"], 1)

    def test_referencia_futura_nao_e_ultimo_periodo_disponivel(self):
        con = silver_de_amostra("carga_energia_di")
        c = sd.completude(con, "carga_energia_di", hoje=date(2026, 9, 25))
        self.assertEqual(c["grupos"][0]["ref_max_ate_hoje"], "2026-09-25")

    def test_cobertura_no_ultimo_periodo_ate_hoje_e_nao_na_referencia_futura(self):
        # continuidade da ANEEL: os limites regulatórios vão até 2032; o realizado, até 2026
        # (recorte com 2 séries realizadas e 1 limite). Na maior referência (2032) só o limite
        # tem valor: contar ali dava 1 série e sugeria colapso de cobertura.
        con = silver_de_amostra("aneel_continuidade")
        g = sd.completude(con, "aneel_continuidade", hoje=date(2026, 10, 1))["grupos"][0]
        self.assertEqual((g["formato"], g["ref_max"], g["ref_max_ate_hoje"]), ("anual", "2032", "2026"))
        self.assertEqual((g["ultimo_periodo"], g["series_no_ultimo"]), ("2026", 3))
        self.assertEqual((g["periodo_anterior"], g["series_no_anterior"]), ("2025", 3))


# ---------------------------------------------------------------- SLA de atualidade


def analise(formato, passo, ref, aderencia=1.0, pub_fonte=None, coletas=None):
    return {"observacoes": {"principal": formato, "grupos": [{"formato": formato, "passo": passo, "aderencia_passo": aderencia,
                                                              "ref_max_ate_hoje": ref}]},
            "vintages": {"ultima_publicacao_fonte": pub_fonte}, "coletas": coletas or {}}


def freq(texto, ref_pub=None):
    cad, sem = ck.frequencias_canonicas(texto, ref_pub)
    return {"declarada": texto, "cadencias": cad, "sem_sla": sem}


class TestAtualidade(unittest.TestCase):
    def test_frequencias_declaradas_reais(self):
        self.assertEqual(ck.frequencias_canonicas("Diariamento, as 12h e 19h"), (["diaria"], False))
        self.assertEqual(ck.frequencias_canonicas("Mensal e diária"), (["diaria", "mensal"], False))
        self.assertEqual(ck.frequencias_canonicas("Sob demanda"), ([], True))
        self.assertEqual(ck.frequencias_canonicas("Conforme envios dos agentes"), ([], True))
        self.assertEqual(ck.frequencias_canonicas("A depender da ocorrência."), ([], True))
        self.assertEqual(ck.frequencias_canonicas("Periódica"), ([], True))
        self.assertEqual(ck.frequencias_canonicas("Mensal", "Todos os dias"), (["diaria", "mensal"], False))

    def test_caso_a_ear_diaria(self):
        an = analise("diaria", 1, "2026-09-28")
        a = dados.atualidade(an, freq("Diariamento, as 12h e 19h"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["cadencia"], a["prazo_proximo"], a["situacao"]), ("A", "diaria", "2026-10-01", "EM DIA"))
        a = dados.atualidade(an, freq("Diariamento, as 12h e 19h"), date(2026, 10, 3), False)
        self.assertEqual((a["situacao"], a["dias_atraso"]), ("ATRASADO", 2))

    def test_caso_c_grao_mensal_com_rotina_diaria_do_ons(self):
        # ATLS: série mensal, o ONS declara o horário da rotina do portal
        an = analise("mensal", 1, "2026-07")
        a = dados.atualidade(an, freq("Diariamento, as 12h e 19h"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["cadencia"]), ("C", "mensal"))
        self.assertEqual(a["prazo_proximo"], "2026-10-30")  # fim de agosto + 60 dias
        self.assertEqual(a["situacao"], "EM DIA")

    def test_caso_b_publicacao_em_lotes(self):
        an = analise("diaria", 1, "2026-08-31")
        a = dados.atualidade(an, freq("Mensal"), date(2026, 10, 1), False)
        # fim do último período (31/08) + um período mensal (31 dias) + tolerância mensal (60 dias)
        self.assertEqual((a["caso"], a["cadencia"], a["prazo_proximo"]), ("B", "mensal", "2026-11-30"))

    def test_caso_d_data_da_fonte_que_nao_acompanha_o_conteudo(self):
        # desligamento compulsório da CCEE: arquivo traz 2026-09 com last_modified de 08/05/2026
        an = analise("mensal", 2, "2026-09", aderencia=0.2, pub_fonte="2026-05-08T10:00:00")
        a = dados.atualidade(an, freq("Mensal"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["base"], a["publicacao_nao_acompanha_conteudo"]), ("D", "periodo_de_referencia", True))
        self.assertEqual((a["prazo_proximo"], a["situacao"]), ("2026-12-30", "EM DIA"))
        # cadastro sem período: vale a data da fonte (17/09 + 31 + 60)
        a = dados.atualidade({"observacoes": None, "vintages": {"ultima_publicacao_fonte": "2026-09-17T08:00:00"}, "coletas": {}},
                             freq("Mensal"), date(2026, 10, 1), False)
        self.assertEqual((a["base"], a["prazo_proximo"]), ("publicacao_da_fonte", "2026-12-17"))

    def test_sem_frequencia_e_sem_data(self):
        a = dados.atualidade(analise("anual", 1, "2025"), freq(None), date(2026, 10, 1), False)
        self.assertEqual(a["situacao"], "SEM SLA")
        a = dados.atualidade({"observacoes": None, "vintages": {}, "coletas": {}}, freq("Anual"), date(2026, 10, 1), False)
        self.assertEqual(a["situacao"], "SEM DADO")
        a = dados.atualidade(analise("diaria", 1, "2020-01-01"), freq("Diária"), date(2026, 10, 1), True)
        self.assertEqual(a["situacao"], "SEM SLA")  # descontinuado: não há atualização a esperar

    def test_caso_e_cadencia_da_aneel_mais_curta_que_o_grao_anual(self):
        # continuidade da ANEEL: arquivo de grão anual, 'Frequência de atualização' = 'Mensal',
        # última modificação informada 05/09/2026 05:27 UTC. Antes, o caso C dava prazo
        # 30/12/2028 (fim de 2027 + 365 dias) com o ano corrente parcial como último período.
        an = analise("anual", 1, "2026", pub_fonte="2026-09-05T05:27:08")
        f = {**freq("Mensal"), "campo": "Frequência de atualização"}
        a = dados.atualidade(an, f, date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["cadencia"], a["base"]), ("E", "mensal", "publicacao_da_fonte"))
        self.assertEqual(a["prazo_proximo"], "2026-12-05")  # 05/09 + 31 + 60 dias
        self.assertTrue(a["periodo_parcial"])
        self.assertEqual(dados.atualidade(an, f, date(2026, 12, 6), False)["situacao"], "ATRASADO")
        # sem data de publicação, não há como medir a promessa: SEM DADO, nunca o prazo do grão
        a = dados.atualidade(analise("anual", 1, "2026"), f, date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["situacao"], a.get("prazo_proximo")), ("E", "SEM DADO", None))
        # liberação comercial (Quinzenal) e audiências (Trimestral): datas da listagem de 01/10/2026
        a = dados.atualidade(analise("anual", 1, "2026", pub_fonte="2026-09-18T20:07:07"), freq("Quinzenal"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["prazo_proximo"]), ("E", "2026-10-18"))
        a = dados.atualidade(analise("anual", 1, "2026", pub_fonte="2026-07-22T16:59:53"), freq("Trimestral"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["prazo_proximo"]), ("E", "2027-01-20"))  # 22/07 + 92 + 90 dias

    def test_caso_c_so_para_a_rotina_do_portal(self):
        self.assertTrue(dados.rotina_do_portal({"campo": "Schedule de Atualização", "declarada": "Diariamento, as 12h e 19h"}))
        self.assertTrue(dados.rotina_do_portal({"declarada": "Diariamento, as 12h e 19h"}))
        self.assertFalse(dados.rotina_do_portal({"campo": "Frequência de atualização", "declarada": "Mensal"}))
        self.assertFalse(dados.rotina_do_portal({"campo": "Frequencial de atualização", "declarada": "Quinzenal"}))

    def test_periodo_corrente_parcial_nao_alonga_o_prazo(self):
        # série anual com cadência anual declarada e o ano corrente já no arquivo: o prazo é o
        # fim de 2026 + 365 dias (31/12/2027), e não o fim de 2027 + 365 (30/12/2028)
        a = dados.atualidade(analise("anual", 1, "2026"), freq("Anual"), date(2026, 10, 1), False)
        self.assertEqual((a["caso"], a["periodo_parcial"], a["prazo_proximo"]), ("A", True, "2027-12-31"))
        # mensal com o mês corrente: prazo = fim de outubro + 60 dias
        a = dados.atualidade(analise("mensal", 1, "2026-10"), freq("Mensal"), date(2026, 10, 1), False)
        self.assertEqual((a["periodo_parcial"], a["prazo_proximo"]), (True, "2026-12-30"))
        # período já encerrado não é parcial
        a = dados.atualidade(analise("mensal", 1, "2026-09"), freq("Mensal"), date(2026, 10, 1), False)
        self.assertIsNone(a["periodo_parcial"])
        self.assertEqual(a["prazo_proximo"], "2026-12-30")

    def test_prazo_refeito_por_outra_implementacao(self):
        # a conferência da ficha conjuntos_atrasados refaz o prazo com aritmética de calendário
        # própria; aqui ela é posta contra datas escritas à mão em cada caso
        regras = {k: {"tolerancia_dias": dados.TOLERANCIA_DIAS[k], "periodo_dias_aprox": dados.PERIODO_DIAS[k]}
                  for k in dados.TOLERANCIA_DIAS}
        casos = [(analise("diaria", 1, "2026-09-28"), freq("Diariamento, as 12h e 19h"), "2026-10-01"),
                 (analise("mensal", 1, "2026-07"), freq("Diariamento, as 12h e 19h"), "2026-10-30"),
                 (analise("diaria", 1, "2026-08-31"), freq("Mensal"), "2026-11-30"),
                 (analise("anual", 1, "2026"), freq("Anual"), "2027-12-31"),
                 (analise("anual", 1, "2026", pub_fonte="2026-09-05T05:27:08"), freq("Mensal"), "2026-12-05"),
                 (analise("mensal", 2, "2026-09", aderencia=0.2, pub_fonte="2026-05-08T10:00:00"), freq("Mensal"), "2026-12-30")]
        for an, f, esperado in casos:
            a = dados.atualidade(an, f, date(2026, 10, 1), False)
            x = {"atualidade": a, "_an": an, "capturas": {"ultima_publicacao_fonte": an["vintages"]["ultima_publicacao_fonte"]}}
            self.assertEqual(a["prazo_proximo"], esperado, (a["caso"], f["declarada"]))
            self.assertEqual(dados.prazo_independente(x, regras, date(2026, 10, 1)), esperado, (a["caso"], f["declarada"]))

    def test_falha_simulada_no_silver_nao_renova_a_data_do_dado(self):
        # silver real da carga diária do Nordeste; depois da última captura (30/09 02:19 UTC)
        # registra-se uma falha de coleta. O último período, a última captura e o prazo não mudam.
        con = silver_de_amostra("carga_energia_di")
        f = freq("Diariamento, as 12h e 19h")
        antes = sd.analisa(con, "carga_energia_di", bronze=False, hoje=date(2026, 10, 1))
        a0 = dados.atualidade(antes, f, date(2026, 10, 1), False)
        base.registra_coleta(con, "carga_energia_di", "CARGA_ENERGIA_2026", False, "HTTP 503 Service Unavailable")
        con.commit()
        depois = sd.analisa(con, "carga_energia_di", bronze=False, hoje=date(2026, 10, 1))
        a1 = dados.atualidade(depois, f, date(2026, 10, 1), False)
        self.assertEqual(depois["coletas"]["falhas"], 1)
        self.assertEqual(a1["ultimo_periodo"], "2026-09-28")
        self.assertEqual((a1["ultimo_periodo"], a1["prazo_proximo"]), (a0["ultimo_periodo"], a0["prazo_proximo"]))
        self.assertEqual(depois["vintages"]["ultima_captura"], "2026-09-30T02:19:48Z")
        # em 03/10 o dia 29/09 já devia ter chegado: atrasado, e a causa é a falha registrada
        a2 = dados.atualidade(depois, f, date(2026, 10, 3), False)
        self.assertEqual((a2["situacao"], a2["ultimo_periodo"]), ("ATRASADO", "2026-09-28"))
        self.assertIn("HTTP 503", a2["causa"])

    def test_falha_de_coleta_nao_renova_a_data_do_dado(self):
        coletas = {"ultimo_ok": "2026-09-20T03:00:00Z",
                   "ultima_falha": {"tentado_em": "2026-09-30T03:00:00Z", "detalhe": "HTTP 503", "recurso": "X"}}
        an = analise("diaria", 1, "2026-09-19", coletas=coletas)
        a = dados.atualidade(an, freq("Diária"), date(2026, 10, 1), False)
        self.assertEqual(a["ultimo_periodo"], "2026-09-19")
        # o dia 20/09 devia chegar até 22/09 (tolerância diária de 2 dias): 9 dias de atraso em 01/10
        self.assertEqual((a["prazo_proximo"], a["situacao"], a["dias_atraso"]), ("2026-09-22", "ATRASADO", 9))
        self.assertIn("HTTP 503", a["causa"])


class TestPeriodoNoOriginal(unittest.TestCase):
    """O último período dos conjuntos com falha de coleta é conferido no ARQUIVO ORIGINAL do
    bronze (sha256 e texto do período), não no silver."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.orig = os.path.join(self.tmp, "consumo_classe_agente_2026.csv.gz")
        shutil.copy(os.path.join(DADOS, "ccee_consumo_classe_agente_2026_original.csv.gz"), self.orig)
        s = json_amostra("silver_amostra.json")["ccee_consumo_classe_agente"]
        self.db = os.path.join(self.tmp, "mercado.db")
        self.con = base.conecta(self.db)
        v = list(s["vintages"][0])
        v[9] = self.orig  # caminho do original copiado do bronze
        self.con.execute("INSERT INTO vintages VALUES (?,?,?,?,?,?,?,?,?,?)", v)
        for o in s["observacoes"]:
            self.con.execute("INSERT INTO observacoes VALUES (?,?,?,?,?)", o)
        self.con.commit()
        self._abre = sd.abre
        import sqlite3
        sd.abre = lambda familia: sqlite3.connect(self.db)  # a função fecha a conexão que recebe

    def tearDown(self):
        sd.abre = self._abre
        self.con.close()
        shutil.rmtree(self.tmp)

    def test_periodo_escrito_no_original_com_sha256_conferido(self):
        # o CSV da CCEE escreve o mês como 202607 (MES_REFERENCIA)
        r = dados.periodo_no_original("mercado", "ccee_consumo_classe_agente", "mensal", "2026-07")
        self.assertEqual((r["resultado"], r["forma"]), ("no_original", "202607"))
        self.assertEqual(r["capturado_em"], "2026-10-01T00:45:34Z")

    def test_periodo_ausente_e_original_alterado_sao_acusados(self):
        self.con.execute("UPDATE observacoes SET ref='2026-08'")
        self.con.commit()
        r = dados.periodo_no_original("mercado", "ccee_consumo_classe_agente", "mensal", "2026-08")
        self.assertEqual(r["resultado"], "nao_encontrado")  # o arquivo não traz agosto
        self.con.execute("UPDATE observacoes SET ref='2026-07'")
        self.con.execute("UPDATE vintages SET sha256=?", ("0" * 64,))
        self.con.commit()
        r = dados.periodo_no_original("mercado", "ccee_consumo_classe_agente", "mensal", "2026-07")
        self.assertEqual(r["resultado"], "sha256_divergente")

    def test_formas_do_periodo(self):
        self.assertEqual(dados.formas_do_periodo("2026-07", "mensal"), ["2026-07", "202607", "07/2026", "2026/07"])
        self.assertIn("30/09/2026", dados.formas_do_periodo("2026-09-30", "diaria"))
        self.assertEqual(dados.formas_do_periodo("2026", "anual"), [])


# ---------------------------------------------------------------- catálogo recurso a recurso


class TestCatalogo(unittest.TestCase):
    def setUp(self):
        self.amostra = json_amostra("ckan_amostra.json")
        s = json_amostra("silver_amostra.json")
        self.capturas = {}
        for v in s["ccee_agente_qtd_contabilizacao_vintages"] + s["carga_energia_di"]["vintages"]:
            fam = "mercado" if v[1].startswith("ccee") else "energia"
            self.capturas.setdefault(catalogo.normaliza_url(v[3]), []).append(
                {"familia": fam, "dataset": v[1], "recurso": v[2], "capturas": 1, "ultima": v[4]})

    def test_ccee_recurso_a_recurso_herda_o_estado_da_integracao(self):
        pkg = self.amostra["CCEE"][0]
        rec = catalogo.recursos_do_conjunto("CCEE", pkg, integ_estados={("mercado", "ccee_agente_qtd_contabilizacao"): "PUBLICADO"},
                                            capturas=self.capturas, verificacao=None, registrados={})
        self.assertEqual(len(rec), 4)
        self.assertEqual({x["estado"] for x in rec}, {"PUBLICADO"})
        self.assertEqual(catalogo.resumo_recursos(rec), {"total": 4, "por_estado": {"PUBLICADO": 4}, "acessados": 4,
                                                         "ultimo_publicado": "2026-09-01"})

    def test_captura_por_dataset_nao_declarado_e_so_recurso_verificado(self):
        pkg = self.amostra["CCEE"][0]
        rec = catalogo.recursos_do_conjunto("CCEE", pkg, integ_estados={}, capturas=self.capturas, verificacao=None, registrados={})
        self.assertEqual({x["estado"] for x in rec}, {"RECURSO VERIFICADO"})

    def test_captura_por_dataset_de_outro_conjunto_nao_herda_o_estado(self):
        # o dataset que capturou os arquivos está PUBLICADO, mas declarado para outro conjunto
        # (como o dicionário de dados do ONS baixado pela integração de hidrologia e lido também
        # como recurso de ear-diario-por-subsistema): o recurso fica em RECURSO VERIFICADO
        pkg = self.amostra["CCEE"][0]
        integ = {("mercado", "ccee_agente_qtd_contabilizacao"): "PUBLICADO"}
        por_integracao = {("CCEE", "lista_agente_associado"): [{"familia": "mercado", "dataset_silver": "ccee_agente_qtd_contabilizacao"}]}
        filtrado = catalogo.estados_declarados_do_conjunto(integ, por_integracao, "CCEE", pkg["name"])
        self.assertEqual(filtrado, {})
        rec = catalogo.recursos_do_conjunto("CCEE", pkg, integ_estados=filtrado, capturas=self.capturas, verificacao=None,
                                            registrados={})
        self.assertEqual({x["estado"] for x in rec}, {"RECURSO VERIFICADO"})
        self.assertTrue(all("não declarado para o conjunto" in x["via"] for x in rec))
        # declarado para o próprio conjunto: herda
        por_integracao[("CCEE", pkg["name"])] = [{"familia": "mercado", "dataset_silver": "ccee_agente_qtd_contabilizacao"}]
        filtrado = catalogo.estados_declarados_do_conjunto(integ, por_integracao, "CCEE", pkg["name"])
        rec = catalogo.recursos_do_conjunto("CCEE", pkg, integ_estados=filtrado, capturas=self.capturas, verificacao=None,
                                            registrados={})
        self.assertEqual({x["estado"] for x in rec}, {"PUBLICADO"})

    def test_recurso_sem_acesso_fica_catalogado_e_removido_e_marcado(self):
        pkg = self.amostra["CCEE"][1]  # pld_media_diaria: nenhum arquivo capturado nesta amostra
        registrados = {"pld_media_diaria/recurso-que-sumiu": {"nome": "pld_media_diaria_2020", "presente": "0", "formato": "CSV"}}
        rec = catalogo.recursos_do_conjunto("CCEE", pkg, integ_estados={}, capturas=self.capturas, verificacao=None,
                                            registrados=registrados)
        self.assertEqual(sum(1 for x in rec if x["presente"]), 6)
        self.assertEqual({x["estado"] for x in rec if x["presente"]}, {"CATALOGADO"})
        removidos = [x for x in rec if not x["presente"]]
        self.assertEqual([x["recurso"] for x in removidos], ["pld_media_diaria_2020"])
        self.assertEqual(catalogo.resumo_recursos(rec)["removidos"], 1)

    def test_ons_url_casa_com_a_captura(self):
        pkg = self.amostra["ONS"][0]
        rec = catalogo.recursos_do_conjunto("ONS", pkg, integ_estados={("energia", "carga_energia_di"): "PUBLICADO"},
                                            capturas=self.capturas, verificacao=None, registrados={})
        csv_2026 = [x for x in rec if x["recurso"] == "Carga_Energia-2026" and x["formato"] == "CSV"][0]
        self.assertEqual((csv_2026["estado"], csv_2026["capturas"]), ("PUBLICADO", 2))
        parquet_2026 = [x for x in rec if x["recurso"] == "Carga_Energia-2026" and x["formato"] == "PARQUET"][0]
        self.assertEqual(parquet_2026["estado"], "CATALOGADO")  # o pipeline lê o CSV, não o Parquet

    def test_normaliza_url(self):
        a = "https://dadosabertos.aneel.gov.br/dataset/x/resource/y/download/Dicion%C3%A1rio%20de%20dados.pdf"
        b = "HTTPS://DadosAbertos.aneel.gov.br/dataset/x/resource/y/download/Dicionário de dados.pdf/"
        self.assertEqual(catalogo.normaliza_url(a), catalogo.normaliza_url(b))

    def test_escada_sem_salto(self):
        et = {"catalogado": {"ok": True}, "recurso_verificado": {"ok": True}, "integrado": {"ok": True},
              "validado": {"ok": False}, "publicado": {"ok": True}}
        self.assertEqual(catalogo.estado_por_etapas(et), "INTEGRADO")
        self.assertEqual(len(catalogo.saltos(et)), 1)
        self.assertEqual(catalogo.estado_por_etapas({"catalogado": {"ok": False}}), "CATALOGADO")

    def test_descontinuacao_declarada_pela_fonte(self):
        d = ck.descontinuacao(self.amostra["ANEEL"][1])
        self.assertEqual(d["motivo"], "situação declarada pela fonte")
        self.assertIsNone(ck.descontinuacao(self.amostra["ANEEL"][0]))

    def test_papel_separado_do_estado(self):
        self.assertEqual(catalogo.papel("UTILIZADO EM INDICADOR"), "indicador")
        self.assertEqual(catalogo.papel("UTILIZADO EM MODELO"), "modelo")
        self.assertEqual(catalogo.papel("DESCONTINUADO"), "historico")
        # PLD, EAR e ENA: indicador publicado; os modelos que os usam estão no registro com o seu estado
        for chave in (("CCEE", "pld_horario"), ("ONS", "ear-diario-por-subsistema"), ("ONS", "ena-diario-por-subsistema")):
            self.assertEqual(catalogo.INTEGRADOS[chave]["estado"], "UTILIZADO EM INDICADOR")
            self.assertTrue(catalogo.INTEGRADOS[chave]["modelos"])

    def test_seeds_da_ccee_genericos(self):
        seeds = ck.seeds_ccee()
        pastas = {p for p, _, _ in seeds}
        self.assertIn("ccee_pld_horario", pastas)
        self.assertIn("ccee_documentos", pastas)
        self.assertTrue(all(a.startswith("package_show") and a.endswith(".json") for _, _, a in seeds))
        pkgs = catalogo.pacotes_seed_ccee()
        nomes = [p["name"] for p in pkgs]
        self.assertEqual(len(nomes), len(set(nomes)))  # uma entrada por conjunto, a versão mais recente


# ---------------------------------------------------------------- validador genérico


class TestValidador(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmp, "public", "energia", "series"))

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def escreve(self, nome, texto):
        p = os.path.join(self.tmp, nome)
        with open(p, "w", encoding="utf-8") as f:
            f.write(texto)
        return p

    def test_gold_com_nan_e_link_quebrado_reprovada(self):
        p = self.escreve("x.json", '{"dominio": "energia", "disponivel": true, "gerado_em": "2026-10-01T00:00:00Z", "v": NaN}')
        chk = val.valida_gold("x.json", p, self.tmp, hoje=date(2026, 10, 1))
        self.assertEqual(val.veredito(chk), "reprovado")
        p = self.escreve("y.json", json.dumps({"dominio": "energia", "disponivel": True, "gerado_em": "2026-10-01T00:00:00Z",
                                               "download": "/energia/series/nao_existe.csv"}))
        chk = {c["tipo"]: c["resultado"] for c in val.valida_gold("y.json", p, self.tmp, hoje=date(2026, 10, 1))}
        self.assertEqual(chk["downloads"], "reprovado")

    def test_csv_torto_e_ausencia_textual_reprovados(self):
        p = self.escreve("a.csv", "data;valor\n2026-01-01;1.5\n2026-01-02;nan\n2026-01-03\n")
        chk = {c["id"].split(":")[-1]: c["resultado"] for c in val.valida_csv(p, "/energia/series/a.csv", hoje=date(2026, 10, 1))}
        self.assertEqual(chk["colunas"], "reprovado")
        self.assertEqual(chk["ausencia"], "reprovado")
        self.assertEqual(chk["dicionario"], "ressalva")

    def test_csv_duplicado_chave_e_data_futura_com_ressalva(self):
        p = self.escreve("b.csv", "data;valor\n2026-01-01;1\n2026-01-01;1\n2026-01-02;2\n2026-01-02;3\n2027-01-01;4\n")
        chk = {c["id"].split(":")[-1]: c for c in val.valida_csv(p, "/energia/series/b.csv", dicionario={"/energia/series/b.csv"},
                                                                hoje=date(2026, 10, 1))}
        self.assertEqual(chk["duplicadas"]["problemas"], 1)
        self.assertEqual(chk["chave"]["problemas"], 1)
        self.assertEqual(chk["datas_futuras"]["resultado"], "ressalva")
        self.assertEqual(chk["dicionario"]["resultado"], "aprovado")

    def test_csv_real_aprovado(self):
        chk = val.valida_csv(os.path.join(DADOS, "conta_tarifas_b1_vigentes_amostra.csv"), "/x.csv", dicionario={"/x.csv"},
                             hoje=date(2026, 10, 1))
        self.assertEqual(val.veredito(chk), "aprovado")

    def test_identidade_de_soma_da_plataforma(self):
        p = self.escreve(os.path.join("public", "energia", "series", "carga_diaria.csv"),
                         "data;SE;S;NE;N;SIN_calculado\n2026-09-26;40000.001;12000.002;13984.696;7000.004;72984.703\n"
                         "2026-09-27;40000.001;12000.002;13984.696;7000.004;72985.703\n")
        ident = next(i for i in val.IDENTIDADES if i["id"] == "carga_diaria_sin")
        r = val.valida_identidade(ident, os.path.dirname(p))
        self.assertEqual((r["resultado"], r["verificados"], r["problemas"]), ("reprovado", 2, 1))

    def test_veredito_e_pior_resultado(self):
        c = [val.checagem("a", "x", "t", "aprovado", "", criterio=""), val.checagem("b", "x", "t", "nao_aplicavel", "", criterio="")]
        self.assertEqual(val.veredito(c), "aprovado")
        c.append(val.checagem("c", "x", "t", "ressalva", "", criterio=""))
        self.assertEqual(val.veredito(c), "ressalva")
        self.assertEqual(val.veredito([val.checagem("d", "x", "t", "nao_aplicavel", "", criterio="")]), "nao_aplicavel")

    def test_situacao_da_validacao_separada_da_natureza(self):
        t = ev.teste("a", "aprovado", "")
        self.assertEqual(dados.situacao_validacao({"testes": [t], "reconciliacao": None}), "controles_aprovados")
        self.assertEqual(dados.situacao_validacao({"testes": [t], "reconciliacao": ev.reconciliacao("x", "aprovado", "1 MWh")}),
                         "reconciliacao_aprovada")
        self.assertEqual(dados.situacao_validacao({"testes": [ev.teste("b", "reprovado", "")], "reconciliacao": None}), "divergencia")
        self.assertEqual(dados.situacao_validacao({"testes": [], "reconciliacao": None}), "pendencia")

    def test_natureza_nao_e_herdada_de_proveniencia_acima_na_arvore(self):
        # estrutura de previsoes_desempenho.json em 01/10/2026: uma proveniência de topo de
        # PREVISÃO e, em evidencias, fichas do PLD JÁ PUBLICADO pela CCEE (valor observado)
        ficha = {"indicador": "PLD médio já publicado pela CCEE para 30/09/2026, das 07h às 23h, submercado SE",
                 "valor_exibido": "x", "fonte": {"orgao": "CCEE", "recurso": "pld_horario_2026"},
                 "testes": [ev.teste("a", "aprovado", "")]}
        prov = {"indicador": "Previsão do PLD: referência experimental B0", "natureza": "PREVISTO", "fonte": {}, "limitacoes": ["x"]}
        gold = {"proveniencia": prov, "evidencias": {"pld_no_corte_SE": ficha}}
        eix, linhas = dados.eixos({"previsoes_desempenho.json": {"_gold": gold}})
        self.assertEqual(linhas[0]["natureza"], None)
        self.assertEqual(eix["matriz"], {"SEM_VINCULO": {"controles_aprovados": 1}})
        self.assertIn("limitacao_natureza", eix)
        # proveniência única no MESMO objeto da ficha: vínculo vale
        gold2 = {"kpi": {"proveniencia": {**prov, "natureza": "OBSERVADO", "indicador": "PLD"}, "evidencia": ficha}}
        _, linhas2 = dados.eixos({"g.json": {"_gold": gold2}})
        self.assertEqual(linhas2[0]["natureza"], "OBSERVADO")

    def test_snapshot_composto_cita_cada_conjunto(self):
        # ids reais de mercado.json em 01/10/2026
        self.assertEqual(dados.datasets_do_snapshot("epe_consumo_mensal+epe_consumo_classe@2026-10-01T00:33:34Z"),
                         ["epe_consumo_mensal", "epe_consumo_classe"])
        self.assertEqual(dados.datasets_do_snapshot(
            "ccee_consumo_mensal_ambiente_comercializacao+ccee_consumo_classe_agente@2026-10-01T00:45:34Z"),
            ["ccee_consumo_mensal_ambiente_comercializacao", "ccee_consumo_classe_agente"])
        self.assertEqual(dados.datasets_do_snapshot("aneel_conta_bandeira@2026-10-01T00:00:00Z"), ["aneel_conta_bandeira"])
        # fora do formato (cita golds, parte vazia): nenhum vínculo inventado
        self.assertIsNone(dados.datasets_do_snapshot("golds:perdas.json@2026-10-01T06:06:09Z,qualidade.json@2026"))
        self.assertIsNone(dados.datasets_do_snapshot("a++b@2026"))


# ---------------------------------------------------------------- Parquet e manifesto


class TestParquetEManifesto(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_parquet_igual_ao_csv_com_zero_a_esquerda_e_vazio(self):
        for nome in ("conta_tarifas_b1_vigentes_amostra.csv", "empresas_distribuidoras_amostra.csv"):
            c = os.path.join(self.tmp, nome)
            shutil.copy(os.path.join(DADOS, nome), c)
            p = c[:-4] + ".parquet"
            r = pub.csv_para_parquet(c, p, "/energia/series/" + nome)
            self.assertEqual(r["status"], "gerado")
            self.assertEqual(r["tipos"]["cnpj"], "str")
            ok, det, linhas, div, _ = pub.confere_parquet(c, p)
            self.assertTrue(ok, det)
            self.assertEqual(div, 0)
            with open(c, encoding="utf-8") as f:
                self.assertEqual(linhas, sum(1 for _ in f) - 1)
            import pyarrow.parquet as pq
            primeira = pq.read_table(p, columns=["cnpj"]).column(0).to_pylist()[0]
            with open(c, encoding="utf-8") as f:
                next(f)
                self.assertEqual(primeira, next(f).split(";")[0])  # CNPJ com zero à esquerda intacto
            # CSV inalterado não regrava o Parquet
            self.assertEqual(pub.csv_para_parquet(c, p, "/energia/series/" + nome)["status"], "inalterado")

    def test_parquet_divergente_e_detectado(self):
        c = os.path.join(self.tmp, "a.csv")
        shutil.copy(os.path.join(DADOS, "empresas_distribuidoras_amostra.csv"), c)
        p = c[:-4] + ".parquet"
        pub.csv_para_parquet(c, p, "/energia/series/a.csv")
        with open(c, encoding="utf-8") as f:
            linhas = f.read().split("\n")
        linhas[1] = linhas[1].replace(";", ";X", 1)
        with open(c, "w", encoding="utf-8") as f:
            f.write("\n".join(linhas))
        ok, _, _, div, ex = pub.confere_parquet(c, p)
        self.assertFalse(ok)
        self.assertEqual(div, 1)
        self.assertEqual(ex[0]["coluna"], "slug")

    def test_numero_com_mais_de_17_digitos_nao_perde_precisao_em_silencio(self):
        c = os.path.join(self.tmp, "precisao.csv")
        with open(c, "w", encoding="utf-8") as f:
            f.write("data;valor\n2026-09-26;12345678901234567891.5\n2026-09-27;13984.69575\n")
        p = c[:-4] + ".parquet"
        r = pub.csv_para_parquet(c, p, "/energia/series/precisao.csv")
        self.assertEqual(r["tipos"]["valor"], "str")  # o float64 guardaria 12345678901234567000
        ok, det, linhas, div, _ = pub.confere_parquet(c, p)
        self.assertTrue(ok, det)
        # Parquet gravado em float64 (como a versão anterior fazia): a conferência acusa a perda
        import pyarrow as pa
        import pyarrow.parquet as pq
        pq.write_table(pa.table({"data": ["2026-09-26", "2026-09-27"], "valor": [float("12345678901234567891.5"), 13984.69575]}), p)
        ok, det, linhas, div, ex = pub.confere_parquet(c, p)
        self.assertFalse(ok)
        self.assertEqual((linhas, div), (2, 1))
        self.assertEqual((ex[0]["linha"], ex[0]["coluna"]), (2, "valor"))
        self.assertTrue(pub.float_preserva("13984.69575") and pub.float_preserva("1.50") and pub.float_preserva("1e3"))
        self.assertFalse(pub.float_preserva("12345678901234567891.5"))

    def test_id_da_publicacao_e_regra_publicada(self):
        itens = [{"caminho": "/energia/gold/b.json", "bytes": 2, "sha256": "b" * 64},
                 {"caminho": "/energia/gold/a.json", "bytes": 1, "sha256": "a" * 64}]
        canon = '[["/energia/gold/a.json",1,"' + "a" * 64 + '"],["/energia/gold/b.json",2,"' + "b" * 64 + '"]]'
        self.assertEqual(pub.id_publicacao(itens), hashlib.sha256(canon.encode()).hexdigest())

    def test_manifesto_publicado_confere_com_o_disco(self):
        caminho = os.path.join(GOLD, "manifesto.json")
        if not os.path.exists(caminho):
            self.skipTest("manifesto ainda não publicado")
        m = le_gold("manifesto.json")
        self.assertEqual(m["id_publicacao"], pub.id_publicacao(m["arquivos"]))
        self.assertEqual(len({i["caminho"] for i in m["arquivos"]}), len(m["arquivos"]))
        self.assertTrue(all(len(i["sha256"]) == 64 for i in m["arquivos"]))
        # os arquivos que o próprio módulo escreve na mesma execução têm o sha256 do disco
        # (os demais podem ter sido regravados depois por outro módulo)
        proprios = [i for i in m["arquivos"] if os.path.basename(i["caminho"]).startswith("dados_") and i["caminho"].endswith(".csv")]
        self.assertGreaterEqual(len(proprios), 6)
        g = le_gold("publicacao.json")
        if g.get("gerado_em", "") <= m["gerado_em"]:
            for i in proprios:
                with open(os.path.join(RAIZ, "public", i["caminho"].lstrip("/")), "rb") as f:
                    self.assertEqual(hashlib.sha256(f.read()).hexdigest(), i["sha256"], i["caminho"])


# ---------------------------------------------------------------- afirmações (P070, achado A06)


class TestAfirmacoes(unittest.TestCase):
    def cat(self, estado):
        return {"entradas": [{"id": "ons:documentos-limites-intercambio", "orgao": "ONS", "estado": estado,
                              "titulo": "Documentos do ONS", "paginas": []}]}

    def test_limites_de_intercambio_bloqueados_nao_aparecem_como_integrados(self):
        golds = {"rede_detalhe.json": {"_gold": {"achados": {"A06": {
            "status": "bloqueado por fonte não pública (limites)", "conclusao": "Não há recurso público estruturado.",
            "correcao_metodologia": "A página dizia que os limites estavam catalogados."}}}}}
        a = next(x for x in dados.afirmacoes(self.cat("PUBLICADO"), golds) if x["id"] == "limites_intercambio")
        self.assertIn("não há conjunto público estruturado", a["texto"])
        self.assertIn("não foram integrados", a["texto"])
        self.assertNotIn("Limites de intercâmbio entre subsistemas: integrado", a["texto"])
        self.assertEqual(a["afirmacao_anterior"], "A metodologia afirmava que os limites de intercâmbio estavam catalogados.")

    def test_sem_bloqueio_o_texto_segue_o_catalogo(self):
        golds = {"rede_detalhe.json": {"_gold": {"achados": {"A06": {"status": "resolvido", "conclusao": "Recurso integrado."}}}}}
        a = next(x for x in dados.afirmacoes(self.cat("PUBLICADO"), golds) if x["id"] == "limites_intercambio")
        self.assertTrue(a["texto"].startswith("Limites de intercâmbio entre subsistemas: integrado, validado e publicado"))


# ---------------------------------------------------------------- métricas


class TestMetricas(unittest.TestCase):
    def test_definicoes_validas_e_ids_unicos(self):
        erros = [e for m in met.METRICAS for e in metricas.validar(m)]
        self.assertEqual(erros, [])
        ids = [m["id"] for m in met.METRICAS]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(i.startswith("dados_") for i in ids))


# ---------------------------------------------------------------- golds publicadas


@unittest.skipUnless(os.path.exists(os.path.join(GOLD, "publicacao.json")), "gold publicacao.json ainda não publicada")
class TestGoldPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = le_gold("publicacao.json")
        cls.cat = le_gold("catalogo.json")

    def test_integra_e_no_limite_de_tamanho(self):
        self.assertTrue(self.g["disponivel"])
        for nome in ("publicacao.json", "catalogo.json"):
            self.assertLessEqual(os.path.getsize(os.path.join(GOLD, nome)), val.LIMITE_GOLD_BYTES, nome)

    def test_proveniencias_e_evidencias_completas(self):
        provs = val.proveniencias(self.g)
        self.assertEqual(len(provs), 4)
        self.assertEqual([p["indicador"] for p in provs if val.problemas_proveniencia(p)], [])
        for nome, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], nome)

    def test_estado_de_cada_conjunto_e_o_das_etapas(self):
        for x in self.g["conjuntos"]:
            self.assertEqual(catalogo.estado_por_etapas(x["etapas"]), x["estado"], x["id"])

    def test_atrasado_tem_prazo_vencido_e_periodo_nao_futuro(self):
        hoje = self.g["referencia"]["hoje"]
        for x in self.g["conjuntos"]:
            a = x["atualidade"]
            if a["situacao"] == "ATRASADO":
                self.assertLess(a["prazo_proximo"], hoje, x["id"])
            if a.get("ultimo_periodo") and len(a["ultimo_periodo"]) >= 10:
                self.assertLessEqual(a["ultimo_periodo"][:10], hoje, x["id"])

    def test_registros_sem_metadado_do_arquivo_e_observacoes_ao_menos_referencias(self):
        for x in self.g["conjuntos"]:
            r = x.get("revisoes") or {}
            campos = (r.get("registros") or {}).get("campos") or {}
            self.assertFalse(set(campos) & sd.CAMPOS_METADADO_ARQUIVO, x["id"])
            if r.get("eventos"):
                self.assertGreaterEqual(r["observacoes"], r["referencias"], x["id"])
                self.assertGreaterEqual(r["eventos"], r["observacoes"], x["id"])

    def test_caso_c_so_com_rotina_do_portal(self):
        with open(os.path.join(SERIES, "dados_conjuntos.csv"), encoding="utf-8") as f:
            linhas = {r["id"]: r for r in csv.DictReader(f, delimiter=";")}
        for x in self.g["conjuntos"]:
            if x["atualidade"].get("caso") == "C":
                fr = {"campo": linhas[x["id"]]["campo_frequencia"], "declarada": x["frequencia"].get("declarada")}
                self.assertTrue(dados.rotina_do_portal(fr), x["id"])

    def test_contagens_do_catalogo_fecham(self):
        self.assertEqual(sum(self.cat["contagem"].values()), self.cat["total"])
        self.assertEqual(len(self.cat["entradas"]), self.cat["total"])
        self.assertEqual(self.g["catalogo"]["contagem"], self.cat["contagem"])

    def test_recursos_da_ccee_no_csv_fecham_com_o_catalogo(self):
        r = self.cat["recursos"]["CCEE"]
        with open(os.path.join(SERIES, "dados_recursos_ccee.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        presentes = [x for x in linhas if x["presente"] == "1"]
        self.assertEqual(len(presentes), r["total"])
        self.assertEqual(len(linhas) - len(presentes), r["removidos"])
        for estado, n in r["por_estado"].items():
            self.assertEqual(sum(1 for x in presentes if x["estado"] == estado), n, estado)

    def test_nenhum_conjunto_so_catalogado_e_fonte_de_indicador(self):
        for e in self.cat["entradas"]:
            if e["estado"] == "CATALOGADO":
                self.assertEqual(e["usado_em"], [], e["id"])

    def test_entrada_manual_nao_se_apresenta_como_verificada(self):
        with open(os.path.join(RAIZ, "pipeline", "energia", "catalogo_manual.json"), encoding="utf-8") as f:
            manuais = {m["id"] for m in json.load(f)["entradas"]}
        for e in self.cat["entradas"]:
            if e["id"] in manuais:
                self.assertFalse(e["metadados_verificados"], e["id"])
                self.assertEqual(e["estado"], "CATALOGADO", e["id"])

    def test_downloads_e_dicionario(self):
        for d in self.g["downloads"]:
            self.assertTrue(os.path.exists(os.path.join(RAIZ, "public", d["url"].lstrip("/"))), d["url"])
        for url in dados.REGISTRO["arquivos"]:
            self.assertTrue(os.path.exists(os.path.join(RAIZ, "public", url.lstrip("/"))), url)

    def test_parquet_publicado_equivalente(self):
        for p in self.g["arquivos"]["parquet"]:
            if p.get("csv"):
                self.assertTrue(p["equivalente"], p["parquet"])

    def test_avaliacao_sem_nota_inventada(self):
        a = self.g["avaliacao"]
        self.assertEqual(a["existe"], os.path.exists(os.path.join(GOLD, "avaliacao.json")))


if __name__ == "__main__":
    unittest.main()
