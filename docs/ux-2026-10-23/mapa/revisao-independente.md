# Revisão independente: /app/observatorios ("Encontre o painel"), Iniciativa M1

Branch `claude/mapa-1-arquitetura`. Revisor: sessão separada, que não participou da implementação. Duas rodadas no mesmo dia; a rodada 2 vale, e a rodada 1 fica abaixo como histórico.

## Rodada 2 (23/10/2026)

**Base da avaliação.** A mesma rubrica, os mesmos anexos e o mesmo pedido da rodada 1. Evidência visual: as oito capturas novas de `depois-conta-nova/` e `depois-conta-que-volta/` (gravadas às 08:06), agora com a conta que volta no caso mais longo (último acesso no Setor Elétrico, quatro recortes, dois avisos), lidas em recortes de até 1.300 px; os `evidencias.json` das duas pastas; e a conferência de teclado e alvos rodada com Playwright (`scratchpad/teclado/saida.txt`). Código conferido na versão atual: `MapaDaConta.tsx`, `MapaDaConta.module.css`, `ParaVoce.tsx`, `LinkMedido.tsx`, `src/middleware.ts`, `src/lib/observatorios/mapaConta.ts` e `page.tsx`, com o diff desde `20b1177`.

**Limites do método.** Não abri a página no navegador nem rodei build, servidor ou testes. A conferência de teclado foi feita por outro processo; o arquivo não diz em qual conta rodou nem identifica o build, e cobre os 40 primeiros pontos do Tab a partir do H1. Os scripts do detector da impeccable e do inspetor da design-taste-frontend continuam ausentes do repositório.

### 1. Notas pela rubrica

| Critério | Nota (rodada 1) | Evidência (o que vi e onde) | Limitação remanescente |
|---|---|---|---|
| Direção de arte | 8 (8) | O "Para você" saiu dos cartões com moldura e virou lista com filete, com a mesma gramática de "Na sua cidade" e do diretório; a seta → passou a marcar todo destino do diretório (observatórios e coleções) e o abridor deixou de parecer link (1440, conta nova, y ≈ 500 a 745 e recorte 2). A página agora é uma família só: filete, serifa nos títulos, seta no destino. | Duas réguas seguidas antes do diretório continuam (cinza de `.destinos` e, 40 px abaixo, o filete do acento: 1440, conta nova, y ≈ 812 e 853). Os títulos dos recortes ("PLD do Sudeste", "Botijão em Pernambuco") seguem sem seta, enquanto "Continuar em …", "Todos os recortes (4)" e "Avisar quando atualizar" têm. Dois contornos de foco na mesma página (2 px nos campos e no "Para você", 3 px no diretório, pela conferência de teclado). |
| Hierarquia | 8 (7) | A primeira tela da conta nova a 1440 traz H1, busca rotulada, as quatro perguntas do estado e as oito da cidade, e o diretório encosta na dobra (filete de Famílias em y ≈ 853). O maior bloco deixou de ser uma promessa sem número. Na conta que volta, "Onde você parou" vem antes do H1 e o "No seu estado" ainda aparece sem rolar (y ≈ 795 a 850). O destino (nome com seta) agora pesa mais que o abridor. | A linha da coleção ficou só com nome e estado: nenhuma das 28 tem pergunta, então o leitor escolhe entre "Empresas e risco", "Proteção social" ou "Síntese das capitais" só pelo nome, e o critério pede pergunta reconhecível. A 1440, conta nova, o título "Famílias" é cortado pela borda da primeira tela (y ≈ 880 a 900): o diretório aparece como filete, não como conteúdo. |
| Tipografia e acabamento | 7 (7) | A 1440 o ritmo do diretório ficou uniforme: a linha de estado sem lista tem a mesma altura do abridor (`.estado`, `min-height: 44px`), e as linhas de "1 página" não encolhem mais (recorte 2). O sinal + desenhado em CSS vira − ao abrir. | A 390, em seis das 21 linhas com lista ("Dívida e crédito das famílias", "Setor Elétrico", "Dívida e crédito dos governos", "Crédito e sistema financeiro", "Pagamentos", "Empresas e risco"), o abridor "Ver as páginas +" cai para uma linha própria, à esquerda, e essas linhas ficam mais apertadas que as vizinhas, onde o abridor está à direita (390, conta nova, recorte 1 e visão geral). O H2 "Para você" continua fora da escala (`text-[clamp(1.5rem,2.6vw,1.9rem)]`, cerca de 30 px contra 34 px do `.t-h2` dos observatórios) e a frase dele em `text-sm` (14 px). O exemplo do campo de busca continua cortado a 390 ("dívida dos estad"). |
| Densidade e profundidade | 8 (7) | A página encolheu 243 px a 1440 na conta nova (3.336 para 3.093) e 863 px a 390 (6.351 para 5.488), sem perder nenhum destino: o enchimento dos cartões saiu, as 28 coleções, a contagem, o "dados até", a situação, as listas de páginas e o método continuam. | A linha da coleção perdeu a pergunta e não ganhou outra informação: cada linha tem cerca de 100 px para um nome e uma linha de estado. A faixa morta ao lado de Energia e Infraestrutura continua (Contas Públicas termina em y ≈ 2.000 e Energia em y ≈ 2.340 a 1440). Os nomes das páginas continuam todos atrás de 21 `<details>`. |
| Didática visual | 7 (7) | Saíram as perguntas emprestadas que distorciam a coleção ("Os aposentados estão mais endividados?") e as que repetiam o "Para você". Observatórios mantêm a pergunta para leigo; estado em palavras; selos com glifo e texto. | O ganho veio por subtração: nenhuma coleção explica o que responde. "Publicação retida em parte há 3 dias" continua em cinco linhas sem explicação ao leigo. A pergunta por coleção depende de texto do dono (comentário em `mapaConta.ts`), ainda não escrito. |
| Comparabilidade | 8 (8) | Sem mudança: contagem com regra única, "dados até" com a granularidade da fonte e omitido quando não há domínio de frescor, atraso em texto, cores como identidade. | As três granularidades de data lado a lado (2025, ago/2026, 30/09/2026) sem nota no lugar; "N páginas" mistura páginas parciais e completas na contagem. |
| Interação e acessibilidade | 8 (7) | Evidência além da automação agora existe: o Tab percorre busca, as 12 perguntas do "Para você" e o diretório em ordem de leitura (observatório, coleção, abridor), com contorno visível em todos os 40 pontos registrados; Enter abre e fecha a lista do Setor Elétrico; nenhum alvo abaixo de 44 px a 1440 e 390. O abridor diz "Ver as páginas" e "Fechar a lista" (o outro rótulo sai da árvore por `display: none`) e o sinal muda. Axe 0 nos quatro casos. Links do mapa são `<a href>` de documento. | Ainda sem prova no toque e no leitor de tela, e a conferência não alcança `retomar`, o método nem a lista de resultados da busca. Dois estilos de contorno de foco (2 px bronze do `:focus-visible` global e 3 px destaque do módulo). Sublinhado de hover fora de `@media (hover: hover)`. E um risco de comportamento, lido no código e não observado: o último acesso só é gravado em navegação de documento (`paginaHtml` em `src/middleware.ts`); a barra comum e a navegação da coleção usam `next/link` (`BarraPlataforma.tsx`, `NavegacaoColecaoCliente.tsx`), então quem entra no Setor Elétrico pelo mapa e passa ao Crédito pela barra volta e lê "Continuar em Setor Elétrico". |
| Responsividade | 8 (7) | A 390 o diretório começa em cerca de 1.400 px na conta nova (antes, 2.100); listas do "Para você" com seta à direita e alvos de 44 px; rolagem horizontal 0; cromo 102 px; nenhum alvo abaixo de 44 px pela conferência. | O abridor que muda de lugar (critério Tipografia) é o defeito mais visível no celular. Na conta que volta, a fatia `retomar` ocupa a primeira tela inteira a 390 (H1 em y = 633, com quatro recortes e dois avisos) e o diretório começa perto de 1.900 px. Chegar a Território e Clima exige rolar mais de 4.000 px, sem atalho para as seções (que já têm `id`). 768 px não foi capturado. |

### 2. Critério de aceite da seção 7 do pedido

| Medida | Exigido | Resultado | Evidência |
|---|---|---|---|
| Primeira tela a 1440, sem rolar | `retomar` (quando houver), H1, busca e os cartões do "Para você" | Cumpre | Conta nova: H1 y = 183, busca y ≈ 253, perguntas do estado e da cidade até y ≈ 745. Conta que volta, caso mais longo: `retomar` y ≈ 175 a 435, H1 y = 479, busca y ≈ 548 a 596, "No seu estado" y ≈ 795 a 850. Os "cartões" agora são lista: a forma mudou de propósito enquanto não há número, e o dono deve saber disso. |
| Nenhum observatório quebrado; nenhuma coleção sem link direto; nenhum texto de inventário antes do diretório | sim | Cumpre (captura e código) | Seis seções inteiras; cada coleção é `LinkMedido` (`<a href>`); inventário só no método. Teste não executado por mim. |
| Axe (WCAG 2.1 A e AA) | 0 a 1440 e 390 | Cumpre | `axe: []` nas quatro medições. |
| Rolagem horizontal | 0 | Cumpre | `rolagemHorizontal: false` nas quatro medições. |
| Cromo | até 230 e 200 px | Cumpre | 151 e 102 px nos dois estados. |
| Altura | até 3.500 a 1440 e 7.000 a 390 | Cumpre, inclusive no caso mais longo | 3.093 e 3.388 px a 1440; 5.488 e 5.987 px a 390. O risco apontado na rodada 1 caiu: com quatro recortes e dois avisos sobram 112 px a 1440. |
| Texto mínimo | nenhum abaixo de 12 px; nenhum `font-size` fora da escala | Piso: cumpre. Escala: não cumpre na letra | Módulo CSS sem `font-size`; `ParaVoce` mantém `text-sm` na frase e `text-[clamp(1.5rem,2.6vw,1.9rem)]` no H2, ambos visíveis no mapa. |
| Alvos de toque | 44 px em todo link e `summary` do diretório | Cumpre | `saida.txt`: "alvos abaixo de 44 px: nenhum" a 1440 e a 390. |
| Teclado | ordem de leitura e foco visível, conferência manual registrada | Cumpre, com ressalva | Ordem coerente e contorno visível nos 40 pontos registrados; Enter abre e fecha a lista. Fora do registro: `retomar`, método, resultados da busca e o restante do Tab depois de Contas Estaduais; contorno com dois estilos. |
| Rubrica (seção 10) | 9 em Hierarquia, Interação e acessibilidade e Responsividade; 8 nos demais | Não cumpre | Hierarquia 8, Interação e acessibilidade 8, Responsividade 8 (exigido 9); Tipografia e acabamento 7 e Didática visual 7 (exigido 8). Direção de arte 8, Densidade e profundidade 8 e Comparabilidade 8 cumprem. |
| Antes e depois | 390 e 1440, primeira tela e página inteira, com sessão, nos dois casos | Cumpre | 4 capturas em `antes/` e 4 em cada pasta "depois". |

### 3. Os problemas da rodada 1

| Problema da rodada 1 | Situação | Evidência |
|---|---|---|
| 3.1 A primeira tela gastava o maior bloco em cartões sem resposta | Resolvido | `ParaVoce` com `forma="lista"` quando não há número: perguntas em lista com filete e seta, ressalva dita uma vez na frase do título (`MapaDaConta.tsx`). A 1440 o bloco do estado caiu de 280 para cerca de 90 px (título e uma linha de perguntas); a 390 o diretório subiu de cerca de 2.100 para 1.400 px. Resta o título "Famílias" cortado na dobra a 1440. |
| 3.2 Afordância invertida no diretório | Resolvido em grande parte | Seta → (`.seta`, `aria-hidden`) em todas as coleções e observatórios; abridor sem sublinhado, com "Ver as páginas" e "Fechar a lista" e o sinal que passa de + a −; Enter abre e fecha (`saida.txt`). Faltam a seta nos títulos dos recortes e o hover condicionado a `(hover: hover)`. |
| 3.3 Pergunta da coleção emprestada de uma página, ausente em 11 | Parcialmente resolvido | O empréstimo saiu (`perguntasDoIndice` removida de `mapaConta.ts`), e com ele a distorção e as repetições. A correção proposta, o campo `pergunta` nas 28 coleções de `lista.ts`, não foi feita: agora são 28 de 28 sem pergunta, à espera do texto do dono. |

### 4. Os três problemas que mais pesam agora

#### 4.1 "Continuar em" pode apontar para a coleção errada

Lido no código, não observado. O middleware só grava o último acesso em navegação de documento: o GET pede HTML (`paginaHtml`). Os links do mapa foram trocados por `<a>` de documento justamente para isso (`LinkMedido.tsx`). Mas a barra comum e a navegação da coleção usam `next/link`, e essa navegação no cliente não grava. Exemplo: o leitor sai do mapa para o Setor Elétrico, passa ao Crédito pela barra e volta outro dia. A página diz "Continuar em Setor Elétrico". É a promessa central da fatia `retomar` ("quem volta retoma de onde parou") e pesa em Interação e acessibilidade e em Hierarquia.

**Correção.** Gravar o último acesso também a partir do cliente: um componente cliente `MarcaUltimoAcesso` no layout das coleções observa `usePathname()` e, a cada mudança, faz `POST` para um route handler. O handler confere a sessão, resolve o caminho com o mesmo `ultimoAcessoDoCaminho` do middleware e grava o mesmo cookie `scrutiniums_observatorio`, sem tabela nem dado novo. Acrescentar ao `mapa-ultimo-acesso.test.ts` o caso "navegação no cliente entre duas coleções atualiza o cookie".

#### 4.2 Nenhuma coleção diz o que responde

Para tirar a pergunta emprestada, a linha de cada coleção perdeu a pergunta, e nada ficou no lugar: as 28 linhas têm só nome e estado. É o que segura Didática visual em 7 e impede o 9 em Hierarquia: o leitor leigo escolhe entre "Empresas e risco", "Proteção social" e "Síntese das capitais" sem saber o que cada uma responde.

**Correção.** A da rodada 1, agora sem alternativa no código: criar o campo `pergunta`, obrigatório no tipo, nas 28 coleções de `src/lib/observatorios/lista.ts`, com o texto aprovado pelo dono. Usá-lo na linha do mapa, em `t-meta`, entre o nome e o estado, e no `resumo` das entradas `tipo: "colecao"` de `indiceDeBusca()`. É uma decisão pendente do dono e precisa ir para a lista de decisões do PR.

#### 4.3 No celular, o abridor das páginas muda de lugar

A 390, quando a linha de estado é longa (data mais "publicação retida em parte" ou "atualização atrasada"), o `summary` em `flex-wrap` com `justify-content: space-between` joga "Ver as páginas +" para uma linha própria, à esquerda. Isso acontece em seis das 21 linhas com lista. Nelas o abridor fica num lugar diferente do das vizinhas e a linha fica mais apertada. É o defeito de acabamento mais visível no aparelho em que o dono lê, e pesa em Tipografia e acabamento e em Responsividade.

**Correção.** Trocar o `flex-wrap` do `summary` por uma grade de duas colunas: o estado quebra dentro da própria coluna e o abridor fica sempre à direita, alinhado à primeira linha.

| Antes | Depois | Por quê |
| --- | --- | --- |
| `.paginas summary { display: flex; flex-wrap: wrap; justify-content: space-between; }` | `.paginas summary { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: 16px; }`, com `padding-block` que mantenha os 44 px | O estado longo quebra dentro da coluna dele, e o abridor não troca de lugar |
| `.abrir` herda o alinhamento do `flex` | `.abrir { justify-self: end; min-height: 44px; }` | Mesmo lugar e mesmo alvo em toda linha, a 1440 e a 390 |

### 5. O que não pude verificar nesta rodada

- Toque real e leitor de tela; a cor dos dois contornos de foco (a conferência só dá espessura e estilo); o Tab dentro de `retomar`, no método e na lista de resultados da busca, e a ordem depois do ponto 40.
- Em qual conta e em qual build rodou a conferência de teclado.
- Os `<details>` abertos (lista de páginas, selos "cobertura parcial" e "em preparação", páginas previstas sem link) e o conteúdo do método: nenhuma captura mostra esses estados.
- O comportamento do cookie de último acesso descrito em 4.1: deduzido do código, não observado.
- A busca: primeiro resultado ativo desde o início e Enter.
- Largura de 768 px, zoom de 200%, conta com UF e `PARA_VOCE_POR_UF = true`, falha na leitura de recortes ou avisos.
- Testes (`mapa-conta`, `mapa-ultimo-acesso`, `ux-orcamentos-comprimento`, `ux-texto-minimo`, `design-tokens`, `parceria-ceri`) e o comportamento em produção.

---

## Rodada 1 (23/10/2026, histórico)

Texto da primeira rodada, sem alteração. As capturas que ela cita foram substituídas na rodada 2; os números de posição e altura abaixo são os das capturas anteriores.
Data da revisão: 23/10/2026. Branch `claude/mapa-1-arquitetura`. Revisor: sessão separada, que não participou da implementação.

**Base da avaliação.** Rubrica da seção 10 de `.claude/skills/observatorio-layout/SKILL.md`, anexos `arquiteturas.md`, `navegacao.md`, `identidade-visual.md` e `componentes-e-graficos.md`, `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md` e o pedido `PROMPT_M1_MAPA_AREA_LOGADA.md` (seções 4 e 7). Evidência visual: as 12 capturas de `docs/ux-2026-10-23/mapa/` (antes, depois com conta nova, depois com conta que volta; 1440 e 390 px; página inteira e primeira tela), lidas em recortes de até 1.300 px de altura, e os `evidencias.md` e `evidencias.json` das duas pastas "depois". Código lido para conferir semântica, alvos e teclado: `MapaDaConta.tsx`, `MapaDaConta.module.css`, `ParaVoce.tsx`, `page.tsx`, `src/lib/observatorios/mapaConta.ts`, `LinkMedido.tsx`, `BuscaPlataforma.tsx` (trechos) e `globals.css` (foco).

**Limites do método.** Não abri a página no navegador (build e servidor proibidos nesta revisão), não rodei testes e não interagi com teclado, toque ou leitor de tela. As skills impeccable, emil-design-eng e design-taste-frontend foram carregadas; o detector da impeccable e o `lint.mjs`/`inspect.mjs` da design-taste-frontend não rodaram porque a pasta `scripts/` de ambas não está versionada no repositório. Toda nota abaixo vem das capturas e do código; o que dependeria de interação está marcado como não verificado.

### 1. Notas pela rubrica

Escala da skill: 5 a 6 funcional com problemas importantes; 7 a 8 bom com limitações relevantes; 9 excelente demonstrado. Nenhum critério compensa outro.

| Critério | Nota | Evidência (o que vi e onde) | Limitação remanescente |
|---|---|---|---|
| Direção de arte | 8 | Papel em todo o `main`, H1 e títulos de observatório em serifa, filete de 2 px no acento de cada observatório e de 3 px em bronze na fatia `retomar`, nenhuma sombra, gradiente ou ícone decorativo (todas as capturas "depois"). Salto claro sobre o antes, que abria com três estados vazios e diretório em `columns`. | Componentes sem estado consistente: o bloco "Para você" é o único com moldura (grade de quatro cartões com borda), enquanto o resto da página é filete; duas réguas seguidas antes do diretório (cinza de `.destinos` e, 40 px abaixo, o filete do acento: 1440, conta nova, y ≈ 988 e 1028); a seta de link aparece em "Continuar em Setor Elétrico →" e "Avisar quando atualizar: 1 fonte →", mas não no recorte "PLD do Sudeste", nem nos nomes de coleção e de observatório. |
| Hierarquia | 7 | H1 "Encontre o painel" com a frase e a busca rotulada lado a lado a 1440; na conta que volta, "Onde você parou / Continuar em Setor Elétrico" vem antes do H1 (1440, y ≈ 203 a 265; 390, y ≈ 150 a 215), o que serve bem a quem retoma. Seções do diretório com H2 de observatório e pergunta. | O maior bloco da primeira tela não responde à tarefa da página: os quatro cartões do "Para você" ocupam 280 px a 1440 (y ≈ 466 a 745) e cada um diz só "A página mostra os números depois de escolher o estado", ressalva que a frase ao lado já fez; a 1440 com conta nova nenhum painel do diretório aparece na primeira tela (o H2 "Famílias" está em y ≈ 1068). No diretório, o nome da coleção (o destino) é texto de 16 px sem marca de link, e o elemento sublinhado de cada linha é "ver as páginas +", que é só um abridor: a prioridade visual está invertida. |
| Tipografia e acabamento | 7 | Escala única nos módulos da página (`MapaDaConta.module.css` sem `font-size`); `.t-h1`, `.t-h2`, `.t-corpo`, `.t-meta`, `.rotulo` usados de forma coerente; nenhum texto cortado nas capturas de 1440. | Dois tamanhos de H2 na mesma página: "Para você" usa `text-[clamp(1.5rem,2.6vw,1.9rem)]` (cerca de 30 px a 1440) e os observatórios `.t-h2` (cerca de 34 px). `ParaVoce` usa `text-sm` (14 px) e `text-lg` fora da escala. Onze linhas de coleção sem pergunta deixam um vão vertical onde a pergunta estaria (ex.: "Proteção social", "Setor Elétrico", 1440, recorte 2); linhas sem páginas ("Cultura", "Mobilidade") ficam mais baixas que as vizinhas, e o ritmo do diretório oscila. A 390, "ver as páginas +" muda de lugar conforme o tamanho da linha de estado: à direita na mesma linha quando cabe, à esquerda numa linha própria quando não cabe ("Dívida e crédito das famílias", "Setor Elétrico", "Crédito e sistema financeiro"). Placeholder da busca cortado a 390 ("dívida dos estad"). |
| Densidade e profundidade | 7 | As 28 coleções, com contagem de páginas, "dados até" e situação, em seis seções inteiras; páginas de cada coleção em `<details>`; inventário, legenda dos selos e fontes preservados no método (código, `Metodo`). | A página ficou 48% mais alta a 1440 (2.256 para 3.336 px) mostrando menos à vista: o antes listava o nome de cada página; o depois esconde todas atrás de 21 `<details>`. Os quatro cartões sem número são enchimento enquanto a decisão 1 não vem. Faixa morta de cerca de 350 px ao lado de Energia e Infraestrutura (Contas Públicas termina em y ≈ 2.195 e Energia em y ≈ 2.545, 1440): aceita pelo pedido, mas visível. |
| Didática visual | 7 | Cada observatório abre com uma pergunta para leigo ("De onde vêm a energia e a água, e quanto custam?"); estado da coleção em palavras ("atualização atrasada há 22 dias"), nunca só cor; selo com glifo e texto ("cobertura parcial", "piloto"). | A linha de pergunta das coleções não descreve a coleção: `perguntasDoIndice()` (`mapaConta.ts`) toma o título da primeira porta ou consulta com o mesmo endereço, e o resultado é "Dívida e crédito das famílias: Os aposentados estão mais endividados?", que sugere um recorte que a coleção não tem. Quatro dessas perguntas repetem literalmente itens do "Para você" acima (escola, custo de vida, internet, tanque). Onze de 28 coleções ficam sem pergunta, entre elas as maiores: Setor Elétrico (23 páginas), Crédito e sistema financeiro (31), Agronegócio (21), Saneamento (20), Contas Federais (14). "Publicação retida em parte há 3 dias" aparece em cinco linhas sem explicar ao leigo o que é "retida". |
| Comparabilidade | 8 | Contagem com regra única e declarada ("1 + páginas existentes"); "dados até" lido da referência da fonte, com a granularidade dela (2025, ago/2026, 30/09/2026), e omitido quando não há domínio de frescor, sem estimativa; cores dos filetes são identidade de observatório, não julgamento; atraso dito em texto. | As três granularidades de data aparecem lado a lado sem nota no lugar (a explicação está só no método recolhido); a contagem "N páginas" soma páginas parciais e completas sem distinguir na linha (o selo só aparece quando todas são parciais). |
| Interação e acessibilidade | 7 | Axe 0 a 1440 e 390 nos dois estados (`evidencias.json`); todo destino é `<a href>` (nenhum `form` no componente); `.alvo`, `.titulo` e `summary` com `min-height: 44px`; `aria-labelledby` em cada seção e em cada `<article>`; ordem do DOM igual à ordem visual (grade preenchida por linha); `LinkMedido` não bloqueia a navegação; foco visível em `.alvo:focus-visible` (3 px, destaque). | Nenhuma conferência manual registrada (teclado, toque, leitor de tela), e a rubrica exige evidência além da automação. O `summary` não muda de estado visível ao abrir: o "+" continua "+" (`.paginas[open] .abrir` só tira o sublinhado), o mesmo no método. Dois anéis de foco na mesma página (destaque nos links do mapa, bronze de 2 px do `:focus-visible` global nos cartões do "Para você" e na busca). Sublinhado de `:hover` sem `@media (hover: hover)`, que fica preso após o toque. A afordância invertida do nome da coleção (critério Hierarquia) pesa mais no toque, onde não há hover. |
| Responsividade | 7 | A 390, uma coluna, ordem `retomar`, `abertura`, `para-voce`, `destinos`, `metodo`; rolagem horizontal 0; cromo 102 px; todas as coleções alcançáveis; a busca é a mesma da barra. | Para chegar ao diretório a 390 é preciso rolar cerca de 2.100 px na conta nova e 2.400 px na conta que volta (dois e meio a três telas), quase tudo cartões sem número; não há atalho para as seções dos observatórios, embora elas tenham `id` (`obs-<id>`). Desalinhamento do abridor "ver as páginas +" descrito em Tipografia; itens de "Na sua cidade" em duas linhas encostam no filete seguinte; placeholder cortado. 768 px não foi capturado. |

### 2. Critério de aceite da seção 7 do pedido

| Medida | Exigido | Resultado | Evidência |
|---|---|---|---|
| Primeira tela a 1440, sem rolar | `retomar` (quando houver), H1, busca e os cartões do "Para você" | Cumpre | Conta nova: H1 y ≈ 183, busca y ≈ 253, cartões até y ≈ 745. Conta que volta: `retomar` y ≈ 175 a 270, H1 y ≈ 308, cartões até y ≈ 870 (abaixo de 900). |
| Nenhum observatório quebrado; nenhuma coleção sem link direto; nenhum texto de inventário antes do diretório | sim | Cumpre (captura e código); teste não rodado | Seis seções inteiras em grade de duas colunas, na ordem pedida; cada coleção com `LinkMedido href={c.href}`; o inventário está só no `<details>` do método. `mapa-conta.test.ts` existe, mas não o executei. |
| Axe (WCAG 2.1 A e AA) | 0 a 1440 e 390 | Cumpre | `evidencias.json` das duas pastas: `axe: []` nas quatro medições. |
| Rolagem horizontal | 0 | Cumpre | `rolagemHorizontal: false` nas quatro medições. |
| Cromo | até 230 e 200 px | Cumpre | 151 px a 1440 e 102 px a 390, nos dois estados. |
| Altura | até 3.500 a 1440 e 7.000 a 390 | Cumpre nos estados capturados, com risco | 3.336 e 3.460 px a 1440; 6.351 e 6.679 px a 390. A conta que volta tem só 40 px de folga a 1440 com um recorte: com três recortes e o link "Todos os recortes", a coluna da fatia `retomar` cresce cerca de 130 a 170 px e a página passa de 3.500. Não medido; estimativa pela altura de cada item. |
| Texto mínimo | nenhum abaixo de 12 px; nenhum `font-size` fora da escala | Piso: cumpre (código e capturas). Escala: não cumpre na letra | `MapaDaConta.module.css` sem `font-size`; mas `ParaVoce`, reaproveitado na fatia `para-voce`, usa `text-sm` (14 px), `text-lg` e `text-[clamp(1.5rem,2.6vw,1.9rem)]`, fora de `.t-*`. `ux-texto-minimo` e `design-tokens` não executados por mim. |
| Alvos de toque | 44 px em todo link e `summary` do diretório | Cumpre no código; conferência manual não verificada | `.alvo`, `.titulo`, `.paginas summary` e `.metodo > summary` com `min-height: 44px`; cartões do "Para você" com `min-h-[44px]`. Nenhum registro de conferência manual a 390. |
| Teclado | ordem de leitura e foco visível, conferência manual registrada | Não verificado | Não há registro manual na pasta. Pelo código, a ordem do DOM acompanha a leitura e há `:focus-visible` em todos os alvos, com dois estilos diferentes. |
| Rubrica (seção 10) | 9 em Hierarquia, Interação e acessibilidade e Responsividade; 8 nos demais | Não cumpre | Hierarquia 7, Interação e acessibilidade 7, Responsividade 7 (exigido 9). Tipografia e acabamento 7, Densidade e profundidade 7, Didática visual 7 (exigido 8). Direção de arte 8 e Comparabilidade 8 cumprem. |
| Antes e depois | 390 e 1440, primeira tela e página inteira, com sessão, nos dois casos | Cumpre | 4 capturas em `antes/`, 4 em `depois-conta-nova/`, 4 em `depois-conta-que-volta/`. Falta 768 px, que o pedido não exige. |

### 3. Os três problemas que mais pesam

#### 3.1 A primeira tela gasta o maior bloco numa resposta que não existe

Os quatro cartões do "Para você", sem número enquanto `PARA_VOCE_POR_UF = false`, são o elemento mais pesado da primeira tela (moldura, serifa, 280 px a 1440) e repetem cinco vezes a mesma ressalva (a frase do título e uma linha por cartão). Na conta nova a 1440 nenhum painel aparece sem rolar, numa página que se chama "Encontre o painel"; a 390 o diretório começa depois de cerca de 2.100 px. Afeta Hierarquia, Densidade e Responsividade.

**Correção.** Enquanto a decisão 1 não for tomada, renderizar as quatro perguntas do estado na mesma forma de lista com filete de "Na sua cidade" (um bloco "No seu estado" e um "Na sua cidade", cada item um link de 44 px), com a ressalva dita uma vez só, na frase do título; os cartões com moldura voltam quando houver número. As perguntas continuam na primeira tela, como o aceite exige, e o diretório sobe cerca de 170 px a 1440 e 600 a 700 px a 390.

#### 3.2 Afordância invertida no diretório

O destino de cada linha (o nome da coleção) e o de cada seção (o nome do observatório) não têm marca de link e só ganham sublinhado no hover, que não existe no toque; o único elemento sublinhado da linha é "ver as páginas +", que não navega. O "+" não vira outra coisa ao abrir. No mapa antigo os nomes tinham seta; nesta página a seta sobrou em "Continuar em … →" e sumiu do diretório. Afeta Hierarquia, Interação e acessibilidade e Direção de arte (estados inconsistentes).

**Correção.** Um só código de sinalização na página: todo link de destino com a seta `→` (`aria-hidden`) depois do nome, como em "Continuar em …", incluindo coleções, observatórios e recortes; todo abridor sem sublinhado, com o texto "As N páginas" pedido na seção 4.4 e um glifo que alterna de "+" para "−" por `[open]`, o mesmo no método.

| Antes | Depois | Por quê |
| --- | --- | --- |
| Nome da coleção sem marca, sublinhado só em `:hover` | Nome seguido de `→`; sublinhado de hover dentro de `@media (hover: hover)` | O destino tem de parecer destino no toque e de longe |
| `ver as páginas +` sublinhado, igual a um link | `As N páginas +` sem sublinhado; `+` vira `−` em `.paginas[open]` | Abridor não deve competir com o link e precisa mostrar o estado |
| Seta só em "Continuar" e "Avisar" | Seta em todo link de destino da página, inclusive recortes | Um componente, um estado |

#### 3.3 A pergunta de cada coleção é emprestada de uma página, e falta em 11 das 28

`perguntasDoIndice()` usa o título da primeira porta ou consulta com o mesmo endereço da coleção. Por isso a linha descreve uma página, não a coleção ("Dívida e crédito das famílias: Os aposentados estão mais endividados?"), repete quatro perguntas do "Para você" logo acima e falta em Proteção social, Segurança pública, Cultura, Contas Federais, Dívida e crédito dos governos, Setor Elétrico, Gás Natural, Saneamento, Crédito e sistema financeiro, Empresas e risco e Agronegócio, que juntas somam a maior parte das páginas do mapa. O vão deixado por essas linhas também quebra o ritmo do diretório. Afeta Didática visual, Hierarquia e Tipografia e acabamento.

**Correção.** Acrescentar o campo `pergunta` a cada uma das 28 coleções de `src/lib/observatorios/lista.ts`, como já existe para os seis observatórios, escrito para a coleção inteira e aprovado pelo dono, e usá-lo no mapa e no `resumo` das entradas `tipo: "colecao"` de `indiceDeBusca()` (hoje um texto padrão, "Coleção do observatório X, com N páginas além da entrada"). Com o campo obrigatório no tipo, nenhuma linha fica sem pergunta e a busca ganha a mesma frase.

### 4. O que não pude verificar

- Teclado, toque e leitor de tela: ordem real do Tab, anel de foco visível em cada alvo, anúncio do estado dos `<details>`, nome acessível dos cartões do "Para você" (o cartão inteiro é um link com pergunta, resposta, ressalva e "Ver a resposta").
- Os `<details>` abertos: lista de páginas de cada coleção, selos "cobertura parcial" e "em preparação" dentro dela, páginas previstas sem link, e o conteúdo do método (totais, legenda, fontes por coleção). Nenhuma captura mostra esses estados.
- A busca: rótulo visível conferido na captura, mas não o primeiro resultado marcado como ativo desde o início, nem o Enter.
- Largura de 768 px e zoom de 200%.
- Conta com UF e `PARA_VOCE_POR_UF = true` (cartões com número, fonte e período), conta com mais de três recortes e o link "Todos os recortes", falha na leitura de recortes ou avisos.
- Cookie de último acesso gravado pelo middleware, telemetria do `LinkMedido`, e os testes `mapa-conta`, `ux-orcamentos-comprimento`, `ux-texto-minimo`, `design-tokens`, `parceria-ceri`.
- Detector da impeccable e inspetor da design-taste-frontend (scripts ausentes no repositório).
- Comportamento em produção e no preview da Vercel.
