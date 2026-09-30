"""Módulo PLD (detalhe): leitores, cálculos e construção da gold pld_detalhe.json.

Sem rede. As amostras em pipeline/tests/dados/energia_pld/ são recortes reais:
- CMO semi-horário do ONS (CMO_SEMIHORARIO_2026.csv, semana de 19 a 25/09/2026 e o
  contorno do dia 05/09/2026, que o ONS não publicou; extremos reais de 2020 e 2025);
- CMO semanal do ONS (arquivos CSV e Parquet de 2023 inteiros, trechos de 2022, 2024 e 2026);
- PLD horário da CCEE (captura versionada do projeto: semana de 19 a 25/09/2026, 30/03/2026,
  06/07/2021 e 01/06/2023);
- balanço de energia (25/09/2026) e intercâmbios (semana) do ONS; IPCA do IBGE; dicionários;
- Decreto nº 5.163/2004 (Câmara dos Deputados, arts. 56 a 59 da norma atualizada e da
  publicação original) e texto extraído pelo pdftotext das páginas 3, 6, 58 e 59 da REN
  ANEEL nº 957/2021 (cópia do Internet Archive, sha256 472d18da...).
Os valores esperados foram calculados por outro caminho (awk sobre os arquivos originais)
e estão escritos nos testes; os limites do PLD vêm de uma fixture no esquema do módulo
Regulação (limites_pld_fixture.json), não publicada.
"""
import csv
import gzip
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas  # noqa: E402
from pipeline.energia import regulatorio  # noqa: E402
from pipeline.energia.fontes import ccee, ibge_pld, normas_pld, ons, ons_pld  # noqa: E402
from pipeline.energia.modulos import pld_detalhe as m  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_pld")


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
        self.assertEqual(obs, {"2026-07": 7657.73, "2026-08": 7633.23})


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
        self.assertEqual(m.situacao_hora(49.78, l21), "piso")          # um centavo: dentro da tolerância
        self.assertEqual(m.situacao_hora(49.78, l21, tol=m.TOL_SENS), "entre")  # sensibilidade de meio centavo
        self.assertEqual(m.situacao_hora(49.80, l21), "entre")
        self.assertEqual(m.situacao_hora(1611.04, l26), "teto_horario")
        self.assertEqual(m.situacao_hora(49.0, l21), "abaixo_do_piso")  # controle
        self.assertEqual(m.situacao_hora(100.0, {}), "sem_limite")
        # 06/07/2021: média real das 24 horas do Sudeste = 583,88375 (awk), teto estrutural de 2021 = 583,88
        vals = [float(r["PLD_HORA"]) for r in _linhas("pld_horario_2021_teto_estrutural.csv") if r["SUBMERCADO"] == "SUDESTE"]
        self.assertAlmostEqual(sum(vals) / 24, 583.88375, places=6)
        self.assertEqual(m.situacao_dia_estrutural(sum(vals) / 24, l21), "no_teto")
        self.assertGreater(max(vals), 583.88)  # horas acima do teto estrutural existem; a regra é sobre a média

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


class ConstrucaoDaGold(unittest.TestCase):
    """Constrói a gold a partir de silvers em memória alimentados pelas amostras reais e
    confere valores contra números calculados por awk sobre os arquivos originais."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.p = mock.patch.multiple(base, BRONZE=os.path.join(cls.tmp, "bronze"), SILVER=os.path.join(cls.tmp, "silver"),
                                    DADOS=os.path.join(cls.tmp, "dados"))
        cls.p.start()
        cp = base.conecta(":memory:")
        # PLD: horas até 24/09 numa captura e 25/09 numa captura seguinte (instantes de captura
        # SINTÉTICOS, para exercitar a primeira captura observada do achado A09)
        pld = list(ccee.parse_pld(_texto("pld_horario_2026_amostra.csv.gz")))
        v1, _ = base.registra_vintage(cp, "ccee_pld_horario", "pld_horario_2026", "u", "2026-09-24T15:00:00Z", None, "a" * 64, 1, "seed", None)
        base.grava_observacoes(cp, "ccee_pld_horario", v1, [x for x in pld if x[1][:10] <= "2026-09-24"])
        v2, _ = base.registra_vintage(cp, "ccee_pld_horario", "pld_horario_2026", "u", "2026-09-25T02:20:00Z", None, "b" * 64, 1, "coleta_direta", None)
        base.grava_observacoes(cp, "ccee_pld_horario", v2, pld)
        for ds, nome, parser in (("cmo_se", "cmo_semanal_2026_trecho.csv", ons.parse_cmo),
                                 ("balanco_energia_subsistema_ho", "balanco_2026_amostra.csv.gz", ons.parse_balanco),
                                 ("intercambio_nacional_ho", "intercambio_2026_amostra.csv.gz", ons.parse_intercambio)):
            vid, _ = base.registra_vintage(cp, ds, nome, "u", "2026-09-26T00:00:00Z", None, ("c" + ds)[:64].ljust(64, "0"), 1, "coleta_direta", None)
            base.grava_observacoes(cp, ds, vid, parser(_texto(nome)))
        cf = base.conecta(":memory:")
        obs, _ = ons_pld.parse_cmo_semihorario(_linhas("cmo_semihorario_2026_amostra.csv.gz"))
        vid, _ = base.registra_vintage(cf, m.DS_SH, "CMO_SEMIHORARIO_2026", "u", "2026-09-26T00:00:00Z", None, "d" * 64, 1, "coleta_direta", None)
        base.grava_observacoes(cf, m.DS_SH, vid, obs)
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
        # Decreto nº 5.163/2004 (recorte real) pelo caminho de importação do módulo; a REN nº 957/2021 fica de
        # fora de propósito, para exercitar a ausência declarada de um documento
        arq, sha, n = base.salva_bronze_arquivo("camara-dos-deputados", m.DS_NORMAS, "decreto_5163_2004",
                                                os.path.join(DADOS, "decreto_5163_normaatualizada_trecho.html"), "html", "2026-09-26T00:00:00Z")
        vid, _ = base.registra_vintage(cf, m.DS_NORMAS, "decreto_5163_2004", normas_pld.URL_DECRETO, "2026-09-26T00:00:00Z", None, sha, n,
                                       "coleta_direta", arq)
        m._importa_norma(cf, {"vintage_id": vid, "recurso": "decreto_5163_2004", "arquivo": arq, "sha256": sha}, "decreto_5163_2004")
        vid, _ = base.registra_vintage(cf, m.DS_IPCA, "ipca_numero_indice", "u", "2026-09-26T00:00:00Z", None, "e" * 64, 1, "coleta_direta", None)
        base.grava_observacoes(cf, m.DS_IPCA, vid, ibge_pld.parse_ipca_sidra(_texto("ipca_sidra_amostra.json")))
        cls.csv_dir = os.path.join(cls.tmp, "series")
        cls.g = m.construir(cf, {"con_principal": cp, "limites_pld": _fixture_limites(), "destino_csv": cls.csv_dir,
                                 "hoje": date(2026, 9, 30)})
        cls.g_sem_limites = m.construir(cf, {"con_principal": cp, "limites_pld": None, "destino_csv": cls.csv_dir, "hoje": date(2026, 9, 30)})
        cls.cp, cls.cf = cp, cf

    @classmethod
    def tearDownClass(cls):
        cls.cp.close()
        cls.cf.close()
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
        """Fichas montadas por pipeline/energia/evidencia.py: validação sem problemas, chaves na
        ordem do contrato e reconciliação por outro caminho com valor conferido por awk."""
        from pipeline.energia import evidencia as ev
        self.assertTrue(self.g["evidencias"])
        for k, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], k)
            self.assertEqual(tuple(e), ev.CAMPOS, k)
            self.assertTrue(e["testes"], k)
        e = self.g["evidencias"]["pld_semana_N"]
        self.assertEqual(e["reconciliacao"]["resultado"], "aprovado")
        self.assertEqual(e["denominador"]["valor"], 168)
        self.assertAlmostEqual(e["valor_calculo"], 124.093393, places=5)  # awk sobre a amostra da CCEE
        self.assertEqual(e["valor_exibido"], "R$ 124,09/MWh")
        # a data de publicação da CCEE não é confiável (A09): nunca aparece na ficha
        self.assertIsNone(e["fonte"]["publicado_em"])
        sep = self.g["evidencias"]["separacao_12m_SE_S"]
        self.assertEqual((sep["numerador"]["valor"], sep["reconciliacao"]["resultado"]), (28, "aprovado"))

    def test_conceito_cita_so_o_que_conferiu(self):
        cc = self.g["conceito"]
        ids = {f["id"] for f in cc["fontes_textuais"]}
        self.assertIn("d5163_art57_caput", ids)
        caput = next(f for f in cc["fontes_textuais"] if f["id"] == "d5163_art57_caput")
        self.assertEqual(caput["texto"], "Art. 57. A contabilização e a liquidação no mercado de curto prazo serão realizadas com base no PLD.")
        self.assertEqual(cc["documentos_normativos"]["decreto_5163_2004"]["url"], normas_pld.URL_DECRETO)
        # REN nº 957/2021 não coletada neste ensaio: nenhuma passagem citada, ausência declarada
        self.assertFalse(any(i.startswith("ren957") for i in ids))
        self.assertEqual({x["motivo"] for x in cc["normas_nao_conferidas"]}, {"documento não coletado"})
        self.assertIsNone(cc["documentos_normativos"]["ren_aneel_957_2021"]["sha256"])

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


if __name__ == "__main__":
    unittest.main()
