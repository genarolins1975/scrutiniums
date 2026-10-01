"""Testes do módulo Empresas (P036 a P039) com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_empresas/ (tirados dos arquivos oficiais capturados em
30/09/2026; a única alteração é o nome de pessoa física, trocado por um marcador, que não entra
em nenhuma regra):
- siga_recorte.csv: 14 usinas do SIGA diário de 30/09/2026 (PCH E da AngloGold, 14 de Julho da
  CERAN, Abaúna com 50% e 50%, Cachoeira da Onça com proprietário pessoa física, Glória com seis
  sócios e percentuais de 4 casas, Machadinho com sete sócios e o nome "DME DISTRIBUICAO S.A. -
  DMED", Salto Claudelino, Serra da Mesa, São João da Boa Vista com matriz e filial a 100% cada,
  Trombini "Não Informado", Belo Monte, Frascal, uma usina em construção e uma não iniciada);
- agentes_geracao_recorte.csv: as mesmas usinas no conjunto Agentes de Geração de 01/09/2026;
- agentes_setor_recorte.csv: dez CNPJ do cadastro de agentes, com um parque solar e a ANATEL
  marcados no ramo "distribuição";
- polimero_recorte.parquet: árvores societárias completas de sete agentes (CEMIG D, Ampla, EDP
  SP, Cooperativa Aliança, CERAN, Light SESA, RGE Sul) no 1º e no 2º trimestre de 2026;
- dfp_2024_recorte.zip, dfp_2025_recorte.zip, itr_2025_recorte.zip, cad_cia_aberta_recorte.csv:
  linhas originais (Latin-1) da CVM de CEMIG, CEMIG Distribuição e CPFL Energia, nos mesmos
  membros e cabeçalhos dos zips oficiais; o cadastro tem também a linha original da Suzano
  (setor Papel e Celulose, registro ativo);
- dfp_2025_casos_recorte.zip: DFP 2025 original (sha256 336a92cc…) da Rio Paranapanema Energia,
  que entrega o consolidado inteiro com zero e o individual preenchido, e da Ferreira Gomes
  Energia, que publica DT_INI_EXERC = 1º de dezembro num exercício inteiro; só as contas lidas
  pelo módulo, linhas inalteradas;
- dfp_2019_light_recorte.zip: DFP 2019 original (sha256 bc82a116…) da Light SESA, com DT_INI_EXERC
  2019-12-01 e o comparativo de 2018;
- itr_2026_celgpar_recorte.zip: ITR 2026 original (sha256 8d055a5a…) da CELGPAR, com o
  individual inteiro zerado nos dois trimestres e sem consolidado;
- golds_origem_recorte.json: CEMIG D, CPFL Santa Cruz, CPFL Santa Cruz antiga, RGE Sul e RGE
  antiga nas golds perdas.json, qualidade.json e conta.json de 30/09/2026, com os blocos de
  proveniência que o índice herda (taxas, separação, distribuidoras, limites, tarifas);
- dfp_2021_equatorial_go_recorte.zip e dfp_2022_equatorial_go_recorte.zip: DFP 2021 (sha256
  64b8693b…, escala marcada UNIDADE) e DFP 2022 (sha256 dd67d4fb…, MIL, com o mesmo VL_CONTA de
  2021 no comparativo) da Equatorial Goiás; dfp_2019_celeo_recorte.zip e dfp_2020_celeo_recorte.zip:
  DFP 2019 (UNIDADE) e 2020 (MIL) da Celeo Redes; itr_2021_equatorial_go_chesf_recorte.zip: ITR
  2021 (sha256 c8723d5c…) da Equatorial Goiás (1º trimestre em MIL, 2º e 3º em UNIDADE), da AXIA
  Energia Nordeste (consolidado de 31/03 e 30/06 com ativo 1 e o 2º trimestre da DRE consolidada
  com 0 e 1: coluna não preenchida) e o índice com a versão 1 do documento de 30/06/2021 da
  02.291.077/0001-93 entregue duas vezes; dfp_2025_celgpar_recorte.zip: DFP 2025 (sha256
  336a92cc…) da CELGPAR, com a DRE e a DFC do individual zeradas e o saldo final de caixa de 2024
  no comparativo. Só as contas lidas pelo módulo, linhas inalteradas;
- siget_contratos_recorte.csv, siget_modulos_recorte.csv, siget_linhas_recorte.csv e
  siget_equipamentos_recorte.csv: SIGET de 29/09/2026, contratos 012/2007 (AXIA Nordeste),
  011/2007 (ATE VI, CNPJ publicado sem o zero à esquerda), 013/2007 (ATE VII, com obras
  autorizadas no contrato 060/2001 da COPEL-GT e uma linha repetida por obra), 006/2010 (AXIA,
  CNPJ publicado com 10 dígitos, transformador reserva) e 032/2018 (sem CNPJ), com todos os
  módulos, linhas e equipamentos desses contratos; no recorte dos módulos as colunas de texto
  livre DscEpd, DscObr e DscMdl foram esvaziadas para caber (nenhuma é lida), as demais estão
  inalteradas.

O teste do HHI contra o SIGA inteiro (test_hhi_publicado_contra_o_siga_original) e os testes que
leem a gold publicada são pulados quando o bronze ou a gold não existem (no CI sem bronze); os
recortes acima cobrem os mesmos casos sem o arquivo inteiro.
"""
import csv
import io
import json
import os
import re
import subprocess
import sys
import unittest
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, metricas  # noqa: E402
from pipeline.energia import evidencia as evid  # noqa: E402
from pipeline.energia.fontes import aneel_empresas as ae  # noqa: E402
from pipeline.energia.fontes import cvm_empresas as cv  # noqa: E402
from pipeline.energia.metricas import empresas as metricas_empresas  # noqa: E402
from pipeline.energia.modulos import empresas as mod  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_empresas")
CEMIG, CEMIG_D, CPFL = "17155730000164", "06981180000116", "02429144000193"


def _csv(nome, enc="utf-8-sig"):
    with open(os.path.join(DADOS, nome), encoding=enc, newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _siga():
    return ae.le_siga(_csv("siga_recorte.csv"))


def _agentes_geracao():
    return ae.le_agentes_geracao(_csv("agentes_geracao_recorte.csv"))


def _polimero():
    caminho = os.path.join(DADOS, "polimero_recorte.parquet")
    return ae.le_polimero(lambda: ae.linhas_polimero(caminho))


BRONZE_SIGA = os.path.join(base.RAIZ, "data/energia/bronze/aneel/aneel_siga/siga-empreendimentos-geracao-diario.csv/"
                           "20260930T221854Z.139603153f57.csv.gz")
_ITEM = re.compile(r"(?:^|, )(\d+(?:\.\d+)?)% para ")
_CNPJ_FMT = re.compile(r"(\d{2})\.(\d{3})\.(\d{3})/(\d{4})-(\d{2})")


def _particao_independente(linhas):
    """Partição da potência em operação por CNPJ, sem o código do módulo: cada item começa em
    '<pct>% para ', o documento é o último CNPJ formatado do item, soma válida dentro de
    0,005 p.p. por item e normalização pela soma. Retorna ({cnpj: kW}, kW sem documento, kW
    da fronteira, usinas da fronteira)."""
    vistos, partes = set(), {}
    sem_doc = fronteira = 0.0
    usinas = 0
    for r in linhas:
        nuc = int(r["IdeNucleoCEG"])
        if nuc in vistos:
            continue
        vistos.add(nuc)
        kw_txt = (r["MdaPotenciaFiscalizadaKw"] or "").strip()
        if r["DscFaseUsina"] != "Operação" or not kw_txt:
            continue
        kw = float(kw_txt.replace(".", "").replace(",", "."))
        texto = r["DscPropriRegimePariticipacao"] or ""
        inicios = list(_ITEM.finditer(texto))
        itens = []
        for i, m in enumerate(inicios):
            corpo = texto[m.end():inicios[i + 1].start() if i + 1 < len(inicios) else len(texto)]
            docs = _CNPJ_FMT.findall(corpo)
            itens.append((float(m.group(1)), "".join(docs[-1]) if docs else None))
        soma = sum(p for p, _ in itens)
        if not itens or kw <= 0 or abs(soma - 100.0) > 0.005 * len(itens) + 1e-9:
            continue
        fronteira += kw
        usinas += 1
        for p, c14 in itens:
            if c14:
                partes[c14] = partes.get(c14, 0.0) + kw * p / soma
            else:
                sem_doc += kw * p / soma
    return partes, sem_doc, fronteira, usinas


def _hhi_independente(partes, total):
    cotas = sorted((100.0 * v / total for v in partes.values() if v > 0), reverse=True)
    return sum(x * x for x in cotas), sum(cotas[:4]), sum(cotas[:10]), len(cotas)


def _silver_cvm():
    """Silver em memória com os três zips do recorte processados pelo mesmo código do módulo."""
    con = base.conecta(":memory:")
    for ds, rec, arq in ((mod.DS_DFP, "dfp_cia_aberta_2024.zip", "dfp_2024_recorte.zip"),
                         (mod.DS_DFP, "dfp_cia_aberta_2025.zip", "dfp_2025_recorte.zip"),
                         (mod.DS_ITR, "itr_cia_aberta_2025.zip", "itr_2025_recorte.zip")):
        caminho = os.path.join(DADOS, arq)
        vid, _ = base.registra_vintage(con, ds, rec, "https://dados.cvm.gov.br/", "2026-09-30T23:00:00Z", None,
                                       "0" * 64, os.path.getsize(caminho), "teste", caminho)
        mod._processa_doc(con, ds, "DFP" if ds == mod.DS_DFP else "ITR",
                          {"vintage_id": vid, "recurso": rec, "arquivo": caminho}, [CEMIG, CEMIG_D, CPFL])
    return con


# ============================================================================ P036: SIGA
class ReconciliacaoProprietariosSiga(unittest.TestCase):
    """Caminho independente: o texto de proprietários relido com outra técnica (corte por
    parêntese de regime e pelo último ' - ' antes do documento) contra a leitura do módulo."""

    def _releitura(self, texto):
        out = {}
        for item in re.split(r"(?<=\))(?:, )", texto):
            pct_txt, resto = item.split("% para ", 1)
            antes_regime = resto.rsplit(" (", 1)[0]
            doc = antes_regime.rsplit(" - ", 1)[1].strip()
            digitos = "".join(ch for ch in doc if ch.isdigit())
            if digitos:
                out[digitos] = out.get(digitos, 0.0) + float(pct_txt)
        return out

    def test_todas_as_usinas_do_recorte_batem(self):
        usinas, _ = _siga()
        comparadas = 0
        for linha in _csv("siga_recorte.csv"):
            k = str(int(linha["IdeNucleoCEG"]))
            texto = linha["DscPropriRegimePariticipacao"]
            if texto == "Não Informado":
                self.assertIsNone(usinas[k]["proprietarios"])
                continue
            esperado = self._releitura(texto)
            obtido = {c: p for c, p, _ in mod._agrega_por_cnpj(usinas[k]["proprietarios"])}
            self.assertEqual(set(esperado), set(obtido), k)
            for c in esperado:
                self.assertAlmostEqual(esperado[c], obtido[c], places=6)
            comparadas += 1
        self.assertEqual(comparadas, 13)

    def test_machadinho_nome_com_hifen_e_sete_socios(self):
        usinas, _ = _siga()
        props = usinas["1356"]["proprietarios"]
        self.assertEqual(len(props), 7)
        dme = next(p for p in props if p["cnpj"] == "23664303000104")
        self.assertEqual(dme["nome"], "DME DISTRIBUICAO S.A. - DMED")
        self.assertEqual(dme["pct"], 2.902)
        self.assertEqual(dme["regime"], "SP")
        self.assertEqual(usinas["1356"]["kw_fiscalizado"], 1140000.0)

    def test_valores_da_fonte(self):
        usinas, oc = _siga()
        self.assertEqual(oc["data_geracao"], "2026-09-30")
        self.assertEqual(usinas["30354"]["kw_fiscalizado"], 11233100.0)       # Belo Monte
        self.assertEqual(usinas["30354"]["proprietarios"][0]["cnpj"], "12300288000107")
        self.assertEqual(usinas["2731"]["proprietarios"][0]["regime"], "SP")  # Serra da Mesa, serviço público
        self.assertEqual(usinas["8"]["ceg"], "PCH.PH.MG.000008-6.1")          # núcleo sem zeros à esquerda

    def test_estados_de_vinculo(self):
        usinas, _ = _siga()
        est = {k: ae.estado_vinculo(u["proprietarios"]) for k, u in usinas.items()}
        self.assertEqual(est["8"], "vinculado")
        self.assertEqual(est["74"], "inclui_sem_documento")      # pessoa física sem CPF no SIGA
        self.assertEqual(est["27709"], "soma_divergente")        # matriz e filial com 100% cada
        self.assertEqual(est["27901"], "sem_proprietario")       # "Não Informado"
        self.assertEqual(est["1034"], "vinculado")               # 6 sócios, 4 casas, soma 100
        self.assertEqual(est["15"], "vinculado")                 # 50% e 50%

    def test_texto_com_sobra_nao_vira_vinculo_parcial(self):
        ok = "100% para CERAN - COMPANHIA ENERGETICA RIO DAS ANTAS - 04.237.975/0001-99 (PIE)"
        self.assertIsNotNone(ae.proprietarios_siga(ok))
        self.assertIsNone(ae.proprietarios_siga(ok + " texto solto"))
        self.assertIsNone(ae.proprietarios_siga("CERAN 100%"))
        self.assertIsNone(ae.proprietarios_siga(""))
        self.assertEqual(ae.estado_vinculo("nao_lido"), "nao_lido")

    def test_tolerancia_de_arredondamento_por_parcela(self):
        def props(*pcts):
            return [{"pct": p, "cnpj": f"{i:014d}", "nome": "x", "regime": "PIE"} for i, p in enumerate(pcts, 1)]
        self.assertEqual(ae.estado_vinculo(props(33.33, 33.33, 33.33)), "vinculado")     # 99,99 com 3 parcelas
        self.assertEqual(ae.estado_vinculo(props(50.0, 50.02)), "soma_divergente")       # 0,02 p.p. com 2 parcelas
        self.assertEqual(ae.estado_vinculo(props(0.01)), "soma_divergente")


class ConferenciaAgentesGeracao(unittest.TestCase):
    def test_conjunto_independente_confirma_o_siga(self):
        usinas, _ = _siga()
        ag, oc = _agentes_geracao()
        self.assertEqual(oc["data_geracao"], "2026-09-01")
        self.assertEqual(oc["cpf_mascarado"], 1)
        comp = ae.compara_vinculos(usinas, ag)
        # Salto Claudelino e Frascal têm CNPJ diferente nas duas fontes (SIGA de 30/09, Agentes
        # de Geração de 01/09); a causa não foi verificada: pode ser mudança de proprietário
        # entre as datas ou divergência de cadastro. As demais batem CNPJ a CNPJ
        self.assertEqual(comp["cnpj_diferentes"], 2)
        self.assertEqual({e["nucleo"] for e in comp["exemplos"]}, {"2592", "31041"})
        self.assertEqual(comp["percentual_diferente"], 0)
        self.assertEqual(comp["iguais"], comp["comparadas"] - 2)

    def test_cpf_mascarado_nao_vira_chave(self):
        ag, _ = _agentes_geracao()
        pf = ag["74"][0]
        self.assertIsNone(pf["cnpj"])
        self.assertEqual(pf["tipo_documento"], "cpf_mascarado")


class MetricasDeAtivos(unittest.TestCase):
    def setUp(self):
        self.usinas, _ = _siga()
        self.at = mod._ativos(self.usinas, None, {})

    def test_capacidade_proporcional_e_controle_sao_distintas(self):
        dme = self.at["donos"]["23664303000104"]
        # Machadinho: as sete parcelas somam 100,0001% (arredondamento da fonte, dentro da
        # tolerância); a parcela é normalizada pela soma publicada
        soma = 29.2297 + 27.3392 + 20.4802 + 8.8069 + 5.9659 + 5.2762 + 2.9020
        self.assertAlmostEqual(soma, 100.0001, places=9)
        self.assertAlmostEqual(dme["kw_prop"], 1140000.0 * 2.902 / soma, places=3)  # 33.082,77 kW
        self.assertEqual(dme["kw_controle"], 0.0)                                     # 2,9% não controla
        cba = self.at["donos"]["61409892000173"]
        self.assertAlmostEqual(cba["kw_prop"], 1140000.0 * 29.2297 / soma, places=3)
        self.assertEqual(cba["kw_controle"], 0.0)                                     # maior sócio sem maioria
        norte = self.at["donos"]["12300288000107"]
        self.assertEqual(norte["kw_prop"], 11233100.0)
        self.assertEqual(norte["kw_controle"], 11233100.0)

    def test_particao_sem_dupla_contagem(self):
        fr = self.at["fronteira"]
        soma = sum(d["kw_prop"] for d in self.at["donos"].values()) + fr["kw_sem_documento"]
        self.assertAlmostEqual(soma, fr["kw_valido"], places=6)
        self.assertAlmostEqual(sum(g["kw_prop"] for g in self.at["grupos"].values()),
                               sum(d["kw_prop"] for d in self.at["donos"].values()), places=4)

    def test_fronteira_exclui_invalidas_e_fora_de_operacao(self):
        fr = self.at["fronteira"]
        # 70.000 kW (matriz e filial) e 4.870 kW (não informado) ficam fora; construção não soma
        self.assertAlmostEqual(fr["kw_total_operacao"] - fr["kw_valido"], 70000.0 + 4870.0, places=3)
        self.assertEqual(fr["kw_sem_documento"], 360.0)                 # a CGH da pessoa física
        # sem CNPJ acima de 50%: Machadinho (maior sócio 29%), Abaúna (50% e 50%), Glória (TRIADE com
        # 44%), Frascal (17%) e a CGH da pessoa física (100% sem CNPJ: majoritário não identificável)
        self.assertAlmostEqual(fr["kw_sem_majoritario"], 1140000.0 + 720.0 + 13800.0 + 2200.0 + 360.0, places=3)

    def test_ausencia_de_potencia_nao_vira_zero(self):
        self.assertIsNone(ae.numero(""))
        self.assertIsNone(ae.numero(None))
        self.assertEqual(ae.numero("1400,00"), 1400.0)
        self.assertEqual(ae.numero("1.140.000,00"), 1140000.0)


# ============================================================================ cadastro de agentes
class CadastroDeAgentes(unittest.TestCase):
    def test_ramo_autodeclarado_nao_define_distribuidora(self):
        ag, oc = ae.le_cadastro_agentes(_csv("agentes_setor_recorte.csv"))
        self.assertEqual(oc["data_geracao"], "2026-09-01")
        self.assertTrue(ag["13744588000130"]["distribuicao"])   # parque solar marcado como distribuição
        self.assertTrue(ag["02030715000112"]["distribuicao"])   # ANATEL marcada como distribuição
        with open(os.path.join(DADOS, "golds_origem_recorte.json"), encoding="utf-8") as f:
            golds = json.load(f)
        universo = mod._distribuidoras_das_golds(golds)
        self.assertNotIn("13744588000130", universo)
        self.assertNotIn("02030715000112", universo)
        self.assertIn(CEMIG_D, universo)


# ============================================================================ P039: Polímero
class PolimeroSemanticaEControle(unittest.TestCase):
    def setUp(self):
        self.pol = _polimero()
        self.g = ae.grafo_vigente(self.pol, self.pol["referencia"])

    def test_percentual_e_relativo_ao_agente_declarante(self):
        # Ampla (2º tri 2026): Enel Brasil tem 99,89% no nível 1; os sócios da Enel Brasil no
        # nível 2 somam 99,89 (e não 100): o percentual publicado é relativo à Ampla
        arv = self.pol["arvores"][("33050071000158", (2026, 2))][0]
        n1 = next(a for a in arv["arestas"] if a["nivel"] == 1 and a["socio"] == "07523555000167")
        n2 = [a for a in arv["arestas"] if a["nivel"] == 2 and a["pai"] == "07523555000167"]
        self.assertEqual(n1["pct"], 99.89)
        self.assertAlmostEqual(sum(a["pct"] for a in n2), 99.89, places=6)
        listas = ae._listas_da_arvore(arv)
        enel_americas = next(a for a in listas["07523555000167"] if a["nome"] == "Enel Americas S.A.")
        self.assertAlmostEqual(enel_americas["pct"], 100.0 * 99.56 / 99.89, places=9)

    def test_no_em_dois_caminhos_fica_sem_percentual_direto(self):
        # RGE Sul: CPFL Energia é sócia direta (89,01%) e via CPFL Brasil (10,99%)
        arv = self.pol["arvores"][("02016440000162", (2026, 2))][0]
        listas = ae._listas_da_arvore(arv)
        self.assertTrue(all(a["pct"] is None for a in listas["02429144000193"]))
        self.assertEqual(next(a for a in listas["02016440000162"] if a["socio"] == CPFL)["pct"], 89.01)

    def test_trimestre_de_referencia_conta_agentes_distintos(self):
        self.assertEqual(self.pol["periodos"], {(2026, 1): 7, (2026, 2): 7})
        self.assertEqual(self.pol["referencia"], (2026, 2))
        self.assertEqual(ae.periodo_referencia({(2026, 1): 3053, (2026, 2): 2900, (2026, 3): 33}), (2026, 2))
        self.assertEqual(ae.periodo_referencia({(2026, 1): 3000, (2026, 2): 2000}), (2026, 1))

    def test_cadeias_e_motivos_de_parada(self):
        c = lambda x: ae.cadeia_de_controle(self.g, x)  # noqa: E731
        ampla = c("33050071000158")
        self.assertEqual(ampla["cadeia"], ["33050071000158", "07523555000167"])
        self.assertEqual(ampla["motivo_parada"], "sem_cnpj")
        self.assertEqual(ampla["acima"], "Enel Americas S.A.")
        edp = c("02302100000106")
        self.assertEqual(edp["topo"], "03983431000103")
        self.assertEqual(edp["motivo_parada"], "compartilhado")      # duas controladoras estrangeiras
        coop = c("83647990000181")
        self.assertEqual(coop["motivo_parada"], "pessoa_fisica")
        self.assertIsNone(coop["acima"])                               # nome de pessoa física não sai
        light = c("60444437000146")
        self.assertEqual(light["topo"], "03378521000175")
        self.assertEqual(light["motivo_parada"], "sem_controlador")
        cemig_d = c(CEMIG_D)
        self.assertEqual(cemig_d["cadeia"], [CEMIG_D, CEMIG, "18715615000160"])   # Estado de Minas Gerais

    def test_concordancia_real_abaixo_do_limiar_deixa_ambiguo(self):
        # No recorte, CPFL Energia aparece nas árvores da RGE Sul (controladora única State Grid)
        # e da CERAN, que não concorda: 2 de 3 listas, abaixo de 90%
        self.assertEqual(self.g["origem"][CPFL], "ambigua")
        ceran = ae.cadeia_de_controle(self.g, "04237975000199")
        self.assertEqual(ceran["cadeia"], ["04237975000199", "03953509000147", CPFL])
        self.assertEqual(ceran["motivo_parada"], "ambigua")

    def test_regra_de_concordancia_e_declaracao_propria(self):
        def arv(raiz, pai, controladores, per=(2026, 2)):
            ars = [{"pai": raiz, "socio": pai, "nome": "X", "pct": 100.0, "controlador": True, "perfil": "PJ",
                    "governo": False, "estrangeira": False, "nivel": 1}]
            ars += [{"pai": pai, "socio": c_, "nome": c_, "pct": 50.0, "controlador": True, "perfil": "PJ",
                     "governo": False, "estrangeira": False, "nivel": 2} for c_ in controladores]
            return {"raiz": raiz, "nome": raiz, "arestas": ars}
        H, A, B = "00000000000100", "00000000000200", "00000000000300"
        def pol(n_a, n_b, propria=None):
            arvores = {}
            for i in range(n_a):
                arvores[(f"{i + 1:014d}", (2026, 2))] = [arv(f"{i + 1:014d}", H, [A])]
            for i in range(n_b):
                arvores[(f"{i + 101:014d}", (2026, 2))] = [arv(f"{i + 101:014d}", H, [B])]
            if propria:
                arvores[(H, (2026, 2))] = [{"raiz": H, "nome": "H", "arestas": [
                    {"pai": H, "socio": propria, "nome": propria, "pct": 60.0, "controlador": True, "perfil": "PJ",
                     "governo": False, "estrangeira": False, "nivel": 1}]}]
            return {"arvores": arvores, "ultima_declaracao": {}}
        g = ae.grafo_vigente(pol(9, 1), (2026, 2))
        self.assertEqual(ae.controlador_direto(g, H)[0], A)          # 9 de 10 concordam
        g = ae.grafo_vigente(pol(8, 2), (2026, 2))
        self.assertEqual(g["origem"][H], "ambigua")                  # 8 de 10 não bastam
        g = ae.grafo_vigente(pol(8, 2, propria=B), (2026, 2))
        self.assertEqual(ae.controlador_direto(g, H)[0], B)          # a declaração do próprio agente prevalece

    def test_ciclo_encerra_a_subida(self):
        X, Y = "00000000000100", "00000000000200"
        a = lambda pai, socio: {"pai": pai, "socio": socio, "nome": socio, "pct": 100.0, "controlador": True,  # noqa: E731
                                "perfil": "PJ", "governo": False, "estrangeira": False, "nivel": 1}
        g = {"origem": {X: "propria", Y: "propria"}, "socios": {X: [a(X, Y)], Y: [a(Y, X)]}}
        r = ae.cadeia_de_controle(g, X)
        self.assertEqual(r["motivo_parada"], "ciclo")
        self.assertEqual(r["cadeia"], [X, Y])


class Concentracao(unittest.TestCase):
    def test_hhi_de_particoes_conhecidas(self):
        self.assertEqual(mod._concentracao({"a": 50.0, "b": 50.0}, 100.0)["hhi"], 5000.0)
        self.assertEqual(mod._concentracao({"a": 100.0}, 100.0)["hhi"], 10000.0)
        # parcela sem participante identificável fica no denominador: limite inferior
        x = mod._concentracao({"a": 50.0}, 100.0)
        self.assertEqual((x["hhi"], x["cr4"]), (2500.0, 50.0))
        self.assertIsNone(mod._concentracao({}, 0.0))
        self.assertEqual(mod._faixa_hhi(1499.9), "nao_concentrado")
        self.assertEqual(mod._faixa_hhi(2500.0), "moderado")
        self.assertEqual(mod._faixa_hhi(2500.1), "alto")

    def test_hhi_do_recorte_por_parser_independente(self):
        """O SIGA do recorte relido por outro parser (csv + expressão por item '% para' e o
        último CNPJ formatado do item) dá a mesma partição e o mesmo HHI que o módulo; os
        números esperados estão escritos aqui (calculados à mão a partir do arquivo)."""
        partes, sem_doc, fronteira, usinas = _particao_independente(_csv("siga_recorte.csv"))
        self.assertEqual((fronteira, usinas, sem_doc), (13769380.0, 10, 360.0))
        hhi, cr4, cr10, n = _hhi_independente(partes, fronteira)
        self.assertAlmostEqual(hhi, 6756.4949, places=3)          # Belo Monte domina o recorte
        self.assertAlmostEqual(cr4, 95.5234, places=3)
        self.assertEqual(n, 26)
        at = mod._ativos(_siga()[0], None, {})
        self.assertEqual(at["fronteira"]["kw_valido"], fronteira)
        conc = mod._concentracao({k: d["kw_prop"] for k, d in at["donos"].items()}, at["fronteira"]["kw_valido"])
        self.assertAlmostEqual(conc["hhi"], hhi, delta=0.05)
        self.assertAlmostEqual(conc["cr4"], cr4, delta=0.005)
        for c14, kw in partes.items():
            self.assertAlmostEqual(at["donos"][c14]["kw_prop"], kw, places=6, msg=c14)

    @unittest.skipUnless(os.path.exists(os.path.join(base.GOLD, "empresas.json")) and os.path.exists(BRONZE_SIGA)
                         and os.path.exists(os.path.join(base.SERIES, "empresas_proprietarios.csv")), "bronze ou gold ausente")
    def test_hhi_publicado_contra_o_siga_original(self):
        """Caminho independente sobre o arquivo inteiro do SIGA de 30/09/2026 (sha256
        139603153f57…): partição por proprietário direto relida por outro parser; o nível de
        grupo agrega essa partição pelo mapa proprietário → grupo publicado (testa partição e
        agregação; a derivação da cadeia é testada em PolimeroSemanticaEControle)."""
        import gzip
        with open(os.path.join(base.GOLD, "empresas.json"), encoding="utf-8") as f:
            g = json.load(f)
        with gzip.open(BRONZE_SIGA, "rt", encoding="utf-8-sig") as f:
            partes, sem_doc, fronteira, usinas = _particao_independente(csv.DictReader(f, delimiter=";"))
        # números do arquivo de 30/09/2026, escritos aqui
        self.assertEqual((fronteira, usinas, round(sem_doc)), (220501811.0, 22665, 42660))
        hhi, cr4, cr10, n = _hhi_independente(partes, fronteira)
        self.assertEqual((round(hhi, 1), round(cr4, 2), round(cr10, 2), n), (135.3, 18.21, 31.78, 4691))
        pub = g["controle"]["concentracao"]["proprietario_direto"]
        self.assertEqual((pub["hhi"], pub["cr4"], pub["cr10"], pub["participantes"]), (135.3, 18.21, 31.78, 4691))
        self.assertEqual(g["controle"]["fronteira"]["mw"], round(fronteira / 1000.0, 1))
        with open(os.path.join(base.SERIES, "empresas_proprietarios.csv"), encoding="utf-8") as f:
            grupo = {r["cnpj"]: r["grupo_cnpj"] for r in csv.DictReader(f, delimiter=";")}
        por_grupo = {}
        for c14, kw in partes.items():
            por_grupo[grupo[c14]] = por_grupo.get(grupo[c14], 0.0) + kw
        hhi_g, cr4_g, cr10_g, n_g = _hhi_independente(por_grupo, fronteira)
        self.assertEqual((round(hhi_g, 1), round(cr4_g, 2), round(cr10_g, 2), n_g), (392.1, 29.65, 46.72, 3284))
        pub = g["controle"]["concentracao"]["grupo_proporcional"]
        self.assertEqual((pub["hhi"], pub["cr4"], pub["cr10"], pub["participantes"]), (392.1, 29.65, 46.72, 3284))
        # EOL: a fronteira tem 34.936.645 kW; o SIGA tem 34.936.651 kW em operação, e a diferença
        # é a Ventos do Brejo A-6 (6 kW, proprietário 'Não Informado')
        eol = next(t for t in g["controle"]["concentracao"]["por_tipo"] if t["tipo"] == "EOL")
        self.assertEqual(eol["mw"], 34936.6)


# ============================================================================ P037: distribuidoras
class IndiceDeDistribuidoras(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(DADOS, "golds_origem_recorte.json"), encoding="utf-8") as f:
            self.golds = json.load(f)
        ag, _ = ae.le_cadastro_agentes(_csv("agentes_setor_recorte.csv"))
        self.agentes = {k: {"sigla": r["sigla"], "razao_social": r["razao_social"], "ativo": r["ativo"], "ramos": []}
                        for k, r in ag.items()}
        cadeia = lambda x: {"topo": x, "cadeia": [x], "motivo_parada": "sem_declaracao", "pcts": [], "acima": None}  # noqa: E731
        self.r = mod._indice_distribuidoras(self.golds, self.agentes, {}, cadeia, {}, {})
        self.it = {i["cnpj"]: i for i in self.r["itens"]}

    def test_valores_iguais_aos_das_golds_de_origem(self):
        p = next(d for d in self.golds["perdas.json"]["distribuidoras"] if d["cnpj"] == CEMIG_D)
        q = next(d for d in self.golds["qualidade.json"]["distribuidoras"] if d["cnpj"] == CEMIG_D)
        t = next(d for d in self.golds["conta.json"]["tarifas"]["vigentes"] if d["cnpj"] == CEMIG_D)
        i = self.it[CEMIG_D]
        self.assertEqual(i["perdas"]["taxa_total_pct"], p["referencia"]["taxa_total_pct"])
        self.assertEqual((i["qualidade"]["dec"], i["qualidade"]["fec"]), (q["dec"], q["fec"]))
        self.assertEqual(i["tarifa"]["total"], t["total"])
        # números de 30/09/2026 escritos aqui: 12,12% de perdas em 2025, DEC 8,98 h, B1 R$ 903,29/MWh
        self.assertEqual((i["perdas"]["taxa_total_pct"], i["qualidade"]["dec"], i["tarifa"]["total"]), (12.12, 8.98, 903.29))
        self.assertEqual(i["ufs"], ["MG"])
        self.assertEqual(i["nome"], "CEMIG DISTRIBUICAO S.A")          # razão social do cadastro

    def test_slug_estavel_incorporadas_e_aliases(self):
        s = {c: (i["slug"], i["slugs_alternativos"]) for c, i in self.it.items()}
        self.assertEqual(s[CEMIG_D], ("cemig-d", []))
        # RGE Sul (ativa) fica com "rge"; a RGE incorporada em 2018 recebe a raiz do CNPJ
        self.assertEqual(s["02016440000162"], ("rge", ["rge-sul"]))
        self.assertEqual(s["02016439000138"][0], "rge-02016439")
        # Jaguari incorporou a CPFL Santa Cruz antiga e usa a sigla dela nas tarifas
        self.assertEqual(s["53859112000169"], ("cpfl-santa-cruz", ["cpfl-jaguari"]))
        self.assertEqual(s["61116265000144"][0], "cpfl-santa-cruz-61116265")
        todos = [i["slug"] for i in self.r["itens"]] + [a for i in self.r["itens"] for a in i["slugs_alternativos"]]
        self.assertEqual(len(todos), len(set(todos)))

    def test_multiestadual_inativa_e_ausencia(self):
        self.assertEqual(self.it["53859112000169"]["ufs"], ["MG", "PR", "SP"])
        antiga = self.it["61116265000144"]
        self.assertFalse(antiga["ativa"])
        self.assertIsNone(antiga["qualidade"])                        # ausência, não zero
        self.assertFalse(antiga["tarifa"]["vigente"])
        self.assertIn("53859112000169", antiga["tarifa"]["motivo"])  # incorporação registrada na fonte


# ============================================================================ P038: CVM
class ReconciliacaoCvm(unittest.TestCase):
    """Caminho independente: o CSV original do zip relido com csv e aritmética própria."""

    def _bruto(self, arq, membro, cnpj_fmt, conta, ordem="ÚLTIMO", ini=None, fim=None):
        with zipfile.ZipFile(os.path.join(DADOS, arq)) as z:
            texto = z.read(membro).decode("latin-1")
        for r in csv.DictReader(io.StringIO(texto), delimiter=";"):
            if r["CNPJ_CIA"] == cnpj_fmt and r["CD_CONTA"] == conta and r["ORDEM_EXERC"] == ordem and (
                    ini is None or r.get("DT_INI_EXERC") == ini) and (fim is None or r["DT_FIM_EXERC"] == fim):
                return float(r["VL_CONTA"]) * (1000 if r["ESCALA_MOEDA"] == "MIL" else 1)
        return None

    def setUp(self):
        self.fin = mod._financas(_silver_cvm(), {}, [], {})

    def test_receita_consolidada_cemig(self):
        esperado = self._bruto("dfp_2024_recorte.zip", "dfp_cia_aberta_DRE_con_2024.csv", "17.155.730/0001-64", "3.01")
        self.assertEqual(esperado, 39819620000.0)
        self.assertEqual(self.fin["anual"][CEMIG][("con", "receita")][2024], esperado)
        self.assertEqual(self.fin["anual"][CEMIG][("con", "receita")][2025], 42751283000.0)

    def test_consolidado_e_individual_separados(self):
        a = self.fin["anual"][CEMIG]
        self.assertEqual(a[("ind", "receita")][2024], 4125638000.0)
        self.assertNotEqual(a[("ind", "receita")][2024], a[("con", "receita")][2024])
        self.assertNotIn(("ind", "lucro_controladores"), a)            # conta só existe no consolidado
        # CEMIG Distribuição publica só o individual
        self.assertTrue(all(esc == "ind" for esc, _ in self.fin["anual"][CEMIG_D]))

    def test_divida_bruta_soma_duas_contas_do_mesmo_escopo(self):
        cp = self._bruto("dfp_2024_recorte.zip", "dfp_cia_aberta_BPP_con_2024.csv", "17.155.730/0001-64", "2.01.04")
        lp = self._bruto("dfp_2024_recorte.zip", "dfp_cia_aberta_BPP_con_2024.csv", "17.155.730/0001-64", "2.02.01")
        self.assertEqual((cp, lp), (2876548000.0, 9402752000.0))
        self.assertEqual(self.fin["anual"][CEMIG][("con", "divida_bruta")][2024], cp + lp)

    def test_trimestre_e_acumulado_no_ano_distintos(self):
        t = self.fin["trimestral"][CEMIG]
        tri = self._bruto("itr_2025_recorte.zip", "itr_cia_aberta_DRE_con_2025.csv", "17.155.730/0001-64", "3.01", ini="2025-04-01", fim="2025-06-30")
        acum = self._bruto("itr_2025_recorte.zip", "itr_cia_aberta_DRE_con_2025.csv", "17.155.730/0001-64", "3.01", ini="2025-01-01", fim="2025-06-30")
        self.assertEqual(t[("con", "receita", "trimestre")]["2025-06-30"], tri)
        self.assertEqual(tri, 10786295000.0)
        self.assertEqual(t[("con", "receita", "acumulado_no_ano")]["2025-06-30"], acum)
        self.assertEqual(acum, 20630526000.0)
        # 1º trimestre: o trimestre é o acumulado (mesmas datas); a DRE sai nos dois recortes
        self.assertEqual(t[("con", "receita", "trimestre")]["2025-03-31"], 9844231000.0)
        self.assertEqual(t[("con", "receita", "acumulado_no_ano")]["2025-03-31"], 9844231000.0)
        self.assertNotIn("2025-12-31", t[("con", "receita", "trimestre")])   # 4º trimestre não é deduzido

    def test_dfc_do_itr_sempre_acumulada(self):
        # a DFC do ITR é acumulada desde janeiro: o 1º trimestre entra na série acumulada e não
        # existe série 'trimestre' de caixa (o 2º e o 3º trimestres não são três meses)
        t = self.fin["trimestral"][CPFL]
        q1 = self._bruto("itr_2025_recorte.zip", "itr_cia_aberta_DFC_MI_con_2025.csv", "02.429.144/0001-93", "6.01",
                         ini="2025-01-01", fim="2025-03-31")
        self.assertEqual(q1, 2093648000.0)
        self.assertEqual(t[("con", "caixa_operacional", "acumulado_no_ano")]["2025-03-31"], q1)
        self.assertIn("2025-06-30", t[("con", "caixa_operacional", "acumulado_no_ano")])
        self.assertFalse(any(k[1].startswith("caixa_") and k[2] == "trimestre" for k in t))

    def test_comparativo_da_dfp_seguinte(self):
        # a DFP de 2025 reapresenta 2024: para a receita consolidada da CEMIG, sem mudança
        self.assertEqual(self.fin["anterior"][CEMIG][("con", "receita")][2024], 39819620000.0)
        doc = self.fin["docs_dfp"][f"doc|{CEMIG}|2024-12-31"]
        self.assertEqual((doc["versao"], doc["dt_receb"]), ("1", "2025-03-21"))

    def test_cadastro_cvm(self):
        cad, _ = cv.le_cadastro(_csv("cad_cia_aberta_recorte.csv", enc="latin-1"))
        self.assertEqual(cad[CEMIG]["cd_cvm"], "2453")
        self.assertIn(cad[CEMIG]["setor"], cv.SETORES_ENERGIA)
        self.assertEqual(cad[CEMIG]["situacao"], "ATIVO")

    def test_escala_e_conta_livre(self):
        # conta livre (ST_CONTA_FIXA = N) e escala desconhecida nunca entram
        cab = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA"
        linhas = [cab,
                  "17.155.730/0001-64;2024-12-31;2;X;002453;DRE;REAL;UNIDADE;ÚLTIMO;2024-01-01;2024-12-31;3.01;Receita de Venda;1500.5;S",
                  "17.155.730/0001-64;2024-12-31;2;X;002453;DRE;REAL;BILHAO;ÚLTIMO;2024-01-01;2024-12-31;3.05;Resultado;7;S",
                  "17.155.730/0001-64;2024-12-31;2;X;002453;DRE;REAL;MIL;ÚLTIMO;2024-01-01;2024-12-31;3.02;Custo;-9;N",
                  "17.155.730/0001-64;2024-12-31;1;X;002453;DRE;REAL;MIL;ÚLTIMO;2024-01-01;2024-12-31;3.11;Lucro;99;S"]
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("dfp_cia_aberta_DRE_con_2024.csv", ("\n".join(linhas) + "\n").encode("latin-1"))
        with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as z:
            vals, oc = cv.le_valores(z, "DFP", 2024, {"17.155.730/0001-64"})
        self.assertEqual([(v["conta"], v["valor"]) for v in vals], [("receita", 1500.5)])
        self.assertEqual(oc["escala_desconhecida"], 1)
        self.assertEqual(oc["versoes_descartadas"], 1)                 # versão 1 com a 2 presente


class CvmColunasZeradasEDataDeInicio(unittest.TestCase):
    """Casos reais da CVM que a primeira versão publicava errado: consolidado entregue com zero
    (virava receita e ativo zero na gold) e data de início mal preenchida (o exercício sumia)."""
    RIO_P, FERREIRA, LIGHT, CELGPAR = "02998301000181", "12489315000123", "60444437000146", "08560444000193"

    @classmethod
    def setUpClass(cls):
        con = base.conecta(":memory:")
        for ds, rec, arq, univ in ((mod.DS_DFP, "dfp_cia_aberta_2025.zip", "dfp_2025_casos_recorte.zip", [cls.RIO_P, cls.FERREIRA]),
                                   (mod.DS_DFP, "dfp_cia_aberta_2019.zip", "dfp_2019_light_recorte.zip", [cls.LIGHT]),
                                   (mod.DS_ITR, "itr_cia_aberta_2026.zip", "itr_2026_celgpar_recorte.zip", [cls.CELGPAR])):
            caminho = os.path.join(DADOS, arq)
            vid, _ = base.registra_vintage(con, ds, rec, "https://dados.cvm.gov.br/", "2026-09-30T23:00:00Z", None,
                                           "0" * 64, os.path.getsize(caminho), "teste", caminho)
            mod._processa_doc(con, ds, "DFP" if ds == mod.DS_DFP else "ITR",
                              {"vintage_id": vid, "recurso": rec, "arquivo": caminho}, univ)
        cls.fin = mod._financas(con, {}, [], {})

    def _linha(self, arq, membro, cnpj_fmt, conta, ordem="ÚLTIMO"):
        with zipfile.ZipFile(os.path.join(DADOS, arq)) as z:
            for r in csv.DictReader(io.StringIO(z.read(membro).decode("latin-1")), delimiter=";"):
                if r["CNPJ_CIA"] == cnpj_fmt and r["CD_CONTA"] == conta and r["ORDEM_EXERC"] == ordem:
                    return r
        return None

    def test_consolidado_zerado_e_ausencia_nunca_zero(self):
        # a fonte: consolidado de 2025 com ativo total e receita iguais a zero, individual preenchido
        con_at = self._linha("dfp_2025_casos_recorte.zip", "dfp_cia_aberta_BPA_con_2025.csv", "02.998.301/0001-81", "1")
        ind_at = self._linha("dfp_2025_casos_recorte.zip", "dfp_cia_aberta_BPA_ind_2025.csv", "02.998.301/0001-81", "1")
        self.assertEqual((float(con_at["VL_CONTA"]), float(ind_at["VL_CONTA"])), (0.0, 3986965.0))
        a = self.fin["anual"][self.RIO_P]
        self.assertFalse(any(esc == "con" for esc, _ in a))                       # nada do consolidado
        self.assertEqual(a[("ind", "receita")][2025], 1259476000.0)
        self.assertEqual(a[("ind", "ativo_total")][2025], 3986965000.0)
        z = self.fin["zeradas"]["DFP"]
        self.assertEqual(z[(self.RIO_P, "con", "U", "2025-12-31")], "escopo_nao_apresentado")
        self.assertEqual(z[(self.RIO_P, "con", "P", "2024-12-31")], "escopo_nao_apresentado")   # comparativo também
        self.assertNotIn(("ind", "receita"), {k for k in self.fin["anterior"][self.RIO_P] if k[0] == "con"})
        ult, esc, valores, alertas = mod._exibicao(self.RIO_P, a, self.fin)
        self.assertEqual((ult, esc), (2025, "ind"))
        self.assertEqual((valores["receita"], valores["ativo_total"]), (1259476000, 3986965000))
        self.assertIn("consolidado_nao_apresentado", alertas)
        self.assertEqual(self.fin["ativo_invalido"], [])

    def test_demonstracao_zerada_sem_outro_escopo(self):
        # CELGPAR, ITR 2026: individual inteiro zerado, sem consolidado; vira ausência
        self.assertEqual(self.fin["zeradas"]["ITR"][(self.CELGPAR, "ind", "U", "2026-03-31")], "demonstracao_zerada")
        self.assertEqual(self.fin["zeradas"]["ITR"][(self.CELGPAR, "ind", "U", "2026-06-30")], "demonstracao_zerada")
        self.assertNotIn(self.CELGPAR, self.fin["trimestral"])

    def test_inicio_inconsistente_light_2019(self):
        linha = self._linha("dfp_2019_light_recorte.zip", "dfp_cia_aberta_DRE_ind_2019.csv", "60.444.437/0001-46", "3.01")
        self.assertEqual((linha["DT_INI_EXERC"], linha["DT_FIM_EXERC"], float(linha["VL_CONTA"])), ("2019-12-01", "2019-12-31", 11912106.0))
        anterior = self._linha("dfp_2019_light_recorte.zip", "dfp_cia_aberta_BPA_ind_2019.csv", "60.444.437/0001-46", "1", "PENÚLTIMO")
        self.assertGreater(float(anterior["VL_CONTA"]), 0)                      # a companhia existia em 31/12/2018
        self.assertEqual(self.fin["anual"][self.LIGHT][("ind", "receita")][2019], 11912106000.0)
        self.assertEqual(self.fin["nota_inicio"][(self.LIGHT, "ind", "receita", 2019)], "2019-12-01")

    def test_inicio_inconsistente_ferreira_gomes_2025(self):
        a = self.fin["anual"][self.FERREIRA]
        self.assertEqual(a[("ind", "receita")][2025], 256519000.0)               # UHE de 252 MW, receita anual
        self.assertEqual(a[("ind", "caixa_investimento")][2025], 759000.0)
        ult, esc, valores, alertas = mod._exibicao(self.FERREIRA, a, self.fin)
        self.assertEqual((ult, esc, valores["receita"]), (2025, "ind", 256519000))
        self.assertIn("inicio_inconsistente_na_fonte", alertas)
        # o comparativo de 2024 também tem início em 1º de dezembro, mas o documento de 2025 não
        # prova que a companhia existia em 31/12/2023: fica fora do comparativo, nunca vira zero
        self.assertNotIn(2024, self.fin["anterior"][self.FERREIRA].get(("ind", "receita"), {}))

    def test_exercicio_curto_de_fato_fica_fora_da_serie(self):
        # sem balanço positivo no fim do ano anterior: exercício de constituição, fora da série
        dfp = {("ind|receita|U|00000000000100", "2017-06-02/2017-12-31"): 5.0,
               ("ind|ativo_total|U|00000000000100", "2017-12-31"): 10.0}
        con = base.conecta(":memory:")
        vid, _ = base.registra_vintage(con, mod.DS_DFP, "dfp_cia_aberta_2017.zip", "u", "2026-09-30T23:00:00Z", None, "0" * 64, 1, "t", "x")
        base.grava_observacoes(con, mod.DS_DFP, vid, [(k[0], k[1], v) for k, v in dfp.items()])
        fin = mod._financas(con, {}, [], {})
        self.assertNotIn(("ind", "receita"), fin["anual"]["00000000000100"])
        self.assertEqual(fin["irregulares_dfp"], [("00000000000100", "ind", "receita", "2017-06-02", "2017-12-31", 5.0)])

    def test_exercicio_mais_recente_antes_do_escopo(self):
        # consolidado até 2010 e individual até 2023 (caso real da UPTICK): exibe 2023 individual
        d = {("con", "receita"): {2010: 1.0}, ("ind", "receita"): {2010: 2.0, 2023: 3.0}}
        fin = {"zeradas": {"DFP": {}}, "nota_inicio": {}}
        ult, esc, valores, _ = mod._exibicao("02162616000194", d, fin)
        self.assertEqual((ult, esc, valores["receita"]), (2023, "ind", 3))
        d[("con", "receita")][2023] = 9.0
        self.assertEqual(mod._exibicao("02162616000194", d, fin)[:2], (2023, "con"))


class NomesDeSocios(unittest.TestCase):
    """Nome de pessoa nunca é republicado: só com CNPJ, pessoa jurídica estrangeira declarada
    pela fonte ou rótulo coletivo da lista fechada (os nomes abaixo são fictícios)."""

    def test_regra(self):
        pf = {"socio": None, "nome": "Fulano de Tal", "perfil": "PF"}
        dc_pessoa = {"socio": None, "nome": "Beltrano Sicrano", "perfil": "DC"}
        dc_coletivo = {"socio": None, "nome": "Ações em  Tesouraria", "perfil": "DC"}
        pj_estrangeira = {"socio": None, "nome": "Empresa Exterior S.A.", "perfil": "PJ", "empresa_estrangeira": True}
        pj_sem_marca = {"socio": None, "nome": "Empresa Sem Marca", "perfil": "PJ", "empresa_estrangeira": False}
        pj = {"socio": "00000000000100", "nome": "Empresa Nacional", "perfil": "PJ"}
        self.assertEqual(ae.rotulo_socio(pf), ae.MARCADOR_PF)
        self.assertEqual(ae.rotulo_socio(dc_pessoa), ae.MARCADOR_SEM_DOCUMENTO)
        self.assertEqual(ae.rotulo_socio(dc_coletivo), "Ações em  Tesouraria")
        self.assertEqual(ae.rotulo_socio(pj_estrangeira), "Empresa Exterior S.A.")
        self.assertEqual(ae.rotulo_socio(pj_sem_marca), ae.MARCADOR_SEM_DOCUMENTO)
        self.assertEqual(ae.rotulo_socio(pj), "Empresa Nacional")
        # o controlador sem CNPJ acima do topo segue a mesma regra
        g = {"origem": {"00000000000100": "propria"},
             "socios": {"00000000000100": [{**dc_pessoa, "pai": "00000000000100", "pct": 100.0, "controlador": True}]}}
        r = ae.cadeia_de_controle(g, "00000000000100")
        self.assertEqual((r["motivo_parada"], r["acima"]), ("sem_cnpj", None))

    def test_marca_de_empresa_estrangeira_lida_do_polimero(self):
        pol = _polimero()
        arv = pol["arvores"][("33050071000158", (2026, 2))][0]
        americas = next(a for a in arv["arestas"] if a["nome"] == "Enel Americas S.A.")
        self.assertEqual((americas["socio"], americas["perfil"], americas["empresa_estrangeira"]), (None, "PJ", True))

    @unittest.skipUnless(os.path.exists(os.path.join(base.SERIES, "empresas_cadeia_societaria.csv")), "CSV não gerado")
    def test_arquivos_publicados_sem_nome_de_pessoa(self):
        marcadores = {ae.MARCADOR_PF, ae.MARCADOR_SEM_DOCUMENTO}
        with open(os.path.join(base.SERIES, "empresas_cadeia_societaria.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        pj_estrangeiras = set()
        for r in linhas:
            if r["socio_cnpj"]:
                continue
            nome = r["socio_nome"]
            if nome in marcadores:
                continue
            if r["perfil"] == "PJ":
                pj_estrangeiras.add(nome)
                continue
            self.assertIn(ae._rotulo_normalizado(nome), ae.ROTULOS_COLETIVOS, f"nome sem CNPJ publicado: perfil {r['perfil']}")
        self.assertTrue(all(r["socio_nome"] == ae.MARCADOR_PF for r in linhas if r["perfil"] == "PF"))
        with open(os.path.join(base.SERIES, "empresas_cadeia.json"), encoding="utf-8") as f:
            ar = json.load(f)["arestas"]
        for socio, nome in zip(ar["socio"], ar["nome"]):
            if socio is None and nome not in marcadores:
                self.assertTrue(nome in pj_estrangeiras or ae._rotulo_normalizado(nome) in ae.ROTULOS_COLETIVOS)


class RegistroECatalogo(unittest.TestCase):
    def test_estado_declarado_e_papel_no_catalogo(self):
        # o catálogo deriva o estado de evidências e lê o estado declarado no REGISTRO como
        # papel; a conferência (Agentes de Geração) precisa sair como 'conferencia', os demais
        # como 'indicador', e nenhum valor fora desses dois
        from pipeline.energia import catalogo
        papeis = {d["dataset_silver"]: catalogo.papel(d["estado"]) for d in mod.REGISTRO["datasets"]}
        self.assertEqual(papeis.pop(mod.DS_AGGER), "conferencia")
        self.assertEqual(set(papeis.values()), {"indicador"})
        self.assertTrue(set(d["estado"] for d in mod.REGISTRO["datasets"]) <= {"UTILIZADO EM INDICADOR", "UTILIZADO EM VALIDAÇÃO"})

    def test_quebra_do_polimero_sem_norma_nao_conferida(self):
        q = next(d for d in mod.REGISTRO["datasets"] if d["dataset_silver"] == mod.DS_POLIMERO)["quebras"][0]
        self.assertNotIn("REN", q["descricao"])
        for n in ("14", "162", "1.117"):
            self.assertIn(n, q["descricao"])

    @unittest.skipUnless(os.path.exists(os.path.join(base.GOLD, "empresas.json")), "gold não gerada")
    def test_quebra_bate_com_os_declarantes_da_gold(self):
        with open(os.path.join(base.GOLD, "empresas.json"), encoding="utf-8") as f:
            per = {p["trimestre"]: p["declarantes"] for p in json.load(f)["controle"]["polimero"]["periodos"]}
        self.assertEqual((per["2020T2"], per["2020T3"], per["2020T4"]), (14, 162, 1117))

    def test_ebitda_e_decisao_de_metodo_nao_bloqueio(self):
        self.assertNotIn("ebitda", {b["id"] for b in mod.BLOQUEIOS})
        self.assertIn("ebitda", {d["id"] for d in mod.DECISOES_METODO})

    def test_toda_conta_publicada_tem_metrica(self):
        ids = {m["id"] for m in metricas_empresas.METRICAS}
        for ct in [c_["id"] for c_ in cv.CONTAS] + [cv.DIVIDA_BRUTA["id"]]:
            self.assertIn(f"empresas_{ct}", ids)


class ListadasCvm(unittest.TestCase):
    def test_companhia_aberta_de_outro_setor(self):
        # Suzano (Papel e Celulose) é aberta e ativa: o silver guarda só o setor elétrico, a
        # leitura do cadastro inteiro precisa reconhecê-la
        caminho = os.path.join(DADOS, "cad_cia_aberta_recorte.csv")
        cad, _ = cv.le_cadastro(_csv("cad_cia_aberta_recorte.csv", enc="latin-1"))
        so_energia = {k: r for k, r in cad.items() if r["setor"] in cv.SETORES_ENERGIA}
        listadas, origem = mod._listadas_cvm({"arquivo": caminho}, so_energia)
        self.assertEqual(origem, "cadastro_completo")
        self.assertIn("16404287000155", listadas)
        self.assertNotIn("16404287000155", so_energia)
        self.assertIn(CEMIG, listadas)
        _, origem = mod._listadas_cvm(None, so_energia)
        self.assertEqual(origem, "silver_setor_eletrico")


class ContagemSobControle(unittest.TestCase):
    def test_usinas_sob_controle_com_o_mesmo_criterio_dos_mw(self):
        usinas, _ = _siga()
        at = mod._ativos(usinas, None, {})
        fora = {k for k, u in usinas.items() if u["fase"] != "Operação"}
        self.assertTrue(fora)                                          # construção e não iniciada no recorte
        for k in fora:
            for c14, pct, _ in mod._agrega_por_cnpj(usinas[k]["proprietarios"] or []):
                d = at["donos"][c14]
                self.assertLessEqual(d["usinas_controle"], d["usinas_operacao"], c14)
                if d["usinas_operacao"] == 0:
                    self.assertEqual((d["usinas_controle"], d["kw_controle"]), (0, 0.0))
        for d in at["donos"].values():
            self.assertEqual(d["usinas_controle"] > 0, d["kw_controle"] > 0)


class ProvenienciaDistribuidoras(unittest.TestCase):
    def test_natureza_herdada_e_periodo_do_dado(self):
        with open(os.path.join(DADOS, "golds_origem_recorte.json"), encoding="utf-8") as f:
            golds = json.load(f)
        cadeia = lambda x: {"topo": x, "cadeia": [x], "motivo_parada": "sem_declaracao", "pcts": [], "acima": None}  # noqa: E731
        r = mod._indice_distribuidoras(golds, {}, {}, cadeia, {}, {})
        p = r["proveniencia"]
        self.assertEqual(p["distribuidoras_perdas"]["natureza"], "CALCULADO")
        self.assertEqual(p["distribuidoras_pnt"]["natureza"], "ESTIMADO")      # separação estimada pela fonte
        self.assertEqual(p["distribuidoras_pnt"]["unidade"], "% do mercado de baixa tensão")   # o número copiado é pnt_bt_pct
        self.assertEqual(p["distribuidoras_qualidade"]["natureza"], "CALCULADO")
        self.assertEqual(p["distribuidoras_tarifa"]["natureza"], "CALCULADO")
        self.assertEqual(p["distribuidoras_perdas"]["periodo_referencia"], {"inicio": "2025", "fim": "2025"})
        self.assertEqual(p["distribuidoras_tarifa"]["periodo_referencia"], {"inicio": "2026-09-30", "fim": "2026-09-30"})
        # data de geração das golds não é período do dado
        for k, v in p.items():
            per = v["periodo_referencia"]
            self.assertNotIn("T", per["inicio"] + per["fim"], k)


# ============================================================================ catálogo e evidências
class CatalogoEEvidencias(unittest.TestCase):
    def test_metricas_validas(self):
        erros = [e for m in metricas_empresas.METRICAS for e in metricas.validar(m)]
        self.assertEqual(erros, [])
        ids = [m["id"] for m in metricas_empresas.METRICAS]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(i.startswith("empresas_") for i in ids))

    @unittest.skipUnless(os.path.exists(os.path.join(base.GOLD, "empresas.json")), "gold não gerada")
    def test_gold_publicada(self):
        with open(os.path.join(base.GOLD, "empresas.json"), encoding="utf-8") as f:
            g = json.load(f)
        self.assertTrue(g["disponivel"])
        self.assertLess(os.path.getsize(os.path.join(base.GOLD, "empresas.json")), 400 * 1024)
        for e in (g["cadastro"]["ativos"]["evidencia"], g["controle"]["concentracao"]["evidencia"]):
            self.assertEqual(evid.validar(e), [])
        # nada somado entre companhias: a gold não tem total financeiro do universo
        self.assertNotIn("total", json.dumps(g["financas"]["universo"]))
        # identidade de partição publicada
        self.assertTrue(all(g["validacao"]["identidades"].values()))
        # nenhum nome de pessoa física acima do topo de cadeia
        self.assertTrue(all(i["controle"]["acima"] is None for i in g["distribuidoras"]["indice"]
                            if i["controle"]["motivo_parada"] == "pessoa_fisica"))
        slugs = [i["slug"] for i in g["distribuidoras"]["indice"]]
        self.assertEqual(len(slugs), len(set(slugs)))


# ============================================================================ P036: transmissão (SIGET)
def _texto(caminho):
    """Conteúdo de um arquivo de texto (UTF-8, senão Latin-1, como os recursos da ANEEL)."""
    with open(caminho, "rb") as f:
        b = f.read()
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("latin-1")


DOC_MODULO = os.path.join(base.RAIZ, "docs/observatorios/energia/modulos/empresas.md")


def _siget_recorte():
    def le(nome):
        return list(csv.DictReader(io.StringIO(_texto(os.path.join(DADOS, nome))), delimiter=";"))
    contratos, oc_ct = ae.le_siget_contratos(le("siget_contratos_recorte.csv"))
    modulos, oc_md = ae.le_siget_modulos(le("siget_modulos_recorte.csv"))
    linhas = ae.le_siget_linhas(le("siget_linhas_recorte.csv"))
    equip = ae.le_siget_equipamentos(le("siget_equipamentos_recorte.csv"))
    return {"contratos": contratos, "modulos": modulos, "linhas": linhas, "equipamentos": equip,
            "oc_contratos": oc_ct, "oc_modulos": oc_md}


class TransmissaoSiget(unittest.TestCase):
    """O SIGET liga o módulo ao CNPJ: IdeMdl → IdeCcdProprietario → NumCNPJ do recurso 'SIGET -
    Contrato Agente'. A primeira versão declarou esse vínculo inexistente (bloqueio falso)."""
    AXIA, AXIA_NE, ATE_VI, ATE_VII, COPEL_GT = ("00001180000126", "33541368000116", "08635011000150",
                                                 "08806925000136", "04370282000170")

    @classmethod
    def setUpClass(cls):
        cls.sg = _siget_recorte()
        cls.por, cls.cob = ae.transmissao_por_cnpj(cls.sg["contratos"], cls.sg["modulos"], cls.sg["linhas"], cls.sg["equipamentos"])

    def test_linhas_originais_do_contrato(self):
        # linha original do recurso de contratos: IdeCcd 6375, contrato 012/2007, CNPJ 33541368000116
        txt = _texto(os.path.join(DADOS, "siget_contratos_recorte.csv"))
        self.assertIn('"6375";"CCO-Contrato de Concess', txt)
        self.assertIn('"012/2007";"14/06/2007";"14/06/2037";"48";"33541368000116";"AXIA Nordeste"', txt)
        # ATE VI publicada sem o zero à esquerda e AXIA com 10 dígitos: completados para 14
        self.assertIn('"8635011000150";"ATE VI"', txt)
        self.assertEqual(self.sg["contratos"]["6376"]["cnpj"], self.ATE_VI)
        self.assertEqual(self.sg["contratos"]["6523"]["cnpj"], self.AXIA)
        self.assertIsNone(self.sg["contratos"]["6444"]["cnpj"])                  # contrato sem CNPJ, contado
        self.assertEqual((self.sg["oc_contratos"]["sem_cnpj"], self.sg["oc_contratos"]["cnpj_sem_zeros"]), (1, 4))

    def test_vinculo_por_cnpj_contra_leitura_independente(self):
        """Valores escritos aqui, calculados por leitura independente do recorte (csv puro: um
        módulo conta uma vez, linha ativa com obra em operação ou concluída, transformador
        principal em operação)."""
        esperado = {self.AXIA: (14, 1, 99.0, 1, 150.0), self.ATE_VI: (21, 3, 201.0, 1, 450.0),
                    self.ATE_VII: (23, 2, 119.0, 1, 300.0), self.AXIA_NE: (10, 2, 316.0, 2, 0.0)}
        for c14, (mods, circ, km, se, mva) in esperado.items():
            d = self.por[c14]
            self.assertEqual((d["modulos"], d["circuitos_operacao"], round(d["km_operacao"], 2), len(d["subestacoes"]),
                              d["mva_operacao"]), (mods, circ, km, se, mva), c14)
        self.assertEqual((self.cob["modulos"], self.cob["modulos_com_cnpj"]), (68, 68))

    def test_dono_e_o_contrato_proprietario_nao_o_da_obra(self):
        # quatro linhas de módulos da ATE VII vêm de obras autorizadas no contrato 060/2001 da COPEL-GT:
        # o módulo é da ATE VII (IdeCcdProprietario), nunca da COPEL-GT
        self.assertEqual(self.por[self.COPEL_GT]["modulos"], 0)
        self.assertEqual(self.por[self.COPEL_GT]["contratos"], 1)
        self.assertEqual(self.sg["oc_modulos"]["proprietario_divergente"], [])

    def test_linha_repetida_reserva_e_implantacao(self):
        brutas = list(csv.DictReader(io.StringIO(_texto(os.path.join(DADOS, "siget_linhas_recorte.csv"))), delimiter=";"))
        self.assertEqual(len(brutas) - len({r["IdeMdl"] for r in brutas}), 1)     # o mesmo módulo em duas obras
        self.assertEqual(self.sg["equipamentos"]["22404"]["finalidade"], "Reserva")  # 50 MVA reserva fora da soma
        self.assertEqual(self.por[self.AXIA]["mva_operacao"], 150.0)
        nao_op = sorted(m for m, x in self.sg["modulos"].items() if not x["em_operacao"])
        self.assertEqual(nao_op, ["44553", "44554", "44555"])

    def test_bloqueio_retirado_e_registro(self):
        self.assertNotIn("transmissao", {b["id"] for b in mod.BLOQUEIOS})
        self.assertIn(mod.DS_SIGET, {d["dataset_silver"] for d in mod.REGISTRO["datasets"]})
        # o documento não repete a limitação inexistente (SIGET sem CNPJ) nas limitações
        limites = _texto(DOC_MODULO).split("## 5.")[1].split("## 6.")[0]
        self.assertFalse([l for l in limites.split("\n") if "SIGET" in l and "sem CNPJ" in l])
        self.assertNotIn("nenhum conjunto aberto liga", _texto(DOC_MODULO))
        g = os.path.join(base.GOLD, "empresas.json")
        if os.path.exists(g):
            self.assertNotIn("nenhum conjunto aberto liga", _texto(g))

    def test_bloco_da_gold_com_o_recorte(self):
        agentes = {self.AXIA_NE: {"ativo": True, "ramos": ["transmissao"]}, self.ATE_VI: {"ativo": True, "ramos": ["transmissao"]}}
        cadeia = lambda x: {"topo": self.AXIA if x == self.AXIA_NE else x, "cadeia": [x], "motivo_parada": "sem_declaracao",  # noqa: E731
                            "pcts": [], "acima": None}
        vint = {r: {"vintage_id": f"t:{r}", "recurso": r, "url": "https://dadosabertos.aneel.gov.br/", "capturado_em": "2026-09-30T22:21:58Z",
                    "publicado_em": "2026-09-29T16:35:49Z", "sha256": "0" * 64, "bytes": 1, "arquivo": r} for r in ae.SIGET_RECURSOS}
        t = mod._bloco_transmissao({**self.sg, "vintages": vint}, agentes, {}, cadeia, {"revisoes": None, "id": None, "sha256": None})
        b = t["bloco"]
        self.assertEqual(b["resumo"]["pct_modulos_com_cnpj"], 100.0)
        self.assertEqual(b["resumo"]["km_circuito_operacao"], 735.0)
        self.assertEqual(b["maiores"][0]["cnpj"], self.AXIA_NE)
        g = {x["cnpj"]: x for x in b["grupos"]}
        self.assertEqual(g[self.AXIA]["km_circuito_operacao"], 415.0)            # AXIA S.A. + AXIA Nordeste
        self.assertEqual(g[self.AXIA]["subestacoes"], 3)                           # união, sem contar duas vezes
        self.assertEqual(evid.validar(b["evidencia"]), [])
        self.assertEqual(b["conferencia_cadastro_agentes"]["com_ramo_transmissao"], 2)


# ============================================================================ P038: escala, colunas e fluxos não preenchidos
def _fin_de(zips):
    """_financas sobre um silver em memória com os zips do recorte processados pelo código do módulo."""
    con = base.conecta(":memory:")
    for ds, rec, arq, univ in zips:
        caminho = os.path.join(DADOS, arq)
        vid, _ = base.registra_vintage(con, ds, rec, "https://dados.cvm.gov.br/", "2026-09-30T23:00:00Z", None,
                                       "0" * 64, os.path.getsize(caminho), "teste", caminho)
        mod._processa_doc(con, ds, "DFP" if ds == mod.DS_DFP else "ITR", {"vintage_id": vid, "recurso": rec, "arquivo": caminho}, univ)
    return mod._financas(con, {}, [], {})


def _linha_cvm(arq, membro, cnpj_fmt, conta, ordem="ÚLTIMO", dt_refer=None, ini=None):
    with zipfile.ZipFile(os.path.join(DADOS, arq)) as z:
        for r in csv.DictReader(io.StringIO(z.read(membro).decode("latin-1")), delimiter=";"):
            if r["CNPJ_CIA"] == cnpj_fmt and r.get("CD_CONTA") == conta and r["ORDEM_EXERC"] == ordem and (
                    dt_refer is None or r["DT_REFER"] == dt_refer) and (ini is None or r.get("DT_INI_EXERC") == ini):
                return r
    return None


EQ_GO, CELEO, CHESF, CELGPAR = "01543032000104", "31001230000107", "33541368000116", "08560444000193"


class EscalaTrocadaNaFonte(unittest.TestCase):
    """Defeito: a DFP 2021 da Equatorial Goiás marca UNIDADE e a DFP 2022 traz o mesmo número em
    MIL; a DFP 2019 da Celeo Redes marca UNIDADE e a de 2020, MIL. A gold publicava a receita de
    2021 da Equatorial Goiás como R$ 9.735.479 e o ativo como R$ 18,9 milhões."""

    @classmethod
    def setUpClass(cls):
        cls.fin = _fin_de([(mod.DS_DFP, "dfp_cia_aberta_2021.zip", "dfp_2021_equatorial_go_recorte.zip", [EQ_GO]),
                           (mod.DS_DFP, "dfp_cia_aberta_2022.zip", "dfp_2022_equatorial_go_recorte.zip", [EQ_GO]),
                           (mod.DS_ITR, "itr_cia_aberta_2021.zip", "itr_2021_equatorial_go_chesf_recorte.zip", [EQ_GO]),
                           (mod.DS_DFP, "dfp_cia_aberta_2019.zip", "dfp_2019_celeo_recorte.zip", [CELEO]),
                           (mod.DS_DFP, "dfp_cia_aberta_2020.zip", "dfp_2020_celeo_recorte.zip", [CELEO])])

    def test_linhas_originais(self):
        u = _linha_cvm("dfp_2021_equatorial_go_recorte.zip", "dfp_cia_aberta_DRE_ind_2021.csv", "01.543.032/0001-04", "3.01")
        p = _linha_cvm("dfp_2022_equatorial_go_recorte.zip", "dfp_cia_aberta_DRE_ind_2022.csv", "01.543.032/0001-04", "3.01", "PENÚLTIMO")
        self.assertEqual((u["ESCALA_MOEDA"], float(u["VL_CONTA"])), ("UNIDADE", 9735479.0))
        self.assertEqual((p["ESCALA_MOEDA"], float(p["VL_CONTA"])), ("MIL", 9735479.0))
        c19 = _linha_cvm("dfp_2019_celeo_recorte.zip", "dfp_cia_aberta_DRE_con_2019.csv", "31.001.230/0001-07", "3.01")
        c20 = _linha_cvm("dfp_2020_celeo_recorte.zip", "dfp_cia_aberta_DRE_con_2020.csv", "31.001.230/0001-07", "3.01", "PENÚLTIMO")
        self.assertEqual((c19["ESCALA_MOEDA"], float(c19["VL_CONTA"]), c20["ESCALA_MOEDA"], float(c20["VL_CONTA"])),
                         ("UNIDADE", 143474.0, "MIL", 143474.0))

    def test_equatorial_goias_2021_convertida_para_mil(self):
        a = self.fin["anual"][EQ_GO]
        self.assertEqual(a[("ind", "receita")][2021], 9735479000.0)
        self.assertEqual(a[("ind", "ativo_total")][2021], 18932354000.0)
        self.assertEqual(a[("ind", "receita")][2022], 9032297000.0)                 # a referência não muda
        self.assertEqual(self.fin["escala"]["notas"][(EQ_GO, "ind", "receita", 2021)], 1000.0)
        # a troca de escala deixa de ser reapresentação; o ativo de 2021 foi reapresentado de fato
        self.assertEqual(self.fin["anterior"][EQ_GO][("ind", "receita")][2021], a[("ind", "receita")][2021])
        self.assertEqual(self.fin["anterior"][EQ_GO][("ind", "ativo_total")][2021], 18952943000.0)
        self.assertGreaterEqual(self.fin["inversoes_escala"], 5)

    def test_itr_2021_por_documento(self):
        # 1º trimestre marcado MIL (ligado à DFP 2022 pelo comparativo de 31/12/2020): fica; 2º e 3º
        # marcados UNIDADE, iguais à DFP 2021: convertidos
        t = self.fin["trimestral"][EQ_GO][("ind", "ativo_total", "saldo")]
        self.assertEqual((t["2021-03-31"], t["2021-06-30"], t["2021-09-30"]), (16488261000.0, 17403589000.0, 18516717000.0))
        self.assertNotIn((EQ_GO, "ind", "ITR", "2021-03-31"), self.fin["escala"]["fatores"])

    def test_celeo_2019(self):
        a = self.fin["anual"][CELEO]
        self.assertEqual(a[("con", "receita")][2019], 143474000.0)
        self.assertEqual(self.fin["escala"]["fatores"][(CELEO, "con", "DFP", "2019-12-31")], 1000.0)
        self.assertEqual(self.fin["escala"]["fatores"][(CELEO, "ind", "DFP", "2019-12-31")], 1000.0)
        self.assertEqual(self.fin["escala"]["diagnostico"]["conflitos"], [])

    def test_documento_isolado_nao_e_corrigido(self):
        fin = _fin_de([(mod.DS_DFP, "dfp_cia_aberta_2021.zip", "dfp_2021_equatorial_go_recorte.zip", [EQ_GO])])
        self.assertEqual(fin["escala"]["fatores"], {})                             # sem comparativo exato, sem prova
        self.assertEqual(fin["anual"][EQ_GO][("ind", "receita")][2021], 9735479.0)


class ColunaNaoPreenchida(unittest.TestCase):
    """Defeito: o consolidado da AXIA Energia Nordeste (Chesf) no ITR de 2021 tem ativo total 1 (mil)
    e as demais contas zero; a gold publicava ativo de R$ 1.000, PL zero e receita do trimestre zero."""

    @classmethod
    def setUpClass(cls):
        cls.fin = _fin_de([(mod.DS_ITR, "itr_cia_aberta_2021.zip", "itr_2021_equatorial_go_chesf_recorte.zip", [CHESF])])

    def test_linhas_originais(self):
        c = _linha_cvm("itr_2021_equatorial_go_chesf_recorte.zip", "itr_cia_aberta_BPA_con_2021.csv", "33.541.368/0001-16", "1",
                       dt_refer="2021-06-30")
        i = _linha_cvm("itr_2021_equatorial_go_chesf_recorte.zip", "itr_cia_aberta_BPA_ind_2021.csv", "33.541.368/0001-16", "1",
                       dt_refer="2021-06-30")
        self.assertEqual((c["ESCALA_MOEDA"], float(c["VL_CONTA"]), float(i["VL_CONTA"])), ("MIL", 1.0, 28552507.0))

    def test_ausencia_no_lugar_do_modelo(self):
        t = self.fin["trimestral"][CHESF]
        self.assertNotIn("2021-06-30", t.get(("con", "ativo_total", "saldo"), {}))
        self.assertNotIn("2021-03-31", t.get(("con", "ativo_total", "saldo"), {}))
        self.assertNotIn("2021-06-30", t.get(("con", "patrimonio_liquido", "saldo"), {}))
        self.assertNotIn("2021-06-30", t.get(("con", "receita", "trimestre"), {}))
        self.assertNotIn("2021-06-30", t.get(("con", "lucro_liquido", "trimestre"), {}))
        # o que a companhia preencheu continua: DRE consolidada acumulada e o individual
        self.assertEqual(t[("con", "receita", "acumulado_no_ano")]["2021-06-30"], 3577463000.0)
        self.assertEqual(t[("ind", "ativo_total", "saldo")]["2021-06-30"], 28552507000.0)
        motivos = {k: m for k, (m, _) in self.fin["nao_preenchidas"].items()}
        self.assertEqual(motivos[("ITR", CHESF, "con", "U", "saldo", "2021-06-30")], "coluna_nao_preenchida")
        self.assertEqual(motivos[("ITR", CHESF, "con", "U", "DRE", "2021-04-01/2021-06-30")], "coluna_nao_preenchida")
        self.assertEqual(self.fin["ativo_invalido"], [])


class FluxosNaoPreenchidos(unittest.TestCase):
    """Defeito: a DRE e a DFC de 2025 da CELGPAR, entregues zeradas, eram publicadas como valores
    (receita, EBIT, lucro e caixa de investimento iguais a zero) sob a afirmação de que não havia
    prova de não preenchimento. A prova está no arquivo: saldo inicial de caixa zero contra o saldo
    final de 2024 de 203.811 mil no comparativo da mesma DFC."""

    @classmethod
    def setUpClass(cls):
        cls.fin = _fin_de([(mod.DS_DFP, "dfp_cia_aberta_2025.zip", "dfp_2025_celgpar_recorte.zip", [CELGPAR])])

    def test_linhas_originais(self):
        arq, m = "dfp_2025_celgpar_recorte.zip", "dfp_cia_aberta_DFC_MD_ind_2025.csv"
        self.assertEqual(float(_linha_cvm(arq, m, "08.560.444/0001-93", "6.05.01")["VL_CONTA"]), 0.0)
        self.assertEqual(float(_linha_cvm(arq, m, "08.560.444/0001-93", "6.05.02", "PENÚLTIMO")["VL_CONTA"]), 203811.0)
        self.assertEqual(float(_linha_cvm(arq, "dfp_cia_aberta_DRE_ind_2025.csv", "08.560.444/0001-93", "3.01")["VL_CONTA"]), 0.0)

    def test_dre_e_dfc_viram_ausencia(self):
        a = self.fin["anual"][CELGPAR]
        for conta in ("receita", "ebit", "lucro_liquido", "caixa_operacional", "caixa_investimento"):
            self.assertNotIn(2025, a.get(("ind", conta), {}), conta)
        self.assertEqual(a[("ind", "ativo_total")][2025], 749830000.0)             # o balanço foi preenchido
        self.assertEqual(a[("ind", "receita")].get(2024), None)                     # 2024 só como comparativo
        ult, esc, valores, alertas = mod._exibicao(CELGPAR, a, self.fin)
        self.assertEqual((ult, esc, valores["receita"], valores["ativo_total"]), (2025, "ind", None, 749830000))
        self.assertIn("fluxos_nao_preenchidos", alertas)
        self.assertNotIn("dre_zerada_na_fonte", alertas)

    def test_sem_a_afirmacao_de_falta_de_prova(self):
        for caminho in ("pipeline/energia/modulos/empresas.py", "docs/observatorios/energia/modulos/empresas.md"):
            self.assertNotIn("não há prova", _texto(os.path.join(base.RAIZ, caminho)), caminho)


class VersoesDistintas(unittest.TestCase):
    def test_indice_com_a_mesma_versao_duas_vezes(self):
        with zipfile.ZipFile(os.path.join(DADOS, "itr_2021_equatorial_go_chesf_recorte.zip")) as z:
            idx = cv.le_indice(z, "ITR", 2021, {"02.291.077/0001-93"})
        entradas = idx[("02291077000193", "2021-06-30")]
        self.assertEqual(len(entradas), 2)                                          # duas linhas no índice
        self.assertEqual(cv.versoes_distintas(entradas), 1)                         # uma versão
        self.assertEqual(mod._versoes({"versoes": "2", "versoes_distintas": "1"}), 1)


# ============================================================================ nomes determinísticos
_NOMES_SCRIPT = r"""
import json, sys
sys.path.insert(0, {raiz!r})
from pipeline.energia.fontes import aneel_empresas as ae
from pipeline.energia.modulos import empresas as mod
pol = ae.le_polimero(lambda: ae.linhas_polimero({parquet!r}))
X = "00000000000191"
# mesmo sócio grafado de três formas por declarantes diferentes no mesmo trimestre, e um declarante
# que se declara com nome próprio diferente do que os terceiros usam
pol["arvores"][("00000000000272", (2026, 2))] = [{{"raiz": "00000000000272", "nome": "Declarante A", "arestas": [
    {{"pai": "00000000000272", "socio": X, "nome": "Controladora S/A.", "pct": 100.0, "controlador": True, "perfil": "PJ"}}]}}]
pol["arvores"][("00000000000353", (2026, 2))] = [{{"raiz": "00000000000353", "nome": "Declarante B", "arestas": [
    {{"pai": "00000000000353", "socio": X, "nome": "Controladora S.A.", "pct": 100.0, "controlador": True, "perfil": "PJ"}}]}}]
pol["arvores"][("00000000000434", (2026, 2))] = [{{"raiz": "00000000000434", "nome": "Declarante C", "arestas": [
    {{"pai": "00000000000434", "socio": X, "nome": "Controladora S/A.", "pct": 100.0, "controlador": True, "perfil": "PJ"}},
    {{"pai": "00000000000434", "socio": "00000000000272", "nome": "Nome antigo do declarante A", "pct": 0.0, "controlador": False, "perfil": "PJ"}}]}}]
nomes = mod._nomes({{}}, {{}}, {{}}, ae.nomes_polimero(pol))
print(json.dumps(nomes, sort_keys=True, ensure_ascii=False))
"""


class NomesDeterministicos(unittest.TestCase):
    def _roda(self, semente):
        cod = _NOMES_SCRIPT.format(raiz=base.RAIZ, parquet=os.path.join(DADOS, "polimero_recorte.parquet"))
        out = subprocess.run([sys.executable, "-c", cod], capture_output=True, text=True, timeout=300,
                             env={**os.environ, "PYTHONHASHSEED": str(semente)})
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])
        return json.loads(out.stdout)

    def test_mesmos_nomes_com_duas_sementes(self):
        a, b = self._roda(1), self._roda(2)
        self.assertEqual(a, b)
        self.assertEqual(a["00000000000191"], "Controladora S/A.")                # o mais frequente no trimestre
        self.assertEqual(a["00000000000272"], "Declarante A")                      # a própria declaração vence a de terceiros
        self.assertEqual(a["33050071000158"], next(arv["nome"] for (r, p), arvs in _polimero()["arvores"].items()
                                                   if r == "33050071000158" and p == (2026, 2) for arv in arvs))


# ============================================================================ contrato da gold, documento e métricas
TIPOS_TS = os.path.join(base.RAIZ, "src/lib/energia/tipos-empresas.ts")


def _campos_ts(nome):
    """({obrigatórios}, {todos}) do primeiro nível de `export type <nome> = ... {` em tipos-empresas.ts."""
    linhas = _texto(TIPOS_TS).split("\n")
    i = next(n for n, l in enumerate(linhas) if re.match(rf"export type {nome} = .*\{{\s*$", l))
    prof, obrig, todos = 1, set(), set()
    for l in linhas[i + 1:]:
        sem_coment = re.sub(r"/\*.*?\*/|//.*$", "", l)
        if prof == 1:
            m = re.match(r"^\s{2}(\w+)(\??):", sem_coment)
            if m:
                todos.add(m.group(1))
                if not m.group(2):
                    obrig.add(m.group(1))
        prof += sem_coment.count("{") - sem_coment.count("}")
        if prof <= 0:
            return obrig, todos
    raise AssertionError(nome)


@unittest.skipUnless(os.path.exists(os.path.join(base.GOLD, "empresas.json")), "gold não gerada")
class ContratoDaGold(unittest.TestCase):
    """A gold publicada precisa ter os campos do tipo TypeScript, e só eles. Defeito: a gold de
    01/10/2026 00:53 não tinha a chave 'nota' da conferência SIGA × Agentes de Geração que o tipo
    declara obrigatória (a gold estava defasada em relação ao código)."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(base.GOLD, "empresas.json"), encoding="utf-8") as f:
            cls.g = json.load(f)

    def _confere(self, tipo, obj):
        obrig, todos = _campos_ts(tipo)
        self.assertEqual(obrig - set(obj), set(), f"{tipo}: campos do tipo ausentes na gold")
        self.assertEqual(set(obj) - todos, set(), f"{tipo}: campos da gold fora do tipo")

    def test_campos(self):
        g = self.g
        self.assertIn("nota", g["cadastro"]["ativos"]["conferencia_agentes_geracao"])
        self._confere("ConferenciaAgentes", g["cadastro"]["ativos"]["conferencia_agentes_geracao"])
        self._confere("Ativos", g["cadastro"]["ativos"])
        self._confere("ResumoAgentes", g["cadastro"]["agentes"])
        self._confere("Cadastro", g["cadastro"])
        self._confere("Transmissao", g["cadastro"]["transmissao"])
        for x in g["cadastro"]["transmissao"]["maiores"]:
            self._confere("TransmissaoAgente", x)
        for x in g["cadastro"]["transmissao"]["grupos"]:
            self._confere("TransmissaoGrupo", x)
        self._confere("Financas", g["financas"])
        self._confere("ExclusoesFinancas", g["financas"]["exclusoes"])
        for co in g["financas"]["companhias"]:
            self._confere("Companhia", co)
        self._confere("Distribuidoras", g["distribuidoras"])
        self._confere("Controle", g["controle"])
        self._confere("Datas", g["datas"])

    def test_textos_e_universos(self):
        a = self.g["cadastro"]["ativos"]
        tol = a["evidencia"]["reconciliacao"]["tolerancia"]
        self.assertIn("aceite com pelo menos 98%", tol)
        self.assertRegex(tol, r"resultado 99,\d\d%")
        est = {e["estado"]: e for e in a["estados"]}
        self.assertAlmostEqual(a["pct_usinas_operacao_vinculadas"], 100.0 * est["vinculado"]["usinas_operacao"] / a["operacao"]["usinas"], places=2)
        self.assertAlmostEqual(a["pct_usinas_vinculadas"], 100.0 * est["vinculado"]["usinas"] / a["usinas"], places=2)
        self.assertIn("ativos", self.g["cadastro"]["agentes"]["ramos_universo"])
        self.assertEqual(self.g["proveniencia"]["distribuidoras_pnt"]["unidade"], "% do mercado de baixa tensão")
        self.assertEqual(self.g["proveniencia"]["distribuidoras_pnt"]["natureza"], "ESTIMADO")
        self.assertEqual(self.g["proveniencia"]["financas_escala"]["natureza"], "ESTIMADO")
        self.assertEqual(evid.validar(self.g["cadastro"]["transmissao"]["evidencia"]), [])

    def test_documento_cita_os_numeros_da_gold(self):
        doc = _texto(DOC_MODULO)
        br = lambda n: f"{n:,}".replace(",", ".")  # noqa: E731
        rev = self.g["financas"]["revisoes"]
        with open(os.path.join(base.SERIES, "empresas_evidencias.json"), encoding="utf-8") as f:
            n_ev = len(json.load(f)["evidencias"])
        for n in (rev["valores_reapresentados"], rev["documentos_com_mais_de_uma_versao"], rev["inversoes_de_escala_resolvidas"], n_ev,
                  self.g["cadastro"]["agentes"]["total"], self.g["cadastro"]["agentes"]["ramos"]["transmissao"],
                  self.g["cadastro"]["agentes"]["ramos_incluindo_inativos"]["transmissao"],
                  self.g["cadastro"]["transmissao"]["resumo"]["modulos"], self.g["financas"]["exclusoes"]["escala"]["documentos_corrigidos"]):
            self.assertIn(br(n), doc, n)


class MetricasDeContas(unittest.TestCase):
    def test_conferencia_so_na_conta_conferida(self):
        por_id = {m["id"]: m for m in metricas_empresas.METRICAS}
        com_cemig = [i for i, m in por_id.items() if any("Receita consolidada da CEMIG" in v or "CEMIG consolidado 2024, R$ 39.819.620" in v
                                                       for v in m["validacoes"])]
        self.assertEqual(com_cemig, ["empresas_receita"])
        for i in ("empresas_ebit", "empresas_lucro_liquido", "empresas_caixa", "empresas_patrimonio_liquido", "empresas_lucro_controladores"):
            self.assertFalse(any("Relida" in v or "Recalculada" in v for v in por_id[i]["validacoes"]), i)
        self.assertIn("empresas_transmissao_km_circuito", por_id)


if __name__ == "__main__":
    unittest.main()
