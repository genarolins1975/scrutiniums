"""Regra nominal (docs/CONSTITUICAO.md, art. 5) e casamento por identidade nas fichas.

Rodar: python3 -m unittest discover -s pipeline/tests -t .
"""
import json
import os
import tempfile
import unittest
from unittest import mock

from pipeline import inst_pages_all as ipa
from pipeline import regra_nominal as rn


def _inst(cod, grupo, score, nome="X"):
    return {"cod_inst": cod, "nome": nome, "grupo_pares": grupo, "basileia_pct": 15.0,
            "score": score, "score_anterior": score - 1, "score_delta": 1.0,
            "faixa": "risco elevado", "historico_score": [{"anomes": "202603", "score": score}],
            "dimensoes": {"capital_basileia": {"valor": 15.0, "percentil_pares": 40.0, "risco": 60.0,
                                               "mediana_pares": 15.4, "q1_pares": 14.0, "q3_pares": 16.0}}}


class RegraNominal(unittest.TestCase):
    def setUp(self):
        self.inst = {"ok": True, "anomes": "202606",
                     "instituicoes": [_inst(f"C{i:07d}", "S1" if i < 6 else "S4", 10.0 * i) for i in range(8)]}
        self.pub = rn.institutions_publicavel(self.inst)

    def test_nenhum_campo_de_score_sai_com_nome(self):
        self.assertEqual(rn.verificar(self.pub), [])
        for i in self.pub["instituicoes"]:
            for c in rn.CAMPOS_RETIRADOS:
                self.assertNotIn(c, i)
            self.assertNotIn("risco", i["dimensoes"]["capital_basileia"])
            self.assertEqual(i["dimensoes"]["capital_basileia"]["percentil_pares"], 40.0)
            self.assertEqual(i["basileia_pct"], 15.0)

    def test_nao_altera_o_payload_interno(self):
        self.assertIn("score", self.inst["instituicoes"][0])
        self.assertIn("risco", self.inst["instituicoes"][0]["dimensoes"]["capital_basileia"])

    def test_distribuicao_anonima_sem_nomes_e_com_piso_de_membros(self):
        d = self.pub["score_distribuicao_anonima"]
        self.assertEqual(set(d["grupos"]), {"S1"})
        self.assertEqual(d["grupos_omitidos_por_tamanho"], ["S4"])
        g = d["grupos"]["S1"]
        self.assertEqual((g["n"], g["min"], g["mediana"], g["max"]), (6, 0.0, 25.0, 50.0))
        texto = json.dumps(d)
        self.assertNotIn("C000", texto)

    def test_marca_de_versao_e_nota(self):
        self.assertEqual(self.pub["regra_editorial"], rn.VERSAO)
        self.assertIn("não foram calibradas", self.pub["nota_regra_editorial"])

    def test_verificar_acusa_violacao(self):
        self.assertTrue(rn.verificar(self.inst))

    def test_payload_indisponivel_passa_intacto(self):
        self.assertEqual(rn.institutions_publicavel({"ok": False}), {"ok": False})


class RotuloTrimestre(unittest.TestCase):
    def test_calculado_para_qualquer_trimestre(self):
        self.assertEqual(ipa.rotulo_trimestre("202606"), "2026-T2")
        self.assertEqual(ipa.rotulo_trimestre("202612"), "2026-T4")
        self.assertEqual(ipa.rotulo_trimestre("201503"), "2015-T1")

    def test_entrada_invalida_devolve_o_proprio_valor(self):
        self.assertEqual(ipa.rotulo_trimestre("2026"), "2026")
        self.assertEqual(ipa.PERIODOS_LBL.get("xx", "padrao"), "padrao")
        self.assertEqual(ipa.PERIODOS_LBL.get("202609"), "2026-T3")


class CasamentoPorIdentidade(unittest.TestCase):
    def test_cnpj_raiz_igual_ao_codigo(self):
        self.assertEqual(ipa.casamento_reclamacao("60746948", "BANCO X", "OUTRO NOME", "60.746.948/0001-12", {}), "cnpj")

    def test_nome_identico_publicado_pelo_bcb(self):
        self.assertEqual(ipa.casamento_reclamacao("C0000001", "XP", "XP (conglomerado)", "", {}), "nome_identico_bcb")

    def test_palavra_em_comum_nao_casa(self):
        # o defeito que estava no ar: "BANK" casava C6 Bank com Pinbank, Citibank e Ouribank
        for fonte in ("PINBANK BRASIL IP (conglomerado)", "CITIBANK (conglomerado)", "OURIBANK (conglomerado)",
                      "TBANKS IP (conglomerado)"):
            self.assertIsNone(ipa.casamento_reclamacao("C0052072", "C6 BANK", fonte, "", {}), fonte)

    def test_mapa_curado_so_vale_aprovado_com_revisor(self):
        doc = {"entradas": [
            {"fonte": "reclamacoes", "cod": "C1", "nome_fonte": "BCO A (conglomerado)", "status": "aprovado", "revisor": "editor"},
            {"fonte": "reclamacoes", "cod": "C2", "nome_fonte": "BCO B (conglomerado)", "status": "em_revisao", "revisor": None},
            {"fonte": "reclamacoes", "cod": "C3", "nome_fonte": "BCO C (conglomerado)", "status": "aprovado", "revisor": None},
        ]}
        with tempfile.TemporaryDirectory() as t:
            arq = os.path.join(t, "mapa.json")
            with open(arq, "w", encoding="utf-8") as f:
                json.dump(doc, f)
            with mock.patch.object(ipa, "MAPA_NOMES", arq):
                mapa = ipa.mapa_nomes_aprovados("reclamacoes")
        self.assertEqual(mapa, {"BCO A": "C1"})
        self.assertEqual(ipa.casamento_reclamacao("C1", "BANCO A", "BCO A (conglomerado)", "", mapa), "mapa_curado")
        self.assertIsNone(ipa.casamento_reclamacao("C2", "BANCO B", "BCO B (conglomerado)", "", mapa))

    def test_mapa_versionado_nao_tem_aprovacao_sem_revisor(self):
        with open(ipa.MAPA_NOMES, encoding="utf-8") as f:
            doc = json.load(f)
        for e in doc["entradas"]:
            if e["status"] == "aprovado":
                self.assertTrue(e.get("revisor"), e)
        self.assertNotIn("C0052072", {e["cod"] for e in doc["entradas"]})


if __name__ == "__main__":
    unittest.main()
