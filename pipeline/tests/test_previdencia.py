"""Testes do pipeline Previdência e INSS (pipeline/previdencia). Sem rede: tudo sai dos seeds versionados.

Os casos sintéticos provam que cada validação retém a publicação: mês faltando na série do BEPS, linha renomeada na
tabela 15, UF a menos na tabela 19, município que não fecha, ano municipal faltando, revisão acima do limite, RTN com
divisão urbana e rural que não soma, conta em % do PIB que não confere, e a conferência cruzada entre o arquivo
municipal e o BEPS. Provam também a regra de ausência: linha do RTN ainda não segregada vira null, não zero.
"""
import copy
import json
import unittest
from datetime import date

from pipeline.previdencia import coleta, gold, run, validacoes
from pipeline.previdencia import fontes as F


def seeds():
    return run.ler_seeds()


HOJE = date(2026, 10, 20)


class TestSeedsVersionados(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()

    def test_seeds_passam_em_todas_as_validacoes(self):
        self.assertEqual(validacoes.validar_beps(self.s["beps"]), [])
        self.assertEqual(validacoes.validar_municipios(self.s["municipios"]), [])
        self.assertEqual(validacoes.validar_rtn(self.s["rtn"]), [])
        self.assertEqual(validacoes.validar_cruzado(self.s["beps"], self.s["municipios"]), [])

    def test_publicacao_versionada_e_a_dos_seeds(self):
        out = run.saidas(self.s)
        self.assertEqual(len(out), 28)  # a gold e um arquivo por UF
        for caminho, texto in out.items():
            self.assertTrue(caminho.exists(), caminho)
            self.assertEqual(caminho.read_bytes().decode("utf-8"), texto, f"{caminho} não é a dos seeds: rode python3 -m pipeline.previdencia.run")

    def test_originais_com_sha256_e_endereco_oficial(self):
        b, m, r = self.s["beps"], self.s["municipios"], self.s["rtn"]
        self.assertTrue(b["arquivo"]["url"].startswith(F.PAGINA_BEPS))
        self.assertRegex(b["arquivo"]["sha256"], r"^[0-9a-f]{64}$")
        for a in m["anos"]:
            self.assertEqual(a["arquivo"]["url"], F.URL_MUNICIPIOS.format(ano=a["ano"]))
            self.assertRegex(a["arquivo"]["sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(r["arquivo"]["url"].startswith("https://www.tesourotransparente.gov.br/"))
        self.assertRegex(r["edicao"], r"^\d{4}-\d{2}$")
        for fonte in self.s.values():
            self.assertTrue(fonte["capturado_em"].endswith("Z"))

    def test_municipios_desde_2019_sem_lacuna(self):
        anos = [a["ano"] for a in self.s["municipios"]["anos"]]
        self.assertEqual(anos[0], 2019)
        self.assertEqual(anos, list(range(2019, anos[-1] + 1)))


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()
        cls.g, cls.ufs = gold.construir(cls.s)

    def test_dezembro_municipal_fecha_com_o_beps(self):
        g = self.g
        serie = dict(zip(g["serie"]["meses"], range(len(g["serie"]["meses"]))))
        for ano in g["anual"]["anos"]:
            i = serie[f"{ano}-12"]
            br = g["anual"]["brasil"][str(ano)]
            self.assertEqual(br["q"][0], g["serie"]["q"]["total"][i], ano)
            self.assertEqual(br["q"][1], g["serie"]["q"]["rgps"][i], ano)

    def test_ufs_somam_o_brasil(self):
        g = self.g
        for ano in g["anual"]["anos"]:
            soma = [sum(g["anual"]["ufs"][s][str(ano)]["q"][k] for s in F.SIGLAS) for k in range(len(gold.CAMPOS_Q_GOLD))]
            self.assertEqual(soma, g["anual"]["brasil"][str(ano)]["q"], ano)
        t = g["ufs_mes"]
        self.assertEqual(sum(u["q"] for u in t["ufs"]), t["brasil"]["q"])
        self.assertEqual(len(t["ufs"]), 27)
        self.assertGreaterEqual(t["sem_localizacao"], 0)

    def test_arquivos_por_uf_cobrem_todos_os_municipios(self):
        total = sum(len(d["municipios"]) for d in self.ufs.values())
        self.assertEqual(total, self.g["municipios"]["total"])
        ultimo = self.s["municipios"]["anos"][-1]
        self.assertEqual(total, len(ultimo["municipios"]))
        for uf, d in self.ufs.items():
            for m in d["municipios"]:
                self.assertEqual(F.UF_DO_PREFIXO[m["id"][:2]], uf)
                self.assertEqual(len(m["q"]), len(d["anos"]))

    def test_municipio_novo_tem_ausencia_nos_anos_anteriores(self):
        # município instalado depois de 2019 (se houver) aparece com null nos anos em que não existia, nunca com zero
        for d in self.ufs.values():
            for m in d["municipios"]:
                for q in m["q"]:
                    self.assertTrue(q is None or all(isinstance(x, int) for x in q))

    def test_tipos_do_mes_somam_e_valor_medio_e_valor_sobre_quantidade(self):
        tipos = {t["id"]: t for t in self.g["brasil_mes"]["tipos"]}
        self.assertEqual(tipos["total"]["q"], tipos["rgps"]["q"] + tipos["assistenciais"]["q"] + tipos["ble"]["q"])
        for t in tipos.values():
            self.assertAlmostEqual(t["medio"], round(t["v"] / t["q"], 2), places=2)

    def test_resultado_do_rgps_e_arrecadacao_menos_beneficios(self):
        r = self.g["rgps"]
        for i, ano in enumerate(r["anos"]):
            self.assertAlmostEqual(r["resultado"][i], round(r["arrecadacao"][i] - r["beneficios"][i], 1), places=1)
            if r["resultado_urbano"][i] is not None:
                self.assertAlmostEqual(r["resultado_urbano"][i] + r["resultado_rural"][i], r["resultado"][i], delta=1.0)

    def test_linha_ainda_nao_segregada_vira_ausencia_nao_zero(self):
        r = self.g["rgps"]
        i0 = r["anos"].index(r["inicio_divisao_urbana_rural"])
        self.assertGreater(i0, 0)
        self.assertTrue(all(x is None for x in r["beneficios_urbano"][:i0]))
        self.assertTrue(all(x is not None for x in r["beneficios_urbano"][i0:]))
        ib = r["anos"].index(r["inicio_bpc"])
        self.assertTrue(all(x is None for x in r["bpc_rmv"][:ib]))

    def test_hash_nao_depende_da_data_de_captura(self):
        s = copy.deepcopy(self.s)
        for f in s.values():
            f["capturado_em"] = "2030-01-01T00:00:00Z"
        g2, _ = gold.construir(s)
        self.assertEqual(g2["hash_dados"], self.g["hash_dados"])
        self.assertNotEqual(g2["capturado_em"], self.g["capturado_em"])

    def test_gold_reprovada_nao_e_construida(self):
        s = copy.deepcopy(self.s)
        s["beps"]["tabela14"]["serie"].pop(-5)
        with self.assertRaises(gold.GoldInvalida):
            gold.construir(s)


class TestValidacoesRetem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()

    def test_mes_faltando_na_serie(self):
        b = copy.deepcopy(self.s["beps"])
        del b["tabela14"]["serie"][-10]
        self.assertTrue(any("mês faltando" in p for p in validacoes.validar_beps(b)))

    def test_total_da_serie_que_nao_fecha(self):
        b = copy.deepcopy(self.s["beps"])
        b["tabela14"]["serie"][-1]["q"]["rgps"] += 1
        self.assertTrue(validacoes.validar_beps(b))

    def test_linha_renomeada_na_tabela_15(self):
        b = copy.deepcopy(self.s["beps"])
        b["tabela15"]["linhas"][4]["rotulo"] = "Programada"
        self.assertTrue(any("tabela 15" in p for p in validacoes.validar_beps(b)))

    def test_partes_que_nao_somam_na_tabela_15(self):
        b = copy.deepcopy(self.s["beps"])
        b["tabela15"]["linhas"][5]["q"] += 3
        b["tabela15"]["linhas"][5]["q_urbana"] += 3
        self.assertTrue(any("não somam" in p for p in validacoes.validar_beps(b)))

    def test_uf_a_menos_na_tabela_19(self):
        b = copy.deepcopy(self.s["beps"])
        del b["tabela19"]["ufs"]["AC"]
        self.assertTrue(any("27 UFs" in p for p in validacoes.validar_beps(b)))

    def test_beps_mais_antigo_que_o_publicado(self):
        b = copy.deepcopy(self.s["beps"])
        anterior = {"referencia": "2099-01"}
        self.assertTrue(any("mais antigo" in p for p in validacoes.validar_beps(b, anterior)))

    def test_municipio_que_nao_fecha(self):
        m = copy.deepcopy(self.s["municipios"])
        cod = next(iter(m["anos"][-1]["municipios"]))
        m["anos"][-1]["municipios"][cod][1][0] += 1
        self.assertTrue(any("aposentadorias não fecham" in p for p in validacoes.validar_municipios(m, hoje=HOJE)))

    def test_quantidade_ausente_nao_vira_zero(self):
        m = copy.deepcopy(self.s["municipios"])
        cod = next(iter(m["anos"][-1]["municipios"]))
        m["anos"][-1]["municipios"][cod][1][3] = None
        self.assertTrue(any("ausente" in p for p in validacoes.validar_municipios(m, hoje=HOJE)))

    def test_ano_municipal_faltando(self):
        m = copy.deepcopy(self.s["municipios"])
        del m["anos"][2]
        self.assertTrue(any("fora de sequência" in p for p in validacoes.validar_municipios(m, hoje=HOJE)))

    def test_revisao_acima_do_limite(self):
        novo = copy.deepcopy(self.s["municipios"])
        anterior = copy.deepcopy(self.s["municipios"])
        for linha in list(anterior["anos"][0]["municipios"].values())[:600]:
            linha[3] += 1000
        self.assertTrue(any("revisão" in p for p in validacoes.validar_municipios(novo, anterior, hoje=HOJE)))

    def test_cruzada_reprova_municipios_que_nao_somam_o_beps(self):
        m = copy.deepcopy(self.s["municipios"])
        linha = next(iter(m["anos"][-1]["municipios"].values()))
        linha[1][6] += 1
        linha[3] += 1
        self.assertTrue(validacoes.validar_cruzado(self.s["beps"], m))

    def test_rtn_divisao_que_nao_soma(self):
        r = copy.deepcopy(self.s["rtn"])
        r["linhas"]["beneficios_rural"][-1] += 10
        self.assertTrue(any("urbano e rural" in p for p in validacoes.validar_rtn(r, hoje=HOJE)))

    def test_rtn_pct_do_pib_que_nao_confere(self):
        r = copy.deepcopy(self.s["rtn"])
        r["pib"][-1] *= 1.01
        self.assertTrue(any("% do PIB" in p for p in validacoes.validar_rtn(r, hoje=HOJE)))

    def test_rtn_revisao_de_ano_fechado(self):
        novo = copy.deepcopy(self.s["rtn"])
        anterior = copy.deepcopy(self.s["rtn"])
        anterior["linhas"]["beneficios"][-3] *= 0.9
        self.assertTrue(any("revisto" in p for p in validacoes.validar_rtn(novo, anterior, hoje=HOJE)))

    def test_rtn_velho_demais(self):
        self.assertTrue(any("velho demais" in p for p in validacoes.validar_rtn(self.s["rtn"], hoje=date(2031, 1, 1))))


class TestLeitura(unittest.TestCase):
    def test_normalizar_tira_acento_nota_e_pontuacao(self):
        self.assertEqual(coleta.normalizar("Salário-Maternidade"), "salario maternidade")
        self.assertEqual(coleta.normalizar("Outros benefícios assistenciais(2)"), "outros beneficios assistenciais")
        self.assertEqual(coleta.normalizar("BENEFÍCIOS DE LEGISLAÇÃO ESPECÍFICA (BLE) (3)"), "beneficios de legislacao especifica ble")

    def test_numero_ausente_e_nulo(self):
        for v in (None, "", "-", "...", "#N/A", "texto"):
            self.assertIsNone(coleta.numero(v))
        self.assertEqual(coleta.numero(0), 0.0)
        self.assertEqual(coleta.numero("1.234,5"), 1234.5)

    def test_codigo_da_linha_do_rtn(self):
        self.assertEqual(coleta._codigo("1.3 -  Arrecadação Líquida para o RGPS"), "1.3")
        self.assertEqual(coleta._codigo("4.1.1.1 Sent. Judiciais"), "4.1.1.1")
        self.assertEqual(coleta._codigo("4. DESPESA TOTAL"), "4")
        self.assertIsNone(coleta._codigo("Memorando"))

    def test_papel_das_abas_municipais(self):
        self.assertEqual(coleta._papel_da_aba("Qtd_dez2025", ""), "q")
        self.assertEqual(coleta._papel_da_aba("Quantidade - dez19", ""), "q")
        self.assertEqual(coleta._papel_da_aba("Valor_R$_dez25", "Valor líquido"), "v")
        self.assertEqual(coleta._papel_da_aba("Valor (R$) - dez19", "Valor líquido"), "v")
        self.assertEqual(coleta._papel_da_aba("Valor_Médio_R$_dez24", "Valor líquido médio"), "medio")
        self.assertEqual(coleta._papel_da_aba("Valor_Total_2025", "Valor líquido ... Ano de 2025"), "ano")
        self.assertEqual(coleta._papel_da_aba("Valor (R$) - 2019", "Valor líquido"), "ano")

    def test_tabela_15_esperada_tem_ids_unicos_e_pais_existentes(self):
        ids = [i for i, _r, _p in F.TABELA_15]
        self.assertEqual(len(ids), len(set(ids)))
        for _i, _r, pai in F.TABELA_15:
            self.assertTrue(pai is None or pai in ids)


if __name__ == "__main__":
    unittest.main()
