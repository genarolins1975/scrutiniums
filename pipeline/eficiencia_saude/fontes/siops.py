"""SIOPS (Ministério da Saúde): Anexo 12 do RREO (Ações e Serviços Públicos de Saúde, ASPS) e despesa por fonte de recursos.

O Anexo 12 do RREO não é exposto pela API de dados abertos do Siconfi (o enum `no_anexo` omite os anexos 08 e 12; consulta
direta e resposta integral dos 130 pares capital × exercício, medidas em 09/10/2026). A fonte é o SIOPS, que o portal de
dados abertos do SUS publica como API REST de consulta pública:

    https://siops-consulta-publica-api.saude.gov.br/v1
    /rreo/municipal/{uf}/{município 6 dígitos}/{ano}/{período}
    /despesas-por-subfuncao/{uf}/{município 6 dígitos}/{ano}/{período}

Período 2 é o 6º bimestre (anual). Dicionário: https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SIOPS/MetaDados.pdf
Nas colunas numéricas do Anexo 12, valores negativos (−1 e −2) são sentinelas de "não se aplica", nunca valores.

A API não informa a data de homologação do demonstrativo (a consulta HTML a informa, mas só serve HTTP sem cifra, e o
OBEE não coleta por canal sem verificação de integridade). O sha256 e a data de captura de cada resposta ficam no manifesto:
uma homologação posterior só é percebida pela diferença de hash na próxima captura.
"""
import json
import os
import time
import urllib.request

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base

API = "https://siops-consulta-publica-api.saude.gov.br/v1"
DOC = "https://dadosabertos.saude.gov.br/dataset/siops"
METADADOS = "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SIOPS/MetaDados.pdf"
PERIODO_ANUAL = 2
_ULTIMA = [0.0]


def _get(caminho, tentativas=8):
    """GET com limite de 1 requisição por segundo e nova tentativa com espera crescente (o túnel reinicia com frequência)."""
    url = f"{API}/{caminho}"
    espera, ultimo = 1.0, None
    for _ in range(tentativas):
        folga = 1.0 - (time.time() - _ULTIMA[0])
        if folga > 0:
            time.sleep(folga)
        _ULTIMA[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (OBEE; coleta de dados abertos)"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return url, r.read()
        except Exception as e:
            ultimo = e
            time.sleep(espera)
            espera = min(espera * 2, 8.0)
    raise RuntimeError(f"SIOPS indisponível em {url}: {ultimo}")


def _caminho(tipo, cod, ano):
    mun, uf = str(cod)[:6], str(cod)[:2]
    return {"rreo": f"rreo/municipal/{uf}/{mun}/{ano}/{PERIODO_ANUAL}",
            "despesas": f"despesas-por-subfuncao/{uf}/{mun}/{ano}/{PERIODO_ANUAL}"}[tipo]


def coleta_par(tipo, cod, ano):
    capturado_em = base.agora_utc()
    url, bruto = _get(_caminho(tipo, cod, ano))
    dados = json.loads(bruto.decode("utf-8"))
    pasta = "rreo_anexo_12" if tipo == "rreo" else "despesas_por_fonte"
    destino = os.path.join(base.SEED, "siops", pasta, f"{cod}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, dados)
    return {"url": url, "capturado_em": capturado_em, "linhas": len(dados), "sha256_resposta": base.sha256_bytes(bruto),
            "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha}


def coleta(anos):
    """Anexo 12 e despesa por fonte das 26 capitais; retoma de onde parou (par já gravado não é recoletado)."""
    arquivos = {"rreo": {}, "despesas": {}}
    for tipo in ("rreo", "despesas"):
        for ano in anos:
            for cod, nome, uf in entes.CAPITAIS:
                pasta = "rreo_anexo_12" if tipo == "rreo" else "despesas_por_fonte"
                destino = os.path.join(base.SEED, "siops", pasta, f"{cod}_{ano}.json.gz")
                chave = f"{cod}_{ano}"
                anterior = base.le_manifesto()["capturas"].get(f"siops_{pasta}", {}).get("arquivos", {}).get(chave)
                if os.path.exists(destino) and anterior:
                    arquivos[tipo][chave] = anterior
                    continue
                try:
                    arquivos[tipo][chave] = coleta_par(tipo, cod, ano)
                except RuntimeError as e:
                    arquivos[tipo][chave] = {"erro": str(e), "capturado_em": base.agora_utc()}
                    print(f"SIOPS {tipo} {nome} {ano}: ERRO {e}", flush=True)
            _registra(tipo, arquivos[tipo], anos)
    return arquivos


def _registra(tipo, arquivos, anos):
    if tipo == "rreo":
        base.registra_captura("siops_rreo_anexo_12", {
            "instituicao": "Ministério da Saúde (SIOPS)",
            "conjunto": "RREO, Anexo 12 (Demonstrativo da Receita de Impostos e das Despesas Próprias com Ações e Serviços Públicos de Saúde), 6º bimestre",
            "pagina": DOC, "url": f"{API}/rreo/municipal/<UF>/<município 6 dígitos>/<ano>/2",
            "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais; resposta integral gravada; dicionário em {METADADOS}",
            "arquivos": arquivos,
        })
    else:
        base.registra_captura("siops_despesas_por_fonte", {
            "instituicao": "Ministério da Saúde (SIOPS)",
            "conjunto": "Despesa total em Saúde por fonte de recursos e subfunção (estágio empenhado), 6º bimestre",
            "pagina": DOC, "url": f"{API}/despesas-por-subfuncao/<UF>/<município 6 dígitos>/<ano>/2",
            "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais; resposta integral gravada; dicionário em {METADADOS}",
            "arquivos": arquivos,
        })
