"""Constantes da fonte: IBGE, IPCA, tabela 7060 do SIDRA (a partir de janeiro de 2020).

Conferido na API em 20/10/2026 (metadados em servicodados.ibge.gov.br/api/v3/agregados/7060/metadados):

- variáveis: 63 (variação mensal, %), 69 (variação acumulada no ano, %), 2265 (variação acumulada em 12
  meses, %) e 66 (peso mensal, %);
- classificação 315 (geral, grupo, subgrupo, item e subitem), 457 categorias: índice geral (nível 0),
  9 grupos (nível 1), 19 subgrupos, 51 itens e 377 subitens (nível 4);
- níveis territoriais N1 (Brasil), N7 (10 regiões metropolitanas) e N6 (6 municípios): as 16 áreas de
  abrangência do IPCA;
- períodos de 202001 a 202609, cada um com a data de divulgação ("modificacao").

A variação em 12 meses de janeiro a novembro de 2020 é "..." (não disponível) nesta tabela: a janela de
12 meses começaria em 2019, ano da estrutura de pesos anterior (POF 2008-2009, tabela 1419). A série em
12 meses do painel começa, por isso, em dezembro de 2020; a de variação mensal, em janeiro de 2020. As
tabelas antigas não são emendadas a esta.
"""

TABELA = "7060"
URL_TABELA = "https://sidra.ibge.gov.br/tabela/7060"
URL_METADADOS = "https://servicodados.ibge.gov.br/api/v3/agregados/7060/metadados"
URL_PERIODOS = "https://servicodados.ibge.gov.br/api/v3/agregados/7060/periodos"
URL_VALORES = "https://apisidra.ibge.gov.br/values/t/7060/n1/all/n7/all/n6/all"
# calendário de divulgações do IBGE; 9256 é o produto "Índice Nacional de Preços ao Consumidor Amplo"
URL_CALENDARIO = "https://servicodados.ibge.gov.br/api/v3/calendario/9256"
URL_METODO = "https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html"

V_MENSAL, V_ANO, V_DOZE, V_PESO = "63", "69", "2265", "66"
VARIAVEIS = (V_MENSAL, V_ANO, V_DOZE, V_PESO)

GERAL = "7169"
# os nove grupos, na ordem e com o número do IBGE (o primeiro dígito do código de cada subitem)
GRUPOS = [
    ("7170", "1", "Alimentação e bebidas"),
    ("7445", "2", "Habitação"),
    ("7486", "3", "Artigos de residência"),
    ("7558", "4", "Vestuário"),
    ("7625", "5", "Transportes"),
    ("7660", "6", "Saúde e cuidados pessoais"),
    ("7712", "7", "Despesas pessoais"),
    ("7766", "8", "Educação"),
    ("7786", "9", "Comunicação"),
]
IDS_GRUPOS = [g[0] for g in GRUPOS]
GRUPO_DO_NUMERO = {n: gid for gid, n, _ in GRUPOS}

PRIMEIRO_MES = "202001"
# meses sem variação em 12 meses nesta tabela (a janela cairia na estrutura de pesos anterior)
SEM_DOZE_MESES = {f"2020{m:02d}" for m in range(1, 12)}

BRASIL = "1"
# As 16 áreas de abrangência, com o código do SIDRA. Uma área nova ou ausente na fonte reprova a coleta:
# a integração de outra área é decisão de método (nome, tipo e comparabilidade), não mudança automática.
AREAS = [
    # (código, nome curto, UF, tipo, rótulo por extenso)
    ("1", "Brasil", None, "pais", "Brasil"),
    ("1501", "Belém", "PA", "regiao_metropolitana", "Região metropolitana de Belém"),
    ("2301", "Fortaleza", "CE", "regiao_metropolitana", "Região metropolitana de Fortaleza"),
    ("2601", "Recife", "PE", "regiao_metropolitana", "Região metropolitana do Recife"),
    ("2901", "Salvador", "BA", "regiao_metropolitana", "Região metropolitana de Salvador"),
    ("3101", "Belo Horizonte", "MG", "regiao_metropolitana", "Região metropolitana de Belo Horizonte"),
    ("3201", "Grande Vitória", "ES", "regiao_metropolitana", "Região metropolitana da Grande Vitória"),
    ("3301", "Rio de Janeiro", "RJ", "regiao_metropolitana", "Região metropolitana do Rio de Janeiro"),
    ("3501", "São Paulo", "SP", "regiao_metropolitana", "Região metropolitana de São Paulo"),
    ("4101", "Curitiba", "PR", "regiao_metropolitana", "Região metropolitana de Curitiba"),
    ("4301", "Porto Alegre", "RS", "regiao_metropolitana", "Região metropolitana de Porto Alegre"),
    ("1200401", "Rio Branco", "AC", "municipio", "Município de Rio Branco"),
    ("2111300", "São Luís", "MA", "municipio", "Município de São Luís"),
    ("2800308", "Aracaju", "SE", "municipio", "Município de Aracaju"),
    ("5002704", "Campo Grande", "MS", "municipio", "Município de Campo Grande"),
    ("5208707", "Goiânia", "GO", "municipio", "Município de Goiânia"),
    ("5300108", "Brasília", "DF", "municipio", "Brasília"),
]
IDS_AREAS = [a[0] for a in AREAS]

# Faixas plausíveis, em %. Fora delas a publicação é retida e uma pessoa confere a fonte. Os extremos de
# jan/2020 a set/2026 foram -2,12 e 2,40 (geral, no mês), -8,62 e 9,37 (grupos, no mês), 1,11 e 14,82
# (geral, 12 meses) e -10,80 e 29,10 (grupos, 12 meses).
FAIXA = {
    "geral_mensal": (-5.0, 5.0),
    "grupo_mensal": (-25.0, 25.0),
    "geral_doze": (-10.0, 30.0),
    "grupo_doze": (-40.0, 60.0),
    "subitem_doze": (-90.0, 400.0),
}
# Tolerâncias, em pontos percentuais: soma dos pesos (publicados com 4 casas), encadeamento das variações
# mensais (2 casas) contra a de 12 meses publicada e soma das contribuições contra o índice.
TOL_PESOS = 0.01
TOL_ENCADEAMENTO = 0.1
TOL_CONTRIBUICOES = 0.1

# Destaques de produtos e serviços: só subitens com pelo menos este peso no orçamento da área (em %).
PESO_MINIMO_DESTAQUE = 0.2
