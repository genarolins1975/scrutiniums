"""Testes do pipeline Educação nos municípios (pipeline/educacao). Sem rede: tudo sai dos seeds versionados.

Os casos sintéticos provam que cada validação retém a publicação: Ideb que não fecha com N × P, contagem diferente da
nota informativa, UF faltando, código de coluna trocado demais, revisão de Ideb já publicado, Censo cujos municípios
não somam a UF, total que não fecha por rede, população que não soma o Brasil e a conferência cruzada (rede com Ideb sem
matrícula). Provam também a leitura das células do INEP ("-" é ausência, "ND" é marca, vírgula decimal em texto), a
regra do motivo de não haver Ideb e o porte. E conferem o Ideb das capitais contra o painel "Educação nas capitais", que
lê as mesmas planilhas do INEP.
"""
import copy
import json
import unittest
from unittest import mock
from pathlib import Path

from pipeline.educacao import coleta, gold, run, validacoes
from pipeline.educacao import fontes as F

RAIZ = Path(__file__).resolve().parents[2]


def seeds():
    return run.ler_seeds()


class TestLeituraDasCelulas(unittest.TestCase):
    def test_celulas_do_inep(self):
        self.assertEqual(coleta.valor(6.2), (6.2, None))
        self.assertEqual(coleta.valor("-"), (None, None))
        self.assertEqual(coleta.valor("ND"), (None, "ND"))
        self.assertEqual(coleta.valor("ND***"), (None, "ND***"))
        self.assertEqual(coleta.valor("231,42"), (231.42, None))
        self.assertEqual(coleta.valor("195,00*"), (195.0, "*"))
        self.assertEqual(coleta.valor(None), (None, None))
        with self.assertRaises(ValueError):
            coleta.valor("n/d")

    def test_ano_do_rotulo_com_nota(self):
        self.assertEqual(coleta._ano("Taxa de Aprovação - 20212"), 2021)
        self.assertEqual(coleta._ano("IDEB\n2025\n(N x P)"), 2025)


class TestSeedsVersionados(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()

    def test_seeds_passam_em_todas_as_validacoes(self):
        self.assertEqual(validacoes.validar_ideb(self.s["ideb"]), [])
        self.assertEqual(validacoes.validar_censo(self.s["censo"]), [])
        self.assertEqual(validacoes.validar_populacao(self.s["populacao"]), [])
        self.assertEqual(validacoes.validar_cruzado(self.s["ideb"], self.s["censo"], self.s["populacao"]), [])

    def test_publicacao_versionada_e_a_dos_seeds(self):
        out = run.saidas(self.s)
        self.assertEqual(len(out), 29)  # Pedido Educação PR 2: gold, 27 UFs e mapa compacto protegido
        for caminho, texto in out.items():
            self.assertTrue(caminho.exists(), caminho)
            self.assertEqual(caminho.read_bytes().decode("utf-8"), texto, f"{caminho} não é a dos seeds: rode python3 -m pipeline.educacao.run")

    def test_originais_com_sha256_md5_do_inep_e_endereco_oficial(self):
        i, c, p = self.s["ideb"], self.s["censo"], self.s["populacao"]
        ano = i["ano"]
        self.assertEqual(i["arquivos"]["ai"]["url"], F.URL_IDEB_MUNICIPIOS.format(etapa="anos_iniciais", ano=ano))
        self.assertEqual(i["arquivos"]["af"]["url"], F.URL_IDEB_MUNICIPIOS.format(etapa="anos_finais", ano=ano))
        self.assertEqual(i["arquivos"]["ufs"]["url"], F.URL_IDEB_UFS.format(ano=ano))
        self.assertEqual(i["arquivos"]["brasil"]["url"], F.URL_IDEB_BRASIL.format(ano=ano))
        for a in [*i["arquivos"].values(), c["arquivo"]]:
            self.assertRegex(a["sha256"], r"^[0-9a-f]{64}$")
            # a planilha lida é a que confere com o MD5 publicado pelo INEP dentro do pacote
            self.assertEqual(a["md5_publicado_inep"], a["md5_conferido"])
        self.assertEqual(c["arquivo"]["url"], F.URL_SINOPSE.format(ano=c["ano"]))
        self.assertEqual(p["url"], F.URL_SIDRA_MUNICIPIOS.format(ano=ano))
        for fonte in self.s.values():
            self.assertTrue(fonte["capturado_em"].endswith("Z"))

    def test_seed_do_ideb_comprimido_sem_data_no_cabecalho(self):
        dados = run.SEEDS["ideb"].read_bytes()
        self.assertEqual(dados[:2], b"\x1f\x8b")
        self.assertEqual(dados[4:8], b"\x00\x00\x00\x00")  # mtime zero: o mesmo dado gera o mesmo arquivo

    def test_codigos_trocados_do_inep_ficam_registrados(self):
        div = self.s["ideb"]["codigos_divergentes"]
        # as planilhas de 2025 trazem dois códigos de coluna errados; a posição é provada pela conta N × P
        if self.s["ideb"]["ano"] == 2025:
            self.assertEqual(div["ufs_ai"], [{"coluna": 78, "esperado": "VL_INDICADOR_REND_2025", "codigo_na_fonte": "VL_INDICADOR_REND_2023"}])
            self.assertEqual(div["brasil_af"], [{"coluna": 110, "esperado": "VL_OBSERVADO_2023", "codigo_na_fonte": None}])


class TestValidacoesRetem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()

    def _um_municipio(self, ideb):
        return next(cod for cod, m in ideb["etapas"]["ai"]["municipios"].items() if (m["redes"].get("municipal") or {}).get("ideb", [None])[-1] is not None)

    def test_ideb_que_nao_fecha_com_n_vezes_p(self):
        i = copy.deepcopy(self.s["ideb"])
        cod = self._um_municipio(i)
        i["etapas"]["ai"]["municipios"][cod]["redes"]["municipal"]["ideb"][-1] += 0.5
        self.assertTrue(any("N × P" in p for p in validacoes.validar_ideb(i)))

    def test_contagem_diferente_da_nota_informativa(self):
        i = copy.deepcopy(self.s["ideb"])
        cod = self._um_municipio(i)
        r = i["etapas"]["ai"]["municipios"][cod]["redes"]["municipal"]
        r["ideb"][-1] = None
        self.assertIn(i["ano"], F.QUADRO_1)
        self.assertTrue(any("nota informativa" in p for p in validacoes.validar_ideb(i)))

    def test_edicao_sem_referencia_do_quadro_1_fica_retida(self):
        # edição nova antes do cadastro da contagem da nota informativa: simulada tirando a referência da edição publicada
        with mock.patch.dict(F.QUADRO_1, clear=True):
            self.assertTrue(any("sem a contagem do Quadro 1" in p for p in validacoes.validar_ideb(self.s["ideb"])))

    def test_cruzada_populacao_de_outro_ano(self):
        pop = copy.deepcopy(self.s["populacao"])
        pop["ano"] = self.s["ideb"]["ano"] - 2
        self.assertTrue(any("tem de ser do ano do Ideb" in x for x in validacoes.validar_cruzado(self.s["ideb"], self.s["censo"], pop)))

    def test_uf_faltando_e_brasil_sem_rede(self):
        i = copy.deepcopy(self.s["ideb"])
        del i["etapas"]["af"]["ufs"]["AC"]
        del i["etapas"]["ai"]["brasil"]["municipal"]
        p = validacoes.validar_ideb(i)
        self.assertTrue(any("UFs do Ideb" in x for x in p))
        self.assertTrue(any("Brasil sem a rede municipal" in x for x in p))

    def test_desenho_trocado_e_edicao_velha(self):
        i = copy.deepcopy(self.s["ideb"])
        i["codigos_divergentes"]["ai"] = [{"coluna": k, "esperado": "x", "codigo_na_fonte": "y"} for k in range(3)]
        self.assertTrue(any("desenho da planilha" in p for p in validacoes.validar_ideb(i)))
        anterior = {**self.s["ideb"], "ano": self.s["ideb"]["ano"] + 2}
        self.assertTrue(any("mais velha" in p for p in validacoes.validar_ideb(self.s["ideb"], anterior)))

    def test_revisao_de_ideb_publicado(self):
        anterior = self.s["ideb"]
        i = copy.deepcopy(anterior)
        cod = self._um_municipio(i)
        r = i["etapas"]["ai"]["municipios"][cod]["redes"]["municipal"]
        r["ideb"][-1] = None
        r["n"][-1] = None
        p = validacoes.validar_ideb(i, anterior)
        self.assertTrue(any("sumiu na recoleta" in x for x in p))

    def test_censo_que_nao_soma(self):
        c = copy.deepcopy(self.s["censo"])
        cod = next(iter(c["municipios"]))
        c["municipios"][cod][1 + F.CAMPOS_CENSO.index("mat_municipal")] += 1
        p = validacoes.validar_censo(c)
        self.assertTrue(any("não somam a linha da UF" in x for x in p))
        self.assertTrue(any("não fecham com as três redes" in x for x in p))

    def test_censo_parte_maior_que_o_todo(self):
        c = copy.deepcopy(self.s["censo"])
        cod = next(cod for cod, l in c["municipios"].items() if l[1 + F.CAMPOS_CENSO.index("esc_municipal")] > 0)
        l = c["municipios"][cod]
        l[1 + F.CAMPOS_CENSO.index("esc_mun_rural")] = l[1 + F.CAMPOS_CENSO.index("esc_municipal")] + 1
        self.assertTrue(any("esc_mun_rural maior que esc_municipal" in x for x in validacoes.validar_censo(c)))

    def test_populacao_que_nao_soma(self):
        p = copy.deepcopy(self.s["populacao"])
        p["brasil"] += 1
        self.assertTrue(any("não soma" in x for x in validacoes.validar_populacao(p)))

    def test_cruzada_rede_com_ideb_e_sem_matricula(self):
        i, c = self.s["ideb"], copy.deepcopy(self.s["censo"])
        if c["ano"] != i["ano"]:
            self.skipTest("Censo de outra edição")
        cod = self._um_municipio(i)
        c["municipios"][cod][1 + F.CAMPOS_CENSO.index("ai_mun")] = 0
        self.assertTrue(any("nenhuma matrícula" in x for x in validacoes.validar_cruzado(i, c, self.s["populacao"])))


class TestGold(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seeds()
        cls.g, cls.ufs = gold.construir(cls.s)

    def test_universo_e_porte(self):
        g = self.g
        self.assertEqual(g["municipios"]["total"], len(self.s["populacao"]["municipios"]))
        self.assertEqual(sum(p["municipios"] for p in g["portes"]), g["municipios"]["total"])
        self.assertEqual(gold.porte(5000), "ate5")
        self.assertEqual(gold.porte(5001), "5a10")
        self.assertEqual(gold.porte(500001), "mais500")
        self.assertIsNone(gold.porte(None))

    def test_cobertura_soma_o_universo_e_confere_com_o_quadro_1(self):
        g = self.g
        for etapa in F.ETAPAS:
            for rede in ("municipal", "publica"):
                c = g["cobertura"][etapa][rede]
                self.assertEqual(c["com_ideb"] + sum(c["motivos"].values()), g["municipios"]["total"], (etapa, rede))
                esperado = F.QUADRO_1.get(g["ideb"]["ano"], {}).get(etapa, {}).get(rede)
                if esperado:
                    self.assertEqual(c["com_ideb"], esperado)
            self.assertEqual(g["distribuicao"][etapa]["brasil"]["n"], g["cobertura"][etapa]["municipal"]["com_ideb"])
            self.assertEqual(sum(g["distribuicao"][etapa]["brasil"]["faixas"]), g["distribuicao"][etapa]["brasil"]["n"])

    def test_motivo(self):
        r = {"ideb": [None], "n": [None], "p": [0.9], "marca_saeb": ["ND"]}
        self.assertEqual(gold.motivo(r, 10), "participacao")
        self.assertEqual(gold.motivo(r, 0), "sem_matricula")
        self.assertEqual(gold.motivo(None, 10), "nao_divulgado")
        self.assertEqual(gold.motivo({**r, "marca_saeb": [None], "n": [5.0], "p": [None]}, 10), "sem_aprovacao")
        self.assertEqual(gold.motivo({**r, "marca_saeb": [None]}, 10), "sem_saeb")
        self.assertIsNone(gold.motivo({**r, "ideb": [6.0]}, 10))

    def test_ausencia_nao_vira_zero(self):
        """Rede sem Ideb no ano mais recente tem o motivo e o valor ausente (null), nunca zero."""
        for arquivo in self.ufs.values():
            for m in arquivo["municipios"]:
                for etapa in F.ETAPAS:
                    for rede in ("municipal", "publica"):
                        s, mot = m[etapa][rede], m[etapa][f"motivo_{rede}"]
                        ultimo = s["ideb"][-1] if s else None
                        self.assertNotEqual(ultimo, 0)
                        self.assertEqual(mot is None, ultimo is not None, (m["id"], etapa, rede))

    def test_distrito_federal_sem_rede_municipal(self):
        df = self.ufs["DF"]["municipios"]
        self.assertEqual(len(df), 1)
        self.assertEqual(df[0]["censo"]["mat_municipal"], 0)
        self.assertEqual(df[0]["ai"]["motivo_municipal"], "sem_matricula")
        self.assertIsNotNone(df[0]["ai"]["publica"]["ideb"][-1])

    def test_ideb_das_capitais_igual_ao_do_painel_das_capitais(self):
        """O painel "Educação nas capitais" (Eficiência Estatal) lê as mesmas planilhas: o Ideb da rede municipal tem de ser o mesmo."""
        caminho = RAIZ / "public" / "eficiencia" / "gold" / "educacao_capitais.json"
        if not caminho.exists():
            self.skipTest("gold das capitais ausente")
        obee = json.loads(caminho.read_text(encoding="utf-8"))
        etapa_obee = {"ai": "anos_iniciais", "af": "anos_finais"}
        anos = self.g["ideb"]["anos"]
        comparados = 0
        por_id = {m["id"]: m for a in self.ufs.values() for m in a["municipios"]}
        for o in obee["observacoes"]:
            if o.get("indicador") != "edu.ideb.rede_municipal" or o.get("componente") != "ideb" or o.get("valor") is None:
                continue
            etapa = next(k for k, v in etapa_obee.items() if v == o["etapa"])
            m = por_id[str(o["ente"])]
            if o["ano"] not in anos:
                continue
            self.assertTrue(m["capital"], o["ente"])
            self.assertEqual(m[etapa]["municipal"]["ideb"][anos.index(o["ano"])], o["valor"], (o["ente"], o["etapa"], o["ano"]))
            comparados += 1
        self.assertGreater(comparados, 400)


if __name__ == "__main__":
    unittest.main()


class TestAnalisesDidaticas(unittest.TestCase):
    def serie(self, n, p):
        return {"n": n, "p": p, "ideb": [None if a is None or b is None else round(a*b, 1) for a, b in zip(n, p)],
                "meta": [3, 4], "marca": [None, None]}

    def test_decomposicao_isola_fator_constante_e_fecha_a_soma(self):
        for n, p, esperado in [([4, 8], [1, 1], (4, 0)), ([4, 4], [.5, 1], (0, 2)), ([4, 8], [.5, 1], (3, 3))]:
            a = gold.analise_serie(self.serie(n, p), [2007, 2009], [2007, 2009])["variacoes"][0]
            self.assertAlmostEqual(a[6], esperado[0])
            self.assertAlmostEqual(a[7], esperado[1])
            self.assertAlmostEqual(a[6]+a[7], a[5]-a[4])

    def test_movimento_pequeno_e_logaritmo_indefinido_nao_ganham_contribuicoes(self):
        for n, p in [([4, 4.02], [.5, .5]), ([4, 8], [.5, .25]), ([0, 4], [1, 1])]:
            a = gold.analise_serie(self.serie(n, p), [2007, 2009], [2007, 2009])["variacoes"][0]
            self.assertIsNone(a[6])
            self.assertIsNone(a[7])
            self.assertAlmostEqual(a[2], n[1]-n[0])
            self.assertAlmostEqual(a[3], p[1]-p[0])

    def test_limiar_decimal_exato_nao_depende_do_erro_binario(self):
        a = gold.analise_serie(self.serie([4, 4.1], [.5, .5]), [2007, 2009], [2007, 2009])["variacoes"][0]
        self.assertIsNotNone(a[6])
        self.assertAlmostEqual(a[6], .05)

    def test_ausencia_nao_vira_zero_nem_motivo_de_matricula_de_outro_ano(self):
        s = self.serie([None, 4], [.8, 1])
        s["marca"][0] = "ND*"
        a = gold.analise_serie(s, [2007, 2009], [2007, 2009])
        self.assertEqual(a["variacoes"], [])
        self.assertEqual(a["metas"][0], {"ano": 2007, "estado": "sem_ideb", "motivo": "a_pedido"})
        self.assertEqual(a["metas"][1]["estado"], "alcancou")
        self.assertEqual(gold.composicao_matriculas(None), [])
        s["meta"][0] = None
        sem_ambos = gold.analise_serie(s, [2007, 2009], [2007, 2009])["metas"][0]
        self.assertEqual(sem_ambos, {"ano": 2007, "estado": "sem_meta", "motivo": "a_pedido"})

    def test_derivacoes_reais_reconciliam_e_corrupcao_e_retida(self):
        g, ufs = gold.construir(seeds())
        self.assertEqual(validacoes.validar_analises(g, ufs), [])
        mapa = gold.mapa_compacto(g, ufs)
        self.assertEqual(validacoes.validar_mapa(mapa, g, ufs), [])
        mapa["cobertura"]["SE"]["ai"]["com_ideb"] += 1
        self.assertTrue(any("cobertura divergente" in x for x in validacoes.validar_mapa(mapa, g, ufs)))
        mapa["cobertura"]["SE"]["ai"]["com_ideb"] -= 1
        mapa["municipios"][0]["ai"] = -1
        self.assertTrue(any("valor ou motivo divergente" in x for x in validacoes.validar_mapa(mapa, g, ufs)))
        mapa = gold.mapa_compacto(g, ufs)
        self.assertEqual(len(mapa["municipios"]), g["municipios"]["total"])
        self.assertEqual(len({m["id"] for m in mapa["municipios"]}), g["municipios"]["total"])
        for m in mapa["municipios"]:
            for e in F.ETAPAS:
                self.assertEqual(m[e] is None, m[f"motivo_{e}"] is not None)
        m = next(m for a in ufs.values() for m in a["municipios"] if any(v[6] is not None for v in m["analises"]["ai"]["variacoes"]))
        v = next(v for v in m["analises"]["ai"]["variacoes"] if v[6] is not None)
        v[6] += .2
        self.assertTrue(any("contribuições não fecham" in x for x in validacoes.validar_analises(g, ufs)))
        v[7] -= .2
        self.assertTrue(any("movimentos logarítmicos" in x for x in validacoes.validar_analises(g, ufs)))
        v[6] -= .2
        v[7] += .2
        m["composicao_matriculas"][0]["partes"]["municipal"] += 1
        self.assertTrue(any("composição não fecha" in x for x in validacoes.validar_analises(g, ufs)))
