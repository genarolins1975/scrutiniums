"""Relatório APS (Ministério da Saúde, SAPS): Cobertura Potencial Estimada da Atenção Primária e equipes, por município e mês.

O portal público https://relatorioaps.saude.gov.br é um aplicativo Angular cujo serviço de dados responde JSON sem autenticação:

    https://relatorioaps-prd.saude.gov.br/cobertura/aps?unidadeGeografica=MUNICIPIO&coMunicipio=<6 dígitos>&nuCompInicio=AAAAMM&nuCompFim=AAAAMM

Não há contrato publicado nem versão para esse serviço (é a API interna do portal). O OBEE grava a resposta inteira, com sha256 e data de
captura, e valida o esquema ao padronizar. Definição oficial: Nota Técnica nº 2/2025 da SAPS/MS (05/04/2025): cobertura = (eSF × 3.500 +
eAP 20h × 1.750 + eAP 30h × 2.625 + pessoas com cadastro vinculado de eCR, eSFR e eAPP) × 100 ÷ estimativa populacional do IBGE.
A população do serviço é a do ano anterior ao da competência, escolhida pelo Ministério. O serviço não limita o valor a 100%.
Competências disponíveis: 01/2021 em diante (a série anterior, método AB, e a série do Previne Brasil têm outro método e não entram).
"""
import json
import os
import time
import urllib.request

from pipeline.eficiencia import entes
from pipeline.eficiencia_saude import base

HOST = "https://relatorioaps-prd.saude.gov.br"
PAGINA = "https://relatorioaps.saude.gov.br/"
NOTA_TECNICA = "https://egestorab.saude.gov.br/image/?file=20250407_O_SEI0047071175NT022025"


def _get(url, tentativas=8):
    espera, ultimo = 2.0, None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (OBEE; coleta de dados abertos)", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            ultimo = e
            time.sleep(espera)
            espera = min(espera * 2, 15.0)
    raise RuntimeError(f"Relatório APS indisponível em {url}: {ultimo}")


def coleta(inicio="202101", fim="202607", pausa=1.0):
    arquivos = {}
    for cod, nome, uf in entes.CAPITAIS:
        mun = str(cod)[:6]
        url = f"{HOST}/cobertura/aps?unidadeGeografica=MUNICIPIO&coMunicipio={mun}&nuCompInicio={inicio}&nuCompFim={fim}"
        capturado_em = base.agora_utc()
        bruto = _get(url)
        dados = json.loads(bruto.decode("utf-8"))
        destino = os.path.join(base.SEED, "relatorio_aps", f"cobertura_aps_{cod}.json.gz")
        sha = base.grava_json_gz(destino, dados)
        arquivos[str(cod)] = {"url": url, "capturado_em": capturado_em, "linhas": len(dados) if isinstance(dados, list) else None,
                              "sha256_resposta": base.sha256_bytes(bruto), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha}
        time.sleep(pausa)
    base.registra_captura("relatorio_aps_cobertura", {
        "instituicao": "Ministério da Saúde (SAPS, Relatório APS)",
        "conjunto": "Cobertura Potencial Estimada da Atenção Primária à Saúde e equipes, por município e competência mensal",
        "pagina": PAGINA, "url": f"{HOST}/cobertura/aps?unidadeGeografica=MUNICIPIO&coMunicipio=<6 dígitos>&nuCompInicio=AAAAMM&nuCompFim=AAAAMM",
        "parametros": f"26 capitais; competências {inicio} a {fim}; resposta integral; definição na Nota Técnica nº 2/2025 da SAPS/MS ({NOTA_TECNICA})",
        "arquivos": arquivos,
    })
    return arquivos


def coleta_brasil(inicio="202101", fim="202607"):
    """Referência nacional oficial: a mesma cobertura potencial, publicada pelo serviço para o Brasil (unidadeGeografica=BRASIL)."""
    url = f"{HOST}/cobertura/aps?unidadeGeografica=BRASIL&nuCompInicio={inicio}&nuCompFim={fim}"
    capturado_em = base.agora_utc()
    bruto = _get(url)
    dados = json.loads(bruto.decode("utf-8"))
    destino = os.path.join(base.SEED, "relatorio_aps", "cobertura_aps_brasil.json.gz")
    sha = base.grava_json_gz(destino, dados)
    base.registra_captura("relatorio_aps_cobertura_brasil", {
        "instituicao": "Ministério da Saúde (SAPS, Relatório APS)",
        "conjunto": "Cobertura Potencial Estimada da Atenção Primária à Saúde, Brasil, por competência mensal",
        "pagina": PAGINA, "url": url, "capturado_em": capturado_em, "sha256_resposta": base.sha256_bytes(bruto), "linhas": len(dados),
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha, "parametros": f"Brasil; competências {inicio} a {fim}; resposta integral",
    })
    return len(dados)
