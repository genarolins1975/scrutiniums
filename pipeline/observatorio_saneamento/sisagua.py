"""Qualidade da água (SISAGUA, Ministério da Saúde): coleta em fluxo e gold sem rede.

Os arquivos anuais têm de 100 a 200 MB compactados e vários GB descompactados.
O coletor lê cada CSV dentro do ZIP linha a linha, agrega por município e grava
em seed/sisagua/ apenas contadores inteiros, com URL, sha256 e Last-Modified de
cada ZIP original. O ZIP não entra no repositório.

Coleta (série de 2014 a 2025; o plano de amostragem só a partir de 2022):
    python3 -m pipeline.observatorio_saneamento.sisagua --coletar
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

CAB_CADASTRO = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "TP_ABRANGENCIA", "SG_EMPRESA",
    "NO_EMPRESA", "NU_CNPJ", "NO_EMPRESA_1", "NU_CNPJ_1", "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO",
    "NO_SOLUCAO_ABASTECIMENTO", "NU_ANO", "DT_INCLUSAO_REGISTRO", "DT_FORMULARIO_CADASTRO", "CARRO_PIPA", "CHAFARIZ",
    "FONTE", "CISTERNA", "CANALIZAÇÃO", "CAIXA_DAGUA", "SEM_RESERVACAO", "OUTRO_TIPO_SUPRIMENTO",
    "CAPTACAO_SUPERFICIAL", "CAPTACAO_SUBTERRANEA", "CAPTACAO_AGUA_CHUVA", "FILTRACAO", "DESINFECCAO",
    "NU_ECONOMIA_DOMICILIO_PERMAN", "NU_ECONOMIAS_DOMICILIOS_NAO_PE", "NU_VALOR_POPULACAO_ESTIMADA", "NU_VALOR_RURAL",
    "NU_VALOR_URBANA", "POP_RECEBE_AGUA_SAA", "POP_RECEBE_AGUA_SAA_SAC",
]

# Controle mensal de 2014: mesmo conteúdo com nomes de coluna antigos (e duas datas a mais).
CONTROLE_2014 = {
    "cabecalho": [
        "NO_REGIAO", "SG_UF", "NO_REGIONAL", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "TP_ABRANGENCIA", "SG_INSTITUICAO",
        "NO_INSTITUICAO", "NU_CNPJ_INSTITUICAO", "NO_ESCRITORIO_REGIONAL_LOCAL", "NU_CNPJ_ESCRITORIO_REGIONAL_LOCAL",
        "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NO_ETA", "TP_FILTRACAO", "NU_ANO",
        "NU_MES", "DT_INCLUSAO_REGISTRO", "DT_FORMULARIO_CADASTRO", "TP_PONTO_COLETA", "PARAMETRO", "CAMPO", "VALOR",
    ],
    "nomes": {
        "CO_MUNICIPIO_IBGE": "Código IBGE", "TP_ABASTECIMENTO": "Tipo da Forma de Abastecimento",
        "NU_SOLUCAO_ABASTECIMENTO": "Código Forma de abastecimento", "NU_ANO": "Ano de referência",
        "NU_MES": "Mês de referência", "TP_PONTO_COLETA": "Ponto de Monitoramento", "PARAMETRO": "Parâmetro",
        "CAMPO": "Campo", "VALOR": "Valor",
    },
}

# Série anual publicada; o atlas municipal usa os dois anos mais recentes completos.
ANOS_SERIE = tuple(range(2014, 2026))
ANOS_ATLAS = ANOS
# O plano de amostragem de 2014 a 2021 só existe em JSON: o CSV do catálogo responde 404
# (arquivosdadosabertos.saude.gov.br) e não há CSV no S3. O de 2022 tem outro layout de
# Campo ("Amostras anuais") e exige 3,1 milhões de análises de coliformes na rede dos SAA,
# contra cerca de 2,0 milhões em 2023 e 2024 com o mesmo número de sistemas: regra de
# cálculo diferente, não comparável. A série do plano começa em 2023.
ANO_INICIAL_PLANO = 2023

# Parâmetros usados e o rótulo de cada um em cada conjunto.
PARAMETROS = {
    "ecoli": {"controle": "Escherichia coli", "vigilancia": "Escherichia coli"},
    "coliformes": {"controle": "Coliformes totais", "vigilancia": "Coliformes totais"},
    "cloro": {"controle": "Cloro Residual Livre (mg/L)", "vigilancia": "Cloro residual livre (mg/L)"},
    "turbidez": {"controle": "Turbidez (uT)", "vigilancia": "Turbidez (uT)"},
    "cor": {"controle": "Cor (uH)", "vigilancia": "Cor Aparente (uH)"},
    "fluoreto": {"controle": "Fluoreto (mg/L)", "vigilancia": "Fluoreto (mg/L)"},
}
PARAM_CONTROLE = {v["controle"]: k for k, v in PARAMETROS.items()}
PARAM_VIGILANCIA = {v["vigilancia"]: k for k, v in PARAMETROS.items()}

# Rótulos conhecidos e não usados: rótulo novo interrompe a coleta em vez de sumir em silêncio.
OUTROS_PARAM_CONTROLE = {"pH", "Dióxido de Cloro", "Cloro Residual Combinado (mg/L)", "Bactérias Heterotróficas (UFC/mL)"}
OUTROS_PARAM_VIGILANCIA = {"pH", "Cloro residual combinado (mg/L)", "Dióxido de Cloro (mg/L)", "Bactérias Heterotróficas (UFC/mL)",
                           "Bactérias Heterotróficas"}  # sem unidade até 2022
PONTOS_CONHECIDOS = {"PONTO DE CONSUMO", "SISTEMA DE DISTRIBUIÇÃO", "SAÍDA DO TRATAMENTO",
                     "Saída do tratamento (para água canalizada)", "Pós-filtração ou Pré-desinfecção"}
TIPOS_VIGILANCIA = {"SAA", "SAC", "SAI", "CARRO-PIPA"}
MOTIVOS_VIGILANCIA = {"Rotina", "Denúncia", "Desastre", "Surto"}

# Limites da Portaria GM/MS 888/2021 (Anexo XX da Portaria de Consolidação 5/2017).
LIMITES = {
    "ecoli": {"regra": "presença em 100 mL", "citacao": "Anexo 1: ausência em 100 mL no sistema de distribuição e pontos de consumo"},
    "coliformes": {"regra": "presença em 100 mL", "citacao": "Anexo 1: tolerância mensal conforme a população abastecida; presença não é, isoladamente, desconformidade"},
    "cloro": {"regra": "abaixo de 0,2 mg/L", "limite": 0.2, "citacao": "Art. 32: mínimo de 0,2 mg/L de cloro residual livre em toda a extensão do sistema de distribuição e nos pontos de consumo"},
    "turbidez": {"regra": "acima de 5,0 uT", "limite": 5.0, "citacao": "Art. 28, § 2º: VMP de 5,0 uT em toda a extensão do sistema de distribuição ou pontos de consumo"},
    "cor": {"regra": "acima de 15 uH", "limite": 15.0, "citacao": "Anexo 11 (padrão organoléptico): VMP de 15 uH para cor aparente"},
    "fluoreto": {"regra": "acima de 1,5 mg/L", "limite": 1.5, "citacao": "Anexo 9 (substâncias químicas que representam risco à saúde): VMP de 1,5 mg/L"},
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
    "cor": {
        "Número de amostras analisadas": "analisadas",
        "Número de dados > 15,0 uH": "fora",
        "Número de dados <= 15,0 uH": "dentro",
        "Percentil 95": None,
    },
    "fluoreto": {
        "Número de amostras analisadas": "analisadas",
        "Número de dados > 1,5 mg/L": "fora",
        "Número de dados <= 1,5 mg/L": "dentro",
        # faixas de fluoretação (Anexo XXI da PRC 5/2017), sem o valor no rótulo; não usadas
        "Número de dados <": None,
        "Número de dados >": None,
        "Número de dados >=": None,
        "Média das temperaturas máximas diárias(°C)": None,
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


def ler_csv(zpath, cabecalho, alternativos=()):
    """Itera o único CSV do ZIP (latin-1, separador ';'), conferindo o cabeçalho.

    O primeiro item é o índice nome → coluna, com os nomes do cabeçalho canônico; os
    seguintes são as linhas. Um cabeçalho alternativo só vale se listado com seus nomes."""
    with zipfile.ZipFile(zpath) as z:
        nomes = [n for n in z.namelist() if n.lower().endswith(".csv")]
        if len(nomes) != 1:
            raise ValueError(f"{zpath}: esperado um CSV, encontrados {nomes}")
        yield from _linhas(z, nomes[0], zpath, cabecalho, alternativos)


def _linhas(z, nome, zpath, cabecalho, alternativos):
    with z.open(nome) as f:
        r = csv.reader(io.TextIOWrapper(f, encoding="latin-1", newline=""), delimiter=";")
        cab = next(r)
        if cab == cabecalho:
            yield {c: i for i, c in enumerate(cab)}
        else:
            alt = next((a for a in alternativos if a["cabecalho"] == cab), None)
            if alt is None:
                raise ValueError(f"{zpath}: cabeçalho mudou: {cab}")
            yield {alt["nomes"].get(c, c): i for i, c in enumerate(cab)}
        largura = len(cab)
        for linha in r:
            if len(linha) != largura:
                raise ValueError(f"{zpath}: linha com {len(linha)} colunas")
            yield linha


def mais(d, k, n=1):
    d[k] = d.get(k, 0) + n


def desconhecido(valor, conhecidos, onde):
    if valor not in conhecidos:
        raise ValueError(f"{onde}: rótulo não previsto {valor!r}")


# ---------------------------------------------------------------------------
# agregação de cada conjunto
# ---------------------------------------------------------------------------

def agregar_controle(zpath, ano):
    """Controle mensal, parâmetros básicos: contadores por forma × mês × ponto × parâmetro.

    Devolve os contadores municipais da rede e do consumo; as análises de coliformes totais
    de cada forma de abastecimento, para o plano de amostragem; e o conjunto de formas com
    algum registro no ano, para o cadastro."""
    linhas = ler_csv(zpath, CAB_CONTROLE, (CONTROLE_2014,))
    I = next(linhas)
    exc = {}
    formas = {}
    formas_ano = set()
    grupos = {}
    for l in linhas:
        if l[I["Ano de referência"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        mun = municipio(l[I["Código IBGE"]], exc)
        if mun is None:
            continue
        forma = l[I["Código Forma de abastecimento"]].strip()
        formas.setdefault(mun, set()).add(forma)
        formas_ano.add(forma)
        rot_par = l[I["Parâmetro"]].strip()
        ponto = l[I["Ponto de Monitoramento"]].strip()
        desconhecido(ponto, PONTOS_CONHECIDOS, "controle, ponto")
        par = PARAM_CONTROLE.get(rot_par)
        if par is None:
            desconhecido(rot_par, OUTROS_PARAM_CONTROLE, "controle, parâmetro")
            continue
        if ponto not in PONTOS_CONTROLE:
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
        v = l[I["Valor"]].strip()
        if papel in g:
            # o mesmo campo repetido com outro nome de ETA/UTA (raro, desde 2023): mesmo valor conta uma vez
            mais(exc, f"linha_repetida_{par}")
            if g[papel] != v:
                g["conflito"] = True
            continue
        g[papel] = v
    mun_out = {}
    realizadas = {}
    for (mun, original, forma, tipo, _mes, ponto, par), g in sorted(grupos.items()):
        if g.get("conflito"):
            mais(exc, f"grupo_com_repeticao_divergente_{par}")
            continue
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
        # plano: SAA mede na rede; SAC registra no ponto de consumo o que o plano chama de distribuição
        if par == "coliformes" and (ponto == "SISTEMA DE DISTRIBUIÇÃO" or tipo == "SAC"):
            mais(realizadas, (tipo, mun, original, forma), a)
    for mun, fs in formas.items():
        mun_out.setdefault(mun, {})["formas"] = len(fs)
    return mun_out, realizadas, formas_ano, exc


def agregar_plano(zpath, ano, realizadas):
    """Plano de amostragem: análises de coliformes totais exigidas pela norma (Anexos 14 e 15)
    na distribuição de cada SAA e no ponto de consumo de cada SAC, cruzadas com as realizadas.

    Coberta = min(realizada, exigida) por forma de abastecimento: excesso em um sistema
    não compensa falta em outro. Para SAC, o plano registra a exigência como "sistema de
    distribuição" (às vezes "ponto de consumo") e o controle registra as análises no ponto de
    consumo; os dois são tratados como o mesmo ponto, o único da solução alternativa depois do tratamento."""
    linhas = ler_csv(zpath, CAB_PLANO)
    I = next(linhas)
    exc = {}
    exigidas = {}
    for l in linhas:
        if l[I["NU_ANO"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        tipo = l[I["TP_ABASTECIMENTO"]].strip()
        ponto = l[I["PT_MONITORAMENTO"]].strip()
        pontos = {"SISTEMA DE DISTRIBUIÇÃO"} if tipo == "SAA" else {"SISTEMA DE DISTRIBUIÇÃO", "PONTO DE CONSUMO"}
        if (tipo not in ("SAA", "SAC") or ponto not in pontos
                or l[I["PARAMETRO"]].strip() != "Coliformes totais" or l[I["CAMPO"]].strip() != "Total Anual de Análises"):
            continue
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc)
        if mun is None:
            continue
        v = inteiro(l[I["VALOR"]])
        # a mesma forma aparece repetida com razões habitantes/domicílio diferentes; o valor é o mesmo
        chave = (tipo, mun, l[I["CO_MUNICIPIO_IBGE"]].strip(), l[I["NU_SOLUCAO_ABASTECIMENTO"]].strip())
        exigidas.setdefault(chave, {}).setdefault(ponto, set()).add(v)
    out = {}
    for tipo in ("SAA", "SAC"):
        t = tipo.lower()
        real = {k[1:]: v for k, v in realizadas.items() if k[0] == tipo}
        exig = {k[1:]: v for k, v in exigidas.items() if k[0] == tipo}
        formas_controle = {f for (_m, _o, f) in real}
        com_plano = {(o, f) for (_m, o, f) in exig}
        sem_plano = [(k, v) for k, v in real.items() if (k[1], k[2]) not in com_plano]
        exc[f"{t}_formas_com_controle_sem_plano"] = len(sem_plano)
        exc[f"{t}_analises_de_formas_sem_plano"] = sum(v for _, v in sem_plano)
        for (mun, original, forma), por_ponto in sorted(exig.items()):
            vals = set().union(*por_ponto.values())
            if len(por_ponto) != 1 or len(vals) != 1 or None in vals:
                mais(exc, f"{t}_forma_com_valor_conflitante_ou_invalido")
                continue
            e = vals.pop()
            if e == 0:
                mais(exc, f"{t}_forma_sem_exigencia")
                continue
            r = real.get((mun, original, forma), 0)
            m = out.setdefault(mun, {}).setdefault(t, {"cobertas": 0, "exigidas": 0, "realizadas": 0, "formas": 0, "formas_sem_controle": 0})
            m["cobertas"] += min(r, e)
            m["exigidas"] += e
            m["realizadas"] += r
            m["formas"] += 1
            if (mun, original, forma) not in real:
                m["formas_sem_controle"] += 1
                if forma in formas_controle:
                    # sistema que atende vários municípios e registrou as análises em outro município
                    mais(exc, f"{t}_formas_com_controle_em_outro_municipio")
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
    linhas = ler_csv(zpath, CAB_VIGILANCIA)
    I = next(linhas)
    exc = {}
    vistos = set()
    mun_out = {}
    nacional = {}
    for l in linhas:
        if l[I["NU_ANO"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc)
        if mun is None:
            continue
        m = mun_out.setdefault(mun, {"analises": 0})
        m["analises"] += 1
        rot_par = l[I["PARAMETRO"]].strip()
        par = PARAM_VIGILANCIA.get(rot_par)
        if par is None:
            desconhecido(rot_par, OUTROS_PARAM_VIGILANCIA, "vigilância, parâmetro")
            continue
        chave = hashlib.blake2b("\x1f".join((l[I["CO_MUNICIPIO_IBGE"]].strip(), l[I["NU_SOLUCAO_ABASTECIMENTO"]].strip(), l[I["NU_AMOSTRA"]].strip(),
                                             par, l[I["DT_COLETA"]].strip())).encode(), digest_size=12).digest()
        if chave in vistos:
            mais(exc, "duplicata")
            continue
        vistos.add(chave)
        motivo = l[I["TP_MOTIVO_COLETA"]].strip()
        desconhecido(motivo, MOTIVOS_VIGILANCIA, "vigilância, motivo")
        if motivo != "Rotina":
            mais(exc, "motivo_" + slug(motivo))
            continue
        tipo = l[I["TP_ABASTECIMENTO"]].strip()
        desconhecido(tipo, TIPOS_VIGILANCIA, "vigilância, tipo de abastecimento")
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


def agregar_cadastro(zpath, formas_por_ano):
    """Cadastro, população abastecida: população estimada de cada forma de abastecimento,
    somada por município e tipo, e a parte sob formas com algum registro de controle no ano.

    A junção com o controle é pelo código da forma, em qualquer município: o código identifica
    o sistema, e um sistema que atende vários municípios registra as análises onde coleta."""
    linhas = ler_csv(zpath, CAB_CADASTRO)
    I = next(linhas)
    anos = {str(a): set(f) for a, f in formas_por_ano.items()}
    out = {a: {} for a in anos}
    exc = {a: {} for a in anos}
    for l in linhas:
        ano = l[I["NU_ANO"]].strip()
        if ano not in anos:
            continue
        tipo = l[I["TP_ABASTECIMENTO"]].strip()
        if tipo not in ("SAA", "SAC", "SAI"):
            raise ValueError(f"cadastro, tipo não previsto {tipo!r}")
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc[ano])
        if mun is None:
            continue
        pop = inteiro(l[I["NU_VALOR_POPULACAO_ESTIMADA"]])
        if pop is None:
            mais(exc[ano], f"populacao_vazia_ou_invalida_{tipo.lower()}")
            continue
        com = tipo != "SAI" and l[I["NU_SOLUCAO_ABASTECIMENTO"]].strip() in anos[ano]
        acc = out[ano].setdefault(mun, {}).setdefault(tipo.lower(), [0, 0, 0, 0])
        acc[0] += pop if com else 0
        acc[1] += pop
        acc[2] += 1 if com else 0
        acc[3] += 1
    return out, exc


def agregar_fora_padrao(zpath, anos):
    """Amostras do controle fora do padrão (arquivo único com todos os anos), por ano e parâmetro.

    Serve só de conferência: o dicionário diz que o registro do resultado fora do padrão
    não é obrigatório, então o arquivo pode ficar abaixo dos contadores do controle mensal."""
    linhas = ler_csv(zpath, CAB_FORA)
    I = next(linhas)
    out = {str(a): {} for a in anos}
    for l in linhas:
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


def coletar(anos=ANOS_SERIE, zips=None):
    """Sem `zips`, baixa para uma pasta temporária apagada ao fim, com ou sem erro."""
    if zips:
        return _coletar(anos, zips)
    with tempfile.TemporaryDirectory(prefix="sisagua-") as pasta:
        return _coletar(anos, pasta)


def _coletar(anos, pasta):
    arquivos = []
    dados = {}
    formas_por_ano = {}
    for ano in anos:
        c_path, c_prov = obter(fontes.sisagua_url("controle", ano), pasta)
        controle, realizadas, formas_ano, exc_c = agregar_controle(c_path, ano)
        arquivos.append({"conjunto": "controle", "ano": ano, **c_prov})
        plano, exc_p = {}, {}
        if ano >= ANO_INICIAL_PLANO:
            p_path, p_prov = obter(fontes.sisagua_url("plano", ano), pasta)
            plano, exc_p = agregar_plano(p_path, ano, realizadas)
            arquivos.append({"conjunto": "plano", "ano": ano, **p_prov})
        v_path, v_prov = obter(fontes.sisagua_url("vigilancia", ano), pasta)
        vig, nacional, exc_v = agregar_vigilancia(v_path, ano)
        arquivos.append({"conjunto": "vigilancia", "ano": ano, **v_prov})
        formas_por_ano[ano] = formas_ano
        dados[ano] = {"ano": ano, "controle": controle, "plano": plano, "vigilancia": vig, "vigilancia_nacional": nacional,
                      "exclusoes": {"controle": exc_c, "plano": exc_p, "vigilancia": exc_v}}
        print(ano, "controle", len(controle), "plano", len(plano), "vigilancia", len(vig), flush=True)
    k_path, k_prov = obter(fontes.SISAGUA["cadastro"], pasta)
    cadastro, exc_k = agregar_cadastro(k_path, formas_por_ano)
    arquivos.append({"conjunto": "cadastro", "ano": None, **k_prov})
    seeds = {}
    for ano in anos:
        dados[ano]["cadastro"] = cadastro[str(ano)]
        dados[ano]["exclusoes"]["cadastro"] = exc_k[str(ano)]
        seeds[f"sisagua_{ano}.json.gz"] = gravar(f"sisagua_{ano}.json.gz", dados[ano])
    f_path, f_prov = obter(fontes.SISAGUA["fora_padrao"], pasta)
    seeds["sisagua_fora_padrao.json.gz"] = gravar("sisagua_fora_padrao.json.gz", agregar_fora_padrao(f_path, anos))
    arquivos.append({"conjunto": "fora_padrao", "ano": None, **f_prov})
    manifesto = {
        "capturado_em": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "anos": list(anos),
        "ano_inicial_plano": ANO_INICIAL_PLANO,
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


# Medidas municipais: (id, conjunto, chave). Numerador e denominador por município e ano.
MEDIDAS = [
    ("ctrl_ecoli", "controle", "ecoli"),
    ("ctrl_colif", "controle", "coliformes"),
    ("ctrl_cloro", "controle", "cloro"),
    ("ctrl_turb", "controle", "turbidez"),
    ("ctrl_cor", "controle", "cor"),
    ("ctrl_fluor", "controle", "fluoreto"),
    ("vig_ecoli", "vigilancia", "ecoli"),
    ("vig_cloro", "vigilancia", "cloro"),
    ("vig_fluor", "vigilancia", "fluoreto"),
    ("plano", "plano", "saa"),
    ("plano_sac", "plano", "sac"),
    ("pop_saa", "cadastro", "saa"),
    ("pop_sac", "cadastro", "sac"),
]


def valor(s, conjunto, chave, mun):
    """[numerador, denominador] da medida no município, ou [None, None] sem denominador positivo."""
    reg = s[conjunto].get(mun) or {}
    v = reg.get(chave)
    if v is None:
        return [None, None]
    num, den = (v["cobertas"], v["exigidas"]) if conjunto == "plano" else (v[0], v[1])
    return [num, den] if den else [None, None]


def campos(anos=ANOS_ATLAS):
    """Colunas do arquivo complementar qualidade_municipios, sem o id."""
    out = []
    for ano in anos:
        out += [f"qa_reg_ctrl_{ano}", f"qa_reg_vig_{ano}"]
        for mid, _, _ in MEDIDAS:
            out += [f"qa_{mid}_{ano}_num", f"qa_{mid}_{ano}_den"]
    return out


def construir(ids6, uf_de=None):
    """Campos municipais (anos do atlas), auditoria por ano e série por território para meta.json.

    ids6: códigos de 6 dígitos dos municípios do IBGE; uf_de: código → sigla da UF."""
    with open(os.path.join(SEED, "manifesto.json"), encoding="utf-8") as f:
        manifesto = json.load(f)
    fora = ler("sisagua_fora_padrao.json.gz", manifesto)
    universo = set(ids6)
    uf_de = uf_de or {}
    linhas = {i: {} for i in universo}
    auditoria = {"anos": manifesto["anos"], "anos_atlas": list(ANOS_ATLAS), "ano_inicial_plano": manifesto.get("ano_inicial_plano"),
                 "proveniencia": manifesto, "limites": LIMITES, "por_ano": {}, "serie": {}}
    for ano in manifesto["anos"]:
        s = ler(f"sisagua_{ano}.json.gz", manifesto)
        ctrl = {i for i in universo if s["controle"].get(i)}
        vig = {i for i in universo if s["vigilancia"].get(i)}
        if ano in ANOS_ATLAS:
            for i, l in linhas.items():
                l[f"qa_reg_ctrl_{ano}"] = 1 if i in ctrl else 0
                l[f"qa_reg_vig_{ano}"] = 1 if i in vig else 0
                for mid, conjunto, chave in MEDIDAS:
                    l[f"qa_{mid}_{ano}_num"], l[f"qa_{mid}_{ano}_den"] = valor(s, conjunto, chave, i)

        # série: Brasil e UFs, sempre pela soma de numeradores e denominadores municipais
        serie = {}
        for i in sorted(universo):
            for t in ("BR", uf_de.get(i)):
                if t is None:
                    continue
                d = serie.setdefault(t, {"municipios": [0, 0, 0, 0], "medidas": {}})
                d["municipios"][0] += i in ctrl
                d["municipios"][1] += i in vig
                d["municipios"][2] += i in ctrl and i in vig
                d["municipios"][3] += 1
                for mid, conjunto, chave in MEDIDAS:
                    num, den = valor(s, conjunto, chave, i)
                    if den:
                        acc = d["medidas"].setdefault(mid, [0, 0, 0])
                        acc[0] += num
                        acc[1] += den
                        acc[2] += 1
        auditoria["serie"][str(ano)] = serie

        def soma(conjunto, chave, idx):
            return sum(m[chave][idx] for k, m in s[conjunto].items() if k in universo and chave in m)

        plano = {}
        for t in ("saa", "sac"):
            regs = [m[t] for i, m in s["plano"].items() if i in universo and t in m]
            plano[t] = {k: sum(r[k] for r in regs) for k in ("cobertas", "exigidas", "realizadas", "formas", "formas_sem_controle")} if regs else None
        auditoria["por_ano"][str(ano)] = {
            "municipios": {"universo": len(universo), "controle": len(ctrl), "vigilancia": len(vig),
                           "ambos": len(ctrl & vig), "nenhum": len(universo - ctrl - vig)},
            "codigos_fora_do_universo": {k: sorted(set(s[k]) - universo) for k in ("controle", "plano", "vigilancia", "cadastro")},
            "exclusoes": s["exclusoes"],
            "vigilancia_nacional": s["vigilancia_nacional"],
            # compatível com a primeira edição: plano dos SAA no nível de cima
            "plano": plano["saa"],
            "plano_sac": plano["sac"],
            "cadastro": {t: [sum(m[t][k] for i, m in s["cadastro"].items() if i in universo and t in m) for k in range(4)]
                         for t in ("saa", "sac", "sai")},
            "conferencia_fora_padrao": [
                {"parametro": par, "controle_mensal": soma("controle", par, 0),
                 "arquivo_fora_do_padrao": fora[str(ano)].get(par, 0),
                 "diferenca": fora[str(ano)].get(par, 0) - soma("controle", par, 0)}
                for par in PARAMETROS
            ],
        }
    return linhas, auditoria


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--coletar", action="store_true")
    ap.add_argument("--anos", default=",".join(map(str, ANOS_SERIE)))
    ap.add_argument("--zips")
    a = ap.parse_args()
    if a.coletar:
        coletar(tuple(int(x) for x in a.anos.split(",")), a.zips)
