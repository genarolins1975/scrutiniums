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
import sqlite3
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
        for o in s[k]["observacoes"]:
            con.execute("INSERT INTO observacoes VALUES (?,?,?,?,?)", o)
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
        self.assertEqual(rv["referencias_revisadas"], len(mudaram))
        # 20 a 26/09 mudaram; 27 e 28/09 só existem na segunda captura (referências novas)
        self.assertEqual(rv["referencias_revisadas"], 7)
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

    def test_ausencia_numa_captura_nao_e_revisao(self):
        # 27 e 28/09 existem só na segunda captura: entraram como referências novas, não como revisão
        con = silver_de_amostra("carga_energia_di")
        rv = sd.revisoes(con, "carga_energia_di")
        self.assertFalse(any(e["ref"] in ("2026-09-27", "2026-09-28") for e in rv["maiores"]))


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

    def test_falha_de_coleta_nao_renova_a_data_do_dado(self):
        coletas = {"ultimo_ok": "2026-09-20T03:00:00Z",
                   "ultima_falha": {"tentado_em": "2026-09-30T03:00:00Z", "detalhe": "HTTP 503", "recurso": "X"}}
        an = analise("diaria", 1, "2026-09-19", coletas=coletas)
        a = dados.atualidade(an, freq("Diária"), date(2026, 10, 1), False)
        self.assertEqual(a["ultimo_periodo"], "2026-09-19")
        # o dia 20/09 devia chegar até 22/09 (tolerância diária de 2 dias): 9 dias de atraso em 01/10
        self.assertEqual((a["prazo_proximo"], a["situacao"], a["dias_atraso"]), ("2026-09-22", "ATRASADO", 9))
        self.assertIn("HTTP 503", a["causa"])


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
