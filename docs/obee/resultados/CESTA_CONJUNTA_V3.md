# Proposta de cesta v3: habitação e conectividade

12/10/2026 · Base integrada: `bca955b0f611c534e903fc3f0c85785705b0be1e`.

## Decisão proposta

Levar à revisão uma cesta de **sete indicadores**, incluindo adensamento domiciliar e conexão domiciliar à Internet, com o conjunto renda–saneamento–habitação–conectividade limitado a **40%** como referência de discussão. Essa hipótese preserva o peso material da v2 enquanto amplia os aspectos observados. Não é uma ponderação aprovada, nem um índice de sete capítulos completos.

**A inclusão permanece condicionada** à revisão de conteúdo, da precisão ou regra de divulgação municipal e dos pesos. A v2 de cinco indicadores continua congelada; a proposta não modifica a interface nem libera escores em produção. Saúde continua ausente. Não foi feita seleção de pesos por estabilidade, correlação ou posição de uma capital.

O agrupamento material é uma escolha normativa que precisa ser defendida: não foi estimado a partir de fatores latentes e não constitui a taxonomia oficial do OBEE. Preservar 40% oferece continuidade com a cesta existente, mas não comprova que esse orçamento seja ideal. A própria v2 permanece experimental.

## O que os candidatos acrescentam

| Indicador | Informação adicional | Limite principal |
|---|---|---|
| Habitação | Concentração de moradores por dormitório no domicílio | Não mede déficit habitacional completo, qualidade da edificação, custo ou política habitacional |
| Conectividade | Presença de acesso à Internet no domicílio | Não mede velocidade, preço, continuidade, capacidade digital ou serviços públicos digitais |

Os dois são condições da vida dos moradores. Não identificam a parcela atribuível ao Estado nem a eficiência do gasto público. A referência é 2022, para as mesmas 26 capitais estaduais, sem DF; os dados dos candidatos são resultados preliminares da amostra do Censo.

A definição principal de habitação é domicílios com **mais de dois moradores por dormitório**, mantida da aquisição para permitir a comparação. É uma categoria descritiva, não uma declaração de padrão universal de moradia adequada. Três alternativas já adquiridas — domicílios >3, moradores >2 e moradores >3 — permanecem no experimento. Medir moradores dá mais peso a domicílios maiores.

## Desenho e pesos

O experimento cruza inclusão isolada e conjunta, quatro definições de habitação e dois modelos de pesos: **18 cenários e 468 linhas cidade–cenário**. Conectividade isolada não é repetida artificialmente para cada definição de habitação. Cada cenário compara todos os 325 pares de capitais com a v2. Há ainda 16 comparações incrementais, 24 entre definições e nove entre modelos de pesos.

| Composição | Educação | Renda | Mobilidade | Saneamento | Segurança | Habitação | Conectividade | Bloco material |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| v2: cinco iguais | 20% | 20% | 20% | 20% | 20% | — | — | 40% |
| + um candidato: seis iguais | 16,67% | 16,67% | 16,67% | 16,67% | 16,67% | 16,67%¹ | 16,67%¹ | 50% |
| + dois candidatos: sete iguais | 14,29% | 14,29% | 14,29% | 14,29% | 14,29% | 14,29% | 14,29% | 57,14% |
| + um candidato: material 40% | 20% | 13,33% | 20% | 13,33% | 20% | 13,33%² | 13,33%² | 40% |
| + dois candidatos: material 40% | 20% | 10% | 20% | 10% | 20% | 10% | 10% | 40% |

¹ Apenas o candidato incluído recebe 1/6; o outro fica fora. ² Apenas o candidato incluído recebe 0,4/3; o outro fica fora. Os cálculos usam as frações, não os percentuais arredondados da tabela.

Os percentis orientados usam `100 × (piores + iguais/2) / 26`, preservando empates. Menor adensamento e maior conectividade recebem maior percentil; os cinco percentis vigentes não são recalibrados. A média de qualquer cenário é 50 por construção. Uma diferença de percentis não preserva a distância original em pontos percentuais, reais ou taxas; 50 não é meta de qualidade.

## Resultados: definição principal

Valores abaixo são **cenários de composição**, não notas publicadas. Base v2: Recife 33,46; Curitiba 77,31.

| Inclusão | Pesos | Pares invertidos | Empates v2 desfeitos | Novos empates | Recife | Curitiba |
|---|---|---:|---:|---:|---:|---:|
| Conectividade | Seis iguais | 10 | 3 | 1 | 33,33 | 80,13 |
| Conectividade | Material 40% | 7 | 3 | 1 | 33,21 | 77,31 |
| Habitação >2 | Seis iguais | 20 | 3 | 2 | 37,82 | 80,77 |
| Habitação >2 | Material 40% | 13 | 3 | 1 | 36,79 | 77,82 |
| Ambas | Sete iguais | 27 | 2 | 1 | 37,09 | 82,69 |
| Ambas | Material 40% | 8 | 3 | 0 | 35,77 | 77,69 |

Existem três empates na referência v2: 322 dos 325 pares têm ordem estrita. Uma inversão estrita troca a ordem de duas cidades; empates desfeitos e alcançados são contabilizados separadamente, com tolerância numérica de 1e-9. Não são probabilidades nem testes de significância.

Entre as quatro definições de habitação, a inclusão conjunta produz **25–29 inversões** com sete pesos iguais e **8–12** com o bloco material em 40%. Isso mostra sensibilidade ao desenho; menos inversões não é critério suficiente de qualidade. Diminuir muito o peso dos novos indicadores também reduziria inversões, sem demonstrar maior validade.

## Separar nova informação de redistribuição de pesos

Para cada cidade, a diferença é decomposta exatamente em:

`Δ = Σ novos [peso novo × (percentil − 50)] + Σ existentes [(peso novo − 0,20) × (percentil − 50)]`.

A centralização em 50 evita tratar toda contribuição bruta positiva como benefício. É uma identidade contábil condicionada aos percentis e pesos, não uma decomposição causal ou temporal. Na proposta conjunta com material em 40%:

| Capital | Novos indicadores, centrados | Redistribuição dos cinco pesos | Diferença total |
|---|---:|---:|---:|
| Recife | −0,77 | +3,08 | +2,31 |
| Curitiba | +9,23 | −8,85 | +0,38 |

Assim, a passagem de Recife de 33,46 a 35,77 não pode ser lida como melhora das condições observadas. A variação decorre da composição; inclusive, a contribuição conjunta dos novos indicadores está abaixo do centro da escala. Todos os valores continuam referentes a 2022.

## Sobreposição e precisão

As correlações dos percentis orientados são 0,847 entre habitação e renda; 0,802 entre conectividade e renda; e 0,649 entre as duas candidatas. A matriz completa de sete indicadores está no JSON. São associações descritivas nas 26 capitais; não estimam contribuição causal ou informação independente. Correlação alta exige discutir o peso conjunto, mas não torna dois construtos equivalentes. Não se aplicou PCA nem se estimaram pesos para maximizar discriminação.

A [diligência anterior de precisão](HABITACAO_CENARIOS.md) não validou erro amostral municipal. As funções generalizadas examinadas se referem a níveis geográficos mais agregados. Não foram usados totais expandidos como tamanho de amostra, intervalos binomiais, intervalos de confiança para a nota ou probabilidades de ordenação. A faixa entre cenários representa **sensibilidade às escolhas**, não incerteza amostral. Os dois candidatos compartilham desenho amostral; não se presume independência dos erros.

## Roadmap a partir desta entrega

| Etapa | Entrega | Critério para avançar |
|---|---|---|
| Concluída | Aquisição e análise conjunta de habitação/conectividade | Coorte reconciliada, 18 cenários reproduzíveis, decomposição e exportação auditáveis |
| Próxima | Protocolo de precisão e divulgação municipal | Examinar o anexo oficial de variância já localizado e documentação municipal; registrar o que permite estimar precisão de proporções e sua covariância; se insuficiente, justificar regra de divulgação sem inferência ou manter bloqueio |
| Depois | Parecer sobre conteúdo e pesos da candidata v3 | Aprovar ou rejeitar agrupamento material, orçamento e definição de adensamento por argumentos de conteúdo; registrar decisão sem otimização de posições |
| Antes da promoção | Revisão metodológica independente | Confirmar interpretação, fontes, precisão/divulgação, sensibilidade e limites; aprovação explícita da edição |
| Após aprovação | Integração da nova edição ao produto | Identificar edição, oferecer comparação v2/v3 e distinguir efeito de composição de evolução no tempo |

Adquirir mais indicadores não substitui resolver esses critérios. Países, os 16 capítulos completos, satisfação e eficiência causal permanecem fora do escore implementado. O painel descritivo em produção segue disponível.

## Reprodução e auditoria

Usar **Python 3.12**, a versão configurada na CI. A soma de floats do Python 3.9 pode diferir nos últimos bits dos snapshots gerados com 3.12; essa diferença de ambiente não deve provocar reescrita da v2.

```sh
python3.12 -m pipeline.eficiencia_resultados.cesta_conjunta
python3.12 -m unittest pipeline.eficiencia_resultados.test_cesta_conjunta pipeline.eficiencia_resultados.test_habitacao pipeline.eficiencia_resultados.test_habitacao_cenarios pipeline.eficiencia_resultados.test_conectividade
```

22 testes locais aprovados, oito novos. A CI inclui o novo módulo. Testes cobrem reconciliação com o experimento anterior, identidade/coorte, ausência sem imputação, pesos explícitos, decomposição, reprodução dos arquivos e preservação da v2. Os hashes das entradas ficam no JSON; os auditores de aquisição conferem as fontes brutas antes dos cálculos.

- [Resultado completo, percentis, pesos, fontes e decomposição](cesta-conjunta.json)
- [468 linhas cidade–cenário em CSV](cesta-conjunta.csv)
- [Auditoria de Habitação](HABITACAO_ADENSAMENTO.md)
- [Auditoria de Conectividade](CONECTIVIDADE_MUNICIPAL.md)
- [Elegibilidade e roadmap dos 16 capítulos](ELEGIBILIDADE_16_CAPITULOS.md)
