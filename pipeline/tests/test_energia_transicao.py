"""Módulo Transição e ambiente (P063 e P064): MMGD da ANEEL, estimativa de MMGD do ONS,
população do IBGE e fatores de emissão do MCTI.

Sem rede. Amostras reais recortadas em pipeline/tests/dados/energia_transicao/ (ver o
README do documento do módulo): linhas do Parquet e do CSV oficiais da ANEEL de
29/09/2026 (CPF e CEP de pessoa física anulados, nome de titular removido), respostas
da API do ONS, tabela SIDRA de Roraima e planilhas do MCTI recortadas às primeiras linhas.

Os valores esperados escritos aqui foram obtidos por caminho independente do código
testado: somas com Decimal sobre o CSV oficial completo (4.656.839 linhas), expressão
regular sobre o texto bruto da API do ONS e leitura visual das planilhas do MCTI."""
import csv
import gzip
import io
import json
import os
import sys
import tempfile
import unittest
from collections import Counter
from datetime import date, datetime, timezone
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_transicao as mmgd  # noqa: E402
from pipeline.energia.fontes import mcti_transicao as mcti  # noqa: E402
from pipeline.energia.fontes import ons_transicao as ons  # noqa: E402
from pipeline.energia.modulos import transicao  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_transicao")
PARQUET = os.path.join(DADOS, "mmgd_amostra.parquet")
CSV_GZ = os.path.join(DADOS, "mmgd_amostra.csv.gz")

CNPJ_CODESAM = "11810343000138"   # cooperativa pequena de SC (20 unidades no cadastro inteiro)
CNPJ_CERES = "31465487000101"     # cooperativa com unidades em MG e RJ
CNPJ_AMBAR_AM = "02341467000120"  # "Âmbar Amazonas": CNPJ da antiga Amazonas Energia


def _linhas_csv():
    with gzip.open(CSV_GZ, "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _linhas_parquet():
    return list(mmgd.linhas_parquet(PARQUET))


class _Ambiente(unittest.TestCase):
    """Silver em memória e bronze/séries em diretório temporário."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.multiple(base, BRONZE=os.path.join(self.tmp.name, "bronze"),
                                     SILVER=os.path.join(self.tmp.name, "silver"),
                                     SERIES=os.path.join(self.tmp.name, "series"),
                                     GOLD=os.path.join(self.tmp.name, "gold"))
        self.p.start()
        self.con = base.conecta(":memory:")

    def tearDown(self):
        self.con.close()
        self.p.stop()
        self.tmp.cleanup()


# ---------------------------------------------------------------------------
# ANEEL: relação de empreendimentos de MMGD
# ---------------------------------------------------------------------------

class LeituraMMGD(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pq = _linhas_parquet()
        cls.csv = _linhas_csv()
        cls.ag_pq = mmgd.agrega(cls.pq)
        cls.ag_csv = mmgd.agrega(cls.csv)

    def test_parquet_e_csv_oficiais_dao_o_mesmo_agregado(self):
        """Caminho independente: o CSV (texto, vírgula decimal, lido pelo módulo csv) e o
        Parquet (tipado, lido pelo pyarrow) do mesmo conjunto produzem os mesmos agregados."""
        self.assertEqual(len(self.pq), len(self.csv))
        for nome in ("mun_ano_fonte", "uf_mes_fonte", "dist_uf_ano", "classe_ano", "modalidade_ano", "fonte_detalhe_ano"):
            a, b = getattr(self.ag_pq, nome), getattr(self.ag_csv, nome)
            self.assertEqual(set(a), set(b), nome)
            for k in a:
                self.assertEqual(a[k][0], b[k][0], (nome, k))
                self.assertAlmostEqual(a[k][1], b[k][1], delta=0.005, msg=(nome, k))

    def test_distribuidora_pequena_reconcilia_com_o_cadastro_inteiro(self):
        """CODESAM no CSV oficial completo de 29/09/2026 (soma Decimal): 20 unidades,
        332,07 kW, todas em SC. A amostra traz todas as linhas dessa distribuidora."""
        q = sum(v[0] for (cn, uf, _), v in self.ag_pq.dist_uf_ano.items() if cn == CNPJ_CODESAM)
        kw = sum(v[1] for (cn, uf, _), v in self.ag_pq.dist_uf_ano.items() if cn == CNPJ_CODESAM)
        ufs = {uf for (cn, uf, _) in self.ag_pq.dist_uf_ano if cn == CNPJ_CODESAM}
        self.assertEqual(q, 20)
        self.assertAlmostEqual(kw, 332.07, delta=0.005)
        self.assertEqual(ufs, {"SC"})

    def test_distribuidora_multiestadual_separa_as_ufs(self):
        """CERES no CSV completo: MG 4 unidades e 32,91 kW; RJ 190 unidades e 2.806,09 kW."""
        por_uf = {}
        for (cn, uf, _), (q, kw, _s) in self.ag_pq.dist_uf_ano.items():
            if cn == CNPJ_CERES:
                a = por_uf.setdefault(uf, [0, 0.0])
                a[0] += q
                a[1] += kw
        self.assertEqual(sorted(por_uf), ["MG", "RJ"])
        self.assertEqual(por_uf["MG"][0], 4)
        self.assertAlmostEqual(por_uf["MG"][1], 32.91, delta=0.005)
        self.assertEqual(por_uf["RJ"][0], 190)
        self.assertAlmostEqual(por_uf["RJ"][1], 2806.09, delta=0.005)
        self.assertEqual(len(self.ag_pq.dist_mun[CNPJ_CERES]) >= 2, True)

    def test_identidade_pelo_cnpj_e_nao_pelo_nome(self):
        """O Parquet traz o CNPJ como inteiro (sem o zero à esquerda); a chave canônica
        tem 14 dígitos. A sigla publicada ("Âmbar Amazonas") não entra na chave."""
        ambar = [r for r in self.pq if entidades.cnpj(r["NumCNPJDistribuidora"]) == CNPJ_AMBAR_AM]
        self.assertTrue(ambar)
        self.assertIsInstance(ambar[0]["NumCNPJDistribuidora"], int)
        chaves = {cn for (cn, _, _) in self.ag_pq.dist_uf_ano}
        self.assertIn(CNPJ_AMBAR_AM, chaves)
        self.assertNotIn(str(int(CNPJ_AMBAR_AM)), chaves)
        (sigla, _), n = self.ag_pq.nomes_dist[CNPJ_AMBAR_AM].most_common(1)[0]
        self.assertEqual(sigla, "Âmbar Amazonas")
        self.assertEqual(n, len(ambar))

    def test_data_sentinela_fica_no_estoque_sem_ano(self):
        sentinela = [r for r in self.pq if r["DthAtualizaCadastralEmpreend"] and r["DthAtualizaCadastralEmpreend"].year == 1900]
        self.assertEqual(len(sentinela), 4)
        self.assertEqual(self.ag_pq.controles()["data_invalida"], 4)
        sem = sum(q for (_, ano, _), (q, _, _) in self.ag_pq.mun_ano_fonte.items() if ano == mmgd.SEM_DATA)
        self.assertEqual(sem, 4)
        anos = {ano for (_, ano, _) in self.ag_pq.mun_ano_fonte}
        self.assertNotIn("1900", anos)

    def test_municipio_de_seis_digitos_so_com_prefixo_unico_do_ibge(self):
        """O registro da CERILUZ vem com CodMunicipioIbge 431780 e sem SigUF. O IBGE tem um
        único município com esse prefixo: 4317806 (Santo Augusto, RS). Sem o cadastro IBGE,
        o código não é adivinhado."""
        raw = next(r for r in self.pq if r["SigUF"] is None)
        self.assertEqual(raw["CodMunicipioIbge"], 431780)
        sem = mmgd.normaliza(raw)
        self.assertIsNone(sem["mun"])
        self.assertEqual(sem["situacao_mun"], "invalido")
        com = mmgd.normaliza(raw, ibge_por_prefixo6={"431780": "4317806"})
        self.assertEqual((com["mun"], com["uf"], com["situacao_mun"]), ("4317806", "RS", "completado_6"))

    def test_fonte_nao_informada_e_potencia_zero_sao_estados_proprios(self):
        c = self.ag_pq.controles()
        self.assertEqual(c["fonte_nao_informada"], 3)
        self.assertEqual(c["potencia_zero"], 2)
        fontes = {f for (_, _, f) in self.ag_pq.mun_ano_fonte}
        self.assertIn("nao_informada", fontes)

    def test_potencia_ausente_nao_vira_zero(self):
        """Caso de robustez derivado de uma linha real com a potência removida: a unidade
        conta, a potência não entra na soma, o agregado guarda quantas unidades entraram sem
        potência (série qtd_sem_kw.*) e a publicação é nula, nunca 0,0 kW (defeito apontado
        na verificação de 01/10/2026: o agregado publicava 0,0 kW e o teste consagrava o zero)."""
        raw = dict(self.pq[0])
        raw["MdaPotenciaInstaladaKW"] = None
        ag = mmgd.agrega([raw])
        (q, kw, sem), = ag.mun_ano_fonte.values()
        self.assertEqual((q, sem), (1, 1))
        self.assertEqual(ag.controles()["potencia_ausente"], 1)
        self.assertNotIn("potencia_zero", ag.controles())
        obs = {(s, r): v for s, r, v in ag.observacoes()}
        self.assertEqual([v for (s, _), v in obs.items() if s == "qtd_sem_kw.mun_ano_fonte"], [1.0])
        self.assertIsNone(transicao._kw_pub(kw, q, sem))           # nenhuma unidade com potência: nula
        self.assertIsNone(transicao._kw_pub(kw, q, sem, mw=True))
        # uma segunda unidade igual, com a potência publicada: soma parcial, rotulada pela contagem
        raw2 = dict(self.pq[0])
        raw2["CodEmpreendimento"] = raw2["CodEmpreendimento"] + "-2"
        (q2, kw2, sem2), = mmgd.agrega([raw, raw2]).mun_ano_fonte.values()
        self.assertEqual((q2, sem2), (2, 1))
        self.assertAlmostEqual(transicao._kw_pub(kw2, q2, sem2), self.pq[0]["MdaPotenciaInstaladaKW"], delta=0.005)
        # sem unidade sem potência, a série qtd_sem_kw não é gravada
        self.assertFalse(any(s.startswith("qtd_sem_kw.") for s, _, _ in self.ag_pq.observacoes()))

    def test_valor_extremo_de_minigeracao_e_mantido(self):
        extremos = [r for r in self.pq if r["MdaPotenciaInstaladaKW"] == 5000.0]
        self.assertEqual(len(extremos), 1)
        self.assertEqual(extremos[0]["DscPorte"], "Minigeracao")
        total = sum(v[1] for v in self.ag_pq.mun_ano_fonte.values())
        soma_direta = sum(r["MdaPotenciaInstaladaKW"] for r in self.pq if r["MdaPotenciaInstaladaKW"] is not None)
        self.assertAlmostEqual(total, soma_direta, delta=1e-6)

    def test_identidade_de_agregacao(self):
        n = len(self.pq)
        for nome in ("mun_ano_fonte", "uf_mes_fonte", "dist_uf_ano", "classe_ano", "porte_ano", "fonte_detalhe_ano"):
            self.assertEqual(sum(v[0] for v in getattr(self.ag_pq, nome).values()), n, nome)

    def test_duplicidade_candidata_mede_sem_remover(self):
        """Cinco unidades reais da EDP SP em Guaratinguetá (mesmo CNPJ de pessoa jurídica,
        CEP, data, 0,81 kW, classe e modalidade; códigos distintos). Só pessoas jurídicas,
        porque na amostra o CPF e o CEP de pessoa física foram anulados."""
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        t = pq.read_table(PARQUET)
        pj = t.filter(pc.equal(t["SigTipoConsumidor"], "PJ"))
        r = mmgd.duplicidade_candidata(pj)
        self.assertEqual(r["duplicidade_candidata_grupos"], 1)
        self.assertEqual(r["duplicidade_candidata_linhas_extras"], 4)
        self.assertAlmostEqual(r["duplicidade_candidata_kw_extras"], 3.24, delta=1e-9)
        self.assertEqual(len(set(t["CodEmpreendimento"].to_pylist())), t.num_rows)

    def test_controles_por_partes_iguais_aos_da_tabela_inteira(self):
        """Os controles rodam por partes (último caractere do código; grupos de
        distribuidoras) para caber na memória; o resultado tem de ser o da tabela inteira."""
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        t = pq.read_table(PARQUET)
        chave = [c for c in mmgd.CHAVE_DUPLICIDADE if c in t.column_names]
        inteira = mmgd.duplicidade_candidata(t.select(chave), chave)
        partes = mmgd.controles_tabela(PARQUET)
        for k, v in inteira.items():
            self.assertEqual(partes[k], v, k)
        self.assertEqual(partes["codigos_distintos"], len(pc.unique(t["CodEmpreendimento"])))
        self.assertEqual(partes["codigos_repetidos"], 0)
        self.assertGreater(inteira["duplicidade_candidata_linhas_extras"], 0)

    def test_observacoes_usam_referencia_composta(self):
        obs = list(self.ag_pq.observacoes())
        series = {s for s, _, _ in obs}
        self.assertIn("qtd.mun_ano_fonte", series)
        self.assertIn("kw.dist_uf_ano", series)
        refs = [r for s, r, _ in obs if s == "qtd.dist_uf_ano"]
        self.assertTrue(all(r.count("|") == 2 for r in refs))
        self.assertLess(len(series), 30)  # poucas séries: o IN(...) do SQLite nunca estoura


# ---------------------------------------------------------------------------
# ONS: parcela da carga atendida por MMGD (API de carga verificada)
# ---------------------------------------------------------------------------

def _ons(area, dia):
    with gzip.open(os.path.join(DADOS, f"ons_cargaverificada_{area}_{dia}.json.gz")) as f:
        return f.read()


class EstimativaONS(unittest.TestCase):
    # Soma com Decimal de val_cargammgd × 0,5 sobre o texto bruto de cada resposta
    ESPERADO_MWH = {"SECO": 98292.4889, "S": 31365.0433, "NE": 50760.8238, "N": 23952.35175}

    def test_energia_diaria_reconciliada_com_o_texto_bruto(self):
        for area, esperado in self.ESPERADO_MWH.items():
            d = ons.agrega_diario(ons.parse(_ons(area, "2026-09-01")))
            a = d[(area, "2026-09-01")]
            self.assertAlmostEqual(a["mmgd_mwh"], esperado, delta=1e-6, msg=area)
            self.assertEqual(a["n_mmgd"], 48)

    def test_campo_vazio_de_2018_e_ausencia_nao_zero(self):
        """Em 2018 a API responde `"val_cargammgd": ,` (JSON inválido). Vira null: sem
        observação de MMGD, mas a carga global do dia continua."""
        texto = _ons("SECO", "2018-06-01")
        self.assertIn(b'"val_cargammgd": ,', texto)
        with self.assertRaises(json.JSONDecodeError):
            json.loads(texto)
        regs = ons.parse(texto)
        self.assertEqual(len(regs), 48)
        self.assertTrue(all(r["val_cargammgd"] is None for r in regs))
        obs = list(ons.observacoes(ons.agrega_diario(regs)))
        series = {s for s, _, _ in obs}
        self.assertNotIn("mmgd_mwh.SE", series)
        self.assertIn("global_mwh.SE", series)

    def test_intervalo_repetido_conta_uma_vez(self):
        regs = ons.parse(_ons("S", "2026-09-01"))
        d1 = ons.agrega_diario(regs)
        d2 = ons.agrega_diario(regs + regs[:5])
        self.assertEqual(d1, d2)

    def test_identidade_do_ons_carga_global_igual_sem_mmgd_mais_mmgd(self):
        for area in self.ESPERADO_MWH:
            a = ons.agrega_diario(ons.parse(_ons(area, "2026-09-01")))[(area, "2026-09-01")]
            self.assertAlmostEqual(a["global_mwh"], a["semmmgd_mwh"] + a["mmgd_mwh"], delta=0.1, msg=area)

    def test_dia_em_curso_na_captura_nao_e_dia_verificado(self):
        """A API devolve as 48 meias horas do dia corrente com zeros nas horas futuras: o
        dia da captura (data de Brasília) fica fora; o dia anterior entra inteiro."""
        regs = ons.parse(_ons("S", "2026-09-01"))
        self.assertEqual(ons.agrega_diario(regs, dia_limite="2026-09-01"), {})
        a = ons.agrega_diario(regs, dia_limite="2026-09-02")[("S", "2026-09-01")]
        self.assertAlmostEqual(a["mmgd_mwh"], self.ESPERADO_MWH["S"], delta=1e-6)
        self.assertEqual(transicao._data_brasilia("2026-10-01T02:59:00Z"), "2026-09-30")
        self.assertEqual(transicao._data_brasilia("2026-10-01T03:00:00Z"), "2026-10-01")


class BlocoONS(_Ambiente):
    def test_sin_mensal_e_razao_de_somas_e_mes_incompleto_marcado(self):
        """SIN em 01/09/2026 = soma dos quatro submercados (204.370,70775 MWh) ÷ 24 h =
        8.515,4 MWmed. Um dia só: mês incompleto e sem razão com o cadastro."""
        for area in ons.AREAS.values():
            recurso = f"carga_verificada_{area}_2026-09"
            corpo = _ons(area, "2026-09-01")
            vid, _ = base.registra_vintage(self.con, transicao.DS_ONS, recurso, "https://x", "2026-09-30T00:00:00Z", None,
                                           base.sha256_bytes(corpo), len(corpo), "teste", None)
            base.grava_observacoes(self.con, transicao.DS_ONS, vid, ons.observacoes(ons.agrega_diario(ons.parse(corpo))))
        b = transicao._bloco_ons(self.con, None, {"2026-08": 50_000_000.0, "2026-09": 51_000_000.0})
        m = b["mensal"][-1]
        self.assertEqual(m["m"], "2026-09")
        self.assertAlmostEqual(m["SIN"], 8515.4, delta=0.05)
        self.assertEqual(m["dias_completos_sin"], 1)
        self.assertFalse(m["completo"])
        self.assertIsNone(m["razao_estimativa_ons_capacidade_pct"])
        self.assertEqual(m["capacidade_aneel_mw"], 50500)
        self.assertTrue(os.path.exists(os.path.join(base.SERIES, "transicao_ons_mmgd_mensal.csv")))
        self.assertIsNone(b["ultimo_mes_completo"])
        self.assertIsNone(b["evidencia"])  # sem mês completo, nada a comprovar
        # mês posterior ao corte provisório do cadastro: capacidade marcada, razão ausente
        b2 = transicao._bloco_ons(self.con, None, {"2026-08": 50_000_000.0, "2026-09": 51_000_000.0}, corte_provisorio="2026-03")
        self.assertTrue(b2["mensal"][-1]["capacidade_aneel_provisoria"])
        self.assertIsNone(b2["mensal"][-1]["razao_estimativa_ons_capacidade_pct"])
        b3 = transicao._bloco_ons(self.con, None, {"2026-08": 50_000_000.0, "2026-09": 51_000_000.0}, corte_provisorio="2026-12")
        self.assertFalse(b3["mensal"][-1]["capacidade_aneel_provisoria"])


# ---------------------------------------------------------------------------
# IBGE: população estimada (SIDRA 6579)
# ---------------------------------------------------------------------------

class PopulacaoIBGE(unittest.TestCase):
    def test_soma_dos_municipios_de_roraima_igual_ao_total_da_uf(self):
        """Reconciliação com o próprio IBGE: 15 municípios de RR somam a população da UF
        (761.012 em 2026)."""
        with open(os.path.join(DADOS, "sidra_6579_rr.json"), "rb") as f:
            linhas = transicao.parse_sidra(f.read())
        uf = [v for n, cod, _, _, v in linhas if n == "3"]
        muns = [v for n, cod, _, _, v in linhas if n == "6"]
        self.assertEqual(uf, [761012.0])
        self.assertEqual(len(muns), 15)
        self.assertEqual(sum(muns), 761012.0)
        self.assertTrue(all(a == "2026" for _, _, _, a, _ in linhas))


# ---------------------------------------------------------------------------
# MCTI: fatores de emissão
# ---------------------------------------------------------------------------

def _xlsx(nome):
    with open(os.path.join(DADOS, nome), "rb") as f:
        return f.read()


class FatoresMCTI(unittest.TestCase):
    def test_inventario_mensal_e_anual(self):
        """Valores lidos na planilha Inventario_2021_jan-a-dez.xlsx do MCTI."""
        p = mcti.parse_inventario(mcti.le_xlsx(_xlsx("mcti_inventario_2021.xlsx")))
        self.assertEqual(len(p["mensal"]), 192)  # 2006 a 2021, 12 meses cada
        self.assertEqual(len(p["anual"]), 16)
        self.assertEqual(p["anual"]["2006"], 0.0323)
        self.assertEqual(p["anual"]["2021"], 0.1264)
        self.assertEqual(p["mensal"]["2006-01"], 0.0322)
        self.assertEqual(p["mensal"]["2012-11"], 0.1247)  # mês corrigido pelo MCTI (aviso na página)
        self.assertEqual(p["mensal"]["2014-08"], 0.1578)
        self.assertEqual(p["problemas"], [])

    def test_coluna_de_julho_rotulada_maio_e_lida_pela_posicao(self):
        """No bloco diário de 2015 a coluna I está rotulada "Maio". Lida pelo rótulo,
        apagaria maio com os dados de julho. Conferência independente: a média simples dos
        dias de julho fica a menos de 0,005 do fator mensal de julho publicado (0,5686)."""
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2015_recorte.xlsx")))
        self.assertEqual(p["om_diario"]["2015-05-01"], 0.517)
        self.assertEqual(p["om_diario"]["2015-07-01"], 0.5855)
        julho = [v for k, v in p["om_diario"].items() if k.startswith("2015-07")]
        self.assertEqual(len(julho), 31)
        self.assertAlmostEqual(sum(julho) / 31, p["om_mensal"]["2015-07"], delta=0.005)
        self.assertEqual(p["om_mensal"]["2015-07"], 0.5686)
        self.assertEqual(len(p["problemas"]), 1)
        self.assertEqual(p["bm"], 0.2553)

    def test_29_de_fevereiro_inexistente_e_descartado(self):
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2021_recorte.xlsx")))
        self.assertNotIn("2021-02-29", p["om_diario"])
        self.assertEqual(p["descartes"], [{"data": "2021-02-29", "valor": 0.0, "motivo": "data inexistente no calendário"}])
        self.assertEqual(len([k for k in p["om_diario"] if k.startswith("2021-02")]), 28)
        self.assertIsNone(p["bm"])  # a planilha diz "Valor a ser publicado no início de 2022"
        self.assertIn("publicado", p["bm_nota"])
        self.assertEqual(p["om_mensal"]["2021-01"], 0.6001)

    def test_revisao_declarada_pela_fonte(self):
        """Recorte das primeiras linhas da planilha de 2020: as revisões mensais e, no bloco
        diário, os valores da publicação anterior que caem nessas linhas (valores lidos na
        planilha: coluna principal × coluna da direita)."""
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2020_recorte.xlsx")))
        self.assertEqual(p["revisoes"], [
            {"serie": "margem_operacao_mensal", "periodo": "2020-09", "anterior": 0.3285, "atual": 0.3287},
            {"serie": "margem_operacao_mensal", "periodo": "2020-10", "anterior": 0.572, "atual": 0.5723},
            {"serie": "margem_operacao_mensal", "periodo": "2020-12", "anterior": 0.6078, "atual": 0.6106},
            {"serie": "margem_operacao_diaria", "periodo": "2020-10-02", "anterior": 0.5437, "atual": 0.5439},
            {"serie": "margem_operacao_diaria", "periodo": "2020-12-01", "anterior": 0.5409, "atual": 0.5472},
            {"serie": "margem_operacao_diaria", "periodo": "2020-12-02", "anterior": 0.5447, "atual": 0.551},
            {"serie": "margem_operacao_diaria", "periodo": "2020-12-03", "anterior": 0.5511, "atual": 0.5573},
            {"serie": "margem_operacao_diaria", "periodo": "2020-12-04", "anterior": 0.5428, "atual": 0.549}])
        self.assertEqual(p["bm"], 0.0979)

    def test_metodo_simples_ajustado_da_pagina_html(self):
        with open(os.path.join(DADOS, "mcti_emissao_ajustado_recorte.html"), "rb") as f:
            p = mcti.parse_simples_ajustado(f.read())
        self.assertEqual(len(p["om"]), 15)
        self.assertEqual(p["om"]["2016"], 0.436)
        self.assertEqual(p["om"]["2019"], 0.386)
        self.assertEqual(p["energia_mwh"]["2020"], 460901666.0)
        self.assertEqual(p["anos_com_nota"], {"2016": "*", "2019": "**"})
        self.assertTrue(any("0,4372" in n for n in p["notas"]))
        self.assertTrue(any("0,3992" in n for n in p["notas"]))

    def test_desafio_de_verificacao_humana_e_detectado_e_nao_vira_dado(self):
        with open(os.path.join(DADOS, "mcti_desafio_waf_recorte.html"), "rb") as f:
            corpo = f.read()
        self.assertEqual(mcti.desafio_waf(corpo), "11080339514068322584")
        with open(os.path.join(DADOS, "mcti_emissao_ajustado_recorte.html"), "rb") as f:
            self.assertIsNone(mcti.desafio_waf(f.read()))
        with self.assertRaises(Exception):
            mcti.le_xlsx(corpo)  # a "planilha" servida é HTML: nunca é lida como dado


class BlocoEmissoes(_Ambiente):
    def test_fator_medio_e_margens_em_series_separadas(self):
        for nome, ext, corpo in (("antigo_Inventario_2021_jan-a-dez", "xlsx", _xlsx("mcti_inventario_2021.xlsx")),
                                 ("antigo_Despacho-2015", "xlsx", _xlsx("mcti_despacho_2015_recorte.xlsx")),
                                 ("antigo_Despacho_2021_jan-a-dez", "xlsx", _xlsx("mcti_despacho_2021_recorte.xlsx"))):
            transicao._grava_mcti(self.con, nome, f"https://antigo.mctic.gov.br/{nome}.{ext}", corpo, ext, "teste")
        b = transicao._bloco_emissoes(self.con)
        self.assertEqual(b["unidade"], "tCO2/MWh")
        self.assertIn("não CO2e", b["gas"])
        anual = {x["ano"]: x["valor"] for x in b["medio_anual"]}
        self.assertEqual(anual[2021], 0.1264)
        om = {x["m"]: x["valor"] for x in b["margem_operacao_despacho_mensal"]}
        self.assertEqual(om["2021-01"], 0.6001)
        self.assertNotIn("2021-01", {x["m"] for x in b["medio_mensal"] if x["valor"] == 0.6001})
        self.assertEqual({x["ano"] for x in b["margem_construcao_anual"]}, {2015})
        self.assertEqual(len(b["descartes"]), 1)
        self.assertEqual(len(b["problemas_de_leitura"]), 1)
        self.assertLess(b["consistencia_diaria_mensal"]["maior_diferenca_absoluta"], 0.01)
        self.assertFalse(b["estimativa_propria"]["publicada"])
        # controle de leitura do anual: média simples dos 12 meses publicados na mesma planilha
        d2021 = next(x for x in b["anual_x_media_mensal"] if x["ano"] == 2021)
        self.assertAlmostEqual(d2021["media_simples_meses"], 0.1264, delta=0.0001)
        self.assertTrue(d2021["dentro_da_tolerancia"])
        self.assertEqual(b["acesso"]["familias_usadas"], ["antigo"])
        self.assertIsNone(b["pagina_vigente"])


URL_ATUAL = "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao/arquivo/"


def _pagina_vigente():
    with gzip.open(os.path.join(DADOS, "mcti_pagina_vigente_recorte.html.gz")) as f:
        return f.read()


class PaginaVigenteMCTI(unittest.TestCase):
    """Recorte das tabelas da página vigente do MCTI capturada em 30/09/2026."""

    def test_so_ancoras_visiveis_sao_publicacao(self):
        """Das 36 âncoras de planilha, 13 não têm texto (invisíveis ao leitor) e apontam para
        versões antigas, entre elas o primeiro semestre de 2021 superado pelo ano completo."""
        corpo = _pagina_vigente()
        self.assertEqual(len(mcti.links_xlsx(corpo, mcti.URL_PAGINA_ATUAL)), 36)
        pub, ocultas = mcti.planilhas_publicadas(corpo, mcti.URL_PAGINA_ATUAL)
        self.assertEqual(len(pub), 23)
        self.assertEqual(len(ocultas), 13)
        arquivos = [p["arquivo"] for p in pub]
        self.assertIn("Despacho_2021_jandez.xlsx", arquivos)
        self.assertNotIn("Despacho_2021_jan-a-jun.xlsx", arquivos)
        self.assertTrue(any(u.endswith("/Despacho_2021_jan-a-jun.xlsx") for u in ocultas))
        titulos = {p["arquivo"]: p["titulo"] for p in pub}
        self.assertEqual(titulos["Inventario_2026_janago.xlsx"], "Inventários Corporativos - 2026")
        self.assertIn("com correções nos meses de janeiro e março a setembro", titulos["Despacho_2024_jandezcomcorrees_FE_MC.xlsx"])
        # a planilha do ano-base 2006 aparece oculta na linha de 2025 e visível na própria linha: uma vez, publicada
        base2006 = [p for p in pub if p["arquivo"].endswith("ano-base-2006.xlsx")]
        self.assertEqual(len(base2006), 1)
        self.assertTrue(base2006[0]["titulo"].endswith("Ano Base 2006"))
        self.assertFalse(any(u.endswith("ano-base-2006.xlsx") for u in ocultas))

    def test_comentario_html_nao_e_publicacao(self):
        corpo = b'<table><tr><td>Planilha</td><td><!-- <a href="/x/Velha.xlsx">Aqui</a> --><a href="/x/Nova.xlsx">Aqui</a></td></tr></table>'
        pub, ocultas = mcti.planilhas_publicadas(corpo, "https://www.gov.br/")
        self.assertEqual([p["arquivo"] for p in pub], ["Nova.xlsx"])
        self.assertEqual(ocultas, [])


class ListagemMCTI(_Ambiente):
    def test_listagem_so_vira_vintage_quando_muda(self):
        corpo = _pagina_vigente()
        pub, ocu = mcti.planilhas_publicadas(corpo, mcti.URL_PAGINA_ATUAL)
        self.assertTrue(transicao._registra_listagem(self.con, "pagina_atual", mcti.URL_PAGINA_ATUAL, corpo, pub, ocu))
        # o gov.br muda identificadores a cada pedido: HTML diferente, mesma listagem, sem vintage nova
        outro = corpo + b"<!-- outro pedido -->"
        p2, o2 = mcti.planilhas_publicadas(outro, mcti.URL_PAGINA_ATUAL)
        self.assertFalse(transicao._registra_listagem(self.con, "pagina_atual", mcti.URL_PAGINA_ATUAL, outro, p2, o2))
        # a âncora do inventário perde o texto: a listagem muda e vira vintage
        sem_inv = corpo.replace(b">Aqui</a>", b"></a>", 1)
        p3, o3 = mcti.planilhas_publicadas(sem_inv, mcti.URL_PAGINA_ATUAL)
        self.assertEqual(len(p3), 22)
        self.assertTrue(transicao._registra_listagem(self.con, "pagina_atual", mcti.URL_PAGINA_ATUAL, sem_inv, p3, o3))
        n = self.con.execute("SELECT COUNT(*) FROM vintages WHERE dataset=? AND recurso='pagina_atual'",
                             (transicao.DS_MCTI_META,)).fetchone()[0]
        self.assertEqual(n, 2)
        _, planilhas, ocultas, _ = transicao._listagem(self.con, "pagina_atual")
        self.assertEqual(len(planilhas), 22)
        self.assertEqual(len(ocultas), 14)


class FatoresMCTIVigentes(unittest.TestCase):
    def test_inventario_2026_da_pagina_vigente(self):
        """Valores conferidos no XML da planilha Inventario_2026_janago.xlsx (células O99 e J105)."""
        p = mcti.parse_inventario(mcti.le_xlsx(_xlsx("mcti_inventario_2026_janago.xlsx")))
        self.assertEqual(len(p["mensal"]), 248)  # jan/2006 a ago/2026
        self.assertEqual(len(p["anual"]), 20)    # 2006 a 2025: o ano parcial não tem anual
        self.assertNotIn("2026", p["anual"])
        self.assertEqual(p["anual"]["2025"], 0.0461)
        self.assertEqual(p["mensal"]["2026-08"], 0.0471)
        self.assertAlmostEqual(p["mensal"]["2025-11"], 0.0778, places=12)  # gravado 0.07779999999999999
        self.assertEqual(p["anual"]["2021"], 0.1263)  # o site institucional anterior publicou 0,1264
        self.assertEqual(p["anual"]["2007"], 0.0293)
        self.assertEqual(p["problemas"], [])

    def test_margem_2022_corrigida_traz_a_publicacao_anterior(self):
        """Planilha "Margemdeconstruo_2022corrigido.xlsx": o nome fala de margem de
        construção, mas o conteúdo tem as duas margens. Julho/2022 foi publicado antes como
        0,0419 e corrigido para 0,4186 (coluna Q, "Publicação anterior (com erro)")."""
        pl = mcti.le_xlsx(_xlsx("mcti_margem_construcao_2022_recorte.xlsx"))
        self.assertEqual(mcti.tipo_planilha(pl), "despacho")
        p = mcti.parse_despacho(pl)
        self.assertEqual(p["ano"], 2022)
        self.assertEqual(p["bm"], 0.0271)
        self.assertEqual(p["om_mensal"]["2022-07"], 0.4186)
        self.assertEqual(len(p["om_mensal"]), 12)
        self.assertIn({"serie": "margem_operacao_mensal", "periodo": "2022-07", "anterior": 0.0419, "atual": 0.4186}, p["revisoes"])
        self.assertIn({"serie": "margem_construcao", "periodo": "2022", "anterior": 0.027, "atual": 0.0271}, p["revisoes"])

    def test_simples_ajustado_2025_em_planilha(self):
        p = mcti.parse_simples_ajustado_xlsx(mcti.le_xlsx(_xlsx("mcti_simples_ajustado_2025.xlsx")))
        self.assertEqual(len(p["om"]), 20)
        self.assertEqual(p["om"]["2025"], 0.287)
        self.assertEqual(p["om"]["2019"], 0.3896)  # a página HTML do site anterior publicava 0,386
        self.assertEqual(p["energia_mwh"]["2024"], 459811225.0)
        self.assertEqual(p["energia_mwh"]["2025"], 596828023.0)  # base de usinas ampliada em 2025
        self.assertEqual(p["anos_com_nota"], {"2016": "*", "2019": "**"})


class PrecedenciaMCTI(_Ambiente):
    def _grava(self, recurso, arquivo, capturado):
        transicao._grava_mcti(self.con, recurso, URL_ATUAL + recurso.split("_", 1)[1] + ".xlsx", _xlsx(arquivo), "xlsx", "teste",
                              capturado=capturado)

    def test_pagina_vigente_prevalece_mesmo_capturada_antes(self):
        """A precedência é pela origem (página vigente antes do site anterior), não pela ordem
        de captura; a diferença entre as duas publicações fica publicada."""
        self._grava("atual_Inventario_2026_janago", "mcti_inventario_2026_janago.xlsx", "2026-09-30T22:48:14Z")
        self._grava("antigo_Inventario_2021_jan-a-dez", "mcti_inventario_2021.xlsx", "2026-09-30T22:49:00Z")
        b = transicao._bloco_emissoes(self.con)
        anual = {x["ano"]: x["valor"] for x in b["medio_anual"]}
        self.assertEqual(anual[2021], 0.1263)
        self.assertEqual(anual[2025], 0.0461)
        div = {(d["serie"], d["periodo"]): d for d in b["divergencias_entre_publicacoes"]}
        self.assertEqual(div[("medio_anual", "2021")]["valor_site_anterior"], 0.1264)
        self.assertIn(("medio_mensal", "2021-11"), div)
        self.assertEqual(b["conflitos_entre_arquivos"], [])
        # controle de leitura do anual: 2007 fica fora da tolerância de arredondamento (0,000125), 2025 dentro
        cmp_ = {x["ano"]: x for x in b["anual_x_media_mensal"]}
        self.assertFalse(cmp_[2007]["dentro_da_tolerancia"])
        self.assertTrue(cmp_[2025]["dentro_da_tolerancia"])
        self.assertEqual(ev.validar(b["evidencia"]), [])
        self.assertEqual(ev.validar(b["evidencia_mensal"]), [])
        self.assertEqual(b["evidencia"]["valor_exibido"], "0,0461")
        self.assertEqual(b["evidencia"]["reconciliacao"]["resultado"], "aprovado")
        self.assertIn("fora: 2007", b["evidencia"]["reconciliacao"]["descricao"])
        self.assertEqual(b["ultimo_mes"], {"m": "2026-08", "valor": 0.0471, "arquivo": "Inventario_2026_janago.xlsx"})

    def test_arquivos_da_mesma_origem_com_valores_diferentes_viram_conflito(self):
        """Página que listasse o inventário antigo e o novo: vale o capturado por último e o
        conflito fica registrado com os dois valores."""
        self._grava("atual_Inventario_2021_jan-a-dez", "mcti_inventario_2021.xlsx", "2026-09-30T10:00:00Z")
        self._grava("atual_Inventario_2026_janago", "mcti_inventario_2026_janago.xlsx", "2026-09-30T11:00:00Z")
        b = transicao._bloco_emissoes(self.con)
        conf = {(x["serie"], x["periodo"]): x for x in b["conflitos_entre_arquivos"]}
        c2021 = conf[("medio_anual", "2021")]
        self.assertEqual(c2021["recurso_vigente"], "atual_Inventario_2026_janago")
        self.assertEqual({v["valor"] for v in c2021["valores"]}, {0.1264, 0.1263})
        self.assertEqual({x["ano"]: x["valor"] for x in b["medio_anual"]}[2021], 0.1263)
        self.assertEqual(b["divergencias_entre_publicacoes"], [])


# ---------------------------------------------------------------------------
# Integração: importação no silver, revisão entre capturas e gold
# ---------------------------------------------------------------------------

class ImportacaoEGold(_Ambiente):
    def _importa(self, caminho, capturado):
        arq, sha, n = base.salva_bronze_arquivo("aneel", transicao.DS_MMGD, transicao.RECURSO_PARQUET, caminho, "parquet", capturado)
        vid, _ = base.registra_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET, "https://x", capturado, None,
                                       sha, n, "teste", arq)
        return transicao._importa_mmgd(self.con, base.ultima_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET), None)

    def _ibge(self):
        with open(os.path.join(DADOS, "sidra_6579_rr.json"), "rb") as f:
            corpo = f.read()
        transicao._coleta_ibge(self.con, baixar=lambda *a, **k: (corpo, {}))

    def test_gold_da_amostra_e_revisao_quando_unidades_somem(self):
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        self._ibge()
        r1 = self._importa(PARQUET, "2026-09-29T15:00:00Z")
        self.assertEqual(r1["linhas"], 274)
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        self.assertEqual(b["resumo"]["unidades"], 274)
        self.assertEqual(b["data_cadastro"], "2026-09-29")
        self.assertEqual(b["ano_referencia"], 2025)
        self.assertEqual(b["controles"]["codigos_repetidos"], 0)
        self.assertEqual(b["controles"]["datas_sentinela"], 4)
        # 431780 não tem prefixo único no cadastro IBGE carregado (só Roraima): fica inválido, não é adivinhado
        self.assertEqual(b["controles"]["municipio_invalido"], 1)
        # município sem população publicada: razão ausente, não zero
        uber = next(x for x in b["_municipios"] if x["ibge"] == "3170206")
        self.assertIsNone(uber["w_por_habitante"])
        self.assertEqual(uber["unidades"], 30)
        # municípios de RR sem MMGD na amostra: zero real, com população
        rr = [x for x in b["_municipios"] if x["uf"] == "RR"]
        self.assertEqual(len(rr), 15)
        self.assertTrue(all(x["unidades"] == 0 and x["w_por_habitante"] == 0.0 for x in rr))
        self.assertEqual(b["revisoes"]["capturas_comparadas"], 1)
        # evidências no contrato comum: arquivo com sha256, sem o recurso técnico a reconciliação é ressalva
        for chave in ("unidades", "potencia"):
            self.assertEqual(ev.validar(b["evidencias"][chave]), [], chave)
        self.assertEqual(b["evidencias"]["unidades"]["valor_exibido"], "274")
        self.assertEqual(b["evidencias"]["unidades"]["fonte"]["sha256"],
                         base.ultima_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET)["sha256"])
        self.assertEqual(b["evidencias"]["unidades"]["reconciliacao"]["resultado"], "ressalva")
        # segunda captura sem as 20 unidades da CODESAM: zeros explícitos e histórico preservado
        t = pq.read_table(PARQUET)
        sem = t.filter(pc.not_equal(t["NumCNPJDistribuidora"], int(CNPJ_CODESAM)))
        caminho2 = os.path.join(self.tmp.name, "v2.parquet")
        pq.write_table(sem, caminho2)
        r2 = self._importa(caminho2, "2026-10-06T15:00:00Z")
        self.assertEqual(r2["linhas"], 254)
        vig = dict(base.serie_vigente(self.con, transicao.DS_MMGD, "qtd.dist_uf_ano"))
        codesam = {k: v for k, v in vig.items() if k.startswith(CNPJ_CODESAM)}
        self.assertTrue(codesam)
        self.assertTrue(all(v == 0.0 for v in codesam.values()))
        antes = dict(base.como_estava_em(self.con, transicao.DS_MMGD, "qtd.dist_uf_ano", "2026-09-30T00:00:00Z"))
        self.assertEqual(sum(v for k, v in antes.items() if k.startswith(CNPJ_CODESAM)), 20)
        b2, _ = transicao._bloco_mmgd(self.con, date(2026, 10, 7))
        self.assertEqual(b2["resumo"]["unidades"], 254)
        self.assertNotIn(CNPJ_CODESAM, {d["cnpj"] for d in b2["distribuidoras"]})
        self.assertEqual(b2["revisoes"]["capturas_comparadas"], 2)
        self.assertIn("2 capturas comparadas", b2["evidencias"]["unidades"]["revisoes"])
        # a evidência aponta o arquivo que gerou os números (a segunda captura)
        self.assertEqual(b2["evidencias"]["unidades"]["fonte"]["capturado_em"], "2026-10-06T15:00:00Z")

    def test_construir_publica_gold_e_csv_equivalentes(self):
        """Equivalência gold e exportação: o CSV municipal soma o total da gold; blocos sem
        dado (ONS e MCTI) viram pendência declarada, não número."""
        self._ibge()
        self._importa(PARQUET, "2026-09-29T15:00:00Z")
        g = transicao.construir(self.con, {"hoje": date(2026, 9, 30), "con_principal": None})
        self.assertTrue(g["disponivel"])
        self.assertIsNone(g["ons_mmgd"])
        self.assertIsNone(g["emissoes"])
        self.assertEqual(len(g["pendencias"]), 2)
        self.assertNotIn("_municipios", g["mmgd"])
        with open(os.path.join(base.SERIES, "transicao_mmgd_municipio_ano_fonte.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        self.assertEqual(sum(int(x["unidades"]) for x in linhas), g["mmgd"]["resumo"]["unidades"])
        self.assertAlmostEqual(sum(float(x["potencia_kw"]) for x in linhas), g["mmgd"]["resumo"]["potencia_kw"], delta=0.01 * len(linhas))
        json.dumps(g, allow_nan=False)

    def test_validacao_critica_vira_motivo(self):
        """Linhas do arquivo diferentes da soma agregada derrubam a publicação (stub)."""
        self._ibge()
        self._importa(PARQUET, "2026-09-29T15:00:00Z")
        vid = base.ultima_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET)["vintage_id"]
        self.con.execute("UPDATE observacoes SET valor=999 WHERE dataset=? AND serie='controle.linhas' AND vintage_id=?",
                         (transicao.DS_MMGD, vid))
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(b)
        self.assertIn("validação crítica", motivo)


# ---------------------------------------------------------------------------
# Defeitos apontados pela verificação de 30/09/2026 (um teste por defeito)
# ---------------------------------------------------------------------------

class RevisoesDiariasMCTI(unittest.TestCase):
    """Valores diários da publicação anterior, à direita do bloco diário principal.
    Recortes das linhas 1 a 47 (todo o bloco diário) das planilhas da página vigente;
    valores esperados lidos no XML das planilhas originais."""

    def test_2024_le_os_diarios_da_publicacao_anterior(self):
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2024_correcoes_recorte.xlsx")))
        diarias = [r for r in p["revisoes"] if r["serie"] == "margem_operacao_diaria"]
        mensais = [r for r in p["revisoes"] if r["serie"] == "margem_operacao_mensal"]
        self.assertEqual(len(diarias), 43)
        self.assertEqual(len(mensais), 5)
        r = next(x for x in diarias if x["periodo"] == "2024-09-02")  # células X18 (anterior) e K18 (atual)
        self.assertAlmostEqual(r["anterior"], 0.5062, delta=5e-5)
        self.assertAlmostEqual(r["atual"], 0.5068, delta=5e-5)
        self.assertEqual(p["problemas"], [])  # sem rótulo contraditório nesta planilha
        self.assertTrue(all(x["atual"] is not None for x in diarias))

    def test_2020_rotulo_contraditorio_resolvido_pelo_dado_e_registrado(self):
        """P1 diz "Publicação anterior (com erros)" e P14, acima do bloco diário da direita,
        "Publicação atual (com correção)". Trocar os diários principais pelos da direita
        move a média de cada mês no sentido do mensal anterior: o bloco é a publicação
        anterior, e a escolha fica em problemas_de_leitura."""
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2020_correcoes_diario_recorte.xlsx")))
        diarias = {r["periodo"]: r for r in p["revisoes"] if r["serie"] == "margem_operacao_diaria"}
        self.assertEqual(len(diarias), 35)
        self.assertEqual((diarias["2020-12-01"]["anterior"], diarias["2020-12-01"]["atual"]), (0.5409, 0.5472))
        self.assertEqual(p["om_diario"]["2020-12-01"], 0.5472)  # o principal continua sendo o valor vigente
        self.assertEqual(len(p["problemas"]), 1)
        texto = p["problemas"][0]
        for trecho in ("P14", "Publicação atual (com correção)", "lidos como publicação anterior", "dezembro"):
            self.assertIn(trecho, texto)

    def test_2022_bloco_rotulado_atual_que_nao_acompanha_o_mensal_nao_vira_revisao(self):
        """Na de 2022 o bloco da direita tem um único valor (01/07: 0,4186, igual ao mensal
        corrigido de julho) sob "Publicação atual com correção": não é diário anterior."""
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_margem_construcao_2022_recorte.xlsx")))
        self.assertFalse([r for r in p["revisoes"] if r["serie"] == "margem_operacao_diaria"])
        self.assertAlmostEqual(p["om_diario"]["2022-07-01"], 0.41189015010815511, places=12)
        self.assertTrue(any("não lidos como revisão" in x and "P14" in x for x in p["problemas"]))

    def test_2023_dia_inexistente_da_publicacao_anterior_e_descartado(self):
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_margem_construcao_2023_recorte.xlsx")))
        diarias = sorted(r["periodo"] for r in p["revisoes"] if r["serie"] == "margem_operacao_diaria")
        self.assertEqual(diarias, ["2023-05-31", "2023-07-31", "2023-12-31"])
        anteriores = sorted(d["data"] for d in p["descartes"] if "publicação anterior" in d["motivo"])
        self.assertEqual(anteriores, ["2023-04-31", "2023-06-31", "2023-09-31", "2023-11-31"])


class BlocoEmissoesRevisoes(_Ambiente):
    def _grava(self, recurso, arquivo, capturado):
        transicao._grava_mcti(self.con, recurso, URL_ATUAL + recurso.split("_", 1)[1] + ".xlsx", _xlsx(arquivo), "xlsx", "teste",
                              capturado=capturado)

    def test_revisoes_diarias_na_gold_e_natureza_estimada(self):
        self._grava("atual_Inventario_2026_janago", "mcti_inventario_2026_janago.xlsx", "2026-09-30T22:48:14Z")
        self._grava("atual_Despacho_2024_jandezcomcorrees_FE_MC", "mcti_despacho_2024_correcoes_recorte.xlsx", "2026-09-30T22:48:15Z")
        b = transicao._bloco_emissoes(self.con)
        por_serie = Counter(r["serie"] for r in b["revisoes_declaradas_pela_fonte"])
        self.assertEqual(por_serie, {"margem_operacao_diaria": 43, "margem_operacao_mensal": 5})
        self.assertIn("48 revisões", b["evidencia"]["revisoes"])
        self.assertIn("43 na margem de operação diária", b["evidencia"]["revisoes"])
        # fatores do MCTI são estimados pela fonte (emissões calculadas), não medidos
        self.assertEqual(b["proveniencia"]["medio"]["natureza"], "ESTIMADO")
        self.assertEqual(b["proveniencia"]["mdl"]["natureza"], "ESTIMADO")
        self.assertIn("sem alteração", b["proveniencia"]["medio"]["notas_fonte"])

    def test_releitura_refaz_as_anotacoes_de_vintage_lida_por_versao_anterior(self):
        """Vintage gravada antes da leitura dos diários (versão 1: só revisões mensais e sem
        a marca de versão) é relida do bronze: as anotações são refeitas, os valores não."""
        self._grava("atual_Despacho_2024_jandezcomcorrees_FE_MC", "mcti_despacho_2024_correcoes_recorte.xlsx", "2026-09-30T22:48:15Z")
        vid = base.ultima_vintage(self.con, transicao.DS_MCTI, "atual_Despacho_2024_jandezcomcorrees_FE_MC")["vintage_id"]
        regs = base.registros_como_estavam_em(self.con, transicao.DS_MCTI_META)["atual_Despacho_2024_jandezcomcorrees_FE_MC"]
        antigas = [r for r in json.loads(regs["revisoes_declaradas"]) if r["serie"] != "margem_operacao_diaria"]
        self.con.execute("DELETE FROM registros WHERE dataset=? AND vintage_id=?", (transicao.DS_CONTROLE, vid))
        self.con.execute("UPDATE registros SET valor=? WHERE dataset=? AND campo='revisoes_declaradas' AND vintage_id=?",
                         (json.dumps(antigas), transicao.DS_MCTI_META, vid))
        n_obs = self.con.execute("SELECT COUNT(*) FROM observacoes WHERE vintage_id=?", (vid,)).fetchone()[0]
        r = transicao.releitura_mcti(self.con)
        self.assertEqual(r, {"relidas": 1, "com_valor_divergente": []})
        regs = base.registros_como_estavam_em(self.con, transicao.DS_MCTI_META)["atual_Despacho_2024_jandezcomcorrees_FE_MC"]
        self.assertEqual(len(json.loads(regs["revisoes_declaradas"])), 48)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM observacoes WHERE vintage_id=?", (vid,)).fetchone()[0], n_obs)
        self.assertEqual(transicao.releitura_mcti(self.con)["relidas"], 0)  # versão em dia: nada a reler


class DesafioMCTIGuardado(unittest.TestCase):
    def test_amostras_do_desafio_tem_support_id(self):
        """As duas respostas de verificação humana guardadas como evidência do bloqueio."""
        for arquivo, sid in (("mcti_desafio_waf_recorte.html", "11080339514068322584"),
                             ("mcti_desafio_waf_pagina_20261001.html", "11080339521002698785")):
            with open(os.path.join(DADOS, arquivo), "rb") as f:
                self.assertEqual(mcti.desafio_waf(f.read()), sid)


def _csv_gz(nome):
    with gzip.open(os.path.join(DADOS, nome), "rt", encoding="latin-1", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


CNPJ_NEO_PE = "10835932000108"
CNPJ_COELBA = "15139629000194"
CNPJ_EQ_PA = "04895728000180"
CNPJ_EQ_GO = "01543032000104"
CNPJ_ENEL_CE = "07047251000170"


class AreaDistribuidora(unittest.TestCase):
    """Unidades em UF onde a distribuidora (CNPJ) não tem conjunto elétrico. Recortes reais:
    linhas da relação de MMGD de São Caetano de Odivelas (1507102, PA) e Abadia de Goiás
    (5200050, GO) e, para os cinco CNPJs presentes, um conjunto por UF da base de
    continuidade com as linhas do indqual-municipio desses conjuntos. Valores esperados de
    agregação própria (pyarrow group_by) sobre o Parquet oficial completo de 29/09/2026."""

    @classmethod
    def setUpClass(cls):
        cls.area = mmgd.area_distribuidoras(mmgd.conjuntos_limite(_csv_gz("aneel_conjuntos_limite_recorte.csv.gz")),
                                            mmgd.conjuntos_municipio(_csv_gz("aneel_indqual_municipio_recorte.csv.gz")))
        ag = mmgd.agrega(mmgd.linhas_parquet(os.path.join(DADOS, "mmgd_municipios_area_recorte.parquet")))
        cls.dmun = {k: (v[0], v[1]) for k, v in ag.dist_municipio.items()}

    def test_area_pela_base_de_conjuntos(self):
        """UFs com conjunto de cada CNPJ (iguais às da base completa de 01/10/2026)."""
        self.assertEqual({cn: sorted(u) for cn, u in self.area.items()},
                         {CNPJ_NEO_PE: ["BA", "PB", "PE", "PI"], CNPJ_COELBA: ["BA"], CNPJ_EQ_PA: ["PA"],
                          CNPJ_EQ_GO: ["GO"], CNPJ_ENEL_CE: ["CE"]})

    def test_unidades_fora_da_area_por_municipio(self):
        fora = transicao._fora_da_area(self.dmun, self.area)
        q, kw = fora["por_mun"]["1507102"]  # 185 da Neoenergia PE; as 64 da Equatorial PA estão na área
        self.assertEqual(q, 185)
        self.assertAlmostEqual(kw, 1830.21, delta=0.005)
        q, kw = fora["por_mun"]["5200050"]  # COELBA 157 (1.169,92 kW), Neoenergia PE 1 (5), ENEL CE 2 (9)
        self.assertEqual(q, 160)
        self.assertAlmostEqual(kw, 1183.92, delta=0.005)
        self.assertEqual(fora["por_dist"][CNPJ_COELBA]["GO"][0], 157)
        self.assertEqual(sorted(fora["por_dist"][CNPJ_NEO_PE]), ["GO", "PA"])
        self.assertNotIn(CNPJ_EQ_PA, fora["por_dist"])
        self.assertNotIn(CNPJ_EQ_GO, fora["por_dist"])
        self.assertEqual((fora["unidades"], fora["sem_referencia"]), (345, {}))
        # o total do município não muda: as unidades ficam no município publicado
        self.assertEqual(sum(q for (cn, m), (q, _) in self.dmun.items() if m == "1507102"), 249)

    def test_cnpj_sem_conjunto_na_base_nao_e_sinalizado(self):
        dmun = dict(self.dmun)
        dmun[("99999999000199", "1507102")] = (3, 10.0)  # CNPJ sem nenhum conjunto: falta referência, não área
        fora = transicao._fora_da_area(dmun, self.area)
        self.assertEqual(fora["sem_referencia"], {"99999999000199": 3})
        self.assertEqual(fora["por_mun"]["1507102"][0], 185)


class AreaDistribuidoraNaGold(_Ambiente):
    def test_gold_sinaliza_o_municipio_sem_corrigir_e_publica_no_csv(self):
        caminho = os.path.join(DADOS, "mmgd_municipios_area_recorte.parquet")
        arq, sha, n = base.salva_bronze_arquivo("aneel", transicao.DS_MMGD, transicao.RECURSO_PARQUET, caminho, "parquet",
                                                "2026-09-30T22:22:34Z")
        base.registra_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET, "https://x", "2026-09-30T22:22:34Z", None,
                              sha, n, "teste", arq)
        transicao._importa_mmgd(self.con, base.ultima_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET), None)
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        self.assertFalse(b["controles"]["distribuidora_fora_da_uf"]["disponivel"])  # sem os conjuntos: declarado, não zero
        self.assertIsNone(next(x for x in b["_municipios"] if x["ibge"] == "1507102")["unidades_distribuidora_fora_da_uf"])
        for ds, rec, nome in ((transicao.DS_AREA_LIM, transicao.RECURSO_LIM, "aneel_conjuntos_limite_recorte.csv.gz"),
                              (transicao.DS_AREA_MUN, transicao.RECURSO_MUN, "aneel_indqual_municipio_recorte.csv.gz")):
            with open(os.path.join(DADOS, nome), "rb") as f:
                corpo = gzip.decompress(f.read())
            a, sh = base.salva_bronze("aneel", ds, rec, corpo, "csv", "2026-10-01T00:18:12Z")
            base.registra_vintage(self.con, ds, rec, "https://x", "2026-10-01T00:18:12Z", None, sh, len(corpo), "teste", a)
            transicao._processa_area(self.con, ds, base.ultima_vintage(self.con, ds, rec))
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        sc = next(x for x in b["_municipios"] if x["ibge"] == "1507102")
        self.assertEqual((sc["unidades"], sc["unidades_distribuidora_fora_da_uf"], sc["sinal_distribuidora_fora_da_uf"]), (249, 185, True))
        self.assertAlmostEqual(sc["potencia_kw"], 2613.05, delta=0.005)
        ctl = b["controles"]["distribuidora_fora_da_uf"]
        self.assertEqual((ctl["unidades"], ctl["municipios_sinalizados"]), (345, 2))
        neo = next(d for d in b["distribuidoras"] if d["cnpj"] == CNPJ_NEO_PE)
        self.assertEqual((neo["ufs_fora_da_area"], neo["unidades_fora_da_area"]), (["GO", "PA"], 186))
        # sem causa única (verificação de 01/10/2026): o texto diz que algum campo está errado e não afirma o município
        lims = b["proveniencia"]["cadastro"]["limitacoes"]
        self.assertTrue(any("algum campo está errado" in t for t in lims))
        self.assertFalse(any("provável erro de código de município" in t for t in lims))
        self.assertTrue(any("inflada" in t for t in b["proveniencia"]["por_habitante"]["limitacoes"]))
        transicao._escreve_csvs_mmgd(b)
        with open(os.path.join(base.SERIES, "transicao_mmgd_municipios.csv"), encoding="utf-8") as f:
            linha = next(x for x in csv.DictReader(f, delimiter=";") if x["codigo_ibge"] == "1507102")
        self.assertEqual((linha["unidades"], linha["unidades_distribuidora_fora_da_uf"]), ("249", "185"))
        with open(os.path.join(base.SERIES, "transicao_mmgd_distribuidoras.csv"), encoding="utf-8") as f:
            ufs = {(x["cnpj"], x["uf"]): x["uf_na_area_da_distribuidora"] for x in csv.DictReader(f, delimiter=";")}
        self.assertEqual((ufs[(CNPJ_COELBA, "GO")], ufs[(CNPJ_EQ_GO, "GO")]), ("nao", "sim"))


class EntidadeGrande(_Ambiente):
    """CEMIG-D e SP no recorte do agregado (silver vigente da vintage de 29/09/2026: linhas
    da CEMIG-D em dist_uf_ano e de SP em uf_mes_fonte). Valores esperados conferidos por
    caminho independente: soma Decimal sobre o CSV oficial completo (4.656.839 linhas) e
    filtro pyarrow sobre o Parquet oficial."""

    def setUp(self):
        super().setUp()
        with gzip.open(os.path.join(DADOS, "mmgd_agregados_grandes_20260929.json.gz"), "rt", encoding="utf-8") as f:
            self.recorte = json.load(f)
        vid, _ = base.registra_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET, "https://x",
                                       self.recorte["capturado_em"], None, self.recorte["sha256_arquivo"], 0, "teste", None)
        base.grava_observacoes(self.con, transicao.DS_MMGD, vid,
                               [(s, r, v) for s, linhas in self.recorte["series"].items() for r, v in linhas])

    def test_cemig_d(self):
        dist = transicao._par(self.con, "dist_uf_ano", 3)
        self.assertAlmostEqual(sum(v[1] for v in dist.values()), 5840077.77, delta=0.005)
        (d,) = transicao._tabela_distribuidoras(dist, {}, {}, 2025, {}, None)
        self.assertEqual(d["cnpj"], "06981180000116")
        self.assertEqual(d["unidades"], 426729)
        self.assertEqual(d["potencia_mw"], 5840.078)
        self.assertIsNone(d["unidades_fora_da_area"])  # sem referência de área: ausente, não zero

    def test_sao_paulo(self):
        ufm = transicao._par(self.con, "uf_mes_fonte", 3)
        self.assertAlmostEqual(sum(v[1] for v in ufm.values()), 7610299.55, delta=0.005)
        ufs, uf_anual = transicao._tabela_ufs(ufm, {}, {}, 2025, 2026, 7610299.55)
        self.assertEqual([(u["uf"], u["unidades"], u["potencia_mw"]) for u in ufs], [("SP", 787146, 7610.3)])
        anos = [x["ano"] for x in uf_anual]
        self.assertEqual(anos, list(range(anos[0], 2027)))  # sem buraco até o ano do cadastro
        self.assertEqual(sum(x["unidades"] or 0 for x in uf_anual) + sum(
            v[0] for (_, mes, _), v in ufm.items() if mes == mmgd.SEM_DATA), 787146)


def _con_balanco():
    """Silver principal em memória com o recorte do arquivo do ONS no S3
    (BALANCO_ENERGIA_SUBSISTEMA_2023.csv, linhas do SIN de 15/04 a 06/05/2023)."""
    con = base.conecta(":memory:")
    vid, _ = base.registra_vintage(con, transicao.DS_BAL, "BALANCO_ENERGIA_SUBSISTEMA_2023.csv", "https://x",
                                   "2026-09-30T21:00:00Z", None, "0" * 64, 0, "teste", None)
    obs = []
    with gzip.open(os.path.join(DADOS, "ons_balanco_sin_20230415_20230506.csv.gz"), "rt", encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            ref = r["din_instante"][:16].replace(" ", "T")
            obs += [("solar.SIN", ref, float(r["val_gersolar"])), ("carga.SIN", ref, float(r["val_carga"]))]
    base.grava_observacoes(con, transicao.DS_BAL, vid, obs)
    return con


def _series_ons_mmgd():
    with open(os.path.join(DADOS, "ons_mmgd_diario_20230415_20230506.json"), encoding="utf-8") as f:
        dados = json.load(f)["series"]
    series = {}
    for sm in ons.AREAS:
        for s in ("mmgd_mwh", "horas_mmgd"):
            series[(s, sm)] = dict(dados[f"{s}.{sm}"])
    return series


class ConferenciaQuebra2023(unittest.TestCase):
    """Achado A11 com o recorte real do balanço (S3 do ONS) e da MMGD da API. Valores
    esperados: médias de 24 horas com Decimal sobre o CSV do S3 (solar 1.991,3 e 4.376,6;
    carga 68.169 em 15/04 e 68.158 em 29/04) e MMGD da API (3.528,0 em 29/04)."""

    def test_degrau_na_solar_sem_degrau_na_carga_e_sem_causa_inventada(self):
        con_p = _con_balanco()
        q = transicao._conferencia_quebra(None, con_p, _series_ons_mmgd())
        dia = {x["d"]: x for x in q["dias"]}
        self.assertEqual((dia["2023-04-28"]["solar_balanco_sin_mwmed"], dia["2023-04-29"]["solar_balanco_sin_mwmed"]), (1991, 4377))
        self.assertEqual(q["degrau_solar_mwmed"], 2386)
        self.assertEqual(q["mmgd_ons_no_dia_mwmed"], 3528)
        self.assertEqual(q["diferenca_degrau_solar_e_mmgd_mwmed"], 1142)
        par = {p["d"]: p for p in q["pares_mesmo_dia_da_semana"]}
        self.assertEqual((par["2023-04-29"]["carga_comparacao"], par["2023-04-29"]["carga_d"]), (68169, 68158))
        self.assertEqual((par["2023-04-30"]["carga_comparacao"], par["2023-04-30"]["carga_d"]), (61866, 62116))
        self.assertFalse(par["2023-05-01"]["entra_na_mediana"])  # Dia do Trabalho
        self.assertFalse(par["2023-05-05"]["entra_na_mediana"])  # comparado a 21/04, Tiradentes
        self.assertEqual(q["pares_na_mediana"], 6)
        self.assertEqual((q["mediana_diferenca_solar_mwmed"], q["mediana_diferenca_carga_mwmed"]), (2840, 559))
        self.assertIs(q["degrau_na_carga"], False)
        self.assertIn("não aparece degrau", q["leitura"])
        self.assertIn("não publica explicação", q["leitura"])
        for proibido in ("processo", "meteorol", "porque"):
            self.assertNotIn(proibido, q["leitura"].lower())

    def test_sem_balanco_nao_ha_conclusao(self):
        q = transicao._conferencia_quebra(None, None, _series_ons_mmgd())
        self.assertIsNone(q["degrau_solar_mwmed"])
        self.assertIsNone(q["degrau_na_carga"])
        self.assertIn("não foi feita", q["leitura"])


class EstoqueEZeros(_Ambiente):
    """Identidade de estoque, zeros explícitos nas séries e participações pequenas."""
    _importa = ImportacaoEGold._importa
    _ibge = ImportacaoEGold._ibge

    def test_identidade_de_estoque_e_series_sem_buraco(self):
        self._ibge()
        self._importa(PARQUET, "2026-09-29T15:00:00Z")
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        ie = b["controles"]["identidade_estoque"]
        # a amostra tem 274 unidades, 4 com data sentinela (1900)
        self.assertEqual((ie["unidades_total"], ie["unidades_sem_data"]), (274, 4))
        self.assertEqual((ie["unidades_com_data_serie_anual"], ie["unidades_com_data_serie_mensal"]), (270, 270))
        self.assertEqual((ie["diferenca_unidades"], ie["resultado"]), (0, "aprovada"))
        self.assertEqual(b["anual"][-1]["acumulado_unidades"] + b["resumo"]["unidades_sem_data"], b["resumo"]["unidades"])
        anos = [a["ano"] for a in b["anual"]]
        self.assertEqual(anos, list(range(anos[0], 2027)))
        meses = [m["m"] for m in b["mensal"]]
        self.assertEqual(meses, list(transicao._meses(meses[0], "2026-09")))
        zeros = [m for m in b["mensal"] if m["unidades"] == 0]
        self.assertTrue(zeros)  # a amostra tem meses sem conexão: zero explícito, estoque repetido
        i = meses.index(zeros[0]["m"])
        self.assertEqual(b["mensal"][i]["acumulado_unidades"], b["mensal"][i - 1]["acumulado_unidades"])

    def test_estoque_que_nao_fecha_derruba_a_publicacao(self):
        self._ibge()
        self._importa(PARQUET, "2026-09-29T15:00:00Z")
        vid = base.ultima_vintage(self.con, transicao.DS_MMGD, transicao.RECURSO_PARQUET)["vintage_id"]
        ref = self.con.execute("SELECT ref FROM observacoes WHERE dataset=? AND serie='kw.uf_mes_fonte' AND vintage_id=? "
                               "AND ref NOT LIKE '%sem_data%' LIMIT 1", (transicao.DS_MMGD, vid)).fetchone()[0]
        self.con.execute("UPDATE observacoes SET valor=valor+10 WHERE dataset=? AND serie='kw.uf_mes_fonte' AND ref=? AND vintage_id=?",
                         (transicao.DS_MMGD, ref, vid))
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(b)
        self.assertIn("estoque", motivo)

    def test_participacao_pequena_nao_vira_zero(self):
        """Contagens por classe do cadastro de 29/09/2026: iluminação pública 232, consumo
        próprio 45, serviço público 410 e residencial 3.726.947 unidades em 4.656.839."""
        self.assertEqual(transicao._pct(232, 4656839), 0.005)
        self.assertEqual(transicao._pct(45, 4656839), 0.00097)
        self.assertEqual(transicao._pct(410, 4656839), 0.0088)
        self.assertEqual(transicao._pct(3726947, 4656839), 80.03)
        self.assertEqual(transicao._pct(0, 4656839), 0.0)
        self.assertIsNone(transicao._pct(1, 0))


class PublicacaoAtual(unittest.TestCase):
    """Coerência da publicação vigente (gold e CSV em public/energia): pula se a gold não
    estiver disponível. Os valores de 29/09/2026 só são conferidos para esse cadastro."""

    @classmethod
    def setUpClass(cls):
        raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cls.series = os.path.join(raiz, "public", "energia", "series")
        caminho = os.path.join(raiz, "public", "energia", "gold", "transicao.json")
        cls.g = None
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                cls.g = json.load(f)

    def setUp(self):
        if not (self.g and self.g.get("disponivel")):
            self.skipTest("gold de transição indisponível")

    def test_evidencia_ons_com_a_mesma_precisao_do_kpi(self):
        o = self.g["ons_mmgd"]
        self.assertEqual(o["evidencia"]["valor_exibido"], transicao._br(o["ultimo_mes_completo"]["SIN"], 1))
        self.assertAlmostEqual(o["evidencia"]["valor_calculo"], o["ultimo_mes_completo"]["SIN"], delta=0.05)

    def test_natureza_dos_fatores_do_mcti(self):
        from pipeline.energia.metricas import transicao as mt
        e = self.g["emissoes"]
        self.assertEqual((e["proveniencia"]["medio"]["natureza"], e["proveniencia"]["mdl"]["natureza"]), ("ESTIMADO", "ESTIMADO"))
        mcti_m = [m for m in mt.METRICAS if m["id"].startswith("mcti_")]
        self.assertEqual(len(mcti_m), 3)
        self.assertTrue(all(m["natureza_fonte"] == "ESTIMADO" for m in mcti_m))
        self.assertEqual(self.g["ons_mmgd"]["proveniencia"]["estimativa"]["natureza"], "ESTIMADO")  # mesmo critério

    def test_texto_da_quebra_sem_causa_e_identidade_publicada(self):
        q = self.g["ons_mmgd"]["conferencia_quebra_2023"]
        self.assertNotIn("processos diferentes", q["leitura"])
        self.assertIn("não publica explicação", q["leitura"])
        self.assertEqual(self.g["mmgd"]["controles"]["identidade_estoque"]["resultado"], "aprovada")

    def test_valores_do_cadastro_de_29_09_2026(self):
        if self.g["mmgd"]["data_cadastro"] != "2026-09-29":
            self.skipTest("valores conferidos para o cadastro de 29/09/2026")
        r = self.g["mmgd"]["resumo"]
        self.assertEqual((r["unidades"], r["potencia_kw"], r["ultima_data_conexao"]), (4656839, 53965592.59, "2026-08-31"))
        with open(os.path.join(self.series, "transicao_mmgd_municipios.csv"), encoding="utf-8") as f:
            sc = next(x for x in csv.DictReader(f, delimiter=";") if x["codigo_ibge"] == "1507102")
        self.assertEqual((sc["unidades"], sc["potencia_kw"], sc["unidades_distribuidora_fora_da_uf"],
                          sc["potencia_kw_distribuidora_fora_da_uf"]), ("249", "2613.05", "185", "1830.21"))
        cemig = next(d for d in self.g["mmgd"]["distribuidoras"] if d["cnpj"] == "06981180000116")
        self.assertEqual((cemig["unidades"], cemig["potencia_mw"]), (426729, 5840.078))
        sp = next(u for u in self.g["mmgd"]["ufs"] if u["uf"] == "SP")
        self.assertEqual((sp["unidades"], sp["potencia_mw"]), (787146, 7610.3))

    def test_correcoes_da_verificacao_de_01_10_2026(self):
        """Classes fora da área (o verificador, com as faixas de CEP por UF, achou 1.900 com CEP
        na área da distribuidora e 2.507 com CEP na UF do município, das quais 2 têm código ou
        UF publicada divergente), cobertura das séries, geração compartilhada e domínio do ONS."""
        if self.g["mmgd"]["data_cadastro"] != "2026-09-29":
            self.skipTest("valores conferidos para o cadastro de 29/09/2026")
        m = self.g["mmgd"]
        cls = {x["classe"]: x for x in m["controles"]["distribuidora_fora_da_uf"]["classes_pelo_cep"]["classes"]}
        self.assertEqual((cls["provavel_municipio_errado"]["unidades"], cls["provavel_distribuidora_errada"]["unidades"],
                          cls["indeterminada"]["unidades"]), (1900, 2505, 92))
        mot = {x["motivo"]: x["unidades"] for x in m["controles"]["distribuidora_fora_da_uf"]["classes_pelo_cep"]["indeterminadas_por_motivo"]}
        self.assertEqual((mot["sinais_divergentes"], mot["cep_de_preenchimento"]), (2, 74))
        eqpi = next(d for d in m["distribuidoras"] if d["cnpj"] == CNPJ_EQ_PI)
        self.assertEqual(eqpi["classes_fora_da_area"]["provavel_distribuidora_errada"]["unidades"], 1310)
        self.assertIn("inflam o total desta", eqpi["aviso_total"])
        coelba = next(d for d in m["distribuidoras"] if d["cnpj"] == CNPJ_COELBA)
        self.assertEqual(coelba["classes_fora_da_area"]["provavel_municipio_errado"]["unidades"], 801)
        anual = {a["ano"]: a for a in m["anual"]}
        self.assertEqual([anual[a]["unidades"] for a in range(2004, 2010)], [1, None, None, None, None, 23])
        self.assertEqual(sum(1 for x in m["mensal"] if x["unidades"] is None), 53)
        self.assertTrue(any("geração compartilhada (22.670 unidades, 3.324,1 MW)" in t for t in m["proveniencia"]["cadastro"]["limitacoes"]))
        o = self.g["ons_mmgd"]
        self.assertEqual(o["validacoes"]["participacao_dominio"]["resultado"], "aprovada")
        self.assertNotIn("meteorol", " ".join(o["proveniencia"]["estimativa"]["limitacoes"]))
        with open(os.path.join(self.series, "transicao_mmgd_municipios.csv"), encoding="utf-8") as f:
            mc = next(x for x in csv.DictReader(f, delimiter=";") if x["codigo_ibge"] == MACEIO)
        # Maceió no cadastro inteiro: 252 da Equatorial PI, 20 da Equatorial PA, 5 da Equatorial MA e 1 da 05965546000109,
        # todas com CEP 57xxx, código GD.AL e SigUF AL; 1 da Equatorial PI com CEP do Piauí
        self.assertEqual((mc["unidades_provavel_distribuidora_errada"], mc["unidades_provavel_municipio_errado"]), ("278", "1"))

# ---------------------------------------------------------------------------
# Defeitos apontados pela verificação de 01/10/2026 (um teste ou mais por defeito)
# ---------------------------------------------------------------------------

CNPJ_EQ_PI = "06840748000189"
CNPJ_EQ_AL = "12272084000100"
MACEIO = "2704302"


def _importa_recorte(con, caminho, capturado="2026-09-30T22:22:34Z"):
    arq, sha, n = base.salva_bronze_arquivo("aneel", transicao.DS_MMGD, transicao.RECURSO_PARQUET, caminho, "parquet", capturado)
    base.registra_vintage(con, transicao.DS_MMGD, transicao.RECURSO_PARQUET, "https://x", capturado, None, sha, n, "teste", arq)
    return transicao._importa_mmgd(con, base.ultima_vintage(con, transicao.DS_MMGD, transicao.RECURSO_PARQUET), None)


def _importa_conjuntos(con, limite, municipio):
    for ds, rec, nome in ((transicao.DS_AREA_LIM, transicao.RECURSO_LIM, limite), (transicao.DS_AREA_MUN, transicao.RECURSO_MUN, municipio)):
        with open(os.path.join(DADOS, nome), "rb") as f:
            corpo = gzip.decompress(f.read())
        a, sh = base.salva_bronze("aneel", ds, rec, corpo, "csv", "2026-10-01T00:18:12Z")
        base.registra_vintage(con, ds, rec, "https://x", "2026-10-01T00:18:12Z", None, sh, len(corpo), "teste", a)
        transicao._processa_area(con, ds, base.ultima_vintage(con, ds, rec))


class ClassesForaDaArea(unittest.TestCase):
    """Defeito (médio, P063): as 4.497 unidades fora da área recebiam uma causa única
    (código de município errado). Recorte real: as 253 unidades da Equatorial PI (CNPJ
    06840748000189, área só no PI) cadastradas em Maceió (2704302), com as unidades não
    sinalizadas do cadastro que têm os mesmos prefixos de CEP (até 2 por prefixo; referência
    da UF do CEP) e um conjunto elétrico por UF de cada CNPJ. CEP reduzido aos 5 dígitos que
    a ANEEL publica sem tarja. Valores esperados por soma Decimal sobre o Parquet oficial
    completo de 29/09/2026 (sha256 8d53e3da…), agrupando pelos 2 primeiros dígitos do CEP,
    pela UF do código e por SigUF: 252 unidades com CEP 57xxx, código GD.AL e SigUF AL
    (2.880,97 kW) e 1 com CEP 64xxx, do Piauí (6,0 kW). O verificador chegou às mesmas 253
    e 252 por script próprio."""

    @classmethod
    def setUpClass(cls):
        cls.area = mmgd.area_distribuidoras(mmgd.conjuntos_limite(_csv_gz("aneel_conjuntos_limite_maceio_recorte.csv.gz")),
                                            mmgd.conjuntos_municipio(_csv_gz("aneel_indqual_municipio_maceio_recorte.csv.gz")))
        ag = mmgd.agrega(mmgd.linhas_parquet(os.path.join(DADOS, "mmgd_maceio_eqpi_recorte.parquet")))
        cls.dmc = {k: tuple(v) for k, v in ag.dist_mun_cep.items()}
        cls.dmun = {k: tuple(v) for k, v in ag.dist_municipio.items()}

    def test_classes_da_equatorial_pi_em_maceio(self):
        self.assertEqual(sorted(self.area[CNPJ_EQ_PI]), ["PI"])
        fora = transicao._fora_da_area(self.dmun, self.area)
        self.assertEqual(fora["por_mun"][MACEIO][0], 253)
        cls = transicao._classes_fora_da_area(self.dmc, self.area)
        self.assertEqual(cls["unidades"], 253)
        b = cls["classes"]["provavel_distribuidora_errada"]
        a = cls["classes"]["provavel_municipio_errado"]
        self.assertEqual((b[0], a[0], cls["classes"]["indeterminada"][0]), (252, 1, 0))
        self.assertAlmostEqual(b[1], 2880.97, delta=0.005)
        self.assertAlmostEqual(a[1], 6.0, delta=0.005)
        self.assertEqual(cls["por_dist"][CNPJ_EQ_PI]["ufs_provavel_distribuidora_errada"], {"AL"})
        self.assertEqual(cls["por_dist"][CNPJ_EQ_PI]["ufs_provavel_municipio_errado"], {"AL"})

    def test_sinalizadas_nao_confirmam_o_proprio_municipio(self):
        """Sem as unidades não sinalizadas (a referência), o CEP das 253 não tem UF de
        referência: ficam indeterminadas, e não 'na UF do município' por se confirmarem."""
        so_eqpi = {k: v for k, v in self.dmc.items() if k[0] == CNPJ_EQ_PI and k[1] == MACEIO}
        cls = transicao._classes_fora_da_area(so_eqpi, self.area)
        self.assertEqual(cls["classes"]["provavel_distribuidora_errada"][0], 0)
        self.assertEqual(cls["motivos"]["cep_sem_referencia"][0], 253)

    def test_cep_de_preenchimento_e_sinais_divergentes(self):
        """CEP 77777: 2.644 unidades do DF no cadastro de 29/09/2026 (fora da faixa do DF);
        prefixo com os cinco dígitos iguais não localiza a unidade."""
        ref5, ref3 = {"57035": "AL"}, {"570": "AL"}
        self.assertEqual(mmgd.classe_fora_da_area(CNPJ_EQ_PI, MACEIO, "77777", "AL", "AL", self.area, ref5, ref3)[:2],
                         ("indeterminada", "cep_de_preenchimento"))
        self.assertEqual(mmgd.classe_fora_da_area(CNPJ_EQ_PI, MACEIO, "-", "AL", "AL", self.area, ref5, ref3)[:2],
                         ("indeterminada", "sem_cep"))
        # CEP na UF do município, mas a UF publicada diverge: não basta para a segunda classe
        self.assertEqual(mmgd.classe_fora_da_area(CNPJ_EQ_PI, MACEIO, "57035", "AL", "PI", self.area, ref5, ref3)[:2],
                         ("indeterminada", "sinais_divergentes"))
        self.assertEqual(mmgd.classe_fora_da_area(CNPJ_EQ_PI, MACEIO, "57035", "AL", "AL", self.area, ref5, ref3)[0],
                         "provavel_distribuidora_errada")
        # prefixo de 5 dígitos ambíguo usa o de 3 dígitos
        self.assertEqual(mmgd.classe_fora_da_area(CNPJ_EQ_PI, MACEIO, "57099", "AL", "AL", self.area, {"57099": None}, ref3)[0],
                         "provavel_distribuidora_errada")
        self.assertTrue(mmgd.cep_de_preenchimento("00000"))
        self.assertFalse(mmgd.cep_de_preenchimento("57035"))
        self.assertEqual((mmgd.cep5("69919***"), mmgd.cep5("57035-150"), mmgd.cep5(None), mmgd.cep5("12")), ("69919", "57035", None, None))
        self.assertEqual((mmgd.uf_do_codigo("GD.AL.001.430.059"), mmgd.uf_do_codigo("X")), ("AL", None))


class ClassesForaDaAreaNaGold(_Ambiente):
    def test_gold_publica_as_classes_sem_causa_unica(self):
        _importa_recorte(self.con, os.path.join(DADOS, "mmgd_maceio_eqpi_recorte.parquet"))
        _importa_conjuntos(self.con, "aneel_conjuntos_limite_maceio_recorte.csv.gz", "aneel_indqual_municipio_maceio_recorte.csv.gz")
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 10, 1))
        self.assertIsNone(motivo)
        mc = next(x for x in b["_municipios"] if x["ibge"] == MACEIO)
        self.assertEqual((mc["unidades_distribuidora_fora_da_uf"], mc["unidades_provavel_distribuidora_errada"],
                          mc["unidades_provavel_municipio_errado"]), (253, 252, 1))
        self.assertAlmostEqual(mc["potencia_kw_provavel_distribuidora_errada"], 2880.97, delta=0.005)
        eq = next(d for d in b["distribuidoras"] if d["cnpj"] == CNPJ_EQ_PI)
        self.assertEqual(eq["classes_fora_da_area"]["provavel_distribuidora_errada"]["unidades"], 252)
        self.assertIn("inflam o total desta", eq["aviso_total"])
        self.assertIsNone(next(d for d in b["distribuidoras"] if d["cnpj"] == CNPJ_EQ_AL)["aviso_total"])
        ctl = b["controles"]["distribuidora_fora_da_uf"]["classes_pelo_cep"]
        self.assertTrue(ctl["disponivel"])
        self.assertEqual({x["classe"]: x["unidades"] for x in ctl["classes"]},
                         {"provavel_municipio_errado": 1, "provavel_distribuidora_errada": 252, "indeterminada": 0})
        lims = b["proveniencia"]["cadastro"]["limitacoes"]
        self.assertFalse(any("provável erro de código de município" in t for t in lims))
        self.assertTrue(any("provável CNPJ de distribuidora errado" in t for t in lims))
        hab = b["proveniencia"]["por_habitante"]["limitacoes"]
        self.assertTrue(any("não inflam a razão municipal" in t for t in hab))
        # a orientação de refazer a razão só aparece junto da classe de provável município errado
        refazer = [t for t in hab if "refazer" in t]
        self.assertEqual(len(refazer), 1)
        self.assertIn("classe de provável município errado", refazer[0])
        # CSV municipal com as classes; a orientação de refazer o W/hab vale só para a primeira
        transicao._escreve_csvs_mmgd(b)
        with open(os.path.join(base.SERIES, "transicao_mmgd_municipios.csv"), encoding="utf-8") as f:
            linha = next(x for x in csv.DictReader(f, delimiter=";") if x["codigo_ibge"] == MACEIO)
        self.assertEqual((linha["unidades_provavel_municipio_errado"], linha["unidades_provavel_distribuidora_errada"]), ("1", "252"))
        desc = transicao.REGISTRO["arquivos"]["/energia/series/transicao_mmgd_municipios.csv"]
        self.assertIn("são as únicas a descontar para refazer o W/hab", desc)
        self.assertNotIn("provável código de município errado na origem", desc)


class ColetaONSDataDeBrasilia(_Ambiente):
    """Defeito (baixo, P063): a coleta usava a data UTC. Às 00:18:21Z de 01/10/2026 (21:18
    de 30/09 em Brasília) pediu outubro inteiro e gravou quatro vintages vazias ("[ ]")."""

    def test_captura_as_00h18_utc_nao_pede_o_mes_seguinte(self):
        pedidos = []

        def baixar(url, timeout=None, **_):
            pedidos.append(url)
            return b"[ ]", {}
        agora = datetime(2026, 10, 1, 0, 18, 21, tzinfo=timezone.utc)
        st = transicao._coleta_ons(self.con, None, baixar=baixar, pausa=0, agora=agora)
        self.assertTrue(st["ok"])
        self.assertFalse([u for u in pedidos if "2026-10-01" in u])
        ultimo = [u for u in pedidos if "dat_inicio=2026-09-01" in u]
        self.assertEqual(len(ultimo), 4)
        self.assertTrue(all("dat_fim=2026-09-30" in u for u in ultimo))
        self.assertEqual(len(pedidos), 4 * len(list(transicao._meses(ons.PRIMEIRO_MES, "2026-09"))))
        # o lote de 20 h (meses recentes) é jul, ago e set: uma segunda coleta 1 h depois só pula
        pedidos.clear()
        transicao._coleta_ons(self.con, None, baixar=baixar, pausa=0, agora=datetime(2026, 10, 1, 1, 18, tzinfo=timezone.utc))
        self.assertEqual(pedidos, [])

    def test_coletar_e_construir_usam_a_data_de_brasilia(self):
        import inspect
        for f in (transicao.coletar, transicao.construir):
            fonte = inspect.getsource(f)
            self.assertIn("c.hoje_brasilia()", fonte)
            self.assertNotIn("agora_date", fonte)


def _obs_ons_dia(corpo, dia_novo=None, fator_mmgd=None, area=None):
    regs = ons.parse(corpo)
    if dia_novo or fator_mmgd:
        regs = [dict(r) for r in regs]
        for r in regs:
            if dia_novo:
                r["dat_referencia"] = dia_novo
                r["din_referenciautc"] = dia_novo + r["din_referenciautc"][10:]
            if fator_mmgd and (area is None or r["cod_areacarga"] == area):
                r["val_cargammgd"] = r["val_cargaglobal"] * fator_mmgd
    return list(ons.observacoes(ons.agrega_diario(regs)))


class DominioParticipacaoONS(_Ambiente):
    """Defeito (baixo, P063): a validação "participação entre 0 e 100%" estava declarada na
    métrica e não era executada. Casos de robustez derivados das respostas reais da API de
    01/09/2026 (a MMGD de um dia trocada por um múltiplo da carga global do mesmo intervalo)."""

    def _grava(self, linhas_por_area):
        for area, obs in linhas_por_area.items():
            recurso = f"carga_verificada_{area}_2026-09"
            vid, _ = base.registra_vintage(self.con, transicao.DS_ONS, recurso, "https://x", "2026-09-30T00:00:00Z", None,
                                           "0" * 63 + area[0].lower().replace("s", "1").replace("n", "2"), 0, "teste", None)
            base.grava_observacoes(self.con, transicao.DS_ONS, vid, obs)

    def test_mes_fora_do_dominio_derruba_a_publicacao(self):
        self._grava({a: _obs_ons_dia(_ons(a, "2026-09-01"), fator_mmgd=1.2 if a == "NE" else None) for a in ons.AREAS.values()})
        with self.assertRaises(transicao.ValidacaoCritica) as ctx:
            transicao._bloco_ons(self.con, None, {})
        self.assertIn("fora de 0 a 100%", str(ctx.exception))
        self.assertFalse(os.path.exists(os.path.join(base.SERIES, "transicao_ons_mmgd_mensal.csv")))  # nada escrito

    def test_dia_fora_do_dominio_vira_ressalva(self):
        linhas = {}
        for a in ons.AREAS.values():
            corpo = _ons(a, "2026-09-01")
            linhas[a] = _obs_ons_dia(corpo) + _obs_ons_dia(corpo, dia_novo="2026-09-02", fator_mmgd=1.01 if a == "S" else None)
        self._grava(linhas)
        b = transicao._bloco_ons(self.con, None, {})
        v = b["validacoes"]
        self.assertEqual((v["participacao_dominio"]["resultado"], v["dias_fora_do_dominio"]["dias"]), ("aprovada", 1))
        self.assertEqual(v["dias_fora_do_dominio"]["exemplos"][0]["d"], "2026-09-02")
        self.assertTrue(any("Ressalva de domínio" in t for t in b["proveniencia"]["estimativa"]["limitacoes"]))
        self.assertGreater(v["participacao_dominio"]["meses_verificados"], 0)

    def test_construir_vira_stub_com_o_motivo(self):
        self._grava({a: _obs_ons_dia(_ons(a, "2026-09-01"), fator_mmgd=1.2 if a == "NE" else None) for a in ons.AREAS.values()})
        _importa_recorte(self.con, PARQUET)
        g = transicao.construir(self.con, {"hoje": date(2026, 10, 1), "con_principal": None})
        self.assertFalse(g["disponivel"])
        self.assertIn("participação", g["motivo"])


class PotenciaAusenteNaGold(_Ambiente):
    """Defeito (baixo, P063): potência ausente virava 0,0 kW no agregado. Robustez derivada da
    amostra real: as unidades de Uberlândia (3170206) com a potência removida."""

    def test_municipio_sem_potencia_publica_nulo_e_a_contagem(self):
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        t = pq.read_table(PARQUET)
        uber = pc.equal(t["CodMunicipioIbge"], 3170206)
        n_uber = int(pc.sum(pc.cast(uber, "int64")).as_py())
        kw = pc.if_else(uber, pa_null_double(), t["MdaPotenciaInstaladaKW"])
        caminho = os.path.join(self.tmp.name, "sem_kw.parquet")
        pq.write_table(t.set_column(t.schema.get_field_index("MdaPotenciaInstaladaKW"), "MdaPotenciaInstaladaKW", kw), caminho)
        _importa_recorte(self.con, caminho)
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        self.assertEqual(b["controles"]["potencia_ausente"], n_uber)
        self.assertEqual(b["resumo"]["unidades_sem_potencia"], n_uber)
        x = next(m for m in b["_municipios"] if m["ibge"] == "3170206")
        self.assertEqual((x["unidades"], x["unidades_sem_potencia"], x["potencia_kw"]), (n_uber, n_uber, None))
        self.assertNotIn("3170206", [m["ibge"] for m in b["municipios_destaque"]["maior_potencia"]])
        mg = next(u for u in b["ufs"] if u["uf"] == "MG")
        self.assertEqual(mg["unidades_sem_potencia"], n_uber)
        self.assertIsNotNone(mg["potencia_mw"])  # parcial, rotulada pela contagem
        self.assertTrue(any("sem potência informada" in t for t in b["proveniencia"]["cadastro"]["limitacoes"]))
        transicao._escreve_csvs_mmgd(b)
        with open(os.path.join(base.SERIES, "transicao_mmgd_municipio_ano_fonte.csv"), encoding="utf-8") as f:
            linhas = [r for r in csv.DictReader(f, delimiter=";") if r["codigo_ibge"] == "3170206"]
        self.assertTrue(linhas)
        self.assertTrue(all(r["potencia_kw"] == "" and r["unidades_sem_potencia"] == r["unidades"] for r in linhas))
        # nova captura com a potência de volta: a contagem de unidades sem potência vira zero explícito
        _importa_recorte(self.con, PARQUET, "2026-10-06T15:00:00Z")
        b2, _ = transicao._bloco_mmgd(self.con, date(2026, 10, 7))
        self.assertEqual(b2["resumo"]["unidades_sem_potencia"], 0)
        self.assertIsNotNone(next(m for m in b2["_municipios"] if m["ibge"] == "3170206")["potencia_kw"])


def pa_null_double():
    import pyarrow as pa
    return pa.scalar(None, type=pa.float64())


class CoberturaDeclaradaNasSeries(_Ambiente):
    """Defeito (baixo, P063): 2005 a 2008 e 53 meses de jul/2004 a nov/2008 saíam como zero
    real, fora da cobertura declarada (a partir de dez/2008). Recorte real: as 5 unidades do
    cadastro de 29/09/2026 com conexão antes de jul/2009 (CERCI em 26/06/2004; ERO, ELETROCAR
    e CERVAM em junho de 2009)."""

    def test_antes_de_dez_2008_nulo_rotulado_e_registro_de_2004_mantido(self):
        _importa_recorte(self.con, os.path.join(DADOS, "mmgd_inicio_cobertura_recorte.parquet"))
        b, motivo = transicao._bloco_mmgd(self.con, date(2026, 9, 30))
        self.assertIsNone(motivo)
        anual = {a["ano"]: a for a in b["anual"]}
        self.assertEqual((anual[2004]["unidades"], anual[2004]["cobertura_declarada"]), (1, "fora"))
        for ano in (2005, 2006, 2007):
            self.assertEqual((anual[ano]["unidades"], anual[ano]["potencia_mw"], anual[ano]["cobertura_declarada"]), (None, None, "fora"))
        self.assertEqual((anual[2008]["unidades"], anual[2008]["cobertura_declarada"]), (None, "parcial"))
        self.assertEqual(anual[2009]["unidades"], 4)
        self.assertNotIn("cobertura_declarada", anual[2009])
        self.assertEqual(anual[2010]["unidades"], 0)  # dentro da cobertura: zero explícito
        mensal = {m["m"]: m for m in b["mensal"]}
        self.assertEqual((mensal["2004-06"]["unidades"], mensal["2004-06"]["cobertura_declarada"]), (1, "fora"))
        nulos = [m for m in b["mensal"] if m["unidades"] is None]
        self.assertEqual(len(nulos), 53)
        self.assertTrue(all(m.get("cobertura_declarada") == "fora" and m["m"] < "2008-12" for m in nulos))
        self.assertEqual((mensal["2008-12"]["unidades"], mensal["2008-12"].get("cobertura_declarada")), (0, None))
        self.assertEqual(mensal["2008-11"]["acumulado_unidades"], 1)  # o estoque do cadastro continua
        rj = [x for x in b["uf_anual"] if x["uf"] == "RJ" and x["ano"] < 2009]
        self.assertEqual([(x["ano"], x["unidades"]) for x in rj], [(2004, 1), (2005, None), (2006, None), (2007, None), (2008, None)])
        self.assertEqual(b["controles"]["cobertura_das_series"]["pontos_nulos_mensal"], 53)
        self.assertEqual(b["controles"]["identidade_estoque"]["resultado"], "aprovada")


class TextosComFonte(unittest.TestCase):
    """Defeitos (baixo, P063): geração compartilhada fora da limitação territorial e método da
    estimativa do ONS afirmado sem fonte."""

    def test_limitacao_territorial_inclui_a_geracao_compartilhada(self):
        """Contagens do cadastro de 29/09/2026 (perfil de modalidade da gold, iguais à soma
        independente do Parquet feita pelo verificador: 22.670 unidades e 3.324.061,75 kW)."""
        t = transicao._texto_local_do_credito([
            {"categoria": "Auto consumo remoto", "unidades": 1105104, "potencia_mw": 13851.335},
            {"categoria": "Compartilhada", "unidades": 22670, "potencia_mw": 3324.062}])
        self.assertIn("geração compartilhada (22.670 unidades, 3.324,1 MW)", t)
        self.assertIn("autoconsumo remoto (1.105.104 unidades, 13.851,3 MW)", t)
        self.assertIn("Nos dois casos", t)
        self.assertIn("compartilhada", transicao.DOC_ANEEL_MODALIDADES["trecho"])
        from pipeline.energia.metricas import transicao as mt
        pot = next(m for m in mt.METRICAS if m["id"] == "mmgd_potencia_instalada")
        self.assertTrue(any("compartilhada" in x for x in pot["limitacoes"]))

    def test_estimativa_do_ons_sem_metodo_sem_fonte(self):
        import inspect
        fonte = inspect.getsource(transicao._bloco_ons)
        self.assertNotIn("meteorol", fonte)
        self.assertIn("Carga atendida por MMGD", transicao.DOC_ONS_DICIONARIO["trecho"])
        self.assertTrue(transicao.DOC_ONS_DICIONARIO["url"].endswith("DicionarioDados_Carga_Verificada.pdf"))
        self.assertIn("valor estimado da micro e minigeração distribuída", transicao.DOC_ONS_BALANCO["trecho"])


if __name__ == "__main__":
    unittest.main()
