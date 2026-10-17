import json
import unittest
from decimal import Decimal

from pipeline.observatorio_saneamento import atos, tarifas


class TabelaI(unittest.TestCase):
    def test_tarifas_minimas_e_cadeia_de_reajustes_conferem(self):
        self.assertEqual(tarifas.confere_corsan(), [])

    def test_tarifa_minima_alterada_e_apontada(self):
        original = tarifas.CORSAN_T1["2026-07"]["res_b"]
        tarifas.CORSAN_T1["2026-07"]["res_b"] = original[:2] + (134.90,) + original[3:]
        try:
            erros = tarifas.confere_corsan()
        finally:
            tarifas.CORSAN_T1["2026-07"]["res_b"] = original
        self.assertTrue(any("2026-07 res_b" in e and "134.9" in e for e in erros), erros)

    def test_o_expoente_da_industrial_vem_da_linha_de_30_m3_da_coluna_ind(self):
        # número oficial: 154,64 + 11,83 × 30^1,03 = 547,66; com 1,02 daria 534,52
        sb, pb = Decimal("154.64"), Decimal("11.83")
        q = lambda x: x.quantize(Decimal("0.01"))
        self.assertEqual(q(sb + pb * (Decimal(30) ** Decimal("1.03"))), Decimal("547.66"))
        self.assertEqual(q(sb + pb * (Decimal(30) ** Decimal("1.02"))), Decimal("534.52"))

    def test_expoente_da_faixa_e_o_da_ultima_linha_que_nao_passa_do_consumo(self):
        e = tarifas.corsan["categorias"]["residencial"]["agua"]["exponencial"]
        esperados = {10: "1.0", 20: "1.0", 21: "1.01", 30: "1.09", 31: "1.09", 35: "1.09", 36: "1.10", 50: "1.11", 51: "1.11", 100: "1.11", 101: "1.13", 150: "1.13", 151: "1.1287", 200: "1.1287", 201: "1.1275", 9001: "1.0858"}
        for c, n in esperados.items():
            self.assertEqual(tarifas.expoente(e, c), Decimal(n), f"{c} m³")


class ResidencialB(unittest.TestCase):
    def conta(self, m3):
        return tarifas.conta(tarifas.corsan["categorias"]["residencial"], m3)

    def test_exemplos_do_gerador(self):
        for m3, esperado in tarifas.corsan["exemplos"]["residencial"].items():
            self.assertEqual(self.conta(int(m3)), Decimal(str(esperado)), f"{m3} m³")

    def test_ligacao_medida_nao_tem_minimo(self):
        # RSAE art. 69: a demanda mínima vale só para economia não hidrometrada; art. 92: serviço básico mais consumo medido
        self.assertEqual(self.conta(0), Decimal("43.39"))
        self.assertEqual(self.conta(5), Decimal("121.14"))  # 43,39 + 5 × 9,15 e 5 × 6,40
        self.assertEqual(self.conta(7), Decimal("152.24"))  # 43,39 + 7 × 9,15 e 7 × 6,40
        agua = tarifas.corsan["categorias"]["residencial"]["agua"]
        self.assertEqual(tarifas.conta_servico(agua, 10), Decimal("134.89"))  # coincide com a tarifa mínima publicada

    def test_fracao_de_metro_cubico_e_desprezada(self):
        self.assertEqual(self.conta(Decimal("35.99")), self.conta(35))
        self.assertEqual(self.conta(Decimal("10.9")), self.conta(10))

    def test_esgoto_e_70_por_cento_do_preco_base_por_m3_sem_expoente(self):
        esgoto = tarifas.corsan["categorias"]["residencial"]["esgoto"]
        self.assertEqual(tarifas.conta_servico(esgoto, 30), Decimal("192.00"))  # 6,40 × 30, sem 30^1,09
        self.assertEqual(tarifas.conta_servico(esgoto, 5), Decimal("32.00"))
        self.assertEqual(tarifas.conta_servico(esgoto, 0), Decimal("0"))

    def test_municipios_sao_os_298_do_apendice_1_mais_os_15_da_agesan_dentro_do_vinculo_sinisa(self):
        with open(tarifas.CORSAN_APENDICE, encoding="utf-8") as fh:
            ap = json.load(fh)
        self.assertEqual(len(ap["municipios"]), 298)
        self.assertEqual(len(set(ap["municipios"])), 298)
        self.assertRegex(ap["sha256"], r"^[a-f0-9]{64}$")
        self.assertEqual(len(tarifas.CORSAN_AGESAN), 15)
        self.assertFalse(set(tarifas.CORSAN_AGESAN) & set(ap["municipios"]), "os 15 da AGESAN não estão no Apêndice 1")
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            t = {x["id"]: x for x in json.load(fh)["tarifas"]}["corsan-2026"]
        self.assertEqual(len(t["municipios"]), 313)
        self.assertEqual(len(set(t["municipios"])), 313)
        self.assertTrue(all(m.startswith("43") for m in t["municipios"]))
        for fora in ("4304606", "4307005", "4307708", "4316808"):  # Canoas, Erechim, Esteio, Santa Cruz do Sul
            self.assertNotIn(fora, t["municipios"])
        for dentro in ("4303905", "4319901", "4321600"):  # Campo Bom, Sapiranga, Tramandaí (AGESAN)
            self.assertIn(dentro, t["municipios"])

    def test_json_publicado_traz_as_mesmas_tabelas(self):
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            publicadas = {t["id"]: t for t in json.load(fh)["tarifas"]}
        for entrada in (tarifas.corsan, *tarifas.CORSAN_VARIANTES):
            publicada = publicadas[entrada["id"]]
            esperada = json.loads(json.dumps(entrada))
            publicada = {k: v for k, v in publicada.items() if k != "municipios"}
            esperada.pop("municipios", None)
            self.assertEqual(publicada, esperada, entrada["id"])

    def test_fontes_tem_sha256_e_url_https(self):
        self.assertGreaterEqual(len(tarifas.corsan["fontes"]), 6)
        for entrada in (tarifas.corsan, *tarifas.CORSAN_VARIANTES):
            for f in entrada["fontes"]:
                self.assertRegex(f["sha256"], r"^[a-f0-9]{64}$", entrada["id"])
                self.assertTrue(f["url"].startswith("https://"), entrada["id"])


class ResidencialSocialLei14898(unittest.TestCase):
    """Linha "Resid. Social Lei 14.898/24": preços impressos, até 15 m³ (expoente 1,0 até 20 m³ em todas as colunas)."""

    def conta(self, entrada, m3):
        return tarifas.conta(entrada["categorias"]["social"], m3)

    def test_so_vai_ate_15_m3_e_despreza_a_fracao(self):
        for entrada in (tarifas.corsan, tarifas.corsan_canoas_esteio, tarifas.corsan_santa_cruz):
            cat = entrada["categorias"]["social"]
            self.assertEqual(cat["consumoMaximo"], 15, entrada["id"])
            self.assertTrue(cat["consumoInteiro"], entrada["id"])
        self.assertNotIn("social", tarifas.corsan_erechim["categorias"])

    def test_exemplos_calculados_fora_do_gerador(self):
        esperados = [
            (tarifas.corsan, {"0": "21.70", "5": "60.60", "10": "99.50", "15": "138.40"}),
            (tarifas.corsan_canoas_esteio, {"0": "20.60", "5": "57.45", "10": "94.30", "15": "131.15"}),
            (tarifas.corsan_santa_cruz, {"0": "19.13", "5": "53.38", "10": "87.63", "15": "121.88"}),
        ]
        for entrada, ex in esperados:
            for m3, v in ex.items():
                self.assertEqual(self.conta(entrada, int(m3)), Decimal(v), f"{entrada['id']} {m3} m³")
            self.assertEqual({k: Decimal(str(x)) for k, x in entrada["exemplos"]["social"].items()}, {k: Decimal(v) for k, v in ex.items()}, entrada["id"])

    def test_preco_impresso_e_metade_da_residencial_b_com_centavos_de_arredondamento(self):
        for tabela in (tarifas.CORSAN_T1["2026-07"], tarifas.CORSAN_CANOAS_ESTEIO["2026-07"], tarifas.CORSAN_SANTA_CRUZ["2026-09"]):
            rb, sl = tabela["res_b"], tabela["social_lei"]
            for i in (0, 1, 2):  # preço-base, serviço básico, tarifa mínima
                self.assertLessEqual(abs(Decimal(str(sl[i])) - Decimal(str(rb[i])) / 2), Decimal("0.01"))

    def test_minima_publicada_fecha_em_canoas_e_esteio_e_difere_em_centavos_nas_outras(self):
        # água de 10 m³ ao preço impresso contra a tarifa mínima publicada (que é metade da mínima da Residencial B)
        casos = [
            (tarifas.corsan, Decimal("67.50"), Decimal("67.44")),
            (tarifas.corsan_canoas_esteio, Decimal("64.00"), Decimal("64.00")),
            (tarifas.corsan_santa_cruz, Decimal("59.43"), Decimal("59.48")),
        ]
        for entrada, simulada, publicada in casos:
            agua = tarifas.conta_servico(entrada["categorias"]["social"]["agua"], 10)
            self.assertEqual(agua, simulada, entrada["id"])
        self.assertEqual(Decimal(str(tarifas.CORSAN_T1["2026-07"]["social_lei"][2])), Decimal("67.44"))
        self.assertEqual(Decimal(str(tarifas.CORSAN_CANOAS_ESTEIO["2026-07"]["social_lei"][2])), Decimal("64.00"))
        self.assertEqual(Decimal(str(tarifas.CORSAN_SANTA_CRUZ["2026-09"]["social_lei"][2])), Decimal("59.48"))

    def test_linha_social_alterada_e_apontada(self):
        original = tarifas.CORSAN_CANOAS_ESTEIO["2026-07"]["social_lei"]
        tarifas.CORSAN_CANOAS_ESTEIO["2026-07"]["social_lei"] = (4.60,) + original[1:]
        try:
            erros = tarifas.confere_corsan()
        finally:
            tarifas.CORSAN_CANOAS_ESTEIO["2026-07"]["social_lei"] = original
        self.assertTrue(any("Canoas e Esteio" in e and "social Lei 14.898" in e for e in erros), erros)


class TabelasProprias(unittest.TestCase):
    def test_conferencias_das_edicoes_e_da_cadeia_de_canoas_e_esteio(self):
        self.assertEqual(tarifas.confere_corsan(), [])

    def test_residencial_b_confere_a_minima_ao_centavo_em_todas_as_edicoes(self):
        for tabelas in (tarifas.CORSAN_CANOAS_ESTEIO, tarifas.CORSAN_SANTA_CRUZ, tarifas.CORSAN_ERECHIM):
            for ed, linhas in tabelas.items():
                pb, sb, minima = (Decimal(str(x)) for x in linhas["res_b"][:3])
                self.assertEqual((sb + pb * 10).quantize(Decimal("0.01")), minima, ed)

    def test_exemplos_da_residencial_b_calculados_fora_do_gerador(self):
        esperados = [
            (tarifas.corsan_canoas_esteio, {"0": "41.20", "10": "188.70", "30": "576.96", "50": "1012.08"}),
            (tarifas.corsan_santa_cruz, {"0": "38.25", "10": "175.35", "30": "536.25", "50": "940.73"}),
            (tarifas.corsan_erechim, {"0": "32.95", "10": "151.05", "30": "461.92", "50": "810.32"}),
        ]
        for entrada, ex in esperados:
            for m3, v in ex.items():
                self.assertEqual(tarifas.conta(entrada["categorias"]["residencial"], int(m3)), Decimal(v), f"{entrada['id']} {m3} m³")

    def test_variantes_sao_marcadas_e_nao_dividem_municipio(self):
        ids = [x["id"] for x in tarifas.CORSAN_VARIANTES]
        self.assertEqual(ids, ["corsan-canoas-esteio-2026", "corsan-santa-cruz-2026", "corsan-erechim-2026"])
        for x in tarifas.CORSAN_VARIANTES:
            self.assertTrue(x["variante"], x["id"])
            self.assertTrue(x["recorte"], x["id"])
            self.assertEqual(x["prestadorSinisa"], tarifas.corsan["prestadorSinisa"])
        with open(tarifas.DESTINO, encoding="utf-8") as fh:
            pub = {t["id"]: t for t in json.load(fh)["tarifas"]}
        self.assertEqual(pub["corsan-canoas-esteio-2026"]["municipios"], ["4304606", "4307708"])
        self.assertEqual(pub["corsan-santa-cruz-2026"]["municipios"], ["4316808"])
        self.assertEqual(pub["corsan-erechim-2026"]["municipios"], ["4307005"])
        todos = [m for t in (tarifas.corsan, *tarifas.CORSAN_VARIANTES) for m in pub[t["id"]]["municipios"]]
        self.assertEqual(len(todos), len(set(todos)), "nenhum município em duas tabelas da Corsan")
        self.assertEqual(len(todos), 313 + 4)

    def test_vigencia_e_regulador_nao_afirmam_o_que_nao_foi_lido(self):
        self.assertIn("ato não lido", tarifas.corsan_canoas_esteio["regulador"])
        self.assertIn("ato não lido", tarifas.corsan_santa_cruz["regulador"])
        self.assertIn("não identificado", tarifas.corsan_erechim["regulador"])
        self.assertIn("não foi localizada tabela posterior", tarifas.corsan_erechim["vigencia"])
        self.assertIn("18/09/2026", tarifas.corsan_santa_cruz["vigencia"])

    def test_atos_da_corsan_um_ato_por_entrada_e_com_o_objeto_certo(self):
        corsan = [a for a in atos.ACRESCIMOS if a["prestador"] == "CORSAN"]
        self.assertEqual(len(corsan), 7)
        self.assertTrue(all(not a["verificado"] for a in corsan))
        # A CSR 05/2026 trata da disponibilidade do esgoto; só a CSR 11/2026 fundamenta a tarifa social.
        self.assertFalse(any("05/2026" in a["ato"] for a in corsan))
        csr = [a for a in corsan if "CSR" in a["ato"]]
        self.assertEqual([a["ato"] for a in csr], ["Resolução CSR AGESAN 11/2026, citada no Anexo 4 da Corsan"])
        self.assertIn("Residencial Social", csr[0]["tipo"])
        # O PDF de Santa Cruz do Sul cita a AGERST e a Resolução Normativa 92/2026.
        sc = [a for a in corsan if a["area"] == "Santa Cruz do Sul"]
        self.assertIn("Resolução Normativa AGERST 92/2026, citada na tabela da Corsan", [a["ato"] for a in sc])
        for texto in [a["obs"] for a in sc] + tarifas.corsan_santa_cruz["observacoes"] + [tarifas.corsan_santa_cruz["regulador"]]:
            self.assertNotIn("não nomeia o regulador", texto)
            self.assertNotIn("nome do arquivo", texto)


if __name__ == "__main__":
    unittest.main()
