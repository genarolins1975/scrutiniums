"""Módulo Transição e ambiente: MMGD no território (P063) e fatores de emissão do SIN (P064).

Gold: public/energia/gold/transicao.json; detalhe em public/energia/series/transicao_*.csv
e transicao_municipios.json (carregado sob demanda pelo mapa). Método, fontes verificadas,
conferências e limitações em docs/observatorios/energia/modulos/transicao.md.

Fontes e por que cada uma:
- ANEEL, Relação de empreendimentos de MMGD (Parquet oficial, equivalente ao CSV do
  mesmo conjunto; conferidos um contra o outro em 30/09/2026): cadastro regulatório de
  cada micro e minigeração conectada, com município IBGE, distribuidora (CNPJ), classe,
  modalidade, fonte, potência instalada e data de conexão. É CAPACIDADE cadastrada.
- ANEEL, Informações técnicas fotovoltaicas (mesmo conjunto): só para conferir que a data
  do registro é a data de conexão (controle semântico).
- ONS, Carga de Energia Verificada (API): parcela da carga atendida por MMGD, uma
  ESTIMATIVA operacional do ONS. É energia estimada, não cadastro; as duas grandezas
  são publicadas lado a lado e nunca somadas.
- ONS, Balanço de Energia nos Subsistemas (silver principal, só leitura): solar do SIN em
  torno de 29/04/2023, para a conferência do achado A11 com números do dado.
- IBGE, Estimativas de população (SIDRA 6579): denominador por habitante; relaciona o
  território sem inferir renda de nenhum beneficiário.
- MCTI, fatores de emissão de CO2 do SIN: fator médio (inventários) e fatores de margem
  do MDL, em séries separadas, lidos das planilhas visíveis na página vigente do MCTI
  (2006 até o último mês publicado). A página às vezes responde com desafio de verificação
  humana: a tentativa fica registrada, o desafio não é contornado e vale a última captura
  válida. O site institucional anterior do MCTI (2006 a 2021) é recolhido para comparação
  (divergências publicadas) e só preenche período sem valor na página vigente; capturas
  depositadas por pessoa entram pelo mesmo caminho, com manifesto e sha256.
"""
import gzip
import json
import os
import shutil
import sys
import tempfile
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_transicao as mmgd  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import mcti_transicao as mcti  # noqa: E402
from pipeline.energia.fontes import ons_transicao as ons  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "transicao.json"
FAMILIA = "aneel_mmgd"
SITE = "https://scrutiniums.com/setor-eletrico/transicao"
PAGINA = {"rotulo": "Transição e ambiente", "href": "/setor-eletrico/transicao"}

DS_MMGD = "aneel_mmgd_empreendimentos"
DS_FV = "aneel_mmgd_tecnico_fv"
DS_DIST = "aneel_mmgd_distribuidoras"      # registros: CNPJ → sigla e nome como a fonte publica
DS_CONTROLE = "aneel_mmgd_controle"        # registros: marca de importação de cada vintage
DS_ONS = "ons_carga_verificada_mmgd"
DS_MCTI = "mcti_fator_emissao"
DS_MCTI_META = "mcti_fator_emissao_meta"   # registros: notas, revisões declaradas, descartes
DS_IBGE = "ibge_populacao_6579"
DS_IBGE_MUN = "ibge_municipios"            # registros: código IBGE → nome e UF
DS_BAL = "balanco_energia_subsistema_ho"   # silver principal, só leitura
# Área de atuação das distribuidoras pelos conjuntos elétricos (só para sinalizar unidades
# com município fora da área da distribuidora; nomes próprios para não dividir o bronze
# com o módulo de perdas, que baixa os mesmos arquivos para outro fim)
DS_AREA_LIM = "aneel_mmgd_ref_conjuntos_limite"
DS_AREA_MUN = "aneel_mmgd_ref_conjuntos_municipio"
PACOTE_LIM = "indicadores-coletivos-de-continuidade-dec-e-fec"
RECURSO_LIM = "indicadores-continuidade-coletivos-limite"
PACOTE_MUN = "indqual-municipio"
RECURSO_MUN = "indqual-municipio"
URL_LIM = f"https://dadosabertos.aneel.gov.br/dataset/{PACOTE_LIM}"
URL_MUN = f"https://dadosabertos.aneel.gov.br/dataset/{PACOTE_MUN}"

PACOTE_MMGD = "relacao-de-empreendimentos-de-geracao-distribuida"
URL_MMGD = "https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida"
RECURSO_PARQUET = "empreendimento-geracao-distribuida.parquet"
RECURSO_FV = "empreendimento-gd-informacoes-tecnicas-fotovoltaica.parquet"
URL_SIDRA = "https://apisidra.ibge.gov.br/values/t/6579/n1/all/n3/all/n6/all/v/9324/p/last%201"
URL_TABELA_SIDRA = "https://sidra.ibge.gov.br/tabela/6579"
SEED_MCTI = os.path.join(base.SEED, "mcti_fatores_emissao")

LICENCA_ANEEL = "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da ANEEL"
LICENCA_IBGE = "Uso livre com citação da fonte (IBGE)"
LICENCA_MCTI = ("Informação pública de órgão federal (Lei 12.527/2011), sem licença específica declarada na página; "
                "citar o MCTI como fonte")

# Política de recoleta. O arquivo da ANEEL é regerado todo dia (last_modified muda a cada
# dia), então a regra do coletor CKAN (baixar quando a publicação muda) baixaria 216 MB e
# criaria duas vintages por dia no bronze. O dicionário declara frequência mensal: a
# relação é recoletada quando a última captura bem-sucedida tem 30 dias ou mais, e o
# recurso técnico fotovoltaico (só para o controle da data de conexão) a cada 90 dias.
MAX_IDADE_MMGD = 30
MAX_IDADE_FV = 90
MAX_IDADE_MCTI = 30
MAX_IDADE_IBGE = 30
MAX_IDADE_AREA = 90   # conjuntos elétricos mudam pouco; só sinalizam, não entram em soma
# Versão do que a importação da relação de MMGD extrai do arquivo. Uma vintage importada
# com versão anterior é importada de novo (os valores que não mudaram não geram linha
# nova no silver; séries novas entram com a mesma vintage). 2: distribuidora × município,
# datas de conexão mínima e máxima e período de referência do arquivo. 3: agregado
# distribuidora × município × prefixo do CEP × UF do código × UF publicada (classes das
# unidades fora da área) e contagem de unidades sem potência por agregado (qtd_sem_kw.*).
VERSAO_IMPORTACAO_MMGD = "3"
# Versão da leitura das planilhas do MCTI (revisões declaradas, descartes e problemas de
# leitura). 2: valores diários da publicação anterior e rótulo contraditório de 2020.
VERSAO_LEITURA_MCTI = "2"
ONS_MESES_RECENTES = 3        # meses recoletados a cada execução (dado em consistência)
ONS_IDADE_RECENTES_H = 20
ONS_IDADE_ANTIGOS_D = 30      # o ONS revisa o histórico: recoleta mensal dos meses antigos
PAUSA_S = 0.2

# Meses anteriores à data do conjunto marcados como provisórios: uma conexão só aparece
# quando a distribuidora a envia ao sistema da ANEEL, então os meses recentes ainda podem
# crescer nas capturas seguintes. A ANEEL avisa de inserção mais lenta após a migração de
# sistema de 2025 (nota do conjunto), mas nenhuma nota explica a queda dos meses finais de
# cada arquivo; a magnitude é medida pelas revisões entre capturas (mmgd.revisoes).
MESES_PROVISORIOS = 6
# Ranking por habitante só entre municípios com população estimada de pelo menos 100 mil:
# com denominador pequeno, uma única usina de minigeração domina a razão.
POP_MINIMA_RANKING = 100_000
QUEBRA_ONS = "2023-04-29"
DOC_ONS_BALANCO = {
    "orgao": "ONS",
    "titulo": "Energia Agora: Balanço de Energia (texto de apresentação da página)",
    "url": "https://www.ons.org.br/paginas/energia-agora/balanco-de-energia",
    "consultado_em": "2026-09-30",
    "trecho": ("A partir de 29/04/2023, o valor estimado da micro e minigeração distribuída (MMGD) também passou a "
               "incorporar os dados de geração e carga apresentados nesta página."),
}
DOC_ONS_DICIONARIO = {
    "orgao": "ONS",
    "titulo": "Dicionário de dados da Carga Verificada, versão 1.1 de 30/10/2023 (DicionarioDados_Carga_Verificada.pdf)",
    "url": ons.URL_DICIONARIO,
    "consultado_em": "2026-10-01",
    "trecho": ("Dados de carga verificada na periodicidade semi-horária por área de carga e suas componentes de parcela supervisionada "
               "pelo ONS, parcela proveniente dos dados de medição (geração tipo I, IIA, IIB, IIC e intercâmbios), parcela proveniente "
               "do sistema de medição para faturamento da CCEE (geração tipo III), parcela atendida por micro e mini geração "
               "distribuída (MMGD), parcela atendida por redução de demanda, e os valores das consistências feitas para os modelos "
               "de previsão, quando ocorrerem. [...] Valor da Carga atendida por MMGD em MWmed integralizada no final do intervalo "
               "da semi-hora (val_cargammgd)."),
}
DOC_ONS_PMO = {
    "orgao": "ONS",
    "titulo": "Notícia de 28/04/2023: Projeções do PMO passam a incorporar a carga da MMGD",
    "url": "https://www.ons.org.br/Paginas/Noticias/20230428-Proje%C3%A7%C3%B5es-do-PMO-passam-a-incorporar-a-carga-da-MMGD.aspx",
    "consultado_em": "2026-09-30",
    "trecho": ("O boletim do Programa Mensal de Operação (PMO), a partir da semana operativa entre os dias 29 de abril e "
               "05 de maio, passa a incorporar, nas análises de carga, os montantes de geração da Micro e Minigeração "
               "Distribuída (MMGD)."),
}

SERIES_AGREGADAS = ("mun_ano_fonte", "uf_mes_fonte", "dist_uf_ano", "classe_ano", "modalidade_ano", "porte_ano",
                    "tipo_consumidor_ano", "fonte_detalhe_ano")

FONTE_ANEEL = {"orgao": "ANEEL", "dataset": "Relação de empreendimentos de Mini e Micro Geração Distribuída",
               "recurso": f"{RECURSO_PARQUET} (Parquet oficial; o CSV do mesmo conjunto tem o mesmo conteúdo)",
               "url_dataset": URL_MMGD, "url_primaria": URL_MMGD, "licenca": LICENCA_ANEEL}
FONTE_ONS = {"orgao": "ONS", "dataset": "Carga de Energia Verificada",
             "recurso": "API cargaverificada (val_cargammgd, val_cargaglobal, val_cargaglobalsmmgd), áreas SECO, S, NE e N",
             "url_dataset": ons.URL_DATASET, "url_primaria": ons.URL_API, "licenca": c.LICENCA_ONS}
FONTE_IBGE = {"orgao": "IBGE", "dataset": "Estimativas de população (tabela SIDRA 6579)",
              "recurso": "variável 9324, População residente estimada, municípios, UF e Brasil, último ano",
              "url_dataset": URL_TABELA_SIDRA, "url_primaria": URL_SIDRA, "licenca": LICENCA_IBGE}
FONTE_MCTI = {"orgao": "MCTI", "dataset": "Fatores de emissão de CO2 pela geração de energia elétrica no SIN",
              "recurso": "planilhas de inventário (fator médio) e de análise de despacho (MDL), e tabela do método simples ajustado",
              "url_dataset": mcti.URL_PAGINA_ATUAL, "url_primaria": mcti.URL_PAGINA_ATUAL, "licenca": LICENCA_MCTI}

REGISTRO = {
    "id": "transicao",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 31,
    "datasets": [
        {"orgao": "ANEEL", "nome": PACOTE_MMGD, "slug": "aneel-mmgd-empreendimentos", "dataset_silver": DS_MMGD,
         "titulo": "Relação de empreendimentos de Mini e Micro Geração Distribuída", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_MMGD, "licenca": LICENCA_ANEEL, "tema": "distribuicao",
         "descricao": "Cadastro de cada micro e minigeração distribuída conectada: município, distribuidora, classe, modalidade, fonte, potência instalada e data de conexão.",
         "paginas": [PAGINA],
         "downloads": ["/energia/series/transicao_mmgd_municipio_ano_fonte.csv", "/energia/series/transicao_mmgd_municipios.csv",
                       "/energia/series/transicao_mmgd_uf_mes_fonte.csv", "/energia/series/transicao_mmgd_distribuidoras.csv",
                       "/energia/series/transicao_mmgd_perfil.csv"],
         "quebras": [{"data": "2025-09-23", "origem": "FONTE",
                      "descricao": "Atualização suspensa de 23/09/2025 a 13/11/2025 na migração do SISGD para o sistema MMGD; a ANEEL avisa de inserção mais lenta nos meses seguintes."}]},
        {"orgao": "ONS", "nome": "carga-energia-verificada", "slug": "ons-carga-verificada-mmgd", "dataset_silver": DS_ONS,
         "titulo": "Carga de Energia Verificada: parcela atendida por MMGD (API)", "estado": "UTILIZADO EM INDICADOR",
         "url": ons.URL_DATASET, "licenca": c.LICENCA_ONS, "tema": "carga",
         "descricao": "Carga semi-horária por área de carga com a parcela atendida por MMGD estimada pelo ONS; usada por submercado.",
         "paginas": [PAGINA], "downloads": ["/energia/series/transicao_ons_mmgd_diario.csv", "/energia/series/transicao_ons_mmgd_mensal.csv"],
         "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-6579", "slug": "ibge-populacao-estimada-6579", "dataset_silver": DS_IBGE,
         "titulo": "Estimativas de população residente (SIDRA 6579)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_TABELA_SIDRA, "licenca": LICENCA_IBGE, "tema": "contexto",
         "descricao": "População residente estimada por município, usada como denominador por habitante.",
         "paginas": [PAGINA], "downloads": ["/energia/series/transicao_mmgd_municipios.csv"], "quebras": []},
        {"orgao": "ANEEL", "nome": PACOTE_LIM, "slug": "aneel-conjuntos-limite-area-mmgd", "dataset_silver": DS_AREA_LIM,
         "titulo": "Indicadores coletivos de continuidade: limites por conjunto (CNPJ da distribuidora × conjunto elétrico)",
         "estado": "UTILIZADO EM VALIDAÇÃO", "url": URL_LIM, "licenca": LICENCA_ANEEL, "tema": "distribuicao",
         "descricao": "Liga cada conjunto elétrico ao CNPJ da distribuidora; com o indqual-municipio, dá as UFs atendidas por cada CNPJ para sinalizar unidades de MMGD cadastradas fora da área da distribuidora.",
         "paginas": [PAGINA], "downloads": ["/energia/series/transicao_mmgd_municipios.csv", "/energia/series/transicao_mmgd_distribuidoras.csv"],
         "quebras": []},
        {"orgao": "ANEEL", "nome": PACOTE_MUN, "slug": "aneel-indqual-municipio-area-mmgd", "dataset_silver": DS_AREA_MUN,
         "titulo": "IndQual Município: municípios de cada conjunto elétrico", "estado": "UTILIZADO EM VALIDAÇÃO",
         "url": URL_MUN, "licenca": LICENCA_ANEEL, "tema": "distribuicao",
         "descricao": "Liga cada conjunto elétrico aos municípios IBGE que ele atende; usado com os limites de continuidade para a área de cada distribuidora.",
         "paginas": [PAGINA], "downloads": ["/energia/series/transicao_mmgd_municipios.csv"], "quebras": []},
        {"orgao": "MCTI", "nome": "fatores-de-emissao-sin", "slug": "mcti-fatores-emissao-sin", "dataset_silver": DS_MCTI,
         "titulo": "Fatores de emissão de CO2 da geração de energia elétrica no SIN", "estado": "UTILIZADO EM INDICADOR",
         "url": mcti.URL_PAGINA_ATUAL, "licenca": LICENCA_MCTI, "tema": "ambiente",
         "descricao": "Fator médio mensal e anual para inventários e fatores de margem de operação e de construção para projetos de MDL, em tCO2/MWh.",
         "paginas": [PAGINA], "downloads": ["/energia/series/transicao_mcti_fatores.csv", "/energia/series/transicao_mcti_om_diario.csv"],
         "quebras": [{"data": "2025-01-01", "origem": "FONTE",
                      "descricao": "Base de usinas do ONS usada no cálculo ampliada (biomassa e conjuntos solares e eólicos); metodologia mantida, valores podem cair pela base (nota técnica NT_FE_jun25 do MCTI)."}]},
    ],
    "arquivos": {
        "/energia/series/transicao_mmgd_municipio_ano_fonte.csv": (
            "codigo_ibge; municipio; uf; ano_conexao (AAAA, ou sem_data quando a data publicada é sentinela); fonte (solar, "
            "termica, hidraulica, eolica, outra, nao_informada); unidades = empreendimentos no cadastro vigente; potencia_kw = "
            "soma da potência instalada cadastrada em kW das unidades com potência informada (capacidade, não energia), vazio "
            "quando nenhuma unidade da linha tem potência; unidades_sem_potencia = unidades da linha sem potência informada (maior "
            "que zero = soma parcial). Combinação ausente = nenhum empreendimento no cadastro. Registros com data anterior a "
            "dez/2008 (início da cobertura declarada pela ANEEL) aparecem como publicados."),
        "/energia/series/transicao_mmgd_municipios.csv": (
            "codigo_ibge; municipio; uf; unidades e potencia_kw no cadastro vigente; unidades_sem_potencia (potência parcial "
            "quando maior que zero; potencia_kw vazio quando todas); populacao_estimada e ano_populacao (IBGE, "
            "SIDRA 6579); w_por_habitante = potencia_kw × 1000 ÷ população; unidades_por_mil_habitantes; ano_referencia (último "
            "ano completo antes da data do cadastro); unidades_ano_referencia e potencia_kw_ano_referencia = conectadas no ano; "
            "potencia_kw_estoque_ano_anterior = conectadas até 31/12 do ano anterior; crescimento_estoque_pct = potência do ano "
            "÷ estoque anterior × 100 (vazio quando o estoque anterior é zero); unidades_distribuidora_fora_da_uf e "
            "potencia_kw_distribuidora_fora_da_uf = unidades do município cuja distribuidora (CNPJ) não tem conjunto elétrico na UF "
            "do município (base de continuidade da ANEEL): algum campo está errado na origem, sinalizadas e não corrigidas (já "
            "incluídas em unidades e potencia_kw; vazio = conferência indisponível). Dessas, unidades_provavel_municipio_errado e "
            "potencia_kw_provavel_municipio_errado = CEP publicado numa UF da área da distribuidora (provavelmente ficam em outro "
            "município: são as únicas a descontar para refazer o W/hab do município); unidades_provavel_distribuidora_errada e "
            "potencia_kw_provavel_distribuidora_errada = CEP, código do empreendimento e UF publicada na UF do município "
            "(provavelmente ficam no município; o erro provável é o CNPJ, que infla o total da distribuidora); o restante é "
            "indeterminado. Vazio = ausência (sem população publicada ou conferência indisponível)."),
        "/energia/series/transicao_mmgd_uf_mes_fonte.csv": (
            "uf (pelo código IBGE do município); mes_conexao (AAAA-MM ou sem_data); fonte; unidades; potencia_kw (soma das "
            "potências informadas; vazio quando nenhuma); unidades_sem_potencia. Os últimos meses são provisórios: registros chegam "
            "à ANEEL depois da conexão. Meses anteriores a dez/2008 estão fora da cobertura declarada pela ANEEL."),
        "/energia/series/transicao_mmgd_distribuidoras.csv": (
            "cnpj (14 dígitos, chave da distribuidora); sigla e nome como publicados (a sigla pode mudar para o mesmo CNPJ); uf "
            "do município da unidade; ano_conexao; unidades; potencia_kw (soma das potências informadas; vazio quando nenhuma); "
            "unidades_sem_potencia; uf_na_area_da_distribuidora = sim quando o CNPJ tem conjunto elétrico nessa UF na base de "
            "continuidade da ANEEL, nao quando não tem (algum campo errado na origem: o município ou o CNPJ; as classes pelo CEP "
            "estão na gold e no CSV municipal), vazio quando não há referência."),
        "/energia/series/transicao_mmgd_perfil.csv": (
            "dimensao (classe, modalidade, porte, tipo_consumidor, fonte_detalhe); categoria como publicada pela ANEEL; "
            "ano_conexao; unidades; potencia_kw (soma das potências informadas; vazio quando nenhuma); unidades_sem_potencia."),
        "/energia/series/transicao_ons_mmgd_diario.csv": (
            "data (dia de referência do ONS); submercado (SE, S, NE, N); mmgd_mwh = soma das meias horas × 0,5 h da parcela da "
            "carga atendida por MMGD estimada pelo ONS; mmgd_mwmed = mmgd_mwh ÷ horas; horas = horas cobertas; carga_global_mwh; "
            "carga_sem_mmgd_mwh. Estimativa operacional do ONS, não medição nem cadastro."),
        "/energia/series/transicao_ons_mmgd_mensal.csv": (
            "mes; submercado (SE, S, NE, N, SIN); mmgd_mwmed = MWh do mês ÷ horas cobertas; carga_global_mwmed; "
            "participacao_mmgd_pct = 100 × MWh de MMGD ÷ MWh da carga global; dias_completos; dias_no_mes. SIN = soma dos "
            "quatro submercados nos dias em que os quatro estão completos."),
        "/energia/series/transicao_mcti_fatores.csv": (
            "serie (fator_medio_mensal, fator_medio_anual, margem_operacao_despacho_mensal, margem_construcao_anual, "
            "margem_operacao_simples_ajustado_anual, energia_despachada_mwh); periodo (AAAA-MM ou AAAA); valor; unidade "
            "(tCO2/MWh, ou MWh para energia_despachada_mwh); arquivo de origem no MCTI. Fator médio não é fator marginal."),
        "/energia/series/transicao_mcti_om_diario.csv": (
            "data; margem_operacao_despacho_tco2_mwh (fator diário da margem de operação do MDL, MCTI); arquivo. Uso exclusivo "
            "em projetos de MDL; não é intensidade média da eletricidade consumida."),
        "/energia/series/transicao_municipios.json": (
            "Mapa de MMGD por município (carregado sob demanda): campos e linhas na mesma definição do CSV "
            "transicao_mmgd_municipios.csv."),
    },
}


# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------

def _idade(con, dataset, recurso, agora):
    v = base.ultima_vintage(con, dataset, recurso)
    ok = ckan._ultima_coleta_ok(con, dataset, recurso)
    ref = ok or (datetime.fromisoformat(v["capturado_em"].replace("Z", "+00:00")) if v else None)
    return (agora - ref) if ref else None


def _vintage_importada(con, vid, versao=VERSAO_IMPORTACAO_MMGD):
    """A vintage já foi importada pela versão atual da importação (marca em DS_CONTROLE,
    chave = id da vintage). Importação de versão anterior conta como não importada."""
    reg = base.registros_como_estavam_em(con, DS_CONTROLE).get(vid) or {}
    if versao is None:  # importada por qualquer versão (a vintage que gerou os números publicados)
        return "importado_em" in reg
    return "importado_em" in reg and reg.get("versao_importacao", "1") == versao


def _marca_importada(con, vid, detalhe):
    base.grava_registros(con, DS_CONTROLE, vid, [(vid, "importado_em", base.agora_utc()), (vid, "detalhe", detalhe),
                                                 (vid, "versao_importacao", VERSAO_IMPORTACAO_MMGD)])


def _bronze_para_arquivo(caminho_rel, sufixo):
    """Descomprime um arquivo do bronze para um temporário (o pyarrow precisa de arquivo
    com acesso aleatório). Quem chama remove o temporário."""
    fd, tmp = tempfile.mkstemp(prefix="transicao-", suffix=sufixo)
    os.close(fd)
    with base.abre_bronze(caminho_rel) as src, open(tmp, "wb") as dst:
        shutil.copyfileobj(src, dst, 1 << 20)
    return tmp


def _ibge_referencia(con):
    """(prefixo6 → código7, conjunto de códigos7) a partir do cadastro IBGE no silver."""
    muns = base.registros_como_estavam_em(con, DS_IBGE_MUN)
    validos = set(muns)
    por6 = defaultdict(list)
    for cod in validos:
        por6[cod[:6]].append(cod)
    return {k: v[0] for k, v in por6.items() if len(v) == 1}, (validos or None)


def _zeros_para_sumidos(con, linhas):
    """O arquivo da ANEEL é o cadastro completo: combinação que existia na captura anterior
    e sumiu na nova tem hoje zero empreendimentos (zero real, não ausência). Sem esta linha,
    a leitura vigente repetiria o valor antigo."""
    novas = {(s, r) for s, r, _ in linhas}
    # séries do silver que não aparecem na captura nova também entram: qtd_sem_kw.<serie>
    # só é gravada quando há unidade sem potência, então pode sumir inteira de uma captura
    # para a outra, e sem o zero a leitura vigente repetiria a contagem antiga
    existentes = {s for (s,) in con.execute("SELECT DISTINCT serie FROM observacoes WHERE dataset=?", (DS_MMGD,))}
    series = sorted({s for s, _, _ in linhas} | existentes)
    series = [s for s in series if not s.startswith("controle.")]
    extras = []
    for s in series:
        for ref, v in base.serie_vigente(con, DS_MMGD, s):
            if v != 0 and (s, ref) not in novas:
                extras.append((s, ref, 0.0))
    return extras


def _importa_mmgd(con, vintage, vint_fv):
    ibge6, validos = _ibge_referencia(con)
    tmp = _bronze_para_arquivo(vintage["arquivo"], ".parquet")
    tmp_fv = None
    try:
        t0 = time.time()
        ag = mmgd.agrega(mmgd.linhas_parquet(tmp), ibge6, validos)
        ctrl = ag.controles()
        ctrl.update(mmgd.controles_tabela(tmp))
        if vint_fv:
            tmp_fv = _bronze_para_arquivo(vint_fv["arquivo"], ".parquet")
            conc = mmgd.concordancia_datas(tmp, tmp_fv)
            ctrl.update({f"fv_{k}": v for k, v in conc.items()})
        datas = ag.datas_conjunto
        data_conj = max(datas) if datas else vintage["capturado_em"][:10]
        linhas = list(ag.observacoes())
        linhas += _zeros_para_sumidos(con, linhas)
        linhas += [(f"controle.{k}", data_conj, float(v)) for k, v in ctrl.items() if v is not None]
        # contagens do agregador só existem quando passam de zero: controle que o silver já
        # tinha e que a captura nova não traz vale zero (sem isso, uma captura com a mesma
        # data de geração herdaria a contagem antiga). Os controles do recurso técnico (fv_)
        # ficam de fora: sem a captura dele, a ausência é "sem captura", não zero.
        ja = {s for s, _, _ in linhas if s.startswith("controle.")}
        linhas += [(s, data_conj, 0.0) for (s,) in con.execute(
            "SELECT DISTINCT serie FROM observacoes WHERE dataset=? AND serie LIKE 'controle.%'", (DS_MMGD,))
            if s not in ja and not s.startswith("controle.fv_")]
        novas, revs = base.grava_observacoes(con, DS_MMGD, vintage["vintage_id"], linhas)
        dist = []
        for cnpj, nomes in ag.nomes_dist.items():
            (sigla, nome), _ = nomes.most_common(1)[0]
            siglas = sorted({s for s, _ in nomes if s})
            dist += [(cnpj, "sigla", sigla or None), (cnpj, "nome", nome or None), (cnpj, "siglas_publicadas", "; ".join(siglas) or None)]
        base.grava_registros(con, DS_DIST, vintage["vintage_id"], dist)
        periodos = sorted(ag.periodos_referencia)
        base.grava_registros(con, DS_CONTROLE, vintage["vintage_id"], [
            ("conjunto", "data_geracao", data_conj),
            ("conjunto", "datas_geracao_distintas", str(len(datas))),
            ("conjunto", "fv_vintage", vint_fv["vintage_id"] if vint_fv else None),
            # datas de conexão válidas (sem sentinela) e AnmPeriodoReferencia publicado
            ("conjunto", "data_conexao_minima", ag.data_conexao_min.isoformat() if ag.data_conexao_min else None),
            ("conjunto", "data_conexao_maxima", ag.data_conexao_max.isoformat() if ag.data_conexao_max else None),
            ("conjunto", "periodo_referencia", "; ".join(periodos) or None),
        ])
        _marca_importada(con, vintage["vintage_id"], f"{ctrl.get('linhas')} linhas, {novas} novas, {revs} revisões, {time.time() - t0:.0f} s")
        con.commit()
        return {"linhas": ctrl.get("linhas"), "novas": novas, "revisoes": revs, "data_conjunto": data_conj}
    finally:
        for t in (tmp, tmp_fv):
            if t:
                try:
                    os.remove(t)
                except OSError:
                    pass


def _coleta_mmgd(con):
    agora = datetime.now(timezone.utc)
    status = {}
    idade_fv = _idade(con, DS_FV, RECURSO_FV, agora)
    vint_fv = {}
    if idade_fv is None or idade_fv >= timedelta(days=MAX_IDADE_FV):
        status["tecnico_fv"], _, vint_fv = ckan.coleta_pacote(
            con, orgao="ANEEL", nome=PACOTE_MMGD, dataset=DS_FV, max_idade_dias=MAX_IDADE_FV,
            filtro_recurso=lambda r: (r.get("name") or "").strip() == RECURSO_FV,
            ext_de=lambda r: "parquet")
    else:
        status["tecnico_fv"] = {"status": "pulada", "idade_dias": idade_fv.days}
    idade = _idade(con, DS_MMGD, RECURSO_PARQUET, agora)
    if idade is None or idade >= timedelta(days=MAX_IDADE_MMGD):
        status["coleta"], _, vints = ckan.coleta_pacote(
            con, orgao="ANEEL", nome=PACOTE_MMGD, dataset=DS_MMGD, max_idade_dias=MAX_IDADE_MMGD,
            filtro_recurso=lambda r: (r.get("name") or "").strip() == RECURSO_PARQUET or (r.get("format") or "").upper() == "PDF"
            and "relacao-de-empreendimentos" in (r.get("url") or ""),
            ext_de=lambda r: "pdf" if (r.get("format") or "").upper() == "PDF" else "parquet")
    else:
        status["coleta"] = {"status": "pulada", "idade_dias": idade.days}
        vints = {RECURSO_PARQUET: base.ultima_vintage(con, DS_MMGD, RECURSO_PARQUET)}
    v = vints.get(RECURSO_PARQUET)
    if v and not _vintage_importada(con, v["vintage_id"]):
        try:
            status["importacao"] = _importa_mmgd(con, v, vint_fv.get(RECURSO_FV) or base.ultima_vintage(con, DS_FV, RECURSO_FV))
        except Exception as e:  # arquivo corrompido ou esquema novo: falha registrada, sem número
            con.rollback()
            base.registra_coleta(con, DS_MMGD, RECURSO_PARQUET, False, f"importação: {e}")
            con.commit()
            status["importacao"] = {"erro": str(e)[:300]}
    return status


def _processa_area(con, ds, vintage):
    """Grava em registros o que importa de cada arquivo de conjuntos: CNPJs e anos por
    conjunto (limites) ou municípios por conjunto (indqual). Marca a vintage processada."""
    linhas = ckan.le_csv_bronze(vintage["arquivo"])
    regs = []
    if ds == DS_AREA_LIM:
        for cj, info in mmgd.conjuntos_limite(linhas).items():
            anos = sorted(info["anos"])
            regs += [(cj, "cnpjs", ";".join(sorted(info["cnpjs"]))),
                     (cj, "anos", f"{anos[0]}-{anos[-1]}" if anos else None)]
    else:
        for cj, muns in mmgd.conjuntos_municipio(linhas).items():
            regs.append((cj, "municipios", ";".join(f"{m}:{uf or ''}" for m, uf in sorted(muns))))
    n, rv = base.grava_registros(con, ds, vintage["vintage_id"], regs)
    base.grava_registros(con, DS_CONTROLE, vintage["vintage_id"], [(vintage["vintage_id"], "importado_em", base.agora_utc()),
                                                                   (vintage["vintage_id"], "detalhe", f"{len(regs)} campos, {n} novos, {rv} revisões")])
    return {"campos": len(regs), "novos": n, "revisoes": rv}


def _coleta_area(con):
    """Conjuntos elétricos da ANEEL (limites de continuidade e municípios por conjunto), para
    a área de atuação de cada CNPJ de distribuidora."""
    status = {}
    for ds, pacote, recurso in ((DS_AREA_LIM, PACOTE_LIM, RECURSO_LIM), (DS_AREA_MUN, PACOTE_MUN, RECURSO_MUN)):
        st, _, vints = ckan.coleta_pacote(
            con, orgao="ANEEL", nome=pacote, dataset=ds, max_idade_dias=MAX_IDADE_AREA,
            filtro_recurso=lambda r, rec=recurso: (r.get("name") or "").strip() == rec, ext_de=lambda r: "csv")
        status[ds] = st
        v = vints.get(recurso)
        if v and not _vintage_importada(con, v["vintage_id"], versao=None):
            try:
                status[f"{ds}:processamento"] = _processa_area(con, ds, v)
                con.commit()
            except Exception as e:  # arquivo com esquema novo: falha registrada, sinalização fica sem referência
                con.rollback()
                base.registra_coleta(con, ds, recurso, False, f"processamento: {e}")
                con.commit()
                status[f"{ds}:processamento"] = {"erro": str(e)[:300]}
    return status


def _area_distribuidoras(con):
    """({cnpj: {uf: conjuntos}}, snapshot) a partir dos registros vigentes dos dois arquivos."""
    lim = base.registros_como_estavam_em(con, DS_AREA_LIM)
    mun = base.registros_como_estavam_em(con, DS_AREA_MUN)
    if not lim or not mun:
        return {}, None
    limites = {cj: {"cnpjs": set((x.get("cnpjs") or "").split(";")) - {""}, "anos": set()} for cj, x in lim.items()}
    municipios = {cj: {tuple(p.split(":", 1)) for p in (x.get("municipios") or "").split(";") if p} for cj, x in mun.items()}
    anos = [a for x in lim.values() for a in (x.get("anos") or "").split("-") if a.isdigit()]
    info = {"conjuntos_com_cnpj": len(limites), "conjuntos_com_municipio": len(municipios),
            "anos": f"{min(anos)} a {max(anos)}" if anos else None,
            "snapshots": [c.snapshot_de(con, DS_AREA_LIM), c.snapshot_de(con, DS_AREA_MUN)]}
    return mmgd.area_distribuidoras(limites, municipios), info


def _data_brasilia(instante_utc):
    """Data civil de Brasília (UTC−3, sem horário de verão desde 2019) de um instante UTC."""
    t = datetime.fromisoformat(instante_utc.replace("Z", "+00:00"))
    return (t - timedelta(hours=3)).date().isoformat()


def _meses(inicio, fim):
    a, m = int(inicio[:4]), int(inicio[5:7])
    while f"{a:04d}-{m:02d}" <= fim:
        yield f"{a:04d}-{m:02d}"
        m += 1
        if m == 13:
            a, m = a + 1, 1


def _coleta_ons(con, hoje=None, baixar=http_get, pausa=PAUSA_S, agora=None):
    """Pedidos mensais por submercado. `hoje` é a data civil de Brasília: o ONS publica por
    dia de referência em Brasília, e com a data UTC, entre 21h e 24h de Brasília, a coleta
    pediria o mês seguinte (vintages vazias) e tiraria um mês recente do lote de 20 h."""
    agora = agora or datetime.now(timezone.utc)
    if hoje is None:
        hoje = date.fromisoformat(_data_brasilia(agora.strftime("%Y-%m-%dT%H:%M:%SZ")))
    meses = list(_meses(ons.PRIMEIRO_MES, hoje.strftime("%Y-%m")))
    recentes = set(meses[-ONS_MESES_RECENTES:])
    st = {"pedidos": 0, "novas": 0, "identicas": 0, "puladas": 0, "falhas": [], "observacoes_novas": 0, "revisoes": 0}
    for mes in meses:
        a, m = int(mes[:4]), int(mes[5:7])
        fim = date(a + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
        fim = min(fim, hoje)
        for sm, area in ons.AREAS.items():
            recurso = f"carga_verificada_{area}_{mes}"
            idade = _idade(con, DS_ONS, recurso, agora)
            limite = timedelta(hours=ONS_IDADE_RECENTES_H) if mes in recentes else timedelta(days=ONS_IDADE_ANTIGOS_D)
            if idade is not None and idade < limite:
                st["puladas"] += 1
                continue
            url = ons.url(area, f"{mes}-01", fim.isoformat())
            st["pedidos"] += 1
            try:
                corpo, _ = baixar(url, timeout=120)
                regs = ons.parse(corpo)
            except Exception as e:
                base.registra_coleta(con, DS_ONS, recurso, False, str(e))
                st["falhas"].append(f"{recurso}: {str(e)[:120]}")
                continue
            capturado = base.agora_utc()
            arq, sha = base.salva_bronze("ons", DS_ONS, recurso, corpo, "json", capturado)
            ult = base.ultima_vintage(con, DS_ONS, recurso)
            if ult and ult["sha256"] == sha:
                base.registra_coleta(con, DS_ONS, recurso, True, "idêntico à vintage anterior")
                st["identicas"] += 1
            else:
                vid, _ = base.registra_vintage(con, DS_ONS, recurso, url, capturado, None, sha, len(corpo), "coleta_direta", arq)
                diario = ons.agrega_diario(regs, dia_limite=_data_brasilia(capturado))
                n, rv = base.grava_observacoes(con, DS_ONS, vid, ons.observacoes(diario))
                base.registra_coleta(con, DS_ONS, recurso, True, f"{len(regs)} meias horas, {n} novas, {rv} revisões")
                st["novas"] += 1
                st["observacoes_novas"] += n
                st["revisoes"] += rv
            con.commit()
            if pausa:
                time.sleep(pausa)
    st["ok"] = not st["falhas"]
    return st


def _grava_mcti(con, recurso, url, corpo, ext, origem, capturado=None, publicado=None, arquivo=None):
    """Registra uma planilha ou página do MCTI e importa a série quando a vintage é nova."""
    capturado = capturado or base.agora_utc()
    if arquivo is None:
        arquivo, sha = base.salva_bronze("mcti", DS_MCTI, recurso, corpo, ext, capturado)
    else:
        sha = base.sha256_bytes(corpo)
    ult = base.ultima_vintage(con, DS_MCTI, recurso)
    if ult and ult["sha256"] == sha:
        base.registra_coleta(con, DS_MCTI, recurso, True, "idêntico à vintage anterior")
        return {"recurso": recurso, "status": "identica"}
    vid, nova = base.registra_vintage(con, DS_MCTI, recurso, url, capturado, publicado, sha, len(corpo), origem, arquivo)
    if not nova:
        return {"recurso": recurso, "status": "identica"}
    linhas, meta = _linhas_mcti(recurso, corpo, ext)
    n, rv = base.grava_observacoes(con, DS_MCTI, vid, linhas)
    _grava_leitura_mcti(con, vid, recurso, meta)
    base.registra_coleta(con, DS_MCTI, recurso, True, f"{len(linhas)} valores, {n} novos, {rv} revisões")
    return {"recurso": recurso, "status": "nova", "valores": len(linhas), "revisoes": rv}


def _grava_leitura_mcti(con, vid, recurso, meta):
    """Anotações da leitura (tipo, notas, revisões declaradas, descartes, problemas) da
    vintage e a marca da versão do leitor que as produziu."""
    base.grava_registros(con, DS_MCTI_META, vid, [(recurso, k, None if v is None else
                                                   (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)))
                                                  for k, v in meta.items()])
    base.grava_registros(con, DS_CONTROLE, vid, [(vid, "leitura_mcti", VERSAO_LEITURA_MCTI)])


def releitura_mcti(con):
    """Relê do bronze as planilhas do MCTI lidas por versão anterior do leitor.

    As anotações de leitura (o que o leitor extrai além dos valores) de cada vintage são
    refeitas: as linhas antigas daquela vintage saem e as novas entram, em ordem de
    captura. Os valores (observações) seguem a regra do silver, que só grava valor novo; se
    a releitura achar valor diferente para a mesma vintage, a diferença fica registrada em
    `coletas` e não é gravada (mudança de valor exige nova captura, não releitura)."""
    feitas, divergentes = [], []
    marcas = base.registros_como_estavam_em(con, DS_CONTROLE)
    for v in sorted(base.vintages_do_dataset(con, DS_MCTI), key=lambda x: x["capturado_em"]):
        if (marcas.get(v["vintage_id"]) or {}).get("leitura_mcti") == VERSAO_LEITURA_MCTI or not v.get("arquivo"):
            continue
        nome = v["arquivo"][:-3] if v["arquivo"].endswith(".gz") else v["arquivo"]
        ext = nome.rsplit(".", 1)[-1].lower()
        with base.abre_bronze(v["arquivo"]) as f:
            corpo = f.read()
        linhas, meta = _linhas_mcti(v["recurso"], corpo, ext)
        gravados = dict(((s, r), x) for s, r, x in con.execute(
            "SELECT serie, ref, valor FROM observacoes WHERE dataset=? AND vintage_id=?", (DS_MCTI, v["vintage_id"])))
        dif = [(s_, r_) for s_, r_, x in linhas if (s_, r_) in gravados and abs(gravados[(s_, r_)] - x) > 1e-12]
        if dif:
            divergentes.append(v["recurso"])
            base.registra_coleta(con, DS_MCTI, v["recurso"], False,
                                 f"releitura com {len(dif)} valores diferentes dos gravados para a mesma vintage (ex.: {dif[0]}); não gravados")
        base.grava_observacoes(con, DS_MCTI, v["vintage_id"], [x for x in linhas if (x[0], x[1]) not in gravados])
        con.execute("DELETE FROM registros WHERE dataset=? AND chave=? AND vintage_id=?", (DS_MCTI_META, v["recurso"], v["vintage_id"]))
        _grava_leitura_mcti(con, v["vintage_id"], v["recurso"], meta)
        feitas.append(v["recurso"])
    con.commit()
    return {"relidas": len(feitas), "com_valor_divergente": divergentes}


FAMILIAS_MCTI = ("atual", "seed", "antigo")  # ordem de precedência na gold


def _familia_mcti(recurso):
    """Família de origem pelo prefixo do recurso: página vigente do MCTI ("atual"),
    captura depositada por pessoa ("seed") ou site institucional anterior ("antigo").
    As séries levam a família no nome para que uma planilha antiga recapturada depois
    não passe por revisão de uma publicação mais nova (a leitura vigente do silver segue
    a ordem de captura, não a de publicação)."""
    f = recurso.split("_", 1)[0]
    return f if f in FAMILIAS_MCTI else "antigo"


def _linhas_mcti(recurso, corpo, ext):
    fam = _familia_mcti(recurso)
    if ext == "html":
        p = mcti.parse_simples_ajustado(corpo)
        tipo = "simples_ajustado"
    elif ext == "pdf":
        return [], {"tipo": "documento"}
    else:
        planilha = mcti.le_xlsx(corpo)
        tipo = mcti.tipo_planilha(planilha)
        if tipo == "simples_ajustado":
            p = mcti.parse_simples_ajustado_xlsx(planilha)
    if tipo == "simples_ajustado":
        linhas = [(f"{fam}.om_simples_ajustado_anual", a, v) for a, v in p["om"].items()]
        linhas += [(f"{fam}.energia_despachada_mwh", a, v) for a, v in p["energia_mwh"].items()]
        return linhas, {"tipo": tipo, "notas": p["notas"], "anos_com_nota": p["anos_com_nota"]}
    if tipo == "inventario":
        p = mcti.parse_inventario(planilha)
        linhas = [(f"{fam}.medio_mensal", k, v) for k, v in p["mensal"].items()]
        linhas += [(f"{fam}.medio_anual", k, v) for k, v in p["anual"].items()]
        return linhas, {"tipo": tipo, "problemas": p["problemas"]}
    if tipo == "despacho":
        p = mcti.parse_despacho(planilha)
        linhas = [(f"{fam}.om_despacho_mensal", k, v) for k, v in p["om_mensal"].items()]
        linhas += [(f"{fam}.om_despacho_diario", k, v) for k, v in p["om_diario"].items()]
        if p["bm"] is not None and p["ano"]:
            linhas.append((f"{fam}.bm_anual", str(p["ano"]), p["bm"]))
        return linhas, {"tipo": tipo, "ano": p["ano"], "bm_nota": p["bm_nota"], "notas": p["notas"],
                        "revisoes_declaradas": p["revisoes"], "descartes": p["descartes"], "problemas": p["problemas"]}
    return [], {"tipo": "outro"}


def _registra_listagem(con, recurso, url, corpo, publicadas, ocultas):
    """Guarda o que a página publicava (título e URL de cada planilha visível, e as âncoras
    ocultas ignoradas) como registro, com o HTML no bronze. Nova vintage só quando a
    listagem muda: o HTML do gov.br traz identificadores que mudam a cada pedido."""
    lista = json.dumps(publicadas, ensure_ascii=False, sort_keys=True)
    ocul = json.dumps(ocultas, ensure_ascii=False)
    atual = base.registros_como_estavam_em(con, DS_MCTI_META).get(recurso, {})
    if atual.get("planilhas") == lista and atual.get("links_ocultos", "[]") == ocul:
        return False
    capturado = base.agora_utc()
    arq, sha = base.salva_bronze("mcti", DS_MCTI_META, recurso, corpo, "html", capturado)
    vid, _ = base.registra_vintage(con, DS_MCTI_META, recurso, url, capturado, None, sha, len(corpo), "coleta_direta", arq)
    base.grava_registros(con, DS_MCTI_META, vid, [(recurso, "planilhas", lista), (recurso, "links_ocultos", ocul)])
    return True


def _coleta_mcti(con, baixar=http_get):
    agora = datetime.now(timezone.utc)
    st = {"pagina_atual": None, "atual": [], "antigo": [], "seed": [], "falhas": []}
    st["releitura"] = releitura_mcti(con)
    # 1. página vigente: tentativa registrada; desafio de verificação humana não é contornado
    #    (o pedido usa o identificador próprio do pipeline, sem se passar por navegador)
    try:
        corpo, _ = baixar(mcti.URL_PAGINA_ATUAL, timeout=60, accept=None)
        sid = mcti.desafio_waf(corpo)
        if sid:
            # o HTML do desafio fica no bronze como evidência do bloqueio (não é dado)
            arq_d, sha_d = base.salva_bronze("mcti", DS_MCTI_META, "pagina_atual_desafio", corpo, "html", base.agora_utc())
            base.registra_coleta(con, DS_MCTI, "pagina_atual", False,
                                 f"desafio de verificação humana do gov.br (support ID {sid}); não contornado; "
                                 f"resposta guardada em {arq_d} (sha256 {sha_d[:16]})")
            st["pagina_atual"] = {"situacao": "bloqueada", "support_id": sid, "tentado_em": base.agora_utc(), "arquivo": arq_d}
        else:
            publicadas, ocultas = mcti.planilhas_publicadas(corpo, mcti.URL_PAGINA_ATUAL)
            docs = mcti.links_documentos(corpo, mcti.URL_PAGINA_ATUAL)
            mudou = _registra_listagem(con, "pagina_atual", mcti.URL_PAGINA_ATUAL, corpo, publicadas, ocultas)
            base.registra_coleta(con, DS_MCTI, "pagina_atual", True,
                                 f"{len(publicadas)} planilhas publicadas, {len(ocultas)} âncoras ocultas ignoradas, "
                                 f"{len(docs)} notas técnicas{'; listagem nova' if mudou else ''}")
            st["pagina_atual"] = {"situacao": "acessivel", "planilhas": len(publicadas), "ocultas": len(ocultas),
                                  "tentado_em": base.agora_utc()}
            for u, ext in [(x["url"], "xlsx") for x in publicadas] + [(x, "pdf") for x in docs]:
                nome = "atual_" + u.rsplit("/", 1)[-1].rsplit(".", 1)[0]
                idade = _idade(con, DS_MCTI, nome, agora)
                if idade is not None and idade < timedelta(days=MAX_IDADE_MCTI):
                    continue
                try:
                    arq, _ = baixar(u, timeout=120, accept="*/*")
                    if mcti.desafio_waf(arq):
                        raise RuntimeError("desafio de verificação humana no arquivo")
                    st["atual"].append(_grava_mcti(con, nome, u, arq, ext, "coleta_direta"))
                except Exception as e:
                    base.registra_coleta(con, DS_MCTI, nome, False, str(e))
                    st["falhas"].append(f"{nome}: {str(e)[:120]}")
    except Exception as e:
        base.registra_coleta(con, DS_MCTI, "pagina_atual", False, str(e))
        st["pagina_atual"] = {"situacao": "falha", "detalhe": str(e)[:200], "tentado_em": base.agora_utc()}
    # 2. site institucional anterior do MCTI (origem oficial acessível)
    for pagina, rotulo in ((mcti.URL_ANTIGO_INVENTARIO, "inventario"), (mcti.URL_ANTIGO_DESPACHO, "despacho")):
        try:
            corpo, _ = baixar(pagina, timeout=60, accept=None)
            publicadas, ocultas = mcti.planilhas_publicadas(corpo, pagina)
            _registra_listagem(con, f"pagina_antiga_{rotulo}", pagina, corpo, publicadas, ocultas)
            links = [x["url"] for x in publicadas]
        except Exception as e:
            base.registra_coleta(con, DS_MCTI, f"pagina_{rotulo}", False, str(e))
            st["falhas"].append(f"pagina_{rotulo}: {str(e)[:120]}")
            continue
        for u in links:
            nome = "antigo_" + u.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            idade = _idade(con, DS_MCTI, nome, agora)
            if idade is not None and idade < timedelta(days=MAX_IDADE_MCTI):
                continue
            try:
                arq, _ = baixar(u, timeout=120, accept="*/*")
                st["antigo"].append(_grava_mcti(con, nome, u, arq, "xlsx", "coleta_direta"))
            except Exception as e:
                base.registra_coleta(con, DS_MCTI, nome, False, str(e))
                st["falhas"].append(f"{nome}: {str(e)[:120]}")
            con.commit()
            time.sleep(PAUSA_S)
    nome = "antigo_emissao_ajustado"
    idade = _idade(con, DS_MCTI, nome, agora)
    if idade is None or idade >= timedelta(days=MAX_IDADE_MCTI):
        try:
            corpo, _ = baixar(mcti.URL_ANTIGO_AJUSTADO, timeout=60, accept=None)
            st["antigo"].append(_grava_mcti(con, nome, mcti.URL_ANTIGO_AJUSTADO, corpo, "html", "coleta_direta"))
        except Exception as e:
            base.registra_coleta(con, DS_MCTI, nome, False, str(e))
            st["falhas"].append(f"{nome}: {str(e)[:120]}")
    # 3. capturas depositadas por pessoa (páginas que exigem verificação humana)
    st["seed"] = importa_seed_mcti(con)
    con.commit()
    st["ok"] = not st["falhas"]
    return st


def importa_seed_mcti(con, pasta=SEED_MCTI):
    """Planilhas do MCTI baixadas por uma pessoa (a página vigente exige verificação humana)
    e versionadas em pipeline/energia/seed/mcti_fatores_emissao/<versao>/ com MANIFESTO.json:
    {"capturado_em", "capturado_por", "pagina", "arquivos": [{"recurso", "url", "arquivo_seed",
    "sha256"}]}. sha256 divergente do manifesto = arquivo recusado."""
    out = []
    if not os.path.isdir(pasta):
        return out
    for versao in sorted(os.listdir(pasta)):
        mpath = os.path.join(pasta, versao, "MANIFESTO.json")
        if not os.path.isfile(mpath):
            continue
        with open(mpath, encoding="utf-8") as f:
            man = json.load(f)
        for item in man.get("arquivos", []):
            caminho = os.path.join(pasta, versao, item["arquivo_seed"])
            with open(caminho, "rb") as f:
                corpo = f.read()
            if caminho.endswith(".gz"):
                corpo = gzip.decompress(corpo)
            sha = base.sha256_bytes(corpo)
            if sha != item["sha256"]:
                base.registra_coleta(con, DS_MCTI, item["recurso"], False, "seed com sha256 divergente")
                out.append({"recurso": item["recurso"], "ok": False, "erro": "sha256 divergente"})
                continue
            r = _grava_mcti(con, "seed_" + item["recurso"], item["url"], corpo, "xlsx", "seed",
                            capturado=man["capturado_em"], arquivo=os.path.relpath(caminho, base.RAIZ))
            out.append({**r, "ok": True})
    return out


def parse_sidra(corpo):
    """[(nivel, codigo, nome, ano, valor|None)] da resposta da API SIDRA (1ª linha é cabeçalho)."""
    dados = json.loads(corpo.decode("utf-8") if isinstance(corpo, bytes) else corpo)
    out = []
    for x in dados[1:]:
        v = (x.get("V") or "").strip()
        valor = float(v) if v.replace(".", "", 1).isdigit() else None  # "...", "-", "X" = ausência
        out.append((x.get("NC"), x.get("D1C"), x.get("D1N"), x.get("D3C"), valor))
    return out


def _coleta_ibge(con, baixar=http_get):
    agora = datetime.now(timezone.utc)
    recurso = "sidra_6579_ultimo_ano"
    idade = _idade(con, DS_IBGE, recurso, agora)
    if idade is not None and idade < timedelta(days=MAX_IDADE_IBGE):
        return {"status": "pulada"}
    try:
        corpo, _ = baixar(URL_SIDRA, timeout=180)
        linhas = parse_sidra(corpo)
    except Exception as e:
        base.registra_coleta(con, DS_IBGE, recurso, False, str(e))
        return {"status": "falha", "detalhe": str(e)[:200]}
    capturado = base.agora_utc()
    arq, sha = base.salva_bronze("ibge", DS_IBGE, recurso, corpo, "json", capturado)
    vid, nova = base.registra_vintage(con, DS_IBGE, recurso, URL_SIDRA, capturado, None, sha, len(corpo), "coleta_direta", arq)
    obs, regs = [], []
    for nivel, cod, nome, ano, valor in linhas:
        if valor is not None:
            obs.append(("populacao", f"{cod}|{ano}", valor))
        if nivel == "6" and cod and len(cod) == 7:
            uf = mmgd.UF_POR_CODIGO.get(cod[:2])
            nome_mun = nome.rsplit(" - ", 1)[0] if nome and " - " in nome else nome
            regs += [(cod, "nome", nome_mun), (cod, "uf", uf)]
    n, rv = base.grava_observacoes(con, DS_IBGE, vid, obs)
    # o cadastro de municípios vai para outro dataset de registros, com a mesma vintage
    vid_mun, _ = base.registra_vintage(con, DS_IBGE_MUN, recurso, URL_SIDRA, capturado, None, sha, len(corpo), "coleta_direta", arq)
    base.grava_registros(con, DS_IBGE_MUN, vid_mun, regs)
    base.registra_coleta(con, DS_IBGE, recurso, True, f"{len(linhas)} linhas, {n} novas, {rv} revisões")
    con.commit()
    return {"status": "nova" if nova else "identica", "linhas": len(linhas)}


def coletar(con, ctx):
    # data civil de Brasília (o runner roda em UTC; ver _coleta_ons)
    hoje = ctx.get("hoje") or c.hoje_brasilia()
    status = {"modulo": "transicao"}
    # IBGE antes da MMGD: o cadastro de municípios completa códigos de 6 dígitos
    for nome, f in (("ibge", lambda: _coleta_ibge(con)), ("mmgd", lambda: _coleta_mmgd(con)),
                    ("area_distribuidoras", lambda: _coleta_area(con)),
                    ("ons", lambda: _coleta_ons(con, hoje)), ("mcti", lambda: _coleta_mcti(con))):
        try:
            status[nome] = f()
        except Exception as e:  # nenhuma falha de fonte derruba as demais
            status[nome] = {"ok": False, "erro": str(e)[:300]}
            try:
                con.rollback()
            except Exception:
                pass
    return status


# ---------------------------------------------------------------------------
# Leitura do silver
# ---------------------------------------------------------------------------

def _serie_ref(con, ds, serie, partes):
    """{tupla da referência composta: valor} da série vigente."""
    out = {}
    for ref, v in base.serie_vigente(con, ds, serie):
        k = tuple(ref.split("|"))
        if len(k) == partes:
            out[k] = v
    return out


def _par(con, serie, partes):
    """{chave: (unidades, kW informados, unidades sem potência)} juntando qtd.<serie>,
    kw.<serie> e qtd_sem_kw.<serie>; combinação com zero unidades (sumiu do cadastro) não
    entra. kW é a soma das potências informadas: com unidades sem potência, a soma é parcial
    e a publicação usa `_kw_pub` (nula quando nenhuma unidade tem potência)."""
    q = _serie_ref(con, DS_MMGD, f"qtd.{serie}", partes)
    k = _serie_ref(con, DS_MMGD, f"kw.{serie}", partes)
    s = _serie_ref(con, DS_MMGD, f"qtd_sem_kw.{serie}", partes)
    return {ch: (int(round(n)), k.get(ch, 0.0), int(round(s.get(ch, 0.0)))) for ch, n in q.items() if n > 0}


def _soma3(valores):
    """[unidades, kW informados, unidades sem potência] somados."""
    t = [0, 0.0, 0]
    for q, k, s in valores:
        t[0] += q
        t[1] += k
        t[2] += s
    return t


def _kw_pub(kw, unidades, sem, casas=2, mw=False):
    """Potência publicada de um agregado: nula quando nenhuma unidade tem potência
    informada (ausência não vira zero); com parte das unidades sem potência, a soma das
    informadas, que a publicação acompanha de `unidades_sem_potencia` (parcial rotulada)."""
    if unidades and sem >= unidades:
        return None
    return _mw(kw) if mw else c.r(kw, casas)


def _controles(con):
    out, data = {}, None
    rows = con.execute(
        """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie LIKE 'controle.%' ORDER BY v.capturado_em, o.rowid""", (DS_MMGD,)).fetchall()
    ultimo_ref = max((r for _, r, _ in rows), default=None)
    for s, r, v in rows:
        if r == ultimo_ref:
            out[s[len("controle."):]] = v
    data = ultimo_ref
    return out, data


def _pop(con):
    pops = {}
    ano = None
    for ref, v in base.serie_vigente(con, DS_IBGE, "populacao"):
        cod, a = ref.split("|")
        if ano is None or a > ano:
            ano = a
        pops.setdefault(a, {})[cod] = v
    return (pops.get(ano, {}), ano)


def _mw(kw):
    return c.r(kw / 1000.0, 3) if kw is not None else None


def _pct(num, den):
    """Participação em %: duas casas; abaixo de 0,01% (e diferente de zero), dois algarismos
    significativos, para que uma categoria pequena não apareça como zero (232 unidades de
    iluminação pública em 4,66 milhões são 0,005%, não 0,00%)."""
    if not den:
        return None
    v = 100.0 * num / den
    if v == 0 or abs(v) >= 0.01:
        return c.r(v, 2)
    return float(f"{v:.2g}")


# Tolerância da identidade de estoque em kW: as potências são publicadas com duas casas
# (centésimo de kW) e o silver guarda cada agregado com quatro; somas do mesmo conjunto
# em agrupamentos diferentes só podem diferir pelo erro de ponto flutuante, muito abaixo
# do centésimo publicado.
TOL_ESTOQUE_KW = 0.01


# ---------------------------------------------------------------------------
# Evidência
# ---------------------------------------------------------------------------

def _br(v, casas=0):
    """Número no formato brasileiro (milhar com ponto, decimal com vírgula) para o texto
    exibido da evidência; None fica None (a evidência escreve "sem dado")."""
    if v is None:
        return None
    t = f"{abs(v):,.{casas}f}".replace(",", "\u0001").replace(".", ",").replace("\u0001", ".")
    return ("\u2212" + t) if v < 0 and t.strip("0,.") else t  # sinal de menos tipográfico, nunca hífen


def _teste(nome, ok, detalhe):
    return ev.teste(nome, "aprovado" if ok else "reprovado", detalhe)


REPRODUCAO = "python3 pipeline/energia/executar_modulo.py transicao --sem-coleta (silver data/energia/silver/aneel_mmgd.db)"


# ---------------------------------------------------------------------------
# Gold: MMGD
# ---------------------------------------------------------------------------

class ValidacaoCritica(Exception):
    """Violação crítica de domínio ou identidade: a gold vira stub com o motivo e a
    sentinela mantém a última publicação válida (contrato, seção 5.2)."""


# Cobertura declarada pela ANEEL para a relação de MMGD ("a partir de dezembro de 2008",
# metadado "Cobertura temporal" do conjunto no CKAN, conferido em 01/10/2026). Antes dela,
# a ausência de registro no cadastro não prova que não houve conexão: período fora da
# cobertura e zero são estados distintos.
INICIO_COB_DECL = "2008-12-01"
MES_COB_DECL = INICIO_COB_DECL[:7]


def _cobertura_mes(mes):
    return "total" if mes >= MES_COB_DECL else "fora"


def _cobertura_ano(ano):
    a0, m0 = int(MES_COB_DECL[:4]), int(MES_COB_DECL[5:7])
    if ano > a0 or (ano == a0 and m0 == 1):
        return "total"
    return "parcial" if ano == a0 else "fora"


def _ponto_serie(q, kw, sem, cobertura):
    """Campos de um ponto das séries por data: unidades, potencia_mw e, só quando se
    aplicam (para a gold caber no tamanho do contrato), unidades_sem_potencia (soma parcial)
    e cobertura_declarada ("fora" ou "parcial"; ausente = dentro da cobertura). Dentro da
    cobertura declarada, período sem conexão é zero explícito; fora dela (ou em parte fora),
    período sem registro fica nulo, e registro existente é publicado como está, rotulado."""
    if cobertura != "total" and not q:
        out = {"unidades": None, "potencia_mw": None}
    else:
        out = {"unidades": q, "potencia_mw": _kw_pub(kw, q, sem, mw=True)}
        if sem:
            out["unidades_sem_potencia"] = sem
    if cobertura != "total":
        out["cobertura_declarada"] = cobertura
    return out


# Definição das modalidades em que o crédito da energia gerada compensa o consumo de
# outras unidades (texto da ANEEL), citada na limitação territorial do cadastro.
DOC_ANEEL_MODALIDADES = {
    "orgao": "ANEEL",
    "titulo": "Geração distribuída: modalidades de participação no Sistema de Compensação de Energia Elétrica (SCEE)",
    "url": "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida",
    "consultado_em": "2026-10-01",
    "trecho": ('Autoconsumo remoto: "quando a energia pode ser gerada em um local e compensada em outro, desde que em unidades '
               'consumidoras do mesmo titular". Geração compartilhada: "diversos interessados podem se unir por meio de consórcio, '
               'cooperativa, condomínio civil voluntário ou edilício ou qualquer outra forma de associação civil, instituída para esse '
               'fim para instalar uma ou mais centrais de MMGD e utilizar a energia gerada para compensação do consumo de todos os '
               'participantes".'),
}


def _bloco_mmgd(con, hoje):
    ctrl, data_conj = _controles(con)
    mun = _par(con, "mun_ano_fonte", 3)
    if not mun or not data_conj:
        return None, "cadastro de MMGD ausente no silver"
    ufm = _par(con, "uf_mes_fonte", 3)
    dist = _par(con, "dist_uf_ano", 3)
    perfis = {d: _par(con, f"{d}_ano", 2) for d in ("classe", "modalidade", "porte", "tipo_consumidor")}
    fdet = _par(con, "fonte_detalhe_ano", 3)
    ucs = _serie_ref(con, DS_MMGD, "ucs_credito.uf_ano", 2)
    dmun = _par(con, "dist_mun", 2)  # vazio se a vintage foi importada antes da versão 2
    dmc = _par(con, "dist_mun_cep", 5)  # vazio se a vintage foi importada antes da versão 3
    conj = base.registros_como_estavam_em(con, DS_CONTROLE).get("conjunto") or {}
    muns_dist = dict(base.serie_vigente(con, DS_MMGD, "municipios.dist"))
    nomes_dist = base.registros_como_estavam_em(con, DS_DIST)
    cad_ibge = base.registros_como_estavam_em(con, DS_IBGE_MUN)
    pops, ano_pop = _pop(con)
    snap = c.snapshot_de(con, DS_MMGD)
    snap_ibge = c.snapshot_de(con, DS_IBGE)
    ano_conj = int(data_conj[:4])
    ano_ref = ano_conj - 1  # último ano completo antes da data do cadastro

    # ---- validações físicas e identidades de agregação (seção 5.2 do contrato)
    tot_q, tot_kw, tot_sem = _soma3(mun.values())
    ident = {
        "uf_mes_fonte": sum(q for q, _, _ in ufm.values()),
        "dist_uf_ano": sum(q for q, _, _ in dist.values()),
        **{f"{d}_ano": sum(q for q, _, _ in v.values()) for d, v in perfis.items()},
        "fonte_detalhe_ano": sum(q for q, _, _ in fdet.values()),
        **({"dist_mun": sum(q for q, _, _ in dmun.values())} if dmun else {}),
        **({"dist_mun_cep": sum(q for q, _, _ in dmc.values())} if dmc else {}),
    }
    linhas = int(ctrl.get("linhas") or 0)
    criticos = []
    if ctrl.get("codigos_repetidos"):
        criticos.append(f"{int(ctrl['codigos_repetidos'])} códigos de empreendimento repetidos no arquivo")
    if tot_q != linhas:
        criticos.append(f"soma municipal ({tot_q}) difere das linhas do arquivo ({linhas})")
    for k, v in ident.items():
        if v != tot_q:
            criticos.append(f"agregado {k} soma {v} unidades, diferente de {tot_q}")
    if any(k < 0 for _, k, _ in mun.values()):
        criticos.append("potência negativa em agregado municipal")
    # unidades sem potência nos agregados = registros com potência ausente ou negativa (a
    # negativa fica fora da soma, como a ausente)
    sem_arquivo = int(ctrl.get("potencia_ausente") or 0) + int(ctrl.get("potencia_negativa") or 0)
    if tot_sem != sem_arquivo:
        criticos.append(f"agregados contam {tot_sem} unidades sem potência, e o arquivo tem {sem_arquivo}")
    if criticos:
        return None, "validação crítica: " + "; ".join(criticos)
    kw_ident = abs(sum(k for _, k, _ in ufm.values()) - tot_kw)

    # ---- totais e fontes
    por_fonte = defaultdict(lambda: [0, 0.0, 0])
    for (m, ano, f), v in mun.items():
        for i in range(3):
            por_fonte[f][i] += v[i]
    fontes = []
    for f in mmgd.ORDEM_FONTES:
        if f not in por_fonte:
            continue
        q, k, s = por_fonte[f]
        pmw = _kw_pub(k, q, s, mw=True)
        fontes.append({"fonte": f, "rotulo": mmgd.ROTULO_FONTE[f], "unidades": q, "potencia_mw": pmw, "unidades_sem_potencia": s,
                       "participacao_potencia_pct": _pct(k, tot_kw) if pmw is not None else None})
    municipios_com = {m for (m, _, _) in mun if m != "sem_municipio"}
    pop_br = pops.get("1")
    tot_ucs = sum(ucs.values())

    # ---- séries anual e mensal (Brasil)
    anual = defaultdict(lambda: {"q": 0, "kw": 0.0, "s": 0, "f": defaultdict(lambda: [0, 0.0, 0])})
    for (m, ano, f), (q, k, s) in mun.items():
        a = anual[ano]
        a["q"] += q
        a["kw"] += k
        a["s"] += s
        a["f"][f][0] += q
        a["f"][f][1] += k
        a["f"][f][2] += s
    # Anos e meses sem nenhuma conexão no cadastro entre a primeira data válida e a data do
    # cadastro entram com zero explícito dentro da cobertura declarada (o arquivo é o
    # cadastro completo), e um gráfico não pode ligar os pontos por cima deles. Antes da
    # cobertura declarada, o período sem registro fica nulo e rotulado (_ponto_serie).
    anos_validos = sorted(int(x) for x in anual if x != mmgd.SEM_DATA)
    serie_anual, acq, ackw = [], 0, 0.0
    for ano_i in (range(anos_validos[0], max(ano_conj, anos_validos[-1]) + 1) if anos_validos else ()):
        a = anual.get(str(ano_i))
        q, k, s = (a["q"], a["kw"], a["s"]) if a else (0, 0.0, 0)
        acq += q
        ackw += k
        serie_anual.append({
            "ano": ano_i, **_ponto_serie(q, k, s, _cobertura_ano(ano_i)),
            "por_fonte": ({f: {"unidades": v[0], "potencia_mw": _kw_pub(v[1], v[0], v[2], mw=True)} for f, v in sorted(a["f"].items())}
                          if a else {}),
            "acumulado_unidades": acq, "acumulado_mw": _mw(ackw),
            "parcial": ano_i >= ano_conj,
        })
    sem_data = anual.get(mmgd.SEM_DATA)
    mensal_br = defaultdict(lambda: [0, 0.0, 0])
    for (uf, mes, f), v in ufm.items():
        for i in range(3):
            mensal_br[mes][i] += v[i]
    corte_prov = _mes_menos(data_conj[:7], MESES_PROVISORIOS)
    meses_validos = sorted(x for x in mensal_br if x != mmgd.SEM_DATA)
    serie_mensal, acq_m, ackw_m = [], 0, 0.0
    estoque_fim_mes = {}
    for mes in (_meses(meses_validos[0], max(data_conj[:7], meses_validos[-1])) if meses_validos else ()):
        q, k, s = mensal_br[mes] if mes in mensal_br else (0, 0.0, 0)
        acq_m += q
        ackw_m += k
        estoque_fim_mes[mes] = ackw_m
        serie_mensal.append({"m": mes, **_ponto_serie(q, k, s, _cobertura_mes(mes)),
                             "acumulado_unidades": acq_m, "acumulado_mw": _mw(ackw_m), "provisorio": mes > corte_prov})
    # identidade de estoque: conexões com data (anual por município; mensal por UF) + sem
    # data = total cadastrado (o estoque da série não alcança o total sem os registros com
    # data sentinela, e é isso que a regra explica)
    sem_q = sem_data["q"] if sem_data else 0
    sem_kw = sem_data["kw"] if sem_data else 0.0
    sem_ufm = mensal_br.get(mmgd.SEM_DATA, [0, 0.0, 0])
    ident_estoque = {
        "unidades_total": tot_q, "unidades_sem_data": sem_q,
        "unidades_com_data_serie_anual": acq, "unidades_com_data_serie_mensal": acq_m,
        "potencia_kw_total": c.r(tot_kw, 2), "potencia_kw_sem_data": c.r(sem_kw, 2),
        "potencia_kw_com_data_serie_anual": c.r(ackw, 2), "potencia_kw_com_data_serie_mensal": c.r(ackw_m, 2),
        "diferenca_unidades": max(abs(acq + sem_q - tot_q), abs(acq_m + sem_ufm[0] - tot_q)),
        "diferenca_kw": c.r(max(abs(ackw + sem_kw - tot_kw), abs(ackw_m + sem_ufm[1] - tot_kw)), 4),
        "tolerancia_kw": TOL_ESTOQUE_KW,
        "regra": "estoque acumulado até a data do cadastro (série anual e série mensal) + unidades sem data de conexão = total do cadastro",
    }
    ident_estoque["resultado"] = ("aprovada" if ident_estoque["diferenca_unidades"] == 0
                                  and ident_estoque["diferenca_kw"] <= TOL_ESTOQUE_KW else "reprovada")
    if ident_estoque["resultado"] != "aprovada":
        return None, (f"validação crítica: estoque por data + sem data difere do total ({ident_estoque['diferenca_unidades']} "
                      f"unidades, {ident_estoque['diferenca_kw']} kW)")
    anteriores = [x for x in serie_anual if x.get("cobertura_declarada") and x["unidades"]]
    cobertura_series = {
        "inicio_declarado": INICIO_COB_DECL,
        "regra": ("A ANEEL declara a cobertura da relação a partir de dezembro de 2008. Dentro dela, período sem conexão no cadastro "
                  "é zero explícito; antes dela (e no ano de 2008, coberto só em dezembro), período sem registro fica nulo, e "
                  "registro existente é publicado como está, com o rótulo de cobertura."),
        "unidades_anteriores": int(ctrl.get("anterior_cobertura_declarada") or 0),
        "anos_com_registro_anterior": [{"ano": x["ano"], "unidades": x["unidades"], "potencia_mw": x["potencia_mw"]} for x in anteriores],
        "pontos_nulos_anual": sum(1 for x in serie_anual if x["unidades"] is None),
        "pontos_nulos_mensal": sum(1 for x in serie_mensal if x["unidades"] is None),
    }

    # ---- UFs
    ufs, uf_anual = _tabela_ufs(ufm, ucs, pops, ano_ref, ano_conj, tot_kw)

    # ---- unidades com município fora da área da distribuidora (sinalizadas, não corrigidas)
    area, area_info = _area_distribuidoras(con)
    fora = _fora_da_area(dmun, area) if (dmun and area) else None
    classes = _classes_fora_da_area(dmc, area) if (fora is not None and dmc) else None
    if classes is not None and classes["unidades"] != fora["unidades"]:
        return None, (f"validação crítica: classes das unidades fora da área somam {classes['unidades']} unidades, "
                      f"e a sinalização tem {fora['unidades']}")

    # ---- distribuidoras (chave: CNPJ)
    distribuidoras = _tabela_distribuidoras(dist, nomes_dist, muns_dist, ano_ref, area, fora, classes)

    # ---- perfis
    def perfil(d):
        tot = defaultdict(lambda: [0, 0.0, 0])
        ref = defaultdict(lambda: [0, 0.0, 0])
        for (cat, ano), v in d.items():
            for i in range(3):
                tot[cat][i] += v[i]
                if ano == str(ano_ref):
                    ref[cat][i] += v[i]
        return [{"categoria": cat, "unidades": v[0], "potencia_mw": _kw_pub(v[1], v[0], v[2], mw=True), "unidades_sem_potencia": v[2],
                 "participacao_unidades_pct": _pct(v[0], tot_q),
                 "unidades_ano_referencia": ref[cat][0],
                 "potencia_mw_ano_referencia": _kw_pub(ref[cat][1], ref[cat][0], ref[cat][2], mw=True)}
                for cat, v in sorted(tot.items(), key=lambda x: -x[1][1])]
    perfis_pub = {d: perfil(v) for d, v in perfis.items()}
    fdet_tot = defaultdict(lambda: [0, 0.0, 0])
    for (tipo, desc, ano), v in fdet.items():
        for i in range(3):
            fdet_tot[(tipo, desc)][i] += v[i]
    fontes_detalhe = [{"tipo": t, "descricao": dsc, "unidades": v[0], "potencia_kw": _kw_pub(v[1], v[0], v[2]), "unidades_sem_potencia": v[2]}
                      for (t, dsc), v in sorted(fdet_tot.items(), key=lambda x: -x[1][1])]

    # ---- municípios
    m_tot = defaultdict(lambda: {"q": 0, "kw": 0.0, "s": 0, "ref_q": 0, "ref_kw": 0.0, "ref_s": 0, "ant_kw": 0.0, "ant_s": 0,
                                 "f": defaultdict(float)})
    for (m, ano, f), (q, k, s) in mun.items():
        x = m_tot[m]
        x["q"] += q
        x["kw"] += k
        x["s"] += s
        x["f"][f] += k
        if ano == str(ano_ref):
            x["ref_q"] += q
            x["ref_kw"] += k
            x["ref_s"] += s
        elif ano != mmgd.SEM_DATA and int(ano) < ano_ref:
            x["ant_kw"] += k
            x["ant_s"] += s
    todos = sorted(set(cad_ibge) | {m for m in m_tot if m != "sem_municipio"})
    municipios = []
    for m in todos:
        x = m_tot.get(m)
        info = cad_ibge.get(m, {})
        pop = pops.get(m)
        q = x["q"] if x else 0
        kw = x["kw"] if x else 0.0
        s = x["s"] if x else 0
        kw_pub = _kw_pub(kw, q, s)
        ref_kw = _kw_pub(x["ref_kw"], x["ref_q"], x["ref_s"]) if x else 0.0
        # estoque anterior com unidade sem potência: crescimento ausente (denominador incompleto)
        ant_kw = (None if x["ant_s"] else c.r(x["ant_kw"], 2)) if x else 0.0
        fq, fkw = fora["por_mun"].get(m, (0, 0.0)) if fora is not None else (None, None)
        cm = classes["por_mun"].get(m) if classes is not None else None
        municipios.append({
            "ibge": m, "nome": info.get("nome"), "uf": info.get("uf") or mmgd.UF_POR_CODIGO.get(m[:2]),
            "unidades": q, "potencia_kw": kw_pub, "unidades_sem_potencia": s, "populacao": int(pop) if pop else None,
            "w_por_habitante": c.r(kw * 1000 / pop, 1) if pop and kw_pub is not None else None,
            "unidades_por_mil_habitantes": c.r(q * 1000 / pop, 2) if pop else None,
            "unidades_ano_referencia": x["ref_q"] if x else 0,
            "potencia_kw_ano_referencia": ref_kw,
            "potencia_kw_estoque_ano_anterior": ant_kw,
            # crescimento só com numerador e denominador completos (sem unidade sem potência)
            "crescimento_estoque_pct": (c.r(100 * x["ref_kw"] / x["ant_kw"], 1)
                                        if x and x["ant_kw"] and not x["ant_s"] and not x["ref_s"] else None),
            "fonte_principal": max(x["f"], key=x["f"].get) if x and x["f"] else None,
            # unidades cuja distribuidora (CNPJ) não tem conjunto elétrico na UF deste município
            "unidades_distribuidora_fora_da_uf": fq,
            "potencia_kw_distribuidora_fora_da_uf": c.r(fkw, 2) if fkw is not None else None,
            "sinal_distribuidora_fora_da_uf": (fq > 0) if fq is not None else None,
            # dessas, as que o CEP põe na área da distribuidora (provavelmente não estão neste
            # município) e as que CEP, código e UF publicada põem neste município (o erro
            # provável é o CNPJ); null = classes indisponíveis
            "unidades_provavel_municipio_errado": (cm["provavel_municipio_errado"][0] if cm else 0) if classes is not None else None,
            "potencia_kw_provavel_municipio_errado": (c.r(cm["provavel_municipio_errado"][1], 2) if cm else 0.0) if classes is not None else None,
            "unidades_provavel_distribuidora_errada": (cm["provavel_distribuidora_errada"][0] if cm else 0) if classes is not None else None,
            "potencia_kw_provavel_distribuidora_errada": ((c.r(cm["provavel_distribuidora_errada"][1], 2) if cm else 0.0)
                                                          if classes is not None else None),
            "no_cadastro_ibge": m in cad_ibge,
        })
    com_pop = [x for x in municipios if x["populacao"]]
    # rankings e quantis só com potência completa: município com unidade sem potência tem soma
    # parcial (rotulada no CSV) e não compete
    completos = [x for x in municipios if not x["unidades_sem_potencia"]]
    maior_pot = sorted((x for x in completos if x["unidades"]), key=lambda x: -x["potencia_kw"])[:15]
    grandes = [x for x in completos if x["populacao"] and x["populacao"] >= POP_MINIMA_RANKING and x["w_por_habitante"] is not None]
    maior_whab = sorted(grandes, key=lambda x: -x["w_por_habitante"])[:15]
    menor_whab = sorted(grandes, key=lambda x: x["w_por_habitante"])[:15]
    maior_cresc = sorted((x for x in grandes if x["crescimento_estoque_pct"] is not None),
                         key=lambda x: -x["crescimento_estoque_pct"])[:15]
    whab = [x["w_por_habitante"] for x in com_pop if x["w_por_habitante"] is not None and not x["unidades_sem_potencia"]]
    distrib = {"quantis_w_por_habitante": {f"p{int(q * 100)}": c.r(c.quantil(whab, q), 1) for q in (0.1, 0.25, 0.5, 0.75, 0.9)},
               "municipios_com_populacao": len(com_pop),
               "municipios_com_potencia_parcial": sum(1 for x in municipios if x["unidades_sem_potencia"]),
               "municipios_sem_mmgd": sum(1 for x in municipios if x["no_cadastro_ibge"] and not x["unidades"]),
               "municipios_no_cadastro_ibge": len(cad_ibge)}

    # ---- controles e revisões
    dup_linhas = int(ctrl.get("duplicidade_candidata_linhas_extras") or 0)
    fv_par = ctrl.get("fv_pareados_por_codigo")
    fv_ok = fv_par is not None and ctrl.get("fv_datas_iguais") == fv_par
    controles = {
        "linhas_do_arquivo": linhas,
        "codigos_distintos": int(ctrl.get("codigos_distintos") or 0),
        "codigos_repetidos": int(ctrl.get("codigos_repetidos") or 0),
        "identidade_agregacao": {"unidades": tot_q, "diferenca_kw_municipio_uf": c.r(kw_ident, 4), "resultado": "aprovada"},
        "identidade_estoque": ident_estoque,
        "cobertura_das_series": cobertura_series,
        "data_conexao_minima": conj.get("data_conexao_minima"),
        "data_conexao_maxima": conj.get("data_conexao_maxima"),
        "periodo_referencia_publicado": conj.get("periodo_referencia"),
        "datas_sentinela": int(ctrl.get("data_invalida") or 0),
        "datas_ausentes": int(ctrl.get("data_ausente") or 0),
        "potencia_sem_data_kw": c.r(sem_data["kw"], 2) if sem_data else 0.0,
        "anteriores_cobertura_declarada": int(ctrl.get("anterior_cobertura_declarada") or 0),
        "datas_posteriores_ao_conjunto": int(ctrl.get("data_posterior_ao_conjunto") or 0),
        "potencia_zero": int(ctrl.get("potencia_zero") or 0),
        "potencia_ausente": int(ctrl.get("potencia_ausente") or 0),
        "potencia_negativa": int(ctrl.get("potencia_negativa") or 0),
        "unidades_sem_potencia_nos_agregados": tot_sem,
        "fonte_nao_informada": int(ctrl.get("fonte_nao_informada") or 0),
        "municipio_codigo_6_digitos_completado": int(ctrl.get("municipio_completado_6") or 0),
        "municipio_fora_cadastro_ibge": int(ctrl.get("municipio_fora_ibge") or 0),
        "municipio_invalido": int(ctrl.get("municipio_invalido") or 0),
        "uf_publicada_ausente": int(ctrl.get("uf_publicada_ausente") or 0),
        "uf_publicada_diverge_do_municipio": int(ctrl.get("uf_publicada_diverge_do_municipio") or 0),
        "uf_do_codigo_empreendimento_diverge": int(ctrl.get("uf_do_codigo_diverge") or 0),
        "sigla_distribuidora_ausente": int(ctrl.get("sigla_distribuidora_ausente") or 0),
        "duplicidade_candidata": {
            "grupos": int(ctrl.get("duplicidade_candidata_grupos") or 0), "linhas_extras": dup_linhas,
            "potencia_kw_extras": ctrl.get("duplicidade_candidata_kw_extras"),
            "maior_grupo": int(ctrl.get("duplicidade_candidata_maior_grupo") or 0),
            "participacao_unidades_pct": c.r(100 * dup_linhas / tot_q, 2) if tot_q else None,
            "tratamento": "medida e publicada, não removida: CPF e CEP de pessoa física vêm tarjados e unidades iguais do mesmo titular podem ser legítimas",
        },
        "distribuidora_fora_da_uf": _controle_fora_da_area(fora, area, area_info, dmun, tot_q, classes, dmc),
        "data_de_conexao": {
            "ufv_na_relacao": int(ctrl["fv_ufv_na_relacao"]) if "fv_ufv_na_relacao" in ctrl else None,
            "pareados_por_codigo": int(fv_par) if fv_par is not None else None,
            "datas_iguais": int(ctrl["fv_datas_iguais"]) if "fv_datas_iguais" in ctrl else None,
            "potencias_iguais": int(ctrl["fv_potencias_iguais"]) if "fv_potencias_iguais" in ctrl else None,
            "resultado": ("aprovada" if fv_ok else "pendente") if fv_par is not None else "sem captura do recurso técnico",
            "descricao": "DthAtualizaCadastralEmpreend (relação) comparada, pelo código, com DatConexao (informações técnicas fotovoltaicas, 'Data da conexão da Unidade Geradora').",
        },
    }
    revisoes = _revisoes_mmgd(con, data_conj)
    unidades_ev, potencia_ev = _evidencias_mmgd(con, tot_q, tot_kw, data_conj, serie_anual, controles, revisoes, linhas)
    lim = [
        "Capacidade cadastrada (kW instalados) não é energia gerada: a geração depende de sol, perdas e uso, e não é publicada por unidade.",
        "O cadastro é o vigente na data do arquivo: unidades desativadas e excluídas não aparecem no histórico; a série por ano é das unidades que continuam cadastradas.",
        (f"Os meses mais recentes são provisórios: o arquivo reúne as conexões que as distribuidoras enviaram até a data do cadastro, e "
         f"conexões desses meses ainda podem entrar em capturas seguintes (a magnitude só é medida comparando capturas). Aqui, os "
         f"{MESES_PROVISORIOS} meses anteriores à data do cadastro ficam marcados como provisórios, e a queda das conexões nesses meses "
         "não tem causa atribuída. A ANEEL declara, para outro período, a suspensão da atualização de 23/09/2025 a 13/11/2025 na troca "
         "de sistema e a inserção mais lenta nos meses seguintes."),
        _texto_local_do_credito(perfis_pub.get("modalidade") or []),
        "Potência por habitante relaciona o território, não a renda de quem instalou: nada aqui permite inferir renda ou perfil de um beneficiário individual.",
        "Duplicidade candidata (mesmos atributos observáveis e códigos distintos) é medida e não removida; a proporção está nos controles.",
        ("A ANEEL declara a cobertura do cadastro a partir de dezembro de 2008. "
         + ("O registro com data anterior é publicado como está, rotulado" if cobertura_series["unidades_anteriores"] == 1 else
            f"Os {_br(cobertura_series['unidades_anteriores'])} registros com data anterior são publicados como estão, rotulados")
         + " como fora da cobertura; anos e meses anteriores sem registro ficam nulos (não zero), porque fora da cobertura a falta de "
         "registro não prova que não houve conexão."),
    ]
    if tot_sem:
        lim.append(f"{_br(tot_sem)} unidades estão sem potência informada: contam nas unidades e ficam fora da soma de kW; todo "
                   "agregado com essas unidades traz unidades_sem_potencia (potência parcial), e o que só tem unidades sem potência "
                   "fica com a potência nula.")
    if fora is not None:
        lim.append(_texto_fora_da_area(fora, classes))
    else:
        lim.append("A conferência da área de atuação da distribuidora (CNPJ × UF dos conjuntos elétricos) não está disponível nesta "
                   "publicação; unidades com código de município ou CNPJ de outra área de concessão não estão sinalizadas.")
    prov = c.proveniencia(
        indicador="Micro e minigeração distribuída: unidades e potência instalada cadastradas", natureza="OBSERVADO",
        fonte=FONTE_ANEEL, unidade="unidades e kW (MW nas tabelas)", frequencia="cadastro publicado pela ANEEL (diário no portal; mensal pelo dicionário)",
        periodo={"inicio": f"{serie_anual[0]['ano']}-01-01" if serie_anual else data_conj, "fim": data_conj},
        cobertura={"inicio": INICIO_COB_DECL, "fim": data_conj}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["agregação por município (código IBGE) × ano de conexão × fonte", "agregação por UF × mês × fonte, por distribuidora (CNPJ) × UF × ano e por classe, modalidade, porte e tipo de consumidor",
                        "código de município de 6 dígitos completado pelo cadastro IBGE quando o prefixo é único", "datas sentinela (ano < 2000) tratadas como sem data",
                        "unidades fora da área da distribuidora separadas em classes pelo prefixo do CEP publicado (5 dígitos), pela UF do código do empreendimento e pela UF publicada; nada corrigido"],
        limitacoes=lim, download="/energia/series/transicao_mmgd_municipio_ano_fonte.csv",
        notas_fonte=(ckan.meta_local(DS_MMGD).get("notas") or None))
    lim_hab = lim[:1] + lim[-1:]
    if classes is not None:
        lim_hab.append(
            "Em município com unidades da classe de provável município errado (CEP numa UF da área da distribuidora), a potência por "
            "habitante inclui unidades que provavelmente ficam em outro município e pode estar inflada; a contagem e os kW dessa classe "
            "estão no CSV municipal para refazer a razão sem elas. Unidades da classe de provável distribuidora errada (CEP, código e "
            "UF publicada na UF do município) provavelmente ficam no município publicado: não inflam a razão municipal, e sim o total "
            "da distribuidora informada.")
    elif fora is not None:
        lim_hab.append("Em município sinalizado, a potência por habitante inclui as unidades de distribuidora sem conjunto na UF; sem as "
                       "classes por CEP nesta publicação, não se sabe quantas delas ficam de fato em outro município.")
    lim_hab += [f"População estimada pelo IBGE para {ano_pop} (data de referência 1º de julho), não o Censo.",
                f"Rankings por habitante só entre municípios com pelo menos {_br(POP_MINIMA_RANKING)} habitantes estimados: com denominador pequeno, uma única minigeração domina a razão."]
    prov_hab = c.proveniencia(
        indicador="Potência de MMGD por habitante e unidades por mil habitantes", natureza="CALCULADO",
        fonte={**FONTE_ANEEL, "recurso": FONTE_ANEEL["recurso"] + "; população: " + FONTE_IBGE["dataset"]},
        unidade="W por habitante; unidades por mil habitantes", frequencia="cadastro vigente",
        periodo={"inicio": data_conj, "fim": data_conj}, cobertura={"inicio": data_conj, "fim": data_conj},
        capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["potência cadastrada no território ÷ população residente estimada pelo IBGE"],
        formula="W/hab = Σ kW instalados × 1000 ÷ população estimada; unidades/mil hab = Σ unidades × 1000 ÷ população estimada",
        limitacoes=lim_hab, download="/energia/series/transicao_mmgd_municipios.csv")
    return {
        "data_cadastro": data_conj,
        "ano_referencia": ano_ref,
        "ano_populacao": int(ano_pop) if ano_pop else None,
        "resumo": {
            "unidades": tot_q, "potencia_mw": _kw_pub(tot_kw, tot_q, tot_sem, mw=True), "potencia_kw": _kw_pub(tot_kw, tot_q, tot_sem),
            "unidades_sem_potencia": tot_sem,
            "municipios_com_mmgd": len(municipios_com), "municipios_no_cadastro_ibge": len(cad_ibge),
            "ucs_recebem_credito": int(tot_ucs),
            "participacao_solar_potencia_pct": next((f["participacao_potencia_pct"] for f in fontes if f["fonte"] == "solar"), None),
            "populacao_brasil": int(pop_br) if pop_br else None,
            "w_por_habitante_brasil": c.r(tot_kw * 1000 / pop_br, 1) if pop_br and tot_sem < tot_q else None,
            "unidades_sem_data": sem_q,
            "ultima_data_conexao": conj.get("data_conexao_maxima"),
            "potencia_mw_ano_referencia": next((a["potencia_mw"] for a in serie_anual if a["ano"] == ano_ref), None),
            "unidades_ano_referencia": next((a["unidades"] for a in serie_anual if a["ano"] == ano_ref), None),
        },
        "evidencias": {"unidades": unidades_ev, "potencia": potencia_ev},
        "fontes": fontes, "fontes_detalhe": fontes_detalhe,
        "anual": serie_anual, "mensal": serie_mensal, "corte_provisorio": corte_prov,
        "ufs": ufs, "uf_anual": uf_anual,
        "distribuidoras": distribuidoras,
        "perfis": perfis_pub,
        "municipios_destaque": {
            "maior_potencia": [_mun_curto(x) for x in maior_pot],
            "maior_w_por_habitante": [_mun_curto(x) for x in maior_whab],
            "menor_w_por_habitante": [_mun_curto(x) for x in menor_whab],
            "maior_crescimento_estoque": [_mun_curto(x) for x in maior_cresc],
            "populacao_minima_ranking": POP_MINIMA_RANKING,
        },
        "distribuicao_municipal": distrib,
        "controles": controles, "revisoes": revisoes,
        "documentos": [DOC_ANEEL_MODALIDADES],
        "proveniencia": {"cadastro": prov, "por_habitante": prov_hab},
        "_municipios": municipios, "_mun_ano_fonte": mun, "_ufm": ufm, "_dist": dist, "_perfis": perfis, "_fdet": fdet,
        "_estoque_fim_mes": estoque_fim_mes, "_snap": snap, "_snap_ibge": snap_ibge, "_nomes_dist": nomes_dist, "_cad": cad_ibge,
        "_area": area if fora is not None else None,
    }, None


def _texto_local_do_credito(modalidades):
    """Limitação territorial do crédito, com as modalidades em que a energia compensa o
    consumo de outras unidades (contagem e potência do cadastro vigente; nomes das
    categorias como a ANEEL publica em DscModalidadeHabilitado)."""
    por = {x["categoria"]: x for x in modalidades}
    partes = []
    for cat, rotulo, como in (("Auto consumo remoto", "no autoconsumo remoto", "em outras unidades do mesmo titular"),
                              ("Compartilhada", "na geração compartilhada",
                               "no consumo dos participantes de consórcio, cooperativa, condomínio ou associação")):
        x = por.get(cat)
        if x:
            mw = f", {_br(x['potencia_mw'], 1)} MW" if x["potencia_mw"] is not None else ""
            partes.append(f"{rotulo} ({_br(x['unidades'])} unidades{mw}), a energia é compensada {como}")
    base_txt = "O local é o município da unidade com geração"
    if not partes:
        return base_txt + "; nas modalidades de autoconsumo remoto e de geração compartilhada, o crédito é usado em outras unidades, possivelmente em outro município."
    fecho = "Nos dois casos" if len(partes) == 2 else "Nesse caso"
    return (base_txt + "; " + "; ".join(partes) + f". {fecho}, o crédito pode ser usado em outro município (definições na página "
            "de geração distribuída da ANEEL).")


def _texto_fora_da_area(fora, classes):
    """Limitação das unidades fora da área da distribuidora, sem causa única: as classes
    pelo CEP dizem qual campo provavelmente está errado."""
    n_mun = sum(1 for v in fora["por_mun"].values() if v[0])
    t = (f"{_br(fora['unidades'])} unidades ({_br(fora['potencia_kw'] / 1000, 1)} MW) estão cadastradas em {_br(n_mun)} municípios de UF onde "
         "a distribuidora informada (CNPJ) não tem nenhum conjunto elétrico na base de continuidade da ANEEL: algum campo está errado na "
         "origem, e o arquivo não diz qual.")
    if classes is None:
        return t + (" Sem as classes por CEP nesta publicação, não se separa município errado de distribuidora errada. Nada é corrigido "
                    "nem removido: cada município traz a contagem e a potência dessas unidades.")
    a = classes["classes"]["provavel_municipio_errado"]
    b = classes["classes"]["provavel_distribuidora_errada"]
    i = classes["classes"]["indeterminada"]
    return t + (f" Pelo CEP publicado (5 dígitos), {_br(a[0])} unidades ({_br(a[1] / 1000, 1)} MW) ficam numa UF da área da distribuidora: "
                f"provável código de município errado. Outras {_br(b[0])} ({_br(b[1] / 1000, 1)} MW) têm CEP, código do empreendimento e UF "
                f"publicada na UF do município: provável CNPJ de distribuidora errado, e elas inflam o total da distribuidora informada, "
                f"não o do município. {_br(i[0])} ficam indeterminadas (CEP ausente, de preenchimento, numa terceira UF ou sinais "
                "divergentes). Nada é corrigido nem removido: cada município e cada distribuidora trazem a contagem e a potência de cada classe.")


def _tabela_ufs(ufm, ucs, pops, ano_ref, ano_conj, tot_kw):
    """(ufs, uf_anual) a partir do agregado UF × mês × fonte: estoque, razões por habitante
    (população da UF pelo código IBGE) e crescimento no ano de referência; uf_anual com
    zero explícito do primeiro ano com conexão na UF até o ano do cadastro, dentro da
    cobertura declarada (antes dela, ano sem registro fica nulo e rotulado)."""
    uf_tot = defaultdict(lambda: [0, 0.0, 0])
    uf_ano = defaultdict(lambda: [0, 0.0, 0])
    for (uf, mes, f), v in ufm.items():
        ano = mes[:4] if mes != mmgd.SEM_DATA else mmgd.SEM_DATA
        for i in range(3):
            uf_tot[uf][i] += v[i]
            uf_ano[(uf, ano)][i] += v[i]
    cod_uf = {v: k for k, v in mmgd.UF_POR_CODIGO.items()}
    ufs = []
    for uf in sorted(uf_tot, key=lambda u: -uf_tot[u][1]):
        q, k, s = uf_tot[uf]
        pop = pops.get(cod_uf.get(uf, ""))
        k_pub = _kw_pub(k, q, s, mw=True)
        ant = [v for (u, a), v in uf_ano.items() if u == uf and a != mmgd.SEM_DATA and int(a) < ano_ref]
        estoque_ant = sum(v[1] for v in ant)
        ant_sem = sum(v[2] for v in ant)
        rq, rk, rs = uf_ano.get((uf, str(ano_ref)), [0, 0.0, 0])
        k_ref = _kw_pub(rk, rq, rs, mw=True)
        ufs.append({
            "uf": uf, "nome": mmgd.NOME_UF.get(uf, uf), "unidades": q, "potencia_mw": k_pub, "unidades_sem_potencia": s,
            "participacao_potencia_pct": _pct(k, tot_kw) if k_pub is not None else None,
            "populacao": int(pop) if pop else None,
            "w_por_habitante": c.r(k * 1000 / pop, 1) if pop and k_pub is not None else None,
            "unidades_por_mil_habitantes": c.r(q * 1000 / pop, 2) if pop else None,
            "potencia_mw_ano_referencia": k_ref,
            # crescimento só com numerador e denominador completos (sem unidade sem potência)
            "crescimento_estoque_ano_referencia_pct": (c.r(100 * rk / estoque_ant, 1)
                                                       if estoque_ant and not ant_sem and not rs else None),
            "ucs_recebem_credito": int(sum(v for (u, _), v in ucs.items() if u == uf)),
        })
    uf_anual = []
    for u in sorted(uf_tot):
        anos_u = sorted(int(a) for (x, a) in uf_ano if x == u and a != mmgd.SEM_DATA)
        for a in (range(anos_u[0], max(ano_conj, anos_u[-1]) + 1) if anos_u else ()):
            q, k, s = uf_ano.get((u, str(a)), [0, 0.0, 0])
            uf_anual.append({"uf": u, "ano": a, **_ponto_serie(q, k, s, _cobertura_ano(a))})
    return ufs, uf_anual


def _tabela_distribuidoras(dist, nomes_dist, muns_dist, ano_ref, area, fora, classes=None):
    """Uma linha por distribuidora (chave: CNPJ) a partir do agregado CNPJ × UF × ano, com a
    distribuição por UF e, quando há referência de área, as unidades fora dela, separadas
    nas classes pelo CEP quando disponíveis."""
    d_tot = defaultdict(lambda: {"q": 0, "kw": 0.0, "s": 0, "ufs": Counter(), "ref": [0, 0.0, 0]})
    for (cnpj, uf, ano), (q, k, s) in dist.items():
        d = d_tot[cnpj]
        d["q"] += q
        d["kw"] += k
        d["s"] += s
        d["ufs"][uf] += q
        if ano == str(ano_ref):
            d["ref"][0] += q
            d["ref"][1] += k
            d["ref"][2] += s
    out = []
    for cnpj, d in sorted(d_tot.items(), key=lambda x: -x[1]["kw"]):
        nm = nomes_dist.get(cnpj, {})
        uf_princ, n_princ = d["ufs"].most_common(1)[0]
        com_ref = fora is not None and cnpj in area
        fora_d = fora["por_dist"].get(cnpj, {}) if com_ref else {}
        cd = classes["por_dist"].get(cnpj) if (com_ref and classes is not None) else None
        cls_d, aviso = None, None
        if cd:
            a = cd["classes"]["provavel_municipio_errado"]
            b = cd["classes"]["provavel_distribuidora_errada"]
            i = cd["classes"]["indeterminada"]
            ufs_b = sorted(cd["ufs_provavel_distribuidora_errada"])
            cls_d = {"provavel_municipio_errado": {"unidades": a[0], "potencia_mw": _mw(a[1])},
                     "provavel_distribuidora_errada": {"unidades": b[0], "potencia_mw": _mw(b[1]), "ufs": ufs_b},
                     "indeterminada": {"unidades": i[0], "potencia_mw": _mw(i[1])}}
            if b[0]:
                aviso = (f"O total inclui {_br(b[0])} unidades ({_br(b[1] / 1000, 3)} MW) cadastradas com este CNPJ em "
                         f"{', '.join(ufs_b)}, onde ele não tem conjunto elétrico, com CEP, código do empreendimento e UF publicada na "
                         "UF do município: provavelmente são de outra distribuidora e inflam o total desta.")
        out.append({
            "cnpj": cnpj, "sigla": nm.get("sigla"), "nome": nm.get("nome"),
            "siglas_publicadas": [s for s in (nm.get("siglas_publicadas") or "").split("; ") if s],
            "unidades": d["q"], "potencia_mw": _kw_pub(d["kw"], d["q"], d["s"], mw=True), "unidades_sem_potencia": d["s"],
            "unidades_ano_referencia": d["ref"][0], "potencia_mw_ano_referencia": _kw_pub(d["ref"][1], d["ref"][0], d["ref"][2], mw=True),
            "municipios": int(muns_dist.get(cnpj, 0)),
            "uf_principal": uf_princ,
            "unidades_fora_uf_principal": d["q"] - n_princ,
            "ufs_area_conjuntos": sorted(area[cnpj]) if com_ref else None,
            "unidades_fora_da_area": sum(v[0] for v in fora_d.values()) if com_ref else None,
            "potencia_mw_fora_da_area": _mw(sum(v[1] for v in fora_d.values())) if com_ref else None,
            "ufs_fora_da_area": sorted(fora_d) if com_ref else None,
            # classes pelo CEP das unidades fora da área; null sem unidade fora ou sem as classes
            "classes_fora_da_area": cls_d,
            "aviso_total": aviso,
            "ufs": [{"uf": u, "unidades": n} for u, n in d["ufs"].most_common()],
        })
    return out


def _fora_da_area(dmun, area):
    """Unidades cadastradas num município de UF onde a distribuidora (CNPJ) não tem nenhum
    conjunto elétrico na base de continuidade da ANEEL. Comparação só por CNPJ × UF (a UF
    vem do código IBGE do município publicado); nada de nome de município ou distribuidora.

    Devolve {"por_mun": {mun: (unidades, kW)}, "por_dist": {cnpj: {uf: (unidades, kW)}},
    "sem_referencia": {cnpj: unidades}, "unidades", "potencia_kw"}. CNPJ sem conjunto na base
    fica em sem_referencia: não é sinalizado (falta a referência, não a área). kW = soma das
    potências informadas."""
    por_mun = defaultdict(lambda: [0, 0.0])
    por_dist = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))
    sem_ref = Counter()
    for (cnpj, m), v in dmun.items():
        q, k = v[0], v[1]
        if cnpj not in area:
            sem_ref[cnpj] += q
            continue
        uf = mmgd.uf_municipio(m)
        if uf is None or uf in area[cnpj]:
            continue
        por_mun[m][0] += q
        por_mun[m][1] += k
        por_dist[cnpj][uf][0] += q
        por_dist[cnpj][uf][1] += k
    return {"por_mun": {m: tuple(v) for m, v in por_mun.items()},
            "por_dist": {cn: {uf: tuple(v) for uf, v in ufs.items()} for cn, ufs in por_dist.items()},
            "sem_referencia": dict(sem_ref),
            "unidades": sum(v[0] for v in por_mun.values()), "potencia_kw": sum(v[1] for v in por_mun.values())}


def _classes_fora_da_area(dmc, area):
    """Classes das unidades fora da área da distribuidora pelo CEP publicado (regras em
    fontes/aneel_transicao.py, `classe_fora_da_area`), a partir do agregado distribuidora ×
    município × prefixo do CEP × UF do código × UF publicada.

    Devolve {"classes": {classe: [unidades, kW]}, "motivos": {motivo: [unidades, kW]},
    "por_mun": {mun: {classe: [unidades, kW]}}, "por_dist": {cnpj: {"classes", "ufs_*"}},
    "referencia": resumo da referência de UF por prefixo, "unidades"}."""
    ref5, ref3, resumo = mmgd.referencia_uf_cep(dmc, area)
    novo = lambda: {k: [0, 0.0] for k in mmgd.CLASSES_FORA}  # noqa: E731
    classes, motivos = novo(), {k: [0, 0.0] for k in mmgd.MOTIVOS_INDETERMINADA}
    por_mun = defaultdict(novo)
    por_dist = defaultdict(lambda: {"classes": novo(), "ufs_provavel_distribuidora_errada": set(),
                                    "ufs_provavel_municipio_errado": set()})
    via3 = 0
    for (cn, m, p, uc, up), (q, k, _s) in dmc.items():
        uf = mmgd.uf_municipio(m)
        if not mmgd.sinalizada(cn, uf, area):
            continue
        classe, motivo, uf_cep = mmgd.classe_fora_da_area(cn, m, p, uc, up, area, ref5, ref3)
        if uf_cep is not None and not ref5.get(p):
            via3 += q
        for alvo in (classes[classe], por_mun[m][classe], por_dist[cn]["classes"][classe]):
            alvo[0] += q
            alvo[1] += k
        if motivo:
            motivos[motivo][0] += q
            motivos[motivo][1] += k
        if classe == "provavel_distribuidora_errada":
            por_dist[cn]["ufs_provavel_distribuidora_errada"].add(uf)
        elif classe == "provavel_municipio_errado":
            por_dist[cn]["ufs_provavel_municipio_errado"].add(uf)
    return {"classes": classes, "motivos": motivos, "por_mun": dict(por_mun), "por_dist": dict(por_dist),
            "referencia": {**resumo, "unidades_classificadas_pelo_prefixo_3": via3},
            "unidades": sum(v[0] for v in classes.values())}


def _mun_curto(x):
    """Município nos destaques (rankings só têm potência completa). Da sinalização fora da
    área, vai a classe que afeta a razão por habitante (provável município errado)."""
    return {k: x[k] for k in ("ibge", "nome", "uf", "unidades", "potencia_kw", "populacao", "w_por_habitante",
                              "potencia_kw_ano_referencia", "crescimento_estoque_pct", "unidades_distribuidora_fora_da_uf",
                              "potencia_kw_distribuidora_fora_da_uf", "sinal_distribuidora_fora_da_uf",
                              "unidades_provavel_municipio_errado", "potencia_kw_provavel_municipio_errado")}


CAMPOS_MUNICIPIO = ("ibge", "nome", "uf", "unidades", "potencia_kw", "unidades_sem_potencia", "populacao", "w_por_habitante",
                    "unidades_por_mil_habitantes", "unidades_ano_referencia", "potencia_kw_ano_referencia",
                    "potencia_kw_estoque_ano_anterior", "crescimento_estoque_pct", "fonte_principal",
                    "unidades_distribuidora_fora_da_uf", "potencia_kw_distribuidora_fora_da_uf",
                    "unidades_provavel_municipio_errado", "potencia_kw_provavel_municipio_errado",
                    "unidades_provavel_distribuidora_errada", "potencia_kw_provavel_distribuidora_errada")


REGRA_UF_CEP = ("UF do CEP = UF (pelo código IBGE do município) que reúne pelo menos 90% das unidades não sinalizadas do cadastro com o "
                "mesmo prefixo de 5 dígitos; prefixo sem unidade não sinalizada, ou sem UF que chegue a 90%, usa o de 3 dígitos pela "
                "mesma regra; prefixo com os "
                "cinco dígitos iguais (ex.: 77777) é preenchimento. A tabela oficial de faixas de CEP por UF dos Correios só é "
                "consultável com verificação humana, que não é contornada.")


def _controle_fora_da_area(fora, area, area_info, dmun, tot_q, classes=None, dmc=None):
    """Bloco de controle da área de atuação: magnitude, alcance, classes pelo CEP e referência usada."""
    if fora is None:
        motivo = ("cadastro importado sem o agregado distribuidora × município" if not dmun
                  else "conjuntos elétricos da ANEEL ausentes no silver")
        return {"disponivel": False, "motivo": motivo}
    maiores = sorted(((m, v) for m, v in fora["por_mun"].items() if v[0]), key=lambda x: -x[1][0])[:10]
    por_dist = sorted(((cn, sum(v[0] for v in ufs.values()), sum(v[1] for v in ufs.values()), sorted(ufs))
                       for cn, ufs in fora["por_dist"].items()), key=lambda x: -x[1])
    caps = [x for snap in area_info["snapshots"] for x in snap.get("capturas", [])]
    if classes is not None:
        bloco_classes = {
            "disponivel": True,
            "classes": [{"classe": k, "rotulo": mmgd.ROTULO_CLASSE_FORA[k], "unidades": v[0], "potencia_kw": c.r(v[1], 2),
                         "municipios": sum(1 for x in classes["por_mun"].values() if x[k][0]),
                         "distribuidoras": sum(1 for x in classes["por_dist"].values() if x["classes"][k][0])}
                        for k, v in classes["classes"].items()],
            "indeterminadas_por_motivo": [{"motivo": k, "unidades": v[0], "potencia_kw": c.r(v[1], 2)}
                                          for k, v in classes["motivos"].items()],
            "referencia_uf_do_cep": {"regra": REGRA_UF_CEP, "participacao_minima": mmgd.PARTICIPACAO_MINIMA_UF_CEP,
                                     **classes["referencia"]},
            "orientacao": ("Para refazer a potência por habitante de um município sem as unidades que provavelmente estão em outro "
                           "município, desconte só a classe de provável município errado (colunas do CSV municipal). A classe de "
                           "provável distribuidora errada fica no município publicado e infla o total da distribuidora informada."),
        }
    else:
        bloco_classes = {"disponivel": False,
                         "motivo": ("cadastro importado sem o agregado distribuidora × município × CEP" if not dmc
                                    else "classes indisponíveis")}
    return {
        "disponivel": True,
        "unidades": fora["unidades"], "potencia_kw": c.r(fora["potencia_kw"], 2),
        "participacao_unidades_pct": _pct(fora["unidades"], tot_q),
        "municipios_sinalizados": sum(1 for v in fora["por_mun"].values() if v[0]),
        "distribuidoras_com_unidades_fora": len(por_dist),
        "distribuidoras_sem_referencia": len(fora["sem_referencia"]),
        "unidades_sem_referencia": sum(fora["sem_referencia"].values()),
        "distribuidoras_com_area": len(area),
        "classes_pelo_cep": bloco_classes,
        "maiores_municipios": [{"ibge": m, "unidades": v[0], "potencia_kw": c.r(v[1], 2)} for m, v in maiores],
        # as classes de cada distribuidora estão na tabela de distribuidoras (classes_fora_da_area)
        "por_distribuidora": [{"cnpj": cn, "unidades": q, "potencia_kw": c.r(k, 2), "ufs_fora": ufs} for cn, q, k, ufs in por_dist],
        "referencia": {
            "regra": ("UF atendida = UF de algum município de algum conjunto elétrico do CNPJ, em qualquer ano da base "
                      f"({area_info['anos']}); comparação só por CNPJ e código IBGE, sem nome"),
            "conjuntos_com_cnpj": area_info["conjuntos_com_cnpj"], "conjuntos_com_municipio": area_info["conjuntos_com_municipio"],
            "arquivos": [{"arquivo": x["recurso"], "sha256": x["sha256"], "capturado_em": x["capturado_em"],
                          "publicado_em": x.get("publicado_em")} for x in caps],
            "urls": [URL_LIM, URL_MUN],
        },
        "tratamento": ("sinalizadas e separadas em classes pelo CEP, não corrigidas nem removidas: o código de município e o CNPJ "
                       "são os publicados pela ANEEL"),
    }


def _mes_menos(mes, n):
    a, m = int(mes[:4]), int(mes[5:7]) - n
    while m <= 0:
        a, m = a - 1, m + 12
    return f"{a:04d}-{m:02d}"


def _revisoes_mmgd(con, data_conj):
    """Revisões entre capturas do cadastro: quanto mudou, por mês de conexão recente, o
    número de unidades e a potência entre a primeira e a última captura que o contêm."""
    vs = [v for v in base.vintages_do_dataset(con, DS_MMGD) if v["recurso"] == RECURSO_PARQUET]
    if len(vs) < 2:
        return {"capturas_comparadas": len(vs), "meses": [],
                "nota": "Uma única captura do cadastro integrada até aqui: as revisões por registro tardio serão medidas a partir da próxima captura."}
    primeira, ultima = vs[0]["capturado_em"], vs[-1]["capturado_em"]
    antes = {}
    for ref, v in base.como_estava_em(con, DS_MMGD, "kw.uf_mes_fonte", primeira):
        antes[ref] = v
    antes_q = dict(base.como_estava_em(con, DS_MMGD, "qtd.uf_mes_fonte", primeira))
    agora_kw = dict(base.serie_vigente(con, DS_MMGD, "kw.uf_mes_fonte"))
    agora_q = dict(base.serie_vigente(con, DS_MMGD, "qtd.uf_mes_fonte"))
    por_mes = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
    for ref in set(antes) | set(agora_kw):
        mes = ref.split("|")[1]
        if mes == mmgd.SEM_DATA:
            continue
        x = por_mes[mes]
        x[0] += antes_q.get(ref, 0.0)
        x[1] += agora_q.get(ref, 0.0)
        x[2] += antes.get(ref, 0.0)
        x[3] += agora_kw.get(ref, 0.0)
    ult12 = sorted(por_mes)[-18:]
    return {"capturas_comparadas": len(vs), "primeira_captura": primeira, "ultima_captura": ultima,
            "meses": [{"m": m, "unidades_primeira": int(por_mes[m][0]), "unidades_ultima": int(por_mes[m][1]),
                       "potencia_mw_primeira": _mw(por_mes[m][2]), "potencia_mw_ultima": _mw(por_mes[m][3])} for m in ult12]}


def _texto_revisoes_mmgd(rev):
    """Resumo textual das revisões entre capturas do cadastro, para a evidência."""
    if rev["capturas_comparadas"] < 2:
        return rev.get("nota") or "Uma única captura do cadastro integrada: revisões ainda não medidas."
    du = sum(m["unidades_ultima"] - m["unidades_primeira"] for m in rev["meses"])
    dmw = sum((m["potencia_mw_ultima"] or 0) - (m["potencia_mw_primeira"] or 0) for m in rev["meses"])
    return (f"{rev['capturas_comparadas']} capturas comparadas ({rev['primeira_captura'][:10]} a {rev['ultima_captura'][:10]}): "
            f"nos {len(rev['meses'])} meses de conexão mais recentes, {_br(du)} unidades e {_br(dmw, 1)} MW a mais "
            "na captura mais nova (registro tardio).")


def _evidencias_mmgd(con, tot_q, tot_kw, data_conj, serie_anual, controles, revisoes, linhas):
    """Evidências (evidencia.construir) de unidades e potência no cadastro vigente: arquivo
    Parquet da última vintage importada (URL do recurso no CKAN, cópia no bronze, sha256)."""
    vs = [x for x in base.vintages_do_dataset(con, DS_MMGD) if x["recurso"] == RECURSO_PARQUET]
    v = next((x for x in reversed(vs) if _vintage_importada(con, x["vintage_id"], versao=None)), None)  # a que gerou os números
    fonte = ev.fonte_de_vintage("ANEEL", FONTE_ANEEL["dataset"], URL_MMGD, v)
    dc = controles["data_de_conexao"]
    pareados, iguais, pot = dc["pareados_por_codigo"], dc["datas_iguais"], dc["potencias_iguais"]
    if pareados is None:
        rec = ev.reconciliacao("Recurso de informações técnicas fotovoltaicas do mesmo conjunto não capturado.", "ressalva",
                               "não aplicável sem o segundo recurso (0 empreendimentos)")
    else:
        ok = pareados == dc["ufv_na_relacao"] and iguais == pareados and pot == pareados
        rec = ev.reconciliacao(
            f"Outro arquivo do mesmo conjunto (informações técnicas fotovoltaicas): {_br(pareados)} de {_br(dc['ufv_na_relacao'])} "
            f"empreendimentos solares da relação encontrados pelo código, {_br(iguais)} com a mesma data de conexão e {_br(pot)} "
            "com a mesma potência instalada.",
            "aprovado" if ok else "ressalva", "0 empreendimentos de diferença; potência igual a 0,005 kW (centésimo publicado)")
    testes = [
        _teste("códigos únicos", controles["codigos_repetidos"] == 0,
               f"{_br(controles['codigos_distintos'])} códigos distintos em {_br(linhas)} linhas"),
        _teste("identidade de agregação", controles["identidade_agregacao"]["resultado"] == "aprovada",
               "soma por município = soma por UF e mês = soma por distribuidora = soma por classe, modalidade, porte e fonte = linhas do arquivo"),
        _teste("potência não negativa", controles["potencia_negativa"] == 0,
               f"{controles['potencia_negativa']} registros com potência negativa; {controles['potencia_zero']} com potência zero publicada"),
        ev.teste("duplicidade candidata", "ressalva" if controles["duplicidade_candidata"]["linhas_extras"] else "aprovado",
                 f"{_br(controles['duplicidade_candidata']['linhas_extras'])} unidades com todos os atributos observáveis iguais a outra "
                 f"({_br(controles['duplicidade_candidata']['participacao_unidades_pct'] or 0, 2)}% do total); medidas, não removidas"),
    ]
    inicio = f"{serie_anual[0]['ano']}-01-01" if serie_anual else data_conj
    comuns = dict(
        periodo={"inicio": inicio, "fim": data_conj}, entidade="Brasil",
        universo="empreendimentos de micro e minigeração distribuída no cadastro vigente da ANEEL (todas as distribuidoras que enviaram dados)",
        fonte=fonte, chaves_origem=["CodEmpreendimento (um registro por empreendimento)", f"DatGeracaoConjuntoDados = {data_conj}"],
        consulta="SELECT COUNT(*), SUM(MdaPotenciaInstaladaKW) FROM empreendimento-geracao-distribuida.parquet",
        cobertura=(f"estoque cadastrado em {c.data_br(data_conj)}; conexões desde {serie_anual[0]['ano'] if serie_anual else 'o início'}; "
                   f"cobertura declarada pela ANEEL a partir de {c.data_br(INICIO_COB_DECL)}"),
        tratamento_ausencia=("registro com data sentinela (ano 1900) conta no estoque, sem ano de conexão; potência ausente não vira zero: "
                             "a unidade conta, fica fora da soma de kW e o agregado traz unidades_sem_potencia "
                             f"({_br(controles['unidades_sem_potencia_nos_agregados'])} nesta publicação)"),
        revisoes=_texto_revisoes_mmgd(revisoes), testes=testes, reconciliacao=rec,
        download=[{"rotulo": "MMGD por município, ano e fonte (CSV)", "url": "/energia/series/transicao_mmgd_municipio_ano_fonte.csv"},
                  {"rotulo": "MMGD por município, com população (CSV)", "url": "/energia/series/transicao_mmgd_municipios.csv"}],
        reproducao=REPRODUCAO,
    )
    unidades = ev.construir(
        indicador="Unidades de micro e minigeração distribuída no cadastro da ANEEL", valor_exibido=_br(tot_q),
        valor_calculo=float(tot_q), unidade="empreendimentos",
        formula="unidades = número de códigos de empreendimento distintos no arquivo (um registro por empreendimento)", **comuns)
    potencia = ev.construir(
        indicador="Potência instalada de micro e minigeração distribuída no cadastro da ANEEL", valor_exibido=_br(tot_kw / 1000, 1),
        valor_calculo=tot_kw / 1000, unidade="MW",
        formula="potência = Σ MdaPotenciaInstaladaKW de todos os empreendimentos ÷ 1000 (capacidade cadastrada, não energia gerada)",
        **comuns)
    return unidades, potencia


# ---------------------------------------------------------------------------
# Gold: ONS (estimativa de MMGD) e relação com o cadastro
# ---------------------------------------------------------------------------

def _bloco_ons(con, con_p, estoque_fim_mes, corte_provisorio=None):
    """Estimativa de MMGD do ONS por submercado e SIN, e a razão rotulada com a capacidade
    cadastrada na ANEEL. A razão só é calculada em mês completo do ONS e não provisório no
    cadastro (até `corte_provisorio`): com registro tardio, o estoque recente da ANEEL está
    incompleto e a razão subiria por falta de denominador, não por mais geração."""
    # dia em curso na captura não é dia verificado: vale a data de Brasília da última
    # captura do mês de cada submercado (uma captura posterior do mesmo mês o libera)
    limite = {}
    for v in base.vintages_do_dataset(con, DS_ONS):
        partes = v["recurso"].rsplit("_", 2)
        if len(partes) == 3:
            limite[(partes[1], partes[2])] = _data_brasilia(v["capturado_em"])
    series = {}
    for sm in ons.AREAS:
        for s in ("mmgd_mwh", "horas_mmgd", "global_mwh", "horas_global", "semmmgd_mwh"):
            series[(s, sm)] = {d: v for d, v in base.serie_vigente(con, DS_ONS, f"{s}.{sm}")
                               if d < limite.get((ons.AREAS[sm], d[:7]), "9999")}
    if not any(series[("mmgd_mwh", sm)] for sm in ons.AREAS):
        return None
    snap = c.snapshot_de(con, DS_ONS)
    dias = sorted(set.union(*(set(series[("mmgd_mwh", sm)]) for sm in ons.AREAS)))

    def completo(sm, d):
        return series[("horas_mmgd", sm)].get(d, 0) >= 24 and series[("horas_global", sm)].get(d, 0) >= 24

    diario, dias_fora = [], []
    for d in dias:
        for sm in ons.AREAS:
            e = series[("mmgd_mwh", sm)].get(d)
            h = series[("horas_mmgd", sm)].get(d)
            if e is None or not h:
                continue
            g = series[("global_mwh", sm)].get(d)
            hg = series[("horas_global", sm)].get(d)
            diario.append([d, sm, c.r(e, 1), c.r(e / h, 1), h, c.r(g, 1) if g is not None else None,
                           c.r(g / hg, 1) if g is not None and hg else None, c.r(series[("semmmgd_mwh", sm)].get(d), 1)])
            # domínio diário (não crítico): MMGD negativa ou maior que a carga global do dia
            if e < 0 or (g is not None and e > g):
                dias_fora.append({"d": d, "submercado": sm, "mmgd_mwh": c.r(e, 1), "carga_global_mwh": c.r(g, 1)})
    por_mes = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0]))
    dias_sin = defaultdict(list)
    for d in dias:
        m = d[:7]
        todos = all(completo(sm, d) for sm in ons.AREAS)
        for sm in ons.AREAS:
            if not completo(sm, d):
                continue
            x = por_mes[m][sm]
            x[0] += series[("mmgd_mwh", sm)][d]
            x[1] += series[("horas_mmgd", sm)][d]
            x[2] += series[("global_mwh", sm)][d]
            x[3] += series[("horas_global", sm)][d]
            x[4] += 1
            if todos:
                y = por_mes[m]["SIN"]
                y[0] += series[("mmgd_mwh", sm)][d]
                y[2] += series[("global_mwh", sm)][d]
        if todos:
            y = por_mes[m]["SIN"]
            y[1] += series[("horas_mmgd", "SE")][d]
            y[3] += series[("horas_global", "SE")][d]
            y[4] += 1
            dias_sin[m].append(d)
    mensal, csv_m, part_mes = [], [], []
    for m in sorted(por_mes):
        a, mm = int(m[:4]), int(m[5:7])
        dias_mes = (date(a + (mm == 12), mm % 12 + 1, 1) - date(a, mm, 1)).days
        linha = {"m": m, "dias_no_mes": dias_mes}
        for sm in (*ons.AREAS, "SIN"):
            x = por_mes[m].get(sm)
            if not x or not x[1]:
                linha[sm] = None
                continue
            linha[sm] = c.r(x[0] / x[1], 1)
            csv_m.append([m, sm, c.r(x[0] / x[1], 1), c.r(x[2] / x[3], 1) if x[3] else None,
                          c.r(100 * x[0] / x[2], 2) if x[2] else None, x[4], dias_mes])
            if x[2]:
                part_mes.append((m, sm, 100 * x[0] / x[2]))
        y = por_mes[m].get("SIN")
        linha["dias_completos_sin"] = y[4] if y else 0
        linha["completo"] = bool(y) and y[4] == dias_mes
        linha["participacao_carga_global_sin_pct"] = c.r(100 * y[0] / y[2], 2) if y and y[2] else None
        linha["carga_global_sin_mwmed"] = c.r(y[2] / y[3], 0) if y and y[3] else None
        # capacidade cadastrada na ANEEL: média do estoque no início e no fim do mês (Brasil)
        ini = estoque_fim_mes.get(_mes_menos(m, 1)) if estoque_fim_mes else None
        if ini is None and estoque_fim_mes:
            ant = [k for k in estoque_fim_mes if k < m]
            ini = estoque_fim_mes[max(ant)] if ant else 0.0
        fim = estoque_fim_mes.get(m) if estoque_fim_mes else None
        if fim is None and estoque_fim_mes:
            ant = [k for k in estoque_fim_mes if k <= m]
            fim = estoque_fim_mes[max(ant)] if ant else None
        cap_mw = (ini + fim) / 2 / 1000 if (ini is not None and fim is not None) else None
        linha["capacidade_aneel_mw"] = c.r(cap_mw, 0) if cap_mw else None
        cadastro_estavel = corte_provisorio is None or m <= corte_provisorio
        linha["capacidade_aneel_provisoria"] = not cadastro_estavel
        linha["razao_estimativa_ons_capacidade_pct"] = (c.r(100 * linha["SIN"] / cap_mw, 1)
                                                        if cap_mw and linha.get("SIN") is not None and linha["completo"]
                                                        and cadastro_estavel else None)
        mensal.append(linha)
    anual, part_ano = [], []
    for ano in sorted({m["m"][:4] for m in mensal}):
        ms = [m for m in mensal if m["m"][:4] == ano]
        ys = [por_mes[m["m"]].get("SIN") for m in ms]
        e = sum(y[0] for y in ys if y)
        h = sum(y[1] for y in ys if y)
        g = sum(y[2] for y in ys if y)
        dias_c = sum(y[4] for y in ys if y)
        dias_ano = 366 if int(ano) % 4 == 0 else 365
        anual.append({"ano": int(ano), "mmgd_sin_mwmed": c.r(e / h, 0) if h else None, "mmgd_sin_twh": c.r(e / 1e6, 2),
                      "participacao_carga_global_pct": c.r(100 * e / g, 2) if g else None,
                      "dias_completos": dias_c, "completo": dias_c == dias_ano})
        if g:
            part_ano.append((ano, 100 * e / g))
    # ---- domínio da participação (contrato, seção 5.2), antes de escrever qualquer arquivo:
    # mês ou ano com participação fora de 0 a 100% (submercado ou SIN) é crítico e derruba a
    # publicação (stub); dia com MMGD negativa ou maior que a carga global vira ressalva.
    fora_mes = [(m, sm, v) for m, sm, v in part_mes if not 0 <= v <= 100]
    fora_ano = [(a, v) for a, v in part_ano if not 0 <= v <= 100]
    if fora_mes or fora_ano:
        ex = [f"{m} {sm} {_br(v, 2)}%" for m, sm, v in fora_mes[:3]] + [f"{a} SIN {_br(v, 2)}%" for a, v in fora_ano[:3]]
        raise ValidacaoCritica(f"validação crítica: participação da MMGD estimada na carga global fora de 0 a 100% em "
                               f"{len(fora_mes)} meses e {len(fora_ano)} anos (ex.: {'; '.join(ex)})")
    validacoes = {
        "participacao_dominio": {
            "regra": "0 ≤ participação ≤ 100% em cada mês (submercado e SIN) e em cada ano (SIN); violação derruba a publicação",
            "meses_verificados": len(part_mes), "anos_verificados": len(part_ano), "violacoes": 0, "resultado": "aprovada"},
        "dias_fora_do_dominio": {
            "regra": "dia por submercado com MMGD estimada negativa ou maior que a carga global do dia",
            "dias": len(dias_fora), "exemplos": dias_fora[:10],
            "resultado": "ressalva" if dias_fora else "aprovada",
            "tratamento": "ressalva na proveniência; os dias ficam na série como o ONS publica"},
    }
    base.escreve_csv("transicao_ons_mmgd_diario.csv",
                     ["data", "submercado", "mmgd_mwh", "mmgd_mwmed", "horas", "carga_global_mwh", "carga_global_mwmed", "carga_sem_mmgd_mwh"],
                     diario)
    base.escreve_csv("transicao_ons_mmgd_mensal.csv",
                     ["mes", "submercado", "mmgd_mwmed", "carga_global_mwmed", "participacao_mmgd_pct", "dias_completos", "dias_no_mes"], csv_m)
    ultimo = next((m for m in reversed(mensal) if m["completo"]), None)
    conf = _conferencia_quebra(con, con_p, series)
    lim = [
        ("É uma estimativa do ONS, não medição: a página do Balanço de Energia chama o valor de \"valor estimado da micro e "
         "minigeração distribuída\", e o dicionário da carga verificada separa a parcela atendida por MMGD da parcela supervisionada "
         "pelo ONS e da medida pelo sistema de faturamento da CCEE. Esses documentos não descrevem o método da estimativa."),
        "Cobre o Sistema Interligado Nacional; o cadastro da ANEEL cobre o Brasil inteiro, inclusive sistemas isolados.",
        "Estimativa de energia (MWmed) e cadastro de capacidade (MW) são grandezas diferentes: aparecem lado a lado e nunca são somadas.",
        "O ONS revisa o histórico (há registros de 2023 atualizados em 2026); os meses antigos são recoletados a cada 30 dias.",
        "Antes de 15/02/2019 a API publica a parcela de MMGD vazia, e há dias sem valor em 2019: é ausência, não zero.",
    ]
    if dias_fora:
        lim.append(f"Ressalva de domínio: {_br(len(dias_fora))} dias por submercado têm MMGD estimada negativa ou maior que a carga "
                   "global do dia; ficam na série como o ONS publica (lista em validacoes.dias_fora_do_dominio).")
    prov = c.proveniencia(
        indicador="Parcela da carga atendida por MMGD estimada pelo ONS", natureza="ESTIMADO", fonte=FONTE_ONS,
        unidade="MWmed (média do período) e % da carga global", frequencia="semi-horária na fonte; diária e mensal aqui",
        periodo={"inicio": dias[0], "fim": dias[-1]}, cobertura={"inicio": dias[0], "fim": dias[-1]},
        capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["energia de cada meia hora = valor × 0,5 h", "MWmed do período = Σ MWh ÷ horas cobertas",
                        "SIN = soma dos quatro submercados nos dias em que os quatro têm as 24 horas",
                        "participação = 100 × Σ MWh de MMGD ÷ Σ MWh da carga global, mesmos dias"],
        formula="MWmed = Σ(val_cargammgd × 0,5) ÷ Σ horas; participação = 100 × Σ(val_cargammgd) ÷ Σ(val_cargaglobal)",
        limitacoes=lim, download="/energia/series/transicao_ons_mmgd_mensal.csv",
        notas_fonte="Natureza ESTIMADO: estimativa publicada pelo próprio ONS, não pela plataforma.")
    prov_razao = c.proveniencia(
        indicador="Razão entre a estimativa de MMGD do ONS e a capacidade cadastrada na ANEEL", natureza="CALCULADO",
        fonte={**FONTE_ONS, "recurso": FONTE_ONS["recurso"] + "; capacidade: " + FONTE_ANEEL["recurso"]},
        unidade="%", frequencia="mensal", periodo={"inicio": mensal[0]["m"], "fim": mensal[-1]["m"]},
        cobertura={"inicio": mensal[0]["m"], "fim": mensal[-1]["m"]}, capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["capacidade do mês = média do estoque cadastrado no início e no fim do mês (Brasil)"],
        formula="razão = 100 × MMGD estimada no SIN (MWmed) ÷ capacidade cadastrada (MW)",
        limitacoes=["Não é fator de capacidade medido: compara uma estimativa do ONS (SIN) com um cadastro da ANEEL (Brasil) e herda as limitações das duas.",
                    "Conexões ainda não cadastradas na ANEEL aumentariam a razão nos meses recentes: meses provisórios do cadastro e meses incompletos do ONS não têm razão calculada."],
        download="/energia/series/transicao_ons_mmgd_mensal.csv")
    return {
        "inicio_serie": dias[0], "fim_serie": dias[-1],
        "ultimo_mes_completo": ultimo,
        "mensal": mensal, "anual": anual,
        "conferencia_quebra_2023": conf,
        "documentos": [DOC_ONS_BALANCO, DOC_ONS_PMO, DOC_ONS_DICIONARIO],
        "validacoes": validacoes,
        "proveniencia": {"estimativa": prov, "razao": prov_razao},
        "evidencia": _evidencia_ons(con, snap, ultimo, por_mes, series, validacoes),
    }


def _evidencia_ons(con, snap, ultimo, por_mes, series, validacoes=None):
    """Evidência do último mês completo da MMGD estimada no SIN: quatro arquivos (um por
    submercado) da API de carga verificada, com sha256 e captura de cada um."""
    if not ultimo:
        return None
    m = ultimo["m"]
    vints = [base.ultima_vintage(con, DS_ONS, f"carga_verificada_{a}_{m}") for a in ons.AREAS.values()]
    arquivos = [ev.arquivo_de_vintage(v) for v in vints if v]
    fonte = ev.fonte_de_vintage("ONS", FONTE_ONS["dataset"], ons.URL_DATASET, vints[0])
    fonte["arquivos"] = arquivos
    y = por_mes[m]["SIN"]
    ok_id, txt_id = _identidade_ons(series)
    a, mm = int(m[:4]), int(m[5:7])
    fim = (date(a + (mm == 12), mm % 12 + 1, 1) - timedelta(days=1)).isoformat()
    return ev.construir(
        indicador="MMGD estimada pelo ONS no SIN, média do mês", valor_exibido=_br(ultimo["SIN"], 1),
        valor_calculo=y[0] / y[1], unidade="MWmed", periodo={"inicio": f"{m}-01", "fim": fim}, entidade="SIN",
        universo="quatro submercados (SE/CO, S, NE, N) da Carga de Energia Verificada",
        filtros=["dias com as 48 meias horas nos quatro submercados"], fonte=fonte,
        chaves_origem=[ons.url(ar, f"{m}-01", fim) for ar in ons.AREAS.values()],
        formula="Σ(val_cargammgd × 0,5 h) dos quatro submercados ÷ horas cobertas",
        numerador={"descricao": "energia de MMGD estimada no mês, SIN (MWh)", "valor": c.r(y[0], 1)},
        denominador={"descricao": "horas cobertas no mês (dias completos nos quatro submercados)", "valor": y[1]},
        cobertura=f"{ultimo['dias_completos_sin']} de {ultimo['dias_no_mes']} dias completos",
        tratamento_ausencia="meia hora sem valor fica fora da soma e das horas; dia incompleto não entra no SIN; dia em curso na captura não é verificado",
        revisoes=snap.get("revisoes"),
        testes=[_teste("campo vazio é ausência", True, "respostas com valor vazio ('\"val_cargammgd\": ,') são lidas como null, nunca zero"),
                _teste("valores não negativos", all(v >= 0 for (s, _), d in series.items() if s == "mmgd_mwh" for v in d.values()),
                       "o dicionário do ONS não admite MMGD negativa")]
        + ([_teste("participação entre 0 e 100%", validacoes["participacao_dominio"]["resultado"] == "aprovada",
                   f"{_br(validacoes['participacao_dominio']['meses_verificados'])} participações mensais (submercado e SIN) e "
                   f"{_br(validacoes['participacao_dominio']['anos_verificados'])} anuais dentro de 0 a 100%; "
                   f"{_br(validacoes['dias_fora_do_dominio']['dias'])} dias por submercado com MMGD negativa ou acima da carga global")]
           if validacoes else []),
        reconciliacao=ev.reconciliacao(
            f"Identidade publicada pelo próprio ONS, dia a dia por submercado: carga global = carga sem MMGD + MMGD. {txt_id}.",
            "aprovado" if ok_id else "ressalva", "0,1 MWh por dia (arredondamento dos valores de 48 meias horas)"),
        download=[{"rotulo": "MMGD estimada pelo ONS, mensal (CSV)", "url": "/energia/series/transicao_ons_mmgd_mensal.csv"},
                  {"rotulo": "MMGD estimada pelo ONS, diária (CSV)", "url": "/energia/series/transicao_ons_mmgd_diario.csv"}],
        reproducao=REPRODUCAO)


def _identidade_ons(series):
    """Confere, dia a dia, carga global ≈ carga sem MMGD + MMGD (dados do próprio ONS)."""
    n, falhas = 0, 0
    for sm in ons.AREAS:
        g, s, m = series[("global_mwh", sm)], series[("semmmgd_mwh", sm)], series[("mmgd_mwh", sm)]
        for d in g:
            if d in s and d in m:
                n += 1
                if abs(g[d] - s[d] - m[d]) > 0.1:
                    falhas += 1
    return falhas == 0, f"{_br(n - falhas)} de {_br(n)} dias por submercado fecham"


# Feriados nacionais na janela da conferência (Lei 662/1949, com a redação da Lei
# 10.607/2002): o par de dias comparado não vale quando um dos dois é feriado.
FERIADOS_JANELA_2023 = {"2023-04-21": "Tiradentes", "2023-05-01": "Dia do Trabalho"}
DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _balanco_diario(con_p, serie, ini, fim_exclusivo):
    """{dia: [valores horários]} de uma série do balanço (silver principal), vigente."""
    out = defaultdict(list)
    if con_p is None:
        return out
    try:
        rows = con_p.execute(
            """SELECT o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? AND o.serie=? AND o.ref >= ? AND o.ref < ? ORDER BY v.capturado_em, o.rowid""",
            (DS_BAL, serie, ini, fim_exclusivo)).fetchall()
    except Exception:
        return defaultdict(list)
    ult = {}
    for ref, v in rows:
        ult[ref] = v
    for ref, v in ult.items():
        out[ref[:10]].append(v)
    return out


def _mediana(xs):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def _conferencia_quebra(con, con_p, series):
    """Achado A11: solar e carga do SIN no balanço (silver principal) e MMGD estimada pelo
    ONS, dia a dia, de 7 dias antes a 7 dias depois de 29/04/2023, e cada dia a partir da
    quebra comparado ao mesmo dia da semana 14 dias antes (fora dos feriados nacionais).
    Só números do dado: a fonte declara a incorporação da MMGD, mas não publica explicação
    para a diferença entre o degrau da solar e a MMGD estimada, e nenhuma é dada aqui."""
    ini, fim = "2023-04-22", "2023-05-06"
    base_ini = "2023-04-15"  # 14 dias antes de 29/04, para os pares de mesmo dia da semana
    solar = _balanco_diario(con_p, "solar.SIN", base_ini, "2023-05-07")
    carga = _balanco_diario(con_p, "carga.SIN", base_ini, "2023-05-07")

    def media24(d, horas):
        hs = horas.get(d, [])
        return sum(hs) / len(hs) if len(hs) == 24 else None

    def mmgd_dia(d):
        if all(series[("horas_mmgd", sm)].get(d, 0) >= 24 for sm in ons.AREAS):
            return sum(series[("mmgd_mwh", sm)][d] for sm in ons.AREAS) / series[("horas_mmgd", "SE")][d]
        return None

    d0 = date.fromisoformat(ini)
    dias = []
    while d0.isoformat() <= fim:
        d = d0.isoformat()
        dias.append({"d": d, "solar_balanco_sin_mwmed": c.r(media24(d, solar), 0),
                     "carga_balanco_sin_mwmed": c.r(media24(d, carga), 0), "mmgd_ons_sin_mwmed": c.r(mmgd_dia(d), 0)})
        d0 += timedelta(days=1)
    by = {x["d"]: x for x in dias}
    antes, depois = by.get("2023-04-28", {}), by.get(QUEBRA_ONS, {})
    degrau = (depois.get("solar_balanco_sin_mwmed") - antes.get("solar_balanco_sin_mwmed")
              if depois.get("solar_balanco_sin_mwmed") is not None and antes.get("solar_balanco_sin_mwmed") is not None else None)
    med = lambda xs: c.r(c.media(xs), 0)  # noqa: E731
    sol_antes = med([x["solar_balanco_sin_mwmed"] for x in dias if x["d"] < QUEBRA_ONS])
    sol_depois = med([x["solar_balanco_sin_mwmed"] for x in dias if x["d"] >= QUEBRA_ONS])
    mm_depois = med([x["mmgd_ons_sin_mwmed"] for x in dias if x["d"] >= QUEBRA_ONS])
    # pares de mesmo dia da semana: cada dia de 29/04 a 06/05 contra 14 dias antes
    pares = []
    for x in dias:
        if x["d"] < QUEBRA_ONS:
            continue
        dd = date.fromisoformat(x["d"])
        b = (dd - timedelta(days=14)).isoformat()
        sb, cb = media24(b, solar), media24(b, carga)
        sd, cd = media24(x["d"], solar), media24(x["d"], carga)
        feriado = FERIADOS_JANELA_2023.get(x["d"]) or FERIADOS_JANELA_2023.get(b)
        pares.append({"d": x["d"], "dia_da_semana": DIAS_SEMANA[dd.weekday()], "d_comparacao": b,
                      "solar_d": c.r(sd, 0), "solar_comparacao": c.r(sb, 0),
                      "carga_d": c.r(cd, 0), "carga_comparacao": c.r(cb, 0),
                      "diferenca_solar": c.r(sd - sb, 0) if sd is not None and sb is not None else None,
                      "diferenca_carga": c.r(cd - cb, 0) if cd is not None and cb is not None else None,
                      "mmgd_ons_d": x["mmgd_ons_sin_mwmed"],
                      "feriado": feriado, "entra_na_mediana": feriado is None})
    validos = [p for p in pares if p["entra_na_mediana"]]
    med_sol = _mediana([p["diferenca_solar"] for p in validos])
    med_car = _mediana([p["diferenca_carga"] for p in validos])
    med_mm = _mediana([p["mmgd_ons_d"] for p in validos])
    leitura = _leitura_quebra(degrau, depois.get("mmgd_ons_sin_mwmed"), med_sol, med_car, med_mm, len(validos))
    return {
        "janela": {"inicio": ini, "fim": fim}, "dias": dias,
        "degrau_solar_mwmed": c.r(degrau, 0),
        "mmgd_ons_no_dia_mwmed": depois.get("mmgd_ons_sin_mwmed"),
        "diferenca_degrau_solar_e_mmgd_mwmed": (c.r(depois["mmgd_ons_sin_mwmed"] - degrau, 0)
                                                 if degrau is not None and depois.get("mmgd_ons_sin_mwmed") is not None else None),
        "solar_media_7d_antes": sol_antes, "solar_media_depois": sol_depois,
        "diferenca_medias_solar": c.r(sol_depois - sol_antes, 0) if sol_antes is not None and sol_depois is not None else None,
        "mmgd_ons_media_depois": mm_depois,
        "pares_mesmo_dia_da_semana": pares,
        "mediana_diferenca_solar_mwmed": c.r(med_sol, 0), "mediana_diferenca_carga_mwmed": c.r(med_car, 0),
        "mediana_mmgd_ons_mwmed": c.r(med_mm, 0), "pares_na_mediana": len(validos),
        "regra_pares": ("cada dia de 29/04 a 06/05/2023 menos o mesmo dia da semana 14 dias antes (médias de 24 horas); "
                        "pares com feriado nacional (21/04 e 01/05) ficam fora da mediana"),
        "degrau_na_carga": (None if med_car is None or med_mm is None else abs(med_car) >= med_mm / 2),
        "documento": DOC_ONS_BALANCO,
        "leitura": leitura,
    }


def _leitura_quebra(degrau, mmgd_dia, med_sol, med_car, med_mm, n):
    """Texto da conferência por regra fixa: só números e o que a fonte declara. A carga
    "mostra degrau do tamanho da MMGD" quando a mediana das diferenças da carga chega à
    metade da mediana da MMGD estimada nos mesmos dias."""
    if degrau is None or mmgd_dia is None:
        return ("O ONS declara, na página do Balanço de Energia, que a estimativa de MMGD passou a compor os dados de geração e "
                "carga a partir de 29/04/2023. O balanço da janela não está completo no silver, e a conferência no dado não foi feita.")
    t = ("O ONS declara, na página do Balanço de Energia, que a estimativa de MMGD passou a compor os dados de geração e carga a "
         f"partir de 29/04/2023. No dado, a solar do SIN no balanço sobe {_br(degrau)} MWmed de 28/04 para 29/04/2023; a MMGD "
         f"estimada pela API de carga verificada, como publicada hoje, é {_br(mmgd_dia)} MWmed em 29/04/2023, {_br(mmgd_dia - degrau)} "
         "MWmed acima do degrau. A fonte não publica explicação para essa diferença.")
    if med_sol is not None and med_car is not None and med_mm is not None:
        t += (f" Comparando cada dia de 29/04 a 06/05 com o mesmo dia da semana 14 dias antes ({n} pares, sem feriados), a mediana "
              f"das diferenças é {_br(med_sol)} MWmed na solar e {_br(med_car)} MWmed na carga, para {_br(med_mm)} MWmed de MMGD "
              "estimada nos mesmos dias: ")
        t += ("a carga do balanço também mostra variação desse tamanho." if abs(med_car) >= med_mm / 2 else
              "na carga do balanço não aparece degrau do tamanho da MMGD estimada.")
    return t


# ---------------------------------------------------------------------------
# Gold: MCTI
# ---------------------------------------------------------------------------

def _serie_com_origem(con, ds, serie):
    """(vigente, histórico) de uma série do silver, com o recurso (arquivo) de cada valor.

    vigente: {ref: (valor, recurso, capturado_em)}, o último valor por ordem de captura.
    histórico: {ref: {recurso: valor}}, o último valor que cada arquivo registrou. Como o
    silver só grava valor novo ou alterado, um arquivo que repete o valor de outro não
    aparece aqui: dois arquivos no histórico da mesma referência significam valores
    diferentes publicados para o mesmo período."""
    vig, hist = {}, defaultdict(dict)
    for ref, v, rec, cap in con.execute(
            """SELECT o.ref, o.valor, v.recurso, v.capturado_em FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? AND o.serie=? ORDER BY v.capturado_em, o.rowid""", (ds, serie)):
        vig[ref] = (v, rec, cap)
        hist[ref][rec] = v
    return vig, hist


SERIES_MCTI = ("medio_mensal", "medio_anual", "om_despacho_mensal", "om_despacho_diario", "bm_anual",
               "om_simples_ajustado_anual", "energia_despachada_mwh")
ROTULO_SERIE_MCTI = {"medio_mensal": "fator médio mensal", "medio_anual": "fator médio anual",
                     "om_despacho_mensal": "margem de operação (despacho) mensal", "om_despacho_diario": "margem de operação (despacho) diária",
                     "bm_anual": "margem de construção anual", "om_simples_ajustado_anual": "margem de operação (simples ajustado) anual",
                     "energia_despachada_mwh": "energia despachada (MWh)"}
# Diferença a partir da qual dois valores do mesmo período são publicações diferentes: as
# planilhas trazem 4 casas decimais, então 0,00005 separa arredondamento de mudança real.
TOL_MCTI = 5e-5
DOC_MCTI_NT = {
    "orgao": "MCTI",
    "titulo": "Nota técnica de junho de 2025: aprimoramento na publicação dos fatores de emissão de CO2 do SIN (NT_FE_jun25)",
    "url": "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/NT_FE_jun25.pdf",
    "consultado_em": "2026-09-30",
    "trecho": ("a partir de janeiro de 2025, os fatores de emissão de CO₂ da Margem de Operação do Sistema Interligado Nacional (SIN) "
               "passaram a refletir um aprimoramento importante no banco de dados do Operador Nacional do Sistema Elétrico (ONS) [...] "
               "A metodologia utilizada para o cálculo dos fatores de emissão de CO₂ permanece inalterada, tanto para projetos sob o "
               "Mecanismo de Desenvolvimento Limpo (MDL) quanto para inventários de emissões. A diferença reside na ampliação da base "
               "de dados, o que, consequentemente, pode resultar em uma redução nos valores dos fatores de emissão"),
}
DOC_MCTI_PAGINA = {
    "orgao": "MCTI",
    "titulo": "Fatores de emissão MDL/SIN: texto da seção Fator médio (inventários corporativos)",
    "url": mcti.URL_PAGINA_ATUAL,
    "consultado_em": "2026-09-30",
    "trecho": ("Ele calcula a média das emissões da geração, levando em consideração todas as usinas que estão gerando energia e não "
               "somente aquelas que estejam funcionando na margem. Se todos os consumidores de energia elétrica do SIN calculassem as "
               "suas emissões multiplicando a energia consumida por esse Fator de Emissão, o somatório corresponderia às emissões do SIN."),
}
DOC_MCTI_MDL = {
    "orgao": "MCTI",
    "titulo": "Fatores de emissão MDL/SIN: texto da seção Margem de operação pelo método da análise de despacho",
    "url": mcti.URL_PAGINA_ATUAL,
    "consultado_em": "2026-09-30",
    "trecho": ("Esse fator serve para quantificar a emissão que está sendo deslocada na margem. A sua utilidade está associada a "
               "projetos de MDL e se aplica, exclusivamente, para estimar as reduções certificadas de emissões (RCEs) dos projetos de MDL."),
}
QUEBRA_MCTI_2025 = {
    "data": "2025-01", "origem": "FONTE", "series": ["medio_mensal", "medio_anual", "om_despacho_mensal", "om_despacho_diario",
                                                     "bm_anual", "om_simples_ajustado_anual", "energia_despachada_mwh"],
    "descricao": ("Base de usinas do ONS ampliada (termelétricas a biomassa e conjuntos de usinas solares e eólicas, de emissão nula); "
                  "metodologia mantida. Valores a partir de jan/2025 podem ser menores por causa da base, não só da operação."),
    "documento": DOC_MCTI_NT,
}
# Tolerância da comparação fator anual × média simples dos 12 meses: cada mês publicado
# com 4 casas carrega até 0,00005 de arredondamento (a média também), e o anual outro
# tanto, então 0,0001 tCO2/MWh separa arredondamento de diferença de método ou de leitura
# (um mês lido no lugar do anual, ou o anual de outro ano, passa longe disso). Em
# 30/09/2026, 19 dos 20 anos completos (2006 a 2025) ficaram dentro dela: no dado, o anual
# do MCTI coincide com a média simples dos meses publicados. 2007 fica fora por 0,000125
# (anual 0,0293; média dos meses 0,029175) e aparece como ressalva, sem ajuste.
TOL_ANUAL_MEDIA = 1e-4 + 1e-9
# Natureza dos fatores do MCTI: não são medidos. O MCTI calcula as emissões a partir do
# consumo de combustível e de fatores metodológicos (ferramenta do Conselho Executivo do
# MDL) e as divide pela geração do ONS; é ESTIMADO pela fonte (seção 11.3), como a MMGD do
# ONS. A plataforma publica o valor oficial sem alteração.
NOTA_NATUREZA_MCTI = ("Natureza ESTIMADO: estimativa publicada pelo próprio MCTI (emissões calculadas a partir do consumo de "
                      "combustível e de fatores metodológicos, divididas pela geração do ONS), não medição. Valor oficial, "
                      "publicado pela plataforma sem alteração.")


def _mcti_vigente(con):
    """Séries vigentes do MCTI com precedência por família de origem: página vigente do MCTI
    e capturas depositadas (a mais recente das duas) antes do site institucional anterior.

    Devolve (séries {serie: {ref: (valor, recurso)}}, divergências entre a publicação
    vigente e o site anterior, conflitos entre arquivos da mesma família)."""
    vig, divergencias, conflitos = {}, [], []
    for serie in SERIES_MCTI:
        fam, hist = {}, {}
        for f in FAMILIAS_MCTI:
            fam[f], hist[f] = _serie_com_origem(con, DS_MCTI, f"{f}.{serie}")
        refs = set().union(*fam.values())
        out = {}
        for ref in refs:
            recentes = [fam[f][ref] for f in ("atual", "seed") if ref in fam[f]]
            escolhido = max(recentes, key=lambda x: x[2]) if recentes else fam["antigo"][ref]
            out[ref] = (escolhido[0], escolhido[1])
            ant = fam["antigo"].get(ref)
            if recentes and ant and abs(ant[0] - escolhido[0]) > TOL_MCTI:
                divergencias.append({"serie": serie, "rotulo": ROTULO_SERIE_MCTI[serie], "periodo": ref,
                                     "valor_vigente": escolhido[0], "arquivo_vigente": escolhido[1],
                                     "valor_site_anterior": ant[0], "arquivo_site_anterior": ant[1]})
            for f in FAMILIAS_MCTI:
                por_arq = hist[f].get(ref) or {}
                if len(por_arq) > 1 and max(por_arq.values()) - min(por_arq.values()) > TOL_MCTI:
                    conflitos.append({"serie": serie, "rotulo": ROTULO_SERIE_MCTI[serie], "periodo": ref, "familia": f,
                                      "valores": [{"recurso": r, "valor": v} for r, v in sorted(por_arq.items())],
                                      "recurso_vigente": escolhido[1]})
        vig[serie] = out
    chave = lambda x: (x["serie"], x["periodo"])  # noqa: E731
    return vig, sorted(divergencias, key=chave), sorted(conflitos, key=chave)


def _listagem(con, recurso):
    """Listagem registrada de uma página do MCTI: ({url: titulo}, planilhas, ocultas, capturada_em)."""
    reg = base.registros_como_estavam_em(con, DS_MCTI_META).get(recurso) or {}
    planilhas = json.loads(reg.get("planilhas") or "[]")
    ocultas = json.loads(reg.get("links_ocultos") or "[]")
    v = base.ultima_vintage(con, DS_MCTI_META, recurso)
    return {p["url"]: p.get("titulo") for p in planilhas}, planilhas, ocultas, (v["capturado_em"] if v else None)


def _bloco_emissoes(con):
    s, divergencias, conflitos = _mcti_vigente(con)
    if not s["medio_mensal"]:
        return None
    snap = c.snapshot_de(con, DS_MCTI)
    meta = base.registros_como_estavam_em(con, DS_MCTI_META)
    vint = {v["recurso"]: v for v in base.vintages_do_dataset(con, DS_MCTI)}
    titulos, planilhas, ocultas, listagem_em = _listagem(con, "pagina_atual")

    def arq(rec):
        v = vint.get(rec)
        return v["url"].rsplit("/", 1)[-1] if v and v.get("url") else rec

    def lista(serie, chave):
        return [{chave: (int(k) if chave == "ano" else k), "valor": c.r(v, 4), "arquivo": arq(rec), "recurso": rec}
                for k, (v, rec) in sorted(s[serie].items())]
    medio_m = lista("medio_mensal", "m")
    medio_a = lista("medio_anual", "ano")
    om_m = lista("om_despacho_mensal", "m")
    bm_a = lista("bm_anual", "ano")
    sa_a = lista("om_simples_ajustado_anual", "ano")
    en_a = [{"ano": int(k), "mwh": v, "arquivo": arq(rec)} for k, (v, rec) in sorted(s["energia_despachada_mwh"].items())]
    # anual × média simples dos meses (controle de leitura; ver TOL_ANUAL_MEDIA)
    compara = []
    for a in medio_a:
        ms = [x["valor"] for x in medio_m if x["m"].startswith(str(a["ano"]))]
        if len(ms) == 12:
            dif = a["valor"] - sum(ms) / 12
            compara.append({"ano": a["ano"], "anual_publicado": a["valor"], "media_simples_meses": c.r(sum(ms) / 12, 5),
                            "diferenca": c.r(dif, 5), "dentro_da_tolerancia": abs(dif) <= TOL_ANUAL_MEDIA})
    usados = {rec for serie in s.values() for (_, rec) in serie.values()}
    revisoes, notas, descartes, bm_notas, problemas = [], [], [], [], []
    vistos = set()
    for rec, campos in sorted(meta.items()):
        if rec not in usados:
            continue  # planilha cuja contribuição foi superada por publicação mais nova (ou listagem de página)
        for pr in json.loads(campos.get("problemas") or "[]"):
            problemas.append({"texto": pr, "arquivo": arq(rec)})
        for r in json.loads(campos.get("revisoes_declaradas") or "[]"):
            chave = (r.get("serie"), r.get("periodo"), r.get("anterior"))
            if chave not in vistos:
                vistos.add(chave)
                revisoes.append({**r, "arquivo": arq(rec)})
        for n in json.loads(campos.get("notas") or "[]"):
            if n not in {x["texto"] for x in notas}:
                notas.append({"texto": n, "arquivo": arq(rec)})
        for d in json.loads(campos.get("descartes") or "[]"):
            descartes.append({**d, "arquivo": arq(rec)})
        if campos.get("bm_nota"):
            bm_notas.append({"texto": campos["bm_nota"], "arquivo": arq(rec)})
    base.escreve_csv("transicao_mcti_fatores.csv", ["serie", "periodo", "valor", "unidade", "arquivo"],
                     [["fator_medio_mensal", x["m"], x["valor"], "tCO2/MWh", x["arquivo"]] for x in medio_m]
                     + [["fator_medio_anual", str(x["ano"]), x["valor"], "tCO2/MWh", x["arquivo"]] for x in medio_a]
                     + [["margem_operacao_despacho_mensal", x["m"], x["valor"], "tCO2/MWh", x["arquivo"]] for x in om_m]
                     + [["margem_construcao_anual", str(x["ano"]), x["valor"], "tCO2/MWh", x["arquivo"]] for x in bm_a]
                     + [["margem_operacao_simples_ajustado_anual", str(x["ano"]), x["valor"], "tCO2/MWh", x["arquivo"]] for x in sa_a]
                     + [["energia_despachada_mwh", str(x["ano"]), x["mwh"], "MWh", x["arquivo"]] for x in en_a])
    base.escreve_csv("transicao_mcti_om_diario.csv", ["data", "margem_operacao_despacho_tco2_mwh", "arquivo"],
                     [[k, c.r(v, 4), arq(rec)] for k, (v, rec) in sorted(s["om_despacho_diario"].items())])
    # consistência interna: média simples dos fatores diários do mês × fator mensal publicado
    # (o mensal oficial é ponderado pela geração horária; a diferença esperada é pequena)
    por_mes_d = defaultdict(list)
    for k, (v, _) in s["om_despacho_diario"].items():
        por_mes_d[k[:7]].append(v)
    difs = [(m_, sum(v) / len(v) - s["om_despacho_mensal"][m_][0]) for m_, v in por_mes_d.items() if m_ in s["om_despacho_mensal"]]
    pior = max(difs, key=lambda x: abs(x[1])) if difs else None
    consist_diaria = {"meses_comparados": len(difs), "maior_diferenca_absoluta": c.r(abs(pior[1]), 4) if pior else None,
                      "mes_da_maior_diferenca": pior[0] if pior else None,
                      "descricao": "média simples dos fatores diários da margem de operação comparada ao fator mensal publicado"}
    tent = con.execute("SELECT tentado_em, ok, detalhe FROM coletas WHERE dataset=? AND recurso='pagina_atual' ORDER BY rowid DESC LIMIT 1",
                       (DS_MCTI,)).fetchone()
    ok_ult = con.execute("SELECT MAX(tentado_em) FROM coletas WHERE dataset=? AND recurso='pagina_atual' AND ok=1", (DS_MCTI,)).fetchone()
    bloqueios = con.execute("SELECT tentado_em, detalhe FROM coletas WHERE dataset=? AND recurso='pagina_atual' AND ok=0 ORDER BY rowid DESC LIMIT 5",
                            (DS_MCTI,)).fetchall()
    familias_usadas = sorted({_familia_mcti(rec) for serie in s.values() for (_, rec) in serie.values()})
    acesso = {"url": mcti.URL_PAGINA_ATUAL,
              "situacao": (None if not tent else ("acessivel" if tent[1] else "bloqueada")),
              "tentado_em": tent[0] if tent else None, "detalhe": tent[2] if tent else None,
              "ultimo_acesso_ok": ok_ult[0] if ok_ult else None,
              "bloqueios_registrados": [{"tentado_em": t, "detalhe": d} for t, d in bloqueios],
              "familias_usadas": familias_usadas,
              "alternativa": ("site institucional anterior do MCTI (antigo.mctic.gov.br), planilhas oficiais de 2006 a 2021: "
                              "usadas só onde a página vigente não tem valor, e sempre comparadas com ela"),
              "capturas_depositadas": sum(1 for v in vint.values() if v["origem"] == "seed")}
    pagina_vigente = None
    if planilhas:
        pagina_vigente = {"url": mcti.URL_PAGINA_ATUAL, "listagem_capturada_em": listagem_em,
                          "planilhas": [{"titulo": p.get("titulo"), "arquivo": p["arquivo"], "url": p["url"]} for p in planilhas],
                          "links_ocultos_ignorados": [u.rsplit("/", 1)[-1] for u in ocultas]}
    # evidência da quebra de 2025 no próprio dado: energia despachada do método simples ajustado
    en = {x["ano"]: x["mwh"] for x in en_a}
    quebra = dict(QUEBRA_MCTI_2025)
    if 2024 in en and 2025 in en:
        quebra["no_dado"] = {"descricao": "energia despachada no SIN usada pelo MCTI no método simples ajustado (MWh), antes e depois da ampliação da base",
                             "energia_2024_mwh": en[2024], "energia_2025_mwh": en[2025],
                             "variacao_pct": c.r(100 * (en[2025] / en[2024] - 1), 1)}
    ult_ano = medio_a[-1] if medio_a else None
    ult_mes = medio_m[-1] if medio_m else None
    ano_corrente = medio_m[-1]["m"][:4] if medio_m else None
    lim_medio = [
        "Fator médio: média das emissões de todas as usinas em operação no SIN por MWh gerado; é o fator para inventários. Não é fator marginal e não mede o efeito de consumir ou economizar um MWh a mais.",
        "Somente CO2 (tCO2/MWh), como o MCTI publica; não é CO2 equivalente (sem CH4 e N2O) e considera emissões da operação das usinas, não o ciclo de vida.",
        "Fronteira: emissões da geração despachada no SIN divididas pela geração do SIN. O MCTI orienta aplicar o fator à energia consumida em inventários; perdas de transmissão e distribuição não são tratadas à parte pela fonte nem pela plataforma.",
        "Perímetro: geração no SIN. Sistemas isolados e geração distribuída fora do despacho do ONS não entram.",
        "É um fator nacional mensal: não existe fator municipal nem horário oficial, e a plataforma não deriva um a partir deste.",
        "Quebra declarada pelo MCTI em jan/2025: a base de usinas do ONS foi ampliada (biomassa e conjuntos solares e eólicos, de emissão nula), com a mesma metodologia; comparações que atravessam jan/2025 misturam bases diferentes.",
        f"O ano corrente ({ano_corrente}) é parcial (meses publicados até o último disponível) e não tem fator anual." if ano_corrente else "O ano corrente é parcial e não tem fator anual.",
    ]
    if acesso["situacao"] == "bloqueada":
        lim_medio.append("Na última tentativa, a página vigente do MCTI respondeu com desafio de verificação humana; valores posteriores à última captura bem-sucedida não foram lidos.")
    if divergencias:
        lim_medio.append(f"{len(divergencias)} valores da página vigente diferem do publicado no site institucional anterior para o mesmo período; vale a publicação vigente e as diferenças ficam listadas.")
    prov_medio = c.proveniencia(
        indicador="Fator médio de emissão de CO2 do SIN (inventários)", natureza="ESTIMADO", fonte=FONTE_MCTI,
        unidade="tCO2/MWh", frequencia="mensal e anual",
        periodo={"inicio": medio_m[0]["m"], "fim": medio_m[-1]["m"]}, cobertura={"inicio": medio_m[0]["m"], "fim": medio_m[-1]["m"]},
        capturado_em=c.ultima_captura(snap), snapshot=snap,
        transformacoes=["leitura das planilhas oficiais sem alteração de valor (4 casas decimais na publicação da gold)",
                        "precedência: página vigente do MCTI sobre o site institucional anterior; divergências entre as duas publicadas",
                        "âncoras sem texto (invisíveis) da página vigente ignoradas: apontam para versões antigas"],
        limitacoes=lim_medio, download="/energia/series/transicao_mcti_fatores.csv",
        notas_fonte=NOTA_NATUREZA_MCTI)
    prov_mdl = c.proveniencia(
        indicador="Fatores de margem do MDL: margem de operação (despacho e simples ajustado) e margem de construção", natureza="ESTIMADO",
        fonte=FONTE_MCTI, unidade="tCO2/MWh", frequencia="mensal, diária e anual conforme o fator",
        periodo={"inicio": om_m[0]["m"] if om_m else None, "fim": om_m[-1]["m"] if om_m else None},
        cobertura={"inicio": om_m[0]["m"] if om_m else None, "fim": om_m[-1]["m"] if om_m else None},
        capturado_em=c.ultima_captura(snap), snapshot=snap, transformacoes=["leitura das planilhas oficiais; dia inexistente no calendário descartado"],
        limitacoes=["Fatores de margem estimam a emissão deslocada por um projeto de MDL que gera para a rede; não descrevem a intensidade média da eletricidade.",
                    "Margem de operação e margem de construção têm métodos distintos (ferramenta do Conselho Executivo do MDL) e não são comparáveis ao fator médio.",
                    "Somente CO2 (tCO2/MWh).", QUEBRA_MCTI_2025["descricao"]],
        download="/energia/series/transicao_mcti_fatores.csv", notas_fonte=NOTA_NATUREZA_MCTI)
    return {
        "unidade": "tCO2/MWh", "gas": "CO2 (não CO2e)",
        "medio_mensal": [{"m": x["m"], "valor": x["valor"]} for x in medio_m],
        "medio_anual": [{"ano": x["ano"], "valor": x["valor"]} for x in medio_a],
        "margem_operacao_despacho_mensal": [{"m": x["m"], "valor": x["valor"]} for x in om_m],
        "margem_construcao_anual": [{"ano": x["ano"], "valor": x["valor"]} for x in bm_a],
        "margem_operacao_simples_ajustado_anual": [{"ano": x["ano"], "valor": x["valor"]} for x in sa_a],
        "energia_despachada_mwh": [{"ano": x["ano"], "mwh": x["mwh"]} for x in en_a],
        "ultimo_ano": {k: ult_ano[k] for k in ("ano", "valor", "arquivo")} if ult_ano else None,
        "ultimo_mes": {k: ult_mes[k] for k in ("m", "valor", "arquivo")} if ult_mes else None,
        "quebras": [quebra],
        "anual_x_media_mensal": compara,
        "revisoes_declaradas_pela_fonte": revisoes, "divergencias_entre_publicacoes": divergencias,
        "conflitos_entre_arquivos": conflitos,
        "notas_da_fonte": notas, "notas_margem_construcao": bm_notas,
        "descartes": descartes, "problemas_de_leitura": problemas, "consistencia_diaria_mensal": consist_diaria,
        "acesso": acesso,
        "pagina_vigente": pagina_vigente,
        "arquivos": sorted({x["arquivo"] for x in medio_m + medio_a + om_m + bm_a + sa_a}),
        "documentos": [DOC_MCTI_PAGINA, DOC_MCTI_MDL, DOC_MCTI_NT],
        "estimativa_propria": {
            "publicada": False,
            "motivo": ("Uma estimativa própria de intensidade (por exemplo, geração térmica do ONS por combustível multiplicada por fatores "
                       "de combustível) exigiria consumo específico de cada usina, que não é publicado de forma estruturada; o resultado "
                       "teria incerteza maior que a diferença entre anos e não substitui o fator oficial. Nada foi estimado."),
        },
        "proveniencia": {"medio": prov_medio, "mdl": prov_mdl},
        "evidencia": _evidencia_fator_anual(con, snap, ult_ano, medio_m, medio_a, compara, revisoes, divergencias, titulos),
        "evidencia_mensal": _evidencia_fator_mensal(con, snap, ult_mes, medio_m, titulos),
    }


def _fonte_mcti(con, rec, titulos):
    v = base.ultima_vintage(con, DS_MCTI, rec)
    fonte = ev.fonte_de_vintage("MCTI", FONTE_MCTI["dataset"], mcti.URL_PAGINA_ATUAL, v)
    if v:
        fonte["arquivo"] = v["url"].rsplit("/", 1)[-1] if v.get("url") else rec
        titulo = titulos.get(v.get("url"))
        if titulo:
            fonte["recurso"] = f"{titulo} ({fonte['arquivo']})"
    return fonte


def _evidencia_fator_anual(con, snap, ult, medio_m, medio_a, compara, revisoes, divergencias, titulos):
    if not ult:
        return None
    cmp_ = next((x for x in compara if x["ano"] == ult["ano"]), None)
    fora = [x["ano"] for x in compara if not x["dentro_da_tolerancia"]]
    if cmp_:
        rec = ev.reconciliacao(
            f"Fator anual publicado ({_br(ult['valor'], 4)}) comparado à média simples dos 12 fatores mensais de {ult['ano']} "
            f"na mesma planilha ({_br(cmp_['media_simples_meses'], 5)}): diferença {_br(cmp_['diferenca'], 5)}. Nos {len(compara)} anos "
            f"com 12 meses, {len(compara) - len(fora)} ficam dentro da tolerância{'; fora: ' + ', '.join(map(str, fora)) if fora else ''}. "
            "Confere a leitura da coluna do anual; não é um segundo cálculo do MCTI.",
            "aprovado" if cmp_["dentro_da_tolerancia"] else "ressalva",
            "0,0001 tCO2/MWh (arredondamento da quarta casa decimal publicada nos meses e no anual)")
    else:
        rec = None
    por_serie = Counter(r["serie"] for r in revisoes)
    rotulos = {"margem_operacao_diaria": "margem de operação diária", "margem_operacao_mensal": "margem de operação mensal",
               "margem_construcao": "margem de construção"}
    det = ", ".join(f"{n} na {rotulos.get(sr, sr)}" for sr, n in sorted(por_serie.items(), key=lambda x: -x[1]))
    rev_txt = (f"{len(revisoes)} revisões declaradas pelo MCTI nas planilhas do MDL usadas, com valor anterior e corrigido"
               f"{' (' + det + ')' if det else ''}; {len(divergencias)} valores da página vigente diferentes do site "
               "institucional anterior (listados em divergencias_entre_publicacoes).")
    return ev.construir(
        indicador="Fator médio anual de emissão de CO2 do SIN (inventários)", valor_exibido=_br(ult["valor"], 4),
        valor_calculo=ult["valor"], unidade="tCO2/MWh", periodo={"inicio": f"{ult['ano']}-01-01", "fim": f"{ult['ano']}-12-31"},
        entidade="SIN", universo="geração de energia elétrica despachada no Sistema Interligado Nacional", fonte=_fonte_mcti(con, ult["recurso"], titulos),
        chaves_origem=[f"planilha {ult['arquivo']}, bloco do ano {ult['ano']}, coluna do fator anual (à direita de dezembro)"],
        formula="valor publicado pelo MCTI, sem cálculo da plataforma (fator médio = emissões de CO2 da geração ÷ energia gerada no SIN)",
        cobertura=f"{medio_a[0]['ano']} a {medio_a[-1]['ano']} (anos completos publicados)",
        tratamento_ausencia="ano sem planilha acessível fica sem valor; ano corrente parcial não tem fator anual; nada é estimado para preencher",
        revisoes=rev_txt,
        testes=[_teste("domínio do fator", all(0 <= x["valor"] < mcti.LIMITE_FATOR for x in medio_m + medio_a),
                       "0 ≤ fator < 2 tCO2/MWh em todos os meses e anos"),
                _teste("12 meses por ano completo", all(sum(1 for x in medio_m if x["m"].startswith(str(a["ano"]))) == 12 for a in medio_a),
                       "cada ano com fator anual tem os 12 fatores mensais")],
        reconciliacao=rec,
        download=[{"rotulo": "Fatores do MCTI (CSV)", "url": "/energia/series/transicao_mcti_fatores.csv"}],
        reproducao=REPRODUCAO)


def _evidencia_fator_mensal(con, snap, ult, medio_m, titulos):
    if not ult:
        return None
    a, m = int(ult["m"][:4]), int(ult["m"][5:7])
    fim = (date(a + (m == 12), m % 12 + 1, 1) - timedelta(days=1)).isoformat()
    return ev.construir(
        indicador="Fator médio mensal de emissão de CO2 do SIN (inventários)", valor_exibido=_br(ult["valor"], 4),
        valor_calculo=ult["valor"], unidade="tCO2/MWh", periodo={"inicio": f"{ult['m']}-01", "fim": fim},
        entidade="SIN", universo="geração de energia elétrica despachada no Sistema Interligado Nacional", fonte=_fonte_mcti(con, ult["recurso"], titulos),
        chaves_origem=[f"planilha {ult['arquivo']}, bloco do ano {a}, coluna de {mcti.MESES[m - 1]}"],
        formula="valor publicado pelo MCTI, sem cálculo da plataforma",
        cobertura=f"{medio_m[0]['m']} a {medio_m[-1]['m']}",
        tratamento_ausencia="mês sem valor publicado fica sem valor; nada é interpolado",
        revisoes=snap.get("revisoes"),
        testes=[_teste("domínio do fator", 0 <= ult["valor"] < mcti.LIMITE_FATOR, "0 ≤ fator < 2 tCO2/MWh")],
        download=[{"rotulo": "Fatores do MCTI (CSV)", "url": "/energia/series/transicao_mcti_fatores.csv"}],
        reproducao=REPRODUCAO)


# ---------------------------------------------------------------------------
# CSVs e construção
# ---------------------------------------------------------------------------

def _escreve_csvs_mmgd(b):
    cad = b["_cad"]
    nome = lambda m: (cad.get(m) or {}).get("nome")  # noqa: E731
    # potencia_kw = soma das potências informadas; vazio quando nenhuma unidade da linha tem
    # potência; unidades_sem_potencia > 0 marca a soma parcial
    base.escreve_csv("transicao_mmgd_municipio_ano_fonte.csv",
                     ["codigo_ibge", "municipio", "uf", "ano_conexao", "fonte", "unidades", "potencia_kw", "unidades_sem_potencia"],
                     [[m, nome(m), (cad.get(m) or {}).get("uf") or mmgd.UF_POR_CODIGO.get(m[:2]), a, f, q, _kw_pub(k, q, s), s]
                      for (m, a, f), (q, k, s) in sorted(b["_mun_ano_fonte"].items())])
    base.escreve_csv("transicao_mmgd_uf_mes_fonte.csv", ["uf", "mes_conexao", "fonte", "unidades", "potencia_kw", "unidades_sem_potencia"],
                     [[u, mes, f, q, _kw_pub(k, q, s), s] for (u, mes, f), (q, k, s) in sorted(b["_ufm"].items())])
    nd = b["_nomes_dist"]
    area = b.get("_area")

    def na_area(cn, u):  # sim/nao pela UF dos conjuntos elétricos do CNPJ; vazio = sem referência
        if area is None or cn not in area or u not in mmgd.NOME_UF:
            return None
        return "sim" if u in area[cn] else "nao"
    base.escreve_csv("transicao_mmgd_distribuidoras.csv",
                     ["cnpj", "sigla", "nome", "uf", "ano_conexao", "unidades", "potencia_kw", "unidades_sem_potencia",
                      "uf_na_area_da_distribuidora"],
                     [[cn, (nd.get(cn) or {}).get("sigla"), (nd.get(cn) or {}).get("nome"), u, a, q, _kw_pub(k, q, s), s, na_area(cn, u)]
                      for (cn, u, a), (q, k, s) in sorted(b["_dist"].items())])
    perf = []
    for d, v in b["_perfis"].items():
        perf += [[d, cat, a, q, _kw_pub(k, q, s), s] for (cat, a), (q, k, s) in sorted(v.items())]
    perf += [["fonte_detalhe", f"{t} | {dsc}", a, q, _kw_pub(k, q, s), s] for (t, dsc, a), (q, k, s) in sorted(b["_fdet"].items())]
    base.escreve_csv("transicao_mmgd_perfil.csv", ["dimensao", "categoria", "ano_conexao", "unidades", "potencia_kw", "unidades_sem_potencia"],
                     perf)
    campos = list(CAMPOS_MUNICIPIO)
    base.escreve_csv("transicao_mmgd_municipios.csv",
                     ["codigo_ibge", "municipio", "uf", "unidades", "potencia_kw", "unidades_sem_potencia", "populacao_estimada",
                      "w_por_habitante", "unidades_por_mil_habitantes", "unidades_ano_referencia", "potencia_kw_ano_referencia",
                      "potencia_kw_estoque_ano_anterior", "crescimento_estoque_pct", "fonte_principal",
                      "unidades_distribuidora_fora_da_uf", "potencia_kw_distribuidora_fora_da_uf",
                      "unidades_provavel_municipio_errado", "potencia_kw_provavel_municipio_errado",
                      "unidades_provavel_distribuidora_errada", "potencia_kw_provavel_distribuidora_errada",
                      "ano_referencia", "ano_populacao"],
                     [[x[k] for k in campos] + [b["ano_referencia"], b["ano_populacao"]] for x in b["_municipios"]])
    # JSON compacto (sem indentação): é carregado sob demanda pelo mapa e tem ~5.570 linhas
    carga = {"gerado_em": base.agora_utc(), "data_cadastro": b["data_cadastro"], "ano_referencia": b["ano_referencia"],
             "ano_populacao": b["ano_populacao"], "campos": campos, "linhas": [[x[k] for k in campos] for x in b["_municipios"]]}
    destino = os.path.join(base.SERIES, "transicao_municipios.json")
    os.makedirs(base.SERIES, exist_ok=True)
    tmp = f"{destino}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(carga, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    os.replace(tmp, destino)


def construir(con, ctx):
    hoje = ctx.get("hoje") or c.hoje_brasilia()
    try:
        b, motivo = _bloco_mmgd(con, hoje)
    except Exception as e:
        return c.stub(GOLD, f"falha ao montar o bloco de MMGD: {e}")
    if b is None:
        return c.stub(GOLD, motivo)
    # o bloco do ONS valida o domínio antes de escrever arquivos; violação crítica vira stub
    # antes de qualquer CSV mudar, para que downloads e gold anterior continuem coerentes
    try:
        ons_b = _bloco_ons(con, ctx.get("con_principal"), b["_estoque_fim_mes"], b["corte_provisorio"])
    except ValidacaoCritica as e:
        return c.stub(GOLD, str(e))
    _escreve_csvs_mmgd(b)
    emis = _bloco_emissoes(con)
    publico = {k: v for k, v in b.items() if not k.startswith("_")}
    pendencias = []
    if ons_b is None:
        pendencias.append("estimativa de MMGD do ONS ausente no silver")
    if emis is None:
        pendencias.append("fatores de emissão do MCTI ausentes no silver")
    downloads = [{"rotulo": r, "url": u} for r, u in (
        ("MMGD por município, ano e fonte (CSV)", "/energia/series/transicao_mmgd_municipio_ano_fonte.csv"),
        ("MMGD por município, com população (CSV)", "/energia/series/transicao_mmgd_municipios.csv"),
        ("MMGD por UF, mês e fonte (CSV)", "/energia/series/transicao_mmgd_uf_mes_fonte.csv"),
        ("MMGD por distribuidora, UF e ano (CSV)", "/energia/series/transicao_mmgd_distribuidoras.csv"),
        ("MMGD por classe, modalidade, porte e fonte (CSV)", "/energia/series/transicao_mmgd_perfil.csv"),
        ("MMGD estimada pelo ONS, diária (CSV)", "/energia/series/transicao_ons_mmgd_diario.csv"),
        ("MMGD estimada pelo ONS, mensal (CSV)", "/energia/series/transicao_ons_mmgd_mensal.csv"),
        ("Fatores de emissão do MCTI (CSV)", "/energia/series/transicao_mcti_fatores.csv"),
        ("Margem de operação diária do MCTI (CSV)", "/energia/series/transicao_mcti_om_diario.csv"),
    )]
    return {
        **c.cabecalho(GOLD),
        "paineis": ["P063", "P064"],
        "pendencias": pendencias,
        "regras": {
            "capacidade_nao_e_energia": "Potência instalada cadastrada (kW, MW) é capacidade; energia gerada (MWh, MWmed) só aparece na estimativa do ONS, em bloco separado.",
            "cadastro_x_estimativa": "Cadastro regulatório da ANEEL e estimativa operacional do ONS são grandezas diferentes: nunca somadas, só comparadas por razão rotulada.",
            "ano_de_conexao": "Ano e mês vêm da data de conexão publicada (DthAtualizaCadastralEmpreend, conferida com DatConexao do recurso técnico).",
            "provisorio": f"Os {MESES_PROVISORIOS} meses anteriores à data do cadastro são provisórios: conexões desses meses ainda podem entrar em capturas seguintes; a queda nesses meses não tem causa atribuída.",
            "ano_referencia": "Comparações de crescimento usam o último ano completo antes da data do cadastro; o ano corrente é parcial e não entra em ranking.",
            "por_habitante": f"Por habitante usa a população estimada pelo IBGE; rankings só com população de pelo menos {_br(POP_MINIMA_RANKING)}.",
            "participacoes": "Participações em % com duas casas; abaixo de 0,01% (e diferente de zero), com dois algarismos significativos.",
            "series_com_zero": ("Séries anual e mensal do cadastro trazem todos os anos e meses entre a primeira conexão e a data do cadastro. "
                                "Dentro da cobertura declarada pela ANEEL (a partir de dez/2008), sem conexão = zero explícito; antes dela, "
                                "período sem registro fica nulo e registro existente é publicado, os dois rotulados como fora da cobertura "
                                "(ou em parte, no ano de 2008)."),
            "distribuidora_fora_da_uf": ("Unidades em UF onde a distribuidora (CNPJ) não tem conjunto elétrico ficam no município publicado, "
                                         "sinalizadas e contadas, sem correção, em duas classes pelo CEP publicado: provável município errado "
                                         "(CEP na área da distribuidora) e provável distribuidora errada (CEP, código e UF na UF do município), "
                                         "além das indeterminadas."),
            "potencia_ausente": "Potência ausente não vira zero: a unidade conta, a soma de kW é das potências informadas, unidades_sem_potencia marca a soma parcial e potência nula marca agregado sem nenhuma potência.",
            "fator_medio_nao_marginal": "Fator médio (inventários) e fatores de margem (MDL) são séries separadas e não se substituem.",
            "co2_nao_co2e": "Os fatores do MCTI são de CO2, em tCO2/MWh; não são CO2 equivalente.",
            "sem_intensidade_local": "Não há intensidade de emissão municipal nem horária: o fator oficial é nacional (SIN) e mensal.",
        },
        "mmgd": publico,
        "ons_mmgd": ons_b,
        "emissoes": emis,
        "downloads": downloads,
        "mapa_municipios": "/energia/series/transicao_municipios.json",
    }
