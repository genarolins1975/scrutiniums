# Robustez empírica da cesta de cinco dimensões

12/10/2026. Análise descritiva interna das 26 capitais estaduais na referência congelada de 2022. Não é homologação metodológica, inferência populacional ou proposta de novos pesos.

## Resultado principal

O escore não deve ser apresentado como ordenação definitiva das capitais. Há comparações sensíveis aos pesos, à retirada de um indicador e à definição de duas medidas. Essas famílias avaliam hipóteses distintas e não devem ser somadas ou tratadas como probabilidades.

| Hipótese, em relação à cesta original | Pares com inversão estrita | Empates originais desfeitos | Pares que chegam a empate |
|---|---:|---:|---:|
| Pesos ±20% antes da renormalização | 37 | 3 | 21 |
| Retirar Educação | 25 | 3 | 2 |
| Retirar Condições materiais | 13 | 3 | 2 |
| Retirar Mobilidade | 31 | 3 | 2 |
| Retirar Saneamento | 10 | 3 | 5 |
| Retirar Violência letal | 30 | 3 | 4 |
| Saneamento: definição alternativa apenas rede | 8 | 3 | 3 |
| Violência: apenas homicídios registrados | 4 | 2 | 1 |

Universo: 325 pares não ordenados. Inversão estrita exige sinal original não nulo e sinal oposto em ao menos uma hipótese. Empate é diferença absoluta até 1e-9 ponto, para não confundir resíduos de ponto flutuante com diferenças. Colunas podem se sobrepor: um par pode empatar em um cenário e inverter em outro.

Os 32 cenários fatoriais geram **31 vetores distintos de pesos**: reduzir todos os pesos e elevar todos os pesos produzem a mesma cesta igualitária após renormalização. As faixas anteriores permanecem corretas. Contagens de cenários não são probabilidades; não há distribuição probabilística dos pesos.

## Dependência entre indicadores

Correlação de Pearson entre os percentis orientados, equivalente à correlação de postos médios neste universo de referência. Direção favorável já incorporada. Estimativas descritivas, sem testes de significância.

| | Educação | Condições materiais | Mobilidade | Saneamento | Violência letal |
|---|---:|---:|---:|---:|---:|
| Educação | 1,000 | 0,543 | −0,195 | 0,554 | 0,360 |
| Condições materiais | 0,543 | 1,000 | −0,086 | 0,827 | 0,663 |
| Mobilidade | −0,195 | −0,086 | 1,000 | −0,185 | −0,050 |
| Saneamento | 0,554 | 0,827 | −0,185 | 1,000 | 0,541 |
| Violência letal | 0,360 | 0,663 | −0,050 | 0,541 | 1,000 |

A associação entre condições materiais e saneamento (0,827) indica sobreposição estatística nesta amostra territorial. Não prova duplicação conceitual e não justifica excluir uma dimensão automaticamente. Mobilidade apresenta associações negativas com as outras quatro medidas: capta um aspecto que não acompanha o mesmo padrão territorial.

## Peso nominal e participação na variância

Todos os pesos são 20%, mas não produzem contribuições iguais à variância entre capitais. A decomposição utilizada é `w_j × Cov(P_j,S) / Var(S)`, com covariâncias populacionais do conjunto observado. Soma 100%; não é contribuição causal, importância social, elasticidade ou recomendação de ponderação. Em outras bases pode produzir parcelas negativas.

| Dimensão | Peso nominal | Parcela da variância |
|---|---:|---:|
| Educação | 20% | 20,67% |
| Condições materiais | 20% | 26,93% |
| Mobilidade | 20% | 4,42% |
| Saneamento | 20% | 25,01% |
| Violência letal | 20% | 22,97% |

A parcela pequena de Mobilidade não autoriza aumentar seu peso para igualar essas parcelas: isso mudaria o objetivo do índice com base na covariância desta referência. Também não implica que removê-la seja irrelevante: sua retirada inverte 31 pares.

## Decisão técnica

Manter pesos e escores atuais como piloto explícito. Não estimar pesos por PCA/correlação apenas para reduzir sobreposição; não apresentar ranking definitivo; não chamar cenários de confiança estatística. Próxima melhoria recomendada na interface: mostrar se a comparação selecionada mantém o sinal, empata ou inverte sob cada família de hipóteses. Comparar os dois territórios sob o **mesmo cenário**, sem cruzar limites marginais de cenários diferentes.

Para publicação oficial ainda faltam validação substantiva da cesta e dos pesos, avaliação de compreensão com usuários e tratamento da incerteza das fontes. Referência 2022 não descreve a situação atual de 2026. Saúde continua inelegível e a cesta de seis dimensões não recebe nota.

## Reprodução e verificações

- `python3 scripts/obee/auditar-robustez-piloto.py`
- `python3 -m unittest discover -s scripts/obee -p test_robustez_piloto.py`

Somente biblioteca padrão. Entrada: `piloto-2022-v2.json`, preservada sem alterações. Saída: `robustez-2022-v2.json`, com SHA-256 da entrada, matriz integral, resultados por hipótese e lista dos pares afetados (índices identificados no catálogo territorial). Pares sem alteração não são listados em details. O código reconcilia os escores, os 32 cenários e as cinco exclusões com as saídas já congeladas. Quatro testes passaram: empates versus inversões, tolerância numérica, correlação/variância nula e reconciliação com rejeição de escore adulterado. O número de inversões de pesos reproduz os 37 pares da auditoria anterior.
