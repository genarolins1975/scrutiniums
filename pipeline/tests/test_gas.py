"""Testes do pipeline do Observatório Brasileiro de Gás Natural (pipeline/gas). Sem rede: tudo sai do seed versionado."""
import csv
import io
from unittest.mock import patch
import gzip
import hashlib
import json
import os
import unittest

from pipeline.gas import base, gold, ler, validacoes, xlsx
from pipeline.gas.fontes import FONTES


class TestSeed(unittest.TestCase):
    def test_toda_fonte_tem_seed_e_manifesto(self):
        m = base.ler_manifesto()
        for fid, f in FONTES.items():
            self.assertIn(fid, m, fid)
            self.assertTrue(os.path.exists(os.path.join(base.SEED, f["seed"])), f["seed"])
            self.assertRegex(m[fid]["sha256_original"], r"^[0-9a-f]{64}$", fid)
            self.assertTrue(m[fid]["capturado_em"].endswith("Z"), fid)

    def test_seed_inteiro_confere_com_o_sha256_do_original(self):
        # fonte sem recorte: o seed descomprimido é o próprio arquivo baixado
        m = base.ler_manifesto()
        for fid, f in FONTES.items():
            if f.get("recorte") or fid == "anp_movimentacao":
                continue
            with self.subTest(fid=fid):
                self.assertEqual(hashlib.sha256(base.ler_seed(f["seed"])).hexdigest(), m[fid]["sha256_original"])

    def test_gzip_do_seed_e_deterministico(self):
        dados = b"a;b\n1;2\n"
        self.assertEqual(gzip.compress(dados, compresslevel=9, mtime=0), gzip.compress(dados, compresslevel=9, mtime=0))


class TestConversoes(unittest.TestCase):
    def test_numero_br(self):
        self.assertEqual(base.numero_br("1.234,5"), 1234.5)
        self.assertEqual(base.numero_br("3089,647"), 3089.647)
        self.assertIsNone(base.numero_br(""))
        self.assertIsNone(base.numero_br("-"))
        self.assertEqual(base.numero_br("0"), 0.0)

    def test_mes_e_dias(self):
        self.assertEqual(base.mes_iso("2026", "FEV"), "2026-02")
        self.assertEqual(base.mes_iso(2026, 9), "2026-09")
        self.assertEqual(base.dias_no_mes("2024-02"), 29)
        self.assertEqual(base.dias_no_mes("2026-12"), 31)

    def test_data_serial_excel(self):
        self.assertEqual(xlsx.data_serial("41275").isoformat(), "2013-01-01")

    def test_indice_encadeado(self):
        idx = gold._indice_encadeado({"2026-01": 1.0, "2026-02": 2.0}, "2026-01")
        self.assertAlmostEqual(idx["2026-02"], 100 * 1.01 * 1.02)

    def test_janela_de_meses(self):
        self.assertEqual(gold._meses_ate("2026-02", 3), ["2025-12", "2026-01", "2026-02"])
        self.assertEqual(gold._mes_menos("2026-03", 12), "2025-03")


class TestValidacoes(unittest.TestCase):
    def test_lacuna_de_transportadora_relevante_marca_o_mes(self):
        meses = [f"2025-{m:02d}" for m in range(1, 13)]
        entrega = {(m, "A"): 100.0 for m in meses} | {(m, "B"): 5.0 for m in meses}
        entrega[("2025-06", "A")] = 0.0
        entrega[("2025-07", "B")] = 500.0  # pequena e fora de escala: o par sai, o mês continua completo
        f = validacoes.cobertura_movimentacao(meses, ["A", "B"], entrega)
        self.assertIn("2025-06", f)
        self.assertNotIn("2025-07", f)
        self.assertIn(("2025-07", "B"), f["_pares"])

    def test_quebra_de_patamar_vira_anotacao(self):
        meses = [f"{2024 + (i // 12)}-{(i % 12) + 1:02d}" for i in range(18)]
        entrega = {(m, "A"): (100.0 if i < 14 else 30.0) for i, m in enumerate(meses)}
        q = validacoes.quebras_de_patamar(meses, ["A"], entrega, {"A": "A"})
        self.assertTrue(q)
        self.assertEqual(q[0]["mes"], meses[14])


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = gold.Saida()
        nac, meses = gold.producao_e_aproveitamento(cls.s)
        gold.importacao(cls.s, nac, meses)
        gold.precos(cls.s)
        gold.consumidor(cls.s)
        gold.combustiveis(cls.s)
        gold.mercado_e_infraestrutura(cls.s)
        gold.meta(cls.s)
        validacoes.conferir(cls.s)

    def test_gold_publicada_igual_a_reconstruida(self):
        # a gold do repositório é exatamente a que o código gera a partir do seed
        for nome, g in self.s.golds.items():
            with self.subTest(gold=nome):
                with open(os.path.join(base.GOLD, f"{nome}.json"), encoding="utf-8") as f:
                    publicada = json.load(f)
                self.assertEqual(json.loads(json.dumps(g, ensure_ascii=False)), publicada)

    def test_mar_mais_terra_igual_ao_total(self):
        for x in self.s.golds["producao"]["serie"]:
            self.assertAlmostEqual(x["mar"] + x["terra"], x["total"], places=2)

    def test_mes_inconsistente_sai_sem_parcelas(self):
        for x in self.s.golds["aproveitamento"]["serie"]:
            if x["situacao"] == "inconsistente":
                self.assertIsNone(x["disponivel"])
                self.assertIsNone(x["reinjecao"])
                self.assertIsNotNone(x["producao"])

    def test_ausencia_nunca_vira_zero_na_movimentacao(self):
        for x in self.s.golds["mercado"]["carregadores"]:
            if x["cobertura"] == "incompleta":
                self.assertIsNone(x["ativos"])

    def test_media_ponderada_brasil(self):
        g = self.s.golds["precos"]
        vd = ler.vendas_distribuidoras()
        u = g["ultimo_mes"]
        linhas = [(p, v) for m, merc, reg, p, v in vd if m == u and merc == "Não Térmico"]
        esperado = sum(p * v for p, v in linhas) / sum(v for _, v in linhas)
        serie = next(x for x in g["serie"] if x["mes"] == u)
        self.assertAlmostEqual(serie["nao_termico"], round(esperado, 2), places=2)

    def test_conversao_em_dolar_usa_ptax_do_mesmo_mes(self):
        g = self.s.golds["precos"]
        ptax = ler.ptax()
        for x in g["internacional"]:
            if x["brasil_nao_termico_usd"] is not None:
                nt = next(s["nao_termico"] for s in g["serie"] if s["mes"] == x["mes"])
                self.assertAlmostEqual(x["brasil_nao_termico_usd"], round(nt / ptax[x["mes"]], 2), places=2)

    def test_preco_real_do_mes_base_igual_ao_nominal(self):
        g = self.s.golds["gas-de-cozinha"]
        base_ = next(x for x in g["serie"] if x["mes"] == g["mes_base_real"])
        self.assertAlmostEqual(base_["medio_real"], base_["medio"], places=2)

    def test_todo_indicador_calculado_tem_formula(self):
        for nome, g in self.s.golds.items():
            for chave, ind in (g.get("indicadores") or {}).items():
                if ind["natureza"] == "CALCULADO":
                    self.assertTrue(ind.get("formula"), f"{nome}.{chave}")

    def test_um_terminal_de_gnl_por_linha(self):
        nomes = [t["terminal"] for t in self.s.golds["infraestrutura"]["terminais_gnl"]]
        self.assertEqual(len(nomes), len(set(nomes)))
        self.assertIn("Pecém", nomes)
        self.assertIn("Baía de Guanabara", nomes)

    def test_janela_do_aproveitamento_so_com_meses_completos(self):
        bal = ler.balanco_producao()
        nac = {k: {m for (m, _, _) in d} for k, d in bal.items()}
        ap = self.s.golds["aproveitamento"]
        ini, fim = ap["indicadores"]["disponivel"]["periodo"].split(" a ")
        for m in gold._meses_ate(fim, 12):
            for k, meses in nac.items():
                self.assertIn(m, meses, f"{k} sem {m} na janela publicada")

    def test_parcela_ausente_nao_vira_zero_na_janela(self):
        # o último mês da produção sem as demais parcelas desloca a janela para trás, em vez de somar zero
        s = gold.Saida()
        original = ler.balanco_producao
        def com_mes_extra():
            b = original()
            ultimo = max(m for m, _, _ in b["producao"])
            a, mm = (int(x) for x in ultimo.split("-"))
            novo = f"{a + (mm == 12):04d}-{(mm % 12) + 1:02d}"
            b["producao"] = {**b["producao"], (novo, "RJ", "mar"): 5_000_000.0}
            return b
        ler.balanco_producao = com_mes_extra
        try:
            gold.producao_e_aproveitamento(s)
        finally:
            ler.balanco_producao = original
        ap = s.golds["aproveitamento"]
        self.assertEqual(ap["ultimo_mes"], self.s.golds["aproveitamento"]["ultimo_mes"])
        self.assertEqual(ap["indicadores"]["disponivel"]["valor"], self.s.golds["aproveitamento"]["indicadores"]["disponivel"]["valor"])

    def test_series_csv_publicadas_existem(self):
        for nome in self.s.series:
            self.assertTrue(os.path.exists(os.path.join(base.SERIES, f"{nome}.csv")), nome)


class TestCoberturaAdversa(unittest.TestCase):
    def setUp(self):
        self.s = gold.Saida()
        self.nac, self.meses = gold.producao_e_aproveitamento(self.s)

    def importar(self, registros):
        with patch.object(ler, "importacao_anp", return_value=registros):
            gold.importacao(self.s, self.nac, self.meses)
        return self.s.golds["importacao"]

    def test_mes_ausente_anula_janela_e_preserva_lacuna(self):
        registros = ler.importacao_anp()
        mes = gold._meses_ate(max(registros), 12)[3]
        del registros[mes]
        g = self.importar(registros)
        for k in ("importado_12m", "dispendio_12m", "participacao_12m", "oferta_12m"):
            self.assertIsNone(g["indicadores"][k]["valor"], k)
        self.assertIsNone(next(x for x in g["serie"] if x["mes"] == mes)["importado"])

    def test_dispendio_ausente_nao_apaga_volume_publicado(self):
        registros = ler.importacao_anp()
        mes = max(registros)
        registros[mes] = (registros[mes][0], None)
        g = self.importar(registros)
        self.assertIsNone(g["indicadores"]["dispendio_12m"]["valor"])
        self.assertIsNotNone(g["indicadores"]["importado_12m"]["valor"])

    def test_zero_publicado_continua_zero(self):
        registros = ler.importacao_anp()
        for mes in gold._meses_ate(max(registros), 12):
            registros[mes] = (0, 0)
        g = self.importar(registros)
        self.assertEqual(g["indicadores"]["importado_12m"]["valor"], 0)
        self.assertEqual(g["indicadores"]["participacao_12m"]["valor"], 0)
        self.assertIsNone(gold._participacao(0, 0))

    def test_participacao_nao_usa_disponivel_de_balanco_reprovado(self):
        g = self.importar(ler.importacao_anp())
        situacao = {x["mes"]: x["situacao"] for x in self.s.golds["aproveitamento"]["serie"]}
        reprovados = [m for m, v in situacao.items() if v != "ok"]
        self.assertTrue(reprovados)
        for x in g["serie"]:
            if x["mes"] in reprovados:
                with self.subTest(mes=x["mes"]):
                    self.assertIsNone(x["participacao_pct"])
                    self.assertIsNotNone(x["importado"])

    def test_periodos_diferentes_impedem_composicao(self):
        self.s.golds["aproveitamento"]["indicadores"]["producao_mmd_12m"]["periodo"] = "outra janela"
        g = self.importar(ler.importacao_anp())
        self.assertIsNone(g["indicadores"]["oferta_12m"]["valor"])
        self.assertIsNone(g["indicadores"]["disponivel_participacao_12m"]["valor"])

    def test_parcela_pequena_ausente_nao_e_balanco_valido(self):
        bal = ler.balanco_producao()
        mes = max(m for m, _, _ in bal["queima"])
        bal["queima"] = {k: v for k, v in bal["queima"].items() if k[0] != mes}
        with patch.object(ler, "balanco_producao", return_value=bal):
            gold.producao_e_aproveitamento(self.s)
        linha = next(x for x in self.s.golds["aproveitamento"]["serie"] if x["mes"] == mes)
        self.assertEqual(linha["situacao"], "incompleto")
        self.assertIsNone(linha["diferenca_pct"])
        self.assertIsNone(linha["disponivel"])
        self.assertGreater(linha["producao"], 0)

    def test_ipca_nao_atravessa_lacuna(self):
        self.assertEqual(gold._indice_encadeado({"2026-01": 0, "2026-03": 2}, "2026-01"), {"2026-01": 100})
        self.assertEqual(gold._indice_encadeado({"2026-02": 1}, "2026-01"), {})

    def test_nota_nao_declara_persistencia_com_um_mes(self):
        nota = gold.nota_diferenca([{"mes": "2026-01", "situacao": "ok", "diferenca_pct": 0.2}])
        self.assertNotIn("Desde", nota)
        self.assertNotIn("abaixo", nota)

    def test_contagem_da_transportadora_incompleta_nao_e_zero(self):
        gold.mercado_e_infraestrutura(self.s)
        serie = self.s.golds["mercado"]["carregadores"]
        entregas = {x["mes"]: x for x in self.s.golds["infraestrutura"]["entregas"]}
        siglas = self.s.golds["infraestrutura"]["transportadoras"]
        # o par sinalizado na cobertura perde o volume e a contagem; vale para qualquer mês que a fonte vier a revisar
        pares = [(x["mes"], t) for x in serie for t in siglas if entregas[x["mes"]][t] is None]
        self.assertTrue(pares)
        for x in serie:
            for t in siglas:
                with self.subTest(mes=x["mes"], transportadora=t):
                    self.assertEqual(x[f"n:{t}"] is None, entregas[x["mes"]][t] is None)
        ind = self.s.golds["infraestrutura"]["indicadores"]["atos_total"]
        self.assertEqual(ind["natureza"], "CALCULADO")
        self.assertTrue(ind["formula"])

    def test_csv_publicado_confere_com_todos_os_valores_gerados(self):
        gold.importacao(self.s, self.nac, self.meses)
        gold.precos(self.s)
        gold.consumidor(self.s)
        gold.combustiveis(self.s)
        gold.mercado_e_infraestrutura(self.s)
        for nome, serie in self.s.series.items():
            with self.subTest(serie=nome):
                with open(os.path.join(base.SERIES, nome + ".csv"), encoding="utf-8") as f:
                    linhas = list(csv.reader(f, delimiter=";"))
                esperado = [["" if v is None else str(v).replace(".", ",") if isinstance(v, float) else str(v) for v in row] for row in serie["linhas"]]
                self.assertEqual(linhas, [serie["colunas"], *esperado])


def _xlsx(caminho, linhas):
    """Planilha mínima (texto em linha, sem estilos) para testar o recorte sem rede."""
    import zipfile
    from xml.sax.saxutils import escape

    def col(i):
        return chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)

    corpo = "".join(
        f'<row r="{r + 1}">' + "".join(
            f'<c r="{col(i)}{r + 1}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>' if isinstance(v, str)
            else f'<c r="{col(i)}{r + 1}"><v>{v}</v></c>' for i, v in enumerate(l)) + "</row>"
        for r, l in enumerate(linhas))
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    with zipfile.ZipFile(caminho, "w") as z:
        z.writestr("xl/workbook.xml", f'<workbook {ns}><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/worksheets/sheet1.xml", f"<worksheet {ns}><sheetData>{corpo}</sheetData></worksheet>")


class TestRecortePrecos(unittest.TestCase):
    CAB = ["MÊS", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA"]

    def _planilha(self, produtos, unidade_gasolina="R$/l"):
        import tempfile
        from pipeline.gas.fontes import PRODUTOS_PRECOS
        linhas = [["AGÊNCIA NACIONAL DO PETRÓLEO"], ["Obs: Entre 30/07/17 e 30/12/17, a abrangência foi reduzida."],
                  ["Não houve pesquisa de preços entre 18/8/20 e 17/10/20. "], self.CAB]
        for p in produtos:
            u = unidade_gasolina if p == "GASOLINA COMUM" else PRODUTOS_PRECOS[p][-1]
            linhas.append([46266, p, 100, u, 6.5])
        linhas.append([46266, "GASOLINA ADITIVADA", 10, "R$/l", 7.0])
        t = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        t.close()
        _xlsx(t.name, linhas)
        self.addCleanup(os.unlink, t.name)
        return t.name

    def test_recorte_guarda_os_seis_produtos_e_as_observacoes(self):
        from pipeline.gas.fontes import PRODUTOS_PRECOS, recortar_precos
        texto, notas, meses = recortar_precos(self._planilha(list(PRODUTOS_PRECOS)))
        linhas = list(csv.reader(io.StringIO(texto), delimiter=";"))
        self.assertEqual(linhas[0], self.CAB)
        self.assertEqual(sorted(l[1] for l in linhas[1:]), sorted(PRODUTOS_PRECOS))
        self.assertTrue(all(l[0] == "2026-09" for l in linhas[1:]))
        # a gasolina aditivada não entra no recorte
        self.assertNotIn("GASOLINA ADITIVADA", texto)
        self.assertEqual(notas, ["Entre 30/07/17 e 30/12/17, a abrangência foi reduzida.", "Não houve pesquisa de preços entre 18/8/20 e 17/10/20."])
        self.assertEqual(set(meses), set(PRODUTOS_PRECOS))

    def test_produto_ausente_ou_unidade_trocada_interrompe_a_coleta(self):
        from pipeline.gas.fontes import PRODUTOS_PRECOS, recortar_precos
        with self.assertRaisesRegex(RuntimeError, "ausentes"):
            recortar_precos(self._planilha([p for p in PRODUTOS_PRECOS if p != "ETANOL HIDRATADO"]))
        with self.assertRaisesRegex(RuntimeError, "unidade inesperada"):
            recortar_precos(self._planilha(list(PRODUTOS_PRECOS), unidade_gasolina="R$/m³"))

    def test_eventos_e_situacao_do_mes_saem_das_observacoes(self):
        ev = gold.eventos_da_pesquisa(["Não houve pesquisa de preços entre 18/8/20 e 17/10/20.",
                                       "Os preços de distribuição foram coletados até 17/8/20."])
        self.assertEqual(len(ev), 1)
        self.assertEqual((ev[0]["tipo"], ev[0]["inicio"], ev[0]["fim"]), ("sem_pesquisa", "2020-08-18", "2020-10-17"))
        self.assertEqual(ev[0]["meses"], ["2020-08", "2020-09", "2020-10"])
        self.assertEqual(gold.situacao_do_mes("2020-09", False, ev), "sem_pesquisa")
        self.assertEqual(gold.situacao_do_mes("2020-08", True, ev), "parcial")
        self.assertEqual(gold.situacao_do_mes("2021-01", True, ev), "completo")
        self.assertEqual(gold.situacao_do_mes("2021-02", False, ev), "sem_dado")


class TestCombustiveis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = gold.Saida()
        gold.consumidor(cls.s)
        gold.combustiveis(cls.s)
        cls.c = cls.s.golds["combustiveis"]
        cls.ids = [p["id"] for p in cls.c["produtos"]]

    def test_quatro_produtos_desde_2013_na_mesma_planilha_do_botijao(self):
        self.assertEqual(self.ids, ["gasolina", "etanol", "diesel", "diesel_s10"])
        self.assertEqual(self.c["serie"][0]["mes"], "2013-01")
        self.assertEqual(self.c["ultimo_mes"], self.s.golds["gas-de-cozinha"]["ultimo_mes"])
        self.assertTrue(all(p["unidade"] == "R$/l" for p in self.c["produtos"]))

    def test_lacuna_de_2020_e_lacuna_nunca_zero(self):
        por_mes = {x["mes"]: x for x in self.c["serie"]}
        self.assertEqual(por_mes["2020-09"]["situacao"], "sem_pesquisa")
        for pid in self.ids:
            self.assertIsNone(por_mes["2020-09"][pid])
            self.assertIsNone(por_mes["2020-09"][f"{pid}_real"])
            self.assertIsNone(self.c["serie_uf"]["valores"][pid]["SP"][self.c["serie_uf"]["meses"].index("2020-09")])
        self.assertEqual(por_mes["2020-08"]["situacao"], "parcial")
        self.assertEqual(por_mes["2020-10"]["situacao"], "parcial")
        for x in self.c["serie"]:
            for pid in self.ids:
                self.assertNotEqual(x[pid], 0, x["mes"])

    def test_uf_sem_pesquisa_fica_sem_dado(self):
        est = ler.precos_estados()
        u = self.c["ultimo_mes"]
        for l in self.c["por_uf"]:
            for pid, anp, *_ in gold.PRODUTOS_COMBUSTIVEIS:
                tem = any(x["uf"] == l["uf"] and x["produto"] == anp and x["mes"] == u and x["medio"] is not None for x in est)
                self.assertEqual(l[pid] is not None, tem, f"{l['uf']} {pid}")

    def test_postos_do_brasil_somam_os_das_ufs_em_todos_os_meses(self):
        est, br = ler.precos_estados(), ler.precos_brasil()
        soma = {}
        for x in est:
            soma[(x["mes"], x["produto"])] = soma.get((x["mes"], x["produto"]), 0) + (x["postos"] or 0)
        for x in br:
            if x["produto"] in {anp for _, anp, *_ in gold.PRODUTOS_COMBUSTIVEIS}:
                self.assertEqual(soma[(x["mes"], x["produto"])], x["postos"], (x["mes"], x["produto"]))

    def test_distancia_para_o_brasil_e_razao_etanol_gasolina(self):
        ultimo = self.c["serie"][-1]
        for l in self.c["por_uf"]:
            for pid in self.ids:
                if l[pid]:
                    self.assertAlmostEqual(l[pid]["dif_brasil"], l[pid]["medio"] - ultimo[pid], places=3)
                    self.assertAlmostEqual(l[pid]["dif_brasil_pct"], round(100 * (l[pid]["medio"] / ultimo[pid] - 1), 1), places=1)
            if l["etanol"] and l["gasolina"]:
                self.assertAlmostEqual(l["etanol_gasolina_pct"], round(100 * l["etanol"]["medio"] / l["gasolina"]["medio"], 1))
        self.assertEqual(self.c["indicadores"]["etanol_gasolina_brasil"]["natureza"], "CALCULADO")

    def test_preco_real_do_mes_base_igual_ao_nominal(self):
        b = next(x for x in self.c["serie"] if x["mes"] == self.c["mes_base_real"])
        for pid in self.ids:
            self.assertAlmostEqual(b[f"{pid}_real"], b[pid], places=2)

    def test_validacao_reprova_valor_dentro_da_lacuna(self):
        import copy
        c = copy.deepcopy(self.c)
        x = next(x for x in c["serie"] if x["mes"] == "2020-09")
        x["gasolina"] = 4.3
        with self.assertRaises(validacoes.ErroValidacao):
            validacoes.conferir_combustiveis(c, c["ultimo_mes"])
        c = copy.deepcopy(self.c)
        del c["serie"][10]
        c["serie_uf"]["meses"] = [x["mes"] for x in c["serie"]]
        with self.assertRaises(validacoes.ErroValidacao):
            validacoes.conferir_combustiveis(c, c["ultimo_mes"])
        c = copy.deepcopy(self.c)
        c["pesquisa"]["conferencia_ultimo_mes"][0]["soma_postos_ufs"] += 1
        with self.assertRaises(validacoes.ErroValidacao):
            validacoes.conferir_combustiveis(c, c["ultimo_mes"])


if __name__ == "__main__":
    unittest.main()
