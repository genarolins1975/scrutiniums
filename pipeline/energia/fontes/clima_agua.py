"""Clima do módulo Água e clima: precipitação por bacia e temperatura por subsistema.

Decisão de fonte (evidências em docs/observatorios/energia/modulos/agua.md, seção 2):
- INMET (portal, BDMEP e API) não respondeu em 30/09/2026 (resposta vazia do servidor);
- ANA (HidroWeb e telemetria) responde, mas só tem chuva e nível por estação, sem
  temperatura, e a série consistida chega com anos de atraso;
- a precipitação diária por estação do próprio ONS foi descontinuada em 2021 ("o ONS
  passou a utilizar a precipitação por satélite"); serve para conferência;
- ERA5 pelo Open-Meteo recusou a coleta por limite diário de requisições do endereço
  compartilhado ("Daily API request limit exceeded");
- NASA POWER (Langley) responde e entrega, por ponto e sem chave: IMERG (GPM, satélite
  calibrado por pluviômetros na versão Final, 0,1°) para a chuva e MERRA-2/GEOS-IT
  (reanálise, 0,5° × 0,625°) para a temperatura.

Nada disso é observação de estação: a chuva é ESTIMADA por satélite e a temperatura é
ESTIMADA por reanálise. A agregação espacial é explícita:
- chuva: média, ponderada pela área (cosseno da latitude), de pontos numa grade
  regular dentro de cada polígono de bacia do ONS (Contornos das Bacias
  Hidrográficas); grade de 1°, adensada para 0,5° ou 0,25° em bacias pequenas até
  haver ao menos MIN_PONTOS pontos;
- temperatura: por unidade da federação, média das células MERRA-2 mais populosas
  (sedes municipais do IBGE, população do Censo 2022) até cobrir metade da população
  do estado; por subsistema, média dos estados ponderada pela população.

Nenhum valor ausente vira zero: o POWER marca ausência com -999, que aqui vira None.
"""
import json
import math
import os
import struct
import sys
import zipfile
import io
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base  # noqa: E402

POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_DOCS = "https://power.larc.nasa.gov/docs/methodology/data/sources/"
POWER_REF = "https://power.larc.nasa.gov/docs/referencing/"
PRECIP_INICIO = "2001-01-01"   # início do IMERG no POWER
TEMP_INICIO = "2001-01-01"     # mesmo início, para anomalias com a mesma base
FILL = -999.0
MIN_PONTOS = 5
PASSOS = (1.0, 0.5, 0.25)
# MERRA-2: grade de 0,5° em latitude por 0,625° em longitude (centros em múltiplos)
MERRA_DLAT, MERRA_DLON = 0.5, 0.625
COBERTURA_UF = 0.5
MAX_CELULAS_UF = 6

# Polígonos do shapefile do ONS → bacia hidroenergética dos conjuntos de EAR e ENA. O
# shapefile separa em sub-bacias o que os conjuntos agrupam (AMAZONAS, PARAGUAI, JACUI);
# a correspondência segue o cadastro de reservatórios do ONS (rio e bacia de cada usina).
BACIA_ONS = {
    "PARNAIBA": "PARNAIBA", "CORRENTES": "PARAGUAI", "ITAJAI-ACU": "ITAJAI", "TAPAJOS": "AMAZONAS",
    "XINGU": "AMAZONAS", "GRANDE": "GRANDE", "IGUACU": "IGUACU", "MADEIRA": "AMAZONAS", "PARANA": "PARANA",
    "PARANAIBA": "PARANAIBA", "PARANAPANEMA": "PARANAPANEMA", "SAO FRANCISCO": "SAO FRANCISCO",
    "TIETE": "TIETE", "TOCANTINS": "TOCANTINS", "URUGUAI": "URUGUAI", "ANTAS": "JACUI", "MANSO": "PARAGUAI",
    "UATUAMA": "AMAZONAS", "CAPIVARI": "CAPIVARI", "ARAGUARI": "ARAGUARI", "CURUA-UNA": "AMAZONAS",
    "DOCE": "DOCE", "JACUI": "JACUI", "ITABAPOANA": "ITABAPOANA", "ITIQUIRA": "PARAGUAI", "JAURU": "PARAGUAI",
    "MUCURI": "MUCURI", "PARAGUACU": "PARAGUACU", "JEQUITINHONHA": "JEQUITINHONHA", "JARI": "AMAZONAS",
    "PARAIBA DO SUL": "PARAIBA DO SUL",
}

# Unidade da federação → subsistema, conferida contra a carga verificada do ONS por área
# geoelétrica (apicarga.ons.org.br, 10/08/2026): a soma das áreas de cada lista mais as
# perdas do subsistema reproduz a carga do subsistema (SE/CO e S exatos; N com 0,2 MWmed
# e NE com 7,8 MWmed de diferença na média do dia). A área TOCO (Tocantins no SE/CO)
# teve carga zero no dia; o Tocantins entra no Norte pela área TON.
UF_SUBSISTEMA = {
    "SP": "SE", "RJ": "SE", "ES": "SE", "MG": "SE", "GO": "SE", "DF": "SE", "MT": "SE", "MS": "SE",
    "AC": "SE", "RO": "SE",
    "PR": "S", "SC": "S", "RS": "S",
    "BA": "NE", "SE": "NE", "AL": "NE", "PE": "NE", "PB": "NE", "RN": "NE", "CE": "NE", "PI": "NE",
    "PA": "N", "MA": "N", "AM": "N", "AP": "N", "RR": "N", "TO": "N",
}
AREAS_CARGA = {
    "SE": ["SP", "RJ", "ES", "MG", "GO", "DF", "MT", "MS", "AC", "RO", "TOCO", "PESE"],
    "S": ["PR", "SC", "RS", "PES"],
    "NE": ["BASE", "BAOE", "PI", "CE", "PBRN", "ALPE", "PENE"],
    "N": ["PA", "MA", "AM", "AP", "RR", "TON", "PEN"],
}
COD_AREA_SUBSISTEMA = {"SE": "SECO", "S": "S", "NE": "NE", "N": "N"}


def sem_acento(s):
    import unicodedata
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper().strip()


# ---------------------------------------------------------------- shapefile e dbf (sem bibliotecas)

def le_dbf(dados, filtro=None):
    """Registros de um .dbf (bytes). `filtro(row)` descarta cedo o que não interessa."""
    n = struct.unpack("<I", dados[4:8])[0]
    hl = struct.unpack("<H", dados[8:10])[0]
    rl = struct.unpack("<H", dados[10:12])[0]
    campos, i = [], 32
    while dados[i] != 0x0D:
        campos.append((dados[i:i + 11].split(b"\0")[0].decode("latin-1"), dados[i + 16]))
        i += 32
    out = []
    for k in range(n):
        rec = dados[hl + k * rl: hl + (k + 1) * rl]
        if not rec or rec[0:1] == b"*":
            continue
        p, row = 1, {}
        for nome_c, tam in campos:
            row[nome_c] = rec[p:p + tam].decode("utf-8", "replace").strip()
            p += tam
        if filtro is None or filtro(row):
            out.append(row)
    return out


def le_poligonos(dados_shp):
    """[(bbox, anéis)] de um .shp de polígonos (tipo 5), na ordem dos registros."""
    tipo = struct.unpack("<i", dados_shp[32:36])[0]
    if tipo != 5:
        raise ValueError(f"shapefile de tipo {tipo}, esperado 5 (polígono)")
    pos, out = 100, []
    while pos < len(dados_shp):
        _, clen = struct.unpack(">2i", dados_shp[pos:pos + 8])
        pos += 8
        rec = dados_shp[pos:pos + clen * 2]
        pos += clen * 2
        if struct.unpack("<i", rec[:4])[0] == 0:
            out.append(None)
            continue
        bbox = struct.unpack("<4d", rec[4:36])
        npart, npt = struct.unpack("<2i", rec[36:44])
        partes = list(struct.unpack(f"<{npart}i", rec[44:44 + 4 * npart]))
        pts = struct.unpack(f"<{2 * npt}d", rec[44 + 4 * npart:44 + 4 * npart + 16 * npt])
        xy = [(pts[2 * i], pts[2 * i + 1]) for i in range(npt)]
        aneis = [xy[partes[i]:(partes[i + 1] if i + 1 < npart else npt)] for i in range(npart)]
        out.append((bbox, aneis))
    return out


def dentro(x, y, aneis):
    """Ponto no polígono (par-ímpar sobre todos os anéis: buracos excluem)."""
    c = False
    for r in aneis:
        n = len(r)
        j = n - 1
        for i in range(n):
            xi, yi = r[i]
            xj, yj = r[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
    return c


def bacias_do_zip(dados_zip):
    """[{nome_shape, bacia_ons, bbox, aneis}] a partir do zip do ONS (shp + dbf)."""
    z = zipfile.ZipFile(io.BytesIO(dados_zip))
    shp = next(n for n in z.namelist() if n.lower().endswith(".shp"))
    dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    polis = le_poligonos(z.read(shp))
    regs = le_dbf(z.read(dbf))
    if len(polis) != len(regs):
        raise ValueError(f"shapefile com {len(polis)} formas e {len(regs)} registros")
    out = []
    for reg, pol in zip(regs, polis):
        if pol is None:
            continue
        nome_shape = sem_acento(reg.get("Nome_Bacia"))
        out.append({"nome_shape": nome_shape, "bacia_ons": BACIA_ONS.get(nome_shape), "bbox": pol[0], "aneis": pol[1]})
    return out


def pontos_grade(bacia):
    """Pontos de grade regular dentro do polígono: passo de 1°, adensado (0,5° e 0,25°)
    enquanto houver menos de MIN_PONTOS. Centros em (k + 1/2)·passo. Peso = cos(lat)."""
    xmin, ymin, xmax, ymax = bacia["bbox"]
    for passo in PASSOS:
        pts = []
        x = math.floor(xmin / passo) * passo + passo / 2
        while x < xmax:
            y = math.floor(ymin / passo) * passo + passo / 2
            while y < ymax:
                if dentro(x, y, bacia["aneis"]):
                    pts.append((round(y, 4), round(x, 4)))
                y += passo
            x += passo
        if len(pts) >= MIN_PONTOS or passo == PASSOS[-1]:
            return passo, [{"lat": la, "lon": lo, "peso": math.cos(math.radians(la)) * passo * passo} for la, lo in pts]
    return None, []


def id_ponto_precip(lat, lon):
    return f"pr_{lat:+08.3f}_{lon:+09.3f}"


def localizador(bacias):
    """Função (lat, lon) → bacia ONS do polígono que contém o ponto, ou None."""
    def f(lat, lon):
        for b in bacias:
            xmin, ymin, xmax, ymax = b["bbox"]
            if xmin <= lon <= xmax and ymin <= lat <= ymax and b["bacia_ons"] and dentro(lon, lat, b["aneis"]):
                return b["bacia_ons"]
        return None
    return f


# ---------------------------------------------------------------- IBGE: sedes municipais e população

def sedes_municipais(dados_zip):
    """{cod_municipio: (uf, nome, lat, lon)} das sedes municipais (Localidades 2022)."""
    z = zipfile.ZipFile(io.BytesIO(dados_zip))
    dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    regs = le_dbf(z.read(dbf), filtro=lambda r: r.get("SCT_LOCALI") == "Sede Municipal")
    out = {}
    for r in regs:
        try:
            out[r["CD_MUN"]] = (r["SIGLA_UF"], r["NM_MUN"], float(r["LAT_LOCALI"]), float(r["LONG_LOCAL"]))
        except (KeyError, ValueError):
            continue
    return out


def populacao_sidra(dados_json):
    """{codigo: população} de uma consulta SIDRA (tabela 4709, variável 93, 2022)."""
    linhas = json.loads(dados_json.decode("utf-8"))
    out = {}
    for r in linhas[1:]:
        try:
            out[r["D1C"]] = int(r["V"])
        except (KeyError, ValueError, TypeError):
            continue
    return out


def celula_merra(lat, lon):
    """Centro da célula MERRA-2 mais próxima (0,5° × 0,625°)."""
    return (round(round((lat + 90) / MERRA_DLAT) * MERRA_DLAT - 90, 3),
            round(round((lon + 180) / MERRA_DLON) * MERRA_DLON - 180, 3))


def id_celula(lat, lon):
    return f"t_{lat:+08.3f}_{lon:+09.3f}"


def seleciona_celulas(sedes, pop_mun, pop_uf):
    """Células de temperatura por UF: as mais populosas até COBERTURA_UF da população
    do estado (máximo MAX_CELULAS_UF, mínimo uma). Retorna {uf: [{id, lat, lon, pop}]}
    e {uf: cobertura}."""
    por_uf = defaultdict(lambda: defaultdict(int))
    for cod, (uf, _nm, lat, lon) in sedes.items():
        p = pop_mun.get(cod)
        if p is None:
            continue
        por_uf[uf][celula_merra(lat, lon)] += p
    escolha, cobertura = {}, {}
    for uf, cels in por_uf.items():
        total = pop_uf.get(uf) or sum(cels.values())
        acum, sel = 0, []
        for (la, lo), p in sorted(cels.items(), key=lambda kv: -kv[1]):
            sel.append({"id": id_celula(la, lo), "lat": la, "lon": lo, "pop": p})
            acum += p
            if acum >= COBERTURA_UF * total or len(sel) >= MAX_CELULAS_UF:
                break
        escolha[uf] = sel
        cobertura[uf] = acum / total if total else None
    return escolha, cobertura


# ---------------------------------------------------------------- NASA POWER

def url_power(tipo, lat, lon, inicio, fim):
    """URL do POWER. `tipo` = 'precip' (IMERG, dia UTC) ou 'temp' (MERRA-2/GEOS-IT, dia
    em hora solar local). O IMERG só existe em UTC no POWER."""
    ini, fi = inicio.replace("-", ""), fim.replace("-", "")
    if tipo == "precip":
        return (f"{POWER}?parameters=IMERG_PRECTOT&community=AG&longitude={lon}&latitude={lat}"
                f"&start={ini}&end={fi}&format=JSON&time-standard=UTC")
    return (f"{POWER}?parameters=T2M,T2M_MAX,T2M_MIN&community=AG&longitude={lon}&latitude={lat}"
            f"&start={ini}&end={fi}&format=JSON&time-standard=LST")


def le_power(dados):
    """{parametro: {AAAA-MM-DD: valor|None}} e cabeçalho, de uma resposta JSON do POWER.
    -999 (fill_value) é ausência. Resposta sem 'properties' é erro da fonte (lança)."""
    d = json.loads(dados.decode("utf-8") if isinstance(dados, (bytes, bytearray)) else dados)
    if "properties" not in d:
        raise ValueError(f"resposta do POWER sem dados: {str(d)[:300]}")
    fill = d.get("header", {}).get("fill_value", FILL)
    out = {}
    for par, serie in d["properties"]["parameter"].items():
        out[par] = {f"{k[:4]}-{k[4:6]}-{k[6:8]}": (None if v is None or v == fill or v <= -998 else float(v))
                    for k, v in serie.items()}
    return out, d.get("header", {}), d.get("messages") or []


def janelas(hoje):
    """Duas janelas por ponto: histórico (recolhido a cada 30 dias) e recente (a cada
    poucos dias), com sobreposição: o recente sobrepõe o histórico onde os dois existem.
    O IMERG Final chega com 3,5 meses de atraso e o MERRA-2 com cerca de um mês, então os
    últimos meses mudam de versão (Late → Final, GEOS-IT → MERRA-2)."""
    fim_hist = (hoje - timedelta(days=180)).isoformat()
    ini_rec = (hoje - timedelta(days=240)).isoformat()
    return {"historico": (fim_hist, 30), "recente": (ini_rec, 3)}


def media_ponderada(valores_pesos):
    num = sum(v * w for v, w in valores_pesos)
    den = sum(w for _, w in valores_pesos)
    return num / den if den > 0 else None
