"""Métricas do módulo Dados e metodologia: definição única das medidas publicadas em
public/energia/gold/publicacao.json, catalogo.json e manifesto.json (P067 a P070). As
fórmulas rodam em pipeline/energia/modulos/dados.py, pipeline/energia/catalogo.py,
pipeline/energia/validacoes.py e pipeline/energia/fontes/{silver,publicacao,ckan}_dados.py;
a interface só lê o valor calculado.

Estas medidas descrevem a própria plataforma (o que foi coletado, validado, revisado e
publicado), não o setor elétrico. A fonte delas é o que o pipeline guardou: listagens
dos portais (CKAN do ONS, da ANEEL e da CCEE) versionadas com sha256, package_show da
CCEE versionados no repositório, vintages e coletas dos silvers, as golds e os CSV
publicados. Nenhuma data de captura substitui data do dado; falha de coleta nunca
renova o período disponível.
"""

GOLD = "publicacao.json"
PAGINA = ["/setor-eletrico/dados"]
PAGINA_MET = ["/setor-eletrico/metodologia"]
F_ONS = "catalogo_ckan_ons"
F_ANEEL = "catalogo_ckan_aneel"
F_CCEE = "catalogo_ckan_ccee"
F_SEED = "catalogo_ccee_seed"
F_VERIF = "verificacao_recursos"
F_META = "metadados_fontes"
# "fontes" das medidas sobre os silvers: todos os conjuntos declarados nos REGISTRO dos
# módulos (lidos sem lista fixa); o identificador abaixo nomeia esse universo
F_SILVERS = "silvers_declarados"

_PLATAFORMA = "Medida sobre a própria plataforma, recalculada a cada execução do pipeline; não descreve o setor elétrico."
_HISTORICO = ("Os silvers deste ambiente foram reconstruídos entre 29/09 e 01/10/2026: capturas, falhas e revisões anteriores "
              "a essas datas não estão registradas.")


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINA, "versao_formula": "1.0", "natureza_fonte": "CALCULADO",
            "natureza_transformacao": "CALCULADO"}
    base.update(kw)
    return base


METRICAS = [
    _m(id="dados_estado_catalogo", titulo="Estado do conjunto no catálogo",
       pergunta="Até onde este conjunto chegou: só catalogado, arquivo acessado, integrado, validado ou publicado?",
       definicao=("Última etapa alcançada em sequência na escada catalogado → recurso verificado → integrado → validado → "
                  "publicado; cada etapa exige a sua evidência e uma etapa sem evidência interrompe a escada."),
       unidade="categoria (CATALOGADO, RECURSO VERIFICADO, INTEGRADO, VALIDADO, PUBLICADO)",
       grao_geografico="não se aplica (conjunto de dados)", grao_temporal="por publicação",
       fontes=[F_ONS, F_ANEEL, F_CCEE, F_SEED, F_VERIF, F_SILVERS],
       formula=("estado = última etapa e_k com ok(e_1) ∧ … ∧ ok(e_k); catalogado = listagem do portal, package_show "
                "versionado, REGISTRO com URL e licença ou cadastro manual; recurso verificado = vintage com sha256 ou leitura "
                "parcial com HTTP 200/206; integrado = vintage e conteúdo extraído (ou documento guardado); validado = nenhuma "
                "checagem reprovada do conjunto; publicado = alguma gold consumidora íntegra e não reprovada"),
       regra_agregacao="contagem de conjuntos por estado (resumo.por_estado e catalogo.contagem)",
       dimensoes=["órgão", "tema", "estado", "papel de uso"],
       regras_comparabilidade=["O estado é o desta publicação: um conjunto pode voltar de PUBLICADO para VALIDADO se a gold que o consome "
                               "for reprovada no contrato.",
                               "Uso (indicador, modelo, conferência, contexto, histórico) é outro eixo e não muda o estado."],
       regra_cobertura="Todos os conjuntos das listagens do ONS, da ANEEL e da CCEE, os declarados nos REGISTRO e o cadastro manual.",
       politica_ausencia="Etapa sem evidência é etapa não alcançada; nunca é presumida.",
       validacoes=["escada sem salto: etapa com evidência depois de etapa sem evidência vira ressalva visível (catalogo.saltos)",
                   "publicado conferido contra o relatório de checagens e a varredura das golds (ficha conjuntos_publicados)"],
       limitacoes=["Recurso verificado por requisição parcial lê só os primeiros 64 KB de um arquivo do conjunto.",
                   "Cadastro manual (catalogo_manual.json) fica em CATALOGADO com metadados não verificados na fonte.",
                   _PLATAFORMA]),
    _m(id="dados_estado_recurso", titulo="Estado de cada recurso (arquivo) de um conjunto",
       pergunta="Quais arquivos de um conjunto o pipeline realmente acessou?",
       definicao=("Estado de cada recurso listado pelo portal: herda o estado da integração declarada que o capturou com sha256; "
                  "RECURSO VERIFICADO se foi baixado por outro dataset ou lido por requisição parcial; CATALOGADO nos demais. "
                  "Recurso que sumiu da listagem fica como removido pela fonte."),
       unidade="categoria por recurso; contagem de recursos por estado", grao_geografico="não se aplica",
       grao_temporal="por publicação", fontes=[F_ONS, F_ANEEL, F_CCEE, F_SEED, F_VERIF, F_SILVERS],
       formula="vínculo recurso ↔ captura pela URL normalizada (esquema e host em minúsculas, caminho decodificado, sem barra final)",
       regra_agregacao="contagem por conjunto (recursos_resumo) e por portal (catalogo.recursos)",
       dimensoes=["órgão", "conjunto", "formato", "estado"],
       regras_comparabilidade=["Um conjunto com muitos arquivos anuais e só o ano corrente integrado tem poucos recursos acessados "
                               "sem que isso seja falha: a cobertura de anos está no conjunto do silver."],
       regra_cobertura="Recursos das listagens package_search (ONS, ANEEL, CCEE) ou dos package_show versionados quando a listagem falha.",
       politica_ausencia="Recurso sem captura nem verificação fica CATALOGADO; URL ausente não casa com captura nenhuma.",
       validacoes=["contagem por estado igual à soma das linhas de dados_recursos_<orgao>.csv (teste do módulo)"],
       limitacoes=["URL que muda a cada publicação (token do servidor) quebra o vínculo com a captura anterior.", _PLATAFORMA]),
    _m(id="dados_situacao_atualidade", titulo="Atualidade do conjunto (SLA pela frequência declarada)", versao_formula="1.1",
       pergunta="O conjunto está em dia com a frequência que a própria fonte promete?",
       definicao=("EM DIA quando hoje não passou do prazo do próximo período; ATRASADO quando passou; SEM SLA quando a fonte não "
                  "declara frequência legível (ou o conjunto foi descontinuado); SEM DADO quando não há período de referência nem "
                  "data de publicação informada pela fonte."),
       unidade="categoria; dias de atraso", grao_geografico="não se aplica", grao_temporal="dia da validação (Brasília)",
       fontes=[F_ONS, F_ANEEL, F_CCEE, F_META, F_SILVERS],
       formula=("prazo = fim do período seguinte ao último disponível + tolerância (casos A e C); fim do último período completo "
                "+ período da cadência + tolerância (caso B, e casos D e E quando a data da fonte não acompanha o conteúdo); "
                "publicação informada pela fonte + período da cadência + tolerância (casos D e E). Caso C só quando a frequência "
                "declarada é a rotina do portal (campo 'Schedule de Atualização' do ONS ou horário do dia); cadência declarada "
                "mais curta que o grão fora disso é o caso E. Período corrente parcial (fim depois de hoje) não alonga o prazo: "
                "a base é o último período completo. Tolerâncias: diária 2, semanal 7, quinzenal 15, mensal 60, trimestral 90, "
                "anual 365 dias; dias_atraso = hoje − prazo"),
       regra_agregacao="contagem de conjuntos por situação (resumo.por_situacao)",
       dimensoes=["conjunto", "cadência", "caso da regra"],
       regras_comparabilidade=["Atraso de conjunto diário e de conjunto anual não têm a mesma escala: compare dentro da cadência.",
                               "Caso C usa o grão do dado porque a frequência declarada pelo ONS no campo 'Schedule de "
                               "Atualização' é o horário da rotina do portal ('Diariamente, às 12h e 19h'), não a promessa de um "
                               "período novo por dia.",
                               "Caso E: quando a ANEEL declara 'Mensal', 'Quinzenal' ou 'Trimestral' para um arquivo de grão anual, "
                               "a promessa é de arquivo novo nessa cadência, medida pela data de publicação da fonte; o grão anual "
                               "não pode empurrar o prazo para dois anos depois."],
       regra_cobertura="Conjuntos integrados com frequência declarada no portal, nos metadados da fonte (SIDRA, CKAN da CVM e do MME) ou no REGISTRO do módulo.",
       politica_ausencia="Sem frequência declarada não se inventa uma: SEM SLA. A data da captura nunca entra no cálculo.",
       validacoes=["prazo refeito por outra implementação da regra (aritmética de calendário própria) e comparado com o publicado "
                   "(ficha conjuntos_atrasados)",
                   "último período dos conjuntos com falha de coleta procurado no arquivo original do bronze, com sha256 conferido "
                   "(ficha conjuntos_atrasados)",
                   "casos A a E com datas escritas no teste do módulo, inclusive período corrente parcial e falha de coleta simulada"],
       limitacoes=["Frequência declarada em texto livre é lida por expressões regulares (ckan_dados.frequencias_canonicas).",
                   "A data de modificação informada pela CCEE não acompanha o conteúdo dos arquivos: os casos D e E a substituem pelo "
                   "fim do último período completo quando o arquivo traz período posterior a ela; no caso E, sem data utilizável, SEM DADO.",
                   "No caso E, a data de publicação mede se a fonte reescreveu o arquivo, não se o conteúdo mudou.",
                   _PLATAFORMA]),
    _m(id="dados_completude_interna", titulo="Completude interna das séries de um conjunto",
       pergunta="Há buracos no meio das séries que o conjunto traz?",
       definicao=("Referências distintas presentes divididas pelas esperadas entre a primeira e a última referência de cada série, "
                  "no passo modal do conjunto, somadas sobre as séries."),
       unidade="fração (0 a 1)", grao_geografico="não se aplica", grao_temporal="por conjunto e publicação",
       fontes=[F_SILVERS], numerador="Σ referências distintas presentes em cada série",
       denominador="Σ referências esperadas de cada série entre a primeira e a última, no passo modal",
       formula="completude = Σ presentes ÷ Σ esperadas, limitada a 1",
       regra_agregacao="razão de somas (não média de razões por série)",
       dimensoes=["conjunto", "grão"],
       regras_comparabilidade=["Só se calcula com passo modal seguido por pelo menos metade dos intervalos (cadência regular)."],
       regra_cobertura="Séries de observações numéricas do silver com formato de referência regular (horária, diária, mensal, trimestral, anual).",
       politica_ausencia="Série com cadência irregular ou cadastro sem período: completude não se aplica (campo ausente).",
       validacoes=["série com lacuna conhecida (silver de teste) dá completude < 1 com o número exato de faltas (teste do módulo)"],
       limitacoes=["Não acusa série que começou depois ou terminou antes (usina nova, distribuidora extinta): só lacunas internas.",
                   "Nas séries horárias, a referência é a hora local publicada pela fonte, sem fuso: hora que não existe ou se repete "
                   "numa mudança de horário conta como a fonte a publicou.", _PLATAFORMA]),
    _m(id="dados_cobertura_ultimo_periodo", titulo="Cobertura do último período disponível",
       pergunta="Quantas séries do conjunto já têm valor no último período disponível, comparado com o anterior?",
       definicao=("Séries com valor no último período disponível até hoje (o mesmo período que a atualidade publica) e séries "
                  "com valor no período anterior a ele, pelo passo do conjunto. Referência futura (limite regulatório de ano "
                  "seguinte, cenário do PDE, programação do PMO) não é o último período do dado."),
       unidade="séries", grao_geografico="não se aplica", grao_temporal="por conjunto e publicação", fontes=[F_SILVERS],
       formula="series_no_ultimo = #{séries com valor em ultimo_periodo}; series_no_anterior = #{séries com valor em ultimo_periodo − passo}",
       regra_agregacao="contagem por conjunto", dimensoes=["conjunto"],
       regras_comparabilidade=["Último período ainda aberto (mês ou ano corrente, marcado em periodo_parcial) costuma ter menos "
                               "séries que o anterior sem que isso seja falha."],
       regra_cobertura="Séries numéricas do silver com formato de referência regular e passo modal seguido por pelo menos metade dos intervalos.",
       politica_ausencia="Sem período disponível até hoje: campo ausente; série sem valor no período não é contada (ausência não vira zero).",
       validacoes=["amostra com referência futura no teste do módulo: a contagem é feita no último período até hoje, não na maior referência"],
       limitacoes=["Não diz se a série deveria ter valor no período (usina desativada, distribuidora extinta).", _PLATAFORMA]),
    _m(id="dados_revisoes_alcance", titulo="Alcance das revisões da fonte", versao_formula="1.1",
       pergunta="Quantas observações e quantos períodos a fonte mudou depois de publicar, em quantas séries?",
       definicao=("Revisão é a troca de valor de uma mesma (série, referência) entre capturas consecutivas do mesmo arquivo "
                  "(recurso) do silver. Publica-se, separados: eventos; observações revisadas (pares série e referência); "
                  "referências revisadas (períodos distintos, em qualquer série); séries afetadas; e o intervalo de referências."),
       unidade="eventos, observações, referências e séries", grao_geografico="não se aplica", grao_temporal="por conjunto e dia de captura",
       fontes=[F_SILVERS], formula=("revisão ⇔ |valor_novo − valor_anterior| > 1e-9 na mesma (série, referência, arquivo), capturas em "
                                    "ordem; observações = #{(série, referência) revisadas}; referências = #{referência revisada}"),
       regra_agregacao="contagem exata por conjunto; calendário por dia da captura que trouxe o valor novo (observações revisadas)",
       dimensoes=["conjunto", "série", "referência", "dia de captura"],
       regras_comparabilidade=["Conjunto com mais capturas tem mais oportunidade de revelar revisões.",
                               "Observações e referências não se somam: um dia revisado nos quatro subsistemas é 1 referência e 4 observações."],
       regra_cobertura="Conjuntos com pelo menos duas capturas do mesmo arquivo.",
       politica_ausencia="Referência ausente numa captura não é revisão (ausência não vira zero).",
       validacoes=["revisão real da carga diária do Nordeste (26/09/2026) encontrada na amostra com os valores de antes e depois, "
                   "recontada em Python puro (teste do módulo)",
                   "amostra com 4 séries revisadas na mesma data: 4 observações e 1 referência (teste do módulo)"],
       limitacoes=["Só há revisão detectável a partir da segunda captura de um mesmo arquivo.", _HISTORICO, _PLATAFORMA]),
    _m(id="dados_mudancas_registros", titulo="Mudanças da fonte em cadastros e atos",
       pergunta="Quais campos de cadastro a fonte mudou num arquivo que já tinha publicado?",
       definicao=("Troca do valor de um campo da mesma chave entre capturas consecutivas do MESMO arquivo (recurso). Campos que "
                  "descrevem o arquivo e não o cadastro (data de geração, de processamento, de verificação) ficam fora e são "
                  "contados em metadado_do_arquivo."),
       unidade="campos alterados; chaves afetadas", grao_geografico="não se aplica", grao_temporal="por conjunto e dia de captura",
       fontes=[F_SILVERS], formula="mudança ⇔ valor_novo ≠ valor_anterior na mesma (chave, campo, arquivo), capturas em ordem; campo ∉ metadados do arquivo",
       regra_agregacao="contagem exata por conjunto; por campo e por dia da captura",
       dimensoes=["conjunto", "campo", "dia de captura"],
       regras_comparabilidade=["Valor diferente da mesma chave em arquivos diferentes (lista de um ano e a do seguinte, código "
                               "reutilizado, mudança societária entre edições) não é mudança: é conflito entre recursos."],
       regra_cobertura="Conjuntos com cadastros ou atos no silver (tabela registros) e pelo menos duas capturas do mesmo arquivo.",
       politica_ausencia="Campo que a fonte esvaziou conta como mudança e é contado também em apagados_pela_fonte.",
       validacoes=["amostra com dois arquivos anuais que divergem: zero mudanças e um conflito entre recursos (teste do módulo)",
                   "amostra com duas capturas do mesmo arquivo e um campo alterado: uma mudança; gerado_em alterado: metadado do arquivo"],
       limitacoes=["A lista de campos de metadado do arquivo (silver_dados.CAMPOS_METADADO_ARQUIVO) é por nome de campo.",
                   _HISTORICO, _PLATAFORMA]),
    _m(id="dados_conflitos_entre_recursos", titulo="Conflitos entre arquivos do mesmo conjunto",
       pergunta="Arquivos diferentes do mesmo conjunto trazem valores diferentes para a mesma coisa?",
       definicao=("Mesma (série, referência), nas observações, ou mesmo (chave, campo), nos cadastros, com valores diferentes no "
                  "valor mais recente de cada arquivo do conjunto (arquivos anuais que se sobrepõem, relatórios de semanas "
                  "diferentes, listas de anos diferentes). Não é revisão da fonte: o módulo dono decide qual arquivo vale."),
       unidade="referências (observações) ou campos (cadastros)", grao_geografico="não se aplica", grao_temporal="por publicação",
       fontes=[F_SILVERS], formula="conflito ⇔ #{valores distintos entre os arquivos} > 1 (observações: diferença > 1e-9)",
       regra_agregacao="contagem por conjunto, com exemplos", dimensoes=["conjunto"],
       regras_comparabilidade=["Conjunto com muitos arquivos sobrepostos tem mais oportunidade de conflito."],
       regra_cobertura="Conjuntos com mais de um arquivo que trazem a mesma chave.",
       politica_ausencia="Chave presente em um só arquivo não entra.",
       validacoes=["TUSD da distribuidora 05.965.546/0001-09 em 30/11/2021 nos arquivos 2020 e 2021 da ANEEL: conflito, não revisão (teste do módulo)"],
       limitacoes=["Compara o valor mais recente de cada arquivo; conflitos que a fonte já desfez não aparecem.", _PLATAFORMA]),
    _m(id="dados_revisao_maior_relativa", titulo="Maior revisão relativa",
       pergunta="Qual foi a maior mudança proporcional que a fonte fez num valor já publicado?",
       definicao="Maior |novo − anterior| ÷ |anterior| entre os eventos de revisão do conjunto, com a série, a referência e as capturas.",
       unidade="%", grao_geografico="não se aplica", grao_temporal="por conjunto",
       fontes=[F_SILVERS], numerador="|valor novo − valor anterior| (unidade da série)", denominador="|valor anterior| (unidade da série)",
       formula="100 × |novo − anterior| ÷ |anterior|", regra_agregacao="máximo entre eventos",
       dimensoes=["conjunto"],
       regras_comparabilidade=["Valor anterior perto de zero infla a relativa: leia junto com a maior revisão absoluta."],
       regra_cobertura="Eventos com valor anterior diferente de zero; os que partem de zero são contados à parte (a_partir_de_zero).",
       politica_ausencia="Sem evento de revisão: campo ausente.",
       validacoes=["valores de antes e depois lidos das duas vintages no silver (ficha maior_revisao_relativa)"],
       limitacoes=["Não indica por que a fonte revisou (consistência, reprocessamento, correção).", _PLATAFORMA]),
    _m(id="dados_revisao_maior_absoluta", titulo="Maior revisão absoluta",
       pergunta="Qual foi a maior mudança, na unidade da própria série, num valor já publicado?",
       definicao="Maior |novo − anterior| entre os eventos de revisão do conjunto, com a série, a referência e as capturas.",
       unidade="unidade da série revisada", grao_geografico="não se aplica", grao_temporal="por conjunto",
       fontes=[F_SILVERS], formula="max |novo − anterior|", regra_agregacao="máximo entre eventos",
       dimensoes=["conjunto"],
       regras_comparabilidade=["Só se compara dentro da mesma série: conjuntos misturam unidades (MWmed, R$/MWh, %)."],
       regra_cobertura="Todos os eventos de revisão do conjunto.", politica_ausencia="Sem evento de revisão: campo ausente.",
       validacoes=["mesmo evento relido do silver de teste com os valores conhecidos (teste do módulo)"],
       limitacoes=[_PLATAFORMA]),
    _m(id="dados_veredito_validacao", titulo="Veredito das validações automáticas",
       pergunta="As checagens automáticas aprovaram esta gold, este CSV ou este conjunto?",
       definicao=("Pior resultado entre as checagens aplicáveis ao alvo: reprovado > ressalva > aprovado; não aplicável não conta. "
                  "Checagens: esquema e JSON estrito, proveniência completa, links existentes, datas futuras, drift de esquema em "
                  "relação ao último commit, tamanho; nos CSV, colunas, ausência textual, duplicadas, chave inferida, datas futuras e "
                  "dicionário; identidades de agregação declaradas; nos conjuntos, sha256 das capturas e do original, horizonte e "
                  "drift do cabeçalho da fonte."),
       unidade="categoria (aprovado, ressalva, reprovado, nao_aplicavel)", grao_geografico="não se aplica", grao_temporal="por publicação",
       fontes=[F_SILVERS], formula="veredito = max_gravidade(resultado das checagens aplicáveis)",
       regra_agregacao="contagem de checagens por resultado (resumo.validacao) e de alvos por veredito",
       dimensoes=["tipo de alvo", "tipo de checagem"],
       regras_comparabilidade=["Divergência entre total e partes publicados pela própria fonte é ressalva; total calculado pela "
                               "plataforma que não fecha é reprovado."],
       regra_cobertura="Todas as golds de public/energia/gold, todos os CSV de public/energia/series e todos os conjuntos declarados.",
       politica_ausencia="Alvo sem checagem aplicável: nao_aplicavel, nunca aprovado.",
       validacoes=["casos de teste com JSON com NaN, link quebrado, CSV com coluna torta e ausência escrita como texto são reprovados (teste do módulo)"],
       limitacoes=["A chave única dos CSV é inferida pelo nome e pelo tipo das colunas; ressalva de chave pede conferência humana.",
                   "Identidades de agregação só valem para as declaradas em validacoes.IDENTIDADES.", _PLATAFORMA]),
    _m(id="dados_situacao_validacao_ficha", titulo="Situação da validação de um número publicado",
       pergunta="O número que aparece na página foi conferido por outro caminho?",
       definicao=("Eixo separado da natureza (seção 11.3): reconciliação aprovada, controles internos aprovados, ressalva, "
                  "divergência ou pendência, a partir dos testes e da reconciliação da ficha 'Comprove este número'."),
       unidade="categoria", grao_geografico="não se aplica", grao_temporal="por publicação", fontes=[F_SILVERS],
       formula=("divergência se teste ou reconciliação reprovado; ressalva se algum com ressalva; reconciliação aprovada se a "
                "reconciliação aprovou; controles aprovados se todos os testes aprovaram; pendência nos demais"),
       regra_agregacao="matriz natureza × situação (eixos.matriz)", dimensoes=["gold", "natureza", "situação"],
       regras_comparabilidade=["Calculado não quer dizer menos confiável, e observado não quer dizer livre de erro."],
       regra_cobertura="Toda ficha de evidência encontrada nas golds (objeto com valor_exibido, testes e fonte).",
       politica_ausencia="Ficha sem teste nem reconciliação: pendência.",
       validacoes=["natureza vinculada pela ficha, pela proveniência de mesma chave ou de mesmo indicador, ou pela única "
                   "proveniência no mesmo objeto da ficha; a de um objeto acima na árvore não é herdada; sem vínculo, SEM_VINCULO"],
       limitacoes=["A qualidade da reconciliação depende do que cada módulo registrou na ficha.",
                   "A natureza ESTIMADO não separa 'estimado pela fonte' de 'estimado pelo observatório' (seção 11.3): o contrato de "
                   "proveniência compartilhado tem uma só categoria; pedido ao integrador.", _PLATAFORMA]),
    _m(id="dados_id_publicacao", titulo="Identificador da publicação", paginas=PAGINA + PAGINA_MET,
       pergunta="Qual é a versão exata dos arquivos que geraram esta página?",
       definicao=("sha256 da lista [caminho, bytes, sha256] de todos os arquivos publicados (golds, séries, Parquet e geometrias), "
                  "em ordem de caminho, serializada em JSON sem espaços: o mesmo conjunto de bytes tem o mesmo id."),
       unidade="hexadecimal de 64 caracteres", grao_geografico="não se aplica", grao_temporal="por publicação",
       fontes=[F_SILVERS], gold="manifesto.json",
       formula="id = sha256(json([[caminho, bytes, sha256], …] ordenado por caminho, separadores ',' e ':'))",
       regra_agregacao="não se aplica", dimensoes=["publicação"],
       regras_comparabilidade=["Dois ids iguais garantem os mesmos bytes; ids diferentes não dizem o quanto mudou (ver o manifesto)."],
       regra_cobertura="Arquivos de public/energia/gold, public/energia/series e public/energia/geo; os quatro reescritos pelo orquestrador depois do módulo dados ficam em fora_do_manifesto até a chamada final.",
       politica_ausencia="Arquivo ilegível entra com o sha256 dos bytes e legivel = falso.",
       validacoes=["id recalculado a partir das entradas do manifesto (teste do módulo e teste de contrato TS)",
                   "sha256 e tamanho de cada arquivo listado conferidos contra o disco (teste do módulo)"],
       limitacoes=["O silver (vintages) não é publicado no git; reproduzir uma gold exige o silver da release energia-estado.",
                   _PLATAFORMA]),
    _m(id="dados_equivalencia_parquet", titulo="Equivalência entre CSV e Parquet", paginas=PAGINA,
       pergunta="O arquivo Parquet tem exatamente o mesmo conteúdo do CSV?",
       definicao=("Parquet relido em lotes e comparado com o CSV célula a célula: texto igual, inteiro igual como texto, número "
                  "decimal igual ao número escrito no CSV (Decimal da representação mais curta do float64 = Decimal do texto) e "
                  "vazio igual a nulo."), versao_formula="1.1",
       unidade="células divergentes", grao_geografico="não se aplica", grao_temporal="por arquivo e publicação",
       fontes=[F_SILVERS], formula="divergências = Σ células com valor Parquet ≠ valor CSV; equivalente ⇔ divergências = 0 e mesmas linhas",
       regra_agregacao="contagem de arquivos equivalentes (resumo.parquet)", dimensoes=["arquivo"],
       regras_comparabilidade=["Colunas de código (CNPJ, IBGE, CEG) ficam como texto para não perder zero à esquerda."],
       regra_cobertura="Todo CSV de public/energia/series com pelo menos 2 MiB.",
       politica_ausencia="Célula vazia do CSV é nulo no Parquet; nunca zero.",
       validacoes=["CSV com zero à esquerda, vazio e decimal relido idêntico (teste do módulo)",
                   "número com mais de 17 dígitos significativos: a coluna fica como texto, e um Parquet gravado em float64 é "
                   "acusado como divergente (teste do módulo)"],
       limitacoes=["A comparação de números é decimal: a representação mais curta do float64 gravado tem de ser o mesmo número "
                   "decimal escrito no CSV ('1.50' = '1.5'); coluna com número que o float64 não guarda exatamente vira texto.",
                   _PLATAFORMA]),
    _m(id="dados_conjuntos_publicados", titulo="Conjuntos publicados no catálogo",
       pergunta="Quantos conjuntos chegaram ao fim da escada, com evidência em cada etapa?",
       definicao="Contagem de entradas do catálogo com estado PUBLICADO.", unidade="conjuntos",
       grao_geografico="não se aplica", grao_temporal="por publicação", fontes=[F_ONS, F_ANEEL, F_CCEE, F_SEED, F_SILVERS],
       formula="n = #{entradas : estado = PUBLICADO}", regra_agregacao="contagem", dimensoes=["órgão", "tema"],
       regras_comparabilidade=["Entre publicações, a contagem muda quando módulos integram conjuntos novos ou golds são reprovadas."],
       regra_cobertura="Entradas de catalogo.json.", politica_ausencia="Não se aplica (contagem).",
       validacoes=["publicados sem checagem reprovada no relatório e com gold consumidora íntegra (ficha conjuntos_publicados)"],
       limitacoes=[_PLATAFORMA]),
]
