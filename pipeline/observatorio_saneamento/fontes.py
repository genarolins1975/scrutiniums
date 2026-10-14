"""Catálogo das fontes primárias do Observatório do Saneamento.

Cada entrada diz de onde o arquivo vem, o que contém e qual o grão da
observação. O coletor só baixa o que está aqui; a gold só lê o recorte
versionado em seed/, que guarda o sha256 de cada original.
"""

SINISA_BASE = (
    "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/"
    "saneamento/sinisa/resultados-sinisa/"
)
SINISA_PAGINA = SINISA_BASE + "resultados-sinisa-2025"

# Arquivos ZIP do SINISA 2025 (ano de referência 2024).
SINISA_ZIPS = {
    "agua": SINISA_BASE + "SINISA_Resultados_Ref2024.zip",
    "esgoto": SINISA_BASE + "SINISA_ESGOTO_Planilhas_2024.zip",
}

# Planilhas usadas, por chave estável. "padrao" é um trecho do nome do arquivo
# dentro do ZIP (nomes com acentos codificados como #U00e7 no próprio ZIP).
SINISA_PLANILHAS = {
    # grão: município (consolidação oficial de todos os prestadores do município)
    "agua_indicadores_municipio": ("agua", "AGUA_Indicadores_Base Municipal"),
    "agua_tecnica_municipio": ("agua", "AGUA_Informações_Gestão Técnica de Água_Base Municipal"),
    "agua_financeira_municipio": ("agua", "AGUA_Informações_Gestão Administrativa e Financeira_Base Municipal"),
    "esgoto_indicadores_municipio": ("esgoto", "ESGOTO_Indicadores_Base Municipal"),
    "esgoto_tecnica_municipio": ("esgoto", "ESGOTO_Informações_Gestão Técnica de Esgoto_Base Municipal"),
    "esgoto_financeira_municipio": ("esgoto", "ESGOTO_Informações_Gestão Administrativa e Financeira_Base Municipal"),
    # grão: prestador × município (prestadores locais e regionais)
    "agua_indicadores_prestador": ("agua", "AGUA_Indicadores_Locais e Regionais"),
    "agua_tecnica_prestador": ("agua", "AGUA_Informações_Gestão Técnica de Água_Locais e Regionais"),
    "agua_financeira_prestador": ("agua", "AGUA_Informações_Gestão Administrativa e Financeira_Locais e Regionais"),
    "esgoto_tecnica_prestador": ("esgoto", "ESGOTO_Informações_Gestão Técnica de Esgoto_Locais e Regionais"),
    "esgoto_financeira_prestador": ("esgoto", "ESGOTO_Informações_Gestão Administrativa e Financeira_Locais e Regionais"),
    # grão: prestador (demonstrações declaradas ao SINISA)
    "agua_balanco_prestador": ("agua", "AGUA_Informações_Balanço_Locais e Regionais"),
    "esgoto_balanco_prestador": ("esgoto", "ESGOTO_Informações_Balanço_Locais e Regionais"),
    # grão: UF, macrorregião e Brasil (consolidação oficial; os mesmos arquivos do OBEE)
    "agua_indicadores_uf": ("agua", "AGUA_Indicadores_UF_MR_BR"),
    "agua_tecnica_uf": ("agua", "AGUA_Informações_Gestão Técnica de Água_UF_MR_BR"),
    "agua_financeira_uf": ("agua", "AGUA_ Informações_Gestão Administrativa e Financeira_UF_MR_BR"),
    "esgoto_indicadores_uf": ("esgoto", "ESGOTO_Indicadores_UF_MR_BR"),
    "esgoto_tecnica_uf": ("esgoto", "ESGOTO_Informações_Gestão Técnica de Esgoto_UF_MR_BR"),
    "esgoto_financeira_uf": ("esgoto", "ESGOTO_Informações_Gestão Administrativa e Financeira_UF_MR_BR"),
    # grão: estação de tratamento de esgoto
    "esgoto_ete": ("esgoto", "ESGOTO_Informações_Estações de Tratamento de Esgoto"),
    # grão: unidade de tratamento de água
    "agua_uta": ("agua", "AGUA_Informações_Unidades de Tratamento de Água"),
}

# Módulo Gestão Municipal (planilha avulsa, sem ZIP): plano, política, regulador e
# prestadores declarados pelo município, com CNPJ.
SINISA_GESTAO_MUNICIPAL = SINISA_BASE + "copy_of_SINISA_GESTAO_MUNICIPAL_Informacoes_2024.xlsx"

SIDRA = "https://apisidra.ibge.gov.br/values"
SIDRA_METADADOS = "https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados"
IBGE_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

# Tabelas do Censo Demográfico usadas. Variável e classificação conforme os
# metadados do SIDRA consultados em 14/10/2026.
CENSO = {
    # 2022: moradores em domicílios particulares permanentes ocupados
    "agua_2022": {"tabela": 6894, "variavel": 382, "classificacao": 1821,
                  "fixas": "/c58/95253/c86/95251", "ano": 2022},
    "esgoto_2022": {"tabela": 7555, "variavel": 382, "classificacao": 11558,
                    "fixas": "/c58/95253/c86/95251", "ano": 2022},
    # 2022: domicílios particulares permanentes ocupados
    "agua_dom_2022": {"tabela": 6803, "variavel": 381, "classificacao": 1821, "fixas": "", "ano": 2022},
    "esgoto_dom_2022": {"tabela": 6805, "variavel": 381, "classificacao": 11558, "fixas": "", "ano": 2022},
}

# Estimativa da população residente (IBGE), a mesma usada pelo SINISA em DFE0001.
POPULACAO_ESTIMADA = {"tabela": 6579, "variavel": 9324, "ano": 2024}

# CadÚnico por município e mês (MDS, SAGI, API MI Social, a base do VIS Data).
# Elegibilidade da tarifa social (Lei 14.898/2024, art. 2º): renda familiar per
# capita até meio salário-mínimo. Dezembro de 2024 casa com o ano de referência do
# SINISA; o mês mais recente publicado serve de contexto. O código do município
# vem com 6 dígitos (sem o verificador).
MISOCIAL = "https://aplicacoes.mds.gov.br/sagi/servicos/misocial"
CADUNICO = {
    "meses": ["202412", "202609"],
    "campos": [
        "codigo_ibge", "anomes_s", "sigla_uf",
        "cadun_qtd_familias_cadastradas_i",
        "cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i",
        "cadun_qtd_familias_cadastradas_rfpc_acima_meio_sm_i",
        "cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i",
        "cadun_qtd_pessoas_cadastradas_rfpc_ate_meio_sm_i",
    ],
}
