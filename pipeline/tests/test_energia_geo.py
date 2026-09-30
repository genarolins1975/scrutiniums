"""Geometria oficial dos mapas do Setor Elétrico: projeção Albers equivalente (origem,
simetria, escala verdadeira nos paralelos padrão, equivalência de área, inversa),
Douglas-Peucker por arco, preservação de polígonos e anéis fechados, topologia entre
vizinhos, quantização, união exata por chave e leitura da revisão da malha."""
import json
import math
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import geo  # noqa: E402

R = geo.R_AUTALICO


def _rel(a, b):
    return abs(a - b) / abs(b)


class Projecao(unittest.TestCase):
    def test_origem_vai_para_zero(self):
        x, y = geo.albers(-54, -12)
        self.assertAlmostEqual(x, 0, places=6)
        self.assertAlmostEqual(y, 0, places=6)

    def test_meridiano_central_e_eixo_de_simetria(self):
        for lat in (4.0, -12.0, -33.0):
            xa, ya = geo.albers(-54 - 13.5, lat)
            xb, yb = geo.albers(-54 + 13.5, lat)
            self.assertAlmostEqual(xa, -xb, places=4)
            self.assertAlmostEqual(ya, yb, places=4)
            self.assertAlmostEqual(geo.albers(-54, lat)[0], 0, places=6)

    def test_norte_para_cima_e_leste_para_a_direita(self):
        boa_vista = geo.albers(-60.67, 2.82)
        porto_alegre = geo.albers(-51.23, -30.03)
        rio_branco = geo.albers(-67.81, -9.97)
        recife = geo.albers(-34.88, -8.05)
        self.assertGreater(boa_vista[1], porto_alegre[1])
        self.assertGreater(recife[0], rio_branco[0])

    def test_escala_verdadeira_nos_paralelos_padrao(self):
        # ao longo de um paralelo padrão, 0,01° de longitude mede R·cos(φ)·Δλ no plano
        dl = 0.01
        for lat in geo.PARALELOS_PADRAO:
            a = geo.albers(-50, lat)
            b = geo.albers(-50 + dl, lat)
            esperado = R * math.cos(math.radians(lat)) * math.radians(dl)
            self.assertLess(_rel(math.dist(a, b), esperado), 1e-6)
        # fora dos paralelos padrão a escala ao longo do paralelo não é 1 (a projeção não é trivial)
        a, b = geo.albers(-50, -12), geo.albers(-50 + dl, -12)
        self.assertGreater(_rel(math.dist(a, b), R * math.cos(math.radians(-12)) * math.radians(dl)), 1e-3)

    def test_equivalencia_de_area(self):
        # célula de 0,05° × 0,05°: área no plano = área na esfera, em qualquer latitude
        d = 0.05
        for lon, lat in ((-70.0, 3.0), (-54.0, -12.0), (-35.0, -8.0), (-53.0, -32.0)):
            cantos = [geo.albers(lon, lat), geo.albers(lon + d, lat), geo.albers(lon + d, lat + d), geo.albers(lon, lat + d)]
            plano = abs(geo.area_assinada(cantos))
            esfera = R * R * math.radians(d) * (math.sin(math.radians(lat + d)) - math.sin(math.radians(lat)))
            self.assertLess(_rel(plano, esfera), 1e-4, (lon, lat))

    def test_inversa_devolve_o_ponto(self):
        for lon, lat in ((-73.9, 5.2), (-54, -12), (-28.85, -20.5), (-57.6, -33.7), (-47.88, -15.79)):
            x, y = geo.albers(lon, lat)
            lo, la = geo.albers_inversa(x, y)
            self.assertAlmostEqual(lo, lon, places=7)
            self.assertAlmostEqual(la, lat, places=7)

    def test_origem_da_grade_contem_o_territorio(self):
        ox, oy = geo.origem_da_grade()
        for lon, lat in ((-73.99, -7.5), (-28.85, -20.5), (-29.35, 0.92), (-53.37, -33.75), (-60.2, 5.27)):
            x, y = geo.albers(lon, lat)
            self.assertGreaterEqual(x, ox)
            self.assertLessEqual(y, oy)
        self.assertEqual(ox % geo.GRADE_M, 0)
        self.assertEqual(oy % geo.GRADE_M, 0)


class DouglasPeucker(unittest.TestCase):
    def test_reta_vira_as_duas_pontas(self):
        pts = [(i, 0.0001 * (-1) ** i) for i in range(50)]
        self.assertEqual(geo.douglas_peucker(pts, 1), [pts[0], pts[-1]])

    def test_desvio_acima_da_tolerancia_e_mantido(self):
        # (5; 1,6) e (15; 1,6) ficam a menos de 1 dos segmentos até o pico: saem
        pts = [(0, 0), (5, 1.6), (10, 3), (15, 1.6), (20, 0)]
        self.assertEqual(geo.douglas_peucker(pts, 1), [(0, 0), (10, 3), (20, 0)])
        self.assertEqual(geo.douglas_peucker(pts, 5), [(0, 0), (20, 0)])

    def test_arco_fechado_nao_vira_ponto(self):
        anel = [(0, 0), (10, 0), (10, 10), (0, 10), (0, 0)]
        s = geo.simplifica_arco(anel, 100)
        self.assertEqual(s[0], s[-1])
        self.assertGreaterEqual(len(geo.limpa_anel(s)), 2)
        # com tolerância menor que o lado, o quadrado inteiro sobrevive
        self.assertEqual(len(geo.limpa_anel(geo.simplifica_arco(anel, 1))), 4)


def _topologia_sintetica():
    """Dois quadrados de 1° vizinhos (A e B) com divisa ondulada compartilhada; A tem uma
    ilha de ~450 m e B tem um buraco (enclave) de 0,2°. Coordenadas absolutas, sem transform."""
    divisa = [(-49.0, -20.0)] + [(-49.0 + (0.001 if i % 2 else -0.001), -20.0 + i / 20) for i in range(1, 20)] + [(-49.0, -19.0)]
    resto_a = [(-49.0, -19.0), (-50.0, -19.0), (-50.0, -20.0), (-49.0, -20.0)]
    resto_b = [(-49.0, -20.0), (-48.0, -20.0), (-48.0, -19.0), (-49.0, -19.0)]
    c, r = (-49.5, -19.5), 0.002
    ilha = [(c[0] + r * math.cos(k * math.pi / 3), c[1] + r * math.sin(k * math.pi / 3)) for k in range(6)]
    ilha.append(ilha[0])
    buraco = [(-48.6, -19.6), (-48.4, -19.6), (-48.4, -19.4), (-48.6, -19.4), (-48.6, -19.6)]
    return {
        "type": "Topology",
        "arcs": [divisa, resto_a, resto_b, ilha, buraco],
        "objects": {"BRMU": {"type": "GeometryCollection", "geometries": [
            {"type": "MultiPolygon", "arcs": [[[0, 1]], [[3]]], "properties": {"codarea": "3500001"}},
            {"type": "Polygon", "arcs": [[2, ~0], [4]], "properties": {"codarea": "3500002"}},
        ]}},
    }


def _na_divisa(p, proc):
    """Ponto quantizado sobre o meridiano −49° (a divisa dos quadrados sintéticos) entre as
    latitudes −20° e −19°, com folga de uma célula da grade."""
    ox, oy = proc["origem"]
    lon, lat = geo.albers_inversa(ox + p[0] * proc["grade"], oy - p[1] * proc["grade"])
    return abs(lon + 49.0) < 0.0015 and -20.001 < lat < -18.999


class Topologia(unittest.TestCase):
    def setUp(self):
        self.dec = geo.decodifica_topologia(_topologia_sintetica())
        # 50 km: grande o bastante para colapsar a ilha e o buraco na primeira rodada
        self.proc = geo.processa_topologia(self.dec, 50000)

    def test_decodifica_transform_delta(self):
        topo = {"type": "Topology", "transform": {"scale": [0.5, 0.25], "translate": [-50, -20]},
                "arcs": [[[0, 0], [2, 0], [0, 4], [-2, -4]]],
                "objects": {"X": {"type": "GeometryCollection", "geometries": [{"type": "Polygon", "arcs": [[0]], "properties": {"codarea": "1"}}]}}}
        dec = geo.decodifica_topologia(topo)
        self.assertEqual(dec["arcos"][0], [(-50, -20), (-49, -20), (-49, -19), (-50, -20)])
        self.assertEqual(dec["objetos"]["X"][0], {"id": "1", "poligonos": [[[0]]]})

    def test_nenhum_poligono_some_e_todo_anel_fecha_com_area(self):
        entrada = {g["id"]: [len(p) for p in g["poligonos"]] for g in self.dec["objetos"]["BRMU"]}
        for g in self.proc["geometrias"]:
            aneis = geo.aneis_da_geometria(self.proc, g["poligonos"])
            self.assertEqual(len(aneis), sum(entrada[g["id"]]))
            for anel in aneis:
                self.assertTrue(geo.anel_valido(anel), (g["id"], anel))
                fechado = geo.fecha_anel(anel)
                self.assertEqual(fechado[0], fechado[-1])
            d = geo.caminho_svg(aneis)
            # um subcaminho por anel, cada um fechado com z
            self.assertEqual(d.count("M"), len(aneis))
            self.assertEqual(d.count("z"), len(aneis))
        self.assertGreater(self.proc["reduzidos"], 0)

    def test_divisa_compartilhada_continua_identica_nos_dois_vizinhos(self):
        a, b = (geo.aneis_da_geometria(self.proc, g["poligonos"])[0] for g in self.proc["geometrias"])
        na_divisa_a = {p for p in a if _na_divisa(p, self.proc)}
        na_divisa_b = {p for p in b if _na_divisa(p, self.proc)}
        # as pontas da divisa e nada mais (a ondulação de 100 m some com 50 km de tolerância),
        # iguais nos dois lados: sem fresta nem sobreposição
        self.assertEqual(len(na_divisa_a), 2)
        self.assertEqual(na_divisa_a, na_divisa_b)

    def test_quantizacao_inteira_e_orientacao(self):
        g = next(g for g in self.proc["geometrias"] if g["id"] == "3500002")
        externo, buraco = geo.aneis_da_geometria(self.proc, g["poligonos"])
        self.assertGreater(geo.area_assinada(externo), 0)
        self.assertLess(geo.area_assinada(buraco), 0)
        d = geo.caminho_svg([externo, buraco])
        self.assertIsNone(re.search(r"\d\.\d", d))
        self.assertEqual(geo.le_caminho_svg(d), [externo, buraco])

    def test_caminho_svg_ida_e_volta_com_deltas_negativos(self):
        aneis = [[(10, 10), (7, 12), (7, 4), (15, 3)], [(100, 100), (101, 100), (101, 99)]]
        d = geo.caminho_svg(aneis)
        self.assertEqual(d, "M10 10l-3 2 0-8 8-1zM100 100l1 0 0-1z")
        self.assertEqual(geo.le_caminho_svg(d), aneis)

    def test_anel_menor_que_a_grade_interrompe_a_geracao(self):
        topo = {"type": "Topology", "arcs": [[(-50.0, -20.0), (-50.0001, -20.0), (-50.0001, -20.0001), (-50.0, -20.0)]],
                "objects": {"X": {"type": "GeometryCollection", "geometries": [{"type": "Polygon", "arcs": [[0]], "properties": {"codarea": "9"}}]}}}
        with self.assertRaises(ValueError):
            geo.processa_topologia(geo.decodifica_topologia(topo), 100)


class Agrupamento(unittest.TestCase):
    def setUp(self):
        self.proc = geo.processa_topologia(geo.decodifica_topologia(_topologia_sintetica()), 200)

    def test_uniao_exata_tira_a_divisa_interna(self):
        (g,) = geo.agrupa_por_chave(self.proc, lambda i: i[:2])
        self.assertTrue(g["uniao"])
        self.assertEqual(g["membros"], ["3500001", "3500002"])
        aneis = geo.le_caminho_svg(g["d"])
        # contorno externo + ilha de A + buraco de B; nenhum anel na divisa interna
        self.assertEqual(len(aneis), 3)
        externo = max(aneis, key=lambda a: abs(geo.area_assinada(a)))
        # da divisa interna só sobram as duas pontas (que também são cantos do contorno)
        self.assertEqual(sum(1 for p in externo if _na_divisa(p, self.proc)), 2)
        self.assertEqual(sorted(geo.area_assinada(a) > 0 for a in aneis), [False, True, True])
        # área da união = soma das áreas dos membros
        soma = sum(geo.area_assinada(a) for g2 in self.proc["geometrias"] for a in geo.aneis_da_geometria(self.proc, g2["poligonos"]))
        self.assertAlmostEqual(sum(geo.area_assinada(a) for a in aneis), soma, delta=abs(soma) * 1e-9)

    def test_sem_chave_fica_fora(self):
        grupos = geo.agrupa_por_chave(self.proc, lambda i: "X" if i.endswith("1") else None)
        self.assertEqual([(g["id"], g["membros"]) for g in grupos], [("X", ["3500001"])])

    def test_arco_solto_desenha_o_conjunto_dos_membros_sem_inventar_segmento(self):
        proc = {"arcos": [[(0, 0), (10, 0), (10, 10)], [(10, 10), (0, 10)], [(20, 20), (30, 20), (30, 30), (20, 20)]],
                "geometrias": [{"id": "a", "poligonos": [[[0, 1]]]}, {"id": "b", "poligonos": [[[2]]]}]}
        (g,) = geo.agrupa_por_chave(proc, lambda i: "k")
        self.assertFalse(g["uniao"])
        self.assertEqual(g["d"].count("M"), 2)


class RevisaoENomes(unittest.TestCase):
    def test_revisao_mais_recente_com_aspas_escapadas(self):
        html = ('releaseDate.push("23/12/2024"); releaseTxt.push("Liberada a versão 4 da API com as malhas da revisão de 2023."); '
                'releaseDate.push("27/04/2026"); releaseTxt.push("As malhas foram atualizadas com a revisão de 2025; '
                'Correção de erro no parâmetro \\"intrarregiao\\"."); releaseDate.push("29/04/2025"); '
                'releaseTxt.push("As malhas foram atualizadas com a revisão de 2024.");')
        r = geo.revisao_da_malha(html)
        self.assertEqual(r["revisao"], 2025)
        self.assertEqual(r["data_nota"], "27/04/2026")
        self.assertIn('"intrarregiao"', r["nota"])
        self.assertIsNone(geo.revisao_da_malha("<html></html>")["revisao"])

    def test_municipio_sem_microrregiao_usa_regiao_imediata(self):
        m = {"id": 5101837, "nome": "Boa Esperança do Norte", "microrregiao": None,
             "regiao-imediata": {"regiao-intermediaria": {"UF": {"sigla": "MT"}}}}
        self.assertEqual(geo.nomes_municipios([m], {"51": "MT"}), {"5101837": ("Boa Esperança do Norte", "MT")})

    def test_uf_divergente_do_codigo_e_erro(self):
        m = {"id": 5101837, "nome": "X", "regiao-imediata": {"regiao-intermediaria": {"UF": {"sigla": "GO"}}}}
        with self.assertRaises(ValueError):
            geo.nomes_municipios([m], {"51": "MT"})

    def _meta(self):
        return {"url": "u", "url_nomes": "n", "capturado_em": "2026-09-30T22:00:00Z", "sha256": "a" * 64,
                "sha256_nomes": "b" * 64, "bronze": "data/x", "revisao": {"revisao": 2025, "nota": "n", "data_nota": "27/04/2026"}}

    def test_camada_publicada(self):
        corpo = json.dumps(_topologia_sintetica()).encode()
        nomes = {"3500001": ("Alfa", "SP"), "3500002": ("Beta", "SP")}
        p = geo.gera_camada("municipios", corpo, nomes, self._meta(), siglas_uf={"35": "SP"})
        self.assertEqual([f["id"] for f in p["features"]], ["3500001", "3500002"])
        self.assertEqual(p["contagem"]["poligonos"], p["contagem"]["poligonos_origem"])
        self.assertEqual(p["malha"]["revisao"], 2025)
        self.assertEqual(p["projecao"]["paralelos_padrao"], [-2.0, -22.0])
        self.assertEqual(p["contornos"]["uf"][0]["uf"], "SP")
        x, y, w, h = (int(v) for v in p["viewBox"].split())
        for f in p["features"]:
            for anel in geo.le_caminho_svg(f["d"]):
                for px, py in anel:
                    self.assertTrue(x <= px <= x + w and y <= py <= y + h)

    def test_feature_sem_nome_impede_a_publicacao(self):
        corpo = json.dumps(_topologia_sintetica()).encode()
        with self.assertRaises(ValueError):
            geo.gera_camada("municipios", corpo, {"3500001": ("Alfa", "SP")}, self._meta())


if __name__ == "__main__":
    unittest.main()
