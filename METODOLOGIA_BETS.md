# METODOLOGIA_BETS.md — aba "Bets e risco financeiro"

## Princípio central
O painel **não parte da conclusão** de que bets causam inadimplência. Ele investiga a hipótese e comunica corretamente o grau de evidência. Correlação temporal nunca é apresentada como causalidade. Todo elemento visual declara em qual categoria está: dado observado, dado administrativo, estimativa, pesquisa declaratória, associação exploratória, evidência causal ou hipótese ainda não testada.

## Hierarquia de evidências (visível em cada gráfico e indicador)
- **A** dado administrativo oficial (SIGAP/SPA, BCB, RFB, DATASUS, STF/DOU)
- **B** pesquisa oficial representativa (DataSenado, IBGE)
- **C** estudo acadêmico com método identificável (working papers marcados)
- **D** estimativa privada com metodologia publicada (interesse do emissor declarado)
- **E** associação exploratória ou número sem validação em fonte primária (ex.: imprensa citando SIGAP)

## Conceitos protegidos por teste automatizado
Turnover ≠ depósitos ≠ saques/prêmios ≠ fluxo bruto ≠ fluxo líquido ≠ perda do apostador ≠ GGR ≠ receita ≠ arrecadação ≠ destinações. Apostador cadastrado ≠ ativo ≠ CPF único ≠ conta. Pessoa ≠ família ≠ domicílio. Mercado regulado ≠ mercado ilegal (nunca somados). Média ≠ mediana (quando só há média, o painel diz isso).

Regras codificadas em `src/tests/bets-data.test.ts`:
1. Fórmula do GGR: ano 2025 = 1S2025 + 2S2025 (derivação por subtração da mesma fonte, marcada `calculado`).
2. O fluxo Pix de 2024 carrega `quebra_metodologica: true` e nunca entra na mesma série do GGR.
3. Nenhuma série oficial semestral possui pontos mensais (proibição de interpolação).
4. Todo item tem `nivel` ∈ {A..E}, `status` ∈ {oficial, calculado, estimativa, imprensa}, URL https e data de referência.
5. Números de imprensa jamais aparecem com nível A.
6. Refs ordenadas, sem duplicidade; datas dentro de [2018, corte].

## Por que ainda não existe "Índice de risco das bets"
A série regulada tem 3 observações públicas (2 semestres oficiais + 1 trimestre de imprensa) e quebra estrutural em jan/2025. Com n=3: sem correlação, sem defasagem, sem índice, sem modelo. O explorador exibe as séries de crédito (mensais, longas, do SGS) com marcos regulatórios anotados e o rótulo fixo "sem evidência suficiente". Limiar para cálculo de correlações: **n ≥ 8** observações comparáveis da exposição.

Sequência planejada quando houver histórico: estatística descritiva → correlações contemporâneas → defasagens → estabilidade → controles macro (renda, desemprego, juros, inflação) → estacionariedade e quebras → IC e correção para múltiplos testes → sensibilidade.

## Requisitos para publicar leitura causal
Choque plausivelmente exógeno; grupo de comparação válido; tendências prévias compatíveis; controles adequados; ausência de antecipação; testes placebo; robustez a especificações; interpretação economicamente coerente. O início nacional da regulação (jan/2025) NÃO é experimento causal: não há contrafactual nacional. Evidência internacional (Baker et al.; Hollenbeck et al.) demonstra mecanismo plausível e sugere defasagens de 2 a 4 anos, mas não estima o efeito brasileiro.

## Modelos preditivos (futuros)
Somente com: informação disponível na data simulada (vintages), sem vazamento temporal, treino/validação/teste separados, ganho demonstrado fora da amostra contra benchmarks simples, erros e instabilidade publicados, selo EXPERIMENTAL.

## Open Finance e pesquisa futura
Potencial: depósitos a operadores autorizados, perda líquida mensal, uso de limite após apostas, saldo antes/depois, recorrência, atraso de contas, rotativo e cheque especial, contratação posterior de crédito, redução de poupança — sempre em base agregada/anonimizada. Salvaguardas obrigatórias: minimização, células mínimas, controle de reidentificação, finalidade delimitada, consentimento válido, RIPD (LGPD), revisão jurídica e ética. Vedações absolutas: monitoramento individual, score de "apostador de risco", negativa automática de crédito por transação de aposta.

## Design
Sóbrio, institucional, semiacadêmico, no design system do Observatório. Sem estética de cassino, neon, fichas ou gamificação. Azul = dado observado; âmbar = estimativa/cautela; vermelho = risco/deterioração; cinza = indisponível ou não confirmado. Narrativa vertical, gráficos de um eixo (dois eixos vetados por produzirem relações visuais artificiais), fontes e períodos visíveis em todos os rodapés, alternativa tabular acessível em cada gráfico interativo.

## O que o painel responde hoje (síntese honesta)
- **Exposição**: 25,2 mi de CPFs apostaram no mercado regulado em 2025; GGR de R$ 37,0 bi (perda líquida agregada); média ≈ R$ 164/mês por apostador no 1S2025 (mediana desconhecida) [A].
- **Mecanismos**: cadeia renda → depósitos → perdas comprovada no agregado [A]; perdas → poupança/crédito caro com evidência causal internacional [C]; elos de renegociação e atraso ainda hipóteses no Brasil.
- **Relações medidas no Brasil**: apenas associações (DataSenado 42% vs 32%; surveys privados) e estimativas contestadas (CNC). Nenhuma evidência causal doméstica até 31/07/2026.
- **Hipóteses abertas**: efeito sobre inadimplência, renegociação e poupança das famílias brasileiras; espera-se identificação possível com POF 2024-25, microdados de crédito e defasagens de 2 a 4 anos.
