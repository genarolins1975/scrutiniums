"""Testes do pipeline Previdência e INSS (pipeline/previdencia). Sem rede: tudo sai dos seeds versionados.

Os casos sintéticos provam que cada validação retém a publicação: mês faltando na série do BEPS, linha renomeada na
tabela 15, UF a menos na tabela 19, município que não fecha, ano municipal faltando, revisão acima do limite, RTN com
divisão urbana e rural que não soma, conta em % do PIB que não confere, e a conferência cruzada entre o arquivo
municipal e o BEPS. Provam também a regra de ausência: linha do RTN ainda não segregada vira null, não zero. No AEPS, as
edições anteriores (só atendimento e rede, um ano por edição) passam pelas mesmas somas por território, sem lacuna, e
um ano que se repete entre edições ou coletas não pode mudar além do limite de revisão.
"""
import copy
import json
import unittest
from unittest import mock
from datetime import date

from pipeline.previdencia import aeps, coleta, gold, run, validacoes
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


AEPS_HOJE = date(2026, 10, 21)


def _pagina_aeps(tid: str, cabecalho: str, linhas: list[list[str]], titulo: str | None = None) -> str:
    """Página no formato da saída do SAS que o portal publica: título, tabela com a classe "table" e rodapé."""
    corpo = "".join("<tr><th>" + l[0] + "</th>" + "".join(f"<td>{x}</td>" for x in l[1:]) + "</tr>" for l in linhas)
    return (
        '<span class="documentPublished"><span>Publicado em</span><span class="value">27/10/2021 15h18</span></span>'
        '<span class="documentModified"><span>Atualizado em</span><span class="value">22/10/2025 15h14</span></span>'
        f'<table class="systitleandfootercontainer"><tr><td class="c systemtitle2">{titulo or tid.upper() + " - Teste - 2024"}</td></tr></table>'
        f'<table class="table"><thead>{cabecalho}</thead><tbody>{corpo}</tbody></table>'
        '<table class="systitleandfootercontainer"><tr><td class="l systemfooter">FONTE: TESTE.</td></tr>'
        '<tr><td class="l systemfooter2">Nota de teste.</td></tr></table>'
    )


CAB_MESES = (
    '<tr><th rowspan="2">GRANDES REGIÕES E UNIDADES DA FEDERAÇÃO</th><th colspan="12">QUANTIDADE MENSAL DE ATENDIMENTOS</th></tr><tr>'
    + "".join(f"<th>{m}</th>" for m in ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"])
    + "</tr>"
)


def _linhas_territorio(valor=1) -> list[list[str]]:
    """Brasil, regiões e UFs na ordem do IBGE, cada UF com `valor` em todos os meses (as somas fecham)."""
    linhas = [["BRASIL"] + [str(27 * valor)] * 12]
    for r in F.REGIOES:
        ufs = [s for s in F.SIGLAS if F.REGIAO_UF[s] == r]
        linhas.append([r.upper()] + [str(len(ufs) * valor)] * 12)
        linhas += [[F.NOME_UF[s]] + [str(valor)] * 12 for s in ufs]
    return linhas


class TestAepsVersionado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()
        cls.g, _ = gold.construir(cls.s)

    def test_seed_passa_nas_validacoes_e_fecha_com_o_beps(self):
        self.assertEqual(validacoes.validar_aeps(self.s["aeps"], hoje=AEPS_HOJE), [])
        self.assertEqual(validacoes.validar_cruzado_aeps(self.s["beps"], self.s["aeps"]), [])

    def test_cada_tabela_com_endereco_oficial_hashes_e_datas(self):
        a = self.s["aeps"]
        self.assertGreaterEqual(a["edicao"], F.PRIMEIRA_EDICAO_AEPS)
        self.assertEqual(sorted(a["tabelas"]), sorted(F.TABELAS_AEPS))
        for tid, t in a["tabelas"].items():
            self.assertEqual(t["url"], aeps.url_tabela(tid, a["edicao"]))
            self.assertRegex(t["sha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(t["sha256_tabela"], r"^[0-9a-f]{64}$")
            self.assertRegex(t["atualizado_em"], r"^\d{4}-\d{2}-\d{2}$")
            self.assertTrue(t["capturado_em"].endswith("Z"))
            self.assertTrue(t["fonte"].upper().startswith("FONTE"))

    def test_gold_aeps_fecha_por_territorio_e_conserva_o_traco(self):
        a = self.g["aeps"]
        esp = {e["id"]: e for e in a["especies"]}
        # concessões: A.14 (soma das UFs) igual à A.1 (Brasil), nos três anos
        for k in range(3):
            self.assertEqual(sum(u["v"][k] for u in a["concessoes_uf"]["ufs"]), esp["total"]["concedidos"][k])
        # atendimento: a soma anual é a soma dos meses, e as UFs somam o Brasil
        self.assertEqual(a["atendimento"]["total"], sum(a["atendimento"]["brasil"]))
        self.assertEqual(sum(u["total"] for u in a["atendimento"]["ufs"]), a["atendimento"]["total"])
        self.assertEqual(len(a["rede"]["ufs"]), 27)
        # traço da fonte fica null: nenhum salário-família emitido ou concedido aparece como zero
        self.assertTrue(all(x is None for x in esp["salario_familia"]["emitidos"]))
        self.assertTrue(all(x is None for x in esp["salario_familia"]["concedidos"]))
        # o Regime Geral do Anuário é o do BEPS em cada dezembro
        for c in a["conferencia_beps"]:
            self.assertEqual(c["rgps_aeps"], c["rgps_beps"])
            self.assertEqual(c["pmv_epu_aeps"], c["ble_beps"])

    def test_atendimento_das_edicoes_anteriores_com_endereco_hashes_e_datas(self):
        a = self.s["aeps"]
        anteriores = a["anteriores"]
        self.assertEqual([x["edicao"] for x in anteriores], list(range(F.PRIMEIRA_EDICAO_ATENDIMENTO_AEPS, a["edicao"])))
        for x in anteriores:
            e = x["edicao"]
            self.assertEqual(x["raiz"], F.raiz_aeps(e))
            self.assertEqual(sorted(x["tabelas"]), sorted(F.tabelas_atendimento_aeps(e)))
            for tid, t in x["tabelas"].items():
                self.assertEqual(t["url"], aeps.url_tabela(tid, e))
                self.assertTrue(t["titulo"].startswith(f"{tid} - ") and t["titulo"].endswith(str(e)))
                self.assertEqual(t["anos"], [e])
                self.assertRegex(t["sha256"], r"^[0-9a-f]{64}$")
                self.assertRegex(t["sha256_tabela"], r"^[0-9a-f]{64}$")
                self.assertGreater(t["bytes"], 0)
                self.assertRegex(t["atualizado_em"], r"^\d{4}-\d{2}-\d{2}$")
                self.assertTrue(t["capturado_em"].endswith("Z"))
                self.assertTrue(t["fonte"].upper().startswith("FONTE"))
        # a edição 2022 está numa raiz própria do portal, e a rede dela fica fora da série, com o motivo
        self.assertIn("copy_of_onlinte-aeps-2022-", F.raiz_aeps(2022))
        self.assertEqual(F.tabelas_atendimento_aeps(2022), ("43.2",))

    def test_gold_traz_a_serie_do_atendimento_e_da_rede(self):
        a = self.g["aeps"]
        at, rede = a["atendimento"], a["rede"]
        self.assertEqual(at["anos"], list(range(F.PRIMEIRA_EDICAO_ATENDIMENTO_AEPS, a["edicao"] + 1)))
        self.assertEqual(rede["anos"], [x["edicao"] for x in self.s["aeps"]["anteriores"] if "43.1" in x["tabelas"]] + [a["edicao"]])
        for x in at["serie"]:
            self.assertEqual(x["total"], sum(x["brasil"]))
            self.assertEqual(len(x["brasil"]), 12)
            for m in range(12):  # em cada mês, as UFs somam o Brasil
                self.assertEqual(sum(u["v"][m] for u in x["ufs"]), x["brasil"][m])
            self.assertEqual(sum(u["total"] for u in x["ufs"]), x["total"])
        ultimo = at["serie"][-1]
        self.assertEqual((ultimo["ano"], ultimo["brasil"], ultimo["total"]), (at["ano"], at["brasil"], at["total"]))
        self.assertEqual(rede["serie"][-1]["brasil"], rede["brasil"])
        self.assertEqual([(x["edicao"], x["tabela"]) for x in a["fora_da_serie"]], [(2022, "43.1")])
        f = self.g["fontes"]["aeps"]["anteriores"]
        self.assertEqual([x["edicao"] for x in f], at["anos"][:-1])
        for x in f:
            for t in x["tabelas"].values():
                self.assertTrue(t["url"].startswith(F.raiz_aeps(x["edicao"])))

    def test_gold_traz_a_fonte_do_aeps(self):
        f = self.g["fontes"]["aeps"]
        self.assertEqual(f["edicao"], self.s["aeps"]["edicao"])
        self.assertEqual(f["pagina"], F.PAGINA_AEPS)
        self.assertEqual(set(f["tabelas"]), set(F.TABELAS_AEPS))


class TestAepsRetem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()

    def _a(self):
        return copy.deepcopy(self.s["aeps"])

    @staticmethod
    def _linha(a, tid, lid):
        return next(l for l in a["tabelas"][tid]["linhas"] if l["id"] == lid)

    def test_tabela_faltando(self):
        a = self._a()
        del a["tabelas"]["43.2"]
        self.assertTrue(any("sem as tabelas" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_partes_que_nao_somam_o_todo(self):
        a = self._a()
        self._linha(a, "a.1", "aux_doenca")["v"][2] += 5
        self._linha(a, "a.1", "aux_doenca")["v"][5] += 5
        self.assertTrue(any("não somam o todo" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_urbana_e_rural_que_nao_somam(self):
        a = self._a()
        self._linha(a, "b.1", "bpc_idoso")["v"][0] += 1
        self.assertTrue(any("urbana e rural" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_uf_que_nao_soma_o_brasil(self):
        a = self._a()
        self._linha(a, "43.2", "SP")["v"][4] += 10
        self.assertTrue(any("não somam" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_concessoes_a1_diferentes_da_a14(self):
        a = self._a()
        for l in a["tabelas"]["a.14"]["linhas"]:
            if l["id"] in ("brasil", "norte", "AC"):
                l["v"][0] += 1
                l["v"][3] += 1
        self.assertTrue(any("A.1 diferentes das da A.14" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_edicao_velha_ou_mais_antiga_que_a_publicada(self):
        a = self._a()
        self.assertTrue(any("velho demais" in p for p in validacoes.validar_aeps(a, hoje=date(2031, 1, 1))))
        anterior = self._a()
        anterior["edicao"] += 1
        self.assertTrue(any("mais antigo" in p for p in validacoes.validar_aeps(a, anterior, hoje=AEPS_HOJE)))

    def test_revisao_entre_edicoes_acima_do_limite(self):
        novo, anterior = self._a(), self._a()
        self._linha(anterior, "b.3", "total")["v"][1] *= 0.95
        self.assertTrue(any("revisão" in p for p in validacoes.validar_aeps(novo, anterior, hoje=AEPS_HOJE)))

    def test_edicao_anterior_com_ufs_que_nao_somam_o_brasil_num_mes(self):
        a = self._a()
        sp = next(l for l in a["anteriores"][0]["tabelas"]["43.2"]["linhas"] if l["id"] == "SP")
        sp["v"][7] += 10
        self.assertTrue(any(f"AEPS {a['anteriores'][0]['edicao']} 43.2: as UFs não somam" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_edicao_anterior_faltando_ou_fora_de_ordem(self):
        a = self._a()
        del a["anteriores"][-1]
        self.assertTrue(any("edições anteriores do atendimento" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))
        a = self._a()
        del a["anteriores"]
        self.assertTrue(any("sem as edições anteriores" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_tabela_fora_da_serie_nao_entra_e_tabela_de_outro_ano_reprova(self):
        a = self._a()
        a["anteriores"][0]["tabelas"]["43.1"] = copy.deepcopy(a["anteriores"][1]["tabelas"]["43.1"])
        self.assertTrue(any("esperadas ['43.2']" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))
        a = self._a()
        a["anteriores"][1]["tabelas"]["43.2"]["titulo"] = a["anteriores"][1]["tabelas"]["43.2"]["titulo"][:-4] + "2024"
        self.assertTrue(any("tabela de outro ano" in p for p in validacoes.validar_aeps(a, hoje=AEPS_HOJE)))

    def test_ano_que_se_sobrepoe_entre_edicoes_ou_coletas_acima_do_limite(self):
        novo, anterior = self._a(), self._a()
        for l in anterior["anteriores"][1]["tabelas"]["43.2"]["linhas"]:
            l["v"] = [round(x * 1.05) for x in l["v"]]
        self.assertTrue(any("revisão" in p and "atendimentos no ano" in p for p in validacoes.validar_aeps(novo, anterior, hoje=AEPS_HOJE)))
        # a mesma coleta repetida não reprova
        self.assertEqual(validacoes.validar_aeps(novo, self._a(), hoje=AEPS_HOJE), [])

    def test_gold_nao_e_construida_com_edicao_anterior_reprovada(self):
        s = copy.deepcopy(self.s)
        rj = next(l for l in s["aeps"]["anteriores"][0]["tabelas"]["43.2"]["linhas"] if l["id"] == "RJ")
        rj["v"][0] = None
        with self.assertRaises(gold.GoldInvalida):
            gold.construir(s)

    def test_coleta_guarda_a_captura_anterior_se_a_edicao_nao_responde(self):
        a = self._a()
        with mock.patch.object(aeps, "coletar_atendimento", side_effect=RuntimeError("404")):
            out = aeps._anteriores(a["edicao"], a)
        self.assertEqual(out, a["anteriores"])
        # numa edição nova, a principal de antes passa a anterior só com o atendimento e a rede
        with mock.patch.object(aeps, "coletar_atendimento", side_effect=RuntimeError("404")):
            out = aeps._anteriores(a["edicao"] + 1, a)
        self.assertEqual([x["edicao"] for x in out], list(range(F.PRIMEIRA_EDICAO_ATENDIMENTO_AEPS, a["edicao"] + 1)))
        self.assertEqual(sorted(out[-1]["tabelas"]), ["43.1", "43.2"])
        self.assertEqual(out[-1]["tabelas"]["43.2"], a["tabelas"]["43.2"])

    def test_cruzada_reprova_regime_geral_diferente_do_beps(self):
        a = self._a()
        self._linha(a, "b.1", "rgps")["v"][1] += 1
        self.assertTrue(any("Regime Geral no AEPS" in p for p in validacoes.validar_cruzado_aeps(self.s["beps"], a)))

    def test_gold_nao_e_construida_com_aeps_reprovado(self):
        s = copy.deepcopy(self.s)
        self._linha(s["aeps"], "a.1", "pensoes")["v"][0] += 7
        with self.assertRaises(gold.GoldInvalida):
            gold.construir(s)


class TestAepsLeitura(unittest.TestCase):
    def test_numero_do_aeps(self):
        self.assertEqual(aeps.numero_aeps("1.570"), 1570)
        self.assertEqual(aeps.numero_aeps("37.623.943"), 37623943)
        self.assertEqual(aeps.numero_aeps("12,5"), 12.5)
        for v in ("-", "...", ""):
            self.assertIsNone(aeps.numero_aeps(v))
        with self.assertRaises(ValueError):
            aeps.numero_aeps("1,2,3")

    def test_le_tabela_por_mes_com_datas_rodape_e_hash(self):
        t = aeps.ler_tabela(_pagina_aeps("43.2", CAB_MESES, _linhas_territorio()), "43.2", 2024)
        self.assertEqual(t["atualizado_em"], "2025-10-22")
        self.assertEqual(t["publicado_em"], "2021-10-27")
        self.assertEqual(t["fonte"], "FONTE: TESTE.")
        self.assertEqual(t["notas"], "Nota de teste.")
        self.assertRegex(t["sha256_tabela"], r"^[0-9a-f]{64}$")
        self.assertEqual([l["id"] for l in t["linhas"]][:3], ["brasil", "norte", "RO"])
        self.assertEqual(t["linhas"][0]["v"], [27] * 12)

    def test_traco_vira_nulo_e_nao_zero(self):
        linhas = _linhas_territorio()
        linhas[2][5] = "-"
        t = aeps.ler_tabela(_pagina_aeps("43.2", CAB_MESES, linhas), "43.2", 2024)
        self.assertIsNone(t["linhas"][2]["v"][4])

    def test_cabecalho_sem_os_doze_meses_reprova(self):
        cab = CAB_MESES.replace("<th>Dezembro</th>", "<th>Total</th>")
        with self.assertRaises(ValueError):
            aeps.ler_tabela(_pagina_aeps("43.2", cab, _linhas_territorio()), "43.2", 2024)

    def test_territorio_fora_de_ordem_reprova(self):
        linhas = _linhas_territorio()
        linhas[2], linhas[3] = linhas[3], linhas[2]
        with self.assertRaises(ValueError):
            aeps.ler_tabela(_pagina_aeps("43.2", CAB_MESES, linhas), "43.2", 2024)

    def test_titulo_de_outra_tabela_ou_outro_ano_reprova(self):
        with self.assertRaises(ValueError):
            aeps.ler_tabela(_pagina_aeps("43.2", CAB_MESES, _linhas_territorio(), titulo="43.1 - Outra - 2024"), "43.2", 2024)
        with self.assertRaises(ValueError):
            aeps.ler_tabela(_pagina_aeps("43.2", CAB_MESES, _linhas_territorio(), titulo="43.2 - Teste - 2023"), "43.2", 2024)

    def test_especies_com_anos_da_edicao_e_linhas_esperadas(self):
        anos = "".join(f"<th>{a}</th>" for a in (2022, 2023, 2024)) * 3
        cab = (
            '<tr><th rowspan="4">GRUPOS DE ESPÉCIES</th><th colspan="9">QUANTIDADE</th></tr>'
            '<tr><th colspan="3" rowspan="2">Total</th><th colspan="6">Clientela</th></tr>'
            '<tr><th colspan="3">Urbana</th><th colspan="3">Rural</th></tr>'
            f"<tr>{anos}</tr>"
        )
        linhas = [[r] + ["1"] * 9 for _i, r, _p in F.ESPECIES_AEPS]
        t = aeps.ler_tabela(_pagina_aeps("a.1", cab, linhas, titulo="A.1 - Teste - 2022/2024"), "a.1", 2024)
        self.assertEqual([l["id"] for l in t["linhas"]], [i for i, _r, _p in F.ESPECIES_AEPS])
        with self.assertRaises(ValueError):  # a edição seguinte traria 2023 a 2025
            aeps.ler_tabela(_pagina_aeps("a.1", cab, linhas, titulo="A.1 - Teste - 2022/2024"), "a.1", 2025)
        linhas[4][0] = "Programada"
        with self.assertRaises(ValueError):
            aeps.ler_tabela(_pagina_aeps("a.1", cab, linhas, titulo="A.1 - Teste - 2022/2024"), "a.1", 2024)


if __name__ == "__main__":
    unittest.main()
