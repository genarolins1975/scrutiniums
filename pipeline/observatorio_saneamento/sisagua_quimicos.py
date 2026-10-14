"""SISAGUA: substâncias químicas, radioatividade e cianotoxinas na água tratada.

Complementa sisagua.py com quatro conjuntos de dados abertos do Ministério da Saúde:
- controle semestral (análises de alta complexidade do prestador), um arquivo por ano;
- vigilância, demais parâmetros (análises de alta complexidade da secretaria de saúde);
- vigilância, cianobactérias e cianotoxinas;
- controle mensal, demais parâmetros (monitoramento do manancial: só contexto).

Regras:
- O valor máximo permitido (VMP) vem sempre da Portaria GM/MS 888/2021, por uma tabela
  explícita (VMP abaixo), casada por nome e unidade. O VMP gravado no arquivo é conferido
  e as divergências (VMP da norma anterior, Portaria 2914/2011) são contadas.
- Só água tratada entra na comparação com o VMP: saída do tratamento, sistema de
  distribuição e ponto de consumo. Água bruta (ponto de captação) fica de fora.
- "Análise acima do VMP" é contagem pontual. A conformidade legal de alguns parâmetros
  segue outra regra (média móvel de 12 meses para subprodutos da desinfecção, Art. 40;
  soma de razões para nitrato e nitrito, Art. 39); radioatividade é nível de triagem (Art. 37).

Coleta:
    python3 -m pipeline.observatorio_saneamento.sisagua_quimicos --coletar [--zips DIR]
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import tempfile
import unicodedata

from . import fontes
from .sisagua import SEED, documento, gravar, mais, municipio, obter, ler_csv

ANOS = (2024, 2025)

# ---------------------------------------------------------------------------
# VMP da Portaria GM/MS 888/2021 (Anexo XX da Portaria de Consolidação 5/2017)
# ---------------------------------------------------------------------------

# grupo → anexo; radioatividade é nível de triagem do Art. 37
GRUPOS = {
    "agrotoxicos": "Anexo 9, agrotóxicos e metabólitos",
    "inorganicas": "Anexo 9, substâncias inorgânicas",
    "organicas": "Anexo 9, substâncias orgânicas",
    "subprodutos": "Anexo 9, subprodutos da desinfecção",
    "organolepticos": "Anexo 11, padrão organoléptico",
    "radioatividade": "Art. 37, níveis de triagem",
}

# (grupo, nome na Portaria, unidade, VMP)
VMP = [
    ("inorganicas", "Antimônio", "mg/L", 0.006), ("inorganicas", "Arsênio", "mg/L", 0.01),
    ("inorganicas", "Bário", "mg/L", 0.7), ("inorganicas", "Cádmio", "mg/L", 0.003),
    ("inorganicas", "Chumbo", "mg/L", 0.01), ("inorganicas", "Cobre", "mg/L", 2.0),
    ("inorganicas", "Cromo", "mg/L", 0.05), ("inorganicas", "Fluoreto", "mg/L", 1.5),
    ("inorganicas", "Mercúrio Total", "mg/L", 0.001), ("inorganicas", "Níquel", "mg/L", 0.07),
    ("inorganicas", "Nitrato (como N)", "mg/L", 10.0), ("inorganicas", "Nitrito (como N)", "mg/L", 1.0),
    ("inorganicas", "Selênio", "mg/L", 0.04), ("inorganicas", "Urânio", "mg/L", 0.03),
    ("organicas", "1,2 Dicloroetano", "µg/L", 5.0), ("organicas", "Acrilamida", "µg/L", 0.5),
    ("organicas", "Benzeno", "µg/L", 5.0), ("organicas", "Benzo[a]pireno", "µg/L", 0.4),
    ("organicas", "Cloreto de Vinila", "µg/L", 0.5), ("organicas", "Di(2-etilhexil) ftalato", "µg/L", 8.0),
    ("organicas", "Diclorometano", "µg/L", 20.0), ("organicas", "Dioxano", "µg/L", 48.0),
    ("organicas", "Epicloridrina", "µg/L", 0.4), ("organicas", "Etilbenzeno", "µg/L", 300.0),
    ("organicas", "Pentaclorofenol", "µg/L", 9.0), ("organicas", "Tetracloreto de Carbono", "µg/L", 4.0),
    ("organicas", "Tetracloroeteno", "µg/L", 40.0), ("organicas", "Tolueno", "µg/L", 30.0),
    ("organicas", "Tricloroeteno", "µg/L", 4.0), ("organicas", "Xilenos", "µg/L", 500.0),
    ("agrotoxicos", "2,4 D", "µg/L", 30.0), ("agrotoxicos", "Alacloro", "µg/L", 20.0),
    ("agrotoxicos", "Aldicarbe + Aldicarbesulfona + Aldicarbesulfóxido", "µg/L", 10.0),
    ("agrotoxicos", "Aldrin + Dieldrin", "µg/L", 0.03), ("agrotoxicos", "Ametrina", "µg/L", 60.0),
    ("agrotoxicos", "Atrazina + S-Clorotriazinas", "µg/L", 2.0), ("agrotoxicos", "Carbendazim", "µg/L", 120.0),
    ("agrotoxicos", "Carbofurano", "µg/L", 7.0), ("agrotoxicos", "Ciproconazol", "µg/L", 30.0),
    ("agrotoxicos", "Clordano", "µg/L", 0.2), ("agrotoxicos", "Clorotalonil", "µg/L", 45.0),
    ("agrotoxicos", "Clorpirifós + clorpirifós-oxon", "µg/L", 30.0), ("agrotoxicos", "DDT + DDD + DDE", "µg/L", 1.0),
    ("agrotoxicos", "Difenoconazol", "µg/L", 30.0), ("agrotoxicos", "Dimetoato + ometoato", "µg/L", 1.2),
    ("agrotoxicos", "Diuron", "µg/L", 20.0), ("agrotoxicos", "Epoxiconazol", "µg/L", 60.0),
    ("agrotoxicos", "Fipronil", "µg/L", 1.2), ("agrotoxicos", "Flutriafol", "µg/L", 30.0),
    ("agrotoxicos", "Glifosato + AMPA", "µg/L", 500.0), ("agrotoxicos", "Hidroxi-Atrazina", "µg/L", 120.0),
    ("agrotoxicos", "Lindano (gama HCH)", "µg/L", 2.0), ("agrotoxicos", "Malationa", "µg/L", 60.0),
    ("agrotoxicos", "Mancozebe + ETU", "µg/L", 8.0), ("agrotoxicos", "Metamidofós + Acefato", "µg/L", 7.0),
    ("agrotoxicos", "Metolacloro", "µg/L", 10.0), ("agrotoxicos", "Metribuzim", "µg/L", 25.0),
    ("agrotoxicos", "Molinato", "µg/L", 6.0), ("agrotoxicos", "Paraquate", "µg/L", 13.0),
    ("agrotoxicos", "Picloram", "µg/L", 60.0), ("agrotoxicos", "Profenofós", "µg/L", 0.3),
    ("agrotoxicos", "Propargito", "µg/L", 30.0), ("agrotoxicos", "Protioconazol + ProticonazolDestio", "µg/L", 3.0),
    ("agrotoxicos", "Simazina", "µg/L", 2.0), ("agrotoxicos", "Tebuconazol", "µg/L", 180.0),
    ("agrotoxicos", "Terbufós", "µg/L", 1.2), ("agrotoxicos", "Tiametoxam", "µg/L", 36.0),
    ("agrotoxicos", "Tiodicarbe", "µg/L", 90.0), ("agrotoxicos", "Tiram", "µg/L", 6.0),
    ("agrotoxicos", "Trifluralina", "µg/L", 20.0),
    ("subprodutos", "2,4,6 Triclorofenol", "mg/L", 0.2), ("subprodutos", "2,4-diclorofenol", "mg/L", 0.2),
    ("subprodutos", "Ácidos haloacéticos total", "mg/L", 0.08), ("subprodutos", "Bromato", "mg/L", 0.01),
    ("subprodutos", "Cloraminas Total", "mg/L", 4.0), ("subprodutos", "Clorato", "mg/L", 0.7),
    ("subprodutos", "Clorito", "mg/L", 0.7), ("subprodutos", "N-nitrosodimetilamina", "mg/L", 0.0001),
    ("subprodutos", "Trihalometanos Total", "mg/L", 0.1),
    ("organolepticos", "Alumínio", "mg/L", 0.2), ("organolepticos", "Amônia (como N)", "mg/L", 1.2),
    ("organolepticos", "Cloreto", "mg/L", 250.0), ("organolepticos", "Cor Aparente", "uH", 15.0),
    ("organolepticos", "1,2 diclorobenzeno", "mg/L", 0.001), ("organolepticos", "1,4 diclorobenzeno", "mg/L", 0.0003),
    ("organolepticos", "Dureza total", "mg/L", 300.0), ("organolepticos", "Ferro", "mg/L", 0.3),
    ("organolepticos", "Gosto e odor", "Intensidade", 6.0), ("organolepticos", "Manganês", "mg/L", 0.1),
    ("organolepticos", "Monoclorobenzeno", "mg/L", 0.02), ("organolepticos", "Sódio", "mg/L", 200.0),
    ("organolepticos", "Sólidos dissolvidos totais", "mg/L", 500.0), ("organolepticos", "Sulfato", "mg/L", 250.0),
    ("organolepticos", "Sulfeto de hidrogênio", "mg/L", 0.05), ("organolepticos", "Turbidez", "uT", 5.0),
    ("organolepticos", "Zinco", "mg/L", 5.0),
    ("radioatividade", "Atividade alfa total", "Bq/L", 0.5), ("radioatividade", "Atividade beta total", "Bq/L", 1.0),
]

# Anexo 10: cianotoxinas, µg/L
VMP_CIANOTOXINAS = {"microcistina": 1.0, "saxitoxina": 3.0, "cilindrospermopsina": 1.0}

# Grafias do SISAGUA diferentes da Portaria (nome normalizado → nome da Portaria)
SINONIMOS = {
    "alaclor": "Alacloro",
    "2,4diclorofenol": "2,4-diclorofenol",
    "mercurio": "Mercúrio Total",
    # Art. 37, § 2º: após a subtração do K-40, os mesmos níveis de triagem
    "atividadealfatotal(apossubtracaodek-40)": "Atividade alfa total",
    "atividadebetatotal(apossubtracaodek-40)": "Atividade beta total",
}

# Grupos do arquivo que não têm VMP na Portaria 888 (conhecidos; ficam fora e são contados)
GRUPOS_SEM_VMP = {"outros"}


def chave_nome(t):
    """Nome normalizado: sem acento, minúsculo, sem espaços; trecho entre parênteses das
    triazinas cortado (a Portaria lista os metabólitos no mesmo item)."""
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\(dee?til-atrazina.*$", "", t)
    return re.sub(r"\s+", "", t)


def unidade(t):
    return t.strip().replace("μ", "µ").replace(" ", "")


def grupo_arquivo(t):
    t = chave_nome(re.sub(r"\s*-\s*\d.*$", "", t))  # "Produtos Secundários de Desinfecção - 1º Bimestre"
    return {
        "agrotoxicos": "agrotoxicos", "substanciasinorganicas": "inorganicas", "substanciasorganicas": "organicas",
        "produtossecundariosdedesinfeccao": "subprodutos", "parametrosorganolepticos": "organolepticos",
        "radioatividade": "radioatividade", "outros": "outros",
    }.get(t)


TABELA = {}
for _g, _n, _u, _v in VMP:
    TABELA[(_g, chave_nome(_n))] = (_n, unidade(_u), _v)


def vmp_de(grupo, nome):
    """(nome da Portaria, unidade, VMP) do parâmetro no grupo, ou None."""
    k = chave_nome(nome)
    k = chave_nome(SINONIMOS.get(k, nome))
    return TABELA.get((grupo, k))


NUM = re.compile(r"^\d+(?:[.,]\d*)?(?:[eE][-+]?\d+)?$")


def valor(t):
    t = t.strip()
    if not NUM.match(t):
        return None
    return float(t.replace(",", "."))


def classificar(resultado, ld, lq, vmp):
    """'fora', 'dentro', 'limite' (abaixo de LD/LQ maior que o VMP) ou 'invalido'."""
    r = resultado.strip()
    if r in ("MENOR_LD", "MENOR_LQ"):
        ref = valor(lq if r == "MENOR_LQ" else ld)
        return "dentro" if ref is not None and ref <= vmp else "limite"
    v = valor(r)
    if v is None:
        return "invalido"
    return "fora" if v > vmp else "dentro"


# ---------------------------------------------------------------------------
# agregação
# ---------------------------------------------------------------------------

CAB_SEMESTRAL = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "TP_INSTITUICAO", "SG_INSTITUICAO",
    "NO_INSTITUICAO", "NU_CNPJ_INSTITUICAO", "NO_ESCRITORIO_REGIONAL_LOCAL", "NU_CNPJ_ESCRITORIO_REGIONAL_LOCAL",
    "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NO_ETA", "NU_ANO", "NU_SEMESTRE",
    "TP_TRIMESTRE", "DT_INCLUSAO_REGISTRO", "DT_FORMULARIO_CADASTRO", "DT_COLETA", "DT-ANALISE", "PT_MONITORAMENTO",
    "GRUPO_PARAMETROS", "PAARAMETRO", "TP_CAPTACAO", "CAT_MANANCIAL_SUPERFICIAL", "NO_MANANCIAL_SUPERFICIAL",
    "CAT_PT_CAPTACAO_SUBTERRANEA", "NO_PT_CAPTACAO_SUBTERRANEA", "AMOSTRA", "UNIDADE", "VMP", "LD", "LQ", "RESULTADO",
]
CAB_VIG_DEMAIS = [
    "Região Geográfica", "UF", "Regional de Saúde", "Município", "Código IBGE", "Número da amostra", "Motivo da coleta",
    "Tipo da Forma de Abastecimento", "Código Forma de abastecimento", "Nome da Forma de Abastecimento", "Nome da ETA/UTA",
    "Ano", "Mês", "Data da Coleta", "Hora da coleta", "Data do Laudo", "Data de Registro no SISAGUA",
    "Procedência da Coleta", "Ponto de Coleta", "Descrição do Local", "Zona", "Categoria Área", "Área", "Tipo do local",
    "Local", "Latitude", "Longitude", "Grupo de parâmetros", "Parâmetro (demais parâmetros)", "Data da análise", "LD",
    "LQ", "Resultado",
]
CAB_VIG_CIANO = [
    "Região Geográfica", "UF", "Regional de Saúde", "Município", "Código IBGE", "Número da amostra", "Motivo da Coleta",
    "Tipo da Forma de Abastecimento", "Código Forma de Abastecimento", "Nome da Forma de Abastecimento", "Nome da ETA/UTA",
    "Ano", "Mês", "Data da Coleta", "Hora da coleta", "Data do Laudo", "Data de Registro no SISAGUA",
    "Procedência da Coleta", "Ponto de Coleta", "Descrição do Local", "Zona", "Categoria Área", "Área", "Tipo do Local",
    "Local", "Latitude", "Longitude", "Grupo", "Parâmetro (ciano)", "Resultado",
]
CAB_CTRL_DEMAIS = [
    "NO_REGIAO", "SG_UF", "NO_REGIONAL", "NO_MUNICIPIO", "CO_MUNICIPIO_IBGE", "TP_EMPRESA", "SG_INSTITUICAO",
    "NO_INSTITUICAO", "NU_CNPJ_INSTITUICAO", "NO_ESCRITORIO_REGIONAL_LOCAL", "NU_CNPJ_ESCRITORIO_REGIONAL_LOCAL",
    "TP_ABASTECIMENTO", "NU_SOLUCAO_ABASTECIMENTO", "NO_SOLUCAO_ABASTECIMENTO", "NO_ETA", "NU_ANO", "NU_MES",
    "DT_INCLUSAO_REGISTRO", "DT_FORMULARIO_CADASTRO", "DT_COLETA_AMOSTRA", "TP_CAPTACAO", "NO_CATEGORIA_MANANCIAL",
    "NO_MANANCIAL", "TP_CATEGORIA_CAPT_SUB", "NO_PONTO_CAPTACAO", "PARAMETRO", "UNIDADE", "RESULTADO",
]

PONTOS_TRATADA_CONTROLE = {"SAÍDA DO TRATAMENTO", "SISTEMA DE DISTRIBUIÇÃO", "PONTO DE CONSUMO"}
PONTOS_CONHECIDOS_CONTROLE = PONTOS_TRATADA_CONTROLE | {"PONTO DE CAPTAÇÃO"}


def tratada_vigilancia(tipo, procedencia, ponto):
    """Água tratada na vigilância: rede de SAA, saída do tratamento de SAA e SAC, ponto de consumo de SAC."""
    if tipo == "SAA" and procedencia == "SISTEMA DE DISTRIBUIÇÃO":
        return True
    if tipo in ("SAA", "SAC") and ponto == "Saída de tratamento/pós-desinfecção":
        return True
    return tipo == "SAC" and procedencia == "SOLUÇÃO ALTERNATIVA" and ponto != "Água pós-filtração/pré-desinfecção"


def _acumula(mun_out, nacional, mun, grupo, nome, c):
    n = nacional.setdefault(f"{grupo}|{nome}", [0, 0, 0])
    if c in ("fora", "dentro"):
        n[0] += c == "fora"
        n[1] += 1
        acc = mun_out.setdefault(mun, {}).setdefault(grupo, [0, 0])
        acc[0] += c == "fora"
        acc[1] += 1


def agregar_semestral(zpath, ano):
    linhas = ler_csv(zpath, CAB_SEMESTRAL)
    I = next(linhas)
    exc, mun_out, nacional, registro = {}, {}, {}, {}
    for l in linhas:
        if l[I["NU_ANO"]].strip() != str(ano):
            raise ValueError("ano diferente do arquivo")
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], exc)
        if mun is None:
            continue
        ponto = l[I["PT_MONITORAMENTO"]].strip()
        if ponto not in PONTOS_CONHECIDOS_CONTROLE:
            raise ValueError(f"controle semestral, ponto não previsto {ponto!r}")
        if ponto not in PONTOS_TRATADA_CONTROLE:
            mais(exc, "agua_bruta")
            continue
        grupo = grupo_arquivo(l[I["GRUPO_PARAMETROS"]])
        if grupo is None:
            raise ValueError(f"controle semestral, grupo não previsto {l[I['GRUPO_PARAMETROS']]!r}")
        registro[mun] = registro.get(mun, 0) + 1
        if grupo in GRUPOS_SEM_VMP:
            mais(exc, "sem_vmp_na_portaria")
            continue
        nome = l[I["PAARAMETRO"]].strip()
        ref = vmp_de(grupo, nome)
        if ref is None:
            mais(exc, f"sem_vmp_na_portaria_{grupo}")
            mais(exc, "parametro_sem_vmp:" + nome)
            continue
        nome_p, unid, vmp = ref
        if unidade(l[I["UNIDADE"]]) != unid:
            mais(exc, f"unidade_divergente_{grupo}")
            continue
        vmp_arq = valor(l[I["VMP"]])
        if vmp_arq is not None and abs(vmp_arq - vmp) > 1e-12:
            mais(exc, f"vmp_do_arquivo_diferente_{grupo}")  # conferência: não muda a classificação
        c = classificar(l[I["RESULTADO"]], l[I["LD"]], l[I["LQ"]], vmp)
        if c not in ("fora", "dentro"):
            mais(exc, f"{c}_{grupo}")
        _acumula(mun_out, nacional, mun, grupo, nome_p, c)
    return mun_out, nacional, registro, exc


VMP_NO_NOME = re.compile(r"^(?P<nome>.*?)\s*-\s*VMP:?\s*(?P<vmp>[\d.,]+)\s*(?P<unid>\S+)")


def agregar_vigilancia_demais(zpath, anos):
    linhas = ler_csv(zpath, CAB_VIG_DEMAIS)
    I = next(linhas)
    out = {str(a): {"municipios": {}, "nacional": {}, "registro": {}, "exclusoes": {}} for a in anos}
    vistos = set()
    for l in linhas:
        ano = l[I["Ano"]].strip()
        if ano not in out:
            continue
        o = out[ano]
        exc = o["exclusoes"]
        mun = municipio(l[I["Código IBGE"]], exc)
        if mun is None:
            continue
        # mesma chave do módulo de parâmetros básicos: município, forma, amostra, parâmetro e data
        chave = hashlib.blake2b("\x1f".join((l[I["Código IBGE"]].strip(), l[I["Código Forma de abastecimento"]].strip(),
                                             l[I["Número da amostra"]].strip(),
                                             l[I["Parâmetro (demais parâmetros)"]].strip(), l[I["Data da Coleta"]].strip())).encode(),
                                digest_size=12).digest()
        if chave in vistos:
            mais(exc, "duplicata")
            continue
        vistos.add(chave)
        if l[I["Motivo da coleta"]].strip() != "Rotina":
            mais(exc, "motivo_nao_rotina")
            continue
        if not tratada_vigilancia(l[I["Tipo da Forma de Abastecimento"]].strip(), l[I["Procedência da Coleta"]].strip(),
                                  l[I["Ponto de Coleta"]].strip()):
            mais(exc, "fora_da_agua_tratada_coletiva")
            continue
        grupo = grupo_arquivo(l[I["Grupo de parâmetros"]])
        if grupo is None:
            raise ValueError(f"vigilância demais, grupo não previsto {l[I['Grupo de parâmetros']]!r}")
        o["registro"][mun] = o["registro"].get(mun, 0) + 1
        if grupo in GRUPOS_SEM_VMP:
            mais(exc, "sem_vmp_na_portaria")
            continue
        bruto = re.sub(r"\s+", " ", l[I["Parâmetro (demais parâmetros)"]].strip())
        m = VMP_NO_NOME.match(bruto)
        nome = m.group("nome") if m else bruto
        ref = vmp_de(grupo, nome)
        if ref is None:
            mais(exc, f"sem_vmp_na_portaria_{grupo}")
            mais(exc, "parametro_sem_vmp:" + nome)
            continue
        nome_p, unid, vmp = ref
        if m:
            if valor(m.group("vmp")) is not None and abs(valor(m.group("vmp")) - vmp) > 1e-12:
                mais(exc, f"vmp_do_arquivo_diferente_{grupo}")
            if unidade(m.group("unid")) != unid:
                # o próprio arquivo grava a unidade errada em alguns rótulos (ex.: cor aparente em mg/L)
                mais(exc, f"unidade_do_rotulo_diferente_{grupo}")
        c = classificar(l[I["Resultado"]], l[I["LD"]], l[I["LQ"]], vmp)
        if c not in ("fora", "dentro"):
            mais(exc, f"{c}_{grupo}")
        _acumula(o["municipios"], o["nacional"], mun, grupo, nome_p, c)
    return out


def toxina(nome):
    k = chave_nome(nome)
    if k.startswith("miscrocist"):  # grafia do arquivo de vigilância
        return "microcistina"
    for t in VMP_CIANOTOXINAS:
        if k.startswith(t[:6]):
            return t
    return None


def agregar_vigilancia_ciano(zpath, anos):
    """Cianotoxinas na água tratada (vigilância) comparadas ao Anexo 10, em µg/L."""
    linhas = ler_csv(zpath, CAB_VIG_CIANO)
    I = next(linhas)
    out = {str(a): {"municipios": {}, "nacional": {}, "exclusoes": {}} for a in anos}
    for l in linhas:
        ano = l[I["Ano"]].strip()
        if ano not in out or l[I["Grupo"]].strip() != "Cianotoxinas":
            continue
        o = out[ano]
        exc = o["exclusoes"]
        mun = municipio(l[I["Código IBGE"]], exc)
        if mun is None:
            continue
        if l[I["Motivo da Coleta"]].strip() != "Rotina":
            mais(exc, "motivo_nao_rotina")
            continue
        if not tratada_vigilancia(l[I["Tipo da Forma de Abastecimento"]].strip(), l[I["Procedência da Coleta"]].strip(),
                                  l[I["Ponto de Coleta"]].strip()):
            mais(exc, "fora_da_agua_tratada_coletiva")
            continue
        nome = re.sub(r"\s+", " ", l[I["Parâmetro (ciano)"]].strip())
        t = toxina(nome)
        if t is None or "µg" not in nome.replace("μ", "µ"):
            mais(exc, "toxina_sem_vmp_ou_unidade_incerta")
            continue
        v = valor(l[I["Resultado"]])
        if v is None:
            mais(exc, "invalido")
            continue
        c = "fora" if v > VMP_CIANOTOXINAS[t] else "dentro"
        n = o["nacional"].setdefault(t, [0, 0])
        n[0] += c == "fora"
        n[1] += 1
        acc = o["municipios"].setdefault(mun, [0, 0])
        acc[0] += c == "fora"
        acc[1] += 1
    return out


def agregar_manancial(zpath, anos):
    """Contexto do manancial (água bruta), só nacional: média geométrica móvel de E. coli em
    captação superficial (Art. 29, § 1º: a partir de 1.000/100 mL exige avaliação da ETA) e
    cianotoxinas acima do VMP do Anexo 10 (Art. 43, § 4º: exige análise semanal na saída)."""
    linhas = ler_csv(zpath, CAB_CTRL_DEMAIS)
    I = next(linhas)
    out = {str(a): {"ecoli_mgm": [0, 0], "cianotoxinas": {}, "municipios": set(), "exclusoes": {}} for a in anos}
    for l in linhas:
        ano = l[I["NU_ANO"]].strip()
        if ano not in out:
            continue
        o = out[ano]
        mun = municipio(l[I["CO_MUNICIPIO_IBGE"]], o["exclusoes"])
        if mun is None:
            continue
        o["municipios"].add(mun)
        par, unid = l[I["PARAMETRO"]].strip(), l[I["UNIDADE"]].strip()
        v = valor(l[I["RESULTADO"]])
        if par == "Escherichia coli" and unid.startswith("Média geométrica móvel") and l[I["TP_CAPTACAO"]].strip() == "SUPERFICIAL":
            if v is None:
                mais(o["exclusoes"], "invalido_ecoli")
                continue
            o["ecoli_mgm"][0] += v >= 1000
            o["ecoli_mgm"][1] += 1
        elif par == "Cianotoxinas":
            t = toxina(unid)
            if t is None or "µg" not in unidade(unid):
                mais(o["exclusoes"], "cianotoxina_unidade_incerta")
                continue
            if v is None:
                mais(o["exclusoes"], "invalido_cianotoxina")
                continue
            n = o["cianotoxinas"].setdefault(t, [0, 0])
            n[0] += v > VMP_CIANOTOXINAS[t]
            n[1] += 1
    for o in out.values():
        o["municipios"] = len(o["municipios"])
    return out


# ---------------------------------------------------------------------------
# coleta e gold
# ---------------------------------------------------------------------------

def url(nome):
    return fontes.SISAGUA_S3 + nome


def coletar(anos=ANOS, zips=None):
    if zips:
        return _coletar(anos, zips)
    with tempfile.TemporaryDirectory(prefix="sisagua-q-") as pasta:
        return _coletar(anos, pasta)


def _coletar(anos, pasta):
    arquivos = []
    v_path, v_prov = obter(url("vigilancia_demais_parametros_csv.zip"), pasta)
    vig = agregar_vigilancia_demais(v_path, anos)
    arquivos.append({"conjunto": "vigilancia_demais", "ano": None, **v_prov})
    c_path, c_prov = obter(url("vigilancia_cianobacterias_cianotoxinas_csv.zip"), pasta)
    ciano = agregar_vigilancia_ciano(c_path, anos)
    arquivos.append({"conjunto": "vigilancia_ciano", "ano": None, **c_prov})
    m_path, m_prov = obter(url("controle_mensal_demais_parametros_csv.zip"), pasta)
    manancial = agregar_manancial(m_path, anos)
    arquivos.append({"conjunto": "controle_demais_manancial", "ano": None, **m_prov})
    seeds = {}
    for ano in anos:
        s_path, s_prov = obter(url(f"controle_semestral_{ano}_csv.zip"), pasta)
        mun, nac, reg, exc = agregar_semestral(s_path, ano)
        arquivos.append({"conjunto": "controle_semestral", "ano": ano, **s_prov})
        nome = f"sisagua_quimicos_{ano}.json.gz"
        seeds[nome] = gravar(nome, {
            "ano": ano,
            "controle": {"municipios": mun, "nacional": nac, "registro": reg, "exclusoes": exc},
            "vigilancia": vig[str(ano)],
            "cianotoxinas": ciano[str(ano)],
            "manancial": manancial[str(ano)],
        })
        print(ano, "semestral", len(mun), "vigilancia", len(vig[str(ano)]["municipios"]), flush=True)
    manifesto = {
        "capturado_em": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "anos": list(anos),
        "arquivos": arquivos,
        "seeds": seeds,
        "dicionarios": {k: documento(url(f"dicionario_{k}.odt"))
                        for k in ("controle_semestral", "controle_mensal_demais_parametros", "vigilancia_demais_parametros", "vigilancia_ciano")},
    }
    with open(os.path.join(SEED, "manifesto_quimicos.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps(manifesto, ensure_ascii=False, indent=2) + "\n")


def _ler(nome, manifesto):
    with gzip.open(os.path.join(SEED, nome), "rb") as f:
        dados = f.read()
    if hashlib.sha256(dados).hexdigest() != manifesto["seeds"][nome]:
        raise ValueError("SHA-256 divergente: " + nome)
    return json.loads(dados)


# Medidas municipais: (id, registro, grupos somados)
MEDIDAS = [
    ("ctrl_agro", "controle", ("agrotoxicos",)),
    ("ctrl_quim", "controle", ("inorganicas", "organicas", "subprodutos")),
    ("ctrl_organol", "controle", ("organolepticos",)),
    ("vig_quim", "vigilancia", ("agrotoxicos", "inorganicas", "organicas", "subprodutos")),
]


def campos(anos=ANOS):
    out = []
    for ano in anos:
        for mid, _, _ in MEDIDAS:
            out += [f"qa_{mid}_{ano}_num", f"qa_{mid}_{ano}_den"]
    return out


def construir(ids6, uf_de=None):
    """Campos municipais e auditoria (por ano, por grupo e por parâmetro) para meta.json."""
    with open(os.path.join(SEED, "manifesto_quimicos.json"), encoding="utf-8") as f:
        manifesto = json.load(f)
    universo = set(ids6)
    uf_de = uf_de or {}
    linhas = {i: {} for i in universo}
    aud = {"anos": manifesto["anos"], "proveniencia": manifesto, "grupos": GRUPOS,
           "vmp": [{"grupo": g, "parametro": n, "unidade": u, "vmp": v} for g, n, u, v in VMP],
           "vmp_cianotoxinas": VMP_CIANOTOXINAS, "por_ano": {}}
    for ano in manifesto["anos"]:
        s = _ler(f"sisagua_quimicos_{ano}.json.gz", manifesto)
        for i, l in linhas.items():
            for mid, reg, grupos in MEDIDAS:
                m = s[reg]["municipios"].get(i) or {}
                pares = [m[g] for g in grupos if g in m]
                num, den = sum(p[0] for p in pares), sum(p[1] for p in pares)
                l[f"qa_{mid}_{ano}_num"], l[f"qa_{mid}_{ano}_den"] = (num, den) if den else (None, None)

        def por_grupo(reg):
            tot = {}
            for i, m in s[reg]["municipios"].items():
                if i not in universo:
                    continue
                for g, (f, n) in m.items():
                    acc = tot.setdefault(g, [0, 0, 0])
                    acc[0] += f
                    acc[1] += n
                    acc[2] += 1
            return tot

        def por_uf(reg):
            out = {}
            for i, m in s[reg]["municipios"].items():
                t = uf_de.get(i)
                if t is None:
                    continue
                for g, (f, n) in m.items():
                    acc = out.setdefault(t, {}).setdefault(g, [0, 0, 0])
                    acc[0] += f
                    acc[1] += n
                    acc[2] += 1
            return out

        ciano = s["cianotoxinas"]
        aud["por_ano"][str(ano)] = {
            "codigos_fora_do_universo": {
                "controle": sorted(set(s["controle"]["registro"]) - universo),
                "vigilancia": sorted(set(s["vigilancia"]["registro"]) - universo),
                "cianotoxinas": sorted(set(ciano["municipios"]) - universo),
            },
            "registro": {"controle": len(set(s["controle"]["registro"]) & universo),
                         "vigilancia": len(set(s["vigilancia"]["registro"]) & universo),
                         "cianotoxinas": len(set(ciano["municipios"]) & universo)},
            "grupos": {"controle": por_grupo("controle"), "vigilancia": por_grupo("vigilancia")},
            "ufs": {"controle": por_uf("controle"), "vigilancia": por_uf("vigilancia")},
            "parametros": {"controle": s["controle"]["nacional"], "vigilancia": s["vigilancia"]["nacional"]},
            "cianotoxinas": {"nacional": ciano["nacional"], "municipios_com_analise": len(ciano["municipios"]),
                             "municipios_com_resultado_acima": sum(1 for v in ciano["municipios"].values() if v[0])},
            "manancial": s["manancial"],
            "exclusoes": {"controle": {k: v for k, v in s["controle"]["exclusoes"].items() if not k.startswith("parametro_sem_vmp:")},
                          "vigilancia": {k: v for k, v in s["vigilancia"]["exclusoes"].items() if not k.startswith("parametro_sem_vmp:")},
                          "cianotoxinas": ciano["exclusoes"]},
            "parametros_sem_vmp": sorted({k.split(":", 1)[1] for reg in ("controle", "vigilancia")
                                          for k in s[reg]["exclusoes"] if k.startswith("parametro_sem_vmp:")}),
        }
    return linhas, aud


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--coletar", action="store_true")
    ap.add_argument("--anos", default=",".join(map(str, ANOS)))
    ap.add_argument("--zips")
    a = ap.parse_args()
    if a.coletar:
        coletar(tuple(int(x) for x in a.anos.split(",")), a.zips)
