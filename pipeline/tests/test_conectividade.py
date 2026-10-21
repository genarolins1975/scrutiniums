"""Testes do pipeline Conectividade (Anatel por município): leitura dos zips, agregação, validações que retêm a
publicação, gold reconstruída dos seeds versionados. Sem rede: a coleta é exercitada sobre zips montados na memória."""
from __future__ import annotations

import copy
import io
import json
import os
import sys
import unittest
import zipfile
from unittest.mock import patch

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)

from pipeline.conectividade import coleta, fontes as F, gold, run, validacoes as V  # noqa: E402

SEED = os.path.join(RAIZ, "pipeline", "conectividade", "seed")
GOLD = os.path.join(RAIZ, "public", "conectividade", "gold", "conectividade.json")


def _csv(cabecalho, linhas) -> str:
    return "﻿" + ";".join(cabecalho) + "\r\n" + "".join(";".join(str(c) for c in l) + "\r\n" for l in linhas)


def _zip(membros: dict[str, str]) -> io.BytesIO:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w", zipfile.ZIP_DEFLATED) as z:
        for nome, texto in membros.items():
            z.writestr(nome, texto.encode("utf-8"))
    b.seek(0)
    return b


CAB_FIXA = ["Ano", "Mês", "Grupo Econômico", "Empresa", "CNPJ", "Porte da Prestadora", "UF", "Município", "Código IBGE Município",
            "Faixa de Velocidade", "Velocidade", "Tecnologia", "Meio de Acesso", "Tipo de Pessoa", "Tipo de Produto", "Acessos"]
CAB_DENS = ["Ano", "Mês", "UF", "Município", "Código IBGE", "Densidade", "Nível Geográfico Densidade"]
CAB_TOTAL = ["Ano", "Mês", "Acessos"]
CAB_MOVEL = ["Ano", "Mês", "Grupo Econômico", "Empresa", "CNPJ", "Porte da Prestadora", "UF", "Município", "Código IBGE Município",
             "Código Nacional", "Código Nacional (Chip)", "Modalidade de Cobrança", "Tecnologia", "Tecnologia Geração", "Tipo de Pessoa", "Tipo de Produto", "Acessos"]
CAB_COB = ["Código Município", "Município", "UF", "Tecnologia", "Operadora", "Período", "% área coberta", "% moradores cobertos",
           "% domicilios cobertos", "Área (km2)", "Moradores", "Domicílios"]
CAB_EVO = ["Período", "Operadora", "Tecnologia", "% área coberta", "% moradores cobertos", "% domicilios cobertos", "Área (km2)", "Moradores", "Domicílios", "Ano Censo"]


def zip_fixa() -> io.BytesIO:
    acessos = [
        # mês velho no começo do arquivo: deve ser descartado quando o mês novo aparece
        [2026, 7, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "> 34Mbps", "300,000000", "FTTH", "Fibra", "Pessoa Física", "INTERNET", 999],
        [2026, 8, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "> 34Mbps", "300,000000", "FTTH", "Fibra", "Pessoa Física", "INTERNET", 60],
        [2026, 8, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "2Mbps a 12Mbps", "10,000000", "HFC", "Cabo Coaxial", "Pessoa Jurídica", "INTERNET", 30],
        [2026, 8, "OUTROS", "Provedor", "2", "Pequeno Porte", "SP", "São Paulo", "3550308", "12Mbps a 34Mbps", "25,000000", "Wi-Fi", "Rádio", "Pessoa Física", "INTERNET", 10],
        [2026, 8, "OUTROS", "Provedor", "2", "Pequeno Porte", "PI", "Patos do Piauí", "2207777", "> 34Mbps", "100,000000", "FTTH", "Fibra", "Pessoa Física", "INTERNET", 8],
        [2026, 8, "HUGHES", "Hughes", "3", "Pequeno Porte", "PI", "Patos do Piauí", "2207777", "0Kbps a 512Kbps", "0,512000", "VSAT", "Satélite", "Pessoa Física", "INTERNET", 2],
        [2026, 8, "OUTROS", "Provedor", "2", "Pequeno Porte", "SP", "Campinas", "3509502", "> 34Mbps", "100,000000", "FTTH", "Fibra", "Pessoa Física", "INTERNET", 5],
        [2026, 6, "OUTROS", "Provedor", "2", "Pequeno Porte", "SP", "Campinas", "3509502", "> 34Mbps", "100,000000", "FTTH", "Fibra", "Pessoa Física", "INTERNET", 777],
    ]
    dens = [
        [2025, 12, "Brasil", "Brasil", "0000000", "26,5", "Brasil"], [2026, 7, "Brasil", "Brasil", "0000000", "", "Brasil"], [2026, 8, "Brasil", "Brasil", "0000000", "27,0", "Brasil"],
        [2025, 12, "SP", "SP", "35", "38,0", "UF"], [2026, 8, "SP", "SP", "35", "38,9", "UF"], [2025, 12, "PI", "PI", "22", "9,0", "UF"], [2026, 8, "PI", "PI", "22", "10,1", "UF"],
        [2025, 12, "SP", "São Paulo", "3550308", "38,0", "Municipio"], [2026, 8, "SP", "São Paulo", "3550308", "38,85", "Municipio"],
        [2025, 12, "PI", "Patos do Piauí", "2207777", "20,0", "Municipio"], [2026, 8, "PI", "Patos do Piauí", "2207777", "22,4", "Municipio"],
        [2026, 8, "SP", "Campinas", "3509502", "40,0", "Municipio"],
    ]
    total = [[2026, 8, 115], [2026, 7, 999], [2026, 6, 777], [2025, 12, 700]]
    return _zip({
        "Acessos_Banda_Larga_Fixa_2025.csv": _csv(CAB_FIXA, []),
        "Acessos_Banda_Larga_Fixa_2026.csv": _csv(CAB_FIXA, acessos),
        "Densidade_Banda_Larga_Fixa.csv": _csv(CAB_DENS, dens),
        "Acessos_Banda_Larga_Fixa_Total.csv": _csv(CAB_TOTAL, total),
        "Densidades.pdf": "x",
    })


def zip_fixa_sem_velocidade() -> io.BytesIO:
    """Como zip_fixa, com os 30 acessos de cabo coaxial de São Paulo sem a velocidade contratada."""
    z = zipfile.ZipFile(zip_fixa())
    membros = {n: z.read(n).decode("utf-8-sig") for n in z.namelist()}
    membros["Acessos_Banda_Larga_Fixa_2026.csv"] = membros["Acessos_Banda_Larga_Fixa_2026.csv"].replace("2Mbps a 12Mbps;10,000000;HFC", "2Mbps a 12Mbps;;HFC")
    assert ";;HFC" in membros["Acessos_Banda_Larga_Fixa_2026.csv"]
    return _zip(membros)


def zip_movel() -> io.BytesIO:
    acessos = [
        [2026, 7, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "11", "11", "Pós-pago", "LTE", "4G", "Pessoa Física", "VOZ+DADOS", 999],
        [2026, 8, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "11", "11", "Pós-pago", "NR", "5G", "Pessoa Física", "VOZ+DADOS", 40],
        [2026, 8, "TELEFONICA", "VIVO", "1", "Grande Porte", "SP", "São Paulo", "3550308", "11", "11", "Pré-pago", "LTE", "4G", "Pessoa Física", "VOZ+DADOS", 50],
        [2026, 8, "TELECOM AMERICAS", "CLARO", "2", "Grande Porte", "SP", "São Paulo", "3550308", "11", "11", "Pós-pago", "LTE", "4G", "Pessoa Jurídica", "M2M", 10],
        [2026, 8, "TELECOM AMERICAS", "CLARO", "2", "Grande Porte", "PI", "Patos do Piauí", "2207777", "89", "89", "Pré-pago", "WCDMA", "3G", "Pessoa Física", "VOZ+DADOS", 7],
        [2026, 8, "TELECOM AMERICAS", "CLARO", "2", "Grande Porte", "PI", "Patos do Piauí", "2207777", "89", "89", "Pós-pago", "LTE", "4G", "Pessoa Física", "VOZ+DADOS", 3],
        [2026, 8, "OUTROS", "Regional", "3", "Pequeno Porte", "SP", "Campinas", "3509502", "19", "19", "Pré-pago", "GSM", "2G", "Pessoa Física", "VOZ", 4],
        [2026, 8, "OUTROS", "Regional", "3", "Pequeno Porte", "SP", "Campinas", "3509502", "19", "19", "Pós-pago", "LTE", "4G", "Pessoa Jurídica", "PONTO_DE_SERVICO", 6],
    ]
    dens = [
        [2025, 12, "Brasil", "Brasil", "0000000", "128,0", "Brasil"], [2026, 8, "Brasil", "Brasil", "0000000", "131,6", "Brasil"],
        [2025, 12, "SP", "SP", "35", "140,0", "UF"], [2026, 8, "SP", "SP", "35", "141,0", "UF"], [2025, 12, "PI", "PI", "22", "90,0", "UF"], [2026, 8, "PI", "PI", "22", "92,0", "UF"],
        [2025, 12, "SP", "São Paulo", "3550308", "150,0", "Municipio"], [2026, 8, "SP", "São Paulo", "3550308", "151,2", "Municipio"],
        [2025, 12, "PI", "Patos do Piauí", "2207777", "55,0", "Municipio"], [2026, 8, "PI", "Patos do Piauí", "2207777", "56,7", "Municipio"],
        [2026, 8, "SP", "Campinas", "3509502", "130,0", "Municipio"],
    ]
    total = [[2026, 8, 104], [2026, 7, 999], [2025, 12, 900]]   # 120 linhas menos 10 M2M e 6 pontos de serviço
    return _zip({
        "Acessos_Telefonia_Movel_2026_1S.csv": _csv(CAB_MOVEL, []),
        "Acessos_Telefonia_Movel_2026_2S.csv": _csv(CAB_MOVEL, acessos),
        "Densidade_Telefonia_Movel.csv": _csv(CAB_DENS, dens),
        "Acessos_Telefonia_Movel_Total.csv": _csv(CAB_TOTAL, total),
    })


def _linhas_cob(periodo: str, fator: float, com_5g: bool = True):
    tecs = ["Todas", "2G", "3G", "4G", "4G5G"] + (["5G"] if com_5g else [])
    out = []
    for cod, nome, uf, area, mor, dom, base in (("3550308", "São Paulo", "SP", "1521,2", 11451999, 4996529, 0.99),
                                                 ("2207777", "Patos do Piauí", "PI", "801,4", 5425, 3163, 0.60),
                                                 ("3509502", "Campinas", "SP", "794,6", 1139047, 420000, 0.95),
                                                 ("4300002", "Lagoa dos Patos", "RS", "9000", 0, 0, 0.0)):
        for tec in tecs:
            v = base * fator * (0.8 if tec == "5G" else 1.0)
            for op in ("Todas", "CLARO", "VIVO"):
                f = 1.0 if op == "Todas" else 0.9
                val = f"{v * f:.6f}".replace(".", ",")
                out.append([cod, nome, uf, tec, op, periodo, val, val, val, area, mor, dom])
    return out


def zip_cobertura() -> io.BytesIO:
    evo = []
    for per, fator in (("12-2025", 0.95), ("09-2026", 1.0)):
        for tec in ("Todas", "2G", "3G", "4G", "4G5G", "5G"):
            for op in ("Todas", "CLARO", "VIVO"):
                v = f"{93.0 * fator * (0.8 if tec == '5G' else 1.0) * (0.9 if op != 'Todas' else 1.0):.2f}".replace(".", ",")
                evo.append([per, op, tec, "17,0", v, v, "8510417", 12596471, 5419692, 2022])
    return _zip({
        "Cobertura_2025_12_Municipios.csv": _csv(CAB_COB, _linhas_cob("12-2025", 0.95, com_5g=False)),
        "Cobertura_2026_09_Municipios.csv": _csv(CAB_COB, _linhas_cob("09-2026", 1.0)),
        "Cobertura_2026_09_Setores.csv": "não lido",
        "evolucao_cobertura_brasil.csv": _csv(CAB_EVO, evo),
    })


class TestLeitura(unittest.TestCase):
    def test_numero_e_faixas(self):
        self.assertEqual(coleta.numero("27,026089688152"), 27.026089688152)
        self.assertEqual(coleta.numero("1.234,5"), 1234.5)
        self.assertIsNone(coleta.numero(""))
        self.assertEqual(coleta.mes_iso("2026", "8"), "2026-08")
        self.assertEqual([coleta._faixa_velocidade(v) for v in (None, 0.5, 9.99, 10, 24.9, 25, 99.9, 100, 10000)],
                         [None, "vel_ate_10", "vel_ate_10", "vel_10_25", "vel_10_25", "vel_25_100", "vel_25_100", "vel_100_mais", "vel_100_mais"])
        self.assertEqual(coleta._periodo_iso("09-2026"), "2026-09")
        with self.assertRaises(ValueError):
            coleta._periodo_iso("2026-09")

    def test_coleta_fixa_agrega_o_mes_mais_recente(self):
        s = coleta.coletar_fixa("memoria://fixa.zip", zip_fixa())
        self.assertEqual(s["referencia"], "2026-08")
        self.assertEqual(s["fonte"]["ano_arquivo"], 2026)
        i = {c: k for k, c in enumerate(F.CAMPOS_FIXA)}
        sp = s["municipios"]["3550308"]
        self.assertEqual(sp[:2], ["São Paulo", "SP"])
        self.assertEqual(sp[2][i["acessos"]], 100)                      # 60 + 30 + 10; julho (999) descartado
        self.assertEqual((sp[2][i["fibra"]], sp[2][i["coaxial"]], sp[2][i["radio"]]), (60, 30, 10))
        self.assertEqual((sp[2][i["vel_100_mais"]], sp[2][i["vel_25_100"]], sp[2][i["vel_10_25"]]), (60, 10, 30))
        self.assertEqual((sp[2][i["pessoa_fisica"]], sp[2][i["prestadoras"]]), (70, 2))
        self.assertEqual((s["grupos"][sp[2][i["maior_grupo"]]], sp[2][i["maior_grupo_acessos"]]), ("TELEFONICA", 90))
        self.assertEqual(s["municipios"]["3509502"][2][i["acessos"]], 5)   # junho (777) descartado
        self.assertEqual(s["brasil"]["acessos"], 115)
        self.assertEqual(s["ufs"]["SP"][i["acessos"]], 105)
        self.assertEqual(s["brasil"]["produto"], {"INTERNET": 115})
        self.assertEqual(s["grupos"], ["TELEFONICA", "OUTROS", "HUGHES"])
        d = s["densidade"]
        self.assertEqual((d["ultimo"], d["brasil"], d["ufs"]), ("2026-08", 27.0, {"PI": 10.1, "SP": 38.9}))   # 2026-07 vazio não é o último
        self.assertEqual(d["municipios"], {"2207777": 22.4, "3509502": 40.0, "3550308": 38.85})
        self.assertEqual(s["total_mensal"], {"meses": ["2025-12", "2026-06", "2026-07", "2026-08"], "acessos": [700, 777, 999, 115]})
        m = s["arquivo"]["membros"]
        self.assertEqual(set(m), {"Acessos_Banda_Larga_Fixa_2026.csv", "Densidade_Banda_Larga_Fixa.csv", "Acessos_Banda_Larga_Fixa_Total.csv"})
        self.assertEqual(len(m["Acessos_Banda_Larga_Fixa_2026.csv"]["sha256"]), 64)
        self.assertGreater(m["Acessos_Banda_Larga_Fixa_2026.csv"]["bytes"], 100)
        self.assertEqual(V.validar_fixa(s), [f"banda larga fixa: {len(s['municipios'])} municípios, fora de {F.MUNICIPIOS_MIN} a {F.MUNICIPIOS_MAX}"])

    def test_coleta_movel_agrega_geracoes_e_modalidades(self):
        s = coleta.coletar_movel("memoria://movel.zip", zip_movel())
        self.assertEqual(s["referencia"], "2026-08")
        i = {c: k for k, c in enumerate(F.CAMPOS_MOVEL)}
        sp = s["municipios"]["3550308"][2]
        self.assertEqual(sp[i["acessos"]], 100)
        self.assertEqual((sp[i["g4"]], sp[i["g5"]], sp[i["pre"]], sp[i["pos"]], sp[i["pessoa_fisica"]], sp[i["m2m"]]), (60, 40, 50, 50, 90, 10))
        self.assertEqual(s["grupos"][sp[i["maior_grupo"]]], "TELEFONICA")
        pi = s["municipios"]["2207777"][2]
        self.assertEqual((pi[i["acessos"]], pi[i["g3"]], pi[i["g4"]], pi[i["pre"]]), (10, 7, 3, 7))
        self.assertEqual((s["brasil"]["acessos"], s["brasil"]["m2m"], s["brasil"]["ponto_servico"]), (120, 10, 6))
        self.assertEqual(s["densidade"]["brasil"], 131.6)
        with patch.object(F, "MUNICIPIOS_MIN", 1):
            self.assertEqual(V.validar_movel(s), [])

    def test_coleta_cobertura_frac_vira_pct_e_descarta_lagoas(self):
        s = coleta.coletar_cobertura("memoria://cob.zip", zip_cobertura())
        self.assertEqual(s["referencia"], "2026-09")
        self.assertEqual(s["trimestres"], ["2025-12", "2026-09"])
        self.assertEqual(s["unidade_arquivo"], "fracao")
        self.assertNotIn("4300002", s["municipios"])
        self.assertEqual(s["operadoras"], ["CLARO", "VIVO"])
        pi = s["municipios"]["2207777"]
        self.assertEqual(pi[:5], ["Patos do Piauí", "PI", 5425, 3163, 801.4])
        self.assertEqual(pi[5]["todas"], [60.0, 60.0, 60.0])
        self.assertEqual(pi[5]["g5"], [48.0, 48.0, 48.0])
        self.assertEqual(pi[6]["CLARO"], [54.0, 54.0])
        self.assertEqual(pi[7], [57.0, 60.0])              # série do 4G: 0,95 × 60 e 60
        self.assertEqual(pi[8], [None, 48.0])              # 5G ausente no trimestre antigo: null, não zero
        self.assertEqual(s["brasil"]["serie"]["2026-09"]["g5"], [74.4, 74.4, 17.0])
        self.assertEqual(s["brasil"]["populacao"]["2026-09"]["moradores"], 12596471)
        self.assertEqual(s["brasil"]["operadoras_ultimo"]["CLARO"], {"g4g5": 83.7, "todas": 83.7})
        with patch.object(F, "MUNICIPIOS_MIN", 1):
            self.assertEqual(V.validar_cobertura(s), [])

    def test_estrutura_trocada_reprova(self):
        z = zip_fixa()
        with zipfile.ZipFile(z) as zz:
            membros = {n: zz.read(n).decode("utf-8") for n in zz.namelist()}
        membros["Acessos_Banda_Larga_Fixa_2026.csv"] = membros["Acessos_Banda_Larga_Fixa_2026.csv"].replace("Meio de Acesso", "Meio")
        with self.assertRaises(ValueError):
            coleta.coletar_fixa("memoria://fixa.zip", _zip(membros))
        with self.assertRaises(ValueError):
            coleta.coletar_fixa("memoria://fixa.zip", _zip({"Densidades.pdf": "x"}))


# ------------------------------------------------------------------------------------------------- seeds mínimos


def seed_fixa():
    s = coleta.coletar_fixa("memoria://fixa.zip", zip_fixa())
    s["capturado_em"] = "2026-10-20T17:00:00Z"
    return s


def seed_movel():
    s = coleta.coletar_movel("memoria://movel.zip", zip_movel())
    s["capturado_em"] = "2026-10-20T17:00:00Z"
    return s


def seed_cobertura():
    s = coleta.coletar_cobertura("memoria://cob.zip", zip_cobertura())
    s["capturado_em"] = "2026-10-20T17:00:00Z"
    return s


class TestValidacoesRetem(unittest.TestCase):
    def setUp(self):
        self.p1 = patch.object(F, "MUNICIPIOS_MIN", 1)
        self.p1.start()
        self.fixa, self.movel, self.cob = seed_fixa(), seed_movel(), seed_cobertura()
        self.assertEqual(V.validar_fixa(self.fixa), [])
        self.assertEqual(V.validar_movel(self.movel), [])
        self.assertEqual(V.validar_cobertura(self.cob), [])
        self.assertEqual(V.validar_cruzado(self.fixa, self.movel, self.cob), [])

    def tearDown(self):
        self.p1.stop()

    def _fixa(self, **muda):
        s = copy.deepcopy(self.fixa)
        for k, v in muda.items():
            s[k] = v
        return s

    def test_municipios_fora_da_faixa(self):
        with patch.object(F, "MUNICIPIOS_MIN", 5565):
            self.assertTrue(any("municípios, fora de" in p for p in V.validar_fixa(self.fixa)))

    def test_partes_que_nao_somam_e_brasil_diferente(self):
        s = copy.deepcopy(self.fixa)
        s["municipios"]["3550308"][2][1] += 1                       # fibra a mais: meios não somam os acessos
        self.assertTrue(any("somam" in p for p in V.validar_fixa(s)))
        s = copy.deepcopy(self.fixa)
        s["brasil"]["acessos"] += 1
        self.assertTrue(any("Brasil" in p for p in V.validar_fixa(s)))
        s = copy.deepcopy(self.fixa)
        s["total_mensal"]["acessos"][-1] = 200
        self.assertTrue(any("arquivo da Anatel" in p for p in V.validar_fixa(s)))
        # arquivo de totais à frente do CSV municipal retém (27ª revisão do Codex)
        s = copy.deepcopy(self.fixa)
        s["total_mensal"]["meses"].append("2026-09")
        s["total_mensal"]["acessos"].append(120)
        self.assertTrue(any("depois da referência 2026-08" in p for p in V.validar_fixa(s)))
        # mês antigo negativo na série de totais retém (24ª revisão do Codex); mês vazio (None) segue lacuna legítima
        s = copy.deepcopy(self.fixa)
        s["total_mensal"]["acessos"][0] = -5
        self.assertTrue(any("acessos negativos em 2025-12" in p for p in V.validar_fixa(s)))
        s = copy.deepcopy(self.movel)
        s["total_mensal"]["acessos"][0] = -1
        self.assertTrue(any("acessos negativos" in p for p in V.validar_movel(s)))

    def test_densidade_fora_da_faixa_e_referencia(self):
        s = copy.deepcopy(self.fixa)
        s["densidade"]["brasil"] = 70.0
        self.assertTrue(any("densidade nacional" in p for p in V.validar_fixa(s)))
        s = copy.deepcopy(self.fixa)
        s["densidade"]["municipios"]["3550308"] = F.DENSIDADE_MUNICIPIO_MAX + 1
        self.assertTrue(any("densidade fora" in p for p in V.validar_fixa(s)))
        # mês calendário inválido e competência posterior à captura retêm (25ª revisão do Codex)
        s = self._fixa(referencia="2026-99")
        self.assertTrue(any("referência inválida" in p for p in V.validar_fixa(s)))
        s = self._fixa(referencia="2027-01")
        self.assertTrue(any("posterior à captura" in p for p in V.validar_fixa(s)))
        s = self._fixa(referencia="2026-01")
        s["densidade"]["ultimo"] = "2026-01"
        self.assertTrue(any("meses da captura" in p for p in V.validar_fixa(s)))
        anterior = self._fixa(referencia="2026-09")
        self.assertTrue(any("voltou" in p for p in V.validar_fixa(self.fixa, anterior)))

    def test_acessos_vazio_retem_e_mes_vazio_da_serie_fica_vazio(self):
        self.assertIsNone(coleta.inteiro(""))
        self.assertIsNone(coleta.inteiro(None))
        self.assertEqual(coleta.inteiro("12"), 12)
        z = zipfile.ZipFile(zip_fixa())
        membros = {n: z.read(n).decode("utf-8-sig") for n in z.namelist()}
        membros["Acessos_Banda_Larga_Fixa_2026.csv"] = membros["Acessos_Banda_Larga_Fixa_2026.csv"].replace("Pessoa Jurídica;INTERNET;30", "Pessoa Jurídica;INTERNET;")
        with self.assertRaises(ValueError):
            coleta.coletar_fixa("memoria://fixa.zip", _zip(membros))
        membros = {n: z.read(n).decode("utf-8-sig") for n in z.namelist()}
        membros["Acessos_Banda_Larga_Fixa_Total.csv"] = membros["Acessos_Banda_Larga_Fixa_Total.csv"].replace("2026;7;999", "2026;7;")
        s = coleta.coletar_fixa("memoria://fixa.zip", _zip(membros))
        self.assertEqual(s["total_mensal"]["acessos"][s["total_mensal"]["meses"].index("2026-07")], None)

    def test_velocidade_ausente_nao_vira_faixa_e_retem(self):
        s = coleta.coletar_fixa("memoria://fixa.zip", zip_fixa_sem_velocidade())
        i = {c: k for k, c in enumerate(F.CAMPOS_FIXA)}
        sp = s["municipios"]["3550308"][2]
        self.assertEqual(sp[i["acessos"]], 100)                       # o acesso conta no total
        self.assertEqual(sp[i["vel_ate_10"]], 0)                      # e em faixa nenhuma, nem na mais baixa
        self.assertEqual(sp[i["vel_10_25"]] + sp[i["vel_25_100"]] + sp[i["vel_100_mais"]], 70)
        self.assertTrue(any("somam 70, acessos 100" in p for p in V.validar_fixa(s)))
        # velocidade negativa não vira a faixa mais baixa: a coleta retém a fonte (26ª revisão do Codex)
        with self.assertRaises(ValueError):
            coleta._faixa_velocidade(-1)
        z = zipfile.ZipFile(zip_fixa())
        membros = {n: z.read(n).decode("utf-8-sig") for n in z.namelist()}
        membros["Acessos_Banda_Larga_Fixa_2026.csv"] = membros["Acessos_Banda_Larga_Fixa_2026.csv"].replace("2Mbps a 12Mbps;10,000000;HFC", "2Mbps a 12Mbps;-10,000000;HFC")
        with self.assertRaises(ValueError):
            coleta.coletar_fixa("memoria://fixa.zip", _zip(membros))

    def test_revisao_acima_do_limite(self):
        anterior = copy.deepcopy(self.fixa)
        anterior["brasil"]["acessos"] = 110                           # mesmo mês, 115 contra 110: 4,5%
        self.assertTrue(any("mudou" in p for p in V.validar_fixa(self.fixa, anterior)))
        anterior = self._fixa(referencia="2026-07")
        anterior["brasil"]["acessos"] = 100                           # mês novo 15% acima
        self.assertTrue(any("foi de" in p for p in V.validar_fixa(self.fixa, anterior)))
        anterior["brasil"]["acessos"] = 113
        self.assertEqual(V.validar_fixa(self.fixa, anterior), [])

    def test_variacao_acumulada_depois_de_retencao(self):
        # seed de maio retido por três meses: 12% acumulados cabem em 3 × 5%, e o atualizador se recupera sozinho
        anterior = self._fixa(referencia="2026-05")
        anterior["brasil"]["acessos"] = 103                           # 115 contra 103: 11,7% em três meses
        self.assertEqual(V.validar_fixa(self.fixa, anterior), [])
        anterior["brasil"]["acessos"] = 95                            # 21% em três meses passa do teto de 15%
        self.assertTrue(any("em 3 meses" in p for p in V.validar_fixa(self.fixa, anterior)))

    def test_movel_m2m_e_modalidades(self):
        s = copy.deepcopy(self.movel)
        i = {c: k for k, c in enumerate(F.CAMPOS_MOVEL)}
        s["municipios"]["3550308"][2][i["m2m"]] = 1000
        self.assertTrue(any("M2M" in p for p in V.validar_movel(s)))
        s = copy.deepcopy(self.movel)
        s["municipios"]["3550308"][2][i["g5"]] += 1
        self.assertTrue(any("somam" in p for p in V.validar_movel(s)))

    def test_cobertura(self):
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][3] = -1                             # domicílios negativos retêm (26ª revisão do Codex)
        self.assertTrue(any("sem moradores ou domicílios" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][2] = None                           # moradores vazios retêm a fonte
        self.assertTrue(any("sem moradores ou domicílios" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][5]["g5"][0] = 99.0                 # 5G acima de "4G ou 5G" e de "todas" (invariantes de união)
        self.assertTrue(any("5G" in p for p in V.validar_cobertura(s)))
        # 5G acima do 4G, dentro da união, não retém: a Anatel publica isso em trimestres antigos (146 pares em 95 municípios no seed de 20/10/2026)
        s = copy.deepcopy(self.cob)
        g4 = s["municipios"]["2207777"][5]["g4"][0]
        s["municipios"]["2207777"][5]["g5"][0] = g4 + 1
        s["municipios"]["2207777"][5]["g4g5"][0] = max(s["municipios"]["2207777"][5]["g4g5"][0], g4 + 1)
        s["municipios"]["2207777"][5]["todas"][0] = max(s["municipios"]["2207777"][5]["todas"][0], g4 + 1)
        self.assertEqual([p for p in V.validar_cobertura(s) if "2207777" in p], [])
        # a série nacional também: 5G acima do 4G (ou de todas) no trimestre de referência retém (17ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        ref = s["referencia"]
        s["brasil"]["serie"][ref]["g5"][0] = 99.0
        self.assertTrue(any("Brasil em" in p and "5G" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["brasil"]["serie"][ref]["g4"][0] = s["brasil"]["serie"][ref]["todas"][0] + 1
        self.assertTrue(any("Brasil em" in p and "4G" in p for p in V.validar_cobertura(s)))
        # a série histórica de cada município: valor fora de 0 a 100 num trimestre antigo retém (22ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][7][0] = -5
        self.assertTrue(any("série em" in p and "2207777" in p for p in V.validar_cobertura(s)))
        # 5G acima do 4G num trimestre antigo não retém: fica contado na gold, com o trimestre no município
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][8][0] = (s["municipios"]["2207777"][7][0] or 0) + 1
        self.assertEqual([p for p in V.validar_cobertura(s) if "2207777" in p], [])
        # trimestre histórico com mês inválido retém (29ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        s["trimestres"][0] = "2021-99"
        self.assertTrue(any("período inválido" in p for p in V.validar_cobertura(s)))
        # evolução nacional à frente do trimestre municipal retém (27ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        s["brasil"]["serie"]["2026-12"] = copy.deepcopy(s["brasil"]["serie"][ref])
        s["brasil"]["populacao"]["2026-12"] = copy.deepcopy(s["brasil"]["populacao"][ref])
        self.assertTrue(any("vai até 2026-12, depois do trimestre municipal" in p for p in V.validar_cobertura(s)))
        # operadora no município: "4G ou 5G" acima de "todas" retém (24ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][6]["CLARO"] = [99.0, 1.0]
        self.assertTrue(any("operadora CLARO com 4G ou 5G" in p and "2207777" in p for p in V.validar_cobertura(s)))
        # invariantes de união também em domicílios e área (23ª revisão do Codex): 5G da área acima de "4G ou 5G" retém
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][5]["g5"][2] = s["municipios"]["2207777"][5]["g4g5"][2] + 1
        self.assertTrue(any("em área" in p and "2207777" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["brasil"]["serie"][ref]["g4"][1] = s["brasil"]["serie"][ref]["todas"][1] + 1
        self.assertTrue(any("Brasil em" in p and "em domicílios" in p for p in V.validar_cobertura(s)))
        # agregado nacional por operadora: negativo ou "4G ou 5G" acima de "todas" retém
        s = copy.deepcopy(self.cob)
        s["brasil"]["operadoras_ultimo"]["CLARO"]["g4g5"] = -5
        self.assertTrue(any("operadora CLARO fora de 0 a 100" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["brasil"]["operadoras_ultimo"]["CLARO"]["g4g5"] = s["brasil"]["operadoras_ultimo"]["CLARO"]["todas"] + 1
        self.assertTrue(any("operadora CLARO com 4G ou 5G" in p for p in V.validar_cobertura(s)))
        # as três medidas da série nacional ficam em 0 a 100: área negativa retém (18ª revisão do Codex)
        s = copy.deepcopy(self.cob)
        s["brasil"]["serie"][ref]["g4"][2] = -5
        self.assertTrue(any("Brasil em" in p and "g4 fora de 0 a 100" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        pi = s["municipios"]["2207777"][5]
        pi["g4"][0] = pi["g5"][0] - 1                                  # só o 4G abaixo do 5G; 4G ou 5G e todas seguem acima
        self.assertEqual([p for p in V.validar_cobertura(s) if "2207777" in p], [])   # não retém: a fonte publica isso (contado na gold)
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][5]["g3"][2] = 101.0
        self.assertTrue(any("0 a 100" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][5]["todas"] = None
        self.assertTrue(any("todas as tecnologias" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["municipios"]["2207777"][7] = [60.0]
        self.assertTrue(any("série" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["brasil"]["populacao"]["2026-09"]["moradores"] = 20_000_000
        self.assertTrue(any("moradores" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["referencia"] = "2026-06"                                   # dentro do prazo, mas fora da lista de trimestres
        self.assertTrue(any("sem a referência" in p for p in V.validar_cobertura(s)))
        s = copy.deepcopy(self.cob)
        s["referencia"] = "2025-09"
        self.assertTrue(any("meses da captura" in p for p in V.validar_cobertura(s)))

    def test_cruzado(self):
        s = copy.deepcopy(self.movel)
        for cod in ("9900001", "9900002", "9900003", "9900004"):
            s["municipios"][cod] = ["X", "SP", s["municipios"]["3509502"][2]]
        self.assertTrue(any("diferem" in p for p in V.validar_cruzado(self.fixa, s, self.cob)))
        s = copy.deepcopy(self.movel)
        s["municipios"]["3550308"][1] = "RJ"
        self.assertTrue(any("UF diferente" in p for p in V.validar_cruzado(self.fixa, s, self.cob)))
        # móvel e cobertura com três municípios a mais, diferentes entre si: cada uma passa contra a fixa (três diferenças),
        # mas o par entre elas difere em seis e retém (18ª revisão do Codex)
        m2, c2 = copy.deepcopy(self.movel), copy.deepcopy(self.cob)
        for cod in ("9900001", "9900002", "9900003"):
            m2["municipios"][cod] = ["X", "SP", m2["municipios"]["3509502"][2]]
        for cod in ("9900004", "9900005", "9900006"):
            c2["municipios"][cod] = copy.deepcopy(c2["municipios"]["3509502"])
        self.assertEqual([p for p in V.validar_cruzado(self.fixa, m2, self.cob) if "diferem" in p], [])
        self.assertTrue(any("telefonia móvel e cobertura diferem em 6" in p for p in V.validar_cruzado(self.fixa, m2, c2)))
        # a unidade da densidade: acessos ÷ densidade tem de reproduzir a população do Censo nos municípios grandes
        f = copy.deepcopy(self.fixa)
        i = f["campos"].index("acessos")
        f["municipios"]["3550308"][2][i] = 4_872_850                 # São Paulo real: 40,91 por 100 habitantes
        f["densidade"]["municipios"]["3550308"] = 40.91
        f["brasil"]["acessos"] = f["ufs"]["SP"][i] = 0               # (as somas são conferidas em validar_fixa, não aqui)
        self.assertEqual([p for p in V.validar_cruzado(f, self.movel, self.cob) if "população" in p], [])
        f["densidade"]["municipios"]["3550308"] = 97.5               # por 100 domicílios: razão 0,44, fora da faixa
        self.assertTrue(any("população" in p for p in V.validar_cruzado(f, self.movel, self.cob)))


class TestGoldSintetica(unittest.TestCase):
    def setUp(self):
        self.p1 = patch.object(F, "MUNICIPIOS_MIN", 1)
        self.p1.start()
        self.seeds = {"fixa": seed_fixa(), "movel": seed_movel(), "cobertura": seed_cobertura()}
        self.g, self.uf = gold.construir(self.seeds)

    def tearDown(self):
        self.p1.stop()

    def test_ausencia_de_tecnologia_fica_fora_das_contagens(self):
        # município sem o valor do 5G (e do 4G) não entra em "sem 5G" nem em "4G abaixo de 50%": ausência não é zero
        seeds = copy.deepcopy(self.seeds)
        pi = seeds["cobertura"]["municipios"]["2207777"][5]
        pi["g5"] = None
        pi["g4"] = None
        g, _uf = gold.construir(seeds)
        ufpi = lambda gold_: next(u for u in gold_["ufs"] if u["uf"] == "PI")  # noqa: E731
        self.assertEqual(ufpi(g)["cobertura"]["municipios_sem_5g"], 0)
        self.assertEqual(ufpi(g)["cobertura"]["municipios_4g_abaixo_50"], 0)
        # e sai também do universo de cada contagem, embora siga em municipios_com_dado (tem registro de cobertura)
        self.assertEqual(ufpi(g)["cobertura"]["municipios_com_5g_publicado"], ufpi(self.g)["cobertura"]["municipios_com_5g_publicado"] - 1)
        self.assertEqual(ufpi(g)["cobertura"]["municipios_com_4g_publicado"], ufpi(self.g)["cobertura"]["municipios_com_4g_publicado"] - 1)
        self.assertEqual(ufpi(g)["cobertura"]["municipios_com_dado"], ufpi(self.g)["cobertura"]["municipios_com_dado"])
        # e do universo do ranking daquela medida, por UF e no Brasil
        self.assertEqual(ufpi(g)["ranqueados"]["cobertura_g4_moradores"], ufpi(self.g)["ranqueados"]["cobertura_g4_moradores"] - 1)
        self.assertEqual(g["destaques"]["ranqueados"]["cobertura_g5_moradores"], self.g["destaques"]["ranqueados"]["cobertura_g5_moradores"] - 1)
        self.assertEqual(ufpi(g)["ranqueados"]["fixa_densidade"], ufpi(self.g)["ranqueados"]["fixa_densidade"])
        for n, q in self.g["distribuicao"].items():
            self.assertEqual(self.g["destaques"]["ranqueados"][n], q["n"] if q else 0)
        self.assertEqual(g["destaques"]["municipios_com_5g_publicado"], self.g["destaques"]["municipios_com_5g_publicado"] - 1)
        self.assertEqual(ufpi(self.g)["cobertura"]["municipios_sem_5g"], 0)       # com o valor (48%), também não é "sem 5G"
        pi2 = copy.deepcopy(self.seeds)
        pi2["cobertura"]["municipios"]["2207777"][5]["g5"] = [0.5, 0.5, 0.5]
        g2, _uf2 = gold.construir(pi2)
        self.assertEqual(ufpi(g2)["cobertura"]["municipios_sem_5g"], 1)

    def test_5g_acima_do_4g_e_contado_nao_corrigido(self):
        # a Anatel publica 5G acima do 4G em trimestres antigos de alguns municípios: a gold conta, declara e mantém os valores
        self.assertEqual(self.g["brasil"]["cobertura"]["g5_acima_do_4g"], {"pares": 0, "municipios": 0, "por_trimestre": {}, "trimestre_atual": 0})
        seeds = copy.deepcopy(self.seeds)
        pi = seeds["cobertura"]["municipios"]["2207777"]
        pi[8][0] = (pi[7][0] or 0) + 1
        g, uf = gold.construir(seeds)
        self.assertEqual(g["brasil"]["cobertura"]["g5_acima_do_4g"]["pares"], 1)
        self.assertEqual(g["brasil"]["cobertura"]["g5_acima_do_4g"]["municipios"], 1)
        self.assertEqual(g["brasil"]["cobertura"]["g5_acima_do_4g"]["por_trimestre"], {seeds["cobertura"]["trimestres"][0]: 1})
        m = next(x for x in uf["PI"]["municipios"] if x["id"] == "2207777")
        self.assertEqual(m["cobertura"]["trimestres_5g_acima_do_4g"], [seeds["cobertura"]["trimestres"][0]])
        self.assertEqual(m["cobertura"]["serie_g5_moradores"][0], pi[8][0])      # o valor publicado fica
        self.assertIn("pares município-trimestre", g["notas"]["cobertura"])

    def test_grade_de_trimestres_completa(self):
        # seed com 2025-12 e 2026-09: a grade ganha 2026-03 e 2026-06 vazios, e as séries seguem a grade
        self.assertEqual(self.g["trimestres_cobertura"], ["2025-12", "2026-03", "2026-06", "2026-09"])
        self.assertEqual(self.g["brasil"]["cobertura"]["trimestres"], ["2025-12", "2026-03", "2026-06", "2026-09"])
        self.assertEqual([v is None for v in self.g["brasil"]["cobertura"]["serie"]["g5"]], [False, True, True, False])
        pi = next(m for m in self.uf["PI"]["municipios"] if m["id"] == "2207777")
        self.assertEqual(pi["cobertura"]["serie_g4_moradores"], [57.0, None, None, 60.0])
        self.assertEqual(self.uf["PI"]["trimestres_cobertura"], self.g["trimestres_cobertura"])

    def test_partes_posicoes_e_ausencia(self):
        sp = next(m for m in self.uf["SP"]["municipios"] if m["id"] == "3550308")
        self.assertEqual((sp["fixa"]["acessos"], sp["fixa"]["fibra_pct"], sp["fixa"]["vel_100_mais_pct"], sp["fixa"]["prestadoras"]), (100, 60.0, 60.0, 2))
        self.assertEqual((sp["fixa"]["maior_grupo"], sp["fixa"]["maior_grupo_pct"], sp["fixa"]["densidade"]), ("TELEFONICA", 90.0, 38.85))
        self.assertEqual((sp["movel"]["acessos"], sp["movel"]["linhas"], sp["movel"]["g5_pct"], sp["movel"]["pre_pct"], sp["movel"]["m2m_pct"], sp["movel"]["densidade"]), (90, 100, 40.0, 50.0, 10.0, 151.2))
        self.assertEqual(sp["cobertura"]["tecnologias"]["g5"][0], 79.2)
        self.assertEqual(sp["cobertura"]["operadoras"]["VIVO"], {"g4g5_moradores": 89.1, "todas_moradores": 89.1})
        self.assertEqual(sp["posicao"]["fixa_densidade"], {"uf": 2, "brasil": 2})   # Campinas 40,0 > São Paulo 38,85 > Patos 22,4
        self.assertEqual(sp["ausencias"], [])
        self.assertEqual(self.g["destaques"]["municipios"], 3)
        self.assertEqual(self.g["ufs"][0]["uf"], "AC")
        self.assertIsNone(self.g["ufs"][0]["fixa"])
        sp_uf = next(u for u in self.g["ufs"] if u["uf"] == "SP")
        self.assertEqual((sp_uf["municipios"], sp_uf["fixa"]["acessos"], sp_uf["fixa"]["densidade"]), (2, 105, 38.9))
        # média da cobertura ponderada pelos moradores: (99 × 11451999 + 95 × 1139047) / soma
        self.assertAlmostEqual(sp_uf["cobertura"]["todas_moradores"], (99.0 * 11451999 + 95.0 * 1139047) / (11451999 + 1139047), places=2)
        self.assertEqual(self.g["brasil"]["fixa"]["acessos_mensal"]["acessos"][-1], 115)
        self.assertEqual(self.g["brasil"]["cobertura"]["serie"]["g5"], [70.68, None, None, 74.4])
        self.assertEqual(self.g["brasil"]["fixa"]["densidade"], 27.0)
        self.assertIn("habitantes", self.g["notas"]["densidade"])
        self.assertEqual(self.g["distribuicao"]["fixa_fibra_pct"]["n"], 3)

    def test_municipio_sem_cobertura_fica_null(self):
        seeds = copy.deepcopy(self.seeds)
        del seeds["cobertura"]["municipios"]["3509502"]
        seeds["cobertura"]["brasil"]["populacao"]["2026-09"]["moradores"] -= 1139047   # o Brasil da Anatel sem esse município
        g, uf = gold.construir(seeds)
        camp = next(m for m in uf["SP"]["municipios"] if m["id"] == "3509502")
        self.assertIsNone(camp["cobertura"])
        self.assertEqual(camp["ausencias"], ["cobertura"])
        self.assertEqual(g["destaques"]["sem_dado"]["cobertura"], ["3509502"])
        self.assertIsNone(camp["posicao"]["cobertura_g5_moradores"]["uf"])

    def test_hash_independe_da_proveniencia_do_zip(self):
        # a Anatel reempacota o zip sem mudar número: tamanho, data e crc mudam, o hash dos dados não
        seeds = copy.deepcopy(self.seeds)
        arq = seeds["fixa"]["arquivo"]
        arq["zip_bytes"] += 7
        arq["zip_modificado_em"] = "2030-01-01T00:00:00Z"
        for m in arq["membros"].values():
            m["modificado_no_zip"] = "2030-01-01T00:00:00"
            m["bytes"] += 1
            m["crc32"] = "deadbeef"
            m["sha256"] = "0" * 64
        g2, _ = gold.construir(seeds)
        self.assertEqual(g2["hash_dados"], self.g["hash_dados"])
        self.assertNotEqual(g2["fontes"]["fixa"]["zip_bytes"], self.g["fontes"]["fixa"]["zip_bytes"])

    def test_hash_independe_da_captura_e_gold_reprovada_nao_sai(self):
        seeds = copy.deepcopy(self.seeds)
        seeds["fixa"]["capturado_em"] = "2026-11-01T00:00:00Z"
        g2, _ = gold.construir(seeds)
        self.assertEqual(g2["hash_dados"], self.g["hash_dados"])
        self.assertNotEqual(g2["capturado_em"], self.g["capturado_em"])
        seeds["fixa"]["brasil"]["acessos"] += 1
        with self.assertRaises(gold.GoldInvalida):
            gold.construir(seeds)


@unittest.skipUnless(os.path.exists(GOLD), "gold da conectividade ainda não gerada")
class TestSeedsVersionados(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seeds = run.ler_seeds()
        with open(GOLD, encoding="utf-8") as f:
            cls.g = json.load(f)

    def test_seeds_passam_nas_validacoes(self):
        self.assertEqual(V.validar_fixa(self.seeds["fixa"]), [])
        self.assertEqual(V.validar_movel(self.seeds["movel"]), [])
        self.assertEqual(V.validar_cobertura(self.seeds["cobertura"]), [])
        self.assertEqual(V.validar_cruzado(self.seeds["fixa"], self.seeds["movel"], self.seeds["cobertura"]), [])

    def test_gold_versionada_e_a_dos_seeds(self):
        out = run.saidas(self.seeds)
        for caminho, texto in out.items():
            with open(caminho, encoding="utf-8") as f:
                self.assertEqual(f.read(), texto, str(caminho))
        self.assertEqual(sorted(p.name for p in run.PASTA_UF.glob("*.json")), [f"{uf}.json" for uf in F.UFS])

    def test_originais_identificados(self):
        for nome, f in self.g["fontes"].items():
            self.assertTrue(f["url"].startswith("https://www.anatel.gov.br/dadosabertos/"), nome)
            self.assertTrue(f["membros"], nome)
            for m in f["membros"]:
                self.assertRegex(m["sha256"], r"^[0-9a-f]{64}$")
                self.assertGreater(m["bytes"], 0)
            self.assertRegex(f["referencia"], r"^\d{4}-\d{2}$")

    def test_universo_e_somas(self):
        n = self.g["destaques"]["municipios"]
        self.assertTrue(F.MUNICIPIOS_MIN <= n <= F.MUNICIPIOS_MAX)
        ids = []
        for uf in F.UFS:
            with open(run.PASTA_UF / f"{uf}.json", encoding="utf-8") as f:
                arq = json.load(f)
            self.assertEqual(arq["uf"], uf)
            ids += [m["id"] for m in arq["municipios"]]
            for m in arq["municipios"]:
                self.assertEqual(F.UF_DO_PREFIXO[m["id"][:2]], uf)
                if m["fixa"]:
                    partes = sum(m["fixa"][k] or 0 for k in ("fibra_pct", "coaxial_pct", "radio_pct", "satelite_pct", "metalico_pct"))
                    self.assertAlmostEqual(partes, 100.0, delta=0.6, msg=m["id"])
                    self.assertTrue(m["fixa"]["densidade"] is None or 0 <= m["fixa"]["densidade"] <= F.DENSIDADE_MUNICIPIO_MAX)
                if m["cobertura"]:
                    self.assertEqual(len(m["cobertura"]["serie_g5_moradores"]), len(self.g["trimestres_cobertura"]))
        # a grade é completa entre o primeiro e o último trimestre publicado; o que a Anatel não publicou fica vazio
        tri = self.g["trimestres_cobertura"]
        self.assertEqual(tri, self.g["brasil"]["cobertura"]["trimestres"])
        self.assertTrue(all(int(t[5:7]) % 3 == 0 for t in tri[1:]))
        for faltante in ("2022-03", "2023-09", "2023-12"):
            self.assertIn(faltante, tri)
            self.assertIsNone(self.g["brasil"]["cobertura"]["serie"]["g5"][tri.index(faltante)])
        self.assertIsNotNone(self.g["brasil"]["cobertura"]["serie"]["g5"][tri.index("2024-03")])
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), n)
        self.assertEqual(sum(u["fixa"]["acessos"] for u in self.g["ufs"] if u["fixa"]), self.g["brasil"]["fixa"]["acessos"])
        self.assertEqual(sum(u["movel"]["acessos"] for u in self.g["ufs"] if u["movel"]), self.g["brasil"]["movel"]["acessos"])
        self.assertEqual(sum(u["movel"]["linhas"] for u in self.g["ufs"] if u["movel"]), self.g["brasil"]["movel"]["linhas"])
        self.assertEqual(sum(u["municipios"] for u in self.g["ufs"]), n)
        lo, hi = F.DENSIDADE_FIXA_BRASIL
        self.assertTrue(lo <= self.g["brasil"]["fixa"]["densidade"] <= hi)
        for x in ("sem_fibra", "uma_prestadora", "sem_5g", "g4_abaixo_50"):
            self.assertIsInstance(self.g["destaques"][x], int)
        # o universo das contagens de cobertura é o dos municípios com cobertura publicada, não o das três fontes
        d = self.g["destaques"]
        for tec in ("5g", "4g"):
            self.assertEqual(d[f"municipios_com_{tec}_publicado"], sum(u["cobertura"][f"municipios_com_{tec}_publicado"] for u in self.g["ufs"]))
            self.assertEqual(d[f"municipios_com_{tec}_publicado"], d["municipios"] - len(d["sem_dado"]["cobertura"]))   # na fixture, quem tem cobertura tem as duas
        self.assertLessEqual(d["sem_5g"], d["municipios_com_5g_publicado"])
        # universo dos agregados por fonte, por UF e no Brasil (20ª revisão do Codex)
        for x in ("fixa", "movel", "cobertura"):
            self.assertEqual(d["municipios_por_fonte"][x], d["municipios"] - len(d["sem_dado"][x]))
            self.assertEqual(d["municipios_por_fonte"][x], sum(u["municipios_por_fonte"][x] for u in self.g["ufs"]))
        self.assertLessEqual(d["g4_abaixo_50"], d["municipios_com_4g_publicado"])
        # a nota separa o que é da Anatel (Brasil) do que é cálculo da Scrutiniums (UFs)
        self.assertIn("evolucao_cobertura_brasil.csv", self.g["notas"]["cobertura"])
        self.assertNotIn("UF e Brasil", self.g["notas"]["cobertura"])


if __name__ == "__main__":
    unittest.main()
