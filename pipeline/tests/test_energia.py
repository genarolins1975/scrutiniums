"""Domínio Energia: parsers, vintages sem look-ahead, governança de previsão, seed CCEE.

Rodar: python3 -m unittest discover -s pipeline/tests -t .
Sem rede e sem escrever em data/ ou public/: bancos SQLite em memória.
"""
import copy
import json
import os
import unittest

from pipeline.energia import base, governanca as g
from pipeline.energia.fontes import ccee, ons

RAIZ = base.RAIZ


def _con():
    return base.conecta(":memory:")


class ParsersTest(unittest.TestCase):
    def test_pld_formato_antigo_com_aspas_e_zeros(self):
        txt = '"MES_REFERENCIA";"SUBMERCADO";"PERIODO_COMERCIALIZACAO";"DIA";"HORA";"PLD_HORA"\n"202401";NORDESTE;1;"01";"00";61.07\n'
        self.assertEqual(list(ccee.parse_pld(txt)), [("pld.NE", "2024-01-01T00:00", 61.07)])

    def test_pld_formato_novo_sem_aspas(self):
        txt = "MES_REFERENCIA;SUBMERCADO;PERIODO_COMERCIALIZACAO;DIA;HORA;PLD_HORA\n202609;SUDESTE;625;27;23;89.23\n"
        self.assertEqual(list(ccee.parse_pld(txt)), [("pld.SE", "2026-09-27T23:00", 89.23)])

    def test_intercambio_sinal_na_orientacao_canonica(self):
        txt = ("din_instante;id_subsistema_origem;nom_subsistema_origem;id_subsistema_destino;nom_subsistema_destino;"
               "val_intercambiomwmed;val_intercambioprogmwmed\n"
               "2026-09-26 23:00:00;NE; NORDESTE;N; NORTE;4108.810;4192.050\n"
               "2026-09-26 23:00:00;S; SUL;SE; SUDESTE;4198.268;5661.000\n")
        out = {(s, r): v for s, r, v in ons.parse_intercambio(txt)}
        self.assertAlmostEqual(out[("fluxo.N_NE", "2026-09-26T23:00")], -4108.81)
        self.assertAlmostEqual(out[("fluxo.S_SE", "2026-09-26T23:00")], 4198.268)

    def test_ausencia_nao_vira_zero(self):
        txt = "id_subsistema;nom_subsistema;din_instante;val_cargaenergiamwmed\nN;Norte;2026-01-01;\n"
        linhas = list(ons.parse_carga(txt))
        self.assertEqual(linhas, [("carga_mwmed.N", "2026-01-01", None)])
        con = _con()
        vid, _ = base.registra_vintage(con, "t", "r", "u", "2026-01-02T00:00:00Z", None, "a" * 64, 1, "teste", None)
        novas, revs = base.grava_observacoes(con, "t", vid, linhas)
        self.assertEqual((novas, revs), (0, 0))
        self.assertEqual(base.serie_vigente(con, "t", "carga_mwmed.N"), [])


class VintagesTest(unittest.TestCase):
    def test_revisao_registrada_sem_sobrescrever_e_consulta_como_estava(self):
        con = _con()
        v1, _ = base.registra_vintage(con, "ds", "r2026", "u", "2026-09-01T12:00:00Z", None, "1" * 64, 10, "teste", None)
        self.assertEqual(base.grava_observacoes(con, "ds", v1, [("s", "2026-08-31", 50.0)]), (1, 0))
        v2, _ = base.registra_vintage(con, "ds", "r2026", "u", "2026-09-10T12:00:00Z", None, "2" * 64, 10, "teste", None)
        self.assertEqual(base.grava_observacoes(con, "ds", v2, [("s", "2026-08-31", 52.5), ("s", "2026-09-09", 40.0)]), (1, 1))
        self.assertEqual(base.serie_vigente(con, "ds", "s"), [("2026-08-31", 52.5), ("2026-09-09", 40.0)])
        # antes da segunda captura: valor original e nenhuma informação do futuro
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-05T00:00:00Z"), [("2026-08-31", 50.0)])
        self.assertEqual(base.revisoes_da_serie(con, "ds", "s"),
                         [("2026-08-31", [("2026-09-01T12:00:00Z", 50.0), ("2026-09-10T12:00:00Z", 52.5)])])

    def test_mesma_captura_e_idempotente(self):
        con = _con()
        a = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", None, "f" * 64, 1, "teste", None)
        b = base.registra_vintage(con, "ds", "r", "u", "2026-09-02T00:00:00Z", None, "f" * 64, 1, "teste", None)
        self.assertEqual(a[0], b[0])
        self.assertFalse(b[1])


class SeedCceeTest(unittest.TestCase):
    def test_seed_confere_sha256_e_cobre_2021_a_setembro_de_2026(self):
        con = _con()
        st = ccee.importa_seed(con)
        self.assertEqual(len(st), 6)
        self.assertTrue(all(s["ok"] for s in st), st)
        serie = base.serie_vigente(con, ccee.DATASET, "pld.SE")
        self.assertEqual(serie[0][0], "2021-01-01T00:00")
        self.assertGreaterEqual(serie[-1][0], "2026-09-27T23:00")
        # 2021 a 2025 completos + 270 dias de 2026, sem lacunas horárias
        self.assertEqual(len(serie), 50304)

    def test_manifesto_declara_origem_e_motivo(self):
        caminho = os.path.join(RAIZ, "pipeline", "energia", "seed", "ccee_pld_horario", "v20260927T154402Z", "MANIFESTO.json")
        with open(caminho, encoding="utf-8") as f:
            m = json.load(f)
        self.assertEqual(m["licenca"], "CC-BY-4.0")
        self.assertIn("403", m["motivo_seed"])
        self.assertEqual(len(m["arquivos"]), 6)


class GovernancaTest(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(RAIZ, "pipeline", "energia", "registro_modelos.json"), encoding="utf-8") as f:
            self.registro = json.load(f)
        self.arquivo = g.le_jsonl(os.path.join(RAIZ, "pipeline", "energia", "previsoes", "arquivo.jsonl"))
        self.modelos = {m["codigo"]: m for m in self.registro["modelos"]}

    def _publicacao(self, **kw):
        rec = {
            "forecast_id": "pub-teste", "tipo": "PUBLICACAO", "run_id": "r", "origem": "2026-10-03",
            "cutoff": "2026-10-03T10:00:00Z", "emitido_em": "2026-10-03T10:30:00Z", "modelo": "B0",
            "versao_modelo": "B0-v2", "estado_modelo": "PRODUCAO", "versao_codigo": "abc123", "snapshot": "snap",
            "previsao": 80.0, "quantis": None, "calibracao": {"status": "SEM_AVALIACAO"},
            "status": "DISPONIVEL", "motivo": None, "features_usadas": [], "substitui": None, "motivo_correcao": None,
        }
        rec.update(kw)
        rec["sha256"] = g.hash_registro(rec)
        return rec

    def test_arquivo_versionado_conforme(self):
        self.assertEqual(g.valida_arquivo(self.arquivo, self.modelos), [])
        self.assertEqual(len(self.arquivo), 28)
        self.assertTrue(all(r["previsao"] is None and r["status"] == "INDISPONIVEL" for r in self.arquivo))

    def test_registro_de_modelos_conforme_e_sem_producao(self):
        self.assertEqual(g.valida_registro_modelos(self.registro), [])
        self.assertEqual(g.pode_publicar_previsao(self.registro["modelos"]), (False, "NENHUM_MODELO_EM_PRODUCAO"))
        self.assertFalse(self.registro["publicacao_resultados"]["liberada"])

    def test_bloqueia_publicacao_de_modelo_em_pesquisa(self):
        v = g.valida_registro(self._publicacao(), self.modelos)
        self.assertTrue(any("PRODUCAO" in x for x in v), v)

    def test_bloqueia_look_ahead(self):
        modelos = copy.deepcopy(self.modelos)
        modelos["B0"]["estado"] = "PRODUCAO"
        rec = self._publicacao(features_usadas=[{"serie": "pld.SE", "capturado_em": "2026-10-03T11:00:00Z"}])
        v = g.valida_registro(rec, modelos)
        self.assertTrue(any("look-ahead" in x for x in v), v)

    def test_bloqueia_publicacao_sem_snapshot_ou_versao(self):
        modelos = copy.deepcopy(self.modelos)
        modelos["B0"]["estado"] = "PRODUCAO"
        v = g.valida_registro(self._publicacao(snapshot=None, versao_codigo=None), modelos)
        self.assertTrue(any("snapshot" in x for x in v) and any("versao_codigo" in x for x in v), v)

    def test_faixa_de_80_exige_calibracao(self):
        modelos = copy.deepcopy(self.modelos)
        modelos["B0"]["estado"] = "PRODUCAO"
        rec = self._publicacao(quantis={"p10": 60.0, "p90": 110.0, "rotulo_faixa": "faixa de 80%"},
                               calibracao={"status": "DESCALIBRADO", "cobertura": 0.49, "n": 752})
        v = g.valida_registro(rec, modelos)
        self.assertTrue(any("80%" in x for x in v), v)

    def test_indisponivel_nunca_tem_numero(self):
        rec = copy.deepcopy(self.arquivo[0])
        rec["previsao"] = 0.0
        rec["sha256"] = g.hash_registro(rec)
        v = g.valida_registro(rec, self.modelos)
        self.assertTrue(any("indisponível com valor" in x for x in v), v)

    def test_alteracao_silenciosa_detectada(self):
        novo = copy.deepcopy(self.arquivo)
        novo[3]["motivo"] = "OUTRO"  # sem recalcular o hash
        self.assertTrue(any("sha256" in x for x in g.valida_arquivo(novo, self.modelos)))
        novo[3]["sha256"] = g.hash_registro(novo[3])  # mesmo recalculando, o append only acusa
        self.assertTrue(any("alterado" in x for x in g.valida_append_only(self.arquivo, novo)))
        self.assertTrue(any("removido" in x for x in g.valida_append_only(self.arquivo, novo[1:])))

    def test_calibracao_por_regra(self):
        self.assertEqual(g.status_calibracao(0.80, 1624), "CALIBRADO")
        self.assertEqual(g.status_calibracao(0.488, 752), "DESCALIBRADO")
        self.assertEqual(g.status_calibracao(0.80, 50), "AMOSTRA_INSUFICIENTE")


if __name__ == "__main__":
    unittest.main()
