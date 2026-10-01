"""Módulo Expansão da oferta e da rede (painéis P040 a P043).

Perguntas e regras publicadas:

- Carteira (P040): o parque do SIGA separado por estágio (em operação; em construção;
  outorgado com construção não iniciada) e os encerramentos de outorga (revogação e
  extinção) registrados nos atos da ANEEL desde 2015. Outorga não é capacidade que
  certamente entrará: o desfecho observado das usinas que passaram pelo RALIE desde
  junho de 2021 (entraram em operação, tiveram a outorga encerrada, seguem em
  implantação ou saíram do acompanhamento sem desfecho identificado) é publicado ao
  lado da carteira. MW de potência não é energia firme.
- Cronograma (P041): atraso só com data-base conhecida. O RALIE publica fotografias
  históricas desde 17/06/2021 (campo DatRalie); cada previsão comparada tem a data da
  fotografia em que foi registrada. Nenhuma promessa antiga é reconstruída com o
  estoque atual. A partir da primeira captura deste observatório, cada coleta do RALIE
  atual também fica no silver (registros por usina e por unidade geradora).
- Rede (P042): leilões de transmissão e obras do SIGET com km, MVA, MW e reais em
  campos separados; nenhuma soma entre unidades diferentes.
- Cenários (P043): PDE 2035 (EPE/MME), selo CENÁRIO, edição, data-base e hipóteses;
  realizado, carteira e cenário em camadas distintas.
"""
import json
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download, http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_expansao as ax  # noqa: E402
from pipeline.energia.fontes import ckan, epe_pde  # noqa: E402
from pipeline.energia.fontes import epe_rede_expansao as er  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "expansao.json"
FAMILIA = "aneel_geracao"
ROTA = "/setor-eletrico/expansao"
PAGINAS = [{"rotulo": "Expansão", "href": ROTA}]
LICENCA_ANEEL = "Open Data Commons Open Database License (ODbL)"
LICENCA_EPE = "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), conforme o rodapé do portal da EPE"

DS_SIGA = "aneel_siga"
DS_RALIE = "aneel_ralie"
DS_LIB = "aneel_liberacao_comercial"
DS_ATOS = "aneel_atos_outorga_geracao"
DS_LEILOES = "aneel_leiloes_transmissao"
DS_SIGET = "aneel_siget"
DS_AGREG = "aneel_capacidade_agregada"
DS_PDE = "epe_pde"
DS_REDE_EPE = "epe_webmap_rede"

URL_SIGA = "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel"
URL_RALIE = "https://dadosabertos.aneel.gov.br/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica"
URL_LIB = "https://dadosabertos.aneel.gov.br/dataset/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao"
URL_ATOS = "https://dadosabertos.aneel.gov.br/dataset/atos-de-outorgas-de-geracao"
URL_LEILOES = "https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes"
URL_SIGET = "https://dadosabertos.aneel.gov.br/dataset/sistema-de-gestao-da-transmissao-siget"
URL_CAP_UF = "https://dadosabertos.aneel.gov.br/dataset/capacidade-instalada-por-unidade-da-federacao"
URL_EMP_OP = "https://dadosabertos.aneel.gov.br/dataset/empreendimentos-em-operacao"
URL_PDE_PAGINA = "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/plano-decenal-de-expansao-de-energia-2035"
URL_PDE_DADOS = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/"
                 "PDE%202035_Dados_Relat%C3%B3rio%20Final.zip")
URL_PDE_RELATORIO = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/"
                     "PDE%202035_Relat%C3%B3rio%20Final_Aprovado.pdf")
URL_REDE_EPE = er.SERVICO

# Conjuntos CKAN e recursos exatos (nome do arquivo na URL). intervalo_dias: menor
# intervalo entre downloads; recursos que a ANEEL regrava todo dia (SIGA diário,
# SIGET) mudariam de sha256 diariamente só pela data de geração, então são
# capturados no máximo uma vez por semana.
CONJUNTOS = [
    {"dataset": DS_SIGA, "nome": "siga-sistema-de-informacoes-de-geracao-da-aneel", "intervalo_dias": 7,
     "arquivos": ["siga-empreendimentos-geracao-diario.csv"]},
    {"dataset": DS_RALIE, "nome": "ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica",
     "intervalo_dias": 1,
     "arquivos": ["ralie-usina-atual.csv", "ralie-unidade-geradora-atual.csv", "ralie-leilao-atual.csv",
                  "ralie-usina-historico.parquet", "ralie-unidade-geradora-historico.parquet"]},
    {"dataset": DS_LIB, "nome": "liberacao-para-operacao-comercial-de-empreendimentos-de-geracao", "intervalo_dias": 1,
     "arquivos": ["unidades-geradoras-liberadas-operacao-comercial-detalhado.csv",
                  "unidades-geradoras-liberadas-operacao-comercial-resumido.csv"]},
    {"dataset": DS_ATOS, "nome": "atos-de-outorgas-de-geracao", "intervalo_dias": 1,
     "arquivos": ["atos-outorgas-aneel.csv"]},
    {"dataset": DS_LEILOES, "nome": "resultado-de-leiloes", "intervalo_dias": 1,
     "arquivos": ["resultado-leiloes-transmissao.csv"]},
    {"dataset": DS_SIGET, "nome": "sistema-de-gestao-da-transmissao-siget", "intervalo_dias": 7,
     "arquivos": ["siget-contrato-empreendimento-obra-modulo.csv", "siget-resolucao-empreendimento-obra-modulo.csv",
                  "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv",
                  "siget-contrato-moduloequipamento-subestacao.csv", "siget-contrato-agente.csv"]},
    {"dataset": DS_AGREG, "nome": "capacidade-instalada-por-unidade-da-federacao", "intervalo_dias": 1,
     "arquivos": ["capacidade-instalada-geracao-uf.csv"]},
    {"dataset": DS_AGREG, "nome": "empreendimentos-em-operacao", "intervalo_dias": 1,
     "arquivos": ["empreendimento-operacao-historico.csv"]},
]
# Fora do CKAN: caderno de dados, página e relatório do PDE 2035 (edição fixa).
EPE_RECURSOS = [
    {"recurso": "pde2035_dados_relatorio_final.zip", "url": URL_PDE_DADOS, "ext": "zip"},
    {"recurso": "pde2035_pagina.html", "url": URL_PDE_PAGINA, "ext": "html"},
    {"recurso": "pde2035_relatorio_final_aprovado.pdf", "url": URL_PDE_RELATORIO, "ext": "pdf"},
]

DOWNLOADS = {
    "usinas": "/energia/series/expansao_usinas_siga.csv",
    "pontos": "/energia/series/expansao_usinas_pontos.json",
    "carteira": "/energia/series/expansao_carteira_ralie.csv",
    "unidades": "/energia/series/expansao_unidades_ralie.csv",
    "trajetorias": "/energia/series/expansao_trajetorias_ralie.csv",
    "confiabilidade": "/energia/series/expansao_confiabilidade_previsoes.csv",
    "liberacoes": "/energia/series/expansao_liberacoes_anuais.csv",
    "encerramentos": "/energia/series/expansao_encerramentos_outorga.csv",
    "leiloes": "/energia/series/expansao_leiloes_transmissao.csv",
    "obras": "/energia/series/expansao_obras_transmissao.csv",
    "pde": "/energia/series/expansao_pde2035.csv",
    "capacidade_uf": "/energia/series/expansao_capacidade_uf_fonte.csv",
    "contratos": "/energia/series/expansao_contratos_transmissao.csv",
    "rede_epe": "/energia/series/expansao_rede_epe.json",
}

# Colunas de cada CSV de download, com a nota de unidade ou ausência. A mesma lista
# escreve o cabeçalho do arquivo e a descrição publicada em arquivos.json: as duas não
# podem divergir (teste ContratoDosArquivos).
COLUNAS = {
    "usinas": [("nucleo_ceg", None), ("ceg", None), ("nome", None), ("tipo", None), ("origem", None), ("fonte", None),
               ("fase", "fase do SIGA"), ("estagio", None), ("outorga", None), ("uf", None), ("municipios", None),
               ("lat", "grau decimal; vazio = não informado ou 0 na fonte"), ("lon", "grau decimal; vazio = não informado ou 0 na fonte"),
               ("kw_outorgado", None), ("kw_fiscalizado", None),
               ("entrada_operacao", "vazio = sem data, inclui o marcador 1900-01-03 do SIGA"),
               ("garantia_fisica_kwmed", "vazio = sem garantia física registrada"), ("vigencia_inicio", None),
               ("vigencia_fim", None), ("cnpjs_proprietarios", "14 dígitos, separados por |")],
    "capacidade_uf": [("uf", "UF principal"), ("tipo", None), ("origem", None), ("fonte", "DscFonteCombustivel"), ("usinas", None),
                      ("mw_fiscalizado", "usinas na fase Operação"), ("mw_outorgado", "vazio = campo não informado pela fonte")],
    "carteira": [("data_base_ralie", "fotografia DatRalie em que as previsões foram registradas"), ("nucleo_ceg", None), ("ceg", None),
                 ("nome", None), ("tipo", None), ("uf", None), ("kw_outorgado", None), ("kw_ugs_em_implantacao", None), ("ugs", None),
                 ("situacao_obra", None), ("viabilidade", None), ("situacao_cronograma", None), ("justificativa_previsao", None),
                 ("previsao_min", "previsão SFG de operação comercial das unidades"), ("previsao_max", None), ("outorgado_max", None),
                 ("atraso_previsto_dias", "previsao_max menos outorgado_max; vazio sem previsão"), ("leiloes", None), ("fase_siga", None)],
    "unidades": [("data_base_ralie", "fotografia DatRalie"), ("nucleo_ceg", None), ("ug", None), ("tipo", None), ("uf", None),
                 ("kw", "potência unitária"), ("comercial_outorgado", None),
                 ("previsao_sfg", "vazio = sem previsão da fiscalização"),
                 ("previsao_em_bloco", "sim = data atribuída a 100 usinas ou mais na mesma fotografia (convencional)"),
                 ("teste_realizado", None)],
    "trajetorias": [("nucleo_ceg", None), ("ceg", None), ("nome", None), ("tipo", None), ("uf", None), ("primeira_fotografia", None),
                    ("ultima_fotografia", None), ("kw_outorgado_primeira", None), ("previsao_primeira", None),
                    ("outorgado_primeira", None), ("previsao_ultima", None), ("outorgado_ultima", None), ("mudancas_previsao", None),
                    ("ugs_primeira", None), ("ugs_primeira_liberadas", None), ("kw_primeira_liberado", None), ("ultima_liberacao", None),
                    ("desfecho", None), ("data_encerramento", "vazio = sem ato datado"),
                    ("encerramento_sem_data", "sim = ato de encerramento sem data de publicação na fonte")],
    "confiabilidade": [("ralie", "fotografia mensal S"), ("fim_janela", "S + 365 dias"), ("tipo", "TOTAL ou tipo de geração"),
                       ("ugs", None), ("kw_prometido", None), ("kw_no_prazo", None), ("kw_depois", None), ("kw_nao_liberado", None),
                       ("ugs_excluidas_ja_liberadas", "unidades já liberadas antes de S, fora do denominador")],
    "liberacoes": [("ano", "ano da liberação comercial"), ("tipo", "TOTAL ou tipo de geração"), ("linhas", "linhas do arquivo detalhado"),
                   ("kw_liberado", None), ("kw_com_data_outorgada", None),
                   ("kw_depois_do_prazo", "liberação depois da data outorgada vigente na publicação"),
                   ("kw_antes_do_prazo", None),
                   ("mediana_desvio_dias_ponderada", "liberação menos data outorgada vigente, ponderada por kW; desvio em relação a um prazo, não atraso com data-base")],
    "encerramentos": [("publicacao", "vazio = ato sem data de publicação na fonte"), ("encerramento", "revogacao ou extincao"),
                      ("nucleo_ceg", "vazio = ato sem chave de usina na fonte"), ("ceg", None), ("nome", None), ("tipo", None),
                      ("uf", None), ("mw_no_ato", "MdaPotenciaInstaladaMW como publicado"),
                      ("mw_usado", "potência somada; vazio = fora da soma"),
                      ("conferencia_potencia", "conferida, corrigida_kw, fora_da_soma ou sem_potencia"),
                      ("motivo_conferencia", None),
                      ("ato_repetido", "sim = a usina já tinha ato de encerramento anterior (a potência conta uma vez)"),
                      ("fase_siga", "fase da usina no SIGA na data do arquivo; Operação = outorga encerrada com usina ainda em operação"),
                      ("outorga_siga", None), ("assunto", None), ("ato", None), ("numero", None), ("agente", None)],
    "leiloes": [("ano", None), ("data", None), ("leilao", None), ("lote", None), ("empreendimento", None), ("uf", None),
                ("prazo_meses", "vazio em lote sem vencedor"), ("km", "vazio em lote sem vencedor (0 da fonte é marcador)"),
                ("mva", "vazio em lote sem vencedor"), ("investimento_rs", "previsto no edital"), ("rap_edital_rs", None),
                ("rap_vencedor_rs", "vazio em lote sem vencedor"), ("desagio_pct", None), ("vencedor", None),
                ("contratado", "não = SEM LANCE, SEM INSCRITO APTO ou NÃO LEILOADO; reais nominais da data do leilão")],
    "obras": [("empreendimento", None), ("empreendimento_ons", None), ("contrato", "IdeCcd"), ("nome", None), ("situacao", None),
              ("oper_ato_legal", None), ("oper_efetiva", None), ("atraso_dias", "efetiva menos ato legal"),
              ("prazo_legal_vencido", None), ("km_lt", "km de circuito de linhas novas atribuídas a este empreendimento"),
              ("mva_tr", "MVA de transformadores novos atribuídos a este empreendimento"),
              ("modulos_em_outro_empreendimento", "módulos também listados aqui, contados no empreendimento da obra mais antiga"),
              ("ufs", None), ("obras", None), ("obras_resolucao", None)],
    "contratos": [("contrato", "IdeCcd"), ("numero", "NumCnaCcd"), ("assinatura", "DatAsnCcd"), ("fim", "DatFimCcd"),
                  ("cnpj", "14 dígitos"), ("agente", None), ("empreendimentos", "vazio = contrato sem empreendimento cadastrado no SIGET"),
                  ("km_lt_novas", "km de circuito do objeto original (linhas com o mesmo fim do contrato); vazio = sem empreendimento"),
                  ("mva_tr_novos", None), ("empreendimentos_com_prazo_proprio", "reforços incorporados com outra data de fim, fora das somas")],
    "pde": [("figura", None), ("titulo", None), ("referencia", "ano ou mês"), ("serie", None), ("valor", None),
            ("unidade", "PDE 2035, CENÁRIO")],
}


def _cabecalho(chave):
    return [c for c, _ in COLUNAS[chave]]


def _descricao(chave):
    return "; ".join(f"{c} ({n})" if n else c for c, n in COLUNAS[chave])

REGISTRO = {
    "id": "expansao", "gold": GOLD, "familia": FAMILIA, "ordem": 30,
    "datasets": [
        {"orgao": "ANEEL", "nome": "siga-sistema-de-informacoes-de-geracao-da-aneel", "slug": "aneel-siga",
         "dataset_silver": DS_SIGA, "titulo": "SIGA: empreendimentos de geração por fase",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SIGA, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["usinas"], DOWNLOADS["pontos"], DOWNLOADS["capacidade_uf"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica",
         "slug": "aneel-ralie", "dataset_silver": DS_RALIE,
         "titulo": "RALIE: acompanhamento da expansão da oferta de geração (atual e histórico desde jun/2021)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_RALIE, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["carteira"], DOWNLOADS["unidades"], DOWNLOADS["trajetorias"],
                       DOWNLOADS["confiabilidade"]],
         "quebras": [{"data": "2021-06-17", "descricao": "Primeira fotografia do histórico publicado do RALIE; antes dela não há previsão com data-base em dados abertos."}]},
        {"orgao": "ANEEL", "nome": "liberacao-para-operacao-comercial-de-empreendimentos-de-geracao",
         "slug": "aneel-liberacao-operacao-comercial", "dataset_silver": DS_LIB,
         "titulo": "Liberação para operação comercial de unidades geradoras", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_LIB, "licenca": LICENCA_ANEEL, "paginas": PAGINAS, "downloads": [DOWNLOADS["liberacoes"]],
         "quebras": [{"data": "2014-01-01", "descricao": "Antes de 2014 o arquivo detalhado não cobre toda a potência liberada no ano (nota do dicionário de dados da ANEEL)."}]},
        {"orgao": "ANEEL", "nome": "atos-de-outorgas-de-geracao", "slug": "aneel-atos-outorgas-geracao",
         "dataset_silver": DS_ATOS, "titulo": "Atos de outorgas de geração (revogações e extinções desde 2015)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_ATOS, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["encerramentos"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "resultado-de-leiloes", "slug": "aneel-resultado-leiloes",
         "dataset_silver": DS_LEILOES, "titulo": "Resultado de leilões de transmissão (desde 1999)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_LEILOES, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["leiloes"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "sistema-de-gestao-da-transmissao-siget", "slug": "aneel-siget",
         "dataset_silver": DS_SIGET, "titulo": "SIGET: empreendimentos, obras e módulos de transmissão",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SIGET, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["obras"], DOWNLOADS["contratos"]], "quebras": []},
        {"orgao": "ANEEL", "nome": "capacidade-instalada-por-unidade-da-federacao", "slug": "aneel-capacidade-uf",
         "dataset_silver": DS_AGREG, "titulo": "Capacidade instalada por UF (usada para reconciliar o SIGA)",
         "estado": "INTEGRADO", "url": URL_CAP_UF, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [], "quebras": []},
        {"orgao": "ANEEL", "nome": "empreendimentos-em-operacao", "slug": "aneel-empreendimentos-operacao",
         "dataset_silver": DS_AGREG, "titulo": "Empreendimentos em operação por tipo (usado para reconciliar o SIGA)",
         "estado": "INTEGRADO", "url": URL_EMP_OP, "licenca": LICENCA_ANEEL, "paginas": PAGINAS,
         "downloads": [], "quebras": []},
        {"orgao": "EPE", "nome": "pde-2035", "slug": "epe-pde-2035", "dataset_silver": DS_PDE,
         "titulo": "Plano Decenal de Expansão de Energia 2035: caderno de dados do relatório final",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_PDE_PAGINA, "licenca": LICENCA_EPE, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["pde"]], "formatos": ["XLSX", "PDF"],
         "descricao": "Planilhas por capítulo do PDE 2035 (aprovado pela Portaria MME nº 923/2026). Cenário de planejamento, nunca realizado.",
         "quebras": []},
        {"orgao": "EPE", "nome": "webmap-epe-linhas-de-transmissao", "slug": "epe-webmap-linhas-transmissao",
         "dataset_silver": DS_REDE_EPE,
         "titulo": "WebMap da EPE: linhas de transmissão existentes e da expansão planejada (geometria)",
         "estado": "UTILIZADO EM INDICADOR", "url": er.URL_WEBMAP, "licenca": LICENCA_EPE, "paginas": PAGINAS,
         "downloads": [DOWNLOADS["rede_epe"]], "formatos": ["GeoJSON"],
         "descricao": "Camadas 21 (base existente) e 10 (expansão planejada) do serviço ArcGIS SMA/WMS_Webmap_EPE, consultadas pela interface pública /query. O serviço não informa a data de atualização das camadas.",
         "quebras": []},
    ],
    "arquivos": {
        **{DOWNLOADS[k]: _descricao(k) for k in COLUNAS},
        DOWNLOADS["pontos"]: "JSON colunar com as usinas do SIGA que têm coordenada oficial: nucleo, nome, tipo, estagio, uf, mw_outorgado, mw_fiscalizado, lat, lon",
        DOWNLOADS["rede_epe"]: "JSON colunar das linhas de transmissão do WebMap da EPE: camada (existente ou planejada); nome; tensao_kv (vazio = 0 na fonte); ano (operação ou previsto; vazio = 0 na fonte); km_geometria (comprimento da geometria generalizada); d (caminho SVG na grade da malha de UF de public/energia/geo/uf.json)",
    },
}

INTEGRADOR_VERSAO = "1"
# Versão do integrador por recurso: subir a versão de um recurso reintegra só as
# vintages dele (sem reler o Parquet histórico de 40 MB). Versão 3 dos atos: potência
# citada nos demais atos de outorga do mesmo núcleo, para conferir a do encerramento.
# Versão 4 dos leilões: lote sem vencedor marcado e zeros-marcadores como ausência; em
# lote contratado, 0 km com linha descrita (ou 0 MVA com MVA descrito) vira ausência.
# Versão 3 das obras do SIGET: data de fim do contrato em cada linha. (A versão 2 ficou
# marcada sem efeito: reintegrar a mesma vintage não reescrevia as linhas, o que
# _limpa_integracao_antiga corrige.)
VERSAO_INTEGRADOR_RECURSO = {
    "atos-outorgas-aneel.csv": "3",
    "resultado-leiloes-transmissao.csv": "4",
    "siget-contrato-empreendimento-obra-modulo.csv": "3",
}
DS_INTEGRACAO = "_integracao_expansao"
MESES_JANELA = 12


# ================================================================== coleta

def _ultima_coleta_ok(con, dataset, recurso):
    row = con.execute("SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND recurso=? AND ok=1",
                      (dataset, recurso)).fetchone()
    if not row or not row[0]:
        return None
    return datetime.fromisoformat(row[0].replace("Z", "+00:00"))


def _baixa_conjunto(con, cj, baixar_meta=http_get, baixador=http_download, agora=None):
    """Baixa os recursos escolhidos de um conjunto CKAN da ANEEL. Recurso ausente do
    pacote é registrado como falha (drift de catálogo visível)."""
    agora = agora or datetime.now(timezone.utc)
    ds = cj["dataset"]
    st = {"conjunto": cj["nome"], "dataset": ds, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    try:
        pac = ckan.pacote("ANEEL", cj["nome"], baixar=baixar_meta)
    except Exception as e:
        base.registra_coleta(con, ds, "*", False, f"package_show {cj['nome']}: {e}")
        con.commit()
        st["falhas"].append(f"package_show: {str(e)[:200]}")
        return st
    meta = ckan.metadados(pac, "ANEEL")
    base.escreve_gold(f"_meta_{ds}__{cj['nome']}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    achados = set()
    for r in pac.get("resources", []):
        arq = (r.get("url") or "").rsplit("/", 1)[-1]
        if arq not in cj["arquivos"]:
            continue
        achados.add(arq)
        ultima = base.ultima_vintage(con, ds, arq)
        ok_em = _ultima_coleta_ok(con, ds, arq)
        if ultima and ok_em and agora - ok_em < timedelta(days=cj["intervalo_dias"]):
            st["puladas"] += 1
            continue
        ext = arq.rsplit(".", 1)[-1].lower()
        res = ckan.baixar_recurso(con, orgao="ANEEL", dataset=ds, recurso=arq, url=r["url"],
                                  publicado_em=r.get("last_modified") or r.get("metadata_modified"), ext=ext,
                                  max_idade_dias=30, baixador=baixador)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{arq}: {res['detalhe']}")
        time.sleep(0.3)
    for arq in sorted(set(cj["arquivos"]) - achados):
        base.registra_coleta(con, ds, arq, False, "recurso ausente do package_show")
        st["falhas"].append(f"{arq}: ausente do package_show")
    con.commit()
    return st


def _baixa_epe(con, baixador=http_download):
    st = {"dataset": DS_PDE, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    for rec in EPE_RECURSOS:
        # edição publicada e aprovada: o conteúdo não muda; conferência mensal basta
        res = ckan.baixar_recurso(con, orgao="EPE", dataset=DS_PDE, recurso=rec["recurso"], url=rec["url"],
                                  publicado_em=None, ext=rec["ext"], max_idade_dias=30, baixador=baixador)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{rec['recurso']}: {res['detalhe']}")
    return st


def _versao_integrador(rec):
    return VERSAO_INTEGRADOR_RECURSO.get(rec, INTEGRADOR_VERSAO)


def _baixa_rede_epe(con, baixar=http_get, agora=None, intervalo_dias=30):
    """Camadas de linhas de transmissão do WebMap da EPE (existente e planejada), pela
    consulta pública do serviço ArcGIS, paginada. As páginas de cada camada viram um
    único GeoJSON no bronze (sha256 e vintage), com as URLs consultadas e a contagem
    informada pelo serviço; a contagem é conferida contra as feições recebidas."""
    agora = agora or datetime.now(timezone.utc)
    st = {"dataset": DS_REDE_EPE, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    for camada, meta in er.CAMADAS.items():
        rec = f"linhas-transmissao-{camada}.geojson"
        ultima = base.ultima_vintage(con, DS_REDE_EPE, rec)
        ok_em = _ultima_coleta_ok(con, DS_REDE_EPE, rec)
        if ultima and ok_em and agora - ok_em < timedelta(days=intervalo_dias):
            st["puladas"] += 1
            continue
        try:
            corpo, _ = baixar(er.url_contagem(camada), timeout=60)
            contagem = json.loads(corpo)["count"]
            paginas, urls = [], []
            for offset in range(0, contagem, er.PAGINA):
                url = er.url_consulta(camada, offset)
                corpo, _ = baixar(url, timeout=180, accept="*/*")
                paginas.append(corpo)
                urls.append(url)
                time.sleep(0.3)
            feicoes = er.le_paginas(paginas)
            if len(feicoes) != contagem:
                raise ValueError(f"{len(feicoes)} feições recebidas para {contagem} informadas pelo serviço")
        except Exception as e:  # serviço fora do ar ou resposta inesperada: registrada, sem dado inventado
            base.registra_coleta(con, DS_REDE_EPE, rec, False, f"consulta: {e}")
            con.commit()
            st["falhas"].append(f"{rec}: {str(e)[:200]}")
            continue
        capturado = base.agora_utc()
        doc = {"type": "FeatureCollection", "camada": meta["titulo"], "servico": er.SERVICO, "id_camada": meta["id"],
               "contagem_informada": contagem, "consultas": urls, "features": feicoes}
        corpo = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        arquivo, sha = base.salva_bronze("epe", DS_REDE_EPE, rec, corpo, "json", capturado)
        if ultima and ultima["sha256"] == sha:
            base.registra_coleta(con, DS_REDE_EPE, rec, True, f"{len(corpo)} bytes, idêntico à vintage {ultima['vintage_id']}")
            st["identicas"] += 1
        else:
            base.registra_vintage(con, DS_REDE_EPE, rec, er.SERVICO + f"/{meta['id']}", capturado, None, sha, len(corpo),
                                  "coleta_direta", arquivo)
            base.registra_coleta(con, DS_REDE_EPE, rec, True, f"{len(corpo)} bytes, {contagem} feições")
            st["novas"] += 1
        con.commit()
    return st


def _integrado(con, vid, rec=None):
    row = con.execute("SELECT valor FROM registros WHERE dataset=? AND chave=? AND campo='versao'",
                      (DS_INTEGRACAO, vid)).fetchone()
    return bool(row) and row[0] == _versao_integrador(rec)


def _limpa_integracao_antiga(con, ds, vid):
    """Vintage já integrada por uma versão anterior do integrador: apaga as linhas que
    ela gerou antes de reintegrar. grava_registros e grava_observacoes usam INSERT OR
    IGNORE com a vintage na chave primária, então a mesma vintage não seria
    reescrita. Só a vintage vigente do recurso é reintegrada (não há vintage
    posterior calculada sobre a antiga)."""
    row = con.execute("SELECT valor FROM registros WHERE dataset=? AND chave=? AND campo='versao'",
                      (DS_INTEGRACAO, vid)).fetchone()
    if not row:
        return
    con.execute("DELETE FROM registros WHERE dataset=? AND vintage_id=?", (ds, vid))
    con.execute("DELETE FROM observacoes WHERE dataset=? AND vintage_id=?", (ds, vid))


def _marca_integrado(con, vid, detalhe, rec=None):
    con.execute("DELETE FROM registros WHERE dataset=? AND chave=?", (DS_INTEGRACAO, vid))
    con.executemany("INSERT INTO registros VALUES(?,?,?,?,?)",
                    [(DS_INTEGRACAO, vid, "versao", _versao_integrador(rec), vid),
                     (DS_INTEGRACAO, vid, "integrado_em", base.agora_utc(), vid),
                     (DS_INTEGRACAO, vid, "detalhe", json.dumps(detalhe, ensure_ascii=False)[:2000], vid)])


def _fmt(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(round(v, 6))
    if isinstance(v, (list, tuple, dict)):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


def _grava_estado(con, dataset, vid, prefixo, estado):
    """Grava o estado completo de um recurso em registros: chaves presentes com seus
    campos; chaves conhecidas com o prefixo que sumiram do arquivo têm os campos
    apagados ('' pela semântica de base.grava_registros), o que preserva a data em que
    a unidade saiu da fonte (ex.: entrou em operação e deixou o RALIE)."""
    conhecidos = {k: v for k, v in base.registros_como_estavam_em(con, dataset).items() if k.startswith(prefixo)}
    linhas = []
    for k, campos in estado.items():
        ch = f"{prefixo}{k}"
        for campo, v in campos.items():
            linhas.append((ch, campo, _fmt(v)))
        for campo in conhecidos.get(ch, {}):
            if campo not in campos:
                linhas.append((ch, campo, None))
    atuais = {f"{prefixo}{k}" for k in estado}
    for ch, campos in conhecidos.items():
        if ch not in atuais:
            linhas.extend((ch, campo, None) for campo in campos)
    return base.grava_registros(con, dataset, vid, linhas)


def _compacto(reg, historicos=()):
    """Registro compacto para o silver: os campos cuja revisão importa para as análises
    (ex.: previsão de operação comercial) ficam como campos próprios, com histórico por
    captura; os demais vão num único campo 'dados' (JSON). Um campo por atributo
    multiplicaria por 20 as linhas do silver sem ganho: mudança em qualquer atributo
    também fica registrada, porque o JSON muda."""
    out = {h: reg.get(h) for h in historicos}
    resto = {k: v for k, v in reg.items() if k not in historicos and v is not None}
    out["dados"] = json.dumps(resto, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return out


def _le_csv(v):
    return ckan.le_csv_bronze(v["arquivo"])


def _bytes_bronze(v):
    with base.abre_bronze(v["arquivo"]) as f:
        return f.read()


def _integra(con, ds, rec, v):
    """Leva a vintage `v` do recurso `rec` para o silver. Idempotente."""
    if rec == "siga-empreendimentos-geracao-diario.csv":
        usinas, oc = ax.le_siga(_le_csv(v))
        est = {str(k): _compacto({**u, "cnpjs": "|".join(x for x in ax.cnpjs_de_proprietarios(u["proprietarios"]) if x) or None},
                                 ("fase",))
               for k, u in usinas.items()}
        r = _grava_estado(con, ds, v["vintage_id"], "usina:", est)
        oc["duplicadas_divergentes"] = oc["duplicadas_divergentes"][:50]
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", k, _fmt(x)) for k, x in oc.items()])
        return {"usinas": len(usinas), "registros": r}
    if rec == "ralie-usina-atual.csv":
        us, datas = ax.le_ralie_usina(_le_csv(v))
        r = _grava_estado(con, ds, v["vintage_id"], "usina:",
                          {str(k): _compacto(x, ("situacao_obra", "viabilidade", "situacao_cronograma"))
                           for k, x in us.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "datas_ralie", _fmt(datas)),
                                                        (f"meta:{rec}", "linhas", str(len(us)))])
        return {"usinas": len(us), "datas": datas, "registros": r}
    if rec == "ralie-unidade-geradora-atual.csv":
        ugs, datas = ax.le_ralie_ug(_le_csv(v))
        # tipo e UF são da usina (mesmo núcleo) e não se repetem por unidade no silver
        r = _grava_estado(con, ds, v["vintage_id"], "ug:",
                          {f"{k[0]}:{k[1]}": _compacto({kk: vv for kk, vv in x.items() if kk not in ("tipo", "uf")},
                                                       ("previsao_sfg",))
                           for k, x in ugs.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "datas_ralie", _fmt(datas)),
                                                        (f"meta:{rec}", "linhas", str(len(ugs)))])
        return {"ugs": len(ugs), "datas": datas, "registros": r}
    if rec == "ralie-leilao-atual.csv":
        le = ax.le_ralie_leilao(_le_csv(v))
        r = _grava_estado(con, ds, v["vintage_id"], "leilao:",
                          {f"{k[0]}:{k[1]}": {"inicio_suprimento": d, "presente": "1"} for k, d in le.items()})
        return {"vinculos": len(le), "registros": r}
    if rec == "ralie-usina-historico.parquet":
        pf = ax.abre_parquet(_bytes_bronze(v))
        h = ax.agrega_historico_usina(pf)
        linhas = []
        for d, dims in h.items():
            for dim, vals in dims.items():
                for val, x in vals.items():
                    linhas.append((f"usina.kw_outorgado.{dim}.{val}", d, round(x["kw"], 3)))
                    linhas.append((f"usina.n.{dim}.{val}", d, float(x["n"])))
        r = base.grava_observacoes(con, ds, v["vintage_id"], linhas)
        return {"fotografias": len(h), "observacoes": r}
    if rec == "ralie-unidade-geradora-historico.parquet":
        pf = ax.abre_parquet(_bytes_bronze(v))
        h = ax.agrega_historico_ug(pf)
        linhas = []
        for d, tipos in h.items():
            for t, x in tipos.items():
                # soma em ponto flutuante feita em paralelo pelo pyarrow varia na última
                # casa entre execuções: arredondar a 1 W evita "revisões" espúrias
                linhas.append((f"ug.kw.{t}", d, round(x["kw"], 3)))
                linhas.append((f"ug.n.{t}", d, float(x["n"])))
                linhas.append((f"ug.kw_sem_previsao.{t}", d, round(x["kw_sem_previsao"], 3)))
        r = base.grava_observacoes(con, ds, v["vintage_id"], linhas)
        return {"fotografias": len(h), "observacoes": r}
    if rec == "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv":
        linhas, _, nao = ax.le_liberacao(_le_csv(v))
        # uma chave por usina (núcleo do CEG) com a lista das liberações: nome, CEG e
        # origem ficam no SIGA; aqui só o que a análise usa. Linhas repetidas da fonte
        # (mesma unidade e mesma data) são preservadas como linhas distintas.
        est = {}
        for x in linhas:
            if x["nucleo"] is None or x["comercial_realizado"] is None:
                continue
            u = est.setdefault(str(x["nucleo"]), {"tipo": x["tipo"], "uf": x["uf"],
                                                  "si": 1 if (x["sistema"] or "").startswith("Sistemas Isolados") else 0,
                                                  "ugs": []})
            u["ugs"].append([x["ug_bruto"], x["kw"], x["comercial_outorgado"], x["comercial_realizado"]])
        for u in est.values():
            u["ugs"].sort(key=lambda z: (z[3] or "", str(z[0])))
        r = _grava_estado(con, ds, v["vintage_id"], "lib:", {k: _compacto(x) for k, x in est.items()})
        base.grava_registros(con, ds, v["vintage_id"], [(f"meta:{rec}", "nao_vinculadas", _fmt(nao)),
                                                        (f"meta:{rec}", "linhas", str(len(linhas)))])
        return {"linhas": len(linhas), "usinas": len(est), "registros": r}
    if rec == "unidades-geradoras-liberadas-operacao-comercial-resumido.csv":
        res = ax.le_liberacao_resumida(_le_csv(v))
        linhas = [(f"resumido.{t}", ano, val) for ano, tipos in res.items() for t, val in tipos.items()]
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "atos-outorgas-aneel.csv":
        refs = {}
        enc = ax.le_encerramentos(_le_csv(v), referencias=refs)
        est = {}
        for x in enc:
            ident = x["nucleo"] if x["nucleo"] is not None else (x["ceg"] or x["nome"] or "?")
            k = f"{ident}:{x['publicacao']}:{x['objeto']}:{x['numero'] or ''}"
            # potência citada nos demais atos de outorga da mesma usina (corroboração
            # independente na conferência de unidade da potência do encerramento)
            x["outros_atos"] = sorted(refs.get(x["nucleo"], []), key=lambda z: (z[1] or "", z[0] or "")) \
                if x["nucleo"] is not None else []
            est[k] = x
        return {"encerramentos": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "enc:", {k: _compacto(x) for k, x in est.items()})}
    if rec == "resultado-leiloes-transmissao.csv":
        lotes = ax.le_leiloes_transmissao(_le_csv(v))
        est = {}
        for x in lotes:
            k = f"{x['leilao']}:{x['lote']}"
            n = 2
            while k in est:  # lote repetido na fonte: mantém as duas linhas, com sufixo
                k = f"{x['leilao']}:{x['lote']}#{n}"
                n += 1
            est[k] = x
        return {"lotes": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "lote:", {k: _compacto(x) for k, x in est.items()})}
    if rec == "siget-contrato-empreendimento-obra-modulo.csv":
        ob = ax.le_siget_obras(_le_csv(v))
        # uma chave por empreendimento, com a lista de obras × módulos; a descrição longa
        # da obra fica no bronze
        est = {}
        for (obra, mdl), x in ob.items():
            e = est.setdefault(x["empreendimento"] or f"sem:{obra}", {
                k: x[k] for k in ("contrato", "empreendimento_ons", "nome_empreendimento", "situacao_empreendimento",
                                  "oper_efetiva_empreendimento", "conclusao_ato_legal", "oper_ato_legal")})
            e.setdefault("obras", []).append([obra, mdl, x["situacao_obra"], x["tipo_obra"], x["oper_obra"],
                                              x["tipo_modulo"], x["modulo"], x["fim_contrato_linha"]])
        for e in est.values():
            e["obras"].sort(key=lambda z: (z[0], z[1]))
        return {"obras_modulos": len(ob), "empreendimentos": len(est),
                "registros": _grava_estado(con, ds, v["vintage_id"], "epd:",
                                           {k: _compacto(x, ("situacao_empreendimento",)) for k, x in est.items()})}
    if rec == "siget-resolucao-empreendimento-obra-modulo.csv":
        ob = ax.le_siget_obras(_le_csv(v))
        est = {}
        for (obra, mdl), x in ob.items():
            est.setdefault(x["empreendimento"] or f"sem:{obra}", set()).add(obra)
        return {"obras_modulos": len(ob),
                "registros": _grava_estado(con, ds, v["vintage_id"], "resolucao:",
                                           {k: {"obras": sorted(o)} for k, o in est.items()})}
    if rec == "siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv":
        lt = ax.le_siget_linhas(_le_csv(v))
        return {"linhas": len(lt),
                "registros": _grava_estado(con, ds, v["vintage_id"], "lt:", {k: _compacto(x) for k, x in lt.items()})}
    if rec == "siget-contrato-agente.csv":
        cc = ax.le_siget_contratos(_le_csv(v))
        return {"contratos": len(cc),
                "registros": _grava_estado(con, ds, v["vintage_id"], "ccd:", {k: _compacto(x) for k, x in cc.items()})}
    if rec == "siget-contrato-moduloequipamento-subestacao.csv":
        eq = ax.le_siget_equipamentos(_le_csv(v))
        return {"equipamentos": len(eq),
                "registros": _grava_estado(con, ds, v["vintage_id"], "eqp:", {k: _compacto(x) for k, x in eq.items()})}
    if rec == "capacidade-instalada-geracao-uf.csv":
        linhas = []
        for r in _le_csv(v):
            uf, ano, mes = ax.uf_valida(r.get("SigUF")), ax.texto(r.get("AnoReferencia")), ax.texto(r.get("MesReferencia"))
            if uf and ano and mes and mes.isdigit():
                linhas.append((f"cap_uf.kw.{uf}", f"{ano}-{int(mes):02d}", ax.numero(r.get("MdaPotenciaInstaladakW"))))
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "empreendimento-operacao-historico.csv":
        linhas = []
        for r in _le_csv(v):
            t, ano, mes = ax.texto(r.get("SigTipoGeracao")), ax.texto(r.get("AnoReferencia")), ax.texto(r.get("MesReferencia"))
            if t and ano and mes and mes.isdigit():
                ref = f"{ano}-{int(mes):02d}"
                linhas.append((f"emp_op.kw.{t}", ref, ax.numero(r.get("MdaPotenciaInstaladaKW"))))
                linhas.append((f"emp_op.n.{t}", ref, ax.numero(r.get("QtdUsinasPeriodo"))))
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    if rec == "pde2035_dados_relatorio_final.zip":
        pde = epe_pde.extrai_pde2035(_bytes_bronze(v))
        linhas = []
        for fig, d in pde.items():
            if fig.startswith("_"):
                continue
            for lin in d["linhas"]:
                for col, val in lin["valores"].items():
                    linhas.append((f"pde2035.{fig}.{col}", lin["ref"], val))
        base.grava_registros(con, ds, v["vintage_id"], [("meta:pde2035", "atualizacao", _fmt(pde["_atualizacao"])),
                                                        ("meta:pde2035", "arquivos", _fmt(pde["_arquivos"]))])
        return {"observacoes": base.grava_observacoes(con, ds, v["vintage_id"], linhas)}
    return None  # recurso guardado no bronze sem integração (página e relatório do PDE)


def coletar(con, ctx):
    status = {"conjuntos": [], "integracoes": {}}
    if ctx.get("sem_rede"):
        status["sem_rede"] = True
    else:
        for cj in CONJUNTOS:
            status["conjuntos"].append(_baixa_conjunto(con, cj))
        status["conjuntos"].append(_baixa_epe(con))
        status["conjuntos"].append(_baixa_rede_epe(con))
    for ds in sorted({cj["dataset"] for cj in CONJUNTOS} | {DS_PDE}):
        for rec, v in ckan.vintages_vigentes(con, ds).items():
            if _integrado(con, v["vintage_id"], rec):
                continue
            _limpa_integracao_antiga(con, ds, v["vintage_id"])
            try:
                det = _integra(con, ds, rec, v)
            except Exception as e:  # arquivo com esquema inesperado: registrado, sem número inventado
                base.registra_coleta(con, ds, rec, False, f"integração: {e}")
                status["integracoes"][rec] = f"falha: {str(e)[:300]}"
                con.commit()
                continue
            if det is not None:
                _marca_integrado(con, v["vintage_id"], det, rec)
            status["integracoes"][rec] = det
            con.commit()
    status["ok"] = not any(s["falhas"] for s in status["conjuntos"]) and \
        not any(isinstance(x, str) and x.startswith("falha") for x in status["integracoes"].values())
    return status



# ================================================================== leitura do silver

def _estado(con, ds, prefixo, instante=None):
    """{chave sem prefixo: dict} com o estado dos registros (campos próprios + 'dados')."""
    out = {}
    for k, campos in base.registros_como_estavam_em(con, ds, instante).items():
        if not k.startswith(prefixo):
            continue
        d = json.loads(campos.get("dados") or "{}")
        for kk, vv in campos.items():
            if kk != "dados":
                d[kk] = vv
        if d:
            out[k[len(prefixo):]] = d
    return out


def _meta(con, ds, rec):
    m = base.registros_como_estavam_em(con, ds).get(f"meta:{rec}", {})
    out = {}
    for k, v in m.items():
        try:
            out[k] = json.loads(v)
        except (ValueError, TypeError):
            out[k] = v
    return out


def _f(x):
    """Texto numérico do silver → float (vazio/None = ausência)."""
    if x is None or x == "":
        return None
    return float(x)


def _mw(kw):
    return None if kw is None else kw / 1000.0


def _r(v, casas=1):
    return c.r(v, casas)


def _pct(num, den, casas=1):
    return c.r(100.0 * num / den, casas) if den else None


def _milhar(v, casas=0):
    """1234567.8 → '1.234.568' (casas=0) ou '1.234.567,8': formato brasileiro do texto exibido."""
    txt = f"{v:,.{casas}f}"
    return txt.replace(",", "§").replace(".", ",").replace("§", ".")


# ================================================================== blocos

ROTULO_ESTAGIO = {
    "operacao": "Em operação",
    "construcao": "Em construção",
    "construcao_nao_iniciada": "Outorgado, construção não iniciada",
    "outro": "Outra fase (rótulo não previsto)",
}
ORDEM_ORIGEM = ("Hídrica", "Fóssil", "Eólica", "Solar", "Biomassa", "Nuclear")


def _bloco_capacidade(siga, agreg, lib_linhas, data_siga):
    """Capacidade instalada em operação (SIGA, fase Operação), por tipo, origem, fonte e
    UF, com reconciliação contra os agregados publicados pela própria ANEEL."""
    op = {k: u for k, u in siga.items() if u.get("fase") == "Operação"}
    tot_f = sum(u.get("kw_fiscalizado") or 0 for u in op.values())
    tot_o = sum(u.get("kw_outorgado") or 0 for u in op.values())

    def agrupa(chave):
        g = defaultdict(lambda: {"usinas": 0, "kw_f": 0.0, "kw_o": 0.0})
        for u in op.values():
            x = g[chave(u)]
            x["usinas"] += 1
            x["kw_f"] += u.get("kw_fiscalizado") or 0
            x["kw_o"] += u.get("kw_outorgado") or 0
        return g

    por_tipo = [{"tipo": t, "nome": ax.NOME_TIPO.get(t, t), "usinas": x["usinas"],
                 "mw_fiscalizado": _r(_mw(x["kw_f"])), "mw_outorgado": _r(_mw(x["kw_o"])),
                 "participacao_pct": _pct(x["kw_f"], tot_f, 2)}
                for t, x in sorted(agrupa(lambda u: u.get("tipo")).items(), key=lambda kv: -kv[1]["kw_f"])]
    por_origem = [{"origem": o, "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"])),
                   "participacao_pct": _pct(x["kw_f"], tot_f, 2)}
                  for o, x in sorted(agrupa(lambda u: u.get("origem")).items(), key=lambda kv: -kv[1]["kw_f"])]
    por_fonte = [{"origem": k[0], "fonte": k[1], "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"]))}
                 for k, x in sorted(agrupa(lambda u: (u.get("origem"), u.get("fonte"))).items(),
                                    key=lambda kv: -kv[1]["kw_f"])]
    uf_origem = agrupa(lambda u: (u.get("uf"), u.get("origem")))
    ufs = agrupa(lambda u: u.get("uf"))
    por_uf = []
    for uf, x in sorted(ufs.items(), key=lambda kv: -kv[1]["kw_f"]):
        por_uf.append({"uf": uf, "usinas": x["usinas"], "mw_fiscalizado": _r(_mw(x["kw_f"])),
                       "participacao_pct": _pct(x["kw_f"], tot_f, 2),
                       "por_origem": {o: _r(_mw(uf_origem[(uf, o)]["kw_f"])) for o in ORDEM_ORIGEM
                                      if (uf, o) in uf_origem}})
    multi = [u for u in op.values() if len(ax.ufs_dos_municipios(u.get("municipios"))) > 1]
    csv_linhas = []
    for (uf, tipo, origem, fonte), x in sorted(
            agrupa(lambda u: (u.get("uf"), u.get("tipo"), u.get("origem"), u.get("fonte"))).items(),
            key=lambda kv: tuple(v or "" for v in kv[0])):
        csv_linhas.append([uf, tipo, origem, fonte, x["usinas"], _mw(x["kw_f"]), _mw(x["kw_o"])])
    _csv(os.path.basename(DOWNLOADS["capacidade_uf"]), _cabecalho("capacidade_uf"), csv_linhas)

    # reconciliação: agregado oficial mais recente por tipo (empreendimentos em operação)
    # e por UF (capacidade instalada por UF) contra o SIGA, com as liberações comerciais
    # entre o fim do mês do agregado e a data do SIGA como diferença esperada
    rec_tipo, rec_uf = [], []

    def liberado_entre(ref_mes, campo):
        """kW liberado para operação comercial depois do fim do mês do agregado e até a
        data do SIGA, por tipo ou UF: a diferença esperada entre as duas fotografias."""
        fim_ref = _fim_do_mes(ref_mes)
        out = defaultdict(float)
        for x in lib_linhas:
            if fim_ref < (x["realizado"] or "") <= data_siga:
                out[x[campo]] += x["kw"] or 0
        return out

    ref = max((r for r in agreg.get("emp_op_refs", [])), default=None)
    if ref:
        lib_intervalo = liberado_entre(ref, "tipo")
        tipos = agrupa(lambda u: u.get("tipo"))
        for t in sorted(set(tipos) | set(agreg["emp_op"].get(ref, {}))):
            agregado = agreg["emp_op"].get(ref, {}).get(t)
            siga_kw = tipos[t]["kw_f"] if t in tipos else 0.0
            if agregado is None:
                continue
            rec_tipo.append({
                "tipo": t, "siga_mw": _r(_mw(siga_kw), 3), "agregado_mw": _r(_mw(agregado), 3),
                "liberado_no_intervalo_mw": _r(_mw(lib_intervalo.get(t, 0.0)), 3),
                "diferenca_mw": _r(_mw(siga_kw - agregado), 3),
                "residuo_mw": _r(_mw(siga_kw - agregado - lib_intervalo.get(t, 0.0)), 3),
                "residuo_pct": _pct(siga_kw - agregado - lib_intervalo.get(t, 0.0), agregado, 3)})
    ref_uf = max((r for r in agreg.get("cap_uf_refs", [])), default=None)
    if ref_uf:
        lib_uf = liberado_entre(ref_uf, "uf")
        for uf in sorted(agreg["cap_uf"].get(ref_uf, {})):
            agregado = agreg["cap_uf"][ref_uf][uf]
            siga_kw = ufs[uf]["kw_f"] if uf in ufs else 0.0
            residuo = siga_kw - agregado - lib_uf.get(uf, 0.0)
            rec_uf.append({"uf": uf, "siga_mw": _r(_mw(siga_kw), 3), "agregado_mw": _r(_mw(agregado), 3),
                           "liberado_no_intervalo_mw": _r(_mw(lib_uf.get(uf, 0.0)), 3),
                           "diferenca_mw": _r(_mw(siga_kw - agregado), 3),
                           "diferenca_pct": _pct(siga_kw - agregado, agregado, 2),
                           "residuo_mw": _r(_mw(residuo), 3), "residuo_pct": _pct(residuo, agregado, 3)})
    return {
        "data_referencia": data_siga,
        "total": {"usinas": len(op), "mw_fiscalizado": _r(_mw(tot_f)), "mw_outorgado": _r(_mw(tot_o))},
        "por_tipo": por_tipo, "por_origem": por_origem, "por_fonte": por_fonte, "por_uf": por_uf,
        "multiestaduais": {"usinas": len(multi), "mw_fiscalizado": _r(_mw(sum(u.get("kw_fiscalizado") or 0 for u in multi)))},
        "reconciliacao": {"referencia_tipo": ref, "por_tipo": rec_tipo, "referencia_uf": ref_uf, "por_uf": rec_uf,
                          "tolerancia_residuo_pct": TOLERANCIA_RESIDUO_PCT,
                          "justificativa_tolerancia": JUSTIFICATIVA_TOLERANCIA,
                          "fora_da_tolerancia": {
                              "tipos": [x["tipo"] for x in rec_tipo if abs(x["residuo_pct"] or 0) > TOLERANCIA_RESIDUO_PCT],
                              "ufs": [x["uf"] for x in rec_uf if abs(x["residuo_pct"] or 0) > TOLERANCIA_RESIDUO_PCT]}},
    }


# Tolerância da reconciliação SIGA × agregados publicados pela ANEEL. O agregado é uma
# fotografia do fim de um mês anterior; entre ela e o SIGA do dia entram as liberações
# comerciais (descontadas) e também revisões de potência fiscalizada, usinas desativadas
# e usinas fora do acompanhamento do RALIE, que nenhum arquivo aberto data. Em 30/09/2026
# o resíduo por tipo ficou entre −0,7% e +0,0%; 1% do total do grupo separa esse ruído de
# uma quebra real (unidade trocada, fase perdida, UF errada), que produz dezenas de %.
TOLERANCIA_RESIDUO_PCT = 1.0
JUSTIFICATIVA_TOLERANCIA = ("1% do agregado do grupo: cobre revisões de potência fiscalizada, desativações e usinas fora "
                            "do RALIE entre o fim do mês do agregado e a data do SIGA, que nenhum arquivo aberto data; "
                            "uma quebra de leitura (kW lido como MW, fase ou UF trocada) produz dezenas de %.")


def _csv(nome, cabecalho, linhas):
    """CSV de download (base.escreve_csv) com texto saneado: o separador é ';' e a
    fonte usa ';' dentro de campos (proprietários, municípios), então ';' vira ',' e
    quebras de linha viram espaço. Número e vazio passam intactos."""
    def limpa(v):
        if isinstance(v, str):
            return v.replace(";", ",").replace("\r", " ").replace("\n", " ").strip()
        return v
    chave = next((k for k in COLUNAS if os.path.basename(DOWNLOADS[k]) == nome), None)
    if chave is not None and list(cabecalho) != _cabecalho(chave):
        raise ValueError(f"{nome}: cabeçalho diferente da descrição publicada em arquivos.json")
    for lin in linhas:
        if len(lin) != len(cabecalho):
            raise ValueError(f"{nome}: linha com {len(lin)} campos para {len(cabecalho)} colunas")
    return base.escreve_csv(nome, cabecalho, [[limpa(v) for v in lin] for lin in linhas])


def _fim_do_mes(ref):
    a, m = int(ref[:4]), int(ref[5:7])
    prox = date(a + (m == 12), m % 12 + 1, 1)
    return (prox - timedelta(days=1)).isoformat()


def _bloco_estagios(siga, encerramentos, ralie_us, ralie_ug, ralie_leilao, data_siga, data_ralie, ralie_kw_hist=None):
    """P040: estágios do SIGA, encerramentos de outorga e o detalhe do RALIE."""
    g = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    gt = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    gu = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_f": 0.0})
    for u in siga.values():
        e = u.get("estagio") or "outro"
        for d, k in ((g, e), (gt, (u.get("tipo"), e)), (gu, (u.get("uf"), e))):
            d[k]["usinas"] += 1
            d[k]["kw_o"] += u.get("kw_outorgado") or 0
            d[k]["kw_f"] += u.get("kw_fiscalizado") or 0
    ordem = ("operacao", "construcao", "construcao_nao_iniciada", "outro")
    resumo = [{"estagio": e, "rotulo": ROTULO_ESTAGIO[e], "usinas": g[e]["usinas"],
               "mw_outorgado": _r(_mw(g[e]["kw_o"])), "mw_fiscalizado": _r(_mw(g[e]["kw_f"]))}
              for e in ordem if e in g]
    tipos = sorted({t for t, _ in gt}, key=lambda t: -sum(gt[(t, e)]["kw_o"] for e in ordem if (t, e) in gt))
    por_tipo = []
    for t in tipos:
        linha = {"tipo": t, "nome": ax.NOME_TIPO.get(t, t)}
        for e in ordem[:3]:
            x = gt.get((t, e), {"usinas": 0, "kw_o": 0.0})
            linha[f"{e}_usinas"] = x["usinas"]
            linha[f"{e}_mw_outorgado"] = _r(_mw(x["kw_o"]))
        por_tipo.append(linha)
    ufs = sorted({uf for uf, _ in gu if uf})
    por_uf = []
    for uf in ufs:
        linha = {"uf": uf}
        for e in ordem[:3]:
            x = gu.get((uf, e), {"usinas": 0, "kw_o": 0.0})
            linha[f"{e}_usinas"] = x["usinas"]
            linha[f"{e}_mw_outorgado"] = _r(_mw(x["kw_o"]))
        por_uf.append(linha)

    # RALIE atual
    kw_ug = defaultdict(float)
    n_ug = defaultdict(int)
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        n_ug[n] += 1

    def agrupa_ralie(*campos):
        out = defaultdict(lambda: {"usinas": 0, "kw_o": 0.0, "kw_ug": 0.0})
        for n, u in ralie_us.items():
            k = tuple(u.get(cp) or "(vazio)" for cp in campos)
            out[k]["usinas"] += 1
            out[k]["kw_o"] += u.get("kw_outorgado") or 0
            out[k]["kw_ug"] += kw_ug.get(n, 0.0)
        return out

    def lista(grupos, nomes):
        return [{**dict(zip(nomes, k)), "usinas": x["usinas"], "mw_outorgado": _r(_mw(x["kw_o"])),
                 "mw_ugs_em_implantacao": _r(_mw(x["kw_ug"]))}
                for k, x in sorted(grupos.items(), key=lambda kv: -kv[1]["kw_o"])]

    com_leilao = {n for (n, cod) in (k.split(":", 1) for k in ralie_leilao) if cod != "Nenhum"}
    kw_lei = sum(ralie_us[n].get("kw_outorgado") or 0 for n in com_leilao if n in ralie_us)
    fase_siga = defaultdict(int)
    for n in ralie_us:
        fase_siga[(siga.get(n) or {}).get("fase") or "ausente do SIGA"] += 1
    ralie = {
        "data_ralie": data_ralie, "usinas": len(ralie_us), "ugs": len(ralie_ug),
        "mw_outorgado": _r(_mw(sum(u.get("kw_outorgado") or 0 for u in ralie_us.values()))),
        "mw_ugs_em_implantacao": _r(_mw(sum(kw_ug.values()))),
        "por_obra": lista(agrupa_ralie("situacao_obra"), ["situacao_obra"]),
        "por_viabilidade": lista(agrupa_ralie("viabilidade"), ["viabilidade"]),
        "por_cronograma": lista(agrupa_ralie("situacao_cronograma"), ["situacao_cronograma"]),
        "por_justificativa": lista(agrupa_ralie("justificativa_previsao"), ["justificativa"]),
        "obra_x_viabilidade": lista(agrupa_ralie("situacao_obra", "viabilidade"), ["situacao_obra", "viabilidade"]),
        "por_tipo": lista(agrupa_ralie("tipo"), ["tipo"]),
        "por_uf": lista(agrupa_ralie("uf"), ["uf"]),
        "leilao": {"usinas_com_compromisso": len(com_leilao & set(ralie_us)), "mw_outorgado_com_compromisso": _r(_mw(kw_lei)),
                   "usinas_sem_compromisso": len(set(ralie_us) - com_leilao)},
        "fase_no_siga": [{"fase": f, "usinas": n} for f, n in sorted(fase_siga.items(), key=lambda kv: -kv[1])],
    }
    return {
        "data_referencia": data_siga, "resumo": resumo, "por_tipo": por_tipo, "por_uf": por_uf,
        "encerramentos": _bloco_encerramentos(encerramentos, siga, ralie_kw_hist, data_siga),
        "ralie": ralie,
    }


REGRA_ENCERRAMENTOS = (
    "Atos com objeto 'Autorização - Revogação' ou 'Concessão - Extinção'. A potência conta uma vez por usina (núcleo do "
    "CEG) em cada ano e uma vez por usina no total, pelo maior valor conferido entre os atos da usina; a contagem de atos "
    "fica à parte. A potência de cada ato é conferida contra o cadastro da mesma usina (SIGA e RALIE histórico) e o "
    "limite legal do tipo (CGH até 5 MW): valor em kW no campo de MW é corrigido pelo cadastro quando há confirmação "
    "independente, e sai da soma quando não há. Ato sem núcleo do CEG na fonte não pode ser ligado a nenhuma usina: "
    "cada um conta como uma unidade, sem deduplicação. Outorga encerrada não significa usina retirada: parte das "
    "usinas segue em operação no SIGA (conversão de regime, por exemplo de concessão para registro, ou nova outorga).")


def _maxn(a, b):
    """Maior de dois valores ignorando ausência (None só se os dois forem None)."""
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


def _confere_atos(encerramentos, siga, ralie_kw_hist):
    """Conferência de unidade da potência de cada ato de encerramento (ax.confere_potencia_ato)."""
    out = {}
    for k, x in encerramentos.items():
        n = x.get("nucleo")
        s_ = siga.get(str(n)) if n is not None else None
        refs = []
        if s_ and s_.get("kw_outorgado"):
            refs.append(("SIGA, potência outorgada", s_["kw_outorgado"]))
        if n is not None:
            refs += [("RALIE histórico, potência outorgada", kw) for kw in (ralie_kw_hist or {}).get(int(n), ())]
        tipo = (s_ or {}).get("tipo") or x.get("tipo_geracao")
        outros = [z[2] for z in (x.get("outros_atos") or []) if len(z) > 2]
        r = ax.confere_potencia_ato(x.get("mw"), tipo, refs, outros)
        r["com_cadastro"] = bool(refs)
        out[k] = r
    return out


def _bloco_encerramentos(encerramentos, siga, ralie_kw_hist, data_siga):
    """P040: encerramentos de outorga (atos da ANEEL), uma vez por usina, com a potência
    conferida e a situação da usina no SIGA. Escreve o CSV por ato."""
    conf = _confere_atos(encerramentos, siga, ralie_kw_hist)

    def usina(k, x):
        return f"n:{int(x['nucleo'])}" if x.get("nucleo") is not None else f"ato:{k}"

    atos = sorted(encerramentos.items(), key=lambda kv: (kv[1].get("publicacao") or "9999", kv[0]))
    primeiro_ano = {}
    for k, x in atos:
        a = (x.get("publicacao") or "")[:4]
        if a:
            primeiro_ano.setdefault(usina(k, x), a)
    por_ano = defaultdict(lambda: {"atos": 0, "revogacao": 0, "extincao": 0, "usinas": {}, "atos_sem_chave": 0,
                                   "mw_sem_chave": 0.0, "atos_sem_potencia": 0, "corrigidas": 0, "fora_da_soma": 0})
    por_usina = {}
    sem_data = {"atos": 0, "usinas": {}}
    repetido = {}
    vistos = set()
    for k, x in atos:
        u = usina(k, x)
        c_ = conf[k]
        repetido[k] = u in vistos
        vistos.add(u)
        mw = c_["mw_usado"]
        por_usina[u] = _maxn(por_usina.get(u), mw)
        ano = (x.get("publicacao") or "")[:4]
        if not ano:
            sem_data["atos"] += 1
            sem_data["usinas"][u] = _maxn(sem_data["usinas"].get(u), mw)
            continue
        a = por_ano[ano]
        a["atos"] += 1
        a[x.get("encerramento")] += 1
        a["usinas"][u] = _maxn(a["usinas"].get(u), mw)
        if x.get("nucleo") is None:
            a["atos_sem_chave"] += 1
            a["mw_sem_chave"] += mw or 0
        if x.get("mw") is None:
            a["atos_sem_potencia"] += 1
        a["corrigidas"] += c_["situacao"] == "corrigida_kw"
        a["fora_da_soma"] += c_["situacao"] == "fora_da_soma"

    def fase_de(u):
        return (siga.get(u[2:]) or {}).get("fase") if u.startswith("n:") else None

    enc_ano = []
    for a, x in sorted(por_ano.items()):
        us = x["usinas"]
        rep_ = {u: m for u, m in us.items() if primeiro_ano.get(u, a) < a}
        op = {u: m for u, m in us.items() if fase_de(u) == "Operação"}
        enc_ano.append({
            "ano": a, "atos": x["atos"], "revogacoes": x["revogacao"], "extincoes": x["extincao"],
            "usinas": len(us), "mw_usinas": _r(sum(m or 0 for m in us.values())),
            "usinas_sem_potencia": sum(1 for m in us.values() if m is None),
            "usinas_com_ato_em_ano_anterior": len(rep_), "mw_usinas_com_ato_em_ano_anterior": _r(sum(m or 0 for m in rep_.values())),
            "usinas_em_operacao_no_siga": len(op), "mw_usinas_em_operacao_no_siga": _r(sum(m or 0 for m in op.values())),
            "atos_sem_chave_de_usina": x["atos_sem_chave"], "mw_atos_sem_chave_de_usina": _r(x["mw_sem_chave"]),
            "atos_sem_potencia": x["atos_sem_potencia"], "atos_potencia_corrigida": x["corrigidas"],
            "atos_potencia_fora_da_soma": x["fora_da_soma"], "ano_parcial": a == (data_siga or "")[:4]})

    # repetição: soma por ato contra soma por usina (o que a regra antiga publicava a mais)
    mw_por_ato = sum((conf[k]["mw_usado"] or 0) for k, _ in atos)
    n_atos_usina = defaultdict(int)
    for k, x in atos:
        n_atos_usina[usina(k, x)] += 1
    # tipo: o do ato (rótulo da fonte), uma vez por usina
    por_tipo = defaultdict(dict)
    for k, x in atos:
        u = usina(k, x)
        t = x.get("tipo_geracao")
        por_tipo[t][u] = _maxn(por_tipo[t].get(u), conf[k]["mw_usado"])
    # usinas com outorga encerrada que seguem em operação no SIGA
    op_us = {u for u in por_usina if fase_de(u) == "Operação"}
    por_outorga = defaultdict(lambda: {"usinas": 0, "mw_fiscalizado": 0.0})
    for u in op_us:
        s_ = siga.get(u[2:]) or {}
        g = por_outorga[s_.get("outorga") or "(vazio)"]
        g["usinas"] += 1
        g["mw_fiscalizado"] += (s_.get("kw_fiscalizado") or 0) / 1000
    sem_chave = [(k, x) for k, x in atos if x.get("nucleo") is None]
    sc_ano = defaultdict(lambda: {"atos": 0, "mw": 0.0})
    for k, x in sem_chave:
        sc_ano[(x.get("publicacao") or "")[:4] or None]["atos"] += 1
        sc_ano[(x.get("publicacao") or "")[:4] or None]["mw"] += conf[k]["mw_usado"] or 0
    lista_conf = [{"chave": k, "publicacao": x.get("publicacao"), "nome": x.get("nome"), "nucleo": x.get("nucleo"),
                   "tipo": x.get("tipo_geracao"), "mw_no_ato": x.get("mw"), "mw_usado": _r(conf[k]["mw_usado"], 6),
                   "kw_cadastro": conf[k]["ref_kw"], "cadastro": conf[k]["ref_origem"], "motivo": conf[k]["motivo"]}
                  for k, x in atos if conf[k]["situacao"] in ("corrigida_kw", "fora_da_soma")]

    # CSV por ato
    linhas = []
    for k, x in atos:
        s_ = siga.get(str(x["nucleo"])) if x.get("nucleo") is not None else None
        linhas.append([x.get("publicacao"), x.get("encerramento"), x.get("nucleo"), x.get("ceg"), x.get("nome"),
                       x.get("tipo_geracao"), x.get("uf"), x.get("mw"), conf[k]["mw_usado"], conf[k]["situacao"],
                       conf[k]["motivo"], "sim" if repetido[k] else "não", (s_ or {}).get("fase"), (s_ or {}).get("outorga"),
                       x.get("assunto"), x.get("ato"), x.get("numero"), x.get("agente")])
    _csv(os.path.basename(DOWNLOADS["encerramentos"]), _cabecalho("encerramentos"), linhas)

    total_usinas = len(por_usina)
    return {
        "regra": REGRA_ENCERRAMENTOS,
        "desde": min((x["ano"] for x in enc_ano), default=None),
        "por_ano": enc_ano,
        "por_tipo": [{"tipo": t, "usinas": len(us), "mw_usinas": _r(sum(m or 0 for m in us.values()))}
                     for t, us in sorted(por_tipo.items(), key=lambda kv: -sum(m or 0 for m in kv[1].values()))],
        "sem_data_publicacao": {"atos": sem_data["atos"], "usinas": len(sem_data["usinas"]),
                                "mw_usinas": _r(sum(m or 0 for m in sem_data["usinas"].values()))},
        "total": {"atos": len(atos), "usinas": total_usinas, "mw_usinas": _r(sum(m or 0 for m in por_usina.values())),
                  "usinas_sem_potencia": sum(1 for m in por_usina.values() if m is None)},
        "repeticoes": {"usinas_com_mais_de_um_ato": sum(1 for n in n_atos_usina.values() if n > 1),
                       "atos_alem_do_primeiro": sum(n - 1 for n in n_atos_usina.values() if n > 1),
                       "mw_que_a_soma_por_ato_repetiria": _r(mw_por_ato - sum(m or 0 for m in por_usina.values()))},
        "potencia_conferida": {
            "regra": "valor do ato conferido contra a potência outorgada da mesma usina no SIGA e no RALIE histórico (fator 1.000) e contra o limite legal de 5 MW da CGH",
            "atos_com_cadastro": sum(1 for c_ in conf.values() if c_["com_cadastro"]),
            "atos_sem_cadastro": sum(1 for c_ in conf.values() if not c_["com_cadastro"] and c_["situacao"] != "sem_potencia"),
            "atos_sem_potencia": sum(1 for c_ in conf.values() if c_["situacao"] == "sem_potencia"),
            "corrigidas_kw": [z for z in lista_conf if conf[z["chave"]]["situacao"] == "corrigida_kw"],
            "fora_da_soma": [z for z in lista_conf if conf[z["chave"]]["situacao"] == "fora_da_soma"],
            "mw_no_ato_dos_atos_corrigidos_ou_fora": _r(sum(z["mw_no_ato"] or 0 for z in lista_conf)),
        },
        "usinas_em_operacao_no_siga": {
            "nota": "Usinas com ato de encerramento cujo núcleo do CEG segue na fase Operação do SIGA na data do arquivo: a outorga encerrada não retirou a usina (conversão de regime, como concessão extinta e registro em operação, ou nova outorga). Não são usinas desativadas.",
            "atos": sum(1 for k, x in atos if fase_de(usina(k, x)) == "Operação"),
            "usinas": len(op_us), "mw_usinas_nos_atos": _r(sum(por_usina[u] or 0 for u in op_us)),
            "por_outorga_no_siga": [{"outorga": o, "usinas": g["usinas"], "mw_fiscalizado_siga": _r(g["mw_fiscalizado"])}
                                    for o, g in sorted(por_outorga.items(), key=lambda kv: -kv[1]["usinas"])]},
        "sem_chave_de_usina": {
            "nota": "Atos sem núcleo nem código do CEG na fonte: não se ligam a nenhuma usina do SIGA ou do RALIE e cada um conta como uma unidade (sem deduplicação).",
            "atos": len(sem_chave), "mw_usado": _r(sum(conf[k]["mw_usado"] or 0 for k, _ in sem_chave)),
            "por_ano": [{"ano": a, "atos": v["atos"], "mw_usado": _r(v["mw"])}
                        for a, v in sorted(sc_ano.items(), key=lambda kv: kv[0] or "")]},
    }


def _liberacoes(lib_estado):
    """Estado do silver de liberações → (linhas planas, índice {(núcleo, ug): data})."""
    linhas, indice = [], {}
    for n, u in lib_estado.items():
        nuc = int(n)
        for ug_bruto, kw, outorgado, realizado in u.get("ugs", []):
            linhas.append({"nucleo": nuc, "ug": ug_bruto, "kw": kw, "outorgado": outorgado, "realizado": realizado,
                           "tipo": u.get("tipo"), "uf": u.get("uf")})
            ugs = ax.ugs_de(ug_bruto)
            if not ugs or not realizado:
                continue
            for x in ugs:
                if (nuc, x) not in indice or realizado < indice[(nuc, x)]:
                    indice[(nuc, x)] = realizado
    return linhas, indice


def _atraso_realizado(lib_linhas, desde="2014"):
    """Por ano da liberação comercial: potência liberada e atraso em relação à data
    outorgada da unidade (realizado − outorgado), ponderado por kW."""
    por = defaultdict(list)
    for x in lib_linhas:
        if not x["realizado"] or x["realizado"][:4] < desde:
            continue
        atraso = None
        if x["outorgado"]:
            atraso = (date.fromisoformat(x["realizado"]) - date.fromisoformat(x["outorgado"])).days
        por[(x["realizado"][:4], "TOTAL")].append((atraso, x["kw"] or 0.0))
        por[(x["realizado"][:4], x["tipo"] or "?")].append((atraso, x["kw"] or 0.0))
    out = []
    for (ano, tipo), pares in sorted(por.items()):
        com = [(a, k) for a, k in pares if a is not None]
        kw = sum(k for _, k in pares)
        out.append({"ano": ano, "tipo": tipo, "linhas": len(pares), "kw": kw,
                    "kw_com_data_outorgada": sum(k for _, k in com),
                    "kw_com_atraso": sum(k for a, k in com if a > 0),
                    "kw_antecipado": sum(k for a, k in com if a < 0),
                    "mediana_dias": ax.mediana_ponderada(com)})
    return out


REGRA_DATA_EM_BLOCO = (f"Data em bloco: previsão atribuída a pelo menos {ax.MINIMO_USINAS_DATA_EM_BLOCO} usinas distintas na "
                       "mesma fotografia (o maior complexo do RALIE tem 41 usinas). É a data convencional que a fiscalização "
                       "atribui em lote e que anda com a fotografia, cerca de 5 anos depois dela; não é cronograma de obra.")


def datas_em_bloco_atual(ralie_ug, minimo=None):
    """Datas em bloco da fotografia atual (CSV do RALIE), pela mesma regra do histórico."""
    minimo = minimo or ax.MINIMO_USINAS_DATA_EM_BLOCO
    usinas = defaultdict(set)
    for k, x in ralie_ug.items():
        if x.get("previsao_sfg"):
            usinas[x["previsao_sfg"]].add(k.split(":")[0])
    return {d for d, ns in usinas.items() if len(ns) >= minimo}


def _bloco_cronograma(con, ralie_us, ralie_ug, lib_linhas, lib_idx, data_ralie, data_lib, pf_ug, mensais):
    """P041: previsões atuais (com data-base = fotografia do RALIE), confiabilidade das
    previsões passadas, revisões entre fotografias e atraso realizado."""
    base_d = date.fromisoformat(data_ralie)
    bloco_atual = datas_em_bloco_atual(ralie_ug)
    # ---- previsões atuais por ano e viabilidade
    por_ano = defaultdict(lambda: defaultdict(float))
    n_ano = defaultdict(int)
    sem_prev = defaultdict(lambda: {"ugs": 0, "kw": 0.0})
    datas = defaultdict(lambda: {"ugs": 0, "usinas": set(), "kw": 0.0})
    prox = defaultdict(lambda: defaultdict(float))
    atraso_prev, atraso_livre = [], []
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        u = ralie_us.get(n, {})
        viab = u.get("viabilidade") or "(vazio)"
        kw = x.get("kw") or 0.0
        p = x.get("previsao_sfg")
        if not p:
            j = u.get("justificativa_previsao") or "(vazio)"
            sem_prev[j]["ugs"] += 1
            sem_prev[j]["kw"] += kw
            continue
        por_ano[p[:4]][viab] += kw
        n_ano[p[:4]] += 1
        datas[p]["ugs"] += 1
        datas[p]["usinas"].add(n)
        datas[p]["kw"] += kw
        if p <= (base_d + timedelta(days=730)).isoformat():
            prox[p[:7]][viab] += kw
        if x.get("comercial_outorgado"):
            par = ((date.fromisoformat(p) - date.fromisoformat(x["comercial_outorgado"])).days, kw)
            atraso_prev.append(par)
            if p not in bloco_atual:
                atraso_livre.append(par)
    viabs = ("Alta", "Média", "Baixa")
    previsoes_ano = [{"ano": a, "ugs": n_ano[a], "mw": _r(_mw(sum(v.values()))),
                      "por_viabilidade": {vb: _r(_mw(v.get(vb, 0.0))) for vb in viabs}}
                     for a, v in sorted(por_ano.items())]
    blocos = sorted(datas.items(), key=lambda kv: -kv[1]["ugs"])[:6]
    kw_prev_total = sum(k for _, k in atraso_prev)
    atual = {
        "data_ralie": data_ralie,
        "por_ano": previsoes_ano,
        "sem_previsao": [{"justificativa": j, "ugs": x["ugs"], "mw": _r(_mw(x["kw"]))}
                         for j, x in sorted(sem_prev.items(), key=lambda kv: -kv[1]["kw"])],
        "datas_mais_frequentes": [{"data": d, "ugs": x["ugs"], "usinas": len(x["usinas"]), "mw": _r(_mw(x["kw"])),
                                   "em_bloco": d in bloco_atual}
                                  for d, x in blocos],
        "datas_em_bloco": {"regra": REGRA_DATA_EM_BLOCO, "datas": sorted(bloco_atual),
                           "ugs": sum(datas[d]["ugs"] for d in bloco_atual),
                           "mw": _r(_mw(sum(datas[d]["kw"] for d in bloco_atual)))},
        "proximos_24_meses": [{"mes": m, "mw": _r(_mw(sum(v.values())), 2),
                               "por_viabilidade": {vb: _r(_mw(v.get(vb, 0.0)), 2) for vb in viabs}}
                              for m, v in sorted(prox.items())],
        "atraso_previsto": {
            "mw_com_previsao": _r(_mw(kw_prev_total)),
            "mw_previsao_apos_outorgado": _r(_mw(sum(k for d, k in atraso_prev if d > 0))),
            "mw_previsao_ate_outorgado": _r(_mw(sum(k for d, k in atraso_prev if d <= 0))),
            "pct_mw_apos_outorgado": _pct(sum(k for d, k in atraso_prev if d > 0), kw_prev_total),
            "mediana_dias_ponderada": ax.mediana_ponderada(atraso_prev),
            # o mesmo cálculo sem as unidades em data em bloco (previsão convencional):
            # a parcela depois da data outorgada continua alta sem elas, então ela não se
            # explica só pela convenção
            "sem_datas_em_bloco": {
                "mw_com_previsao": _r(_mw(sum(k for _, k in atraso_livre))),
                "mw_previsao_apos_outorgado": _r(_mw(sum(k for d, k in atraso_livre if d > 0))),
                "pct_mw_apos_outorgado": _pct(sum(k for d, k in atraso_livre if d > 0), sum(k for _, k in atraso_livre)),
                "mediana_dias_ponderada": ax.mediana_ponderada(atraso_livre)},
        },
    }
    # ---- maiores usinas classificadas como atrasadas pela fiscalização
    kw_ug, prev_max, outg_max = defaultdict(float), {}, {}
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        if x.get("previsao_sfg"):
            prev_max[n] = max(prev_max.get(n, ""), x["previsao_sfg"])
        if x.get("comercial_outorgado"):
            outg_max[n] = max(outg_max.get(n, ""), x["comercial_outorgado"])
    atrasadas = [(n, u) for n, u in ralie_us.items() if u.get("situacao_cronograma") == "Atrasado"]
    atrasadas.sort(key=lambda nu: -(nu[1].get("kw_outorgado") or 0))
    maiores = []
    for n, u in atrasadas[:30]:
        pm, om = prev_max.get(n), outg_max.get(n)
        maiores.append({"nucleo": int(n), "ceg": u.get("ceg"), "nome": u.get("nome"), "tipo": u.get("tipo"),
                        "uf": u.get("uf"), "mw_outorgado": _r(_mw(u.get("kw_outorgado")), 2),
                        "mw_em_implantacao": _r(_mw(kw_ug.get(n)), 2), "situacao_obra": u.get("situacao_obra"),
                        "viabilidade": u.get("viabilidade"), "justificativa": u.get("justificativa_previsao"),
                        "outorgado_max": om, "previsao_max": pm,
                        "atraso_previsto_dias": (date.fromisoformat(pm) - date.fromisoformat(om)).days if pm and om else None})
    por_cron = defaultdict(lambda: {"usinas": 0, "kw": 0.0})
    for u in ralie_us.values():
        por_cron[u.get("situacao_cronograma") or "(vazio)"]["usinas"] += 1
        por_cron[u.get("situacao_cronograma") or "(vazio)"]["kw"] += u.get("kw_outorgado") or 0
    # ---- histórico da fonte (Parquet): confiabilidade e revisões
    lib_tab = ax.tabela_liberacoes(lib_idx)
    ugm = ax.ug_mensal(pf_ug, mensais)
    conf = ax.confiabilidade_previsoes(ugm, lib_tab, mensais, data_lib, horizonte_dias=365, folga_dias=15)
    blocos_hist = ax.datas_em_bloco(ugm, mensais)
    desl = ax.deslizamento_previsoes(ugm, mensais, meses=MESES_JANELA,
                                     blocos={d: set(v) for d, v in blocos_hist.items()})
    del ugm
    confiab = [{"ralie": x["ralie"], "fim_janela": x["fim_janela"], "ugs": x["ugs"],
                "mw_prometido": _r(_mw(x["kw_prometido"])), "mw_no_prazo": _r(_mw(x["kw_no_prazo"])),
                "mw_depois": _r(_mw(x["kw_depois"])), "mw_nao_liberado": _r(_mw(x["kw_nao_liberado"])),
                "pct_no_prazo": _pct(x["kw_no_prazo"], x["kw_prometido"]),
                "pct_depois": _pct(x["kw_depois"], x["kw_prometido"]),
                "pct_nao_liberado": _pct(x["kw_nao_liberado"], x["kw_prometido"]),
                "ugs_excluidas_ja_liberadas": x["ugs_excluidas_ja_liberadas"]} for x in conf]
    desliz = []
    for x in desl:
        sb = x["sem_bloco"]
        desliz.append({"ralie": x["ralie"], "ralie_seguinte": x["ralie_seguinte"], "ugs": x["ugs"], "mw": _r(_mw(x["kw"])),
                       "pct_adiada": _pct(x["kw_adiada"], x["kw"]), "pct_mantida": _pct(x["kw_mantida"], x["kw"]),
                       "pct_antecipada": _pct(x["kw_antecipada"], x["kw"]),
                       "mediana_dias_ponderada": x["mediana_dias_ponderada"],
                       "pct_mw_em_data_em_bloco": _pct(x["kw_data_em_bloco"], x["kw"]),
                       "pct_mw_bloco_nas_duas": _pct(x["kw_bloco_nas_duas"], x["kw"]),
                       "sem_datas_em_bloco": {"ugs": sb["ugs"], "mw": _r(_mw(sb["kw"])),
                                              "pct_adiada": _pct(sb["kw_adiada"], sb["kw"]),
                                              "pct_mantida": _pct(sb["kw_mantida"], sb["kw"]),
                                              "pct_antecipada": _pct(sb["kw_antecipada"], sb["kw"]),
                                              "mediana_dias_ponderada": sb["mediana_dias_ponderada"]}})
    blocos_serie = []
    for d in mensais:
        b = blocos_hist.get(d) or {}
        maior = max(b.items(), key=lambda kv: kv[1]["usinas"], default=None)
        blocos_serie.append({"ralie": d, "datas": len(b), "ugs": sum(v["ugs"] for v in b.values()),
                             "mw": _r(_mw(sum(v["kw"] for v in b.values()))),
                             "maior": {"data": maior[0], "usinas": maior[1]["usinas"],
                                       "dias_depois_da_fotografia": (date.fromisoformat(maior[0]) - date.fromisoformat(d)).days}
                             if maior else None})
    csv_conf = []
    for x in conf:
        csv_conf.append([x["ralie"], x["fim_janela"], "TOTAL", x["ugs"], x["kw_prometido"], x["kw_no_prazo"],
                         x["kw_depois"], x["kw_nao_liberado"], x["ugs_excluidas_ja_liberadas"]])
        for t, y in sorted(x["por_tipo"].items()):
            csv_conf.append([x["ralie"], x["fim_janela"], t, y["ugs"], y["kw_prometido"], y["kw_no_prazo"], y["kw_depois"],
                             y["kw_nao_liberado"], y["ugs_excluidas_ja_liberadas"]])
    _csv(os.path.basename(DOWNLOADS["confiabilidade"]), _cabecalho("confiabilidade"), csv_conf)
    ultima_conf = conf[-1] if conf else None
    por_tipo_ult = []
    if ultima_conf:
        for t, y in sorted(ultima_conf["por_tipo"].items(), key=lambda kv: -kv[1]["kw_prometido"]):
            por_tipo_ult.append({"tipo": t, "mw_prometido": _r(_mw(y["kw_prometido"])), "mw_no_prazo": _r(_mw(y["kw_no_prazo"])),
                                 "pct_no_prazo": _pct(y["kw_no_prazo"], y["kw_prometido"])})
    # ---- desvio da liberação comercial em relação ao prazo outorgado vigente
    atr = _atraso_realizado(lib_linhas)
    _csv(os.path.basename(DOWNLOADS["liberacoes"]), _cabecalho("liberacoes"),
         [[x["ano"], x["tipo"], x["linhas"], x["kw"], x["kw_com_data_outorgada"], x["kw_com_atraso"],
           x["kw_antecipado"], x["mediana_dias"]] for x in atr])
    desvio_ano = [{"ano": x["ano"], "unidades_ou_grupos": x["linhas"], "mw_liberado": _r(_mw(x["kw"])),
                   "pct_mw_depois_do_prazo": _pct(x["kw_com_atraso"], x["kw_com_data_outorgada"]),
                   "pct_mw_antes_do_prazo": _pct(x["kw_antecipado"], x["kw_com_data_outorgada"]),
                   "mediana_desvio_dias_ponderada": x["mediana_dias"], "ano_parcial": x["ano"] == data_lib[:4]}
                  for x in atr if x["tipo"] == "TOTAL"]
    # ---- histórico próprio (capturas do RALIE atual pelo observatório)
    caps = con.execute("SELECT capturado_em FROM vintages WHERE dataset=? AND recurso=? ORDER BY capturado_em",
                       (DS_RALIE, "ralie-unidade-geradora-atual.csv")).fetchall()
    revisadas = con.execute(
        """SELECT COUNT(*) FROM (SELECT chave FROM registros WHERE dataset=? AND campo='previsao_sfg' AND valor<>''
           GROUP BY chave HAVING COUNT(DISTINCT valor) > 1)""", (DS_RALIE,)).fetchone()[0]
    return {
        "data_ralie": data_ralie,
        "historico_fonte": {"primeira_fotografia": None, "fotografias": None, "fotografias_mensais": len(mensais)},
        "historico_proprio": {"primeira_captura": caps[0][0] if caps else None, "capturas": len(caps),
                              "ugs_com_previsao_revisada": revisadas},
        "previsoes_atuais": atual,
        "por_situacao_cronograma": [{"situacao": k, "usinas": x["usinas"], "mw_outorgado": _r(_mw(x["kw"]))}
                                    for k, x in sorted(por_cron.items(), key=lambda kv: -kv[1]["kw"])],
        "maiores_atrasadas": maiores,
        "confiabilidade": confiab,
        "confiabilidade_ultima_por_tipo": por_tipo_ult,
        "deslizamento": desliz,
        "datas_em_bloco_por_fotografia": blocos_serie,
        "desvio_prazo_vigente": {
            "definicao": ("Data de liberação comercial menos a data outorgada da unidade no arquivo de liberações, que é o prazo "
                          "vigente na publicação do arquivo, sem data-base. Mede a distância a um prazo (em autorizações recentes, "
                          "um prazo limite anos à frente), não atraso em relação a uma promessa datada; o que atrasou em relação "
                          "à previsão com data-base está em 'confiabilidade'."),
            "por_ano": desvio_ano},
        "data_liberacoes": data_lib,
        "_conf": conf,
        "_bloco_atual": bloco_atual,
    }


DESFECHOS = {
    "em_implantacao": "Segue em implantação (consta na fotografia mais recente do RALIE)",
    "operacao": "Entrou em operação (fase Operação no SIGA ou todas as unidades da primeira fotografia liberadas)",
    "outorga_encerrada": "Outorga revogada ou extinta (ato da ANEEL publicado após a primeira aparição, ou ato de encerramento sem data de publicação na fonte)",
    "sem_desfecho": "Saiu do acompanhamento sem operação nem ato de encerramento identificados",
}


def _desfechos(trajs, prim_ugs, lib_idx, siga, encerramentos, ultima_ralie):
    """Classifica cada usina que já passou pelo RALIE (regra em DESFECHOS, nesta ordem)."""
    enc_por = defaultdict(list)
    # ato de encerramento sem data de publicação na fonte (3 em 30/09/2026): a outorga foi
    # encerrada, só não se sabe quando; conta como encerramento com data desconhecida, e
    # nunca como encerramento anterior à primeira aparição
    enc_sem_data = set()
    for x in encerramentos.values():
        if x.get("nucleo") is None:
            continue
        if x.get("publicacao"):
            enc_por[int(x["nucleo"])].append(x["publicacao"])
        else:
            enc_sem_data.add(int(x["nucleo"]))
    out = {}
    for n, t in trajs.items():
        ugs = prim_ugs.get(n, [])
        lib = [lib_idx.get((n, u)) for u, _ in ugs]
        liberadas = [d for d in lib if d]
        kw_lib = sum((k or 0) for (u, k), d in zip(ugs, lib) if d)
        fase = (siga.get(str(n)) or {}).get("fase")
        enc = sorted(d for d in enc_por.get(n, []) if d >= t["primeira"])
        if t["ultima"] == ultima_ralie:
            desf = "em_implantacao"
        elif fase == "Operação" or (ugs and len(liberadas) == len(ugs)):
            desf = "operacao"
        elif enc or n in enc_sem_data:
            desf = "outorga_encerrada"
        else:
            desf = "sem_desfecho"
        out[n] = {**t, "ugs_primeira": len(ugs), "ugs_primeira_liberadas": len(liberadas), "kw_primeira_liberado": kw_lib,
                  "ultima_liberacao": max(liberadas) if liberadas else None, "desfecho": desf,
                  "data_encerramento": enc[0] if enc else None,
                  "encerramento_sem_data": desf == "outorga_encerrada" and not enc, "fase_siga": fase}
    return out


def _bloco_coortes(desf, primeira_global):
    """Desfecho por coorte: estoque da primeira fotografia e entradas por ano."""
    g = defaultdict(lambda: defaultdict(lambda: {"usinas": 0, "kw": 0.0}))
    for x in desf.values():
        coorte = "estoque_inicial" if x["primeira"] == primeira_global else x["primeira"][:4]
        g[coorte][x["desfecho"]]["usinas"] += 1
        g[coorte][x["desfecho"]]["kw"] += x.get("kw_primeira") or 0
        g[coorte]["_total"]["usinas"] += 1
        g[coorte]["_total"]["kw"] += x.get("kw_primeira") or 0
    out = []
    for coorte in sorted(g, key=lambda k: "0" if k == "estoque_inicial" else k):
        tot = g[coorte]["_total"]
        out.append({
            "coorte": coorte,
            "rotulo": f"Estoque na primeira fotografia ({c.data_br(primeira_global)})" if coorte == "estoque_inicial"
            else f"Entraram no RALIE em {coorte}",
            "usinas": tot["usinas"], "mw_outorgado": _r(_mw(tot["kw"])),
            "desfechos": {d: {"usinas": g[coorte][d]["usinas"], "mw_outorgado": _r(_mw(g[coorte][d]["kw"])),
                              "pct_mw": _pct(g[coorte][d]["kw"], tot["kw"])} for d in DESFECHOS},
        })
    return out


def _bloco_leiloes(lotes, publicado_em):
    """Leilões de transmissão por ano: km, MVA, investimento e RAP em campos separados,
    só dos lotes contratados; lotes sem vencedor ('SEM LANCE', 'SEM INSCRITO APTO', 'NÃO
    LEILOADO') são contados à parte, com o investimento e a RAP do edital como valores
    ofertados e não contratados. Deságio agregado do ano = 1 − Σ RAP vencedora / Σ RAP
    do edital (lotes contratados com as duas)."""
    por = defaultdict(lambda: {"lotes": 0, "contratados": 0, "sem_vencedor": 0, "km": 0.0, "mva": 0.0, "inv": 0.0,
                               "edital": 0.0, "venc": 0.0, "edital_par": 0.0, "venc_par": 0.0, "sem_inv": 0,
                               "inv_sem": 0.0, "edital_sem": 0.0, "km_ausente": 0, "mva_ausente": 0})
    inconsist = []
    rotulos_sem = defaultdict(int)
    for k, x in lotes.items():
        ano = x.get("ano") or (x.get("data") or "")[:4]
        if not ano:
            continue
        a = por[ano]
        a["lotes"] += 1
        sem = bool(x.get("sem_vencedor")) if "sem_vencedor" in x else ax.lote_sem_vencedor(x.get("vencedor"))
        if sem:
            a["sem_vencedor"] += 1
            rotulos_sem[(x.get("vencedor") or "").upper()] += 1
            a["inv_sem"] += x.get("investimento_rs") or 0
            a["edital_sem"] += x.get("rap_edital_rs") or 0
            continue
        a["contratados"] += 1
        a["km"] += x.get("km") or 0
        a["mva"] += x.get("mva") or 0
        a["km_ausente"] += x.get("km") is None
        a["mva_ausente"] += x.get("mva") is None
        if x.get("investimento_rs") is None:
            a["sem_inv"] += 1
        a["inv"] += x.get("investimento_rs") or 0
        a["edital"] += x.get("rap_edital_rs") or 0
        a["venc"] += x.get("rap_vencedor_rs") or 0
        if x.get("rap_edital_rs") and x.get("rap_vencedor_rs"):
            a["edital_par"] += x["rap_edital_rs"]
            a["venc_par"] += x["rap_vencedor_rs"]
            calc = 1 - x["rap_vencedor_rs"] / x["rap_edital_rs"]
            if x.get("desagio_fracao") is not None and abs(calc - x["desagio_fracao"]) > 0.006:
                inconsist.append({"lote": k, "desagio_fonte_pct": _r(100 * x["desagio_fracao"], 2),
                                  "desagio_calculado_pct": _r(100 * calc, 2)})
    anos = [{"ano": a, "lotes_ofertados": x["lotes"], "lotes_contratados": x["contratados"],
             "lotes_sem_vencedor": x["sem_vencedor"], "km": _r(x["km"]), "mva": _r(x["mva"]),
             "investimento_previsto_rs_mi": _r(x["inv"] / 1e6), "rap_edital_rs_mi": _r(x["edital"] / 1e6),
             "rap_vencedor_rs_mi": _r(x["venc"] / 1e6),
             "desagio_agregado_pct": _r(100 * (1 - x["venc_par"] / x["edital_par"]), 1) if x["edital_par"] else None,
             "lotes_sem_investimento": x["sem_inv"],
             # lotes contratados com km ou MVA não informados pela fonte (0 com a
             # instalação descrita): a soma do ano não os inclui
             "lotes_km_nao_informado": x["km_ausente"], "lotes_mva_nao_informado": x["mva_ausente"],
             "investimento_ofertado_sem_vencedor_rs_mi": _r(x["inv_sem"] / 1e6),
             "rap_edital_sem_vencedor_rs_mi": _r(x["edital_sem"] / 1e6)} for a, x in sorted(por.items())]
    linhas = []
    for k, x in sorted(lotes.items(), key=lambda kv: (kv[1].get("data") or "", kv[0])):
        sem = bool(x.get("sem_vencedor")) if "sem_vencedor" in x else ax.lote_sem_vencedor(x.get("vencedor"))
        linhas.append([x.get("ano"), x.get("data"), x.get("leilao"), x.get("lote"), x.get("empreendimento"), x.get("uf"),
                       x.get("prazo_meses"), x.get("km"), x.get("mva"), x.get("investimento_rs"), x.get("rap_edital_rs"),
                       x.get("rap_vencedor_rs"), None if x.get("desagio_fracao") is None else 100 * x["desagio_fracao"],
                       x.get("vencedor"), "não" if sem else "sim"])
    _csv(os.path.basename(DOWNLOADS["leiloes"]), _cabecalho("leiloes"), linhas)
    ult = max(lotes.values(), key=lambda x: (x.get("data") or "", x.get("leilao") or ""), default={})
    datas = sorted(x.get("data") for x in lotes.values() if x.get("data"))
    return {"publicado_em": publicado_em,
            "periodo": {"inicio": datas[0] if datas else None, "fim": datas[-1] if datas else None},
            "por_ano": anos, "lotes": len(lotes),
            "lotes_contratados": sum(x["lotes_contratados"] for x in anos),
            "lotes_sem_vencedor": sum(x["lotes_sem_vencedor"] for x in anos),
            "sem_vencedor_por_rotulo": dict(sorted(rotulos_sem.items())),
            "regra_sem_vencedor": "Lote com vencedor 'SEM LANCE', 'SEM INSCRITO APTO' ou 'NÃO LEILOADO' não foi contratado: fica fora de lotes contratados, km, MVA, investimento e RAP, e o 0 que a fonte publica em km, MVA, prazo e RAP vencedora é tratado como ausência.",
            "regra_zero": "Em lote contratado, 0 km só conta como zero quando a descrição do empreendimento não cita linha (LT ou extensão em km), e 0 MVA só quando não cita MVA; nos demais casos o campo não foi preenchido pela fonte e fica fora da soma do ano (lotes_km_nao_informado, lotes_mva_nao_informado).",
            "lotes_km_nao_informado": sum(x["lotes_km_nao_informado"] for x in anos),
            "lotes_mva_nao_informado": sum(x["lotes_mva_nao_informado"] for x in anos),
            "ultimo_leilao": {"leilao": ult.get("leilao"), "data": ult.get("data")},
            "desagio_inconsistente": inconsist[:20], "desagio_inconsistente_total": len(inconsist)}


def _bloco_rede_epe(vig_rede):
    """P042: território da rede pelo WebMap da EPE (linhas existentes e da expansão
    planejada). Comprimento pela geometria (o campo Extensao da camada planejada tem
    valores fora de escala, conferidos feição por feição); km por UF pelo ponto médio de
    cada segmento na malha de UF do IBGE; ano 0 da fonte vira ausência. Escreve o JSON
    do mapa (caminho SVG na grade da malha de UF)."""
    v_ex = (vig_rede or {}).get("linhas-transmissao-existente.geojson")
    v_pl = (vig_rede or {}).get("linhas-transmissao-planejada.geojson")
    if not v_ex or not v_pl:
        return None
    with open(os.path.join(base.RAIZ, "public", "energia", "geo", "uf.json"), encoding="utf-8") as f:
        malha = json.load(f)
    loc = er.LocalizadorUF(malha)
    out = {"fonte": "EPE, WebMap (serviço ArcGIS SMA/WMS_Webmap_EPE)", "servico": er.SERVICO, "webmap": er.URL_WEBMAP,
           "data_do_dado": None,
           "nota_data": "O serviço não informa a data de atualização das camadas; vale a data de captura e o ano mais recente presente.",
           "definicao_km": ("Comprimento da geometria publicada (generalizada pelo servidor a 0,005 grau), por feição. Cada feição "
                            "é em geral um circuito, mas há feições com dois circuitos no mesmo traçado ('C1 e C2'): não é km de "
                            "circuito do SIGET e as duas medidas não se somam nem se subtraem."),
           "generalizacao_grau": er.GENERALIZACAO_GRAU}
    pontos = []
    for camada, v in (("existente", v_ex), ("planejada", v_pl)):
        with base.abre_bronze(v["arquivo"]) as f:
            doc = json.loads(f.read())
        regs = er.normaliza(doc.get("features") or [], camada)
        km_uf = er.km_por_uf(regs, loc)
        por_t, por_a = defaultdict(lambda: [0, 0.0]), defaultdict(lambda: [0, 0.0])
        for r in regs:
            t = r["tensao_kv"] if r["tensao_kv"] else None
            por_t[t][0] += 1
            por_t[t][1] += r["km_geometria"]
            por_a[r["ano"]][0] += 1
            por_a[r["ano"]][1] += r["km_geometria"]
            pontos.append([camada, r["nome"], t, r["ano"], c.r(r["km_geometria"], 1), er.caminho_svg(r["geom"], loc)])
        fora = [r for r in regs if r["extensao_fonte_km"] is not None and not (0 <= r["extensao_fonte_km"] <= er.LIMITE_KM)]
        rel = sorted(abs(r["km_geometria"] - r["extensao_fonte_km"]) / r["extensao_fonte_km"] for r in regs
                     if r["extensao_fonte_km"] and 0 < r["extensao_fonte_km"] <= er.LIMITE_KM and r["km_geometria"] > 1)
        anos = [r["ano"] for r in regs if r["ano"]]
        out[camada] = {
            "camada": doc.get("camada"), "id_camada": doc.get("id_camada"), "capturado_em": v["capturado_em"],
            "sha256": v["sha256"], "linhas": len(regs), "contagem_informada": doc.get("contagem_informada"),
            "km_geometria": _r(sum(r["km_geometria"] for r in regs)),
            "km_campo_fonte_plausivel": _r(sum(r["extensao_fonte_km"] for r in regs if r["extensao_fonte_km"] is not None
                                              and 0 <= r["extensao_fonte_km"] <= er.LIMITE_KM)),
            "campo_extensao_fora_de_escala": {"linhas": len(fora), "exemplos": [
                {"nome": r["nome"], "extensao_fonte": r["extensao_fonte_km"], "km_geometria": _r(r["km_geometria"])}
                for r in sorted(fora, key=lambda z: -z["extensao_fonte_km"])[:5]]},
            "diferenca_relativa_mediana_geometria_x_campo_pct": _r(100 * rel[len(rel) // 2], 2) if rel else None,
            "ano_min": min(anos) if anos else None, "ano_max": max(anos) if anos else None,
            "por_tensao": [{"tensao_kv": t, "linhas": n, "km": _r(k)}
                           for t, (n, k) in sorted(por_t.items(), key=lambda kv: -(kv[0] or 0))],
            "por_ano": [{"ano": a, "linhas": n, "km": _r(k)} for a, (n, k) in sorted(por_a.items(), key=lambda kv: kv[0] or 0)],
            "por_uf": [{"uf": u, "km": _r(k)} for u, k in sorted(km_uf.items(), key=lambda kv: -kv[1]) if u],
            "km_fora_de_uf": _r(km_uf.get(None, 0.0)),
        }
        out[camada]["_km_uf"] = km_uf
    base.escreve_gold(os.path.basename(DOWNLOADS["rede_epe"]), {
        "colunas": ["camada", "nome", "tensao_kv", "ano", "km_geometria", "d"], "linhas": pontos,
        "viewBox": malha.get("viewBox"), "projecao": malha.get("projecao"),
        "fonte": "EPE, WebMap: camadas 21 (Linhas de Transmissão - Base Existente) e 10 (Linhas de Transmissão - Expansão Planejada)",
        "nota": "Caminho SVG na mesma grade da malha de UF (public/energia/geo/uf.json). Ano e tensão vazios = 0 na fonte."},
        destino=base.SERIES)
    return out


def _bloco_obras(epds, lts, eqps, resol, data_siget):
    """Obras de transmissão do SIGET por empreendimento: extensão de linhas novas (km de
    circuito), transformação nova (MVA), prazo do ato legal e data efetiva. Só módulos
    cuja obra é do tipo Instalação somam km e MVA novos; adequação, ampliação,
    recapacitação e reconstrução alteram instalação existente e são contadas à parte,
    sem km novo.

    Cada módulo de linha do SIGET é um circuito (NumCcuLinTms) com a extensão da linha
    (NumEtnLinTms, em km: o bipolo Xingu × Terminal Rio aparece como dois módulos de
    2.539 km). A soma é, portanto, km de circuito: linha de circuito duplo ou bipolo
    conta cada circuito.

    Um mesmo módulo de linha ou de transformação pode aparecer em mais de um
    empreendimento (o módulo 2791, LT 230 kV Cascavel Oeste × Foz do Iguaçu Norte, de
    115 km, está nos empreendimentos 485 e 1203). Cada módulo é contado uma vez, no
    empreendimento cuja obra de Instalação tem a data de operação mais antiga (empate:
    menor número de empreendimento); o outro registra o módulo em
    modulos_em_outro_empreendimento."""
    hoje = data_siget
    dono, usos = _dono_dos_modulos(epds)
    obras_resol = set()
    for x in resol.values():
        obras_resol.update(x.get("obras") or [])
    emp = []
    por_sit = defaultdict(lambda: {"empreendimentos": 0, "obras": 0, "km": 0.0, "mva": 0.0})
    uf_and = defaultdict(lambda: {"km": 0.0, "mva": 0.0, "empreendimentos": set()})
    entrada = defaultdict(lambda: {"km": 0.0, "mva": 0.0, "modulos_lt": 0, "modulos_tr": 0})
    atraso_ano = defaultdict(list)
    for eid, e in epds.items():
        sit = e.get("situacao_empreendimento") or "(vazio)"
        km = mva = 0.0
        ufs = set()
        vistos_lt, vistos_tr = set(), set()
        n_obras, n_resol, outras, em_outro = set(), 0, 0, set()
        for o in e.get("obras", []):
            obra, mdl, sit_obra, tipo_obra, oper_obra, tipo_mdl, nome_mdl = o[:7]
            n_obras.add(obra)
            if obra in obras_resol:
                n_resol += 1
            if tipo_obra != "Instalação":
                outras += 1
                continue
            if tipo_mdl in ("LT", "ME") and dono.get((tipo_mdl, mdl), eid) != eid:
                em_outro.add((tipo_mdl, mdl))
                continue
            if tipo_mdl == "LT" and mdl in lts and mdl not in vistos_lt:
                vistos_lt.add(mdl)
                lt = lts[mdl]
                km += lt.get("km") or 0
                for uf in (lt.get("uf_origem"), lt.get("uf_destino")):
                    if uf:
                        ufs.add(uf)
                if oper_obra and (lt.get("km") or 0) > 0:
                    entrada[oper_obra[:4]]["km"] += lt["km"]
                    entrada[oper_obra[:4]]["modulos_lt"] += 1
            elif tipo_mdl == "ME" and mdl in eqps and eqps[mdl].get("mva") and mdl not in vistos_tr:
                vistos_tr.add(mdl)
                mva += eqps[mdl]["mva"]
                if eqps[mdl].get("uf"):
                    ufs.add(eqps[mdl]["uf"])
                if oper_obra:
                    entrada[oper_obra[:4]]["mva"] += eqps[mdl]["mva"]
                    entrada[oper_obra[:4]]["modulos_tr"] += 1
        legal = e.get("oper_ato_legal")
        efetiva = e.get("oper_efetiva_empreendimento")
        atraso = (date.fromisoformat(efetiva) - date.fromisoformat(legal)).days if legal and efetiva else None
        vencido = sit in ("Em andamento", "Planejado") and legal is not None and legal < hoje
        dias_vencido = (date.fromisoformat(hoje) - date.fromisoformat(legal)).days if vencido else None
        if efetiva and atraso is not None:
            atraso_ano[efetiva[:4]].append(atraso)
        p = por_sit[sit]
        p["empreendimentos"] += 1
        p["obras"] += len(n_obras)
        p["km"] += km
        p["mva"] += mva
        if sit == "Em andamento":
            for uf in ufs:
                uf_and[uf]["km"] += sum((lts[m].get("km") or 0) for m in vistos_lt
                                        if uf in (lts[m].get("uf_origem"), lts[m].get("uf_destino")))
                uf_and[uf]["mva"] += sum(eqps[m]["mva"] for m in vistos_tr if eqps[m].get("uf") == uf)
                uf_and[uf]["empreendimentos"].add(eid)
        emp.append({"id": eid, "ons": e.get("empreendimento_ons"), "contrato": e.get("contrato"),
                    "nome": e.get("nome_empreendimento"), "situacao": sit,
                    "oper_ato_legal": legal, "oper_efetiva": efetiva, "atraso_dias": atraso, "prazo_legal_vencido": vencido,
                    "dias_desde_prazo_legal": dias_vencido, "km_lt": km, "mva_tr": mva, "ufs": sorted(ufs),
                    "obras": len(n_obras), "obras_outras": outras, "obras_resolucao": n_resol,
                    "modulos_em_outro_empreendimento": len(em_outro)})
    andamento = [x for x in emp if x["situacao"] == "Em andamento"]
    venc = [x for x in andamento if x["prazo_legal_vencido"]]
    linhas = [[x["id"], x["ons"], x["contrato"], x["nome"], x["situacao"], x["oper_ato_legal"], x["oper_efetiva"],
               x["atraso_dias"], "sim" if x["prazo_legal_vencido"] else "não", x["km_lt"], x["mva_tr"],
               x["modulos_em_outro_empreendimento"], "|".join(x["ufs"]), x["obras"], x["obras_resolucao"]]
              for x in sorted(emp, key=lambda z: (z["situacao"], z["oper_ato_legal"] or ""))]
    _csv(os.path.basename(DOWNLOADS["obras"]), _cabecalho("obras"), linhas)
    compart = {k for k, es in usos.items() if len(es) > 1}
    maiores_venc = sorted(venc, key=lambda x: -(x["dias_desde_prazo_legal"] or 0))[:20]
    return {
        "data_referencia": data_siget,
        "definicao_km": KM_CIRCUITO,
        "modulos_lt_fora_do_limite": sum(1 for x in lts.values() if x.get("km") is not None
                                         and not (0 <= x["km"] <= LIMITE_KM_CIRCUITO)),
        "modulos_em_mais_de_um_empreendimento": {
            "regra": "contado uma vez, no empreendimento cuja obra de Instalação tem a data de operação mais antiga (empate: menor número)",
            "modulos_lt": sum(1 for t, _ in compart if t == "LT"), "modulos_tr": sum(1 for t, _ in compart if t == "ME"),
            "km_lt": _r(sum(lts[m].get("km") or 0 for t, m in compart if t == "LT" and m in lts)),
            "mva_tr": _r(sum((eqps[m].get("mva") or 0) for t, m in compart if t == "ME" and m in eqps))},
        "por_situacao": [{"situacao": s, "empreendimentos": x["empreendimentos"], "obras": x["obras"],
                          "km_lt_novas": _r(x["km"]), "mva_tr_novos": _r(x["mva"])}
                         for s, x in sorted(por_sit.items(), key=lambda kv: -kv[1]["empreendimentos"])],
        "em_andamento": {"empreendimentos": len(andamento), "km_lt_novas": _r(sum(x["km_lt"] for x in andamento)),
                         "mva_tr_novos": _r(sum(x["mva_tr"] for x in andamento)),
                         "com_prazo_legal_vencido": len(venc), "km_prazo_vencido": _r(sum(x["km_lt"] for x in venc)),
                         "mva_prazo_vencido": _r(sum(x["mva_tr"] for x in venc)),
                         "mediana_dias_desde_prazo_legal": c.quantil([x["dias_desde_prazo_legal"] for x in venc], 0.5)},
        "em_andamento_por_uf": [{"uf": uf, "empreendimentos": len(x["empreendimentos"]), "km_lt_toca_uf": _r(x["km"]),
                                 "mva_tr": _r(x["mva"])} for uf, x in sorted(uf_and.items(), key=lambda kv: -kv[1]["km"])],
        "maiores_prazos_vencidos": [{k: x[k] for k in ("id", "ons", "nome", "oper_ato_legal", "dias_desde_prazo_legal",
                                                         "km_lt", "mva_tr", "ufs")} for x in maiores_venc],
        "atraso_realizado_por_ano": [{"ano": a, "empreendimentos": len(v), "pct_com_atraso": _pct(sum(1 for d in v if d > 0), len(v)),
                                      "mediana_dias": c.quantil(v, 0.5), "p75_dias": c.quantil(v, 0.75)}
                                     for a, v in sorted(atraso_ano.items()) if a >= "2010"],
        "entrada_por_ano": [{"ano": a, "km_lt_novas": _r(x["km"]), "mva_tr_novos": _r(x["mva"]),
                             "modulos_lt": x["modulos_lt"], "modulos_tr": x["modulos_tr"]}
                            for a, x in sorted(entrada.items()) if a >= "2005"],
        "_emp": emp,
    }


def _dono_dos_modulos(epds):
    """({(tipo, módulo): empreendimento}, {(tipo, módulo): empreendimentos}) para os
    módulos LT e ME de obras de Instalação: o dono é o empreendimento cuja obra tem a
    data de operação mais antiga (sem data por último; empate pelo menor número)."""
    cand, usos = {}, defaultdict(set)
    for eid, e in epds.items():
        for o in e.get("obras", []):
            obra, mdl, sit_obra, tipo_obra, oper_obra, tipo_mdl = o[:6]
            if tipo_obra != "Instalação" or tipo_mdl not in ("LT", "ME"):
                continue
            chave = (oper_obra or "9999-99-99", int(eid) if str(eid).isdigit() else 10 ** 12, str(eid))
            k = (tipo_mdl, mdl)
            usos[k].add(eid)
            if k not in cand or chave < cand[k][0]:
                cand[k] = (chave, eid)
    return {k: v[1] for k, v in cand.items()}, usos


def _bloco_contratos(contratos, epds, lts, eqps, ultimo_leilao_data, data_siget):
    """Contratos de concessão de transmissão por data de assinatura (SIGET, recurso
    'Contrato Agente'), com km de circuito e MVA novos do objeto original de cada
    contrato: linhas do arquivo de obras cujo fim de contrato é igual ao do contrato.
    Reforços incorporados depois a contratos antigos (com prazo próprio) ficam fora das
    somas e são contados. Sem RAP nem deságio: o SIGET não publica o resultado do leilão.
    Camada que cobre o período depois do último leilão do arquivo de leilões."""
    por_ccd = defaultdict(lambda: {"epds": set(), "proprio": set(), "lt": set(), "me": set()})
    for eid, e in epds.items():
        c_ = e.get("contrato")
        if not c_ or c_ not in contratos:
            continue
        fim_ccd = contratos[c_].get("fim")
        for o in e.get("obras", []):
            obra, mdl, sit_obra, tipo_obra, oper_obra, tipo_mdl, nome_mdl = o[:7]
            fim_l = o[7] if len(o) > 7 else None
            if fim_l and fim_ccd and fim_l != fim_ccd:
                por_ccd[c_]["proprio"].add(eid)
                continue
            por_ccd[c_]["epds"].add(eid)
            if tipo_obra == "Instalação" and tipo_mdl == "LT" and mdl in lts:
                por_ccd[c_]["lt"].add(mdl)
            elif tipo_obra == "Instalação" and tipo_mdl == "ME" and mdl in eqps and eqps[mdl].get("mva"):
                por_ccd[c_]["me"].add(mdl)
    linhas, por_ano = [], defaultdict(lambda: {"contratos": 0, "sem_empreendimento": 0, "epds": 0, "km": 0.0, "mva": 0.0})
    for k, c_ in sorted(contratos.items(), key=lambda kv: (kv[1].get("assinatura") or "", kv[0])):
        x = por_ccd.get(k)
        tem = bool(x and x["epds"])
        km = sum(lts[m].get("km") or 0 for m in x["lt"]) if tem else None
        mva = sum(eqps[m]["mva"] for m in x["me"]) if tem else None
        linhas.append([k, c_.get("numero"), c_.get("assinatura"), c_.get("fim"), c_.get("cnpj"), c_.get("agente"),
                       len(x["epds"]) if tem else None, km, mva, len(x["proprio"] - x["epds"]) if x else 0])
        a = (c_.get("assinatura") or "")[:4]
        if not a:
            continue
        g = por_ano[a]
        g["contratos"] += 1
        if tem:
            g["epds"] += len(x["epds"])
            g["km"] += km
            g["mva"] += mva
        else:
            g["sem_empreendimento"] += 1
    _csv(os.path.basename(DOWNLOADS["contratos"]), _cabecalho("contratos"), linhas)
    # o recurso lista todos os contratos de concessão cadastrados: ano dentro do período
    # sem contrato assinado é zero observado (2025 em 30/09/2026), não ausência
    if por_ano:
        for a in range(int(min(por_ano)), int(max(por_ano)) + 1):
            por_ano[str(a)]
    depois = [z for z in linhas if (z[2] or "") > (ultimo_leilao_data or "")]
    return {
        "data_referencia": data_siget,
        "regra": ("Data de assinatura publicada pela fonte (DatAsnCcd). km e MVA: módulos de linha e transformadores de "
                  "obras de Instalação dos empreendimentos do objeto original do contrato (linhas com a mesma data de fim "
                  "do contrato); reforço incorporado depois, com prazo próprio, fica fora. Contrato sem empreendimento "
                  "cadastrado no SIGET tem km e MVA ausentes, não zero. Um contrato pode vir de leilão, de relicitação ou de "
                  "outra origem: o SIGET não informa o leilão nem a RAP de lance."),
        "nota_zero": "O recurso lista todos os contratos de concessão de transmissão cadastrados no SIGET: ano do período sem contrato assinado aparece com 0 contratos (zero observado, não ausência).",
        "por_ano": [{"ano": a, "contratos": g["contratos"], "contratos_sem_empreendimento": g["sem_empreendimento"],
                     "empreendimentos": g["epds"], "km_lt_novas": _r(g["km"]), "mva_tr_novos": _r(g["mva"]),
                     "ano_parcial": a == (data_siget or "")[:4]} for a, g in sorted(por_ano.items())],
        "depois_do_ultimo_leilao_do_arquivo": {
            "ultimo_leilao": ultimo_leilao_data,
            "contratos": [{"contrato": z[0], "numero": z[1], "assinatura": z[2], "agente": z[5], "empreendimentos": z[6],
                           "km_lt_novas": _r(z[7]), "mva_tr_novos": _r(z[8])} for z in depois]},
    }


# Maior extensão plausível de um circuito: o bipolo Xingu × Terminal Rio, o mais longo
# do SIN, tem 2.539 km no SIGET; acima de 3.000 km o valor é tratado como erro de leitura.
LIMITE_KM_CIRCUITO = 3000
KM_CIRCUITO = ("km de circuito: soma de NumEtnLinTms (extensão da linha, em km) de cada módulo de linha distinto; "
               "no SIGET cada circuito é um módulo, então linha de circuito duplo ou bipolo conta cada circuito")


# categorias da Figura 3-25 do PDE 2035 e a correspondência verificada com o SIGA/RALIE
CAMADAS_PDE = [
    {"categoria": "UHE (GW)", "rotulo": "Hidrelétricas (UHE)", "siga": lambda u: u.get("tipo") == "UHE",
     "correspondencia": "direta"},
    {"categoria": "PCH (GW)", "rotulo": "Pequenas centrais hidrelétricas (PCH)", "siga": lambda u: u.get("tipo") == "PCH",
     "correspondencia": "direta", "nota": "As centrais geradoras hidrelétricas (CGH) do SIGA não entram: a figura do PDE não informa se as inclui."},
    {"categoria": "Eólica (GW)", "rotulo": "Eólicas", "siga": lambda u: u.get("tipo") == "EOL", "correspondencia": "direta"},
    {"categoria": "Solar fotovoltaica (GW)", "rotulo": "Solar centralizada", "siga": lambda u: u.get("tipo") == "UFV",
     "correspondencia": "direta", "nota": "Geração centralizada; a MMGD é categoria separada no PDE e não está no SIGA."},
    {"categoria": "Biomassa (GW)", "rotulo": "Biomassa", "siga": lambda u: u.get("tipo") == "UTE" and u.get("origem") == "Biomassa",
     "correspondencia": "direta"},
    {"categoria": "UTE (GW)", "rotulo": "Termelétricas (PDE)", "siga": None, "correspondencia": "sem correspondência verificada",
     "nota": "A figura não detalha quais térmicas compõem a categoria (fósseis, nuclear, sistemas isolados, usinas sem contrato retiradas do Caso Base); o SIGA não é comparado."},
    {"categoria": "MMGD (GW)", "rotulo": "Micro e minigeração distribuída", "siga": None,
     "correspondencia": "fora do universo do SIGA e do RALIE"},
    {"categoria": "Baterias (GW)", "rotulo": "Baterias", "siga": None, "correspondencia": "fora do universo do SIGA e do RALIE"},
    {"categoria": "RD (GW)", "rotulo": "Resposta da demanda", "siga": None, "correspondencia": "não é geração"},
]

HIPOTESES_PDE2035 = [
    {"texto": "Data-base das premissas: janeiro de 2025.", "pagina": 92},
    {"texto": "Horizonte do plano: 2026 a 2035.", "pagina": None},
    {"texto": "Caso Base: sistema existente em janeiro de 2025, oferta contratada em leilões regulados até janeiro de 2025 e entrada pelo ambiente livre só de empreendimentos com alta viabilidade, sem expansão indicativa.", "pagina": 72},
    {"texto": "Retirada do Caso Base de cerca de 11.200 MW de termelétricas existentes com fim de contrato regulado, fim de benefício da CDE/PPT ou sem contrato, por incerteza sobre sua disponibilidade futura.", "pagina": 72},
    {"texto": "Cerca de 14.300 MW de retrofit de termelétricas descontratadas oferecidos ao modelo de decisão de investimentos de forma escalonada.", "pagina": 72},
    {"texto": "Crescimento médio da carga global do SIN (sem abatimento da MMGD) de cerca de 3,2% ao ano no horizonte.", "pagina": 74},
    {"texto": "Micro e minigeração distribuída projetada para cerca de 78 GW em 2035 no Cenário de Referência.", "pagina": 73},
    {"texto": "Cenário de Referência considera a Lei nº 14.182/2021 (8.000 MW de termelétricas a gás com inflexibilidade de pelo menos 70%, contratação de centrais hidrelétricas de até 50 MW até 2.000 MW e prorrogação do PROINFA) e a Lei nº 14.299/2022 (manutenção do Complexo Jorge Lacerda).", "pagina": 93},
    {"texto": "Angra 3 com início de operação comercial em 2033, adotado após consulta ao MME.", "pagina": 93},
    {"texto": "Expansão indicativa escolhida pelo menor custo total que atende aos critérios de suprimento de energia e potência.", "pagina": 93},
]


def _bloco_cenarios(con, pde_obs, siga, ralie_us, ralie_ug, html_pagina, vint_pde):
    """P043: PDE 2035 como CENÁRIO, com realizado (SIGA) e carteira (RALIE) em camadas
    separadas; nenhuma diferença entre camadas é calculada."""
    figs = {}
    for chave, spec in epe_pde.FIGURAS_PDE2035.items():
        series = {s.split(".", 2)[2]: dict(pts) for s, pts in pde_obs.items() if s.startswith(f"pde2035.{chave}.")}
        if not series:
            continue
        refs = sorted({r for pts in series.values() for r in pts})
        cols = [col for col in (spec["colunas"] or sorted(series)) if col in series]
        figs[chave] = {"titulo": spec["titulo"], "aba": spec["aba"], "unidade": spec["unidade"], "pagina": spec["pagina"],
                       "nota": spec["nota"], "colunas": cols,
                       "linhas": [{"ref": r, **{col: c.r(series[col].get(r), 3) for col in cols}} for r in refs]}
    aprov = None
    if html_pagina:
        import html as _html
        import re as _re
        txt = _re.sub(r"<[^>]+>", " ", html_pagina)
        txt = _re.sub(r"\s+", " ", _html.unescape(txt)).replace("​", "")
        m = _re.search(r"aprovado pela (Portaria MME n\S* ?[\d.]+, de \d{1,2} de \w+ de \d{4})", txt)
        if m:
            aprov = {"texto": m.group(1), "verificado_em": "página da EPE capturada", "fonte": URL_PDE_PAGINA}
    # camadas
    f325 = figs.get("fig_3_25", {"linhas": []})
    p25 = next((x for x in f325["linhas"] if x["ref"].startswith("2025")), {})
    p35 = next((x for x in f325["linhas"] if x["ref"].startswith("2035")), {})
    kw_ug = defaultdict(float)
    for k, x in ralie_ug.items():
        kw_ug[k.split(":")[0]] += x.get("kw") or 0
    camadas = []
    for cam in CAMADAS_PDE:
        linha = {"categoria": cam["categoria"].replace(" (GW)", ""), "rotulo": cam["rotulo"],
                 "pde_dez2025_gw": p25.get(cam["categoria"]), "pde_dez2035_gw": p35.get(cam["categoria"]),
                 "correspondencia": cam["correspondencia"], "nota": cam.get("nota"),
                 "realizado_siga_gw": None, "carteira_ralie_gw": None}
        if cam["siga"] is not None:
            linha["realizado_siga_gw"] = c.r(sum(u.get("kw_fiscalizado") or 0 for u in siga.values()
                                                 if u.get("fase") == "Operação" and cam["siga"](u)) / 1e6, 3)
            linha["carteira_ralie_gw"] = c.r(sum(kw_ug.get(n, 0.0) for n, u in ralie_us.items() if cam["siga"](u)) / 1e6, 3)
        camadas.append(linha)
    soma25 = sum(v for k, v in p25.items() if k != "ref" and v is not None)
    soma35 = sum(v for k, v in p35.items() if k != "ref" and v is not None)
    soma36 = None
    mmgd25 = p25.get("MMGD (GW)")
    f36 = figs.get("fig_3_6")
    if f36:
        l25 = next((x for x in f36["linhas"] if x["ref"] == "2025"), None)
        if l25:
            soma36 = sum(v for k, v in l25.items() if k != "ref" and v is not None)
    return {
        "selo": "CENÁRIO", "edicao": "PDE 2035", "orgao": "EPE e Ministério de Minas e Energia",
        "aprovacao": aprov, "data_base_premissas": "janeiro de 2025", "horizonte": "2026 a 2035",
        "cenario": "Cenário de Referência (expansão indicativa) e Caso Base (existente e contratado)",
        "universo": "Figura 3-25: matriz elétrica nacional, incluindo MMGD, baterias e resposta da demanda; Figura 3-6: SIN, existente e contratado; Figuras 4-19, 4-24 e 4-27: expansão da Rede Básica.",
        "hipoteses": HIPOTESES_PDE2035,
        "relatorio": URL_PDE_RELATORIO, "caderno_de_dados": URL_PDE_DADOS,
        "figuras": figs, "camadas": camadas,
        "conferencia_relatorio": [
            {"descricao": "Soma das categorias da Figura 3-25 em dez/2025 contra o total rotulado no relatório (249 GW, p. 97)",
             "calculado_gw": c.r(soma25, 2), "relatorio_gw": 249, "diferenca_gw": c.r(soma25 - 249, 2), "tolerancia_gw": 0.5,
             "resultado": "aprovada" if abs(soma25 - 249) <= 0.5 else "divergente",
             "conferencia_de": "valor e universo", "ressalva": None},
            {"descricao": "Soma das categorias da Figura 3-25 em dez/2035 contra o total rotulado no relatório (359 GW, p. 97)",
             "calculado_gw": c.r(soma35, 2), "relatorio_gw": 359, "diferenca_gw": c.r(soma35 - 359, 2), "tolerancia_gw": 0.5,
             "resultado": "aprovada" if abs(soma35 - 359) <= 0.5 else "divergente",
             "conferencia_de": "valor e universo", "ressalva": None},
        ] + ([{"descricao": "Soma das fontes da Figura 3-6 em 2025 contra 'aproximadamente 251 GW' do texto (p. 72)",
               "calculado_gw": c.r(soma36, 2), "relatorio_gw": 251, "diferenca_gw": c.r(soma36 - 251, 2), "tolerancia_gw": 1.0,
               "resultado": "aprovada" if abs(soma36 - 251) <= 1.0 else "divergente",
               # o valor confere, o universo não: o texto fala em oferta centralizada e a
               # figura põe a MMGD na coluna Solar (p. 73)
               "conferencia_de": "valor (não de universo)",
               "ressalva": (f"O texto da p. 72 descreve cerca de 251 GW de oferta centralizada, mas a Figura 3-6 inclui a MMGD na "
                            f"coluna Solar (p. 73): {_milhar(mmgd25, 3)} GW de MMGD em dez/2025 pela Figura 3-25. Sem ela a "
                            f"figura somaria {_milhar(soma36 - mmgd25, 2)} GW. O total confere em valor; o universo do texto "
                            "e o da figura são diferentes.") if mmgd25 is not None else
                           "A Figura 3-6 inclui a MMGD na coluna Solar (p. 73), e o texto da p. 72 fala em oferta centralizada: o total confere em valor, não em universo."}]
           if soma36 is not None else []),
        "atualizacao_planilhas": (_meta(con, DS_PDE, "pde2035") or {}).get("atualizacao"),
        "vintage": {"arquivo": (vint_pde or {}).get("arquivo"), "sha256": (vint_pde or {}).get("sha256"),
                    "capturado_em": (vint_pde or {}).get("capturado_em")},
    }


# ================================================================== gold

def _series(con, ds, prefixo):
    rows = con.execute("SELECT DISTINCT serie FROM observacoes WHERE dataset=? AND serie LIKE ?",
                       (ds, prefixo + "%")).fetchall()
    return {s: base.serie_vigente(con, ds, s) for (s,) in rows}


def _agregados(con):
    cap = defaultdict(dict)
    for s, pts in _series(con, DS_AGREG, "cap_uf.kw.").items():
        uf = s.split(".")[-1]
        for ref, v in pts:
            cap[ref][uf] = v
    emp = defaultdict(dict)
    for s, pts in _series(con, DS_AGREG, "emp_op.kw.").items():
        t = s.split(".")[-1]
        for ref, v in pts:
            emp[ref][t] = v
    return {"cap_uf": cap, "cap_uf_refs": sorted(cap), "emp_op": emp, "emp_op_refs": sorted(emp)}


def _historico_mensal(con, mensais):
    """Série mensal do RALIE (última fotografia de cada mês) a partir do silver."""
    ug = _series(con, DS_RALIE, "ug.")
    us = _series(con, DS_RALIE, "usina.")
    ugd = {s: dict(p) for s, p in ug.items()}
    usd = {s: dict(p) for s, p in us.items()}
    out = []
    for d in mensais:
        def soma(prefixo, dic):
            return sum(v.get(d, 0.0) for s, v in dic.items() if s.startswith(prefixo))
        linha = {"ralie": d,
                 "usinas": int(soma("usina.n.tipo.", usd)),
                 "mw_outorgado": _r(_mw(soma("usina.kw_outorgado.tipo.", usd))),
                 "ugs": int(soma("ug.n.", ugd)),
                 "mw_ugs": _r(_mw(soma("ug.kw.", ugd))),
                 "mw_ugs_sem_previsao": _r(_mw(soma("ug.kw_sem_previsao.", ugd)))}
        for dim, vals in (("obra", ("Não Iniciada", "Em andamento", "Paralisada")),
                          ("viabilidade", ("Alta", "Média", "Baixa")),
                          ("cronograma", ("Normal", "Atrasado", "Adiantado"))):
            for val in vals:
                s = f"usina.kw_outorgado.{dim}.{val}"
                linha[f"mw_{dim}_{ax.entidades.slug(val).replace('-', '_')}"] = _r(_mw(usd.get(s, {}).get(d))) \
                    if d in usd.get(s, {}) else 0.0
        por_tipo = {}
        for s, v in ugd.items():
            if s.startswith("ug.kw.") and d in v:
                por_tipo[s.split(".")[-1]] = _r(_mw(v[d]))
        linha["mw_ugs_por_tipo"] = por_tipo
        out.append(linha)
    return out


# Tolerância das conferências entre recursos da mesma fonte: o resumo anual de liberações
# publica kW com duas casas; a soma do detalhado, também com duas casas por linha, só pode
# diferir por arredondamento (menos de 0,5 kW por grupo). Qualquer diferença maior é outra
# cobertura ou outra unidade.
TOLERANCIA_RESUMO_KW = 0.5


def _conferencias(con, ralie_ug, pf_ug, data_ralie, lib_linhas):
    """Conferências entre recursos oficiais independentes do mesmo conjunto, refeitas a cada
    gold: (1) RALIE atual (CSV) contra a mesma fotografia no Parquet histórico, unidade por
    unidade (potência e previsão); (2) liberações do arquivo detalhado somadas por ano e tipo
    contra o resumo anual oficial, desde 2014 (antes disso o detalhado não cobre toda a
    potência, segundo o dicionário, e o resumo está em MW)."""
    t = ax.ug_mensal(pf_ug, [data_ralie])
    hist = {}
    for r in t.to_pylist():
        prev = r["DatPrevisaoOpComercialSFG"]
        hist[f"{r['IdeNucleoCEG']}:{r['NumUgUsina']}"] = (r["MdaPotenciaUnitaria"], prev.isoformat() if prev else None)
    del t
    iguais = sum(1 for k, x in ralie_ug.items()
                 if k in hist and hist[k][1] == (x.get("previsao_sfg") or None)
                 and abs((hist[k][0] or 0) - (x.get("kw") or 0)) < 1e-6)
    kw_csv = sum(x.get("kw") or 0 for x in ralie_ug.values())
    kw_pq = sum(v[0] or 0 for v in hist.values())
    ralie = {"fotografia": data_ralie, "ugs_csv": len(ralie_ug), "ugs_parquet": len(hist), "ugs_iguais": iguais,
             "mw_csv": _r(_mw(kw_csv), 3), "mw_parquet": _r(_mw(kw_pq), 3),
             "resultado": "aprovada" if iguais == len(ralie_ug) == len(hist) else "divergente"}
    det = defaultdict(float)
    for x in lib_linhas:
        if x["realizado"] and x["realizado"][:4] >= "2014":
            det[(x["realizado"][:4], x["tipo"])] += x["kw"] or 0
    resumo = {}
    for s_, pts in _series(con, DS_LIB, "resumido.").items():
        for ano, v in pts:
            if ano >= "2014":
                resumo[(ano, s_.split(".", 1)[1])] = v
    grupos = sorted(set(det) | set(resumo))
    diverg = [{"ano": a, "tipo": t_, "detalhado_kw": _r(det.get((a, t_)), 2), "resumo_kw": _r(resumo.get((a, t_)), 2)}
              for a, t_ in grupos if abs(det.get((a, t_), 0.0) - resumo.get((a, t_), 0.0)) > TOLERANCIA_RESUMO_KW]
    lib = {"desde": "2014", "grupos_ano_tipo": len(grupos), "iguais": len(grupos) - len(diverg),
           "tolerancia_kw": TOLERANCIA_RESUMO_KW, "divergentes": diverg[:20],
           "resultado": "aprovada" if grupos and not diverg else "divergente"}
    return {"ralie_csv_x_parquet": ralie, "liberacoes_detalhado_x_resumo": lib}


# Ano a partir do qual o resumo anual de liberações publica o campo MdaSomaPotenciaMW
# em kW (70 de 70 grupos de ano e tipo iguais à soma do arquivo detalhado em kW, desde
# 2014). Antes disso o campo está em MW: o detalhado, em kW, soma de 0% a 101% do
# resumo lido como MW (cobertura publicada por ano na série anual).
ANO_RESUMO_EM_KW = "2014"


def _resumo_liberacoes_mw(con):
    """{ano: MW liberado para operação comercial} do resumo anual oficial, convertido."""
    out = defaultdict(float)
    for s_, pts in _series(con, DS_LIB, "resumido.").items():
        for ano, v in pts:
            out[ano] += v if ano < ANO_RESUMO_EM_KW else v / 1000.0
    return dict(out)


def _contagem(n, singular, plural):
    return f"{_milhar(n)} {singular if n == 1 else plural}"


def _valida(siga, ralie_ug, data_siga, hoje):
    """Controles físicos e de esquema (seção 5.2 do contrato). Retorna (críticos, ressalvas)."""
    criticos, ressalvas = [], []
    if len(siga) < 1000:
        criticos.append(f"SIGA com apenas {len(siga)} usinas")
    neg = [k for k, u in siga.items() if (u.get("kw_outorgado") or 0) < 0 or (u.get("kw_fiscalizado") or 0) < 0]
    if neg:
        criticos.append(f"{len(neg)} usinas do SIGA com potência negativa")
    fora = [k for k, u in siga.items() if u.get("lat") is not None and not (-34.5 <= u["lat"] <= 5.5 and -74.5 <= u["lon"] <= -28.5)]
    if fora:
        ressalvas.append(f"{_contagem(len(fora), 'usina', 'usinas')} com coordenada fora do retângulo do território brasileiro: fora do mapa.")
    if data_siga and data_siga > hoje.isoformat():
        criticos.append(f"data de geração do SIGA no futuro: {data_siga}")
    op_sem_pot = [k for k, u in siga.items() if u.get("fase") == "Operação" and not u.get("kw_fiscalizado")]
    if op_sem_pot:
        ressalvas.append(f"{_contagem(len(op_sem_pot), 'usina', 'usinas')} na fase Operação com potência fiscalizada zero ou vazia no SIGA (mantidas; somam 0 kW).")
    fiscal_acima = [k for k, u in siga.items() if (u.get("kw_fiscalizado") or 0) > 1.2 * (u.get("kw_outorgado") or 0) > 0]
    if fiscal_acima:
        ressalvas.append(f"{_contagem(len(fiscal_acima), 'usina', 'usinas')} com potência fiscalizada mais de 20% acima da outorgada (valor da fonte mantido).")
    negu = [k for k, x in ralie_ug.items() if (x.get("kw") or 0) < 0]
    if negu:
        criticos.append(f"{len(negu)} unidades do RALIE com potência negativa")
    return criticos, ressalvas


def construir(con, ctx):
    hoje = ctx.get("hoje") or date.today()
    siga = {}
    for k, u in _estado(con, DS_SIGA, "usina:").items():
        u["fase"] = u.get("fase")
        siga[k] = u
    if not siga:
        return c.stub(GOLD, "SIGA ausente no silver da família aneel_geracao")
    vig = {ds: ckan.vintages_vigentes(con, ds) for ds in (DS_SIGA, DS_RALIE, DS_LIB, DS_ATOS, DS_LEILOES, DS_SIGET, DS_AGREG, DS_PDE,
                                                          DS_REDE_EPE)}
    meta_siga = _meta(con, DS_SIGA, "siga-empreendimentos-geracao-diario.csv")
    data_siga = meta_siga.get("data_geracao")
    ralie_us = _estado(con, DS_RALIE, "usina:")
    ralie_ug = _estado(con, DS_RALIE, "ug:")
    ralie_lei = _estado(con, DS_RALIE, "leilao:")
    if not ralie_us or not ralie_ug:
        return c.stub(GOLD, "RALIE atual ausente no silver")
    data_ralie = (_meta(con, DS_RALIE, "ralie-usina-atual.csv").get("datas_ralie") or [None])[-1]
    criticos, ressalvas = _valida(siga, ralie_ug, data_siga, hoje)
    if criticos:
        return c.stub(GOLD, "validação crítica: " + "; ".join(criticos))
    lib_linhas, lib_idx = _liberacoes(_estado(con, DS_LIB, "lib:"))
    v_lib = vig[DS_LIB].get("unidades-geradoras-liberadas-operacao-comercial-detalhado.csv")
    data_lib = max((x["realizado"] for x in lib_linhas if x["realizado"]), default=None)
    data_lib_arquivo = (v_lib or {}).get("publicado_em", "")[:10] or data_lib
    encerramentos = _estado(con, DS_ATOS, "enc:")
    lotes = _estado(con, DS_LEILOES, "lote:")
    epds = _estado(con, DS_SIGET, "epd:")
    lts = _estado(con, DS_SIGET, "lt:")
    eqps = _estado(con, DS_SIGET, "eqp:")
    resol = _estado(con, DS_SIGET, "resolucao:")
    agreg = _agregados(con)
    v_ug_hist = vig[DS_RALIE].get("ralie-unidade-geradora-historico.parquet")
    v_us_hist = vig[DS_RALIE].get("ralie-usina-historico.parquet")
    if not v_ug_hist or not v_us_hist:
        return c.stub(GOLD, "histórico do RALIE ausente no bronze")
    pf_ug = ax.abre_parquet(_bytes_bronze(v_ug_hist))
    pf_us = ax.abre_parquet(_bytes_bronze(v_us_hist))
    datas_hist = ax.datas_ralie(pf_us)
    mensais = ax.ultimo_por_mes(datas_hist)
    ralie_kw_hist = ax.potencias_outorgadas_historicas(pf_us)

    conferencias = _conferencias(con, ralie_ug, pf_ug, data_ralie, lib_linhas)
    capacidade = _bloco_capacidade(siga, agreg, lib_linhas, data_siga)
    fora = capacidade["reconciliacao"]["fora_da_tolerancia"]
    rec_ref = capacidade["reconciliacao"]
    if fora["tipos"]:
        ressalvas.append(f"Reconciliação com o agregado oficial por tipo ({rec_ref['referencia_tipo']}) com resíduo acima de "
                         f"{TOLERANCIA_RESIDUO_PCT:g}% em: {', '.join(fora['tipos'])}.")
    if fora["ufs"]:
        ressalvas.append(f"Reconciliação com o agregado oficial por UF ({rec_ref['referencia_uf']}) com resíduo acima de "
                         f"{TOLERANCIA_RESIDUO_PCT:g}% em: {', '.join(fora['ufs'])} (diferença não explicada pelas liberações do intervalo; valores da fonte mantidos).")
    for nome, x in conferencias.items():
        if x["resultado"] != "aprovada":
            ressalvas.append(f"Conferência {nome.replace('_', ' ')} divergente: ver conferencias.{nome}.")
    estagios = _bloco_estagios(siga, encerramentos, ralie_us, ralie_ug, ralie_lei, data_siga, data_ralie, ralie_kw_hist)
    del ralie_kw_hist
    enc = estagios["encerramentos"]
    pc_ = enc["potencia_conferida"]
    if pc_["corrigidas_kw"] or pc_["fora_da_soma"]:
        ressalvas.append(
            f"{_contagem(len(pc_['corrigidas_kw']), 'ato', 'atos')} de encerramento com a potência em kW no campo de MW "
            f"(corrigidos pelo cadastro da usina) e {_contagem(len(pc_['fora_da_soma']), 'ato', 'atos')} com potência "
            "divergente por fator 1.000 sem confirmação (fora da soma): ver estagios.encerramentos.potencia_conferida.")
    # data de corte das liberações para a janela de confiabilidade: data de geração do
    # arquivo publicada pela ANEEL (last_modified do recurso)
    cronograma = _bloco_cronograma(con, ralie_us, ralie_ug, lib_linhas, lib_idx, data_ralie, data_lib_arquivo, pf_ug, mensais)
    cronograma["historico_fonte"].update({"primeira_fotografia": datas_hist[0], "fotografias": len(datas_hist),
                                          "ultima_fotografia": datas_hist[-1]})
    trajs = ax.trajetorias_usinas(pf_ug, pf_us)
    prim = ax.ugs_da_primeira_aparicao(pf_ug)
    del pf_ug
    desf = _desfechos(trajs, prim, lib_idx, siga, encerramentos, datas_hist[-1])
    estagios["coortes"] = _bloco_coortes(desf, datas_hist[0])
    estagios["desfechos_definicao"] = DESFECHOS
    # sem desfecho: a usina saiu do RALIE sem operação nem ato; onde ela está no SIGA
    # (ausente do arquivo aberto = provável encerramento ainda sem ato vinculado ao CEG)
    sd = defaultdict(lambda: {"usinas": 0, "kw": 0.0})
    for x in desf.values():
        if x["desfecho"] == "sem_desfecho":
            k = x.get("fase_siga") or "ausente do SIGA"
            sd[k]["usinas"] += 1
            sd[k]["kw"] += x.get("kw_primeira") or 0
    estagios["sem_desfecho_no_siga"] = [{"situacao_siga": k, "usinas": v["usinas"], "mw_outorgado": _r(_mw(v["kw"]))}
                                        for k, v in sorted(sd.items(), key=lambda kv: -kv[1]["usinas"])]
    estagios["historico_mensal"] = _historico_mensal(con, mensais)
    leiloes = _bloco_leiloes(lotes, (vig[DS_LEILOES].get("resultado-leiloes-transmissao.csv") or {}).get("publicado_em"))
    contratos_siget = _estado(con, DS_SIGET, "ccd:")
    data_siget = ((vig[DS_SIGET].get("siget-contrato-empreendimento-obra-modulo.csv") or {}).get("publicado_em") or "")[:10] \
        or hoje.isoformat()
    obras = _bloco_obras(epds, lts, eqps, resol, data_siget)
    emp_siget = obras.pop("_emp")
    contratos = _bloco_contratos(contratos_siget, epds, lts, eqps, leiloes["periodo"]["fim"], data_siget) \
        if contratos_siget else None
    rede_epe = _bloco_rede_epe(vig[DS_REDE_EPE])
    conf_bruta = cronograma.pop("_conf")
    bloco_atual = cronograma.pop("_bloco_atual")

    # geração e rede por UF (campos separados; nada é somado entre si)
    ger_uf = defaultdict(lambda: {"kw": 0.0, "kw24": 0.0})
    lim24 = (date.fromisoformat(data_ralie) + timedelta(days=730)).isoformat()
    for k, x in ralie_ug.items():
        u = ralie_us.get(k.split(":")[0], {})
        uf = u.get("uf")
        if not uf:
            continue
        ger_uf[uf]["kw"] += x.get("kw") or 0
        if x.get("previsao_sfg") and x["previsao_sfg"] <= lim24:
            ger_uf[uf]["kw24"] += x.get("kw") or 0
    rede_uf = {r["uf"]: r for r in obras["em_andamento_por_uf"]}
    epe_pl = (rede_epe or {}).get("planejada", {}).pop("_km_uf", None) if rede_epe else None
    epe_ex = (rede_epe or {}).get("existente", {}).pop("_km_uf", None) if rede_epe else None
    ger_rede = [{"uf": uf, "mw_ugs_em_implantacao": _r(_mw(ger_uf[uf]["kw"])),
                 "mw_previsto_24_meses": _r(_mw(ger_uf[uf]["kw24"])),
                 "km_lt_em_andamento_toca_uf": (rede_uf.get(uf) or {}).get("km_lt_toca_uf", 0.0),
                 "mva_tr_em_andamento": (rede_uf.get(uf) or {}).get("mva_tr", 0.0),
                 "empreendimentos_transmissao_em_andamento": (rede_uf.get(uf) or {}).get("empreendimentos", 0),
                 # traçado da EPE dentro da UF (existente e planejado): ausência sem a camada
                 "km_rede_existente_epe": _r((epe_ex or {}).get(uf, 0.0)) if epe_ex is not None else None,
                 "km_rede_planejada_epe": _r((epe_pl or {}).get(uf, 0.0)) if epe_pl is not None else None}
                for uf in sorted(set(ger_uf) | set(rede_uf))]
    lib_ano = defaultdict(float)
    for x in lib_linhas:
        if x["realizado"]:
            lib_ano[x["realizado"][:4]] += x["kw"] or 0
    resumo_mw = _resumo_liberacoes_mw(con)
    ent = {x["ano"]: x for x in obras["entrada_por_ano"]}
    lei = {x["ano"]: x for x in leiloes["por_ano"]}
    ass = {x["ano"]: x for x in (contratos or {}).get("por_ano", [])}
    serie_anual = []
    for a in [str(y) for y in range(2005, hoje.year + 1)]:
        mw_res = resumo_mw.get(a)
        serie_anual.append({
            "ano": a,
            # resumo anual oficial (MW até 2013, kW desde 2014, convertido): o arquivo
            # detalhado não cobre toda a potência antes de 2014
            "mw_geracao_liberada": _r(mw_res) if mw_res is not None else None,
            "fonte_mw_geracao_liberada": ("resumo anual oficial (campo em MW)" if a < ANO_RESUMO_EM_KW else
                                          "resumo anual oficial (campo em kW), igual à soma do arquivo detalhado") if mw_res is not None else None,
            "cobertura_detalhado_pct": _pct(_mw(lib_ano.get(a, 0.0)), mw_res) if mw_res else None,
            "km_lt_energizados": (ent.get(a) or {}).get("km_lt_novas"),
            "mva_tr_energizados": (ent.get(a) or {}).get("mva_tr_novos"),
            "km_contratados_leilao": (lei.get(a) or {}).get("km"), "mva_contratados_leilao": (lei.get(a) or {}).get("mva"),
            "km_contratos_assinados_siget": (ass.get(a) or {}).get("km_lt_novas"),
            "mva_contratos_assinados_siget": (ass.get(a) or {}).get("mva_tr_novos"),
            "ano_parcial": a == hoje.isoformat()[:4]})

    html_pde = None
    v_html = vig[DS_PDE].get("pde2035_pagina.html")
    if v_html:
        html_pde = _bytes_bronze(v_html).decode("utf-8", errors="replace")
    pde_obs = _series(con, DS_PDE, "pde2035.")
    cenarios = _bloco_cenarios(con, pde_obs, siga, ralie_us, ralie_ug, html_pde,
                               vig[DS_PDE].get("pde2035_dados_relatorio_final.zip"))

    _escreve_csvs(siga, ralie_us, ralie_ug, ralie_lei, desf, cenarios, data_ralie, bloco_atual)

    gold = {
        **c.cabecalho(GOLD),
        "referencias": {"siga": data_siga, "ralie": data_ralie, "ralie_historico_desde": datas_hist[0],
                        "liberacoes_arquivo": data_lib_arquivo, "liberacoes_ultima_data": data_lib,
                        "atos": ((vig[DS_ATOS].get("atos-outorgas-aneel.csv") or {}).get("publicado_em") or "")[:10] or None,
                        "leiloes_transmissao": leiloes["periodo"]["fim"],
                        "leiloes_transmissao_publicado_em": (leiloes["publicado_em"] or "")[:10] or None,
                        "siget": data_siget,
                        "rede_epe_capturada_em": ((rede_epe or {}).get("existente") or {}).get("capturado_em"),
                        "pde": "PDE 2035"},
        "regras": REGRAS,
        "ressalvas": ressalvas,
        "capacidade_instalada": capacidade,
        "estagios": estagios,
        "cronograma": cronograma,
        "transmissao": {"leiloes": leiloes, "obras": obras, "contratos_assinados": contratos, "rede_epe": rede_epe,
                        "geracao_e_rede_por_uf": ger_rede, "serie_anual": serie_anual},
        "cenarios": cenarios,
        "conferencias": conferencias,
    }
    gold["proveniencia"] = _proveniencias(con, gold, vig)
    gold["evidencias"] = _evidencias(gold, vig, siga, ralie_ug, desf, conf_bruta, emp_siget, lotes, pde_obs)
    gold["downloads"] = [{"rotulo": r, "url": DOWNLOADS[k]} for k, r in (
        ("usinas", "Usinas do SIGA com estágio, potência e coordenadas (CSV)"),
        ("pontos", "Pontos das usinas para mapa (JSON)"),
        ("capacidade_uf", "Capacidade em operação por UF, tipo e origem (CSV)"),
        ("carteira", "Carteira do RALIE por usina (CSV)"),
        ("unidades", "Unidades geradoras do RALIE com previsão (CSV)"),
        ("trajetorias", "Trajetória e desfecho das usinas do RALIE desde 2021 (CSV)"),
        ("confiabilidade", "Confiabilidade das previsões por fotografia (CSV)"),
        ("liberacoes", "Liberações comerciais e atraso por ano e tipo (CSV)"),
        ("encerramentos", "Atos de revogação e extinção de outorga (CSV)"),
        ("leiloes", "Leilões de transmissão por lote (CSV)"),
        ("obras", "Empreendimentos de transmissão do SIGET (CSV)"),
        ("contratos", "Contratos de concessão de transmissão por data de assinatura (CSV)"),
        ("rede_epe", "Linhas de transmissão existentes e planejadas do WebMap da EPE (JSON)"),
        ("pde", "PDE 2035: figuras usadas (CSV)"))]
    return gold


REGRAS = {
    "estagio": "Estágio = fase do SIGA: Operação; Construção; Construção não iniciada (outorgado sem obra). Encerramentos vêm dos atos de revogação (autorização) e extinção (concessão) publicados desde 2015, com a potência uma vez por usina; outorga encerrada não é usina retirada (parte segue em operação no SIGA).",
    "encerramentos": REGRA_ENCERRAMENTOS,
    "outorga": "Outorga não é capacidade que certamente entrará: o desfecho das usinas que passaram pelo RALIE é publicado ao lado da carteira.",
    "potencia": "Potência em MW (fiscalizada para usinas em operação; outorgada para a carteira). MW é potência, não energia: não equivale a energia firme nem a garantia física.",
    "previsao": "Previsão de operação comercial = campo DatPrevisaoOpComercialSFG do RALIE (previsão da fiscalização da ANEEL por unidade geradora), sempre com a data da fotografia em que foi registrada.",
    "confiabilidade": "Para cada fotografia mensal S (última do mês), potência das unidades com previsão em (S, S + 365 dias] e quanto dela foi liberada para operação comercial até S + 365 dias, depois disso ou não foi liberada até a data do arquivo de liberações. Só janelas encerradas pelo menos 15 dias antes dessa data.",
    "deslizamento": "Variação da previsão da mesma unidade entre a fotografia mensal S e a do mesmo mês do ano seguinte, ponderada pela potência (positivo = adiada); publicada também sem as unidades em data em bloco, porque a data convencional anda cerca de um ano a cada ano junto com a fotografia.",
    "data_em_bloco": REGRA_DATA_EM_BLOCO,
    "desvio_prazo_vigente": "Data de liberação comercial realizada menos a data outorgada da unidade no arquivo de liberações (prazo vigente na publicação, sem data-base), mediana ponderada por kW. Não é atraso: em autorizações recentes a data outorgada é um prazo limite.",
    "transmissao": "km de circuito de linhas novas e MVA de transformação nova (módulos de obras do tipo Instalação no SIGET) e investimento e RAP dos leilões ficam em campos separados; nunca são somados entre si. No SIGET cada circuito é um módulo: linha de circuito duplo ou bipolo conta a extensão de cada circuito.",
    "cenario": "PDE 2035 é CENÁRIO de uma edição específica (data-base janeiro de 2025), mostrado em camada separada do realizado (SIGA) e da carteira (RALIE).",
}


def _escreve_csvs(siga, ralie_us, ralie_ug, ralie_lei, desf, cenarios, data_ralie, bloco_atual=()):
    """CSV de download. Toda previsão sai com a data-base (a fotografia do RALIE em que
    foi registrada): previsão sem data-base não permite medir atraso."""
    linhas = []
    pontos = []
    for k in sorted(siga, key=int):
        u = siga[k]
        linhas.append([int(k), u.get("ceg"), u.get("nome"), u.get("tipo"), u.get("origem"), u.get("fonte"), u.get("fase"),
                       u.get("estagio"), u.get("outorga"), u.get("uf"), u.get("municipios"), u.get("lat"), u.get("lon"),
                       u.get("kw_outorgado"), u.get("kw_fiscalizado"), u.get("entrada_operacao"),
                       u.get("garantia_fisica_kwmed"), u.get("vigencia_inicio"), u.get("vigencia_fim"), u.get("cnpjs")])
        if u.get("lat") is not None and -34.5 <= u["lat"] <= 5.5 and -74.5 <= u["lon"] <= -28.5:
            pontos.append([int(k), u.get("nome"), u.get("tipo"), u.get("estagio"), u.get("uf"),
                           c.r(_mw(u.get("kw_outorgado")), 3), c.r(_mw(u.get("kw_fiscalizado")), 3),
                           round(u["lat"], 5), round(u["lon"], 5)])
    _csv(os.path.basename(DOWNLOADS["usinas"]), _cabecalho("usinas"), linhas)
    base.escreve_gold(os.path.basename(DOWNLOADS["pontos"]),
                      {"colunas": ["nucleo", "nome", "tipo", "estagio", "uf", "mw_outorgado", "mw_fiscalizado", "lat", "lon"],
                       "linhas": pontos, "fonte": "ANEEL, SIGA (siga-empreendimentos-geracao-diario.csv)",
                       "nota": "Latitude e longitude oficiais do SIGA (centróide aproximado do empreendimento). Usinas sem coordenada (0 na fonte) não aparecem."},
                      destino=base.SERIES)
    kw_ug, n_ug, pmin, pmax, omax = defaultdict(float), defaultdict(int), {}, {}, {}
    for k, x in ralie_ug.items():
        n = k.split(":")[0]
        kw_ug[n] += x.get("kw") or 0
        n_ug[n] += 1
        p = x.get("previsao_sfg")
        if p:
            pmin[n] = min(pmin.get(n, p), p)
            pmax[n] = max(pmax.get(n, p), p)
        if x.get("comercial_outorgado"):
            omax[n] = max(omax.get(n, ""), x["comercial_outorgado"])
    lei = defaultdict(list)
    for k in ralie_lei:
        n, cod = k.split(":", 1)
        lei[n].append(cod)
    cart = []
    for n in sorted(ralie_us, key=int):
        u = ralie_us[n]
        atraso = (date.fromisoformat(pmax[n]) - date.fromisoformat(omax[n])).days if n in pmax and omax.get(n) else None
        cart.append([data_ralie, int(n), u.get("ceg"), u.get("nome"), u.get("tipo"), u.get("uf"), u.get("kw_outorgado"), kw_ug.get(n),
                     n_ug.get(n), u.get("situacao_obra"), u.get("viabilidade"), u.get("situacao_cronograma"),
                     u.get("justificativa_previsao"), pmin.get(n), pmax.get(n), omax.get(n), atraso,
                     "|".join(sorted(lei.get(n, []))), (siga.get(n) or {}).get("fase")])
    _csv(os.path.basename(DOWNLOADS["carteira"]), _cabecalho("carteira"), cart)
    ugl = []
    for k in sorted(ralie_ug, key=lambda s: tuple(int(p) for p in s.split(":"))):
        n, ug = k.split(":")
        x = ralie_ug[k]
        u = ralie_us.get(n, {})
        p = x.get("previsao_sfg")
        ugl.append([data_ralie, int(n), int(ug), u.get("tipo"), u.get("uf"), x.get("kw"), x.get("comercial_outorgado"),
                    p, None if not p else ("sim" if p in bloco_atual else "não"), x.get("teste_realizado")])
    _csv(os.path.basename(DOWNLOADS["unidades"]), _cabecalho("unidades"), ugl)
    tr = []
    for n in sorted(desf):
        x = desf[n]
        tr.append([n, x.get("ceg"), x.get("nome"), x.get("tipo"), x.get("uf"), x.get("primeira"),
                   x.get("ultima"), x.get("kw_primeira"), x.get("prev_primeira"), x.get("outorgado_primeira"),
                   x.get("prev_ultima"), x.get("outorgado_ultima"), x.get("mudancas_previsao"), x.get("ugs_primeira"),
                   x.get("ugs_primeira_liberadas"), x.get("kw_primeira_liberado"), x.get("ultima_liberacao"),
                   x.get("desfecho"), x.get("data_encerramento"), "sim" if x.get("encerramento_sem_data") else "não"])
    _csv(os.path.basename(DOWNLOADS["trajetorias"]), _cabecalho("trajetorias"), tr)
    pde = []
    for chave, f in cenarios["figuras"].items():
        for lin in f["linhas"]:
            for col in f["colunas"]:
                pde.append([f["aba"], f["titulo"], lin["ref"], col, lin.get(col), f["unidade"]])
    _csv(os.path.basename(DOWNLOADS["pde"]), _cabecalho("pde"), pde)


FONTE_SIGA = {"orgao": "ANEEL", "dataset": "SIGA: Sistema de Informações de Geração da ANEEL",
              "recurso": "siga-empreendimentos-geracao-diario.csv", "url_dataset": URL_SIGA, "licenca": LICENCA_ANEEL}
FONTE_RALIE = {"orgao": "ANEEL", "dataset": "RALIE: Relatório de Acompanhamento da Expansão da Oferta de Geração",
               "recurso": "ralie-usina-atual.csv, ralie-unidade-geradora-atual.csv, ralie-leilao-atual.csv, ralie-usina-historico.parquet, ralie-unidade-geradora-historico.parquet",
               "url_dataset": URL_RALIE, "licenca": LICENCA_ANEEL}
FONTE_LIB = {"orgao": "ANEEL", "dataset": "Liberação para operação comercial de empreendimentos de geração",
             "recurso": "unidades-geradoras-liberadas-operacao-comercial-detalhado.csv", "url_dataset": URL_LIB,
             "licenca": LICENCA_ANEEL}
FONTE_ATOS = {"orgao": "ANEEL", "dataset": "Atos de Outorgas de Geração", "recurso": "atos-outorgas-aneel.csv",
              "url_dataset": URL_ATOS, "licenca": LICENCA_ANEEL}
FONTE_LEILOES = {"orgao": "ANEEL", "dataset": "Resultado de leilões de geração e transmissão de energia elétrica",
                 "recurso": "resultado-leiloes-transmissao.csv", "url_dataset": URL_LEILOES, "licenca": LICENCA_ANEEL}
FONTE_SIGET = {"orgao": "ANEEL", "dataset": "Sistema de Gestão da Transmissão (SIGET)",
               "recurso": "siget-contrato-empreendimento-obra-modulo.csv, siget-resolucao-empreendimento-obra-modulo.csv, siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv, siget-contrato-moduloequipamento-subestacao.csv",
               "url_dataset": URL_SIGET, "licenca": LICENCA_ANEEL}
FONTE_PDE = {"orgao": "EPE", "dataset": "Plano Decenal de Expansão de Energia 2035", "recurso": "PDE 2035_Dados_Relatório Final.zip",
             "url_dataset": URL_PDE_PAGINA, "url_primaria": URL_PDE_DADOS, "licenca": LICENCA_EPE}


def _prov(con, ds, fonte, **kw):
    snap = c.snapshot_de(con, ds)
    f = {**fonte, "url_primaria": fonte.get("url_primaria") or fonte["url_dataset"]}
    return c.proveniencia(fonte=f, snapshot=snap, capturado_em=c.ultima_captura(snap), **kw)


def _proveniencias(con, g, vig):
    ref = g["referencias"]
    lim_siga = [
        "Potência em MW não é energia: a produção depende do fator de capacidade de cada fonte, e a garantia física (quando existe) é outra grandeza.",
        "Usina multiestadual é atribuída à UF principal informada pelo SIGA; a potência não é dividida entre UFs.",
        "O SIGA marca usina sem data de entrada em operação com 1900-01-03 e localização não informada com 0: os dois viram ausência.",
        "O dicionário do SIGA descreve fases desde antes da outorga até a revogação, mas o arquivo aberto traz só Operação, Construção e Construção não iniciada. Usina com outorga revogada ou extinta pode sair do arquivo ou continuar nele: centenas de usinas com ato de encerramento seguem na fase Operação (conversão de regime ou nova outorga), então estágios e encerramentos não são disjuntos.",
    ]
    hist = g["cronograma"]["historico_fonte"]
    lim_ralie = [
        "O RALIE só cobre usinas em implantação acompanhadas pela fiscalização; unidades que entram em operação comercial deixam de constar.",
        "A previsão é da fiscalização da ANEEL (SFG) e muda a cada fotografia; datas atribuídas em bloco a milhares de unidades sem licença de instalação ou sem acesso contratado indicam previsão convencional, não cronograma de obra.",
        "Outorga não é capacidade que certamente entrará; MW outorgado não é energia firme.",
        "O dicionário do recurso de unidades geradoras (versão 1.0, 16/06/2026) tem descrições deslocadas uma linha (ex.: DatLiberOpTesteRealizado descrito como descida do rotor); a leitura segue o nome do campo: DatUGInicioOpComerOutorgado é a data outorgada de operação comercial e DatPrevisaoOpComercialSFG a previsão da fiscalização.",
    ]
    return {
        "capacidade": _prov(con, DS_SIGA, FONTE_SIGA, indicador="Capacidade instalada em operação por tipo, origem e UF",
                            natureza="CALCULADO", unidade="MW", frequencia="mensal segundo o dicionário; o arquivo diário é capturado no máximo uma vez por semana",
                            periodo={"inicio": ref["siga"], "fim": ref["siga"]}, cobertura={"inicio": ref["siga"], "fim": ref["siga"]},
                            transformacoes=["soma da potência fiscalizada (kW) das usinas na fase Operação", "kW ÷ 1.000 = MW"],
                            formula="capacidade(g) = Σ MdaPotenciaFiscalizadaKw das usinas com DscFaseUsina = Operação no grupo g ÷ 1.000",
                            limitacoes=lim_siga + ["Reconciliação com os agregados publicados pela ANEEL (por tipo e por UF) mostrada ao lado; os agregados têm mês de referência anterior ao SIGA."],
                            download=DOWNLOADS["capacidade_uf"]),
        "estagios": _prov(con, DS_SIGA, FONTE_SIGA, indicador="Parque do SIGA por estágio", natureza="CALCULADO", unidade="MW e usinas",
                          frequencia="mensal segundo o dicionário; o arquivo diário é capturado no máximo uma vez por semana", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
                          cobertura={"inicio": ref["siga"], "fim": ref["siga"]},
                          transformacoes=["fase do SIGA → estágio", "soma da potência outorgada e da fiscalizada por estágio"],
                          formula="MW(estágio) = Σ MdaPotenciaOutorgadaKw das usinas na fase ÷ 1.000",
                          limitacoes=lim_siga + ["Potência fiscalizada de usina em construção é a parcela que já opera (ex.: parque com unidades liberadas)."],
                          download=DOWNLOADS["usinas"]),
        "encerramentos": _prov(con, DS_ATOS, FONTE_ATOS, indicador="Atos de revogação e extinção de outorga por ano", natureza="CALCULADO",
                               unidade="atos, usinas e MW declarado", frequencia="mensal",
                               periodo={"inicio": g["estagios"]["encerramentos"]["desde"], "fim": ref["atos"]},
                               cobertura={"inicio": "2015", "fim": ref["atos"]},
                               transformacoes=["filtro DscObjeto igual a um dos rótulos da fonte 'Autorização - Revogação' ou 'Concessão - Extinção'",
                                               "conferência da potência de cada ato contra o cadastro da usina (SIGA, RALIE histórico) e o limite legal da CGH",
                                               "potência uma vez por usina (núcleo do CEG) em cada ano e no total, pelo maior valor conferido",
                                               "contagem de atos à parte"],
                               formula="MW(ano) = Σ por usina com ato no ano de max(potência conferida dos atos da usina no ano)",
                               limitacoes=["O conjunto de atos começa em 2015; encerramentos anteriores não constam.",
                                           "Ato sem data de publicação na fonte fica fora da série anual e é contado à parte (sem_data_publicacao).",
                                           "Revogação de DRO, DRI e DRS (registros anteriores à outorga) não entra.",
                                           "A potência é a declarada no ato, que às vezes vem em kW no campo de MW: corrigida pelo cadastro quando há confirmação, fora da soma quando não há (potencia_conferida). Atos sem potência contam como ato, não como 0 MW.",
                                           f"Outorga encerrada não é usina retirada: {g['estagios']['encerramentos']['usinas_em_operacao_no_siga']['usinas']} usinas com ato de encerramento seguem na fase Operação do SIGA (usinas_em_operacao_no_siga).",
                                           f"{g['estagios']['encerramentos']['sem_chave_de_usina']['atos']} atos não têm núcleo nem código do CEG na fonte e não são deduplicados (sem_chave_de_usina).",
                                           "Usina com atos em anos diferentes aparece em cada um desses anos; o total conta a usina uma vez.",
                                           "O ano corrente é parcial."],
                               download=DOWNLOADS["encerramentos"]),
        "ralie": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Carteira em implantação (RALIE atual)", natureza="CALCULADO",
                       unidade="MW e usinas", frequencia=f"mensal segundo o dicionário; {hist['fotografias']} fotografias publicadas entre {c.data_br(hist['primeira_fotografia'])} e {c.data_br(hist['ultima_fotografia'])}",
                       periodo={"inicio": ref["ralie"], "fim": ref["ralie"]},
                       cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                       transformacoes=["soma da potência outorgada por usina e da potência unitária das unidades listadas",
                                       "agrupamento pelas classificações da fiscalização (situação da obra, viabilidade, cronograma)"],
                       formula="MW em implantação = Σ MdaPotenciaUnitaria das unidades listadas ÷ 1.000",
                       limitacoes=lim_ralie, download=DOWNLOADS["carteira"]),
        "coortes": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Desfecho das usinas que passaram pelo RALIE", natureza="CALCULADO",
                         unidade="MW outorgado na primeira fotografia", frequencia="mensal segundo o dicionário (fotografias com intervalo irregular)",
                         periodo={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                         cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                         transformacoes=["primeira e última fotografia de cada usina (Parquet histórico)",
                                         "vínculo por núcleo do CEG com SIGA, liberações comerciais e atos de encerramento",
                                         "classificação em ordem: em implantação; operação; outorga encerrada; sem desfecho"],
                         formula="pct(desfecho) = 100 × Σ kW outorgado na primeira fotografia das usinas com o desfecho ÷ Σ kW da coorte",
                         limitacoes=lim_ralie + ["Usinas em operação parcial que seguem no RALIE contam como em implantação.",
                                                 "Sem desfecho não significa abandono: pode ser mudança de CEG, saída do acompanhamento, ato fora do conjunto de atos ou "
                                                 f"ato de revogação publicado sem núcleo nem código do CEG ({g['estagios']['encerramentos']['sem_chave_de_usina']['atos']} atos, "
                                                 f"{_milhar(g['estagios']['encerramentos']['sem_chave_de_usina']['mw_usado'] or 0, 1)} MW em 30/09/2026, quase todos de 2025 e 2026), que não se liga a nenhuma usina do RALIE."],
                         download=DOWNLOADS["trajetorias"]),
        "confiabilidade": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Confiabilidade das previsões de operação comercial em 12 meses",
                                natureza="CALCULADO", unidade="MW e %", frequencia="mensal (última fotografia do mês)",
                                periodo={"inicio": (g["cronograma"]["confiabilidade"] or [{}])[0].get("ralie"),
                                         "fim": (g["cronograma"]["confiabilidade"] or [{}])[-1].get("fim_janela")},
                                cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["liberacoes_arquivo"]},
                                transformacoes=["unidades com previsão SFG na janela (S, S + 365 dias]", "vínculo por núcleo do CEG e número da unidade com o arquivo de liberações (grupos '1 a 5' expandidos)",
                                                "unidades já liberadas antes de S excluídas do denominador"],
                                formula="pct_no_prazo(S) = 100 × Σ kW das unidades prometidas liberadas até S + 365 dias ÷ Σ kW prometido em S",
                                limitacoes=lim_ralie + ["Unidade renumerada pela fonte entre a fotografia e a liberação aparece como não liberada.",
                                                        "A data-base de cada previsão é a fotografia do RALIE; nenhuma previsão é reconstruída com o estoque atual."],
                                download=DOWNLOADS["confiabilidade"]),
        "desvio_prazo_vigente": _prov(con, DS_LIB, FONTE_LIB, indicador="Desvio da liberação comercial em relação ao prazo outorgado vigente (não é atraso com data-base)",
                                  natureza="CALCULADO", unidade="dias (mediana ponderada por kW) e %", frequencia="quinzenal segundo o dicionário",
                                  periodo={"inicio": "2014", "fim": ref["liberacoes_ultima_data"]},
                                  cobertura={"inicio": "2014", "fim": ref["liberacoes_ultima_data"]},
                                  transformacoes=["desvio = DatLiberOpComerRealizado − DatUGInicioOpComerOutorgado", "mediana ponderada pela potência liberada"],
                                  formula="mediana ponderada de (realizado − outorgado vigente) com peso MdaPotenciaLiberadaComercial",
                                  limitacoes=["Não é atraso: a data outorgada é a vigente na publicação do arquivo, sem data-base; se o cronograma foi alterado por ato posterior, o desvio é medido contra a data alterada. O que atrasou em relação a uma previsão datada está na confiabilidade das previsões.",
                                              "Em autorizações recentes (sobretudo solares) a data outorgada é um prazo limite anos à frente; liberação muito antes dela aparece como atraso negativo grande, que é antecipação em relação ao prazo, não em relação a uma previsão.",
                                              "Antes de 2014 o arquivo detalhado não cobre toda a potência liberada no ano (nota da ANEEL).",
                                              "O ano corrente é parcial."],
                                  download=DOWNLOADS["liberacoes"]),
        "leiloes": _prov(con, DS_LEILOES, FONTE_LEILOES, indicador="Leilões de transmissão por ano", natureza="CALCULADO",
                         unidade="km, MVA, R$ milhões (nominais) e %", frequencia="mensal segundo o dicionário",
                         periodo=g["transmissao"]["leiloes"]["periodo"],
                         cobertura={"inicio": "1999", "fim": ref["leiloes_transmissao"]},
                         transformacoes=["lotes sem vencedor ('SEM LANCE', 'SEM INSCRITO APTO', 'NÃO LEILOADO') separados; zeros-marcadores viram ausência",
                                         "soma por ano do leilão de km, MVA, investimento previsto e RAP dos lotes contratados", "deságio agregado pela RAP"],
                         formula="deságio(ano) = 100 × (1 − Σ RAP vencedora ÷ Σ RAP do edital), lotes com as duas",
                         limitacoes=[f"O arquivo publicado termina no leilão {g['transmissao']['leiloes']['ultimo_leilao']['leilao']} ({c.data_br(g['transmissao']['leiloes']['ultimo_leilao']['data'])}); ano sem linha aparece como ausência, não como ano sem leilão. Os contratos de concessão assinados depois disso estão em contratos_assinados (SIGET), sem RAP nem deságio.",
                                     f"{g['transmissao']['leiloes']['lotes_sem_vencedor']} lotes sem vencedor ficam fora de lotes contratados, km, MVA, investimento e RAP; o investimento e a RAP do edital deles saem à parte, como ofertados.",
                                     "Reais nominais da data de cada leilão, sem correção monetária: anos não são comparáveis em valor real.",
                                     "Investimento é o previsto no edital, não o realizado.", "km, MVA e reais são grandezas diferentes e nunca somadas."],
                         download=DOWNLOADS["leiloes"]),
        "obras": _prov(con, DS_SIGET, FONTE_SIGET, indicador="Empreendimentos de transmissão (SIGET)", natureza="CALCULADO",
                       unidade="km de circuito, MVA, empreendimentos e dias", frequencia="diária segundo o dicionário; capturado no máximo uma vez por semana",
                       periodo={"inicio": ref["siget"], "fim": ref["siget"]}, cobertura={"inicio": "2005", "fim": ref["siget"]},
                       transformacoes=["km dos módulos de linha e MVA dos transformadores de potência com obra do tipo Instalação",
                                       "prazo legal vencido = em andamento ou planejado com data de operação do ato legal anterior à data do arquivo",
                                       "atraso realizado = data efetiva − data do ato legal"],
                       formula="km novos(empreendimento) = Σ NumEtnLinTms dos módulos LT distintos com obra de Instalação",
                       limitacoes=["km de circuito: no SIGET cada circuito é um módulo de linha com a extensão da linha, então circuito duplo e bipolo contam cada circuito.",
                                   "As datas de previsão informadas pelas transmissoras não estão no arquivo aberto do SIGET: o atraso em andamento é medido contra o ato legal, não contra a previsão.",
                                   "Linha interestadual aparece nas duas UFs na tabela por UF: a soma das UFs supera o total nacional.",
                                   "Reatores e capacitores (Mvar) não entram no MVA de transformação.",
                                   "Um módulo listado em mais de um empreendimento conta uma vez, no empreendimento da obra mais antiga.",
                                   "O SIGET não tem coordenadas: o território das obras é a UF das subestações. A geometria das linhas vem do WebMap da EPE (rede_epe), sem chave comum com o SIGET; o SIGEL da ANEEL não respondeu."],
                       download=DOWNLOADS["obras"]),
        "previsoes": _prov(con, DS_RALIE, FONTE_RALIE, indicador="Previsões de operação comercial da fiscalização (atuais, próximos 24 meses e revisões entre fotografias)",
                           natureza="PREVISTO", unidade="MW, dias e %",
                           frequencia="mensal segundo o dicionário; cada previsão tem a data da fotografia (DatRalie) em que foi publicada",
                           periodo={"inicio": ref["ralie"], "fim": ref["ralie"]},
                           cobertura={"inicio": ref["ralie_historico_desde"], "fim": ref["ralie"]},
                           transformacoes=["previsão DatPrevisaoOpComercialSFG por unidade, com data-base = DatRalie da fotografia",
                                           "soma da potência unitária por ano e mês previstos", "datas em bloco marcadas e excluídas nas versões 'sem datas em bloco'"],
                           formula="MW(período previsto) = Σ MdaPotenciaUnitaria das unidades com previsão no período ÷ 1.000; deslizamento = previsão(S + 12 meses) − previsão(S)",
                           limitacoes=["Previsão da fiscalização da ANEEL, não do empreendedor nem do observatório; muda a cada fotografia.",
                                       REGRA_DATA_EM_BLOCO,
                                       "O deslizamento só contém unidades que seguem em implantação 12 meses depois (viés de sobrevivência)."],
                           download=DOWNLOADS["unidades"]),
        "contratos_transmissao": _prov(con, DS_SIGET, {**FONTE_SIGET, "recurso": "siget-contrato-agente.csv, siget-contrato-empreendimento-obra-modulo.csv"},
                                       indicador="Contratos de concessão de transmissão por data de assinatura", natureza="CALCULADO",
                                       unidade="contratos, km de circuito e MVA", frequencia="diária segundo o dicionário; capturado no máximo uma vez por semana",
                                       periodo={"inicio": ((g["transmissao"]["contratos_assinados"] or {}).get("por_ano") or [{}])[0].get("ano"),
                                                "fim": ref["siget"]},
                                       cobertura={"inicio": ((g["transmissao"]["contratos_assinados"] or {}).get("por_ano") or [{}])[0].get("ano"),
                                                  "fim": ref["siget"]},
                                       transformacoes=["DatAsnCcd do contrato", "vínculo IdeCcd com o arquivo de obras",
                                                       "km e MVA de obras de Instalação do objeto original (mesmo fim de contrato)"],
                                       formula="km(ano) = Σ NumEtnLinTms dos módulos LT de Instalação dos contratos assinados no ano (objeto original)",
                                       limitacoes=["Contrato não é leilão: pode vir de leilão, relicitação ou outra origem, e o SIGET não informa o leilão, a RAP de lance nem o deságio.",
                                                   "Contrato sem empreendimento cadastrado no SIGET tem km e MVA ausentes.",
                                                   "Reforço incorporado depois a contrato antigo, com prazo próprio, fica fora das somas."],
                                       download=DOWNLOADS["contratos"]),
        **({"rede_epe": _prov(con, DS_REDE_EPE, {"orgao": "EPE", "dataset": "WebMap da EPE: linhas de transmissão",
                                                 "recurso": "camadas 21 (Base Existente) e 10 (Expansão Planejada) do serviço SMA/WMS_Webmap_EPE",
                                                 "url_dataset": er.URL_WEBMAP, "url_primaria": er.SERVICO, "licenca": LICENCA_EPE},
                              indicador="Linhas de transmissão existentes e planejadas por UF, tensão e ano", natureza="CALCULADO",
                              unidade="km (comprimento da geometria)", frequencia="não informada pela EPE; capturado no máximo uma vez por mês",
                              # período do conteúdo: anos de operação (existente) e previstos (planejada);
                              # a data de atualização das camadas não é informada pela EPE
                              periodo={"inicio": str(g["transmissao"]["rede_epe"]["existente"]["ano_min"]),
                                       "fim": str(g["transmissao"]["rede_epe"]["planejada"]["ano_max"])},
                              cobertura={"inicio": str(g["transmissao"]["rede_epe"]["existente"]["ano_min"]),
                                         "fim": str(g["transmissao"]["rede_epe"]["planejada"]["ano_max"])},
                              transformacoes=["geometria generalizada pelo servidor (0,005 grau)", "comprimento geodésico de cada feição",
                                              "km por UF pelo ponto médio de cada segmento na malha de UF do IBGE"],
                              formula="km(UF) = Σ comprimento dos segmentos cujo ponto médio está na UF",
                              limitacoes=["O serviço não informa a data de atualização das camadas: vale a data de captura.",
                                          "O campo Extensao da camada planejada tem valores fora de escala (em metros em parte das feições): o comprimento publicado é o da geometria.",
                                          "km por feição (traçado), não km de circuito do SIGET: as duas medidas não se somam.",
                                          "Sem chave comum com o SIGET ou com os leilões: a ligação é territorial (UF), não por empreendimento."],
                              download=DOWNLOADS["rede_epe"])} if g["transmissao"].get("rede_epe") else {}),
        "cenarios": _prov(con, DS_PDE, FONTE_PDE, indicador="PDE 2035: capacidade, expansão indicativa, transmissão e geração",
                          natureza="CENARIO", unidade="GW, MW, km, MVA, R$ bilhões e TWh (por figura)", frequencia="por edição",
                          periodo={"inicio": "2025", "fim": "2035"}, cobertura={"inicio": "2025", "fim": "2035"},
                          transformacoes=["leitura das abas das figuras do caderno de dados, conferidas por título e rótulos de coluna"],
                          limitacoes=["Cenário de planejamento de uma edição (data-base janeiro de 2025), não previsão nem realizado.",
                                      "Categorias do PDE não correspondem uma a uma às do SIGA; só as correspondências diretas são mostradas lado a lado, sem diferença calculada.",
                                      "Valores monetários em reais conforme publicados pela EPE."],
                          download=DOWNLOADS["pde"]),
    }


def _linhas_e_chaves(vintage):
    """Linhas e chaves (núcleo, unidade) distintas do CSV atual de unidades do RALIE,
    relido do bronze: confere que a fonte não repete unidade (repetição seria
    sobrescrita na leitura e somaria uma vez só)."""
    if not vintage:
        return 0, 0
    linhas, chaves = 0, set()
    for r in ckan.le_csv_bronze(vintage["arquivo"]):
        linhas += 1
        chaves.add((ax.texto(r.get("IdeNucleoCEG")), ax.texto(r.get("NumUgUsina"))))
    return linhas, len(chaves)


REPRODUCAO = ("python3 pipeline/energia/executar_modulo.py expansao --sem-coleta refaz a gold a partir do silver "
              "data/energia/silver/aneel_geracao.db e do bronze (arquivos com sha256); sem --sem-coleta, coleta antes.")


def _evidencias(g, vig, siga, ralie_ug, desf, conf_bruta, emp_siget, lotes, pde_obs):
    """Fichas "Comprove este número" dos números de destaque, montadas e validadas por
    pipeline/energia/evidencia.py (a construção falha alto se a ficha não comprova o
    número: sem arquivo com sha256, sem teste, sem download, ausência exibida como
    número). O valor de cálculo é o bruto, antes do arredondamento da gold."""
    ref = g["referencias"]
    prov = g["proveniencia"]
    v_siga = vig[DS_SIGA].get("siga-empreendimentos-geracao-diario.csv")
    v_ug_atual = vig[DS_RALIE].get("ralie-unidade-geradora-atual.csv")
    v_ug = vig[DS_RALIE].get("ralie-unidade-geradora-historico.parquet")
    v_us = vig[DS_RALIE].get("ralie-usina-historico.parquet")
    v_lib = vig[DS_LIB].get("unidades-geradoras-liberadas-operacao-comercial-detalhado.csv")
    v_atos = vig[DS_ATOS].get("atos-outorgas-aneel.csv")
    v_lei = vig[DS_LEILOES].get("resultado-leiloes-transmissao.csv")
    v_siget = vig[DS_SIGET].get("siget-contrato-empreendimento-obra-modulo.csv")
    v_lt = vig[DS_SIGET].get("siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv")
    v_pde = vig[DS_PDE].get("pde2035_dados_relatorio_final.zip")
    usinas_csv = {"rotulo": "Usinas do SIGA com fase, potência e coordenadas (CSV)", "url": DOWNLOADS["usinas"]}
    out = {}

    # ---- capacidade instalada em operação (SIGA)
    cap = g["capacidade_instalada"]
    rec = cap["reconciliacao"]
    op = [u for u in siga.values() if u.get("fase") == "Operação"]
    kw_op = sum(u.get("kw_fiscalizado") or 0 for u in op)
    fora = rec["fora_da_tolerancia"]["tipos"]
    negativas = sum(1 for u in siga.values() if (u.get("kw_fiscalizado") or 0) < 0 or (u.get("kw_outorgado") or 0) < 0)
    out["capacidade_total"] = ev.construir(
        indicador="Capacidade instalada em operação", valor_exibido=f"{_milhar(kw_op / 1000)} MW",
        valor_calculo=kw_op / 1000, unidade="MW", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
        entidade="Brasil (Sistema Interligado e sistemas isolados)",
        universo=f"{_milhar(len(op))} usinas na fase Operação do SIGA",
        fonte=ev.fonte_de_vintage("ANEEL", FONTE_SIGA["dataset"], URL_SIGA, v_siga),
        consulta="linhas de siga-empreendimentos-geracao-diario.csv com DscFaseUsina = Operação, uma por IdeNucleoCEG; soma de MdaPotenciaFiscalizadaKw",
        manifesto=usinas_csv, filtros=["DscFaseUsina = Operação"],
        formula="Σ MdaPotenciaFiscalizadaKw das usinas em operação ÷ 1.000",
        cobertura="todas as usinas na fase Operação do arquivo diário do SIGA",
        tratamento_ausencia="potência vazia não soma e não vira zero exibido; núcleo de CEG repetido na fonte conta uma vez",
        revisoes=prov["capacidade"]["revisoes_conhecidas"],
        testes=[ev.teste("potência não negativa", "aprovado" if not negativas else "reprovado",
                         f"{negativas} usinas com potência negativa no arquivo"),
                ev.teste("reconciliação por tipo com o agregado 'empreendimentos em operação'",
                         "aprovado" if not fora else "ressalva",
                         f"{len(rec['por_tipo']) - len(fora)} de {len(rec['por_tipo'])} tipos com resíduo dentro de {TOLERANCIA_RESIDUO_PCT:g}%"
                         + (f"; fora: {', '.join(fora)}" if fora else ""))],
        reconciliacao=ev.reconciliacao(
            f"SIGA menos o agregado oficial por tipo de {rec['referencia_tipo']} menos as liberações comerciais entre o fim desse mês e a data do SIGA",
            "aprovado" if not fora else "ressalva", f"{TOLERANCIA_RESIDUO_PCT:g}% do agregado de cada tipo (MW)"),
        download=[usinas_csv, {"rotulo": "Capacidade em operação por UF, tipo e origem (CSV)", "url": DOWNLOADS["capacidade_uf"]}],
        reproducao=REPRODUCAO)

    # ---- outorgado com construção não iniciada (SIGA)
    nao = [u for u in siga.values() if u.get("fase") == "Construção não iniciada"]
    kw_nao = sum(u.get("kw_outorgado") or 0 for u in nao)
    n_fases = sum(x["usinas"] for x in g["estagios"]["resumo"])
    out["outorgado_sem_obra"] = ev.construir(
        indicador="Potência outorgada com construção não iniciada", valor_exibido=f"{_milhar(kw_nao / 1000)} MW",
        valor_calculo=kw_nao / 1000, unidade="MW", periodo={"inicio": ref["siga"], "fim": ref["siga"]},
        entidade="Brasil", universo=f"{_milhar(len(nao))} usinas na fase Construção não iniciada do SIGA",
        fonte=ev.fonte_de_vintage("ANEEL", FONTE_SIGA["dataset"], URL_SIGA, v_siga),
        consulta="linhas do SIGA com DscFaseUsina = Construção não iniciada; soma de MdaPotenciaOutorgadaKw",
        manifesto=usinas_csv, filtros=["DscFaseUsina = Construção não iniciada"],
        formula="Σ MdaPotenciaOutorgadaKw das usinas com construção não iniciada ÷ 1.000",
        cobertura="todas as usinas da fase no arquivo diário do SIGA",
        tratamento_ausencia="potência vazia não soma",
        revisoes=prov["estagios"]["revisoes_conhecidas"],
        testes=[ev.teste("estágios disjuntos e exaustivos", "aprovado" if n_fases == len(siga) else "reprovado",
                         f"{_milhar(n_fases)} usinas somadas nos estágios para {_milhar(len(siga))} núcleos de CEG no SIGA; outorga sem obra nunca entra na capacidade em operação"),
                ev.teste("outorga não é entrada certa", "aprovado", "o desfecho das usinas do RALIE desde 2021 é publicado ao lado (coortes)")],
        download=[usinas_csv], reproducao=REPRODUCAO)

    # ---- carteira em implantação (RALIE atual, potência por unidade geradora)
    kw_ralie = sum(x.get("kw") or 0 for x in ralie_ug.values())
    usinas_ralie = {k.split(":")[0] for k in ralie_ug}
    linhas_ug, chaves_ug = _linhas_e_chaves(v_ug_atual)
    out["ralie_em_implantacao"] = ev.construir(
        indicador="Potência das unidades geradoras em implantação acompanhadas pelo RALIE",
        valor_exibido=f"{_milhar(kw_ralie / 1000)} MW", valor_calculo=kw_ralie / 1000, unidade="MW",
        periodo={"inicio": ref["ralie"], "fim": ref["ralie"]}, entidade="Brasil",
        universo=f"{_milhar(len(ralie_ug))} unidades geradoras de {_milhar(len(usinas_ralie))} usinas na fotografia de {c.data_br(ref['ralie'])}",
        fonte=ev.fonte_de_vintage("ANEEL", FONTE_RALIE["dataset"], URL_RALIE, v_ug_atual),
        consulta="linhas de ralie-unidade-geradora-atual.csv (uma por IdeNucleoCEG e NumUgUsina); soma de MdaPotenciaUnitaria",
        manifesto={"rotulo": "Unidades geradoras do RALIE com previsão (CSV)", "url": DOWNLOADS["unidades"]},
        formula="Σ MdaPotenciaUnitaria das unidades listadas ÷ 1.000",
        cobertura="usinas em implantação acompanhadas pela fiscalização; unidades já liberadas para operação comercial deixam o relatório",
        tratamento_ausencia="unidade sem potência não soma; unidade sem previsão da fiscalização é contada à parte, com a justificativa publicada",
        revisoes=prov["ralie"]["revisoes_conhecidas"],
        testes=[ev.teste("chave única por unidade", "aprovado" if linhas_ug == chaves_ug else "ressalva",
                         f"{_milhar(linhas_ug)} linhas no arquivo e {_milhar(chaves_ug)} chaves (IdeNucleoCEG, NumUgUsina) distintas"),
                ev.teste("potência não negativa", "aprovado" if all((x.get("kw") or 0) >= 0 for x in ralie_ug.values()) else "reprovado",
                         "potência unitária de todas as unidades conferida")],
        reconciliacao=ev.reconciliacao(
            f"mesma fotografia no Parquet histórico (recurso independente): {_milhar(g['conferencias']['ralie_csv_x_parquet']['ugs_iguais'])} de "
            f"{_milhar(g['conferencias']['ralie_csv_x_parquet']['ugs_csv'])} unidades com potência e previsão idênticas",
            "aprovado" if g["conferencias"]["ralie_csv_x_parquet"]["resultado"] == "aprovada" else "reprovado",
            "0 kW e 0 dia por unidade (mesmo registro nos dois recursos)"),
        download=[{"rotulo": "Unidades geradoras do RALIE (CSV)", "url": DOWNLOADS["unidades"]},
                  {"rotulo": "Carteira do RALIE por usina (CSV)", "url": DOWNLOADS["carteira"]}],
        reproducao=REPRODUCAO)

    # ---- desfecho da coorte inicial do RALIE
    prim = ref["ralie_historico_desde"]
    coorte = [x for x in desf.values() if x["primeira"] == prim]
    kw_coorte = sum(x.get("kw_primeira") or 0 for x in coorte)
    kw_op_coorte = sum(x.get("kw_primeira") or 0 for x in coorte if x["desfecho"] == "operacao")
    if kw_coorte:
        pct = 100 * kw_op_coorte / kw_coorte
        soma_desf = sum(sum(x.get("kw_primeira") or 0 for x in coorte if x["desfecho"] == d) for d in DESFECHOS)
        out["coorte_inicial_operacao"] = ev.construir(
            indicador="Potência da primeira fotografia do RALIE que entrou em operação",
            valor_exibido=f"{_milhar(pct, 1)}%", valor_calculo=pct, unidade="% do MW outorgado",
            periodo={"inicio": prim, "fim": ref["ralie"]}, entidade="usinas presentes na primeira fotografia do RALIE",
            universo=f"{_milhar(len(coorte))} usinas, {_milhar(kw_coorte / 1000)} MW outorgados em {c.data_br(prim)}",
            fonte={**ev.fonte_de_vintage("ANEEL", FONTE_RALIE["dataset"], URL_RALIE, v_ug),
                   "arquivos": [ev.arquivo_de_vintage(v) for v in (v_us, v_ug, v_lib, v_atos, v_siga) if v]},
            consulta="usinas do Parquet histórico cuja primeira DatRalie é a primeira fotografia publicada; desfecho pelo núcleo do CEG no SIGA, nas liberações comerciais e nos atos de encerramento",
            manifesto={"rotulo": "Trajetória e desfecho das usinas do RALIE (CSV)", "url": DOWNLOADS["trajetorias"]},
            formula="100 × Σ kW outorgado na primeira fotografia das usinas com desfecho operação ÷ Σ kW outorgado da coorte",
            numerador={"descricao": "kW outorgado das usinas da coorte que entraram em operação", "valor": kw_op_coorte},
            denominador={"descricao": "kW outorgado de toda a coorte na primeira fotografia", "valor": kw_coorte},
            cobertura="todas as usinas da primeira fotografia (17/06/2021 ou a primeira publicada)",
            tratamento_ausencia="usina sem operação nem ato de encerramento fica em 'sem desfecho', nunca em operação",
            revisoes=prov["coortes"]["revisoes_conhecidas"],
            testes=[ev.teste("desfechos exaustivos e disjuntos", "aprovado" if abs(soma_desf - kw_coorte) < 1e-6 else "reprovado",
                             f"soma dos quatro desfechos {_milhar(soma_desf / 1000, 1)} MW para {_milhar(kw_coorte / 1000, 1)} MW da coorte")],
            download=[{"rotulo": "Trajetórias (CSV)", "url": DOWNLOADS["trajetorias"]}], reproducao=REPRODUCAO)

    # ---- confiabilidade da última janela encerrada
    if conf_bruta:
        u = conf_bruta[-1]
        particao = max(abs(x["kw_no_prazo"] + x["kw_depois"] + x["kw_nao_liberado"] - x["kw_prometido"]) for x in conf_bruta)
        pct = 100 * u["kw_no_prazo"] / u["kw_prometido"] if u["kw_prometido"] else None
        out["confiabilidade_ultima"] = ev.construir(
            indicador="Potência prometida para os 12 meses seguintes que foi liberada no prazo",
            valor_exibido=None if pct is None else f"{_milhar(pct, 1)}%", valor_calculo=pct, unidade="% do MW prometido",
            periodo={"inicio": u["ralie"], "fim": u["fim_janela"]},
            entidade="unidades geradoras com previsão da fiscalização dentro da janela",
            universo=f"{_milhar(u['ugs'])} unidades, {_milhar(u['kw_prometido'] / 1000)} MW, fotografia de {c.data_br(u['ralie'])}",
            fonte={**ev.fonte_de_vintage("ANEEL", FONTE_RALIE["dataset"], URL_RALIE, v_ug),
                   "arquivos": [ev.arquivo_de_vintage(v) for v in (v_ug, v_lib) if v]},
            consulta=f"unidades da fotografia {u['ralie']} com DatPrevisaoOpComercialSFG em ({u['ralie']}, {u['fim_janela']}]; liberação pela chave (IdeNucleoCEG, NumUgUsina) no arquivo detalhado",
            manifesto={"rotulo": "Confiabilidade por fotografia (CSV)", "url": DOWNLOADS["confiabilidade"]},
            formula="100 × Σ kW das unidades prometidas e liberadas até o fim da janela ÷ Σ kW prometido na fotografia",
            numerador={"descricao": "kW liberado para operação comercial até o fim da janela", "valor": u["kw_no_prazo"]},
            denominador={"descricao": "kW com previsão dentro da janela na fotografia", "valor": u["kw_prometido"]},
            exclusoes=[f"{u['ugs_excluidas_ja_liberadas']} unidades já liberadas antes da fotografia e ainda listadas com previsão futura"],
            cobertura=f"janela encerrada pelo menos 15 dias antes da data do arquivo de liberações ({c.data_br(ref['liberacoes_arquivo'])})",
            tratamento_ausencia="unidade sem liberação no arquivo conta como não liberada; nenhuma previsão é reconstruída com o estoque atual",
            revisoes=prov["confiabilidade"]["revisoes_conhecidas"],
            testes=[ev.teste("partição da potência prometida", "aprovado" if particao < 1e-3 else "reprovado",
                             f"no prazo + depois do prazo + não liberada = prometida em {len(conf_bruta)} fotografias (maior diferença {particao:.6f} kW)"),
                    ev.teste("data-base conhecida", "aprovado", "cada previsão é lida da fotografia DatRalie em que foi publicada")],
            download=[{"rotulo": "Confiabilidade das previsões (CSV)", "url": DOWNLOADS["confiabilidade"]}], reproducao=REPRODUCAO)

    # ---- transmissão em andamento (SIGET)
    anda = [x for x in emp_siget if x["situacao"] == "Em andamento"]
    km_anda = sum(x["km_lt"] for x in anda)
    lts_fora = g["transmissao"]["obras"]["modulos_lt_fora_do_limite"]
    obras_csv = {"rotulo": "Empreendimentos de transmissão do SIGET (CSV)", "url": DOWNLOADS["obras"]}
    out["transmissao_em_andamento"] = ev.construir(
        indicador="Linhas de transmissão novas em empreendimentos em andamento", valor_exibido=f"{_milhar(km_anda)} km",
        valor_calculo=km_anda, unidade="km de circuito", periodo={"inicio": ref["siget"], "fim": ref["siget"]},
        entidade="Rede Básica e demais instalações cadastradas no SIGET",
        universo=f"{_milhar(len(anda))} empreendimentos com situação Em andamento",
        fonte={**ev.fonte_de_vintage("ANEEL", FONTE_SIGET["dataset"], URL_SIGET, v_siget),
               "arquivos": [ev.arquivo_de_vintage(v) for v in (v_siget, v_lt) if v]},
        consulta="módulos de linha (SigTipMdl = LT) distintos de obras do tipo Instalação em empreendimentos Em andamento; extensão NumEtnLinTms do arquivo de módulos de linha",
        manifesto=obras_csv, filtros=["DscSituacaoEpd = Em andamento", "DscTipObr = Instalação"],
        formula="Σ NumEtnLinTms dos módulos de linha distintos (um por circuito)",
        cobertura="empreendimentos de transmissão com contrato no SIGET",
        tratamento_ausencia="módulo sem extensão informada não soma; MVA e km nunca são somados entre si",
        revisoes=prov["obras"]["revisoes_conhecidas"],
        testes=[ev.teste("extensão física", "aprovado" if not lts_fora else "ressalva",
                         f"{lts_fora} módulos de linha com extensão negativa ou acima de {LIMITE_KM_CIRCUITO:,} km".replace(",", ".")),
                ev.teste("grandezas separadas", "aprovado", "km, MVA e reais em campos distintos; nenhuma soma entre eles")],
        download=[obras_csv], reproducao=REPRODUCAO)

    # ---- leilões de transmissão do último ano com leilão no arquivo
    lei = g["transmissao"]["leiloes"]["por_ano"]
    if lei:
        u = lei[-1]
        do_ano = sorted((k, x) for k, x in lotes.items() if (x.get("ano") or (x.get("data") or "")[:4]) == u["ano"])
        contratados = [(k, x) for k, x in do_ano if not ax.lote_sem_vencedor(x.get("vencedor"))]
        km_ano = sum(x.get("km") or 0 for _, x in contratados)
        out["leiloes_ultimo_ano"] = ev.construir(
            indicador="Extensão de linhas contratadas em leilão no ano", valor_exibido=f"{_milhar(km_ano)} km", valor_calculo=km_ano,
            unidade="km", periodo={"inicio": f"{u['ano']}-01-01", "fim": f"{u['ano']}-12-31"},
            entidade="lotes de transmissão contratados em leilão no ano",
            universo=f"{u['lotes_contratados']} lotes contratados de {u['lotes_ofertados']} ofertados",
            fonte=ev.fonte_de_vintage("ANEEL", FONTE_LEILOES["dataset"], URL_LEILOES, v_lei),
            chaves_origem=[f"leilão {x.get('leilao')}, lote {x.get('lote')}" for _, x in contratados],
            formula="Σ MdaExtensaoLinhaTransmissaoKm dos lotes contratados do ano",
            exclusoes=[f"{u['lotes_sem_vencedor']} lotes sem vencedor no ano (SEM LANCE, SEM INSCRITO APTO ou NÃO LEILOADO)"],
            cobertura=f"leilões de transmissão desde 1999; o arquivo termina no leilão {g['transmissao']['leiloes']['ultimo_leilao']['leilao']}",
            tratamento_ausencia="lote contratado sem linha descrita tem 0 km real e soma 0; 0 km com linha descrita é campo não preenchido e fica fora; em lote sem vencedor o 0 é marcador e fica fora; ano sem linha no arquivo é ausência, não zero",
            revisoes=prov["leiloes"]["revisoes_conhecidas"],
            testes=[ev.teste("deságio publicado confere com a RAP", "aprovado" if not g["transmissao"]["leiloes"]["desagio_inconsistente_total"] else "ressalva",
                             f"{g['transmissao']['leiloes']['desagio_inconsistente_total']} de {g['transmissao']['leiloes']['lotes']} lotes com deságio publicado diferente de 1 − RAP vencedora ÷ RAP do edital (tolerância 0,6 ponto percentual)"),
                    ev.teste("grandezas separadas", "aprovado", "km, MVA, investimento e RAP em campos distintos")],
            download=[{"rotulo": "Leilões de transmissão por lote (CSV)", "url": DOWNLOADS["leiloes"]}],
            reproducao=REPRODUCAO)

    # ---- PDE 2035: capacidade total em 2035 (CENÁRIO)
    serie = {s.split(".", 2)[2]: dict(p) for s, p in pde_obs.items() if s.startswith("pde2035.fig_3_25.")}
    tot35 = sum(v.get("2035-12") or 0 for v in serie.values()) if serie else None
    conf_pde = g["cenarios"]["conferencia_relatorio"]
    if tot35:
        out["pde_capacidade_2035"] = ev.construir(
            indicador="Capacidade instalada nacional em 2035 no Cenário de Referência do PDE 2035 (CENÁRIO)",
            valor_exibido=f"{_milhar(tot35)} GW", valor_calculo=tot35, unidade="GW",
            periodo={"inicio": "2035-12", "fim": "2035-12"},
            entidade="matriz elétrica nacional (inclui MMGD, baterias e resposta da demanda)",
            universo="categorias da Figura 3-25 do PDE 2035",
            fonte=ev.fonte_de_vintage("EPE", FONTE_PDE["dataset"], URL_PDE_DADOS, v_pde),
            chaves_origem=[f"planilha do Capítulo 03, aba Figura 3-25, linha 2035-12, coluna {k}" for k in sorted(serie)],
            formula="Σ das categorias da Figura 3-25 em dezembro de 2035",
            cobertura="edição PDE 2035 (data-base das premissas janeiro de 2025)",
            tratamento_ausencia="célula vazia não soma",
            revisoes="Edição fixa aprovada: o caderno de dados é recapturado mensalmente e uma mudança de sha256 fica registrada como nova vintage.",
            testes=[ev.teste("colunas conferidas", "aprovado", "título da aba e rótulos das colunas conferidos antes da leitura")],
            reconciliacao=ev.reconciliacao(
                "total rotulado na Figura 3-25 do relatório final (359 GW em 2035, p. 97)",
                "aprovado" if all(x["resultado"] == "aprovada" for x in conf_pde) else "reprovado",
                "0,5 GW (o relatório rotula o total em GW inteiros)"),
            download=[{"rotulo": "PDE 2035: figuras usadas (CSV)", "url": DOWNLOADS["pde"]}],
            reproducao=REPRODUCAO)
    return out
