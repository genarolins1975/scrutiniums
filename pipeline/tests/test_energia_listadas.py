"""Testes do módulo Listadas com recortes reais das fontes, sem rede.

Recortes em pipeline/tests/dados/energia_listadas/ (capturados em 16/10/2026):
- cotahist_2025_recorte.txt: cabeçalho e linhas originais (Latin-1, largura fixa) do
  COTAHIST_A2025.ZIP da B3 com a troca de código da AXIA (ELET3 até 07/11/2025, AXIA3 desde
  10/11/2025) e a bonificação em ações preferenciais classe C (AXIA7) com data com 19/12/2025;
- suplemento_AXIA.json e suplemento_CMIG.json: resposta original da GetListedSupplementCompany
  (quantidade de ações e eventos em ações, inclusive a bonificação de 30% da Cemig em 2024);
- proventos_CMIG_desde2024.json: resultados originais da GetListedCashDividends da Cemig com data
  com desde 2024 (juros sobre capital próprio em duas parcelas com o mesmo valor por ação);
- fca_valor_mobiliario_2025_axia.csv e _2026_axia.csv: linhas originais do FCA da AXIA
  (Eletrobras) nos dois anos, com ELET3 e AXIA3;
- fre_posicao_acionaria_2026_recorte.csv: primeiro nível da posição acionária da Energisa e da
  Taesa no FRE 2026; nome e CPF das pessoas físicas trocados por marcadores no recorte (o módulo
  nunca os lê nem republica).
"""
import csv
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402
from pipeline.energia.fontes import b3_listadas as b3  # noqa: E402
from pipeline.energia.fontes import cvm_listadas as cl  # noqa: E402
from pipeline.energia.modulos import listadas as mod  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_listadas")
AXIA, ENERGISA, TAESA = "00001180000126", "00864214000106", "07859971000130"


def _bytes(nome):
    with open(os.path.join(DADOS, nome), "rb") as f:
        return f.read()


def _linhas_csv(nome):
    with open(os.path.join(DADOS, nome), encoding="latin-1", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _cotahist():
    with open(os.path.join(DADOS, "cotahist_2025_recorte.txt"), encoding="latin-1", newline="") as f:
        return list(b3.le_cotahist(f, {"AXIA", "ELET"}))


class TestCotahist(unittest.TestCase):
    def test_precos_e_isin_lidos_nas_posicoes_do_layout(self):
        r = {(x["codigo"], x["data"]): x for x in _cotahist()}
        # fechamentos conferidos no arquivo original: 62,80 e 48,65 (AXIA3) e 48,20 (AXIA7, primeiro pregão)
        self.assertAlmostEqual(r[("AXIA3", "2025-12-19")]["fechamento"], 62.80)
        self.assertAlmostEqual(r[("AXIA3", "2025-12-22")]["fechamento"], 48.65)
        self.assertAlmostEqual(r[("AXIA7", "2025-12-22")]["fechamento"], 48.20)
        self.assertEqual(r[("ELET3", "2025-11-07")]["isin"], "BRELETACNOR6")
        self.assertEqual(r[("AXIA3", "2025-11-10")]["isin"], "BRAXIAACNOR0")
        self.assertEqual(r[("AXIA3", "2025-12-22")]["especificacao"], "ON EB N1")
        self.assertTrue(all(x["mercado"] == "010" for x in r.values()))

    def test_cabecalho_e_outros_mercados_ficam_fora(self):
        self.assertFalse(any(x["codigo"] == "COTAHIST.2025" for x in _cotahist()))


class TestEventosB3(unittest.TestCase):
    def test_json_duplamente_serializado(self):
        corpo = json.dumps(json.dumps([{"code": "X"}])).encode()
        self.assertEqual(b3.carrega_json(corpo), [{"code": "X"}])
        self.assertEqual(b3.carrega_json(b'[{"code": "X"}]'), [{"code": "X"}])

    def test_fatores_por_rotulo(self):
        # Cemig 2024: bonificação de 30% (fator 30); Copel 2021: desdobramento 1 para 10 (fator 900);
        # Cemig 2007: grupamento 500 para 1 (fator 0,002)
        self.assertAlmostEqual(b3.fator_acoes("BONIFICACAO", 30.0), 1.3)
        self.assertAlmostEqual(b3.fator_acoes("DESDOBRAMENTO", 900.0), 10.0)
        self.assertAlmostEqual(b3.fator_acoes("GRUPAMENTO", 0.002), 0.002)
        self.assertIsNone(b3.fator_acoes("RESG TOTAL RV", 100.0))

    def test_suplemento_cemig(self):
        s = b3.le_suplemento(_bytes("suplemento_CMIG.json"))
        self.assertEqual(s["codigo_cvm"], "2453")
        bon = [e for e in s["eventos_acoes"] if e["rotulo"] == "BONIFICACAO" and e["isin"] == "BRCMIGACNPR3"]
        self.assertEqual(len(bon), 1)
        self.assertEqual(bon[0]["data_com"], "2024-04-29")
        self.assertAlmostEqual(bon[0]["multiplicador"], 1.3, places=6)

    def test_bonificacao_da_axia_e_em_outra_classe(self):
        s = b3.le_suplemento(_bytes("suplemento_AXIA.json"))
        bon = [e for e in s["eventos_acoes"] if e["rotulo"] == "BONIFICACAO" and e["isin"] == "BRAXIAACNOR0"]
        self.assertEqual(len(bon), 1)
        self.assertEqual(bon[0]["isin_emitido"], "BRAXIAACNPC9")
        self.assertEqual(bon[0]["data_com"], "2025-12-19")

    def test_proventos_mantem_parcelas_iguais(self):
        p = b3.le_proventos(json.loads(_bytes("proventos_CMIG_desde2024.json")))
        jcp = [x for x in p if x["classe"] == "PN" and x["data_com"] == "2026-09-22" and x["rotulo"] == "JRS CAP PROPRIO"]
        # duas parcelas de R$ 0,03495670057 (pagamentos em 30/06/2027 e 30/12/2027 no suplemento)
        self.assertEqual(len(jcp), 2)
        self.assertAlmostEqual(jcp[0]["valor"], 0.03495670057)


class TestRetorno(unittest.TestCase):
    def test_bonificacao_e_provento_no_dia_ex(self):
        # preço 10, bonificação de 25% com data com no dia 1 (ex no dia 2, preço cai para 8),
        # provento de 0,50 com data com no dia 3 (ex no dia 4, preço cai de 8 para 7,50)
        f = [("2024-01-01", 10.0), ("2024-01-02", 8.0), ("2024-01-03", 8.0), ("2024-01-04", 7.5)]
        s, ap = b3.serie_retorno(f, [("2024-01-03", 0.5)], [("2024-01-01", 1.25)])
        self.assertAlmostEqual(s[1][2], 1.0)          # bonificação neutra no preço ajustado
        self.assertAlmostEqual(s[3][2], 7.5 * 1.25 / 10.0)
        self.assertAlmostEqual(s[3][3], 1.0)          # provento reinvestido: retorno total neutro
        self.assertEqual([a["data_ex"] for a in ap], ["2024-01-02", "2024-01-04"])

    def test_evento_antes_da_serie_nao_entra(self):
        s, ap = b3.serie_retorno([("2024-01-02", 10.0), ("2024-01-03", 11.0)], [("2023-12-01", 1.0)], [])
        self.assertEqual(ap, [])
        self.assertAlmostEqual(s[-1][3], 1.1)

    def test_retorno_entre_usa_ultimo_pregao_ate_a_data(self):
        s = [("2020-12-30", 10.0, 1.0, 1.0), ("2021-01-04", 11.0, 1.1, 1.12), ("2021-06-01", 12.0, 1.2, 1.3)]
        r = b3.retorno_entre(s, "2020-12-31")
        self.assertEqual(r["de"], "2020-12-30")
        self.assertAlmostEqual(r["total"], 0.3)
        self.assertIsNone(b3.retorno_entre(s, "2020-01-01"))

    def test_emenda_elet3_axia3_e_bonificacao_em_outra_classe(self):
        fech, vol = {}, {}
        for x in _cotahist():
            if x["bdi"] != "02":
                continue
            fech.setdefault(f"fech:{x['codigo']}:{x['isin']}", []).append((x["data"], x["fechamento"]))
            vol.setdefault(f"vol:{x['codigo']}:{x['isin']}", []).append((x["data"], x["volume"]))
        for v in list(fech.values()) + list(vol.values()):
            v.sort()
        valores = {2025: cl.le_fca_valores(_linhas_csv("fca_valor_mobiliario_2025_axia.csv")),
                   2026: cl.le_fca_valores(_linhas_csv("fca_valor_mobiliario_2026_axia.csv"))}
        cods = mod._codigos_por_cnpj(valores)[AXIA]
        self.assertEqual(cods["ELET3"]["classe"], "ON")
        self.assertEqual(cods["AXIA7"]["classe"], "PNC")
        serie, emendas, isin = mod._monta_serie_papel("AXIA3", "ON", AXIA, cods, fech, vol)
        self.assertEqual(isin, "BRAXIAACNOR0")
        self.assertEqual(len(emendas), 1)
        self.assertEqual(emendas[0]["codigo_anterior"], "ELET3")
        self.assertEqual(emendas[0]["ultimo_pregao_anterior"], "2025-11-07")
        self.assertEqual(emendas[0]["primeiro_pregao"], "2025-11-10")
        sup = b3.le_suplemento(_bytes("suplemento_AXIA.json"))
        bolsa, cot, evs = mod._bolsa("AXIA3", "ON", AXIA, cods, fech, vol, sup, [])
        est = bolsa["bonificacoes_outra_classe"]
        self.assertEqual(len(est), 1)
        # 26,28378881074 PNC por 100 ON × 48,20 (primeiro fechamento da AXIA7) = R$ 12,6688 por ação ON
        self.assertAlmostEqual(est[0]["valor"], 12.6688, places=3)
        self.assertTrue(any(e[1] == "bonificacao_outra_classe" and e[7] == "ESTIMADO" for e in evs))
        # sem a bonificação valorizada, o retorno total de 19/12 a 22/12 seria −22,5%; com ela, −2,4%
        p = {r[3]: r for r in cot}
        var_total = p["2025-12-22"][7] / p["2025-12-19"][7] - 1
        self.assertAlmostEqual(var_total, (48.65 + 12.6688) / 62.80 - 1, places=3)
        self.assertTrue(any("resgate total" in n.lower() for n in bolsa["notas"]))


class TestCvm(unittest.TestCase):
    def test_posicao_acionaria_sem_pessoa_fisica_nominal(self):
        pos = cl.le_posicao_acionaria(_linhas_csv("fre_posicao_acionaria_2026_recorte.csv"), {ENERGISA, TAESA})
        e = pos[ENERGISA]
        nomes = [a["nome"] for a in e["acionistas"]]
        self.assertIn("Gipar S.A.", nomes)
        self.assertFalse(any("PESSOA FISICA" in n for n in nomes))
        self.assertEqual(e["pessoas_fisicas"]["quantidade"], 17)
        gipar = next(a for a in e["acionistas"] if a["nome"] == "Gipar S.A.")
        self.assertAlmostEqual(gipar["pct_on"], 62.454)
        self.assertTrue(gipar["controlador"])
        t = pos[TAESA]
        cemig = next(a for a in t["acionistas"] if a["cnpj"] == "17155730000164")
        self.assertTrue(cemig["controlador"] and cemig["acordo"])
        black = next(a for a in t["acionistas"] if a["nome"].lower().startswith("blackrock"))
        self.assertIsNone(black["cnpj"])  # "00.000.000/0000-00" na fonte: estrangeiro sem CNPJ

    def test_mudancas_acionarias(self):
        ant = {"acionistas": [{"nome": "A", "cnpj": "1", "tipo": "PJ", "pct_total": 10.0},
                              {"nome": "B", "cnpj": "2", "tipo": "PJ", "pct_total": 6.0},
                              {"nome": "Outros", "cnpj": None, "tipo": "coletivo", "pct_total": 84.0}], "pessoas_fisicas": None}
        atu = {"acionistas": [{"nome": "A", "cnpj": "1", "tipo": "PJ", "pct_total": 10.3},
                              {"nome": "C", "cnpj": "3", "tipo": "PJ", "pct_total": 5.1}], "pessoas_fisicas": None}
        m = {x["acionista"]: x["tipo"] for x in mod._mudancas_acionarias(ant, atu)}
        self.assertEqual(m, {"B": "saida", "C": "entrada"})  # A variou 0,3 p.p., abaixo do limiar


class TestControle(unittest.TestCase):
    def test_sob_controle_desce_pela_cadeia(self):
        cadeias = {"H": {"cadeia": ["H"]}, "X": {"cadeia": ["X", "Y", "H", "Z"]}, "Y": {"cadeia": ["Y", "H", "Z"]},
                   "W": {"cadeia": ["W", "Z"]}}
        self.assertEqual(mod._sob_controle(cadeias, "H"), {"H": 0, "X": 2, "Y": 1})

    def test_dono_majoritario_por_cnpj(self):
        linhas = [
            {"nucleo_ceg": "1", "usina": "U", "tipo": "UHE", "fase": "Operação", "uf": "MG", "kw_outorgado": "100", "kw_fiscalizado": "100",
             "estado_vinculo": "vinculado", "soma_pct": "100", "proprietario_cnpj": "A", "proprietario_nome": "a", "pct": "30"},
            {"nucleo_ceg": "1", "usina": "U", "tipo": "UHE", "fase": "Operação", "uf": "MG", "kw_outorgado": "100", "kw_fiscalizado": "100",
             "estado_vinculo": "vinculado", "soma_pct": "100", "proprietario_cnpj": "A", "proprietario_nome": "a", "pct": "25"},
            {"nucleo_ceg": "1", "usina": "U", "tipo": "UHE", "fase": "Operação", "uf": "MG", "kw_outorgado": "100", "kw_fiscalizado": "100",
             "estado_vinculo": "vinculado", "soma_pct": "100", "proprietario_cnpj": "B", "proprietario_nome": "b", "pct": "45"},
            {"nucleo_ceg": "2", "usina": "V", "tipo": "EOL", "fase": "Operação", "uf": "BA", "kw_outorgado": "10", "kw_fiscalizado": "10",
             "estado_vinculo": "soma_divergente", "soma_pct": "200", "proprietario_cnpj": "A", "proprietario_nome": "a", "pct": "100"},
        ]
        us = mod._usinas_de_empresas(linhas)
        self.assertEqual(us["1"]["majoritario"], "A")   # 30% + 25% do mesmo CNPJ
        self.assertIsNone(us["2"]["majoritario"])       # participações inválidas


class TestGoldPublicada(unittest.TestCase):
    """Conferências da gold publicada contra os CSV publicados por caminho independente."""

    def setUp(self):
        self.g = base.le_gold("listadas.json")
        if not (isinstance(self.g, dict) and self.g.get("disponivel")):
            self.skipTest("gold listadas.json ausente")

    def test_holding_no_topo_reconcilia_com_o_grupo_do_modulo_empresas(self):
        with open(os.path.join(base.SERIES, "empresas_grupos.csv"), encoding="utf-8") as f:
            grupos = {r["grupo_cnpj"]: r for r in csv.DictReader(f, delimiter=";")}
        conferidas = 0
        for x in self.g["companhias"]:
            if x["controle"]["topo_cnpj"] == x["cnpj"] and x["cnpj"] in grupos:
                self.assertAlmostEqual(x["geracao"]["mw_controle"], float(grupos[x["cnpj"]]["mw_controle"]), delta=0.1)
                conferidas += 1
        self.assertGreater(conferidas, 3)

    def test_pesos_da_carteira_somam_100(self):
        self.assertAlmostEqual(sum(x["iee"]["peso_pct"] for x in self.g["companhias"]), 100.0, delta=0.01)

    def test_csv_de_cotacoes_fecha_com_o_retorno_publicado(self):
        with open(os.path.join(base.SERIES, mod.CSV_COTACOES), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        for x in self.g["companhias"]:
            b = x["bolsa"]
            r = (b or {}).get("retorno_12m")
            if not r:
                continue
            ls = {l["data"]: l for l in linhas if l["papel"] == x["papel"]}
            calc = 100 * (float(ls[r["ate"]]["indice_retorno_total"]) / float(ls[r["de"]]["indice_retorno_total"]) - 1)
            self.assertAlmostEqual(calc, r["total_pct"], delta=0.02, msg=x["papel"])


if __name__ == "__main__":
    unittest.main()
