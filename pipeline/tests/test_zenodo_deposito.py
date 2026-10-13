"""Depósito mensal no Zenodo: o pacote é reproduzível, declara ausência como vazio,
registra pendências do mantenedor e o script nunca publica."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("zenodo_deposito", RAIZ / "scripts" / "zenodo_deposito.py")
Z = importlib.util.module_from_spec(spec)
spec.loader.exec_module(Z)


class PacoteZenodo(unittest.TestCase):
    def test_pacote_completo_com_somas_e_pendencias(self):
        with tempfile.TemporaryDirectory() as d:
            destino, pend = Z.preparar("2026-09", d)
            nomes = sorted(p.name for p in destino.iterdir())
            self.assertEqual(nomes, ["LEIAME.md", "SHA256SUMS", "ibcc.csv", "meta.json", "series_mensais.csv", "zenodo.json"])
            somas = (destino / "SHA256SUMS").read_text().splitlines()
            self.assertEqual(len(somas), 5)
            md = json.loads((destino / "zenodo.json").read_text())["metadata"]
            self.assertEqual(md["upload_type"], "dataset")
            self.assertEqual(md["version"], "2026-09")
            inst = json.loads((RAIZ / "config" / "institucional.json").read_text())
            if not inst["zenodo"]["criadores"]:
                self.assertTrue(any("criadores" in p for p in pend))
                self.assertIn("Pendências antes do depósito", (destino / "LEIAME.md").read_text())

    def test_csv_ausencia_e_vazio(self):
        pulse = {"series": {"x": {"meta": {"source": "BCB/SGS", "series_code": "1", "unit": "%", "name": "X"},
                                  "obs": [{"ref": "2026-01-01", "v": 1.5}, {"ref": "2026-02-01", "v": None}]}}}
        linhas = Z.csv_series(pulse).splitlines()
        self.assertTrue(linhas[2].endswith(",2026-02,,dado observado"))

    def test_rascunho_recusado_com_pendencia_e_sem_publicacao(self):
        with self.assertRaises(SystemExit):
            Z.criar_rascunho(Path("."), ["criadores"])
        fonte = (RAIZ / "scripts" / "zenodo_deposito.py").read_text()
        self.assertNotIn("/actions/publish", fonte)


if __name__ == "__main__":
    unittest.main()
