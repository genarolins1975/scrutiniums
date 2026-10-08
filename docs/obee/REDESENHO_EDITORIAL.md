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

Medida de tamanho (Chromium, 08/10/2026): a página anterior media **24.851 px** de altura em 1440 px e **43.231 px** em 390 px de largura; os capítulos do panorama cabem em cerca de 2.900 px em 1440 px.

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

## 8. Verificação

Ver a seção "Resultado" ao final, preenchida com o SHA verificado.
