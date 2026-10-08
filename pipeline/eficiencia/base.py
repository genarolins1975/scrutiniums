"""Infraestrutura do domínio OBEE: caminhos, hashes, versões e universo de entes.

Camadas (docs/obee/ARQUITETURA.md):

    coleta     fontes/*.py baixa o arquivo oficial, confere integridade e grava em
               data/eficiencia/bronze (fora do git) e o recorte das capitais em
               pipeline/eficiencia/seed (versionado, com sha256 do original)
    padronização  padroniza.py lê o seed e produz observações tipadas
    validação  validacoes.py confere identidades contábeis, unidades e cruzamentos
    cálculo    indicadores.py aplica as fichas do catálogo
    publicação gold.py escreve public/eficiencia/gold e public/eficiencia/series

Só a biblioteca padrão: o CI do repositório não instala dependências para
reconstruir a gold a partir do seed.
"""
import csv
import gzip
import hashlib
import io
import json
import os
import subprocess
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AQUI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(AQUI, "seed")
DADOS = os.path.join(RAIZ, "data", "eficiencia")
BRONZE = os.path.join(DADOS, "bronze")
GOLD = os.path.join(RAIZ, "public", "eficiencia", "gold")
SERIES = os.path.join(RAIZ, "public", "eficiencia", "series")
CATALOGO = os.path.join(AQUI, "catalogo_indicadores.json")

VERSAO_PIPELINE = "obee-0.1.0"
DOMINIO = "eficiencia"

# Estados de dado. Nenhum deles vira zero.
STATUS = {
    "OBSERVADO": "Valor publicado pela fonte ou agregado diretamente de registros oficiais",
    "NAO_APLICAVEL": "A medida não se aplica a este recorte",
    "NAO_DIVULGADO": "A fonte não divulgou valor para este recorte",
    "AUSENTE_NA_COLETA": "O registro não foi encontrado na captura",
    "DESATUALIZADO": "Há captura mais recente pendente de integração",
    "INCONSISTENTE": "O valor falhou em uma validação e não é exibido",
    "NAO_COMPARAVEL": "O valor existe, mas não atende às condições de comparação",
    "INDISPONIVEL_TEMPORARIAMENTE": "A fonte não respondeu na última tentativa de coleta",
}


def agora_utc():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha256_arquivo(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def md5_arquivo_membro(zf, nome):
    h = hashlib.md5()
    with zf.open(nome) as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def versao_codigo():
    """Commit curto do código que gerou a gold; '+alterado' com mudança não commitada."""
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env[:12]
    try:
        out = subprocess.run(["git", "-C", RAIZ, "rev-parse", "--short=12", "HEAD"],
                             capture_output=True, text=True, timeout=10)
        sha = out.stdout.strip() or None
        suja = subprocess.run(
            ["git", "-C", RAIZ, "status", "--porcelain", "--", "pipeline/eficiencia",
             ":(exclude)pipeline/eficiencia/seed"],
            capture_output=True, text=True, timeout=10).stdout.strip()
        return f"{sha}+alterado" if sha and suja else sha
    except Exception:
        return None


# ---------------------------------------------------------------- seed (CSV gz e JSON gz)

def grava_csv_gz(caminho, campos, linhas):
    """CSV gzip determinístico: mesmo conteúdo, mesmos bytes (mtime zerado)."""
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=campos, lineterminator="\n")
    w.writeheader()
    for l in linhas:
        w.writerow(l)
    dados = buf.getvalue().encode("utf-8")
    with open(caminho, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0, filename="") as g:
            g.write(dados)
    return sha256_bytes(dados)


def le_csv_gz(caminho):
    with gzip.open(caminho, "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def grava_json_gz(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    dados = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    with open(caminho, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0, filename="") as g:
            g.write(dados)
    return sha256_bytes(dados)


def le_json_gz(caminho):
    with gzip.open(caminho, "rt", encoding="utf-8") as f:
        return json.load(f)


def le_json(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def grava_json(caminho, obj):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=False)
        f.write("\n")
    os.replace(tmp, caminho)


# ---------------------------------------------------------------- manifesto de capturas

MANIFESTO = os.path.join(SEED, "manifesto.json")


def le_manifesto():
    if not os.path.exists(MANIFESTO):
        return {"capturas": {}}
    return le_json(MANIFESTO)


def registra_captura(chave, registro):
    """Registra (ou substitui) a captura `chave` no manifesto do seed."""
    m = le_manifesto()
    m["capturas"][chave] = registro
    m["capturas"] = dict(sorted(m["capturas"].items()))
    grava_json(MANIFESTO, m)
