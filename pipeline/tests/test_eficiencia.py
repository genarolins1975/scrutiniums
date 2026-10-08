"""Testes do domínio OBEE (pipeline/eficiencia): reconstrução da gold a partir do seed.

Sem rede. Os testes conferem erros plausíveis e as suas consequências: mistura
de redes, ausência convertida em zero, perímetro do DF, composição que não
reconcilia, razão publicada sem perímetro compatível, divergência entre
interface e download, linguagem avaliativa no catálogo.
"""
import csv
import json
import os
import re
import unittest
from pathlib import Path

from pipeline.eficiencia import base, entes, gold, padroniza as P

RAIZ = base.RAIZ


class TestEficiencia(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = gold.constroi(gerado_em="2026-10-08T00:00:00Z")
        cls.obs = cls.g["observacoes"]
        cls.idx = {}
        for o in cls.obs:
            cls.idx[(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])] = o

    def v(self, ind, ente, ano, etapa=None, comp=None):
        return self.idx[(ind, ente, ano, etapa, comp)]

    # ---------------------------------------------------------------- reprodução

    def test_reconstrucao_idempotente(self):
        g2 = gold.constroi(gerado_em="2026-10-08T00:00:00Z")
        self.assertEqual(self.g["meta"]["hash_dados"], g2["meta"]["hash_dados"])
        self.assertEqual(len(self.obs), len(g2["observacoes"]))

    def test_gold_publicada_corresponde_ao_seed(self):
        """A gold versionada em public/ foi gerada a partir do seed versionado (mesmo hash de dados)."""
        with open(gold.ARQUIVO_GOLD, encoding="utf-8") as f:
            pub = json.load(f)
        self.assertEqual(pub["meta"]["hash_dados"], self.g["meta"]["hash_dados"])

    def test_sem_validacao_reprovada(self):
        self.assertEqual([v["id"] for v in self.g["validacoes"] if v["resultado"] == "reprovada"], [])

    # ---------------------------------------------------------------- fonte original

    def test_despesa_lida_da_resposta_preservada(self):
        recife = 2611606
        bruto = base.le_json_gz(os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{recife}_2025.json.gz"))
        esperado = [x["valor"] for x in bruto if x["conta"] == "12 - Educação" and x["coluna"] == "Despesas Liquidadas"][0]
        self.assertAlmostEqual(self.v("edu.despesa.funcao_educacao", recife, 2025, None, "nominal")["valor"], esperado, places=2)
        # outro estágio não pode ter entrado no lugar do liquidado
        empenhado = [x["valor"] for x in bruto if x["conta"] == "12 - Educação" and x["coluna"] == "Despesas Empenhadas"][0]
        self.assertNotEqual(round(esperado, 2), round(empenhado, 2))

    def test_microdados_conferem_com_a_sinopse(self):
        v06 = next(v for v in self.g["validacoes"] if v["id"] == "V06")
        self.assertEqual(v06["casos"], [])
        self.assertGreaterEqual(int(re.search(r"(\d+) comparações", v06["detalhe"]).group(1)), 260)

    # ---------------------------------------------------------------- perímetros

    def test_rede_municipal_nao_mistura_rede_estadual(self):
        sp = 3550308
        s = base.le_json_gz(os.path.join(base.SEED, "inep_sinopse", "sinopse_capitais_2025.json.gz"))
        linha = next(l for l in s["total"]["linhas"] if int(l[3]) == sp)
        total_territorio, municipal = linha[4], linha[8]
        v = self.v("edu.matriculas.rede_municipal", sp, 2025, "total")["valor"]
        self.assertEqual(v, municipal)
        self.assertLess(v, total_territorio)

    def test_conveniadas_nao_somadas_a_rede(self):
        sp = 3550308
        rede = self.v("edu.matriculas.rede_municipal", sp, 2025, "total")["valor"]
        conv = self.v("edu.matriculas.conveniadas_municipais", sp, 2025, "total")["valor"]
        self.assertGreater(conv, 0)
        s = base.le_json_gz(os.path.join(base.SEED, "inep_sinopse", "sinopse_capitais_2025.json.gz"))
        linha = next(l for l in s["total"]["linhas"] if int(l[3]) == sp)
        self.assertEqual(rede, linha[8])  # o total da rede não contém as conveniadas

    def test_distrito_federal_fora_do_recorte_municipal(self):
        self.assertFalse(any(o["ente"] == entes.DISTRITO_FEDERAL[0] for o in self.obs))
        self.assertEqual(len(self.g["universo"]["capitais"]), 26)
        self.assertEqual([e["uf"] for e in self.g["universo"]["excluidos"]], ["DF"])

    def test_despesa_por_matricula_nao_publicada(self):
        ficha = next(i for i in self.g["indicadores"] if i["id"] == "edu.despesa_por_matricula")
        self.assertEqual(ficha["estado"], "NAO_PUBLICAVEL")
        self.assertTrue(ficha["motivo_nao_publicacao"])
        self.assertFalse(any(o["indicador"] == "edu.despesa_por_matricula" for o in self.obs))
        self.assertFalse(os.path.exists(os.path.join(RAIZ, "public", "eficiencia", "series", "edu_despesa_por_matricula.csv")))

    def test_campo_grande_2021_perimetro_distinto_em_toda_a_cadeia(self):
        """Perímetro comprovado pela MSC (modalidade 91): fora das comparações no valor nominal, no real e
        nas subfunções, com quebra de série; o valor oficial continua disponível."""
        cg = self.v("edu.despesa.funcao_educacao", 5002704, 2021, None, "nominal")
        self.assertEqual(cg["conferencia"]["situacao"], "PERIMETRO_INTRA_MSC")
        self.assertFalse(cg["elegivel_comparacao"])
        self.assertTrue(cg["conferencia"]["quebra_serie"])
        self.assertTrue(cg["nota_material"])
        self.assertAlmostEqual(cg["valor"], 1030887330.50, places=2)  # não subtraído em silêncio
        self.assertFalse(self.v("edu.despesa.funcao_educacao", 5002704, 2021, None, "real_2025")["elegivel_comparacao"])
        subs = [o for o in self.obs if o["indicador"] == "edu.despesa.subfuncao" and o["ente"] == 5002704 and o["ano"] == 2021]
        self.assertTrue(subs and all(not o["elegivel_comparacao"] and o["nota_material"] for o in subs))
        self.assertTrue(self.v("edu.despesa.funcao_educacao", 5002704, 2022, None, "nominal")["elegivel_comparacao"])

    def test_boa_vista_2024_reconciliada_pela_msc(self):
        bv = self.v("edu.despesa.funcao_educacao", 1400100, 2024, None, "nominal")
        c = bv["conferencia"]
        self.assertEqual(c["situacao"], "RECONCILIADA_MSC")
        self.assertTrue(bv["elegivel_comparacao"])
        self.assertAlmostEqual(c["msc"]["sem_intra"], bv["valor"], delta=1.0)
        self.assertAlmostEqual(c["rreo"]["exceto_intra"], 122547917.75, places=2)
        self.assertIn("não foi retificado", bv["nota"])
        self.assertTrue(bv["nota_material"])
        self.assertTrue(c["fontes_sha256"]["msc"] and c["fontes_sha256"]["dca"] and c["fontes_sha256"]["rreo"])

    # ---------------------------------------------------------------- estados de dado

    def test_ausencia_nunca_vira_zero(self):
        for o in self.obs:
            if o["status"] != "OBSERVADO":
                self.assertIsNone(o["valor"], o)
                self.assertTrue(o["nota"], o)

    def test_nao_aplicavel_quando_a_rede_nao_tem_a_etapa(self):
        rio_branco = 1200401
        self.assertEqual(self.v("edu.matriculas.rede_municipal", rio_branco, 2025, "anos_finais")["valor"], 0)
        self.assertEqual(self.v("edu.aprovacao.rede_municipal", rio_branco, 2025, "anos_finais")["status"], "NAO_APLICAVEL")
        self.assertEqual(self.v("edu.ideb.rede_municipal", rio_branco, 2025, "anos_finais", "ideb")["status"], "NAO_APLICAVEL")

    def test_ideb_sem_anos_pares(self):
        anos = {o["ano"] for o in self.obs if o["indicador"] in ("edu.ideb.rede_municipal", "edu.saeb.rede_municipal")}
        self.assertTrue(all(a % 2 == 1 for a in anos))

    def test_codigo_nd_preservado(self):
        nd = [o for o in self.obs if o["indicador"] in ("edu.ideb.rede_municipal", "edu.saeb.rede_municipal")
              and o["nota"] and "\"ND\"" in o["nota"]]
        self.assertTrue(nd)
        self.assertTrue(all(o["status"] == "NAO_DIVULGADO" and o["valor"] is None for o in nd))

    # ---------------------------------------------------------------- contas e partições

    def test_composicao_por_subfuncao_reconcilia(self):
        somas = {}
        for o in self.obs:
            if o["indicador"] == "edu.despesa.subfuncao" and o["status"] == "OBSERVADO":
                somas.setdefault((o["ente"], o["ano"]), [0.0, 0.0])
                somas[(o["ente"], o["ano"])][0] += o["valor"]
                somas[(o["ente"], o["ano"])][1] += o["participacao"]
        self.assertEqual(len(somas), 26 * len(P.ANOS_FINANCEIROS))
        for (ente, ano), (reais, pct) in somas.items():
            total = self.v("edu.despesa.funcao_educacao", ente, ano, None, "nominal")["valor"]
            self.assertAlmostEqual(reais, total, delta=1.0)
            self.assertAlmostEqual(pct, 100.0, delta=0.01)

    def test_matriculas_por_etapa_somam_o_total(self):
        etapas = [e for e, _ in P.ETAPAS_CENSO] + ["profissional"]
        for ind in ("edu.matriculas.rede_municipal", "edu.matriculas.conveniadas_municipais"):
            for cod, _, _ in entes.CAPITAIS:
                for ano in P.ANOS_CENSO:
                    total = self.v(ind, cod, ano, "total")["valor"]
                    self.assertEqual(sum(self.v(ind, cod, ano, e)["valor"] for e in etapas), total)

    def test_correcao_monetaria(self):
        f = self.g["ipca"]["fatores_para_2025"]
        self.assertEqual(f["2025"], 1.0)
        self.assertTrue(all(f[str(a)] > 1 for a in (2021, 2022, 2023, 2024)))
        o_nom = self.v("edu.despesa.funcao_educacao", 2611606, 2022, None, "nominal")
        o_real = self.v("edu.despesa.funcao_educacao", 2611606, 2022, None, "real_2025")
        self.assertAlmostEqual(o_real["valor"], round(o_nom["valor"] * o_real["fator_ipca"], 2), delta=0.011)
        self.assertEqual(o_real["fator_ipca"], f["2022"])

    # ---------------------------------------------------------------- publicação

    def test_download_tem_as_mesmas_observacoes_da_gold(self):
        for ind in self.g["indicadores"]:
            if not ind.get("download"):
                continue
            caminho = os.path.join(RAIZ, "public", ind["download"].lstrip("/"))
            with open(caminho, encoding="utf-8") as f:
                linhas = list(csv.DictReader(f))
            sel = [o for o in self.obs if o["indicador"] == ind["id"]]
            self.assertEqual(len(linhas), len(sel), ind["id"])
            for l in linhas:
                if l["status"] != "OBSERVADO":
                    self.assertEqual(l["valor"], "", l)

    def test_fichas_completas_antes_da_publicacao(self):
        campos = ["id", "nome", "pergunta", "o_que_mede", "o_que_nao_mede", "formula", "unidade", "escala", "fontes",
                  "localizacao_registro", "periodo", "perimetro", "ausencias", "transformacoes", "correcao_monetaria",
                  "comparacao", "natureza", "versao_metodologica", "estado"]
        publicados = {o["indicador"] for o in self.obs}
        for ind in self.g["indicadores"]:
            for c in campos:
                self.assertIn(c, ind, f"{ind['id']} sem {c}")
            if ind["id"] in publicados:
                self.assertIn(ind["estado"], ("PUBLICAVEL", "PUBLICAVEL_COM_RESSALVAS"))
                self.assertTrue(ind["download"])
        self.assertTrue(publicados <= {i["id"] for i in self.g["indicadores"]})

    def test_catalogo_sem_linguagem_avaliativa(self):
        proibidas = r"\b(eficiente|ineficiente|ineficiência|desperdício|melhor(es)?|pior(es)?|ranking|insight|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho)\b"
        texto = json.dumps(base.le_json(base.CATALOGO), ensure_ascii=False).lower()
        self.assertIsNone(re.search(proibidas, texto), re.search(proibidas, texto) and re.search(proibidas, texto).group(0))


class TestPoliticaConferencia(unittest.TestCase):
    """Casos sintéticos da política de conferência (fixtures em memória, nunca publicados)."""

    from pipeline.eficiencia import conferencia as CF

    def c(self, dca, rreo=None, intra=None, msc=None):
        r = None if rreo == "sem" else {"exceto_intra": rreo, "intra": intra}
        return self.CF.classifica(dca, r, msc)

    def test_compativeis(self):
        x = self.c(1000.0, 1000.0)
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("CONFERE", True))

    def test_limite_de_arredondamento(self):
        self.assertEqual(self.c(1_000_001.00, 1_000_000.00)["situacao"], "CONFERE")
        self.assertEqual(self.c(1_000_001.01, 1_000_000.00)["situacao"], "DIFERENCA_MENOR")

    def test_limite_relativo_de_um_milesimo(self):
        self.assertEqual(self.c(1_000_000.0, 999_000.0)["situacao"], "DIFERENCA_MENOR")   # exatamente 0,1%
        x = self.c(1_000_000.0, 998_999.0)                                                 # acima de 0,1%
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("PENDENTE", False))

    def test_diferenca_material_sem_explicacao(self):
        x = self.c(658.0e6, 122.5e6)
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("PENDENTE", False))
        self.assertTrue(x["motivo_inelegibilidade"])

    def test_coincidencia_com_intra_do_rreo_nao_basta(self):
        x = self.c(1124.0, 1000.0, intra=124.0)
        self.assertEqual(x["situacao"], "PENDENTE")

    def test_reconciliacao_pela_msc(self):
        x = self.c(658.0, 122.0, msc={"liquidado_total": 694.0, "intra_mod91": 36.0})
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("RECONCILIADA_MSC", True))

    def test_perimetro_pela_msc(self):
        x = self.c(1124.0, 1000.0, intra=124.0, msc={"liquidado_total": 1124.0, "intra_mod91": 124.0})
        self.assertEqual((x["situacao"], x["elegivel_comparacao"], x["quebra_serie"]), ("PERIMETRO_INTRA_MSC", False, True))

    def test_msc_que_nao_fecha_mantem_pendencia(self):
        x = self.c(658.0, 122.0, msc={"liquidado_total": 700.0, "intra_mod91": 10.0})
        self.assertEqual(x["situacao"], "PENDENTE")

    def test_reconciliacao_nao_autoriza_valor_novo(self):
        """A evidência é refeita a cada execução: uma DCA retificada não herda a reconciliação."""
        msc = {"liquidado_total": 694.0, "intra_mod91": 36.0}
        self.assertEqual(self.c(658.0, 122.0, msc=msc)["situacao"], "RECONCILIADA_MSC")
        self.assertEqual(self.c(700.0, 122.0, msc=msc)["situacao"], "PENDENTE")

    def test_msc_vinculada_ao_exercicio(self):
        self.assertIsNotNone(self.CF.msc(1400100, 2024))
        self.assertIsNone(self.CF.msc(1400100, 2023))
        self.assertIsNone(self.CF.msc(1400100, 2025))

    def test_rreo_ausente_linha_ausente_e_zero(self):
        self.assertEqual(self.c(1000.0, "sem")["situacao"], "NAO_CONFERIDO")
        self.assertEqual(self.c(1000.0, None)["situacao"], "NAO_CONFERIDO")
        x = self.c(1000.0, 0.0)  # RREO zerado: diferença material, sem divisão por zero
        self.assertEqual(x["situacao"], "PENDENTE")
        self.assertEqual(x["diferenca_pct_dca"], 100.0)
        self.assertFalse(self.c(1000.0, "sem")["elegivel_comparacao"])
        self.assertEqual(self.c(None, 1000.0)["situacao"], "NAO_CONFERIDO")


class TestAusenciaNaoViraZero(unittest.TestCase):
    from pipeline.eficiencia import padroniza as P

    def esc(self, **kv):
        base_ = {c: "" for c in self.P.COLUNAS_CONTAGEM}
        base_.update({"CO_ENTIDADE": kv.pop("id", "1"), "CO_MUNICIPIO": "9999999", "TP_DEPENDENCIA": "3"})
        base_.update({k: str(v) for k, v in kv.items()})
        return base_

    def cheia(self, i, bas=10):
        return self.esc(id=i, QT_MAT_BAS=bas, QT_MAT_INF_CRE=2, QT_MAT_INF_PRE=2, QT_MAT_FUND_AI=3, QT_MAT_FUND_AF=3,
                        QT_MAT_MED=0, QT_MAT_EJA=0)

    def test_leitura(self):
        self.assertEqual(self.P.ler_contagem("0"), 0)
        self.assertEqual(self.P.ler_contagem(" 12 "), 12)
        self.assertIsNone(self.P.ler_contagem(""))
        self.assertIsNone(self.P.ler_contagem(None))  # coluna inexistente
        with self.assertRaises(self.P.ValorInvalido):
            self.P.ler_contagem("ND")

    def test_zero_explicito_e_zero(self):
        tot, meta = self.P._somas([self.cheia("1")])
        self.assertEqual((tot["ensino_medio"], tot["total"], tot["profissional"]), (0, 10, 0))
        self.assertEqual(meta["sem_contagem"], [])

    def test_componente_ausente_nao_fabrica_total_nem_residuo(self):
        parcial = self.cheia("2")
        parcial["QT_MAT_EJA"] = ""
        tot, meta = self.P._somas([self.cheia("1"), parcial])
        self.assertIsNone(tot["eja"])
        self.assertIsNone(tot["profissional"])
        self.assertEqual(tot["creche"], 4)
        self.assertEqual(meta["parciais"], ["2"])

    def test_valor_invalido_invalida_o_agregado(self):
        ruim = self.cheia("2")
        ruim["QT_MAT_BAS"] = "abc"
        tot, meta = self.P._somas([self.cheia("1"), ruim])
        self.assertTrue(all(v is None for v in tot.values()))
        self.assertTrue(meta["invalidos"])

    def test_escola_sem_contagem_sem_confirmacao_vira_incompleto(self):
        ag = self.P.agrega_matriculas([self.cheia("1"), self.esc(id="2")], 1999, 9999999, "3")
        self.assertEqual(ag["status"]["total"][0], "INCOMPLETO")
        self.assertIn("Sinopse", ag["status"]["total"][1])

    def test_incompleto_nao_gera_nao_aplicavel(self):
        import unittest.mock as mock
        with mock.patch.object(self.P, "matriculas_rede", return_value={"anos_finais": None}):
            st, _ = self.P._status_codigo_inep("--", 2023, 9999999, "anos_finais")
        self.assertEqual(st, "NAO_DIVULGADO")
        with mock.patch.object(self.P, "matriculas_rede", return_value={"anos_finais": 0}):
            st, _ = self.P._status_codigo_inep("--", 2023, 9999999, "anos_finais")
        self.assertEqual(st, "NAO_APLICAVEL")

    def test_escolas_vazias_confirmadas_pela_sinopse(self):
        """Dado real: 2023, rede municipal de Belo Horizonte tem escolas sem contagem; a Sinopse confirma."""
        bh = 3106200
        v = self.P.grupo_verificado(2023, bh, "3")
        self.assertTrue(v["verificado"])
        o = [x for x in self.P.matriculas() if x["indicador"] == "edu.matriculas.rede_municipal" and x["ente"] == bh
             and x["ano"] == 2023 and x["etapa"] == "total"][0]
        self.assertEqual(o["status"], "OBSERVADO")
        self.assertEqual(o["valor"], v["sinopse"])
        if o["escolas_sem_contagem"]:
            self.assertIn("contribuição nula", o["nota"])
            self.assertFalse(o["nota_material"])


class TestBloqueioDePublicacao(unittest.TestCase):
    def test_reprovacao_nao_substitui_saida_publica(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            pub, diag = os.path.join(tmp, "public"), os.path.join(tmp, "diag")
            g = base.le_json(gold.ARQUIVO_GOLD)
            ok, _ = gold.promove(g, raiz_publica=pub)
            self.assertTrue(ok)
            alvo = os.path.join(pub, "eficiencia", "gold", "educacao_capitais.json")
            antes = Path(alvo).read_bytes()
            ruim = json.loads(json.dumps(g))
            ruim["validacoes"][0]["resultado"] = "reprovada"
            ruim["meta"]["hash_dados"] = "x"
            ok, caminho = gold.promove(ruim, raiz_publica=pub, diagnostico=diag)
            self.assertFalse(ok)
            self.assertTrue(caminho.startswith(diag) and os.path.exists(caminho))
            self.assertEqual(Path(alvo).read_bytes(), antes)

    def test_violacao_da_elegibilidade_reprova(self):
        from pipeline.eficiencia import validacoes as V
        g = gold.constroi(gerado_em="2026-10-08T00:00:00Z")
        obs = json.loads(json.dumps(g["observacoes"]))
        o = next(x for x in obs if x["ente"] == 5002704 and x["ano"] == 2021 and x["componente"] == "nominal")
        o["elegivel_comparacao"] = True
        self.assertEqual(V.v04_dca_rreo(obs)["resultado"], "reprovada")
        self.assertEqual(V.v13_elegibilidade(obs)["resultado"], "reprovada")


if __name__ == "__main__":
    unittest.main()
