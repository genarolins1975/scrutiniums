# Redesenho editorial do painel Educação nas capitais

Branch `claude/obee-redesenho-editorial`, empilhada sobre a PR [#119](https://github.com/genarolins1975/scrutiniums/pull/119) (rodada 6). É uma rodada de arquitetura de informação, design e interface: **nenhum número, universo, regra de elegibilidade, fonte ou download foi alterado**. As pendências da rodada 6 permanecem à vista. Data de referência: 08/10/2026.

## 1. O que o leitor encontra agora

| Pergunta do leitor | Onde responde |
| --- | --- |
| O que estou vendo? | Título "Educação nas capitais" e uma frase de proposta, no alto do panorama |
| Qual período e universo? | Subtítulo técnico sob cada frase factual: medida, unidade, etapa, período, "capitais estaduais, rede municipal" e cobertura |
| Onde está a referência? | Mediana rotulada no próprio gráfico; média simples, faixa central e referência nacional na legenda e no texto vizinho |
| Como vejo a minha capital? | Seletor opcional no panorama; "Capital" no alto de cada tema; a escolha acompanha a navegação |
| Como comparo capitais? | Ação "Comparar capitais": conjunto das 26, até 5 destacadas, gráfico ou tabela completa |
| Como vejo a evolução? | Alternância "Evolução" no tema, para a capital escolhida ou para a mediana das capitais |
| Como descubro o que entrou no cálculo? | "Sobre este dado" ao lado de cada número (ficha completa) e "Dados e métodos" |

## 2. Arquitetura em três camadas

* **Panorama** (`/`): três capítulos curtos, cada um com pergunta, frase factual gerada dos dados, faixa de distribuição das capitais, referência e uma ação para aprofundar. Nenhuma capital vem selecionada. Capítulo 1: despesa por habitante; capítulo 2: alunos por turma nos anos iniciais; capítulo 3: Ideb dos anos iniciais. Os três usam medida normalizada, com 26 de 26 capitais comparáveis no período mais recente. A comparação do gasto absoluto está em Gastos.
* **Exploração**: `/gastos`, `/atendimento` e `/resultados`, mais `/comparar`. Uma pergunta e uma visualização predominante por vez; controles locais junto do gráfico; ano e moeda onde pertinentes; etapa só onde a medida existe por etapa.
* **Dados e métodos** (`/metodos`): como ler as medidas, fichas dos indicadores, matriz de referências, reconciliações, validações, fontes, reprodução e glossário.

Navegação persistente, igual no computador e no celular: Panorama, Gastos, Atendimento, Resultados; "Comparar capitais" e "Dados e métodos" como ações. O estado (capital, medida, ano, etapa, moeda, disciplina, visualização, ordem, destaques) vive na URL: links reabrem o recorte; voltar e avançar percorrem as escolhas; parâmetro inválido volta ao padrão.

## 3. O que saiu da leitura inicial e onde continua

| Antes na página inicial | Agora |
| --- | --- |
| Texto "Como ler" e quatro caixas de universo, período, cobertura e dados | Frase de proposta e uma linha de cobertura; o texto longo está em Dados e métodos |
| Oito cartões de peso igual | Família de três medidas por tema, lado a lado, com valor e definição curta; uma por vez no gráfico |
| Séries de todos os indicadores | Alternância "Evolução" no tema |
| Comparação e tabela duplicadas | Alternância Gráfico, Tabela e Evolução do mesmo conjunto; tabela completa em Comparar |
| Matriz de referências aceitas e rejeitadas | Dados e métodos; só referências utilizáveis aparecem junto dos valores |
| Composição, matrículas por etapa e ponte DCA/MSC sempre abertas | "Detalhe" do tema: composição por subfunção (despesa total), por etapa (matrículas), "Do total ao numerador" (razão por matrícula) |
| Validações, versões e hashes | Dados e métodos |
| "Passaporte" | "Sobre este dado" (a ficha de 16 campos permanece) |
| Avisos repetidos | Uma ressalva por número; a primeira frase da ressalva material fica à vista, o resto abre por clique |

Medida de tamanho (Chromium, 08/10/2026, build de produção): a página anterior media **24.851 px** de altura em 1440 px de largura e **43.231 px** em 390 px; o panorama novo mede **3.111 px** em 1440 px (2.748 px até o rodapé) e **4.820 px** em 390 px (3.588 px até o rodapé). O HTML do panorama pesa 138 kB; o da página anterior, cerca de 1,9 MB.

## 4. Frases factuais e linguagem

A unidade editorial é pergunta, frase factual, evidência visual, referência, aprofundamento. As frases são calculadas em `src/lib/eficiencia/frases.ts` só com valores elegíveis do recorte: amplitude com extremos nomeados e empates, capital frente à mediana em valores, cobertura, referência nacional, evolução entre dois períodos com bloqueio por quebra de série. Ausência tem frase própria e nunca vira zero. Nenhum texto avalia governo, sugere meta ou infere causa; testes varrem as frases e os arquivos novos contra o vocabulário avaliativo. O título comunicativo (a frase) é separado do subtítulo técnico.

## 5. Referências com pouco ruído

A mediana é a única linha do desenho e vem rotulada no gráfico. A média simples é um marcador discreto no eixo; a faixa central é um fundo claro; a referência externa é um traço pontilhado com rótulo sob o eixo; extremos têm nome e valor visíveis. A razão agregada é uma frase própria, distinta da média simples, na área de referências. A referência nacional calculada pelo OBEE e as oficiais trazem classe e origem declaradas. O contexto internacional (outro universo) fica em bloco separado e identificado, sem diferença contra a capital. Cobertura acompanha o subtítulo.

## 6. Referências de design aplicadas

* **Our World in Data** (reorganização das visualizações interativas): gráfico focado na comparação principal, controles pertinentes ao gráfico, alternância entre gráfico e tabela, fonte e explicação detalhada acessíveis. Aplicado em: um gráfico predominante por visão, alternância Gráfico, Tabela e Evolução, "Sobre este dado" a um clique.
* **ONS, princípios de visualização e texto de gráficos**: título que ajuda a perceber a comparação, subtítulo com medida, unidade, período e universo; rótulo direto em vez de legenda distante. Aplicado em: frase factual como título, subtítulo técnico separado, mediana rotulada no gráfico.
* **ONS, escolha de visualizações**: pontos numa escala comum para distribuição, linha para evolução, barras para composição, tabela para valores exatos; sem mapa, radar ou medidor. Aplicado conforme a pergunta de cada visão.

Não se afirma que a interface seja "a melhor" por critério externo; as decisões acima são os critérios.

## 7. Componentes reutilizáveis

`NavegacaoPainel`, `FaixaDistribuicao` (panorama), `DistribuicaoCapitais` (exploração e comparação), `ExploradorTema`, `ComparadorCapitais`, `PanoramaInterativo`, `SobreEsteDado`, `Alternancia` e `Selecao` (controles), `estados` (ausência, ressalva, exclusão da comparação), `ReferenciasPainel`, `DetalhesMedida`, `TabelaSimples`. Lógica pura em `src/lib/eficiencia/visao.ts`, `frases.ts` e `panorama.ts`.

## 8. Carga e hidratação

* O panorama é montado no servidor com os pontos de cada capítulo; o navegador recebe só isso (HTML de 138 kB), mais três gráficos e o seletor de capital como ilhas interativas.
* Cada tema leva apenas as observações, estatísticas e referências dos indicadores que usa (`dadosPainelTema`): Gastos 408 kB de HTML (780 kB antes do recorte), Atendimento 393 kB, Resultados 381 kB; Comparar 632 kB. Testes comparam, para cada medida do tema, comparação, pontos, referências, ponte, composição e tabela completa contra a base inteira: valores idênticos.
* Dados e métodos pesa 724 kB de HTML porque traz as fichas, a matriz e as validações; é a camada de auditoria, e não a de leitura.
* Os gráficos desenham por `viewBox` até a primeira medida, de modo que o HTML do servidor não cria rolagem horizontal antes da hidratação.

## 9. Resultado da verificação

Build de produção local (`next build` e `next start`), 08/10/2026.

| Verificação | Resultado |
| --- | --- |
| Rotas × larguras (`redesenho-verificacao.mjs`): 14 rotas e recortes em 1440, 1024, 768, 390 e 320 px | 70 de 70 combinações aprovadas |
| Rolagem horizontal da página | nenhuma |
| axe (WCAG 2.2 AA, inclui contraste) | 0 violações |
| Controles de toque (botões, resumos, seletores, abas, rótulos de rádio e caixa de seleção, links isolados) | 2.278 medidos, 0 abaixo de 44 por 44 px |
| Estrutura | um `h1` por página, sem salto de nível de título, um `main` |
| Teclado | os 12 primeiros controles de cada página recebem foco com indicação visível |
| Movimento reduzido | 0 animações em execução com `prefers-reduced-motion: reduce` |
| Interações reais (`interacoes-redesenho.mjs`) em 1280 px e 390 px com toque | 37 de 37 e 37 de 37 |
| Testes automatizados | `obee-redesenho` e `obee-frases` (novos), neutralidade dos arquivos novos, equivalência dos payloads por tema; suíte completa abaixo |
| Integridade dos dados | os números exibidos no panorama saem da mesma comparação da gold (teste contra as observações cruas); nenhum arquivo do pipeline, da gold, das séries ou dos downloads foi alterado |

As interações cobrem: abrir sem capital; seletor opcional e `?cap=` na URL; voltar e avançar; marca tocada ou apontada; gráfico e tabela com 26 capitais; navegação que preserva a capital; três escalas lado a lado; ponte do total ao numerador; "Sobre este dado" abrindo e fechando por Esc; download do recorte; teclado no gráfico; parâmetros inválidos; etapa que a medida não tem; ano com quebra de série; destaque de até cinco capitais; ordenação só a pedido; Dados e métodos.

## 10. Limitações reais

* **Sem teste com pessoas.** A revisão é avaliação da interface por roteiro e por inspeção das capturas; não houve observação de usuários reais, e o desenho não foi validado com leitor de tela real (o axe e a estrutura semântica foram verificados).
* O rodapé do site (compartilhado com os outros observatórios) tem links de 17 px de altura; foi mantido e não entra na medição de alvos do painel.
* O primeiro gráfico do panorama mostra as 26 capitais como marcas; a identificação de cada uma exige toque, ponteiro, teclado ou a tabela, por escolha de compacidade. O gráfico em linhas, com os nomes, está em Gastos, Atendimento, Resultados e Comparar.
* Os roteiros antigos (`interacoes.mjs`, `capturas-comparacoes.mjs`) valem para a interface anterior e estão marcados como obsoletos.
* Escala logarítmica do eixo permanece só na despesa total.
* O mapa de pontos das capitais não foi adicionado: a localização não acrescenta informação às perguntas do painel e os números não são geográficos.
* Medição de desempenho em laboratório (TBT, LCP) deste redesenho não foi executada.

## 11. Capturas

`docs/obee/capturas/redesenho/`: `antes-*` (interface anterior, produção em 08/10/2026) e `depois-*` (primeira tela e página inteira em 1440 e 390 px; panorama, Gastos com tabela, Gastos com a ponte e Comparar em 1440, 1024, 768, 390 e 320 px).
