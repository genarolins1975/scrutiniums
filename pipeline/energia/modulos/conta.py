"""Módulo Conta de luz (painéis P047 a P050): tarifas, composição, simulador,
reajustes, bandeiras e subsídios.

O que este módulo publica e o que ele se recusa a publicar:
- Compara a TARIFA HOMOLOGADA DE APLICAÇÃO (TE + TUSD, R$/MWh, sem tributos e sem
  bandeira) do consumidor residencial B1 convencional entre distribuidoras, para
  perfis de consumo definidos pelo observatório (100, 200 e 300 kWh/mês). Perfil de
  referência não é consumo médio de ninguém.
- Não calcula tarifa média de fornecimento (receita ÷ energia vendida) nem conta
  final: tributos (ICMS, PIS/Pasep, Cofins) e contribuição de iluminação pública não
  têm fonte estruturada por distribuidora e ficam de fora, declarados.
- A composição usa o conjunto oficial de componentes tarifárias, cujas parcelas somam
  exatamente a TE e a TUSD publicadas: nada é somado por fora da tarifa.
- O simulador aplica regras conferidas no texto da lei (Tarifa Social e Desconto
  Social) e em páginas oficiais da ANEEL (custo de disponibilidade, bandeiras); onde
  a regra de detalhe não pôde ser lida na norma, o resultado diz qual leitura foi
  usada. O resultado é sempre rotulado como estimativa sem tributos.
- Reajuste é medido como variação da tarifa B1 residencial de aplicação entre
  vigências, não como "efeito médio" do processo tarifário (que pondera todas as
  classes e não está em base estruturada acessível). Inflação: IPCA do IBGE com os
  mesmos meses.
- PLD vezes consumo não é conta de luz, e a diferença entre PLD e tarifa não é margem
  da distribuidora: a tarifa remunera energia contratada a prazo, transmissão,
  distribuição, perdas e encargos definidos em lei.
- Quem financia os benefícios: o custeio anual da CDE por rubrica separa a Tarifa
  Social (desconto que chega às famílias) dos descontos a categorias de usuários
  (subsídios tarifários) e mostra quanto das receitas vem das quotas cobradas nas
  tarifas. Os dois conjuntos não se somam.

Evidências ("Comprove este número") montadas por pipeline/energia/evidencia.py; método,
fontes, conferências e bloqueios em docs/observatorios/energia/modulos/conta.md.
"""
import html
import json
import os
import re
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_download  # noqa: E402
from pipeline.energia import base, entidades  # noqa: E402
from pipeline.energia import evidencia as ev  # noqa: E402
from pipeline.energia.fontes import aneel_conta as fa  # noqa: E402
from pipeline.energia.fontes import ckan  # noqa: E402
from pipeline.energia.fontes import ibge_conta as fi  # noqa: E402
from pipeline.energia.gold import comum as c  # noqa: E402

DS_TARIFAS = "aneel_tarifas_aplicacao"
DS_COMP = "aneel_componentes_tarifarias"
DS_BAND = "aneel_bandeiras_tarifarias"
DS_SUBS = "aneel_subsidios_tarifarios"
DS_IPCA = "ibge_ipca"
DS_NORMAS = "normas_conta"
# SAMP: avaliado para a tarifa média e os tributos e não usado; o arquivo fica no bronze
# com sha256 para a justificativa da exclusão ser reproduzível
DS_SAMP = "aneel_samp_avaliacao"
PAC_SAMP = "samp"
RECURSO_SAMP = "samp-2025.parquet"
URL_SAMP = "https://dadosabertos.aneel.gov.br/dataset/samp"
# mesmo nome de dataset do módulo Inclusão (que usa o conjunto para a Tarifa Social):
# o catálogo junta os dois registros pela chave (órgão, conjunto)
DS_CDE = "aneel_cde_custeio"
PAC_CDE = "conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios"

# versão dos parsers: mudar a leitura do arquivo exige reprocessar as vintages já
# integradas, e o marcador de processamento carrega esta versão
VERSAO_PARSER = "conta-3"

PAGINA = {"rotulo": "Conta de luz", "href": "/setor-eletrico/conta-de-luz"}
LIC_GOVBR = "Creative Commons Atribuição-SemDerivações 3.0 (CC BY-ND 3.0), conforme o rodapé do portal gov.br"
LIC_LEI = "Texto de lei, não protegido por direito autoral (Lei nº 9.610/1998, art. 8º, IV); reproduzido do portal da Câmara dos Deputados"

URL_TARIFAS = "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica"
URL_COMP = "https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias"
URL_BAND = "https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias"
URL_SUBS = "https://dadosabertos.aneel.gov.br/dataset/subsidios-tarifarios"
URL_CDE = f"https://dadosabertos.aneel.gov.br/dataset/{PAC_CDE}"

CSV_VIGENTES = "conta_tarifas_b1_vigentes.csv"
CSV_HIST = "conta_tarifas_bt_historico.csv"
CSV_COMP = "conta_composicao_b1.csv"
CSV_REAJ = "conta_reajustes_b1.csv"
CSV_BAND = "conta_bandeiras.csv"
CSV_SUBS = "conta_subsidios_anual.csv"
CSV_IPCA = "conta_ipca.csv"
CSV_CONF = "conta_conflitos_fonte.csv"
CSV_CDE = "conta_cde_custeio.csv"
CSV_JAN = "conta_reajuste_vs_ipca.csv"
# histórico por distribuidora (vigências e mudanças da tarifa B1): fora da gold, lido
# pela página sob demanda (contrato, seção 5.1), para a gold caber no limite de tamanho
JSON_HIST = "conta_historico_b1.json"


def _url(nome):
    return f"/energia/series/{nome}"


REGISTRO = {
    "id": "conta", "gold": "conta.json", "familia": "aneel_tarifas", "ordem": 42,
    "datasets": [
        {"orgao": "ANEEL", "nome": "tarifas-distribuidoras-energia-eletrica", "slug": "aneel-tarifas-aplicacao",
         "dataset_silver": DS_TARIFAS, "titulo": "Tarifas de aplicação das distribuidoras de energia elétrica",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_TARIFAS, "licenca": ckan.LICENCA_ANEEL,
         "paginas": [PAGINA], "downloads": [_url(CSV_VIGENTES), _url(CSV_HIST), _url(CSV_REAJ), _url(CSV_JAN), _url(JSON_HIST)],
         "quebras": []},
        {"orgao": "ANEEL", "nome": "componentes-tarifarias", "slug": "aneel-componentes-tarifarias",
         "dataset_silver": DS_COMP, "titulo": "Componentes tarifárias (TE e TUSD por componente)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_COMP, "licenca": ckan.LICENCA_ANEEL,
         "paginas": [PAGINA], "downloads": [_url(CSV_COMP)], "quebras": []},
        {"orgao": "ANEEL", "nome": "bandeiras-tarifarias", "slug": "aneel-bandeiras-tarifarias",
         "dataset_silver": DS_BAND, "titulo": "Bandeiras tarifárias: adicionais e acionamento mensal",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_BAND, "licenca": ckan.LICENCA_ANEEL,
         "paginas": [PAGINA], "downloads": [_url(CSV_BAND)], "quebras": []},
        {"orgao": "ANEEL", "nome": "subsidios-tarifarios", "slug": "aneel-subsidios-tarifarios",
         "dataset_silver": DS_SUBS, "titulo": "Subsídios tarifários custeados pela CDE",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_SUBS, "licenca": ckan.LICENCA_ANEEL,
         "paginas": [PAGINA], "downloads": [_url(CSV_SUBS)], "quebras": []},
        {"orgao": "ANEEL", "nome": PAC_CDE, "slug": "aneel-cde-custeio",
         "dataset_silver": DS_CDE, "titulo": "CDE: custeio dos benefícios tarifários (Tarifa Social, Luz para Todos, CCC)",
         "estado": "UTILIZADO EM INDICADOR", "url": URL_CDE, "licenca": ckan.LICENCA_ANEEL,
         "paginas": [PAGINA], "downloads": [_url(CSV_CDE)], "quebras": []},
        {"orgao": "IBGE", "nome": "sidra-1737-ipca", "slug": "ibge-ipca-1737",
         "dataset_silver": DS_IPCA, "titulo": "IPCA: número-índice e variação acumulada em 12 meses (SIDRA, tabela 1737)",
         "estado": "UTILIZADO EM INDICADOR", "url": fi.URL_TABELA, "licenca": fi.LICENCA_IBGE,
         "paginas": [PAGINA], "downloads": [_url(CSV_IPCA)], "quebras": []},
    ],
    "arquivos": {
        _url(CSV_VIGENTES): "cnpj; sigla; nome; inicio_vigencia; fim_vigencia; ato; te_rs_mwh; tusd_rs_mwh; total_rs_mwh; total_rs_kwh; te_base_economica_rs_mwh; tusd_base_economica_rs_mwh; custo_100kwh_rs; custo_200kwh_rs; custo_300kwh_rs; posicao (1 = menor tarifa). Tarifa de aplicação B1 residencial convencional vigente na data de referência, sem tributos e sem bandeira. Vazio = ausência.",
        _url(CSV_HIST): "cnpj; sigla; subgrupo; subclasse; base (TA = tarifa de aplicação, BE = base econômica); inicio; fim; ato; te_rs_mwh; tusd_rs_mwh. Todas as vigências do recorte de baixa tensão convencional, como publicadas (inclui sobreposições da fonte).",
        _url(CSV_COMP): "cnpj; sigla; inicio; fim; ato; TE; TUSD; e uma coluna por código de componente (R$/MWh, arredondados a quatro casas decimais pelo escritor de CSV; a fonte publica até nove). Tarifa de aplicação B1 residencial convencional; o grupo de cada código está em conta.json (composicao.grupos; valor negativo de TE_CFURH vai para o grupo créditos, composicao.creditos). Vazio = componente não publicada na vigência.",
        _url(CSV_REAJ): "cnpj; sigla; data; ato; mesmo_ato; total_antes_rs_mwh; total_depois_rs_mwh; variacao_pct; te_variacao_pct; tusd_variacao_pct; ipca_desde_evento_anterior_pct; meses_ipca; mudanca_perimetro (ato da incorporação quando o evento compara a tarifa da área antiga com a da área somada; vazio nos demais). Mudanças da tarifa B1 residencial de aplicação na linha do tempo resolvida.",
        _url(CSV_BAND): "mes; bandeira; adicional_rs_mwh; adicional_tabela_rs_mwh; confere. Bandeira acionada por mês de competência e conferência com a tabela de adicionais.",
        _url(CSV_SUBS): "ano; cnpj; sigla; categoria; montante (Total = previsão + ajuste); valor_rs; meses; eh_total (sim na linha da categoria Total, que reúne as demais categorias da mesma distribuidora e ano: somar valor_rs sem filtrar eh_total conta cada real duas vezes). Soma dos repasses mensais homologados por ano de competência (competências futuras excluídas).",
        _url(CSV_IPCA): "mes; indice (dez/1993 = 100); variacao_12m_pct_publicada. IPCA do IBGE usado nas comparações.",
        _url(CSV_CONF): "cnpj; sigla; subgrupo; subclasse; base; de; ate; escolhido_inicio; escolhido_fim; escolhido_ato; escolhido_te; escolhido_tusd; alternativas (inicio/fim/ato/te/tusd separados por |). Vigências sobrepostas com valores diferentes publicadas pela fonte e a escolha feita pela regra.",
        _url(CSV_JAN): "janela_meses (12, 60, 120); de; ate (últimos dias dos meses inicial e final do IPCA); cnpj; sigla; ato_de; tarifa_de_rs_mwh; ato_ate; tarifa_ate_rs_mwh (TE + TUSD B1 residencial de aplicação vigente em cada data); variacao_pct; ipca_pct (razão de números-índice nos mesmos meses); variacao_real_pct = (1 + variação) ÷ (1 + IPCA) − 1. Só distribuidoras com tarifa nas duas datas e sem mudança de perímetro (incorporação) dentro da janela.",
        _url(CSV_CDE): "ano; tipo (Despesa ou Receita); fonte (rubrica como publicada, aparada); grupo (classificação do observatório); valor_rs (R$ nominais do orçamento anual aprovado ou previsto pela ANEEL, não execução; vazio = a ANEEL não publicou valor para a rubrica no ano, diferente de zero).",
        _url(JSON_HIST): "JSON por CNPJ: sigla, nome, vigencias [início, fim, ato, TE, TUSD, TE + TUSD em R$/MWh] da tarifa B1 residencial de aplicação resolvida desde 2010, e eventos [data, ato, mesmo ato (true/false), total antes, total depois, variação %, variação TE %, variação TUSD %, IPCA % desde o evento anterior, mês inicial e final do IPCA, ato da incorporação quando o evento é mudança de perímetro]; incorporacoes (CNPJ incorporador) e incorporada_por (CNPJ incorporado). null = ausência.",
    },
}

# Métrica de cada bloco da gold (pipeline/energia/metricas/conta.py): a natureza da
# proveniência publicada no bloco tem de ser a natureza da transformação declarada na
# métrica, e o teste confere as duas.
METRICA_DO_BLOCO = {"tarifas": "conta_tarifa_b1_aplicacao", "composicao": "conta_composicao_grupo",
                    "simulador": "conta_simulacao", "reajustes": "conta_variacao_tarifa_b1",
                    "bandeiras": "conta_bandeira_adicional", "subsidios": "conta_subsidio_anual",
                    "financiamento_cde": "conta_cde_custeio"}

# ---------------------------------------------------------------------------
# Regras e parâmetros conferidos em fonte primária. Os números abaixo são
# parâmetros regulatórios (não dados observados); a coleta relê o texto oficial e
# confere se cada trecho continua lá. Trecho ausente numa captura nova rebaixa a
# regra para "não reconferida" na gold, e o simulador mostra isso.
# ---------------------------------------------------------------------------
NORMAS = [
    {"id": "lei_15235_2025", "orgao": "Câmara dos Deputados",
     "titulo": "Lei nº 15.235, de 8 de outubro de 2025 (publicação original)",
     "url": "https://www2.camara.leg.br/legin/fed/lei/2025/lei-15235-8-outubro-2025-798121-publicacaooriginal-176682-pl.html",
     "licenca": LIC_LEI,
     "trechos": ["inferior ou igual a 80 kWh/mês (oitenta quilowatts-hora por mês), o desconto será de 100% (cem por cento)",
                 "superior a 80 kWh/mês (oitenta quilowatts-hora por mês), o desconto será de 0% (zero por cento)",
                 "A partir de 1º de janeiro de 2026, as famílias com renda mensal per capita superior a 1/2 (meio) e igual ou inferior a 1 (um) salário mínimo",
                 "do pagamento das quotas anuais da CDE para consumo mensal de até 120 kWh (cento e vinte quilowatts-hora)",
                 "descontos incidentes sobre a tarifa aplicável à classe residencial"]},
    {"id": "aneel_tarifa_social", "orgao": "ANEEL", "titulo": "ANEEL: página Tarifa Social",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social", "licenca": LIC_GOVBR,
     "trechos": ["100% para o consumo até 80 kWh mensais",
                 "mesmo no caso de instalações trifásicas, existirá a gratuidade no caso de consumo até 80 kWh no mês",
                 "não pagam o encargo da CDE e também não pagam pelo custeio do Programa de Incentivo às Fontes Alternativas"]},
    {"id": "aneel_geracao_distribuida", "orgao": "ANEEL", "titulo": "ANEEL: página Micro e Minigeração Distribuída",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida", "licenca": LIC_GOVBR,
     "trechos": ["custo de disponibilidade – valor em reais equivalente a 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico)"]},
    {"id": "aneel_bandeiras", "orgao": "ANEEL", "titulo": "ANEEL: página Sobre Bandeiras Tarifárias",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias", "licenca": LIC_GOVBR,
     "trechos": ["acréscimo de R$ 0,01885 para cada quilowatt-hora (kWh) consumidos",
                 "acréscimo de R$ 0,04463 para cada quilowatt-hora kWh consumido",
                 "acréscimo de R$ 0,07877 para cada quilowatt-hora kWh consumido",
                 "com exceção daqueles localizados em sistemas isolados"]},
    {"id": "aneel_custo_energia", "orgao": "ANEEL", "titulo": "ANEEL: página Custo da energia que chega aos consumidores",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/custo-da-energia-que-chega-aos-consumidores",
     "licenca": LIC_GOVBR,
     "trechos": ["Energia gerada + transporte de energia até as unidades consumidores (transmissão e distribuição) + encargos setoriais",
                 "PIS/COFINS, ICMS e Contribuição para Iluminação Pública (CIP)"]},
]

# Documentos oficiais que sustentam leituras do módulo sem serem regra do simulador:
# capturados no bronze e com os trechos conferidos a cada captura, como as normas.
DOCUMENTOS = [
    {"id": "aneel_ubp_repasse_2026", "orgao": "ANEEL",
     "titulo": "ANEEL homologa repasse preliminar de R$ 5,48 bilhões às distribuidoras, recurso utilizado para reduzir tarifas de energia no Norte e Nordeste (11/08/2026)",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/noticias/2026-defeso-eleitoral/aneel-homologa-repasse-preliminar-de-r-5-48-bilhoes-as-distribuidoras-recurso-utilizado-para-reduzir-tarifas-de-energia-no-norte-e-nordeste",
     "licenca": LIC_GOVBR,
     "trechos": ["a distribuição preliminar de R$ 5,48 bilhões às distribuidoras, provenientes da repactuação do Uso de Bem Público (UBP)",
                 "possibilitou a substituição de pagamentos futuros de UBP por aportes na Conta de Desenvolvimento Energético (CDE)",
                 "garantir a redução tarifária para consumidores do ambiente regulado nas regiões da Sudam e Sudene nos anos de 2025 e 2026"]},
    {"id": "aneel_gestao_recursos_tarifarios", "orgao": "ANEEL", "titulo": "ANEEL: página Gestão de Recursos Tarifários (CDE)",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios", "licenca": LIC_GOVBR,
     "trechos": ["Cabe à ANEEL aprovar o Orçamento Anual da CDE e fixar a quota anual, que deve corresponder à diferença entre a necessidade total de recursos da Conta e a arrecadação proporcionada pelas demais fontes"]},
]

# Reconciliação externa do custeio da CDE: o conjunto traz o orçamento anual da conta
# (despesa igual à receita porque a quota fecha a diferença, como descreve a página de
# Gestão de Recursos Tarifários). Os totais publicados pela ANEEL nas notícias abaixo
# são comparados com a soma das despesas do arquivo. Em 30/09/2026 o corpo dessas
# notícias exige autenticação no gov.br (conteúdo restrito durante o defeso eleitoral):
# só o título pôde ser lido, no índice de busca, e a página não está no bronze. Por isso
# a reconciliação sai com resultado "ressalva" mesmo quando os valores conferem.
REFERENCIAS_ORCAMENTO_CDE = [
    {"ano": "2026", "situacao": "previsto (consulta pública)",
     "titulo": "Orçamento da CDE 2026, previsto em R$ 52,7 bilhões, entra em consulta pública",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/noticias/2025/orcamento-da-cde-2026-previsto-em-r-52-7-bilhoes-entra-em-consulta-publica"},
    {"ano": "2025", "situacao": "aprovado",
     "titulo": "Orçamento da CDE 2025, de R$ 49,2 bilhões, é aprovado pela ANEEL",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/noticias/2025/orcamento-da-cde-2025-de-r-49-2-bilhoes-e-aprovado-pela-aneel"},
    {"ano": "2023", "situacao": "aprovado",
     "titulo": "ANEEL aprova orçamento de R$ 34,99 bilhões para a Conta de Desenvolvimento Energético",
     "url": "https://www.gov.br/aneel/pt-br/assuntos/noticias/2023/aneel-aprova-orcamento-de-r-34-99-bilhoes-para-a-conta-de-desenvolvimento-energetico"},
]
ACESSO_REFERENCIAS_CDE = ("títulos das notícias oficiais da ANEEL lidos no índice de busca em 30/09/2026; o corpo das "
                          "páginas exige autenticação no gov.br (conteúdo restrito durante o defeso eleitoral) e não foi "
                          "guardado no bronze")

# Mudanças de perímetro (incorporações entre distribuidoras), que o conjunto de tarifas
# não informa: o CNPJ incorporador continua a série, mas a tarifa a partir da data vale
# para a área somada. O evento nessa data não é reajuste comum e a janela que a
# atravessa compara áreas diferentes (fica fora e é contada). Registro por CNPJ, com o
# ato da ANEEL que autorizou o agrupamento. O texto dos atos está no acervo da ANEEL
# (www2.aneel.gov.br/cedoc), que respondeu 403 com desafio do Cloudflare em 30/09/2026;
# o número do ato vem da fonte citada em `identificacao`, e a data é conferida nos
# próprios dados a cada gold (os CNPJs incorporados deixam de ter tarifa na véspera do
# início da tarifa unificada do incorporador). CNPJ que sai do conjunto sem registro
# aqui continua com o motivo "não informado".
INCORPORACOES = [
    {"id": "ess_2017", "incorporadora": "07282377000120",
     "incorporadas": ["07297359000111", "60942281000123", "61416244000144", "77882504000107"],
     "ato": "REA nº 6.318/2017", "data_ato": "2017-04-25", "tarifa_unificada_desde": "2017-07-12",
     "descricao": "Agrupamento das concessões da Caiuá (hoje Energisa Sul-Sudeste), Bragantina, Nacional, Vale Paranapanema e Força e Luz do Oeste, por incorporação pela Caiuá.",
     "identificacao": "número e data do ato lidos em resumo de buscador sobre o agrupamento (o documento primário não pôde ser lido)"},
    {"id": "cpfl_santa_cruz_2018", "incorporadora": "53859112000169",
     "incorporadas": ["52503802000118", "60855608000120", "61015582000174", "61116265000144"],
     "ato": "REA nº 6.723/2017", "data_ato": "2017-11-21", "tarifa_unificada_desde": "2018-03-22",
     "descricao": "Agrupamento das concessões da CPFL Jaguari, Mococa, Leste Paulista, Sul Paulista e Santa Cruz, por incorporação pela CPFL Jaguari, que passou a usar o nome CPFL Santa Cruz.",
     "identificacao": "arquivo rea20176723ti.pdf do acervo da ANEEL (listado por buscador, acesso bloqueado) e demonstrações da Companhia Jaguari de Energia no site de relações com investidores da CPFL"},
    {"id": "rge_2019", "incorporadora": "02016440000162", "incorporadas": ["02016439000138"],
     "ato": "REA nº 7.499/2018", "data_ato": "2018-12-04", "tarifa_unificada_desde": "2019-06-19",
     "descricao": "Agrupamento das concessões da RGE Sul e da Rio Grande Energia (RGE), por incorporação pela RGE Sul, que passou a usar o nome RGE.",
     "identificacao": "fato relevante da RGE Sul Distribuidora de Energia S.A. (CNPJ 02.016.440/0001-62) de 31/12/2018, que cita a REA nº 7.499 de 04/12/2018"},
    {"id": "emr_2023", "incorporadora": "19527639000158", "incorporadas": ["33249046000106"],
     "ato": "REA nº 12.687/2022 (provável)", "data_ato": "2022-09-13", "tarifa_unificada_desde": "2023-06-22",
     "descricao": "Agrupamento das concessões da Energisa Minas Gerais e da Energisa Nova Friburgo na Energisa Minas Rio.",
     "identificacao": "a autorização de 2022 foi noticiada junto com a da Paraíba (CanalEnergia); o número do ato não foi conferido para Minas Gerais e Nova Friburgo"},
    {"id": "epb_2023", "incorporadora": "09095183000140", "incorporadas": ["08826596000195"],
     "ato": "REA nº 12.687/2022", "data_ato": "2022-09-13", "tarifa_unificada_desde": "2023-08-28",
     "descricao": "Agrupamento das concessões da Energisa Paraíba e da Energisa Borborema, por incorporação pela Energisa Paraíba.",
     "identificacao": "notícia de 02/05/2023 (Monitor do Mercado) sobre as assembleias do grupo Energisa, que cita a REA nº 12.687 de 13/09/2022"},
]


def confere_incorporacao(inc, linhas_b1):
    """Confere nos dados uma incorporação registrada: cada CNPJ incorporado tem a última
    vigência B1 terminando na véspera da tarifa unificada, e o incorporador tem um pedaço
    começando nessa data. linhas_b1 = {cnpj: linha do tempo B1 residencial de aplicação}."""
    d = inc["tarifa_unificada_desde"]
    vespera = (_d(d) - timedelta(days=1)).isoformat()
    fins = {cn: (linhas_b1[cn][-1]["fim"] if linhas_b1.get(cn) else None) for cn in inc["incorporadas"]}
    ok_fins = all(f == vespera for f in fins.values())
    ok_inc = any(p["inicio"] == d for p in linhas_b1.get(inc["incorporadora"], []))
    presentes = [cn for cn in [inc["incorporadora"], *inc["incorporadas"]] if linhas_b1.get(cn)]
    situacao = "confirmada" if (ok_fins and ok_inc) else ("sem_dados" if not presentes else "divergente")
    return {"confirmada_nos_dados": ok_fins and ok_inc, "situacao": situacao, "fim_das_incorporadas": fins,
            "incorporadora_com_tarifa_nova_na_data": ok_inc}


def mudancas_de_perimetro(cnpj, registro=INCORPORACOES):
    """{data da tarifa unificada: incorporação} em que o CNPJ é o incorporador."""
    return {inc["tarifa_unificada_desde"]: inc for inc in registro if inc["incorporadora"] == cnpj}


def atravessa_perimetro(cnpj, d_ini, d_fim, registro=INCORPORACOES):
    """Incorporações do CNPJ cuja tarifa unificada começa depois de d_ini e até d_fim: a
    tarifa em d_ini é da área antiga e a de d_fim, da área somada."""
    return [inc for inc in registro if inc["incorporadora"] == cnpj and d_ini < inc["tarifa_unificada_desde"] <= d_fim]


REGRAS_SIMULADOR = {
    "custo_disponibilidade_kwh": {"monofasico": 30, "bifasico": 50, "trifasico": 100},
    "tarifa_social_limite_kwh": 80,
    "desconto_social_limite_kwh": 120,
    "desconto_social_desde": "2026-01-01",
}

REGRAS_TEXTO = [
    {"id": "tarifa_social", "norma": "lei_15235_2025",
     "texto": "Tarifa Social (Lei nº 12.212/2010, art. 1º, na redação da Lei nº 15.235/2025): desconto de 100% sobre a parcela do consumo até 80 kWh/mês e de 0% sobre a parcela acima de 80 kWh/mês, incidente sobre a tarifa da classe residencial. Beneficiários não pagam CDE nem Proinfa (página da ANEEL), por isso a ANEEL homologa uma tarifa própria da subclasse (Residencial Tarifa Social, faixas 01 e 02).",
     "aplicacao_no_simulador": "Faixa 01 (até 80 kWh): valor calculado com a tarifa da faixa 01 e abatido integralmente. Faixa 02 (acima de 80 kWh): tarifa homologada da faixa 02, sem desconto.",
     "partes": [{"texto": "Desconto de 100% até 80 kWh/mês e de 0% acima, sobre a tarifa da classe residencial", "norma": "lei_15235_2025"},
                {"texto": "Tarifa própria da subclasse (faixas 01 e 02), porque beneficiários não pagam CDE nem Proinfa", "norma": "aneel_tarifa_social"}]},
    {"id": "desconto_social", "norma": "lei_15235_2025",
     "texto": "Desconto Social (Lei nº 10.438/2002, art. 13, § 3º-I, incluído pela Lei nº 15.235/2025): desde 1º/1/2026, famílias do CadÚnico com renda per capita acima de meio e até um salário mínimo têm isenção das quotas da CDE para consumo mensal de até 120 kWh, em uma unidade consumidora.",
     "aplicacao_no_simulador": "Leitura por parcela, seguindo as faixas homologadas pela ANEEL (Residencial Desconto Social, faixas 01 e 02): até 120 kWh com a tarifa da faixa 01 e o excedente com a da faixa 02. O texto da REN que regulamenta a aplicação não pôde ser lido (bloqueio de acesso ao acervo da ANEEL); por isso a leitura é declarada.",
     "partes": [{"texto": "Isenção das quotas da CDE até 120 kWh/mês desde 1º/1/2026", "norma": "lei_15235_2025"},
                {"texto": "Aplicação por parcela: faixa 01 até 120 kWh e faixa 02 no excedente", "norma": None,
                 "motivo": "a REN que regulamenta a aplicação não pôde ser lida (acervo da ANEEL bloqueado)"}]},
    {"id": "custo_disponibilidade", "norma": "aneel_geracao_distribuida",
     "texto": "Custo de disponibilidade do grupo B: valor em reais equivalente a 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico), cobrado como valor mínimo quando o consumo é menor (páginas oficiais da ANEEL; a REN nº 1.000/2021 é a norma de origem, mas seu texto não pôde ser lido no acervo da ANEEL, que bloqueou o acesso automatizado).",
     "aplicacao_no_simulador": "Classes residencial, rural, demais classes e Desconto Social: energia faturada = maior entre o consumo e o mínimo da ligação. Tarifa Social: sem mínimo até 80 kWh (página da ANEEL); acima de 80 kWh o mínimo não é aplicado, e isso é declarado como regra não conferida.",
     "partes": [{"texto": "Mínimo de 30, 50 ou 100 kWh (monofásico, bifásico, trifásico) nas classes residencial, rural, demais e Desconto Social", "norma": "aneel_geracao_distribuida"},
                {"texto": "Tarifa Social sem mínimo até 80 kWh, inclusive em ligação trifásica", "norma": "aneel_tarifa_social"},
                {"texto": "Tarifa Social acima de 80 kWh: mínimo não aplicado", "norma": None,
                 "motivo": "a REN nº 1.000/2021 não pôde ser lida; a regra do mínimo para a Tarifa Social acima de 80 kWh não foi conferida"}]},
    {"id": "bandeira", "norma": "aneel_bandeiras",
     "texto": "Bandeira tarifária: acréscimo por kWh consumido conforme o patamar acionado no mês (verde sem acréscimo). Não se aplica a consumidores de sistemas isolados.",
     "aplicacao_no_simulador": "Adicional × kWh consumido. Tarifa Social: aplicado só sobre a parcela acima de 80 kWh, porque a ANEEL informa que, até 80 kWh, a fatura pode conter apenas cobranças não associadas à energia consumida; a regra específica da REN não foi lida.",
     "partes": [{"texto": "Adicional por kWh consumido conforme o patamar do mês; não se aplica a sistemas isolados", "norma": "aneel_bandeiras"},
                {"texto": "Tarifa Social: bandeira só sobre a parcela acima de 80 kWh", "norma": None,
                 "motivo": "leitura da página da ANEEL sobre a fatura até 80 kWh; a regra específica da REN não foi lida"}]},
    {"id": "exclusoes", "norma": "aneel_custo_energia",
     "texto": "Tributos (ICMS estadual, PIS/Pasep e Cofins federais) e Contribuição para Iluminação Pública municipal compõem a fatura mas não a tarifa homologada. Não há base oficial estruturada por distribuidora e mês com essas alíquotas efetivas; ficam fora de todos os números deste módulo.",
     "aplicacao_no_simulador": "Não incluídos. O resultado é uma estimativa sem tributos e sem iluminação pública.",
     "partes": [{"texto": "Tributos e iluminação pública compõem a fatura, não a tarifa homologada", "norma": "aneel_custo_energia"}]},
]


def estado_das_regras(regras_texto, estado_norma):
    """Estado de cada regra do simulador a partir das partes: o trecho normativo conferido
    na captura não confere a leitura aplicada que a norma lida não cobre. Parte sem norma
    é leitura declarada (NAO_CONFERIDA). Regra: CONFERIDA se todas as partes estão
    conferidas, PARCIAL se só algumas, NAO_CONFERIDA se nenhuma."""
    regras, estados = [], {}
    for r_ in regras_texto:
        partes = []
        for pt in r_["partes"]:
            est = estado_norma.get(pt["norma"]) if pt.get("norma") else "NAO_CONFERIDA"
            partes.append({"texto": pt["texto"], "norma": pt.get("norma"), "estado": est or "NAO_CAPTURADA",
                           "motivo": pt.get("motivo")})
        ok = [p_["estado"] == "CONFERIDA" for p_ in partes]
        estados[r_["id"]] = "CONFERIDA" if all(ok) else ("PARCIAL" if any(ok) else "NAO_CONFERIDA")
        regras.append({**{k: v for k, v in r_.items() if k != "partes"}, "partes": partes, "estado": estados[r_["id"]]})
    return regras, estados

# Classificação dos componentes (códigos do conjunto oficial) em grupos de leitura.
# A ANEEL descreve a tarifa como energia + transporte (transmissão e distribuição) +
# encargos setoriais; o PRORET, submódulo 7.1, define as componentes, mas o arquivo
# (git.aneel.gov.br) bloqueou o acesso automatizado. O agrupamento abaixo é do
# observatório, feito pelo código de cada componente, e cada código continua visível.
GRUPOS = [
    ("energia", "Energia comprada", ("TE_ENERGIA", "TE_ANGRA")),
    ("transmissao", "Transmissão e conexão", ("TUSD_RB", "TUSD_FR", "TUSD_CUSD", "TUSD_CCT", "TUSD_CCD", "TUSDG_T",
                                             "TE_TRANSPORTE_ITAIPU", "TE_TUST_ITAIPU", "TE_TUST_CI")),
    ("distribuicao", "Distribuição (fio B)", ("TUSD_FioB",)),
    ("perdas", "Perdas e receitas irrecuperáveis", ("TUSD_PT", "TUSD_PNT", "TUSD_Per_RB_D", "TE_Per_RB", "TUSD_RI")),
    ("encargos", "Encargos setoriais", ("TUSD_CDE", "TUSD_CDE_COVID", "TUSD_PROINFA", "TUSD_TFSEE", "TUSD_PeD", "TUSD_ONS",
                                        "TUSD_RGR", "TUSD_CCC", "TUSDG_ONS", "TE_ESSERR", "TE_CFURH", "TE_PeD",
                                        "TE_CDE_ELET", "TE_CDE_GD", "TE_CDE_COVID")),
    ("outros", "Outros componentes e ajustes", ("TUSD_SUBSIDIO", "TE_SUBSIDIO", "TUSD BENEFICIO_L14299",
                                                "TE_BENEFICIO_L14299", "TUSD_Liminar", "TE_Liminar", "TUSD_OUTROS")),
    # sem código próprio: recebe só o valor negativo de componente de custo listada em
    # RECLASSIFICA_SE_NEGATIVO (ver abaixo); o código continua visível na lista de créditos
    ("creditos", "Créditos tarifários lançados em componente de custo", ()),
]
GRUPO_DE = {cod: g for g, _, cods in GRUPOS for cod in cods}
TOTAIS_COMP = ("TE", "TUSD")
# Grupos cuja natureza é custo: a soma do grupo não deveria ser negativa, e componente
# negativa de peso material nesses grupos é atípica (conferida no arquivo original).
GRUPOS_DE_CUSTO = ("energia", "transmissao", "distribuicao", "perdas", "encargos")

# Componente de custo cujo valor negativo não é custo daquela natureza e sai do grupo.
# TE_CFURH: a compensação financeira pelo uso de recursos hídricos é paga pelas
# hidrelétricas; como parcela de custo da TE, de 2012 a 2024 ficou entre -5,38 e 4,44
# R$/MWh em todas as vigências publicadas. A partir de 13/12/2025 o código aparece com
# -13 a -267 R$/MWh em distribuidoras das áreas da Sudam e da Sudene, as mesmas que a
# ANEEL listou em 11/08/2026 no repasse de R$ 5,48 bilhões da repactuação do Uso de Bem
# Público (UBP, Lei nº 15.235/2025) para reduzir tarifas (página guardada no bronze e
# conferida em DOCUMENTOS). Somar esse crédito aos encargos deixava o grupo negativo
# (CEA, ERO) e menor que a própria parcela CDE. O PRORET, que diria em qual componente
# o crédito é lançado, não pôde ser lido: por isso o valor negativo vai para
# "créditos" com a origem declarada como provável, e o código continua visível.
RECLASSIFICA_SE_NEGATIVO = {
    "TE_CFURH": {"grupo": "creditos", "documento": "aneel_ubp_repasse_2026",
                 "leitura": ("valor negativo na componente CFURH lido como crédito tarifário, provavelmente o repasse da "
                             "repactuação da UBP (Lei nº 15.235/2025) às distribuidoras das áreas da Sudam e da Sudene; "
                             "a regra de lançamento (PRORET) não pôde ser lida")},
}
# Componente atípica (vira ressalva visível e é conferida no arquivo original):
# (a) sinal contrário à natureza do grupo de custo com módulo de pelo menos 5% da tarifa
#     da distribuidora; devoluções pequenas (CDE Covid, P&D) são comuns e ficam abaixo;
# (b) módulo mais de 10 vezes a mediana do módulo da mesma componente entre as
#     distribuidoras que a publicam com valor diferente de zero na data, também com pelo
#     menos 5% da tarifa (pega um código usado no lugar de outro, como a energia inteira
#     lançada em TE_ANGRA). O zero fica fora da mediana porque vários códigos só existem
#     em parte das distribuidoras (uso da rede de outra distribuidora, por exemplo), e a
#     mediana com zeros marcaria como atípico o que é estrutural.
# Os 5% (cerca de R$ 0,04/kWh na tarifa mediana) separam valor que muda a leitura da
# composição de ajuste de centavos. Em 30/09/2026 a regra marca 18 componentes em 15
# distribuidoras (documento, seção 4), todas conferidas no Parquet original.
ATIPICO_PCT_TARIFA = 5.0
ATIPICO_FATOR_MEDIANA = 10.0
# SAMP: receita ou ICMS de um mês acima de 5 vezes a mediana dos outros meses do mesmo
# ano é erro de ordem de grandeza, não sazonalidade. No arquivo de 2025, fora os três
# meses da CEMIG-D que motivaram a exclusão (razões de 9,7 a 10,8), nenhum dos 2.400
# pares distribuidora-mês das duas linhas passa de 1,95 vez a mediana dos outros meses.
FATOR_ATIPICO_SAMP = 5.0

DESCRICAO_COMPONENTE = {
    "TE_ENERGIA": "Custo da energia comprada pela distribuidora",
    "TE_ANGRA": "Energia das usinas de Angra 1 e 2",
    "TE_TRANSPORTE_ITAIPU": "Transporte da energia de Itaipu",
    "TE_TUST_ITAIPU": "Uso da transmissão associado a Itaipu",
    "TE_TUST_CI": "Uso da transmissão (código TUST_CI da fonte)",
    "TE_Per_RB": "Perdas na rede básica (parcela da TE)",
    "TE_ESSERR": "Encargos de serviços do sistema e de energia de reserva",
    "TE_CFURH": "Compensação financeira pelo uso de recursos hídricos",
    "TE_PeD": "Pesquisa e desenvolvimento e eficiência energética (TE)",
    "TE_CDE_ELET": "CDE (código CDE_ELET da fonte)", "TE_CDE_GD": "CDE (código CDE_GD da fonte)",
    "TE_CDE_COVID": "CDE Conta Covid (TE)", "TE_SUBSIDIO": "Subsídio (TE)",
    "TE_BENEFICIO_L14299": "Benefício da Lei nº 14.299/2022 (TE)", "TE_Liminar": "Efeito de decisão liminar (TE)",
    "TUSD_RB": "Rede básica de transmissão", "TUSD_FR": "Instalações de fronteira com a rede básica",
    "TUSD_CUSD": "Uso do sistema de outra distribuidora", "TUSD_CCT": "Conexão às instalações de transmissão",
    "TUSD_CCD": "Conexão às instalações de distribuição", "TUSDG_T": "TUSD de geração (transmissão)",
    "TUSD_FioB": "Custo da própria distribuidora (fio B)",
    "TUSD_PT": "Perdas técnicas", "TUSD_PNT": "Perdas não técnicas", "TUSD_Per_RB_D": "Perdas na rede básica (parcela da TUSD)",
    "TUSD_RI": "Receitas irrecuperáveis", "TUSD_CDE": "Conta de Desenvolvimento Energético",
    "TUSD_CDE_COVID": "CDE Conta Covid (TUSD)", "TUSD_PROINFA": "Proinfa", "TUSD_TFSEE": "Taxa de fiscalização (TFSEE)",
    "TUSD_PeD": "Pesquisa e desenvolvimento e eficiência energética (TUSD)", "TUSD_ONS": "Operador Nacional do Sistema",
    "TUSD_RGR": "Reserva Global de Reversão", "TUSD_CCC": "Conta de Consumo de Combustíveis",
    "TUSDG_ONS": "TUSD de geração (ONS)", "TUSD_SUBSIDIO": "Subsídio (TUSD)",
    "TUSD BENEFICIO_L14299": "Benefício da Lei nº 14.299/2022 (TUSD)", "TUSD_Liminar": "Efeito de decisão liminar (TUSD)",
    "TUSD_OUTROS": "Outros (TUSD)",
}

# Classes do simulador → (subgrupo, subclasse) no conjunto de tarifas
CLASSES_TARIFA = {
    "residencial": ("B1", "Residencial"),
    "ts1": ("B1", "Residencial Tarifa Social – faixa 01"),
    "ts2": ("B1", "Residencial Tarifa Social – faixa 02"),
    "ds1": ("B1", "Residencial Desconto Social – faixa 01"),
    "ds2": ("B1", "Residencial Desconto Social – faixa 02"),
    "rural": ("B2", "Não se aplica"),
    "demais": ("B3", "Não se aplica"),
}
CLASSES_SIMULADOR = [
    {"id": "residencial", "rotulo": "Residencial (B1)", "tarifas": ["residencial"]},
    {"id": "tarifa_social", "rotulo": "Residencial Tarifa Social (baixa renda)", "tarifas": ["ts1", "ts2"]},
    {"id": "desconto_social", "rotulo": "Residencial Desconto Social", "tarifas": ["ds1", "ds2"]},
    {"id": "rural", "rotulo": "Rural (B2)", "tarifas": ["rural"]},
    {"id": "demais", "rotulo": "Demais classes em baixa tensão (B3: comercial, industrial e outras)", "tarifas": ["demais"]},
]
PERFIS_KWH = (100, 200, 300)
JANELAS_MESES = (12, 60, 120)

CATEGORIAS_SUBSIDIO = {
    "Rural": "Desconto tarifário da classe rural.",
    "Irrigação e Aquicultura": "Desconto ao consumo de irrigação e aquicultura em horário especial (8h30 diárias, Lei nº 10.438/2002, art. 25).",
    "Água-esgoto-saneamento": "Desconto ao serviço público de água, esgoto e saneamento.",
    "Consumidor Fonte Incentivada": "Desconto na tarifa de uso de consumidores que compram energia de fonte incentivada.",
    "Geração Fonte Incentivada": "Desconto na tarifa de uso de geradores de fonte incentivada.",
    "Distribuidora": "Desconto a distribuidora com mercado próprio inferior a 500 GWh/ano.",
    "SCEE": "Categoria ligada ao Sistema de Compensação de Energia Elétrica da micro e minigeração distribuída (Lei nº 14.300/2022); o dicionário não detalha a regra de cálculo.",
    "Lei 14.299/2022": "Subvenção prevista na Lei nº 14.299/2022, cuja ementa trata de subvenção econômica às concessionárias de distribuição de pequeno porte.",
}
NOTA_SUBSIDIOS = ("Os valores são repasses da CDE às distribuidoras para compensar descontos tarifários concedidos a "
                  "categorias de usuários. Não são transferências a famílias. A Tarifa Social (baixa renda) é custeada "
                  "pela CDE por outra rubrica e não integra este conjunto.")


# ---------------------------------------------------------------------------
# Coleta
# ---------------------------------------------------------------------------

def _ja_processada(con, ds, vid):
    return con.execute("SELECT 1 FROM registros WHERE dataset=? AND chave=? LIMIT 1",
                       (ds, f"__processada__|{vid}|{VERSAO_PARSER}")).fetchone() is not None


def _marca_processada(con, ds, vid, contagem):
    linhas = [(f"__processada__|{vid}|{VERSAO_PARSER}", "ok", "1")]
    linhas += [(f"__universo__|{vid}", k, str(v)) for k, v in sorted(contagem.items())]
    base.grava_registros(con, ds, vid, linhas)


def _processa_tarifas(con, v):
    if _ja_processada(con, DS_TARIFAS, v["vintage_id"]):
        return {"reprocessada": False}
    contagem, obs, regs, vistos = {}, [], [], {}
    for l in fa.linhas_tarifas(v["arquivo"], contagem):
        ref = f"{l['inicio']}|{l['fim']}|{l['ato']}"
        s = f"{l['cnpj']}|{l['subgrupo']}|{l['subclasse']}|{l['base']}"
        chave = (s, ref)
        par = (l["te"], l["tusd"])
        if chave in vistos and vistos[chave] != par:
            # a fonte repetiu a mesma vigência e ato com valores diferentes: fica a
            # última, e o conflito fica contado no universo
            contagem["duplicatas_conflitantes"] = contagem.get("duplicatas_conflitantes", 0) + 1
        vistos[chave] = par
        obs.append((s + "|TE", ref, l["te"]))
        obs.append((s + "|TUSD", ref, l["tusd"]))
        regs.append((f"agente|{l['cnpj']}", f"sigla|{l['inicio']}", l["sigla"]))
        regs.append((f"ato|{l['ato']}", "texto", l["ato_texto"]))
        regs.append((f"ato|{l['ato']}", "data", l["ato_data"]))
        regs.append(("__arquivo__", "gerado_em", l["gerado_em"]))
    novas, rev = base.grava_observacoes(con, DS_TARIFAS, v["vintage_id"], obs)
    base.grava_registros(con, DS_TARIFAS, v["vintage_id"], regs)
    _marca_processada(con, DS_TARIFAS, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_componentes(con, v):
    if _ja_processada(con, DS_COMP, v["vintage_id"]):
        return {"reprocessada": False}
    contagem, obs, regs, vistos = {}, [], [], {}
    for l in fa.linhas_componentes(v["arquivo"], contagem):
        ref = f"{l['inicio']}|{l['fim']}|{l['ato']}"
        serie = f"{l['cnpj']}|B1|Residencial|TA|{l['componente']}"
        # a mesma componente pode vir repetida na mesma vigência e ato; valor igual não é
        # problema, valor diferente fica contado no universo (vale a última, como no silver)
        if (serie, ref) in vistos:
            chave_dup = "duplicatas_iguais" if vistos[(serie, ref)] == l["valor"] else "duplicatas_conflitantes"
            contagem[chave_dup] = contagem.get(chave_dup, 0) + 1
        vistos[(serie, ref)] = l["valor"]
        obs.append((serie, ref, l["valor"]))
        regs.append((f"ato|{l['ato']}", "texto", l["ato_texto"]))
    novas, rev = base.grava_observacoes(con, DS_COMP, v["vintage_id"], obs)
    base.grava_registros(con, DS_COMP, v["vintage_id"], regs)
    _marca_processada(con, DS_COMP, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_bandeiras(con, v):
    if _ja_processada(con, DS_BAND, v["vintage_id"]):
        return {"reprocessada": False}
    obs, regs, contagem = [], [], {}
    nome = v["recurso"].lower()
    if "adicional" in nome:
        for l in fa.linhas_bandeira_adicional(v["arquivo"]):
            if not l["vigencia"]:
                contagem["sem_data"] = contagem.get("sem_data", 0) + 1
                continue
            obs.append((f"adicional|{l['bandeira']}", l["vigencia"], l["rs_mwh"]))
            regs.append((f"adicional|{l['vigencia']}|{l['bandeira']}", "resolucao", l["resolucao"]))
            contagem["linhas"] = contagem.get("linhas", 0) + 1
    elif "acionamento" in nome:
        for l in fa.linhas_bandeira_acionamento(v["arquivo"]):
            if not l["mes"]:
                contagem["sem_data"] = contagem.get("sem_data", 0) + 1
                continue
            obs.append(("acionamento|valor", l["mes"], l["rs_mwh"]))
            regs.append((f"acionamento|{l['mes']}", "bandeira", l["bandeira"]))
            contagem["linhas"] = contagem.get("linhas", 0) + 1
    else:
        return {"reprocessada": False, "ignorado": v["recurso"]}
    novas, rev = base.grava_observacoes(con, DS_BAND, v["vintage_id"], obs)
    base.grava_registros(con, DS_BAND, v["vintage_id"], regs)
    _marca_processada(con, DS_BAND, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_subsidios(con, v):
    if _ja_processada(con, DS_SUBS, v["vintage_id"]):
        return {"reprocessada": False}
    # O silver guarda só o montante Total (previsão + ajuste), que é o grão publicado;
    # previsão e ajuste servem à conferência Total = previsão + ajuste, feita aqui e
    # registrada no universo da vintage. O arquivo completo fica no bronze.
    contagem, obs, regs, por_chave = {}, [], [], {}
    for l in fa.linhas_subsidios(v["arquivo"], contagem):
        por_chave.setdefault((l["cnpj"], l["mes"]), {}).setdefault(l["montante"], {})[l["categoria"]] = l["valor"]
        if l["montante"] == "Total":
            obs.append((f"{l['cnpj']}|Total|{l['categoria']}", l["mes"], l["valor"]))
        else:
            contagem["linhas_previsao_ajuste_so_no_bronze"] = contagem.get("linhas_previsao_ajuste_so_no_bronze", 0) + 1
        regs.append((f"agente|{l['cnpj']}", "nome", l["nome"]))
        regs.append((f"agente|{l['cnpj']}", "sigla", l["sigla"]))
        if l["montante"] == "Total" and l["categoria"] == "Total":
            regs.append((f"ato|{l['cnpj']}|{l['mes']}", "ato", l["ato"]))
            regs.append((f"ato|{l['cnpj']}|{l['mes']}", "publicacao", l["ato_publicacao"]))
    comp = div = 0
    for mts in por_chave.values():
        for cat, x in mts.get("Total", {}).items():
            p_, a_ = mts.get("Previsão", {}).get(cat), mts.get("Ajuste", {}).get(cat)
            if x is not None and p_ is not None and a_ is not None:
                comp += 1
                div += abs(x - (p_ + a_)) > 0.05
    contagem["total_vs_previsao_mais_ajuste_comparacoes"] = comp
    contagem["total_vs_previsao_mais_ajuste_divergem"] = div
    novas, rev = base.grava_observacoes(con, DS_SUBS, v["vintage_id"], obs)
    base.grava_registros(con, DS_SUBS, v["vintage_id"], regs)
    _marca_processada(con, DS_SUBS, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_cde(con, v):
    if _ja_processada(con, DS_CDE, v["vintage_id"]):
        return {"reprocessada": False}
    contagem = {}
    linhas = fa.linhas_cde_custeio(v["arquivo"], contagem)
    obs = [(f"{l['tipo']}|{l['fonte']}", l["ano"], l["valor"]) for l in linhas]
    # rubrica publicada sem valor (vazio) não vira observação, mas fica registrada como
    # existente no ano: a gold distingue "sem valor publicado" de "rubrica inexistente"
    regs = [(f"rubrica|{l['tipo']}|{l['fonte']}", f"ano|{l['ano']}", "vazio" if l["valor"] is None else "valor")
            for l in linhas]
    regs.append(("__arquivo__", "gerado_em", next((l["gerado_em"] for l in linhas if l["gerado_em"]), None)))
    novas, rev = base.grava_observacoes(con, DS_CDE, v["vintage_id"], obs)
    base.grava_registros(con, DS_CDE, v["vintage_id"], regs)
    _marca_processada(con, DS_CDE, v["vintage_id"], contagem)
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev, "universo": contagem}


def _processa_ipca(con, v):
    if _ja_processada(con, DS_IPCA, v["vintage_id"]):
        return {"reprocessada": False}
    with base.abre_bronze(v["arquivo"]) as f:
        linhas = fi.linhas_ipca(f.read())
    obs = [(f"ipca|{var}", mes, val) for var, mes, val in linhas]
    novas, rev = base.grava_observacoes(con, DS_IPCA, v["vintage_id"], obs)
    _marca_processada(con, DS_IPCA, v["vintage_id"], {"linhas": len(obs)})
    con.commit()
    return {"reprocessada": True, "novas": novas, "revisoes": rev}


def texto_de_html(bruto):
    """HTML → texto corrido com espaços normalizados (para conferir trechos de norma)."""
    t = bruto.decode("utf-8", errors="replace") if isinstance(bruto, (bytes, bytearray)) else bruto
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S | re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"\s+", " ", t.replace(" ", " ")).strip()


def confere_trechos(texto, trechos):
    """{trecho: True|False} com comparação por espaços normalizados."""
    alvo = re.sub(r"\s+", " ", texto)
    return {t: re.sub(r"\s+", " ", t) in alvo for t in trechos}


def _processa_norma(con, norma, v):
    with base.abre_bronze(v["arquivo"]) as f:
        texto = texto_de_html(f.read())
    res = confere_trechos(texto, norma["trechos"])
    regs = [(f"norma|{norma['id']}", f"trecho|{i}", "presente" if ok else "ausente")
            for i, (_, ok) in enumerate(res.items())]
    regs.append((f"norma|{norma['id']}", "conferido_em", v["capturado_em"]))
    regs.append((f"norma|{norma['id']}", "sha256", v["sha256"]))
    base.grava_registros(con, DS_NORMAS, v["vintage_id"], regs)
    con.commit()
    return {"trechos_presentes": sum(res.values()), "trechos": len(res)}


def coletar(con, ctx):
    """Coleta todas as fontes do módulo. Falha de uma fonte fica registrada e não
    interrompe as outras (a gold é construída com o que o silver tiver)."""
    status = {"fontes": {}}

    def registra(nome, fn):
        try:
            status["fontes"][nome] = fn()
        except Exception as e:  # fonte fora do ar ou arquivo com esquema novo: registrado, sem número inventado
            base.registra_coleta(con, nome, "*", False, f"{type(e).__name__}: {e}")
            con.commit()
            status["fontes"][nome] = {"ok": False, "erro": f"{type(e).__name__}: {e}"[:400]}

    def pacote(nome_ckan, ds, filtro, processa, max_idade=7):
        st, _, vint = ckan.coleta_pacote(con, orgao="ANEEL", nome=nome_ckan, dataset=ds, filtro_recurso=filtro,
                                         max_idade_dias=max_idade)
        st["processamento"] = {}
        for recurso, v in sorted(vint.items()):
            if (v.get("arquivo") or "").endswith(".pdf.gz"):
                continue  # dicionário de dados: guardado no bronze como evidência, não é lido
            st["processamento"][recurso] = processa(con, v)
        return st

    formato = lambda r, fs: (r.get("format") or "").upper() in fs  # noqa: E731
    registra(DS_TARIFAS, lambda: pacote("tarifas-distribuidoras-energia-eletrica", DS_TARIFAS,
                                        lambda r: formato(r, ("CSV", "PDF")), _processa_tarifas))
    registra(DS_COMP, lambda: pacote("componentes-tarifarias", DS_COMP,
                                     lambda r: formato(r, ("PARQUET", "PDF")), _processa_componentes))
    registra(DS_BAND, lambda: pacote("bandeiras-tarifarias", DS_BAND,
                                     lambda r: formato(r, ("CSV", "PDF")) and "conta bandeira" not in (r.get("name") or "").lower(),
                                     _processa_bandeiras))
    registra(DS_SUBS, lambda: pacote("subsidios-tarifarios", DS_SUBS, lambda r: formato(r, ("CSV", "PDF")),
                                     _processa_subsidios))
    registra(DS_CDE, lambda: pacote(PAC_CDE, DS_CDE, lambda r: formato(r, ("CSV", "PDF")), _processa_cde))

    def ipca():
        res = ckan.baixar_recurso(con, orgao="IBGE", dataset=DS_IPCA, recurso="sidra_1737_ipca", url=fi.URL_SIDRA,
                                  publicado_em=None, ext="json", max_idade_dias=3, baixador=http_download)
        out = {"status": res["status"], "detalhe": res["detalhe"]}
        if res["vintage"]:
            out["processamento"] = _processa_ipca(con, res["vintage"])
        return out
    registra(DS_IPCA, ipca)

    def samp():
        # só guarda o arquivo no bronze (com sha256 e vintage): a conferência que justifica
        # não usar o SAMP é refeita na gold a partir dele (samp_residencial_mensal)
        st, _, vint = ckan.coleta_pacote(con, orgao="ANEEL", nome=PAC_SAMP, dataset=DS_SAMP,
                                         filtro_recurso=lambda r: (r.get("name") or "").strip() == RECURSO_SAMP,
                                         max_idade_dias=30)
        st["vintages"] = {k: v["sha256"] for k, v in vint.items()}
        return st
    registra(DS_SAMP, samp)

    def normas():
        out = {}
        for n in NORMAS + DOCUMENTOS:
            res = ckan.baixar_recurso(con, orgao=entidades.slug(n["orgao"]), dataset=DS_NORMAS, recurso=n["id"], url=n["url"],
                                      publicado_em=None, ext="html", max_idade_dias=7, baixador=http_download)
            out[n["id"]] = {"status": res["status"], "detalhe": res["detalhe"]}
            if res["vintage"] and res["status"] in ("nova", "identica", "pulada"):
                out[n["id"]]["conferencia"] = _processa_norma(con, n, res["vintage"])
        return out
    registra(DS_NORMAS, normas)
    status["ok"] = all(v.get("ok", True) for v in status["fontes"].values())
    return status


# ---------------------------------------------------------------------------
# Leitura do silver
# ---------------------------------------------------------------------------

def valores_vigentes(con, dataset):
    """{serie: {ref: valor}} com o valor da captura mais recente de cada (série, ref)."""
    out = {}
    for serie, ref, valor in con.execute(
            """SELECT o.serie, o.ref, o.valor FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
               WHERE o.dataset=? ORDER BY v.capturado_em, o.rowid""", (dataset,)):
        out.setdefault(serie, {})[ref] = valor
    return out


def segmentos_tarifas(obs):
    """{(cnpj, subgrupo, subclasse, base): [ {inicio, fim, ato, te, tusd} ]}."""
    tmp = {}
    for serie, refs in obs.items():
        cnpj, sub, subclasse, base_t, comp = serie.split("|")
        for ref, v in refs.items():
            inicio, fim, ato_id = ref.split("|", 2)
            tmp.setdefault((cnpj, sub, subclasse, base_t), {}).setdefault((inicio, fim, ato_id), {})[comp.lower()] = v
    out = {}
    for k, refs in tmp.items():
        out[k] = sorted(({"inicio": i, "fim": f, "ato": a, "te": d.get("te"), "tusd": d.get("tusd")}
                         for (i, f, a), d in refs.items()), key=lambda s: (s["inicio"], s["fim"], s["ato"]))
    return out


# ---------------------------------------------------------------------------
# Cálculos (funções puras, testadas em pipeline/tests/test_energia_conta.py)
# ---------------------------------------------------------------------------

def _d(iso):
    return date.fromisoformat(iso[:10])


def data_brasilia(agora=None):
    """Data civil em Brasília (America/Sao_Paulo; UTC−3 fixo sem a base de fusos)."""
    from datetime import datetime, timezone
    agora = agora or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return agora.astimezone(ZoneInfo("America/Sao_Paulo")).date()
    except Exception:  # sem base de fusos: Brasília não tem horário de verão desde 2019
        return (agora - timedelta(hours=3)).date()


def total_rs_mwh(seg):
    """TE + TUSD em R$/MWh. Zero publicado nas duas parcelas significa tarifa não
    homologada para a subclasse (a fonte usa ',00'), não energia de graça: vira None."""
    if seg is None or seg.get("te") is None or seg.get("tusd") is None:
        return None
    if seg["te"] == 0 and seg["tusd"] == 0:
        return None
    return seg["te"] + seg["tusd"]


def vigente_em(segs, dia, datas_ato=None):
    """Segmento em vigor no dia (início e fim inclusivos) e o conflito, se houver.

    Quando a fonte publica vigências sobrepostas com valores diferentes, a regra é
    determinística e publicada: vence a de início mais recente; empate, a do ato mais
    recente; empate, a de vigência mais curta (a mais específica). Conflito devolvido
    para ficar visível; valores iguais não são conflito."""
    dia = dia[:10]
    cand = [s for s in segs if s["inicio"] <= dia <= s["fim"]]
    if not cand:
        return None, None
    if len(cand) == 1:
        return cand[0], None
    datas_ato = datas_ato or {}

    def chave(s):
        dur = (_d(s["fim"]) - _d(s["inicio"])).days
        return (s["inicio"], datas_ato.get(s["ato"]) or "", -dur, s["ato"])
    esc = max(cand, key=chave)
    valores = {(s["te"], s["tusd"]) for s in cand}
    conflito = None
    if len(valores) > 1:
        conflito = {"dia": dia, "escolhido": {k: esc[k] for k in ("inicio", "fim", "ato", "te", "tusd")},
                    "alternativas": [{k: s[k] for k in ("inicio", "fim", "ato", "te", "tusd")} for s in cand if s is not esc]}
    return esc, conflito


def linha_do_tempo(segs, datas_ato=None):
    """Vigências sem sobreposição, resolvidas pela regra de vigente_em e unidas quando
    o valor e o ato não mudam. Lacuna entre vigências fica como lacuna."""
    if not segs:
        return [], []
    marcos = set()
    for s in segs:
        marcos.add(s["inicio"])
        marcos.add((_d(s["fim"]) + timedelta(days=1)).isoformat())
    marcos = sorted(marcos)
    pedacos, conflitos = [], []
    for i, m in enumerate(marcos[:-1]):
        s, conf = vigente_em(segs, m, datas_ato)
        if s is None:
            continue
        fim = (_d(marcos[i + 1]) - timedelta(days=1)).isoformat()
        if conf:
            conflitos.append({**conf, "ate": fim})
        p = {"inicio": m, "fim": fim, "ato": s["ato"], "te": s["te"], "tusd": s["tusd"]}
        ant = pedacos[-1] if pedacos else None
        if (ant and ant["ato"] == p["ato"] and ant["te"] == p["te"] and ant["tusd"] == p["tusd"]
                and (_d(ant["fim"]) + timedelta(days=1)).isoformat() == p["inicio"]):
            ant["fim"] = p["fim"]
        else:
            pedacos.append(p)
    return pedacos, conflitos


def em(linha, dia):
    """Pedaço da linha do tempo em vigor no dia, ou None."""
    for p in linha:
        if p["inicio"] <= dia <= p["fim"]:
            return p
    return None


COLUNAS_CSV_SUBS = ["ano", "cnpj", "sigla", "categoria", "montante", "valor_rs", "meses", "eh_total"]


def linhas_csv_subsidios(csv_s, sigla):
    """Linhas do CSV de subsídios por ano, distribuidora e categoria. `eh_total` marca a linha da categoria "Total" (a que a fonte
    publica reunindo as demais): somar valor_rs sem filtrar essa coluna conta cada real duas vezes. Valores em R$ com meio para cima."""
    return [[a, cn, sigla.get(cn) or "", cat, mt, c.r(v[0], 2), v[1], "sim" if cat == "Total" else "nao"]
            for (a, cn, cat, mt), v in sorted(csv_s.items())]


def custo_perfil(total, kwh):
    """R$ no mês para `kwh` kWh a `total` R$/MWh (sem tributos e sem bandeira)."""
    return None if total is None else kwh * total / 1000.0


def grupo_da_componente(cod, valor):
    """Grupo de leitura de uma componente: pelo código, exceto o valor negativo de
    componente listada em RECLASSIFICA_SE_NEGATIVO, que vai para o grupo indicado ali."""
    regra = RECLASSIFICA_SE_NEGATIVO.get(cod)
    if regra and valor is not None and valor < 0:
        return regra["grupo"]
    return GRUPO_DE.get(cod)


def grupos_componentes(comps):
    """{grupo: soma R$/MWh} e checagens: soma das parcelas da TE e da TUSD contra os
    totais TE e TUSD publicados no próprio conjunto. Código sem grupo conhecido vai
    para 'outros' e é listado, nunca descartado; valor reclassificado pelo sinal fica
    listado em `reclassificadas` com o grupo que teria pelo código."""
    grupos = {g: 0.0 for g, _, _ in GRUPOS}
    desconhecidos, reclassificadas = [], []
    soma_te = soma_tusd = 0.0
    for cod, v in comps.items():
        if cod in TOTAIS_COMP or v is None:
            continue
        g = grupo_da_componente(cod, v)
        if g is None:
            desconhecidos.append(cod)
            g = "outros"
        elif g != GRUPO_DE.get(cod, g):
            reclassificadas.append({"codigo": cod, "valor": v, "grupo_pelo_codigo": GRUPO_DE[cod], "grupo_usado": g})
        grupos[g] += v
        if cod.startswith("TE"):
            soma_te += v
        else:
            soma_tusd += v
    return grupos, {"soma_te": soma_te, "soma_tusd": soma_tusd, "te": comps.get("TE"), "tusd": comps.get("TUSD"),
                    "desconhecidos": sorted(desconhecidos),
                    "reclassificadas": sorted(reclassificadas, key=lambda x: x["codigo"])}


def componentes_atipicas(comps, total, mediana_modulo):
    """Componentes atípicas de uma distribuidora (regras em ATIPICO_*), para ressalva e
    conferência no arquivo original. mediana_modulo = {código: mediana de |valor| entre
    as distribuidoras que publicam o código com valor diferente de zero na data}. Nada é
    descartado: a lista só marca."""
    out = []
    if not total:
        return out
    for cod, v in sorted(comps.items()):
        if cod in TOTAIS_COMP or v is None:
            continue
        pct = 100.0 * v / total
        if abs(pct) < ATIPICO_PCT_TARIFA:
            continue
        g_codigo = GRUPO_DE.get(cod, "outros")
        criterios = []
        if g_codigo in GRUPOS_DE_CUSTO and v < 0:
            criterios.append("sinal contrário à natureza do grupo")
        med = mediana_modulo.get(cod)
        if med is not None and abs(v) > ATIPICO_FATOR_MEDIANA * med:
            criterios.append(f"módulo mais de {ATIPICO_FATOR_MEDIANA:g} vezes a mediana da componente entre as distribuidoras que a publicam")
        if criterios:
            out.append({"codigo": cod, "valor": v, "pct_tarifa": pct, "grupo_pelo_codigo": g_codigo,
                        "grupo_usado": grupo_da_componente(cod, v) or "outros", "mediana_modulo": med,
                        "criterios": criterios})
    return out


# componentes com CDE no código (subconjunto de "encargos"): é por elas que o consumidor
# cativo paga a CDE na tarifa; a finalidade de cada código está no PRORET (não lido)
CODIGOS_CDE = ("TUSD_CDE", "TUSD_CDE_COVID", "TE_CDE_ELET", "TE_CDE_GD", "TE_CDE_COVID")


def parcela_cde(comps):
    """Soma das componentes da CDE publicadas (R$/MWh), ou None se nenhuma foi publicada:
    ausência não vira zero."""
    xs = [comps[cd] for cd in CODIGOS_CDE if comps.get(cd) is not None]
    return sum(xs) if xs else None


def _tarifa(tarifas, chave):
    t = tarifas.get(chave)
    if not t:
        return None
    te, tusd = t
    if te is None or tusd is None or (te == 0 and tusd == 0):
        return None
    return te + tusd


def simular(tarifas, classe, kwh, ligacao, adicional_rs_mwh=0.0, regras=REGRAS_SIMULADOR):
    """Estimativa mensal SEM TRIBUTOS para uma unidade consumidora de baixa tensão.

    tarifas: {chave de CLASSES_TARIFA: (te, tusd) em R$/MWh}. kwh: consumo do mês.
    ligacao: monofasico | bifasico | trifasico. adicional_rs_mwh: bandeira do mês.
    Devolve {disponivel, motivo, linhas [{rotulo, kwh, rs_kwh, valor}], total, bandeira,
    kwh_faturado, observacoes}. Toda linha tem a regra aplicada, para a memória de
    cálculo da interface."""
    if kwh is None or kwh < 0:
        return {"disponivel": False, "motivo": "consumo inválido"}
    minimo = regras["custo_disponibilidade_kwh"].get(ligacao)
    if minimo is None:
        return {"disponivel": False, "motivo": f"tipo de ligação desconhecido: {ligacao}"}
    adic = adicional_rs_mwh or 0.0
    linhas, obs = [], []

    def linha(rotulo, q, t, sinal=1):
        v = sinal * q * t / 1000.0
        linhas.append({"rotulo": rotulo, "kwh": q, "rs_kwh": t / 1000.0, "valor": v})
        return v

    if classe in ("residencial", "rural", "demais"):
        t = _tarifa(tarifas, classe)
        if t is None:
            return {"disponivel": False, "motivo": "tarifa da classe não publicada para esta distribuidora na vigência"}
        fat = max(kwh, minimo)
        linha("Energia faturada (TE + TUSD)", fat, t)
        if fat > kwh:
            obs.append(f"Consumo abaixo do custo de disponibilidade: faturados {minimo} kWh ({ligacao}).")
        kwh_bandeira = kwh
    elif classe == "desconto_social":
        t1, t2 = _tarifa(tarifas, "ds1"), _tarifa(tarifas, "ds2")
        if t1 is None or t2 is None:
            return {"disponivel": False, "motivo": "tarifas do Desconto Social não publicadas para esta distribuidora na vigência"}
        lim = regras["desconto_social_limite_kwh"]
        fat = max(kwh, minimo)
        linha(f"Faixa 01, até {lim} kWh, sem quotas da CDE", min(fat, lim), t1)
        if fat > lim:
            linha(f"Faixa 02, acima de {lim} kWh", fat - lim, t2)
        if fat > kwh:
            obs.append(f"Consumo abaixo do custo de disponibilidade: faturados {minimo} kWh ({ligacao}).")
        obs.append("Leitura por parcela das faixas homologadas; regra da REN não conferida (acervo da ANEEL bloqueado).")
        kwh_bandeira = kwh
    elif classe == "tarifa_social":
        t1, t2 = _tarifa(tarifas, "ts1"), _tarifa(tarifas, "ts2")
        if t1 is None or t2 is None:
            return {"disponivel": False, "motivo": "tarifas da Tarifa Social não publicadas para esta distribuidora na vigência"}
        lim = regras["tarifa_social_limite_kwh"]
        q1 = min(kwh, lim)
        linha(f"Faixa 01, até {lim} kWh", q1, t1)
        linha("Desconto de 100% na faixa 01 (custeado pela CDE)", q1, t1, sinal=-1)
        if kwh > lim:
            linha(f"Faixa 02, acima de {lim} kWh, sem desconto", kwh - lim, t2)
        obs.append("Custo de disponibilidade não aplicado: gratuidade até 80 kWh inclusive em ligação trifásica (ANEEL); acima de 80 kWh a regra do mínimo não foi conferida.")
        fat = kwh
        kwh_bandeira = max(kwh - lim, 0)
        if kwh_bandeira < kwh:
            obs.append("Bandeira aplicada só sobre a parcela acima de 80 kWh (leitura da página oficial da ANEEL).")
    else:
        return {"disponivel": False, "motivo": f"classe desconhecida: {classe}"}
    energia = sum(l["valor"] for l in linhas)
    bandeira = kwh_bandeira * adic / 1000.0
    return {"disponivel": True, "motivo": None, "linhas": linhas, "energia": energia, "bandeira": bandeira,
            "kwh_bandeira": kwh_bandeira, "kwh_faturado": fat, "total": energia + bandeira, "observacoes": obs}


def mes_anterior(anomes):
    a, m = int(anomes[:4]), int(anomes[5:7])
    return f"{a - 1}-12" if m == 1 else f"{a}-{m - 1:02d}"


def soma_meses(anomes, n):
    a, m = int(anomes[:4]), int(anomes[5:7]) - 1 + n
    return f"{a + m // 12}-{m % 12 + 1:02d}"


def ipca_entre(indice, mes_ini, mes_fim):
    """Inflação do IPCA entre o índice de mes_ini e o de mes_fim (razão − 1), ou None
    se um dos índices não estiver publicado. Não interpola nem repete mês."""
    a, b = indice.get(mes_ini), indice.get(mes_fim)
    if a is None or b is None or a == 0:
        return None
    return b / a - 1


def fim_do_mes(anomes):
    prox = soma_meses(anomes, 1)
    return (_d(prox + "-01") - timedelta(days=1)).isoformat()


def eventos_tarifa(linha, indice, mudancas=None):
    """Mudanças da tarifa na linha do tempo resolvida: cada início de pedaço com
    anterior contíguo vira evento, com a variação do total, da TE e da TUSD e a
    inflação do IPCA desde o evento anterior (índices do mês anterior a cada data).
    mudancas = {data: incorporação} (mudancas_de_perimetro): o evento nessa data
    compara a tarifa da área antiga com a da área somada e sai marcado."""
    mudancas = mudancas or {}
    out = []
    ult_data = None
    for i, p in enumerate(linha):
        if i == 0:
            ult_data = p["inicio"]
            continue
        ant = linha[i - 1]
        if (_d(ant["fim"]) + timedelta(days=1)).isoformat() != p["inicio"]:
            ult_data = p["inicio"]  # lacuna na fonte: sem "antes" para comparar
            continue
        t0, t1 = total_rs_mwh(ant), total_rs_mwh(p)
        var = (t1 / t0 - 1) if (t0 and t1 is not None) else None
        m0, m1 = mes_anterior(ult_data[:7]), mes_anterior(p["inicio"][:7])
        out.append({
            "data": p["inicio"], "ato": p["ato"], "mesmo_ato": p["ato"] == ant["ato"],
            "total_antes": t0, "total_depois": t1, "variacao": var,
            "te_variacao": (p["te"] / ant["te"] - 1) if ant["te"] and p["te"] is not None else None,
            "tusd_variacao": (p["tusd"] / ant["tusd"] - 1) if ant["tusd"] and p["tusd"] is not None else None,
            "ipca_desde_anterior": ipca_entre(indice, m0, m1), "meses_ipca": [m0, m1],
            "mudanca_perimetro": ({"id": mudancas[p["inicio"]]["id"], "ato": mudancas[p["inicio"]]["ato"],
                                   "incorporadas": list(mudancas[p["inicio"]]["incorporadas"])}
                                  if p["inicio"] in mudancas else None),
        })
        ult_data = p["inicio"]
    return out


def agrega_subsidios(obs_s, mes_ref):
    """Soma anual dos repasses de subsídio por categoria (montante Total) e as
    conferências internas do conjunto. obs_s = {"cnpj|montante|categoria": {"AAAA-MM": valor}}.
    Competências posteriores a mes_ref ficam fora e são contadas: valor homologado
    para mês futuro é previsão, não repasse de competência já ocorrida."""
    anual, anual_total_publicado, por_dist_ano, futuros, meses_ano = {}, {}, {}, 0, {}
    checagem = {"total_vs_categorias": {"comparacoes": 0, "divergem": 0, "maior_diferenca_rs": 0.0, "divergem_por_ano": {}},
                "total_vs_previsao_mais_ajuste": {"comparacoes": 0, "divergem": 0}}
    por_chave = {}
    for serie, refs in obs_s.items():
        cnpj, montante, cat = serie.split("|", 2)
        for mes_, val in refs.items():
            por_chave.setdefault((cnpj, mes_), {}).setdefault(montante, {})[cat] = val
    csv_s = {}
    for (cnpj, mes_), mts in por_chave.items():
        if mes_ > mes_ref:
            futuros += 1
            continue
        ano = mes_[:4]
        meses_ano.setdefault(ano, set()).add(mes_)
        tot = mts.get("Total", {})
        cats = {k: x for k, x in tot.items() if k != "Total" and x is not None}
        if "Total" in tot and cats:
            checagem["total_vs_categorias"]["comparacoes"] += 1
            dif = abs(tot["Total"] - sum(cats.values()))
            if dif > 0.05:
                checagem["total_vs_categorias"]["divergem"] += 1
                dpa = checagem["total_vs_categorias"]["divergem_por_ano"]
                dpa[ano] = dpa.get(ano, 0) + 1
                checagem["total_vs_categorias"]["maior_diferenca_rs"] = max(checagem["total_vs_categorias"]["maior_diferenca_rs"], dif)
        for cat, x in tot.items():
            p_, a_ = mts.get("Previsão", {}).get(cat), mts.get("Ajuste", {}).get(cat)
            if x is not None and p_ is not None and a_ is not None:
                checagem["total_vs_previsao_mais_ajuste"]["comparacoes"] += 1
                if abs(x - (p_ + a_)) > 0.05:
                    checagem["total_vs_previsao_mais_ajuste"]["divergem"] += 1
        for cat, x in cats.items():
            anual.setdefault(cat, {}).setdefault(ano, 0.0)
            anual[cat][ano] += x
            por_dist_ano.setdefault((cnpj, ano), {}).setdefault(cat, 0.0)
            por_dist_ano[(cnpj, ano)][cat] += x
        if tot.get("Total") is not None:
            anual_total_publicado[ano] = anual_total_publicado.get(ano, 0.0) + tot["Total"]
        for montante, catsm in mts.items():
            for cat, x in catsm.items():
                if x is None:
                    continue
                k = (ano, cnpj, cat, montante)
                csv_s.setdefault(k, [0.0, 0])
                csv_s[k][0] += x
                csv_s[k][1] += 1
    return {"anual": anual, "total_publicado": anual_total_publicado, "por_dist_ano": por_dist_ano,
            "futuros": futuros, "meses_ano": meses_ano, "checagem": checagem, "csv": csv_s}


# Grupos de leitura das rubricas do custeio da CDE (classificação do observatório pelo
# nome publicado; cada rubrica continua visível com o nome da fonte).
GRUPOS_CDE = [
    ("tarifa_social", "Despesa", "Tarifa Social (baixa renda)",
     "Rubrica 'Subsídio Baixa Renda': valor do orçamento aprovado da CDE para os descontos da Tarifa Social de Energia "
     "Elétrica, que chegam às famílias beneficiárias como desconto na fatura (dicionário do conjunto)."),
    ("descontos_tarifarios", "Despesa", "Descontos tarifários a categorias de usuários",
     "Demais rubricas 'Subsídio ...' do orçamento aprovado: compensam distribuidoras e transmissoras por descontos "
     "concedidos a categorias (rural, irrigação e aquicultura, água e esgoto, fontes incentivadas, distribuidoras pequenas, "
     "micro e minigeração distribuída). Não são transferências a famílias."),
    ("ccc_luz_para_todos", "Despesa", "CCC e Luz para Todos",
     "Rubricas 'CCC' (Conta de Consumo de Combustíveis) e 'Programa Luz para Todos - PLPT', com o nome publicado."),
    ("outras_despesas", "Despesa", "Outras despesas",
     "Demais rubricas de despesa com o nome publicado pela ANEEL (carvão mineral, subvenções, indenizações, restos a "
     "pagar e outras)."),
    ("quotas_tarifa", "Receita", "Quotas da CDE",
     "Rubricas 'Quotas CDE Uso', 'Quotas CDE Energia' e 'Quotas CDE - GD' do orçamento aprovado: encargo cobrado nas "
     "tarifas, fixado para cobrir o que as demais receitas não cobrem (as componentes com CDE no código aparecem dentro "
     "da TUSD e da TE no conjunto de componentes tarifárias)."),
    ("outras_receitas", "Receita", "Outras receitas",
     "Demais rubricas de receita com o nome publicado (uso de bem público, multas, recursos da União, aportes previstos "
     "em lei, saldo anterior e outras disponibilidades)."),
]


def grupo_cde(tipo, fonte):
    """Grupo de leitura de uma rubrica do custeio da CDE, pelo nome publicado."""
    if tipo == "Receita":
        return "quotas_tarifa" if fonte.startswith("Quotas CDE") else "outras_receitas"
    if fonte == "Subsídio Baixa Renda":
        return "tarifa_social"
    if fonte.startswith("Subsídio "):
        return "descontos_tarifarios"
    if fonte in ("CCC", "Programa Luz para Todos - PLPT"):
        return "ccc_luz_para_todos"
    return "outras_despesas"


def agrega_cde(obs, sem_valor=()):
    """Custeio anual da CDE por rubrica e grupo, com a identidade despesa = receita.

    obs = {"Tipo|Fonte": {"AAAA": valor}}; sem_valor = {(tipo, fonte, ano)} publicados
    sem valor. Soma só o que foi publicado: rubrica sem valor não vira zero, e o ano em
    que alguma rubrica veio vazia fica marcado."""
    anos = sorted({a for refs in obs.values() for a in refs} | {a for _, _, a in sem_valor})
    linhas = []
    for serie in sorted(obs):
        tipo, fonte = serie.split("|", 1)
        linhas.append({"tipo": tipo, "fonte": fonte, "grupo": grupo_cde(tipo, fonte),
                       "valores": {a: obs[serie].get(a) for a in anos}})
    for tipo, fonte, _ in sorted(sem_valor):
        if f"{tipo}|{fonte}" not in obs and not any(l["tipo"] == tipo and l["fonte"] == fonte for l in linhas):
            linhas.append({"tipo": tipo, "fonte": fonte, "grupo": grupo_cde(tipo, fonte), "valores": {a: None for a in anos}})
    totais = []
    for a in anos:
        desp = sum(l["valores"][a] for l in linhas if l["tipo"] == "Despesa" and l["valores"][a] is not None)
        rec = sum(l["valores"][a] for l in linhas if l["tipo"] == "Receita" and l["valores"][a] is not None)
        por_grupo = {g: sum(l["valores"][a] for l in linhas if l["grupo"] == g and l["valores"][a] is not None)
                     for g, _, _, _ in GRUPOS_CDE}
        totais.append({"ano": a, "despesa": desp, "receita": rec, "grupos": por_grupo,
                       "quotas_pct": 100 * por_grupo["quotas_tarifa"] / rec if rec else None,
                       "tarifa_social_pct": 100 * por_grupo["tarifa_social"] / desp if desp else None,
                       "fecha": abs(desp - rec) <= 1.0,
                       "rubricas_sem_valor": sorted(f for t, f, a_ in sem_valor if a_ == a)})
    return {"anos": anos, "linhas": linhas, "totais": totais}


def valor_do_titulo_bilhoes(titulo):
    """(valor em R$, tolerância em R$) lidos de 'R$ 52,7 bilhões' num título oficial: a
    tolerância é meia unidade da última casa publicada (0,05 bilhão para uma casa)."""
    m = re.search(r"R\$ (\d+)(?:,(\d+))? bilhões", titulo)
    if not m:
        return None, None
    casas = len(m.group(2) or "")
    valor = float(f"{m.group(1)}.{m.group(2) or '0'}") * 1e9
    return valor, 0.5 * 10 ** (-casas) * 1e9


def reconcilia_orcamento_cde(totais, referencias=REFERENCIAS_ORCAMENTO_CDE):
    """Despesa anual do arquivo contra o orçamento da CDE divulgado pela ANEEL no título
    da notícia oficial (REFERENCIAS_ORCAMENTO_CDE). Ano sem par no arquivo fica sem
    resultado; nada é interpolado."""
    por_ano = {t["ano"]: t for t in totais}
    out = []
    for ref in referencias:
        pub, tol = valor_do_titulo_bilhoes(ref["titulo"])
        t = por_ano.get(ref["ano"])
        arq = t["despesa"] if t else None
        dif = (arq - pub) if (arq is not None and pub is not None) else None
        out.append({"ano": ref["ano"], "situacao": ref["situacao"], "titulo": ref["titulo"], "url": ref["url"],
                    "publicado_rs": pub, "arquivo_despesa_rs": c.r(arq, 2) if arq is not None else None,
                    "diferenca_rs": c.r(dif, 2) if dif is not None else None, "tolerancia_rs": tol,
                    "confere": (abs(dif) <= tol) if dif is not None else None, "acesso": ACESSO_REFERENCIAS_CDE})
    return out


# ---------------------------------------------------------------------------
# Evidência ("Comprove este número"), no formato do contrato (seção 2)
# ---------------------------------------------------------------------------

REPRODUCAO = "python3 pipeline/energia/executar_modulo.py conta --sem-coleta"


def _vintage_recente(con, ds, recurso_contendo=None):
    """Vintage mais recente de um dataset (dicionários em PDF fora), ou None."""
    vs = [v for v in base.vintages_do_dataset(con, ds)
          if not (v.get("arquivo") or "").endswith(".pdf.gz") and (recurso_contendo is None or recurso_contendo in v["recurso"])]
    return max(vs, key=lambda x: x["capturado_em"]) if vs else None


def _fonte_ev(con, ds, orgao, conjunto, url, recurso_contendo=None):
    return ev.fonte_de_vintage(orgao, conjunto, url, _vintage_recente(con, ds, recurso_contendo))


def _fonte_ev_varios(orgao, conjunto, url, vintages):
    """Bloco fonte de um número que usa mais de um arquivo (tarifas e IPCA, por exemplo):
    o primeiro é o principal; todos aparecem em `arquivos` com sha256 e captura."""
    vs = [v for v in vintages if v]
    f = ev.fonte_de_vintage(orgao, conjunto, url, vs[0] if vs else None)
    if len(vs) > 1:
        f["arquivos"] = [ev.arquivo_de_vintage(v) for v in vs]
    return f


def _vintage_da_observacao(con, ds, serie, ref):
    """Vintage (dict) que trouxe o valor vigente de (série, ref): o arquivo exato do número."""
    row = con.execute(
        """SELECT o.vintage_id FROM observacoes o JOIN vintages v ON v.vintage_id=o.vintage_id
           WHERE o.dataset=? AND o.serie=? AND o.ref=? ORDER BY v.capturado_em DESC, o.rowid DESC LIMIT 1""",
        (ds, serie, ref)).fetchone()
    if not row:
        return None
    for v in base.vintages_do_dataset(con, ds):
        if v["vintage_id"] == row[0]:
            return v
    return None


def _veredito(ok, parcial=False):
    """aprovado | ressalva | reprovado, no vocabulário do contrato de evidência."""
    return "aprovado" if ok else ("ressalva" if parcial else "reprovado")


def _conta_por(itens, campos):
    out = {}
    for x in itens:
        k = tuple(x[f] for f in campos)
        out[k] = out.get(k, 0) + 1
    return out


def _br(v, casas=2):
    if v is None:
        return None
    s = f"{v:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------------------
# Gold
# ---------------------------------------------------------------------------

def _fonte_prov(orgao, conjunto, recurso, url_dataset, url_primaria, licenca):
    return {"orgao": orgao, "dataset": conjunto, "recurso": recurso, "url_dataset": url_dataset,
            "url_primaria": url_primaria, "licenca": licenca}


def _snapshot_composto(*snaps):
    """Snapshot de um número que usa vários conjuntos: sha256 dos sha256 de cada um, em
    ordem, e todas as capturas (para a data de publicação e as revisões)."""
    import hashlib
    validos = [x for x in snaps if x and x.get("sha256")]
    if not validos:
        return {"id": None, "sha256": None, "capturas": []}
    return {"id": " + ".join(x["id"] for x in validos),
            "sha256": hashlib.sha256("".join(x["sha256"] for x in validos).encode()).hexdigest(),
            "revisoes": validos[0].get("revisoes"), "publicacao_confiavel": all(x.get("publicacao_confiavel", True) for x in validos),
            "capturas": [cp for x in validos for cp in x.get("capturas", [])]}


def _siglas(con):
    """{cnpj: sigla mais recente} e {cnpj: [siglas]} a partir do registro das tarifas."""
    reg = base.registros_como_estavam_em(con, DS_TARIFAS)
    mais_recente, todas = {}, {}
    for ch, campos in reg.items():
        if not ch.startswith("agente|"):
            continue
        cnpj = ch.split("|", 1)[1]
        pares = sorted((k.split("|", 1)[1], v) for k, v in campos.items() if k.startswith("sigla|"))
        if pares:
            mais_recente[cnpj] = pares[-1][1]
            todas[cnpj] = sorted({v for _, v in pares})
    datas_ato = {ch.split("|", 1)[1]: campos.get("data") for ch, campos in reg.items() if ch.startswith("ato|")}
    textos_ato = {ch.split("|", 1)[1]: campos.get("texto") for ch, campos in reg.items() if ch.startswith("ato|")}
    vs = [v for v in base.vintages_do_dataset(con, DS_TARIFAS) if not (v.get("arquivo") or "").endswith(".pdf.gz")]
    ult = max(vs, key=lambda v: v["capturado_em"])["vintage_id"] if vs else None
    universo = {k: int(v) for k, v in reg.get(f"__universo__|{ult}", {}).items() if v.isdigit()}
    gerado = (reg.get("__arquivo__") or {}).get("gerado_em")
    return mais_recente, todas, datas_ato, textos_ato, universo, gerado


def _normas_status(con, lista=None):
    reg = base.registros_como_estavam_em(con, DS_NORMAS)
    out = []
    for n in (NORMAS if lista is None else lista):
        campos = reg.get(f"norma|{n['id']}", {})
        trechos = [{"trecho": t, "presente": campos.get(f"trecho|{i}") == "presente"} for i, t in enumerate(n["trechos"])]
        conferido = campos.get("conferido_em")
        out.append({"id": n["id"], "orgao": n["orgao"], "titulo": n["titulo"], "url": n["url"], "licenca": n["licenca"],
                    "conferido_em": conferido, "sha256": campos.get("sha256"),
                    "estado": ("CONFERIDA" if conferido and all(t["presente"] for t in trechos)
                               else "NAO_RECONFERIDA" if conferido else "NAO_CAPTURADA"),
                    "trechos": trechos})
    return out


def valida_gold(g):
    """Limites físicos e de domínio antes de publicar (contrato, seção 5.2). Devolve
    (críticas, ressalvas, regras). Crítica vira stub (a sentinela mantém a última gold
    válida); ressalva vai para a gold, visível. Valor atípico não é descartado: fica
    como ressalva, e cada caso é conferido no arquivo original (documento, seção 4)."""
    criticas, ressalvas = [], []
    regras = ["CNPJ único no ranking (crítica)", "TE + TUSD positiva no ranking (crítica)",
              "TE e TUSD não negativas (ressalva)", "tarifa fora de 200 a 3000 R$/MWh (ressalva, conferir no arquivo)",
              "data de referência não posterior à geração (crítica)", "adicional de bandeira não negativo (crítica)",
              "número-índice do IPCA positivo (crítica)", "participações da composição entre -100% e 200% (ressalva)",
              "grupo de custo da composição (energia, transmissão, distribuição, perdas, encargos) com soma negativa (ressalva)",
              "parcela CDE maior que o grupo de encargos que a contém (ressalva)",
              (f"componente com sinal contrário à natureza do grupo de custo ou com módulo mais de {ATIPICO_FATOR_MEDIANA:g} vezes "
               f"a mediana da mesma componente, com pelo menos {ATIPICO_PCT_TARIFA:g}% da tarifa (ressalva, conferida no arquivo original)"),
              "valor negativo de componente de custo reclassificado como crédito (ressalva, com a lista)",
              "incorporação registrada que não se confirma nos dados de tarifa (ressalva)",
              "custeio da CDE com despesa igual à receita no ano (ressalva)"]
    vig = g["tarifas"]["vigentes"]
    cnpjs = [v["cnpj"] for v in vig]
    if len(set(cnpjs)) != len(cnpjs):
        criticas.append("CNPJ repetido no ranking de tarifas vigentes")
    for v in vig:
        if v["total"] is None or v["total"] <= 0:
            criticas.append(f"{v['sigla']}: TE + TUSD não positiva ({v['total']})")
        if (v["te"] is not None and v["te"] < 0) or (v["tusd"] is not None and v["tusd"] < 0):
            ressalvas.append(f"{v['sigla']}: parcela negativa publicada (TE {v['te']}, TUSD {v['tusd']})")
        if v["total"] is not None and not (200 <= v["total"] <= 3000):
            ressalvas.append(f"{v['sigla']}: tarifa atípica de {v['total']} R$/MWh, mantida (conferir no arquivo original)")
    # a data de referência é civil de Brasília; a geração é UTC e pode estar um dia à frente, nunca atrás
    if g["data_referencia"] > g["gerado_em"][:10]:
        criticas.append(f"data de referência {g['data_referencia']} posterior à geração {g['gerado_em']}")
    for p in g["bandeiras"]["patamares"]:
        if p["rs_mwh"] is not None and p["rs_mwh"] < 0:
            criticas.append(f"adicional negativo na bandeira {p['bandeira']}")
    comp = g["reajustes"]["comparacao_inflacao"]
    if comp and comp["conferencia_ipca_12m"]["calculado_pct"] is not None and comp["conferencia_ipca_12m"]["calculado_pct"] <= -100:
        criticas.append("IPCA de 12 meses igual ou abaixo de -100%: número-índice não positivo")
    for x in g["composicao"]["distribuidoras"]:
        fora = [k for k, v in x["pct"].items() if v is not None and not (-100 <= v <= 200)]
        if fora:
            ressalvas.append(f"{x['sigla']}: participação atípica em {', '.join(fora)}, mantida")
        negativos = [k for k in GRUPOS_DE_CUSTO if x["grupos"].get(k) is not None and x["grupos"][k] < 0]
        if negativos:
            txt = ", ".join(f"{k} {x['grupos'][k]}" for k in negativos)
            ressalvas.append(f"{x['sigla']}: grupo de custo com soma negativa ({txt})")
        if x.get("cde") is not None and x["grupos"].get("encargos") is not None and x["cde"] > x["grupos"]["encargos"] + 0.01:
            ressalvas.append(f"{x['sigla']}: parcela CDE ({x['cde']}) maior que o grupo de encargos ({x['grupos']['encargos']}), que a contém")
    for a in g["composicao"].get("componentes_atipicas", []):
        ressalvas.append(f"{a['sigla']}: componente {a['codigo']} de {a['valor']} R$/MWh ({a['pct_tarifa']}% da tarifa), "
                         f"{'; '.join(a['criterios'])}; {a['tratamento']}")
    cred = g["composicao"].get("creditos") or {}
    if cred.get("distribuidoras"):
        lista = ", ".join(f"{x['sigla']} {x['valor']}" for x in cred["distribuidoras"])
        ressalvas.append(f"{len(cred['distribuidoras'])} distribuidoras com valor negativo em componente de custo lido como crédito "
                         f"tarifário (grupo créditos, fora dos encargos), em R$/MWh: {lista}")
    for inc in g.get("incorporacoes", []):
        # sem nenhum dos CNPJs no conjunto não há o que conferir; dado presente e data que
        # não bate é que vira ressalva
        if inc.get("situacao") == "divergente":
            ressalvas.append(f"incorporação {inc['ato']} ({inc['id']}) não se confirma nos dados de tarifa: {inc['fim_das_incorporadas']}")
    fin = g.get("financiamento_cde")
    if fin:
        for t in fin["totais"]:
            if not t["fecha"]:
                ressalvas.append(f"CDE {t['ano']}: despesa ({t['despesa']}) diferente da receita ({t['receita']}) publicadas")
    return criticas, ressalvas, regras


def construir(con, ctx):
    nome = REGISTRO["gold"]
    hoje = ctx.get("hoje")
    if hoje is None or hoje == c.agora_date():
        # o executor passa a data em UTC; vigência de tarifa é data civil de Brasília (entre
        # 21h e 24h o dia UTC já é o seguinte e anteciparia a tarifa de amanhã)
        hoje = data_brasilia()
    dia_ref = hoje.isoformat() if hasattr(hoje, "isoformat") else str(hoje)[:10]
    obs_t = valores_vigentes(con, DS_TARIFAS)
    if not obs_t:
        return c.stub(nome, "tarifas ausentes no silver (aneel_tarifas_aplicacao)")
    snap_t = c.snapshot_de(con, DS_TARIFAS)
    snap_c = c.snapshot_de(con, DS_COMP)
    snap_b = c.snapshot_de(con, DS_BAND)
    snap_s = c.snapshot_de(con, DS_SUBS)
    snap_i = c.snapshot_de(con, DS_IPCA)
    sigla, siglas_hist, datas_ato, textos_ato, universo_t, gerado_fonte = _siglas(con)
    nomes, siglas_subs = {}, {}
    for ch, campos in base.registros_como_estavam_em(con, DS_SUBS).items():
        if ch.startswith("agente|"):
            if campos.get("nome"):
                nomes[ch.split("|", 1)[1]] = campos["nome"]
            if campos.get("sigla"):
                siglas_subs[ch.split("|", 1)[1]] = campos["sigla"]
    # a fonte de tarifas publica 'Não Informado' como sigla de pelo menos uma cooperativa
    # (CNPJ 89435598000155); a sigla do mesmo CNPJ no conjunto de subsídios é usada no
    # lugar, e a troca fica registrada (vínculo por CNPJ, nunca por nome)
    siglas_substituidas = []
    for cn in list(sigla):
        if sigla[cn] in (None, "", "Não Informado") and siglas_subs.get(cn):
            siglas_substituidas.append({"cnpj": cn, "sigla_tarifas": sigla[cn], "sigla_usada": siglas_subs[cn],
                                        "fonte": "Subsídios Tarifários (ANEEL), mesmo CNPJ"})
            sigla[cn] = siglas_subs[cn]
    segs = segmentos_tarifas(obs_t)
    ipca_obs = valores_vigentes(con, DS_IPCA)
    indice = ipca_obs.get("ipca|indice", {})
    var12_pub = ipca_obs.get("ipca|var12m", {})
    normas = _normas_status(con)
    estado_norma = {n["id"]: n["estado"] for n in normas}
    regras_sim, estados_regras = estado_das_regras(REGRAS_TEXTO, estado_norma)

    # ---- linhas do tempo resolvidas por distribuidora e subclasse (tarifa de aplicação)
    linhas, conflitos = {}, []
    for (cnpj, sub, subclasse, bt), ss in segs.items():
        lt, conf = linha_do_tempo(ss, datas_ato)
        linhas[(cnpj, sub, subclasse, bt)] = lt
        for cf in conf:
            conflitos.append({"cnpj": cnpj, "sigla": sigla.get(cnpj), "subgrupo": sub, "subclasse": subclasse,
                              "base": bt, **cf})
    cnpjs = sorted({k[0] for k in segs})
    base.escreve_csv(CSV_CONF, ["cnpj", "sigla", "subgrupo", "subclasse", "base", "de", "ate", "escolhido_inicio",
                                "escolhido_fim", "escolhido_ato", "escolhido_te", "escolhido_tusd", "alternativas"],
                     [[cf["cnpj"], cf["sigla"], cf["subgrupo"], cf["subclasse"], cf["base"], cf["dia"], cf["ate"],
                       cf["escolhido"]["inicio"], cf["escolhido"]["fim"], cf["escolhido"]["ato"], cf["escolhido"]["te"],
                       cf["escolhido"]["tusd"],
                       " || ".join(f"{a['inicio']}/{a['fim']}/{a['ato']}/{a['te']}/{a['tusd']}" for a in cf["alternativas"])]
                      for cf in conflitos])

    def lt(cnpj, chave, bt="TA"):
        sub, subclasse = CLASSES_TARIFA[chave]
        return linhas.get((cnpj, sub, subclasse, bt), [])

    # ---- mudanças de perímetro registradas, conferidas nos dados da tarifa B1
    linhas_b1 = {cn: lt(cn, "residencial") for cn in cnpjs}
    incorporacoes = []
    incorporada_por = {}
    for inc in INCORPORACOES:
        conf = confere_incorporacao(inc, linhas_b1)
        incorporacoes.append({**{k: inc[k] for k in ("id", "incorporadora", "incorporadas", "ato", "data_ato",
                                                     "tarifa_unificada_desde", "descricao", "identificacao")},
                              "sigla_incorporadora": sigla.get(inc["incorporadora"]),
                              "siglas_incorporadas": [sigla.get(cn) for cn in inc["incorporadas"]], **conf})
        for cn in inc["incorporadas"]:
            incorporada_por[cn] = inc

    # ---- P047: tarifa vigente B1 e perfis
    vigentes, sem_vigente = [], []
    for cnpj in cnpjs:
        linha_r = lt(cnpj, "residencial")
        if not linha_r:
            continue
        p = em(linha_r, dia_ref)
        tot = total_rs_mwh(p)
        if p is None or tot is None:
            ult = linha_r[-1]
            dias_sem = (_d(dia_ref) - _d(ult["fim"])).days
            if p is not None:
                motivo = "zero publicado nas duas parcelas (tarifa não homologada para a subclasse)"
            elif cnpj in incorporada_por:
                inc = incorporada_por[cnpj]
                motivo = (f"incorporada pela distribuidora de CNPJ {inc['incorporadora']} (sigla atual {sigla.get(inc['incorporadora'])}), "
                          f"{inc['ato']}; a tarifa unificada começa em {c.data_br(inc['tarifa_unificada_desde'])}")
            elif dias_sem <= 90:
                motivo = (f"vigência encerrada em {c.data_br(ult['fim'])}; a tarifa seguinte ainda não consta no arquivo "
                          f"gerado pela ANEEL em {c.data_br(gerado_fonte) if gerado_fonte else 'data não informada'}")
            else:
                motivo = (f"sem tarifa publicada desde {c.data_br(ult['fim'])}; o conjunto não informa o motivo "
                          "(incorporação, extinção ou troca de CNPJ)")
            sem_vigente.append({"cnpj": cnpj, "sigla": sigla.get(cnpj), "nome": nomes.get(cnpj),
                                "ultima_vigencia": {"inicio": ult["inicio"], "fim": ult["fim"], "ato": ult["ato"]},
                                "dias_sem_tarifa": dias_sem, "motivo": motivo,
                                "incorporada_por": incorporada_por[cnpj]["incorporadora"] if cnpj in incorporada_por else None})
            continue
        be = em(lt(cnpj, "residencial", "BE"), dia_ref)
        vigentes.append({
            "cnpj": cnpj, "sigla": sigla.get(cnpj), "nome": nomes.get(cnpj),
            "inicio": p["inicio"], "fim": p["fim"], "ato": p["ato"],
            "te": c.r(p["te"], 2), "tusd": c.r(p["tusd"], 2), "total": c.r(tot, 2),
            "be_te": c.r(be["te"], 2) if be else None, "be_tusd": c.r(be["tusd"], 2) if be else None,
            "be_total": c.r(total_rs_mwh(be), 2) if be else None,
            "perfis": {str(k): c.r(custo_perfil(tot, k), 2) for k in PERFIS_KWH},
        })
    vigentes.sort(key=lambda x: (x["total"], x["sigla"] or ""))
    for i, v in enumerate(vigentes, 1):
        v["posicao"] = i
    totais = [v["total"] for v in vigentes]
    if not totais:
        return c.stub(nome, f"nenhuma tarifa B1 residencial vigente em {dia_ref}")
    resumo = {
        "n": len(totais), "mediana": c.r(c.quantil(totais, 0.5), 2), "p25": c.r(c.quantil(totais, 0.25), 2),
        "p75": c.r(c.quantil(totais, 0.75), 2), "minimo": c.r(min(totais), 2), "maximo": c.r(max(totais), 2),
        "perfis_mediana": {str(k): c.r(custo_perfil(c.quantil(totais, 0.5), k), 2) for k in PERFIS_KWH},
        "ponderacao": "nenhuma: cada distribuidora conta uma vez, independentemente do número de consumidores",
        # fora do ranking: vigência encerrada há até 90 dias com a sucessora ainda não publicada
        # no arquivo (tende a entrar na próxima atualização) e empresas sem tarifa há mais tempo
        "fora_vigencia_recente": sum(1 for x in sem_vigente if x["dias_sem_tarifa"] <= 90),
        "fora_sem_tarifa_ha_mais_de_90_dias": sum(1 for x in sem_vigente if x["dias_sem_tarifa"] > 90),
    }
    base.escreve_csv(CSV_VIGENTES, ["cnpj", "sigla", "nome", "inicio_vigencia", "fim_vigencia", "ato", "te_rs_mwh",
                                    "tusd_rs_mwh", "total_rs_mwh", "total_rs_kwh", "te_base_economica_rs_mwh",
                                    "tusd_base_economica_rs_mwh", "custo_100kwh_rs", "custo_200kwh_rs",
                                    "custo_300kwh_rs", "posicao"],
                     [[v["cnpj"], v["sigla"], v["nome"], v["inicio"], v["fim"], v["ato"], v["te"], v["tusd"], v["total"],
                       c.r(v["total"] / 1000, 5), v["be_te"], v["be_tusd"], v["perfis"]["100"], v["perfis"]["200"],
                       v["perfis"]["300"], v["posicao"]] for v in vigentes])
    hist_linhas = []
    for (cnpj, sub, subclasse, bt), ss in sorted(segs.items()):
        for s in ss:
            hist_linhas.append([cnpj, sigla.get(cnpj), sub, subclasse, bt, s["inicio"], s["fim"], s["ato"], s["te"], s["tusd"]])
    base.escreve_csv(CSV_HIST, ["cnpj", "sigla", "subgrupo", "subclasse", "base", "inicio", "fim", "ato", "te_rs_mwh",
                                "tusd_rs_mwh"], hist_linhas)

    # evolução: mediana entre distribuidoras no dia 1º de cada mês, nominal e em R$ do mês do último IPCA
    ultimo_ipca = max(indice) if indice else None
    # O conjunto começa em fev/2010 com as tarifas homologadas a partir de então: nos
    # primeiros meses só aparecem as distribuidoras que já passaram por processo em
    # 2010, e a mediana desses meses não representa o universo. Regra publicada: a
    # mediana só é calculada nos meses com pelo menos 80% do maior número mensal de
    # distribuidoras com tarifa; nos demais fica vazia e o n continua visível.
    meses_ev, mes = [], min(s["inicio"] for ss in segs.values() for s in ss)[:7]
    while mes <= dia_ref[:7]:
        vals = [total_rs_mwh(em(lt(cn, "residencial"), mes + "-01")) for cn in cnpjs]
        meses_ev.append((mes, [x for x in vals if x is not None]))
        mes = soma_meses(mes, 1)
    n_max = max(len(v_) for _, v_ in meses_ev)
    cobertura_minima = int(-(-0.8 * n_max // 1))  # teto de 80% do maior n mensal
    evolucao = []
    for mes, vals in meses_ev:
        ok = len(vals) >= cobertura_minima
        med = c.quantil(vals, 0.5) if (vals and ok) else None
        fator = (indice[ultimo_ipca] / indice[mes]) if (ultimo_ipca and indice.get(mes)) else None
        # [mês, n, mediana, p25, p75, mediana em R$ do último mês com IPCA]
        evolucao.append([mes, len(vals), c.r(med, 2), c.r(c.quantil(vals, 0.25), 2) if ok else None,
                         c.r(c.quantil(vals, 0.75), 2) if ok else None,
                         c.r(med * fator, 2) if (med is not None and fator) else None])

    # ---- P048: composição (conjunto de componentes)
    obs_c = valores_vigentes(con, DS_COMP)
    comp_idx = {}
    for serie, refs in obs_c.items():
        cnpj, _, _, _, cod = serie.split("|", 4)
        for ref, val in refs.items():
            comp_idx.setdefault(cnpj, {}).setdefault(ref, {})[cod] = val
    composicao, rec_cruzada, comp_csv = [], {"conferidas": 0, "divergentes": [], "sem_componentes": []}, []
    comp_usado, brutos_comp = {}, {}
    # CSV largo (uma linha por distribuidora e vigência, uma coluna por componente): o
    # formato longo passava de 5 MB. Componente não publicada na vigência fica vazia.
    codigos = [cd for _, _, cods in GRUPOS for cd in cods]
    extras = sorted({cd for refs in comp_idx.values() for cc in refs.values() for cd in cc} - set(codigos) - set(TOTAIS_COMP))
    colunas = list(TOTAIS_COMP) + codigos + extras
    for cnpj, refs in sorted(comp_idx.items()):
        for ref, comps in sorted(refs.items()):
            ini, fim, ato_id = ref.split("|", 2)
            comp_csv.append([cnpj, sigla.get(cnpj), ini, fim, ato_id] + [comps.get(cd) for cd in colunas])
    base.escreve_csv(CSV_COMP, ["cnpj", "sigla", "inicio", "fim", "ato"] + colunas, comp_csv)
    for v in vigentes:
        ref = f"{v['inicio']}|{v['fim']}|{v['ato']}"
        refs = comp_idx.get(v["cnpj"], {})
        comps, ref_usado = refs.get(ref), ref
        if comps is None:
            # o pedaço resolvido pode ter fim diferente do registro original (vigências unidas):
            # procura o registro de componentes do mesmo ato que cobre a data de referência
            cand = [(r_, cc) for r_, cc in refs.items()
                    if r_.split("|")[2] == v["ato"] and r_.split("|")[0] <= dia_ref <= r_.split("|")[1]]
            comps, ref_usado = (cand[0][1], cand[0][0]) if len(cand) == 1 else (None, None)
        if comps is None:
            rec_cruzada["sem_componentes"].append(v["sigla"])
            continue
        comp_usado[v["cnpj"]] = (ref_usado, comps)
        grupos, chk = grupos_componentes(comps)
        ok_interno = (chk["te"] is not None and chk["tusd"] is not None
                      and abs(chk["soma_te"] - chk["te"]) <= 0.01 and abs(chk["soma_tusd"] - chk["tusd"]) <= 0.01)
        ok_cruzado = (chk["te"] is not None and chk["tusd"] is not None
                      and abs(chk["te"] - v["te"]) <= 0.005 and abs(chk["tusd"] - v["tusd"]) <= 0.005)
        if ok_cruzado:
            rec_cruzada["conferidas"] += 1
        else:
            rec_cruzada["divergentes"].append({"sigla": v["sigla"], "te_tarifas": v["te"], "te_componentes": chk["te"],
                                               "tusd_tarifas": v["tusd"], "tusd_componentes": chk["tusd"]})
        tot = v["total"]
        cde = parcela_cde(comps)
        brutos_comp[v["cnpj"]] = (grupos, cde, tot)
        composicao.append({
            "cnpj": v["cnpj"], "sigla": v["sigla"], "total": tot,
            "grupos": {g: c.r(x, 2) for g, x in grupos.items()},
            "pct": {g: c.r(100 * x / tot, 1) if tot else None for g, x in grupos.items()},
            # parcela das quotas da CDE dentro da tarifa (subconjunto do grupo encargos, não somar)
            "cde": c.r(cde, 2), "cde_pct": c.r(100 * cde / tot, 1) if (tot and cde is not None) else None,
            "fecha_com_total": ok_interno, "confere_com_tarifas": ok_cruzado, "codigos_sem_grupo": chk["desconhecidos"],
            # valor tirado do grupo do código pelo sinal (crédito lançado em componente de custo)
            "reclassificadas": [{"codigo": r_["codigo"], "valor": c.r(r_["valor"], 2), "grupo_pelo_codigo": r_["grupo_pelo_codigo"],
                                 "grupo_usado": r_["grupo_usado"]} for r_ in chk["reclassificadas"]],
        })
    # componentes atípicas: mediana do módulo de cada código entre as distribuidoras com
    # composição na data (a comparação é com o mesmo código, na mesma data)
    mods_cod = {}
    for cn_, (_ref, cc) in comp_usado.items():
        for cod, val in cc.items():
            if cod not in TOTAIS_COMP and val is not None and abs(val) >= 0.01:
                mods_cod.setdefault(cod, []).append(abs(val))
    mediana_modulo = {cod: c.quantil(xs, 0.5) for cod, xs in mods_cod.items()}
    atipicas = []
    for x in composicao:
        for a in componentes_atipicas(comp_usado[x["cnpj"]][1], x["total"], mediana_modulo):
            reclass = a["grupo_usado"] != a["grupo_pelo_codigo"]
            atipicas.append({"cnpj": x["cnpj"], "sigla": x["sigla"], "codigo": a["codigo"], "valor": c.r(a["valor"], 2),
                             "pct_tarifa": c.r(a["pct_tarifa"], 1), "grupo_pelo_codigo": a["grupo_pelo_codigo"],
                             "grupo_usado": a["grupo_usado"], "mediana_modulo_rs_mwh": c.r(a["mediana_modulo"], 2),
                             "criterios": a["criterios"],
                             "tratamento": (f"reclassificada para o grupo {a['grupo_usado']} (crédito), conferida no arquivo original"
                                            if reclass else "mantida no grupo do código, conferida no arquivo original")})
    creditos_lista = sorted(({"cnpj": x["cnpj"], "sigla": x["sigla"], "codigo": r_["codigo"], "valor": r_["valor"],
                              "pct_tarifa": c.r(100 * r_["valor"] / x["total"], 1) if x["total"] else None,
                              "ato": next((v_["ato"] for v_ in vigentes if v_["cnpj"] == x["cnpj"]), None)}
                             for x in composicao for r_ in x["reclassificadas"]), key=lambda y: (y["valor"], y["sigla"] or ""))
    creditos = {
        "codigos": sorted(RECLASSIFICA_SE_NEGATIVO),
        "regra": "valor negativo em " + ", ".join(sorted(RECLASSIFICA_SE_NEGATIVO)) + " sai do grupo do código e vai para o grupo créditos",
        "leitura": "; ".join(r_["leitura"] for r_ in RECLASSIFICA_SE_NEGATIVO.values()),
        "documento": sorted({r_["documento"] for r_ in RECLASSIFICA_SE_NEGATIVO.values()}),
        "faixa_historica": None, "distribuidoras": creditos_lista,
    }
    # faixa histórica dos códigos reclassificáveis (vigências iniciadas até 2024, todas as
    # distribuidoras): mostra que o valor negativo de agora não tem precedente no código
    for cod in RECLASSIFICA_SE_NEGATIVO:
        hist = [cc[cod] for refs in comp_idx.values() for r_, cc in refs.items() if r_[:4] <= "2024" and cc.get(cod) is not None]
        if hist:
            creditos["faixa_historica"] = {"codigo": cod, "vigencias_iniciadas_ate": "2024-12-31", "n": len(hist),
                                           "minimo": c.r(min(hist), 2), "maximo": c.r(max(hist), 2)}
    comp_med = {}
    for g, _, _ in GRUPOS:
        xs = [x["grupos"][g] for x in composicao if x["grupos"][g] is not None]
        comp_med[g] = c.r(c.quantil(xs, 0.5), 2) if xs else None
    # Cada grupo tem a sua própria mediana, e a soma das medianas não é a tarifa mediana.
    # A composição que fecha com o total é a média simples entre distribuidoras (cada uma
    # pesa igual): os grupos médios somam a tarifa média, e a participação de cada grupo é
    # a razão de somas Σ grupo ÷ Σ tarifa (nunca a mediana de percentuais).
    tot_brutos = [t_ for (_g, _c, t_) in brutos_comp.values()]
    soma_tot = sum(tot_brutos)
    n_comp = len(brutos_comp)
    media_comp = None
    if n_comp:
        soma_g = {g: sum(gr[g] for (gr, _c, _t) in brutos_comp.values()) for g, _, _ in GRUPOS}
        soma_cde = sum(cd for (_g, cd, _t) in brutos_comp.values() if cd is not None)
        media_comp = {
            "n": n_comp, "total_rs_mwh": c.r(soma_tot / n_comp, 2),
            "grupos_rs_mwh": {g: c.r(x / n_comp, 2) for g, x in soma_g.items()},
            "grupos_pct": {g: c.r(100 * x / soma_tot, 2) for g, x in soma_g.items()},
            "cde_rs_mwh": c.r(soma_cde / n_comp, 2), "cde_pct": c.r(100 * soma_cde / soma_tot, 2),
            "soma_grupos_menos_total_rs_mwh": c.r(sum(soma_g.values()) / n_comp - soma_tot / n_comp, 4),
            "definicao": ("média simples entre as distribuidoras com composição na data (cada uma pesa igual, sem ponderação "
                          "por consumo); os grupos médios somam a tarifa média, e a participação é a razão de somas "
                          "Σ grupo ÷ Σ (TE + TUSD)"),
        }
    mediana_resumo = {
        "grupos_rs_mwh": comp_med,
        "soma_das_medianas_rs_mwh": c.r(sum(x for x in comp_med.values() if x is not None), 2),
        "mediana_do_total_rs_mwh": c.r(c.quantil(tot_brutos, 0.5), 2) if tot_brutos else None,
        "fecha_com_total": False,
        "nota": ("Cada grupo tem a sua mediana entre distribuidoras, e a soma das medianas não é a tarifa mediana: use as "
                 "medianas só grupo a grupo. A composição que fecha com o total é a média simples (composicao.media)."),
    }
    # repetições da mesma componente, vigência e ato dentro dos arquivos anuais (contadas na ingestão)
    reg_comp = base.registros_como_estavam_em(con, DS_COMP)
    duplicatas_comp = {"iguais": 0, "conflitantes": 0, "arquivos_com_conflito": []}
    for rec_nome, vv in sorted(ckan.vintages_vigentes(con, DS_COMP).items()):
        uni = reg_comp.get(f"__universo__|{vv['vintage_id']}", {})
        duplicatas_comp["iguais"] += int(uni.get("duplicatas_iguais", 0) or 0)
        n_conf = int(uni.get("duplicatas_conflitantes", 0) or 0)
        duplicatas_comp["conflitantes"] += n_conf
        if n_conf:
            duplicatas_comp["arquivos_com_conflito"].append({"arquivo": rec_nome, "n": n_conf})
    duplicatas_comp["regra"] = "valor igual repetido é ignorado; valor diferente para a mesma componente, vigência e ato: vale a última linha do arquivo, e o caso fica contado"
    xs_cde = [x["cde"] for x in composicao if x["cde"] is not None]
    xs_cde_pct = [x["cde_pct"] for x in composicao if x["cde_pct"] is not None]
    cde_resumo = {"mediana_rs_mwh": c.r(c.quantil(xs_cde, 0.5), 2) if xs_cde else None,
                  "mediana_pct": c.r(c.quantil(xs_cde_pct, 0.5), 1) if xs_cde_pct else None,
                  "media_rs_mwh": media_comp["cde_rs_mwh"] if media_comp else None,
                  "razao_de_somas_pct": media_comp["cde_pct"] if media_comp else None,
                  "n": len(xs_cde), "codigos": list(CODIGOS_CDE),
                  "nota": ("Soma das componentes com CDE no código publicadas pela ANEEL dentro da TE e da TUSD. É parte do "
                           "grupo de encargos, não um item a mais. A finalidade de cada código (quota anual, CDE Covid, CDE GD, "
                           "CDE Eletrobras) está no PRORET, que não pôde ser lido; por isso a soma aparece como componentes CDE "
                           "da tarifa, sem atribuição a programa específico. mediana_rs_mwh e mediana_pct são medianas separadas "
                           "(a mediana dos percentuais não é a mediana em R$/MWh dividida pela tarifa mediana); a participação "
                           "comparável à composição média é razao_de_somas_pct.")}

    # ---- P049: simulador
    band_obs = valores_vigentes(con, DS_BAND)
    band_reg = base.registros_como_estavam_em(con, DS_BAND)
    acion = sorted(((m, band_reg.get(f"acionamento|{m}", {}).get("bandeira"), val)
                    for m, val in band_obs.get("acionamento|valor", {}).items()), key=lambda x: x[0])
    adicionais = {}
    for serie, refs in band_obs.items():
        if serie.startswith("adicional|"):
            nomeb = serie.split("|", 1)[1]
            for vig, val in refs.items():
                adicionais.setdefault(vig, {})[nomeb] = val
    tabela_adic = []
    for vig in sorted(adicionais):
        res = next((band_reg.get(f"adicional|{vig}|{b}", {}).get("resolucao") for b in adicionais[vig]), None)
        tabela_adic.append({"vigencia": vig, "resolucao": res, "valores": {b: c.r(x, 2) for b, x in sorted(adicionais[vig].items())}})

    def adicional_em(nomeb, dia):
        cand = [(vig, adicionais[vig][nomeb]) for vig in sorted(adicionais) if vig <= dia and nomeb in adicionais[vig]]
        return cand[-1] if cand else (None, None)

    patamares = []
    for nomeb in ("Verde", "Amarela", "Vermelha P1", "Vermelha P2"):
        vig, val = adicional_em(nomeb, dia_ref)
        if nomeb == "Verde":
            vig, val = None, 0.0  # verde: sem acréscimo (ANEEL); a tabela de adicionais não lista a verde
        patamares.append({"bandeira": nomeb, "rs_mwh": c.r(val, 2), "rs_kwh": c.r(val / 1000, 5) if val is not None else None,
                          "vigencia_tabela": vig})
    band_vigente = None
    if acion:
        m, b, val = acion[-1]
        band_vigente = {"mes": m, "bandeira": b, "rs_mwh": c.r(val, 2),
                        "aviso": (None if m >= dia_ref[:7] else
                                  f"O conjunto traz acionamentos até {c.mes_br(m)}; o mês de referência ({c.mes_br(dia_ref[:7])}) ainda não consta.")}
    band_csv, band_confere = [], {"meses": 0, "conferem": 0, "divergem": []}
    for m, b, val in acion:
        tab = 0.0 if b == "Verde" else adicional_em(b, m + "-01")[1] if b else None
        ok = None if tab is None or val is None else abs(tab - val) <= 0.005
        band_confere["meses"] += 1
        if ok:
            band_confere["conferem"] += 1
        else:
            band_confere["divergem"].append({"mes": m, "bandeira": b, "acionamento": val, "tabela": tab})
        band_csv.append([m, b, val, tab, "" if ok is None else ("sim" if ok else "nao")])
    base.escreve_csv(CSV_BAND, ["mes", "bandeira", "adicional_rs_mwh", "adicional_tabela_rs_mwh", "confere"], band_csv)
    sem_par = [x for x in band_confere["divergem"] if x["tabela"] is None]
    diverge = [x for x in band_confere["divergem"] if x["tabela"] is not None]
    contagem_ano = {}
    for m, b, _ in acion:
        contagem_ano.setdefault(m[:4], {}).setdefault(b or "sem nome", 0)
        contagem_ano[m[:4]][b or "sem nome"] += 1

    sim_dist = []
    for v in vigentes:
        tarifas = {}
        for chave in CLASSES_TARIFA:
            p = em(lt(v["cnpj"], chave), dia_ref)
            tarifas[chave] = [c.r(p["te"], 2), c.r(p["tusd"], 2)] if p else None
        sim_dist.append({"cnpj": v["cnpj"], "sigla": v["sigla"], "inicio": v["inicio"], "ato": v["ato"], "tarifas": tarifas})
    cobertura_classes = {ch: sum(1 for x in sim_dist if x["tarifas"].get(ch) and _tarifa({ch: tuple(x["tarifas"][ch])}, ch) is not None)
                         for ch in CLASSES_TARIFA}
    # casos de referência: distribuidora na mediana da tarifa B1, todas as classes, consumos e ligações
    alvo = min(vigentes, key=lambda x: (abs(x["total"] - resumo["mediana"]), x["sigla"] or ""))
    t_alvo = {k: tuple(x) for k, x in next(s for s in sim_dist if s["cnpj"] == alvo["cnpj"])["tarifas"].items() if x}
    adic_ref = {p["bandeira"]: p["rs_mwh"] for p in patamares}
    casos = []
    for cl in CLASSES_SIMULADOR:
        for kwh in (0, 25, 80, 150, 300):
            for lig in ("monofasico", "trifasico"):
                for bnome in ("Verde", "Amarela"):
                    r_ = simular(t_alvo, cl["id"], kwh, lig, adic_ref.get(bnome) or 0.0)
                    # [classe, kWh, ligação, bandeira, total, parcela da bandeira]; null = indisponível
                    casos.append([cl["id"], kwh, lig, bnome,
                                  c.r(r_["total"], 2) if r_["disponivel"] else None,
                                  c.r(r_.get("bandeira"), 2) if r_["disponivel"] else None])

    # ---- P050: reajustes e inflação
    reaj_csv, historico_json, ultimos = [], {}, []
    cnpjs_vigentes = {v["cnpj"] for v in vigentes}
    for cnpj in cnpjs:
        evs = eventos_tarifa(lt(cnpj, "residencial"), indice, mudancas_de_perimetro(cnpj))
        for e in evs:
            reaj_csv.append([cnpj, sigla.get(cnpj), e["data"], e["ato"], "sim" if e["mesmo_ato"] else "nao",
                             c.r(e["total_antes"], 2), c.r(e["total_depois"], 2),
                             c.r(100 * e["variacao"], 2) if e["variacao"] is not None else None,
                             c.r(100 * e["te_variacao"], 2) if e["te_variacao"] is not None else None,
                             c.r(100 * e["tusd_variacao"], 2) if e["tusd_variacao"] is not None else None,
                             c.r(100 * e["ipca_desde_anterior"], 2) if e["ipca_desde_anterior"] is not None else None,
                             f"{e['meses_ipca'][0]} a {e['meses_ipca'][1]}",
                             e["mudanca_perimetro"]["ato"] if e["mudanca_perimetro"] else None])
        pct = lambda x: c.r(100 * x, 2) if x is not None else None  # noqa: E731
        linha_b1 = lt(cnpj, "residencial")
        if linha_b1:
            historico_json[cnpj] = {
                "sigla": sigla.get(cnpj), "nome": nomes.get(cnpj),
                "vigencias": [[p["inicio"], p["fim"], p["ato"], c.r(p["te"], 2), c.r(p["tusd"], 2),
                               c.r(total_rs_mwh(p), 2)] for p in linha_b1],
                "eventos": [[e["data"], e["ato"], e["mesmo_ato"], c.r(e["total_antes"], 2), c.r(e["total_depois"], 2),
                             pct(e["variacao"]), pct(e["te_variacao"]), pct(e["tusd_variacao"]),
                             pct(e["ipca_desde_anterior"]), e["meses_ipca"][0], e["meses_ipca"][1],
                             e["mudanca_perimetro"]["ato"] if e["mudanca_perimetro"] else None] for e in evs],
                # incorporações em que este CNPJ é o incorporador (a série muda de área na data)
                "incorporacoes": [{"data": i_["tarifa_unificada_desde"], "ato": i_["ato"], "incorporadas": i_["incorporadas"]}
                                  for i_ in INCORPORACOES if i_["incorporadora"] == cnpj],
                "incorporada_por": ({"cnpj": incorporada_por[cnpj]["incorporadora"], "ato": incorporada_por[cnpj]["ato"],
                                     "data": incorporada_por[cnpj]["tarifa_unificada_desde"]} if cnpj in incorporada_por else None),
            }
        if evs and cnpj in cnpjs_vigentes:
            e = evs[-1]
            # último evento da tarifa B1 de cada distribuidora do ranking (lista completa no JSON e no CSV)
            ultimos.append([cnpj, sigla.get(cnpj), e["data"], e["ato"], pct(e["variacao"]), pct(e["ipca_desde_anterior"]),
                            e["meses_ipca"][0], e["meses_ipca"][1],
                            e["mudanca_perimetro"]["ato"] if e["mudanca_perimetro"] else None])
    ultimos.sort(key=lambda x: (x[2], x[1] or ""), reverse=True)
    texto_hist = json.dumps({"gerado_em": base.agora_utc(), "data_referencia": dia_ref, "unidade": "R$/MWh e %",
                             "distribuidoras": historico_json}, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    base._escreve_atomico(os.path.join(base.SERIES, JSON_HIST), texto_hist)
    base.escreve_csv(CSV_REAJ, ["cnpj", "sigla", "data", "ato", "mesmo_ato", "total_antes_rs_mwh", "total_depois_rs_mwh",
                                "variacao_pct", "te_variacao_pct", "tusd_variacao_pct",
                                "ipca_desde_evento_anterior_pct", "meses_ipca", "mudanca_perimetro"], reaj_csv)
    comparacao = None
    jan_csv, jan_brutas = [], {}
    if ultimo_ipca:
        d_fim = fim_do_mes(ultimo_ipca)
        janelas = []
        for n in JANELAS_MESES:
            m0 = soma_meses(ultimo_ipca, -n)
            d_ini = fim_do_mes(m0)
            ip = ipca_entre(indice, m0, ultimo_ipca)
            brutas, excl, excl_perimetro = [], 0, []
            for cnpj in cnpjs:
                p1, p0 = em(lt(cnpj, "residencial"), d_fim), em(lt(cnpj, "residencial"), d_ini)
                t1, t0 = total_rs_mwh(p1), total_rs_mwh(p0)
                if t0 is None or t1 is None:
                    excl += 1 if (t0 is not None or t1 is not None) else 0
                    continue
                cruza = atravessa_perimetro(cnpj, d_ini, d_fim)
                if cruza:
                    # tarifa da área antiga contra a da área somada: não é reajuste dos mesmos consumidores
                    excl_perimetro.append({"cnpj": cnpj, "sigla": sigla.get(cnpj), "ato": cruza[0]["ato"],
                                           "data": cruza[0]["tarifa_unificada_desde"],
                                           "variacao_pct_nao_comparavel": c.r(100 * (t1 / t0 - 1), 2)})
                    continue
                var = t1 / t0 - 1
                real = (1 + var) / (1 + ip) - 1 if ip is not None else None
                brutas.append((cnpj, var, real, t0, t1, p0, p1))
                jan_csv.append([n, d_ini, d_fim, cnpj, sigla.get(cnpj), p0["ato"], c.r(t0, 2), p1["ato"], c.r(t1, 2),
                                c.r(100 * var, 4), c.r(100 * ip, 4) if ip is not None else None,
                                c.r(100 * real, 4) if real is not None else None])
            jan_brutas[n] = brutas
            vs_ = [b[1] for b in brutas]
            janelas.append({
                "meses": n, "de": d_ini, "ate": d_fim, "ipca_pct": c.r(100 * ip, 2) if ip is not None else None,
                "ipca_meses": [m0, ultimo_ipca], "n": len(brutas), "excluidas_sem_tarifa_nas_duas_datas": excl,
                "excluidas_mudanca_perimetro": excl_perimetro,
                "mediana_pct": c.r(100 * c.quantil(vs_, 0.5), 2) if vs_ else None,
                "p25_pct": c.r(100 * c.quantil(vs_, 0.25), 2) if vs_ else None,
                "p75_pct": c.r(100 * c.quantil(vs_, 0.75), 2) if vs_ else None,
                # comparação com valores não arredondados
                "acima_ipca": sum(1 for b in brutas if ip is not None and b[1] > ip),
                "abaixo_ou_igual_ipca": sum(1 for b in brutas if ip is not None and b[1] <= ip),
                # [cnpj, sigla, variação %, variação real %], em ordem crescente de variação
                "distribuidoras": [[b[0], sigla.get(b[0]), c.r(100 * b[1], 2), c.r(100 * b[2], 2) if b[2] is not None else None]
                                   for b in sorted(brutas, key=lambda b: (b[1], sigla.get(b[0]) or ""))],
            })
        # conferência do IPCA por caminho independente: 12 meses pela razão de índices
        # contra a variação acumulada publicada pelo IBGE (variável 2265)
        calc12 = ipca_entre(indice, soma_meses(ultimo_ipca, -12), ultimo_ipca)
        pub12 = var12_pub.get(ultimo_ipca)
        comparacao = {"referencia": d_fim, "ultimo_ipca": ultimo_ipca, "janelas": janelas,
                      "conferencia_ipca_12m": {"mes": ultimo_ipca, "calculado_pct": c.r(100 * calc12, 4) if calc12 is not None else None,
                                               "publicado_pct": pub12,
                                               "confere": (calc12 is not None and pub12 is not None and abs(100 * calc12 - pub12) <= 0.01),
                                               "tolerancia_pp": 0.01,
                                               "justificativa": "o IBGE publica a variação com duas casas decimais; a razão de índices de duas casas pode diferir no arredondamento"}}
    base.escreve_csv(CSV_JAN, ["janela_meses", "de", "ate", "cnpj", "sigla", "ato_de", "tarifa_de_rs_mwh", "ato_ate",
                               "tarifa_ate_rs_mwh", "variacao_pct", "ipca_pct", "variacao_real_pct"], jan_csv)
    base.escreve_csv(CSV_IPCA, ["mes", "indice", "variacao_12m_pct_publicada"],
                     [[m, indice[m], var12_pub.get(m)] for m in sorted(indice)])

    # ---- P050: subsídios tarifários
    obs_s = valores_vigentes(con, DS_SUBS)
    mes_ref = dia_ref[:7]
    ag = agrega_subsidios(obs_s, mes_ref)
    anual, anual_total_publicado, por_dist_ano = ag["anual"], ag["total_publicado"], ag["por_dist_ano"]
    futuros, meses_ano, checagem, csv_s = ag["futuros"], ag["meses_ano"], ag["checagem"], ag["csv"]
    vs_s = [v for v in base.vintages_do_dataset(con, DS_SUBS) if not (v.get("arquivo") or "").endswith(".pdf.gz")]
    if vs_s:
        uni_s = base.registros_como_estavam_em(con, DS_SUBS).get(
            f"__universo__|{max(vs_s, key=lambda v: v['capturado_em'])['vintage_id']}", {})
        if "total_vs_previsao_mais_ajuste_comparacoes" in uni_s:
            checagem["total_vs_previsao_mais_ajuste"] = {
                "comparacoes": int(uni_s["total_vs_previsao_mais_ajuste_comparacoes"]),
                "divergem": int(uni_s.get("total_vs_previsao_mais_ajuste_divergem", 0)),
                "nota": "conferido na ingestão, com todas as competências do arquivo; o silver guarda só o montante Total"}
    base.escreve_csv(CSV_SUBS, COLUNAS_CSV_SUBS, linhas_csv_subsidios(csv_s, sigla))
    anos = sorted({a for cat in anual.values() for a in cat})
    subsidios_anual = []
    for a in anos:
        linha_a = {"ano": a, "meses": len(meses_ano.get(a, ())),
                   "parcial": len(meses_ano.get(a, ())) < 12,
                   "categorias": {cat: c.r(anual[cat].get(a), 0) for cat in sorted(anual)},
                   "soma_categorias": c.r(sum(anual[cat].get(a, 0.0) for cat in anual), 0),
                   "total_publicado": c.r(anual_total_publicado.get(a), 0)}
        subsidios_anual.append(linha_a)
    completos = [x for x in subsidios_anual if not x["parcial"]]
    ultimo_completo = completos[-1]["ano"] if completos else None
    top_dist = []
    if ultimo_completo:
        for (cn, a), cats in por_dist_ano.items():
            if a == ultimo_completo:
                top_dist.append({"cnpj": cn, "sigla": sigla.get(cn), "nome": nomes.get(cn),
                                 "total": c.r(sum(cats.values()), 0)})
        top_dist.sort(key=lambda x: -(x["total"] or 0))

    # ---- P050: quem financia os benefícios (custeio anual da CDE)
    obs_cde = valores_vigentes(con, DS_CDE)
    reg_cde = base.registros_como_estavam_em(con, DS_CDE)
    sem_valor_cde = set()
    for ch, campos in reg_cde.items():
        if ch.startswith("rubrica|"):
            _, tipo_r, fonte_r = ch.split("|", 2)
            for k, v_ in campos.items():
                if k.startswith("ano|") and v_ == "vazio":
                    sem_valor_cde.add((tipo_r, fonte_r, k.split("|", 1)[1]))
    cde = agrega_cde(obs_cde, sem_valor_cde) if (obs_cde or sem_valor_cde) else None
    financiamento = None
    if cde and cde["anos"]:
        anos_cde = cde["anos"]
        base.escreve_csv(CSV_CDE, ["ano", "tipo", "fonte", "grupo", "valor_rs"],
                         [[a, l["tipo"], l["fonte"], l["grupo"], l["valores"][a]] for a in anos_cde for l in cde["linhas"]
                          if l["valores"][a] is not None or (l["tipo"], l["fonte"], a) in sem_valor_cde])
        ult = cde["totais"][-1]
        financiamento = {
            "anos": anos_cde,
            "ultimo_ano": ult["ano"],
            "grupos": [{"id": g, "tipo": t, "rotulo": r_, "definicao": d_} for g, t, r_, d_ in GRUPOS_CDE],
            # valores em R$ nominais alinhados com `anos`; null = sem valor publicado no ano
            "rubricas": [{"tipo": l["tipo"], "fonte": l["fonte"], "grupo": l["grupo"],
                          "valores": [c.r(l["valores"][a], 0) for a in anos_cde]} for l in cde["linhas"]],
            "totais": [{"ano": x["ano"], "despesa": c.r(x["despesa"], 0), "receita": c.r(x["receita"], 0),
                        "grupos": {g: c.r(v_, 0) for g, v_ in x["grupos"].items()},
                        "quotas_pct": c.r(x["quotas_pct"], 1), "tarifa_social_pct": c.r(x["tarifa_social_pct"], 1),
                        "fecha": x["fecha"], "rubricas_sem_valor": x["rubricas_sem_valor"]} for x in cde["totais"]],
            "natureza_valores": "orçamento anual aprovado ou previsto pela ANEEL (não é execução)",
            "nota": ("Orçamento anual da CDE por rubrica, como publicado pela ANEEL: valores aprovados ou previstos, não o que "
                     "foi efetivamente gasto. A despesa é igual à receita em todos os anos porque a quota anual é fixada para "
                     "cobrir a diferença entre a necessidade de recursos da conta e as demais fontes (página Gestão de Recursos "
                     "Tarifários da ANEEL), e os totais conferem com os orçamentos divulgados pela ANEEL (reconciliacao_externa). "
                     "A Tarifa Social (baixa renda) é custeada aqui e não aparece no conjunto de subsídios tarifários, que trata "
                     "só dos descontos a categorias de usuários."),
            "reconciliacao_externa": reconcilia_orcamento_cde(cde["totais"]),
            "documento": "aneel_gestao_recursos_tarifarios",
            "comparacao_com_subsidios": ("As rubricas de desconto do custeio da CDE e as categorias do conjunto de subsídios "
                                         "tarifários não coincidem em valor: um traz o valor anual da conta por rubrica, o "
                                         "outro os repasses mensais homologados por distribuidora. Os dois não se somam."),
        }

    # ---- tarifa média de fornecimento: não publicada; a alternativa avaliada (SAMP) fica
    # no bronze e a conferência que justifica a exclusão é refeita a partir dela
    tarifa_media = {
        "disponivel": False,
        "motivo": ("Não há base oficial estruturada com receita de fornecimento, energia e tributos que passe na conferência "
                   "de atípicos: o SAMP, avaliado para isso, traz meses isolados com valores declarados com erro de ordem de "
                   "grandeza, e o dicionário não define as linhas de DscDetalheMercado. Sem regra de tratamento validada contra "
                   "fonte independente, a tarifa média e a carga tributária observada não são publicadas."),
        "alternativa_avaliada": None,
    }
    v_samp = _vintage_recente(con, DS_SAMP, RECURSO_SAMP)
    if v_samp:
        try:
            serie_samp, n_samp = fa.samp_residencial_mensal(v_samp["arquivo"])
        except Exception as e:  # arquivo com esquema novo: registrado, sem número inventado
            serie_samp, n_samp = None, None
            tarifa_media["alternativa_avaliada"] = {"erro_leitura": f"{type(e).__name__}: {e}"[:300]}
        if serie_samp is not None:
            atipicos_samp = []
            for (cn, sg, det), meses in sorted(serie_samp.items()):
                if det == "Energia TE (kWh)":
                    continue
                for mes_s, val in sorted(meses.items()):
                    outros = [x for m_, x in meses.items() if m_ != mes_s]
                    med_o = c.quantil(outros, 0.5) if outros else None
                    if med_o and med_o > 0 and val > FATOR_ATIPICO_SAMP * med_o:
                        atipicos_samp.append({"cnpj": cn, "sigla": sg, "linha": det, "mes": mes_s, "valor_rs": c.r(val, 2),
                                              "mediana_outros_meses_rs": c.r(med_o, 2), "razao": c.r(val / med_o, 1)})
            dists = sorted({k[0] for k in serie_samp})
            tarifa_media["alternativa_avaliada"] = {
                "orgao": "ANEEL", "conjunto": "SAMP: Sistema de Acompanhamento de Informações de Mercado para Regulação Econômica",
                "url": URL_SAMP, "recurso": RECURSO_SAMP, "arquivo": v_samp["arquivo"], "sha256": v_samp["sha256"],
                "capturado_em": v_samp["capturado_em"], "publicado_em": v_samp.get("publicado_em"), "linhas_lidas": n_samp,
                "recorte": ("subgrupo B1, modalidade convencional, classe e subclasse residencial, sem detalhe, mercado 'Regular', "
                            "opção de energia cativa; linhas Receita Energia (R$) e ICMS (R$) somadas por distribuidora e mês"),
                "regra_atipico": (f"mês com valor acima de {FATOR_ATIPICO_SAMP:g} vezes a mediana dos outros meses do ano na mesma "
                                  "distribuidora e linha"),
                "distribuidoras_no_recorte": len(dists),
                "distribuidoras_com_mes_atipico": len({a["cnpj"] for a in atipicos_samp}),
                "meses_atipicos": atipicos_samp,
            }

    documentos = _normas_status(con, DOCUMENTOS)
    estado_doc = {d_["id"]: d_["estado"] for d_ in documentos}
    creditos["documento_estado"] = {d_: estado_doc.get(d_) for d_ in creditos["documento"]}
    if financiamento:
        financiamento["documento_estado"] = estado_doc.get(financiamento["documento"])

    # ---- proveniências
    meta_t = ckan.meta_local(DS_TARIFAS)
    meta_c = ckan.meta_local(DS_COMP)
    meta_b = ckan.meta_local(DS_BAND)
    meta_s = ckan.meta_local(DS_SUBS)
    cap = c.ultima_captura
    lim_tarifa = [
        "Tarifa homologada de aplicação sem tributos (ICMS, PIS/Pasep, Cofins), sem contribuição de iluminação pública e sem bandeira: não é a conta final nem a tarifa média de fornecimento.",
        "Perfis de 100, 200 e 300 kWh/mês são referências definidas pelo observatório para comparar distribuidoras; não são consumo médio de nenhuma área.",
        "Distribuidoras contam uma vez cada; a mediana não é ponderada pelo número de consumidores.",
        (f"{len(sem_vigente)} distribuidoras com tarifa no conjunto não têm vigência cobrindo {c.data_br(dia_ref)} e não entram no ranking: "
         f"{sum(1 for x in sem_vigente if x['dias_sem_tarifa'] <= 90)} com vigência encerrada há até 90 dias e a tarifa seguinte ainda fora do arquivo gerado pela ANEEL "
         f"em {c.data_br(gerado_fonte) if gerado_fonte else 'data não informada'}, e {sum(1 for x in sem_vigente if x['dias_sem_tarifa'] > 90)} sem tarifa há mais de 90 dias "
         "(ver sem_vigente). Quando as ausentes são muitas, a mediana da data pode diferir da mediana do dia 1º do mês na evolução."),
        "Quando a fonte publica vigências sobrepostas com valores diferentes, vale a regra publicada em regras.sobreposicao; os casos ficam em conflitos_fonte.",
    ]
    fonte_t = _fonte_prov("ANEEL", meta_t.get("titulo") or "Tarifas de aplicação das distribuidoras de energia elétrica",
                          "tarifas-homologadas-distribuidoras-energia-eletrica.csv", URL_TARIFAS,
                          next((r["url"] for r in meta_t.get("recursos", []) if (r.get("formato") or "").upper() == "CSV"), URL_TARIFAS),
                          meta_t.get("licenca") or ckan.LICENCA_ANEEL)
    per_t = {"inicio": min(s["inicio"] for ss in segs.values() for s in ss), "fim": dia_ref}
    prov_tarifa = c.proveniencia(
        indicador="Tarifa de aplicação B1 residencial convencional por distribuidora e custo por perfil",
        natureza="CALCULADO", fonte=fonte_t, unidade="R$/MWh (tarifa) e R$/mês (perfil)", frequencia="por vigência",
        periodo={"inicio": dia_ref, "fim": dia_ref}, cobertura=per_t, capturado_em=cap(snap_t), snapshot=snap_t,
        transformacoes=["recorte: subgrupo B1, modalidade convencional, subclasse residencial, sem detalhe, sem posto, sem acessante nominal, unidade MWh",
                        "tarifa de aplicação separada da base econômica", "vigência que cobre a data de referência (início e fim inclusivos)",
                        "total = TE + TUSD", "custo do perfil = kWh × total ÷ 1000"],
        formula="custo_perfil(kWh) = kWh × (TE + TUSD) ÷ 1000, com TE e TUSD da tarifa de aplicação em R$/MWh",
        limitacoes=lim_tarifa, download=_url(CSV_VIGENTES), notas_fonte=meta_t.get("notas"))
    prov_evolucao = c.proveniencia(
        indicador="Mediana mensal da tarifa B1 residencial entre distribuidoras, nominal e em reais do último mês com IPCA",
        natureza="CALCULADO", fonte=fonte_t, unidade="R$/MWh", frequencia="mensal (dia 1º de cada mês)",
        periodo={"inicio": evolucao[0][0], "fim": evolucao[-1][0]}, cobertura=per_t, capturado_em=cap(snap_t),
        snapshot=snap_t, transformacoes=["tarifa vigente no dia 1º de cada mês por distribuidora", "mediana entre distribuidoras",
                                          "valor real = nominal × IPCA(último mês) ÷ IPCA(mês)"],
        formula="mediana_real(m) = mediana(TE + TUSD em 1º/m) × I(último) ÷ I(m)",
        limitacoes=["O conjunto de distribuidoras muda ao longo do tempo (fusões, incorporações, permissionárias que passam a ter tarifa própria): a mediana não acompanha sempre as mesmas empresas.",
                    f"Mediana só nos meses com pelo menos {cobertura_minima} distribuidoras com tarifa (80% do maior número mensal, {n_max}); o arquivo começa em fevereiro de 2010 e os primeiros meses cobrem poucas empresas.",
                    "A mediana mensal inclui todas as distribuidoras com tarifa no dia 1º do mês; o ranking usa só as que têm vigência na data de referência, por isso os dois números podem diferir.",
                    "Sem ponderação por consumo.", "Meses sem IPCA publicado ficam sem valor real (não há repetição do último índice)."],
        download=_url(CSV_HIST))
    lim_comp = [
        "Agrupamento em energia, transmissão, distribuição, perdas, encargos e outros é classificação do observatório a partir do código de cada componente; a definição oficial das componentes está no PRORET, submódulo 7.1, cujo arquivo não pôde ser lido (acesso automatizado bloqueado em git.aneel.gov.br).",
        "Tributos e iluminação pública não fazem parte da tarifa e não aparecem na composição.",
        "Componentes com valor negativo (devoluções e ajustes de processos anteriores) reduzem o grupo e são mantidos.",
        (f"Valor negativo em {', '.join(sorted(RECLASSIFICA_SE_NEGATIVO))} não é custo daquela natureza e sai dos encargos para o grupo "
         f"créditos ({len(creditos_lista)} distribuidoras na data; lista em composicao.creditos): leitura do observatório, com a "
         "origem provável (repasse da repactuação da UBP) declarada, porque o PRORET não pôde ser lido."),
        (f"{len(atipicas)} componentes atípicas na data (sinal contrário ao grupo de custo ou módulo muito acima da mesma componente "
         "nas outras distribuidoras, com pelo menos 5% da tarifa) ficam listadas em composicao.componentes_atipicas e em "
         "validacao.ressalvas, conferidas no arquivo original."),
        "A mediana de cada grupo não soma a tarifa mediana; a composição que fecha com o total é a média simples entre distribuidoras (composicao.media).",
    ]
    prov_comp = c.proveniencia(
        indicador="Composição da tarifa B1 residencial de aplicação por grupo de componentes",
        natureza="CALCULADO",
        fonte=_fonte_prov("ANEEL", meta_c.get("titulo") or "Componentes Tarifárias", "componentes-tarifarias-AAAA.parquet (2012 a 2026)",
                          URL_COMP, URL_COMP, meta_c.get("licenca") or ckan.LICENCA_ANEEL),
        unidade="R$/MWh e % do total", frequencia="por vigência", periodo={"inicio": dia_ref, "fim": dia_ref},
        cobertura=per_t, capturado_em=cap(snap_c), snapshot=snap_c,
        transformacoes=["recorte B1 residencial convencional, tarifa de aplicação, R$/MWh", "soma das componentes por grupo",
                        "conferência: soma das parcelas = TE e TUSD publicadas no mesmo conjunto (tolerância 0,01 R$/MWh)",
                        "conferência cruzada: TE e TUSD do conjunto de componentes = TE e TUSD do conjunto de tarifas (tolerância 0,005 R$/MWh)"],
        formula=("grupo(g) = Σ componentes c com GRUPO(c, valor) = g; participação = grupo ÷ (TE + TUSD); composição média: "
                 "Σ distribuidoras grupo(g) ÷ Σ distribuidoras (TE + TUSD)"),
        limitacoes=lim_comp, download=_url(CSV_COMP), notas_fonte=meta_c.get("notas"))
    prov_band = c.proveniencia(
        indicador="Bandeira tarifária acionada por mês e adicionais por patamar", natureza="OBSERVADO",
        fonte=_fonte_prov("ANEEL", meta_b.get("titulo") or "Bandeiras Tarifárias",
                          "Bandeira Tarifária - Acionamento; Bandeira Tarifária - Adicional", URL_BAND, URL_BAND,
                          meta_b.get("licenca") or ckan.LICENCA_ANEEL),
        unidade="R$/MWh", frequencia="mensal", periodo={"inicio": acion[0][0] if acion else dia_ref[:7], "fim": acion[-1][0] if acion else dia_ref[:7]},
        cobertura={"inicio": acion[0][0] if acion else dia_ref[:7], "fim": acion[-1][0] if acion else dia_ref[:7]},
        capturado_em=cap(snap_b), snapshot=snap_b,
        limitacoes=["O campo do adicional se chama R$/MWh e o dicionário o descreve como reais por kWh; os valores são R$/MWh (18,85 = R$ 0,01885/kWh, como na página oficial da ANEEL).",
                    "Bandeiras não se aplicam a consumidores de sistemas isolados."]
        + ([f"{len(sem_par)} mês(es) de acionamento sem adicional correspondente na tabela do conjunto ({', '.join(c.mes_br(x['mes']) for x in sem_par[:6])}); a conferência entre os dois recursos fica sem par nesses meses."]
           if sem_par else [])
        + ([f"{len(diverge)} mês(es) em que o valor acionado difere do adicional da tabela: ver bandeiras.conferencia."] if diverge else []),
        download=_url(CSV_BAND), notas_fonte=None)
    prov_ipca = c.proveniencia(
        indicador="IPCA (número-índice e variação acumulada em 12 meses)", natureza="OBSERVADO",
        fonte=_fonte_prov("IBGE", "IPCA: série histórica com número-índice (tabela 1737)", "SIDRA, variáveis 2266 e 2265",
                          fi.URL_TABELA, fi.URL_SIDRA, fi.LICENCA_IBGE),
        unidade="número-índice (dez/1993 = 100) e %", frequencia="mensal",
        periodo={"inicio": min(indice) if indice else dia_ref[:7], "fim": ultimo_ipca or dia_ref[:7]},
        cobertura={"inicio": min(indice) if indice else dia_ref[:7], "fim": ultimo_ipca or dia_ref[:7]},
        capturado_em=cap(snap_i), snapshot=snap_i, publicacao_informada=False,
        limitacoes=["IPCA mede preços ao consumidor em geral; a tarifa é um dos itens. Comparar reajuste com IPCA não diz se a tarifa está certa, só se subiu mais ou menos que a inflação no mesmo período."],
        download=_url(CSV_IPCA))
    # simulador: estimativa por cenário que combina tarifas, bandeira e regras conferidas
    # em normas; natureza e fontes próprias (não é a proveniência da tarifa do ranking)
    snap_n = c.snapshot_de(con, DS_NORMAS)
    snap_sim = _snapshot_composto(snap_t, snap_b, snap_n)
    nao_conferidas = [f"{r_['id']}: {pt['texto']} ({pt['motivo'] or 'norma não conferida na captura'})"
                      for r_ in regras_sim for pt in r_["partes"] if pt["estado"] != "CONFERIDA"]
    prov_sim = c.proveniencia(
        indicador="Estimativa do valor da energia na fatura por classe, consumo, ligação e bandeira (simulador)",
        natureza="ESTIMADO",
        fonte=_fonte_prov("ANEEL e Câmara dos Deputados",
                          "Tarifas de aplicação das distribuidoras; Bandeiras Tarifárias; Lei nº 15.235/2025 e páginas oficiais da ANEEL",
                          "tarifas-homologadas-distribuidoras-energia-eletrica.csv; Bandeira Tarifária - Acionamento; "
                          "Bandeira Tarifária - Adicional; " + "; ".join(n["id"] for n in NORMAS),
                          URL_TARIFAS, fonte_t["url_primaria"],
                          f"{ckan.LICENCA_ANEEL} (conjuntos da ANEEL); {LIC_GOVBR}; {LIC_LEI}"),
        unidade="R$/mês", frequencia="por cenário, com a vigência da data de referência",
        periodo={"inicio": dia_ref, "fim": dia_ref}, cobertura=per_t, capturado_em=cap(snap_sim), snapshot=snap_sim,
        transformacoes=["tarifa de aplicação (TE + TUSD) da classe e faixa vigente na data de referência",
                        "faixas da Tarifa Social (80 kWh) e do Desconto Social (120 kWh) conforme as regras em simulador.regras_texto",
                        "custo de disponibilidade de 30, 50 ou 100 kWh conforme a ligação, onde a regra se aplica",
                        "adicional da bandeira por kWh sujeito à bandeira"],
        formula="total = Σ faixas (kWh da faixa × (TE + TUSD) da faixa ÷ 1000) − descontos + kWh sujeitos à bandeira × adicional ÷ 1000",
        limitacoes=["Estimativa sem ICMS, PIS/Pasep, Cofins e contribuição de iluminação pública: não é a fatura.",
                    "Leituras aplicadas que a norma lida não cobre (declaradas, não conferidas): " + ("; ".join(nao_conferidas) or "nenhuma"),
                    "Tarifa da classe não publicada na vigência torna a simulação indisponível; não se usa tarifa de outra classe.",
                    "Bandeiras não se aplicam a consumidores de sistemas isolados."],
        download=_url(CSV_VIGENTES), notas_fonte=None)
    prov_reaj = c.proveniencia(
        indicador="Variação da tarifa B1 residencial de aplicação entre vigências e comparação com o IPCA",
        natureza="CALCULADO", fonte=fonte_t, unidade="%", frequencia="por evento tarifário",
        periodo={"inicio": per_t["inicio"], "fim": dia_ref}, cobertura=per_t, capturado_em=cap(snap_t), snapshot=snap_t,
        transformacoes=["linha do tempo resolvida por distribuidora", "evento = mudança de valor ou de ato entre pedaços contíguos",
                        "IPCA do mês anterior à data do evento anterior até o mês anterior à data do evento",
                        "janelas de 12, 60 e 120 meses terminadas no último dia do último mês com IPCA"],
        formula="variação = (TE + TUSD)_depois ÷ (TE + TUSD)_antes − 1; variação real = (1 + variação) ÷ (1 + IPCA) − 1",
        limitacoes=["Não é o efeito médio do processo tarifário divulgado pela ANEEL, que pondera todas as classes e tensões; a base com o efeito médio (memórias de cálculo e calendário de processos) está em endereços da ANEEL que bloquearam o acesso automatizado.",
                    "O conjunto não informa se o ato é reajuste anual, revisão periódica ou revisão extraordinária; o evento traz o número do ato.",
                    "A diferença entre PLD e tarifa não é margem da distribuidora; a variação da tarifa reflete energia contratada, transmissão, distribuição, perdas, encargos e componentes financeiros."],
        download=_url(CSV_REAJ))
    prov_subs = c.proveniencia(
        indicador="Repasses da CDE para subsídios tarifários por categoria e ano de competência",
        natureza="CALCULADO",
        fonte=_fonte_prov("ANEEL", meta_s.get("titulo") or "Subsídios Tarifários", "subsidios-tarifarios.csv", URL_SUBS,
                          URL_SUBS, meta_s.get("licenca") or ckan.LICENCA_ANEEL),
        unidade="R$ (nominal)", frequencia="mensal (somado por ano)",
        periodo={"inicio": anos[0] if anos else mes_ref, "fim": mes_ref}, cobertura={"inicio": anos[0] if anos else mes_ref, "fim": mes_ref},
        capturado_em=cap(snap_s), snapshot=snap_s,
        transformacoes=["montante 'Total' (previsão + ajuste) por categoria", "a linha de categoria 'Total' publicada fica como conferência, não é somada",
                        f"competências posteriores a {c.mes_br(mes_ref)} excluídas ({futuros} pares distribuidora-mês)"],
        formula="anual(categoria, ano) = Σ distribuidoras Σ meses do ano de repasse Total da categoria",
        limitacoes=[NOTA_SUBSIDIOS, "Valores nominais homologados em resoluções; não são desembolso realizado.",
                    "Anos com menos de 12 meses de competência são marcados como parciais."],
        download=_url(CSV_SUBS), notas_fonte=meta_s.get("notas"))

    snap_cde = c.snapshot_de(con, DS_CDE)
    meta_cde = ckan.meta_local(DS_CDE)
    prov_cde = None
    if financiamento:
        prov_cde = c.proveniencia(
            indicador="Orçamento anual da CDE por rubrica de despesa e de receita (aprovado ou previsto pela ANEEL)",
            natureza="PREVISTO",
            fonte=_fonte_prov("ANEEL", meta_cde.get("titulo") or "Conta Desenvolvimento Energético (CDE) - Custeio dos Benefícios Tarifários",
                              "cde-custeio-beneficios-tarifarios.csv", URL_CDE, URL_CDE, meta_cde.get("licenca") or ckan.LICENCA_ANEEL),
            unidade="R$ (nominal)", frequencia="anual",
            periodo={"inicio": financiamento["anos"][0], "fim": financiamento["anos"][-1]},
            cobertura={"inicio": financiamento["anos"][0], "fim": financiamento["anos"][-1]},
            capturado_em=cap(snap_cde), snapshot=snap_cde,
            transformacoes=["nome da rubrica aparado ('RGR ' e 'RGR' são a mesma rubrica em anos diferentes)",
                            "grupo de leitura atribuído pelo nome da rubrica (classificação do observatório)",
                            "participação das quotas = quotas ÷ receita total do ano; da Tarifa Social = rubrica ÷ despesa total"],
            formula="quotas_pct = Σ 'Quotas CDE ...' ÷ Σ receitas × 100; tarifa_social_pct = 'Subsídio Baixa Renda' ÷ Σ despesas × 100",
            limitacoes=[financiamento["nota"],
                        "Valores de orçamento: o que a CDE efetivamente arrecadou e gastou no ano não está neste conjunto.",
                        "O dicionário do conjunto (versão 2.0) descreve o valor como custeio da Tarifa Social, mas o arquivo traz todas as rubricas da CDE; a leitura segue o conteúdo do arquivo.",
                        "Rubrica publicada sem valor fica sem valor (não é zero) e é listada no ano.",
                        "Valores nominais: comparar anos distantes exige correção monetária."],
            download=_url(CSV_CDE), notas_fonte=meta_cde.get("notas"))

    # ---- evidências dos números principais ("Comprove este número", via evidencia.py)
    v_tar = _vintage_recente(con, DS_TARIFAS, "csv")
    ft = ev.fonte_de_vintage("ANEEL", "Tarifas de aplicação das distribuidoras de energia elétrica", URL_TARIFAS, v_tar)
    n_fecha = sum(1 for x in composicao if x["fecha_com_total"])
    testes_tarifa = [
        ev.teste("unidade conferida linha a linha", "aprovado",
                 f"{universo_t.get('unidade_diferente_de_mwh', 0)} linhas do recorte com unidade diferente de MWh ficaram de fora; nenhuma foi convertida"),
        ev.teste("componentes somam TE e TUSD (0,01 R$/MWh)",
                 _veredito(bool(composicao) and n_fecha == len(composicao), n_fecha > 0 or not composicao),
                 f"{n_fecha} de {len(composicao)} distribuidoras com componentes; "
                 f"{len(rec_cruzada['sem_componentes'])} sem componentes para o ato vigente não entram nesta conferência"),
        ev.teste("TE e TUSD iguais nos conjuntos de tarifas e de componentes (0,005 R$/MWh)",
                 _veredito(not rec_cruzada["divergentes"] and not rec_cruzada["sem_componentes"], True),
                 f"{rec_cruzada['conferidas']} conferidas, {len(rec_cruzada['divergentes'])} divergentes, "
                 f"{len(rec_cruzada['sem_componentes'])} sem componentes publicadas para o ato vigente"
                 + (f" ({', '.join(x or 'sem sigla' for x in rec_cruzada['sem_componentes'])})" if rec_cruzada["sem_componentes"] else "")),
    ]
    # cobertura parcial não é aprovação: distribuidora sem componentes para o ato fica sem
    # a conferência cruzada, e o resultado sai como ressalva
    rec_tarifa = ev.reconciliacao(
        (f"TE e TUSD de cada distribuidora conferidas contra o conjunto Componentes Tarifárias (outro recurso da ANEEL, lido por "
         f"outro código): {rec_cruzada['conferidas']} de {resumo['n']} conferidas, {len(rec_cruzada['divergentes'])} divergentes, "
         f"{len(rec_cruzada['sem_componentes'])} sem componentes para o ato vigente"),
        _veredito(not rec_cruzada["divergentes"] and not rec_cruzada["sem_componentes"], True), "0,005 R$/MWh por parcela")
    med_bruta = c.quantil(totais, 0.5)
    ev_mediana = ev.construir(
        indicador="Tarifa residencial B1 mediana entre distribuidoras",
        valor_exibido=f"R$ {_br(med_bruta / 1000, 4)}/kWh", valor_calculo=med_bruta, unidade="R$/MWh",
        periodo={"inicio": dia_ref, "fim": dia_ref}, entidade="distribuidoras com tarifa B1 residencial convencional vigente",
        universo=f"{resumo['n']} distribuidoras com vigência na data, de {resumo['n'] + len(sem_vigente)} CNPJs com tarifa B1 residencial no conjunto",
        filtros=["subgrupo B1", "modalidade Convencional", "subclasse Residencial", "base Tarifa de Aplicação",
                 "detalhe, posto e acessante: Não se aplica", "unidade MWh"],
        fonte=ft, chaves_origem=[f"{v['cnpj']}|B1|Residencial|TA|{v['inicio']}|{v['fim']}|{v['ato']}" for v in vigentes],
        manifesto={"rotulo": "Tarifas vigentes, uma linha por distribuidora (CSV)", "url": _url(CSV_VIGENTES)},
        formula="mediana (quantil tipo 7) de TE + TUSD entre distribuidoras, sem ponderação",
        exclusoes=[f"{len(sem_vigente)} CNPJs sem vigência cobrindo {c.data_br(dia_ref)} (lista em tarifas.sem_vigente)"],
        cobertura=f"{resumo['n']} de {resumo['n'] + len(sem_vigente)} CNPJs",
        tratamento_ausencia="distribuidora sem vigência na data fica fora e é listada; TE e TUSD iguais a zero na mesma linha são tarifa não homologada, não entram",
        revisoes=snap_t.get("revisoes"), testes=testes_tarifa, reconciliacao=rec_tarifa,
        download=[{"rotulo": "Tarifas vigentes (CSV)", "url": _url(CSV_VIGENTES)},
                  {"rotulo": "Histórico de tarifas de baixa tensão (CSV)", "url": _url(CSV_HIST)}],
        reproducao=REPRODUCAO)

    # P048: participação dos encargos na distribuidora de referência (mais próxima da mediana)
    ev_comp = None
    if composicao:
        alvo_c = min(composicao, key=lambda x: (abs(x["total"] - resumo["mediana"]), x["sigla"] or ""))
        ref_c, comps_c = comp_usado[alvo_c["cnpj"]]
        grupos_c, chk_c = grupos_componentes(comps_c)
        enc = grupos_c["encargos"]
        cods_enc = [cd for g, _, cods in GRUPOS if g == "encargos" for cd in cods if comps_c.get(cd) is not None]
        v_comp = _vintage_da_observacao(con, DS_COMP, f"{alvo_c['cnpj']}|B1|Residencial|TA|TE", ref_c)
        ev_comp = ev.construir(
            indicador="Participação dos encargos setoriais na tarifa B1 residencial",
            valor_exibido=f"{_br(100 * enc / alvo_c['total'], 1)}%", valor_calculo=100 * enc / alvo_c["total"], unidade="%",
            periodo={"inicio": dia_ref, "fim": dia_ref}, entidade=f"{alvo_c['sigla']} (CNPJ {alvo_c['cnpj']})",
            universo="distribuidora com tarifa B1 mais próxima da mediana nacional",
            filtros=["B1 residencial convencional", "tarifa de aplicação", "R$/MWh"],
            fonte=_fonte_ev_varios("ANEEL", "Componentes Tarifárias", URL_COMP, [v_comp, v_tar]),
            chaves_origem=[f"{alvo_c['cnpj']}|B1|Residencial|TA|{cd}|{ref_c}" for cd in cods_enc],
            formula="Σ componentes do grupo encargos ÷ (TE + TUSD de aplicação) × 100",
            numerador={"descricao": "Σ componentes do grupo encargos setoriais (R$/MWh)", "valor": enc},
            denominador={"descricao": "TE + TUSD de aplicação B1 residencial (R$/MWh)", "valor": alvo_c["total"]},
            exclusoes=["tributos e iluminação pública (fora da tarifa)"],
            cobertura=f"{len(cods_enc)} componentes de encargos publicadas na vigência",
            tratamento_ausencia="componente não publicada não entra (não vira zero)",
            revisoes=snap_c.get("revisoes"),
            testes=[ev.teste("parcelas somam a TE e a TUSD do próprio conjunto (0,01 R$/MWh)", _veredito(alvo_c["fecha_com_total"]),
                             f"soma TE {_br(chk_c['soma_te'], 4)} x TE {_br(chk_c['te'], 2)}; soma TUSD {_br(chk_c['soma_tusd'], 4)} x TUSD {_br(chk_c['tusd'], 2)}"),
                    ev.teste("códigos sem grupo conhecido", _veredito(not chk_c["desconhecidos"], True),
                             ", ".join(chk_c["desconhecidos"]) or "nenhum")],
            reconciliacao=ev.reconciliacao("TE e TUSD do conjunto de componentes contra o conjunto de tarifas de aplicação",
                                           _veredito(alvo_c["confere_com_tarifas"], True), "0,005 R$/MWh por parcela"),
            download=[{"rotulo": "Componentes da tarifa B1 (CSV)", "url": _url(CSV_COMP)}], reproducao=REPRODUCAO)

    # P049: caso do simulador na distribuidora de referência, com a bandeira do mês mais recente
    ev_sim = None
    if band_vigente and band_vigente.get("rs_mwh") is not None and t_alvo.get("residencial"):
        kwh_ev = 150
        r_sim = simular(t_alvo, "residencial", kwh_ev, "monofasico", band_vigente["rs_mwh"])
        if r_sim["disponivel"]:
            v_ac = _vintage_recente(con, DS_BAND, "Acionamento")
            mes_b = band_vigente["mes"]
            ok_band = next((x for x in band_confere["divergem"] if x["mes"] == mes_b), None) is None
            comp_alvo = next((x for x in composicao if x["cnpj"] == alvo["cnpj"]), None)
            ev_sim = ev.construir(
                indicador="Estimativa sem tributos do valor da energia na fatura (simulador)",
                valor_exibido=f"R$ {_br(r_sim['total'], 2)}", valor_calculo=r_sim["total"], unidade="R$/mês",
                periodo={"inicio": dia_ref, "fim": dia_ref},
                entidade=f"{alvo['sigla']} (CNPJ {alvo['cnpj']}), residencial B1, {kwh_ev} kWh, ligação monofásica",
                universo="um cenário de consumo; não é a fatura de ninguém",
                filtros=["classe residencial", f"bandeira {band_vigente['bandeira']} ({c.mes_br(mes_b)})"],
                fonte=_fonte_ev_varios("ANEEL", "Tarifas de aplicação e Bandeiras Tarifárias", URL_TARIFAS, [v_tar, v_ac]),
                chaves_origem=[f"{alvo['cnpj']}|B1|Residencial|TA|{alvo['inicio']}|{alvo['fim']}|{alvo['ato']}", f"acionamento|{mes_b}"],
                formula=f"{kwh_ev} kWh × (TE + TUSD) ÷ 1000 + {kwh_ev} kWh × adicional da bandeira ÷ 1000",
                exclusoes=["ICMS, PIS/Pasep e Cofins", "contribuição de iluminação pública", "descontos sociais (classe residencial comum)"],
                cobertura="tarifa e bandeira vigentes na data", tratamento_ausencia="sem tarifa ou sem bandeira publicada, a simulação fica indisponível",
                revisoes=snap_t.get("revisoes"),
                testes=[ev.teste("bandeira do mês confere com a tabela de adicionais do conjunto", _veredito(ok_band, True), c.mes_br(mes_b)),
                        ev.teste("TE e TUSD da distribuidora conferem com o conjunto de componentes",
                                 _veredito(bool(comp_alvo and comp_alvo["confere_com_tarifas"]), True),
                                 "conferida" if comp_alvo and comp_alvo["confere_com_tarifas"] else "sem componentes para o ato ou divergente"),
                        ev.teste("consumo acima do custo de disponibilidade (30 kWh na ligação monofásica)", "aprovado",
                                 "o mínimo faturável não altera este caso")],
                download=[{"rotulo": "Tarifas vigentes (CSV)", "url": _url(CSV_VIGENTES)},
                          {"rotulo": "Bandeiras por mês (CSV)", "url": _url(CSV_BAND)}],
                reproducao=REPRODUCAO)

    # P050: mediana da variação em 12 meses contra o IPCA do mesmo período
    ev_reaj = None
    if comparacao and jan_brutas.get(12):
        j12 = next(j for j in comparacao["janelas"] if j["meses"] == 12)
        br12 = jan_brutas[12]
        med12 = 100 * c.quantil([b[1] for b in br12], 0.5)
        conf = comparacao["conferencia_ipca_12m"]
        v_ipca = _vintage_recente(con, DS_IPCA)
        ev_reaj = ev.construir(
            indicador="Variação mediana da tarifa B1 residencial em 12 meses",
            valor_exibido=f"{_br(med12, 2)}%", valor_calculo=med12, unidade="%",
            periodo={"inicio": j12["de"], "fim": j12["ate"]}, entidade="distribuidoras com tarifa B1 nas duas datas",
            universo=f"{j12['n']} distribuidoras", filtros=["B1 residencial convencional", "tarifa de aplicação"],
            fonte=_fonte_ev_varios("ANEEL e IBGE", "Tarifas de aplicação; IPCA (SIDRA 1737)", URL_TARIFAS, [v_tar, v_ipca]),
            chaves_origem=[f"{b[0]}|B1|Residencial|TA|{b[5]['inicio']}|{b[5]['ato']}|{b[6]['inicio']}|{b[6]['ato']}" for b in br12],
            manifesto={"rotulo": "Variação por distribuidora e IPCA (CSV)", "url": _url(CSV_JAN)},
            formula="mediana entre distribuidoras de (TE + TUSD em 'até') ÷ (TE + TUSD em 'de') − 1; IPCA pela razão de números-índice dos mesmos meses",
            exclusoes=[(f"{j12['excluidas_sem_tarifa_nas_duas_datas']} "
                        + ("distribuidora com tarifa" if j12["excluidas_sem_tarifa_nas_duas_datas"] == 1 else "distribuidoras com tarifa")
                        + " em só uma das datas"),
                       f"{len(j12['excluidas_mudanca_perimetro'])} com mudança de perímetro (incorporação) dentro da janela"],
            cobertura=f"{j12['n']} distribuidoras", tratamento_ausencia="sem tarifa em uma das datas, a distribuidora fica fora; mês sem índice publicado não é interpolado",
            revisoes=snap_t.get("revisoes"),
            testes=[ev.teste("IPCA 12 meses pela razão de índices = variação publicada pelo IBGE (0,01 ponto percentual)",
                             _veredito(conf["confere"]), f"calculado {_br(conf['calculado_pct'], 4)}% x publicado {_br(conf['publicado_pct'], 2)}% em {c.mes_br(conf['mes'])}"),
                    ev.teste("tarifa e IPCA nos mesmos meses", "aprovado", f"{c.mes_br(j12['ipca_meses'][0])} a {c.mes_br(j12['ipca_meses'][1])}")],
            reconciliacao=ev.reconciliacao("IPCA acumulado em 12 meses: razão de números-índice (variável 2266) contra a variação publicada (variável 2265)",
                                           _veredito(conf["confere"]), "0,01 ponto percentual"),
            download=[{"rotulo": "Variação por distribuidora e IPCA (CSV)", "url": _url(CSV_JAN)},
                      {"rotulo": "IPCA usado (CSV)", "url": _url(CSV_IPCA)}],
            reproducao=REPRODUCAO)

    # bandeira do mês mais recente publicado
    ev_band = None
    if band_vigente and band_vigente.get("rs_mwh") is not None:
        fb = _fonte_ev(con, DS_BAND, "ANEEL", "Bandeiras Tarifárias", URL_BAND, "Acionamento")
        norma_b = next((n for n in normas if n["id"] == "aneel_bandeiras"), None)
        # valor da página oficial lido do trecho conferido na captura (não é número fixado)
        trecho_am = next(n for n in NORMAS if n["id"] == "aneel_bandeiras")["trechos"][0]
        m_am = re.search(r"R\$ (\d+,\d+) para cada quilowatt-hora", trecho_am)
        pag_amarela = float(m_am.group(1).replace(",", ".")) * 1000 if m_am else None
        trecho_ok = bool(norma_b and norma_b["trechos"] and norma_b["trechos"][0]["presente"])
        adic_am = adic_ref.get("Amarela")
        ok_pag = trecho_ok and adic_am is not None and pag_amarela is not None and abs(adic_am - pag_amarela) <= 0.005
        mes_b = band_vigente["mes"]
        ev_band = ev.construir(
            indicador="Bandeira tarifária acionada",
            valor_exibido=f"{band_vigente['bandeira']}: R$ {_br(band_vigente['rs_mwh'] / 1000, 5)}/kWh",
            valor_calculo=band_vigente["rs_mwh"], unidade="R$/MWh", periodo={"inicio": mes_b, "fim": mes_b},
            entidade="consumidores cativos do SIN", universo="nacional, exceto sistemas isolados", filtros=[],
            fonte=fb, chaves_origem=[f"acionamento|{mes_b}"], formula="valor publicado pela ANEEL para o mês",
            cobertura=f"{len(acion)} meses publicados ({c.mes_br(acion[0][0])} a {c.mes_br(acion[-1][0])})",
            tratamento_ausencia="mês não publicado não é preenchido nem repetido",
            revisoes=snap_b.get("revisoes"),
            testes=[ev.teste(f"acionamento de {c.mes_br(mes_b)} confere com a tabela de adicionais do conjunto",
                             _veredito(not any(x["mes"] == mes_b for x in band_confere["divergem"])),
                             f"{_br(band_vigente['rs_mwh'], 2)} R$/MWh acionado"),
                    ev.teste("série inteira: acionamento confere com a tabela de adicionais", _veredito(not diverge and not sem_par, True),
                             f"{band_confere['conferem']} de {band_confere['meses']} meses; {len(sem_par)} sem resolução correspondente na "
                             f"tabela e {len(diverge)} com valor diferente do adicional da tabela vigente no mês; o conjunto não traz resolução que explique a diferença")],
            reconciliacao=ev.reconciliacao(
                "adicional da bandeira amarela na tabela do conjunto contra a página oficial da ANEEL (trecho conferido na captura)",
                _veredito(ok_pag, trecho_ok), "0,005 R$/MWh"),
            download=[{"rotulo": "Bandeiras por mês (CSV)", "url": _url(CSV_BAND)}], reproducao=REPRODUCAO)

    ev_subs = None
    ult_sub = next((x for x in subsidios_anual if x["ano"] == ultimo_completo), None)
    if ult_sub:
        soma_bruta = sum(anual[cat].get(ultimo_completo, 0.0) for cat in anual)
        ev_subs = ev.construir(
            indicador="Repasses da CDE para subsídios tarifários no ano",
            valor_exibido=f"R$ {_br(soma_bruta / 1e9, 1)} bilhões", valor_calculo=soma_bruta, unidade="R$",
            periodo={"inicio": f"{ultimo_completo}-01", "fim": f"{ultimo_completo}-12"},
            entidade="distribuidoras credoras de repasse", universo="todas as distribuidoras do conjunto",
            filtros=["montante Total", "categorias exceto a linha Total"],
            fonte=_fonte_ev(con, DS_SUBS, "ANEEL", "Subsídios Tarifários", URL_SUBS, "Subs"),
            consulta=f"DscTipoMontante = 'Total', DscTipoSubsidio diferente de 'Total', DatSubsidio de 01/01/{ultimo_completo} a 01/12/{ultimo_completo}",
            formula="Σ distribuidoras Σ meses Σ categorias do repasse Total",
            exclusoes=["linha de categoria Total publicada (usada só na conferência)"],
            cobertura=f"{ult_sub['meses']} meses de competência", tratamento_ausencia="célula vazia não entra na soma e não vira zero",
            revisoes=snap_s.get("revisoes"),
            testes=[ev.teste(f"categorias somam o Total publicado por distribuidora e mês em {ultimo_completo} (R$ 0,05)",
                             _veredito(checagem["total_vs_categorias"]["divergem_por_ano"].get(ultimo_completo, 0) == 0, True),
                             f"{checagem['total_vs_categorias']['divergem_por_ano'].get(ultimo_completo, 0)} pares distribuidora-mês divergem no ano"),
                    ev.teste("série inteira: categorias somam o Total publicado (R$ 0,05)",
                             _veredito(checagem["total_vs_categorias"]["divergem"] == 0, True),
                             f"{checagem['total_vs_categorias']['divergem']} de {checagem['total_vs_categorias']['comparacoes']} pares distribuidora-mês divergem, "
                             f"nos anos {', '.join(sorted(checagem['total_vs_categorias']['divergem_por_ano']))}; o ano exibido usa a soma das categorias"),
                    ev.teste("série inteira: Total = previsão + ajuste por categoria (R$ 0,05), conferido na ingestão",
                             _veredito(checagem["total_vs_previsao_mais_ajuste"]["divergem"] == 0, True),
                             f"{checagem['total_vs_previsao_mais_ajuste']['divergem']} de {checagem['total_vs_previsao_mais_ajuste']['comparacoes']} divergem"),
                    # controle interno (o mesmo arquivo), não reconciliação externa: não há total oficial
                    # independente dos repasses por categoria com o mesmo grão
                    ev.teste("controle interno: soma das categorias contra a soma da linha Total publicada no mesmo ano (R$ 1 ou uma parte por milhão)",
                             _veredito(ult_sub["total_publicado"] is not None and abs(ult_sub["total_publicado"] - ult_sub["soma_categorias"]) <= max(1.0, 1e-6 * abs(ult_sub["soma_categorias"] or 0)), True),
                             f"categorias {_br(ult_sub['soma_categorias'], 0)} x linha Total {_br(ult_sub['total_publicado'], 0)}")],
            reconciliacao=None,
            download=[{"rotulo": "Subsídios por ano, distribuidora e categoria (CSV)", "url": _url(CSV_SUBS)}],
            reproducao=REPRODUCAO)

    ev_cde = None
    if financiamento:
        t_ult = cde["totais"][-1]
        ano_c = t_ult["ano"]
        quotas = [l for l in cde["linhas"] if l["grupo"] == "quotas_tarifa" and l["valores"][ano_c] is not None]
        uni_cde = base.registros_como_estavam_em(con, DS_CDE).get(f"__universo__|{(_vintage_recente(con, DS_CDE) or {}).get('vintage_id')}", {})
        if t_ult["quotas_pct"] is not None:
            ev_cde = ev.construir(
                indicador="Participação das quotas pagas nas tarifas no custeio da CDE",
                valor_exibido=f"{_br(t_ult['quotas_pct'], 1)}%", valor_calculo=t_ult["quotas_pct"], unidade="%",
                periodo={"inicio": ano_c, "fim": ano_c}, entidade="Conta de Desenvolvimento Energético (CDE)",
                universo="todas as rubricas de receita publicadas no ano", filtros=["tipo Receita"],
                fonte=_fonte_ev(con, DS_CDE, "ANEEL", "CDE: custeio dos benefícios tarifários", URL_CDE),
                chaves_origem=[f"Receita|{l['fonte']}|{ano_c}" for l in quotas],
                formula="Σ rubricas 'Quotas CDE ...' ÷ Σ rubricas de receita do ano × 100",
                numerador={"descricao": "Σ quotas da CDE (R$)", "valor": t_ult["grupos"]["quotas_tarifa"]},
                denominador={"descricao": "Σ receitas publicadas no ano (R$)", "valor": t_ult["receita"]},
                exclusoes=[f"rubricas sem valor publicado em {ano_c}: {', '.join(t_ult['rubricas_sem_valor']) or 'nenhuma'}"],
                cobertura=f"{len(cde['anos'])} anos ({cde['anos'][0]} a {cde['anos'][-1]})",
                tratamento_ausencia="rubrica sem valor publicado não entra e não vira zero",
                revisoes=snap_cde.get("revisoes"),
                testes=[ev.teste("controle interno: despesa = receita em todos os anos (R$ 1)", _veredito(all(x["fecha"] for x in cde["totais"]), True),
                                 f"{sum(1 for x in cde['totais'] if x['fecha'])} de {len(cde['totais'])} anos; identidade do orçamento "
                                 "(a quota fecha a diferença), não conferência externa"),
                        ev.teste("controle interno: rubrica repetida no mesmo ano com valor diferente", _veredito(int(uni_cde.get("rubrica_repetida_com_valor_diferente", 0) or 0) == 0, True),
                                 f"{uni_cde.get('rubrica_repetida_com_valor_diferente', 0)} casos")],
                # reconciliação externa: total do arquivo contra o orçamento divulgado pela ANEEL.
                # Sai como ressalva mesmo quando confere, porque só o título das notícias pôde ser
                # lido (corpo restrito no gov.br) e a página não está no bronze
                reconciliacao=ev.reconciliacao(
                    "despesa total do ano no arquivo contra o orçamento da CDE divulgado pela ANEEL: "
                    + "; ".join(f"{x['ano']}, {x['situacao']}: publicado R$ {_br(x['publicado_rs'] / 1e9, 2)} bilhões, arquivo "
                                f"R$ {_br(x['arquivo_despesa_rs'] / 1e9, 3) if x['arquivo_despesa_rs'] is not None else 'sem ano'} bilhões, "
                                f"{'confere' if x['confere'] else 'diverge' if x['confere'] is False else 'sem par'}"
                                for x in financiamento["reconciliacao_externa"])
                    + f". Acesso: {ACESSO_REFERENCIAS_CDE}",
                    ("reprovado" if any(x["confere"] is False for x in financiamento["reconciliacao_externa"]) else "ressalva"),
                    "meia unidade da última casa publicada no título (R$ 0,05 bilhão para uma casa, R$ 0,005 bilhão para duas)"),
                download=[{"rotulo": "Custeio da CDE por rubrica (CSV)", "url": _url(CSV_CDE)}], reproducao=REPRODUCAO)
        financiamento["proveniencia"] = prov_cde
        financiamento["evidencia"] = ev_cde

    g = {
        **c.cabecalho(nome),
        "data_referencia": dia_ref,
        "gerado_pela_fonte_em": gerado_fonte,
        "perfis_kwh": list(PERFIS_KWH),
        "definicoes": {
            "tarifa_homologada": "TE + TUSD de aplicação publicadas na resolução homologatória da ANEEL, em R$/MWh, sem tributos e sem bandeira.",
            "tarifa_base_economica": "Valores usados estritamente no cálculo tarifário (dicionário da ANEEL); a diferença para a tarifa de aplicação são os componentes financeiros do processo.",
            "tarifa_media_fornecimento": "Receita de fornecimento dividida pela energia vendida. Não é calculada neste módulo.",
            "conta_simulada": "Estimativa do valor da energia na fatura para um consumo informado, com as regras declaradas, sem tributos e sem iluminação pública.",
            "perfil": "Consumo mensal de referência escolhido pelo observatório (100, 200 e 300 kWh) para comparar distribuidoras; não é consumo médio.",
            "nao_e_conta": "PLD vezes consumo não é conta de luz; a diferença entre PLD e tarifa não é margem da distribuidora.",
        },
        "regras": {
            "sobreposicao": "Vigências sobrepostas com valores diferentes: vence a de início mais recente; empate, o ato mais recente; empate, a vigência mais curta.",
            "zero_publicado": "TE e TUSD iguais a zero na mesma linha significam tarifa não homologada para a subclasse (a fonte publica ',00'); o valor não entra em comparação.",
            "vigencia": "Início e fim de vigência são inclusivos.",
            "unidade": "Só entram linhas com unidade MWh (R$/MWh); linha em kW (demanda) fica fora e é contada.",
        },
        "universo_tarifas": universo_t,
        "siglas_substituidas": siglas_substituidas,
        "tarifas": {"resumo": resumo, "vigentes": vigentes, "sem_vigente": sem_vigente, "evolucao": evolucao,
                    "historico_url": _url(JSON_HIST), "proveniencia": prov_tarifa, "proveniencia_evolucao": prov_evolucao,
                    "evidencia_mediana": ev_mediana},
        "composicao": {"grupos": [{"id": g, "rotulo": r_, "componentes": [{"codigo": cd, "descricao": DESCRICAO_COMPONENTE.get(cd)} for cd in cods]}
                                  for g, r_, cods in GRUPOS],
                       "classificacao": ("observatório, pelo código da componente (PRORET 7.1 não lido: acesso bloqueado); valor "
                                         "negativo em componente de custo listada em creditos.codigos vai para o grupo créditos"),
                       # medianas grupo a grupo (não somam o total) e composição média que fecha com o total
                       "mediana_rs_mwh": comp_med, "mediana": mediana_resumo, "media": media_comp,
                       "cde": cde_resumo, "creditos": creditos, "componentes_atipicas": atipicas,
                       "regra_atipico": (f"componente com sinal contrário à natureza do grupo de custo ou com módulo mais de "
                                         f"{ATIPICO_FATOR_MEDIANA:g} vezes a mediana da mesma componente entre as distribuidoras, "
                                         f"com pelo menos {ATIPICO_PCT_TARIFA:g}% da tarifa"),
                       "distribuidoras": composicao,
                       "reconciliacao": {"conferidas": rec_cruzada["conferidas"], "divergentes": rec_cruzada["divergentes"],
                                         "sem_componentes": rec_cruzada["sem_componentes"], "duplicatas_fonte": duplicatas_comp},
                       "excluidos": ["ICMS", "PIS/Pasep", "Cofins", "Contribuição para Iluminação Pública"],
                       "proveniencia": prov_comp, "evidencia": ev_comp},
        "simulador": {"classes": CLASSES_SIMULADOR, "chaves_tarifa": {k: {"subgrupo": s, "subclasse": sc} for k, (s, sc) in CLASSES_TARIFA.items()},
                      "regras": REGRAS_SIMULADOR, "regras_texto": regras_sim, "normas": normas,
                      # estado de cada regra pelas partes: trecho normativo conferido e leitura aplicada são coisas distintas
                      "estado_regras": estados_regras,
                      "bandeiras": patamares, "bandeira_vigente": band_vigente, "distribuidoras": sim_dist,
                      "cobertura_classes": cobertura_classes,
                      "casos_referencia": {"cnpj": alvo["cnpj"], "sigla": alvo["sigla"], "criterio": "distribuidora com tarifa B1 mais próxima da mediana",
                                           "casos": casos},
                      "rotulo": "Estimativa sem tributos (ICMS, PIS/Pasep e Cofins) e sem contribuição de iluminação pública.",
                      "formula": "total = Σ faixas (kWh da faixa × (TE + TUSD) da faixa ÷ 1000) − descontos + kWh sujeitos à bandeira × adicional ÷ 1000",
                      "proveniencia": prov_sim, "evidencia": ev_sim},
        "reajustes": {"ultimos": ultimos, "historico_url": _url(JSON_HIST), "comparacao_inflacao": comparacao,
                      "proveniencia": prov_reaj, "proveniencia_ipca": prov_ipca, "evidencia": ev_reaj,
                      "efeito_medio": {"disponivel": False,
                                       "motivo": ("O efeito médio de cada processo tarifário (todas as classes) e o calendário dos processos são publicados "
                                                  "em calculostarifarios.aneel.gov.br e git.aneel.gov.br, que responderam 403 com desafio de navegador "
                                                  "(Cloudflare) em 30/09/2026; não há recurso equivalente no portal de dados abertos. O módulo mostra a "
                                                  "variação da tarifa B1 residencial, que é outra medida.")},
                      "nota": "Variação da tarifa B1 residencial de aplicação entre vigências; não é o efeito médio do processo tarifário."},
        "bandeiras": {"acionamento": [{"m": m, "bandeira": b, "rs_mwh": c.r(val, 2)} for m, b, val in acion],
                      "adicionais": tabela_adic, "patamares": patamares, "vigente": band_vigente,
                      "contagem_por_ano": contagem_ano, "conferencia": band_confere, "proveniencia": prov_band,
                      "evidencia": ev_band},
        "subsidios": {"anual": subsidios_anual, "ultimo_ano_completo": ultimo_completo, "distribuidoras_ultimo_ano": top_dist,
                      "categorias": [{"categoria": k, "definicao": v_} for k, v_ in CATEGORIAS_SUBSIDIO.items()],
                      "nota": NOTA_SUBSIDIOS, "checagem": checagem, "competencias_futuras_excluidas": futuros,
                      "proveniencia": prov_subs, "evidencia": ev_subs},
        "financiamento_cde": financiamento,
        # incorporações registradas (mudança de perímetro), conferidas nos dados de tarifa
        "incorporacoes": incorporacoes,
        "tarifa_media_fornecimento": tarifa_media,
        # documentos oficiais que sustentam leituras do módulo (trechos conferidos a cada captura)
        "documentos": documentos,
        "conflitos_fonte": {
            "total": len(conflitos),
            "por_subclasse": [{"subgrupo": k[0], "subclasse": k[1], "base": k[2], "n": n_}
                              for k, n_ in sorted(_conta_por(conflitos, ("subgrupo", "subclasse", "base")).items())],
            # só os que afetam a tarifa residencial de aplicação exibida; a lista completa está no CSV
            "b1_residencial": [cf for cf in conflitos if cf["subgrupo"] == "B1" and cf["subclasse"] == "Residencial" and cf["base"] == "TA"],
            "regra": "Vence a vigência de início mais recente; empate, o ato mais recente; empate, a vigência mais curta.",
            "download": _url(CSV_CONF),
        },
        "downloads": [
            {"rotulo": "Tarifas B1 vigentes e custo por perfil (CSV)", "url": _url(CSV_VIGENTES)},
            {"rotulo": "Histórico de tarifas de baixa tensão convencional (CSV)", "url": _url(CSV_HIST)},
            {"rotulo": "Histórico e mudanças da tarifa B1 por distribuidora (JSON)", "url": _url(JSON_HIST)},
            {"rotulo": "Componentes da tarifa B1 (CSV)", "url": _url(CSV_COMP)},
            {"rotulo": "Mudanças da tarifa B1 e IPCA (CSV)", "url": _url(CSV_REAJ)},
            {"rotulo": "Variação em 12, 60 e 120 meses e IPCA (CSV)", "url": _url(CSV_JAN)},
            {"rotulo": "Bandeiras por mês (CSV)", "url": _url(CSV_BAND)},
            {"rotulo": "Subsídios tarifários por ano (CSV)", "url": _url(CSV_SUBS)},
            {"rotulo": "Custeio da CDE por rubrica (CSV)", "url": _url(CSV_CDE)},
            {"rotulo": "IPCA usado (CSV)", "url": _url(CSV_IPCA)},
            {"rotulo": "Vigências sobrepostas na fonte e escolha feita (CSV)", "url": _url(CSV_CONF)},
        ],
    }
    criticas, ressalvas, regras = valida_gold(g)
    if criticas:
        return c.stub(nome, "validação física e de domínio: " + "; ".join(criticas[:5]))
    g["validacao"] = {"regras": regras, "ressalvas": ressalvas}
    return g
