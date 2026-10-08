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

    def test_dca_com_intraorcamentarias_fica_fora_da_comparacao(self):
        cg = self.v("edu.despesa.funcao_educacao", 5002704, 2021, None, "nominal")
        self.assertEqual(cg["conferencia_rreo"]["situacao"], "inclui_intra")
        self.assertFalse(cg["conferencia_rreo"]["comparavel"])
        self.assertTrue(cg["nota"])

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


if __name__ == "__main__":
    unittest.main()
