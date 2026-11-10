# Auditoria de layout dos painéis com conta (10/11/2026)

**Natureza desta auditoria.** É autoavaliação de máquina sobre capturas de tela, não revisão independente. Leitor de tela, teclado, zoom de 200% e toque não foram testados. As notas de "Interação e acessibilidade" ficam como "não verificado", com o resultado do axe ao lado.

**Base das capturas:** `/tmp/claude-0/-home-user-scrutiniums/9e7155bb-c719-55f4-b7ea-2732bc2ce43f/scratchpad/layout/`. Os caminhos de captura abaixo (`l01/...` a `l10/...`) são relativos a essa pasta. Cada lote tem `evidencias.json` e `evidencias.md`. Planilha por rota: `/tmp/claude-0/-home-user-scrutiniums/9e7155bb-c719-55f4-b7ea-2732bc2ce43f/scratchpad/auditoria-layout.csv`.

**Como foi feito.** `npm run evidencias` sobre o build existente, com sessão de teste, a 390 e 1440 px, em 10 lotes. Régua: seção 10 da skill observatorio-layout e anexos; as skills impeccable, emil-design-eng e design-taste-frontend serviram de lente complementar (a de movimento não se aplica a captura parada).

**Posições:** "y≈" é a distância em px do topo da captura de página inteira.

---

## 1. Resumo executivo

**Estado.** A plataforma tem uma base sólida e três níveis de acabamento que convivem.

- **Nível alto:** Setor Elétrico, Fogo e desastres, Contas Estaduais, Gás e combustíveis e as fichas de município da Educação. Pergunta no título, número com fonte e período, figura com tabela equivalente, ressalva ao lado do dado e diagrama do mecanismo.
- **Nível médio:** Eficiência Estatal, Agronegócio, Saneamento, Contas Federais e os nove painéis novos das Famílias. Corretos e legíveis, com defeitos de gráfico e de densidade.
- **Nível baixo:** a aplicação antiga do Crédito, com 36 rotas em quatro coleções. É outra linguagem visual: cartão com borda em todo bloco, metadado miúdo em volta de gráficos pequenos e páginas de até 27 mil px no celular.

**As medidas automáticas estão boas.** Em 226 rotas e 452 capturas:

- nenhuma passa do teto de cromo;
- nenhuma requisição cai no login e nenhuma responde fora de HTTP 200;
- 5 rotas têm violação axe, 1 tem erro de console e 1 tem rolagem horizontal da página.

Os defeitos que restam são de desenho, não de infraestrutura.

**Três reprovações pelas condições da seção 10** (detalhe na seção 3):

1. **Sobreposição:** rótulos dos marcos no gráfico de linhas de `/divida-das-familias/consignado`, a 1440 e a 390. O mesmo amontoado aparece em `/divida-das-familias/apostas`.
2. **Valor ilegível:** tabela "Dentro de Saúde" de `/contas-publicas/por-area` a 390, com cabeçalhos e números quebrados em pedaços.
3. **Valor ilegível no elemento principal:** mapa do Ideb em `/educacao-municipal/mapa`, com 20 classes de cinza que se leem como uma mancha uniforme. Esta é inferência minha sobre a captura; o número continua disponível na tabela ao lado e no clique.

**Os cinco problemas sistêmicos mais graves**

1. **Dois produtos visuais e pelo menos seis esqueletos de painel.**
   - A aplicação do Crédito cobre Crédito, Pagamentos, Empresas e risco e Dívida dos governos.
   - Fora dela, convivem `PaginaPainel`, `CabecalhoModulo` (Setor Elétrico), `Abertura` (Saneamento), `AberturaGas`, o molde de capítulo do Agro e os moldes por tema da Eficiência Estatal.
   - O leitor que troca de coleção troca de cor de botão, de cor de aviso e de forma de cartão.
   - Três portas de coleção ficam fora do molde `EntradaColecao`: `/observatorio`, `/eficiencia-estatal/judiciario` e `/eficiencia-estatal/saude-capitais`.
2. **A gramática dos gráficos não tem regra de cor nem de eixo para série única.**
   - A mesma barra simples sai em preto (`--serie-1`), teal (`--cor-energia`), marrom (Agro), azul-marinho (Gás) ou roxo (ficha de distribuidora).
   - Linhas com eixo preso em zero achatam a série (emprego formal, renda do trabalho).
   - Marcos anotados se sobrepõem; o mapa do Ideb usa 20 cinzas; a aplicação do Crédito pinta 12 bancos com 12 cores.
3. **Com conta, várias portas abrem recolhidas.** `/custo-de-vida`, `/conectividade` e `/educacao-municipal` mostram um campo de consulta e uma pilha de seções fechadas, quase a mesma primeira tela do aperitivo. Em `/saneamento`, `/agronegocio`, `/contas-publicas` e `/setor-eletrico` o modelo didático vem atrás de um botão "Abrir o modelo". A regra do projeto é o contrário: com conta, profundidade e beleza muito maiores.
4. **Comprimento e tabelas expostas.**
   - A mediana da página é 6.059 px a 1440 e 10.143 px a 390; 48 capturas a 390 passam de 15.000 px e 21 passam de 20.000.
   - Tabelas de 25 a 223 linhas ficam abertas no fluxo (`/credito-imobiliario`, `/saneamento/internacional`, `/emprego-formal`).
   - No celular, tabelas largas viram células de 250 a 300 px de altura (`/saneamento/metodologia`, `/saneamento/tarifa-social`, `/observatorio/institutions`).
5. **"Modelo didático" que é texto em cartões, e cerca de 60 rotas sem elemento visual com função.**
   - Em 4 das 6 entradas de observatório o artefato é uma grade de cartões de texto. Em `/conectividade` são três colunas de texto.
   - Páginas de método, dados, glossário, verbete e conjunto de dados não têm figura. Só os verbetes e os conjuntos do Setor Elétrico somam 175 páginas herdadas de dois moldes.
   - A faixa de gravura posta hoje no "Para ir além" é declarada decorativa no próprio código. Ela não resolve a falta de figura que ensina.

**Dois achados de regra, fora das condições de reprovação, mas graves**

- **Escore anunciado sem existir.** O bloco "Como avaliar este serviço?" fecha as páginas de tema da Eficiência Estatal com uma tabela em que todo capítulo é "Pendente, Pendente, Pendente, Não calculável". O texto está fixo em `src/components/eficiencia/EscoresServicos.tsx:16`. A regra da casa é não anunciar o que não existe.
- **Painel sem a barra comum.** `/eficiencia-estatal/laboratorio-cesta` não tem barra, rodapé nem "Para ir além". É HTML próprio servido por `route.ts`.

**O que resolver primeiro**

1. As três reprovações. O conserto dos marcos é no componente `GraficoLinhas` e vale para todas as páginas que o usam.
2. O bloco de escores pendentes e o laboratório sem barra.
3. Uma regra escrita de cor e eixo para série única, aplicada às páginas novas das Famílias e à Eficiência Estatal.
4. Abrir a figura principal nas sete portas que hoje a recolhem.
5. Decidir o destino da aplicação do Crédito: migrar para `PaginaPainel`, como já foi feito com nove painéis das Famílias, ou aplicar nela os tokens e o orçamento de comprimento.

---

## 2. Medidas agregadas

Fonte: `evidencias.json` de cada lote, somados em `layout/medidas.json`.

| Medida | Resultado |
|---|---|
| Rotas capturadas | 226: os 172 painéis de `paineis()`, 6 entradas de observatório, `/app/observatorios`, `/app/minha-cidade` e 46 amostras de subpáginas e rotas dinâmicas |
| Capturas | 452 (390 e 1440 px, com sessão); nenhuma falhou |
| HTTP diferente de 200 | 0 |
| Requisições que caíram no login | 0 |
| Cromo acima do teto (230 a 1440, 200 a 390) | 0. Máximo medido: 228 a 1440 (129 rotas) e 195 a 390 |
| Sem barra comum | 1 rota: `/eficiencia-estatal/laboratorio-cesta` |
| Violação axe (WCAG 2.1 A e AA) | 5 rotas, 8 capturas |
| Erro de console | 1 rota: `/eficiencia-estatal/laboratorio-cesta` a 390 (recurso 404) |
| Rolagem horizontal da página | 1 rota: `/observatorio/alerts` a 390 |
| H1 fora da primeira tela | 1 rota: `/observatorio/methodology` a 390 (H1 a 1.035 px) |
| Altura da página | mediana 6.059 px a 1440 e 10.143 px a 390; máximo 19.376 e 30.328 |
| Capturas a 390 acima de 15.000 px / 20.000 px | 48 / 21 |

**Violações axe por rota**

| Rota | Largura | Regra |
|---|---|---|
| `/eficiencia-estatal/laboratorio-cesta` | 390 | scrollable-region-focusable, 1 nó (`.tablewrap`) |
| `/territorio/emissoes` | 390 | scrollable-region-focusable, 1 nó (tabela com rolagem) |
| `/setor-eletrico/territorio` | 390 e 1440 | color-contrast, 1 nó (`.rotulo.text-mineral` sobre `bg-energia-fundo`) |
| `/setor-eletrico/territorio/atlas` | 390 e 1440 | definition-list, 1 nó |
| `/setor-eletrico/mercado/comercializacao` | 390 e 1440 | definition-list, 1 nó |

**Portas acima do orçamento de comprimento** (6.500 px a 1440 e 11.000 a 390). O teste do repositório cobre as entradas em `EntradaColecao`; as portas abaixo são painéis usados como porta, então a leitura de que o orçamento vale para elas é minha.

| Porta | Coleção | 1440 | 390 |
|---|---|---:|---:|
| `/observatorio/pix` | Pagamentos | 14.497 | 27.213 |
| `/observatorio/subnational-credit` | Dívida e crédito dos governos | 12.191 | 21.305 |
| `/territorio/queimadas` | Fogo e desastres | 10.455 | 14.830 |
| `/eficiencia-estatal/saude-capitais` | Saúde | 8.821 | 14.695 |
| `/observatorio` (abre `/observatorio/map`) | Crédito | 8.531 | 16.677 |
| `/eficiencia-estatal/judiciario` | Justiça | 8.104 | 14.873 |
| `/agronegocio/ambiente` | Desmatamento e emissões | 8.028 | 10.492 |
| `/observatorio/sectors` | Empresas e risco | 7.282 | 10.559 |

As seis entradas de observatório e as portas em `EntradaColecao` ficam dentro do orçamento. `/observatorios/familias` está no limite a 390, com 10.965 px.

---

## 3. Reprovações pelas condições da seção 10

| # | Condição | Rota e largura | Captura e posição | O que se vê | Correção no sistema existente |
|---|---|---|---|---|---|
| R1 | Sobreposição | `/divida-das-familias/consignado`, 1440 e 390 | `l01/divida_das_familias_consignado-1440-com-sessao.jpg` y≈1.210–1.260; `...-390-...` y≈2.000–2.150 | Seis marcos entre 2020 e 2026 têm os rótulos impressos uns sobre os outros ("Margem temporária de 40%", "Nova elevação temporária", "Lei nº 15.179/2025", "Margem chega a 45%"). A 390 eles também cobrem as linhas. | No `GraficoLinhas` (prop `marcos`): quando os rótulos não cabem, trocar o texto por número de referência sobre o traço e listar os marcos numerados abaixo do gráfico, como a aplicação do Crédito já faz ("1. jun/2020: quebra de regime"). A 390, sempre numerar. |
| R1b | Sobreposição (mesmo componente) | `/divida-das-familias/apostas`, 1440 | `l01/divida_das_familias_apostas-1440-com-sessao.jpg` y≈3.320 | Rótulos de marcos amontoados no topo do gráfico "Como andam os indicadores de crédito das famílias?". Visto só em miniatura. | O mesmo conserto. |
| R2 | Valor ilegível | `/contas-publicas/por-area`, 390 | `l03/contas_publicas_por_area-390-com-sessao.jpg` y≈10.900–12.300 | Na tabela "Dentro de Saúde", os cabeçalhos quebram em sílabas ("Aut oriz ado", "Em pen had o") e os números em duas linhas ("103, 4"). | `TabelaDados` com rolagem só na tabela e a dica já usada no Agro ("Role a tabela para ver todas as colunas"); `white-space: nowrap` e algarismos tabulares nas colunas numéricas; primeira coluna fixa. |
| R3 | Valor ilegível no elemento principal (inferência) | `/educacao-municipal/mapa`, 1440 e 390 | `l02/educacao_municipal_mapa-1440-com-sessao.jpg` y≈950–1.650 | Coroplético com 20 classes de cinza (`--edm-mapa-1` a `-20`). Quase todos os municípios caem em seis classes vizinhas, e o mapa se lê como cinza uniforme. A 390 a legenda ocupa cerca de 300 px antes do mapa. | Reduzir para 5 a 7 classes na rampa sequencial que os outros mapas usam (`MapaCoropletico` em `/saneamento/acesso` e `/gas-natural/gas-de-cozinha`), com quebras por quantis declaradas. As 20 faixas de meio ponto ficam na tabela. |

**Não reprovado, mas no limite das regras**

- **Escore pendente** (`EscoresServicos`): ver defeito D4.
- **Laboratório sem barra comum:** ver defeito D5.
- **Gravura provisória:** não encontrei. As gravuras vistas trazem a legenda "Ilustração conceitual gerada por IA".
- **Logo sem vínculo provado:** não verificado. A grade de 12 logos de `/setor-eletrico/empresas` foi vista só em miniatura.

---

## 4. Tabela por coleção (24)

**Critérios:** DA direção de arte · HI hierarquia · TI tipografia e acabamento · DE densidade e profundidade · DI didática visual · CO comparabilidade · IA interação e acessibilidade · RE responsividade.

- As notas valem só para as páginas olhadas.
- "n.v." é não verificado.
- IA é n.v. em todas as coleções, porque teclado, leitor de tela e toque não foram testados. A coluna traz só o resultado do axe.
- RE tem nota só onde abri capturas a 390.

### Observatório das Famílias

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Renda e trabalho | 5 | `PaginaPainel` e molde de tema da Eficiência Estatal | 7 | 8 | 8 | 7 | 6 | 7 | n.v. (axe 0) | n.v. |
| Dívida e crédito das famílias | 5 de 8 | `EntradaColecao` e `PaginaPainel` | 7 | 7 | 6 | 6 | 8 | 8 | n.v. (axe 0) | 6 |
| Proteção social | 4 | molde de tema da Eficiência Estatal | 7 | 8 | 8 | 7 | 6 | 7 | n.v. (axe 0) | n.v. |
| Moradia | 3 | `PaginaPainel` e molde de tema | 7 | 7 | 8 | 6 | 7 | 7 | n.v. (axe 0) | n.v. |
| Custo de vida | 4 | `EntradaColecao` usada como painel, `PaginaPainel` | 8 | 7 | 8 | 7 | 7 | 8 | n.v. (axe 0) | 8 |

- **Renda e trabalho.** Reprovações: nenhuma. Defeito mais visível: linha "Como evoluiu?" achatada pelo eixo em zero, `l01/eficiencia_estatal_trabalho_renda_emprego_formal-1440-com-sessao.jpg` y≈1.400.
- **Dívida e crédito das famílias.** Reprovações: R1 e R1b. Defeito mais visível: os marcos sobrepostos de R1.
- **Proteção social.** Reprovações: nenhuma. Defeito mais visível: a porta `/eficiencia-estatal/seguranca-alimentar` não tem gráfico e termina no bloco de escores "Pendente", `l01/eficiencia_estatal_seguranca_alimentar-1440-com-sessao.jpg` y≈1.700.
- **Moradia.** Reprovações: nenhuma. Defeito mais visível: tabela de cerca de 40 bancos e duas de 25 municípios abertas no fluxo, `l01/credito_imobiliario-1440-com-sessao.jpg` y≈6.300–12.500.
- **Custo de vida.** Reprovações: nenhuma. Defeito mais visível: com conta, a porta abre com grupos, áreas e modelo didático recolhidos, `l01/custo_de_vida-1440-com-sessao.jpg` y≈950–2.300.

### Observatório dos Serviços Públicos

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Educação e cultura | 8 | `EntradaColecao` usada como painel, molde da educação, `PaginaPainel` | 7 | 8 | 8 | 8 | 7 | 6 | n.v. (axe 0) | 7 |
| Saúde | 3 | molde de tema (saúde) | 7 | 7 | 8 | 6 | 6 | 7 | n.v. (axe 0) | 8 |
| Segurança pública | 3 | molde de tema | 8 | 8 | 8 | 8 | 8 | 8 | n.v. (axe 0) | n.v. |
| Justiça | 4 | molde próprio do Judiciário | 7 | 8 | 8 | 8 | 8 | 8 | n.v. (axe 0) | 8 |
| Síntese das capitais | 3 | `EntradaColecao`, `PaginaPainel`, HTML próprio | 7 | 8 | 8 | 8 | 8 | 8 | n.v. (axe 1 rota) | 8 |

- **Educação e cultura.** Reprovações: R3. Defeito mais visível: o mapa do Ideb em 20 cinzas. A ficha `/educacao-municipal/municipio/2611606` é das melhores páginas vistas.
- **Saúde.** Reprovações: nenhuma. Defeito mais visível: oito figuras seguidas com só três barras pretas cada (menor, mediana, maior), `l02/eficiencia_estatal_saude_capitais-1440-com-sessao.jpg` y≈1.300–6.200.
- **Segurança pública.** Reprovações: nenhuma. Defeito mais visível: o modelo didático "Uma morte, dois registros" é duas colunas de texto, `l02/eficiencia_estatal_seguranca_publica-1440-com-sessao.jpg` y≈1.300–1.900.
- **Justiça.** Reprovações: nenhuma. Defeito mais visível: H1 com a palavra "demora" em teal, contra a decisão do dono de 22/10 (destaque colorido só no H1 da home), `l02/eficiencia_estatal_judiciario-1440-com-sessao.jpg` y≈430. A porta também está fora do molde de entrada.
- **Síntese das capitais.** Reprovações: nenhuma. Defeito mais visível: `/eficiencia-estatal/laboratorio-cesta` sem barra comum e sem rodapé, `l02/eficiencia_estatal_laboratorio_cesta-1440-com-sessao.jpg` y≈0–120.

### Observatório das Contas Públicas

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Contas Federais | 14 | `EntradaColecao`, molde de capítulo das Contas, `PaginaPainel` | 8 | 8 | 7 | 8 | 8 | 8 | n.v. (axe 0) | 6 |
| Contas Estaduais | 1 | `EntradaColecao` | 9 | 8 | 8 | 8 | 9 | 8 | n.v. (axe 0) | 8 |
| Dívida e crédito dos governos | 2 | aplicação do Crédito | 6 | 6 | 6 | 5 | 7 | 8 | n.v. (axe 0) | 6 |

- **Contas Federais.** Reprovações: R2. Defeito mais visível: a tabela quebrada de R2. Segundo: no "Para você" da entrada, o primeiro cartão não tem gravura e os outros dois têm, o que deixa um vazio de cerca de 170 px, `l03/contas_publicas-1440-com-sessao.jpg` y≈1.100–1.300.
- **Contas Estaduais.** Reprovações: nenhuma. Defeito mais visível: a 390, as sete últimas bandeiras (RO a TO) faltam na captura, `l03/contas_publicas_estaduais-390-com-sessao.jpg` y≈1.550–1.800. É provável artefato do carregamento preguiçoso; não verificado.
- **Dívida e crédito dos governos.** Reprovações: nenhuma. Defeito mais visível: parágrafo-síntese em serifa com linha de cerca de 150 caracteres, `l03/observatorio_subnational_credit-1440-com-sessao.jpg` y≈760–1.000. A porta tem 21.305 px a 390.

### Observatório de Energia e Infraestrutura

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Setor Elétrico | 21 de 39 | `EntradaColecao` com gravuras, `CabecalhoModulo` | 9 | 8 | 8 | 7 | 9 | 9 | n.v. (axe 3 rotas) | 8 |
| Gás e combustíveis | 11 de 14 | `EntradaColecao`, `AberturaGas` | 8 | 8 | 8 | 8 | 8 | 8 | n.v. (axe 0) | 8 |
| Saneamento | 15 de 29 | `EntradaColecao`, `Abertura` do Saneamento | 7 | 8 | 7 | 7 | 8 | 8 | n.v. (axe 0) | 6 |
| Mobilidade e conectividade | 3 | `EntradaColecao` usada como painel, molde de tema | 8 | 6 | 8 | 6 | 6 | 8 | n.v. (axe 0) | 8 |

- **Setor Elétrico.** Reprovações: nenhuma. Defeito mais visível: o índice `/setor-eletrico/aprenda` é uma lista de 54 verbetes em 6.826 px sem figura, `l07/setor_eletrico_aprenda-1440-com-sessao.jpg`. Segundo: a ficha `/setor-eletrico/empresas/ambar-amazonas` usa barras e linhas em roxo, cor que o resto da coleção não usa, `l09/setor_eletrico_empresas_ambar_amazonas-1440-com-sessao.jpg` y≈1.600–5.300.
- **Gás e combustíveis.** Reprovações: nenhuma. Defeito mais visível: `/gas-natural/dados` tem 11.416 px de tabelas e `/gas-natural/regulacao` é texto com lista de marcos, `l09/gas_natural_dados-1440-com-sessao.jpg`.
- **Saneamento.** Reprovações: nenhuma. Defeito mais visível: a "Matriz de viabilidade" de `/saneamento/metodologia`, com mais de dez colunas e células de cerca de 250 px, `l08/saneamento_metodologia-1440-com-sessao.jpg` y≈2.500–9.000. A 390 sobram três colunas visíveis.
- **Mobilidade e conectividade.** Reprovações: nenhuma. Defeito mais visível: `/conectividade` abre, com conta, com o retrato do país recolhido e um modelo didático de três colunas de texto, `l09/conectividade-1440-com-sessao.jpg` y≈700–3.600.

### Observatório da Economia

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Crédito e sistema financeiro | 21 de 33 | aplicação do Crédito; 3 páginas em `PaginaPainel` | 6 | 6 | 6 | 5 | 7 | 8 | n.v. (axe 0; 1 rolagem horizontal) | 6 |
| Pagamentos | 2 | aplicação do Crédito | 6 | 6 | 6 | 5 | 7 | 7 | n.v. (axe 0) | 7 |
| Empresas e risco | 2 | aplicação do Crédito | 6 | 6 | 6 | 6 | 7 | 7 | n.v. (axe 0) | n.v. |
| Agronegócio | 17 de 22 | `EntradaColecao`, `PaginaPainel`, molde de capítulo do Agro | 7 | 8 | 8 | 7 | 7 | 8 | n.v. (axe 0) | 8 |

- **Crédito e sistema financeiro.** Reprovações: nenhuma. Defeito mais visível: gráficos de cerca de 110 px de altura cercados por oito linhas de selos, legendas e fonte dentro de cartões com borda, `l04/observatorio_credit-1440-com-sessao.jpg` y≈850–2.200. A entrada tem 8.531 px e está fora do molde.
- **Pagamentos.** Reprovações: nenhuma. Defeito mais visível: a porta `/observatorio/pix` tem 14.497 px a 1440 e 27.213 a 390, `l05/observatorio_pix-390-com-sessao.jpg`.
- **Empresas e risco.** Reprovações: nenhuma. Defeito mais visível: a mesma moldura densa da aplicação; em `/observatorio/recoveries` há dois gráficos pequenos lado a lado com oito selos, `l04/observatorio_recoveries-1440-com-sessao.jpg` y≈1.300–2.100.
- **Agronegócio.** Reprovações: nenhuma. Defeito mais visível: capítulos que são uma pilha de dez acordeões fechados sem gráfico à vista, `l06/agronegocio_custos_renda-1440-com-sessao.jpg` y≈1.500–3.300. Segundo: série anual desenhada em barras horizontais, três gráficos seguidos em `/agronegocio/insumos`.

### Observatório do Território e Clima

| Coleção | Páginas olhadas | Molde predominante | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|---|---|
| Desmatamento e emissões | 3 | `PaginaPainel`, molde do Agro | 8 | 8 | 8 | 8 | 8 | 8 | n.v. (axe 1 rota) | 8 |
| Cidades e clima | 3 | molde de tema da Eficiência Estatal | 8 | 8 | 8 | 7 | 7 | 8 | n.v. (axe 0) | 8 |
| Fogo e desastres | 4 | `PaginaPainel` do Território | 9 | 8 | 8 | 8 | 9 | 8 | n.v. (axe 0) | 8 |

- **Desmatamento e emissões.** Reprovações: nenhuma. Defeito mais visível: eixo com três marcas em valores não redondos (29.059, 14.530, 0), `l02/agronegocio_ambiente-1440-com-sessao.jpg` y≈1.250–1.650.
- **Cidades e clima.** Reprovações: nenhuma. Defeito mais visível: páginas curtas com um só gráfico de cinco barras, `l02/eficiencia_estatal_meio_ambiente_clima-1440-com-sessao.jpg`.
- **Fogo e desastres.** Reprovações: nenhuma. Defeito mais visível: a ficha `/territorio/queimadas/municipio/1302603` tem três números e uma tabela, sem gráfico, `l02/territorio_queimadas_municipio_1302603-1440-com-sessao.jpg`.

### Entradas e área da conta (fora das 24)

| Página | DA | HI | TI | DE | DI | CO | IA | RE |
|---|---|---|---|---|---|---|---|---|
| 6 entradas de observatório (`/observatorios/*`, `/territorio`) | 8 | 8 | 7 | 8 | 7 | 8 | n.v. (axe 0) | n.v. |
| `/app/observatorios` | 8 | 8 | 8 | 8 | n.v. | n.v. | n.v. (axe 0) | n.v. |
| `/app/minha-cidade?ibge=2611606` | 8 | 8 | 8 | 7 | 6 | 7 | n.v. (axe 0) | n.v. |

- As seis entradas têm o mesmo molde, quatro números, gravura panorâmica com legenda e método recolhido. Ficam entre 5.416 e 6.288 px.
- Defeito mais visível nas entradas: na fatia "As coleções", o título fica à esquerda e as caixas de links à direita têm alturas desiguais. Em Famílias sobra uma área vazia grande, `l01/observatorios_familias-1440-com-sessao.jpg` y≈1.900–2.850.

---

## 5. Lista de defeitos concretos

Gravidade: **reprova** (condição da seção 10), **corrigir** (regra do projeto descumprida ou leitura prejudicada), **melhoria**.

### Reprova

- **D1.** Marcos sobrepostos: ver R1 e R1b.
- **D2.** Tabela quebrada a 390: ver R2.
- **D3.** Mapa do Ideb em 20 cinzas: ver R3.

### Corrigir

| # | Rota, largura | Captura e posição | O que se vê | Correção sugerida |
|---|---|---|---|---|
| D4 | Páginas de tema da Eficiência Estatal (vistas: trabalho-renda, emprego-formal, renda-do-trabalho, métodos, segurança alimentar, assistência social, saúde), 1440 | `l01/eficiencia_estatal_trabalho_renda-1440-com-sessao.jpg` y≈2.850–3.300 | Bloco "Como avaliar este serviço?" com tabela "Pendente, Pendente, Pendente, Não calculável" para todo capítulo | Tirar o bloco das páginas até existir escore. Se a proposta precisa ficar pública, levar para a página de método com `SeloProntidao` "em preparação", sem link e sem tabela de pendências. |
| D5 | `/eficiencia-estatal/laboratorio-cesta`, 390 e 1440 | `l02/eficiencia_estatal_laboratorio_cesta-1440-com-sessao.jpg` y≈0–120 | Cabeçalho próprio "SCRUTINIUMS / OBEE · LABORATÓRIO V3", sem barra comum, sem rodapé, sem "Para ir além"; a 390, axe e recurso 404 | Montar a página com `CabecalhoPlataforma` e `NavegacaoColecao` da Síntese das capitais, como as demais. A tabela com rolagem ganha `tabindex="0"` e nome acessível. |
| D6 | `/emprego-formal`, `/divida-das-familias/apostas`, `/divida-das-familias/golpes-e-fraudes`, `/eficiencia-estatal/habitacao`, `/eficiencia-estatal/assistencia-social`, `/eficiencia-estatal/saude-capitais`, `/eficiencia-estatal/trabalho-renda/renda-do-trabalho`, 1440 | `l10/eficiencia_estatal_trabalho_renda_renda_do_trabalho-1440-com-sessao.jpg` y≈2.250–3.300 | Barras de série única em preto (`--serie-1`), enquanto consignado, Território e Setor Elétrico usam teal | Regra única no kit: série única usa o acento do observatório (`--cor-<acento>`), a referência usa `--serie-referencia`, e `--serie-1` a `-6` ficam para comparação entre várias séries. Registrar em `DESIGN_SYSTEM_OBSERVATORIOS.md`. |
| D7 | `/eficiencia-estatal/trabalho-renda/emprego-formal` e `/renda-do-trabalho`, 1440 | `l01/eficiencia_estatal_trabalho_renda_emprego_formal-1440-com-sessao.jpg` y≈1.350–1.600 | Linha "Como evoluiu?" com eixo de 0 a 40 milhões; a série vira uma reta no topo e a variação não se lê | No `GraficoLinhas`, domínio ajustado ao dado com a quebra do eixo sinalizada. A regra de começar em zero vale para barras. |
| D8 | `/custo-de-vida`, `/conectividade`, `/educacao-municipal`, 1440 e 390 | `l09/conectividade-1440-com-sessao.jpg` y≈700–3.600 | Com conta, a porta mostra o campo de consulta e de 4 a 7 seções `Recolhido` fechadas; nenhum número de escala nem gráfico do país à vista | Na versão com conta, a fatia de escala volta com `NumeroEscala` e a primeira seção ("O retrato do país", "Os nove grupos de despesa") vem aberta. `Recolhido` fica para o que passa do orçamento de comprimento. |
| D9 | `/saneamento`, `/agronegocio`, `/contas-publicas`, `/setor-eletrico`, 1440 | `l08/saneamento-1440-com-sessao.jpg` y≈3.700–4.050 | A fatia do artefato mostra só título, lista "o que deixa de fora" e botão "Abrir o modelo" | Abrir o `ModeloDidatico` por padrão nessas quatro portas, como já é em `/gas-natural`, `/combustiveis` e `/contas-publicas-estaduais`. |
| D10 | `/observatorio` (abre `/observatorio/map`), 1440 e 390 | `l04/observatorio_map-1440-com-sessao.jpg` | Entrada do Crédito fora do molde `EntradaColecao`, com 8.531 e 16.677 px; em "Como ler o Observatório", o quarto cartão fica sozinho numa linha (y≈5.400–5.700) | Refazer no molde único, com a gravura da cidade como `figuraEscala` e o bloco das sete etapas como `secaoPropria`. "Como ler", as quatro carteiras e "Fontes e atualidade" vão para `Recolhido`. |
| D11 | `/eficiencia-estatal/judiciario`, 1440 | `l02/eficiencia_estatal_judiciario-1440-com-sessao.jpg` y≈430 e página inteira | Porta fora do molde de entrada, com 8.104 px; palavra do H1 em teal; modelo didático em grade de seis ícones; botões azul-marinho cheios | H1 sem cor; porta no `EntradaColecao`, com o gráfico de pontos dos 27 tribunais como `secaoPropria`; botões no estilo de contorno da plataforma. |
| D12 | `/eficiencia-estatal/saude-capitais`, 1440 | `l02/eficiencia_estatal_saude_capitais-1440-com-sessao.jpg` y≈1.300–6.200 | Oito figuras iguais de três barras (menor, mediana, maior); a distribuição das 26 capitais fica atrás de um link | Trocar cada trio por `GraficoPontos` com as 26 capitais, a mediana marcada e a capital escolhida em destaque, como `/eficiencia-estatal/educacao-municipal-capitais` já faz. |
| D13 | `/saneamento/metodologia`, 1440 e 390 | `l08/saneamento_metodologia-1440-com-sessao.jpg` y≈2.500–9.000; `...-390-...` y≈3.000–5.500 | "Matriz de viabilidade" com mais de dez colunas, texto longo em colunas estreitas, células de 250 a 300 px e rolagem interna | `TabelaInterativa` com quatro colunas pela tarefa (pergunta, fonte, cobertura, situação) e o resto em linha expansível (`DetalheDoNivel`). O CSV completo continua no botão. |
| D14 | `/saneamento/tarifa-social`, 390 | `l08/saneamento_tarifa_social-390-com-sessao.jpg` y≈5.000–7.500 | A primeira coluna traz o nome da categoria e uma descrição de cerca de 20 linhas; cada linha ocupa 230 px | Só o nome na célula; a descrição vai para `DetalheDoNivel` ou nota abaixo da tabela. |
| D15 | `/observatorio/institutions`, 390 | `l04/observatorio_institutions-390-com-sessao.jpg` y≈2.400–3.000 | Linhas de cerca de 150 px porque a primeira coluna leva a descrição do segmento | Segmento em sigla ("S1") com a definição na legenda da tabela. |
| D16 | `/observatorio/alerts`, 390 | `l05/observatorio_alerts-390-com-sessao.jpg` | Rolagem horizontal da página (medida). O ponto que estoura não foi localizado na captura | Inspecionar no navegador e conter o elemento largo com `min-width: 0` ou `overflow-x: auto` no cartão da regra. |
| D17 | `/observatorio/market`, 1440 | `l05/observatorio_market-1440-com-sessao.jpg` y≈1.900–2.300 | Linha com cerca de 12 séries, uma cor por banco | Uma série focal na cor do observatório e as demais em `--serie-referencia`, com rótulo direto no fim da linha e seletor de banco. |
| D18 | `/observatorio/states/SP`, 1440 | `l03/observatorio_states_SP-1440-com-sessao.jpg` | Cerca de 15 blocos de cinco ou seis números pequenos, sem gráfico, em 8.848 px; o bloco "Presença bancária" está vazio | Um gráfico por bloco onde a série existe no painel de origem; bloco vazio sai da página até haver dado. |
| D19 | `/observatorio/subnational-credit` e o padrão da aplicação do Crédito, 1440 | `l03/observatorio_subnational_credit-1440-com-sessao.jpg` y≈760–1.000 | Parágrafo-síntese com cerca de 150 caracteres por linha | Limitar a medida do texto corrido a 60–75 caracteres (`max-width` em `ch`) no CSS da aplicação. |
| D20 | `/credito-imobiliario`, `/emprego-formal`, `/saneamento/internacional`, `/observatorio-do-credito/metodologia`, `/contas-publicas/metas`, 1440 | `l08/saneamento_internacional-1440-com-sessao.jpg` y≈4.700–8.300 | Tabelas de 25 a 223 linhas e listas longas abertas no fluxo da página | `TabelaInterativa` com busca e paginação, ou `Recolhido` com resumo de uma linha. Nada é apagado. |
| D21 | `/contas-publicas`, 1440 | `l03/contas_publicas-1440-com-sessao.jpg` y≈1.100–1.300 | No "Para você", o primeiro cartão não tem gravura e os outros dois têm | Passar a terceira arte em `artes` ou tirar as duas; o trio precisa ser igual. |
| D22 | `/observatorio/methodology`, 390 | `l05/observatorio_methodology-390-com-sessao.jpg` y≈0–1.035 | H1 abaixo da primeira tela (medida) | Recolher o bloco que vem antes do H1 ou movê-lo para depois da abertura. |
| D23 | `/setor-eletrico/territorio`, 390 e 1440 | medida axe | Contraste insuficiente em um rótulo (`.rotulo.text-mineral` sobre `bg-energia-fundo`) | Trocar o rótulo para `text-carvao-muted` nesse fundo. |
| D24 | `/setor-eletrico/territorio/atlas`, `/setor-eletrico/mercado/comercializacao`, `/territorio/emissoes` | medida axe | Lista de definição mal formada (2 rotas); região com rolagem sem foco (1 rota) | `<dl>` só com `<dt>`, `<dd>` e `<div>` de agrupamento; `tabindex="0"` e `aria-label` no contêiner com rolagem. |

### Melhoria

| # | Rota, largura | Captura e posição | O que se vê | Correção sugerida |
|---|---|---|---|---|
| D25 | Entradas de observatório, 1440 | `l01/observatorios_familias-1440-com-sessao.jpg` y≈1.900–2.850 | "As coleções": título à esquerda, caixas de links de alturas desiguais, área vazia em Famílias; os destinos são títulos de página, sem a pergunta que respondem | Grade de `DestinosColecao` em largura total, cada coleção com a pergunta e o número lido da base, como o anexo de arquiteturas pede. |
| D26 | `/observatorios/familias`, `/servicos-publicos`, `/energia-e-infraestrutura`, `/economia`, 1440 | `l01/observatorios_familias-1440-com-sessao.jpg` y≈3.100–4.500 | O modelo didático é uma grade de cartões de texto com colunas de alturas desiguais | Desenhar o fluxo de verdade dentro do `ModeloDidatico`, como já fazem Contas (cascata) e Território (pixels). Ver seção 6. |
| D27 | `/agronegocio`, `/conectividade`, `/custo-de-vida`, `/educacao-municipal`, 1440 | `l06/agronegocio-1440-com-sessao.jpg` y≈1.450–1.700 | "Por onde seguir" com 2 ou 6 itens numa grade de 4 colunas, deixando linha pela metade | Colunas pelo número de itens (2, 3 ou 4) em `DestinosColecao`. |
| D28 | `/agronegocio/conjuntura`, `/agronegocio/insumos`, 1440 | `l06/agronegocio_insumos-1440-com-sessao.jpg` y≈2.700–7.500 | Série anual em barras horizontais, um ano por linha; três gráficos de 15 barras seguidos | `GraficoBarras` na vertical ou `GraficoLinhas` para evolução; barra horizontal fica para ordenação entre categorias. |
| D29 | Capítulos do Agro (`custos-renda`, `credito-protecao`, `logistica-mercados`, `clima-ambiente`), 1440 | `l06/agronegocio_custos_renda-1440-com-sessao.jpg` y≈1.500–3.300 | Pilhas de 5 a 10 acordeões fechados; botões azul-marinho cheios | Abrir o primeiro modelo de cada grupo; botões no estilo de contorno. |
| D30 | `/saneamento/acesso`, `/esgoto`, `/financiamento`, 1440 | `l08/saneamento_acesso-1440-com-sessao.jpg` y≈6.900–7.700 | Barras empilhadas com 6 a 7 cores saturadas (azul vivo, roxo, verde, laranja) | Usar `--serie-comp-1` a `-5` com "demais" em `--serie-referencia`, e rótulo direto nas maiores fatias. |
| D31 | `/setor-eletrico/empresas/ambar-amazonas`, 1440 | `l09/setor_eletrico_empresas_ambar_amazonas-1440-com-sessao.jpg` y≈1.600–5.300 | Barras e linhas em roxo, fora do teal da coleção | Conferir o token da ficha de entidade. Se o roxo é a cor de "distribuidora", declarar na legenda; se não, usar `--cor-energia`. |
| D32 | Padrão da aplicação do Crédito, 1440 | `l04/observatorio_credit-1440-com-sessao.jpg` y≈850–2.200 | Gráficos de cerca de 110 px de altura dentro de cartões, com oito linhas de selos, legenda, marcadores e fonte | Altura mínima de 240 px para a figura; fonte e "definição da série" num `<details>`; selo de natureza uma vez por seção. |
| D33 | `/observatorio/compare`, `/saneamento/comparar`, 1440 | `l05/observatorio_compare-1440-com-sessao.jpg` | A página abre vazia: só o seletor, em 2.200 a 2.750 px, dos quais uns 350 são úteis | Abrir com uma seleção de exemplo (os chips "5 grandes bancos" e "Capitais do Sudeste" já existem), identificada como exemplo. |
| D34 | `/observatorio/states`, 1440 | `l04/observatorio_states-1440-com-sessao.jpg` | Página "Estados" com uma tabela de 27 linhas e nenhum mapa | Reusar o mapa de UF que `/observatorio/credit-panorama` já desenha. |
| D35 | `/divida-das-familias/consignado`, 1440 | `l01/divida_das_familias_consignado-1440-com-sessao.jpg` y≈4.100–4.500 | Quatro colunas de cerca de 12 px num gráfico de 580 px de largura | Largura da barra proporcional à banda da categoria no `GraficoBarras` vertical. |
| D36 | `/agronegocio/ambiente`, 1440 | `l02/agronegocio_ambiente-1440-com-sessao.jpg` y≈1.250–1.650 | Eixo com marcas em 29.059, 14.530 e 0 | Marcas em valores redondos, 4 a 5 por eixo, com o máximo anotado direto na série. |
| D37 | `/saneamento`, 1440 | `l08/saneamento-1440-com-sessao.jpg` y≈650–900 | O quarto número é uma faixa ("R$ 80,84 a R$ 198,89") que quebra em duas linhas e muda o ritmo da fatia | `NumeroEscala` com a mediana como valor e a faixa na nota. |
| D38 | Todas as páginas, 390 | `l02/eficiencia_estatal_saneamento_residuos-390-com-sessao.jpg` | "Para ir além" e rodapé somam cerca de 1.300 px de listas de links | Rodapé em `<details>` por observatório no celular. |

---

## 6. Páginas sem elemento visual com função

**Critério.** Página sem gráfico, mapa, diagrama, modelo didático desenhado ou gravura com função, no estado de hoje. Parto do inventário (67 rotas) e corrijo com o que as capturas mostraram.

**O que mudou hoje**

- Os nove painéis novos das Famílias têm gráficos do kit.
- As seis entradas de observatório ganharam gravura panorâmica.
- O bloco "Para ir além" ganhou uma faixa de gravura. O comentário em `src/components/observatorios/ParaIrAlem.tsx` a declara decorativa (`alt=""`, `aria-hidden`). Pela régua da skill ("nenhuma decoração sem função"), ela não conta como elemento visual da página. Nas capturas de páginas longas a faixa aparece escura e vazia; é provável artefato do carregamento preguiçoso e não foi verificado.

**Correções ao inventário**

- `/setor-eletrico/metodologia` tem um fluxo de cinco passos.
- `/saneamento/municipio/[id]` tem réguas de comparação.
- `/custo-de-vida/na-minha-cidade` tem barras por grupo.

**Regra das propostas.** Cada uma usa dado que a própria página já mostra, ou componente que já existe em outra página. Onde digo "se a base tiver", não conferi.

### Setor Elétrico

| Páginas | Elemento que ensina |
|---|---|
| `/setor-eletrico/aprenda/[conceito]` (54) | Miniatura do percurso geração, transmissão, distribuição, consumo (o da entrada) com o elo do verbete marcado. Quando o "exemplo real" é uma série, a linha dessa série no lugar do número solto. |
| `/setor-eletrico/aprenda` e `/aprenda/trilhas` (1 + 1 + 2) | O mesmo percurso em largura total, com os verbetes agrupados por elo. Nas trilhas, a sequência dos passos desenhada. |
| `/setor-eletrico/dados/[dataset]` (121) | Régua de tempo do conjunto: período coberto, última captura e atraso em relação à cadência declarada. Ao lado, a linhagem "fonte, conjunto, painéis que usam", que a ficha hoje lista em texto. |
| `/setor-eletrico/dados/reproducao` | O fluxo de cinco passos de `/setor-eletrico/metodologia`. |
| `/setor-eletrico/mercado/comercializacao` | Barras dos agentes por classe, com o dado da tabela. |
| `/setor-eletrico/pld/modelos/[modelo]` (3 de 5) | Previsto contra realizado das rodadas arquivadas em `GraficoPontos`; a tabela "Números arquivados" já tem os pares. |
| `/setor-eletrico/empresas/[entidade]` (6 de 129) | Não verificado quais são. Se não há série, o diagrama de controle societário que as outras fichas mostram. |

### Saneamento

| Páginas | Elemento que ensina |
|---|---|
| `/saneamento/municipio` (consulta) | O mapa municipal de `/saneamento/acesso` como localizador, ligado à busca. |
| `/saneamento/comparar`, `/saneamento/prestadores/comparar` | Abrir com uma seleção de exemplo e a régua de comparação da ficha do município. |
| `/saneamento/preco-regulado/contrapartidas` | Barras pareadas "meta contratada e resultado observado" nas linhas que têm os dois números. |
| `/saneamento/preco-regulado/riscos` | Matriz de alocação: evento de risco nas linhas, quem suporta nas colunas, em grade categórica. |
| `/saneamento/preco-regulado/reajustes`, `/saneamento/responsaveis`, `/saneamento/prestadores/[id]` | Não abertos nesta auditoria. Para "responsáveis", o diagrama institucional titular, prestador e regulador cabe como mecanismo. |
| `/saneamento/metodologia` | Grade de situação por pergunta (integrado, parcial, não integrado), com glifo e texto, no lugar da matriz larga. |
| `/eficiencia-estatal/saneamento`, `/eficiencia-estatal/saneamento/dados` | Página de passagem com aviso de painel principal: pequenos múltiplos dos quatro serviços com os três números do topo, ou nenhum elemento e o link para o painel principal em destaque. |

### Gás e combustíveis

| Páginas | Elemento que ensina |
|---|---|
| `/gas-natural/regulacao` | Linha do tempo desenhada dos marcos legais (o Setor Elétrico tem a peça em `/setor-eletrico/regulacao/linha-do-tempo`) e um diagrama de competências da União e dos estados. |
| `/gas-natural/metodologia` | A barra da cadeia do modelo didático da entrada, marcando onde cada fonte mede. |
| `/gas-natural/dados` | Régua de cobertura por série (início e fim) no lugar da lista longa. |

### Mobilidade e conectividade

| Páginas | Elemento que ensina |
|---|---|
| `/conectividade` | Abrir o retrato do país (D8) e transformar o modelo "O que cada medida conta" num diagrama das três contagens: acesso fixo, linha móvel e cobertura declarada. |

### Contas Federais

| Páginas | Elemento que ensina |
|---|---|
| `/contas-publicas/metodologia` | As etapas autorização, empenho, liquidação e pagamento como o funil que `/contas-publicas/execucao` já desenha. |
| `/contas-publicas/glossario` | O mesmo funil como índice: cada termo ancorado na etapa a que pertence. |
| `/contas-publicas/dados` | Grade de pontos "capítulo e disponibilidade", no formato da matriz "Até onde cada tema chega" da Síntese das capitais. |

### Agronegócio

| Páginas | Elemento que ensina |
|---|---|
| `/agronegocio/aprenda`, `/agronegocio/glossario` | O diagrama de etapas da cadeia (já no modelo didático da entrada) como índice visual dos termos. |
| `/agronegocio/metodologia` | Grade de cobertura por capítulo. |
| Capítulos com tudo recolhido (`custos-renda`, `clima-ambiente` e irmãos) | Abrir o primeiro modelo (D29). |

### Crédito e sistema financeiro

| Páginas | Elemento que ensina |
|---|---|
| `/observatorio-do-credito/simulador-da-parcela` | Barra "principal e juros" do total pago e a curva do saldo devedor, calculadas pelo próprio simulador, no envelope `ModeloDidatico`. |
| `/observatorio-do-credito/metodologia` | A taxonomia observado, calculado, estimado e previsto como diagrama, e a linhagem dos arquivos. |
| `/observatorio/states` | Mapa de UF (D34). |
| `/observatorio/compare` | Seleção de exemplo (D33). |

### Famílias

| Páginas | Elemento que ensina |
|---|---|
| `/eficiencia-estatal/seguranca-alimentar` (porta do tema) | Barras por região da insegurança alimentar; o dado já aparece em `/agronegocio/panorama`. |
| Páginas de dados e de métodos dos temas (trabalho e renda, assistência social, segurança alimentar, habitação) | Uma peça só, reutilizável: grade "medida, território, ano" que mostra o que existe e desde quando. |

### Serviços Públicos

| Páginas | Elemento que ensina |
|---|---|
| `/eficiencia-estatal/educacao-municipal-capitais/metodos`, `/eficiencia-estatal/saude-capitais/metodos`, `/eficiencia-estatal/acesso-justica/dados` | A mesma grade de cobertura. |
| Capítulos parciais (2 de 11 do Judiciário, 2 de 8 da Segurança, 1 de 7 da Cultura) | Não verificado quais são. |

### Território e Clima

| Páginas | Elemento que ensina |
|---|---|
| `/territorio/metodologia` | Linha de cobertura temporal das três fontes (os períodos estão no texto) e o diagrama "do satélite ao foco" reutilizado. |
| `/territorio/queimadas/municipio/[ibge]` | Barras pareadas do município e do estado em focos por 1.000 km² (dado da tabela). A série anual do município entra se a base tiver. |

### Área da conta

| Páginas | Elemento que ensina |
|---|---|
| `/app/minha-cidade` | Régua do município, do estado e do Brasil em cada cartão, quando a base traz os três; é a peça da ficha do Saneamento. |
| `/app/observatorios` | A árvore de 6 observatórios e 24 coleções desenhada como mapa (a página se chama mapa), ou a miniatura da gravura de cada observatório ao lado do nome, para reconhecimento. |

**Fora do escopo desta auditoria, mas no inventário:** os 7 aperitivos, as 6 portas `/perguntas/*` e as páginas institucionais.

---

## 7. O que não foi verificado

- **Teclado, leitor de tela, foco, toque, zoom de 200% e texto ampliado.** Nada disso foi testado.
- **Larguras de 320 e 768 px.** Só 390 e 1440.
- **Versão sem sessão** e a troca aperitivo/painel. Só o modo com sessão.
- **Estados interativos:** abas, filtros, seleção no mapa, `Recolhido` aberto, seletor Entender/Analisar/Auditar, erro, carregamento, ausência.
- **Movimento e transições.**
- **Cerca de 66 das 226 rotas foram só medidas, não olhadas.** Entre elas:
  - Crédito: `broad-credit`, `rural-credit`, `directed-credit-bndes`, `consortia`, `loan-maturity`, `fidc-receivables`, `operational-indicators`, `scenarios`, `leading-signals`, `search-trends`, `products`, `interest-rates`.
  - Setor Elétrico: `curtailment`, `carga`, `rede`, `mercado`, `leiloes`, `conta-de-luz`, `perdas`, `qualidade`.
  - Saneamento: `desigualdades`, `continuidade`, `prestadores`, `planejamento`, `contratado`, `responsaveis`, `saude-ambiente`, `resiliencia`.
  - Agro: `mercados`, `produtores`, `apoio`, `producao`.
  - Famílias: `desenrola`, `clientes-contra-bancos`, `bancos-cobrando-na-justica`, `sancoes-e-reclamacoes` (abertas em miniatura, sem anotação).
  - Parte das amostras do lote 10.
- **As demais foram vistas em miniatura** (25% a 1440, 40% a 390), com cerca de 20 trechos ampliados. Defeito pequeno de alinhamento ou de corte de rótulo pode ter escapado.
- **Tamanho mínimo de texto e contraste** além do que o axe mediu. A impressão de texto de 10 a 11 px na aplicação do Crédito vem da captura, não de medida.
- **Vínculo dos logos** (CNPJ e manifesto) e a exatidão de qualquer número.
- **Faixa de gravura do "Para ir além" e bandeiras de UF** que aparecem vazias em páginas longas: provável carregamento preguiçoso na captura de página inteira; conferir no navegador.
- **Ponto exato da rolagem horizontal** de `/observatorio/alerts` a 390.
- **Rotas dinâmicas:** uma ou duas amostras por molde (2 de 121 conjuntos de dados, 2 de 54 verbetes, 1 de 129 fichas de empresa, 1 de 5 modelos do PLD, 1 ficha de cada tipo de município). O resto herda o molde; diferenças por conteúdo não foram vistas.
- **Molde de cada rota:** veio do inventário de hoje cedo e do código dos painéis novos, sem reexecutar a classificação.
