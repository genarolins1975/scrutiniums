# PLD: arquitetura didática

Ordem mental: primeiro entender o sistema, depois o preço, depois a previsão, por último auditar o modelo. O artefato `PLD_PREVISOES_EXPLICADAS v1-previa-r4` foi lido por completo (payload `vis-1.0`, 12 capítulos, 21 afirmações rastreadas). Dele se preserva a disciplina (mapa de afirmações com fonte e revisão, estados explícitos, suporte comum para calibração, "o que não é" declarado, rodada real sem número exibida como indisponível). Não se preserva a arquitetura: ela começa pelos candidatos B0, C1, C2 e por quantis, o que serve ao pesquisador e bloqueia o leitor geral.

## Página única, três modos

`/setor-eletrico/pld` com `ModoProfundidade`: **Entender** (padrão), **Analisar**, **Auditar**. Os modos acrescentam blocos; não trocam de página.

| Bloco | Entender | Analisar | Auditar |
| --- | --- | --- | --- |
| 1. O que é, o que não é | sim | sim | sim |
| 2. De onde vem o preço (diagrama) | sim | com estado atual de cada nó | com fonte e tipo de relação de cada seta |
| 3. O que está acontecendo | cartões dos 4 submercados | curva horária, períodos, volatilidade, permanência | tabela horária, regras de classificação, downloads |
| 4. Por que os submercados diferem | mapa simples | fluxos diários e diferença de preço | dados de intercâmbio e limitações |
| 5. Para onde o PLD pode ir | estado da previsão em linguagem humana | distribuição e histórico de desempenho | model card, vintage, métricas, arquivo |

## Bloco 1. Entenda em 90 segundos

* **Definição** (fonte: descrição oficial da organização "Preço de Liquidação das Diferenças" no portal de dados abertos da CCEE, conjunto PLD_HORARIO, capturada em 27/09/2026): o PLD é calculado pela CCEE diariamente para cada hora do dia seguinte, por submercado, a partir do Custo Marginal de Operação (CMO) produzido pelos modelos NEWAVE, DECOMP e DESSEM, com aplicação dos limites mínimo e máximos (horário e estrutural) vigentes. Texto na página com duas frases, sem jargão, e a íntegra da fonte no modo Auditar.
* **O que o PLD não é**: sua tarifa de energia; simplesmente "o preço da última usina"; uma cotação de bolsa formada só por lances; uma previsão meteorológica. Cada item com o porquê em linguagem simples e fonte.
* **Ideia central**: o sistema é hidrotérmico e intertemporal. Usar água hoje significa não tê-la amanhã; por isso a água armazenada tem valor de oportunidade e esse valor entra no custo marginal calculado pelos modelos.

## Bloco 2. De onde vem o preço

Diagrama interativo (SVG acessível, navegável por teclado):

```
Chuva e afluências (ENA) → Reservatórios e valor da água (EAR)
                  + Carga
                  + Eólica, solar e outras fontes
                  + Disponibilidade e custo das térmicas (CVU)
                  + Rede, intercâmbios e restrições
                  ↓
        Otimização da operação (NEWAVE, DECOMP, DESSEM)
                  ↓
                 CMO
                  ↓
        Regras e limites (PLD mínimo, máximo horário, máximo estrutural)
                  ↓
                 PLD
```

Cada nó abre um painel com: o que é; estado atual (quando o dado está integrado; senão "ainda não integrado"); histórico; fonte; link para o módulo. Cada seta declara o **tipo de relação**:

| Tipo | Uso |
| --- | --- |
| Mecanismo econômico | relação estrutural descrita pela documentação oficial |
| Informação usada pelos modelos oficiais | insumo declarado dos modelos de formação de preço |
| Associação estatística | correlação medida pela Scrutiniums, com janela e coeficiente |
| Interpretação analítica | leitura da Scrutiniums, marcada como tal |
| Contribuição de modelo proprietário | peso ou contribuição em modelo da Scrutiniums; nunca "causa" |

## Bloco 3. O que está acontecendo

Quatro submercados (Sudeste/Centro-Oeste, Sul, Nordeste, Norte); períodos `Hoje | 7 dias | 30 dias | 12 meses | Histórico`; curva horária do dia de referência. Perguntas respondidas com regra publicada:

| Pergunta | Regra |
| --- | --- |
| Há diferença entre submercados? em que horas? | diferença horária máxima entre submercados no dia; horas com diferença acima de R$ 1/MWh |
| Está no menor valor observado do ano? | fração de horas no menor valor horário observado no ano civil. **Não é o piso regulatório**: o limite oficial não foi auditado nesta fase |
| Houve picos? | máximo horário do período e hora em que ocorreu |
| É baixo, intermediário ou alto? | percentil do PLD médio diário na distribuição dos PLD médios diários desde 01/01/2021 (nominal); faixa baixa abaixo de P25, central de P25 a P75, alta acima de P75 |
| Qual a volatilidade? | desvio padrão dos valores horários no período |
| Quanto tempo em cada regime? | fração de horas do período em cada faixa (abaixo de P25, P25 a P75, acima de P75) da distribuição horária de referência |

Valores nominais; limites regulatórios mudam a cada ano, o que torna comparações longas imperfeitas (declarado como limitação).

## Bloco 4. Por que os submercados podem diferir

Mapa esquemático com quatro nós e as quatro fronteiras monitoradas pelo ONS (N e NE, N e SE/CO, NE e SE/CO, S e SE/CO). Mostra fluxo médio diário verificado e diferença de PLD entre as pontas. Mensagem: energia abundante em uma região não elimina diferença de preço em outra quando a transferência entre elas é limitada. Os limites de intercâmbio não estão integrados; o bloco diz isso explicitamente.

## Bloco 5. Para onde o PLD pode ir?

Subtítulo fixo: "Previsão é distribuição de possibilidades, não um único número."

* Só modelo em PRODUÇÃO alimenta este bloco (ver governança). Hoje nenhum modelo está em produção: o bloco mostra **Previsão indisponível**, o motivo, a última execução interna registrada, a informação faltante e o estado do pipeline.
* Quando houver previsão: mediana, faixa P10 a P90 somente se calibrada, realizado quando disponível; texto "Como ler" gerado dos metadados do modelo; "O que mudou desde a previsão anterior" separando **mudou na informação** de **contribuição do modelo**; "Por que confiar" começando por "O modelo tem acertado?" (previsão, realizado, erro), depois erro típico, depois "a faixa funciona?", só então MAE, RMSE, pinball, cobertura, largura, amostra, intervalo de confiança e benchmark.

## Critério de aceite

| Público | Consegue em até 3 minutos |
| --- | --- |
| Investidor | explicar o que é o PLD, por que muda, por que difere entre regiões, o que acontece agora, o que a previsão diz e quão confiável tem sido |
| Pesquisador | identificar fonte, baixar série, ler definição, saber cutoff, conhecer o modelo, reproduzir transformação, achar limitações |
| Especialista | não encontra simplificação conceitualmente errada |
