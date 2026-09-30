"""Temperatura diária por subsistema para a decomposição estatística da carga (P027).

Fonte escolhida em 30/09/2026, com a evidência no documento do módulo:
- INMET (observação de estação, fonte preferida) não respondeu: portal, API e arquivos
  históricos devolveram resposta vazia ("Empty reply from server");
- Open-Meteo (reanálise ERA5) respondeu HTTP 429 "Daily API request limit exceeded" a
  partir do endereço compartilhado do ambiente;
- NOAA GSOD (observação sinótica) não tem arquivos de 2026 (a lista de estações termina
  em 24/08/2025);
- NASA POWER (API diária por ponto, https://power.larc.nasa.gov) respondeu. É reanálise
  e análise de modelo (natureza ESTIMADO, não observação): MERRA-2 no histórico e GEOS-IT
  no trecho recente ainda não coberto pelo MERRA-2 (em 30/09/2026, setembro de 2026
  inteiro vinha do GEOS-IT). Valores ausentes vêm como -999 e viram ausência.

Agregação espacial (declarada): um ponto por unidade da federação, o centroide do
município da capital publicado pelo IBGE (API de malhas v3, metadados); temperatura do
subsistema = média das capitais ponderada pela população residente estimada da UF
(IBGE, SIDRA 6579, último ano). A capital representa a UF, o que é uma aproximação: o
interior pode ser mais quente ou mais frio, e a carga não se distribui como a população.

UFs por subsistema: conferido em 30/09/2026 pela própria API de carga verificada do ONS,
somando as áreas geoelétricas de 20/09/2026: SE/CO = SP, MG, RJ, ES, GO, DF, MT, MS, AC,
RO (+ perdas PESE; a área TOCO veio zerada); S = RS, PR, SC (+ PES); NE = BA e SE (área
BASE), BA oeste (BAOE), PI, PB e RN (PBRN), CE, AL e PE (ALPE) (+ PENE); N = PA, MA, AM,
AP, RR, TO (área TON) (+ PEN). As somas fecharam com a carga do submercado (S: 11.025,5
contra 11.025,4 MWmed; SE/CO: 40.527,6 contra 40.527,5; N: 9.263,0 contra 9.261,9; NE:
13.342,7 contra 13.335,0).
"""
import json

URL_POWER = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX"
             "&community=RE&longitude={lon}&latitude={lat}&start={inicio}&end={fim}&format=JSON")
URL_POWER_DOC = "https://power.larc.nasa.gov/docs/services/api/temporal/daily/"
LICENCA_POWER = ("Dados da NASA de acesso livre e sem restrição de uso, com pedido de citação do projeto POWER "
                 "(NASA Langley Research Center, Prediction Of Worldwide Energy Resources)")
URL_CENTROIDE = "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{codigo}/metadados"
URL_MUNICIPIO = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{codigo}"
URL_SIDRA_POP = "https://apisidra.ibge.gov.br/values/t/6579/n3/all/v/9324/p/last"
URL_SIDRA_TABELA = "https://sidra.ibge.gov.br/tabela/6579"
LICENCA_IBGE = "Uso livre com citação da fonte (IBGE)"
PRIMEIRO_DIA = "2019-01-01"
AUSENTE_POWER = -999.0

# Código IBGE do município da capital de cada UF (os dois primeiros dígitos são o código
# da UF, o que a coleta confere contra a API de localidades junto com o nome).
CAPITAIS = {
    "RO": ("1100205", "Porto Velho"), "AC": ("1200401", "Rio Branco"), "AM": ("1302603", "Manaus"),
    "RR": ("1400100", "Boa Vista"), "PA": ("1501402", "Belém"), "AP": ("1600303", "Macapá"),
    "TO": ("1721000", "Palmas"), "MA": ("2111300", "São Luís"), "PI": ("2211001", "Teresina"),
    "CE": ("2304400", "Fortaleza"), "RN": ("2408102", "Natal"), "PB": ("2507507", "João Pessoa"),
    "PE": ("2611606", "Recife"), "AL": ("2704302", "Maceió"), "SE": ("2800308", "Aracaju"),
    "BA": ("2927408", "Salvador"), "MG": ("3106200", "Belo Horizonte"), "ES": ("3205309", "Vitória"),
    "RJ": ("3304557", "Rio de Janeiro"), "SP": ("3550308", "São Paulo"), "PR": ("4106902", "Curitiba"),
    "SC": ("4205407", "Florianópolis"), "RS": ("4314902", "Porto Alegre"), "MS": ("5002704", "Campo Grande"),
    "MT": ("5103403", "Cuiabá"), "GO": ("5208707", "Goiânia"), "DF": ("5300108", "Brasília"),
}
CODIGO_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA",
             "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
             "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
             "51": "MT", "52": "GO", "53": "DF"}
UFS_DO_SM = {
    "SE": ("SP", "MG", "RJ", "ES", "GO", "DF", "MT", "MS", "AC", "RO"),
    "S": ("RS", "PR", "SC"),
    "NE": ("BA", "SE", "PI", "PB", "RN", "CE", "AL", "PE"),
    "N": ("PA", "MA", "AM", "AP", "RR", "TO"),
}


def url_power(lat, lon, inicio, fim):
    return URL_POWER.format(lat=f"{lat:.4f}", lon=f"{lon:.4f}", inicio=inicio.replace("-", ""), fim=fim.replace("-", ""))


def parse_power(texto):
    """({dia_iso: (t2m, t2m_max)}, fontes) da resposta diária do POWER. -999 é ausência."""
    d = json.loads(texto if isinstance(texto, str) else texto.decode("utf-8"))
    par = d["properties"]["parameter"]
    t, tx = par.get("T2M") or {}, par.get("T2M_MAX") or {}
    fill = d.get("header", {}).get("fill_value", AUSENTE_POWER)
    out = {}
    for k in sorted(set(t) | set(tx)):
        dia = f"{k[:4]}-{k[4:6]}-{k[6:8]}"
        a, b = t.get(k), tx.get(k)
        a = None if a is None or a == fill else float(a)
        b = None if b is None or b == fill else float(b)
        if a is not None or b is not None:
            out[dia] = (a, b)
    return out, list(d.get("header", {}).get("sources") or [])


def parse_centroide(texto):
    """(latitude, longitude) do centroide publicado pelo IBGE para o município."""
    d = json.loads(texto if isinstance(texto, str) else texto.decode("utf-8"))
    c = d[0]["centroide"]
    return float(c["latitude"]), float(c["longitude"])


def parse_populacao(texto):
    """({UF: pessoas}, ano) da tabela SIDRA 6579 (nível UF, último ano)."""
    d = json.loads(texto if isinstance(texto, str) else texto.decode("utf-8"))
    out, anos = {}, set()
    for linha in d[1:]:
        uf = CODIGO_UF.get(str(linha.get("D1C")))
        v = linha.get("V")
        if not uf or v in (None, "", "-", "..", "..."):
            continue
        out[uf] = float(v)
        anos.add(linha.get("D3C"))
    return out, (sorted(anos)[-1] if anos else None)


def pesos(populacao):
    """{sm: {uf: peso}} normalizados dentro de cada subsistema e {'SIN': {...}} no país.
    UF sem população publicada fica fora (o peso das demais é renormalizado e a
    cobertura declarada)."""
    out = {}
    for sm, ufs in UFS_DO_SM.items():
        tot = sum(populacao[u] for u in ufs if u in populacao)
        out[sm] = {u: populacao[u] / tot for u in ufs if u in populacao} if tot else {}
    tot = sum(populacao[u] for ufs in UFS_DO_SM.values() for u in ufs if u in populacao)
    out["SIN"] = {u: populacao[u] / tot for ufs in UFS_DO_SM.values() for u in ufs if u in populacao} if tot else {}
    return out


def temperatura_ponderada(por_uf, pesos_sm, minimo_cobertura=0.95):
    """{dia: temperatura} de um subsistema: média ponderada das capitais com valor no dia,
    publicada só quando os pesos com valor somam pelo menos `minimo_cobertura` (dia com
    capital importante sem dado não é média do subsistema). Renormaliza pelos presentes."""
    dias = set()
    for uf in pesos_sm:
        dias |= set(por_uf.get(uf, {}))
    out = {}
    for d in sorted(dias):
        soma, peso = 0.0, 0.0
        for uf, w in pesos_sm.items():
            v = por_uf.get(uf, {}).get(d)
            if v is None:
                continue
            soma += w * v
            peso += w
        if peso >= minimo_cobertura:
            out[d] = soma / peso
    return out
