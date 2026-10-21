"""Bases complementares de segurança alimentar (pipeline/eficiencia_alimentar/complementos.py).

Sem rede. Cada teste cobre um erro plausível: hífen do SIDRA virando zero, ausência do PAA virando
zero, percentual agregado como média de percentuais, rede estadual confundida com municipal,
município associado por semelhança de nome, gold de outro seed e publicação com ficha incompleta.
"""
import copy
import gzip
import json
import re
import tempfile
import unittest
from pathlib import Path

from pipeline.eficiencia_alimentar import complementos as c

MUNICIPIOS = {
    "2611606": {"nome": "Recife", "uf": "PE", "uf_id": "26", "uf_nome": "Pernambuco", "regiao": "Nordeste"},
    "2600054": {"nome": "Abreu e Lima", "uf": "PE", "uf_id": "26", "uf_nome": "Pernambuco", "regiao": "Nordeste"},
    "3550308": {"nome": "São Paulo", "uf": "SP", "uf_id": "35", "uf_nome": "São Paulo", "regiao": "Sudeste"},
}


def _sidra(linhas, variaveis):
    cab = {"NC": "Nível Territorial (Código)", "D4N": "Situação do domicílio", "D5N": "Situação de segurança alimentar existente no domicílio"}
    rows = [cab]
    for nc, d1c, d1n, ano, situacao, classe, valores in linhas:
        for var, v in zip(variaveis, valores):
            rows.append({"NC": nc, "D1C": d1c, "D1N": d1n, "D2C": var, "D3C": ano, "D4N": situacao, "D5C": classe, "V": v})
    return json.dumps(rows).encode()


class LeitoresTest(unittest.TestCase):
    def test_ebia_hifen_de_uf_urbana_nao_vira_zero_e_hifen_publicado_reprova(self):
        classes = [("109106", "100.0"), ("109098", "64.7"), ("109099", "35.3"), ("109100", "23.0"), ("109101", "7.4"), ("109102", "4.9")]
        linhas = [("3", "26", "Pernambuco", "2024", "Total", k, (v, "1.0")) for k, v in classes]
        linhas += [("3", "26", "Pernambuco", "2024", "Urbana", k, ("-", "-")) for k, _ in classes]
        qtd = [("3", "26", "Pernambuco", "2024", "Total", k, ("100", "1.0")) for k, _ in classes]
        qtd += [("3", "26", "Pernambuco", "2024", "Urbana", k, ("-", "-")) for k, _ in classes]
        out = c.ler_ebia(_sidra(linhas, ["9784", "9785"]), _sidra(qtd, ["162", "5123"]))
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["situacao"], "total")
        self.assertEqual(out[0]["classes"]["insegura"]["pct"], 35.3)
        quebrado = [(a, b, d, e, f, k, ("-", "1.0") if k == "109102" else v) for a, b, d, e, f, k, v in linhas[:6]]
        with self.assertRaises(ValueError):
            c.ler_ebia(_sidra(quebrado, ["9784", "9785"]), _sidra(qtd[:6], ["162", "5123"]))
        publicado = linhas[:6] + [("3", "26", "Pernambuco", "2024", "Urbana", "109106", ("100.0", "1.0"))]
        with self.assertRaises(ValueError):
            c.ler_ebia(_sidra(publicado, ["9784", "9785"]), _sidra(qtd, ["162", "5123"]))

    def test_cadinsan_le_linha_quebrada_e_recusa_codigo_desconhecido(self):
        texto = "".join(f"{cod}   Nordeste   Pernambuco   Muni\n   nome longo   10   20   100   10,0%   20,0%\n" for cod in ["2611606"] * 1)
        with self.assertRaises(ValueError):  # cobertura diferente de 5.570
            c.ler_cadinsan(texto, MUNICIPIOS)
        with self.assertRaises(ValueError):
            c.ler_cadinsan("9999999   Norte   X   Y   1   2   3   1,0%   2,0%\n", MUNICIPIOS)
        bloco = c._VALORES.search("   nome longo   10   20   100   10,0%   20,0%")
        self.assertEqual(bloco.groups(), ("10", "20", "100", "10,0", "20,0"))

    def test_paa_ausente_fica_none_e_duplicado_reprova(self):
        docs = [{"codigo_ibge": 261160, "anomes_s": "202412", "agricultores_fornec_paa_i": 12, "recur_pagos_agricul_paa_f": 1000.5},
                {"codigo_ibge": 260005, "anomes_s": "202412"}]
        raw = json.dumps({"response": {"numFound": 2, "docs": docs}}).encode()
        out = c.ler_paa({2024: raw}, MUNICIPIOS)["2024"]
        self.assertEqual(out, [["2600054", None, None], ["2611606", 12, 1000.5]])
        dup = json.dumps({"response": {"numFound": 3, "docs": docs + [docs[0]]}}).encode()
        with self.assertRaises(ValueError):
            c.ler_paa({2024: dup}, MUNICIPIOS)
        truncado = json.dumps({"response": {"numFound": 5, "docs": docs}}).encode()
        with self.assertRaises(ValueError):
            c.ler_paa({2024: truncado}, MUNICIPIOS)

    def test_pnae_redes_nome_exato_e_repasse_ausente(self):
        cab = "Ano_Exercicio;UF;Municipio;Entidade_Responsavel;CNPJ_Responsavel;Quantidade_Alunos;Quantidade_Escolas;Valor_Repasse"
        linhas = [cab,
                  "2025;PE;RECIFE;PREF MUN DO RECIFE;1;100;2;50.00",
                  "2025;PE;ABREU E LIMA;PREF MUN DE ABREU E LIMA;2;40;1",
                  "2025;PE;RECIFE;SECRETARIA DE EDUCACAO DO ESTADO;3;300;5;150.00",
                  "2025;SP;SAO PAULO DO NORTE;PREF MUN;4;10;1;5.00"]
        raw = gzip.compress(("\n".join(linhas) + "\n").encode())
        out = c.ler_pnae(raw, MUNICIPIOS)
        ag = {tuple(a[:3]): a for a in out["agregados"]}
        self.assertEqual(ag[(2025, "PE", "municipal")][3:], [2, 1, 140, 3, 50.0])
        self.assertEqual(ag[(2025, "PE", "estadual")][3:], [1, 1, 300, 5, 150.0])
        self.assertEqual(ag[(2025, "PE", "todas")][5], 440)
        self.assertEqual(out["repasses_ausentes"], 1)
        self.assertEqual([r[0] for r in out["municipal_2025"]], ["2600054", "2611606"])
        self.assertIsNone(out["municipal_2025"][0][3])
        self.assertEqual(out["nao_conciliados_2025"], [{"uf": "SP", "municipio": "SAO PAULO DO NORTE", "cnpj": "4"}])
        duas = gzip.compress(("\n".join(linhas + ["2025;PE;RECIFE;SECRETARIA DA FAZENDA;5;1;1;1.00"]) + "\n").encode())
        with self.assertRaises(ValueError):
            c.ler_pnae(duas, MUNICIPIOS)

    def test_sisvan_exige_a_tabela_10_e_as_cinco_fases(self):
        pagina = "Tabela 10 – Estado Nutricional\n" + "\n".join(f"{f}   1.000   10,5%" for f in c._FASES) + "\n* As gestantes não estão contabilizadas."
        self.assertEqual(c.ler_sisvan(pagina)[0], ["Crianças menores de 5 anos", 1000, 10.5])
        with self.assertRaises(ValueError):
            c.ler_sisvan(pagina.replace("Idosos", "Idosas"))


class SeedEGoldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rec, cls.manifesto = c.le_seed()
        cls.catalogo = c.le_catalogo()

    def test_seed_valido_e_coberturas(self):
        municipios = c.valida(self.rec)
        self.assertGreaterEqual(len(municipios), 5570)
        self.assertEqual(len(self.rec["cadinsan"]), 5570)
        self.assertEqual(sorted(self.rec["paa"]), ["2023", "2024", "2025"])
        self.assertEqual(len(self.rec["ebia"]), 90)
        self.assertEqual(self.manifesto["capturado_em"], "2026-10-21")
        self.assertTrue(all(f.get("sha256") or f.get("conteudo") for f in self.manifesto["fontes"]))

    def test_valores_sentinela_publicados(self):
        br24 = next(e for e in self.rec["ebia"] if e["nivel"] == "brasil" and e["ano"] == 2024 and e["situacao"] == "total")
        self.assertEqual(br24["classes"]["insegura"]["pct"], 24.2)  # informativo IBGE, página 6
        self.assertEqual(br24["classes"]["grave"]["pct"], 3.2)
        recife = next(r for r in self.rec["cadinsan"] if r[0] == "2611606")
        self.assertEqual(len(recife), 7)
        self.assertEqual([s[1] for s in self.rec["sisvan"]], [7632982, 6345278, 8481412, 29699309, 11684189])

    def test_agregado_cadinsan_e_razao_de_somas_nao_media(self):
        gold = c.agrega(self.rec, self.manifesto, self.catalogo)
        br = gold["cadinsan"]["brasil"]
        self.assertEqual(br["cadastros"], 21236683)
        self.assertEqual(br["com_pbf"], 2390937)
        self.assertEqual(br["pct_com_pbf"], round(100 * 2390937 / 21236683, 1))
        media = sum(r[4] for r in self.rec["cadinsan"]) / 5570
        self.assertNotAlmostEqual(br["pct_com_pbf"], round(media, 1), places=1)
        self.assertEqual(gold["cadinsan"]["divergencias_cenario"], 270)

    def test_paa_soma_so_o_que_tem_dado_e_declara_cobertura(self):
        gold = c.agrega(self.rec, self.manifesto, self.catalogo)
        a = gold["paa"]["2025"]["brasil"]
        com_dado = [r for r in self.rec["paa"]["2025"] if r[1] is not None]
        self.assertEqual(a["fornecedores"]["municipios_com_dado"], len(com_dado))
        self.assertLess(len(com_dado), a["municipios_universo"])
        self.assertEqual(a["fornecedores"]["soma"], sum(r[1] for r in com_dado))

    def test_gold_versionada_e_do_mesmo_seed(self):
        gold = json.loads(c.GOLD.read_text())
        self.assertEqual(gold, json.loads(json.dumps(c.agrega(self.rec, self.manifesto, self.catalogo))))

    def test_portao_impede_publicar_com_ficha_incompleta_ou_seed_alterado(self):
        cat = copy.deepcopy(self.catalogo)
        del cat["indicadores"][0]["limitacoes"]
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "gold.json"
            with self.assertRaises(ValueError):
                c.promove(self.rec, self.manifesto, cat, destino)
            sem_motivo = copy.deepcopy(self.catalogo)
            sem_motivo["nao_integrados"][0]["motivo"] = ""
            with self.assertRaises(ValueError):
                c.promove(self.rec, self.manifesto, sem_motivo, destino)
            rec = copy.deepcopy(self.rec)
            rec["pnae"]["agregados"][0][5] += 1  # rede deixa de fechar com o total
            with self.assertRaises(ValueError):
                c.promove(rec, self.manifesto, self.catalogo, destino)
            self.assertFalse(destino.exists())

    def test_fichas_sem_julgamento(self):
        texto = json.dumps(self.catalogo, ensure_ascii=False).lower()
        for termo in (r"\bineficiente", r"\beficiente", r"desperdício", r"taxa de sucesso", r"melhor desempenho", r"pior desempenho"):
            self.assertIsNone(re.search(termo, texto), termo)
        for f in self.catalogo["indicadores"]:
            self.assertIn(f["capitulo"], {"necessidades", "acesso", "qualidade", "recursos"})


if __name__ == "__main__":
    unittest.main()
