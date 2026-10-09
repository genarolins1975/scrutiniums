"""Módulo Território: o que acontece na minha região (P002, mapa geográfico transversal).

Gold: public/energia/gold/territorio.json; índice municipal e usinas em
public/energia/series/territorio_*.json (carregados sob demanda pelo mapa) e os CSV de
download. Método, fontes, conferências e limitações em
docs/observatorios/energia/modulos/territorio.md.

Por que este módulo não coleta indicador novo: cada número que o mapa mostra já é
publicado pelo módulo que o explica (Perdas, Qualidade, Conta de luz, Transição, Expansão,
Inclusão, PLD, Água e clima), com a sua proveniência e a sua evidência. O que faltava era
o ÍNDICE que liga essas peças ao território sem trocar a granularidade de nenhuma delas:

- município IBGE → distribuidora(s) que o atendem, com o estado do vínculo publicado pelo
  módulo Perdas (relação oficial conjunto elétrico × município da ANEEL, conferida no
  cadastro de MMGD);
- município → conjuntos elétricos (IndQual Município, processado pelo módulo Qualidade);
- município → submercado, pela UF: a EPE publica o subsistema de cada UF (camada oficial
  do WebMap, fontes/epe_territorio.py) e a pertença de cada área de carga do ONS ao
  submercado é PROVADA aqui pelo fechamento da carga verificada (fontes/ons_territorio.py).
  Não há tabela oficial município → submercado: o município cuja sede (ou a maior parte da
  população) é atendida por sistema isolado do PASI fica FORA do SIN, sem submercado;
- usina (ponto do SIGA) → município(s) que o SIGA declara, pelo nome oficial do IBGE, com
  a coordenada conferida na malha municipal de qualidade máxima do IBGE.

A regra que o índice inteiro obedece (critério de aceite do P002): nenhum indicador é
atribuído a uma granularidade inferior à de origem. Taxa de perdas, tarifa, DEC e FEC da
distribuidora ficam na tabela de distribuidoras e o município só guarda a REFERÊNCIA a
quem o atende; DEC do conjunto fica na tabela de conjuntos; PLD e EAR ficam no
submercado; a potência de uma usina declarada em vários municípios nunca é somada a
nenhum deles. A validação final (`_valida_granularidade`) reprova a publicação se algum
campo de uma tabela tiver grão diferente do grão da tabela.
"""
import csv
import hashlib
import json
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia import geo  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import epe_territorio as et  # noqa: E402
from pipeline.energia.fontes import ibge_territorio as it  # noqa: E402
from pipeline.energia.fontes import ons_territorio as ot  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "territorio.json"
FAMILIA = "territorio"
HREF = "/setor-eletrico/territorio"
PAGINA = {"rotulo": "Minha região", "href": HREF}
DS_AREAS = "territorio_ons_areas_carga"
DS_EPE = "territorio_epe_webmap"
DS_MALHA = "territorio_ibge_malha_maxima"
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py territorio --sem-coleta"

# Conferência das áreas de carga: refeita quando a última tem 30 dias ou mais (a lista de
# áreas e a sua pertença mudam raramente; dois dias por rodada, 34 consultas cada).
MAX_IDADE_AREAS_DIAS = 30
DEFASAGEM_DIAS = 15     # dia conferido fica antes da janela em que o ONS ainda consiste a carga
PAUSA_S = 0.2
MAX_IDADE_EPE_DIAS = 30      # camada oficial UF → subsistema e localidades isoladas
MAX_IDADE_MALHA_DIAS = 180   # malha municipal: o IBGE revisa uma vez por ano

# Município fora do SIN (submercado não se aplica): a sede é localidade isolada do PASI (o
# PASI dá à localidade-sede o nome do município) ou a população declarada das localidades
# isoladas é ao menos metade da população estimada do município. Nos 89 municípios com
# localidade isolada no ciclo 2025, a razão fica em 84% ou mais (73 municípios) ou em 9%
# ou menos (15; 1 sem população declarada): 50% fica longe dos dois grupos. As duas
# populações têm bases diferentes (a do PASI passa a do IBGE em Uiramutã), por isso a razão
# só separa os grupos, não mede a parte exata fora do SIN.
LIMIAR_POP_ISOLADA = 0.5
# Registros do SIGA de até 10 kW em operação (16.035 em 30/09/2026, quase todos UFV de 1 a
# 3 kW de propriedade da Equatorial Pará e da Energisa MS, em nome de moradores e escolas)
# ficam em colunas próprias: somados às usinas, dominariam a contagem municipal.
LIMITE_REGISTRO_KW = 10.0

SERIES_URL = "/energia/series/"
ARQ_MUN_JSON = "territorio_municipios.json"
ARQ_USI_JSON = "territorio_usinas.json"
ARQ_MUN_CSV = "territorio_municipios.csv"
ARQ_DIST_CSV = "territorio_distribuidoras.csv"
ARQ_CONJ_CSV = "territorio_conjuntos.csv"
ARQ_USI_CSV = "territorio_usinas.csv"
ARQ_AREAS_CSV = "territorio_areas_carga.csv"
ARQ_ALT_CSV = "territorio_areas_alternativas.csv"
U = {k: SERIES_URL + v for k, v in {
    "mun_json": ARQ_MUN_JSON, "usi_json": ARQ_USI_JSON, "mun_csv": ARQ_MUN_CSV, "dist_csv": ARQ_DIST_CSV,
    "conj_csv": ARQ_CONJ_CSV, "usi_csv": ARQ_USI_CSV, "areas_csv": ARQ_AREAS_CSV, "alt_csv": ARQ_ALT_CSV}.items()}

MODULOS = {
    "perdas": {"rotulo": "Perdas", "href": "/setor-eletrico/perdas"},
    "qualidade": {"rotulo": "Qualidade do serviço", "href": "/setor-eletrico/qualidade"},
    "conta": {"rotulo": "Conta de luz", "href": "/setor-eletrico/conta-de-luz"},
    "transicao": {"rotulo": "Transição e ambiente", "href": "/setor-eletrico/transicao"},
    "expansao": {"rotulo": "Expansão", "href": "/setor-eletrico/expansao"},
    "inclusao": {"rotulo": "Inclusão energética", "href": "/setor-eletrico/inclusao-energetica"},
    "pld": {"rotulo": "PLD", "href": "/setor-eletrico/pld"},
    "agua": {"rotulo": "Água e clima", "href": "/setor-eletrico/agua-e-clima"},
    "carga": {"rotulo": "Carga", "href": "/setor-eletrico/carga"},
}

# Insumos: arquivos publicados por outros módulos (e a malha do IBGE). O sha256 de cada um
# entra na gold, para que o índice possa ser refeito sobre exatamente os mesmos arquivos.
RAIZ_PUB = os.path.join(base.RAIZ, "public", "energia")
INSUMOS = {
    "perdas_gold": ("gold", "perdas.json", "perdas", True),
    "perdas_municipios": ("series", "perdas_municipios.json", "perdas", True),
    "qualidade_gold": ("gold", "qualidade.json", "qualidade", False),
    "qualidade_municipios": ("series", "qualidade_municipios.csv", "qualidade", False),
    "qualidade_conjuntos": ("series", "qualidade_conjuntos_anual_2020_2029.csv", "qualidade", False),
    "transicao_gold": ("gold", "transicao.json", "transicao", False),
    "transicao_municipios": ("series", "transicao_mmgd_municipios.csv", "transicao", False),
    "expansao_gold": ("gold", "expansao.json", "expansao", False),
    "expansao_usinas": ("series", "expansao_usinas_siga.csv", "expansao", False),
    "conta_gold": ("gold", "conta.json", "conta", False),
    "inclusao_gold": ("gold", "inclusao.json", "inclusao", False),
    "inclusao_municipios": ("series", "inclusao_municipios.csv", "inclusao", False),
    "inclusao_lpt": ("series", "inclusao_luz_para_todos_municipios.csv", "inclusao", False),
    "inclusao_isolados": ("series", "inclusao_sistemas_isolados_pontos.json", "inclusao", False),
    "agua_gold": ("gold", "agua_detalhe.json", "agua", False),
    "carga_detalhe_gold": ("gold", "carga_detalhe.json", "carga", False),
    "pld_gold": ("gold", "pld.json", "pld", False),
    "malha_municipios": ("geo", "municipios.json", "geo", True),
    "malha_uf": ("geo", "uf.json", "geo", True),
}
GOLD_DO_CSV = {"qualidade_municipios": "qualidade_gold", "qualidade_conjuntos": "qualidade_gold",
               "transicao_municipios": "transicao_gold", "expansao_usinas": "expansao_gold",
               "inclusao_municipios": "inclusao_gold", "inclusao_lpt": "inclusao_gold"}

REGISTRO = {
    "id": "territorio",
    "gold": GOLD,
    "familia": FAMILIA,
    "ordem": 97,
    "datasets": [
        {"orgao": "ONS", "nome": "carga-energia-verificada", "slug": "ons-carga-verificada-areas-territorio",
         "dataset_silver": DS_AREAS, "titulo": "Carga de Energia Verificada por área de carga (API): pertença das áreas ao submercado",
         "estado": "UTILIZADO EM VALIDAÇÃO", "url": ot.URL_DATASET, "licenca": c.LICENCA_ONS, "tema": "carga",
         "descricao": ("Carga média de dois dias por área de carga (26 áreas geoelétricas, 4 áreas de perdas e os 4 "
                       "submercados) para provar, pelo fechamento das somas, a que submercado pertence cada área e, "
                       "por ela, cada UF e cada município do mapa territorial."),
         "paginas": [PAGINA], "downloads": [U["areas_csv"], U["alt_csv"]], "quebras": []},
        {"orgao": "EPE", "nome": "webmap-epe-subsistemas", "slug": "epe-webmap-subsistemas-isolados-territorio",
         "dataset_silver": DS_EPE, "titulo": "WebMap EPE: Unidades da federação e Subsistemas do SIN (camada 24) e Sistemas Isolados (camada 27)",
         "estado": "UTILIZADO EM INDICADOR", "url": et.URL_WEBMAP, "licenca": et.LICENCA_EPE, "tema": "rede",
         "descricao": ("Correspondência oficial UF → subsistema do SIN (atributos das 27 feições da camada 24) e localidades "
                       "atendidas por sistema isolado (camada 27), consultadas no serviço ArcGIS do WebMap da EPE."),
         "paginas": [PAGINA], "downloads": [U["mun_csv"]], "quebras": []},
        {"orgao": "IBGE", "nome": "malhas-municipais-qualidade-maxima", "slug": "ibge-malha-municipal-maxima-territorio",
         "dataset_silver": DS_MALHA, "titulo": "Malha municipal do IBGE em qualidade máxima (API de malhas v4, por UF)",
         "estado": "UTILIZADO EM VALIDAÇÃO", "url": it.DOC_MALHAS, "licenca": "Uso livre com citação da fonte (IBGE)", "tema": "contexto",
         "descricao": ("Polígonos municipais sem generalização, usados só para conferir se a coordenada de cada usina do SIGA "
                       "cai no município que o SIGA declara (a malha do mapa é simplificada demais para isso)."),
         "paginas": [PAGINA], "downloads": [U["usi_csv"]], "quebras": []},
    ],
    "arquivos": {
        U["mun_json"]: ("Índice territorial por município (carregado sob demanda pelo mapa): campos em 'campos'; dist = "
                        "[índice da distribuidora na gold, estado do vínculo 0/1/2 do módulo Perdas]; conj = conjuntos "
                        "elétricos (valores na tabela 'conjuntos', do conjunto inteiro); sm nulo com sm_estado 'fora_do_sin' = "
                        "submercado não se aplica (sede ou maior parte da população em sistema isolado); indicadores do próprio "
                        "município (MMGD, Tarifa Social, Luz para Todos, usinas declaradas só nele sem os registros de até 10 kW, "
                        "registros de até 10 kW à parte, localidades isoladas e isol_sede = 1 quando a sede é localidade isolada). "
                        "Nulo = ausência."),
        U["usi_json"]: ("Usinas do SIGA como pontos: ceg; nome; tipo; estagio; uf (principal); mw_fiscalizado; mw_outorgado; "
                        "x e y na grade da malha publicada (Albers, 100 m; nulos sem coordenada); municipios (códigos IBGE "
                        "declarados pelo SIGA e reconhecidos); n_declarados (municípios que o SIGA declara, reconhecidos ou não: só "
                        "usina com 1 entra na soma municipal); coord_no_declarado (1 = a coordenada cai num dos municípios declarados, 0 = "
                        "não, nulo = sem coordenada ou sem município reconhecido; conferido na malha de qualidade máxima do IBGE); "
                        "outorga (Concessão, Autorização ou Registro, como o SIGA publica)."),
        U["mun_csv"]: ("codigo_ibge; municipio; uf; submercado (da UF; vazio quando não se aplica) e estado_submercado (provado, "
                       "provado_com_area_sem_carga, com_localidade_isolada = há localidade do município em sistema isolado, mas a sede "
                       "e a maior parte da população estão no SIN; fora_do_sin = a sede é localidade isolada do PASI ou as localidades "
                       "isoladas somam ao menos 50% da população estimada, e o submercado não se aplica; nao_provado); "
                       "sede_isolada (1 = a sede é localidade isolada); localidades_isoladas e populacao_isolada (EPE, PASI); distribuidoras (SIGLA:CNPJ:estado, "
                       "separadas por |; estado 1 = confirmado no cadastro de MMGD, 0 = relação sem confirmação, 2 = só pelo "
                       "cadastro de MMGD); conjuntos (ids separados por espaço); populacao (IBGE, estimativa); MMGD (unidades, "
                       "kW, W por habitante); Tarifa Social (faturas e desconto em R$ no mês da CDE; razão proxy em %); Luz "
                       "para Todos (domicílios atendidos no período); usinas declaradas só no município (contagem e MW por "
                       "estágio, sem os registros de até 10 kW); registros do SIGA de até 10 kW em operação declarados só no "
                       "município (contagem e kW); usinas declaradas nele e em outros (contagem, potência não somada). Vazio = ausência."),
        U["dist_csv"]: ("cnpj; sigla; nome; municipios por estado do vínculo; municipios_fora_do_sin e municipios_com_localidade_isolada "
                        "(entre os de vínculo 1 ou 2); ufs; submercados (só municípios no SIN); indicadores da distribuidora "
                        "inteira com o período de cada um (perdas, com perdas_ano_parcial = 1 quando o ano não tem os 12 meses; DEC "
                        "e FEC; tarifa B1; MMGD cadastrada; Tarifa Social). Vazio = a fonte não publica para essa distribuidora."),
        U["conj_csv"]: ("conjunto (id da ANEEL); nome; cnpj e sigla de quem publicou; ano; meses; dec_h; fec; limites; ucs_media; "
                        "municipios = municípios IBGE que a relação IndQual liga ao conjunto. Valores do conjunto inteiro."),
        U["usi_csv"]: ("ceg; nome; tipo; estagio; uf; municipios_siga (texto da fonte); municipios_ibge (códigos reconhecidos); "
                       "via (nome_atual, grafia_antiga); lat; lon; municipio_da_coordenada (ponto em polígono na malha municipal "
                       "do IBGE indicada em malha_conferencia: maxima = qualidade máxima, sem simplificação; simplificada = malha "
                       "do mapa, aproximada; não substitui o declarado); coord_no_declarado; mw_fiscalizado; mw_outorgado; outorga "
                       "(Concessão, Autorização, Registro); registro_ate_10kw (1 = registro em operação de até 10 kW, fora da "
                       "soma de usinas do município)."),
        U["areas_csv"]: ("dia; area (código do ONS); nome (dicionário); tipo (submercado, geoeletrica, perdas); ufs; "
                         "submercado_hipotese; carga_media_mwmed (média das meias horas do dia); meias_horas; veredito "
                         "(provada, indeterminada = carga zero, ambigua = uma alternativa também fecha, reprovada) e, nas linhas "
                         "de submercado, soma_areas_mwmed (médias do dia), residuo_medio_mwmed, residuo_mediana_abs_mwmed e "
                         "residuo_max_abs_mwmed (resíduo por meia hora) e tolerancia_mwmed (aplicada à mediana)."),
        U["alt_csv"]: ("dia; alternativa (mover uma área para outro submercado ou trocar duas áreas de submercados diferentes); "
                       "areas; mediana_abs_meia_hora_mwmed (maior, entre os submercados alterados, mediana do resíduo absoluto por "
                       "meia hora: a estatística da prova); residuo_medias_dia_mwmed (maior resíduo absoluto pelas médias do dia, "
                       "publicado para comparação); tolerancia_mwmed; fecha (1 = a alternativa ficaria dentro da tolerância pela "
                       "mediana por meia hora)."),
    },
}

# ---------------------------------------------------------------- grãos e regras

GRAOS = [
    {"id": "submercado", "rotulo": "Submercado", "nivel": 6,
     "descricao": "Região elétrica do SIN em que o preço de curto prazo (PLD) e o armazenamento (EAR) são publicados. Sudeste/Centro-Oeste, Sul, Nordeste e Norte.",
     "geometria": "UFs do submercado (malha de UF do IBGE), pela pertença provada das áreas de carga do ONS",
     "rotulo_no_municipio": "do submercado a que a UF do município pertence (área de carga do ONS); não é um valor do município"},
    {"id": "uf", "rotulo": "Unidade da federação", "nivel": 5,
     "descricao": "Estado ou Distrito Federal (malha do IBGE).", "geometria": "malha de UF do IBGE (public/energia/geo/uf.json)",
     "rotulo_no_municipio": "da UF do município"},
    {"id": "distribuidora", "rotulo": "Área de atuação da distribuidora", "nivel": 4,
     "descricao": "Conjunto dos municípios que a relação oficial da ANEEL liga a uma distribuidora (CNPJ). Uma distribuidora pode atender várias UFs; um município pode ter mais de uma distribuidora.",
     "geometria": "municípios inteiros do IBGE agrupados pela relação oficial (não há polígono oficial de concessão acessível)",
     "rotulo_no_municipio": "da distribuidora que atende o município (valor da área inteira da distribuidora, não do município)"},
    {"id": "conjunto", "rotulo": "Conjunto elétrico", "nivel": 3,
     "descricao": "Agrupamento de unidades consumidoras definido pela ANEEL para apurar DEC e FEC. Pode cobrir vários municípios ou só parte de um.",
     "geometria": "sem polígono público; aparece como lista no município",
     "rotulo_no_municipio": "do conjunto elétrico que atende o município (o conjunto pode cobrir outros municípios ou só parte deste)"},
    {"id": "municipio", "rotulo": "Município", "nivel": 2,
     "descricao": "Município do IBGE (malha revisão 2025).", "geometria": "malha municipal do IBGE (public/energia/geo/municipios.json)",
     "rotulo_no_municipio": "do município"},
    {"id": "usina", "rotulo": "Usina", "nivel": 1,
     "descricao": "Empreendimento de geração do SIGA, desenhado como ponto pela coordenada da fonte.",
     "geometria": "ponto (latitude e longitude do SIGA, centróide aproximado)",
     "rotulo_no_municipio": "da usina (ponto); uma usina declarada em vários municípios não tem a potência repartida"},
]
GRAO = {g["id"]: g for g in GRAOS}

REGRA_GRANULARIDADE = (
    "Nenhum indicador é atribuído a uma granularidade inferior à de origem. Cada número fica na tabela do seu grão "
    "(submercado, UF, distribuidora, conjunto, município, usina). O município guarda referências a quem o atende e só "
    "mostra como 'do município' o que a fonte publica por município. Agregar para cima só vale quando a soma é da mesma "
    "grandeza e cobre o universo inteiro (ex.: potência das usinas declaradas em um único município); taxa, tarifa e DEC "
    "nunca descem para o município.")

COMPATIBILIDADE = [
    {"de": "municipio", "para": "distribuidora", "valida": True,
     "regra": "Pela relação oficial conjunto × município (módulo Perdas). Um vínculo leva à distribuidora; com mais de um, a seleção lista as distribuidoras e não escolhe por conta própria.",
     "condicao": "vínculo com estado 1 (confirmado) ou 2 (só pelo cadastro de MMGD); estado 0 aparece com ressalva"},
    {"de": "municipio", "para": "conjunto", "valida": True,
     "regra": "Pela relação IndQual Município (módulo Qualidade). O DEC exibido é do conjunto inteiro.", "condicao": None},
    {"de": "municipio", "para": "submercado", "valida": True,
     "regra": "Pela UF do município (subsistema da UF na camada oficial da EPE, com a pertença das áreas de carga do ONS provada pela soma). Município cuja sede é localidade isolada do PASI, ou com ao menos metade da população em localidades isoladas, está fora do SIN: o submercado não se aplica a ele.",
     "condicao": "estado 'provado' ou 'provado_com_area_sem_carga'; com 'com_localidade_isolada' a seleção leva ao submercado da UF com aviso de que localidades do município estão fora do SIN; com 'fora_do_sin' a seleção não passa (submercado nulo, não se aplica)"},
    {"de": "municipio", "para": "usina", "valida": True,
     "regra": "Usinas que o SIGA declara no município (nome oficial do IBGE). A coordenada é conferida, não decide.", "condicao": None},
    {"de": "distribuidora", "para": "municipio", "valida": True,
     "regra": "A área da distribuidora é o conjunto dos municípios da relação; selecionar a distribuidora destaca os municípios, não seleciona um deles.", "condicao": None},
    {"de": "distribuidora", "para": "submercado", "valida": True,
     "regra": "Submercados das UFs dos municípios de vínculo válido da distribuidora que estão no SIN; com mais de um, a seleção lista todos. Municípios fora do SIN não contam e são informados à parte (area.fora_do_sin).",
     "condicao": "só quando todos os municípios de vínculo válido no SIN estão em UFs com pertença provada; com parte_fora_do_sin, a seleção leva ao submercado com aviso de que municípios da área estão fora do SIN"},
    {"de": "submercado", "para": "uf", "valida": True, "regra": "UFs cujas áreas de carga o ONS soma no submercado.", "condicao": None},
    {"de": "submercado", "para": "municipio", "valida": False,
     "regra": "Selecionar um submercado não seleciona município: o submercado contém centenas de municípios e os seus números não são de nenhum deles.", "condicao": None},
    {"de": "usina", "para": "municipio", "valida": True, "regra": "Municípios declarados pelo SIGA para a usina (um ou mais).", "condicao": None},
    {"de": "usina", "para": "submercado", "valida": False,
     "regra": "Não se aplica: o submercado de uma usina depende do ponto de conexão à rede, que o SIGA não publica; a UF ou o município da usina não decidem.", "condicao": None},
    {"de": "usina", "para": "distribuidora", "valida": False,
     "regra": "Não se aplica: usina de geração centralizada não é atendida pela distribuidora do município em que está.", "condicao": None},
]

# Catálogo dos indicadores que o mapa mostra, cada um no seu grão. `campo` diz onde está o
# valor: na gold (tabela do grão) ou no índice municipal (coluna).
INDICADORES = [
    # submercado
    {"id": "pld_dia", "rotulo": "PLD médio do dia", "grao": "submercado", "unidade": "R$/MWh", "natureza": "CALCULADO", "modulo": "pld", "campo": "submercados[].indicadores.pld_dia"},
    {"id": "pld_mes", "rotulo": "PLD médio do mês", "grao": "submercado", "unidade": "R$/MWh", "natureza": "CALCULADO", "modulo": "pld", "campo": "submercados[].indicadores.pld_mes"},
    {"id": "ear_pct", "rotulo": "Energia armazenada (EAR)", "grao": "submercado", "unidade": "% da EAR máxima", "natureza": "OBSERVADO", "modulo": "agua", "campo": "submercados[].indicadores.ear"},
    {"id": "mmgd_ons_mwmed", "rotulo": "Carga atendida por MMGD (estimativa do ONS)", "grao": "submercado", "unidade": "MWmed", "natureza": "ESTIMADO", "modulo": "transicao", "campo": "submercados[].indicadores.mmgd_ons"},
    # UF
    {"id": "uf_capacidade_mw", "rotulo": "Capacidade instalada em operação (UF principal da usina)", "grao": "uf", "unidade": "MW", "natureza": "CALCULADO", "modulo": "expansao", "campo": "ufs[].indicadores.capacidade"},
    {"id": "uf_tsee_faturas", "rotulo": "Faturas com Tarifa Social", "grao": "uf", "unidade": "faturas no mês", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "ufs[].indicadores.tsee"},
    {"id": "uf_isolados", "rotulo": "Localidades em sistema isolado", "grao": "uf", "unidade": "localidades; habitantes", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "ufs[].indicadores.isolados"},
    # distribuidora
    {"id": "dist_perdas_taxa", "rotulo": "Perdas totais sobre a energia injetada", "grao": "distribuidora", "unidade": "%", "natureza": "CALCULADO", "modulo": "perdas", "campo": "distribuidoras[].indicadores.perdas"},
    {"id": "dist_dec", "rotulo": "DEC apurado da distribuidora", "grao": "distribuidora", "unidade": "horas por unidade consumidora no ano", "natureza": "CALCULADO", "modulo": "qualidade", "campo": "distribuidoras[].indicadores.qualidade"},
    {"id": "dist_fec", "rotulo": "FEC apurado da distribuidora", "grao": "distribuidora", "unidade": "interrupções por unidade consumidora no ano", "natureza": "CALCULADO", "modulo": "qualidade", "campo": "distribuidoras[].indicadores.qualidade"},
    {"id": "dist_tarifa_b1", "rotulo": "Tarifa residencial B1 vigente (TE + TUSD, sem tributos)", "grao": "distribuidora", "unidade": "R$/MWh", "natureza": "CALCULADO", "modulo": "conta", "campo": "distribuidoras[].indicadores.tarifa"},
    {"id": "dist_mmgd", "rotulo": "MMGD cadastrada na distribuidora", "grao": "distribuidora", "unidade": "unidades; MW", "natureza": "OBSERVADO", "modulo": "transicao", "campo": "distribuidoras[].indicadores.mmgd"},
    {"id": "dist_tsee", "rotulo": "Unidades com Tarifa Social na distribuidora", "grao": "distribuidora", "unidade": "unidades consumidoras; % das residenciais", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "distribuidoras[].indicadores.tsee"},
    # conjunto
    {"id": "conj_dec", "rotulo": "DEC anual do conjunto elétrico", "grao": "conjunto", "unidade": "horas por unidade consumidora no ano", "natureza": "OBSERVADO", "modulo": "qualidade", "campo": "municipios.conjuntos[].dec_h"},
    {"id": "conj_fec", "rotulo": "FEC anual do conjunto elétrico", "grao": "conjunto", "unidade": "interrupções por unidade consumidora no ano", "natureza": "OBSERVADO", "modulo": "qualidade", "campo": "municipios.conjuntos[].fec"},
    # município
    {"id": "mun_populacao", "rotulo": "População estimada", "grao": "municipio", "unidade": "habitantes", "natureza": "ESTIMADO", "modulo": "transicao", "campo": "municipios.pop"},
    {"id": "mun_mmgd_unidades", "rotulo": "Unidades de MMGD cadastradas", "grao": "municipio", "unidade": "unidades", "natureza": "OBSERVADO", "modulo": "transicao", "campo": "municipios.mmgd_un"},
    {"id": "mun_mmgd_kw", "rotulo": "Potência de MMGD cadastrada", "grao": "municipio", "unidade": "kW", "natureza": "OBSERVADO", "modulo": "transicao", "campo": "municipios.mmgd_kw"},
    {"id": "mun_mmgd_w_hab", "rotulo": "Potência de MMGD por habitante", "grao": "municipio", "unidade": "W por habitante", "natureza": "CALCULADO", "modulo": "transicao", "campo": "municipios.mmgd_w_hab"},
    {"id": "mun_tsee_faturas", "rotulo": "Faturas com Tarifa Social", "grao": "municipio", "unidade": "faturas no mês", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "municipios.tsee_faturas"},
    {"id": "mun_tsee_desconto", "rotulo": "Desconto da Tarifa Social", "grao": "municipio", "unidade": "R$ no mês", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "municipios.tsee_desconto"},
    {"id": "mun_tsee_proxy", "rotulo": "Faturas com Tarifa Social por família de baixa renda no Cadastro Único (proxy)", "grao": "municipio", "unidade": "%", "natureza": "CALCULADO", "modulo": "inclusao", "campo": "municipios.tsee_proxy_pct"},
    {"id": "mun_lpt", "rotulo": "Domicílios atendidos pelo Luz para Todos", "grao": "municipio", "unidade": "domicílios", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "municipios.lpt_dom"},
    {"id": "mun_usinas_operacao", "rotulo": "Usinas em operação declaradas só neste município (sem os registros de até 10 kW)", "grao": "municipio", "unidade": "usinas; MW fiscalizados", "natureza": "CALCULADO", "modulo": "expansao", "campo": "municipios.usi_op_n e usi_op_mw"},
    {"id": "mun_registros_10kw", "rotulo": "Registros do SIGA de até 10 kW em operação declarados só neste município", "grao": "municipio", "unidade": "registros; kW fiscalizados", "natureza": "CALCULADO", "modulo": "expansao", "campo": "municipios.usi_reg_n e usi_reg_kw"},
    {"id": "mun_isolados", "rotulo": "Localidades atendidas por sistema isolado", "grao": "municipio", "unidade": "localidades; habitantes", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "municipios.isol_n e isol_pop"},
    # usina
    {"id": "usina_potencia", "rotulo": "Potência da usina", "grao": "usina", "unidade": "MW", "natureza": "OBSERVADO", "modulo": "expansao", "campo": "usinas.mw_fiscalizado e mw_outorgado"},
]

# Definição de cada indicador no catálogo de métricas (pipeline/energia/metricas/): a do
# módulo de origem quando ele a publica; None quando a definição está só na proveniência.
METRICA_DE = {
    "pld_dia": "visao_pld_media_diaria", "pld_mes": "pld_media_mensal_temporal", "ear_pct": "territorio_ear_subsistema_pct",
    "mmgd_ons_mwmed": "ons_mmgd_estimada_mwmed", "uf_capacidade_mw": "expansao_capacidade_operacao",
    "uf_tsee_faturas": "inclusao.cde_faturas_tsee", "uf_isolados": None,
    "dist_perdas_taxa": "perdas_taxa_total_injetada", "dist_dec": "qualidade_dec_distribuidora",
    "dist_fec": "qualidade_fec_distribuidora", "dist_tarifa_b1": "conta_tarifa_b1_aplicacao",
    "dist_mmgd": "mmgd_unidades", "dist_tsee": "inclusao.tsee_uc",
    "conj_dec": "qualidade_dec_conjunto", "conj_fec": "qualidade_fec_conjunto",
    "mun_populacao": None, "mun_mmgd_unidades": "mmgd_unidades", "mun_mmgd_kw": "mmgd_potencia_instalada",
    "mun_mmgd_w_hab": "mmgd_potencia_por_habitante", "mun_tsee_faturas": "inclusao.cde_faturas_tsee",
    "mun_tsee_desconto": "inclusao.cde_desconto_tsee", "mun_tsee_proxy": "inclusao.cobertura_proxy",
    "mun_lpt": "territorio_lpt_municipio", "mun_usinas_operacao": "territorio_usinas_municipio",
    "mun_registros_10kw": "territorio_registros_10kw_municipio",
    "mun_isolados": "territorio_localidades_isoladas_municipio", "usina_potencia": "expansao_capacidade_operacao",
}

# Colunas do índice municipal: grão de cada uma ("ref" = referência a outra tabela, sem valor)
CAMPOS_MUN = [
    ("ibge", "ref"), ("nome", "ref"), ("uf", "ref"), ("sm", "ref"), ("sm_estado", "ref"),
    ("dist", "ref"), ("conj", "ref"), ("usi_multi", "ref"),
    ("pop", "municipio"), ("mmgd_un", "municipio"), ("mmgd_kw", "municipio"), ("mmgd_w_hab", "municipio"),
    ("tsee_faturas", "municipio"), ("tsee_desconto", "municipio"), ("tsee_proxy_pct", "municipio"), ("tsee_base_pequena", "municipio"),
    ("lpt_dom", "municipio"),
    ("usi_op_n", "municipio"), ("usi_op_mw", "municipio"), ("usi_cart_n", "municipio"), ("usi_cart_mw", "municipio"),
    ("usi_reg_n", "municipio"), ("usi_reg_kw", "municipio"),
    ("isol_n", "municipio"), ("isol_pop", "municipio"), ("isol_sede", "ref"),
]
CAMPOS_CONJ = [("nome", "ref"), ("dist", "ref"), ("ano", "ref"), ("meses", "conjunto"), ("dec_h", "conjunto"),
               ("fec", "conjunto"), ("dec_lim_h", "conjunto"), ("fec_lim", "conjunto"), ("ucs", "conjunto"), ("n_mun", "ref")]
CAMPOS_USI = [("ceg", "ref"), ("nome", "ref"), ("tipo", "ref"), ("estagio", "ref"), ("uf", "ref"),
              ("mw_fiscalizado", "usina"), ("mw_outorgado", "usina"), ("x", "ref"), ("y", "ref"),
              ("municipios", "ref"), ("n_declarados", "ref"), ("coord_no_declarado", "ref"), ("outorga", "ref")]


# ---------------------------------------------------------------- utilidades

def _caminho(tipo, nome):
    return os.path.join(RAIZ_PUB, tipo, nome)


def _sha256_arquivo(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def _num(v):
    """Texto do CSV publicado (ponto decimal; vazio = ausência) → float ou None."""
    if v is None:
        return None
    v = str(v).strip()
    if not v:
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return x


def _int(v):
    x = _num(v)
    return int(round(x)) if x is not None else None


def _le_csv(caminho):
    """Linhas de um CSV publicado do observatório (';', UTF-8), em fluxo."""
    with open(caminho, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f, delimiter=";"):
            yield row


def _escreve_compacto(nome, payload):
    """JSON sob demanda sem indentação: o mapa baixa o arquivo inteiro ao abrir a camada."""
    return base._escreve_atomico(os.path.join(base.SERIES, nome),
                                 json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False))


def _le_json(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def _gerado_em(obj):
    return obj.get("gerado_em") if isinstance(obj, dict) else None


def _dias_para_conferir(hoje):
    """Um dia útil (hoje − 15 dias, recuado para a sexta-feira anterior se cair no fim de
    semana) e o domingo anterior a ele: perfis de carga diferentes entre dia útil e domingo
    tornam improvável que uma troca de áreas feche por coincidência nos dois dias."""
    d1 = hoje - timedelta(days=DEFASAGEM_DIAS)
    while d1.weekday() >= 5:
        d1 -= timedelta(days=1)
    d2 = d1 - timedelta(days=(d1.weekday() + 1) % 7 or 7)
    return [d1.isoformat(), d2.isoformat()]


# ---------------------------------------------------------------- coleta (só a conferência das áreas)

def _ja_importada(con, vid):
    """Vintage já importada na versão atual (série semi-horária)."""
    return con.execute("SELECT 1 FROM observacoes WHERE vintage_id=? AND serie LIKE 'meia_hora.%' LIMIT 1",
                       (vid,)).fetchone() is not None


def _importa_area(con, vint, area):
    """Carga global de cada meia hora (ref = fim do intervalo em UTC, como a API publica).
    Versão 1 guardava só a média do dia (séries carga_global_mwmed e intervalos, que ficam
    no silver e não são mais lidas): a prova passou a ser meia hora a meia hora."""
    with base.abre_bronze(vint["arquivo"]) as f:
        texto = f.read().decode("utf-8", "replace")
    serie = ot.serie_do_dia(texto)
    obs = [(f"meia_hora.{area}", t, v) for t, v in serie.items()]
    if obs:
        base.grava_observacoes(con, DS_AREAS, vint["vintage_id"], obs)
    else:
        base.registra_coleta(con, DS_AREAS, vint["recurso"], False, "resposta sem valor de carga")


def _importa_pendentes(con):
    """Importa (ou reimporta na versão atual) as vintages ainda sem série semi-horária."""
    n = 0
    for v in base.vintages_do_dataset(con, DS_AREAS):
        if "@" not in v["recurso"] or _ja_importada(con, v["vintage_id"]):
            continue
        try:
            _importa_area(con, v, v["recurso"].split("@")[0])
            n += 1
        except Exception as e:  # resposta ilegível: registrada, sem número inventado
            base.registra_coleta(con, DS_AREAS, v["recurso"], False, f"leitura: {e}")
    con.commit()
    return n


def _ultima_conferencia(con):
    row = con.execute("SELECT MAX(capturado_em) FROM vintages WHERE dataset=?", (DS_AREAS,)).fetchone()
    return row[0] if row else None


def _baixa_lote(con, orgao, dataset, itens, max_idade_dias):
    """Baixa (recurso, url) para o bronze com a política de recoleta de ckan.baixar_recurso."""
    st = {"dataset": dataset, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    for recurso, url in itens:
        res = ckan.baixar_recurso(con, orgao=orgao, dataset=dataset, recurso=recurso, url=url, ext="json",
                                  max_idade_dias=max_idade_dias)
        chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
        if chave:
            st[chave] += 1
        else:
            st["falhas"].append(f"{recurso}: {res['detalhe'][:120]}")
        if res["status"] in ("nova", "identica"):
            time.sleep(PAUSA_S)
    con.commit()
    return st


def coletar(con, ctx):
    """Camadas da EPE (UF → subsistema e localidades isoladas), malha municipal de qualidade
    máxima do IBGE (uma consulta por UF, recoletada a cada 180 dias) e carga verificada de
    dois dias por área de carga, esta só quando a última conferência tem 30 dias ou mais.
    Falha de rede fica registrada; a gold usa a captura anterior."""
    st = {"dataset": DS_AREAS, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    if ctx.get("sem_rede"):
        st["pulada"] = "sem rede"
        return st
    st["epe"] = _baixa_lote(con, "EPE", DS_EPE, [("camada24_subsistemas", et.URL_SUBSISTEMAS),
                                                 ("camada27_isolados", et.URL_ISOLADOS)], MAX_IDADE_EPE_DIAS)
    st["malha_maxima"] = _baixa_lote(con, "IBGE", DS_MALHA, [(f"UF{cod}", it.URL_MALHA_MAXIMA.format(cod=cod))
                                                             for cod in sorted(it.CODIGOS_UF)], MAX_IDADE_MALHA_DIAS)
    st["reimportadas"] = _importa_pendentes(con)
    ultima = _ultima_conferencia(con)
    hoje = ctx["hoje"]
    if ultima:
        idade = hoje - c.d(ultima)
        if idade.days < MAX_IDADE_AREAS_DIAS and len(_dias_conferidos(con)) >= 2:
            st["pulada"] = f"conferência de {ultima[:10]} tem {idade.days} dias"
            return st
    for dia in _dias_para_conferir(hoje):
        for area in ot.TODAS_AS_AREAS:
            url = ot.URL_API.format(d=dia, a=area)
            res = ckan.baixar_recurso(con, orgao="ONS", dataset=DS_AREAS, recurso=f"{area}@{dia}", url=url,
                                      ext="json", max_idade_dias=3650)
            chave = {"nova": "novas", "identica": "identicas", "pulada": "puladas"}.get(res["status"])
            if chave:
                st[chave] += 1
            else:
                st["falhas"].append(f"{area}@{dia}: {res['detalhe'][:120]}")
            if res["status"] in ("nova", "identica"):
                time.sleep(PAUSA_S)
        con.commit()
    st["importadas"] = _importa_pendentes(con)
    return st


def _dias_conferidos(con):
    """Dias com as 34 áreas importadas, do mais recente para o mais antigo."""
    areas = defaultdict(set)
    for (rec,) in con.execute(
            """SELECT DISTINCT v.recurso FROM vintages v JOIN observacoes o ON o.vintage_id=v.vintage_id
               WHERE v.dataset=? AND o.serie LIKE 'meia_hora.%'""", (DS_AREAS,)):
        if "@" in rec:
            a, dia = rec.split("@", 1)
            areas[dia].add(a)
    return sorted([d for d, s_ in areas.items() if s_ >= set(ot.TODAS_AS_AREAS)], reverse=True)


def _series_do_dia(con, dia):
    """{área: {instante: MWmed}} vigentes para o dia (última captura de cada recurso)."""
    out = defaultdict(dict)
    for _rec, serie, ref, valor in con.execute(
            """SELECT v.recurso, o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? AND v.recurso LIKE ? AND o.serie LIKE 'meia_hora.%'
               ORDER BY v.capturado_em, o.rowid""", (DS_AREAS, f"%@{dia}")):
        out[serie.split(".", 1)[1]][ref] = valor
    return dict(out)


# ---------------------------------------------------------------- EPE e malha de qualidade máxima

def _le_vintage(con, dataset, recurso):
    """(texto JSON, vintage) da captura vigente de um recurso; (None, vintage) sem arquivo legível."""
    v = base.ultima_vintage(con, dataset, recurso)
    if not v or not v.get("arquivo"):
        return None, v
    try:
        with base.abre_bronze(v["arquivo"]) as f:
            return it.corpo_sem_gzip(f.read()).decode("utf-8"), v
    except OSError:
        return None, v


def _mapeamento_epe(con, nomes_uf):
    """UF → subsistema da camada 24 do WebMap da EPE, com a vintage; None sem captura."""
    texto, v = _le_vintage(con, DS_EPE, "camada24_subsistemas")
    if texto is None:
        return None
    try:
        r = et.subsistemas_por_uf(texto, nomes_uf)
    except ValueError as e:  # resposta ilegível ou UF com dois subsistemas: registrada, não usada
        return {"mapeamento": {}, "erro": str(e), "vintage": v, "sem_uf": [], "ligacoes_pelo_nome": []}
    r["vintage"] = v
    return r


def _localidades_epe(con):
    """[(uf, município, localidade)] da camada 27 da EPE, com a vintage; (None, None) sem captura."""
    texto, v = _le_vintage(con, DS_EPE, "camada27_isolados")
    if texto is None:
        return None, v
    try:
        return et.localidades_isoladas(texto), v
    except ValueError:
        return None, v


def localiza_pontos(pontos, indices):
    """{i: [códigos IBGE que contêm o ponto]} para pontos [(i, lon, lat)], percorrendo os
    índices de polígonos (um por UF, it.PoligonosMaxima) sem precisar de todos na memória
    ao mesmo tempo: cada índice é usado e descartado."""
    achados = defaultdict(list)
    for P in indices:
        caixas = [x[0] for x in P.mun.values()]
        if not caixas:
            continue
        x0, y0 = min(c[0] for c in caixas), min(c[1] for c in caixas)
        x1, y1 = max(c[2] for c in caixas), max(c[3] for c in caixas)
        for i, lon, lat in pontos:
            if x0 <= lon <= x1 and y0 <= lat <= y1:
                achados[i].extend(P.localiza(lon, lat))
    return achados


def _indices_malha_maxima(vintages):
    for cod in sorted(vintages):
        with base.abre_bronze(vintages[cod]["arquivo"]) as f:
            topo = json.loads(it.corpo_sem_gzip(f.read()))
        yield it.PoligonosMaxima(topo)


def _malha_maxima(con):
    """Vintages da malha de qualidade máxima das 27 UFs; None quando falta alguma (a
    conferência então usa a malha do mapa e marca o resultado como aproximado)."""
    vs = {cod: base.ultima_vintage(con, DS_MALHA, f"UF{cod}") for cod in it.CODIGOS_UF}
    faltam = sorted(it.CODIGOS_UF[c] for c, v in vs.items() if not v or not v.get("arquivo"))
    return (None if faltam else vs), faltam


# ---------------------------------------------------------------- leitura dos insumos

def _insumos(ctx):
    """{chave: {caminho, sha256, bytes, gerado_em, modulo, obj (JSON lido) ou None}}; ausência
    de insumo opcional não derruba a gold: o bloco correspondente sai com motivo."""
    out = {}
    for chave, (tipo, nome, mod, _) in INSUMOS.items():
        cam = _caminho(tipo, nome)
        if not os.path.exists(cam):
            out[chave] = None
            continue
        obj = None
        if nome.endswith(".json"):
            obj = (ctx.get("golds") or {}).get(nome) if tipo == "gold" else None
            if obj is None:
                obj = _le_json(cam)
        # data de geração do arquivo: a do próprio JSON (golds e séries), a da captura da
        # malha (geo) ou, para CSV, a da gold do módulo que o escreveu (abaixo)
        quando = (obj.get("capturado_em") if tipo == "geo" else _gerado_em(obj)) if isinstance(obj, dict) else None
        out[chave] = {"chave": chave, "arquivo": os.path.relpath(cam, base.RAIZ), "url": f"/energia/{tipo}/{nome}",
                      "sha256": _sha256_arquivo(cam), "bytes": os.path.getsize(cam), "modulo": mod,
                      "gerado_em": quando, "obj": obj}
    for k, g in GOLD_DO_CSV.items():
        if out.get(k) and out.get(g):
            out[k]["gerado_em"] = out[g]["gerado_em"]
    return out


def _disponivel(ins, chave):
    x = ins.get(chave)
    if not x:
        return False
    o = x.get("obj")
    if isinstance(o, dict) and "disponivel" in o:
        return o.get("disponivel") is True
    return True


def _manifesto_insumos(ins):
    return [{"chave": k, "modulo": x["modulo"], "arquivo": x["arquivo"], "url": x["url"], "sha256": x["sha256"],
             "bytes": x["bytes"], "gerado_em": x["gerado_em"]} for k, x in sorted(ins.items()) if x]


def _snapshot_insumos(ins):
    itens = [x for _, x in sorted(ins.items()) if x]
    h = hashlib.sha256("".join(x["sha256"] for x in itens).encode()).hexdigest()
    datas = sorted(x["gerado_em"] for x in itens if x.get("gerado_em"))
    return {"id": f"territorio_insumos@{datas[-1] if datas else 'sem_data'}", "sha256": h}


def _fonte_arquivo(ins_item, orgao, conjunto, url, prov_origem):
    """Bloco fonte da evidência para um número calculado sobre um arquivo publicado por
    outro módulo: o arquivo exato (sha256); a captura e a publicação são as do dado
    original, como a proveniência do módulo de origem as registra (a data de geração do
    arquivo intermediário é processamento, não captura, e vai em `processado_em`)."""
    po = prov_origem or {}
    return {"orgao": orgao, "conjunto": conjunto, "recurso": os.path.basename(ins_item["arquivo"]), "url": url,
            "arquivo": ins_item["arquivo"], "sha256": ins_item["sha256"],
            "capturado_em": base.instante_utc(po["capturado_em"]) if po.get("capturado_em") else None,
            "publicado_em": po.get("publicado_pela_fonte_em"),
            "processado_em": base.instante_utc(ins_item["gerado_em"]) if ins_item.get("gerado_em") else None,
            "recurso_original": (po.get("fonte") or {}).get("recurso"),
            "snapshot_original": po.get("snapshot")}


# ---------------------------------------------------------------- submercados, UFs e áreas de carga

def _mapeamentos_publicados(ins):
    """UF → subsistema publicado pelos módulos Água (cobertura da temperatura) e Carga
    (UFs por subsistema). É a hipótese que a conferência das áreas de carga prova ou
    reprova; as duas publicações são comparadas entre si."""
    agua, carga = {}, {}
    a = (ins.get("agua_gold") or {}).get("obj") or {}
    for x in (a.get("clima") or {}).get("cobertura_temperatura") or []:
        if x.get("uf") and x.get("subsistema"):
            agua[x["uf"]] = x["subsistema"]
    cd = (ins.get("carga_detalhe_gold") or {}).get("obj") or {}
    for sm, ufs in ((cd.get("temperatura") or {}).get("ufs_por_subsistema") or {}).items():
        for uf in ufs:
            carga[uf] = sm
    return agua, carga


def _conferencia_areas(con, hipotese_uf):
    hipotese, conflitos = ot.areas_por_submercado(hipotese_uf)
    dias = _dias_conferidos(con)[:2]
    confs = []
    linhas_csv, linhas_alt = [], []
    area_sm = {a: sm for sm, lst in hipotese.items() for a in lst}
    for dia in dias:
        series = _series_do_dia(con, dia)
        cf = ot.confere_fechamento(series, hipotese)
        cf["dia"] = dia
        cf["intervalos_incompletos"] = sorted(a for a, v in series.items() if len(v) != ot.INTERVALOS_DIA)
        confs.append(cf)
        for x in cf.get("alternativas") or []:
            linhas_alt.append([dia, x["descricao"], " ".join(x["envolvidas"]), c.r(x["mediana_abs_mwmed"], 3),
                               c.r(x["residuo_medias_dia_mwmed"], 3), c.r(cf["tolerancia_mwmed"], 2),
                               int(x["mediana_abs_mwmed"] <= cf["tolerancia_mwmed"])])
        medias = {a: (sum(v.values()) / len(v) if v else None) for a, v in series.items()}
        for a in ot.TODAS_AS_AREAS:
            n = len(series.get(a) or {})
            if a in ot.SUBMERCADOS_API:
                sm = ot.SUBMERCADOS_API[a]
                x = (cf.get("submercados") or {}).get(sm) or {}
                linhas_csv.append([dia, a, ot.NOME_SUBMERCADO[sm], "submercado", "", sm, c.r(medias.get(a), 3), n, "",
                                   c.r(x.get("soma_areas_mwmed"), 3), c.r(x.get("residuo_mwmed"), 3),
                                   c.r(x.get("mediana_abs_mwmed"), 3), c.r(x.get("max_abs_mwmed"), 3), c.r(cf.get("tolerancia_mwmed"), 3)])
            elif a in ot.AREAS_PERDAS:
                nome, sm = ot.AREAS_PERDAS[a]
                linhas_csv.append([dia, a, nome, "perdas", "", sm, c.r(medias.get(a), 3), n, "", "", "", "", "", ""])
            else:
                nome, ufs = ot.AREAS_GEOELETRICAS[a]
                vd = ((cf.get("areas") or {}).get(a) or {}).get("veredito")
                linhas_csv.append([dia, a, nome, "geoeletrica", " ".join(ufs), area_sm.get(a), c.r(medias.get(a), 3), n, vd,
                                   "", "", "", "", ""])
    por_uf = ot.uf_para_submercado(confs, hipotese) if confs else {}
    return {"dias": dias, "conferencias": confs, "hipotese": hipotese, "conflitos": conflitos, "por_uf": por_uf,
            "linhas_csv": linhas_csv, "linhas_alt": linhas_alt}


# ---------------------------------------------------------------- construção

def construir(con, ctx):
    t0 = time.time()
    ins = _insumos(ctx)
    faltam = [k for k, (_, _, _, critico) in INSUMOS.items() if critico and not _disponivel(ins, k)]
    if faltam:
        return c.stub(GOLD, f"insumos críticos ausentes ou indisponíveis: {', '.join(faltam)}")
    hoje = ctx["hoje"]
    g = c.cabecalho(GOLD)
    ressalvas, controles = [], []

    malha = ins["malha_municipios"]["obj"]
    malha_uf = ins["malha_uf"]["obj"]
    feats = malha["features"]
    nomes = it.IndiceNomes(feats)
    origem = geo.origem_da_grade()
    if list(origem) != list((malha.get("projecao") or {}).get("origem_m") or []):
        return c.stub(GOLD, f"origem da grade {origem} diferente da malha publicada {malha.get('projecao', {}).get('origem_m')}")
    municipios = {f["id"]: {"ibge": f["id"], "nome": f["nome"], "uf": f["uf"]} for f in feats}
    nomes_uf = {f["uf"]: f.get("nome") for f in malha_uf.get("features") or []}
    cod_uf = {f["uf"]: f.get("id") for f in malha_uf.get("features") or []}

    # ---- submercado por UF: camada oficial da EPE (UF → subsistema), conferida com os
    # mapeamentos dos módulos Água e Carga e provada, área por área, pela carga do ONS
    map_agua, map_carga = _mapeamentos_publicados(ins)
    epe = _mapeamento_epe(con, nomes_uf)
    map_epe = (epe or {}).get("mapeamento") or {}
    if len(map_epe) == len(ot.UFS):
        hip_uf, hip_de = map_epe, "epe"
    else:
        hip_uf, hip_de = (map_agua, "agua") if map_agua else (map_carga, "carga")
        ressalvas.append("Camada oficial UF → subsistema da EPE indisponível nesta execução "
                         f"({(epe or {}).get('erro') or 'sem captura'}): a hipótese conferida é a publicada pelo módulo "
                         f"{'Água' if hip_de == 'agua' else 'Carga'}.")
    divergencias_map = sorted(uf for uf in set(map_agua) | set(map_carga) | set(map_epe)
                              if len({map_agua.get(uf), map_carga.get(uf), map_epe.get(uf)}) != 1)
    controles.append({"nome": "UF → subsistema: camada oficial da EPE e módulos Água e Carga publicam o mesmo mapeamento", "critico": False,
                      "resultado": "aprovado" if map_epe and map_agua and map_carga and not divergencias_map else "ressalva",
                      "detalhe": (f"{len(map_epe)} UFs na camada 24 da EPE, {len(map_agua)} na gold de Água, {len(map_carga)} na de "
                                  f"Carga; divergentes: {divergencias_map or 'nenhuma'}; ligadas pelo nome (sigla da camada fora do "
                                  f"padrão do IBGE): {[(x['UF_fonte'], x['uf']) for x in (epe or {}).get('ligacoes_pelo_nome') or []] or 'nenhuma'}")})
    areas = _conferencia_areas(con, hip_uf)
    areas["hipotese_de"] = hip_de
    areas["epe"] = epe
    por_uf = areas["por_uf"]
    if not por_uf:
        ressalvas.append("Conferência das áreas de carga do ONS indisponível nesta execução: submercado por UF publicado como não provado.")
    uf_sm = {}
    for uf in ot.UFS:
        x = por_uf.get(uf) or {"subsistema": None, "estado": "nao_provado", "areas": []}
        uf_sm[uf] = x

    # ---- localidades isoladas (EPE, PASI, via módulo Inclusão)
    isolados_mun = defaultdict(list)
    isol_sem_mun = []
    if ins.get("inclusao_isolados"):
        iso = ins["inclusao_isolados"]["obj"]
        cps = iso.get("campos") or []
        for l in iso.get("localidades") or []:
            r = dict(zip(cps, l))
            cod, via = nomes.codigo(r.get("municipio"), r.get("uf"))
            if cod:
                isolados_mun[cod].append({"sigla": r.get("sigla"), "nome": r.get("nome"), "populacao": r.get("populacao"),
                                          "distribuidora": r.get("distribuidora")})
            else:
                isol_sem_mun.append({"sigla": r.get("sigla"), "municipio": r.get("municipio"), "uf": r.get("uf")})
        ciclo_isolados = iso.get("ciclo")
    else:
        ciclo_isolados = None
    # conferência por outro caminho: as mesmas localidades nos mesmos municípios na camada 27
    # do WebMap da EPE (a camada não traz população)
    loc_epe, v_loc_epe = _localidades_epe(con)
    if loc_epe is not None and ins.get("inclusao_isolados"):
        iso = ins["inclusao_isolados"]["obj"]
        cps = iso.get("campos") or []
        pasi = Counter((r.get("uf"), it.normaliza(r.get("municipio")), it.normaliza(r.get("nome")))
                       for r in (dict(zip(cps, l)) for l in iso.get("localidades") or []))
        camada = Counter((uf, it.normaliza(m), it.normaliza(n)) for uf, m, n in loc_epe)
        so_pasi, so_epe = sorted((pasi - camada).elements()), sorted((camada - pasi).elements())
        controles.append({"nome": "Localidades isoladas do PASI (módulo Inclusão) iguais às da camada 27 do WebMap da EPE", "critico": False,
                          "resultado": "aprovado" if not so_pasi and not so_epe else "ressalva",
                          "detalhe": (f"{sum(pasi.values())} no PASI, {sum(camada.values())} na camada (UF, município e localidade "
                                      f"normalizados); só no PASI: {so_pasi[:10] or 'nenhuma'}; só na camada: {so_epe[:10] or 'nenhuma'}")})

    # ---- distribuidoras e vínculos (módulo Perdas)
    pm = ins["perdas_municipios"]["obj"]
    pg = ins["perdas_gold"]["obj"]
    R_ = vinculos_da_relacao(pm, municipios)
    cnpjs_rel, vinculos, codigos_fora_malha, sem_vinculo = R_["cnpjs"], R_["vinculos"], R_["fora_da_malha"], R_["sem_vinculo"]
    pd = {d["cnpj"]: d for d in pg.get("distribuidoras") or []}
    estados_vinc = {int(k): v for k, v in (pm.get("estados_vinculo") or {}).items()}
    dist_idx = {cn: i for i, cn in enumerate(cnpjs_rel)}

    # ---- conjuntos (módulo Qualidade)
    conj_mun = {}
    conj_cnpj_mun = {}
    ano_q = None
    qg = (ins.get("qualidade_gold") or {}).get("obj") or {}
    if ins.get("qualidade_municipios"):
        ano_q = (qg.get("mapa") or {}).get("ano") or qg.get("ano_referencia")
        for r in _le_csv(_caminho("series", "qualidade_municipios.csv")):
            cod = r["cod_ibge"]
            conj_mun[cod] = [x for x in (r.get("conjuntos") or "").split() if x]
            conj_cnpj_mun[cod] = set((r.get("cnpjs") or "").split())
    conjuntos = {}
    if ins.get("qualidade_conjuntos") and ano_q:
        alvo = {x for lst in conj_mun.values() for x in lst}
        for r in _le_csv(_caminho("series", "qualidade_conjuntos_anual_2020_2029.csv")):
            if r["conjunto"] in alvo and _int(r["ano"]) == int(ano_q):
                conjuntos[r["conjunto"]] = {"nome": r["nome"], "cnpj": entidades.cnpj(r["cnpj"]), "sigla": r["sigla"],
                                            "ano": int(ano_q), "meses": _int(r["meses"]), "dec_h": _num(r["dec_h"]),
                                            "fec": _num(r["fec_interrupcoes"]), "dec_lim_h": _num(r["dec_limite_h"]),
                                            "fec_lim": _num(r["fec_limite_interrupcoes"]), "ucs": _num(r["ucs_media"])}
    n_mun_conj = Counter(x for cod, lst in conj_mun.items() if cod in municipios for x in lst)
    conj_sem_valor = sorted({x for lst in conj_mun.values() for x in lst} - set(conjuntos))

    # ---- indicadores municipais
    mmgd = {}
    anos_pop = Counter()
    if ins.get("transicao_municipios"):
        for r in _le_csv(_caminho("series", "transicao_mmgd_municipios.csv")):
            mmgd[r["codigo_ibge"]] = {"pop": _int(r["populacao_estimada"]), "un": _int(r["unidades"]),
                                      "kw": _num(r["potencia_kw"]), "w_hab": _num(r["w_por_habitante"])}
            if r.get("populacao_estimada"):
                anos_pop[r.get("ano_populacao") or None] += 1
    # ano da estimativa de população do IBGE usada (um só no arquivo; mais de um vira ressalva)
    ano_pop = _int(anos_pop.most_common(1)[0][0]) if anos_pop and anos_pop.most_common(1)[0][0] else None
    if len(anos_pop) > 1:
        ressalvas.append(f"População municipal com mais de um ano de estimativa no arquivo do módulo Transição: {dict(anos_pop)}.")
    cod6 = defaultdict(list)
    for cod in municipios:
        cod6[cod[:6]].append(cod)
    tsee, tsee_sem_cod = {}, []
    mes_cde = mes_cad = None
    if ins.get("inclusao_municipios"):
        for r in _le_csv(_caminho("series", "inclusao_municipios.csv")):
            cods = cod6.get(r["cod_ibge6"]) or []
            if len(cods) != 1:
                tsee_sem_cod.append(r["cod_ibge6"])
                continue
            mes_cde = mes_cde or r.get("mes_cde") or None
            mes_cad = mes_cad or r.get("mes_cadunico") or None
            tsee[cods[0]] = {"faturas": _num(r["faturas_tsee"]), "desconto": _num(r["desconto_reais"]),
                             "proxy": _num(r["razao_proxy_atualizadas"]), "base_pequena": _int(r["base_pequena"])}
    lpt, lpt_sem_cod, lpt_anos, lpt_por_nome = defaultdict(float), Counter(), set(), Counter()
    if ins.get("inclusao_lpt"):
        for r in _le_csv(_caminho("series", "inclusao_luz_para_todos_municipios.csv")):
            v = _num(r["domicilios"])
            if v is None:
                continue
            cods = cod6.get(r["cod_ibge6"]) or []
            if not r["cod_ibge6"]:
                # linha sem código no arquivo do módulo Inclusão: mesmo critério de nome das
                # usinas (nome atual do IBGE na UF ou grafia antiga documentada)
                cod, via = nomes.codigo(r["municipio"], r["uf"])
                if cod:
                    cods = [cod]
                    lpt_por_nome[via] += v
            if len(cods) != 1:
                lpt_sem_cod[(r["uf"], r["municipio"])] += v
                continue
            lpt[cods[0]] += v
            lpt_anos.add(r["ano"])

    # ---- usinas (SIGA, via módulo Expansão)
    eg = (ins.get("expansao_gold") or {}).get("obj") or {}
    poly = it.IndicePoligonos(feats)
    linhas_siga = list(_le_csv(_caminho("series", "expansao_usinas_siga.csv"))) if ins.get("expansao_usinas") else []
    # coordenada conferida na malha de qualidade máxima do IBGE (uma UF por vez na memória)
    vs_malha, faltam_malha = _malha_maxima(con)
    achados = None
    if vs_malha:
        pontos = [(i, _num(r.get("lon")), _num(r.get("lat"))) for i, r in enumerate(linhas_siga)
                  if _num(r.get("lat")) is not None and _num(r.get("lon")) is not None]
        achados = localiza_pontos(pontos, _indices_malha_maxima(vs_malha))
    else:
        ressalvas.append(f"Malha municipal de qualidade máxima do IBGE sem captura para {', '.join(faltam_malha)}: a conferência das "
                         "coordenadas das usinas usou a malha simplificada do mapa e é aproximada (superestima as usinas fora do "
                         "município declarado).")
    U_ = processa_usinas(linhas_siga, nomes, poly, origem, achados=achados)
    U_["malha"] = {"conferencia": "maxima" if vs_malha else "simplificada", "faltam": faltam_malha,
                   "arquivos": ([{"uf": it.CODIGOS_UF[k], "arquivo": v["arquivo"], "sha256": v["sha256"],
                                  "capturado_em": v["capturado_em"]} for k, v in sorted(vs_malha.items())] if vs_malha else [])}
    usinas, usi_csv = U_["usinas"], U_["csv"]
    usi_mun_op, usi_mun_cart, usi_multi_mun, usi_mun_reg = U_["op"], U_["carteira"], U_["multi"], U_["registros"]
    nao_reconhecidos, contagem_usi, soma_uf_op = U_["nao_reconhecidos"], U_["contagem"], U_["soma_uf_op"]

    # ---- montagem do índice municipal
    idx_dist = {}
    for i, cn in enumerate(cnpjs_rel):
        idx_dist[i] = cn
    linhas_mun = []
    sm_mun = {}
    for cod in sorted(municipios):
        m = municipios[cod]
        uf = m["uf"]
        su = uf_sm.get(uf) or {}
        mm = mmgd.get(cod) or {}
        ts = tsee.get(cod) or {}
        op = usi_mun_op.get(cod)
        ca = usi_mun_cart.get(cod)
        rg = usi_mun_reg.get(cod)
        iso = isolados_mun.get(cod) or []
        pop_iso = [x["populacao"] for x in iso if x.get("populacao") is not None]
        # município com localidade em sistema isolado: fora do SIN (submercado não se aplica)
        # quando a sede é localidade isolada ou a maior parte da população está nelas; com
        # aviso, quando são localidades menores de um município ligado ao SIN
        sm, estado_sm, sede_iso = estado_submercado_municipio(m["nome"], mm.get("pop"), iso, su)
        sm_mun[cod] = (sm, estado_sm)
        linhas_mun.append([
            cod, m["nome"], uf, sm, estado_sm,
            [[i, e] for i, e in vinculos.get(cod, [])],
            [int(x) for x in conj_mun.get(cod, [])],
            sorted(usi_multi_mun.get(cod, [])),
            mm.get("pop"), mm.get("un"), c.r(mm.get("kw"), 2), c.r(mm.get("w_hab"), 1),
            ts.get("faturas"), c.r(ts.get("desconto"), 2), c.r(ts.get("proxy"), 2), ts.get("base_pequena"),
            c.r(lpt.get(cod), 0) if cod in lpt else None,
            op[0] if op else 0, c.r(op[1], 3) if op else 0.0,
            ca[0] if ca else 0, c.r(ca[1], 3) if ca else 0.0,
            rg[0] if rg else 0, c.r(rg[1], 3) if rg else 0.0,
            len(iso), c.r(sum(pop_iso), 0) if pop_iso else (None if iso else 0), sede_iso,
        ])
    # usinas: zero é zero (o SIGA é o universo das usinas outorgadas); isolados: zero quando
    # o PASI não lista localidade no município. MMGD, Tarifa Social e Luz para Todos ficam
    # nulos quando o arquivo do módulo não traz o município (ausência, nunca zero).

    # ---- distribuidoras (indicadores da distribuidora inteira)
    distribuidoras = _distribuidoras(ins, cnpjs_rel, pd, vinculos, municipios, uf_sm, hoje, sm_mun)

    # ---- UFs e submercados
    ufs = _ufs(ins, uf_sm, municipios, isolados_mun, nomes_uf, cod_uf, soma_uf_op, sm_mun)
    submercados = _submercados(ins, uf_sm, areas)

    # ---- validação
    validacao = _validacoes(linhas_mun, municipios, vinculos, distribuidoras, conjuntos, usinas, contagem_usi,
                            pm, pg, eg, soma_uf_op, conj_cnpj_mun, cnpjs_rel, areas, uf_sm)
    controles.extend(validacao["controles"])
    criticos = [x for x in validacao["controles"] if x["resultado"] == "reprovado" and x.get("critico")]
    gran = _valida_granularidade()
    controles.extend(gran)
    criticos += [x for x in gran if x["resultado"] == "reprovado"]
    if criticos:
        return c.stub(GOLD, "validação crítica reprovada: " + "; ".join(f"{x['nome']}: {x['detalhe']}" for x in criticos)[:280])

    # ---- arquivos sob demanda e CSV
    conj_linhas = {k: [v["nome"], dist_idx.get(v["cnpj"]), v["ano"], v["meses"], c.r(v["dec_h"], 2), c.r(v["fec"], 2),
                       c.r(v["dec_lim_h"], 2), c.r(v["fec_lim"], 2), c.r(v["ucs"], 0), n_mun_conj.get(k, 0)]
                   for k, v in sorted(conjuntos.items(), key=lambda kv: int(kv[0]))}
    cab_mun = {"gerado_em": g["gerado_em"], "versao": 1, "regra": REGRA_GRANULARIDADE,
               "campos": [k for k, _ in CAMPOS_MUN], "graos": {k: v for k, v in CAMPOS_MUN},
               "distribuidoras": [[d["cnpj"], d["sigla"]] for d in distribuidoras],
               "estados_vinculo": {str(k): v for k, v in estados_vinc.items()},
               "conjuntos": {"ano": ano_q, "campos": [k for k, _ in CAMPOS_CONJ], "graos": {k: v for k, v in CAMPOS_CONJ},
                             "linhas": conj_linhas, "sem_valor_no_ano": [int(x) for x in conj_sem_valor]},
               "linhas": linhas_mun}
    _escreve_compacto(ARQ_MUN_JSON, cab_mun)
    _escreve_compacto(ARQ_USI_JSON, {"gerado_em": g["gerado_em"], "versao": 1, "campos": [k for k, _ in CAMPOS_USI],
                                     "graos": {k: v for k, v in CAMPOS_USI},
                                     "grade": {"origem_m": list(origem), "metros_por_unidade": geo.GRADE_M,
                                               "projecao": "Albers cônica equivalente da malha publicada"},
                                     "conferencia_coordenada": U_["malha"]["conferencia"],
                                     "linhas": usinas})
    _escreve_csvs(linhas_mun, distribuidoras, conjuntos, n_mun_conj, usi_csv, areas, idx_dist)

    # ---- resumo, KPIs, evidências e proveniência
    resumo = _resumo(linhas_mun, vinculos, municipios, sem_vinculo, codigos_fora_malha, conj_mun, conjuntos,
                     conj_sem_valor, contagem_usi, nao_reconhecidos, usi_multi_mun, isolados_mun, isol_sem_mun,
                     tsee, tsee_sem_cod, mmgd, lpt, lpt_sem_cod, lpt_anos, uf_sm, lpt_por_nome)
    resumo["distribuidoras_por_municipio_perdas_x_qualidade"] = validacao["diferencas_perdas_qualidade"]
    resumo["usinas"]["conferencia_coordenada"] = U_["malha"]
    snap = _snapshot_insumos(ins)
    g.update({
        "pergunta": "O que acontece na minha região?",
        "data_referencia": hoje.isoformat(),
        "referencias": _referencias(ins, ano_q, mes_cde, mes_cad, lpt_anos, ciclo_isolados, areas, ano_pop),
        "regra_granularidade": REGRA_GRANULARIDADE,
        "graos": GRAOS,
        "camadas": _camadas(),
        "compatibilidade": COMPATIBILIDADE,
        "links": {"distribuidora": [MODULOS[k] for k in ("perdas", "qualidade", "conta", "transicao", "inclusao")],
                  "municipio": [MODULOS[k] for k in ("transicao", "inclusao", "expansao", "qualidade", "perdas")],
                  "submercado": [MODULOS[k] for k in ("pld", "agua", "carga")],
                  "uf": [MODULOS[k] for k in ("expansao", "inclusao")],
                  "usina": [MODULOS["expansao"]]},
        "indicadores": _catalogo(ins, ano_q, mes_cde, lpt_anos),
        "submercados": submercados,
        "ufs": ufs,
        "distribuidoras": distribuidoras,
        "resumo": resumo,
        "areas_carga": _bloco_areas(areas, map_agua, map_carga, map_epe),
        "controles": [{"nome": x["nome"], "resultado": x["resultado"], "critico": bool(x.get("critico")), "detalhe": x["detalhe"]}
                      for x in controles],
        "ressalvas": ressalvas + validacao["ressalvas"],
        "insumos": _manifesto_insumos(ins),
        "limitacoes": LIMITACOES,
        "bloqueios": BLOQUEIOS,
        "proveniencia": _proveniencias(con, ins, snap, ano_q, mes_cde, lpt_anos, areas, ano_pop, ciclo_isolados, U_["malha"]),
        "evidencias": _evidencias(con, ins, resumo, areas, contagem_usi, linhas_mun),
        "downloads": [
            {"rotulo": "Índice territorial por município (CSV)", "url": U["mun_csv"]},
            {"rotulo": "Distribuidoras: área e indicadores da distribuidora inteira (CSV)", "url": U["dist_csv"]},
            {"rotulo": "Conjuntos elétricos que atendem cada município (CSV)", "url": U["conj_csv"]},
            {"rotulo": "Usinas do SIGA com municípios declarados e conferência da coordenada (CSV)", "url": U["usi_csv"]},
            {"rotulo": "Conferência das áreas de carga do ONS (CSV)", "url": U["areas_csv"]},
            {"rotulo": "Alternativas de pertença das áreas de carga testadas, com as duas estatísticas (CSV)", "url": U["alt_csv"]},
        ],
        "series": {"municipios": U["mun_json"], "usinas": U["usi_json"]},
        "geometria": {"municipios": "/energia/geo/municipios.json", "uf": "/energia/geo/uf.json",
                      "malha": malha.get("malha"), "fonte": malha.get("fonte"), "capturado_em": malha.get("capturado_em"),
                      "sha256": malha.get("sha256")},
        "processamento_s": round(time.time() - t0, 1),
    })
    return g


def vinculos_da_relacao(pm, municipios):
    """Relação município × distribuidora publicada pelo módulo Perdas (perdas_municipios.json)
    lida sem reclassificação: {cnpjs (índice → CNPJ), vinculos {código IBGE: [(índice,
    estado)]}, fora_da_malha (códigos da relação que não existem na malha do IBGE),
    sem_vinculo (municípios da malha sem nenhum vínculo)}."""
    cnpjs = [entidades.cnpj(x) for x in pm.get("distribuidoras") or []]
    vinculos, fora = {}, []
    for cod, v in (pm.get("municipios") or {}).items():
        if cod not in municipios:
            fora.append({"codigo": cod, "valido": v.get("valido"), "distribuidoras": [cnpjs[int(i)] for i, _ in v.get("d") or []]})
            continue
        vinculos[cod] = [(int(i), int(e)) for i, e in v.get("d") or []]
    sem = sorted(cod for cod in municipios if not vinculos.get(cod))
    return {"cnpjs": cnpjs, "vinculos": vinculos, "fora_da_malha": fora, "sem_vinculo": sem}


def distribuidoras_validas(vinculos_municipio):
    """Índices das distribuidoras com vínculo 1 (confirmado) ou 2 (só MMGD) num município."""
    return [i for i, e in vinculos_municipio if e in (1, 2)]


def estado_submercado_municipio(nome, pop, localidades, su):
    """(submercado, estado, sede_isolada) do município a partir do estado da UF (`su`, de
    ons_territorio.uf_para_submercado) e das localidades isoladas do PASI ligadas a ele.

    - sem localidade isolada: o submercado e o estado da UF;
    - 'fora_do_sin' (submercado None, não se aplica): a sede é localidade isolada (o PASI
      dá à localidade-sede o nome do município) ou a população declarada das localidades é
      ao menos LIMIAR_POP_ISOLADA da população estimada do município;
    - 'com_localidade_isolada': localidades menores num município cuja sede e maior parte
      da população estão no SIN; o submercado da UF vale com aviso.
    `sede_isolada` é 1 ou 0 com localidade isolada e None sem ela."""
    if not localidades:
        return su.get("subsistema"), su.get("estado"), None
    sede = any(it.normaliza(x.get("nome")) == it.normaliza(nome) for x in localidades)
    pops = [x["populacao"] for x in localidades if x.get("populacao") is not None]
    razao = sum(pops) / pop if pops and pop else None
    if sede or (razao is not None and razao >= LIMIAR_POP_ISOLADA):
        return None, "fora_do_sin", int(sede)
    if su.get("subsistema"):
        return su["subsistema"], "com_localidade_isolada", 0
    return None, su.get("estado"), 0


def registro_ate_10kw(r):
    """Registro do SIGA em operação com potência fiscalizada de até 10 kW (coluna própria no
    município: são em geral sistemas fotovoltaicos individuais de 1 a 3 kW)."""
    kw = _num(r.get("kw_fiscalizado"))
    return r.get("estagio") == "operacao" and r.get("outorga") == "Registro" and kw is not None and kw <= LIMITE_REGISTRO_KW


def processa_usinas(linhas, nomes, poly, origem, achados=None):
    """Usinas do CSV do SIGA publicado pelo módulo Expansão → pontos, vínculos municipais e
    somas por município. Regras: o município é o que o SIGA declara (nome oficial do IBGE
    na UF, ou grafia antiga documentada); só usina declarada em UM município entra na soma
    municipal; usina em vários municípios é listada em cada um, sem potência repartida; a
    coordenada só confere a declaração. Em operação vale a potência fiscalizada; na
    carteira (construção e construção não iniciada), a outorgada. Registros de até 10 kW em
    operação ficam numa soma própria (kW), fora da contagem de usinas do município.

    `achados` = {índice da linha: [códigos IBGE que contêm a coordenada]} na malha de
    qualidade máxima (localiza_pontos). Sem ele, a conferência usa a malha simplificada do
    mapa (`poly`) e é aproximada. Com ele, a malha simplificada ainda é consultada para
    publicar quantas usinas ela daria como fora sem estar (falsos positivos)."""
    usinas, usi_csv = [], []
    op = defaultdict(lambda: [0, 0.0])
    cart = defaultdict(lambda: [0, 0.0])
    reg = defaultdict(lambda: [0, 0.0])
    multi = defaultdict(list)
    nao_reconhecidos = Counter()
    contagem = Counter()
    soma_uf_op = defaultdict(float)
    malha = "maxima" if achados is not None else "simplificada"
    if achados is not None:  # zero é zero quando a comparação foi feita
        for k in ("simplificada_fora", "simplificada_dentro", "simplificada_fora_maxima_dentro", "simplificada_dentro_maxima_fora"):
            contagem[k] = 0
    for idx, r in enumerate(linhas):
        contagem["total"] += 1
        decl = it.municipios_siga(r.get("municipios"))
        cods, vias = [], set()
        for nome, uf in decl:
            cod, via = nomes.codigo(nome, uf) if uf else (None, None)
            if cod:
                if cod not in cods:
                    cods.append(cod)
                vias.add(via)
            else:
                nao_reconhecidos[(uf or "", nome)] += 1
        if decl and len(cods) == len(decl):
            contagem["todos_reconhecidos"] += 1
        elif cods:
            contagem["parcialmente_reconhecidos"] += 1
        else:
            contagem["sem_municipio_reconhecido"] += 1
        if "grafia_antiga" in vias:
            contagem["via_grafia_antiga"] += 1
        lat, lon = _num(r.get("lat")), _num(r.get("lon"))
        x = y = pip = None
        no_decl = None
        if lat is not None and lon is not None:
            contagem["com_coordenada"] += 1
            x, y = it.projeta(lon, lat, origem)
            simpl = poly.localiza(x, y)
            lista = achados.get(idx, []) if achados is not None else simpl
            pip = lista[0] if len(lista) == 1 else None
            if cods:
                no_decl = 1 if any(a in cods for a in lista) else 0
                contagem["coord_no_declarado" if no_decl else "coord_fora_do_declarado"] += 1
                if achados is not None:
                    no_simpl = any(a in cods for a in simpl)
                    if not no_simpl and no_decl:
                        contagem["simplificada_fora_maxima_dentro"] += 1
                    elif no_simpl and not no_decl:
                        contagem["simplificada_dentro_maxima_fora"] += 1
                    contagem["simplificada_fora" if not no_simpl else "simplificada_dentro"] += 1
            if not lista:
                contagem["coord_fora_da_malha"] += 1
        mw_f = _num(r.get("kw_fiscalizado"))
        mw_o = _num(r.get("kw_outorgado"))
        mw_f = mw_f / 1000.0 if mw_f is not None else None
        mw_o = mw_o / 1000.0 if mw_o is not None else None
        est = r.get("estagio")
        pequeno = registro_ate_10kw(r)
        if pequeno:
            contagem["registros_ate_10kw"] += 1
        if est == "operacao" and mw_f is not None:
            soma_uf_op[r.get("uf")] += mw_f
        if len(cods) == 1 and len(decl) == 1:
            if pequeno:
                reg[cods[0]][0] += 1
                reg[cods[0]][1] += mw_f * 1000.0
            elif est == "operacao":
                op[cods[0]][0] += 1
                if mw_f is not None:
                    op[cods[0]][1] += mw_f
                else:  # contada, sem potência inventada
                    contagem["operacao_sem_potencia_fiscalizada"] += 1
            else:
                cart[cods[0]][0] += 1
                if mw_o is not None:
                    cart[cods[0]][1] += mw_o
        elif len(decl) > 1:
            contagem["multimunicipio"] += 1
            if pequeno:
                contagem["registros_ate_10kw_multimunicipio"] += 1
            for cod in cods:
                multi[cod].append(r["ceg"])
        usinas.append([r["ceg"], r["nome"], r["tipo"], est, r.get("uf"), c.r(mw_f, 4), c.r(mw_o, 4), x, y, cods, len(decl),
                       no_decl, r.get("outorga") or None])
        usi_csv.append([r["ceg"], r["nome"], r["tipo"], est, r.get("uf"), r.get("municipios"), " ".join(cods),
                        "|".join(sorted(vias)) or None, lat, lon, pip, no_decl, c.r(mw_f, 4), c.r(mw_o, 4),
                        r.get("outorga") or None, int(pequeno), malha if lat is not None and lon is not None else None])
    return {"usinas": usinas, "csv": usi_csv, "op": op, "carteira": cart, "registros": reg, "multi": multi,
            "nao_reconhecidos": nao_reconhecidos, "contagem": contagem, "soma_uf_op": soma_uf_op}


# ---------------------------------------------------------------- blocos da gold

def _bloco_ind(valores, periodo, ausente=None):
    if valores is None:
        return {"disponivel": False, "motivo": ausente or "a fonte não publica este indicador para esta entidade"}
    return {"disponivel": True, "periodo": periodo, **valores}


def _distribuidoras(ins, cnpjs_rel, pd, vinculos, municipios, uf_sm, hoje, sm_mun):
    qg = (ins.get("qualidade_gold") or {}).get("obj") or {}
    cg = (ins.get("conta_gold") or {}).get("obj") or {}
    tg = (ins.get("transicao_gold") or {}).get("obj") or {}
    ig = (ins.get("inclusao_gold") or {}).get("obj") or {}
    qd = {d["cnpj"]: d for d in qg.get("distribuidoras") or []}
    tv = {d["cnpj"]: d for d in (cg.get("tarifas") or {}).get("vigentes") or []}
    ts = {d["cnpj"]: d for d in (cg.get("tarifas") or {}).get("sem_vigente") or []}
    mm = {d["cnpj"]: d for d in (tg.get("mmgd") or {}).get("distribuidoras") or []}
    tsd = {d["cnpj"]: d for d in (ig.get("tarifa_social") or {}).get("distribuidoras") or []}
    ref_perdas = (ins["perdas_gold"]["obj"].get("referencia") or {})
    data_tarifa = cg.get("data_referencia")
    mes_tsee = (ig.get("tarifa_social") or {}).get("mes_referencia")
    data_mmgd = (tg.get("mmgd") or {}).get("data_cadastro")
    por_dist = defaultdict(list)
    for cod, lst in vinculos.items():
        for i, e in lst:
            por_dist[i].append((cod, e, lst))
    out = []
    for i, cn in enumerate(cnpjs_rel):
        p = pd.get(cn) or {}
        muns = por_dist.get(i, [])
        conf = [cod for cod, e, _ in muns if e == 1]
        so_mmgd = [cod for cod, e, _ in muns if e == 2]
        nao_conf = [cod for cod, e, _ in muns if e == 0]
        validos = [cod for cod, e, _ in muns if e in (1, 2)]
        exclusivos = [cod for cod, e, lst in muns if e in (1, 2) and sum(1 for _, ee in lst if ee in (1, 2)) == 1]
        ufs = sorted({municipios[cod]["uf"] for cod in validos})
        # submercado só dos municípios no SIN: o que está fora (sede ou maior parte da
        # população em sistema isolado) não tem submercado e é contado à parte
        fora_sin = [cod for cod in validos if sm_mun.get(cod, (None, None))[1] == "fora_do_sin"]
        com_iso = [cod for cod in validos if sm_mun.get(cod, (None, None))[1] == "com_localidade_isolada"]
        no_sin = [cod for cod in validos if cod not in set(fora_sin)]
        sms = Counter(uf_sm[municipios[cod]["uf"]]["subsistema"] for cod in no_sin)
        provado = all(uf_sm[municipios[cod]["uf"]]["estado"] != "nao_provado" for cod in no_sin) and bool(no_sin)
        ind = {}
        r = p.get("referencia") or {}
        taxa = r.get("taxa_total_pct")
        if p and r and taxa is not None:
            # mesmo critério de ano incompleto da qualidade (12 meses): o bloco de ano parcial
            # sai marcado e com ressalva, nunca como se fosse anual; taxa fora da faixa física
            # fica como a fonte publica, com ressalva visível
            parcial = r.get("completo") is False or (r.get("meses") or 0) < 12
            ress = []
            if parcial:
                ress.append(f"Ano {r.get('ano')} com {r.get('meses')} meses no balanço do SAMP: taxa de ano parcial, não comparável "
                            "à de distribuidoras com o ano completo.")
            if not (0 <= taxa <= 100):
                ress.append(f"Taxa de perdas totais de {taxa}% fora da faixa física de 0% a 100%: o balanço publicado no SAMP tem "
                            "energia fornecida maior que a injetada. Valor mantido como a fonte publica (alertas do módulo Perdas: "
                            f"{', '.join(r.get('alertas') or []) or 'nenhum'}).")
            ind["perdas"] = _bloco_ind({
                "ano": r.get("ano"), "meses": r.get("meses"), "completo": r.get("completo"), "parcial": parcial,
                "taxa_total_pct": taxa, "perdas_totais_mwh": r.get("perdas_totais_mwh"), "injetada_mwh": r.get("injetada_mwh"),
                "pnt_bt_pct": r.get("pnt_bt_pct"), "alertas": r.get("alertas") or [], "ressalvas": ress},
                {"inicio": str(r.get("ano")), "fim": str(r.get("ano"))})
        elif p and r:
            ind["perdas"] = _bloco_ind(None, None, (
                f"o módulo Perdas não publica taxa de {r.get('ano')} para esta distribuidora: energia injetada ausente no balanço "
                f"do SAMP ({r.get('meses')} meses publicados)"))
        elif p:
            ind["perdas"] = _bloco_ind(None, None, (
                f"sem balanço no SAMP em {ref_perdas.get('ano')}; última competência publicada: {p.get('ultima_competencia')}"
                + ("" if p.get("ativa") else " (distribuidora encerrada ou absorvida)")))
        else:
            ind["perdas"] = _bloco_ind(None, None, "CNPJ sem balanço na base de Perdas")
        q = qd.get(cn)
        if q and q.get("dec") is not None:
            ind["qualidade"] = _bloco_ind({
                "ano": q.get("ano"), "meses": q.get("meses"), "parcial": (q.get("meses") or 0) < 12,
                "dec_h": q.get("dec"), "fec": q.get("fec"),
                "dec_limite_h": q.get("dec_limite"), "fec_limite": q.get("fec_limite"), "ucs": q.get("ucs"),
                "conjuntos": q.get("conjuntos")}, {"inicio": str(q.get("ano")), "fim": str(q.get("ano"))})
        else:
            ind["qualidade"] = _bloco_ind(None, None, (
                f"ano {q.get('ano')} parcial: o módulo Qualidade só publica DEC e FEC anuais com os 12 meses e a fonte trouxe "
                f"{q.get('meses')} meses" if q else "CNPJ sem indicadores de continuidade na base de Qualidade"))
        t = tv.get(cn)
        if t:
            ind["tarifa"] = _bloco_ind({
                "total_rs_mwh": t.get("total"), "te_rs_mwh": t.get("te"), "tusd_rs_mwh": t.get("tusd"),
                "ato": t.get("ato"), "vigencia_inicio": t.get("inicio"), "vigencia_fim": t.get("fim")},
                {"inicio": data_tarifa, "fim": data_tarifa})
        else:
            sv = ts.get(cn)
            ind["tarifa"] = _bloco_ind(None, None, (sv or {}).get("motivo") or "sem tarifa B1 residencial vigente no arquivo da ANEEL")
        m = mm.get(cn)
        if m:
            ind["mmgd"] = _bloco_ind({"unidades": m.get("unidades"), "potencia_mw": m.get("potencia_mw")},
                                     {"inicio": data_mmgd, "fim": data_mmgd})
        else:
            ind["mmgd"] = _bloco_ind(None, None, "CNPJ sem unidade de MMGD no cadastro vigente")
        s = tsd.get(cn)
        if s and s.get("uc_tsee") is not None:
            ind["tsee"] = _bloco_ind({"uc_tsee": s.get("uc_tsee"), "uc_residencial": s.get("uc_residencial"),
                                      "participacao_pct": s.get("participacao_pct")}, {"inicio": mes_tsee, "fim": mes_tsee})
        else:
            ind["tsee"] = _bloco_ind(None, None, "CNPJ sem linha no SCS no mês de referência")
        out.append({
            "i": i, "cnpj": cn, "cnpj_formatado": entidades.cnpj_formatado(cn), "sigla": p.get("sigla") or (q or {}).get("sigla") or cn,
            "nome": p.get("nome"), "ativa": p.get("ativa"),
            "area": {"municipios": len(muns), "confirmados": len(conf), "so_mmgd": len(so_mmgd), "nao_confirmados": len(nao_conf),
                     "exclusivos": len(exclusivos), "compartilhados": len(validos) - len(exclusivos), "ufs": ufs,
                     "fora_do_sin": len(fora_sin), "com_localidade_isolada": len(com_iso)},
            "submercados": [{"sm": sm, "municipios": n} for sm, n in sorted(sms.items(), key=lambda kv: (-kv[1], str(kv[0])))],
            "submercado_unico": (next(iter(sms)) if len(sms) == 1 and provado else None),
            "parte_fora_do_sin": bool(fora_sin),
            "indicadores": ind,
        })
    return out


def _ufs(ins, uf_sm, municipios, isolados_mun, nomes_uf, cod_uf, soma_uf_op, sm_mun):
    eg = (ins.get("expansao_gold") or {}).get("obj") or {}
    ig = (ins.get("inclusao_gold") or {}).get("obj") or {}
    cap = {x["uf"]: x for x in (eg.get("capacidade_instalada") or {}).get("por_uf") or []}
    data_cap = (eg.get("capacidade_instalada") or {}).get("data_referencia")
    tsu = {x["uf"]: x for x in (ig.get("tarifa_social") or {}).get("ufs") or []}
    mes_cde = (ig.get("tarifa_social") or {}).get("mes_mapa")
    iso = {x["uf"]: x for x in ((ig.get("acesso") or {}).get("sistemas_isolados") or {}).get("por_uf") or []}
    ciclo = ((ig.get("acesso") or {}).get("sistemas_isolados") or {}).get("ciclo")
    n_mun = Counter(m["uf"] for m in municipios.values())
    out = []
    for uf in ot.UFS:
        su = uf_sm[uf]
        k = cap.get(uf)
        t = tsu.get(uf)
        s = iso.get(uf)
        out.append({
            "uf": uf, "codigo": cod_uf.get(uf), "nome": nomes_uf.get(uf), "municipios": n_mun.get(uf, 0),
            "subsistema": su.get("subsistema"), "estado_subsistema": su.get("estado"), "areas_carga": su.get("areas") or [],
            "municipios_com_localidade_isolada": sum(1 for cod, l in isolados_mun.items() if l and municipios[cod]["uf"] == uf),
            "municipios_fora_do_sin": sum(1 for cod, x in sm_mun.items() if x[1] == "fora_do_sin" and municipios[cod]["uf"] == uf),
            "indicadores": {
                "capacidade": _bloco_ind({"usinas": k.get("usinas"), "mw_fiscalizado": k.get("mw_fiscalizado"),
                                          "por_origem_mw": k.get("por_origem")}, {"inicio": data_cap, "fim": data_cap})
                if k else _bloco_ind(None, None, "nenhuma usina em operação com esta UF principal no SIGA"),
                "tsee": _bloco_ind({"faturas": t.get("faturas_tsee"), "desconto_reais": t.get("desconto_reais")},
                                   {"inicio": mes_cde, "fim": mes_cde}) if t else _bloco_ind(None, None, "UF sem faturas no arquivo da CDE"),
                "isolados": _bloco_ind({"localidades": s.get("localidades"), "populacao": s.get("populacao")},
                                       {"inicio": ciclo, "fim": ciclo}) if s else
                _bloco_ind({"localidades": 0, "populacao": 0}, {"inicio": ciclo, "fim": ciclo}) if ciclo else
                _bloco_ind(None, None, "lista de sistemas isolados indisponível"),
            },
        })
    return out


def _submercados(ins, uf_sm, areas):
    pg = (ins.get("pld_gold") or {}).get("obj") or {}
    ag = (ins.get("agua_gold") or {}).get("obj") or {}
    tg = (ins.get("transicao_gold") or {}).get("obj") or {}
    cart = {x["sm"]: x for x in pg.get("cartoes") or []}
    mensal = [m for m in pg.get("mensal") or [] if not m.get("parcial")]
    ult = mensal[-1] if mensal else None
    ear = {x["sm"]: x for x in (ag.get("armazenamento") or {}).get("subsistemas") or []}
    om = (tg.get("ons_mmgd") or {}).get("ultimo_mes_completo") or {}
    out = []
    for sm in ("SE", "S", "NE", "N"):
        ufs = sorted(uf for uf, x in uf_sm.items() if x.get("subsistema") == sm)
        confs = []
        for cf in areas["conferencias"]:
            s = (cf.get("submercados") or {}).get(sm)
            if s and cf.get("completo"):
                confs.append({"dia": cf["dia"], "submercado_mwmed": c.r(s["submercado_mwmed"], 2),
                              "soma_areas_mwmed": c.r(s["soma_areas_mwmed"], 2), "residuo_mwmed": c.r(s["residuo_mwmed"], 3),
                              "mediana_abs_mwmed": c.r(s["mediana_abs_mwmed"], 3), "max_abs_mwmed": c.r(s["max_abs_mwmed"], 3),
                              "meias_horas": s["meias_horas"], "tolerancia_mwmed": c.r(cf["tolerancia_mwmed"], 2),
                              "areas": s["areas"], "area_perdas": s["area_perdas"]})
        ca = cart.get(sm)
        e = ear.get(sm)
        out.append({
            "sm": sm, "nome": ot.NOME_SUBMERCADO[sm], "ufs": ufs,
            "ufs_com_area_sem_carga": sorted(uf for uf in ufs if uf_sm[uf]["estado"] == "provado_com_area_sem_carga"),
            "conferencia": confs,
            "indicadores": {
                "pld_dia": _bloco_ind({"valor": ca.get("media_dia")}, {"inicio": pg.get("dia_referencia"), "fim": pg.get("dia_referencia")})
                if ca else _bloco_ind(None, None, "PLD do dia indisponível na gold do PLD"),
                "pld_mes": _bloco_ind({"valor": ult.get(sm), "dias": ult.get("dias")}, {"inicio": ult["m"], "fim": ult["m"]})
                if ult and ult.get(sm) is not None else _bloco_ind(None, None, "sem mês completo na gold do PLD"),
                "ear": _bloco_ind({"pct": e.get("ear_pct"), "mwmes": e.get("ear_mwmes"), "max_mwmes": e.get("ear_max_mwmes")},
                                  {"inicio": e.get("dia"), "fim": e.get("dia")}) if e else _bloco_ind(None, None, "EAR indisponível na gold de Água e clima"),
                "mmgd_ons": _bloco_ind({"mwmed": om.get(sm)}, {"inicio": om.get("m"), "fim": om.get("m")})
                if om.get(sm) is not None and om.get("completo") else _bloco_ind(None, None, "sem mês completo da estimativa do ONS"),
            },
        })
    return out


def _alt(x):
    if not x:
        return None
    return {"descricao": x["descricao"], "envolvidas": x["envolvidas"], "mediana_abs_mwmed": c.r(x["mediana_abs_mwmed"], 3),
            "residuo_medias_dia_mwmed": c.r(x["residuo_medias_dia_mwmed"], 3)}


def _bloco_areas(areas, map_agua, map_carga, map_epe):
    epe = areas.get("epe") or {}
    v = epe.get("vintage") or {}
    return {
        "fonte": {"orgao": "ONS", "conjunto": "Carga de Energia Verificada (API por área de carga)", "url": ot.URL_DATASET,
                  "dicionario": ot.URL_DICIONARIO, "dicionario_versao": ot.DICIONARIO_VERSAO, "dicionario_sha256": ot.DICIONARIO_SHA256},
        "regra": ("Em cada meia hora, a carga do submercado deve ser igual à soma das suas áreas geoelétricas mais a área "
                  "de perdas do mesmo submercado. A hipótese fecha quando a mediana do resíduo absoluto de cada "
                  "submercado fica dentro da tolerância (15 MWmed); uma área fica provada quando, além disso, nenhuma "
                  "alternativa que a envolva (movê-la para outro submercado ou trocá-la com uma área de outro "
                  "submercado) também fecha. Dois dias (um útil e um domingo); área sem carga fica indeterminada. A mediana "
                  "por meia hora é usada porque o resíduo das médias do dia deixa passar trocas de áreas de carga média quase "
                  "igual no dia (em cada conferência, alternativas_que_fechariam_pelas_medias lista as que passariam) e "
                  "porque uma meia hora ainda em consistência desloca a média do dia inteiro; as duas estatísticas são "
                  "publicadas para cada alternativa."),
        "hipotese_de": {"epe": "camada 24 do WebMap da EPE (Unidades da federação e Subsistemas do SIN)",
                        "agua": "agua_detalhe.json (clima.cobertura_temperatura), sem a camada da EPE nesta execução",
                        "carga": "carga_detalhe.json (temperatura.ufs_por_subsistema), sem a camada da EPE nesta execução"}.get(
                            areas.get("hipotese_de"), areas.get("hipotese_de")),
        "dias": areas["dias"],
        "conflitos_na_hipotese": areas["conflitos"],
        "conferencias": [{"dia": cf["dia"], "completo": cf.get("completo"), "fecha": cf.get("fecha"),
                          "tolerancia_mwmed": c.r(cf.get("tolerancia_mwmed"), 2),
                          "ruido_mwmed": c.r(cf.get("ruido_mwmed"), 3),
                          "ruido_medias_dia_mwmed": c.r(cf.get("ruido_medias_dia_mwmed"), 3),
                          "menor_alternativa": _alt(cf.get("menor_alternativa")),
                          "menor_alternativa_pelas_medias": _alt(cf.get("menor_alternativa_pelas_medias")),
                          "alternativas_avaliadas": cf.get("alternativas_avaliadas"),
                          "alternativas_que_fechariam_pelas_medias": sorted(
                              x["descricao"] for x in cf.get("alternativas") or []
                              if x["residuo_medias_dia_mwmed"] <= (cf.get("tolerancia_mwmed") or 0)),
                          "areas_ambiguas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "ambigua"),
                          "intervalos_incompletos": cf.get("intervalos_incompletos") or [],
                          "areas_indeterminadas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "indeterminada"),
                          "areas_reprovadas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "reprovada"),
                          "faltam": cf.get("faltam") or []}
                         for cf in areas["conferencias"]],
        "mapeamento_epe": map_epe,
        "epe": {"camada": f"{et.SERVICO}/{et.CAMADA_SUBSISTEMAS}", "url_consulta": et.URL_SUBSISTEMAS,
                "arquivo": v.get("arquivo"), "sha256": v.get("sha256"), "capturado_em": v.get("capturado_em"),
                "ligacoes_pelo_nome": epe.get("ligacoes_pelo_nome") or [], "sem_uf": epe.get("sem_uf") or [],
                "erro": epe.get("erro")} if epe else None,
        "mapeamento_agua": map_agua, "mapeamento_carga": map_carga,
        "download": U["areas_csv"], "download_alternativas": U["alt_csv"],
    }


def _camadas():
    return [
        {"id": "submercado", "grao": "submercado", "rotulo": "Submercados",
         "geometria": "/energia/geo/uf.json", "agrupamento": "ufs[].subsistema",
         "descricao": ("Cada UF pintada pelo subsistema da camada oficial da EPE, com a pertença das suas áreas de carga provada pela "
                       "soma da carga do ONS. A divisa é a da UF: o ONS não publica limite geográfico do submercado. Os municípios "
                       "fora do SIN (sm_estado 'fora_do_sin' no índice municipal) recebem marca própria por cima: a cor da UF não "
                       "vale para eles."),
         "sobreposicao": {"arquivo": U["mun_json"], "campo": "sm_estado", "valor": "fora_do_sin"},
         "carregamento": "com a página"},
        {"id": "distribuidora", "grao": "distribuidora", "rotulo": "Áreas das distribuidoras",
         "geometria": "/energia/geo/municipios.json", "agrupamento": "índice municipal, campo dist (estado 1 ou 2)",
         "descricao": "Municípios inteiros agrupados pela relação oficial; município com mais de uma distribuidora tem marca própria.",
         "carregamento": "sob demanda (malha municipal e índice)", "arquivo": U["mun_json"]},
        {"id": "municipio", "grao": "municipio", "rotulo": "Municípios",
         "geometria": "/energia/geo/municipios.json", "agrupamento": None,
         "descricao": "Indicadores publicados por município (MMGD, Tarifa Social, Luz para Todos, usinas declaradas só no município, localidades isoladas).",
         "carregamento": "sob demanda (malha municipal e índice)", "arquivo": U["mun_json"]},
        {"id": "usinas", "grao": "usina", "rotulo": "Usinas", "geometria": None, "agrupamento": None,
         "descricao": "Pontos do SIGA na mesma grade da malha. A coordenada é aproximada (centróide do empreendimento).",
         "carregamento": "sob demanda", "arquivo": U["usi_json"]},
    ]


def _catalogo(ins, ano_q, mes_cde, lpt_anos):
    out = []
    for x in INDICADORES:
        m = MODULOS[x["modulo"]]
        out.append({**x, "rotulo_grao": GRAO[x["grao"]]["rotulo"], "rotulo_no_municipio": GRAO[x["grao"]]["rotulo_no_municipio"],
                    "pagina": m, "metrica": METRICA_DE.get(x["id"])})
    return out


def _referencias(ins, ano_q, mes_cde, mes_cad, lpt_anos, ciclo_isolados, areas, ano_pop):
    pg = (ins.get("perdas_gold") or {}).get("obj") or {}
    pm = (ins.get("perdas_municipios") or {}).get("obj") or {}
    tg = (ins.get("transicao_gold") or {}).get("obj") or {}
    cg = (ins.get("conta_gold") or {}).get("obj") or {}
    eg = (ins.get("expansao_gold") or {}).get("obj") or {}
    plg = (ins.get("pld_gold") or {}).get("obj") or {}
    ag = (ins.get("agua_gold") or {}).get("obj") or {}
    anos = sorted(lpt_anos)
    return {
        "relacao_distribuidoras_ano": pm.get("ano_relacao"),
        "perdas_ano": (pg.get("referencia") or {}).get("ano"),
        "qualidade_ano": ano_q,
        "tarifa_data": cg.get("data_referencia"),
        "mmgd_data_cadastro": (tg.get("mmgd") or {}).get("data_cadastro"),
        "siga_data": (eg.get("referencias") or {}).get("siga"),
        "tsee_mes_cde": mes_cde, "cadunico_mes": mes_cad,
        "lpt_periodo": {"inicio": anos[0], "fim": anos[-1]} if anos else None,
        "isolados_ciclo": ciclo_isolados,
        "pld_dia": plg.get("dia_referencia"),
        "ear_dia": (ag.get("dias_referencia") or {}).get("ear"),
        "areas_carga_dias": areas["dias"],
        "populacao_ano": ano_pop,
        "subsistema_uf_epe_capturado_em": ((areas.get("epe") or {}).get("vintage") or {}).get("capturado_em"),
    }


_DTB_CURTO = {it.DTB_2010: "DTB 2010", it.DTB_2005: "DTB 2005", it.DTB_2000: "DTB 2000"}


def _resumo(linhas_mun, vinculos, municipios, sem_vinculo, codigos_fora_malha, conj_mun, conjuntos, conj_sem_valor,
            contagem_usi, nao_reconhecidos, usi_multi_mun, isolados_mun, isol_sem_mun, tsee, tsee_sem_cod, mmgd, lpt,
            lpt_sem_cod, lpt_anos, uf_sm, lpt_por_nome):
    validos = {cod: [i for i, e in l if e in (1, 2)] for cod, l in vinculos.items()}
    P = {k: i for i, k in enumerate(k for k, _ in CAMPOS_MUN)}
    sm_estado = Counter(l[P["sm_estado"]] for l in linhas_mun)
    fora = [l for l in linhas_mun if l[P["sm_estado"]] == "fora_do_sin"]
    return {
        "municipios": len(municipios),
        "municipios_com_distribuidora": sum(1 for l in validos.values() if l),
        "municipios_compartilhados": sum(1 for l in validos.values() if len(l) > 1),
        "municipios_so_vinculo_nao_confirmado": sorted(cod for cod, l in vinculos.items() if l and not validos[cod]),
        "municipios_sem_vinculo": [{"codigo": cod, "nome": municipios[cod]["nome"], "uf": municipios[cod]["uf"]} for cod in sem_vinculo],
        "codigos_da_relacao_fora_da_malha": codigos_fora_malha,
        "municipios_por_estado_submercado": dict(sorted(sm_estado.items())),
        "municipios_com_conjunto": sum(1 for cod in municipios if conj_mun.get(cod)),
        "conjuntos_referenciados": len({x for cod in municipios for x in conj_mun.get(cod, [])}),
        "conjuntos_com_valor": len(conjuntos),
        "conjuntos_sem_valor_no_ano": len(conj_sem_valor),
        "municipios_com_mmgd_publicada": sum(1 for cod in municipios if cod in mmgd),
        "municipios_com_tsee_publicada": sum(1 for cod in municipios if cod in tsee),
        "codigos_tsee_sem_municipio_unico": sorted(set(tsee_sem_cod)),
        "municipios_com_lpt": sum(1 for cod in municipios if cod in lpt),
        "lpt_ligados_por_nome_domicilios": {k: c.r(v, 0) for k, v in sorted(lpt_por_nome.items())},
        "lpt_sem_codigo_ibge": [{"uf": uf, "municipio": nome, "domicilios": c.r(v, 0)} for (uf, nome), v in
                                sorted(lpt_sem_cod.items(), key=lambda kv: -kv[1])],
        "municipios_com_localidade_isolada": sum(1 for l in isolados_mun.values() if l),
        "municipios_fora_do_sin": {
            "total": len(fora), "sede_isolada": sum(1 for l in fora if l[P["isol_sede"]] == 1),
            "so_pela_populacao": sum(1 for l in fora if l[P["isol_sede"]] == 0),
            "limiar_populacao": LIMIAR_POP_ISOLADA,
            "regra": ("fora do SIN quando a sede é localidade isolada do PASI (nome da localidade igual ao do município) ou "
                      f"quando as localidades isoladas somam ao menos {int(LIMIAR_POP_ISOLADA * 100)}% da população estimada "
                      "do município; o submercado não se aplica (nulo)")},
        "localidades_isoladas_sem_municipio": isol_sem_mun,
        "usinas": {
            "total": contagem_usi.get("total", 0), "com_coordenada": contagem_usi.get("com_coordenada", 0),
            "todos_municipios_reconhecidos": contagem_usi.get("todos_reconhecidos", 0),
            "parcialmente_reconhecidos": contagem_usi.get("parcialmente_reconhecidos", 0),
            "sem_municipio_reconhecido": contagem_usi.get("sem_municipio_reconhecido", 0),
            "via_grafia_antiga": contagem_usi.get("via_grafia_antiga", 0),
            "multimunicipio": contagem_usi.get("multimunicipio", 0),
            "coordenada_no_municipio_declarado": contagem_usi.get("coord_no_declarado", 0),
            "coordenada_fora_do_municipio_declarado": contagem_usi.get("coord_fora_do_declarado", 0),
            "coordenada_fora_da_malha": contagem_usi.get("coord_fora_da_malha", 0),
            "operacao_sem_potencia_fiscalizada": contagem_usi.get("operacao_sem_potencia_fiscalizada", 0),
            "registros_ate_10kw": contagem_usi.get("registros_ate_10kw", 0),
            "registros_ate_10kw_multimunicipio": contagem_usi.get("registros_ate_10kw_multimunicipio", 0),
            "limite_registro_kw": LIMITE_REGISTRO_KW,
            "coordenada_fora_na_malha_simplificada": contagem_usi.get("simplificada_fora"),
            "simplificada_fora_maxima_dentro": contagem_usi.get("simplificada_fora_maxima_dentro"),
            "simplificada_dentro_maxima_fora": contagem_usi.get("simplificada_dentro_maxima_fora"),
            "nomes_nao_reconhecidos": [{"uf": uf or None, "nome": nome, "citacoes": n} for (uf, nome), n in
                                       sorted(nao_reconhecidos.items(), key=lambda kv: (-kv[1], kv[0]))],
            "grafias_antigas": [{"uf": uf, "nome_fonte": n, "codigo": cod, "origem": _DTB_CURTO[o]} for uf, n, cod, o in it.TOPONIMOS],
            "grafias_antigas_fontes": {v: k for k, v in _DTB_CURTO.items()},
        },
    }


# ---------------------------------------------------------------- validações

def _valida_granularidade():
    """Critério de aceite do P002: cada coluna de cada tabela tem o grão da tabela (ou é
    referência), e cada indicador do catálogo aponta para a tabela do seu grão."""
    out = []
    erros = []
    for nome, campos, grao in (("municípios", CAMPOS_MUN, "municipio"), ("conjuntos", CAMPOS_CONJ, "conjunto"),
                               ("usinas", CAMPOS_USI, "usina")):
        for k, gr in campos:
            if gr not in ("ref", grao):
                erros.append(f"{nome}.{k} tem grão {gr}")
    tabela = {"submercado": "submercados[]", "uf": "ufs[]", "distribuidora": "distribuidoras[]",
              "conjunto": "municipios.conjuntos", "municipio": "municipios.", "usina": "usinas."}
    for x in INDICADORES:
        if not x["campo"].startswith(tabela[x["grao"]]):
            erros.append(f"indicador {x['id']} ({x['grao']}) publicado em {x['campo']}")
        if x["grao"] not in GRAO:
            erros.append(f"indicador {x['id']} com grão desconhecido")
    mun_ind = {k for k, gr in CAMPOS_MUN if gr == "municipio"}
    for x in INDICADORES:
        if x["grao"] != "municipio":
            for k in mun_ind:
                if x["campo"].endswith("." + k):
                    erros.append(f"indicador {x['id']} de grão {x['grao']} numa coluna municipal")
    out.append({"nome": "Nenhum indicador abaixo do grão de origem (estrutura das tabelas)",
                "resultado": "reprovado" if erros else "aprovado", "critico": True,
                "detalhe": "; ".join(erros) if erros else
                f"{len(CAMPOS_MUN)} colunas municipais, {len(CAMPOS_CONJ)} de conjunto e {len(CAMPOS_USI)} de usina com grão próprio ou referência; {len(INDICADORES)} indicadores na tabela do seu grão"})
    return out


def _valida_granularidade_valores(linhas_mun, distribuidoras):
    """Conferência por valor: nenhuma coluna municipal reproduz, município a município, um
    indicador da distribuidora exclusiva (sinal de taxa de distribuidora copiada para o
    município). Só municípios com uma única distribuidora e valor não nulo entram."""
    taxas = {d["i"]: d["indicadores"] for d in distribuidoras}
    campos = [k for k, _ in CAMPOS_MUN]
    pos = {k: campos.index(k) for k, gr in CAMPOS_MUN if gr == "municipio"}
    iguais = Counter()
    n = 0
    for l in linhas_mun:
        dist = [i for i, e in l[campos.index("dist")] if e in (1, 2)]
        if len(dist) != 1:
            continue
        ind = taxas.get(dist[0]) or {}
        alvo = []
        for bloco, chave in (("perdas", "taxa_total_pct"), ("qualidade", "dec_h"), ("qualidade", "fec"),
                             ("tarifa", "total_rs_mwh"), ("tsee", "participacao_pct")):
            b = ind.get(bloco) or {}
            if b.get("disponivel") and b.get(chave) is not None:
                alvo.append((bloco, chave, b[chave]))
        if not alvo:
            continue
        n += 1
        for k, p in pos.items():
            v = l[p]
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                for bloco, chave, a in alvo:
                    if abs(v - a) < 1e-9:
                        iguais[(k, f"{bloco}.{chave}")] += 1
    # coincidência isolada é possível (números pequenos); cópia sistemática não
    sistematicos = {k: v for k, v in iguais.items() if n and v > max(5, 0.02 * n)}
    return {"nome": "Nenhum indicador da distribuidora copiado para o município (valores)",
            "resultado": "reprovado" if sistematicos else "aprovado", "critico": True,
            "detalhe": (f"cópias sistemáticas: {sistematicos}" if sistematicos else
                        f"{n} municípios com uma única distribuidora conferidos; coincidências isoladas: {sum(iguais.values())}")}


def _validacoes(linhas_mun, municipios, vinculos, distribuidoras, conjuntos, usinas, contagem_usi, pm, pg, eg,
                soma_uf_op, conj_cnpj_mun, cnpjs_rel, areas, uf_sm):
    ctr, ress = [], []
    campos = [k for k, _ in CAMPOS_MUN]
    # chaves únicas e universo
    cods = [l[0] for l in linhas_mun]
    ctr.append({"nome": "Um registro por município da malha do IBGE", "critico": True,
                "resultado": "aprovado" if len(cods) == len(set(cods)) == len(municipios) else "reprovado",
                "detalhe": f"{len(cods)} linhas, {len(set(cods))} códigos, {len(municipios)} na malha"})
    # referências válidas
    n_dist = len(distribuidoras)
    ruins = [l[0] for l in linhas_mun if any(not (0 <= i < n_dist) or e not in (0, 1, 2) for i, e in l[campos.index("dist")])]
    ctr.append({"nome": "Referências a distribuidoras válidas", "critico": True,
                "resultado": "reprovado" if ruins else "aprovado", "detalhe": f"{len(ruins)} municípios com referência inválida"})
    # reconciliação com o módulo Perdas (contagens publicadas na gold dele)
    mapa = pg.get("mapa") or {}
    comp = sum(1 for l in vinculos.values() if sum(1 for _, e in l if e in (1, 2)) > 1)
    fora = {cod: v for cod, v in (pm.get("municipios") or {}).items() if cod not in municipios}
    nao_conf = sum(1 for l in vinculos.values() for _, e in l if e == 0)
    nao_conf_fora = sum(1 for v in fora.values() for _, e in v.get("d") or [] if int(e) == 0)
    tot_v = sum(len(l) for l in vinculos.values())
    tot_fora = sum(len(v.get("d") or []) for v in fora.values())
    esperado = (mapa.get("municipios_compartilhados"), mapa.get("vinculos_nao_confirmados"), mapa.get("vinculos"))
    ok = esperado == (comp, nao_conf + nao_conf_fora, tot_v + tot_fora)
    ctr.append({"nome": "Compartilhados, vínculos e vínculos sem confirmação iguais aos da base de Perdas", "critico": False,
                "resultado": "aprovado" if ok else "ressalva",
                "detalhe": (f"compartilhados {comp} (Perdas: {esperado[0]}); vínculos {tot_v} na malha + {tot_fora} de códigos fora "
                            f"dela (Perdas: {esperado[2]}); sem confirmação {nao_conf} + {nao_conf_fora} (Perdas: {esperado[1]})")})
    # área por distribuidora contra a base de Perdas (confirmados + só MMGD)
    pd = {d["cnpj"]: d for d in pg.get("distribuidoras") or []}
    difs = []
    for d in distribuidoras:
        t = (pd.get(d["cnpj"]) or {}).get("territorio") or {}
        if t and (t.get("confirmados"), t.get("so_mmgd")) != (d["area"]["confirmados"], d["area"]["so_mmgd"]):
            difs.append(f"{d['sigla']}: {d['area']['confirmados']}+{d['area']['so_mmgd']} contra {t.get('confirmados')}+{t.get('so_mmgd')}")
    ctr.append({"nome": "Municípios por distribuidora iguais aos da base de Perdas", "critico": False,
                "resultado": "aprovado" if not difs else "ressalva",
                "detalhe": f"{len(distribuidoras)} distribuidoras; diferenças: {difs[:10] or 'nenhuma'}"})
    # relação de Perdas (2026) × relação de Qualidade (conjuntos do ano de referência): mesmo CNPJ por município
    iguais = dif = 0
    exemplos = []
    sem_conjunto_ativo = 0
    diferencas = []
    for cod in municipios:
        a = {cnpjs_rel[i] for i, e in vinculos.get(cod, [])}
        b = conj_cnpj_mun.get(cod)
        if b is None:
            continue
        if not b:  # o módulo Qualidade não tem conjunto com valor no município: nada a comparar
            sem_conjunto_ativo += 1
            continue
        if a == b:
            iguais += 1
        else:
            dif += 1
            diferencas.append({"codigo": cod, "nome": municipios[cod]["nome"], "uf": municipios[cod]["uf"],
                               "perdas": sorted(a), "qualidade": sorted(b)})
            if len(exemplos) < 10:
                exemplos.append(f"{cod}: Perdas {sorted(a)} × Qualidade {sorted(b)}")
    ctr.append({"nome": "Distribuidoras por município: relação de Perdas × conjuntos de Qualidade", "critico": False,
                "resultado": "aprovado" if dif == 0 else "ressalva",
                "detalhe": (f"{iguais} municípios com o mesmo conjunto de CNPJs e {dif} diferentes; {sem_conjunto_ativo} sem conjunto "
                            f"com valor na Qualidade (Perdas usa a relação de {pm.get('ano_relacao')}; Qualidade, os conjuntos do ano "
                            f"de referência dos indicadores). Exemplos: {exemplos[:5]}")})
    if dif:
        ress.append(f"{dif} municípios têm distribuidoras diferentes na relação usada pelo módulo Perdas e na dos conjuntos do módulo Qualidade; o mapa usa a de Perdas (estado do vínculo) e lista os conjuntos como a Qualidade os publica.")
    # usinas: soma por UF contra a gold de Expansão
    cap = {x["uf"]: x.get("mw_fiscalizado") for x in (eg.get("capacidade_instalada") or {}).get("por_uf") or []}
    difs_uf = {uf: (c.r(soma_uf_op.get(uf), 1), v) for uf, v in cap.items() if v is not None and abs((soma_uf_op.get(uf) or 0) - v) > 0.05 + 1e-9}
    ctr.append({"nome": "Potência em operação por UF (usinas do CSV) igual à da gold de Expansão", "critico": False,
                "resultado": "aprovado" if cap and not difs_uf else "ressalva",
                "detalhe": f"{len(cap)} UFs comparadas, tolerância 0,05 MW (arredondamento a 0,1 MW na gold); diferenças: {difs_uf or 'nenhuma'}"})
    # usinas sem município reconhecido: só listagem
    ctr.append({"nome": "Usinas com todos os municípios declarados reconhecidos no cadastro do IBGE", "critico": False,
                "resultado": "aprovado" if contagem_usi.get("total") and contagem_usi.get("todos_reconhecidos", 0) / contagem_usi["total"] >= 0.99 else "ressalva",
                "detalhe": f"{contagem_usi.get('todos_reconhecidos', 0)} de {contagem_usi.get('total', 0)}; {contagem_usi.get('via_grafia_antiga', 0)} pela tabela de grafias antigas; as demais listadas"})
    # coordenadas
    no, fora = contagem_usi.get("coord_no_declarado", 0), contagem_usi.get("coord_fora_do_declarado", 0)
    maxima = contagem_usi.get("simplificada_fora") is not None
    comp = (f" Na malha simplificada do mapa seriam {contagem_usi.get('simplificada_fora')} fora: "
            f"{contagem_usi.get('simplificada_fora_maxima_dentro')} delas estão dentro na malha máxima (falsos positivos da "
            f"simplificação) e {contagem_usi.get('simplificada_dentro_maxima_fora')} estão fora na máxima e dentro na simplificada."
            if maxima else " Malha simplificada do mapa (aproximada): o número de usinas fora é um limite superior.")
    ctr.append({"nome": "Coordenada do SIGA dentro do município declarado (ponto em polígono na malha "
                        + ("de qualidade máxima do IBGE)" if maxima else "simplificada, aproximada)"), "critico": False,
                "resultado": "aprovado" if maxima and no + fora and no / (no + fora) >= 0.9 else "ressalva",
                "detalhe": (f"{no} dentro, {fora} fora, {contagem_usi.get('coord_fora_da_malha', 0)} fora de qualquer município "
                            f"(mar, coordenada fora do Brasil).{comp} Conferência, não correção: o município declarado prevalece.")})
    # extremos da contagem municipal: o topo da contagem de usinas não pode conter registros
    # de até 10 kW (que têm coluna própria), e os dois topos são publicados lado a lado
    P = {k: i for i, k in enumerate(campos)}
    top_op = sorted(linhas_mun, key=lambda l: -l[P["usi_op_n"]])[:5]
    top_reg = sorted(linhas_mun, key=lambda l: -l[P["usi_reg_n"]])[:5]
    alvo = {l[0] for l in top_op}
    soma_topo = {l[0]: l[P["usi_op_n"]] for l in top_op}
    refeito = Counter(u[9][0] for u in usinas if u[3] == "operacao" and u[10] == 1 and len(u[9]) == 1 and u[9][0] in alvo
                      and not (u[12] == "Registro" and u[5] is not None and u[5] * 1000.0 <= LIMITE_REGISTRO_KW))
    difs_topo = {cod: (soma_topo[cod], refeito.get(cod, 0)) for cod in alvo if soma_topo[cod] != refeito.get(cod, 0)}
    ctr.append({"nome": "Extremos da contagem municipal de usinas, sem os registros de até 10 kW", "critico": False,
                "resultado": "aprovado" if not difs_topo else "ressalva",
                "detalhe": ("maiores contagens de usinas: " + ", ".join(f"{l[1]} ({l[2]}) {l[P['usi_op_n']]}" for l in top_op)
                            + "; maiores contagens de registros de até 10 kW (coluna própria): "
                            + ", ".join(f"{l[1]} ({l[2]}) {l[P['usi_reg_n']]}" for l in top_reg)
                            + (f"; divergências no topo: {difs_topo}" if difs_topo else ""))})
    # físicos: potências e contagens não negativas
    neg = [l[0] for l in linhas_mun for k in ("mmgd_un", "mmgd_kw", "tsee_faturas", "usi_op_mw", "usi_cart_mw", "lpt_dom", "pop")
           if isinstance(l[campos.index(k)], (int, float)) and l[campos.index(k)] < 0]
    neg += [u[0] for u in usinas if (u[5] is not None and u[5] < 0) or (u[6] is not None and u[6] < 0)]
    ctr.append({"nome": "Contagens e potências não negativas", "critico": True,
                "resultado": "reprovado" if neg else "aprovado", "detalhe": f"{len(neg)} violações {neg[:5]}"})
    # percentuais da distribuidora na faixa física de 0% a 100% (perdas totais negativas são
    # impossíveis fisicamente: aparecem com ressalva no bloco, como a fonte publica)
    fora = [f"{d['sigla']} ({b} {d['indicadores'][b][k]}%)" for d in distribuidoras
            for b, k in (("perdas", "taxa_total_pct"), ("tsee", "participacao_pct"))
            if (d["indicadores"].get(b) or {}).get(k) is not None and not (0 <= d["indicadores"][b][k] <= 100)]
    parciais = [d["sigla"] for d in distribuidoras if (d["indicadores"].get("perdas") or {}).get("parcial")]
    ctr.append({"nome": "Percentuais da distribuidora na faixa física de 0% a 100%", "critico": False,
                "resultado": "ressalva" if fora else "aprovado",
                "detalhe": f"fora da faixa: {fora or 'nenhum'} (mantidos como a fonte publica, com ressalva no bloco)"})
    ctr.append({"nome": "Ano incompleto: perdas e qualidade com o mesmo critério (12 meses)", "critico": False,
                "resultado": "ressalva" if parciais else "aprovado",
                "detalhe": (f"{len(parciais)} distribuidoras com taxa de perdas de ano parcial, marcadas (parcial = true) e com ressalva: "
                            f"{parciais or 'nenhuma'}; DEC e FEC de ano parcial não são publicados pelo módulo Qualidade e o bloco sai "
                            "indisponível com o motivo")})
    # áreas de carga
    if areas["conferencias"]:
        ok = all(cf.get("completo") and cf.get("fecha") and
                 not [a for a, x in cf["areas"].items() if x["veredito"] in ("reprovada", "ambigua")]
                 for cf in areas["conferencias"])

        def _txt(cf):
            if not cf.get("completo"):
                return f"{cf['dia']}: incompleto ({cf.get('motivo') or 'faltam ' + ', '.join(cf.get('faltam') or [])})"
            ma = cf.get("menor_alternativa") or {}
            return (f"{cf['dia']}: mediana do resíduo por meia hora " +
                    ", ".join(f"{sm} {x['mediana_abs_mwmed']:.1f}" for sm, x in cf["submercados"].items()) +
                    f" MWmed (tolerância {cf['tolerancia_mwmed']:.0f}); menor alternativa: {ma.get('descricao')} com "
                    f"{(ma.get('mediana_abs_mwmed') or 0):.1f} MWmed entre {cf.get('alternativas_avaliadas')} avaliadas")
        ctr.append({"nome": "Áreas de carga do ONS fecham com os submercados e nenhuma alternativa fecha (pertença provada)",
                    "critico": False, "resultado": "aprovado" if ok and len(areas["conferencias"]) >= 2 else "ressalva",
                    "detalhe": "; ".join(_txt(cf) for cf in areas["conferencias"])})
        epe = (areas.get("epe") or {}).get("mapeamento") or {}
        provado = {uf: x["subsistema"] for uf, x in uf_sm.items() if x.get("subsistema")}
        difs = sorted(uf for uf in provado if epe and epe.get(uf) != provado[uf])
        ctr.append({"nome": "Subsistema provado pela soma das áreas de carga igual ao da camada oficial da EPE", "critico": False,
                    "resultado": "aprovado" if epe and len(provado) == len(ot.UFS) and not difs else "ressalva",
                    "detalhe": (f"{len(provado)} UFs provadas; camada da EPE com {len(epe)} UFs; diferentes: {difs or 'nenhuma'}"
                                if epe else "camada da EPE sem captura nesta execução")})
        if any(x["estado"] == "provado_com_area_sem_carga" for x in uf_sm.values()):
            ress.append("Tocantins tem duas áreas de carga no dicionário do ONS (TON, Tocantins Norte, e TOCO, Tocantins); TOCO teve carga zero nos dias conferidos, então só a pertença de TON ao Norte é provada pela soma e o estado da UF fica 'provado_com_area_sem_carga'.")
    else:
        ctr.append({"nome": "Áreas de carga do ONS fecham com os submercados (pertença provada)", "critico": False,
                    "resultado": "ressalva", "detalhe": "sem conferência no silver (coleta não executada ou falhou)"})
    ctr.append(_valida_granularidade_valores(linhas_mun, distribuidoras))
    return {"controles": ctr, "ressalvas": ress, "diferencas_perdas_qualidade": diferencas}


# ---------------------------------------------------------------- CSV

def _escreve_csvs(linhas_mun, distribuidoras, conjuntos, n_mun_conj, usi_csv, areas, idx_dist):
    campos = [k for k, _ in CAMPOS_MUN]
    P = {k: i for i, k in enumerate(campos)}
    sig = {d["i"]: (d["sigla"], d["cnpj"]) for d in distribuidoras}
    linhas = []
    for l in linhas_mun:
        dist = "|".join(f"{sig[i][0]}:{sig[i][1]}:{e}" for i, e in l[P["dist"]])
        linhas.append([l[P["ibge"]], l[P["nome"]], l[P["uf"]], l[P["sm"]], l[P["sm_estado"]], l[P["isol_sede"]], l[P["isol_n"]],
                       l[P["isol_pop"]], dist or None, " ".join(str(x) for x in l[P["conj"]]) or None, l[P["pop"]], l[P["mmgd_un"]],
                       l[P["mmgd_kw"]], l[P["mmgd_w_hab"]], l[P["tsee_faturas"]], l[P["tsee_desconto"]], l[P["tsee_proxy_pct"]],
                       l[P["tsee_base_pequena"]], l[P["lpt_dom"]], l[P["usi_op_n"]], l[P["usi_op_mw"]], l[P["usi_cart_n"]],
                       l[P["usi_cart_mw"]], l[P["usi_reg_n"]], l[P["usi_reg_kw"]], len(l[P["usi_multi"]]),
                       " ".join(l[P["usi_multi"]]) or None])
    base.escreve_csv(ARQ_MUN_CSV, ["codigo_ibge", "municipio", "uf", "submercado", "estado_submercado", "sede_isolada",
                                   "localidades_isoladas", "populacao_isolada", "distribuidoras", "conjuntos", "populacao",
                                   "mmgd_unidades", "mmgd_kw", "mmgd_w_por_habitante", "tsee_faturas", "tsee_desconto_reais",
                                   "tsee_razao_proxy_pct", "tsee_base_pequena", "lpt_domicilios", "usinas_operacao_so_no_municipio",
                                   "usinas_operacao_mw_fiscalizado", "usinas_carteira_so_no_municipio",
                                   "usinas_carteira_mw_outorgado", "registros_ate_10kw_so_no_municipio",
                                   "registros_ate_10kw_kw_fiscalizado", "usinas_em_varios_municipios",
                                   "ceg_usinas_em_varios_municipios"],
                     linhas)
    dl = []
    for d in distribuidoras:
        ind = d["indicadores"]

        def v(b, k):
            x = ind.get(b) or {}
            return x.get(k) if x.get("disponivel") else None

        def per(b):
            x = ind.get(b) or {}
            p = x.get("periodo") or {}
            return p.get("fim") if x.get("disponivel") else None
        a = d["area"]
        pparc = v("perdas", "parcial")
        dl.append([d["cnpj"], d["sigla"], d["nome"], a["municipios"], a["confirmados"], a["so_mmgd"], a["nao_confirmados"],
                   a["exclusivos"], a["compartilhados"], a["fora_do_sin"], a["com_localidade_isolada"], " ".join(a["ufs"]) or None,
                   " ".join(f"{x['sm']}:{x['municipios']}" for x in d["submercados"]) or None, d["submercado_unico"],
                   per("perdas"), None if pparc is None else int(pparc), v("perdas", "taxa_total_pct"),
                   v("perdas", "perdas_totais_mwh"), v("perdas", "injetada_mwh"),
                   v("perdas", "pnt_bt_pct"), per("qualidade"), v("qualidade", "dec_h"), v("qualidade", "fec"),
                   v("qualidade", "dec_limite_h"), v("qualidade", "fec_limite"), per("tarifa"), v("tarifa", "total_rs_mwh"),
                   v("tarifa", "te_rs_mwh"), v("tarifa", "tusd_rs_mwh"), v("tarifa", "ato"), per("mmgd"), v("mmgd", "unidades"),
                   v("mmgd", "potencia_mw"), per("tsee"), v("tsee", "uc_tsee"), v("tsee", "participacao_pct")])
    base.escreve_csv(ARQ_DIST_CSV, ["cnpj", "sigla", "nome", "municipios", "confirmados", "so_mmgd", "nao_confirmados", "exclusivos",
                                    "compartilhados", "municipios_fora_do_sin", "municipios_com_localidade_isolada", "ufs",
                                    "submercados", "submercado_unico", "perdas_ano", "perdas_ano_parcial", "perdas_taxa_total_pct",
                                    "perdas_totais_mwh", "injetada_mwh", "pnt_bt_pct", "qualidade_ano", "dec_h", "fec",
                                    "dec_limite_h", "fec_limite", "tarifa_data", "tarifa_b1_total_rs_mwh", "te_rs_mwh",
                                    "tusd_rs_mwh", "tarifa_ato", "mmgd_data_cadastro", "mmgd_unidades", "mmgd_potencia_mw",
                                    "tsee_mes", "tsee_unidades", "tsee_participacao_pct"], dl)
    cl = [[k, x["nome"], x["cnpj"], x["sigla"], x["ano"], x["meses"], x["dec_h"], x["fec"], x["dec_lim_h"], x["fec_lim"],
           x["ucs"], n_mun_conj.get(k, 0)] for k, x in sorted(conjuntos.items(), key=lambda kv: int(kv[0]))]
    base.escreve_csv(ARQ_CONJ_CSV, ["conjunto", "nome", "cnpj", "sigla", "ano", "meses", "dec_h", "fec", "dec_limite_h",
                                    "fec_limite", "ucs_media", "municipios"], cl)
    base.escreve_csv(ARQ_USI_CSV, ["ceg", "nome", "tipo", "estagio", "uf", "municipios_siga", "municipios_ibge", "via", "lat",
                                   "lon", "municipio_da_coordenada", "coord_no_declarado", "mw_fiscalizado", "mw_outorgado",
                                   "outorga", "registro_ate_10kw", "malha_conferencia"], usi_csv)
    base.escreve_csv(ARQ_AREAS_CSV, ["dia", "area", "nome", "tipo", "ufs", "submercado_hipotese", "carga_media_mwmed", "meias_horas",
                                     "veredito", "soma_areas_mwmed", "residuo_medio_mwmed", "residuo_mediana_abs_mwmed",
                                     "residuo_max_abs_mwmed", "tolerancia_mwmed"], areas["linhas_csv"])
    base.escreve_csv(ARQ_ALT_CSV, ["dia", "alternativa", "areas", "mediana_abs_meia_hora_mwmed", "residuo_medias_dia_mwmed",
                                   "tolerancia_mwmed", "fecha"], areas["linhas_alt"])


# ---------------------------------------------------------------- proveniência e evidência

LIMITACOES = [
    "Não há polígono oficial de área de concessão acessível: a área de cada distribuidora é desenhada pelos municípios inteiros que a relação oficial da ANEEL liga a ela, e município atendido por mais de uma distribuidora aparece em todas, com marca própria. Os limites internos de um município compartilhado não são conhecidos.",
    "Não há tabela oficial município → submercado. O submercado do município é o da sua UF (camada oficial da EPE, provada pela soma da carga das áreas de carga do ONS). Município cuja sede é localidade isolada do PASI, ou com ao menos metade da população em localidades isoladas, fica fora do SIN e sem submercado; nos demais com localidade isolada, o submercado da UF vale com aviso. A população do PASI e a estimativa do IBGE têm bases diferentes: a razão separa os dois grupos, não mede a parte exata do município fora do SIN.",
    "O submercado de uma usina depende do ponto de conexão à rede, que o SIGA não publica; usina não é ligada a submercado.",
    "Indicador de distribuidora (perdas, tarifa, DEC e FEC, Tarifa Social da distribuidora) é da área inteira: não descreve o município e não pode ser comparado entre municípios da mesma distribuidora.",
    "DEC e FEC do conjunto elétrico são do conjunto inteiro: um conjunto pode cobrir vários municípios ou só parte de um.",
    "Usina declarada em vários municípios não tem a potência repartida: aparece listada em cada um deles e fica fora da soma municipal. Registros do SIGA de até 10 kW em operação (em geral sistemas fotovoltaicos individuais de 1 a 3 kW, de propriedade da distribuidora) ficam numa coluna própria, fora da contagem de usinas do município.",
    "As datas de referência diferem entre fontes (relação de distribuidoras de 2026, perdas e qualidade do último ano completo, tarifa vigente, cadastro de MMGD do dia, Tarifa Social do mês da CDE): cada número traz o seu período.",
]
BLOQUEIOS = [
    {"item": "Polígono oficial de área de concessão das distribuidoras",
     "tentativas": ["SIGEL (sigel.aneel.gov.br): sem resposta nos testes de 30/09 e 01/10/2026 (conexão encerrada após 11 a 12 s; registrado também pelo módulo Perdas)",
                    "BDGD (entidade ARAT): File Geodatabase por distribuidora e ano, sem leitor no ambiente (GDAL ausente), segundo o módulo Perdas",
                    "WebMap da EPE (serviço WMS_Webmap_EPE_Data): tem a camada de UF × subsistema (24) e a de sistemas isolados (27), mas nenhuma camada de área de concessão de distribuidora"],
     "evidencia": "docs/observatorios/energia/modulos/perdas.md, seção de bloqueios",
     "dependencia": "acesso ao SIGEL ou leitor de File Geodatabase no pipeline; até lá a área é a união de municípios inteiros"},
    {"item": "Correspondência oficial município → submercado",
     "tentativas": ["WebMap da EPE, camada 24 (Unidades da federação e Subsistemas do SIN, direitos EPE, ONS e IBGE): correspondência oficial UF → subsistema, adotada; não desce ao município",
                    "WebMap da EPE, camada 27 (Sistemas Isolados): localidades isoladas como pontos, sem a parte do município que elas atendem",
                    "dicionário de dados da Carga Verificada do ONS (lista as áreas de carga, sem o submercado de cada uma)",
                    "API de carga por área do ONS: pertença das áreas ao submercado provada pela soma (reconciliação independente da camada da EPE)"],
     "evidencia": f"{et.SERVICO}/{et.CAMADA_SUBSISTEMAS}",
     "dependencia": "tabela oficial de submercado por município (ou polígono da parte do município ligada ao SIN); até lá, a UF decide e o PASI marca os municípios fora do SIN; a área TOCO, sem carga, fica indeterminada"},
]


def _prov_de(gold_obj, chave_prov):
    """Proveniência publicada pelo módulo de origem (ou None)."""
    p = gold_obj or {}
    for parte in chave_prov.split("."):
        p = (p or {}).get(parte) if isinstance(p, dict) else None
    return p if isinstance(p, dict) and p.get("fonte") else None


def _periodo(inicio, fim=None):
    """Período do valor exibido (texto ISO); None quando o valor não tem referência."""
    if inicio is None:
        return None
    return {"inicio": str(inicio), "fim": str(fim if fim is not None else inicio)}


def _prov_derivada(indicador, origem, transformacoes, limitacoes, unidade, frequencia, download, natureza=None, formula=None,
                   periodo=None, herda_formula=True):
    """Proveniência de um bloco que só reapresenta, no território, um número de outro
    módulo: fonte, captura, snapshot e revisões vêm da proveniência de origem; o período
    é o do valor exibido (`periodo`), e a cobertura histórica da fonte fica em `cobertura`.
    `herda_formula=False` quando a proveniência de origem descreve outro agregado (ex.: a
    EAR do SIN, cuja fórmula não vale para o subsistema que a fonte publica pronto)."""
    if not origem:
        return None
    nat = natureza or origem.get("natureza") or "OBSERVADO"
    form = formula or (origem.get("formula") if herda_formula else None)
    if nat == "CALCULADO" and not form:
        form = "ver proveniência do módulo de origem"
    return c.proveniencia(
        indicador=indicador, natureza=nat, fonte=origem.get("fonte"), unidade=unidade, frequencia=frequencia,
        periodo=periodo or origem.get("periodo_referencia"), cobertura=origem.get("cobertura_historica") or origem.get("periodo_referencia"),
        capturado_em=origem.get("capturado_em"), snapshot=origem.get("snapshot") or {},
        limitacoes=list(limitacoes) + list(origem.get("limitacoes") or [])[:3],
        transformacoes=list(transformacoes) + ([f"origem: {t}" for t in (origem.get("transformacoes") or [])[:4]] if herda_formula else []),
        formula=form,
        publicado_em=origem.get("publicado_pela_fonte_em"), revisoes=origem.get("revisoes_conhecidas"), download=download,
        publicacao_informada=origem.get("publicado_pela_fonte_em") is not None)


FAMILIA_POPULACAO = "aneel_mmgd"    # silver em que o módulo Transição guarda a coleta do IBGE (SIDRA 6579)
DS_POPULACAO = "ibge_populacao_6579"


def _snapshot_populacao():
    """Snapshot da coleta da população do IBGE feita pelo módulo Transição (silver só lido,
    em modo somente leitura). Vazio quando o silver não existe."""
    import sqlite3
    caminho = os.path.join(base.SILVER, f"{FAMILIA_POPULACAO}.db")
    if not os.path.exists(caminho):
        return {}, None
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True, timeout=30)
    try:
        return c.snapshot_de(con, DS_POPULACAO), base.ultima_vintage(con, DS_POPULACAO, "sidra_6579_ultimo_ano")
    except sqlite3.Error:
        return {}, None
    finally:
        con.close()


def _proveniencias(con, ins, snap, ano_q, mes_cde, lpt_anos, areas, ano_pop, ciclo_isolados, malha_info):
    O = lambda k: (ins.get(k) or {}).get("obj") or {}  # noqa: E731
    out = {}
    pm = ins["perdas_municipios"]
    ano_rel = O("perdas_municipios").get("ano_relacao")
    # a relação vem da captura do módulo Perdas (IndQual Município e limites): a data de
    # captura e de publicação do índice são as dela, não a da geração do arquivo intermediário
    prel = _prov_de(O("perdas_gold"), "proveniencia.territorio") or {}
    out["indice"] = c.proveniencia(
        indicador="Índice territorial: distribuidoras, conjuntos e submercado de cada município", natureza="CALCULADO",
        fonte={"orgao": "ANEEL, EPE, ONS e IBGE (via módulos do observatório e coletas próprias)",
               "dataset": "relação conjunto × município (ANEEL, IndQual Município e limites de continuidade), UF × subsistema (EPE, WebMap), carga por área (ONS), malha municipal (IBGE), PASI (EPE)",
               "recurso": "; ".join(sorted(os.path.basename(x["arquivo"]) for x in ins.values() if x)),
               "url_dataset": "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio",
               "url_primaria": "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio",
               "licenca": "ODbL (ANEEL), CC-BY (ONS), uso livre com citação (IBGE e EPE)"},
        unidade="municípios e referências", frequencia="a cada execução, sobre as bases publicadas",
        periodo=_periodo(ano_rel), cobertura=_periodo(ano_rel),
        capturado_em=prel.get("capturado_em") or (base.instante_utc(pm["gerado_em"]) if pm.get("gerado_em") else None),
        snapshot=snap, limitacoes=LIMITACOES[:3],
        transformacoes=["município IBGE da malha publicada (5.571) como universo",
                        "distribuidoras e estado do vínculo lidos de perdas_municipios.json (módulo Perdas), sem reclassificação",
                        "conjuntos de qualidade_municipios.csv (módulo Qualidade) e valores do ano de referência de qualidade_conjuntos_anual_2020_2029.csv",
                        "submercado pela UF (camada 24 do WebMap da EPE), com a pertença das áreas de carga provada pela soma da carga verificada do ONS",
                        f"fora do SIN (submercado nulo) quando a sede é localidade isolada do PASI ou as localidades isoladas somam ao menos {int(LIMIAR_POP_ISOLADA * 100)}% da população estimada",
                        "código IBGE de 6 dígitos (Tarifa Social, Luz para Todos) completado pelo único código de 7 dígitos com o mesmo prefixo"],
        formula="vínculo(m, d) = vínculo publicado pelo módulo Perdas; submercado(m) = subsistema provado da UF de m, ou nulo se m está fora do SIN",
        publicado_em=prel.get("publicado_pela_fonte_em"), revisoes=prel.get("revisoes_conhecidas"), download=U["mun_csv"],
        publicacao_informada=prel.get("publicado_pela_fonte_em") is not None)
    out["areas_carga"] = c.proveniencia(
        indicador="Pertença das áreas de carga ao submercado (fechamento da carga verificada)", natureza="CALCULADO",
        fonte={"orgao": "ONS", "dataset": "Carga de Energia Verificada", "recurso": "API cargaverificada por cod_areacarga (34 áreas, 2 dias)",
               "url_dataset": ot.URL_DATASET, "url_primaria": "https://apicarga.ons.org.br/prd/cargaverificada", "licenca": c.LICENCA_ONS},
        unidade="MWmed", frequencia="conferência a cada 30 dias", periodo=_periodo(min(areas["dias"]), max(areas["dias"])) if areas["dias"] else None,
        cobertura=_periodo(min(areas["dias"]), max(areas["dias"])) if areas["dias"] else None,
        capturado_em=c.ultima_captura(c.snapshot_de(con, DS_AREAS)), snapshot=c.snapshot_de(con, DS_AREAS),
        limitacoes=["O ONS consiste a carga depois e pode revisá-la; uma meia hora em consistência aparece como resíduo isolado e não muda a mediana.",
                    "Área com carga zero nos dias conferidos (TOCO) não tem a pertença provada pela soma.",
                    "A divisa geográfica do submercado no mapa é a da UF: o ONS não publica limite geográfico de área de carga."],
        transformacoes=["val_cargaglobal por área e meia hora (fim do intervalo em UTC)",
                        "resíduo por meia hora = Σ áreas geoelétricas + área de perdas − submercado, nas meias horas comuns",
                        "área provada quando a hipótese fecha e nenhuma alternativa que a envolva (mover ou trocar) fecha",
                        "resíduo pelas médias do dia publicado ao lado da mediana, para cada alternativa"],
        formula="resíduo(sm, h) = Σ_a∈sm carga(a, h) + carga(perdas_sm, h) − carga(sm, h) por meia hora h; fecha se mediana_h |resíduo| ≤ 15 MWmed",
        download=U["areas_csv"])
    epe = areas.get("epe") or {}
    ve = epe.get("vintage") or {}
    if epe.get("mapeamento"):
        snap_epe = c.snapshot_de(con, DS_EPE)
        dia_epe = (ve.get("capturado_em") or "")[:10] or None
        out["subsistema_uf"] = c.proveniencia(
            indicador="Subsistema do SIN de cada UF (camada oficial da EPE)", natureza="OBSERVADO",
            fonte={"orgao": "EPE (direitos da camada: EPE, ONS e IBGE)", "dataset": "WebMap EPE: Unidades da federação e Subsistemas do Sistema Interligado Nacional",
                   "recurso": f"camada {et.CAMADA_SUBSISTEMAS} do serviço WMS_Webmap_EPE_Data (atributos UF, Nome e subsistee)",
                   "url_dataset": et.URL_WEBMAP, "url_primaria": et.URL_SUBSISTEMAS, "licenca": et.LICENCA_EPE},
            unidade="subsistema (SE, S, NE, N)", frequencia="cadastro vigente (recoleta a cada 30 dias)",
            periodo=_periodo(dia_epe), cobertura=_periodo(dia_epe),
            capturado_em=ve.get("capturado_em"), snapshot=snap_epe,
            limitacoes=["A camada não informa data de referência: vale como vigente no dia da consulta.",
                        "A camada traz a sigla 'BH' para a Bahia e o nome 'DF' para o Distrito Federal: a ligação à UF do IBGE usa a sigla quando ela é do IBGE e, senão, o nome.",
                        "É uma correspondência por UF: não diz que parte de um município fica fora do SIN."],
            transformacoes=["SE-CO da camada = SE (Sudeste/Centro-Oeste) no observatório",
                            "conferida com os mapeamentos dos módulos Água e Carga e provada, área por área, pela carga verificada do ONS"],
            publicado_em=None, download=U["mun_csv"], publicacao_informada=False,
            notas_fonte="copyrightText da camada: 'EPE, ONS, IBGE; 2020-09-11; criação'.")
    pr = _prov_de(O("perdas_gold"), "proveniencia.taxas")
    ano_perdas = (O("perdas_gold").get("referencia") or {}).get("ano")
    out["distribuidora_perdas"] = _prov_derivada(
        "Perdas da distribuidora (área inteira)", pr, ["valor do ano de referência lido de perdas.json, sem recálculo",
                                                       "ano com menos de 12 meses marcado como parcial; taxa fora de 0% a 100% mantida com ressalva"],
        ["Taxa da distribuidora inteira: não é a perda de nenhum município."], "%", "anual", U["dist_csv"],
        periodo=_periodo(ano_perdas))
    pq = _prov_de(O("qualidade_gold"), "proveniencia.distribuidoras")
    out["distribuidora_qualidade"] = _prov_derivada(
        "DEC e FEC da distribuidora (área inteira)", pq, ["valor anual lido de qualidade.json, sem recálculo"],
        ["DEC e FEC da distribuidora inteira: o município pode ter conjuntos muito acima ou muito abaixo."],
        "horas (DEC); interrupções (FEC)", "anual", U["dist_csv"], periodo=_periodo(ano_q))
    pqc = _prov_de(O("qualidade_gold"), "proveniencia.conjuntos")
    out["conjuntos"] = _prov_derivada(
        "DEC e FEC anuais dos conjuntos elétricos que atendem cada município", pqc,
        [f"valores do ano {ano_q} lidos de qualidade_conjuntos_anual_2020_2029.csv (módulo Qualidade), sem recálculo",
         "ligação conjunto × município de qualidade_municipios.csv (IndQual Município)"],
        ["DEC e FEC do conjunto inteiro: o conjunto pode cobrir vários municípios ou só parte de um.",
         "Conjunto sem os 12 meses no ano de referência fica sem valor (listado em sem_valor_no_ano)."],
        "horas (DEC); interrupções (FEC)", "anual", U["conj_csv"], natureza="OBSERVADO",
        formula="DEC(c, ano) = Σ_m DEC(c, m); FEC(c, ano) = Σ_m FEC(c, m), só com os 12 meses publicados",
        periodo=_periodo(ano_q))
    tg = O("transicao_gold")
    pc = _prov_de(O("conta_gold"), "tarifas.proveniencia")
    out["distribuidora_tarifa"] = _prov_derivada(
        "Tarifa B1 residencial vigente da distribuidora", pc, ["tarifa vigente lida de conta.json, sem recálculo"],
        ["Tarifa homologada sem tributos e sem bandeira: não é a conta de um consumidor do município."], "R$/MWh",
        "por vigência", U["dist_csv"], periodo=_periodo(O("conta_gold").get("data_referencia")))
    pt = _prov_de(tg, "mmgd.proveniencia.cadastro")
    out["mmgd"] = _prov_derivada(
        "MMGD cadastrada (município e distribuidora)", pt,
        ["unidades e potência por município lidas de transicao_mmgd_municipios.csv e por distribuidora de transicao.json"],
        ["Capacidade cadastrada no município da unidade, não energia gerada."], "unidades; kW", "cadastro vigente", U["mun_csv"],
        periodo=_periodo((tg.get("mmgd") or {}).get("data_cadastro")))
    om = (tg.get("ons_mmgd") or {}).get("ultimo_mes_completo") or {}
    po = _prov_de(tg, "ons_mmgd.proveniencia.estimativa")
    out["mmgd_ons"] = _prov_derivada(
        "Carga atendida por MMGD estimada pelo ONS, por submercado", po,
        ["média do último mês completo lida de transicao.json (ons_mmgd.ultimo_mes_completo), sem recálculo"],
        ["Estimativa do ONS (não é medição): a geração da MMGD não é medida unidade a unidade.",
         "Valor do submercado inteiro; não é um valor do município."],
        "MWmed", "mensal", "/energia/series/transicao_ons_mmgd_mensal.csv", natureza="ESTIMADO", periodo=_periodo(om.get("m")))
    snap_pop, v_pop = _snapshot_populacao()
    out["populacao"] = c.proveniencia(
        indicador="População residente estimada do município (IBGE)", natureza="ESTIMADO",
        fonte={"orgao": "IBGE", "dataset": "Estimativas de população (tabela SIDRA 6579)",
               "recurso": "variável 9324, População residente estimada, municípios (coletada pelo módulo Transição)",
               "url_dataset": "https://sidra.ibge.gov.br/tabela/6579", "url_primaria": (v_pop or {}).get("url") or "https://apisidra.ibge.gov.br/values/t/6579",
               "licenca": "Uso livre com citação da fonte (IBGE)"},
        unidade="habitantes", frequencia="anual", periodo=_periodo(ano_pop), cobertura=_periodo(ano_pop),
        capturado_em=(v_pop or {}).get("capturado_em"), snapshot=snap_pop or {},
        limitacoes=["Estimativa do IBGE para 1º de julho do ano, não contagem censitária.",
                    "Lida de transicao_mmgd_municipios.csv (coluna populacao_estimada, ano em ano_populacao); município sem linha fica nulo."],
        transformacoes=["população estimada por código IBGE de 7 dígitos, como o módulo Transição a publica"],
        publicado_em=None, download=U["mun_csv"], publicacao_informada=False)
    pi = _prov_de(O("inclusao_gold"), "tarifa_social.proveniencia.cde")
    out["tarifa_social"] = _prov_derivada(
        "Tarifa Social por município, distribuidora e UF", pi,
        ["faturas e desconto por município lidos de inclusao_municipios.csv; código de 6 dígitos completado pelo IBGE"],
        ["A razão por família do Cadastro Único é uma proxy de cobertura, não a taxa de famílias elegíveis atendidas."],
        "faturas; R$", "mensal", U["mun_csv"], periodo=_periodo(mes_cde))
    pl = _prov_de(O("inclusao_gold"), "acesso.proveniencia.luz_para_todos")
    anos = sorted(lpt_anos)
    out["luz_para_todos"] = _prov_derivada(
        "Domicílios atendidos pelo Luz para Todos por município", pl,
        ["soma dos domicílios por município em todos os anos e programas do arquivo do módulo Inclusão"],
        ["Ligação nova registrada pelo programa no período inteiro; não é a situação atual de acesso."], "domicílios",
        "acumulado do período", U["mun_csv"], natureza="CALCULADO", formula="domicílios(m) = Σ_ano Σ_programa domicílios(m, ano, programa)",
        periodo=_periodo(anos[0], anos[-1]) if anos else None)
    pis = _prov_de(O("inclusao_gold"), "acesso.proveniencia.isolados")
    out["isolados"] = _prov_derivada(
        "Localidades atendidas por sistema isolado e municípios fora do SIN", pis,
        ["município pela igualdade do nome com a lista do IBGE na UF (160 de 160 reconhecidas)",
         f"município fora do SIN quando a sede é localidade isolada ou a população isolada declarada é ao menos {int(LIMIAR_POP_ISOLADA * 100)}% da estimada pelo IBGE"],
        ["A população declarada pelo PASI e a estimada pelo IBGE têm bases diferentes: a razão separa os municípios com sede isolada dos demais, não mede a parte exata fora do SIN."],
        "localidades; habitantes", "ciclo anual do PASI", U["mun_csv"], periodo=_periodo(ciclo_isolados))
    pe = _prov_de(O("expansao_gold"), "proveniencia.capacidade")
    out["usinas"] = _prov_derivada(
        "Usinas do SIGA como pontos e somas por município", pe,
        ["município declarado pelo SIGA ligado ao código IBGE pelo nome (mais 11 grafias antigas da DTB do IBGE)",
         "soma municipal só de usinas declaradas em um único município; as demais listadas",
         f"registros de até {int(LIMITE_REGISTRO_KW)} kW em operação somados à parte (contagem e kW)",
         "coordenada conferida por ponto em polígono na malha municipal de qualidade "
         + ("máxima do IBGE" if malha_info.get("conferencia") == "maxima" else "simplificada do mapa (aproximada)")],
        ["A coordenada do SIGA é aproximada (centróide do empreendimento); a conferência não corrige o município declarado."],
        "MW", "cadastro do dia", U["usi_csv"], natureza="CALCULADO",
        formula="MW(m) = Σ potência fiscalizada das usinas em operação declaradas só no município m, sem os registros de até 10 kW, ÷ 1.000",
        periodo=_periodo((O("expansao_gold").get("referencias") or {}).get("siga")))
    plg = O("pld_gold")
    mensal = [m for m in plg.get("mensal") or [] if not m.get("parcial")]
    out["pld_dia"] = _prov_derivada(
        "PLD médio do dia por submercado", _prov_de(plg, "proveniencia.diario"),
        ["média do dia lida de pld.json (cartões), sem recálculo"],
        ["Preço do submercado inteiro; não é tarifa nem conta de luz do município."], "R$/MWh", "diária",
        "/energia/series/pld_diario.csv", natureza="CALCULADO", periodo=_periodo(plg.get("dia_referencia")))
    out["pld_mes"] = _prov_derivada(
        "PLD médio do último mês completo por submercado", _prov_de(plg, "proveniencia.mensal"),
        ["média do último mês completo lida de pld.json (mensal), sem recálculo"],
        ["Média temporal do submercado inteiro (não ponderada pela carga); não é tarifa do município."], "R$/MWh", "mensal",
        "/energia/series/pld_diario.csv", natureza="CALCULADO", periodo=_periodo(mensal[-1]["m"]) if mensal else None)
    ag = O("agua_gold")
    pa = _prov_de(ag, "proveniencia.ear_sin")
    out["ear"] = _prov_derivada(
        "EAR do subsistema (% da EAR máxima e MWmês), como o ONS publica", pa,
        ["ear_verif_subsistema_percentual, ear_verif_subsistema_mwmes e ear_max_subsistema do último dia, lidos de agua_detalhe.json (armazenamento.subsistemas), sem recálculo"],
        ["Armazenamento do subsistema inteiro; não é um valor do município."], "% da EAR máxima; MWmês", "diária",
        "/energia/series/ear_diario.csv", natureza="OBSERVADO", herda_formula=False,
        periodo=_periodo((ag.get("dias_referencia") or {}).get("ear")))
    return {k: v for k, v in out.items() if v}


def _evidencias(con, ins, resumo, areas, contagem_usi, linhas_mun):
    out = {}
    pm = ins["perdas_municipios"]
    fonte_rel = _fonte_arquivo(pm, "ANEEL", "IndQual Município e limites de continuidade (relação conjunto × município, via módulo Perdas)",
                               "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio",
                               _prov_de(ins["perdas_gold"]["obj"], "proveniencia.territorio"))
    pg = pm["obj"]
    mapa = (ins["perdas_gold"]["obj"].get("mapa") or {})
    try:
        out["municipios_compartilhados"] = ev.construir(
            indicador="Municípios atendidos por mais de uma distribuidora",
            valor_exibido=f"{resumo['municipios_compartilhados']:,}".replace(",", "."), valor_calculo=float(resumo["municipios_compartilhados"]),
            unidade="municípios", periodo={"inicio": str(pg.get("ano_relacao")), "fim": str(pg.get("ano_relacao"))},
            entidade="Brasil", universo=f"{resumo['municipios']} municípios da malha do IBGE",
            fonte=fonte_rel, consulta="municípios com mais de uma distribuidora de vínculo 1 (confirmado) ou 2 (só MMGD) em perdas_municipios.json",
            formula="contagem de municípios com 2 ou mais distribuidoras de estado 1 ou 2",
            cobertura=f"{resumo['municipios_com_distribuidora']} municípios com distribuidora de vínculo válido",
            tratamento_ausencia="município sem vínculo ou só com vínculo sem confirmação não entra na contagem",
            testes=[ev.teste("Igual à contagem publicada pelo módulo Perdas", "aprovado" if mapa.get("municipios_compartilhados") == resumo["municipios_compartilhados"] else "reprovado",
                             f"Perdas publica {mapa.get('municipios_compartilhados')}")],
            reconciliacao=ev.reconciliacao("Contagem refeita sobre o arquivo do módulo Perdas e comparada à gold dele",
                                           "aprovado" if mapa.get("municipios_compartilhados") == resumo["municipios_compartilhados"] else "reprovado",
                                           "0 municípios"),
            download=[{"rotulo": "Índice territorial por município (CSV)", "url": U["mun_csv"]}], reproducao=REPRODUCAO,
            revisoes="Revisões da relação ficam no silver do módulo Perdas.")
    except ev.EvidenciaInvalida as e:
        out["municipios_compartilhados"] = None
        print("[territorio] evidência inválida:", e)
    # submercado provado
    vs = [v for v in base.vintages_do_dataset(con, DS_AREAS)]
    if areas["conferencias"] and vs:
        # 68 arquivos (34 áreas × 2 dias): recurso, sha256 e captura de cada um; o caminho no
        # bronze segue o padrão da consulta abaixo (sem repetir o caminho 68 vezes na gold)
        arquivos = [{"recurso": v["recurso"], "sha256": v["sha256"], "capturado_em": v["capturado_em"]}
                    for v in vs if v["recurso"].split("@")[1] in areas["dias"]][:68]
        n_prov = resumo["municipios_por_estado_submercado"].get("provado", 0) + resumo["municipios_por_estado_submercado"].get("provado_com_area_sem_carga", 0)
        try:
            fonte = {"orgao": "ONS", "conjunto": "Carga de Energia Verificada (API por área de carga)", "recurso": "cargaverificada (34 áreas por dia)",
                     "url": ot.URL_DATASET, "arquivo": None, "sha256": None, "capturado_em": None, "publicado_em": None,
                     "arquivos": arquivos}
            out["municipios_com_submercado"] = ev.construir(
                indicador="Municípios com submercado provado pela carga das áreas do ONS",
                valor_exibido=f"{n_prov:,}".replace(",", "."), valor_calculo=float(n_prov), unidade="municípios",
                periodo={"inicio": min(areas["dias"]), "fim": max(areas["dias"])}, entidade="Brasil",
                universo=f"{resumo['municipios']} municípios da malha do IBGE", fonte=fonte,
                chaves_origem=[f"{v['recurso']}" for v in vs if v["recurso"].split("@")[1] in areas["dias"]],
                manifesto={"rotulo": "Conferência das áreas de carga, uma linha por área e dia (CSV)", "url": U["areas_csv"]},
                consulta=("observações meia_hora.<área> (carga global de cada meia hora, instante = fim do intervalo em UTC) do dataset "
                          "territorio_ons_areas_carga nos dias conferidos; resposta original da API em "
                          "data/energia/bronze/ons/territorio_ons_areas_carga/<área>@<dia>/<captura>.<sha256[:12]>.json.gz"),
                formula=("município provado quando a UF tem todas as áreas provadas no mesmo submercado (área com carga zero num dos dias "
                         "vale pela prova do outro) e o PASI não lista localidade isolada nele; municípios fora do SIN e com localidade "
                         "isolada não entram"),
                cobertura=f"{len(areas['dias'])} dias conferidos; 34 áreas por dia",
                tratamento_ausencia="dia com área sem resposta não conta como conferido",
                testes=[ev.teste(f"Fechamento meia hora a meia hora em {x['dia']}",
                                 "aprovado" if x.get("fecha") and not [a for a, y in x["areas"].items() if y["veredito"] in ("reprovada", "ambigua")] else "reprovado",
                                 "mediana do resíduo absoluto: " + ", ".join(f"{sm} {s['mediana_abs_mwmed']:.2f}" for sm, s in (x.get("submercados") or {}).items())
                                 + f" MWmed; menor alternativa ({(x.get('menor_alternativa') or {}).get('descricao')}): "
                                 f"{((x.get('menor_alternativa') or {}).get('mediana_abs_mwmed') or 0):.1f} MWmed")
                        for x in areas["conferencias"] if x.get("completo")],
                reconciliacao=ev.reconciliacao("Mapeamento provado igual ao publicado pelos módulos Água e Carga",
                                               "aprovado" if all(x.get("fecha") for x in areas["conferencias"]) else "ressalva",
                                               "15 MWmed na mediana do resíduo absoluto por meia hora, por submercado"),
                download=[{"rotulo": "Conferência das áreas de carga (CSV)", "url": U["areas_csv"]}], reproducao=REPRODUCAO,
                revisoes=c.snapshot_de(con, DS_AREAS).get("revisoes"))
        except ev.EvidenciaInvalida as e:
            print("[territorio] evidência inválida:", e)
    # usinas com município reconhecido
    eu = ins.get("expansao_usinas")
    if eu and contagem_usi.get("total"):
        try:
            fonte = _fonte_arquivo(eu, "ANEEL", "SIGA: Sistema de Informações de Geração da ANEEL (via módulo Expansão)",
                                   "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel",
                                   _prov_de((ins.get("expansao_gold") or {}).get("obj"), "proveniencia.capacidade"))
            n = contagem_usi.get("todos_reconhecidos", 0)
            tot = contagem_usi["total"]
            no, fora = contagem_usi.get("coord_no_declarado", 0), contagem_usi.get("coord_fora_do_declarado", 0)
            out["usinas_municipio_reconhecido"] = ev.construir(
                indicador="Usinas com todos os municípios declarados reconhecidos no cadastro do IBGE",
                valor_exibido=f"{n:,} de {tot:,}".replace(",", "."), valor_calculo=float(n), unidade="usinas",
                periodo={"inicio": ((ins.get('expansao_gold') or {}).get('obj') or {}).get("referencias", {}).get("siga") or "",
                         "fim": ((ins.get('expansao_gold') or {}).get('obj') or {}).get("referencias", {}).get("siga") or ""},
                entidade="Brasil", universo=f"{tot} usinas no CSV do SIGA publicado pelo módulo Expansão", fonte=fonte,
                consulta="linhas de expansao_usinas_siga.csv com o campo municipios inteiramente reconhecido",
                formula="contagem de usinas cujos municípios declarados são todos reconhecidos (nome atual do IBGE na UF ou grafia antiga da DTB)",
                cobertura=f"{contagem_usi.get('com_coordenada', 0)} com coordenada",
                tratamento_ausencia="nome sem igualdade exata nem grafia antiga documentada fica sem vínculo e listado",
                testes=[ev.teste("Coordenada dentro de um município declarado",
                                 "aprovado" if contagem_usi.get("simplificada_fora") is not None and no + fora and no / (no + fora) >= 0.9 else "ressalva",
                                 f"{no} dentro e {fora} fora "
                                 + ("(malha municipal de qualidade máxima do IBGE; na malha simplificada do mapa seriam "
                                    f"{contagem_usi.get('simplificada_fora')} fora, {contagem_usi.get('simplificada_fora_maxima_dentro')} "
                                    "delas falsos positivos)" if contagem_usi.get("simplificada_fora") is not None else
                                    "(malha simplificada do mapa: limite superior, aproximado)"))],
                reconciliacao=None, download=[{"rotulo": "Usinas (CSV)", "url": U["usi_csv"]}], reproducao=REPRODUCAO,
                revisoes="Revisões do SIGA ficam no silver do módulo Expansão.")
        except ev.EvidenciaInvalida as e:
            print("[territorio] evidência inválida:", e)
    return {k: v for k, v in out.items() if v}
