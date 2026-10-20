"""Constantes das três fontes do painel Previdência e INSS, conferidas em 20/10/2026.

1. Boletim Estatístico da Previdência Social (BEPS), Ministério da Previdência Social. Mensal, em planilha Excel 97
   (.xls), publicado cerca de um mês depois do mês de referência (o de agosto de 2026, Vol. 32 nº 08, foi gravado em
   29/09/2026). Endereço: .../boletins-da-previdencia-social/{ano}/beps{mm}{aaaa}_final.xls. Três tabelas entram:
   - 14: evolução dos benefícios emitidos por grandes grupos (RGPS, assistenciais e BLE): cada dezembro de 2000 a 2007
     e todos os meses desde janeiro de 2008, quantidade e valor;
   - 15: benefícios emitidos no mês por grupo e espécie (aposentadorias, pensões, auxílios, BPC e os demais), com a
     clientela urbana e rural;
   - 19: benefícios do RGPS emitidos no mês por unidade da Federação, com a clientela urbana e rural. Exclui os
     créditos sem localização definida (nota da própria tabela) e os benefícios assistenciais.

2. Estatísticas municipais, "Emitidos por Municípios", Ministério da Previdência Social. Anual (posição de dezembro), em
   planilha .xlsx, publicada no meio do ano seguinte (a de 2025 em 25/05/2026). Endereço estável:
   .../previdencia-social/arquivos/ben_municipios_especie_{ano}.xlsx. Há arquivos de 2017 e de 2019 em diante (o de
   2018 responde 404); o de 2017 não declara o valor como líquido e tem outro desenho, por isso a série começa em 2019.
   Três definições oficiais decidem como cada número é nomeado: o município é o do órgão pagador (a agência que paga),
   não o de residência; a quantidade conta créditos emitidos, não pessoas; o valor é líquido de descontos, como o
   empréstimo consignado.

3. Resultado do Tesouro Nacional (RTN), série histórica, Tesouro Nacional. Mensal, planilha .xlsx no CKAN do Tesouro
   Transparente (conjunto ab56485b-9c40-4efb-8563-9ce3e1973c4b; a edição de julho de 2026 foi publicada em
   27/08/2026). Tabela 2.2 (anual, R$ milhões correntes): arrecadação líquida e benefícios do RGPS, com a divisão urbana
   e rural, BPC/LOAS e RMV; tabela 2.1-A: PIB nominal e as mesmas linhas em % do PIB, usadas para conferir a conta.
"""
from __future__ import annotations

ORGAO_MPS = "Ministério da Previdência Social"
ORGAO_TESOURO = "Tesouro Nacional"

BASE_MPS = "https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social"
PAGINA_BEPS = f"{BASE_MPS}/Dados-estatisticos-previdencia-social-e-inss/boletins-da-previdencia-social"
URL_BEPS = PAGINA_BEPS + "/{ano}/beps{mes:02d}{ano}_final.xls"
PAGINA_MUNICIPIOS = f"{BASE_MPS}/emitidos-municipios-2023"
URL_MUNICIPIOS = f"{BASE_MPS}/arquivos/ben_municipios_especie_{{ano}}.xlsx"
PRIMEIRO_ANO_MUNICIPIOS = 2019

CKAN_RTN = "https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=ab56485b-9c40-4efb-8563-9ce3e1973c4b"
PAGINA_RTN = "https://www.tesourotransparente.gov.br/ckan/dataset/resultado-do-tesouro-nacional"
PAGINA_RESULTADO_RGPS = f"{BASE_MPS}/resultados-do-rgps"

NOME_BEPS = "Boletim Estatístico da Previdência Social (BEPS)"
NOME_MUNICIPIOS = "Benefícios emitidos por município, por grupo de espécie"
NOME_RTN = "Resultado do Tesouro Nacional, série histórica"

# Unidades da Federação pelo prefixo de dois dígitos do código IBGE do município.
UFS = [
    ("11", "RO", "Rondônia", "Norte"), ("12", "AC", "Acre", "Norte"), ("13", "AM", "Amazonas", "Norte"),
    ("14", "RR", "Roraima", "Norte"), ("15", "PA", "Pará", "Norte"), ("16", "AP", "Amapá", "Norte"),
    ("17", "TO", "Tocantins", "Norte"), ("21", "MA", "Maranhão", "Nordeste"), ("22", "PI", "Piauí", "Nordeste"),
    ("23", "CE", "Ceará", "Nordeste"), ("24", "RN", "Rio Grande do Norte", "Nordeste"), ("25", "PB", "Paraíba", "Nordeste"),
    ("26", "PE", "Pernambuco", "Nordeste"), ("27", "AL", "Alagoas", "Nordeste"), ("28", "SE", "Sergipe", "Nordeste"),
    ("29", "BA", "Bahia", "Nordeste"), ("31", "MG", "Minas Gerais", "Sudeste"), ("32", "ES", "Espírito Santo", "Sudeste"),
    ("33", "RJ", "Rio de Janeiro", "Sudeste"), ("35", "SP", "São Paulo", "Sudeste"), ("41", "PR", "Paraná", "Sul"),
    ("42", "SC", "Santa Catarina", "Sul"), ("43", "RS", "Rio Grande do Sul", "Sul"), ("50", "MS", "Mato Grosso do Sul", "Centro-Oeste"),
    ("51", "MT", "Mato Grosso", "Centro-Oeste"), ("52", "GO", "Goiás", "Centro-Oeste"), ("53", "DF", "Distrito Federal", "Centro-Oeste"),
]
UF_DO_PREFIXO = {p: s for p, s, _n, _r in UFS}
NOME_UF = {s: n for _p, s, n, _r in UFS}
REGIAO_UF = {s: r for _p, s, _n, r in UFS}
SIGLAS = [s for _p, s, _n, _r in UFS]
REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"]

# Grupos do arquivo municipal, na ordem das colunas de quantidade guardadas no seed (q) e de valor (v). Os totais
# (previdenciários e geral) não são guardados: são somas conferidas na coleta e refeitas na gold.
CAMPOS_Q = ["apo_idade", "apo_invalidez", "apo_tempo", "pensoes", "auxilios", "outros_prev", "assistenciais"]
CAMPOS_V = ["aposentadorias", "pensoes", "auxilios", "outros_prev", "assistenciais"]

# Rótulos das colunas do arquivo municipal (normalizados) e o campo a que correspondem.
COLUNAS_MUNICIPIOS = {
    "codigo ibge": "cod", "cod ibge": "cod",
    "nome": "nome", "municipio": "nome", "uf": "uf",
    "total de aposentadorias": "aposentadorias",
    "aposentadorias por idade": "apo_idade",
    "aposentadorias por invalidez": "apo_invalidez",
    "aposentadorias por tempo de contribuicao": "apo_tempo",
    "pensoes por morte": "pensoes",
    "auxilios": "auxilios",
    "outros beneficios previdenciarios": "outros_prev",
    "total de beneficios previdenciarios": "total_prev",
    "beneficios assistenciais e de legislacao especifica": "assistenciais",
    "total": "total",
}

# Tabela 15 do BEPS: a sequência exata das linhas (rótulo normalizado), com o identificador e o pai. Uma linha nova,
# fora de ordem ou renomeada reprova a coleta: a classificação das espécies é decisão de método, não mudança automática.
TABELA_15 = [
    ("total", "total", None),
    ("rgps", "beneficios do rgps", "total"),
    ("previdenciarios", "previdenciarios", "rgps"),
    ("aposentadorias", "aposentadorias", "previdenciarios"),
    ("apo_idade", "idade", "aposentadorias"),
    ("apo_invalidez", "invalidez", "aposentadorias"),
    ("apo_tempo", "tempo de contribuicao", "aposentadorias"),
    ("pensoes", "pensoes por morte", "previdenciarios"),
    ("auxilios", "auxilios", "previdenciarios"),
    ("aux_doenca", "doenca", "auxilios"),
    ("aux_acidente", "acidente", "auxilios"),
    ("aux_reclusao", "reclusao", "auxilios"),
    ("salario_maternidade", "salario maternidade", "previdenciarios"),
    ("prev_outros", "outros", "previdenciarios"),
    ("acidentarios", "acidentarios", "rgps"),
    ("acid_apo_invalidez", "aposentadorias por invalidez", "acidentarios"),
    ("acid_pensao", "pensao por morte", "acidentarios"),
    ("acid_aux_doenca", "auxilio doenca", "acidentarios"),
    ("acid_aux_acidente", "auxilio acidente", "acidentarios"),
    ("acid_aux_suplementar", "auxilio suplementar", "acidentarios"),
    ("assistenciais", "beneficios assistenciais", "total"),
    ("loas", "amparos assistenciais loas", "assistenciais"),
    ("loas_idoso", "idoso", "loas"),
    ("loas_deficiencia", "portador de deficiencia", "loas"),
    ("loas_outros", "outros beneficios assistenciais", "loas"),
    ("rmv", "rendas mensais vitalicias", "assistenciais"),
    ("rmv_idade", "idade", "rmv"),
    ("rmv_invalidez", "invalidez", "rmv"),
    ("ble", "beneficios de legislacao especifica ble", "total"),
]

# Linhas do RTN (tabela 2.2, anual): o código do início do rótulo e uma palavra que o rótulo precisa conter.
LINHAS_RTN = {
    "arrecadacao": ("1.3", "arrecadacao liquida para o rgps"),
    "arrecadacao_urbana": ("1.3.1", "urbana"),
    "arrecadacao_rural": ("1.3.2", "rural"),
    "despesa_total": ("4.", "despesa total"),
    "beneficios": ("4.1", "beneficios previdenciarios"),
    "beneficios_urbano": ("4.1.1", "urbano"),
    "sentencas_urbano": ("4.1.1.1", "sent"),
    "beneficios_rural": ("4.1.2", "rural"),
    "sentencas_rural": ("4.1.2.1", "sent"),
    "bpc_rmv": ("4.3.05", "loas"),
    "sentencas_bpc": ("4.3.05.1", "bpc"),
    "compensacao": ("4.3.08", "compensacao ao rgps"),
}
PRIMEIRO_ANO_RTN = 1997

# Faixas plausíveis e limites de revisão. Fora delas a publicação é retida e uma pessoa confere a fonte.
FAIXA_BENEFICIOS_PIB = (2.0, 12.0)        # benefícios do RGPS em % do PIB (1997 a 2025: de 5,0 a 8,4)
FAIXA_VALOR_MEDIO = (100.0, 20000.0)      # R$ por benefício no mês, em qualquer grupo e estado
REVISAO_MAXIMA_MUNICIPIOS = 0.01          # um ano fechado não pode mudar mais de 1% no total do Brasil
REVISAO_MAXIMA_RTN = 0.02                 # um ano fechado do RTN não pode mudar mais de 2% numa linha
MUNICIPIOS_MIN, MUNICIPIOS_MAX = 5565, 5575
