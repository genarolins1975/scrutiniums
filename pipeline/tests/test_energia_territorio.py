"""Território (P002, mapa geográfico transversal): testes sem rede com amostras reais
recortadas (pipeline/tests/dados/energia_territorio/, capturadas em 30/09 e 01/10/2026).

O que cada grupo confere:
- critério de aceite do P002 (nenhum indicador abaixo do grão de origem), na gold e no
  índice municipal publicados: colunas municipais só com grão de município ou referência,
  cada indicador do catálogo presente na tabela publicada do seu grão (e ausente das
  colunas municipais), nenhum valor de distribuidora copiado para município, município
  fora do SIN sem submercado (o "não se aplica" não vira valor);
- reconciliação por caminho independente, com os valores esperados escritos aqui: carga
  das áreas do ONS relida das respostas da API (médias e resíduos com statistics);
  MMGD por município contra o Parquet original da ANEEL; usinas e registros de até 10 kW
  por município contra o CSV original do SIGA; relação município × distribuidora
  refeita a partir do IndQual Município, dos limites de continuidade de 2026 e do Parquet
  de MMGD (scripts à parte, sem código do pipeline, em 01/10/2026); camada 24 da EPE;
- consistência interna (rotulada como tal, não é reconciliação): soma municipal de usinas
  igual à refeita a partir do arquivo de usinas publicado;
- robustez: entidade grande (CEMIG-D), pequena (COCEL), multiestadual (ESS, dois
  submercados), distribuidora com a maior parte da área fora do SIN (Âmbar Amazonas),
  mudança societária (ENF absorvida; código 4314530 da RGE fora da malha), valor extremo
  (Portel, 5.708 registros de 1 a 3 kW; São Paulo, 222 usinas), sistema isolado (Tefé e
  Jordão fora do SIN; Itaituba com localidade isolada) e ausência (Porto Rico do Maranhão
  sem vínculo, Luz para Todos nulo, tarifa sem vigência);
- nulo, zero e não se aplica distintos; troca e movimento de áreas de carga detectados,
  inclusive as trocas que passariam pelas médias do dia; nome sem igualdade exata fica
  sem vínculo (nada de semelhança).
"""
import copy
import csv
import gzip
import json
import os
import sys
import unittest
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, geo, metricas  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import epe_territorio as et  # noqa: E402
from pipeline.energia.fontes import ibge_territorio as it  # noqa: E402
from pipeline.energia.fontes import ons_territorio as ot  # noqa: E402
from pipeline.energia.modulos import territorio as t  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_territorio")
GOLD = os.path.join(base.GOLD, "territorio.json")
MUN = os.path.join(base.SERIES, "territorio_municipios.json")
USI = os.path.join(base.SERIES, "territorio_usinas.json")

# Mapeamento UF → subsistema publicado pelos módulos Água e Carga (a hipótese conferida)
UF_SM = {"SP": "SE", "RJ": "SE", "ES": "SE", "MG": "SE", "GO": "SE", "DF": "SE", "MT": "SE", "MS": "SE", "AC": "SE",
         "RO": "SE", "PR": "S", "SC": "S", "RS": "S", "BA": "NE", "SE": "NE", "AL": "NE", "PE": "NE", "PB": "NE",
         "RN": "NE", "CE": "NE", "PI": "NE", "PA": "N", "MA": "N", "AM": "N", "AP": "N", "RR": "N", "TO": "N"}


def _ons():
    with gzip.open(os.path.join(DADOS, "ons_areas_meias_horas.json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)["dias"]


def _malha():
    with open(os.path.join(DADOS, "malha_amostra.json"), encoding="utf-8") as f:
        return json.load(f)


def _siga():
    with open(os.path.join(DADOS, "siga_amostra.csv"), encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _gold():
    if not os.path.exists(GOLD):
        return None
    with open(GOLD, encoding="utf-8") as f:
        g = json.load(f)
    return g if g.get("disponivel") else None


def _json(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- áreas de carga do ONS

class AreasDeCarga(unittest.TestCase):
    def setUp(self):
        self.dias = _ons()
        self.hip, self.conflitos = ot.areas_por_submercado(UF_SM)

    def test_resposta_real_da_api(self):
        with gzip.open(os.path.join(DADOS, "ons_area_AC_2026-09-16.json.gz"), "rt", encoding="utf-8") as f:
            texto = f.read()
        media, n = ot.media_do_dia(texto)
        # statistics.fmean das 48 meias horas da resposta original (outro código)
        self.assertEqual(n, 48)
        self.assertAlmostEqual(media, 219.33461, places=4)
        serie = ot.serie_do_dia(texto)
        self.assertEqual(len(serie), 48)
        self.assertTrue(all(k.endswith("Z") for k in serie))

    def test_nulo_nao_vira_zero(self):
        dados = [{"din_referenciautc": "2026-09-16T03:30:00.000Z", "val_cargaglobal": 100.0},
                 {"din_referenciautc": "2026-09-16T04:00:00.000Z", "val_cargaglobal": None},
                 {"din_referenciautc": "2026-09-16T04:30:00.000Z", "val_cargaglobal": 0}]
        media, n = ot.media_do_dia(json.dumps(dados))
        self.assertEqual(n, 2)                 # o nulo fica fora, o zero publicado conta
        self.assertAlmostEqual(media, 50.0)
        self.assertEqual(ot.media_do_dia(json.dumps([{"val_cargaglobal": None}])), (None, 0))

    def test_dicionario_tem_34_areas_e_hipotese_sem_conflito(self):
        self.assertEqual(len(ot.TODAS_AS_AREAS), 34)
        self.assertEqual(self.conflitos, [])
        self.assertIn("TOCO", self.hip["N"])            # TO no Norte pela hipótese publicada
        self.assertEqual(sorted(self.hip["NE"]), ["ALPE", "BAOE", "BASE", "CE", "PBRN", "PI"])

    def _series(self, dia):
        return self.dias[dia]

    def test_fechamento_dos_dois_dias(self):
        # medianas do resíduo absoluto por meia hora calculadas à parte com statistics.median
        esperado = {"2026-09-16": {"SE": 0.32, "S": 0.57, "NE": 7.87, "N": 1.42},
                    "2026-09-13": {"SE": 0.19, "S": 0.36, "NE": 7.71, "N": 0.33}}
        for dia, med in esperado.items():
            cf = ot.confere_fechamento(self._series(dia), self.hip)
            self.assertTrue(cf["completo"] and cf["fecha"], dia)
            for sm, v in med.items():
                self.assertAlmostEqual(cf["submercados"][sm]["mediana_abs_mwmed"], v, delta=0.006, msg=f"{dia} {sm}")
                self.assertEqual(cf["submercados"][sm]["meias_horas"], 48)
            self.assertEqual([a for a, x in cf["areas"].items() if x["veredito"] != "provada"], ["TOCO"])

    def test_residuo_das_medias_do_dia(self):
        # soma das médias diárias das áreas − média do submercado (statistics.fmean à parte)
        cf = ot.confere_fechamento(self._series("2026-09-16"), self.hip)
        for sm, v in {"SE": -0.209, "S": 0.008, "NE": 7.838, "N": -0.851}.items():
            self.assertAlmostEqual(cf["submercados"][sm]["residuo_mwmed"], v, delta=0.002)

    def test_mediana_resiste_a_meia_hora_em_consistencia(self):
        # 13/09: uma meia hora do Sudeste com 160,7 MWmed de resíduo; a mediana fica em 0,19
        cf = ot.confere_fechamento(self._series("2026-09-13"), self.hip)
        self.assertGreater(cf["submercados"]["SE"]["max_abs_mwmed"], 150)
        self.assertLess(cf["submercados"]["SE"]["mediana_abs_mwmed"], 1)

    def test_area_movida_reprova(self):
        h = copy.deepcopy(self.hip)
        h["SE"].remove("MS")
        h["S"].append("MS")
        cf = ot.confere_fechamento(self._series("2026-09-16"), h)
        self.assertFalse(cf["fecha"])
        self.assertEqual(cf["areas"]["MS"]["veredito"], "reprovada")
        uf = ot.uf_para_submercado([cf], h)
        self.assertEqual(uf["MS"]["estado"], "nao_provado")
        self.assertIsNone(uf["MS"]["subsistema"])

    def test_troca_de_areas_de_carga_parecida_e_detectada(self):
        # Acre (SE) e Roraima (N): a menor alternativa por meia hora (28,8 e 38,7 MWmed) e
        # reprovada também pelas médias do dia (37,4 e 37,8 MWmed no pior submercado;
        # statistics.fmean e statistics.median à parte)
        for dia, sinal, medias in (("2026-09-13", 28.8, 37.419), ("2026-09-16", 38.7, 37.766)):
            cf = ot.confere_fechamento(self._series(dia), self.hip)
            self.assertEqual(cf["menor_alternativa"]["descricao"], "troca AC e RR")
            self.assertAlmostEqual(cf["menor_alternativa"]["mediana_abs_mwmed"], sinal, delta=0.06)
            self.assertAlmostEqual(cf["menor_alternativa"]["residuo_medias_dia_mwmed"], medias, delta=0.002)
            self.assertGreater(cf["menor_alternativa"]["mediana_abs_mwmed"], ot.TOLERANCIA_MWMED)
            h = copy.deepcopy(self.hip)
            h["SE"].remove("AC"), h["N"].remove("RR"), h["SE"].append("RR"), h["N"].append("AC")
            self.assertFalse(ot.confere_fechamento(self._series(dia), h)["fecha"])

    def test_media_do_dia_deixaria_passar_troca_que_a_meia_hora_reprova(self):
        # 16/09: Rondônia (753,66 MWmed) e Tocantins Norte (745,94) trocadas deixam −7,94 no
        # SE e 6,88 no N pelas médias do dia; Rio Grande do Sul e Bahia/Sergipe, 10,95 no NE
        # (statistics.fmean à parte). Por meia hora, a mediana passa de 200 MWmed.
        cf = ot.confere_fechamento(self._series("2026-09-16"), self.hip)
        alt = {x["descricao"]: x for x in cf["alternativas"]}
        self.assertAlmostEqual(alt["troca RO e TON"]["residuo_medias_dia_mwmed"], 7.936, delta=0.002)
        self.assertAlmostEqual(alt["troca RS e BASE"]["residuo_medias_dia_mwmed"], 10.949, delta=0.002)
        for d in ("troca RO e TON", "troca RS e BASE"):
            self.assertLess(alt[d]["residuo_medias_dia_mwmed"], ot.TOLERANCIA_MWMED)   # passaria pela média
            self.assertGreater(alt[d]["mediana_abs_mwmed"], 200)                       # a prova reprova
        self.assertEqual(cf["menor_alternativa_pelas_medias"]["descricao"], "troca RO e TON")
        self.assertEqual({a for a, x in cf["areas"].items() if x["veredito"] == "ambigua"}, set())
        self.assertEqual(cf["alternativas_avaliadas"], 297)

    def test_mediana_resiste_onde_a_media_do_dia_desloca(self):
        # 13/09, Sudeste: resíduo das médias do dia −3,26 MWmed contra mediana por meia hora 0,19
        cf = ot.confere_fechamento(self._series("2026-09-13"), self.hip)
        self.assertAlmostEqual(cf["submercados"]["SE"]["residuo_mwmed"], -3.26, delta=0.006)
        self.assertAlmostEqual(cf["submercados"]["SE"]["mediana_abs_mwmed"], 0.19, delta=0.006)

    def test_alternativa_que_tambem_fecha_deixa_areas_ambiguas(self):
        cf = ot.confere_fechamento(self._series("2026-09-13"), self.hip, tolerancia=40.0)
        self.assertEqual(cf["areas"]["AC"]["veredito"], "ambigua")
        self.assertEqual(cf["areas"]["RR"]["veredito"], "ambigua")
        self.assertEqual(cf["areas"]["SP"]["veredito"], "provada")
        uf = ot.uf_para_submercado([cf], self.hip)
        self.assertEqual(uf["AC"]["estado"], "nao_provado")

    def test_tocantins_e_ufs_com_area_conjunta(self):
        confs = [ot.confere_fechamento(self._series(d), self.hip) for d in ("2026-09-16", "2026-09-13")]
        uf = ot.uf_para_submercado(confs, self.hip)
        self.assertEqual((uf["TO"]["subsistema"], uf["TO"]["estado"]), ("N", "provado_com_area_sem_carga"))
        self.assertEqual({a["codigo"]: a["veredito"] for a in uf["TO"]["areas"]}, {"TON": "provada", "TOCO": "indeterminada"})
        self.assertEqual((uf["BA"]["subsistema"], uf["BA"]["estado"]), ("NE", "provado"))   # BASE e BAOE
        self.assertEqual((uf["RN"]["subsistema"], uf["PB"]["subsistema"]), ("NE", "NE"))    # PBRN
        self.assertEqual({u: x["subsistema"] for u, x in uf.items()}, UF_SM)

    def test_dia_incompleto_nao_prova(self):
        s = dict(self._series("2026-09-16"))
        s.pop("RR")
        cf = ot.confere_fechamento(s, self.hip)
        self.assertFalse(cf["completo"])
        self.assertEqual(cf["faltam"], ["RR"])
        self.assertTrue(all(x["estado"] == "nao_provado" for x in ot.uf_para_submercado([cf], self.hip).values()))

    def test_dias_conferidos(self):
        import datetime as dt
        d1, d2 = t._dias_para_conferir(dt.date(2026, 10, 1))
        self.assertEqual((d1, d2), ("2026-09-16", "2026-09-13"))       # quarta-feira e domingo
        self.assertEqual(dt.date.fromisoformat(d2).weekday(), 6)
        d1, d2 = t._dias_para_conferir(dt.date(2026, 10, 4))           # cairia num sábado: recua para sexta
        self.assertEqual(dt.date.fromisoformat(d1).weekday(), 4)


# ---------------------------------------------------------------- nomes, pontos e polígonos

class Nomes(unittest.TestCase):
    def setUp(self):
        self.malha = _malha()
        self.n = it.IndiceNomes(self.malha["features"], toponimos=[x for x in it.TOPONIMOS if x[2] in
                                                                   {f["id"] for f in self.malha["features"]}])

    def test_nome_atual_com_apostrofo_e_caixa(self):
        self.assertEqual(self.n.codigo("Sant'Ana do Livramento", "RS"), ("4317103", "nome_atual"))
        self.assertEqual(self.n.codigo("SANT ANA DO LIVRAMENTO", "RS"), ("4317103", "nome_atual"))
        self.assertEqual(self.n.codigo("Alta Floresta d'Oeste", "RO"), ("1100015", "nome_atual"))

    def test_mesmo_nome_em_ufs_diferentes(self):
        self.assertEqual(self.n.codigo("Bom Jesus", "PI")[0], "2201903")
        self.assertEqual(self.n.codigo("Bom Jesus", "RS")[0], "4302303")
        self.assertEqual(self.n.codigo("Bandeirantes", "PR")[0], "4102406")
        self.assertEqual(self.n.codigo("Bandeirantes", "MS")[0], "5001508")
        self.assertEqual(self.n.codigo("Bom Jesus", "MG"), (None, None))

    def test_grafia_antiga_documentada(self):
        self.assertEqual(self.n.codigo("Açu", "RN"), ("2400208", "grafia_antiga"))
        self.assertEqual(self.n.codigo("Santana do Livramento", "RS"), ("4317103", "grafia_antiga"))
        self.assertEqual(self.n.codigo("Moji das Cruzes", "SP"), ("3530607", "grafia_antiga"))
        self.assertEqual(self.n.codigo("Moji Mirim", "SP"), ("3530805", "grafia_antiga"))
        self.assertEqual(self.n.codigo("Mogi das Cruzes", "SP"), ("3530607", "nome_atual"))

    def test_sem_semelhanca(self):
        # "Armação de Búzios" não é igual a "Armação dos Búzios": fica sem vínculo e é listada
        self.assertEqual(self.n.codigo("Armação de Búzios", "RJ"), (None, None))
        self.assertEqual(self.n.codigo("Nova Lima", "SP"), (None, None))

    def test_lista_de_municipios_do_siga(self):
        self.assertEqual(it.municipios_siga("Iturama - MG, Indiaporã - SP, Ouroeste - SP"),
                         [("Iturama", "MG"), ("Indiaporã", "SP"), ("Ouroeste", "SP")])
        self.assertEqual(it.municipios_siga("Não Informado"), [("Não Informado", None)])
        self.assertEqual(it.municipios_siga(""), [])

    def test_tabela_de_grafias_antigas_aponta_para_a_malha_publicada(self):
        caminho = os.path.join(base.RAIZ, "public", "energia", "geo", "municipios.json")
        if not os.path.exists(caminho):
            self.skipTest("malha publicada ausente")
        feats = {f["id"]: f for f in _json(caminho)["features"]}
        for uf, nome, cod, origem in it.TOPONIMOS:
            self.assertIn(cod, feats, nome)
            self.assertEqual(feats[cod]["uf"], uf, nome)
            self.assertNotEqual(it.normaliza(feats[cod]["nome"]), it.normaliza(nome), nome)  # é mesmo grafia antiga
            self.assertIn("Divisão Territorial Brasileira", origem)
        it.IndiceNomes(list(feats.values()))   # sem nome repetido na mesma UF


class Pontos(unittest.TestCase):
    def setUp(self):
        self.malha = _malha()
        self.origem = geo.origem_da_grade()
        self.poly = it.IndicePoligonos(self.malha["features"])

    def test_grade_igual_a_da_malha(self):
        self.assertEqual(list(self.origem), self.malha["projecao"]["origem_m"])

    def test_ponto_no_municipio(self):
        # PCH "E" (Nova Lima - MG) e UFV em Açu (RN), coordenadas do SIGA
        x, y = it.projeta(-43.8702, -20.1248, self.origem)
        self.assertEqual((x, y), (33920, 29333))
        self.assertEqual(self.poly.localiza(x, y), ["3144805"])
        self.assertEqual(self.poly.localiza(*it.projeta(-37.0264, -5.546, self.origem)), ["2400208"])

    def test_coordenada_fora_do_declarado_e_conferencia_nao_correcao(self):
        # CGH declarada em Belo Horizonte com coordenada em Ouro Preto
        self.assertEqual(self.poly.localiza(*it.projeta(-43.4828, -20.495, self.origem)), ["3146107"])

    def test_malha_maxima_desfaz_falso_positivo_da_simplificada(self):
        # UTE Budai (UTE.PE.SP.028609-5.1), declarada em Jandira (SP), coordenada do SIGA
        # (-23,5167; -46,9157): fora de Jandira na malha simplificada do mapa e dentro na
        # malha de qualidade máxima do IBGE (recorte de Jandira da API de malhas v4, 2025)
        with open(os.path.join(DADOS, "malha_maxima_jandira.json"), encoding="utf-8") as f:
            P = it.PoligonosMaxima(json.load(f))
        self.assertEqual(P.localiza(-46.9157, -23.5167), ["3525003"])
        self.assertNotIn("3525003", self.poly.localiza(*it.projeta(-46.9157, -23.5167, self.origem)))
        self.assertFalse(P.contem("3525003", -46.95, -23.5167))     # 3,4 km a oeste: fora
        self.assertIsNone(P.contem("3550308", -46.9157, -23.5167))  # município de outra UF: não está no índice
        self.assertEqual(t.localiza_pontos([(7, -46.9157, -23.5167), (8, -43.87, -20.12)], [P]), {7: ["3525003"]})

    def test_corpo_gzip_em_camadas(self):
        import gzip as gz
        corpo = b'{"a": 1}'
        self.assertEqual(it.corpo_sem_gzip(gz.compress(gz.compress(corpo))), corpo)
        self.assertEqual(it.corpo_sem_gzip(corpo), corpo)
        self.assertEqual(set(it.CODIGOS_UF.values()), set(ot.UFS))


class Usinas(unittest.TestCase):
    def setUp(self):
        malha = _malha()
        self.nomes = it.IndiceNomes(malha["features"], toponimos=[x for x in it.TOPONIMOS if x[2] in
                                                                  {f["id"] for f in malha["features"]}])
        self.u = t.processa_usinas(_siga(), self.nomes, it.IndicePoligonos(malha["features"]), geo.origem_da_grade())

    def test_nova_lima_igual_ao_siga_original(self):
        # CSV original do SIGA (bronze de 30/09/2026) relido por outro código: 12 usinas em
        # operação declaradas só em "Nova Lima - MG", 15,943 MW fiscalizados
        n, mw = self.u["op"]["3144805"]
        self.assertEqual(n, 12)
        self.assertAlmostEqual(mw, 15.943, places=6)

    def test_operacao_e_carteira_separadas(self):
        n, mw = self.u["op"]["2400208"]                     # Açu, pela grafia antiga
        self.assertEqual(n, 4)
        self.assertAlmostEqual(mw, 119.2, places=6)
        n, mw = self.u["carteira"]["2400208"]               # potência outorgada, não fiscalizada (0 na fonte)
        self.assertEqual(n, 2)
        self.assertAlmostEqual(mw, 100.0, places=6)
        self.assertEqual(self.u["contagem"]["via_grafia_antiga"], 6)

    def test_usina_em_varios_municipios_nao_soma(self):
        ceg = "UHE.PH.MG.000041-8.1"                        # 1.396,2 MW em Iturama, Indiaporã e Ouroeste
        for cod in ("3134400", "3520707", "3534757"):
            self.assertIn(ceg, self.u["multi"][cod])
            self.assertNotIn(cod, self.u["op"])
        self.assertEqual(self.u["contagem"]["multimunicipio"], 2)

    def test_declaracao_prevalece_sobre_coordenada(self):
        n, _mw = self.u["op"]["3106200"]
        self.assertEqual(n, 3)                               # as três CGHs de "Belo Horizonte - MG"
        linhas = {x[0]: x for x in self.u["usinas"]}
        self.assertEqual(linhas["CGH.PH.MG.000345-0.2"][11], 0)   # coordenada fora (Ouro Preto)
        self.assertEqual(linhas["PCH.PH.MG.000008-6.1"][11], 1)

    def test_registros_ate_10kw_fora_da_contagem_de_usinas(self):
        # três registros reais de Portel (PA): UFV de 1, 1 e 3 kW da Equatorial Pará
        self.assertNotIn("1505809", self.u["op"])
        n, kw = self.u["registros"]["1505809"]
        self.assertEqual((n, kw), (3, 5.0))
        self.assertEqual(self.u["contagem"]["registros_ate_10kw"], 3)
        # registro acima de 10 kW continua usina: CGH Salto (4.505 kW) em Belo Horizonte e UTE Budai (1.070 kW) em Jandira
        self.assertEqual(self.u["op"]["3525003"][0], 1)
        self.assertAlmostEqual(self.u["op"]["3525003"][1], 1.07, places=6)
        linhas = {x[0]: x for x in self.u["usinas"]}
        self.assertEqual(linhas["UFV.RS.PA.064814-0.1"][12], "Registro")
        self.assertEqual(t.registro_ate_10kw({"estagio": "operacao", "outorga": "Registro", "kw_fiscalizado": "10.0"}), True)
        self.assertEqual(t.registro_ate_10kw({"estagio": "operacao", "outorga": "Registro", "kw_fiscalizado": "10.5"}), False)
        self.assertEqual(t.registro_ate_10kw({"estagio": "operacao", "outorga": "Autorização", "kw_fiscalizado": "3"}), False)
        self.assertEqual(t.registro_ate_10kw({"estagio": "operacao", "outorga": "Registro", "kw_fiscalizado": ""}), False)

    def test_conferencia_na_malha_maxima_sobrepoe_a_simplificada(self):
        malha = _malha()
        siga = _siga()
        with open(os.path.join(DADOS, "malha_maxima_jandira.json"), encoding="utf-8") as f:
            P = it.PoligonosMaxima(json.load(f))
        pontos = [(i, float(r["lon"]), float(r["lat"])) for i, r in enumerate(siga) if r["lat"] and r["lon"]]
        u = t.processa_usinas(siga, self.nomes, it.IndicePoligonos(malha["features"]), geo.origem_da_grade(),
                              achados=t.localiza_pontos(pontos, [P]))
        budai = next(x for x in u["csv"] if x[0] == "UTE.PE.SP.028609-5.1")
        self.assertEqual((budai[10], budai[11], budai[16]), ("3525003", 1, "maxima"))
        simples = next(x for x in self.u["csv"] if x[0] == "UTE.PE.SP.028609-5.1")
        self.assertEqual((simples[11], simples[16]), (0, "simplificada"))     # falso positivo da malha do mapa
        self.assertGreaterEqual(u["contagem"]["simplificada_fora_maxima_dentro"], 1)

    def test_sem_coordenada_e_sem_municipio(self):
        linhas = {x[0]: x for x in self.u["usinas"]}
        sem = linhas["UTE.AI.PR.028157-3.1"]                 # Bandeirantes - PR, sem coordenada
        self.assertEqual((sem[7], sem[8], sem[11]), (None, None, None))
        self.assertEqual(self.u["op"]["4102406"][0], 1)      # conta pelo município declarado
        ni = linhas["UFV.RS.PI.057911-4.1"]                  # "Não Informado"
        self.assertEqual((ni[9], ni[10]), ([], 1))
        self.assertIsNone(ni[11])
        self.assertIn(("", "Não Informado"), self.u["nao_reconhecidos"])
        self.assertIn(("RJ", "Armação de Búzios"), self.u["nao_reconhecidos"])
        self.assertEqual(self.u["contagem"]["total"], len(_siga()))


class SistemaIsolado(unittest.TestCase):
    """Município com localidade do PASI (ciclo 2025): fora do SIN quando a sede é localidade
    isolada ou a população isolada é ao menos metade da estimada; senão, aviso. Populações
    do arquivo do PASI integrado pelo módulo Inclusão (Tefé conferida no WebMap da EPE:
    AM-096 TEFÉ 73.669 e AM-025 CAIAMBÉ 974) e estimativas do IBGE de 2026."""

    N = {"subsistema": "N", "estado": "provado"}
    SE = {"subsistema": "SE", "estado": "provado"}

    def test_sede_isolada(self):
        tefe = [{"nome": "CAIAMBÉ", "populacao": 974.0}, {"nome": "TEFÉ", "populacao": 73669.0}]
        self.assertEqual(t.estado_submercado_municipio("Tefé", 81046, tefe, self.N), (None, "fora_do_sin", 1))
        jordao = [{"nome": "JORDÃO", "populacao": 9222.0}]   # Acre: a UF é do Sudeste/Centro-Oeste
        self.assertEqual(t.estado_submercado_municipio("Jordão", 9972, jordao, self.SE), (None, "fora_do_sin", 1))
        # a sede decide mesmo sem população publicada
        self.assertEqual(t.estado_submercado_municipio("Jordão", None, [{"nome": "JORDÃO", "populacao": None}], self.SE)[1], "fora_do_sin")

    def test_maior_parte_da_populacao_isolada(self):
        careiro = [{"nome": "CAREIRO", "populacao": 19637.0}, {"nome": "PARAUÁ", "populacao": 284.0}]
        self.assertEqual(t.estado_submercado_municipio("Careiro da Várzea", 20081, careiro, self.N), (None, "fora_do_sin", 0))

    def test_localidade_menor_mantem_submercado_com_aviso(self):
        itaituba = [{"nome": "CREPURIZAO", "populacao": 10000.0}, {"nome": "AGUA BRANCA", "populacao": 2500.0}]
        self.assertEqual(t.estado_submercado_municipio("Itaituba", 136990, itaituba, self.N), ("N", "com_localidade_isolada", 0))
        juruti = [{"nome": "ALCOA PORTO", "populacao": None}, {"nome": "ALCOA BENEFICIAMENTO", "populacao": None}]
        self.assertEqual(t.estado_submercado_municipio("Juruti", 54546, juruti, self.N), ("N", "com_localidade_isolada", 0))

    def test_sem_localidade_vale_a_uf(self):
        self.assertEqual(t.estado_submercado_municipio("Manaus", 2327101, [], self.N), ("N", "provado", None))
        nao = {"subsistema": None, "estado": "nao_provado"}
        self.assertEqual(t.estado_submercado_municipio("X", 10, [{"nome": "Y", "populacao": 1.0}], nao), (None, "nao_provado", 0))


class CamadaEpe(unittest.TestCase):
    def test_subsistema_por_uf_da_camada_24(self):
        # resposta real da camada 24 do WebMap da EPE (01/10/2026): Bahia com sigla "BH" e
        # Distrito Federal com nome "DF"; o mapeamento é o mesmo publicado por Água e Carga
        with open(os.path.join(DADOS, "epe_camada24_subsistemas.json"), encoding="utf-8") as f:
            texto = f.read()
        malha_uf = os.path.join(base.RAIZ, "public", "energia", "geo", "uf.json")
        nomes_uf = {f["uf"]: f["nome"] for f in _json(malha_uf)["features"]} if os.path.exists(malha_uf) else {
            "BA": "Bahia", **{uf: uf for uf in ot.UFS if uf != "BA"}}
        r = et.subsistemas_por_uf(texto, nomes_uf)
        self.assertEqual(r["mapeamento"], UF_SM)
        self.assertEqual(r["sem_uf"], [])
        self.assertEqual([(x["UF_fonte"], x["uf"]) for x in r["ligacoes_pelo_nome"]], [("BH", "BA")])

    def test_sigla_e_nome_desconhecidos_nao_sao_aproximados(self):
        texto = json.dumps({"features": [{"attributes": {"UF": "XX", "Nome": "BAÍA", "subsistee": "NE"}},
                                         {"attributes": {"UF": "SP", "Nome": "SÃO PAULO", "subsistee": "SE-CO"}}]})
        r = et.subsistemas_por_uf(texto, {"BA": "Bahia", "SP": "São Paulo"})
        self.assertEqual(r["mapeamento"], {"SP": "SE"})
        self.assertEqual(len(r["sem_uf"]), 1)


class Relacao(unittest.TestCase):
    def setUp(self):
        self.pm = _json(os.path.join(DADOS, "perdas_municipios_amostra.json"))
        self.mun = {f["id"]: {"nome": f["nome"], "uf": f["uf"]} for f in _malha()["features"]}
        self.mun.update({"3550308": {"nome": "São Paulo", "uf": "SP"}, "4220000": {"nome": "Balneário Rincão", "uf": "SC"},
                         "3303401": {"nome": "Nova Friburgo", "uf": "RJ"}, "9999999": {"nome": "sem vínculo", "uf": "SP"}})
        self.r = t.vinculos_da_relacao(self.pm, self.mun)

    def test_compartilhado_so_mmgd_e_nao_confirmado(self):
        v = self.r["vinculos"]
        self.assertEqual(len(t.distribuidoras_validas(v["3550308"])), 2)          # São Paulo: Eletropaulo e CERIS
        self.assertEqual(t.distribuidoras_validas(v["4220000"]), [57])            # só pelo cadastro de MMGD (estado 2)
        nf = v["3303401"]                                                           # Nova Friburgo: ENF com vínculo 0
        self.assertEqual(len(nf), 3)
        self.assertEqual(len(t.distribuidoras_validas(nf)), 2)
        self.assertEqual(self.r["cnpjs"][99], "33249046000106")

    def test_codigo_fora_da_malha_e_municipio_sem_vinculo(self):
        fora = {x["codigo"]: x for x in self.r["fora_da_malha"]}
        self.assertIn("4314530", fora)                       # código da relação inexistente no IBGE
        self.assertFalse(fora["4314530"]["valido"])
        self.assertEqual(fora["4314530"]["distribuidoras"], ["02016440000162"])
        self.assertIn("9999999", self.r["sem_vinculo"])


# ---------------------------------------------------------------- gold publicada

class GoldPublicada(unittest.TestCase):
    """Conferências sobre a publicação real (pulam se a gold não foi gerada)."""

    @classmethod
    def setUpClass(cls):
        cls.g = _gold()
        if cls.g is None or not os.path.exists(MUN) or not os.path.exists(USI):
            raise unittest.SkipTest("gold territorio.json ou arquivos sob demanda ausentes")
        cls.m = _json(MUN)
        cls.u = _json(USI)
        cls.C = {k: i for i, k in enumerate(cls.m["campos"])}
        cls.linhas = {l[0]: l for l in cls.m["linhas"]}
        cls.dist = {d["sigla"]: d for d in cls.g["distribuidoras"]}

    def col(self, cod, campo):
        return self.linhas[cod][self.C[campo]]

    # --- critério de aceite: nenhum indicador abaixo do grão de origem

    def test_colunas_municipais_so_do_municipio_ou_referencia(self):
        permitidas = {"pop", "mmgd_un", "mmgd_kw", "mmgd_w_hab", "tsee_faturas", "tsee_desconto", "tsee_proxy_pct",
                      "tsee_base_pequena", "lpt_dom", "usi_op_n", "usi_op_mw", "usi_cart_n", "usi_cart_mw", "usi_reg_n",
                      "usi_reg_kw", "isol_n", "isol_pop"}
        refs = {"ibge", "nome", "uf", "sm", "sm_estado", "dist", "conj", "usi_multi", "isol_sede"}
        self.assertEqual(set(self.m["campos"]), permitidas | refs)
        self.assertEqual({k for k, g in self.m["graos"].items() if g == "municipio"}, permitidas)
        for proibido in ("taxa", "dec", "fec", "tarifa", "pld", "ear", "perdas", "participacao"):
            self.assertFalse([c for c in self.m["campos"] if proibido in c], proibido)
        self.assertEqual(set(self.m["conjuntos"]["graos"].values()), {"ref", "conjunto"})
        self.assertEqual(set(self.u["graos"].values()), {"ref", "usina"})

    def test_catalogo_cada_indicador_publicado_na_tabela_do_seu_grao(self):
        # Confere a PUBLICAÇÃO (não o texto do campo): o bloco do indicador existe na tabela
        # do grão na gold, a coluna existe no arquivo do grão, e nenhum indicador de grão
        # acima do município tem coluna no índice municipal.
        blocos = {"submercado": set(self.g["submercados"][0]["indicadores"]), "uf": set(self.g["ufs"][0]["indicadores"]),
                  "distribuidora": set(self.g["distribuidoras"][0]["indicadores"])}
        colunas = {"municipio": set(self.m["campos"]), "conjunto": set(self.m["conjuntos"]["campos"]), "usina": set(self.u["campos"])}
        for x in self.g["indicadores"]:
            if x["grao"] in blocos:
                bloco = x["campo"].split(".")[-1]
                self.assertIn(bloco, blocos[x["grao"]], x["id"])
                self.assertNotIn(bloco, self.m["campos"], x["id"])
            else:
                for col in x["campo"].split(".", 1)[1].replace(" e ", " ").replace("conjuntos[].", "").split():
                    self.assertIn(col, colunas[x["grao"]], (x["id"], col))
                    grao_col = (self.m["graos"] if x["grao"] == "municipio" else self.m["conjuntos"]["graos"]
                                if x["grao"] == "conjunto" else self.u["graos"])[col]
                    self.assertEqual(grao_col, x["grao"], (x["id"], col))
            if x["grao"] == "distribuidora":
                self.assertIn("da distribuidora", x["rotulo_no_municipio"])
                self.assertIn("não do município", x["rotulo_no_municipio"])
            if x["grao"] == "submercado":
                self.assertIn("não é um valor do município", x["rotulo_no_municipio"])
        blocos_dist = set(self.g["distribuidoras"][0]["indicadores"])
        self.assertEqual(blocos_dist, {"perdas", "qualidade", "tarifa", "mmgd", "tsee"})

    def test_nenhum_valor_da_distribuidora_no_municipio(self):
        idx = {d["i"]: d["indicadores"] for d in self.g["distribuidoras"]}
        municipais = [k for k, g in self.m["graos"].items() if g == "municipio"]
        copias, n = defaultdict(int), 0
        for l in self.m["linhas"]:
            validos = [i for i, e in l[self.C["dist"]] if e in (1, 2)]
            if len(validos) != 1:
                continue
            ind = idx[validos[0]]
            alvo = [(b, k, ind[b][k]) for b, k in (("perdas", "taxa_total_pct"), ("qualidade", "dec_h"), ("qualidade", "fec"),
                                                    ("tarifa", "total_rs_mwh"), ("tsee", "participacao_pct"))
                    if ind[b].get("disponivel") and ind[b].get(k) is not None]
            if not alvo:
                continue
            n += 1
            for c in municipais:
                v = l[self.C[c]]
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    for b, k, a in alvo:
                        if abs(v - a) < 1e-9:
                            copias[(c, b, k)] += 1
        self.assertGreater(n, 5000)
        self.assertLessEqual(sum(copias.values()), 5, dict(copias))   # coincidências isoladas, nunca cópia sistemática

    def test_consistencia_interna_soma_municipal_e_arquivo_de_usinas(self):
        # CONSISTÊNCIA INTERNA entre dois arquivos publicados (índice municipal e usinas), não
        # reconciliação com a fonte: a reconciliação está em test_usinas_iguais_ao_csv_original_do_siga
        U = {k: i for i, k in enumerate(self.u["campos"])}
        esperado = defaultdict(float)
        multi_ceg = set()
        for x in self.u["linhas"]:
            cods = x[U["municipios"]]
            pequeno = x[U["outorga"]] == "Registro" and x[U["mw_fiscalizado"]] is not None and x[U["mw_fiscalizado"]] <= 0.010
            if (x[U["estagio"]] == "operacao" and len(cods) == 1 and x[U["n_declarados"]] == 1
                    and x[U["mw_fiscalizado"]] is not None and not pequeno):
                esperado[cods[0]] += x[U["mw_fiscalizado"]]
            if x[U["n_declarados"]] > 1:
                multi_ceg.add(x[U["ceg"]])
        for cod, l in self.linhas.items():
            self.assertAlmostEqual(l[self.C["usi_op_mw"]], esperado.get(cod, 0.0), delta=0.002, msg=cod)
            self.assertTrue(set(l[self.C["usi_multi"]]) <= multi_ceg, cod)

    def test_conjuntos_so_por_referencia(self):
        conj = self.m["conjuntos"]["linhas"]
        for l in self.m["linhas"]:
            for c in l[self.C["conj"]]:
                self.assertIn(str(c), conj)
        # um conjunto cobre vários municípios: o valor é dele, não de cada município
        self.assertTrue(any(v[9] > 1 for v in conj.values()))

    # --- reconciliação com as fontes originais

    def test_mmgd_igual_ao_parquet_original_da_aneel(self):
        # empreendimento-geracao-distribuida.parquet (bronze de 30/09/2026), contado por
        # CodMunicipioIbge e somado MdaPotenciaInstaladaKW com pyarrow em 01/10/2026
        orig = {"1100015": (1381, 15374.44), "1302603": (22844, 359575.76), "2400208": (2780, 23866.62),
                "3106200": (18005, 165320.2), "3550308": (25575, 257930.0), "4205407": (8201, 83561.79)}
        for cod, (un, kw) in orig.items():
            self.assertEqual(self.col(cod, "mmgd_un"), un, cod)
            self.assertAlmostEqual(self.col(cod, "mmgd_kw"), kw, delta=0.01, msg=cod)

    def test_usinas_iguais_ao_csv_original_do_siga(self):
        # siga-empreendimentos-geracao-diario.csv (bronze de 30/09/2026) relido por outro
        # script em 01/10/2026: fase Operação, DscMuninicpios igual ao município, CEG sem
        # repetição; usinas = sem DscTipoOutorga "Registro" com até 10 kW (MW fiscalizados);
        # registros de até 10 kW à parte (kW)
        orig = {"3144805": (12, 15.943, 0, 0.0), "2400208": (31, 1243.97, 0, 0.0), "3106200": (31, 37.045, 0, 0.0),
                "3550308": (222, 1012.819, 2, 12.0), "4205407": (8, 4.901, 1, 1.0), "1302603": (24, 1298.978, 2, 13.0),
                "1304203": (5, 31.868, 0, 0.0), "1505809": (0, 0.0, 5708, 5990.0), "5003207": (2, 10.312, 2862, 2862.0),
                "3525003": (1, 1.07, 0, 0.0)}
        for cod, (n, mw, nr, kw) in orig.items():
            self.assertEqual(self.col(cod, "usi_op_n"), n, cod)
            self.assertAlmostEqual(self.col(cod, "usi_op_mw"), mw, delta=0.001, msg=cod)
            self.assertEqual(self.col(cod, "usi_reg_n"), nr, cod)
            self.assertAlmostEqual(self.col(cod, "usi_reg_kw"), kw, delta=0.001, msg=cod)
        self.assertEqual(self.g["resumo"]["usinas"]["registros_ate_10kw"], 16035)
        # o maior número de usinas de um município é o de São Paulo; o de registros, o de Portel
        U = self.C
        self.assertEqual(max(self.m["linhas"], key=lambda l: l[U["usi_op_n"]])[0], "3550308")
        self.assertEqual(max(self.m["linhas"], key=lambda l: l[U["usi_reg_n"]])[0], "1505809")
        ctl = next(c for c in self.g["controles"] if c["nome"].startswith("Extremos da contagem municipal"))
        self.assertEqual(ctl["resultado"], "aprovado")
        self.assertIn("São Paulo (SP) 222", ctl["detalhe"])
        self.assertIn("Portel (PA) 5708", ctl["detalhe"])

    def test_relacao_igual_a_refeita_dos_arquivos_originais(self):
        # Reconstrução independente (script à parte, sem código do pipeline, 01/10/2026):
        # indicadores-continuidade-coletivos-limite.csv (AnoLimiteQualidade = 2026: conjunto →
        # CNPJ), indqual-municipio.csv (conjunto → município) e
        # empreendimento-geracao-distribuida.parquet (empreendimentos por CNPJ e município):
        # vínculo 1 com empreendimento, 0 sem; município fora da relação com distribuidora de
        # ao menos 10 empreendimentos e 5% do município = vínculo 2. Resultado: 6.259
        # vínculos na malha (6.044 / 191 / 24), 5.566 municípios com distribuidora, 440
        # compartilhados, CEMIG-D com 800 (776 + 24), só 2109056 sem vínculo e 4314530 fora da malha.
        r = self.g["resumo"]
        self.assertEqual(r["municipios"], 5571)
        self.assertEqual(r["municipios_compartilhados"], 440)
        self.assertEqual(r["municipios_com_distribuidora"], 5566)
        estados = defaultdict(int)
        for l in self.m["linhas"]:
            for _i, e in l[self.C["dist"]]:
                estados[e] += 1
        self.assertEqual(dict(estados), {1: 6044, 0: 191, 2: 24})
        self.assertEqual([x["codigo"] for x in r["municipios_sem_vinculo"]], ["2109056"])
        self.assertEqual([x["codigo"] for x in r["codigos_da_relacao_fora_da_malha"]], ["4314530"])
        cemig = self.dist["CEMIG-D"]
        self.assertEqual((cemig["area"]["municipios"], cemig["area"]["confirmados"], cemig["area"]["nao_confirmados"]), (800, 776, 24))

    def test_tarifa_da_distribuidora_igual_ao_arquivo_original(self):
        # tarifas-homologadas-distribuidoras-energia-eletrica.csv (bronze de 30/09/2026), linha
        # CEMIG-D, REH 3.589/2026, Tarifa de Aplicação, B1 Convencional Residencial: TUSD 593,08 e TE 310,21
        t_ = self.dist["CEMIG-D"]["indicadores"]["tarifa"]
        self.assertEqual((t_["tusd_rs_mwh"], t_["te_rs_mwh"]), (593.08, 310.21))
        self.assertAlmostEqual(t_["total_rs_mwh"], 903.29, places=2)
        self.assertEqual((t_["vigencia_inicio"], t_["vigencia_fim"]), ("2026-05-28", "2027-05-27"))

    def test_areas_de_carga_provadas_na_publicacao(self):
        ac = self.g["areas_carga"]
        self.assertEqual(len(ac["conferencias"]), 2)
        for cf in ac["conferencias"]:
            self.assertTrue(cf["completo"] and cf["fecha"])
            self.assertLessEqual(cf["ruido_mwmed"], cf["tolerancia_mwmed"])
            self.assertGreater(cf["menor_alternativa"]["mediana_abs_mwmed"], cf["tolerancia_mwmed"])
            self.assertEqual(cf["areas_reprovadas"] + cf["areas_ambiguas"], [])
        self.assertEqual({u["uf"]: u["subsistema"] for u in self.g["ufs"]}, UF_SM)
        self.assertEqual(ac["mapeamento_agua"], ac["mapeamento_carga"])

    # --- robustez

    def test_grande_pequena_e_multiestadual(self):
        self.assertEqual(self.dist["CEMIG-D"]["submercado_unico"], "SE")
        cocel = self.dist["COCEL"]
        self.assertEqual((cocel["area"]["municipios"], cocel["area"]["exclusivos"], cocel["area"]["ufs"]), (1, 1, ["PR"]))
        ess = self.dist["ESS"]
        self.assertEqual(ess["area"]["ufs"], ["MG", "PR", "SP"])
        self.assertEqual({x["sm"] for x in ess["submercados"]}, {"SE", "S"})
        self.assertIsNone(ess["submercado_unico"])           # seleção não leva a um único submercado

    def test_mudanca_societaria(self):
        enf = self.dist["ENF"]                               # Energisa Nova Friburgo, absorvida
        self.assertFalse(enf["ativa"])
        self.assertEqual(enf["area"]["confirmados"], 0)
        self.assertFalse(enf["indicadores"]["perdas"]["disponivel"])
        self.assertIn("encerrada ou absorvida", enf["indicadores"]["perdas"]["motivo"])

    def test_valores_extremos_e_sistema_isolado(self):
        self.assertEqual(len([i for i, e in self.col("3550308", "dist") if e in (1, 2)]), 2)
        # Tefé: sede isolada (AM-096 TEFÉ 73.669 e AM-025 CAIAMBÉ 974 hab.): fora do SIN, sem submercado
        self.assertEqual((self.col("1304203", "sm"), self.col("1304203", "sm_estado"), self.col("1304203", "isol_sede")),
                         (None, "fora_do_sin", 1))
        self.assertEqual(self.col("1304203", "isol_pop"), 74643)
        # Jordão (AC, UF do Sudeste/Centro-Oeste): sede isolada, nunca "SE"
        self.assertEqual((self.col("1200328", "sm"), self.col("1200328", "sm_estado")), (None, "fora_do_sin"))
        # Uiramutã: população do PASI (18.849) maior que a estimativa do IBGE (16.809), bases diferentes
        self.assertEqual(self.col("1400704", "sm_estado"), "fora_do_sin")
        # Itaituba: duas localidades com 12.500 hab. em 136.990: submercado da UF com aviso
        self.assertEqual((self.col("1503606", "sm"), self.col("1503606", "sm_estado")), ("N", "com_localidade_isolada"))
        self.assertEqual(self.col("1302603", "sm_estado"), "provado")                   # Manaus, no SIN
        self.assertEqual(self.col("1721000", "sm_estado"), "provado_com_area_sem_carga")  # Palmas (TO)
        r = self.g["resumo"]["municipios_fora_do_sin"]
        self.assertEqual((r["total"], r["sede_isolada"], r["so_pela_populacao"]), (73, 71, 2))
        self.assertEqual(self.g["resumo"]["municipios_por_estado_submercado"]["com_localidade_isolada"], 16)
        # nenhum município fora do SIN tem submercado
        self.assertFalse([l[0] for l in self.m["linhas"] if l[self.C["sm_estado"]] == "fora_do_sin" and l[self.C["sm"]] is not None])

    def test_distribuidora_com_area_fora_do_sin(self):
        amb = self.dist["ÂMBAR AMAZONAS"]
        self.assertEqual((amb["area"]["confirmados"], amb["area"]["fora_do_sin"], amb["area"]["com_localidade_isolada"]), (58, 49, 3))
        self.assertEqual(amb["submercados"], [{"sm": "N", "municipios": 9}])     # só os 9 municípios no SIN
        self.assertTrue(amb["parte_fora_do_sin"])
        rr = self.dist["ÂMBAR ENERGIA RR"]
        self.assertEqual((rr["area"]["confirmados"], rr["area"]["fora_do_sin"], rr["submercados"]), (15, 3, [{"sm": "N", "municipios": 12}]))
        self.assertFalse(self.dist["CEMIG-D"]["parte_fora_do_sin"])
        # 52 no AM: os 49 da Âmbar com vínculo válido mais Amaturá, Santo Antônio do Içá e São
        # Paulo de Olivença, ligados à Âmbar só com vínculo 0 (sem confirmação no cadastro de MMGD).
        # Com localidade isolada, a Âmbar tem 49 + 3 = 52 dos seus 58 municípios válidos.
        am = next(u for u in self.g["ufs"] if u["uf"] == "AM")
        self.assertEqual(am["municipios_fora_do_sin"], 52)
        compat = next(x for x in self.g["compatibilidade"] if (x["de"], x["para"]) == ("municipio", "submercado"))
        self.assertIn("fora_do_sin", compat["condicao"])

    def test_perdas_faixa_fisica_e_ano_parcial(self):
        for sigla, taxa in (("CERPRO", -10.44), ("CERTHIL", -17.31), ("COORSEL", -18.24)):
            p = self.dist[sigla]["indicadores"]["perdas"]
            self.assertEqual(p["taxa_total_pct"], taxa)                 # como o SAMP publica, sem descarte
            self.assertTrue(any("faixa física" in x for x in p["ressalvas"]), sigla)
        coorsel = self.dist["COORSEL"]["indicadores"]["perdas"]
        self.assertEqual((coorsel["meses"], coorsel["parcial"]), (8, True))
        self.assertFalse(self.dist["CEMIG-D"]["indicadores"]["perdas"]["parcial"])
        q = self.dist["CASTRO-DIS"]["indicadores"]["qualidade"]       # 11 meses: o módulo Qualidade não publica
        self.assertFalse(q["disponivel"])
        self.assertIn("parcial", q["motivo"])
        ctl = {c["nome"]: c for c in self.g["controles"]}
        faixa = ctl["Percentuais da distribuidora na faixa física de 0% a 100%"]
        self.assertEqual(faixa["resultado"], "ressalva")
        for sigla in ("CERPRO", "CERTHIL", "COORSEL"):
            self.assertIn(sigla, faixa["detalhe"])

    def test_ausencia_zero_e_nao_se_aplica(self):
        self.assertEqual(self.col("2109056", "dist"), [])                  # Porto Rico do Maranhão: sem vínculo
        self.assertIsNone(self.col("3550308", "lpt_dom"))                  # sem linha no arquivo: nulo, não zero
        self.assertEqual(self.col("2109056", "usi_op_n"), 0)                # SIGA é cadastro completo: zero real
        self.assertEqual(self.col("3550308", "isol_n"), 0)
        cod = self.dist["CODESAM"]["indicadores"]["tarifa"]
        self.assertFalse(cod["disponivel"])
        self.assertTrue(cod["motivo"])
        self.assertNotIn("valor", cod)
        nao = [x for x in self.g["compatibilidade"] if not x["valida"]]
        self.assertEqual({(x["de"], x["para"]) for x in nao},
                         {("submercado", "municipio"), ("usina", "submercado"), ("usina", "distribuidora")})

    def test_csv_igual_ao_json(self):
        with open(os.path.join(base.SERIES, "territorio_municipios.csv"), encoding="utf-8") as f:
            csvl = {r["codigo_ibge"]: r for r in csv.DictReader(f, delimiter=";")}
        self.assertEqual(set(csvl), set(self.linhas))
        for cod in ("3550308", "1304203", "2109056", "3144805"):
            r = csvl[cod]
            for c_csv, c_json in (("mmgd_unidades", "mmgd_un"), ("usinas_operacao_so_no_municipio", "usi_op_n"),
                                  ("lpt_domicilios", "lpt_dom"), ("estado_submercado", "sm_estado")):
                v = self.col(cod, c_json)
                self.assertEqual(r[c_csv], "" if v is None else (repr(round(v, 4)) if isinstance(v, float) else str(v)), (cod, c_csv))

    def test_evidencias_e_proveniencias(self):
        self.assertEqual(set(self.g["evidencias"]), {"municipios_compartilhados", "municipios_com_submercado",
                                                     "usinas_municipio_reconhecido"})
        for nome, e in self.g["evidencias"].items():
            self.assertEqual(ev.validar(e), [], nome)
        for nome, p in self.g["proveniencia"].items():
            self.assertTrue(p["limitacoes"], nome)
            self.assertIn(p["natureza"], ("OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"), nome)
        self.assertFalse([c for c in self.g["controles"] if c["resultado"] == "reprovado"])

    def test_cada_bloco_reapresentado_tem_proveniencia_propria(self):
        P = self.g["proveniencia"]
        for k in ("mmgd_ons", "conjuntos", "populacao", "pld_dia", "pld_mes", "ear", "subsistema_uf"):
            self.assertIn(k, P)
        self.assertEqual(P["mmgd_ons"]["natureza"], "ESTIMADO")
        self.assertEqual(P["mmgd_ons"]["fonte"]["orgao"], "ONS")
        self.assertEqual(P["populacao"]["fonte"]["orgao"], "IBGE")
        self.assertEqual(P["populacao"]["periodo_referencia"], {"inicio": "2026", "fim": "2026"})
        self.assertEqual(self.g["referencias"]["populacao_ano"], 2026)
        self.assertEqual(P["conjuntos"]["periodo_referencia"], {"inicio": "2025", "fim": "2025"})

    def test_natureza_metrica_e_periodo_do_valor_exibido(self):
        P = self.g["proveniencia"]
        ind = {x["id"]: x for x in self.g["indicadores"]}
        # PLD do dia é média de 24 horas: calculado, com a fórmula do PLD diário
        self.assertEqual(ind["pld_dia"]["natureza"], "CALCULADO")
        self.assertEqual(P["pld_dia"]["natureza"], "CALCULADO")
        self.assertIn("PLD_dia", P["pld_dia"]["formula"])
        self.assertEqual(P["pld_dia"]["periodo_referencia"], {"inicio": "2026-09-30", "fim": "2026-09-30"})
        self.assertEqual(P["pld_mes"]["periodo_referencia"], {"inicio": "2026-09", "fim": "2026-09"})
        # EAR do subsistema: observada pelo ONS, sem a fórmula do SIN, métrica própria
        self.assertEqual((P["ear"]["natureza"], P["ear"]["formula"]), ("OBSERVADO", None))
        self.assertNotIn("SIN", " ".join(P["ear"]["transformacoes"]))
        self.assertEqual(ind["ear_pct"]["metrica"], "territorio_ear_subsistema_pct")
        self.assertEqual(P["ear"]["periodo_referencia"], {"inicio": "2026-09-29", "fim": "2026-09-29"})
        # período do valor exibido, não a cobertura da fonte
        self.assertEqual(P["distribuidora_perdas"]["periodo_referencia"], {"inicio": "2025", "fim": "2025"})
        self.assertEqual(P["isolados"]["periodo_referencia"], {"inicio": "2025", "fim": "2025"})
        self.assertEqual(P["mmgd_ons"]["periodo_referencia"], {"inicio": "2026-08", "fim": "2026-08"})
        self.assertNotIn("scrutiniums.com", P["indice"]["fonte"]["url_dataset"])

    def test_evidencia_com_captura_original_e_consulta_atual(self):
        E = self.g["evidencias"]
        f = E["municipios_compartilhados"]["fonte"]
        # captura do IndQual pelo módulo Perdas, não a geração do arquivo intermediário
        self.assertEqual(f["capturado_em"], "2026-09-30T22:32:46Z")
        self.assertTrue(f["processado_em"] and f["processado_em"] != f["capturado_em"])
        u = E["usinas_municipio_reconhecido"]["fonte"]
        self.assertEqual(u["capturado_em"], "2026-09-30T22:18:54Z")        # captura do SIGA
        self.assertTrue(u["publicado_em"])
        self.assertIn("meia_hora.", E["municipios_com_submercado"]["consulta"])
        self.assertNotIn("carga_global_mwmed", E["municipios_com_submercado"]["consulta"])

    def test_coordenadas_na_malha_maxima(self):
        U = {k: i for i, k in enumerate(self.u["campos"])}
        self.assertEqual(self.u["conferencia_coordenada"], "maxima")
        linhas = {x[0]: x for x in self.u["linhas"]}
        # amostra do verificador dada como fora na malha simplificada: dentro na máxima
        for ceg in ("EOL.CV.PB.051574-4.1", "EOL.CV.PI.033014-0.1", "UTE.PE.SP.028609-5.1", "CGH.PH.MS.029104-8.1"):
            self.assertEqual(linhas[ceg][U["coord_no_declarado"]], 1, ceg)
        # Tapuirama (CGH.PH.MG.028955-8.1, Uberlândia): fora na malha de 2025 (API v4), dentro na
        # revisão anterior servida pela API v3; o índice usa a mesma revisão do mapa (2025)
        self.assertEqual(linhas["CGH.PH.MG.028955-8.1"][U["coord_no_declarado"]], 0)
        r = self.g["resumo"]["usinas"]
        self.assertEqual(r["coordenada_fora_na_malha_simplificada"], 1379)
        self.assertLess(r["coordenada_fora_do_municipio_declarado"], 1379)
        self.assertEqual(r["coordenada_fora_na_malha_simplificada"] - r["simplificada_fora_maxima_dentro"]
                         + r["simplificada_dentro_maxima_fora"], r["coordenada_fora_do_municipio_declarado"])
        self.assertEqual(r["conferencia_coordenada"]["conferencia"], "maxima")
        self.assertEqual(len(r["conferencia_coordenada"]["arquivos"]), 27)

    def test_areas_publicam_as_duas_estatisticas(self):
        ac = self.g["areas_carga"]
        self.assertEqual(ac["mapeamento_epe"], UF_SM)
        d16 = next(c for c in ac["conferencias"] if c["dia"] == "2026-09-16")
        self.assertEqual(d16["menor_alternativa"]["descricao"], "troca AC e RR")
        self.assertEqual(d16["menor_alternativa_pelas_medias"]["descricao"], "troca RO e TON")
        self.assertEqual(d16["alternativas_que_fechariam_pelas_medias"], ["troca RO e TON", "troca RS e BASE"])
        with open(os.path.join(base.SERIES, "territorio_areas_alternativas.csv"), encoding="utf-8") as f:
            alts = list(csv.DictReader(f, delimiter=";"))
        self.assertEqual(len(alts), 2 * 297)
        self.assertFalse([a for a in alts if a["fecha"] == "1"])

    def test_tamanhos(self):
        self.assertLess(os.path.getsize(GOLD), 400 * 1024)
        for nome in ("territorio_municipios.json", "territorio_usinas.json", "territorio_municipios.csv",
                     "territorio_usinas.csv"):
            self.assertLess(os.path.getsize(os.path.join(base.SERIES, nome)), 5 * 1024 * 1024, nome)


# ---------------------------------------------------------------- catálogo e registro

class Catalogo(unittest.TestCase):
    def test_metricas_validas(self):
        from pipeline.energia.metricas import territorio as mt
        for m in mt.METRICAS:
            self.assertEqual(metricas.validar(m), [], m["id"])
            self.assertTrue(m["id"].startswith("territorio_"))

    def test_indicadores_apontam_para_metricas_existentes(self):
        ids = {m["id"] for m in metricas.todas()}
        for x in t.INDICADORES:
            self.assertIn(x["id"], t.METRICA_DE)
            if t.METRICA_DE[x["id"]]:
                self.assertIn(t.METRICA_DE[x["id"]], ids, x["id"])

    def test_registro(self):
        r = t.REGISTRO
        self.assertEqual((r["id"], r["familia"], r["ordem"], r["gold"]), ("territorio", "territorio", 97, "territorio.json"))
        for d in r["datasets"]:
            self.assertTrue(d["url"] and d["licenca"] and d["dataset_silver"])
            for url in d["downloads"]:
                self.assertIn(url, r["arquivos"])

    def test_granularidade_estrutural(self):
        self.assertEqual([x["resultado"] for x in t._valida_granularidade()], ["aprovado"])


if __name__ == "__main__":
    unittest.main()
