"""Testes do pipeline do capítulo 15 do Saneamento (pipeline/saneamento_contratos). Sem rede: tudo sai do seed versionado.

Provam que a publicação versionada é a do seed; que os totais só somam contratos de serviço adjudicados e conferidos
(venda de ações, leilão sem propostas e fonte só secundária ficam fora, com o motivo); que outorga, contraprestação e
investimento nunca se somam entre si; que toda meta transcrita tem documento com sha256 e cláusula; que a série de metas
é monotônica; que a abrangência não repete município em blocos sobrepostos; e que a vigília relata documento trocado sem
alterar o seed.
"""
import copy
import json
import unittest

from pipeline.saneamento_contratos import fontes as F
from pipeline.saneamento_contratos import gold, run, validacoes


def seed():
    return gold.ler_seed()


class TestSeedVersionado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.s = seed()
        cls.g = gold.construir(copy.deepcopy(cls.s))

    def test_publicacao_versionada_e_a_do_seed(self):
        for caminho, texto in run.saidas(copy.deepcopy(self.s)).items():
            self.assertTrue(caminho.exists(), caminho)
            self.assertEqual(caminho.read_bytes().decode("utf-8"), texto, f"{caminho} não é a do seed: rode python3 -m pipeline.saneamento_contratos.run")

    def test_totais_so_com_contrato_de_servico_adjudicado_e_conferido(self):
        t = self.g["totais"]
        base = [l for l in self.g["leiloes"] if F.conta_nos_totais(l)]
        self.assertEqual(t["nos_totais"], len(base))
        for l in base:
            self.assertIn(l["tipo"], F.TIPOS_DE_SERVICO)
            self.assertEqual(l["resultado"], "adjudicado")
            self.assertEqual(l["fonte"]["grau"], "V")
        fora = {x["id"] for x in t["fora_dos_totais"]}
        for l in self.g["leiloes"]:
            if l["tipo"] not in F.TIPOS_DE_SERVICO or l["resultado"] != "adjudicado" or l["fonte"]["grau"] != "V":
                self.assertIn(l["id"], fora)
        # venda de ações e leilão sem propostas nunca entram, mesmo com fonte conferida
        for l in self.g["leiloes"]:
            if l["tipo"] in ("alienacao_de_acoes", "privatizacao") or l["resultado"] == "sem_propostas":
                self.assertIn(l["id"], fora)

    def test_naturezas_de_valor_somadas_em_separado(self):
        t = self.g["totais"]
        base = [l for l in self.g["leiloes"] if F.conta_nos_totais(l)]
        for campo in ("outorga_rs_mi", "contraprestacao_rs_mi", "investimento_previsto_rs_mi", "municipios", "populacao_mi"):
            esperado = round(sum(l[campo] for l in base if l.get(campo) is not None), 3)
            self.assertEqual(t[campo]["soma"], esperado, campo)
            self.assertEqual(t[campo]["linhas_que_informam"] + t[campo]["linhas_sem_dado"], len(base), campo)
        self.assertNotIn("valor_total", t)

    def test_toda_linha_com_fonte_data_e_grau(self):
        for l in self.g["leiloes"]:
            f = l["fonte"]
            self.assertTrue(f["url"].startswith("http"), l["id"])
            self.assertTrue(f["titulo"] and f["data"], l["id"])
            self.assertIn(f["grau"], F.GRAUS)
            self.assertIn(f["tipo_fonte"], F.TIPOS_FONTE)
            self.assertGreaterEqual(int(l["data_leilao"][:4]), F.ANO_MARCO)

    def test_metas_transcritas_com_documento_hash_e_clausula(self):
        transcritos = [c for c in self.g["contratos"] if c["situacao"] == "transcrito"]
        self.assertGreaterEqual(len(transcritos), 1)
        for c in transcritos:
            self.assertRegex(c["documento"]["sha256"], r"^[0-9a-f]{64}$", c["id"])
            self.assertTrue(c["documento"]["url"].startswith("https://"), c["id"])
            self.assertTrue(c["clausula"], c["id"])
            self.assertTrue(c["metas"], c["id"])
            por_ind = {}
            for m in c["metas"]:
                por_ind.setdefault(m["indicador"], []).append((m["ano"], m["valor"]))
            for ind, serie in por_ind.items():
                anos = [a for a, _ in serie]
                self.assertEqual(anos, sorted(anos), f"{c['id']} {ind}")
                vals = [v for _, v in serie]
                self.assertEqual(vals, sorted(vals, reverse=(ind == "IPL")), f"{c['id']} {ind}")

    def test_sabesp_urae1_como_no_estudo_de_caso(self):
        sab = next(c for c in self.g["contratos"] if c["id"] == "sp-sabesp-urae1-2024")
        metas = {(m["indicador"], m["ano"]): m["valor"] for m in sab["metas"]}
        self.assertEqual(metas[("ICA", 2026)], 97)
        self.assertEqual(metas[("ICA", 2027)], 99)
        self.assertEqual(metas[("ICE", 2029)], 99)
        self.assertEqual(sab["documento"]["sha256"], "cf1215d6a652ee5e149a7c705960ed30fd6a1c841a8920dc299e8b080e642cce")

    def test_abrangencia_com_fonte_e_posicao_por_bloco(self):
        self.assertEqual(len(self.g["abrangencia"]), len(self.g["posicao_2024"]))
        for b, p in zip(self.g["abrangencia"], self.g["posicao_2024"]):
            self.assertEqual(b["id"], p["bloco"])
            self.assertEqual(len(b["municipios"]), p["municipios"])
            self.assertIn(b["fonte"]["grau"], F.GRAUS_ABRANGENCIA)
            for ind in ("IAG0001", "IES0001", "IES0007"):
                v = p["sinisa_2024"][ind]
                if v["valor"] is not None:
                    self.assertGreaterEqual(v["municipios_com_dado"], 1)

    def test_proxy_sinisa_conta_concessoes_desde_o_marco(self):
        px = self.g["proxy_sinisa"]
        self.assertEqual(px["desde"], F.ANO_MARCO)
        self.assertTrue(all(int(a) >= F.ANO_MARCO for a in px["vinculos_por_ano"]))
        self.assertGreater(px["municipios"], 0)
        self.assertLessEqual(px["municipios"], sum(px["vinculos_por_ano"].values()))

    def test_resumo_confere_com_a_gold(self):
        r = gold.resumo(self.g)
        self.assertEqual(r["hash_dados"], self.g["hash_dados"])
        self.assertEqual(r["nos_totais"], self.g["totais"]["nos_totais"])
        self.assertEqual(r["contratos_com_metas"], len([c for c in self.g["contratos"] if c["situacao"] == "transcrito"]))

    def test_csv_uma_linha_por_leilao(self):
        linhas = gold.csv_texto(self.g["leiloes"]).strip().split("\n")
        self.assertEqual(len(linhas), len(self.g["leiloes"]) + 1)
        self.assertEqual(linhas[0].split(";"), gold.CSV_CAMPOS)


class TestValidacoesRetem(unittest.TestCase):
    def setUp(self):
        self.s = seed()

    def _construir(self):
        return gold.construir(copy.deepcopy(self.s))

    def _reprova(self, tipo):
        with self.assertRaises(gold.GoldInvalida) as cm:
            self._construir()
        self.assertIn(f"[{tipo}]", str(cm.exception))

    def test_seed_integro_constroi(self):
        self._construir()

    def test_tipo_desconhecido(self):
        self.s["leiloes"]["linhas"][0]["tipo"] = "venda"
        self._reprova("tipo")

    def test_data_anterior_ao_marco(self):
        self.s["leiloes"]["linhas"][0]["data_leilao"] = "2019-12-01"
        self._reprova("data")

    def test_sem_propostas_com_vencedor(self):
        l = next(x for x in self.s["leiloes"]["linhas"] if x["resultado"] == "sem_propostas")
        l["vencedor"] = "alguém"
        self._reprova("vencedor")

    def test_meta_que_cai(self):
        c = self.s["metas"]["contratos"][0]
        c["metas"].append({"indicador": "ICA", "ano": 2030, "valor": 50})
        self._reprova("meta_monotonica")

    def test_meta_fora_da_faixa(self):
        self.s["metas"]["contratos"][0]["metas"][0]["valor"] = 120
        self._reprova("meta_valor")

    def test_contrato_transcrito_sem_hash(self):
        self.s["metas"]["contratos"][0]["documento"]["sha256"] = ""
        self._reprova("documento")

    def test_bloco_sem_contrato_e_ibge_desconhecido(self):
        self.s["abrangencia"]["blocos"].append({"id": "x", "contrato": "nao-existe", "inicio": "2024-01-01", "fonte": {"url": "https://x", "grau": "oficial", "acessado_em": "2026-10-21"}, "municipios": [{"ibge": "0000000"}]})
        self._reprova("bloco_sem_contrato")
        self._reprova("ibge")

    def test_municipio_em_dois_blocos_sobrepostos(self):
        f = {"url": "https://x", "grau": "oficial", "acessado_em": "2026-10-21"}
        c = self.s["metas"]["contratos"][0]["id"]
        self.s["abrangencia"]["blocos"] += [
            {"id": "a", "contrato": c, "inicio": "2024-01-01", "fonte": f, "municipios": [{"ibge": "3550308"}]},
            {"id": "b", "contrato": c, "inicio": "2025-01-01", "fonte": f, "municipios": [{"ibge": "3550308"}]},
        ]
        self._reprova("sobreposicao")

    def test_cidade_dividida_por_zonas_e_permitida(self):
        f = {"url": "https://x", "grau": "oficial", "acessado_em": "2026-10-21"}
        c = self.s["metas"]["contratos"][0]["id"]
        self.s["abrangencia"]["blocos"] += [
            {"id": "a", "contrato": c, "inicio": "2024-01-01", "fonte": f, "municipios": [{"ibge": "3304557", "parcial": "zonas"}]},
            {"id": "b", "contrato": c, "inicio": "2024-01-01", "fonte": f, "municipios": [{"ibge": "3304557", "parcial": "zonas"}]},
        ]
        self._construir()

    def test_custo_sem_base_de_preco(self):
        self.s["custos"]["estimativas"].append({"id": "x", "natureza": "custo_universalizacao", "autor": "a", "titulo": "t", "valor_rs_bi": 1, "horizonte": "2033", "perimetro": "p", "fonte": {"url": "https://x", "data": "2026-01-01", "grau": "V"}})
        self._reprova("base_preco")


class TestVigilia(unittest.TestCase):
    def test_documento_trocado_ou_fora_do_ar_vira_pendencia_sem_mudar_o_seed(self):
        import hashlib

        s = seed()
        corpo = b"documento registrado"
        for c in s["metas"]["contratos"]:
            if c.get("documento", {}).get("url"):
                c["documento"]["sha256"] = hashlib.sha256(corpo).hexdigest()
        antes = json.dumps(s, sort_keys=True)
        com_url = [c for c in s["metas"]["contratos"] if c.get("documento", {}).get("url")]
        self.assertEqual(run.vigiar(s, baixar=lambda url: corpo), [])
        trocado = run.vigiar(s, baixar=lambda url: b"outro conteudo")
        self.assertEqual(len(trocado), len(com_url))
        self.assertIn("trocado", trocado[0])

        def falha(url):
            raise OSError("404")

        fora = run.vigiar(s, baixar=falha)
        self.assertIn("não responde", fora[0])
        self.assertEqual(json.dumps(s, sort_keys=True), antes)


if __name__ == "__main__":
    unittest.main()
