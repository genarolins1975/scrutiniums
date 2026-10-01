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
- município → submercado, pela UF e pelas áreas de carga do ONS. Não há tabela oficial
  município → submercado: a pertença de cada área de carga ao submercado é PROVADA aqui
  pelo fechamento da carga verificada (a única coleta própria do módulo, em
  fontes/ons_territorio.py), e a UF dividida entre áreas fica com estado próprio;
- usina (ponto do SIGA) → município(s) que o SIGA declara, pelo nome oficial do IBGE.

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
from pipeline.energia.fontes import ibge_territorio as it  # noqa: E402
from pipeline.energia.fontes import ons_territorio as ot  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

GOLD = "territorio.json"
FAMILIA = "territorio"
SITE = "https://scrutiniums.com/setor-eletrico/territorio"
HREF = "/setor-eletrico/territorio"
PAGINA = {"rotulo": "Minha região", "href": HREF}
DS_AREAS = "territorio_ons_areas_carga"
REPRODUCAO = "python3 pipeline/energia/executar_modulo.py territorio --sem-coleta"

# Conferência das áreas de carga: refeita quando a última tem 30 dias ou mais (a lista de
# áreas e a sua pertença mudam raramente; dois dias por rodada, 34 consultas cada).
MAX_IDADE_AREAS_DIAS = 30
DEFASAGEM_DIAS = 15     # dia conferido fica antes da janela em que o ONS ainda consiste a carga
PAUSA_S = 0.2

SERIES_URL = "/energia/series/"
ARQ_MUN_JSON = "territorio_municipios.json"
ARQ_USI_JSON = "territorio_usinas.json"
ARQ_MUN_CSV = "territorio_municipios.csv"
ARQ_DIST_CSV = "territorio_distribuidoras.csv"
ARQ_CONJ_CSV = "territorio_conjuntos.csv"
ARQ_USI_CSV = "territorio_usinas.csv"
ARQ_AREAS_CSV = "territorio_areas_carga.csv"
U = {k: SERIES_URL + v for k, v in {
    "mun_json": ARQ_MUN_JSON, "usi_json": ARQ_USI_JSON, "mun_csv": ARQ_MUN_CSV, "dist_csv": ARQ_DIST_CSV,
    "conj_csv": ARQ_CONJ_CSV, "usi_csv": ARQ_USI_CSV, "areas_csv": ARQ_AREAS_CSV}.items()}

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
         "paginas": [PAGINA], "downloads": [U["areas_csv"]], "quebras": []},
    ],
    "arquivos": {
        U["mun_json"]: ("Índice territorial por município (carregado sob demanda pelo mapa): campos em 'campos'; dist = "
                        "[índice da distribuidora na gold, estado do vínculo 0/1/2 do módulo Perdas]; conj = conjuntos "
                        "elétricos (valores na tabela 'conjuntos', do conjunto inteiro); indicadores do próprio município "
                        "(MMGD, Tarifa Social, Luz para Todos, usinas declaradas só nele, localidades isoladas). Nulo = ausência."),
        U["usi_json"]: ("Usinas do SIGA como pontos: ceg; nome; tipo; estagio; uf (principal); mw_fiscalizado; mw_outorgado; "
                        "x e y na grade da malha publicada (Albers, 100 m; nulos sem coordenada); municipios (códigos IBGE "
                        "declarados pelo SIGA e reconhecidos); n_declarados (municípios que o SIGA declara, reconhecidos ou não: só "
                        "usina com 1 entra na soma municipal); coord_no_declarado (1 = a coordenada cai num dos municípios declarados, 0 = "
                        "não, nulo = sem coordenada ou sem município reconhecido)."),
        U["mun_csv"]: ("codigo_ibge; municipio; uf; submercado (da UF) e estado_submercado (provado, provado_com_area_sem_carga, "
                       "com_localidade_isolada = há localidade do município atendida por sistema isolado, fora do SIN; nao_provado); localidades_isoladas e populacao_isolada (EPE, PASI); distribuidoras (SIGLA:CNPJ:estado, "
                       "separadas por |; estado 1 = confirmado no cadastro de MMGD, 0 = relação sem confirmação, 2 = só pelo "
                       "cadastro de MMGD); conjuntos (ids separados por espaço); populacao (IBGE, estimativa); MMGD (unidades, "
                       "kW, W por habitante); Tarifa Social (faturas e desconto em R$ no mês da CDE; razão proxy em %); Luz "
                       "para Todos (domicílios atendidos no período); usinas declaradas só no município (contagem e MW por "
                       "estágio) e usinas declaradas nele e em outros (contagem, potência não somada). Vazio = ausência."),
        U["dist_csv"]: ("cnpj; sigla; nome; municipios por estado do vínculo; ufs; submercados; indicadores da distribuidora "
                        "inteira com o período de cada um (perdas, DEC e FEC, tarifa B1, MMGD cadastrada, Tarifa Social). "
                        "Vazio = a fonte não publica para essa distribuidora."),
        U["conj_csv"]: ("conjunto (id da ANEEL); nome; cnpj e sigla de quem publicou; ano; meses; dec_h; fec; limites; ucs_media; "
                        "municipios = municípios IBGE que a relação IndQual liga ao conjunto. Valores do conjunto inteiro."),
        U["usi_csv"]: ("ceg; nome; tipo; estagio; uf; municipios_siga (texto da fonte); municipios_ibge (códigos reconhecidos); "
                       "via (nome_atual, grafia_antiga); lat; lon; municipio_da_coordenada (conferência por ponto em polígono "
                       "na malha simplificada; não substitui o declarado); coord_no_declarado; mw_fiscalizado; mw_outorgado."),
        U["areas_csv"]: ("dia; area (código do ONS); nome (dicionário); tipo (submercado, geoeletrica, perdas); ufs; "
                         "submercado_hipotese; carga_media_mwmed (média das meias horas do dia); meias_horas; veredito "
                         "(provada, indeterminada = carga zero, ambigua = uma alternativa também fecha, reprovada) e, nas linhas "
                         "de submercado, soma_areas_mwmed (médias do dia), residuo_medio_mwmed, residuo_mediana_abs_mwmed e "
                         "residuo_max_abs_mwmed (resíduo por meia hora) e tolerancia_mwmed (aplicada à mediana)."),
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
     "regra": "Pela UF do município e pela pertença provada das áreas de carga do ONS. Localidades atendidas por sistema isolado no município ficam fora do SIN e são indicadas.",
     "condicao": "estado 'provado' ou 'provado_com_area_sem_carga'; com 'com_localidade_isolada' a seleção leva ao submercado da UF com aviso de que parte do município está fora do SIN"},
    {"de": "municipio", "para": "usina", "valida": True,
     "regra": "Usinas que o SIGA declara no município (nome oficial do IBGE). A coordenada é conferida, não decide.", "condicao": None},
    {"de": "distribuidora", "para": "municipio", "valida": True,
     "regra": "A área da distribuidora é o conjunto dos municípios da relação; selecionar a distribuidora destaca os municípios, não seleciona um deles.", "condicao": None},
    {"de": "distribuidora", "para": "submercado", "valida": True,
     "regra": "Submercados das UFs dos municípios confirmados da distribuidora; com mais de um, a seleção lista todos.",
     "condicao": "só quando todos os municípios confirmados estão em UFs com pertença provada"},
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
    {"id": "pld_dia", "rotulo": "PLD médio do dia", "grao": "submercado", "unidade": "R$/MWh", "natureza": "OBSERVADO", "modulo": "pld", "campo": "submercados[].indicadores.pld_dia"},
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
    {"id": "mun_usinas_operacao", "rotulo": "Usinas em operação declaradas só neste município", "grao": "municipio", "unidade": "usinas; MW fiscalizados", "natureza": "CALCULADO", "modulo": "expansao", "campo": "municipios.usi_op_n e usi_op_mw"},
    {"id": "mun_isolados", "rotulo": "Localidades atendidas por sistema isolado", "grao": "municipio", "unidade": "localidades; habitantes", "natureza": "OBSERVADO", "modulo": "inclusao", "campo": "municipios.isol_n e isol_pop"},
    # usina
    {"id": "usina_potencia", "rotulo": "Potência da usina", "grao": "usina", "unidade": "MW", "natureza": "OBSERVADO", "modulo": "expansao", "campo": "usinas.mw_fiscalizado e mw_outorgado"},
]

# Definição de cada indicador no catálogo de métricas (pipeline/energia/metricas/): a do
# módulo de origem quando ele a publica; None quando a definição está só na proveniência.
METRICA_DE = {
    "pld_dia": None, "pld_mes": "pld_media_mensal_temporal", "ear_pct": "agua_ear_mwmes",
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
    ("isol_n", "municipio"), ("isol_pop", "municipio"),
]
CAMPOS_CONJ = [("nome", "ref"), ("dist", "ref"), ("ano", "ref"), ("meses", "conjunto"), ("dec_h", "conjunto"),
               ("fec", "conjunto"), ("dec_lim_h", "conjunto"), ("fec_lim", "conjunto"), ("ucs", "conjunto"), ("n_mun", "ref")]
CAMPOS_USI = [("ceg", "ref"), ("nome", "ref"), ("tipo", "ref"), ("estagio", "ref"), ("uf", "ref"),
              ("mw_fiscalizado", "usina"), ("mw_outorgado", "usina"), ("x", "ref"), ("y", "ref"),
              ("municipios", "ref"), ("n_declarados", "ref"), ("coord_no_declarado", "ref")]


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
    """Um dia útil (hoje − 15 dias, recuado para quarta-feira se cair no fim de semana) e o
    domingo anterior: perfis de carga diferentes entre áreas tornam impossível que uma
    troca de áreas feche por coincidência nos dois dias."""
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


def coletar(con, ctx):
    """Carga verificada de dois dias por área de carga, só quando a última conferência tem
    30 dias ou mais. Falha de rede fica registrada; a gold usa a conferência anterior."""
    st = {"dataset": DS_AREAS, "novas": 0, "identicas": 0, "puladas": 0, "falhas": []}
    if ctx.get("sem_rede"):
        st["pulada"] = "sem rede"
        return st
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
    for rec, serie, ref, valor in con.execute(
            """SELECT v.recurso, o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? AND v.recurso LIKE ? AND o.serie LIKE 'meia_hora.%'
               ORDER BY v.capturado_em, o.rowid""", (DS_AREAS, f"%@{dia}")):
        out[serie.split(".", 1)[1]][ref] = valor
    return dict(out)


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


def _fonte_arquivo(ins_item, orgao, conjunto, url):
    """Bloco fonte da evidência para um número calculado sobre um arquivo publicado por
    outro módulo: o arquivo exato (sha256) e o instante em que ele foi gerado."""
    return {"orgao": orgao, "conjunto": conjunto, "recurso": os.path.basename(ins_item["arquivo"]), "url": url,
            "arquivo": ins_item["arquivo"], "sha256": ins_item["sha256"],
            "capturado_em": base.instante_utc(ins_item["gerado_em"]) if ins_item.get("gerado_em") else None,
            "publicado_em": None}


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
    linhas_csv = []
    area_sm = {a: sm for sm, lst in hipotese.items() for a in lst}
    for dia in dias:
        series = _series_do_dia(con, dia)
        cf = ot.confere_fechamento(series, hipotese)
        cf["dia"] = dia
        cf["intervalos_incompletos"] = sorted(a for a, v in series.items() if len(v) != ot.INTERVALOS_DIA)
        confs.append(cf)
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
            "linhas_csv": linhas_csv}


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

    # ---- submercado por UF (hipótese publicada, provada pelas áreas de carga do ONS)
    map_agua, map_carga = _mapeamentos_publicados(ins)
    hip_uf = map_agua or map_carga
    divergencias_map = sorted(uf for uf in set(map_agua) | set(map_carga) if map_agua.get(uf) != map_carga.get(uf))
    controles.append({"nome": "UF → subsistema: módulos Água e Carga publicam o mesmo mapeamento", "critico": False,
                      "resultado": "aprovado" if map_agua and map_carga and not divergencias_map else "ressalva",
                      "detalhe": f"{len(map_agua)} UFs na gold de Água, {len(map_carga)} na de Carga; divergentes: {divergencias_map or 'nenhuma'}"})
    areas = _conferencia_areas(con, hip_uf)
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
    tg = (ins.get("transicao_gold") or {}).get("obj") or {}
    if ins.get("transicao_municipios"):
        for r in _le_csv(_caminho("series", "transicao_mmgd_municipios.csv")):
            mmgd[r["codigo_ibge"]] = {"pop": _int(r["populacao_estimada"]), "un": _int(r["unidades"]),
                                      "kw": _num(r["potencia_kw"]), "w_hab": _num(r["w_por_habitante"])}
    ig = (ins.get("inclusao_gold") or {}).get("obj") or {}
    cod6 = defaultdict(list)
    for cod in municipios:
        cod6[cod[:6]].append(cod)
    cod6_ambiguos = sorted(k for k, v in cod6.items() if len(v) > 1)
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
    linhas_siga = _le_csv(_caminho("series", "expansao_usinas_siga.csv")) if ins.get("expansao_usinas") else []
    U_ = processa_usinas(linhas_siga, nomes, poly, origem)
    usinas, usi_csv = U_["usinas"], U_["csv"]
    usi_mun_op, usi_mun_cart, usi_multi_mun = U_["op"], U_["carteira"], U_["multi"]
    nao_reconhecidos, contagem_usi, soma_uf_op = U_["nao_reconhecidos"], U_["contagem"], U_["soma_uf_op"]

    # ---- montagem do índice municipal
    idx_dist = {}
    for i, cn in enumerate(cnpjs_rel):
        idx_dist[i] = cn
    linhas_mun = []
    for cod in sorted(municipios):
        m = municipios[cod]
        uf = m["uf"]
        su = uf_sm.get(uf) or {}
        mm = mmgd.get(cod) or {}
        ts = tsee.get(cod) or {}
        op = usi_mun_op.get(cod)
        ca = usi_mun_cart.get(cod)
        iso = isolados_mun.get(cod) or []
        pop_iso = [x["populacao"] for x in iso if x.get("populacao") is not None]
        # localidade em sistema isolado no município: o submercado da UF não vale para ela,
        # e a fonte não diz quanto do município fica fora do SIN
        estado_sm = "com_localidade_isolada" if iso and su.get("subsistema") else su.get("estado")
        linhas_mun.append([
            cod, m["nome"], uf, su.get("subsistema"), estado_sm,
            [[i, e] for i, e in vinculos.get(cod, [])],
            [int(x) for x in conj_mun.get(cod, [])],
            sorted(usi_multi_mun.get(cod, [])),
            mm.get("pop"), mm.get("un"), c.r(mm.get("kw"), 2), c.r(mm.get("w_hab"), 1),
            ts.get("faturas"), c.r(ts.get("desconto"), 2), c.r(ts.get("proxy"), 2), ts.get("base_pequena"),
            c.r(lpt.get(cod), 0) if cod in lpt else None,
            op[0] if op else 0, c.r(op[1], 3) if op else 0.0,
            ca[0] if ca else 0, c.r(ca[1], 3) if ca else 0.0,
            len(iso), c.r(sum(pop_iso), 0) if pop_iso else (None if iso else 0),
        ])
    # usinas: zero é zero (o SIGA é o universo das usinas outorgadas); isolados: zero quando
    # o PASI não lista localidade no município. MMGD, Tarifa Social e Luz para Todos ficam
    # nulos quando o arquivo do módulo não traz o município (ausência, nunca zero).

    # ---- distribuidoras (indicadores da distribuidora inteira)
    distribuidoras = _distribuidoras(ins, cnpjs_rel, pd, vinculos, municipios, uf_sm, hoje)

    # ---- UFs e submercados
    ufs = _ufs(ins, uf_sm, municipios, isolados_mun, nomes_uf, cod_uf, soma_uf_op)
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
                                     "linhas": usinas})
    _escreve_csvs(linhas_mun, distribuidoras, conjuntos, n_mun_conj, usi_csv, areas, idx_dist)

    # ---- resumo, KPIs, evidências e proveniência
    resumo = _resumo(linhas_mun, vinculos, municipios, sem_vinculo, codigos_fora_malha, conj_mun, conjuntos,
                     conj_sem_valor, contagem_usi, nao_reconhecidos, usi_multi_mun, isolados_mun, isol_sem_mun,
                     tsee, tsee_sem_cod, mmgd, lpt, lpt_sem_cod, lpt_anos, uf_sm, lpt_por_nome)
    resumo["distribuidoras_por_municipio_perdas_x_qualidade"] = validacao["diferencas_perdas_qualidade"]
    snap = _snapshot_insumos(ins)
    g.update({
        "pergunta": "O que acontece na minha região?",
        "data_referencia": hoje.isoformat(),
        "referencias": _referencias(ins, ano_q, mes_cde, mes_cad, lpt_anos, ciclo_isolados, areas),
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
        "areas_carga": _bloco_areas(areas, map_agua, map_carga),
        "controles": [{"nome": x["nome"], "resultado": x["resultado"], "critico": bool(x.get("critico")), "detalhe": x["detalhe"]}
                      for x in controles],
        "ressalvas": ressalvas + validacao["ressalvas"],
        "insumos": _manifesto_insumos(ins),
        "limitacoes": LIMITACOES,
        "bloqueios": BLOQUEIOS,
        "proveniencia": _proveniencias(con, ins, snap, ano_q, mes_cde, lpt_anos, areas),
        "evidencias": _evidencias(con, ins, resumo, areas, contagem_usi, linhas_mun),
        "downloads": [
            {"rotulo": "Índice territorial por município (CSV)", "url": U["mun_csv"]},
            {"rotulo": "Distribuidoras: área e indicadores da distribuidora inteira (CSV)", "url": U["dist_csv"]},
            {"rotulo": "Conjuntos elétricos que atendem cada município (CSV)", "url": U["conj_csv"]},
            {"rotulo": "Usinas do SIGA com municípios declarados e conferência da coordenada (CSV)", "url": U["usi_csv"]},
            {"rotulo": "Conferência das áreas de carga do ONS (CSV)", "url": U["areas_csv"]},
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


def processa_usinas(linhas, nomes, poly, origem):
    """Usinas do CSV do SIGA publicado pelo módulo Expansão → pontos, vínculos municipais e
    somas por município. Regras: o município é o que o SIGA declara (nome oficial do IBGE
    na UF, ou grafia antiga documentada); só usina declarada em UM município entra na soma
    municipal; usina em vários municípios é listada em cada um, sem potência repartida; a
    coordenada só confere a declaração. Em operação vale a potência fiscalizada; na
    carteira (construção e construção não iniciada), a outorgada."""
    usinas, usi_csv = [], []
    op = defaultdict(lambda: [0, 0.0])
    cart = defaultdict(lambda: [0, 0.0])
    multi = defaultdict(list)
    nao_reconhecidos = Counter()
    contagem = Counter()
    soma_uf_op = defaultdict(float)
    for r in linhas:
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
            achados = poly.localiza(x, y)
            pip = achados[0] if len(achados) == 1 else None
            if cods:
                no_decl = 1 if any(a in cods for a in achados) else 0
                contagem["coord_no_declarado" if no_decl else "coord_fora_do_declarado"] += 1
            if not achados:
                contagem["coord_fora_da_malha"] += 1
        mw_f = _num(r.get("kw_fiscalizado"))
        mw_o = _num(r.get("kw_outorgado"))
        mw_f = mw_f / 1000.0 if mw_f is not None else None
        mw_o = mw_o / 1000.0 if mw_o is not None else None
        est = r.get("estagio")
        if est == "operacao" and mw_f is not None:
            soma_uf_op[r.get("uf")] += mw_f
        if len(cods) == 1 and len(decl) == 1:
            if est == "operacao":
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
            for cod in cods:
                multi[cod].append(r["ceg"])
        usinas.append([r["ceg"], r["nome"], r["tipo"], est, r.get("uf"), c.r(mw_f, 4), c.r(mw_o, 4), x, y, cods, len(decl), no_decl])
        usi_csv.append([r["ceg"], r["nome"], r["tipo"], est, r.get("uf"), r.get("municipios"), " ".join(cods),
                        "|".join(sorted(vias)) or None, lat, lon, pip, no_decl, c.r(mw_f, 4), c.r(mw_o, 4)])
    return {"usinas": usinas, "csv": usi_csv, "op": op, "carteira": cart, "multi": multi,
            "nao_reconhecidos": nao_reconhecidos, "contagem": contagem, "soma_uf_op": soma_uf_op}


# ---------------------------------------------------------------- blocos da gold

def _bloco_ind(valores, periodo, ausente=None):
    if valores is None:
        return {"disponivel": False, "motivo": ausente or "a fonte não publica este indicador para esta entidade"}
    return {"disponivel": True, "periodo": periodo, **valores}


def _distribuidoras(ins, cnpjs_rel, pd, vinculos, municipios, uf_sm, hoje):
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
        sms = Counter(uf_sm[municipios[cod]["uf"]]["subsistema"] for cod in validos)
        provado = all(uf_sm[municipios[cod]["uf"]]["estado"] != "nao_provado" for cod in validos) and bool(validos)
        ind = {}
        r = p.get("referencia") or {}
        if p and r:
            ind["perdas"] = _bloco_ind({
                "ano": r.get("ano"), "meses": r.get("meses"), "completo": r.get("completo"), "taxa_total_pct": r.get("taxa_total_pct"),
                "perdas_totais_mwh": r.get("perdas_totais_mwh"), "injetada_mwh": r.get("injetada_mwh"),
                "pnt_bt_pct": r.get("pnt_bt_pct"), "alertas": r.get("alertas") or []},
                {"inicio": str(r.get("ano")), "fim": str(r.get("ano"))})
        elif p:
            ind["perdas"] = _bloco_ind(None, None, (
                f"sem balanço no SAMP em {ref_perdas.get('ano')}; última competência publicada: {p.get('ultima_competencia')}"
                + ("" if p.get("ativa") else " (distribuidora encerrada ou absorvida)")))
        else:
            ind["perdas"] = _bloco_ind(None, None, "CNPJ sem balanço na gold de Perdas")
        q = qd.get(cn)
        if q and q.get("dec") is not None:
            ind["qualidade"] = _bloco_ind({
                "ano": q.get("ano"), "meses": q.get("meses"), "dec_h": q.get("dec"), "fec": q.get("fec"),
                "dec_limite_h": q.get("dec_limite"), "fec_limite": q.get("fec_limite"), "ucs": q.get("ucs"),
                "conjuntos": q.get("conjuntos")}, {"inicio": str(q.get("ano")), "fim": str(q.get("ano"))})
        else:
            ind["qualidade"] = _bloco_ind(None, None, (
                f"DEC e FEC de {q.get('ano')} sem os 12 meses publicados ({q.get('meses')} meses)" if q else
                "CNPJ sem indicadores de continuidade na gold de Qualidade"))
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
                     "exclusivos": len(exclusivos), "compartilhados": len(validos) - len(exclusivos), "ufs": ufs},
            "submercados": [{"sm": sm, "municipios": n} for sm, n in sorted(sms.items(), key=lambda kv: (-kv[1], str(kv[0])))],
            "submercado_unico": (next(iter(sms)) if len(sms) == 1 and provado else None),
            "indicadores": ind,
        })
    return out


def _ufs(ins, uf_sm, municipios, isolados_mun, nomes_uf, cod_uf, soma_uf_op):
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


def _bloco_areas(areas, map_agua, map_carga):
    return {
        "fonte": {"orgao": "ONS", "conjunto": "Carga de Energia Verificada (API por área de carga)", "url": ot.URL_DATASET,
                  "dicionario": ot.URL_DICIONARIO, "dicionario_versao": ot.DICIONARIO_VERSAO, "dicionario_sha256": ot.DICIONARIO_SHA256},
        "regra": ("Em cada meia hora, a carga do submercado deve ser igual à soma das suas áreas geoelétricas mais a área "
                  "de perdas do mesmo submercado. A hipótese fecha quando a mediana do resíduo absoluto de cada "
                  "submercado fica dentro da tolerância (15 MWmed); uma área fica provada quando, além disso, nenhuma "
                  "alternativa que a envolva (movê-la para outro submercado ou trocá-la com uma área de outro "
                  "submercado) também fecha. Dois dias (um útil e um domingo); área sem carga fica indeterminada."),
        "hipotese_de": "agua_detalhe.json (clima.cobertura_temperatura), conferida com carga_detalhe.json (temperatura.ufs_por_subsistema)",
        "dias": areas["dias"],
        "conflitos_na_hipotese": areas["conflitos"],
        "conferencias": [{"dia": cf["dia"], "completo": cf.get("completo"), "fecha": cf.get("fecha"),
                          "tolerancia_mwmed": c.r(cf.get("tolerancia_mwmed"), 2),
                          "ruido_mwmed": c.r(cf.get("ruido_mwmed"), 3),
                          "menor_alternativa": ({"descricao": cf["menor_alternativa"]["descricao"],
                                                 "mediana_abs_mwmed": c.r(cf["menor_alternativa"]["mediana_abs_mwmed"], 3)}
                                                if cf.get("menor_alternativa") else None),
                          "alternativas_avaliadas": cf.get("alternativas_avaliadas"),
                          "areas_ambiguas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "ambigua"),
                          "intervalos_incompletos": cf.get("intervalos_incompletos") or [],
                          "areas_indeterminadas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "indeterminada"),
                          "areas_reprovadas": sorted(a for a, x in (cf.get("areas") or {}).items() if x["veredito"] == "reprovada"),
                          "faltam": cf.get("faltam") or []}
                         for cf in areas["conferencias"]],
        "mapeamento_agua": map_agua, "mapeamento_carga": map_carga,
        "download": U["areas_csv"],
    }


def _camadas():
    return [
        {"id": "submercado", "grao": "submercado", "rotulo": "Submercados",
         "geometria": "/energia/geo/uf.json", "agrupamento": "ufs[].subsistema",
         "descricao": "Cada UF pintada pelo submercado a que as suas áreas de carga pertencem. A divisa é a da UF: o ONS não publica limite geográfico do submercado.",
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


def _referencias(ins, ano_q, mes_cde, mes_cad, lpt_anos, ciclo_isolados, areas):
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
    }


def _resumo(linhas_mun, vinculos, municipios, sem_vinculo, codigos_fora_malha, conj_mun, conjuntos, conj_sem_valor,
            contagem_usi, nao_reconhecidos, usi_multi_mun, isolados_mun, isol_sem_mun, tsee, tsee_sem_cod, mmgd, lpt,
            lpt_sem_cod, lpt_anos, uf_sm, lpt_por_nome):
    validos = {cod: [i for i, e in l if e in (1, 2)] for cod, l in vinculos.items()}
    i_est = [k for k, _ in CAMPOS_MUN].index("sm_estado")
    sm_estado = Counter(l[i_est] for l in linhas_mun)
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
            "nomes_nao_reconhecidos": [{"uf": uf or None, "nome": nome, "citacoes": n} for (uf, nome), n in
                                       sorted(nao_reconhecidos.items(), key=lambda kv: (-kv[1], kv[0]))],
            "grafias_antigas": [{"uf": uf, "nome_fonte": n, "codigo": cod, "origem": o} for uf, n, cod, o in it.TOPONIMOS],
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
    ctr.append({"nome": "Compartilhados, vínculos e vínculos sem confirmação iguais aos da gold de Perdas", "critico": False,
                "resultado": "aprovado" if ok else "ressalva",
                "detalhe": (f"compartilhados {comp} (Perdas: {esperado[0]}); vínculos {tot_v} na malha + {tot_fora} de códigos fora "
                            f"dela (Perdas: {esperado[2]}); sem confirmação {nao_conf} + {nao_conf_fora} (Perdas: {esperado[1]})")})
    # área por distribuidora contra a gold de Perdas (confirmados + só MMGD)
    pd = {d["cnpj"]: d for d in pg.get("distribuidoras") or []}
    difs = []
    for d in distribuidoras:
        t = (pd.get(d["cnpj"]) or {}).get("territorio") or {}
        if t and (t.get("confirmados"), t.get("so_mmgd")) != (d["area"]["confirmados"], d["area"]["so_mmgd"]):
            difs.append(f"{d['sigla']}: {d['area']['confirmados']}+{d['area']['so_mmgd']} contra {t.get('confirmados')}+{t.get('so_mmgd')}")
    ctr.append({"nome": "Municípios por distribuidora iguais aos da gold de Perdas", "critico": False,
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
    ctr.append({"nome": "Coordenada do SIGA dentro do município declarado (ponto em polígono)", "critico": False,
                "resultado": "aprovado" if no + fora and no / (no + fora) >= 0.9 else "ressalva",
                "detalhe": f"{no} dentro, {fora} fora, {contagem_usi.get('coord_fora_da_malha', 0)} fora de qualquer município (mar, divisa simplificada). Conferência, não correção: o município declarado prevalece."})
    # físicos: potências e contagens não negativas
    neg = [l[0] for l in linhas_mun for k in ("mmgd_un", "mmgd_kw", "tsee_faturas", "usi_op_mw", "usi_cart_mw", "lpt_dom", "pop")
           if isinstance(l[campos.index(k)], (int, float)) and l[campos.index(k)] < 0]
    neg += [u[0] for u in usinas if (u[5] is not None and u[5] < 0) or (u[6] is not None and u[6] < 0)]
    ctr.append({"nome": "Contagens e potências não negativas", "critico": True,
                "resultado": "reprovado" if neg else "aprovado", "detalhe": f"{len(neg)} violações {neg[:5]}"})
    fora = [d["sigla"] for d in distribuidoras for b, k in (("perdas", "taxa_total_pct"), ("tsee", "participacao_pct"))
            if (d["indicadores"].get(b) or {}).get(k) is not None and not (-100 <= d["indicadores"][b][k] <= 100)]
    ctr.append({"nome": "Percentuais da distribuidora em faixa", "critico": False,
                "resultado": "ressalva" if fora else "aprovado", "detalhe": f"fora de −100 a 100: {fora or 'nenhum'}"})
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
        linhas.append([l[P["ibge"]], l[P["nome"]], l[P["uf"]], l[P["sm"]], l[P["sm_estado"]], l[P["isol_n"]], l[P["isol_pop"]],
                       dist or None, " ".join(str(x) for x in l[P["conj"]]) or None, l[P["pop"]], l[P["mmgd_un"]], l[P["mmgd_kw"]],
                       l[P["mmgd_w_hab"]], l[P["tsee_faturas"]], l[P["tsee_desconto"]], l[P["tsee_proxy_pct"]],
                       l[P["tsee_base_pequena"]], l[P["lpt_dom"]], l[P["usi_op_n"]], l[P["usi_op_mw"]], l[P["usi_cart_n"]],
                       l[P["usi_cart_mw"]], len(l[P["usi_multi"]]), " ".join(l[P["usi_multi"]]) or None])
    base.escreve_csv(ARQ_MUN_CSV, ["codigo_ibge", "municipio", "uf", "submercado", "estado_submercado", "localidades_isoladas",
                                   "populacao_isolada", "distribuidoras", "conjuntos", "populacao", "mmgd_unidades", "mmgd_kw",
                                   "mmgd_w_por_habitante", "tsee_faturas", "tsee_desconto_reais", "tsee_razao_proxy_pct",
                                   "tsee_base_pequena", "lpt_domicilios", "usinas_operacao_so_no_municipio",
                                   "usinas_operacao_mw_fiscalizado", "usinas_carteira_so_no_municipio",
                                   "usinas_carteira_mw_outorgado", "usinas_em_varios_municipios", "ceg_usinas_em_varios_municipios"],
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
        dl.append([d["cnpj"], d["sigla"], d["nome"], a["municipios"], a["confirmados"], a["so_mmgd"], a["nao_confirmados"],
                   a["exclusivos"], a["compartilhados"], " ".join(a["ufs"]) or None,
                   " ".join(f"{x['sm']}:{x['municipios']}" for x in d["submercados"]) or None,
                   per("perdas"), v("perdas", "taxa_total_pct"), v("perdas", "perdas_totais_mwh"), v("perdas", "injetada_mwh"),
                   v("perdas", "pnt_bt_pct"), per("qualidade"), v("qualidade", "dec_h"), v("qualidade", "fec"),
                   v("qualidade", "dec_limite_h"), v("qualidade", "fec_limite"), per("tarifa"), v("tarifa", "total_rs_mwh"),
                   v("tarifa", "te_rs_mwh"), v("tarifa", "tusd_rs_mwh"), v("tarifa", "ato"), per("mmgd"), v("mmgd", "unidades"),
                   v("mmgd", "potencia_mw"), per("tsee"), v("tsee", "uc_tsee"), v("tsee", "participacao_pct")])
    base.escreve_csv(ARQ_DIST_CSV, ["cnpj", "sigla", "nome", "municipios", "confirmados", "so_mmgd", "nao_confirmados", "exclusivos",
                                    "compartilhados", "ufs", "submercados", "perdas_ano", "perdas_taxa_total_pct",
                                    "perdas_totais_mwh", "injetada_mwh", "pnt_bt_pct", "qualidade_ano", "dec_h", "fec",
                                    "dec_limite_h", "fec_limite", "tarifa_data", "tarifa_b1_total_rs_mwh", "te_rs_mwh",
                                    "tusd_rs_mwh", "tarifa_ato", "mmgd_data_cadastro", "mmgd_unidades", "mmgd_potencia_mw",
                                    "tsee_mes", "tsee_unidades", "tsee_participacao_pct"], dl)
    cl = [[k, x["nome"], x["cnpj"], x["sigla"], x["ano"], x["meses"], x["dec_h"], x["fec"], x["dec_lim_h"], x["fec_lim"],
           x["ucs"], n_mun_conj.get(k, 0)] for k, x in sorted(conjuntos.items(), key=lambda kv: int(kv[0]))]
    base.escreve_csv(ARQ_CONJ_CSV, ["conjunto", "nome", "cnpj", "sigla", "ano", "meses", "dec_h", "fec", "dec_limite_h",
                                    "fec_limite", "ucs_media", "municipios"], cl)
    base.escreve_csv(ARQ_USI_CSV, ["ceg", "nome", "tipo", "estagio", "uf", "municipios_siga", "municipios_ibge", "via", "lat",
                                   "lon", "municipio_da_coordenada", "coord_no_declarado", "mw_fiscalizado", "mw_outorgado"], usi_csv)
    base.escreve_csv(ARQ_AREAS_CSV, ["dia", "area", "nome", "tipo", "ufs", "submercado_hipotese", "carga_media_mwmed", "meias_horas",
                                     "veredito", "soma_areas_mwmed", "residuo_medio_mwmed", "residuo_mediana_abs_mwmed",
                                     "residuo_max_abs_mwmed", "tolerancia_mwmed"], areas["linhas_csv"])


# ---------------------------------------------------------------- proveniência e evidência

LIMITACOES = [
    "Não há polígono oficial de área de concessão acessível: a área de cada distribuidora é desenhada pelos municípios inteiros que a relação oficial da ANEEL liga a ela, e município atendido por mais de uma distribuidora aparece em todas, com marca própria. Os limites internos de um município compartilhado não são conhecidos.",
    "Não há tabela oficial município → submercado. O submercado do município é o da sua UF, provado pela soma da carga das áreas de carga do ONS; localidades atendidas por sistema isolado (fora do SIN) são indicadas pelo PASI da EPE, sem dizer se o município inteiro está fora do SIN.",
    "O submercado de uma usina depende do ponto de conexão à rede, que o SIGA não publica; usina não é ligada a submercado.",
    "Indicador de distribuidora (perdas, tarifa, DEC e FEC, Tarifa Social da distribuidora) é da área inteira: não descreve o município e não pode ser comparado entre municípios da mesma distribuidora.",
    "DEC e FEC do conjunto elétrico são do conjunto inteiro: um conjunto pode cobrir vários municípios ou só parte de um.",
    "Usina declarada em vários municípios não tem a potência repartida: aparece listada em cada um deles e fica fora da soma municipal.",
    "As datas de referência diferem entre fontes (relação de distribuidoras de 2026, perdas e qualidade do último ano completo, tarifa vigente, cadastro de MMGD do dia, Tarifa Social do mês da CDE): cada número traz o seu período.",
]
BLOQUEIOS = [
    {"item": "Polígono oficial de área de concessão das distribuidoras",
     "tentativas": ["SIGEL (sigel.aneel.gov.br): sem resposta no teste de 30/09/2026 (registrado também pelo módulo Perdas)",
                    "BDGD (entidade ARAT): File Geodatabase por distribuidora e ano, sem leitor no ambiente (GDAL ausente), segundo o módulo Perdas"],
     "evidencia": "docs/observatorios/energia/modulos/perdas.md, seção de bloqueios",
     "dependencia": "acesso ao SIGEL ou leitor de File Geodatabase no pipeline; até lá a área é a união de municípios inteiros"},
    {"item": "Correspondência oficial município → submercado",
     "tentativas": ["dicionário de dados da Carga Verificada do ONS (lista as áreas de carga, sem o submercado de cada uma)",
                    "API de carga por área: pertença provada pela soma (adotado)"],
     "evidencia": ot.URL_DICIONARIO,
     "dependencia": "tabela oficial de áreas de carga por submercado ou por município; a área TOCO, sem carga, fica indeterminada"},
]


def _prov_de(gold_obj, chave_prov):
    """Proveniência publicada pelo módulo de origem (ou None)."""
    p = gold_obj or {}
    for parte in chave_prov.split("."):
        p = (p or {}).get(parte) if isinstance(p, dict) else None
    return p if isinstance(p, dict) and p.get("fonte") else None


def _prov_derivada(indicador, origem, transformacoes, limitacoes, unidade, frequencia, download, natureza=None, formula=None):
    """Proveniência de um bloco que só reapresenta, no território, um número de outro
    módulo: fonte, período, captura, snapshot e revisões vêm da proveniência de origem."""
    if not origem:
        return None
    nat = natureza or origem.get("natureza") or "OBSERVADO"
    return c.proveniencia(
        indicador=indicador, natureza=nat, fonte=origem.get("fonte"), unidade=unidade, frequencia=frequencia,
        periodo=origem.get("periodo_referencia"), cobertura=origem.get("cobertura_historica"),
        capturado_em=origem.get("capturado_em"), snapshot=origem.get("snapshot") or {},
        limitacoes=list(limitacoes) + list(origem.get("limitacoes") or [])[:3],
        transformacoes=list(transformacoes) + [f"origem: {t}" for t in (origem.get("transformacoes") or [])[:4]],
        formula=formula or origem.get("formula") or ("ver proveniência do módulo de origem" if nat == "CALCULADO" else None),
        publicado_em=origem.get("publicado_pela_fonte_em"), revisoes=origem.get("revisoes_conhecidas"), download=download,
        publicacao_informada=origem.get("publicado_pela_fonte_em") is not None)


def _proveniencias(con, ins, snap, ano_q, mes_cde, lpt_anos, areas):
    O = lambda k: (ins.get(k) or {}).get("obj") or {}  # noqa: E731
    out = {}
    pm = ins["perdas_municipios"]
    # a relação vem da captura do módulo Perdas (IndQual Município e limites): a data de
    # captura e de publicação do índice são as dela, não a da geração do arquivo intermediário
    prel = _prov_de(O("perdas_gold"), "proveniencia.territorio") or {}
    out["indice"] = c.proveniencia(
        indicador="Índice territorial: distribuidoras, conjuntos e submercado de cada município", natureza="CALCULADO",
        fonte={"orgao": "ANEEL, ONS, IBGE e EPE (via módulos do observatório)", "dataset": "relação conjunto × município (ANEEL), carga por área (ONS), malha municipal (IBGE), PASI (EPE)",
               "recurso": "; ".join(sorted(os.path.basename(x["arquivo"]) for x in ins.values() if x)),
               "url_dataset": SITE, "url_primaria": "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio",
               "licenca": "ODbL (ANEEL), CC-BY (ONS), uso livre com citação (IBGE e EPE)"},
        unidade="municípios e referências", frequencia="a cada execução, sobre as golds publicadas",
        periodo={"inicio": str(O("perdas_municipios").get("ano_relacao")), "fim": str(O("perdas_municipios").get("ano_relacao"))},
        cobertura={"inicio": str(O("perdas_municipios").get("ano_relacao")), "fim": str(O("perdas_municipios").get("ano_relacao"))},
        capturado_em=prel.get("capturado_em") or (base.instante_utc(pm["gerado_em"]) if pm.get("gerado_em") else None),
        snapshot=snap, limitacoes=LIMITACOES[:3],
        transformacoes=["município IBGE da malha publicada (5.571) como universo",
                        "distribuidoras e estado do vínculo lidos de perdas_municipios.json (módulo Perdas), sem reclassificação",
                        "conjuntos de qualidade_municipios.csv (módulo Qualidade) e valores do ano de referência de qualidade_conjuntos_anual_2020_2029.csv",
                        "submercado pela UF, com a pertença das áreas de carga provada pela soma da carga verificada do ONS",
                        "código IBGE de 6 dígitos (Tarifa Social, Luz para Todos) completado pelo único código de 7 dígitos com o mesmo prefixo"],
        formula="vínculo(m, d) = vínculo publicado pelo módulo Perdas; submercado(m) = submercado provado da UF de m",
        publicado_em=prel.get("publicado_pela_fonte_em"), revisoes=prel.get("revisoes_conhecidas"), download=U["mun_csv"],
        publicacao_informada=prel.get("publicado_pela_fonte_em") is not None)
    out["areas_carga"] = c.proveniencia(
        indicador="Pertença das áreas de carga ao submercado (fechamento da carga verificada)", natureza="CALCULADO",
        fonte={"orgao": "ONS", "dataset": "Carga de Energia Verificada", "recurso": "API cargaverificada por cod_areacarga (34 áreas, 2 dias)",
               "url_dataset": ot.URL_DATASET, "url_primaria": "https://apicarga.ons.org.br/prd/cargaverificada", "licenca": c.LICENCA_ONS},
        unidade="MWmed", frequencia="conferência a cada 30 dias", periodo={"inicio": min(areas["dias"]) if areas["dias"] else None,
                                                                             "fim": max(areas["dias"]) if areas["dias"] else None},
        cobertura={"inicio": min(areas["dias"]) if areas["dias"] else None, "fim": max(areas["dias"]) if areas["dias"] else None},
        capturado_em=c.ultima_captura(c.snapshot_de(con, DS_AREAS)), snapshot=c.snapshot_de(con, DS_AREAS),
        limitacoes=["O ONS consiste a carga depois e pode revisá-la; uma meia hora em consistência aparece como resíduo isolado e não muda a mediana.",
                    "Área com carga zero nos dias conferidos (TOCO) não tem a pertença provada pela soma.",
                    "A divisa geográfica do submercado no mapa é a da UF: o ONS não publica limite geográfico de área de carga."],
        transformacoes=["val_cargaglobal por área e meia hora (fim do intervalo em UTC)",
                        "resíduo por meia hora = Σ áreas geoelétricas + área de perdas − submercado, nas meias horas comuns",
                        "área provada quando a hipótese fecha e nenhuma alternativa que a envolva (mover ou trocar) fecha"],
        formula="resíduo(sm, h) = Σ_a∈sm carga(a, h) + carga(perdas_sm, h) − carga(sm, h) por meia hora h; fecha se mediana_h |resíduo| ≤ 15 MWmed",
        download=U["areas_csv"])
    pr = _prov_de(O("perdas_gold"), "proveniencia.taxas")
    out["distribuidora_perdas"] = _prov_derivada(
        "Perdas da distribuidora (área inteira)", pr, ["valor do ano de referência lido de perdas.json, sem recálculo"],
        ["Taxa da distribuidora inteira: não é a perda de nenhum município."], "%", "anual", U["dist_csv"])
    pq = _prov_de(O("qualidade_gold"), "proveniencia.distribuidoras")
    out["distribuidora_qualidade"] = _prov_derivada(
        "DEC e FEC da distribuidora (área inteira)", pq, ["valor anual lido de qualidade.json, sem recálculo"],
        ["DEC e FEC da distribuidora inteira: o município pode ter conjuntos muito acima ou muito abaixo."],
        "horas (DEC); interrupções (FEC)", "anual", U["dist_csv"])
    pc = _prov_de(O("conta_gold"), "tarifas.proveniencia")
    out["distribuidora_tarifa"] = _prov_derivada(
        "Tarifa B1 residencial vigente da distribuidora", pc, ["tarifa vigente lida de conta.json, sem recálculo"],
        ["Tarifa homologada sem tributos e sem bandeira: não é a conta de um consumidor do município."], "R$/MWh",
        "por vigência", U["dist_csv"])
    pt = _prov_de(O("transicao_gold"), "mmgd.proveniencia.cadastro")
    out["mmgd"] = _prov_derivada(
        "MMGD cadastrada (município e distribuidora)", pt,
        ["unidades e potência por município lidas de transicao_mmgd_municipios.csv e por distribuidora de transicao.json"],
        ["Capacidade cadastrada no município da unidade, não energia gerada."], "unidades; kW", "cadastro vigente", U["mun_csv"])
    pi = _prov_de(O("inclusao_gold"), "tarifa_social.proveniencia.cde")
    out["tarifa_social"] = _prov_derivada(
        "Tarifa Social por município, distribuidora e UF", pi,
        ["faturas e desconto por município lidos de inclusao_municipios.csv; código de 6 dígitos completado pelo IBGE"],
        ["A razão por família do Cadastro Único é uma proxy de cobertura, não a taxa de famílias elegíveis atendidas."],
        "faturas; R$", "mensal", U["mun_csv"])
    pl = _prov_de(O("inclusao_gold"), "acesso.proveniencia.luz_para_todos")
    out["luz_para_todos"] = _prov_derivada(
        "Domicílios atendidos pelo Luz para Todos por município", pl,
        ["soma dos domicílios por município em todos os anos e programas do arquivo do módulo Inclusão"],
        ["Ligação nova registrada pelo programa no período inteiro; não é a situação atual de acesso."], "domicílios",
        "acumulado do período", U["mun_csv"], natureza="CALCULADO", formula="domicílios(m) = Σ_ano Σ_programa domicílios(m, ano, programa)")
    pis = _prov_de(O("inclusao_gold"), "acesso.proveniencia.isolados")
    out["isolados"] = _prov_derivada(
        "Localidades atendidas por sistema isolado", pis,
        ["município pela igualdade do nome com a lista do IBGE na UF (160 de 160 reconhecidas)"],
        ["A lista indica localidades fora do SIN; não diz se o município inteiro está fora."], "localidades; habitantes",
        "ciclo anual do PASI", U["mun_csv"])
    pe = _prov_de(O("expansao_gold"), "proveniencia.capacidade")
    out["usinas"] = _prov_derivada(
        "Usinas do SIGA como pontos e somas por município", pe,
        ["município declarado pelo SIGA ligado ao código IBGE pelo nome (mais 11 grafias antigas da DTB do IBGE)",
         "soma municipal só de usinas declaradas em um único município; as demais listadas",
         "coordenada projetada na grade da malha e conferida por ponto em polígono"],
        ["A coordenada do SIGA é aproximada; a conferência por polígono usa a malha simplificada (400 m)."],
        "MW", "cadastro do dia", U["usi_csv"], natureza="CALCULADO",
        formula="MW(m) = Σ potência fiscalizada das usinas em operação declaradas só no município m ÷ 1.000")
    pp = _prov_de(O("pld_gold"), "proveniencia.diario") or _prov_de(O("pld_gold"), "proveniencia.horario")
    out["pld"] = _prov_derivada("PLD do submercado", pp, ["média do dia e do último mês completo lidas de pld.json"],
                                ["Preço do submercado inteiro; não é tarifa nem conta de luz do município."], "R$/MWh", "diária", "/energia/series/pld_diario.csv")
    pa = _prov_de(O("agua_gold"), "proveniencia.ear_sin")
    out["ear"] = _prov_derivada("EAR do subsistema", pa, ["valor do último dia lido de agua_detalhe.json (armazenamento.subsistemas)"],
                                ["Armazenamento do subsistema inteiro."], "% da EAR máxima", "diária", "/energia/series/ear_diario.csv")
    return {k: v for k, v in out.items() if v}


def _evidencias(con, ins, resumo, areas, contagem_usi, linhas_mun):
    out = {}
    pm = ins["perdas_municipios"]
    fonte_rel = _fonte_arquivo(pm, "ANEEL", "IndQual Município e limites de continuidade (relação conjunto × município, via módulo Perdas)",
                               "https://dadosabertos.aneel.gov.br/dataset/indqual-municipio")
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
        arquivos = [ev.arquivo_de_vintage(v) for v in vs if v["recurso"].split("@")[1] in areas["dias"]][:68]
        n_prov = resumo["municipios_por_estado_submercado"].get("provado", 0) + resumo["municipios_por_estado_submercado"].get("provado_com_area_sem_carga", 0)
        cf = areas["conferencias"][0]
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
                consulta="observações carga_global_mwmed.<área> do dataset territorio_ons_areas_carga nos dias conferidos",
                formula="município provado quando a UF tem todas as áreas com carga provadas no mesmo submercado nos dois dias e o PASI não lista localidade isolada nele",
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
                                   "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel")
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
                testes=[ev.teste("Coordenada dentro de um município declarado", "aprovado" if no + fora and no / (no + fora) >= 0.9 else "ressalva",
                                 f"{no} dentro e {fora} fora (malha simplificada a 400 m)")],
                reconciliacao=None, download=[{"rotulo": "Usinas (CSV)", "url": U["usi_csv"]}], reproducao=REPRODUCAO,
                revisoes="Revisões do SIGA ficam no silver do módulo Expansão.")
        except ev.EvidenciaInvalida as e:
            print("[territorio] evidência inválida:", e)
    return {k: v for k, v in out.items() if v}
