"""Constantes das fontes do painel Educação nos municípios, conferidas em 20/10/2026.

1. Ideb por município, INEP. Bienal (anos ímpares), divulgado no ano seguinte ao do Saeb: o Ideb 2025 saiu em
   05/08/2026 (data dos arquivos no servidor do INEP; planilhas gravadas em 24/07/2026). Uma planilha .xlsx (e uma .ods
   igual) por etapa dentro de um .zip, com o MD5 publicado ao lado: .../ideb/resultados/divulgacao_anos_iniciais_municipios_{ano}.zip
   e divulgacao_anos_finais_municipios_{ano}.zip. Cada linha é um município e uma rede (Estadual, Municipal, Pública e
   Federal), com a taxa de aprovação (total da etapa e por ano escolar), o indicador de rendimento P, as notas do Saeb
   em matemática e língua portuguesa, a nota média padronizada N, o Ideb observado (N × P) de 2005 a {ano} e as metas do
   primeiro ciclo (2007 a 2021). A nota informativa do Ideb 2025 diz que esta é a última divulgação com a fórmula
   original, que 2023 e 2025 não têm metas e que o resultado do município não é a média das escolas.
2. Ideb por UF e região e Ideb do Brasil, INEP: divulgacao_regioes_ufs_ideb_{ano}.zip e divulgacao_brasil_ideb_{ano}.zip,
   mesmo desenho. A UF não tem linha da rede municipal (só Total, Pública, Estadual e Privada); o Brasil tem.
3. Censo Escolar da Educação Básica, Sinopse Estatística, INEP. Anual; a de 2025 foi gravada em 30/07/2026
   (V2, 232 MB, .xlsx e .ods): .../dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_{ano}.zip.
   Quatro tabelas por município, procuradas pelo título (a numeração muda entre edições): matrículas da educação básica
   por dependência administrativa (1.2 em 2025), da educação infantil por etapa e dependência (1.8), do ensino
   fundamental por etapa e dependência (1.20) e estabelecimentos por dependência (3.2).
4. População residente estimada, IBGE, SIDRA tabela 6579, variável 9324, no ano do Ideb: usada só para o porte do
   município (as sete faixas de população do IBGE) na comparação entre municípios semelhantes.

download.inep.gov.br envia só o certificado folha: a coleta usa o intermediário oficial versionado em
pipeline/contas_estaduais/certificados (contexto_tls), com a raiz do sistema.
"""
from __future__ import annotations

ORGAO_INEP = "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP)"
ORGAO_IBGE = "Instituto Brasileiro de Geografia e Estatística (IBGE)"

PAGINA_IDEB = "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados"
BASE_IDEB = "https://download.inep.gov.br/ideb/resultados"
URL_IDEB_MUNICIPIOS = BASE_IDEB + "/divulgacao_{etapa}_municipios_{ano}.zip"
URL_IDEB_UFS = BASE_IDEB + "/divulgacao_regioes_ufs_ideb_{ano}.zip"
URL_IDEB_BRASIL = BASE_IDEB + "/divulgacao_brasil_ideb_{ano}.zip"
URL_NOTA_IDEB = BASE_IDEB + "/nota_informativa_ideb_{ano}.pdf"
NOME_IDEB = "Índice de Desenvolvimento da Educação Básica (Ideb), resultados por município, UF e Brasil"

PAGINA_SINOPSE = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica"
URL_SINOPSE = "https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_{ano}.zip"
NOME_SINOPSE = "Censo Escolar da Educação Básica, Sinopse Estatística"

PAGINA_SIDRA = "https://sidra.ibge.gov.br/tabela/6579"
URL_SIDRA_MUNICIPIOS = "https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/{ano}"
URL_SIDRA_BRASIL = "https://apisidra.ibge.gov.br/values/t/6579/n1/all/v/9324/p/{ano}"
NOME_SIDRA = "Estimativas da população residente, SIDRA tabela 6579"

# Etapas do Ideb que a rede municipal oferece (o ensino médio é quase todo estadual e fica fora do painel).
ETAPAS = {"ai": "anos_iniciais", "af": "anos_finais"}
NOME_ETAPA = {"ai": "Anos iniciais (1º ao 5º ano)", "af": "Anos finais (6º ao 9º ano)"}

# Redes guardadas por município (a estadual e a federal ficam fora: o painel trata da rede municipal e da pública toda),
# por UF (a planilha da UF não tem a municipal) e no Brasil. Rótulo da fonte, sem as notas entre parênteses.
REDES_MUNICIPIO = {"Municipal": "municipal", "Pública": "publica"}
REDES_UF = {"Pública": "publica", "Estadual": "estadual"}
REDES_BRASIL = {"Municipal": "municipal", "Pública": "publica", "Estadual": "estadual"}

# Códigos das colunas na linha de cabeçalho do INEP (o ano entra no lugar de {a}).
COLUNAS_ANO = {
    "aprov": "VL_APROVACAO_{a}_SI_4",
    "p": "VL_INDICADOR_REND_{a}",
    "mat": "VL_NOTA_MATEMATICA_{a}",
    "port": "VL_NOTA_PORTUGUES_{a}",
    "n": "VL_NOTA_MEDIA_{a}",
    "ideb": "VL_OBSERVADO_{a}",
}
COLUNA_META = "VL_PROJECAO_{a}"
CAMPOS = ["ideb", "n", "mat", "port", "p", "aprov"]
CASAS = {"ideb": 1, "n": 4, "mat": 2, "port": 2, "p": 4, "aprov": 1}

# Marcas que o INEP põe nas notas do Saeb (notas da própria planilha):
#   ND     participantes insuficientes para divulgar o resultado
#   ND*    não divulgação a pedido (Portarias Inep nº 410/2011 e nº 304/2013)
#   ND***  pelo menos 20% do material extraviado, participação insuficiente
#   valor* média calculada com as avaliações estaduais, por extravio de provas
#   valor** média dos alunos no Saeb com participação abaixo de 50%, por extravio de provas
MARCAS_SAEB = {"ND", "ND*", "ND***", "*", "**"}

# Motivo de não haver Ideb da rede num município no ano mais recente (ordem de decisão em gold.motivo).
MOTIVOS = ["sem_matricula", "nao_divulgado", "participacao", "a_pedido", "extravio", "sem_aprovacao", "sem_saeb"]

# Conferência com o Quadro 1 da nota informativa de cada edição: municípios com Ideb calculado, por etapa e rede.
QUADRO_1 = {
    2025: {"ai": {"municipal": 5320, "publica": 5478}, "af": {"municipal": 3292, "publica": 5491}},
}

# Tabelas da Sinopse, procuradas pelo título, e as colunas lidas (posição na linha e o rótulo que o cabeçalho tem de ter
# nessa posição, conferido na coleta: desenho trocado reprova).
TABELAS_CENSO = {
    "basica": {
        "titulo": r"Matr[ií]culas da Educa[cç][aã]o B[aá]sica, por Localiza[cç][aã]o, Depend[eê]ncia Administrativa",
        "colunas": {"mat_total": 4, "mat_publica": 5, "mat_federal": 6, "mat_estadual": 7, "mat_municipal": 8, "mat_privada": 9, "mat_mun_rural": 28},
        "rotulos": {5: "Rede Pública", 6: "Federal", 7: "Estadual", 8: "Municipal", 9: "Rede Privada", 24: "Rural", 28: "Municipal"},
    },
    "infantil": {
        "titulo": r"Matr[ií]culas da Educa[cç][aã]o Infantil, por Etapa de Ensino, Depend[eê]ncia Administrativa",
        "colunas": {"creche_total": 14, "creche_mun": 18, "pre_total": 24, "pre_mun": 28},
        "rotulos": {14: "Creche", 18: "Municipal", 24: "Pré-Escola", 28: "Municipal"},
    },
    "fundamental": {
        "titulo": r"Matr[ií]culas do Ensino Fundamental Regular, por Etapa de Ensino, Depend[eê]ncia Administrativa",
        "colunas": {"ai_total": 14, "ai_publica": 15, "ai_mun": 18, "af_total": 24, "af_publica": 25, "af_mun": 28},
        "rotulos": {14: "Anos Iniciais", 15: "Rede Pública", 18: "Municipal", 24: "Anos Finais", 25: "Rede Pública", 28: "Municipal"},
    },
    "escolas": {
        "titulo": r"Estabelecimentos da Educa[cç][aã]o B[aá]sica, por Localiza[cç][aã]o, Depend[eê]ncia Administrativa",
        "colunas": {"esc_total": 4, "esc_publica": 5, "esc_municipal": 8, "esc_privada": 9, "esc_mun_rural": 28},
        "rotulos": {5: "Rede Pública", 8: "Municipal", 9: "Rede Privada", 24: "Rural", 28: "Municipal"},
    },
}
CAMPOS_CENSO = [c for t in TABELAS_CENSO.values() for c in t["colunas"]]

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
SIGLA_DO_NOME = {n: s for _p, s, n, _r in UFS}
# A planilha do Ideb por UF abrevia três nomes.
SIGLA_DO_NOME.update({"M. G. do Sul": "MS", "R. G. do Norte": "RN", "R. G. do Sul": "RS"})
REGIOES = ["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"]
SIGLAS = [s for _p, s, _n, _r in UFS]

# Faixas de população do IBGE (Perfil dos Municípios Brasileiros), em habitantes: [mínimo, máximo].
PORTES = [
    ("ate5", "Até 5 mil habitantes", 0, 5000),
    ("5a10", "De 5 mil a 10 mil habitantes", 5001, 10000),
    ("10a20", "De 10 mil a 20 mil habitantes", 10001, 20000),
    ("20a50", "De 20 mil a 50 mil habitantes", 20001, 50000),
    ("50a100", "De 50 mil a 100 mil habitantes", 50001, 100000),
    ("100a500", "De 100 mil a 500 mil habitantes", 100001, 500000),
    ("mais500", "Mais de 500 mil habitantes", 500001, None),
]

# Faixas de definição de cada medida (Ideb e N de 0 a 10, escala do Saeb de 0 a 500, P de 0 a 1, aprovação em %). Fora
# delas a publicação é retida e uma pessoa confere a fonte. Valores extremos dentro da faixa existem na fonte (aprovação
# de 0% ou de 8,7% numa rede pequena em 2005, nota de matemática acima de 400 nos anos finais) e não são corrigidos.
FAIXA = {"ideb": (0.0, 10.0), "n": (0.0, 10.0), "mat": (0.0, 500.0), "port": (0.0, 500.0), "p": (0.0, 1.0), "aprov": (0.0, 100.0)}
TOLERANCIA_IDEB = 0.051       # Ideb publicado (uma casa) contra N × P recalculado
MUNICIPIOS_MIN, MUNICIPIOS_MAX = 5565, 5575
REVISAO_MAXIMA_IDEB = 0.2     # um Ideb já publicado não pode mudar mais que isso numa recoleta da mesma edição
