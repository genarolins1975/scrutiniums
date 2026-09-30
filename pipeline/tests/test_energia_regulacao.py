"""Testes do módulo Regulação (P044 a P046), sem rede, com recortes reais das fontes em
pipeline/tests/dados/energia_regulacao/:

* dsp20253850ti.txt, reh20233304ti.txt: texto extraído (pdftotext) dos atos que fixaram os
  limites do PLD de 2026 e 2024; areh20212994_1_pagina.txt: página do voto com a tabela dos
  valores de 2021 (leiaute preservado);
* atas_amostra.csv: 21 linhas reais do CSV de pautas e atas da Diretoria (dados abertos da
  ANEEL, arquivo gerado em 25/09/2026);
* sidra_1737_novembros.json: resposta real da API SIDRA (IPCA número-índice, novembros);
* prt20257030_anexo_amostra.txt: duas páginas do Anexo I da Portaria nº 7.030/2025;
* govbr_*.html: trechos de conteúdo das páginas oficiais (PRODIST, PRORET, Agenda);
* bandeira-tarifaria-adicional.csv e audiencias-consultas-publicas-aneel.csv: arquivos inteiros;
* lei14203_fragmento.html: fragmento da página da Lei nº 14.203/2021 no portal do Senado.

As reconciliações leem os valores de novo, por expressões escritas aqui (não pelas funções
do módulo), e comparam com números concretos escritos no teste.
"""
import csv
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
    def test_vigencias_dos_adicionais(self):
        vig = ar.vigencias_bandeiras(ar.bandeiras_adicional(ar.le_csv(_ler("bandeira-tarifaria-adicional.csv", "rb"))))
        am = [x for x in vig if x["patamar"] == "Amarela"]
        x21 = next(x for x in am if x["vigencia_inicio"] == "2021-07-01")
        self.assertEqual((x21["ato"], x21["rs_mwh"], x21["vigencia_fim"]), ("REH nº 2.888/2021", 18.74, "2022-06-30"))
        self.assertIsNone(am[-1]["vigencia_fim"])  # último valor: a fonte não informa término
        esc = [x for x in vig if x["patamar"] == "Escassez Hídrica"]
        self.assertEqual([(x["rs_mwh"], x["vigencia_fim"]) for x in esc], [(142.0, None)])


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

    def test_evidencias_dos_tres_limites(self):
        ev = self.g["evidencias"]["limites"]
        self.assertEqual(sorted(ev), ["pld_max_estrutural", "pld_max_horario", "pld_min"])
        for campo, e in ev.items():
            self.assertEqual(e["valor_calculo"], self.g["limites_pld"]["vigente_hoje"][campo])
            self.assertRegex(e["fonte"]["sha256"], r"^[0-9a-f]{64}$")


if __name__ == "__main__":
    unittest.main()
