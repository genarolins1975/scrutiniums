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

* **Panorama** (`/`): três capítulos curtos, com a pergunta como título e os números antes do desenho. Capítulo 01 Recursos, com abas Total, Por habitante e Por matrícula (a aba vive em `?med=`): menor valor, mediana e maior valor das capitais em números grandes, faixa de distribuição com a faixa central de 50%, e o contexto nacional separado. Capítulos 02 Atendimento (alunos por turma, anos iniciais) e 03 Resultados (Ideb, anos iniciais): a mediana das capitais ao lado do agregado nacional do INEP. Nenhuma capital vem selecionada. Os três usam o ano mais recente com 26 de 26 capitais comparáveis. A forma completa desta página está na seção 12.
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

Medida de tamanho (Chromium, 08/10/2026, build de produção): a página anterior media **24.851 px** de altura em 1440 px de largura e **43.231 px** em 390 px; o panorama da primeira versão do redesenho media **3.111 px** em 1440 px (2.748 px até o rodapé) e **4.838 px** em 390 px (3.606 px até o rodapé). O HTML do panorama pesa 138 kB; o da página anterior, cerca de 1,9 MB.

## 4. Frases factuais e linguagem

A unidade editorial é pergunta, frase factual, evidência visual, referência, aprofundamento. As frases são calculadas em `src/lib/eficiencia/frases.ts` só com valores elegíveis do recorte: amplitude com extremos nomeados e empates, capital frente à mediana em valores, cobertura, referência nacional, evolução entre dois períodos com bloqueio por quebra de série. Ausência tem frase própria e nunca vira zero. Nenhum texto avalia governo, sugere meta ou infere causa; testes varrem as frases e os arquivos novos contra o vocabulário avaliativo. O título comunicativo (a frase) é separado do subtítulo técnico. Quando há empate no menor ou no maior valor, a frase e os rótulos de extremo da faixa de distribuição citam as mesmas capitais, em ordem alfabética, com o mesmo limite (dois nomes e "e mais N"); correção de 09/10/2026, depois de a captura em produção mostrar a frase com duas capitais empatadas no Ideb e o gráfico com uma.

## 5. Referências com pouco ruído

A mediana é a única linha do desenho e vem rotulada no gráfico. A média simples é um marcador discreto no eixo; a faixa central é um fundo claro; a referência externa é um traço pontilhado com rótulo sob o eixo; extremos têm nome e valor visíveis. A razão agregada é uma frase própria, distinta da média simples, na área de referências. A referência nacional calculada pelo OBEE e as oficiais trazem classe e origem declaradas. O contexto internacional (outro universo) fica em bloco separado e identificado, sem diferença contra a capital. Cobertura acompanha o subtítulo.

## 6. Referências de design aplicadas

* **Our World in Data** (reorganização das visualizações interativas): gráfico focado na comparação principal, controles pertinentes ao gráfico, alternância entre gráfico e tabela, fonte e explicação detalhada acessíveis. Aplicado em: um gráfico predominante por visão, alternância Gráfico, Tabela e Evolução, "Sobre este dado" a um clique.
* **ONS, princípios de visualização e texto de gráficos**: título que ajuda a perceber a comparação, subtítulo com medida, unidade, período e universo; rótulo direto em vez de legenda distante. Aplicado em: frase factual como título, subtítulo técnico separado, mediana rotulada no gráfico.
* **ONS, escolha de visualizações**: pontos numa escala comum para distribuição, linha para evolução, barras para composição, tabela para valores exatos; sem mapa, radar ou medidor. Aplicado conforme a pergunta de cada visão.

Não se afirma que a interface seja "a melhor" por critério externo; as decisões acima são os critérios.

## 7. Componentes reutilizáveis

`NavegacaoPainel`, `FaixaResumo`, `ComparacaoReferencia` e `Abas` (panorama), `DistribuicaoCapitais` (exploração e comparação), `ExploradorTema`, `ComparadorCapitais`, `PanoramaInterativo`, `SobreEsteDado`, `Alternancia` e `Selecao` (controles), `estados` (ausência, ressalva, exclusão da comparação), `ReferenciasPainel`, `DetalhesMedida`, `TabelaSimples`. Lógica pura em `src/lib/eficiencia/visao.ts`, `frases.ts` e `panorama.ts`.

## 8. Carga e hidratação

* O panorama é montado no servidor com os pontos de cada medida (as três escalas do gasto, alunos por turma e Ideb); o navegador recebe só isso (HTML de 169 kB depois da seção 12; era 138 kB), mais os gráficos, as abas e o seletor de capital como ilhas interativas.
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
* No panorama, as 26 capitais não aparecem como marcas: o gráfico mostra o menor valor, a mediana, o maior valor e a faixa central, e os valores de cada capital estão na tabela (a um clique) e no gráfico em linhas de Gastos, Atendimento, Resultados e Comparar. É escolha da proposta visual da seção 12.
* Os roteiros antigos (`interacoes.mjs`, `capturas-comparacoes.mjs`) valem para a interface anterior e estão marcados como obsoletos.
* Escala logarítmica do eixo permanece só na despesa total.
* O mapa de pontos das capitais não foi adicionado: a localização não acrescenta informação às perguntas do painel e os números não são geográficos.
* Medição de desempenho em laboratório (TBT, LCP) deste redesenho não foi executada.

## 11. Capturas

`docs/obee/capturas/redesenho/`: `antes-*` (interface anterior, produção em 08/10/2026) e `depois-*` (primeira tela e página inteira em 1440 e 390 px; panorama, Gastos com tabela, Gastos com a ponte e Comparar em 1440, 1024, 768, 390 e 320 px).

## 12. Página inicial conforme a proposta visual (09/10/2026)

A proposta visual enviada em 09/10/2026 (`docs/obee/capturas/redesenho/proposta-visual-pagina-inicial.png`, com a marca "valores da captura fornecida") passou a ser a página inicial. Os valores exibidos saem dos mesmos dados elegíveis de antes; nada no pipeline, na gold, nas séries ou nos downloads mudou.

**O que a proposta trouxe e como foi implementado**

| Proposta | Implementação |
| --- | --- |
| Título, frase de proposta e uma linha de universo; seletor "Destacar capital" com "Todas as capitais" | `page.tsx`; a linha traz também "dados capturados até 08/10/2026", para o número manter a data de referência |
| 01 Recursos, "Quanto se gasta por habitante?", com abas Total, Por habitante e Por matrícula | `CapituloRecursos` e `Abas` (papel de abas, setas, Início e Fim); a pergunta muda com a aba; a aba grava `?med=` |
| Menor valor, mediana e maior valor em números grandes | três números por aba; empate nomeia todas as capitais (até dois nomes e "e mais N"), como a frase factual |
| Faixa com mediana, menor e maior, faixa central de 50% tracejada, título do eixo e legenda | `FaixaResumo`; valores escritos sobre as marcas; rótulos escalonados quando colidem; ticks do eixo que colidem com os limites da faixa são omitidos |
| Contexto nacional (R$ 2.125, mediana de 5.060 municípios) | bloco separado, sem diferença contra a capital; "Fonte e critérios" abre a ficha completa |
| 02 Atendimento e 03 Resultados lado a lado, mediana das capitais contra Brasil | `CapituloReferencia` e `ComparacaoReferencia`; no celular, empilhados |
| Menor, maior e média das capitais abaixo do gráfico | texto com valores e capitais, UF incluída |
| Faixa "Entenda e confira os números" com três ações | Comparar capitais, Baixar dados (arquivo JSON da base completa, tamanho informado) e Fontes e metodologia |

**Decisões onde a proposta e as regras do painel precisaram ser conciliadas**

* As abas Total e Por matrícula trazem a ressalva essencial junto ao número ("Escala orçamentária... Depende do tamanho da cidade"; "Razão orçamentária, não custo do aluno"). Nenhuma das duas tem referência nacional comparável: o bloco de contexto nacional diz isso e o motivo, em vez de calar.
* O gasto total usa escala logarítmica, declarada no título do eixo, porque a faixa vai de R$ 354,2 milhões a R$ 23,58 bilhões. As demais escalas são lineares.
* O eixo da proposta tinha rótulos repetidos ("2.500" duas vezes) e sem as marcas intermediárias; o eixo real vem da escala dos dados.
* Os gráficos de Atendimento e Resultados mostram a mediana e o agregado nacional, sem as 26 capitais; o Ideb usa o eixo de 0 a 10.
* O agregado nacional do INEP vem rotulado como agregado, e a nota diz que não é média das capitais.
* A capital destacada aparece como marca vazada com nome e valor (capítulo 1) e como terceira linha (capítulos 2 e 3), junto da frase com a diferença para a mediana em valores, sem adjetivo.
* A frase factual de cada medida continua sendo gerada dos dados e virou a descrição acessível do gráfico (e a legenda da tabela).
* O rodapé da proposta ("Proposta visual · valores da captura fornecida") era do desenho e não foi levado; vale o rodapé do site.
* "Explorar gastos", "Explorar atendimento" e "Explorar resultados" levam às visões temáticas com a medida e o ano do capítulo (e a capital, se escolhida).

**Medidas** (build de produção local, 09/10/2026): HTML do panorama 169 kB; altura 2.483 px em 1440 px e 4.949 px em 390 px (produção antes da mudança: 3.111 px e 4.856 px). Capturas `antes-pagina-inicial-*` (produção) e `depois-pagina-inicial-*` (cinco larguras).

