"""Módulo Água e clima (detalhe): armazenamento, afluência, clima e balanço dos reservatórios.

Gold: public/energia/gold/agua_detalhe.json (painéis P017 a P020) e CSVs em
public/energia/series/ (agua_*.csv e clima_diario.csv). Complementa, sem substituir, a
gold de operação hidrologia.json (EAR e ENA por subsistema, construída por
pipeline/energia/gold/hidrologia.py a partir do silver principal).

Fontes (seção "Fontes verificadas" em docs/observatorios/energia/modulos/agua.md):
- ONS: EAR e ENA por REE e por bacia; EAR e ENA por reservatório; dados hidráulicos por
  reservatório (base diária); cadastro de reservatórios; contornos das bacias;
  precipitação diária observada (2020 e 2021, só para conferência); dicionários de dados;
  carga verificada por área geoelétrica (um dia, para conferir estado → subsistema);
- ONS no silver principal (só leitura): EAR e ENA por subsistema; balanço de energia. Os
  arquivos por subsistema de 2025 e 2026 são recapturados pelo módulo junto com os por
  REE, bacia e reservatório; em cada ano vale a captura mais recente das duas, para que
  todos os blocos da gold usem o mesmo valor do ONS para o mesmo dia;
- NASA POWER: precipitação IMERG (GPM) e temperatura MERRA-2/GEOS-IT por ponto;
- Open-Meteo (API de rodadas individuais): PREVISÃO do ECMWF IFS 0,25°, rodada de 00Z;
- IBGE: sedes municipais (Localidades 2022) e população do Censo 2022 (SIDRA 4709).

Por que tanto cuidado com unidade e perímetro:
- EAR agregada é soma de energias (MWmês) dividida pela soma das capacidades; média de
  percentuais daria peso igual a um Sul pequeno e a um Sudeste enorme;
- a ENA de 30 dias em % da MLT é razão de somas com a MLT vigente em cada dia; a MLT do
  ONS muda (usinas novas e recálculo da referência), e isso é publicado, não escondido;
- o balanço de um reservatório é feito em hm³ (m³/s × segundos do dia), com o volume do
  cadastro; o resíduo fica visível. A afluência publicada pelo ONS é, na maioria dos
  reservatórios, calculada pelo próprio balanço (defluência + variação do volume): um
  resíduo perto de zero é consequência da construção, não prova independente;
- a variação da EAR de um subsistema é decomposta por reservatório (identidade conferida
  contra o conjunto por subsistema); a ENA aparece ao lado como contexto, nunca como
  explicação única;
- um recorte só é comparado com o próprio passado no mesmo perímetro: os REE mudaram no
  fim de 2017 (configuracao_ree) e EAR máxima zero é "não se aplica", não 0%.
"""
import calendar
import hashlib
import json
import math
import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import ckan, clima_agua as cl, ons as ons_sm, ons_agua as oa  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "agua_detalhe.json"
FAMILIA = "ons_hidrologia"
PAGINA = [{"rotulo": "Água e clima", "href": "/setor-eletrico/agua-e-clima"}]
# um painel por página: cada conjunto aponta para as páginas que o usam (catálogo de dados)
_P017 = {"rotulo": "Água e clima: armazenamento", "href": "/setor-eletrico/agua-e-clima"}
_P018 = {"rotulo": "Água e clima: afluência", "href": "/setor-eletrico/agua-e-clima/afluencia"}
_P019 = {"rotulo": "Água e clima: chuva e temperatura", "href": "/setor-eletrico/agua-e-clima/chuva-e-temperatura"}
_P020 = {"rotulo": "Água e clima: reservatórios e balanço", "href": "/setor-eletrico/agua-e-clima/reservatorios"}
PAGINAS_DS = {
    "ear_ree": [_P017], "ear_bacia": [_P017], "ena_ree": [_P018], "ena_bacia": [_P018],
    "ear_res": [_P017, _P020], "ena_res": [_P018], "hidro_res": [_P020], "cadastro": [_P020],
    "precip_est": [_P019], "bacias_shp": [_P019],
}
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py agua --sem-coleta"

# silver da família ons_hidrologia
DS_EAR_REE = "ons_ear_ree_di"
DS_ENA_REE = "ons_ena_ree_di"
DS_EAR_BACIA = "ons_ear_bacia_di"
DS_ENA_BACIA = "ons_ena_bacia_di"
DS_EAR_RES = "ons_ear_reservatorio_di"
DS_ENA_RES = "ons_ena_reservatorio_di"
DS_HIDRO = "ons_dados_hidrologicos_di"
DS_CAD = "ons_reservatorio_cadastro"
DS_PRECIP_EST = "ons_precipitacao_estacao"
DS_SHP = "ons_bacia_contorno"
DS_DIC = "ons_hidrologia_dicionarios"
DS_AREAS = "ons_carga_areas_verificacao"
DS_IBGE_LOC = "ibge_localidades_2022"
DS_IBGE_POP = "ibge_censo2022_populacao"
DS_POWER_PR = "nasa_power_imerg"
DS_POWER_T = "nasa_power_merra2"
DS_CLIMA_PR = "clima_precipitacao_bacia"
DS_CLIMA_T = "clima_temperatura"
DS_PONTOS_PR = "clima_pontos_precipitacao"
DS_PONTOS_T = "clima_celulas_temperatura"
DS_CONTROLE = "agua_controle"
DS_PMO = "ons_pmo_relatorio_mlt"   # MLT mensal publicada no Relatório Executivo do PMO (PDF)
DS_PREV_BRUTO = "openmeteo_ecmwf_previsao"   # JSON da API de previsão do Open-Meteo (ECMWF IFS) e meta.json da rodada
DS_PREV = "clima_previsao"                   # previsão agregada por bacia e por subsistema, uma vintage por rodada
IDADE_MAX_PREVISAO_H = 48                    # previsão mais velha que isso não é publicada (só a pendência)
DS_EAR_SM_CONF = "ons_ear_subsistema_conferencia"   # recaptura do ano corrente e do anterior
DS_ENA_SM_CONF = "ons_ena_subsistema_conferencia"

# silver principal (só leitura)
DS_EAR_SM = "ear_subsistema_di"
DS_ENA_SM = "ena_subsistema_di"
DS_BAL = "balanco_energia_subsistema_ho"

SMS = c.ORDEM_SM
TODOS = SMS + ("SIN",)
ANO_INI_BACIA = 2001        # faixas sazonais: anos completos desde 2001 (mesma base da hidrologia.json)
ANO_INI_REE = 2016          # o conjunto por REE começa em 2016
DIARIO_EAR_RES = "2024-01-01"   # EAR diária por reservatório no silver (janela publicada)
DIARIO_RECORTES = "2022-01-01"  # CSV diário de REE e bacias (o mensal cobre desde 2000)
HIDRO_DESDE = "2025-01-01"      # dados hidráulicos diários no silver (janela publicada)
ANO_MIN_HIDRO = 2025
BASE_CLIMA = (2001, 2025)       # climatologia: anos completos 2001 a 2025
# o período por extenso nos textos publicados sai da constante (mudar a base muda o texto)
BASE_CLIMA_TXT = f"{BASE_CLIMA[0]} a {BASE_CLIMA[1]}"
JANELA = 30
DIAS_EAR_DIARIA = 120           # EAR diária por subsistema na gold
DIAS_SERIES_RES = 45            # séries diárias dos reservatórios (agua_reservatorios_45d.json)
DIAS_TEMP_DIARIA = 45           # temperatura diária com a faixa na gold (o CSV traz tudo)
UF_DESDE = "2019-01-01"          # temperatura por UF no silver e no CSV

URLS = {k: f"https://dados.ons.org.br/dataset/{v[0]}" for k, v in oa.PACOTES.items()}
URL_POWER = "https://power.larc.nasa.gov/"
URL_LOC = ("https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/localidades/"
           "Localidades_do_Brasil/2022/Localidades_Brasil_shp.zip")
URL_POP_MUN = "https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/2022"
URL_POP_UF = "https://apisidra.ibge.gov.br/values/t/4709/n3/all/v/93/p/2022"
URL_AREAS = "https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio={d}&dat_fim={d}&cod_areacarga={a}"
DIA_AREAS = "2026-08-10"
ACERVO = "https://www.ons.org.br/AcervoDigitalDocumentosEPublicacoes/"
# Relatórios do PMO conferidos à mão em 30/09/2026 (o nome do arquivo mudou de formato em
# 2026; a coleta também procura os das últimas semanas pelos dois formatos). Dezembro de
# 2025 e as semanas de janeiro de 2026 cercam a mudança da MLT do conjunto aberto em 20/01/2026.
PMO_FIXOS = ["RELATORIO-PMO-20_12 a 26_12.pdf", "RELATORIO-PMO-17_01 a 23_01.pdf", "RELATORIO-PMO-24_01 a 30_01.pdf",
             "RELATORIO-PMO-31_01 a 06_02.pdf", "RELATORIO-PMO-11_04_26 a 17_04_26.pdf",
             "RELATORIO-PMO-25_07_26 a 31_07_26.pdf", "RELATORIO-PMO-19_09_26 a 25_09_26.pdf"]
LICENCA_POWER = ("Creative Commons Zero (CC0): segundo a orientação de uso de dados da NASA Earthdata "
                 "(https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance), dados de "
                 "missões lideradas pela NASA sem marcação de restrição são CC0; o projeto POWER pede citação do serviço, da "
                 "versão e da data de acesso (https://power.larc.nasa.gov/docs/referencing/)")
LICENCA_OPENMETEO = ("Open-Meteo: Creative Commons Attribution 4.0 (CC BY 4.0), API gratuita para uso não comercial "
                     "(https://open-meteo.com/en/terms); dados do modelo ECMWF IFS sob a licença de dados abertos do ECMWF "
                     "(CC BY 4.0, https://www.ecmwf.int/en/forecasts/datasets/open-data). Citação: Open-Meteo e ECMWF.")
LICENCA_IBGE = ("Uso livre com citação da fonte (IBGE). A página de termos de uso do IBGE não foi relida nesta "
                "integração.")

DS_REGISTRO = [
    ("ONS", "ear-diario-por-ree-reservatorio-equivalente-de-energia", DS_EAR_REE, "EAR diária por REE", "ear_ree"),
    ("ONS", "ena-diario-por-ree-reservatorio-equivalente-de-energia", DS_ENA_REE, "ENA diária por REE", "ena_ree"),
    ("ONS", "ear-diario-por-bacia", DS_EAR_BACIA, "EAR diária por bacia", "ear_bacia"),
    ("ONS", "ena-diario-por-bacia", DS_ENA_BACIA, "ENA diária por bacia", "ena_bacia"),
    ("ONS", "ear-diario-por-reservatorio", DS_EAR_RES, "EAR diária por reservatório", "ear_res"),
    ("ONS", "ena-diario-por-reservatorio", DS_ENA_RES, "ENA diária por reservatório (MLT por usina)", "ena_res"),
    ("ONS", "dados-hidrologicos-res", DS_HIDRO, "Dados hidráulicos por reservatório, base diária", "hidro_res"),
    ("ONS", "reservatorio", DS_CAD, "Cadastro de reservatórios", "cadastro"),
    ("ONS", "precipitacao-estacao", DS_PRECIP_EST, "Precipitação diária observada (2020 e 2021)", "precip_est"),
    ("ONS", "bacia_contorno", DS_SHP, "Contornos das bacias hidrográficas", "bacias_shp"),
]

DOWNLOADS_DS = {
    "ear_ree": ["/energia/series/agua_ear_recortes_diario.csv", "/energia/series/agua_ear_recortes_mensal.csv"],
    "ena_ree": ["/energia/series/agua_ear_recortes_diario.csv", "/energia/series/agua_ear_recortes_mensal.csv"],
    "ear_bacia": ["/energia/series/agua_ear_recortes_diario.csv", "/energia/series/agua_ear_recortes_mensal.csv"],
    "ena_bacia": ["/energia/series/agua_ear_recortes_diario.csv", "/energia/series/agua_ear_recortes_mensal.csv"],
    "ear_res": ["/energia/series/agua_capacidade_eventos.csv"],
    "ena_res": ["/energia/series/agua_mlt_mudancas.csv"],
    "hidro_res": ["/energia/series/agua_reservatorios.csv", "/energia/series/agua_reservatorios_diario.csv",
                  "/energia/series/agua_reservatorios_45d.json"],
    "cadastro": ["/energia/series/agua_reservatorios.csv"],
    "bacias_shp": ["/energia/series/agua_clima_pontos.csv", "/energia/series/agua_bacias_geo.json"],
}
# quebras conhecidas e conferidas nos próprios arquivos (detalhes no documento do módulo).
# origem PLATAFORMA = identificada pela Scrutiniums no dado (o ONS não a declara no
# dicionário nem na descrição do conjunto); FONTE = declarada pela fonte.
_QUEBRA_REE = {
    "data": "2017-12-29", "origem": "PLATAFORMA",
    "descricao": ("Reconfiguração dos REE identificada nos arquivos (o dicionário não a declara): o conjunto passa de 9 para "
                  "12 REE. Em 29/12/2017 SUL, PARANA e NORTE já aparecem sem Iguaçu, Paranapanema e Manaus-Amapá (EAR "
                  "máxima de 20.100 para 9.591, de 152.313 para 140.227 e de 15.018 para 14.245 MWmês), e IGUACU, "
                  "PARANAPANEMA e MANAUS-AMAPA só aparecem em 30/12/2017: em 29/12/2017 a soma dos REE não cobre o SIN. "
                  "Valores desses seis REE antes de 30/12/2017 são de outro perímetro; a faixa sazonal deles usa só anos "
                  "desde 2018. SUDESTE, NORDESTE, MADEIRA, TELES PIRES, BELO MONTE e ITAIPU mantêm o perímetro."),
}
QUEBRAS_DS = {
    "ear_ree": [_QUEBRA_REE,
                {"data": "2018-01-01", "origem": "PLATAFORMA",
                 "descricao": "Valores passam de MWmês inteiros a três casas decimais, com EAR máximas recalculadas "
                              "(ex.: SUL de 9.591 para 9.447,43 MWmês)."}],
    "ena_ree": [{**_QUEBRA_REE, "descricao": _QUEBRA_REE["descricao"].replace("a faixa sazonal deles", "a faixa da ENA de 30 dias deles")}],
    "ear_res": [{"data": "2010-01-01", "origem": "PLATAFORMA",
                 "descricao": "De 2010 a 2015 a soma dos reservatórios do Sudeste fica até 88 MWmês abaixo do subsistema "
                              "(bacia do Paranaíba); causa não identificada, dado não corrigido."},
                {"data": "2018-01-01", "origem": "PLATAFORMA",
                 "descricao": "Até 2017 os valores de EAR são publicados em MWmês inteiros; desde 2018, com três casas decimais."}],
    "ena_res": [{"data": "2023-11-07", "origem": "PLATAFORMA",
                 "descricao": "MLT de quase todas as usinas muda no meio do mês e volta aos valores de novembro de 2022."},
                {"data": "2024-09-30", "origem": "PLATAFORMA",
                 "descricao": "MLT de quase todas as usinas muda no meio do mês para uma versão nova, mantida em 2025 e 2026."},
                {"data": "2025-11-04", "origem": "PLATAFORMA",
                 "descricao": "MLT de 94 usinas muda para outra versão, provisória: vigora até 19/01/2026."},
                {"data": "2026-01-20", "origem": "PLATAFORMA",
                 "descricao": "MLT volta aos valores de 2025 (retorno à versão anterior); o PMO de fevereiro a setembro de "
                              "2026 publica outra MLT."}],
    "precip_est": [{"data": "2022-01-01", "origem": "FONTE",
                    "descricao": "Conjunto descontinuado pelo ONS (só 2020 e 2021: o ONS passou a usar a precipitação por "
                                 "satélite); usado só para conferir a chuva por satélite."}],
}

REGISTRO = {
    "id": "agua", "gold": GOLD, "familia": FAMILIA, "ordem": 20,
    "datasets": [
        *[{"orgao": o, "nome": n, "slug": f"ons-{n}", "dataset_silver": ds, "titulo": t,
           "estado": "UTILIZADO EM INDICADOR", "url": f"https://dados.ons.org.br/dataset/{n}", "licenca": c.LICENCA_ONS,
           "paginas": PAGINAS_DS.get(k, PAGINA), "downloads": DOWNLOADS_DS.get(k, []), "quebras": QUEBRAS_DS.get(k, [])}
          for o, n, ds, t, k in DS_REGISTRO],
        {"orgao": "NASA", "nome": "power-daily-imerg", "slug": "nasa-power-imerg", "dataset_silver": DS_POWER_PR,
         "titulo": "NASA POWER: precipitação diária IMERG (GPM) por ponto", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POWER, "licenca": LICENCA_POWER, "paginas": [_P019],
         "downloads": ["/energia/series/agua_precipitacao_bacias_diario.csv"], "quebras": []},
        {"orgao": "NASA", "nome": "power-daily-merra2", "slug": "nasa-power-merra2", "dataset_silver": DS_POWER_T,
         "titulo": "NASA POWER: temperatura diária MERRA-2/GEOS-IT por ponto", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POWER, "licenca": LICENCA_POWER, "paginas": [_P019],
         "downloads": ["/energia/series/clima_diario.csv"], "quebras": []},
        {"orgao": "IBGE", "nome": "localidades-2022", "slug": "ibge-localidades-2022", "dataset_silver": DS_IBGE_LOC,
         "titulo": "IBGE: Localidades do Brasil 2022 (sedes municipais)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_LOC, "licenca": LICENCA_IBGE, "paginas": [_P019], "downloads": [], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-4709", "slug": "ibge-sidra-4709", "dataset_silver": DS_IBGE_POP,
         "titulo": "IBGE: população residente, Censo 2022 (SIDRA 4709)", "estado": "UTILIZADO EM INDICADOR",
         "url": URL_POP_MUN, "licenca": LICENCA_IBGE, "paginas": [_P019], "downloads": [], "quebras": []},
        {"orgao": "ONS", "nome": "relatorio-executivo-pmo", "slug": "ons-relatorio-pmo-mlt", "dataset_silver": DS_PMO,
         "titulo": "ONS: Relatório Executivo do PMO (tabela MLT das ENAs, PDF)", "estado": "UTILIZADO EM INDICADOR",
         "url": "https://www.ons.org.br/paginas/energia-no-futuro/programacao-da-operacao", "licenca": c.LICENCA_ONS + "; documento do acervo digital do ONS",
         "paginas": [_P018], "downloads": ["/energia/series/agua_mlt_mudancas.csv"], "quebras": []},
        {"orgao": "Open-Meteo", "nome": "forecast-ecmwf-ifs025", "slug": "openmeteo-previsao-ecmwf", "dataset_silver": DS_PREV,
         "titulo": "Open-Meteo: previsão diária do ECMWF IFS 0,25° (chuva e temperatura) por ponto",
         "estado": "UTILIZADO EM INDICADOR", "url": cl.OPENMETEO_DOC, "licenca": LICENCA_OPENMETEO, "paginas": [_P019],
         "downloads": ["/energia/series/agua_previsao.csv"], "quebras": []},
        {"orgao": "ONS", "nome": "carga-energia-verificada", "slug": "ons-carga-verificada-areas", "dataset_silver": DS_AREAS,
         "titulo": "ONS: carga verificada por área geoelétrica (conferência estado → subsistema)",
         "estado": "UTILIZADO EM INDICADOR", "url": "https://dados.ons.org.br/dataset/carga-energia-verificada",
         "licenca": c.LICENCA_ONS, "paginas": [_P019], "downloads": [], "quebras": []},
    ],
    "arquivos": {
        "/energia/series/clima_diario.csv": (
            "Temperatura do ar a 2 m por subsistema e SIN, diária desde 2001 (NASA POWER, MERRA-2 e GEOS-IT; ESTIMADO por "
            "reanálise). Colunas: data (AAAA-MM-DD, dia em hora solar local); recorte (SE, S, NE, N, SIN); temp_media_c, "
            "temp_max_c, temp_min_c (°C; média do dia e extremos horários do dia na célula, ponderados pela população); "
            "cobertura_pop_pct (% da população do recorte representada por células com dado no dia); ufs_com_dado; "
            "fonte_versao (MERRA-2 até o fim da série MERRA-2 no POWER; GEOS-IT depois, marcado como preliminar); "
            "preliminar (1 = últimos 60 dias, sujeitos a troca GEOS-IT → MERRA-2). Ausência = campo vazio."),
        "/energia/series/agua_temperatura_uf_diario.csv": (
            "Temperatura do ar a 2 m por unidade da federação, diária desde 2019. Colunas: data; uf; subsistema (mapeamento "
            "de 2026); temp_media_c; temp_max_c; temp_min_c (°C, células MERRA-2 mais populosas da UF ponderadas pela "
            "população); populacao_uf (Censo 2022). ESTIMADO por reanálise. Ausência = vazio."),
        "/energia/series/agua_precipitacao_bacias_diario.csv": (
            "Precipitação média na área de cada bacia hidroenergética do ONS, diária desde 2016 (IMERG via NASA POWER; "
            "ESTIMADO por satélite). Colunas: data (dia UTC); bacia; precip_mm (mm/dia, média ponderada pela área); "
            "cobertura_pct (% do peso da bacia com dado); preliminar (1 = IMERG Late, sem calibração por pluviômetros)."),
        "/energia/series/agua_precipitacao_bacias_mensal.csv": (
            "Precipitação mensal por bacia desde 2001. Colunas: mes (AAAA-MM); bacia; precip_mm (soma dos dias; vazio se "
            "faltar dia); media_2001_2025_mm, p10_mm, p90_mm, anos_base (climatologia do mês); anomalia_pct "
            "(100 × (precip ÷ média − 1)); preliminar (1 = mês com dias IMERG Late)."),
        "/energia/series/agua_clima_pontos.csv": (
            "Manifesto espacial. Colunas: tipo (precipitacao ou temperatura); id; lat; lon; recorte (bacia do ONS ou UF); "
            "subrecorte (polígono do shapefile ou subsistema); passo_grau; peso (área relativa, cos(lat) × passo², ou "
            "população da célula); populacao_recorte."),
        "/energia/series/agua_previsao.csv": (
            "PREVISÃO meteorológica diária da rodada mais recente do ECMWF IFS 0,25° (Open-Meteo), agregada com as mesmas "
            "regras da estimativa observada. Colunas: emitida_em (inicialização da rodada, UTC); data (dia UTC previsto); "
            "tipo (precipitacao ou temperatura); recorte (bacia do ONS, subsistema ou SIN); precip_mm (mm no dia, média "
            "ponderada pela área dos pontos da bacia); temp_media_c e temp_max_c (°C, células mais populosas ponderadas pela "
            "população). Previsão não é observação: é substituída a cada rodada. Ausência = vazio."),
        "/energia/series/agua_subsistemas_diario.csv": (
            "EAR e ENA diárias por subsistema e SIN (ONS), desde 2022, com a captura usada. Colunas: data; recorte (SE, S, NE, "
            "N, SIN); ear_mwmes; ear_max_mwmes; ear_pct (publicado nos subsistemas; no SIN, Σ EAR ÷ Σ EAR máxima × 100); "
            "ena_bruta_mwmed (MWmed; SIN = soma); ena_bruta_pct_mlt (publicado nos subsistemas; no SIN, Σ ENA ÷ Σ MLT × 100); "
            "mlt_implicita_mwmed (ENA ÷ % MLT × 100; SIN = soma); ena_arm_mwmed (ENA armazenável, MWmed; SIN = soma); "
            "ena_arm_pct_mlt (publicado nos subsistemas; no SIN, Σ ENA armazenável ÷ Σ MLT armazenável × 100); "
            "mlt_arm_implicita_mwmed (ENA armazenável ÷ % MLT armazenável × 100; SIN = soma); captura_ear e captura_ena "
            "(fonte e instante da captura do arquivo anual usado: a mais recente entre o silver principal e a recaptura do "
            "módulo). Ausência = vazio."),
        "/energia/series/agua_ear_recortes_diario.csv": (
            "EAR e ENA diárias por REE e por bacia (ONS), desde 2022. Colunas: data; recorte (ree ou bacia); nome; ear_mwmes; "
            "ear_max_mwmes; ear_pct (publicado pelo ONS; vazio quando a EAR máxima é zero, porque o percentual não se aplica, "
            "embora o ONS escreva 0); ena_bruta_mwmed (MWmed); ena_bruta_pct_mlt; mlt_implicita_mwmed (ENA ÷ % MLT × 100). "
            "Ausência = vazio."),
        "/energia/series/agua_ear_recortes_mensal.csv": (
            "EAR no último dia do mês e ENA mensal por REE e por bacia, desde 2000. Colunas: mes; recorte; nome; dia_ear (dia "
            "usado: o último com dado no mês; no mês corrente, incompleto, é o dia mais recente); ear_mwmes_fim_mes; "
            "ear_max_mwmes_fim_mes; ear_pct_fim_mes (vazio com EAR máxima zero); ena_bruta_pct_mlt_mes (Σ ENA ÷ Σ MLT dos dias "
            "do mês, só com o mês completo); dias_ena; perimetro_ree (só REE: atual; anterior = SUL, PARANA e NORTE antes da "
            "reconfiguração de 29 e 30/12/2017, quando incluíam Iguaçu, Paranapanema e Manaus-Amapá; transicao = dezembro de "
            "2017 desses REE). Não compare pontos de perímetros diferentes."),
        "/energia/series/agua_capacidade_eventos.csv": (
            "Mudanças da EAR máxima por subsistema e sua atribuição a reservatórios. Colunas: data; subsistema; "
            "ear_max_antes_mwmes; ear_max_depois_mwmes; variacao_mwmes; cod_reservatorio; reservatorio; parte "
            "(proprio ou jusante); tipo (entrada, saida, alteracao); variacao_reservatorio_mwmes; residuo_evento_mwmes."),
        "/energia/series/agua_mlt_mudancas.csv": (
            "Mudanças da MLT por usina (ONS, ENA por reservatório). Colunas: data; cod_reservatorio; reservatorio; "
            "subsistema; mlt_antes_mwmed; mlt_depois_mwmed; variacao_pct; tipo (revisao_no_mes: mudança fora do dia 1º, "
            "em usina existente). As trocas mensais normais (dia 1º) não entram no arquivo."),
        "/energia/series/agua_reservatorios.csv": (
            "Todos os reservatórios dos dados hidráulicos do ONS, com o balanço hídrico da janela de 30 dias. Colunas: "
            "janela_inicio e janela_fim (dias das vazões; o volume inicial é o do dia anterior a janela_inicio); id "
            "(id_reservatorio do ONS); cod (cod_usina); nome; usina e rio (cadastro); subsistema; bacia; ree; tipo; "
            "vol_util_total_hm3 (cadastro ONS); ear_max_mwmes (EAR máxima própria + a jusante no dia da EAR; vazio = sem EAR "
            "no conjunto por reservatório); vol_util_pct_inicio; vol_util_pct_fim; dv_obs_hm3; afluencia_hm3; "
            "defluencia_hm3; turbinado_hm3; vertido_hm3; outras_estruturas_hm3 (somas da janela, hm³); convencao_defluencia "
            "(inclui_outras: defluência = turbinada + vertida + outras; exclui_outras: defluência = turbinada + vertida; "
            "sem_outras_estruturas; indeterminada; detectada nos dias com outras acima de 1 m³/s); "
            "defluencia_nao_discriminada_hm3 (defluência − turbinada − vertida − outras quando a convenção inclui as outras; "
            "sem descontar as outras quando as exclui; vazio quando indeterminada); transferido_hm3; natural_hm3 (vazão "
            "natural reconstituída, não fecha balanço); residuo_hm3 (dv_obs − (afluência − defluência)); "
            "residuo_com_transferencia_hm3; tolerancia_dia_hm3 (0,01% do volume útil + 0,002); dias_residuo_avaliados e "
            "dias_residuo_dentro_tolerancia_pct (na janela); serie_inicio, serie_fim, serie_dias_residuo_avaliados e "
            "serie_dias_residuo_dentro_tolerancia_pct (toda a série diária disponível); balanco_calculado (1 ou 0); "
            "motivo_sem_balanco. Ausência = vazio."),
        "/energia/series/agua_reservatorios_diario.csv": (
            "Dados hidráulicos diários dos reservatórios com volume útil, últimos 365 dias. Colunas: data; id; "
            "vol_util_pct; dv_hm3; q_afluente, q_defluente, q_turbinada, q_vertida, q_outras, q_transferida, "
            "q_natural (m³/s); residuo_hm3. Ausência = vazio."),
        "/energia/series/agua_reservatorios_45d.json": (
            "Séries diárias dos últimos 45 dias (a janela do balanço e as duas semanas anteriores) dos reservatórios da "
            "lista da gold (EAR máxima positiva no dia da EAR), lidas pela página sob demanda. Campos: fim (último dia); d0 "
            "(primeiro dia); passo_dias (1); criterio; reservatorios[] com id (id_reservatorio do ONS), nome, d0, "
            "passo_dias e os arrays vol (volume útil, % do volume útil total), afl, defl, turb, vert (vazões afluente, "
            "defluente, turbinada e vertida, m³/s); o ponto i é o dia d0 + i; null = sem dado no dia (nunca preenchido)."),
        "/energia/series/agua_bacias_geo.json": (
            "Contornos das bacias hidrográficas do ONS para o mapa, no formato das malhas de public/energia/geo: Albers "
            "cônica equivalente com a mesma grade de 100 m da camada de UF (sobreponíveis), Douglas-Peucker por anel com "
            "tolerância de 1 km. Campos: camada; fonte; url; capturado_em e sha256 do zip original no bronze; projecao; "
            "simplificacao; viewBox; contagem; conciliacao (polígonos do shapefile reunidos em cada bacia); features[] com "
            "id (nome da bacia nos conjuntos do ONS), nome, uf (vazio) e d (caminho SVG)."),
    },
}


# ================================================================ utilitários

def _agora():
    return base.agora_utc()


def _ext_de_arquivo(arquivo):
    partes = (arquivo or "").split(".")
    return partes[-2].lower() if len(partes) >= 3 and partes[-1] == "gz" else partes[-1].lower()


def _ano(recurso):
    dig = "".join(ch for ch in recurso[-4:] if ch.isdigit())
    return int(dig) if len(dig) == 4 else None


def _ja_importado(con, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? AND campo='importado_em'",
                       (DS_CONTROLE, vid)).fetchone() is not None


def _marca_importado(con, vid, colunas, extra=None):
    linhas = [(vid, "importado_em", _agora()), (vid, "colunas", ";".join(colunas or []))]
    for k, v in (extra or {}).items():
        linhas.append((vid, k, v))
    base.grava_registros(con, DS_CONTROLE, vid, linhas)


def _series_glob(con, ds, padrao, desde=None):
    """{serie: {ref: valor}} vigente de todas as séries do dataset que casam com o GLOB."""
    filtro, extra = ("AND o.ref >= ?", (desde,)) if desde else ("", ())
    out = defaultdict(dict)
    for s, ref, v in con.execute(
            f"""SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
                WHERE o.dataset=? AND o.serie GLOB ? {filtro} ORDER BY v.capturado_em, o.rowid""",
            (ds, padrao, *extra)):
        out[s][ref] = v
    return out


def _serie(con, ds, serie, desde=None):
    filtro, extra = ("AND o.ref >= ?", (desde,)) if desde else ("", ())
    out = {}
    for ref, v in con.execute(
            f"""SELECT o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
                WHERE o.dataset=? AND o.serie=? {filtro} ORDER BY v.capturado_em, o.rowid""", (ds, serie, *extra)):
        out[ref] = v
    return out


def _md(dia):
    md = dia[5:10]
    return "02-28" if md == "02-29" else md


def _dmenos(dia, n):
    return (c.d(dia) - timedelta(days=n)).isoformat()


def _dias_janela(fim, n=JANELA):
    f = c.d(fim)
    return [(f - timedelta(days=i)).isoformat() for i in range(n - 1, -1, -1)]


def _pearson(xs, ys):
    pares = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pares)
    if n < 10:
        return None, n
    mx = sum(p[0] for p in pares) / n
    my = sum(p[1] for p in pares) / n
    sxx = sum((p[0] - mx) ** 2 for p in pares)
    syy = sum((p[1] - my) ** 2 for p in pares)
    if sxx <= 0 or syy <= 0:
        return None, n
    return sum((p[0] - mx) * (p[1] - my) for p in pares) / math.sqrt(sxx * syy), n


def _faixa(v, p10, p90):
    if v is None or p10 is None or p90 is None:
        return None
    return "abaixo" if v < p10 else ("acima" if v > p90 else "dentro")


def _bandas_do_dia(serie, dia, ano_ini, valido=None):
    """p10, p50, p90 e n do valor do mesmo dia do calendário nos anos completos de ano_ini
    ao ano anterior ao do dia (29/02 fora da distribuição; como referência usa 28/02).
    valido(dia_do_ano) → False tira o ano da distribuição (ex.: EAR máxima zero, quando o
    percentual não se aplica)."""
    ano_ref = int(dia[:4])
    md = _md(dia)
    vs = [serie[f"{a}-{md}"] for a in range(ano_ini, ano_ref)
          if f"{a}-{md}" in serie and (valido is None or valido(f"{a}-{md}"))]
    if not vs:
        return None, None, None, 0, []
    return c.quantil(vs, 0.1), c.quantil(vs, 0.5), c.quantil(vs, 0.9), len(vs), vs


# Com menos de 5 anos na base, p10 e p90 seriam praticamente o mínimo e o máximo de 2 a 4
# valores: a faixa e o percentil não são publicados (o número de anos é).
MIN_ANOS_FAIXA = 5


def faixa_sazonal(pct, mw, mx, dia, ano_ini, minimo=MIN_ANOS_FAIXA):
    """Faixa sazonal de um recorte de EAR (subsistema, SIN, REE ou bacia) no dia.

    pct, mw, mx: {dia: valor} do percentual, da EAR em MWmês e da EAR máxima. Regras:
    - EAR máxima zero no dia (recorte sem armazenamento, só fio d'água): o percentual não
      se aplica, e faixa, percentil e bandas ficam nulos (nunca 0/0 = 0);
    - anos da base com EAR máxima zero (reservatório ainda não existia) ficam fora da
      distribuição pelo mesmo motivo;
    - menos de `minimo` anos: sem faixa e sem percentil;
    - periodo_base traz o primeiro e o último ano realmente usados;
    - capacidade_mudou_na_base sinaliza EAR máxima que variou mais de 5% entre os anos
      usados ou cuja mediana na base difere da atual em mais de 5%: a faixa em % compara
      capacidades diferentes (a faixa em MWmês vem ao lado)."""
    v, m_, x = pct.get(dia), mw.get(dia), mx.get(dia)
    sem_arm = x is not None and x == 0
    def ok(k):  # noqa: E306
        return mx.get(k) is not None and mx[k] > 0
    p10, p50, p90, n, vs = _bandas_do_dia(pct, dia, ano_ini, ok)
    q10, q50, q90, _nm, _ = _bandas_do_dia(mw, dia, ano_ini, ok)
    md = _md(dia)
    anos = [a for a in range(ano_ini, int(dia[:4])) if f"{a}-{md}" in pct and ok(f"{a}-{md}")]
    maxs = [mx[f"{a}-{md}"] for a in anos]
    publica = not sem_arm and v is not None and n >= minimo
    cap_mudou = bool(maxs and x is not None and x > 0 and (max(maxs) - min(maxs) > 0.05 * x
                                                            or abs(x - c.quantil(maxs, 0.5)) > 0.05 * x))
    return {
        "p10": c.r(p10, 2) if publica else None, "p50": c.r(p50, 2) if publica else None,
        "p90": c.r(p90, 2) if publica else None, "anos_na_base": 0 if sem_arm else n,
        "periodo_base": f"{anos[0]}-{anos[-1]}" if anos and not sem_arm else None,
        "p10_mwmes": c.r(q10, 1) if publica else None, "p50_mwmes": c.r(q50, 1) if publica else None,
        "p90_mwmes": c.r(q90, 1) if publica else None,
        "faixa": _faixa(v, p10, p90) if publica else None,
        "percentil_na_data": c.r(c.percentil_de(v, vs), 1) if publica else None,
        "ear_max_base_min_mwmes": c.r(min(maxs), 1) if maxs and not sem_arm else None,
        "ear_max_base_max_mwmes": c.r(max(maxs), 1) if maxs and not sem_arm else None,
        "capacidade_mudou_na_base": cap_mudou,
    }


def configuracao_ree(max_por_ree, tol_rel=0.001, busca_dias=31):
    """Quebras de perímetro dos REE detectadas nos próprios arquivos do ONS.

    max_por_ree: {REE: {dia: EAR máxima}}. Quebra = primeiro aparecimento de um REE com
    EAR máxima positiva depois do início do conjunto (REE novo recortado de REE
    existentes). Ausências temporárias (dias sem a linha de um REE) e REE sem armazenamento
    (EAR máxima zero, como ITAIPU, que some do arquivo de 2019 a 2025 e volta em 2026) não
    movem capacidade e não são quebra. Numa repartição, a soma das EAR máximas se conserva:
    procura-se, até `busca_dias` antes da quebra, o último dia com a soma igual à do dia da
    quebra (dentro de tol_rel) e compara-se cada REE entre os dois dias. REE cuja EAR
    máxima mudou (além do arredondamento a MWmês inteiros) e os REE novos têm outro
    perímetro antes da quebra: a base da faixa deles começa no primeiro ano completo depois
    dela. Dias entre os dois (perímetro já mudado, REE novos ainda ausentes) são listados
    como transição. Sem dia de soma conservada, todos os REE existentes contam como
    afetados (conservador)."""
    por_dia = defaultdict(dict)
    for n_, s_ in max_por_ree.items():
        for k, v in s_.items():
            if v is not None:
                por_dia[k][n_] = v
    dias = sorted(por_dia)
    if not dias:
        return None
    # primeiro dia em que cada nome aparece (com qualquer valor); é quebra quando o REE novo
    # já chega com capacidade (TELES PIRES existe desde 2016 com EAR máxima zero e ganha
    # capacidade depois: isso é mudança de capacidade, sinalizada na faixa, não de perímetro)
    primeiro = {}
    for k in dias:
        for n_ in por_dia[k]:
            primeiro.setdefault(n_, k)
    primeiro = {n_: k for n_, k in primeiro.items() if por_dia[k][n_] > 0}
    datas_q = sorted({k for n_, k in primeiro.items() if k > dias[0]})
    quebras = []
    ano_base = {n_: int(min(k for k in max_por_ree[n_] if max_por_ree[n_][k] is not None)[:4]) for n_ in max_por_ree
                if any(v is not None for v in max_por_ree[n_].values())}
    for q in datas_q:
        novos = sorted(n_ for n_, k in primeiro.items() if k == q)
        tot_q = sum(por_dia[q].values())
        idx = dias.index(q)
        ref = None
        for k in reversed(dias[max(0, idx - busca_dias):idx]):
            if abs(sum(por_dia[k].values()) - tot_q) <= tol_rel * max(tot_q, 1e-9):
                ref = k
                break
        afetados = set(novos)
        comp = []
        for n_ in sorted(set(por_dia[q]) | set(por_dia[ref] if ref else {})):
            a = por_dia[ref].get(n_) if ref else None
            b = por_dia[q].get(n_)
            if n_ in novos:
                mudou = True
            elif ref is None:
                mudou = True
            elif a is None or b is None:
                mudou = (a or 0) > 0 or (b or 0) > 0
            else:
                mudou = abs(b - a) > max(1.0, 0.001 * max(abs(a), abs(b)))
            if mudou:
                afetados.add(n_)
            comp.append({"nome": n_, "ear_max_antes_mwmes": c.r(a, 3), "ear_max_depois_mwmes": c.r(b, 3),
                         "perimetro_mudou": bool(mudou), "novo": n_ in novos})
        ano_q = int(q[:4]) if q[5:] == "01-01" else int(q[:4]) + 1
        for n_ in afetados:
            ano_base[n_] = max(ano_base.get(n_, ano_q), ano_q)
        quebras.append({
            "data": q, "dia_soma_conservada": ref,
            "transicao": [k for k in dias[:idx] if ref and k > ref],
            "novos": novos, "afetados": sorted(afetados),
            "soma_ear_max_antes_mwmes": c.r(sum(por_dia[ref].values()), 3) if ref else None,
            "soma_ear_max_depois_mwmes": c.r(tot_q, 3), "comparacao": comp,
        })
    ult = quebras[-1] if quebras else None
    return {"quebras": quebras, "quebra": ult["data"] if ult else None,
            "afetados": sorted({n_ for q in quebras for n_ in q["afetados"]}),
            "ano_inicio_base": ano_base}


def _col(linhas, campos):
    """Lista de dicts → dict de colunas (mesmo comprimento). A gold é escrita com
    indentação, e colunas evitam repetir o nome de cada campo em cada ponto."""
    return {k: [x.get(k) for x in linhas] for k in campos}


def _fonte_arquivos(orgao, conjunto, url, vintages):
    """Bloco `fonte` da evidência com um ou vários arquivos (vintages do silver)."""
    arqs = [ev.arquivo_de_vintage(v) for v in vintages if v]
    f = {"orgao": orgao, "conjunto": conjunto, "recurso": None, "url": url, "arquivo": None, "sha256": None,
         "capturado_em": None, "publicado_em": None}
    if len(arqs) == 1:
        f.update({k: arqs[0].get(k) for k in ("recurso", "arquivo", "sha256", "capturado_em", "publicado_em")})
    elif arqs:
        f["arquivos"] = arqs
    return f


def _vintage_do_ano(con, ds, prefixo, ano):
    return base.ultima_vintage(con, ds, f"{prefixo}{ano}")


# ================================================================ coleta

def _baixa_pacote_ons(con, chave, ds, hoje, preferir, ano_min, status, anos=None):
    """Baixa os recursos anuais de um conjunto do ONS e devolve [(ano, vintage)]."""
    pacote, _dir, prefixo = oa.PACOTES[chave]
    st = {"conjunto": pacote, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    try:
        pac = ckan.pacote("ONS", pacote)
    except Exception as e:  # pane da API: registrada, a gold usa o que já está no silver
        base.registra_coleta(con, ds, "*", False, f"package_show: {e}")
        st["falhas"].append(f"package_show: {e}")
        status[ds] = st
        return []
    meta = ckan.metadados(pac, "ONS")
    base.escreve_gold(f"_meta_{ds}.json", meta, destino=os.path.join(base.DADOS, "meta"))
    _baixa_dicionarios(con, pac, st)
    if chave in ("cadastro", "bacias_shp"):
        recursos = {}
        for r in pac.get("resources", []):
            arq = (r.get("url") or "").rsplit("/", 1)[-1]
            fmt = (r.get("format") or "").upper()
            if arq.startswith(prefixo) and fmt in preferir:
                recursos.setdefault(0, {})[fmt] = r
        recursos = {0: next(recursos[0][f] for f in preferir if f in recursos.get(0, {}))} if recursos else {}
    else:
        recursos = oa.recursos_anuais(pac, prefixo, preferir)
    out = []
    for ano in sorted(recursos):
        if ano and (ano < ano_min or (anos and ano not in anos)):
            continue
        r = recursos[ano]
        url = r.get("url")
        arq = url.rsplit("/", 1)[-1]
        recurso, _, ext = arq.rpartition(".")
        idade = 1 if ano in (0, hoje.year) else 30
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=ds, recurso=recurso, url=url,
                                  publicado_em=r.get("last_modified"), ext=ext.lower(), max_idade_dias=idade)
        chave_st = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave_st:
            st[chave_st] += 1
        else:
            st["falhas"].append(f"{recurso}: {res['detalhe']}")
        if res["vintage"]:
            out.append((ano, res["vintage"]))
        if res["status"] in ("nova", "identica"):
            time.sleep(0.3)
    status[ds] = st
    return out


def _baixa_dicionarios(con, pac, st):
    for r in pac.get("resources", []):
        url = r.get("url") or ""
        arq = url.rsplit("/", 1)[-1]
        if "Dicionario" not in arq:
            continue
        recurso, _, ext = arq.rpartition(".")
        res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_DIC, recurso=f"{recurso}.{ext.lower()}", url=url,
                                  publicado_em=r.get("last_modified"), ext=ext.lower(), max_idade_dias=30)
        if res["status"] == "falha":
            st["falhas"].append(f"{arq}: {res['detalhe']}")


def _importa_ons(con, chave, ds, ano, vint):
    """Importa uma vintage do bronze para o silver (uma vez por vintage)."""
    vid = vint["vintage_id"]
    if _ja_importado(con, vid):
        return None
    ext = _ext_de_arquivo(vint["arquivo"])
    cols = oa.colunas_bronze(vint["arquivo"], ext)
    extra = {}
    if chave in ("ear_ree", "ear_bacia"):
        linhas = oa.parse_ear_agregado(oa.linhas_bronze(vint["arquivo"], ext), "ree" if chave == "ear_ree" else "bacia")
        novas, revs = base.grava_observacoes(con, ds, vid, linhas)
    elif chave in ("ena_ree", "ena_bacia"):
        linhas = oa.parse_ena_agregado(oa.linhas_bronze(vint["arquivo"], ext), "ree" if chave == "ena_ree" else "bacia")
        novas, revs = base.grava_observacoes(con, ds, vid, linhas)
    elif chave == "ear_res":
        res = oa.parse_ear_reservatorio(oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_EAR_RES), DIARIO_EAR_RES)
        obs = list(res["obs"])
        for (sm, ref), (e, m) in res["soma"].items():
            obs.append((f"soma_ear_mwmes.{sm}", ref, e))
            obs.append((f"soma_earmax_mwmes.{sm}", ref, m))
        novas, revs = base.grava_observacoes(con, ds, vid, obs)
        regs = []
        for cod, (p0, p1) in res["presenca"].items():
            regs += [(f"{cod}|{ano}", "primeiro_dia", p0), (f"{cod}|{ano}", "ultimo_dia", p1)]
        for cod, at in res["atributos"].items():
            regs += [(f"{cod}|{ano}", k, v or None) for k, v in at.items()]
        base.grava_registros(con, ds, vid, regs)
    elif chave == "ena_res":
        novas, revs = base.grava_observacoes(con, ds, vid, oa.parse_ena_reservatorio(
            oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_ENA_RES)))
    elif chave == "hidro_res":
        obs, atrib = oa.parse_dados_hidrologicos(oa.linhas_bronze(vint["arquivo"], ext, oa.COLS_HIDRO), HIDRO_DESDE)
        novas, revs = base.grava_observacoes(con, ds, vid, obs)
        base.grava_registros(con, ds, vid, [(rid, k, v or None) for rid, at in atrib.items() for k, v in at.items()])
    elif chave in ("ear_sm", "ena_sm"):
        texto = _le_bronze(vint).decode("utf-8-sig", errors="replace")
        novas, revs = base.grava_observacoes(con, ds, vid, (ons_sm.parse_ear if chave == "ear_sm" else ons_sm.parse_ena)(texto))
    elif chave == "cadastro":
        regs, dup = oa.parse_cadastro(oa.linhas_bronze(vint["arquivo"], ext))
        novas, revs = base.grava_registros(con, ds, vid, regs)
        extra["linhas_repetidas"] = json.dumps(dup, ensure_ascii=False)
    else:
        return None
    _marca_importado(con, vid, cols, extra)
    con.commit()
    return {"recurso": vint["recurso"], "novas": novas, "revisoes": revs}


def _baixa_url(con, orgao, ds, recurso, url, ext, idade, pausa=0.0):
    res = ckan.baixar_recurso(con, orgao=orgao, dataset=ds, recurso=recurso, url=url, ext=ext, max_idade_dias=idade)
    if pausa and res["status"] in ("nova", "identica"):
        time.sleep(pausa)
    return res


def _le_bronze(vint):
    with base.abre_bronze(vint["arquivo"]) as f:
        return f.read()


def _pontos_precipitacao(con, st):
    """Pontos de grade dentro dos polígonos das bacias (registros DS_PONTOS_PR)."""
    v = base.ultima_vintage(con, DS_SHP, "Bacias_Hidrograficas_SIN")
    if not v:
        st["falhas"].append("shapefile de bacias ausente no bronze")
        return []
    bacias = cl.bacias_do_zip(_le_bronze(v))
    regs, pontos = [], []
    for b in bacias:
        passo, pts = cl.pontos_grade(b)
        for p in pts:
            pid = cl.id_ponto_precip(p["lat"], p["lon"])
            ch = f"{b['nome_shape']}|{pid}"
            pontos.append({**p, "id": pid, "bacia_shape": b["nome_shape"], "bacia": b["bacia_ons"], "passo": passo})
            regs += [(ch, "lat", repr(p["lat"])), (ch, "lon", repr(p["lon"])), (ch, "peso", repr(p["peso"])),
                     (ch, "passo", repr(passo)), (ch, "bacia", b["bacia_ons"]), (ch, "ponto", pid)]
    vid = _vintage_derivada(con, DS_PONTOS_PR, "pontos", {"origem": v["sha256"], "regra": [cl.PASSOS, cl.MIN_PONTOS],
                                                          "pontos": sorted(r[0] for r in regs)})
    base.grava_registros(con, DS_PONTOS_PR, vid, regs + _remocoes(con, DS_PONTOS_PR, regs))
    con.commit()
    return pontos


TOL_GEO_BACIAS_M = 1000   # a mesma tolerância da camada de UF: invisível no mapa do país inteiro
ARQ_GEO_BACIAS = "agua_bacias_geo.json"


def camada_bacias(bacias, vint, origem=None):
    """Camada das bacias do ONS para o mapa da página, no formato das malhas de
    public/energia/geo (lib/energia/geo.ts): mesma projeção (Albers cônica equivalente) e
    mesma grade de quantização da camada de UF, para que as duas se sobreponham sem ajuste.

    Uma feature por bacia dos conjuntos do ONS (id = nome da bacia nos conjuntos, o mesmo da
    gold), com os polígonos do shapefile que a compõem (BACIA_ONS: AMAZONAS reúne Madeira,
    Tapajós, Xingu e outros). Cada anel é simplificado sozinho (Douglas-Peucker em metros
    projetados): o shapefile não traz topologia, então a divisa de duas bacias vizinhas pode
    se afastar até a tolerância, abaixo de um pixel no mapa do país. Anel que degeneraria
    recebe tolerância menor; nenhum polígono é descartado (falha em vez de publicar sem ele)."""
    from pipeline.energia import geo
    origem = origem or geo.origem_da_grade()
    por_bacia, poligonos, reduzidos = defaultdict(list), defaultdict(list), 0
    for b in bacias:
        if not b["bacia_ons"]:
            raise ValueError(f"polígono {b['nome_shape']} sem bacia correspondente nos conjuntos do ONS")
        poligonos[b["bacia_ons"]].append(b["nome_shape"])
        for anel in b["aneis"]:
            proj = [geo.albers(lon, lat) for lon, lat in anel]
            tol, q = TOL_GEO_BACIAS_M, None
            while True:
                q = geo.limpa_anel([geo.quantiza(p, origem) for p in geo.douglas_peucker(proj, tol)])
                if geo.anel_valido(q) or tol <= 0:
                    break
                tol, reduzidos = tol // 2 if tol > 1 else 0, reduzidos + 1
            if not geo.anel_valido(q):
                raise ValueError(f"anel de {b['nome_shape']} sem área na grade de {geo.GRADE_M} m")
            por_bacia[b["bacia_ons"]].append(geo.orienta(q, True))
    features, caixas = [], []
    for nome in sorted(por_bacia):
        aneis = por_bacia[nome]
        caixas.append(geo.caixa(aneis))
        features.append({"id": nome, "nome": nome, "uf": "", "d": geo.caminho_svg(aneis)})
    x0, y0 = min(cx[0] for cx in caixas), min(cx[1] for cx in caixas)
    x1, y1 = max(cx[2] for cx in caixas), max(cx[3] for cx in caixas)
    n_pol = sum(len(b["aneis"]) for b in bacias)
    return {
        "camada": "bacias_ons",
        "titulo": "Bacias hidrográficas do SIN (contornos do ONS)",
        "fonte": "ONS, Contornos das Bacias Hidrográficas (Bacias_Hidrograficas_SIN.zip)",
        "url": vint["url"], "url_nomes": vint["url"],
        "capturado_em": vint["capturado_em"], "sha256": vint["sha256"], "sha256_nomes": vint["sha256"],
        "bronze": vint["arquivo"],
        "malha": {"revisao": None, "nota_liberacao": "versão do conjunto de 31/01/2023 (página do conjunto no portal do ONS)",
                  "data_nota": None, "documentacao": URLS.get("bacias_shp", "https://dados.ons.org.br/dataset/bacia_contorno"),
                  "qualidade": "original do ONS simplificado", "formato_original": "shapefile (polígonos em graus, WGS84)"},
        "projecao": {"nome": "Albers cônica equivalente", "paralelos_padrao": list(geo.PARALELOS_PADRAO),
                     "meridiano_central": geo.MERIDIANO_CENTRAL, "latitude_origem": geo.LATITUDE_ORIGEM,
                     "superficie": f"esfera autálica do GRS80 (R = {geo.R_AUTALICO} m); coordenadas de entrada em WGS84",
                     "unidade_svg_m": geo.GRADE_M, "origem_m": [origem[0], origem[1]],
                     "eixo_y": "para baixo (coordenada de tela do SVG)"},
        "simplificacao": {"metodo": "Douglas-Peucker por anel (o shapefile não tem topologia: divisas vizinhas podem se afastar até a tolerância)",
                          "tolerancia_m": TOL_GEO_BACIAS_M, "arcos_com_tolerancia_reduzida": reduzidos,
                          "garantia": "nenhum polígono é descartado; anel que degeneraria recebe tolerância menor"},
        "viewBox": f"{x0} {y0} {x1 - x0} {y1 - y0}",
        "contagem": {"features": len(features), "poligonos": sum(len(a) for a in por_bacia.values()),
                     "poligonos_origem": n_pol, "aneis": sum(len(a) for a in por_bacia.values())},
        "conciliacao": {"nomes_sem_geometria": [], "poligonos_por_bacia": {k: sorted(v) for k, v in sorted(poligonos.items())}},
        "features": features,
    }


def _camada_bacias(con):
    v = base.ultima_vintage(con, DS_SHP, "Bacias_Hidrograficas_SIN")
    if not v:
        return None
    return camada_bacias(cl.bacias_do_zip(_le_bronze(v)), v)


def _vintage_derivada(con, ds, recurso, manifesto):
    """Vintage de uma seleção derivada (pontos de grade, células): muda quando a origem ou
    a regra muda, para que pontos retirados fiquem apagados no histórico de registros (uma
    vintage nova é necessária: o registro é imutável por vintage)."""
    corpo = json.dumps(manifesto, ensure_ascii=False, sort_keys=True).encode("utf-8")
    capt = _agora()
    arquivo, sha = base.salva_bronze("derivado", ds, recurso, corpo, "json", capt)
    vid, _nova = base.registra_vintage(con, ds, recurso, "derivado", capt, None, sha, len(corpo), "agregacao", arquivo)
    return vid


def _vigentes(con, ds):
    """Registros vigentes com ao menos um campo (pontos removidos ficam só no histórico)."""
    return {ch: campos for ch, campos in base.registros_como_estavam_em(con, ds).items() if campos}


def _remocoes(con, ds, regs):
    """Linhas (chave, campo, None) para pontos que deixaram de ser escolhidos: o registro
    fica com o campo apagado (histórico preservado) e some da lista vigente."""
    novas = {ch for ch, _c, _v in regs}
    out = []
    for ch, campos in base.registros_como_estavam_em(con, ds).items():
        if ch not in novas:
            out += [(ch, k, None) for k in campos]
    return out


def _celulas_temperatura(con, st):
    vl = base.ultima_vintage(con, DS_IBGE_LOC, "Localidades_Brasil_shp")
    vm = base.ultima_vintage(con, DS_IBGE_POP, "populacao_municipios_2022")
    vu = base.ultima_vintage(con, DS_IBGE_POP, "populacao_ufs_2022")
    if not (vl and vm and vu):
        st["falhas"].append("IBGE (localidades ou população) ausente no bronze")
        return []
    sedes = cl.sedes_municipais(_le_bronze(vl))
    pop_mun = cl.populacao_sidra(_le_bronze(vm))
    pop_uf_cod = cl.populacao_sidra(_le_bronze(vu))
    cod_uf = {}
    for cod, (uf, *_r) in sedes.items():
        cod_uf[cod[:2]] = uf
    pop_uf = {cod_uf[k]: v for k, v in pop_uf_cod.items() if k in cod_uf}
    escolha, cobertura = cl.seleciona_celulas(sedes, pop_mun, pop_uf)
    regs, cels = [], []
    for uf, sel in escolha.items():
        for cel in sel:
            ch = f"{uf}|{cel['id']}"
            regs += [(ch, "lat", repr(cel["lat"])), (ch, "lon", repr(cel["lon"])), (ch, "pop", str(cel["pop"])),
                     (ch, "uf", uf), (ch, "subsistema", cl.UF_SUBSISTEMA.get(uf, "")), (ch, "pop_uf", str(pop_uf.get(uf))),
                     (ch, "cobertura_uf", repr(round(cobertura[uf], 6))), (ch, "celula", cel["id"])]
            cels.append({**cel, "uf": uf})
    vid = _vintage_derivada(con, DS_PONTOS_T, "celulas", {"origem": [vl["sha256"], vm["sha256"], vu["sha256"]],
                                                         "regra": [cl.COBERTURA_UF, cl.MAX_CELULAS_UF],
                                                         "celulas": sorted(r[0] for r in regs)})
    base.grava_registros(con, DS_PONTOS_T, vid, regs + _remocoes(con, DS_PONTOS_T, regs))
    con.commit()
    st["municipios_com_populacao"] = sum(1 for k in sedes if k in pop_mun)
    st["municipios_sedes"] = len(sedes)
    return cels


def _coleta_power(con, pontos, tipo, ds, hoje, prazo, st):
    """Baixa, por ponto, as janelas histórica e recente do POWER. Respeita o prazo (a
    coleta continua na próxima execução) e pausa entre requisições."""
    jan = cl.janelas(hoje, tipo)
    ini_hist = cl.PRECIP_INICIO if tipo == "precip" else cl.TEMP_INICIO
    feitos = set()
    for p in pontos:
        if p["id"] in feitos:
            continue
        feitos.add(p["id"])
        for nome_j, (lim, idade) in jan.items():
            if time.time() > prazo:
                st["interrompido_por_prazo"] = True
                return
            ini, fim = (ini_hist, lim) if nome_j == "historico" else (lim, hoje.isoformat())
            url = cl.url_power(tipo, p["lat"], p["lon"], ini, fim)
            res = _baixa_url(con, "NASA", ds, f"{p['id']}_{nome_j}", url, "json", idade, pausa=0.25)
            st[res["status"]] = st.get(res["status"], 0) + 1
            if res["status"] == "falha":
                st.setdefault("falhas", []).append(f"{p['id']}_{nome_j}: {res['detalhe'][:120]}")
                if len(st["falhas"]) > 20:
                    st["interrompido_por_falhas"] = True
                    return


def _serie_ponto(con, ds, pid, parametro, cache):
    """Série diária de um ponto: histórico sobreposto pelo recente. None = ausência."""
    chave = (ds, pid)
    if chave not in cache:
        vh = base.ultima_vintage(con, ds, f"{pid}_historico")
        vr = base.ultima_vintage(con, ds, f"{pid}_recente")
        if not (vh and vr):
            cache[chave] = None
        else:
            dh, _h, _m = cl.le_power(_le_bronze(vh))
            dr, _h, _m = cl.le_power(_le_bronze(vr))
            merged = {}
            for par in set(dh) | set(dr):
                s = dict(dh.get(par, {}))
                s.update({k: v for k, v in dr.get(par, {}).items()})
                merged[par] = s
            cache[chave] = {"dados": merged, "shas": (vh["sha256"], vr["sha256"])}
    x = cache[chave]
    return None if x is None else x["dados"].get(parametro)


def _grava_agregado(con, ds, recurso, manifesto, obs):
    """Registra a vintage de um agregado derivado (manifesto no bronze) e grava as
    observações. Mesmo manifesto (mesmos arquivos de origem) = mesma vintage."""
    corpo = json.dumps(manifesto, ensure_ascii=False, sort_keys=True).encode("utf-8")
    capt = _agora()
    arquivo, sha = base.salva_bronze("derivado", ds, recurso, corpo, "json", capt)
    vid, nova = base.registra_vintage(con, ds, recurso, manifesto.get("origem_url"), capt, None, sha, len(corpo),
                                      "agregacao", arquivo)
    if not nova:
        return 0, 0
    r = base.grava_observacoes(con, ds, vid, obs)
    con.commit()
    return r


def _manifesto_inalterado(con, ds, recurso, ids, base_manifesto):
    """True quando os arquivos de origem (sha256 das duas janelas de cada ponto) são os do
    último agregado: evita reler centenas de JSON a cada execução."""
    shas = []
    for pid in ids:
        vh = base.ultima_vintage(con, ds, f"{pid}_historico")
        vr = base.ultima_vintage(con, ds, f"{pid}_recente")
        if not (vh and vr):
            return False
        shas.append((pid, vh["sha256"], vr["sha256"]))
    ult = base.ultima_vintage(con, base_manifesto[0], base_manifesto[1])
    if not ult:
        return False
    try:
        with base.abre_bronze(ult["arquivo"]) as f:
            man = json.loads(f.read().decode("utf-8"))
    except Exception:
        return False
    itens = man.get("pontos") or man.get("celulas") or []
    antes = sorted((x["id"], *x["vintages"]) for x in itens)
    return antes == sorted(set(shas)) or sorted(set(antes)) == sorted(set(shas))


def _agrega_precipitacao(con, pontos, st):
    por_bacia = defaultdict(list)
    for p in pontos:
        if p["bacia"]:
            por_bacia[p["bacia"]].append(p)
    cache = {}
    feitas = 0
    for bacia, pts in sorted(por_bacia.items()):
        if _manifesto_inalterado(con, DS_POWER_PR, f"bacia_{bacia}", [p["id"] for p in pts], (DS_CLIMA_PR, f"bacia_{bacia}")):
            st["bacias_inalteradas"] = st.get("bacias_inalteradas", 0) + 1
            continue
        series, faltam = [], []
        for p in pts:
            s = _serie_ponto(con, DS_POWER_PR, p["id"], "IMERG_PRECTOT", cache)
            if s is None:
                faltam.append(p["id"])
            else:
                series.append((p, s))
        if faltam:
            st.setdefault("bacias_pendentes", []).append(f"{bacia}: {len(faltam)} de {len(pts)} pontos sem as duas janelas")
            continue
        wtot = sum(p["peso"] for p in pts)
        dias_ = sorted(set().union(*(set(s) for _p, s in series)))
        obs = []
        for d in dias_:
            vals = [(s.get(d), p["peso"]) for p, s in series if s.get(d) is not None]
            w = sum(x[1] for x in vals)
            cob = 100.0 * w / wtot if wtot else 0.0
            if cob < 99.9999:
                # cobertura só é guardada quando incompleta: ausência da linha = todos os pontos com dado
                obs.append((f"cobertura_pct.{bacia}", d, cob))
            if cob >= 80.0:
                obs.append((f"precip_mm.{bacia}", d, cl.media_ponderada(vals)))
        manifesto = {"regra": "média ponderada pela área (cos(lat) × passo²) dos pontos com dado; dia publicado só com "
                              "cobertura de ao menos 80% do peso da bacia",
                     "origem_url": cl.POWER, "bacia": bacia,
                     "pontos": [{"id": p["id"], "lat": p["lat"], "lon": p["lon"], "peso": p["peso"],
                                 "poligono": p["bacia_shape"], "vintages": cache[(DS_POWER_PR, p["id"])]["shas"]}
                                for p, _s in series]}
        _grava_agregado(con, DS_CLIMA_PR, f"bacia_{bacia}", manifesto, obs)
        feitas += 1
        cache.clear()
    st["bacias_agregadas"] = feitas


def _agrega_temperatura(con, celulas, st):
    por_uf = defaultdict(list)
    for cel in celulas:
        por_uf[cel["uf"]].append(cel)
    pop_uf = {}
    for ch, campos in _vigentes(con, DS_PONTOS_T).items():
        pop_uf[campos.get("uf")] = int(campos["pop_uf"]) if campos.get("pop_uf", "None") != "None" else None
    if _manifesto_inalterado(con, DS_POWER_T, "temperatura", sorted({cel["id"] for cel in celulas}), (DS_CLIMA_T, "temperatura")):
        st["temperatura_inalterada"] = True
        return
    cache, uf_series, manif = {}, {}, []
    for uf, cels in sorted(por_uf.items()):
        pars = {}
        ok = True
        for par in ("T2M", "T2M_MAX", "T2M_MIN"):
            ss = []
            for cel in cels:
                s = _serie_ponto(con, DS_POWER_T, cel["id"], par, cache)
                if s is None:
                    ok = False
                    break
                ss.append((cel, s))
            if not ok:
                break
            pars[par] = ss
        if not ok:
            st.setdefault("ufs_pendentes", []).append(uf)
            continue
        wt = sum(cel["pop"] for cel in cels)
        out = {}
        for par, ss in pars.items():
            dias_ = set().union(*(set(s) for _c, s in ss))
            serie = {}
            ncel = {}
            for d in dias_:
                vals = [(s.get(d), cel["pop"]) for cel, s in ss if s.get(d) is not None]
                w = sum(x[1] for x in vals)
                if w >= 0.8 * wt:
                    serie[d] = cl.media_ponderada(vals)
                ncel[d] = len(vals)
            out[par] = serie
            out[f"n_{par}"] = ncel
        uf_series[uf] = out
        manif += [{"uf": uf, "id": cel["id"], "lat": cel["lat"], "lon": cel["lon"], "pop": cel["pop"],
                   "vintages": cache[(DS_POWER_T, cel["id"])]["shas"]} for cel in cels]
    if not uf_series:
        return
    obs = []
    for uf, out in uf_series.items():
        for par, nome_s in (("T2M", "t2m_c"), ("T2M_MAX", "t2m_max_c"), ("T2M_MIN", "t2m_min_c")):
            for d, v in out[par].items():
                if d >= UF_DESDE:
                    obs.append((f"{nome_s}.UF_{uf}", d, v))
    # subsistemas e SIN: média dos estados ponderada pela população (Censo 2022); só com
    # todos os estados do recorte coletados, e dia publicado com cobertura ≥ 90% da população
    grupos = {sm: [uf for uf, s in cl.UF_SUBSISTEMA.items() if s == sm] for sm in SMS}
    grupos["SIN"] = list(cl.UF_SUBSISTEMA)
    for rec, ufs in grupos.items():
        if any(uf not in uf_series for uf in ufs):
            st.setdefault("recortes_pendentes", []).append(rec)
            continue
        ptot = sum(pop_uf.get(uf) or 0 for uf in ufs)
        for par, nome_s in (("T2M", "t2m_c"), ("T2M_MAX", "t2m_max_c"), ("T2M_MIN", "t2m_min_c")):
            dias_ = set().union(*(set(uf_series[uf][par]) for uf in ufs))
            for d in dias_:
                vals = [(uf_series[uf][par][d], pop_uf.get(uf) or 0) for uf in ufs if d in uf_series[uf][par]]
                w = sum(x[1] for x in vals)
                if par == "T2M" and len(vals) < len(ufs):
                    # cobertura só é guardada quando falta alguma UF (ausência da linha = todas com dado)
                    obs.append((f"cobertura_pop_pct.{rec}", d, 100.0 * w / ptot if ptot else 0.0))
                    obs.append((f"ufs_com_dado.{rec}", d, float(len(vals))))
                if ptot and w >= 0.9 * ptot:
                    obs.append((f"{nome_s}.{rec}", d, cl.media_ponderada(vals)))
    manifesto = {"regra": "UF: média das células ponderada pela população (Censo 2022) das sedes municipais na célula; "
                          "subsistema e SIN: média das UFs ponderada pela população da UF",
                 "origem_url": cl.POWER, "celulas": manif, "uf_subsistema": cl.UF_SUBSISTEMA}
    _grava_agregado(con, DS_CLIMA_T, "temperatura", manifesto, obs)
    st["ufs_agregadas"] = len(uf_series)


def _coleta_areas(con, st):
    """Carga verificada de um dia por área geoelétrica (34 consultas, uma vez): prova do
    mapeamento estado → subsistema usado na temperatura."""
    import re
    areas = sorted({a for lst in cl.AREAS_CARGA.values() for a in lst} | set(cl.COD_AREA_SUBSISTEMA.values()))
    for a in areas:
        url = URL_AREAS.format(d=DIA_AREAS, a=a)
        res = _baixa_url(con, "ONS", DS_AREAS, a, url, "json", 3650, pausa=0.3)
        v = res.get("vintage")
        if res["status"] == "falha" or not v:
            st.setdefault("falhas", []).append(f"área {a}: {res['detalhe'][:100]}")
            continue
        if _ja_importado(con, v["vintage_id"]):
            continue
        txt = _le_bronze(v).decode("utf-8", "replace")
        vals = [float(x) for x in re.findall(r'"val_cargaglobal":\s*(-?[0-9.]+)', txt)]
        obs = [(f"carga_media_mwmed.{a}", DIA_AREAS, sum(vals) / len(vals))] if vals else []
        obs += [(f"intervalos.{a}", DIA_AREAS, float(len(vals)))]
        base.grava_observacoes(con, DS_AREAS, v["vintage_id"], obs)
        _marca_importado(con, v["vintage_id"], ["cod_areacarga", "val_cargaglobal"])
    con.commit()


def _existe(url):
    """HEAD no acervo do ONS: só baixa o relatório que existe (nomes variam por semana)."""
    import urllib.request
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Scrutiniums/energia (dados abertos)"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def _texto_pdf(vint):
    """Texto de um PDF do bronze pelo pdftotext -layout; None sem a ferramenta."""
    import shutil
    import subprocess
    import tempfile
    exe = shutil.which("pdftotext")
    if not exe:
        return None
    fd, tmp = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    try:
        with open(tmp, "wb") as f:
            f.write(_le_bronze(vint))
        out = subprocess.run([exe, "-layout", tmp, "-"], capture_output=True, timeout=120)
        return out.stdout.decode("utf-8", "replace")
    finally:
        os.remove(tmp)


def _coleta_pmo(con, hoje, st):
    """Relatórios executivos do PMO (fixos e das últimas seis semanas operativas) e a
    tabela "MLT das ENAs (MWmed)" de cada um."""
    import urllib.parse
    nomes = list(PMO_FIXOS)
    sab = hoje - timedelta(days=(hoje.weekday() - 5) % 7)
    for i in range(6):
        a = sab - timedelta(days=7 * i)
        b = a + timedelta(days=6)
        nomes += [f"RELATORIO-PMO-{a:%d_%m_%y} a {b:%d_%m_%y}.pdf", f"RELATORIO-PMO-{a:%d_%m} a {b:%d_%m}.pdf"]
    vistos = set()
    for nome_arq in nomes:
        if nome_arq in vistos:
            continue
        vistos.add(nome_arq)
        recurso = nome_arq[:-4]
        url = ACERVO + urllib.parse.quote(nome_arq)
        if not base.ultima_vintage(con, DS_PMO, recurso) and not _existe(url):
            continue
        res = _baixa_url(con, "ONS", DS_PMO, recurso, url, "pdf", 365, pausa=0.3)
        v = res.get("vintage")
        if not v or _ja_importado(con, v["vintage_id"]):
            continue
        texto = _texto_pdf(v)
        if texto is None:
            st.setdefault("pmo", []).append(f"{recurso}: pdftotext ausente, tabela não extraída")
            continue
        tab = oa.parse_mlt_pmo(texto)
        if not tab:
            st.setdefault("pmo", []).append(f"{recurso}: tabela MLT não encontrada")
            _marca_importado(con, v["vintage_id"], [], {"tabela": "não encontrada"})
            continue
        base.grava_observacoes(con, DS_PMO, v["vintage_id"], [(f"mlt_mwmed.{sm}", ref, val) for ref, sm, val in tab["valores"]])
        _marca_importado(con, v["vintage_id"], ["MLT das ENAs (MWmed)"],
                         {"pagina": str(tab["pagina"]), "edicao": json.dumps(tab["edicao"], ensure_ascii=False)})
        st.setdefault("pmo", []).append(f"{recurso}: {len(tab['valores'])} valores")
    con.commit()


def _coleta_previsao(con, pontos, celulas, st, hoje_utc=None):
    """Previsão da rodada de 00Z mais recente publicada do ECMWF IFS 0,25° (Open-Meteo,
    API de rodadas individuais) nos mesmos pontos de chuva e células de temperatura da
    estimativa observada; agrega por bacia e por subsistema e grava uma vintage por rodada
    (manifesto com a rodada e o sha256 de cada arquivo). Tenta a rodada de hoje e, se ainda
    não publicada ("modelRunUnavailable"), a de ontem. Lote com falha interrompe a rodada
    sem agregar nada (sem completar)."""
    hoje_utc = hoje_utc or datetime.now(timezone.utc).date()
    unicos = {"precip": {}, "temp": {}}
    for p in pontos:
        unicos["precip"].setdefault(p["id"], (p["lat"], p["lon"]))
    for cel in celulas:
        unicos["temp"].setdefault(cel["id"], (cel["lat"], cel["lon"]))
    for cand in (hoje_utc, hoje_utc - timedelta(days=1)):
        rodada = cand.isoformat()
        rid = f"{cand:%Y%m%d}T0000Z"
        if base.ultima_vintage(con, DS_PREV, f"previsao_{rid}"):
            st["rodada"], st["ja_agregada"] = f"{rodada}T00:00Z", True
            return
        valores, arquivos, erro = {}, [], None
        for tipo, mapa in unicos.items():
            ids = sorted(mapa)
            for i in range(0, len(ids), cl.LOTE_PREV):
                lote = ids[i:i + cl.LOTE_PREV]
                recurso = f"{rid}_{tipo}_{i // cl.LOTE_PREV:02d}"
                # idade zero: só se chega aqui com a rodada ainda não agregada, e uma resposta
                # de erro gravada antes não pode ser reaproveitada
                res = _baixa_url(con, "Open-Meteo", DS_PREV_BRUTO, recurso,
                                 cl.url_previsao(tipo, [mapa[x] for x in lote], rodada), "json", 0, pausa=1.0)
                v = res.get("vintage")
                if res["status"] == "falha" or not v or v["recurso"] != recurso:
                    erro = f"{recurso}: download: {str(res.get('detalhe'))[-160:]}"
                    break
                try:
                    series = cl.le_previsao(_le_bronze(v), len(lote))
                except ValueError as e:
                    erro = f"{recurso}: {str(e)[:200]}"
                    break
                for pid, serie in zip(lote, series):
                    valores[(tipo, pid)] = serie
                arquivos.append({"recurso": recurso, "sha256": v["sha256"], "pontos": len(lote)})
            if erro:
                break
        if erro:
            st.setdefault("tentativas", []).append(erro)
            continue
        pop_uf = {}
        for campos in _vigentes(con, DS_PONTOS_T).values():
            if campos.get("pop_uf") not in (None, "None"):
                pop_uf[campos["uf"]] = int(campos["pop_uf"])
        ag = cl.agrega_previsao(valores, pontos, celulas, pop_uf)
        d0 = cl.primeiro_dia_completo(f"{rodada}T00:00Z")
        # dias publicados: completos na rodada e com valor em todas as bacias e recortes
        cands = sorted({k for s_ in ag["bacias"].values() for k in s_} | {k for r_ in ag["recortes"].values() for k in r_["t"]})
        dias = [k for k in cands if k >= d0 and all(k in s_ for s_ in ag["bacias"].values() if s_)
                and all(k in r_["t"] and k in r_["tmax"] for r_ in ag["recortes"].values())]
        obs = []
        for b, s_ in ag["bacias"].items():
            obs += [(f"prev_mm.{b}", k, s_[k]) for k in dias if k in s_]
        for rec, r_ in ag["recortes"].items():
            obs += [(f"prev_t_c.{rec}", k, r_["t"][k]) for k in dias] + [(f"prev_tmax_c.{rec}", k, r_["tmax"][k]) for k in dias]
        manifesto = {"modelo": cl.MODELO_PREV, "rodada": {"inicializacao": f"{rodada}T00:00Z"}, "dias": dias,
                     "origem_url": cl.OPENMETEO_PREV,
                     "regra": "chuva: média ponderada pela área dos pontos da bacia (80% do peso); temperatura: células mais "
                              "populosas por UF (80% da população) e UF ponderadas pela população (90%); dias completos da "
                              "rodada com valor em todas as bacias e recortes",
                     "arquivos": arquivos}
        _grava_agregado(con, DS_PREV, f"previsao_{rid}", manifesto, obs)
        st.update({"rodada": f"{rodada}T00:00Z", "dias": len(dias), "arquivos": len(arquivos)})
        return
    st["sem_rodada"] = True


def coletar(con, ctx):
    """Coleta e importa. Nunca lança por falha de fonte: a falha fica no status e no
    registro de coletas, e a gold usa o que já está no silver."""
    hoje = ctx.get("hoje") or date.today()
    orc = float(os.environ.get("AGUA_ORCAMENTO_S", ctx.get("agua_orcamento_s", 1800)))
    prazo = time.time() + orc
    status = {"importadas": []}
    fontes = [
        ("ear_ree", DS_EAR_REE, ("CSV",), 2016),
        ("ena_ree", DS_ENA_REE, ("CSV",), 2016),
        ("ear_bacia", DS_EAR_BACIA, ("CSV",), 2000),
        ("ena_bacia", DS_ENA_BACIA, ("CSV",), 2000),
        ("ear_res", DS_EAR_RES, ("PARQUET", "CSV"), 2000),
        ("ena_res", DS_ENA_RES, ("PARQUET", "CSV"), 2000),
        ("hidro_res", DS_HIDRO, ("PARQUET", "CSV"), ANO_MIN_HIDRO),
        ("cadastro", DS_CAD, ("CSV",), 0),
        ("precip_est", DS_PRECIP_EST, ("CSV",), 2020),
        ("bacias_shp", DS_SHP, ("ZIP",), 0),
        ("ear_sm", DS_EAR_SM_CONF, ("CSV",), hoje.year - 1),
        ("ena_sm", DS_ENA_SM_CONF, ("CSV",), hoje.year - 1),
    ]
    for chave, ds, pref, ano_min in fontes:
        if time.time() > prazo:
            status["interrompido_por_prazo"] = chave
            break
        vints = _baixa_pacote_ons(con, chave, ds, hoje, pref, ano_min, status)
        for ano, v in sorted(vints, key=lambda x: x[0]):
            try:
                r = _importa_ons(con, chave, ds, ano, v)
            except Exception as e:  # arquivo fora do esquema: registrado, não vira número
                base.registra_coleta(con, ds, v["recurso"], False, f"importação: {e}")
                con.commit()
                status.setdefault("falhas_importacao", []).append(f"{v['recurso']}: {e}")
                continue
            if r:
                status["importadas"].append(r)
    # dicionários dos conjuntos por subsistema (unidade e MLT; os dados vêm do silver principal)
    for pacote in ("ena-diario-por-subsistema", "ear-diario-por-subsistema"):
        try:
            _baixa_dicionarios(con, ckan.pacote("ONS", pacote), status.setdefault("dicionarios", {"falhas": []}))
        except Exception as e:
            status.setdefault("dicionarios", {"falhas": []})["falhas"].append(f"{pacote}: {e}")
    # precipitação observada 2020 e 2021 → média mensal das estações por bacia (conferência)
    st_clima = {}
    status["clima"] = st_clima
    try:
        _coleta_pmo(con, hoje, status.setdefault("pmo", {}))
    except Exception as e:
        status.setdefault("pmo", {})["falha"] = str(e)[:200]
    try:
        _importa_precip_estacoes(con, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"precipitação por estação: {e}")
    # IBGE
    _baixa_url(con, "IBGE", DS_IBGE_LOC, "Localidades_Brasil_shp", URL_LOC, "zip", 365)
    _baixa_url(con, "IBGE", DS_IBGE_POP, "populacao_municipios_2022", URL_POP_MUN, "json", 365)
    _baixa_url(con, "IBGE", DS_IBGE_POP, "populacao_ufs_2022", URL_POP_UF, "json", 365)
    try:
        _coleta_areas(con, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"áreas de carga: {e}")
    # pontos e POWER
    try:
        pontos = _pontos_precipitacao(con, st_clima)
        celulas = _celulas_temperatura(con, st_clima)
        st_clima["pontos_precipitacao"] = len({p["id"] for p in pontos})
        st_clima["celulas_temperatura"] = len({x["id"] for x in celulas})
        st_t, st_p = {}, {}
        st_prev = {}
        try:
            _coleta_previsao(con, pontos, celulas, st_prev)
        except Exception as e:  # falha da previsão não derruba a coleta do resto
            st_prev.setdefault("falhas", []).append(str(e)[:200])
        st_clima["previsao"] = st_prev
        _coleta_power(con, celulas, "temp", DS_POWER_T, hoje, prazo, st_t)
        _coleta_power(con, pontos, "precip", DS_POWER_PR, hoje, prazo, st_p)
        st_clima["power_temperatura"], st_clima["power_precipitacao"] = st_t, st_p
        _agrega_temperatura(con, celulas, st_clima)
        _agrega_precipitacao(con, pontos, st_clima)
    except Exception as e:
        st_clima.setdefault("falhas", []).append(f"clima: {e}")
    con.commit()
    return status


def _importa_precip_estacoes(con, st):
    vshp = base.ultima_vintage(con, DS_SHP, "Bacias_Hidrograficas_SIN")
    if not vshp:
        return
    loc = cl.localizador(cl.bacias_do_zip(_le_bronze(vshp)))
    for v in ckan.vintages_vigentes(con, DS_PRECIP_EST).values():
        if _ja_importado(con, v["vintage_id"]):
            continue
        obs, resumo = oa.parse_precipitacao_estacoes(oa.linhas_bronze(v["arquivo"], "csv"), loc)
        base.grava_observacoes(con, DS_PRECIP_EST, v["vintage_id"], obs)
        _marca_importado(con, v["vintage_id"], oa.colunas_bronze(v["arquivo"], "csv"),
                         {"estacoes": str(resumo["estacoes"]), "estacoes_em_bacia": str(resumo["estacoes_em_bacia"])})
        st.setdefault("precip_estacoes", []).append({v["recurso"]: resumo})
    con.commit()


# ================================================================ construção: P017 armazenamento

FONTE_PRINCIPAL = "silver principal"
FONTE_RECAPTURA = "recaptura do módulo"


def series_mais_recentes(fontes, prefixo, nomes):
    """Séries diárias por subsistema montadas com a captura mais recente de cada ano.

    fontes: [(rótulo, conexão, dataset)]. O ONS publica um arquivo por ano
    (EAR_DIARIO_SUBSISTEMA_<ano>), e cada captura traz o ano inteiro; o silver principal e
    a recaptura deste módulo guardam capturas feitas em horários diferentes. Para cada ano
    vale a fonte cuja última vintage do arquivo daquele ano é a mais recente (empate: a
    última da lista). Assim a gold nunca mistura, para o mesmo dia, um valor já revisado
    pelo ONS (recaptura) com um anterior (silver principal), e o destaque do painel usa o
    dado mais novo que o módulo tem. Devolve ({nome: {dia: valor}}, {ano: escolha}) e,
    para conferir a revisão entre capturas, os valores de cada fonte."""
    dados = {}
    for rot, con, ds in fontes:
        if con is None:
            continue
        dados[rot] = {n: _serie(con, ds, n) for n in nomes}
    escolha = {}
    anos = sorted({k[:4] for rot in dados for n in nomes for k in dados[rot][n]})
    for ano in anos:
        cands = []
        for i, (rot, con, ds) in enumerate(fontes):
            if rot not in dados or not any(k[:4] == ano for k in dados[rot][nomes[0]]):
                continue
            v = base.ultima_vintage(con, ds, f"{prefixo}{ano}")
            cands.append(((v or {}).get("capturado_em") or "", i, rot, v))
        if cands:
            cap, _i, rot, v = max(cands)
            escolha[ano] = {"fonte": rot, "capturado_em": cap or None, "recurso": (v or {}).get("recurso"),
                            "vintage_id": (v or {}).get("vintage_id")}
    out = {n: {} for n in nomes}
    for n in nomes:
        for ano, e in escolha.items():
            out[n].update({k: x for k, x in dados[e["fonte"]][n].items() if k[:4] == ano})
    return out, escolha, dados


def _revisoes_entre_capturas(dados, nomes_sm, dias):
    """Dias em que a captura do silver principal e a recaptura diferem (revisão do ONS
    entre as capturas), por série, nos dias pedidos. Publicado para que a revisão
    conhecida fique visível, e não apenas absorvida."""
    a, b = dados.get(FONTE_PRINCIPAL), dados.get(FONTE_RECAPTURA)
    if not a or not b:
        return []
    out = []
    for sm, serie in nomes_sm:
        difs = [(k, b[serie][k] - a[serie][k]) for k in dias if k in a[serie] and k in b[serie]
                and abs(b[serie][k] - a[serie][k]) > 0.0005]
        if difs:
            k, dmax = max(difs, key=lambda x: abs(x[1]))
            out.append({"sm": sm, "serie": serie.split(".")[0], "dias_revisados": len(difs), "dia_maior": k,
                        "silver_principal": c.r(a[serie][k], 3), "recaptura": c.r(b[serie][k], 3),
                        "diferenca": c.r(dmax, 3)})
    return out


def _ear_subsistemas(con_p, con=None):
    nomes = [f"{p}.{sm}" for p in ("ear_mwmes", "ear_max_mwmes", "ear_pct") for sm in SMS]
    s, escolha, dados = series_mais_recentes(
        [(FONTE_PRINCIPAL, con_p, DS_EAR_SM), (FONTE_RECAPTURA, con, DS_EAR_SM_CONF)], "EAR_DIARIO_SUBSISTEMA_", nomes)
    mw = {sm: s[f"ear_mwmes.{sm}"] for sm in SMS}
    mx = {sm: s[f"ear_max_mwmes.{sm}"] for sm in SMS}
    pct = {sm: s[f"ear_pct.{sm}"] for sm in SMS}
    dias_ = sorted(set.intersection(*(set(mw[sm]) & set(mx[sm]) for sm in SMS)))
    mw["SIN"] = {d: sum(mw[sm][d] for sm in SMS) for d in dias_}
    mx["SIN"] = {d: sum(mx[sm][d] for sm in SMS) for d in dias_}
    pct["SIN"] = {d: 100.0 * mw["SIN"][d] / mx["SIN"][d] for d in dias_ if mx["SIN"][d] > 0}
    return mw, mx, pct, dias_, escolha, dados


def _recortes_ear(con, ds):
    """{nome: {"mw": {}, "max": {}, "pct": {}}} do conjunto por REE ou por bacia."""
    out = defaultdict(lambda: {"mw": {}, "max": {}, "pct": {}})
    for prefixo, k in (("ear_mwmes.", "mw"), ("ear_max_mwmes.", "max"), ("ear_pct.", "pct")):
        for s, vals in _series_glob(con, ds, prefixo + "*").items():
            out[s[len(prefixo):]][k] = vals
    return dict(out)


def _recortes_ena(con, ds):
    out = defaultdict(dict)
    for prefixo, k in (("ena_bruta_mwmed.", "mw"), ("ena_bruta_pct_mlt.", "pct"), ("ena_arm_mwmed.", "arm"),
                       ("ena_arm_pct_mlt.", "arm_pct")):
        for s, vals in _series_glob(con, ds, prefixo + "*").items():
            out[s[len(prefixo):]][k] = vals
    for n, d in out.items():
        d["mlt"] = {k: d["mw"][k] / (d["pct"][k] / 100.0) for k in d.get("mw", {}) if d.get("pct", {}).get(k)}
        d["mlt_arm"] = {k: d["arm"][k] / (d["arm_pct"][k] / 100.0) for k in d.get("arm", {}) if d.get("arm_pct", {}).get(k)}
    return dict(out)


def _pct_aplicavel(s, k):
    """Percentual do dia só quando a EAR máxima é positiva (zero = não se aplica)."""
    x = s["max"].get(k)
    return s["pct"].get(k) if x is not None and x > 0 else None


def _resumo_ear_recorte(nome_r, s, dia, ano_ini, extra=None):
    v = _pct_aplicavel(s, dia)
    mw = s["mw"].get(dia)
    mx = s["max"].get(dia)
    d7, d30 = _dmenos(dia, 7), _dmenos(dia, 30)
    v7, v30 = _pct_aplicavel(s, d7), _pct_aplicavel(s, d30)
    return {
        "nome": nome_r, **(extra or {}),
        "dia": dia if dia in s["mw"] else None,
        "ear_pct": c.r(v, 2), "ear_mwmes": c.r(mw, 1), "ear_max_mwmes": c.r(mx, 1),
        "sem_armazenamento": bool(mx is not None and mx == 0),
        "variacao_7d_pp": c.r(v - v7, 2) if v is not None and v7 is not None else None,
        "variacao_30d_pp": c.r(v - v30, 2) if v is not None and v30 is not None else None,
        # MWmês é estoque: zero publicado com EAR máxima zero é zero de fato
        "variacao_30d_mwmes": c.r(mw - s["mw"][d30], 1) if mw is not None and d30 in s["mw"] else None,
        **faixa_sazonal(s["pct"], s["mw"], s["max"], dia, ano_ini),
    }


PASSO_MULTIPLOS = 14


def _semanal(s, dia, ano_ini, pontos=27):
    """Pequenos múltiplos: um ponto a cada 14 dias no último ano (27 pontos, de d0 até o
    dia de referência), com a faixa da data (p10 e p90; a mediana fica no resumo do dia),
    em colunas para caber na gold. A data do ponto i é d0 + 14 × i dias. Mesmas regras da
    faixa do dia (EAR máxima zero e mínimo de anos)."""
    out = {"d0": _dmenos(dia, PASSO_MULTIPLOS * (pontos - 1)), "passo_dias": PASSO_MULTIPLOS,
           "v": [], "p10": [], "p90": []}
    for i in range(pontos - 1, -1, -1):
        d = _dmenos(dia, PASSO_MULTIPLOS * i)
        f = faixa_sazonal(s["pct"], s["mw"], s["max"], d, ano_ini)
        for k, v in (("v", c.r(_pct_aplicavel(s, d), 1)), ("p10", c.r(f["p10"], 1)), ("p90", c.r(f["p90"], 1))):
            out[k].append(v)
    return out


def _eventos_capacidade(con, con_p, mx):
    """Mudanças da EAR máxima por subsistema e atribuição a reservatórios (entrada, saída
    ou alteração da capacidade de cada um, na parte própria ou a jusante)."""
    steps = {}
    for s, vals in _series_glob(con, DS_EAR_RES, "earmax_*").items():
        steps[s] = sorted(vals.items())
    atrib = defaultdict(dict)
    pres = defaultdict(list)
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        atrib[cod][int(ano)] = campos
        if campos.get("primeiro_dia"):
            pres[cod].append((campos["primeiro_dia"], campos.get("ultimo_dia")))
    nomes = {cod: (max(a.items())[1].get("nome") or cod) for cod, a in atrib.items()}

    def valor_em(serie, d):
        """Valor vigente na data d (último degrau com ref <= d); None se não houver."""
        v = None
        for ref, x in steps.get(serie, []):
            if ref > d:
                break
            v = x
        return v

    def presente(cod, d):
        return any(p0 <= d <= (p1 or p0) for p0, p1 in pres.get(cod, []))

    def sub_de(cod, d, parte):
        a = atrib.get(cod, {}).get(int(d[:4])) or atrib.get(cod, {}).get(int(d[:4]) - 1) or {}
        return a.get("subsistema" if parte == "proprio" else "subsistema_jusante") or None

    eventos = []
    for sm in SMS:
        serie = mx[sm]
        ds_ = sorted(serie)
        for a, b in zip(ds_, ds_[1:]):
            delta = serie[b] - serie[a]
            if abs(delta) <= 0.01:
                continue
            itens = []
            for cod in atrib:
                for parte in ("proprio", "jusante"):
                    s_nome = f"earmax_{parte}.{cod}"
                    if s_nome not in steps:
                        continue
                    va = valor_em(s_nome, a) if presente(cod, a) else None
                    vb = valor_em(s_nome, b) if presente(cod, b) else None
                    sa, sb = sub_de(cod, a, parte), sub_de(cod, b, parte)
                    ca = (va or 0.0) if sa == sm else 0.0
                    cb = (vb or 0.0) if sb == sm else 0.0
                    if abs(cb - ca) > 0.001:
                        tipo = "entrada" if ca == 0 and cb != 0 else ("saida" if cb == 0 and ca != 0 else "alteracao")
                        itens.append({"cod": cod, "nome": nomes.get(cod, cod), "parte": parte, "tipo": tipo,
                                      "antes_mwmes": c.r(ca, 3), "depois_mwmes": c.r(cb, 3), "variacao_mwmes": c.r(cb - ca, 3)})
            atribuido = sum(x["variacao_mwmes"] for x in itens)
            eventos.append({"data": b, "sm": sm, "antes_mwmes": c.r(serie[a], 3), "depois_mwmes": c.r(serie[b], 3),
                            "variacao_mwmes": c.r(delta, 3), "atribuido_mwmes": c.r(atribuido, 3),
                            "residuo_mwmes": c.r(delta - atribuido, 3),
                            "reservatorios": sorted(itens, key=lambda x: -abs(x["variacao_mwmes"]))})
    return sorted(eventos, key=lambda e: (e["data"], e["sm"]))


def _armazenamento(con, con_p, d):
    mw, mx, pct, dias_, escolha, dados_cap = _ear_subsistemas(con_p, con)
    if not dias_:
        raise RuntimeError("EAR por subsistema ausente no silver principal e na recaptura")
    dia = dias_[-1]
    d["dia_ear"] = dia
    d["_captura_ear"] = escolha
    # 1) conferência: percentual publicado × recalculado (MWmês ÷ máxima) em toda a série
    dif_max, n_conf = 0.0, 0
    for sm in SMS:
        for k in dias_:
            if k in pct[sm] and mx[sm][k] > 0:
                dif_max = max(dif_max, abs(pct[sm][k] - 100.0 * mw[sm][k] / mx[sm][k]))
                n_conf += 1
    media_simples = sum(pct[sm][dia] for sm in SMS) / 4.0
    # 2) reconciliação por outros produtos do ONS no mesmo dia: REE, bacia e reservatórios
    ree = _recortes_ear(con, DS_EAR_REE)
    bac = _recortes_ear(con, DS_EAR_BACIA)
    soma_ree = sum(s["mw"].get(dia, 0.0) for s in ree.values()) if ree else None
    soma_bac = sum(s["mw"].get(dia, 0.0) for s in bac.values()) if bac else None
    n_ree_dia = sum(1 for s in ree.values() if dia in s["mw"])
    n_bac_dia = sum(1 for s in bac.values() if dia in s["mw"])
    soma_res = {sm: _serie(con, DS_EAR_RES, f"soma_ear_mwmes.{sm}") for sm in SMS}
    soma_resmax = {sm: _serie(con, DS_EAR_RES, f"soma_earmax_mwmes.{sm}") for sm in SMS}
    # a série por subsistema já é a da captura mais recente de cada ano: nos anos
    # recapturados pelo módulo (junto com os arquivos por reservatório, REE e bacia) é a
    # recaptura; nos anos encerrados, o silver principal (arquivos que quase não mudam)
    anos_conf = sorted(a for a, e in escolha.items() if e["fonte"] == FONTE_RECAPTURA)
    ref_mw = {sm: mw[sm] for sm in SMS}
    ref_mx = {sm: mx[sm] for sm in SMS}
    # precisão: até 2017 o ONS publica EAR em MWmês inteiros (por reservatório e por
    # subsistema); a soma de ~100 parcelas arredondadas tem desvio-padrão de cerca de
    # 0,29 × √100 ≈ 2,9 MWmês, daí a tolerância de 10 MWmês (≈ 3,4 desvios). Com três casas
    # decimais (desde 2018), 0,05 MWmês.
    inteiro = {}
    for sm in SMS:
        for k, v in mw[sm].items():
            inteiro.setdefault(k[:4], True)
            if abs(v - round(v)) > 1e-9:
                inteiro[k[:4]] = False
    por_ano = defaultdict(lambda: {"dias": 0, "fora": 0, "max": 0.0, "fora_max": 0, "max_max": 0.0})
    for sm in SMS:
        for k, v in soma_res[sm].items():
            if k not in ref_mw[sm]:
                continue
            tol = 10.0 if inteiro.get(k[:4]) else 0.05
            x = por_ano[(k[:4], sm)]
            x["dias"] += 1
            dif = abs(v - ref_mw[sm][k])
            x["max"] = max(x["max"], dif)
            x["fora"] += dif > tol
            if k in soma_resmax[sm] and k in ref_mx[sm]:
                dm = abs(soma_resmax[sm][k] - ref_mx[sm][k])
                x["max_max"] = max(x["max_max"], dm)
                x["fora_max"] += dm > tol
    tabela = [{"ano": int(ano), "sm": sm, "dias": x["dias"], "tolerancia_mwmes": 10.0 if inteiro.get(ano) else 0.05,
               "precisao": "inteiro" if inteiro.get(ano) else "3 casas", "fonte_subsistema": "recaptura" if ano in anos_conf else "silver principal",
               "dias_fora_ear": x["fora"], "max_dif_ear_mwmes": c.r(x["max"], 3),
               "dias_fora_ear_max": x["fora_max"], "max_dif_ear_max_mwmes": c.r(x["max_max"], 3)}
              for (ano, sm), x in sorted(por_ano.items())]
    rec_res = []
    for sm in SMS:
        rec_res.append({"sm": sm, "dia": dia, "soma_reservatorios_mwmes": c.r(soma_res[sm].get(dia), 3),
                        "subsistema_mwmes": c.r(ref_mw[sm].get(dia), 3),
                        "diferenca_mwmes": c.r(soma_res[sm][dia] - ref_mw[sm][dia], 3) if dia in soma_res[sm] and dia in ref_mw[sm] else None,
                        "soma_max_reservatorios_mwmes": c.r(soma_resmax[sm].get(dia), 3),
                        "max_subsistema_mwmes": c.r(ref_mx[sm].get(dia), 3),
                        "fonte_subsistema": "recaptura" if dia[:4] in anos_conf else "silver principal"})
    principal = dados_cap.get(FONTE_PRINCIPAL, {})
    sin_principal = (sum(principal[f"ear_mwmes.{sm}"][dia] for sm in SMS)
                     if principal and all(dia in principal.get(f"ear_mwmes.{sm}", {}) for sm in SMS) else None)
    d["_ear_ref_mw"] = ref_mw
    d["_inteiro"] = inteiro
    comparados = sum(x["dias"] for x in tabela)
    fora_tol = sum(x["dias_fora_ear"] for x in tabela)
    ult30 = [k for k in dias_ if k >= _dmenos(dia, 30)]
    d["reconciliacao_ear"] = {
        "dia": dia,
        "pct_publicado_vs_recalculado_max_pp": c.r(dif_max, 5), "pares_conferidos": n_conf,
        "soma_ree_mwmes": c.r(soma_ree, 3), "n_ree": n_ree_dia,
        "soma_bacias_mwmes": c.r(soma_bac, 3), "n_bacias": n_bac_dia,
        "sin_mwmes": c.r(mw["SIN"][dia], 3),
        # a mesma captura dos arquivos por REE, bacia e reservatório (recaptura) quando
        # ela é a mais recente; o silver principal fica ao lado só para expor a revisão
        "sin_mesma_captura_mwmes": c.r(mw["SIN"][dia], 3) if dia[:4] in anos_conf else None,
        "sin_silver_principal_mwmes": c.r(sin_principal, 3),
        "captura_por_ano": [{"ano": int(a), **e} for a, e in sorted(escolha.items()) if a >= str(int(dia[:4]) - 1)],
        "revisoes_entre_capturas_30d": _revisoes_entre_capturas(
            dados_cap, [(sm, f"ear_mwmes.{sm}") for sm in SMS], ult30),
        "reservatorios_por_subsistema": rec_res,
        "reservatorios_por_ano": [x for x in tabela if x["dias_fora_ear"] or x["dias_fora_ear_max"]],
        "anos_sem_divergencia": sorted({x["ano"] for x in tabela} - {x["ano"] for x in tabela if x["dias_fora_ear"] or x["dias_fora_ear_max"]}),
        "dias_reservatorios_comparados": comparados, "dias_reservatorios_fora_tolerancia": fora_tol,
        "media_simples_dos_percentuais": c.r(media_simples, 2),
        "diferenca_media_simples_pp": c.r(media_simples - pct["SIN"][dia], 2),
    }
    # 3) resumo por subsistema e SIN
    subs = []
    um_ano = _dmenos(dia, 365)
    for sm in TODOS:
        v, m_, x = pct[sm].get(dia), mw[sm][dia], mx[sm][dia]
        cap = d["_captura_ear"].get(dia[:4], {})
        subs.append({
            "sm": sm, "nome": c.NOME_SUBMERCADO[sm], "dia": dia,
            "natureza": "CALCULADO" if sm == "SIN" else "OBSERVADO",
            "captura": cap.get("fonte"), "capturado_em": cap.get("capturado_em"),
            "ear_pct": c.r(v, 2), "ear_mwmes": c.r(m_, 1), "ear_max_mwmes": c.r(x, 1),
            "participacao_capacidade_sin_pct": c.r(100.0 * x / mx["SIN"][dia], 1),
            "participacao_armazenado_sin_pct": c.r(100.0 * m_ / mw["SIN"][dia], 1),
            "variacao_7d_mwmes": c.r(m_ - mw[sm][_dmenos(dia, 7)], 1) if _dmenos(dia, 7) in mw[sm] else None,
            "variacao_30d_mwmes": c.r(m_ - mw[sm][_dmenos(dia, 30)], 1) if _dmenos(dia, 30) in mw[sm] else None,
            "variacao_12m_mwmes": c.r(m_ - mw[sm][um_ano], 1) if um_ano in mw[sm] else None,
            "variacao_30d_pp": c.r(v - pct[sm][_dmenos(dia, 30)], 2) if _dmenos(dia, 30) in pct[sm] else None,
            **faixa_sazonal(pct[sm], mw[sm], mx[sm], dia, ANO_INI_BACIA),
            # o último ano com a faixa da data, no mesmo passo e com as mesmas regras dos REE e
            # das bacias: a página desenha a faixa sazonal dos subsistemas a partir da mesma
            # captura dos demais números (a hidrologia.json usa só o silver principal)
            "semanal": _semanal({"pct": pct[sm], "mw": mw[sm], "max": mx[sm]}, dia, ANO_INI_BACIA),
        })
    d["_ear"] = (mw, mx, pct, dias_)
    # 4) séries: fim de mês (estoque) em MWmês desde 2000 e diária dos últimos 120 dias.
    # O ponto do mês é o último dia com dado; o mês corrente (incompleto) e qualquer mês
    # sem o último dia do calendário são listados à parte, com o dia usado.
    fim_mes = {}
    for k in dias_:
        fim_mes[k[:7]] = k
    mensal = _col([{"m": m, **{sm: c.r(mw[sm][k], 0) for sm in TODOS}, "SIN_max": c.r(mx["SIN"][k], 0)}
                   for m, k in sorted(fim_mes.items())], ("m",) + TODOS + ("SIN_max",))
    fora_fim = [{"m": m, "d": k} for m, k in sorted(fim_mes.items())
                if int(k[8:10]) != calendar.monthrange(int(k[:4]), int(k[5:7]))[1]]
    mensal["meses_sem_ultimo_dia"] = fora_fim
    mensal["mes_parcial"] = fora_fim[-1] if fora_fim and fora_fim[-1]["m"] == dia[:7] else None
    ini = _dmenos(dia, DIAS_EAR_DIARIA - 1)
    # dias consecutivos desde d0 (dia sem dado = null, nunca preenchido); o CSV
    # agua_subsistemas_diario.csv traz desde 2022
    diaria = {"d0": ini, "passo_dias": 1,
              **_col([{sm: c.r(mw[sm].get(k), 0) for sm in TODOS} for k in _dias_janela(dia, DIAS_EAR_DIARIA)], TODOS)}
    # 5) capacidade: eventos e atribuição
    eventos = _eventos_capacidade(con, con_p, mx)
    d["_eventos"] = eventos
    cap_anual = []
    for ano in range(int(dias_[0][:4]), int(dia[:4]) + 1):
        k = max((x for x in dias_ if x[:4] == str(ano)), default=None)
        if k:
            cap_anual.append({"ano": ano, "d": k, **{sm: c.r(mx[sm][k], 1) for sm in TODOS}})
    for e in eventos:
        # até 2017 os valores são inteiros (por reservatório e por subsistema): 10 MWmês; depois, 0,05
        # (o evento de 01/01/2018 compara o último dia inteiro com o primeiro decimal)
        e["tolerancia_mwmes"] = 10.0 if inteiro.get(e["data"][:4]) or inteiro.get(_dmenos(e["data"], 1)[:4]) else 0.05
        e["fechado"] = e["residuo_mwmes"] is not None and abs(e["residuo_mwmes"]) <= e["tolerancia_mwmes"]
    res_evt = [abs(e["residuo_mwmes"]) for e in eventos if e["residuo_mwmes"] is not None]
    d["armazenamento"] = {
        "dia": dia,
        "subsistemas": subs,
        "serie_mensal_mwmes": mensal,
        "serie_diaria_mwmes": diaria,
        "capacidade": {
            # antes, depois, atribuído e tolerância ficam no CSV (a tolerância segue a regra
            # do ano: 10 MWmês até 2017, 0,05 MWmês desde 2018)
            "eventos": [{**{k: v for k, v in e.items() if k not in ("reservatorios", "antes_mwmes", "depois_mwmes",
                                                                    "atribuido_mwmes", "tolerancia_mwmes")},
                         "reservatorios": [{k: x[k] for k in ("nome", "parte", "tipo", "variacao_mwmes")}
                                           for x in e["reservatorios"][:3]],
                         "n_reservatorios": len(e["reservatorios"])}
                        for e in eventos],
            "n_eventos": len(eventos),
            "eventos_fechados": sum(1 for e in eventos if e["fechado"]),
            "maior_residuo_mwmes": c.r(max(res_evt), 3) if res_evt else None,
            "fim_de_ano": cap_anual,
            "variacao_desde_inicio_mwmes": {sm: c.r(mx[sm][dia] - mx[sm][dias_[0]], 1) for sm in TODOS},
            "inicio": dias_[0],
        },
    }
    # 6) REE e bacias. REE: a configuração mudou no fim de 2017 (9 → 12 REE; SUL, PARANA e
    # NORTE perderam Iguaçu, Paranapanema e Manaus-Amapá): a base de cada REE afetado
    # começa no primeiro ano completo do perímetro atual (configuracao_ree)
    d["_ree"], d["_bac"] = ree, bac
    cfg = configuracao_ree({n_: s["max"] for n_, s in ree.items()}) if ree else None
    d["_cfg_ree"] = cfg
    ini_ree = (cfg or {}).get("ano_inicio_base", {})
    lst_ree, lst_bac = [], []
    for n_, s in sorted(ree.items()):
        a0 = ini_ree.get(n_, ANO_INI_REE)
        mudou = [q["data"] for q in (cfg or {}).get("quebras", []) if n_ in q["afetados"]]
        r_ = _resumo_ear_recorte(n_, s, dia, a0, {"base_desde": a0, "perimetro_mudou_em": mudou[-1] if mudou else None})
        # recorte sem armazenamento: pequeno múltiplo não se aplica (null, não uma linha de zeros)
        lst_ree.append({**r_, "semanal": None if r_["sem_armazenamento"] else _semanal(s, dia, a0)})
    for n_, s in sorted(bac.items()):
        r_ = _resumo_ear_recorte(n_, s, dia, ANO_INI_BACIA)
        lst_bac.append({**r_, "semanal": None if r_["sem_armazenamento"] else _semanal(s, dia, ANO_INI_BACIA)})
    d["armazenamento"]["ree"] = lst_ree
    d["armazenamento"]["bacias"] = lst_bac
    if cfg:
        d["armazenamento"]["quebras_perimetro_ree"] = cfg["quebras"]
    return d


# ================================================================ construção: P018 afluência

def _ena_subsistemas(con_p, con=None):
    out = {}
    nomes = [f"{p}.{sm}" for p in ("ena_bruta_mwmed", "ena_bruta_pct_mlt", "ena_arm_mwmed", "ena_arm_pct_mlt") for sm in SMS]
    s_, escolha, dados = series_mais_recentes(
        [(FONTE_PRINCIPAL, con_p, DS_ENA_SM), (FONTE_RECAPTURA, con, DS_ENA_SM_CONF)], "ENA_DIARIO_SUBSISTEMA_", nomes)
    for sm in SMS:
        mw = s_[f"ena_bruta_mwmed.{sm}"]
        p = s_[f"ena_bruta_pct_mlt.{sm}"]
        arm = s_[f"ena_arm_mwmed.{sm}"]
        ap = s_[f"ena_arm_pct_mlt.{sm}"]
        out[sm] = {"mw": mw, "pct": p, "arm": arm, "arm_pct": ap,
                   "mlt": {k: mw[k] / (p[k] / 100.0) for k in mw if p.get(k)},
                   "mlt_arm": {k: arm[k] / (ap[k] / 100.0) for k in arm if ap.get(k)}}
    dias_ = sorted(set.intersection(*(set(out[sm]["mw"]) & set(out[sm]["mlt"]) for sm in SMS)))
    out["SIN"] = {
        "mw": {k: sum(out[sm]["mw"][k] for sm in SMS) for k in dias_},
        "mlt": {k: sum(out[sm]["mlt"][k] for sm in SMS) for k in dias_},
        "arm": {k: sum(out[sm]["arm"][k] for sm in SMS) for k in dias_ if all(k in out[sm]["arm"] for sm in SMS)},
        "mlt_arm": {k: sum(out[sm]["mlt_arm"][k] for sm in SMS) for k in dias_ if all(k in out[sm]["mlt_arm"] for sm in SMS)},
    }
    out["SIN"]["pct"] = {k: 100.0 * out["SIN"]["mw"][k] / out["SIN"]["mlt"][k] for k in dias_ if out["SIN"]["mlt"][k]}
    return out, dias_, escolha, dados


def _ena_janela(s, fim, n=JANELA, chave_mw="mw", chave_mlt="mlt"):
    ks = _dias_janela(fim, n)
    if not all(k in s.get(chave_mw, {}) and k in s.get(chave_mlt, {}) for k in ks):
        return None, None, None
    num = sum(s[chave_mw][k] for k in ks)
    den = sum(s[chave_mlt][k] for k in ks)
    return (100.0 * num / den if den > 0 else None), num, den


def _ena_hist(s, fim, ano_ini):
    vals = []
    for a in range(ano_ini, int(fim[:4])):
        try:
            f = c.d(fim).replace(year=a)
        except ValueError:
            f = c.d(fim).replace(year=a, day=28)
        v, _n, _d = _ena_janela(s, f.isoformat())
        if v is not None:
            vals.append((a, v))
    return vals


def _resumo_ena(nome_r, s, fim, ano_ini, extra=None, minimo=MIN_ANOS_FAIXA):
    """ENA de 30 dias e posição frente à mesma janela nos anos da base. periodo_base traz
    o primeiro e o último ano realmente usados; com menos de `minimo` anos não há faixa
    nem percentil (o número de anos é publicado)."""
    v, num, den = _ena_janela(s, fim)
    va, _na, _da = _ena_janela(s, fim, chave_mw="arm", chave_mlt="mlt_arm")
    anos_hist = _ena_hist(s, fim, ano_ini) if v is not None else []
    hist = [x for _a, x in anos_hist]
    pub = len(hist) >= minimo
    return {
        "nome": nome_r, **(extra or {}), "dia": fim,
        "pct_mlt_dia": c.r(s.get("pct", {}).get(fim), 1),
        "ena_mwmed_dia": c.r(s.get("mw", {}).get(fim), 1),
        "mlt_mwmed_dia": c.r(s.get("mlt", {}).get(fim), 1),
        "pct_mlt_30d": c.r(v, 1), "ena_30d_soma_mwmed_dia": c.r(num, 1), "mlt_30d_soma_mwmed_dia": c.r(den, 1),
        "p10_30d": c.r(c.quantil(hist, 0.1), 1) if pub else None, "p50_30d": c.r(c.quantil(hist, 0.5), 1) if pub else None,
        "p90_30d": c.r(c.quantil(hist, 0.9), 1) if pub else None, "anos_na_base_30d": len(hist),
        "periodo_base": f"{anos_hist[0][0]}-{anos_hist[-1][0]}" if anos_hist else None,
        "percentil_30d": c.r(c.percentil_de(v, hist), 1) if v is not None and pub else None,
        "faixa_30d": _faixa(v, c.quantil(hist, 0.1), c.quantil(hist, 0.9)) if pub else None,
        # ENA armazenável só onde guardada (subsistemas)
        **({"pct_mlt_arm_30d": c.r(va, 1)} if s.get("arm") else {}),
    }


def _igual(a, b):
    """Mesma MLT (três casas decimais publicadas; tolerância relativa de 1e-6)."""
    return a is not None and b is not None and abs(a - b) <= 1e-6 * max(1.0, abs(b))


def _um_ano_antes(k, anos=1):
    dd = c.d(k)
    try:
        return dd.replace(year=dd.year - anos).isoformat()
    except ValueError:
        return dd.replace(year=dd.year - anos, day=28).isoformat()


def classifica_revisoes_mlt(itens_por_usina, revisoes, limiar=0.95, ampla=0.10):
    """Compara a MLT de cada revisão dentro do mês com versões anteriores, por igualdade.

    itens_por_usina: {usina: [(dia, MLT)] em degraus}; revisoes: {dia: [usinas que mudaram
    fora do dia 1º]}. Para cada revisão: quantas usinas passaram a ter a MLT vigente no
    mesmo dia do calendário 1 e 2 anos antes, e quantas tinham, na véspera, a do ano
    anterior. Classificação: "retorno_a_versao_anterior" quando ao menos `limiar` das
    usinas comparáveis voltaram aos valores de um ano anterior; "nova_versao" nos demais
    casos (valores que não estavam em vigor na mesma data de nenhum dos dois anos
    anteriores). Abrangência "ampla" com ao menos `ampla` das usinas com MLT; "pontual"
    abaixo disso. Período provisório: uma nova versão ampla desfeita por um retorno cujo
    valor de referência (mesma data um ou dois anos antes) é anterior à nova versão, sem
    outro evento amplo entre os dois, ou seja, a volta à versão que vigorava antes dela."""
    total = len(itens_por_usina) or 1
    out = []
    for dia, usinas in sorted(revisoes.items()):
        vesp = _dmenos(dia, 1)
        r = {"data": dia, "usinas": len(usinas), "abrangencia": "ampla" if len(usinas) >= ampla * total else "pontual"}
        melhor = None
        for anos in (1, 2):
            ref = _um_ano_antes(dia, anos)
            comp = [u for u in usinas if _vigente(itens_por_usina[u], ref) is not None]
            iguais = sum(1 for u in comp if _igual(_vigente(itens_por_usina[u], dia), _vigente(itens_por_usina[u], ref)))
            r[f"iguais_a_{anos}_ano{'s' if anos > 1 else ''}_antes"] = iguais
            r[f"comparaveis_{anos}_ano{'s' if anos > 1 else ''}_antes"] = len(comp)
            if comp and iguais >= limiar * len(comp) and melhor is None:
                melhor = ref
        refv = _um_ano_antes(vesp)
        compv = [u for u in usinas if _vigente(itens_por_usina[u], refv) is not None]
        r["vespera_igual_ao_ano_anterior"] = sum(
            1 for u in compv if _igual(_vigente(itens_por_usina[u], vesp), _vigente(itens_por_usina[u], refv)))
        r["vespera_comparaveis"] = len(compv)
        r["classificacao"] = "retorno_a_versao_anterior" if melhor else "nova_versao"
        r["igual_a_vigente_em"] = melhor
        out.append(r)
    amplos = [r for r in out if r["abrangencia"] == "ampla"]
    provisorios = []
    for i, r in enumerate(amplos):
        if r["classificacao"] != "retorno_a_versao_anterior":
            continue
        ant = [x for x in amplos[:i] if x["data"] > r["igual_a_vigente_em"]]
        if len(ant) == 1 and ant[0]["classificacao"] == "nova_versao":
            provisorios.append({"inicio": ant[0]["data"], "fim": _dmenos(r["data"], 1), "retorno_em": r["data"],
                                "versao_restaurada_igual_a_de": r["igual_a_vigente_em"],
                                "usinas_na_nova_versao": ant[0]["usinas"], "usinas_no_retorno": r["usinas"]})
    return out, provisorios


def _mlt(con, con_p, ena_sm, d):
    """Versão da MLT: mudanças por usina (dentro do mês = revisão da referência),
    comparação por igualdade com versões anteriores (retorno ou versão nova), comparação
    entre anos no mesmo mês com a MLT vigente no último dia do mês, e MLT implícita dos
    subsistemas."""
    steps = _series_glob(con, DS_ENA_RES, "mlt_mwmed.*")
    cad = base.registros_como_estavam_em(con, DS_CAD)
    atrib_ear = {}
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        if int(ano) >= int(atrib_ear.get(cod, ("0", {}))[0]):
            atrib_ear[cod] = (ano, campos)
    nome_de = lambda cod: (cad.get(cod, {}).get("nom_reservatorio") or (atrib_ear.get(cod, ("", {}))[1].get("nome")) or cod)  # noqa: E731
    sm_de = lambda cod: (atrib_ear.get(cod, ("", {}))[1].get("subsistema") or cad.get(cod, {}).get("id_subsistema") or "")  # noqa: E731
    mudancas = []
    por_ano_mes = defaultdict(lambda: {"mudaram": 0, "comparadas": 0})
    itens_por_usina = {}
    for s, vals in steps.items():
        cod = s.split(".", 1)[1]
        itens = sorted((k, v) for k, v in vals.items() if v is not None)
        itens_por_usina[cod] = itens
        for (ka, va), (kb, vb) in zip(itens, itens[1:]):
            if va and abs(vb - va) > 1e-6:
                tipo = "virada_de_mes" if kb[8:10] == "01" else "revisao_no_mes"
                mudancas.append({"data": kb, "cod": cod, "nome": nome_de(cod), "sm": sm_de(cod),
                                 "antes": c.r(va, 3), "depois": c.r(vb, 3),
                                 "variacao_pct": c.r(100.0 * (vb / va - 1), 3), "tipo": tipo})
        # mesmo mês do calendário em anos diferentes: MLT vigente no ÚLTIMO dia do mês (a
        # versão que ficou para o mês, depois de eventuais revisões dentro dele). O dia 15
        # pode cair numa versão provisória (ex.: 15/01/2026) e daria uma conclusão errada.
        for ano in range(2001, int(d["dia_ena"][:4]) + 1):
            for mes in (1, 7):
                ult = calendar.monthrange(ano, mes)[1]
                k = f"{ano}-{mes:02d}-{ult:02d}"
                if k > d["dia_ena"]:
                    continue
                ka = f"{ano - 1}-{mes:02d}-{calendar.monthrange(ano - 1, mes)[1]:02d}"
                va, vb = _vigente(itens, ka), _vigente(itens, k)
                if va and vb:
                    x = por_ano_mes[(ano, mes)]
                    x["comparadas"] += 1
                    if not _igual(vb, va):
                        x["mudaram"] += 1
    revisoes_no_mes = defaultdict(list)
    for m in mudancas:
        if m["tipo"] == "revisao_no_mes":
            revisoes_no_mes[m["data"]].append(m)
    classes, provisorios = classifica_revisoes_mlt(itens_por_usina, {k: [m["cod"] for m in v] for k, v in revisoes_no_mes.items()})
    classe_de = {x["data"]: x for x in classes}
    datas_rev = [{"data": k, "usinas": len(v),
                  "exemplos": [{k2: m[k2] for k2 in ("nome", "sm", "antes", "depois", "variacao_pct")}
                               for m in sorted(v, key=lambda m: -abs(m["variacao_pct"] or 0))[:2]],
                  "variacao_mediana_pct": c.r(c.quantil([m["variacao_pct"] for m in v], 0.5), 3),
                  **{k2: classe_de[k][k2] for k2 in classe_de[k] if k2 not in ("data", "usinas")}}
                 for k, v in sorted(revisoes_no_mes.items())]
    tabela_anos = [{"ano": a, "mes": mes, "usinas_comparadas": x["comparadas"], "usinas_com_mlt_diferente": x["mudaram"]}
                   for (a, mes), x in sorted(por_ano_mes.items())]
    # MLT implícita dos subsistemas no dia 15 de janeiro e julho de cada ano
    implicita = []
    for ano in range(2000, int(d["dia_ena"][:4]) + 1):
        for mes in (1, 7):
            k = f"{ano}-{mes:02d}-15"
            if all(k in ena_sm[sm]["mlt"] for sm in SMS):
                implicita.append({"ano": ano, "mes": mes, **{sm: c.r(ena_sm[sm]["mlt"][k], 1) for sm in SMS}})
    # unidade: soma das ENA por reservatório (dicionário: MWmed) × ENA do subsistema (a
    # série por subsistema já é a da captura mais recente de cada ano)
    unid = []
    for sm in SMS:
        soma = _serie(con, DS_ENA_RES, f"soma_ena_bruta_mwmed.{sm}")
        smlt = _serie(con, DS_ENA_RES, f"soma_mlt_mwmed.{sm}")
        ref_mw = ena_sm[sm]["mw"]
        ref_mlt = ena_sm[sm]["mlt"]
        difs, rel, difm = [], [], []
        for k, v in soma.items():
            e = ref_mw.get(k)
            if e:
                difs.append(abs(v - e))
                rel.append(abs(v - e) / e)
            m = ref_mlt.get(k)
            if m and smlt.get(k):
                difm.append(abs(smlt[k] - m) / m)
        dia_u = max((k for k in soma if k in ref_mw), default=d["dia_ena"])
        unid.append({"sm": sm, "dias": len(difs),
                     "dias_dentro_0_1pct": sum(1 for x in rel if x <= 0.001),
                     "mediana_dif_mwmed": c.r(c.quantil(difs, 0.5), 3), "max_dif_rel_pct": c.r(100 * max(rel), 3) if rel else None,
                     "mlt_dias": len(difm), "mlt_dias_dentro_0_1pct": sum(1 for x in difm if x <= 0.001),
                     "exemplo": {"dia": dia_u, "soma_reservatorios_mwmed": c.r(soma.get(dia_u), 3),
                                 "subsistema_mwmed": c.r(ref_mw.get(dia_u), 3),
                                 "soma_mlt_reservatorios_mwmed": c.r(smlt.get(dia_u), 3),
                                 "mlt_implicita_subsistema_mwmed": c.r(ref_mlt.get(dia_u), 3)}})
    d["_mlt_mudancas"] = mudancas
    # MLT do conjunto aberto × MLT publicada no Relatório Executivo do PMO (mesmo mês).
    # Cada mês aparece em dois relatórios ou mais (a tabela traz o mês do PMO e o seguinte);
    # cita-se o relatório do próprio mês (edição do PMO daquele mês) e listam-se todos.
    ref_mlt = {sm: ena_sm[sm]["mlt"] for sm in SMS}
    ctl = base.registros_como_estavam_em(con, DS_CONTROLE)
    pmo_todos = defaultdict(list)
    for serie, ref, valor, recurso, vid, capt in con.execute(
            """SELECT o.serie, o.ref, o.valor, v.recurso, v.vintage_id, v.capturado_em FROM observacoes o
               JOIN vintages v ON v.vintage_id=o.vintage_id WHERE o.dataset=? ORDER BY v.capturado_em, o.rowid""", (DS_PMO,)):
        pmo_todos[(ref, serie.split(".", 1)[1])].append((valor, recurso, vid, capt))
    # observações gravam só valor novo ou alterado: um relatório que repete o valor de outro
    # não gera linha; os relatórios lidos (controle) completam a lista de quem publica o mês
    lidos = {}
    for v in base.vintages_do_dataset(con, DS_PMO):
        x = ctl.get(v["vintage_id"], {})
        try:
            ed = json.loads(x.get("edicao") or "null")
        except ValueError:
            ed = None
        mm = oa.MESES_PT.get(str((ed or {}).get("mes", "")).lower())
        if mm:
            # vintage mais recente de cada relatório (ordem de captura)
            lidos[v["recurso"]] = {"vid": v["vintage_id"], "capt": v["capturado_em"], "mes": f"{ed['ano']}-{mm:02d}",
                                   "semana": ed.get("semana") or "", "pagina": x.get("pagina")}

    def fim_semana(rec):
        t = lidos[rec]["semana"].rsplit(" ", 1)[-1]          # "DD/MM/AAAA"
        p_ = t.split("/")
        return f"{p_[2]}-{p_[1]}-{p_[0]}" if len(p_) == 3 else t

    pmo = {}
    for (ref, sm), lst in pmo_todos.items():
        # relatórios que publicam este mês: os que gravaram valor e os lidos cujo mês do PMO
        # é o próprio ref ou o anterior (a tabela traz o mês do PMO e o seguinte)
        recs = {r for _v, r, _vid, _c in lst}
        recs |= {rec for rec, x in lidos.items() if x["mes"] == ref or _mes_seguinte(x["mes"]) == ref}
        proprio = sorted((rec for rec in recs if rec in lidos and lidos[rec]["mes"] == ref), key=fim_semana)
        citado = proprio[-1] if proprio else lst[-1][1]
        if citado in lidos:
            # valor publicado no relatório citado: o último gravado até a captura dele (as
            # observações só guardam valor novo ou alterado, na ordem de captura)
            ant = [v_ for v_, _r, _vid, capt in lst if capt <= lidos[citado]["capt"]]
            valor = ant[-1] if ant else lst[-1][0]
            vid_c = lidos[citado]["vid"]
        else:
            valor, vid_c = lst[-1][0], lst[-1][2]
        pmo[(ref, sm)] = (valor, citado, vid_c, bool(proprio), sorted(recs),
                          len({round(v_, 3) for v_, *_r in lst}) == 1)
    comp_pmo = []
    for (ref, sm), (val, rec, vid, do_mes, todos, iguais) in sorted(pmo.items()):
        n = calendar.monthrange(int(ref[:4]), int(ref[5:7]))[1]
        ks = [f"{ref}-{i:02d}" for i in range(1, n + 1) if f"{ref}-{i:02d}" in ref_mlt[sm]]
        base_c = {"mes": ref, "sm": sm, "pmo_mwmed": val, "relatorio": rec, "relatorio_do_proprio_mes": do_mes,
                  "relatorios_com_o_mes": todos, "valores_iguais_entre_relatorios": iguais, "dias_no_conjunto": len(ks)}
        if not ks:
            comp_pmo.append({**base_c, "aberto_inicio_mwmed": None, "aberto_fim_mwmed": None, "dif_inicio_pct": None,
                             "dif_fim_pct": None})
            continue
        a, b = ref_mlt[sm][ks[0]], ref_mlt[sm][ks[-1]]
        comp_pmo.append({**base_c, "aberto_inicio_mwmed": c.r(a, 1), "aberto_fim_mwmed": c.r(b, 1),
                         "dif_inicio_pct": c.r(100.0 * (a / val - 1), 3), "dif_fim_pct": c.r(100.0 * (b / val - 1), 3)})
    d["_pmo_mlt"] = (comp_pmo, pmo)
    # tolerância: o PMO publica MWmed inteiros e o conjunto, % da MLT com 4 casas; a MLT
    # implícita reproduz o valor do PMO com erro de arredondamento abaixo de 0,05%
    TOL_PMO = 0.05
    meses_ok = sorted({x["mes"] for x in comp_pmo if x["dif_inicio_pct"] is not None}
                      - {x["mes"] for x in comp_pmo if x["dif_inicio_pct"] is None or abs(x["dif_inicio_pct"]) > TOL_PMO
                         or abs(x["dif_fim_pct"]) > TOL_PMO})
    meses_div = sorted({x["mes"] for x in comp_pmo if x["dif_inicio_pct"] is not None and
                        (abs(x["dif_inicio_pct"]) > TOL_PMO or abs(x["dif_fim_pct"]) > TOL_PMO)})
    # dias em que os quatro subsistemas coincidem com o PMO (dentro da tolerância), em intervalos
    dias_ok = []
    for ref in sorted({k[0] for k in pmo}):
        n = calendar.monthrange(int(ref[:4]), int(ref[5:7]))[1]
        for i in range(1, n + 1):
            k = f"{ref}-{i:02d}"
            if all((ref, sm) in pmo and k in ref_mlt[sm] and abs(100.0 * (ref_mlt[sm][k] / pmo[(ref, sm)][0] - 1)) <= TOL_PMO
                   for sm in SMS):
                dias_ok.append(k)
    intervalos = []
    for k in dias_ok:
        if intervalos and _dmenos(k, 1) == intervalos[-1][1]:
            intervalos[-1][1] = k
        else:
            intervalos.append([k, k])
    # versão do conjunto aberto no ano corrente: MLT vigente no último dia de cada mês já
    # encerrado, comparada por igualdade com a do mesmo mês do ano anterior, por usina
    ano_c = int(d["dia_ena"][:4])
    mesmo_do_ano_anterior = []
    for mes in range(1, 13):
        k = f"{ano_c}-{mes:02d}-{calendar.monthrange(ano_c, mes)[1]:02d}"
        if k > d["dia_ena"]:
            break
        ka = f"{ano_c - 1}-{mes:02d}-{calendar.monthrange(ano_c - 1, mes)[1]:02d}"
        comp = [u for u, it in itens_por_usina.items() if _vigente(it, ka) and _vigente(it, k)]
        mesmo_do_ano_anterior.append({"mes": f"{ano_c}-{mes:02d}", "usinas_comparadas": len(comp),
                                      "usinas_iguais": sum(1 for u in comp if _igual(_vigente(itens_por_usina[u], k),
                                                                                       _vigente(itens_por_usina[u], ka)))})
    rel_mes = {}
    for x in comp_pmo:
        rel_mes.setdefault(x["mes"], {"relatorios": x["relatorios_com_o_mes"], "valores_iguais": True})
        rel_mes[x["mes"]]["valores_iguais"] &= x["valores_iguais_entre_relatorios"]
    return {"pmo": {"comparacao": [{k: v for k, v in x.items() if k not in ("relatorios_com_o_mes", "valores_iguais_entre_relatorios")}
                                   for x in comp_pmo if x["dias_no_conjunto"]],
                    "relatorios_por_mes": [{"mes": m_, **v} for m_, v in sorted(rel_mes.items())],
                    "tolerancia_pct": TOL_PMO, "meses_coincidentes": meses_ok,
                    "dias_coincidentes": [{"inicio": a, "fim": b} for a, b in intervalos],
                    "meses_divergentes": meses_div,
                    "maior_diferenca_pct": c.r(max((abs(x["dif_fim_pct"]) for x in comp_pmo if x["dif_fim_pct"] is not None), default=None), 3),
                    "relatorios": sorted({r for x in comp_pmo for r in x["relatorios_com_o_mes"]})},
            "revisoes_no_mes": datas_rev, "periodos_provisorios": provisorios,
            "ano_corrente_igual_ao_anterior": mesmo_do_ano_anterior,
            "anos": _col(tabela_anos, ("ano", "mes", "usinas_comparadas", "usinas_com_mlt_diferente")),
            "anos_regra": "MLT vigente no último dia do mês (janeiro e julho) comparada por igualdade com a do mesmo mês do ano anterior",
            "implicita_subsistemas": _col(implicita, ("ano", "mes") + SMS),
            "n_mudancas_virada_de_mes": sum(1 for m in mudancas if m["tipo"] == "virada_de_mes"),
            "n_mudancas_no_mes": sum(1 for m in mudancas if m["tipo"] == "revisao_no_mes"),
            "usinas_com_mlt": len(steps), "unidade": unid}


def _vigente(itens, d):
    v = None
    for k, x in itens:
        if k > d:
            break
        v = x
    return v


def _afluencia(con, con_p, d):
    ena_sm, dias_, escolha, dados_cap = _ena_subsistemas(con_p, con)
    if not dias_:
        raise RuntimeError("ENA por subsistema ausente no silver principal e na recaptura")
    fim = dias_[-1]
    d["dia_ena"] = fim
    d["_ena_sm"] = ena_sm
    d["_captura_ena"] = escolha
    subs = [{"sm": sm, **_resumo_ena(c.NOME_SUBMERCADO[sm], ena_sm[sm], fim, ANO_INI_BACIA),
             "natureza": "CALCULADO"} for sm in TODOS]
    # média simples dos percentuais diários (o que NÃO se publica) para o teste de contraste
    ks = _dias_janela(fim)
    d["_ena_media_simples_sin"] = sum(ena_sm["SIN"]["pct"][k] for k in ks) / len(ks)
    ree = _recortes_ena(con, DS_ENA_REE)
    bac = _recortes_ena(con, DS_ENA_BACIA)
    d["_ena_ree"], d["_ena_bac"] = ree, bac
    fim_ree = max((max(s["mw"]) for s in ree.values() if s.get("mw")), default=None)
    fim_bac = max((max(s["mw"]) for s in bac.values() if s.get("mw")), default=None)
    # mesma base por REE da EAR: os REE afetados pela reconfiguração do fim de 2017 só
    # entram na base desde o primeiro ano completo do perímetro atual
    ini_ree = (d.get("_cfg_ree") or {}).get("ano_inicio_base", {})
    # no arquivo de ENA não há capacidade: confere-se só que os REE novos aparecem no mesmo dia
    prim_ena = {}
    for n_, s in ree.items():
        if s.get("mw"):
            prim_ena[n_] = min(s["mw"])
    ini_ena = min(prim_ena.values()) if prim_ena else None
    cfg_ena = [{"data": k, "novos": sorted(n_ for n_, x in prim_ena.items() if x == k)}
               for k in sorted({x for x in prim_ena.values() if x > ini_ena})] if prim_ena else []
    lst_ree = [_resumo_ena(n_, s, fim_ree, ini_ree.get(n_, ANO_INI_REE)) for n_, s in sorted(ree.items())] if fim_ree else []
    d["_cfg_ena_ree"] = cfg_ena
    lst_bac = [_resumo_ena(n_, s, fim_bac, ANO_INI_BACIA) for n_, s in sorted(bac.items())] if fim_bac else []
    # conferência: soma das bacias × soma dos subsistemas (ENA bruta, mesmo dia)
    conf = None
    if fim_bac:
        sb = sum(s["mw"].get(fim_bac, 0.0) for s in bac.values())
        # SIN da captura mais recente (a recaptura, feita junto com os arquivos por bacia)
        ss = ena_sm["SIN"]["mw"].get(fim_bac)
        conf = {"dia": fim_bac, "soma_bacias_mwmed": c.r(sb, 3), "sin_mwmed": c.r(ss, 3),
                "diferenca_mwmed": c.r(sb - ss, 3) if ss is not None else None,
                "captura_sin": (escolha.get(fim_bac[:4]) or {}).get("fonte")}
    # série de 30 dias (% MLT, razão de somas) dos últimos 18 meses, a cada 7 dias
    serie = []
    for i in range(77, -1, -1):
        k = _dmenos(fim, 7 * i)
        serie.append({sm: c.r(_ena_janela(ena_sm[sm], k)[0], 1) for sm in TODOS})
    # o ponto i é o fim da janela d0 + 7 × i dias
    serie = {"d0": _dmenos(fim, 7 * 77), "passo_dias": 7, **_col(serie, TODOS)}
    ult30 = [k for k in dias_ if k >= _dmenos(fim, 30)]
    d["afluencia"] = {
        "dia": fim, "subsistemas": subs, "ree": lst_ree, "bacias": lst_bac, "dia_ree": fim_ree, "dia_bacias": fim_bac,
        "captura_por_ano": [{"ano": int(a), **e} for a, e in sorted(escolha.items()) if a >= str(int(fim[:4]) - 1)],
        "revisoes_entre_capturas_30d": _revisoes_entre_capturas(
            dados_cap, [(sm, f"ena_bruta_mwmed.{sm}") for sm in SMS], ult30),
        "ree_novos_por_data": cfg_ena,
        "serie_30d_semanal": serie, "conferencia_bacias_sin": conf,
        "mlt": _mlt(con, con_p, ena_sm, d),
    }
    return d


# ================================================================ construção: P019 clima

def _periodo_meses(p):
    """{"inicio": "2020-01", "fim": "2021-12"} → "jan/2020 a dez/2021" (texto da página e da ficha)."""
    return c.mes_br(p["inicio"]) if p["inicio"] == p["fim"] else f"{c.mes_br(p['inicio'])} a {c.mes_br(p['fim'])}"


def _mensal_de_diario(serie, soma=True):
    """{AAAA-MM: valor} só para meses completos (todos os dias com dado)."""
    por = defaultdict(list)
    for k, v in serie.items():
        por[k[:7]].append(v)
    out = {}
    for m, vs in por.items():
        n = calendar.monthrange(int(m[:4]), int(m[5:7]))[1]
        if len(vs) == n:
            out[m] = sum(vs) if soma else sum(vs) / n
    return out


def _clima(con, d):
    pr = _series_glob(con, DS_CLIMA_PR, "precip_mm.*")
    cob = _series_glob(con, DS_CLIMA_PR, "cobertura_pct.*")
    t = _series_glob(con, DS_CLIMA_T, "t2m*")
    if not pr and not t:
        raise RuntimeError("clima ausente no silver (coleta do POWER ainda não concluída)")
    hoje = c.agora_date()
    corte_final = (hoje - timedelta(days=110)).isoformat()   # IMERG Final: ~3,5 meses de atraso
    corte_merra = (hoje - timedelta(days=60)).isoformat()    # MERRA-2: cerca de um mês; margem de 60 dias
    a0, a1 = BASE_CLIMA
    bacias = []
    mensal_csv = []
    ena_bac = d.get("_ena_bac", {})
    for s_nome, serie in sorted(pr.items()):
        b = s_nome.split(".", 1)[1]
        mens = _mensal_de_diario(serie)
        clim = defaultdict(list)
        for m, v in mens.items():
            if a0 <= int(m[:4]) <= a1:
                clim[m[5:7]].append(v)
        meses = sorted(mens)
        # último mês completo
        ult = meses[-1] if meses else None
        linhas = []
        for m in meses:
            cm = clim.get(m[5:7], [])
            media = sum(cm) / len(cm) if cm else None
            pre = 1 if f"{m}-{calendar.monthrange(int(m[:4]), int(m[5:7]))[1]:02d}" > corte_final else 0
            mensal_csv.append([m, b, mens[m], media, c.quantil(cm, 0.1), c.quantil(cm, 0.9), len(cm),
                               100.0 * (mens[m] / media - 1) if media else None, pre])
            linhas.append({"m": m, "mm": c.r(mens[m], 1), "media": c.r(media, 1), "p10": c.r(c.quantil(cm, 0.1), 1),
                           "p90": c.r(c.quantil(cm, 0.9), 1), "anomalia_pct": c.r(100.0 * (mens[m] / media - 1), 1) if media else None,
                           "preliminar": bool(pre)})
        # últimos 30 dias com dado × mesma janela nos anos da base
        fim = max(serie)
        ks = _dias_janela(fim)
        tot = sum(serie[k] for k in ks) if all(k in serie for k in ks) else None
        hist = []
        for a in range(a0, a1 + 1):
            try:
                f = c.d(fim).replace(year=a)
            except ValueError:
                f = c.d(fim).replace(year=a, day=28)
            kk = _dias_janela(f.isoformat())
            if all(k in serie for k in kk):
                hist.append(sum(serie[k] for k in kk))
        # associação mensal chuva × ENA da bacia (razão de somas no mês), 2001 a 2025
        assoc = None
        e = ena_bac.get(b)
        if e and e.get("mw"):
            ena_m = {}
            por = defaultdict(lambda: [0.0, 0.0, 0])
            for k, v in e["mw"].items():
                if k in e["mlt"]:
                    x = por[k[:7]]
                    x[0] += v
                    x[1] += e["mlt"][k]
                    x[2] += 1
            for m, (nn, dd, n) in por.items():
                if n == calendar.monthrange(int(m[:4]), int(m[5:7]))[1] and dd > 0:
                    ena_m[m] = 100.0 * nn / dd
            ms = [m for m in meses if a0 <= int(m[:4]) <= a1]
            anom = {m: 100.0 * (mens[m] / (sum(clim[m[5:7]]) / len(clim[m[5:7]])) - 1) for m in ms if clim.get(m[5:7])}
            r0, n0 = _pearson([anom.get(m) for m in ms], [ena_m.get(m) for m in ms])
            prox = {m: _mes_seguinte(m) for m in ms}
            r1, n1 = _pearson([anom.get(m) for m in ms], [ena_m.get(prox[m]) for m in ms])
            assoc = {"r_mesmo_mes": c.r(r0, 2), "n_mesmo_mes": n0, "r_mes_seguinte": c.r(r1, 2), "n_mes_seguinte": n1,
                     "periodo": f"{a0}-{a1}"}
        bacias.append({
            "bacia": b, "dia": fim, "ultimo_mes_completo": ult,
            "mm_30d": c.r(tot, 1), "media_30d_base": c.r(sum(hist) / len(hist), 1) if hist else None,
            "p10_30d": c.r(c.quantil(hist, 0.1), 1), "p90_30d": c.r(c.quantil(hist, 0.9), 1), "anos_base_30d": len(hist),
            "anomalia_30d_pct": c.r(100.0 * (tot / (sum(hist) / len(hist)) - 1), 1) if tot is not None and hist and sum(hist) > 0 else None,
            "percentil_30d": c.r(c.percentil_de(tot, hist), 1) if tot is not None and hist else None,
            "preliminar_30d": fim > corte_final,
            # cobertura só é guardada quando incompleta: dia sem linha = 100% do peso com dado
            "cobertura_media_pct": c.r(c.media([cob.get(f"cobertura_pct.{b}", {}).get(k, 100.0) for k in ks if k in serie]), 1),
            # meses com dias IMERG Late (preliminares): de preliminar_desde em diante
            "mensal": {**_col(linhas[-12:], ("m", "mm", "media", "p10", "p90", "anomalia_pct")),
                       "preliminar_desde": next((x["m"] for x in linhas[-12:] if x["preliminar"]), None)},
            "associacao_ena": assoc,
        })
    d["_precip"] = pr
    # temperatura
    temp = []
    t2m = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_c.")}
    tmax = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_max_c.")}
    tmin = {k.split(".", 1)[1]: v for k, v in t.items() if k.startswith("t2m_min_c.")}
    for rec in TODOS:
        s = t2m.get(rec)
        if not s:
            continue
        fim = max(s)
        ks = _dias_janela(fim)
        m30 = sum(s[k] for k in ks) / len(ks) if all(k in s for k in ks) else None
        hist = []
        for a in range(a0, a1 + 1):
            try:
                f = c.d(fim).replace(year=a)
            except ValueError:
                f = c.d(fim).replace(year=a, day=28)
            kk = _dias_janela(f.isoformat())
            if all(k in s for k in kk):
                hist.append(sum(s[k] for k in kk) / len(kk))
        mens = _mensal_de_diario(s, soma=False)
        clim = defaultdict(list)
        for m, v in mens.items():
            if a0 <= int(m[:4]) <= a1:
                clim[m[5:7]].append(v)
        ms = sorted(mens)[-24:]
        ini = _dmenos(fim, DIAS_TEMP_DIARIA - 1)
        diaria = []
        for k in _dias_janela(fim, DIAS_TEMP_DIARIA):   # dias consecutivos desde d0; dia sem dado = null
            vs = [s.get(f"{a}-{_md(k)}") for a in range(a0, a1 + 1)]
            vs = [v for v in vs if v is not None]
            diaria.append({"d": k, "t": c.r(s.get(k), 1), "tmax": c.r(tmax.get(rec, {}).get(k), 1),
                           "tmin": c.r(tmin.get(rec, {}).get(k), 1), "p10": c.r(c.quantil(vs, 0.1), 1),
                           "p50": c.r(c.quantil(vs, 0.5), 1), "p90": c.r(c.quantil(vs, 0.9), 1)})
        temp.append({
            "recorte": rec, "nome": c.NOME_SUBMERCADO[rec], "dia": fim,
            "media_30d_c": c.r(m30, 2), "media_30d_base_c": c.r(sum(hist) / len(hist), 2) if hist else None,
            "anomalia_30d_c": c.r(m30 - sum(hist) / len(hist), 2) if m30 is not None and hist else None,
            "p10_30d_c": c.r(c.quantil(hist, 0.1), 2), "p90_30d_c": c.r(c.quantil(hist, 0.9), 2), "anos_base": len(hist),
            "percentil_30d": c.r(c.percentil_de(m30, hist), 1) if m30 is not None and hist else None,
            "preliminar_30d": fim > corte_merra,
            "mensal": _col([{"m": m, "t": c.r(mens[m], 2),
                             "media": c.r(sum(clim[m[5:7]]) / len(clim[m[5:7]]), 2) if clim.get(m[5:7]) else None,
                             "anomalia_c": c.r(mens[m] - sum(clim[m[5:7]]) / len(clim[m[5:7]]), 2) if clim.get(m[5:7]) else None}
                            for m in ms], ("m", "t", "media", "anomalia_c")),
            "diaria": {"d0": ini, "passo_dias": 1, **_col(diaria, ("t", "tmax", "p10", "p90"))},
        })
    d["_temp"] = (t2m, tmax, tmin)
    d["_corte_final"], d["_corte_merra"] = corte_final, corte_merra
    d["_mensal_precip_csv"] = mensal_csv
    # validação: IMERG × estações (2020 e 2021)
    val = []
    est = _series_glob(con, DS_PRECIP_EST, "precip_estacoes_mm_mes.*")
    nest = _series_glob(con, DS_PRECIP_EST, "n_estacoes.*")
    todas_x, todas_y = [], []
    meses_val = set()   # meses realmente comparados: o período da conferência sai dos dados, não do texto
    for s_nome, vals in sorted(est.items()):
        b = s_nome.split(".", 1)[1]
        mens = _mensal_de_diario(pr.get(f"precip_mm.{b}", {}))
        pares = [(mens[m], v, nest.get(f"n_estacoes.{b}", {}).get(m)) for m, v in sorted(vals.items()) if m in mens]
        if not pares:
            continue
        meses_val.update(m for m in vals if m in mens)
        xs, ys = [p[0] for p in pares], [p[1] for p in pares]
        todas_x += xs
        todas_y += ys
        r_, n_ = _pearson(xs, ys)
        val.append({"bacia": b, "meses": len(pares), "estacoes_mediana": c.r(c.quantil([p[2] for p in pares if p[2]], 0.5), 0),
                    "imerg_mm": c.r(sum(xs), 1), "estacoes_mm": c.r(sum(ys), 1),
                    "vies_pct": c.r(100.0 * (sum(xs) / sum(ys) - 1), 1) if sum(ys) > 0 else None,
                    "correlacao": c.r(r_, 2)})
    rg, ng = _pearson(todas_x, todas_y)
    d["_validacao"] = {"bacias": val, "correlacao_geral": c.r(rg, 2), "pares": ng,
                       "vies_geral_pct": c.r(100.0 * (sum(todas_x) / sum(todas_y) - 1), 1) if todas_y and sum(todas_y) > 0 else None,
                       # primeiro e último mês comparados (AAAA-MM); a página e a ficha citam este período
                       "periodo": {"inicio": min(meses_val), "fim": max(meses_val)} if meses_val else None}
    # cobertura espacial
    pts = _vigentes(con, DS_PONTOS_PR)
    por_b = defaultdict(lambda: {"pontos": 0, "passos": set(), "poligonos": set(), "peso": 0.0})
    for ch, campos in pts.items():
        b = campos.get("bacia")
        if not b:
            continue
        x = por_b[b]
        x["pontos"] += 1
        x["passos"].add(float(campos["passo"]))
        x["poligonos"].add(ch.split("|")[0])
        x["peso"] += float(campos["peso"])
    cels = _vigentes(con, DS_PONTOS_T)
    por_uf = defaultdict(lambda: {"celulas": 0, "pop": 0, "pop_uf": None, "cobertura": None, "sm": None})
    for ch, campos in cels.items():
        x = por_uf[campos["uf"]]
        x["celulas"] += 1
        x["pop"] += int(campos["pop"])
        x["pop_uf"] = int(campos["pop_uf"]) if campos.get("pop_uf") not in (None, "None") else None
        x["cobertura"] = float(campos["cobertura_uf"])
        x["sm"] = campos.get("subsistema")
    d["_pontos"] = (pts, cels)
    d["dias_ref_pr"] = max((max(v) for v in pr.values() if v), default=None)
    d["dias_ref_t"] = max((max(v) for k, v in t.items() if v and k.startswith("t2m_c.")), default=None)
    d["clima"] = {
        "precipitacao_bacias": bacias,
        "temperatura": temp,
        "validacao_estacoes": d["_validacao"],
        "cobertura_precipitacao": [{"bacia": b, "pontos": x["pontos"], "passos_grau": sorted(x["passos"]),
                                    "poligonos": sorted(x["poligonos"])} for b, x in sorted(por_b.items())],
        "cobertura_temperatura": [{"uf": uf, "subsistema": x["sm"], "celulas": x["celulas"], "populacao_uf": x["pop_uf"],
                                   "populacao_nas_celulas": x["pop"], "cobertura_pct": c.r(100 * x["cobertura"], 1)}
                                  for uf, x in sorted(por_uf.items())],
        "totais": {"pontos_precipitacao": len({v["ponto"] for v in pts.values()}), "celulas_temperatura": len({v["celula"] for v in cels.values()})},
        "corte_imerg_final": corte_final, "corte_merra2": corte_merra,
        "base_climatologica": f"{a0}-{a1}",
        "separacao": {
            "observacao": "Precipitação medida em estações (ONS"
                          + (f", {_periodo_meses(d['_validacao']['periodo'])}" if d["_validacao"]["periodo"] else ", sem mês comparado nesta execução")
                          + ") usada só para conferir a estimativa por satélite.",
            "estimativa": "Precipitação IMERG (satélite calibrado por pluviômetros; versão Late nos últimos meses, sem calibração) e temperatura MERRA-2/GEOS-IT (reanálise).",
            "previsao": "Previsão do modelo ECMWF IFS 0,25° (rodada identificada pela inicialização), nos mesmos pontos e com as mesmas regras de agregação; substituída a cada rodada.",
            "cenario": "Não integrado: nenhum cenário climático (projeção de longo prazo) é publicado nesta página.",
        },
    }
    prev, motivo = _previsao(con, d)
    d["clima"]["previsao"] = prev
    if motivo:
        d.setdefault("_pendencias_clima", []).append(f"previsão: {motivo}")
    return d


def _clim_mesmos_dias(serie, dias, a0, a1, soma=True):
    """Média, nos anos a0..a1, da soma (chuva) ou da média (temperatura) da série nos
    mesmos dias do calendário de `dias`; só anos com todos os dias. Devolve (valor, anos)."""
    vals = []
    for a in range(a0, a1 + 1):
        ks = [f"{a}-{_md(k)}" for k in dias]
        if all(k in serie for k in ks):
            v = sum(serie[k] for k in ks)
            vals.append(v if soma else v / len(ks))
    return (sum(vals) / len(vals) if vals else None), len(vals)


def _previsao(con, d):
    """Previsão da rodada mais recente (silver DS_PREV), rotulada PREVISTO, com a emissão
    (inicialização do modelo), a disponibilidade e a captura. Ao lado, a média
    climatológica 2001 a 2025 dos mesmos dias do calendário pela estimativa observada
    (IMERG e MERRA-2): produtos diferentes, a comparação é de ordem de grandeza."""
    vs = sorted(base.vintages_do_dataset(con, DS_PREV), key=lambda v: v["capturado_em"])
    if not vs:
        return None, "previsão ainda não coletada"
    v = vs[-1]
    with base.abre_bronze(v["arquivo"]) as f:
        man = json.loads(f.read().decode("utf-8"))
    rod = man["rodada"]
    emit = datetime.strptime(rod["inicializacao"], "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
    idade_h = (datetime.now(timezone.utc) - emit).total_seconds() / 3600.0
    if idade_h > IDADE_MAX_PREVISAO_H:
        return None, f"previsão mais recente emitida em {rod['inicializacao']} ({idade_h:.0f} h): desatualizada, não publicada"
    dias = man["dias"]
    if not dias:
        return None, "rodada sem dias completos"
    prev = _series_glob(con, DS_PREV, "prev_*", desde=dias[0])
    a0, a1 = BASE_CLIMA
    pr = d.get("_precip", {})
    t2m = (d.get("_temp") or ({}, {}, {}))[0]
    bac = []
    for s_nome in sorted(k for k in prev if k.startswith("prev_mm.")):
        b = s_nome.split(".", 1)[1]
        mm = [prev[s_nome].get(k) for k in dias]
        c7, n7 = _clim_mesmos_dias(pr.get(f"precip_mm.{b}", {}), dias[:7], a0, a1)
        ct, nt = _clim_mesmos_dias(pr.get(f"precip_mm.{b}", {}), dias, a0, a1)
        bac.append({"bacia": b, "mm": [c.r(x, 1) for x in mm],
                    "mm_7d": c.r(sum(mm[:7]), 1) if len(mm) >= 7 and None not in mm[:7] else None,
                    "mm_total": c.r(sum(mm), 1) if None not in mm else None,
                    "imerg_media_7d_mm": c.r(c7, 1), "imerg_media_total_mm": c.r(ct, 1), "anos_climatologia": nt})
    temp = []
    for rec in TODOS:
        t = [prev.get(f"prev_t_c.{rec}", {}).get(k) for k in dias]
        tx = [prev.get(f"prev_tmax_c.{rec}", {}).get(k) for k in dias]
        if all(x is None for x in t):
            continue
        c7, n7 = _clim_mesmos_dias(t2m.get(rec, {}), dias[:7], a0, a1, soma=False)
        temp.append({"recorte": rec, "t": [c.r(x, 1) for x in t], "tmax": [c.r(x, 1) for x in tx],
                     "t_media_7d_c": c.r(sum(t[:7]) / 7, 2) if len(t) >= 7 and None not in t[:7] else None,
                     "merra2_media_7d_c": c.r(c7, 2), "anos_climatologia": n7})
    d["_previsao"] = {"emitida_em": rod["inicializacao"], "dias": dias, "bacias": bac, "temperatura": temp}
    return {
        "natureza": "PREVISTO", "modelo": "ECMWF IFS 0,25° (dados abertos do ECMWF), rodada de 00Z pela API de rodadas individuais do Open-Meteo",
        "emitida_em": rod["inicializacao"],
        "capturada_em": v["capturado_em"], "idade_horas": c.r(idade_h, 1),
        "d0": dias[0], "n_dias": len(dias), "dia_utc": True,
        "bacias": bac, "temperatura": temp,
        "comparabilidade": (f"A climatologia ao lado ({BASE_CLIMA_TXT}, mesmos dias do calendário) vem da estimativa por satélite "
                            "(IMERG) e da reanálise (MERRA-2), não do modelo de previsão: a diferença indica ordem de grandeza, "
                            "não uma anomalia homogênea. Temperatura prevista é média do dia UTC; a observada, do dia em hora "
                            "solar local."),
    }, None


def _mes_seguinte(m):
    a, mm = int(m[:4]), int(m[5:7])
    return f"{a + (mm == 12)}-{(mm % 12) + 1:02d}"


# ================================================================ construção: P020 reservatórios e balanço

# Convenção da defluência: nos dias com outras estruturas acima de 1 m³/s, a defluência
# publicada é igual a turbinada + vertida (as outras estruturas ficam fora dela) ou a
# turbinada + vertida + outras. As vazões têm duas casas decimais: 0,05 m³/s cobre a soma
# de três arredondamentos. A convenção varia por reservatório (conferido nos dados de
# 2025 e 2026: Marimbondo, Furnas e Simplício publicam sem as outras estruturas; Jirau,
# Santo Antônio e Pimental, com elas) e não está no dicionário.
TOL_DEFL_M3S = 0.05
LIMIAR_OUTRAS_M3S = 1.0
LIMIAR_CONVENCAO = 0.95


def convencao_defluencia(x):
    """Convenção da defluência de um reservatório, detectada nos dados (todos os dias).

    Devolve {"convencao", "dias_avaliados", "dias_sem_outras", "dias_com_outras",
    "dias_nenhuma"}: "inclui_outras" (defluência = turbinada + vertida + outras),
    "exclui_outras" (defluência = turbinada + vertida), "sem_outras_estruturas" (nenhum
    dia com outras acima de 1 m³/s) ou "indeterminada" (nenhuma das duas em ao menos 95%
    dos dias avaliados)."""
    o, d_, t, v = (x.get(k, {}) for k in ("q_outras", "q_defluente", "q_turbinada", "q_vertida"))
    a = b = nen = 0
    for k, ov in o.items():
        if ov is None or ov <= LIMIAR_OUTRAS_M3S or any(k not in s_ or s_[k] is None for s_ in (d_, t, v)):
            continue
        ea = abs(d_[k] - (t[k] + v[k]))
        eb = abs(d_[k] - (t[k] + v[k] + ov))
        if ea <= TOL_DEFL_M3S:
            a += 1
        elif eb <= TOL_DEFL_M3S:
            b += 1
        else:
            nen += 1
    n = a + b + nen
    if n == 0:
        conv = "sem_outras_estruturas"
    elif b >= LIMIAR_CONVENCAO * n:
        conv = "inclui_outras"
    elif a >= LIMIAR_CONVENCAO * n:
        conv = "exclui_outras"
    else:
        conv = "indeterminada"
    return {"convencao": conv, "dias_avaliados": n, "dias_sem_outras": a, "dias_com_outras": b, "dias_nenhuma": nen}


def balanco_reservatorio(x, vut, fim, n=JANELA):
    """Balanço hídrico de um reservatório (função pura, testável).

    x: {campo: {dia: valor}} com vol_util_pct (%) e vazões q_* (m³/s); vut: volume útil
    total do cadastro (hm³); fim: último dia da janela de n dias. Convenção conferida nos
    dados do ONS: o volume do dia d é o do fim do dia, e V(d) − V(d−1) corresponde às
    vazões do dia d. Fluxos em hm³ = m³/s × 86.400 s ÷ 10⁶ = × 0,0864.

    Devolve ΔV observado, componentes somados (só com os n dias informados), resíduo
    (ΔV − (afluência − defluência)) e resíduo com transferência (sinal da transferência
    não documentado: as duas versões são publicadas); o resíduo diário e a fração de dias
    dentro da tolerância de arredondamento (0,01% do volume útil, dois arredondamentos do
    percentual com 2 casas, + 0,002 hm³ das vazões com 2 casas) na JANELA publicada e,
    separadamente, em toda a série disponível (com o período); e a defluência não
    discriminada segundo a convenção do reservatório (convencao_defluencia): com as
    outras estruturas dentro da defluência, defluência − turbinada − vertida − outras;
    com elas fora, defluência − turbinada − vertida; convenção indeterminada, nulo."""
    vol = x.get("vol_util_pct", {})
    afl, defl = x.get("q_afluente", {}), x.get("q_defluente", {})
    tem_vol = bool(vut and vut > 0 and vol)
    tol = (0.0001 * vut + 0.002) if tem_vol else None
    janela = _dias_janela(fim, n)
    na_janela = set(janela)
    dentro_tol, n_res, residuos = 0, 0, {}
    dentro_j, n_j = 0, 0
    if tem_vol:
        for k in sorted(vol):
            ka = _dmenos(k, 1)
            if ka in vol and k in afl and k in defl:
                dv = (vol[k] - vol[ka]) / 100.0 * vut
                r_ = dv - (afl[k] - defl[k]) * 0.0864
                residuos[k] = (dv, r_)
                n_res += 1
                dentro_tol += abs(r_) <= tol
                if k in na_janela:
                    n_j += 1
                    dentro_j += abs(r_) <= tol
    d0 = _dmenos(janela[0], 1)
    comp = {}
    completos = all(k in afl and k in defl for k in janela)
    for campo in ("q_afluente", "q_defluente", "q_turbinada", "q_vertida", "q_outras", "q_transferida", "q_natural"):
        vals = [x.get(campo, {}).get(k) for k in janela]
        n_ = sum(1 for v in vals if v is not None)
        # soma só com os n dias informados: parcial não vira total, ausência não vira zero
        comp[campo] = sum(v * 0.0864 for v in vals) if completos and n_ == n else None
        comp[f"n_{campo}"] = n_
    dv_obs = ((vol[fim] - vol[d0]) / 100.0 * vut) if tem_vol and fim in vol and d0 in vol else None
    balanco_ok = dv_obs is not None and completos
    conv = convencao_defluencia(x)
    defl_disc = None
    if comp["q_defluente"] is not None and comp["q_turbinada"] is not None and comp["q_vertida"] is not None:
        resto = comp["q_defluente"] - comp["q_turbinada"] - comp["q_vertida"]
        outras_j = comp["q_outras"]
        # outras estruturas desprezíveis na janela (abaixo do arredondamento das vazões):
        # as duas convenções dão o mesmo número
        outras_nulas = outras_j is None or abs(outras_j) <= n * TOL_DEFL_M3S * 0.0864
        if conv["convencao"] == "inclui_outras":
            defl_disc = resto - (outras_j or 0.0)
        elif conv["convencao"] == "exclui_outras" or outras_nulas:
            defl_disc = resto
    residuo = dv_obs - (comp["q_afluente"] - comp["q_defluente"]) if balanco_ok else None
    residuo_t = (residuo + comp["q_transferida"]) if residuo is not None and comp["q_transferida"] is not None else None
    avaliados = sorted(residuos)
    return {"tem_vol": tem_vol, "tolerancia": tol, "dentro_tol": dentro_tol, "n_res": n_res, "residuos": residuos,
            "dentro_tol_janela": dentro_j, "n_res_janela": n_j,
            "periodo_residuos": (avaliados[0], avaliados[-1]) if avaliados else None,
            "comp": comp, "dv_obs": dv_obs, "balanco_ok": balanco_ok, "defl_disc": defl_disc, "convencao": conv,
            "residuo": residuo, "residuo_t": residuo_t, "inicio": janela[0], "volume_inicial_em": d0}


def _reservatorios(con, con_p, d):
    q = {}
    for campo in oa.CAMPOS_HIDRO:
        for s, vals in _series_glob(con, DS_HIDRO, f"{campo}.*").items():
            q.setdefault(s.split(".", 1)[1], {})[campo] = vals
    if not q:
        raise RuntimeError("dados hidráulicos ausentes no silver")
    atrib = base.registros_como_estavam_em(con, DS_HIDRO)
    cad = base.registros_como_estavam_em(con, DS_CAD)
    cad_por_resid = {v.get("res_id"): k for k, v in cad.items() if v.get("res_id")}
    # fim da janela: último dia em que ao menos 90% dos reservatórios com volume têm volume e vazões
    com_vol = [rid for rid, x in q.items() if x.get("vol_util_pct")]
    contagem = defaultdict(int)
    for rid in com_vol:
        x = q[rid]
        for k in x["vol_util_pct"]:
            if k in x.get("q_afluente", {}) and k in x.get("q_defluente", {}):
                contagem[k] += 1
    dias_ok = sorted(k for k, n in contagem.items() if n >= 0.9 * len(com_vol))
    if not dias_ok:
        raise RuntimeError("sem dia com dados hidráulicos completos")
    fim = dias_ok[-1]
    janela = _dias_janela(fim)
    d0 = _dmenos(janela[0], 1)
    lista, diario_csv = [], []
    ini_csv = _dmenos(fim, 364)
    nao_casados = []
    for rid, x in sorted(q.items()):
        at = atrib.get(rid, {})
        cod = at.get("cod_usina") or None
        ccad = cad.get(cod) if cod and cod in cad else (cad.get(cad_por_resid.get(rid)) if rid in cad_por_resid else None)
        if ccad is None:
            nao_casados.append(rid)
        vut = oa.num((ccad or {}).get("val_volutiltot"))
        vol = x.get("vol_util_pct", {})
        b = balanco_reservatorio(x, vut, fim)
        tem_vol, residuos, comp = b["tem_vol"], b["residuos"], b["comp"]
        tol, dentro_tol, n_res = b["tolerancia"], b["dentro_tol"], b["n_res"]
        dv_obs, balanco_ok, defl_disc = b["dv_obs"], b["balanco_ok"], b["defl_disc"]
        residuo, residuo_t = b["residuo"], b["residuo_t"]
        conv = b["convencao"]
        per = b["periodo_residuos"]
        if balanco_ok:
            motivo = None
        elif not vut or vut <= 0:
            motivo = "sem volume útil no cadastro" if ccad is not None else "sem correspondência no cadastro"
        elif not vol:
            motivo = "sem volume útil em percentual nos dados hidráulicos"
        else:
            faltam = sorted(set([k for k in [d0] + janela if k not in vol] +
                                [k for k in janela if k not in x.get("q_afluente", {}) or k not in x.get("q_defluente", {})]))
            motivo = "dia sem vazão ou volume na janela" + (f": {len(faltam)} dias, o primeiro em {faltam[0]}" if faltam else "")
        item = {
            "id": rid, "cod": cod, "nome": at.get("nome") or rid, "subsistema": at.get("subsistema"),
            "bacia": at.get("bacia"), "ree": at.get("ree"), "tipo": at.get("tipo"),
            "usina": (ccad or {}).get("nom_usina"), "rio": (ccad or {}).get("nom_rio"),
            "vol_util_total_hm3": c.r(vut, 2), "vol_util_pct_fim": c.r(vol.get(fim), 2),
            "vol_util_pct_inicio": c.r(vol.get(d0), 2),
            "dv_obs_hm3": c.r(dv_obs, 2),
            "afluencia_hm3": c.r(comp["q_afluente"], 2), "defluencia_hm3": c.r(comp["q_defluente"], 2),
            "turbinado_hm3": c.r(comp["q_turbinada"], 2), "vertido_hm3": c.r(comp["q_vertida"], 2),
            "outras_estruturas_hm3": c.r(comp["q_outras"], 2),
            "defluencia_nao_discriminada_hm3": None if defl_disc is None else c.r(defl_disc, 2) + 0.0,
            "transferido_hm3": c.r(comp["q_transferida"], 2),
            "natural_hm3": c.r(comp["q_natural"], 2),
            "residuo_hm3": c.r(residuo, 2), "residuo_com_transferencia_hm3": c.r(residuo_t, 2),
            "tolerancia_dia_hm3": c.r(tol, 3),
            # fração de dias que fecham dentro do arredondamento: na janela publicada e, à
            # parte, em toda a série diária disponível (com o período)
            "dias_residuo_dentro_tolerancia_pct": c.r(100.0 * b["dentro_tol_janela"] / b["n_res_janela"], 1) if b["n_res_janela"] else None,
            "dias_residuo_avaliados": b["n_res_janela"],
            "serie_dias_residuo_dentro_tolerancia_pct": c.r(100.0 * dentro_tol / n_res, 1) if n_res else None,
            "serie_dias_residuo_avaliados": n_res,
            "serie_inicio": per[0] if per else None, "serie_fim": per[1] if per else None,
            "convencao_defluencia": conv["convencao"],
            "balanco_calculado": balanco_ok,
            "motivo_sem_balanco": motivo,
        }
        lista.append(item)
        if tem_vol:
            for k in sorted(vol):
                if k < ini_csv:
                    continue
                dv, r_ = residuos.get(k, (None, None))
                diario_csv.append([k, rid, vol.get(k), dv] + [x.get(f, {}).get(k) for f in (
                    "q_afluente", "q_defluente", "q_turbinada", "q_vertida", "q_outras", "q_transferida",
                    "q_natural")] + [r_])
    # reservatórios que contam como armazenamento de energia (EAR máxima positiva no dia da EAR):
    # é o conjunto que explica a variação da EAR; os demais (fio d'água com volume pequeno)
    # ficam no CSV com o mesmo cálculo
    cap = {}
    for s_, vals in _series_glob(con, DS_EAR_RES, "earmax_*").items():
        cod_ = s_.split(".", 1)[1]
        v_ = _vigente(sorted((k, v) for k, v in vals.items() if v is not None), d["dia_ear"])
        cap[cod_] = cap.get(cod_, 0.0) + (v_ or 0.0)
    for x in lista:
        x["ear_max_mwmes"] = c.r(cap.get(x["cod"]), 1) if x["cod"] in cap else None
    d["_res_lista"], d["_res_diario_csv"], d["_res_fim"], d["_res_q"] = lista, diario_csv, fim, q
    # decomposição da variação da EAR por reservatório (MWmês), janela de 30 dias até o dia da EAR
    # mesma captura dos arquivos por reservatório (recaptura do subsistema nos anos recentes)
    mw = d.get("_ear_ref_mw") or d["_ear"][0]
    # fim da decomposição: último dia com EAR por reservatório até o dia da EAR (o arquivo
    # por reservatório pode estar um dia atrás do arquivo por subsistema)
    ult_res = {sm: max((k for k in _serie(con, DS_EAR_RES, f"soma_ear_mwmes.{sm}", desde=_dmenos(d["dia_ear"], 10))
                        if k <= d["dia_ear"]), default=None) for sm in SMS}
    dias_res = [v for v in ult_res.values() if v]
    dia_ear = min(dias_res) if dias_res else d["dia_ear"]
    ini_ear = _dmenos(dia_ear, JANELA)
    ep = _series_glob(con, DS_EAR_RES, "ear_proprio.*", desde=ini_ear)
    ej = _series_glob(con, DS_EAR_RES, "ear_jusante.*", desde=ini_ear)
    atr_ear = {}
    for ch, campos in base.registros_como_estavam_em(con, DS_EAR_RES).items():
        cod, ano = ch.split("|")
        if int(ano) == int(dia_ear[:4]):
            atr_ear[cod] = campos
    contrib = defaultdict(list)
    for s, vals in ep.items():
        cod = s.split(".", 1)[1]
        a = atr_ear.get(cod, {})
        if dia_ear in vals and ini_ear in vals and a.get("subsistema"):
            contrib[a["subsistema"]].append({"cod": cod, "nome": a.get("nome"), "parte": "proprio",
                                             "delta_mwmes": vals[dia_ear] - vals[ini_ear]})
    for s, vals in ej.items():
        cod = s.split(".", 1)[1]
        a = atr_ear.get(cod, {})
        if dia_ear in vals and ini_ear in vals and a.get("subsistema_jusante"):
            dlt = vals[dia_ear] - vals[ini_ear]
            if abs(dlt) > 0:
                contrib[a["subsistema_jusante"]].append({"cod": cod, "nome": a.get("nome"), "parte": "jusante",
                                                         "delta_mwmes": dlt})
    ena_sm = d["_ena_sm"]
    bal = {sm: _serie(con_p, DS_BAL, f"hidraulica.{sm}", desde=ini_ear) for sm in SMS}
    decomp = []
    for sm in SMS:
        itens = contrib.get(sm, [])
        soma = sum(x["delta_mwmes"] for x in itens)
        dsm = mw[sm][dia_ear] - mw[sm][ini_ear] if ini_ear in mw[sm] and dia_ear in mw[sm] else None
        ks = [k for k in _dias_janela(dia_ear) if k in ena_sm[sm]["mw"]]
        hs = [v for k, v in bal[sm].items() if ini_ear < k[:10] <= dia_ear]
        decomp.append({
            "sm": sm, "inicio": ini_ear, "fim": dia_ear,
            "delta_ear_mwmes": c.r(dsm, 1), "soma_reservatorios_mwmes": c.r(soma, 1),
            "residuo_mwmes": c.r(dsm - soma, 3) if dsm is not None else None,
            "n_reservatorios": len(itens),
            "maiores_quedas": [{**x, "delta_mwmes": c.r(x["delta_mwmes"], 1)} for x in sorted(itens, key=lambda x: x["delta_mwmes"])[:5] if x["delta_mwmes"] < 0],
            "maiores_altas": [{**x, "delta_mwmes": c.r(x["delta_mwmes"], 1)} for x in sorted(itens, key=lambda x: -x["delta_mwmes"])[:5] if x["delta_mwmes"] > 0],
            "contexto": {
                "ena_bruta_media_mwmed": c.r(sum(ena_sm[sm]["mw"][k] for k in ks) / len(ks), 1) if ks else None,
                "ena_armazenavel_media_mwmed": c.r(c.media([ena_sm[sm]["arm"].get(k) for k in ks]), 1) if ks else None,
                "geracao_hidraulica_media_mwmed": c.r(sum(hs) / len(hs), 1) if len(hs) >= 24 * 28 else None,
                "horas_geracao": len(hs),
                "comparavel_com_delta_ear": False,
            },
        })
    # séries diárias (45 dias: a janela de 30 e as duas semanas anteriores) de cada reservatório
    # da lista: ficam em agua_reservatorios_45d.json (abaixo), lidas pela página sob demanda;
    # na gold não caberiam (contrato, seção 5.1). O CSV diário traz 365 dias de todos.
    ini90 = _dmenos(fim, DIAS_SERIES_RES - 1)
    calc = [x for x in lista if x["balanco_calculado"]]
    # "fecha por construção": ao menos 95% dos dias com resíduo dentro do arredondamento em
    # toda a série diária disponível (a característica é do método da fonte, não da janela);
    # a contagem na janela de 30 dias vem ao lado
    fecha = [x for x in calc if (x["serie_dias_residuo_dentro_tolerancia_pct"] or 0) >= 95]
    fecha_j = [x for x in calc if (x["dias_residuo_dentro_tolerancia_pct"] or 0) >= 95]
    pers = [(x["serie_inicio"], x["serie_fim"]) for x in calc if x["serie_inicio"]]
    motivos = defaultdict(int)
    for x in lista:
        if not x["balanco_calculado"]:
            motivos[x["motivo_sem_balanco"].split(":")[0]] += 1
    convs = defaultdict(int)
    for x in lista:
        convs[x["convencao_defluencia"]] += 1
    d["reservatorios"] = {
        "inicio": janela[0], "fim": fim, "volume_inicial_em": d0,
        "lista": [{k: v for k, v in x.items() if k not in CAMPOS_SO_CSV}
                  for x in sorted(lista, key=lambda x: -(x["ear_max_mwmes"] or 0)) if (x["ear_max_mwmes"] or 0) > 0],
        "criterio_lista": "reservatórios com EAR máxima positiva no dia da EAR (contam no armazenamento de energia); o CSV traz todos",
        "n_sem_volume_util": sum(1 for x in lista if not x["vol_util_total_hm3"]),
        "n_reservatorios": len(lista), "n_com_balanco": len(calc),
        "sem_balanco_por_motivo": dict(sorted(motivos.items())),
        "n_fecham_por_construcao": len(fecha),
        "criterio_fecham_por_construcao": "ao menos 95% dos dias da série diária disponível com |resíduo| dentro do arredondamento",
        "periodo_fecham_por_construcao": {"inicio": min(p_[0] for p_ in pers), "fim": max(p_[1] for p_ in pers)} if pers else None,
        "n_fecham_na_janela": len(fecha_j),
        "convencao_defluencia": dict(sorted(convs.items())),
        "sem_cadastro": nao_casados,
        "decomposicao_ear": decomp,
        "series_45d": {"arquivo": f"/energia/series/{ARQ_RES_45D}", "d0": ini90, "fim": fim, "dias": DIAS_SERIES_RES},
    }
    # dias consecutivos de d0 a fim (dia sem dado = null, nunca preenchido)
    ks = _dias_janela(fim, DIAS_SERIES_RES)
    d["_res_45d"] = {
        "fim": fim, "d0": ini90, "passo_dias": 1,
        "criterio": d["reservatorios"]["criterio_lista"],
        "reservatorios": [{"id": x["id"], "nome": x["nome"], "d0": ini90, "passo_dias": 1,
                           **{k_: [c.r(q[x["id"]].get(campo, {}).get(k), casas) for k in ks]
                              for k_, campo, casas in (("vol", "vol_util_pct", 2), ("afl", "q_afluente", 0),
                                                       ("defl", "q_defluente", 0), ("turb", "q_turbinada", 0),
                                                       ("vert", "q_vertida", 0))}}
                          for x in d["reservatorios"]["lista"]],
    }
    return d


# ================================================================ proveniência, evidências e CSVs

def _prov(indicador, natureza, fonte, unidade, frequencia, periodo, snapshot, limitacoes, formula=None,
          transformacoes=(), download=None, notas=None, cobertura=None):
    """Proveniência: periodo = período de referência do número exibido; cobertura = período
    histórico que entra no cálculo (ex.: anos da base da faixa), quando diferente."""
    return c.proveniencia(indicador=indicador, natureza=natureza, fonte=fonte, unidade=unidade, frequencia=frequencia,
                          periodo=periodo, cobertura=cobertura or periodo, capturado_em=c.ultima_captura(snapshot),
                          snapshot=snapshot, limitacoes=limitacoes, formula=formula, transformacoes=transformacoes,
                          download=download, notas_fonte=notas)


def _snap_captura(con, con_p, escolha, ano, ds_p, ds_conf):
    """Snapshot da captura usada no ano de referência (silver principal ou recaptura)."""
    e = escolha.get(ano) or {}
    return c.snapshot_de(con, ds_conf) if e.get("fonte") == FONTE_RECAPTURA else c.snapshot_de(con_p, ds_p)


def _faixa_anos(lst, chave="periodo_base"):
    """{inicio, fim} dos anos usados nas faixas de uma lista de recortes (menor e maior)."""
    ps = [x[chave] for x in lst if x.get(chave)]
    if not ps:
        return None
    return {"inicio": f"{min(p_.split('-')[0] for p_ in ps)}-01-01", "fim": f"{max(p_.split('-')[1] for p_ in ps)}-12-31"}


def _fonte_ons(chave, titulo, recurso):
    pac, dir_, pref = oa.PACOTES[chave]
    return {"orgao": "ONS", "dataset": titulo, "recurso": recurso, "url_dataset": f"https://dados.ons.org.br/dataset/{pac}",
            "url_primaria": f"{oa.S3}{dir_}/", "licenca": c.LICENCA_ONS}


# colunas do agua_reservatorios.csv (todas as do dicionário em REGISTRO["arquivos"]; o
# teste confere cabeçalho × dicionário) e campos que ficam só no CSV (a gold leva o
# essencial para a página; o período da série de resíduos está no bloco da gold)
COLS_RES_CSV = ["id", "cod", "nome", "usina", "rio", "subsistema", "bacia", "ree", "tipo", "vol_util_total_hm3",
                "ear_max_mwmes", "vol_util_pct_inicio", "vol_util_pct_fim", "dv_obs_hm3", "afluencia_hm3", "defluencia_hm3",
                "turbinado_hm3", "vertido_hm3", "outras_estruturas_hm3", "convencao_defluencia",
                "defluencia_nao_discriminada_hm3", "transferido_hm3", "natural_hm3", "residuo_hm3",
                "residuo_com_transferencia_hm3", "tolerancia_dia_hm3", "dias_residuo_avaliados",
                "dias_residuo_dentro_tolerancia_pct", "serie_inicio", "serie_fim", "serie_dias_residuo_avaliados",
                "serie_dias_residuo_dentro_tolerancia_pct", "balanco_calculado", "motivo_sem_balanco"]
# "cod" (cod_usina) fica na gold: é a chave que liga cada parcela da decomposição da EAR (por
# usina) ao balanço do reservatório (por id_reservatorio), sem casar nomes
CAMPOS_SO_CSV = ("usina", "rio", "vol_util_pct_inicio", "tolerancia_dia_hm3", "ree", "serie_inicio", "serie_fim",
                 "tipo", "motivo_sem_balanco", "serie_dias_residuo_avaliados")

LIM_ONS = ("O ONS informa que os dados fazem parte de um processo de consistência recorrente e podem ser atualizados "
           "após a publicação; revisões entram como novas vintages.")


def _escreve(d, nome, cab, linhas):
    return base.escreve_csv(nome, cab, linhas, destino=d.get("destino_csv"))


def _csvs(d):
    downloads = []
    # temperatura por subsistema (clima_diario.csv) e por UF
    t2m, tmax, tmin = d.get("_temp", ({}, {}, {}))
    if t2m:
        cob = d.get("_temp_cob", {})
        n_ufs = {sm: sum(1 for s_ in cl.UF_SUBSISTEMA.values() if s_ == sm) for sm in SMS}
        n_ufs["SIN"] = len(cl.UF_SUBSISTEMA)
        linhas = []
        for rec in TODOS:
            s = t2m.get(rec, {})
            for k in sorted(s):
                if k < cl.TEMP_INICIO:
                    continue
                pre = 1 if k > d["_corte_merra"] else 0
                cobk = cob.get(f"cobertura_pop_pct.{rec}", {}).get(k)
                ufsk = cob.get(f"ufs_com_dado.{rec}", {}).get(k)
                linhas.append([k, rec, s[k], tmax.get(rec, {}).get(k), tmin.get(rec, {}).get(k),
                               100.0 if cobk is None else cobk, n_ufs[rec] if ufsk is None else _int(ufsk),
                               "GEOS-IT ou MERRA-2 (POWER)" if pre else "MERRA-2 (POWER)", pre])
        _escreve(d, "clima_diario.csv", ["data", "recorte", "temp_media_c", "temp_max_c", "temp_min_c", "cobertura_pop_pct",
                                         "ufs_com_dado", "fonte_versao", "preliminar"], sorted(linhas))
        downloads.append({"rotulo": "Temperatura diária por subsistema e SIN (CSV)", "url": "/energia/series/clima_diario.csv"})
        pop = {}
        for campos in d["_pontos"][1].values():
            pop[campos["uf"]] = campos.get("pop_uf")
        linhas = []
        for rec, s in t2m.items():
            if not rec.startswith("UF_"):
                continue
            uf = rec[3:]
            for k in sorted(s):
                if k >= UF_DESDE:
                    linhas.append([k, uf, cl.UF_SUBSISTEMA.get(uf), s[k], tmax.get(rec, {}).get(k), tmin.get(rec, {}).get(k),
                                   pop.get(uf)])
        _escreve(d, "agua_temperatura_uf_diario.csv", ["data", "uf", "subsistema", "temp_media_c", "temp_max_c", "temp_min_c",
                                                       "populacao_uf"], sorted(linhas))
        downloads.append({"rotulo": "Temperatura diária por UF, desde 2019 (CSV)", "url": "/energia/series/agua_temperatura_uf_diario.csv"})
    pr = d.get("_precip", {})
    if pr:
        cobp = d.get("_precip_cob", {})
        linhas = []
        for s_nome, serie in pr.items():
            b = s_nome.split(".", 1)[1]
            for k in sorted(serie):
                if k >= "2016-01-01":
                    cb = cobp.get(f"cobertura_pct.{b}", {}).get(k)
                    linhas.append([k, b, serie[k], 100.0 if cb is None else cb, 1 if k > d["_corte_final"] else 0])
        _escreve(d, "agua_precipitacao_bacias_diario.csv", ["data", "bacia", "precip_mm", "cobertura_pct", "preliminar"], sorted(linhas))
        _escreve(d, "agua_precipitacao_bacias_mensal.csv", ["mes", "bacia", "precip_mm", "media_2001_2025_mm", "p10_mm", "p90_mm",
                                                            "anos_base", "anomalia_pct", "preliminar"], sorted(d["_mensal_precip_csv"]))
        downloads += [{"rotulo": "Precipitação diária por bacia, desde 2016 (CSV)", "url": "/energia/series/agua_precipitacao_bacias_diario.csv"},
                      {"rotulo": "Precipitação mensal por bacia e climatologia (CSV)", "url": "/energia/series/agua_precipitacao_bacias_mensal.csv"}]
    pv = d.get("_previsao")
    if pv:
        linhas = []
        for b in pv["bacias"]:
            linhas += [[pv["emitida_em"], k, "precipitacao", b["bacia"], v, None, None] for k, v in zip(pv["dias"], b["mm"])]
        for t in pv["temperatura"]:
            linhas += [[pv["emitida_em"], k, "temperatura", t["recorte"], None, v, vx]
                       for k, v, vx in zip(pv["dias"], t["t"], t["tmax"])]
        _escreve(d, "agua_previsao.csv", ["emitida_em", "data", "tipo", "recorte", "precip_mm", "temp_media_c", "temp_max_c"], linhas)
        downloads.append({"rotulo": "Previsão diária por bacia e por subsistema, rodada mais recente (CSV)",
                          "url": "/energia/series/agua_previsao.csv"})
    if d.get("_pontos"):
        pts, cels = d["_pontos"]
        linhas = []
        for ch, x in sorted(pts.items()):
            linhas.append(["precipitacao", x["ponto"], x["lat"], x["lon"], x.get("bacia"), ch.split("|")[0], x["passo"], x["peso"], ""])
        for ch, x in sorted(cels.items()):
            linhas.append(["temperatura", x["celula"], x["lat"], x["lon"], x["uf"], x.get("subsistema"), "", x["pop"], x.get("pop_uf")])
        _escreve(d, "agua_clima_pontos.csv", ["tipo", "id", "lat", "lon", "recorte", "subrecorte", "passo_grau", "peso",
                                              "populacao_recorte"], linhas)
        downloads.append({"rotulo": "Manifesto espacial dos pontos de clima (CSV)", "url": "/energia/series/agua_clima_pontos.csv"})
    # EAR e ENA por subsistema e SIN, desde 2022, com a captura usada em cada ano (o
    # silver principal e a recaptura do módulo podem diferir pela revisão do ONS)
    if d.get("_ear") and d.get("_ena_sm"):
        mw, mx, pct, dias_ = d["_ear"]
        ena = d["_ena_sm"]
        ce, cn = d.get("_captura_ear", {}), d.get("_captura_ena", {})
        rot = lambda e: f"{e['fonte']} ({e['capturado_em']})" if e else None  # noqa: E731
        linhas = []
        ks = sorted(k for k in set(dias_) | set(ena["SIN"]["mw"]) if k >= DIARIO_RECORTES)
        for k in ks:
            for rec in TODOS:
                # armazenável: o SIN não tem percentual publicado; é a razão das somas do mesmo dia
                arm, marm = ena[rec].get("arm", {}).get(k), ena[rec].get("mlt_arm", {}).get(k)
                parm = ena[rec].get("arm_pct", {}).get(k) if rec != "SIN" else (100.0 * arm / marm if arm is not None and marm else None)
                linhas.append([k, rec, mw[rec].get(k), mx[rec].get(k), pct[rec].get(k), ena[rec]["mw"].get(k),
                               ena[rec].get("pct", {}).get(k), ena[rec]["mlt"].get(k), arm, parm, marm,
                               rot(ce.get(k[:4])), rot(cn.get(k[:4]))])
        _escreve(d, "agua_subsistemas_diario.csv", ["data", "recorte", "ear_mwmes", "ear_max_mwmes", "ear_pct",
                                                    "ena_bruta_mwmed", "ena_bruta_pct_mlt", "mlt_implicita_mwmed",
                                                    "ena_arm_mwmed", "ena_arm_pct_mlt", "mlt_arm_implicita_mwmed",
                                                    "captura_ear", "captura_ena"], linhas)
        downloads.append({"rotulo": "EAR e ENA diárias por subsistema e SIN, desde 2022, com a captura usada (CSV)",
                          "url": "/energia/series/agua_subsistemas_diario.csv"})
    # EAR e ENA por REE e bacia: diária desde 2022 e mensal desde 2000 (o diário completo
    # passaria de 15 MB; o histórico diário integral fica no silver e no bronze)
    linhas, mensal = [], []
    cfg = d.get("_cfg_ree") or {}
    for rec, ear, ena in (("ree", d.get("_ree", {}), d.get("_ena_ree", {})), ("bacia", d.get("_bac", {}), d.get("_ena_bac", {}))):
        for n_ in sorted(set(ear) | set(ena)):
            e, a = ear.get(n_, {"mw": {}, "max": {}, "pct": {}}), ena.get(n_, {})
            ks = sorted(set(e.get("mw", {})) | set(a.get("mw", {})))
            for k in ks:
                if k >= DIARIO_RECORTES:
                    linhas.append([k, rec, n_, e["mw"].get(k), e["max"].get(k), _pct_aplicavel(e, k), a.get("mw", {}).get(k),
                                   a.get("pct", {}).get(k), a.get("mlt", {}).get(k)])
            por_mes = defaultdict(list)
            for k in ks:
                por_mes[k[:7]].append(k)
            for m, kk in sorted(por_mes.items()):
                ult = max(k for k in kk if k in e["mw"]) if any(k in e["mw"] for k in kk) else None
                n_mes = calendar.monthrange(int(m[:4]), int(m[5:7]))[1]
                com = [k for k in kk if k in a.get("mw", {}) and k in a.get("mlt", {})]
                ena_m = (100.0 * sum(a["mw"][k] for k in com) / sum(a["mlt"][k] for k in com)
                         if len(com) == n_mes and sum(a["mlt"][k] for k in com) > 0 else None)
                # perímetro do REE no ponto: anterior à reconfiguração do fim de 2017 só para
                # os REE afetados (os demais não mudaram de perímetro)
                afetado = bool(cfg.get("quebra")) and n_ in cfg.get("afetados", [])
                per = ("" if rec != "ree" else "transicao" if afetado and m == cfg["quebra"][:7] else
                       "anterior" if afetado and m < cfg["quebra"][:7] else "atual")
                mensal.append([m, rec, n_, ult, e["mw"].get(ult) if ult else None, e["max"].get(ult) if ult else None,
                               _pct_aplicavel(e, ult) if ult else None, ena_m, len(com), per])
    _escreve(d, "agua_ear_recortes_diario.csv", ["data", "recorte", "nome", "ear_mwmes", "ear_max_mwmes", "ear_pct",
                                                 "ena_bruta_mwmed", "ena_bruta_pct_mlt", "mlt_implicita_mwmed"], linhas)
    _escreve(d, "agua_ear_recortes_mensal.csv", ["mes", "recorte", "nome", "dia_ear", "ear_mwmes_fim_mes", "ear_max_mwmes_fim_mes",
                                                 "ear_pct_fim_mes", "ena_bruta_pct_mlt_mes", "dias_ena", "perimetro_ree"], mensal)
    downloads += [{"rotulo": "EAR e ENA diárias por REE e por bacia, desde 2022 (CSV)", "url": "/energia/series/agua_ear_recortes_diario.csv"},
                  {"rotulo": "EAR no fim do mês e ENA mensal por REE e por bacia, desde 2000 (CSV)", "url": "/energia/series/agua_ear_recortes_mensal.csv"}]
    # capacidade
    linhas = []
    for e in d.get("_eventos", []):
        base_l = [e["data"], e["sm"], e["antes_mwmes"], e["depois_mwmes"], e["variacao_mwmes"]]
        if not e["reservatorios"]:
            linhas.append(base_l + ["", "", "", "", "", e["residuo_mwmes"]])
        for x in e["reservatorios"]:
            linhas.append(base_l + [x["cod"], x["nome"], x["parte"], x["tipo"], x["variacao_mwmes"], e["residuo_mwmes"]])
    _escreve(d, "agua_capacidade_eventos.csv", ["data", "subsistema", "ear_max_antes_mwmes", "ear_max_depois_mwmes", "variacao_mwmes",
                                                "cod_reservatorio", "reservatorio", "parte", "tipo", "variacao_reservatorio_mwmes",
                                                "residuo_evento_mwmes"], linhas)
    downloads.append({"rotulo": "Mudanças da capacidade de armazenamento (CSV)", "url": "/energia/series/agua_capacidade_eventos.csv"})
    linhas = [[m["data"], m["cod"], m["nome"], m["sm"], m["antes"], m["depois"], m["variacao_pct"], m["tipo"]]
              for m in sorted(d.get("_mlt_mudancas", []), key=lambda m: (m["data"], m["cod"]))
              if m["tipo"] != "virada_de_mes"]
    _escreve(d, "agua_mlt_mudancas.csv", ["data", "cod_reservatorio", "reservatorio", "subsistema", "mlt_antes_mwmed",
                                          "mlt_depois_mwmed", "variacao_pct", "tipo"], linhas)
    downloads.append({"rotulo": "Mudanças da MLT por usina (CSV)", "url": "/energia/series/agua_mlt_mudancas.csv"})
    if d.get("_res_lista"):
        r_ = d["reservatorios"]
        _escreve(d, "agua_reservatorios.csv", ["janela_inicio", "janela_fim"] + COLS_RES_CSV,
                 [[r_["inicio"], r_["fim"]] + [(1 if x.get(k) else 0) if k == "balanco_calculado" else x.get(k)
                                               for k in COLS_RES_CSV] for x in d["_res_lista"]])
        _escreve(d, "agua_reservatorios_diario.csv", ["data", "id", "vol_util_pct", "dv_hm3", "q_afluente", "q_defluente",
                                                      "q_turbinada", "q_vertida", "q_outras", "q_transferida",
                                                      "q_natural", "residuo_hm3"], sorted(d["_res_diario_csv"]))
        downloads += [{"rotulo": "Balanço de 30 dias por reservatório (CSV)", "url": "/energia/series/agua_reservatorios.csv"},
                      {"rotulo": "Dados hidráulicos diários por reservatório, 365 dias (CSV)", "url": "/energia/series/agua_reservatorios_diario.csv"}]
    # JSON lidos pela página sob demanda (mapa das bacias e séries de 45 dias de cada
    # reservatório da lista): uma feature ou um reservatório por linha, diffs legíveis
    destino = d.get("destino_csv") or base.SERIES
    if d.get("_res_45d"):
        _escreve_json_linhas(os.path.join(destino, ARQ_RES_45D), d["_res_45d"], "reservatorios")
        downloads.append({"rotulo": "Séries diárias de 45 dias dos reservatórios da lista (JSON)", "url": f"/energia/series/{ARQ_RES_45D}"})
    if d.get("_geo_bacias"):
        _escreve_json_linhas(os.path.join(destino, ARQ_GEO_BACIAS), d["_geo_bacias"], "features")
        downloads.append({"rotulo": "Contornos das bacias do ONS, projetados e simplificados para o mapa (JSON)",
                          "url": f"/energia/series/{ARQ_GEO_BACIAS}"})
    return downloads


ARQ_RES_45D = "agua_reservatorios_45d.json"


def _escreve_json_linhas(caminho, payload, lista):
    """Cabeçalho numa linha e um item da lista por linha (o formato das malhas em public/energia/geo)."""
    cab = json.dumps({k: v for k, v in payload.items() if k != lista}, ensure_ascii=False, separators=(",", ":"), allow_nan=False)[:-1]
    itens = [json.dumps(x, ensure_ascii=False, separators=(",", ":"), allow_nan=False) for x in payload[lista]]
    return base._escreve_atomico(caminho, cab + f',"{lista}":[\n' + ",\n".join(itens) + "\n]}\n")


def _br(v, casas=2):
    """Número no formato brasileiro para texto (sinal de menos tipográfico, milhar com ponto)."""
    if v is None:
        return "sem dado"
    t = f"{abs(v):,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if v < 0 else "") + t


def _int(v):
    return None if v is None else int(round(v))


# ================================================================ construir

def construir(con, ctx):
    con_p = ctx.get("con_principal") or base.conecta()
    d = {"destino_csv": ctx.get("destino_csv")}
    faltas = []
    for etapa in (_armazenamento, _afluencia):
        etapa(con, con_p, d)
    try:
        _clima(con, d)
        d["_temp_cob"] = _series_glob(con, DS_CLIMA_T, "cobertura_pop_pct.*")
        d["_temp_cob"].update(_series_glob(con, DS_CLIMA_T, "ufs_com_dado.*"))
        d["_precip_cob"] = _series_glob(con, DS_CLIMA_PR, "cobertura_pct.*")
    except RuntimeError as e:
        faltas.append(f"clima: {e}")
    faltas += d.get("_pendencias_clima", [])
    try:
        _reservatorios(con, con_p, d)
    except RuntimeError as e:
        faltas.append(f"reservatórios: {e}")
    try:
        d["_geo_bacias"] = _camada_bacias(con)
        if d["_geo_bacias"] is None:
            faltas.append("mapa das bacias: shapefile de contornos ausente no bronze")
    except ValueError as e:
        faltas.append(f"mapa das bacias: {e}")
    problemas = _valida(d)
    criticos = [p for p in problemas if p.startswith("CRÍTICO")]
    if criticos:
        return c.stub(GOLD, "; ".join(criticos)[:300])
    downloads = _csvs(d)
    prov, evid = _proveniencias_e_evidencias(con, con_p, d, downloads)
    gold = {
        **c.cabecalho(GOLD),
        "dias_referencia": {"ear": d["dia_ear"], "ena": d["dia_ena"],
                            "ree": d["afluencia"].get("dia_ree"), "bacias": d["afluencia"].get("dia_bacias"),
                            "reservatorios": d.get("reservatorios", {}).get("fim"),
                            "precipitacao": max((b["dia"] for b in d.get("clima", {}).get("precipitacao_bacias", [])), default=None),
                            "temperatura": max((t["dia"] for t in d.get("clima", {}).get("temperatura", [])), default=None)},
        "regras": REGRAS,
        "armazenamento": d["armazenamento"],
        "reconciliacao_ear": d["reconciliacao_ear"],
        "afluencia": d["afluencia"],
        "clima": d.get("clima"),
        "reservatorios": d.get("reservatorios"),
        "pendencias": faltas,
        "ressalvas": [p for p in problemas if not p.startswith("CRÍTICO")],
        "proveniencia": prov,
        "evidencias": evid,
        "downloads": downloads,
    }
    return gold


REGRAS = {
    "ear_agregada": "EAR de um agregado (SIN) = soma das EAR verificadas em MWmês ÷ soma das EAR máximas em MWmês × 100. Nunca a média dos percentuais.",
    "ear_absoluta": "Energia armazenada em MWmês (energia que os reservatórios produziriam em um mês à potência média de 1 MW por MWmês), publicada pelo ONS por subsistema, REE, bacia e reservatório.",
    "capacidade": "Mudança de capacidade = variação diária da EAR máxima do subsistema acima de 0,01 MWmês; atribuída aos reservatórios cuja EAR máxima (parte própria no subsistema da usina, parte a jusante no subsistema a jusante) mudou, entrou ou saiu no mesmo dia. O resíduo do evento é publicado.",
    "faixa_sazonal": "Mediana, 10º e 90º percentis do valor do mesmo dia do calendário nos anos completos anteriores (subsistemas, SIN e bacias desde 2001; REE desde 2016, e desde 2018 os seis com perímetro mudado na reconfiguração de 29 e 30/12/2017). Anos com EAR máxima zero ficam fora; com menos de 5 anos não há faixa; periodo_base traz os anos usados. 29/02 usa 28/02.",
    "nao_se_aplica": "Recorte com EAR máxima zero (sem armazenamento): percentual, variações em pontos percentuais, faixa e percentil são nulos (não se aplica); a EAR em MWmês, zero, é publicada.",
    "captura": "Para cada ano vale a captura mais recente do arquivo anual do ONS por subsistema (silver principal ou recaptura do módulo); as revisões entre as duas nos últimos 30 dias são publicadas.",
    "ena_30d": "ENA de 30 dias em % da MLT = soma da ENA bruta diária (MWmed) nos 30 dias ÷ soma da MLT vigente em cada dia (MLT implícita = ENA ÷ percentual da MLT × 100) × 100.",
    "mlt": "A MLT não é fixa: muda quando usinas entram ou saem e quando o ONS troca a versão da referência. Mudança dentro do mês, em usina existente, é comparada por igualdade com a MLT vigente na mesma data 1 e 2 anos antes: retorno a uma versão anterior ou versão nova. Comparação entre anos pela MLT do último dia do mês.",
    "precipitacao": "Precipitação da bacia = média ponderada pela área (cos(lat) × passo²) dos pontos de grade dentro do polígono do ONS; dia publicado só com ao menos 80% do peso com dado. Mês só com todos os dias.",
    "temperatura": "Temperatura da UF = média das células MERRA-2 mais populosas (até metade da população do estado, no máximo 6), ponderada pela população das sedes; subsistema e SIN = média das UFs ponderada pela população (Censo 2022); dia publicado com ao menos 90% da população coberta.",
    "anomalia": f"Anomalia = valor ÷ média do mesmo mês (ou mesma janela) em {BASE_CLIMA_TXT} − 1, em %, para a chuva; diferença em °C para a temperatura.",
    "balanco_reservatorio": "ΔV observado (hm³) = (volume útil % do fim − do início) ÷ 100 × volume útil total do cadastro; fluxos em hm³ = vazão (m³/s) × 86.400 s ÷ 10⁶; resíduo = ΔV observado − (afluência − defluência). Transferência publicada à parte, com resíduo alternativo. Fração de dias dentro do arredondamento na janela e na série disponível. Defluência não discriminada segundo a convenção do reservatório (defluência com ou sem as outras estruturas, detectada nos dados); convenção indeterminada = nulo.",
    "previsao": "PREVISÃO da rodada de 00Z do ECMWF IFS 0,25° (Open-Meteo, rodadas individuais), nos mesmos pontos e com as mesmas regras de agregação da estimativa; só dias completos com valor em todos os recortes; não publicada com mais de 48 horas.",
    "decomposicao_ear": "Variação da EAR do subsistema em 30 dias = soma das variações por reservatório (parte própria no subsistema da usina; parte a jusante no subsistema a jusante). A ENA, a geração hidráulica e a chuva aparecem como contexto e não fecham balanço com a EAR.",
}


def _valida(d):
    """Validação física e de esquema antes de publicar (seção 5.2 do contrato)."""
    p = []
    hoje = c.agora_date().isoformat()
    a = d["armazenamento"]
    for s in a["subsistemas"]:
        if s["ear_mwmes"] is None or s["ear_mwmes"] < 0 or s["ear_max_mwmes"] is None or s["ear_max_mwmes"] <= 0:
            p.append(f"CRÍTICO: EAR inválida em {s['sm']}")
        if s["ear_pct"] is not None and not (0 <= s["ear_pct"] <= 100.5):
            p.append(f"CRÍTICO: EAR fora de 0 a 100% em {s['sm']}")
    if d["dia_ear"] > hoje or d["dia_ena"] > hoje:
        p.append("CRÍTICO: data de referência no futuro")
    rec = d["reconciliacao_ear"]
    if rec["pct_publicado_vs_recalculado_max_pp"] is not None and rec["pct_publicado_vs_recalculado_max_pp"] > 0.01:
        p.append(f"percentual publicado difere do recalculado em até {_br(rec['pct_publicado_vs_recalculado_max_pp'], 5)} p.p.")
    for r in rec["reservatorios_por_subsistema"]:
        if r["diferenca_mwmes"] is not None and abs(r["diferenca_mwmes"]) > 0.05:
            p.append(f"soma dos reservatórios difere da EAR do {r['sm']} em {_br(r['diferenca_mwmes'], 3)} MWmês")
    ref_sin = rec["sin_mesma_captura_mwmes"] if rec["sin_mesma_captura_mwmes"] is not None else rec["sin_mwmes"]
    if rec["soma_bacias_mwmes"] is not None and abs(rec["soma_bacias_mwmes"] - ref_sin) > 0.05:
        p.append(f"soma das bacias difere da EAR do SIN da mesma captura em {_br(rec['soma_bacias_mwmes'] - ref_sin, 3)} MWmês")
    for x in rec["reservatorios_por_ano"]:
        p.append(f"{x['ano']} {x['sm']}: soma dos reservatórios difere do subsistema além de {_br(x['tolerancia_mwmes'])} MWmês em "
                 f"{x['dias_fora_ear']} dias (EAR, até {_br(x['max_dif_ear_mwmes'], 1)} MWmês) e {x['dias_fora_ear_max']} dias "
                 f"(EAR máxima, até {_br(x['max_dif_ear_max_mwmes'], 1)} MWmês)")
    for b in a["bacias"] + a["ree"]:
        if b["ear_pct"] is not None and b["ear_pct"] < 0:
            p.append(f"CRÍTICO: EAR negativa em {b['nome']}")
    for s in d["afluencia"]["subsistemas"]:
        if s["pct_mlt_30d"] is not None and s["pct_mlt_30d"] < 0:
            p.append(f"CRÍTICO: ENA negativa em {s['sm']}")
    cl_ = d.get("clima") or {}
    for b in cl_.get("precipitacao_bacias", []):
        for mes, mm in zip(b["mensal"]["m"], b["mensal"]["mm"]):
            if mm is not None and mm < 0:
                p.append(f"CRÍTICO: precipitação negativa em {b['bacia']} {mes}")
    for serie in d.get("_precip", {}).values():
        if any(v < 0 for v in serie.values()):
            p.append("CRÍTICO: precipitação diária negativa")
            break
    for t in cl_.get("temperatura", []):
        if t["media_30d_c"] is not None and not (-5 <= t["media_30d_c"] <= 40):
            p.append(f"CRÍTICO: temperatura fora do intervalo físico em {t['recorte']}")
    return p


def _proveniencias_e_evidencias(con, con_p, d, downloads):
    dia, fim_ena = d["dia_ear"], d["dia_ena"]
    snap_ear = _snap_captura(con, con_p, d.get("_captura_ear", {}), dia[:4], DS_EAR_SM, DS_EAR_SM_CONF)
    snap_ena = _snap_captura(con, con_p, d.get("_captura_ena", {}), fim_ena[:4], DS_ENA_SM, DS_ENA_SM_CONF)
    snap_ree = c.snapshot_de(con, DS_EAR_REE)
    snap_bac = c.snapshot_de(con, DS_EAR_BACIA)
    snap_ena_ree = c.snapshot_de(con, DS_ENA_REE)
    snap_ena_bac = c.snapshot_de(con, DS_ENA_BACIA)
    snap_res = c.snapshot_de(con, DS_EAR_RES)
    snap_ena_res = c.snapshot_de(con, DS_ENA_RES)
    snap_hidro = c.snapshot_de(con, DS_HIDRO)
    snap_pr = c.snapshot_de(con, DS_CLIMA_PR)
    snap_t = c.snapshot_de(con, DS_CLIMA_T)
    a = d["armazenamento"]
    af = d["afluencia"]
    ini = a["capacidade"]["inicio"]
    fonte_ear_sm = c.fonte_ons("ear-diario-por-subsistema", DS_EAR_SM, "EAR Diário por Subsistema")
    fonte_ena_sm = c.fonte_ons("ena-diario-por-subsistema", DS_ENA_SM, "ENA Diário por Subsistema")
    cap_txt = ("série montada com a captura mais recente de cada arquivo anual: recaptura do módulo nos anos "
               f"{', '.join(sorted(a_ for a_, e in d.get('_captura_ear', {}).items() if e['fonte'] == FONTE_RECAPTURA)) or 'nenhum'}; "
               "silver principal nos demais")
    cfg = d.get("_cfg_ree") or {}
    lim_ree = ("Reconfiguração dos REE em 29 e 30/12/2017 (9 para 12 REE): SUL, PARANA e NORTE perderam Iguaçu, Paranapanema "
               "e Manaus-Amapá; a base da faixa desses seis REE começa em 2018, a dos demais em 2016.")
    fim_ree, fim_bac = af.get("dia_ree"), af.get("dia_bacias")
    prov = {
        "ear_sin": _prov("EAR do SIN em MWmês e em % da EAR máxima", "CALCULADO", fonte_ear_sm, "MWmês e % da EAR máxima",
                         "diária", {"inicio": dia, "fim": dia}, snap_ear, [LIM_ONS,
                         "O Sudeste/Centro-Oeste concentra cerca de 70% da capacidade e domina o agregado.",
                         "A faixa sazonal em % compara anos com capacidades diferentes (a EAR máxima do SIN variou cerca de 19% "
                         "entre 2001 e 2025 no mesmo dia do calendário): capacidade_mudou_na_base sinaliza, e a faixa em MWmês vem ao lado."],
                         formula="EAR_SIN% = Σ EAR(s) ÷ Σ EARmax(s) × 100, s ∈ {SE, S, NE, N}",
                         transformacoes=["soma das EAR e das EAR máximas dos quatro subsistemas", cap_txt],
                         cobertura={"inicio": ini, "fim": dia}),
        "capacidade": _prov("Mudanças da EAR máxima e atribuição por reservatório", "CALCULADO",
                            _fonte_ons("ear_res", "EAR Diário por Reservatório", "EAR_DIARIO_RESERVATORIOS_2000 a 2026 (Parquet)"),
                            "MWmês", "por evento", {"inicio": ini, "fim": dia}, snap_res,
                            [LIM_ONS, "A EAR máxima do ONS é uma capacidade em energia: muda com a entrada de usinas a jusante "
                             "(produtibilidade acumulada) mesmo sem mudança no volume do reservatório."],
                            formula="evento = EARmax(s, d) − EARmax(s, d−1); atribuição = Σ variações por reservatório no mesmo dia; resíduo = evento − atribuição",
                            download="/energia/series/agua_capacidade_eventos.csv"),
        "ear_ree": _prov("EAR por REE", "OBSERVADO", _fonte_ons("ear_ree", "EAR Diário por REE", "EAR_DIARIO_REE_2016 a 2026 (CSV)"),
                         "MWmês e %", "diária", {"inicio": dia, "fim": dia}, snap_ree,
                         [LIM_ONS, lim_ree,
                          "REE sem armazenamento (ITAIPU) têm EAR máxima zero: percentual, faixa e percentil não se aplicam e ficam nulos."],
                         download="/energia/series/agua_ear_recortes_diario.csv",
                         cobertura={"inicio": "2016-01-01", "fim": dia}),
        "ear_bacia": _prov("EAR por bacia", "OBSERVADO", _fonte_ons("ear_bacia", "EAR Diário por Bacia", "EAR_DIARIO_BACIAS_2000 a 2026 (CSV)"),
                           "MWmês e %", "diária", {"inicio": dia, "fim": dia}, snap_bac,
                           [LIM_ONS, "Bacias com EAR máxima zero (só usinas a fio d'água) aparecem sem percentual, sem faixa e sem percentil (não se aplica)."],
                           download="/energia/series/agua_ear_recortes_diario.csv",
                           cobertura={"inicio": "2000-01-01", "fim": dia}),
        "ena_30d": _prov("ENA de 30 dias em % da MLT (subsistemas e SIN)", "CALCULADO", fonte_ena_sm, "% da MLT",
                         "diária (janela de 30 dias)", {"inicio": _dmenos(fim_ena, 29), "fim": fim_ena}, snap_ena,
                         [LIM_ONS, "A MLT muda ao longo do tempo (usinas novas, versões novas e retornos a versões anteriores); a razão usa a MLT vigente em cada dia.",
                          "A unidade das colunas _mwmed é MWmed (média do dia), conferida pela soma das usinas; o dicionário por subsistema diz MWmês."],
                         formula="ENA30 = Σ ENA(d) ÷ Σ MLT(d) × 100; MLT(d) = ENA(d) ÷ %MLT(d) × 100",
                         transformacoes=["MLT implícita diária", "soma de 30 dias do numerador e do denominador",
                                         cap_txt.replace("arquivo anual", "arquivo anual de ENA")],
                         cobertura=_faixa_anos(af["subsistemas"])),
        "ena_30d_ree": _prov("ENA de 30 dias em % da MLT por REE", "CALCULADO",
                             _fonte_ons("ena_ree", "ENA Diário por REE", "ENA_DIARIO_REE_2016 a 2026 (CSV)"), "% da MLT",
                             "diária (janela de 30 dias)", {"inicio": _dmenos(fim_ree, 29), "fim": fim_ree} if fim_ree else None,
                             snap_ena_ree, [LIM_ONS, lim_ree.replace("faixa", "faixa da ENA de 30 dias"),
                                            "O arquivo por REE nomeia a coluna do REE como nom_reservatorioee (o dicionário diz nom_ree)."],
                             formula="ENA30 = Σ ENA(d) ÷ Σ MLT(d) × 100; MLT(d) = ENA(d) ÷ %MLT(d) × 100",
                             transformacoes=["MLT implícita diária", "soma de 30 dias do numerador e do denominador"],
                             download="/energia/series/agua_ear_recortes_diario.csv", cobertura=_faixa_anos(af["ree"])),
        "ena_30d_bacia": _prov("ENA de 30 dias em % da MLT por bacia", "CALCULADO",
                               _fonte_ons("ena_bacia", "ENA Diário por Bacia", "ENA_DIARIO_BACIAS_2000 a 2026 (CSV)"), "% da MLT",
                               "diária (janela de 30 dias)", {"inicio": _dmenos(fim_bac, 29), "fim": fim_bac} if fim_bac else None,
                               snap_ena_bac, [LIM_ONS, "As afluências que o ONS agrupa em outras do Sul e outras do Sudeste (nomes no arquivo com hífen) só existem no arquivo de 2000 e ficam sem valor recente.",
                                              "Bacias com poucos anos na base (menos de 5) ficam sem faixa e sem percentil."],
                               formula="ENA30 = Σ ENA(d) ÷ Σ MLT(d) × 100; MLT(d) = ENA(d) ÷ %MLT(d) × 100",
                               transformacoes=["MLT implícita diária", "soma de 30 dias do numerador e do denominador"],
                               download="/energia/series/agua_ear_recortes_diario.csv", cobertura=_faixa_anos(af["bacias"])),
        "mlt": _prov("Mudanças da MLT por usina", "OBSERVADO",
                     _fonte_ons("ena_res", "ENA Diário por Reservatório", "ENA_DIARIO_RESERVATORIOS_2000 a 2026 (CSV até 2020, Parquet desde 2021)"),
                     "MWmed", "por evento", {"inicio": "2000-01-01", "fim": fim_ena}, snap_ena_res,
                     [LIM_ONS, "O ONS não informa, nos dicionários nem nas notas dos conjuntos, o período histórico usado no cálculo da MLT: "
                      "a versão é inferida das mudanças observadas nos arquivos, comparadas por igualdade com versões anteriores."],
                     download="/energia/series/agua_mlt_mudancas.csv"),
    }
    if d.get("reservatorios"):
        r = d["reservatorios"]
        prov["balanco"] = _prov("Balanço hídrico de 30 dias por reservatório", "CALCULADO",
                                _fonte_ons("hidro_res", "Dados Hidráulicos por Reservatório, base diária", "DADOS_HIDROLOGICOS_RES_2025 e 2026 (Parquet)"),
                                "hm³", "janela de 30 dias", {"inicio": r["inicio"], "fim": r["fim"]}, snap_hidro,
                                [LIM_ONS, "A afluência publicada pelo ONS é, na maioria dos reservatórios, calculada pelo balanço "
                                 "(defluência + variação do volume): resíduo perto de zero decorre da construção, não confirma a medição.",
                                 "A convenção de sinal da vazão transferida não está no dicionário; o resíduo com transferência é publicado à parte.",
                                 "Volume útil total vem do cadastro atual do ONS e é aplicado a toda a janela."],
                                formula="resíduo = (V%fim − V%início) ÷ 100 × Vútil − Σ (Qafl − Qdefl) × 0,0864",
                                download="/energia/series/agua_reservatorios.csv")
    if d.get("clima"):
        fonte_pr = {"orgao": "NASA", "dataset": "POWER Daily API, parâmetro IMERG_PRECTOT", "recurso": "um arquivo JSON por ponto e janela",
                    "url_dataset": cl.POWER_DOCS, "url_primaria": cl.POWER, "licenca": LICENCA_POWER}
        fonte_t = {"orgao": "NASA", "dataset": "POWER Daily API, parâmetros T2M, T2M_MAX, T2M_MIN", "recurso": "um arquivo JSON por célula e janela",
                   "url_dataset": cl.POWER_DOCS, "url_primaria": cl.POWER, "licenca": LICENCA_POWER}
        prov["precipitacao"] = _prov("Precipitação média por bacia hidroenergética", "ESTIMADO", fonte_pr, "mm/dia",
                                     "diária (dia UTC)", {"inicio": cl.PRECIP_INICIO, "fim": d["dias_ref_pr"] if d.get("dias_ref_pr") else hoje_iso()},
                                     snap_pr, ["Estimativa por satélite (IMERG), não medição em estação.",
                                               "Os últimos ~3,5 meses usam a versão Late do IMERG, sem calibração por pluviômetros (marcados como preliminares).",
                                               "A média da bacia é estimada por amostragem em grade (1°, adensada em bacias pequenas), não pela integral da área."],
                                     formula="P(bacia, d) = Σ w_i P_i(d) ÷ Σ w_i, w_i = cos(lat_i) × passo²",
                                     download="/energia/series/agua_precipitacao_bacias_diario.csv")
        prov["temperatura"] = _prov("Temperatura do ar por subsistema e SIN", "ESTIMADO", fonte_t, "°C", "diária (hora solar local)",
                                    {"inicio": cl.TEMP_INICIO, "fim": d.get("dias_ref_t") or hoje_iso()}, snap_t,
                                    ["Reanálise (MERRA-2) e análise operacional (GEOS-IT nos meses mais recentes), não medição em estação.",
                                     "O mapeamento UF → subsistema é o de 2026 (conferido contra a carga por área do ONS) e é aplicado a toda a série; "
                                     "Acre, Rondônia, Amazonas, Amapá e Roraima entraram no SIN depois de 2001.",
                                     "Temperatura das células mais populosas, não média da área do estado."],
                                    formula="T(UF) = Σ pop_c T_c ÷ Σ pop_c; T(s) = Σ pop_UF T(UF) ÷ Σ pop_UF",
                                    download="/energia/series/clima_diario.csv")
    pv = (d.get("clima") or {}).get("previsao")
    if pv:
        snap_prev = c.snapshot_de(con, DS_PREV)
        prov["previsao"] = _prov(
            "Previsão de chuva por bacia e de temperatura por subsistema", "PREVISTO",
            {"orgao": "Open-Meteo (modelo do ECMWF)", "dataset": "API de previsão, modelo ecmwf_ifs025 (ECMWF IFS 0,25°)",
             "recurso": "um arquivo JSON por lote de até 100 pontos e o meta.json da rodada", "url_dataset": cl.OPENMETEO_DOC,
             "url_primaria": cl.OPENMETEO_PREV, "licenca": LICENCA_OPENMETEO},
            "mm/dia e °C", "diária (dia UTC), a cada rodada", {"inicio": pv["d0"], "fim": _dmenos(pv["d0"], -(pv["n_dias"] - 1))},
            snap_prev,
            [f"PREVISÃO emitida em {pv['emitida_em']} (inicialização do modelo): não é observação e é substituída a cada rodada.",
             "Ponto de grade do modelo (0,25°) mais próximo de cada ponto da bacia; chuva de modelo tem viés próprio, "
             "diferente do da estimativa por satélite.",
             "Não há avaliação de acerto desta previsão neste módulo; as rodadas ficam guardadas para avaliação futura."],
            transformacoes=["média ponderada pela área (chuva) e pela população (temperatura), mesmas regras da estimativa"],
            download="/energia/series/agua_previsao.csv")
    return prov, _evidencias(con, con_p, d, downloads)


def hoje_iso():
    return c.agora_date().isoformat()


def _evidencias(con, con_p, d, downloads):
    out = {}
    dia = d["dia_ear"]
    a = d["armazenamento"]
    sin = next(s for s in a["subsistemas"] if s["sm"] == "SIN")
    mw, mx, pct, _ = d["_ear"]
    esc = d.get("_captura_ear", {}).get(dia[:4]) or {}
    con_e, ds_e = (con, DS_EAR_SM_CONF) if esc.get("fonte") == FONTE_RECAPTURA else (con_p, DS_EAR_SM)
    v26 = base.ultima_vintage(con_e, ds_e, f"EAR_DIARIO_SUBSISTEMA_{dia[:4]}")
    rec = d["reconciliacao_ear"]
    testes = [
        ev.teste("SIN recalculado pelos quatro subsistemas", "aprovado",
                 f"Σ EAR = {_br(sum(mw[sm][dia] for sm in SMS), 3)} MWmês; Σ EARmax = {_br(sum(mx[sm][dia] for sm in SMS), 3)} MWmês"),
        ev.teste("Percentual publicado = EAR ÷ EARmax (todos os dias e subsistemas)",
                 "aprovado" if rec["pct_publicado_vs_recalculado_max_pp"] <= 0.01 else "ressalva",
                 f"maior diferença {_br(rec['pct_publicado_vs_recalculado_max_pp'], 5)} p.p. em {_br(rec['pares_conferidos'], 0)} pares"),
        ev.teste("Média simples dos percentuais não é usada", "aprovado",
                 f"média simples daria {_br(rec['media_simples_dos_percentuais'])}%, {_br(rec['diferenca_media_simples_pp'])} p.p. de diferença"),
    ]
    ref_sin = rec["sin_mwmes"]
    dif_bac = None if rec["soma_bacias_mwmes"] is None else rec["soma_bacias_mwmes"] - ref_sin
    sp = rec.get("sin_silver_principal_mwmes")
    recon = ev.reconciliacao(
        f"Soma das EAR das {rec['n_bacias']} bacias (conjunto EAR por bacia do ONS) = {_br(rec['soma_bacias_mwmes'], 3)} MWmês; "
        f"soma dos {rec['n_ree']} REE = {_br(rec['soma_ree_mwmes'], 3)} MWmês; SIN pelos subsistemas ({esc.get('fonte') or 'captura'} "
        f"de {esc.get('capturado_em') or 'data não registrada'}) = {_br(ref_sin, 3)} MWmês"
        + (f"; o silver principal, capturado antes, tinha {_br(sp, 3)} MWmês no mesmo dia (revisão do ONS entre as capturas)"
           if sp is not None and abs(sp - ref_sin) > 0.0005 else ""),
        "aprovado" if dif_bac is not None and abs(dif_bac) <= 0.05 else "ressalva", "0,05 MWmês (arredondamento a 3 casas de até 23 parcelas)")
    out["ear_sin"] = ev.construir(
        indicador="EAR do SIN", valor_exibido=f"{sin['ear_pct']:.1f}%".replace(".", ","), valor_calculo=100.0 * mw["SIN"][dia] / mx["SIN"][dia],
        unidade="% da EAR máxima", periodo={"inicio": dia, "fim": dia}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas (SE/CO, S, NE, N)", fonte=_fonte_arquivos("ONS", "EAR Diário por Subsistema",
                                                                         "https://dados.ons.org.br/dataset/ear-diario-por-subsistema", [v26]),
        chaves_origem=[f"{ds_e}:ear_mwmes.{sm}@{dia}" for sm in SMS] + [f"{ds_e}:ear_max_mwmes.{sm}@{dia}" for sm in SMS],
        formula="Σ EAR(s) ÷ Σ EARmax(s) × 100",
        numerador={"descricao": "soma das EAR verificadas (MWmês)", "valor": mw["SIN"][dia]},
        denominador={"descricao": "soma das EAR máximas (MWmês)", "valor": mx["SIN"][dia]},
        pesos="capacidade de armazenamento (EAR máxima) de cada subsistema", cobertura="4 de 4 subsistemas no dia",
        tratamento_ausencia="dia sem algum subsistema não tem SIN", revisoes=c.snapshot_de(con_e, ds_e).get("revisoes"),
        testes=testes, reconciliacao=recon,
        download=[{"rotulo": "EAR e ENA diárias por subsistema e SIN, com a captura usada (CSV)",
                   "url": "/energia/series/agua_subsistemas_diario.csv"}],
        reproducao=REPRODUCAO)
    out["ear_sin_mwmes"] = ev.construir(
        indicador="Energia armazenada no SIN", valor_exibido=f"{mw['SIN'][dia]:,.0f} MWmês".replace(",", "."),
        valor_calculo=mw["SIN"][dia], unidade="MWmês", periodo={"inicio": dia, "fim": dia}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas", fonte=_fonte_arquivos("ONS", "EAR Diário por Subsistema",
                                                        "https://dados.ons.org.br/dataset/ear-diario-por-subsistema", [v26]),
        chaves_origem=[f"{ds_e}:ear_mwmes.{sm}@{dia}" for sm in SMS], formula="Σ EAR(s)",
        cobertura="4 de 4 subsistemas", tratamento_ausencia="dia sem algum subsistema não tem SIN",
        revisoes=c.snapshot_de(con_e, ds_e).get("revisoes"), testes=testes[:1], reconciliacao=recon,
        download=[{"rotulo": "Série mensal e diária em MWmês (gold)", "url": "/energia/gold/agua_detalhe.json"},
                  {"rotulo": "EAR por REE e bacia (CSV)", "url": "/energia/series/agua_ear_recortes_diario.csv"}],
        reproducao=REPRODUCAO)
    cap = a["capacidade"]
    vs = [base.ultima_vintage(con, DS_EAR_RES, f"EAR_DIARIO_RESERVATORIOS_{ano}") for ano in (int(dia[:4]) - 1, int(dia[:4]))]
    out["capacidade"] = ev.construir(
        indicador="Mudanças da capacidade de armazenamento (EAR máxima) desde 2000", valor_exibido=f"{cap['n_eventos']} mudanças",
        valor_calculo=float(cap["n_eventos"]), unidade="eventos", periodo={"inicio": cap["inicio"], "fim": dia},
        entidade="subsistemas do SIN", universo="dias com variação da EAR máxima acima de 0,01 MWmês",
        fonte=_fonte_arquivos("ONS", "EAR Diário por Reservatório", "https://dados.ons.org.br/dataset/ear-diario-por-reservatorio", vs),
        consulta=f"variações de ear_max_mwmes.<s> em {DS_EAR_SM}; atribuição por earmax_proprio/jusante.<cod> em {DS_EAR_RES}",
        formula="evento = EARmax(s,d) − EARmax(s,d−1); resíduo = evento − Σ variações dos reservatórios",
        cobertura=(f"{cap['eventos_fechados']} de {cap['n_eventos']} eventos com resíduo dentro da tolerância "
                   "(10 MWmês até 2017, valores inteiros; 0,05 MWmês desde 2018)"),
        tratamento_ausencia="reservatório ausente do arquivo não contribui para a EAR máxima (entrada e saída explícitas)",
        revisoes=c.snapshot_de(con, DS_EAR_RES).get("revisoes"),
        testes=[ev.teste("Eventos atribuídos a reservatórios", "aprovado" if cap["eventos_fechados"] == cap["n_eventos"] else "ressalva",
                         f"{cap['eventos_fechados']} de {cap['n_eventos']} fecham; maior resíduo {_br(cap['maior_residuo_mwmes'], 3)} MWmês")],
        download=[{"rotulo": "Mudanças da capacidade (CSV)", "url": "/energia/series/agua_capacidade_eventos.csv"}],
        reproducao=REPRODUCAO)
    # ENA 30 dias do SIN
    fim = d["dia_ena"]
    ena = d["_ena_sm"]["SIN"]
    v, num, den = _ena_janela(d["_ena_sm"]["SIN"], fim)
    def _vint_ena(ano):
        e = d.get("_captura_ena", {}).get(ano) or {}
        cn, ds_ = (con, DS_ENA_SM_CONF) if e.get("fonte") == FONTE_RECAPTURA else (con_p, DS_ENA_SM)
        return base.ultima_vintage(cn, ds_, f"ENA_DIARIO_SUBSISTEMA_{ano}"), cn, ds_
    ve, con_n, ds_n = _vint_ena(fim[:4])
    ve_ant, _c2, _d2 = _vint_ena(_dmenos(fim, 29)[:4])
    unid = d["afluencia"]["mlt"]["unidade"]
    out["ena_30d_sin"] = ev.construir(
        indicador="ENA bruta de 30 dias do SIN", valor_exibido=None if v is None else f"{v:.1f}% da MLT".replace(".", ","),
        valor_calculo=v, unidade="% da MLT", periodo={"inicio": _dmenos(fim, 29), "fim": fim}, entidade="Sistema Interligado Nacional",
        universo="4 subsistemas × 30 dias", fonte=_fonte_arquivos("ONS", "ENA Diário por Subsistema",
                                                                 "https://dados.ons.org.br/dataset/ena-diario-por-subsistema",
                                                                 [ve] if ve_ant is None or ve_ant["vintage_id"] == (ve or {}).get("vintage_id") else [ve_ant, ve]),
        consulta=f"ena_bruta_mwmed.<s> e ena_bruta_pct_mlt.<s> em {ds_n}, d de {_dmenos(fim, 29)} a {fim} (captura mais recente de cada ano)",
        formula="Σ ENA(d) ÷ Σ MLT(d) × 100, MLT(d) = ENA(d) ÷ %MLT(d) × 100",
        numerador={"descricao": "soma das ENA brutas diárias dos 4 subsistemas (MWmed·dia)", "valor": num},
        denominador={"descricao": "soma das MLT implícitas diárias (MWmed·dia)", "valor": den},
        pesos="MLT de cada dia e subsistema (razão de somas)", cobertura="30 de 30 dias, 4 de 4 subsistemas",
        tratamento_ausencia="janela com dia ausente não é calculada", revisoes=c.snapshot_de(con_n, ds_n).get("revisoes"),
        testes=[ev.teste("Razão de somas, não média de percentuais", "aprovado",
                         f"média simples dos % diários daria {_br(d['_ena_media_simples_sin'])}%"),
                # se uma das duas colunas estivesse em MWmês e a outra em MWmed, a razão seria de 28 a 31
                # vezes (dias do mês); diferença máxima abaixo de 10% descarta unidade trocada
                ev.teste("Unidade MWmed conferida pela soma das usinas",
                         "aprovado" if all(u["dias"] and u["max_dif_rel_pct"] is not None and u["max_dif_rel_pct"] < 10 for u in unid) else "reprovado",
                         "; ".join(f"{u['sm']}: {_br(u['dias_dentro_0_1pct'], 0)} de {_br(u['dias'], 0)} dias até 0,1%, maior diferença {_br(u['max_dif_rel_pct'], 3)}%"
                                   for u in unid))],
        download=[{"rotulo": "EAR e ENA diárias por subsistema e SIN, com a captura usada (CSV)",
                   "url": "/energia/series/agua_subsistemas_diario.csv"},
                  {"rotulo": "Mudanças da MLT por usina (CSV)", "url": "/energia/series/agua_mlt_mudancas.csv"}],
        reproducao=REPRODUCAO)
    # ENA armazenável de 30 dias do SIN: mesma razão de somas, com as colunas armazenáveis
    # publicadas pelo ONS (número de destaque próprio na página, por isso ficha própria)
    sin_e = d["_ena_sm"]["SIN"]
    va, num_a, den_a = _ena_janela(sin_e, fim, chave_mw="arm", chave_mlt="mlt_arm")
    ks_a = _dias_janela(fim)
    if va is not None:
        diarios_a = [100.0 * sin_e["arm"][k] / sin_e["mlt_arm"][k] for k in ks_a if sin_e["mlt_arm"].get(k)]
        # armazenável é a parte da afluência que os reservatórios podem guardar: nunca acima da bruta
        acima = [k for k in ks_a if sin_e["arm"][k] > sin_e["mw"][k] + 0.01]
        out["ena_arm_30d_sin"] = ev.construir(
            indicador="ENA armazenável de 30 dias do SIN", valor_exibido=f"{va:.1f}% da MLT armazenável".replace(".", ","),
            valor_calculo=va, unidade="% da MLT armazenável", periodo={"inicio": _dmenos(fim, 29), "fim": fim},
            entidade="Sistema Interligado Nacional", universo="4 subsistemas × 30 dias",
            fonte=_fonte_arquivos("ONS", "ENA Diário por Subsistema", "https://dados.ons.org.br/dataset/ena-diario-por-subsistema",
                                  [ve] if ve_ant is None or ve_ant["vintage_id"] == (ve or {}).get("vintage_id") else [ve_ant, ve]),
            consulta=f"ena_arm_mwmed.<s> e ena_arm_pct_mlt.<s> em {ds_n}, d de {_dmenos(fim, 29)} a {fim} (captura mais recente de cada ano)",
            formula="Σ ENAarm(d) ÷ Σ MLTarm(d) × 100, MLTarm(d) = ENAarm(d) ÷ %MLTarm(d) × 100",
            numerador={"descricao": "soma das ENA armazenáveis diárias dos 4 subsistemas (MWmed·dia)", "valor": num_a},
            denominador={"descricao": "soma das MLT armazenáveis implícitas diárias (MWmed·dia)", "valor": den_a},
            pesos="MLT armazenável de cada dia e subsistema (razão de somas)", cobertura="30 de 30 dias, 4 de 4 subsistemas",
            tratamento_ausencia="janela com dia ausente não é calculada", revisoes=c.snapshot_de(con_n, ds_n).get("revisoes"),
            testes=[ev.teste("Razão de somas, não média de percentuais", "aprovado",
                             f"média simples dos % diários do SIN daria {_br(sum(diarios_a) / len(diarios_a))}%" if diarios_a else "sem dia com MLT armazenável"),
                    ev.teste("ENA armazenável não passa da ENA bruta em nenhum dia da janela",
                             "aprovado" if not acima else "ressalva",
                             "nenhum dia acima" if not acima else f"{len(acima)} dias acima: {', '.join(c.data_br(k) for k in acima[:5])}")],
            download=[{"rotulo": "EAR e ENA diárias por subsistema e SIN, com a captura usada (CSV)",
                       "url": "/energia/series/agua_subsistemas_diario.csv"}],
            reproducao=REPRODUCAO)
    # versão da MLT: conjunto aberto × relatório do PMO (PDF)
    comp_pmo, pmo = d.get("_pmo_mlt", ([], {}))
    ult = max((x["mes"] for x in comp_pmo if x["dif_fim_pct"] is not None), default=None)
    x = next((y for y in comp_pmo if y["mes"] == ult and y["sm"] == "SE"), None) if ult else None
    if x:
        vp = base.ultima_vintage(con, DS_PMO, x["relatorio"])
        ctl = base.registros_como_estavam_em(con, DS_CONTROLE).get(vp["vintage_id"], {}) if vp else {}
        edic = json.loads(ctl.get("edicao") or "{}")
        tab = d["afluencia"]["mlt"]["pmo"]
        out["mlt_pmo_vs_aberto"] = ev.construir(
            indicador="Diferença entre a MLT do conjunto aberto e a MLT do PMO (Sudeste/Centro-Oeste)",
            valor_exibido=("+" if x["dif_fim_pct"] >= 0 else "") + f"{_br(x['dif_fim_pct'])}%", valor_calculo=x["dif_fim_pct"], unidade="%",
            periodo={"inicio": f"{ult}-01", "fim": f"{ult}-{calendar.monthrange(int(ult[:4]), int(ult[5:7]))[1]:02d}"},
            entidade="Sudeste/Centro-Oeste", universo="MLT mensal da ENA bruta",
            fonte=_fonte_arquivos("ONS", "Relatório Executivo do PMO (tabela MLT das ENAs)", ACERVO, [vp]),
            extracao_pdf={"documento": x["relatorio"], "edicao": f"PMO {edic.get('mes', '?')} {edic.get('ano', '?')}, semana {edic.get('semana', '?')}",
                          "pagina": str(ctl.get("pagina")), "conferencia": "pdftotext -layout; tabela de 4 subsistemas × 2 meses lida inteira (8 valores) ou descartada"},
            consulta=f"mlt_mwmed.SE@{ult} em {DS_PMO}; MLT implícita do último dia do mês no conjunto ENA diário",
            formula="(MLT implícita do conjunto aberto ÷ MLT do PMO − 1) × 100",
            numerador={"descricao": "MLT implícita do conjunto aberto no último dia do mês (MWmed)", "valor": x["aberto_fim_mwmed"]},
            denominador={"descricao": "MLT publicada no PMO (MWmed)", "valor": x["pmo_mwmed"]},
            cobertura=f"{len(tab['meses_coincidentes'])} meses coincidentes e {len(tab['meses_divergentes'])} divergentes entre os conferidos",
            tratamento_ausencia="mês sem relatório do PMO coletado não é comparado",
            revisoes=None,
            testes=[ev.teste("Períodos em que a MLT do conjunto coincide com a do PMO", "ressalva",
                             "dias com os 4 subsistemas dentro de " + str(tab["tolerancia_pct"]).replace(".", ",") + "%: " +
                             (", ".join(f"{c.data_br(p_['inicio'])} a {c.data_br(p_['fim'])}" for p_ in tab["dias_coincidentes"]) or "nenhum")),
                    ev.teste("Meses com MLT diferente da do PMO", "ressalva",
                             f"meses fora da tolerância: {', '.join(c.mes_br(x_) for x_ in tab['meses_divergentes']) or 'nenhum'}; maior diferença {_br(tab['maior_diferenca_pct'], 3)}%")],
            download=[{"rotulo": "Mudanças da MLT por usina (CSV)", "url": "/energia/series/agua_mlt_mudancas.csv"}],
            reproducao=REPRODUCAO)
    # clima
    cli = d.get("clima")
    if cli and cli["temperatura"]:
        t = next((x for x in cli["temperatura"] if x["recorte"] == "SIN"), None)
        vt = base.ultima_vintage(con, DS_CLIMA_T, "temperatura")
        if t and vt:
            out["temperatura_sin_30d"] = ev.construir(
                indicador="Anomalia da temperatura do SIN em 30 dias", valor_exibido=None if t["anomalia_30d_c"] is None else
                ("+" if t["anomalia_30d_c"] >= 0 else "") + f"{_br(t['anomalia_30d_c'], 1)} °C", valor_calculo=t["anomalia_30d_c"], unidade="°C",
                periodo={"inicio": _dmenos(t["dia"], 29), "fim": t["dia"]}, entidade="SIN (27 UF, ponderadas pela população)",
                universo=f"{cli['totais']['celulas_temperatura']} células MERRA-2", fonte=_fonte_arquivos(
                    "NASA", "POWER Daily API (T2M), agregado pela Scrutiniums", cl.POWER, [vt]),
                consulta=f"t2m_c.SIN em {DS_CLIMA_T}; manifesto do agregado lista as células e o sha256 de cada arquivo",
                formula=f"média dos 30 dias − média da mesma janela em {BASE_CLIMA_TXT}",
                cobertura=f"{t['anos_base']} anos na base", tratamento_ausencia="dia com menos de 90% da população coberta fica sem valor",
                revisoes=c.snapshot_de(con, DS_CLIMA_T).get("revisoes"),
                testes=[ev.teste("Intervalo físico", "aprovado", "média de 30 dias entre −5 e 40 °C"),
                        ev.teste("Validação contra estação", "ressalva", "INMET inacessível em 30/09/2026: sem conferência com observação")],
                download=[{"rotulo": "Temperatura diária por subsistema (CSV)", "url": "/energia/series/clima_diario.csv"},
                          {"rotulo": "Manifesto espacial (CSV)", "url": "/energia/series/agua_clima_pontos.csv"}],
                reproducao=REPRODUCAO)
    if cli and cli["precipitacao_bacias"]:
        maior = max(a["bacias"], key=lambda b: b["ear_max_mwmes"] or 0)["nome"]
        b = next((x for x in cli["precipitacao_bacias"] if x["bacia"] == maior), None)
        vb = base.ultima_vintage(con, DS_CLIMA_PR, f"bacia_{maior}")
        if b and vb:
            val = cli["validacao_estacoes"]
            out["precipitacao_maior_bacia_30d"] = ev.construir(
                indicador=f"Chuva de 30 dias na bacia {maior}", valor_exibido=None if b["mm_30d"] is None else f"{b['mm_30d']:.0f} mm",
                valor_calculo=b["mm_30d"], unidade="mm", periodo={"inicio": _dmenos(b["dia"], 29), "fim": b["dia"]},
                entidade=f"bacia {maior} (maior EAR máxima)", universo="pontos de grade dentro do polígono do ONS",
                fonte=_fonte_arquivos("NASA", "POWER Daily API (IMERG_PRECTOT), agregado pela Scrutiniums", cl.POWER, [vb]),
                consulta=f"precip_mm.{maior} em {DS_CLIMA_PR}", formula="Σ dos 30 dias de P(bacia, d)",
                cobertura=f"cobertura média {_br(b['cobertura_media_pct'], 1)}% do peso da bacia",
                tratamento_ausencia="dia com menos de 80% do peso com dado fica sem valor; janela incompleta não soma",
                revisoes=c.snapshot_de(con, DS_CLIMA_PR).get("revisoes"),
                testes=[ev.teste("Conferência com estações" + (f" ({_periodo_meses(val['periodo'])})" if val.get("periodo") else ""), "ressalva",
                                 f"correlação mensal {_br(val['correlacao_geral'])} em {val['pares']} pares bacia-mês; viés {_br(val['vies_geral_pct'], 1)}%")],
                download=[{"rotulo": "Precipitação diária por bacia (CSV)", "url": "/energia/series/agua_precipitacao_bacias_diario.csv"}],
                reproducao=REPRODUCAO)
    res = d.get("reservatorios")
    if res and d.get("_res_lista"):
        x = next((r for r in sorted(d["_res_lista"], key=lambda r: -(r["vol_util_total_hm3"] or 0)) if r["balanco_calculado"]), None)
        vh = base.ultima_vintage(con, DS_HIDRO, f"DADOS_HIDROLOGICOS_RES_{res['fim'][:4]}")
        if x and vh:
            out["balanco_maior_reservatorio"] = ev.construir(
                indicador=f"Resíduo do balanço de 30 dias em {x['nome']}", valor_exibido=f"{_br(x['residuo_hm3'])} hm³",
                valor_calculo=x["residuo_hm3"], unidade="hm³", periodo={"inicio": res["inicio"], "fim": res["fim"]},
                entidade=f"reservatório {x['nome']} ({x['id']})", universo="maior volume útil do cadastro com balanço calculado",
                fonte=_fonte_arquivos("ONS", "Dados Hidráulicos por Reservatório", URLS["hidro_res"], [vh]),
                chaves_origem=[f"{DS_HIDRO}:{s}.{x['id']}@{res['inicio']}..{res['fim']}" for s in ("vol_util_pct", "q_afluente", "q_defluente")],
                formula=(f"ΔV observado ({_br(x['dv_obs_hm3'])} hm³) − (Σ afluência {_br(x['afluencia_hm3'])} hm³ − "
                         f"Σ defluência {_br(x['defluencia_hm3'])} hm³)"),
                cobertura=f"{JANELA} de {JANELA} dias", tratamento_ausencia="dia sem vazão ou volume impede o balanço (sem preenchimento)",
                revisoes=c.snapshot_de(con, DS_HIDRO).get("revisoes"),
                testes=[ev.teste("Fechamento diário dentro do arredondamento", "aprovado" if (x["dias_residuo_dentro_tolerancia_pct"] or 0) >= 95 else "ressalva",
                                 f"{_br(x['dias_residuo_dentro_tolerancia_pct'], 1)}% de {x['dias_residuo_avaliados']} dias com |resíduo| ≤ {_br(x['tolerancia_dia_hm3'], 3)} hm³")],
                download=[{"rotulo": "Balanço por reservatório (CSV)", "url": "/energia/series/agua_reservatorios.csv"}],
                reproducao=REPRODUCAO)
        # quantos reservatórios fecham o balanço por construção (número de destaque do P020)
        calc = [r for r in d["_res_lista"] if r["balanco_calculado"]]
        per = res.get("periodo_fecham_por_construcao")
        if calc and per:
            fecha = [r for r in calc if (r["serie_dias_residuo_dentro_tolerancia_pct"] or 0) >= 95]
            nao = sorted((r for r in calc if r not in fecha), key=lambda r: r["serie_dias_residuo_dentro_tolerancia_pct"] or 0)
            vs = [base.ultima_vintage(con, DS_HIDRO, f"DADOS_HIDROLOGICOS_RES_{ano}") for ano in range(int(per["inicio"][:4]), int(per["fim"][:4]) + 1)]
            vs = [v_ for v_ in vs if v_]
            if vs:
                out["fecham_por_construcao"] = ev.construir(
                    indicador="Reservatórios que fecham o balanço por construção", valor_exibido=f"{len(fecha)} de {len(calc)}",
                    valor_calculo=float(len(fecha)), unidade="reservatórios", periodo=dict(per),
                    entidade="reservatórios dos dados hidráulicos do ONS com balanço calculado",
                    universo=f"{len(calc)} reservatórios com balanço, de {len(d['_res_lista'])} nos dados hidráulicos",
                    fonte=_fonte_arquivos("ONS", "Dados Hidráulicos por Reservatório", URLS["hidro_res"], vs),
                    consulta=(f"vol_util_pct, q_afluente e q_defluente de cada reservatório em {DS_HIDRO}, "
                              f"{per['inicio']} a {per['fim']}; volume útil total do cadastro em {DS_CAD}"),
                    formula=("fecha por construção ⇔ dias com |ΔV(d) − (afluência(d) − defluência(d)) × 0,0864| dentro da "
                             "tolerância ÷ dias avaliados ≥ 95%; tolerância diária = 0,01% do volume útil + 0,002 hm³"),
                    numerador={"descricao": "reservatórios com ao menos 95% dos dias dentro do arredondamento", "valor": float(len(fecha))},
                    denominador={"descricao": "reservatórios com balanço calculado", "valor": float(len(calc))},
                    cobertura=(f"{len(calc)} de {len(d['_res_lista'])} reservatórios com balanço; "
                               f"na janela de 30 dias, {res['n_fecham_na_janela']} fecham"),
                    tratamento_ausencia="reservatório sem volume útil no cadastro ou sem volume em % fica fora (motivo no CSV); dia sem dado não é avaliado",
                    revisoes=c.snapshot_de(con, DS_HIDRO).get("revisoes"),
                    testes=[ev.teste("Reservatórios que não fecham por construção", "ressalva" if nao else "aprovado",
                                     "; ".join(f"{r['nome']} {_br(r['serie_dias_residuo_dentro_tolerancia_pct'], 1)}% de "
                                               f"{r['serie_dias_residuo_avaliados']} dias" for r in nao) or "nenhum"),
                            ev.teste("Fechamento não é prova de medição", "ressalva",
                                     "a afluência publicada é calculada pelo próprio balanço nesses reservatórios: o resíduo perto "
                                     "de zero confirma a conta, não a vazão")],
                    download=[{"rotulo": "Balanço por reservatório, com a fração de dias de cada um (CSV)", "url": "/energia/series/agua_reservatorios.csv"},
                              {"rotulo": "Dados hidráulicos diários por reservatório (CSV)", "url": "/energia/series/agua_reservatorios_diario.csv"}],
                    reproducao=REPRODUCAO)
    return out
