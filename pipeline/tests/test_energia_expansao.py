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
- pde2035_relatorio_p97_trecho.txt: texto da página 97 do relatório final (pdftotext).

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
        self.assertEqual((a24["lotes"], a24["km"], a24["mva"]), (18, 7247.0, 10200.0))
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
                                          "mva_tr_em_andamento", "empreendimentos_transmissao_em_andamento"})
        anos = self.g["transmissao"]["serie_anual"]
        ult = self.g["transmissao"]["leiloes"]["ultimo_leilao"]["data"][:4]
        # depois do último leilão do arquivo: ausência (null), nunca zero
        self.assertTrue(all(x["km_leiloados"] is None for x in anos if x["ano"] > ult))

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
