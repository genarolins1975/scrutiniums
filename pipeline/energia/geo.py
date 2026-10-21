"""Geometria oficial do IBGE para os mapas do Setor Elétrico (só biblioteca padrão).

Por que existe: a seção 8.3 do contrato proíbe "mapa do Brasil aproximado" como
camada analítica. Os mapas usam a malha territorial oficial do IBGE, com fonte,
revisão e hash do original, e uma cadeia de transformação que pode ser refeita:

1. baixa a malha pela API de malhas do IBGE (v4; a v3 parou na revisão de 2022,
   segundo a nota de liberação da própria documentação) em TopoJSON, o formato em
   que o IBGE já entrega as fronteiras como arcos compartilhados entre vizinhos;
2. guarda o original imutável no bronze (data/energia/bronze/ibge/malhas/), com
   sha256, e também a resposta da API de localidades usada para os nomes;
3. projeta em Albers cônica equivalente (paralelos padrão −2° e −22°, meridiano
   central −54°, latitude de origem −12°), na esfera autálica do GRS80: a área de
   cada polígono no plano é proporcional à área real, o que um mapa coroplético
   precisa para não exagerar regiões do Norte como o equiretangular faz;
4. simplifica cada ARCO uma única vez (Douglas-Peucker com tolerância em metros
   projetados): como a mesma fronteira é usada pelos dois vizinhos, eles
   continuam colados, sem fresta nem sobreposição criada pela simplificação;
5. quantiza para inteiros numa grade fixa (mesma origem e mesma grade nas duas
   camadas, para que as divisas de UF possam ser sobrepostas aos municípios) e
   escreve um caminho SVG compacto por feature em public/energia/geo/.

Nenhum polígono some: se a simplificação ou a quantização degenerariam um anel
(menos de três vértices distintos ou área nula), a tolerância dos arcos daquele
anel é reduzida até ele sobreviver, no limite com os vértices originais. Se nem
assim o anel tiver área na grade, a geração falha em vez de publicar malha sem
um município.

Uso:
    python -m pipeline.energia.geo                  # baixa e gera as duas camadas
    python -m pipeline.energia.geo --camada uf
    python -m pipeline.energia.geo --offline        # reprocessa o bronze mais recente
"""
import argparse
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

API_MALHAS = "https://servicodados.ibge.gov.br/api/v4/malhas/paises/BR"
URL_DOC_MALHAS = "https://servicodados.ibge.gov.br/api/docs/malhas?versao=4"
URL_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
URL_ESTADOS = "https://servicodados.ibge.gov.br/api/v1/localidades/estados"
DESTINO = os.path.join(base.RAIZ, "public", "energia", "geo")
ORGAO = "ibge"
DATASET = "malhas"

# ---------------------------------------------------------------------------
# Projeção: Albers cônica equivalente, esfera autálica do GRS80
# ---------------------------------------------------------------------------

# Raio da esfera de mesma área do elipsoide GRS80 (o do SIRGAS 2000). A forma esférica
# das equações de Snyder (1987, "Map Projections: A Working Manual", p. 100) preserva a
# área na esfera autálica; a diferença para a forma elipsoidal é de forma (até ~0,3% em
# distâncias locais), não de área total, e é irrelevante para um mapa coroplético.
R_AUTALICO = 6371007.181
PARALELOS_PADRAO = (-2.0, -22.0)
MERIDIANO_CENTRAL = -54.0
LATITUDE_ORIGEM = -12.0


def _constantes(p1=PARALELOS_PADRAO[0], p2=PARALELOS_PADRAO[1], lat0=LATITUDE_ORIGEM, r=R_AUTALICO):
    f1, f2, f0 = (math.radians(v) for v in (p1, p2, lat0))
    n = (math.sin(f1) + math.sin(f2)) / 2
    c = math.cos(f1) ** 2 + 2 * n * math.sin(f1)
    rho0 = r * math.sqrt(c - 2 * n * math.sin(f0)) / n
    return n, c, rho0


_N, _C, _RHO0 = _constantes()


def albers(lon, lat):
    """(lon, lat) em graus → (x, y) em metros; x para leste, y para norte, (0, 0) na origem."""
    rho = R_AUTALICO * math.sqrt(_C - 2 * _N * math.sin(math.radians(lat))) / _N
    teta = _N * math.radians(lon - MERIDIANO_CENTRAL)
    return rho * math.sin(teta), _RHO0 - rho * math.cos(teta)


def albers_inversa(x, y):
    """(x, y) em metros → (lon, lat) em graus. Com n < 0 (paralelos no hemisfério sul), ρ
    e ρ0 − y têm o sinal de n: o atan2 leva o sinal junto (Snyder, eq. 14-11)."""
    dy = _RHO0 - y
    rho = math.copysign(math.hypot(x, dy), _N)
    teta = math.atan2(x * math.copysign(1, _N), dy * math.copysign(1, _N))
    s = (_C - (rho * _N / R_AUTALICO) ** 2) / (2 * _N)
    lat = math.degrees(math.asin(max(-1.0, min(1.0, s))))
    return MERIDIANO_CENTRAL + math.degrees(teta / _N), lat


# ---------------------------------------------------------------------------
# Grade de quantização (a mesma nas duas camadas)
# ---------------------------------------------------------------------------

# Metros por unidade do SVG. 100 m é bem menor que a tolerância de simplificação das duas
# camadas e ainda deixa as coordenadas absolutas com no máximo 5 dígitos.
GRADE_M = 100
# Retângulo geográfico que contém todo o território (inclusive Trindade e Martim Vaz e o
# arquipélago de São Pedro e São Paulo). A origem da grade sai dele, não dos dados: as
# duas camadas e as próximas revisões da malha ficam no mesmo sistema de coordenadas.
QUADRO_GEOGRAFICO = (-74.5, -34.5, -28.0, 6.0)


def origem_da_grade(quadro=QUADRO_GEOGRAFICO, grade=GRADE_M):
    """Canto superior esquerdo (x mínimo, y máximo) do retângulo projetado, alinhado à grade.
    A borda do retângulo é amostrada: numa cônica, o extremo em y não fica num canto."""
    lon0, lat0, lon1, lat1 = quadro
    xs, ys = [], []
    passos = 400
    for i in range(passos + 1):
        lon = lon0 + (lon1 - lon0) * i / passos
        lat = lat0 + (lat1 - lat0) * i / passos
        for p in (albers(lon, lat0), albers(lon, lat1), albers(lon0, lat), albers(lon1, lat)):
            xs.append(p[0])
            ys.append(p[1])
    return math.floor(min(xs) / grade) * grade, math.ceil(max(ys) / grade) * grade


def quantiza(p, origem, grade=GRADE_M):
    """Metros projetados → inteiros da grade, com y para baixo (coordenada de tela do SVG)."""
    return (int(round((p[0] - origem[0]) / grade)), int(round((origem[1] - p[1]) / grade)))


# ---------------------------------------------------------------------------
# Douglas-Peucker
# ---------------------------------------------------------------------------

def _dist2_segmento(p, a, b):
    ax, ay = a
    dx, dy = b[0] - ax, b[1] - ay
    px, py = p[0] - ax, p[1] - ay
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return px * px + py * py
    t = max(0.0, min(1.0, (px * dx + py * dy) / l2))
    ex, ey = px - t * dx, py - t * dy
    return ex * ex + ey * ey


def douglas_peucker(pontos, tolerancia):
    """Simplificação de Douglas-Peucker que mantém sempre o primeiro e o último ponto.
    Iterativa (pilha), para não estourar a recursão em arcos longos."""
    n = len(pontos)
    if n <= 2 or tolerancia <= 0:
        return list(pontos)
    t2 = tolerancia * tolerancia
    manter = [False] * n
    manter[0] = manter[-1] = True
    pilha = [(0, n - 1)]
    while pilha:
        i, j = pilha.pop()
        if j <= i + 1:
            continue
        a, b = pontos[i], pontos[j]
        k_max, d_max = -1, -1.0
        for k in range(i + 1, j):
            d = _dist2_segmento(pontos[k], a, b)
            if d > d_max:
                k_max, d_max = k, d
        if d_max > t2:
            manter[k_max] = True
            pilha.append((i, k_max))
            pilha.append((k_max, j))
    return [p for p, m in zip(pontos, manter) if m]


def simplifica_arco(pontos, tolerancia):
    """Douglas-Peucker de um arco com as pontas fixas (são as junções com os vizinhos).
    Arco fechado (ilha, enclave) é partido no ponto mais distante do início: sem isso o
    segmento de referência teria comprimento zero e o anel viraria um ponto."""
    if len(pontos) > 3 and pontos[0] == pontos[-1]:
        p0 = pontos[0]
        k = max(range(1, len(pontos) - 1), key=lambda i: (pontos[i][0] - p0[0]) ** 2 + (pontos[i][1] - p0[1]) ** 2)
        return douglas_peucker(pontos[: k + 1], tolerancia)[:-1] + douglas_peucker(pontos[k:], tolerancia)
    return douglas_peucker(pontos, tolerancia)


# ---------------------------------------------------------------------------
# Anéis
# ---------------------------------------------------------------------------

def area_assinada(anel):
    """Área pelo laço de Gauss. Em coordenadas de tela (y para baixo), positivo = horário."""
    s = 0
    for (x0, y0), (x1, y1) in zip(anel, anel[1:] + anel[:1]):
        s += x0 * y1 - x1 * y0
    return s / 2


def limpa_anel(pontos):
    """Remove vértices repetidos em sequência e o fechamento explícito: [a, b, c]."""
    out = []
    for p in pontos:
        if not out or out[-1] != p:
            out.append(p)
    while len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def anel_valido(anel):
    return len(anel) >= 3 and area_assinada(anel) != 0


def fecha_anel(anel):
    """Forma fechada (primeiro ponto repetido no fim), a de GeoJSON e TopoJSON."""
    return anel + anel[:1] if anel and anel[0] != anel[-1] else list(anel)


def orienta(anel, externo):
    """Externo no sentido horário na tela e buraco no anti-horário: a mesma regra de
    preenchimento (nonzero ou evenodd) desenha buracos e enclaves corretamente."""
    a = area_assinada(anel)
    return list(reversed(anel)) if (a < 0) == externo else anel


# ---------------------------------------------------------------------------
# Caminho SVG compacto
# ---------------------------------------------------------------------------

def _par(dx, dy):
    # o sinal de menos já separa os números no caminho SVG: "3-4" são dois números
    return f"{dx}{'' if dy < 0 else ' '}{dy}"


def caminho_svg(aneis):
    """Anéis quantizados (sem fechamento explícito) → "M x y l dx dy ... z" por anel."""
    partes = []
    for anel in aneis:
        x0, y0 = anel[0]
        s = [f"M{x0} {y0}"]
        passos = []
        for (xa, ya), (xb, yb) in zip(anel, anel[1:]):
            passos.append(_par(xb - xa, yb - ya))
        if passos:
            corpo = passos[0]
            for p in passos[1:]:
                corpo += p if p.startswith("-") else " " + p
            s.append("l" + corpo)
        s.append("z")
        partes.append("".join(s))
    return "".join(partes)


def le_caminho_svg(d):
    """Inverso de caminho_svg (para testes e conferência): lista de anéis de inteiros."""
    aneis = []
    for m in re.finditer(r"M(-?\d+) (-?\d+)(?:l([^z]*))?z", d):
        x, y = int(m.group(1)), int(m.group(2))
        anel = [(x, y)]
        nums = [int(v) for v in re.findall(r"-?\d+", m.group(3) or "")]
        for dx, dy in zip(nums[::2], nums[1::2]):
            x, y = x + dx, y + dy
            anel.append((x, y))
        aneis.append(anel)
    return aneis


# ---------------------------------------------------------------------------
# TopoJSON
# ---------------------------------------------------------------------------

def decodifica_topologia(topo):
    """TopoJSON → arcos em (lon, lat) absolutos e geometrias como listas de polígonos,
    cada polígono uma lista de anéis, cada anel uma lista de índices de arco (o índice
    negativo ~i é o arco i percorrido ao contrário, como na especificação)."""
    tr = topo.get("transform")
    arcos = []
    for arco in topo["arcs"]:
        if tr:
            (sx, sy), (tx, ty) = tr["scale"], tr["translate"]
            x = y = 0
            pts = []
            for dx, dy in arco:
                x += dx
                y += dy
                pts.append((x * sx + tx, y * sy + ty))
        else:
            pts = [(float(p[0]), float(p[1])) for p in arco]
        arcos.append(pts)
    objetos = {}
    for nome, obj in topo["objects"].items():
        geoms = obj["geometries"] if obj.get("type") == "GeometryCollection" else [obj]
        itens = []
        for g in geoms:
            props = g.get("properties") or {}
            gid = str(props.get("codarea", g.get("id", "")))
            if g["type"] == "Polygon":
                poligonos = [g["arcs"]]
            elif g["type"] == "MultiPolygon":
                poligonos = g["arcs"]
            else:
                continue  # pontos e linhas não fazem parte de malha de área
            itens.append({"id": gid, "poligonos": poligonos})
        objetos[nome] = itens
    return {"arcos": arcos, "objetos": objetos}


def _arco(arcos, k):
    return arcos[k] if k >= 0 else arcos[~k][::-1]


def monta_anel(indices, arcos):
    """Concatena os arcos de um anel; o primeiro ponto de cada arco seguinte repete o
    último do anterior e é descartado."""
    pts = []
    for k in indices:
        a = _arco(arcos, k)
        pts.extend(a if not pts else a[1:])
    return pts


def processa_topologia(dec, tolerancia_m, grade=GRADE_M, origem=None):
    """Projeta, simplifica por arco, quantiza e garante que nenhum anel degenere.

    Retorna {"arcos": arcos quantizados, "geometrias": [{id, poligonos}], "tolerancias":
    tolerância final por arco, "reduzidos": nº de arcos que precisaram de tolerância menor}.
    Lança ValueError se um anel não sobrevive nem com os vértices originais."""
    origem = origem or origem_da_grade(grade=grade)
    projetados = [[albers(lon, lat) for lon, lat in arco] for arco in dec["arcos"]]
    tol = [float(tolerancia_m)] * len(projetados)
    cache = {}

    def arco_q(k):
        chave = (k, tol[k])
        if chave not in cache:
            simpl = simplifica_arco(projetados[k], tol[k])
            q = []
            for p in simpl:
                pq = quantiza(p, origem, grade)
                if not q or q[-1] != pq:
                    q.append(pq)
            if len(q) == 1 and len(simpl) > 1:
                q.append(q[0])  # arco menor que a grade: as duas pontas coincidem
            cache[chave] = q
        return cache[chave]

    geometrias = [g for itens in dec["objetos"].values() for g in itens]
    aneis = [(g["id"], ai) for g in geometrias for pol in g["poligonos"] for ai in pol]
    reduzidos = set()
    pendentes = aneis
    acesso = _ArcosQ(arco_q)
    for _ in range(40):
        ruins = []
        for gid, indices in pendentes:
            pts = limpa_anel(monta_anel(indices, acesso))
            if not anel_valido(pts):
                ruins.append((gid, indices))
        if not ruins:
            break
        mudou = False
        for _, indices in ruins:
            for k in indices:
                i = k if k >= 0 else ~k
                if tol[i] > 0:
                    # um quarto da tolerância por rodada; abaixo de meia grade, vértices originais
                    tol[i] = tol[i] / 4 if tol[i] / 4 >= grade / 2 else 0.0
                    reduzidos.add(i)
                    mudou = True
        if not mudou:
            ids = sorted({gid for gid, _ in ruins})
            raise ValueError(f"anel degenerado mesmo sem simplificação na grade de {grade} m: {ids[:10]}")
        pendentes = ruins
    else:
        raise ValueError("simplificação não convergiu")
    # conferência final de todos os anéis: reduzir a tolerância de um arco muda também o
    # vizinho que o compartilha
    ruins = [gid for gid, indices in aneis if not anel_valido(limpa_anel(monta_anel(indices, acesso)))]
    if ruins:
        raise ValueError(f"anéis degenerados após a simplificação: {sorted(set(ruins))[:10]}")
    arcos_q = [arco_q(k) for k in range(len(projetados))]
    return {"arcos": arcos_q, "geometrias": geometrias, "tolerancias": tol, "reduzidos": len(reduzidos),
            "origem": origem, "grade": grade}


class _ArcosQ:
    """Acesso indexado aos arcos quantizados sob demanda (monta_anel usa arcos[k])."""

    def __init__(self, f):
        self.f = f

    def __getitem__(self, k):
        return self.f(k)


def aneis_da_geometria(proc, poligonos):
    """Anéis quantizados e orientados de uma geometria (primeiro anel de cada polígono é o
    externo). Mantém a contagem: um anel por anel de origem."""
    out = []
    for pol in poligonos:
        for j, indices in enumerate(pol):
            anel = limpa_anel(monta_anel(indices, proc["arcos"]))
            out.append(orienta(anel, externo=(j == 0)))
    return out


def caixa(aneis):
    xs = [x for a in aneis for x, _ in a]
    ys = [y for a in aneis for _, y in a]
    return min(xs), min(ys), max(xs), max(ys)


# ---------------------------------------------------------------------------
# Dissolver / agrupar por chave
# ---------------------------------------------------------------------------

def agrupa_por_chave(proc, chave_de, nome_de=None):
    """Agrupa features por uma chave (ex.: municípios de uma área de concessão) sem
    inventar geometria.

    Com a topologia, a união é exata: um arco usado por dois membros do mesmo grupo é
    fronteira interna e sai; os arcos restantes são encadeados em anéis. Quando o
    encadeamento não fecha (topologia inconsistente, arco solto), o grupo é desenhado
    como o conjunto dos polígonos membros, com a mesma classe e o mesmo contorno, e fica
    marcado com "uniao": False. Membros sem chave (None) não entram em grupo nenhum.

    Retorna [{id, nome, membros, d, uniao}] em ordem de chave."""
    grupos = {}
    for g in proc["geometrias"]:
        k = chave_de(g["id"])
        if k is None:
            continue
        grupos.setdefault(str(k), []).append(g)
    saida = []
    for k in sorted(grupos):
        membros = grupos[k]
        uso = {}
        for g in membros:
            for anel in _indices_orientados(proc, g["poligonos"]):
                for a in anel:
                    i = a if a >= 0 else ~a
                    uso.setdefault(i, []).append(a)
        # com os anéis orientados (externo horário, buraco anti-horário), dois membros
        # vizinhos percorrem a divisa em sentidos opostos: arco usado duas vezes no grupo
        # é divisa interna e sai
        restantes = [usos[0] for usos in uso.values() if len(usos) == 1]
        aneis = _encadeia(restantes, proc["arcos"])
        if aneis is None:
            aneis = [a for g in membros for a in aneis_da_geometria(proc, g["poligonos"])]
            uniao = False
        else:
            uniao = True
        saida.append({
            "id": k,
            "nome": nome_de(k) if nome_de else k,
            "membros": sorted(g["id"] for g in membros),
            "d": caminho_svg(aneis),
            "uniao": uniao,
        })
    return saida


def _indices_orientados(proc, poligonos):
    """Anéis como índices de arco, reorientados como em aneis_da_geometria (o primeiro de
    cada polígono é externo e horário; os demais, buracos anti-horários). Não depende da
    convenção de sentido da origem."""
    for pol in poligonos:
        for j, indices in enumerate(pol):
            a = area_assinada(limpa_anel(monta_anel(indices, proc["arcos"])))
            yield indices if (a > 0) == (j == 0) else [~k for k in reversed(indices)]


def _encadeia(indices, arcos):
    """Encadeia arcos orientados em anéis fechados, pelo ponto final de um e inicial do
    outro. None se algum arco ficar solto (nunca fecha um anel com segmento inventado)."""
    por_inicio = {}
    for a in indices:
        pts = _arco(arcos, a)
        por_inicio.setdefault(pts[0], []).append(a)
    usados = set()
    aneis = []
    for a0 in indices:
        if a0 in usados:
            continue
        anel_idx = [a0]
        usados.add(a0)
        inicio = _arco(arcos, a0)[0]
        fim = _arco(arcos, a0)[-1]
        while fim != inicio:
            prox = next((b for b in por_inicio.get(fim, []) if b not in usados), None)
            if prox is None:
                return None
            anel_idx.append(prox)
            usados.add(prox)
            fim = _arco(arcos, prox)[-1]
        anel = limpa_anel(monta_anel(anel_idx, arcos))
        if len(anel) >= 3:
            # herda o sentido dos membros: horário é contorno externo, anti-horário é buraco
            aneis.append(anel)
    return aneis


# ---------------------------------------------------------------------------
# Revisão da malha e nomes
# ---------------------------------------------------------------------------

def revisao_da_malha(html):
    """Revisão mais recente declarada nas notas de liberação da documentação da API v4
    (a v4 não tem parâmetro de período: serve sempre a revisão vigente). Retorna
    {"revisao": ano ou None, "nota": texto, "data_nota": "DD/MM/AAAA" ou None}."""
    # as notas vêm como literais de JavaScript: push("texto"), com aspas internas escapadas
    melhor = None
    data = None
    for m in re.finditer(r'push\("((?:[^"\\]|\\.)*)"\)', html):
        texto = m.group(1).replace('\\"', '"')
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", texto):
            data = texto
            continue
        r = re.search(r"revis[ãa]o de (\d{4})", texto)
        if r and (melhor is None or int(r.group(1)) > melhor["revisao"]):
            melhor = {"revisao": int(r.group(1)), "nota": texto, "data_nota": data}
    return melhor or {"revisao": None, "nota": "revisão não declarada na documentação consultada", "data_nota": None}


def uf_do_municipio(m):
    """Sigla da UF na resposta da API de localidades; municípios recentes vêm sem
    microrregião (ex.: Boa Esperança do Norte, MT), então a região imediata é o caminho
    principal."""
    for caminho in (("regiao-imediata", "regiao-intermediaria", "UF"), ("microrregiao", "mesorregiao", "UF")):
        v = m
        for c in caminho:
            v = v.get(c) if isinstance(v, dict) else None
        if isinstance(v, dict) and v.get("sigla"):
            return v["sigla"]
    return None


def nomes_municipios(lista, siglas_por_codigo):
    """{código: (nome, uf)} a partir da API de localidades. A UF é conferida com o prefixo
    do código IBGE (dois primeiros dígitos)."""
    out = {}
    for m in lista:
        cod = str(m["id"])
        uf = uf_do_municipio(m) or siglas_por_codigo.get(cod[:2])
        if siglas_por_codigo and siglas_por_codigo.get(cod[:2]) != uf:
            raise ValueError(f"UF de {cod} diverge do prefixo do código: {uf} x {siglas_por_codigo.get(cod[:2])}")
        out[cod] = (m["nome"], uf)
    return out


# ---------------------------------------------------------------------------
# Camadas
# ---------------------------------------------------------------------------

CAMADAS = {
    "uf": {
        "titulo": "Unidades da Federação",
        "intrarregiao": "UF",
        "qualidade": "intermediaria",
        # 1 km: invisível no mapa do país inteiro e ainda fiel com zoom de 8x
        "tolerancia_m": 1000,
        "arquivo": "uf.json",
    },
    "municipios": {
        "titulo": "Municípios",
        "intrarregiao": "municipio",
        "qualidade": "minima",
        # a qualidade "minima" do IBGE já é generalizada; 400 m tira pouco e não deforma
        "tolerancia_m": 400,
        "arquivo": "municipios.json",
        # divisas de UF obtidas pela união exata dos municípios (mesmos arcos): sobrepostas
        # ao mapa municipal, coincidem com as bordas dos municípios em qualquer zoom
        "contornos_uf": True,
    },
}


def url_malha(intrarregiao, qualidade):
    return f"{API_MALHAS}?formato=application/json&intrarregiao={intrarregiao}&qualidade={qualidade}"


def gera_camada(nome, topo_bytes, nomes, meta, tolerancia_m=None, grade=GRADE_M, siglas_uf=None):
    """Monta o JSON publicado de uma camada. `nomes` = {id: (nome, uf)}; id sem nome é erro:
    a malha nunca é publicada com um território sem identificação."""
    cfg = CAMADAS[nome]
    tol = cfg["tolerancia_m"] if tolerancia_m is None else tolerancia_m
    dec = decodifica_topologia(json.loads(topo_bytes.decode("utf-8")))
    proc = processa_topologia(dec, tol, grade=grade)
    features = []
    n_pol = n_aneis = 0
    faltando = [g["id"] for g in proc["geometrias"] if g["id"] not in nomes]
    if faltando:
        raise ValueError(f"{len(faltando)} feature(s) sem nome na API de localidades: {faltando[:10]}")
    x0 = y0 = math.inf
    x1 = y1 = -math.inf
    for g in sorted(proc["geometrias"], key=lambda g: g["id"]):
        aneis = aneis_da_geometria(proc, g["poligonos"])
        bx0, by0, bx1, by1 = caixa(aneis)
        x0, y0, x1, y1 = min(x0, bx0), min(y0, by0), max(x1, bx1), max(y1, by1)
        n_pol += len(g["poligonos"])
        n_aneis += len(aneis)
        nm, uf = nomes[g["id"]]
        features.append({"id": g["id"], "nome": nm, "uf": uf, "d": caminho_svg(aneis)})
    sem_geometria = sorted(set(nomes) - {g["id"] for g in proc["geometrias"]})
    extra = {}
    if cfg.get("contornos_uf"):
        grupos = agrupa_por_chave(proc, lambda i: i[:2], nome_de=lambda k: siglas_uf.get(k, k) if siglas_uf else k)
        # contorno só com união exata: o conjunto dos membros desenharia todas as divisas municipais
        if grupos and all(g["uniao"] for g in grupos):
            extra["contornos"] = {"uf": [{"id": g["id"], "uf": g["nome"], "d": g["d"]} for g in grupos]}
    n_pol_origem = sum(len(g["poligonos"]) for g in proc["geometrias"])
    if n_pol != n_pol_origem:
        raise ValueError(f"polígonos perdidos na geração: {n_pol_origem} na origem, {n_pol} publicados")
    return {
        "camada": nome,
        "titulo": cfg["titulo"],
        "fonte": "IBGE, API de malhas territoriais (v4) e API de localidades (v1)",
        "url": meta["url"],
        "url_nomes": meta["url_nomes"],
        "capturado_em": meta["capturado_em"],
        "sha256": meta["sha256"],
        "sha256_nomes": meta["sha256_nomes"],
        "bronze": meta["bronze"],
        "malha": {
            "revisao": meta["revisao"]["revisao"],
            "nota_liberacao": meta["revisao"]["nota"],
            "data_nota": meta["revisao"]["data_nota"],
            "documentacao": URL_DOC_MALHAS,
            "qualidade": cfg["qualidade"],
            "formato_original": "TopoJSON (formato=application/json), fronteiras como arcos compartilhados",
        },
        "projecao": {
            "nome": "Albers cônica equivalente",
            "paralelos_padrao": list(PARALELOS_PADRAO),
            "meridiano_central": MERIDIANO_CENTRAL,
            "latitude_origem": LATITUDE_ORIGEM,
            "superficie": f"esfera autálica do GRS80 (R = {R_AUTALICO} m); coordenadas de entrada em SIRGAS 2000",
            "unidade_svg_m": grade,
            "origem_m": [proc["origem"][0], proc["origem"][1]],
            "eixo_y": "para baixo (coordenada de tela do SVG)",
        },
        "simplificacao": {
            "metodo": "Douglas-Peucker por arco compartilhado (vizinhos continuam colados), pontas dos arcos fixas",
            "tolerancia_m": tol,
            "arcos_com_tolerancia_reduzida": proc["reduzidos"],
            "garantia": "nenhum polígono é descartado; anel que degeneraria recebe tolerância menor",
        },
        "viewBox": f"{x0} {y0} {x1 - x0} {y1 - y0}",
        "contagem": {"features": len(features), "poligonos": n_pol, "poligonos_origem": n_pol_origem, "aneis": n_aneis},
        "conciliacao": {"nomes_sem_geometria": sem_geometria},
        **extra,
        "features": features,
    }


def escreve_camada(payload, destino=DESTINO):
    """Uma feature por linha: diffs legíveis entre revisões, custo de um byte por feature."""
    os.makedirs(destino, exist_ok=True)
    cab = {k: v for k, v in payload.items() if k != "features"}
    corpo = json.dumps(cab, ensure_ascii=False, separators=(",", ":"))[:-1]
    linhas = [json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in payload["features"]]
    texto = corpo + ',"features":[\n' + ",\n".join(linhas) + "\n]}\n"
    caminho = os.path.join(destino, CAMADAS[payload["camada"]]["arquivo"])
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, caminho)
    return caminho, len(texto.encode("utf-8"))


def _baixa_ou_bronze(recurso, url, ext, offline, capturado):
    """Baixa e guarda no bronze; offline, reusa o arquivo mais recente do bronze."""
    if offline:
        pasta = os.path.join(base.BRONZE, ORGAO, DATASET, recurso)
        arquivos = sorted(n for n in os.listdir(pasta) if n.endswith(".gz"))
        if not arquivos:
            raise FileNotFoundError(f"sem bronze para {recurso}")
        rel = os.path.relpath(os.path.join(pasta, arquivos[-1]), base.RAIZ)
        with base.abre_bronze(rel) as f:
            corpo = f.read()
        carimbo = arquivos[-1].split(".")[0]
        quando = f"{carimbo[:4]}-{carimbo[4:6]}-{carimbo[6:11]}:{carimbo[11:13]}:{carimbo[13:]}"
        return corpo, rel, base.sha256_bytes(corpo), quando
    corpo, _ = http_get(url, timeout=120, accept="*/*" if ext == "html" else "application/json")
    rel, sha = base.salva_bronze(ORGAO, DATASET, recurso, corpo, ext, capturado)
    return corpo, rel, sha, capturado


def executa(camadas=("uf", "municipios"), offline=False, destino=DESTINO):
    capturado = base.agora_utc()
    doc, _, _, _ = _baixa_ou_bronze("documentacao-v4", URL_DOC_MALHAS, "html", offline, capturado)
    revisao = revisao_da_malha(doc.decode("utf-8", errors="replace"))
    estados_b, _, _, _ = _baixa_ou_bronze("localidades-estados", URL_ESTADOS, "json", offline, capturado)
    estados = json.loads(estados_b.decode("utf-8"))
    siglas = {str(e["id"]): e["sigla"] for e in estados}
    resultado = {}
    for nome in camadas:
        cfg = CAMADAS[nome]
        url = url_malha(cfg["intrarregiao"], cfg["qualidade"])
        topo, rel, sha, quando = _baixa_ou_bronze(f"br-{cfg['intrarregiao'].lower()}-{cfg['qualidade']}", url, "topojson",
                                                  offline, capturado)
        if nome == "uf":
            nomes = {str(e["id"]): (e["nome"], e["sigla"]) for e in estados}
            url_nomes, sha_nomes = URL_ESTADOS, base.sha256_bytes(estados_b)
        else:
            mun_b, _, sha_nomes, _ = _baixa_ou_bronze("localidades-municipios", URL_MUNICIPIOS, "json", offline, capturado)
            nomes = nomes_municipios(json.loads(mun_b.decode("utf-8")), siglas)
            url_nomes = URL_MUNICIPIOS
        meta = {"url": url, "url_nomes": url_nomes, "capturado_em": quando, "sha256": sha, "sha256_nomes": sha_nomes,
                "bronze": rel.replace(os.sep, "/"), "revisao": revisao}
        payload = gera_camada(nome, topo, nomes, meta, siglas_uf=siglas)
        caminho, nbytes = escreve_camada(payload, destino)
        resultado[nome] = {"arquivo": os.path.relpath(caminho, base.RAIZ), "bytes": nbytes, **payload["contagem"],
                           "revisao": revisao["revisao"], "reduzidos": payload["simplificacao"]["arcos_com_tolerancia_reduzida"]}
    return resultado


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--camada", choices=["uf", "municipios", "todas"], default="todas")
    ap.add_argument("--offline", action="store_true", help="reprocessa o bronze mais recente, sem rede")
    a = ap.parse_args(argv)
    camadas = ("uf", "municipios") if a.camada == "todas" else (a.camada,)
    for nome, r in executa(camadas, offline=a.offline).items():
        print(f"{nome}: {r['arquivo']} {r['bytes'] / 1024:.0f} KB, {r['features']} features, "
              f"{r['poligonos']} polígonos, revisão {r['revisao']}, {r['reduzidos']} arcos com tolerância reduzida")


if __name__ == "__main__":
    main()
