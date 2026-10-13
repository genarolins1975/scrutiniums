# Habitação municipal: auditoria de adensamento de 2022

Data: 12/10/2026. Continuação da prioridade P1 do [roadmap](ELEGIBILIDADE_16_CAPITULOS.md). Base do projeto: `0a32b62293e391c8f78cf64e243d867c038d56d0`.

## Decisão

**Fonte municipal confirmada e adquirida para as 26 capitais.** Habitação avança de hipótese de aquisição para candidato em revisão. Ainda não entra no escore: faltam avaliação da precisão amostral municipal, revisão de conteúdo e decisão sobre redundância/pesos. A cesta v2 e o contrato de Saúde permanecem inalterados.

O candidato mede a parcela de domicílios com mais de dois moradores por cômodo utilizado como dormitório. É um aspecto das condições habitacionais, não o déficit habitacional da FJP, a satisfação com a moradia ou uma avaliação causal da política pública. O limiar >2 corresponde à agregação de categorias oficiais usada nesta investigação; >3 é preservado como alternativa descritiva. Não se afirma que >2 seja um padrão universal de inadequação.

## Fonte e contrato

| Item | Evidência adquirida |
|---|---|
| Fonte principal | IBGE, Censo 2022, SIDRA 9934 |
| Universo | Domicílios particulares permanentes ocupados; totais nas classificações de moradores por idade |
| Unidade | Estimativas de domicílios, não pessoas nem observações individuais da amostra |
| Referência territorial | Municípios das 26 capitais estaduais, identificados por código IBGE; DF fora da coorte |
| Numerador >2 | Classificação 1975: categorias 73089 + 73090 |
| Denominador | Mesma tabela, variável 381, categoria 73086 (Total) |
| Alternativa >3 | Categoria 73090 / 73086 |
| Conferência | Variável 1000381: percentuais oficiais das cinco categorias |
| Unidade alternativa | SIDRA 9940, variável 382: moradores; totais de cor/raça e idade. Não mistura com denominador de domicílios |
| Natureza | Resultados preliminares da amostra; sujeitos a revisão e erro amostral |

Segundo a definição do IBGE, o dormitório corresponde ao cômodo utilizado permanentemente para dormir por morador do domicílio; não precisa ser um quarto construído exclusivamente para esse fim. A publicação consultada apresenta domicílios e moradores como unidades distintas. A aquisição não autoriza chamar esses números de contagens exaustivas do universo.

Foram preservadas duas respostas completas de dados e dois metadados. Cada resposta contém 26 municípios × cinco categorias × duas variáveis = 260 células: **520 células conferidas**. Consultas integrais, data e hashes SHA-256 estão no [manifesto](../../../pipeline/eficiencia_resultados/seed/habitacao/manifest.json). As URLs das APIs também permitem readquirir os arquivos; alterações de bytes são detectadas pela auditoria e exigem revisão da captura.

## Resultados descritivos

| Capital | Domicílios estimados | Domicílios com >2 moradores/dormitório | Parcela dos domicílios | Parcela dos moradores vivendo nessa condição |
|---|---:|---:|---:|---:|
| Recife | 547.539 | 51.354 | 9,3791% | 15,6496% |
| Curitiba | 685.739 | 29.849 | 4,3528% | 7,5410% |

A diferença entre as duas últimas colunas decorre da unidade de ponderação: domicílios com mais pessoas têm maior peso no indicador de moradores. Não é divergência entre fontes. Nenhum intervalo de confiança foi calculado a partir desses totais expandidos.

Na coorte examinada, o percentual de domicílios varia de 4,3528% (Curitiba) a 27,2014% (Boa Vista). Essa amplitude demonstra dispersão observada, mas não comprova separação estatística entre as cidades. [Saída integral e diagnósticos](habitacao-adensamento-auditoria.json).

## Redundância e interpretação

Para comparação com a cesta atual, o adensamento foi orientado como “menor é melhor” e convertido em posições relativas usando a mesma regra de empates. Esses percentis são apenas instrumentos de diagnóstico; não foram agregados a uma nota nova.

| Relação entre percentis orientados, 26 capitais | Correlação |
|---|---:|
| Menor adensamento × maior renda mediana | 0,846640 |
| Menor adensamento × maior cobertura das categorias de esgotamento do piloto | 0,736752 |

Os valores indicam forte associação e possível sobreposição de condições materiais. Não justificam excluir automaticamente Habitação, mas tornam inadequado acrescentar um sexto peso igual sem analisar o peso conjunto desses aspectos. Também não medem causalidade ou valor social relativo dos capítulos.

## Qualidade, limites e condições de avanço

- Metadados e registros reconciliam município, ano, unidade, variável, categorias e totais dos demais recortes. Duplicatas, marcadores de ausência, valores não finitos e substituição de município por UF são rejeitados.
- As quatro parcelas são estimativas publicadas em unidades inteiras. A maior diferença observada entre soma das parcelas e total é uma unidade; o limite de conferência é 2,5 unidades, correspondente ao arredondamento independente de quatro parcelas e do total. Não se força uma igualdade artificial.
- Percentuais oficiais são conferidos contra razões das estimativas, com tolerância de 0,005 ponto percentual acrescida de 100/denominador para os arredondamentos independentes. A medida >2 é calculada com o numerador agregado e o total, sem somar percentuais arredondados.
- Os metadados adquiridos não oferecem uma variável de coeficiente de variação municipal. Isso não prova que tal informação inexista em outros produtos. A auditoria não atribui precisão nacional aos municípios nem trata os totais estimados como tamanho amostral para construir intervalos binomiais.
- Não inclui população sem domicílio, domicílios coletivos ou improvisados. Não mede custo do aluguel, estabilidade da posse, acesso a serviços ou toda a adequação habitacional.

Próximo trabalho: buscar documentação ou medidas de precisão para o recorte e comparar as alternativas >2, >3 e ponderação por moradores. Antes de eventual cesta v3, revisar o tratamento conjunto de renda, saneamento e habitação e examinar o impacto nas comparações. Uma nova composição deve permanecer separada da v2 e não pode ser apresentada como evolução temporal.

## Reprodução e verificação

Na raiz do repositório, sem rede e apenas com biblioteca padrão:

```sh
python3 -m pipeline.eficiencia_resultados.habitacao
python3 -m unittest pipeline.eficiencia_resultados.test_habitacao
```

Seis testes aprovados: saída congelada, denominadores/unidades, ausências e inválidos, recorte territorial/temporal, duplicatas/reconciliação e contrato de metadados. Testes incluídos na CI. A suíte integral e o build desta entrega dependem da nova execução remota.

## Fontes oficiais

- [Tabela SIDRA 9934 — domicílios](https://sidra.ibge.gov.br/tabela/9934).
- [Tabela SIDRA 9940 — moradores](https://sidra.ibge.gov.br/tabela/9940).
- [Características dos domicílios: resultados preliminares da amostra](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102150.pdf), páginas impressas 6–7 e 38–39. PDF adquirido e hash registrado; definição e limites consultados no texto.

A apresentação de divulgação localizada na busca contém uma referência a 9942 junto ao gráfico de adensamento; os metadados dessa tabela identificam Internet. Por isso o contrato e a aquisição utilizam as tabelas verificadas 9934/9940, e nenhum valor foi transcrito daquele gráfico.

## Continuidade

A [análise de oito cenários de composição](HABITACAO_CENARIOS.md) foi concluída em 12/10/2026, com comparação de limiares, unidades e pesos e diligência da Nota metodológica 07/2024. Mantém Habitação como candidato, sem promoção ao escore.
