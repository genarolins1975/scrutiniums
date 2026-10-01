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
- IBGE, população do Censo 2022 (SIDRA 4709) e sedes municipais (Localidades 2022);
- ONS, EAR por REE de 26/12/2017 a 02/01/2018 (reconfiguração dos REE) e de 28/09 de 2016 a
  2026 (PARANA, SUDESTE, ITAIPU); EAR por bacia de ARAGUARI (EAR máxima zero); EAR por
  subsistema de 28/09 de 2001 a 2026 (SE e S), baixada de novo do S3 em 01/10/2026;
- ONS, dados hidráulicos de 2026 de Sobradinho (janela de 31/08 a 29/09), Marimbondo,
  Jirau e Pimental (convenção da defluência);
- ONS, degraus da MLT de cinco usinas (Furnas, Camargos, Itutinga, Funil-MG, Mascarenhas de
  Moraes) de dezembro de 2023 a fevereiro de 2026;
- Open-Meteo, dois pontos de chuva e duas células de temperatura da rodada de 30/09/2026
  00Z do ECMWF IFS 0,25° e a resposta "modelRunUnavailable" da rodada de 01/10/2026.
Os valores esperados foram calculados por outro caminho (awk sobre os arquivos originais,
ou a conferência independente do verificador) e estão escritos nos testes.
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
from datetime import date, timedelta

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

    def test_camada_da_bacia_na_grade_das_malhas_do_ibge(self):
        """Capivari projetado na mesma Albers e na mesma grade de 100 m da camada de UF:
        a caixa do caminho publicado é a caixa dos vértices originais projetados (o
        Douglas-Peucker mantém os extremos de cada anel até a tolerância de 1 km)."""
        from pipeline.energia import geo
        b = json.loads(_texto("bacia_capivari.json"))
        vint = {"url": "https://exemplo/Bacias_Hidrograficas_SIN.zip", "capturado_em": "2026-09-30T23:43:45Z",
                "sha256": "1456e2b8c4446b9984be2fa4206588d94b8fe6e0270534f467c803f95c0198d4", "arquivo": "bronze.zip.gz"}
        cam = m.camada_bacias([{"nome_shape": "CAPIVARI", "bacia_ons": "CAPIVARI", "bbox": b["bbox"], "aneis": b["aneis"]}], vint)
        self.assertEqual([f["id"] for f in cam["features"]], ["CAPIVARI"])
        self.assertEqual(cam["projecao"]["origem_m"], [-2340300, 1999800])     # a mesma de public/energia/geo/uf.json
        aneis = geo.le_caminho_svg(cam["features"][0]["d"])
        self.assertEqual(len(aneis), 1)
        orig = [geo.quantiza(geo.albers(lon, lat), geo.origem_da_grade()) for lon, lat in b["aneis"][0]]
        self.assertLess(len(aneis[0]), len(orig))                               # simplificado
        for i, f in ((0, min), (1, min)):
            self.assertLessEqual(abs(f(p[i] for p in aneis[0]) - f(p[i] for p in orig)), 10)   # 10 × 100 m
        for i, f in ((0, max), (1, max)):
            self.assertLessEqual(abs(f(p[i] for p in aneis[0]) - f(p[i] for p in orig)), 10)
        x0, y0, w, h = (int(v) for v in cam["viewBox"].split())
        self.assertEqual((x0, y0), (min(p[0] for p in aneis[0]), min(p[1] for p in aneis[0])))
        with self.assertRaises(ValueError):                                       # polígono sem bacia não é publicado
            m.camada_bacias([{"nome_shape": "X", "bacia_ons": None, "bbox": b["bbox"], "aneis": b["aneis"]}], vint)

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


def _serie_recorte(nome_arq, tipo, nome):
    """{"pct", "mw", "max"} de um recorte (REE ou bacia) lido pelo parser do módulo."""
    s = {"pct": {}, "mw": {}, "max": {}}
    for serie, ref, v in oa.parse_ear_agregado(_linhas(nome_arq), tipo):
        pref, n_ = serie.split(".", 1)
        if n_ == nome and v is not None:
            s[{"ear_pct": "pct", "ear_mwmes": "mw", "ear_max_mwmes": "max"}[pref]][ref] = v
    return s


class TestPerimetroRee(unittest.TestCase):
    """Defeito: REE tratados como a mesma entidade só pelo nome através da reconfiguração do
    fim de 2017. Linhas reais dos arquivos EAR_DIARIO_REE_2017 e _2018 do ONS."""

    def test_quebra_de_perimetro_detectada_nas_linhas_de_2017_e_2018(self):
        mx = {}
        for serie, ref, v in oa.parse_ear_agregado(_linhas("ear_ree_2017_2018_trecho.csv"), "ree"):
            if serie.startswith("ear_max_mwmes.") and v is not None:
                mx.setdefault(serie.split(".", 1)[1], {})[ref] = v
        # 26 a 28/12/2017: 9 REE; 29/12: SUL, PARANA e NORTE já reduzidos e os novos ausentes;
        # 30/12: 12 REE (IGUACU, PARANAPANEMA, MANAUS-AMAPA)
        self.assertEqual(mx["SUL"]["2017-12-28"], 20100.0)
        self.assertEqual(mx["SUL"]["2017-12-29"], 9591.0)
        self.assertNotIn("2017-12-29", mx["IGUACU"])
        self.assertEqual(mx["IGUACU"]["2017-12-30"], 10509.0)
        cfg = m.configuracao_ree(mx)
        self.assertEqual([q["data"] for q in cfg["quebras"]], ["2017-12-30"])   # 01/01/2018 é só recálculo
        q = cfg["quebras"][0]
        self.assertEqual(q["dia_soma_conservada"], "2017-12-28")
        self.assertEqual(q["transicao"], ["2017-12-29"])
        # a repartição conserva a soma: 290.261 MWmês antes e depois
        self.assertEqual(q["soma_ear_max_antes_mwmes"], 290261.0)
        self.assertEqual(q["soma_ear_max_depois_mwmes"], 290261.0)
        self.assertEqual(set(q["afetados"]), {"SUL", "PARANA", "NORTE", "IGUACU", "PARANAPANEMA", "MANAUS-AMAPA"})
        for n_ in ("SUL", "PARANA", "NORTE", "IGUACU", "PARANAPANEMA", "MANAUS-AMAPA"):
            self.assertEqual(cfg["ano_inicio_base"][n_], 2018, n_)
        for n_ in ("SUDESTE", "NORDESTE", "MADEIRA", "BELO MONTE", "ITAIPU", "TELES PIRES"):
            self.assertNotIn(n_, q["afetados"])
            self.assertEqual(cfg["ano_inicio_base"][n_], 2017, n_)     # primeiro ano do trecho

    def test_faixa_do_parana_so_com_o_perimetro_atual(self):
        """28/09/2026: PARANA com 56,61%. Base 2016 a 2025 (perímetros misturados): p90 51,89 e
        'acima'; base 2018 a 2025 (perímetro atual): p90 56,68 e 'dentro' (conferência do
        verificador com os arquivos anuais do ONS)."""
        s = _serie_recorte("ear_ree_0928_trecho.csv", "ree", "PARANA")
        self.assertAlmostEqual(s["pct"]["2026-09-28"], 56.612)
        misto = m.faixa_sazonal(s["pct"], s["mw"], s["max"], "2026-09-28", 2016)
        self.assertEqual((misto["anos_na_base"], misto["p90"], misto["faixa"]), (10, 51.89, "acima"))
        f = m.faixa_sazonal(s["pct"], s["mw"], s["max"], "2026-09-28", 2018)
        self.assertEqual((f["anos_na_base"], f["periodo_base"], f["p90"], f["faixa"]), (8, "2018-2025", 56.68, "dentro"))
        self.assertFalse(f["capacidade_mudou_na_base"])     # 140.228 a 140.596 MWmês: mesmo perímetro

    def test_quebra_declarada_no_registro(self):
        ds = next(x for x in m.REGISTRO["datasets"] if x["dataset_silver"] == m.DS_EAR_REE)
        q = [x for x in ds["quebras"] if x["data"] == "2017-12-29"]
        self.assertEqual(len(q), 1)
        self.assertEqual(q[0]["origem"], "PLATAFORMA")
        for termo in ("IGUACU", "PARANAPANEMA", "MANAUS-AMAPA", "SUL", "PARANA", "NORTE", "2018"):
            self.assertIn(termo, q[0]["descricao"])
        for d in m.REGISTRO["datasets"]:
            for x in d["quebras"]:
                self.assertIn(x["origem"], ("FONTE", "PLATAFORMA"))
                self.assertRegex(x["data"], r"^\d{4}-\d{2}-\d{2}$")


class TestNaoSeAplica(unittest.TestCase):
    """Defeito: recorte sem armazenamento (EAR máxima zero) publicado com percentual 0/0."""

    def test_itaipu_sem_percentual_faixa_nem_percentil(self):
        s = _serie_recorte("ear_ree_0928_trecho.csv", "ree", "ITAIPU")
        self.assertEqual(s["max"]["2026-09-28"], 0.0)          # "0E-8" é zero publicado, não ausência
        r = m._resumo_ear_recorte("ITAIPU", s, "2026-09-28", 2016)
        self.assertTrue(r["sem_armazenamento"])
        for k in ("ear_pct", "variacao_7d_pp", "variacao_30d_pp", "p10", "p50", "p90", "p10_mwmes", "p90_mwmes",
                  "faixa", "percentil_na_data", "periodo_base"):
            self.assertIsNone(r[k], k)
        self.assertEqual(r["anos_na_base"], 0)
        self.assertEqual(r["ear_mwmes"], 0.0)                  # o estoque zero é zero de fato
        self.assertEqual(r["variacao_30d_mwmes"], 0.0)

    def test_bacia_araguari_sem_variacao_em_pontos_percentuais(self):
        s = _serie_recorte("ear_bacia_araguari_trecho.csv", "bacia", "ARAGUARI")
        r = m._resumo_ear_recorte("ARAGUARI", s, "2026-09-28", 2001)
        self.assertIsNone(r["ear_pct"])
        self.assertIsNone(r["variacao_7d_pp"])
        self.assertIsNone(r["faixa"])

    def test_anos_sem_capacidade_ficam_fora_da_base(self):
        # um recorte com EAR máxima zero em anos da base (reservatório ainda inexistente)
        pct = {"2018-09-28": 0.0, "2019-09-28": 0.0, **{f"{a}-09-28": 40.0 + a - 2020 for a in range(2020, 2027)}}
        mx = {"2018-09-28": 0.0, "2019-09-28": 0.0, **{f"{a}-09-28": 900.0 for a in range(2020, 2027)}}
        mw = {k: pct[k] * mx[k] / 100 for k in pct}
        f = m.faixa_sazonal(pct, mw, mx, "2026-09-28", 2016)
        self.assertEqual((f["anos_na_base"], f["periodo_base"]), (6, "2020-2025"))
        self.assertEqual(f["p10"], 40.5)                       # sem os zeros de 2018 e 2019

    def test_minimo_de_anos_para_faixa(self):
        pct = {"2024-09-28": 30.0, "2025-09-28": 60.0, "2026-09-28": 50.0}
        mx = {k: 100.0 for k in pct}
        f = m.faixa_sazonal(pct, pct, mx, "2026-09-28", 2001)
        self.assertEqual((f["anos_na_base"], f["periodo_base"]), (2, "2024-2025"))
        self.assertIsNone(f["p10"])
        self.assertIsNone(f["faixa"])
        self.assertIsNone(f["percentil_na_data"])


class TestCapacidadeSubsistemas(unittest.TestCase):
    """Defeito: faixa dos subsistemas sem o sinal de capacidade que mudou na base. Linhas
    reais dos arquivos EAR_DIARIO_SUBSISTEMA_2001 a _2026 do ONS (28/09)."""

    def _serie(self, sm):
        s = {"pct": {}, "mw": {}, "max": {}}
        for serie, ref, v in ons_sm.parse_ear(_texto("ear_subsistema_0928_trecho.csv")):
            pref, x = serie.split(".", 1)
            if x == sm:
                s[{"ear_pct": "pct", "ear_mwmes": "mw", "ear_max_mwmes": "max"}[pref]][ref] = v
        return s

    def test_sudeste_faixa_e_capacidade(self):
        s = self._serie("SE")
        f = m.faixa_sazonal(s["pct"], s["mw"], s["max"], "2026-09-28", m.ANO_INI_BACIA)
        # conferência do verificador (quantil tipo 7, 25 anos)
        self.assertEqual((f["p10"], f["p50"], f["p90"], f["anos_na_base"]), (23.84, 49.48, 66.31, 25))
        self.assertEqual((f["p10_mwmes"], f["p50_mwmes"], f["p90_mwmes"]), (48391.5, 96212.6, 126592.0))
        self.assertEqual(f["percentil_na_data"], 72.0)
        self.assertEqual((f["ear_max_base_min_mwmes"], f["ear_max_base_max_mwmes"]), (159643.0, 204615.3))
        self.assertTrue(f["capacidade_mudou_na_base"])

    def test_sul_capacidade_variou_28_por_cento(self):
        s = self._serie("S")
        f = m.faixa_sazonal(s["pct"], s["mw"], s["max"], "2026-09-28", m.ANO_INI_BACIA)
        self.assertEqual((f["ear_max_base_min_mwmes"], f["ear_max_base_max_mwmes"]), (14645.0, 20459.2))
        self.assertTrue(f["capacidade_mudou_na_base"])


class TestCapturas(unittest.TestCase):
    """Defeito: a gold misturava duas capturas do ONS para o mesmo dia. Valores reais do
    Nordeste em 28/09/2026: silver principal (captura de 30/09 02:19Z) 35.626,564 MWmês;
    recaptura (23:51Z) e arquivo baixado de novo 35.651,441 MWmês."""

    def _con(self, ds, recurso, capt, linhas):
        con = base.conecta(":memory:")
        vid, _ = base.registra_vintage(con, ds, recurso, "teste", capt, None, hashlib.sha256(capt.encode()).hexdigest(),
                                       1, "teste", "x")
        base.grava_observacoes(con, ds, vid, linhas)
        return con

    def test_vale_a_captura_mais_recente_de_cada_ano(self):
        cp = self._con(m.DS_EAR_SM, "EAR_DIARIO_SUBSISTEMA_2026", "2026-09-30T02:19:44Z",
                       [("ear_mwmes.NE", "2026-09-28", 35626.564)])
        base.registra_vintage(cp, m.DS_EAR_SM, "EAR_DIARIO_SUBSISTEMA_2024", "teste", "2026-09-29T02:42:31Z", None,
                              "a" * 64, 1, "teste", "x")
        base.grava_observacoes(cp, m.DS_EAR_SM, f"{m.DS_EAR_SM}:EAR_DIARIO_SUBSISTEMA_2024:{'a' * 16}",
                               [("ear_mwmes.NE", "2024-09-28", 21187.0)])
        cr = self._con(m.DS_EAR_SM_CONF, "EAR_DIARIO_SUBSISTEMA_2026", "2026-09-30T23:51:52Z",
                       [("ear_mwmes.NE", "2026-09-28", 35651.441), ("ear_mwmes.NE", "2026-09-29", 35484.985)])
        out, escolha, dados = m.series_mais_recentes(
            [(m.FONTE_PRINCIPAL, cp, m.DS_EAR_SM), (m.FONTE_RECAPTURA, cr, m.DS_EAR_SM_CONF)], "EAR_DIARIO_SUBSISTEMA_",
            ["ear_mwmes.NE"])
        self.assertEqual(out["ear_mwmes.NE"]["2026-09-28"], 35651.441)
        self.assertEqual(out["ear_mwmes.NE"]["2026-09-29"], 35484.985)
        self.assertEqual(out["ear_mwmes.NE"]["2024-09-28"], 21187.0)        # ano só no silver principal
        self.assertEqual(escolha["2026"]["fonte"], m.FONTE_RECAPTURA)
        self.assertEqual(escolha["2024"]["fonte"], m.FONTE_PRINCIPAL)
        rev = m._revisoes_entre_capturas(dados, [("NE", "ear_mwmes.NE")], ["2026-09-28"])
        self.assertEqual(rev[0]["diferenca"], 24.877)                         # revisão exposta, não absorvida


class TestBalancoJanelaEConvencao(unittest.TestCase):
    """Defeitos: fração de dias calculada na série inteira mas publicada como da janela; e
    defluência não discriminada negativa por convenção de defluência sem as outras
    estruturas. Linhas reais de DADOS_HIDROLOGICOS_RES_2026 (ONS)."""

    @classmethod
    def setUpClass(cls):
        cls.cad = {r["nom_reservatorio"]: r for r in _linhas("cadastro_trecho.csv")}
        cls.q = {}
        obs, atrib = oa.parse_dados_hidrologicos(_linhas("hidro_2026_trecho.csv.gz"))
        for s, ref, v in obs:
            if v is not None:
                campo, rid = s.split(".", 1)
                cls.q.setdefault(rid, {}).setdefault(campo, {})[ref] = v
        cls.ids = {at["nome"]: rid for rid, at in atrib.items()}

    def test_sobradinho_fracao_na_janela_publicada(self):
        x = self.q[self.ids["SOBRADINHO"]]
        b = m.balanco_reservatorio(x, float(self.cad["SOBRADINHO"]["val_volutiltot"]), "2026-09-29")
        # janela de 31/08 a 29/09/2026: 17 de 30 dias (56,7%) dentro do arredondamento; em toda
        # a série de 2025 e 2026 (636 dias) são 18,2% (conferência do verificador)
        self.assertEqual((b["dentro_tol_janela"], b["n_res_janela"]), (17, 30))
        self.assertAlmostEqual(100.0 * b["dentro_tol_janela"] / b["n_res_janela"], 56.7, places=1)
        # a série do trecho começa em 30/08: os dias avaliados da série são os mesmos 30
        self.assertEqual(b["periodo_residuos"], ("2026-08-31", "2026-09-29"))

    def test_fracao_da_serie_e_da_janela_sao_distintas(self):
        # 2025 (setembro, trecho antigo): a série tem 60 dias e a janela 30
        obs, atrib = oa.parse_dados_hidrologicos(_linhas("hidro_2025_trecho.csv.gz"))
        rid = next(r for r, at in atrib.items() if at["nome"] == "FURNAS")
        x = {}
        for s_, ref, v in obs:
            campo, r_ = s_.split(".", 1)
            if r_ == rid and v is not None:
                x.setdefault(campo, {})[ref] = v
        b = m.balanco_reservatorio(x, float(self.cad["FURNAS"]["val_volutiltot"]), "2025-09-30")
        self.assertEqual((b["n_res"], b["n_res_janela"]), (60, 30))
        self.assertEqual((b["dentro_tol"], b["dentro_tol_janela"]), (59, 30))   # o dia fora (25/08) não está na janela

    def test_marimbondo_publica_defluencia_sem_outras_estruturas(self):
        x = self.q[self.ids["MARIMBONDO"]]
        # 15/09/2026: defluência 1.168 = turbinada 1.168 + vertida 0; outras estruturas 201 m³/s
        self.assertEqual((x["q_defluente"]["2026-09-15"], x["q_turbinada"]["2026-09-15"], x["q_vertida"]["2026-09-15"],
                          x["q_outras"]["2026-09-15"]), (1168.0, 1168.0, 0.0, 201.0))
        c_ = m.convencao_defluencia(x)
        self.assertEqual(c_["convencao"], "exclui_outras")
        self.assertEqual(c_["dias_sem_outras"], c_["dias_avaliados"])
        b = m.balanco_reservatorio(x, 5265.0, "2026-09-15", n=6)
        self.assertGreater(b["comp"]["q_outras"], 90.0)                      # ~104 hm³ de outras estruturas
        self.assertAlmostEqual(b["defl_disc"], 0.0, places=6)                # não vira −outras

    def test_jirau_e_pimental_incluem_as_outras_estruturas(self):
        x = self.q[self.ids["JIRAU"]]
        # 04/07/2026: 14.954 = 9.568 + 5.344 + 42
        self.assertEqual(x["q_defluente"]["2026-07-04"], x["q_turbinada"]["2026-07-04"] + x["q_vertida"]["2026-07-04"]
                         + x["q_outras"]["2026-07-04"])
        self.assertEqual(m.convencao_defluencia(x)["convencao"], "inclui_outras")
        self.assertEqual(m.convencao_defluencia(self.q[self.ids["PIMENTAL"]])["convencao"], "inclui_outras")

    def test_convencao_indeterminada_nao_publica_numero(self):
        x = {"q_defluente": {"2026-01-0%d" % i: 100.0 for i in range(1, 7)},
             "q_turbinada": {"2026-01-0%d" % i: 80.0 for i in range(1, 7)},
             "q_vertida": {"2026-01-0%d" % i: 0.0 for i in range(1, 7)},
             "q_outras": {"2026-01-0%d" % i: (20.0 if i < 4 else 30.0) for i in range(1, 7)},
             "q_afluente": {"2026-01-0%d" % i: 100.0 for i in range(1, 7)}}
        self.assertEqual(m.convencao_defluencia(x)["convencao"], "indeterminada")
        self.assertIsNone(m.balanco_reservatorio(x, None, "2026-01-06", n=6)["defl_disc"])


class TestVersaoMlt(unittest.TestCase):
    """Defeito: 20/01/2026 lido como recálculo, quando devolveu a MLT de 2025. Degraus reais
    da MLT de cinco usinas (ENA_DIARIO_RESERVATORIOS_2023 a _2026, ONS)."""

    @classmethod
    def setUpClass(cls):
        d = json.loads(_texto("mlt_usinas_2025_2026_trecho.json"))
        cls.itens = {c_: [tuple(x) for x in v["degraus"]] for c_, v in d.items()}
        cls.nomes = {c_: v["nome"] for c_, v in d.items()}

    def test_furnas_volta_ao_valor_de_2025(self):
        f = self.itens["6"]
        self.assertEqual(self.nomes["6"], "FURNAS")
        self.assertEqual(m._vigente(f, "2025-01-15"), 1398.36)
        self.assertEqual(m._vigente(f, "2026-01-15"), 1391.043)     # versão provisória
        self.assertEqual(m._vigente(f, "2026-01-25"), 1398.36)      # retorno

    def test_classifica_retorno_e_periodo_provisorio(self):
        rev = {"2025-11-04": list(self.itens), "2026-01-20": list(self.itens)}
        out, prov = m.classifica_revisoes_mlt(self.itens, rev)
        r = {x["data"]: x for x in out}
        self.assertEqual(r["2025-11-04"]["classificacao"], "nova_versao")
        self.assertEqual(r["2025-11-04"]["vespera_igual_ao_ano_anterior"], 5)
        self.assertEqual(r["2026-01-20"]["classificacao"], "retorno_a_versao_anterior")
        self.assertEqual(r["2026-01-20"]["igual_a_vigente_em"], "2025-01-20")
        self.assertEqual(prov, [{"inicio": "2025-11-04", "fim": "2026-01-19", "retorno_em": "2026-01-20",
                                 "versao_restaurada_igual_a_de": "2025-01-20", "usinas_na_nova_versao": 5,
                                 "usinas_no_retorno": 5}])

    def test_comparacao_anual_pelo_fim_do_mes(self):
        # dia 15 cai na versão provisória e daria "MLT diferente"; o último dia do mês não
        dif15 = sum(1 for it in self.itens.values() if not m._igual(m._vigente(it, "2026-01-15"), m._vigente(it, "2025-01-15")))
        dif31 = sum(1 for it in self.itens.values() if not m._igual(m._vigente(it, "2026-01-31"), m._vigente(it, "2025-01-31")))
        self.assertEqual((dif15, dif31), (5, 0))


class TestPrevisao(unittest.TestCase):
    """P019: previsão integrada (PREVISTO), separada da estimativa. Respostas reais da API de
    rodadas individuais do Open-Meteo (ECMWF IFS 0,25°, rodada de 30/09/2026 00Z)."""

    def test_le_resposta_e_recusa_rodada_indisponivel(self):
        p = cl.le_previsao(_texto("openmeteo_precip_trecho.json"), 2)
        self.assertIsNone(p[0]["precipitation_sum"]["2026-09-30"])          # dia da rodada sem soma: nulo
        self.assertEqual(p[0]["precipitation_sum"]["2026-10-01"], 1.3)
        self.assertEqual(p[1]["precipitation_sum"]["2026-10-01"], 0.1)
        with self.assertRaises(ValueError):
            cl.le_previsao(_texto("openmeteo_rodada_indisponivel.txt"), 2)  # "modelRunUnavailable"
        with self.assertRaises(ValueError):
            cl.le_previsao(_texto("openmeteo_precip_trecho.json"), 3)       # ponto faltando não é completado

    def test_agrega_com_as_regras_da_estimativa(self):
        p = cl.le_previsao(_texto("openmeteo_precip_trecho.json"), 2)
        t = cl.le_previsao(_texto("openmeteo_temp_trecho.json"), 2)
        valores = {("precip", "a"): p[0], ("precip", "b"): p[1], ("temp", "c1"): t[0], ("temp", "c2"): t[1]}
        pontos = [{"id": "a", "bacia": "X", "peso": 3.0}, {"id": "b", "bacia": "X", "peso": 1.0}]
        celulas = [{"id": "c1", "uf": "AP", "pop": 400}, {"id": "c2", "uf": "RR", "pop": 100}]
        ag = cl.agrega_previsao(valores, pontos, celulas, {"AP": 300, "RR": 100}, uf_subsistema={"AP": "N", "RR": "N"})
        self.assertAlmostEqual(ag["bacias"]["X"]["2026-10-01"], (3 * 1.3 + 1 * 0.1) / 4)
        self.assertNotIn("2026-09-30", ag["bacias"]["X"])                     # nulo nos dois pontos
        # 01/10: AP 29,1 °C e RR 28,3 °C, ponderados pela população das UF (300 e 100)
        self.assertAlmostEqual(ag["recortes"]["N"]["t"]["2026-10-01"], (300 * 29.1 + 100 * 28.3) / 400)
        self.assertEqual(cl.primeiro_dia_completo("2026-09-30T00:00Z"), "2026-09-30")
        self.assertEqual(cl.primeiro_dia_completo("2026-09-30T12:00Z"), "2026-10-01")

    def test_url_pede_a_rodada_de_00z(self):
        u = cl.url_previsao("precip", [(-23.5, -46.6)], "2026-09-30")
        self.assertIn("run=2026-09-30T00:00", u)
        self.assertIn("models=ecmwf_ifs025", u)
        self.assertIn("timezone=GMT", u)


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

    def test_numeros_de_destaque_das_paginas_tem_ficha_refeita_por_outro_caminho(self):
        # a revisão de interface achou dois números de destaque sem ficha (ENA armazenável do SIN
        # e reservatórios que fecham por construção); as fichas são conferidas contra os CSV
        ev = self.g["evidencias"]
        e = ev["fecham_por_construcao"]
        with open(os.path.join(base.SERIES, "agua_reservatorios.csv"), encoding="utf-8") as f:
            linhas = [r for r in csv.DictReader(f, delimiter=";") if r["balanco_calculado"] == "1"]
        fecham = [r for r in linhas if float(r["serie_dias_residuo_dentro_tolerancia_pct"]) >= 95]
        self.assertEqual(e["valor_calculo"], len(fecham))
        self.assertEqual(e["denominador"]["valor"], len(linhas))
        self.assertEqual(e["valor_calculo"], self.g["reservatorios"]["n_fecham_por_construcao"])
        a = ev["ena_arm_30d_sin"]
        with open(os.path.join(base.SERIES, "agua_subsistemas_diario.csv"), encoding="utf-8") as f:
            sub = [r for r in csv.DictReader(f, delimiter=";")
                   if a["periodo"]["inicio"] <= r["data"] <= a["periodo"]["fim"] and r["recorte"] != "SIN"]
        self.assertEqual(len(sub), 120)
        razao = 100 * sum(float(r["ena_arm_mwmed"]) for r in sub) / sum(float(r["mlt_arm_implicita_mwmed"]) for r in sub)
        self.assertAlmostEqual(razao, a["valor_calculo"], delta=0.001)
        sin = next(s for s in self.g["afluencia"]["subsistemas"] if s["sm"] == "SIN")
        self.assertAlmostEqual(sin["pct_mlt_arm_30d"], a["valor_calculo"], delta=0.05)

    def test_periodo_da_conferencia_com_estacoes_vem_dos_meses_comparados(self):
        v = self.g["clima"]["validacao_estacoes"]
        self.assertRegex(v["periodo"]["inicio"], r"^\d{4}-\d{2}$")
        self.assertLessEqual(v["periodo"]["inicio"], v["periodo"]["fim"])
        # o texto da separação e o nome do teste da ficha citam o mesmo período
        self.assertIn(m._periodo_meses(v["periodo"]), self.g["clima"]["separacao"]["observacao"])
        nomes = [t["nome"] for t in self.g["evidencias"]["precipitacao_maior_bacia_30d"]["testes"]]
        self.assertIn(f"Conferência com estações ({m._periodo_meses(v['periodo'])})", nomes)

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

    def test_ree_nordeste_igual_ao_subsistema_ne_no_mesmo_dia(self):
        """REE NORDESTE e subsistema NE têm o mesmo perímetro: na mesma captura o valor é o
        mesmo (a gold antiga trazia 35.626,6 contra 35.651,4 em 28/09/2026)."""
        a = self.g["armazenamento"]
        ne = next(x for x in a["subsistemas"] if x["sm"] == "NE")
        ree = next(x for x in a["ree"] if x["nome"] == "NORDESTE")
        self.assertEqual(ree["dia"], ne["dia"])
        self.assertAlmostEqual(ree["ear_mwmes"], ne["ear_mwmes"], delta=0.1)
        self.assertAlmostEqual(ree["ear_pct"], ne["ear_pct"], delta=0.01)
        self.assertAlmostEqual(ree["variacao_30d_mwmes"], ne["variacao_30d_mwmes"], delta=0.2)
        self.assertEqual(self.g["dias_referencia"]["ear"], self.g["dias_referencia"]["ree"])

    def test_decomposicao_igual_a_variacao_publicada(self):
        a = self.g["armazenamento"]
        sd = a["serie_diaria_mwmes"]
        dia_de = lambda i: (date.fromisoformat(sd["d0"]) + timedelta(days=i)).isoformat()  # noqa: E731
        idx = {dia_de(i): i for i in range(len(sd["SE"]))}
        subs = {x["sm"]: x for x in a["subsistemas"]}
        for x in self.g["reservatorios"]["decomposicao_ear"]:
            if x["fim"] == a["dia"]:
                self.assertAlmostEqual(x["delta_ear_mwmes"], subs[x["sm"]]["variacao_30d_mwmes"], delta=0.15, msg=x["sm"])
            # a série diária publicada (MWmês inteiros) reproduz a variação da decomposição
            self.assertAlmostEqual(sd[x["sm"]][idx[x["fim"]]] - sd[x["sm"]][idx[x["inicio"]]], x["delta_ear_mwmes"],
                                   delta=1.0, msg=x["sm"])

    def test_ena_da_conferencia_de_unidade_e_do_csv_sao_a_mesma_captura(self):
        caminho = os.path.join(base.SERIES, "agua_subsistemas_diario.csv")
        with open(caminho, encoding="utf-8") as f:
            csvv = {(r["data"], r["recorte"]): r for r in csv.DictReader(f, delimiter=";")}
        for u in self.g["afluencia"]["mlt"]["unidade"]:
            ex = u["exemplo"]
            self.assertAlmostEqual(float(csvv[(ex["dia"], u["sm"])]["ena_bruta_mwmed"]), ex["subsistema_mwmed"], delta=0.001)
        for s_ in self.g["armazenamento"]["subsistemas"]:
            self.assertIn(s_["captura"], (m.FONTE_PRINCIPAL, m.FONTE_RECAPTURA))
            self.assertAlmostEqual(float(csvv[(s_["dia"], s_["sm"])]["ear_mwmes"]), s_["ear_mwmes"], delta=0.05)

    def test_mes_corrente_marcado_como_parcial(self):
        a = self.g["armazenamento"]
        sm = a["serie_mensal_mwmes"]
        ult = date.fromisoformat(a["dia"])
        fim_mes = (ult.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        if ult != fim_mes:
            self.assertEqual(sm["mes_parcial"], {"m": a["dia"][:7], "d": a["dia"]})
            self.assertEqual(sm["m"][-1], a["dia"][:7])

    def test_subsistemas_e_sin_trazem_sinal_de_capacidade(self):
        subs = {x["sm"]: x for x in self.g["armazenamento"]["subsistemas"]}
        for sm in ("SE", "S", "NE", "N", "SIN"):
            for k in ("capacidade_mudou_na_base", "ear_max_base_min_mwmes", "ear_max_base_max_mwmes"):
                self.assertIn(k, subs[sm], sm)
        self.assertTrue(subs["SE"]["capacidade_mudou_na_base"])     # 159.643 a 204.615 MWmês em 28/09
        self.assertTrue(subs["SIN"]["capacidade_mudou_na_base"])

    def test_recortes_sem_armazenamento_sem_percentual(self):
        a = self.g["armazenamento"]
        zeros = [x for x in a["ree"] + a["bacias"] if x["ear_max_mwmes"] == 0]
        self.assertTrue(any(x["nome"] == "ITAIPU" for x in zeros))
        for x in zeros:
            for k in ("ear_pct", "variacao_7d_pp", "variacao_30d_pp", "p10", "p90", "faixa", "percentil_na_data"):
                self.assertIsNone(x[k], (x["nome"], k))
            self.assertIsNone(x["semanal"])

    def test_ree_afetados_pela_reconfiguracao_com_base_desde_2018(self):
        a = self.g["armazenamento"]
        q = [x for x in a["quebras_perimetro_ree"] if x["data"] == "2017-12-30"]
        self.assertEqual(len(q), 1)
        for x in a["ree"]:
            if x["nome"] in q[0]["afetados"]:
                self.assertEqual(x["base_desde"], 2018, x["nome"])
                if x["periodo_base"]:
                    self.assertGreaterEqual(int(x["periodo_base"][:4]), 2018, x["nome"])
        for x in self.g["afluencia"]["ree"]:
            if x["nome"] in q[0]["afetados"] and x["periodo_base"]:
                self.assertGreaterEqual(int(x["periodo_base"][:4]), 2018, x["nome"])

    def test_faixa_so_com_anos_suficientes_e_periodo_real(self):
        for lst in (self.g["armazenamento"]["ree"], self.g["armazenamento"]["bacias"]):
            for x in lst:
                if x["anos_na_base"] < m.MIN_ANOS_FAIXA:
                    self.assertIsNone(x["faixa"], x["nome"])
                if x["periodo_base"]:
                    a0, a1 = map(int, x["periodo_base"].split("-"))
                    self.assertLessEqual(x["anos_na_base"], a1 - a0 + 1, x["nome"])
        for x in self.g["afluencia"]["bacias"] + self.g["afluencia"]["ree"]:
            if x["anos_na_base_30d"] < m.MIN_ANOS_FAIXA:
                self.assertIsNone(x["faixa_30d"], x["nome"])
                self.assertIsNone(x["percentil_30d"], x["nome"])

    def test_fracao_de_dias_na_janela_com_periodo(self):
        r = self.g["reservatorios"]
        self.assertTrue(r["periodo_fecham_por_construcao"])
        for x in r["lista"]:
            if x["balanco_calculado"]:
                self.assertEqual(x["dias_residuo_avaliados"], 30, x["nome"])
                self.assertIsNotNone(x["serie_dias_residuo_dentro_tolerancia_pct"], x["nome"])
        if (r["inicio"], r["fim"]) == ("2026-08-31", "2026-09-29"):
            sob = next(x for x in r["lista"] if x["nome"] == "SOBRADINHO")
            # conferência do verificador com DADOS_HIDROLOGICOS_RES_2025 e _2026
            self.assertEqual(sob["dias_residuo_dentro_tolerancia_pct"], 56.7)
            self.assertEqual(sob["serie_dias_residuo_dentro_tolerancia_pct"], 18.2)

    def test_defluencia_nao_discriminada_sem_sinal_espurio(self):
        with open(os.path.join(base.SERIES, "agua_reservatorios.csv"), encoding="utf-8") as f:
            linhas = list(csv.DictReader(f, delimiter=";"))
        for r in linhas:
            if r["outras_estruturas_hm3"] and r["defluencia_nao_discriminada_hm3"] and float(r["outras_estruturas_hm3"]) > 1:
                # o defeito antigo: não discriminada = −outras exatamente (convenção sem as outras)
                self.assertGreater(abs(float(r["defluencia_nao_discriminada_hm3"]) + float(r["outras_estruturas_hm3"])), 0.05, r["nome"])
            if r["convencao_defluencia"] == "indeterminada" and r["outras_estruturas_hm3"] and float(r["outras_estruturas_hm3"]) > 0.2:
                self.assertEqual(r["defluencia_nao_discriminada_hm3"], "", r["nome"])
        mar = next(r for r in linhas if r["nome"] == "MARIMBONDO")
        self.assertEqual(mar["convencao_defluencia"], "exclui_outras")
        jir = next(r for r in linhas if r["nome"] == "JIRAU")
        self.assertEqual(jir["convencao_defluencia"], "inclui_outras")

    def test_csv_de_reservatorios_bate_com_o_dicionario(self):
        with open(os.path.join(base.SERIES, "agua_reservatorios.csv"), encoding="utf-8") as f:
            cab = f.readline().strip().split(";")
        self.assertEqual(cab, ["janela_inicio", "janela_fim"] + m.COLS_RES_CSV)
        texto = m.REGISTRO["arquivos"]["/energia/series/agua_reservatorios.csv"]
        for col in cab:
            self.assertIn(col, texto)
        for antigo in ("dias_com_dado", "delta_ear_mwmes"):
            self.assertNotIn(antigo, texto)
        r = self.g["reservatorios"]
        self.assertEqual(sum(r["sem_balanco_por_motivo"].values()), r["n_reservatorios"] - r["n_com_balanco"])

    def test_pmo_cita_o_relatorio_do_proprio_mes(self):
        comp = {(x["mes"], x["sm"]): x for x in self.g["afluencia"]["mlt"]["pmo"]["comparacao"]}
        if ("2026-02", "SE") in comp:
            self.assertEqual(comp[("2026-02", "SE")]["relatorio"], "RELATORIO-PMO-31_01 a 06_02")
            self.assertTrue(comp[("2026-02", "SE")]["relatorio_do_proprio_mes"])
        if ("2026-08", "SE") in comp:
            self.assertEqual(comp[("2026-08", "SE")]["relatorio"], "RELATORIO-PMO-22_08_26 a 28_08_26")
        for x in comp.values():
            if x["relatorio_do_proprio_mes"]:
                self.assertTrue(x["relatorio"].startswith("RELATORIO-PMO-"))

    def test_mlt_de_2026_e_a_de_2025(self):
        mlt = self.g["afluencia"]["mlt"]
        if self.g["dias_referencia"]["ena"][:4] == "2026":
            for x in mlt["ano_corrente_igual_ao_anterior"]:
                self.assertGreaterEqual(x["usinas_iguais"], 0.95 * x["usinas_comparadas"], x["mes"])
            prov = [p_ for p_ in mlt["periodos_provisorios"] if p_["inicio"] == "2025-11-04"]
            self.assertEqual(prov[0]["fim"], "2026-01-19")
            anos = dict(zip(zip(mlt["anos"]["ano"], mlt["anos"]["mes"]), mlt["anos"]["usinas_com_mlt_diferente"]))
            self.assertEqual(anos[(2026, 1)], 0)

    def test_proveniencia_da_ena_por_recorte(self):
        p = self.g["proveniencia"]
        af = self.g["afluencia"]
        self.assertTrue(p["ena_30d_ree"]["snapshot"]["id"].startswith("ons_ena_ree_di@"))
        self.assertTrue(p["ena_30d_bacia"]["snapshot"]["id"].startswith("ons_ena_bacia_di@"))
        self.assertEqual(p["ena_30d_ree"]["periodo_referencia"]["fim"], af["dia_ree"])
        self.assertEqual(p["ena_30d_bacia"]["periodo_referencia"]["fim"], af["dia_bacias"])
        self.assertEqual(p["ena_30d"]["periodo_referencia"]["fim"], af["dia"])
        # a cobertura histórica é a dos anos da base, não a janela de 30 dias
        self.assertEqual(p["ena_30d"]["cobertura_historica"]["inicio"], "2001-01-01")

    def test_previsao_rotulada_e_separada(self):
        cl_ = self.g["clima"]
        pv = cl_["previsao"]
        if pv is None:
            self.assertTrue(any(x.startswith("previsão:") for x in self.g["pendencias"]))
            return
        self.assertEqual(pv["natureza"], "PREVISTO")
        self.assertRegex(pv["emitida_em"], r"^\d{4}-\d{2}-\d{2}T00:00Z$")
        self.assertLessEqual(pv["idade_horas"], m.IDADE_MAX_PREVISAO_H)
        self.assertGreaterEqual(pv["d0"], pv["emitida_em"][:10])
        for b in pv["bacias"]:
            self.assertEqual(len(b["mm"]), pv["n_dias"])
            self.assertTrue(all(v is None or v >= 0 for v in b["mm"]))
        self.assertFalse(cl_["separacao"]["previsao"].startswith("Não integrada"))
        self.assertEqual(self.g["proveniencia"]["previsao"]["natureza"], "PREVISTO")

    def test_subsistemas_com_a_faixa_sazonal_do_ultimo_ano(self):
        """O pequeno múltiplo dos subsistemas termina no dia da EAR com o valor e a faixa do
        resumo (mesma captura, mesmas regras), como os REE e as bacias."""
        dia = date.fromisoformat(self.g["armazenamento"]["dia"])
        for s in self.g["armazenamento"]["subsistemas"]:
            se = s["semanal"]
            self.assertEqual(len(se["v"]), 27, s["sm"])
            self.assertEqual(date.fromisoformat(se["d0"]) + timedelta(days=se["passo_dias"] * 26), dia, s["sm"])
            self.assertAlmostEqual(se["v"][-1], s["ear_pct"], delta=0.051, msg=s["sm"])
            self.assertAlmostEqual(se["p10"][-1], s["p10"], delta=0.051, msg=s["sm"])
            self.assertAlmostEqual(se["p90"][-1], s["p90"], delta=0.051, msg=s["sm"])

    def test_series_de_45_dias_refazem_o_balanco_da_janela(self):
        """agua_reservatorios_45d.json: um reservatório por item da lista da gold, na mesma
        ordem; o último volume é o do fim da janela, e a soma das vazões diárias (m³/s,
        inteiras) × 0,0864 refaz a afluência e a defluência de 30 dias da gold (tolerância:
        30 dias × 0,5 m³/s de arredondamento × 0,0864 = 1,3 hm³)."""
        r = self.g["reservatorios"]
        with open(os.path.join(base.SERIES, "agua_reservatorios_45d.json"), encoding="utf-8") as f:
            j = json.load(f)
        self.assertEqual(r["series_45d"]["arquivo"], "/energia/series/agua_reservatorios_45d.json")
        self.assertEqual([x["id"] for x in j["reservatorios"]], [x["id"] for x in r["lista"]])
        self.assertEqual(j["fim"], r["fim"])
        d0 = date.fromisoformat(j["d0"])
        dias = [(d0 + timedelta(days=i)).isoformat() for i in range(45)]
        self.assertEqual(dias[-1], r["fim"])
        jan = [i for i, k in enumerate(dias) if r["inicio"] <= k <= r["fim"]]
        self.assertEqual(len(jan), 30)
        conferidos = 0
        for x, s in zip(r["lista"], j["reservatorios"]):
            self.assertEqual(len(s["vol"]), 45)
            if x["vol_util_pct_fim"] is not None:
                self.assertAlmostEqual(s["vol"][-1], x["vol_util_pct_fim"], delta=0.006, msg=x["id"])
            if x["balanco_calculado"] and all(s["afl"][i] is not None and s["defl"][i] is not None for i in jan):
                self.assertAlmostEqual(sum(s["afl"][i] for i in jan) * 0.0864, x["afluencia_hm3"], delta=1.3, msg=x["id"])
                self.assertAlmostEqual(sum(s["defl"][i] for i in jan) * 0.0864, x["defluencia_hm3"], delta=1.3, msg=x["id"])
                conferidos += 1
        self.assertGreater(conferidos, 50)

    def test_lista_traz_o_codigo_da_usina_da_decomposicao(self):
        """A parcela da decomposição (por usina) liga-se ao balanço (por reservatório) pelo
        cod_usina, nunca pelo nome: Serra da Mesa é a usina 251 e o reservatório TOSMES."""
        r = self.g["reservatorios"]
        por_cod = {x["cod"]: x for x in r["lista"] if x.get("cod")}
        se = next(x for x in r["decomposicao_ear"] if x["sm"] == "SE")
        ligadas = [p_ for p_ in se["maiores_quedas"] + se["maiores_altas"] if p_["cod"] in por_cod]
        self.assertGreaterEqual(len(ligadas), 8)
        self.assertEqual(por_cod["251"]["id"], "TOSMES")

    def test_camada_das_bacias_publicada(self):
        with open(os.path.join(base.SERIES, "agua_bacias_geo.json"), encoding="utf-8") as f:
            cam = json.load(f)
        with open(os.path.join(base.RAIZ, "public", "energia", "geo", "uf.json"), encoding="utf-8") as f:
            uf = json.load(f)
        self.assertEqual(cam["projecao"]["origem_m"], uf["projecao"]["origem_m"])
        self.assertEqual(cam["projecao"]["unidade_svg_m"], uf["projecao"]["unidade_svg_m"])
        ids = {x["id"] for x in cam["features"]}
        chuva = {b["bacia"] for b in self.g["clima"]["precipitacao_bacias"]}
        self.assertEqual(ids, chuva)                                   # 22: SANTA MARIA VIT não tem polígono
        self.assertEqual(cam["contagem"]["poligonos"], cam["contagem"]["poligonos_origem"])
        self.assertEqual(sorted(cam["conciliacao"]["poligonos_por_bacia"]["AMAZONAS"]),
                         ["CURUA-UNA", "JARI", "MADEIRA", "TAPAJOS", "UATUAMA", "XINGU"])

    def test_tamanho_e_nenhum_nan(self):
        self.assertLess(os.path.getsize(GOLD), 400 * 1024)            # contrato: até cerca de 400 KB
        with open(GOLD, encoding="utf-8") as f:
            texto = f.read()
        self.assertNotIn("NaN", texto)
        self.assertNotIn("Infinity", texto)


if __name__ == "__main__":
    unittest.main()
