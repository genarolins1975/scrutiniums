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
- nulo, zero e não se aplica distintos; vigência do limite; unidade (centésimos de hora).
"""
import csv
import gzip
import io
import os
import sys
import tempfile
import unittest
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
        # o maior DEC mensal da amostra não é aparado nem tratado como erro
        maior = max(s["DEC"] for s in self.dados.values() if "DEC" in s)
        mensal = fq.conjuntos_anual(self.dados)
        self.assertTrue(any(v["dec"] and v["dec"] >= maior for v in mensal.values()))

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

    def test_mudanca_societaria_mesmo_cnpj(self):
        # Amazonas Energia (ranking) e Âmbar Amazonas (sigla atual) são o mesmo CNPJ; CEEE e
        # Equatorial CEEE também. Vínculo só por CNPJ publicado ou tabela explícita.
        self.assertEqual(fq.CNPJ_RANKING["AMAZONAS ENERGIA S.A."], "02341467000120")
        self.assertEqual(fq.CNPJ_RANKING["COMPANHIA ESTADUAL DE DISTRIBUIÇÃO DE ENERGIA ELÉTRICA - CEEE-D"],
                         fq.CNPJ_RANKING["COMPANHIA ESTADUAL DE DISTRIBUICAO DE ENERGIA ELETRICA - CEEE-D"])
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


if __name__ == "__main__":
    unittest.main()
