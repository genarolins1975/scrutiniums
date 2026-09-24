"""Relatório automático: regra nominal, formato brasileiro e ausência de referência quebrada."""
import json
import os
import re
import tempfile
import unittest
from unittest import mock

from pipeline import common
from pipeline import report

GOLD = os.path.join(common.ROOT, "public", "obs", "data", "gold")
NECESSARIOS = ("overview", "pulse", "sectors", "institutions", "rj", "alerts", "scenario", "quality")


def _ler(nome):
    with open(os.path.join(GOLD, f"{nome}.json"), encoding="utf-8") as f:
        return json.load(f)


@unittest.skipUnless(all(os.path.exists(os.path.join(GOLD, f"{n}.json")) for n in NECESSARIOS),
                     "gold publicada incompleta")
class RelatorioSobreGoldPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cfg = common.load_config()
        ctx = {n: _ler(n) for n in NECESSARIOS}
        # o relatório recebe o payload INTERNO de instituições (com score): simulamos isso
        # para provar que, mesmo com o score disponível, ele não sai ao lado do nome
        for i in ctx["institutions"].get("instituicoes", []):
            i.setdefault("score", 88.8)
            i.setdefault("faixa", "risco muito elevado")
            i.setdefault("score_delta", 7.7)
        ctx["quality"] = {k: v for k, v in ctx["quality"].items() if isinstance(v, dict) and "score" in v}
        cls.tmp = tempfile.TemporaryDirectory()
        with mock.patch.object(common, "GOLD", cls.tmp.name):
            path = report.build(cfg, ctx)
            with open(path, encoding="utf-8") as f:
                cls.html = f.read()
        cls.texto = re.sub(r"<style>.*?</style>", "", cls.html, flags=re.S)
        cls.texto = re.sub(r"<[^>]+>", " ", cls.texto)
        cls.inst = ctx["institutions"]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_sem_faixa_nem_score_de_instituicao(self):
        self.assertNotIn("risco muito elevado", self.texto)
        self.assertNotIn("risco elevado", self.texto)
        self.assertNotIn("88,8", self.texto)
        self.assertNotIn("7,7", self.texto)

    def test_sem_referencia_a_arquivo_inexistente(self):
        self.assertNotIn("LIMITACOES.md", self.html)

    def test_numeros_em_formato_brasileiro(self):
        # nenhum decimal com ponto na prosa (ponto decimal inglês); milhar com ponto é válido
        prosa = re.sub(r"https?://\S+", "", self.texto)
        prosa = re.sub(r"\d{4}-\d{2}-\d{2}T[\d:+]+", "", prosa)  # carimbo de geração
        prosa = re.sub(r"versão [\d.]+", "", prosa)
        prosa = re.sub(r"\bv\d+\.\d+", "", prosa)  # versão de método, ex.: v0.2
        prosa = re.sub(r"\b\d\.\d{2}(?= [A-ZÀ-Ú])", "", prosa)  # código de classificação setorial, ex.: 3.20
        # o diagnóstico vem do overview.json publicado, gerado antes desta correção
        prosa = re.sub(r"IBCC \d+\.\d", "", prosa)
        self.assertEqual(re.findall(r"\d\.\d{1,2}\b(?!\d)", prosa), [])

    def test_sem_hifen_como_sinal_negativo(self):
        self.assertEqual(re.findall(r"(?<![\w/])-\d", self.texto), [])

    def test_ano_da_soma_de_rj_vem_dos_dados(self):
        with open(report.__file__, encoding="utf-8") as f:
            codigo = f.read()
        self.assertNotIn('== "2025"', codigo)


class Formatacao(unittest.TestCase):
    def test_fmt(self):
        self.assertEqual(report._fmt(1283, 0), "1.283")
        self.assertEqual(report._fmt(-0.5, 2), "−0,50")
        self.assertEqual(report._fmt_sinal(0.3), "+0,30")
        self.assertEqual(report._fmt(None), "n/d")

    def test_mes(self):
        self.assertEqual(report._mes("2026-07-01"), "jul/2026")

    def test_ultimo_ano_completo(self):
        obs = [{"ref": f"2025-{m:02d}-01", "v": 1} for m in range(1, 13)] + [{"ref": "2026-01-01", "v": 1}]
        self.assertEqual(report._ultimo_ano_completo(obs), "2025")
        self.assertIsNone(report._ultimo_ano_completo(obs[:5]))


if __name__ == "__main__":
    unittest.main()
