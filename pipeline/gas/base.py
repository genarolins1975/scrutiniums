"""Infraestrutura do domínio Gás Natural: caminhos, hashes, versões e conversões.

Camadas:

    coleta      fontes.py baixa o arquivo oficial de cada fonte e grava no seed
                versionado (pipeline/gas/seed): o arquivo inteiro comprimido, ou o
                recorte declarado quando o original é grande, sempre com o sha256
                e o tamanho do original no manifesto
    leitura     ler.py converte o seed em registros tipados, sem cálculo
    validação   validacoes.py confere identidades, unidades e cobertura
    publicação  gold.py escreve public/gas/gold (JSON por página) e
                public/gas/series (CSV por indicador)

Só a biblioteca padrão: o CI reconstrói a gold a partir do seed sem instalar nada.
"""
import gzip
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AQUI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(AQUI, "seed")
MANIFESTO = os.path.join(SEED, "manifesto.json")
GOLD = os.path.join(RAIZ, "public", "gas", "gold")
SERIES = os.path.join(RAIZ, "public", "gas", "series")

VERSAO_PIPELINE = "gas-0.1.0"
DOMINIO = "gas"

# Naturezas do dado, as mesmas do Setor Elétrico (src/lib/energia/tipos.ts).
OBSERVADO = "OBSERVADO"
CALCULADO = "CALCULADO"

MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
                 "setembro", "outubro", "novembro", "dezembro"]

UF_SIGLA = {
    "ACRE": "AC", "ALAGOAS": "AL", "AMAPÁ": "AP", "AMAPA": "AP", "AMAZONAS": "AM", "BAHIA": "BA",
    "CEARÁ": "CE", "CEARA": "CE", "DISTRITO FEDERAL": "DF", "ESPÍRITO SANTO": "ES", "ESPIRITO SANTO": "ES",
    "GOIÁS": "GO", "GOIAS": "GO", "MARANHÃO": "MA", "MARANHAO": "MA", "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG", "PARÁ": "PA", "PARA": "PA", "PARAÍBA": "PB",
    "PARAIBA": "PB", "PARANÁ": "PR", "PARANA": "PR", "PERNAMBUCO": "PE", "PIAUÍ": "PI", "PIAUI": "PI",
    "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", "RONDÔNIA": "RO",
    "RONDONIA": "RO", "RORAIMA": "RR", "SANTA CATARINA": "SC", "SÃO PAULO": "SP", "SAO PAULO": "SP",
    "SERGIPE": "SE", "TOCANTINS": "TO",
}
UF_NOME = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará",
    "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul", "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins",
}
UF_REGIAO = {
    "AC": "N", "AP": "N", "AM": "N", "PA": "N", "RO": "N", "RR": "N", "TO": "N",
    "AL": "NE", "BA": "NE", "CE": "NE", "MA": "NE", "PB": "NE", "PE": "NE", "PI": "NE", "RN": "NE", "SE": "NE",
    "DF": "CO", "GO": "CO", "MT": "CO", "MS": "CO",
    "ES": "SE", "MG": "SE", "RJ": "SE", "SP": "SE",
    "PR": "S", "RS": "S", "SC": "S",
}
# Código IBGE da UF: chave da malha em public/energia/geo/uf.json.
UF_CODIGO = {
    "RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15", "AP": "16", "TO": "17", "MA": "21", "PI": "22",
    "CE": "23", "RN": "24", "PB": "25", "PE": "26", "AL": "27", "SE": "28", "BA": "29", "MG": "31", "ES": "32",
    "RJ": "33", "SP": "35", "PR": "41", "SC": "42", "RS": "43", "MS": "50", "MT": "51", "GO": "52", "DF": "53",
}

# Nenhum fator de poder calorífico é aplicado: volumes ficam em m³ e preços em R$/MMBtu (ANP) e US$/MMBtu
# (Banco Mundial), cada um na unidade da sua fonte. A única conversão de moeda usa a PTAX média do mês (BCB).


def agora_utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def numero_br(txt):
    """'1.234,56' ou '1234,56' para float; vazio, '-' e '…' para None. Ponto sem vírgula é decimal só se houver uma casa."""
    if txt is None:
        return None
    t = str(txt).strip().replace("\xa0", "")
    if t in ("", "-", "…", "...", "NA", "n/a"):
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def numero_ponto(txt):
    """Número em notação com ponto decimal (planilhas e APIs)."""
    if txt is None:
        return None
    t = str(txt).strip()
    if t in ("", "-", "…", "...", "NA"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def mes_iso(ano, mes):
    """(2026, 'JAN') ou (2026, 1) para '2026-01'."""
    m = MESES.index(mes.strip().upper()[:3]) + 1 if isinstance(mes, str) and not mes.strip().isdigit() else int(mes)
    return f"{int(ano):04d}-{m:02d}"


def dias_no_mes(iso):
    a, m = (int(x) for x in iso.split("-"))
    if m == 12:
        return 31
    from datetime import date
    return (date(a, m + 1, 1) - date(a, m, 1)).days


def mes_legivel(iso):
    a, m = iso.split("-")
    return f"{MESES_EXTENSO[int(m) - 1]} de {a}"


def ler_manifesto():
    if not os.path.exists(MANIFESTO):
        return {}
    with open(MANIFESTO, encoding="utf-8") as f:
        return json.load(f)


def gravar_manifesto(m):
    with open(MANIFESTO, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


def ler_seed(nome):
    """Bytes de um arquivo do seed (gz descomprimido)."""
    caminho = os.path.join(SEED, nome)
    with open(caminho, "rb") as f:
        dados = f.read()
    return gzip.decompress(dados) if nome.endswith(".gz") else dados


def gravar_seed(nome, dados):
    caminho = os.path.join(SEED, nome)
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    if nome.endswith(".gz"):
        # mtime fixo: o mesmo conteúdo gera o mesmo arquivo comprimido
        dados = gzip.compress(dados, compresslevel=9, mtime=0)
    with open(caminho, "wb") as f:
        f.write(dados)


def hash_gerador():
    """sha256 do código que gera a gold (todos os .py de pipeline/gas, fora seed), em ordem de caminho."""
    arquivos = []
    for pasta, dirs, nomes in os.walk(AQUI):
        dirs[:] = sorted(d for d in dirs if d not in ("seed", "__pycache__"))
        for n in sorted(nomes):
            if n.endswith(".py"):
                arquivos.append(os.path.join(pasta, n))
    h = hashlib.sha256()
    for a in sorted(arquivos):
        h.update(os.path.relpath(a, RAIZ).encode("utf-8") + b"\0")
        with open(a, "rb") as f:
            h.update(f.read())
        h.update(b"\0")
    return h.hexdigest()


def versao_codigo():
    return "gerador-" + hash_gerador()[:12]


def commit_de_partida():
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env
    try:
        return subprocess.run(["git", "-C", RAIZ, "rev-parse", "HEAD"], capture_output=True, text=True,
                              timeout=10).stdout.strip() or None
    except Exception:
        return None
