# Resultados para o Cidadão: expansão v2, referência 2022

Data: 12/10/2026. Continuação da [metodologia v1](METODOLOGIA_V1.md). A versão anterior foi preservada.

## Entrega e recuperação

Piloto técnico de cinco dimensões, com 26 capitais estaduais e 130 observações. O primeiro cálculo local perdeu acesso ao ambiente antes da transferência. Esta entrega foi reconstruída a partir das fontes oficiais e do commit `52e32e000c1b5ab157317410d0b6ae2f259390d6`. Os resultados foram recalculados, reproduziram os valores reportados anteriormente e passaram novamente nos 19 testes. Não se declara identidade dos arquivos perdidos: os hashes aqui registrados correspondem aos arquivos efetivamente adquiridos nesta sessão.

Entradas auditáveis, coletor, motor da expansão, referência congelada, testes e saídas JSON/CSV integram esta entrega. O CI passa a executar explicitamente os testes deste namespace. A aquisição usa biblioteca padrão Python e Poppler; a reprodução a partir das entradas versionadas usa apenas Python, sem rede e sem Poppler.

Continua sendo um piloto descritivo: `publication_ready=false` e `is_full_obee_score=false`. Não é satisfação, eficiência do gasto, avaliação causal do governo, representação dos 16 capítulos ou medida da situação atual de 2026. Cinco indicadores não equivalem a cinco capítulos completos. Nenhuma nota foi incorporada à página inicial nesta etapa.

## Cesta e cobertura

| Dimensão | Indicador | Melhor direção | Observações |
|---|---|---|---:|
| Educação | Frequência escolar de residentes de 4–5 anos, redes pública e privada, 2022 | Maior | 26/26 |
| Condições materiais | Mediana da renda domiciliar por pessoa, julho de 2022 | Maior | 26/26 |
| Mobilidade | Parcela com mais de uma hora até o trabalho, 2022 | Menor | 26/26 |
| Saneamento | Domicílios nas categorias de esgotamento especificadas abaixo, 2022 | Maior | 26/26 |
| Violência letal | Taxa publicada de homicídios estimados por 100 mil habitantes, 2022 | Menor | 26/26 |
| Saúde, somente no contrato ampliado | Mortalidade infantil municipal: elegibilidade e precisão pendentes | Não pontuada | 0/26 |

Mesmas 26 capitais da v1; DF excluído para manter a coorte municipal. Cada capital tem peso igual na distribuição de referência; não se trata da média populacional brasileira. Educação, renda e mobilidade reutilizam o snapshot da v1, cuja integridade continua conferida pelo motor original.

## Saneamento: composição sem dupla contagem

Censo 2022, SIDRA 6805, variável 381, classificação 11558, nível municipal. Denominador: domicílios particulares permanentes ocupados, categoria 46292. Numerador: categoria 46290 (rede geral, rede pluvial ou fossa ligada à rede) mais 72112 (fossa séptica ou fossa filtro não ligada à rede).

A categoria 46290 contém as filhas 72110 e 72111. Somá-las novamente duplicaria domicílios. O coletor confere essa hierarquia e a soma das sete categorias de primeiro nível com o total. Percentual = 100 × numerador / denominador.

Validações: município e nome/UF consistentes; ano, variável, unidade e nível corretos; dez categorias únicas por capital; valores inteiros não negativos; denominador positivo; numerador dentro do total. O sinal `-` do SIDRA corresponde a zero; outros marcadores de ausência são rejeitados, não imputados.

A medida não comprova tratamento de esgoto, continuidade ou serviço gerido com segurança. Não rotular como “esgoto tratado”. Foi calculada separadamente a alternativa com apenas a categoria 46290, recalibrando a referência para todas as capitais.

Fontes: [metadados oficiais](https://servicodados.ibge.gov.br/api/v3/agregados/6805/metadados) e [tabela SIDRA](https://sidra.ibge.gov.br/tabela/6805). A URL integral da consulta e os hashes constam no manifesto versionado.

## Violência letal: componente registrado e componente estimado

Ipea/FBSP, Atlas da Violência 2024 — Retrato dos Municípios Brasileiros, tabela 3, página 18. A tabela foi renderizada e conferida visualmente, incluindo suas 27 linhas e a nota da fonte. O DF é retirado explicitamente após a leitura.

Usa-se a taxa publicada de **homicídios estimados**: registros do SIM nas causas X85–Y09 e Y35–Y36, acrescidos de homicídios ocultos estimados pela metodologia da fonte. A unidade territorial é o município de residência. Não confundir com homicídio doloso registrado pela polícia ou com mortalidade exclusivamente observada.

O parser reconcilia população, homicídios registrados + ocultos estimados = total, e taxa por 100 mil com tolerância de arredondamento a uma casa decimal. Confere também unicidade e correspondência de capital/UF. Exemplo que evidencia a diferença conceitual: São Paulo apresenta 344 registrados + 1.418 ocultos estimados = 1.762 estimados.

A dependência do modelo de homicídios ocultos é material. Calculou-se uma alternativa com somente registros, para toda a coorte e com nova referência. Essa alternativa é sensibilidade de definição, não de pesos. A incerteza do modelo da fonte não foi propagada ao índice.

[PDF oficial](https://repositorio.ipea.gov.br/bitstream/11058/14031/5/AtlasViolencia2024_Retrato_dos_municipios_brasileros.pdf). O repositório inclui a extração textual da página, seus localizadores e o hash do PDF original; o binário pode ser readquirido pelo coletor.

## Saúde: motivo da ausência

O arquivo RIPSA MRT.1.01 adquirido tem campos Indicador, Ano, UF, óbitos infantis estimados, nascidos vivos estimados e fator. Sua granularidade é estadual. A ficha de qualificação registra a dificuldade de estabilidade municipal e não disponibiliza resultados nesse nível. Não se atribuiu a taxa da UF à capital.

Também não se transformou automaticamente ICSAP em nota: taxa baixa pode refletir composição demográfica, cobertura privada e acesso à internação, além da atenção primária. A polaridade exige análise do construto.

Fontes examinadas: [catálogo do Ministério da Saúde](https://dadosabertos.saude.gov.br/dataset/ripsa-mortalidade-dimensao-1-mortalidade-infantil-e-na-infancia), [arquivo oficial](https://demas-dados-abertos.s3.amazonaws.com/csv/mgdi_ms_k5p.csv.zip) e [ficha MRT.1.01](https://www.ripsa.org.br/wp-content/uploads/fichasidb/2025/MRT.1.01.pdf). O manifesto registra hashes, colunas e anos efetivamente inspecionados.

A auditoria subsequente obteve 156 contagens municipais do SIM/SINASC para 2021–2023. O [contrato de saúde municipal](SAUDE_MUNICIPAL.md) preserva os dados e as condições de elegibilidade ainda pendentes; a saúde não entra automaticamente nesta cesta de referência 2022.

## Contratos separados e interpretação

**Piloto de cinco dimensões:** pesos explícitos de 20% cada, cesta completa, com pontuação pontual. Esta é uma nova cesta versionada. Não é a retirada silenciosa de uma dimensão ausente.

**Contrato ampliado de seis dimensões:** pesos de 1/6 incluindo saúde. Como falta saúde, `score=null`; limite inferior = contribuição conhecida dos cinco percentis com os pesos de 1/6; limite superior = inferior + 100/6. Cobertura ponderada de 5/6. Não há imputação de zero ou de ponto médio. Esses limites são de identificação por informação ausente, não intervalos de confiança.

Mantém-se a fórmula da v1: 100 × (número de referências piores + metade das iguais) / 26. Polaridade e precisão publicada definem os empates. Referências fixas de 2022; cada mudança de fonte ou contrato exige revisão/versionamento. A agregação aritmética permite compensação entre dimensões; percentis perdem distâncias nas unidades originais. Média 50 na referência é propriedade da construção, não evidência de desempenho satisfatório.

| Capital | Piloto de cinco dimensões | Contrato de seis: limite inferior | Limite superior |
|---|---:|---:|---:|
| Recife | 33,46 | 27,88 | 44,55 |
| Curitiba | 77,31 | 64,42 | 81,09 |

A diferença entre v1 e v2 é de composição, não evolução temporal.

## Sensibilidade e verificação

32 cenários fatoriais de pesos, multiplicadores independentes 0,8 e 1,2 renormalizados. Há inversão estrita de ordem em 37 dos 325 pares em pelo menos um cenário. Empates não contam como inversão. Os vértices delimitam os extremos desta média linear fracionária na caixa de multiplicadores; não cobrem toda escolha metodológica possível.

Também foram calculadas cinco retiradas de dimensão e duas definições alternativas (esgotamento só na categoria 46290 e homicídios só registrados), separadas da faixa de pesos. Não se interpreta a ausência de inversão como significância estatística. A saída JSON preserva valores originais, pontuações, pesos, cobertura e cenários; o CSV exporta 26 linhas com as pontuações e limites claramente nomeados.

25 testes aprovados no conjunto: 11 da v1, oito de expansão e seis da auditoria municipal de saúde. Os 19 primeiros cobrem 130 observações, ausências/pesos, totais e hierarquia do SIDRA, escopo e duplicatas, reconciliação da violência, DF, referências, cenários e definições alternativas.

## Reprodução

Na raiz do repositório, sem rede:

```sh
python3 -m pipeline.eficiencia_resultados.expansao
python3 -m unittest pipeline.eficiencia_resultados.test_motor pipeline.eficiencia_resultados.test_expansao
```

Saídas: `piloto-2022-v2.json` e `piloto-2022-v2.csv`, nesta pasta. Configuração: `pipeline/eficiencia_resultados/referencia-2022-v2.json`; originais e evidências em `pipeline/eficiencia_resultados/seed/`.

Para uma nova auditoria das fontes, com Python e `pdftotext` instalado:

```sh
python3 -m pipeline.eficiencia_resultados.coletar_expansao --cache /tmp/obee-fontes --acquire
```

A nova coleta pode alterar bytes e datas do manifesto. Não atualiza automaticamente a referência congelada: a geração deve falhar até revisão explícita. Nesta entrega as fontes foram baixadas individualmente, e o coletor foi executado sobre o cache; o caminho único `--acquire` não foi exercitado de ponta a ponta.

Próximas etapas: concluir saúde municipal e suas limitações; revisar validade de conteúdo e normalizações; só então promover uma versão aprovada ao painel, com ano, nome da cesta, cobertura e acesso aos valores originais. Comparação internacional e escore integral dos capítulos permanecem fora deste piloto.
