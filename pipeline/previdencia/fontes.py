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

4. Anuário Estatístico da Previdência Social (AEPS), Ministério da Previdência Social (conferido em 21/10/2026). Anual,
   publicado em outubro do ano seguinte (a 33ª edição, AEPS 2024, em 22/10/2025, com as tabelas atualizadas na mesma
   data), em páginas HTML, uma por tabela, em .../previdencia-social/arquivos/aeps-{edição}/... (os mesmos endereços
   servem a edição 2023, com 2021 a 2023: o coletor procura a edição seguinte no mesmo desenho). Entra só o que o
   BEPS e o arquivo municipal não trazem:
   - A.1 e A.14: benefícios concedidos no ano, por grupo de espécie e por UF, com a clientela urbana e rural;
   - B.1, B.2 e B.3: benefícios emitidos em dezembro (quantidade e valor) e valor emitido no ano inteiro, por grupo de
     espécie, separando o Regime Geral, os assistenciais e os encargos previdenciários da União (EPU);
   - 43.1 e 43.2: rede de unidades do INSS por UF (dezembro) e atendimentos mês a mês nas unidades, por UF.
   Ficam de fora B.13 a B.17 (emitidos por UF, em dezembro e mês a mês), que repetem o que o painel já mostra pela
   tabela 19 do BEPS e pelo arquivo municipal. Cada tabela traz três anos (ou os doze meses do último), e o Anuário não
   define o traço: ele vira ausência (null), nunca zero.
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
NOME_AEPS = "Anuário Estatístico da Previdência Social (AEPS)"

# AEPS: página das edições, raiz de cada edição e o caminho de cada tabela dentro dela (os mesmos de 2023 e 2024; as
# partes "2017-2019" e "2013-2019" dos endereços são herança do portal, não o período da tabela).
PAGINA_AEPS = f"{BASE_MPS}/Dados-estatisticos-previdencia-social-e-inss/anuarios-da-previdencia-social"
BASE_AEPS = f"{BASE_MPS}/arquivos/aeps-{{edicao}}"
_B = "secao-i-beneficios/subsecao-b-beneficios-emitidos/beneficios-emitidos"
_A = "secao-i-beneficios/subsecao-a-beneficios-concedidos/capitulo-1-aposentadorias"
_AT = "secao-xii-atendimento/capitulo-43-2013-atendimento"
# id: (caminho, forma, unidade). Formas: "especies" (33 linhas de grupos de espécie, total/urbana/rural x três anos),
# "uf_clientela" (Brasil, regiões e UFs, total/urbana/rural x três anos), "rede" (unidades por tipo, dezembro do último
# ano) e "meses" (os doze meses do último ano).
TABELAS_AEPS = {
    "a.1": (f"{_A}/a-1-quantidade-de-beneficios-concedidos-por-clientela-segundo-os-grupos-de-especies", "especies", "benefícios"),
    "a.14": (f"{_A}/a-14-quantidade-de-beneficios-concedidos-por-clientela-segundo-as-grandes-regioes-e-unidades-da-federacao", "uf_clientela", "benefícios"),
    "b.1": (f"{_B}/b-1-quantidade-de-beneficios-emitidos-por-clientela-segundo-os-grupos-de-especies-posicao-em-dezembro-2017-2019", "especies", "benefícios"),
    "b.2": (f"{_B}/b-2-valor-de-beneficios-emitidos-por-clientela-segundo-os-grupos-de-especies-posicao-em-dezembro-2017-2019", "especies", "R$ mil"),
    "b.3": (f"{_B}/b-3-valor-de-beneficios-emitidos-por-clientela-segundo-os-grupos-de-especies-acumulado-no-ano-2017-2019", "especies", "R$ mil"),
    "43.1": (f"{_AT}/43-1-unidades-de-atendimentos-do-inss-segundo-as-grandes-regioes-e-unidades-da-federacao-2013-2019", "rede", "unidades"),
    "43.2": (f"{_AT}/43-2-quantidade-mensal-de-atendimentos-nas-unidades-do-inss-2013-2019", "meses", "atendimentos"),
}
PRIMEIRA_EDICAO_AEPS = 2024  # a primeira integrada; edições anteriores não entram na gold

# Tabelas por grupo de espécie (A.1, B.1, B.2, B.3): a sequência exata das 33 linhas (rótulo normalizado), com o
# identificador e o pai. Linha nova, fora de ordem ou renomeada reprova a coleta, como na tabela 15 do BEPS.
ESPECIES_AEPS = [
    ("total", "total", None),
    ("rgps", "beneficios do rgps", "total"),
    ("previdenciarios", "previdenciarios", "rgps"),
    ("aposentadorias", "aposentadorias", "previdenciarios"),
    ("apo_tempo", "tempo de contribuicao", "aposentadorias"),
    ("apo_idade", "idade", "aposentadorias"),
    ("apo_invalidez", "invalidez", "aposentadorias"),
    ("pensoes", "pensao por morte", "previdenciarios"),
    ("auxilios", "auxilios", "previdenciarios"),
    ("aux_doenca", "doenca", "auxilios"),
    ("aux_reclusao", "reclusao", "auxilios"),
    ("aux_acidente", "acidente", "auxilios"),
    ("salario_maternidade", "salario maternidade", "previdenciarios"),
    ("prev_outros", "outros", "previdenciarios"),
    ("salario_familia", "salario familia", "prev_outros"),
    ("abono_permanencia", "abono de permanencia", "prev_outros"),
    ("vantagem_servidor", "vantagem de servidor", "prev_outros"),
    ("acidentarios", "acidentarios", "rgps"),
    ("acid_apo_invalidez", "aposentadoria por invalidez", "acidentarios"),
    ("acid_pensao", "pensao por morte", "acidentarios"),
    ("acid_auxilios", "auxilios", "acidentarios"),
    ("acid_aux_doenca", "doenca", "acid_auxilios"),
    ("acid_aux_acidente", "acidente", "acid_auxilios"),
    ("acid_aux_suplementar", "suplementar", "acid_auxilios"),
    ("assistenciais", "beneficios assistenciais", "total"),
    ("bpc", "amparos assistenciais", "assistenciais"),
    ("bpc_deficiencia", "portador de deficiencia", "bpc"),
    ("bpc_idoso", "idoso", "bpc"),
    ("pmv", "pensao mensal vitalicia", "assistenciais"),
    ("rmv", "rendas mensais vitalicias", "assistenciais"),
    ("rmv_invalidez", "invalidez", "rmv"),
    ("rmv_idade", "idade", "rmv"),
    ("epu", "encargos prev uniao epu", "total"),
]

# Tabela 43.1: as colunas de unidades, na ordem da fonte (rótulo normalizado do cabeçalho, sem as notas).
REDE_AEPS = [
    ("superintendencias", "superintendencia regional"),
    ("gerencias", "gerencia executiva"),
    ("aps_fixas", "fixas"),
    ("aps_adj", "adj"),
    ("aps_ai", "ai"),
    ("aps_tel", "tel"),
    ("aps_moveis", "moveis"),
    ("prevcidade", "prevcidade"),
    ("auditorias", "auditoria regional"),
    ("procuradorias_regionais", "procuradorias regionais"),
    ("procuradorias_seccionais", "procuradorias seccionais"),
    ("corregedorias", "corregedorias regionais"),
]

REVISAO_MAXIMA_AEPS = 0.01                # um ano repetido numa edição nova não pode mudar mais de 1% num total
DIFERENCA_MAXIMA_AEPS_BEPS = 0.0001       # total de dezembro do AEPS contra o BEPS (0,01%); o RGPS tem de ser igual

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
