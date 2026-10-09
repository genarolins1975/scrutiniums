# Avaliação independente de experiência, rodada 1: Saúde nas capitais (OBEE)

## 1. Identificação e natureza

* **Avaliador:** agente de IA (Claude Sonnet 5.5, Claude Code), "avaliador independente de experiência", em contexto limpo. Não construiu o módulo.
* **Data da avaliação:** 09/10/2026 (UTC), sobre o módulo servido em produção local, `http://localhost:3111`, branch `claude/determined-knuth-21z58z`.
* **O que leu:** `docs/obee/saude/avaliacao/RUBRICA.md` (integral, primeiro), o código de `src/` somente para entender a causa de comportamentos já observados no navegador, e os arquivos públicos de dados baixados pelo próprio site (`/eficiencia/series/*.csv`, manifesto JSON) para conferir o que o leitor recebe.
* **O que não leu:** `docs/obee/saude/MATRIZ_DE_AVALIACAO.md`, relatórios de outras rodadas, `avaliador-dados.md` (outro avaliador em paralelo); não usou `git log`, `git diff` nem `git show`.
* **Natureza:** inspeção heurística feita por agente, com automação de navegador (Playwright 1.56.1, Chromium 141.0.7390.37, Node 22, contêiner com 4 núcleos). Não é teste com pessoas, nem validação por usuários reais ou por especialistas. Nenhuma nota abaixo deve ser apresentada como tal. Os perfis (cidadão ou conselheiro de saúde, jornalista, gestor, pesquisador) são papéis de leitura simulados por mim, sem participantes, depoimentos, tempos humanos nem taxas de sucesso.
* **Ferramentas automáticas:** axe-core 4.12.1 (do `node_modules` do repositório), regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e `best-practice`, em 23 execuções (16 estados a 1440 px e 7 a 390 px). Resultado: 0 violações em todas. O axe declarou `color-contrast` como "incompleto" (texto em SVG e sobre faixa sombreada), por isso calculei contraste à mão (seção 7).
* **Escrita:** apenas nesta pasta (`docs/obee/saude/avaliacao/rodada-1/`, incluindo `evidencias/`) e na pasta de rascunho. Nada em `src/`, `scripts/`, `public/`, `pipeline/`, testes ou outros docs foi alterado.

### Índice de evidências (`evidencias/`)

| Código | Arquivo |
|---|---|
| E01 | `entrada_1440_primeira-tela.png` |
| E02 | `panorama_1440_primeira-tela.png` |
| E03 | `gastos_1440_primeira-tela.png` |
| E04 | `rede-e-atencao-primaria_1440_primeira-tela.png` |
| E05 | `atendimento-e-resultados_1440_primeira-tela.png` |
| E06 | `comparar_1440_primeira-tela.png` |
| E07 | `metodos_1440_primeira-tela-sem-visual.png` |
| E08 a E14 | `<rota>_320-390-768-1440_primeira-tela.png` (entrada, panorama, gastos, rede, resultados, comparar, métodos; quatro larguras lado a lado) |
| E15 | `panorama_320_grafico-faixa.png` |
| E16 | `gastos_320_grafico-distribuicao.png` |
| E17 | `comparar_390_tabela-rolada-sobreposicao.png` |
| E18 | `rede-e-atencao-primaria_1440_cobertura-2021-estado-vazio.png` |
| E19 | `gastos_1440_subfuncao-soma-de-3-capitais.png` |
| E20 | `comparar_1440_sp-macapa-fora-da-comparacao.png` |
| E21 | `rede-e-atencao-primaria_1440_razao-agregada-0-00.png` |
| E22 | `atendimento-e-resultados_1440_razao-agregada-0.png` |
| E23 | `gastos_1440_teclado-grafico-foco-e-dica.png` |
| E24 | `gastos_1440_total-sp-acima-da-mediana.png` |
| E25 | `gastos_390_sobre-este-dado-dialogo.png` |
| E26 | `gastos_1440_evolucao-mudanca-de-base.png` |

Códigos de verificação sem imagem: **AX** (axe-core, seção 7), **CT** (contraste calculado), **RS** (auditoria de overflow e alvos em 320, 390, 768 e 1440 px, 12 rotas e estados), **TB** (navegação por teclado), **CSV** (arquivos baixados pelo botão do site), **DOM** (inspeção do HTML renderizado).

## 2. Resultado em uma linha

**Não aprovado nesta rodada:** 2 bloqueios confirmados (razão agregada incorreta em 8 medidas; composição por subfunção apresentada como soma das capitais comparáveis mas calculada com 1 a 6 capitais) e 1 bloqueio condicional (frase sobre planos de saúde sem suporte nos próprios dados); só 2 de 49 notas (entrada, critérios I e J) chegam a 9,0, e as médias por critério ficam entre 8,2 e 8,8.

## 3. Matriz de notas

Avaliador: Claude Sonnet 5.5, agente independente de experiência, rodada 1. Formato: página | critério | nota | justificativa | evidência | correção necessária. Cada justificativa registra o que foi atendido, a limitação e por que a nota não é menor. A entrada `/eficiencia-estatal` recebe a adaptação declarada abaixo: o critério A não exige visual principal (não há dado a mostrar) e H avalia a comunicação visual de uma página sem gráfico. Em Dados e métodos, H também é adaptado (tabelas e estrutura, sem gráfico).

### Entrada (`/eficiencia-estatal`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Entrada | A | 8.8 | Atende: título, frase de propósito e dois cartões de tema com a mesma estrutura (pergunta, o que mostra, o que não inclui, última captura), links das seis visões visíveis a 1440 por 900. Limita: sem visual principal (adaptação declarada); o link "Panorama" aparece sublinhado nos dois cartões como se fosse a página atual. Não menor: hierarquia clara, sem parede de texto. | E01, E08 | Remover o estilo de página atual do link Panorama na entrada; dar mais peso à data de captura. |
| Entrada | B | 8.5 | Atende: diz o que cada tema mostra e não inclui e que o leitor tira as conclusões. Limita: ASPS, UBS, Ideb e Saeb sem tradução nos cartões; "perímetros" sem definição na própria página. Não menor: texto curto, sem causalidade nem julgamento. | E01, DOM | Traduzir as siglas nos cartões ou remeter a um glossário do módulo. |
| Entrada | C | 8.5 | Atende: leva a cada visão com um clique (12 links respondem 200; Saúde, Gastos abre em cerca de 150 ms em laboratório). Limita: não há atalho por pergunta ("quanto minha capital liquidou") nem número de destaque por tema. Não menor: caminho previsível e completo. | E01, DOM | Incluir 2 ou 3 perguntas guia por tema com link direto ao recorte. |
| Entrada | D | 8.9 | Atende: dois temas de interesse público, ausências declaradas (seção "O que ainda não existe aqui"), Distrito Federal fora da comparação com motivo, linguagem sem jargão pesado. Limita: não nomeia públicos (conselhos, imprensa) nem convida a compartilhar recortes. Não menor: limitações socialmente relevantes estão visíveis. | E01 | Indicar para quem cada tema serve e como compartilhar um recorte. |
| Entrada | H (adapt.) | 8.4 | Adaptação: sem gráfico por natureza; avalio a comunicação visual. Atende: tipografia serifada para títulos, rótulos pequenos em caixa alta, cartões lado a lado, nenhum significado só por cor. Limita: nenhuma prévia do dado; rótulos de 11,5 px com contraste 4,92:1. Não menor: consistência com o restante do módulo. | E01, CT | Opcional: miniatura da distribuição de uma medida por tema. |
| Entrada | I | 9.0 | Atende: duas rotas claras, 12 links verificados, link de pular, trilha no cabeçalho; chegada a Saúde, Gastos em um clique. Limita: `aria-current` ausente nos links dos cartões. Não menor: a entrada leva de fato a Educação e a Saúde. | E01, DOM, TB | Marcar o estado atual apenas dentro do módulo, não na entrada. |
| Entrada | J | 9.0 | Atende: axe 0 violações, contraste mínimo 4,92:1, sem rolagem horizontal em 320, 390, 768 e 1440 px, 200% e 400% sem perda, alvos do módulo com 44 px ou mais. Limita: links do rodapé compartilhado com 17 px de altura; não rodei leitor de tela. Não menor: nenhuma barreira encontrada. | AX, CT, RS, E08 | Componente compartilhado: aumentar área de toque dos links do rodapé. |

### Panorama (`/eficiencia-estatal/saude-capitais`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Panorama | A | 8.4 | Atende: a 1440 por 900 a primeira tela traz título, pergunta, recorte (26 capitais, DF fora) e o primeiro gráfico com o valor principal (R$ 1.354); os três perímetros têm cabeçalho com "permite mostrar" e "não permite presumir". Limita: sete gráficos quase iguais em 4.000 px; faixa sombreada e linhas tracejadas sem legenda; rótulos do eixo apertados (R$ 1.124, R$ 1.500, R$ 1.769) e escala irregular; linha de recorte com três ideias unidas por pontos médios; a 320 px o primeiro gráfico só aparece depois de cerca de 1.300 px. Não menor: visual principal presente e hierarquia estável. | E02, E09, E15 | Legenda curta da faixa; ticks regulares; recorte em itens; reduzir altura do cabeçalho no celular. |
| Panorama | B | 8.4 | Atende: cada indicador tem pergunta, unidade, ano, universo ("25 de 26 capitais") e uma frase do que mede; os perímetros são nomeados e separados; ICSAP aparece como taxa bruta, sem ajuste por idade. Limita: ASPS, UBS e eSF aparecem sem expansão visível nos títulos; "mediana" e "faixa central" sem explicação no gráfico; o leitor leigo não sabe o que é a faixa. Não menor: o leitor consegue explicar a maior parte dos indicadores com as próprias palavras. | E02, DOM | Expandir siglas no primeiro uso e explicar a faixa sombreada no próprio gráfico. |
| Panorama | C | 8.3 | Atende: quanto liquidou por habitante, percentual em ASPS, estrutura de APS e ICSAP, com mediana, extremos e capital opcional; links levam ao recorte com a capital preservada. Limita: não mostra grupo por região, nem posição ordenada, nem nominal versus real; ICSAP e estrutura têm anos diferentes e a diferença só aparece no subtítulo; o aviso de exclusão (Macapá) é uma linha sem motivo. Não menor: responde às perguntas centrais em uma tela. | E02, DOM | Indicar exclusões com o motivo curto; chamar atenção para anos diferentes entre perímetros. |
| Panorama | D | 8.8 | Atende: aborda gasto, cobertura potencial e internações com limites explícitos; "não permite presumir" em cada perímetro; legível sem formação especializada em grande parte. Limita: sem convite explícito ao compartilhamento; cobertura e acesso aparecem como capacidade teórica, e a ausência de pessoas atendidas e de produção só é detalhada na página Rede. Não menor: ausências socialmente relevantes estão declaradas. | E02 | Repetir no Panorama a ausência de produção e filas. |
| Panorama | H | 8.2 | Atende: faixa horizontal por indicador (mínimo, mediana, maior, metade central) com zero na escala e capital destacada por círculo vazado e rótulo, sem depender de cor; texto alternativo por gráfico (`role="img"` com valores). Limita: sem legenda da faixa; ticks irregulares e próximos; só três pontos nomeados, sem mostrar as demais capitais. Não menor: forma adequada à pergunta de panorama. | E02, E15, DOM | Legenda, ticks regulares e opção de ver todos os pontos. |
| Panorama | I | 8.8 | Atende: seletor de capital muda a URL (`?cap=`), os links "Ver a distribuição e as capitais" levam a capital junto, voltar do navegador funciona, valores batem com Gastos, Rede e Resultados (conferi 7 medianas). Limita: sem ano, moeda nem grupo; sem botão de limpar além de "Nenhuma". Não menor: previsível e compartilhável. | E02, DOM | Oferecer grupo por região no Panorama. |
| Panorama | J | 8.9 | Atende: axe 0 violações, `role="img"` nos gráficos com valores, 4,92:1 mínimo, sem overflow em 320 a 1440, 200% e 400% sem perda, alvos do módulo com 44 px ou mais, movimento reduzido respeitado. Limita: texto de 11 a 11,5 px em eixos e rótulos; expansão de siglas só por `abbr` (toque não revela). Não menor: nenhuma barreira para tarefas essenciais. | AX, CT, RS, TB | Subir tamanho mínimo para 12 px; expandir siglas no texto. |

### Gastos (`/eficiencia-estatal/saude-capitais/gastos`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Gastos | A | 8.5 | Atende: duas colunas (controles e definição à esquerda, resposta e gráfico à direita), frase de resultado em serifa como título do gráfico, mediana e faixa no gráfico, blocos de composição abaixo. Limita: gráfico em ordem alfabética (a distribuição não aparece como forma); três blocos de composição e dois de texto longo na mesma página; "Referências do grupo" abaixo da dobra; no celular o gráfico começa após cerca de 1.300 px. Não menor: visual principal e hierarquia a 1440 por 900. | E03, E10, E16 | Ordem por valor como opção padrão ou alternativa; resumo de referências ao lado do gráfico. |
| Gastos | B | 8.2 | Atende: "Não é custo por usuário do SUS", bloco "O que a despesa inclui, e o que não inclui", três perímetros referidos, deflator descrito na ficha. Limita: o controle "Valores: Nominais, Reais de 2025" não tem explicação; em 2025 os dois dão o mesmo número e nada avisa; DCA, RREO e "exercício" sem tradução no aviso de exclusão; a frase "1.423% acima da mediana" para o total é pouco interpretável; a composição por subfunção engana (problema P02). Não menor: o essencial do que o número mede e não mede está perto do indicador. | E03, E19, E24, DOM | Frase curta sob o controle de valores; traduzir DCA e RREO no aviso; ver P02 e P14. |
| Gastos | C | 8.0 | Atende: total e por habitante, ASPS, nominal e real, subfunção, natureza e fonte, grupo por região, capital destacada, CSV. Limita: razão agregada de ASPS incorreta (0,2%); composição por subfunção sem capital cobre só 3 capitais em 2025; Evolução liga apenas 2024 a 2025; sem ordenação por valor. Não menor: a maior parte das perguntas de gasto é respondida em poucos passos. | E03, E19, E26, AX | Corrigir P01 e P02; permitir ordenar. |
| Gastos | D | 8.8 | Atende: pergunta de interesse direto (quanto a prefeitura executa), mínimo legal de ASPS como referência normativa, ressalva de que gasto elevado não é desperdício. Limita: "Reais de 2025" e "exercício" exigem familiaridade; comparação de totais entre cidades de tamanhos distintos pode induzir leitura errada. Não menor: limitações visíveis e linguagem acessível no núcleo. | E03, E24 | Ocultar percentual contra mediana nos totais. |
| Gastos | H | 8.2 | Atende: pontos com mediana, faixa central e média marcadas, zero na escala, unidades e extremos rotulados, barras de composição com percentual e valor, Evolução com quebra de linha em mudança de base, teclado com dica e anúncio. Limita: alfabética; a 320 e 390 px os nomes quebram em duas linhas e quase se tocam, e a área do gráfico fica com cerca de 110 px; Evolução só tem um segmento conectado. Não menor: não depende de hover. | E03, E16, E23, E26 | Em telas estreitas, usar rótulos curtos (sigla da UF) e ordenar por valor. |
| Gastos | I | 8.3 | Atende: URL guarda medida, ano, moeda, capital, grupo e visão (`?med=&ano=&moeda=&cap=&grp=&vis=`), recarregar e abrir em nova aba reproduzem o recorte, voltar do navegador percorre as mudanças. Limita: o botão "Baixar CSV" na visão Evolução entrega o recorte de 2025 e não a série mostrada (P04); trocar a medida zera o exercício sem aviso (P25); motivo da exclusão fica abaixo do gráfico. Não menor: sincronia de números e referências confirmada em 8 combinações. | E03, CSV, DOM | Corrigir P04 e P25. |
| Gastos | J | 8.9 | Atende: axe 0 violações em 5 execuções (4 estados a 1440 px e 1 a 390 px), foco visível de 2 px (5,9:1), controles segmentados operáveis por setas, gráfico focável com setas e anúncio ao vivo, tabela com legenda e cabeçalhos, reflow a 200% e 400%. Limita: seleção do controle segmentado com tom de 1,1:1 em relação ao não selecionado (distinção por peso da fonte e foco); texto de 11,5 px. Não menor: nenhuma tarefa bloqueada. | AX, CT, TB, RS, E23 | Reforçar a seleção com contorno ou marca além do tom. |

### Rede e atenção primária (`/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Rede | A | 8.4 | Atende: mesma estrutura de Gastos, bloco explicativo "Estabelecimento, equipe, cobertura e pessoas atendidas são coisas diferentes" antes das tabelas de apoio; visual principal na primeira tela a 1440 px. Limita: alfabética; três tabelas de contagem somadas das 26 capitais após o gráfico, com "retrato de 09/10/2026" ao lado de gráficos de dezembro de 2025; no celular o gráfico fica a mais de 1.200 px. Não menor: leitura em camadas clara. | E04, E11 | Separar visualmente "retrato de captura" de "dezembro de 2025". |
| Rede | B | 8.4 | Atende: define estabelecimento, equipe, cobertura potencial e pessoas atendidas, e declara que o módulo mostra cadastro e capacidade, não atendimento. Limita: UBS, eSF, eAP, CNES e APS só em parte expandidos; "eAP, 20 h e 30 h" é opaco; o perímetro "serviços localizados no território" não é nomeado nesta página; zeros de eAP (6 capitais) não são explicados. Não menor: o que a cobertura potencial não é está dito duas vezes. | E04, DOM | Nomear o perímetro; explicar que 0,00 significa nenhuma equipe registrada; siglas. |
| Rede | C | 8.0 | Atende: UBS, eSF, eAP e cobertura potencial por 10 mil habitantes ou percentual, tabela, evolução e CSV. Limita: razão agregada incorreta nas 4 medidas (0,00 e 0,7%); cobertura potencial de dezembro de 2021 sem nenhum valor na comparação e estado vazio mal rotulado; sem produção nem pessoas atendidas (declarado). Não menor: cadastro e capacidade respondidos com ressalvas claras. | E04, E18, E21 | Corrigir P01; reformular o estado vazio (P07). |
| Rede | D | 8.9 | Atende: dá visibilidade a cobertura e acesso potenciais, diz o que não está no módulo (atendimento efetivo, produção), usa linguagem de cadastro. Limita: lacuna de produção só em texto; sem convite a compartilhar. Não menor: ausência socialmente relevante visível. | E04 | Destacar a lacuna de produção no topo. |
| Rede | H | 8.2 | Atende: mesma família de gráficos de Gastos; mediana e faixa; zero na escala. Limita: alfabética; quando todos os pontos se agrupam (UBS, eAP) a leitura de diferença é difícil; no celular rótulos quebrados. Não menor: coerente e acessível por teclado. | E04, E16 | Ordenar por valor; ampliar a escala útil. |
| Rede | I | 8.2 | Atende: URL com medida e competência, tabela e evolução equivalentes, CSV do recorte. Limita: escolher "dez. 2021" na cobertura potencial leva a um estado vazio sem aviso prévio no seletor; Evolução mantém bloco de referências de outro ano; sem ordenação. Não menor: o estado vazio explica que nenhuma capital é comparável. | E18, DOM | Marcar no seletor os períodos sem comparação. |
| Rede | J | 8.8 | Atende: axe 0 violações, tabelas com rolagem focável e nomeada, sem overflow, 200% e 400% sem perda. Limita: texto pequeno; 26 blocos repetidos no estado vazio aumentam o esforço de teclado. Não menor: sem barreira. | AX, TB, RS | Agrupar os 26 avisos iguais em um. |

### Atendimento e resultados (`/eficiencia-estatal/saude-capitais/atendimento-e-resultados`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Resultados | A | 8.2 | Atende: visual principal e frase de resultado na primeira tela; blocos "O que este resultado mede, e o que não mede", grupos, planos de saúde e lacunas. Limita: seis parágrafos longos de ressalva seguidos de três blocos; o título "Atendimento e resultados" promete atendimento que só existe como lista de lacunas; no celular o gráfico começa a mais de 1.400 px. Não menor: estrutura legível e consistente. | E05, E12 | Reordenar para resultado, referências e depois ressalvas; ver P20. |
| Resultados | B | 7.9 | Atende: residência, só SUS, AIH como unidade, taxa bruta, "não é falha de gestão". Limita: ICSAP, RIPSA e "Lista Brasileira" sem expansão visível no título e nas referências; "população do denominador: Ministério da Saúde ou IBGE" sem explicação; frases quebradas e jargão de arquivo ("mgdi_ms_qu3.csv.zip"); a frase sobre planos privados não tem suporte (P03). Não menor: o essencial da ressalva está ao lado do indicador. | E05, E22, DOM | Expandir siglas; explicar o seletor de denominador; remover a frase de P03; ajustar texto de P19. |
| Resultados | C | 7.9 | Atende: taxa, número e participação, referência de fora do grupo (Brasil, 5.570 municípios e sem as 26 capitais), planos privados como contexto, CSV. Limita: razão agregada incorreta (0 e 0,1%); o seletor de denominador não muda nada em 2024 e a nota do CSV diz que difere (P08); frase sem suporte sobre planos (P03). Não menor: base de comparação rica e honesta quanto a taxa bruta. | E05, E22, CSV | Corrigir P01, P03 e P08. |
| Resultados | D | 8.8 | Atende: resultado por moradores, ressalva de que não mede a prefeitura nem causa, planos privados como contexto obrigatório, lacunas listadas. Limita: parte do texto é técnica; sem convite a compartilhar. Não menor: tema de alto interesse social tratado com limites claros. | E05 | Resumo em linguagem simples no topo. |
| Resultados | H | 8.2 | Atende: distribuição com mediana, faixa e referência tracejada do Brasil, barras dos 19 grupos em ordem de volume, Evolução com mediana tracejada. Limita: alfabética; mediana tracejada sem valores na Evolução; no celular nomes quebrados. Não menor: cada gráfico responde a uma pergunta distinta. | E05, DOM | Rótulos na linha da mediana; ordem por valor. |
| Resultados | I | 8.2 | Atende: URL com medida, ano, denominador, capital, grupo e visão; `?ano=2025` cai em 2024 sem erro. Limita: o ano forçado na URL não é avisado (P27); seletor de denominador sem efeito em 2024; CSV da Evolução desalinhado (P04). Não menor: estados inválidos não quebram a página. | CSV, DOM | Avisar fallback de ano. |
| Resultados | J | 8.8 | Atende: axe 0 violações, sem overflow, tabela focável, 200% e 400% sem perda, movimento reduzido. Limita: um link de 15 a 31 px de altura ("Ver as decisões sobre cada fonte") no módulo; texto de 11,5 px. Não menor: sem barreira para a tarefa. | AX, RS | Aumentar a área de toque do link. |

### Comparar capitais (`/eficiencia-estatal/saude-capitais/comparar`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Comparar | A | 8.5 | Atende: com duas capitais, cartões A e B no topo e o gráfico em seguida; a 1440 px o visual principal está na primeira tela; tabela das 26 capitais e 10 medidas ao final. Limita: sem capital escolhida, a primeira tela é só o gráfico e uma instrução; a tabela tem 10 colunas e três delas ficam "não coberto" em 2025. Não menor: hierarquia clara entre par, distribuição e tabela. | E06, E20, E13 | Explicar por que ICSAP não aparece em 2025. |
| Comparar | B | 8.1 | Atende: ressalva ao lado do valor de cada capital ("valor oficial fora da comparação"), frase de diferença com aviso "diferença descritiva". Limita: frase sem unidade ("855 a menos") e com ambiguidade ("5,8% a mais" são pontos percentuais); "não coberto" é jargão; DCA e RREO sem tradução; perímetros misturados na tabela sem rótulo. Não menor: a exclusão de Macapá 2025 e de Campo Grande 2021 é entendida em poucos segundos por leitor treinado. | E20, DOM | Frases com unidade; "não disponível em 2025"; tradução das siglas. |
| Comparar | C | 8.5 | Atende: duas capitais lado a lado, posição em relação à mediana, tabela ordenável (`aria-sort`, URL `ord` e `dir`), CSV da medida e da tabela, evolução por capital. Limita: colunas de ICSAP vazias por padrão em 2025; sem inversão A e B; escalas próprias nos gráficos de evolução (declaradas). Não menor: é a página mais útil para comparar pares. | E06, E13, CSV | Ano padrão que preencha todas as colunas, ou aviso explícito. |
| Comparar | D | 8.8 | Atende: permite ao conselheiro ou jornalista contrastar duas capitais com contexto e compartilhar a URL (`?cap=&vs=`). Limita: percentuais contra mediana em totais (8.114%) são pouco informativos. Não menor: limites e exclusões aparecem junto ao valor. | E20 | Esconder percentual em medidas de escala. |
| Comparar | H | 8.2 | Atende: distribuição com as duas capitais destacadas, evolução em pequenos múltiplos, tabela com cabeçalhos e itálico para fora da comparação. Limita: escala própria em cada pequeno múltiplo; tabela de 1.024 px de largura em tela estreita. Não menor: não depende de hover. | E06, E17 | Eixo comum opcional; tabela em cartões no celular. |
| Comparar | I | 8.4 | Atende: URL completa (`med`, `ano`, `cap`, `vs`, `ord`, `dir`), ano ajustado para o último disponível ao escolher ICSAP, rótulo muda de "Exercício" para "Ano de processamento". Limita: a rolagem horizontal da tabela no celular perde legibilidade (P05); sem botão de limpar par. Não menor: sincronia de números confirmada. | CSV, E17 | Corrigir P05. |
| Comparar | J | 8.0 | Atende: axe 0 violações, tabela com legenda, `scope` e `aria-sort`, região rolável focável com nome. Limita: no celular, a primeira coluna fixa fica transparente e os valores passam por baixo dos nomes das capitais (ilegível ao rolar); 10 colunas exigem rolagem a 320 px. Não menor: a tabela continua acessível por teclado e por leitor de tela. | E17, AX, RS | Dar fundo opaco à coluna fixa (P05). |

### Dados e métodos (`/eficiencia-estatal/saude-capitais/metodos`)

| Página | Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Métodos | A | 7.6 | Atende: índice de seções no topo, três perímetros em colunas, catálogo e decisões com filtros. Limita: primeira tela sem visual principal (documentação); 13.000 px a 1440 px e 26.500 px a 320 px; 75 blocos recolhíveis; código de medida (F01, S03, M04) como rótulo. Não menor: navegação por âncoras funciona. | E07, E14 | Resumo de uma tela com os caminhos por perfil; reduzir a repetição. |
| Métodos | B | 7.7 | Atende: separa os três perímetros em linguagem direta e explica DF fora do recorte. Limita: nenhuma sigla expandida por `abbr` (49 ocorrências de SIOPS, 100 de DCA, 58 de ICSAP); catálogo e decisões em registro técnico; JSON cru em blocos de validação. Não menor: o texto técnico é completo e honesto. | E07, DOM | Glossário do módulo e primeira ocorrência expandida. |
| Métodos | C | 8.5 | Atende: 23 indicadores, 31 medidas candidatas com decisão e motivo, 20 validações e medições, manifesto com URL, data e SHA256, CSV por indicador, dicionário de colunas, hash dos dados. Limita: o passo a passo é de Belo Horizonte, não de São Paulo; reprodução completa exige repositório e Python. Não menor: pesquisador reconstrói a taxa de ICSAP de São Paulo 2024 a partir do CSV. | CSV, E07 | Exemplo por capital escolhida; links diretos na seção Reprodução. |
| Métodos | D | 8.4 | Atende: transparência sobre o que não foi publicado e por quê. Limita: inacessível ao cidadão sem mediação; sem versão resumida. Não menor: serve a imprensa e a pesquisa. | E07 | Versão "em poucas linhas" para o leitor leigo. |
| Métodos | H (adapt.) | 7.8 | Adaptação: sem gráfico; avalio tabelas e estrutura. Atende: listas com estado de publicação, filtros, cartões de fonte com campos fixos. Limita: blocos de 75 itens sem agrupamento visual; JSON em `pre` sem nome acessível. Não menor: estrutura consistente. | E14, DOM | Agrupar por tema e nomear as regiões roláveis. |
| Métodos | I | 8.7 | Atende: âncoras (`#reproducao` etc.), busca e filtro por estado (4 de 23 ao buscar ICSAP), fichas recolhíveis, links diretos aos CSV. Limita: após âncora o foco permanece no corpo; a seção Reprodução remete a "seção Arquivos" sem link. Não menor: alcançada a partir de Panorama e do menu. | DOM, TB | Mover o foco para a seção; link direto. |
| Métodos | J | 8.5 | Atende: axe 0 violações, sem overflow, regiões roláveis focáveis (`tabindex=0`). Limita: 20 links "Série completa em CSV" com 17 px de altura; `pre` sem nome; texto longo sem recurso de salto por perfil. Não menor: operável por teclado. | AX, RS | Aumentar alvos e nomear regiões. |

### Médias por critério (7 páginas)

| Critério | A | B | C | D | H | I | J |
|---|---|---|---|---|---|---|---|
| Média | 8.3 | 8.2 | 8.2 | 8.8 | 8.2 | 8.5 | 8.7 |
| Menor nota | 7.6 (Métodos) | 7.7 (Métodos) | 7.9 (Resultados) | 8.4 (Métodos) | 7.8 (Métodos) | 8.2 (Rede, Resultados) | 8.0 (Comparar) |

Notas de 9,5 ou mais exigiriam validação adicional que esta inspeção não tem e não foram atribuídas.

## 4. Bloqueios de aprovação encontrados

1. **Valor incorreto (confirmado): razão agregada.** O bloco "Referências do grupo" mostra "Razão agregada 0,00" para UBS, eSF e eAP por 10 mil habitantes, "0,7%" para cobertura potencial, "0" para a taxa de ICSAP por 100 mil, "0,1%" para a participação de ICSAP e "0,2%" para ASPS, enquanto a mediana do mesmo grupo é 0,88, 2,19, 0,14, 83,0%, 774, 13,5% e 21,0%. Só R$ por habitante (R$ 1.544) está correto. O erro também está no CSV de referências (`saude_referencias_capitais.csv`: ICSAP 2024, 0.00776 em vez de cerca de 776; UBS, 0.0000655 em vez de cerca de 0,66). Causa observada: a razão soma numerador e denominador e não aplica o fator da unidade (10 mil, 100 mil, 100). Ver P01.
2. **Ressalva essencial pouco visível e universo contraditório (confirmado): composição por subfunção sem capital.** O bloco diz "soma das capitais com valor comparável" e mostra, por exemplo, "Atenção básica 16,4% · R$ 701,3 milhões", mas a nota de 12 px abaixo informa "Soma das despesas de 3 capitais" (1 em 2021 e 2022, 3 em 2023 e 2025, 6 em 2024) sem nomeá-las. O leitor lê a participação de um grupo de 25 capitais; o cálculo cobre de 1 a 6 capitais. Causa observada no código: `composicaoAgregada` descarta a capital que não tem todas as 8 linhas de subfunção. Ver P02.
3. **Bloqueio condicional: afirmação sem suporte nos dados do próprio módulo.** Em Resultados (bloco de planos privados) e na ficha: "Capitais com mais beneficiários de planos têm menos internações pagas pelo SUS por habitante por esse motivo." Com os CSV publicados (26 capitais, 2024), a correlação de postos entre cobertura de planos e taxa de ICSAP é de 0,07 (inspeção heurística, sem ajustes), isto é, o dado exibido não sustenta a frase. A rubrica fala em afirmação causal ou de eficiência sem suporte; esta frase é associativa, por isso a trato como condicional, mas recomendo tratá-la como bloqueio até ser removida ou sustentada. Ver P03.

Não encontrei: despesa do município apresentada como gasto total (o texto repete que não é); razão despesa por atendimento ou por usuário; ausência tratada como zero (os zeros de eAP aparecem como "observado", mas sem explicação ao leitor); exclusão aplicada ao gráfico e não ao resumo ou CSV (conferi 2025, 2021 e grupos regionais: gráfico, tabela, referências e CSV batem); nota, ranking de gestão, semáforo, DEA, SFA, estimativa de desperdício ou recomendação de corte; Distrito Federal misturado; dado pessoal; barreira que impeça tarefa essencial (a tarefa 3 ficou parcial, mas não impedida).

## 5. Registro das 8 tarefas por perfil

Todas executadas no navegador (Playwright, Chromium), a partir da entrada ou de URL do módulo, sem consulta a fontes externas. Onde precisei abrir arquivo baixado do site (CSV, manifesto), registro. Nenhum tempo humano ou taxa de sucesso é afirmado.

**T1. Despesa por habitante de uma capital em 2025 e se entra na comparação.**
* Perfil cidadão ou conselheiro (Recife) e jornalista (Macapá). Passos: entrada, link "Gastos" do cartão Saúde, selecionar a capital (2 ações após a entrada, medida e ano padrão).
* Resultado Recife: sucesso. A frase sob o título diz "Recife (PE): R$ 1.325; mediana das 25 capitais: R$ 1.354, 2% abaixo da mediana."; o ponto destacado aparece no gráfico. Macapá: sucesso com obstáculo. "Macapá (AP): R$ 1.011. O valor oficial fica fora da comparação e das medianas (motivo no aviso abaixo)."; o motivo está depois das 26 linhas do gráfico (E03, E20).
* Erros: nenhum. Obstáculos: motivo abaixo da dobra; DCA e RREO sem tradução. Intervenção externa: nenhuma.

**T2. Comparar com a mediana e identificar o grupo de referência.**
* Perfil jornalista e gestor. Passos: mesma tela; ler "Referências do grupo: 25 de 26 capitais na comparação" (mediana R$ 1.354, média simples R$ 1.421, menor R$ 731 Rio Branco, maior R$ 2.552 Belo Horizonte, metade central R$ 1.124 a R$ 1.769, razão agregada R$ 1.544); alternar "Grupo de comparação" para a região (São Paulo e Sudeste: mediana de 4 capitais R$ 1.667, faixa central não exibida por haver menos de 8 capitais, com motivo).
* Resultado: sucesso. Obstáculos: o bloco de referências fica abaixo do gráfico; "metade central" não é explicada; a razão agregada de outras medidas está errada (P01), o que reduz a confiança do bloco. Intervenção externa: nenhuma.

**T3. Reais correntes versus reais de 2025, e por que 2021 não é comparável por habitante.**
* Perfil cidadão ou conselheiro e pesquisador. Passos: alternar "Valores" para "Reais de 2025" em 2025 (valores iguais, só o rótulo muda para "R$ de 2025 por habitante por ano"); trocar o exercício para 2021 (mediana nominal R$ 877; em reais de 2025, R$ 1.098); abrir "Sobre este dado" (campo 11: correção pelo IPCA, só do numerador); abrir os quatro "Ver o restante" das ressalvas; abrir Evolução.
* Resultado: **parcial**. A diferença entre os dois tipos de valor só se entende lendo a ficha (campo 11), não o controle. A explicação de 2021 existe ("A população de 2022 em diante tem outra base; variações por habitante entre 2021 e os anos seguintes misturam a mudança da base populacional") mas atrás de quatro blocos recolhidos com texto repetido, abaixo do gráfico; na Evolução aparece só "a base populacional ou o método mudou". Também não se entende por que 2022 a 2023 fica interrompida, se a ressalva diz que os dois anos usam a mesma população censitária.
* Erros: nenhum de cálculo. Obstáculos: controle sem explicação, texto fragmentado, ligação 2022 a 2023 sem justificativa. Intervenção: precisei abrir a ficha e os blocos recolhidos.

**T4. Por que Campo Grande 2021 ou Macapá 2025 ficam fora da comparação.**
* Perfil jornalista, pesquisador, cidadão. Passos: Comparar, medida e ano padrão, capital A São Paulo e B Macapá; depois ano 2021 com Campo Grande como A.
* Resultado: sucesso para jornalista e pesquisador, parcial para o cidadão. O aviso está dentro do cartão da capital ("valor oficial fora da comparação" e, em "Ressalva: fora das comparações", "Conferência pendente: diferença material entre DCA e RREO sem explicação documentada"); "Ver o restante" traz os números (RREO R$ 503.269.686,89, DCA R$ 495.269.686,89, diferença de menos R$ 8 milhões, menos 1,6% da DCA, MSC também não reconcilia). Campo Grande 2021: "Perímetro distinto: a DCA deste exercício inclui na função Saúde despesas intraorçamentárias, que as demais declarações apresentam em linha separada." (E20).
* Obstáculos: DCA, RREO, "conferência pendente" e "intraorçamentárias" exigem conhecimento técnico no primeiro nível do aviso. Intervenção: nenhuma.

**T5. Distinguir recursos do município, serviços no território e população residente.**
* Perfil cidadão ou conselheiro, gestor. Passos: Panorama (três seções "Perímetro 1 de 3" a "3 de 3", cada uma com "Permite mostrar" e "Não permite presumir"), Gastos, Rede, Resultados, Métodos.
* Resultado: sucesso no Panorama e em Métodos; **parcial** nas demais: Gastos tem uma frase ("um dos três perímetros do módulo"); Rede, Resultados e Comparar nunca nomeiam o perímetro (nenhuma ocorrência da palavra no texto visível). A tabela do Comparar mistura despesa, estrutura e internações sem rótulo de perímetro.
* Intervenção: nenhuma.

**T6. Estrutura e resultado sem confundir períodos; o que a cobertura potencial não é.**
* Perfil gestor e pesquisador. Passos: Rede, medida "Cobertura potencial estimada" (dez. 2025: mediana 83,0%, de 53,7% Goiânia a 114,4% Boa Vista); Resultados, ICSAP (ano de processamento 2024, mediana 774); Panorama; Comparar com ano 2025.
* Resultado: sucesso. Cada gráfico traz o próprio período (dezembro de 2025, ano de processamento 2024); "Sem teto de 100%", "Não é cadastro, atendimento nem pessoas atendidas" estão ao lado do indicador. No Comparar, as colunas de ICSAP em 2025 dizem "não coberto" (período não é misturado, mas a causa não é explicada). Erro: cobertura de dez. 2021 tem estado vazio rotulado "Ausente na coleta", embora haja valores oficiais na tabela (P07).
* Intervenção: nenhuma.

**T7. Exportar um recorte e reconhecer limitações fora do site.**
* Perfil jornalista e pesquisador. Passos: "Baixar CSV" em Gastos (2025), Gastos 2021 em reais com Sudeste, Rede (eAP), Comparar (medida e tabela).
* Resultado: **parcial**. Arquivo `saude_despesa_hab_2025.csv`: UTF 8 com marca BOM, separador ponto e vírgula, 26 linhas, colunas Capital, UF, Região, Medida, Período, Valor, Valor numérico, Unidade, Estado do dado, Na comparação, Nota, Fonte. Fora do site entende-se unidade, período, estado e exclusão (Macapá "não", com nota). Faltam data de captura, versão metodológica, hash, numerador e denominador, mediana do grupo, URL da fonte (a coluna Fonte traz identificadores internos como `siconfi_dca_anexo_i_e`) e a ressalva geral de que despesa do município não é gasto total. Mistura "Valor" com formato brasileiro e "Valor numérico" com ponto decimal. O botão da visão Evolução entrega o mesmo arquivo da visão Distribuição (recorte de 2025, não a série) (P04). O filtro de grupo foi respeitado (4 linhas para Sudeste).
* Intervenção: abri os arquivos baixados.

**T8. Reproduzir um indicador pela documentação (ICSAP de São Paulo em 2024).**
* Perfil pesquisador e jornalista. Passos: Panorama, link "De onde vem cada medida e como reproduzir o cálculo", Dados e métodos, seção Reprodução (4 passos), seção Arquivos, "Taxa de ICSAP por 100 mil (CSV)", linha de São Paulo 2024.
* Resultado: sucesso para o pesquisador no nível do indicador. O CSV traz numerador 83.391 (`sau.icsap.internacoes`), denominador 11.895.578 (população estimada do RIPSA), versão 1.0, hash e registro; 83.391 ÷ 11.895.578 × 100.000 = 701,03, igual aos 701 exibidos. O manifesto lista URL (`mgdi_ms_qu3.csv.zip`), captura em 09/10/2026, SHA256 e 3.342.102 linhas. Não reconstruí o numerador a partir do arquivo bruto nem rodei o pipeline.
* Obstáculos: os exemplos passo a passo são de Belo Horizonte, não de São Paulo; a seção Reprodução manda ir à "seção Arquivos" e ao manifesto sem link direto; vocabulário técnico (SHA256, comando Python). Cidadão ou conselheiro não completaria esta tarefa sem ajuda, o que é esperado pelo desenho. Intervenção: abri CSV e manifesto.

## 6. Problemas numerados

Severidades: bloqueante, alta, média, baixa. "Cap." indica captura em `evidencias/`.

1. **Bloqueante. Razão agregada incorreta.** Páginas: Gastos (ASPS), Rede (UBS, eSF, eAP, cobertura), Resultados (taxa, participação), CSV de referências. Reproduzir: Rede, medida eSF, ler "Razão agregada 0,00" abaixo do gráfico; Resultados, taxa de ICSAP, "Razão agregada 0"; Gastos, ASPS, "0,2%". Cap. E21, E22. Correção: aplicar o fator da unidade (por 10 mil, por 100 mil, por 100) na razão agregada e no CSV; adicionar teste que confronte razão agregada com o intervalo mínimo a máximo.
2. **Bloqueante. Composição por subfunção apresentada como soma das capitais comparáveis, calculada com 1 a 6 capitais.** Página: Gastos. Reproduzir: abrir Gastos com exercício 2025 (ou 2021) sem capital, ler "soma das capitais com valor comparável" e a nota "Soma das despesas de 3 capitais" (também "1 capitais"). Cap. E19. Correção: calcular com todas as capitais elegíveis (tratar linha ausente por subfunção, sem exigir as 8), ou rotular "soma de 3 capitais (nomes)" em destaque e com o título corrigido; corrigir o plural.
3. **Alta (bloqueio condicional). Frase sobre planos privados e internações sem suporte.** Página: Resultados (bloco "Cobertura de planos de saúde privados") e ficha do indicador. Reproduzir: ler "Capitais com mais beneficiários de planos têm menos internações pagas pelo SUS por habitante por esse motivo."; cruzar os CSV de planos e taxa (2024, 26 capitais, correlação de postos 0,07). Cap. E05. Correção: remover a frase ou substituí-la por descrição verificável (por exemplo, faixa de cobertura e taxa de cada capital lado a lado), sem implicar relação.
4. **Alta. "Baixar CSV" da visão Evolução entrega o recorte de 2025.** Página: Gastos, Rede, Resultados. Reproduzir: Gastos, visão Evolução, "Baixar CSV"; o arquivo é idêntico ao da visão Distribuição (mesmo MD5). Cap. E26. Correção: exportar a série mostrada, com os anos e as quebras de base, ou rotular o botão com o recorte exportado.
5. **Alta. Tabela do Comparar ilegível ao rolar no celular.** Página: Comparar, 320 e 390 px. Reproduzir: abrir `/comparar`, rolar a tabela na horizontal; a coluna fixa é transparente e os números passam sobre os nomes das capitais. Cap. E17. Correção: fundo opaco na primeira coluna (inclusive nas linhas destacadas), ou layout em cartões no celular.
6. **Alta. Explicação de "2021 não é comparável" e de "Reais de 2025" fragmentada.** Página: Gastos (também Rede e Comparar). Reproduzir: tarefa T3. Cap. E26. Correção: frase curta ao lado do controle "Valores" (o que é reais de 2025 e que em 2025 os dois coincidem); aviso único, visível acima do gráfico, para 2021; explicar por que 2022 a 2023 e 2023 a 2024 interrompem a linha, ou corrigir a ficha.
7. **Média. Estado vazio da cobertura potencial em dezembro de 2021.** Página: Rede. Reproduzir: medida "Cobertura potencial", competência "dez. 2021". Mostra "Ausente na coleta" (rótulo errado: os valores existem e estão fora da comparação), o motivo fica no fim de 26 blocos iguais com a fórmula como "motivo" e a frase final recolhida. Cap. E18. Correção: um aviso único com o motivo ("fórmula de 2021 não reproduz a Nota Técnica nº 2/2025"); marcar o período no seletor; trocar o rótulo.
8. **Média. Alternância "IBGE do exercício" sem efeito em 2024 e nota do CSV contraditória.** Página: Resultados (e Comparar). Reproduzir: ano 2024, alternar o denominador: título, gráfico, tabela e CSV não mudam (as duas populações coincidem em 2024 e diferem de 2021 a 2023), mas a nota do CSV diz "Difere da taxa principal porque os denominadores diferem". Correção: avisar "em 2024 as duas populações coincidem", ou ocultar a alternância nesse ano; ajustar a nota.
9. **Média. Siglas sem tradução e expansão só por hover.** Páginas: todas. Exemplos: ICSAP no título de Resultados (8 ocorrências, 0 com `abbr`), RIPSA, UBS, ASPS, "Rede e APS" no menu, DCA e RREO no aviso de exclusão; Métodos com 0 `abbr`. Não há glossário do módulo (o "Glossário" do rodapé é do Crédito). Correção: expansão no primeiro uso, no texto; glossário do módulo.
10. **Média. Perímetro não nomeado em Rede, Resultados e Comparar.** Reproduzir: ler cada página; só Panorama, uma frase de Gastos e Métodos usam "perímetro". Correção: etiqueta de perímetro em cada indicador e coluna da tabela.
11. **Média. Panorama sem legenda para a faixa e com eixo apertado.** Reproduzir: Panorama a 1440 px, primeiro cartão. Cap. E02, E15. Correção: legenda "metade central das capitais"; ticks regulares.
12. **Média. Distribuição em ordem alfabética; sem ordenação em Gastos, Rede e Resultados.** Reproduzir: Gastos, Distribuição e Tabela. Cap. E03. Correção: alternar ordem alfabética e por valor (declarando que é recurso de leitura).
13. **Média. Comparar: frases de diferença sem unidade e coluna ICSAP "não coberto".** Reproduzir: Comparar, medida ICSAP, São Paulo e Porto Alegre ("São Paulo tem 855 a menos…"); cobertura potencial ("5,8% a mais", pontos percentuais); tabela de 2025. Correção: unidade na frase; "pontos percentuais"; legenda "ICSAP só até 2024".
14. **Média. Percentual contra a mediana em totais.** Reproduzir: Gastos, medida "Despesa liquidada (total)", capital São Paulo: "1.423% acima da mediana"; Comparar: "8.114% maior". Cap. E24. Correção: omitir percentual relativo em medidas de escala.
15. **Média. CSV do recorte sem metadados.** Reproduzir: T7. Correção: incluir data de captura, versão, hash, numerador e denominador, URL da fonte, mediana do grupo e ressalva geral (ou um arquivo de leia-me no mesmo download).
16. **Média. Celular: o primeiro gráfico começa entre 1.200 e 1.700 px.** Reproduzir: 320 ou 390 px em Gastos, Rede, Resultados e Comparar; cabeçalho compartilhado ocupa cerca de 230 px a 320 px e o nome Scrutiniums some. Cap. E08 a E14, E16. Correção: controles recolhíveis e resultado antes da definição.
17. **Média. Dados e métodos longo e sem visual.** Reproduzir: 1440 px (13.000 px de altura), 320 px (26.500 px); códigos F01 e S03; JSON em blocos `pre` sem nome acessível; exemplos de reconstrução só de Belo Horizonte. Cap. E07, E14. Correção: resumo por perfil, agrupamento por tema, exemplo por capital, nome acessível nos blocos.
18. **Média. Evolução abre com o salto bruto.** Reproduzir: Gastos, Evolução: "de R$ 877 em 2021 para R$ 1.354 em 2025. A variação entre esses anos não é uma medida direta…". A mediana tracejada não tem rótulos e o bloco "Referências do grupo" abaixo é do ano do filtro, não da série. Cap. E26. Correção: abrir com a ressalva e só mostrar o par de anos comparável.
19. **Baixa. Defeitos de texto.** "uBS públicas ativas…" e "iCSAP nas internações…" (primeira letra minúscula no título após "Em dezembro de 2025," e "No ano de processamento 2024,"); "Soma das despesas de 1 capitais"; "(de 26 a 26)"; fragmentos "por 100 mil. no mesmo ano e pela mesma regra; razão agregada. que pesa cada município pela população." nas referências do Brasil; "Primeira capital." como ajuda. Correção: ajustar a montagem das frases.
20. **Baixa. Título "Atendimento e resultados" sem indicador de atendimento.** Página: Resultados. Correção: renomear ("Resultados e lacunas de atendimento") ou publicar indicador.
21. **Baixa. Alvos de toque menores que 44 px.** Compartilhados: 23 links do rodapé (17 px de altura). Do módulo: "Ver as decisões sobre cada fonte" (15 a 31 px) em Resultados; 20 links "Série completa em CSV" (17 px) em Métodos. Controles de formulário, abas, botões e segmentados têm 44 px ou mais. Correção: ampliar a área clicável.
22. **Baixa. Texto de 11 a 11,5 px e seleção dos controles segmentados só por tom.** Rótulos de controle, eixos, notas (25 a 66 elementos por página); contraste 4,92:1. O item selecionado de "Valores", "Visão" e "Grupo de comparação" difere do não selecionado por um tom de cerca de 1,1:1, peso da fonte e anel de foco quando em uso. Correção: mínimo de 12 px; contorno ou marca na seleção.
23. **Baixa. Foco após âncora e regiões roláveis.** Em Métodos o foco continua no corpo após clicar numa âncora; blocos `pre` roláveis focáveis sem nome. Correção: mover foco para o título da seção; `aria-label` nos blocos.
24. **Baixa. Carga.** Cada página prefetcha as rotas irmãs (196 a 360 KB decodificados cada, cerca de 1,2 a 1,5 MB) e o HTML tem 391 a 460 KB decodificados; a entrada transfere 4,7 MB decodificados em 50 requisições. Em laboratório isso não atrasa o conteúdo (ver seção 7), mas pesa em rede móvel.
25. **Baixa. Trocar a medida reinicia o exercício sem aviso.** Reproduzir: Gastos, ASPS, exercício 2024, trocar para despesa total: volta a 2025. Correção: preservar o ano quando existir na nova medida.
26. **Baixa. "Motivo abaixo" depende de rolagem.** Em Gastos o aviso de exclusão fica depois das 26 linhas. Correção: nota curta junto ao ponto ou à legenda.
27. **Baixa. Ano forçado na URL é corrigido em silêncio.** `?ano=2025` em Resultados mostra 2024 e a URL continua dizendo 2025. Correção: normalizar a URL ou avisar.
28. **Baixa. Redundância.** "Não é custo por usuário do SUS" aparece na coluna esquerda e em "Por habitante" na mesma tela (mais a ficha); as quatro ressalvas de 2021 repetem a mesma frase final; "Descrição do grupo de capitais…" em todas as páginas.

## 7. Verificações de base

**Interações exercitadas (todas com URL, recarga e nova aba):** medida (as 3 de Gastos, as 4 de Rede, as 3 de Resultados e 4 das 10 de Comparar), ano ou competência, moeda (nominal e reais de 2025), denominador de ICSAP, capital (todas as páginas), grupo (todas as capitais e região, aparece ao escolher capital), ordem (só em Comparar), visão (Distribuição, Tabela, Evolução), par A e B, limpar com "Nenhuma", voltar do navegador (cada mudança cria uma entrada de histórico). Parâmetros inválidos (`?ano=1999`, `?cap=xyz&med=foo&vis=bar`) caem no padrão sem erro. Estados vazios: cobertura 2021 (ver P07); anos sem dado: ICSAP 2025 (Comparar ajusta para 2024). Console: 0 erros em 9 rotas e estados medidos.

**Sincronia conferida:** medianas, extremos e contagens do Panorama batem com Gastos, Rede, Resultados e com a tabela do Comparar (por exemplo, João Pessoa R$ 1.354 igual à mediana de 25 capitais; Goiânia 53,7%; Curitiba 0,99). Gráfico, tabela, referências e CSV respeitam a exclusão de Macapá 2025 e Campo Grande 2021. Divergências: P01, P02, P04, P08.

**Acessibilidade:** teclado (Tab e Shift+Tab percorrem link de pular, cabeçalho, menu, controles, gráfico, botões; ordem lógica; foco de 2 px em azul petróleo, 5,9:1); controles segmentados são grupos de rádio operáveis por setas (Gastos: setas trocam Nominais e Reais, Distribuição, Tabela e Evolução e atualizam a URL); `select` por teclado; diálogo "Sobre este dado" é `dialog` modal, foco inicial no "Fechar", Esc fecha e devolve o foco ao botão; gráfico de distribuição é um grupo focável ("Use as setas para cima e para baixo") com dica e região ao vivo; Panorama usa `role="img"` com valores; tabelas têm `caption`, `scope` e `aria-sort`; `lang="pt-BR"`; títulos H1, H2, H3 coerentes; `aria-current="page"` no menu do módulo. **Contraste calculado (CT):** texto secundário rgb(107,109,106) sobre rgb(250,248,242) = 4,92:1 (passa AA); nenhum texto visível abaixo de 4,5:1 (3:1 para texto grande) nas 8 páginas e estados; pontos cinza 3,71:1, ponto destacado 5,94:1; a seleção do controle segmentado difere do não selecionado por tom de cerca de 1,1:1 e por peso da fonte (ver P22). **Cor como único canal:** não encontrei (capital destacada tem círculo maior, rótulo em negrito e valor; mediana por linha sólida e Brasil por tracejada; fora da comparação em itálico com texto). **Zoom 200% e 400% a 1280 px (640 e 320 px CSS):** sem rolagem horizontal da página em Gastos, Panorama, Comparar e Métodos; nenhum elemento fixo ou fixado ao topo. **Movimento reduzido:** nenhuma animação CSS; com `prefers-reduced-motion` a rolagem suave vira automática e as transições caem a 0,00001 s. **320, 390, 768 e 1440 px:** 0 px de overflow horizontal da página em 12 rotas e estados (RS); rolagem horizontal só dentro das tabelas e dos blocos de código, declarada e focável. **Alvos:** ver P21. Não rodei leitor de tela real; a conformidade completa não é declarada.

**Desempenho percebido (laboratório, K parcial).** Ambiente: Chromium 141 sem estrangulamento de CPU nem rede, contêiner de 4 núcleos, produção local em `localhost:3111`, janela de 1440 por 900, contexto novo (sem cache) a cada execução, 5 execuções por página, mediana. Não representa a experiência real de leitores, redes ou dispositivos. Resultados: FCP de 92 a 184 ms e LCP de 92 a 348 ms (Comparar com par escolhido e Gastos em Tabela os mais lentos), DOMContentLoaded de 30 a 189 ms, carga de 102 a 251 ms, CLS de 0,000 a 0,001 (sem deslocamento visível), 35 a 50 requisições, 0 erros de console. Peso decodificado de 2,5 a 4,7 MB (P24). A página responde de forma instantânea nas trocas de seletor (sem espera perceptível em laboratório).

**Leitura de leitor sobre E e F (sem recálculo).** Referências visíveis e bem rotuladas: mediana, média simples, menor e maior com capital, metade central (com regra de não exibir com menos de 8 capitais), razão agregada, grupo por região, mínimo legal de ASPS como "referência normativa, não meta", referência de fora do grupo (Brasil e Brasil sem as 26 capitais) em ICSAP com ressalva de porte; contagens do universo em cada subtítulo ("25 de 26"). Rigor visível: despesa liquidada, população do mesmo ano, deflator IPCA descrito só na ficha, Censo 2022 e quebra de série explicados (porém fragmentados), ICSAP por residência, taxa bruta, AIH como unidade, cobertura potencial como capacidade teórica, nenhuma razão por atendimento, DF fora com motivo. Inconsistências numéricas percebidas de passagem: razão agregada (P01), composição por subfunção (P02), "5,8% a mais" como diferença de pontos percentuais (P13), nota de CSV de denominador (P08), frase de planos (P03). Os zeros de eAP em 6 capitais (Belo Horizonte, Boa Vista, Cuiabá, Macapá, São Luís, Teresina) aparecem como "0,00" e estado "observado", sem explicação ao leitor; não consegui distinguir pela interface zero real de arredondamento.

**Avaliação editorial do texto público.** Linguagem avaliativa: nenhuma encontrada em 14 estados de página (busca por melhor, pior, eficiente, desperdício, adequado, insuficiente, deveria etc.); o texto nega explicitamente eficiência, mérito e falha de gestão. Causalidade implícita: a frase de planos (P03) e a abertura da Evolução (P18); "depende de oferta de leitos e critérios de internação" é ressalva sem fonte exibida. Ressalvas escondidas: composição por subfunção (P02), explicação de 2021 em blocos recolhidos (P06), motivo de exclusão abaixo do gráfico (P26). Siglas: P09. Jargão: "conferência pendente", "intraorçamentárias", "retrato de captura", "quebra de série", "estado do dado", códigos F01, S03 e nomes de arquivo. Parede de texto: Métodos (cerca de 25.000 caracteres visíveis mais 75 blocos recolhíveis) e seis parágrafos de ressalva em Resultados. Redundância: P28. Rótulos enganosos: "Ausente na coleta" (P07), "Atendimento e resultados" (P20), "soma das capitais com valor comparável" (P02), "uBS" e "iCSAP" (P19). Os três perímetros ficam claros no Panorama e em Métodos e não nas demais páginas (P10). Hífen ou travessão como pontuação em prosa: **nenhum** (zero travessões e meias-riscas em todo o texto do módulo; o hífen cercado de espaços aparece só dentro de nomes literais de contas e colunas da fonte, entre aspas, como o código da função Saúde seguido do nome da conta e os nomes das colunas de numerador e denominador do RIPSA, o que não é pontuação de prosa).

## 8. Limitações desta avaliação

* É inspeção heurística de um agente; não há usuários reais, leitor de tela real, testes em dispositivos físicos nem outros navegadores (só Chromium 141). Perfis são papéis simulados.
* Não verifiquei a correção dos dados contra as fontes oficiais nem reconstruí o numerador do ICSAP a partir do arquivo bruto; as conferências foram internas ao módulo (CSV baixados do site, medianas cruzadas entre páginas) e dependem de os arquivos públicos refletirem o que foi publicado. A correlação de postos entre planos e ICSAP (0,07) é cálculo simples sobre 26 pontos, sem ajuste por idade ou renda, usado só para checar se a frase exibida é sustentada.
* Li o código apenas para explicar causas (razão agregada sem fator de unidade, filtro de `composicaoAgregada`); as notas se baseiam no que o leitor vê. Não verifiquei todas as combinações possíveis de medida, ano, capital e grupo (testei as listadas na seção 7) nem todos os 130 pares de capital e ano.
* Desempenho é de laboratório em localhost, sem rede real; não há medição de INP, memória nem consumo de dados em redes móveis.
* O contraste foi calculado para texto sobre o fundo da página e sobre os fundos opacos mais próximos; texto sobre a faixa sombreada do gráfico (azul claro) não foi medido ponto a ponto, e o axe o declarou "incompleto".
* Não avaliei E, F, G e K como critérios com nota (fora do escopo desta tarefa); as observações da seção 7 são leitura de leitor, não nota.
* As capturas foram feitas com a janela e os estados descritos; o conteúdo pode mudar com novas rodadas de correção.

---

## Reavaliação 1

* **Data:** 09/10/2026 (UTC), depois das correções do executor. **Avaliador:** o mesmo agente de IA (Claude Sonnet 5.5), na condição de avaliador de experiência, sem acesso ao código das correções além do necessário para explicar causas, e sem confiar no mapa `CORRECOES.md` (lido apenas para saber o que verificar; cada ponto abaixo foi refeito no navegador).
* **Natureza:** inspeção heurística de agente, novamente com Playwright 1.56.1 e Chromium 141 sobre o build final em `http://localhost:3111` (gold com `hash_dados` começando em `ce882081`). Não há usuários reais; as tarefas por perfil são papéis simulados, sem tempos nem taxas.
* **Verificações repetidas:** razão agregada em 12 combinações de medida e ano, mais as 900 linhas do CSV de referências (276 com razão); composição por ano de 2021 a 2025; CSV de 10 estados (distribuição, tabela, evolução e comparar); tabela do Comparar em 320 e 390 px com teste de cobertura por `elementFromPoint`; teclado (24 paradas de Tab em Gastos, setas nos grupos de rádio); axe-core 4.12.1 em 28 execuções (0 violações); contraste calculado nas 8 páginas e estados (0 abaixo de AA, mínimo 4,92:1); zoom 200% e 400% em 6 rotas; overflow e alvos em 320, 390, 768 e 1440 px em 12 rotas e estados (0 px de rolagem horizontal da página); carga em laboratório (5 execuções por página).
* **Evidências novas (prefixo `reaval_`, 15 arquivos em `evidencias/`):** RA01 `reaval_gastos_1440_evolucao-mediana-liga-2021-a-2023.png`; RA02 `reaval_gastos_1440_evolucao-sp-mediana-tracejada-atravessa-quebras.png`; RA03 `reaval_gastos_1440_evolucao-total-base-da-populacao.png`; RA04 `reaval_gastos_1440_marca-2-sobre-rotulo.png`; RA05 `reaval_gastos_1440_subfuncao-soma-de-25-de-26.png`; RA06 `reaval_comparar_390_tabela-rolada-coluna-opaca.png`; RA07 `reaval_gastos_320-390_ordem-no-celular.png`; RA08 `reaval_comparar_320-390_ordem-no-celular.png`; RA09 `reaval_rede_1440_cobertura-2021-estado-vazio.png`; RA10 `reaval_gastos_1440_ordem-maior-ao-menor.png`; RA11 `reaval_gastos_1440_2021-reais-aviso-do-periodo.png`; RA12 `reaval_panorama_1440_legenda-da-faixa.png`; RA13 `reaval_rede_1440_razao-agregada-1-89.png`; RA14 `reaval_resultados_1440_primeira-tela.png`; RA15 `reaval_metodos_1440_topo-com-resumo-por-perfil.png`. Códigos sem imagem como na seção 1 (AX, CT, RS, TB, CSV, DOM).

### R1. Resultado em uma linha

**Ainda não aprovado, mas muito melhor:** os 3 bloqueios da rodada anterior foram corrigidos e verificados (razão agregada, composição por subfunção, frase sobre planos); 1 bloqueio remanescente novo e visível (a mediana da Evolução liga ou atravessa anos de bases populacionais incompatíveis, contra a regra do próprio módulo); só 3 de 49 notas chegam a 9,0 e as médias por critério vão de 8,4 a 8,8.

### R2. Estado dos bloqueios e dos problemas

Legenda: **Corrigido** (reproduzi e não encontrei o defeito), **Parcial** (melhorou, com resíduo verificado), **Não corrigido**.

| Item | Estado | Verificação no navegador e resíduo |
|---|---|---|
| Bloqueio 1 e P01, razão agregada | **Corrigido** | Gastos ASPS 21,8%; UBS 0,66; eSF 1,89; eAP 0,29; cobertura 72,6%; ICSAP 776, 14,4%; 2022: 713 e 0,68; R$ por habitante R$ 1.544. Todas dentro do mínimo e do máximo. CSV de referências: 276 linhas com razão, 0 fora de [mínimo, máximo], coluna `fator_razao` presente (10000, 100000, 100). Cap. RA13. |
| Bloqueio 2 e P02, subfunção | **Corrigido** | Sem capital, o texto diz "Soma de 25 de 26 capitais em 2021 ... Fora da soma: Campo Grande (MS), valor oficial fora das comparações", 26 de 26 em 2022 a 2024, 25 de 26 em 2025 com Macapá nomeada. A soma das subfunções de 2025 (R$ 70,7 bi) bate com a soma da despesa total das 25 capitais. Natureza (21 a 26 capitais) e fonte (24 a 26) também dizem quantas e quais ficaram fora. Resíduo: a frase de apoio começa com "soma de ..." em minúscula depois de ponto (ver N6). Cap. RA05. |
| Bloqueio 3 e P03, planos privados | **Corrigido** | A frase passou a "A cobertura de planos varia entre as capitais e é mostrada aqui como contexto, sem relação estabelecida com a taxa." Nenhuma ocorrência de "por esse motivo" ou "têm menos internações" na página, na ficha ou no Panorama. |
| P04, CSV da Evolução | **Corrigido, com ressalva** | O botão passou a "Baixar CSV da série" e o arquivo é a série (5 linhas na capital, 5 na mediana, marca de base, mediana do ano, capitais na mediana, fonte, endereço, data, versão, hash, "Leia antes de usar"); o recorte da distribuição e da tabela é outro arquivo ("Baixar CSV do recorte"). A marca de base do CSV da mediana por habitante de Gastos está errada em 2021 (ver N1). |
| P05, tabela do Comparar no celular | **Corrigido** | Coluna fixa com fundo opaco (branco) a 320 e 390 px; sem texto sobreposto ao rolar (captura com `scrollLeft` 320); cabeçalho em dois níveis (perímetro, depois medida, unidade e período). Cap. RA06. |
| P06, reais de 2025 e 2021 | **Parcial** | Distribuição: explicação ao lado de "Valores" ("cada exercício corrigido pelo IPCA (média anual) para o poder de compra de 2025; em 2025 os dois valores coincidem") e aviso visível acima do gráfico (população de cada ano e por que vizinhos só são comparáveis na mesma base). Evolução: anotações 1 e 2 e ligação de 2022 a 2023 agora estão corretas na linha da capital, mas a linha da mediana contradiz o aviso (N1) e a despesa total usa a explicação errada (N2). Caps. RA11, RA01, RA02. |
| P07, estado vazio da cobertura 2021 | **Corrigido, com resíduo** | Título "Nenhuma capital tem valor comparável para dezembro de 2021" e mensagem com o motivo (regra anterior que não reproduz a Nota Técnica nº 2/2025, valores oficiais à vista); sem o rótulo "Ausente na coleta"; capitais agrupadas (24 numa lista, Florianópolis e Teresina à parte). Resíduos: a mesma frase aparece duas vezes seguidas, o controle "Ordem das capitais" continua visível sem gráfico (N5). Cap. RA09. |
| P08, denominador | **Corrigido** | "Em 2024 as duas populações coincidem nas 26 capitais, e as duas taxas são iguais." Em 2021 o texto explica a diferença e a nota do CSV passa a "Difere da taxa principal porque as populações diferem". |
| P09, siglas | **Parcial** | Bloco "Siglas desta página" à vista em Gastos, Rede, Resultados e Comparar; seção "Siglas" em Dados e métodos (muito completa). Faltam: bloco no Panorama e na entrada (ASPS, UBS, eSF, SIOPS seguem sem expansão visível, só `abbr` em parte); no Comparar o bloco não traz DCA, RREO e MSC, usados no aviso de exclusão; em Rede o bloco não traz Siaps, Sisab, eCR, eSFR, eAPP (N7). |
| P10, perímetro | **Corrigido** | "Perímetro" nomeado, com link "Os três perímetros", em Gastos, Rede, Resultados e Comparar; tabela do Comparar com cabeçalho por perímetro; Panorama e Dados e métodos já tinham. |
| P11, legenda do Panorama | **Corrigido** | "Faixa clara: metade central das capitais, de R$ 1.124 a R$ 1.769" sob cada gráfico. Os rótulos de quartil continuam entre ticks irregulares (declarado como componente compartilhado, baixa). Cap. RA12. |
| P12, ordem | **Corrigido** | "Ordem das capitais" (alfabética, maior ao menor, menor ao maior) em Distribuição e Tabela, com a nota de que é recurso de leitura; a ordem entra na URL (`ord=`), sobrevive à recarga e o CSV a acompanha; a capital fora da comparação fica no fim. Cap. RA10. |
| P13, frases de diferença | **Corrigido** | "São Paulo tem 855 internações por 100 mil habitantes a menos que Porto Alegre ... (55% menor em valor relativo)"; "5,8 pontos percentuais a mais"; totais sem percentual; colunas de ICSAP em 2025 dizem "série até 2024". |
| P14, percentual em totais | **Corrigido** | "São Paulo (SP): R$ 23,34 bilhões; mediana das 25 capitais: R$ 1,53 bilhão. É um total que depende do porte da capital." Percentual só para razões (por habitante) e pontos percentuais para parcelas. |
| P15, CSV sem metadados | **Corrigido, com resíduo** | Colunas de numerador, denominador, mediana do grupo, capitais na comparação, fonte por extenso, endereço, data de captura, versão, hash, "Leia antes de usar"; decimal rotulado ("Valor numérico (ponto decimal)"). Resíduos: arquivo de 40 KB para 26 linhas (endereços repetidos); a célula "Endereço da fonte" junta 3 URLs separadas por espaço, com marcadores `<ano>` e `<código IBGE>` (N9). |
| P16, celular, primeiro gráfico | **Não corrigido** | Cabeçalho compacto economiza 40 a 70 px, mas controles novos (perímetro, ajuda de valores, ordem) empurram o gráfico: a 390 px Gastos 1.317 para 1.348 px, Rede 1.275 para 1.232, Resultados 1.452 para 1.283, Comparar 1.244 para 1.591; a 320 px Gastos 1.480 para 1.615, Rede 1.444 para 1.490, Resultados 1.660 para 1.559, Comparar 1.363 para 1.774. No Comparar, definição e siglas ainda vêm antes do gráfico. Caps. RA07, RA08. |
| P17, Dados e métodos | **Corrigido, com resíduo** | Altura de 13.036 para 8.728 px (1440) e de 26.521 para 17.125 px (320); "Quero entender / Sou jornalista / Sou gestor / Sou pesquisador" no topo; matriz de fontes recolhida por perímetro; blocos técnicos com `aria-label`; exemplo de reconstrução de São Paulo (ICSAP 2024: 83.391 ÷ 11.895.578, 701,025204); link do repositório; receita do hash. Resíduo: primeira tela sem visual (adaptação mantida). Cap. RA15. |
| P18, abertura da Evolução | **Parcial** | A frase agora usa o último trecho da mesma base ("de R$ 1.256 em 2024 para R$ 1.354 em 2025. Os valores de 2021, 2022, 2023 usam outra base..."). Mas ver N1 (a linha ainda liga 2021 a 2023) e N2. |
| P19, defeitos de texto | **Parcial** | "UBS" e "ICSAP" agora maiúsculos no início; "1 capitais" e "(de 26 a 26)" sumiram; fragmentos do Brasil refeitos. Resíduos: "soma de N de 26 capitais" em minúscula depois de ponto em 6 blocos (N6); "UBS públicas ativas por 10 mil habitantes vai de" (concordância). |
| P20, "Atendimento" no título | **Corrigido** | Parágrafo visível: "nenhuma série de produção da atenção primária é publicada, porque a fonte oficial não oferece série municipal extraível e verificável", com link para as lacunas. |
| P21, alvos de toque | **Parcial** | O link de decisões sobre fontes tem 44 px. Novos: "Os três perímetros" (123 por 17 px, link em linha) em todas as páginas do explorador e "Atendimento: o que não está..." (17 a 36 px). Rodapé (23 links, 17 px) e 22 links "Série completa em CSV" (17 px) continuam, declarados como compartilhados. |
| P22, texto pequeno e seleção | **Parcial** | Seleção dos controles segmentados agora tem sublinhado marcado (corrigido). Texto: o corpo do módulo está em 12 px ou mais, mas rótulos `.rotulo` ficam em 11,52 px (um a 10,56) e texto SVG em 11,5, 11 e 10 px (Comparar). |
| P23, foco e blocos roláveis | **Corrigido** | Clique em âncora de Dados e métodos move o foco para a seção (`SECTION#reproducao` etc.), a 96 px do topo; `pre` com `aria-label` ("Casos listados da validação S03, em formato técnico"). |
| P24, carga | **Corrigido no módulo** | Sem pré-carga das rotas irmãs: 1,1 a 1,6 MB decodificados por página (antes 2,5 a 2,9 MB) e 20 a 27 requisições (antes 35 a 36). A entrada continua com 4,7 MB e 49 requisições. |
| P25, trocar a medida reinicia o ano | **Corrigido** | ASPS 2024 para despesa total mantém 2024 e a URL (`?med=despesa&ano=2024`); Rede UBS 2023 para cobertura mantém 2023; Comparar ajusta para 2024 só quando a medida não tem 2025. |
| P26, "motivo abaixo" | **Não alterado** | Em Gastos o aviso de exclusão ainda fica depois das 26 linhas; a frase acima do gráfico remete a "aviso abaixo" (baixa). |
| P27, ano inválido na URL | **Parcial** | `?ano=1999`, `?ano=2025` em Resultados e `?ano=2019` em Rede são normalizados (parâmetro removido). Parâmetros inválidos de capital, medida e visão (`cap=xyz&med=foo&vis=bar`) e `ano=3000` no Comparar permanecem na URL, com a página em padrão (baixa). |
| P28, redundância | **Parcial** | "Não é custo por usuário do SUS" ainda aparece duas vezes na tela de Gastos (coluna esquerda e bloco "Por habitante"); a frase do estado vazio da cobertura está duplicada. Melhorou a repetição das ressalvas de 2021 (agora uma explicação por capital). |

### R3. Matriz de notas atualizada

Avaliador: Claude Sonnet 5.5, agente independente de experiência, reavaliação 1. Formato: página | critério | nota nova (anterior) | justificativa curta quando mudou | evidência | correção necessária. Mesma adaptação declarada para a entrada (A sem visual principal; H como comunicação visual) e para Dados e métodos (H como estrutura de tabelas e listas). Notas com uma casa decimal; o que a evidência sustenta, sem negociação.

| Página | Crit. | Nota (anterior) | Justificativa curta | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Entrada | A | 8.8 (8.8) | Sem mudança; sem visual por natureza (adaptação). | E01 | Link Panorama sublinhado como página atual. |
| Entrada | B | 8.5 (8.5) | Acrescentou "filas e tempo de espera (não pesquisados nesta rodada)"; ASPS, UBS, Ideb e Saeb seguem sem tradução. | DOM | Glossário ou expansão nos cartões. |
| Entrada | C | 8.5 (8.5) | Sem mudança. | DOM | Atalhos por pergunta. |
| Entrada | D | 8.9 (8.9) | Sem mudança. | E01 | Públicos e compartilhamento. |
| Entrada | H (adapt.) | 8.4 (8.4) | Sem mudança. | E01 | Prévia visual opcional. |
| Entrada | I | 9.0 (9.0) | 12 links respondem 200; clique de Saúde, Gastos abre em cerca de 150 ms. | DOM | `aria-current` e estilo do Panorama na entrada. |
| Entrada | J | 9.0 (9.0) | axe 0 violações; sem overflow em 320 a 1440; 200% e 400% sem perda; rodapé compartilhado com 17 px. | AX, RS | Alvos do rodapé (compartilhado). |
| Panorama | A | 8.6 (8.4) | Legenda sob cada gráfico, cabeçalho compacto; ticks do eixo ainda apertados; gráfico a cerca de 1.120 px a 390 px. | RA12 | Ticks regulares; ordem no celular. |
| Panorama | B | 8.5 (8.4) | A legenda explica a faixa; o ASPS, UBS e eSF ainda sem expansão visível e sem bloco de siglas; "Oficial publicado" é jargão. | DOM | Bloco de siglas no Panorama. |
| Panorama | C | 8.4 (8.3) | Referência do Brasil (99,1%, mesma fórmula) na cobertura; valor da capital excluída com a frase; sem grupo por região. | RA12, DOM | Motivo curto da exclusão; grupo por região. |
| Panorama | D | 8.8 (8.8) | Sem mudança. | E02 | Convite a compartilhar. |
| Panorama | H | 8.5 (8.2) | Faixa agora legendada com valores; segue só com três pontos nomeados e ticks irregulares. | RA12 | Opção de ver todos os pontos. |
| Panorama | I | 8.8 (8.8) | Sem mudança relevante. | DOM | Ano e grupo no Panorama. |
| Panorama | J | 8.9 (8.9) | axe 0; contraste mínimo 4,92:1; texto SVG de 11,5 px. | AX, CT | Mínimo de 12 px. |
| Gastos | A | 8.6 (8.5) | Perímetro e ordem acrescentados e aviso do período acima do gráfico; a 1440 por 900 o gráfico começa mais abaixo (14 capitais na primeira tela); no celular o gráfico fica a 1.348 px (a 390) e 1.615 px (a 320). | RA10, RA07 | Controles recolhíveis no celular. |
| Gastos | B | 8.7 (8.2) | Ajuda de "Reais de 2025", aviso de base populacional, universo da composição ("Soma de 25 de 26 capitais") e bloco de siglas; ainda "soma de" minúsculo, concordância e explicação errada na Evolução da despesa total (N2). | RA11, RA05, RA03 | Corrigir N2 e N6. |
| Gastos | C | 8.4 (8.0) | Razão agregada e composição corrigidas; ordenação; CSV completo; mas a Evolução da mediana liga 2021 a 2023 e a tracejada atravessa quebras (N1). | RA01, RA02, CSV | Corrigir N1. |
| Gastos | D | 8.9 (8.8) | Frase "É um total que depende do porte da capital" evita leitura de ranking por tamanho. | DOM | Convite a compartilhar. |
| Gastos | H | 8.3 (8.2) | Distribuição ordenável mostra a forma da distribuição; Evolução com marcas, mas a mediana contradiz o aviso, o marcador "2" colide com o rótulo "R$ 1.843" (N3) e a 320 px os nomes ainda quebram. | RA01, RA02, RA04, E16 | Corrigir N1, N3; rótulos curtos em telas estreitas. |
| Gastos | I | 8.6 (8.3) | CSV da série correto, ano preservado ao trocar medida, ordem na URL e no CSV; resíduos: parâmetros inválidos persistem. | CSV, DOM | Normalizar todos os parâmetros. |
| Gastos | J | 8.9 (8.9) | axe 0 em 5 execuções; seleção agora marcada por sublinhado; foco de 2 px; 200% e 400% sem perda; novo link em linha de 17 px. | AX, TB, RS | Área de toque dos links em linha. |
| Rede | A | 8.6 (8.4) | Perímetro, ordem, aviso do período; estado vazio melhor; gráfico a 1.232 px (390). | RA09 | Ordem no celular. |
| Rede | B | 8.7 (8.4) | Perímetro nomeado, bloco de siglas, nota do estágio de população; zeros de eAP (6 capitais) ainda sem explicação; "soma de" minúsculo. | DOM | Explicar 0,00; siglas Siaps, Sisab, eCR. |
| Rede | C | 8.4 (8.0) | Razão agregada correta (UBS 0,66, eSF 1,89, eAP 0,29, cobertura 72,6%); estado vazio com motivo; referência do Brasil; Evolução com a mediana tracejada atravessando quebras. | RA13, RA09 | Corrigir N1. |
| Rede | D | 8.9 (8.9) | Sem mudança. | DOM | Lacuna de produção no topo. |
| Rede | H | 8.4 (8.2) | Ordem por valor torna visível a distribuição; marca de base nas séries. | DOM | Igual a Gastos. |
| Rede | I | 8.5 (8.2) | Estado vazio explicado, ano preservado; ainda "Ordem das capitais" sem gráfico (N5). | RA09 | Ocultar a ordem sem gráfico. |
| Rede | J | 8.8 (8.8) | axe 0; sem overflow; tabelas focáveis e nomeadas. | AX, RS | Texto SVG de 11,5 px. |
| Resultados | A | 8.5 (8.2) | Perímetro, ordem, parágrafo de atendimento, aviso de população; texto de ressalva ainda longo; gráfico a 1.283 px (390). | RA14 | Ordem no celular. |
| Resultados | B | 8.6 (7.9) | Siglas à vista, perímetro, explicação do denominador, frase de planos reescrita, fragmentos refeitos; "mgdi_ms_qu3.csv.zip" ainda na fonte. | RA14, DOM | Nome de arquivo fora do corpo. |
| Resultados | C | 8.5 (7.9) | Razão agregada 776, denominador explicado, frase de planos sem relação estabelecida, Brasil como referência separada. | CSV, DOM | Convite a compartilhar recortes. |
| Resultados | D | 8.9 (8.8) | Parágrafo sobre produção não publicada torna a lacuna visível já no topo. | RA14 | Resumo em linguagem simples. |
| Resultados | H | 8.4 (8.2) | Ordenável; Brasil tracejado; barras de grupos; Evolução com mediana tracejada sem rótulos e que atravessa a base quando o denominador é IBGE. | DOM | Rótulos da mediana. |
| Resultados | I | 8.6 (8.2) | Ano normalizado na URL, CSV da série, ordem; ano 2025 forçado vira 2024 sem aviso na página. | DOM | Aviso do ano ajustado. |
| Resultados | J | 8.8 (8.8) | axe 0; link "Atendimento: o que não está..." de 17 a 36 px. | AX, RS | Área de toque. |
| Comparar | A | 8.5 (8.5) | Tabela com cabeçalho por perímetro e "série até 2024" ajudam; no celular o gráfico piorou (1.591 px a 390; 1.774 px a 320) e definição e siglas vêm antes. | RA08, RA06 | Reordenar no celular. |
| Comparar | B | 8.6 (8.1) | Frases com unidade e pontos percentuais, perímetro nomeado, "série até 2024"; DCA, RREO, MSC fora do bloco de siglas. | DOM | Siglas completas. |
| Comparar | C | 8.7 (8.5) | Mesma utilidade com exportações completas e tabela ordenável legível no celular. | CSV, RA06 | Ano padrão com todas as colunas. |
| Comparar | D | 8.9 (8.8) | Totais sem percentual enganoso. | DOM | Convite a compartilhar. |
| Comparar | H | 8.4 (8.2) | Tabela legível, itálico para fora da comparação, evolução com quebras corretas por capital; escala própria em cada gráfico. | RA06, DOM | Eixo comum opcional. |
| Comparar | I | 8.7 (8.4) | Coluna fixa corrigida, URL completa; `ano=3000` e `cap=zzz` permanecem na URL. | RA06, DOM | Normalizar parâmetros. |
| Comparar | J | 8.7 (8.0) | A sobreposição da coluna fixa desapareceu (0 linhas ilegíveis nas medições); axe 0; ainda 10 colunas com rolagem a 320 px e ordem ruim no celular. | RA06, AX | Cartões no celular. |
| Métodos | A | 8.3 (7.6) | Altura quase pela metade, resumo por perfil, matriz recolhida; primeira tela sem visual. | RA15 | Visual ou índice gráfico no topo. |
| Métodos | B | 8.4 (7.7) | Seção de siglas por extenso, política de referências, guias por perfil; ainda registro técnico denso nas fichas. | RA15, DOM | Resumos curtos nas fichas. |
| Métodos | C | 9.0 (8.5) | Exemplo de reconstrução da ICSAP de São Paulo 2024 na própria página, receita do hash, repositório, manifesto, CSV completo e dicionário. Limite: reprodução total exige repositório e Python. | DOM, CSV | Nenhuma além do limite. |
| Métodos | D | 8.6 (8.4) | Resumo por perfil permite ao leigo achar o caminho; conteúdo técnico permanece. | RA15 | Versão resumida. |
| Métodos | H (adapt.) | 8.3 (7.8) | Matriz agrupada e recolhida, blocos nomeados. | DOM | Agrupamento visual. |
| Métodos | I | 8.9 (8.7) | Foco vai para a seção após âncora, busca e filtros, links diretos. | TB, DOM | Link direto na seção Reprodução. |
| Métodos | J | 8.8 (8.5) | `pre` nomeados, foco corrigido, axe 0; 22 links de CSV com 17 px (compartilhado). | AX, RS | Alvos dos links de CSV. |

#### Médias por critério (7 páginas)

| Critério | A | B | C | D | H | I | J |
|---|---|---|---|---|---|---|---|
| Média nova | 8.6 | 8.6 | 8.6 | 8.8 | 8.4 | 8.7 | 8.8 |
| Média anterior | 8.3 | 8.2 | 8.2 | 8.8 | 8.2 | 8.5 | 8.7 |
| Menor nota nova | 8.3 (Métodos) | 8.4 (Métodos) | 8.4 (Panorama, Gastos, Rede) | 8.6 (Métodos) | 8.3 (Gastos, Métodos) | 8.5 (Rede) | 8.7 (Comparar) |

Notas de 9,5 ou mais continuam sem validação adicional que as sustente. Só três notas chegam a 9,0: entrada I, entrada J e Dados e métodos C.

### R4. Bloqueios remanescentes

1. **Comparação materialmente incompatível desenhada contra a regra do módulo (N1).** Na visão Evolução de Gastos, medida por habitante, nominais ou reais, sem capital escolhida, a linha da mediana liga 2021 (R$ 877) a 2022 (R$ 1.044) e a 2023 (R$ 1.173) como um só trecho e só interrompe entre 2023 e 2024. Mas a frase diz "Os valores de 2021, 2022, 2023 usam outra base e não entram nesta variação", a nota 1 diz que a população de 2021 é estimativa anterior ao Censo 2022, e todas as 26 capitais têm base de 2021 distinta da de 2022 (coluna `base_populacional` do CSV público). A causa observada no CSV da série: a marca de base da mediana de 2021 sai como "sim" (igual a 2022 e 2023), enquanto na série de São Paulo e na de eSF por 10 mil ela sai "nao". Com capital escolhida, a linha da capital se interrompe corretamente, mas a **mediana tracejada atravessa todas as quebras** (1 trecho contínuo de 2021 a 2025) em Gastos, Rede e Resultados (denominador IBGE). O leitor vê um salto de cerca de 19% de 2021 a 2022 que o próprio módulo declara não comparável. Caps. RA01, RA02. Correção: marca de base da mediana igual à das capitais do grupo e quebra da linha da mediana nas mesmas posições.

Os bloqueios 1 a 3 da rodada anterior (valor incorreto, ressalva escondida, afirmação sem suporte) **não persistem**. Continuo sem encontrar despesa do município apresentada como gasto total, razão despesa por atendimento, ausência tratada como zero (os zeros de eAP em 6 capitais aparecem como "observado" e ainda sem explicação ao leitor, baixa), exclusão aplicada só ao gráfico (gráfico, tabela, referências e CSV batem), nota ou ranking de gestão, semáforo, Distrito Federal misturado, dado pessoal ou barreira que impeça tarefa essencial. A ordenação por valor traz a nota de que é recurso de leitura, não classificação.

### R5. Tarefas por perfil refeitas

Mesmo protocolo: navegador, sem consulta externa; sem tempos nem taxas. Abri arquivos baixados do site.

* **T1 (cidadão ou conselheiro, jornalista): confirmada, sucesso.** Entrada, "Gastos", seleção da capital (2 ações): "Recife (PE): R$ 1.325; mediana das 25 capitais: R$ 1.354, 2% abaixo da mediana"; Macapá: "R$ 1.011. O valor oficial fica fora da comparação e das medianas (motivo no aviso abaixo)". Obstáculo (baixa): o aviso fica depois do gráfico.
* **T2 (jornalista, gestor): confirmada, sucesso.** "Referências do grupo: 25 de 26 capitais", razão agregada R$ 1.544, grupo por região (São Paulo e Sudeste: mediana de 4 capitais R$ 1.667, faixa central não exibida por haver menos de 8, com o motivo); na Evolução de Resultados a nota diz "Em todos os anos a mediana usa as mesmas 26 capitais", e na de Gastos diz que o conjunto muda (de 25 a 26).
* **T3 (cidadão ou conselheiro, pesquisador): era parcial, agora sucesso na distribuição e parcial na Evolução da mediana.** Passos: Gastos, "Reais de 2025" (ajuda ao lado do controle), exercício 2021 (aviso acima do gráfico: população de 2021 é estimativa anterior ao Censo 2022, "Dois exercícios vizinhos só têm variação por habitante comparável quando a base é a mesma"), Evolução com São Paulo (linha interrompida em 2021 a 2022 e 2023 a 2024, notas 1 e 2). Um leitor consegue explicar com as próprias palavras o que são reais de 2025 e por que 2021 usa outra base. Erros: na Evolução sem capital a linha da mediana liga 2021 a 2023 (N1), o que contradiz o aviso; na despesa total a explicação cita um denominador que não existe (N2). Intervenção externa: nenhuma.
* **T4 (jornalista, pesquisador, cidadão): confirmada, sucesso com obstáculo.** Comparar: o cartão traz "valor oficial fora da comparação" e a ressalva em dois níveis; o segundo nível agora diz que a MSC de dezembro (sem modalidade 91) soma R$ 503.269.686,89, igual ao RREO, e que a DCA (R$ 495.269.686,89, menos 1,6%) é a única fonte com valor distinto; Campo Grande 2021: intraorçamentárias de R$ 74.451.127,64. Obstáculo: o primeiro nível usa DCA, RREO e "conferência pendente"; o bloco de siglas do Comparar não os traz.
* **T5 (cidadão ou conselheiro, gestor): era parcial, agora sucesso.** Cada página nomeia o perímetro ("Perímetro Serviços localizados no território: cadastro de estabelecimentos e equipes situados na capital; não prova funcionamento nem acesso", "Perímetro População residente: internações dos moradores, onde quer que ocorram; não é produção da prefeitura"), com link "Os três perímetros"; a tabela do Comparar tem cabeçalho por perímetro; o Panorama e Métodos continuam claros.
* **T6 (gestor, pesquisador): confirmada, sucesso.** Cobertura potencial de dezembro de 2025 (mediana 83,0%, Brasil 99,1% pela mesma fórmula, "Não é cadastro, atendimento nem pessoas atendidas") e ICSAP de 2024 sem mistura de períodos; Comparar em 2025 mostra "série até 2024" nas colunas de ICSAP; o estado vazio de dezembro de 2021 agora tem motivo próprio.
* **T7 (jornalista, pesquisador): era parcial, agora sucesso.** `saude_despesa_hab_2025.csv` (40 KB, 22 colunas): valor formatado e valor numérico com ponto, numerador, denominador, mediana do grupo, capitais na comparação, fonte por extenso, endereço, data de captura (2026-10-09), versão 1.0, hash, e "Leia antes de usar" ("não classificam governos, não indicam meta e não demonstram causa. Célula vazia não é zero"). A visão Evolução exporta a série (`..._serie_sao-paulo.csv`, com marca de base e mediana do ano). Obstáculos: arquivo pesado e endereço com 3 URLs numa célula; a marca de base da série da mediana de Gastos está errada em 2021 (N1).
* **T8 (pesquisador, jornalista): confirmada, sucesso, agora com o exemplo pedido.** Panorama, "De onde vem cada medida...", Dados e métodos, Reprodução: o exemplo é de São Paulo (ICSAP 2024: numerador 83.391, denominador 11.895.578, valor 701,025204), mais CSV por indicador (`sau_icsap_taxa.csv`), manifesto com URL, data e SHA256, receita do hash e link do repositório. Não reconstruí o numerador a partir do arquivo bruto nem rodei o pipeline.

### R6. Problemas remanescentes e novos

Severidades: bloqueante, alta, média, baixa. "Cap." indica captura em `evidencias/` (códigos RA).

1. **Bloqueante. N1, mediana da Evolução liga ou atravessa quebras de base (Gastos, Rede, Resultados).** Reproduzir: `/gastos?vis=evolucao` (sem capital): a linha liga 2021, 2022 e 2023; `/gastos?vis=evolucao&cap=sao-paulo`: a tracejada da mediana vai de 2021 a 2025 sem interrupção. Cap. RA01, RA02. Correção: marca de base da mediana como a das capitais do grupo (hoje 2021 sai "sim" no CSV da série); interromper a mediana tracejada onde a base muda ou rotular que ela atravessa.
2. **Média. N2, Evolução da despesa total explica a quebra por um denominador que não existe.** Reproduzir: `/gastos?vis=evolucao&med=despesa`: "Os valores de 2021 usam outra base e não entram nesta variação: a base da população do denominador mudou entre os anos"; linha interrompida em 2021 a 2022. A despesa total não usa população. Cap. RA03. Correção: motivo próprio (por exemplo, perímetro de Campo Grande 2021) ou nenhuma quebra.
3. **Média. P16, celular: o primeiro gráfico segue a 1.230 a 1.770 px.** Reproduzir: 320 ou 390 px, Gastos, Rede, Resultados, Comparar. No Comparar, definição e siglas precedem o gráfico. Caps. RA07, RA08. Correção: controles recolhíveis ("Ajustar recorte"), gráfico antes da definição em todas as páginas, siglas depois.
4. **Média. P09, siglas incompletas.** Panorama e entrada sem bloco; Comparar sem DCA, RREO e MSC; Rede sem Siaps, Sisab, eCR, eSFR e eAPP. Correção: bloco de siglas completo em cada página, inclusive Panorama.
5. **Baixa. N3, marcador de nota "2" sobre o rótulo "R$ 1.843".** Reproduzir: `/gastos?vis=evolucao&cap=sao-paulo`. Cap. RA04. Correção: deslocar o número da nota.
6. **Baixa. N5, "Ordem das capitais" visível quando não há gráfico.** Reproduzir: Rede, cobertura potencial, dez. 2021. Cap. RA09. Correção: ocultar o controle no estado vazio; remover a frase duplicada.
7. **Baixa. N6, defeitos de texto novos.** "soma de 25 de 26 capitais" em minúscula depois de ponto (6 blocos em Gastos, Rede e Resultados); "UBS públicas ativas ... vai de"; "equipes ... vai de 0,00 em Belo Horizonte (MG), Boa Vista (RR) e mais 4" sem dizer que 0,00 significa nenhuma equipe eAP registrada. Cap. RA05.
8. **Baixa. N7 e P21 e P22, tamanhos.** Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 17 px ("Os três perímetros", "Atendimento: o que não está..."); rodapé e links de CSV de 17 px (compartilhados).
9. **Baixa. N9, CSV pesado e repetitivo.** 40 KB para 26 linhas; "Endereço da fonte" com 3 URLs em uma célula, com marcadores `<ano>` e `<código IBGE>`. Correção: endereços em arquivo à parte (manifesto) e uma coluna curta.
10. **Baixa. P27, P26 e P28, resíduos.** Parâmetros inválidos de capital, medida e visão permanecem na URL; aviso de exclusão abaixo do gráfico; "Não é custo por usuário do SUS" duas vezes em Gastos; Evolução: a mediana tracejada não tem rótulos de valor.

### R7. Defeitos novos que procurei e não encontrei

Dois blocos de colunas e ordem no celular (exceto P16); nova linha de ordem (funciona, preserva URL e CSV, só falha no estado vazio); avisos de período (não cobrem dados que não dependem de população, ver N2); glossário (seção de siglas de Métodos é correta e completa); matriz de fontes recolhida (abre e filtra, com 80 blocos recolhíveis no total e 0 abertos por padrão); cabeçalho compacto (sem perda de navegação, wordmark oculto a 320 e 390 px como antes); marcas de base na Evolução (funcionam na linha da capital); textos novos (sem linguagem avaliativa, sem hífen ou travessão como pontuação em prosa: 0 travessões e meias-riscas; o sinal de menos tipográfico aparece só dentro de valores negativos citados); console sem erros em 9 rotas e estados medidos.

### R8. Desempenho percebido (laboratório, repetido)

Mesmo protocolo (Chromium 141 sem estrangulamento, localhost, janela 1440 por 900, contexto novo, 5 execuções, mediana; não representa experiência real). FCP de 92 a 168 ms, LCP de 92 a 328 ms, CLS de 0,000 a 0,001, DOMContentLoaded de 30 a 190 ms, carga de 104 a 208 ms, 20 a 27 requisições nas páginas do módulo (49 na entrada), 1,1 a 1,6 MB decodificados nas páginas do módulo (4,7 MB na entrada), 0 erros de console. Troca de seletores segue sem espera perceptível.

### R9. Limitações da reavaliação

* Inspeção heurística de um agente; só Chromium 141; sem leitor de tela real, sem dispositivos físicos, sem usuários reais.
* Não confrontei os dados com as fontes oficiais nem reconstruí o numerador do ICSAP a partir do arquivo bruto; as conferências foram internas ao módulo (CSV baixados do site e arquivos públicos de `/eficiencia/series`). A causa de N1 (marca de base da mediana de 2021) foi inferida do CSV da série e do comportamento do gráfico, não de leitura do código das correções.
* Não repeti todas as combinações de medida, ano, capital e grupo; testei as listadas em R2 e R5. A medida "ICSAP (número)" e as séries de eAP foram verificadas só por amostra.
* O contraste de texto sobre a faixa sombreada do gráfico segue não medido ponto a ponto (o axe a declara "incompleta").
* E, F, G e K continuam sem nota nesta avaliação; as observações sobre elas são de leitor.

---

## Reavaliação 2

* **Data:** 09/10/2026 (UTC), depois do segundo ciclo de correções do executor (gold com `hash_dados` começando em `159b7602`). **Avaliador:** o mesmo agente de IA (Claude Sonnet 5.5) na função de avaliador de experiência. A seção 5 do `CORRECOES.md` foi lida só para saber o que verificar; cada ponto foi refeito no navegador.
* **Natureza:** inspeção heurística de agente, Playwright 1.56.1 e Chromium 141 sobre o build final em `http://localhost:3111`. Sem usuários reais; as tarefas por perfil são papéis simulados, sem tempos nem taxas.
* **Verificações repetidas:** Evolução em 9 medidas e estados (contagem de trechos de linha, marcas, notas e motivo da quebra), CSV da série e do recorte (10 downloads), posição do primeiro gráfico em 320, 390 e 768 px nas 5 páginas de exploração mais Métodos, siglas por página contra as siglas usadas no texto visível, estado vazio, concordância e maiúsculas em 10 frases de título, URL com ano inválido, axe-core 4.12.1 (28 execuções, 0 violações), contraste calculado (0 abaixo de AA em 8 páginas e estados), overflow e alvos em 12 rotas e estados nas 4 larguras (0 px de rolagem horizontal), zoom de 200% e 400% em 6 rotas, teclado (24 paradas de Tab em Gastos, grupos de rádio), carga em laboratório (5 execuções por página).
* **Evidências novas (prefixo `reaval2_`, 9 arquivos em `evidencias/`):** RB01 `reaval2_gastos_1440_evolucao-mediana-com-quebras.png`; RB02 `reaval2_gastos_1440_evolucao-sp-mediana-interrompida.png`; RB03 `reaval2_rede_1440_cobertura-evolucao-tres-bases.png`; RB04 `reaval2_gastos_320-390_ordem-no-celular.png`; RB05 `reaval2_comparar_320-390_resultado-antes-da-definicao.png`; RB06 `reaval2_gastos_1440_linha-fora-da-comparacao.png`; RB07 `reaval2_panorama_1440_bloco-de-siglas.png`; RB08 `reaval2_rede_1440_nota-de-zero-observado.png`; RB09 `reaval2_gastos_1440_evolucao-total-campo-grande.png`. Códigos sem imagem como antes (AX, CT, RS, TB, CSV, DOM).

### S1. Resultado em uma linha

**Nenhum bloqueio remanescente nesta reavaliação:** N1 (a mediana da Evolução que ligava anos de bases populacionais diferentes) foi corrigida e verificada em Gastos, Rede e Resultados, a troca de base da cobertura potencial de dezembro de 2024 para 2025 está sinalizada, e os defeitos de texto e de estado vazio sumiram; ainda assim só 4 das 49 notas chegam a 9,0, as médias por critério ficam entre 8,5 e 8,9 e o celular continua com o primeiro gráfico bem abaixo da primeira tela.

### S2. Estado de cada problema da Reavaliação 1

| Item | Estado | Verificação no navegador e resíduo |
|---|---|---|
| Bloqueio N1, mediana da Evolução | **Corrigido** | Gastos, por habitante, sem capital (nominais e reais): a mediana tem dois trechos (2022 a 2023 e 2024 a 2025) com 2021 isolado; aviso "Mudança de base entre 2021 e 2022; 2023 e 2024". O CSV da série traz a marca de base da mediana "nao, sim, sim, nao, nao" (igual à de São Paulo e à de eSF por 10 mil). Com capital escolhida, a mediana tracejada também se interrompe nos mesmos pontos (2 trechos tracejados e 2 sólidos), em Gastos e em Rede; em Resultados com denominador IBGE a tracejada fica em 1 trecho (2022 a 2023), coerente com as marcas. Caps. RB01, RB02. |
| N2, motivo da quebra por medida | **Corrigido** | Despesa total (R$): sem quebra e sem citar denominador ("de R$ 1,02 bilhão em 2021 para R$ 1,53 bilhão em 2025"); Campo Grande: 2021 com losango "valor oficial fora das comparações e sem linha com os anos vizinhos" e o motivo do perímetro; Macapá 2025 idem com a conferência pendente; ASPS: sem quebra; medidas por habitante: "a base da população do denominador mudou"; cobertura potencial: "a população de referência do Ministério mudou de base". Caps. RB02, RB09. |
| P16, celular, primeiro gráfico | **Parcial** | Melhorou em 3 páginas e não em Gastos. A 390 px: Gastos 1.348 para 1.326 px, Rede 1.232 para 1.160, Resultados 1.283 para 1.211, Comparar 1.591 para 1.085; a 320 px: Gastos 1.615 para 1.558, Rede 1.490 para 1.383, Resultados 1.559 para 1.488, Comparar 1.774 para 1.229. No Comparar o resultado agora vem antes da definição e das siglas. Mesmo assim o primeiro gráfico fica a 1,4 a 1,9 telas de altura, e a primeira tela de 320 por 800 e de 390 por 800 não tem visual. Caps. RB04, RB05. |
| P09, siglas | **Corrigido, com resíduo** | Bloco "Siglas desta página" também no Panorama (DCA, SIOPS, ASPS, UBS, eSF, APS, ICSAP, SUS); Comparar com DCA, RREO, MSC e RIPSA; Rede com eCR, eSFR, eAPP, Siaps e Sisab (entradas agrupadas); a entrada expande ICSAP, ASPS e UBS por extenso no cartão de Saúde (Ideb e Saeb, de Educação, seguem sem expansão). Resíduos pequenos: SUS ausente nos blocos de Gastos e Rede, CNES no Panorama, IPCA no Comparar, IBGE em Resultados. Cap. RB07. |
| N5, "Ordem das capitais" sem gráfico | **Corrigido** | No estado vazio da cobertura de dezembro de 2021 (distribuição e tabela) o controle não aparece; só "Visão" permanece. |
| N6, defeitos de texto | **Corrigido** | "Soma de N de 26 capitais" com maiúscula em Gastos, Rede e Resultados (0 ocorrências de "soma" em minúscula depois de ponto nas 7 páginas); "UBS públicas ... vão de", "internações ICSAP por 100 mil habitantes vão de" (plural concorda); "Valor zero observado em 6 capitais: Belo Horizonte (MG), Boa Vista (RR), Cuiabá (MT), Macapá (AP), São Luís (MA), Teresina (PI). A fonte informa zero, e não ausência de dado." Cap. RB08. |
| Linha das capitais fora da comparação acima do gráfico | **Corrigido em 3 de 4 páginas** | Gastos: "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." com link que leva ao bloco (a 96 px do topo); Rede (cobertura 2021: "26 capitais fora da comparação neste recorte. Motivo e detalhe abaixo."). Resultados não tem exclusão. No Comparar sem capital escolhida não há essa linha (só o rótulo no gráfico). Cap. RB06. |
| Nova troca de base da cobertura (dezembro de 2024 para 2025) | **Corrigido** | Aviso acima do gráfico ("A população de referência de dezembro de 2025 é a estimativa de 2024 ... A variação entre dezembro de 2024 e dezembro de 2025 mistura dois anos de crescimento populacional e não mede só a cobertura"), anotações 1, 2 e 3 no gráfico, linha interrompida em 2022 a 2023 e 2024 a 2025, variação 2024 para 2025 ausente da frase ("de 76,9% em dez. 2023 para 83,5% em dez. 2024"), nota repetida na referência do Brasil (99,1%) e no Comparar; 2021 com losango. Cap. RB03. |
| N3, marcador "2" sobre o rótulo de valor | **Não corrigido** | Declarado pelo executor como componente compartilhado; "2" ainda cobre parte de "R$ 1.843" na Evolução de São Paulo (RB02). Baixa. |
| N7 e P21 e P22, tamanhos | **Não alterado** | Declarado. Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 17 px ("Os três perímetros", "Motivo e detalhe abaixo", "Atendimento: o que não está..."); rodapé e 22 links de CSV de 17 px (compartilhados). |
| N9, CSV pesado | **Parcial** | 24,8 KB para 26 linhas (antes 40 KB); "Páginas oficiais da fonte" sem marcadores `<ano>`; a célula ainda junta até 3 URLs separadas por espaço e o endereço exato fica no manifesto. A Métodos ainda diz "CSV com fonte, endereço, data de captura": a coluna se chama "Páginas oficiais da fonte". |
| P26, "motivo abaixo" | **Corrigido** | Ver "Linha das capitais fora da comparação". |
| P27, parâmetros inválidos na URL | **Não alterado** | Declarado. Ano continua normalizado; `cap=xyz&med=foo&vis=bar` e `ano=3000` no Comparar seguem na URL, com a página no padrão (baixa). |
| P28, redundância | **Corrigido** | "Não é custo por usuário do SUS" aparece uma vez na tela de Gastos. |

### S3. Matriz de notas atualizada

Avaliador: Claude Sonnet 5.5, agente independente de experiência, reavaliação 2. Formato: página | critério | nota nova (Reavaliação 1) | justificativa curta quando mudou | evidência | correção necessária. Mesmas adaptações (entrada: A sem visual principal e H como comunicação visual; Métodos: H como estrutura de tabelas e listas). Notas com uma casa decimal; o que a evidência sustenta.

| Página | Crit. | Nota (R1) | Justificativa curta | Evidência | Correção necessária |
|---|---|---|---|---|---|
| Entrada | A | 8.8 (8.8) | Sem mudança; sem visual por natureza. | E01 | Link Panorama sublinhado como página atual. |
| Entrada | B | 8.7 (8.5) | O cartão de Saúde agora expande ICSAP, ASPS e UBS por extenso; o de Educação segue com Ideb e Saeb. | DOM | Expandir Ideb e Saeb. |
| Entrada | C | 8.5 (8.5) | Sem mudança. | DOM | Atalhos por pergunta. |
| Entrada | D | 8.9 (8.9) | Sem mudança. | E01 | Públicos e compartilhamento. |
| Entrada | H (adapt.) | 8.4 (8.4) | Sem mudança. | E01 | Prévia visual opcional. |
| Entrada | I | 9.0 (9.0) | Sem mudança; 12 links respondem 200. | DOM | `aria-current` e estilo do Panorama. |
| Entrada | J | 9.0 (9.0) | axe 0 violações; 0 px de overflow; 200% e 400% sem perda. | AX, RS | Alvos do rodapé (compartilhado). |
| Panorama | A | 8.6 (8.6) | Bloco de siglas no fim (página 740 px mais alta a 320 px); gráfico a 1.120 px a 390 px. | RB07 | Ticks regulares; menos altura no celular. |
| Panorama | B | 8.8 (8.5) | Bloco "Siglas desta página" com ICSAP, ASPS, UBS, eSF e SUS; CNES fora do bloco. | RB07 | Incluir CNES. |
| Panorama | C | 8.4 (8.4) | Sem mudança funcional; exclusão de Macapá em uma linha sem motivo. | DOM | Motivo curto; grupo por região. |
| Panorama | D | 8.8 (8.8) | Sem mudança. | E02 | Convite a compartilhar. |
| Panorama | H | 8.5 (8.5) | Sem mudança (legenda da faixa mantida; ticks apertados). | RA12 | Opção de ver todos os pontos. |
| Panorama | I | 8.8 (8.8) | Sem mudança. | DOM | Ano e grupo no Panorama. |
| Panorama | J | 8.9 (8.9) | axe 0; contraste mínimo 4,92:1; texto SVG de 11,5 px. | AX, CT | Mínimo de 12 px. |
| Gastos | A | 8.6 (8.6) | Linha de exclusão acima do gráfico e aviso do período; no 1440 por 900 o gráfico começa a 583 px (12 capitais na primeira tela); celular a 1.326 px (390) e 1.558 px (320). | RB06, RB04 | Controles recolhíveis no celular. |
| Gastos | B | 8.9 (8.7) | Motivo de quebra correto por medida, maiúsculas e concordância, repetição removida; "Os três perímetros" solto em linha própria. | RB09, DOM | Alinhar o link ao texto. |
| Gastos | C | 9.0 (8.4) | Evolução sem a ligação falsa, mediana interrompida, exclusões com motivo, CSV da série e do recorte completos, ordenação, grupo por região, nominal e real. | RB01, RB02, CSV | Nenhuma além dos limites declarados. |
| Gastos | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar. |
| Gastos | H | 8.7 (8.3) | A Evolução agora respeita as quebras na linha da capital e na mediana, com losangos para valor fora da comparação; o marcador "2" ainda toca o rótulo e a 320 px os nomes seguem quebrando. | RB01, RB02, E16 | Deslocar nota; rótulos curtos no celular. |
| Gastos | I | 8.8 (8.6) | Link "Motivo e detalhe abaixo" leva ao bloco; CSV da série; ano preservado; o foco não vai ao alvo do link; parâmetros inválidos persistem. | RB06, DOM | Foco no alvo; normalizar parâmetros. |
| Gastos | J | 8.9 (8.9) | axe 0; foco de 2 px; seleção sublinhada; ajuda dos seletores oculta no celular mas mantida por `aria-describedby`. | AX, TB | Área de toque dos links em linha. |
| Rede | A | 8.6 (8.6) | Nota de zero e linha de exclusão acima do gráfico; gráfico a 1.160 px (390). | RB08 | Ordem no celular. |
| Rede | B | 8.9 (8.7) | Siglas completas (eCR, eSFR, eAPP, Siaps, Sisab), nota de zero observado, "vão de", aviso das três bases da cobertura. | RB08, RB03 | SUS no bloco. |
| Rede | C | 8.9 (8.4) | Cobertura com três bases explicadas, variação 2024 para 2025 bloqueada, Brasil como referência da mesma fórmula, zero esclarecido, estado vazio com motivo. | RB03, RB08 | Nenhuma além dos limites. |
| Rede | D | 8.9 (8.9) | Sem mudança. | DOM | Lacuna de produção no topo. |
| Rede | H | 8.6 (8.4) | Linha da mediana interrompida onde a base muda; losango em 2021; três anotações legíveis. | RB03 | Ver todos os pontos. |
| Rede | I | 8.8 (8.5) | Controle de ordem some sem gráfico; ano preservado; link de motivo. | DOM | Normalizar parâmetros. |
| Rede | J | 8.8 (8.8) | axe 0; sem overflow. | AX, RS | Texto SVG de 11,5 px. |
| Resultados | A | 8.6 (8.5) | Gráfico a 1.211 px (390) e 1.488 px (320), 70 px acima; texto de ressalva ainda longo. | RS | Ordem no celular. |
| Resultados | B | 8.8 (8.6) | Siglas, perímetro, denominador explicado; IBGE fora do bloco; "mgdi_ms_qu3.csv.zip" na fonte. | DOM | IBGE no bloco. |
| Resultados | C | 8.8 (8.5) | Razão agregada correta, denominador explicado (iguais em 2024), Brasil e Brasil sem as capitais, planos como contexto. | CSV, DOM | Nenhuma além dos limites. |
| Resultados | D | 8.9 (8.9) | Sem mudança. | RA14 | Resumo em linguagem simples. |
| Resultados | H | 8.6 (8.4) | Mediana do Evolução com denominador IBGE segue as marcas; tracejada sem rótulos de valor. | DOM | Rótulos da mediana. |
| Resultados | I | 8.7 (8.6) | Ano normalizado, CSV da série, ordem. | DOM | Aviso do ano ajustado. |
| Resultados | J | 8.8 (8.8) | axe 0; link "Atendimento: o que não está..." de 17 a 36 px. | AX, RS | Área de toque. |
| Comparar | A | 8.7 (8.5) | Resultado antes da definição e das siglas no celular (gráfico a 1.085 px em 390 e 1.229 px em 320); sem linha de exclusão acima do gráfico. | RB05 | Linha de exclusão no Comparar. |
| Comparar | B | 8.8 (8.6) | Siglas com DCA, RREO, MSC e RIPSA; IPCA fora do bloco; frases com unidade. | DOM | IPCA e SUS. |
| Comparar | C | 8.9 (8.7) | Mesma utilidade com avisos de base por medida e exportações completas; colunas de ICSAP em 2025 ainda vazias ("série até 2024"). | CSV | Ano padrão com todas as colunas. |
| Comparar | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar. |
| Comparar | H | 8.5 (8.4) | Evolução por capital com losangos e quebras corretas; escala própria por gráfico. | DOM | Eixo comum opcional. |
| Comparar | I | 8.7 (8.7) | Sem mudança relevante; `ano=3000` e `cap=zzz` permanecem na URL. | DOM | Normalizar parâmetros. |
| Comparar | J | 8.8 (8.7) | axe 0; ordem no celular mais direta; tabela com 10 colunas rola dentro da região nomeada. | AX, RS | Cartões no celular. |
| Métodos | A | 8.3 (8.3) | Sem mudança; 8.728 px a 1440 px e 17.148 px a 320 px; primeira tela sem visual. | RA15 | Visual ou índice gráfico. |
| Métodos | B | 8.4 (8.4) | Siglas, referências e guias por perfil mantidos; fichas ainda densas; "CSV com fonte, endereço" desatualizado. | DOM | Ajustar o texto; resumos curtos. |
| Métodos | C | 9.0 (9.0) | Exemplo de reconstrução de São Paulo (ICSAP 2024: 83.391 ÷ 11.895.578, 701,0252), hash descrito sem ambiguidade (sem escape ASCII), repositório, manifesto, CSV e dicionário. | DOM, CSV | Nenhuma além do limite. |
| Métodos | D | 8.6 (8.6) | Sem mudança. | RA15 | Versão resumida. |
| Métodos | H (adapt.) | 8.3 (8.3) | Sem mudança. | DOM | Agrupamento visual. |
| Métodos | I | 8.9 (8.9) | Foco vai à seção após âncora (4 testadas). | TB | Link direto na Reprodução. |
| Métodos | J | 8.8 (8.8) | axe 0; `pre` nomeados; 22 links de CSV de 17 px (compartilhado). | AX, RS | Alvos dos links de CSV. |

#### Médias por critério (7 páginas)

| Critério | A | B | C | D | H | I | J |
|---|---|---|---|---|---|---|---|
| Média nova | 8.6 | 8.8 | 8.8 | 8.8 | 8.5 | 8.8 | 8.9 |
| Média anterior (R1) | 8.6 | 8.6 | 8.6 | 8.8 | 8.4 | 8.7 | 8.8 |
| Menor nota nova | 8.3 (Métodos) | 8.4 (Métodos) | 8.4 (Panorama) | 8.6 (Métodos) | 8.3 (Métodos) | 8.7 (Resultados, Comparar) | 8.8 (Rede, Resultados, Comparar, Métodos) |

Só quatro notas chegam a 9,0: entrada I, entrada J, Gastos C e Dados e métodos C. Notas de 9,5 ou mais continuam sem validação adicional que as sustente. As páginas do módulo atendem 9,0 em J por faixa estreita (8,8 a 8,9), mas ficam abaixo por limitações menores e pelo celular.

### S4. Bloqueios remanescentes

**Nenhum.** Verifiquei de novo: valor incorreto (razão agregada correta em 12 combinações; as notas de zero eAP explicam o zero), comparação materialmente incompatível (a Evolução liga só anos da mesma base na linha da capital e na da mediana; a variação de cobertura 2024 para 2025 está bloqueada com aviso), despesa do município como gasto total (o texto repete que não é), razão despesa por atendimento, ausência tratada como zero, exclusão aplicada só ao gráfico (gráfico, tabela, referências e CSV batem em 2021 e 2025), ressalva essencial escondida (a composição diz "Soma de N de 26 capitais" e nomeia quem ficou fora; no celular a etiqueta curta do perímetro omite o "não é o gasto de União e estado", mas a ressalva continua em "O que a despesa inclui, e o que não inclui" na mesma página, ver S6 item 5), afirmação causal ou de eficiência sem suporte, nota, ranking de gestão, semáforo, Distrito Federal misturado, dado pessoal ou barreira que impeça tarefa essencial. A ordenação por valor segue com a nota de que é recurso de leitura.

### S5. Tarefas por perfil refeitas

Mesmo protocolo: navegador, sem consulta externa, sem tempos nem taxas; abri arquivos baixados do site.

* **T1 (cidadão ou conselheiro, jornalista): confirmada, sucesso.** Entrada, "Gastos", capital: Recife (R$ 1.325, mediana das 25 capitais R$ 1.354) e Macapá ("fora da comparação e das medianas"); agora também "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." logo acima do gráfico, com link.
* **T2 (jornalista, gestor): confirmada, sucesso.** "Referências do grupo: 25 de 26", razão agregada R$ 1.544, grupo por região (Sudeste: mediana de 4 capitais R$ 1.667, faixa central não exibida por haver menos de 8).
* **T3 (cidadão ou conselheiro, pesquisador): sucesso, inclusive na Evolução da mediana.** Passos: Gastos, "Reais de 2025" (ajuda ao lado do controle, "em 2025 coincidem com os nominais"), exercício 2021 (aviso: população de 2021 é estimativa anterior ao Censo 2022), Evolução sem capital: a linha da mediana tem dois trechos, com marcas de mudança de base entre 2021 e 2022 e entre 2023 e 2024, notas 1 e 2 e a frase "Os valores de 2021, 2022, 2023 usam outra base e não entram nesta variação". O leitor consegue explicar com as próprias palavras o que são reais de 2025 e por que 2021 não é comparável por habitante, e o gráfico agora concorda com o texto. Erros: nenhum. Obstáculo (baixa): "Os valores de 2021, 2022, 2023 ... não entram nesta variação" exige ler a frase inteira para entender que se refere ao par 2024 e 2025.
* **T4 (jornalista, pesquisador, cidadão): confirmada, sucesso com obstáculo.** Macapá 2025: a ressalva do cartão, em dois níveis, diz que a MSC sem a modalidade 91 soma R$ 503.269.686,89, igual ao RREO, e a DCA (R$ 495.269.686,89, menos 1,6%) é a única fonte distinta; Campo Grande 2021: intraorçamentárias de R$ 74.451.127,64. Obstáculo: o primeiro nível usa DCA, RREO e "conferência pendente"; o bloco de siglas do Comparar agora os traz.
* **T5 (cidadão ou conselheiro, gestor): confirmada, sucesso.** Etiqueta "Perímetro" em Gastos, Rede, Resultados e Comparar (no celular a etiqueta fica curta, ex.: "Recursos executados pelo município", com o link "Os três perímetros"); Panorama e Métodos continuam claros.
* **T6 (gestor, pesquisador): confirmada, sucesso, agora com a segunda troca de base.** Cobertura potencial de dezembro de 2025 (mediana 83,0%, Brasil 99,1%, "Não é cadastro, atendimento nem pessoas atendidas") separada de ICSAP 2024; o aviso diz que a passagem de dezembro de 2024 para 2025 mistura dois anos de crescimento populacional.
* **T7 (jornalista, pesquisador): confirmada, sucesso.** `saude_despesa_hab_2025.csv` (24,8 KB, 22 colunas): valor formatado e numérico, numerador, denominador, mediana do grupo, capitais na comparação, fonte, páginas oficiais, data de captura (2026-10-09), versão 1.0, hash e "Leia antes de usar"; a visão Evolução exporta a série com a marca de base ("nao, sim, sim, nao, nao" na mediana). Obstáculo (baixa): URLs separadas por espaço numa célula.
* **T8 (pesquisador, jornalista): confirmada, sucesso.** Panorama, "De onde vem cada medida...", Dados e métodos, Reprodução: exemplo de São Paulo (ICSAP 2024: numerador 83.391, denominador 11.895.578, valor 701,0252), receita do hash, link do repositório, CSV por indicador e manifesto. Não reconstruí o numerador a partir do arquivo bruto.

### S6. Problemas remanescentes e novos

Severidades: bloqueante, alta, média, baixa. "Cap." indica captura em `evidencias/` (códigos RB, RA, E).

1. **Média. P16, celular: primeiro gráfico a 1.085 a 1.558 px.** Reproduzir: 320 ou 390 px, Gastos (1.558 e 1.326 px), Rede (1.383 e 1.160), Resultados (1.488 e 1.211), Comparar (1.229 e 1.085); a primeira tela não tem visual, só controles. Caps. RB04, RB05. Correção: seção "Ajustar recorte" recolhível (medida, período, capital, valores, ordem) fechada por padrão no celular, com a frase do resultado e o gráfico logo abaixo do título.
2. **Baixa. Link "Os três perímetros" em linha própria e desalinhado.** Reproduzir: Gastos a 1440 e 390 px: o link fica abaixo da etiqueta, recuado cerca de 12 px, e mede 17 px de altura em parte das larguras. Cap. RB06. Correção: manter na mesma linha ou alinhar à esquerda com a área de toque de 44 px.
3. **Baixa. Comparar sem a linha de exclusão acima do gráfico.** Reproduzir: `/comparar` sem capital: Macapá só aparece como rótulo no gráfico ("fora da comparação (motivo abaixo)") e no bloco final. Correção: a mesma linha de Gastos e Rede.
4. **Baixa. Foco não vai ao alvo do link "Motivo e detalhe abaixo".** Reproduzir: Gastos, ativar o link: a página rola até o bloco (96 px do topo), o foco fica no corpo. Em Dados e métodos o foco vai à seção. Correção: mover o foco para o bloco.
5. **Baixa. Etiqueta curta do perímetro no celular omite a ressalva e a ajuda dos seletores some.** A 390 px: "Perímetro Recursos executados pelo município" sem "não é o gasto de União e estado no território"; as ajudas "Opcional: destaca uma capital" e "Período do dado" ficam ocultas (continuam em `aria-describedby`, o que atende leitores de tela). A ressalva do perímetro permanece em "O que a despesa inclui, e o que não inclui". Correção: manter a frase curta de limite na etiqueta.
6. **Baixa. N3 e N7, resíduos declarados pelo executor.** Marcador "2" sobre o rótulo "R$ 1.843" (RB02); texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 17 px; parâmetros inválidos na URL.
7. **Baixa. Siglas ainda faltando nos blocos.** SUS (Gastos, Rede), CNES (Panorama), IPCA (Comparar), IBGE (Resultados).
8. **Baixa. CSV e texto de Métodos.** Célula "Páginas oficiais da fonte" com até 3 URLs separadas por espaço; o guia por perfil de Métodos ainda cita "endereço".
9. **Baixa. Primeira tela a 1440 por 900 com o gráfico mais baixo.** Em Gastos a lista de capitais começa a 583 px (12 capitais visíveis); ordem, aviso, linha de exclusão e ajuda empurram o gráfico. Correção: aviso do período em uma linha ou depois do gráfico.

### S7. Defeitos novos que procurei neste ciclo

* **Ordem das colunas no celular:** Comparar agora mostra controles, resultado, gráfico e só depois a definição; Gastos, Rede e Resultados mantêm controles, resultado, gráfico, definição e siglas; nenhuma ordem quebra a leitura. Falta apenas recolher os controles (item 1).
* **Ajuda dos seletores oculta em telas estreitas:** `display:none` a 390 px com `aria-describedby` apontando para o texto (a descrição acessível permanece); a perda é só visual (item 5).
* **Etiqueta de perímetro curta:** legível e correta, mas sem o limite (item 5).
* **Blocos de siglas:** corretos e discretos; páginas mais altas (Panorama a 320 px: 8.068 contra 7.326 px na avaliação inicial).
* **Avisos por período:** presentes e coerentes nas três medidas por habitante, na cobertura e no estado vazio; sem conflito com as notas do CSV.
* **Nota de zero:** correta, nomeia as 6 capitais, diz que a fonte informa zero.
* **Textos novos:** sem linguagem avaliativa; sem hífen ou travessão como pontuação em prosa (0 travessões e meias-riscas; o sinal de menos tipográfico aparece só em valores negativos citados); console sem erros em 9 rotas e estados medidos.

### S8. Desempenho percebido (laboratório, repetido)

Mesmo protocolo (Chromium 141 sem estrangulamento, localhost, janela de 1440 por 900, contexto novo, 5 execuções, mediana; não representa experiência real). FCP de 116 a 184 ms, LCP de 120 a 316 ms, CLS de 0,000 a 0,001, DOMContentLoaded de 46 a 196 ms, carga de 126 a 250 ms, 20 a 27 requisições nas páginas do módulo (49 na entrada), 1,1 a 1,6 MB decodificados nas páginas do módulo (4,7 MB na entrada), 0 erros de console. Sem espera perceptível ao trocar seletores.

### S9. Limitações da reavaliação 2

* Inspeção heurística de um agente; só Chromium 141; sem leitor de tela real, sem dispositivos físicos, sem usuários reais. A afirmação de que a descrição dos seletores ocultos continua acessível se baseia no atributo `aria-describedby` e na regra de nome e descrição acessíveis, sem teste com tecnologia assistiva.
* Não confrontei os dados com as fontes oficiais nem reconstruí o numerador do ICSAP a partir do arquivo bruto; a coerência das marcas de base foi conferida entre a tela, o CSV da série e os CSV públicos do módulo, sem leitura do código das correções.
* Não repeti todas as combinações de medida, ano, capital e grupo; testei as listadas em S2, S5 e S7. As séries de eAP, de "ICSAP (número)" e de totais foram verificadas por amostra.
* O contraste de texto sobre a faixa sombreada do gráfico segue não medido ponto a ponto (o axe a declara "incompleta").
* E, F, G e K continuam sem nota nesta avaliação; as observações sobre elas são de leitor.

---

## Reavaliação 3

* **Data:** 09/10/2026 (UTC), depois do terceiro ciclo de correções (gold com `hash_dados` começando em `ea1565fe`). **Avaliador:** o mesmo agente de IA (Claude Sonnet 5.5) na função de avaliador de experiência. A seção 6 do `CORRECOES.md` foi lida só para saber o que verificar; cada ponto foi refeito no navegador.
* **Natureza:** inspeção heurística de agente, Playwright 1.56.1 e Chromium 141 sobre o build final em `http://localhost:3111`. Sem usuários reais; as tarefas por perfil são papéis simulados, sem tempos nem taxas.
* **Verificações repetidas:** resumo "Ajustar o recorte" (texto em 10 estados, abrir e fechar por clique, Enter e Espaço, estado depois de trocar medida, capital, recarga e voltar do navegador, fechamento na carga com observador de pintura e de deslocamento de layout em 4 larguras e 4 páginas, comportamento a 1023 e 1024 px e ao redimensionar), posição do primeiro gráfico em 320, 390 e 768 px, perímetro curto no celular, link de exclusão e foco no bloco do motivo, Evolução em 9 estados (colisão de texto entre número de nota e rótulo), siglas por página contra as siglas usadas, quadro "O módulo em números" e barra das decisões (estrutura, contraste, aria), Panorama (links, motivo, CSV baixado), entrada (linha "Fontes"), CSV do recorte, da série e da tabela, axe-core 4.12.1 (28 execuções), contraste calculado em 8 páginas e estados, overflow e alvos em 12 rotas e estados nas 4 larguras, zoom de 200% e 400% em 6 rotas, teclado (24 paradas de Tab em Gastos), carga em laboratório (5 execuções por página).
* **Evidências novas (prefixo `reaval3_`, 8 arquivos em `evidencias/`):** RC01 `reaval3_gastos_320-390_recorte-recolhido-e-aberto.png`; RC02 `reaval3_comparar_320-390_recorte-recolhido.png`; RC03 `reaval3_gastos_1440_evolucao-sp-rotulo-sem-colisao.png`; RC04 `reaval3_metodos_1440_quadro-em-numeros-e-barra.png`; RC05 `reaval3_panorama_1440_links-csv-reproducao-e-motivo.png`; RC06 `reaval3_rede_390_evolucao-marcador-sobre-rotulo.png`; RC07 `reaval3_entrada_1440_linha-fontes.png`; RC08 `reaval3_gastos_1440_controles-abertos-sem-resumo.png`. Códigos sem imagem como antes (AX, CT, RS, TB, CSV, DOM).

### T1. Resultado em uma linha

**Nenhum bloqueio, e o celular melhorou de verdade:** o primeiro gráfico saiu de 1.085 a 1.558 px para 730 a 945 px a 390 px (Comparar já dentro da primeira tela), o resumo "Ajustar o recorte" funciona por clique e por teclado sem piscar e sem deslocamento de layout, mas a única verificação automática nova que falha é do próprio ciclo (axe "definition-list", gravidade serious, no quadro "O módulo em números"); 7 das 49 notas chegam a 9,0 e as médias por critério ficam entre 8,6 e 8,9.

### T2. Estado de cada problema da Reavaliação 2

| Item | Estado | Verificação no navegador e resíduo |
|---|---|---|
| P16, celular, primeiro gráfico | **Corrigido, com resíduo** | Controles do recorte sob "Ajustar o recorte" (`details`, id `recorte`, e `recorte-cmp` no Comparar). Primeiro gráfico a 390 px: Gastos 940 (antes 1.326), Rede 904 (1.160), Resultados 945 (1.211), Comparar 730 (1.085); a 320 px: 1.131 (1.558), 1.109 (1.383), 1.117 (1.488), 819 (1.229); a 768 px (1024 de altura) todos entre 625 e 802 px, dentro da primeira tela. O título do resultado já aparece dentro de 800 px (689 a 749 px a 390 px). Resíduo: a 390 por 800 e a 320 por 800 o gráfico de Gastos, Rede e Resultados ainda começa 100 a 330 px abaixo da primeira tela, e Visão, CSV e Ordem das capitais ficam fora do recolhível. Caps. RC01, RC02. |
| Resumo recolhível | **Corrigido** | Aberto e fechado por clique, Enter e Espaço (Tab chega ao resumo na 11ª parada, anel de 2 px, `details` nativo expõe o estado); fica aberto depois de escolher capital ou trocar medida e o texto se atualiza ("Por habitante · 2025 · São Paulo (SP)", "Aplicado em ASPS (%) · 2025 · São Paulo (SP)"); recarregar e voltar do navegador fecham de novo; a 1023 px está fechado e a 1024 px aberto, sem resumo (`display:none`); ao redimensionar de 390 para 1440 px os controles aparecem sem recarregar; no Comparar, abrir, escolher A e B e ver "São Paulo × Macapá". Caps. RC01, RC08. |
| Fechamento na carga (script) | **Corrigido** | O `<script>` fica logo depois do `details` aberto no HTML e fecha antes da primeira pintura: `open=false` já em `first-paint` a 320, 390 e 768 px, CLS 0,0000 nas 4 páginas e 4 larguras; a 1024 px abre. Sem JavaScript os controles ficam abertos (comportamento seguro). |
| N3, número da nota sobre o rótulo | **Corrigido** | O rótulo "R$ 1.843" passou para baixo do ponto; 0 colisões entre número de nota e rótulo de valor em 9 estados da Evolução (1440 px). Cap. RC03. Resíduo menor: a 320 e 390 px o número da nota ainda cobre parte do texto "mudança de base" (ver T6 item 3). |
| Linha de exclusão no Comparar e foco no bloco do motivo | **Corrigido** | "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." no Comparar (padrão e com 2021: Campo Grande), em Gastos e em Rede; o link leva ao bloco `#fora-da-comparacao`, que recebe o foco (`tabindex=-1`, anel de 2 px, a 96 px do topo). |
| Link "Os três perímetros" | **Corrigido, com resíduo** | Na mesma linha do texto, com 27 px de altura (antes 17 px). No Comparar o link tem 17 px no desktop e 36 px a 390 px. |
| Etiqueta curta do perímetro no celular | **Corrigido, com resíduo** | A 390 px: "Recursos executados pelo município (não é o gasto de União e estado)", "Serviços localizados no território (cadastro, não funcionamento)", "População residente (não é produção da prefeitura)". Resíduo: no Comparar a etiqueta ("Perímetro: Recursos executados pelo município") fica depois do gráfico e sem o limite. |
| Siglas SUS, CNES, IPCA, IBGE | **Corrigido, com resíduo** | SUS no Panorama, Gastos e Rede; CNES no Panorama e Rede; IPCA em Gastos e Comparar; IBGE em Resultados. Falta SUS no bloco do Comparar. A entrada ganhou "Fontes" com Siconfi, SIOPS, CNES, Relatório APS, RIPSA e IPCA sem expansão (T6 item 7). |
| Quadro "O módulo em números" e barra das decisões | **Corrigido, com defeito novo** | Quadro com 20, 3, 8.777 e 21 e barra proporcional de 12, 9 e 10 medidas, com legenda numerada e `role="img"` com `aria-label` ("12 publicar com ressalva, 9 apenas contexto, 10 não publicar"); cada segmento tem 4,9:1 ou mais sobre a página e a informação existe em texto. Defeito: o `dl` do quadro usa `div > p` e o axe aponta `definition-list` (serious); entre segmentos vizinhos o contraste é 1,2:1 e 2,0:1. Cap. RC04. |
| Panorama: links de CSV e de reprodução, motivo da exclusão | **Corrigido** | "Baixar a série completa (CSV)" e "Fonte e como reproduzir" sob cada gráfico (44 px; o primeiro baixa `sau_despesa_por_habitante.csv`, 262 linhas; o segundo leva a `#reproducao`, que recebe o foco); "Fora da comparação: Macapá (AP), conferência pendente: diferença material entre DCA e RREO sem explicação documentada." no cartão. Resíduo: o primeiro gráfico do Panorama segue a 1.120 px (390) e 1.295 px (320); os 7 cartões repetem as mesmas duas ligações. Cap. RC05. |
| Entrada: linha "Fontes" | **Corrigido, com resíduo** | Presente nos dois temas, mas com siglas sem expansão e sem links. Cap. RC07. |
| N9, CSV | **Corrigido** | 24,8 KB; páginas oficiais por extenso; CSV da tabela do Comparar com "Páginas oficiais das fontes", "Data de captura mais recente" e "Versões metodológicas"; CSV da série com "Base do denominador" por ano. |
| N7, P21, P22, P27 (declarados como compartilhados ou não alterados) | **Não alterado** | Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 17 a 27 px; rodapé e 22 links de CSV de 17 px; parâmetros inválidos de capital, medida e visão (e `ano=3000` no Comparar) permanecem na URL. |

### T3. Matriz de notas atualizada

Avaliador: Claude Sonnet 5.5, agente independente de experiência, reavaliação 3. Formato: página | critério | nota nova (Reavaliação 2) | justificativa curta quando mudou | evidência | o que falta para 9,0 ou mais. Mesmas adaptações (entrada: A sem visual principal e H como comunicação visual; Métodos: H como estrutura de tabelas, listas e quadro). Notas com uma casa decimal; o que a evidência sustenta.

| Página | Crit. | Nota (R2) | Justificativa curta | Evidência | O que falta para 9,0 |
|---|---|---|---|---|---|
| Entrada | A | 8.8 (8.8) | Sem mudança; sem visual por natureza. | E01 | Tirar o estilo de página atual do link Panorama. |
| Entrada | B | 8.6 (8.7) | A linha "Fontes" nomeia Siconfi, SIOPS, CNES, RIPSA e IPCA sem expandir; Ideb e Saeb seguem sem expansão. | RC07 | Expandir as siglas. |
| Entrada | C | 8.6 (8.5) | "Fontes" ajuda a saber de onde vêm os números antes de entrar. | RC07 | Atalhos por pergunta; links às fontes. |
| Entrada | D | 8.9 (8.9) | Sem mudança. | E01 | Públicos e compartilhamento. |
| Entrada | H (adapt.) | 8.4 (8.4) | Sem mudança. | E01 | Prévia visual opcional. |
| Entrada | I | 9.0 (9.0) | Sem mudança; 12 links respondem 200. | DOM | Nenhuma. |
| Entrada | J | 9.0 (9.0) | axe 0 violações; 0 px de overflow; 200% e 400% sem perda. | AX, RS | Alvos do rodapé (compartilhado). |
| Panorama | A | 8.6 (8.6) | Links sob o gráfico; no celular o primeiro gráfico segue a 1.120 px (390) e a página a 8.810 px (320). | RC05, RS | Gráfico antes da introdução longa no celular; ticks regulares. |
| Panorama | B | 8.8 (8.8) | Siglas com SUS e CNES; RREO e AIH fora do bloco; "Oficial publicado" como jargão. | DOM | Completar siglas. |
| Panorama | C | 8.7 (8.4) | Série completa em CSV, fonte e reprodução por gráfico, motivo da exclusão no cartão. | RC05 | Grupo por região; ano e moeda no Panorama. |
| Panorama | D | 8.8 (8.8) | Sem mudança. | E02 | Convite a compartilhar. |
| Panorama | H | 8.5 (8.5) | Sem mudança (legenda da faixa; ticks apertados). | RA12 | Opção de ver todos os pontos. |
| Panorama | I | 8.9 (8.8) | Links de CSV e de reprodução levam ao arquivo e à seção com foco. | RC05 | Ano e grupo no Panorama. |
| Panorama | J | 8.9 (8.9) | axe 0; CLS 0,004; texto SVG de 11,5 px. | AX, CT | Texto mínimo de 12 px. |
| Gastos | A | 8.8 (8.6) | Resumo recolhível: título do resultado dentro de 800 px e gráfico a 940 px (390); aviso do período vai depois do gráfico no celular. | RC01 | Gráfico dentro da primeira tela de 800 px; Visão e Ordem também recolhidas. |
| Gastos | B | 9.0 (8.9) | Limite do perímetro acompanha o rótulo no celular, siglas com SUS e IPCA, nota de zero, repetição removida. | RC01, DOM | Nenhuma além de menores (LC fora do bloco). |
| Gastos | C | 9.0 (9.0) | Sem mudança. | CSV | Nenhuma além dos limites declarados. |
| Gastos | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar recortes. |
| Gastos | H | 8.8 (8.7) | Rótulo de valor sem colisão com o número da nota; a 320 e 390 px os nomes das capitais ainda se tocam (5 pares) e o número da nota cobre "mudança de base". | RC03, RC06 | Rótulos curtos no celular; deslocar a nota. |
| Gastos | I | 8.9 (8.8) | Foco no bloco do motivo, resumo operável por teclado e atualizado, estado preservado; o resumo não cita grupo regional, denominador nem ordem; parâmetros inválidos persistem. | RC01, TB | Resumo com todo o recorte; normalizar a URL. |
| Gastos | J | 8.9 (8.9) | axe 0; anel de 2 px; `details` nativo; alvos em linha de 27 px; sem lentes de leitor de tela real. | AX, TB | Texto SVG de 12 px; alvos de 44 px em links em linha. |
| Rede | A | 8.8 (8.6) | Gráfico a 904 px (390) e 1.109 px (320). | RS | Gráfico dentro da primeira tela. |
| Rede | B | 9.0 (8.9) | Perímetro com limite curto, siglas com SUS e CNES, nota de zero. | DOM | Nenhuma além de menores. |
| Rede | C | 9.0 (8.9) | Cobertura com três bases explicadas, zeros esclarecidos, estado vazio com motivo, Brasil como referência da mesma fórmula, CSV e reprodução. | RC06, DOM | Nenhuma além dos limites declarados (sem produção). |
| Rede | D | 8.9 (8.9) | Sem mudança. | DOM | Lacuna de produção no topo. |
| Rede | H | 8.6 (8.6) | Sem mudança; a 390 px o número "2" cobre "mudança de base" na Evolução da cobertura. | RC06 | Deslocar a nota; ver todos os pontos. |
| Rede | I | 8.9 (8.8) | Foco no bloco do motivo; resumo recolhível. | TB | Resumo com todo o recorte. |
| Rede | J | 8.8 (8.8) | axe 0; sem overflow; alvos de 27 px em links em linha. | AX, RS | Texto SVG de 12 px. |
| Resultados | A | 8.8 (8.6) | Gráfico a 945 px (390) e 1.117 px (320). | RS | Gráfico dentro da primeira tela. |
| Resultados | B | 8.9 (8.8) | IBGE e SUS no bloco; limite do perímetro no celular; nome do arquivo bruto ainda na fonte. | DOM | Tirar "mgdi_ms_qu3.csv.zip" do corpo. |
| Resultados | C | 8.9 (8.8) | Sem mudança funcional; resumo recolhível não cita o denominador escolhido. | RC01 | Resumo com o denominador. |
| Resultados | D | 8.9 (8.9) | Sem mudança. | RA14 | Resumo em linguagem simples. |
| Resultados | H | 8.6 (8.6) | Sem mudança. | DOM | Rótulos da mediana; nomes sem toque no celular. |
| Resultados | I | 8.8 (8.7) | Resumo operável; o resumo não mostra "IBGE do exercício". | RC01 | Resumo com o denominador. |
| Resultados | J | 8.8 (8.8) | axe 0; sem overflow. | AX, RS | Alvos de 44 px em links em linha. |
| Comparar | A | 8.9 (8.7) | Gráfico a 730 px (390) e 819 px (320), dentro da primeira tela a 390 px; linha de exclusão acima do gráfico. | RC02 | Perímetro antes do gráfico. |
| Comparar | B | 8.9 (8.8) | Linha de exclusão, siglas com IPCA; SUS fora do bloco; etiqueta do perímetro sem limite e depois do gráfico. | RC02 | SUS no bloco; limite na etiqueta. |
| Comparar | C | 8.9 (8.9) | Sem mudança; no celular os seletores de capital A e B ficam sob o resumo fechado. | RC02 | Abrir o recorte quando não há capital escolhida. |
| Comparar | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar. |
| Comparar | H | 8.5 (8.5) | Sem mudança; nomes se tocam a 320 e 390 px; "mudança de base" encosta em "55,0%" nos pequenos múltiplos. | DOM | Rótulos curtos; eixo comum opcional. |
| Comparar | I | 8.8 (8.7) | Foco no bloco do motivo; linha de exclusão; resumo com "São Paulo × Macapá". | TB | Parâmetros inválidos fora da URL. |
| Comparar | J | 8.8 (8.8) | axe 0; tabela rolável nomeada. | AX, RS | Cartões no celular; alvos de 44 px. |
| Métodos | A | 8.7 (8.3) | Quadro de números e barra no topo dão um visual principal; página ainda tem 8.728 px a 1440 px e 17.581 px a 320 px. | RC04 | Reduzir a repetição das fichas. |
| Métodos | B | 8.6 (8.4) | Guia por perfil com "páginas oficiais" e quadro em linguagem direta; fichas seguem densas. | RC04 | Resumos curtos nas fichas. |
| Métodos | C | 9.0 (9.0) | Sem mudança. | DOM, CSV | Nenhuma além do limite (reprodução total exige repositório). |
| Métodos | D | 8.7 (8.6) | O quadro dá a escala do módulo ao leigo. | RC04 | Versão resumida das fichas. |
| Métodos | H (adapt.) | 8.6 (8.3) | Barra proporcional das 31 decisões com legenda numerada e texto alternativo; contraste entre segmentos vizinhos de 1,2:1 e 2,0:1. | RC04 | Separador ou padrão entre segmentos. |
| Métodos | I | 8.9 (8.9) | Sem mudança; foco vai à seção. | TB | Link direto na seção Reprodução. |
| Métodos | J | 8.5 (8.8) | axe agora acusa `definition-list` (serious) no quadro de números: `dl` com `div > p`. | AX | Trocar por `dl` com `dt` e `dd` ou por lista. |

#### Médias por critério (7 páginas)

| Critério | A | B | C | D | H | I | J |
|---|---|---|---|---|---|---|---|
| Média nova | 8.8 | 8.8 | 8.9 | 8.9 | 8.6 | 8.9 | 8.8 |
| Média anterior (R2) | 8.6 | 8.8 | 8.8 | 8.8 | 8.5 | 8.8 | 8.9 |
| Menor nota nova | 8.6 (Panorama) | 8.6 (Entrada, Métodos) | 8.6 (Entrada) | 8.7 (Métodos) | 8.4 (Entrada) | 8.8 (Resultados, Comparar) | 8.5 (Métodos) |

Sete notas chegam a 9,0: entrada I, entrada J, Gastos B, Gastos C, Rede B, Rede C e Dados e métodos C. Notas de 9,5 ou mais continuam sem a validação adicional que as sustente. Nenhum critério chega a 9,0 em todas as páginas.

### T4. Bloqueios remanescentes

**Nenhum.** Verifiquei de novo: valor incorreto, comparação materialmente incompatível (a Evolução interrompe a linha e a mediana onde a base muda; a variação 2024 para 2025 da cobertura segue bloqueada), despesa do município como gasto total (o texto repete que não é, inclusive na etiqueta curta do celular), razão despesa por atendimento, ausência tratada como zero (a nota de zero eAP nomeia as 6 capitais), exclusão aplicada só ao gráfico, ressalva essencial escondida (no celular o aviso do período e da base populacional passa a vir depois do gráfico, mas o limite do perímetro, a linha de exclusão e as marcas da Evolução ficam acima ou no próprio gráfico; ver T6 item 4), afirmação causal ou de eficiência sem suporte, nota, ranking de gestão, semáforo, Distrito Federal misturado, dado pessoal ou barreira que impeça tarefa essencial. A ordenação por valor segue com a nota de que é recurso de leitura.

### T5. Tarefas por perfil refeitas

Mesmo protocolo: navegador, sem consulta externa, sem tempos nem taxas; abri arquivos baixados do site.

* **T1 (cidadão ou conselheiro, jornalista): confirmada, sucesso.** Entrada, "Gastos", capital: Recife (R$ 1.325, mediana das 25 capitais R$ 1.354) e Macapá; "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." acima do gráfico, com link que leva ao bloco e move o foco. No celular, o mesmo caminho exige abrir "Ajustar o recorte" para escolher a capital (uma ação a mais).
* **T2 (jornalista, gestor): confirmada, sucesso.** "Referências do grupo: 25 de 26", razão agregada R$ 1.544, grupo por região (Sudeste: mediana de 4 capitais R$ 1.667, faixa central não exibida por haver menos de 8).
* **T3 (cidadão ou conselheiro, pesquisador): confirmada, sucesso.** Gastos, "Reais de 2025", 2021, Evolução: a mediana tem dois trechos, com marcas e notas 1 e 2 e a frase de variação; o texto e o gráfico concordam. Obstáculo (baixa): no celular o aviso da base populacional vem depois do gráfico, a cerca de 770 px da linha do título; o leitor vê a distribuição antes de ler que 2021 usa estimativa anterior ao Censo.
* **T4 (jornalista, pesquisador, cidadão): confirmada, sucesso com obstáculo.** Comparar em 390 px: abrir o recorte, escolher São Paulo e Macapá, resumo "São Paulo × Macapá", cartões com a ressalva em dois níveis (MSC igual ao RREO, DCA distinta, menos 1,6%); Campo Grande 2021 idem. Obstáculo: o primeiro nível usa DCA e RREO (o bloco de siglas os traz).
* **T5 (cidadão ou conselheiro, gestor): confirmada, sucesso.** Etiqueta de perímetro com o limite curto no celular em Gastos, Rede e Resultados; no Comparar a etiqueta fica depois do gráfico e sem o limite; Panorama e Dados e métodos claros.
* **T6 (gestor, pesquisador): confirmada, sucesso.** Cobertura potencial de dezembro de 2025 (mediana 83,0%, Brasil 99,1%, três bases explicadas, variação 2024 para 2025 bloqueada) separada de ICSAP 2024; Evolução a 390 px legível, com o número da nota 2 tocando "mudança de base".
* **T7 (jornalista, pesquisador): confirmada, sucesso.** `saude_despesa_hab_2025.csv` com valor formatado e numérico, numerador, denominador, mediana, fonte, páginas oficiais, captura, versão, hash e "Leia antes de usar"; série com "Marca de base" e "Base do denominador"; tabela do Comparar com páginas oficiais, data de captura mais recente e versões por medida.
* **T8 (pesquisador, jornalista): confirmada, sucesso.** Panorama, "Fonte e como reproduzir" (leva a `#reproducao`, com foco), exemplo de São Paulo (ICSAP 2024: 83.391 ÷ 11.895.578, 701,0252), receita do hash, repositório, manifesto e CSV. Não reconstruí o numerador a partir do arquivo bruto.

### T6. Problemas remanescentes e novos

Severidades: bloqueante, alta, média, baixa. "Cap." indica captura em `evidencias/` (códigos RC, RB, RA, E).

1. **Média. Quadro "O módulo em números" falha no axe (definition-list, serious).** Reproduzir: `/eficiencia-estatal/saude-capitais/metodos` com axe-core 4.12.1, regra `definition-list`: o `dl` tem filhos `div > p` em vez de `dt` e `dd`. Pelo leitor de tela os números aparecem como parágrafos soltos ("20", "indicadores publicados...") sem relação de termo e definição; a leitura linear continua compreensível. Cap. RC04. Correção: `dl` com `dt` (número) e `dd` (rótulo) dentro de `div`, ou lista simples; repetir o axe. Impede 9,0 em J de Métodos.
2. **Baixa. Gráfico ainda abaixo da primeira tela de 800 px em Gastos, Rede e Resultados no celular.** A 390 px: 940, 904 e 945 px; a 320 px: 1.131, 1.109 e 1.117 px; Visão, CSV e Ordem das capitais ficam fora do recolhível e ocupam cerca de 300 px antes do título. Caps. RC01, RC02. Correção: incluir Visão e Ordem no recolhível ou compactá-las em uma linha.
3. **Baixa. Colisões de texto nos gráficos a 320 e 390 px.** Número da nota 1 ou 2 sobre "mudança de base" na Evolução (Gastos, Rede, Resultados); "mudança de base" sobre "55,0%" nos pequenos múltiplos do Comparar; 5 pares de nomes de capitais que se tocam em todos os gráficos de distribuição. Cap. RC06. Correção: deslocar a nota, rótulos curtos (sigla da UF) no celular.
4. **Baixa. No celular o aviso do período e da base populacional vem depois do gráfico.** Reproduzir: 390 px, `/gastos?ano=2021` (aviso a cerca de 770 px abaixo do início do gráfico) e cobertura potencial. Correção: uma linha de ponteiro acima do gráfico ("Base populacional diferente em 2021, ver abaixo") como já existe para capitais fora da comparação.
5. **Baixa. Resumo recolhível não cita todo o recorte.** O texto traz medida abreviada, período, moeda quando "reais de 2025" e capital, mas não cita o grupo regional (com capital, mostra só "São Paulo (SP)" quando o grupo é a região), o denominador "IBGE do exercício" nem a ordem; as medidas aparecem como "Total", "Por habitante", "Internações ICSAP" (número). O chevron "▾" não gira ao abrir. Correção: incluir grupo e denominador quando diferentes do padrão e nomes mais completos.
6. **Baixa. Comparar no celular esconde o seletor de capital A e B.** Sem capital escolhida o texto "Escolha a capital A, e se quiser a capital B..." aparece abaixo de um resumo fechado "sem capital A"; a etiqueta do perímetro fica depois do gráfico e sem o limite. Cap. RC02. Correção: abrir o recorte por padrão enquanto não há capital escolhida e trazer o limite do perímetro.
7. **Baixa. Linha "Fontes" da entrada com siglas sem expansão e sem links.** Siconfi, SIOPS, CNES, Relatório APS, RIPSA e IPCA; Ideb e Saeb em Educação. Cap. RC07. Correção: expandir por extenso ou linkar a "Dados e métodos".
8. **Baixa. Contraste entre segmentos vizinhos da barra das decisões.** 1,2:1 (azul petróleo e cinza) e 2,0:1 (cinza e grafite); legenda numerada e `aria-label` mantêm a informação. Correção: separador claro de 2 px entre segmentos.
9. **Baixa. Panorama no celular.** Primeiro gráfico a 1.120 px (390) e 1.295 px (320); página com 8.810 px a 320 px; os 7 cartões repetem "Fonte e como reproduzir" para a mesma âncora. Correção: introdução curta antes do primeiro gráfico; um único link de reprodução.
10. **Baixa. Resíduos declarados ou compartilhados.** Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 17 a 27 px; rodapé e 22 links de CSV de 17 px; SUS fora do bloco de siglas do Comparar; parâmetros inválidos na URL.

### T7. Defeitos novos que procurei neste ciclo

* **Resumo recolhível e script de fechamento:** sem pisca (primeira pintura já fechada), sem deslocamento de layout, estado coerente depois de trocar medida, capital ou voltar; mantém `details` nativo. Itens 5 e 6.
* **Ordem no celular:** Comparar (resumo, resultado, gráfico, definição) e Gastos, Rede e Resultados (resumo, Visão, Ordem, título, gráfico, definição); a ordem não quebra a leitura. Itens 2 e 4.
* **Texto do resumo com a medida abreviada:** claro para quem vê o título logo abaixo, ambíguo isolado. Item 5.
* **Links novos do Panorama:** funcionam (CSV baixado, reprodução com foco, 44 px), repetidos em 7 cartões. Item 9.
* **Barra das decisões e quadro de números:** informação em texto e `aria-label`; defeito de estrutura no axe e contraste entre segmentos. Itens 1 e 8.
* **Textos novos:** sem linguagem avaliativa; sem hífen ou travessão como pontuação em prosa (0 travessões e meias-riscas; o sinal de menos tipográfico aparece só em valores negativos citados); console sem erros em 9 rotas e estados medidos.

### T8. Verificações automáticas e desempenho (laboratório, repetido)

* **axe-core 4.12.1** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`): 28 execuções, 25 com 0 violações e 3 (Dados e métodos a 1440 px, a 1440 px com a seção Reprodução na URL e a 390 px) com 1 violação, a do item 1. **Contraste calculado:** 0 abaixo de AA nas 8 páginas e estados (mínimo 4,92:1). **Overflow e alvos:** 0 px de rolagem horizontal da página em 12 rotas e estados nas 4 larguras; alvos de 27 px nos links em linha novos; controles de formulário, abas, botões e segmentados com 44 px ou mais; resumo com 57 px de altura. **Zoom de 200% e 400% a 1280 px:** sem rolagem horizontal da página em 6 rotas e sem elemento fixo. **Teclado:** 24 paradas de Tab em Gastos em ordem lógica, anel de 2 px em todas, resumo alcançável apenas abaixo de 1024 px. Não rodei leitor de tela real.
* **Desempenho (Chromium 141 sem estrangulamento, localhost, janela de 1440 por 900, contexto novo, 5 execuções, mediana; não representa experiência real):** FCP de 84 a 196 ms, LCP de 84 a 384 ms (Gastos em Tabela e Comparar com par escolhido os mais lentos), CLS de 0,000 a 0,004 (Panorama), DOMContentLoaded de 35 a 236 ms, carga de 98 a 245 ms, 19 a 29 requisições nas páginas do módulo (49 na entrada), 1,1 a 1,8 MB decodificados (4,8 MB na entrada), 0 erros de console. Sem espera perceptível ao trocar seletores nem ao abrir o resumo.

### T9. Limitações da reavaliação 3

* Inspeção heurística de um agente; só Chromium 141; sem leitor de tela real, sem dispositivos físicos, sem usuários reais. O comportamento do `details` e do resumo por teclado foi verificado no Chromium; a leitura pelo leitor de tela se baseia nos atributos e na semântica nativa, sem tecnologia assistiva.
* Não confrontei os dados com as fontes oficiais nem reconstruí o numerador do ICSAP a partir do arquivo bruto; as conferências foram internas ao módulo (CSV baixados, arquivos públicos de `/eficiencia/series`).
* Não repeti todas as combinações de medida, ano, capital e grupo; testei as listadas em T2, T5 e T7. As larguras de 320 e 390 px foram simuladas em janela de navegador, sem tela física nem teclado virtual.
* O contraste do texto sobre a faixa sombreada do gráfico segue não medido ponto a ponto (o axe a declara "incompleta").
* E, F, G e K continuam sem nota nesta avaliação; as observações sobre elas são de leitor. As notas de 9,0 desta rodada exigem, para serem mantidas, que os resíduos listados em T6 não se agravem.

## Reavaliação 4 (final)

* **Data:** 09/10/2026 (UTC), depois do quarto ciclo de correções (HEAD `28f7c5ec9`, gold com `hash_dados` começando em `6a4bac82`). **Avaliador:** o mesmo agente de IA (Claude Sonnet 5.5) na função de avaliador de experiência. A seção 7 do `CORRECOES.md` foi lida só para saber o que verificar; cada ponto foi refeito no navegador. **As notas desta seção são as notas finais do módulo na avaliação de experiência.**
* **Natureza:** inspeção heurística de agente, Playwright 1.56.1 e Chromium 141 sobre o build em `http://localhost:3111`. Sem usuários reais; as tarefas por perfil são papéis simulados, sem tempos nem taxas.
* **Verificações repetidas:** quadro "O módulo em números" e barra das decisões (estrutura, contraste, aria), posição do primeiro gráfico em 320, 390 e 768 px nas cinco páginas de exploração, "Ordem das capitais" dentro de "Ajustar o recorte" (abrir, fechar, teclado, resumo, Evolução, desktop a 1024 e 1440 px), posição do CSV por largura, texto do resumo em 9 estados, rótulo de perímetro e linha de exclusão, linha de ponteiro do aviso do período (link, foco, árvore de acessibilidade), colisões de texto em mais de 40 estados a 320 e 390 px, ordem do Panorama no celular, trilhas por medida (detalhes abertos, foco, sem JavaScript), histórico de revisões (estrutura, teclado, rolagem), linha "Cobertura" e "Fontes" da entrada, novo arquivo de referências nacionais, ordem de Tab contra ordem visual em 390 e 1440 px, axe-core 4.12.1 (28 execuções em 7 rotas e larguras), contraste calculado, overflow, zoom de 200% e 400%, CLS e carga em laboratório, console.
* **Evidências novas (prefixo `reaval4_`, 11 arquivos em `evidencias/`):** RD01 `reaval4_metodos_1440_quadro-e-barra-com-separador.png`; RD02 `reaval4_gastos_1440_controles-abertos-ordem-no-recorte.png`; RD03 `reaval4_gastos_320-390_resumo-e-linha-de-ponteiro.png`; RD04 `reaval4_comparar_320-390_escolher-as-capitais.png`; RD05 `reaval4_gastos_390_aviso-da-base-e-csv-apos-grafico.png`; RD06 `reaval4_metodos_1440_trilha-por-medida-ubs-sao-paulo.png`; RD07 `reaval4_metodos_1440_trilha-sem-javascript.png`; RD08 `reaval4_metodos_1440_historico-de-revisoes.png`; RD09 `reaval4_metodos_390_historico-de-revisoes-rolado.png`; RD10 `reaval4_panorama_390_ordem-no-celular.png`; RD11 `reaval4_entrada_1440_cobertura-e-fontes.png`. Códigos sem imagem como antes (AX axe, CT contraste e colisões, RS responsivo, TB teclado, CSV arquivos baixados, DOM leitura da página).

### U1. Resultado em uma linha

**Nenhum bloqueio, e os defeitos do ciclo anterior foram corrigidos de fato:** o axe fica em 0 violações nas 28 execuções, o gráfico sobe para 801 a 863 px a 390 px (Gastos, Rede, Resultados e Comparar) com Ordem das capitais, resumo completo e linha de ponteiro do aviso, nenhuma colisão de texto foi encontrada em mais de 40 estados, e o Panorama, as trilhas por medida e o histórico de revisões funcionam; o que resta é de gravidade baixa (principalmente ordem de Tab diferente da visual no celular, linhas de ponteiro empilhadas e genéricas, e resíduos compartilhados), 12 das 49 notas chegam a 9,0 ou mais e as médias por critério ficam entre 8,7 e 9,0.

### U2. Estado de cada problema da Reavaliação 3

| Item (R3, seção T6) | Estado | Verificação no navegador e resíduo |
|---|---|---|
| 1. Quadro "O módulo em números" falha no axe (`definition-list`) | **Corrigido** | O quadro agora é uma lista (`ul` com `li`, número e rótulo em dois parágrafos); axe com 0 violações em Dados e métodos a 1440 px, 1440 px com a seção Reprodução na URL e 390 px, e em todas as outras execuções (28 de 28 sem violação). O título "O módulo em números" existe só para leitor de tela (`h2` oculto visualmente); o quadro não tem título visível. Cap. RD01. |
| 2. Gráfico abaixo da primeira tela; Visão, CSV e Ordem fora do recolhível | **Corrigido, com resíduo** | "Ordem das capitais" passou para dentro de "Ajustar o recorte" (no celular; fechado, os controles ficam fora da ordem de Tab e abrem por clique, Enter e Espaço). O CSV vem depois do gráfico em Gastos, Rede e Resultados e antes do gráfico no Comparar (botão duplicado, um escondido por largura). Primeiro gráfico a 390 px: Gastos 837 (R3: 940), Rede 801 (904), Resultados 807 (945), Comparar 863 (730), Panorama 981 (1.120). A 320 px: 988 (1.131), 946 (1.109), 919 (1.117), 971 (819), 1.137 (1.295). A 768 px: 736, 700, 688, 719 e 721, todos dentro da primeira tela de 1.024 px. A ordem escolhida aparece no resumo ("ordem do maior ao menor"); na Evolução a Ordem não existe e o resumo a omite. A partir de 1024 px nada se perdeu: controles abertos, sem resumo, CSV no alto à direita. Resíduos: Gastos, Rede e Resultados ficam 1 a 37 px abaixo de uma tela de 800 px a 390 px; o Comparar passou a ficar 133 px mais baixo do que na R3 porque o rótulo de perímetro com limite e as duas linhas de ponteiro agora vêm antes do gráfico (troca consciente: o contexto subiu e o gráfico desceu); Visão segue fora do recolhível. Caps. RD02, RD03, RD04. |
| 3. Colisões de texto a 320 e 390 px | **Corrigido** | 0 colisões em mais de 40 estados: Evolução de Gastos, Rede e Resultados (o número da nota não cobre "mudança de base"), pequenos múltiplos do Comparar ("mudança de base" já não encosta em "55,0%") e rótulos das distribuições (nomes longos como "Belo Horizonte (MG)" passam a duas linhas e não se tocam, sem sobrepor o rótulo de valor). Teste por retângulos de texto SVG e `elementFromPoint`. Caps. RD03, RD04. |
| 4. Aviso do período e da base populacional depois do gráfico no celular | **Corrigido, com resíduo** | Linha "Este período tem ressalva de base: ver o aviso abaixo do gráfico." acima do gráfico, só abaixo de 768 px; o link vai a `#aviso-do-periodo`, que recebe o foco (anel visível, `tabindex=-1`). Na árvore de acessibilidade o aviso aparece uma vez (a linha de ponteiro é um parágrafo curto, sem duplicar o texto do aviso). Resíduos: o texto é o mesmo em todos os períodos, inclusive 2025, e não diz qual é a ressalva; vem empilhado com "Fora da comparação" e o perímetro (ver U6 itens 1 e 3). Caps. RD03, RD05. |
| 5. Resumo recolhível não cita todo o recorte | **Corrigido, com resíduo** | Texto completo quando o recorte difere do padrão, por exemplo "Despesa por habitante · 2021 · reais de 2025 · São Paulo (SP), comparada à região Sudeste · ordem do maior ao menor", "Taxa de ICSAP por 100 mil habitantes · 2024 · população do IBGE · todas as capitais" e "eSF por 10 mil habitantes · dez. 2025 · Recife (PE) · ordem do maior ao menor"; medidas por extenso. Resíduo: o chevron ▾ continua sem mudar ao abrir (`transform` nenhum, aberto e fechado) e no Comparar a 390 px a seta cai para a segunda linha (ver U6 item 4). Cap. RD03, RD04. |
| 6. Comparar esconde o seletor de capital; perímetro sem limite e depois do gráfico | **Corrigido** | Com nenhuma capital escolhida o resumo se chama "Escolher as capitais" ("Despesa por habitante · 2025 · nenhuma capital escolhida") e, com par escolhido, volta a "Ajustar o recorte" ("São Paulo (SP) × Macapá (AP)"). O rótulo "Perímetro Recursos executados pelo município (não é o gasto de União e estado). Os três perímetros" vem antes do gráfico. O recorte ainda começa fechado: escolher o par exige um toque a mais (U5, T4). Cap. RD04. |
| 7. Entrada: "Fontes" com siglas sem expansão | **Corrigido, com resíduo** | Linha "Cobertura" nova em cada cartão (capitais, períodos e, na Saúde, contagem de indicadores publicados com ressalvas) e "Fontes" com expansão das siglas por `abbr title`; a expansão só aparece ao passar o ponteiro, não no texto visível, não chega a toque nem a teclado, e Ideb e Saeb seguem sem expansão. Novo link "Referências do Brasil e normativas (CSV)" em Dados e métodos, que baixa `saude_referencias_nacionais.csv` (14 linhas). Caps. RD11, RD08. |
| 8. Contraste entre segmentos da barra das decisões | **Corrigido** | Separador branco de 2 px entre os segmentos; legenda numerada e `aria-label` ("12 publicar com ressalva, 9 apenas contexto, 10 não publicar") mantidos. Cap. RD01. |
| 9. Panorama no celular | **Corrigido, com resíduo** | Ordem a 390 px: título, valor da mediana, gráfico, "Baixar a série completa (CSV)", "Fonte e como reproduzir", definição, "Sobre este dado", "Ver a distribuição e as capitais". O primeiro gráfico sobe de 1.120 para 981 px (390) e de 1.295 para 1.137 px (320); a página tem 8.894 px a 320 px (R3: 8.810). "Fonte e como reproduzir" deixou de ser um único destino repetido: cada cartão leva à trilha daquela medida (`#trilha-...` em Dados e métodos), que abre sozinha e recebe o foco, também sem JavaScript no Chromium. Resíduo: o gráfico segue abaixo da primeira tela e a ordem de Tab não acompanha a visual (U6 item 1). Caps. RD06, RD07, RD10. |
| 10. Resíduos compartilhados (texto SVG, links em linha, rodapé, parâmetros inválidos, SUS no bloco do Comparar) | **Não alterado** | Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 27 px; rodapé e links de CSV de 17 px; parâmetros inválidos na URL permanecem; SUS ainda fora do bloco de siglas do Comparar. |

Itens novos do ciclo 4 que verifiquei além da lista: histórico de revisões em Dados e métodos (6 versões, `hash_dados` final `6a4bac82`, igual ao das 260 linhas de `sau_despesa_por_habitante.csv`; tabela com legenda, região rolável nomeada e focável, rolagem por teclado; ver U6 item 8), colunas `quebra_perimetro` nos arquivos `sau_*.csv` (2 linhas com "sim", ambas Campo Grande 2021) e entrada de dicionário que a explica (ver U6 item 9).

### U3. Matriz de notas final

Avaliador: Claude Sonnet 5.5, agente independente de experiência, reavaliação 4 (final). Formato: página | critério | nota final (Reavaliação 3) | justificativa curta | evidência | o que falta para 9,0. Mesmas adaptações (entrada: A sem visual principal e H como comunicação visual; Métodos: H como estrutura de tabelas, listas e quadro). Notas com uma casa decimal; o que a evidência sustenta. Onde a nota já é 9,0 ou mais, "o que falta" cita só resíduos menores.

| Página | Crit. | Nota final (R3) | Justificativa curta | Evidência | O que falta para 9,0 |
|---|---|---|---|---|---|
| Entrada | A | 8.8 (8.8) | Sem mudança; sem visual por natureza; linha "Cobertura" cabe sem alongar o cartão. | RD11 | Tirar o estilo de página atual do link Panorama (como na R3, não revisto neste ciclo). |
| Entrada | B | 8.7 (8.6) | "Cobertura" e "Fontes" ajudam; expansão das siglas só por `abbr title` (não visível em toque ou teclado); Ideb e Saeb sem expansão. | RD11 | Expansão em texto visível; Ideb e Saeb. |
| Entrada | C | 8.8 (8.6) | "Cobertura" diz o que cada tema cobre antes de entrar. | RD11 | Atalhos por pergunta; links às fontes. |
| Entrada | D | 8.9 (8.9) | Sem mudança. | RD11 | Públicos e compartilhamento. |
| Entrada | H (adapt.) | 8.4 (8.4) | Sem mudança. | RD11 | Prévia visual opcional. |
| Entrada | I | 9.0 (9.0) | Sem mudança. | DOM | Nenhuma. |
| Entrada | J | 9.0 (9.0) | axe 0; sem overflow; 200% e 400% sem perda. | AX, RS | Alvos do rodapé (compartilhado). |
| Panorama | A | 8.7 (8.6) | Ordem no celular título, valor, gráfico, links; gráfico a 981 px (390) e 1.137 px (320), antes 1.120 e 1.295; página com 8.894 px a 320 px. | RD10, RS | Gráfico dentro da primeira tela; introdução mais curta no celular. |
| Panorama | B | 8.8 (8.8) | Sem mudança; RREO, AIH e LC usados fora do bloco de siglas. | DOM | Completar siglas. |
| Panorama | C | 8.9 (8.7) | "Fonte e como reproduzir" leva à trilha da medida, aberta e com foco; histórico de revisões e arquivo de referências nacionais em Métodos. | RD06, RD08 | Ano e grupo no Panorama. |
| Panorama | D | 8.8 (8.8) | Sem mudança. | RD10 | Convite a compartilhar. |
| Panorama | H | 8.6 (8.5) | 0 colisões de texto; faixa clara e rótulos legíveis; ticks apertados e texto SVG de 11,5 px permanecem. | RD10, CT | Opção de ver todos os pontos; texto de 12 px. |
| Panorama | I | 8.9 (8.9) | Trilha por medida abre com foco e funciona sem JavaScript; no celular o foco sobe 194 a 272 px entre os links de cada cartão. | RD06, RD07, TB | Ordem de Tab igual à visual; ano e grupo no Panorama. |
| Panorama | J | 8.9 (8.9) | axe 0; sem overflow; mesmo resíduo de ordem de Tab e de texto SVG. | AX, TB | Ordem de Tab; texto mínimo de 12 px. |
| Gastos | A | 8.9 (8.8) | Gráfico a 837 px (390) e 988 px (320) com título, resumo e linhas de contexto acima; Ordem dentro do recolhível. | RD02, RD03 | Gráfico dentro da primeira tela; fundir as duas linhas de ponteiro. |
| Gastos | B | 9.0 (9.0) | Resumo completo, linha de ponteiro explicando onde está o aviso, perímetro com limite, siglas com SUS e IPCA. | RD03, DOM | Nenhuma além de menores (LC fora do bloco; ponteiro genérico). |
| Gastos | C | 9.0 (9.0) | Sem mudança; recorte, série e tabela em CSV; trilha por medida. | CSV, RD06 | Nenhuma além dos limites declarados. |
| Gastos | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar recortes. |
| Gastos | H | 8.9 (8.8) | 0 colisões de texto na Evolução e nas distribuições (R3: 5 pares de nomes e número da nota sobre "mudança de base"); texto SVG de 10 a 11,5 px permanece. | CT, RD03 | Texto SVG de 12 px; opção de ver todos os pontos. |
| Gastos | I | 9.0 (8.9) | Resumo com todo o recorte, Ordem no recolhível e no resumo, link do ponteiro leva ao aviso com foco; resíduos: ordem de Tab do ponteiro e do motivo, parâmetros inválidos na URL. | RD03, RD05, TB | Normalizar a URL; ordem de Tab. |
| Gastos | J | 8.9 (8.9) | axe 0; anel de 2 px; `details` nativo; sem overflow; alvos de 27 px em links em linha; ponteiro e motivo em ordem de Tab invertida. | AX, TB | Texto SVG de 12 px; alvos de 44 px em links em linha; ordem de Tab. |
| Rede | A | 8.9 (8.8) | Gráfico a 801 px (390) e 946 px (320). | RS | Gráfico dentro da primeira tela. |
| Rede | B | 9.0 (9.0) | Sem mudança; resumo "eSF por 10 mil habitantes · dez. 2025 · Recife (PE)"; perímetro com limite curto; siglas com SUS e CNES. | DOM | Nenhuma além de menores. |
| Rede | C | 9.0 (9.0) | Sem mudança funcional; cobertura com três bases explicadas, Brasil como referência da mesma fórmula, CSV e reprodução. | CSV, DOM | Nenhuma além dos limites declarados (sem produção). |
| Rede | D | 8.9 (8.9) | Sem mudança. | DOM | Lacuna de produção no topo. |
| Rede | H | 8.8 (8.6) | 0 colisões (o número da nota deixa de cobrir "mudança de base" na Evolução da cobertura); texto SVG pequeno permanece. | CT | Texto SVG de 12 px; ver todos os pontos. |
| Rede | I | 9.0 (8.9) | Resumo completo, Ordem, link do ponteiro com foco. | TB | Normalizar a URL; ordem de Tab. |
| Rede | J | 8.8 (8.8) | axe 0; sem overflow; alvos de 27 px em links em linha; mesma ordem de Tab invertida do componente de ponteiro (não tracei esta página). | AX, RS | Texto SVG de 12 px; alvos de 44 px; ordem de Tab. |
| Resultados | A | 8.9 (8.8) | Gráfico a 807 px (390) e 919 px (320). | RS | Gráfico dentro da primeira tela. |
| Resultados | B | 8.9 (8.9) | Sem mudança; IBGE e SUS no bloco, limite do perímetro no celular; nome do arquivo bruto `mgdi_ms_qu3.csv.zip` ainda na linha de Fonte. | DOM | Tirar o nome do arquivo do corpo ou explicar o nome do arquivo. |
| Resultados | C | 9.0 (8.9) | O resumo traz a população usada ("população do IBGE") e a trilha por medida e o CSV de referências nacionais sustentam a conferência do ICSAP. | RD06, CSV | Nenhuma além dos limites declarados. |
| Resultados | D | 8.9 (8.9) | Sem mudança. | DOM | Resumo em linguagem simples. |
| Resultados | H | 8.7 (8.6) | 0 colisões nas distribuições; rótulos da mediana e texto SVG pequeno permanecem. | CT | Rótulos da mediana; texto SVG de 12 px. |
| Resultados | I | 8.9 (8.8) | O resumo agora mostra o denominador escolhido; parâmetros inválidos persistem na URL. | TB | Normalizar a URL; ordem de Tab. |
| Resultados | J | 8.8 (8.8) | axe 0; sem overflow; alvos de 27 px. | AX, RS | Alvos de 44 px em links em linha; texto SVG de 12 px. |
| Comparar | A | 8.9 (8.9) | Gráfico a 863 px (390) e 971 px (320), mais baixo que na R3 (730 e 819) porque perímetro e linhas de ponteiro subiram para antes do gráfico; seletor acessível pelo resumo. | RD04 | Gráfico dentro da primeira tela; uma só linha de ponteiro. |
| Comparar | B | 9.0 (8.9) | "Escolher as capitais" explica o resumo fechado; perímetro com limite antes do gráfico; SUS ainda fora do bloco de siglas. | RD04 | SUS no bloco. |
| Comparar | C | 8.9 (8.9) | Sem mudança; no celular o recorte começa fechado, e escolher o par custa um toque. | RD04 | Abrir o recorte enquanto não há par escolhido. |
| Comparar | D | 8.9 (8.9) | Sem mudança. | DOM | Convite a compartilhar. |
| Comparar | H | 8.7 (8.5) | 0 colisões; pequenos múltiplos legíveis a 320 e 390 px; nomes quebram em duas linhas sem se tocar. | CT, RD04 | Eixo comum opcional; texto SVG de 12 px. |
| Comparar | I | 8.9 (8.8) | Resumo "São Paulo (SP) × Macapá (AP)", foco no motivo e no aviso; CSV antes do gráfico (as demais depois); ordem de Tab invertida entre ponteiro e motivo. | TB | Padronizar o CSV; normalizar a URL; ordem de Tab. |
| Comparar | J | 8.8 (8.8) | axe 0; tabela rolável nomeada; sem overflow. | AX, RS | Cartões no celular; alvos de 44 px. |
| Métodos | A | 8.7 (8.7) | Quadro e barra com separador no topo; página cresceu (8.995 px a 1440 e 17.694 px a 320; R3: 8.728 e 17.581) com histórico e trilhas. | RD01, RD08 | Reduzir a repetição das fichas. |
| Métodos | B | 8.7 (8.6) | Histórico em linguagem direta ("Nenhum valor mudou"); fichas seguem densas. | RD08 | Resumos curtos nas fichas. |
| Métodos | C | 9.1 (9.0) | Trilhas por medida (registro de origem, numerador, denominador, valor), histórico de versões com hash, arquivo de referências nacionais, dicionário com `quebra_perimetro`. | RD06, RD08, CSV | Nenhuma além do limite (reprodução total exige o repositório). |
| Métodos | D | 8.8 (8.7) | O histórico mostra que as rodadas de texto não mudaram valores, o que dá ao leitor leigo a medida da estabilidade. | RD08 | Versão resumida das fichas. |
| Métodos | H (adapt.) | 8.8 (8.6) | Barra das decisões com separador de 2 px, legenda e texto alternativo; histórico de revisões como tabela legível a 1440 px; a 390 px a coluna "O que mudou" fica estreita. | RD01, RD09 | Tabela do histórico em cartões no celular. |
| Métodos | I | 9.0 (8.9) | Trilha por medida abre e recebe o foco (também sem JavaScript no Chromium); tabela do histórico rolável por teclado. | RD06, RD07, TB | Link direto na seção Reprodução; cabeçalho de linha na tabela. |
| Métodos | J | 8.9 (8.5) | axe volta a 0 violações; quadro como lista simples; tabela do histórico com legenda e região rolável nomeada, mas sem cabeçalho de linha nem coluna fixa. | AX, RD09 | `th scope="row"`; coluna fixa; ordem de Tab do Panorama não se aplica aqui. |

#### Médias por critério (7 páginas)

| Critério | A | B | C | D | H | I | J |
|---|---|---|---|---|---|---|---|
| Média final | 8.8 | 8.9 | 9.0 (8.96) | 8.9 | 8.7 | 9.0 (8.96) | 8.9 |
| Média anterior (R3) | 8.8 | 8.8 | 8.9 | 8.9 | 8.6 | 8.9 | 8.8 |
| Menor nota final | 8.7 (Panorama, Métodos) | 8.7 (Entrada, Métodos) | 8.8 (Entrada) | 8.8 (Panorama, Métodos) | 8.4 (Entrada) | 8.9 (Panorama, Resultados, Comparar) | 8.8 (Rede, Resultados, Comparar) |

Doze notas chegam a 9,0 ou mais: entrada I e J, Gastos B, C e I, Rede B, C e I, Resultados C, Comparar B e Dados e métodos C (9,1) e I. Nenhuma nota chega a 9,5, e nenhuma teve validação adicional que a sustentasse. Nenhum critério chega a 9,0 em todas as páginas: A, B, D, H e J têm notas abaixo de 9,0 em pelo menos 5 páginas; C e I têm média arredondada de 9,0 por pouco (8,96), com 3 e 4 páginas abaixo de 9,0.

O que falta, agrupado por causa (cada item está detalhado em U6):

* **Primeira tela do celular (A):** o gráfico começa 1 a 181 px abaixo de uma tela de 800 px a 390 px; fundir as duas linhas de ponteiro em uma, encurtar a introdução do Panorama e compactar Visão (U6 itens 2 e 3).
* **Ordem de Tab (I e J):** alinhar a ordem de foco com a ordem visual no celular (U6 item 1) e padronizar a posição do CSV (U6 item 6).
* **Siglas e expansões (B):** SUS no bloco do Comparar, RREO, AIH e LC no Panorama, expansão visível na entrada e nome do arquivo bruto no Resultados (U6 itens 7 e 10).
* **Visualizações (H):** texto SVG de 12 px no mínimo, rótulos da mediana, opção de ver todos os pontos (U6 item 11).
* **Métodos (A, B, D, H):** reduzir a repetição das fichas e adaptar a tabela do histórico ao celular (U6 item 8).
* **Entrada (H, B, C):** prévia visual opcional, expansão das siglas em texto visível e atalhos por pergunta.

### U4. Bloqueios remanescentes

**Nenhum.** Verifiquei de novo cada item da rubrica: valor incorreto (o exemplo de São Paulo, ICSAP 2024, fecha em 83.391 ÷ 11.895.578 = 701,0252, e a UBS por 10 mil de São Paulo em 2025 fecha em 501 ÷ 11.904.961 = 0,4208), comparação materialmente incompatível (a Evolução interrompe a linha e a mediana onde a base muda; Campo Grande 2021 aparece como "Fora da comparação neste recorte" com motivo), despesa do município como gasto total (o texto repete que não é, inclusive na etiqueta curta do celular), razão despesa por atendimento, ausência tratada como zero, exclusão aplicada só ao gráfico, ressalva essencial escondida (no celular o aviso do período vem depois do gráfico, mas agora com uma linha de ponteiro com link acima dele; o limite do perímetro, a linha de exclusão e as marcas da Evolução ficam acima ou no próprio gráfico), afirmação causal ou de eficiência sem suporte, nota, ranking de gestão, semáforo, Distrito Federal misturado, dado pessoal ou barreira que impeça tarefa essencial. A ordenação por valor segue com a nota de que é recurso de leitura.

### U5. Tarefas por perfil refeitas

Mesmo protocolo: navegador, sem consulta externa, sem tempos nem taxas; abri arquivos baixados do site.

* **T1 (cidadão ou conselheiro, jornalista): confirmada, sucesso.** Entrada, Gastos, capital: "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." acima do gráfico, com link que leva ao bloco e move o foco; mediana das 25 capitais R$ 1.354 em 2025. No celular a capital se escolhe dentro de "Ajustar o recorte" (um toque a mais) e o resumo se atualiza.
* **T2 (jornalista, gestor): confirmada, sucesso.** Grupo por região, Sudeste, com razão agregada de R$ 1.759 e a faixa central omitida por haver menos de 8 capitais; o resumo recolhido diz "São Paulo (SP), comparada à região Sudeste".
* **T3 (cidadão ou conselheiro, pesquisador): confirmada, sucesso.** Gastos, "Reais de 2025", 2021: no celular a linha "Este período tem ressalva de base: ver o aviso abaixo do gráfico" aparece antes do gráfico e o link leva ao aviso com foco (a objeção da R3, de que o leitor via a distribuição antes da ressalva, está sanada); "Fora da comparação neste recorte: Campo Grande (MS)" com motivo; a Evolução mostra a mediana em dois trechos.
* **T4 (jornalista, pesquisador, cidadão): confirmada, sucesso com obstáculo.** Comparar a 390 px: "Escolher as capitais", abrir, São Paulo e Macapá, resumo "São Paulo (SP) × Macapá (AP)", cartões com a ressalva em dois níveis. Obstáculo (baixa): um toque a mais para abrir o recorte e jargão DCA e RREO no primeiro nível (o bloco de siglas os traz).
* **T5 (cidadão ou conselheiro, gestor): consistente com a R3.** O rótulo de perímetro com o limite curto vem antes do gráfico em Gastos, Rede, Resultados e agora também no Comparar. Refiz só essa parte e a leitura das páginas; não repeti o percurso completo.
* **T6 (gestor, pesquisador): consistente com a R3.** Cobertura potencial e Evolução a 390 px sem colisão de texto, com a nota de mudança de base e a variação bloqueada. Refeita em parte (a Evolução, a nota e o texto do recorte); não repeti todos os passos.
* **T7 (jornalista, pesquisador): confirmada, sucesso.** CSV do recorte com valor formatado e numérico, fonte, páginas oficiais, captura, versão, hash e "Leia antes de usar"; CSV da série com "Marca de base" e "Base do denominador" (sem coluna de quebra de perímetro, ver U6 item 9); arquivo de referências nacionais (14 linhas) e dicionário que explica `quebra_serie` e `quebra_perimetro`; arquivos `sau_*.csv` com 260 linhas e um único `hash_dados`.
* **T8 (pesquisador, jornalista): confirmada, sucesso.** Panorama, "Fonte e como reproduzir" por medida leva à trilha daquela medida (aberta, com foco; sem JavaScript também abre pelo fragmento no Chromium): São Paulo, ICSAP 2024: 83.391 ÷ 11.895.578 = 701,0252; histórico de revisões com 6 versões e o hash final igual ao do CSV. Não reconstruí o numerador a partir do arquivo bruto.

### U6. Problemas remanescentes e novos

Severidades: bloqueante, alta, média, baixa. "Cap." indica captura em `evidencias/` (códigos RD, AX, CT, RS, TB, CSV, DOM). Nenhum item é média ou mais.

1. **Baixa. Ordem de Tab diferente da ordem visual no celular (Panorama e linhas de ponteiro).** Reproduzir a 390 px (e 320 px), Tab em `/eficiencia-estatal/saude-capitais`: em cada cartão a sequência é "Sobre este dado", "Ver a distribuição e as capitais", "Baixar a série completa (CSV)", "Fonte e como reproduzir"; visualmente o CSV e a Fonte vêm antes de "Sobre" e "Ver", e o foco sobe 194 a 272 px entre o segundo e o terceiro. Em `/gastos` e `/comparar` o link "ver o aviso abaixo do gráfico" recebe o foco antes de "Motivo e detalhe abaixo", que está acima dele na tela (sobe 54 px). De 768 px em diante a ordem acompanha a visual. Rede e Resultados usam o mesmo componente; não tracei Tab nelas. Cap. RD10, RD03, TB. Correção: reordenar o DOM em vez de `order` CSS no celular, ou trocar a ordem das duas linhas.
2. **Baixa. Primeiro gráfico ainda abaixo de uma tela de 800 px; Comparar piorou.** A 390 px: Gastos 837, Rede 801, Resultados 807, Comparar 863, Panorama 981; a 320 px: 988, 946, 919, 971, 1.137. O Comparar está 133 px (390) e 152 px (320) mais baixo que na R3 por causa do perímetro com limite e das duas linhas de ponteiro antes do gráfico. Cap. RD04, RS. Correção: fundir as linhas de ponteiro, compactar Visão e, no Panorama, encurtar a introdução.
3. **Baixa. Linha de ponteiro genérica e empilhada.** "Este período tem ressalva de base" aparece em todos os períodos, inclusive 2025, sem dizer qual é a ressalva, empilhada com "Fora da comparação neste recorte" e com o perímetro: até três linhas de contexto antes do gráfico a 390 px. Cap. RD03, RD05. Correção: texto específico por período ("2021 usa estimativa de população anterior ao Censo 2022, ver abaixo") e uma linha única que reúna exclusão e ressalva.
4. **Baixa. Resumo recolhível: chevron e quebra de linha.** O ▾ não gira ao abrir (`transform` nenhum, aberto e fechado) e, no Comparar a 390 px, a seta cai para a segunda linha do resumo, sozinha à esquerda. Cap. RD04. Correção: girar o ícone com `details[open]` e manter o ícone à direita do texto.
5. **Baixa. "Ordem das capitais" longe do gráfico no desktop e quebrando em duas linhas.** A 1440 px fica no fim da coluna esquerda (abaixo de "Valores"), "Menor ao maior" passa para a segunda linha do controle segmentado e a nota "Ordenar por valor é recurso de leitura, não classificação" fica abaixo da primeira tela de 900 px. Cap. RD02. Correção: juntar Ordem a Visão ou usar um seletor compacto.
6. **Baixa. Posição do CSV inconsistente no celular.** Em Gastos, Rede e Resultados o botão "Baixar CSV do recorte" vem depois do gráfico (a cerca de 1.800 px em Gastos); no Comparar, "Baixar CSV da medida" vem antes do gráfico. Cap. RD05, RD04. Correção: padronizar (depois do gráfico nas quatro, ou antes nas quatro).
7. **Baixa. Linha "Fontes" da entrada com expansão só por `abbr title`.** A expansão (Siconfi, SIOPS, CNES, RIPSA, IPCA) existe só como `title`, invisível em toque e teclado; Ideb e Saeb ficam sem expansão. Cap. RD11. Correção: texto visível entre parênteses ou link a "Dados e métodos".
8. **Baixa. Histórico de revisões: tabela sem cabeçalho de linha e estreita no celular.** A primeira célula da linha (geração) é `td`, não `th scope="row"`; a coluna não fica fixa na rolagem horizontal e, a 390 px, a coluna "O que mudou", que explica cada versão, é a última e fica quase cortada ao rolar. A tabela tem legenda, região rolável nomeada e focável e rola por teclado. Cap. RD08, RD09. Correção: `th scope="row"` na geração, coluna fixa ou cartões empilhados no celular.
9. **Baixa. CSV da série (Evolução) sem a coluna de quebra de perímetro.** Reproduzir em `/gastos?vis=evolucao&cap=campo-grande`, "Baixar CSV da série": as colunas trazem "Na comparação", "Marca de base" e "Base do denominador"; 2021 está "não" e a nota explica o RREO sem intraorçamentárias, mas não há coluna `quebra_perimetro` como nos arquivos `sau_*.csv` (2 linhas com "sim", ambas Campo Grande 2021), e o dicionário manda conferir essa coluna junto com `quebra_serie`. Quem usa só o CSV da série precisa ler a nota. Correção: acrescentar "Quebra de perímetro" ao CSV da série.
10. **Baixa. Siglas e nomes técnicos fora do bloco.** SUS usado e fora do bloco de siglas do Comparar (definição "usuário do SUS"); RREO, AIH e LC no Panorama sem expansão no bloco; `mgdi_ms_qu3.csv.zip` na linha de Fonte do Resultados. Correção: completar os blocos e explicar o nome do arquivo.
11. **Baixa. Resíduos compartilhados e declarados.** Texto SVG de 10 a 11,5 px e `.rotulo` de 10,56 a 11,52 px; links em linha de 27 px; rodapé e links de CSV de 17 px; parâmetros inválidos de capital, medida e visão (e `ano=3000` no Comparar) permanecem na URL; o quadro "O módulo em números" não tem título visível. A abertura automática da trilha por fragmento sem JavaScript foi verificada só no Chromium.

### U7. Defeitos novos que procurei neste ciclo

* **Resumo recolhível e script de fechamento:** sem pisca (primeira pintura já fechada), CLS 0,000 a 0,004, estado coerente depois de trocar medida, capital ou voltar; a Ordem, nova no recolhível, aparece no resumo quando muda e fica fora da Evolução. Itens 4 e 5.
* **Ordem de leitura no celular:** Comparar (resumo, resultado, CSV, definição, perímetro, exclusão, ponteiro, gráfico), Gastos, Rede e Resultados (resumo, Visão, título, definição, exclusão, ponteiro, gráfico, CSV); a leitura linear é compreensível; a ordem de foco difere da visual em três pontos. Itens 1, 3 e 6.
* **Linha de ponteiro:** lida uma vez pela árvore de acessibilidade, link funcional com foco no aviso, mas genérica. Item 3.
* **Colisões de texto:** 0 em mais de 40 estados nas larguras de 320 e 390 px (Evolução, pequenos múltiplos, distribuições). Nenhum defeito novo.
* **Trilhas por medida e histórico:** funcionam com e sem JavaScript no Chromium, com foco e com `details` aberto; defeitos menores na tabela do histórico. Item 8.
* **Arquivos baixados:** CSV do recorte, da série, da tabela e das referências nacionais abrem e têm hash coerente; lacuna da coluna de perímetro no CSV da série. Item 9.
* **Textos novos:** sem linguagem avaliativa; sem hífen ou travessão como pontuação em prosa; console sem erros nas rotas e estados medidos.

### U8. Verificações automáticas e desempenho (laboratório, repetido)

* **axe-core 4.12.1** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`): 28 execuções, 28 com 0 violações (R3: 3 com 1 violação). **Contraste calculado:** 0 abaixo de AA nas 8 páginas e estados. **Overflow:** 0 px de rolagem horizontal da página em 6 rotas a 320 e 1440 px (alturas a 320 px: 8.894, 8.635, 7.304, 9.216, 6.186 e 17.694 px). **Alvos:** controles de formulário, abas, botões e segmentados com 44 px ou mais; resumo com 57 px; links em linha com 27 px. **Zoom de 200% e 400%:** sem rolagem horizontal da página e sem elemento fixo. **Teclado:** Tab em Gastos, Panorama e Comparar a 390 e 1440 px com anel de 2 px em todas as paradas; ordem lógica a 1440 px; resumo alcançável apenas abaixo de 1024 px; fechado, o conteúdo do recolhível não entra na ordem de Tab. Não rodei leitor de tela real.
* **Desempenho (Chromium 141 sem estrangulamento, localhost, contexto novo, mediana de repetições; não representa experiência real):** FCP de 88 a 184 ms, LCP de 88 a 404 ms, CLS próximo de 0, 0 erros de console. Sem espera perceptível ao trocar seletores nem ao abrir o resumo.

### U9. Limitações da reavaliação 4 e da avaliação

* Inspeção heurística de um agente; só Chromium 141; sem leitor de tela real, sem dispositivos físicos, sem usuários reais. A leitura pelo leitor de tela se baseia nos atributos e na semântica nativa, sem tecnologia assistiva; a abertura da trilha por fragmento sem JavaScript foi verificada só em Chromium, não em Safari nem em Firefox.
* Não confrontei os dados com as fontes oficiais nem reconstruí o numerador do ICSAP a partir do arquivo bruto; as conferências foram internas ao módulo (CSV baixados e arquivos públicos de `/eficiencia/series`).
* Não repeti todas as combinações de medida, ano, capital e grupo; testei as listadas em U2, U5 e U6. T5 e T6 foram refeitas só em parte. Não tracei a ordem de Tab em Rede e Resultados; a afirmação de que repetem o defeito é inferência pelo componente comum. As larguras de 320 e 390 px foram simuladas em janela de navegador, sem tela física nem teclado virtual.
* O contraste do texto sobre a faixa sombreada do gráfico segue não medido ponto a ponto (o axe a declara "incompleta").
* E, F, G e K continuam sem nota nesta avaliação; as observações sobre elas são de leitor. As notas desta seção são as finais do módulo na avaliação de experiência, sem negociação; não houve validação adicional que sustentasse nota de 9,5 ou mais.
