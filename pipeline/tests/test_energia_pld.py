"""Módulo PLD (detalhe): leitores, cálculos e construção da gold pld_detalhe.json.

Sem rede. As amostras em pipeline/tests/dados/energia_pld/ são recortes reais:
- CMO semi-horário do ONS (CMO_SEMIHORARIO_2026.csv, semana de 19 a 25/09/2026 e o
  contorno do dia 05/09/2026, que o ONS não publicou; extremos reais de 2020 e 2025);
- CMO semanal do ONS (arquivos CSV e Parquet de 2023 inteiros, trechos de 2022, 2024 e 2026);
- PLD horário da CCEE (captura versionada do projeto: semana de 19 a 25/09/2026, 30/03/2026,
  26/09/2026, 06/07/2021 e 01/06/2023, e dias de anos anteriores escolhidos para a sazonalidade:
  setembros de 2021 a 2025, 20/08/2025, 16/01/2021 (Sudeste acima dos outros três) e 16/01/2022
  (Sudeste e Sul um centavo acima do piso));
- CMO semi-horário de 06/07/2021 (dia com a média no teto estrutural) e 27/09/2021;
- balanço de energia (25/09/2026) e intercâmbios (semana) do ONS; carga de 26/09/2026 nas duas
  capturas do silver principal (a de 29/09/2026 com 15 horas negativas no Nordeste, revista na de
  30/09/2026); IPCA do IBGE (07 e 08/2026 e 08/2025); dicionários;
- Decreto nº 5.163/2004 (Câmara dos Deputados, arts. 56 a 59 da norma atualizada e da
  publicação original) e texto extraído pelo pdftotext das páginas 3, 6, 58 e 59 da REN
  ANEEL nº 957/2021 (cópia do Internet Archive, sha256 472d18da...);
- trechos do texto extraído pelo pdftotext dos Procedimentos de Rede do ONS (Submódulos 2.4, 4.3
  e 4.5) e do Manual de Metodologia do DESSEM (CEPEL), e o texto do Despacho ANEEL nº 3.850/2025.
Os valores esperados foram calculados por outro caminho (awk sobre os arquivos originais)
e estão escritos nos testes. Na construção da gold os limites do PLD são os atos reais do
módulo Regulação (regulatorio.limites_pld()); a fixture limites_pld_fixture.json só exercita
a leitura do arquivo e a regra de vigência.
"""
import ast
import csv
import gzip
import hashlib
import io
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
from collections import defaultdict
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas  # noqa: E402
from pipeline.energia import regulatorio  # noqa: E402
from pipeline.energia.fontes import ccee, ibge_pld, normas_pld, ons, ons_carga, ons_pld  # noqa: E402
from pipeline.energia.modulos import pld_detalhe as m  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_pld")
URL_COPIA_DSP = "https://web.archive.org/web/20251224150719id_/https://www2.aneel.gov.br/cedoc/dsp20253850ti.pdf"
CAPTURAS_CARGA = ("2026-09-29T02:43:15Z", "2026-09-30T02:19:57Z")


def _texto(nome):
    caminho = os.path.join(DADOS, nome)
    op = gzip.open if nome.endswith(".gz") else open
    with op(caminho, "rt", encoding="utf-8-sig", newline="") as f:
        return f.read()


def _linhas(nome):
    return list(csv.DictReader(io.StringIO(_texto(nome)), delimiter=";"))


def _fixture_limites():
    with open(os.path.join(DADOS, "limites_pld_fixture.json"), encoding="utf-8") as f:
        return json.load(f)


class Leitores(unittest.TestCase):
    def test_numero_ons_distingue_zero_ausencia_e_invalido(self):
        self.assertEqual(ons_pld.numero_ons("0E-8"), (0.0, True))      # zero em notação científica é zero
        self.assertEqual(ons_pld.numero_ons("0.0"), (0.0, True))
        self.assertEqual(ons_pld.numero_ons(""), (None, True))         # vazio é ausência, não zero
        self.assertEqual(ons_pld.numero_ons("1,5"), (None, False))     # vírgula não é formato do ONS
        self.assertEqual(ons_pld.numero_ons("-39.24"), (-39.24, True))

    def test_semihorario_amostra_real(self):
        obs, rel = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2026_amostra.csv.gz"))
        self.assertEqual(rel["linhas"], 1352)  # 7 dias × 48 meias horas × 4 subsistemas + 8 linhas de contorno
        self.assertEqual((rel["invalidos"], rel["duplicados"], rel["fora_da_grade"]), (0, 0, 0))
        d = {(s, r): v for s, r, v in obs}
        self.assertEqual(d[("cmo_sh.N", "2026-09-25T14:00")], 22.74)
        self.assertEqual(d[("cmo_sh.N", "2026-09-25T14:30")], 24.32)
        # 05/09/2026 não foi publicado pelo ONS: nenhuma meia hora do dia, sem preenchimento
        self.assertFalse(any(r.startswith("2026-09-05") for _, r, _ in obs))

    def test_extremos_reais_preservados(self):
        obs, rel = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2020_extremos.csv"))
        d = {r: v for _, r, v in obs}
        self.assertEqual(d["2020-10-10T22:30"], 54729.62)  # valor extremo publicado, não descartado
        self.assertEqual(rel["negativos"], 2)
        obs, _ = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2025_extremos.csv"))
        self.assertEqual(obs, [("cmo_sh.NE", "2025-11-15T09:00", -39.24)])

    def test_linha_fora_de_dominio_nao_vira_observacao(self):
        linhas = [{"id_subsistema": "XX", "nom_subsistema": "X", "din_instante": "2026-01-01 00:00:00", "val_cmo": "1"},
                  {"id_subsistema": "SE", "nom_subsistema": "SUDESTE", "din_instante": "2026-01-01 00:15:00", "val_cmo": "1"},
                  {"id_subsistema": "SE", "nom_subsistema": "SUDESTE", "din_instante": "2026-01-01 00:30:00", "val_cmo": "1,5"},
                  {"id_subsistema": "SE", "nom_subsistema": "SUDESTE", "din_instante": "2026-01-01 01:00:00", "val_cmo": ""}]
        obs, rel = ons_pld.parse_cmo_semihorario(linhas)
        self.assertEqual(obs, [])
        self.assertEqual((rel["subsistema_desconhecido"], rel["fora_da_grade"], rel["invalidos"], rel["vazios"]), (1, 1, 1, 1))

    def test_cmo_semanal_2022_zero_escrito_em_notacao_cientifica(self):
        linhas = ons_pld.parse_cmo_semanal_original(_texto("cmo_semanal_2022_trecho.csv"))
        d = {(sm, s): campos for sm, s, campos in linhas}
        self.assertEqual(d[("N", "2022-12-30")]["val_cmomediasemanal"], ("0E-8", 0.0))
        self.assertEqual(d[("SE", "2022-12-23")]["val_cmomediasemanal"], ("0.01000000", 0.01))

    def test_cmo_semanal_2023_zeros_no_csv_e_no_parquet_oficiais(self):
        """Achado A02: os zeros existem no arquivo original, nos dois formatos publicados."""
        csv_ = ons_pld.parse_cmo_semanal_original(_texto("CMO_SEMANAL_2023.csv"))
        pq = ons_pld.parse_cmo_semanal_parquet(os.path.join(DADOS, "CMO_SEMANAL_2023.parquet"))
        self.assertEqual(len(csv_), 208)
        self.assertTrue(all(v == 0.0 for _, _, cp in csv_ for _, v in cp.values()))
        self.assertEqual({tok for _, _, cp in csv_ for tok, _ in cp.values()}, {"0.0"})
        por = {(sm, s): cp for sm, s, cp in pq}
        self.assertEqual(len(por), 208)
        for sm, s, cp in csv_:
            for campo, (_, v) in cp.items():
                self.assertEqual(por[(sm, s)][campo][1], v)
        self.assertEqual(min(s for _, s, _ in csv_), "2023-01-06")
        self.assertEqual(max(s for _, s, _ in csv_), "2023-12-29")

    def test_dicionario_unidade_lida_como_esta(self):
        """Achado A03: o dicionário diz R$/MW para a média semanal; não é corrigido na leitura."""
        sem = ons_pld.parse_dicionario_json(_texto("DicionarioDados_Cmo_Semanal.json"))
        u = {x["codigo"]: x["unidade"] for x in sem["campos"]}
        self.assertEqual(u["val_cmomediasemanal"], "R$/MW")
        self.assertEqual({u["val_cmoleve"], u["val_cmomedia"], u["val_cmopesada"]}, {"R$/MWh"})
        sh = ons_pld.parse_dicionario_json(_texto("DicionarioDados_Cmo_Semi_Horario.json"))
        self.assertEqual({x["codigo"]: x["unidade"] for x in sh["campos"]}["val_cmo"], "R$/MWh")

    def test_dicionario_pdf_admite_zero_e_negativo(self):
        """A02: o dicionário em PDF (texto do pdftotext -layout, versão 1.1 de 02/05/2023) declara
        que os campos de CMO semanal admitem valor zerado e negativo e não admitem nulo."""
        with open(os.path.join(DADOS, "DicionarioDados_Cmo_Semanal_pdftotext.txt"), encoding="utf-8") as f:
            perm = m.permissoes_do_dicionario(f.read())
        self.assertEqual(set(perm), {"val_cmomediasemanal", "val_cmoleve", "val_cmomedia", "val_cmopesada"})
        self.assertEqual(perm["val_cmomediasemanal"], {"nulo": False, "zerado": True, "negativo": True})
        self.assertEqual(m.permissoes_do_dicionario(""), {})

    def test_ipca_sidra(self):
        obs = dict((r, v) for _, r, v in ibge_pld.parse_ipca_sidra(_texto("ipca_sidra_amostra.json")))
        self.assertEqual(obs, {"2025-08": 7323.91, "2026-07": 7657.73, "2026-08": 7633.23})


class Normas(unittest.TestCase):
    """P008: passagens normativas citadas só quando conferidas no documento baixado."""

    def _html(self, nome):
        with open(os.path.join(DADOS, nome), "rb") as f:
            return normas_pld.texto_html(f.read())

    def test_decreto_norma_atualizada_confere(self):
        r = {t: ok for t, _, _, ok in normas_pld.confere_trechos("decreto_5163_2004", self._html("decreto_5163_normaatualizada_trecho.html"))}
        self.assertEqual(len(r), 9)
        self.assertTrue(all(r.values()), r)

    def test_publicacao_original_nao_confere_redacao_de_2017(self):
        """A publicação original de 2004 dizia "liquidação mensal" e "far-se-á": a conferência
        detecta que o documento não é a norma atualizada, em vez de aceitar qualquer versão."""
        r = {t: ok for t, _, _, ok in normas_pld.confere_trechos("decreto_5163_2004", self._html("decreto_5163_publicacaooriginal_trecho.html"))}
        self.assertFalse(r["d5163_art57_caput"])
        self.assertFalse(r["d5163_art57_p6"])
        self.assertTrue(r["d5163_art57_p2"])  # § 2º não mudou
        texto = self._html("decreto_5163_publicacaooriginal_trecho.html")
        self.assertIn("Art. 57. A contabilização e a liquidação mensal no mercado de curto prazo serão realizadas com base no PLD.", texto)

    def test_ren957_texto_extraido_confere(self):
        with open(os.path.join(DADOS, "ren957_paginas_3_6_58_59.txt"), encoding="utf-8") as f:
            texto = normas_pld.normaliza(f.read())
        r = {t: ok for t, _, _, ok in normas_pld.confere_trechos("ren_aneel_957_2021", texto)}
        self.assertEqual(r, {"ren957_art2_xiii": True, "ren957_art5_p4": True, "ren957_art76": True, "ren957_art78": True, "ren957_art82": True})
        # uma palavra trocada basta para a passagem não conferir
        self.assertNotIn(normas_pld.normaliza("devendo as exposições dos agentes da CCEE serem valoradas ao CMO."), texto)
        self.assertEqual({ok for *_, ok in normas_pld.confere_trechos("ren_aneel_957_2021", None)}, {False})

    def test_procedimentos_de_rede_e_manual_do_dessem_conferem(self):
        """P008 e P009: passagens dos Procedimentos de Rede do ONS (Submódulos 2.4, 4.3 e 4.5) e do
        Manual de Metodologia do DESSEM (CEPEL) conferidas no texto extraído dos PDFs."""
        with open(os.path.join(DADOS, "normas_ons_cepel_trechos.txt"), encoding="utf-8") as f:
            blocos = f.read().split("=== ")[1:]
        textos = {b_.split(" | ")[0]: normas_pld.normaliza(b_.split("===", 1)[1]) for b_ in blocos}
        for doc in ("ons_pr_submodulo_2_4", "ons_pr_submodulo_4_3", "ons_pr_submodulo_4_5", "cepel_dessem_manual_metodologia"):
            r = normas_pld.confere_trechos(doc, textos[doc])
            self.assertTrue(r and all(ok for *_, ok in r), (doc, [t for t, _, _, ok in r if not ok]))
        # uma palavra trocada basta para a passagem não conferir
        self.assertFalse(normas_pld.confere("O modelo de despacho hidrotérmico de curtíssimo prazo é executado semanalmente em D-1",
                                            textos["ons_pr_submodulo_2_4"]))
        # passagem com elisão: cada parte é conferida separadamente
        self.assertTrue(normas_pld.confere("1.5.2. Caso o ONS não obtenha os resultados […] válidos mais recentes disponíveis.",
                                           textos["ons_pr_submodulo_4_3"]))
        self.assertFalse(normas_pld.confere("1.5.2. Caso o ONS não obtenha os resultados […] resultados do DESSEM.",
                                            textos["ons_pr_submodulo_4_3"]))

    def test_normaliza_pontuacao_e_espacos(self):
        self.assertEqual(normas_pld.normaliza("royalties </i>.".replace("</i>", "")), "royalties.")
        self.assertEqual(normas_pld.normaliza("a\n  b\u00a0c"), "a b c")


class Calculos(unittest.TestCase):
    def test_cmo_horario_media_por_duracao_e_ausencia(self):
        obs, _ = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2026_amostra.csv.gz"))
        meias = {r: v for s, r, v in obs if s == "cmo_sh.N"}
        h = m.cmo_horario(meias)
        self.assertAlmostEqual(h["2026-09-25T14:00"], (22.74 + 24.32) / 2, places=9)
        # a amostra tem 04/09 às 23h30 sem 23h00 e 06/09 às 00h00 sem 00h30: horas incompletas ficam sem valor
        self.assertNotIn("2026-09-04T23:00", h)
        self.assertNotIn("2026-09-06T00:00", h)
        self.assertEqual(len([k for k in h if "2026-09-19" <= k[:10] <= "2026-09-25"]), 168)

    def test_semana_operativa_termina_na_sexta(self):
        self.assertEqual(m.fim_da_semana_operativa(date(2026, 9, 19)), date(2026, 9, 25))  # sábado
        self.assertEqual(m.fim_da_semana_operativa(date(2026, 9, 25)), date(2026, 9, 25))  # sexta
        self.assertEqual(m.fim_da_semana_operativa(date(2026, 9, 26)), date(2026, 10, 2))

    def test_sequencia_de_zeros_com_dados_reais_e_ausencia(self):
        pontos = {}
        for nome in ("cmo_semanal_2022_trecho.csv", "CMO_SEMANAL_2023.csv", "cmo_semanal_2024_trecho.csv"):
            for sm, s, cp in ons_pld.parse_cmo_semanal_original(_texto(nome)):
                if sm == "SE":
                    pontos[s] = cp["val_cmomediasemanal"][1]
        seq = m.sequencias_zero(sorted(pontos.items()))
        # 30/12/2022 (0E-8) + 52 semanas de 2023; jan e fev de 2024 não estão na amostra, e a
        # ausência interrompe a sequência em vez de ser tratada como zero
        self.assertEqual(seq, [{"inicio": "2022-12-30", "fim": "2023-12-29", "semanas": 53}])

    def test_limites_campo_a_campo_e_rejeicoes(self):
        # atos SINTÉTICOS, só para a regra de vigência (não representam atos reais)
        atos, rej = m.normaliza_atos({"atos": [
            {"ano": 2030, "ato": "A", "data_publicacao": "2029-12-10", "vigencia_inicio": "2030-01-01", "vigencia_fim": "2030-12-31",
             "pld_min": 60.0, "pld_max_horario": 1500.0, "pld_max_estrutural": 700.0, "unidade": "R$/MWh", "url": "u"},
            {"ano": 2030, "ato": "B", "data_publicacao": "2030-03-01", "vigencia_inicio": "2030-03-01", "vigencia_fim": None,
             "pld_min": None, "pld_max_horario": None, "pld_max_estrutural": 710.0, "unidade": "R$/MWh", "url": "u"},
            {"ano": 2030, "ato": "C", "vigencia_inicio": "2030-01-01", "pld_min": 1, "unidade": "R$/MW", "url": "u"},
            {"ano": 2030, "ato": "D", "vigencia_inicio": "2030-05-01", "vigencia_fim": "2030-04-01", "pld_min": 1, "unidade": "R$/MWh", "url": "u"},
            {"ano": 2030, "ato": "E", "vigencia_inicio": "2030-01-01", "pld_min": 900, "pld_max_horario": 800, "unidade": "R$/MWh", "url": "u"},
        ]})
        self.assertEqual([a["ato"] for a in atos], ["A", "B"])
        self.assertEqual({r["ato"] for r in rej}, {"C", "D", "E"})
        fev, abr = m.limites_vigentes(atos, "2030-02-15"), m.limites_vigentes(atos, "2030-04-15")
        self.assertEqual((fev["pld_max_estrutural"], fev["ato_pld_max_estrutural"]), (700.0, "A"))
        self.assertEqual((abr["pld_max_estrutural"], abr["ato_pld_max_estrutural"]), (710.0, "B"))
        self.assertEqual((abr["pld_min"], abr["ato_pld_min"]), (60.0, "A"))  # campo não alterado continua o do ato anterior
        self.assertIsNone(m.limites_vigentes(atos, "2031-01-01")["pld_min"])  # sem ato vigente: sem limite, nunca o menor observado

    def test_limites_consumidos_da_funcao_do_modulo_regulacao(self):
        import types
        import pipeline.energia as pe
        falso = types.ModuleType("pipeline.energia.regulatorio")
        falso.limites_pld = _fixture_limites
        with mock.patch.dict(sys.modules, {"pipeline.energia.regulatorio": falso}), \
                mock.patch.object(pe, "regulatorio", falso, create=True):
            dado, origem, motivo = m.carrega_limites({})
        self.assertEqual(origem, "pipeline.energia.regulatorio.limites_pld()")
        self.assertIsNone(motivo)
        self.assertEqual(len(m.normaliza_atos(dado)[0]), 2)
        # pacote sem a função: lê o arquivo que ela leria; sem arquivo, declara a ausência
        vazio = types.ModuleType("pipeline.energia.regulatorio")
        with mock.patch.dict(sys.modules, {"pipeline.energia.regulatorio": vazio}), \
                mock.patch.object(pe, "regulatorio", vazio, create=True):
            with mock.patch.object(m, "ARQUIVO_LIMITES", os.path.join(DADOS, "limites_pld_fixture.json")):
                dado, origem, motivo = m.carrega_limites({})
                self.assertIn("leitura direta", origem)
            with mock.patch.object(m, "ARQUIVO_LIMITES", os.path.join(DADOS, "nao_existe.json")):
                dado, origem, motivo = m.carrega_limites({})
                self.assertIsNone(dado)
                self.assertIn("ainda não publicado", motivo)

    def test_limites_do_modulo_regulacao_nos_atos_primarios(self):
        """A04 com os atos reais: a leitura campo a campo deste módulo e a limites_em do módulo
        Regulação (outro código) dão os mesmos limites em todos os dias de 2021 a 2026, e os
        valores conferem com os atos da ANEEL citados (trechos em limites_pld.json)."""
        dado = regulatorio.limites_pld()
        atos, rej = m.normaliza_atos(dado)
        self.assertEqual(rej, [])
        dia = date(2021, 1, 1)
        while dia <= date(2026, 12, 31):
            iso = dia.isoformat()
            self.assertEqual(m.limites_vigentes(atos, iso), regulatorio.limites_em(iso, dado["atos"]), iso)
            dia = date.fromordinal(dia.toordinal() + 1)
        l21, l22, l23, l26 = (m.limites_vigentes(atos, x) for x in ("2021-07-06", "2022-06-01", "2023-06-01", "2026-09-30"))
        self.assertEqual((l21["pld_min"], l21["pld_max_estrutural"], l21["pld_max_horario"]), (49.77, 583.88, 1197.87))
        # 2022: piso da REH nº 2.994/2021; tetos atualizados pelo IPCA no Despacho nº 4.046/2021
        self.assertEqual((l22["pld_min"], l22["pld_max_horario"], l22["pld_max_estrutural"]), (55.7, 1326.5, 646.58))
        self.assertEqual(l22["ato_pld_min"], "Resolução Homologatória ANEEL nº 2.994/2021")
        # 2023: a retificação (Nota Técnica nº 01/2023) prevalece nos tetos; o piso continua o da REH nº 3.167/2022
        self.assertEqual((l23["pld_min"], l23["pld_max_horario"], l23["pld_max_estrutural"]), (69.04, 1404.77, 684.73))
        self.assertTrue(l23["ato_pld_max_horario"].startswith("Retificação"))
        self.assertEqual((l26["pld_min"], l26["pld_max_horario"], l26["pld_max_estrutural"]), (57.31, 1611.04, 785.27))
        # o módulo lê pela função pública do módulo Regulação quando ela existe
        _, origem, motivo = m.carrega_limites({})
        self.assertEqual((origem, motivo), ("pipeline.energia.regulatorio.limites_pld()", None))

    def test_situacao_com_tolerancia_monetaria(self):
        atos, _ = m.normaliza_atos(_fixture_limites())
        l21, l26 = m.limites_vigentes(atos, "2021-07-06"), m.limites_vigentes(atos, "2026-03-30")
        self.assertEqual(m.situacao_hora(49.77, l21), "piso")
        # na hora, "no piso" é igualdade ao centavo: um centavo acima é outro preço, contado à parte
        self.assertEqual(m.situacao_hora(49.78, l21), "entre")
        self.assertEqual(m.a_um_centavo(49.78, l21), "piso")
        self.assertEqual(m.situacao_hora(49.78, l21, tol=m.TOL_SENS), "piso")  # sensibilidade de R$ 0,01/MWh
        self.assertIsNone(m.a_um_centavo(49.77, l21))
        self.assertEqual(m.situacao_hora(49.80, l21), "entre")
        self.assertIsNone(m.a_um_centavo(49.80, l21))
        self.assertEqual(m.situacao_hora(1611.04, l26), "teto_horario")
        self.assertEqual(m.situacao_hora(49.0, l21), "abaixo_do_piso")  # controle
        self.assertEqual(m.situacao_hora(100.0, {}), "sem_limite")
        # 06/07/2021: média real das 24 horas do Sudeste = 583,88375 (awk), teto estrutural de 2021 = 583,88
        vals = [float(r["PLD_HORA"]) for r in _linhas("pld_horario_2021_teto_estrutural.csv") if r["SUBMERCADO"] == "SUDESTE"]
        self.assertAlmostEqual(sum(vals) / 24, 583.88375, places=6)
        self.assertEqual(m.situacao_dia_estrutural(sum(vals) / 24, l21), "no_teto")
        self.assertGreater(max(vals), 583.88)  # horas acima do teto estrutural existem; a regra é sobre a média

    def test_um_centavo_acima_do_piso_real(self):
        """Defeito do verificador: com tolerância de um centavo na hora, 16/01/2022 às 04h no Sudeste
        e no Sul (R$ 55,71/MWh, arquivo da CCEE) contava como piso (R$ 55,70/MWh, REH nº 2.994/2021)."""
        pld = {(r["SUBMERCADO"], int(r["HORA"])): float(r["PLD_HORA"]) for r in _linhas("pld_horario_anteriores_amostra.csv.gz")
               if r["MES_REFERENCIA"] == "202201" and r["DIA"] == "16"}
        self.assertEqual((pld[("SUDESTE", 4)], pld[("SUL", 4)], pld[("NORDESTE", 4)]), (55.71, 55.71, 55.7))
        atos, _ = m.normaliza_atos(regulatorio.limites_pld())
        l22 = m.limites_vigentes(atos, "2022-01-16")
        self.assertEqual(l22["pld_min"], 55.7)
        self.assertEqual(m.situacao_hora(pld[("SUDESTE", 4)], l22), "entre")
        self.assertEqual(m.a_um_centavo(pld[("SUDESTE", 4)], l22), "piso")
        self.assertEqual(m.situacao_hora(pld[("NORDESTE", 4)], l22), "piso")
        self.assertEqual(m.situacao_hora(pld[("SUDESTE", 4)], l22, tol=m.TOL_SENS), "piso")

    def test_media_ponderada_pela_carga_real(self):
        pld = {int(r["HORA"]): float(r["PLD_HORA"]) for r in _linhas("pld_horario_2026_amostra.csv.gz")
               if r["SUBMERCADO"] == "SUDESTE" and r["MES_REFERENCIA"] == "202609" and r["DIA"] == "25"}
        carga = {int(r["din_instante"][11:13]): float(r["val_carga"]) for r in _linhas("balanco_2026_amostra.csv.gz")
                 if r["id_subsistema"].strip() == "SE"}
        pares = [(pld[h], carga[h]) for h in range(24)]
        self.assertAlmostEqual(m.media_ponderada(pares), 108.363608, places=5)   # awk: Σ PLD × carga ÷ Σ carga
        self.assertAlmostEqual(sum(pld.values()) / 24, 106.6075, places=6)        # média temporal do mesmo dia
        self.assertIsNone(m.media_ponderada([(10.0, 0.0)]))                     # sem peso positivo, sem média

    def test_deflator(self):
        self.assertAlmostEqual(m.deflaciona(100.0, 7657.73, 7633.23), 100.0 * 7633.23 / 7657.73, places=12)
        self.assertIsNone(m.deflaciona(100.0, None, 7633.23))  # mês sem índice fica sem valor real

    def test_exemplo_de_liquidacao_sintetico(self):
        """P008: o exemplo usa o PLD real de 30/03/2026 às 19h no Sudeste/Centro-Oeste (R$ 1.611,04/MWh,
        o teto horário do ano) e quantidades hipotéticas; diferença = geração + compras − consumo − vendas."""
        pld = {(r["DIA"], int(r["HORA"])): float(r["PLD_HORA"]) for r in _linhas("pld_horario_2026_amostra.csv.gz")
               if r["SUBMERCADO"] == "SUDESTE" and r["MES_REFERENCIA"] == "202603"}
        self.assertEqual(pld[("30", 19)], 1611.04)
        ag = {a["id"]: a for a in m.exemplo_liquidacao(pld[("30", 19)])}
        self.assertEqual((ag["consumidor"]["diferenca_mwh"], ag["consumidor"]["valor_rs"], ag["consumidor"]["resultado"]), (-20.0, -32220.8, "débito"))
        self.assertEqual((ag["gerador"]["diferenca_mwh"], ag["gerador"]["valor_rs"], ag["gerador"]["resultado"]), (20.0, 32220.8, "crédito"))
        # quantidades do exemplo são as declaradas como hipotéticas no módulo, nada vem de dado de agente
        self.assertEqual({a["id"] for a in m.EXEMPLO_AGENTES}, {"consumidor", "gerador"})

    def test_sentido_do_fluxo(self):
        self.assertEqual(m.sentido_fluxo(100.0, 100.005, 500.0), "sem_separacao")
        self.assertEqual(m.sentido_fluxo(90.0, 120.0, 500.0), "do_menor_para_o_maior")
        self.assertEqual(m.sentido_fluxo(90.0, 120.0, -500.0), "do_maior_para_o_menor")
        self.assertEqual(m.sentido_fluxo(90.0, 120.0, 0.5), "nulo")

    def test_metricas_do_modulo_validas(self):
        ids = [x["id"] for x in metricas.todas() if x["arquivo"].endswith("/pld.py")]
        self.assertIn("pld_horas_piso", ids)
        self.assertIn("pld_media_mensal_ponderada_carga", ids)
        # toda métrica alimentada pelo CMO do ONS (resultado de modelo) herda a natureza ESTIMADO da fonte
        for x in metricas.todas():
            if x["arquivo"].endswith("/pld.py") and set(x["fontes"]) & {"ons_cmo_semihorario", "cmo_se", "ons_cmo_semanal_a02"}:
                self.assertEqual(x["natureza_fonte"], "ESTIMADO", x["id"])

    def test_pesos_fisicos_com_carga_negativa_real(self):
        """Carga do Nordeste em 26/09/2026 como publicada na captura de 29/09/2026: 15 horas negativas
        (revistas no dia seguinte). Nenhuma delas pode pesar na média: saem e são listadas.
        Valores esperados por awk sobre carga_20260926_capturas.csv e pld_horario_20260926.csv."""
        pld = {int(r["HORA"]): float(r["PLD_HORA"]) for r in _linhas("pld_horario_20260926.csv") if r["SUBMERCADO"] == "NORDESTE"}
        cargas = _linhas("carga_20260926_capturas.csv")
        c1 = {int(r["din_instante"][11:13]): float(r["val_carga_captura_2026-09-29T02:43:15Z"]) for r in cargas if r["id_subsistema"] == "NE"}
        c2 = {int(r["din_instante"][11:13]): float(r["val_carga_captura_2026-09-30T02:19:57Z"]) for r in cargas if r["id_subsistema"] == "NE"}
        validos, retirados = m.pesos_validos([(h, pld[h], c1[h]) for h in range(24)])
        self.assertEqual(sorted(k for k, _, _ in retirados), [0, 1, 2, 3, 4, 5, 6, 7, 15, 16, 19, 20, 21, 22, 23])
        self.assertAlmostEqual(m.media_ponderada([(p, w) for _, p, w in validos]), 58.567140, places=5)
        self.assertAlmostEqual(c1[23], -3940.665, places=3)
        # sem o controle, as 24 horas teriam peso total negativo (Σ carga = −16.053,1 MWmed, awk): não há média
        self.assertAlmostEqual(sum(c1.values()), -16053.1, places=1)
        self.assertIsNone(m.media_ponderada([(pld[h], c1[h]) for h in range(24)]))
        self.assertAlmostEqual(m.media_ponderada([(pld[h], c2[h]) for h in range(24)]), 76.197772, places=5)
        # ausência não é retirada nem peso
        self.assertEqual(m.pesos_validos([("x", 10.0, None)]), ([], []))

    def test_magnitude_das_revisoes_reais(self):
        cargas = _linhas("carga_20260926_capturas.csv")
        hist = {f"2026-09-26T{r['din_instante'][11:13]}:00": [("2026-09-29T02:43:15Z", float(r["val_carga_captura_2026-09-29T02:43:15Z"])),
                                                              ("2026-09-30T02:19:57Z", float(r["val_carga_captura_2026-09-30T02:19:57Z"]))]
                for r in cargas if r["id_subsistema"] == "NE"}
        mag = m.magnitude_revisoes(hist)
        self.assertEqual(mag["horas_revisadas"], 24)
        self.assertAlmostEqual(mag["max_abs"], 18847.303, places=3)       # 23h: −3.940,665 → 14.906,638
        self.assertEqual(mag["quando_max"], "2026-09-26T23:00")
        self.assertAlmostEqual(mag["media_abs"], 14653.57475, places=4)
        self.assertEqual(mag["horas_com_troca_de_sinal"], 15)
        self.assertAlmostEqual(mag["max_rel"], 206.565910, places=5)
        self.assertEqual(m.magnitude_revisoes({"a": [("t1", 1.0), ("t2", 1.0)]}), {"horas_revisadas": 0})

    def test_publicacao_pelo_objeto_do_s3(self):
        """Defeito do verificador: a vintage do CMO_SEMIHORARIO_2026 de 30/09/2026 22h06 registrava o
        last_modified atrasado do CKAN (15:01:21). Cabeçalhos reais do S3 para os mesmos bytes:
        Last-Modified 30/09/2026 22:00:52 GMT e ETag igual ao MD5 do arquivo capturado."""
        cab = {"last_modified": "Wed, 30 Sep 2026 22:00:52 GMT", "etag": '"76ffacf7306c49520949cf700eecdb37"'}
        self.assertEqual(m.instante_http(cab["last_modified"]), "2026-09-30T22:00:52Z")
        self.assertEqual(m.publicacao_do_objeto(cab, "76ffacf7306c49520949cf700eecdb37"), "2026-09-30T22:00:52Z")
        self.assertIsNone(m.publicacao_do_objeto(cab, "0" * 32))                       # objeto não é o capturado
        self.assertIsNone(m.publicacao_do_objeto({**cab, "etag": '"abc-2"'}, "abc-2"))  # upload em partes: ETag não é MD5
        self.assertIsNone(m.instante_http("ontem"))

    def test_confere_publicacao_corrige_a_vintage(self):
        tmp = tempfile.mkdtemp()
        try:
            with mock.patch.multiple(base, BRONZE=os.path.join(tmp, "bronze")):
                con = base.conecta(":memory:")
                origem = os.path.join(DADOS, "cmo_semihorario_2025_extremos.csv")
                arq, sha, n = base.salva_bronze_arquivo("ons", m.DS_SH, "CMO_SEMIHORARIO_2025", origem, "csv", "2026-09-30T22:06:12Z")
                url = m.S3_SH + "CMO_SEMIHORARIO_2025.csv"
                vid, _ = base.registra_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2025", url, "2026-09-30T22:06:12Z", "2026-09-30T15:01:21Z",
                                               sha, n, "coleta_direta", arq)
                with open(origem, "rb") as f:
                    md5 = hashlib.md5(f.read()).hexdigest()
                v = base.ultima_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2025")
                r = m.confere_publicacao_s3(con, v, cabecalhos=lambda u: {"last_modified": "Wed, 30 Sep 2026 22:00:52 GMT", "etag": f'"{md5}"'})
                self.assertEqual(r["resultado"], "conferida")
                self.assertEqual(base.ultima_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2025")["publicado_em"], "2026-09-30T22:00:52Z")
                reg = base.registros_como_estavam_em(con, m.DS_CONTROLE)[f"publicacao_s3:{vid}"]
                self.assertEqual((reg["publicado_em_anterior"], reg["md5"]), ("2026-09-30T15:01:21Z", md5))
                # conferência registrada não é refeita; objeto diferente do capturado apaga a data (desconhecida)
                self.assertTrue(m.confere_publicacao_s3(con, v)["registrado"])
                arq2, sha2, n2 = base.salva_bronze_arquivo("ons", m.DS_SH, "CMO_SEMIHORARIO_2020", os.path.join(DADOS, "cmo_semihorario_2020_extremos.csv"),
                                                           "csv", "2026-09-30T22:06:07Z")
                base.registra_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2020", m.S3_SH + "CMO_SEMIHORARIO_2020.csv", "2026-09-30T22:06:07Z",
                                      "2024-08-26T18:20:51Z", sha2, n2, "coleta_direta", arq2)
                v2 = base.ultima_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2020")
                r2 = m.confere_publicacao_s3(con, v2, cabecalhos=lambda u: {"last_modified": "Wed, 30 Sep 2026 23:00:00 GMT", "etag": '"' + "f" * 32 + '"'})
                self.assertEqual(r2["resultado"], "nao_conferida")
                self.assertIsNone(base.ultima_vintage(con, m.DS_SH, "CMO_SEMIHORARIO_2020")["publicado_em"])
                con.close()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_ato_vigente_conferido_no_texto_do_pdf(self):
        """Despacho ANEEL nº 3.850/2025 (texto extraído pelo pdftotext, uma página): o trecho literal e o
        piso de R$ 57,31/MWh estão na página 1; um valor trocado não confere."""
        with open(os.path.join(DADOS, "dsp20253850ti_pdftotext.txt"), encoding="utf-8") as f:
            paginas = f.read().split("\f")
        ato = next(a for a in m.normaliza_atos(regulatorio.limites_pld())[0] if a["ano"] == 2026)
        ok, pagina, detalhe = m.confere_ato_no_texto(ato, paginas)
        self.assertEqual((ok, pagina), (True, 1), detalhe)
        ok2, _, _ = m.confere_ato_no_texto({**ato, "pld_min": 57.32}, paginas)
        self.assertFalse(ok2)
        self.assertEqual(m.confere_ato_no_texto(ato, None)[0], False)

    def test_atos_com_nivel_de_conferencia(self):
        """Defeito do verificador: três atos (2021 e 2023) têm os valores lidos em voto ou nota técnica
        do processo, não no texto do ato; a gold precisa distinguir."""
        atos = m.enriquece_atos(m.normaliza_atos(regulatorio.limites_pld())[0])
        nivel = {a["ato"]: a["nivel_conferencia"] for a in atos}
        self.assertEqual(nivel["Resolução Homologatória ANEEL nº 2.828/2020"], "documento_oficial_do_processo")
        self.assertEqual(nivel["Resolução Homologatória ANEEL nº 3.167/2022"], "documento_oficial_do_processo")
        self.assertEqual(nivel["Retificação da Resolução Homologatória ANEEL nº 3.167/2022"], "documento_oficial_do_processo")
        self.assertEqual(nivel["Despacho ANEEL nº 3.850/2025"], "texto_do_ato")
        self.assertEqual(sum(1 for v in nivel.values() if v == "texto_do_ato"), 5)
        r = m._resumo_conferencia(atos)
        self.assertEqual(r["por_nivel"], {"documento_oficial_do_processo": 3, "texto_do_ato": 5})
        # ato sem registro de conferência fica sem nível (nada é presumido)
        self.assertIsNone(m.enriquece_atos([{"ano": 2030, "ato": "X"}], {"atos": []}, {})[0]["nivel_conferencia"])

    def test_momento_do_calculo_so_com_passagens_conferidas(self):
        todos = {t for t, *_ in normas_pld.TRECHOS}
        mom = m.momento_do_calculo(todos)
        self.assertIn("D-1", mom["dessem_semi_horario"])
        self.assertIn("48 intervalos semi-horários", mom["dessem_semi_horario"])
        self.assertIn("16h00", mom["dessem_semi_horario"])
        self.assertIn("12h00 de sexta-feira", mom["decomp_semanal"])
        self.assertIn("homologadas pela ANEEL", mom["versao"])
        sem = m.momento_do_calculo(todos - {"pr24_execucao_d1"})
        self.assertIsNone(sem["dessem_semi_horario"])
        self.assertEqual(m.momento_do_calculo(()), {"decomp_semanal": None, "dessem_semi_horario": None, "versao": None})

    def test_reconciliacao_por_releitura(self):
        horas = ["h1", "h2", "h3"]
        silver = {"h1": 10.0, "h2": 20.0, "h3": 30.0}
        media = lambda v: sum(v.values()) / len(v)  # noqa: E731
        arq = [{"recurso": "x", "capturado_em": "2026-09-30T00:00:00Z", "vigente": True}]
        rec, falta = m._reconcilia("t", horas, dict(silver), arq, media, 20.0, silver, 1e-6, "R$ 0,000001/MWh", str)
        self.assertEqual((rec["resultado"], falta), ("aprovado", None))
        rec, _ = m._reconcilia("t", horas, {**silver, "h2": 21.0}, arq, media, 20.0, silver, 1e-6, "R$ 0,000001/MWh", str)
        self.assertEqual(rec["resultado"], "reprovado")      # o arquivo original diz outra coisa: a ficha acusa
        rec, _ = m._reconcilia("t", horas, {"h1": 10.0}, arq, media, 20.0, silver, 1e-6, "R$ 0,000001/MWh", str)
        self.assertEqual(rec["resultado"], "ressalva")       # arquivo mais antigo que a captura vigente
        rec, falta = m._reconcilia("t", horas, {}, [], media, 20.0, silver, 1e-6, "R$ 0,000001/MWh", str)
        self.assertIsNone(rec)
        self.assertEqual(falta["resultado"], "ressalva")     # sem arquivo: declarado, nunca "aprovado"

    def test_perimetro_do_mes_pela_descricao_do_ons(self):
        self.assertEqual([m.perimetro_do_mes(x) for x in ("2021-02", "2021-03", "2023-03", "2023-04", "2023-05")],
                         ["P1", "P2", "P2", "P2_P3", "P3"])

    def test_leitor_independente_da_api_de_carga(self):
        """A resposta da API marca o FIM da meia hora em UTC; o leitor próprio do módulo e o parser do módulo
        Carga dão as mesmas horas e os mesmos valores. 25/09/2026 18h, área SECO (jq): carga global 0,5 ×
        (meias horas de 21:30Z e 22:00Z) e MMGD da mesma forma."""
        regs = json.loads(_texto("api_carga_2026_09_semana.json.gz"))
        seco = [x for x in regs if x["cod_areacarga"] == "SECO"]
        lido = m.releitura_api_carga(json.dumps(seco).encode("utf-8"))
        self.assertEqual(len(lido), 168)
        meia = {x["din_referenciautc"][:16]: x for x in seco}
        g18 = 0.5 * (meia["2026-09-25T21:30"]["val_cargaglobal"] + meia["2026-09-25T22:00"]["val_cargaglobal"])
        m18 = 0.5 * (meia["2026-09-25T21:30"]["val_cargammgd"] + meia["2026-09-25T22:00"]["val_cargammgd"])
        self.assertAlmostEqual(lido["2026-09-25T18:00"][0], g18, places=6)
        self.assertAlmostEqual(lido["2026-09-25T18:00"][1], m18, places=6)
        horas, _ = ons_carga.agrega_api(seco)
        for h, (g_, m__) in lido.items():
            a = horas[("SE", h)]
            self.assertAlmostEqual(a["global_mwh"], g_, places=6)
            self.assertAlmostEqual(a["mmgd_mwh"], m__, places=6)
        # campo vazio escrito como na API ("campo": ,) vira ausência e a hora sai
        texto = json.dumps(seco[:2]).replace('"val_cargammgd": ' + json.dumps(seco[0]["val_cargammgd"]), '"val_cargammgd": ', 1)
        self.assertEqual(m.releitura_api_carga(texto), {})

    def test_conferencia_de_perimetro_pura(self):
        """Balanço igual à carga sem MMGD: coeficiente 0 e erro sem MMGD 0; igual à carga com MMGD: coeficiente 1."""
        g = {f"2023-05-01T{h:02d}:00": 1000.0 + 10 * h for h in range(24)}
        mm = {k: float(max(0, 12 - abs(12 - int(k[11:13]))) * 50) for k in g}
        sem = m.conferencia_perimetro({k: g[k] - mm[k] for k in g}, g, mm)["2023-05"]
        com = m.conferencia_perimetro(dict(g), g, mm)["2023-05"]
        self.assertEqual((sem["segue"], round(sem["coef_mmgd"], 9), sem["erro_abs_medio_sem_mmgd"]), ("sem_mmgd", 0.0, 0.0))
        self.assertEqual((com["segue"], round(com["coef_mmgd"], 9), com["erro_abs_medio_com_mmgd"]), ("com_mmgd", 1.0, 0.0))

    def test_reconciliacao_com_pld_json(self):
        amp = [{"periodo": "30d", "inicio": "2026-09-01T00:00", "fim": "2026-09-30T23:00", "horas": 720, "horas_acima_1": 55}]
        ok = m.reconcilia_pld_operacao(amp, {"limiar_diferenca": 1.0, "periodos": {"30d": {
            "inicio": "2026-09-01T00:00", "fim": "2026-09-30T23:00", "n_horas": 720, "diferenca": {"horas_acima_limiar": 55}}}})
        self.assertEqual((len(ok["comparadas"]), ok["divergentes"]), (1, []))
        dif = m.reconcilia_pld_operacao(amp, {"limiar_diferenca": 1.0, "periodos": {"30d": {
            "inicio": "2026-09-01T00:00", "fim": "2026-09-30T23:00", "n_horas": 720, "diferenca": {"horas_acima_limiar": 56}}}})
        self.assertEqual(len(dif["divergentes"]), 1)
        outra = m.reconcilia_pld_operacao(amp, {"limiar_diferenca": 1.0, "periodos": {"30d": {
            "inicio": "2026-08-31T00:00", "fim": "2026-09-29T23:00", "n_horas": 720, "diferenca": {"horas_acima_limiar": 55}}}})
        self.assertEqual(outra["comparadas"], [])
        self.assertIn("janelas diferentes", outra["detalhe"])

    def test_revisoes_compostas_sem_zero_inventado(self):
        rv = m._revisoes_compostas([("PLD (CCEE)", {"total": 2, "exemplos": [{"serie": "pld.SE", "ref": "2026-09-01T00:00", "valores": 2}]}),
                                    ("carga da API (ONS)", None)])
        self.assertEqual(rv["total"], 2)
        self.assertEqual(rv["componentes"], [{"fonte": "PLD (CCEE)", "total": 2}, {"fonte": "carga da API (ONS)", "total": None}])

    def test_texto_da_faixa_de_diferencas(self):
        self.assertEqual(m._faixa_diferenca([-6.09, -5.73, -9.26, -6.24], "da ponderada pela carga sem MMGD"),
                         "de R$ 5,73 a R$ 9,26/MWh abaixo da ponderada pela carga sem MMGD")
        self.assertEqual(m._faixa_diferenca([3.61, 0.39], "da média temporal"), "de R$ 0,39 a R$ 3,61/MWh acima da média temporal")
        self.assertEqual(m._faixa_diferenca([0.0, 0.0], "da média temporal"), "igual à média temporal")

    def test_fichas_sem_resultado_escrito_a_mao(self):
        """Defeito do verificador: testes das fichas com "aprovado" literal. Nenhuma chamada a ev.teste
        ou ev.reconciliacao em pld_detalhe.py pode ter o resultado como constante."""
        with open(m.__file__, encoding="utf-8") as f:
            arvore = ast.parse(f.read())
        literais = []
        for no in ast.walk(arvore):
            if isinstance(no, ast.Call) and isinstance(no.func, ast.Attribute) and no.func.attr in ("teste", "reconciliacao") \
                    and isinstance(no.func.value, ast.Name) and no.func.value.id == "ev" and len(no.args) >= 2:
                if isinstance(no.args[1], ast.Constant) and no.args[1].value == "aprovado":
                    literais.append(no.lineno)
        self.assertEqual(literais, [])


def _descomprime(nome, destino):
    """Cópia descomprimida de uma amostra .gz (o bronze grava o arquivo como a fonte publica)."""
    caminho = os.path.join(destino, nome[:-3] if nome.endswith(".gz") else nome)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        f.write(_texto(nome))
    return caminho


class ConstrucaoDaGold(unittest.TestCase):
    """Constrói a gold a partir de silvers em memória alimentados pelas amostras reais e
    confere valores contra números calculados por awk sobre os arquivos originais. Os
    limites são os atos reais do módulo Regulação."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.p = mock.patch.multiple(base, BRONZE=os.path.join(cls.tmp, "bronze"), SILVER=os.path.join(cls.tmp, "silver"),
                                    DADOS=os.path.join(cls.tmp, "dados"))
        cls.p.start()
        cp = base.conecta(":memory:")
        # PLD de anos anteriores (sazonalidade, regimes, relação com o CMO em 2021) numa vintage sem arquivo
        anteriores = []
        for nome in ("pld_horario_2021_teto_estrutural.csv", "pld_horario_2023_piso.csv", "pld_horario_anteriores_amostra.csv.gz",
                     "pld_horario_2025_amostra.csv.gz", "pld_horario_2025_fluxo.csv", "pld_horario_2023_quebra.csv"):
            anteriores += list(ccee.parse_pld(_texto(nome)))
        v0, _ = base.registra_vintage(cp, "ccee_pld_horario", "pld_horario_anteriores", "u", "2026-09-20T15:00:00Z", None, "9" * 64, 1, "seed", None)
        base.grava_observacoes(cp, "ccee_pld_horario", v0, anteriores)
        # PLD de 2026: horas até 24/09 numa captura e 25/09 numa captura seguinte (instantes de captura
        # SINTÉTICOS, para exercitar a primeira captura observada do achado A09); a segunda tem o arquivo
        # original no bronze, para a reconciliação das fichas por releitura
        pld = list(ccee.parse_pld(_texto("pld_horario_2026_amostra.csv.gz")))
        v1, _ = base.registra_vintage(cp, "ccee_pld_horario", "pld_horario_2026", "u", "2026-09-24T15:00:00Z", None, "a" * 64, 1, "seed", None)
        base.grava_observacoes(cp, "ccee_pld_horario", v1, [x for x in pld if x[1][:10] <= "2026-09-24"])
        arq, sha, n = base.salva_bronze_arquivo("ccee", "ccee_pld_horario", "pld_horario_2026",
                                                _descomprime("pld_horario_2026_amostra.csv.gz", cls.tmp), "csv", "2026-09-25T02:20:00Z")
        v2, _ = base.registra_vintage(cp, "ccee_pld_horario", "pld_horario_2026", "u", "2026-09-25T02:20:00Z", None, sha, n, "coleta_direta", arq)
        base.grava_observacoes(cp, "ccee_pld_horario", v2, pld)
        for ds, nome, parser in (("cmo_se", "cmo_semanal_2026_trecho.csv", ons.parse_cmo),
                                 ("balanco_energia_subsistema_ho", "balanco_2026_amostra.csv.gz", ons.parse_balanco),
                                 ("intercambio_nacional_ho", "intercambio_2026_amostra.csv.gz", ons.parse_intercambio)):
            vid, _ = base.registra_vintage(cp, ds, nome, "u", "2026-09-26T00:00:00Z", None, ("c" + ds)[:64].ljust(64, "0"), 1, "coleta_direta", None)
            base.grava_observacoes(cp, ds, vid, parser(_texto(nome)))
        # fluxo de 25 e 27/01/2025 (separações nas fronteiras N-NE, N-SE e NE-SE, com horas nos dois
        # sentidos) e carga do balanço de 29/04 a 02/05/2023 (mudança de perímetro da carga)
        for ds, nome, parser in (("intercambio_nacional_ho", "intercambio_2025_amostra.csv.gz", ons.parse_intercambio),
                                 ("balanco_energia_subsistema_ho", "balanco_2023_quebra.csv.gz", ons.parse_balanco)):
            vid, _ = base.registra_vintage(cp, ds, nome, "u", "2026-09-26T00:00:00Z", None, ("d" + ds)[:64].ljust(64, "0"), 1, "coleta_direta", None)
            base.grava_observacoes(cp, ds, vid, parser(_texto(nome)))
        # carga de 26/09/2026 nas duas capturas reais do balanço (a de 29/09 com carga negativa no
        # Nordeste, revista na de 30/09): 96 horas-subsistema revistas, que a proveniência mensal conta
        for cap in CAPTURAS_CARGA:
            vid, _ = base.registra_vintage(cp, "balanco_energia_subsistema_ho", "BALANCO_ENERGIA_SUBSISTEMA_2026", "u", cap, None,
                                           ("e" + cap)[:64].ljust(64, "0"), 1, "coleta_direta", None)
            base.grava_observacoes(cp, "balanco_energia_subsistema_ho", vid,
                                   [(f"carga.{r['id_subsistema']}", r["din_instante"][:13].replace(" ", "T") + ":00",
                                     float(r[f"val_carga_captura_{cap}"])) for r in _linhas("carga_20260926_capturas.csv")])
        # carga verificada da API do ONS (silver do módulo Carga), pelo caminho de produção daquele
        # módulo: dias 29/04 a 02/05/2023 e semana de 19 a 25/09/2026, quatro áreas de carga
        cc = base.conecta(":memory:")
        for i, nome in enumerate(("api_carga_2023_quebra.json.gz", "api_carga_2026_09_semana.json.gz")):
            horas_api, _ = ons_carga.agrega_api(ons_carga.parse_api(_texto(nome)))
            vid, _ = base.registra_vintage(cc, m.DS_CARGA_API, nome, "u", "2026-09-30T23:36:42Z", None, str(i) * 64, 1, "coleta_direta", None)
            base.grava_observacoes(cc, m.DS_CARGA_API, vid, ons_carga.observacoes_api(horas_api))
        # descrição do conjunto Carga de Energia (package_show do ONS capturado em 01/10/2026), com os trechos de perímetro
        os.makedirs(os.path.join(cls.tmp, "dados", "meta"), exist_ok=True)
        shutil.copy(os.path.join(DADOS, "nota_carga_energia_meta.json"), os.path.join(cls.tmp, "dados", "meta", f"_meta_{m.DS_NOTA_CARGA}.json"))
        cf = base.conecta(":memory:")
        arq, sha, n = base.salva_bronze_arquivo("ons", m.DS_SH, "CMO_SEMIHORARIO_2026",
                                                _descomprime("cmo_semihorario_2026_amostra.csv.gz", cls.tmp), "csv", "2026-09-26T00:00:00Z")
        obs, _ = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2026_amostra.csv.gz"))
        vid, _ = base.registra_vintage(cf, m.DS_SH, "CMO_SEMIHORARIO_2026", "u", "2026-09-26T00:00:00Z", None, sha, n, "coleta_direta", arq)
        base.grava_observacoes(cf, m.DS_SH, vid, obs)
        obs21, _ = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2021_amostra.csv.gz"))
        vid, _ = base.registra_vintage(cf, m.DS_SH, "CMO_SEMIHORARIO_2021", "u", "2026-09-26T00:00:00Z", None, "f" * 64, 1, "coleta_direta", None)
        base.grava_observacoes(cf, m.DS_SH, vid, obs21)
        # CMO semanal original e dicionários pelo caminho de importação do módulo (bronze temporário)
        for rec, nome, ext in (("CMO_SEMANAL_2023", "CMO_SEMANAL_2023.csv", "csv"), ("CMO_SEMANAL_2023_parquet", "CMO_SEMANAL_2023.parquet", "parquet")):
            arq, sha, n = base.salva_bronze_arquivo("ons", m.DS_A02, rec, os.path.join(DADOS, nome), ext, "2026-09-26T00:00:00Z")
            base.registra_vintage(cf, m.DS_A02, rec, "u", "2026-09-26T00:00:00Z", None, sha, n, "coleta_direta", arq)
        vig = {v["recurso"]: v for v in base.vintages_do_dataset(cf, m.DS_A02)}
        m._importa_semanal_original(cf, vig["CMO_SEMANAL_2023"], vig["CMO_SEMANAL_2023_parquet"])
        for rec, nome in (("DicionarioDados_Cmo_Semanal_json", "DicionarioDados_Cmo_Semanal.json"),
                          ("DicionarioDados_Cmo_Semi_Horario_json", "DicionarioDados_Cmo_Semi_Horario.json")):
            arq, sha, n = base.salva_bronze_arquivo("ons", m.DS_DIC, rec, os.path.join(DADOS, nome), "json", "2026-09-26T00:00:00Z")
            vid, _ = base.registra_vintage(cf, m.DS_DIC, rec, "u", "2026-09-26T00:00:00Z", None, sha, n, "coleta_direta", arq)
            m._importa_dicionario(cf, {"vintage_id": vid, "recurso": rec, "arquivo": arq, "sha256": sha},
                                  "cmo_semi_horario" if "Semi" in rec else "cmo_semanal")
        # Decreto nº 5.163/2004 (recorte real) pelo caminho de importação do módulo; a REN nº 957/2021 e os
        # Procedimentos de Rede ficam de fora de propósito, para exercitar a ausência declarada
        arq, sha, n = base.salva_bronze_arquivo("camara-dos-deputados", m.DS_NORMAS, "decreto_5163_2004",
                                                os.path.join(DADOS, "decreto_5163_normaatualizada_trecho.html"), "html", "2026-09-26T00:00:00Z")
        vid, _ = base.registra_vintage(cf, m.DS_NORMAS, "decreto_5163_2004", normas_pld.URL_DECRETO, "2026-09-26T00:00:00Z", None, sha, n,
                                       "coleta_direta", arq)
        m._importa_norma(cf, {"vintage_id": vid, "recurso": "decreto_5163_2004", "arquivo": arq, "sha256": sha}, "decreto_5163_2004")
        vid, _ = base.registra_vintage(cf, m.DS_IPCA, "ipca_numero_indice", "u", "2026-09-26T00:00:00Z", None, "e" * 64, 1, "coleta_direta", None)
        base.grava_observacoes(cf, m.DS_IPCA, vid, ibge_pld.parse_ipca_sidra(_texto("ipca_sidra_amostra.json")))
        # ato vigente do piso: silver do módulo Regulação simulado com o texto extraído do Despacho
        # nº 3.850/2025 no lugar do PDF (o leitor de PDF é injetado), com o sha256 desse arquivo
        dsp = os.path.join(DADOS, "dsp20253850ti_pdftotext.txt")
        arq_dsp, sha_dsp, n_dsp = base.salva_bronze_arquivo("aneel", "regulacao_documentos", "dsp20253850ti", dsp, "txt", "2026-09-30T23:05:02Z")
        os.makedirs(os.path.join(cls.tmp, "silver"), exist_ok=True)
        reg_db = os.path.join(cls.tmp, "silver", "regulacao_teste.db")
        cr = base.conecta(reg_db)
        # o módulo Regulação baixa o ato da cópia do Internet Archive (o endereço oficial responde 403)
        base.registra_vintage(cr, "regulacao_documentos", "dsp20253850ti", URL_COPIA_DSP, "2026-09-30T23:05:02Z", None, sha_dsp, n_dsp,
                              "coleta_direta", arq_dsp)
        cr.commit()
        cr.close()
        with open(dsp, "rb") as f:
            sha_txt = hashlib.sha256(f.read()).hexdigest()
        docs = regulatorio.documentos()
        docs["dsp20253850ti"] = {**docs["dsp20253850ti"], "sha256": sha_txt}
        cls.csv_dir = os.path.join(cls.tmp, "series")
        # gold de operação pld.json com a janela da amostra: 15 horas com amplitude acima de R$ 1,00/MWh
        # de 19 a 25/09/2026 (awk sobre pld_horario_2026_amostra), para a reconciliação entre as golds
        cls.gold_pld = {"limiar_diferenca": 1.0, "periodos": {"30d": {"inicio": "2026-09-19T00:00", "fim": "2026-09-25T23:00", "n_horas": 168,
                                                                      "diferenca": {"horas_acima_limiar": 15}}}}
        ctx = {"con_principal": cp, "limites_pld": regulatorio.limites_pld(), "destino_csv": cls.csv_dir, "hoje": date(2026, 9, 30),
               "regulacao_db": reg_db, "documentos_regulacao": docs, "ler_pdf": lambda b: b.decode("utf-8").split("\f"),
               "con_carga": cc, "gold_pld": cls.gold_pld}
        cls.g = m.construir(cf, ctx)
        with open(os.path.join(cls.csv_dir, "pld_evidencias.json"), encoding="utf-8") as f:
            cls.ev = json.load(f)["evidencias"]
        with open(os.path.join(cls.csv_dir, "pld_horario_recente.json"), encoding="utf-8") as f:
            cls.recente = json.load(f)
        cls.g_sem_limites = m.construir(cf, {"con_principal": cp, "limites_pld": None, "destino_csv": os.path.join(cls.tmp, "series2"),
                                             "hoje": date(2026, 9, 30), "regulacao_db": None, "carga_db": None, "gold_pld": None})
        cls.cp, cls.cf, cls.cc = cp, cf, cc

    @classmethod
    def tearDownClass(cls):
        cls.cp.close()
        cls.cf.close()
        cls.cc.close()
        cls.p.stop()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_gold_integra_e_serializavel(self):
        self.assertTrue(self.g["disponivel"], self.g.get("motivo"))
        json.dumps(self.g, ensure_ascii=False, allow_nan=False)
        self.assertEqual(self.g["referencia"]["dia"], "2026-09-25")

    def test_semana_alinhada_contra_awk(self):
        """A01: DECOMP, DESSEM e PLD da MESMA semana operativa (19 a 25/09/2026)."""
        sr = self.g["cmo_pld"]["semana_referencia"]
        self.assertEqual((sr["inicio"], sr["fim"]), ("2026-09-19", "2026-09-25"))
        n = next(x for x in sr["por_sm"] if x["sm"] == "N")
        self.assertEqual(n["decomp"], 1866.74)                      # CMO_SEMANAL_2026.csv, N, 2026-09-25
        self.assertAlmostEqual(n["dessem"], 86.541399, places=2)    # awk: média das 336 meias horas
        self.assertAlmostEqual(n["pld"], 124.093393, places=2)      # awk: média das 168 horas
        self.assertAlmostEqual(n["pld_menos_decomp"], 124.09 - 1866.74, places=2)
        s = next(x for x in sr["por_sm"] if x["sm"] == "S")
        self.assertAlmostEqual(s["pld"], 120.863571, places=2)
        for proibido in ("vezes", "multiplic", "x o "):
            self.assertNotIn(proibido, sr["texto"].lower())

    def test_semana_incompleta_fica_sem_media(self):
        sem = self.g["cmo_pld"]["semanal"]
        i = sem["fim"].index("2026-09-18")  # semana sem PLD e sem DESSEM na amostra
        self.assertIsNone(sem["N"]["pld"][i])
        self.assertIsNone(sem["N"]["dessem"][i])
        self.assertEqual(sem["N"]["decomp"][i], 1444.32)

    def test_csv_semanal_equivale_a_gold(self):
        with open(os.path.join(self.csv_dir, "pld_cmo_semanal.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        sem = self.g["cmo_pld"]["semanal"]
        self.assertEqual(len(linhas), len(sem["fim"]) * 4)
        for r in linhas:
            i = sem["fim"].index(r["semana_fim"])
            g = sem[r["sm"]]["pld"][i]
            self.assertEqual(r["pld_media"] == "", g is None)  # ausência vazia nos dois
            if g is not None:
                self.assertAlmostEqual(float(r["pld_media"]), g, delta=0.005)
        eq = self.g["cmo_pld"]["equivalencia_csv"]
        self.assertEqual(eq["divergentes"], 0)
        self.assertEqual(eq["celulas"], len(sem["fim"]) * 4 * 3)

    def test_relacao_pld_cmo_exclui_dia_no_teto_estrutural(self):
        """06/07/2021: a média do Sudeste (583,88375, awk) está no teto estrutural de 2021 (583,88): as 24
        horas ficam fora da comparação livre com o CMO; 27/09/2021 entra. Mediana de |PLD − CMO| e média
        de PLD − CMO por awk sobre os arquivos originais do PLD e do CMO semi-horário."""
        r = next(x for x in self.g["cmo_pld"]["relacao_anual"] if x["ano"] == 2021 and x["sm"] == "SE")
        self.assertEqual((r["horas_pld"], r["horas_com_cmo"], r["horas_sem_cmo"]), (72, 48, 24))
        self.assertEqual(r["por_situacao"]["teto_estrutural_no_dia"], 24)
        self.assertEqual(r["por_situacao"]["entre"], 24)
        self.assertEqual(r["entre"]["n"], 24)
        self.assertAlmostEqual(r["entre"]["mediana_abs_dif"], 7.565, delta=0.006)
        self.assertAlmostEqual(r["entre"]["media_dif"], 5.945, delta=0.006)
        self.assertAlmostEqual(r["todas"]["media_dif"], -197.105937, delta=0.006)

    def test_permanencia_nos_limites(self):
        lim = self.g["limites"]
        self.assertTrue(lim["disponivel"])
        se26 = next(x for x in lim["permanencia_anual"] if x["ano"] == 2026 and x["sm"] == "SE")
        self.assertEqual(se26["horas"], 192)             # 30/03 e 19 a 25/09
        self.assertEqual(se26["horas_teto_horario"], 2)  # 30/03/2026 às 19h e às 20h: R$ 1.611,04/MWh
        self.assertEqual((se26["controle_abaixo_do_piso"], se26["controle_acima_do_teto"]), (0, 0))
        self.assertEqual(lim["regra_menor_observado"][:19], "O menor valor obser")
        emp = next(x for x in lim["empates_piso"] if x["ano"] == 2026)
        self.assertEqual(sum(emp["por_quantidade_no_piso"].values()), emp["horas"])

    def test_um_centavo_acima_do_piso_fica_em_classe_a_parte(self):
        """2022 na amostra (16/01, 13/09 e 26/09, Sudeste): 52 horas iguais ao piso de R$ 55,70/MWh e 1 hora
        a R$ 55,71/MWh (16/01 às 04h), awk. A sensibilidade com R$ 0,01/MWh junta as duas."""
        se22 = next(x for x in self.g["limites"]["permanencia_anual"] if x["ano"] == 2022 and x["sm"] == "SE")
        self.assertEqual((se22["horas"], se22["horas_piso"], se22["horas_um_centavo_acima_do_piso"]), (72, 52, 1))
        self.assertEqual(se22["sensibilidade_um_centavo"]["horas_piso"], 53)
        self.assertEqual(self.g["limites"]["tolerancia"]["hora"], 0.005)

    def test_atos_publicados_com_nivel_de_conferencia(self):
        lim = self.g["limites"]
        nivel = {a["ato"]: a["nivel_conferencia"] for a in lim["atos"]}
        self.assertEqual(nivel["Resolução Homologatória ANEEL nº 2.828/2020"], "documento_oficial_do_processo")
        self.assertEqual(nivel["Despacho ANEEL nº 3.850/2025"], "texto_do_ato")
        self.assertEqual(lim["conferencia_atos"]["por_nivel"], {"documento_oficial_do_processo": 3, "texto_do_ato": 5})
        # a proveniência dos limites lista a URL de cada fonte, inclusive a ANEEL
        urls = [u["url_dataset"] for u in self.g["proveniencia"]["limites"]["fonte"]["urls"]]
        self.assertIn("https://dadosabertos.ccee.org.br/dataset/pld_horario", urls)
        self.assertIn("https://www2.aneel.gov.br/cedoc/dsp20253850ti.pdf", urls)

    def test_sem_limites_o_bloco_declara_a_dependencia(self):
        lim = self.g_sem_limites["limites"]
        self.assertFalse(lim["disponivel"])
        self.assertIn("Regulação", lim["dependencia"])
        self.assertTrue(self.g_sem_limites["disponivel"])  # o restante da gold continua publicável
        # sem ato, nenhuma fração no piso é inventada
        self.assertIsNone(next(x for x in self.g_sem_limites["historico"]["regimes"] if x["ano"] == 2026)["frac_piso"])

    def test_separacao_e_fluxo_contra_awk(self):
        # awk sobre os originais, com limiar na precisão do centavo (|Δ| > 0,015): na semana de 19 a
        # 25/09/2026, Sul e Sudeste/Centro-Oeste diferem por mais de um centavo em 15 horas e por
        # exatamente um centavo em 64; em 30/03/2026, 13 horas separadas
        sep30 = next(x for x in self.g["regional"]["separacao"] if x["periodo"] == "30d" and x["par"] == "SE_S")
        self.assertEqual((sep30["horas"], sep30["horas_separadas"], sep30["horas_diferenca_de_um_centavo"]), (168, 15, 64))
        sep26 = next(x for x in self.g["regional"]["separacao"] if x["periodo"] == "2026" and x["par"] == "SE_S")
        self.assertEqual(sep26["horas_separadas"], 15 + 13)
        f = next(x for x in self.g["regional"]["fluxos"] if x["periodo"] == "2026" and x["fronteira"] == "S_SE")
        self.assertEqual(f["horas_com_fluxo"], 168)  # o intercâmbio da amostra cobre só a semana
        self.assertEqual((f["horas_separadas"], f["do_menor_para_o_maior"], f["do_maior_para_o_menor"], f["fluxo_nulo"]), (15, 15, 0, 0))

    def test_amplitude_contra_awk(self):
        """Amplitude = maior menos menor PLD entre os quatro submercados na mesma hora (awk). Em 2021 o
        Sudeste é o maior preço em 16/01 (os outros três iguais), em 2026 o Sul e o Norte separam: tirar
        qualquer submercado muda pelo menos uma das contagens."""
        amp = {x["periodo"]: x for x in self.g["regional"]["amplitude"]}
        self.assertEqual((amp["30d"]["horas"], amp["30d"]["horas_com_separacao"]), (168, 46))
        self.assertAlmostEqual(amp["30d"]["media"], 3.23, places=2)
        self.assertEqual((amp["30d"]["max"], amp["30d"]["quando_max"]), (56.05, "2026-09-24T01:00"))
        self.assertEqual((amp["2026"]["horas"], amp["2026"]["horas_com_separacao"]), (192, 68))
        self.assertAlmostEqual(amp["2026"]["media"], 17.867969, delta=0.006)
        self.assertEqual((amp["2026"]["max"], amp["2026"]["quando_max"]), (366.0, "2026-03-30T15:00"))
        self.assertEqual((amp["2021"]["horas"], amp["2021"]["horas_com_separacao"]), (72, 32))
        self.assertAlmostEqual(amp["2021"]["media"], 20.400556, delta=0.006)
        self.assertEqual((amp["2021"]["max"], amp["2021"]["quando_max"]), (120.91, "2021-09-27T19:00"))

    def test_matriz_antissimetrica_e_reconciliada(self):
        mt = self.g["regional"]["matriz"]
        for i in range(4):
            for j in range(4):
                if i != j:
                    self.assertAlmostEqual(mt["dif_media"][i][j], -mt["dif_media"][j][i], delta=0.011)
        for x in self.g["regional"]["separacao"]:
            if x["periodo"] == "12m":
                a, b = x["par"].split("_")
                self.assertEqual(x["frac_separadas"], mt["frac_separadas"][m.SM.index(a)][m.SM.index(b)])

    def test_ponderada_so_nas_horas_com_carga(self):
        mh = self.g["historico"]["mensal"]
        i = mh["meses"].index("2026-09")
        self.assertEqual(mh["SE"]["horas_com_carga"][i], 24)
        self.assertFalse(mh["SE"]["mesmas_horas"][i])
        self.assertAlmostEqual(mh["SE"]["ponderada_carga"][i], 108.36, places=2)
        self.assertIsNone(mh["SE"]["real"][i])  # IPCA de setembro/2026 ainda não publicado
        self.assertEqual(self.g["historico"]["ponderacao"]["horas_retiradas"], [])
        ctrl = next(x for x in self.g["controles"] if x["nome"].startswith("Carga do ONS"))
        self.assertEqual(ctrl["resultado"], "aprovado")

    def test_moeda_constante_contra_awk(self):
        """Agosto de 2025 (só 20/08 na amostra), Sudeste: média temporal 318,532083 (awk) × IPCA de 08/2026
        (7.633,23) ÷ IPCA de 08/2025 (7.323,91) = 331,985054. Índices trocados dariam 305,63."""
        mh = self.g["historico"]["mensal"]
        i = mh["meses"].index("2025-08")
        self.assertAlmostEqual(mh["SE"]["temporal"][i], 318.53, places=2)
        self.assertAlmostEqual(mh["SE"]["real"][i], 331.99, places=2)
        self.assertEqual(self.g["historico"]["deflator"]["mes_base"], "2026-08")
        self.assertTrue(mh["parcial"][i])

    def test_sazonal_contra_awk(self):
        """Setembros de 2021 a 2025 na amostra (12 dias completos, Sudeste): quantis tipo 7 por awk; o dia de
        referência (25/09/2026, média 106,6075) fica acima de 4 dos 12 (percentil 33,3) e de 2 dos 8 dias da
        semana ISO 39 (percentil 25,0). O próprio ano de referência não entra na distribuição."""
        saz = next(x for x in self.g["historico"]["sazonal_mes"] if x["sm"] == "SE" and x["mes"] == 9)
        self.assertEqual((saz["n"], saz["anos"]), (12, [2021, 2022, 2023, 2024, 2025]))
        for k, v in (("p10", 57.0558), ("p25", 69.04), ("p50", 260.8529), ("p75", 319.5138), ("p90", 346.2535)):
            self.assertAlmostEqual(saz[k], v, delta=0.006, msg=k)
        pos = next(x for x in self.g["historico"]["posicao_referencia"] if x["sm"] == "SE")
        self.assertAlmostEqual(pos["media_dia"], 106.61, places=2)
        self.assertEqual((pos["mesmo_mes"]["percentil"], pos["mesmo_mes"]["n_dias"]), (33.3, 12))
        self.assertEqual((pos["mesma_semana_iso"]["semana"], pos["mesma_semana_iso"]["percentil"], pos["mesma_semana_iso"]["n_dias"]),
                         (39, 25.0, 8))
        self.assertEqual(pos["mesma_semana_iso"]["anos"], [2021, 2022, 2023, 2024, 2025])

    def test_regimes_e_perfil_contra_awk(self):
        reg = next(x for x in self.g["historico"]["regimes"] if x["ano"] == 2021 and x["sm"] == "SE")
        self.assertEqual(reg["n"], 72)
        for k, v in (("p10", 209.52), ("p25", 214.8475), ("p50", 552.055), ("p75", 592.6975), ("p90", 595.99)):
            self.assertAlmostEqual(reg[k], v, delta=0.006, msg=k)
        self.assertAlmostEqual(reg["media"], 452.462083, delta=0.006)
        self.assertEqual(reg["limites"], [{"pld_min": 49.77, "pld_max_horario": 1197.87, "pld_max_estrutural": 583.88}])
        perfil = self.g["historico"]["perfil_hora_mes"]
        i = perfil["meses"].index("2026-09")
        # média das 7 horas de 19 a 25/09/2026 no Sudeste (awk): 18h 499,29; 19h 432,194286; 20h 206,488571
        self.assertEqual(perfil["SE"][i][18], 499.29)
        self.assertAlmostEqual(perfil["SE"][i][19], 432.19, places=2)
        self.assertAlmostEqual(perfil["SE"][i][20], 206.49, places=2)
        self.assertEqual(perfil["SE"][perfil["meses"].index("2026-03")][19], 1611.04)

    def test_mapa_hora_dia_sob_demanda(self):
        hd = self.g["historico"]["hora_dia"]
        self.assertEqual((hd["url"], hd["inicio"], hd["fim"], hd["dias"]), ("/energia/series/pld_hora_dia.json", "2026-06-28", "2026-09-25", 90))
        with open(os.path.join(self.csv_dir, "pld_hora_dia.json"), encoding="utf-8") as f:
            arq = json.load(f)
        self.assertEqual(len(arq["dias"]), 90)
        i = arq["dias"].index("2026-09-25")
        pld = {int(r["HORA"]): float(r["PLD_HORA"]) for r in _linhas("pld_horario_2026_amostra.csv.gz")
               if r["SUBMERCADO"] == "SUDESTE" and r["MES_REFERENCIA"] == "202609" and r["DIA"] == "25"}
        self.assertEqual(arq["SE"][i], [pld[h] for h in range(24)])
        self.assertEqual(arq["SE"][arq["dias"].index("2026-09-01")], [None] * 24)  # dia sem PLD na amostra: ausência
        self.assertEqual(hd["dias_completos_no_recorte"], 7)

    def test_a02_confirmado_no_original(self):
        a02 = self.g["achados"]["A02"]
        regs = base.registros_como_estavam_em(self.cf, m.DS_A02)["CMO_SEMANAL_2023"]
        self.assertEqual(regs["linhas_todas_zero"], "208")
        self.assertEqual(regs["parquet_celulas_iguais"], regs["parquet_celulas"])
        self.assertEqual(a02["reconciliacao_silver_principal"]["diferentes"], 0)

    def test_a03_documenta_sem_corrigir(self):
        a03 = self.g["achados"]["A03"]
        self.assertEqual(a03["unidade_media_semanal_no_dicionario"], "R$/MW")
        self.assertEqual(a03["unidade_patamares_no_dicionario"], "R$/MWh")
        self.assertEqual(a03["verificacao"]["semanas_subsistema"], a03["verificacao"]["media_entre_min_e_max_dos_patamares"])

    def test_a09_primeira_captura_nao_e_publicacao(self):
        a09 = self.g["achados"]["A09"]
        self.assertIsNone(a09["publicado_pela_fonte_em"])
        d25 = next(x for x in a09["dias_com_captura_direta"] if x["dia"] == "2026-09-25")
        self.assertEqual(d25["primeira_captura_completa"], "2026-09-25T02:20:00Z")
        self.assertAlmostEqual(d25["antecedencia_ao_inicio_do_dia_h"], 0.67, places=2)  # 23h20 de 24/09 em Brasília
        self.assertAlmostEqual(d25["folga_lat1d_h"], 48.67, places=2)

    def test_evidencias_no_contrato_compartilhado(self):
        """Fichas montadas por pipeline/energia/evidencia.py, publicadas em arquivo próprio (a gold só
        traz o índice): validação sem problemas, chaves na ordem do contrato e reconciliação por releitura
        do arquivo original com valor conferido por awk."""
        from pipeline.energia import evidencia as ev
        self.assertTrue(self.ev)
        self.assertEqual(set(self.ev), set(self.g["evidencias"]["indice"]))
        self.assertEqual(self.g["evidencias"]["arquivo"], "/energia/series/pld_evidencias.json")
        for k, e in self.ev.items():
            self.assertEqual(ev.validar(e), [], k)
            self.assertEqual(tuple(e), ev.CAMPOS, k)
            self.assertTrue(e["testes"], k)
        e = self.ev["pld_semana_N"]
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        self.assertIn("releitura de pld_horario_2026", e["reconciliacao"]["descricao"])
        self.assertIn("124,093393", e["reconciliacao"]["descricao"])   # awk sobre a amostra da CCEE
        self.assertEqual(e["denominador"]["valor"], 168)
        self.assertAlmostEqual(e["valor_calculo"], 124.093393, places=5)
        self.assertEqual(e["valor_exibido"], "R$ 124,09/MWh")
        self.assertEqual([t["resultado"] for t in e["testes"]], ["aprovado", "aprovado"])
        # a data de publicação da CCEE não é confiável (A09): nunca aparece na ficha
        self.assertIsNone(e["fonte"]["publicado_em"])
        # DESSEM: releitura do CSV do ONS no bronze, 336 meias horas
        dn = self.ev["dessem_semana_N"]
        self.assertEqual(dn["reconciliacao"]["resultado"], "aprovado")
        self.assertIn("86,541399", dn["reconciliacao"]["descricao"])
        sep = self.ev["separacao_12m_SE_S"]
        self.assertEqual((sep["numerador"]["valor"], sep["reconciliacao"]["resultado"]), (28, "aprovado"))

    def test_ficha_do_piso_cita_o_ato_da_aneel(self):
        """Defeito do verificador: a ficha de horas no piso mostrava só o arquivo da CCEE. O ato vigente
        (Despacho nº 3.850/2025) entra como segundo arquivo, com URL, página e conferência do trecho."""
        e = self.ev["piso_2026_SE"]
        arqs = e["fonte"]["arquivos"]
        self.assertEqual(len(arqs), 2)
        self.assertEqual(arqs[1]["url"], "https://www2.aneel.gov.br/cedoc/dsp20253850ti.pdf")
        self.assertEqual(arqs[1]["nivel_conferencia"], "texto_do_ato")
        self.assertEqual(e["extracao_pdf"]["pagina"], "página 1 do PDF")
        self.assertIn("4 de 4 partes", e["extracao_pdf"]["conferencia"])
        t = next(x for x in e["testes"] if x["nome"] == "ato vigente conferido no PDF")
        self.assertEqual(t["resultado"], "aprovado")
        self.assertIn("dsp20253850ti.pdf", e["consulta"])
        # 2026 na amostra, Sudeste: 92 de 192 horas no piso de R$ 57,31/MWh (awk); recontagem no arquivo original
        self.assertEqual((e["numerador"]["valor"], e["denominador"]["valor"]), (92, 192))
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")

    def test_fichas_ponderada_sem_mes_completo(self):
        """A amostra não tem mês completo com carga: nenhuma ficha de média ponderada é publicada
        (nada de ficha sobre mês parcial)."""
        self.assertFalse(any(k.startswith("ponderada_") for k in self.ev))

    def test_conceito_cita_so_o_que_conferiu(self):
        cc = self.g["conceito"]
        ids = {f["id"] for f in cc["fontes_textuais"]}
        self.assertIn("d5163_art57_caput", ids)
        caput = next(f for f in cc["fontes_textuais"] if f["id"] == "d5163_art57_caput")
        self.assertEqual(caput["texto"], "Art. 57. A contabilização e a liquidação no mercado de curto prazo serão realizadas com base no PLD.")
        self.assertEqual(cc["documentos_normativos"]["decreto_5163_2004"]["url"], normas_pld.URL_DECRETO)
        # REN nº 957/2021 e Procedimentos de Rede não coletados neste ensaio: nada citado, ausência declarada
        self.assertFalse(any(i.startswith(("ren957", "pr24", "pr43", "pr45", "dessem_")) for i in ids))
        self.assertEqual({x["motivo"] for x in cc["normas_nao_conferidas"]}, {"documento não coletado"})
        self.assertIsNone(cc["documentos_normativos"]["ren_aneel_957_2021"]["sha256"])
        # sem as passagens dos Procedimentos de Rede, o momento do cálculo do ONS fica sem valor e com motivo
        prod = {p_["id"]: p_ for p_ in self.g["cmo_pld"]["produtos"]}
        self.assertIsNone(prod["dessem_semi_horario"]["momento_do_calculo"])
        self.assertIn("Procedimentos de Rede", prod["dessem_semi_horario"]["momento_do_calculo_motivo"])
        self.assertIn("CEPEL", cc["bloqueios"][0]["fonte"])

    def test_exemplo_rotulado_e_com_pld_real(self):
        ex = self.g["conceito"]["exemplo_liquidacao"]
        self.assertEqual(ex["natureza"], "EXEMPLO_SINTETICO")
        self.assertIn("hipotéticas", ex["aviso"])
        # dia de referência da amostra: 25/09/2026; maior PLD do Sudeste/Centro-Oeste no dia (awk sobre a amostra)
        pld = {int(r["HORA"]): float(r["PLD_HORA"]) for r in _linhas("pld_horario_2026_amostra.csv.gz")
               if r["SUBMERCADO"] == "SUDESTE" and r["MES_REFERENCIA"] == "202609" and r["DIA"] == "25"}
        hmax = min(h for h in pld if pld[h] == max(pld.values()))
        self.assertEqual((ex["pld"]["hora"], ex["pld"]["valor"]), (f"2026-09-25T{hmax:02d}:00", pld[hmax]))
        # a base normativa só lista passagens conferidas (a REN não foi coletada neste ensaio)
        self.assertEqual(ex["base_normativa"], ["d5163_art57_caput", "d5163_art57_p5"])
        self.assertEqual(sum(a["diferenca_mwh"] for a in ex["agentes"]), 0)

    def test_proveniencias_com_limitacoes(self):
        for k, p in self.g["proveniencia"].items():
            self.assertTrue(p["limitacoes"], k)
            if p["natureza"] == "CALCULADO":
                self.assertTrue(p["formula"], k)

    def test_metricas_e_naturezas_coincidem_com_proveniencias(self):
        """Defeito do verificador: o CMO do DESSEM saía OBSERVADO na proveniência e ESTIMADO no catálogo.
        Cada métrica publicada existe no catálogo; a natureza da transformação é a da proveniência do
        cálculo e a natureza da fonte, a da proveniência do dado de origem."""
        catalogo = {x["id"]: x for x in metricas.todas()}
        prov = self.g["proveniencia"]
        publicadas = [i for ids in self.g["metricas"].values() for i in ids]
        self.assertEqual(set(publicadas), set(self.g["metricas_proveniencia"]))
        for mid in publicadas:
            self.assertIn(mid, catalogo)
            mp = self.g["metricas_proveniencia"][mid]
            self.assertEqual(catalogo[mid]["natureza_transformacao"], prov[mp["calculo"]]["natureza"], mid)
            if mp["fonte"]:
                self.assertEqual(catalogo[mid]["natureza_fonte"], prov[mp["fonte"]]["natureza"], mid)
        self.assertEqual(prov["cmo_semi_horario"]["natureza"], "ESTIMADO")
        # o CMO semi-horário chega a ter o dia seguinte publicado: valor programado, nunca "observado"
        self.assertGreaterEqual(prov["cmo_semi_horario"]["periodo_referencia"]["fim"], self.g["referencia"]["ultima_hora_pld"])

    def test_cmo_json_tambem_estimado(self):
        """A gold de operação cmo.json (CMO semanal do DECOMP) usa a mesma natureza do catálogo."""
        from pipeline.energia.gold import cmo
        with mock.patch.object(base, "SERIES", os.path.join(self.tmp, "series_cmo")):
            g = cmo.construir(self.cp)
        self.assertTrue(g["disponivel"])
        # medidas calculadas sobre o CMO semanal neste módulo (regras de outros módulos que só citam
        # o conjunto entre muitas fontes, como a de atualidade da Visão geral, não entram)
        nat = {x["natureza_fonte"] for x in metricas.todas() if "cmo_se" in x["fontes"] and x["arquivo"].endswith("/pld.py")}
        self.assertEqual(nat, {"ESTIMADO"})
        self.assertEqual(g["proveniencia"]["cmo"]["natureza"], "ESTIMADO")

    def test_controles_do_ato_e_da_publicacao(self):
        nomes = {x["nome"]: x for x in self.g["controles"]}
        ato = nomes["Ato vigente do piso no dia de referência: trecho e valor conferidos no PDF do ato"]
        self.assertEqual(ato["resultado"], "aprovado")
        pub = nomes["Data de publicação do CMO semi-horário conferida no S3 (ETag igual ao MD5 do arquivo capturado)"]
        self.assertEqual(pub["resultado"], "ressalva")   # o silver de teste não tem conferência registrada
        self.assertIn("sem conferência registrada", pub["detalhe"])

    # ------------------------------------------------------------------ verificação de 01/10/2026

    def _csv(self, nome):
        with open(os.path.join(self.csv_dir, nome), encoding="utf-8") as f:
            return list(csv.DictReader(f, delimiter=";"))

    def test_perimetro_da_carga_antes_e_depois_da_quebra(self):
        """Defeito 1: a carga do balanço usada como peso muda de perímetro em 29/04/2023 (MMGD estimada).
        Dois dias reais antes (29 e 30/04/2023) e dois depois (01 e 02/05/2023): por awk e jq sobre o CSV do
        balanço e a resposta da API de carga verificada, o balanço segue a carga SEM MMGD em abril (SE: erro
        absoluto médio 112,2473 contra 1.821,1145 MWmed com MMGD; coeficiente da MMGD 0,0038) e COM MMGD em
        maio (1.135,7729 contra 1.679,3250; coeficiente 0,8213). No dado horário, a MMGD aparece em 01/05/2023."""
        mh = self.g["historico"]["mensal"]
        per = dict(zip(mh["meses"], mh["perimetro_carga"]))
        self.assertEqual((per["2021-01"], per["2022-09"], per["2023-04"], per["2023-05"], per["2026-09"]), ("P1", "P2", "P2_P3", "P3", "P3"))
        esperado = {("SE", "2023-04"): (112.2473, 1821.1145, 0.0038), ("SE", "2023-05"): (1679.3250, 1135.7729, 0.8213),
                    ("S", "2023-04"): (162.5694, 843.1435, -0.0043), ("S", "2023-05"): (937.5494, 332.1264, 1.0287),
                    ("NE", "2023-04"): (403.9341, 702.2752, -0.0637), ("NE", "2023-05"): (697.6071, 240.0878, 0.8563),
                    ("N", "2023-04"): (230.0147, 325.2177, 0.0050), ("N", "2023-05"): (194.8806, 68.9825, 0.7898)}
        linhas = {(r["sm"], r["mes"]): r for r in self._csv("pld_mensal.csv")}
        for (sm, mes), (e_sem, e_com, coef) in esperado.items():
            r = linhas[(sm, mes)]
            self.assertEqual(r["perimetro_carga"], per[mes])
            self.assertEqual(r["horas_conferencia_perimetro"], "48")
            self.assertAlmostEqual(float(r["erro_abs_medio_balanco_vs_global_sem_mmgd"]), e_sem, delta=0.0002, msg=(sm, mes))
            self.assertAlmostEqual(float(r["erro_abs_medio_balanco_vs_global_com_mmgd"]), e_com, delta=0.0002, msg=(sm, mes))
            self.assertAlmostEqual(float(r["coef_mmgd_no_balanco"]), coef, delta=0.0002, msg=(sm, mes))
            # PLD no piso nos quatro dias: as duas ponderadas e a temporal coincidem (R$ 69,04/MWh)
            self.assertEqual(float(r["media_ponderada_carga"]), 69.04)
            self.assertEqual(float(r["media_ponderada_carga_sem_mmgd"]), 69.04)
        pond = self.g["historico"]["ponderacao"]
        q = {x["data"]: x for x in pond["quebras"]}
        self.assertEqual(q["2023-04-29"]["inicio_observado_no_balanco"], "2023-05-01")
        self.assertTrue(q["2023-04-29"]["conferida_no_dado"])
        self.assertFalse(q["2021-03-01"]["conferida_no_dado"])
        self.assertEqual(pond["conferencia_perimetro"]["meses_divergentes"], [])
        # os três trechos da descrição do ONS conferidos literalmente na captura do package_show
        self.assertEqual([p_["trecho_conferido"] for p_ in pond["perimetros"]], [True, True, True])
        self.assertEqual([p_["natureza_do_peso"] for p_ in pond["perimetros"]], ["OBSERVADO", "ESTIMADO", "ESTIMADO"])
        ctrl = next(x for x in self.g["controles"] if x["nome"].startswith("Perímetro da carga do balanço"))
        self.assertEqual(ctrl["resultado"], "aprovado", ctrl["detalhe"])
        self.assertIn("01/05/2023", ctrl["detalhe"])

    def test_natureza_e_limitacoes_declaram_a_mmgd(self):
        """Defeito 1: o peso do balanço é ESTIMADO (previsão de usinas não despachadas desde 03/2021 e MMGD
        estimada desde 29/04/2023) no catálogo e na proveniência; o peso sem MMGD é OBSERVADO."""
        catalogo = {x["id"]: x for x in metricas.todas()}
        prov = self.g["proveniencia"]
        self.assertEqual(catalogo["pld_media_mensal_ponderada_carga"]["natureza_fonte"], "ESTIMADO")
        self.assertEqual(prov["peso_carga_balanco"]["natureza"], "ESTIMADO")
        self.assertEqual(catalogo["pld_media_mensal_ponderada_carga_sem_mmgd"]["natureza_fonte"], "OBSERVADO")
        self.assertEqual(prov["peso_carga_sem_mmgd"]["natureza"], "OBSERVADO")
        texto = " ".join(prov["historico_mensal"]["limitacoes"]) + " " + " ".join(catalogo["pld_media_mensal_ponderada_carga"]["limitacoes"])
        for termo in ("MMGD", "03/2021", "29/04/2023", "01/05/2023", "perimetro_carga"):
            self.assertIn(termo, texto + catalogo["pld_media_mensal_ponderada_carga"]["definicao"]
                          + " ".join(catalogo["pld_media_mensal_ponderada_carga"]["regras_comparabilidade"]), termo)
        self.assertNotIn("carga verificada do subsistema", self.g["historico"]["ponderacao"]["peso"])
        self.assertIn("https://dados.ons.org.br/dataset/carga-energia-verificada",
                      [u["url_dataset"] for u in prov["historico_mensal"]["fonte"]["urls"]])

    def test_ponderada_sem_mmgd_contra_awk(self):
        """Semana de 19 a 25/09/2026: Σ PLD × (carga global − MMGD) ÷ Σ (carga global − MMGD), com as meias
        horas da API somadas por hora (fim da meia hora em UTC menos 3 h 30 min), por jq e awk sobre a resposta
        da API e o CSV da CCEE: SE 138,768538; S 141,105905; NE 140,438920; N 132,297633 (168 horas cada)."""
        mh = self.g["historico"]["mensal"]
        i = mh["meses"].index("2026-09")
        for sm, v in (("SE", 138.768538), ("S", 141.105905), ("NE", 140.438920), ("N", 132.297633)):
            self.assertAlmostEqual(mh[sm]["ponderada_carga_sem_mmgd"][i], v, delta=0.006, msg=sm)
            self.assertEqual((mh[sm]["horas_com_carga_sem_mmgd"][i], mh[sm]["mesmas_horas_sem_mmgd"][i]), (168, True))
        se = next(r for r in self._csv("pld_mensal.csv") if r["sm"] == "SE" and r["mes"] == "2026-09")
        self.assertAlmostEqual(float(se["media_ponderada_carga_sem_mmgd"]), 138.768538, delta=0.0001)
        # sem mês completo na amostra, nenhuma sensibilidade e nenhuma ficha de mês parcial
        self.assertIsNone(self.g["historico"]["ponderacao"]["sensibilidade_peso"])
        self.assertFalse(any(k.startswith("ponderada_sem_mmgd_") for k in self.ev))

    def test_sem_silver_da_carga_a_ponderada_sem_mmgd_fica_ausente(self):
        mh = self.g_sem_limites["historico"]["mensal"]
        self.assertTrue(all(v is None for sm in m.SM for v in mh[sm]["ponderada_carga_sem_mmgd"]))
        pond = self.g_sem_limites["historico"]["ponderacao"]
        self.assertFalse(pond["peso_sem_mmgd"]["disponivel"])
        self.assertIn("ons_carga.db", pond["peso_sem_mmgd"]["motivo"])
        self.assertNotIn("peso_carga_sem_mmgd", self.g_sem_limites["proveniencia"])
        self.assertIsNone(self.g_sem_limites["metricas_proveniencia"]["pld_media_mensal_ponderada_carga_sem_mmgd"]["fonte"])
        ctrl = next(x for x in self.g_sem_limites["controles"] if x["nome"].startswith("Perímetro da carga do balanço"))
        self.assertEqual(ctrl["resultado"], "ressalva")

    def test_revisoes_da_proveniencia_mensal_incluem_a_carga(self):
        """Defeito 6: a carga de 26/09/2026 foi revista em 96 horas-subsistema entre as capturas de 29 e 30/09
        (awk sobre carga_20260926_capturas.csv); o PLD da amostra não tem revisão. A proveniência mensal
        soma as duas fontes em vez de mostrar só o snapshot do PLD."""
        rv = self.g["proveniencia"]["historico_mensal"]["revisoes_conhecidas"]
        comp = {x["fonte"]: x["total"] for x in rv["componentes"]}
        self.assertEqual(comp, {"PLD (CCEE)": 0, "carga do balanço (ONS)": 96, "carga da API (ONS)": 0})
        self.assertEqual(rv["total"], 96)
        self.assertTrue(all(x["serie"].startswith("carga.") and x["ref"][:10] == "2026-09-26" for x in rv["exemplos"]))
        self.assertEqual(self.g["proveniencia"]["peso_carga_balanco"]["revisoes_conhecidas"]["total"], 96)

    def test_fluxo_nas_quatro_fronteiras_contra_awk(self):
        """Defeito 2: 25 e 27/01/2025 têm horas separadas nas quatro fronteiras e horas com fluxo do maior para
        o menor preço. awk sobre o CSV da CCEE e o INTERCAMBIO_NACIONAL_2025 do ONS (orientação canônica, linha
        no sentido verificado): N-NE 14 separadas (12 do menor para o maior, 2 ao contrário), N-SE 14 (14, 0),
        NE-SE 16 (15, 1), S-SE 7 (7, 0); fluxo médio nas separadas 3.038,35; 5.035,10; 1.426,46; −1.621,78 MWmed.
        Inverter o sinal de uma fronteira ou trocar duas fronteiras muda pelo menos um desses números."""
        fl = {x["fronteira"]: x for x in self.g["regional"]["fluxos"] if x["periodo"] == "2025"}
        for fr, (sep, mm, mM, nulo, media) in {"N_NE": (14, 12, 2, 0, 3038.345786), "N_SE": (14, 14, 0, 0, 5035.098857),
                                                 "NE_SE": (16, 15, 1, 0, 1426.460875), "S_SE": (7, 7, 0, 0, -1621.775)}.items():
            x = fl[fr]
            self.assertEqual((x["horas_com_fluxo"], x["horas_separadas"], x["do_menor_para_o_maior"], x["do_maior_para_o_menor"],
                              x["fluxo_nulo"]), (48, sep, mm, mM, nulo), fr)
            self.assertAlmostEqual(x["fluxo_medio_separadas"], media, delta=0.006, msg=fr)
        # CSV diário: par NE_N em 25/01/2025, fronteira N_NE, fluxo médio das 24 horas (awk) e 7 horas separadas
        r = next(r for r in self._csv("pld_separacao_diaria.csv") if r["data"] == "2025-01-25" and r["par"] == "NE_N")
        self.assertEqual((r["fronteira"], r["horas_separadas"], r["horas_com_fluxo"]), ("N_NE", "7", "24"))
        self.assertAlmostEqual(float(r["fluxo_medio_mwmed"]), 961.097292, delta=0.0001)

    def test_horario_recente_mesma_hora_por_submercado(self):
        """Defeito 2: 25/09/2026 às 18h, por awk nos originais: PLD SE 263,43, S 263,42, NE 263,42, N 263,43;
        CMO do DESSEM na hora = média das meias horas 18:00 e 18:30 (SE 162,73 e 188,43 → 175,58; NE 159,46 e
        167,24 → 163,35; S 175,685; N 196,035); fluxo N_NE −2.238,773 (linha NE→N), N_SE 1.590,039, NE_SE 6.282,472,
        S_SE −4,936 (linha SE→S). Deslocar o CMO uma hora ou trocar o submercado muda esses valores."""
        ptr = self.g["horario_recente"]
        self.assertEqual((ptr["url"], ptr["inicio"], ptr["fim"], ptr["horas"]),
                         ("/energia/series/pld_horario_recente.json", "2026-09-19T00:00", "2026-09-25T23:00", 168))
        rc = self.recente
        self.assertEqual((rc["t"][0], rc["t"][-1], len(rc["t"])), ("2026-09-19T00:00", "2026-09-25T23:00", 168))
        i = rc["t"].index("2026-09-25T18:00")
        self.assertEqual({sm: rc["pld"][sm][i] for sm in m.SM}, {"SE": 263.43, "S": 263.42, "NE": 263.42, "N": 263.43})
        self.assertEqual((rc["cmo_dessem"]["SE"][i], rc["cmo_dessem"]["NE"][i]), (175.58, 163.35))
        self.assertAlmostEqual(rc["cmo_dessem"]["S"][i], 175.685, delta=0.006)
        self.assertAlmostEqual(rc["cmo_dessem"]["N"][i], 196.035, delta=0.006)
        self.assertEqual({k: rc["fluxo"][k][i] for k in rc["fluxo"]}, {"N_NE": -2238.8, "N_SE": 1590.0, "NE_SE": 6282.5, "S_SE": -4.9})
        self.assertEqual(rc["amplitude"][i], 0.01)
        # equivalência com o CSV horário publicado (mesmos números nas 168 horas; o JSON arredonda ao
        # centavo e o CSV guarda 4 casas: a diferença vai até meio centavo)
        csvh = {r["data_hora_local"]: r for r in self._csv("pld_cmo_horario.csv")}
        for j, t in enumerate(rc["t"]):
            for sm in m.SM:
                self.assertAlmostEqual(float(csvh[t][f"PLD_{sm}"]), rc["pld"][sm][j], delta=0.0051)
                self.assertAlmostEqual(float(csvh[t][f"CMO_{sm}"]), rc["cmo_dessem"][sm][j], delta=0.0051)

    def test_calendario_piso_e_teto_por_dia(self):
        """Defeito 2: horas no piso e no teto horário por dia (awk, igualdade ao centavo): 16/01/2022 SE e S com
        5 horas a R$ 55,70/MWh e uma a R$ 55,71 (fica fora do piso), N e NE com 24; 30/03/2026 SE 8 no piso e 2
        no teto horário (R$ 1.611,04), S 0 e 2; 25/09/2026 10 horas no piso em cada submercado. O CSV diário de
        limites traz os mesmos números."""
        cal = self.g["limites"]["calendario"]
        esperado = {("2022-01-16", "SE"): (5, 0), ("2022-01-16", "S"): (5, 0), ("2022-01-16", "N"): (24, 0), ("2022-01-16", "NE"): (24, 0),
                    ("2026-03-30", "SE"): (8, 2), ("2026-03-30", "S"): (0, 2), ("2026-03-30", "NE"): (9, 2), ("2026-03-30", "N"): (9, 2),
                    ("2026-09-25", "SE"): (10, 0), ("2026-09-25", "S"): (10, 0), ("2026-09-25", "NE"): (10, 0), ("2026-09-25", "N"): (10, 0)}
        diario = {(r["data"], r["sm"]): r for r in self._csv("pld_limites_diario.csv")}
        for (dia, sm), (piso, teto) in esperado.items():
            i = cal["dias"].index(dia)
            self.assertEqual((cal[sm]["horas_piso"][i], cal[sm]["horas_teto_horario"][i]), (piso, teto), (dia, sm))
            r = diario[(dia, sm)]
            self.assertEqual((int(r["horas_no_piso"]), int(r["horas_no_teto_horario"])), (piso, teto), (dia, sm))
        self.assertEqual(diario[("2022-01-16", "SE")]["horas_um_centavo_acima_do_piso"], "1")
        # calendário e CSV iguais em todos os dias publicados
        for i, dia in enumerate(cal["dias"]):
            for sm in m.SM:
                r = diario[(dia, sm)]
                self.assertEqual((cal[sm]["horas_piso"][i], cal[sm]["horas_teto_horario"][i]),
                                 (int(r["horas_no_piso"]), int(r["horas_no_teto_horario"])), (dia, sm))

    def test_downloads_relidos_iguais_a_gold(self):
        """Defeito 2: cada CSV de download, relido depois de escrito, reproduz os números da gold."""
        amp = {x["periodo"]: x for x in self.g["regional"]["amplitude"]}
        por_ano = defaultdict(int)
        for r in self._csv("pld_amplitude_diaria.csv"):
            por_ano[r["data"][:4]] += int(r["horas_com_separacao"])
        for ano, n in por_ano.items():
            self.assertEqual(amp[ano]["horas_com_separacao"], n, ano)
        sep = {(x["periodo"], x["par"]): x["horas_separadas"] for x in self.g["regional"]["separacao"]}
        por_par = defaultdict(int)
        for r in self._csv("pld_separacao_diaria.csv"):
            por_par[(r["data"][:4], r["par"])] += int(r["horas_separadas"])
        for k, n in por_par.items():
            self.assertEqual(sep[k], n, k)
        saz = {(x["sm"], x["mes"]): x for x in self.g["historico"]["sazonal_mes"]}
        linhas = self._csv("pld_sazonal.csv")
        self.assertEqual(len(linhas), 48)
        for r in linhas:
            x = saz[(r["sm"], int(r["mes"]))]
            self.assertEqual(int(r["n_dias"]), x["n"])
            for q in ("p10", "p25", "p50", "p75", "p90"):
                self.assertEqual(r[q] == "", x[q] is None)
                if x[q] is not None:
                    self.assertAlmostEqual(float(r[q]), x[q], delta=0.005)
        mh = self.g["historico"]["mensal"]
        for r in self._csv("pld_mensal.csv"):
            i = mh["meses"].index(r["mes"])
            self.assertEqual(r["perimetro_carga"], mh["perimetro_carga"][i])
            for col, campo in (("media_temporal", "temporal"), ("media_ponderada_carga", "ponderada_carga"),
                               ("media_ponderada_carga_sem_mmgd", "ponderada_carga_sem_mmgd"), ("media_temporal_real", "real")):
                g_ = mh[r["sm"]][campo][i]
                self.assertEqual(r[col] == "", g_ is None, (r["mes"], r["sm"], col))
                if g_ is not None:
                    self.assertAlmostEqual(float(r[col]), g_, delta=0.005)

    def test_mes_corrente_e_perfil_da_separacao(self):
        """Mês corrente (setembro de 2026, 7 dias completos na amostra, SE 124,091131 por awk); os setembros
        anteriores da amostra são parciais e não entram como mês completo. Perfil horário da separação SE e S
        nos últimos 12 meses (30/03 e 19 a 25/09/2026, 8 dias), fração por hora do dia por awk."""
        mc = next(x for x in self.g["historico"]["mes_corrente"] if x["sm"] == "SE")
        self.assertEqual((mc["mes"], mc["dias"], mc["parcial"], mc["mesmo_mes_anos_anteriores"]), ("2026-09", 7, True, []))
        self.assertAlmostEqual(mc["media_dias_completos"], 124.091131, delta=0.006)
        perfil = self.g["regional"]["perfil_horario_separacao_12m"]["SE_S"]
        self.assertEqual(perfil, [0.25, 0.25, 0.25, 0.375, 0.25, 0.375] + [0.125] * 11 + [0.0] * 4 + [0.125] * 3)

    def test_empates_no_piso_marcam_ano_parcial(self):
        """Defeito 7: o bloco de empates no piso marca o ano parcial como permanência e regimes."""
        emp = {x["ano"]: x for x in self.g["limites"]["empates_piso"]}
        perm = {(x["ano"], x["sm"]): x["parcial"] for x in self.g["limites"]["permanencia_anual"]}
        self.assertTrue(emp[2026]["parcial"])
        self.assertFalse(emp[2025]["parcial"])
        for ano, x in emp.items():
            self.assertEqual(x["parcial"], perm[(ano, "SE")], ano)

    def test_amplitude_com_o_limiar_de_pld_json(self):
        """Defeito 8: 19 a 25/09/2026, awk: 46 horas com amplitude acima de R$ 0,01/MWh, 15 acima de R$ 1,00/MWh
        e 15 acima de R$ 10,00/MWh. A contagem com R$ 1,00/MWh reconcilia com a de pld.json na mesma janela."""
        a = next(x for x in self.g["regional"]["amplitude"] if x["periodo"] == "30d")
        self.assertEqual((a["horas_com_separacao"], a["horas_acima_1"], a["horas_acima_10"]), (46, 15, 15))
        ctrl = next(x for x in self.g["controles"] if x["nome"].startswith("Amplitude com R$ 1,00/MWh"))
        self.assertEqual(ctrl["resultado"], "aprovado", ctrl["detalhe"])
        self.assertIn("pld.json", self.g["regional"]["limiar_sensibilidade"])

    def test_ficha_do_piso_mostra_a_copia_lida(self):
        """Defeito 5: o arquivo do ato vigente foi baixado da cópia do Internet Archive (o endereço oficial da
        ANEEL responde 403): a ficha mostra os dois endereços, no arquivo e na extração do PDF."""
        e = self.ev["piso_2026_SE"]
        arq = e["fonte"]["arquivos"][1]
        self.assertEqual((arq["url"], arq["url_copia"]), ("https://www2.aneel.gov.br/cedoc/dsp20253850ti.pdf", URL_COPIA_DSP))
        self.assertIn(URL_COPIA_DSP, e["extracao_pdf"]["documento"])
        self.assertIn(URL_COPIA_DSP, e["consulta"])
        ren = next(x for x in m.REGISTRO["datasets"] if x["nome"] == "ren-957-2021")
        self.assertEqual(ren["url_copia"], normas_pld.URL_REN957_COPIA)
        self.assertIn(normas_pld.URL_REN957_COPIA, ren["descricao"])
        bal = next(x for x in m.REGISTRO["datasets"] if x["dataset_silver"] == m.DS_BAL_CONF)
        self.assertEqual([q["data"] for q in bal["quebras"]], ["2021-03-01", "2023-04-29", "2023-05-01"])


class HistoricoComCargaNegativa(unittest.TestCase):
    """_bloco_historico com o PLD de 26/09/2026 e a carga das duas capturas do silver principal."""

    def _d(self, captura, historico=False):
        pld = defaultdict(dict)
        for serie, ref, v in ccee.parse_pld(_texto("pld_horario_20260926.csv")):
            pld[serie[4:]][ref] = v
        carga, hist = defaultdict(dict), defaultdict(list)
        caps = ("2026-09-29T02:43:15Z", "2026-09-30T02:19:57Z")
        for r in _linhas("carga_20260926_capturas.csv"):
            ref = r["din_instante"][:13].replace(" ", "T") + ":00"
            carga[r["id_subsistema"]][ref] = float(r[f"val_carga_captura_{captura}"])
            if historico:
                hist[r["id_subsistema"]].append((ref, [(c_, float(r[f"val_carga_captura_{c_}"])) for c_ in caps]))
        dias = {"2026-09-26"}
        return {"pld": dict(pld), "carga": dict(carga), "ipca": {}, "lim_dia": {}, "ultima_hora": "2026-09-26T23:00",
                "dia_ref": "2026-09-26", "diario": {sm: {"2026-09-26": sum(pld[sm].values()) / 24} for sm in m.SM},
                "dias_completos_set": dias, "destino_csv": self.tmp, "historico_carga": dict(hist)}

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_hora_com_carga_negativa_sai_do_peso_e_e_listada(self):
        h = m._bloco_historico(self._d("2026-09-29T02:43:15Z"))
        ret = h["ponderacao"]["horas_retiradas"]
        self.assertEqual([(x["sm"], x["mes"], x["horas"]) for x in ret], [("NE", "2026-09", 15)])
        mh = h["mensal"]
        self.assertEqual((mh["NE"]["horas_com_carga"][0], mh["NE"]["mesmas_horas"][0]), (9, False))
        self.assertAlmostEqual(mh["NE"]["ponderada_carga"][0], 58.57, places=2)   # awk: 58,567140
        self.assertEqual((mh["SE"]["horas_com_carga"][0], mh["SE"]["mesmas_horas"][0]), (24, True))
        with open(os.path.join(self.tmp, "pld_mensal.csv"), encoding="utf-8") as f:
            ne = next(r for r in csv.DictReader(f, delimiter=";") if r["sm"] == "NE")
        self.assertEqual((ne["horas_com_carga"], ne["horas_carga_nao_positiva"], ne["mesmas_horas"]), ("9", "15", "0"))

    def test_revisoes_da_carga_com_magnitude_e_efeito(self):
        h = m._bloco_historico(self._d("2026-09-30T02:19:57Z", historico=True))
        self.assertEqual(h["ponderacao"]["horas_retiradas"], [])
        ne = next(x for x in h["ponderacao"]["revisoes_carga"] if x["sm"] == "NE")
        self.assertEqual((ne["mes"], ne["horas_revisadas"], ne["horas_com_troca_de_sinal"]), ("2026-09", 24, 15))
        self.assertAlmostEqual(ne["max_abs_mwmed"], 18847.303, places=3)
        self.assertEqual(ne["quando_max"], "2026-09-26T23:00")
        self.assertAlmostEqual(ne["ponderada_primeira_captura"], 58.57, places=2)  # awk: 58,567140 (só as 9 horas positivas)
        self.assertAlmostEqual(ne["ponderada_vigente"], 76.20, places=2)           # awk: 76,197772
        self.assertAlmostEqual(ne["efeito_na_ponderada"], 17.63, places=2)


if __name__ == "__main__":
    unittest.main()
