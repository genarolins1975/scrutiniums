# Prompt: Iniciativa I2, o Crédito na mesma casca

Data: 23/10/2026. Origem: `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md`, seção 5, I2 (terceira por importância, última na ordem de execução). Base: `main` em `b825eb9e3`. Destinatário: o modelo que vai implantar. Cole o texto abaixo da linha inteiro, sem cortar as seções de guardrails, de testes e de aceite.

---

## 1. Papel e regra de ouro

Você vai fazer a aplicação do Crédito (`/observatorio/*`, servida de `public/obs/`) deixar de ser um segundo produto dentro da Scrutiniums. Ela serve 5 das 28 coleções (Crédito e sistema financeiro, Dívida e crédito das famílias, Dívida e crédito dos governos, Pagamentos, Empresas e risco) e é a referência da plataforma para quem trabalha com dado. Hoje tem barra lateral própria com 42 vistas, marca própria, barra de celular própria, tema escuro próprio, escala tipográfica própria, números em outra forma, datas em formato ISO com hora UTC e 727 px de cromo no celular contra 200 de orçamento. A barra superior e a trilha já são as da plataforma (geradas do registro); tudo abaixo delas é outro sistema.

O trabalho tem duas etapas. Etapa 1, paridade de casca: a aplicação continua em JavaScript puro, mas passa a ter a navegação, a tipografia, o número, as ferramentas da conta, o fim de página, as datas e a medição de uso da plataforma, sem migrar vista nenhuma. Etapa 2, migração: as quatro entradas de coleção que vivem na aplicação e as cinco vistas mais usadas viram páginas Next no molde da plataforma. Nenhum número, série, cálculo, fonte, período ou texto decidido pelo dono muda.

Guardrails, sem exceção:

1. Ler inteiros, antes de qualquer código: `CLAUDE.md`, `AGENTS.md`, `.claude/skills/observatorio-layout/SKILL.md` e, com o PR #362 integrado, os anexos `navegacao.md`, `arquiteturas.md`, `componentes-e-graficos.md`, `identidade-visual.md` e `acesso.md`; `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`; `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md` (seções 3, 4 e 5, I2); `docs/observatorios/REAGRUPAMENTO.md` (seção "Menu interno do Crédito"); `docs/CREDITO_ATLAS_IMPLEMENTACAO.md`. Carregar as skills `emil-design-eng`, `impeccable` (modo Operate) e `design-taste-frontend` (`references/app-screens.md`); em conflito, prevalece a `observatorio-layout`.
2. `public/obs/app.js` é a fonte canônica única da aplicação; `app.min.js`, `app-emergentes.min.js` e `app-municipal.min.js` são gerados por `scripts/minify-obs.mjs` (`npm run preparar`) e nunca editados. A barra da plataforma dentro de `public/obs/index.html` é gerada por `node scripts/barra-spa.mjs` a partir de `src/lib/observatorios/barraSpa.ts` e nunca editada à mão; `public/obs/tokens.css` é gerado por `node scripts/tokens-derivados.mjs`.
3. Toda mudança na aplicação sobe a versão (`APP_VERSION` em `app.js`, `?v=` dos ativos em `index.html`); o teste `avaliacao-set26` reprova ativo alterado sem versão nova.
4. Nunca apagar, pular ou afrouxar teste. Teste que fixa o desenho anterior muda de propósito, com a justificativa no PR.
5. As rotas `/observatorio/*` continuam com conta (`src/lib/rotasPublicas.ts` não muda); nenhuma vista abre sem sessão.
6. Nada de cor como julgamento (as classes `down good` e `up good` saem), gradiente, sombra em elemento parado, texto abaixo de 12 px, data em formato ISO ou com hora UTC na tela.
7. Um PR por bloco (seção 9), base `main`, sem empilhar. Merge só com autorização explícita do dono na conversa. Antes de empurrar: `npm run verificar:pr` verde e `npm run evidencias` nas rotas tocadas.
8. Decisões pendentes do dono (seção 8) não se implementam sem resposta; o que já foi decidido não se reabre.
9. Comentários, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência.

## 2. Antes de começar

- Sessão nova: `bash scripts/preparar-sessao.sh`. Build para os testes de UX: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
- Comandos: `npm run verificar:rapido`, `npm run verificar:pr`, `npm run evidencias -- --rotas /observatorio/credit /observatorio/payroll-lending-aging /observatorio/interest-rates --saida docs/ux-AAAA-MM-DD/credito --larguras 390,1440 --modos com`; `node scripts/barra-spa.mjs`; `node scripts/tokens-derivados.mjs`; `npm run preparar` (regenera os bundles).
- Capturas do estado atual: `docs/ux-2026-10-23/evidencias/observatorio_credit-1440-com-sessao-primeira-tela.jpg`, `observatorio_credit-390-com-sessao-primeira-tela.jpg`, `observatorio_payroll_lending_aging-1440-com-sessao-primeira-tela.jpg`. Medidas de 23/10/2026: cromo 727 px a 390 (orçamento 200) e 142 a 1440; erro 403 no console em toda vista; três violações `scrollable-region-focusable` em `payroll-lending-aging` a 390; axe 0 no resto.

## 3. O que existe hoje

| Peça | Onde | O que é | Destino |
|---|---|---|---|
| Casca HTML | `public/obs/index.html` | `<header class="bp">` e trilha gerados do registro (entre `<!-- barra-plataforma:inicio -->` e `:fim`); depois `div.shell` com `header.mobilebar` (botão de menu, "Crédito e sistema financeiro", link fixo "Setor Elétrico →"), `div.scrim`, `aside.sidebar` (`div.brand` com "◆ Crédito e sistema financeiro · monitoramento · diagnóstico · previsão", `nav.tabs` com 8 `div.navgroup` e 42 `<button data-view>`, `div.sidefoot` com data de atualização, recolher barra, alternar tema, admin, entrar, conta, sair), `div.content > main#main` com 35 `section.view` | barra lateral, barra de celular, marca e rodapé da barra saem; a navegação passa a ser a da plataforma (4.1) |
| Roteamento | `public/obs/app.js`: `ROUTES` (vista → caminho, linha 49), `VIEW_TITLES` (linha 12701), `BASE = "/observatorio"`, `history.pushState`/`replaceState`, `popstate`, `showViewSilent`, despacho `RENDER[v]` por nome, `ensureChunk` | `<button data-view>` → `<a href>` com interceptação do clique (4.1) |
| Cabeçalho de página | `pageHead(o)` (`app.js`, linha 3143): título, lead, "Dados até …" com a data no formato `AAAA-MM`, "processado em" com `AAAA-MM-DD HH:MM UTC`, fontes, menu "ações ▾" (`div.ph-actions`) | vira a abertura da plataforma (4.3) |
| Números | blocos `class="card"` (483 ocorrências) e faixa de números ("faixa dividida, sem cartão nem sombra", `credito-molde-abertura.test.ts`), valor em sans negrito, sem selo de natureza; classes `down good` (39) e `up good` (1) | forma do `NumeroIndicador` (4.4) |
| Tipografia | `public/obs/styles.css` (94 KB): escala própria `--fs-2xs` 0,75 rem, `--fs-xs` 0,75 rem, `--fs-sm` 13 px, `--fs-base` 14 px, `--fs-md` 15 px, `--fs-lg` 17 px, `--fs-xl` 20 px, `--fs-2xl` 24 px, `--fs-3xl` 30 px, `--fs-4xl` 34 px, `--fs-5xl` 42 px, mais 13,5 px e 12 px soltos | mapeada à escala única (4.4) |
| Tokens | `public/obs/tokens.css` (gerado de `globals.css`); 42 tokens `--cor-credito-*` em `src/app/globals.css`, 30 deles `--cor-credito-escuro-*` (tema escuro) e `positivo`/`negativo` (cor de julgamento) | reconciliados (4.4 e 4.5) |
| Tema escuro | `#themeToggle` no `sidefoot`, `data-theme="dark"` em `styles.css` (8 regras), `prefers-color-scheme: dark` em `app.js` | decisão do dono (seção 8) |
| Servidor | `src/app/observatorio/[[...rota]]/route.ts` → `src/lib/observatorioHead.ts`: `resolverMeta(caminho)` e `montarHtml(meta)`, que troca `<title>`, descrição, canônico e, entre os marcadores, injeta `htmlBarraSpa(caminho)` com a barra e a trilha da rota pedida | ganha `htmlNavegacaoSpa` e `htmlFimSpa` (4.1 e 4.6) |
| Gerador da barra | `src/lib/observatorios/barraSpa.ts`: `htmlBarraSpa`, `htmlTrilhaSpa`, `indiceTrilhaSpa`, `colecaoDaRotaSpa(caminho)` | modelo dos geradores novos |
| Catálogo de vistas | `src/lib/data/observatorioAbas.ts` (49 rotas com título, descrição e gold); `src/lib/observatorios/registro.ts`: `DESTINO_ABAS_CREDITO` (cada aba → observatório e coleção donos), `ABAS_INSTITUCIONAIS_CREDITO` | fonte da navegação por coleção |
| Navegações das cinco coleções | `src/lib/observatorios/navegacaoColecao.ts`: `credito` (Início `/observatorio-do-credito`, Quanto meu banco cobra?, Simulador da parcela, Juros por instituição, Painel completo), `divida` (Início `/observatorio/payroll-lending-aging`, Quanto meu banco cobra?, depois as vistas de Famílias), `divida-governos` (Início `/observatorio/subnational-credit`, Dívida com a União), `pagamentos` (Início `/observatorio/pix`, Open Finance), `empresas` (Início `/observatorio/sectors`, Recuperações e falências) | lidas pelo gerador; a de `credito` ganha os grupos (4.1) |
| Páginas Next do Crédito | `src/lib/credito/navegacao.ts` (`PAGINAS_CREDITO`: `quanto-meu-banco-cobra`, `simulador-da-parcela`, `metodologia`; `PAINEL_JUROS`, `METODO_SPA`), `src/components/credito/` (`Blocos`, `FaixaDistribuicao`, `SeletorJuros`, `SimuladorParcela`), `src/app/observatorio-do-credito/*` | modelo da etapa 2 |
| Ferramentas da conta | `src/components/conta/FerramentasConta.tsx` (React, só nas páginas Next): recortes via `POST /api/conta/recortes` `{ titulo, caminho, observatorio }`, citação via `GET /api/conta/citacao?dominios=`, alertas via `GET/POST/DELETE /api/conta/alertas` | a aplicação ganha a versão em JavaScript puro (4.7) |
| Sessão e admin na aplicação | `app.js` consulta `/api/auth/eu` (204 com sessão) para a conta da barra e `/api/admin/eu` para mostrar o botão de admin; `/api/admin/eu` responde 403 a quem não é admin por desenho (`src/app/api/admin/eu/route.ts`): é o erro 403 do console em toda vista | a chamada a `/api/admin/eu` sai com o `sidefoot` (4.8) |
| Telemetria | `app.js` envia `sendBeacon("/api/telemetria", { secao: "obs:…" })` (prefixos `obs:` e `credito:` em `dominios.ts`); a medição agregada `uso_paginas_dia` não cobre a aplicação (`MEDICAO_DE_USO.md`, seção 4; `src/lib/uso/rotas.ts` só aceita rotas de `src/app`) | medição agregada por vista (4.9) |
| Bundles | `scripts/minify-obs.mjs`: core `app.min.js` (até 580 KB, `split-bundle.test.ts`) e chunks `emergentes` e `municipal` por regiões marcadas no `app.js`; `atlas.js`, `editorial.js`, `embed.html` | inalterados, salvo a versão |

Testes que travam a aplicação hoje (não quebrar; os que mudam de propósito estão na seção 6): `cabecalho-movel` (barra da SPA igual ao registro; conta da barra segue a sessão), `observatorio-publico` (catálogo ↔ `ROUTES` e `VIEW_TITLES`; rotas dinâmicas com prefixo; Entrar ao visitante), `mapa-menu` (oito grupos na ordem da jornada, cada aba em um grupo, rótulos iguais a `VIEW_TITLES`, grupos com até 7 abas), `guia-navegacao` (busca da plataforma na barra; grupos colapsam e o grupo da página ativa abre), `links-abas-credito`, `credito-molde-abertura`, `kit-padronizado` (exportação e dicas), `avaliacao-set26` (versão dos ativos; `pageHead` recolhe as ações num menu), `split-bundle`, `design-tokens` (escopo inclui `public/obs/styles.css` e `atlas.css`), `wcag-contraste`, `embed-permalink`, `citacao-incorporacao`, `ux-texto-minimo` (`/observatorio/map` e `/observatorio/interest-rates`), `busca-barra-browser`, `vocabulario`, `entrada-molde` (exclui `/observatorio/*` até a etapa 2), `ux-orcamentos-cromo` (exclui as quatro coleções da aplicação até a etapa 1), `uso-paginas`.

## 4. Etapa 1: paridade de casca

### 4.1 Navegação

1. `src/lib/observatorios/barraSpa.ts` ganha `htmlNavegacaoSpa(caminho)`: o mesmo HTML que `NavegacaoColecaoCliente` renderiza no servidor (`src/components/layout/NavegacaoColecaoCliente.tsx`; usar `renderToStaticMarkup` no gerador, como o resto da barra), para a coleção dona do caminho (`colecaoDaRotaSpa` e `DESTINO_ABAS_CREDITO`): a vista `/observatorio/payroll-lending-aging` recebe a navegação de "Dívida e crédito das famílias", `/observatorio/pix` a de "Pagamentos", e assim por diante. `montarHtml` injeta o resultado logo abaixo da trilha, entre marcadores novos (`<!-- navegacao-colecao:inicio -->` e `:fim`), por rota, como já faz com a barra.
2. A navegação da coleção `credito` em `navegacaoColecao.ts` passa a ter grupos: linha 1 com "Início" (`/observatorio-do-credito`), a consulta "Quanto meu banco cobra?", e os sete grupos da aplicação como itens com subpáginas ("Começar", "Ciclo do crédito", "Instituições e funding", "Produtos e preços", "Território e pessoas", "Risco, cobrança e recuperação", "Pagamentos, conduta e fronteiras"); "Referência" vira atalhos: Método (`/observatorio/methodology`) e Glossário (`/glossario`); "Sobre" (`/observatorio/about`) vai para o fim de página. São 9 itens: o nono vai para "Mais", como a regra da plataforma manda (`MAX_A_VISTA = 8`), ou "Simulador da parcela" entra no grupo "Produtos e preços" para caber 8. As vistas que pertencem a outras coleções (as de `DESTINO_ABAS_CREDITO` fora de `ECO_CREDITO`) não aparecem nos grupos do Crédito: ficam só na navegação da coleção dona. Linha 2: as vistas do grupo atual. `mapa-menu.test.ts` passa a ler os grupos daqui (seção 6).
3. Cada vista é `<a href="/observatorio/<caminho>">`. `app.js` intercepta o clique nos links da navegação (delegação em `document`, só para `href` que começa por `BASE`, sem tecla modificadora e botão principal), chama o roteador interno (`showView` com `pushState`) e deixa o `popstate` como está; sem JavaScript, o link abre a vista pelo servidor (o route handler já serve qualquer caminho). O atual leva `aria-current="page"` e o filete, como na plataforma; ao trocar de vista, `app.js` atualiza o atual na navegação (uma função `marcarAtual(caminho)` que faz o que `destinoAtual` de `navegacaoPura.ts` faz, com a lista embutida no HTML num `<script type="application/json" id="navColecaoIndice">`, como a trilha já faz com `obsTrilhaIndice`).
4. `aside.sidebar`, `header.mobilebar`, `div.scrim`, `div.brand`, `div.sidefoot`, `#sbToggle`, `#menuBtn` e o link fixo "Setor Elétrico →" saem do `index.html` e do `app.js`; `main#main` passa a ocupar a largura da página (`max-w-page`, margens `px-6`), sem coluna lateral. No celular, as duas linhas da navegação rolam só nelas mesmas, com o atual à vista (o CSS `nav-colecao-*` de `public/observatorios.css` já faz isso; a aplicação já carrega esse arquivo).

### 4.2 Marca, contexto e frase de posse

- A frase "Este painel faz parte do Observatório X; quem o mantém é a coleção Crédito e sistema financeiro" sai; o `RotuloContexto` da plataforma ("Observatório das Famílias · Dívida e crédito das famílias · Consignado e aposentados") passa a ser gerado no servidor por rota (`htmlRotuloSpa(caminho)` em `barraSpa.ts`, lendo `contextoDaRota`) e injetado acima do H1 pelo `pageHead`.
- A marca "◆ Crédito e sistema financeiro · monitoramento · diagnóstico · previsão" sai: a plataforma tem uma marca, na barra.
- "Mapa do Observatório" (vista `mapa`) passa a se chamar "Início" na navegação e no `VIEW_TITLES` (decisão da seção 8; o catálogo e os testes acompanham).

### 4.3 Abertura da página

`pageHead(o)` passa a desenhar a abertura da plataforma, na mesma ordem e com as mesmas classes de `AberturaPainel` (Iniciativa I1; se o kit já existir, copiar o HTML dele; se não, o de `CabecalhoModulo` do Setor Elétrico com `lead`): rótulo de contexto, H1 em `.t-h1`, lead em `.t-lead`, linha de recorte em `.t-meta` com "período · universo · unidade · fonte curta", limite "Não permite concluir: …" (a caixa de leitura que `credito-molde-abertura` já exige, na forma da plataforma), e as ações da página (menu "ações ▾") no mesmo lugar e com a mesma forma do menu "Mais" da navegação. "Dados até" com `AAAA-MM` vira "Dados até" com `mmm/aaaa`; "processado em" com `AAAA-MM-DD HH:MM UTC` sai da abertura e vai para "Fontes, datas e siglas" recolhido, como "processado em dd/mm/aaaa às HH:MM (horário de Brasília)". Setas "→" e travessões saem da prosa dos leads (ex.: "oferta → preço → qualidade → composição" vira "oferta, preço, qualidade e composição").

### 4.4 Tipografia, números e cores

1. `styles.css`: a escala `--fs-*` é substituída pelas classes `.t-h1`, `.t-h2`, `.t-h3`, `.t-lead`, `.t-corpo`, `.t-tabela`, `.t-meta` e `.rotulo` de `globals.css` (copiadas para `tokens.css` pelo gerador, para a aplicação não carregar o CSS do Next); nenhum `font-size` em pixel fora da escala; os 13,5 px e 12 px soltos saem. Mapa de migração: `--fs-2xs`/`--fs-xs` → `.t-meta` (13 px; nada abaixo de 12 px), `--fs-sm`/`--fs-base` → `.t-corpo` ou `.t-tabela`, `--fs-md`/`--fs-lg` → `.t-lead`, `--fs-xl`/`--fs-2xl` → `.t-h3`, `--fs-3xl`/`--fs-4xl` → `.t-h2`, `--fs-5xl` → `.t-h1`.
2. Números: a faixa de números e os blocos de KPI passam à forma do `NumeroIndicador` (valor em serifa com `.numero-g`/`.numero-m`/`.numero-p` e algarismos tabulares, unidade em `.t-meta`, linha "recorte · período · selo de natureza", variação em palavras com a base, fonte). O selo de natureza usa os glifos e os textos de `SeloNatureza` (observado ●, calculado ◆, estimado ◐, previsto ◌, cenário ◇): toda série do BCB é "observado"; projeções e bandas são "previsto"; índices e transformações da aplicação (IBCC, diagnóstico) são "calculado". As classes `down good` e `up good` saem: a direção é dita em palavras ("alta", "queda"), sem cor de julgamento; `positivo`/`negativo` ficam só onde o sinal aritmético importa (saldo negativo), com o token `--cor-negativo` da plataforma.
3. Tokens: os 42 `--cor-credito-*` de `globals.css` são reconciliados com a paleta: eixo e grade de gráfico → `--cor-linha` e `--cor-mineral`; alerta → `--cor-aviso`; séries → `--serie-*`; "pix" e "teal" → um `--serie-*` fixo; `positivo`/`negativo` → sem cor ou `--cor-negativo`; `previsao` → o tracejado do design system com `--cor-contexto` de fundo. O que sobrar sem equivalente vira token da plataforma com nome de papel, nunca de domínio. `design-tokens.test.ts` passa a reprovar `--cor-credito-*`.
4. Tabelas: cabeçalho semântico, números à direita com algarismos tabulares, sem zebra, rolagem só na tabela no celular (`scrollable-region-focusable`: toda região rolável com `tabindex="0"` e nome acessível).

### 4.5 Tema escuro

Decisão do dono (seção 8). Padrão deste prompt: o alternador sai, com os 30 tokens `--cor-credito-escuro-*` e as regras `data-theme="dark"`, porque a barra, a trilha, a navegação e o fim de página da plataforma não têm tema escuro e a página ficaria metade clara, metade escura. Se o dono mantiver o tema, ele passa a ser da plataforma inteira (fora deste prompt), nunca só da aplicação.

### 4.6 Fim de página

`htmlFimSpa(caminho)` em `barraSpa.ts` gera, por rota, o mesmo HTML de `ParaIrAlem` (`src/lib/observatorios/mapaParaIrAlem.ts`), `RodapeColecao` (fontes e data, Início, Método, Glossário; sem parceria) e `Footer` da plataforma, injetado por `montarHtml` no fim de `main#main` entre marcadores. "Sobre" (`/observatorio/about`) e "Sugestões" (`/suggestions`) viram links desse fim de página. Quando a Iniciativa I4 fundir os blocos de fim de página, o gerador acompanha.

### 4.7 Ferramentas da conta

`public/obs/ferramentas-conta.js` (JavaScript puro, carregado por `index.html`): "Salvar recorte", "Citar" e "Avisar quando atualizar" na barra, com o mesmo HTML, as mesmas classes (`bp-ferramentas`, `bp-ferramentas-menu`) e os mesmos endpoints de `FerramentasConta.tsx`: recortes `POST /api/conta/recortes` com `{ titulo: VIEW_TITLES[v], caminho: location.pathname + location.search, observatorio: "<coleção dona>" }`; citação `GET /api/conta/citacao?dominios=credito` (o pacote vem pronto do servidor; a aplicação só mostra e copia); alertas `GET/POST/DELETE /api/conta/alertas` com `dominio: "credito"`. Só com sessão (`/api/auth/eu` 204); sem sessão, nada é desenhado. No celular, as ferramentas e a conta no botão "Conta ▾" da linha da marca, como nas páginas Next (o CSS já existe em `observatorios.css`). Os testes de `conta-ferramentas.test.ts` continuam valendo para a API; um teste novo confere que a aplicação chama os mesmos endereços e payloads (seção 6).

### 4.8 Correções

- O erro 403 do console: a chamada a `/api/admin/eu` sai com o `sidefoot` (o link de administração vive na navegação da conta, `/app/*`).
- `scrollable-region-focusable` a 390 px (três nós em `payroll-lending-aging`): toda região rolável com `tabindex="0"` e `aria-label`.
- Cromo a 390 px: com a barra de celular e a barra lateral fora, medir com `scripts/ux-cromo-medida.mjs` e levar a até 200 px; a 1440, até 230.
- `/observatorio/about` e `/observatorio/suggestions` continuam existindo (catálogo), só saem da navegação.

### 4.9 Medição de uso

`index.html` ganha o envio de `MedeUso` em JavaScript puro: a cada vista mostrada (inclusive a primeira), `sendBeacon("/api/uso", { rota: location.pathname })`, respeitando DNT e GPC como `src/lib/uso/sinais.ts`. `src/lib/uso/rotas.ts` passa a aceitar as 49 rotas de `ABAS_OBSERVATORIO` como modelos (`/observatorio/<caminho>`, mais os prefixos dinâmicos `/observatorio/institutions/[cod]`, `/sectors/[slug]`, `/products/[slug]`), atribuídas ao observatório dono por `donoDaRota`; `rotas-do-app.json` não muda (é gerado de `src/app`); a lista extra vive em código, lida do catálogo. `MEDICAO_DE_USO.md`, seção 4, é atualizado. Com a medição, a etapa 2 ganha a ordem por uso.

## 5. Etapa 2: migração para Next

Depende da Iniciativa I1 (kit `src/components/painel/`) e da etapa 1.

1. **As quatro entradas de coleção** servidas pela aplicação viram páginas Next no molde `EntradaColecao` (`tipo="colecao"`): `/observatorio/payroll-lending-aging` (Dívida e crédito das famílias), `/observatorio/subnational-credit` (Dívida e crédito dos governos), `/observatorio/pix` (Pagamentos), `/observatorio/sectors` (Empresas e risco). Mesmo endereço: uma pasta `src/app/observatorio/<caminho>/page.tsx` tem precedência sobre o `[[...rota]]` do route handler. Cada entrada lê a gold da vista (`public/obs/data/gold/<arquivo>.json`, o campo `gold` de `observatorioAbas.ts`) no servidor, com os mesmos números da vista de hoje (teste de igualdade número a número entre a página Next e o JSON). As fatias: abertura, escala com 1 a 4 números com fonte e período, "Para você" (`paraVoce.ts` já tem as perguntas de Famílias e Economia), destinos (as vistas da coleção, lidas de `navegacaoDaColecao`), modelo didático (o `CircuitoCredito` das entradas da Economia pode ser reaproveitado para a dívida das famílias com o recorte certo; sem modelo honesto, o teste do molde exige um: construir um com os dados da gold, nunca ilustrativo sem dado), perguntas para começar, método recolhido.
2. **As cinco vistas mais usadas** viram `PaginaPainel`: pela medição da etapa 1 (30 dias) ou, sem medida, as cinco que o bloco "Para você", as portas abertas e a navegação apontam: `/observatorio/credit` (Pulso do crédito), `/observatorio/interest-rates` (Juros por instituição), `/observatorio/institutions`, `/observatorio/overview`, `/observatorio/map` (Início). Cada uma com os gráficos do kit (os cinco da família `Grafico*`), tabela equivalente, `FiguraAnalitica` com "não permite concluir" e proveniência (os textos "Limites da leitura" e "Como ler e por que acompanhar" que a aplicação já tem são o material), números com `SeloNatureza`, controles com estado na URL (`?sec=`, `?uf=`, `?cod=` que a aplicação já usa) e download por `ExportacaoComConta`.
3. A aplicação continua servindo o restante das vistas, com a casca da etapa 1; as vistas migradas saem de `ROUTES`, de `VIEW_TITLES`, dos grupos e do catálogo da aplicação e entram em `PAGINAS_CREDITO` (`src/lib/credito/navegacao.ts`) e no registro como páginas Next; `links-abas-credito` e `observatorio-publico` acompanham.
4. Ordem dentro da etapa: as quatro entradas primeiro (fecham a exclusão em `entrada-molde.test.ts`), depois as vistas na ordem do uso.

## 6. Testes

### 6.1 Novos

- `src/tests/credito-casca.test.ts` (HTML do servidor, `montarHtml` para uma rota de cada coleção e, com build, `htmlDe` com sessão de `src/tests/suporte/servidor-producao.ts`): nenhum `class="sidebar"`, `mobilebar`, `scrim`, `sidefoot`, `brand`, `themeToggle`, `sbToggle` no HTML; nenhum `data-view` sem `href`; a navegação da coleção dona presente (`aria-label="Navegação da coleção <nome>"`) com os grupos certos e o atual marcado; `RotuloContexto` com o observatório e a coleção donos; fim de página com `ParaIrAlem`, `RodapeColecao` e `Footer`; nenhuma data ISO nem "UTC" em texto visível fora de "Fontes, datas e siglas"; nenhuma classe `good`/`bad`; nenhum `--cor-credito-*` em `styles.css`, `atlas.css` e `tokens.css`; nenhum `font-size` em pixel fora da escala; toda região rolável com `tabindex`.
- `src/tests/credito-ferramentas-spa.test.ts`: `ferramentas-conta.js` chama `/api/conta/recortes`, `/api/conta/citacao?dominios=credito` e `/api/conta/alertas` com os mesmos payloads de `FerramentasConta.tsx` (teste de código, por regex, como os demais testes da aplicação).
- `src/tests/uso-paginas.test.ts`: as rotas da aplicação são aceitas e atribuídas ao observatório dono; `/observatorio/institutions/12345` conta no modelo `/observatorio/institutions/[cod]`.
- Etapa 2: `entrada-molde.test.ts` com as quatro entradas em `NO_MOLDE`; `painel-molde.test.ts` com as cinco vistas; teste de igualdade número a número entre cada página Next e a gold.

### 6.2 Que mudam de propósito

- `mapa-menu.test.ts`: "oito grupos" passa a ler os grupos da navegação de `navegacaoDaColecao("credito")`, com "Referência" fora (virou atalhos) e "Simulador da parcela" onde a seção 4.1 decidir; "cada aba estática em exatamente um grupo" continua, contando também as navegações das outras quatro coleções.
- `guia-navegacao.test.ts`: "grupos colapsam e o grupo da página ativa abre" vira "a linha 2 mostra as vistas do grupo atual".
- `cabecalho-movel.test.ts`, caso da SPA: acrescenta a navegação da coleção e a ausência da barra lateral.
- `observatorio-publico.test.ts`: "a SPA oferece Entrar ao visitante e conta/sair só a quem tem sessão" passa a conferir na barra (o `sidefoot` saiu); "Mapa do Observatório" vira "Início" no catálogo.
- `avaliacao-set26.test.ts`: "pageHead recolhe as ações num menu" continua, com a forma nova; "a carta 'comece por aqui' só aparece na primeira visita" continua.
- `credito-molde-abertura.test.ts`: a faixa de números passa à forma do `NumeroIndicador` (serifa, selo, período, fonte).
- `ux-orcamentos-cromo.test.ts`: `/observatorio/credit` e `/observatorio/payroll-lending-aging` entram em `ENTRADAS`/`OUTRAS`; `ux-texto-minimo` continua com as suas rotas.
- `design-tokens.test.ts`: `--cor-credito-*` proibido depois do PR de tokens.
- `split-bundle.test.ts`: o teto do core (580 KB) continua; o que sair da barra lateral compensa o que entrar da navegação.

## 7. Critério de aceite

| Medida | Exigido | Como medir |
|---|---|---|
| Uma só navegação na tela | sim, a da coleção dona; nenhuma barra lateral, barra de celular ou marca própria | `credito-casca.test.ts`, capturas |
| Cromo | até 200 px a 390 e 230 a 1440 em `/observatorio/credit`, `/payroll-lending-aging`, `/pix`, `/sectors`, `/subnational-credit` | `npm run evidencias` |
| Console | 0 erros | idem |
| Axe (WCAG 2.1 A e AA) | 0 a 1440 e 390 | idem |
| Datas | `dd/mm/aaaa` e `mmm/aaaa`; nenhum "UTC" fora do bloco recolhido | teste |
| Números | serifa, selo de natureza, período, fonte, variação em palavras; nenhuma classe `good`/`bad` | teste e capturas |
| Tipografia e tokens | nenhum `font-size` em pixel fora da escala; nenhum `--cor-credito-*` | `design-tokens` |
| Ferramentas da conta | as três na barra, só com sessão, mesmos endpoints | teste e conferência manual |
| Medição | vistas da aplicação na tabela `uso_paginas_dia` com o observatório dono | `uso-paginas.test.ts` e painel `/app/admin` |
| Versão | `APP_VERSION` e `?v=` novos a cada PR; `app.min.js` regenerado por `npm run preparar` | `avaliacao-set26`, `split-bundle` |
| Leitor vindo de Famílias | em `/observatorio/payroll-lending-aging`, trilha, seletor, rótulo e navegação dizem Famílias e Dívida e crédito das famílias | captura e teste |
| Rubrica da skill (seção 10) | nota mínima 8 em cada critério nas cinco rotas acima, por revisão independente (outra sessão), registrada em `docs/ux-AAAA-MM-DD/credito/revisao-independente.md` | revisão |
| Etapa 2 | as quatro entradas em `NO_MOLDE`; as cinco vistas em `NO_MOLDE_PAINEL`; números iguais aos da gold | testes |

## 8. Decisões já tomadas e decisões pendentes

Já decididas (não reabrir): a aplicação continua existindo até a migração completa (Onda 3 da banca); a barra comum e a trilha vêm do registro; as cinco coleções e os donos de cada vista (`DESTINO_ABAS_CREDITO`, 18/10/2026); a busca é a da plataforma; o menu interno em oito grupos (decisão de 18/10/2026, que esta iniciativa preserva como grupos da navegação); `/observatorio-do-credito` não muda; nada de cor como julgamento.

Pendentes (seção 8 do parecer, item 10, e decisões próprias desta iniciativa):

1. **Tema escuro da aplicação**: retirar (padrão deste prompt) ou levar à plataforma inteira (fora deste prompt).
2. **"Mapa do Observatório" vira "Início"**: padrão deste prompt é sim.
3. **Onde fica "Simulador da parcela"**: em "Mais" ou dentro de "Produtos e preços" (padrão: "Produtos e preços", para a linha 1 caber em 8).
4. **Medição de uso da aplicação sem conta**: só com conta, como o resto (`USO_ANONIMO_ATIVO` continua valendo); nada a decidir aqui.
5. **As cinco vistas da etapa 2**: pela medição de 30 dias ou pela lista padrão da seção 5.

## 9. Plano de PRs

| PR | Nome | Conteúdo |
|---|---|---|
| 1 | Crédito 1: navegação e casca | `htmlNavegacaoSpa`, `htmlRotuloSpa`, `htmlFimSpa` e marcadores; grupos na navegação de `credito`; links no lugar dos botões com a interceptação; barra lateral, barra de celular, marca e `sidefoot` fora; correção do 403 e das regiões roláveis; cromo medido; `credito-casca.test.ts`; testes que mudam de propósito; versão nova; evidências |
| 2 | Crédito 2: tipografia, números, datas e tokens | escala única, `NumeroIndicador`, selos de natureza, datas em português, `good`/`bad` fora, tokens reconciliados, tema escuro conforme a decisão 1; `design-tokens` e `credito-molde-abertura` ajustados; revisão independente da rubrica |
| 3 | Crédito 3: ferramentas da conta e medição | `ferramentas-conta.js`, `MedeUso` na aplicação, rotas da aplicação em `uso/rotas.ts`, `MEDICAO_DE_USO.md` |
| 4 | Crédito 4: as quatro entradas em Next | etapa 2, item 1; `entrada-molde` com as quatro |
| 5 em diante | Crédito 5+: uma vista por PR | etapa 2, item 2, na ordem do uso |

## 10. O que não fazer

- Não migrar vista nenhuma na etapa 1; não reescrever gráficos da aplicação (ficam como estão até a etapa 2).
- Não editar `app.min.js`, os chunks, `tokens.css` nem a barra dentro de `index.html` à mão.
- Não abrir rota, não mexer em `rotasPublicas.ts`, não tocar na política de acesso.
- Não criar segunda navegação, segunda marca, segundo rodapé ou segundo conjunto de ferramentas: tudo vem dos geradores a partir do registro.
- Não instalar framework ou biblioteca na aplicação (continua JavaScript puro até a migração).
- Não mudar número, série, cálculo, IBCC, diagnóstico, cenário ou texto decidido pelo dono.
- Não incluir melhorias "de carona" fora da casca; não abrir mais de um PR por vez.

## 11. Como relatar

Descrição de cada PR, nesta ordem: o que muda para o leitor (duas frases); tabela de aceite da seção 7 preenchida; medidas antes e depois (cromo a 390 e 1440, erros de console, violações axe, tamanho do core, número de `font-size` fora da escala, número de tokens `--cor-credito-*`); testes novos e os que mudaram de propósito, com o motivo; riscos (interceptação de clique na navegação; regeneração dos bundles; cache dos ativos com `?v=`); pendências reais; "Merge só com autorização explícita do dono". Capturas antes e depois em `docs/ux-AAAA-MM-DD/credito/` com `evidencias.md` e, no PR 2, `revisao-independente.md`.

Ao fim de cada PR, uma mensagem de uma tela para o dono, que lê pelo celular: o que o leitor ganha, os links das cinco rotas no preview da Vercel (com conta), o estado real (PR aberto, CI verde ou vermelho, o que falta) e, se houver, a decisão pendente em uma linha.
