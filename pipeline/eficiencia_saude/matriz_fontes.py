"""Matriz de viabilidade das fontes de Saúde: o que foi testado, o que se publica e por quê.

Cada linha registra uma medida candidata, a fonte, o acesso efetivamente testado em 09/10/2026 a partir do ambiente de coleta, a cobertura
nas 26 capitais, o período e a decisão (publicar, publicar com ressalva, apenas contexto, não publicar), com o fundamento. A existência de um portal
não comprova que a série seja extraível e comparável: o que não foi acessado está dito como tal. Alimenta a seção "Fontes e decisões" de Dados e métodos.
"""

PUBLICAR = "publicar"
RESSALVA = "publicar com ressalva"
CONTEXTO = "apenas contexto"
NAO = "não publicar"

MATRIZ = [
    # recursos
    ("F01", "Despesa liquidada na função 10, exceto intraorçamentárias (nominal e real)", "Siconfi, DCA Anexo I-E", "API de dados abertos, HTTP 200, 130 chamadas", "130 de 130", "2021 a 2025",
     RESSALVA, "Existe nos 130 pares, com cinco estágios. Política de conferência 1.2 com o RREO e a MSC: 125 conferem, 2 com diferença menor, 1 reconciliado pela MSC, 1 de perímetro distinto, 1 pendente. A DCA de 2025 já está entregue pelas 26 capitais."),
    ("F02", "Despesa em Saúde por habitante", "DCA e IBGE", "Mesmo acesso; IBGE conferido ao vivo no SIDRA (tabelas 6579 e 4714)", "130 de 130", "2021 a 2025", RESSALVA,
     "A população de 2021 é estimativa pré Censo e a de 2023 é censitária; as variações que as envolvem são bloqueadas. O campo de população da própria DCA é de outra safra e não é usado."),
    ("F03", "Composição por subfunção (301 a 306, 122 e demais)", "DCA Anexo I-E", "Mesmo acesso", "130 de 130 fecham com o total", "2021 a 2025", RESSALVA,
     "Publicada só se a soma reconcilia com o total. Linha ausente não vira zero (a subfunção 306 só tem linha em poucos pares)."),
    ("F04", "Composição por natureza (pessoal, outras correntes, capital)", "Siconfi, MSC de dezembro, função 10", "API de dados abertos, HTTP 200, 130 respostas", "116 de 130 reconciliam com a DCA", "2021 a 2025", RESSALVA,
     "Categorias completas e exclusivas só onde a MSC (saldo líquido C menos D, sem modalidade 91) reproduz a DCA. Em 14 pares a abertura não é publicada, com a diferença registrada. Em 123 de 130 pares a DCA é gerada da própria matriz: conferência de consistência, não de fontes independentes."),
    ("F05", "Empenhado, pago e restos a pagar da função 10", "DCA Anexo I-E", "Mesmo acesso", "130 de 130 (restos a pagar: linha ausente em 13 e 5 pares)", "2021 a 2025", CONTEXTO,
     "O estágio de referência é o liquidado. Ordem dos estágios violada em um par (Porto Velho 2023), registrada em medição."),
    ("F06", "Despesa intraorçamentária em Saúde", "RREO 02 e MSC (modalidade 91)", "Mesmo acesso", "130 de 130 (sempre positiva, de 0,1% a 31,1% da função na DCA)", "2021 a 2025", CONTEXTO,
     "Fica fora da DCA e nunca é somada a ela; o rótulo do bloco intra do RREO 02 mudou entre 2022 e 2023, e a leitura usa o código da conta."),
    ("F07", "Percentual da receita de impostos e transferências aplicado em ASPS (XVI ÷ III)", "SIOPS, RREO Anexo 12 (API de consulta pública)", "HTTPS, HTTP 200, 130 chamadas; o Anexo 12 não existe na API do Siconfi (0 de 130)", "130 de 130", "2021 a 2025", RESSALVA,
     "Informado pelo município e homologado no SIOPS: o OBEE confere a aritmética (XVI = XII − XIII − XIV − XV, percentual = XVI ÷ III) e não refaz o conteúdo do que é ASPS. A recomposição do numerador pela MSC (fonte 500 e informação complementar 1002, MCASP 5.5.1) reproduz o total de ASPS exato em apenas 34 de 101 pares (2022 a 2025): não usada."),
    ("F08", "Valor aplicado em ASPS e base de cálculo (III)", "SIOPS, RREO Anexo 12", "Mesmo acesso", "130 de 130", "2021 a 2025", RESSALVA,
     "Estágio empenhado no último bimestre. A base foi refeita com a DCA Anexo I-C em 82 de 104 pares (2022 a 2025, dentro de 0,1%); em 2021 o plano de contas da receita era outro."),
    ("F09", "Despesa total em Saúde por fonte de recursos", "SIOPS, despesas por subfunção (API)", "HTTPS, HTTP 200, 130 chamadas", "130 de 130 (soma das fontes fecha o total)", "2021 a 2025", CONTEXTO,
     "Perímetro declarado pelo município e estágio empenhado: o total do SIOPS reconcilia com DCA mais intraorçamentárias em apenas 59 de 130 pares. Fonte própria, nunca somada à DCA."),
    ("F10", "Indicadores prontos do SIOPS (1.1 a 3.2)", "SIOPS, API de indicadores", "HTTPS, HTTP 200", "130 de 130", "2021 a 2025", NAO,
     "A população do SIOPS é defasada em relação ao exercício; o indicador 2.1 (despesa por habitante) não é publicado, e os demais repetem o que já se publica com fonte primária."),
    ("F11", "Despesa de aplicação direta em Saúde pela MSC (ponte como a de Educação)", "MSC", "Mesmo acesso", "118 de 130 reconciliam com a DCA", "2021 a 2025", NAO,
     "A atribuição de baldes por modalidade (organizações sociais, consórcios, pessoal) pesa muito mais na Saúde e exigiria regra própria validada; não publicada."),
    ("F12", "Custo por atendimento, consulta ou internação", "Nenhuma", "Não aplicável", "Não aplicável", "Não aplicável", NAO,
     "Numerador e denominador de processos diferentes: a despesa da função não corresponde à produção de nenhum serviço."),
    ("F13", "Contexto internacional: gasto nacional em saúde por habitante (OMS, Banco Mundial)", "API do Banco Mundial (indicadores de contas nacionais de saúde)", "Testada em 09/10/2026: respostas intermitentes, sem dado obtido", "Não aplicável", "Não aplicável", NAO,
     "Não obtido nesta rodada. O gasto nacional inclui União, estados, municípios e setor privado, perímetro diferente do gasto municipal: não seria meta nem base para déficit. Fica como expansão."),
    # estrutura e APS
    ("E01", "UBS ativas de tipo 01 e 02: retrato por natureza, gestão e atendimento SUS", "CNES, arquivo diário do OpenDataSUS (S3)", "HTTP 200, 56 MB, 638.547 linhas; a contagem de UBS públicas da competência mais recente da API de dados abertos coincide em 21 das 26 capitais (nas outras cinco as datas de referência diferem; medição M03)", "26 de 26 (3.180 ativas, 3.052 públicas, 2.895 públicas com SUS)", "Retrato de 09/10/2026", RESSALVA,
     "Sem competência nem versão: a data de captura é a única referência. A esfera administrativa do arquivo repete a gestão; público é a natureza jurídica (código iniciado em 1). Gestão não equivale a propriedade."),
    ("E02", "UBS públicas ativas em dezembro, por 10 mil habitantes", "CNES, API de dados abertos (família com competência)", "HTTP 200; uma chamada por estabelecimento (co_cnes com 7 dígitos)", "26 de 26", "Dezembro de 2021 a 2025", RESSALVA,
     "Só acompanha os estabelecimentos que hoje têm tipo 01 ou 02: um estabelecimento reclassificado ou renumerado não entra (viés declarado). A lista de UBS da API não serve de inventário (inclui 493 desabilitadas e omite 172 ativas)."),
    ("E03", "Equipes de Saúde da Família e de Atenção Primária, por tipo", "Relatório APS, serviço /cobertura/aps", "HTTPS, HTTP 200, JSON sem autenticação; serviço sem contrato publicado", "26 de 26, 67 competências cada", "Dezembro de 2021 a 2025", RESSALVA,
     "Contagem do registro do serviço; critérios de validação e financiamento mudaram no período. Não é cobertura efetiva nem pessoas atendidas."),
    ("E04", "Cobertura potencial estimada da APS", "Relatório APS, Nota Técnica nº 2/2025", "Mesmo acesso", "26 de 26", "Dezembro de 2022 a 2025 (2021 fora das comparações)", RESSALVA,
     "A fórmula reproduz todas as linhas de 2022 em diante e não as de 2021. Sem teto de 100%. A cobertura da AB (2007 a 2020) e a do Previne Brasil (2020 a 2024) são outros métodos e não se emendam. Meses recentes do serviço têm cadastro incompleto: só dezembros fechados."),
    ("E05", "Cobertura de agentes comunitários, saúde bucal e eMulti", "Relatório APS e dados abertos do SUS", "HTTP 200", "26 de 26", "Séries de períodos e métodos distintos", CONTEXTO,
     "Parâmetros verificados só em Belo Horizonte, linha duplicada em uma competência, quebra de método da saúde bucal em 2023: não entram nesta entrega."),
    ("E06", "Cadastro vinculado e indicadores de desempenho do Previne Brasil", "API de dados abertos", "HTTP 200", "26 de 26", "Cadastro de 04/2021 a 12/2024; indicadores só 2024Q1 a Q3", NAO,
     "Programa encerrado em 2024 e série de indicadores curta; sem ICSAP no programa."),
    ("E07", "Avaliação por quadrimestre do Siaps", "Siaps (serviço público)", "HTTP 200, 26 capitais", "26 de 26", "Quatro quadrimestres (2025Q1 a 2026Q1)", CONTEXTO,
     "Método novo, série de quatro pontos: não publicado até haver nota técnica estável e mais períodos."),
    ("E08", "Profissionais e vínculos do CNES, com carga horária", "CNES, API de dados abertos", "HTTP 200, mas um vínculo por chamada, com o nome do profissional em claro", "Inviável (cerca de 160 mil chamadas por competência)", "Não aplicável", NAO,
     "Dado pessoal que o OBEE não armazena. O caminho agregado (arquivos mensais do FTP do DATASUS) não respondeu a partir do ambiente (reset de conexão). Vínculo não é pessoa. Com arquivos agregados fornecidos, o indicador pode ser implementado com rótulo fiel (vínculos ou carga horária)."),
    ("E09", "Leitos existentes, SUS e UTI", "CNES, arquivos anuais do OpenDataSUS", "HTTP 200", "26 de 26", "2007 a 2026, mensal", CONTEXTO,
     "As capitais são polo regional e leitos por habitante distorce; avaliação própria numa expansão."),
    # atendimento e resultados
    ("R01", "Internações por condições sensíveis à atenção primária (ICSAP), número e taxa por 100 mil, por residência", "RIPSA MRB.4.02, Portal de Dados Abertos do SUS (S3)", "HTTP 200, 46 MB", "26 de 26 em todos os anos", "2021 a 2024 (2025 não publicado)", RESSALVA,
     "Residência confirmada; só SUS; AIH tipo 1 sem hospital dia; ano de processamento. A regra da lista de ICSAP foi conferida na fase de viabilidade contra um espelho de terceiros do SIH; os resultados dessa conferência não estão guardados no repositório e nenhum número publicado depende dela. Os valores publicados reproduzem o arquivo do RIPSA em 104 de 104 pares. Sem ficha de qualificação nem histórico de versões."),
    ("R02", "Participação das ICSAP nas internações SUS por residência", "RIPSA MRB.4.02 e COB.2.01", "HTTP 200", "26 de 26", "2021 a 2024", CONTEXTO,
     "Composição do conjunto de internações, não desempenho."),
    ("R03", "Cobertura de planos de saúde privados", "RIPSA COB.5.01 (base ANS)", "HTTP 200, 27 MB", "26 de 26", "Dezembro de 2021 a 2024", CONTEXTO,
     "Contexto obrigatório ao lado da taxa: o SIH cobre só internações pagas pelo SUS. Não serve para subtrair beneficiários da população."),
    ("R04", "ICSAP recalculada do SIH/RD (espelho PySUS) e 2025 provisório", "Espelho de terceiros em Parquet", "1.620 de 1.620 arquivos de 2021 a 2025 responderam 200", "26 de 26", "2021 a 07/2026", CONTEXTO,
     "Usada só como conferência independente: espelho de terceiros hospedado fora do país, sem dicionário oficial. Os 12 meses mais recentes do SIH são provisórios; 2025 não entra."),
    ("R05", "ICSAP por local de internação", "SIH", "Não obtido", "Não aplicável", "Não aplicável", NAO,
     "A série por local de internação não foi obtida. Em capitais que são polo regional, a ocorrência no município tende a diferir da residência dos moradores; o perímetro de residência é o adequado ao leitor e é o publicado. O módulo não apresenta razão entre os dois perímetros."),
    ("R06", "Produção e atendimentos da APS (atendimentos individuais, procedimentos, visitas)", "Siaps e Sisab", "Consulta pública do Siaps: HTTP 400 sem corpo; Sisab: formulário JSF, sem API; cubos do Siaps na API: uma competência", "Não aplicável", "Não aplicável", NAO,
     "Sem série oficial documentada e estável por município. Atendimentos, procedimentos e pessoas atendidas não se somam como produtividade genérica."),
    ("R07", "Filas e tempo de espera", "Nenhuma comparável", "Não pesquisado nesta rodada", "Não aplicável", "Não aplicável", NAO,
     "Lacuna registrada: volume de consultas não substitui acesso oportuno. Fica para expansão."),
    ("R08", "Taxa de internação SUS por habitante (COB.2.01) e valor médio da AIH (REC.3.02)", "RIPSA", "HTTP 200", "26 de 26", "2000 a 2024", NAO,
     "A taxa geral é utilização de serviços e sofre do mesmo problema de planos privados; o denominador do valor médio da AIH é o dobro do total de internações, sem ficha que explique."),
    # contexto demográfico
    ("D01", "População residente por município", "IBGE, SIDRA 6579 e 4714 e relação de 2023", "HTTP 200; conferência ao vivo sem diferença", "26 de 26", "2021 a 2025", RESSALVA,
     "A população do RIPSA e da SVSA é a do Ministério da Saúde, 2,6% a 10,1% maior que a do Censo 2022 nas capitais; as duas taxas de ICSAP são publicadas. Aracaju 2025: o IBGE revisou a estimativa e a série do Ministério ainda não acompanhou."),
]

CAMPOS = ["id", "medida", "fonte", "acesso_testado", "cobertura", "periodo", "decisao", "fundamento"]


def linhas():
    return [dict(zip(CAMPOS, l)) for l in MATRIZ]
