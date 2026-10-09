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

    def test_bronze_ausente_e_lido_da_copia_com_o_mesmo_conteudo(self):
        # silver restaurado sem o bronze: a vintage aponta para a captura original e o recurso
        # foi recapturado igual noutro instante (mesmo sha256, outro carimbo no nome)
        import gzip
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            sha = "eed795ff8b13" + "0" * 52
            with gzip.open(os.path.join(d, f"20261006T195845Z.{sha[:12]}.html.gz"), "wb") as f:
                f.write(b"<html>pasta</html>")
            with base.abre_bronze(os.path.join(d, f"20261002T042751Z.{sha[:12]}.html.gz")) as f:
                self.assertEqual(f.read(), b"<html>pasta</html>")
            # conteúdo diferente (outro sha) não substitui o arquivo ausente
            with self.assertRaises(FileNotFoundError):
                base.abre_bronze(os.path.join(d, "20261002T042751Z.aaaaaaaaaaaa.html.gz"))
            with self.assertRaises(FileNotFoundError):
                base.abre_bronze(os.path.join(d, f"20261002T042751Z.{sha[:12]}.csv.gz"))


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
        self.assertEqual(g.valida_arquivo(self.arquivo, self.modelos, resultados_liberados=False), [])
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
        self.assertTrue(any("sha256" in x for x in g.valida_arquivo(novo, self.modelos, resultados_liberados=False)))
        novo[3]["sha256"] = g.hash_registro(novo[3])  # mesmo recalculando, o append only acusa
        self.assertTrue(any("alterado" in x for x in g.valida_append_only(self.arquivo, novo)))
        self.assertTrue(any("removido" in x for x in g.valida_append_only(self.arquivo, novo[1:])))

    def test_calibracao_por_regra(self):
        self.assertEqual(g.status_calibracao(0.80, 1624), "CALIBRADO")
        self.assertEqual(g.status_calibracao(0.488, 752), "DESCALIBRADO")
        self.assertEqual(g.status_calibracao(0.80, 50), "AMOSTRA_INSUFICIENTE")


class AuditoriaTemporalTest(unittest.TestCase):
    """Correções da auditoria independente (achados A6, A13, A14 e A12)."""

    def test_instante_exige_fuso_e_normaliza(self):
        self.assertEqual(base.instante_utc("2026-09-05T00:00:00-03:00"), "2026-09-05T03:00:00Z")
        self.assertEqual(base.instante_utc("2026-09-05T03:00:00.999Z"), "2026-09-05T03:00:00Z")
        for ruim in ("2026-09-05", "2026-09-05T00:00:00", None):
            with self.assertRaises(ValueError):
                base.instante_utc(ruim)

    def test_consulta_com_fuso_nao_antecipa(self):
        con = _con()
        v1, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T12:00:00Z", None, "1" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v1, [("s", "2026-08-31", 50.0)])
        v2, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-10T12:00:00Z", None, "2" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v2, [("s", "2026-08-31", 52.5)])
        # 10/09 09h00 em Brasília = 12h00 UTC: a segunda vintage já existe
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-10T09:00:00-03:00"), [("2026-08-31", 52.5)])
        # 10/09 08h59 em Brasília: ainda não
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-10T08:59:00-03:00"), [("2026-08-31", 50.0)])
        # instante com fuso positivo depois da captura em UTC não antecipa: 10/09 14h59 em UTC+3 = 11h59 UTC
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-10T14:59:00+03:00"), [("2026-08-31", 50.0)])

    def test_vintage_antiga_importada_depois_nao_some(self):
        con = _con()
        nova, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-10T00:00:00Z", None, "2" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", nova, [("s", "2026-08-31", 50.0)])
        antiga, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", None, "1" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", antiga, [("s", "2026-08-31", 50.0)])
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-05T00:00:00Z"), [("2026-08-31", 50.0)])

    def test_vintage_intermediaria_fora_de_ordem(self):
        con = _con()
        v1, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", None, "1" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v1, [("s", "d", 100.0)])
        v3, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-10T00:00:00Z", None, "3" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v3, [("s", "d", 100.0)])
        v2, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-05T00:00:00Z", None, "2" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v2, [("s", "d", 50.0)])
        self.assertEqual(base.serie_vigente(con, "ds", "s"), [("d", 100.0)])
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-06T00:00:00Z"), [("d", 50.0)])
        self.assertEqual(base.como_estava_em(con, "ds", "s", "2026-09-02T00:00:00Z"), [("d", 100.0)])

    def test_mesmo_valor_em_ordem_inversa_nao_e_revisao(self):
        from pipeline.energia.gold import comum as c
        con = _con()
        v3, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-10T00:00:00Z", None, "3" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v3, [("s", "d", 100.0)])
        v1, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", None, "1" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v1, [("s", "d", 100.0)])
        self.assertEqual(c.revisoes_do_dataset(con, "ds")["total"], 0)

    def test_duplicata_no_mesmo_arquivo_nao_e_revisao(self):
        con = _con()
        v, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", None, "1" * 64, 1, "teste", None)
        self.assertEqual(base.grava_observacoes(con, "ds", v, [("s", "d", 1.0), ("s", "d", 2.0)]), (1, 0))
        self.assertEqual(base.serie_vigente(con, "ds", "s"), [("d", 2.0)])

    def test_revisoes_detectadas_no_snapshot(self):
        from pipeline.energia.gold import comum as c
        con = _con()
        v1, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-01T00:00:00Z", "2026-08-31T20:00:00Z", "1" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v1, [("s", "d1", 1.0), ("s", "d2", 5.0)])
        v2, _ = base.registra_vintage(con, "ds", "r", "u", "2026-09-02T00:00:00Z", "2026-09-01T20:00:00Z", "2" * 64, 1, "teste", None)
        base.grava_observacoes(con, "ds", v2, [("s", "d1", 1.5), ("s", "d2", 5.0)])
        snap = c.snapshot_de(con, "ds")
        self.assertEqual(snap["revisoes"]["total"], 1)
        self.assertEqual(snap["revisoes"]["exemplos"][0]["ref"], "d1")
        prov = c.proveniencia(indicador="x", natureza="OBSERVADO", fonte={}, unidade="u", frequencia="f",
                              periodo={}, cobertura={}, capturado_em="t", snapshot=snap, limitacoes=["l"])
        self.assertEqual(prov["publicado_pela_fonte_em"], "2026-09-01T20:00:00Z")
        self.assertEqual(prov["revisoes_conhecidas"]["total"], 1)

    def test_bissexto_conta_uma_vez_no_padrao(self):
        from pipeline.energia.gold import hidrologia as h
        serie = {}
        for a in range(2001, 2025):
            serie[f"{a}-02-28"] = 10.0
            if a % 4 == 0:
                serie[f"{a}-02-29"] = 99.0
        saz = h._sazonal(serie, "2025-03-01")
        self.assertEqual(saz["02-28"][3], 24)
        self.assertEqual(saz["02-28"][1], 10.0)
        self.assertNotIn("02-29", saz)
        self.assertTrue(h._entra_no_padrao("2023-02-28", "2024-02-29"))
        self.assertFalse(h._entra_no_padrao("2020-02-29", "2024-02-28"))

    def test_mes_parcial_pelo_calendario(self):
        from pipeline.energia.gold import pld
        self.assertTrue(pld.mes_parcial("2026-09", 28))
        self.assertFalse(pld.mes_parcial("2026-09", 30))
        self.assertTrue(pld.mes_parcial("2024-02", 28))
        self.assertFalse(pld.mes_parcial("2024-02", 29))

    def test_horizonte_de_publicacao(self):
        from pipeline.energia import validacoes as v
        cap = {"ccee_pld_horario": "2026-09-27T15:44:02Z", "cmo_se": "2026-09-28T09:00:00Z", "carga_energia_di": "2026-09-28T02:00:00Z"}
        self.assertEqual(v.viola_horizonte("pld.json", {"disponivel": True, "ultima_hora": "2026-09-28T23:00"}, cap), [])
        self.assertEqual(len(v.viola_horizonte("pld.json", {"disponivel": True, "ultima_hora": "2026-09-29T00:00"}, cap)), 1)
        self.assertEqual(v.viola_horizonte("cmo.json", {"disponivel": True, "semana_referencia": "2026-10-09"}, cap), [])
        # captura 28/09 02h00 UTC = 27/09 23h00 em Brasília: carga de 28/09 ainda não existia
        self.assertEqual(len(v.viola_horizonte("carga.json", {"disponivel": True, "dia_referencia": "2026-09-28"}, cap)), 1)


class GovernancaEndurecidaTest(unittest.TestCase):
    """Achados A4 e A5: regras valem para rodada interna e datas com fuso."""

    def _rec(self, **kw):
        r = {"forecast_id": "x", "tipo": "RODADA_INTERNA", "status": "DISPONIVEL", "previsao": 100.0, "quantis": None,
             "motivo": None, "modelo": "C1", "estado_modelo": "PESQUISA", "cutoff": "2026-09-27T10:00:00Z"}
        r.update(kw)
        r["sha256"] = g.hash_registro(r)
        return r

    def test_faixa_de_80_sem_calibracao_barrada_tambem_em_rodada_interna(self):
        r = self._rec(quantis={"rotulo_faixa": "faixa de 80%"}, calibracao={"status": "DESCALIBRADO"})
        self.assertTrue(any("80%" in x for x in g.valida_registro(r, {})))

    def test_look_ahead_com_fusos_diferentes(self):
        r = self._rec(features_usadas=[{"serie": "pld.SE", "capturado_em": "2026-09-27T08:00:00-03:00"}])
        self.assertTrue(any("look-ahead" in x for x in g.valida_registro(r, {})))
        ok = self._rec(features_usadas=[{"serie": "pld.SE", "capturado_em": "2026-09-27T06:59:00-03:00"}])
        self.assertEqual(g.valida_registro(ok, {}), [])

    def test_publicacao_exige_features_e_natureza(self):
        mods = {"C1": {"estado": "PRODUCAO"}}
        r = self._rec(tipo="PUBLICACAO", estado_modelo="PRODUCAO", versao_modelo="v", versao_codigo="c", snapshot="s",
                      emitido_em="2026-09-27T10:30:00Z")
        v = g.valida_registro(r, mods)
        self.assertTrue(any("features_usadas" in x for x in v))
        self.assertTrue(any("PREVISTO" in x for x in v))

    def test_rodada_interna_com_numero_barrada_com_resultados_retidos(self):
        r = self._rec()
        self.assertEqual(g.valida_arquivo([r], {}, resultados_liberados=True), [])
        self.assertTrue(any("retida" in x for x in g.valida_arquivo([r], {}, resultados_liberados=False)))
        # a decisão é explícita: sem ela, o validador recusa rodar
        with self.assertRaises(ValueError):
            g.valida_arquivo([r], {}, resultados_liberados=None)

    def test_valor_nao_finito_e_rotulo_por_extenso_barrados(self):
        for ruim in (float("nan"), float("inf")):
            v = g.valida_registro(self._rec(previsao=ruim), {})
            self.assertTrue(any("finito" in x for x in v), v)
        for rotulo in ("faixa de oitenta por cento", "Faixa P10 a P90", "p10–p90", "80pct", "faixa de 80", "cobertura 0,8"):
            v = g.valida_registro(self._rec(quantis={"rotulo_faixa": rotulo, "p10": 1.0, "p90": 2.0}), {})
            self.assertTrue(any("80%" in x for x in v), (rotulo, v))
        v = g.valida_registro(self._rec(quantis={"rotulo_faixa": "faixa", "p10": float("nan")}), {})
        self.assertTrue(any("quantis.p10 não finito" in x for x in v), v)

    def test_feature_sem_captura_e_corte_sem_fuso_barrados(self):
        mods = {"C1": {"estado": "PRODUCAO"}}
        r = self._rec(tipo="PUBLICACAO", estado_modelo="PRODUCAO", versao_modelo="v", versao_codigo="c", snapshot="s",
                      emitido_em="2026-09-27T10:30:00Z", natureza="PREVISTO", features_usadas=[{"serie": "pld.SE"}])
        self.assertTrue(any("sem capturado_em" in x for x in g.valida_registro(r, mods)))
        r2 = self._rec(cutoff="2026-09-27T10:00:00", features_usadas=[{"serie": "pld.SE", "capturado_em": "2026-09-27T12:00:00Z"}])
        self.assertTrue(any("cutoff sem fuso" in x for x in g.valida_registro(r2, {})))

    def test_rotulo_de_80_em_outras_grafias(self):
        for rot in ("faixa de 80 %", "Faixa de 80%", "faixa de 80 por cento"):
            r = self._rec(quantis={"rotulo_faixa": rot}, calibracao={"status": "DESCALIBRADO"})
            self.assertTrue(any("80%" in x for x in g.valida_registro(r, {})), rot)

    def test_versao_codigo_marca_arvore_alterada(self):
        v = base.versao_codigo()
        self.assertTrue(v is None or v.endswith("+alterado") or len(v) == 12)

    def test_cenario_barrado_em_qualquer_campo(self):
        r = self._rec(natureza="CENARIO")
        self.assertTrue(g.valida_registro(r, {}))
        r2 = self._rec(evidencia={"classe": "cenário de estresse"})
        self.assertTrue(any("cenário" in x for x in g.valida_registro(r2, {})))


if __name__ == "__main__":
    unittest.main()
