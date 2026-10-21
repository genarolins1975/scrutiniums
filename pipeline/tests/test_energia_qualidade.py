"""Qualidade do serviço de distribuição (P051 a P054): testes sem rede com amostras reais
recortadas dos arquivos da ANEEL (pipeline/tests/dados/energia_qualidade/, capturados em
30/09/2026).

O que cada grupo confere:
- reconciliação por caminho independente: o DGC que a ANEEL publica no ranking de 2025 é
  reproduzido a partir dos conjuntos com a regra de agregação do módulo (ponderação por
  UCs no mês, soma dos 12 meses, limite ponderado pelas UCs médias); valores brutos e
  somas conferidos contra números lidos do Parquet original por outro código (pyarrow
  compute), escritos aqui como constantes;
- robustez: entidade grande (CEMIG, 265 conjuntos), pequena (cooperativa de um conjunto),
  multiestadual (Energisa Minas Rio, MG e RJ), mudança societária (mesmo CNPJ com nomes
  diferentes no ranking), valor extremo e ausência (mês faltante, NumCon ausente);
- nulo, zero e não se aplica distintos; vigência do limite; unidade (centésimos de hora);
- regras que já falharam de verdade nos dados: códigos antigos de manifestação de 2023 que
  colidem com a tipologia nova (conferidos pela descrição publicada), códigos de evento
  repetidos entre distribuidoras e em mais de uma competência, data de fim no ano 3036,
  cadastro de conjunto escolhido pela captura em vez do mês de referência, regra de
  importação nova que não substituía os valores da regra antiga.
"""
import collections
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

from pipeline.energia import base, entidades, metricas  # noqa: E402
from pipeline.energia.fontes import aneel_qualidade as fq  # noqa: E402
from pipeline.energia.modulos import qualidade as q  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_qualidade")

CEMIG = "06981180000116"
EMR = "19527639000158"          # Energisa Minas Rio: conjuntos em MG e RJ
JAGUARI = "53859112000169"      # CPFL Santa Cruz (razão social Companhia Jaguari de Energia)
COCEL = "75805895000130"
DCELT = "83855973000130"
ALIANCA = "83647990000181"      # Cooperativa Aliança: um único conjunto (IÇARA)

# DGC publicado pela ANEEL no ranking da continuidade de 2025 (página gov.br consultada em
# 30/09/2026, Nota Técnica nº 65/2026-STD/ANEEL): valor com duas casas decimais.
DGC_PUBLICADO_2025 = {CEMIG: 0.91, EMR: 0.70, JAGUARI: 0.54, COCEL: 0.92, DCELT: 1.07, ALIANCA: 1.36}


def _csv_gz(nome):
    with gzip.open(os.path.join(DADOS, nome), "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _lotes(linhas, colunas):
    """Transforma linhas (dicts de texto) em um lote colunar como o Parquet devolve."""
    return [{c: [r.get(c) for r in linhas] for c in colunas}]


def _continuidade():
    linhas = _csv_gz("continuidade_2025_amostra.csv.gz")
    return fq.conjuntos_mes(_lotes(linhas, q.COLS_CONT))


def _limites():
    return fq.le_limites(_csv_gz("limite_amostra.csv.gz"))


class Parser(unittest.TestCase):
    def test_valores_brutos_conferidos_no_parquet(self):
        dados, cadastro, conflitos = _continuidade()
        self.assertEqual(conflitos, 0)
        # lidos do Parquet 2020-2029 por outro código (pyarrow): conjunto 14768 (IÇARA),
        # janeiro de 2025: DEC 0,40 h, DECIP 0,00, DECIND 0,40, FEC 0,44, NumCon 45.161
        s = dados[(ALIANCA, 14768, 2025, 1)]
        self.assertAlmostEqual(s["DEC"], 0.40)
        self.assertAlmostEqual(s["DECIP"], 0.0)   # zero publicado continua zero
        self.assertAlmostEqual(s["FEC"], 0.44)
        self.assertEqual(s["NumCon"], 45161.0)
        self.assertEqual(cadastro[14768]["nome"], "IÇARA")
        self.assertEqual(cadastro[14768]["cnpj"], ALIANCA)
        # conjunto 13109 (DCELT) em janeiro: DEC 0,77 = DECIP 0,07 + DECIND 0,70
        self.assertAlmostEqual(dados[(DCELT, 13109, 2025, 1)]["DEC"], 0.77)

    def test_soma_anual_do_conjunto(self):
        dados, _, _ = _continuidade()
        anual = fq.conjuntos_anual(dados)
        # somas relidas com pyarrow (group_by sum) no Parquet original
        self.assertAlmostEqual(anual[(14768, 2025)]["dec"], 6.35, places=6)
        self.assertAlmostEqual(anual[(13109, 2025)]["dec"], 10.54, places=6)
        self.assertAlmostEqual(anual[(12639, 2025)]["dec"], 5.82, places=6)
        self.assertAlmostEqual(anual[(12640, 2025)]["dec"], 10.24, places=6)
        self.assertEqual(anual[(14768, 2025)]["meses"], 12)

    def test_centesimos_de_hora_nao_sao_minutos(self):
        # 10,54 h (DCELT, 2025) são 10 h e 32,4 min; nenhuma etapa converte centésimos em minutos
        dados, _, _ = _continuidade()
        dec = fq.conjuntos_anual(dados)[(13109, 2025)]["dec"]
        self.assertAlmostEqual(dec * 60, 632.4, places=4)
        self.assertIn("centésimos de hora", q.REGISTRO["arquivos"]["/energia/series/qualidade_distribuidoras_mensal.csv"])


class ReconciliacaoDGC(unittest.TestCase):
    """Caminho independente: o DGC publicado pela ANEEL."""

    def setUp(self):
        self.dados, self.cadastro, _ = _continuidade()
        self.lim, _ = _limites()

    def _dgc(self, c14, ano=2025):
        mensal = fq.agrega_mensal(self.dados, lambda cn, cj: cn)
        m = {"dec": {}, "fec": {}, "ucs": {}, "ucs_total": {}}
        for (g, ref), a in mensal.items():
            if g == c14:
                for k in m:
                    m[k][ref] = a[k]
        an = q.anual_de_mensal(m, ano)
        conj_ano = fq.conjuntos_anual(self.dados)
        lim = fq.limite_agregado({k: v for k, v in conj_ano.items() if k[1] == ano}, self.lim,
                                 lambda cj, cn: cn, ano)[c14]
        return q.dgc(an["dec"], an["fec"], lim["dec"], lim["fec"]), an, lim

    def test_dgc_2025_reproduz_ranking(self):
        # tolerância: o DGC publicado tem duas casas (±0,005) e cada um dos 12 meses de DEC
        # e FEC dos conjuntos é publicado arredondado ao centésimo; 0,006 cobre as duas fontes
        for c14, pub in DGC_PUBLICADO_2025.items():
            calc, an, lim = self._dgc(c14)
            self.assertEqual(an["meses"], 12, c14)
            self.assertAlmostEqual(lim["cob_dec"], 1.0, places=6, msg=c14)
            self.assertLessEqual(abs(calc - pub), 0.006, f"{c14}: calculado {calc:.4f}, publicado {pub}")

    def test_media_simples_nao_reproduz(self):
        # a média simples dos conjuntos (sem pesos) erra o DGC da CEMIG: prova que o peso importa
        conj_ano = fq.conjuntos_anual(self.dados)
        decs = [v["dec"] for (cj, a), v in conj_ano.items() if v["cnpj"] == CEMIG and a == 2025]
        fecs = [v["fec"] for (cj, a), v in conj_ano.items() if v["cnpj"] == CEMIG and a == 2025]
        _, an, lim = self._dgc(CEMIG)
        simples = (sum(decs) / len(decs) / lim["dec"] + sum(fecs) / len(fecs) / lim["fec"]) / 2
        self.assertGreater(abs(simples - DGC_PUBLICADO_2025[CEMIG]), 0.05)
        self.assertEqual(len(decs), 265)  # entidade grande: 265 conjuntos

    def test_dec_cemig_igual_ao_calculo_vetorizado(self):
        # 8,976398... h: calculado no Parquet original com pyarrow (join DEC × NumCon, group_by mês)
        _, an, _ = self._dgc(CEMIG)
        self.assertAlmostEqual(an["dec"], 8.976398059007181, places=9)

    def test_multiestadual(self):
        calc, an, lim = self._dgc(EMR)
        self.assertEqual(an["meses"], 12)
        self.assertLessEqual(abs(calc - 0.70), 0.006)

    def test_vigencia_do_limite(self):
        # o limite de 2024 dos mesmos conjuntos não pode entrar no agregado de 2025
        conj_ano = fq.conjuntos_anual(self.dados)
        so_2024 = {k: v for k, v in self.lim.items() if k[1] == 2024}
        lim25 = fq.limite_agregado({k: v for k, v in conj_ano.items() if k[1] == 2025}, so_2024,
                                   lambda cj, cn: cn, 2025)
        self.assertIsNone(lim25[ALIANCA]["dec"])
        self.assertEqual(lim25[ALIANCA]["cob_dec"], 0.0)
        # e o limite de 2025 do conjunto único da Aliança é o publicado (5,00 h e 4,00 interrupções)
        self.assertEqual(self.lim[(14768, 2025, "DEC")], 5.0)
        self.assertEqual(self.lim[(14768, 2025, "FEC")], 4.0)


class Robustez(unittest.TestCase):
    def setUp(self):
        self.dados, _, _ = _continuidade()

    def test_mes_ausente_nao_fecha_o_ano(self):
        dados = {k: v for k, v in self.dados.items() if not (k[0] == COCEL and k[3] == 7)}
        mensal = fq.agrega_mensal(dados, lambda cn, cj: cn)
        m = {"dec": {}, "fec": {}, "ucs": {}, "ucs_total": {}}
        for (g, ref), a in mensal.items():
            if g == COCEL:
                for k in m:
                    m[k][ref] = a[k]
        an = q.anual_de_mensal(m, 2025)
        self.assertEqual(an["meses"], 11)
        self.assertIsNone(an["dec"])      # nunca soma de 11 meses rotulada como ano
        self.assertNotIn("2025-07", m["dec"])

    def test_numcon_ausente_fica_fora_do_numerador_e_denominador(self):
        dados = dict(self.dados)
        k = (COCEL, 12640, 2025, 1)
        dados[k] = {x: y for x, y in dados[k].items() if x != "NumCon"}
        a = fq.agrega_mensal(dados, lambda cn, cj: cn)[(COCEL, "2025-01")]
        so = dados[(COCEL, 12639, 2025, 1)]
        self.assertAlmostEqual(a["dec"], so["DEC"])   # só o outro conjunto
        self.assertEqual(a["ucs"], so["NumCon"])
        self.assertEqual(a["nconj"], 1)

    def test_valor_extremo_preservado(self):
        # RURAL BENJAMIN CONSTANT (11216, CEAM), 2007: o maior DEC anual de conjunto da série,
        # 1.482,00 h, soma dos 12 meses relida no Parquet de 2000-2009 por outro código. O
        # valor é publicado como está (nada é aparado) e vira ressalva na validação, não descarte.
        dados, cad, _ = fq.conjuntos_mes(_lotes(_csv_gz("continuidade_2007_ceam_11216.csv.gz"), q.COLS_CONT))
        an = fq.conjuntos_anual(dados)[(11216, 2007)]
        self.assertEqual(an["meses"], 12)
        self.assertEqual(fq.centesimos(an["dec"]), 148200)
        self.assertEqual(cad[11216]["nome"], "RURAL BENJAMIN CONSTANT")
        val = {x["nome"]: x for x in q.validar_dados(
            br_m={"dec": {}, "fec": {}}, conj_ano={(11216, 2007): {"dec": round(an["dec"], 2), "fec": an["fec"], "meses": 12}},
            limites={}, dist={}, comp_anual={}, iasc={}, ultimo_mes="2026-06", hoje=date(2026, 9, 30))}
        item = val["DEC anual de conjunto acima de 200 h (extremo raro)"]
        self.assertEqual(item["resultado"], "ressalva")
        self.assertIn("1.482,00 h", item["detalhe"])

    def test_identidade_apurado_2025(self):
        ident = fq.identidade_apurado(self.dados)[2025]
        self.assertGreater(ident["dec_n"], 0)
        self.assertEqual(ident["dec_ok"], ident["dec_n"])
        self.assertEqual(ident["fec_ok"], ident["fec_n"])

    def test_parcelas_somam_o_total(self):
        parc = fq.agrega_parcelas_anual(self.dados, lambda cn, cj: cn)[(COCEL, 2025)]
        grupos = q.grupos_parcelas(parc, "DEC")
        soma = sum(v for v in grupos.values() if v is not None)
        self.assertAlmostEqual(soma, parc["DECTOT"], places=6)
        # apurado (IP + IND) agregado = DEC agregado (identidade vale em cada conjunto-mês)
        mensal = fq.agrega_mensal(self.dados, lambda cn, cj: cn)
        dec = sum(a["dec"] for (g, ref), a in mensal.items() if g == COCEL)
        self.assertAlmostEqual(grupos["apurado"], dec, delta=0.01 * 12)

    def test_nome_novo_no_ranking_fica_sem_vinculo(self):
        # vínculo só por CNPJ publicado ou tabela explícita: nome desconhecido não é aproximado
        self.assertEqual(entidades.cnpj(2341467000120), "02341467000120")
        self.assertIsNone(fq.le_ranking_continuidade(
            '<div id="parent-fieldname-text"><table><tr><td>1º</td><td>0,50</td><td>X</td><td>EMPRESA NOVA S.A.</td><td>SU</td></tr></table>',
            2025)[0]["cnpj"])

    def test_mes_completo(self):
        # UCs com DEC no Brasil, captura de 30/09/2026: junho de 2026 completo; julho com
        # 90.388.616 UCs contra 94.280.510 em junho (95,9%) ainda é parcial
        self.assertTrue(q.mes_completo(94280510, 94280510))
        self.assertFalse(q.mes_completo(90388616, 94280510))
        self.assertFalse(q.mes_completo(None, 94280510))
        # ano com mês faltante nos meses válidos não fecha
        m = {"dec": {f"2025-{i:02d}": 1.0 for i in range(1, 13)}, "fec": {f"2025-{i:02d}": 0.5 for i in range(1, 13)},
             "ucs": {}, "ucs_total": {}}
        self.assertEqual(q.anual_de_mensal(m, 2025)["dec"], 12.0)
        self.assertIsNone(q.anual_de_mensal(m, 2025, validos={f"2025-{i:02d}" for i in range(1, 12)})["dec"])


class Ranking(unittest.TestCase):
    def test_parser_das_paginas(self):
        with open(os.path.join(DADOS, "ranking_2025_trecho.html"), encoding="utf-8") as f:
            linhas = fq.le_ranking_continuidade(f.read(), 2025)
        primeira = linhas[0]
        self.assertEqual((primeira["posicao"], primeira["dgc"], primeira["cnpj"], primeira["porte"]),
                         (1, 0.54, JAGUARI, "grande"))
        self.assertEqual({x["porte"] for x in linhas}, {"grande", "pequeno"})
        self.assertTrue(all(x["cnpj"] for x in linhas))
        with open(os.path.join(DADOS, "ranking_2021_trecho.html"), encoding="utf-8") as f:
            l21 = fq.le_ranking_continuidade(f.read(), 2021)
        forcel = [x for x in l21 if x["sigla"].startswith("FORCEL")][0]
        self.assertIsNone(forcel["dgc"])          # "-" = fora do ranking, não zero
        self.assertEqual(forcel["dgc_texto"], "-")


class Compensacoes(unittest.TestCase):
    def setUp(self):
        linhas = _csv_gz("compensacao_2025_amostra.csv.gz")
        self.por_mes, self.por_tensao, self.nao = fq.agrega_compensacoes(_lotes(linhas, q.COLS_COMP))

    def _total(self, c14, medida):
        return sum(v for (cn, m, u, t, ref), v in self.por_mes.items() if cn == c14 and m == medida)

    def test_somas_relidas_por_outro_codigo(self):
        # somas de todos os PG* e QT* de 2025 no Parquet original (pyarrow compute)
        self.assertAlmostEqual(self._total(COCEL, "valor"), 148286.82, places=2)
        self.assertAlmostEqual(self._total(COCEL, "quantidade"), 7883.0, places=6)
        self.assertAlmostEqual(self._total(DCELT, "valor"), 333160.92, places=2)
        self.assertAlmostEqual(self._total(ALIANCA, "quantidade"), 9640.0, places=6)
        self.assertEqual(self.nao, {})

    def test_tipos_e_competencia(self):
        dicri = sum(v for (cn, m, u, t, ref), v in self.por_mes.items() if cn == COCEL and m == "valor" and t == "dicri")
        self.assertAlmostEqual(dicri, 23199.10, places=2)
        # janeiro, compensação mensal de UCs: soma das tensões e dos dois conjuntos
        jan = self.por_mes[(COCEL, "valor", "uc", "mensal", "2025-01")]
        self.assertAlmostEqual(jan, 210.53 + 7657.29 + 11417.46 + 13313.65 + 341.23 + 1171.77, places=2)
        self.assertEqual(fq.classifica_compensacao("PGUCATT"), ("valor", "uc", "AT", "trimestral"))
        self.assertEqual(fq.classifica_compensacao("QTUGMTNUDS"), ("quantidade", "ug", "MTNU", "dise"))
        self.assertIsNone(fq.classifica_compensacao("PGUCTRP"))  # tensão em regime permanente: outro tema
        self.assertEqual(fq.ref_compensacao("trimestral", 2021, 4), "2021-T4")
        self.assertEqual(fq.ref_compensacao("anual", 2021, 1), "2021")

    def test_zero_publicado_continua_zero(self):
        # a Aliança tem DICRI publicado com valor zero: a chave existe com 0, não some
        zeros = [v for (cn, m, u, t, ref), v in self.por_mes.items() if cn == ALIANCA and t == "dicri" and m == "valor"]
        self.assertTrue(zeros)
        self.assertEqual(sum(zeros), 0.0)


class AtendimentoESatisfacao(unittest.TestCase):
    def test_iasc_e_amostra(self):
        with open(os.path.join(DADOS, "iasc_amostra.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        reg = {c14: v for ano, c14, v in fq.le_iasc(linhas)}
        mux = reg["97578090000134"]
        self.assertAlmostEqual(mux["iasc"], 79.569109489, places=6)
        self.assertEqual(mux["amostra"], 242)       # 80 + 162 entrevistados
        self.assertEqual(mux["ordem"], 1)
        self.assertAlmostEqual(reg[CEMIG]["iasc"], 61.964977471, places=6)
        self.assertEqual(reg[CEMIG]["amostra"], 575)

    def test_reclamacoes_da_distribuidora(self):
        linhas = _csv_gz("manifestacoes_2025_cocel.csv.gz")
        agg = fq.agrega_manifestacoes(_lotes(linhas, q.COLS_MANIF))
        tot = lambda k: sum(a.get(k, 0) for (c14, ref), a in agg.items() if c14 == COCEL)
        # somas por código de tipologia feitas em laço separado sobre as mesmas linhas
        self.assertEqual(tot("n1.recl"), 29531)
        self.assertEqual(tot("n2.recl"), 92)
        self.assertEqual(tot("n1.recl_interrupcao") + tot("n2.recl_interrupcao"), 28599)
        # normalização: sem UCs não há taxa
        self.assertIsNone(q.por_mil(29531, None))
        self.assertAlmostEqual(q.por_mil(1000, 50000), 20.0)

    def test_ouvidoria_aneel(self):
        with gzip.open(os.path.join(DADOS, "ouvidoria_2023_cocel.csv.gz"), "rt", encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        agg = fq.agrega_ouvidoria(linhas)
        soma = lambda k: sum(a.get(k, 0) for a in agg.values())
        self.assertEqual(soma("recl"), 56)
        self.assertEqual(soma("recl_proc"), 24)
        self.assertEqual(soma("total"), 490)
        self.assertEqual(soma("recl"), soma("recl_proc") + soma("recl_improc") + soma("recl_sem_decisao"))

    def test_tmae_ponderado(self):
        with open(os.path.join(DADOS, "atendimento_2025_cocel.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        mensal, anual = fq.agrega_atendimento(_lotes(linhas, q.COLS_ATEND))
        m = mensal[(COCEL, "2025-01")]
        # dois conjuntos: (47,96+19,58+15,30)×246 e (69,25+25,95+23,50)×455 ÷ 701
        self.assertAlmostEqual(m["tmae_num"] / m["ocorr_tempos"], 106.11574893009985, places=9)
        self.assertEqual(m["ocorr"], 701)
        self.assertLessEqual(m["nie"], m["ocorr"])
        self.assertGreater(anual[(COCEL, 2025)]["conj_com_dia_critico"], 0)

    def test_eventos(self):
        with open(os.path.join(DADOS, "eventos_emergencia_amostra.csv"), encoding="utf-8") as f:
            evs = fq.le_eventos_emergencia(csv.DictReader(f, delimiter=";"))
        go = [e for e in evs if e["codigo"] == "ISE 01 01.2026 EQTL GO/CHI"][0]
        self.assertEqual(go["cnpj"], "01543032000104")
        self.assertAlmostEqual(go["chi_limite"], 512480.8)
        self.assertAlmostEqual(go["chi_evento"], 1264949.576)
        rs = [e for e in evs if e["codigo"] == "ISE 01 01.2026 EQTL RS/CHI"][0]
        self.assertIsNone(rs["chi_limite"])      # vazio na fonte: ausência, não zero


class Mapa(unittest.TestCase):
    def test_relacao_conjunto_municipio(self):
        with open(os.path.join(DADOS, "indqual_municipio_amostra.csv"), encoding="latin-1") as f:
            pares = fq.le_conjunto_municipio(csv.DictReader(f, delimiter=";"))
        mun = {}
        conj = {}
        for cj, cod, nome, uf in pares:
            mun.setdefault(cod, set()).add(cj)
            conj.setdefault(cj, set()).add(cod)
        # Campo Largo (PR) é atendido pelos dois conjuntos da COCEL: vários conjuntos
        self.assertEqual(mun["4104204"], {12639, 12640})
        self.assertEqual(q.classe_relacao(mun["4104204"], conj), "varios_conjuntos")
        # o conjunto IÇARA (14768) cobre quatro municípios: o valor dele não é municipal
        self.assertEqual(len(conj[14768]), 4)
        so_icara = [c for c, cs in mun.items() if cs == {14768}]
        self.assertTrue(so_icara)
        self.assertEqual(q.classe_relacao({14768}, conj), "conjunto_compartilhado")
        self.assertEqual(q.classe_relacao({99}, {99: {"1"}}), "conjunto_exclusivo")
        # Curitiba: dezenas de conjuntos
        self.assertGreater(len(mun["4106902"]), 50)


class Catalogo(unittest.TestCase):
    def test_metricas_validas(self):
        ms = [m for m in metricas.todas() if m["id"].startswith("qualidade_")]
        self.assertGreaterEqual(len(ms), 10)
        for m in ms:
            self.assertEqual(metricas.validar(m), [])

    def test_registro(self):
        reg = q.REGISTRO
        self.assertEqual((reg["id"], reg["gold"], reg["familia"], reg["ordem"]), ("qualidade", "qualidade.json", "aneel_qualidade", 41))
        for d in reg["datasets"]:
            self.assertTrue(d["url"].startswith("https://"))
            for u in d["downloads"]:
                self.assertIn(u, reg["arquivos"])


class Silver(unittest.TestCase):
    """Importação para o silver com arquivos do bronze fabricados a partir das amostras."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.multiple(base, BRONZE=os.path.join(self.tmp.name, "bronze"),
                                     SILVER=os.path.join(self.tmp.name, "silver"))
        self.p.start()
        self.con = base.conecta(":memory:")

    def tearDown(self):
        self.con.close()
        self.p.stop()
        self.tmp.cleanup()

    def test_importacao_limites_e_revisao(self):
        with gzip.open(os.path.join(DADOS, "limite_amostra.csv.gz"), "rb") as f:
            corpo = f.read()
        arq, sha = base.salva_bronze("aneel", q.DS_CONT, "limite", corpo, "csv", "2026-09-30T12:00:00Z")
        vid, _ = base.registra_vintage(self.con, q.DS_CONT, "limite", "u", "2026-09-30T12:00:00Z", None, sha, len(corpo), "teste", arq)
        det = q.importa_limites(self.con, {"vintage_id": vid, "arquivo": arq})
        self.assertGreater(det["observacoes_novas"], 0)
        obs = q.vigentes(self.con, q.DS_CONT, "c14768.")
        self.assertEqual(obs[("c14768.lim.dec", "2025")], 5.0)
        # revisão da fonte: nova captura com limite diferente vira revisão, não sobrescrita
        texto = corpo.decode("utf-8").replace('"14768";"IÇARA";"DEC";"2025";"5,00"', '"14768";"IÇARA";"DEC";"2025";"5,50"')
        if texto == corpo.decode("utf-8"):
            self.skipTest("linha do limite de 2025 do conjunto 14768 em outro formato")
        corpo2 = texto.encode("utf-8")
        arq2, sha2 = base.salva_bronze("aneel", q.DS_CONT, "limite", corpo2, "csv", "2026-10-30T12:00:00Z")
        vid2, _ = base.registra_vintage(self.con, q.DS_CONT, "limite", "u", "2026-10-30T12:00:00Z", None, sha2, len(corpo2), "teste", arq2)
        det2 = q.importa_limites(self.con, {"vintage_id": vid2, "arquivo": arq2})
        self.assertEqual(det2["revisoes"], 1)
        self.assertEqual(q.vigentes(self.con, q.DS_CONT, "c14768.")[("c14768.lim.dec", "2025")], 5.5)


class Manifestacoes2023(unittest.TestCase):
    """O arquivo de 2023 usa os códigos antigos; alguns coincidem com a tipologia nova."""

    def setUp(self):
        linhas = _csv_gz("manifestacoes_2023_cocel.csv.gz")
        self.linhas = linhas
        self.agg = fq.agrega_manifestacoes(_lotes(linhas, q.COLS_MANIF))

    def _tot(self, k):
        return sum(a.get(k, 0) for (c14, ref), a in self.agg.items() if c14 == COCEL)

    def test_interrupcao_pelo_rca_igual_a_soma_pela_descricao(self):
        # caminho independente: soma pela descrição publicada (DscManifestacao), sem código
        # nem tabela; o Parquet de 2023 da COCEL tem 34.535 (nível 1) e 48 (nível 2)
        descricoes = {"Interrupção no Fornecimento - Falta de energia", "Interrupção Frequente do Fornecimento",
                      "Interrupção Programada"}
        por_desc = {"Nível 1": 0, "Nível 2": 0}
        for r in self.linhas:
            if r["DscManifestacao"] in descricoes:
                por_desc[r["NomCanalManifestacao"]] += int(r["QtdManifestacoesRecebidas"])
        self.assertEqual(por_desc, {"Nível 1": 34535, "Nível 2": 48})
        self.assertEqual(self._tot("n1.recl_interrupcao"), 34535)
        self.assertEqual(self._tot("n2.recl_interrupcao"), 48)

    def test_codigo_antigo_nao_e_lido_como_tipologia_nova(self):
        # em 2023 o código 101 é "Cobrança decorrente de religação à revelia" (IdeTipoRCA 105),
        # uma reclamação (1020705); lido como código novo viraria "informação"
        self.assertEqual(fq.codigo_tipologia("101", "105", 2023), "1020705")
        self.assertEqual(fq.codigo_tipologia("101", "105", 2024), "101")
        # o classificador ingênuo por prefixo não acharia nenhuma reclamação no nível 1
        ingenuo = sum(int(r["QtdManifestacoesRecebidas"]) for r in self.linhas
                      if r["NomCanalManifestacao"] == "Nível 1" and r["CodTipoManifestacao"][:3] == "102")
        self.assertEqual(ingenuo, 0)
        self.assertEqual(self._tot("n1.recl"), 37058)
        self.assertEqual(self._tot("n1.total"), 350146)   # nada some: total = soma de todas as linhas
        self.assertEqual(self._tot("n1.sem_grupo"), 0)

    def test_rca_desconhecido_vai_para_sem_grupo(self):
        self.assertIsNone(fq.codigo_tipologia("1", "14", 2023))   # "Reclamação de Interrupção", sem par na tabela
        lote = [{"NumCPFCNPJ": [COCEL], "NomCanalManifestacao": ["Nível 1"], "CodTipoManifestacao": ["1"],
                 "IdeTipoRCA": ["14"], "QtdManifestacoesRecebidas": ["7"], "QtdManifestacoesProcedentes": ["0"],
                 "AnoCompetencia": ["2023"], "MesCompetencia": ["5"]}]
        a = fq.agrega_manifestacoes(lote)[(COCEL, "2023-05")]
        self.assertEqual(a["n1.sem_grupo"], 7)
        self.assertNotIn("n1.recl", a)


class Continuidade2000(unittest.TestCase):
    """Arquivo de 2000 a 2009: DEC e FEC por conjunto, outra desagregação de parcelas."""

    def setUp(self):
        linhas = _csv_gz("continuidade_2009_cocel.csv.gz")
        self.dados, self.cadastro, self.conflitos = fq.conjuntos_mes(_lotes(linhas, q.COLS_CONT))

    def test_dec_anual_2009(self):
        # 13,93 h: soma dos 12 DEC mensais do conjunto 12306 relida com pyarrow (group_by) no
        # Parquet de 2000-2009; com um só conjunto, o ponderado da distribuidora é o mesmo
        anual = fq.conjuntos_anual(self.dados)
        self.assertAlmostEqual(anual[(12306, 2009)]["dec"], 13.93, places=6)
        self.assertEqual(anual[(12306, 2009)]["meses"], 12)
        mensal = fq.agrega_mensal(self.dados, lambda cn, cj: cn)
        self.assertAlmostEqual(sum(a["dec"] for (g, r), a in mensal.items() if g == COCEL), 13.93, places=6)

    def test_parcelas_antigas_e_linha_sem_conjunto_ficam_fora(self):
        siglas = {sg for s_ in self.dados.values() for sg in s_}
        self.assertFalse(siglas & {"DECi", "DECx", "FECi", "FECx", "NumConsAgt"})
        self.assertEqual({k[1] for k in self.dados}, {12306})     # NumConsAgt não tem conjunto
        parc = fq.agrega_parcelas_anual(self.dados, lambda cn, cj: cn)
        grupos = q.grupos_parcelas(parc.get((COCEL, 2009), {}), "DEC")
        self.assertTrue(all(v is None for v in grupos.values()))  # ausência, não zero
        self.assertEqual(self.conflitos, 0)


class Eventos(unittest.TestCase):
    def test_colisao_de_codigo_e_competencias(self):
        with open(os.path.join(DADOS, "eventos_emergencia_colisoes.csv"), encoding="utf-8") as f:
            corpo = f.read().encode("utf-8")
        with tempfile.TemporaryDirectory() as tmp, mock.patch.multiple(base, BRONZE=os.path.join(tmp, "b")):
            con = base.conecta(":memory:")
            arq, sha = base.salva_bronze("aneel", q.DS_EVENTO, "eventos-2026", corpo, "csv", "2026-09-30T12:00:00Z")
            vid, _ = base.registra_vintage(con, q.DS_EVENTO, "eventos-2026", "u", "2026-09-30T12:00:00Z", None, sha,
                                           len(corpo), "teste", arq)
            det = q.importa_eventos(con, {"vintage_id": vid, "arquivo": arq})
            regs = base.registros_como_estavam_em(con, q.DS_EVENTO)
            con.close()
        # 8 linhas: "ISE 01.2026" da EDP ES e da EDP SP são eventos diferentes; a linha repetida
        # idêntica da EDP ES conta uma vez; a EPB aparece em março e em abril com CHI parcial
        self.assertEqual((det["linhas"], det["registros_competencia"], det["eventos"]), (8, 6, 5))
        self.assertEqual((det["linhas_duplicadas"], det["conflitos"]), (1, 1))
        self.assertIn("evento:28152650000171:2026-01:ISE 01.2026", regs)
        self.assertIn("evento:02302100000106:2026-02:ISE 01.2026", regs)
        epb = [k for k in regs if ":EPB_ISE_04_2026" in k]
        self.assertEqual(sorted(k.split(":")[2] for k in epb), ["2026-03", "2026-04"])

    def test_data_implausivel_nao_vira_duracao(self):
        # como publicado pela ANEEL (arquivo gerado em 12/08/2026): fim no ano 3036
        dur, motivo = fq.duracao_evento_h("2026-03-07 00:00:00", "3036-03-13 23:00:00", "2026-08-12")
        self.assertIsNone(dur)
        self.assertIn("3036", motivo)
        dur, motivo = fq.duracao_evento_h("2026-03-29 00:02:00", "2026-04-08 23:37:00", "2026-08-12")
        self.assertAlmostEqual(dur, 263.5833333, places=5)
        self.assertIsNone(motivo)
        self.assertEqual(fq.duracao_evento_h("2026-02-02 00:00:00", "2026-02-01 00:00:00", None)[1], "fim anterior ao início")


class RegrasDeLeitura(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = mock.patch.multiple(base, BRONZE=os.path.join(self.tmp.name, "b"))
        self.p.start()
        self.con = base.conecta(":memory:")

    def tearDown(self):
        self.con.close()
        self.p.stop()
        self.tmp.cleanup()

    def _vintage(self, recurso, capturado, sha):
        vid, _ = base.registra_vintage(self.con, q.DS_CONT, recurso, "u", capturado, None, sha, 1, "teste", None)
        return vid

    def test_cadastro_pelo_mes_mais_recente_e_nao_pela_captura(self):
        # o arquivo de 2000-2009 capturado DEPOIS não pode trocar o nome atual do conjunto
        v_novo = self._vintage("cont-2020-2029", "2026-09-30T10:00:00Z", "a" * 64)
        v_antigo = self._vintage("cont-2000-2009", "2026-09-30T11:00:00Z", "b" * 64)
        base.grava_registros(self.con, q.DS_CONT, v_novo, [
            ("conj:12306", "cad.cont-2020-2029", json.dumps({"cnpj": COCEL, "sigla": "COCEL", "nome": "NOME ATUAL", "ref": "2026-08"})),
            ("dist:" + COCEL, "sigla.cont-2020-2029", json.dumps({"sigla": "COCEL", "ref": "2026-08"}))])
        base.grava_registros(self.con, q.DS_CONT, v_antigo, [
            ("conj:12306", "cad.cont-2000-2009", json.dumps({"cnpj": COCEL, "sigla": "COCEL ANTIGA", "nome": "Cocel", "ref": "2009-12"})),
            ("dist:" + COCEL, "sigla.cont-2000-2009", json.dumps({"sigla": "COCEL ANTIGA", "ref": "2009-12"}))])
        cad, siglas = q._cadastro(self.con)
        self.assertEqual(cad[12306]["nome"], "NOME ATUAL")
        self.assertEqual(siglas[COCEL], "COCEL")

    def test_regra_nova_substitui_valores_da_regra_antiga(self):
        vid = self._vintage("limite", "2026-09-30T10:00:00Z", "c" * 64)
        vint = {"vintage_id": vid, "arquivo": None}
        st = {"importacoes": {}, "falhas": []}

        def regra_antiga(con, v):
            base.grava_observacoes(con, q.DS_CONT, v["vintage_id"], [("c1.lim.dec", "2025", 5.0)])
            return {}

        def regra_nova(con, v):
            base.grava_observacoes(con, q.DS_CONT, v["vintage_id"], [("c1.lim.dec", "2025", 5.5)])
            return {}
        with mock.patch.dict(q.VERSOES, {"limites": "1"}):
            q.importa_vintage(self.con, st, q.DS_CONT, "limite", vint, "limites", regra_antiga)
        with mock.patch.dict(q.VERSOES, {"limites": "2"}):
            q.importa_vintage(self.con, st, q.DS_CONT, "limite", vint, "limites", regra_nova)
            q.importa_vintage(self.con, st, q.DS_CONT, "limite", vint, "limites", regra_antiga)  # já importado: nada
        self.assertEqual(q.vigentes(self.con, q.DS_CONT, "c1.")[("c1.lim.dec", "2025")], 5.5)
        # e a troca de regra não aparece como revisão da fonte (uma linha só para a chave)
        n = self.con.execute("SELECT COUNT(*) FROM observacoes WHERE serie='c1.lim.dec'").fetchone()[0]
        self.assertEqual(n, 1)
        self.assertEqual(st["falhas"], [])


class Validacao(unittest.TestCase):
    def _v(self, **kw):
        args = dict(br_m={"dec": {"2025-01": 0.8}, "fec": {"2025-01": 0.4}},
                    conj_ano={(1, 2025): {"dec": 10.0, "fec": 5.0, "meses": 12}},
                    limites={(1, 2025, "DEC"): 12.0}, dist={COCEL: {}}, comp_anual={2025: {"valor": 10.0}},
                    iasc={"d" + COCEL: {"iasc": {"2025": 70.0}}}, ultimo_mes="2025-12", hoje=date(2026, 9, 30))
        args.update(kw)
        return {x["nome"]: x for x in q.validar_dados(**args)}

    def test_limites_fisicos_derrubam_a_publicacao(self):
        ok = self._v()
        self.assertTrue(all(x["resultado"] == "aprovado" for x in ok.values()))
        r = self._v(br_m={"dec": {"2025-01": -0.1}, "fec": {}})
        self.assertEqual(r["DEC e FEC nacionais mensais não negativos"]["resultado"], "reprovado")
        # DEC mensal de 800 h é fisicamente impossível (um mês tem no máximo 744 h)
        r = self._v(br_m={"dec": {"2025-01": 800.0}, "fec": {}})
        item = r["DEC nacional mensal abaixo de 744 h (horas de um mês)"]
        self.assertEqual((item["resultado"], item["critico"]), ("reprovado", True))
        r = self._v(ultimo_mes="2026-10")
        self.assertEqual(r["Último mês completo não posterior ao mês corrente"]["resultado"], "reprovado")
        r = self._v(dist={"123": {}})
        self.assertEqual(r["Chave de distribuidora é CNPJ de 14 dígitos"]["resultado"], "reprovado")

    def test_extremo_raro_e_ressalva_e_nao_descarte(self):
        # 1.482 h: conjunto RURAL BENJAMIN CONSTANT (CEAM) em 2007, valor publicado
        r = self._v(conj_ano={(11216, 2007): {"dec": 1482.0, "fec": 90.0, "meses": 12}})
        item = r["DEC anual de conjunto acima de 200 h (extremo raro)"]
        self.assertEqual((item["resultado"], item["critico"]), ("ressalva", False))
        self.assertIn("11216", item["detalhe"])


class LimiteEmCentesimos(unittest.TestCase):
    """Defeito real: a soma em ponto flutuante dos 12 meses do conjunto 12836 (CRUZALTINA,
    Energisa MS) em 2025 dá 8,000000000000002 contra o limite 8,00 e o conjunto contava como
    acima do limite (811 conjuntos em vez de 810)."""

    def setUp(self):
        dados, _, _ = fq.conjuntos_mes(_lotes(_csv_gz("continuidade_2025_cruzaltina.csv.gz"), q.COLS_CONT))
        self.an = fq.conjuntos_anual(dados)[(12836, 2025)]
        with open(os.path.join(DADOS, "limite_2025_cruzaltina.csv"), encoding="utf-8") as f:
            self.lim, _ = fq.le_limites(csv.DictReader(f, delimiter=";"))

    def test_dec_igual_ao_limite_nao_e_transgressao(self):
        self.assertEqual(self.an["meses"], 12)
        self.assertEqual(self.lim[(12836, 2025, "DEC")], 8.0)
        self.assertEqual(fq.centesimos(self.an["dec"]), 800)   # 8,00 h em centésimos exatos
        # a soma em ponto flutuante depende da ordem dos meses: no silver (ordem de leitura do
        # Parquet inteiro) ficou 8,000000000000002, e a comparação direta contava transgressão
        no_silver = 8.000000000000002
        self.assertTrue(no_silver > 8.0)
        self.assertIs(fq.acima_do_limite(no_silver, self.lim[(12836, 2025, "DEC")]), False)
        self.assertIs(fq.acima_do_limite(self.an["dec"], self.lim[(12836, 2025, "DEC")]), False)
        self.assertIs(fq.acima_do_limite(8.01, 8.0), True)
        self.assertIsNone(fq.acima_do_limite(None, 8.0))      # sem valor não é "dentro"
        self.assertEqual(q.razao(round(self.an["dec"], 2), 8.0), 1.0)


class ControleNumCon(unittest.TestCase):
    """Defeito real: em março de 2026 a CELESC publicou NumCon = 1 nos 121 conjuntos."""

    def setUp(self):
        dados, _, _ = fq.conjuntos_mes(_lotes(_csv_gz("continuidade_2026_celesc.csv.gz"), q.COLS_CONT))
        self.dados = dados
        self.mensal = {}
        for (g, ref), a in fq.agrega_mensal(dados, lambda cn, cj: cn).items():
            for k, v in a.items():
                self.mensal.setdefault(k, {})[ref] = v
        self.celesc = "08336783000190"

    def test_marca_marco_de_2026(self):
        self.assertEqual(self.mensal["nconj_total"]["2026-03"], 121)
        self.assertEqual(self.mensal["ucs_total"]["2026-03"], 121.0)
        susp = fq.controle_numcon(self.mensal["ucs_total"], self.mensal["nconj_total"])
        self.assertEqual(list(susp), ["2026-03"])
        self.assertIn("121 conjuntos", susp["2026-03"])
        # sem o controle o DEC de março seria a média simples dos conjuntos com cobertura 1,0
        self.assertEqual(self.mensal["ucs"]["2026-03"] / self.mensal["ucs_total"]["2026-03"], 1.0)
        limpo = q.aplica_controle_numcon(self.mensal, susp)
        self.assertNotIn("2026-03", limpo["dec"])            # mais de um conjunto: o peso não vale
        self.assertNotIn("2026-03", limpo["ucs_total"])
        self.assertIn("2026-02", limpo["dec"])
        br = q.agrega_de_distribuidoras({self.celesc: limpo})
        self.assertNotIn("2026-03", br["dec"])               # fora do Brasil no mês
        self.assertEqual(br["ucs"]["2026-02"], self.mensal["ucs"]["2026-02"])

    def test_mudanca_de_patamar_nao_e_marcada(self):
        # queda que continua no mês seguinte (cisão, perda de área) não é o mês isolado
        n = {f"2026-0{m}": 10 for m in range(1, 6)}
        self.assertEqual(fq.controle_numcon({"2026-01": 990.0, "2026-02": 1000.0, "2026-03": 400.0, "2026-04": 410.0,
                                             "2026-05": 405.0}, n), {})
        self.assertEqual(list(fq.controle_numcon({"2026-01": 990.0, "2026-02": 1000.0, "2026-03": 400.0, "2026-04": 990.0,
                                                  "2026-05": 995.0}, n)), ["2026-03"])
        # na ponta, o mês fora do nível dos dois vizinhos do mesmo lado (envio parcial no último mês)
        self.assertEqual(list(fq.controle_numcon({"2026-03": 1000.0, "2026-04": 990.0, "2026-05": 300.0}, n)), ["2026-05"])

    def test_um_conjunto_mantem_o_dec(self):
        # com um conjunto o DEC da distribuidora é o do conjunto e não depende do peso
        m = {"dec": {"2015-12": 1.5}, "fec": {"2015-12": 0.7}, "ucs": {"2015-12": 1174.0}, "ucs_fec": {"2015-12": 1174.0},
             "ucs_total": {"2015-12": 1174.0}, "nconj_total": {"2015-12": 1}}
        limpo = q.aplica_controle_numcon(m, {"2015-12": "queda"})
        self.assertEqual(limpo["dec"]["2015-12"], 1.5)
        self.assertNotIn("2015-12", limpo["ucs_total"])


class CoberturaFec(unittest.TestCase):
    """Defeito real: em jun/2025 a ANEEL não publicou a linha FEC dos conjuntos da ELEKTRO (só FECIP e FECIND);
    o FEC mensal da distribuidora vinha de 22.562 de 3.036.447 UCs (0,74%) e entrava no anual (3,25 contra 3,38
    refeito pelas parcelas). Dois meses de 27.073 distribuidoras-mês ficam abaixo de 99% (esse e CEA nov/2007, 98,1%)."""

    def setUp(self):
        meses = [f"2025-{m:02d}" for m in range(1, 13)]
        self.mensal = {
            "dec": {r: 0.5 for r in meses},
            "fec": {r: 0.25 for r in meses},
            "ucs": {r: 3036447.0 for r in meses},
            "ucs_fec": {r: 3036447.0 for r in meses},
            "ucs_total": {r: 3036447.0 for r in meses},
            "nconj_total": {r: 130 for r in meses},
        }
        self.mensal["fec"]["2025-06"] = 0.1231
        self.mensal["ucs_fec"]["2025-06"] = 22562.0

    def test_marca_so_o_mes_de_cobertura_baixa(self):
        baixa = fq.controle_cobertura_fec(self.mensal["ucs_fec"], self.mensal["ucs_total"])
        self.assertEqual(list(baixa), ["2025-06"])
        self.assertIn("0,74%", baixa["2025-06"])
        self.assertIn("22562 de 3036447", baixa["2025-06"])

    def test_cobertura_de_98_por_cento_nao_e_marcada(self):
        # CEA, nov/2007: 98,06% das UCs; o mínimo de 95% marca só o caso extremo
        self.assertEqual(fq.controle_cobertura_fec({"2007-11": 980.6}, {"2007-11": 1000.0}), {})
        self.assertEqual(list(fq.controle_cobertura_fec({"2007-11": 940.0}, {"2007-11": 1000.0})), ["2007-11"])

    def test_ausencia_nao_vira_cobertura_baixa(self):
        # sem UCs do mês ou sem denominador do FEC o controle não opina (ausência não é cobertura zero)
        self.assertEqual(fq.controle_cobertura_fec({}, {"2025-01": 1000.0}), {})
        self.assertEqual(fq.controle_cobertura_fec({"2025-01": 0.0}, {"2025-01": 0.0}), {})

    def test_mes_marcado_sai_do_fec_anual_e_mantem_o_dec(self):
        baixa = fq.controle_cobertura_fec(self.mensal["ucs_fec"], self.mensal["ucs_total"])
        limpo = q.aplica_controle_fec(self.mensal, baixa)
        self.assertNotIn("2025-06", limpo["fec"])
        self.assertNotIn("2025-06", limpo["ucs_fec"])
        self.assertIn("2025-06", limpo["dec"])
        self.assertEqual(limpo["ucs"]["2025-06"], 3036447.0)
        self.assertIn("2025-06", self.mensal["fec"])             # a entrada não é alterada
        sem = q.anual_de_mensal(self.mensal, 2025)
        com = q.anual_de_mensal(limpo, 2025)
        self.assertAlmostEqual(sem["fec"], 0.25 * 11 + 0.1231)   # antes: anual com o mês parcial somado como completo
        self.assertIsNone(com["fec"])                            # depois: sem soma parcial rotulada como ano
        self.assertAlmostEqual(com["dec"], 6.0)                  # o DEC não depende do controle do FEC
        self.assertEqual(com["meses"], 12)

    def test_mes_marcado_fica_fora_do_fec_do_brasil(self):
        baixa = fq.controle_cobertura_fec(self.mensal["ucs_fec"], self.mensal["ucs_total"])
        outra = {k: {r: v for r, v in d.items()} for k, d in self.mensal.items()}
        outra["fec"]["2025-06"] = 0.5
        outra["ucs_fec"]["2025-06"] = 3036447.0                    # a outra distribuidora tem cobertura plena em junho
        br = q.agrega_de_distribuidoras({"elektro": q.aplica_controle_fec(self.mensal, baixa), "outra": outra})
        self.assertAlmostEqual(br["fec"]["2025-06"], 0.5)        # só a outra distribuidora pesa no FEC de junho
        self.assertAlmostEqual(br["dec"]["2025-06"], 0.5)        # o DEC de junho continua com as duas
        self.assertEqual(br["ucs"]["2025-06"], 2 * 3036447.0)
        self.assertEqual(br["ucs_fec"]["2025-06"], 3036447.0)

    def test_controle_aparece_nos_controles_da_gold(self):
        def controles(baixa):
            return q.controles_adicionais(
                identidade=[0.0], ucs_iguais=True, numcon_suspeito={}, sigla=lambda c14: "ELEKTRO", nie_maior={}, sem_grupo={},
                parcelas={}, correspondencia={"cadastro_ibge": 0}, ico_acima_100=[], quebras=[], fec_baixa=baixa)
        nome = "Cobertura do FEC por distribuidora e mês"
        com = next(x for x in controles({("02302100000106", "2025-06"): "FEC publicado para 0,74% das UCs do mês (22562 de 3036447)"})
                   if x["nome"].startswith(nome))
        sem = next(x for x in controles({}) if x["nome"].startswith(nome))
        self.assertEqual(com["resultado"], "ressalva")
        self.assertIn("ELEKTRO 2025-06", com["detalhe"])
        self.assertEqual(sem["resultado"], "aprovado")


class IdentidadeBrasil(unittest.TestCase):
    def test_agregado_das_distribuidoras_igual_ao_dos_conjuntos(self):
        # caminho 1: agregação direta dos conjuntos (a da importação); caminho 2: a partir do
        # DEC de cada distribuidora e dos seus denominadores; seis distribuidoras reais de 2025
        dados, _, _ = _continuidade()
        direto = fq.agrega_mensal(dados, lambda cn, cj: "br")
        por_dist = collections.defaultdict(lambda: collections.defaultdict(dict))
        for (g, ref), a in fq.agrega_mensal(dados, lambda cn, cj: cn).items():
            for k, v in a.items():
                por_dist[g][k][ref] = v
        br = q.agrega_de_distribuidoras(por_dist)
        self.assertEqual(len(br["dec"]), 12)
        for ref, a in ((r, a) for (g, r), a in direto.items()):
            self.assertAlmostEqual(br["dec"][ref], a["dec"], places=12)
            self.assertAlmostEqual(br["fec"][ref], a["fec"], places=12)
            self.assertEqual(br["ucs"][ref], a["ucs"])


class ParcialSemMesIncompleto(unittest.TestCase):
    def test_marco_de_2026_fica_fora_dos_dois_anos(self):
        # DEC e FEC nacionais mensais publicados em qualidade_brasil.csv (captura de 30/09/2026);
        # março de 2026 incompleto (CELESC fora por NumCon implausível)
        dec = {"2025-01": 0.9047, "2025-02": 0.8312, "2025-03": 0.827, "2025-04": 0.802, "2025-05": 0.7326, "2025-06": 0.7127,
               "2026-01": 0.8851, "2026-02": 0.776, "2026-03": 0.8078, "2026-04": 0.7129, "2026-05": 0.6956, "2026-06": 0.6616}
        fec = {k: 0.4 for k in dec}
        completos = {k: k != "2026-03" for k in dec}
        p = q.parcial_comparavel({"dec": dec, "fec": fec}, completos, 2026, 6, {"2026-03": "NumCon implausível de CELESC"})
        self.assertEqual(p["meses_incluidos"], ["2026-01", "2026-02", "2026-04", "2026-05", "2026-06"])
        self.assertEqual(p["meses_excluidos"], [{"m": "2026-03", "motivo": "NumCon implausível de CELESC"}])
        self.assertAlmostEqual(p["dec"], 0.8851 + 0.776 + 0.7129 + 0.6956 + 0.6616, places=9)
        self.assertAlmostEqual(p["dec_anterior"], 0.9047 + 0.8312 + 0.802 + 0.7326 + 0.7127, places=9)
        # antes da correção o acumulado somava os seis meses, com março incompleto
        self.assertNotAlmostEqual(p["dec"], sum(dec[f"2026-0{m}"] for m in range(1, 7)), places=3)


class Perimetro(unittest.TestCase):
    """Energisa Minas Rio (19.527.639/0001-58) absorveu a Energisa Nova Friburgo
    (33.249.046/0001-06) em 2023: 39 conjuntos e 463.925 UCs em 2022, 44 e 583.567 em 2023."""

    def setUp(self):
        dados, _, _ = fq.conjuntos_mes(_lotes(_csv_gz("continuidade_2022_2023_emr_enf.csv.gz"), q.COLS_CONT))
        self.por = {}
        for (cj, a), v in fq.conjuntos_anual(dados).items():
            cs, u = self.por.get((v["cnpj"], a), (set(), 0.0))
            cs.add(cj)
            self.por[(v["cnpj"], a)] = (cs, u + (v["ucs_media"] or 0))
        with open(os.path.join(DADOS, "indqual_municipio_emr_enf.csv"), encoding="utf-8") as f:
            self.conj_mun = collections.defaultdict(set)
            for cj, cod, _, _ in fq.le_conjunto_municipio(csv.DictReader(f, delimiter=";")):
                self.conj_mun[cj].add(cod)

    def test_incorporacao_detectada(self):
        self.assertEqual(len(self.por[(EMR, 2022)][0]), 39)
        self.assertEqual(len(self.por[(EMR, 2023)][0]), 44)
        self.assertEqual(round(self.por[(EMR, 2022)][1]), 463925)
        self.assertNotIn(("33249046000106", 2023), self.por)   # a ENF deixa de publicar
        qs = fq.quebras_perimetro(self.por, self.conj_mun)
        self.assertEqual([(x["cnpj"], x["ano"]) for x in qs], [(EMR, 2023)])
        self.assertEqual([(o["cnpj"], o["papel"]) for o in qs[0]["outras"]], [("33249046000106", "origem")])
        self.assertAlmostEqual(qs[0]["variacao_ucs_pct"], 25.8, delta=0.05)

    def test_sem_perda_da_vizinha_nao_e_quebra(self):
        # controle negativo: a mesma variação de UCs sem outra distribuidora perdendo área
        por = dict(self.por)
        por[("33249046000106", 2023)] = por[("33249046000106", 2022)]
        self.assertEqual(fq.quebras_perimetro(por, self.conj_mun), [])
        # e crescimento abaixo de 10% não é examinado
        por = {k: v for k, v in self.por.items() if k[0] == EMR}
        por[(EMR, 2023)] = (por[(EMR, 2023)][0], por[(EMR, 2022)][1] * 1.05)
        self.assertEqual(fq.quebras_perimetro(por, self.conj_mun), [])


class AtendimentoTelefonico(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(DADOS, "atendimento_telefonico_amostra.csv"), encoding="utf-8") as f:
            self.regs, self.conflitos = fq.le_atendimento_telefonico(csv.DictReader(f, delimiter=";"))

    def test_fracao_vira_percentual_e_padrao(self):
        self.assertEqual(self.conflitos, 0)
        cemig = [v for (c14, ref), v in self.regs.items() if c14 == CEMIG]
        self.assertEqual(len(cemig), 12)
        for v in cemig:
            self.assertTrue(0 <= v["ins"] <= 100)
            # identidade publicada: ICO = ocupadas ÷ oferecidas
            if v["oferecidas"]:
                self.assertAlmostEqual(v["ico"], 100 * v["ocupadas"] / v["oferecidas"], places=9)
        self.assertIs(fq.cumpre_padrao_telefonico("ins", 85.0), True)
        self.assertIs(fq.cumpre_padrao_telefonico("ins", 84.99), False)
        self.assertIs(fq.cumpre_padrao_telefonico("iab", 4.0), True)
        self.assertIsNone(fq.cumpre_padrao_telefonico("ico", None))

    def test_ico_acima_de_100_publicado_como_esta(self):
        # Certel Energia, nov/2016: a fonte publica ICO de 233,9% (mais ocupadas que oferecidas)
        v = self.regs[("09257558000121", "2016-11")]
        self.assertAlmostEqual(v["ico"], 233.9486156, places=6)
        self.assertGreater(v["ocupadas"], v["oferecidas"])


class Divulgacao(unittest.TestCase):
    def test_numeros_lidos_do_texto_da_aneel(self):
        with open(os.path.join(DADOS, "divulgacao_2025_trecho.html"), encoding="utf-8") as f:
            d25 = fq.le_divulgacao_continuidade(f.read())
        with open(os.path.join(DADOS, "divulgacao_2024_trecho.html"), encoding="utf-8") as f:
            d24 = fq.le_divulgacao_continuidade(f.read())
        self.assertEqual((d25[2025]["dec"], d25[2025]["fec"]), (9.30, 4.66))
        self.assertEqual((d25[2024]["dec"], d25[2024]["fec"]), (10.24, 4.89))
        self.assertEqual((d24[2023]["dec"], d24[2023]["fec"]), (10.42, 5.15))
        self.assertAlmostEqual(d25[2025]["compensacao_rs"], 1.002e9)
        self.assertAlmostEqual(d25[2024]["compensacao_rs"], 1.122e9)
        self.assertAlmostEqual(d24[2023]["compensacao_rs"], 1.080e9)
        self.assertAlmostEqual(d25[2025]["compensacoes_qtd"], 21.6e6)
        self.assertAlmostEqual(d24[2023]["compensacoes_qtd"], 22.3e6)
        # a divulgação de 2025 e a de 2024 dizem o mesmo de 2024
        for k in ("dec", "fec", "compensacao_rs", "compensacoes_qtd"):
            self.assertEqual(d25[2024][k], d24[2024][k])
        self.assertEqual(fq.le_divulgacao_continuidade("<p>texto sem os números</p>"), {})


class SiglaEAtendimentoEmergencial(unittest.TestCase):
    def test_nao_informado_nao_e_sigla(self):
        self.assertIsNone(fq.sigla_valida("Não Informado"))
        self.assertIsNone(fq.sigla_valida("  "))
        self.assertEqual(fq.sigla_valida(" Creral "), "Creral")

    def test_nie_maior_que_ocorrencias_e_contado(self):
        lote = [{"NumCNPJ": [COCEL] * 4, "IdeConjUndConsumidoras": [12639, 12639, 12640, 12640],
                 "SigIndicador": ["NumOcorr", "Nie", "NumOcorr", "Nie"], "AnoIndice": [2025] * 4,
                 "NumPeriodoIndice": [3] * 4, "VlrIndiceEnviado": [10.0, 12.0, 8.0, 5.0]}]
        mensal, _ = fq.agrega_atendimento(lote)
        m = mensal[(COCEL, "2025-03")]
        self.assertEqual((m["conj_ocorr"], m["conj_nie_maior"]), (2, 1))
        self.assertEqual((m["ocorr"], m["nie"]), (18, 17))


class CadastroIbge(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(DADOS, "ibge_municipios_amostra.json"), "rb") as f:
            self.corpo = f.read()
        self.dados = {m["id"]: m for m in json.loads(self.corpo.decode("utf-8"))}

    def test_uf_do_municipio_sem_microrregiao(self):
        # Boa Esperança do Norte (MT, 5101837), instalado em 2025, vem da API do IBGE com
        # microrregiao null: a UF sai da região imediata
        self.assertIsNone(self.dados[5101837]["microrregiao"])
        self.assertEqual(q.uf_ibge(self.dados[5101837]), "MT")
        self.assertEqual(q.uf_ibge(self.dados[4314548]), "RS")    # Pinto Bandeira
        self.assertEqual(q.uf_ibge(self.dados[4220000]), "SC")    # Balneário Rincão

    def test_resposta_incompleta_nao_vira_cadastro(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.multiple(base, BRONZE=os.path.join(tmp, "b")):
            con = base.conecta(":memory:")
            arq, sha = base.salva_bronze("ibge", q.DS_IBGE, "municipios", self.corpo, "json", "2026-09-30T12:00:00Z")
            vid, _ = base.registra_vintage(con, q.DS_IBGE, "municipios", "u", "2026-09-30T12:00:00Z", None, sha,
                                           len(self.corpo), "teste", arq)
            with self.assertRaises(ValueError):          # 5 municípios não são o cadastro de 5.571
                q.importa_ibge(con, {"vintage_id": vid, "arquivo": arq})
            con.close()


class GoldPublicada(unittest.TestCase):
    """Gold e CSVs publicados conferidos com valores concretos obtidos por caminho
    independente (recontagem do verificador no Parquet e no CSV, números divulgados pela
    ANEEL). Roda contra public/energia/ depois de executar_modulo.py qualidade."""

    RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    @classmethod
    def setUpClass(cls):
        caminho = os.path.join(cls.RAIZ, "public", "energia", "gold", "qualidade.json")
        if not os.path.exists(caminho):
            raise unittest.SkipTest("gold ainda não gerada")
        with open(caminho, encoding="utf-8") as f:
            cls.gold = json.load(f)
        if not cls.gold.get("disponivel"):
            raise unittest.SkipTest("gold indisponível")
        cls.tamanho = os.path.getsize(caminho)

    def _csv(self, nome):
        with open(os.path.join(self.RAIZ, "public", "energia", "series", nome), encoding="utf-8") as f:
            return list(csv.DictReader(f, delimiter=";"))

    def test_tamanho_e_evidencias_validas(self):
        from pipeline.energia import evidencia
        self.assertLessEqual(self.tamanho, 400 * 1024)
        for nome, e in self.gold["evidencias"].items():
            self.assertEqual(evidencia.validar(e), [], nome)
        # nenhum teste de evidência sai "aprovado" sem conferir: o detalhe traz a conta feita
        t = {x["nome"][:30]: x for x in self.gold["evidencias"]["conjuntos_acima_limite"]["testes"]}
        self.assertIn("810 acima na recontagem × 810 na gold", t["Recontagem em centésimos intei"]["detalhe"])

    def test_conjuntos_acima_do_limite_2025(self):
        # 810 de 3.146 (25,7%): recontagem no Parquet 2020-2029 e no CSV publicado; o conjunto
        # 12836 (DEC 8,00 = limite 8,00) não conta
        c = self.gold["conjuntos"]
        self.assertEqual(c["ano"], 2025)
        self.assertEqual((c["acima_limite_dec"], c["com_limite"], c["pct_acima_limite_dec"]), (810, 3146, 25.7))
        self.assertEqual(c["acima_algum_limite"], 881)
        self.assertEqual(c["ucs_acima_limite_dec"], 21287048.0)
        h = {x["de"]: x["conjuntos"] for x in c["histograma_razao_dec"]}
        self.assertEqual((h[0.75], h[1.0]), (1140, 418))
        hist = {x["ano"]: x["acima_limite_dec"] for x in c["historico"]}
        esperado = {2005: 1472, 2007: 1139, 2013: 1563, 2016: 1670, 2017: 1623, 2018: 1334, 2019: 1396, 2020: 1252, 2025: 810}
        self.assertEqual({a: hist[a] for a in esperado}, esperado)
        self.assertNotIn("12836", self.gold["evidencias"]["conjuntos_acima_limite"]["chaves_origem"])

    def test_brasil_concessionarias_igual_ao_divulgado_pela_aneel(self):
        # números da notícia anual da ANEEL (DEC 2025 9h18 = 9,30 h; 2024 10,24; 2023 10,42; FEC
        # 4,66, 4,89, 5,15); tolerância 0,005, a precisão divulgada
        oficial = {2023: (10.42, 5.15), 2024: (10.24, 4.89), 2025: (9.30, 4.66)}
        anual = {x["ano"]: x for x in self.gold["brasil"]["anual"]}
        for a, (dec, fec) in oficial.items():
            self.assertEqual(anual[a]["sem_classificacao"], 0)
            self.assertAlmostEqual(anual[a]["dec_concessionarias"], dec, delta=0.005, msg=a)
            self.assertAlmostEqual(anual[a]["fec_concessionarias"], fec, delta=0.005, msg=a)
        # com as permissionárias o número é outro: a diferença é de universo
        self.assertEqual((anual[2025]["dec"], anual[2025]["fec"]), (9.33, 4.69))
        self.assertEqual(self.gold["evidencias"]["dec_brasil"]["reconciliacao"]["resultado"], "aprovado")

    def test_concessionarias_refeitas_pelos_csv(self):
        # caminho independente: só os CSV publicados (DEC e UCs por distribuidora e mês, e a
        # classificação de cada CNPJ), agregados aqui sem as funções do módulo
        classif = {r["cnpj"]: r["classificacao"] for r in self._csv("qualidade_distribuidoras_anual.csv")}
        acc = collections.defaultdict(lambda: [0.0, 0.0])
        for r in self._csv("qualidade_distribuidoras_mensal.csv"):
            if r["mes"][:4] in ("2023", "2024", "2025") and r["dec_h"] and r["ucs"] and classif.get(r["cnpj"]) == "Concessionária":
                acc[r["mes"]][0] += float(r["dec_h"]) * float(r["ucs"])
                acc[r["mes"]][1] += float(r["ucs"])
        for a, dec in ((2023, 10.42), (2024, 10.24), (2025, 9.30)):
            soma = sum(n / d for m, (n, d) in acc.items() if m[:4] == str(a))
            # o CSV arredonda o DEC mensal a 4 casas: 0,006 cobre 0,005 da divulgação e esse resto
            self.assertAlmostEqual(soma, dec, delta=0.006, msg=a)

    def test_compensacoes_uc_e_ug_separadas(self):
        anual = {x["ano"]: x for x in self.gold["compensacoes"]["anual"]}
        # 2024: só PGUC* e QTUC* no Parquet 2020-2029 = R$ 1.121.865.123 e 27.309.506, o total que
        # a ANEEL divulga (R$ 1,122 bi e 27,3 milhões); a UG (R$ 12.977.475,79) fica à parte
        self.assertAlmostEqual(anual[2024]["valor_uc"], 1121865123.53, places=1)
        self.assertEqual(anual[2024]["quantidade_uc"], 27309506)
        self.assertAlmostEqual(anual[2024]["valor_ug"], 12977475.79, places=1)
        self.assertAlmostEqual(anual[2024]["valor"], anual[2024]["valor_uc"] + anual[2024]["valor_ug"], places=1)
        self.assertTrue(anual[2024]["divulgado_aneel"]["dentro_da_precisao_valor"])
        # 2025: R$ 1.007.210.666,63 de UC contra R$ 1,002 bi divulgado: diferença não explicada, ressalva
        self.assertAlmostEqual(anual[2025]["valor_uc"], 1007210666.63, places=1)
        self.assertFalse(anual[2025]["divulgado_aneel"]["dentro_da_precisao_valor"])
        self.assertEqual(self.gold["evidencias"]["compensacoes_ano"]["reconciliacao"]["resultado"], "ressalva")

    def test_parcial_sem_marco_de_2026(self):
        p = self.gold["parcial"]
        self.assertNotIn("2026-03", p["meses_incluidos"])
        self.assertEqual([x["m"] for x in p["meses_excluidos"]], ["2026-03"])

    def test_reclamacoes_2026_ausentes_e_nao_zero(self):
        r26 = [x for x in self.gold["atendimento"]["reclamacoes_distribuidora"] if x["ano"] == 2026][0]
        self.assertEqual((r26["total"], r26["ucs"], r26["cobertura_ucs"], r26["interrupcao"], r26["n2"]), (None,) * 5)
        self.assertIn("ano parcial", r26["motivo_ausencia"])
        tmae = {x["ano"]: x for x in self.gold["atendimento"]["tmae"]}
        self.assertFalse(tmae[2026]["completo"])
        self.assertTrue(tmae[2025]["completo"])

    def test_celesc_marco_2026_no_csv(self):
        linha = [r for r in self._csv("qualidade_distribuidoras_mensal.csv")
                 if r["cnpj"] == "08336783000190" and r["mes"] == "2026-03"][0]
        self.assertEqual((linha["dec_h"], linha["ucs_total"]), ("", ""))
        self.assertIn("121 conjuntos", linha["controle_numcon"])

    def test_creral_sem_marcador_como_sigla(self):
        d = {x["cnpj"]: x for x in self.gold["distribuidoras"]}
        self.assertEqual(d["89435598000155"]["sigla"], "Creral")
        self.assertFalse(any(r["sigla"] == "Não Informado" for r in self._csv("qualidade_compensacoes.csv")))

    def test_mapa_conferido_com_o_ibge(self):
        cs = self.gold["mapa"]["correspondencia"]
        self.assertEqual(sorted(x["codigo"] for x in cs["codigos_sem_ibge"]),
                         ["1509999", "1729999", "2319999", "3169922", "3559999", "4314530"])
        self.assertEqual(sorted(x["codigo"] for x in cs["ibge_sem_relacao"]), ["4220000", "4314548", "5101837"])
        with open(os.path.join(self.RAIZ, "public", "energia", "series", "qualidade_mapa.json"), encoding="utf-8") as f:
            mapa = json.load(f)
        linhas = {x[0]: x for x in mapa["linhas"]}
        self.assertNotIn("4314530", linhas)
        self.assertEqual(mapa["relacoes"][linhas["4314548"][1]], "sem_relacao_na_fonte")

    def test_natureza_e_textos_da_proveniencia(self):
        prov = self.gold["proveniencia"]
        self.assertEqual(prov["eventos"]["natureza"], "CALCULADO")
        self.assertTrue(prov["eventos"]["formula"])
        self.assertFalse(any("explicam" in x for x in prov["ranking"]["limitacoes"]))
        self.assertTrue(any("hipóteses não verificadas" in x for x in prov["ranking"]["limitacoes"]))

    def test_quebra_de_perimetro_na_gold(self):
        d = {x["cnpj"]: x for x in self.gold["distribuidoras"]}
        q_ = d[EMR]["quebras_perimetro"]
        self.assertEqual([(x["ano"], [o["cnpj"] for o in x["outras"]]) for x in q_], [(2023, ["33249046000106"])])


if __name__ == "__main__":
    unittest.main()
