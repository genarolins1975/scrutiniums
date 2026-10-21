# Relatório final: redesenho editorial e avaliação independente do observatório de energia

Referência: 09/10/2026. Ramo `claude/kind-mayer-v9tpwi`, fundido com `origin/main` de 09/10/2026 (82 commits do outro observatório e do contrato de datas). Sem merge do pull request e sem publicação.

## 1. Veredito e bloqueios

**Parcialmente aprovado.** Nenhuma das 31 páginas reavaliadas chegou a 9,0 nos doze critérios. O encerramento foi pedido pelo usuário antes de a meta ser alcançada ("Conclua, não precisa chegar em 9"), e este relatório não trata a meta como cumprida.

Evidência. Dos 9 bloqueios registrados na reavaliação independente, 7 foram corrigidos e cobertos por teste depois da avaliação. Esses 7 não foram repontuados: o executor não pontua o próprio trabalho, e a reavaliação por agentes novos foi dispensada. Restam 2 registros, os dois com a mesma causa: a referência regulatória de perdas por distribuidora está indisponível porque os servidores da ANEEL responderam com desafio de acesso nas datas de consulta. A página diz isso, com tentativas e datas, e não mostra valor de reserva.

| Página | Tipo de bloqueio | Avaliador | Estado em 09/10/2026 |
| --- | --- | --- | --- |
| `/conta-de-luz/reajustes-e-subsidios` | Divergência entre gráfico, tabela e frases com o seletor "Em reais" | produto | Corrigido: número, frase, "o que mudou" e tabelas falam na mesma moeda; teste novo `energia-conta-reais.test.ts` |
| `/inclusao-energetica/tarifa-social` | Ressalva essencial escondida: desconto negativo no ES e no RJ | produto | Corrigido: o valor da fonte aparece como publicado, com nota junto do número, classe própria no mapa e teste que cobre qualquer UF e mês |
| `/perdas/composicao` | Divergência de 0,01 entre rótulo do gráfico e tabela | produto | Corrigido: um valor só do gráfico ao CSV, com teste |
| `/perdas/custo-e-contexto` | Divergência de 0,01 entre barra e tabela | produto | Corrigido, com teste |
| `/perdas/custo-e-contexto` | Ressalva essencial escondida: base econômica no lugar da tarifa de aplicação | técnico | Corrigido: a base está no título da coluna, no título do gráfico, na primeira frase e na linha "Não permite concluir" |
| `/perdas/regulatorio` | Valor incorreto: variação errada em 7 de 49 distribuidoras na frase | técnico | Corrigido, com teste |
| `/perdas/regulatorio` | Divergência entre gráfico, tabela e CSV (14 de 49) | técnico | Corrigido: uma definição de variação em todos os pontos |
| `/perdas/regulatorio` | Barreira em tarefa essencial: referência regulatória por distribuidora indisponível | técnico | **Remanescente**, causa externa |
| `/perdas/regulatorio` | O mesmo bloqueio, registrado pelo avaliador de produto | produto | **Remanescente**, mesma causa |

Os 13 bloqueios da linha de base (versão anterior ao redesenho, 26 páginas) não voltaram a ser registrados na reavaliação das mesmas páginas. A exceção de cobertura é a Geração (4 páginas): ela teve linha de base e não teve reavaliação, de modo que o bloqueio da linha de base sobre a MMGD de 2023 dividida por 8.760 horas não foi reverificado por avaliador independente.

## 2. Matriz de notas

Notas de 0 a 10 dadas por avaliadores independentes (produto: critérios A, B, C, D, I, J, K; técnico: E, F, G, H, L), em contexto limpo, sobre o commit indicado em cada unidade. Nota "não verificado" nunca virou número.

### 2.1 Versão nova, 31 páginas

| Critério | Páginas com nota | Média | Mínima | Abaixo de 9 |
| --- | ---: | ---: | ---: | ---: |
| A Layout e hierarquia | 31 | 8,0 | 7,0 | 31 |
| B Didática | 31 | 7,8 | 6,5 | 31 |
| C Utilidade | 31 | 8,1 | 6,0 | 31 |
| D Impacto social | 31 | 7,8 | 6,0 | 31 |
| E Profundidade | 24 | 8,3 | 6,0 | 17 |
| F Benchmarks e comparabilidade | 24 | 8,1 | 5,5 | 20 |
| G Rigor setorial | 24 | 8,3 | 5,5 | 18 |
| H Rastreabilidade | 24 | 8,4 | 6,0 | 20 |
| I Visualizações | 31 | 7,9 | 7,0 | 31 |
| J Navegação e interação | 31 | 7,9 | 6,5 | 31 |
| K Acessibilidade e responsividade | 31 | 8,1 | 7,5 | 31 |
| L Confiabilidade técnica | 24 | 8,5 | 7,0 | 21 |

Os critérios técnicos têm 24 páginas porque a avaliação técnica de Carga e Rede (7 páginas) foi interrompida pelo limite de uso da conta e não foi refeita. Matriz completa por página: `avaliacao/MATRIZ_R2.md`.

### 2.2 Antes e depois, 22 páginas avaliadas nas duas rodadas

| Critério | Média antes | Média depois | Páginas que subiram | Iguais | Que caíram |
| --- | ---: | ---: | ---: | ---: | ---: |
| A Layout e hierarquia | 7,3 | 8,0 | 18 | 3 | 1 |
| B Didática | 7,2 | 7,9 | 16 | 4 | 2 |
| C Utilidade | 7,5 | 8,2 | 20 | 2 | 0 |
| D Impacto social | 7,2 | 7,8 | 17 | 5 | 0 |
| E Profundidade | 8,4 | 8,5 | 5 | 8 | 2 |
| F Benchmarks e comparabilidade | 8,4 | 8,5 | 6 | 7 | 2 |
| G Rigor setorial | 8,4 | 8,7 | 5 | 9 | 1 |
| H Rastreabilidade | 8,5 | 8,5 | 4 | 8 | 3 |
| I Visualizações | 7,4 | 8,1 | 18 | 2 | 2 |
| J Navegação e interação | 7,4 | 8,1 | 16 | 3 | 3 |
| K Acessibilidade e responsividade | 7,6 | 8,2 | 17 | 5 | 0 |
| L Confiabilidade técnica | 8,4 | 8,6 | 6 | 8 | 1 |

Inferência. Os critérios de produto subiram cerca de 0,6 a 0,7 ponto em média; os técnicos ficaram quase no mesmo lugar. As avaliações antes e depois foram feitas por agentes diferentes, em passos de meio ponto, e uma diferença de meio ponto numa página pode refletir o avaliador e não a página. Leia a tabela como direção, não como medida precisa. A comparação página a página está em `avaliacao/COMPARACAO_ANTES_DEPOIS.md`.

### 2.3 Cobertura da avaliação

| Situação | Páginas |
| --- | --- |
| Reavaliadas por produto e técnico | Inicial, Visão geral, Território (3); Água e clima (4); PLD (5); Conta de luz (2); Qualidade (1); Perdas (4); Inclusão (5) |
| Reavaliadas só por produto | Carga e Rede (7) |
| Só na linha de base, sem reavaliação | Geração (4) |
| Sem avaliação independente da versão nova | Mercado e Regulação, Transição e Expansão, Modelos e Previsões, Empresas, Aprenda, Dados e Metodologia e as demais filhas |

A reavaliação de Mercado e Regulação e de Transição e Expansão foi lançada e interrompida pelo limite de uso da conta. As unidades de Empresas, Modelos e Previsões e de Dados e Metodologia nunca chegaram a ser lançadas.

## 3. O que mudou

Evidência no repositório, por commit do ramo.

1. **Sistema editorial** `ed-*` no domínio Energia (`globals.css`, escopado em `.dominio-energia`), sem alterar tokens globais nem o outro observatório: abertura com título curto, duas frases, recorte, fonte e "Não permite concluir"; faixa de métricas; figura principal; capítulos; três profundidades (Entender, Analisar, Auditar) preservadas. Descrição em `DESIGN_SYSTEM.md`.
2. **Migração** da inicial, das 22 aberturas e das páginas filhas ao sistema, com os mesmos seletores de dados para gráfico, tabela, texto, KPI e CSV. Inventário em `INVENTARIO.md` e `../INVENTARIO_VISOES_REDESENHO.md`; verificação mecânica de que nenhuma visão sumiu em `MATRIZ_PRESERVACAO.md`.
3. **Rodada de melhoria pela avaliação independente**: listas de correção por unidade em `avaliacao/rodada2/CORRECOES_*.md`, tratadas pelos executores de Água, Conta, Qualidade, Inicial, Visão geral e Território, Perdas e Inclusão.
4. **Compartilhados**: botão "Baixar imagem" nos gráficos (PNG com título, fonte, versão e data), texto de apoio de 13 px e texto em SVG desenhado a 12 px, margem do eixo proporcional ao maior rótulo, rótulo de marco que quebra dentro da área, contorno nas classes claras do mapa de calor, legenda em texto das naturezas do dado, alvos de 44 px no celular, `aria-current` nas seções com página neta, lista de arquivos aberta em Analisar e Auditar, links sem pré busca nas páginas com dezenas de ligações, foco que não leva mais a página ao topo.
5. **Pipeline**: impressão digital (sha256) julgada nas checagens de CSV, versão do código no catálogo, aviso de troca de sinal na maior revisão, restauração dos arquivos baixáveis quando a construção do módulo regride, ressalva de desconto negativo por UF na Inclusão.
6. **Fusão com `origin/main`**: 22 arquivos em conflito resolvidos, o contrato de datas e literais de `main` cumprido nas páginas de Energia (teste de HTML do build, obrigatório no CI de `main`).
7. **Defeitos achados pela medição objetiva final e corrigidos antes do fechamento**, cada um com teste ou conferência no navegador: rolagem horizontal da página a 320 px em `/conta-de-luz/reajustes-e-subsidios` (a tabela de bandeiras excedia a coluna em 32 px; o espaçamento das células caiu no celular); rótulo de marco escrito sobre os rótulos finais das séries em Carga e em Tarifa social (o marco agora para onde a área do gráfico termina e passa para a esquerda do traço, com teste novo em `energia-comp-grafico-linhas.test.ts`); nome da seção cortado por reticências no cabeçalho a 320 px (agora quebra em duas linhas).

## 4. Pendências por família

Cada família tem o detalhe em `pedidos/<família>.md`. A tabela traz o que mais pesa.

| Família | Estado | Pendências principais |
| --- | --- | --- |
| Inicial, Visão geral, Território | Corrigida na rodada 2 | Roda e teclado no mapa do Território; padrão além da cor para daltonismo; 29 fichas "Comprove" que a Visão geral ainda não traz; texto do link de 24 px; peso do documento servido |
| Água e clima | Corrigida na rodada 2 | Primeira figura da abertura a 916 px em 1440 de largura, logo abaixo da dobra de 900 px (1.547 px antes do redesenho); mapa de bacias com classes só em %; faixa p10 a p90 em ENA e reservatórios; pedidos ao pipeline |
| PLD | **Lista de correção não executada** (44 critérios abaixo de 9, nenhum bloqueio) | Todos os itens de `avaliacao/rodada2/CORRECOES_U06.md`: submercado por estado, ponte para a conta, unidades, empate de meio centavo, datas de referência por fonte, quartis nominais, dias sem CMO do DESSEM |
| Conta de luz e Qualidade | Corrigidas na rodada 2 | Blocos de três colunas repetidos; REH, B1, fio B e SCEE sem definição; série anual de reajuste contra o IPCA; busca do município e mapa de Qualidade com contraste das classes claras; peso de 737 kB |
| Perdas | Bloqueios corrigidos; resto pendente | Referência regulatória por distribuidora (bloqueio externo); "percentual regulatório" ainda em títulos e na navegação; fichas "Comprove" com uma casa decimal; Tarifa de Aplicação na gold |
| Inclusão | Bloqueio corrigido; resto pendente | Barras de ano orçado ou parcial sem diferenciação; siglas CCC, MPV e ESS; tabelas largas em 390 px; numerador do proxy de cobertura com BPC sem quantificação |
| Carga e Rede | **Lista de correção não executada** (49 critérios, nenhum bloqueio) | Todos os itens de `avaliacao/rodada2/CORRECOES_U05_parte_produto.md`; avaliação técnica não concluída |
| Geração, Mercado e Regulação, Transição e Expansão, Modelos e Previsões, Empresas, Aprenda, Dados e Metodologia | Migradas na rodada 1, sem reavaliação | Sem lista de correção da versão nova |

Pedidos ao pipeline (não executáveis neste ambiente, que não tem bronze nem silver completos): regerar golds e CSV (27 de 32 golds carregam o sufixo "+alterado" no código), dicionário de colunas dos CSV, cabeçalho dos CSV com unidade e fonte, série de 2001 a 2020 do PLD, ressalva de desconto negativo na gold de Inclusão, fonte primária do relatório de perdas da ANEEL.

## 5. Medidas objetivas do estado final

Build de produção do commit de fechamento, 09/10/2026: 94 rotas, 320, 390 e 1440 px, nível Entender (282 medições), mais captura das 22 aberturas em quatro larguras. Método, comandos e limites em `VALIDACAO.md`; rota a rota em `OBJETIVO_ANTES_DEPOIS.md`. A linha de base é o ramo no commit `51747baf8`, antes do redesenho e antes da fusão com `main`.

| Medida | Linha de base | Estado final |
| --- | ---: | ---: |
| Violações do axe, regras A e AA | 0 | 0 |
| Medições com rolagem horizontal da página | 0 | 0 |
| Erros de console | 0 | 0 |
| Alvos de toque abaixo de 44 px em 390 px (rotas afetadas) | 225 (60) | 291 (38) |
| Alvos de toque abaixo de 24 px em 390 px | 0 | 0 |
| Textos em gráficos abaixo de 12 px efetivos | 4.157 de 9.169 (45%) | 1.417 de 9.149 (15%) |
| Textos de gráfico que passam da caixa do SVG | 71 | 10 |
| Visões anteriores com correspondente ou equivalência registrada | n/d | 1.025 de 1.025 |
| Aberturas com a figura principal na primeira tela de 1440 por 900 px | 0 de 22 | 5 de 22 |
| HTML por rota, mediana | 411 kB | 431 kB |
| JavaScript carregado por rota, mediana | 603 kB | 686 kB |
| Rotas com HTML acima de 600 kB | 8 | 11 |
| Tempo de carga de laboratório, mediana | 946 ms | 1.068 ms |
| Altura da página em 1440 px, mediana | 4.385 px | 5.094 px |

Evidência. Nenhuma violação do axe nas 282 medições, nenhuma rolagem horizontal depois da correção da tabela de bandeiras, e todas as visões anteriores preservadas. O texto dentro dos gráficos melhorou de 45% para 15% abaixo de 12 px efetivos. Os alvos abaixo de 44 px em 390 px caíram de 60 para 38 rotas e subiram de 225 para 291 alvos: 273 deles são caixas de seleção de 24 px dentro de rótulo de 44 px de altura (a área tocável é o rótulo) e 18 são botões e links de 44 px de altura e 29 a 42 px de largura; nenhum fica abaixo de 24 px.

Inferência. O redesenho melhorou o que a rubrica mede em leitura e acessibilidade, mas não encurtou as páginas nem as deixou mais leves: o conteúdo registrado cresceu (1.025 para 1.555 visões contadas) e o peso acompanhou, com a mediana de JavaScript 83 kB maior e três rotas a mais acima de 600 kB de HTML. A comparação não separa o que veio do redesenho do que veio da fusão com `main`.

Recomendação. Tratar o peso como pendência de engenharia: começar pelas 11 rotas com HTML acima de 600 kB (lista em `VALIDACAO.md`, seção 4) e pelo JavaScript carregado em todas as páginas, e medir LCP, INP e CLS em campo antes de fixar uma meta de desempenho.

## 6. Limitações

1. **Independência.** Executores e avaliadores são o mesmo modelo de linguagem, em contextos separados. Não houve revisão humana nem teste com pessoas. Os cinco perfis e as doze tarefas da especificação foram tratados como inspeção heurística pelos avaliadores de produto; os testes de tarefa por perfil (`PROMPT_TESTE_TAREFAS.md`) não foram executados.
2. **Nenhuma reavaliação do estado final.** As notas são das versões avaliadas (commits `d616ae877` e `cbb5fbfeb`). O que foi corrigido depois está verificado por teste, por axe e por inspeção em navegador, não por nota.
3. **Sem leitor de tela real**, sem Firefox, Safari ou aparelho móvel físico. Navegador de teste: Chromium em modo sem interface. Desempenho medido só em laboratório, sem coleta de campo.
4. **Fontes externas.** Os servidores da CCEE, da ANEEL (portais de relatório e de atos), do IBGE (site institucional) e do Planalto responderam com bloqueio ou não abriram em partes da consulta; a conferência por avaliadores técnicos usou fontes primárias abertas no dia (ONS, dados abertos da ANEEL, SIDRA e outras) e cada limite está nos JSON de `avaliacao/rodada2/`.
5. **Teste de Python com falha conhecida neste ambiente**: `test_energia_carga.GoldPublicada.test_arquivos_das_evidencias_existem_ou_sao_declarados_indisponiveis` exige um arquivo bruto de `data/energia/bronze` que não existe fora do cache do pipeline.
6. **Comparabilidade do peso.** A linha de base antecede a fusão com 82 commits de `main`, e `main` sozinho devolve 404 em 10 das 94 rotas (medido em 09/10/2026, commit `58945b5ca`), de modo que não serve de contrafactual. O tempo de carga é de laboratório, com outras medições em paralelo no mesmo computador.

## 7. Recomendações

1. Executar as listas de correção do PLD e de Carga e Rede (93 critérios abaixo de 9, nenhum bloqueio) e reavaliar essas duas unidades com agentes novos.
2. Dar à Geração, a Mercado e Regulação, a Transição e Expansão, a Modelos e Previsões, a Empresas, ao Aprenda e a Dados e Metodologia a mesma avaliação de produto e técnica da versão nova.
3. Pedir ao pipeline as regenerações listadas, em especial a ressalva de desconto negativo, o dicionário dos CSV e o código sem "+alterado", e reavaliar o critério H.
4. Resolver a referência regulatória de perdas por um canal de acesso à ANEEL que não dependa de navegador, ou manter a indisponibilidade como estado declarado.
5. Medir LCP, INP e CLS em campo antes de afirmar desempenho e tratar o peso das páginas (seção 5).
