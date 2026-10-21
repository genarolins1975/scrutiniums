# Conectividade domiciliar municipal — auditoria 2022

12/10/2026. Base do projeto: `2068912f3c8103fd0fe66ab6f40357992fe3af88`.

## Resultado e decisão

Confirmada a disponibilidade de conexão domiciliar à Internet para as mesmas 26 capitais da cesta de resultados. Foram adquiridas e conferidas **156 células** da tabela SIDRA 9936: 26 municípios × três categorias × duas variáveis. Energia e conectividade passa a ter um candidato municipal adquirido, sem promoção ao escore.

O candidato mede a proporção dos domicílios particulares permanentes ocupados em que algum morador tinha acesso à Internet no domicílio. É uma estimativa preliminar da amostra do Censo 2022. Não mede qualidade, velocidade, preço, continuidade, habilidade digital ou utilização dos serviços do Estado; não representa todo o capítulo Energia e conectividade.

## Contrato de aquisição

| Campo | Definição |
|---|---|
| Fonte | IBGE, [SIDRA 9936](https://sidra.ibge.gov.br/tabela/9936) |
| Ano / geografia | 2022; municípios das 26 capitais estaduais, por código IBGE; DF fora |
| Universo | Domicílios particulares permanentes ocupados; total de condição de ocupação e tipo de domicílio |
| Numerador | Variável 381, classificação 2072, categoria 77585: Sim |
| Denominador | Mesma variável e classificação, categoria 77584: Total |
| Complemento | Categoria 77586: Não |
| Recortes fixos | Classificação 63: 95826; classificação 125: 2932 |
| Percentual | 100 × numerador / denominador; conferência contra variável 1000381 |
| Polaridade diagnóstica | Maior presença de conexão é melhor neste aspecto específico |

Respostas, metadados e URLs integrais estão em `pipeline/eficiencia_resultados/seed/conectividade/`. O manifesto registra hashes dos bytes armazenados e do transporte; quando a resposta veio comprimida, o JSON foi descomprimido com gzip antes da leitura, sem reserializar o conteúdo original.

## Resultados selecionados

| Capital | Domicílios estimados | Com conexão | Sem conexão | Com conexão (%) |
|---|---:|---:|---:|---:|
| Recife | 547.539 | 489.530 | 58.009 | 89,4055 |
| Curitiba | 685.739 | 645.858 | 39.881 | 94,1842 |

Na coorte examinada, os percentuais variam de 85,8919% a 95,8054%. Não são taxas atuais de 2026. Não se comparam diretamente com o recorte nacional/urbano/rural da PNAD TIC 2025 publicado no painel existente.

## Informação adicional e sobreposição

Percentis orientados, usados apenas no diagnóstico de redundância:

| Comparação, 26 capitais | Correlação |
|---|---:|
| Conectividade × renda mediana | 0,801846 |
| Conectividade × saneamento da cesta v2 | 0,631453 |
| Conectividade × menor adensamento domiciliar >2 | 0,649231 |

A associação com renda é forte. Conectividade acrescenta uma característica distinta, mas sua inclusão com peso igual exige avaliar o peso conjunto das condições materiais. Não se deduz que o indicador seja dispensável apenas pela correlação, nem que maior acesso resulte da eficiência do governo municipal.

## Conferências e limitações

O auditor valida município, ano, variável, unidade, categorias Sim/Não/Total e recortes. Rejeita duplicatas, valores não finitos, marcadores de ausência e números fora do domínio. As duas parcelas e o total admitem até 1,5 unidade de diferença por arredondamento independente. Percentuais admitem 0,005 ponto percentual acrescido de 100/denominador; nenhuma ausência vira zero.

A precisão municipal continua pendente. A [diligência da Nota metodológica 07/2024](precisao-habitacao-evidencia.json) não sustenta aplicar funções nacionais/estaduais às proporções municipais. Não foram calculados intervalos binomiais usando totais expandidos como se fossem amostras. Os resultados são preliminares e não representam certeza sobre a ordem de cidades próximas.

A definição foi conferida na publicação [Características dos domicílios](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102150.pdf), página impressa 42; documento adquirido e hash preservado no manifesto da auditoria de Habitação. O quesito de 2022 não equivale ao de microcomputador com Internet do Censo 2010.

## Atualização — análise conjunta concluída

A [proposta de cesta v3](CESTA_CONJUNTA_V3.md) conclui o experimento de 18 cenários e 468 linhas cidade–cenário. A próxima etapa é o protocolo de precisão/divulgação municipal, seguido do parecer sobre conteúdo e pesos. Nenhuma candidata foi promovida.

## Encaminhamento original, agora concluído

Concluir uma comparação conjunta das duas candidatas, Habitação e Conectividade, com a cesta v2. Examinar inclusão isolada e conjunta, preservando ou alterando explicitamente o peso das condições materiais. O produto será uma proposta de cesta e um quadro claro de ganhos, sobreposição e limitações, sem escolher pesos por conveniência do ranking. A promoção exige decisão metodológica e regra de precisão/divulgação justificada; os cinco indicadores vigentes permanecem congelados.

## Reprodução

```sh
python3 -m pipeline.eficiencia_resultados.conectividade
python3 -m unittest pipeline.eficiencia_resultados.test_conectividade pipeline.eficiencia_resultados.test_habitacao pipeline.eficiencia_resultados.test_habitacao_cenarios
```

Quatorze testes locais aprovados, quatro novos. O módulo foi incluído na CI. [Resultado completo](conectividade-auditoria.json). Nenhuma alteração de UI, escore vigente ou liberação de produção.
