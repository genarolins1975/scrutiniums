"""Módulo Geração (detalhe), painéis P021 a P024 e achado A11.

Sem rede. Amostras reais recortadas em pipeline/tests/dados/energia_geracao/ (arquivos
Parquet e CSV oficiais do ONS baixados em 30/09/2026, filtrados por hora, usina ou semana):

- geracao_usina_2023_04_h12.parquet: todas as linhas da Geração por Usina de 28/04/2023 e
  29/04/2023 às 12:00 (GERACAO_USINA-2_2023_04.parquet);
- balanco_2023_04_h12.csv: as mesmas horas no Balanço de Energia nos Subsistemas
  (BALANCO_ENERGIA_SUBSISTEMA_2023.csv), inclusive a linha SIN que o próprio ONS publica;
- geracao_usina_2026_08_trecho.parquet: 01/08/2026, 0h a 5h, Itaipu 50 e 60 Hz, grupos de
  São Paulo (com id_ons vazio) e duas PCHs com todas as horas vazias;
- termica_2026_08_01.parquet: Angra II, GNA II, Mauá 3 e Porto de Sergipe I em 01/08/2026;
- restricao_eolica_2026_08_31.parquet: Conj. Caju (limitado) e CEECVA (sem limitação) em 31/08/2026;
- fator_capacidade_2026_08_01.parquet, capacidade_amostra.parquet, relacionamento_caju.parquet,
  cvu_2026_01_17.parquet e os textos dos dicionários (pdftotext -layout);
- gu_2025_10_, gu_2025_11_ e gu_2026_08_atlantico_gna.parquet: Do Atlântico (RJCSA), GNA II e
  Termorio nas duas primeiras horas de 10/2025, 11/2025 e 08/2026 (a fonte troca o CEG da
  Do Atlântico de UTE.PE para UTE.CM em 11/2025);
- td_2025_01_, td_2025_10_ e td_2026_08_parcelas.parquet: térmica por motivo na primeira hora,
  com as parcelas de Maranhão 4, J. Lacerda A, Atlântico e Camaçari Muricy II (CEG em PE e BA);
- cvu_2026_09_26_parcelas.parquet: CVU da semana de 26/09/2026 desses códigos;
- capacidade_gna_termorio.parquet: as unidades de GNA II e Termorio (gás e vapor de ciclo combinado);
- aneel_empreendimentos_operacao_recorte.csv: série histórica da ANEEL por tipo (12/2021 e 06/2026).

Os valores esperados vêm de caminho independente do código testado: a linha SIN do
próprio balanço do ONS, o campo GNRa publicado pelo ONS, as colunas de total da fonte e
somas feitas à parte com laços simples sobre as amostras (registradas no documento do módulo).
A classe GoldPublicada confere a gold contra números lidos da fonte por outro código
(registrados no documento) e, como controle interno, contra os CSV publicados."""
import csv
import json
import os
import sys
import tempfile
import unittest
from collections import defaultdict
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import ons_geracao as og  # noqa: E402
from pipeline.energia.modulos import geracao_detalhe as gd  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_geracao")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _p(nome):
    return os.path.join(DADOS, nome)


def _balanco_sin():
    """Linha SIN do balanço oficial por hora (caminho independente: módulo csv)."""
    out = {}
    with open(_p("balanco_2023_04_h12.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            out[(r["id_subsistema"], r["din_instante"][:16])] = r
    return out


class AgregacaoGeracaoUsina(unittest.TestCase):
    """P021 e A11: a soma das usinas por tipo fecha com o balanço publicado pelo ONS."""

    @classmethod
    def setUpClass(cls):
        cls.a = og.agrega_geracao_usina(og.lotes(_p("geracao_usina_2023_04_h12.parquet"), og.COLS_USINA))
        cls.bal = _balanco_sin()

    def test_solar_com_mmgd_igual_ao_balanco_sin(self):
        # linha SIN do balanço: 14.987,696 MWmed em 29/04/2023 12:00 e 5.688,69 em 28/04/2023 12:00
        self.assertEqual(self.bal[("SIN", "2023-04-29 12:00")]["val_gersolar"], "14987.696")
        for hora, esperado in (("2023-04-29T12:00", 14987.696), ("2023-04-28T12:00", 5688.69)):
            sol = self.a["horario"].get((hora, "solar_centralizada"), 0) + self.a["horario"].get((hora, "solar_mmgd"), 0)
            self.assertAlmostEqual(sol, esperado, delta=0.01)

    def test_mmgd_so_existe_a_partir_de_29_04_2023(self):
        self.assertAlmostEqual(self.a["horario"][("2023-04-29T12:00", "solar_mmgd")], 9984.5, delta=0.001)
        self.assertNotIn(("2023-04-28T12:00", "solar_mmgd"), self.a["horario"])  # ausência, não zero
        linhas_mmgd = [k for k in self.a["diario"] if og.norm(k[4]) == og.MOD_MMGD]
        self.assertTrue(linhas_mmgd)
        self.assertEqual({k[0] for k in linhas_mmgd}, {"2023-04-29"})
        self.assertEqual(sum(v[2] for k, v in self.a["diario"].items() if og.norm(k[4]) == og.MOD_MMGD), 37)

    def test_hidraulica_e_eolica_iguais_ao_balanco(self):
        for hora, hid, eol in (("2023-04-29T12:00", 44469.763, 3637.252), ("2023-04-28T12:00", 55138.943, 1766.604)):
            self.assertAlmostEqual(self.a["horario"][(hora, "hidraulica")], hid, delta=0.01)
            self.assertAlmostEqual(self.a["horario"][(hora, "eolica")], eol, delta=0.01)

    def test_termica_do_balanco_exclui_roraima_em_2023(self):
        # balanço SIN 29/04/2023 12:00: térmica 7.311,092 = térmicas + nuclear − usinas de Roraima
        term = sum(v for (h, cat), v in self.a["horario"].items() if h == "2023-04-29T12:00" and cat in og.CATEGORIAS_TERMICAS)
        rr = sum(v for (d, ti), v in self.a["roraima_dia"].items() if og.grupo_balanco(ti) == "termica")
        self.assertAlmostEqual(term, 5442.058 + 2004.663, delta=0.01)
        # roraima_dia soma as duas horas da amostra (28 e 29/04): 151,496 + 135,629
        self.assertAlmostEqual(rr, 151.496 + 135.629, delta=0.01)
        self.assertAlmostEqual(term - 135.629, float(self.bal[("SIN", "2023-04-29 12:00")]["val_gertermica"]), delta=0.01)

    def test_vazio_e_ausencia_nao_zero(self):
        self.assertEqual(self.a["rel"]["vazios"], 4)  # 2 linhas vazias em cada hora, contadas e fora da soma
        self.assertEqual(self.a["rel"]["invalidos"], 0)
        self.assertEqual(self.a["rel"]["subsistema_desconhecido"], 0)

    def test_nenhum_rotulo_sem_categoria(self):
        rotulos = {(k[2], k[3], k[4]) for k in self.a["diario"]}
        self.assertTrue(all(og.categoria(*r) != "nao_mapeada" for r in rotulos), rotulos)
        self.assertEqual(og.categoria("TÉRMICA", "Combustível Novo", "TIPO I"), "nao_mapeada")
        # conjunto híbrido: tipo eólico com combustível fotovoltaico conta como eólica (como no balanço)
        self.assertEqual(og.categoria("EOLIELÉTRICA", "Fotovoltaica", "Conjunto de Usinas"), "eolica")
        self.assertEqual(og.categoria("TÉRMICA", "Outras Multi-Combustível", "Pequenas Usinas (Tipo III)"), "termica_sem_combustivel")


class TrechoRecente2026(unittest.TestCase):
    """Robustez: grupos sem id_ons (desde maio de 2026), usinas com todas as horas vazias e
    identificadores com o mesmo CEG (Itaipu 50 Hz e 60 Hz)."""

    @classmethod
    def setUpClass(cls):
        cls.a = og.agrega_geracao_usina(og.lotes(_p("geracao_usina_2026_08_trecho.parquet"), og.COLS_USINA))

    def test_grupos_sem_id_ons_agrupados_e_contados(self):
        self.assertEqual(self.a["rel"]["sem_id_ons"], 36)  # 6 grupos × 6 horas
        self.assertIn(("2026-08", "sem_id_ons"), self.a["usina_mes"])

    def test_usina_com_todas_as_horas_vazias_nao_vira_zero(self):
        mwh, cnt, lin = self.a["usina_mes"][("2026-08", "RSUHCD")]
        self.assertEqual((cnt, lin), (0, 6))
        self.assertEqual(mwh, 0.0)  # sem valor somado; a lacuna é a contagem cnt = 0, publicada como identificador sem valor

    def test_itaipu_dois_identificadores_mesmo_ceg(self):
        ids = {k: v for k, v in self.a["cadastro"].items() if "ITAIPU" in (v.get("nome") or "")}
        self.assertEqual(sorted(ids), ["PRIT60", "PYIT50"])
        self.assertEqual({v["ceg"] for v in ids.values()}, {"UHE.PH.PR.001161-4.01"})
        self.assertAlmostEqual(self.a["usina_mes"][("2026-08", "PRIT60")][0] + self.a["usina_mes"][("2026-08", "PYIT50")][0],
                               37398.219, delta=0.001)


class TermicaPorMotivo(unittest.TestCase):
    """P022: a partição por motivo fecha com a geração verificada da própria fonte."""

    @classmethod
    def setUpClass(cls):
        cls.a = og.agrega_termica(og.lotes(_p("termica_2026_08_01.parquet"), og.COLS_TERMICA))

    def _usina(self, ceg):
        return {m: v for (mes, ch, m), v in self.a["usina_mes"].items() if ch == ceg}

    def test_angra_ii_particao_sem_dupla_contagem(self):
        x = self._usina("UTN.UR.RJ.000101-5.01")
        self.assertAlmostEqual(x["total"], 32631.781, delta=0.001)          # coluna val_verifgeracao
        self.assertAlmostEqual(x["merito_total"], 10877.253, delta=0.001)   # mérito com a inflexibilidade embutida
        partes, residuo = og.particao_motivos(x)
        self.assertAlmostEqual(partes["merito"], 77.252, delta=0.001)
        self.assertAlmostEqual(partes["inflexibilidade"], 32554.528, delta=0.001)
        self.assertLess(abs(residuo), 0.01)
        # somar mérito total e inflexibilidade contaria 10.800 MWh duas vezes
        self.assertAlmostEqual(x["merito_total"] + x["inflexibilidade"] - x["total"], 10800.0, delta=0.01)

    def test_usina_parada_tem_zero_nao_ausencia(self):
        x = self._usina("UTE.GN.SE.032228-8.01")
        self.assertEqual(x["total"], 0.0)
        self.assertEqual(x["merito"], 0.0)

    def test_combustivel_do_proprio_conjunto_e_mapa(self):
        cad = self.a["cadastro"]
        self.assertEqual(cad["UTN.UR.RJ.000101-5.01"]["combustivel"], "Nuclear")
        self.assertEqual(cad["UTN.UR.RJ.000101-5.01"]["cod"], 13)
        mapa = gd.mapa_combustivel(cad, {}, {})
        self.assertEqual(mapa["UTE.GN.AM.031888-4.01"], {"rotulo": "Gás", "categoria": "gas", "origem": "termica_por_motivo"})
        self.assertEqual(mapa["UTN.UR.RJ.000101-5.01"]["categoria"], "nuclear")
        # sem combustível na fonte, o mesmo CEG em outro conjunto do ONS decide; nunca o nome
        cad2 = {"UTE.X": {"nome": "Mauá 3", "ceg": "UTE.X", "combustivel": ""}}
        self.assertEqual(gd.mapa_combustivel(cad2, {}, {})["UTE.X"]["categoria"], "nao_mapeada")
        cad_u = {"AMMAU3": {"ceg": "UTE.X", "tipo": "TÉRMICA", "comb": "Óleo Diesel"}}
        self.assertEqual(gd.mapa_combustivel(cad2, cad_u, {})["UTE.X"],
                         {"rotulo": "Óleo Diesel", "categoria": "oleo", "origem": "geracao_por_usina"})

    def test_mesma_hora_24_instantes(self):
        self.assertEqual(self.a["horas_dia"], {"2026-08-01": 24})


class Restricoes(unittest.TestCase):
    """P023: energia não gerada = GNRa publicado pelo ONS; sem limitação não há corte."""

    @classmethod
    def setUpClass(cls):
        cls.a = og.agrega_restricao(og.lotes(_p("restricao_eolica_2026_08_31.parquet"), og.COLS_COFF))

    def test_energia_nao_gerada_igual_ao_gnra_da_fonte(self):
        eng = {raz: sum(x["eng"] for (d, sm, r_, o), x in self.a["diario_razao"].items() if r_ == raz) for raz in ("CNF", "ENE", "REL")}
        gnra = {raz: sum(x["gnra"] for (d, sm, r_, o), x in self.a["diario_razao"].items() if r_ == raz) for raz in ("CNF", "ENE", "REL")}
        self.assertAlmostEqual(eng["CNF"], 73.476, delta=0.001)
        self.assertAlmostEqual(eng["ENE"], 145.729, delta=0.001)
        self.assertAlmostEqual(eng["REL"], 0.0, delta=0.001)
        for raz in eng:
            self.assertAlmostEqual(eng[raz], gnra[raz], delta=1e-6)
        self.assertEqual(self.a["rel"]["gnra_diverge"], 0)

    def test_razao_e_origem_oficiais(self):
        meias = {(r_, o): x["meias"] for (d, sm, r_, o), x in self.a["diario_razao"].items()}
        self.assertEqual(meias, {("CNF", "LOC"): 27, ("ENE", "SIS"): 12, ("REL", "SIS"): 2})

    def test_usina_sem_limitacao_tem_geracao_e_nenhum_corte(self):
        self.assertIn(("2026-08", "CEECVA"), self.a["usina_mes"])
        self.assertFalse(any(k.startswith("eng_") for k in self.a["usina_mes"][("2026-08", "CEECVA")]))
        self.assertAlmostEqual(self.a["usina_mes"][("2026-08", "CJU_RNCAJ1")]["ger"], 9038.224, delta=0.001)

    def test_potencia_maxima_cortada_em_mw(self):
        mw, inst, ref = self.a["pot_max"][("2026-08-31", "SIN")]
        self.assertAlmostEqual(mw, 90.203, delta=0.001)
        self.assertEqual(inst, "2026-08-31T15:30")
        # controle declarado na métrica: o corte simultâneo não passa da soma das referências
        # das mesmas linhas na meia hora (366,958 MW em 31/08/2026 15:30, soma feita à parte abaixo)
        import pyarrow.parquet as pq
        t = pq.read_table(_p("restricao_eolica_2026_08_31.parquet")).to_pylist()
        ref_sep = sum(float(r["val_geracaoreferencia"]) for r in t if str(r["din_instante"])[:16] == "2026-08-31 15:30"
                      and r["val_geracaolimitada"] not in (None, "") and r["val_geracaoreferencia"] not in (None, ""))
        self.assertAlmostEqual(ref, ref_sep, delta=0.001)
        self.assertLessEqual(mw, ref)
        self.assertEqual(self.a["rel"]["meias_corte_acima_da_referencia"], 0)
        self.assertEqual(self.a["rel"]["meias_com_corte"], 9)

    def test_corte_acima_da_referencia_e_contado(self):
        # geração verificada negativa (dado inválido, 799 células na fonte eólica) faz o corte
        # passar da referência: o controle conta em vez de esconder
        import pyarrow as pa
        import pyarrow.parquet as pq
        t = pq.read_table(_p("restricao_eolica_2026_08_31.parquet"))
        lin = t.to_pylist()
        alvo = next(i for i, r in enumerate(lin) if str(r["din_instante"])[:16] == "2026-08-31 15:30"
                    and r["val_geracaolimitada"] not in (None, ""))
        lin[alvo]["val_geracao"] = -500.0
        a = og.agrega_restricao([pa.Table.from_pylist(lin, schema=t.schema)])
        self.assertEqual(a["rel"]["meias_corte_acima_da_referencia"], 1)


class CapacidadeEFator(unittest.TestCase):
    """P024: potência ao longo do tempo, pareamento sem dupla contagem e conferência com o ONS."""

    @classmethod
    def setUpClass(cls):
        cls.unid, cls.rel_cap = og.le_capacidade(og.lotes(_p("capacidade_amostra.parquet"), gd.COLS_CAP))
        for cod, u in cls.unid.items():
            u["_cod"] = cod
        cls.relacoes = og.le_tabela(og.lotes(_p("relacionamento_caju.parquet"), og.colunas_do_arquivo(_p("relacionamento_caju.parquet"))))

    def test_itaipu_potencia_uma_vez(self):
        it = [u for u in self.unid.values() if u["ceg"] == "UHE.PH.PR.001161-4.01"]
        self.assertEqual(len(it), 20)
        self.assertAlmostEqual(og.potencia_operacional_media(it, "2026-08"), 14000.0)
        cad = {"PRIT60": {"ceg": "UHE.PH.PR.001161-4.01", "mod": "TIPO I", "tipo": "HIDROELÉTRICA", "comb": "Hidráulica"},
               "PYIT50": {"ceg": "UHE.PH.PR.001161-4.01", "mod": "TIPO I", "tipo": "HIDROELÉTRICA", "comb": "Hidráulica"}}
        par, por_ceg, por_base = gd.pareamento(cad, self.unid, [])
        self.assertEqual(par["PRIT60"]["casamento"], "ceg")
        self.assertIs(par["PRIT60"]["unidades"], par["PYIT50"]["unidades"])  # mesmo grupo: potência entra uma vez

    def test_entrada_no_meio_do_mes_pondera_pelos_dias(self):
        u = {"potencia_mw": 4.2, "entrada_operacao": "2024-01-10", "desativacao": None}
        self.assertAlmostEqual(og.potencia_operacional_media([u], "2024-01"), 4.2 * 22 / 31)  # 10 a 31/01 inclusive
        self.assertAlmostEqual(og.potencia_operacional_media([u], "2023-12"), 0.0)
        d = {"potencia_mw": 1.6, "entrada_operacao": "2002-06-09", "desativacao": "2005-01-01"}
        self.assertAlmostEqual(og.potencia_operacional_media([d], "2004-12"), 1.6)
        self.assertAlmostEqual(og.potencia_operacional_media([d], "2005-01"), 0.0)  # desativada no dia 1
        self.assertFalse(og.unidade_opera_em(d, "2005-01-01"))

    def test_conjunto_pelas_usinas_com_relacionamento_vigente(self):
        cad = {"CJU_RNCAJ1": {"ceg": "-", "mod": "Conjunto de Usinas", "tipo": "EOLIELÉTRICA", "comb": "Eólica"}}
        par, por_ceg, por_base = gd.pareamento(cad, self.unid, self.relacoes)
        self.assertEqual(par["CJU_RNCAJ1"]["casamento"], "conjunto")
        us_2026 = gd.unidades_no_mes(par["CJU_RNCAJ1"], "2026-08", por_ceg, por_base)
        us_2023 = gd.unidades_no_mes(par["CJU_RNCAJ1"], "2023-08", por_ceg, por_base)
        self.assertEqual(round(sum(u["potencia_mw"] for u in us_2026), 1), 685.8)  # 44 unidades das 21 usinas
        self.assertLess(len(us_2023), len(us_2026))  # usinas que entram no conjunto depois não contam antes
        # 08/2026: todas as unidades já em operação comercial (última entrada em 01/10/2024)
        self.assertAlmostEqual(og.potencia_operacional_media(us_2026, "2026-08"), 685.8, delta=0.01)

    def test_fator_de_capacidade_do_ons_por_somas(self):
        a = og.agrega_fator_capacidade(og.lotes(_p("fator_capacidade_2026_08_01.parquet"), og.COLS_FC))
        g, cap, h = a["usina_mes"][("2026-08", "CJU_RNCAJ1")]
        self.assertEqual(h, 24)
        self.assertAlmostEqual(g, 2571.489, delta=0.001)
        self.assertAlmostEqual(cap, 19365.6, delta=0.001)
        # conferência com a coluna val_fatorcapacidade publicada (média das 24 horas, capacidade constante no dia)
        self.assertAlmostEqual(g / cap, 0.13278643574, places=9)
        self.assertAlmostEqual(a["cadastro"]["CJU_RNCAJ1"]["lat"], -5.6862977)


class Cvu(unittest.TestCase):
    def test_linha_repetida_identica_conta_uma_vez(self):
        a = og.le_cvu(og.lotes(_p("cvu_2026_01_17.parquet"), og.COLS_CVU))
        self.assertEqual(a["lidas"], 99)
        self.assertEqual(len(a["linhas"]), 98)
        self.assertEqual(a["repetidas"], 1)
        self.assertEqual(a["conflitos"], [])
        x = a["linhas"][("2026-01-17", 15)]
        self.assertEqual((x["nome"], x["cvu"], x["revisao"], x["fim"]), ("LUIZORMELO", 914.11, 3, "2026-01-23"))


def _texto(nome):
    with open(_p(nome), encoding="utf-8") as f:
        return f.read()


class Dicionarios(unittest.TestCase):
    def test_permissoes_e_mmgd(self):
        bal = gd.leitura_dicionario(_texto("dicionario_balanco_pdftotext.txt"))
        self.assertFalse(bal["menciona_mmgd"])
        self.assertEqual(bal["data_documento"], "02-05-2023")
        self.assertEqual(bal["permissoes"]["val_gersolar"], {"nulo": True, "zerado": True, "negativo": False})
        usi = gd.leitura_dicionario(_texto("dicionario_geracao_usina_pdftotext.txt"))
        self.assertEqual(usi["permissoes"]["val_geracao"], {"nulo": False, "zerado": True, "negativo": False})
        self.assertIn("previsões de geração", gd._trecho(usi["texto"], "previsões de geração"))
        coff = gd.leitura_dicionario(_texto("dicionario_coff_eolica_pdftotext.txt"))
        self.assertEqual(coff["permissoes"]["val_geracaolimitada"]["nulo"], True)
        self.assertEqual([v["versao"] for v in coff["versoes"]], ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5"])


class ImportacaoEManifesto(unittest.TestCase):
    """Do arquivo ao silver e de volta: revisão da fonte com rótulo renomeado não soma duas vezes."""

    def setUp(self):
        self.con = base.conecta(":memory:")

    def _vintage(self, caminho, capturado, sha):
        vid, _ = base.registra_vintage(self.con, "ons_geracao_usina", "GERACAO_USINA-2_2023_04", "x", capturado, None, sha, 1,
                                       "coleta_direta", caminho)
        return base.ultima_vintage(self.con, "ons_geracao_usina", "GERACAO_USINA-2_2023_04") | {"vintage_id": vid}

    def test_importa_e_reconstroi_matriz(self):
        v = self._vintage(_p("geracao_usina_2023_04_h12.parquet"), "2026-09-30T23:00:00Z", "a" * 64)
        rel = gd._importa_usina(self.con, v, "2023-04")
        self.assertEqual(rel["linhas"], 1287)
        D = gd.carrega_usina(self.con)
        cat_dia, nat_dia, rotulos, horas, cache = gd.matriz_diaria(D)
        self.assertAlmostEqual(cat_dia[("2023-04-29", "SIN", "solar_mmgd")], 9984.5, delta=0.001)
        self.assertAlmostEqual(nat_dia[("2023-04-29", "SIN", "grupo_mmgd")], 9984.5, delta=0.001)
        self.assertNotIn(("2023-04-28", "SIN", "solar_mmgd"), cat_dia)
        self.assertEqual(horas[("2023-04-29", "SIN")], 1)  # uma hora na amostra: dia incompleto
        self.assertEqual(gd.dias_completos(horas), [])

    def test_rotulo_renomeado_na_revisao_nao_duplica(self):
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        v1 = self._vintage(_p("geracao_usina_2023_04_h12.parquet"), "2026-09-30T23:00:00Z", "a" * 64)
        gd._importa_usina(self.con, v1, "2023-04")
        t = pq.read_table(_p("geracao_usina_2023_04_h12.parquet"))
        mod = pc.replace_substring(t["cod_modalidadeoperacao"], "Pequenas Usinas (MMGD)", "Pequenas Usinas (MMGD) revisada")
        t2 = t.set_column(t.column_names.index("cod_modalidadeoperacao"), "cod_modalidadeoperacao", mod)
        with tempfile.TemporaryDirectory() as d:
            arq = os.path.join(d, "revisado.parquet")
            pq.write_table(t2, arq)
            v2 = self._vintage(arq, "2026-10-01T23:00:00Z", "b" * 64)
            gd._importa_usina(self.con, v2, "2023-04")
            D = gd.carrega_usina(self.con)
        fv = sum(v for (s, dia), v in D["d"].items() if dia == "2023-04-29" and s.split("|")[2] == "FOTOVOLTAICA")
        self.assertAlmostEqual(fv, 14987.696, delta=0.01)  # sem o manifesto, a MMGD contaria duas vezes (24.972,196)
        sem_filtro = sum(v for (s, dia), v in gd.vigentes(self.con, "ons_geracao_usina", "d|").items()
                         if dia == "2023-04-29" and s.split("|")[2] == "FOTOVOLTAICA")
        self.assertAlmostEqual(sem_filtro, 14987.696 + 9984.5, delta=0.01)


def _vintage_em(con, ds, recurso, caminho, capturado, sha):
    vid, _ = base.registra_vintage(con, ds, recurso, "x", capturado, None, sha, 1, "coleta_direta", caminho)
    return base.ultima_vintage(con, ds, recurso) | {"vintage_id": vid}


class CicloCombinadoNaCategoriaDaUsina(unittest.TestCase):
    """P024, defeito 1: a turbina a vapor de ciclo combinado ('Resíduo Ciclo Combinado') de
    uma usina a gás entra no gás, como a geração da mesma usina no fator de capacidade."""

    @classmethod
    def setUpClass(cls):
        cls.unid, cls.rel = og.le_capacidade(og.lotes(_p("capacidade_gna_termorio.parquet"), gd.COLS_CAP))
        for cod, u in cls.unid.items():
            u["_cod"] = cod
            u["categoria_propria"] = og.categoria(u["tipo"], u["combustivel"], "")
        cls.cad_u = og.agrega_geracao_usina(og.lotes(_p("gu_2026_08_atlantico_gna.parquet"), og.COLS_USINA))["cadastro"]

    def test_rcc_nao_e_combustivel_nem_outros(self):
        self.assertEqual(og.categoria("TÉRMICA", "RESÍDUO CICLO COMBINADO", ""), "nao_mapeada")
        self.assertNotEqual(og.categoria_combustivel("Resíduo Ciclo Combinado"), "outros")

    def test_soma_das_unidades_do_ceg_e_a_potencia_do_gas(self):
        import pyarrow.parquet as pq
        # soma feita à parte, direto do Parquet do ONS: GNA II 3 × 366,733 + 572,4 e Termorio 6 × 104,7 + 145 + 2 × 108
        bruto = pq.read_table(_p("capacidade_gna_termorio.parquet")).to_pylist()
        soma = defaultdict(float)
        for r in bruto:
            soma[r["ceg"].strip()] += float(r["val_potenciaefetiva"])
        self.assertAlmostEqual(soma["UTE.GN.RJ.038173-0.01"], 1672.599, places=3)
        self.assertAlmostEqual(soma["UTE.GN.RJ.027888-2.01"], 989.2, places=3)
        cats = gd.categorias_das_unidades(self.unid, self.cad_u, gd.ceg_para_ids(None, self.cad_u), [], "2026-09-30")
        gas = defaultdict(float)
        for cod, (cat, origem) in cats.items():
            self.assertEqual(cat, "gas", cod)
            self.assertEqual(origem, "geracao_por_usina")
            gas[self.unid[cod]["ceg"]] += self.unid[cod]["potencia_mw"]
        self.assertAlmostEqual(gas["UTE.GN.RJ.038173-0.01"], soma["UTE.GN.RJ.038173-0.01"], places=3)
        self.assertAlmostEqual(gas["UTE.GN.RJ.027888-2.01"], soma["UTE.GN.RJ.027888-2.01"], places=3)

    def test_sem_par_na_geracao_usa_as_demais_unidades_do_ceg(self):
        cats = gd.categorias_das_unidades(self.unid, {}, {}, [], "2026-09-30")
        rcc = [cod for cod, u in self.unid.items() if og.norm(u["combustivel"]) == og.COMBUSTIVEL_CICLO_COMBINADO]
        self.assertEqual(len(rcc), 4)
        self.assertTrue(all(cats[cod] == ("gas", "demais_unidades_do_ceg") for cod in rcc))

    def test_potencia_invalida_vem_do_relatorio_da_importacao(self):
        import pyarrow as pa
        import pyarrow.parquet as pq
        con = base.conecta(":memory:")
        t = pq.read_table(_p("capacidade_gna_termorio.parquet"))
        lin = t.to_pylist()
        lin[0]["val_potenciaefetiva"] = 0.0
        with tempfile.TemporaryDirectory() as d:
            arq = os.path.join(d, "cap.parquet")
            pq.write_table(pa.Table.from_pylist(lin, schema=t.schema), arq)
            v = _vintage_em(con, "ons_capacidade_geracao", "CAPACIDADE_GERACAO", arq, "2026-09-30T23:41:04Z", "c" * 64)
            gd._importa_capacidade(con, v)
        teste = gd.teste_potencia(con)
        self.assertEqual(teste["resultado"], "ressalva")
        self.assertIn("1 de 13", teste["detalhe"])


class TrocaDeCegEParcelas(unittest.TestCase):
    """P022, defeitos 2 e 3: a Geração por Usina troca o CEG da Do Atlântico de UTE.PE para
    UTE.CM em 11/2025; a térmica por motivo publica parcelas (códigos do ONS) dentro do CEG."""

    @classmethod
    def setUpClass(cls):
        cls.con = con = base.conecta(":memory:")
        for i, (rec, cap) in enumerate((("GERACAO_USINA-2_2025_10", "2026-09-30T23:49:09Z"), ("GERACAO_USINA-2_2025_11", "2026-09-30T23:49:10Z"),
                                        ("GERACAO_USINA-2_2026_08", "2026-09-30T23:49:21Z"))):
            v = _vintage_em(con, "ons_geracao_usina", rec, _p(f"gu_{rec[-7:].lower()}_atlantico_gna.parquet"), cap, str(i) * 64)
            gd._importa_usina(con, v, rec[-7:].replace("_", "-"))
        for i, (rec, cap) in enumerate((("GERACAO_TERMICA_DESPACHO-2_2025_01", "2026-09-30T23:41:51Z"),
                                        ("GERACAO_TERMICA_DESPACHO-2_2025_10", "2026-09-30T23:41:57Z"),
                                        ("GERACAO_TERMICA_DESPACHO-2_2026_08", "2026-09-30T23:42:04Z"))):
            v = _vintage_em(con, "ons_geracao_termica_motivo", rec, _p(f"td_{rec[-7:].lower()}_parcelas.parquet"), cap, str(i + 5) * 64)
            gd._importa_termica(con, v, rec[-7:].replace("_", "-"))
        v = _vintage_em(con, "ons_cvu_termica", "CVU_USINA_TERMICA_2026", _p("cvu_2026_09_26_parcelas.parquet"), "2026-09-30T23:40:58Z", "9" * 64)
        gd._importa_cvu(con, v, "2026")
        cls.cad_u = base.registros_como_estavam_em(con, "ons_geracao_usina")
        cls.hist_u = gd.historico_cadastro(con, "ons_geracao_usina")
        cls.cad_t = base.registros_como_estavam_em(con, "ons_geracao_termica_motivo")
        cls.hist_t = gd.historico_cadastro(con, "ons_geracao_termica_motivo")

    def test_cadastro_vigente_guarda_so_o_ultimo_ceg_e_o_historico_guarda_os_dois(self):
        self.assertEqual(self.cad_u["RJCSA"]["ceg"], "UTE.CM.RJ.029587-6.01")
        self.assertEqual([st.get("ceg") for st in self.hist_u["RJCSA"] if st.get("ceg")][:2],
                         ["UTE.PE.RJ.029587-6.01", "UTE.CM.RJ.029587-6.01"])

    def test_ceg_antigo_tem_combustivel_outros(self):
        antigo = {"UTE.PE.RJ.029587-6.01": self.cad_t["UTE.PE.RJ.029587-6.01"]}
        self.assertEqual(antigo["UTE.PE.RJ.029587-6.01"].get("combustivel"), None)  # a fonte só traz combustível em 2026
        # só com o cadastro vigente (último CEG) o CEG antigo fica sem combustível: era o defeito
        self.assertEqual(gd.mapa_combustivel(antigo, self.cad_u, {})["UTE.PE.RJ.029587-6.01"]["categoria"], "nao_mapeada")
        m = gd.mapa_combustivel(antigo, self.cad_u, {}, hist_u=self.hist_u)["UTE.PE.RJ.029587-6.01"]
        self.assertEqual(m, {"rotulo": "Resíduos Industriais", "categoria": "outros", "origem": "geracao_por_usina"})

    def test_uma_usina_so_no_ranking(self):
        cods = gd.codigos_termicos(self.hist_t, self.cad_t)
        self.assertEqual(cods["UTE.PE.RJ.029587-6.01"], {65, 183})       # todas as linhas, não só a última
        self.assertEqual(cods["UTE.GN.MA.030202-3.01"], {36, 600, 601, 608, 609})
        cegs = gd.ceg_para_ids(self.hist_u, self.cad_u)
        ult = {"UTE.PE.RJ.029587-6.01": "2025-10", "UTE.CM.RJ.029587-6.01": "2026-08", "UTE.PE.BA.031304-1.01": "2025-01",
               "UTE.PE.PE.031304-1.01": "2026-08", "UTE.CM.SC.001260-2.01": "2026-08", "UTE.GN.MA.030202-3.01": "2026-08"}
        ident = gd.identidades_termicas(sorted(ult), self.cad_t, cods, cegs, ult)
        # Atlântico: mesmo número de empreendimento e mesmo identificador RJCSA na Geração por Usina
        self.assertEqual(ident["UTE.PE.RJ.029587-6.01"], "UTE.CM.RJ.029587-6.01")
        # Camaçari Muricy II: mesmo número e mesmo código 235 nos dois CEGs (UF trocada)
        self.assertEqual(ident["UTE.PE.BA.031304-1.01"], "UTE.PE.PE.031304-1.01")
        self.assertEqual(len(set(ident.values())), 4)
        nome = gd.nome_identidade("UTE.CM.RJ.029587-6.01", ["UTE.CM.RJ.029587-6.01", "UTE.PE.RJ.029587-6.01"],
                                  self.cad_t, cegs, self.cad_u, {})
        self.assertEqual(nome, ("Do Atlântico", "termica_por_motivo"))
        # J. Lacerda A: duas parcelas no CEG, o nome não é o da última parcela
        nome_jl = gd.nome_identidade("UTE.CM.SC.001260-2.01", ["UTE.CM.SC.001260-2.01"], self.cad_t, cegs, self.cad_u, {})
        self.assertEqual(nome_jl, ("J. Lacerda A-1 + J. Lacerda A-2", "termica_por_motivo"))

    def test_cvu_por_parcela_e_codigo_de_dois_cegs_pareado(self):
        import pyarrow.parquet as pq
        cods = gd.codigos_termicos(self.hist_t, self.cad_t)
        cegs = gd.ceg_para_ids(self.hist_u, self.cad_u)
        chaves = sorted(self.cad_t)
        ident = gd.identidades_termicas(chaves, self.cad_t, cods, cegs, {})
        cod_ident = defaultdict(set)
        for ch, cs in cods.items():
            for cod in cs:
                cod_ident[cod].add(ident[ch])
        comb = gd.mapa_combustivel(self.cad_t, self.cad_u, {}, hist_u=self.hist_u, identidade=ident)
        cv = gd.bloco_cvu(self.con, comb, date(2026, 9, 30), cod_ident, {})
        par = {u["cod"]: (u["id_termica"], u["cvu"]) for u in cv["usinas"]}
        # CVU lido à parte do Parquet do ONS (semana de 26/09/2026)
        fonte = {int(r["cod_usinaplanejamento"]): float(r["val_cvu"]) for r in pq.read_table(_p("cvu_2026_09_26_parcelas.parquet")).to_pylist()}
        self.assertEqual(fonte[36], 180.51)
        self.assertEqual(par[36], (ident["UTE.GN.MA.030202-3.01"], 180.51))      # Maranhão 4 P0
        self.assertEqual(par[26][0], ident["UTE.CM.SC.001260-2.01"])             # J. Lacerda A-1
        self.assertEqual(par[27][0], ident["UTE.CM.SC.001260-2.01"])             # J. Lacerda A-2
        self.assertEqual((par[26][1], par[27][1]), (fonte[26], fonte[27]))
        self.assertEqual(par[235][0], ident["UTE.PE.PE.031304-1.01"])            # código ligado a dois CEGs da mesma usina
        self.assertEqual(cv["cobertura"]["codigos_ambiguos"], [])
        self.assertEqual(cv["cobertura"]["pareadas_com_termica"], len(fonte))


class AusenciaNaoViraZero(unittest.TestCase):
    """P021, defeito 4: categoria sem linha no período é nula; presença parcial é contada."""

    def test_mix_sem_mmgd_antes_de_29_04_2023(self):
        con = base.conecta(":memory:")
        v = _vintage_em(con, "ons_geracao_usina", "GERACAO_USINA-2_2023_04", _p("geracao_usina_2023_04_h12.parquet"), "2026-09-30T23:00:00Z", "a" * 64)
        gd._importa_usina(con, v, "2023-04")
        D = gd.carrega_usina(con)
        cat_dia, nat_dia, rotulos, horas, cache = gd.matriz_diaria(D)
        m = gd.mix(cat_dia, horas, "SIN", ["2023-04-28"], nat_dia=nat_dia)
        self.assertIsNone(m["mwmed"]["solar_mmgd"])
        self.assertIsNone(m["participacao"]["solar_mmgd"])
        self.assertIsNone(m["natureza_pct"]["grupo_mmgd"])
        self.assertAlmostEqual(sum(v for v in m["participacao"].values() if v is not None), 100, delta=0.05)
        dois = gd.mix(cat_dia, horas, "SIN", ["2023-04-28", "2023-04-29"])
        self.assertEqual(dois["dias_com_linha"]["solar_mmgd"], 1)               # presença parcial explícita
        self.assertAlmostEqual(dois["mwmed"]["solar_mmgd"], 9984.5 / 2, delta=0.1)


class SerieHistoricaAneel(unittest.TestCase):
    """P024, defeito 6: capacidade da ANEEL por tipo em datas de referência (o SIGA por data)."""

    def test_le_recorte_oficial(self):
        dados, data_ger, inval = gd.le_aneel_historico(ckan.le_csv_bronze(_p("aneel_empreendimentos_operacao_recorte.csv")))
        self.assertEqual(data_ger, "2026-08-05")
        self.assertEqual(inval, 0)
        self.assertEqual(dados[("UHE", "2026-06")], (103235221.0, 215.0))       # mês '6 ' com espaço na fonte
        self.assertEqual(dados[("EOL", "2021-12")], (20771078.86, 789.0))
        hid = sum(dados[(t, "2026-06")][0] for t in ("UHE", "PCH", "CGH")) / 1000
        self.assertAlmostEqual(hid, 110218.1495, places=3)
        self.assertNotIn("CGU", gd.TIPO_ANEEL_GRUPO)                            # tipo fora dos grupos fica contado, não somado


class SequenciasDeZero(unittest.TestCase):
    """Defeito 10: rótulo que passa a publicar só zero depois de produzir é sinalizado; as
    usinas que saíram do arquivo são contadas."""

    def test_rotulo_zero_depois_de_producao(self):
        k = ("TÉRMICA", "Biomassa", "TIPO III")
        meses = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]
        mwh = {(k, "2025-08"): 85153.0, (k, "2025-09"): 41343.4, **{(k, m): 0.0 for m in meses[2:]}}
        U = {"cat_id": {"A": "biomassa", "B": "biomassa"}, "valor": {"A": set(meses[:2]), "B": set(meses)},
             "linhas": {"A": set(meses[:2]), "B": set(meses)}, "mwh": {("A", "2025-09"): 41343.4, ("B", "2025-09"): 0.0}}
        cad = {"A": {"tipo": k[0], "comb": k[1], "mod": k[2]}, "B": {"tipo": k[0], "comb": k[1], "mod": k[2]}}
        z = gd.sequencias_zero_rotulo({k: set(meses)}, mwh, {k: ("biomassa", "verificada")}, U, cad)
        self.assertEqual(len(z), 1)
        self.assertEqual((z[0]["inicio"], z[0]["fim"], z[0]["meses"]), ("2025-10", "2026-01", 4))
        self.assertEqual(z[0]["identificadores_que_sairam"], 1)
        # zero curto (2 meses) não é sequência longa
        mwh2 = {**mwh, (k, "2025-12"): 10.0}
        self.assertEqual(gd.sequencias_zero_rotulo({k: set(meses)}, mwh2, {k: ("biomassa", "verificada")}, U, cad), [])


class GoldPublicada(unittest.TestCase):
    """Contrato da gold publicada. Os testes de equivalência gold × CSV são controles internos
    (o CSV sai do mesmo código); os de conferência usam números lidos da fonte por outro código."""

    @classmethod
    def setUpClass(cls):
        cls.g = base.le_gold("geracao_detalhe.json")
        if not cls.g:
            raise unittest.SkipTest("gold de geração ainda não publicada")

    def _csv(self, url):
        with open(os.path.join(RAIZ, "public") + url, encoding="utf-8") as f:
            return list(csv.DictReader(f, delimiter=";"))

    def test_disponivel_tamanho_e_paineis(self):
        self.assertTrue(self.g["disponivel"])
        self.assertEqual(self.g["paineis"], ["P021", "P022", "P023", "P024"])
        self.assertLess(os.path.getsize(os.path.join(base.GOLD, "geracao_detalhe.json")), 520 * 1024)
        for d in self.g["downloads"]:
            self.assertLess(os.path.getsize(os.path.join(RAIZ, "public") + d["url"]), 5 * 1024 * 1024, d["url"])

    def test_a11_confirmado_com_fonte_primaria(self):
        a = self.g["a11"]
        self.assertEqual(a["estado"], "confirmado")
        self.assertEqual(a["primeiro_dia_mmgd"], "2023-04-29")
        self.assertEqual(a["primeira_hora_mmgd"], "2023-04-29T00:00")
        dia = next(t for t in a["tabela"] if t["d"] == "2023-04-29")
        self.assertEqual(dia["balanco_solar_mwmed"], dia["usinas_solar_mwmed"])
        antes = next(t for t in a["tabela"] if t["d"] == "2023-04-28")
        self.assertIsNone(antes["usinas_mmgd_mwmed"])  # sem linha da MMGD: ausência
        docs = {d["documento"]: d for d in a["evidencias_documentais"]}
        self.assertTrue(any("29/04/2023" in (d["trecho"] or "") for d in docs.values()))
        self.assertTrue(any("previsões de geração" in (d["trecho"] or "") for d in docs.values()))
        q = [x for x in self.g["quebras"] if x["data"] == "2023-04-29"]
        self.assertTrue(q and q[0]["origem"] == "FONTE")

    def test_participacoes_somam_100_e_mmgd_separada(self):
        for rg, js in self.g["matriz"]["janelas"].items():
            for nome, m in js.items():
                if m:
                    self.assertAlmostEqual(sum(v for v in m["participacao"].values() if v is not None), 100, delta=0.05)
                    self.assertIsNone(m["participacao_sem_mmgd"]["solar_mmgd"])

    def test_janela_30d_igual_ao_csv_diario(self):
        m = self.g["matriz"]["janelas"]["SIN"]["30d"]
        soma, horas = defaultdict(float), 0
        for r in self._csv("/energia/series/geracao_matriz_diaria.csv"):
            if r["regiao"] == "SIN" and m["inicio"] <= r["data"] <= m["fim"] and r["horas"] == "24":
                horas += 24
                for cat in m["participacao"]:
                    soma[cat] += float(r[cat]) if r[cat] else 0.0
        tot = sum(soma.values())
        self.assertEqual(horas, m["horas"])
        for cat, p in m["participacao"].items():
            if p is None:  # categoria sem linha na janela: ausente no CSV também
                self.assertEqual(soma[cat], 0.0, cat)
                continue
            self.assertAlmostEqual(100 * soma[cat] / tot, p, delta=0.006)
        self.assertAlmostEqual(tot / horas, m["total_mwmed"], delta=0.06)

    def test_restricao_12m_igual_ao_csv_por_usina(self):
        for fonte in ("eolica", "solar"):
            r = self.g["restricoes"][fonte]
            u = r["ultimos_12m"]
            eng = ger = 0.0
            for x in self._csv("/energia/series/geracao_restricao_usina_mensal.csv"):
                if x["fonte"] == fonte and u["inicio"] <= x["mes"] <= u["fim"]:
                    eng += sum(float(x[f"eng_{k}_mwh"] or 0) for k in ("REL", "CNF", "ENE", "PAR", "SEM"))
                    ger += float(x["geracao_verificada_mwh"] or 0)
            self.assertAlmostEqual(eng, u["energia_nao_gerada_mwh"], delta=1.0)  # arredondamento de 0,001 MWh por linha
            self.assertAlmostEqual(ger, u["geracao_verificada_mwh"], delta=1.0)
            self.assertAlmostEqual(100 * eng / (eng + ger), u["taxa_pct"], delta=0.01)

    def test_termica_12m_igual_ao_csv_por_usina_e_combustivel_separado(self):
        t = self.g["termica"]["ultimos_12m"]
        tot, motivo = 0.0, defaultdict(float)
        for x in self._csv("/energia/series/geracao_termica_usina_mensal.csv"):
            if t["inicio"] <= x["mes"] <= t["fim"]:
                tot += float(x["total_mwh"] or 0)
                for m in gd.MOTIVOS:
                    motivo[m] += float(x[f"{m}_mwh"] or 0)
        self.assertAlmostEqual(tot, t["total_mwh"], delta=1.0)
        for m in t["por_motivo"]:
            self.assertAlmostEqual(motivo[m["motivo"]], m["mwh"], delta=1.0)
        self.assertAlmostEqual(sum(c_["mwh"] for c_ in t["por_combustivel"]), t["total_mwh"], delta=1.0)

    def test_fator_capacidade_proximo_do_ons(self):
        for x in self.g["capacidade"]["ultimos_12m"]["por_categoria"]:
            if x["fc_ons_pct"] is not None:
                self.assertLess(abs(x["fator_capacidade_pct"] - x["fc_ons_pct"]), 2.0, x["categoria"])
            if x["fator_capacidade_pct"] is not None:
                self.assertTrue(0 <= x["fator_capacidade_pct"] <= 100, x)

    def test_valor_extremo_contado_nao_descartado(self):
        # usina-mês com fator de capacidade acima de 100% (unidade em teste, potência do ato abaixo da
        # geração bruta das nucleares) fica na conta e é listada; o agregado da categoria segue físico
        p = self.g["capacidade"]["pareamento"]["fc_acima_de_100"]
        self.assertGreater(p["n"], 0)
        self.assertGreater(p["por_categoria"].get("nuclear", 0), 0)
        self.assertTrue(all(x["fc_pct"] > 100 for x in p["exemplos"]))
        controle = [c_ for c_ in self.g["controles"] if c_["nome"].startswith("Fator de capacidade mensal acima")]
        self.assertEqual(controle[0]["resultado"], "ressalva")

    def test_comparacao_suprimida_com_salto_de_universo(self):
        comp = self.g["matriz"]["comparacao_12m"]
        for cat, info in comp["variacao_suprimida"].items():
            self.assertIsNone(comp["variacao_pct"][cat])
            saltos = [q for q in self.g["quebras"] if q["tipo"] == "salto_de_universo" and cat in q["categorias"]]
            self.assertTrue(set(info["datas"]) <= {q["data"] for q in saltos})

    # ---- defeitos da verificação de 01/10/2026; valores esperados lidos da fonte por outro
    # código (Parquet do S3 do ONS e CSV da ANEEL, laços simples), registrados no documento

    def test_ausencia_nula_na_serie_mensal_anual_e_no_csv_a11(self):
        ms = self.g["matriz"]["mensal_sin"]
        i = ms["meses"].index("2023-03")
        self.assertIsNone(ms["solar_mmgd"][i])                     # sem linha 'Pequenas Usinas (MMGD)' antes de 29/04/2023
        self.assertIsNone(ms["termica_sem_combustivel"][ms["meses"].index("2021-01")])
        self.assertEqual(ms["dias_com_linha"]["solar_mmgd"], {"2023-04": 2})  # abril/2023: só 29 e 30
        anos = {a["ano"]: a for a in self.g["matriz"]["anual_sin"]}
        self.assertIsNone(anos[2021]["mwmed"]["solar_mmgd"])
        self.assertIsNone(anos[2022]["mwmed"]["solar_mmgd"])
        linhas = {r["data"]: r for r in self._csv("/energia/series/geracao_a11_conferencia.csv")}
        self.assertEqual(linhas["2023-04-28"]["usinas_mmgd_mwh"], "")
        self.assertNotEqual(linhas["2023-04-29"]["usinas_mmgd_mwh"], "")
        self.assertFalse(any(r["usinas_mmgd_mwh"] == "0.0" for d, r in linhas.items() if d < "2023-04-29"))

    def test_ressalva_de_universo_junto_da_participacao(self):
        # fonte (GU 08/2025 e 08/2026, contagem à parte): 63 e 17 identificadores de biomassa com valor
        u = self.g["matriz"]["universo"]["identificadores_por_categoria"]
        self.assertEqual(u["biomassa"][u["meses"].index("2025-08")], 63)
        self.assertEqual(u["biomassa"][u["meses"].index("2026-08")], 17)
        for nome in ("dia", "7d", "30d", "12m"):
            r = self.g["matriz"]["janelas"]["SIN"][nome]["ressalvas_universo"]
            self.assertIn("universo_reduzido", r["biomassa"]["motivos"], nome)
            self.assertEqual(r["biomassa"]["maior_numero_12_meses_antes"], 63)
        self.assertEqual(self.g["matriz"]["janelas"]["SIN"]["30d"]["ressalvas_universo"]["biomassa"]["identificadores_com_valor_no_ultimo_mes"], 17)
        self.assertNotIn("hidraulica", self.g["matriz"]["janelas"]["SIN"]["30d"]["ressalvas_universo"])
        anos = {a["ano"]: a for a in self.g["matriz"]["anual_sin"]}
        self.assertIn("biomassa", anos[2026]["ressalvas_universo"])
        self.assertIn("2026-05", self.g["matriz"]["mensal_sin"]["ressalvas_universo"]["biomassa"])
        lac = self.g["matriz"]["universo"]["lacuna_ultimo_mes"]
        self.assertGreater(lac["detalhe_por_categoria"]["biomassa"]["sem_linhas"], 0)

    def test_natureza_mista_declarada_e_medida(self):
        from pipeline.energia import metricas
        cat = {m["id"]: m for m in metricas.todas()}
        for mid in ("geracao_categoria_mwmed", "geracao_participacao"):
            self.assertTrue(cat[mid]["natureza_fonte"].startswith("MISTO"), mid)
        for mid in ("geracao_restricao_energia", "geracao_restricao_taxa"):
            self.assertEqual(cat[mid]["natureza_fonte"], "ESTIMADO")
        for k in ("restricao_eolica", "restricao_solar"):
            self.assertEqual(self.g["proveniencia"][k]["natureza"], "ESTIMADO")
        j = self.g["matriz"]["janelas"]["SIN"]["30d"]
        self.assertAlmostEqual(sum(v for v in j["natureza_pct"].values() if v is not None), 100, delta=0.05)
        self.assertAlmostEqual(j["natureza_pct"]["grupo_mmgd"], j["participacao"]["solar_mmgd"], delta=0.01)

    def test_valor_vira_linha_vazia_e_sequencia_de_zero(self):
        q = self.g["quebras"]
        sem_valor = [x for x in q if x["tipo"] == "rotulo_sem_valor" and "Biomassa / TIPO III" in x["descricao"]]
        self.assertEqual([x["data"] for x in sem_valor], ["2026-05-01"])
        self.assertFalse(any("Biomassa / TIPO III" in x["descricao"] for x in q if x["tipo"] == "rotulo_encerrado"))
        zero = [x for x in q if x["tipo"] == "sequencia_zero" and "Biomassa / TIPO III" in x["descricao"]]
        self.assertEqual([x["data"] for x in zero], ["2025-10-01"])
        z = next(x for x in self.g["matriz"]["universo"]["sequencias_zero_rotulo"] if (x["combustivel"], x["modalidade"]) == ("Biomassa", "TIPO III"))
        # fonte: 41.343 MWh em 09/2025 (soma das horas dos 4 identificadores que produziam) e zero de 10/2025 a 04/2026
        self.assertEqual((z["inicio"], z["fim"], z["identificadores_que_sairam"]), ("2025-10", "2026-04", 4))
        self.assertAlmostEqual(z["mwh_mes_anterior"], 41343.4, delta=0.1)
        ctl = [c_ for c_ in self.g["controles"] if c_["nome"].startswith("Sequências longas")]
        self.assertEqual(ctl[0]["resultado"], "ressalva")

    def test_outros_decomposto_pelo_ceg(self):
        o = {x["codigo_ceg"]: x for x in self.g["matriz"]["outros_por_ceg"]["itens"]}
        self.assertIn("licor negro", o["FL"]["fonte_aneel"])
        # releitura da GU de 09/2025 a 08/2026: FL 173,4 MWmed; CM 396,9 + PE 56,3 (a Do Atlântico
        # antes da troca do CEG, aqui somada ao CEG atual UTE.CM)
        self.assertAlmostEqual(o["FL"]["mwmed"], 173.4, delta=0.1)
        self.assertAlmostEqual(o["CM"]["mwmed"], 396.9 + 56.3, delta=0.15)
        self.assertIn("licor negro", next(c_["rotulo"] for c_ in self.g["categorias"] if c_["id"] == "outros"))

    def test_ciclo_combinado_no_gas_e_potencia_coerente_com_o_fc(self):
        rcc = [r for r in self._csv("/energia/series/geracao_capacidade_unidades.csv")
               if og.norm(r["combustivel"]) == og.COMBUSTIVEL_CICLO_COMBINADO and not r["desativacao"]]
        # fonte (CAPACIDADE_GERACAO.parquet de 30/09/2026): 21 unidades RCC em operação, 3.529,766 MW
        self.assertEqual(len(rcc), 21)
        self.assertAlmostEqual(sum(float(r["potencia_mw"]) for r in rcc), 3529.766, delta=0.001)
        self.assertFalse(any(r["categoria"] == "outros" for r in rcc))
        for x in self.g["capacidade"]["ultimos_12m"]["por_categoria"]:
            self.assertLessEqual(x["capacidade_hora_media_mw"], x["potencia_media_12m_mw"] + 0.05, x["categoria"])
        termorio = [r for r in self._csv("/energia/series/geracao_capacidade_usina_mensal.csv") if r["grupo"] == "ceg:UTE.GN.RJ.027888-2.01" and r["mes"] == "2026-08"]
        self.assertEqual(termorio[0]["categoria"], "gas")
        self.assertAlmostEqual(float(termorio[0]["potencia_operacional_mw"]), 989.2, delta=0.001)

    def test_do_atlantico_uma_usina_com_combustivel_em_todo_o_historico(self):
        t = self.g["termica"]
        atl = [u for u in t["usinas_12m"] if "UTE.PE.RJ.029587-6.01" in u["chaves_na_fonte"]]
        self.assertEqual(len(atl), 1)
        self.assertEqual(atl[0]["categoria"], "outros")
        # releitura da TD 09/2025 a 08/2026: 2.041.706,9 MWh sob UTE.CM e 483.460,4 sob UTE.PE
        self.assertAlmostEqual(atl[0]["mwh"], 2041706.9 + 483460.4, delta=0.2)
        self.assertEqual(t["mapa_combustivel"]["nao_identificadas_mwh_12m"], 0.0)
        mc = t["mensal_combustivel"]
        for m in ("2022-07", "2024-01", "2025-10", "2025-11"):
            self.assertIsNotNone(mc["outros"][mc["meses"].index(m)], m)
        self.assertTrue(all(v is None for v in mc["nao_mapeada"][mc["meses"].index("2022-07"):]))

    def test_cvu_pareado_por_parcela(self):
        cv = self.g["termica"]["cvu"]
        self.assertEqual(cv["cobertura"]["codigos_ambiguos"], [])
        self.assertEqual(sorted(cv["cobertura"]["sem_par"]), sorted(["UTE MANAUS", "ST.CRUZ 34", "BARCARENA", "AZULAO", "PALMAPLAN"]))
        m4 = next(u for u in self.g["termica"]["usinas_12m"] if u["id"] == "UTE.GN.MA.030202-3.01")
        p0 = next(p_ for p_ in m4["parcelas"] if p_["cod"] == 36)
        self.assertEqual(p0["cvu_semana_vigente"], 180.51)                        # MARANHAOIV, semana de 26/09/2026
        self.assertEqual(m4["cvu_semana_vigente"], 180.51)
        jl = next(u for u in self.g["termica"]["usinas_12m"] if u["id"] == "UTE.CM.SC.001260-2.01")
        self.assertIsNone(jl["cvu_semana_vigente"])                              # duas parcelas com CVU: um por parcela
        self.assertEqual({p_["cod"]: p_["cvu_semana_vigente"] for p_ in jl["parcelas"]}, {26: 518.9, 27: 416.39})

    def test_correspondencia_temporal_aneel_mmgd_e_geracao(self):
        ctx = self.g["capacidade"]["contexto"]
        h = ctx["siga_historico"]
        i = h["datas"].index("2026-06")
        self.assertAlmostEqual(h["grupos"]["hidraulica"]["aneel_mw"][i], 110218.1, delta=0.05)  # UHE + PCH + CGH do CSV da ANEEL
        self.assertAlmostEqual(h["grupos"]["eolica"]["aneel_mw"][i], 34810.7, delta=0.05)
        mm = ctx["mmgd"]["mensal"]
        self.assertEqual(mm["meses"][0], "2023-05")
        self.assertEqual(len(mm["meses"]), len(mm["potencia_cadastrada_mw"]))
        self.assertTrue(all(v is not None for v in mm["geracao_estimada_ons_mwmed"]))

    def test_textos_e_descricoes_conferem_com_o_dado(self):
        with open(os.path.join(RAIZ, "docs", "observatorios", "energia", "modulos", "geracao.md"), encoding="utf-8") as f:
            doc = f.read()
        cob = self.g["termica"]["usinas_12m_resumo"]["cobertura_da_energia_pct"]
        self.assertIn(f"{cob:.1f}".replace(".", ",") + "% da energia", doc)
        # colunas declaradas da reconciliação = cabeçalho do CSV
        desc = gd.REGISTRO["arquivos"][gd.CSV["reconciliacao"]]
        cab = list(self._csv(gd.CSV["reconciliacao"])[0].keys())
        for col in cab:
            self.assertIn(col, desc, col)
        self.assertNotIn("usinas_roraima_mwh", desc)
        # coordenada sem subestação coletora vem do ponto de conexão, com a origem registrada
        sol = {u["id"]: u for u in self.g["restricoes"]["solar"]["usinas_12m"]}
        if "CJU_MGSDJ" in sol:
            self.assertEqual(sol["CJU_MGSDJ"]["origem_coordenada"], "ponto_de_conexao")
            self.assertEqual((sol["CJU_MGSDJ"]["lat"], sol["CJU_MGSDJ"]["lon"]), (-15.2928, -43.7153))
        # citação de número com vários arquivos nomeia os recursos
        for k, e in self.g["evidencias"].items():
            if e["fonte"].get("arquivos"):
                self.assertNotIn("recurso não identificado", e["citacao"], k)
                recs = sorted(a["recurso"] for a in e["fonte"]["arquivos"])
                self.assertIn(recs[-1], e["citacao"], k)

    def test_evidencias_validas(self):
        self.assertGreaterEqual(len(self.g["evidencias"]), 10)
        for k, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], k)


if __name__ == "__main__":
    unittest.main()
