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


# ---------------------------------------------------------------- MSC (terceira fonte de conferência)

MSC_CONTAS_LIQUIDADO = ("6221303", "6221304", "6221307")
"""Contas de controle da execução da despesa (classe 6) que compõem o liquidado no exercício:
6.2.2.1.3.03 crédito empenhado liquidado a pagar, 6.2.2.1.3.04 liquidado pago e 6.2.2.1.3.07
liquidado a pagar inscrito em restos a pagar processados (PCASP, Manual de Contabilidade Aplicada
ao Setor Público). As contas 6.2.2.1.3.05 e .06 (restos a pagar não processados) ficam fora."""


def resumo_msc(itens):
    """Resumo da resposta COMPLETA da MSC (todas as funções): quantas linhas há por código de função e o
    saldo líquido das contas de despesa liquidada, sem intraorçamentárias (modalidade 91), por função. Serve ao
    diagnóstico dos pares que não reconciliam com a DCA: mostra se a MSC traz a função 12, em que outra função
    as linhas estão e se a MSC fica abaixo da DCA em todas as funções ou só na Educação."""
    from pipeline.eficiencia import conferencia as CF
    por_funcao, liquido = {}, {}
    for x in itens:
        f = x.get("funcao")
        chave = "sem_funcao" if f in (None, "") else str(f)
        por_funcao[chave] = por_funcao.get(chave, 0) + 1
        if str(x.get("conta_contabil", ""))[:7] in MSC_CONTAS_LIQUIDADO and chave != "sem_funcao":
            if str(x.get("natureza_despesa") or "")[2:4] != "91":
                liquido[chave] = round(liquido.get(chave, 0.0) + CF.saldo_liquido(x), 2)
    return {"linhas_por_funcao": dict(sorted(por_funcao.items())), "liquidado_liquido_sem_intra_por_funcao": dict(sorted(liquido.items()))}


def coleta_msc_entregas(cod_ibge, ano):
    """Entregas da MSC do ente no exercício (extrato do Siconfi): MSC Agregada de dezembro e MSC de encerramento,
    com data e forma de envio. O extrato não informa retificação; registra o que existe."""
    capturado_em = base.agora_utc()
    url, extrato = _todas_paginas("extrato_entregas", {"id_ente": cod_ibge, "an_referencia": ano})
    msc = [x for x in extrato if str(x.get("entregavel", "")).startswith("MSC") and (x.get("periodo") in (12, "12") or "Encerramento" in str(x.get("entregavel")))]
    destino = os.path.join(base.SEED, "siconfi", "msc_entregas", f"{cod_ibge}_{ano}.json.gz")
    sha = base.grava_json_gz(destino, msc)
    m = base.le_manifesto()["capturas"].get("siconfi_msc_entregas", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Extrato de entregas: MSC Agregada de dezembro e MSC de encerramento",
        "pagina": DOC, "url": f"{API}/extrato_entregas?id_ente=<código IBGE>&an_referencia=<ano>",
        "parametros": "só os pares capital × exercício cuja MSC não reconcilia com a DCA", "arquivos": {},
    })
    m["arquivos"][f"{cod_ibge}_{ano}"] = {"url": url[0], "capturado_em": capturado_em, "linhas": len(msc), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha}
    base.registra_captura("siconfi_msc_entregas", m)
    return len(msc)


def coleta_msc_educacao(cod_ibge, ano, mes=12):
    """Matriz de Saldos Contábeis (MSC agregada de dezembro), classe 6, saldo final.

    Grava só as linhas da função 12 nas contas de despesa liquidada e de restos a pagar, com o
    sha256 da resposta completa (todas as páginas). Usada para conferir a DCA quando a diferença
    entre DCA e RREO é material: a MSC separa as despesas intraorçamentárias pela modalidade 91
    da natureza da despesa, o que permite comprovar o enquadramento, e não só a aritmética."""
    capturado_em = base.agora_utc()
    urls, itens = _todas_paginas("msc_orcamentaria", {
        "id_ente": cod_ibge, "an_referencia": ano, "me_referencia": mes, "co_tipo_matriz": "MSCC",
        "classe_conta": 6, "id_tv": "ending_balance",
    })
    sha_completo = base.sha256_bytes(json.dumps(itens, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    filtrados = [x for x in itens if str(x.get("funcao")) == "12" and str(x.get("conta_contabil", ""))[:7] in
                 MSC_CONTAS_LIQUIDADO + ("6221305", "6221306")]
    destino = os.path.join(base.SEED, "siconfi", "msc_funcao12", f"{cod_ibge}_{ano}_{mes:02d}.json.gz")
    sha = base.grava_json_gz(destino, filtrados)
    m = base.le_manifesto()["capturas"].get("siconfi_msc_funcao12", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Matriz de Saldos Contábeis (MSC) agregada, classe 6, saldo final de dezembro",
        "pagina": DOC,
        "url": f"{API}/msc_orcamentaria?id_ente=<código IBGE>&an_referencia=<ano>&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance",
        "parametros": "coletada só para os pares DCA × RREO com diferença material e para casos de controle; gravadas as linhas da função 12 nas contas 6.2.2.1.3.03 a .07",
        "arquivos": {},
    })
    m["arquivos"][f"{cod_ibge}_{ano}"] = {
        "url": urls[0], "capturado_em": capturado_em, "linhas_resposta": len(itens), "linhas": len(filtrados),
        "sha256_resposta_completa": sha_completo, "resumo_resposta": resumo_msc(itens), "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha,
    }
    base.registra_captura("siconfi_msc_funcao12", m)
    return len(itens), len(filtrados)


def coleta_evidencias_divergencia(cod_ibge, ano):
    """Evidências documentais de um par DCA × RREO com diferença material: extrato de entregas do
    ente no exercício seguinte (datas de homologação e retificações) e RREO do 5º bimestre, Anexo 02
    (trajetória do acumulado). Não alimentam valores do painel; ficam no seed para conferência."""
    capturado_em = base.agora_utc()
    url_e, extrato = _todas_paginas("extrato_entregas", {"id_ente": cod_ibge, "an_referencia": ano + 1})
    url_r, rreo5 = _todas_paginas("rreo", {
        "an_exercicio": ano, "nr_periodo": 5, "co_tipo_demonstrativo": "RREO",
        "no_anexo": "RREO-Anexo 02", "co_esfera": "M", "id_ente": cod_ibge,
    })
    url_x, extrato_ano = _todas_paginas("extrato_entregas", {"id_ente": cod_ibge, "an_referencia": ano})
    relevantes = [x for x in rreo5 if str(x.get("conta") or "").startswith(("Educação", "DESPESAS", "TOTAL", "Total"))]
    destino = os.path.join(base.SEED, "siconfi", "evidencias_divergencia", f"{cod_ibge}_{ano}.json.gz")
    obj = {"extrato_entregas_ano": extrato_ano, "extrato_entregas_ano_seguinte": extrato, "rreo_anexo_02_b5": relevantes}
    sha = base.grava_json_gz(destino, obj)
    m = base.le_manifesto()["capturas"].get("siconfi_evidencias_divergencia", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": "Extrato de entregas do ente e RREO do 5º bimestre, Anexo 02 (evidências de divergência DCA × RREO)",
        "pagina": DOC,
        "url": f"{API}/extrato_entregas?id_ente=<código IBGE>&an_referencia=<ano>",
        "parametros": "coletadas só para os pares com diferença material; não alimentam valores publicados",
        "arquivos": {},
    })
    m["arquivos"][f"{cod_ibge}_{ano}"] = {"url": url_x[0], "urls": [url_x[0], url_e[0], url_r[0]], "capturado_em": capturado_em,
                                         "recorte": os.path.relpath(destino, base.RAIZ), "sha256": sha,
                                         "linhas": len(extrato_ano) + len(extrato) + len(relevantes)}
    base.registra_captura("siconfi_evidencias_divergencia", m)
    return obj
