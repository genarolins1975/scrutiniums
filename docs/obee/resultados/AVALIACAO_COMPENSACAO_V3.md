# Avaliação de compensação e comparabilidade da candidata v3

12/10/2026 · Análise técnica do autor da implementação, não parecer independente.

## Recomendação e efeito no painel

**Apresentar cada comparação agregada junto de sua sensibilidade às escolhas de composição.** A nota isolada esconde casos em que a capital com maior valor muda quando adotamos outra ponderação igualmente disponível no experimento. Não selecionar pesos para preservar ou favorecer uma ordem.

O laboratório passa a responder “A ordem entre as capitais se mantém?”, com diferenças pareadas, quatro definições de habitação e os pontos de empate. A análise é aplicável à cesta conjunta de sete medidas. Os cenários isolados de habitação/conectividade continuam disponíveis, mas não recebem esse diagnóstico como se pertencessem à mesma família.

Não recomendar ainda a candidata como escore integral do OBEE, satisfação ou eficiência estatal. As sete medidas misturam condições dos residentes, infraestrutura e resultados, com universos distintos e Saúde ausente. A análise abaixo trata da dependência da comparação em relação às escolhas de agregação; não resolve cobertura conceitual ou precisão municipal. O parecer propositivo anterior permanece válido; nenhuma aprovação foi registrada.

## O que foi testado

Mantemos dados de 2022, 26 capitais, sete indicadores, percentis orientados e média aritmética. O peso total do bloco renda/saneamento/habitação/conectividade varia continuamente de **2/5 (40%) a 4/7 (aproximadamente 57,14%)**. Os quatro itens dividem esse orçamento igualmente; educação, mobilidade e segurança dividem igualmente o restante. Os extremos reproduzem exatamente os dois modelos existentes.

Para cada cidade, definição de habitação e orçamento material b:

`S(b) = (1 − b) × média dos três itens restantes + b × média dos quatro itens materiais`.

Para duas cidades A e B sob o mesmo orçamento, a diferença é:

`Δ(b) = dO + b × (dM − dO)`,

onde dO e dM são as diferenças entre as médias dos blocos. Como a função é afim em b, seus extremos em um intervalo fechado estão nos extremos do intervalo. Assim, verificar os dois extremos de cada uma das quatro definições permite classificar **toda essa família contínua**, sem simular uma grade de pesos. Se dM ≠ dO, o empate ocorre em `b* = −dO / (dM − dO)`, quando o resultado pertence à faixa. Se os dois termos forem zero, o empate vale em toda a faixa.

Percentis e operações são reconstruídos com frações exatas. A classificação de empates e inversões não usa números arredondados da interface nem uma tolerância para decidir o sinal. As notas dos extremos precisam reconciliar com o experimento preservado. A sensibilidade considera sempre A e B sob a mesma hipótese; não subtrai extremos de cenários diferentes de duas cidades.

## Resultados calculados

| Classificação na família declarada | Pares de capitais |
|---|---:|
| Mesma ordem estrita em todas as quatro definições e em toda a faixa | 294 |
| A direção pode se inverter | 30 |
| Pode haver empate, sem inversão | 1 |
| Empate em toda a família | 0 |
| Total | 325 |

Essas contagens descrevem a família escolhida; não são frequências de sucesso, probabilidades ou confiança estatística. A divisão interna igual de cada bloco é uma restrição forte. O teste não varia livremente os sete pesos, a normalização, o conjunto de indicadores ou os erros das fontes.

**Recife e Curitiba:** a diferença Recife menos Curitiba fica entre −46,70 e −41,92 pontos. Curitiba conserva a nota maior nesta família. Isso não demonstra superioridade em todos os serviços, eficiência da gestão ou significância estatística.

**Aracaju e Teresina:** a diferença Aracaju menos Teresina pode ir de −5,38 a +5,49 pontos. Na definição domicílios >2 por dormitório, o empate acontece quando o orçamento material é `28/59`, aproximadamente 47,46%. Com 40%, a diferença é −4,23; com sete pesos iguais, +5,49. Uma ordenação isolada esconderia essa escolha normativa.

**São Paulo e Teresina:** o empate ocorre no extremo 40% com moradores >3; não há inversão nesta família. O laboratório distingue esse caso de uma ordem estrita preservada.

Como diagnóstico adicional, 55 pares apresentam dominância componente a componente em todas as quatro definições: a mesma cidade nunca tem percentil menor e tem ao menos um maior em cada definição. Para esses pares, qualquer combinação linear com os sete pesos estritamente positivos conserva essa direção, condicionada às medidas e definições usadas. Os outros 239 pares de ordem estrita estável não recebem esse certificado mais amplo. Esse diagnóstico não cria ranking geral nem elimina os limites das fontes.

## Decisões metodológicas que a evidência permite

| Questão | Recomendação técnica | Limite que permanece |
|---|---|---|
| Escolher 40% por alterar menos a ordem da v2? | Não. Preservar uma ordem anterior não valida a prioridade social dos pesos | Aceite substantivo dos pesos e do agrupamento |
| Tratar uma diferença positiva no cenário selecionado como conclusão invariável? | Mostrar o resultado da família de sensibilidade ao lado da nota | A família não abrange todas as especificações plausíveis |
| Trocar automaticamente pela média geométrica? | Não. Isso altera compensações, mas não escolhe quais são socialmente admissíveis | Decisão sobre substitutibilidade entre dimensões |
| Publicar apenas um pódio? | Manter comparação pareada e perfil das medidas; expor inversões e empates | Cobertura parcial, desigualdades intramunicipais e precisão |
| Declarar o agregado validado porque a aritmética passou? | Não. Reprodução e consistência são evidências técnicas distintas da validade de conteúdo | Revisão independente e decisão editorial continuam pendentes |

O [manual OECD/UE/JRC de índices compostos (2008)](https://doi.org/10.1787/9789264043466-en), nas seções de agregação e de análise de sensibilidade, orienta examinar compensações e dependência das conclusões em relação às escolhas do modelo. A agregação geométrica ainda admite compensações. O manual não prescreve os pesos, a família de análise ou a cesta OBEE; a seleção acima é nossa hipótese de pesquisa, explicitada para revisão. [PDF oficial](https://www.oecd.org/content/dam/oecd/en/publications/reports/2008/08/handbook-on-constructing-composite-indicators-methodology-and-user-guide_g1gh9301/9789264043466-en.pdf).

## Reprodução e integridade

- Cálculo: `python3.12 scripts/obee_sensibilidade_pares.py`.
- Casos adversos e reconciliação: `python3.12 -m unittest scripts.test_obee_sensibilidade_pares`.
- Saída: `sensibilidade-pares-v3.json`, com 325 pares, quatro linhas por par, limites, raízes exatas e hash do experimento de origem.
- Interface: regenerar com `python3.12 docs/obee/resultados/review-ui/generate.py`.

Fonte imediata: `cesta-conjunta.json`, SHA-256 `15339579dc2cceecd3c237569e011640aa2b7198329dbfd9c081075c3c1de7bd`. Nenhum dos 54 arquivos do pacote congelado foi alterado. Este documento, o diagnóstico e a apresentação são materiais complementares; não se autodeclaram pareceres recebidos nem mudam `publication_ready=false`.
