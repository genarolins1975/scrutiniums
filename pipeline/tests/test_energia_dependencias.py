"""Publicação por módulo do Setor Elétrico (decisão do dono de 03/11/2026): run.DEPENDENCIAS lista os módulos que ficam na
publicação anterior junto com uma gold retida, porque derivam da mesma fonte primária e se conferem com ela."""
import unittest

from pipeline.energia import modulos, run


class TestDependencias(unittest.TestCase):
    def test_dependencia_e_citada_pelo_modulo(self):
        por_id = {m.REGISTRO["id"]: m for m in modulos.descobrir()}
        for mid, deps in run.DEPENDENCIAS.items():
            with open(por_id[mid].__file__, encoding="utf-8") as f:
                fonte = f.read()
            for g in deps:
                # a gold ou um arquivo baixável dela (empresas_cadeia.json é de Empresas)
                self.assertTrue(g in fonte or g[:-len(".json")] + "_" in fonte, f"{mid}: {g}")

    def test_dependencias_existem_e_vem_antes(self):
        ordem = {m.REGISTRO["gold"]: m.REGISTRO["ordem"] for m in modulos.descobrir()}
        por_id = {m.REGISTRO["id"]: m.REGISTRO for m in modulos.descobrir()}
        for mid, deps in run.DEPENDENCIAS.items():
            self.assertIn(mid, por_id)
            for g in deps:
                self.assertTrue(g in run.ARQUIVOS_OPERACAO or g in ordem, f"{mid}: {g}")
                if g in ordem:
                    self.assertLess(ordem[g], por_id[mid]["ordem"], f"{mid} roda antes de {g}")

    def test_dependencia_retida(self):
        regressoes = [{"gold": "empresas.json", "motivo": "x"}]
        self.assertEqual(run.dependencia_retida("listadas", regressoes), "empresas.json")
        self.assertEqual(run.dependencia_retida("leiloes", regressoes), "empresas.json")
        self.assertIsNone(run.dependencia_retida("territorio", regressoes))
        self.assertIsNone(run.dependencia_retida("listadas", []))


if __name__ == "__main__":
    unittest.main()
