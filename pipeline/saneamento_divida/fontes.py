"""Constantes da fonte e das regras do capítulo 7.1 (dívida e alavancagem), conferidas em 20/10/2026.

Fonte única: CVM, Portal de Dados Abertos (https://dados.cvm.gov.br), conjunto "Companhias Abertas".

1. Cadastro de companhias abertas: cad_cia_aberta.csv (CSV, separador ";", latin-1), atualizado diariamente. Traz CNPJ,
   código CVM, situação do registro (ATIVO ou CANCELADA, com a data), categoria e setor de atividade.
2. DFP, Demonstrações Financeiras Padronizadas: um ZIP por ano de referência (dfp_cia_aberta_AAAA.zip), desde 2010.
   Anual, entregue até três meses depois do fim do exercício; a CVM regrava os ZIPs dos últimos anos quando chegam
   reapresentações (em 18/10/2026 os de 2022 a 2026). Cada ZIP traz o índice de documentos (com a versão e o link do
   documento) e um CSV por demonstração e escopo: balanço ativo (BPA), balanço passivo (BPP), resultado (DRE), valor
   adicionado (DVA), fluxo de caixa (DFC) e mutações do patrimônio, consolidado (con) e individual (ind).
3. ITR, Informações Trimestrais: um ZIP por ano (itr_cia_aberta_AAAA.zip), desde 2011, com os três primeiros
   trimestres (o quarto é a DFP). Entregue até 45 dias depois do fim do trimestre. O resultado e o valor adicionado vêm
   acumulados no ano; o balanço, na data do trimestre.

Os valores vêm na escala declarada pela companhia (ESCALA_MOEDA: MIL ou UNIDADE), em reais nominais. O pipeline guarda
tudo em milhares de reais.
"""
from __future__ import annotations

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA"
URL_CADASTRO = f"{BASE}/CAD/DADOS/cad_cia_aberta.csv"
URL_DFP = BASE + "/DOC/DFP/DADOS/dfp_cia_aberta_{ano}.zip"
URL_ITR = BASE + "/DOC/ITR/DADOS/itr_cia_aberta_{ano}.zip"
PAGINA_DFP = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp"
PAGINA_ITR = "https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr"
PAGINA_CADASTRO = "https://dados.cvm.gov.br/dataset/cia_aberta-cad"
UA = "Scrutiniums coleta cvm saneamento divida"

# Primeiro ano da DFP estruturada no portal e primeiro ano do ITR usado. O trimestre de 2015 precisa da DFP de 2014
# para os 12 meses do EBITDA; por isso a série trimestral começa no primeiro trimestre de 2015.
PRIMEIRO_ANO_DFP = 2010
PRIMEIRO_ANO_ITR = 2015

# Demonstrações e contas lidas. Códigos do plano padronizado da CVM (iguais para todas as companhias não financeiras).
DEMONSTRACOES = ("BPA", "BPP", "DRE", "DVA")
CONTAS = {
    "BPA": ("1", "1.01", "1.01.01", "1.01.02", "1.02"),
    "BPP": (
        "2", "2.01", "2.01.04", "2.01.04.01", "2.01.04.02", "2.01.04.03",
        "2.02", "2.02.01", "2.02.01.01", "2.02.01.02", "2.02.01.03",
        "2.03", "2.03.09",
    ),
    "DRE": ("3.01", "3.05", "3.06", "3.06.01", "3.06.02", "3.11"),
    "DVA": ("7.04.01",),
}
ESCOPOS = ("con", "ind")

# Universo. Operadoras: CNPJ declarado por algum município como prestador de água ou esgoto no módulo Gestão Municipal
# do SINISA 2024 (o mesmo critério do controle societário, capítulo 7) e com DFP ou ITR na base. Holdings de grupo:
# pessoa jurídica que aparece como controladora na cadeia de controle declarada no Formulário de Referência de uma
# operadora, com setor de saneamento no cadastro da CVM e com DFP ou ITR na base. Nenhum casamento é feito por nome.
SETOR_SANEAMENTO = "Saneamento"

# Nome curto de exibição por CNPJ (identificação sempre pelo CNPJ; sem entrada aqui, vale a denominação do cadastro).
NOME_CURTO = {
    "43776517000180": "Sabesp",
    "17281106000103": "Copasa",
    "76484013000145": "Sanepar",
    "82508433000117": "Casan",
    "07040108000157": "Cagece",
    "33352394000104": "Cedae",
    "92802784000190": "Corsan",
    "01616929000102": "Saneago",
    "46119855000137": "Sanasa Campinas",
    "02382073000110": "Prolagos",
    "04089570000150": "Águas Guariroba",
    "27157474000106": "Águas de Teresina",
    "39580673000101": "BRK Ambiental Maceió",
    "42292007000174": "Rio+ Saneamento BL 3",
    "42310775000103": "Águas do Rio 1",
    "42644220000106": "Águas do Rio 4",
    "42353180000135": "Iguá Rio de Janeiro",
    "08827501000158": "Aegea Saneamento",
    "24396489000120": "BRK Ambiental Participações",
    "08159965000133": "Iguá Saneamento",
    "15385166000140": "Equipav Saneamento",
    "25089509000183": "Saneatins",
    "09123654000187": "Cagepa",
    "45456117000112": "Águas do Sertão",
}

# Companhias que têm de estar no universo e na DFP mais recente da base; a falta de qualquer uma retém a publicação
# (mudança de registro, CNPJ ou critério precisa de decisão humana).
ESPERADAS = (
    "43776517000180",  # Sabesp
    "17281106000103",  # Copasa
    "76484013000145",  # Sanepar
    "82508433000117",  # Casan
    "07040108000157",  # Cagece
    "33352394000104",  # Cedae
    "92802784000190",  # Corsan
    "01616929000102",  # Saneago
    "08827501000158",  # Aegea
    "24396489000120",  # BRK Ambiental Participações
    "08159965000133",  # Iguá Saneamento
)
UNIVERSO_MINIMO = 15

# Tolerâncias das conferências contábeis, em unidades da escala publicada (os valores são inteiros na escala da
# companhia; a folga cobre arredondamento das somas feitas pela própria companhia).
TOLERANCIA_ESCALA = 2
TOLERANCIA_RELATIVA = 1e-5

# Guarda contra escala trocada (valores em milhares declarados como unidade de real): nenhuma prestadora com
# demonstrações na CVM tem ativo total abaixo de R$ 50 milhões; abaixo disso a demonstração reprova (salvo conhecida).
ATIVO_MINIMO_MIL = 50_000

# Inconsistências das próprias demonstrações publicadas, conferidas uma a uma no seed em 20/10/2026. O ponto fica fora da
# série, como ausência com o motivo escrito pela validação (nunca corrigido à mão). Qualquer inconsistência que não
# esteja aqui retém a publicação até alguém conferir o documento na CVM e decidir.
# Chave: (CNPJ, fonte, data de referência) → tipos de problema aceitos.
INCONSISTENCIAS_CONHECIDAS = {
    ("27157474000106", "DFP", "2021-12-31"): {"divida_subcontas"},  # Águas de Teresina: 2.02.01 sem as debêntures
    ("25089509000183", "ITR", "2022-09-30"): {"passivo"},  # Saneatins: passivo total não fecha com os grupos
    ("39580673000101", "ITR", "2022-09-30"): {"passivo"},  # BRK Maceió: passivo total não fecha com os grupos
    # ativo total abaixo do mínimo plausível com escala "UNIDADE": valores que parecem estar em milhares
    ("09123654000187", "DFP", "2010-12-31"): {"escala"},  # Cagepa
    ("33352394000104", "DFP", "2010-12-31"): {"escala"},  # Cedae
    ("92802784000190", "DFP", "2010-12-31"): {"escala"},  # Corsan
    ("92802784000190", "DFP", "2011-12-31"): {"escala"},
    ("92802784000190", "DFP", "2012-12-31"): {"escala"},
    ("24396489000120", "DFP", "2018-12-31"): {"escala"},  # BRK Ambiental Participações
    ("24396489000120", "DFP", "2019-12-31"): {"escala"},
    ("24396489000120", "DFP", "2020-12-31"): {"escala"},
    ("24396489000120", "ITR", "2020-03-31"): {"escala"},
    ("24396489000120", "ITR", "2020-06-30"): {"escala"},
    ("24396489000120", "ITR", "2020-09-30"): {"escala"},
    ("24396489000120", "ITR", "2021-03-31"): {"escala"},
    ("24396489000120", "ITR", "2021-06-30"): {"escala"},
    ("24396489000120", "ITR", "2021-09-30"): {"escala"},
    ("42353180000135", "ITR", "2021-06-30"): {"escala"},  # Iguá Rio de Janeiro, antes do início da operação
}
