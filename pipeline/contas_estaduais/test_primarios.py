import copy
import json
import unittest
from pipeline.contas_estaduais.consolidar import RAW, OUT, consolidar, ler, mapear_rreo

class EvidenciasPrimarias(unittest.TestCase):
    def setUp(self):
        self.registro = next(r for r in json.loads((RAW / "anual/manifesto.json").read_text())["registros"] if r["uf"] == "PE" and r["fonte"] == "rreo")
        self.itens, _ = ler(self.registro, RAW / "anual")

    def test_reproducao_integral_dos_arquivos_arquivados(self):
        resultado = consolidar()
        self.assertEqual(resultado, json.loads(OUT.read_text()))
        self.assertEqual(len(resultado["rgf"]), 54)
        self.assertEqual(len(resultado["rreo"]), 27)

    def test_integridade_nao_pode_ser_ignorada(self):
        r = copy.deepcopy(self.registro)
        r["paginas"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            ler(r, RAW / "anual")

    def test_ausencia_e_duplicata_bloqueiam(self):
        alvo = next(r for r in self.itens if r["cod_conta"] == "ReceitasExcetoIntraOrcamentarias" and r["coluna"] == "PREVISÃO INICIAL")
        for itens in ([r for r in self.itens if r is not alvo], self.itens + [alvo]):
            with self.assertRaises(ValueError):
                mapear_rreo(itens, "PE", 2025)

    def test_nao_mistura_intra_nem_pagamentos_de_outro_escopo(self):
        antes = mapear_rreo(self.itens, "PE", 2025)
        r = copy.deepcopy(self.itens[0])
        r.update(cod_conta="DespesasIntraOrcamentarias", coluna="DESPESAS PAGAS ATÉ O BIMESTRE (j)", valor=1e15)
        self.assertEqual(mapear_rreo(self.itens + [r], "PE", 2025), antes)
        self.assertEqual(round(antes["indicadores"]["CE-04"], 2), 92.07)

    def test_zero_preservado_e_denominador_zero_bloqueado(self):
        for r in self.itens:
            if r["cod_conta"] == "DespesasExcetoIntraOrcamentarias" and r["coluna"] == "DESPESAS PAGAS ATÉ O BIMESTRE (j)":
                r["valor"] = 0
        self.assertEqual(mapear_rreo(self.itens, "PE", 2025)["indicadores"]["CE-06"], 0)
        for r in self.itens:
            if r["cod_conta"] == "ReceitasExcetoIntraOrcamentarias" and r["coluna"] == "PREVISÃO INICIAL":
                r["valor"] = 0
        with self.assertRaises(ValueError):
            mapear_rreo(self.itens, "PE", 2025)

    def test_periodo_e_esfera_sao_obrigatorios(self):
        for campo, valor in (("periodo", 5), ("esfera", "M"), ("uf", "SP"), ("anexo", "RREO-Anexo 02")):
            itens = copy.deepcopy(self.itens)
            itens[0][campo] = valor
            with self.assertRaises(ValueError):
                mapear_rreo(itens, "PE", 2025)

    def test_pagamento_acima_da_liquidacao_nao_vira_indicador(self):
        for r in self.itens:
            if r["cod_conta"] == "DespesasExcetoIntraOrcamentarias" and r["coluna"] == "DESPESAS PAGAS ATÉ O BIMESTRE (j)":
                r["valor"] = 1e15
        with self.assertRaises(ValueError):
            mapear_rreo(self.itens, "PE", 2025)

if __name__ == "__main__":
    unittest.main()
