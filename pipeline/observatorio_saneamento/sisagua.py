"""Qualidade da água (SISAGUA, Ministério da Saúde): coleta em fluxo e gold sem rede.

Os arquivos anuais têm de 100 a 200 MB compactados e vários GB descompactados.
O coletor lê cada CSV dentro do ZIP linha a linha, agrega por município e grava
em seed/sisagua/ apenas contadores inteiros, com URL, sha256 e Last-Modified de
cada ZIP original. O ZIP não entra no repositório.

Coleta:
    python3 -m pipeline.observatorio_saneamento.sisagua --coletar --anos 2024,2025
    python3 -m pipeline.observatorio_saneamento.sisagua --coletar --zips DIR   # ZIPs já baixados

Regras (docs/saneamento/METODOLOGIA.md, seção SISAGUA):
- controle (prestador) e vigilância (secretaria de saúde) nunca se somam;
- "amostra" é a análise de um parâmetro, não a coleta física;
- município sem registro fica sem dado, nunca zero;
- valores inválidos, resultados abaixo de limite não conclusivos, duplicatas,
  amostras não rotineiras e linhas das Regiões Administrativas do DF são contados
  e publicados em meta.json, nunca imputados.
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import os
import re
import tempfile
import unicodedata
import urllib.request
import zipfile

from . import fontes

AQUI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(AQUI, "seed", "sisagua")
UA = "Scrutiniums/1.0 (observatorio do saneamento; dados abertos)"
ANOS = (2024, 2025)
DF = "530010"

# Cabeçalhos conferidos nos arquivos de 2024 e 2025. Mudança de layout interrompe a coleta.
CAB_CONTROLE = [
    "Região Geográfica", "UF", "Regional de Saúde", "Código IBGE", "Município", "Tipo da Instituição",
    "Sigla da Instituição", "Nome da Instituição", "CNPJ da Instituição", "Nome do escritório regional/local",
    "CNPJ do escritório regional/local", "Tipo da Forma de Abastecimento", "Código Forma de abastecimento",
    "Nome da Forma de Abastecimento", "Nome da ETA / UTA", "Tipo de Filtração", "Ano de referência",
    "Mês de referência", "Ponto de Monitoramento", "Parâmetro", "Campo", "Valor",
]
CAB_PLANO = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "TP_ABRANGENCIA", "SG_INSTITUICAO",
    "NO_INSTITUICAO", "NU_CNPJ_INSTITUICAO", "NO_ESCRITORIO_REGIONAL_LOCAL", "NU_CNPJ_ESCRITORIO_REGIONAL_LOCAL",
    "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NO_ETA", "HR_TEMPO_MEDIO_DIARIO",
    "CAPTACAO_SUPERFICIAL", "CAPTACAO_SUBTERRANEA", "CAPTACAO_AGUA_CHUVA", "TP_FILTRACAO", "NU_FILTROS",
    "NU_ECONOMIA_RESIDENCIAIS", "RAZAO_HAB_DOMICILIO", "POP_ABASTECIDA_ESTIMADA", "NU_ANO", "DT_INCLUSAO_REGISTRO",
    "PT_MONITORAMENTO", "PARAMETRO", "CAMPO", "VALOR",
]
CAB_VIGILANCIA = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "NU_AMOSTRA", "TP_MOTIVO_COLETA",
    "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NO_ETA", "NU_ANO", "NU_MES",
    "DT_COLETA", "HR_COLETA", "DT_LAUDO", "DT_INCLUSAO_REGISTRO", "TP_PROCEDENCIA_COLETA", "TP_PONTO_COLETA",
    "DS_LOCAL", "TP_ZONA", "NO_CATEGORIA_AREA", "NO_AREA", "TP_LOCAL", "NO_LOCAL", "NU_LATITUDE", "NU_LONGITUDE",
    "PARAMETRO", "ANALISE_REALIZADA", "DT_ANALISE", "LD", "LQ", "RESULTADO", "PROVIDENCIA",
]
CAB_FORA = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "TP_ABRANGENCIA", "SG_INSTITUICAO",
    "NO_INSTITUICAO", "NU_CNPJ_INSTITUICAO", "NO_ESCRITORIO_REGIONAL_LOCAL", "NU_CNPJ_ESCRITORIO_REGIONAL_LOCAL",
    "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NU_ANO", "NU_MES",
    "DT_INCLUSAO_REGISTRO", "DT_FORMULARIO_CADASTRO", "DT_COLETA", "PT_MONITORAMENTO", "PARAMETRO", "ZONA",
    "CATEGORIA_AREA", "AREA", "TP_LOCAL", "NO_LOCAL", "NO_ENDERECO", "LATITUDE", "LONGIDADE", "RESULTADO",
    "PROVIDENCIA_CONTROLE",
]

# Parâmetros usados e o rótulo de cada um em cada conjunto.
PARAMETROS = {
    "ecoli": {"controle": "Escherichia coli", "vigilancia": "Escherichia coli"},
    "coliformes": {"controle": "Coliformes totais", "vigilancia": "Coliformes totais"},
    "cloro": {"controle": "Cloro Residual Livre (mg/L)", "vigilancia": "Cloro residual livre (mg/L)"},
    "turbidez": {"controle": "Turbidez (uT)", "vigilancia": "Turbidez (uT)"},
}
PARAM_CONTROLE = {v["controle"]: k for k, v in PARAMETROS.items()}
PARAM_VIGILANCIA = {v["vigilancia"]: k for k, v in PARAMETROS.items()}

# Limites da Portaria GM/MS 888/2021 (Anexo XX da Portaria de Consolidação 5/2017).
LIMITES = {
    "ecoli": {"regra": "presença em 100 mL", "citacao": "Anexo 1: ausência em 100 mL no sistema de distribuição e pontos de consumo"},
    "coliformes": {"regra": "presença em 100 mL", "citacao": "Anexo 1: tolerância mensal conforme a população abastecida; presença não é, isoladamente, desconformidade"},
    "cloro": {"regra": "abaixo de 0,2 mg/L", "limite": 0.2, "citacao": "Art. 32: mínimo de 0,2 mg/L de cloro residual livre em toda a extensão do sistema de distribuição e nos pontos de consumo"},
    "turbidez": {"regra": "acima de 5,0 uT", "limite": 5.0, "citacao": "Art. 28, § 2º: VMP de 5,0 uT em toda a extensão do sistema de distribuição ou pontos de consumo"},
}

# Controle mensal: pontos da rede e do consumo (o que chega à população).
PONTOS_CONTROLE = {"SISTEMA DE DISTRIBUIÇÃO", "PONTO DE CONSUMO"}


def rotulo(c):
    """Normaliza rótulo de Campo: minúsculas, sem espaços, vírgula decimal como ponto."""
    return re.sub(r"\s+", "", c).replace(",", ".").lower()


# Rótulos de Campo do controle mensal, por parâmetro: papel na medida ou None (conhecido e não usado).
# Rótulo novo, não mapeado, interrompe a coleta.
CAMPOS_CONTROLE = {
    "ecoli": {
        "Número de amostras analisadas": "analisadas",
        "N de amostras com presença para Escherichia coli": "fora",
        "N de amostras com ausência para Escherichia coli": "dentro",
    },
    "coliformes": {
        "Número de amostras analisadas": "analisadas",
        "N de amostras com presença de coliformes totais": "fora",
        "N de amostras com ausência de coliformes totais": "dentro",
    },
    "cloro": {
        "Número de amostras analisadas": "analisadas",
        "Número de dados < 0,2 mg/L": "fora",
        "Número de dados > 5,0 mg/L": None,
        "Número de dados >= 2,0 mg/L e <= 5,0mg/L": None,
        "Número de dados > 2,0 mg/L e <= 5,0mg/L": None,
        "Número de dados >= 0,2 mg/L e <= 2,0mg/L": None,
        "Percentil 95": None,
    },
    "turbidez": {
        "Número de amostras analisadas": "analisadas",
        "Número de dados > 5,0 uT": "fora",
        "Número de dados <= 5,0 uT": "dentro",
        # faixas herdadas de pontos de tratamento, com grafia inconsistente; não usadas
        "Número de dados <= 1.0 uT": None,
        "Número de dados > 1.0 uT e <= 0.5 uT": None,
        "Percentil 95": None,
    },
}
MAPA_CAMPOS = {p: {rotulo(k): v for k, v in m.items()} for p, m in CAMPOS_CONTROLE.items()}

INTEIRO = re.compile(r"^(\d+)(?:,0+)?$")
NUMERO = re.compile(r"^\d+(?:[.,]\d+)?$")


def municipio(cod, contagem):
    """Código de 6 dígitos; Regiões Administrativas do DF agregadas em 530010."""
    cod = cod.strip()
    if not re.fullmatch(r"\d{6}", cod):
        contagem["codigo_invalido"] = contagem.get("codigo_invalido", 0) + 1
        return None
    if cod.startswith("53") and cod != DF:
        contagem["linhas_ra_df"] = contagem.get("linhas_ra_df", 0) + 1
        return DF
    return cod


def inteiro(v):
    m = INTEIRO.match(v.strip())
    return int(m.group(1)) if m else None


def numero(v):
    v = v.strip()
    return float(v.replace(",", ".")) if NUMERO.match(v) else None


def ler_csv(zpath, cabecalho):
    """Itera as linhas do único CSV do ZIP, em latin-1 e separador ';', conferindo o cabeçalho."""
    with zipfile.ZipFile(zpath) as z:
        nomes = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if len(nomes) != 1:
            raise ValueError(f"{zpath}: esperado um CSV, encontrados {nomes}")
        yield from _linhas(z, nomes[0], zpath, cabecalho)


def _linhas(z, nome, zpath, cabecalho):
    with z.open(nome) as f:
        r = csv.reader(io.TextIOWrapper(f, encoding="latin-1", newline=""), delimiter=";")
        cab = next(r)
        if cab != cabecalho:
            raise ValueError(f"{zpath}: cabeçalho mudou: {cab}")
        largura = len(cab)
        for linha in r:
            if len(linha) != largura:
                raise ValueError(f"{zpath}: linha com {len(linha)} colunas")
            yield linha


def mais(d, k, n=1):
    d[k] = d.get(k, 0) + n


# ---------------------------------------------------------------------------
# agregação de cada conjunto
# ---------------------------------------------------------------------------

def agregar_controle(zpath, ano):
    """Controle mensal, parâmetros básicos: contadores por forma × mês × ponto × parâmetro.

    Devolve contadores municipais da rede e do consumo e, para o plano de amostragem,
    as análises de coliformes totais realizadas no sistema de distribuição de cada SAA."""
    I = {c: i for i, c in enumerate(CAB_CONTROLE)}
    exc = {}
    formas = {}
    grupos = {}
    for l in ler_csv(zpath, CAB_CONTROLE):
        if l[I["Ano de referência"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        mun = municipio(l[I["Código IBGE"]], exc)
        if mun is None:
            continue
        forma = l[I["Código Forma de abastecimento"]].strip()
        formas.setdefault(mun, set()).add(forma)
        par = PARAM_CONTROLE.get(l[I["Parâmetro"]].strip())
        ponto = l[I["Ponto de Monitoramento"]].strip()
        if par is None or ponto not in PONTOS_CONTROLE:
            continue
        campo = l[I["Campo"]].strip()
        rk = rotulo(campo)
        if rk not in MAPA_CAMPOS[par]:
            raise ValueError(f"rótulo de Campo não mapeado para {par}: {campo!r}")
        papel = MAPA_CAMPOS[par][rk]
        if papel is None:
            continue
        tipo = l[I["Tipo da Forma de Abastecimento"]].strip()
        # código original na chave: no DF, o mesmo sistema aparece em várias Regiões Administrativas
        chave = (mun, l[I["Código IBGE"]].strip(), forma, tipo, int(l[I["Mês de referência"]]), ponto, par)
        g = grupos.setdefault(chave, {})
        if papel in g:
            raise ValueError(f"Campo repetido no grupo {chave}")
        g[papel] = l[I["Valor"]]
    mun_out = {}
    realizadas_saa = {}
    for (mun, original, forma, tipo, _mes, ponto, par), g in sorted(grupos.items()):
        a = inteiro(g["analisadas"]) if "analisadas" in g else None
        f = inteiro(g["fora"]) if "fora" in g else None
        d = inteiro(g["dentro"]) if "dentro" in g else None
        if "analisadas" not in g or "fora" not in g:
            mais(exc, f"grupo_incompleto_{par}")
            continue
        if a is None or f is None or ("dentro" in g and d is None):
            mais(exc, f"valor_nao_inteiro_{par}")
            continue
        if f > a or (d is not None and f + d != a):
            mais(exc, f"grupo_inconsistente_{par}")
            continue
        m = mun_out.setdefault(mun, {})
        acc = m.setdefault(par, [0, 0])
        acc[0] += f
        acc[1] += a
        if par == "coliformes" and tipo == "SAA" and ponto == "SISTEMA DE DISTRIBUIÇÃO":
            mais(realizadas_saa, (mun, original, forma), a)
    for mun, fs in formas.items():
        mun_out.setdefault(mun, {})["formas"] = len(fs)
    return mun_out, realizadas_saa, exc


def agregar_plano(zpath, ano, realizadas_saa):
    """Plano de amostragem: análises de coliformes totais exigidas pela norma no sistema de
    distribuição de cada SAA (Anexo 14), cruzadas com as realizadas no controle.

    Coberta = min(realizada, exigida) por forma de abastecimento: excesso em um sistema
    não compensa falta em outro."""
    I = {c: i for i, c in enumerate(CAB_PLANO)}
    exc = {}
    exigidas = {}
    for l in ler_csv(zpath, CAB_PLANO):
        if l[I["NU_ANO"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        if (l[I["TP_ABASTECIMENTO"]].strip() != "SAA" or l[I["PT_MONITORAMENTO"]].strip() != "SISTEMA DE DISTRIBUIÇÃO"
                or l[I["PARAMETRO"]].strip() != "Coliformes totais" or l[I["CAMPO"]].strip() != "Total Anual de Análises"):
            continue
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc)
        if mun is None:
            continue
        v = inteiro(l[I["VALOR"]])
        # a mesma forma aparece repetida com razões habitantes/domicílio diferentes; o valor é o mesmo
        exigidas.setdefault((mun, l[I["CO_MUNICIPIO_IBGE"]].strip(), l[I["NU_SOLUCAO_ABASTECIMENTO"]].strip()), set()).add(v)
    out = {}
    formas_controle = {f for (_m, _o, f) in realizadas_saa}
    com_plano = {(o, f) for (_m, o, f) in exigidas}
    sem_plano = [(k, v) for k, v in realizadas_saa.items() if (k[1], k[2]) not in com_plano]
    exc["formas_com_controle_sem_plano"] = len(sem_plano)
    exc["analises_de_formas_sem_plano"] = sum(v for _, v in sem_plano)
    for (mun, original, forma), vals in sorted(exigidas.items()):
        if len(vals) != 1 or None in vals:
            mais(exc, "forma_com_valor_conflitante_ou_invalido")
            continue
        e = vals.pop()
        if e == 0:
            mais(exc, "forma_sem_exigencia")
            continue
        r = realizadas_saa.get((mun, original, forma), 0)
        m = out.setdefault(mun, {"cobertas": 0, "exigidas": 0, "realizadas": 0, "formas": 0, "formas_sem_controle": 0})
        m["cobertas"] += min(r, e)
        m["exigidas"] += e
        m["realizadas"] += r
        m["formas"] += 1
        if (mun, original, forma) not in realizadas_saa:
            m["formas_sem_controle"] += 1
            if forma in formas_controle:
                # SAA que atende vários municípios e registrou as análises em outro município
                mais(exc, "formas_com_controle_em_outro_municipio")
    return out, exc


def grupo_vigilancia(tipo, procedencia):
    if tipo == "SAA" and procedencia == "SISTEMA DE DISTRIBUIÇÃO":
        return "rede"
    if tipo == "SAC" and procedencia == "SOLUÇÃO ALTERNATIVA":
        return "sac"
    return None


def classificar(par, resultado, ld, lq):
    """'fora', 'dentro', 'limite' (abaixo de LD/LQ sem conclusão) ou 'invalido'."""
    r = resultado.strip()
    if par in ("ecoli", "coliformes"):
        return {"PRESENTE": "fora", "AUSENTE": "dentro"}.get(r, "invalido")
    lim = LIMITES[par]["limite"]
    if r in ("MENOR_LD", "MENOR_LQ"):
        ref = numero(lq if r == "MENOR_LQ" else ld)
        if ref is None:
            return "limite"
        if par == "cloro":
            return "fora" if ref <= lim else "limite"
        return "dentro" if ref <= lim else "limite"
    v = numero(r)
    if v is None:
        return "invalido"
    if par == "cloro":
        return "fora" if v < lim else "dentro"
    return "fora" if v > lim else "dentro"


def agregar_vigilancia(zpath, ano):
    """Vigilância, parâmetros básicos: uma linha por amostra × parâmetro.

    Medida municipal: amostras de rotina da rede de SAA e do ponto de consumo de SAC.
    O quadro nacional guarda todos os tipos e procedências, separados."""
    I = {c: i for i, c in enumerate(CAB_VIGILANCIA)}
    exc = {}
    vistos = set()
    mun_out = {}
    nacional = {}
    for l in ler_csv(zpath, CAB_VIGILANCIA):
        if l[I["NU_ANO"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc)
        if mun is None:
            continue
        m = mun_out.setdefault(mun, {"analises": 0})
        m["analises"] += 1
        par = PARAM_VIGILANCIA.get(l[I["PARAMETRO"]].strip())
        if par is None:
            continue
        chave = hashlib.blake2b("\x1f".join((l[I["CO_MUNICIPIO_IBGE"]].strip(), l[I["NU_SOLUCAO_ABASTECIMENTO"]].strip(), l[I["NU_AMOSTRA"]].strip(),
                                             par, l[I["DT_COLETA"]].strip())).encode(), digest_size=12).digest()
        if chave in vistos:
            mais(exc, "duplicata")
            continue
        vistos.add(chave)
        motivo = l[I["TP_MOTIVO_COLETA"]].strip()
        if motivo != "Rotina":
            mais(exc, "motivo_" + slug(motivo))
            continue
        tipo = l[I["TP_ABASTECIMENTO"]].strip()
        proc = l[I["TP_PROCEDENCIA_COLETA"]].strip()
        c = classificar(par, l[I["RESULTADO"]], l[I["LD"]], l[I["LQ"]])
        n = nacional.setdefault(f"{tipo}|{proc}|{par}", [0, 0])
        if c in ("fora", "dentro"):
            n[0] += c == "fora"
            n[1] += 1
        else:
            mais(exc, f"{c}_{par}")
        if grupo_vigilancia(tipo, proc) is None or c not in ("fora", "dentro"):
            continue
        acc = m.setdefault(par, [0, 0])
        acc[0] += c == "fora"
        acc[1] += 1
    return mun_out, nacional, exc


def agregar_fora_padrao(zpath, anos):
    """Amostras do controle fora do padrão (arquivo único com todos os anos), por ano e parâmetro.

    Serve só de conferência: o dicionário diz que o registro do resultado fora do padrão
    não é obrigatório, então o arquivo pode ficar abaixo dos contadores do controle mensal."""
    I = {c: i for i, c in enumerate(CAB_FORA)}
    out = {str(a): {} for a in anos}
    for l in ler_csv(zpath, CAB_FORA):
        ano = l[I["NU_ANO"]].strip()
        if ano not in out:
            continue
        par = PARAM_CONTROLE.get(l[I["PARAMETRO"]].strip())
        if par is None or l[I["PT_MONITORAMENTO"]].strip() not in PONTOS_CONTROLE:
            continue
        mais(out[ano], par)
    return out


def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")


# ---------------------------------------------------------------------------
# coleta
# ---------------------------------------------------------------------------

def sha256_arquivo(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def cabecalho_http(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return {"last_modified": r.headers.get("Last-Modified"), "bytes": int(r.headers.get("Content-Length") or 0)}


def obter(url, pasta):
    """Caminho local do ZIP (baixa se não estiver em pasta) e proveniência."""
    nome = url.rsplit("/", 1)[1]
    caminho = os.path.join(pasta, nome)
    if not os.path.exists(caminho):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=1800) as r, open(caminho, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
    http = cabecalho_http(url)
    tam = os.path.getsize(caminho)
    if http["bytes"] and http["bytes"] != tam:
        raise ValueError(f"{nome}: {tam} bytes locais, {http['bytes']} publicados")
    return caminho, {"url": url, "sha256": sha256_arquivo(caminho), "bytes": tam, "last_modified": http["last_modified"]}


def documento(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        b = r.read()
    return {"url": url, "sha256": hashlib.sha256(b).hexdigest()}


def gravar(nome, obj):
    """Grava a seed com mtime fixo (mesmo conteúdo, mesmo .gz) e devolve o sha256 do JSON."""
    os.makedirs(SEED, exist_ok=True)
    dados = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    with open(os.path.join(SEED, nome), "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0, filename="") as g:
            g.write(dados)
    return hashlib.sha256(dados).hexdigest()


def coletar(anos=ANOS, zips=None):
    """Sem `zips`, baixa para uma pasta temporária apagada ao fim, com ou sem erro."""
    if zips:
        return _coletar(anos, zips)
    with tempfile.TemporaryDirectory(prefix="sisagua-") as pasta:
        return _coletar(anos, pasta)


def _coletar(anos, pasta):
    arquivos = []
    seeds = {}
    for ano in anos:
        c_path, c_prov = obter(fontes.sisagua_url("controle", ano), pasta)
        controle, realizadas, exc_c = agregar_controle(c_path, ano)
        p_path, p_prov = obter(fontes.sisagua_url("plano", ano), pasta)
        plano, exc_p = agregar_plano(p_path, ano, realizadas)
        v_path, v_prov = obter(fontes.sisagua_url("vigilancia", ano), pasta)
        vig, nacional, exc_v = agregar_vigilancia(v_path, ano)
        seeds[f"sisagua_{ano}.json.gz"] = gravar(f"sisagua_{ano}.json.gz", {
            "ano": ano,
            "controle": controle, "plano": plano, "vigilancia": vig, "vigilancia_nacional": nacional,
            "exclusoes": {"controle": exc_c, "plano": exc_p, "vigilancia": exc_v},
        })
        for conjunto, prov in (("controle", c_prov), ("plano", p_prov), ("vigilancia", v_prov)):
            arquivos.append({"conjunto": conjunto, "ano": ano, **prov})
        print(ano, "controle", len(controle), "plano", len(plano), "vigilancia", len(vig), flush=True)
    f_path, f_prov = obter(fontes.SISAGUA["fora_padrao"], pasta)
    seeds["sisagua_fora_padrao.json.gz"] = gravar("sisagua_fora_padrao.json.gz", agregar_fora_padrao(f_path, anos))
    arquivos.append({"conjunto": "fora_padrao", "ano": None, **f_prov})
    manifesto = {
        "capturado_em": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "anos": list(anos),
        "arquivos": arquivos,
        "seeds": seeds,
        "dicionarios": {k: documento(u) for k, u in sorted(fontes.SISAGUA["dicionarios"].items())},
        "portaria": documento(fontes.SISAGUA["portaria"]),
        "paginas": fontes.SISAGUA["paginas"],
        "erros_catalogo": fontes.SISAGUA["erros_catalogo"],
    }
    os.makedirs(SEED, exist_ok=True)
    with open(os.path.join(SEED, "manifesto.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")


# ---------------------------------------------------------------------------
# gold (sem rede)
# ---------------------------------------------------------------------------

def ler(nome, manifesto):
    with gzip.open(os.path.join(SEED, nome), "rb") as f:
        dados = f.read()
    if hashlib.sha256(dados).hexdigest() != manifesto["seeds"][nome]:
        raise ValueError("SHA-256 divergente: " + nome)
    return json.loads(dados)


# Medidas municipais: id → (conjunto, chave). Numerador e denominador por município e ano.
MEDIDAS = [
    ("ctrl_ecoli", "controle", "ecoli"),
    ("ctrl_colif", "controle", "coliformes"),
    ("ctrl_cloro", "controle", "cloro"),
    ("ctrl_turb", "controle", "turbidez"),
    ("vig_ecoli", "vigilancia", "ecoli"),
    ("vig_cloro", "vigilancia", "cloro"),
    ("plano", "plano", None),
]


def campos(anos=ANOS):
    """Colunas do arquivo complementar qualidade_municipios, sem o id."""
    out = []
    for ano in anos:
        out += [f"qa_reg_ctrl_{ano}", f"qa_reg_vig_{ano}"]
        for mid, _, _ in MEDIDAS:
            out += [f"qa_{mid}_{ano}_num", f"qa_{mid}_{ano}_den"]
    return out


def construir(ids6):
    """Campos municipais por código IBGE de 6 dígitos e auditoria para meta.json.

    ids6: códigos de 6 dígitos dos municípios do IBGE (universo de 5.570)."""
    with open(os.path.join(SEED, "manifesto.json"), encoding="utf-8") as f:
        manifesto = json.load(f)
    fora = ler("sisagua_fora_padrao.json.gz", manifesto)
    universo = set(ids6)
    linhas = {i: {} for i in universo}
    auditoria = {"anos": manifesto["anos"], "proveniencia": manifesto, "limites": LIMITES, "por_ano": {}}
    for ano in manifesto["anos"]:
        s = ler(f"sisagua_{ano}.json.gz", manifesto)
        sem_municipio = {k: sorted(set(s[k]) - universo) for k in ("controle", "plano", "vigilancia")}
        for i, l in linhas.items():
            c = s["controle"].get(i)
            v = s["vigilancia"].get(i)
            p = s["plano"].get(i)
            l[f"qa_reg_ctrl_{ano}"] = 1 if c else 0
            l[f"qa_reg_vig_{ano}"] = 1 if v else 0
            for mid, conjunto, chave in MEDIDAS:
                if conjunto == "plano":
                    num, den = (p["cobertas"], p["exigidas"]) if p else (None, None)
                else:
                    reg = {"controle": c, "vigilancia": v}[conjunto]
                    num, den = (reg or {}).get(chave, [None, None])
                if not den:
                    num, den = None, None
                l[f"qa_{mid}_{ano}_num"] = num
                l[f"qa_{mid}_{ano}_den"] = den

        def soma(conjunto, chave, idx):
            return sum(m[chave][idx] for k, m in s[conjunto].items() if k in universo and chave in m)

        ctrl = {i for i in universo if s["controle"].get(i)}
        vig = {i for i in universo if s["vigilancia"].get(i)}
        auditoria["por_ano"][str(ano)] = {
            "municipios": {"universo": len(universo), "controle": len(ctrl), "vigilancia": len(vig),
                           "ambos": len(ctrl & vig), "nenhum": len(universo - ctrl - vig)},
            "codigos_fora_do_universo": sem_municipio,
            "exclusoes": s["exclusoes"],
            "vigilancia_nacional": s["vigilancia_nacional"],
            "plano": {k: sum(m[k] for i, m in s["plano"].items() if i in universo)
                      for k in ("cobertas", "exigidas", "realizadas", "formas", "formas_sem_controle")},
            "conferencia_fora_padrao": [
                {"parametro": par, "controle_mensal": soma("controle", par, 0),
                 "arquivo_fora_do_padrao": fora[str(ano)].get(par, 0),
                 "diferenca": fora[str(ano)].get(par, 0) - soma("controle", par, 0)}
                for par in ("ecoli", "coliformes", "cloro", "turbidez")
            ],
        }
    return linhas, auditoria


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--coletar", action="store_true")
    ap.add_argument("--anos", default=",".join(map(str, ANOS)))
    ap.add_argument("--zips")
    a = ap.parse_args()
    if a.coletar:
        coletar(tuple(int(x) for x in a.anos.split(",")), a.zips)
