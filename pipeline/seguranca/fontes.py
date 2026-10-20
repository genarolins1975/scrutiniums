"""Constantes das três fontes do painel Segurança pública por UF.

Conferido nas fontes em 20/10/2026.

1. Sinesp VDE (Ministério da Justiça e Segurança Pública, Validador de Dados Estatísticos). Uma planilha
   por ano (bancovde-AAAA.xlsx, de 2015 ao ano corrente), publicada na página "Base de dados e notas
   metodológicas dos gestores estaduais". Uma aba com 14 colunas: uf, municipio, evento, data_referencia
   (primeiro dia do mês do fato), agente, arma, faixa_etaria, feminino, masculino, nao_informado,
   total_vitima, total, total_peso e abrangencia ("Estadual", "Polícia Federal" ou "Polícia Rodoviária
   Federal"). Eventos de vítima trazem total_vitima; eventos de ocorrência ou de atividade trazem total.
   Os eventos de vítima letal vêm por município (com "NÃO INFORMADO" em cada UF); os demais vêm por UF.
   A base não distingue zero de falta de envio: toda combinação de município e mês aparece, com 0 quando
   a UF não informou. O ano corrente é parcial (só os meses já consolidados).

2. SIM (Sistema de Informações sobre Mortalidade, MS/SVSA/CGIAE), pelo TabNet do DATASUS, tabela de
   óbitos por causas externas por UF (sim/cnv/ext10uf.def). Contagem por UF de residência e ano do
   óbito, causa básica pelo grande grupo da CID-10. Dados finais até 2024 (extração de 02/12/2025);
   2025 preliminar (extração de 28/07/2026); 2026 é prévia e fica fora.

3. IBGE, Projeções da População, Revisão 2024 (3ª edição): população por sexo e grupo quinquenal de
   idade, de 2000 a 2070, para o Brasil, as grandes regiões e as 27 UFs, em 1º de julho de cada ano. É a
   mesma série para todos os anos, ajustada ao Censo 2022; por isso as taxas daqui diferem das publicadas
   na época com as estimativas anteriores ao Censo.
"""

# ------------------------------------------------------------------ UFs

# (código IBGE, sigla, nome, região)
UFS = [
    (11, "RO", "Rondônia", "Norte"), (12, "AC", "Acre", "Norte"), (13, "AM", "Amazonas", "Norte"),
    (14, "RR", "Roraima", "Norte"), (15, "PA", "Pará", "Norte"), (16, "AP", "Amapá", "Norte"),
    (17, "TO", "Tocantins", "Norte"), (21, "MA", "Maranhão", "Nordeste"), (22, "PI", "Piauí", "Nordeste"),
    (23, "CE", "Ceará", "Nordeste"), (24, "RN", "Rio Grande do Norte", "Nordeste"), (25, "PB", "Paraíba", "Nordeste"),
    (26, "PE", "Pernambuco", "Nordeste"), (27, "AL", "Alagoas", "Nordeste"), (28, "SE", "Sergipe", "Nordeste"),
    (29, "BA", "Bahia", "Nordeste"), (31, "MG", "Minas Gerais", "Sudeste"), (32, "ES", "Espírito Santo", "Sudeste"),
    (33, "RJ", "Rio de Janeiro", "Sudeste"), (35, "SP", "São Paulo", "Sudeste"), (41, "PR", "Paraná", "Sul"),
    (42, "SC", "Santa Catarina", "Sul"), (43, "RS", "Rio Grande do Sul", "Sul"), (50, "MS", "Mato Grosso do Sul", "Centro-Oeste"),
    (51, "MT", "Mato Grosso", "Centro-Oeste"), (52, "GO", "Goiás", "Centro-Oeste"), (53, "DF", "Distrito Federal", "Centro-Oeste"),
]
SIGLAS = [u[1] for u in UFS]
SIGLA_DO_CODIGO = {u[0]: u[1] for u in UFS}
BRASIL = "BR"

# primeiro ano do painel: o Sinesp VDE começa em 2015
PRIMEIRO_ANO = 2015

# ------------------------------------------------------------------ Sinesp VDE

URL_PAGINA_VDE = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/"
    "base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023"
)
URL_ARQUIVO_VDE = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/"
    "dnsp-base-de-dados/bancovde-{ano}.xlsx/@@download/file"
)
URL_NOTAS_VDE = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/"
    "notas-dos-gestores-estaduais"
)
COLUNAS_VDE = (
    "uf", "municipio", "evento", "data_referencia", "agente", "arma", "faixa_etaria", "feminino",
    "masculino", "nao_informado", "total_vitima", "total", "total_peso", "abrangencia",
)
# só os registros das polícias estaduais: as linhas da Polícia Federal e da Rodoviária Federal têm outra
# cobertura (rodovias federais, crimes federais) e somá-las às dos estados misturaria perímetros
ABRANGENCIA = "Estadual"

# (id, nome na fonte, campo somado, grupo, título na tela, unidade, denominador da taxa)
# denominador: "populacao" (residentes da UF), "mulheres" (residentes do sexo feminino) ou None (sem taxa:
# a população não é a base de risco, como armas apreendidas ou agentes do Estado mortos)
EVENTOS = [
    ("homicidio", "Homicídio doloso", "total_vitima", "letalidade", "Homicídio doloso", "vítimas", "populacao"),
    ("latrocinio", "Roubo seguido de morte (latrocínio)", "total_vitima", "letalidade", "Latrocínio (roubo seguido de morte)", "vítimas", "populacao"),
    ("lesao_morte", "Lesão corporal seguida de morte", "total_vitima", "letalidade", "Lesão corporal seguida de morte", "vítimas", "populacao"),
    ("intervencao", "Morte por intervenção de Agente do Estado", "total_vitima", "letalidade", "Morte por intervenção de agente do Estado", "vítimas", "populacao"),
    ("agente", "Morte de Agente do Estado", "total_vitima", "letalidade", "Morte de agente do Estado", "vítimas", None),
    ("esclarecer", "Mortes a esclarecer (sem indício de crime)", "total_vitima", "letalidade", "Morte a esclarecer, sem indício de crime", "vítimas", "populacao"),
    ("tentativa_homicidio", "Tentativa de homicídio", "total_vitima", "letalidade", "Tentativa de homicídio", "vítimas", "populacao"),
    ("feminicidio", "Feminicídio", "total_vitima", "mulheres", "Feminicídio", "vítimas", "mulheres"),
    ("tentativa_feminicidio", "Tentativa de feminicídio", "total_vitima", "mulheres", "Tentativa de feminicídio", "vítimas", "mulheres"),
    ("estupro", "Estupro", "total_vitima", "mulheres", "Estupro", "vítimas", "populacao"),
    ("estupro_vulneravel", "Estupro de vulnerável", "total_vitima", "mulheres", "Estupro de vulnerável", "vítimas", "populacao"),
    ("furto_veiculo", "Furto de veículo", "total", "patrimonio", "Furto de veículo", "ocorrências", "populacao"),
    ("roubo_veiculo", "Roubo de veículo", "total", "patrimonio", "Roubo de veículo", "ocorrências", "populacao"),
    ("roubo_carga", "Roubo de carga", "total", "patrimonio", "Roubo de carga", "ocorrências", None),
    ("roubo_if", "Roubo a instituição financeira", "total", "patrimonio", "Roubo a instituição financeira", "ocorrências", None),
    ("desaparecidos", "Pessoa Desaparecida", "total_vitima", "resposta", "Pessoas desaparecidas", "registros de desaparecimento", "populacao"),
    ("localizados", "Pessoa Localizada", "total_vitima", "resposta", "Pessoas localizadas", "registros de localização", "populacao"),
    ("armas", "Arma de Fogo Apreendida", "total", "resposta", "Armas de fogo apreendidas", "armas", None),
    ("mandados", "Mandado de prisão cumprido", "total", "resposta", "Mandados de prisão cumpridos", "registros de mandado cumprido", None),
]
IDS_EVENTOS = [e[0] for e in EVENTOS]
EVENTO_DO_NOME = {e[1]: e for e in EVENTOS}

# faixa plausível do total nacional de homicídio doloso num ano completo (vítimas): fora dela a coleta é
# tratada como planilha trocada ou truncada (2015 a 2025 ficaram entre 31 mil e 56 mil)
FAIXA_HOMICIDIO_BRASIL = (15_000, 80_000)
# uma revisão da base que mude o total nacional de homicídio doloso de um ano completo em mais que isto,
# em relação ao seed publicado, retém a publicação para conferência
REVISAO_MAXIMA = 0.10

# ------------------------------------------------------------------ SIM (TabNet)

URL_TABNET_FORM = "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sim/cnv/ext10uf.def"
URL_TABNET = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sim/cnv/ext10uf.def"
URL_NOTAS_SIM = "http://tabnet.datasus.gov.br/cgi/sim/Obitos_Causas_Ext_1996_2012.pdf"
# grande grupo da CID-10 no formulário: (id, valor do campo SGrande_Grupo_CID10, rótulo esperado, sexo)
CONSULTAS_SIM = [
    ("agressoes", "4", "X85-Y09 Agress", None),
    ("agressoes_mulheres", "4", "X85-Y09 Agress", "2"),
    ("indeterminadas", "5", "Y10-Y34 Eventos cuja inten", None),
    ("externas", "TODAS_AS_CATEGORIAS__", None, None),
]
FAIXA_AGRESSOES_BRASIL = (20_000, 80_000)

# ------------------------------------------------------------------ IBGE

URL_PROJECAO = "https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/projecoes_2024_tab2_grupo_quinquenal.xlsx"
URL_PROJECAO_METODO = (
    "https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/"
    "Serie_Relatorios_Metotodologicos_v40_Projecoes_da_Populacao_Brasil_e_Unidades_da_Federacao_Revisao_2024_3a_Edicao.pdf"
)
GRUPOS_IDADE = 19  # 00-04 a 85-89 e 90+
ROTULO_PROJECAO = "Projeções da População, Revisão 2024"
BASE_PROJECAO = "ajustada ao Censo 2022"
FAIXA_POP_BRASIL = (190_000_000, 230_000_000)

# ------------------------------------------------------------------ regra de ausência

# Um ano de uma UF num evento é "sem registro" (ausência, não zero) quando os 12 meses vêm zerados e o
# esperado seria de pelo menos LIMIAR_ANO registros, pela taxa nacional do ano ou pela média da própria UF
# nos anos com registro. Num ano com registros, os meses zerados tornam o ano "incompleto" (total não
# publicado) quando a chance de haver tantos meses zerados por acaso, com a média mensal do próprio ano
# (modelo de Poisson, meses independentes), é menor que PROB_MESES_ZERADOS. Ex.: um mês zerado num ano com
# média de 12 por mês é ausência; um mês zerado num ano com média de 4 pode ser zero de verdade.
LIMIAR_ANO = 12
PROB_MESES_ZERADOS = 0.01

# ------------------------------------------------------------------ Siconfi (despesa dos governos estaduais)

# DCA, Anexo I-E (Despesa por Função), entregue por cada estado e pelo DF até 30 de abril do ano seguinte e
# retificável a qualquer tempo. Só o governo estadual: a despesa da União (Polícia Federal, Polícia
# Rodoviária Federal, Fundo Nacional de Segurança Pública) e a dos municípios (guardas municipais) ficam de
# fora. No DF, as polícias Civil e Militar e o Corpo de Bombeiros são pagos pela União, pelo Fundo
# Constitucional do Distrito Federal, fora do orçamento distrital.
API_SICONFI = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
DOC_SICONFI = "https://www.tesourotransparente.gov.br/consultas/consultas-siconfi/siconfi-api-de-dados-abertos"
ANEXO_DCA = "DCA-Anexo I-E"
CONTA_SEGURANCA = "06 - Segurança Pública"
# o nome da linha de total mudou em 2017: "Despesas (Exceto Intraorçamentárias)" até 2016
CONTAS_TOTAL = ("Despesas Exceto Intraorçamentárias", "Despesas (Exceto Intraorçamentárias)")
COLUNA_DESPESA = "Despesas Liquidadas"
COD_CONTA_DESPESA = "TotalDespesas"
# faixa plausível da participação da função 06 na despesa liquidada do estado (%) e da despesa por
# habitante (R$ correntes); fora dela o valor é tratado como erro de coleta ou de declaração
FAIXA_PARTICIPACAO = (0.5, 30.0)
FAIXA_POR_HABITANTE = (20.0, 5_000.0)
