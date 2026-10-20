"""Fontes do painel Conectividade: três conjuntos de dados abertos da Anatel, lidos dos arquivos zip que a agência publica.

Os zips são grandes (a telefonia móvel passa de 3 GB), mas o servidor da Anatel aceita leitura por faixa de bytes
(HTTP Range). A coleta lê só os membros necessários: o diretório do zip, o CSV do ano corrente, a série de densidade
e os totais. Cada membro lido fica registrado no seed com tamanho, CRC do zip e sha256 do conteúdo descompactado.

Conferido em 20/10/2026:
- acessos_banda_larga_fixa.zip (1,05 GB, modificado em 08/10/2026): Acessos_Banda_Larga_Fixa_<ano>.csv, um por ano,
  com uma linha por prestadora, município, faixa e velocidade contratada, tecnologia, meio de acesso, tipo de pessoa e
  produto; Densidade_Banda_Larga_Fixa.csv (acessos por 100 domicílios, Brasil, UF e município, mensal desde 03/2007);
  Acessos_Banda_Larga_Fixa_Total.csv (Brasil, mensal).
- acessos_telefonia_movel.zip (3,24 GB, modificado em 08/10/2026): Acessos_Telefonia_Movel_<ano>_<1S|2S>.csv, por
  semestre, com modalidade de cobrança, tecnologia e geração (2G a 5G), tipo de pessoa e produto (inclusive M2M);
  Densidade_Telefonia_Movel.csv (acessos por 100 habitantes, mensal desde 02/2005); Acessos_Telefonia_Movel_Total.csv.
- cobertura_movel.zip (335 MB, modificado em 10/10/2026): Cobertura_<AAAA>_<MM>_Municipios.csv, um por trimestre desde
  11/2021, com a parte dos moradores, dos domicílios e da área de cada município coberta por cada operadora e
  tecnologia (setores censitários, Censo 2010 até 2024 e Censo 2022 depois); evolucao_cobertura_brasil.csv.

Densidade: a Anatel publica "Densidade" nos dois conjuntos de acessos. O Densidades.pdf de 2020, dentro dos zips, diz
"por 100 domicílios" para a banda larga fixa e "por 100 habitantes" para a telefonia móvel, mas os números publicados
dividem pela população nos dois casos (08/2026: 57.893.114 acessos fixos ÷ 27,03 × 100 = 214 milhões, a população do
país, não os 90,7 milhões de domicílios do Censo 2022; São Paulo: 4.872.850 ÷ 40,91 × 100 = 11,9 milhões). A validação
cruzada confere isso município a município contra os moradores do Censo 2022, e o painel chama as duas de "acessos por
100 habitantes". Só o mês mais recente da densidade é usado: a série mensal tem meses vazios e valores incompatíveis
(ver coleta._densidade). Nada aqui recalcula densidade com outra população.
"""
from __future__ import annotations

ORGAO = "Anatel"
PAGINA_DADOS_ABERTOS = "https://www.gov.br/anatel/pt-br/dados/dados-abertos"
LICENCA = "Dados abertos da Anatel (Licença Aberta para Bases de Dados da Anatel, uso livre com atribuição)"
USER_AGENT = "Scrutiniums/1.0 (observatorio; pipeline/conectividade)"

FIXA = {
    "id": "fixa",
    "nome": "Acessos de banda larga fixa (Serviço de Comunicação Multimídia)",
    "url": "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_banda_larga_fixa.zip",
    "pagina": "https://informacoes.anatel.gov.br/paineis/acessos/banda-larga-fixa",
    "membro_acessos": "Acessos_Banda_Larga_Fixa_{ano}.csv",
    "membro_densidade": "Densidade_Banda_Larga_Fixa.csv",
    "membro_total": "Acessos_Banda_Larga_Fixa_Total.csv",
}

MOVEL = {
    "id": "movel",
    "nome": "Acessos de telefonia móvel (Serviço Móvel Pessoal)",
    "url": "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_telefonia_movel.zip",
    "pagina": "https://informacoes.anatel.gov.br/paineis/acessos/telefonia-movel",
    "membro_acessos": "Acessos_Telefonia_Movel_{ano}_{semestre}.csv",
    "membro_densidade": "Densidade_Telefonia_Movel.csv",
    "membro_total": "Acessos_Telefonia_Movel_Total.csv",
}

COBERTURA = {
    "id": "cobertura",
    "nome": "Cobertura das redes móveis por município (moradores, domicílios e área cobertos)",
    "url": "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/infraestrutura/cobertura_movel.zip",
    "pagina": "https://informacoes.anatel.gov.br/paineis/infraestrutura/cobertura-movel",
    "membro_municipios": "Cobertura_{ano}_{mes}_Municipios.csv",
    "membro_brasil": "evolucao_cobertura_brasil.csv",
}

# Códigos que aparecem no arquivo de cobertura e não são municípios (massas d'água do Rio Grande do Sul).
NAO_MUNICIPIOS = {"4300001": "Lagoa Mirim", "4300002": "Lagoa dos Patos"}

# UF pelo prefixo de dois dígitos do código IBGE.
UF_DO_PREFIXO = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
    "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
    "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}
NOME_UF = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima",
    "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
}
UFS = sorted(NOME_UF)

# Campos por município no seed da banda larga fixa (mês mais recente), na ordem da lista.
CAMPOS_FIXA = (
    "acessos", "fibra", "coaxial", "radio", "satelite", "metalico",
    "vel_ate_10", "vel_10_25", "vel_25_100", "vel_100_mais",
    "pessoa_fisica", "prestadoras", "maior_grupo", "maior_grupo_acessos",
)
# Faixas de velocidade contratada (Mbps) usadas aqui, pelo campo "Velocidade" da Anatel; os limites são fechados à esquerda.
FAIXAS_VELOCIDADE = ((0.0, "vel_ate_10"), (10.0, "vel_10_25"), (25.0, "vel_25_100"), (100.0, "vel_100_mais"))
MEIOS = {"Fibra": "fibra", "Cabo Coaxial": "coaxial", "Rádio": "radio", "Satélite": "satelite", "Cabo Metálico": "metalico"}

# Campos por município no seed da telefonia móvel (mês mais recente).
# "acessos" é a soma de todas as linhas da Anatel (inclusive M2M e pontos de serviço); o total que a Anatel publica no
# arquivo de totais e usa na densidade por 100 habitantes exclui M2M e PONTO_DE_SERVICO: é "acessos - m2m - ponto_servico"
# (conferido em 08/2026: 280.471.197 - 36.095.458 - 23.454.358 = 220.921.381, o total do arquivo).
CAMPOS_MOVEL = ("acessos", "g2", "g3", "g4", "g5", "pre", "pos", "pessoa_fisica", "m2m", "ponto_servico", "maior_grupo", "maior_grupo_acessos")
PRODUTOS_FORA_DO_TOTAL = ("M2M", "PONTO_DE_SERVICO")
GERACOES = {"2G": "g2", "3G": "g3", "4G": "g4", "5G": "g5"}

# Tecnologias da cobertura que a gold publica (na ordem) e o rótulo da Anatel de cada uma.
TECNOLOGIAS_COBERTURA = (("todas", "Todas"), ("g2", "2G"), ("g3", "3G"), ("g4", "4G"), ("g5", "5G"), ("g4g5", "4G5G"))
MEDIDAS_COBERTURA = ("moradores", "domicilios", "area")
OPERADORA_TODAS = "Todas"

# Limites das validações. São decisões de engenharia declaradas aqui, não números inferidos da fonte.
MUNICIPIOS_MIN = 5565
MUNICIPIOS_MAX = 5575
DENSIDADE_FIXA_BRASIL = (15.0, 60.0)     # acessos por 100 domicílios: 27,0 em 08/2026
DENSIDADE_MOVEL_BRASIL = (80.0, 200.0)   # acessos por 100 habitantes: cerca de 130 em 2026
MESES_MAX_ATRASO_ACESSOS = 5             # o mês mais recente não pode estar a mais de 5 meses da captura
MESES_MAX_ATRASO_COBERTURA = 8           # a cobertura é trimestral; um trimestre atrasado ainda vale
REVISAO_MAXIMA_MESMO_MES = 0.02          # o mesmo mês recoletado não muda mais de 2% no total do Brasil
VARIACAO_MAXIMA_MES_SEGUINTE = 0.05      # o mês novo não difere mais de 5% do anterior no total do Brasil
TOLERANCIA_POPULACAO_COBERTURA = 0.005   # soma dos moradores dos municípios contra o Brasil do arquivo de evolução
DENSIDADE_MUNICIPIO_MAX = 1000.0         # acessos por 100 habitantes num município: linhas registradas numa cidade pequena passam
                                         # de 100 (Inocência, MS, 08/2026: 42.892 linhas para 8.404 moradores, 450 por 100)
RAZAO_POPULACAO = (0.6, 1.8)             # (acessos ÷ densidade × 100) ÷ moradores do Censo 2022, por município
FRACAO_MAXIMA_FORA_DA_RAZAO = 0.02       # até 2% dos municípios com 1.000 acessos ou mais fora da razão acima
