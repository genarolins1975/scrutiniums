"""CNES (Cadastro Nacional de Estabelecimentos de Saúde): estabelecimentos de atenção primária das 26 capitais.

Dois caminhos, ambos públicos e sem identificação pessoal:

1. Retrato atual: arquivo `cnes_estabelecimentos_csv.zip` do OpenDataSUS no S3 (atualizado diariamente, sem versão, sem
   competência, ISO 8859 1, separador ponto e vírgula). O OBEE guarda o sha256 do arquivo original e um recorte das 26 capitais
   nos tipos de unidade de atenção primária, sem endereço, sem coordenadas e sem estabelecimentos de tipo 22 (consultório
   isolado, cujo nome é o de uma pessoa física).
2. Histórico mensal por estabelecimento: família `/assistencia-a-saude/cnes-estabelecimentos` da API de dados abertos, que traz a
   competência (`nu_comp`) e devolve a história completa de um `co_cnes` em uma chamada. Só acompanha os estabelecimentos que
   hoje têm tipo 01 ou 02; um estabelecimento reclassificado para outro tipo ou renumerado sai do recorte (viés declarado).

Tipos de unidade da atenção primária (tabela `/cnes/tipounidades`): 01 posto de saúde, 02 centro de saúde/unidade básica.
Natureza jurídica pública: código iniciado em 1 (`CO_NATUREZA_JUR`). A "esfera administrativa" do CNES repete o tipo de gestão
(M, E, D) e por isso não identifica propriedade pública.
"""
import csv
import io
import json
import os
import time
import urllib.request
import zipfile

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base

URL_ZIP = "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/CNES/cnes_estabelecimentos_csv.zip"
PAGINA = "https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude"
DOC_API = "https://apidadosabertos.saude.gov.br/v1/"
API = "https://apidadosabertos.saude.gov.br"
TIPOS_APS = ("01", "02")
TIPOS_CONTEXTO = ("15", "32", "40", "71", "74")
CAMPOS = ["CO_CNES", "CO_IBGE", "TP_UNIDADE", "NO_FANTASIA", "TP_GESTAO", "DS_ESFERA_ADMINISTRATIVA", "CO_NATUREZA_JUR",
          "CO_MOTIVO_DESAB", "CO_AMBULATORIAL_SUS", "CO_NATUREZA_ORGANIZACAO"]


def baixa_zip(destino):
    """Baixa o zip do CNES e devolve (caminho, sha256, bytes, last_modified)."""
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    req = urllib.request.Request(URL_ZIP, headers={"User-Agent": "Mozilla/5.0 (OBEE; coleta de dados abertos)"})
    with urllib.request.urlopen(req, timeout=600) as r, open(destino, "wb") as f:
        lm = r.headers.get("Last-Modified")
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    return destino, base.sha256_arquivo(destino), os.path.getsize(destino), lm


def extrai_recorte(caminho_zip, sha_zip, last_modified):
    """Recorte do retrato nas 26 capitais, tipos de APS e de contexto, sem endereço, coordenadas nem consultórios isolados."""
    codigos6 = {str(c)[:6]: c for c, _, _ in entes.CAPITAIS}
    linhas = []
    total = 0
    with zipfile.ZipFile(caminho_zip) as z:
        nome = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        sha_csv = base.sha256_bytes(b"")  # preenchido abaixo
        import hashlib
        h = hashlib.sha256()
        with z.open(nome) as bruto:
            class _Tee(io.RawIOBase):
                def readable(self):
                    return True

                def readinto(self, b):
                    n = bruto.readinto(b)
                    if n:
                        h.update(bytes(b[:n]))
                    return n
            texto = io.TextIOWrapper(io.BufferedReader(_Tee(), 1 << 20), encoding="latin-1", newline="")
            for l in csv.DictReader(texto, delimiter=";"):
                total += 1
                mun = (l.get("CO_IBGE") or "").strip()
                tp = (l.get("TP_UNIDADE") or "").strip().zfill(2)
                if mun in codigos6 and tp in TIPOS_APS + TIPOS_CONTEXTO:
                    r = {c: (l.get(c) or "").strip() for c in CAMPOS}
                    r["TP_UNIDADE"] = tp
                    r["CO_CNES"] = r["CO_CNES"].zfill(7)
                    linhas.append(r)
            sha_csv = h.hexdigest()
    linhas.sort(key=lambda r: (r["CO_IBGE"], r["TP_UNIDADE"], r["CO_CNES"]))
    destino = os.path.join(base.SEED, "cnes", "estabelecimentos_aps_capitais.csv.gz")
    sha = base.grava_csv_gz(destino, CAMPOS, linhas)
    base.registra_captura("cnes_estabelecimentos", {
        "instituicao": "Ministério da Saúde (CNES, OpenDataSUS)",
        "conjunto": "CNES, estabelecimentos de saúde: retrato atual (arquivo diário do OpenDataSUS)",
        "pagina": PAGINA, "url": URL_ZIP, "capturado_em": base.agora_utc(), "publicado_em": last_modified,
        "sha256_original": sha_zip, "sha256_csv_interno": sha_csv, "linhas_arquivo_original": total,
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(linhas),
        "parametros": ("26 capitais; tipos de unidade 01 e 02 (atenção primária) e 15, 32, 40, 71 e 74 (contexto); sem endereço, sem coordenadas, "
                       "sem tipo 22. O arquivo substitui o anterior todo dia e não tem competência: a data de captura é a única referência temporal."),
    })
    return len(linhas), total


def retrato():
    caminho = os.path.join(base.DADOS, "bronze", "cnes_estabelecimentos_csv.zip")
    if not os.path.exists(caminho):
        caminho, sha, tam, lm = baixa_zip(caminho)
    else:
        sha, tam, lm = base.sha256_arquivo(caminho), os.path.getsize(caminho), None
    return extrai_recorte(caminho, sha, lm)


# ---------------------------------------------------------------- histórico mensal por estabelecimento (API)

COMPETENCIAS_GUARDADAS = [f"{a}12" for a in range(2021, 2026)]


def _get(url, tentativas=8):
    espera, ultimo = 1.0, None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (OBEE; coleta de dados abertos)"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception as e:
            ultimo = e
            time.sleep(espera)
            espera = min(espera * 2, 10.0)
    raise RuntimeError(f"API do CNES indisponível em {url}: {ultimo}")


def historico_estabelecimento(co_cnes):
    """Linhas mensais (família B da API) de um estabelecimento: só as competências de dezembro de 2021 a 2025 e a mais recente,
    com os campos que definem o recorte (tipo, natureza jurídica, gestão e status). Sem endereço, telefone ou e-mail."""
    url = f"{API}/assistencia-a-saude/cnes-estabelecimentos?limit=1000&co_cnes={co_cnes}"
    linhas = json.loads(_get(url).decode("utf-8"))
    if isinstance(linhas, dict):
        linhas = linhas.get("cnes_estabelecimentos") or linhas.get("estabelecimentos") or next((v for v in linhas.values() if isinstance(v, list)), [])
    por_comp = {str(l.get("nu_comp")): l for l in linhas}
    ultima = max(por_comp) if por_comp else None
    saida = []
    for comp in COMPETENCIAS_GUARDADAS + ([ultima] if ultima else []):
        l = por_comp.get(comp)
        if not l:
            continue
        saida.append({
            "nu_comp": comp, "co_cnes": str(co_cnes), "co_ibge": l.get("co_ibge"),
            "tp_unidade": l.get("tp_unidade"), "tp_gestao": l.get("tp_gestao"),
            "ds_natureza_juridica": l.get("ds_natureza_juridica"), "no_grupo_nat_jur": l.get("no_grupo_nat_jur"),
            "ds_status": l.get("ds_status"),
        })
    return {"competencias_na_resposta": len(por_comp), "primeira": min(por_comp) if por_comp else None, "ultima": ultima,
            "linhas": saida, "sha256_resposta": None}


def coleta_historico(pausa=0.2, limite=None):
    """Histórico de cada estabelecimento de tipo 01 ou 02 do retrato (ativos e desabilitados). Retoma de onde parou."""
    recorte = base.le_csv_gz(os.path.join(base.SEED, "cnes", "estabelecimentos_aps_capitais.csv.gz"))
    alvo = sorted({r["CO_CNES"] for r in recorte if r["TP_UNIDADE"] in TIPOS_APS})
    if limite:
        alvo = alvo[:limite]
    destino = os.path.join(base.SEED, "cnes", "historico_aps_dezembros.json.gz")
    atual = base.le_json_gz(destino) if os.path.exists(destino) else {}
    feitos = 0
    for co in alvo:
        if co in atual:
            continue
        try:
            atual[co] = historico_estabelecimento(co)
        except RuntimeError as e:
            print(f"CNES {co}: ERRO {e}", flush=True)
            continue
        feitos += 1
        if feitos % 200 == 0:
            base.grava_json_gz(destino, atual)
            print(f"CNES histórico: {len(atual)} de {len(alvo)}", flush=True)
        time.sleep(pausa)
    sha = base.grava_json_gz(destino, atual)
    base.registra_captura("cnes_historico_estabelecimentos", {
        "instituicao": "Ministério da Saúde (CNES, API de dados abertos)",
        "conjunto": "CNES, estabelecimentos por competência (família assistencia-a-saude/cnes-estabelecimentos), dezembro de 2021 a 2025 e competência mais recente",
        "pagina": DOC_API, "url": f"{API}/assistencia-a-saude/cnes-estabelecimentos?limit=1000&co_cnes=<7 dígitos>", "capturado_em": base.agora_utc(),
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "estabelecimentos": len(atual),
        "parametros": ("estabelecimentos que, no retrato da captura, têm tipo 01 ou 02 (ativos e desabilitados) nas 26 capitais; só as competências "
                       "de dezembro e a mais recente; um estabelecimento hoje reclassificado ou renumerado não está no conjunto (viés declarado)."),
    })
    return len(atual), len(alvo)
