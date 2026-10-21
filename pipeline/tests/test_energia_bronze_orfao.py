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

    def test_historico_antigo_nao_classifica_coortes_como_fotografia_corrente(self):
        con = _silver_dos_recortes()
        self.addCleanup(con.close)
        # Fotografia corrente sintética posterior ao histórico bruto disponível.
        con.execute("UPDATE registros SET valor=? WHERE dataset=? AND chave=? AND campo='datas_ralie'",
                    (json.dumps(["2026-10-01"]), expansao.DS_RALIE, "meta:ralie-usina-atual.csv"))
        with patch.object(expansao, "_valida", return_value=([], [])):
            gold = expansao.construir(con, {"hoje": date(2026, 10, 2)})
        self.assertTrue(gold["disponivel"])
        self.assertTrue(gold["cronograma"]["historico_fonte"]["disponivel"])
        self.assertGreater(len(gold["estagios"]["historico_mensal"]), 0)
        self.assertEqual(gold["estagios"]["coortes"], [])
        self.assertFalse(gold["estagios"]["coortes_status"]["disponivel"])
        self.assertIsNone(gold["estagios"]["coortes_peso"]["usinas_que_ja_operavam"])
        self.assertIsNone(gold["proveniencia"]["coortes"]["capturado_em"])
        self.assertIsNone(gold["conferencias"]["ralie_csv_x_parquet"]["ugs_parquet"])
        self.assertGreater(gold["estagios"]["ralie"]["ugs"], 0)

    def test_coortes_exigem_calendarios_iguais_tambem_no_passado(self):
        import hashlib
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.parquet as pq
        from pipeline.tests.test_energia_expansao import DADOS
        con = _silver_dos_recortes()
        self.addCleanup(con.close)
        tabela = pq.read_table(os.path.join(DADOS, "ralie_ug_historico_recorte.parquet"))
        primeira = pc.min(tabela["DatRalie"]).as_py()
        tabela = tabela.filter(pc.not_equal(tabela["DatRalie"], pa.scalar(primeira, type=tabela["DatRalie"].type)))
        arquivo = os.path.join(base.BRONZE, "historico-sem-primeira-fotografia.parquet")
        pq.write_table(tabela, arquivo)
        with open(arquivo, "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
        base.registra_vintage(con, expansao.DS_RALIE, "ralie-unidade-geradora-historico.parquet", "fixture sintética",
                              "2026-10-01T00:00:00Z", None, sha, os.path.getsize(arquivo), "teste_sintetico", arquivo)
        with patch.object(expansao, "_valida", return_value=([], [])):
            gold = expansao.construir(con, {"hoje": date(2026, 10, 2)})
        self.assertTrue(gold["cronograma"]["historico_fonte"]["disponivel"])
        self.assertGreater(len(gold["estagios"]["historico_mensal"]), 0)
        self.assertEqual(gold["referencias"]["ralie"], "2026-09-18")
        self.assertEqual(gold["cronograma"]["historico_fonte"]["ultima_fotografia"], "2026-09-18")
        self.assertEqual(gold["estagios"]["coortes"], [])
        self.assertFalse(gold["estagios"]["coortes_status"]["disponivel"])
        self.assertIsNone(gold["estagios"]["coortes_peso"]["usinas_que_ja_operavam"])

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
        # orçamento de recaptura de órfãs zerado a cada teste (estado do processo em base._ORFAS)
        p = patch.dict(base._ORFAS, {"gasto_s": 0.0, "recapturadas": 0, "adiadas": 0, "adiadas_prazo": 0})
        p.start()
        self.addCleanup(p.stop)

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

    def test_restauracao_preserva_bronze_do_cache_e_troca_truncado_por_rename(self):
        from pathlib import Path
        from pipeline.energia import estado_bronze as estado
        bom = self.vintage("ds", "a", b"bronze do cache " * 50)
        truncado = self.vintage("ds", "b", b"bronze completo " * 50)
        ausente = self.vintage("ds", "c", b"bronze perdido " * 50)
        caminhos = {k: Path(base.caminho_bronze(v["arquivo"])) for k, v in
                    (("bom", bom), ("truncado", truncado), ("ausente", ausente))}
        completos = {k: c.read_bytes() for k, c in caminhos.items()}
        destino = os.path.join(self.raiz, "backup")
        estado.guardar(destino, limite=1024)
        inode_bom = caminhos["bom"].stat().st_ino
        os.utime(caminhos["bom"], (1_000_000_000, 1_000_000_000))  # marca: reescrita mudaria a data
        caminhos["truncado"].write_bytes(completos["truncado"][:10])
        os.remove(caminhos["ausente"])
        estado.restaurar(destino)
        self.assertEqual(caminhos["bom"].stat().st_ino, inode_bom)
        self.assertEqual(caminhos["bom"].stat().st_mtime, 1_000_000_000)
        for k, c in caminhos.items():
            self.assertEqual(c.read_bytes(), completos[k], k)
        restos = [n for _, _, ns in os.walk(self.bronze) for n in ns if n.endswith(".restaurando")]
        self.assertEqual(restos, [])

    def test_restauracao_interrompida_nao_deixa_arquivo_truncado_com_nome_do_bronze(self):
        from pathlib import Path
        from unittest import mock
        from pipeline.energia import estado_bronze as estado
        v = self.vintage("ds", "a", b"bronze perdido " * 50)
        caminho = Path(base.caminho_bronze(v["arquivo"]))
        destino = os.path.join(self.raiz, "backup")
        estado.guardar(destino, limite=1024)
        os.remove(caminho)

        def copia_pela_metade(origem, f, *args, **kwargs):
            f.write(origem.read(7))
            raise OSError("disco cheio")

        import shutil
        import tarfile
        with mock.patch.object(shutil, "copyfileobj", copia_pela_metade), \
                mock.patch.object(tarfile, "copyfileobj", copia_pela_metade):
            with self.assertRaises(OSError):
                estado.restaurar(destino)
        self.assertFalse(base.bronze_disponivel(v))
        self.assertEqual(os.listdir(caminho.parent), [])

    def test_bronze_truncado_no_cache_pede_restauracao(self):
        from pathlib import Path
        from pipeline.energia import estado_bronze as estado
        v = self.vintage("ds", "a", b"bronze completo " * 50)
        destino = os.path.join(self.raiz, "backup")
        man = estado.guardar(destino, limite=1024)
        caminho = Path(base.caminho_bronze(v["arquivo"]))
        self.assertEqual(man["recursos"][0]["bytes"], caminho.stat().st_size)
        self.assertFalse(estado.necessita_restaurar(destino))
        caminho.write_bytes(caminho.read_bytes()[:10])
        self.assertTrue(base.bronze_disponivel(v))  # o arquivo existe: só o tamanho denuncia
        self.assertTrue(estado.necessita_restaurar(destino))

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

    def _orfa_recente(self, rec):
        v = self.vintage("ds", rec)
        os.remove(base.caminho_bronze(v["arquivo"]))
        base.registra_coleta(self.con, "ds", rec, True)
        self.con.commit()
        return v

    def _baixa(self, rec, chamadas, max_idade_dias=30, forcar=False):
        from datetime import datetime, timezone
        from pipeline.energia.fontes import ckan
        def baixar(url, destino):
            chamadas.append(url)
            with open(destino, "wb") as f:
                f.write(b"conteudo novo " + rec.encode())
            return destino, 20
        return ckan.baixar_recurso(self.con, orgao="fonte", dataset="ds", recurso=rec,
                                   url=f"https://fonte.test/{rec}", publicado_em=None, ext="json",
                                   max_idade_dias=max_idade_dias, forcar=forcar,
                                   agora=datetime.now(timezone.utc), baixador=baixar)

    def test_orcamento_esgotado_adia_recaptura_de_orfa(self):
        """19/10/2026: as recapturas de órfãs passaram do limite de 150 min do job e nada foi
        publicado. Esgotado o orçamento da execução, a órfã fica para a próxima; a recaptura
        anterior a isso conta no orçamento. A adiada volta sem vintage (review #286): os
        consumidores abrem o arquivo de qualquer vintage não nula."""
        self._orfa_recente("a")
        self._orfa_recente("b")
        chamadas = []
        with patch.object(base, "ORCAMENTO_ORFAS_S", 10.0), \
                patch.object(base, "relogio", side_effect=[0.0, 15.0]):
            r_a = self._baixa("a", chamadas)
            r_b = self._baixa("b", chamadas)
            resumo = base.resumo_orfas()
        self.assertEqual(r_a["status"], "nova")
        self.assertEqual((r_b["status"], r_b["vintage"]), ("pulada", None))
        self.assertIn("orçamento", r_b["detalhe"])
        self.assertEqual(chamadas, ["https://fonte.test/a"])
        self.assertEqual((resumo["gasto_s"], resumo["recapturadas"], resumo["adiadas"]), (15.0, 1, 1))

    def test_orfa_com_coleta_vencida_tambem_usa_orcamento(self):
        """Review #286: a NASA e a Open-Meteo falhavam por bronze ausente desde 06/10; a última
        coleta ok é antiga e a recoleta já é devida. Órfã devida também entra no orçamento."""
        antiga = self.vintage("ds", "antiga")
        os.remove(base.caminho_bronze(antiga["arquivo"]))  # nenhuma coleta ok registrada
        chamadas = []
        with patch.object(base, "ORCAMENTO_ORFAS_S", 0.0):
            r = self._baixa("antiga", chamadas, max_idade_dias=1)
        self.assertEqual((r["status"], r["vintage"], chamadas), ("pulada", None, []))

    def test_prazo_de_coleta_adia_recoleta_devida_e_preserva_vintage_com_bronze(self):
        disponivel = self.vintage("ds", "disp")  # bronze presente, nenhuma coleta ok: recoleta devida
        chamadas = []
        with patch.object(base, "PRAZO_COLETA_S", 0.0):
            r = self._baixa("disp", chamadas, max_idade_dias=1)
            nova = self._baixa("inedito", chamadas)  # recurso sem vintage não espera
            resumo = base.resumo_orfas()
        self.assertEqual((r["status"], r["vintage"]), ("pulada", disponivel))
        self.assertIn("prazo", r["detalhe"])
        self.assertEqual(nova["status"], "nova")
        self.assertEqual(chamadas, ["https://fonte.test/inedito"])
        self.assertEqual(resumo["adiadas_prazo"], 1)

    def test_coleta_forcada_nao_espera_orcamento_nem_prazo(self):
        self._orfa_recente("forcada")
        chamadas = []
        with patch.object(base, "ORCAMENTO_ORFAS_S", 0.0), patch.object(base, "PRAZO_COLETA_S", 0.0):
            r = self._baixa("forcada", chamadas, forcar=True)
        self.assertEqual(r["status"], "nova")
        self.assertEqual(len(chamadas), 1)
        self.assertEqual(base.resumo_orfas()["recapturadas"], 0)

    def test_releitura_depois_de_orfa_adiada_usa_vintage_legivel(self):
        """Review #286: consumidores que releem o silver depois do download (centroides da carga,
        _vigente das listadas) recebem a vintage anterior com bronze, não a órfã adiada."""
        from pipeline.energia.modulos import carga_detalhe, listadas
        from pipeline.energia.fontes import clima_carga as clima
        uf, (cod, _) = next(iter(clima.CAPITAIS.items()))
        rec = f"centroide_{cod}"
        corpo = json.dumps({"centroide": {"latitude": -10.0, "longitude": -50.0}}).encode()
        anterior = self.vintage(carga_detalhe.DS_IBGE_GEO, rec, corpo)
        orfa = self.vintage(carga_detalhe.DS_IBGE_GEO, rec, corpo + b" ", "2026-10-07T00:00:00Z")
        os.remove(base.caminho_bronze(orfa["arquivo"]))
        self.assertEqual(base.vintage_legivel(self.con, carga_detalhe.DS_IBGE_GEO, rec), anterior)
        with patch.object(clima, "parse_centroide", return_value=(-10.0, -50.0)):
            pontos = carga_detalhe.centroides(self.con)
        self.assertEqual(pontos[uf][4], anterior)
        self.assertEqual(listadas._vigente(self.con, carga_detalhe.DS_IBGE_GEO, rec), anterior)
        os.remove(base.caminho_bronze(anterior["arquivo"]))
        self.assertIsNone(base.vintage_legivel(self.con, carga_detalhe.DS_IBGE_GEO, rec))
        self.assertIsNone(listadas._vigente(self.con, carga_detalhe.DS_IBGE_GEO, rec))

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

    def test_evidencia_publica_a_copia_identica_que_existe(self):
        # 20/10/2026: a vintage da carga verificada apontava a captura de 06/10, que nenhum ambiente
        # tinha mais; o bronze restaurado trazia a recaptura de 16/10 com o mesmo sha256, e a
        # evidência p026_mmgd_mes publicava um caminho que não abre.
        from pipeline.energia import evidencia as ev
        anterior = self.vintage("ds", "rec")
        os.remove(base.caminho_bronze(anterior["arquivo"]))
        self.assertEqual(ev.fonte_de_vintage("ONS", "c", "u", anterior)["arquivo"], anterior["arquivo"])  # sem cópia: ausência visível
        copia, _ = base.salva_bronze("fonte", "ds", "rec", b"conteudo original", "json", "2026-10-16T01:41:37Z")
        self.assertNotEqual(copia, anterior["arquivo"])
        for item in (ev.fonte_de_vintage("ONS", "c", "u", anterior), ev.arquivo_de_vintage(anterior)):
            self.assertEqual(item["arquivo"], os.path.relpath(base.caminho_bronze(copia), self.raiz))
            self.assertTrue(os.path.isfile(os.path.join(self.raiz, item["arquivo"])))
            self.assertEqual((item["sha256"], item["capturado_em"]), (anterior["sha256"], anterior["capturado_em"]))
        # a conferência dos originais do módulo Dados acha a mesma cópia: a captura vigente não conta como ausente
        from pipeline.energia.fontes import silver_dados as sd
        from pipeline.energia import validacoes as val
        r = sd.confere_bronze([anterior])
        self.assertEqual((r["arquivos_presentes"], r["arquivos_ausentes"], r["ausentes_vigentes"], r["sha256_divergentes"]), (1, 0, 0, 0))
        # a captura anterior que a cópia durável não guarda é ressalva, dita como tal
        nova = self.vintage("ds", "rec", b"conteudo novo", "2026-10-18T00:00:00Z")
        os.remove(base.caminho_bronze(copia))
        r = sd.confere_bronze([anterior, nova])
        self.assertEqual((r["arquivos_presentes"], r["arquivos_ausentes"], r["ausentes_vigentes"]), (1, 1, 0))
        chk = next(x for x in val.valida_conjunto("f/ds", {"_vintages": [anterior, nova], "bronze": r}) if x["tipo"] == "original")
        self.assertEqual(chk["resultado"], "ressalva")
        self.assertIn("0 da captura vigente e 1 da anterior, que a cópia durável não guarda", chk["detalhe"])
        self.assertNotIn("só o silver", chk["detalhe"])
        # outro conteúdo na mesma pasta não serve
        outra = self.vintage("ds", "rec2", b"outro conteudo")
        os.remove(base.caminho_bronze(outra["arquivo"]))
        base.salva_bronze("fonte", "ds", "rec2", b"conteudo diferente", "json", "2026-10-16T01:41:37Z")
        self.assertEqual(ev.arquivo_de_vintage(outra)["arquivo"], outra["arquivo"])

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


class TestRestauracaoDeCacheParcial(unittest.TestCase):
    def test_workflow_completa_cache_parcial_sem_sobrescrever_bancos_recentes(self):
        import gzip
        from pathlib import Path
        import shutil
        import subprocess
        import tarfile
        from pipeline.energia import estado_bronze as estado
        raiz_codigo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            repo, assets, binarios = tmp / "repo", tmp / "release", tmp / "bin"
            assets.mkdir()
            binarios.mkdir()
            pacote = repo / "pipeline/energia"
            pacote.mkdir(parents=True)
            (repo / "pipeline/__init__.py").write_text("")
            (pacote / "__init__.py").write_text("")
            for arquivo in ("base.py", "estado_bronze.py"):
                shutil.copyfile(raiz_codigo / "pipeline/energia" / arquivo, pacote / arquivo)
            modulos = pacote / "modulos"
            modulos.mkdir()
            (modulos / "__init__.py").write_text(
                "from types import SimpleNamespace\n"
                "def descobrir():\n"
                "    return [SimpleNamespace(REGISTRO={'familia': f}) for f in ('ons_hidrologia', 'aneel_geracao')]\n")
            silver = repo / "data/energia/silver"
            bronze = repo / "data/energia/bronze"
            silver.mkdir(parents=True)
            with patch.multiple(base, RAIZ=str(repo), SILVER=str(silver), BRONZE=str(bronze)):
                con = base.conecta(str(silver / "ons_hidrologia.db"))
                arquivo, sha = base.salva_bronze("fonte", "ds", "rec", b"original", "json", "2026-10-01T00:00:00Z")
                base.registra_vintage(con, "ds", "rec", "https://fonte.test", "2026-10-01T00:00:00Z",
                                      None, sha, 8, "coleta_direta", arquivo)
                con.commit()
                con.close()
                man = estado.guardar(assets, limite=1024)
            # cada geração publica o manifesto com nome próprio; um anterior, que aponta para uma
            # parte já removida, fica na release e não pode ser o escolhido
            manifesto_publicado = "energia-bronze-manifesto-20261018T014500Z.json"
            (assets / estado.MANIFESTO).rename(assets / manifesto_publicado)
            (assets / "energia-bronze-manifesto-20261017T014500Z.json").write_text(json.dumps(
                {**man, "partes": [{"nome": "energia-bronze.parte-0000-removida", "bytes": 1, "sha256": "0" * 64}]}))
            bruto_original = (repo / arquivo).read_bytes()
            antigo = tmp / "aneel-antigo.db"
            antigo.write_bytes(b"familia antiga da release")
            with tarfile.open(assets / "energia-silver-familias.tar.gz", "w:gz") as tar:
                tar.add(silver / "ons_hidrologia.db", arcname="ons_hidrologia.db")
                tar.add(antigo, arcname="aneel_geracao.db")
            with gzip.open(assets / "energia-silver.db.gz", "wb") as f:
                f.write(b"principal antigo da release")
            # Simula energia-estado-previsao-*: principal recente e parte das famílias,
            # mas sem bronze e sem o silver hidrológico. Não pode voltar ao principal antigo.
            shutil.rmtree(bronze)
            (silver / "ons_hidrologia.db").unlink()
            (silver / "energia.db").write_bytes(b"principal recente do cache")
            (silver / "aneel_geracao.db").write_bytes(b"familia recente do cache")
            gh = binarios / "gh"
            gh.write_text('''#!/usr/bin/env python3
import os, pathlib, shutil, sys
args = sys.argv[1:]
assert args[:2] == ['release', 'download'], args
padrao = args[args.index('--pattern') + 1]
origens = sorted(pathlib.Path(os.environ['ENERGIA_FAKE_RELEASE']).glob(padrao))
if not origens:
    sys.exit(1)
destino = pathlib.Path(args[args.index('--dir') + 1])
destino.mkdir(parents=True, exist_ok=True)
for origem in origens:
    if (destino / origem.name).exists():
        sys.exit(1)
    shutil.copyfile(origem, destino / origem.name)
    with open(os.environ['ENERGIA_FAKE_LOG'], 'a') as f:
        f.write(origem.name + '\\n')
''')
            gh.chmod(0o755)
            texto = (raiz_codigo / ".github/workflows/atualizar-energia.yml").read_text()
            # silver e bronze em passos próprios (review #278): a falha do bronze não se
            # confunde com o silver restaurado; a sequência dos dois é o que o runner executa
            shells = []
            for passo in ("Completar estado durável (cache ausente ou parcial)", "Restaurar bronze vigente da cópia durável"):
                bloco = texto.split(f"      - name: {passo}\n", 1)[1].split("\n      - name:", 1)[0]
                cabecalho, corpo = bloco.split("        run: |\n", 1)
                self.assertFalse(any(l.startswith("        if:") for l in cabecalho.splitlines()),
                                 f"{passo}: cache encontrado também pode ser parcial")
                self.assertIn("        continue-on-error: true", cabecalho.splitlines(), passo)
                shells.append("\n".join(l[10:] if l.startswith("          ") else l for l in corpo.splitlines()))
            for trecho in ("estado_bronze restaurar", "estado_bronze necessario", "energia-bronze"):
                self.assertNotIn(trecho, shells[0], "o passo do silver não pode depender do bronze")
            shell = "\n".join(shells)
            shell = shell.replace("/tmp", str(tmp / "temporarios"))
            env = {**os.environ, "PATH": f"{binarios}:{os.environ['PATH']}", "PYTHONPATH": str(repo),
                   "GITHUB_REPOSITORY": "teste/energia", "GITHUB_OUTPUT": str(tmp / "outputs"),
                   "ENERGIA_FAKE_RELEASE": str(assets), "ENERGIA_FAKE_LOG": str(tmp / "downloads")}
            for rodada in (1, 2):
                if rodada == 2:
                    shutil.rmtree(tmp / "temporarios")  # runner novo, cache agora completo
                p = subprocess.run(["bash", "-eo", "pipefail", "-c", shell], cwd=repo, env=env,
                                   text=True, capture_output=True, timeout=30)
                self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
                self.assertEqual((silver / "energia.db").read_bytes(), b"principal recente do cache")
                self.assertEqual((silver / "aneel_geracao.db").read_bytes(), b"familia recente do cache")
                self.assertTrue((silver / "ons_hidrologia.db").is_file())
                self.assertEqual((repo / arquivo).read_bytes(), bruto_original)
                downloads = (tmp / "downloads").read_text().splitlines()
                # Segunda passagem baixa só o manifesto; arquivos já recuperados não
                # fazem baixar novamente bancos ou partes grandes.
                self.assertEqual(downloads.count("energia-silver-familias.tar.gz"), 1)
                self.assertEqual(downloads.count(manifesto_publicado), rodada)
                for parte in man["partes"]:
                    self.assertEqual(downloads.count(parte["nome"]), 1)


class TestCopiaDuravelNoWorkflow(unittest.TestCase):
    """Review #278: a cópia do silver não pode depender do bronze, e partes publicadas
    não são substituídas (o manifesto vigente continua utilizável durante o upload)."""

    def passos(self):
        """Passos do job em ordem, lidos do texto (sem PyYAML, ausente no CI)."""
        from pathlib import Path
        texto = (Path(__file__).resolve().parents[2] / ".github/workflows/atualizar-energia.yml").read_text()
        out = []
        for bloco in texto.split("\n      - name: ")[1:]:
            nome, resto = bloco.split("\n", 1)
            cabecalho, _, corpo = resto.partition("        run: |\n")
            passo = {"name": nome.strip(), "run": corpo}
            for linha in cabecalho.splitlines():
                chave, sep, valor = linha.strip().partition(": ")
                if sep and linha.startswith("        ") and not linha.startswith("         "):
                    passo[chave] = valor
            passo["continue-on-error"] = passo.get("continue-on-error") == "true"
            out.append(passo)
        return out

    def test_silver_sobe_antes_e_em_passo_sem_bronze(self):
        passos = self.passos()
        nomes = [p.get("name") for p in passos]
        i_silver = nomes.index("Cópia durável do silver (release energia-estado)")
        i_bronze = nomes.index("Cópia durável do bronze vigente (release energia-estado)")
        self.assertLess(i_silver, i_bronze)
        silver, bronze = passos[i_silver], passos[i_bronze]
        self.assertNotIn("estado_bronze", silver["run"])
        self.assertIn("energia-silver.db.gz", silver["run"])
        self.assertIn("estado_bronze guardar", bronze["run"])
        self.assertTrue(silver.get("continue-on-error") and bronze.get("continue-on-error"))
        alerta = next(p for p in passos if p.get("if") == "steps.bronze_duravel.outcome == 'failure'")
        self.assertIn("gh issue", alerta["run"])

    def test_partes_nao_sao_substituidas_nem_reenviadas(self):
        bronze = next(p for p in self.passos() if p.get("id") == "bronze_duravel")["run"]
        linha_upload = next(l for l in bronze.splitlines() if 'gh release upload energia-estado "$parte"' in l)
        self.assertNotIn("--clobber", linha_upload)
        self.assertIn('select(.state == "uploaded")', bronze)
        upload_manifesto = next(l for l in bronze.splitlines() if 'gh release upload energia-estado "/tmp/energia-bronze-duravel/$MANIFESTO_NOVO"' in l)
        self.assertNotIn("--clobber", upload_manifesto, "o gh apaga o asset antes de subir o substituto")
        self.assertIn('MANIFESTO_NOVO="energia-bronze-manifesto-$(date -u', bronze)
        self.assertLess(bronze.index("energia-bronze.parte-*"), bronze.index(upload_manifesto))
        self.assertLess(bronze.index(upload_manifesto), bronze.index("gh release delete-asset"))

    def test_falha_na_restauracao_do_bronze_abre_alerta(self):
        passos = self.passos()
        restauracao = next(p for p in passos if p.get("id") == "bronze")
        self.assertTrue(restauracao.get("continue-on-error"))
        self.assertIn("estado_bronze restaurar", restauracao["run"])
        alerta = next(p for p in passos if p.get("if") == "steps.bronze.outcome == 'failure'")
        self.assertIn("::warning::", alerta["run"])
        self.assertIn("gh issue", alerta["run"])
