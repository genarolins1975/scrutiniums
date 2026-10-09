"""Infraestrutura própria do módulo Saúde: caminhos, manifesto de capturas e versão do código gerador.

O manifesto do seed de Saúde é separado do de Educação (`pipeline/eficiencia/seed/manifesto.json`): reconstruir um tema
nunca altera o hash de proveniência do outro. A escrita determinística de arquivos e os hashes vêm de `pipeline.eficiencia.base`.
"""
import hashlib
import os

from pipeline.eficiencia import base as B

RAIZ = B.RAIZ
AQUI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(AQUI, "seed")
DADOS = os.path.join(RAIZ, "data", "eficiencia_saude")
GOLD = os.path.join(RAIZ, "public", "eficiencia", "gold")
SERIES = os.path.join(RAIZ, "public", "eficiencia", "series")
CATALOGO = os.path.join(AQUI, "catalogo_indicadores.json")
MANIFESTO = os.path.join(SEED, "manifesto.json")

VERSAO_PIPELINE = "obee-saude-0.1.0"
DOMINIO = "eficiencia"
TEMA = "saude_capitais"

# reexportações usadas por todo o pacote
agora_utc = B.agora_utc
sha256_bytes = B.sha256_bytes
sha256_arquivo = B.sha256_arquivo
grava_csv_gz = B.grava_csv_gz
le_csv_gz = B.le_csv_gz
grava_json_gz = B.grava_json_gz
le_json_gz = B.le_json_gz
le_json = B.le_json
grava_json = B.grava_json
STATUS = B.STATUS


def le_manifesto():
    if not os.path.exists(MANIFESTO):
        return {"capturas": {}}
    return le_json(MANIFESTO)


def registra_captura(chave, registro):
    m = le_manifesto()
    m["capturas"][chave] = registro
    m["capturas"] = dict(sorted(m["capturas"].items()))
    grava_json(MANIFESTO, m)


def hash_gerador():
    """(sha256, n_arquivos) do código gerador do módulo: todos os .py do pacote (sem seed), o catálogo e as unidades
    compartilhadas de `pipeline/eficiencia` que ele usa. Depende só do conteúdo."""
    arquivos = []
    for pasta, dirs, nomes in os.walk(AQUI):
        dirs[:] = sorted(d for d in dirs if d not in ("seed", "__pycache__"))
        for n in sorted(nomes):
            if n.endswith(".py") or os.path.join(pasta, n) == CATALOGO:
                arquivos.append(os.path.join(pasta, n))
    for compartilhado in ("base.py", "entes.py"):
        arquivos.append(os.path.join(os.path.dirname(AQUI), "eficiencia", compartilhado))
    h = hashlib.sha256()
    for a in sorted(arquivos):
        h.update(os.path.relpath(a, RAIZ).encode("utf-8") + b"\0")
        with open(a, "rb") as f:
            h.update(f.read())
        h.update(b"\0")
    return h.hexdigest(), len(arquivos)


def versao_codigo():
    return "gerador-" + hash_gerador()[0][:12]
