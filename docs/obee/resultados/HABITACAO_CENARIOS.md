# Habitação: definições, composição e precisão

12/10/2026. Base: `8f82beae4f1ac415d39c4034417f840d83e9521a`. Continuação da [auditoria de aquisição](HABITACAO_ADENSAMENTO.md).

## Decisão desta etapa

O experimento de oito cenários está concluído. Habitação continua como candidato em revisão, sem promoção ao escore vigente. A análise mostra que a escolha dos pesos do conjunto renda–saneamento–habitação merece revisão explícita. Não há fundamento, nesta entrega, para escolher pesos por maximização de estabilidade ou por correlações apenas.

A diligência de precisão foi delimitada à Nota metodológica 07/2024 do IBGE. O documento adquirido descreve funções generalizadas de variância para Brasil, Grandes Regiões e UFs. Isso não oferece validação de erro amostral para a proporção municipal usada aqui. Portanto, os cenários abaixo são condicionais às estimativas publicadas: não têm intervalos de confiança, probabilidades de ordenação ou significância estatística.

## Experimento

Quatro definições: domicílios com mais de dois ou mais de três moradores por dormitório; moradores vivendo nessas condições, com os mesmos dois limiares. Cada definição é normalizada separadamente nas mesmas 26 capitais, com polaridade menor/melhor e percentis com empates. A unidade de moradores pondera mais os domicílios maiores; não é mera troca de denominador mantendo o numerador anterior.

Duas ponderações, sem otimização a partir do resultado:

| Modelo | Educação | Renda | Mobilidade | Saneamento | Segurança | Habitação | Renda + saneamento + habitação |
|---|---:|---:|---:|---:|---:|---:|---:|
| v2 vigente | 20% | 20% | 20% | 20% | 20% | — | 40% |
| Seis iguais, cenário | 16,67% | 16,67% | 16,67% | 16,67% | 16,67% | 16,67% | 50% |
| Materiais em 40%, cenário | 20% | 13,33% | 20% | 13,33% | 20% | 13,33% | 40% |

Percentuais exibidos arredondados; cálculos usam 1/6 ou 0,4/3 exatos em ponto flutuante. O agrupamento “materiais” é uma hipótese de diagnóstico, não uma nova taxonomia aprovada do OBEE. No segundo cenário, as três outras dimensões mantêm o peso original.

## Resultados

Cada cenário é comparado à v2 nos 325 pares distintos. Inversões estritas, empates originais desfeitos e empates alcançados são contados separadamente, com tolerância de 1e-9. Os números de Recife e Curitiba abaixo são resultados experimentais da composição, não novas notas oficiais.

| Definição | Pesos | Pares invertidos | Empates desfeitos | Empates alcançados | Recife | Curitiba |
|---|---|---:|---:|---:|---:|---:|
| Domicílios >2 | Seis iguais | 20 | 3 | 2 | 37,82 | 80,77 |
| Domicílios >2 | Materiais em 40% | 13 | 3 | 1 | 36,79 | 77,82 |
| Domicílios >3 | Seis iguais | 20 | 3 | 1 | 37,18 | 80,77 |
| Domicílios >3 | Materiais em 40% | 11 | 3 | 1 | 36,28 | 77,82 |
| Moradores >2 | Seis iguais | 21 | 3 | 0 | 37,82 | 80,77 |
| Moradores >2 | Materiais em 40% | 12 | 3 | 1 | 36,79 | 77,82 |
| Moradores >3 | Seis iguais | 22 | 3 | 0 | 36,54 | 80,77 |
| Moradores >3 | Materiais em 40% | 11 | 3 | 3 | 35,77 | 77,82 |

Referência v2: Recife 33,46; Curitiba 77,31. A diferença é exclusivamente composicional; não representa melhora entre anos. A média dos escores permanece 50 em todos os cenários por construção.

Também foram calculadas as 12 comparações entre definições mantendo os pesos fixos. Nelas, há de zero a três inversões estritas por comparação. Zero inversões não significa igualdade de valores, ausência de empates desfeitos ou equivalência conceitual. A [saída JSON](habitacao-cenarios.json) contém todas as 208 linhas cidade–cenário, valores originais, percentis, pesos, diferenças e diagnósticos.

As inversões frente à v2 variam menos quando se preserva o peso conjunto em 40%. Isso não estabelece superioridade normativa: seria possível reduzir inversões simplesmente dando peso muito pequeno ao novo indicador. A seleção deve refletir o conteúdo que se deseja representar, além de estabilidade e precisão.

## Diligência de precisão

Foi adquirida a [Nota metodológica 07/2024](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102149.pdf), com identificação, hash e escopo em [precisao-habitacao-evidencia.json](precisao-habitacao-evidencia.json). Páginas impressas 22–24: método para totais e calibração das funções de variância; exemplos nacionais. A própria nota delimita os níveis geográficos do ajuste. O anexo ZIP de tabelas foi localizado no catálogo, mas não foi examinado nesta rodada.

Conclusão de uso: não transportar os parâmetros nacionais/estaduais para uma capital nem tratar totais expandidos como tamanho de amostra. Para inferir precisão de uma proporção municipal, é necessário um resultado oficial adequado ou informação sobre desenho amostral e covariância entre numerador e denominador. Não se afirma que esses recursos inexistam fora do material examinado.

## Atualização de continuidade

A aquisição de conectividade e a [comparação conjunta das candidatas](CESTA_CONJUNTA_V3.md) foram concluídas. A v2 segue congelada; precisão/divulgação municipal e aprovação de conteúdo/pesos continuam pendentes.

## Encaminhamento original e critérios de promoção

Avançar na auditoria de **conectividade domiciliar municipal de 2022**, usando a tabela SIDRA 9936 como candidata já identificada nos metadados da diligência anterior. Ainda é necessário adquirir os dados das capitais, reconciliar categorias e examinar redundância. Isso permite concluir a comparação dos candidatos antes de propor a cesta v3, mantendo as pendências de precisão explicitamente registradas.

Antes da promoção de qualquer candidato: revisão de conteúdo/unidade, precisão ou regra de divulgação justificada, pesos declarados e análise conjunta. A v2 continua congelada; Saúde não é preenchida; nenhum cenário representa seis capítulos completos. A revisão independente e a liberação em produção continuam pendentes.

## Reprodução

```sh
python3 -m pipeline.eficiencia_resultados.habitacao_cenarios
python3 -m unittest pipeline.eficiencia_resultados.test_habitacao pipeline.eficiencia_resultados.test_habitacao_cenarios
```

Dez testes locais aprovados, quatro novos: direção/empates dos percentis; pesos e ausências; classificação das mudanças de ordem; reprodução, cobertura e preservação da v2. Novo módulo incluído na CI. Nenhuma mudança na interface ou nos escores apresentados ao usuário.
