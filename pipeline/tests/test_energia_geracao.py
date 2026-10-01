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
  cvu_2026_01_17.parquet e os textos dos dicionários (pdftotext -layout).

Os valores esperados vêm de caminho independente do código testado: a linha SIN do
próprio balanço do ONS, o campo GNRa publicado pelo ONS, as colunas de total da fonte e
somas feitas à parte com laços simples sobre as amostras (registradas no documento do módulo)."""
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
        mw, inst = self.a["pot_max"][("2026-08-31", "SIN")]
        self.assertAlmostEqual(mw, 90.203, delta=0.001)
        self.assertEqual(inst, "2026-08-31T15:30")


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


class GoldPublicada(unittest.TestCase):
    """Contrato da gold publicada e equivalência com os CSV de download (outro código lê o CSV)."""

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

    def test_evidencias_validas(self):
        self.assertGreaterEqual(len(self.g["evidencias"]), 10)
        for k, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], k)


if __name__ == "__main__":
    unittest.main()
