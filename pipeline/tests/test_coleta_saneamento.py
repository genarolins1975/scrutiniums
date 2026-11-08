"""Falhas de captura não podem substituir a última base válida."""
import gzip
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from pipeline.observatorio_saneamento import coletar


class ColetaSaneamento(unittest.TestCase):
    def cadunico(self, docs, total):
        config = {"meses": ["202412"], "campos": ["codigo_ibge", "anomes_s"]}
        payload = json.dumps({"response": {"numFound": total, "docs": docs}}).encode()
        return patch.multiple(coletar.fontes, CADUNICO=config), patch.object(coletar, "baixar", return_value=payload)

    def test_cadunico_recusa_captura_incompleta_sem_apagar_seed(self):
        docs = [{"codigo_ibge": "355030", "anomes_s": "202412"}]
        for rows, total in [(docs, 2), (docs, None), (docs, True), ([], 0), (docs * 2, 2),
                            ([dict(docs[0], anomes_s="202411")], 1),
                            ([dict(docs[0], codigo_ibge="inválido")], 1)]:
            with self.subTest(rows=rows, total=total), tempfile.TemporaryDirectory() as pasta:
                destino = Path(pasta, "cadunico.json.gz")
                destino.write_bytes(b"base anterior")
                cfg, resposta = self.cadunico(rows, total)
                with cfg, resposta, patch.object(coletar, "SEED", pasta):
                    with self.assertRaises(ValueError):
                        coletar.coletar_cadunico()
                self.assertEqual(destino.read_bytes(), b"base anterior")

    def test_cadunico_preserva_zero_e_ausencia(self):
        docs = [{"codigo_ibge": "355030", "anomes_s": "202412", "familias": 0},
                {"codigo_ibge": "330455", "anomes_s": "202412", "familias": None}]
        with tempfile.TemporaryDirectory() as pasta:
            cfg, resposta = self.cadunico(docs, 2)
            with cfg, resposta, patch.object(coletar, "SEED", pasta):
                coletar.coletar_cadunico()
            dados = json.loads(gzip.decompress(Path(pasta, "cadunico.json.gz").read_bytes()))
            mes = dados["meses"]["202412"]
            self.assertEqual(mes["registros"], 2)
            self.assertEqual(mes["municipios"]["355030"]["familias"], 0)
            self.assertIsNone(mes["municipios"]["330455"]["familias"])

    def test_cadunico_segundo_mes_incompleto_preserva_os_dois_meses_anteriores(self):
        config = {"meses": ["202412", "202609"], "campos": ["codigo_ibge", "anomes_s"]}
        primeiro = {"response": {"numFound": 1, "docs": [{"codigo_ibge": "355030", "anomes_s": "202412"}]}}
        segundo = {"response": {"numFound": 1, "docs": []}}
        with tempfile.TemporaryDirectory() as pasta, patch.object(coletar, "SEED", pasta), \
             patch.object(coletar.fontes, "CADUNICO", config), \
             patch.object(coletar, "baixar", side_effect=[json.dumps(r).encode() for r in (primeiro, segundo)]):
            destino = Path(pasta, "cadunico.json.gz")
            destino.write_bytes(b"os dois meses anteriores")
            with self.assertRaises(ValueError):
                coletar.coletar_cadunico()
            self.assertEqual(destino.read_bytes(), b"os dois meses anteriores")

    def test_sinisa_falha_tardia_nao_grava_planilhas_parciais(self):
        arquivo = io.BytesIO()
        with zipfile.ZipFile(arquivo, "w") as z:
            z.writestr("primeira.xlsx", b"primeira")
            z.writestr("segunda.xlsx", b"segunda")
        dados = {"aba": "Dados", "linha_codigos": 3, "cabecalho": [],
                 "registros": [{"linha": 4, "v": [1]}]}
        with patch.dict(coletar.fontes.SINISA_ZIPS, {"agua": "https://example.org/agua.zip"}, clear=True), \
             patch.dict(coletar.fontes.SINISA_PLANILHAS,
                        {"primeira": ("agua", "primeira"), "segunda": ("agua", "segunda")}, clear=True), \
             patch.object(coletar, "baixar", return_value=arquivo.getvalue()), \
             patch.object(coletar, "extrair_planilha", side_effect=[dados, ValueError("planilha inválida")]), \
             patch.object(coletar, "gravar") as gravar:
            with self.assertRaisesRegex(ValueError, "planilha inválida"):
                coletar.coletar_sinisa()
            gravar.assert_not_called()

    def test_gravar_falha_na_substituicao_preserva_arquivo_e_remove_temporario(self):
        with tempfile.TemporaryDirectory() as pasta, patch.object(coletar, "SEED", pasta):
            destino = Path(pasta, "seed.json.gz")
            destino.write_bytes(b"base anterior")
            with patch.object(coletar.os, "replace", side_effect=OSError("disco indisponível")):
                with self.assertRaises(OSError):
                    coletar.gravar(destino.name, {"novo": True})
            self.assertEqual(destino.read_bytes(), b"base anterior")
            self.assertEqual(list(Path(pasta).iterdir()), [destino])

    def test_gravar_deterministico(self):
        with tempfile.TemporaryDirectory() as pasta, patch.object(coletar, "SEED", pasta):
            coletar.gravar("seed.json.gz", {"valor": 0, "ausente": None})
            primeiro = Path(pasta, "seed.json.gz").read_bytes()
            coletar.gravar("seed.json.gz", {"valor": 0, "ausente": None})
            self.assertEqual(primeiro, Path(pasta, "seed.json.gz").read_bytes())


if __name__ == "__main__":
    unittest.main()
