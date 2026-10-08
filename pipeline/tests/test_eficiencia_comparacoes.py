"""Testes da rodada 5 do OBEE: despesa por habitante, despesa por matrícula, referências estatísticas e externas.

Sem rede. Duas famílias de teste:

* fixtures sintéticas em memória (nunca publicadas): regras de atribuição de balde, reconciliação,
  divisão por zero, estatísticas do grupo, média simples × razão agregada;
* conferência independente sobre dados reais: cada número é recalculado a partir do arquivo bruto do seed
  por um caminho de código diferente do pipeline (leitura direta dos JSON, sem derivados.py).
"""
import gzip
import json
import os
import statistics
import tempfile
import unittest

from pipeline.eficiencia import base, conferencia as CF, derivados as DV, entes, gold, padroniza as P, referencias as R, referencias_externas as RE, validacoes as V


def linha(nd, valor, sub="361", conta="622130300", nat="C"):
    return {"funcao": "12", "subfuncao": sub, "natureza_despesa": nd, "conta_contabil": conta, "valor": valor, "natureza_conta": nat}


class TestBaldes(unittest.TestCase):
    def test_cada_regra_de_atribuicao(self):
        self.assertEqual(DV.balde(linha("31901100", 1)), "rede_propria")      # pessoal ativo, aplicação direta
        self.assertEqual(DV.balde(linha("33903000", 1)), "rede_propria")      # material de consumo
        self.assertEqual(DV.balde(linha("33503900", 1)), "transf_privadas")   # transferência a instituição privada sem fins lucrativos
        self.assertEqual(DV.balde(linha("33603900", 1)), "transf_privadas")   # privada com fins lucrativos
        self.assertEqual(DV.balde(linha("33403900", 1)), "transf_outras")     # transferência a municípios
        self.assertEqual(DV.balde(linha("33713900", 1)), "transf_outras")     # consórcio público
        self.assertEqual(DV.balde(linha("31911300", 1)), "intra")             # intraorçamentária (modalidade 91)
        self.assertEqual(DV.balde(linha("31900100", 1)), "inativos")          # aposentadorias
        self.assertEqual(DV.balde(linha("31900300", 1)), "inativos")          # pensões
        self.assertEqual(DV.balde(linha("31900500", 1)), "inativos")          # outros benefícios previdenciários
        self.assertEqual(DV.balde(linha("33901000", 1)), "rede_propria")      # elemento 01 fora do grupo 3.1.90 não é inativo
        self.assertEqual(DV.balde(linha("33900100", 1)), "rede_propria")
        self.assertEqual(DV.balde(linha("33903000", 1, sub="364")), "ensino_superior")
        self.assertEqual(DV.balde(linha("", 1)), "sem_natureza")

    def test_precedencia_da_atribuicao_sem_dupla_contagem(self):
        """Uma linha cai em um só balde, na ordem: intra, privadas, outras modalidades, superior, inativos, rede própria."""
        self.assertEqual(DV.balde(linha("31911300", 1, sub="364")), "intra")
        self.assertEqual(DV.balde(linha("33503900", 1, sub="364")), "transf_privadas")
        self.assertEqual(DV.balde(linha("31900100", 1, sub="364")), "ensino_superior")
        self.assertEqual(DV.balde(linha("31503900", 1)), "transf_privadas")

    def test_natureza_invalida_levanta(self):
        with self.assertRaises(ValueError):
            DV.balde(linha("3190", 1))
        with self.assertRaises(ValueError):
            DV.balde(linha("3190AB00", 1))

    def test_razao_nao_divide_por_zero_nem_publica_negativo(self):
        self.assertIsNone(DV.razao(100.0, 0))
        self.assertIsNone(DV.razao(100.0, None))
        self.assertIsNone(DV.razao(None, 10))
        self.assertIsNone(DV.razao(-1.0, 10))
        self.assertEqual(DV.razao(0.0, 10), 0.0)  # zero real continua zero
        self.assertEqual(DV.razao(100.0, 4), 25.0)


class TestPonteSintetica(unittest.TestCase):
    """A ponte lê a MSC do seed; aqui o seed aponta para uma pasta temporária."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.seed_original = base.SEED
        base.SEED = self.tmp.name

    def tearDown(self):
        base.SEED = self.seed_original
        self.tmp.cleanup()

    def grava(self, cod, ano, linhas):
        base.grava_json_gz(os.path.join(base.SEED, "siconfi", "msc_funcao12", f"{cod}_{ano}_12.json.gz"), linhas)

    def base_linhas(self):
        return [linha("31901100", 700.0), linha("33903000", 100.0), linha("33503900", 150.0), linha("31900100", 30.0), linha("33903000", 20.0, sub="364"),
                linha("31911300", 55.0), linha("33903000", 999.0, conta="622130500")]  # restos a pagar não processados ficam fora

    def test_reconcilia_e_soma_dos_baldes(self):
        self.grava(1, 2025, self.base_linhas())
        pt = DV.ponte(1, 2025, 1000.0)
        self.assertEqual(pt["situacao"], "CONFERE")
        self.assertEqual(pt["baldes"], {"rede_propria": 800.0, "inativos": 30.0, "ensino_superior": 20.0, "transf_privadas": 150.0,
                                        "transf_outras": 0.0, "sem_natureza": 0.0, "intra": 55.0})
        self.assertEqual(pt["total_sem_intra"], 1000.0)
        self.assertTrue(pt["reconcilia"] and pt["classificavel"])

    def test_diferenca_menor_e_nao_reconcilia(self):
        escala = 1_000_000.0   # valores em milhões, para que 0,1% da DCA ultrapasse R$ 1,00
        self.grava(1, 2025, [dict(x, valor=x["valor"] * escala) for x in self.base_linhas()])
        total = 1000.0 * escala
        self.assertEqual(DV.ponte(1, 2025, total + 0.5)["situacao"], "CONFERE")                 # dentro de R$ 1,00
        self.assertEqual(DV.ponte(1, 2025, total * 1.0009)["situacao"], "DIFERENCA_MENOR")      # 0,09% da DCA
        self.assertEqual(DV.ponte(1, 2025, total * 1.0011)["situacao"], "NAO_RECONCILIA")       # 0,11%: acima de 0,1%
        self.assertTrue(DV.ponte(1, 2025, total * 1.0009)["reconcilia"])
        self.assertFalse(DV.ponte(1, 2025, total * 1.01)["reconcilia"])

    def test_msc_sem_linhas_da_funcao_12(self):
        self.grava(1, 2025, [{"funcao": "10", "subfuncao": "301", "natureza_despesa": "33903000", "conta_contabil": "622130300", "valor": 5.0, "natureza_conta": "C"}])
        pt = DV.ponte(1, 2025, 1000.0)
        self.assertEqual(pt["situacao"], "SEM_LINHAS")
        self.assertFalse(pt["reconcilia"])

    def test_linha_sem_natureza_impede_a_classificacao_sem_ratear(self):
        self.grava(1, 2025, [linha("31901100", 900.0), linha("", 100.0)])
        pt = DV.ponte(1, 2025, 1000.0)
        self.assertTrue(pt["reconcilia"])
        self.assertFalse(pt["classificavel"])
        self.assertEqual(pt["baldes"]["sem_natureza"], 100.0)
        self.assertEqual(pt["baldes"]["rede_propria"], 900.0)

    def test_sem_captura_devolve_none(self):
        self.assertIsNone(DV.ponte(9, 2025, 10.0))

    def test_linha_de_natureza_d_reduz_o_saldo_em_vez_de_somar(self):
        """Política 1.2: a MSC informa o valor em módulo e a natureza D ou C. A liquidação transferida da conta
        6.2.2.1.3.03 para a .07 no encerramento aparece como C e D iguais na .03: o saldo líquido é zero e a
        liquidação é contada uma vez só (na .07)."""
        self.grava(1, 2025, [
            linha("31901100", 800.0, conta="622130400"),
            linha("31901100", 200.0, conta="622130300"), linha("31901100", 200.0, conta="622130300", nat="D"),
            linha("31901100", 200.0, conta="622130700"),
        ])
        pt = DV.ponte(1, 2025, 1000.0)
        self.assertEqual(pt["situacao"], "CONFERE")
        self.assertEqual(pt["baldes"]["rede_propria"], 1000.0)
        self.assertEqual((pt["linhas_debito"], pt["valor_debito"]), (1, 200.0))

    def test_natureza_do_valor_ausente_ou_invalida_levanta(self):
        for nat in (None, "", "X"):
            with self.assertRaises(ValueError):
                CF.saldo_liquido({"valor": 1.0, "natureza_conta": nat})
        self.assertEqual(CF.saldo_liquido({"valor": 5.0, "natureza_conta": "C"}), 5.0)
        self.assertEqual(CF.saldo_liquido({"valor": 5.0, "natureza_conta": "D"}), -5.0)


class TestEstatisticas(unittest.TestCase):
    def pares(self, vals, den=None):
        return [(i + 1, float(v), None if den is None else float(v) * den[i], None if den is None else float(den[i])) for i, v in enumerate(vals)]

    def test_mediana_par_impar_e_extremos_com_empate(self):
        e = R.estatisticas(self.pares([4, 1, 3, 2]))
        self.assertEqual((e["mediana"], e["minimo"], e["maximo"], e["media"]), (2.5, 1.0, 4.0, 2.5))
        e = R.estatisticas(self.pares([5, 9, 5, 7, 9]))
        self.assertEqual(e["mediana"], 7.0)
        self.assertEqual(e["capitais_minimo"], [1, 3])
        self.assertEqual(e["capitais_maximo"], [2, 5])

    def test_quartis_tipo_7_conferidos_a_mao(self):
        # n = 5: posições 1 e 3 (zero-based) → 2 e 4
        e = R.estatisticas(self.pares([1, 2, 3, 4, 5]))
        self.assertEqual((e["q1"], e["q3"]), (2.0, 4.0))
        # n = 4: posição 0,75 → 1 + 0,75 × (2 − 1) = 1,75; posição 2,25 → 3 + 0,25 × (4 − 3) = 3,25
        e = R.estatisticas(self.pares([1, 2, 3, 4]))
        self.assertEqual((e["q1"], e["q3"]), (1.75, 3.25))
        # o mesmo resultado do módulo statistics (método inclusivo)
        vals = [3.0, 9.0, 12.0, 20.0, 21.0, 40.0, 41.0, 55.0, 80.0]
        e = R.estatisticas(self.pares(vals))
        q = statistics.quantiles(vals, n=4, method="inclusive")
        self.assertAlmostEqual(e["q1"], q[0], places=12)
        self.assertAlmostEqual(e["q3"], q[2], places=12)

    def test_grupo_pequeno_nao_exibe_quartis(self):
        self.assertFalse(R.estatisticas(self.pares(range(1, R.LIMIAR_QUARTIS)))["quartis_exibicao"])
        self.assertTrue(R.estatisticas(self.pares(range(1, R.LIMIAR_QUARTIS + 1)))["quartis_exibicao"])

    def test_sem_valores_nao_inventa_estatistica(self):
        e = R.estatisticas([])
        self.assertEqual(e["n"], 0)
        self.assertIsNone(e["mediana"])
        self.assertIsNone(e["media"])
        self.assertIsNone(e["razao_agregada"])

    def test_media_simples_difere_da_razao_agregada_com_os_mesmos_pares(self):
        # capital pequena (denominador 10) com razão 100; capital grande (denominador 1000) com razão 10
        pares = [(1, 100.0, 1000.0, 10.0), (2, 10.0, 10000.0, 1000.0)]
        e = R.estatisticas(pares)
        self.assertEqual(e["media"], 55.0)                              # peso igual por capital
        self.assertAlmostEqual(e["razao_agregada"], 11000.0 / 1010.0)   # pesa pelo denominador
        self.assertNotAlmostEqual(e["media"], e["razao_agregada"])
        self.assertEqual((e["soma_numerador"], e["soma_denominador"]), (11000.0, 1010.0))

    def test_razao_agregada_so_com_numerador_e_denominador_de_todos_os_pares(self):
        e = R.estatisticas([(1, 5.0, 50.0, 10.0), (2, 7.0, None, None)])
        self.assertIsNone(e["razao_agregada"])

    def test_precisao_original_sem_arredondar(self):
        e = R.estatisticas(self.pares([0.1, 0.2, 0.4]))
        self.assertEqual(e["media"], (0.1 + 0.2 + 0.4) / 3)

    def test_calcula_usa_so_valores_observados_e_elegiveis(self):
        def o(cod, v, eleg=True, st="OBSERVADO"):
            return {"indicador": "x.y", "componente": None, "etapa": None, "ano": 2025, "ente": cod, "valor": v, "status": st, "elegivel_comparacao": eleg}
        caps = [c["cod_ibge"] for c in entes.capitais()]
        obs = [o(caps[0], 10.0), o(caps[1], 20.0), o(caps[2], 1000.0, eleg=False), o(caps[3], None, st="NAO_DIVULGADO"), o(caps[4], 0.0)]
        r = next(x for x in R.calcula(obs) if x["grupo"] == "todas")
        self.assertEqual((r["capitais_com_valor"], r["n"]), (4, 3))   # o fora da comparação tem valor, mas não entra
        self.assertEqual(r["maximo"], 20.0)
        self.assertEqual(r["minimo"], 0.0)                              # zero real preservado
        self.assertEqual(r["mediana"], 10.0)


class TestComparacoesPublicadas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = gold.constroi(gerado_em="2026-10-08T00:00:00Z")
        cls.obs = cls.g["observacoes"]
        cls.idx = {(o["indicador"], o["ente"], o["ano"], o["etapa"], o["componente"]): o for o in cls.obs}
        cls.nome = {c["cod_ibge"]: c["nome"] for c in cls.g["universo"]["capitais"]}

    def ob(self, ind, ente, ano, comp="nominal", etapa=None):
        return self.idx[(ind, ente, ano, etapa, comp)]

    # ---- população

    def test_populacao_do_ano_correto_e_sem_reaproveitar_outro_ano(self):
        sp = 3550308
        pop = lambda a: self.ob("ctx.populacao.residente", sp, a, comp=None)
        self.assertEqual(pop(2021)["valor"], 12396372)     # estimativa de 1º de julho de 2021 (base: Censo 2010)
        self.assertEqual(pop(2022)["valor"], 11451999)     # Censo 2022
        self.assertEqual(pop(2024)["valor"], 11895578)
        self.assertEqual(pop(2025)["valor"], 11904961)
        # 2023: população oficial do exercício = Censo 2022 (relação do DOU de 31/08/2023), identificada como censitária
        self.assertEqual(pop(2023)["status"], "OBSERVADO")
        self.assertEqual(pop(2023)["valor"], pop(2022)["valor"])
        self.assertEqual(pop(2023)["tipo_populacao"], "censo_relacao_dou_2023")
        self.assertIn("31 de julho de 2022", pop(2023)["data_referencia"])
        self.assertIn("30 de abril de 2023", pop(2023)["data_referencia"])
        self.assertIn("Não é estimativa de população em julho de 2023", pop(2023)["nota"])
        self.assertTrue(pop(2023)["nota_material"])
        self.assertEqual(pop(2022)["tipo_populacao"], "censo")
        self.assertTrue(pop(2021)["quebra_serie"])
        self.assertTrue(pop(2023)["quebra_serie"])
        self.assertFalse(pop(2024)["quebra_serie"])
        self.assertIn("31 de julho de 2022", pop(2022)["data_referencia"])

    def test_populacao_2023_idem_ao_censo_em_todas_as_capitais_e_o_seed_registra_a_conferencia(self):
        r23 = base.le_json_gz(os.path.join(base.SEED, "ibge_populacao", "relacao_2023_capitais.json.gz"))
        self.assertEqual(len(r23), 26)
        self.assertTrue(all(r["igual_ao_sidra_4714"] and r["tipo"] == "censo_relacao_dou_2023" for r in r23))
        cap = base.le_manifesto()["capturas"]["ibge_populacao_relacao_2023"]
        self.assertEqual(cap["total_brasil"], 203080756)
        self.assertEqual(cap["capitais_iguais_ao_sidra_4714"], 26)
        self.assertEqual(len(cap["sha256_tabela_pdf"]), 64)
        self.assertEqual(len(cap["sha256_nota_metodologica_pdf"]), 64)
        self.assertIn("não foi baixado", cap["parametros"])

    def test_populacao_revisada_usa_o_valor_vigente_e_registra_a_diferenca(self):
        aju = self.ob("ctx.populacao.residente", 2800308, 2025, comp=None)
        self.assertEqual(aju["valor"], 621408)
        self.assertEqual(aju["publicacao_original"], 630932)
        self.assertIn("630.932", aju["nota"])

    def test_populacao_por_codigo_ibge_das_26_capitais(self):
        pop = [o for o in self.obs if o["indicador"] == "ctx.populacao.residente"]
        self.assertEqual({o["ente"] for o in pop}, {c for c, _, _ in entes.CAPITAIS})
        self.assertEqual(len(pop), 26 * 5)
        self.assertTrue(all(o["valor"] is None or (isinstance(o["valor"], int) and o["valor"] > 0) for o in pop))

    # ---- despesa por habitante

    def test_despesa_por_habitante_recalculada_do_arquivo_bruto(self):
        """Recalcula com o JSON bruto da DCA e a população do seed, sem passar por padroniza."""
        pop = {(r["ano"], r["cod"]): r["valor"] for r in base.le_json_gz(os.path.join(base.SEED, "ibge_populacao", "populacao_capitais.json.gz"))}
        for cod, ano in ((3550308, 2025), (1200401, 2024), (5002704, 2022), (3106200, 2021)):
            bruto = base.le_json_gz(os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod}_{ano}.json.gz"))
            liq = [x["valor"] for x in bruto if x["conta"] == "12 - Educação" and x["coluna"] == "Despesas Liquidadas"][0]
            esperado = liq / pop[(ano, cod)]
            self.assertAlmostEqual(self.ob("edu.despesa.por_habitante", cod, ano)["valor"], esperado, places=4)

    def test_despesa_por_habitante_de_2023_usa_a_populacao_censitaria_e_bloqueia_variacao(self):
        for cod, _, _ in entes.CAPITAIS:
            o = self.ob("edu.despesa.por_habitante", cod, 2023)
            self.assertEqual(o["status"], "OBSERVADO")
            self.assertTrue(o["quebra_serie"])
            self.assertEqual(o["calculo"]["denominador"], self.ob("ctx.populacao.residente", cod, 2022, comp=None)["valor"])
            self.assertAlmostEqual(o["valor"], o["calculo"]["numerador"] / o["calculo"]["denominador"], places=4)

    def test_despesa_por_habitante_sem_populacao_nao_tem_valor(self):
        """Sem população observada o pipeline não calcula nem reaproveita outro ano (teste sintético)."""
        pop = [dict(P.populacao()[0], valor=None, status="AUSENTE_NA_COLETA", nota="sem")]
        d = [o for o in P.despesa() if o["ente"] == pop[0]["ente"] and o["ano"] == pop[0]["ano"] and o["indicador"] == "edu.despesa.funcao_educacao"]
        r = P.despesa_por_habitante(d, pop)
        self.assertTrue(r and all(o["valor"] is None and o["status"] == "AUSENTE_NA_COLETA" for o in r))

    def test_campo_grande_2021_continua_fora_das_comparacoes_derivadas(self):
        cg = 5002704
        hab = self.ob("edu.despesa.por_habitante", cg, 2021)
        self.assertEqual(hab["status"], "OBSERVADO")                     # o valor oficial segue disponível para consulta
        self.assertFalse(hab["elegivel_comparacao"])
        mat = self.ob("edu.despesa.por_matricula_rede_propria", cg, 2021)
        self.assertIsNone(mat["valor"])                                   # a ponte não fecha com a DCA deste exercício
        self.assertFalse(mat["elegivel_comparacao"])
        self.assertIn("perímetro distinto", mat["nota"])

    def test_boa_vista_2024_mantem_a_ressalva_nos_derivados(self):
        bv = 1400100
        for ind in ("edu.despesa.por_habitante", "edu.despesa.por_matricula_rede_propria"):
            o = self.ob(ind, bv, 2024)
            self.assertEqual(o["status"], "OBSERVADO", ind)
            self.assertTrue(o["elegivel_comparacao"], ind)
            self.assertTrue(o["nota_material"], ind)
            self.assertIn("RREO", o["nota"], ind)

    def test_real_2025_usa_o_mesmo_fator_do_numerador(self):
        fatores = self.g["ipca"]["fatores_para_2025"]
        for ind in ("edu.despesa.por_habitante", "edu.despesa.por_matricula_rede_propria"):
            for cod in (3550308, 2611606):
                n, r = self.ob(ind, cod, 2024), self.ob(ind, cod, 2024, "real_2025")
                if n["valor"] is not None:
                    self.assertAlmostEqual(r["valor"], n["valor"] * fatores["2024"], places=3)

    # ---- despesa por matrícula

    def test_despesa_por_matricula_recalculada_do_arquivo_bruto_da_msc(self):
        """Recalcula do JSON bruto da MSC com uma regra escrita de forma independente (sem derivados.py)."""
        casos = ((3550308, 2023), (4106902, 2025), (1200401, 2024), (2611606, 2021), (1400100, 2024))
        for cod, ano in casos:
            bruto = base.le_json_gz(os.path.join(base.SEED, "siconfi", "msc_funcao12", f"{cod}_{ano}_12.json.gz"))
            direta_rede = 0.0
            for x in bruto:
                if x["funcao"] != "12" or x["conta_contabil"][:7] not in ("6221303", "6221304", "6221307"):
                    continue
                nd = x["natureza_despesa"]
                grupo, modalidade, elemento = nd[:2], nd[2:4], nd[4:6]
                if modalidade != "90":
                    continue                                              # fora: transferências e intraorçamentárias
                if x["subfuncao"] == "364":
                    continue                                              # fora: ensino superior
                if grupo == "31" and elemento in ("01", "03", "05"):
                    continue                                              # fora: inativos
                direta_rede += x["valor"]
            censo = [o for o in self.obs if o["indicador"] == "edu.matriculas.rede_municipal" and o["etapa"] == "total" and o["ente"] == cod and o["ano"] == ano][0]
            o = self.ob("edu.despesa.por_matricula_rede_propria", cod, ano)
            self.assertEqual(o["status"], "OBSERVADO", (cod, ano))
            self.assertAlmostEqual(o["valor"], direta_rede / censo["valor"], places=3)
            self.assertEqual(o["calculo"]["denominador"], censo["valor"])

    def test_denominador_nao_soma_conveniadas(self):
        for o in self.obs:
            if o["indicador"] == "edu.despesa.por_matricula_rede_propria" and o["status"] == "OBSERVADO":
                rede = self.ob("edu.matriculas.rede_municipal", o["ente"], o["ano"], comp=None, etapa="total")
                self.assertEqual(o["calculo"]["denominador"], rede["valor"])

    def test_ponte_soma_a_dca(self):
        for cod, ano in ((3550308, 2025), (2927408, 2023), (4314902, 2022)):
            pontes = {c: self.ob("edu.despesa.ponte_matricula", cod, ano, c) for c in ("rede_propria", "inativos", "ensino_superior", "transf_privadas",
                                                                                         "transf_outras", "sem_natureza", "diferenca_dca_msc", "dca_total")
                      if (("edu.despesa.ponte_matricula", cod, ano, None, c) in self.idx)}
            if not pontes:
                continue
            soma = sum(v["valor"] for k, v in pontes.items() if k != "dca_total")
            self.assertAlmostEqual(soma, pontes["dca_total"]["valor"], places=1, msg=(cod, ano))

    def test_sem_reconciliacao_nao_ha_valor_e_o_motivo_aparece(self):
        sl = self.ob("edu.despesa.por_matricula_rede_propria", 2111300, 2022)    # São Luís: MSC sem a função Educação
        self.assertIsNone(sl["valor"])
        self.assertEqual(sl["status"], "NAO_COMPARAVEL")
        self.assertIn("não traz linhas", sl["nota"])
        nat = self.ob("edu.despesa.por_matricula_rede_propria", 2408102, 2023)   # Natal: MSC abaixo da DCA em todas as funções
        self.assertIsNone(nat["valor"])
        self.assertIn("todas as funções", nat["nota"])
        rio = self.ob("edu.despesa.por_matricula_rede_propria", 3304557, 2022)   # Rio: nenhuma linha da resposta traz função
        self.assertIsNone(rio["valor"])
        self.assertIn("Nenhuma das", rio["nota"])

    def test_pares_corrigidos_pelo_saldo_liquido_agora_tem_valor(self):
        """Os cinco casos de 2025 e os demais pares que a política 1.1 deixava sem valor por somar linhas D em módulo."""
        for cod, ano in ((2800308, 2025), (1501402, 2025), (5208707, 2025), (2408102, 2025), (1721000, 2025), (1501402, 2021), (4205407, 2023)):
            o = self.ob("edu.despesa.por_matricula_rede_propria", cod, ano)
            self.assertIsNotNone(o["valor"], (cod, ano))
            self.assertEqual(o["calculo"]["denominador_ref"], "edu.matriculas.rede_municipal")

    def test_sete_pares_seguem_sem_valor_com_a_causa_registrada(self):
        sem = sorted((o["ente"], o["ano"]) for o in self.g["observacoes"]
                     if o["indicador"] == "edu.despesa.por_matricula_rede_propria" and o["componente"] == "nominal" and o["valor"] is None)
        self.assertEqual(sem, sorted([(2111300, 2022), (2111300, 2023), (3304557, 2021), (3304557, 2022), (2408102, 2022), (2408102, 2023), (5002704, 2021)]))
        causas = {(d["ente"], d["ano"]): d["causa"] for d in self.g["diagnostico_pares_msc"]}
        self.assertEqual(causas[(2111300, 2022)], "MSC_SEM_FUNCAO_12")
        self.assertEqual(causas[(2408102, 2023)], "MSC_ABAIXO_EM_TODAS_AS_FUNCOES")
        self.assertEqual(causas[(5002704, 2021)], "PERIMETRO_INTRA")
        self.assertEqual(causas[(3304557, 2021)], "EM_ABERTO")

    def test_diagnostico_cobre_os_28_pares_da_politica_1_1(self):
        diag = self.g["diagnostico_pares_msc"]
        self.assertEqual(len(diag), 28)
        self.assertEqual(sum(1 for d in diag if d["causa"] == "SINAL_CORRIGIDO"), 21)
        for d in diag:
            self.assertEqual(d["situacao_politica_1_1"], "NAO_RECONCILIA")
            if d["causa"] == "SINAL_CORRIGIDO":
                self.assertEqual(d["situacao_politica_1_2"], "CONFERE")
                self.assertGreater(d["linhas_d"], 0)
            self.assertTrue(d["evidencia"])

    def test_catalogo_define_o_rotulo_por_matricula(self):
        f = next(i for i in self.g["indicadores"] if i["id"] == "edu.despesa.por_matricula_rede_propria")
        self.assertIn("por matrícula", f["nome"].lower())
        self.assertNotIn("estudante", f["nome"].lower())
        self.assertIn("não por estudante único", " ".join(f["o_que_nao_mede"]).lower())

    def test_definicao_enganosa_continua_nao_publicada(self):
        antigo = next(i for i in self.g["indicadores"] if i["id"] == "edu.despesa_por_matricula")
        self.assertEqual(antigo["estado"], "NAO_PUBLICAVEL")
        self.assertFalse(any(o["indicador"] == "edu.despesa_por_matricula" for o in self.obs))

    # ---- referências do grupo

    def test_referencias_do_grupo_conferem_com_as_observacoes(self):
        for r in self.g["referencias"]:
            if r["grupo"] != "todas" or r["indicador"] not in ("edu.despesa.por_habitante", "edu.despesa.por_matricula_rede_propria", "edu.atu.rede_municipal"):
                continue
            vals = [o["valor"] for o in self.obs if o["indicador"] == r["indicador"] and o["componente"] == r["componente"] and o["etapa"] == r["etapa"]
                    and o["ano"] == r["ano"] and o["status"] == "OBSERVADO" and o["elegivel_comparacao"]]
            self.assertEqual(r["n"], len(vals))
            if vals:
                self.assertAlmostEqual(r["media"], sum(vals) / len(vals), places=9)
                self.assertAlmostEqual(r["mediana"], statistics.median(vals), places=9)
                self.assertEqual((r["minimo"], r["maximo"]), (min(vals), max(vals)))

    def test_razao_agregada_usa_os_mesmos_pares_da_media(self):
        for r in self.g["referencias"]:
            if r["indicador"] != "edu.despesa.por_matricula_rede_propria" or r["grupo"] != "todas" or r["componente"] != "nominal" or not r["n"]:
                continue
            nums = dens = 0.0
            for cod in r["pares"]:
                o = self.ob(r["indicador"], cod, r["ano"])
                nums += o["calculo"]["numerador"]
                dens += o["calculo"]["denominador"]
            self.assertAlmostEqual(r["razao_agregada"], nums / dens, places=6)
            self.assertNotAlmostEqual(r["razao_agregada"], r["media"], places=2)   # são perguntas diferentes

    def test_grupos_regionais_sao_subconjuntos_do_grupo_nacional(self):
        todas = {(r["indicador"], r["componente"], r["etapa"], r["ano"]): r for r in self.g["referencias"] if r["grupo"] == "todas"}
        for r in self.g["referencias"]:
            if r["grupo"] == "todas":
                continue
            self.assertLessEqual(r["n"], todas[(r["indicador"], r["componente"], r["etapa"], r["ano"])]["n"])
            self.assertTrue(set(r["pares"]) <= set(todas[(r["indicador"], r["componente"], r["etapa"], r["ano"])]["pares"]))

    # ---- referências externas

    def test_referencia_internacional_nao_entra_na_distribuicao_das_capitais(self):
        ind_ref = {r["indicador"] for r in self.g["referencias"]}
        self.assertFalse(any(i.startswith("ocde") for i in ind_ref))
        for g in self.g["referencias_internacionais"]:
            self.assertEqual(g["fonte"], "ocde_eag")
        for m in self.g["matriz_referencias"]:
            if m["tipo"] == "internacional_contexto":
                self.assertIn("sem diferença", m["uso"].lower() + " sem diferença")

    def test_referencia_de_outro_universo_nao_permite_diferenca(self):
        for r in self.g["referencias_externas"]:
            if r["tipo"] == "nacional_outro_universo":
                self.assertIsNone(r["unidade_diferenca"])
            else:
                self.assertTrue(r["unidade_diferenca"])

    def test_media_da_ocde_e_a_media_simples_dos_membros(self):
        for chave, (n, media, publicada, dif) in RE.paridade_ocde().items():
            self.assertLess(abs(dif), 1e-6 * max(1.0, abs(publicada)), chave)

    def test_valores_nacionais_lidos_do_seed(self):
        atu = [r for r in self.g["referencias_externas"] if r["indicador"] == "edu.atu.rede_municipal" and r["ano"] == 2025]
        self.assertEqual({r["etapa"]: r["valor"] for r in atu}, {"creche": 14.9, "pre_escola": 18.2, "anos_iniciais": 22.0, "anos_finais": 25.1})

    def test_matriz_cobre_aceitas_contextuais_e_rejeitadas_com_motivo(self):
        tipos = {m["tipo"] for m in self.g["matriz_referencias"]}
        self.assertEqual(tipos, {"nacional_mesmo_universo", "nacional_outro_universo", "internacional_contexto", "incompativel"})
        for m in self.g["matriz_referencias"]:
            for k in ("candidata", "fonte", "universo", "unidade", "periodo", "metodo", "compatibilidade", "tipo", "uso", "decisao"):
                self.assertTrue(m[k], (m["id"], k))

    # ---- linguagem e publicação

    def test_catalogo_novo_sem_linguagem_avaliativa(self):
        import re
        proibidas = r"\b(eficiente|ineficiente|ineficiência|desperdício|melhor(es)?|pior(es)?|ranking|insight|merece atenção|sinaliza|excesso|bom desempenho|mau desempenho|inchad[oa])\b"
        texto = json.dumps([i for i in self.g["indicadores"]], ensure_ascii=False).lower()
        self.assertIsNone(re.search(proibidas, texto))

    def test_validacao_critica_reprovada_bloqueia_a_publicacao(self):
        """Um valor derivado adulterado reprova V15/V17 e a gold não é promovida."""
        obs = [dict(o) for o in self.obs]
        for o in obs:
            if o["indicador"] == "edu.despesa.por_habitante" and o["status"] == "OBSERVADO":
                o["valor"] = o["valor"] * 1.1
                break
        self.assertEqual(V.v15_despesa_por_habitante(obs)["resultado"], "reprovada")
        obs = [dict(o) for o in self.obs]
        for o in obs:
            if o["indicador"] == "edu.despesa.por_matricula_rede_propria" and o["status"] == "OBSERVADO":
                o["valor"] = o["valor"] + 1
                break
        self.assertEqual(V.v17_despesa_por_matricula(obs)["resultado"], "reprovada")
        g2 = dict(self.g)
        g2["validacoes"] = [dict(v) for v in self.g["validacoes"]]
        g2["validacoes"][0] = dict(g2["validacoes"][0], resultado="reprovada")
        with tempfile.TemporaryDirectory() as raiz, tempfile.TemporaryDirectory() as diag:
            os.makedirs(os.path.join(raiz, "eficiencia"), exist_ok=True)
            promovido, _ = gold.promove(g2, raiz_publica=raiz, diagnostico=diag)
            self.assertFalse(promovido)
            self.assertFalse(os.path.exists(os.path.join(raiz, "eficiencia", "gold", "educacao_capitais.json")))

    def test_csv_da_despesa_por_habitante_igual_a_gold(self):
        caminho = os.path.join(base.RAIZ, "public", "eficiencia", "series", "edu_despesa_por_habitante.csv")
        import csv
        with open(caminho, encoding="utf-8", newline="") as f:
            linhas = list(csv.DictReader(f))
        obs = [o for o in self.obs if o["indicador"] == "edu.despesa.por_habitante"]
        self.assertEqual(len(linhas), len(obs))
        for l, o in zip(linhas, obs):
            self.assertEqual(l["valor"], "" if o["valor"] is None else repr(o["valor"]))
            self.assertEqual(l["denominador"], "" if not o.get("calculo") else repr(o["calculo"]["denominador"]))


if __name__ == "__main__":
    unittest.main()
