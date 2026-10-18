"""Regressões da issue #116: silver restaurado sem os arquivos bronze (sem rede)."""
import json
import os
import tempfile
import unittest
from datetime import date
from unittest.mock import patch

from pipeline.energia import base
from pipeline.energia.modulos import agua_detalhe as agua, expansao
from pipeline.tests.test_energia_expansao import _silver_dos_recortes


class TestGoldComBronzeOrfao(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.con = base.conecta(":memory:")
        self.addCleanup(self.con.close)
        for nome in ("GOLD", "SERIES", "BRONZE"):
            caminho = os.path.join(self.tmp.name, nome)
            os.makedirs(caminho)
            p = patch.object(base, nome, caminho)
            p.start()
            self.addCleanup(p.stop)

    def orfa(self, con, ds, rec):
        arquivo = os.path.join(base.BRONZE, rec, "20261007T025531Z.ba879f36c971.json.gz")
        base.registra_vintage(con, ds, rec, "https://fonte.test/recurso", "2026-10-07T02:55:31Z",
                              None, "ba879f36c971" + "0" * 52, 100, "coleta_direta", arquivo)

    def test_agua_publica_observacoes_quando_previsao_nao_tem_bronze(self):
        self.orfa(self.con, agua.DS_PREV, "previsao_20261006T0000Z")
        # Isola as entradas observadas; a construção real alcança a leitura da previsão.
        def armazenamento(con, principal, d):
            d.update(dia_ear="2026-10-01", armazenamento={"valor_observado": 42}, reconciliacao_ear={})
        def afluencia(con, principal, d):
            d.update(dia_ena="2026-10-01", afluencia={})
        def clima(con, d):
            prev, motivo = agua._previsao(con, d)
            d["clima"] = {"previsao": prev}
            if motivo:
                d["_pendencias_clima"] = [motivo]
        with patch.object(agua, "_armazenamento", armazenamento), patch.object(agua, "_afluencia", afluencia), \
             patch.object(agua, "_clima", clima), patch.object(agua, "_reservatorios"), \
             patch.object(agua, "_valida", return_value=[]), patch.object(agua, "_csvs", return_value=[]), \
             patch.object(agua, "_proveniencias_e_evidencias", return_value=({}, {})):
            gold = agua.construir(self.con, {"con_principal": self.con})
        self.assertTrue(gold["disponivel"])
        self.assertEqual(gold["armazenamento"]["valor_observado"], 42)
        self.assertIsNone(gold["clima"]["previsao"])
        self.assertIn("bronze", " ".join(gold["pendencias"]))

    def test_expansao_publica_outros_blocos_quando_rede_epe_nao_tem_bronze(self):
        con = _silver_dos_recortes()
        self.addCleanup(con.close)
        for camada in ("existente", "planejada"):
            self.orfa(con, expansao.DS_REDE_EPE, f"linhas-transmissao-{camada}.geojson")
        with patch.object(expansao, "_valida", return_value=([], [])):
            gold = expansao.construir(con, {"hoje": date(2026, 9, 30)})
        self.assertTrue(gold["disponivel"])
        self.assertGreater(gold["capacidade_instalada"]["total"]["mw_fiscalizado"], 0)
        self.assertIsNone(gold["transmissao"]["rede_epe"])
        self.assertIn("bronze", " ".join(gold["ressalvas"]))
        self.assertTrue(all(x["km_rede_existente_epe"] is None for x in gold["transmissao"]["geracao_e_rede_por_uf"]))


    def test_expansao_sem_nenhum_bronze_historico_preserva_carteira_atual(self):
        con = _silver_dos_recortes()
        self.addCleanup(con.close)
        con.execute("UPDATE vintages SET arquivo=? WHERE dataset=? AND recurso LIKE '%historico.parquet'",
                    (os.path.join(base.BRONZE, "inexistente.parquet.gz"), expansao.DS_RALIE))
        with patch.object(expansao, "_valida", return_value=([], [])):
            gold = expansao.construir(con, {"hoje": date(2026, 9, 30)})
        self.assertTrue(gold["disponivel"])
        self.assertGreater(gold["estagios"]["ralie"]["ugs"], 0)
        hist = gold["cronograma"]["historico_fonte"]
        self.assertFalse(hist["disponivel"])
        self.assertIn("ausente", hist["motivo"])
        self.assertIsNone(hist["fotografias"])
        self.assertIsNone(gold["estagios"]["unidades_atipicas"]["pares"])
        self.assertIsNone(gold["proveniencia"]["coortes"]["capturado_em"])
        self.assertEqual(gold["cronograma"]["confiabilidade"], [])
        self.assertEqual(gold["conferencias"]["ralie_csv_x_parquet"]["resultado"], "nao_executada")

    def test_epe_recaptura_orfa_mesmo_com_coleta_ok_recente(self):
        from datetime import datetime, timezone
        for camada in ("existente", "planejada"):
            rec = f"linhas-transmissao-{camada}.geojson"
            self.orfa(self.con, expansao.DS_REDE_EPE, rec)
            base.registra_coleta(self.con, expansao.DS_REDE_EPE, rec, True)
        chamadas = []
        def baixar(url, **kw):
            chamadas.append(url)
            if "returnCountOnly=true" in url:
                return b'{"count":1}', {}
            return b'{"features":[{"id":1,"properties":{},"geometry":null}]}', {}
        with patch.object(expansao.time, "sleep"):
            st = expansao._baixa_rede_epe(self.con, baixar=baixar, agora=datetime.now(timezone.utc))
        self.assertEqual(st["puladas"], 0)
        self.assertEqual(st["novas"], 2)
        self.assertEqual(len(chamadas), 4)
        self.assertEqual(len(base.vintages_com_bronze(self.con, expansao.DS_REDE_EPE)), 2)

    def test_rodada_orfa_nao_e_tratada_como_ja_agregada(self):
        self.orfa(self.con, agua.DS_PREV, "previsao_20261006T0000Z")
        st = {}
        with patch.object(agua, "_baixa_url", return_value={"status": "falha", "detalhe": "fonte indisponível"}) as baixar:
            agua._coleta_previsao(self.con, [{"id": "ponto", "lat": -20, "lon": -40}], [], st, hoje_utc=date(2026, 10, 6))
        self.assertGreater(baixar.call_count, 0)
        self.assertFalse(st.get("ja_agregada", False))

    def test_rede_epe_anterior_publica_data_e_sha_originais(self):
        import shutil
        from pipeline.tests.test_energia_expansao import DADOS
        con = _silver_dos_recortes()
        self.addCleanup(con.close)
        for camada in ("existente", "planejada"):
            rec = f"linhas-transmissao-{camada}.geojson"
            arquivo = os.path.join(base.BRONZE, f"{camada}.json")
            shutil.copyfile(os.path.join(DADOS, f"epe_rede_{camada}_recorte.json"), arquivo)
            base.registra_vintage(con, expansao.DS_REDE_EPE, rec, "https://epe.test/camada",
                                  "2026-09-30T00:00:00Z", None, ("a" if camada == "existente" else "b") * 64,
                                  os.path.getsize(arquivo), "teste", arquivo)
            self.orfa(con, expansao.DS_REDE_EPE, rec)
        with patch.object(expansao, "_valida", return_value=([], [])):
            gold = expansao.construir(con, {"hoje": date(2026, 9, 30)})
        self.assertTrue(gold["disponivel"])
        self.assertEqual(gold["referencias"]["rede_epe_capturada_em"], "2026-09-30T00:00:00Z")
        self.assertEqual(gold["proveniencia"]["rede_epe"]["capturado_em"], "2026-09-30T00:00:00Z")
        self.assertEqual(gold["transmissao"]["rede_epe"]["existente"]["sha256"], "a" * 64)
        self.assertGreater(gold["transmissao"]["rede_epe"]["existente"]["km_geometria"], 0)


class TestMercadoSemSeriesAgentes(unittest.TestCase):
    def test_proveniencia_quando_ccee_nao_oferece_series_de_agentes(self):
        import copy
        from pipeline.energia.modulos import mercado
        # Os outros blocos não participam da falha de 03/10; usam o contrato publicado.
        with open(os.path.join(base.RAIZ, "public/energia/gold/mercado.json")) as f:
            publicado = json.load(f)
        livre = copy.deepcopy(publicado["livre_regulado"])
        livre["samp"] = {"ano_referencia": livre["distribuidoras"]["ano"], "distribuidoras": [], "nacional_mensal": [{"mes": "2026-01"}]}
        agentes = copy.deepcopy(publicado["agentes_migracao"])
        for k in ("agentes_por_classe_mensal", "associados_fluxos", "parcelas_mensal", "desligamentos_por_ano"):
            agentes[k] = []
        detalhe = {"risco_hidrologico_acr_mensal": [], "mcp_submercado_mensal": []}
        enc = copy.deepcopy(publicado["encargos"])
        enc["mme"]["reconciliacao_ccee"] = []
        class CapturouProveniencia(Exception):
            pass
        notas = []
        def captura(**kw):
            if kw.get("indicador", "").startswith("Agentes, perfis"):
                notas.append(kw["notas_fonte"])
                raise CapturouProveniencia
            return {}
        con = base.conecta(":memory:")
        self.addCleanup(con.close)
        with patch.object(mercado, "secao_livre_regulado", return_value=livre), \
             patch.object(mercado, "secao_agentes", return_value=agentes), \
             patch.object(mercado, "secao_mre", return_value=copy.deepcopy(publicado["mre_gsf"])), \
             patch.object(mercado, "secao_encargos", return_value=enc), \
             patch.object(mercado, "_valida", return_value=([], [])), \
             patch.object(mercado, "_compacta", return_value=detalhe), \
             patch.object(mercado.c, "proveniencia", side_effect=captura):
            with self.assertRaises(CapturouProveniencia):
                mercado.construir(con, {"hoje": date(2026, 10, 18)})
        self.assertIn("indisponíveis", notas[0])
        self.assertIn("Cadastro de perfis", notas[0])


class TestSelecaoEBronzeDuravel(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = self.tmp.name
        self.bronze = os.path.join(self.raiz, "data/energia/bronze")
        self.silver = os.path.join(self.raiz, "data/energia/silver")
        os.makedirs(self.silver)
        for nome, valor in (("RAIZ", self.raiz), ("BRONZE", self.bronze), ("SILVER", self.silver)):
            p = patch.object(base, nome, valor)
            p.start()
            self.addCleanup(p.stop)
        self.con = base.conecta(os.path.join(self.silver, "familia.db"))
        self.addCleanup(self.con.close)

    def vintage(self, ds, rec, corpo=b"conteudo original", captura="2026-10-01T00:00:00Z"):
        arquivo, sha = base.salva_bronze("fonte", ds, rec, corpo, "json", captura)
        vid, _ = base.registra_vintage(self.con, ds, rec, "https://fonte.test/original", captura,
                                      None, sha, len(corpo), "coleta_direta", arquivo)
        self.con.commit()
        return base.ultima_vintage(self.con, ds, rec)

    def test_ultima_orfa_nao_substitui_captura_disponivel(self):
        anterior = self.vintage("ds", "rec")
        nova = self.vintage("ds", "rec", b"outro", "2026-10-07T00:00:00Z")
        os.remove(base.caminho_bronze(nova["arquivo"]))
        v = base.vintages_com_bronze(self.con, "ds")["rec"]
        self.assertEqual(v, anterior)
        self.assertEqual(base.ultima_vintage(self.con, "ds", "rec"), nova)

    def test_backup_restaurado_preserva_bytes_datas_e_respeita_limite(self):
        import shutil
        from pathlib import Path
        from pipeline.energia import estado_bronze as estado
        anterior = self.vintage("ds", "rec", b"conteudo incompressivel " * 300)
        nova = self.vintage("ds", "rec", b"ausente", "2026-10-07T00:00:00Z")
        os.remove(base.caminho_bronze(nova["arquivo"]))
        antes = Path(base.caminho_bronze(anterior["arquivo"])).read_bytes()
        destino = os.path.join(self.raiz, "backup")
        man = estado.guardar(destino, limite=1024)
        self.assertGreater(len(man["partes"]), 1)
        self.assertTrue(all(p["bytes"] <= 1024 for p in man["partes"]))
        self.assertEqual(man["recursos"][0]["capturado_em"], anterior["capturado_em"])
        shutil.rmtree(self.bronze)
        estado.restaurar(destino)
        self.assertEqual(Path(base.caminho_bronze(anterior["arquivo"])).read_bytes(), antes)
        self.assertFalse(base.bronze_disponivel(nova))

    def test_seed_versionado_fora_do_bronze_nao_interrompe_backup(self):
        from pathlib import Path
        from pipeline.energia import estado_bronze as estado
        seed = Path(self.raiz, "pipeline/energia/seed/exemplo.json")
        seed.parent.mkdir(parents=True)
        seed.write_bytes(b'{}')
        base.registra_vintage(self.con, "ds", "seed", "https://fonte.test/seed", "2026-10-01T00:00:00Z",
                              None, base.sha256_bytes(b'{}'), 2, "seed_versionado", str(seed))
        self.con.commit()
        man = estado.guardar(os.path.join(self.raiz, "backup"))
        self.assertEqual(man["recursos"], [])
        self.assertEqual(man["ausentes"], [])
        self.assertEqual(len(man["externos"]), 1)
        self.assertEqual(man["externos"][0]["recurso"], "seed")

    def test_backup_parte_corrompida_falha_antes_de_extrair(self):
        import shutil
        from pathlib import Path
        from pipeline.energia import estado_bronze as estado
        self.vintage("ds", "rec")
        destino = os.path.join(self.raiz, "backup")
        man = estado.guardar(destino, limite=1024)
        shutil.rmtree(self.bronze)
        (Path(destino) / man["partes"][0]["nome"]).write_bytes(b"corrompido")
        with self.assertRaisesRegex(ValueError, "parte de bronze inválida"):
            estado.restaurar(destino)
        self.assertFalse(os.path.exists(self.bronze))

    def test_recoleta_mesmo_que_ultima_tentativa_ok_seja_recente(self):
        from datetime import datetime, timezone
        from pipeline.energia.fontes import ckan
        anterior = self.vintage("ds", "rec")
        os.remove(base.caminho_bronze(anterior["arquivo"]))
        base.registra_coleta(self.con, "ds", "rec", True)
        self.con.commit()
        chamadas = []
        def baixar(url, destino):
            chamadas.append(url)
            with open(destino, "wb") as f:
                f.write(b"conteudo novo")
            return destino, 13
        r = ckan.baixar_recurso(self.con, orgao="fonte", dataset="ds", recurso="rec",
                               url="https://fonte.test/rec", publicado_em=None, ext="json",
                               max_idade_dias=30, agora=datetime.now(timezone.utc), baixador=baixar)
        self.assertEqual(r["status"], "nova")
        self.assertEqual(len(chamadas), 1)
        self.assertTrue(base.bronze_disponivel(r["vintage"]))
        self.assertNotEqual(r["vintage"]["sha256"], anterior["sha256"])

    def test_recaptura_identica_religa_bronze_sem_alterar_data_da_vintage(self):
        from pipeline.energia.fontes import ckan
        anterior = self.vintage("ds", "rec")
        os.remove(base.caminho_bronze(anterior["arquivo"]))
        def baixar(url, destino):
            with open(destino, "wb") as f:
                f.write(b"conteudo original")
            return destino, 17
        r = ckan.baixar_recurso(self.con, orgao="fonte", dataset="ds", recurso="rec",
                               url="https://fonte.test/rec", publicado_em=None, ext="json", baixador=baixar)
        self.assertEqual(r["status"], "identica")
        self.assertEqual(r["vintage"]["capturado_em"], anterior["capturado_em"])
        self.assertTrue(base.bronze_disponivel(r["vintage"]))

    def test_historico_mensal_respeita_captura_do_bronze_selecionado(self):
        v = self.vintage(expansao.DS_RALIE, "historico", b"primeiro")
        base.grava_observacoes(self.con, expansao.DS_RALIE, v["vintage_id"],
                              [("ug.kw.UTE", "2026-09-01", 1000), ("usina.kw_outorgado.tipo.UTE", "2026-09-01", 2000)])
        nova = self.vintage(expansao.DS_RALIE, "historico", b"segundo", "2026-10-07T00:00:00Z")
        base.grava_observacoes(self.con, expansao.DS_RALIE, nova["vintage_id"],
                              [("ug.kw.UTE", "2026-09-01", 9000), ("usina.kw_outorgado.tipo.UTE", "2026-09-01", 8000)])
        r = expansao._historico_mensal(self.con, ["2026-09-01"], captura_ug=v["capturado_em"], captura_us=v["capturado_em"])
        self.assertEqual(r[0]["mw_ugs"], 1.0)
        self.assertEqual(r[0]["mw_outorgado"], 2.0)

    def test_mercado_pagina_mme_sem_bronze_nao_significa_zero_pdfs(self):
        from pipeline.energia.modulos import mercado
        v = self.vintage(mercado.DS_MME, "pasta-2025")
        os.remove(base.caminho_bronze(v["arquivo"]))
        bloqueios = mercado.bloqueios(self.con, date(2026, 10, 18))
        ev = next(x["evidencia"] for x in bloqueios if x["id"] == "boletim_mme_anos_anteriores")
        p = next(x for x in ev["pastas"] if x["ano"] == "2025")
        self.assertIsNone(p["pdfs_encontrados"])
        self.assertIsNone(p["redireciona_login"])
        self.assertIsNone(p["capturado_em"])
        self.assertIn("ausente", p["motivo"])
        self.assertIn("desconhecidas", ev["observacao"])

    def test_previsao_anterior_nao_mistura_observacoes_da_orfa(self):
        from datetime import datetime, timezone
        dias = [f"2026-10-{d:02d}" for d in range(1, 8)]
        doc = {"rodada": {"inicializacao": "2026-10-01T00:00Z"}, "dias": dias}
        v = self.vintage(agua.DS_PREV, "previsao_20261001T0000Z", json.dumps(doc).encode())
        base.grava_observacoes(self.con, agua.DS_PREV, v["vintage_id"], [("prev_mm.BACIA", d, 2) for d in dias])
        nova = self.vintage(agua.DS_PREV, "previsao_20261002T0000Z", b"ausente", "2026-10-02T00:00:00Z")
        base.grava_observacoes(self.con, agua.DS_PREV, nova["vintage_id"], [("prev_mm.BACIA", d, 99) for d in dias])
        os.remove(base.caminho_bronze(nova["arquivo"]))
        d = {}
        with patch.object(agua, "datetime", wraps=datetime) as relogio:
            relogio.now.return_value = datetime(2026, 10, 2, tzinfo=timezone.utc)
            prev, motivo = agua._previsao(self.con, d)
        self.assertIsNone(motivo)
        self.assertEqual(prev["capturada_em"], "2026-10-01T00:00:00Z")
        self.assertEqual(prev["bacias"][0]["mm"], [2.0] * 7)
        self.assertEqual(d["_previsao_vintage"]["sha256"], v["sha256"])

    def test_previsao_antiga_disponivel_nao_e_apresentada_como_atual(self):
        doc = {"rodada": {"inicializacao": "2000-01-01T00:00Z"}, "dias": ["2000-01-01"]}
        self.vintage(agua.DS_PREV, "previsao_20000101T0000Z", json.dumps(doc).encode())
        prev, motivo = agua._previsao(self.con, {})
        self.assertIsNone(prev)
        self.assertIn("desatualizada", motivo)
        self.assertIn("2000-01-01", motivo)
