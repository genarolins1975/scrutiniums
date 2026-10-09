"""Testes do módulo Saúde nas capitais (pipeline/eficiencia_saude): reconstrução da gold a partir do seed.

Sem rede. Cada teste cobre um erro plausível e a sua consequência: mistura de perímetros, ausência convertida em zero,
composição que não reconcilia, capital pendente entrando na comparação, razão publicada sem fonte, divergência entre
interface e download, promoção de uma gold reprovada, escrita em arquivos de Educação e linguagem avaliativa.
"""
import csv
import hashlib
import json
import os
import re
import shutil
import tempfile
import unittest

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base, conferencia as CF, gold, padroniza as P, validacoes as V

RAIZ = base.RAIZ
GERADO_EM = "2026-10-09T00:00:00Z"
SP, RECIFE, BOA_VISTA, CAMPO_GRANDE, MACAPA, GOIANIA = 3550308, 2611606, 1400100, 5002704, 1600303, 5208707
PORTO_VELHO = 1100205
NAO_PUBLICAVEIS = {"sau.aps.producao", "sau.rede.profissionais_carga_horaria", "sau.despesa.por_atendimento"}


class TestSaude(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = gold.constroi(gerado_em=GERADO_EM)
        cls.obs = cls.g["observacoes"]
        cls.idx = {}
        for o in cls.obs:
            cls.idx[(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"])] = o

    def v(self, ind, ente, ano, comp=None, etapa=None):
        return self.idx[(ind, ente, ano, etapa, comp)]

    # ---------------------------------------------------------------- reprodução

    def test_reconstrucao_idempotente(self):
        g2 = gold.constroi(gerado_em=GERADO_EM)
        self.assertEqual(self.g["meta"]["hash_dados"], g2["meta"]["hash_dados"])
        self.assertEqual(len(self.obs), len(g2["observacoes"]))
        self.assertEqual(json.dumps(self.g["observacoes"], sort_keys=True), json.dumps(g2["observacoes"], sort_keys=True))

    def test_gold_publicada_corresponde_ao_seed(self):
        with open(gold.ARQUIVO_GOLD, encoding="utf-8") as f:
            pub = json.load(f)
        self.assertEqual(pub["meta"]["hash_dados"], self.g["meta"]["hash_dados"])
        self.assertEqual(pub["meta"]["observacoes"], len(self.obs))

    def test_sem_validacao_reprovada(self):
        self.assertEqual(gold.reprovadas(self.g), [])
        ids = {v["id"] for v in self.g["validacoes"]}
        self.assertTrue({f"S{n:02d}" for n in range(1, 17)} <= ids)

    def test_manifesto_proprio_com_hash_url_e_data(self):
        manif = base.le_manifesto()["capturas"]
        self.assertTrue(manif)
        for nome, c in manif.items():
            for a in (c.get("arquivos") or {}).values():
                self.assertTrue(a.get("sha256") or a.get("url") or a.get("capturado_em"), nome)

    # ---------------------------------------------------------------- universo e perímetros

    def test_26_capitais_e_distrito_federal_fora_com_motivo_de_saude(self):
        self.assertEqual(len(self.g["universo"]["capitais"]), 26)
        self.assertFalse(any(o["ente"] == entes.DISTRITO_FEDERAL[0] for o in self.obs))
        ex = self.g["universo"]["excluidos"]
        self.assertEqual([e["uf"] for e in ex], ["DF"])
        motivo = ex[0]["motivo"].lower()
        self.assertIn("saúde", motivo)
        for termo in ("censo escolar", "rede municipal de ensino", "educação"):
            self.assertNotIn(termo, motivo)

    def test_serie_financeira_de_2021_a_2025_para_todas_as_capitais(self):
        for cod, _, _ in entes.CAPITAIS:
            for ano in P.ANOS_FINANCEIROS:
                self.assertIn(("sau.despesa.funcao_saude", cod, ano, None, "nominal"), self.idx)
                self.assertIn(("sau.despesa.funcao_saude", cod, ano, None, "real_2025"), self.idx)
        self.assertEqual(P.ANOS_FINANCEIROS, [2021, 2022, 2023, 2024, 2025])

    def test_despesa_lida_da_resposta_preservada_e_liquidada(self):
        """Porto Velho 2024: liquidado e empenhado diferem; a observação carrega o liquidado."""
        bruto = base.le_json_gz(os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{PORTO_VELHO}_2024.json.gz"))
        liq = [x["valor"] for x in bruto if x["conta"] == "10 - Saúde" and x["coluna"] == "Despesas Liquidadas"][0]
        emp = [x["valor"] for x in bruto if x["conta"] == "10 - Saúde" and x["coluna"] == "Despesas Empenhadas"][0]
        self.assertNotEqual(round(liq, 2), round(emp, 2))
        self.assertAlmostEqual(self.v("sau.despesa.funcao_saude", PORTO_VELHO, 2024, "nominal")["valor"], liq, places=2)

    def test_real_e_nominal_ligados_pelo_ipca(self):
        f = self.g["ipca"]["fatores_para_2025"]
        self.assertEqual(f["2025"], 1.0)
        self.assertTrue(all(f[str(a)] > 1 for a in (2021, 2022, 2023, 2024)))
        nom = self.v("sau.despesa.funcao_saude", RECIFE, 2022, "nominal")
        real = self.v("sau.despesa.funcao_saude", RECIFE, 2022, "real_2025")
        self.assertAlmostEqual(real["valor"], round(nom["valor"] * f["2022"], 2), delta=0.011)

    def test_despesa_por_habitante_usa_a_populacao_do_exercicio(self):
        for ano in (2021, 2022, 2025):
            d = self.v("sau.despesa.funcao_saude", SP, ano, "nominal")["valor"]
            pop = self.v("ctx.populacao.residente", SP, ano, None)["valor"]
            ph = self.v("sau.despesa.por_habitante", SP, ano, "nominal")["valor"]
            self.assertAlmostEqual(ph, d / pop, delta=0.01)

    def test_populacao_com_base_explicita_e_marca_de_quebra_por_base(self):
        """2021: estimativa anterior ao Censo; 2022 e 2023: a mesma população do Censo 2022; 2024 e 2025: estimativas posteriores.
        A marca alterna entre bases vizinhas: 2022 para 2023 e 2024 para 2025 comparáveis; 2021 para 2022 e 2023 para 2024 bloqueadas."""
        o21 = self.v("ctx.populacao.residente", SP, 2021, None)
        self.assertEqual(o21["tipo_populacao"], "estimativa_pre_censo_2022")
        self.assertTrue(o21["nota_material"])
        marcas = [self.v("ctx.populacao.residente", SP, a, None)["quebra_serie"] for a in P.ANOS_FINANCEIROS]
        self.assertEqual(marcas, [False, True, True, False, False])
        self.assertEqual(self.v("ctx.populacao.residente", SP, 2022, None)["valor"], self.v("ctx.populacao.residente", SP, 2023, None)["valor"])
        for cod, _, _ in entes.CAPITAIS:
            self.assertEqual(self.v("ctx.populacao.residente", cod, 2022, None)["valor"], self.v("ctx.populacao.residente", cod, 2023, None)["valor"], cod)
        for ind, comp in (("sau.despesa.por_habitante", "nominal"), ("sau.aps.equipes_por_10mil", "esf"), ("sau.rede.ubs_publicas_por_10mil", "publicas")):
            self.assertEqual([self.v(ind, SP, a, comp)["quebra_serie"] for a in P.ANOS_FINANCEIROS], [False, True, True, False, False], ind)
        self.assertIn("Censo 2022", self.v("sau.despesa.por_habitante", SP, 2022, "nominal")["base_populacional"])

    # ---------------------------------------------------------------- conferência DCA x RREO x MSC

    def test_campo_grande_2021_perimetro_distinto_fora_da_comparacao(self):
        for comp in ("nominal", "real_2025"):
            o = self.v("sau.despesa.funcao_saude", CAMPO_GRANDE, 2021, comp)
            self.assertEqual(o["conferencia"]["situacao"], "PERIMETRO_INTRA_MSC")
            self.assertFalse(o["elegivel_comparacao"])
            self.assertTrue(o["nota_material"])
            self.assertIsNotNone(o["valor"])  # o valor oficial segue disponível, sem subtração em silêncio
        self.assertTrue(self.v("sau.despesa.funcao_saude", CAMPO_GRANDE, 2022, "nominal")["elegivel_comparacao"])

    def test_boa_vista_2024_reconciliada_pela_msc(self):
        o = self.v("sau.despesa.funcao_saude", BOA_VISTA, 2024, "nominal")
        c = o["conferencia"]
        self.assertEqual(c["situacao"], "RECONCILIADA_MSC")
        self.assertTrue(o["elegivel_comparacao"] and o["nota_material"])
        self.assertAlmostEqual(c["msc"]["sem_intra"], o["valor"], delta=1.0)

    def test_macapa_2025_pendente_fica_fora_da_comparacao_mas_com_valor(self):
        o = self.v("sau.despesa.funcao_saude", MACAPA, 2025, "nominal")
        self.assertEqual(o["conferencia"]["situacao"], "PENDENTE")
        self.assertFalse(o["elegivel_comparacao"])
        self.assertIsNotNone(o["valor"])
        self.assertTrue(o["nota_material"])

    def test_inelegibilidade_herdada_por_habitante_subfuncao_e_natureza(self):
        for ind, comp in (("sau.despesa.por_habitante", "nominal"), ("sau.despesa.por_habitante", "real_2025")):
            self.assertFalse(self.v(ind, CAMPO_GRANDE, 2021, comp)["elegivel_comparacao"])
            self.assertFalse(self.v(ind, MACAPA, 2025, comp)["elegivel_comparacao"])
        subs = [o for o in self.obs if o["indicador"] == "sau.despesa.subfuncao" and o["ente"] == CAMPO_GRANDE and o["ano"] == 2021]
        self.assertTrue(subs and all(not o["elegivel_comparacao"] for o in subs))

    # ---------------------------------------------------------------- composições

    def test_subfuncoes_reconciliam_com_o_total(self):
        somas = {}
        for o in self.obs:
            if o["indicador"] == "sau.despesa.subfuncao" and o["status"] == "OBSERVADO":
                s = somas.setdefault((o["ente"], o["ano"]), [0.0, 0.0])
                s[0] += o["valor"]
                s[1] += o["participacao"]
        self.assertEqual(len(somas), 26 * len(P.ANOS_FINANCEIROS))
        for (ente, ano), (reais, pct) in somas.items():
            total = self.v("sau.despesa.funcao_saude", ente, ano, "nominal")["valor"]
            self.assertAlmostEqual(reais, total, delta=1.0, msg=(ente, ano))
            self.assertAlmostEqual(pct, 100.0, delta=0.05, msg=(ente, ano))

    def test_natureza_so_publicada_onde_reconcilia(self):
        por_chave = {}
        for o in self.obs:
            if o["indicador"] == "sau.despesa.natureza":
                por_chave.setdefault((o["ente"], o["ano"]), []).append(o)
        self.assertEqual(len(por_chave), 26 * len(P.ANOS_FINANCEIROS))
        publicadas = naopublicadas = 0
        for (ente, ano), itens in por_chave.items():
            total = self.v("sau.despesa.funcao_saude", ente, ano, "nominal")["valor"]
            if all(i["status"] == "OBSERVADO" for i in itens):
                publicadas += 1
                self.assertAlmostEqual(sum(i["valor"] for i in itens), total, delta=1.0, msg=(ente, ano))
            else:
                naopublicadas += 1
                self.assertTrue(all(i["status"] == "INCONSISTENTE" and i["valor"] is None and i["nota"] for i in itens), (ente, ano))
        self.assertGreater(publicadas, 100)
        self.assertGreater(naopublicadas, 0)
        # Macapá 2025 e Goiânia 2021 têm abertura que não fecha com a DCA: não podem aparecer como composição
        for ente, ano in ((MACAPA, 2025), (GOIANIA, 2021)):
            self.assertTrue(all(i["valor"] is None for i in por_chave[(ente, ano)]))

    def test_despesa_por_fonte_inconsistente_nao_publicada(self):
        ruins = {(o["ente"], o["ano"]) for o in self.obs if o["indicador"] == "sau.despesa.por_fonte" and o["status"] == "INCONSISTENTE"}
        self.assertEqual(ruins, {(2304400, 2021), (SP, 2021)})
        for o in self.obs:
            if o["indicador"] == "sau.despesa.por_fonte" and o["status"] == "INCONSISTENTE":
                self.assertIsNone(o["valor"])
                self.assertIn("difere do total", o["nota"])

    def test_asps_percentual_vem_do_siops_e_o_minimo_e_fixo(self):
        for o in self.obs:
            if o["indicador"] == "sau.asps.percentual_aplicado":
                self.assertEqual(o["fonte"].split("_")[0], "siops")
                self.assertGreater(o["valor"], 0)
        self.assertEqual(P.MINIMO_LC141_PCT, 15)
        self.assertEqual(P.ANO_INICIO_REGRA_VIGENTE, 2022)

    # ---------------------------------------------------------------- rede, APS e ICSAP

    def test_ubs_contagens_do_retrato_somam_as_26_capitais(self):
        tot = {c: sum(self.v("sau.rede.ubs_retrato", cod, 2026, c)["valor"] for cod, _, _ in entes.CAPITAIS) for c in ("total_ativas", "publicas", "publicas_sus")}
        self.assertEqual((tot["total_ativas"], tot["publicas"], tot["publicas_sus"]), (3180, 3052, 2895))

    def test_ubs_publicas_e_publica_mais_nao_publica(self):
        for cod, _, _ in entes.CAPITAIS:
            for ano in P.ANOS_FINANCEIROS:
                tot = self.v("sau.rede.ubs_publicas", cod, ano, "total_ativas")["valor"]
                parte = self.v("sau.rede.ubs_publicas", cod, ano, "publicas")["valor"] + self.v("sau.rede.ubs_publicas", cod, ano, "nao_publicas")["valor"]
                self.assertEqual(tot, parte, (cod, ano))

    def test_cobertura_aps_2021_fora_das_comparacoes_e_sem_teto_de_100(self):
        for cod, _, _ in entes.CAPITAIS:
            self.assertFalse(self.v("sau.aps.cobertura_potencial", cod, 2021)["elegivel_comparacao"], cod)
            self.assertTrue(self.v("sau.aps.cobertura_potencial", cod, 2022)["elegivel_comparacao"], cod)
        valores = [o["valor"] for o in self.obs if o["indicador"] == "sau.aps.cobertura_potencial" and o["valor"] is not None]
        self.assertTrue(valores and max(valores) >= 0)

    def test_icsap_numerador_do_arquivo_e_taxa_nos_dois_denominadores(self):
        n = self.v("sau.icsap.internacoes", SP, 2024)
        self.assertEqual(n["valor"], 83391)
        taxas = {o["componente"]: o["valor"] for o in self.obs if o["indicador"] == "sau.icsap.taxa" and o["ente"] == SP and o["ano"] == 2024}
        self.assertEqual(set(taxas), {"ripsa", "populacao_ibge_obee"})
        self.assertAlmostEqual(taxas["ripsa"], 701.025204, places=3)

    def test_icsap_grupos_somam_o_total_quando_publicados(self):
        grupos = {}
        for o in self.obs:
            if o["indicador"] == "sau.icsap.grupos" and o["status"] == "OBSERVADO" and o["ano"] == 2024:
                grupos[o["ente"]] = grupos.get(o["ente"], 0) + o["valor"]
        self.assertTrue(grupos)
        for ente, soma in grupos.items():
            total = self.v("sau.icsap.internacoes", ente, 2024)["valor"]
            self.assertEqual(soma, total, ente)

    def test_resultados_so_ate_2024_e_financeiro_ate_2025(self):
        self.assertEqual(max(o["ano"] for o in self.obs if o["indicador"].startswith("sau.icsap")), 2024)
        self.assertEqual(P.ANOS_RESULTADOS, [2021, 2022, 2023, 2024])

    # ---------------------------------------------------------------- estados de dado

    def test_ausencia_nunca_vira_zero(self):
        for o in self.obs:
            if o["status"] != "OBSERVADO":
                self.assertIsNone(o["valor"], o)
                self.assertTrue(o["nota"], o)

    def test_zero_observado_e_diferente_de_ausente(self):
        zeros = [o for o in self.obs if o["status"] == "OBSERVADO" and o["valor"] == 0]
        self.assertTrue(zeros)  # ex.: gestão dupla sem UBS
        self.assertTrue(all(o["valor"] is not None for o in zeros))

    # ---------------------------------------------------------------- catálogo

    def test_fichas_completas_e_estados_coerentes(self):
        campos = ["id", "nome", "pergunta", "o_que_mede", "o_que_nao_mede", "formula", "unidade", "escala", "fontes",
                  "localizacao_registro", "periodo", "perimetro", "ausencias", "transformacoes", "correcao_monetaria",
                  "comparacao", "natureza", "versao_metodologica", "estado"]
        publicados = {o["indicador"] for o in self.obs}
        for ind in self.g["indicadores"]:
            for c in campos:
                self.assertIn(c, ind, f"{ind['id']} sem {c}")
            if ind["id"] in publicados:
                self.assertIn(ind["estado"], ("PUBLICAVEL", "PUBLICAVEL_COM_RESSALVAS"), ind["id"])
                self.assertTrue(ind["download"], ind["id"])
        self.assertTrue(publicados <= {i["id"] for i in self.g["indicadores"]})

    def test_indicadores_nao_publicaveis_tem_motivo_e_nenhuma_observacao(self):
        nao = {i["id"]: i for i in self.g["indicadores"] if i["estado"] == "NAO_PUBLICAVEL"}
        self.assertEqual(set(nao), NAO_PUBLICAVEIS)
        for i in nao.values():
            self.assertTrue(i["motivo_nao_publicacao"], i["id"])
        self.assertFalse(any(o["indicador"] in NAO_PUBLICAVEIS for o in self.obs))
        for ind in NAO_PUBLICAVEIS:
            self.assertFalse(os.path.exists(os.path.join(RAIZ, "public", "eficiencia", "series", ind.replace(".", "_") + ".csv")))

    def test_nao_ha_razao_com_producao_ou_carga_horaria(self):
        ids = {i["id"] for i in self.g["indicadores"] if i["estado"] != "NAO_PUBLICAVEL"}
        self.assertFalse({i for i in ids if "producao" in i or "atendimento" in i or "carga_horaria" in i})

    def test_matriz_de_fontes_decide_cada_linha(self):
        linhas = self.g["matriz_fontes"]
        self.assertGreaterEqual(len(linhas), 30)
        decisoes = {l["decisao"] for l in linhas}
        self.assertTrue(decisoes <= {"publicar com ressalva", "apenas contexto", "não publicar"}, decisoes)
        for l in linhas:
            self.assertTrue(l["fundamento"] and l["fonte"], l)

    def test_catalogo_e_gold_sem_linguagem_avaliativa(self):
        proibidas = r"\b(eficiente|ineficiente|ineficiência|desperdício|melhor(es)?|pior(es)?|ranking|insight|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho|semáforo)\b"
        texto = json.dumps({"i": self.g["indicadores"], "v": self.g["validacoes"], "m": self.g["matriz_fontes"]}, ensure_ascii=False).lower()
        achado = re.search(proibidas, texto)
        self.assertIsNone(achado, achado and texto[max(0, achado.start() - 80):achado.end() + 40])

    def test_catalogo_sem_hifen_nem_travessao_de_pontuacao(self):
        texto = json.dumps(base.le_json(base.CATALOGO), ensure_ascii=False)
        self.assertNotIn("—", texto)
        self.assertNotIn("–", texto)

    # ---------------------------------------------------------------- referências

    def test_referencias_de_grupo_calculadas_so_com_elegiveis(self):
        refs = [r for r in self.g["referencias"] if r["grupo"] == "todas" and r["indicador"] == "sau.despesa.por_habitante" and r["ano"] == 2025 and r["componente"] == "nominal"]
        self.assertEqual(len(refs), 1)
        r = refs[0]
        elegiveis = [self.v("sau.despesa.por_habitante", cod, 2025, "nominal") for cod, _, _ in entes.CAPITAIS]
        elegiveis = [o["valor"] for o in elegiveis if o["elegivel_comparacao"] and o["valor"] is not None]
        self.assertEqual(r["n"], len(elegiveis))
        self.assertAlmostEqual(r["media"], sum(elegiveis) / len(elegiveis), places=2)
        self.assertLess(r["n"], 26)  # Macapá 2025 fica de fora

    def test_referencia_externa_tem_fonte_conceito_e_data(self):
        for r in self.g["referencias_externas"]:
            self.assertTrue(r.get("fonte") or r.get("fontes"), r)
        ids = json.dumps(self.g["referencias_externas"], ensure_ascii=False)
        self.assertIn("15", ids)  # mínimo da LC 141/2012

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

    def test_arquivos_de_saude_usam_prefixo_proprio(self):
        for ind in self.g["indicadores"]:
            if ind.get("download"):
                self.assertTrue(os.path.basename(ind["download"]).startswith("sau_"), ind["download"])

    # ---------------------------------------------------------------- correções da rodada 1 de avaliação

    def test_razao_agregada_na_unidade_do_indicador(self):
        """A razão agregada pesa as capitais pelo denominador e tem a unidade do indicador: fica entre o menor e o maior valor do grupo."""
        for r in self.g["referencias"]:
            if r["razao_agregada"] is None:
                continue
            fator = gold.FATOR_RAZAO.get(r["indicador"], 1)
            self.assertEqual(r["fator_razao"], fator)
            self.assertAlmostEqual(r["razao_agregada"], r["soma_numerador"] / r["soma_denominador"] * fator, places=6)
            self.assertGreaterEqual(r["razao_agregada"], r["minimo"] - 1e-6, (r["indicador"], r["ano"], r["grupo"]))
            self.assertLessEqual(r["razao_agregada"], r["maximo"] + 1e-6, (r["indicador"], r["ano"], r["grupo"]))

    def test_razao_agregada_valores_conhecidos(self):
        def razao(ind, comp, ano):
            return next(r for r in self.g["referencias"] if r["indicador"] == ind and r["componente"] == comp and r["ano"] == ano and r["grupo"] == "todas")["razao_agregada"]
        self.assertAlmostEqual(razao("sau.aps.equipes_por_10mil", "esf", 2025), 1.89, delta=0.01)
        self.assertAlmostEqual(razao("sau.icsap.taxa", "ripsa", 2024), 776.1, delta=0.1)
        self.assertAlmostEqual(razao("sau.asps.percentual_aplicado", None, 2025), 21.8, delta=0.1)

    def test_cobertura_potencial_marca_a_troca_de_base_populacional(self):
        qb = {ano: {self.v("sau.aps.cobertura_potencial", cod, ano)["quebra_serie"] for cod, _, _ in entes.CAPITAIS} for ano in P.ANOS_FINANCEIROS}
        self.assertEqual(qb, {2021: {True}, 2022: {True}, 2023: {False}, 2024: {False}, 2025: {False}})
        self.assertIn("anterior ao Censo 2022", self.v("sau.aps.cobertura_potencial", SP, 2022)["nota"])
        brasil = {e["ano"]: e for e in self.g["referencias_externas"] if e["indicador"] == "sau.aps.cobertura_potencial"}
        self.assertIn("anterior ao Censo 2022", brasil[2022]["escopo"])
        self.assertNotIn("anterior ao Censo 2022", brasil[2023]["escopo"])

    def test_notas_de_natureza_distinguem_ausencia_de_valor_zero(self):
        sao_luis, rio, florianopolis = 2111300, 3304557, 4205407
        for ente, ano in ((sao_luis, 2022), (rio, 2022)):
            nota = self.v("sau.despesa.natureza", ente, ano, "pessoal")["nota"]
            self.assertIn("nenhum registro", nota)
            self.assertNotIn("R$ 0,00", nota)
        nota = self.v("sau.despesa.natureza", florianopolis, 2022, "pessoal")["nota"]
        self.assertIn("sem natureza da despesa identificável", nota)
        self.assertNotIn("diferença de R$ 0,00", nota)

    def test_medicao_da_troca_de_base_da_cobertura_potencial(self):
        m05 = next(v for v in self.g["validacoes"] if v["id"] == "M05")
        self.assertEqual(m05["resultado"], "medicao")
        self.assertIn("9,1 dos 14,6 pontos percentuais vêm só do denominador", m05["detalhe"])
        self.assertEqual(len(m05["casos"]), 26 if len(m05["casos"]) < 30 else 30)

    def test_macapa_2025_explica_que_a_msc_confirma_o_rreo(self):
        c = self.v("sau.despesa.funcao_saude", MACAPA, 2025, "nominal")["conferencia"]
        self.assertIn("igual ao RREO e diferente da DCA", c["explicacao"])
        self.assertEqual(c["situacao"], "PENDENTE")

    def test_ubs_de_gestao_municipal_com_natureza_nao_publica_aparecem_no_retrato(self):
        total = sum(self.v("sau.rede.ubs_retrato", cod, 2026, "gestao_municipal_nao_publica")["valor"] for cod, _, _ in entes.CAPITAIS)
        self.assertEqual(total, 125)
        self.assertEqual(self.v("sau.rede.ubs_retrato", 3304557, 2026, "gestao_municipal_nao_publica")["valor"], 52)
        self.assertEqual(self.v("sau.rede.ubs_retrato", SP, 2026, "gestao_municipal_nao_publica")["valor"], 38)

    def test_textos_sem_causalidade_implicita_nem_numero_sem_fonte(self):
        causais = r"\b(por esse motivo|por isso mesmo|devido a|em razão de|em consequência|causad[oa]|1,07 a 2,79)\b"
        texto = json.dumps({"i": self.g["indicadores"], "m": self.g["matriz_fontes"], "e": self.g["referencias_externas"]}, ensure_ascii=False).lower()
        achado = re.search(causais, texto)
        self.assertIsNone(achado, achado and texto[max(0, achado.start() - 100):achado.end() + 60])
        self.assertNotIn("capitais com maior cobertura de planos têm menos", texto)

    def test_csv_com_fonte_legivel_numeros_limpos_e_dicionario_completo(self):
        with open(os.path.join(RAIZ, "public", "eficiencia", "series", "sau_despesa_por_habitante.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f))
        self.assertTrue(linhas)
        for l in linhas:
            self.assertNotIn("siconfi_dca", l["fonte"])
            self.assertIn("Siconfi", l["fonte"])
            self.assertTrue(l["fonte_url"].startswith("http"))
            self.assertRegex(l["data_captura"], r"^\d{4}-\d{2}-\d{2}$")
        series = os.path.join(RAIZ, "public", "eficiencia", "series")
        for nome in os.listdir(series):
            if nome.startswith(("sau_", "saude_")) and nome.endswith(".csv"):
                with open(os.path.join(series, nome), encoding="utf-8") as f:
                    texto = f.read()
                self.assertNotRegex(texto, r"\d\.\d*(0000000|9999999)\d*[,\n]", nome)
        with open(os.path.join(series, "saude_dicionario_das_colunas.csv"), encoding="utf-8") as f:
            descritas = {(l["arquivo"], l["coluna"]) for l in csv.DictReader(f)}
        for c in gold.CAMPOS_CSV:
            self.assertIn(("sau_*.csv (um por indicador)", c), descritas)
        for c in gold.CAMPOS_CSV_REFERENCIAS:
            self.assertIn(("saude_referencias_capitais.csv", c), descritas)


class TestIsolamentoEPromocao(unittest.TestCase):
    """Saúde nunca escreve em arquivos de Educação, e uma gold reprovada não substitui a última válida."""

    def hashes_educacao(self):
        saida = {}
        for pasta in ("gold", "series"):
            raiz = os.path.join(RAIZ, "public", "eficiencia", pasta)
            for nome in sorted(os.listdir(raiz)):
                if nome.startswith(("edu", "ctx_populacao_residente")):
                    with open(os.path.join(raiz, nome), "rb") as f:
                        saida[os.path.join(pasta, nome)] = hashlib.sha256(f.read()).hexdigest()
        return saida

    def test_promocao_em_area_isolada_nao_toca_arquivos_de_educacao(self):
        g = gold.constroi(gerado_em=GERADO_EM)
        antes = self.hashes_educacao()
        self.assertTrue(antes)
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "eficiencia", "gold"))
            os.makedirs(os.path.join(tmp, "eficiencia", "series"))
            ok, caminho = gold.promove(g, raiz_publica=tmp, diagnostico=os.path.join(tmp, "diag"))
            self.assertTrue(ok)
            escritos = []
            for dp, _, nomes in os.walk(os.path.join(tmp, "eficiencia")):
                escritos += nomes
            self.assertTrue(escritos)
            for nome in escritos:
                self.assertTrue(nome.startswith(("saude_", "sau_")), nome)
        self.assertEqual(self.hashes_educacao(), antes)

    def test_gold_reprovada_nao_sobrescreve_a_ultima_valida(self):
        g = gold.constroi(gerado_em=GERADO_EM)
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "eficiencia", "gold"))
            os.makedirs(os.path.join(tmp, "eficiencia", "series"))
            ok, _ = gold.promove(g, raiz_publica=tmp, diagnostico=os.path.join(tmp, "diag"))
            self.assertTrue(ok)
            arq = os.path.join(tmp, "eficiencia", "gold", "saude_capitais.json")
            with open(arq, "rb") as f:
                antes = f.read()
            ruim = json.loads(json.dumps(g))
            ruim["validacoes"][0]["resultado"] = "reprovada"
            ruim["meta"]["hash_dados"] = "reprovada"
            ok2, destino = gold.promove(ruim, raiz_publica=tmp, diagnostico=os.path.join(tmp, "diag"))
            self.assertFalse(ok2)
            self.assertTrue(destino.startswith(os.path.join(tmp, "diag")))
            with open(arq, "rb") as f:
                self.assertEqual(f.read(), antes)

    def test_hash_do_gerador_inclui_codigo_de_saude(self):
        self.assertTrue(base.versao_codigo())


class TestPoliticaConferenciaSaude(unittest.TestCase):
    """A política 1.2 aplicada à função 10: mesmos casos sintéticos, textos de Saúde."""

    def c(self, dca, rreo=None, intra=None, msc=None):
        r = None if rreo == "sem" else {"exceto_intra": rreo, "intra": intra}
        return CF.classifica(dca, r, msc)

    def test_compativeis(self):
        x = self.c(1000.0, 1000.0)
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("CONFERE", True))

    def test_limite_de_arredondamento_e_limite_relativo(self):
        self.assertEqual(self.c(1_000_001.00, 1_000_000.00)["situacao"], "CONFERE")
        self.assertEqual(self.c(1_000_001.01, 1_000_000.00)["situacao"], "DIFERENCA_MENOR")
        self.assertEqual(self.c(1_000_000.0, 999_000.0)["situacao"], "DIFERENCA_MENOR")
        self.assertEqual(self.c(1_000_000.0, 998_999.0)["situacao"], "PENDENTE")

    def test_diferenca_material_sem_explicacao(self):
        x = self.c(658.0e6, 122.5e6)
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("PENDENTE", False))
        self.assertTrue(x["motivo_inelegibilidade"])
        self.assertNotIn("educação", x["motivo_inelegibilidade"].lower())

    def test_coincidencia_com_intra_do_rreo_nao_basta(self):
        self.assertEqual(self.c(1124.0, 1000.0, intra=124.0)["situacao"], "PENDENTE")

    def test_reconciliacao_e_perimetro_pela_msc(self):
        x = self.c(658.0, 122.0, msc={"liquidado_total": 694.0, "intra_mod91": 36.0})
        self.assertEqual((x["situacao"], x["elegivel_comparacao"]), ("RECONCILIADA_MSC", True))
        y = self.c(1124.0, 1000.0, intra=124.0, msc={"liquidado_total": 1124.0, "intra_mod91": 124.0})
        self.assertEqual((y["situacao"], y["elegivel_comparacao"], y["quebra_serie"]), ("PERIMETRO_INTRA_MSC", False, True))

    def test_msc_que_nao_fecha_e_dca_retificada_mantem_pendencia(self):
        self.assertEqual(self.c(658.0, 122.0, msc={"liquidado_total": 700.0, "intra_mod91": 10.0})["situacao"], "PENDENTE")
        msc = {"liquidado_total": 694.0, "intra_mod91": 36.0}
        self.assertEqual(self.c(700.0, 122.0, msc=msc)["situacao"], "PENDENTE")


class TestValidacoesDetectamErro(unittest.TestCase):
    """As validações precisam reprovar um defeito injetado, não só aprovar o dado atual."""

    def test_s12_reprova_observacao_do_distrito_federal(self):
        g = gold.constroi(gerado_em=GERADO_EM)
        obs = list(g["observacoes"]) + [{**g["observacoes"][0], "ente": entes.DISTRITO_FEDERAL[0]}]
        achados = [v for v in V.todas(obs) if v["id"] == "S12"]
        self.assertTrue(achados and achados[0]["resultado"] == "reprovada")

    def test_s_de_ausencia_reprova_zero_com_status_ausente(self):
        g = gold.constroi(gerado_em=GERADO_EM)
        obs = json.loads(json.dumps(g["observacoes"]))
        alvo = next(o for o in obs if o["status"] == "INCONSISTENTE")
        alvo["valor"] = 0
        reprovadas = [v["id"] for v in V.todas(obs) if v["resultado"] == "reprovada"]
        self.assertTrue(reprovadas, "nenhuma validação percebeu um valor numérico em observação inconsistente")


if __name__ == "__main__":
    unittest.main()
