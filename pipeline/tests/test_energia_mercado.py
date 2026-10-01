"""Testes do módulo Mercado (P032 a P035) com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_mercado/ (tirados dos arquivos oficiais em 01/10/2026):
- epe_consumo_mensal_recorte.xlsx: as linhas reais de Dados_abertos_Consumo_Mensal.xlsx (EPE) de
  julho de 2026 e de janeiro de 2004 (aba CONSUMO E NUMCONS SAM) e de junho de 2026 para DF, RR e
  SP (aba CONSUMO E NUMCONS SAM UF), regravadas numa planilha mínima com as mesmas abas e colunas;
- samp_2025_12_recorte.parquet: linhas reais do samp-2025.parquet (ANEEL) de dezembro de 2025 da
  CEMIG-D (grande) e da CERAL Anitápolis (pequena), opções CATIVO, LIVRE e GERAÇÃO, métricas de
  energia, consumidores e receita total;
- conta_bandeira_recorte.csv: linhas reais da base Conta Bandeira (ANEEL): CEMIG-D (ago/2024 e
  jun/2026), EAC (ago/2024), uma linha sem CNPJ (jun/2018) e as duas linhas da CODESAM de mai/2020
  (mesma distribuidora e competência);
- arquivos anuais inteiros (pequenos) de conjuntos da CCEE: consumo por ambiente e por classe,
  geração e garantia física do MRE, MRE mensal, encargos (ESS, resposta da demanda, pagamento),
  liquidação e agentes contabilizados;
- lista_agente_associado_2026_recorte.csv: todas as linhas de 2026 de sete CNPJ (entradas, saídas,
  saída e volta, estáveis); desligamento_*_recorte.csv: linhas com e sem sucessão;
- infomercado_206_recorte.txt e infomercado_229_recorte.txt: texto (pdftotext -layout) da primeira
  página e do parágrafo de encargos do InfoMercado mensal de agosto de 2024 e de julho de 2026,
  com as quebras de página preservadas; ccee_mercado_mensal_recorte.html: os dois campos da página
  Mercado Mensal que apontam a edição corrente;
- mme_boletim_junho_2026_recorte.txt e mme_boletim_marco_2026_recorte.txt: texto das tabelas de
  consumo por ambiente e por classe e de encargos de serviços do sistema das edições de junho e de
  março de 2026 do Boletim Mensal de Monitoramento do Sistema Elétrico (MME);
- mme_consolidacao_2025_recorte.txt: trechos (com as quebras de página) do PDF público
  "Consolidação 2025" do boletim do MME (sumário, quadro do mercado consumidor e encargos);
- parcela_carga_consumo_recorte.csv: linhas reais de julho de 2026 do conjunto PARCELA_CARGA_CONSUMO
  (todas as 139 parcelas de perfis Distribuidor, todas as 18 de Exportador e 10 de cada classe de
  consumidor) e cinco de fevereiro de 2025 com o ramo de atividade vazio em perfil que não é de
  distribuidora, só com as colunas lidas; lista_perfil_recorte.csv: a classe de cada perfil
  envolvido, do cadastro LISTA_PERFIL_V1;
- samp_2026_elektro_recorte.parquet: todas as linhas de energia e de consumidores (CATIVO e LIVRE)
  da ELEKTRO em junho e julho de 2026 no samp-2026.parquet (julho veio sem linhas LIVRE e com as
  linhas CATIVO Regular iguais às de junho);
- arquivos anuais inteiros de 2023 (consumo por classe) e 2025 (liquidação, pagamento, ESS,
  geração e MRE) e o de 2026 do pagamento.

Os números esperados vêm de publicações independentes dos arquivos lidos pelo módulo (planilha
formatada da EPE, InfoMercado em PDF, boletim do MME) ou de releitura por código próprio (pyarrow
nos Parquet, csv nos CSV), e estão escritos nos testes.
"""
import csv
import io
import os
import shutil
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import metricas  # noqa: E402
from pipeline.energia.fontes import aneel_mercado as am  # noqa: E402
from pipeline.energia.fontes import ccee_mercado as cm  # noqa: E402
from pipeline.energia.fontes import epe_mercado as em  # noqa: E402
from pipeline.energia.fontes import mme_mercado as mm  # noqa: E402
from pipeline.energia.metricas import mercado as metricas_mercado  # noqa: E402
from pipeline.energia.modulos import mercado as mod  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_mercado")
CEMIG, CERAL, EAC, CODESAM = "06981180000116", "75826404000138", "04065033000170", "11810343000138"


def _caminho(nome):
    return os.path.join(DADOS, nome)


def _csv(nome, sep=";"):
    """Linhas do CSV como dicts, lidas com o módulo csv (sem as funções do módulo Mercado)."""
    with open(_caminho(nome), "rb") as f:
        bruto = f.read()
    try:
        texto = bruto.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = bruto.decode("latin-1")
    return list(csv.DictReader(io.StringIO(texto), delimiter=sep))


def _obs(nome):
    """Observações {(série, mês): valor} de um arquivo anual da CCEE pelo leitor do coletor."""
    conj = nome.rsplit("_", 1)[0]
    spec = cm.CONJUNTOS[conj]
    linhas = _csv(nome, spec.get("separador", ";"))
    cm.confere_cabecalho(list(linhas[0].keys()), spec["colunas"])
    return {(s, m): v for s, m, v in cm.leitor_mensal(linhas, spec["colunas"], spec.get("dims", ()))}


def _texto(nome):
    with open(_caminho(nome), encoding="utf-8") as f:
        return f.read()


# ======================================================================= P032: EPE

class EpeContraPlanilhaFormatada(unittest.TestCase):
    """A tabela longa dos dados abertos lida pelo módulo tem de dar o total nacional que a EPE
    publica na planilha formatada 'CONSUMO MENSAL DE ENERGIA ELÉTRICA POR CLASSE.xlsx' (aba TOTAL,
    linha TOTAL BRASIL; aba LIVRE, linha TOTAL LIVRE; aba CATIVO; abas de consumidores), julho de
    2026, valores conferidos nas células da planilha original."""

    PLANILHA_JUL_2026 = {"total_mwh": 46896044.066, "livre_mwh": 21884509.776, "cativo_mwh": 25011534.29,
                         "livre_uc": 96370.0, "cativo_uc": 96800911.0}

    @classmethod
    def setUpClass(cls):
        cls.linhas = list(em.linhas_consumo_sam(_caminho("epe_consumo_mensal_recorte.xlsx")))
        cls.linhas_uf = list(em.linhas_consumo_sam(_caminho("epe_consumo_mensal_recorte.xlsx"), por_uf=True))
        obs = {}
        for l in cls.linhas + cls.linhas_uf:
            obs[(em.chave_serie(l, "consumo"), l["mes"])] = l["consumo_mwh"]
            obs[(em.chave_serie(l, "ucs"), l["mes"])] = l["ucs"]
        cls.agg = mod.consumo_epe(obs)
        cls.nac = {x["mes"]: x for x in mod.nacional_mensal(cls.agg, {"2026"})}

    def test_total_nacional_fecha_com_a_planilha(self):
        j = self.nac["2026-07"]
        p = self.PLANILHA_JUL_2026
        for campo in ("total_mwh", "livre_mwh", "cativo_mwh"):
            # tolerância do módulo: maior entre 1 MWh e 10⁻⁶ do valor (arredondamentos independentes)
            self.assertLessEqual(abs(j[campo] - p[campo]), max(1.0, 1e-6 * p[campo]), campo)
        self.assertEqual(j["livre_uc"], p["livre_uc"])
        self.assertEqual(j["cativo_uc"], p["cativo_uc"])
        # participação calculada pelo módulo = a da planilha, sem média de percentuais regionais
        self.assertAlmostEqual(j["livre_pct"], 100 * p["livre_mwh"] / p["total_mwh"], places=4)
        self.assertTrue(j["preliminar"])

    def test_reconciliacao_do_modulo_aprova_e_detecta_divergencia(self):
        plan = {(f"plan|{k}", "2026-07"): v for k, v in self.PLANILHA_JUL_2026.items()}
        r = mod.reconcilia_planilha([self.nac["2026-07"]], plan)
        self.assertEqual(r["resultado"], "aprovado")
        plan[("plan|livre_mwh", "2026-07")] += 500.0  # erro de 500 MWh na planilha
        r = mod.reconcilia_planilha([self.nac["2026-07"]], plan)
        self.assertEqual(r["resultado"], "reprovado")
        self.assertEqual(r["exemplos_falha"][0]["campo"], "livre_mwh")

    def test_primeiro_mes_da_serie(self):
        j = self.nac["2004-01"]
        # janeiro de 2004 na planilha formatada: 26.978.361,463 MWh no total e 195 unidades livres
        self.assertLessEqual(abs(j["total_mwh"] - 26978361.463), 27.0)
        self.assertEqual(j["livre_uc"], 195.0)

    def test_uf_em_dois_subsistemas_nao_se_sobrepoe(self):
        """Roraima aparece em junho de 2026 nos sistemas isolados e no Norte interligado: as duas
        linhas somam na UF e continuam separadas no subsistema (nenhuma sobrescreve a outra)."""
        rr = [l for l in self.linhas_uf if l["uf"] == "RR" and l["tipo"] == "cativo"]
        self.assertEqual({l["sistema"] for l in rr}, {"ISOL", "N"})
        soma = sum(l["consumo_mwh"] for l in rr if l["consumo_mwh"] is not None)
        self.assertAlmostEqual(self.agg["uf"][(("RR", "cativo"), "mwh")]["2026-06"], soma, places=3)

    def test_esquema_divergente_interrompe_a_leitura(self):
        tmp = tempfile.mkdtemp()
        try:
            dst = os.path.join(tmp, "x.xlsx")
            with zipfile.ZipFile(_caminho("epe_consumo_mensal_recorte.xlsx")) as zi, zipfile.ZipFile(dst, "w") as zo:
                for n in zi.namelist():
                    dado = zi.read(n)
                    if n == "xl/worksheets/sheet1.xml":
                        dado = dado.replace(b"Centro-Oeste", b"Centro Oeste", 1)
                    zo.writestr(n, dado)
            with self.assertRaises(em.EsquemaInesperado):
                list(em.linhas_consumo_sam(dst))
        finally:
            shutil.rmtree(tmp)

    def test_ano_incompleto_e_janela_com_lacuna(self):
        series = {"cativo": {"2026-01": 10.0, "2026-02": 10.0}, "livre": {"2026-01": 5.0}}
        a = mod.anual(series)
        self.assertEqual(a["2026"]["meses"], 1)  # mês sem livre não entra no ano
        self.assertFalse(a["2026"]["completo"])
        self.assertIsNone(mod.janela_12m(series, "2026-02"))  # lacuna não é preenchida

    def test_mes_sem_um_dos_tipos_fica_sem_participacao(self):
        agg = {"nac": {("cativo", "mwh"): {"2026-01": 10.0}, ("livre", "mwh"): {}}}
        l = mod.nacional_mensal(agg, set())[0]
        self.assertIsNone(l["livre_mwh"])
        self.assertIsNone(l["total_mwh"])
        self.assertIsNone(l["livre_pct"])


# ======================================================================= P032: SAMP

class SampReleituraIndependente(unittest.TestCase):
    """O agregado do módulo (Python, linha a linha) contra a releitura do mesmo Parquet com
    pyarrow.compute, filtros escritos aqui a partir do dicionário dd-samp.pdf."""

    @classmethod
    def setUpClass(cls):
        cls.cont = {}
        cls.agg, cls.cad = am.agrega_samp(am.lotes_parquet(_caminho("samp_2025_12_recorte.parquet")), cls.cont)

    def _pyarrow(self, cnpj_int, opcao, metricas_, tipos):
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        t = pq.read_table(_caminho("samp_2025_12_recorte.parquet"))
        m = pc.and_(pc.equal(t.column("NumCNPJAgenteDistribuidora"), cnpj_int), pc.equal(t.column("DscOpcaoEnergia"), opcao))
        m = pc.and_(m, pc.is_in(t.column("DscDetalheMercado"), value_set=pa.array(metricas_)))
        m = pc.and_(m, pc.is_in(t.column("NomTipoMercado"), value_set=pa.array(tipos)))
        return pc.sum(t.filter(m).column("VlrMercado")).as_py() or 0.0

    def test_cemig_grande(self):
        d = self.agg[(CEMIG, "2025-12")]
        tipos = sorted(am.TIPOS_COMPETENCIA)
        livre = self._pyarrow(6981180000116, "LIVRE", ["Energia TUSD (kWh)"], tipos) / 1000
        ucs = self._pyarrow(6981180000116, "LIVRE", ["Número de consumidores", "Número de Consumidores"], tipos)
        self.assertAlmostEqual(d["livre_mwh"], livre, places=3)
        self.assertEqual(d["livre_uc"], ucs)
        self.assertEqual(d["livre_uc"], 6956.0)
        # aberturas por característica somam o total (nenhuma linha perdida ou contada duas vezes)
        self.assertEqual(sum(v for k, v in d.items() if k.startswith("livre_uc_")), d["livre_uc"])
        self.assertAlmostEqual(sum(v for k, v in d.items() if k.startswith("livre_mwh_") and k != "livre_mwh_refat"), d["livre_mwh"], places=3)
        # o cativo paga TE e TUSD sobre a mesma energia: as duas medidas coincidem
        self.assertAlmostEqual(d["cativo_mwh"], d["cativo_mwh_tusd"], places=3)

    def test_ceral_pequena_com_refaturamento_separado(self):
        d = self.agg[(CERAL, "2025-12")]
        self.assertEqual(d["livre_uc"], 1.0)
        self.assertAlmostEqual(d["cativo_mwh_refat"], 0.1, places=6)
        regular = self._pyarrow(75826404000138, "CATIVO", ["Energia TE (kWh)"], sorted(am.TIPOS_COMPETENCIA)) / 1000
        self.assertAlmostEqual(d["cativo_mwh"], regular, places=6)  # refaturamento fora da competência

    def test_cnpj_inteiro_vira_chave_de_14_digitos_e_geracao_fica_fora(self):
        self.assertIn((CEMIG, "2025-12"), self.agg)  # NumCNPJ vem como inteiro sem zero à esquerda
        self.assertEqual(self.cad[CEMIG]["sigla"], "CEMIG-D")
        self.assertFalse(any("geracao" in k for d in self.agg.values() for k in d))


# ======================================================================= P032: CCEE

class CceeConsumoPorAmbiente(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        amb = _obs("consumo_mensal_ambiente_comercializacao_2026.csv")
        cls_ = _obs("consumo_classe_agente_2026.csv")
        cls.linhas, cls.ident, _ = mod.ccee_consumo(amb, cls_)
        cls.por = {x["mes"]: x for x in cls.linhas}
        cls.ident_por = {x["mes"]: x for x in cls.ident}

    def test_quebra_da_classe_varejista(self):
        """Fevereiro de 2026: o conjunto de ambiente deixa de contar a Varejista no ACL; a soma das
        classes continua fechando com o publicado mais o consumo da Varejista."""
        fev = self.ident_por["2026-02"]
        self.assertAlmostEqual(fev["varejista_mwmed"], 2579.7, delta=0.1)
        self.assertAlmostEqual(fev["diferenca_mwmed"], fev["varejista_mwmed"], delta=mod.TOL_IDENTIDADE_CLASSES_MWMED)
        self.assertTrue(all(x["ok"] for x in self.ident))
        jan = self.ident_por["2026-01"]
        self.assertIsNone(jan["varejista_mwmed"])
        self.assertLessEqual(abs(jan["diferenca_mwmed"]), 1.0)

    def test_acl_pelas_classes_inclui_a_varejista_e_separa_a_exportacao(self):
        x = self.por["2026-07"]
        self.assertEqual(x["origem"], "classes")
        # o conjunto de ambiente conta a exportação no ACL e, desde fevereiro de 2026, não conta a
        # Varejista: ACL do observatório + exportação − publicado = Varejista
        self.assertAlmostEqual(x["acl_mwmed"] + x["exportacao_mwmed"] - x["acl_publicado_mwmed"], x["varejista_mwmed"], delta=5.0)
        self.assertEqual(x["acr_mwmed"], x["acr_publicado_mwmed"])
        self.assertEqual(x["horas"], 744)
        # InfoMercado Nº 229 (julho de 2026), seção 5: 'O consumo contabilizou 70.238 MW médios'
        # (sem a exportação de 929,07 MW médios). Σ classes sem a Exportador = 70.235,7. O
        # 'Consumo/Geração' (71.272) é o lado da geração e não é o número do consumo.
        self.assertAlmostEqual(x["total_mwmed"], 70235.7, delta=0.05)
        self.assertLessEqual(abs(x["total_mwmed"] - 70238), mod.TOL_CONSUMO_INFOMERCADO_MWMED)
        self.assertAlmostEqual(x["exportacao_mwmed"], 929.07, delta=0.05)
        self.assertAlmostEqual(x["total_com_exportacao_mwmed"], 71164.8, delta=0.05)

    def test_variacao_do_acl_sem_exportacao_bate_com_o_infomercado(self):
        """InfoMercado Nº 229: 'o ACL avançou 3,1% sem considerar os efeitos da exportação' e,
        considerando a exportação, 'o ACL avança 0,7%' (julho de 2026 contra julho de 2025)."""
        cls_ = {**_obs("consumo_classe_agente_2025.csv"), **_obs("consumo_classe_agente_2026.csv")}
        amb = _obs("consumo_mensal_ambiente_comercializacao_2026.csv")
        linhas, _, _ = mod.ccee_consumo(amb, cls_)
        v = mod.variacao_acl_12m(linhas, "2026-07")
        self.assertAlmostEqual(v["sem_exportacao_pct"], 3.1, delta=0.05)
        self.assertAlmostEqual(v["com_exportacao_pct"], 0.7, delta=0.05)

    def test_classe_fora_do_dominio_recusa_o_arquivo(self):
        linhas = _csv("consumo_classe_agente_2026.csv")
        linhas[0] = dict(linhas[0], CLASSE_AGENTE="Classe Nova")
        spec = cm.CONJUNTOS["consumo_classe_agente"]
        with self.assertRaises(cm.EsquemaDivergente):
            cm.leitor_mensal(linhas, spec["colunas"], spec["dims"])

    def test_cabecalho_renomeado_falha_fechado(self):
        """Caso real de 01/10/2026: o package_show documenta RESSARCIMENTO_DIST_IMPL_OP e o arquivo
        traz RESSARCIMENTO_DIST_IMPL_OP_MNT; com a lista antiga, o arquivo é recusado."""
        cab = list(_csv("encargo_ess_ancilar_2024.csv")[0].keys())
        antigas = tuple("RESSARCIMENTO_DIST_IMPL_OP" if c == "RESSARCIMENTO_DIST_IMPL_OP_MNT" else c
                        for c in cm.CONJUNTOS["encargo_ess_ancilar"]["colunas"])
        with self.assertRaises(cm.EsquemaDivergente):
            cm.confere_cabecalho(cab, antigas)
        cm.confere_cabecalho(cab, cm.CONJUNTOS["encargo_ess_ancilar"]["colunas"])  # a lista vigente aceita

    def test_submercado_desconhecido_recusa(self):
        linhas = _csv("geracao_submercado_2024.csv")
        linhas[0] = dict(linhas[0], SUBMERCADO="CENTRO")
        spec = cm.CONJUNTOS["geracao_submercado"]
        with self.assertRaises(cm.EsquemaDivergente):
            cm.leitor_mensal(linhas, spec["colunas"], spec["dims"])


# ======================================================================= P033

class AgentesEMigracao(unittest.TestCase):
    def test_entradas_saidas_e_volta_pelo_cnpj(self):
        obs, regs = cm.leitor_associados(_csv("lista_agente_associado_2026_recorte.csv"))
        meses = {}
        for ch, campo, val in regs:
            if campo == "meses":
                meses[ch.split("|")[1]] = set(val.split(";"))
        f = {x["mes"]: x for x in mod.fluxos_cnpj(meses)}
        self.assertIsNone(f["2026-01"]["entradas"])  # primeiro mês não tem mês anterior para comparar
        self.assertEqual(f["2026-01"]["estoque"], 5)
        # 63228553000116 e 07003107000132 entram em março; 40586796000120 sai em março e volta em abril
        self.assertEqual(f["2026-03"]["entradas"], 2)
        self.assertEqual(f["2026-03"]["saidas"], 1)
        self.assertEqual(f["2026-04"]["entradas"], 1)
        # 21148231000117 e 29912997000138 aparecem pela última vez em abril
        self.assertEqual(f["2026-05"]["saidas"], 2)
        self.assertEqual(f["2026-09"]["estoque"], 5)
        # contagem por classe e mês sai do mesmo leitor e soma o estoque
        por_mes = {}
        for s, m, v in obs:
            por_mes[m] = por_mes.get(m, 0) + v
        self.assertEqual(por_mes["2026-03"], f["2026-03"]["estoque"])

    def test_lacuna_entre_meses_nao_vira_fluxo(self):
        f = mod.fluxos_cnpj({"A": {"2026-01", "2026-03"}, "B": {"2026-01", "2026-03"}})
        self.assertEqual([x["mes"] for x in f], ["2026-01", "2026-03"])
        self.assertIsNone(f[1]["entradas"])  # sem fevereiro publicado, não há comparação de meses consecutivos

    def test_desligamento_com_sucessao_e_compulsorio(self):
        obs, regs = cm.leitor_desligamentos(_csv("desligamento_voluntario_recorte.csv", ","))
        d = dict(((s, m), v) for s, m, v in obs)
        # setembro de 2026: três desligamentos voluntários (um com sucessão completa, dois sem)
        self.assertEqual(d[("desligamentos_sucessao|voluntário|sem sucessão", "2026-09")], 2)
        self.assertEqual(d[("desligamentos_sucessao|voluntário|com sucessão completa", "2026-09")], 2)
        suc = {ch: val for ch, campo, val in regs if campo == "cnpj_sucessor" and val}
        # Geranorte (PIE) sucedida pela Eneva (Comercializador): mudança societária com CNPJ do sucessor
        self.assertIn("desligamento|09110880000123|2026-09-01|voluntário", suc)
        self.assertEqual(suc["desligamento|09110880000123|2026-09-01|voluntário"], "04423567000121")
        obs_c, _ = cm.leitor_desligamentos(_csv("desligamento_compulsorio_recorte.csv", ","))
        self.assertEqual(sum(v for s, m, v in obs_c if s.startswith("desligamentos|compulsório|")), 4)


# ======================================================================= P034

class GsfContraInfoMercado(unittest.TestCase):
    """O fator calculado com os conjuntos abertos reproduz o fator publicado no InfoMercado mensal
    (PDF da CCEE): 79,37% em agosto e 73,49% em outubro de 2024 (edições 206 e 208) e 76,83% em
    julho de 2026 (edição 229). Tolerância 0,006 p.p.: o PDF publica duas casas."""

    def test_gsf_2024(self):
        m = {x["mes"]: x for x in mod.gsf_mensal(_obs("geracao_submercado_2024.csv"), _obs("mre_mensal_2024.csv"),
                                                   _obs("garantia_fisica_sazo_mre_submercado_2024.csv"))}
        self.assertAlmostEqual(m["2024-08"]["gsf_pct"], 79.37, delta=0.006)
        self.assertAlmostEqual(m["2024-10"]["gsf_pct"], 73.49, delta=0.006)
        # geração do MRE no InfoMercado: 38.214 e 38.461 MW médios (inteiros)
        self.assertAlmostEqual(m["2024-08"]["geracao_mre_mwmed"], 38214, delta=0.5)
        self.assertAlmostEqual(m["2024-10"]["geracao_mre_mwmed"], 38461, delta=0.5)
        # garantia física dos submercados soma a do MRE (mesmo perímetro)
        self.assertAlmostEqual(m["2024-08"]["gf_sazonalizada_soma_submercados_mwmed"], m["2024-08"]["gf_sazonalizada_mwmed"], places=2)

    def test_gsf_julho_2026(self):
        m = {x["mes"]: x for x in mod.gsf_mensal(_obs("geracao_submercado_2026.csv"), _obs("mre_mensal_2026.csv"), {})}
        self.assertAlmostEqual(m["2026-07"]["gsf_pct"], 76.83, delta=0.006)

    def test_periodo_e_razao_de_energias_nao_media(self):
        linhas = [{"mes": "2026-02", "geracao_mre_mwmed": 100.0, "gf_modulada_fdisp_mwmed": 200.0, "horas": 672},
                  {"mes": "2026-03", "geracao_mre_mwmed": 900.0, "gf_modulada_fdisp_mwmed": 1000.0, "horas": 744}]
        a = mod.gsf_agregado(linhas, ["2026-02", "2026-03"])
        self.assertGreater(a["gsf_pct"], (50.0 + 90.0) / 2)  # o mês com mais garantia física pesa mais
        self.assertIsNone(mod.gsf_agregado(linhas, ["2026-02", "2026-03", "2026-04"]))  # mês ausente

    def test_mes_sem_os_quatro_submercados_fica_sem_gsf(self):
        ger = {k: v for k, v in _obs("geracao_submercado_2024.csv").items() if not (k[1] == "2024-08" and k[0].startswith("N|"))}
        m = {x["mes"]: x for x in mod.gsf_mensal(ger, _obs("mre_mensal_2024.csv"), {})}
        self.assertIsNone(m["2024-08"]["gsf_pct"])


class RiscoHidrologicoContaBandeira(unittest.TestCase):
    def test_linhas_e_identidade_do_dicionario(self):
        cont = {}
        linhas = list(am.linhas_conta_bandeira(_texto("conta_bandeira_recorte.csv"), cont))
        self.assertEqual(cont["sem_cnpj"], 1)
        self.assertEqual(cont["linhas"], 6)
        for l in linhas:
            d = am.confere_risco_hidrologico(l["campos"])
            self.assertIsNotNone(d)
            self.assertLessEqual(abs(d), 1.0)
        cemig = next(l for l in linhas if l["cnpj"] == CEMIG and l["mes"] == "2026-06")["campos"]
        # Itaipu + repactuadas + cotas, valores do CSV: 21.510.928,79 + 26.139.007,4 + 6.124.623,33
        bruto = cemig["VlrRiscoHidrologicoItaipu"] + cemig["VlrRiscoHidrologicoRepactuadas"] + cemig["VlrRiscoHidrologicoCCGF"]
        self.assertAlmostEqual(bruto, 53774559.52, places=2)
        self.assertEqual(sum(1 for l in linhas if l["cnpj"] == CODESAM and l["mes"] == "2020-05"), 2)


# ======================================================================= P035

class EncargosContraPublicacoesOficiais(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rd24 = mod.rd_mensal_de(_obs("rd_encargos_contab_mensal_2024.csv"))
        cls.ess24 = {x["mes"]: x for x in mod.ess_mensal_de(_obs("encargo_ess_ancilar_2024.csv"), rd24)}
        cls.rd24 = rd24
        cls.rd26 = mod.rd_mensal_de(_obs("rd_encargos_contab_mensal_2026.csv"))
        cls.ess26 = mod.ess_mensal_de(_obs("encargo_ess_ancilar_2026.csv"), cls.rd26)

    def test_componentes_de_agosto_de_2024_no_infomercado(self):
        """InfoMercado Nº 206: R$ 481,38 milhões de encargos, dos quais 447,78 de restrição da
        operação, 16,20 de serviços ancilares, 9,90 de importação, 3,64 de deslocamento hidráulico
        e 3,87 de resposta da demanda (que não é coluna do conjunto ENCARGO_ESS_ANCILAR)."""
        a = self.ess24["2024-08"]
        self.assertAlmostEqual(a["restricao_operacao"] / 1e6, 447.78, delta=0.005)
        self.assertAlmostEqual(a["servicos_ancilares"] / 1e6, 16.20, delta=0.005)
        self.assertAlmostEqual(a["importacao"] / 1e6, 9.90, delta=0.005)
        self.assertAlmostEqual(a["deslocamento_hidraulico"] / 1e6, 3.64, delta=0.005)
        self.assertAlmostEqual(a["resposta_demanda"] / 1e6, 3.87, delta=0.005)
        self.assertAlmostEqual((a["total"] + a["resposta_demanda"]) / 1e6, 481.38, delta=0.06)

    def test_ressarcimentos_nao_sao_somados_duas_vezes(self):
        """Outubro de 2024 (InfoMercado Nº 208): R$ 268,8 milhões com 3,32 de resposta da demanda.
        OUTROS_SERVICOS_ANCILARES (R$ 25.159,06) é a soma dos ressarcimentos; somar as duas
        colunas contaria a mesma despesa duas vezes."""
        o = self.ess24["2024-10"]
        self.assertEqual(o["diferenca_outros_ressarcimentos"], 0.0)
        self.assertAlmostEqual(o["total"] / 1e6, 268.8 - 3.32, delta=0.06)
        todas = sum(v for (s, m), v in _obs("encargo_ess_ancilar_2024.csv").items() if m == "2024-10")
        self.assertAlmostEqual(todas - o["total"], 25159.06, places=2)

    def test_resposta_da_demanda_ausencia_e_zero(self):
        self.assertIsNone(self.rd24.get("2024-10"))  # mês ausente do arquivo
        self.assertEqual(self.rd24["2024-12"], (80917.0, 1))  # só o Sudeste tem valor
        self.assertIsNone(self.rd26.get("2026-07"))  # quatro submercados vazios: sem valor, não zero
        self.assertEqual(self.rd26["2026-05"], (0.0, 1))  # zero publicado é zero
        jul = next(x for x in self.ess26 if x["mes"] == "2026-07")
        self.assertIsNone(jul["resposta_demanda"])
        self.assertEqual(jul["resposta_demanda_submercados"], 0)

    def test_julho_de_2026_no_infomercado(self):
        """InfoMercado Nº 229: R$ 64,96 milhões, dos quais 1,07 de suporte de reativo vinculado ao
        sandbox (fora do conjunto); restrição de operação 37,02; suporte de reativo 24,29;
        deslocamento hidráulico 2,05 + 0,54 (perfis de geração e de consumo)."""
        j = next(x for x in self.ess26 if x["mes"] == "2026-07")
        self.assertAlmostEqual(j["total"] / 1e6, 64.96 - 1.07, delta=0.06)
        self.assertAlmostEqual(j["restricao_operacao"] / 1e6, 37.02, delta=0.005)
        self.assertAlmostEqual(j["suporte_reativo"] / 1e6, 24.29, delta=0.005)
        self.assertAlmostEqual(j["deslocamento_hidraulico"] / 1e6, 2.05 + 0.54, delta=0.01)

    def test_boletim_do_mme_por_tipo_e_mes(self):
        """Edição de junho de 2026 do boletim do MME (mil R$, fonte declarada CCEE) contra o conjunto
        aberto: todos os tipos de janeiro a junho dentro de 0,5 mil R$, e o total menos a resposta
        da demanda dentro de 6 mil R$. A resposta da demanda de janeiro diverge (5.859 mil R$ no
        boletim, zero publicado no conjunto): divergência entre fontes, não acerto."""
        t = _texto("mme_boletim_junho_2026_recorte.txt")
        ed = mm.edicao(t)
        tab = mm.tabela_ess(t, ed)
        obs = {(f"ess|{i}|ed{ed}", m): v for i, s in tab["valores"].items() for m, v in s.items()}
        vig, _ = mod.mme_vigente(obs)
        rec = mod.reconcilia_mme_ccee(vig, self.ess26)
        tipos = [x for x in rec if x["tipo"] != "resposta_demanda"]
        self.assertGreaterEqual(len(tipos), 60)
        self.assertTrue(all(x["resultado"] == "aprovado" for x in tipos), [x for x in tipos if x["resultado"] != "aprovado"])
        rd_jan = next(x for x in rec if x["tipo"] == "resposta_demanda" and x["mes"] == "2026-01")
        self.assertEqual(rd_jan["mme_mil_rs"], 5859.0)
        self.assertEqual(rd_jan["resultado"], "ressalva")

    def test_reprocessamento_entre_edicoes_do_boletim(self):
        """Março de 2026: 344.773 mil R$ na edição de março (com 280 mil R$ de suporte de reativo
        'vinculado a resposta da demanda'), 344.493 na de junho, que retirou a parcela."""
        obs = {}
        for nome in ("mme_boletim_marco_2026_recorte.txt", "mme_boletim_junho_2026_recorte.txt"):
            t = _texto(nome)
            ed = mm.edicao(t)
            for i, s in mm.tabela_ess(t, ed)["valores"].items():
                for m, v in s.items():
                    obs[(f"ess|{i}|ed{ed}", m)] = v
        vig, rev = mod.mme_vigente(obs)
        self.assertEqual(vig[("total", "2026-03")], (344493.0, "2026-06"))
        r = next(x for x in rev if x["tipo"] == "total" and x["mes"] == "2026-03")
        self.assertEqual(r["diferenca_mil_rs"], -280.0)
        self.assertTrue(any(x["tipo"] == "sr_vinculado_rd" and x.get("nota") for x in rev))

    def test_consumo_por_ambiente_do_boletim_fecha(self):
        ca = mm.tabela_consumo_ambiente(_texto("mme_boletim_junho_2026_recorte.txt"))
        self.assertTrue(ca["ok"])
        self.assertEqual(ca["linhas"]["ACL"]["acum"], 257741.0)
        pd = mm.perdas_e_diferencas(_texto("mme_boletim_junho_2026_recorte.txt"))
        # carga 57.898 GWh em junho de 2026, 11.694 GWh de perdas e diferenças: consumo ≠ carga
        # (1 GWh de diferença: as duas tabelas arredondam a GWh inteiro de forma independente)
        self.assertEqual(pd["total"]["mes"], 57898.0)
        self.assertAlmostEqual(pd["total"]["mes"] - pd["perdas_diferencas"]["mes"], ca["linhas"]["Total"]["mes"], delta=1.0)


class Liquidacao(unittest.TestCase):
    def test_zeros_que_nao_fecham_nao_viram_taxa(self):
        l = {r["MES_REFERENCIA"]: r for r in _csv("sumario_mensal_liquidacao_2026.csv")}
        f = lambda m: mod.linha_liquidacao(m, *(cm.numero(l[m.replace("-", "")][k]) for k in  # noqa: E731
                                                  ("VALOR_TOTAL_LIQ_PRE", "VALOR_TOTAL_LIQ_POS", "VALOR_INAD")))
        mar, jul = f("2026-03"), f("2026-07")
        self.assertEqual(mar["situacao"], "liquidacao_nao_informada")
        self.assertIsNone(mar["inadimplencia_pct"])
        self.assertEqual(jul["situacao"], "liquidada")
        # 433.719.410,40 ÷ 2.131.511.220,48 (valores do CSV)
        self.assertAlmostEqual(jul["inadimplencia_pct"], 20.35, places=2)
        # InfoMercado Nº 229: 'O total a liquidar foi de R$ 2,13 bilhões'
        self.assertAlmostEqual(jul["a_liquidar"] / 1e9, 2.13, delta=0.005)
        self.assertEqual(mod.linha_liquidacao("2026-08", None, 1.0, 0.0)["situacao"], "sem_valor")


# ======================================================================= InfoMercado (extração)

class ExtracaoInfoMercado(unittest.TestCase):
    def test_edicao_206(self):
        v = cm.infomercado_valores(_texto("infomercado_206_recorte.txt"))
        self.assertEqual((v["numero"], v["mes"]), ("206", "2024-08"))
        self.assertEqual(v["valores"]["gsf_pct"], 79.37)
        self.assertEqual(v["valores"]["agentes_contabilizados"], 15795.0)
        self.assertEqual(v["valores"]["encargos_resposta_demanda_milhoes_rs"], 3.87)
        self.assertEqual(v["valores"]["alivio_ess_milhoes_rs"], 119.84)
        self.assertEqual(v["paginas"]["gsf_pct"], 1)
        self.assertEqual(v["paginas"]["encargos_total_detalhe_milhoes_rs"], 10)
        self.assertEqual(v["rotulos_desconhecidos"], [])

    def test_edicao_229_com_rotulos_de_2026(self):
        v = cm.infomercado_valores(_texto("infomercado_229_recorte.txt"))
        self.assertEqual((v["numero"], v["mes"]), ("229", "2026-07"))
        self.assertEqual(v["valores"]["gsf_pct"], 76.83)
        self.assertAlmostEqual(v["valores"]["encargos_deslocamento_hidraulico_milhoes_rs"], 2.59, places=6)
        self.assertEqual(v["parcelas"]["encargos_deslocamento_hidraulico_milhoes_rs"], 2)
        self.assertEqual(v["valores"]["encargos_suporte_reativo_sandbox_milhoes_rs"], 1.07)
        self.assertEqual(v["rotulos_desconhecidos"], [])

    def test_rotulo_novo_e_registrado_e_nao_adivinhado(self):
        t = _texto("infomercado_229_recorte.txt").replace("de suporte de reativo vinculado ao sandbox", "de encargo inédito")
        v = cm.infomercado_valores(t)
        self.assertEqual(v["rotulos_desconhecidos"], ["encargo inédito"])
        self.assertNotIn("encargos_suporte_reativo_sandbox_milhoes_rs", v["valores"])

    def test_edicao_corrente_da_pagina(self):
        url, numero, quando = cm.edicao_corrente(_texto("ccee_mercado_mensal_recorte.html"))
        self.assertEqual(numero, "229")
        self.assertEqual(quando, "2026-09-10")
        self.assertTrue(url.startswith("https://www.ccee.org.br/documents/"))
        self.assertIsNone(cm.edicao_corrente("<html></html>"))


# ======================================================================= textos e catálogo

class TextosDerivados(unittest.TestCase):
    def test_gsf_abaixo_de_cem_e_observacao_sem_causa(self):
        mg = {"kpis": {"gsf_ultimo_mes": {"valor_pct": 76.825, "mes": "2026-07"},
                       "gsf_12m": {"valor_pct": 80.428, "periodo": {"inicio": "2025-08", "fim": "2026-07"}}}}
        t = mod.resposta_p034(mg)
        self.assertIn("76,8% em julho de 2026", t)
        self.assertIn("geraram menos que a garantia física ajustada", t)
        self.assertNotIn("porque", t)

    def test_sentido_no_arredondamento_exibido(self):
        self.assertEqual(mod._sentido(45.27, 44.21), "maior que")
        self.assertEqual(mod._sentido(45.24, 45.31), "menor que")  # 45,2 e 45,3 na tela
        self.assertEqual(mod._sentido(45.26, 45.29), "igual a")  # 45,3 e 45,3 na tela

    def test_bilhao_no_singular_abaixo_de_dois(self):
        self.assertEqual(mod._bilhoes(1597871604.68), "R$ 1,60 bilhão")
        self.assertEqual(mod._bilhoes(10195848810.71), "R$ 10,20 bilhões")

    def test_resposta_ausente_sem_kpi(self):
        self.assertIsNone(mod.resposta_p032({"kpis": {}}))
        self.assertIsNone(mod.resposta_p034({"kpis": {}}))


class CatalogoDeMetricas(unittest.TestCase):
    def test_metricas_validas_e_fontes_registradas(self):
        datasets = {d["dataset_silver"] for d in mod.REGISTRO["datasets"]}
        ids = [m["id"] for m in metricas_mercado.METRICAS]
        self.assertEqual(len(ids), len(set(ids)))
        for m in metricas_mercado.METRICAS:
            self.assertEqual(metricas.validar(m), [], m["id"])
            self.assertTrue(set(m["fontes"]) <= datasets, (m["id"], set(m["fontes"]) - datasets))
            self.assertEqual(m["gold"], "mercado.json")

    def test_registro_tem_arquivo_descrito_para_cada_download(self):
        for d in mod.REGISTRO["datasets"]:
            for url in d["downloads"]:
                self.assertIn(url, mod.REGISTRO["arquivos"], url)


# ======================================================================= correções do verificador (01/10/2026)

class ExportacaoForaDoAcl(unittest.TestCase):
    """O ACL da CCEE é calculado sem a classe Exportador (energia vendida a outros países), como o
    InfoMercado apresenta o consumo; o total com exportação fica ao lado."""

    def test_junho_de_2023_sem_e_com_exportacao(self):
        linhas, _, _ = mod.ccee_consumo({}, _obs("consumo_classe_agente_2023.csv"))
        jun = {x["mes"]: x for x in linhas}["2023-06"]
        # junho de 2023: 1.480,2 MW médios exportados; ACL 24.927,3 de 64.937,3 sem exportação
        self.assertAlmostEqual(jun["exportacao_mwmed"], 1480.2, delta=0.05)
        self.assertAlmostEqual(jun["acl_pct"], 38.39, delta=0.005)
        self.assertAlmostEqual(jun["acl_com_exportacao_pct"], 39.76, delta=0.005)

    def test_consumo_contabilizado_e_exportacao_do_infomercado(self):
        v = cm.infomercado_valores(_texto("infomercado_229_recorte.txt"))
        self.assertEqual(v["valores"]["consumo_contabilizado_mwmed"], 70238.0)
        self.assertEqual(v["paginas"]["consumo_contabilizado_mwmed"], 4)
        self.assertEqual(v["valores"]["exportacao_mwmed"], 929.07)
        self.assertEqual(v["valores"]["consumo_geracao_mwmed"], 71272.0)  # lado da geração, não é o consumo
        cls_ = _obs("consumo_classe_agente_2026.csv")
        cons = {s_.split("|")[0]: val for (s_, m), val in cls_.items() if m == "2026-07" and s_.endswith("|CONSUMO")}
        sem_exp = sum(val for k, val in cons.items() if k != "Exportador")
        self.assertAlmostEqual(sem_exp, 70235.7, delta=0.05)
        self.assertLessEqual(abs(sem_exp - v["valores"]["consumo_contabilizado_mwmed"]), mod.TOL_CONSUMO_INFOMERCADO_MWMED)
        self.assertLessEqual(abs(cons["Exportador"] - v["valores"]["exportacao_mwmed"]), 0.005)
        # a comparação antiga (todas as classes contra 'Consumo/Geração') não fecha: 107 MW médios
        self.assertGreater(abs(sum(cons.values()) - v["valores"]["consumo_geracao_mwmed"]), 100)


class ParcelasSemDistribuidoras(unittest.TestCase):
    """As parcelas dos perfis Distribuidor (uma por área de concessão) são o consumo do ACR e não
    entram nas parcelas nem no consumo do ACL. Conferência independente: o conjunto
    CONSUMO_CLASSE_AGENTE publica o consumo de cada classe."""

    @classmethod
    def setUpClass(cls):
        cls.classes = {r["COD_PERF_AGENTE"].strip(): r["CLASSE_PERFIL_AGENTE"].strip() for r in _csv("lista_perfil_recorte.csv")}
        cls.cont = {}
        cls.obs = {(s_, m): v for s_, m, v in cm.leitor_parcelas(_csv("parcela_carga_consumo_recorte.csv"), cls.classes, cls.cont)}

    def test_distribuidoras_em_serie_propria_igual_a_classe_distribuidor(self):
        o = self.obs
        self.assertEqual(o[("distribuidor|parcelas", "2026-07")], 139)
        # 139 parcelas de distribuidoras = 29.353.995 MWh = 39.454,3 MW médios × 744 h, o consumo da
        # classe Distribuidor (ACR) publicado em CONSUMO_CLASSE_AGENTE
        self.assertAlmostEqual(o[("distribuidor|consumo_acl_mwh", "2026-07")], 29353995, delta=1)
        acr = _obs("consumo_classe_agente_2026.csv")[("Distribuidor|CONSUMO", "2026-07")]
        self.assertAlmostEqual(o[("distribuidor|consumo_acl_mwh", "2026-07")] / 744, acr, delta=0.05)
        # nenhuma parcela de distribuidora entra no ACL: contagem do ACL = 18 exportadores + 30 consumidores
        self.assertEqual(o[("acl|parcelas", "2026-07")], 48)
        self.assertEqual(o[("classe|Exportador|parcelas", "2026-07")], 18)
        exp = _obs("consumo_classe_agente_2026.csv")[("Exportador|CONSUMO", "2026-07")]
        self.assertAlmostEqual(o[("classe|Exportador|consumo_acl_mwh", "2026-07")] / 744, exp, delta=0.01)
        self.assertNotIn(("classe|Distribuidor|parcelas", "2026-07"), {k for k in o if k[0].startswith("acl|")})

    def test_ramo_vazio_nao_identifica_distribuidora(self):
        """Fevereiro de 2025: parcelas de consumidores especiais com RAMO_ATIVIDADE vazio ficam no ACL."""
        self.assertEqual(self.obs[("acl|parcelas", "2025-02")], 5)
        self.assertNotIn(("distribuidor|parcelas", "2025-02"), self.obs)
        self.assertEqual(self.cont["ramo_vazio_fora_de_distribuidor"], 5)
        self.assertNotIn("distribuidor_com_ramo", self.cont)

    def test_sem_cadastro_de_perfis_nada_e_lido(self):
        with self.assertRaises(cm.EsquemaDivergente):
            cm.leitor_parcelas(_csv("parcela_carga_consumo_recorte.csv"), {})

    def test_conferencia_mensal_com_o_consumo_por_classe(self):
        """Julho de 2026 completo (valores do conjunto inteiro, lidos do silver em 01/10/2026): ACL
        = 21.787.337 MWh nas parcelas contra Consumidor Livre + Especial + Autoprodutor +
        Exportador = 29.281,9 MW médios (resíduo de 2,15 MW médios); distribuidoras = classe
        Distribuidor. A função marca o mês fora da tolerância."""
        cls_ = _obs("consumo_classe_agente_2026.csv")
        parc = {("acl|parcelas", "2026-07"): 46751.0, ("acl|consumo_acl_mwh", "2026-07"): 21787337.0,
                ("distribuidor|parcelas", "2026-07"): 139.0, ("distribuidor|consumo_acl_mwh", "2026-07"): 29353995.0}
        x = mod.parcelas_de(parc, cls_)[0]
        self.assertTrue(x["conferencia"]["ok"])
        self.assertAlmostEqual(x["conferencia"]["residuo_acl_mwmed"], 2.15, delta=0.01)
        self.assertEqual(x["parcelas"], 46751)
        self.assertEqual(x["consumo_acl_mwh"], 21787337.0)
        # com as distribuidoras somadas ao ACL (o defeito da versão 1), a conferência reprova
        ruim = dict(parc)
        ruim[("acl|consumo_acl_mwh", "2026-07")] += 29353995.0
        self.assertFalse(mod.parcelas_de(ruim, cls_)[0]["conferencia"]["ok"])

    @unittest.skipUnless(os.path.isdir(os.path.join(os.path.dirname(DADOS), "..", "..", "..", "data", "energia", "bronze", "ccee",
                                                    "ccee_parcela_carga_consumo")), "bronze da CCEE ausente")
    def test_arquivo_inteiro_de_2026_no_bronze(self):
        """Releitura do arquivo inteiro (só quando o bronze está na máquina): julho de 2026 com
        46.751 parcelas do ACL e 21.787.337 MWh, sem as 139 das distribuidoras."""
        import glob
        raiz = os.path.abspath(os.path.join(os.path.dirname(DADOS), "..", "..", ".."))
        arqs = glob.glob(os.path.join(raiz, "data/energia/bronze/ccee/ccee_parcela_carga_consumo/parcela_carga_consumo_2026/*.csv.gz"))
        perf = glob.glob(os.path.join(raiz, "data/energia/bronze/ccee/ccee_lista_perfil_v1/*/*.csv.gz"))
        if not arqs or not perf:
            self.skipTest("bronze ausente")
        from pipeline.energia.fontes import ckan
        classes = {r["COD_PERF_AGENTE"].strip(): r["CLASSE_PERFIL_AGENTE"].strip() for r in ckan.le_csv_bronze(sorted(perf)[-1], separador=";")}
        linhas = (r for r in ckan.le_csv_bronze(sorted(arqs)[-1], separador=";") if r["MES_REFERENCIA"].strip() == "202607")
        o = {(s_, m): v for s_, m, v in cm.leitor_parcelas(linhas, classes)}
        self.assertEqual(o[("acl|parcelas", "2026-07")], 46751)
        self.assertAlmostEqual(o[("acl|consumo_acl_mwh", "2026-07")], 21787337, delta=1)
        self.assertEqual(o[("distribuidor|parcelas", "2026-07")], 139)


class SampCompletudePorMedida(unittest.TestCase):
    """Julho de 2026 no SAMP: a ELEKTRO publica as linhas CATIVO (iguais às de junho) e nenhuma
    linha LIVRE, depois de 4.302 unidades livres e 891.884 MWh em junho. A contagem de
    distribuidoras não pega isso; a completude por medida pega."""

    @classmethod
    def setUpClass(cls):
        agg, cls.cad = am.agrega_samp(am.lotes_parquet(_caminho("samp_2026_elektro_recorte.parquet")))
        cls.por = agg
        cls.comp = mod.completude_samp(agg, cls.cad)

    def test_elektro_junho_tem_livre_e_julho_nao(self):
        jun = self.por[("02328280000197", "2026-06")]
        self.assertEqual(jun["livre_uc"], 4302.0)
        self.assertAlmostEqual(jun["livre_mwh"], 891884.283, delta=0.001)
        self.assertIsNone(self.por[("02328280000197", "2026-07")].get("livre_uc"))

    def test_mes_sem_livre_e_incompleto_e_repeticao_detectada(self):
        jul = self.comp["2026-07"]
        self.assertFalse(jul["completo"])
        self.assertFalse(jul["comparavel"])
        self.assertEqual([(x["sigla"], x["livre_uc_mes_anterior"]) for x in jul["sem_livre"]], [("ELEKTRO", 4302.0)])
        rep = [(x["sigla"], x["opcao"], x["uc"]) for x in jul["repeticoes"]]
        self.assertEqual(rep, [("ELEKTRO", "cativo", 2762345.0)])
        self.assertAlmostEqual(jul["repeticoes"][0]["mwh"], 626546.731, delta=0.001)

    def test_variacao_abrupta_tira_o_mes_da_comparacao(self):
        por = {("A", "2026-06"): {"livre_uc": 1212.0, "livre_mwh": 10.0}, ("A", "2026-07"): {"livre_uc": 9.0, "livre_mwh": 1.0}}
        c_ = mod.completude_samp(por, {"A": {"sigla": "EQUATORIAL MA"}})["2026-07"]
        self.assertTrue(c_["completo"])
        self.assertFalse(c_["comparavel"])
        self.assertEqual(c_["variacoes_abruptas"][0]["livre_uc"], 9.0)


class LiquidacaoGradeDeMeses(unittest.TestCase):
    def test_abril_de_2025_aparece_como_ausente(self):
        lq = _obs("sumario_mensal_liquidacao_2025.csv")
        presentes = {m for (_, m) in lq}
        self.assertNotIn("2025-04", presentes)
        grade = mod.grade_meses(sorted(presentes))
        self.assertIn("2025-04", grade)
        linhas = {m: mod.linha_liquidacao(m, *(lq.get((k, m)) for k in ("VALOR_TOTAL_LIQ_PRE", "VALOR_TOTAL_LIQ_POS", "VALOR_INAD")),
                                          presente=m in presentes) for m in grade}
        abr = linhas["2025-04"]
        self.assertEqual(abr["situacao"], "mes_ausente_na_fonte")
        self.assertTrue(all(abr[k] is None for k in ("a_liquidar", "liquidado", "inadimplencia", "inadimplencia_pct")))

    def test_liquidacao_nao_informada_fica_nula(self):
        lq = _obs("sumario_mensal_liquidacao_2025.csv")
        mai = mod.linha_liquidacao("2025-05", *(lq.get((k, "2025-05")) for k in ("VALOR_TOTAL_LIQ_PRE", "VALOR_TOTAL_LIQ_POS", "VALOR_INAD")))
        self.assertEqual(mai["situacao"], "liquidacao_nao_informada")
        self.assertIsNone(mai["liquidado"])
        self.assertIsNone(mai["inadimplencia"])
        self.assertGreater(mai["a_liquidar"], 0)


class PagamentoSequenciaDeZeros(unittest.TestCase):
    """PAGAMENTO_ENCARGO_ESS = 0 de fevereiro de 2025 a julho de 2026 (18 meses) com ESS de
    competência positivo; o InfoMercado de julho de 2026 implica R$ 2,55 milhões pagos."""

    @classmethod
    def setUpClass(cls):
        pg = {**_obs("encargo_pgto_mensal_2024.csv"), **_obs("encargo_pgto_mensal_2025.csv"), **_obs("encargo_pgto_mensal_2026.csv")}
        ess = mod.ess_mensal_de({**_obs("encargo_ess_ancilar_2024.csv"), **_obs("encargo_ess_ancilar_2025.csv"), **_obs("encargo_ess_ancilar_2026.csv")})
        cls.linhas, cls.ctrl = mod.pagamento_mensal_de(pg, {x["mes"]: x["total"] for x in ess})
        cls.por = {x["mes"]: x for x in cls.linhas}

    def test_sequencia_marcada_e_nula(self):
        t = self.ctrl["series"]["pagamento_ess"]
        self.assertEqual([(x["inicio"], x["fim"], x["meses"], x["situacao"]) for x in t], [("2025-02", "2026-07", 18, "zero_nao_confirmado")])
        self.assertIsNone(self.por["2026-07"]["pagamento_ess"])
        self.assertEqual(self.por["2025-12"]["situacao_pagamento_ess"], "zero_nao_confirmado")
        # antes da sequência, o valor publicado continua (janeiro de 2025: R$ 168.276.229,22)
        self.assertEqual(self.por["2025-01"]["pagamento_ess"], 168276229.22)
        self.assertEqual(self.por["2025-01"]["situacao_pagamento_ess"], "publicado")
        self.assertEqual(self.por["2024-08"]["pagamento_ess"], 361544346.13)  # confere com o InfoMercado Nº 206

    def test_sequencia_curta_nao_e_marcada(self):
        self.assertEqual(mod.sequencias_repetidas({"2026-01": 0.0, "2026-02": 0.0, "2026-03": 0.0}), [])
        self.assertEqual(len(mod.sequencias_repetidas({f"2026-{i:02d}": 0.0 for i in range(1, 7)})), 1)


class GsfDozeMesesInfoMercado(unittest.TestCase):
    def test_numero_de_doze_meses_extraido_e_divergente(self):
        v = cm.infomercado_valores(_texto("infomercado_229_recorte.txt"))
        self.assertEqual(v["valores"]["gsf_12m_pct"], 92.55)
        self.assertEqual(v["paginas"]["gsf_12m_pct"], 3)
        ger = {**_obs("geracao_submercado_2025.csv"), **_obs("geracao_submercado_2026.csv")}
        mre = {**_obs("mre_mensal_2025.csv"), **_obs("mre_mensal_2026.csv")}
        c_ = mod.gsf_12m_candidatos(ger, mre, "2026-07")
        # ago/2025 a jul/2026: razão de energias 80,428%; média simples 81,65%; acumulado de 2026 92,478%
        self.assertAlmostEqual(c_["razao_energias_pct"], 80.428, delta=0.001)
        self.assertAlmostEqual(c_["media_simples_pct"], 81.65, delta=0.005)
        self.assertAlmostEqual(c_["acumulado_ano_pct"], 92.478, delta=0.001)
        for k in ("razao_energias_pct", "media_simples_pct", "razao_gf_sazonalizada_pct", "acumulado_ano_pct"):
            self.assertGreater(abs(c_[k] - 92.55), 0.006, k)  # nenhuma definição reproduz o número publicado

    def test_texto_do_painel_declara_a_divergencia(self):
        mg = {"kpis": {"gsf_ultimo_mes": {"valor_pct": 76.825, "mes": "2026-07"},
                       "gsf_12m": {"valor_pct": 80.428, "periodo": {"inicio": "2025-08", "fim": "2026-07"},
                                   "infomercado_12m": {"numero": "229", "publicado_pct": 92.55, "resultado": "ressalva"}}}}
        t = mod.resposta_p034(mg)
        self.assertIn("92,55%", t)
        self.assertIn("não reproduz", t)


class ConsolidacaoAnualMme(unittest.TestCase):
    def test_extracao_e_conferencia_do_ess_anual(self):
        r = mm.consolidacao_anual(_texto("mme_consolidacao_2025_recorte.txt"), 2025)
        self.assertEqual(r["valores"]["consumo_sem_perdas_gwh"], 562243.0)
        self.assertEqual((r["valores"]["acr_pct"], r["valores"]["acl_pct"]), (54.4, 45.6))
        self.assertEqual((r["valores"]["ess_bilhoes_rs"], r["valores"]["ess_variacao_pct"]), (1.2, -53.0))
        self.assertEqual(r["paginas"]["acl_pct"], 13)
        ess = mod.ess_mensal_de({**_obs("encargo_ess_ancilar_2024.csv"), **_obs("encargo_ess_ancilar_2025.csv")})
        rec = mod.reconcilia_consolidacao_ess({"2025": r["valores"]}, ess)[0]
        # soma dos meses de 2025 no conjunto da CCEE: R$ 1.192,2 milhões, 53,6% abaixo de 2024
        self.assertAlmostEqual(rec["ccee_rs"] / 1e6, 1192.2, delta=0.05)
        self.assertAlmostEqual(rec["ccee_variacao_pct"], -53.6, delta=0.05)
        self.assertEqual(rec["resultado"], "aprovado")

    def test_participacao_anual_divergente_vira_ressalva(self):
        r = mm.consolidacao_anual(_texto("mme_consolidacao_2025_recorte.txt"), 2025)
        # EPE dados abertos, 2025 (silver de 01/10/2026): 44,82% de 567.232 GWh
        rec = mod.reconcilia_consolidacao_consumo({"2025": r["valores"]},
                                                  [{"ano": "2025", "livre_pct": 44.82, "total_mwh": 567232000.0, "completo": True}])[0]
        self.assertEqual(rec["resultado"], "ressalva")
        self.assertAlmostEqual(rec["diferenca_pp"], -0.78, delta=0.001)

    def test_pasta_restrita_por_login(self):
        trecho = ('<a href="https://www.gov.br/mme/@@multilingual-selector/notg/pt-br?post_path=/acl_users/credentials_cookie_auth/'
                  'require_login&amp;came_from=https%3A//www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/'
                  'publicacoes/boletim-de-monitoramento-do-sistema-eletrico/2025">')
        self.assertTrue(mod.pagina_exige_login(trecho))
        self.assertEqual(mm.links_boletins(trecho, "x"), [])
        self.assertFalse(mod.pagina_exige_login(_texto("mme_boletim_junho_2026_recorte.txt")))


class DatasECobertura(unittest.TestCase):
    def test_desligamentos_ano_corrente_parcial(self):
        from datetime import date
        _, regs = cm.leitor_desligamentos(_csv("desligamento_voluntario_recorte.csv", ","))
        datas = [ch.split("|")[2] for ch, campo, _ in regs if campo == "agente"]
        cob = mod.cobertura_desligamentos(datas + ["2025-12-01"], date(2026, 10, 1))
        self.assertFalse(cob["2026"]["completo"])
        self.assertEqual(cob["2026"]["meses"], 9)
        self.assertEqual(cob["2026"]["ultima_data"], "2026-09-01")
        self.assertTrue(cob["2025"]["completo"])

    def test_posicao_do_cadastro_nunca_usa_a_captura(self):
        """Sem data de modificação informada pelo portal, a referência é 'sem_data', não a captura."""
        from pipeline.energia import base
        tmp = tempfile.mkdtemp()
        try:
            arq = os.path.join(tmp, "perfis.csv")
            cab = ";".join(cm.CONJUNTOS["lista_perfil_v1"]["colunas"])
            linha = ";".join(["1", "AG", "AGENTE", "04423567000121", "10", "AG P", "Consumidor Livre", "ATIVO", "", "SE", "", ""])
            with open(arq, "w", encoding="utf-8") as f:
                f.write(cab + "\n" + linha + "\n")
            con = base.conecta(":memory:")
            vid, _ = base.registra_vintage(con, "ccee_lista_perfil_v1", "lista_perfil_v1_2026", "x", "2026-10-01T00:45:51Z", None,
                                           "0" * 64, 10, "teste", arq)
            cm.processa_vintage(con, "lista_perfil_v1", {"vintage_id": vid, "recurso": "lista_perfil_v1_2026", "arquivo": arq,
                                                          "publicado_em": None, "capturado_em": "2026-10-01T00:45:51Z"})
            refs = {r for (r,) in con.execute("SELECT DISTINCT ref FROM observacoes WHERE dataset='ccee_lista_perfil_v1'")}
            self.assertEqual(refs, {cm.REF_SEM_DATA})
        finally:
            shutil.rmtree(tmp)
        t = mod.resposta_p033({"kpis": {}, "perfis": {"perfis_ativos": 10, "agentes_ativos": 5, "data_modificacao_portal": None}})
        self.assertIn("sem data informada pelo portal", t)
        t = mod.resposta_p033({"kpis": {}, "perfis": {"perfis_ativos": 10, "agentes_ativos": 5, "data_modificacao_portal": "2026-09-01"}})
        self.assertIn("data de modificação de 01/09/2026 informada pelo portal", t)


class AcessoCceePendente(unittest.TestCase):
    def test_sem_autorizacao_nenhuma_requisicao(self):
        from pipeline.energia import base

        def proibido(*a, **k):
            raise AssertionError("requisição à CCEE sem autorização")
        con = base.conecta(":memory:")
        st = cm.coleta(con, baixar_meta=proibido, baixador=proibido, autorizada=False)
        self.assertEqual(st["coleta"], "suspensa")
        st = cm.coleta_infomercado(con, baixador=proibido, baixar_pagina=proibido, autorizada=False)
        self.assertEqual(st["coleta"], "suspensa")
        self.assertFalse(cm.coleta_autorizada({}))
        self.assertTrue(cm.coleta_autorizada({"ENERGIA_CCEE_COLETA": "1"}))

    def test_paineis_que_dependem_da_ccee_ficam_pendentes(self):
        import json
        with open(os.path.join(os.path.dirname(DADOS), "..", "..", "..", "public", "energia", "gold", "mercado.json"), encoding="utf-8") as f:
            g = json.load(f)
        self.assertEqual(g["acesso_ccee"]["decisao"]["situacao"], "pendente")
        for p in g["paineis"]:
            self.assertTrue(p["depende_da_ccee"], p["id"])
            self.assertEqual(p["estado_dados"], "pendente_decisao_acesso", p["id"])
        self.assertEqual(len(cm.CONJUNTOS), 17)
        with open(os.path.join(os.path.dirname(DADOS), "..", "..", "..", "docs", "observatorios", "energia", "modulos", "mercado.md"), encoding="utf-8") as f:
            doc = f.read()
        self.assertTrue("17 conjuntos" in doc and "19 conjuntos" not in doc, "o documento deve dizer 17 conjuntos abertos da CCEE")


if __name__ == "__main__":
    unittest.main()
