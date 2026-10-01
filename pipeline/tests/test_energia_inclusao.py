"""Testes do módulo Inclusão energética (P059 a P062) com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_inclusao/ (tirados dos arquivos oficiais em 30/09/2026):
- scs_amostra.csv: linhas integrais do SCS (ANEEL) de RGE e CERIM (jan/2014, CERIM em dois
  despachos idênticos), CEEE-D (abr/2020 em dois despachos DIVERGENTES), Eletropaulo (set/2021 a
  mar/2022, total residencial de dez/2021 fora do padrão) e EMR (jun e jul/2023, total residencial
  zero em jul/2023);
- cde_amostra_01may2025.zip: linhas integrais do arquivo de Beneficiários da CDE de mai/2025 com os
  dois campos pessoais (NomCliente, NumCPFCNPJCliente) apagados no recorte; inclui linhas com
  código de município inválido (Equatorial MA '210083', CELPE '0') e faturas de tipos 2 a 4;
- tarifa_social_antiga_arquivada.csv: o CSV da série antiga (descontinuada), cópia do Internet
  Archive de 29/07/2024;
- mds_*: respostas do serviço MI Social (MDS) recortadas a cinco municípios e às estatísticas;
- sidra_67xx_recorte.json: respostas da API SIDRA (POF 6715; PNAD Contínua 6737, 6738, 6731);
- pof_amostra_dados.zip e pof_tradutor_recorte.json: registros de duas famílias de Rondônia dos
  microdados da POF 2017-2018 e as linhas do tradutor da despesa geral que elas usam;
- pof_coeficientes_despesas.xlsx e pof_indice_despesa.xls: planilhas originais do IBGE;
- pasi_localizacao_ciclo2025.xlsx: exportação integral do PASI (EPE), ciclo 2025;
- caderno_sisol_2025_trecho.txt: trecho do texto do caderno do ciclo 2025 (pdftotext -layout);
- lpt_*_recorte.csv: linhas integrais (Latin-1) do conjunto Luz para Todos do MME
  (lpt_domicilios_zero_recorte.csv: as 5 linhas de "Recurso da Distribuidora" de 2017 e 2018, todas
  com qtddomicilios = 0, e 2 de 2016);
- scs_incorporacao_rge.csv: linhas integrais do SCS de RGE (02016439000138) e RGE SUL
  (02016440000162) de out/2019 a jul/2020, com a incorporação da RGE em fev/2020;
- cde_amostra_01mar2026.zip: linhas integrais do arquivo de Beneficiários da CDE de mar/2026 (campos
  pessoais apagados): as 9 faturas com o código de município inexistente 1403205, faturas válidas de
  Roraima e linhas SubsBaixaRenda de subclasses fora de 3.2 a 3.6;
- mds_municipios_rr_recorte.csv: os 15 municípios de Roraima na resposta do MI Social de mar/2026.

Os valores esperados foram lidos nos arquivos originais por outro caminho (soma direta das
colunas, tabela publicada pelo IBGE, texto do caderno da EPE) e estão escritos nos testes.
"""
import csv
import io
import json
import math
import os
import sys
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia import metricas  # noqa: E402
from pipeline.energia.fontes import aneel_inclusao as fa  # noqa: E402
from pipeline.energia.fontes import epe_inclusao as fe  # noqa: E402
from pipeline.energia.fontes import ibge_inclusao as fi  # noqa: E402
from pipeline.energia.fontes import mds_inclusao as fm  # noqa: E402
from pipeline.energia.fontes import mme_inclusao as fl  # noqa: E402
from pipeline.energia.fontes import planilha_inclusao as fp  # noqa: E402
from pipeline.energia.metricas import inclusao as metricas_inclusao  # noqa: E402
from pipeline.energia.modulos import inclusao as mod  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, "dados", "energia_inclusao")
RAIZ = os.path.dirname(os.path.dirname(AQUI))
GOLD = os.path.join(RAIZ, "public", "energia", "gold", "inclusao.json")

RGE, CERIM, CEEE, ELETROPAULO, EMR = "02016439000138", "50235449000107", "08467115000100", "61695227000193", "19527639000158"
RGE_SUL = "02016440000162"


def _dados(nome):
    return os.path.join(DADOS, nome)


def _scs():
    with open(_dados("scs_amostra.csv"), encoding="utf-8", newline="") as f:
        return fa.le_scs(csv.DictReader(f, delimiter=";"))


def _gold():
    if not os.path.exists(GOLD):
        return None
    with open(GOLD, encoding="utf-8") as f:
        g = json.load(f)
    return g if g.get("disponivel") is True else None


class SCS(unittest.TestCase):
    """SCS: despacho vigente, DMR lida uma vez, contagens por modalidade e faixa."""

    @classmethod
    def setUpClass(cls):
        cls.esc, cls.diag = _scs()

    def test_esquema_completo(self):
        self.assertEqual(self.diag["cabecalho_faltando"], [])
        self.assertEqual(self.diag["linhas"], 70)

    def test_dmr_nao_multiplicada_pelas_faixas(self):
        # RGE jan/2014: VlrDMR = 1.468.574,35 repetido nas 5 linhas de faixa do despacho 493/2014
        tot = fa.totais_scs(self.esc[(RGE, "2014-01")])
        self.assertAlmostEqual(tot["dmr"], 1468574.35, places=2)
        self.assertNotAlmostEqual(tot["dmr"], 5 * 1468574.35, places=0)
        # soma direta das colunas do arquivo: UC 96.248, residencial 1.094.608, 17.002,534 MWh
        self.assertEqual(tot["uc_tsee"], 96248)
        self.assertEqual(tot["uc_residencial"], 1094608)
        self.assertAlmostEqual(tot["mwh_tsee"], 17002.534, places=3)

    def test_despacho_vigente_quando_diverge(self):
        # CEEE-D abr/2020: 1533/2020 (29/05/2020, 74.940 UC) e 2528/2020 (31/08/2020, 78.574 UC)
        reg = self.esc[(CEEE, "2020-04")]
        self.assertEqual(reg["despacho"], "2528/2020")
        self.assertTrue(reg["divergentes"])
        self.assertIn("1533/2020 (2020-05-29)", reg["alternativos"])
        tot = fa.totais_scs(reg)
        self.assertEqual(tot["uc_tsee"], 78574)
        self.assertAlmostEqual(tot["dmr"], 5492976.51, places=2)

    def test_republicacao_identica(self):
        reg = self.esc[(CERIM, "2014-01")]
        self.assertEqual(reg["despacho"], "648/2014")
        self.assertFalse(reg["divergentes"])
        self.assertEqual(self.diag["pares_com_mais_de_um_despacho"], 2)
        self.assertEqual(self.diag["pares_com_despachos_divergentes"], 1)
        self.assertEqual(self.diag["pares_com_faixas_incompletas"], 0)

    def test_numero_ausencia_e_zero(self):
        self.assertEqual(fa.numero(",00"), 0.0)
        self.assertIsNone(fa.numero(""))
        self.assertIsNone(fa.numero("NULL"))
        self.assertEqual(fa.numero("1.234,56"), 1234.56)

    def test_residencial_inconsistente(self):
        res, ts = {}, {}
        for (cn, mes), reg in self.esc.items():
            if cn == ELETROPAULO:
                t = fa.totais_scs(reg)
                res[mes], ts[mes] = t["uc_residencial"], t["uc_tsee"]
        # dez/2021: 2.552.348 contra cerca de 7,4 milhões nos vizinhos
        self.assertTrue(mod.residencial_inconsistente(res, ts, "2021-12"))
        self.assertFalse(mod.residencial_inconsistente(res, ts, "2021-11"))
        self.assertFalse(mod.residencial_inconsistente(res, ts, "2022-01"))
        emr_res = {m: fa.totais_scs(self.esc[(EMR, m)])["uc_residencial"] for m in ("2023-06", "2023-07")}
        emr_ts = {m: fa.totais_scs(self.esc[(EMR, m)])["uc_tsee"] for m in ("2023-06", "2023-07")}
        self.assertEqual(emr_res["2023-07"], 0)  # zero informado pela distribuidora, não ausência
        self.assertTrue(mod.residencial_inconsistente(emr_res, emr_ts, "2023-07"))

    def test_observacoes_sem_ausencia_virando_zero(self):
        obs = list(fa.observacoes_scs(self.esc))
        self.assertTrue(all(v is not None for _, _, v in obs))
        faixas = [o for o in obs if o[0].startswith(f"{RGE}.f") and o[0].endswith(".uc_tsee")]
        self.assertEqual(len(faixas), 5)
        self.assertEqual(sum(v for _, _, v in faixas), 96248)


class Completude(unittest.TestCase):
    """Regra do mês completo: lacuna conta como falta; incorporação não."""

    def test_incorporacao_nao_torna_incompleto(self):
        # RGE (02016439000138) informou até jan/2020 e foi incorporada pela RGE Sul (02016440000162)
        meses = {"2019-12": {RGE: 1.0, "02016440000162": 1.0, CERIM: 1.0},
                 "2020-01": {RGE: 1.0, "02016440000162": 1.0, CERIM: 1.0},
                 "2020-02": {"02016440000162": 1.0, CERIM: 1.0},
                 "2020-03": {"02016440000162": 1.0, CERIM: 1.0},
                 "2020-04": {"02016440000162": 1.0, CERIM: 1.0},
                 "2020-05": {"02016440000162": 1.0, CERIM: 1.0}}
        comp = mod.completude_scs(meses, minimo=2)
        self.assertTrue(comp["2020-02"]["completo"])
        self.assertTrue(comp["2020-05"]["completo"])

    def test_lacuna_e_cauda(self):
        # CERAL-DIS ausente em abr/2025 e de volta em mai/2025; ENEL CE ausente no último mês do arquivo
        ceral, enel_ce = "02900000000000", "07047251000170"
        meses = {"2025-03": {ceral: 20.0, enel_ce: 1.0, RGE: 1.0},
                 "2025-04": {enel_ce: 1.0, RGE: 1.0},
                 "2025-05": {ceral: 21.0, enel_ce: 1.0, RGE: 1.0},
                 "2025-06": {ceral: 21.0, RGE: 1.0}}
        comp = mod.completude_scs(meses, minimo=2)
        self.assertFalse(comp["2025-04"]["completo"])
        self.assertEqual(comp["2025-04"]["faltantes"], [ceral])
        self.assertTrue(comp["2025-05"]["completo"])
        self.assertFalse(comp["2025-06"]["completo"])
        self.assertEqual(comp["2025-06"]["faltantes"], [enel_ce])

    def test_minimo_de_informantes(self):
        comp = mod.completude_scs({"2013-12": {RGE: 1.0}, "2014-01": {RGE: 1.0, CERIM: 1.0}})
        self.assertFalse(comp["2013-12"]["completo"])  # abaixo de 90 informantes


class Incorporacao(unittest.TestCase):
    """Incorporação no SCS com linhas reais: RGE SUL passa a informar as UC da RGE em fev/2020."""

    @classmethod
    def setUpClass(cls):
        with open(_dados("scs_incorporacao_rge.csv"), encoding="utf-8", newline="") as f:
            esc, _ = fa.le_scs(csv.DictReader(f, delimiter=";"))
        cls.res, cls.ts, cls.ult = {}, {}, {}
        for (cn, mes), reg in esc.items():
            t = fa.totais_scs(reg)
            cls.res.setdefault(cn, {})[mes] = t["uc_residencial"]
            cls.ts.setdefault(cn, {})[mes] = t["uc_tsee"]
            cls.ult[cn] = max(cls.ult.get(cn, mes), mes)

    def test_valores_do_recorte(self):
        # soma direta das 5 faixas no CSV: RGE jan/2020 1.279.372; RGE SUL jan/2020 1.175.225 e fev/2020 2.454.222
        self.assertEqual(self.res[RGE]["2020-01"], 1279372)
        self.assertEqual(self.res[RGE_SUL]["2020-01"], 1175225)
        self.assertEqual(self.res[RGE_SUL]["2020-02"], 2454222)
        self.assertEqual(self.ult[RGE], "2020-01")

    def test_detecta_a_incorporacao(self):
        incs = mod.incorporacoes_scs(self.res, self.ult, "2020-05")
        self.assertEqual(len(incs), 1)
        inc = incs[0]
        self.assertEqual((inc["mes_ruptura"], inc["sucessora"], inc["incorporadas"]), ("2020-02", RGE_SUL, [RGE]))
        self.assertEqual(inc["total_incorporadas"], 1279372)
        # patamar: mediana de out a dez/2019 (1.172.517... 1.175.225) contra fev a abr/2020
        self.assertEqual((inc["patamar_antes"], inc["patamar_depois"]), (1173984, 2458847))

    def test_regra_residencial_respeita_a_incorporacao(self):
        r, t = self.res[RGE_SUL], self.ts[RGE_SUL]
        # sem a ruptura (regra antiga) RGE SUL saía da participação de jan a mar/2020: o defeito
        for m in ("2020-01", "2020-02", "2020-03"):
            self.assertTrue(mod.residencial_inconsistente(r, t, m), m)
            self.assertFalse(mod.residencial_inconsistente(r, t, m, ["2020-02"]), m)
        # jun/2020 (991.302 entre 2,46 milhões) continua inconsistente: erro real de dado
        self.assertTrue(mod.residencial_inconsistente(r, t, "2020-06", ["2020-02"]))

    def test_salto_sem_saida_nao_e_incorporacao(self):
        # a mesma RGE SUL sem a RGE no arquivo: não há saída, não há incorporação
        self.assertEqual(mod.incorporacoes_scs({RGE_SUL: self.res[RGE_SUL]}, {RGE_SUL: "2020-07"}, "2020-05"), [])
        # a RGE sem sucessora compatível: saída sem incorporação
        self.assertEqual(mod.incorporacoes_scs({RGE: self.res[RGE]}, {RGE: "2020-01"}, "2020-05"), [])


class Siglas(unittest.TestCase):
    def test_nao_informado_nao_e_sigla(self):
        self.assertFalse(mod.sigla_informada("Não Informado"))
        self.assertFalse(mod.sigla_informada(""))
        self.assertFalse(mod.sigla_informada(None))
        self.assertTrue(mod.sigla_informada("CRERAL"))


class BeneficiariosCDE(unittest.TestCase):
    """Beneficiários da CDE: agregação em fluxo, faturas por tipo e subclasse, nenhum dado pessoal."""

    @classmethod
    def setUpClass(cls):
        cls.agg = fa.agrega_cde_zip(_dados("cde_amostra_01may2025.zip"))

    def _faturas(self, cnpj):
        n = v = 0.0
        for (cn, mun, sc, tf), (k, soma, _) in self.agg["chaves"].items():
            if cn == cnpj and tf == "1" and sc in fa.SUBCLASSES_TSEE:
                n += k
                v += soma
        return n, round(v, 2)

    def test_contagens_do_recorte(self):
        # contagem direta no CSV: 283 linhas, 225 com SubsBaixaRenda (218 de faturamento)
        self.assertEqual(self.agg["linhas"], 283)
        self.assertEqual(self.agg["linhas_tsee"], 225)
        self.assertEqual(self.agg["referencias"], {"05/2025": 225})
        self.assertEqual(self._faturas("82574864000181"), (167, 5428.86))   # CEREJ
        self.assertEqual(self._faturas("01229747000189"), (48, 1480.79))    # CERGAPA

    def test_municipio_invalido_fica_fora_do_mapa(self):
        self.assertIsNone(fa.municipio_valido("210083"))
        self.assertIsNone(fa.municipio_valido("0"))
        self.assertEqual(fa.municipio_valido("2704302"), "2704302")
        inval = {cn: k for (cn, mun, sc, tf), (k, _, _) in self.agg["chaves"].items() if mun == "invalido" and tf == "1"}
        self.assertEqual(inval, {"06272793000184": 2, "10835932000108": 1})  # Equatorial MA e CELPE

    def test_tipos_de_faturamento_separados(self):
        tipos = {}
        for (cn, mun, sc, tf), (k, _, _) in self.agg["chaves"].items():
            tipos[tf] = tipos.get(tf, 0) + k
        self.assertEqual(tipos, {"1": 218, "2": 2, "3": 2, "4": 3})

    def test_nenhum_campo_pessoal(self):
        with zipfile.ZipFile(_dados("cde_amostra_01may2025.zip")) as z:
            texto = z.read(z.namelist()[0]).decode("latin-1")
        linhas = texto.splitlines()
        marcada = linhas[1].replace(",,,SubsBaixaRenda", ",FULANO DE TAL,***.123.456-**,SubsBaixaRenda")
        self.assertNotEqual(marcada, linhas[1])
        agg = fa.agrega_cde(io.StringIO("\n".join([linhas[0], marcada]) + "\n"))
        self.assertNotIn("FULANO", repr(agg))
        self.assertNotIn("123.456", repr(agg))

    def test_esquema_mudado_falha(self):
        with self.assertRaises(ValueError):
            fa.agrega_cde(io.StringIO("AnmReferencia,SigAgente\n05/2025,X\n"))

    def test_mes_do_recurso(self):
        self.assertEqual(fa.mes_do_recurso("cde-beneficiarios-01may2026.zip"), "2026-05")
        self.assertEqual(fa.mes_do_recurso("Beneficiários da CDE - mai/25"), "2025-05")
        self.assertIsNone(fa.mes_do_recurso("Dicionário de dados"))


class DescontoLiquidoMunicipio(unittest.TestCase):
    """Beneficiários da CDE, recorte real de mar/2026 (89 linhas SubsBaixaRenda): desconto líquido só das
    subclasses 3.2 a 3.6 e município inexistente fora do mapa. Valores esperados somados direto nas linhas
    do recorte, sem as funções do módulo."""

    @classmethod
    def setUpClass(cls):
        agg = fa.agrega_cde_zip(_dados("cde_amostra_01mar2026.zip"))
        # mesmas chaves que o silver guarda (observacoes_cde → _cde_por_mes)
        cls.chaves = {}
        for serie, _, v in fa.observacoes_cde(agg, "2026-03"):
            p = serie.split(".")
            cls.chaves.setdefault((p[0], p[1], ".".join(p[2:-2]), p[-2]), {})[p[-1]] = v
        with open(_dados("mds_municipios_rr_recorte.csv"), encoding="utf-8") as f:
            cls.rr = {cod for cod, *_ in fm.le_municipios(f.read())}

    def test_desconto_liquido_exclui_outras_subclasses(self):
        r = mod.resumo_cde_mes(self.chaves)
        # subclasses 3.2 a 3.6, tipos 1 a 4: R$ 1.445,69; tipo 1: 29 faturas e R$ 1.554,23
        self.assertAlmostEqual(r["desconto_liquido_reais"], 1445.69, places=2)
        self.assertAlmostEqual(r["desconto_faturas_reais"], 1554.23, places=2)
        self.assertEqual(r["faturas_tsee"], 29)
        # 56 linhas de outras subclasses (3.1, 3.7 a 3.9, 3.11 a 3.34) somam R$ -247.951,54 e ficam à parte
        self.assertAlmostEqual(r["desconto_fora_das_subclasses_reais"], -247951.54, places=2)
        self.assertEqual(r["linhas_fora_das_subclasses"], 56)
        # a soma de todas as chaves (o defeito) daria R$ -246.505,85
        self.assertNotAlmostEqual(r["desconto_liquido_reais"], sum(v.get("valor", 0) for v in self.chaves.values()), places=0)

    def test_municipio_inexistente(self):
        self.assertEqual(len(self.rr), 15)  # Roraima tem 15 municípios no MI Social
        self.assertIsNone(mod.municipio_do_mapa("1403205", self.rr))     # 140320 não existe
        self.assertEqual(mod.municipio_do_mapa("1400100", self.rr), "140010")  # Boa Vista
        self.assertEqual(mod.municipio_do_mapa("1403205", None), "140320")     # sem lista, só o formato
        self.assertIsNone(mod.municipio_do_mapa("invalido", self.rr))
        r = mod.resumo_cde_mes({k: v for k, v in self.chaves.items() if k[1].startswith("14")}, self.rr)
        # 29 faturas em Roraima no recorte: 20 em municípios existentes e 9 no código 1403205
        self.assertEqual(r["faturas_tsee"], 29)
        self.assertEqual(r["por_uf"]["RR"]["faturas"], 20)
        self.assertEqual((r["faturas_municipio_inexistente"], r["faturas_municipio_invalido"]), (9, 9))
        self.assertEqual(dict(r["codigos_inexistentes"]), {"1403205": 9})
        # identidade: UF + fora do mapa = total
        self.assertEqual(sum(u["faturas"] for u in r["por_uf"].values()) + r["faturas_municipio_invalido"], r["faturas_tsee"])


class SerieAntiga(unittest.TestCase):
    def test_leitura_e_repeticao_de_2018(self):
        with open(_dados("tarifa_social_antiga_arquivada.csv"), encoding="utf-8-sig") as f:
            pts = fa.le_ts_antiga(f.read())
        d = {(r, m): (res, br) for r, m, res, br, _ in pts}
        self.assertEqual(d[("CO", "2012-12")], (4412374, 441295))
        self.assertEqual({r for r, _, _, _, _ in pts}, {"N", "NE", "SE", "S", "CO"})
        # o arquivo original repete em nov/2018 as contagens de set/2018 (conferido linha a linha)
        for reg in ("N", "NE", "SE", "S", "CO"):
            self.assertEqual(d[(reg, "2018-11")][1], d[(reg, "2018-09")][1])


class CadastroUnico(unittest.TestCase):
    def test_municipios(self):
        with open(_dados("mds_municipios_recorte.csv"), encoding="utf-8") as f:
            linhas = fm.le_municipios(f.read())
        d = {cod: (mes, nome, uf, v) for cod, mes, nome, uf, v in linhas}
        mes, nome, uf, v = d["355030"]
        self.assertEqual((mes, uf), ("2026-03", "SP"))
        self.assertEqual(v["familias_ate_meio_sm"], 1064351)
        self.assertEqual(v["familias_ate_meio_sm_atualizadas"], 938554)
        # atualizadas são subconjunto das cadastradas; cadastro total não é universo elegível
        for _, _, _, _, x in linhas:
            self.assertLessEqual(x["familias_ate_meio_sm_atualizadas"], x["familias_ate_meio_sm"])
            self.assertLess(x["familias_ate_meio_sm"], x["familias_total"])

    def test_totais_nacionais(self):
        with open(_dados("mds_totais_recorte.json"), encoding="utf-8") as f:
            tot = fm.le_totais(f.read())
        soma, n, falt = tot[("familias_ate_meio_sm_atualizadas", "2026-03")]
        self.assertEqual((soma, n, falt), (25305223.0, 5571, 0))


class POF(unittest.TestCase):
    """POF 2017-2018: SIDRA, coeficientes publicados, microdados e estimador do plano amostral."""

    def test_tabela_6715(self):
        with open(_dados("sidra_6715_recorte.json"), encoding="utf-8") as f:
            pts = {(t, cl, tp, var): v for t, cl, tp, var, v in fi.le_pof_6715(f.read())}
        # valores publicados pelo IBGE (tabela 6715): Brasil, energia elétrica, R$ 115,36 (2,5%);
        # até R$ 1.908, R$ 65,62 (4,4%); Sergipe (UF) e Sudeste (região) com chaves distintas
        self.assertEqual(pts[("BR", "7999", "energia_eletrica", "media_reais")], 115.36)
        self.assertEqual(pts[("BR", "47558", "energia_eletrica", "distribuicao_pct")], 4.4)
        self.assertEqual(pts[("SE", "7999", "energia_eletrica", "media_reais")], 77.73)
        self.assertEqual(pts[("RG-SE", "7999", "energia_eletrica", "media_reais")], 125.53)

    def test_razao_de_medias_nao_e_media_de_razoes(self):
        # três famílias num estrato com duas UPA, contas feitas à mão (valores mensais em R$):
        # f1 peso 1: energia 50, despesa 1.000, renda 800;  f2 peso 1: energia 150, despesa 5.000, renda 6.000;
        # f3 peso 2: energia 60, despesa 500, renda 40 (energia acima da renda)
        fams = [{"estrato": "A", "upa": "a1", "peso": 1.0, "energia": 50.0, "despesa": 1000.0, "renda": 800.0},
                {"estrato": "A", "upa": "a2", "peso": 1.0, "energia": 150.0, "despesa": 5000.0, "renda": 6000.0},
                {"estrato": "A", "upa": "a2", "peso": 2.0, "energia": 60.0, "despesa": 500.0, "renda": 40.0}]
        for f in fams:
            f.update(classe=fi.classe_renda(f["renda"]), regiao="RG-N", sigla_uf="RO")
        e = mod.estimativas_pof(fams)
        self.assertAlmostEqual(e["BR.7999.energia_media"], 320 / 4)            # (50 + 150 + 2·60) ÷ 4
        self.assertAlmostEqual(e["BR.7999.despesa_media"], 7000 / 4)
        # razão de médias 100 × 320 ÷ 7.000 = 4,571%; média das razões 100 × (0,05 + 0,03 + 2·0,12) ÷ 4 = 8%
        self.assertAlmostEqual(e["BR.7999.razao_medias_pct"], 100 * 320 / 7000)
        self.assertAlmostEqual(e["BR.7999.media_razoes_desp_pct"], 8.0)
        self.assertNotAlmostEqual(e["BR.7999.razao_medias_pct"], e["BR.7999.media_razoes_desp_pct"], places=1)
        # na renda: 100 × (0,0625 + 0,025 + 2·1,5) ÷ 4 = 77,1875%, puxada pela família de renda 40
        self.assertAlmostEqual(e["BR.7999.media_razoes_renda_pct"], 77.1875)
        # mediana ponderada na despesa: razões 0,03 (peso 1), 0,05 (1), 0,12 (2) → 5%
        self.assertAlmostEqual(e["BR.7999.mediana_desp_pct"], 5.0)
        # sensibilidade: sem a família com energia acima da renda, (0,0625 + 0,025) ÷ 2 = 4,375%;
        # 1 família da amostra, 50% do peso; as 3 maiores parcelas somam o total (77,1875 pontos)
        self.assertAlmostEqual(e["BR.7999.sens_media_razoes_renda_sem_acima_da_renda_pct"], 4.375)
        self.assertEqual(e["BR.7999.sens_renda_familias_energia_acima_da_renda_n"], 1.0)
        self.assertAlmostEqual(e["BR.7999.sens_renda_familias_energia_acima_da_renda_peso_pct"], 50.0)
        self.assertAlmostEqual(e["BR.7999.sens_media_razoes_renda_3_maiores_pp"], 77.1875)
        # classe até R$ 1.908 (f1 e f3): nenhuma família sem despesa com energia
        self.assertEqual(e["BR.47558.n"], 2.0)
        self.assertAlmostEqual(e["BR.47558.energia_media"], (50 + 2 * 60) / 3)
        self.assertEqual(e["BR.47558.sem_despesa_energia_pct"], 0.0)

    def test_coeficientes_publicados(self):
        with open(_dados("pof_coeficientes_despesas.xlsx"), "rb") as f:
            cv = fi.le_cv_pof(fp.ler_xlsx(f.read())["Tabela 1"])
        self.assertEqual(cv["energia_eletrica"], [0.8, 1.4, 1.1, 0.8, 1.0, 1.7, 2.6, 3.6])
        self.assertEqual(cv["despesa_total"][0], 1.5)

    def test_leitor_xls_biff(self):
        with open(_dados("pof_indice_despesa.xls"), "rb") as f:
            pl = fp.ler_xls(f.read())
        linhas = pl["Planilha1"]
        self.assertEqual(linhas[0], ["INDICE", "NIVEL", "DESCRICAO"])
        self.assertEqual(linhas[1], [1.0, 0.0, "DESPESA TOTAL"])

    def test_microdados_duas_familias(self):
        with open(_dados("pof_tradutor_recorte.json"), encoding="utf-8") as f:
            trad = fi.le_tradutor_despesa(json.load(f))
        fams, diag = fi.familias_pof(_dados("pof_amostra_dados.zip"), trad)
        self.assertEqual(diag["familias"], 2)
        f1 = fams[("110000016", "2", "1")]
        f2 = fams[("110000602", "13", "1")]
        # família 1: item 600101 (energia elétrica), quadro 6, R$ 266,00 deflacionados, fator 12 → 266 × 12 ÷ 12
        self.assertAlmostEqual(f1["energia"], 266.00, places=6)
        self.assertEqual(f1["renda"], 3855.34)
        self.assertAlmostEqual(f1["peso"], 690.88373818, places=8)
        self.assertGreater(f1["despesa"], f1["energia"])
        # família 2 não declarou conta de energia: zero de despesa, não ausência
        self.assertEqual(f2["energia"], 0.0)
        self.assertEqual(fi.classe_renda(3855.34), 2)
        self.assertEqual(fi.classe_renda(1908.0), 0)
        self.assertIsNone(fi.classe_renda(None))

    def test_estimador_de_razao_com_plano(self):
        # dois estratos com duas UPA cada; conta à mão:
        # Y = 2·10 + 2·20 + 1·30 + 1·40 = 130; X = Σw = 6; R = 130/6
        fams = [{"estrato": "A", "upa": "a1", "peso": 2.0, "y": 10.0}, {"estrato": "A", "upa": "a2", "peso": 2.0, "y": 20.0},
                {"estrato": "B", "upa": "b1", "peso": 1.0, "y": 30.0}, {"estrato": "B", "upa": "b2", "peso": 1.0, "y": 40.0}]
        plano = mod.Plano(fams)
        R, ep, n, X = plano.razao(fams, lambda f: f["y"], lambda f: 1.0)
        self.assertAlmostEqual(R, 130 / 6)
        # z_i = w(y − R)/X por UPA; V = Σ_h n_h/(n_h−1) Σ (z − z̄_h)²
        z = {u: w * (y - 130 / 6) / 6 for u, w, y in (("a1", 2, 10), ("a2", 2, 20), ("b1", 1, 30), ("b2", 1, 40))}
        va = 2 * ((z["a1"] - (z["a1"] + z["a2"]) / 2) ** 2 + (z["a2"] - (z["a1"] + z["a2"]) / 2) ** 2)
        vb = 2 * ((z["b1"] - (z["b1"] + z["b2"]) / 2) ** 2 + (z["b2"] - (z["b1"] + z["b2"]) / 2) ** 2)
        self.assertAlmostEqual(ep, math.sqrt(va + vb))
        # domínio: UPA sem membro continua no estrato e contribui com zero
        R2, ep2, n2, _ = plano.razao(fams[:1] + fams[2:], lambda f: f["y"], lambda f: 1.0)
        self.assertEqual(n2, 3)
        self.assertAlmostEqual(R2, (20 + 30 + 40) / 4)

    def test_regra_de_precisao(self):
        self.assertEqual(mod.estado_precisao(10.0, 1.0), ("publicado", 10.0))
        self.assertEqual(mod.estado_precisao(10.0, 2.0)[0], "cautela")
        self.assertEqual(mod.estado_precisao(10.0, 3.5)[0], "suprimido")
        self.assertEqual(mod.estado_precisao(None, None), ("ausente", None))
        self.assertEqual(mod.estado_precisao(0.0, 0.0), ("zero_na_amostra", None))


class PNAD(unittest.TestCase):
    def _le(self, tab):
        with open(_dados(f"sidra_{tab}_recorte.json"), encoding="utf-8") as f:
            return {(t, a, s, var, fo): v for t, a, s, var, fo, v in fi.le_pnad(f.read(), tab)}

    def test_valores_publicados(self):
        a, b, c = self._le("6737"), self._le("6738"), self._le("6731")
        self.assertEqual(a[("BR", "2025", "total", "domicilios_mil", "qualquer")], 79170)
        self.assertEqual(a[("BR", "2025", "total", "domicilios_mil", "rede_geral")], 78692)
        self.assertEqual(b[("BR", "2025", "total", "pct", "rede_geral_integral")], 98.3)
        self.assertEqual(c[("BR", "2025", "total", "domicilios_mil", "todos")], 79305)
        # o percentual em tempo integral é sobre os domicílios de rede geral: 77.364 ÷ 78.692
        integral = b[("BR", "2025", "total", "domicilios_mil", "rede_geral_integral")]
        self.assertEqual(integral, 77364)
        self.assertAlmostEqual(100 * integral / 78692, 98.3, delta=0.05)
        self.assertNotAlmostEqual(100 * integral / 79305, 98.3, delta=0.5)
        # sem energia de qualquer fonte: 79.305 − 79.170 = 135 mil domicílios
        self.assertEqual(c[("BR", "2025", "total", "domicilios_mil", "todos")] - a[("BR", "2025", "total", "domicilios_mil", "qualquer")], 135)

    def test_diferenca_arredondada_nao_vira_zero(self):
        a, c = self._le("6737"), self._le("6731")
        tot, com = c[("BR", "2025", "total", "domicilios_mil", "todos")], a[("BR", "2025", "total", "domicilios_mil", "qualquer")]
        self.assertEqual(mod.domicilios_sem_energia(tot, com), (135, "calculado"))
        # Roraima rural 2025 na API SIDRA (6731 v162 e 6737 v5157): 20 e 20 mil, com 99,3% com energia.
        # A diferença zero de valores arredondados em milhares não é zero: fica sem valor, menos de 1 mil
        self.assertEqual(mod.domicilios_sem_energia(20.0, 20.0), (None, "menos_de_1_mil"))
        self.assertEqual(mod.domicilios_sem_energia(None, 20.0), (None, "ausente"))

    def test_convencoes_do_ibge(self):
        for s in ("-", "..", "...", "X", ""):
            self.assertIsNone(fi.valor_sidra(s))
        self.assertEqual(fi.valor_sidra("0"), 0.0)


class SistemasIsolados(unittest.TestCase):
    def test_pasi_contra_caderno_em_pdf(self):
        with open(_dados("pasi_localizacao_ciclo2025.xlsx"), "rb") as f:
            locs, falt = fe.le_localidades(fp.ler_xlsx(f.read()))
        self.assertEqual(falt, [])
        with open(_dados("caderno_sisol_2025_trecho.txt"), encoding="utf-8") as f:
            cad = fe.le_totais_caderno(f.read())
        # caderno do ciclo 2025: "totaliza 160 ... (175 localidades)" e "1,965 milhões pessoas"
        self.assertEqual((cad["localidades"], cad["localidades_ciclo_anterior"], cad["populacao_milhoes"]), (160, 175, 1.965))
        self.assertEqual(len(locs), cad["localidades"])
        pop = sum(l["populacao"] or 0 for l in locs)
        self.assertEqual(pop, 1964825)
        self.assertLessEqual(abs(pop / 1e6 - cad["populacao_milhoes"]), 0.0005)
        # população ausente fica None (2 localidades), nunca zero
        self.assertEqual(sum(1 for l in locs if l["populacao"] is None), 2)
        progs = {l["programa"] for l in locs if l["programa"]}
        self.assertEqual(progs, {"MLA - Mais Luz para Amazônia", "PLPT - Programa Luz para Todos"})

    def test_populacao_ausente_nao_vira_zero_no_agregado(self):
        with open(_dados("pasi_localizacao_ciclo2025.xlsx"), "rb") as f:
            locs, _ = fe.le_localidades(fp.ler_xlsx(f.read()))
        por_dist = {}
        for l in locs:
            por_dist.setdefault(l["distribuidora"], []).append(l)
        # PA-101 ALCOA PORTO e PA-102 ALCOA BENEFICIAMENTO (VIBRA ENERGIA) têm População vazia no XLSX
        self.assertEqual(sorted(l["sigla"] for l in por_dist["VIBRA ENERGIA"]), ["PA-101", "PA-102"])
        self.assertEqual(mod.soma_populacao(por_dist["VIBRA ENERGIA"]), {"populacao": None, "localidades_sem_populacao": 2})
        # no ciclo, a soma usa só as informadas e declara as 2 sem população
        self.assertEqual(mod.soma_populacao(locs), {"populacao": 1964825, "localidades_sem_populacao": 2})


class LuzParaTodos(unittest.TestCase):
    def test_domicilios(self):
        with open(_dados("lpt_domicilios_recorte.csv"), encoding="latin-1", newline="") as f:
            agg, diag = fl.agrega_domicilios(csv.DictReader(f, delimiter=";"))
        self.assertEqual(diag["linhas"], 31)
        self.assertEqual(diag["linhas_usadas"], 31)
        # soma direta das linhas do recorte
        self.assertEqual(diag["domicilios"], 670)
        mun = {}
        for (uf, nn, prog, ano), q in agg["municipal"].items():
            mun[(uf, nn, prog)] = mun.get((uf, nn, prog), 0) + q
        self.assertEqual(mun[("AC", "ACRELANDIA", "rural")], 381)
        self.assertEqual(mun[("AC", "ACRELANDIA", "recurso_distribuidora")], 101)
        self.assertEqual(mun[("AM", "BERURI", "regioes_remotas")], 69)
        self.assertEqual(mun[("PB", "CABACEIRAS", "rural")], 105)  # estado grafado "Paraiba" no arquivo
        self.assertEqual(agg["mensal"][("AM", "regioes_remotas", "2023-03")], 69)
        self.assertEqual(agg["nomes"][("AC", "ACRELANDIA")], "Acrelândia")

    def test_linha_invalida_nao_vira_zero(self):
        agg, diag = fl.agrega_domicilios([
            {"programa": "LPT - Rural", "qtddomicilios": "", "mes": "1", "ano": "2005", "municipio": "Acrelândia", "estado": "Acre", "DtHomologacao": ""},
            {"programa": "LPT - Rural", "qtddomicilios": "3", "mes": "13", "ano": "2005", "municipio": "Acrelândia", "estado": "Acre", "DtHomologacao": ""},
            {"programa": "Outro", "qtddomicilios": "3", "mes": "1", "ano": "2005", "municipio": "Acrelândia", "estado": "Acre", "DtHomologacao": ""}])
        self.assertEqual(agg["mensal"], {})
        self.assertEqual((diag["quantidade_invalida"], diag["data_invalida"]), (1, 1))
        self.assertEqual(diag["programa_desconhecido"], {"Outro": 1})

    def test_zero_informado_nao_vira_ausencia(self):
        with open(_dados("lpt_domicilios_zero_recorte.csv"), encoding="latin-1", newline="") as f:
            agg, diag = fl.agrega_domicilios(csv.DictReader(f, delimiter=";"))
        self.assertEqual(diag["linhas_usadas"], 7)
        serie = {a["ano"]: a for a in mod.serie_anual_lpt(agg["mensal"], list(fl.PROGRAMA_ROTULO))}
        # 2016: uma linha com 2 domicílios e uma com 0; 2017 e 2018: só linhas com qtddomicilios = 0
        self.assertEqual(serie["2016"]["recurso_distribuidora"], 2)
        self.assertEqual(serie["2017"]["recurso_distribuidora"], 0.0)
        self.assertIsNotNone(serie["2017"]["recurso_distribuidora"])
        self.assertEqual(serie["2018"]["recurso_distribuidora"], 0.0)
        # programa sem nenhuma linha no ano continua ausente
        self.assertIsNone(serie["2017"]["rural"])
        self.assertEqual([a["parcial"] for a in serie.values()], [False, False, True])

    def test_recursos(self):
        with open(_dados("lpt_recursos_recorte.csv"), encoding="latin-1", newline="") as f:
            contratos, diag = fl.le_recursos(csv.DictReader(f, delimiter=";"))
        self.assertEqual(diag["cabecalho_faltando"], [])
        c0 = contratos[0]
        self.assertEqual((c0["uf"], c0["inicio"], c0["fim"]), ("RR", "2010-01", "2013-10"))
        self.assertEqual(c0["valores"]["vlrempenhadocde"], 53772800.0)
        self.assertEqual(c0["valores"]["vlrpagocde"], 48748419.0)
        self.assertEqual(c0["valores"]["vlrempenhadorgr"], 0.0)

    def test_vinculo_de_municipio_por_nome_exato(self):
        idx = fl.indice_municipios([("120001", "ACRELÂNDIA", "AC"), ("250270", "CABACEIRAS", "PB"),
                                    ("110013", "MACHADINHO D'OESTE", "RO"), ("330380", "PARATY", "RJ")])
        self.assertEqual(idx[("AC", fl.chave_nome("Acrelândia"))], "120001")
        self.assertNotIn(("AC", fl.chave_nome("Acrelandia do Norte")), idx)
        # o arquivo do MME escreve "Machadinho Doeste": a chave sem espaços casa exatamente
        self.assertEqual(idx[("RO", fl.chave_nome("Machadinho Doeste"))], "110013")
        # nome antigo (Parati) não casa com o atual (Paraty): fica sem código, sem aproximação
        self.assertNotIn(("RJ", fl.chave_nome("Parati")), idx)
        self.assertEqual(fl.uf_do_estado("Paraiba"), "PB")
        self.assertEqual(fl.uf_do_estado("Amapá"), "AP")


class Metricas(unittest.TestCase):
    def test_catalogo_valido(self):
        erros = [e for m in metricas_inclusao.METRICAS for e in metricas.validar(m)]
        self.assertEqual(erros, [])
        self.assertTrue(all(m["id"].startswith("inclusao.") for m in metricas_inclusao.METRICAS))


class Gold(unittest.TestCase):
    """Contrato e reconciliações da gold publicada (pulado se a gold não existir)."""

    @classmethod
    def setUpClass(cls):
        cls.g = _gold()
        if cls.g is None:
            raise unittest.SkipTest("public/energia/gold/inclusao.json ausente ou indisponível")

    def test_blocos_e_tamanho(self):
        for k in ("tarifa_social", "cobertura", "orcamento", "acesso"):
            self.assertIn(k, self.g)
        # meta do contrato: ~400 KB; a gold do módulo fica em torno de 450 KB (quatro painéis, detalhe no CSV);
        # o teto de 470 KB acusa crescimento sem revisão do que vai para a gold
        self.assertLess(os.path.getsize(GOLD), 470 * 1024)

    def test_nenhum_dado_pessoal(self):
        texto = json.dumps(self.g, ensure_ascii=False)
        for campo in ("NomCliente", "NumCPFCNPJCliente", "CPF"):
            self.assertNotIn(f'"{campo}"', texto)

    def test_evidencias_validas(self):
        ts = self.g["tarifa_social"]
        fichas = [k["evidencia"] for k in ts["kpis"].values() if isinstance(k, dict) and k.get("evidencia")]
        fichas.append(self.g["cobertura"]["brasil"]["evidencia"])
        fichas += list(self.g["orcamento"]["evidencias"].values())
        fichas.append(self.g["acesso"]["evidencia_sem_energia"])
        lpt = self.g["acesso"]["universalizacao"]["luz_para_todos"]
        fichas.append(lpt["evidencia_total"])
        for f in fichas:
            self.assertEqual(ev.validar(f), [], f.get("indicador"))
            for t in f["testes"]:
                self.assertNotEqual(t["resultado"], "reprovado", (f["indicador"], t))
        # a série antiga diverge do SCS em 2015 (recadastramento); a ficha precisa dizer isso, não esconder
        antiga = next(t for t in ts["kpis"]["uc_tsee"]["evidencia"]["testes"] if "série antiga" in t["nome"])
        self.assertEqual(antiga["resultado"], "ressalva")
        self.assertIn("2015-09 (-5,61%)", antiga["detalhe"])

    def test_scs_contra_cde_mai_2025(self):
        # conferência por caminho independente: o arquivo de Beneficiários da CDE de mai/2025 foi
        # agregado por outro programa (leitura direta do CSV, sem as funções do módulo) e deu
        # 17.612.898 faturas de faturamento com desconto da Tarifa Social (subclasses 3.2 a 3.6)
        ts = self.g["tarifa_social"]
        mai = next(m for m in ts["cde_meses"] if m["mes"] == "2025-05")
        self.assertEqual(mai["faturas_tsee"], 17612898)
        conf = ts["conferencia_scs_cde"]
        self.assertEqual(conf["mes"], "2025-05")
        # 102 distribuidoras nas duas bases (a CODESAM só aparece na CDE, com 25 faturas)
        self.assertEqual((conf["uc_scs"], conf["faturas_cde"]), (17246524, 17612873))
        self.assertEqual(conf["so_na_cde"], ["CODESAM"])
        self.assertAlmostEqual(conf["diferenca_pct"], 2.12, places=2)
        # acima de ±2% no total: a reconciliação é publicada como ressalva, com as maiores diferenças
        rec = ts["kpis"]["uc_tsee"]["evidencia"]["reconciliacao"]
        self.assertEqual(rec["resultado"], "ressalva")
        # a lista de maiores diferenças tem corte DECLARADO de 1.000 UC; as menores ficam em lista própria.
        # CEMIG-D (06981180000116): 1.245.606 UC e 1.399.427 faturas; CERES (31465487000101): 436 e 1.740
        self.assertEqual(conf["uc_minima_maiores_diferencas"], 1000)
        self.assertIn("1.000 UC ou mais", conf["tolerancia"])
        self.assertTrue(all(x["uc_scs"] >= 1000 for x in conf["maiores_diferencas"]))
        self.assertEqual((conf["maiores_diferencas"][0]["sigla"], conf["maiores_diferencas"][0]["diferenca_pct"]), ("CEMIG-D", 12.35))
        pequena = conf["diferencas_distribuidoras_pequenas"][0]
        self.assertEqual((pequena["cnpj"], pequena["uc_scs"], pequena["faturas_cde"], pequena["diferenca_pct"]),
                         ("31465487000101", 436, 1740, 299.08))
        lim = " ".join(ts["proveniencia"]["cde"]["limitacoes"])
        self.assertIn("com 1.000 UC ou mais: CEMIG-D, 12,35%", lim)
        self.assertIn("CERES, 299,08%", lim)

    def test_desconto_liquido_so_subclasses_da_tarifa_social(self):
        # releitura independente dos ZIP (subclasses 3.2 a 3.6, tipos 1 a 4): mar/2026 R$ 786.968.415,45;
        # mai/2025 R$ 530.597.136,83. A versão anterior somava as outras subclasses (R$ 760,8 milhões)
        meses = {m["mes"]: m for m in self.g["tarifa_social"]["cde_meses"]}
        self.assertAlmostEqual(meses["2026-03"]["desconto_liquido_reais"], 786968415.45, delta=0.02)
        self.assertAlmostEqual(meses["2025-05"]["desconto_liquido_reais"], 530597136.83, delta=0.02)
        self.assertLess(meses["2026-03"]["desconto_fora_das_subclasses_reais"], -2.6e7)
        # desconto das faturas (tipo 1) R$ 787.959.101,54 na releitura; 17.155.135 faturas
        self.assertAlmostEqual(meses["2026-03"]["desconto_faturas_reais"], 787959101.54, delta=0.02)
        self.assertEqual(meses["2026-03"]["faturas_tsee"], 17155135)

    def test_mes_sem_original_no_bronze_nao_publica_valores(self):
        for m in self.g["tarifa_social"]["cde_meses"]:
            if m["original_no_bronze"]:
                self.assertIsNotNone(m["faturas_tsee"], m["mes"])
                self.assertIsNone(m["motivo_sem_valores"])
            else:
                self.assertIsNone(m["faturas_tsee"], m["mes"])
                self.assertIsNone(m["desconto_liquido_reais"], m["mes"])
                self.assertIsNotNone(m["cobertura_scs_pct"])
                self.assertIn("não foi guardado no bronze", m["motivo_sem_valores"])

    def test_serie_da_cde_depois_do_scs(self):
        ts = self.g["tarifa_social"]
        meses = {m["mes"]: m for m in ts["cde_meses"]}
        # jun/2025 a fev/2026 processados com o original no bronze, entre a conferência e o mapa
        for m in ("2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"):
            self.assertTrue(meses[m]["original_no_bronze"], m)
            self.assertIn("série mensal depois do fim do SCS", meses[m]["uso"])
        # a gratuidade até 80 kWh (05/07/2025) aparece no desconto médio por fatura
        self.assertGreater(meses["2025-07"]["desconto_medio_por_fatura_reais"], meses["2025-06"]["desconto_medio_por_fatura_reais"])
        self.assertEqual(ts["serie_cde_uf_json"], "/energia/series/inclusao_cde_mensal_uf.json")
        with open(os.path.join(RAIZ, "public", "energia", "series", "inclusao_cde_mensal_uf.json"), encoding="utf-8") as f:
            su = json.load(f)
        for i, mes in enumerate(su["meses"]):
            soma = sum(l[i] or 0 for l in su["faturas_tsee"])
            self.assertEqual(soma + meses[mes]["faturas_municipio_invalido"], meses[mes]["faturas_tsee"], mes)

    def test_municipio_inexistente_fica_fora_do_mapa(self):
        ts, cob = self.g["tarifa_social"], self.g["cobertura"]
        mar = next(m for m in ts["cde_meses"] if m["mes"] == "2026-03")
        self.assertEqual(mar["codigos_inexistentes"], [{"codigo": "1403205", "faturas": 9}])
        self.assertEqual(mar["faturas_municipio_invalido"], 199)  # 190 de formato inválido + 9 inexistentes
        rr_ts = next(u for u in ts["ufs"] if u["uf"] == "RR")
        rr_cob = next(u for u in cob["ufs"] if u["uf"] == "RR")
        self.assertEqual(rr_ts["faturas_tsee"], rr_cob["faturas_tsee"])
        self.assertEqual(rr_ts["faturas_tsee"], 55573)

    def test_incorporacao_nao_e_inconsistencia(self):
        ts = self.g["tarifa_social"]
        por_mes = {l["m"]: l for l in ts["serie_mensal"]}
        # participação com todas as distribuidoras em fev/2020 (RGE SUL já com a RGE): 12,87%
        self.assertEqual(por_mes["2020-02"]["participacao_pct"], 12.87)
        self.assertEqual(por_mes["2020-02"]["excluidas_participacao"], 0)
        incs = {(i["mes_ruptura"], i["sigla_sucessora"]) for i in ts["incorporacoes"]}
        self.assertTrue({("2017-07", "ESS"), ("2018-05", "CPFL JAGUARI"), ("2020-02", "RGE SUL")} <= incs)
        mantidas = {(x["mes"], x["sigla"]) for x in ts["participacao_mantida_por_incorporacao"]}
        self.assertIn(("2020-02", "RGE SUL"), mantidas)

    def test_sigla_nao_informada(self):
        ts = self.g["tarifa_social"]
        creral = next(d for d in ts["distribuidoras"] if d["cnpj"] == "89435598000155")
        self.assertEqual(creral["sigla"], "CRERAL")
        self.assertFalse(any(d["sigla"] == "Não Informado" for d in ts["distribuidoras"]))

    def test_serie_antiga_sem_trimestre_repetido(self):
        ts = self.g["tarifa_social"]
        nov = next(x for x in ts["serie_antiga"]["comparacao_scs"] if x["m"] == "2018-11")
        self.assertEqual(nov["repete_trimestre"], "2018-09")
        t = next(t for t in ts["kpis"]["uc_tsee"]["evidencia"]["testes"] if "série antiga" in t["nome"])
        self.assertIn("fora da estatística por repetir o trimestre anterior no arquivo original: 2018-11", t["detalhe"])
        self.assertEqual(ts["serie_antiga"]["proveniencia"]["periodo_referencia"]["inicio"], "2012-03")

    def test_natureza_coerente_com_as_metricas(self):
        cat = {m["id"]: m for m in metricas_inclusao.METRICAS}
        self.assertEqual(self.g["acesso"]["proveniencia"]["pnad"]["natureza"], "ESTIMADO")
        self.assertEqual(cat["inclusao.pnad_com_energia"]["natureza_fonte"], "ESTIMADO")
        self.assertEqual(self.g["orcamento"]["proveniencia"]["sidra"]["natureza"], "ESTIMADO")
        self.assertEqual(self.g["orcamento"]["proveniencia"]["microdados"]["natureza"], "ESTIMADO")
        self.assertEqual(cat["inclusao.pof_media_razoes"]["natureza_transformacao"], "ESTIMADO")

    def test_medidas_publicadas_tem_definicao(self):
        ids = {m["id"] for m in metricas_inclusao.METRICAS}
        for mid in ("inclusao.tsee_variacao_12m", "inclusao.tsee_dmr_12m", "inclusao.cde_desconto_medio_fatura",
                    "inclusao.cde_desconto_liquido", "inclusao.pof_sensibilidade_renda", "inclusao.tsee_faixas_consumo"):
            self.assertIn(mid, ids)

    def test_serie_nacional_e_participacao(self):
        ts = self.g["tarifa_social"]
        por_mes = {l["m"]: l for l in ts["serie_mensal"]}
        # SCS mai/2025, soma direta das modalidades no arquivo de 20/09/2026: 17.246.524 UC em 102 distribuidoras
        self.assertEqual(ts["mes_referencia"], "2025-05")
        self.assertEqual(por_mes["2025-05"]["uc_tsee"], 17246524)
        self.assertEqual(por_mes["2025-05"]["distribuidoras"], 102)
        self.assertFalse(por_mes["2025-04"]["completo"])   # CERAL-DIS ausente
        self.assertTrue(por_mes["2024-01"]["completo"])    # EBO incorporada não é falta
        ev_part = ts["kpis"]["participacao_pct"]["evidencia"]
        self.assertAlmostEqual(ev_part["valor_calculo"],
                               100 * ev_part["numerador"]["valor"] / ev_part["denominador"]["valor"], places=2)
        # CSV de download: modalidades somam o total em todos os meses; participação entre 0 e 100
        caminho = os.path.join(RAIZ, "public", "energia", "series", "inclusao_tsee_mensal.csv")
        with open(caminho, encoding="utf-8") as f:
            for l in csv.DictReader(f, delimiter=";"):
                soma = sum(float(l[f"uc_{m}"] or 0) for m in mod.MODS)
                self.assertAlmostEqual(soma, float(l["uc_tsee"] or 0), places=3)
                if l["participacao_pct"]:
                    self.assertTrue(0 < float(l["participacao_pct"]) < 100)

    def test_mapa_uf_soma_total(self):
        ts = self.g["tarifa_social"]
        mm = next(m for m in ts["cde_meses"] if m["mes"] == ts["mes_mapa"])
        self.assertEqual(sum(u["faturas_tsee"] for u in ts["ufs"]) + mm["faturas_municipio_invalido"], mm["faturas_tsee"])

    def test_cobertura_rotulada_como_proxy(self):
        cob = self.g["cobertura"]
        self.assertEqual(cob["natureza_da_medida"], "PROXY")
        self.assertTrue(cob["brasil"]["proxy"])
        self.assertFalse(any("fora" in k for k in cob["brasil"]))  # nenhuma contagem de "famílias fora"
        self.assertLessEqual(cob["brasil"]["razao_cadastradas_pct"], cob["brasil"]["razao_atualizadas_pct"])
        # série mensal longa fora da gold, no JSON sob demanda, com o último ponto na gold
        with open(os.path.join(RAIZ, "public", "energia", "series", "inclusao_cobertura_mensal.json"), encoding="utf-8") as f:
            serie = json.load(f)["serie"]
        self.assertEqual(cob["serie_mensal_json"], "/energia/series/inclusao_cobertura_mensal.json")
        self.assertEqual(len(serie), cob["serie_mensal_meses"])
        self.assertEqual(serie[-1], cob["serie_mensal_ultimo"])
        # o numerador são faturas: a ficha não pode chamar a unidade de UC
        evid = cob["brasil"]["evidencia"]
        self.assertTrue(evid["unidade"].startswith("faturas"))
        self.assertIn("faturas", evid["indicador"])
        self.assertNotIn("UC", evid["unidade"])

    def test_pof_reconciliada_com_6715(self):
        conf = self.g["orcamento"]["conferencia"]
        self.assertEqual(conf["energia_ate_1_centavo"], conf["comparacoes"])
        br = next(x for x in conf["comparacoes_brasil"] if x["classe"] == "7999")
        self.assertEqual(br["energia_sidra"], 115.36)
        self.assertLess(abs(br["energia_micro"] - 115.36), 0.005 + 1e-9)
        linhas = {(l["territorio"], l["classe"]): l for l in self.g["orcamento"]["linhas"]}
        # classes de renda só em Brasil e regiões: nenhuma linha de UF por classe
        self.assertFalse(any(t not in ("BR",) and not t.startswith("RG-") and cl != "7999" for t, cl in linhas))
        baixa = linhas[("BR", "47558")]["microdados"]
        # média das razões (por família) difere da razão de médias (4,4% publicada)
        self.assertNotAlmostEqual(baixa["media_razoes_desp_pct"][0], baixa["razao_medias_pct"][0], places=1)
        self.assertAlmostEqual(baixa["razao_medias_pct"][0], 4.4, delta=0.05)

    def test_sensibilidade_da_media_na_renda_na_ficha(self):
        # reprodução independente dos microdados: média 6,879280442683096%, mediana 4,27%
        orc = self.g["orcamento"]
        f = orc["evidencias"]["media_razoes_renda_classe_baixa"]
        self.assertAlmostEqual(f["valor_calculo"], 6.879280442683096, places=9)
        self.assertIn("mediana da mesma participação 4,27%", f["cobertura"])
        sens = next(t for t in f["testes"] if "sensibilidade" in t["nome"])
        self.assertEqual(sens["resultado"], "ressalva")
        self.assertIn("despesa com energia acima da renda", sens["detalhe"])
        self.assertIn("despesa média com energia", f["reconciliacao"]["descricao"])
        s = orc["sensibilidade_media_razoes_renda"]["47558"]
        self.assertLess(s["media_sem_energia_acima_da_renda_pct"], s["media_razoes_renda_pct"])
        self.assertTrue(any("sem elas a média cai" in x for x in orc["proveniencia"]["microdados"]["limitacoes"]))

    def test_limiares_decrescentes(self):
        for l in self.g["orcamento"]["linhas"]:
            v = [l["microdados"][f"acima_{L}_renda_pct"][0] for L in (3, 5, 10) if f"acima_{L}_renda_pct" in l["microdados"]]
            v = [x for x in v if x is not None]
            self.assertEqual(v, sorted(v, reverse=True), l["territorio"])

    def test_acesso(self):
        ac = self.g["acesso"]
        br = next(l for l in ac["pnad_serie"] if l["territorio"] == "BR" and l["ano"] == "2025")
        self.assertEqual(br["domicilios_sem_energia_mil"], 135)
        # RR rural 2025: 20 − 20 mil com 0,7% sem energia não é zero
        rr = next(l for l in ac["pnad_situacao"] if l["territorio"] == "RR" and l["situacao"] == "rural")
        self.assertEqual((rr["domicilios_sem_energia_mil"], rr["domicilios_sem_energia_estado"]), (None, "menos_de_1_mil"))
        self.assertGreater(rr["pct_sem_energia"], 0)
        self.assertFalse(any(l["domicilios_sem_energia_mil"] == 0 for l in ac["pnad_serie"] + ac["pnad_situacao"]))
        iso = ac["sistemas_isolados"]
        self.assertEqual(iso["conferencia_pdf"]["resultado"], "aprovado")
        c25 = next(c for c in iso["ciclos"] if c["ciclo"] == "2025")
        self.assertEqual(c25["localidades"], 160)
        vibra = next(d for d in iso["por_distribuidora"] if d["distribuidora"] == "VIBRA ENERGIA")
        self.assertEqual((vibra["populacao"], vibra["localidades_sem_populacao"]), (None, 2))
        # ficha da população: 1.964.825 pessoas (soma das 158 informadas), PA-101 e PA-102 fora da soma,
        # reconciliada com o caderno em PDF (1,965 milhão; 160 localidades)
        evp = iso["evidencia_populacao"]
        self.assertEqual(ev.validar(evp), [])
        self.assertEqual(evp["valor_calculo"], 1964825)
        self.assertEqual(evp["exclusoes"], ["PA-101: população não informada", "PA-102: população não informada"])
        self.assertEqual(evp["reconciliacao"]["resultado"], "aprovado")
        lpt = ac["universalizacao"]["luz_para_todos"]
        self.assertEqual(sum(u["total"] for u in lpt["por_uf"]), lpt["evidencia_total"]["valor_calculo"])
        anos = {a["ano"]: a for a in lpt["serie_anual"]}
        self.assertEqual(anos["2017"]["recurso_distribuidora"], 0)   # 3 linhas com qtddomicilios = 0
        self.assertEqual(anos["2018"]["recurso_distribuidora"], 0)   # 2 linhas com qtddomicilios = 0
        self.assertIsNone(anos["2020"]["recurso_distribuidora"])      # nenhuma linha
        parciais = [a for a in lpt["serie_anual"] if a["parcial"]]
        self.assertEqual(len(parciais), 1)


if __name__ == "__main__":
    unittest.main()
