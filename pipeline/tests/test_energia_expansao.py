"""Testes do módulo Expansão da oferta e da rede (P040 a P043) com recortes reais, sem rede.

Recortes em pipeline/tests/dados/energia_expansao/, tirados dos arquivos oficiais capturados
em 30/09/2026 (linhas originais, bytes e codificação preservados):
- siga_recorte.csv: SIGA diário (UTF-8) com as usinas nucleares (Angra 1, 2 e 3), Agro Trafo
  (núcleo 000031 repetido na fonte), Itaipu, Estreito (municípios no MA e no TO), UIO
  (coordenada ,00000000), Portocém I e Granja XXXIII (entrada em operação 1900-01-03) e as
  usinas do recorte do RALIE;
- agregado_emp_operacao_utn.csv: agregado oficial "empreendimentos em operação" (tipo UTN);
- ralie_ug_atual_recorte.csv, ralie_usina_atual_recorte.csv: RALIE atual (fotografia de
  18/09/2026) das usinas 659, 30150, 37748 e 53607;
- ralie_ug_historico_recorte.parquet, ralie_usina_historico_recorte.parquet: Parquet histórico
  oficial filtrado às usinas 659, 27130, 28060, 29774, 30150, 37748 e 53607 (177 fotografias);
- liberacao_detalhado_recorte.csv e liberacao_resumido.csv: liberações comerciais (as linhas
  dessas usinas, as de UHE em 2022 e 2025 e de CGH em 2023, e grupos de unidades) e o resumo
  anual oficial inteiro;
- atos_recorte.csv (Latin-1): revogações, extinções, revogação de DRO e alterações;
- leiloes_transmissao_recorte.csv (Latin-1): os 18 lotes de 2024 e dois lotes com deságio
  publicado divergente;
- siget_*_recorte.csv: empreendimento 4409 (LT 230 kV Lechuga × Tarumã, circuito duplo, e SE
  Tarumã), 6394 (recondutoramento, obra de Adequação) e o bipolo Xingu × Terminal Rio;
- pde2035_dados_recorte.zip: planilha do Capítulo 03 do caderno de dados do PDE 2035 com as
  abas Índice, Figura 3-6 e Figura 3-25 (conteúdo das células intacto);
- pde2035_relatorio_p97_trecho.txt: texto da página 97 do relatório final (pdftotext);
- pde2035_relatorio_p526_anexo_i3.txt e pde2035_relatorio_p92.txt: páginas 526 (Anexo I-3, com a
  linha Itaipu 50 Hz e a categoria "PCH E CGH") e 92 (nota 17, MP 1.304/2025) do relatório final,
  extraídas com pdftotext -layout em 01/10/2026, sem edição;
- siga_conferencia_recorte.csv e atos_conferencia_recorte.csv: usinas e atos usados na conferência
  de potência dos encerramentos (Monjolinho 1486, CGH no SIGA e 'UHE' no ato, com 600 no campo de
  MW; Jurupará; Sucundurí e Axinim; Bahia Pulp; Surubim 1 com duas revogações; ato sem núcleo);
- leiloes_sem_vencedor_recorte.csv (Latin-1): lotes 1 a 3 do 001/2001 e os 17 do 007/2013, com
  'SEM LANCE', 'NÃO LEILOADO' e lotes contratados com 0 km ou 0 MVA;
- siget_contrato_agente_recorte.csv, siget_obras_contratos_recorte.csv e siget_lt_contratos_recorte.csv:
  contratos de concessão (recurso Contrato Agente) de 2007, 2024 e 2026, o contrato 013/2007 com o
  módulo 2791 em dois empreendimentos e o 001/2026 com dois circuitos de 5,81 km;
- siget_obras_reserva_recorte.csv e siget_eqp_reserva_recorte.csv: contrato 006/2024 (Nova Era Ceará),
  com dois transformadores principais de 900 MVA e um reserva de 300 MVA;
- siget_obras_prazo_revisto_recorte.csv: empreendimento 478 (LT Ibicoara / Brumado II), ato celebrado
  em 14/02/2009 e prazo vigente igual à data efetiva (31/03/2012);
- epe_rede_existente_recorte.json e epe_rede_planejada_recorte.json: feições do WebMap da EPE copiadas
  do GeoJSON capturado em 01/10/2026;
- ralie_ug_atual_bloco_20310915.csv.gz: 1.001 unidades do RALIE atual com previsão em 15/09/2031;
- ralie_ug_historico_atipicos_recorte.parquet e ralie_usina_historico_atipicos_recorte.parquet:
  Belvedere 1 (17 e 30/06/2021), Vapor 1 (16/04 e 09/05/2023) e todas as fotografias de U-50;
- siga_ampliacao_recorte.csv e liberacao_ampliacao_recorte.csv: U-50 (30438) no SIGA e suas liberações.

As reconciliações usam caminhos independentes: dois recursos oficiais do mesmo conjunto (CSV
atual contra Parquet histórico do RALIE; arquivo detalhado contra resumo anual de liberações;
SIGA contra o agregado oficial) ou releitura do arquivo original com código próprio (csv da
biblioteca padrão), sempre com os números esperados escritos no teste.
"""
import csv
import hashlib
import json
import os
import re
import sys
import unittest
import zipfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, evidencia, metricas  # noqa: E402
from pipeline.energia.fontes import aneel_expansao as ax  # noqa: E402
from pipeline.energia.fontes import ckan, epe_pde  # noqa: E402
from pipeline.energia.fontes import epe_rede_expansao as er  # noqa: E402
from pipeline.energia.metricas import expansao as metricas_expansao  # noqa: E402
from pipeline.energia.modulos import expansao as mx  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_expansao")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GOLD = os.path.join(RAIZ, "public", "energia", "gold", "expansao.json")

# (dataset do silver, recurso como no portal, arquivo do recorte)
RECORTES = [
    (mx.DS_SIGA, "siga-empreendimentos-geracao-diario.csv", "siga_recorte.csv"),
    (mx.DS_RALIE, "ralie-usina-atual.csv", "ralie_usina_atual_recorte.csv"),
    (mx.DS_RALIE, "ralie-unidade-geradora-atual.csv", "ralie_ug_atual_recorte.csv"),
    (mx.DS_RALIE, "ralie-usina-historico.parquet", "ralie_usina_historico_recorte.parquet"),
    (mx.DS_RALIE, "ralie-unidade-geradora-historico.parquet", "ralie_ug_historico_recorte.parquet"),
    (mx.DS_LIB, "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv", "liberacao_detalhado_recorte.csv"),
    (mx.DS_LIB, "unidades-geradoras-liberadas-operacao-comercial-resumido.csv", "liberacao_resumido.csv"),
    (mx.DS_ATOS, "atos-outorgas-aneel.csv", "atos_recorte.csv"),
    (mx.DS_LEILOES, "resultado-leiloes-transmissao.csv", "leiloes_transmissao_recorte.csv"),
    (mx.DS_SIGET, "siget-contrato-empreendimento-obra-modulo.csv", "siget_obras_recorte.csv"),
    (mx.DS_SIGET, "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv", "siget_lt_recorte.csv"),
    (mx.DS_SIGET, "siget-contrato-moduloequipamento-subestacao.csv", "siget_eqp_recorte.csv"),
    (mx.DS_AGREG, "empreendimento-operacao-historico.csv", "agregado_emp_operacao_utn.csv"),
]


_SAIDAS_ORIGINAIS = {}


def setUpModule():
    """Os blocos da gold escrevem os CSV de download (base.escreve_csv): durante os testes,
    as saídas vão para um diretório temporário, nunca para public/energia (que guarda a
    publicação real feita a partir do silver completo)."""
    import tempfile
    tmp = tempfile.mkdtemp(prefix="teste-expansao-")
    _SAIDAS_ORIGINAIS.update(SERIES=base.SERIES, GOLD=base.GOLD, tmp=tmp)
    base.SERIES = os.path.join(tmp, "series")
    base.GOLD = os.path.join(tmp, "gold")
    os.makedirs(base.SERIES)
    os.makedirs(base.GOLD)


def tearDownModule():
    import shutil
    base.SERIES = _SAIDAS_ORIGINAIS["SERIES"]
    base.GOLD = _SAIDAS_ORIGINAIS["GOLD"]
    shutil.rmtree(_SAIDAS_ORIGINAIS["tmp"], ignore_errors=True)


def _caminho(nome):
    return os.path.join(DADOS, nome)


def _csv_proprio(nome, encoding="utf-8"):
    """Leitura independente do módulo: csv da biblioteca padrão, sem ckan nem aneel_expansao."""
    with open(_caminho(nome), encoding=encoding, newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _num(txt):
    """Número com vírgula decimal, lido à parte do ckan.numero_br."""
    txt = (txt or "").strip()
    return float(txt.replace(".", "").replace(",", ".")) if "," in txt else float(txt) if txt else None


def _silver_dos_recortes(recortes=RECORTES):
    """Silver em memória com cada recorte registrado como vintage e integrado pelo próprio
    módulo (mesmo caminho da coleta real, sem rede)."""
    con = base.conecta(":memory:")
    for i, (ds, rec, nome) in enumerate(recortes):
        caminho = _caminho(nome)
        with open(caminho, "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
        vid, _ = base.registra_vintage(con, ds, rec, "recorte", f"2026-09-30T22:{i:02d}:00Z", "2026-09-18T21:05:07Z",
                                       sha, os.path.getsize(caminho), "teste", caminho)
        v = base.ultima_vintage(con, ds, rec)
        mx._integra(con, ds, rec, v)
    con.commit()
    return con


class ReconciliacaoCaminhoIndependente(unittest.TestCase):
    """Números do módulo contra outro recurso oficial ou contra releitura própria do arquivo."""

    def test_ralie_csv_atual_igual_ao_parquet_historico_na_mesma_fotografia(self):
        # recurso 1: CSV atual relido com csv da biblioteca padrão
        atual = {}
        for r in _csv_proprio("ralie_ug_atual_recorte.csv"):
            self.assertEqual(r["DatRalie"], "2026-09-18")
            atual[(int(r["IdeNucleoCEG"]), int(r["NumUgUsina"]))] = (_num(r["MdaPotenciaUnitaria"]),
                                                                     r["DatPrevisaoOpComercialSFG"] or None)
        # recurso 2: Parquet histórico pelo caminho do módulo (fotografias mensais em lotes)
        pf = ax.abre_parquet(_caminho("ralie_ug_historico_recorte.parquet"))
        t = ax.ug_mensal(pf, ["2026-09-18"])
        hist = {(r["IdeNucleoCEG"], r["NumUgUsina"]): (r["MdaPotenciaUnitaria"],
                                                       r["DatPrevisaoOpComercialSFG"].isoformat() if r["DatPrevisaoOpComercialSFG"] else None)
                for r in t.to_pylist()}
        self.assertEqual(atual, hist)
        # valores concretos da fonte: Portocém I tem 4 unidades de 392.972 kW, previsões de
        # 03/11/2026 a 30/12/2026; soma igual à potência outorgada publicada no SIGA
        portocem = {k: v for k, v in atual.items() if k[0] == 37748}
        self.assertEqual(sum(v[0] for v in portocem.values()), 1_571_888.0)
        self.assertEqual(sorted(v[1] for v in portocem.values()), ["2026-11-03", "2026-11-18", "2026-12-02", "2026-12-30"])
        siga = {int(r["IdeNucleoCEG"]): r for r in _csv_proprio("siga_recorte.csv")}
        self.assertEqual(_num(siga[37748]["MdaPotenciaOutorgadaKw"]), 1_571_888.0)
        # Angra 3 (30150) e Capivari (659) sem previsão: ausência, não data
        self.assertIsNone(atual[(30150, 1)][1])
        self.assertIsNone(atual[(659, 4)][1])

    def test_liberacao_detalhada_reconcilia_com_o_resumo_anual_oficial(self):
        linhas, _, _ = ax.le_liberacao(ckan.le_csv_bronze(_caminho("liberacao_detalhado_recorte.csv")))
        resumo = {(r["AnoReferencia"], r["SigTipoGeracao"]): _num(r["MdaSomaPotenciaMW"])
                  for r in _csv_proprio("liberacao_resumido.csv")}
        # o campo do resumo se chama MW, mas desde 2014 os valores estão em kW
        esperado = {("2022", "UHE"): 154_400.0, ("2025", "UHE"): 49_998.0, ("2023", "CGH"): 11_350.0}
        for (ano, tipo), kw in esperado.items():
            soma = sum(x["kw"] for x in linhas if (x["comercial_realizado"] or "")[:4] == ano and x["tipo"] == tipo)
            self.assertAlmostEqual(soma, kw, places=6, msg=(ano, tipo))
            self.assertAlmostEqual(resumo[(ano, tipo)], kw, places=6, msg=(ano, tipo))

    def test_siga_nuclear_reconcilia_com_o_agregado_oficial(self):
        con = _silver_dos_recortes()
        siga = mx._estado(con, mx.DS_SIGA, "usina:")
        agreg = mx._agregados(con)
        # agregado relido à parte: UTN em jun/2026 = 1.990.000 kW (MesReferencia "6 " com espaço na fonte)
        proprio = {(r["AnoReferencia"], r["MesReferencia"].strip()): _num(r["MdaPotenciaInstaladaKW"])
                   for r in _csv_proprio("agregado_emp_operacao_utn.csv")}
        self.assertEqual(proprio[("2026", "6")], 1_990_000.0)
        self.assertEqual(agreg["emp_op"]["2026-06"]["UTN"], 1_990_000.0)
        lib, _ = mx._liberacoes(mx._estado(con, mx.DS_LIB, "lib:"))
        cap = mx._bloco_capacidade(siga, agreg, lib, "2026-09-30")
        utn = next(x for x in cap["reconciliacao"]["por_tipo"] if x["tipo"] == "UTN")
        # Angra 1 (640 MW) + Angra 2 (1.350 MW); Angra 3 está em Construção e não entra
        self.assertEqual((utn["siga_mw"], utn["agregado_mw"], utn["residuo_mw"]), (1990.0, 1990.0, 0.0))
        self.assertNotIn("UTN", cap["reconciliacao"]["fora_da_tolerancia"]["tipos"])

    def test_pde_figura_3_25_confere_com_os_totais_rotulados_no_relatorio(self):
        with zipfile.ZipFile(_caminho("pde2035_dados_recorte.zip")) as z:
            planilha = epe_pde.Planilha(z.read(z.namelist()[0]))
        fig = epe_pde.extrai_figura(planilha, epe_pde.FIGURAS_PDE2035["fig_3_25"])
        somas = {x["ref"]: sum(v for v in x["valores"].values() if v is not None) for x in fig["linhas"]}
        with open(_caminho("pde2035_relatorio_p97_trecho.txt"), encoding="utf-8") as f:
            trecho = f.read()
        rotulos = [int(x) for x in re.findall(r"(\d{3}) GW", trecho)]
        self.assertIn(249, rotulos)
        self.assertIn(359, rotulos)
        # o relatório rotula em GW inteiros: tolerância de 0,5 GW
        self.assertLessEqual(abs(somas["2025-12"] - 249), 0.5)
        self.assertLessEqual(abs(somas["2035-12"] - 359), 0.5)
        self.assertAlmostEqual(somas["2035-12"], 359.008, places=3)
        # figura 3-6: cerca de 251 GW em 2025 no texto da p. 72
        f36 = epe_pde.extrai_figura(planilha, epe_pde.FIGURAS_PDE2035["fig_3_6"])
        s25 = sum(v for v in next(x for x in f36["linhas"] if x["ref"] == "2025")["valores"].values() if v is not None)
        self.assertLessEqual(abs(s25 - 251), 1.0)

    def test_leiloes_de_2024_relidos_com_codigo_proprio(self):
        proprio = [r for r in _csv_proprio("leiloes_transmissao_recorte.csv", encoding="cp1252") if r["AnoLeilao"] == "2024"]
        km = sum(_num(r["MdaExtensaoLinhaTransmissaoKm"]) for r in proprio)
        mva = sum(_num(r["MdaSubEstacoesMVA"]) for r in proprio)
        edital = sum(_num(r["VlrRAPEditalLeilao"]) for r in proprio)
        venc = sum(_num(r["VlrRAPVencedorLeilao"]) for r in proprio)
        self.assertEqual(len(proprio), 18)
        self.assertAlmostEqual(km, 7246.96, places=2)
        self.assertEqual(mva, 10_200.0)
        con = _silver_dos_recortes([x for x in RECORTES if x[0] == mx.DS_LEILOES])
        bloco = mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), "2026-09-01")
        a24 = next(x for x in bloco["por_ano"] if x["ano"] == "2024")
        self.assertEqual((a24["lotes_ofertados"], a24["lotes_contratados"], a24["km"], a24["mva"]), (18, 18, 7247.0, 10200.0))
        self.assertEqual((a24["lotes_km_nao_informado"], a24["lotes_mva_nao_informado"]), (0, 0))
        self.assertEqual(a24["desagio_agregado_pct"], round(100 * (1 - venc / edital), 1))
        self.assertEqual(a24["desagio_agregado_pct"], 42.0)
        self.assertEqual(bloco["ultimo_leilao"], {"leilao": "002/2024", "data": "2024-09-27"})


class Robustez(unittest.TestCase):
    """Marcadores de ausência, repetições, grupos de unidades, grandezas e ordem de regras."""

    @classmethod
    def setUpClass(cls):
        cls.siga, cls.oc = ax.le_siga(ckan.le_csv_bronze(_caminho("siga_recorte.csv")))

    def test_marcadores_do_siga_viram_ausencia_e_repeticao_conta_uma_vez(self):
        self.assertEqual(self.oc["linhas"], 16)
        self.assertEqual(len(self.siga), 15)  # Agro Trafo (000031) aparece duas vezes na fonte
        self.assertEqual(self.oc["duplicadas_divergentes"] + [None] * self.oc["duplicadas_identicas"], [31])
        uio = next(u for u in self.siga.values() if u["nome"] == "UIO")
        self.assertIsNone(uio["lat"])
        self.assertIsNone(uio["lon"])
        angra3 = self.siga[30150]
        self.assertIsNone(angra3["entrada_operacao"])  # 1900-01-03 é marcador, não data
        self.assertEqual((angra3["fase"], angra3["estagio"], angra3["kw_fiscalizado"]), ("Construção", "construcao", 0.0))
        self.assertEqual(self.siga[53607]["estagio"], "construcao_nao_iniciada")
        self.assertIsNone(self.siga[1161]["garantia_fisica_kwmed"] and None)
        self.assertEqual(self.siga[1161]["kw_outorgado"], 7_000_000.0)

    def test_usina_multiestadual_fica_na_uf_principal_sem_dividir_potencia(self):
        estreito = self.siga[28863]
        self.assertEqual(estreito["uf"], "MA")
        self.assertEqual(ax.ufs_dos_municipios(estreito["municipios"]), ["MA", "TO"])
        siga = {str(k): v for k, v in self.siga.items()}
        cap = mx._bloco_capacidade(siga, {"emp_op": {}, "emp_op_refs": [], "cap_uf": {}, "cap_uf_refs": []}, [], "2026-09-30")
        self.assertEqual(cap["multiestaduais"], {"usinas": 1, "mw_fiscalizado": 1087.0})
        ma = next(x for x in cap["por_uf"] if x["uf"] == "MA")
        self.assertEqual(ma["mw_fiscalizado"], 1087.0)
        # no TO só Agro Trafo (14,04 MW), contada uma vez; nada de Estreito vai para o TO
        to = next(x for x in cap["por_uf"] if x["uf"] == "TO")
        self.assertEqual((to["usinas"], to["mw_fiscalizado"]), (1, 14.0))

    def test_grupos_de_unidades_expandidos_e_texto_nao_vinculado(self):
        self.assertEqual(ax.ugs_de("1 a 5"), {1, 2, 3, 4, 5})
        self.assertEqual(ax.ugs_de("1, 2 e 3"), {1, 2, 3})
        self.assertEqual(ax.ugs_de("1 a 3 e 5 a 7"), {1, 2, 3, 5, 6, 7})
        self.assertIsNone(ax.ugs_de("16 (desativada)"))
        self.assertIsNone(ax.ugs_de("5,6 e 8 A"))
        self.assertIsNone(ax.ugs_de(""))
        linhas, indice, nao = ax.le_liberacao(ckan.le_csv_bronze(_caminho("liberacao_detalhado_recorte.csv")))
        self.assertEqual(sorted(nao), ["16 (desativada)", "5,6 e 8 A"])
        grupo = [x for x in linhas if x["ug_bruto"] == "1 a 5"]
        self.assertTrue(grupo)
        # a potência do grupo nunca é dividida por unidade: fica na linha, e cada unidade do grupo
        # ganha a data de liberação para o vínculo com o RALIE
        g = grupo[0]
        self.assertTrue(all(indice[(g["nucleo"], u)] <= g["comercial_realizado"] for u in range(1, 6)))

    def test_numeros_da_fonte_com_virgula_ponto_e_ruido(self):
        self.assertEqual(ax.numero(",00"), 0.0)
        self.assertEqual(ax.numero("300.00"), 300.0)
        self.assertEqual(ax.numero("1.571.888,00"), 1_571_888.0)
        self.assertIsNone(ax.numero(""))
        enc = ax.le_encerramentos(ckan.le_csv_bronze(_caminho("atos_recorte.csv")))
        # só revogação de autorização e extinção de concessão; revogação de DRO e alterações ficam fora
        self.assertEqual(sorted({x["objeto"] for x in enc}), ["Autorização - Revogação", "Concessão - Extinção"])
        self.assertEqual(len(enc), 7)
        mws = sorted(x["mw"] for x in enc)
        # "3,8999999999999999" e "43,399999999999999" na fonte: ruído de ponto flutuante arredondado a 1 kW
        self.assertEqual(mws, [0.52, 1.6, 3.9, 30.0, 30.3, 38.8, 43.4])
        self.assertEqual(sum(1 for x in enc if x["publicacao"] is None), 1)  # Novo Horizonte: ato sem data
        self.assertTrue(any(x["nucleo"] is None and x["nome"] for x in enc))  # ato sem núcleo de CEG preservado

    def test_leiloes_desagio_fracao_e_divergencia_publicada(self):
        lotes = ax.le_leiloes_transmissao(ckan.le_csv_bronze(_caminho("leiloes_transmissao_recorte.csv")))
        l15 = next(x for x in lotes if (x["leilao"], x["lote"]) == ("001/2024", "15"))
        self.assertEqual((l15["km"], l15["mva"], l15["desagio_fracao"]), (509.0, 0.0, 0.34))  # lote só de linha: 0 MVA real
        con = _silver_dos_recortes([x for x in RECORTES if x[0] == mx.DS_LEILOES])
        bloco = mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), None)
        div = {x["lote"]: x for x in bloco["desagio_inconsistente"]}
        self.assertEqual(div["001/2009:2"]["desagio_fonte_pct"], 87.0)
        self.assertEqual(bloco["desagio_inconsistente_total"], 2)
        # ano sem lote no recorte é ausência (não aparece), nunca zero; o leilão 005/2016 foi
        # realizado em 2017 e entra no ano do leilão (AnoLeilao), não no ano do número
        self.assertEqual(sorted(x["ano"] for x in bloco["por_ano"]), ["2009", "2017", "2024"])

    def test_siget_km_de_circuito_mva_so_de_transformador_e_obra_de_instalacao(self):
        lts = ax.le_siget_linhas(ckan.le_csv_bronze(_caminho("siget_lt_recorte.csv")))
        # bipolo Xingu × Terminal Rio: dois módulos (circuitos 1 e 2) com a extensão da linha
        self.assertEqual((lts["28115"]["km"], lts["28116"]["km"]), (2539.0, 2539.0))
        con = _silver_dos_recortes([x for x in RECORTES if x[0] == mx.DS_SIGET])
        obras = mx._bloco_obras(mx._estado(con, mx.DS_SIGET, "epd:"), mx._estado(con, mx.DS_SIGET, "lt:"),
                                mx._estado(con, mx.DS_SIGET, "eqp:"), mx._estado(con, mx.DS_SIGET, "resolucao:"), "2026-09-29")
        emp = {x["id"]: x for x in obras["_emp"]}
        # 4409: LT 230 kV Lechuga × Tarumã em circuito duplo (2 × 12,5 km) e 2 transformadores de 300 MVA
        self.assertEqual((emp["4409"]["km_lt"], emp["4409"]["mva_tr"], emp["4409"]["ufs"]), (25.0, 600.0, ["AM"]))
        # prazo do ato legal 20/09/2026 vencido na data do arquivo (29/09/2026): 9 dias
        self.assertEqual((emp["4409"]["prazo_legal_vencido"], emp["4409"]["dias_desde_prazo_legal"]), (True, 9))
        # 6394: recondutoramento (obra de Adequação) altera linha existente e não soma km novo
        self.assertEqual((emp["6394"]["km_lt"], emp["6394"]["obras_outras"]), (0.0, 1))
        self.assertEqual(obras["em_andamento"]["km_lt_novas"], 25.0)
        self.assertEqual(obras["modulos_lt_fora_do_limite"], 0)
        self.assertIn("km de circuito", obras["definicao_km"])

    def test_confiabilidade_com_data_base_da_fotografia(self):
        pf = ax.abre_parquet(_caminho("ralie_ug_historico_recorte.parquet"))
        pfu = ax.abre_parquet(_caminho("ralie_usina_historico_recorte.parquet"))
        mensais = ax.ultimo_por_mes(ax.datas_ralie(pfu))
        _, indice, _ = ax.le_liberacao(ckan.le_csv_bronze(_caminho("liberacao_detalhado_recorte.csv")))
        ugm = ax.ug_mensal(pf, mensais)
        conf = ax.confiabilidade_previsoes(ugm, ax.tabela_liberacoes(indice), mensais, "2026-09-18")
        s = conf[0]
        self.assertEqual((s["ralie"], s["fim_janela"]), ("2021-06-30", "2022-06-30"))
        # fotografia de 30/06/2021: Da Mata (29774, 50 MW, previsão 08/10/2021) liberada em 22/03/2022,
        # no prazo; Curuá-Una (27130, 12,5 MW) liberada em 30/09/2022, depois; Capivari (659, 648 kW)
        # nunca liberada; São Luiz (28060) já liberada em 2001: sai do denominador
        self.assertEqual((s["kw_prometido"], s["kw_no_prazo"], s["kw_depois"], s["kw_nao_liberado"]),
                         (63_148.0, 50_000.0, 12_500.0, 648.0))
        self.assertEqual((s["ugs_excluidas_ja_liberadas"], s["kw_excluido_ja_liberado"]), (1, 12_000.0))
        for x in conf:
            self.assertAlmostEqual(x["kw_no_prazo"] + x["kw_depois"] + x["kw_nao_liberado"], x["kw_prometido"], places=6)
            self.assertLessEqual(date.fromisoformat(x["fim_janela"]).toordinal() + 15, date(2026, 9, 18).toordinal())

    def test_leitura_em_lotes_igual_a_leitura_inteira(self):
        pf = ax.abre_parquet(_caminho("ralie_ug_historico_recorte.parquet"))
        pfu = ax.abre_parquet(_caminho("ralie_usina_historico_recorte.parquet"))
        mensais = ax.ultimo_por_mes(ax.datas_ralie(pfu))
        inteiro = (ax.agrega_historico_ug(pf), ax.trajetorias_usinas(pf, pfu), ax.ugs_da_primeira_aparicao(pf),
                   ax.ug_mensal(pf, mensais).num_rows)
        original = ax.LOTE_PARQUET
        try:
            ax.LOTE_PARQUET = 7  # 1.265 linhas em 181 lotes: agregados parciais recombinados
            lotes = (ax.agrega_historico_ug(pf), ax.trajetorias_usinas(pf, pfu), ax.ugs_da_primeira_aparicao(pf),
                     ax.ug_mensal(pf, mensais).num_rows)
        finally:
            ax.LOTE_PARQUET = original
        self.assertEqual(inteiro[0], lotes[0])
        self.assertEqual(inteiro[1], lotes[1])
        self.assertEqual({k: sorted(v) for k, v in inteiro[2].items()}, {k: sorted(v) for k, v in lotes[2].items()})
        self.assertEqual(inteiro[3], lotes[3])
        self.assertEqual(inteiro[2][37748], [(1, 392_972.0), (2, 392_972.0), (3, 392_972.0), (4, 392_972.0)])

    def test_mediana_ponderada(self):
        self.assertEqual(ax.mediana_ponderada([(10, 1), (20, 1), (30, 2)]), 20)
        self.assertEqual(ax.mediana_ponderada([(10, 3), (20, 1)]), 10)
        self.assertEqual(ax.mediana_ponderada([(5, 0), (7, None), (9, 1)]), 9)  # peso nulo ou zero ignorado
        self.assertIsNone(ax.mediana_ponderada([]))

    def test_desfechos_seguem_a_ordem_publicada(self):
        con = _silver_dos_recortes()
        pf = ax.abre_parquet(_caminho("ralie_ug_historico_recorte.parquet"))
        pfu = ax.abre_parquet(_caminho("ralie_usina_historico_recorte.parquet"))
        trajs = ax.trajetorias_usinas(pf, pfu)
        prim = ax.ugs_da_primeira_aparicao(pf)
        _, idx = mx._liberacoes(mx._estado(con, mx.DS_LIB, "lib:"))
        siga = mx._estado(con, mx.DS_SIGA, "usina:")
        enc = mx._estado(con, mx.DS_ATOS, "enc:")
        d = mx._desfechos(trajs, prim, idx, siga, enc, "2026-09-18")
        self.assertEqual({n: x["desfecho"] for n, x in d.items()}, {
            659: "em_implantacao", 30150: "em_implantacao", 37748: "em_implantacao", 53607: "em_implantacao",
            29774: "operacao", 28060: "operacao", 27130: "operacao",
            27982: "outorga_encerrada", 40644: "outorga_encerrada"})
        # Cascata (27982): revogação publicada em 15/04/2025, depois da primeira aparição (17/06/2021)
        self.assertEqual((d[27982]["data_encerramento"], d[27982]["encerramento_sem_data"]), ("2025-04-15", False))
        # Novo Horizonte (40644): revogação (despacho 3.169) sem data de publicação na fonte
        self.assertEqual((d[40644]["data_encerramento"], d[40644]["encerramento_sem_data"]), (None, True))
        # Curuá-Una (27130): a extinção de 03/10/2016 é anterior à primeira aparição e não encerra a
        # trajetória; sem SIGA e sem liberações, fica sem desfecho (nunca operação presumida)
        self.assertIsNone(d[27130]["data_encerramento"])
        d2 = mx._desfechos(trajs, prim, {}, {}, enc, "2026-09-18")
        self.assertEqual((d2[27130]["desfecho"], d2[29774]["desfecho"]), ("sem_desfecho", "sem_desfecho"))
        # coortes: participações somam 100% da potência outorgada na primeira fotografia
        for co in mx._bloco_coortes(d, "2021-06-17"):
            self.assertAlmostEqual(sum(x["mw_outorgado"] for x in co["desfechos"].values()), co["mw_outorgado"], places=0)

    def test_integracao_idempotente_e_gold_minima_vira_stub(self):
        con = _silver_dos_recortes()
        v = base.ultima_vintage(con, mx.DS_RALIE, "ralie-unidade-geradora-atual.csv")
        antes = con.execute("SELECT COUNT(*) FROM registros").fetchone()[0]
        mx._integra(con, mx.DS_RALIE, "ralie-unidade-geradora-atual.csv", v)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM registros").fetchone()[0], antes)
        # previsão por unidade guardada com histórico próprio (campo dedicado no silver)
        hist = base.historico_registro(con, mx.DS_RALIE, "ug:37748:1", "previsao_sfg")
        self.assertEqual([x[1] for x in hist], ["2026-12-30"])
        # 15 usinas no SIGA: a validação física e de esquema recusa a publicação (sentinela mantém a anterior)
        g = mx.construir(con, {"hoje": date(2026, 9, 30)})
        self.assertFalse(g["disponivel"])
        self.assertIn("SIGA com apenas 15 usinas", g["motivo"])


def _texto(nome, encoding="utf-8"):
    with open(_caminho(nome), encoding=encoding) as f:
        return f.read()


class CenariosContraOAnexoI3(unittest.TestCase):
    """P043: a UHE das figuras inclui a parte paraguaia de Itaipu e a PCH inclui CGH (Anexo I-3)."""

    @classmethod
    def setUpClass(cls):
        cls.anexo = epe_pde.extrai_anexo_i3(_texto("pde2035_relatorio_p526_anexo_i3.txt"), primeira_pagina=526)

    def test_anexo_i3_lido_do_pdf_com_itaipu_50hz_separada(self):
        a = self.anexo
        self.assertEqual(a["pagina"], 526)
        self.assertEqual(a["anos"][0], "2026")
        self.assertEqual(a["anos"][-1], "2035")
        lin = a["linhas"]
        # valores do texto da página, em MW
        self.assertEqual((lin["hidreletrica"]["2026"], lin["hidreletrica"]["2035"]), (102_423.0, 105_345.0))
        self.assertEqual((lin["itaipu_50hz"]["2026"], lin["itaipu_50hz"]["2032"], lin["itaipu_50hz"]["2035"]), (7_000.0, 7_700.0, 7_700.0))
        self.assertEqual((lin["pch_e_cgh"]["2026"], lin["pch_e_cgh"]["2035"]), (7_605.0, 11_762.0))
        self.assertIsNone(lin["bateria"]["2026"])  # '-' na tabela é ausência, não zero
        self.assertIn("Paraguai", a["notas"]["6"])
        self.assertIn("autoprodução", a["notas"]["1"])

    def test_figuras_do_caderno_conferem_com_o_anexo_do_relatorio(self):
        # caminho independente: planilha XML do caderno de dados contra o texto do PDF
        with zipfile.ZipFile(_caminho("pde2035_dados_recorte.zip")) as z:
            planilha = epe_pde.Planilha(z.read(z.namelist()[0]))
        f325 = {x["ref"]: x["valores"] for x in epe_pde.extrai_figura(planilha, epe_pde.FIGURAS_PDE2035["fig_3_25"])["linhas"]}
        f36 = {x["ref"]: x["valores"] for x in epe_pde.extrai_figura(planilha, epe_pde.FIGURAS_PDE2035["fig_3_6"])["linhas"]}
        lin = self.anexo["linhas"]
        # UHE da Figura 3-25 = Hidrelétrica do SIN + Itaipu 50 Hz (máquinas paraguaias)
        self.assertAlmostEqual(f325["2035-12"]["UHE (GW)"] * 1000, lin["hidreletrica"]["2035"] + lin["itaipu_50hz"]["2035"], delta=0.5)
        self.assertAlmostEqual(f325["2025-12"]["UHE (GW)"], 109.423, places=3)
        self.assertAlmostEqual(f36["2026"]["UHE"] * 1000, lin["hidreletrica"]["2026"] + lin["itaipu_50hz"]["2026"], delta=1.0)
        # PCH das figuras = 'PCH E CGH' do anexo
        self.assertAlmostEqual(f325["2035-12"]["PCH (GW)"] * 1000, lin["pch_e_cgh"]["2035"], delta=0.5)
        self.assertAlmostEqual(f36["2026"]["PCH"] * 1000, lin["pch_e_cgh"]["2026"], delta=0.5)

    def test_camadas_comparam_o_siga_sem_a_parcela_paraguaia_e_com_cgh(self):
        con = base.conecta(":memory:")
        vid, _ = base.registra_vintage(con, mx.DS_PDE, "pde2035_relatorio_final_aprovado.pdf", "recorte", "2026-09-30T22:22:59Z",
                                       None, "0" * 64, 1, "teste", _caminho("pde2035_relatorio_p526_anexo_i3.txt"))
        mx._integra_anexo_i3(con, mx.DS_PDE, vid, _texto("pde2035_relatorio_p526_anexo_i3.txt"), primeira_pagina=526)
        with zipfile.ZipFile(_caminho("pde2035_dados_recorte.zip")) as z:
            planilha = epe_pde.Planilha(z.read(z.namelist()[0]))
        linhas = []
        for fig in ("fig_3_6", "fig_3_25"):
            for x in epe_pde.extrai_figura(planilha, epe_pde.FIGURAS_PDE2035[fig])["linhas"]:
                linhas += [(f"pde2035.{fig}.{col}", x["ref"], v) for col, v in x["valores"].items()]
        base.grava_observacoes(con, mx.DS_PDE, vid, linhas)
        con.commit()
        siga, _ = ax.le_siga(ckan.le_csv_bronze(_caminho("siga_recorte.csv")))
        siga = {str(k): v for k, v in siga.items()}
        cen = mx._bloco_cenarios(con, mx._series(con, mx.DS_PDE, "pde2035."), siga, {}, {}, None, None)
        cam = {x["categoria"]: x for x in cen["camadas"]}
        uhe = cam["UHE"]
        self.assertEqual(uhe["correspondencia"], "parcial")
        self.assertEqual((uhe["pde_anexo_i3"]["dez2026_gw"], uhe["pde_anexo_i3"]["dez2035_gw"]), (102.423, 105.345))
        self.assertEqual((uhe["pde_anexo_i3"]["parcela_fora_do_siga"]["dez2026_gw"],
                          uhe["pde_anexo_i3"]["parcela_fora_do_siga"]["dez2035_gw"]), (7.0, 7.7))
        # o SIGA só tem a parte brasileira de Itaipu (7.000 MW), que entra no realizado
        self.assertEqual(siga["1161"]["kw_outorgado"], 7_000_000.0)
        self.assertGreaterEqual(uhe["realizado_siga_gw"], 7.0)
        self.assertEqual(cam["PCH"]["siga_tipos"], ["PCH", "CGH"])
        self.assertEqual(cam["PCH"]["pde_anexo_i3"]["dez2035_gw"], cam["PCH"]["pde_dez2035_gw"])
        self.assertTrue(cen["anexo_i3"]["conferencia_figuras"])
        self.assertTrue(all(x["resultado"] == "aprovada" for x in cen["anexo_i3"]["conferencia_figuras"]))
        self.assertEqual(cen["anexo_i3"]["pagina"], 526)

    def test_hipotese_da_lei_14182_com_a_ressalva_da_pagina_92(self):
        p92 = _texto("pde2035_relatorio_p92.txt")
        self.assertIn("1.304/2025", p92)
        self.assertIn("15.269/2025", p92)
        h = next(x for x in mx.HIPOTESES_PDE2035 if "14.182" in x["texto"])
        self.assertEqual(h["pagina_ressalva"], 92)
        self.assertIn("1.304/2025", h["ressalva"])
        self.assertIn("15.269/2025", h["ressalva"])


class TransformadorReservaEConvencaoDoMva(unittest.TestCase):
    """P042: o transformador reserva não é capacidade nova; o leilão recente informa só o principal."""

    def test_reserva_fora_do_mva_novo_e_igual_ao_lote_do_leilao(self):
        eq = ax.le_siget_equipamentos(ckan.le_csv_bronze(_caminho("siget_eqp_reserva_recorte.csv")))
        self.assertEqual((eq["42900"]["mva"], eq["42903"]["mva"]), (900.0, 900.0))
        self.assertEqual((eq["42906"]["mva"], eq["42906"]["mva_reserva"]), (None, 300.0))
        rec = [(mx.DS_SIGET, "siget-contrato-agente.csv", "siget_contrato_agente_recorte.csv"),
               (mx.DS_SIGET, "siget-contrato-empreendimento-obra-modulo.csv", "siget_obras_reserva_recorte.csv"),
               (mx.DS_SIGET, "siget-contrato-moduloequipamento-subestacao.csv", "siget_eqp_reserva_recorte.csv")]
        con = _silver_dos_recortes(rec)
        epds = mx._estado(con, mx.DS_SIGET, "epd:")
        bloco = mx._bloco_contratos(mx._estado(con, mx.DS_SIGET, "ccd:"), epds, {}, mx._estado(con, mx.DS_SIGET, "eqp:"),
                                    "2024-09-27", "2026-09-29")
        with open(os.path.join(base.SERIES, "expansao_contratos_transmissao.csv"), encoding="utf-8") as f:
            linha = next(r for r in csv.DictReader(f, delimiter=";") if r["contrato"] == "6862")
        self.assertEqual((float(linha["mva_tr_novos"]), float(linha["mva_tr_reserva"])), (1800.0, 300.0))
        a24 = next(x for x in bloco["por_ano"] if x["ano"] == "2024")
        self.assertEqual((a24["mva_tr_novos"], a24["mva_tr_reserva"]), (1800.0, 300.0))
        # leilão 001/2024, lote 3 (Nova Era Ceará), relido à parte: 1.800 MVA, só o principal
        lote3 = next(r for r in _csv_proprio("leiloes_transmissao_recorte.csv", encoding="cp1252")
                     if (r["NumLeilao"], r["NumLoteLeilao"]) == ("001/2024", "3"))
        self.assertEqual(_num(lote3["MdaSubEstacoesMVA"]), 1800.0)
        # obras em andamento: principal e reserva em campos separados
        obras = mx._bloco_obras(epds, {}, mx._estado(con, mx.DS_SIGET, "eqp:"), {}, "2026-09-29")
        self.assertEqual((obras["em_andamento"]["mva_tr_novos"], obras["em_andamento"]["mva_tr_reserva"]), (1800.0, 300.0))

    def test_leilao_antigo_soma_a_reserva_no_campo_mva(self):
        # 007/2013, lote 16: 'TR 440/138/13,8 kV 1ø, (6+1) ...' com 700 MVA no campo: a convenção mudou
        lotes = ax.le_leiloes_transmissao(ckan.le_csv_bronze(_caminho("leiloes_sem_vencedor_recorte.csv")))
        l16 = next(x for x in lotes if (x["leilao"], x["lote"]) == ("007/2013", "16"))
        self.assertIn("(6+1)", l16["empreendimento"])
        self.assertEqual(l16["mva"], 700.0)
        con = _silver_dos_recortes([x for x in RECORTES if x[0] == mx.DS_LEILOES])
        bloco = mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), None)
        self.assertIn("reserva", bloco["nota_mva"])


class LeiloesComCamposNaoPreenchidos(unittest.TestCase):
    def test_lote_contratado_sem_km_e_ausencia_contada_a_parte(self):
        rec = [(mx.DS_LEILOES, "resultado-leiloes-transmissao.csv", "leiloes_sem_vencedor_recorte.csv")]
        con = _silver_dos_recortes(rec)
        bloco = mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), None)
        a01 = next(x for x in bloco["por_ano"] if x["ano"] == "2001")
        # lote 1 (137,1 km), lote 2 SEM LANCE (fora), lote 3 'LT Itumbiara - Marimbondo 500 kV, 212 km'
        # contratado com 0,00 km na fonte: ausência contada, nunca 0 somado sem rótulo
        self.assertEqual((a01["lotes_ofertados"], a01["lotes_contratados"], a01["lotes_sem_vencedor"]), (3, 2, 1))
        self.assertEqual((a01["km"], a01["lotes_km_nao_informado"]), (137.1, 1))
        lotes = {(x["leilao"], x["lote"]): x for x in mx._estado(con, mx.DS_LEILOES, "lote:").values()}
        self.assertIsNone(lotes[("001/2001", "3")].get("km"))
        # lote 4 do 007/2013, só de linha, sem MVA descrito: 0 MVA é zero real
        self.assertEqual(lotes[("007/2013", "4")].get("mva"), 0.0)
        self.assertIsNone(lotes[("007/2013", "14")].get("km"))  # 'LT Rio Branco I - Feijó ... 357 km' com 0 km
        a13 = next(x for x in bloco["por_ano"] if x["ano"] == "2013")
        # releitura própria: 7 lotes do 007/2013 com SEM LANCE ou NÃO LEILOADO
        proprio = [r for r in _csv_proprio("leiloes_sem_vencedor_recorte.csv", encoding="cp1252") if r["NumLeilao"] == "007/2013"]
        self.assertEqual(a13["lotes_sem_vencedor"], sum(1 for r in proprio if r["NomVencedorLeilao"].upper() in ("SEM LANCE", "NÃO LEILOADO")))
        self.assertEqual(a13["lotes_sem_vencedor"], 7)


class ContratosDoSiget(unittest.TestCase):
    def test_contratos_por_assinatura_com_cnpj_e_objeto_original(self):
        cc = ax.le_siget_contratos(ckan.le_csv_bronze(_caminho("siget_contrato_agente_recorte.csv")))
        self.assertEqual(cc["6468"]["cnpj"], "08806925000136")  # fonte sem o zero à esquerda
        self.assertEqual((cc["6468"]["assinatura"], cc["6468"]["fim"]), ("2007-10-09", "2037-10-09"))
        rec = [(mx.DS_SIGET, "siget-contrato-agente.csv", "siget_contrato_agente_recorte.csv"),
               (mx.DS_SIGET, "siget-contrato-empreendimento-obra-modulo.csv", "siget_obras_contratos_recorte.csv"),
               (mx.DS_SIGET, "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv",
                "siget_lt_contratos_recorte.csv")]
        con = _silver_dos_recortes(rec)
        bloco = mx._bloco_contratos(mx._estado(con, mx.DS_SIGET, "ccd:"), mx._estado(con, mx.DS_SIGET, "epd:"),
                                    mx._estado(con, mx.DS_SIGET, "lt:"), {}, "2024-09-27", "2026-09-29")
        por = {x["ano"]: x for x in bloco["por_ano"]}
        # 2025 sem contrato no recurso: zero observado (o recurso lista todos os contratos)
        self.assertEqual(por["2025"]["contratos"], 0)
        self.assertEqual(por["2026"]["contratos"], 22)
        self.assertTrue(por["2026"]["ano_parcial"])
        with open(os.path.join(base.SERIES, "expansao_contratos_transmissao.csv"), encoding="utf-8") as f:
            linhas = {r["contrato"]: r for r in csv.DictReader(f, delimiter=";")}
        # 013/2007: o módulo 2791 (115 km) aparece em dois empreendimentos e conta uma vez
        self.assertEqual((linhas["6468"]["empreendimentos"], float(linhas["6468"]["km_lt_novas"])), ("2", 115.0))
        # 001/2026: dois circuitos de 5,81 km
        self.assertAlmostEqual(float(linhas["6880"]["km_lt_novas"]), 11.62, places=6)
        # contrato sem empreendimento cadastrado: km e MVA ausentes, não zero
        self.assertEqual((linhas["6857"]["km_lt_novas"], linhas["6857"]["mva_tr_novos"]), ("", ""))


class DesvioEmRelacaoAoPrazoVigente(unittest.TestCase):
    def test_prazo_vigente_igual_a_data_efetiva_e_contado(self):
        rec = [(mx.DS_SIGET, "siget-contrato-empreendimento-obra-modulo.csv", "siget_obras_prazo_revisto_recorte.csv")]
        con = _silver_dos_recortes(rec)
        epds = mx._estado(con, mx.DS_SIGET, "epd:")
        # releitura própria: ato celebrado em 14/02/2009, prazo vigente e data efetiva em 31/03/2012
        r = _csv_proprio("siget_obras_prazo_revisto_recorte.csv")[0]
        self.assertEqual((r["DatCaoCgmAtoLgl"], r["DatOprComEpd"], r["DatEfeOprComEpd"]), ("14/02/2009", "31/03/2012", "31/03/2012"))
        obras = mx._bloco_obras(epds, {}, {}, {}, "2026-09-29")
        self.assertNotIn("atraso_realizado_por_ano", obras)
        a12 = obras["desvio_prazo_vigente_por_ano"]["por_ano"][0]
        self.assertEqual((a12["ano"], a12["empreendimentos"], a12["empreendimentos_data_efetiva_igual_ao_prazo"],
                          a12["mediana_desvio_dias"]), ("2012", 1, 1, 0.0))
        self.assertIn("não atraso", obras["desvio_prazo_vigente_por_ano"]["definicao"])


class RedeDaEpe(unittest.TestCase):
    def test_comprimento_pela_geometria_e_ano_zero_como_ausencia(self):
        with open(_caminho("epe_rede_existente_recorte.json"), encoding="utf-8") as f:
            ex = json.load(f)
        regs = {r["objectid"]: r for r in er.normaliza(ex["features"], "existente")}
        f0 = ex["features"][0]
        r0 = regs[f0["properties"]["OBJECTID"]]
        # comprimento refeito à parte (haversine, raio médio) sobre as coordenadas publicadas
        import math
        km = 0.0
        for (lo1, la1), (lo2, la2) in zip(f0["geometry"]["coordinates"], f0["geometry"]["coordinates"][1:]):
            p1, p2, dl = math.radians(la1), math.radians(la2), math.radians(lo2 - lo1)
            h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            km += 2 * 6371.0088 * math.asin(math.sqrt(h))
        self.assertAlmostEqual(r0["km_geometria"], km, places=6)
        # e confere com o campo Extensao da fonte (82,59 km) dentro de 1% (geometria generalizada)
        self.assertLess(abs(r0["km_geometria"] - f0["properties"]["Extensao"]) / f0["properties"]["Extensao"], 0.01)
        self.assertEqual((r0["ano"], r0["tensao_kv"]), (2019, 230.0))
        # LT Firminópolis - Trindade fica em Goiás na malha de UF publicada
        with open(os.path.join(RAIZ, "public", "energia", "geo", "uf.json"), encoding="utf-8") as f:
            loc = er.LocalizadorUF(json.load(f))
        uf = er.km_por_uf([r0], loc)
        self.assertEqual(set(uf), {"GO"})
        with open(_caminho("epe_rede_planejada_recorte.json"), encoding="utf-8") as f:
            pl = json.load(f)
        anos = {r["nome"]: r["ano"] for r in er.normaliza(pl["features"], "planejada")}
        self.assertEqual(anos["LT 230 kV Paraíso 2 - Chapadão, C3"], 2037)
        brutos = [x["properties"].get("Ano_Planej") for x in pl["features"]]
        self.assertTrue(all(anos[x["properties"]["Nome"].strip()] is None for x in pl["features"] if x["properties"].get("Ano_Planej") == 0)
                        or 0 not in brutos)


class DataEmBlocoNaFotografiaAtual(unittest.TestCase):
    def test_data_atribuida_a_cem_usinas_ou_mais_e_convencional(self):
        ugs, datas = ax.le_ralie_ug(ckan.le_csv_bronze(_caminho("ralie_ug_atual_bloco_20310915.csv.gz")))
        ralie_ug = {f"{k[0]}:{k[1]}": x for k, x in ugs.items()}
        usinas = {k.split(":")[0] for k, x in ralie_ug.items() if x.get("previsao_sfg") == "2031-09-15"}
        self.assertGreaterEqual(len(usinas), ax.MINIMO_USINAS_DATA_EM_BLOCO)
        self.assertIn("2031-09-15", mx.datas_em_bloco_atual(ralie_ug))
        # com o mínimo acima do número de usinas do recorte, a mesma data deixa de ser bloco
        self.assertNotIn("2031-09-15", mx.datas_em_bloco_atual(ralie_ug, minimo=len(usinas) + 1))


class ConferenciaDosAtosDeEncerramento(unittest.TestCase):
    def test_potencia_conferida_e_tipo_do_ato_ao_lado_do_cadastro(self):
        rec = [(mx.DS_SIGA, "siga-empreendimentos-geracao-diario.csv", "siga_conferencia_recorte.csv"),
               (mx.DS_ATOS, "atos-outorgas-aneel.csv", "atos_conferencia_recorte.csv")]
        con = _silver_dos_recortes(rec)
        siga = mx._estado(con, mx.DS_SIGA, "usina:")
        bloco = mx._bloco_encerramentos(mx._estado(con, mx.DS_ATOS, "enc:"), siga, {}, "2026-09-30")
        pc_ = bloco["potencia_conferida"]
        corr = {z["nome"]: z for z in pc_["corrigidas_kw"]}
        # Monjolinho (1486): 600 no campo de MW, 600 kW no SIGA, CGH (limite legal de 5 MW)
        self.assertEqual((corr["Monjolinho"]["mw_usado"], corr["Monjolinho"]["tipo"], corr["Monjolinho"]["tipo_no_cadastro"]),
                         (0.6, "UHE", "CGH"))
        self.assertIn("CGH", corr["Monjolinho"]["motivo"])
        self.assertEqual({z["nome"] for z in pc_["fora_da_soma"]}, {"Jurupará"})
        # por_tipo é o tipo do ato (a outorga encerrada); por_tipo_no_cadastro, o atual do SIGA
        por_ato = {x["tipo"]: x for x in bloco["por_tipo"]}
        por_cad = {x["tipo"]: x for x in bloco["por_tipo_no_cadastro"]}
        self.assertIn("UHE", por_ato)
        self.assertIn("CGH", por_cad)
        self.assertEqual(bloco["tipo_do_ato_diferente_do_cadastro"]["atos"], 2)  # Monjolinho e Jurupará (UHE no ato, CGH no SIGA)
        # Surubim 1: duas revogações, uma usina; ato sem núcleo conta à parte
        self.assertEqual(bloco["repeticoes"]["usinas_com_mais_de_um_ato"], 1)
        self.assertEqual(bloco["sem_chave_de_usina"]["atos"], 1)


class UnidadesForaDeEscalaEAmpliacoes(unittest.TestCase):
    """P040/P041: unidades com potência fora de escala no Parquet histórico e ampliações nas coortes."""

    @classmethod
    def setUpClass(cls):
        cls.pf = ax.abre_parquet(_caminho("ralie_ug_historico_atipicos_recorte.parquet"))
        cls.pfu = ax.abre_parquet(_caminho("ralie_usina_historico_atipicos_recorte.parquet"))

    def test_soma_das_unidades_dez_vezes_a_outorga_e_conferida_nas_vizinhas(self):
        at = ax.unidades_atipicas(self.pf, self.pfu)
        casos = {(x["ralie"], x["nucleo"]): x for x in at["casos"]}
        self.assertEqual(set(casos), {("2021-06-17", 40686), ("2023-04-16", 53545)})
        bel = casos[("2021-06-17", 40686)]
        # Belvedere 1: 14 unidades somando 44.999.920 kW para 45.000 kW outorgados; na fotografia
        # seguinte (30/06/2021) as mesmas 14 unidades somam 45.000,06 kW
        self.assertEqual((bel["ugs"], bel["kw_ugs"], bel["kw_outorgado"]), (14, 44_999_920.0, 45_000.0))
        self.assertEqual(bel["seguinte"]["ralie"], "2021-06-30")
        self.assertAlmostEqual(bel["seguinte"]["kw_ugs"], 45_000.06, places=2)
        vap = casos[("2023-04-16", 53545)]
        # Vapor 1: 333 unidades em 16/04/2023, 33 em 09/05/2023, sempre 49.500 kW outorgados
        self.assertEqual((vap["ugs"], vap["kw_ugs"], vap["seguinte"]["ugs"], vap["seguinte"]["kw_ugs"]), (333, 499_500.0, 33, 49_500.0))
        self.assertIsNone(vap["anterior"])  # primeira fotografia da usina
        # U-50 tem a soma das unidades abaixo da outorga (ampliação): não é atípica
        self.assertNotIn(30438, {n for _, n in casos})
        # exclusão: as linhas dos dois pares saem; as demais ficam
        ugm = ax.ug_mensal(self.pf, ["2021-06-17", "2021-06-30", "2023-04-16", "2023-05-09"])
        sem = ax.exclui_pares(ugm, set(casos))
        self.assertEqual(ugm.num_rows - sem.num_rows, 14 + 333)

    def test_ampliacao_so_entra_em_operacao_com_as_unidades_liberadas(self):
        rec = [(mx.DS_SIGA, "siga-empreendimentos-geracao-diario.csv", "siga_ampliacao_recorte.csv"),
               (mx.DS_LIB, "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv", "liberacao_ampliacao_recorte.csv")]
        con = _silver_dos_recortes(rec)
        siga = mx._estado(con, mx.DS_SIGA, "usina:")
        lib, idx = mx._liberacoes(mx._estado(con, mx.DS_LIB, "lib:"))
        # releitura própria: U-50 em operação no SIGA desde 27/10/2015 com 100.000 kW (unidades 1 e 2)
        s = _csv_proprio("siga_ampliacao_recorte.csv")[0]
        self.assertEqual((s["DscFaseUsina"], s["DatEntradaOperacao"], _num(s["MdaPotenciaFiscalizadaKw"])), ("Operação", "2015-10-27", 100_000.0))
        self.assertEqual(sorted(r["NumUgUsina"] for r in _csv_proprio("liberacao_ampliacao_recorte.csv")), ["1", "2"])
        trajs = ax.trajetorias_usinas(self.pf, self.pfu)
        prim = ax.ugs_da_primeira_aparicao(self.pf)
        lib_primeira = {}
        for x in lib:
            lib_primeira[x["nucleo"]] = min(lib_primeira.get(x["nucleo"], "9999"), x["realizado"])
        at = {(x["ralie"], x["nucleo"]) for x in ax.unidades_atipicas(self.pf, self.pfu)["casos"]}
        d = mx._desfechos(trajs, prim, idx, siga, {}, "2026-09-18", lib_primeira, at)
        u50 = d[30438]
        # a unidade 3 da ampliação (50.000 kW) nunca foi liberada; a fase Operação do SIGA é da
        # parte antiga: não é operação
        self.assertEqual(prim[30438], [(3, 50_000.0)])
        self.assertTrue(u50["operava_antes"])
        self.assertEqual(u50["desfecho"], "sem_desfecho")
        # peso: a ampliação (50.000 kW), não a outorga total da usina (150.000 kW)
        self.assertEqual((u50["kw_primeira"], u50["kw_peso"]), (150_000.0, 50_000.0))
        # Belvedere 1: peso limitado à outorga (as unidades da primeira fotografia somam 45 GW)
        self.assertEqual(d[40686]["kw_peso"], 45_000.0)
        self.assertTrue(d[40686]["primeira_atipica"])
        # se a usina não operasse antes da primeira fotografia, a fase Operação do SIGA bastaria:
        # é a regra das ampliações que muda o desfecho
        siga_nova = {k: {**v, "entrada_operacao": None} for k, v in siga.items()}
        d0 = mx._desfechos(trajs, prim, idx, siga_nova, {}, "2026-09-18")
        self.assertEqual((d0[30438]["operava_antes"], d0[30438]["desfecho"]), (False, "operacao"))


class ContratoDaGoldPublicada(unittest.TestCase):
    """Contrato de public/energia/gold/expansao.json e dos CSV de download (sem refazer contas)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(GOLD):
            raise unittest.SkipTest("gold do módulo Expansão ainda não gerada")
        with open(GOLD, encoding="utf-8") as f:
            cls.texto = f.read()
        cls.g = json.loads(cls.texto)
        if not cls.g.get("disponivel"):
            raise unittest.SkipTest("gold do módulo Expansão indisponível (stub)")

    def test_gold_publicada_tem_os_campos_que_o_codigo_emite(self):
        """Os blocos refeitos pelo código atual a partir dos recortes têm de ter as mesmas chaves que
        a gold publicada: gold gerada por versão anterior do código (como a de 01/10/2026 00:52, sem
        lotes_km_nao_informado) falha aqui."""
        g = self.g
        con = _silver_dos_recortes()
        siga = mx._estado(con, mx.DS_SIGA, "usina:")
        lib, idx = mx._liberacoes(mx._estado(con, mx.DS_LIB, "lib:"))
        pares = []
        # leilões
        lei = mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), None)
        pares += [("leiloes", lei, g["transmissao"]["leiloes"]),
                  ("leiloes.por_ano", lei["por_ano"][0], g["transmissao"]["leiloes"]["por_ano"][0])]
        # obras e contratos do SIGET
        con_c = _silver_dos_recortes([(mx.DS_SIGET, "siget-contrato-agente.csv", "siget_contrato_agente_recorte.csv"),
                                      (mx.DS_SIGET, "siget-contrato-empreendimento-obra-modulo.csv", "siget_obras_contratos_recorte.csv"),
                                      (mx.DS_SIGET, "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv",
                                       "siget_lt_contratos_recorte.csv")])
        epds = mx._estado(con_c, mx.DS_SIGET, "epd:")
        lts = mx._estado(con_c, mx.DS_SIGET, "lt:")
        obras = mx._bloco_obras(epds, lts, {}, {}, "2026-09-29")
        obras.pop("_emp")
        go = g["transmissao"]["obras"]
        pares += [("obras", obras, go), ("obras.em_andamento", obras["em_andamento"], go["em_andamento"]),
                  ("obras.por_situacao", obras["por_situacao"][0], go["por_situacao"][0]),
                  ("obras.entrada_por_ano", obras["entrada_por_ano"][0], go["entrada_por_ano"][0]),
                  ("obras.desvio", obras["desvio_prazo_vigente_por_ano"], go["desvio_prazo_vigente_por_ano"]),
                  ("obras.desvio.por_ano", obras["desvio_prazo_vigente_por_ano"]["por_ano"][0],
                   go["desvio_prazo_vigente_por_ano"]["por_ano"][0])]
        cc = mx._bloco_contratos(mx._estado(con_c, mx.DS_SIGET, "ccd:"), epds, lts, {}, "2024-09-27", "2026-09-29")
        gc = g["transmissao"]["contratos_assinados"]
        pares += [("contratos", cc, gc), ("contratos.por_ano", cc["por_ano"][0], gc["por_ano"][0]),
                  ("contratos.depois", cc["depois_do_ultimo_leilao_do_arquivo"]["contratos"][0],
                   gc["depois_do_ultimo_leilao_do_arquivo"]["contratos"][0])]
        # encerramentos
        enc = mx._bloco_encerramentos(mx._estado(con, mx.DS_ATOS, "enc:"), siga, {}, "2026-09-30")
        ge = g["estagios"]["encerramentos"]
        pares += [("encerramentos", enc, ge), ("encerramentos.por_ano", enc["por_ano"][0], ge["por_ano"][0])]
        # capacidade e reconciliação
        cap = mx._bloco_capacidade(siga, mx._agregados(con), lib, "2026-09-30", "2026-09-16")
        pares += [("capacidade.reconciliacao", cap["reconciliacao"], g["capacidade_instalada"]["reconciliacao"])]
        # desfechos, coortes e série mensal (Parquet recortado)
        pf = ax.abre_parquet(_caminho("ralie_ug_historico_recorte.parquet"))
        pfu = ax.abre_parquet(_caminho("ralie_usina_historico_recorte.parquet"))
        d = mx._desfechos(ax.trajetorias_usinas(pf, pfu), ax.ugs_da_primeira_aparicao(pf), idx, siga,
                          mx._estado(con, mx.DS_ATOS, "enc:"), "2026-09-18", {}, set())
        co = mx._bloco_coortes(d, "2021-06-17")[0]
        gco = g["estagios"]["coortes"][0]
        pares += [("coortes", co, gco), ("coortes.desfechos", co["desfechos"]["operacao"], gco["desfechos"]["operacao"])]
        mensais = ax.ultimo_por_mes(ax.datas_ralie(pfu))
        hm = mx._historico_mensal(con, mensais, [])
        pares += [("historico_mensal", hm[0], g["estagios"]["historico_mensal"][0])]
        for nome, codigo, gold in pares:
            self.assertEqual(set(codigo), set(gold), nome)

    def test_tamanho_json_estrito_e_selo_de_cenario(self):
        self.assertLess(len(self.texto.encode("utf-8")), 400 * 1024)
        json.loads(self.texto, parse_constant=lambda c: self.fail(f"constante não JSON: {c}"))
        self.assertEqual(self.g["cenarios"]["selo"], "CENÁRIO")
        self.assertEqual(self.g["proveniencia"]["cenarios"]["natureza"], "CENARIO")
        self.assertTrue(all(x["resultado"] in ("aprovada", "divergente") for x in self.g["cenarios"]["conferencia_relatorio"]))

    def test_evidencias_validas_pelo_contrato_central(self):
        self.assertGreaterEqual(len(self.g["evidencias"]), 8)
        for chave, ev in self.g["evidencias"].items():
            self.assertEqual(evidencia.validar(ev), [], chave)

    def test_proveniencia_com_limitacoes_e_calculado_com_formula(self):
        for chave, p in self.g["proveniencia"].items():
            self.assertTrue(p["limitacoes"], chave)
            if p["natureza"] == "CALCULADO":
                self.assertTrue(p["formula"], chave)

    def test_grandezas_de_transmissao_em_campos_separados(self):
        for linha in self.g["transmissao"]["geracao_e_rede_por_uf"]:
            self.assertEqual(set(linha), {"uf", "mw_ugs_em_implantacao", "mw_previsto_24_meses", "km_lt_em_andamento_toca_uf",
                                          "mva_tr_em_andamento", "empreendimentos_transmissao_em_andamento",
                                          "km_rede_existente_epe", "km_rede_planejada_epe"})
        anos = self.g["transmissao"]["serie_anual"]
        ult = self.g["transmissao"]["leiloes"]["ultimo_leilao"]["data"][:4]
        # depois do último leilão do arquivo: ausência (null), nunca zero
        depois = [x for x in anos if x["ano"] > ult]
        self.assertTrue(depois)
        self.assertTrue(all(x["km_contratados_leilao"] is None and x["mva_contratados_leilao"] is None for x in depois))

    def test_tabela_por_uf_inclui_as_ufs_da_rede_da_epe(self):
        # AC e DF só têm rede da EPE em 01/10/2026: entram com zero observado no RALIE e no SIGET
        ufs = {x["uf"] for x in self.g["transmissao"]["geracao_e_rede_por_uf"]}
        rede = self.g["transmissao"]["rede_epe"]
        for camada in ("existente", "planejada"):
            self.assertLessEqual({x["uf"] for x in rede[camada]["por_uf"]}, ufs, camada)
        self.assertLessEqual(ufs, set(ax.UFS))

    def test_leiloes_publicam_os_lotes_com_km_ou_mva_nao_informados(self):
        # o código emite lotes_km_nao_informado e lotes_mva_nao_informado por ano: a gold publicada
        # de 01/10/2026 00:52 saiu de versão anterior e não os tinha (nulo somado como zero sem rótulo)
        lei = self.g["transmissao"]["leiloes"]
        for x in lei["por_ano"]:
            self.assertIn("lotes_km_nao_informado", x, x["ano"])
            self.assertIn("lotes_mva_nao_informado", x, x["ano"])
        self.assertEqual(lei["lotes_km_nao_informado"], sum(x["lotes_km_nao_informado"] for x in lei["por_ano"]))
        self.assertEqual(lei["lotes_mva_nao_informado"], sum(x["lotes_mva_nao_informado"] for x in lei["por_ano"]))
        self.assertGreater(lei["lotes_km_nao_informado"], 0)

    def test_desvio_do_prazo_vigente_reconstruivel_pela_gold(self):
        # denominador dos percentuais (potência com data outorgada) publicado ao lado
        for x in self.g["cronograma"]["desvio_prazo_vigente"]["por_ano"]:
            self.assertEqual(x["unidades_ou_grupos"], x["unidades_ou_grupos_com_data_outorgada"] + x["unidades_ou_grupos_sem_data_outorgada"])
            self.assertAlmostEqual(x["mw_liberado"], x["mw_com_data_outorgada"] + x["mw_sem_data_outorgada"], delta=0.11)
            if x["mw_com_data_outorgada"]:
                # gold arredonda MW a 0,1: o percentual refeito pode variar na segunda casa
                self.assertAlmostEqual(x["pct_mw_depois_do_prazo"], 100 * x["mw_depois_do_prazo"] / x["mw_com_data_outorgada"], delta=0.1)

    def test_obras_do_siget_sem_atraso_sem_data_base(self):
        obras = self.g["transmissao"]["obras"]
        self.assertFalse([k for k in obras if "atraso" in k])
        for x in obras["desvio_prazo_vigente_por_ano"]["por_ano"]:
            self.assertLessEqual(x["empreendimentos_data_efetiva_igual_ao_prazo"], x["empreendimentos"])
        # reserva em campo próprio, nunca dentro do MVA novo
        for x in obras["por_situacao"] + obras["entrada_por_ano"]:
            self.assertIn("mva_tr_reserva", x)
        self.assertIn("mva_tr_reserva", obras["em_andamento"])

    def test_reconciliacao_declara_a_janela_das_liberacoes(self):
        ref = self.g["referencias"]
        for chave in ("janela_tipo", "janela_uf"):
            j = self.g["capacidade_instalada"]["reconciliacao"][chave]
            self.assertEqual(j["liberacoes_descontadas"]["fim"], min(ref["liberacoes_ultima_data"], ref["siga"]))
            if ref["liberacoes_ultima_data"] < ref["siga"]:
                self.assertEqual(j["sem_liberacoes_publicadas"]["fim"], ref["siga"])
                self.assertEqual(date.fromisoformat(j["sem_liberacoes_publicadas"]["inicio"]).toordinal(),
                                 date.fromisoformat(ref["liberacoes_ultima_data"]).toordinal() + 1)
        texto = self.g["evidencias"]["capacidade_total"]["reconciliacao"]["descricao"]
        self.assertIn(f"{date.fromisoformat(ref['liberacoes_ultima_data']):%d/%m/%Y}", texto)

    def test_cenarios_uhe_sem_itaipu_paraguaia_e_pch_com_cgh(self):
        cam = {x["categoria"]: x for x in self.g["cenarios"]["camadas"]}
        uhe = cam["UHE"]
        self.assertEqual(uhe["correspondencia"], "parcial")
        self.assertIn("Itaipu 50 Hz", uhe["nota"])
        self.assertEqual(uhe["pde_anexo_i3"]["pagina"], 526)
        par = uhe["pde_anexo_i3"]["parcela_fora_do_siga"]
        # a figura é a soma das duas linhas do anexo, em dez/2035
        self.assertAlmostEqual(uhe["pde_dez2035_gw"], uhe["pde_anexo_i3"]["dez2035_gw"] + par["dez2035_gw"], places=3)
        self.assertEqual(set(cam["PCH"]["siga_tipos"]), {"PCH", "CGH"})
        self.assertNotIn("não informa se as inclui", cam["PCH"]["nota"] or "")
        self.assertTrue(all(x["resultado"] == "aprovada" for x in self.g["cenarios"]["anexo_i3"]["conferencia_figuras"]))
        lei = next(h for h in self.g["cenarios"]["hipoteses"] if "14.182" in h["texto"])
        self.assertIn("1.304/2025", lei["ressalva"])
        self.assertEqual(lei["pagina_ressalva"], 92)

    def test_historico_mensal_sem_unidades_fora_de_escala(self):
        # antes da correção, 16/04/2023 tinha as unidades acima da outorga (Fótons de São Mauro,
        # Vapor 1, São Miguel IV, Cobra 9): a série não carrega o erro, e o excluído é publicado
        ua = self.g["estagios"]["unidades_atipicas"]
        self.assertTrue(all(x["razao"] >= ua["fator"] for x in ua["casos"]))
        mensais = {x["ralie"] for x in ua["casos"] if x["fotografia_mensal"]}
        for x in self.g["estagios"]["historico_mensal"]:
            self.assertEqual(x["usinas_atipicas_excluidas"] > 0, x["ralie"] in mensais, x["ralie"])
            self.assertLessEqual(x["mw_ugs"], x["mw_outorgado"], x["ralie"])
        self.assertTrue(any("estagios.unidades_atipicas" in r for r in self.g["ressalvas"]))

    def test_previsoes_publicadas_com_data_base(self):
        for nome in ("expansao_carteira_ralie.csv", "expansao_unidades_ralie.csv"):
            caminho = os.path.join(RAIZ, "public", "energia", "series", nome)
            self.assertLess(os.path.getsize(caminho), 5 * 1024 * 1024)
            with open(caminho, encoding="utf-8") as f:
                leitor = csv.DictReader(f, delimiter=";")
                bases = {r["data_base_ralie"] for r in leitor}
            self.assertEqual(bases, {self.g["referencias"]["ralie"]}, nome)

    def test_estagios_disjuntos_e_outorga_separada_da_operacao(self):
        resumo = {x["estagio"]: x for x in self.g["estagios"]["resumo"]}
        self.assertEqual(resumo["operacao"]["usinas"], self.g["capacidade_instalada"]["total"]["usinas"])
        self.assertEqual(resumo["construcao_nao_iniciada"]["mw_fiscalizado"], 0.0)


class SemEfeitoNaPublicacao(unittest.TestCase):
    def test_blocos_escrevem_no_diretorio_temporario(self):
        self.assertNotEqual(os.path.realpath(base.SERIES), os.path.realpath(os.path.join(RAIZ, "public", "energia", "series")))
        con = _silver_dos_recortes([x for x in RECORTES if x[0] == mx.DS_LEILOES])
        mx._bloco_leiloes(mx._estado(con, mx.DS_LEILOES, "lote:"), None)
        self.assertTrue(os.path.exists(os.path.join(base.SERIES, "expansao_leiloes_transmissao.csv")))


class Metricas(unittest.TestCase):
    def test_definicoes_validas_e_ligadas_a_gold(self):
        ids = [m["id"] for m in metricas_expansao.METRICAS]
        self.assertEqual(len(ids), len(set(ids)))
        for m in metricas_expansao.METRICAS:
            self.assertEqual(metricas.validar(m), [], m["id"])
            self.assertEqual(m["gold"], "expansao.json")
            self.assertTrue(set(m["fontes"]) <= {d["dataset_silver"] for d in mx.REGISTRO["datasets"]}, m["id"])
        cen = next(m for m in metricas_expansao.METRICAS if m["id"] == "expansao_pde_cenarios")
        self.assertEqual(cen["natureza_transformacao"], "CENARIO")


if __name__ == "__main__":
    unittest.main()
