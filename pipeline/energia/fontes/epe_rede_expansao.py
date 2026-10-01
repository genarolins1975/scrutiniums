"""Linhas de transmissão do WebMap da EPE (camadas oficiais do serviço ArcGIS
`SMA/WMS_Webmap_EPE`), usadas no módulo Expansão para territorializar a rede (P042).

Por que esta fonte: a geometria das linhas no SIGEL da ANEEL não respondeu (conexão
encerrada pelo servidor em 30/09 e 01/10/2026), e o SIGET não tem coordenadas. O WebMap
da EPE publica, no mesmo serviço do mapa interativo do planejamento, duas camadas de
polilinhas: 21 "Linhas de Transmissão - Base Existente" (Nome, Ano_Opera, Concession,
Tensao, Extensao) e 10 "Linhas de Transmissão - Expansão Planejada" (Nome, Ano_Planej,
Tensao, Extensao, Concession). A consulta é a interface pública do serviço (`/query`,
GeoJSON, paginação de 2.000 feições), sem autenticação e sem contornar nada.

Convenções verificadas em 01/10/2026 (e não presumidas):
- `Extensao` (km) da camada planejada não é confiável: a soma dá 1.204.090 km para 437
  linhas, porque parte das feições traz valor fora de escala. O comprimento publicado
  é o da geometria (geodésico, esfera de raio médio), e o campo da fonte é conferido
  contra ele, feição por feição;
- ano 0 é marcador de "sem ano" nas duas camadas (Ano_Opera e Ano_Planej);
- o serviço não informa data de atualização das camadas (sem editingInfo nem
  metadado de item): a data do dado é desconhecida; publica-se a data de captura e o
  ano mais recente presente na camada existente;
- a geometria é pedida já generalizada pelo próprio servidor (maxAllowableOffset de
  0,005 grau, cerca de 550 m; 4 casas decimais), o que mantém o arquivo do mapa
  pequeno e muda o comprimento de cada linha em menos de 1% (conferido).

Funções puras sobre os bytes já capturados (bronze): não fazem rede.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import geo  # noqa: E402

SERVICO = "https://gisepeprd2.epe.gov.br/arcgis/rest/services/SMA/WMS_Webmap_EPE/MapServer"
URL_WEBMAP = "https://gisepeprd2.epe.gov.br/WebMapEPE/"
CAMADAS = {
    "existente": {"id": 21, "titulo": "Linhas de Transmissão - Base Existente", "campo_ano": "Ano_Opera"},
    "planejada": {"id": 10, "titulo": "Linhas de Transmissão - Expansão Planejada", "campo_ano": "Ano_Planej"},
}
PAGINA = 2000
GENERALIZACAO_GRAU = 0.005
CASAS = 4
R_MEDIO_KM = 6371.0088
# Extensão plausível de um circuito: o bipolo Xingu × Terminal Rio, o mais longo do
# SIN, tem 2.539 km (SIGET); acima de 3.000 km o campo da fonte é tratado como erro.
LIMITE_KM = 3000.0


def url_consulta(camada, offset):
    """URL da página `offset` da camada (GeoJSON, geometria generalizada pelo servidor)."""
    cid = CAMADAS[camada]["id"]
    return (f"{SERVICO}/{cid}/query?where=1%3D1&outFields=*&returnGeometry=true"
            f"&maxAllowableOffset={GENERALIZACAO_GRAU}&geometryPrecision={CASAS}&outSR=4674"
            f"&orderByFields=OBJECTID&resultOffset={offset}&resultRecordCount={PAGINA}&f=geojson")


def url_contagem(camada):
    return f"{SERVICO}/{CAMADAS[camada]['id']}/query?where=1%3D1&returnCountOnly=true&f=json"


def le_paginas(paginas):
    """Lista de bytes (páginas GeoJSON de uma camada) → feições únicas por OBJECTID."""
    vistos, out = set(), []
    for corpo in paginas:
        d = json.loads(corpo)
        for f in d.get("features") or []:
            oid = f.get("id") if f.get("id") is not None else (f.get("properties") or {}).get("OBJECTID")
            if oid in vistos:
                continue
            vistos.add(oid)
            out.append(f)
    return out


def _linhas(geom):
    if not geom:
        return []
    if geom.get("type") == "LineString":
        return [geom.get("coordinates") or []]
    if geom.get("type") == "MultiLineString":
        return geom.get("coordinates") or []
    return []


def haversine_km(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * R_MEDIO_KM * math.asin(min(1.0, math.sqrt(h)))


def comprimento_km(geom):
    return sum(haversine_km(p, q) for ln in _linhas(geom) for p, q in zip(ln, ln[1:]))


def _texto(v):
    s = str(v).strip() if v is not None else ""
    return s or None


def _num(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def normaliza(feicoes, camada):
    """Feições GeoJSON → registros {objectid, nome, ano, tensao_kv, agente,
    extensao_fonte_km, km_geometria, geom}. Ano 0 vira ausência."""
    campo_ano = CAMADAS[camada]["campo_ano"]
    out = []
    for f in feicoes:
        p = f.get("properties") or {}
        ano = _num(p.get(campo_ano))
        out.append({
            "objectid": p.get("OBJECTID", f.get("id")), "nome": _texto(p.get("Nome")),
            "ano": int(ano) if ano and ano > 0 else None, "tensao_kv": _num(p.get("Tensao")),
            "agente": _texto(p.get("Concession")), "extensao_fonte_km": _num(p.get("Extensao")),
            "km_geometria": comprimento_km(f.get("geometry")), "geom": f.get("geometry"),
        })
    return out


class LocalizadorUF:
    """Ponto (lon, lat) → UF pela malha publicada em public/energia/geo/uf.json (IBGE,
    Albers na grade de 100 m, simplificada a 1 km): ponto em polígono com a regra par
    ou ímpar sobre todos os anéis da UF (furos incluídos)."""

    def __init__(self, camada_uf):
        self.origem = tuple(camada_uf["projecao"]["origem_m"])
        self.grade = camada_uf["projecao"]["unidade_svg_m"]
        self.ufs = []
        for f in camada_uf["features"]:
            aneis = geo.le_caminho_svg(f["d"])
            xs = [p[0] for a in aneis for p in a]
            ys = [p[1] for a in aneis for p in a]
            self.ufs.append((f["uf"], aneis, (min(xs), min(ys), max(xs), max(ys))))

    def svg(self, lon, lat):
        x, y = geo.albers(lon, lat)
        return ((x - self.origem[0]) / self.grade, (self.origem[1] - y) / self.grade)

    def uf(self, lon, lat):
        px, py = self.svg(lon, lat)
        for sigla, aneis, (x0, y0, x1, y1) in self.ufs:
            if not (x0 <= px <= x1 and y0 <= py <= y1):
                continue
            dentro = False
            for anel in aneis:
                for (ax_, ay), (bx, by) in zip(anel, anel[1:] + anel[:1]):
                    if (ay > py) != (by > py) and px < (bx - ax_) * (py - ay) / (by - ay) + ax_:
                        dentro = not dentro
            if dentro:
                return sigla
        return None


def km_por_uf(registros, localizador):
    """Comprimento da geometria por UF: cada segmento vai para a UF do seu ponto médio.
    Segmento com ponto médio fora de toda UF (mar, exterior ou fresta da malha
    simplificada) fica em None, contado à parte."""
    out = {}
    for r in registros:
        for ln in _linhas(r["geom"]):
            for p, q in zip(ln, ln[1:]):
                uf = localizador.uf((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
                out[uf] = out.get(uf, 0.0) + haversine_km(p, q)
    return out


def caminho_svg(geom, localizador):
    """Geometria → caminho SVG relativo na grade da malha de UF ('M x y l dx dy ...'), para
    sobrepor as linhas ao mapa sem reprojetar no navegador. Vértices que caem na mesma
    célula de 100 m são unidos."""
    partes = []
    for ln in _linhas(geom):
        pts = []
        for lon, lat in ln:
            x, y = localizador.svg(lon, lat)
            q = (int(round(x)), int(round(y)))
            if not pts or q != pts[-1]:
                pts.append(q)
        if len(pts) < 2:
            continue
        rel = " ".join(f"{b[0] - a[0]} {b[1] - a[1]}" for a, b in zip(pts, pts[1:]))
        partes.append(f"M{pts[0][0]} {pts[0][1]}l{rel}")
    return "".join(partes)
