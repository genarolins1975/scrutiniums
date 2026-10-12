"""Fixtures sintéticas exclusivamente para testar as regras de elegibilidade."""
from dataclasses import replace
import unittest

from pipeline.contas_estaduais.educacao import (
    Recorte, Evidencia, Despesa, Matriculas, Resultado,
    avaliar_despesa_por_matricula, avaliar_ideb, avaliar_pareamento,
)


class EducacaoTest(unittest.TestCase):
    def setUp(self):
        self.recorte = Recorte("PE", 2025, "estadual", "ensino_medio_regular",
                               "uf_inteira", "regular_rede_propria")
        self.e = Evidencia("https://example.org/fixture", "a" * 64,
                           "fixture.json", "fixture_sintetica")
        self.d = Despesa(self.recorte, 120000, self.e, "liquidada", "BRL_nominal",
                         "janeiro_dezembro", "rede_etapa_conciliada", self.e)
        self.m = Matriculas(self.recorte, 12, self.e, "matriculas_censo")
        self.r = Resultado(self.recorte, 4.5, self.e, "ideb")

    def test_par_compativel_calcula_apenas_despesa_por_matricula(self):
        a = avaliar_pareamento(self.d, self.m, self.r)
        self.assertTrue(a.elegivel)
        self.assertEqual(a.despesa_por_matricula.valor, 10000)
        self.assertEqual(a.ideb.valor, 4.5)

    def test_zero_e_ausencia_sao_distintos(self):
        zero = avaliar_despesa_por_matricula(replace(self.d, valor=0), self.m)
        ausente = avaliar_despesa_por_matricula(replace(self.d, valor=None), self.m)
        self.assertTrue(zero.elegivel)
        self.assertEqual(zero.valor, 0)
        self.assertFalse(ausente.elegivel)
        self.assertIsNone(ausente.valor)
        self.assertIn("despesa_ausente", ausente.motivos)

    def test_denominador_invalido_nao_produz_razao(self):
        for v in (0, -1, 1.5, True, float("nan"), None):
            with self.subTest(v=v):
                a = avaliar_despesa_por_matricula(self.d, replace(self.m, valor=v))
                self.assertFalse(a.elegivel)
                self.assertIsNone(a.valor)

    def test_cada_dimensao_incompativel_bloqueia_razao(self):
        casos = dict(uf="SP", ano=2023, rede="municipal",
                     etapa="fundamental_anos_finais_regular",
                     abrangencia="capitais", universo="todas_modalidades")
        for campo, valor in casos.items():
            with self.subTest(campo=campo):
                m = replace(self.m, recorte=replace(self.recorte, **{campo: valor}))
                a = avaliar_despesa_por_matricula(self.d, m)
                self.assertIn(campo + "_incompativel", a.motivos)
                self.assertIsNone(a.valor)

    def test_recortes_iguais_mas_municipais_ou_parciais_nao_passam(self):
        for alteracao in ({"rede": "municipal"}, {"abrangencia": "capitais"},
                          {"etapa": "educacao_basica_total"}, {"uf": "XX"},
                          {"ano": True}, {"universo": ""}):
            with self.subTest(alteracao=alteracao):
                recorte = replace(self.recorte, **alteracao)
                a = avaliar_despesa_por_matricula(replace(self.d, recorte=recorte),
                                                  replace(self.m, recorte=recorte))
                self.assertFalse(a.elegivel)

    def test_funcao_12_nao_substitui_rede_etapa(self):
        a = avaliar_despesa_por_matricula(replace(self.d, perimetro="funcao_12"), self.m)
        self.assertIn("perimetro_despesa_incompativel", a.motivos)

    def test_sem_conciliacao_nao_publica_razao(self):
        a = avaliar_despesa_por_matricula(replace(self.d, conciliacao=None), self.m)
        self.assertIn("conciliacao_perimetro_ausente", a.motivos)

    def test_regime_janela_e_conceito_sao_explicitos(self):
        for campo, valor in (("estagio", "paga"), ("periodo", "janeiro_junho"),
                             ("moeda", "BRL_real_2025")):
            with self.subTest(campo=campo):
                self.assertFalse(avaliar_despesa_por_matricula(
                    replace(self.d, **{campo: valor}), self.m).elegivel)
        self.assertFalse(avaliar_despesa_por_matricula(
            self.d, replace(self.m, conceito="pessoas_unicas")).elegivel)

    def test_sem_proveniencia_nao_publica(self):
        for campo, valor in (("sha256", "abc"), ("url", "sem-url"),
                             ("arquivo", ""), ("campo", "")):
            with self.subTest(campo=campo):
                e = replace(self.e, **{campo: valor})
                self.assertFalse(avaliar_despesa_por_matricula(
                    replace(self.d, evidencia=e), self.m).elegivel)
                self.assertFalse(avaliar_ideb(replace(self.r, evidencia=e)).elegivel)

    def test_despesa_invalida(self):
        for v in (-1, float("nan"), float("inf"), True):
            with self.subTest(v=v):
                self.assertFalse(avaliar_despesa_por_matricula(
                    replace(self.d, valor=v), self.m).elegivel)

    def test_resultado_de_outro_ano_nao_apaga_despesa_valida(self):
        r = replace(self.r, recorte=replace(self.recorte, ano=2023))
        a = avaliar_pareamento(self.d, self.m, r)
        self.assertFalse(a.elegivel)
        self.assertIn("ano_incompativel", a.motivos)
        self.assertTrue(a.despesa_por_matricula.elegivel)
        self.assertTrue(a.ideb.elegivel)

    def test_ideb_ausente_zero_e_escala(self):
        self.assertTrue(avaliar_ideb(replace(self.r, valor=0)).elegivel)
        for v in (None, -0.1, 10.1, float("nan"), float("inf"), True):
            with self.subTest(v=v):
                a = avaliar_pareamento(self.d, self.m, replace(self.r, valor=v))
                self.assertFalse(a.elegivel)
                self.assertIsNone(a.ideb.valor)
                self.assertTrue(a.despesa_por_matricula.elegivel)

    def test_df_elegivel_individualmente_nao_implica_comparabilidade(self):
        recorte = replace(self.recorte, uf="DF")
        a = avaliar_pareamento(replace(self.d, recorte=recorte),
                              replace(self.m, recorte=recorte), replace(self.r, recorte=recorte))
        self.assertTrue(a.elegivel)
        # Inclusão do DF na referência continua sendo decisão explícita da camada comparativa.


if __name__ == "__main__":
    unittest.main()
