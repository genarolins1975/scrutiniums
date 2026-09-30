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
from datetime import date
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, entidades  # noqa: E402
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
        for (cn, uf, _), (q, kw) in self.ag_pq.dist_uf_ano.items():
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
        sem = sum(q for (_, ano, _), (q, _) in self.ag_pq.mun_ano_fonte.items() if ano == mmgd.SEM_DATA)
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
        conta, a potência não entra na soma e o caso é contado."""
        raw = dict(self.pq[0])
        raw["MdaPotenciaInstaladaKW"] = None
        ag = mmgd.agrega([raw])
        (q, kw), = ag.mun_ano_fonte.values()
        self.assertEqual((q, kw), (1, 0.0))
        self.assertEqual(ag.controles()["potencia_ausente"], 1)
        self.assertNotIn("potencia_zero", ag.controles())

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
        p = mcti.parse_despacho(mcti.le_xlsx(_xlsx("mcti_despacho_2020_recorte.xlsx")))
        self.assertEqual(p["revisoes"], [{"mes": "2020-09", "anterior": 0.3285, "atual": 0.3287},
                                         {"mes": "2020-10", "anterior": 0.572, "atual": 0.5723},
                                         {"mes": "2020-12", "anterior": 0.6078, "atual": 0.6106}])
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
        # o anual oficial não é a média simples dos meses: a diferença existe e é pequena
        d2021 = next(x for x in b["anual_x_media_mensal"] if x["ano"] == 2021)
        self.assertAlmostEqual(d2021["media_simples_meses"], 0.1264, delta=0.01)


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


if __name__ == "__main__":
    unittest.main()
