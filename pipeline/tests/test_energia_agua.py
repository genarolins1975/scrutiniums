"""Módulo Água e clima (detalhe): leitores, conferências e cálculos da gold agua_detalhe.json.

Sem rede. As amostras em pipeline/tests/dados/energia_agua/ são recortes reais:
- ONS, EAR por reservatório de 01/09/2026 (Parquet oficial relido em CSV com as colunas
  originais) e de 25 e 26/10/2019 (entrada de Sinop); EAR e ENA por subsistema, por bacia e
  por REE (linhas originais dos CSV de 2026 e de 2019); ENA por reservatório de 01/09/2026;
- ONS, dados hidráulicos diários de agosto e setembro de 2025 de Furnas, Ilha Solteira,
  Três Irmãos, Pedra do Cavalo e Sobradinho e as linhas do cadastro de reservatórios;
- ONS, texto extraído pelo pdftotext da tabela "MLT das ENAs (MWmed)" dos Relatórios
  Executivos do PMO das semanas de 17 a 23/01/2026 e de 19 a 25/09/2026;
- ONS, carga verificada por área geoelétrica em 10/08/2026 (48 meias horas por área);
- ONS, contorno da bacia do Capivari (shapefile das bacias do SIN);
- ONS, precipitação diária observada em três estações em janeiro de 2021;
- NASA POWER, recortes de uma célula de temperatura e de um ponto de precipitação;
- IBGE, população do Censo 2022 (SIDRA 4709) e sedes municipais (Localidades 2022).
Os valores esperados foram calculados por outro caminho (awk sobre os arquivos originais)
e estão escritos nos testes.
"""
import csv
import gzip
import hashlib
import io
import json
import math
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base, evidencia, metricas  # noqa: E402
from pipeline.energia.fontes import clima_agua as cl  # noqa: E402
from pipeline.energia.fontes import ons as ons_sm  # noqa: E402
from pipeline.energia.fontes import ons_agua as oa  # noqa: E402
from pipeline.energia.modulos import agua_detalhe as m  # noqa: E402

DADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados", "energia_agua")


def _texto(nome):
    op = gzip.open if nome.endswith(".gz") else open
    with op(os.path.join(DADOS, nome), "rt", encoding="utf-8-sig", newline="") as f:
        return f.read()


def _linhas(nome):
    return list(csv.DictReader(io.StringIO(_texto(nome)), delimiter=";"))


def _caminho(nome):
    return os.path.join(DADOS, nome)


class TestLeitores(unittest.TestCase):
    def test_numero_distingue_zero_ausencia_e_invalido(self):
        self.assertEqual(oa.num("0E-8"), 0.0)          # zero publicado em notação científica
        self.assertIsNone(oa.num(""))                   # ausência
        self.assertIsNone(oa.num("NaN"))
        self.assertIsNone(oa.num(float("nan")))
        self.assertIsNone(oa.num("abc"))
        self.assertEqual(oa.num("1,5"), 1.5)
        self.assertEqual(oa.num("264.00000000"), 264.0)
        self.assertEqual(oa.num(-0.909), -0.909)        # evaporação líquida admite negativo

    def test_codigo_aceita_int_double_e_texto(self):
        # Parquet de 2000 traz int32, o de 2025 traz double (154.0), o CSV traz texto
        self.assertEqual(oa.codigo(154.0), "154")
        self.assertEqual(oa.codigo(18), "18")
        self.assertEqual(oa.codigo("227"), "227")
        self.assertIsNone(oa.codigo(None))

    def test_nome_aparado(self):
        self.assertEqual(oa.nome("JEQUITINHONHA  "), "JEQUITINHONHA")
        self.assertEqual(oa.nome(" paraiba  do sul "), "PARAIBA DO SUL")

    def test_cabecalho_fora_do_dicionario_do_ree(self):
        # o arquivo de ENA por REE usa nom_reservatorioee; o dicionário diz nom_ree
        linhas = _linhas("ena_ree_2026_trecho.csv")
        self.assertIn("nom_reservatorioee", linhas[0])
        obs = {(s, r): v for s, r, v in oa.parse_ena_agregado(linhas, "ree") if v is not None}
        self.assertAlmostEqual(obs[("ena_bruta_mwmed.TELES PIRES", "2026-09-01")],
                               float(next(x for x in linhas if x["nom_reservatorioee"] == "TELES PIRES")["ena_bruta_ree_mwmed"]))
        # armazenável fica só no bronze
        self.assertFalse(any(s.startswith("ena_arm") for s, _r in obs))

    def test_ree_sem_armazenamento_tem_zero_publicado(self):
        linhas = _linhas("ear_ree_2026_trecho.csv")
        obs = {(s, r): v for s, r, v in oa.parse_ear_agregado(linhas, "ree")}
        # ITAIPU: EAR máxima zero publicada ("0E-8"), não ausência
        self.assertEqual(obs[("ear_max_mwmes.ITAIPU", "2026-09-01")], 0.0)

    def test_recursos_anuais_preferem_parquet_e_caem_no_csv(self):
        pac = {"resources": [
            {"url": "https://x/ENA_DIARIO_RESERVATORIOS_2020.csv", "format": "CSV"},
            {"url": "https://x/ENA_DIARIO_RESERVATORIOS_2021.csv", "format": "CSV"},
            {"url": "https://x/ENA_DIARIO_RESERVATORIOS_2021.parquet", "format": "PARQUET"},
            {"url": "https://x/DicionarioDados_EnaPorReservatorio.pdf", "format": "PDF"},
        ]}
        r = oa.recursos_anuais(pac, "ENA_DIARIO_RESERVATORIOS_")
        self.assertEqual(r[2020]["format"], "CSV")
        self.assertEqual(r[2021]["format"], "PARQUET")
        self.assertEqual(sorted(r), [2020, 2021])


class TestArmazenamento(unittest.TestCase):
    """P017: o agregado do SIN e a reconciliação por outros produtos do ONS."""

    def test_reservatorios_reproduzem_subsistemas(self):
        # Esperado: arquivo EAR por subsistema de 01/09/2026 (outro produto do ONS)
        esperado = {"SE": (118189.498, 204615.328), "S": (17315.332, 20459.242),
                    "NE": (39115.179, 51691.226), "N": (12414.718, 15302.396)}
        sub = {oa.nome(r["id_subsistema"]): (float(r["ear_verif_subsistema_mwmes"]), float(r["ear_max_subsistema"]))
               for r in _linhas("ear_subsistema_2026_trecho.csv")}
        self.assertEqual(sub, esperado)
        res = oa.parse_ear_reservatorio(_linhas("ear_reservatorios_20260901.csv.gz"), "2024-01-01")
        for sm, (e, mx) in esperado.items():
            soma_e, soma_m = res["soma"][(sm, "2026-09-01")]
            # três casas decimais em ~100 parcelas: 0,005 MWmês de folga
            self.assertAlmostEqual(soma_e, e, delta=0.005, msg=sm)
            self.assertAlmostEqual(soma_m, mx, delta=0.005, msg=sm)

    def test_bacias_e_ree_somam_o_sin(self):
        bac = _linhas("ear_bacias_2026_trecho.csv")
        ree = _linhas("ear_ree_2026_trecho.csv")
        sb = sum(float(r["ear_verif_bacia_mwmes"]) for r in bac)
        sr = sum(float(r["ear_verif_ree_mwmes"]) for r in ree)
        self.assertEqual(len(bac), 23)
        self.assertEqual(len(ree), 12)
        self.assertAlmostEqual(sb, 187034.726, places=3)
        self.assertAlmostEqual(sr, 187034.726, places=3)
        self.assertAlmostEqual(sb, 118189.498 + 17315.332 + 39115.179 + 12414.718, delta=0.005)

    def test_ear_total_por_bacia_reproduz_o_arquivo_por_bacia(self):
        por = {}
        for r in _linhas("ear_reservatorios_20260901.csv.gz"):
            v = oa.num(r["ear_total_mwmes"])
            if v is not None:
                por[oa.nome(r["nom_bacia"])] = por.get(oa.nome(r["nom_bacia"]), 0.0) + v
        arq = {oa.nome(r["nomecurto"]): float(r["ear_verif_bacia_mwmes"]) for r in _linhas("ear_bacias_2026_trecho.csv")}
        self.assertEqual(len(por), 18)
        for b, v in por.items():
            self.assertAlmostEqual(v, arq[b], delta=0.005, msg=b)

    def test_sin_e_razao_de_somas_nao_media_de_percentuais(self):
        linhas = _linhas("ear_subsistema_2026_trecho.csv")
        mw = sum(float(r["ear_verif_subsistema_mwmes"]) for r in linhas)
        mx = sum(float(r["ear_max_subsistema"]) for r in linhas)
        sin = 100.0 * mw / mx
        self.assertAlmostEqual(sin, 64.038034, places=5)          # awk: 187034.727 ÷ 292068.192
        media = sum(float(r["ear_verif_subsistema_percentual"]) for r in linhas) / 4
        self.assertAlmostEqual(media, 74.7988, places=4)
        self.assertGreater(media - sin, 10.0)                      # a média simples erraria em 10,8 p.p.

    def test_entrada_de_sinop_atribuida_ao_evento_de_capacidade(self):
        """A EAR máxima do Sudeste subiu 875,141 MWmês de 25 para 26/10/2019 (arquivo por
        subsistema); o arquivo por reservatório mostra Sinop entrando com 875,144."""
        sub = {}
        for r in _linhas("ear_subsistema_2019_trecho.csv"):
            sub.setdefault(oa.nome(r["id_subsistema"]), {})[r["ear_data"]] = float(r["ear_max_subsistema"])
        self.assertAlmostEqual(sub["SE"]["2019-10-26"] - sub["SE"]["2019-10-25"], 875.140625, places=6)
        con = base.conecta(":memory:")
        tmp = tempfile.mkdtemp()
        try:
            arq = os.path.join(tmp, "EAR_DIARIO_RESERVATORIOS_2019.csv.gz")
            shutil.copy(_caminho("ear_reservatorios_20191025_26.csv.gz"), arq)
            with open(arq, "rb") as f:
                sha = hashlib.sha256(f.read()).hexdigest()
            base.registra_vintage(con, m.DS_EAR_RES, "EAR_DIARIO_RESERVATORIOS_2019", "teste", "2026-09-30T23:00:00Z",
                                  None, sha, 1, "teste", arq)
            v = base.ultima_vintage(con, m.DS_EAR_RES, "EAR_DIARIO_RESERVATORIOS_2019")
            self.assertIsNotNone(m._importa_ons(con, "ear_res", m.DS_EAR_RES, 2019, v))
            self.assertIsNone(m._importa_ons(con, "ear_res", m.DS_EAR_RES, 2019, v))   # uma vez por vintage
            eventos = m._eventos_capacidade(con, None, sub)
        finally:
            shutil.rmtree(tmp)
        self.assertEqual([(e["data"], e["sm"]) for e in eventos], [("2019-10-26", "SE")])
        e = eventos[0]
        self.assertEqual([(x["nome"], x["tipo"], x["parte"]) for x in e["reservatorios"]], [("SINOP", "entrada", "proprio")])
        self.assertAlmostEqual(e["reservatorios"][0]["variacao_mwmes"], 875.144, places=3)
        self.assertLessEqual(abs(e["residuo_mwmes"]), 0.05)


class TestAfluencia(unittest.TestCase):
    """P018: unidade das colunas _mwmed, MLT implícita e versão da MLT."""

    def _subsistema(self):
        out = {}
        for r in _linhas("ena_subsistema_2026_trecho.csv"):
            out[(oa.nome(r["id_subsistema"]), r["ena_data"])] = (float(r["ena_bruta_regiao_mwmed"]),
                                                                  float(r["ena_bruta_regiao_percentualmlt"]))
        return out

    def test_soma_das_usinas_em_mwmed_reproduz_o_subsistema(self):
        obs = oa.parse_ena_reservatorio(_linhas("ena_reservatorios_20260901.csv.gz"))
        soma = {s.split(".")[1]: v for s, r, v in obs if s.startswith("soma_ena_bruta_mwmed.") and r == "2026-09-01"}
        # awk sobre o arquivo por reservatório (coluna 8, MWmed segundo o dicionário)
        self.assertAlmostEqual(soma["S"], 37964.067, places=3)
        self.assertAlmostEqual(soma["SE"], 18155.524, places=3)
        sub = self._subsistema()
        for sm in ("SE", "S", "NE", "N"):
            e = sub[(sm, "2026-09-01")][0]
            rel = abs(soma[sm] - e) / e
            self.assertLess(rel, 0.001, sm)
            # se uma coluna estivesse em MWmês e a outra em MWmed, a razão seria de 28 a 31
            self.assertTrue(0.9 < soma[sm] / e < 1.1)

    def test_soma_das_mlt_por_usina_e_a_mlt_implicita(self):
        obs = oa.parse_ena_reservatorio(_linhas("ena_reservatorios_20260901.csv.gz"))
        smlt = {s.split(".")[1]: v for s, r, v in obs if s.startswith("soma_mlt_mwmed.") and r == "2026-09-01"}
        sub = self._subsistema()
        esperado = {"S": 11677.3529, "NE": 2922.6686, "N": 2260.2033, "SE": 19674.2404}   # awk: ENA ÷ % × 100
        for sm, mlt in esperado.items():
            e, p = sub[(sm, "2026-09-01")]
            self.assertAlmostEqual(e / (p / 100.0), mlt, places=3)
            self.assertLess(abs(smlt[sm] / mlt - 1), 0.0005, sm)

    def test_mlt_em_degraus_registra_so_mudancas(self):
        linhas = [{"cod_resplanejamento": "6", "ena_data": d, "id_subsistema": "SE", "ena_bruta_res_mwmed": "100",
                   "mlt_ena": v} for d, v in (("2026-01-18", "1391.043"), ("2026-01-19", "1391.043"),
                                              ("2026-01-20", "1398.36"), ("2026-01-21", "1398.36"))]
        degraus = [(r, v) for s, r, v in oa.parse_ena_reservatorio(linhas) if s == "mlt_mwmed.6"]
        self.assertEqual(degraus, [("2026-01-18", 1391.043), ("2026-01-20", 1398.36)])

    def test_tabela_do_pmo_extraida(self):
        t = oa.parse_mlt_pmo(_texto("pmo_17_01_2026_trecho.txt"))
        self.assertEqual(t["edicao"], {"mes": "janeiro", "ano": 2026, "semana": "17/01 a 23/01/2026"})
        v = {(ref, sm): x for ref, sm, x in t["valores"]}
        self.assertEqual(v[("2026-01", "SE")], 65813.0)     # "65.813": ponto de milhar
        self.assertEqual(v[("2026-02", "N")], 22743.0)
        t2 = oa.parse_mlt_pmo(_texto("pmo_19_09_2026_trecho.txt"))
        v2 = {(ref, sm): x for ref, sm, x in t2["valores"]}
        self.assertEqual(v2[("2026-09", "SE")], 19564.0)
        self.assertEqual(v2[("2026-10", "S")], 13727.0)

    def test_tabela_incompleta_do_pmo_e_descartada(self):
        texto = _texto("pmo_17_01_2026_trecho.txt")
        cortado = "\n".join(ln for ln in texto.split("\n") if not ln.strip().startswith("NE "))
        self.assertIsNone(oa.parse_mlt_pmo(cortado))

    def test_mlt_do_conjunto_coincide_com_pmo_ate_19_01_e_diverge_depois(self):
        pmo = {(ref, sm): x for ref, sm, x in oa.parse_mlt_pmo(_texto("pmo_17_01_2026_trecho.txt"))["valores"]}
        sub = self._subsistema()
        for sm in ("SE", "S", "NE", "N"):
            e, p = sub[(sm, "2026-01-15")]
            self.assertLess(abs(e / (p / 100.0) / pmo[("2026-01", sm)] - 1), 0.0005, sm)   # ≤ 0,05%
        e, p = sub[("SE", "2026-01-25")]
        self.assertAlmostEqual(e / (p / 100.0), 66121.2441, places=3)
        self.assertGreater(abs(e / (p / 100.0) / 65813.0 - 1), 0.004)                    # 0,47%
        e, p = sub[("SE", "2026-09-01")]
        pmo9 = {(ref, sm): x for ref, sm, x in oa.parse_mlt_pmo(_texto("pmo_19_09_2026_trecho.txt"))["valores"]}
        self.assertAlmostEqual(100 * (e / (p / 100.0) / pmo9[("2026-09", "SE")] - 1), 0.564, places=2)

    def test_janela_de_30_dias_e_razao_de_somas(self):
        # dias com MLT muito diferentes: a média dos percentuais engana
        s = {"mw": {}, "mlt": {}}
        for i in range(30):
            d = f"2026-03-{i + 1:02d}"
            s["mw"][d], s["mlt"][d] = (1000.0, 500.0) if i < 15 else (100.0, 1000.0)
        v, num, den = m._ena_janela(s, "2026-03-30")
        self.assertAlmostEqual(v, 100.0 * (15 * 1000 + 15 * 100) / (15 * 500 + 15 * 1000))
        self.assertAlmostEqual(num, 16500.0)
        media = (15 * 200.0 + 15 * 10.0) / 30
        self.assertNotAlmostEqual(v, media, places=0)
        del s["mw"]["2026-03-10"]
        self.assertEqual(m._ena_janela(s, "2026-03-30"), (None, None, None))     # janela incompleta


class TestReservatorios(unittest.TestCase):
    """P020: balanço em hm³ com resíduo explícito."""

    @classmethod
    def setUpClass(cls):
        cls.cad = {r["nom_reservatorio"]: r for r in _linhas("cadastro_trecho.csv")}
        cls.q = {}
        obs, cls.atrib = oa.parse_dados_hidrologicos(_linhas("hidro_2025_trecho.csv.gz"))
        for s, ref, v in obs:
            if v is None:
                continue
            campo, rid = s.split(".", 1)
            cls.q.setdefault(rid, {}).setdefault(campo, {})[ref] = v
        cls.ids = {at["nome"]: rid for rid, at in cls.atrib.items()}

    def _b(self, nome):
        vut = float(self.cad[nome]["val_volutiltot"])
        return m.balanco_reservatorio(self.q[self.ids[nome]], vut, "2025-09-30")

    def test_furnas_fecha_por_construcao(self):
        b = self._b("FURNAS")
        # awk: ΔV = (V%(30/09) − V%(31/08)) ÷ 100 × 17217 = −2052,2664; Σ(afl − defl) × 0,0864 = −2053,2018
        self.assertAlmostEqual(b["dv_obs"], -2052.2664, places=3)
        self.assertAlmostEqual(b["comp"]["q_afluente"] - b["comp"]["q_defluente"], -2053.2018, places=3)
        self.assertAlmostEqual(b["residuo"], 0.9354, places=3)
        # resíduo dentro do arredondamento do percentual (0,01% de 17217 hm³ + 0,002) em 59 de 60
        # dias; o de 25/08/2025 (32,6273 hm³) é dado da fonte e fica publicado, sem ajuste
        self.assertAlmostEqual(b["tolerancia"], 1.7237, places=4)
        self.assertEqual(b["n_res"], 60)
        self.assertEqual(b["dentro_tol"], 59)
        fora = {k: r for k, (dv, r) in b["residuos"].items() if abs(r) > b["tolerancia"]}
        self.assertEqual(list(fora), ["2025-08-25"])
        self.assertAlmostEqual(fora["2025-08-25"], 32.6273, places=3)

    def test_canal_pereira_barreto_fecha_com_a_transferencia(self):
        solteira, irmaos = self._b("I. SOLTEIRA"), self._b("TRÊS IRMÃOS")
        # awk: resíduo −148,6514 e +148,1367; transferência +148,3488 e −148,3488 hm³
        self.assertAlmostEqual(solteira["residuo"], -148.6514, places=3)
        self.assertAlmostEqual(irmaos["residuo"], 148.1367, places=3)
        self.assertAlmostEqual(solteira["comp"]["q_transferida"], -irmaos["comp"]["q_transferida"], places=6)
        self.assertLess(abs(solteira["residuo_t"]), 0.6)
        self.assertLess(abs(irmaos["residuo_t"]), 0.6)

    def test_residuo_que_nao_fecha_fica_visivel(self):
        sob = self._b("SOBRADINHO")
        self.assertAlmostEqual(sob["residuo"], -32.2618, places=3)    # awk; nenhum ajuste
        self.assertLess(sob["dentro_tol"], sob["n_res"])
        pc = self._b("PEDRA DO CAVALO")
        self.assertAlmostEqual(pc["residuo"], -62.5152, places=3)
        self.assertAlmostEqual(pc["residuo_t"], -62.5152 + 33.6960, places=3)

    def test_dia_ausente_impede_o_balanco_sem_preencher(self):
        x = {k: dict(v) for k, v in self.q[self.ids["FURNAS"]].items()}
        del x["q_afluente"]["2025-09-15"]
        b = m.balanco_reservatorio(x, 17217.0, "2025-09-30")
        self.assertFalse(b["balanco_ok"])
        self.assertIsNone(b["residuo"])
        self.assertIsNone(b["comp"]["q_afluente"])
        self.assertEqual(b["comp"]["n_q_afluente"], 29)

    def test_sem_volume_util_sem_balanco(self):
        b = m.balanco_reservatorio(self.q[self.ids["FURNAS"]], None, "2025-09-30")
        self.assertFalse(b["tem_vol"])
        self.assertIsNone(b["dv_obs"])
        self.assertIsNone(b["residuo"])

    def test_cadastro_repete_itaipu_sem_somar(self):
        regs, dup = oa.parse_cadastro(_linhas("cadastro_trecho.csv"))
        self.assertEqual(dup, {"66": 2})
        vol = [v for ch, campo, v in regs if ch == "66" and campo == "val_volutiltot"]
        self.assertEqual(set(vol), {"19000.000"})


class TestClima(unittest.TestCase):
    """P019: fonte, agregação espacial e ausência."""

    def test_power_marca_ausencia_e_nao_vira_zero(self):
        d, h, msgs = cl.le_power(_texto("power_t2m_sao_paulo_trecho.json"))
        self.assertIsNone(d["T2M"]["2026-09-30"])
        self.assertEqual(d["T2M"]["2026-09-27"], 20.34)
        self.assertEqual(h["fill_value"], -999.0)
        p, _h, _m = cl.le_power(_texto("power_imerg_trecho.json"))
        dias = p["IMERG_PRECTOT"]
        self.assertEqual(dias["2026-09-14"], 0.01)
        self.assertIsNone(dias["2026-09-15"])
        self.assertEqual(sum(1 for v in dias.values() if v is None), 16)

    def test_power_sem_dados_lanca(self):
        with self.assertRaises(ValueError):
            cl.le_power(json.dumps({"messages": ["limite"], "header": {}}))

    def test_bacia_pequena_adensa_ate_a_resolucao_do_imerg(self):
        b = json.loads(_texto("bacia_capivari.json"))
        passo, pts = cl.pontos_grade({"bbox": b["bbox"], "aneis": b["aneis"]})
        # 1°: nenhum ponto; 0,5° e 0,25°: um; 0,1°: 13
        self.assertEqual(passo, 0.1)
        self.assertEqual(len(pts), 13)
        self.assertTrue(all(cl.dentro(p["lon"], p["lat"], b["aneis"]) for p in pts))
        for p in pts:
            self.assertAlmostEqual(p["peso"], math.cos(math.radians(p["lat"])) * 0.01, places=12)
        self.assertFalse(cl.dentro(-40.0, -10.0, b["aneis"]))

    def test_media_ponderada_ignora_ausencia(self):
        self.assertEqual(cl.media_ponderada([(10.0, 1.0), (20.0, 3.0)]), 17.5)
        self.assertIsNone(cl.media_ponderada([]))

    def test_mapeamento_uf_subsistema_fecha_a_carga_do_ons(self):
        """A soma das áreas geoelétricas de cada subsistema (mais as perdas) reproduz a carga
        verificada do subsistema em 10/08/2026 (awk sobre as 48 meias horas)."""
        por = {}
        for r in _linhas("carga_areas_20260810.csv.gz"):
            por.setdefault(r["cod_areacarga"], []).append(float(r["val_cargaglobal"]))
        media = {a: sum(v) / len(v) for a, v in por.items()}
        self.assertEqual(len(media), 34)
        self.assertTrue(all(len(v) == 48 for v in por.values()))
        self.assertAlmostEqual(media["SECO"], 46773.94756, places=3)
        for sm, areas in cl.AREAS_CARGA.items():
            total = media[cl.COD_AREA_SUBSISTEMA[sm]]
            soma = sum(media[a] for a in areas)
            self.assertLess(abs(soma / total - 1), 0.001, sm)     # NE: 7,8 MWmed em 14.641 (0,05%)
        # cada UF do mapeamento aparece numa área do mesmo subsistema
        area_de_uf = {"BA": "BASE", "SE": "BASE", "AL": "ALPE", "PE": "ALPE", "PB": "PBRN", "RN": "PBRN", "TO": "TON"}
        for uf, sm in cl.UF_SUBSISTEMA.items():
            self.assertIn(area_de_uf.get(uf, uf), cl.AREAS_CARGA[sm], uf)
        self.assertEqual(len(cl.UF_SUBSISTEMA), 27)

    def test_celulas_merra_e_selecao_pela_populacao(self):
        self.assertEqual(cl.celula_merra(-23.5548, -46.579), (-23.5, -46.875))
        self.assertEqual(cl.celula_merra(-15.7843, -47.9081), (-16.0, -48.125))
        sedes = {r["CD_MUN"]: (r["SIGLA_UF"], r["NM_MUN"], float(r["LAT"]), float(r["LON"])) for r in _linhas("sedes_trecho.csv")}
        pop_mun = cl.populacao_sidra(_texto("sidra_4709_municipios_trecho.json").encode())
        pop_uf_cod = cl.populacao_sidra(_texto("sidra_4709_ufs_trecho.json").encode())
        self.assertEqual(pop_mun["3550308"], 11451999)          # São Paulo, Censo 2022
        self.assertEqual(pop_uf_cod["35"], 44411238)
        escolha, cob = cl.seleciona_celulas(sedes, pop_mun, {"SP": pop_uf_cod["35"], "DF": pop_uf_cod["53"], "RJ": pop_uf_cod["33"]})
        # SP: as quatro sedes da amostra caem em quatro células diferentes e, juntas, não cobrem
        # metade do estado (14,3 de 44,4 milhões): todas entram, da mais populosa para a menos
        self.assertEqual(len(escolha["SP"]), 4)
        self.assertEqual(escolha["SP"][0]["pop"], pop_mun["3550308"])
        self.assertLess(cob["SP"], 0.5)
        self.assertEqual(escolha["DF"][0]["pop"], pop_mun["5300108"])

    def test_precipitacao_de_estacao_so_com_mes_completo(self):
        loc = lambda lat, lon: "TESTE"  # noqa: E731
        obs, resumo = oa.parse_precipitacao_estacoes(_linhas("precipitacao_estacoes_202101_trecho.csv"), loc)
        v = {s: x for s, r, x in obs if r == "2021-01"}
        # awk: 82042 soma 145,0 mm e 82193 soma 205,0 mm (31 dias); 82024 tem 30 dias e fica fora
        self.assertEqual(v["n_estacoes.TESTE"], 2.0)
        self.assertAlmostEqual(v["precip_estacoes_mm_mes.TESTE"], (145.0 + 205.0) / 2)
        self.assertEqual(resumo, {"estacoes": 3, "estacoes_em_bacia": 3})

    def test_correspondencia_de_poligonos_com_bacias_do_ons(self):
        self.assertEqual(cl.BACIA_ONS["MADEIRA"], "AMAZONAS")
        self.assertEqual(cl.BACIA_ONS["ANTAS"], "JACUI")
        self.assertEqual(len(cl.BACIA_ONS), 31)
        self.assertNotIn("SANTA MARIA VIT", set(cl.BACIA_ONS.values()))


class TestRegrasEGold(unittest.TestCase):
    def test_metricas_do_modulo_validas(self):
        from pipeline.energia.metricas import agua as ma
        ids = [x["id"] for x in ma.METRICAS]
        self.assertEqual(len(ids), len(set(ids)))
        for x in ma.METRICAS:
            self.assertEqual(metricas.validar(x), [], x["id"])
            self.assertTrue(x["id"].startswith("agua_"))

    def test_bandas_usam_anos_anteriores_e_tratam_29_de_fevereiro(self):
        serie = {f"{a}-02-28": float(a - 2000) for a in range(2001, 2026)}
        serie["2024-02-29"] = 999.0
        p10, p50, p90, n, vs = m._bandas_do_dia(serie, "2024-02-29", 2001)
        self.assertEqual(n, 23)                       # 2001 a 2023; o próprio 2024 fica fora
        self.assertNotIn(999.0, vs)
        self.assertEqual(p50, 12.0)

    def test_validacao_rejeita_ear_negativa(self):
        d = {"armazenamento": {"subsistemas": [{"sm": "SE", "ear_mwmes": -1.0, "ear_max_mwmes": 10.0, "ear_pct": -10.0}],
                               "bacias": [], "ree": []},
             "dia_ear": "2026-09-28", "dia_ena": "2026-09-28",
             "reconciliacao_ear": {"pct_publicado_vs_recalculado_max_pp": 0.0, "reservatorios_por_subsistema": [],
                                   "sin_mesma_captura_mwmes": None, "sin_mwmes": 1.0, "soma_bacias_mwmes": None,
                                   "reservatorios_por_ano": []},
             "afluencia": {"subsistemas": []}}
        probs = m._valida(d)
        self.assertTrue(any(x.startswith("CRÍTICO: EAR inválida") for x in probs))


GOLD = os.path.join(base.GOLD, m.GOLD)


@unittest.skipUnless(os.path.exists(GOLD), "gold agua_detalhe.json ainda não gerada")
class TestGoldPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(GOLD, encoding="utf-8") as f:
            cls.g = json.load(f)
        if not cls.g.get("disponivel"):
            raise unittest.SkipTest("gold indisponível")

    def test_sin_e_razao_de_somas_dos_subsistemas_publicados(self):
        subs = {s["sm"]: s for s in self.g["armazenamento"]["subsistemas"]}
        mw = sum(subs[sm]["ear_mwmes"] for sm in ("SE", "S", "NE", "N"))
        mx = sum(subs[sm]["ear_max_mwmes"] for sm in ("SE", "S", "NE", "N"))
        self.assertAlmostEqual(subs["SIN"]["ear_mwmes"], mw, delta=0.25)       # 4 parcelas arredondadas a 0,1
        self.assertAlmostEqual(subs["SIN"]["ear_pct"], 100 * mw / mx, delta=0.01)

    def test_evidencias_comprovam(self):
        self.assertGreaterEqual(len(self.g["evidencias"]), 6)
        for k, e in self.g["evidencias"].items():
            self.assertEqual(evidencia.validar(e), [], k)

    def test_csv_de_temperatura_equivale_a_gold(self):
        caminho = os.path.join(base.SERIES, "clima_diario.csv")
        t = next(x for x in self.g["clima"]["temperatura"] if x["recorte"] == "SIN")
        with open(caminho, encoding="utf-8") as f:
            linhas = {r["data"]: float(r["temp_media_c"]) for r in csv.DictReader(f, delimiter=";") if r["recorte"] == "SIN"}
        dias = sorted(k for k in linhas if k <= t["dia"])[-30:]
        self.assertEqual(dias[-1], t["dia"])
        self.assertAlmostEqual(sum(linhas[k] for k in dias) / 30, t["media_30d_c"], delta=0.006)

    def test_decomposicao_da_ear_fecha_com_o_subsistema(self):
        for x in self.g["reservatorios"]["decomposicao_ear"]:
            self.assertLessEqual(abs(x["residuo_mwmes"]), 0.05, x["sm"])

    def test_tamanho_e_nenhum_nan(self):
        self.assertLess(os.path.getsize(GOLD), 450 * 1024)
        with open(GOLD, encoding="utf-8") as f:
            texto = f.read()
        self.assertNotIn("NaN", texto)
        self.assertNotIn("Infinity", texto)


if __name__ == "__main__":
    unittest.main()
