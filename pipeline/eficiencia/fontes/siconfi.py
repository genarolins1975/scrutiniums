"""Siconfi (Tesouro Nacional): contas anuais e relatórios fiscais das capitais.

API de dados abertos: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/
Documentação: https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos

Papel de cada relatório no painel:

* DCA, Anexo I-E (Despesa por Função): fonte da despesa liquidada na função 12
  (Educação) e da sua composição por subfunção. É a declaração anual de contas
  do município, com estágios empenhado, liquidado e pago separados.
* RREO do 6º bimestre, Anexo 02 (Despesa por Função/Subfunção): usado só para
  conferência cruzada do valor da DCA. Nunca é somado à DCA, porque os dois
  relatórios descrevem o mesmo gasto.
* Lista de entes: confere códigos IBGE e a marcação de capital.

A resposta da API é gravada inteira (JSON gzip, bytes determinísticos) no seed,
com sha256, para que qualquer número possa ser refeito sem nova consulta.
"""
import json
import os
import time
import urllib.parse
import urllib.request

from pipeline.eficiencia import base, entes

API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
DOC = "https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos"


def _get(caminho, params, tentativas=4):
    url = f"{API}/{caminho}?" + urllib.parse.urlencode(params)
    espera = 2
    ultimo = None
    for _ in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return url, json.loads(r.read().decode("utf-8"))
        except Exception as e:  # rede instável: nova tentativa com espera crescente
            ultimo = e
            time.sleep(espera)
            espera *= 2
    raise RuntimeError(f"Siconfi indisponível em {url}: {ultimo}")


def _todas_paginas(caminho, params):
    """A API pagina em blocos (hasMore/offset). Junta tudo numa lista só."""
    itens, offset, urls = [], 0, []
    while True:
        p = dict(params)
        if offset:
            p["offset"] = offset
        url, d = _get(caminho, p)
        urls.append(url)
        itens.extend(d.get("items", []))
        if not d.get("hasMore"):
            return urls, itens
        offset += d.get("limit", len(d.get("items", []))) or 5000


def coleta_entes():
    capturado_em = base.agora_utc()
    urls, itens = _todas_paginas("entes", {})
    destino = os.path.join(base.SEED, "siconfi", "entes.json.gz")
    sha = base.grava_json_gz(destino, itens)
    base.registra_captura("siconfi_entes", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Lista de entes do Siconfi",
        "pagina": DOC, "url": urls[0], "capturado_em": capturado_em,
        "parametros": "sem filtro", "recorte": os.path.relpath(destino, base.RAIZ),
        "sha256_recorte": sha, "linhas_recorte": len(itens),
    })
    return len(itens)


def coleta_dca(ano, cod_ibge):
    capturado_em = base.agora_utc()
    urls, itens = _todas_paginas("dca", {"an_exercicio": ano, "no_anexo": "DCA-Anexo I-E", "id_ente": cod_ibge})
    destino = os.path.join(base.SEED, "siconfi", "dca_anexo_i_e", f"{cod_ibge}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, itens)
    return {
        "url": urls[0], "capturado_em": capturado_em, "linhas": len(itens),
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha,
    }


def coleta_rreo(ano, cod_ibge):
    capturado_em = base.agora_utc()
    urls, itens = _todas_paginas("rreo", {
        "an_exercicio": ano, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO",
        "no_anexo": "RREO-Anexo 02", "co_esfera": "M", "id_ente": cod_ibge,
    })
    # só as linhas da função 12 e os totais: o anexo completo repete todas as funções
    # (o RREO lista as subfunções da Educação logo após a linha "Educação", sem código)
    def _relevante(conta):
        c = str(conta or "")
        return c.startswith(("Educação", "Ensino", "EDUCAÇÃO", "DESPESAS", "TOTAL", "Total"))
    filtrados = [x for x in itens if _relevante(x.get("conta"))]
    destino = os.path.join(base.SEED, "siconfi", "rreo_anexo_02_b6", f"{cod_ibge}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, filtrados)
    return {
        "url": urls[0], "capturado_em": capturado_em, "linhas_resposta": len(itens), "linhas": len(filtrados),
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha,
    }


def coleta(anos, pausa=0.4):
    """DCA I-E e RREO-02 (6º bimestre) para as 26 capitais em cada ano."""
    coleta_entes()
    dca, rreo = {}, {}
    for ano in anos:
        for cod, nome, uf in entes.CAPITAIS:
            chave = f"{cod}_{ano}"
            try:
                dca[chave] = coleta_dca(ano, cod)
            except RuntimeError as e:
                dca[chave] = {"erro": str(e), "capturado_em": base.agora_utc()}
            time.sleep(pausa)
            try:
                rreo[chave] = coleta_rreo(ano, cod)
            except RuntimeError as e:
                rreo[chave] = {"erro": str(e), "capturado_em": base.agora_utc()}
            time.sleep(pausa)
    base.registra_captura("siconfi_dca_anexo_i_e", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Declaração de Contas Anuais (DCA), Anexo I-E: Despesa por Função",
        "pagina": DOC, "url": f"{API}/dca?an_exercicio=<ano>&no_anexo=DCA-Anexo%20I-E&id_ente=<código IBGE>",
        "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais",
        "arquivos": dca,
    })
    base.registra_captura("siconfi_rreo_anexo_02_b6", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Relatório Resumido da Execução Orçamentária (RREO), 6º bimestre, Anexo 02: Despesa por Função/Subfunção",
        "pagina": DOC,
        "url": f"{API}/rreo?an_exercicio=<ano>&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&co_esfera=M&id_ente=<código IBGE>",
        "parametros": f"exercícios {min(anos)} a {max(anos)}; 26 capitais; gravadas só as linhas da função Educação e os totais",
        "arquivos": rreo,
    })
    return dca, rreo
