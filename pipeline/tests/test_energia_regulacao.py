"""Testes do módulo Regulação (P044 a P046), sem rede, com recortes reais das fontes em
pipeline/tests/dados/energia_regulacao/:

* dsp20253850ti.txt, reh20233304ti.txt: texto extraído (pdftotext) dos atos que fixaram os
  limites do PLD de 2026 e 2024; areh20212994_1_pagina.txt: página do voto com a tabela dos
  valores de 2021 (leiaute preservado);
* atas_amostra.csv: 21 linhas reais do CSV de pautas e atas da Diretoria (dados abertos da
  ANEEL, arquivo gerado em 25/09/2026, sha256 693a03a1...);
* atas_amostra_defeitos.csv.gz: 34 linhas reais do mesmo arquivo, escolhidas pelos defeitos
  apontados na verificação de 30/09/2026 (redações "entre os dias", datas numéricas, início e
  duração, números de consulta implausíveis, resultado de mais de uma consulta, resultado em
  pauta depois de fase sem data, códigos da Agenda depois de 700 caracteres, versões do
  PRODIST e do PRORET aprovadas em reunião), linhas inteiras, sem edição;
* sidra_1737_novembros.json e sidra_1737_201909.json: respostas reais da API SIDRA (IPCA
  número-índice, novembros e setembro de 2019);
* bandeira-tarifaria-acionamento_recorte.csv: linhas reais do recurso Acionamento (jun/2021 a
  ago/2022 e 2026); dm-bandeira-tarifaria-acionamento_trecho.txt: trecho do dicionário do recurso;
* ren20251137_anexos.txt e ren20221032_art23.txt: linhas extraídas (pdftotext) da REN nº
  1.137/2025 (anexos) e da REN nº 1.032/2022 (art. 23);
* prt20257030_anexo_amostra.txt: duas páginas do Anexo I da Portaria nº 7.030/2025;
* govbr_*.html: trechos de conteúdo das páginas oficiais (PRODIST, PRORET, Agenda);
* bandeira-tarifaria-adicional.csv e audiencias-consultas-publicas-aneel.csv: arquivos inteiros;
* lei14203_fragmento.html: fragmento da página da Lei nº 14.203/2021 no portal do Senado;
* atas_amostra_resultados.csv.gz: 40 linhas reais do CSV das atas (mesmo arquivo), escolhidas pelos
  defeitos da segunda verificação de 30/09/2026: decisões que consolidam o edital ou a norma sem a
  palavra "Resultado" (Despacho nº 2.266/2026, CP 6/2026; Despacho nº 3.323/2025, CP 28/2025;
  Despacho nº 1.929/2025, CP 18/2025; REH nº 2.684/2020, AP 1/2020; Despacho nº 3.573/2025, CP
  20/2022; REH nº 3.568/2026, CP 35/2025), a aprovação sem número do Submódulo 6.2 (CP 3/2026), os
  contraexemplos (medida cautelar da CP 33/2025, impugnação da AP 29/2019), a 2ª fase da CP 1/2026 e
  as duas propostas da pauta de 29/09/2026 com decisão escrita e resultado vazio; linhas inteiras;
* numeracao_atas.json.gz: números dos atos deliberados por tipo e ano no mesmo arquivo (REN, REH e
  Portaria de 2019 a 2026; Despacho de 2023, 2025 e 2026), agregados sem edição;
* bandeira-tarifaria-acionamento_2015_2018.csv: linhas reais do recurso Acionamento de 2015 a 2018;
* ren20251114_art2.txt, ren20251147_art6.txt e ren20211000_publicacao.txt: linhas extraídas
  (pdftotext) da REN nº 1.114/2025 (art. 2º), da REN nº 1.147/2025 (art. 6º) e do fecho da REN nº
  1.000/2021 (nota de republicação);
* senado_lei14203_metadados.xml: metadados abertos do Senado da Lei nº 14.203/2021 (bronze).

As reconciliações leem os valores de novo, por expressões escritas aqui (não pelas funções
do módulo), e comparam com números concretos escritos no teste.
"""
import csv
import gzip
import json
import os
import re
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, regulatorio as rg  # noqa: E402
from pipeline.energia.fontes import aneel_regulacao as ar  # noqa: E402
from pipeline.energia.modulos import regulacao as m  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_regulacao")


def _ler(nome, modo="r"):
    with open(os.path.join(DADOS, nome), modo, **({} if "b" in modo else {"encoding": "utf-8"})) as f:
        return f.read()


def _atas():
    with open(os.path.join(DADOS, "atas_amostra.csv"), encoding="utf-8", newline="") as f:
        return [ar.linha_ata(r) for r in csv.DictReader(f, delimiter=";")]


def _atas_defeitos():
    with gzip.open(os.path.join(DADOS, "atas_amostra_defeitos.csv.gz"), "rt", encoding="utf-8", newline="") as f:
        return [ar.linha_ata(r) for r in csv.DictReader(f, delimiter=";")]


def _atas_resultados():
    with gzip.open(os.path.join(DADOS, "atas_amostra_resultados.csv.gz"), "rt", encoding="utf-8", newline="") as f:
        return [ar.linha_ata(r) for r in csv.DictReader(f, delimiter=";")]


def _numeracao():
    with gzip.open(os.path.join(DADOS, "numeracao_atas.json.gz"), "rt", encoding="utf-8") as f:
        d = json.load(f)["numeracao"]
    return {(k.rsplit("|", 1)[0], int(k.rsplit("|", 1)[1])): v for k, v in d.items()}


def _sem_espacos(t):
    return " ".join((t or "").replace("\xa0", " ").split())


def _totais_completos():
    """{(sig, ano): total} lidos à parte do CSV de contagens anuais, sem o ano em que a fonte
    gerou o arquivo (parcial)."""
    out = {}
    with open(os.path.join(DADOS, "audiencias-consultas-publicas-aneel.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["DatGeracaoConjuntoDados"][:4] != r["AnoReferencia"]:
                out[("CP", int(r["AnoReferencia"]))] = float(r["QtdConsultasPublicas"])
                out[("AP", int(r["AnoReferencia"]))] = float(r["QtdAudienciasPublicas"])
    return out


def _br(s):
    return float(s.replace(".", "").replace(",", "."))


def _ato(ano, nome_contem):
    return next(a for a in rg.limites_pld()["atos"] if a["ano"] == ano and nome_contem in a["ato"])


class ReconciliacaoLimites(unittest.TestCase):
    """Valores de limites_pld.json contra o texto dos atos, lido por outro caminho."""

    def test_2026_no_texto_do_despacho(self):
        t = re.sub(r"\s+", " ", _ler("dsp20253850ti.txt"))
        piso = _br(re.search(r"limite mínimo \(PLDmin\) de R\$ ([\d.,]+)/MWh", t).group(1))
        estr = _br(re.search(r"limite máximo estrutural \(PLDmax_estrutural\) de R\$ ([\d.,]+)/MWh", t).group(1))
        hor = _br(re.search(r"limite máximo horário \(PLDmax_horário\) de R\$ ([\d.,]+)", t).group(1))
        self.assertEqual((piso, estr, hor), (57.31, 785.27, 1611.04))
        a = _ato(2026, "3.850")
        self.assertEqual((a["pld_min"], a["pld_max_estrutural"], a["pld_max_horario"]), (piso, estr, hor))
        self.assertEqual(a["data_publicacao"], "2025-12-23")
        self.assertEqual((a["vigencia_inicio"], a["vigencia_fim"]), ("2026-01-01", "2026-12-31"))

    def test_2024_no_ato_e_na_ata_da_diretoria(self):
        t = re.sub(r"\s+", " ", _ler("reh20233304ti.txt"))
        no_ato = (_br(re.search(r"PLDmin\) em R\$ ([\d.,]+)", t).group(1)),
                  _br(re.search(r"PLDmax_estrutural\) em R\$ ([\d.,]+)", t).group(1)),
                  _br(re.search(r"PLDmax_horário\) em R\$ ([\d.,]+)", t).group(1)))
        ata = next(a for a in _atas() if a["data"] == "2023-12-19" and a["num_ato"] == "3.304")
        d = ata["decisao"]
        na_ata = (_br(re.search(r"PLDmin em R\$ ([\d.,]+)", d).group(1)),
                  _br(re.search(r"PLDmax_estrutura em R\$ ([\d.,]+)", d).group(1)),
                  _br(re.search(r"PLDmax-horário em R\$ ([\d.,]+)", d).group(1)))
        self.assertEqual(no_ato, (61.07, 716.80, 1470.57))
        self.assertEqual(na_ata, no_ato)
        a = _ato(2024, "3.304")
        self.assertEqual((a["pld_min"], a["pld_max_estrutural"], a["pld_max_horario"]), no_ato)

    def test_2021_na_tabela_do_voto(self):
        # primeira coluna da tabela do voto ("Valor em 2021", nota 14: "Nos termos da REH nº 2.828, de 2020")
        t = _ler("areh20212994_1_pagina.txt")
        piso = _br(re.search(r"PLDmin \(R\$/MWh\)\d*\s+([\d.,]+)", t).group(1))
        estr = _br(re.search(r"PLDmax_estrutural\s+([\d.,]+)", t).group(1))
        hor = _br(re.search(r"PLDmax_horário \(R\$/MWh\)\s+([\d.,]+)", t).group(1))
        self.assertEqual((piso, estr, hor), (49.77, 583.88, 1197.87))
        a = _ato(2021, "2.828")
        self.assertEqual((a["pld_min"], a["pld_max_estrutural"], a["pld_max_horario"]), (piso, estr, hor))
        self.assertIsNone(a["data_publicacao"])  # extrato não acessado: vazio, nunca a data de captura

    def test_deliberacao_de_2021_na_ata(self):
        ata = m._ata_do_ato(_atas(), "Resolução Homologatória", 2828, 2020)
        self.assertEqual((ata["data"], ata["reuniao"]), ("2020-12-15", "47/2020 - RPO"))
        self.assertEqual(ar.processo_formatado(ar.processos(ata["processo"])[0]), "48500.005928/2020-28")

    def test_regra_ipca_reproduz_os_tetos(self):
        ipca = ar.ipca_sidra(_ler("sidra_1737_novembros.json", "rb"))
        self.assertEqual(ipca["2025-11"], 7378.94)
        # 2026 a partir de 2025, com tolerância de dois arredondamentos a centavos
        self.assertAlmostEqual(1542.23 * ipca["2025-11"] / ipca["2024-11"], 1611.04, delta=m.TOL_IPCA_RS)
        self.assertAlmostEqual(751.73 * ipca["2025-11"] / ipca["2024-11"], 785.27, delta=m.TOL_IPCA_RS)
        # 2024: o caso de maior resíduo (R$ 0,0067/MWh) continua dentro da tolerância
        self.assertAlmostEqual(1404.77 * ipca["2023-11"] / ipca["2022-11"], 1470.57, delta=m.TOL_IPCA_RS)
        # a resolução de 2023 partiu dos tetos a preços de nov/2021 (REH nº 2.994) e não dos do
        # Despacho nº 4.046/2021: é o erro que a retificação corrigiu
        f = ipca["2022-11"] / ipca["2021-11"]
        self.assertAlmostEqual(1314.02 * f, 1391.56, delta=m.TOL_IPCA_RS)
        self.assertAlmostEqual(1326.50 * f, 1404.77, delta=m.TOL_IPCA_RS)
        self.assertGreater(abs(1314.02 * f - 1404.77), 10)

    def test_piso_igual_ao_maior_entre_teo_e_teo_itaipu(self):
        conf = {(x["ato"], x["ano"]): x for x in rg.conferencia_limites()["atos"]}
        for a in rg.limites_pld()["atos"]:
            c = conf[(a["ato"], a["ano"])]
            if a["pld_min"] is not None and c.get("teo") is not None and c.get("teo_itaipu") is not None:
                self.assertEqual(a["pld_min"], max(c["teo"], c["teo_itaipu"]), a["ato"])


class VigenciaLimites(unittest.TestCase):
    def test_2022_campo_a_campo(self):
        # o despacho que atualizou os tetos foi publicado antes da resolução: cada campo
        # vem do ato que o informa, não do último publicado
        x = rg.limites_em("2022-06-15")
        self.assertEqual((x["pld_min"], x["ato_pld_min"]), (55.7, "Resolução Homologatória ANEEL nº 2.994/2021"))
        self.assertEqual((x["pld_max_horario"], x["ato_pld_max_horario"]), (1326.5, "Despacho ANEEL nº 4.046/2021"))
        self.assertEqual(x["pld_max_estrutural"], 646.58)

    def test_2023_retificacao_vale_o_ano_inteiro(self):
        x = rg.limites_em("2023-01-02")
        self.assertEqual((x["pld_max_horario"], x["pld_max_estrutural"], x["pld_min"]), (1404.77, 684.73, 69.04))
        self.assertTrue(x["ato_pld_max_horario"].startswith("Retificação"))

    def test_sem_ato_fica_vazio(self):
        x = rg.limites_em("2020-12-31")
        self.assertEqual((x["pld_min"], x["pld_max_horario"], x["pld_max_estrutural"]), (None, None, None))

    def test_vigencias_por_ano_completas(self):
        vig = rg.vigentes_por_ano()
        self.assertEqual([v["ano"] for v in vig], [2021, 2022, 2023, 2024, 2025, 2026])
        for v in vig:
            self.assertLess(v["pld_min"], v["pld_max_estrutural"])
            self.assertLess(v["pld_max_estrutural"], v["pld_max_horario"])


class RobustezEsquema(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(rg.AQUI, "limites_pld.json"), encoding="utf-8") as f:
            self.dado = json.load(f)

    def _erros_com(self, mudar):
        d = json.loads(json.dumps(self.dado))
        mudar(d)
        return rg.validar_limites(d)

    def test_arquivo_publicado_valido(self):
        self.assertEqual(rg.validar_limites(self.dado), [])

    def test_valor_que_nao_esta_no_trecho(self):
        erros = self._erros_com(lambda d: d["atos"][-1].__setitem__("pld_max_horario", 1611.05))
        self.assertTrue(any("1.611,05" in e for e in erros))

    def test_chave_a_mais_ou_a_menos(self):
        self.assertTrue(self._erros_com(lambda d: d["atos"][0].pop("dispositivo")))
        self.assertTrue(self._erros_com(lambda d: d["atos"][0].__setitem__("extra", 1)))

    def test_vigencia_fora_do_ano_e_publicacao_depois_do_fim(self):
        self.assertTrue(self._erros_com(lambda d: d["atos"][-1].__setitem__("vigencia_fim", "2027-01-31")))
        self.assertTrue(self._erros_com(lambda d: d["atos"][-1].__setitem__("data_publicacao", "2027-02-01")))

    def test_booleano_e_ausencia_total(self):
        self.assertTrue(self._erros_com(lambda d: d["atos"][-1].__setitem__("pld_min", True)))

        def sem_limites(d):
            for k in rg.CAMPOS_LIMITE:
                d["atos"][-1][k] = None
        self.assertTrue(self._erros_com(sem_limites))

    def test_piso_acima_do_teto(self):
        def inverte(d):
            a = d["atos"][-1]
            a["pld_min"], a["trecho"] = 900.0, a["trecho"] + " […] 900,00"
        self.assertTrue(any("piso < teto" in e for e in self._erros_com(inverte)))


class PeriodosDasAtas(unittest.TestCase):
    """Janelas de contribuição lidas do texto real das decisões."""

    @classmethod
    def setUpClass(cls):
        cls.atas = _atas()
        cls.cons = ar.consultas_das_atas([a for a in cls.atas if ar.ata_relevante(a)])

    def _janela(self, cid):
        j = ar.janela_vigente(self.cons[cid])
        return (j["inicio"], j["fim"]) if j else None

    def test_frases_diferentes_das_atas(self):
        self.assertEqual(self._janela("CP-30-2026"), ("2026-09-03", "2026-10-02"))        # "no período de 3 de setembro a 2 de outubro de 2026"
        self.assertEqual(self._janela("CP-2-2025-2"), ("2025-04-02", "2025-05-16"))       # "entre 2 de abril e 16 de maio de 2025"
        self.assertEqual(self._janela("CP-32-2019"), ("2019-11-13", "2019-12-27"))        # dia da semana entre parênteses
        self.assertEqual(self._janela("CP-75-2020"), ("2020-12-10", "2021-01-25"))        # "10 dezembro de 2020" sem "de"
        self.assertEqual(self._janela("CP-1-2021"), ("2021-01-25", "2021-03-11"))         # sem ano: ano da reunião

    def test_prorrogacao_muda_o_fim(self):
        c = self.cons["CP-28-2025"]
        self.assertEqual([f["fase"] for f in c["fases"]], ["abertura", "prorrogação", "prorrogação"])
        self.assertEqual(self._janela("CP-28-2025"), ("2025-08-21", "2025-09-24"))

    def test_periodo_de_referencia_nao_e_janela(self):
        texto = "decidiu aprovar o relatório referente ao período de 1º de janeiro a 31 de dezembro de 2024"
        self.assertEqual(ar.periodos_da_decisao(texto, "2025-03-18"), [])

    def test_so_duracao_fica_sem_data(self):
        c = self.cons["CP-1-2026"]
        self.assertEqual(ar.fase_atual(c)["fase"], "2ª fase")
        self.assertEqual(ar.fase_atual(c)["duracao_dias"], 45)
        self.assertIsNone(ar.janela_vigente(c))  # a 1ª fase datada não vale no lugar da 2ª
        self.assertEqual(ar.situacao(c, "2026-07-05"), "prazo_nao_datado")


class SituacaoConsultas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cons = ar.consultas_das_atas([a for a in _atas() if ar.ata_relevante(a)])

    def test_situacao_muda_com_a_data(self):
        c = self.cons["CP-30-2026"]
        self.assertEqual(ar.situacao(c, "2026-09-02"), "a_abrir")
        self.assertEqual(ar.situacao(c, "2026-09-03"), "aberta")
        self.assertEqual(ar.situacao(c, "2026-10-02"), "aberta")
        self.assertEqual(ar.situacao(c, "2026-10-03"), "encerrada_aguardando")

    def test_vencida_nunca_aberta(self):
        for cid, c in self.cons.items():
            j = ar.janela_vigente(c)
            if j:
                self.assertNotIn(ar.situacao(c, "2030-01-01"), ("aberta", "a_abrir"), cid)

    def test_resultado_pelo_numero_citado(self):
        r = self.cons["CP-21-2025"]["resultado"]
        self.assertEqual((r["ato"], r["data"], r["vinculo"]), ("Resolução Normativa nº 1.167/2026", "2026-09-22", "numero_citado"))
        self.assertEqual(ar.situacao(self.cons["CP-21-2025"], "2026-09-30"), "decidida")

    def test_resultado_pelo_processo(self):
        r = self.cons["CP-2-2025-2"]["resultado"]
        self.assertEqual((r["ato"], r["vinculo"]), ("Resolução Homologatória nº 3.479/2025", "processo"))

    def test_numero_repetido_em_processos_diferentes(self):
        self.assertTrue(self.cons["CP-2-2025"]["numero_em_conflito"])
        self.assertTrue(self.cons["CP-2-2025-2"]["numero_em_conflito"])
        self.assertNotEqual(self.cons["CP-2-2025"]["processos"], self.cons["CP-2-2025-2"]["processos"])

    def test_linha_de_abertura_nao_e_resultado(self):
        # a fonte repete "Resultado da Consulta Pública nº 33/2019" no assunto da própria abertura
        c = self.cons["CP-33-2019"]
        self.assertIn("Resultado", c["tema"])
        self.assertIsNone(c["resultado"])


class BlocoConsultasNoSilver(unittest.TestCase):
    """Bloco da gold sobre um silver em memória com os recortes reais."""

    def test_bloco_e_csv(self):
        con = base.conecta(":memory:")
        corpo = _ler("audiencias-consultas-publicas-aneel.csv", "rb")
        vid, _ = base.registra_vintage(con, m.DS_PART, "audiencias-consultas-publicas-aneel.csv", m.URL_PART,
                                       "2026-09-30T23:08:00Z", None, base.sha256_bytes(corpo), len(corpo), "teste", None)
        linhas, regs = [], []
        for r in ar.le_csv(corpo):
            ano = r["AnoReferencia"]
            linhas += [("consultas", ano, float(r["QtdConsultasPublicas"])), ("audiencias", ano, float(r["QtdAudienciasPublicas"]))]
            regs.append((ano, "gerado_em", r["DatGeracaoConjuntoDados"]))
        base.grava_observacoes(con, m.DS_PART, vid, linhas)
        base.grava_registros(con, m.DS_PART, vid, regs)
        with tempfile.TemporaryDirectory() as tmp:
            b = m._bloco_consultas(con, {"destino_csv": tmp}, "2026-09-30", _atas(), {"P&E22-02"})
            with open(os.path.join(tmp, m.CSV_CONS), encoding="utf-8", newline="") as f:
                linhas_csv = list(csv.reader(f, delimiter=";"))
        # campos com ';' (texto literal das decisões) vêm entre aspas: toda linha tem o mesmo número de colunas
        self.assertEqual({len(x) for x in linhas_csv}, {len(linhas_csv[0])})
        self.assertEqual(b["contagem_por_situacao"]["aberta"], 1)
        self.assertEqual([i["id"] for i in b["itens"] if i["situacao"] == "aberta"], ["CP-30-2026"])
        self.assertEqual(len(linhas_csv) - 1, b["total_historico"])
        cp18 = next(i for i in b["_todos"] if i["id"] == "CP-18-2026")
        self.assertEqual(cp18["agenda_codigos"], ["P&E22-02"])  # "P&E22 – 02" no texto da ata
        cob = {x["ano"]: x for x in b["cobertura"]}
        self.assertEqual(cob[2025]["total_anual_aneel"], 47)
        self.assertTrue(cob[2026]["parcial"])
        self.assertEqual(m._valida_gold({"limites_pld": {"atos": []}, "consultas": {"itens": b["itens"]},
                                         "linha_do_tempo": {"eventos": []}}, "2026-09-30"), [])
        errado = [dict(b["itens"][0], situacao="aberta", fim="2026-09-01", inicio="2026-08-01")]
        self.assertTrue(m._valida_gold({"limites_pld": {"atos": []}, "consultas": {"itens": errado},
                                        "linha_do_tempo": {"eventos": []}}, "2026-09-30"))


class AgendaEProcedimentos(unittest.TestCase):
    def test_anexo_da_agenda(self):
        itens = ar.agenda_do_anexo(_ler("prt20257030_anexo_amostra.txt"))
        self.assertEqual(len(itens), 22)
        por = {i["codigo"]: i for i in itens}
        self.assertEqual(por["AR25-15"]["ano_previsto"], 2026)
        self.assertEqual(por["AR24-22"]["ano_previsto"], 2027)
        self.assertTrue(por["AR24-22"]["atividade"].startswith("Regulamentação do art. 17 da Lei nº 14.300/2022"))
        self.assertIn({"rotulo": "Transição e ambiente", "href": "/setor-eletrico/transicao"},
                      ar.paineis_da_atividade(por["AR24-22"]["atividade"]))

    def test_anexo_quebrado_levanta_erro(self):
        t = _ler("prt20257030_anexo_amostra.txt").replace("instalações de transmissão.", "instalações de transmissão", 1)
        with self.assertRaises(ValueError):
            ar.agenda_do_anexo(t)

    def test_revisao_da_agenda_na_pagina(self):
        rev = ar.revisao_da_agenda(_ler("govbr_agenda.html", "rb"))
        self.assertEqual(rev["atualizada_por"], "Portaria nº 7.157, de 8 de setembro de 2026")

    def test_prodist_e_proret(self):
        pd = {i["modulo"]: i for i in ar.procedimentos_da_pagina(_ler("govbr_prodist.html", "rb"), "PRODIST")}
        self.assertEqual(len(pd), 11)
        self.assertEqual((pd["Módulo 8"]["versao"], pd["Módulo 8"]["ato"]), ("v14", "Resolução Normativa nº 1.137/2025"))
        self.assertEqual(pd["Módulo 7"]["ato"], "Resolução Normativa nº 956/2021")
        pr = {i["modulo"]: i for i in ar.procedimentos_da_pagina(_ler("govbr_proret.html", "rb"), "PRORET")}
        self.assertEqual((pr["Submódulo 2.6"]["versao"], pr["Submódulo 2.6"]["ato"]), ("3.0", "Resolução Normativa nº 1.114/2025"))
        self.assertEqual(pr["Submódulo 2.1 A"]["ato"], "Resolução Normativa nº 1.114/2025")  # arquivo 'ren2025...' sem o 'a'
        self.assertIn("terá vigência a partir de 1º/1/2027", pr["Submódulo 2.5"]["observacao"])


class BandeirasEParticipacao(unittest.TestCase):
    def _vig(self, com_acionamento=True):
        ad = ar.bandeiras_adicional(ar.le_csv(_ler("bandeira-tarifaria-adicional.csv", "rb")))
        ac = ar.bandeiras_acionamento(ar.le_csv(_ler("bandeira-tarifaria-acionamento_recorte.csv", "rb"))) if com_acionamento else None
        return ar.vigencias_bandeiras(ad, ac)

    def test_vigencias_dos_adicionais(self):
        vig = self._vig()
        am = [x for x in vig if x["patamar"] == "Amarela"]
        x21 = next(x for x in am if x["vigencia_inicio"] == "2021-07-01")
        self.assertEqual((x21["ato"], x21["rs_mwh"], x21["vigencia_fim"], x21["vigencia_fim_origem"]),
                         ("REH nº 2.888/2021", 18.74, "2022-06-30", "valor_seguinte"))
        # Amarela continua sendo acionada (2026 no recorte) e não tem valor posterior: sem fim
        self.assertIsNone(am[-1]["vigencia_fim"])
        self.assertEqual(am[-1]["ato"], "REH nº 3.306/2024")

    def test_escassez_hidrica_termina_em_abril_de_2022(self):
        # Releitura independente do recurso Acionamento (csv da biblioteca padrão): último mês
        # com o patamar e o valor do mês
        with open(os.path.join(DADOS, "bandeira-tarifaria-acionamento_recorte.csv"), encoding="utf-8-sig", newline="") as f:
            meses = [(r["DatCompetencia"][:7], r["VlrAdicionalBandeira"]) for r in csv.DictReader(f, delimiter=";")
                     if r["NomBandeiraAcionada"] == "Escassez Hídrica"]
        self.assertEqual(meses[-1], ("2022-04", "71,00"))
        esc = [x for x in self._vig() if x["patamar"] == "Escassez Hídrica"]
        # grão mensal: o mês de abril de 2022 teve acionamento em parte (R$ 71,00 = metade de R$ 142,00);
        # o dia do fim não é informado e fica vazio, em vez de imputar 30/04/2022
        self.assertEqual([(x["rs_mwh"], x["vigencia_fim"], x["vigencia_fim_mes"], x["vigencia_fim_grao"], x["vigencia_fim_origem"])
                          for x in esc], [(142.0, None, "2022-04", "mes", "ultimo_acionamento")])
        self.assertEqual(esc[0]["conferencia_acionamento"]["mes_parcial"], {"competencia": "2022-04", "rs_mwh": 71.0})
        self.assertEqual(esc[0]["conferencia_acionamento"]["meses_divergentes"], [])
        self.assertEqual(esc[0]["ultimo_acionamento"], {"competencia": "2022-04", "rs_mwh": 71.0})
        self.assertEqual(esc[0]["resolucao_seguinte_sem_patamar"], {"ato": "REH nº 3.051/2022", "vigencia_inicio": "2022-07-01"})
        # o dicionário do recurso escreve a mesma vigência
        self.assertEqual(ar.vigencia_no_dicionario(_ler("dm-bandeira-tarifaria-acionamento_trecho.txt")),
                         {"Escassez Hídrica": ("2021-09", "2022-04")})

    def test_sem_acionamento_o_fim_fica_vazio(self):
        # sem o recurso Acionamento a fonte Adicional não informa término: vazio, nunca inventado
        esc = [x for x in self._vig(com_acionamento=False) if x["patamar"] == "Escassez Hídrica"]
        self.assertEqual([(x["vigencia_fim"], x["vigencia_fim_mes"], x["vigencia_fim_origem"]) for x in esc], [(None, None, None)])


class TextosEConferencia(unittest.TestCase):
    def test_trecho_da_lei_com_pontuacao_do_html(self):
        e = next(x for x in rg.linha_do_tempo()["eventos"] if x["id"] == "lei-14203-2021")
        texto = ar.texto_html(_ler("lei14203_fragmento.html", "rb"))
        ok, faltam = ar.confere_trecho(e["trecho"], [texto])
        self.assertTrue(ok, faltam)
        self.assertFalse(ar.confere_trecho(e["trecho"].replace("automaticamente", "anualmente"), [texto])[0])

    def test_pagina_do_trecho(self):
        a = _ato(2024, "3.304")
        self.assertEqual(ar.pagina_do_trecho(_ler("reh20233304ti.txt"), a["trecho"]), 1)

    def test_numeros_e_normalizacao(self):
        self.assertEqual(rg.numero_br(1611.04), "1.611,04")
        self.assertEqual(rg.numero_br(57.3), "57,30")
        self.assertEqual(ar.normaliza("Elétrica. ” (NR)  Art.\n2º"), "Elétrica.” (NR) Art. 2º")

    def test_linha_do_tempo_curada(self):
        lt = rg.linha_do_tempo()
        docs = rg.documentos()
        for e in lt["eventos"]:
            self.assertIn(e["documento"], docs)
            self.assertIsNone(e["impacto_estimado"])
            if e["data_publicacao"]:
                self.assertLessEqual(e["data_publicacao"], e["vigencia_inicio"], e["id"])
        vac = {e["id"]: e for e in lt["eventos"]}
        self.assertEqual(rg.vigencia_por_vacancia("2021-09-13", 120), vac["lei-14203-2021"]["vigencia_inicio"])
        self.assertEqual(rg.vigencia_por_vacancia("2025-05-21", 45), vac["mpv-1300-2025"]["vigencia_inicio"])


class PeriodosRedacoesReais(unittest.TestCase):
    """Redações das atas que o leitor de períodos perdia (verificação de 30/09/2026), com as
    frases reais das decisões guardadas em atas_amostra_defeitos.csv.gz."""

    @classmethod
    def setUpClass(cls):
        cls.atas = _atas_defeitos()
        cls.cons = ar.consultas_das_atas([a for a in cls.atas if ar.ata_relevante(a)], _totais_completos())

    def _decisao(self, data, num):
        return next(a for a in self.atas if a["data"] == data and a["num_ato"].lstrip("0") == num)

    def _janela(self, cid):
        j = ar.janela_vigente(self.cons[cid])
        return (j["inicio"], j["fim"]) if j else None

    def test_entre_os_dias(self):
        for num in ("23", "5"):  # CP 23/2026 e AP 5/2026, ata de 28/07/2026
            a = self._decisao("2026-07-28", num)
            self.assertIn("entre os dias 30 de julho e 14 de setembro de 2026", " ".join(a["decisao"].split()))
            self.assertEqual([(j["inicio"], j["fim"]) for j in ar.periodos_da_decisao(a["decisao"], a["data"])],
                             [("2026-07-30", "2026-09-14")])
        self.assertEqual(self._janela("CP-23-2026"), ("2026-07-30", "2026-09-14"))
        self.assertEqual(self._janela("AP-5-2026"), ("2026-07-30", "2026-09-14"))
        self.assertEqual(ar.situacao(self.cons["CP-23-2026"], "2026-09-30"), "encerrada_aguardando")
        # CP 46/2025: "entre os dias 10 de dezembro de 2025 e 9 de março de 2026"
        self.assertEqual(self._janela("CP-46-2025"), ("2025-12-10", "2026-03-09"))

    def test_cp_21_2025_tem_janela_e_continua_decidida(self):
        # ata de 29/04/2025: "entre os dias 30 de abril e 13 de junho de 2025"
        c = ar.consultas_das_atas([a for a in _atas() if ar.ata_relevante(a)])["CP-21-2025"]
        self.assertEqual((c["fases"][0]["inicio"], c["fases"][0]["fim"]), ("2025-04-30", "2025-06-13"))
        self.assertEqual(ar.situacao(c, "2026-09-30"), "decidida")

    def test_datas_numericas(self):
        # pauta da 17ª Reunião Pública Circuito de 29/09/2026: "de 30/09/2026 a 14/11/2026" (ainda sem deliberação)
        pauta = next(a for a in self.atas if a["data"] == "2026-09-29")
        self.assertEqual(pauta["resultado"], "")
        self.assertEqual([(j["inicio"], j["fim"]) for j in ar.periodos_da_decisao(pauta["decisao"], pauta["data"])],
                         [("2026-09-30", "2026-11-14")])
        # quando a ata registrar a deliberação, a consulta conta como aberta em 01/10/2026 (tipo e
        # número do aviso preenchidos só para formar a chave; a frase é a real)
        deliberada = dict(pauta, resultado="Deliberado", tipo_ato="Aviso de consulta Pública", num_ato="99")
        c = ar.consultas_das_atas([deliberada])["CP-99-2026"]
        self.assertEqual(ar.situacao(c, "2026-10-01"), "aberta")
        # AP 52/2017: "entre os dias 28/09/2017 e 13/11/2017"
        self.assertEqual(self._janela("AP-52-2017"), ("2017-09-28", "2017-11-13"))

    def test_inicio_ate_finalizando_e_erro_de_digitacao(self):
        self.assertEqual(self._janela("CP-23-2022"), ("2022-05-12", "2022-06-27"))   # "com início em 12 de maio até 27 de junho de 2022"
        self.assertEqual(self._janela("CP-8-2022"), ("2022-03-30", "2022-04-13"))    # "iniciando em 30 de março e finalizando em 13 de abril"
        self.assertEqual(self._janela("CP-45-2023"), ("2023-12-13", "2024-02-11"))   # "de 13 de dezembro a e 11 de fevereiro de 2024"

    def test_inicio_e_duracao_tem_fim_calculado_e_rotulado(self):
        # CP 16/2026: "pelo prazo de 93 dias, a partir de 8 de junho de 2026"
        f = ar.fase_atual(self.cons["CP-16-2026"])
        self.assertEqual((f["inicio"], f["fim"], f["janela_origem"], f["fim_calculado"], f["duracao_dias"]),
                         ("2026-06-08", "2026-09-08", "inicio_e_duracao", True, 93))
        self.assertEqual(ar.situacao(self.cons["CP-16-2026"], "2026-09-08"), "aberta")
        self.assertEqual(ar.situacao(self.cons["CP-16-2026"], "2026-09-30"), "encerrada_aguardando")
        # conta o dia do início, como a ata de 12/09/2017: "15 dias, com início em 1 de novembro e término em 15 de novembro"
        self.assertEqual(ar.fim_pela_duracao("2017-11-01", 15), "2017-11-15")
        # com as duas datas escritas, nada é calculado (CP 23/2026 também declara 46 dias)
        a = self._decisao("2026-07-28", "23")
        self.assertEqual(ar.janelas_da_decisao(a["decisao"], a["data"])[1], "datas_explicitas")
        self.assertFalse(ar.fase_atual(self.cons["CP-23-2026"])["fim_calculado"])

    def test_audiencia_so_com_sessao(self):
        c = self.cons["AP-7-2025"]
        self.assertEqual(ar.fase_atual(c)["sessao"], "2025-11-06")
        self.assertEqual(ar.situacao(c, "2026-09-30"), "sessao_sem_periodo")
        self.assertIn("sessão", ar.SITUACOES["sessao_sem_periodo"])
        self.assertNotIn("sessão", ar.SITUACOES["prazo_nao_datado"])

    def test_resultado_em_pauta_depois_de_fase_sem_data(self):
        # CP 45/2019: 3ª fase de 60 dias deliberada em 10/12/2024 sem datas; resultado levado à
        # reunião de 28/07/2026 (pedido de vista): as contribuições acabaram
        c = self.cons["CP-45-2019"]
        f = ar.fase_atual(c)
        self.assertEqual((f["fase"], f["data_deliberacao"], f["inicio"], f["duracao_dias"]), ("3ª fase", "2024-12-10", None, 60))
        self.assertEqual((c["resultado"]["data"], c["resultado"]["decidido"]), ("2026-07-28", False))
        self.assertEqual(ar.situacao(c, "2026-09-30"), "resultado_em_pauta")


class NumeroDasConsultas(unittest.TestCase):
    """Número implausível e resultado que cita mais de uma consulta (CP 1661/2020, CP 92/2020,
    AP 33/2019 e CP 34/2019)."""

    @classmethod
    def setUpClass(cls):
        cls.totais = _totais_completos()
        cls.cons = ar.consultas_das_atas([a for a in _atas_defeitos() if ar.ata_relevante(a)], cls.totais)

    def test_numero_acima_do_total_anual(self):
        self.assertEqual(self.totais[("CP", 2020)], 78)  # QtdConsultasPublicas de 2020, lido à parte
        c = self.cons["CP-1661-2020"]
        self.assertTrue(c["numero_suspeito"])
        self.assertIn("78 em 2020", c["motivo_numero_suspeito"])
        self.assertEqual((c["numero_na_ata"], c["numero"]), (1661, 37))  # o processo cita "Consulta Pública nº 37/2020"
        self.assertEqual((c["resultado"]["ato"], c["resultado"]["decidido"]), ("Resolução Normativa nº 1.018/2022", True))
        self.assertEqual(ar.situacao(c, "2026-09-30"), "decidida")
        c = self.cons["CP-92-2020"]
        self.assertEqual((c["numero_suspeito"], c["numero"]), (True, 1))
        self.assertEqual(c["resultado"]["ato"], "Resolução Normativa nº 901/2020")
        self.assertEqual(ar.situacao(c, "2026-09-30"), "decidida")

    def test_ano_parcial_nao_serve_de_teto(self):
        # 2026: o arquivo de contagens foi gerado em 22/07/2026 (18 consultas até então)
        self.assertNotIn(("CP", 2026), self.totais)
        self.assertFalse(self.cons["CP-23-2026"]["numero_suspeito"])

    def test_resultado_de_duas_consultas_na_mesma_linha(self):
        for cid in ("AP-33-2019", "CP-34-2019"):
            r = self.cons[cid]["resultado"]
            self.assertEqual((r["ato"], r["data"], r["decidido"]), ("Resolução Normativa nº 869/2020", "2020-01-28", True), cid)
        self.assertEqual(ar.alvos_do_resultado(
            "Resultado da Audiência Pública nº 33/2019 e da Consulta Pública nº 34/2019 (Segunda Fase da Audiência Pública nº 33/2019), "
            "instituídas com vistas a colher subsídios às propostas de aprimoramento das Regras de Comercialização de Energia Elétrica, versão 2020."),
            [("AP", 33, 2019), ("CP", 34, 2019)])
        # frases reais das atas: resultado depois da análise de contribuições entra; resultado parcial não decide
        self.assertEqual(ar.alvos_do_resultado("Proposta de Orçamento Anual da Conta de Desenvolvimento Energético – CDE de 2025, após a "
                                               "análise das contribuições recebidas na Consulta Pública nº 38/2024."), [("CP", 38, 2024)])
        self.assertEqual(ar.alvos_do_resultado("Prorrogação do prazo do pedido de vista referente ao resultado parcial da Audiência "
                                               "Pública nº 25/2019, instituída com vistas a colher subsídios"), [])
        self.assertEqual(ar.alvos_do_resultado("Resultados da Primeira e da Segunda Fase da Consulta Pública nº 33/2019 e da Consulta "
                                               "Pública nº 45/2020, instituídas, respectivamente, com vistas a"),
                         [("CP", 33, 2019), ("CP", 45, 2020)])


class ProcedimentosConferidos(unittest.TestCase):
    """Versão vigente da página oficial conferida com atas e com os anexos da REN nº 1.137/2025."""

    @classmethod
    def setUpClass(cls):
        cls.pagina = {i["modulo"]: i for i in ar.procedimentos_da_pagina(_ler("govbr_prodist.html", "rb"), "PRODIST")}
        cls.aprov = ar.aprovacoes_de_procedimentos(_atas_defeitos())
        tit = {ar.canonico_procedimento(k): v["titulo"] for k, v in cls.pagina.items()}
        cls.anexos = ar.anexos_de_procedimentos(_ler("ren20251137_anexos.txt"), tit)

    def test_aprovacoes_nas_atas(self):
        ren1137 = sorted(e["modulo"] for e in self.aprov if e["ato"] == "Resolução Normativa nº 1.137/2025")
        # "aprovar novas versões dos Módulos 1, 4, 6, 8 e 11 dos Procedimentos de Distribuição – PRODIST, nos Módulo 4 e 6
        # das Regras de Transmissão": os módulos das Regras de Transmissão não entram
        self.assertEqual(ren1137, ["Módulo 1", "Módulo 11", "Módulo 4", "Módulo 6", "Módulo 8"])
        self.assertIn(("PRODIST", "Módulo 3", "Despacho nº 3.717/2023"), {(e["conjunto"], e["modulo"], e["ato"]) for e in self.aprov})
        p73 = next(e for e in self.aprov if e["conjunto"] == "PRORET" and e["modulo"] == "Submódulo 7.3")
        self.assertEqual((p73["data"], p73["versao_aprovada"]), ("2024-07-23", "2.7"))

    def test_anexos_da_ren_1137(self):
        self.assertEqual(sorted(a["modulo"] for a in self.anexos),
                         ["Módulo 1", "Módulo 11", "Módulo 4", "Módulo 6", "Módulo 8", "Módulo 9"])

    def test_confere_versao(self):
        ev = {}
        for e in self.aprov:
            ev.setdefault(e["modulo"], []).append(e)
        for a in self.anexos:
            ev.setdefault(a["modulo"], []).append({"ato": "Resolução Normativa nº 1.137/2025", "numero": 1137, "ano": 2025,
                                                   "data": "2025-10-21", "fonte": "texto do ato", "trecho": a["trecho"]})

        def conf(mod):
            i = self.pagina[mod]
            n, a = (int(x.replace(".", "")) for x in re.search(r"nº ([\d.]+)/(\d{4})", i["ato"]).groups())
            return ar.confere_versao({"numero_ato": n, "ano_ato": a, "ato": i["ato"]}, ev.get(mod, []), None)
        for mod in ("Módulo 9", "Módulo 11", "Módulo 3"):
            r = conf(mod)
            self.assertEqual(self.pagina[mod]["ato"], "Resolução Normativa nº 956/2021")
            self.assertEqual((r["situacao"], r["ato_vigente"]), ("pagina_possivelmente_desatualizada", None), mod)
        self.assertEqual(conf("Módulo 8")["situacao"], "confirmada_por_ato_integrado")
        self.assertEqual(conf("Módulo 8")["ato_vigente"], "Resolução Normativa nº 1.137/2025")
        self.assertEqual(conf("Módulo 2")["situacao"], "sem_conferencia_externa")


class RegraDoArt23(unittest.TestCase):
    def test_aplicacao_literal_nao_reproduz_os_atos(self):
        # valores-base lidos do texto do art. 23, § 1º, da REN nº 1.032/2022
        base23 = m._base_art23({"ren20221032": {"status": "ok", "textos": [_ler("ren20221032_art23.txt")]}})
        self.assertEqual(base23, {"pld_max_estrutural": 556.58, "pld_max_horario": 1141.85, "mes_base": "2019-09"})
        ipca = {**ar.ipca_sidra(_ler("sidra_1737_novembros.json", "rb")), **ar.ipca_sidra(_ler("sidra_1737_201909.json", "rb"))}
        self.assertEqual(ipca["2019-09"], 5227.84)
        lit_e = 556.58 * ipca["2025-11"] / ipca["2019-09"]
        lit_h = 1141.85 * ipca["2025-11"] / ipca["2019-09"]
        self.assertAlmostEqual(lit_e, 785.60, delta=0.005)
        self.assertAlmostEqual(lit_h, 1611.69, delta=0.005)
        # o Despacho nº 3.850/2025 publicou 785,27 e 1.611,04: a conta literal fica fora da tolerância
        self.assertGreater(abs(lit_e - 785.27), m.TOL_IPCA_RS)
        self.assertGreater(abs(lit_h - 1611.04), m.TOL_IPCA_RS)


class EvidenciaIndependente(unittest.TestCase):
    def test_data_escrita_no_texto_integral(self):
        cp30 = next(a for a in _atas() if a["data"] == "2026-09-01")["decisao"]  # "de 3 de setembro a 2 de outubro de 2026"
        self.assertTrue(m._data_escrita(cp30, "2026-09-03"))
        self.assertTrue(m._data_escrita(cp30, "2026-10-02"))
        self.assertFalse(m._data_escrita(cp30, "2026-10-03"))  # um dia a mais não passa
        ap52 = next(a for a in _atas_defeitos() if a["data"] == "2017-09-26")["decisao"]
        self.assertTrue(m._data_escrita(ap52, "2017-09-28"))


class AgendaELimites(unittest.TestCase):
    def test_atividades_sobre_limites(self):
        # textos do Anexo I da Portaria nº 7.030/2025 (AR24-05 e AR24-18) e AR26-24 da amostra
        self.assertTrue(m.REGRA_LIMITES_AGENDA.search(
            "Atualização da metodologia de cálculo dos limites máximos do Preço de Liquidação das Diferenças – PLD."))
        self.assertTrue(m.REGRA_LIMITES_AGENDA.search(
            "Avaliação das metodologias de cálculo do PLD mínimo e de definição da Tarifa de Energia de Otimização – TEO."))
        ar2624 = next(i for i in ar.agenda_do_anexo(_ler("prt20257030_anexo_amostra.txt")) if i["codigo"] == "AR26-24")
        self.assertIn("PLD", ar2624["atividade"])
        self.assertFalse(m.REGRA_LIMITES_AGENDA.search(ar2624["atividade"]))

    def test_codigo_da_agenda_depois_de_700_caracteres(self):
        ap7 = next(a for a in _atas_defeitos() if a["data"] == "2025-10-28")
        self.assertGreater(ap7["decisao"].find("AR24-22"), 700)
        self.assertNotIn("AR24-22", ar.limpa_decisao(ap7["decisao"]))
        con = base.conecta(":memory:")
        with tempfile.TemporaryDirectory() as tmp:
            b = m._bloco_consultas(con, {"destino_csv": tmp}, "2026-09-30", _atas_defeitos(), {"AR24-22", "AR25-08"})
        item = next(i for i in b["_todos"] if i["id"] == "AP-7-2025")
        self.assertEqual(item["agenda_codigos"], ["AR24-22", "AR25-08"])


class ResultadosSemAPalavraResultado(unittest.TestCase):
    """Defeito 1 da segunda verificação: decisões que consolidam o edital ou a norma depois da
    consulta, sem a palavra "Resultado" no assunto, não decidiam a consulta (CP 6/2026 e CP
    28/2025 ficavam encerradas aguardando). Linhas reais em atas_amostra_resultados.csv.gz."""

    @classmethod
    def setUpClass(cls):
        cls.atas = _atas_resultados()
        cls.cons = ar.consultas_das_atas([a for a in cls.atas if ar.ata_relevante(a)])

    def _linha(self, data, num):
        return next(a for a in self.atas if a["data"] == data and a["num_ato"] == num)

    def test_cp_6_2026_decidida_pelo_despacho_2266(self):
        a = self._linha("2026-06-22", "2266")
        # releitura independente do texto da decisão
        self.assertIn("aprovar a minuta do Edital do Leilão nº 4/2026-ANEEL, com os respectivos Apêndices e Anexos, consolidada "
                      "com os aprimoramentos decorrentes da Consulta Pública nº 6/2026", _sem_espacos(a["decisao"]))
        self.assertIn("consolidado após avaliação das contribuições apresentadas na Consulta Pública nº 6/2026", _sem_espacos(a["assunto"]))
        self.assertEqual(ar.alvos_da_consolidacao(a["decisao"]), [("CP", 6, 2026)])
        self.assertEqual(ar.alvos_do_resultado(a["assunto"]), [])  # a regra antiga não via esta linha
        r = self.cons["CP-6-2026"]["resultado"]
        self.assertEqual((r["ato"], r["data"], r["decidido"], r["vinculo"], r["forma"]),
                         ("Despacho nº 2.266/2026", "2026-06-22", True, "numero_citado", "consolidacao"))
        self.assertEqual(ar.situacao(self.cons["CP-6-2026"], "2026-09-30"), "decidida")

    def test_cp_28_2025_decidida_pelo_despacho_3323(self):
        a = self._linha("2025-11-11", "3323")
        self.assertIn("consolidada com os aprimoramentos decorrentes da Consulta Pública nº 28/2025", _sem_espacos(a["decisao"]))
        self.assertIn("consolidado após análise das contribuições apresentadas na Consulta Pública nº 28/2025", _sem_espacos(a["assunto"]))
        c = self.cons["CP-28-2025"]
        self.assertEqual(ar.janela_vigente(c)["fim"], "2025-09-24")  # prorrogação de 16/09/2025, conferida antes
        self.assertEqual((c["resultado"]["ato"], c["resultado"]["data"]), ("Despacho nº 3.323/2025", "2025-11-11"))
        self.assertEqual(ar.situacao(c, "2026-09-30"), "decidida")
        self.assertEqual(self.cons["CP-18-2025"]["resultado"]["ato"], "Despacho nº 1.929/2025")

    def test_cp_3_2026_objeto_aprovado_sem_numero(self):
        # 16/06/2026, mesmo processo 48500.007732/2007-09: "aprovar os aprimoramentos do Submódulo 6.2 dos
        # Procedimentos de Regulação Tarifária" sem citar a Consulta Pública nº 3/2026
        a = self._linha("2026-06-16", "1160")
        self.assertIn("aprovar os aprimoramentos do Submódulo 6.2 dos Procedimentos de Regulação Tarifária", _sem_espacos(a["decisao"]))
        self.assertNotIn("Consulta Pública", a["assunto"] + a["decisao"])
        c = self.cons["CP-3-2026"]
        self.assertEqual(ar.procedimentos_citados(c["tema"]), {("PRORET", "submódulo 6.2")})
        self.assertEqual((c["resultado"]["data"], c["resultado"]["vinculo"], c["resultado"]["forma"]),
                         ("2026-06-16", "processo_e_objeto", "objeto_aprovado_no_processo"))
        self.assertEqual(ar.situacao(c, "2026-09-30"), "decidida")

    def test_duas_consultas_na_mesma_oracao_e_extincao(self):
        r = self.cons["AP-1-2020"]["resultado"]
        self.assertEqual((r["ato"], r["data"]), ("Resolução Homologatória nº 2.684/2020", "2020-04-28"))
        self.assertEqual(ar.alvos_da_consolidacao("Revisão Tarifária Extraordinária da Equatorial Alagoas Distribuidora de Energia S.A., "
                                                  "a vigorar a partir de 3 de maio de 2020, após consolidação das contribuições recebidas por "
                                                  "meio da Consulta Pública nº 4/2020 e da Audiência Pública nº 1/2020."),
                         [("CP", 4, 2020), ("AP", 1, 2020)])
        r = self.cons["CP-20-2022"]["resultado"]  # "decidiu declarar extinto o processo de instrução da Consulta Pública nº 20/2022"
        self.assertEqual((r["ato"], r["data"], r["forma"]), ("Despacho nº 3.573/2025", "2025-12-02", "consolidacao"))

    def test_a_primeira_decisao_que_consolida_vale(self):
        # o Despacho nº 1.477/2026 (recursos contra o resultado do leilão) repete a descrição do edital; não troca o resultado
        r = self.cons["CP-35-2025"]["resultado"]
        self.assertEqual((r["ato"], r["data"]), ("Resolução Homologatória nº 3.568/2026", "2026-02-10"))
        self.assertIn("consolidado após avaliação das contribuições apresentadas na Consulta Pública nº 35/2025",
                      _sem_espacos(self._linha("2026-04-28", "1477")["assunto"]))

    def test_contraexemplos_nao_decidem(self):
        # medida cautelar "até a análise definitiva das contribuições recebidas na Consulta Pública nº 33/2025"
        a = self._linha("2026-05-19", "1804")
        self.assertIn("até a análise definitiva das contribuições recebidas na Consulta Pública nº 33/2025", _sem_espacos(a["decisao"]))
        self.assertEqual(ar.alvos_da_consolidacao(a["decisao"]) + ar.alvos_da_consolidacao(a["assunto"]), [])
        self.assertNotEqual(ar.situacao(self.cons["CP-33-2025"], "2026-09-30"), "decidida")
        # impugnação ao edital "conforme minuta prevista na abertura da Audiência Pública nº 29/2019"
        a = self._linha("2019-10-08", "2.766")
        self.assertEqual(ar.alvos_da_consolidacao(a["decisao"]), [])
        self.assertIsNone(self.cons["AP-29-2019"]["resultado"])

    def test_controle_independente_das_abertas_ve_a_consolidacao(self):
        # o vocabulário do controle 3 da evidência pega as linhas que a regra antiga (só "Resultado",
        # "Encerramento", "Fechamento" no início do assunto) não pegava
        for data, num in (("2026-06-22", "2266"), ("2025-11-11", "3323"), ("2025-12-02", "3573")):
            a = self._linha(data, num)
            self.assertIsNone(re.match(r"\s*(Resultados?|Encerramento|Fechamento)\b", a["assunto"]))
            self.assertTrue(m.VOCABULARIO_RESULTADO.search(a["assunto"] + " " + a["decisao"]), (data, num))


class JanelaEDecisoesPendentes(unittest.TestCase):
    """Defeitos 4 e 9: a janela da gold usa a fase atual; decisões com resultado formal vazio ficam declaradas."""

    @classmethod
    def setUpClass(cls):
        con = base.conecta(":memory:")
        with tempfile.TemporaryDirectory() as tmp:
            cls.b = m._bloco_consultas(con, {"destino_csv": tmp}, "2026-09-30", _atas_resultados(), set(), _numeracao())

    def test_fase_recente_de_consulta_antiga_entra_na_janela(self):
        ids = {i["id"]: i for i in self.b["itens"]}
        # CP 1/2026: aberta em 27/01/2026 (fora dos 200 dias); 2ª fase de 45 dias instaurada em 30/06/2026, sem datas
        self.assertIn("CP-1-2026", ids)
        self.assertEqual((ids["CP-1-2026"]["fase_atual"], ids["CP-1-2026"]["situacao"]), ("2ª fase", "prazo_nao_datado"))
        self.assertEqual(ids["CP-1-2026"]["deliberacao_abertura"]["data"], "2026-01-27")
        self.assertIn("CP-9-2026", ids)

    def test_decisoes_da_pauta_sem_resultado_formal(self):
        p = self.b["decisoes_sem_resultado_formal"]
        self.assertEqual([(x["processos"], x["inicio"], x["fim"], x["situacao_se_confirmada"]) for x in p],
                         [(["48500.000846/2026-82"], "2026-09-30", "2026-11-14", "aberta"),
                          (["48500.023844/2026-61"], "2026-10-01", "2026-10-30", "a_abrir")])
        self.assertEqual((self.b["abertas_se_confirmadas"], self.b["a_abrir_se_confirmadas"]), (1, 1))
        # não entram na contagem: nenhum aviso foi reconstituído desses processos
        procs = {p for i in self.b["itens"] for p in i["processos"]}
        self.assertFalse(procs & {"48500.000846/2026-82", "48500.023844/2026-61"})
        self.assertEqual(ar.decisoes_sem_resultado_formal(_atas_resultados(), "2026-10-01")[1]["situacao_se_confirmada"], "aberta")

    def test_ato_suspeito_nao_aparece_como_certo(self):
        cp3 = next(i for i in self.b["itens"] if i["id"] == "CP-3-2026")
        self.assertEqual((cp3["resultado"]["ato"], cp3["resultado"]["ato_na_ata"], cp3["resultado"]["ato_suspeito"]),
                         (None, "Portaria nº 1.160/2026", True))
        self.assertIn("Resolução Normativa", cp3["resultado"]["motivo_ato_suspeito"])
        cp6 = next(i for i in self.b["itens"] if i["id"] == "CP-6-2026")
        self.assertEqual((cp6["resultado"]["ato"], cp6["resultado"]["ato_suspeito"]), ("Despacho nº 2.266/2026", False))


class NumeroDoAto(unittest.TestCase):
    """Defeito 6: número de ato fora da faixa do tipo, conferido com a numeração real das atas."""

    @classmethod
    def setUpClass(cls):
        cls.num = _numeracao()

    def test_faixa_por_tipo_e_ano(self):
        n = self.num
        # REN de 2024 na faixa de 1.08x a 1.11x (REN nº 1.093/2024 em 21/05/2024)
        self.assertIn(1093, n[("Resolução Normativa", 2024)])
        susp = {(t, k, a): ar.confere_numero_ato(t, k, a, n)[0] for t, k, a in (
            ("Resolução Normativa", 3354, 2024), ("Resolução Homologatória", 14985, 2023), ("Resolução Homologatória", 12536, 2022),
            ("Resolução Normativa", 2827, 2020), ("Portaria", 1160, 2026), ("Resolução Homologatória", 1084, 2024),
            ("Resolução Normativa", 1114, 2025), ("Resolução Normativa", 1160, 2026), ("Resolução Homologatória", 3304, 2023),
            ("Despacho", 3850, 2025), ("Despacho", 2266, 2026), ("Portaria", 7157, 2026))}
        self.assertEqual([k for k, v in susp.items() if v], [
            ("Resolução Normativa", 3354, 2024), ("Resolução Homologatória", 14985, 2023), ("Resolução Homologatória", 12536, 2022),
            ("Resolução Normativa", 2827, 2020), ("Portaria", 1160, 2026), ("Resolução Homologatória", 1084, 2024)])
        self.assertIn("cabe na faixa de Resolução Normativa", ar.confere_numero_ato("Portaria", 1160, 2026, n)[1])

    def test_aviso_de_leilao_pelo_numero_do_leilao(self):
        self.assertTrue(ar.confere_numero_ato(
            "Aviso de Convocação de Leilão", 3031, 2022, self.num,
            "Aprovação do Edital do Leilão nº 3/2022-ANEEL, denominado Leilão de Energia Nova “A-4”, de 2022, destinado a contratar")[0])
        self.assertFalse(ar.confere_numero_ato(
            "Aviso de Convocação de Leilão", 6, 2018, self.num,
            "Aprovação dos Editais dos Leilões nº 5/2018, denominado Leilão de Energia Existente A-1, de 2018 e nº 6/2018, denominado "
            "Leilão de Energia Existente A-2 de 2018, destinados à compra")[0])


class BandeirasContraAcionamento(unittest.TestCase):
    """Defeito 2: o recurso Adicional não tem as resoluções de set/2015 e nov/2017; o Acionamento contradiz o fim
    deduzido como véspera do valor seguinte."""

    @classmethod
    def setUpClass(cls):
        cls.ad = ar.bandeiras_adicional(ar.le_csv(_ler("bandeira-tarifaria-adicional.csv", "rb")))
        cls.ac = ar.bandeiras_acionamento(ar.le_csv(_ler("bandeira-tarifaria-acionamento_2015_2018.csv", "rb"))
                                          + ar.le_csv(_ler("bandeira-tarifaria-acionamento_recorte.csv", "rb")))
        cls.vig = ar.vigencias_bandeiras(cls.ad, cls.ac)

    def test_releitura_dos_meses_na_fonte(self):
        with open(os.path.join(DADOS, "bandeira-tarifaria-acionamento_2015_2018.csv"), encoding="utf-8-sig", newline="") as f:
            meses = {r["DatCompetencia"][:7]: (r["NomBandeiraAcionada"], r["VlrAdicionalBandeira"]) for r in csv.DictReader(f, delimiter=";")}
        self.assertEqual([meses[k] for k in ("2015-08", "2015-09", "2016-01")],
                         [("Vermelha P1", "55,00"), ("Vermelha P1", "45,00"), ("Vermelha P1", "45,00")])
        self.assertEqual([meses[k] for k in ("2017-10", "2017-11")], [("Vermelha P2", "35,00"), ("Vermelha P2", "50,00")])

    def _v(self, pat, ini):
        return next(x for x in self.vig if x["patamar"] == pat and x["vigencia_inicio"] == ini)

    def test_vermelha_p1_de_55_termina_em_agosto_de_2015(self):
        v = self._v("Vermelha P1", "2015-03-02")
        self.assertEqual((v["rs_mwh"], v["vigencia_fim"], v["vigencia_fim_mes"], v["vigencia_fim_grao"], v["vigencia_fim_origem"],
                          v["fim_incerto"], v["fim_pelo_recurso_adicional"]),
                         (55.0, None, "2015-08", "mes", "acionamento_diverge", False, "2016-01-31"))
        self.assertEqual([d["competencia"] for d in v["conferencia_acionamento"]["meses_divergentes"]],
                         ["2015-09", "2015-10", "2015-11", "2015-12", "2016-01"])

    def test_vermelha_p2_de_35_termina_em_outubro_de_2017(self):
        v = self._v("Vermelha P2", "2017-02-01")
        self.assertEqual((v["vigencia_fim"], v["vigencia_fim_mes"], v["vigencia_fim_origem"]), (None, "2017-10", "acionamento_diverge"))
        self.assertEqual(v["conferencia_acionamento"]["meses_divergentes"], [{"competencia": "2017-11", "rs_mwh": 50.0}])
        # vigência coerente com o Acionamento continua com o fim diário da véspera do valor seguinte
        a = self._v("Amarela", "2017-02-01")
        self.assertEqual((a["vigencia_fim"], a["vigencia_fim_grao"], a["conferencia_acionamento"]["meses_coerentes"]),
                         ("2018-04-30", "dia", 3))

    def test_valores_sem_resolucao_no_adicional(self):
        tr = ar.acionamentos_sem_resolucao(self.vig, self.ac)
        self.assertEqual([(t["patamar"], t["rs_mwh"], t["inicio"], t["fim"], t["motivo"]) for t in tr],
                         [("Vermelha P1", 30.0, "2015-01", "2015-02", "sem_vigencia"),
                          ("Vermelha P1", 45.0, "2015-09", "2016-01", "valor_diferente"),
                          ("Vermelha P2", 50.0, "2017-11", "2017-11", "valor_diferente")])

    def test_adicional_nao_positivo_reprova_a_validacao(self):
        g = {"limites_pld": {"atos": []}, "consultas": {"itens": []}, "linha_do_tempo": {"eventos": []},
             "bandeiras": {"vigencias": [dict(self._v("Amarela", "2017-02-01"), rs_mwh=0.0)]}}
        self.assertTrue(any("não positivo" in x for x in m._valida_gold(g, "2026-09-30")))
        g["bandeiras"]["vigencias"] = [self._v("Amarela", "2017-02-01")]
        self.assertEqual(m._valida_gold(g, "2026-09-30"), [])


class ProcedimentosNomesEAtos(unittest.TestCase):
    """Defeito 3: nomes de arquivo fora do padrão antigo e versões aprovadas por enumeração nas REN."""

    def test_nomes_de_arquivo_reais(self):
        base_url = "https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/procreg/proret/"
        casos = {"modulo03/subm3.1A/Proret_Submod_3.1A_v1.2_aren20251114.pdf": ("1.2", "Resolução Normativa nº 1.114/2025"),
                 "modulo04/subm4.1/Proret_Submod_4.1_V1.0C_aren20221003.pdf": ("1.0C", "Resolução Normativa nº 1.003/2022"),
                 "modulo09/subm9.3/Proret_Submod_9.3_V_1.2_adsp20253606.pdf": ("1.2", "Despacho nº 3.606/2025"),
                 "modulo12/subm12.1/Proret_Submod_12.1_V_2.4_adsp20253606.pdf": ("2.4", "Despacho nº 3.606/2025"),
                 "modulo02/subm2.1A/Proret_Submod_2.1A_V_2.2_ren20251114.pdf": ("2.2", "Resolução Normativa nº 1.114/2025")}
        for arq, esperado in casos.items():
            va = ar.versao_e_ato_do_arquivo(base_url + arq)
            self.assertEqual((va["versao"], va["ato"]), esperado, arq)
        self.assertEqual(ar.versao_e_ato_do_arquivo("https://x/aren2021956_Prodist_modulo_11_v2.pdf")["ato"], "Resolução Normativa nº 956/2021")
        self.assertIsNone(ar.versao_e_ato_do_arquivo("https://x/arquivo_sem_padrao.pdf"))

    def test_versoes_aprovadas_pela_ren_1114_e_1147(self):
        v = ar.versoes_aprovadas_no_ato(_ler("ren20251114_art2.txt"))
        self.assertEqual([(x["modulo"], x["versao"]) for x in v],
                         [("Submódulo 2.1", "2.5"), ("Submódulo 2.6", "3.0"), ("Submódulo 2.6A", "2.0"), ("Submódulo 3.1", "1.6"),
                          ("Submódulo 3.1A", "1.2"), ("Submódulo 3.2", "2.0"), ("Submódulo 3.2A", "2.0"), ("Submódulo 4.2", "1.3"),
                          ("Submódulo 4.3", "1.1")])
        self.assertEqual({x["conjunto"] for x in v}, {"PRORET"})
        self.assertEqual([(x["modulo"], x["versao"]) for x in ar.versoes_aprovadas_no_ato(_ler("ren20251147_art6.txt"))],
                         [("Submódulo 5.2", "1.5"), ("Submódulo 7.1", "2.9")])
        # sem "Aprovar" nem o nome do conjunto antes da enumeração, nada é aprovado
        self.assertEqual(ar.versoes_aprovadas_no_ato("ver o Submódulo 2.1, versão 2.5, citado na nota"), [])

    def test_versao_da_pagina_contra_a_do_ato(self):
        # página: Submódulo 4.3 v1.3 pela REN nº 1.114/2025; o art. 2º, IX, aprova a versão 1.1
        self.assertEqual(ar.confere_numero_da_versao("1.3", [{"versao_aprovada": "1.1"}]), "diverge")
        self.assertEqual(ar.confere_numero_da_versao("2.5", [{"versao_aprovada": "2.5"}]), "confere")
        self.assertEqual(ar.confere_numero_da_versao("1.10C", [{"versao_aprovada": "1.10"}]), "confere")
        self.assertIsNone(ar.confere_numero_da_versao("v14", [{"versao_aprovada": None}]))


class PublicacaoConferida(unittest.TestCase):
    """Defeitos 5 e 11: publicação da REN nº 1.000/2021 e metadados do Senado guardados e conferidos."""

    def test_ren_1000_publicada_em_20_12_2021(self):
        t = _ler("ren20211000_publicacao.txt")
        self.assertIn("original publicado no DOU de 20/12/2021, edição 238, seção 1, página 206.", _sem_espacos(t))
        e = next(x for x in rg.linha_do_tempo()["eventos"] if x["id"] == "ren-1000-2021")
        self.assertEqual(e["data_publicacao"], "2021-12-20")
        ok, faltam = ar.confere_trecho(ar.pedacos(e["trecho"])[-1], [t])
        self.assertTrue(ok, faltam)

    def test_metadados_do_senado(self):
        pub = ar.publicacao_original_senado(_ler("senado_lei14203_metadados.xml", "rb"))
        self.assertEqual(pub["data"], "2021-09-13")
        self.assertIn("Publicação Original", pub["dispositivo"])
        e = next(x for x in rg.linha_do_tempo()["eventos"] if x["id"] == "lei-14203-2021")
        self.assertEqual(e["data_publicacao"], pub["data"])
        self.assertEqual(rg.documentos()["lei14203_2021"]["metadados"], "https://legis.senado.leg.br/dadosabertos/legislacao/34849049")
        self.assertIsNone(ar.publicacao_original_senado(b"<nao-e-xml"))


class AgendaERegraDosLimites(unittest.TestCase):
    """Defeitos 8 e 10: resumo da regra dos limites e origem da revisão da Agenda."""

    def test_resumo_da_ren_1032_diz_o_que_os_atos_praticam(self):
        r = next(x for x in rg.linha_do_tempo()["eventos"] if x["id"] == "ren-1032-2022")["resumo"]
        self.assertIn("encadeiam o teto publicado no ano anterior pela variação do IPCA de novembro", r)
        self.assertIn("art23_literal", r)

    def test_revisao_da_agenda_aponta_para_leis_org(self):
        url = ar.link_revisao_agenda(_ler("govbr_agenda.html", "rb"))
        self.assertTrue(url.startswith("https://leis.org/aneel/lei/portaria/2026/7157/"), url)
        bloq = [b for b in rg.conferencia_limites()["bloqueios"] if b["fonte"].startswith("leis.org")]
        self.assertEqual(len(bloq), 1)
        self.assertIn("403", bloq[0]["resposta"])


@unittest.skipUnless(os.path.exists(os.path.join(base.GOLD, m.GOLD)), "gold ainda não publicada")
class GoldPublicada(unittest.TestCase):
    def setUp(self):
        self.g = base.le_gold(m.GOLD)
        if not self.g.get("disponivel"):
            self.skipTest("gold indisponível")

    def test_resumo_igual_ao_detalhe(self):
        abertas = [i for i in self.g["consultas"]["itens"] if i["situacao"] == "aberta"]
        self.assertEqual(self.g["resumo"]["consultas_abertas"], len(abertas))
        self.assertEqual(self.g["resumo"]["atividades_agenda"], len(self.g["agenda"]["itens"]))
        hoje = self.g["limites_pld"]["vigente_hoje"]
        self.assertEqual(hoje, rg.limites_em(hoje["data"]) | {"data": hoje["data"]})

    def test_conferencias_sem_reprovacao(self):
        for tipo, cont in self.g["limites_pld"]["conferencias"].items():
            self.assertEqual(cont["reprovado"], 0, tipo)

    def test_defeitos_da_verificacao_nao_voltam(self):
        g = self.g
        esc = [x for x in g["bandeiras"]["vigencias"] if x["patamar"] == "Escassez Hídrica"]
        self.assertEqual([(x["vigencia_fim"], x["vigencia_fim_mes"]) for x in esc], [(None, "2022-04")])
        m11 = next(i for i in g["procedimentos"]["itens"] if i["conjunto"] == "PRODIST" and i["modulo"] == "Módulo 11")
        self.assertEqual((m11["conferencia"], m11["ato_vigente"]), ("pagina_possivelmente_desatualizada", None))
        self.assertEqual(sorted(x["codigo"] for x in g["limites_em_revisao"]), ["AR24-05", "AR24-18"])
        self.assertEqual(g["proveniencia"]["agenda"]["natureza"], "PREVISTO")
        nomes = [t["nome"] for t in g["evidencias"]["consultas_abertas"]["testes"]]
        self.assertFalse(any("relida do trecho" in n for n in nomes))
        self.assertNotIn("art. 23, § 1º, da REN nº 1.032/2022 refeita", json.dumps(g["evidencias"], ensure_ascii=False))
        for c in g["consultas"]["itens"]:
            if c["id"] in ("CP-23-2026", "AP-5-2026-2"):
                self.assertEqual((c["inicio"], c["fim"], c["situacao"]), ("2026-07-30", "2026-09-14", "encerrada_aguardando"))

    def test_segunda_verificacao_nao_volta(self):
        g = self.g
        cont = g["consultas"]["contagem_por_situacao"]
        # antes da correção: 108 encerradas aguardando e 411 decididas no histórico de 542
        self.assertEqual(g["consultas"]["total_historico"], 542)
        self.assertLessEqual(cont["encerrada_aguardando"], 92)
        self.assertGreaterEqual(cont["decidida"], 427)
        itens = {i["id"]: i for i in g["consultas"]["itens"]}
        for cid in ("CP-6-2026", "CP-3-2026"):
            if cid in itens:
                self.assertEqual(itens[cid]["situacao"], "decidida", cid)
        self.assertIn("CP-1-2026", itens)
        proc = {(i["conjunto"], i["modulo"]): i for i in g["procedimentos"]["itens"]}
        self.assertEqual((proc[("PRORET", "Submódulo 2.1")]["conferencia"], proc[("PRORET", "Submódulo 2.1")]["conferencia_versao"]),
                         ("confirmada_por_ato_integrado", "confere"))
        self.assertEqual((proc[("PRORET", "Submódulo 4.3")]["versao_na_pagina"], proc[("PRORET", "Submódulo 4.3")]["versao_no_ato"],
                          proc[("PRORET", "Submódulo 4.3")]["conferencia_versao"]), ("1.3", "1.1", "diverge"))
        self.assertEqual(proc[("PRORET", "Submódulo 3.1 A")]["ato_na_pagina"], "Resolução Normativa nº 1.114/2025")
        self.assertEqual(proc[("PRORET", "Submódulo 9.3")]["ato_na_pagina"], "Despacho nº 3.606/2025")
        p73 = proc[("PRORET", "Submódulo 7.3")]["atos_posteriores"][0]
        self.assertEqual((p73["ato"], p73["ato_na_fonte"], p73["ato_suspeito"]), (None, "Resolução Normativa nº 3.354/2024", True))
        ev = {e["id"]: e for e in g["linha_do_tempo"]["eventos"]}
        self.assertIn("bandeiras-acionamento-2015-09-vermelha-p1", ev)
        self.assertIn("bandeiras-acionamento-2017-11-vermelha-p2", ev)
        self.assertEqual(ev["bandeiras-acionamento-2015-09-vermelha-p1"]["vigencia_grao"], "mes")
        self.assertEqual((ev["ren-1000-2021"]["data_publicacao"], ev["ren-1000-2021"]["conferencia_publicacao"]["resultado"]),
                         ("2021-12-20", "aprovado"))
        self.assertFalse([e["id"] for e in ev.values() if (e.get("conferencia_publicacao") or {}).get("resultado") == "reprovado"])
        pr = g["regras_limites"]["pratica_dos_atos"]
        self.assertEqual(pr["regra_ipca_aprovadas"], pr["regra_ipca_total"])
        self.assertAlmostEqual(pr["art23_literal_diferenca_min"], -0.6472, delta=0.0001)
        self.assertAlmostEqual(pr["art23_literal_diferenca_max"], -0.2403, delta=0.0001)

    def test_evidencias_dos_tres_limites(self):
        ev = self.g["evidencias"]["limites"]
        self.assertEqual(sorted(ev), ["pld_max_estrutural", "pld_max_horario", "pld_min"])
        for campo, e in ev.items():
            self.assertEqual(e["valor_calculo"], self.g["limites_pld"]["vigente_hoje"][campo])
            self.assertRegex(e["fonte"]["sha256"], r"^[0-9a-f]{64}$")


if __name__ == "__main__":
    unittest.main()
