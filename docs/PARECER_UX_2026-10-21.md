# Parecer sobre a organização da Scrutiniums: fluidez, localização da informação e padronização

Data: 21/10/2026 · Base: commit `807870cc8` do `main` · Critérios: `.claude/skills/observatorio-layout/SKILL.md` (prevalece), `impeccable`, `emil-design-eng` e `design-taste-frontend` · Pedido do dono: avaliar a fluidez e a experiência de quem procura informação, definir critérios e priorizar as dez iniciativas que mais melhoram a experiência, com detalhe suficiente para outro modelo implantar.

Este documento é orientado à ação. Cada iniciativa traz objetivo, evidência, o que fazer passo a passo, arquivos envolvidos, o que não mudar, critério de aceite e testes. O modelo que implantar deve ler este parecer inteiro, a skill `observatorio-layout` inteira e o `CLAUDE.md` antes de começar, e conferir cada afirmação contra o código, não contra a descrição.

## 1. Como o parecer foi feito

**Evidência usada**

- Código do repositório no commit `807870cc8` (21/10/2026): 364 rotas `page.tsx` (270 em português, 94 em inglês), 14 componentes `Cabecalho*`, 355 arquivos de teste, a aplicação de página única do Crédito (`public/obs/app.js`, 1,27 MB; `app.min.js`, 573 KB).
- O aplicativo executado localmente (`next dev`, banco PGlite em memória, Twilio em modo simulado) e medido com Playwright a 1440 e 390 px, sem sessão em 15 rotas abertas e com sessão de desenvolvimento em 22 rotas com conta. As medidas são do DOM renderizado: altura total, linhas do H1, textos abaixo de 12 px, elementos além da largura da tela, imagens quebradas, quantidade de links e de regiões `nav`. Script em `scripts/ux-medidas.mjs`; capturas reduzidas em `docs/ux-2026-10-21/`.
- Três varreduras de código feitas por agentes de leitura (inventário de componentes por papel, inventário de imagens e identidade, auditoria das entradas pela checklist da seção 4 da skill), conferidas por amostragem.
- Os documentos anteriores: `docs/BANCA_2026-10-19.md`, `docs/REVISAO_ABERTO_2026-10-20.md`, `docs/observatorios/AVALIACAO_PAGINAS.md`, `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`, `docs/observatorios/REAGRUPAMENTO.md`, `AUDITORIA_PROJETO.md`.

**Limites**

- Produção não foi acessada. Tudo sobre produção é inferência a partir do `main`.
- Os scripts das skills `impeccable` e `design-taste-frontend` não existem neste ambiente (as skills estão versionadas sem eles, conforme o `ORIGEM.md` de cada uma); valeu o caminho previsto nas próprias skills: contexto lido do projeto e crítica sobre capturas.
- Não foram testados leitor de tela, zoom de 200 % nem navegação completa por teclado. Não há dado de uso de visitantes sem conta (`docs/observatorios/MEDICAO_DE_USO.md`); a prioridade abaixo é por critério, não por uso medido.
- Duas rotas só renderizaram depois de rodar os scripts de `predev` (`/eficiencia-estatal` com sessão e a aplicação do Crédito). Não é defeito da plataforma; é dependência de build que o implantador precisa conhecer.

Legenda nas seções seguintes: **E** evidência verificada (código, captura ou medida), **I** inferência, **R** recomendação.

## 2. Veredito em uma página

**O que já está bom.** A barra superior comum existe e aparece em todos os observatórios e painéis, inclusive na aplicação do Crédito (achado A7 da banca, resolvido). Toda entrada tem a faixa "Atualização dos dados" na primeira tela. O bloco "Para você" é um componente único em 13 entradas. As páginas abertas da leva 1 e da leva 2 seguem um contrato testado (`aperitivo.test.ts`, `leva2.test.ts`). A linguagem editorial (serifa nos títulos, papel, número com fonte e período, "o que não permite concluir") é reconhecível e rara em dado público brasileiro.

**O que trava a fluidez.** Quem procura uma informação enfrenta quatro atritos, nesta ordem de gravidade:

1. **Duas taxonomias competem em toda tela (E).** O registro novo tem seis observatórios e 28 coleções (`src/lib/observatorios/lista.ts`). O registro antigo tem oito "Observatórios Brasileiros de X" (`src/lib/dominios.ts`). O rodapé lista os dois; o seletor "Setor Elétrico ▾" mostra só os oito antigos (Combustíveis, Conectividade, Custo de vida e Educação nos municípios não aparecem nele; Famílias e Território e Clima aparecem sem coleção); as entradas se apresentam como "Observatório Brasileiro do Saneamento" embora sejam coleções; a trilha começa com três nomes diferentes de raiz. O leitor nunca sabe em que nível está.
2. **Não existe busca na plataforma (E).** Há cinco buscas locais que não se falam: o filtro "Encontre o painel enquanto digita" (só com conta, só em `/app/observatorios`), a busca do Setor Elétrico, a busca da barra lateral do Crédito, a busca de capítulos das Contas Federais e nove buscas de município. Quem está na home ou numa página aberta não tem como procurar "Ideb" ou "botijão".
3. **Dezesseis navegações de módulo diferentes abaixo da mesma barra (E).** Grupos com menus suspensos e faixa de páginas (Energia: quatro linhas de cabeçalho, 245 px antes do conteúdo), eixos A a E (Saneamento), duas linhas com rótulos em caixa alta (Gás), abas simples (Agro, Contas), âncoras (Estaduais), barra lateral com 8 grupos e 42 itens (Crédito) e nenhuma navegação (Conectividade, Território, Previdência). No celular, o Setor Elétrico empilha seis faixas (marca, idioma, ferramentas, Menu, parceria, frescor) antes do título. O mapa logado `/app/observatorios` usa um terceiro cabeçalho (`FocoHeader`), sem as abas dos observatórios.
4. **O mesmo componente existe em até vinte versões (E).** Cerca de 20 números de destaque, 14 molduras de figura, 16 tabelas, 18 classes de rótulo em nove tamanhos (9,9 a 14 px), 22 linhas de fonte, 11 estados de ausência, 7 glossários e 3 rodapés. Há pares com o mesmo nome e comportamento diferente (`Numero`, `TabelaDados`, `Indisponivel`, `SobreEsteDado`, `Termo`). Três coleções novas (Conectividade, Educação, Previdência) nasceram como cópias de CSS com prefixos `cn-`, `edm-` e `pv-`. Dezenove arquivos definem tokens de cor; o papel tem três valores, a tinta quatro, a linha três, o destaque três.

**Recomendação.** Dez iniciativas em três ondas (seção 6), nesta ordem de dependência: primeiro o vocabulário e a navegação (iniciativas 1 a 3), que mudam o que o leitor vê em toda página; depois o molde e o kit (4 a 7), que padronizam o que ele lê; por fim Crédito, imagens e celular (8 a 10), que fecham a identidade. Nenhuma URL muda, nenhum contrato de dado muda, o princípio do aperitivo e as decisões registradas do dono permanecem.

## 3. Critérios usados

A prioridade declarada do dono é clareza > narrativa > didatismo > credibilidade > quantidade de funcionalidades. Para "achar a informação" e "padronizar a experiência", o parecer usou oito critérios verificáveis, cada um com a medida adotada:

| Critério | Medida | Referência |
|---|---|---|
| Orientação | O leitor sabe em que observatório, coleção e página está, em qualquer tela, pela barra, pelo seletor e pela trilha; os três usam os mesmos nomes | Skill §4 "Navegação e acesso"; `impeccable` Operate: "patterns the visitor already knows" |
| Alcance | O destino mais procurado está a um clique da entrada e qualquer página da coleção a dois cliques; existe busca a partir de qualquer página | Skill §4, item 2 |
| Primeira tela | Pergunta em até duas linhas, uma frase, até quatro números com fonte e período, e o primeiro número visível sem rolar | Skill §4, item 1; `design-taste-frontend` "headlines: two lines or fewer" |
| Orçamento de cromo | Abaixo da barra comum, no máximo duas linhas de navegação no desktop e cerca de 110 px no celular antes do conteúdo | Inferido da rubrica de responsividade (skill §8) e das capturas |
| Consistência de componente | O mesmo papel (número, figura, tabela, fonte, estado, termo, trilha) tem um só componente, com variantes, e um só nome | Skill §9, item 4; `design-taste-frontend` app screens |
| Consistência de token | Uma única fonte de cor, tipo e espaçamento; nenhum hexadecimal solto; rótulo nunca abaixo de 12 px | Skill §3; `DESIGN_SYSTEM_OBSERVATORIOS.md` |
| Densidade e comprimento | Página de entrada até cerca de 6.000 px no desktop e 10.000 px no celular; o que passar disso é recolhido sem sair do HTML | Decisão da banca para a home (A9) estendida às entradas |
| Honestidade de estado | Ausência, estimativa, previsão, em preparação, piloto e "com conta" têm forma única e aparecem antes do clique | Skill §1 e §5 "Estados" |

## 4. Diagnóstico por eixo

### 4.1 Arquitetura e vocabulário

- **E.** `src/lib/observatorios/lista.ts` define seis observatórios e 28 coleções; `src/lib/dominios.ts` define oito domínios com `nome: "Observatório Brasileiro de Crédito"`, "Observatório Brasileiro do Setor Elétrico" etc. O `REAGRUPAMENTO.md` decidiu em 17/10/2026 que os antigos viram coleções "com o mesmo nome".
- **E.** `src/components/layout/Footer.tsx` tem uma coluna com os seis observatórios e, ao lado, sete colunas com os domínios antigos sob `aria-label="Observatório Brasileiro de Crédito"`, "…do Setor Elétrico", "…de Eficiência Estatal", "Contas Públicas", "…de Gás Natural", "Observatório do Agronegócio Brasileiro". As capturas de toda página listam dez regiões `nav`, sete delas do rodapé.
- **E.** `SwitcherObservatorio.tsx:43` e `barraSpa.ts` listam só os `DOMINIOS` sob cada observatório. Combustíveis, Conectividade, Custo de vida e Educação nos municípios não aparecem; Famílias e Território e Clima aparecem sem coleção.
- **E.** As entradas se chamam pelo nome antigo no rótulo acima do H1: `setor-eletrico/page.tsx:812` ("Observatório Brasileiro do Setor Elétrico"), `saneamento/page.tsx:63`, `gas-natural/page.tsx:106`, `agronegocio/layout.tsx:8`, `eficiencia-estatal/layout.tsx:9`, H1 de `observatorio-do-credito/page.tsx:226` e marca da barra lateral do Crédito (`public/obs/index.html:45,52`).
- **E.** Nomes divergentes para a mesma coisa: "Crédito" (dominios) e "Crédito e sistema financeiro" (lista); "Contas Públicas Federais" e "Contas Federais"; "Contas Públicas Estaduais" e "Contas Estaduais"; "Judiciário" (`opcoesObservatorios.ts:14`) e "Justiça" (lista); "Inflação por cidade" (`custo-de-vida/layout.tsx:10`) e "Custo de vida" (lista). O texto de abertura da home (`src/i18n/pt.ts:14`) nomeia domínios e omite Famílias e Território.
- **E.** Trilha: seis implementações (`EntradaObservatorio.tsx:80`, `PaginaPorta.tsx:43`, sete páginas do Território copiadas, `dados/[slug]`, `.edm-trilha`, `.cp-breadcrumb`, `.tr-breadcrumb`) com três raízes diferentes ("Observatórios", "Os seis observatórios", "Observatório dos Serviços Públicos") e rótulos `aria-label` diferentes ("Trilha", "Você está em", "Caminho da página"). A maioria das páginas de coleção não tem trilha.
- **I.** O leitor que entra por Famílias, abre "Custo de vida" e cai em "Inflação por cidade" sob o seletor "Observatórios ▾" perde a referência de onde está; quem passa do Agro ao Setor Elétrico lê dois vocabulários para a mesma estrutura.

### 4.2 Navegação de módulo e cabeçalho

- **E.** Treze componentes `Cabecalho*` de domínio envolvem `CabecalhoPlataforma` (bom), mas cada um desenha a própria navegação abaixo da barra: `CabecalhoEnergia` (seis grupos com menus suspensos, botão Menu, faixa de páginas do grupo, faixa de parceria), `saneamento/Cabecalho` (Início, eixos A a E, Comparar, atalhos à direita, 229 linhas), `CabecalhoGas` (duas linhas com rótulos de grupo em caixa alta), `NavegacaoAgro` (abas com menus), `cp-local` (abas), `ce-nav` (âncoras), `NavegacaoTemaObee`, `NavegacaoPainel`, `NavegacaoJudiciario`, `NavegacaoTrabalho`, `NavegacaoSaude`, quatro faixas copiadas (`CabecalhoCredito`, `CabecalhoCustoDeVida`, `CabecalhoCombustiveis`, `CabecalhoEducacao`, mesmo markup `-mx-1 flex gap-x-1 overflow-x-auto py-1`), barra lateral da aplicação do Crédito. Conectividade, Território e Previdência não têm navegação de módulo.
- **E.** O mapa logado `/app/observatorios`, a conta e o admin usam `FocoHeader` (`src/app/app/(foco)/layout.tsx`): marca, "Observatórios ▾", Conta, Sair; sem as abas dos seis observatórios. É a única superfície com conta em que a barra comum não aparece.
- **E.** Medido a 1440 px: o Setor Elétrico tem quatro faixas abaixo da barra (grupos, páginas do grupo com parceria, frescor) e o H1 começa perto de 330 px; o Saneamento tem três; o Gás, três (duas de navegação e uma de parceria). A 390 px, o Setor Elétrico empilha marca, idioma, ferramentas da conta, Menu, parceria e frescor: o H1 começa perto de 415 px (captura `docs/ux-2026-10-21/setor-eletrico-390.jpg`); o Saneamento, perto de 370 px.
- **E.** Os rótulos `aria-label` das navegações variam: "Navegação do Observatório do Setor Elétrico", "Navegação do Observatório do Saneamento", "Navegação da coleção Combustíveis", "Navegação da coleção Educação", "Painéis de Trabalho e Renda", "Visões do módulo Saúde nas capitais", "Contas Públicas", "Navegação principal" (Crédito).
- **E.** As ferramentas da conta ("Salvar recorte · Citar · Avisar quando atualizar", `FerramentasConta.tsx`) existem em todo painel Next e não existem na aplicação do Crédito (comentário no próprio componente).
- **E.** O destino mais procurado não é o primeiro item em três coleções: Conta de luz está no quarto grupo da Energia; Meu município é atalho à direita no Saneamento; Gás de cozinha é o quinto item do Gás (auditoria das entradas).
- **E.** `ParaIrAlem` devolve `null` até montar no cliente (`ParaIrAlem.tsx:32-35`): o bloco "Para ir além" não existe no HTML do servidor, nem para quem navega sem JavaScript, nem para rastreadores.

### 4.3 Busca

- **E.** Não há campo de busca na barra comum, na home nem nas páginas abertas. O `DiretorioPaineis` (`/app/observatorios`) filtra 28 coleções e 123 páginas enquanto digita, só com conta. `BuscaObservatorio` (Energia) busca só dentro do Setor Elétrico. A aplicação do Crédito tem "buscar página…" na barra lateral. `IndiceFederal` busca capítulos das Contas. Para município, há uma base compartilhada (`saneamento/BuscaMunicipio.tsx`, usada por Território, Conectividade, Educação e Previdência) e oito implementações independentes (duas na Conta de luz e na Qualidade da Energia, três em mapas da Energia, Segurança alimentar, Mobilidade, Trabalho e renda).
- **I.** A página "Encontre o painel enquanto digita" é a melhor peça de localização da plataforma e está escondida atrás do login e de um caminho de dois cliques ("Observatórios ▾ → Escolher na minha conta").

### 4.4 Páginas de entrada

- **E.** Só `/observatorios/[id]` usa o molde compartilhado `EntradaObservatorio`. `/territorio` o copia em linha. As outras treze entradas (Setor Elétrico, Saneamento, Gás, Combustíveis, Eficiência, Contas Federais, Contas Estaduais, Agro, Conectividade, Educação, Custo de vida, Crédito aberto, aplicação do Crédito) têm abertura própria, cada uma com seu H1, seu rótulo e seu bloco de números.
- **E.** Desvios da checklist da seção 4 da skill: Gás sem número na primeira tela (os oito números ficam na seção `#numeros`); Crédito aberto com H1 nome ("Observatório Brasileiro de Crédito") em vez de pergunta e 4.785 px no desktop e 9.435 px no celular; Saneamento com H1 de quatro linhas no desktop e cinco no celular; Eficiência com sete medidas e uma régua; Conectividade e Território sem navegação de módulo; "Modelo didático" rotulado em nove artefatos e ausente ou chamado de "Laboratório ilustrativo" em outros sete.
- **E.** Comprimento: `/setor-eletrico` 12.551 px no desktop e 24.173 px no celular, com 472 links; `/setor-eletrico/pld` 12.147 e 21.872; `/saneamento/acesso` 11.503 e 18.926; `/contas-publicas-estaduais` 11.150 e 19.653; `/conectividade` 10.033 e 15.913; `/custo-de-vida` 9.877 e 15.886; `/glossario` 12.246 no celular (tabela completa na seção 5).
- **E.** Rótulos de prontidão sem forma única: "Estados · Piloto" no título e na navegação das Contas Estaduais, "Versão em desenvolvimento." no rodapé das Contas Federais, "Em desenvolvimento" no `MapaCobertura` da Eficiência, "(previsto)" em itálico no mapa logado, "em preparação" nos menus da Energia e do Saneamento.

### 4.5 Componentes e tokens

Inventário por papel (contagens da varredura de código, arquivo e linha no relatório interno; amostras conferidas):

| Papel | Implementações | Exemplos de colisão |
|---|---|---|
| Número de destaque | cerca de 20 (7 só em CSS) | `energia/Numero.tsx` e `EntradaObservatorio.tsx` exportam `Numero` com props e tipografia diferentes (serifa 1,75 a 2,25 rem contra `font-label` 1,35 a 2,1 rem); `.cn-numeros`, `.edm-numeros`, `.pv-numeros` são cópias regra a regra |
| Moldura de figura | cerca de 14 | `PainelEvidencia`, `SecaoDoPainel`, `Figura` (Território), `SecaoGas` + `FonteFigura`, `SecaoInflacao`, `SecaoCredito`, três `Moldura` locais copiadas em laboratórios |
| Tabela | cerca de 16 mais 6 sistemas em CSS | `energia/TabelaDados` e `saneamento/TabelaDados`; rolagem no celular por `tabela-scroll` (119 usos), `overflow-x-auto` (65), `cp-table-scroll`, `pv-tabela-rolagem`, `ce-table-scroll`, `edm-`, `cn-` |
| Rótulo de seção | 18 classes, 9 tamanhos (9,9 a 14 px), 6 espaçamentos | `.rotulo` base 0,72 rem (11,5 px); `.dominio-energia .rotulo` 0,75 rem; `!text-[0.66rem]` em 8 lugares; `.ce-kicker` 11 px; `.navlabel` 10,5 px na aplicação do Crédito |
| Linha de fonte e frescor | cerca de 22 | dois `SobreEsteDado` (evidencia e eficiencia); `FonteFigura`, `FonteAgro`, `FonteIpca`, três `Fonte`, `FonteJudiciario`, `FonteDaMedida`, `Proveniencia`; "captura" 918 ocorrências, "capturado em" 37, "publicado em" 29, "atualizado em" 2 |
| Estado de ausência | cerca de 11 | dois `Indisponivel` (evidencia e saneamento); `ui/States.tsx` com `ErrorState` sem uso; "sem dado" em 266 lugares, "Indisponível nesta publicação" em 5 |
| Termo e glossário | 7 | dois `Termo` (evidencia e contas-publicas); `/glossario` se apresenta como "fonte única de nomes e definições da plataforma" e contém só o vocabulário do Crédito; Contas, Agro e Energia têm glossários próprios |
| Cartão de destino | cerca de 14, mais 14 botões "copiar link do painel" quase idênticos | `ParaIrAlem`, `ParaVoce`, `DiretorioPaineis`, `ListaPaineis`, `BlocoPergunta`, `ProximasPerguntas`, `ProximasInflacao`, `.cp-chapters`, `.ce-question-grid`, `.mapa-no` |
| Seletor de lugar | cerca de 20 | `PldEscolha`, `RedeEscolha`, `GeracaoEscolha`, `CargaEscolha` idênticos exceto o nome; `ContaEscolha` e `AguaEscolha` idem |
| Rodapé | 3 | `Footer`, `RodapeEnergia`, `RodapeGas`; Contas Federais e Estaduais têm rodapé próprio na página |

Tokens:

- **E.** Dezenove arquivos definem propriedades CSS. Papel: `--cor-papel #faf8f2`, `--obs-papel` com dois valores (`#FAF8F2` na raiz e `#F8F7F2` em `.observatorio-credito` e `.dominio-energia`), `--ce-paper`, `--atlas-papel`, `--gravura-papel`, `--paper`, `--bg #f3efe5` na aplicação do Crédito. Tinta: `--cor-carvao #1a1d21`, `--obs-tinta #14243A` e `#182B36`, `--cor-obee-atlas-tinta #102e36`. Linha: `#d8d2c6`, `#D7DCD7`, `#55717a`. Destaque: `#00697F`, `#09697A`, `#0F6B74`, `#8f6644`.
- **E.** `gas.css`, `conectividade.css` e `custo-de-vida.css` remapeiam `main .text-carvao` para `#182B36` e `main .text-mineral` para `#5B6469`, valores diferentes dos tokens do Tailwind (`#1A1D21`, `#6B6D6A`); `atlas-inicial.css:39` redefine `--cor-carvao` e `--cor-mineral`. `tailwind.config.ts` repete os hexadecimais em vez de ler as variáveis.
- **E.** `design-tokens-energia.test.ts` confere hexadecimal solto só no domínio Energia. Saneamento tem 36 hexadecimais em componentes (`Ilustracoes.tsx`, `Laboratorios.tsx`), Conectividade 53 no CSS próprio, a aplicação do Crédito 151 no `app.js`.
- **E.** Textos abaixo de 12 px por página: home 148, `/eficiencia-estatal/saude-capitais` 336, `/contas-publicas-estaduais` 158, `/combustiveis` 112, `/glossario` 75 (a 1440 px). A skill fixa metadados em 12 a 14 px; a revisão de 20/10/2026 registrou o conflito com a `design-taste-frontend` e deixou a decisão para o dono.

### 4.6 Celular

- **E.** Toda página mede entre 1,8 e 2 vezes a altura do desktop a 390 px (tabela da seção 5). Elementos além da largura da tela a 390 px: `/contas-publicas-estaduais` 351, `/conectividade` 349, `/eficiencia-estatal` 258, `/educacao-municipal` 178, `/custo-de-vida` 171, `/saneamento/acesso` 162, `/combustiveis` 87. A página inteira não rola de lado em nenhuma delas; **I** os elementos excedentes estão em tabelas e grades com rolagem própria, mas o número alto indica tabelas que viram rolagem onde a skill pede identificação e medidas essenciais preservadas. Precisa de conferência visual tabela a tabela.
- **E.** Cabeçalho da home a 390 px em três linhas (marca e botão, "Observatórios ▾ · Imprensa · Entrar", idioma): cerca de 150 px. Painéis com conta: a linha de ferramentas ("Salvar · Citar · Avisar") ocupa uma linha inteira abaixo da marca.

### 4.7 Imagens e identidade

- **E.** Só quatro superfícies têm gravura: home (oito azulejos 4:5 mais `agro.svg` em estilo diferente, traço plano com cores da Energia), `/setor-eletrico`, `/contas-publicas` e a aplicação do Crédito. Nove entradas e todas as sete versões aperitivo não têm imagem. Os trípticos `obee-gravura-v1.webp` (576 KB) e `estadual-gravura-v1.webp` (564 KB) não são renderizados em lugar nenhum; `judiciario-por-dentro.webp` (221 KB) idem.
- **E.** Seis legendas diferentes para a mesma natureza de imagem; a da home ("Ilustrações editoriais de cada coleção") omite que é gerada por IA, contra a regra do `HARMONIZACAO_FIGURAS.md`. Proporções: 2:1 nas paisagens, 1:1 nos quadros da Energia, 3:1 recortado para 16:9 no tríptico das Contas, 4:5 na home. Moldura: `--gravura-fundo` resolve para petróleo `#102e36` no Setor Elétrico e cai para bege `#e9e4d8` nas Contas, porque o token é escopado.
- **E.** `/favicon.ico` está na lista de rotas abertas e o arquivo não existe. Nenhum observatório tem imagem social própria; as imagens sociais do Crédito (`resumo`, `dados`) e `public/obs/og-image.png` ficam atrás do login, portanto inacessíveis a quem compartilha o link.
- **E.** Logos de empresas: um componente (`energia/ListadasLogo.tsx`) e três leitores de manifesto (`src/lib/{energia,saneamento,conectividade}/logos.ts`); nenhum logo de banco no Crédito.
- **E.** Herói escuro só em `/aperitivo/minha-capital` (com grade de fundo decorativa) e nos painéis laterais das Contas; as demais aberturas são papel ou branco. Fundo da página: papel na maioria, `bg-obee-fundo` no Saneamento, branco (`bg-superficie`) em Gás, Combustíveis, Educação e Custo de vida.

### 4.8 Crédito

- **E.** A aplicação de página única carrega a barra comum, mas abaixo dela tem mundo próprio: barra lateral com 8 grupos e 42 itens, marca "Observatório Brasileiro de Crédito · monitoramento · diagnóstico · previsão", tokens próprios (`--bg`, `--text`, `--accent #8f6644`, escala `--fs-2xs` de 10,5 px), busca própria, cabeçalho de página próprio, sem ferramentas da conta, sem trilha, com `#view-mapa` vazio no HTML (H1 injetado por JavaScript e trocado uma segunda vez por `atlas.js`). A banca já previu migrar as cinco vistas mais usadas na Onda 3.

## 5. Medidas

Rotas medidas em 21/10/2026, `next dev` local, Chromium do Playwright, 1440 × 900 e 390 × 844. "Textos abaixo de 12 px" conta elementos com texto próprio e `font-size` menor que 12 px a 1440 px. "Elementos além da largura" conta caixas cuja borda direita passa da janela a 390 px (a página em si não rolou de lado em nenhum caso).

| Rota | Acesso | Altura 1440 / 390 (px) | Linhas do H1 1440 / 390 | Textos abaixo de 12 px | Links | Elementos além da largura a 390 |
|---|---|---|---|---|---|---|
| `/` | aberta | 3757 / 7077 | 2 / 3 | 148 | 222 | 69 |
| `/perguntas/familias` | aberta | 3876 / 7976 | 2 / 3 | 32 | 90 | 0 |
| `/perguntas/energia-e-infraestrutura` | aberta | 3775 / 8104 | 2 / 3 | 28 | 92 | 0 |
| `/setor-eletrico/conta-de-luz` | aberta | 1777 / 3177 | 2 / 2 | 1 | 104 | 0 |
| `/saneamento/municipio` | aberta | 1864 / 3591 | 1 / 3 | 1 | 95 | 0 |
| `/eficiencia-estatal` | aberta | 2595 / 5106 | 1 / 1 | 14 | 71 | 0 |
| `/gas-natural/gas-de-cozinha` | aberta | 2167 / 4203 | 1 / 2 | 16 | 80 | 26 |
| `/observatorio-do-credito` | aberta | 4785 / 9435 | 2 / 2 | 39 | 72 | 0 |
| `/combustiveis/no-meu-estado` | aberta | 2236 / 4855 | 1 / 2 | 15 | 78 | 0 |
| `/contas-publicas/previdencia` | aberta | 2084 / 4435 | 2 / 2 | 10 | 67 | 0 |
| `/conectividade` | aberta | 2018 / 4308 | 2 / 2 | 10 | 67 | 0 |
| `/educacao-municipal` | aberta | 1862 / 3909 | 2 / 2 | 10 | 67 | 0 |
| `/entrar` | aberta | 900 / 868 | 1 / 1 | 7 | 9 | 0 |
| `/glossario` | aberta | 5587 / 12246 | 1 / 1 | 75 | 68 | 0 |
| `/sobre` | aberta | 2353 / 4677 | 1 / 1 | 11 | 69 | 0 |
| `/app/observatorios` | com conta | 2154 / 5604 | 1 / 2 | 21 | 169 | 0 |
| `/observatorios/familias` | com conta | 5668 / 11421 | 2 / 3 | 30 | 124 | 0 |
| `/observatorios/economia` | com conta | 5085 / 10910 | 2 / 3 | 29 | 147 | 0 |
| `/setor-eletrico` | com conta | 12551 / 24173 | 2 / 2 | 30 | 472 | 0 |
| `/setor-eletrico/pld` | com conta | 12147 / 21872 | 1 / 2 | 13 | 175 | 28 |
| `/saneamento` | com conta | 7953 / 15643 | 4 / 5 | 2 | 137 | 0 |
| `/saneamento/acesso` | com conta | 11503 / 18926 | 2 / 3 | 11 | 113 | 162 |
| `/gas-natural` | com conta | 5229 / 10654 | 2 / 3 | 25 | 136 | 26 |
| `/combustiveis` | com conta | 9096 / 14709 | 1 / 2 | 112 | 121 | 87 |
| `/eficiencia-estatal` | com conta | 9105 / 16811 | 2 / 1 | 22 | 146 | 258 |
| `/eficiencia-estatal/saude-capitais` | com conta | 5767 / 10219 | 1 / 1 | 336 | 126 | 8 |
| `/eficiencia-estatal/trabalho-renda` | com conta | 5807 / 9177 | 1 / 2 | 12 | 121 | 10 |
| `/contas-publicas` | com conta | 7244 / 13766 | 3 / 3 | 23 | 74 | 1 |
| `/contas-publicas-estaduais` | com conta | 11150 / 19653 | 2 / 2 | 158 | 109 | 351 |
| `/agronegocio` | com conta | 6091 / 11195 | 1 / 2 | 8 | 127 | 0 |
| `/territorio` | com conta | 5396 / 11687 | 2 / 3 | 33 | 100 | 0 |
| `/custo-de-vida` | com conta | 9877 / 15886 | 2 / 2 | 47 | 90 | 171 |
| `/conectividade` | com conta | 10033 / 15913 | 2 / 2 | 11 | 78 | 349 |
| `/educacao-municipal` | com conta | 7029 / 10675 | 2 / 2 | 10 | 90 | 178 |
| `/observatorio/map` (Crédito) | com conta | 6992 / 13892 | 3 / 2 | 46 | 181 | 0 |
| `/observatorio/interest-rates` | com conta | 5539 / 8462 | 1 / 1 | 40 | 41 | 23 |
| `/app/conta` | com conta | 3757 / 5073 | 1 / 1 | 31 | 19 | 0 |

Capturas da primeira tela em `docs/ux-2026-10-21/` (JPEG reduzido): home, mapa logado, Setor Elétrico (desktop e celular), Saneamento (desktop e celular), Gás, Agro, Contas Federais, Contas Estaduais, Eficiência (com conta e aperitivo), Crédito (aplicação e página aberta), Custo de vida, entrada Famílias.

## 6. As dez iniciativas

Ordem de prioridade e de execução. A coluna "Depende de" indica o que precisa estar pronto antes. Esforço é estimativa grosseira em dias de um implantador com o repositório conhecido (**I**).

| # | Iniciativa | Ganho principal | Depende de | Esforço |
|---|---|---|---|---|
| 1 | Um só vocabulário: seis observatórios, 28 coleções, páginas | Orientação | nada | 3 a 4 |
| 2 | Uma só navegação de módulo e um só cabeçalho em toda superfície | Orientação, cromo | 1 | 6 a 8 |
| 3 | Busca da plataforma em toda página | Alcance | 1 | 4 a 6 |
| 4 | Molde único de página de entrada e consulta, com orçamento de comprimento | Primeira tela, densidade | 1, 2 | 8 a 12 |
| 5 | Tokens e tipografia únicos, piso de 12 px | Consistência | nada (paralelo a 1) | 3 a 5 |
| 6 | Kit de evidência compartilhado (número, figura, tabela, fonte, estado, termo, trilha) | Consistência | 5 | 10 a 15 |
| 7 | Consulta pessoal padronizada ("meu caso") com um só buscador de lugar | Alcance, aperitivo | 6 | 4 a 6 |
| 8 | Crédito dentro do sistema: casca primeiro, vistas depois | Consistência | 2, 5, 6 | 6 a 10 (casca) |
| 9 | Política única de imagem, identidade social e logos | Credibilidade | 5 | 3 a 5 |
| 10 | Orçamento de celular, tabelas e harness de medição no CI | Responsividade | 2, 6 | 4 a 6 |

### Iniciativa 1. Um só vocabulário: seis observatórios, 28 coleções, páginas

**Objetivo.** Em qualquer tela, o leitor lê a mesma hierarquia: Observatório (um dos seis) → Coleção (uma das 28) → Página. Os nomes antigos "Observatório Brasileiro de X" deixam de aparecer na interface.

**Evidência.** Seção 4.1.

**O que fazer.**

1. Em `src/lib/dominios.ts`, renomear os campos semânticos sem mudar `id`, `rotaRaiz` nem telemetria: `nome` passa a ser o nome da coleção ("Setor Elétrico", "Crédito e sistema financeiro", "Contas Federais", "Contas Estaduais", "Saneamento", "Gás Natural", "Agronegócio", "Síntese das capitais" para `eficiencia`) e um campo novo `nomeLegado` guarda o nome antigo só para testes de regressão e para o `/sobre`. Conferir cada uso de `d.nome` (grep `\.nome\b` em `src/components` e `src/app`) e trocar onde a tela mostra o nome.
2. Fazer `lista.ts` a única fonte de coleções: para cada `Colecao` incluir `dominio?: DominioId` (a coleção que tem pipeline próprio) e, para as coleções sem domínio (Renda e trabalho, Pagamentos, Empresas e risco, Mobilidade, Conectividade, Custo de vida, Educação, Fogo, Desastres etc.), o `href` já existente. Trocar `SwitcherObservatorio.tsx:43` e `barraSpa.ts` para listar `o.colecoes` (as 28) agrupadas pelos seis observatórios, marcando a atual com `aria-current`. Regenerar a barra da aplicação do Crédito com `node scripts/barra-spa.mjs`.
3. Rodapé (`Footer.tsx`): substituir as sete colunas de domínio por seis colunas, uma por observatório, cada uma com as suas coleções (nome do registro) e, no fim, "Método" e "Glossário" da coleção quando existirem. Rótulo `aria-label` de cada coluna é o nome do observatório. Institucional permanece.
4. Rótulo acima do H1 de toda entrada e painel: um componente único `RotuloContexto` que escreve "Observatório X · Coleção Y" (e "· Página Z" quando não é a entrada da coleção), lido do registro (`donoDaRota` em `registro.ts`). Substituir os textos em `setor-eletrico/page.tsx:812`, `saneamento/page.tsx:63`, `gas-natural/page.tsx:106`, `agronegocio/layout.tsx:8`, `eficiencia-estatal/layout.tsx:9`, `contas-publicas` ("Contas Públicas / Governo Federal"), `contas-publicas-estaduais`, `custo-de-vida` ("Custo de vida · Inflação por cidade") e nas versões aperitivo.
5. Trilha única: componente `Trilha` em `src/components/layout/Trilha.tsx` com `aria-label="Você está em"`, raiz "Observatórios" (link para `/app/observatorios` com conta e para `/perguntas/<observatório>` sem conta), depois observatório, coleção e página. Substituir as seis implementações da seção 4.1 e acrescentar a trilha nas páginas de coleção que não têm.
6. Títulos e `aria-label` das navegações de módulo: "Navegação da coleção X" em todas (resolvido junto com a iniciativa 2). Título `<title>` das páginas: "Página · Coleção · Scrutiniums".
7. Textos: `src/i18n/pt.ts:14` (abertura da home) passa a nomear os seis observatórios; `opcoesObservatorios.ts:14` "Judiciário" vira "Justiça"; `custo-de-vida/layout.tsx:10` recebe o título da coleção; H1 de `/observatorio-do-credito` vira pergunta (ver iniciativa 4); a marca da barra lateral do Crédito (`public/obs/index.html:45,52`) vira "Crédito e sistema financeiro".
8. Inglês: os nomes de observatório e coleção são nomes de produto e ficam em português nas duas línguas (regra já adotada em `navCabecalho.ts`); rodar `node scripts/cobertura-i18n.mjs` ao fim.

**O que não mudar.** Nenhuma URL, nenhum `id` de domínio, nenhuma chave de telemetria, nenhum nome de arquivo de gold.

**Critério de aceite.** Teste novo `src/tests/vocabulario.test.ts` que reprova: string "Observatório Brasileiro de" ou "Observatório do Agronegócio Brasileiro" em qualquer `.tsx` de `src/components` e `src/app` e em `public/obs/index.html` (exceto `/sobre` e documentos); seletor da barra sem alguma das 28 coleções; rodapé com coluna cujo `aria-label` não seja nome de observatório; página de coleção sem `Trilha`. Teste `cabecalho-movel` continua verde. Conferir logado e deslogado nas seis entradas, numa página de cada coleção e na aplicação do Crédito.

### Iniciativa 2. Uma só navegação de módulo e um só cabeçalho em toda superfície

**Objetivo.** Abaixo da barra comum, toda coleção usa o mesmo componente de navegação, com o mesmo comportamento no desktop e no celular, e um orçamento de cromo fixo. O mapa logado, a conta e o admin usam a barra comum.

**Evidência.** Seção 4.2.

**O que fazer.**

1. Criar `src/components/layout/NavegacaoColecao.tsx`, renderizado no servidor, com uma única anatomia em duas linhas no máximo:
   - Linha 1 (sempre): os destinos de primeiro nível da coleção, o atual marcado com `aria-current="page"` e filete na cor do acento. O primeiro item é a entrada da coleção ("Início"), o segundo é o destino mais procurado (a consulta pessoal da coleção, quando existe: Conta de luz, Meu município, Gás de cozinha, Quanto meu banco cobra). Até oito itens visíveis; o que passar vai para um menu "Mais" (`DetalhesFechaveis`), nunca para uma terceira linha.
   - Linha 2 (só quando o destino atual tem subpáginas): as subpáginas do destino atual, como faixa rolável no celular (`.nav-faixa`, já existente em `globals.css:339-367`).
   - À direita da linha 1, três atalhos fixos e sempre nesta ordem quando existirem: "Dados", "Método", "Glossário". A parceria técnica (FGV CERI) sai das linhas de navegação e vai para o rodapé da coleção (decisão do dono de 20/10/2026 pede a marca "em todos os painéis"; o rodapé da coleção cumpre isso sem gastar cromo; se o dono preferir manter no cabeçalho, ela ocupa o canto direito da linha 2, nunca uma linha própria).
   - Grupos com menus suspensos (Energia, Saneamento, Agro) viram itens de linha 1 que levam à primeira página do grupo e expõem o grupo na linha 2. Os menus suspensos deixam de existir na navegação; o índice completo do módulo continua na entrada e na busca (iniciativa 3).
   - No celular (abaixo de 640 px): linha 1 vira faixa rolável com o atual visível (`AtivoVisivel`), sem botão "Menu"; linha 2 idem. Nada de empilhar.
2. Os destinos vêm do registro: cada coleção declara em `src/lib/observatorios/colecoes.ts` (ou nos catálogos já existentes: `energia/navegacao.ts`, `saneamento/capitulos.ts`, `gas/navegacao.ts`, `contas-publicas/catalogo.ts`, `agro/modelo.ts`, `eficiencia/dimensoes.ts`, `credito/navegacao.ts`) uma lista `navegacao: { rotulo, href, subpaginas?, publicado }`. Destino com `publicado: false` aparece como texto "em preparação" com o mesmo selo da iniciativa 4, nunca como link.
3. Substituir, um a um, os treze cabeçalhos de domínio por `<CabecalhoPlataforma colecao=… /> + <NavegacaoColecao colecao=… atual=… />`: `CabecalhoEnergia`, `saneamento/Cabecalho`, `CabecalhoGas`, `CabecalhoAgro` e `NavegacaoAgro`, `CabecalhoCredito`, `CabecalhoCustoDeVida`, `CabecalhoCombustiveis`, `CabecalhoEducacao`, `CabecalhoEntrada` e `CabecalhoObee` e `NavegacaoTemaObee` e `NavegacaoPainel`, `judiciario/Cabecalho` e `NavegacaoJudiciario`, `NavegacaoTrabalho`, `CabecalhoSaude` e `NavegacaoSaude`, `cp-local` (Contas), `ce-nav` (Estaduais). Conectividade, Território e Previdência passam a ter navegação (Território: Queimadas, Desastres, Emissões, Método; Conectividade e Previdência: as páginas da coleção dona).
4. `FocoHeader` deixa de existir: `/app/observatorios`, `/app/conta` e `/app/admin` passam a usar `CabecalhoPlataforma` com `observatorio={null}` e, no lugar da navegação de coleção, uma linha com "Encontre o painel", "Conta", "Sair".
5. Ferramentas da conta ("Salvar recorte · Citar · Avisar quando atualizar"): no celular, viram um único botão "Ferramentas ▾" na linha da marca, para não ocupar uma linha inteira; no desktop ficam onde estão.
6. Faixa de frescor ("Atualização dos dados"): permanece como primeira linha do conteúdo, numa única linha no desktop; no celular, mostra só "Atualizado em … · Em dia" ou "Atualização atrasada há N dias" e o resto em `<details>`.
7. `ParaIrAlem` passa a renderizar no servidor com a lista do registro; o cliente só acrescenta o que depende de sessão.

**Orçamento de cromo (aceite).** A 1440 px, do topo da barra comum até o início do conteúdo (faixa de frescor incluída): no máximo 230 px. A 390 px: no máximo 200 px, e o H1 visível na primeira tela em toda entrada. Hoje: Setor Elétrico cerca de 330 e 415 px.

**Critério de aceite.** Nenhum componente `Cabecalho*` de domínio restante além de `CabecalhoPlataforma`; `grep -rl "FocoHeader" src` vazio; teste `cabecalho-movel` estendido para as 28 coleções com e sem sessão; teste novo que mede, com Playwright, o orçamento de cromo nas entradas das 28 coleções a 1440 e 390 px e reprova acima do limite; o destino mais procurado é o segundo item em toda coleção com consulta pessoal; `aria-label` de toda navegação de módulo é "Navegação da coleção X".

### Iniciativa 3. Busca da plataforma em toda página

**Objetivo.** De qualquer página, com ou sem conta, o leitor digita "Ideb", "botijão", "PLD", "Recife" ou "dívida dos estados" e chega à página, à coleção ou ao verbete, com o selo "com conta" nos destinos fechados.

**Evidência.** Seção 4.3.

**O que fazer.**

1. Índice único, gerado no build, em `src/lib/busca/indice.ts`: para cada página do inventário (`src/lib/observatorios/inventario.ts`, que já lista 123 páginas publicadas, 13 parciais e 4 previstas), o título, a pergunta, a coleção, o observatório, as palavras do `description`, os termos do glossário da coleção e os sinônimos declarados à mão num único arquivo `src/lib/busca/sinonimos.json` ("conta de luz" → tarifa, bandeira, distribuidora; "botijão" → GLP, gás de cozinha). Entram também as portas abertas (`/perguntas/*`), os verbetes de `/glossario` e de `/setor-eletrico/aprenda`, e as consultas pessoais com o padrão "minha cidade", "meu estado".
2. Componente `BuscaPlataforma` (cliente, sem biblioteca nova): campo na linha da marca da `BarraPlataforma`, à esquerda das ações no desktop e como ícone de lupa que abre uma folha no celular; atalho de teclado `/` e `Ctrl K`; resultados agrupados por observatório → coleção, com o selo `SeloComConta` nos destinos fechados quando não há sessão, e "Abrir a primeira" no Enter. Sem JavaScript, o formulário envia para `/buscar?q=`, página aberta que renderiza os mesmos resultados no servidor (rota nova a declarar em `rotasPublicas.ts`, `PREFIXOS`).
3. O `DiretorioPaineis` de `/app/observatorios` passa a usar o mesmo índice e o mesmo componente de resultado; `/buscar` sem conta é a versão aberta dele.
4. Aposentar as buscas locais de página inteira: `BuscaObservatorio` (Energia) e `IndiceFederal` (busca de capítulos) viram `BuscaPlataforma` com filtro fixo na coleção; a busca "buscar página…" da barra lateral do Crédito consulta o mesmo índice (um JSON estático gerado em `public/obs/data/busca.json`). As buscas de município não são buscas de página e seguem na iniciativa 7.
5. Medir: registrar o termo buscado de forma agregada (sem pessoa, sem sessão) no mesmo mecanismo de `uso_paginas_dia`, quando o dono ligar o uso anônimo. Até lá, só com conta.

**Critério de aceite.** Campo de busca presente em toda página que use `BarraPlataforma` (teste de DOM nas 28 entradas, home e portas); `/buscar?q=ideb` sem sessão devolve o painel Educação com selo "com conta" e o aperitivo sem selo; dez termos de controle (um por tipo: coleção, página, pergunta, verbete, sinônimo, município, UF, capital, distribuidora, banco) devolvem o destino esperado em teste; nenhum resultado aponta para rota inexistente (reusar a checagem de `para-voce.test.ts`).

### Iniciativa 4. Molde único de página de entrada e de consulta, com orçamento de comprimento

**Objetivo.** As 15 entradas (seis observatórios, treze coleções, Crédito aberto), as sete versões aperitivo e as consultas da leva 2 seguem um único molde, na ordem da checklist da seção 4 da skill, com limites de comprimento e um só vocabulário de estados.

**Evidência.** Seção 4.4 e tabela da seção 5.

**O que fazer.**

1. Generalizar `EntradaObservatorio` em `src/components/observatorios/EntradaColecao.tsx` com as fatias, nesta ordem e com estes contratos:
   1. `RotuloContexto` + H1 pergunta (até 60 caracteres, duas linhas a 1440 e três a 390; teste conta as linhas) + uma frase (até 220 caracteres).
   2. `Escala`: até quatro números com `Numero` do kit (iniciativa 6), cada um com fonte, período, nota e "Ver no painel". O primeiro número precisa estar na primeira tela a 1440 px (topo abaixo de 900 px).
   3. `ParaVoce` (já existe).
   4. `Destinos`: as coleções (nas entradas de observatório) ou os destinos de primeiro nível (nas entradas de coleção), cada cartão com um dado útil (um número com fonte ou a pergunta que responde), até oito à vista e o resto em `<details>`.
   5. `Artefato`: um modelo didático, rotulado sempre "Modelo didático · o que fica de fora" pelo componente `ModeloDidatico` (envelope único com título, o rótulo, o corpo e a lista do que o modelo não representa). "Laboratório ilustrativo", "cenário hipotético" e afins viram esse envelope.
   6. `Caminhos`: perguntas para começar, cada uma com resposta curta e número com fonte quando o destino tem número.
   7. `Metodo`: `<details>` com método, fontes, downloads (com `SeloComConta` na versão aberta) e `FaixaFrescor` variante método.
2. Migrar cada entrada para o molde, preservando o conteúdo (a skill proíbe esvaziar): Setor Elétrico (hoje 15 blocos: percurso visual, duas camadas, leituras, mapa, lab, destinos, trilhas, conhecimento, como confiar, fontes ficam, mas os blocos 8 a 12 passam para `<details>` ou para `/setor-eletrico/visao-geral`; a entrada precisa caber em cerca de 6.000 px a 1440 e 10.000 px a 390); Saneamento (H1 encurtado para uma pergunta de até 60 caracteres, por exemplo "Quem ainda está sem água e esgoto, e quanto custa?"; os 15 capítulos com número viram `Destinos` com os cinco eixos à vista e os capítulos dentro); Gás (os oito números sobem para a `Escala`, limitados a quatro, os outros quatro vão para `Caminhos`); Eficiência (`Escala` com quatro medidas e a régua das sete posições como `Artefato`); Contas Federais e Estaduais (mantêm o painel escuro à direita como `Escala`, perdem o rodapé próprio e "Versão em desenvolvimento"); Agro, Território, Combustíveis, Conectividade, Educação, Custo de vida (já próximos; ganham a ordem e o `<details>`); Crédito aberto (H1 vira a pergunta da coleção "Onde o crédito cresce, quanto custa e onde o risco aparece?", "O que dá para responder aqui" vira `Caminhos` com link e número, "O que muda" e "Coleta diária" recolhidos; alvo abaixo de 3.500 px a 1440).
3. Versões aperitivo (`src/app/aperitivo/*`) usam o mesmo molde reduzido: fatias 1, 2 (o caso do leitor), `ConviteAperitivo` e 7. Nenhuma mudança no contrato de `aperitivo.test.ts`.
4. Estados de prontidão com um só componente `SeloProntidao` com quatro valores e forma fixa (glifo + texto, nunca só cor): "publicado", "cobertura parcial", "em preparação", "piloto". Substituir "Estados · Piloto", "Versão em desenvolvimento.", "Em desenvolvimento", "(previsto)" e "em preparação" pelos quatro valores. Um destino "em preparação" nunca é link.
5. `/glossario` passa a ser o glossário da plataforma de fato: reúne os verbetes de Crédito, Contas, Agro e Energia (`GLOSSARIO`, `contas-publicas/glossario`, `agronegocio/glossario`, `CONCEITOS` de `aprenda`) numa lista única com filtro por coleção e busca (iniciativa 3), em acordeão por letra (hoje 12.246 px no celular). Os glossários de coleção continuam existindo como filtro, nas mesmas URLs.

**Orçamento de comprimento (aceite).** Entrada de observatório e de coleção: até 6.500 px a 1440 e 11.000 px a 390. Página aberta de tema (aperitivo): até 2.500 e 4.500. Porta `/perguntas/*`: até 3.500 e 7.000. Acima disso, recolher, nunca apagar.

**Critério de aceite.** Teste `src/tests/entrada-molde.test.ts` que, para cada entrada do inventário, confere no HTML do servidor: H1 único e com até 60 caracteres; `Escala` com 1 a 4 números, cada um com fonte e período; `ParaVoce` presente; `ModeloDidatico` presente e com a lista do que fica de fora; `<details>` de método presente; nenhum link para destino "em preparação". Teste de Playwright com os orçamentos de comprimento e a posição do primeiro número. Os testes atuais que fixam a ordem antiga das seções mudam de propósito, com o motivo no PR (skill §9).

### Iniciativa 5. Tokens e tipografia únicos, piso de 12 px

**Objetivo.** Uma fonte de verdade para cor, tipo e espaçamento; nenhuma redefinição por domínio; rótulo nunca abaixo de 12 px.

**Evidência.** Seção 4.5, parte de tokens.

**O que fazer.**

1. `src/app/globals.css` fica como único arquivo de tokens de plataforma: `--cor-*`, `--serie-*`, `--escala-*`, mais os papéis novos que hoje só existem fora (`--cor-painel-escuro` para os painéis escuros das Contas e da Eficiência, `--gravura-*`). `tailwind.config.ts` passa a ler `var(--cor-…)` em vez de repetir hexadecimais (Tailwind 3 aceita `"rgb(var(--…) / <alpha-value>)"` ou o `var()` direto quando não há opacidade; usar o segundo, como já é o caso).
2. Apagar as redefinições: `--obs-*` em `public/observatorios.css` passam a apontar para `var(--cor-*)` (um valor só para papel, tinta, linha, destaque); `.observatorio-credito` e `.dominio-energia` deixam de redefinir `--obs-papel`; `atlas-inicial.css:39` deixa de redefinir `--cor-carvao` e `--cor-mineral`; `gas.css`, `conectividade.css` e `custo-de-vida.css` perdem os blocos `main .text-carvao` e `main .text-mineral`; os tokens `--cp-*`, `--ce-*`, `--cn-*`, `--edm-*`, `--pv-*`, `--atlas-*`, `--ink/--line/--muted/--paper/--accent` dos módulos CSS viram aliases de `--cor-*` até os componentes migrarem (iniciativa 6) e então somem. Na aplicação do Crédito, `public/obs/styles.css` mapeia `--bg`, `--text`, `--text-2`, `--text-3`, `--border`, `--accent` para `var(--cor-*)` (iniciativa 8).
3. Escala tipográfica única em `globals.css`, com classes de papel e não de domínio: `.t-h1` (clamp 2 a 3,2 rem), `.t-h2`, `.t-h3`, `.t-lead`, `.t-corpo`, `.t-tabela`, `.t-meta` (0,8125 rem, 13 px), `.rotulo` (0,75 rem, 12 px, caixa alta, 0,14 em). Remover `.dominio-energia .rotulo`, `.dominio-energia .text-xs`, `!text-[0.66rem]`, `text-[0.62rem]` (`LiteralFonte.tsx:16`), `.ce-kicker`, `.cp-eyebrow`, `.atlas-eyebrow`, `.navlabel` 10,5 px, `.tagline` 10,5 px e os `.eyebrow`/`.kicker` dos módulos CSS, todos substituídos por `.rotulo`. Números: três tamanhos só (`.numero-g` 2,25 rem, `.numero-m` 1,75 rem, `.numero-p` 1,35 rem), sempre serifa com `lining-nums tabular-nums`.
4. Fundo de página: papel (`--cor-papel`) em toda página; branco só em superfícies funcionais. Trocar `bg-superficie` de Gás, Combustíveis, Educação e Custo de vida e `bg-obee-fundo` do Saneamento no `main`.
5. Decisão do dono registrada em 20/10/2026 (eyebrows, numeração, filetes, destaque colorido): este parecer recomenda manter os rótulos em caixa alta a 12 px como identidade da casa e tirar a numeração "01 02 03" dos cartões da home e das portas (ela não ordena nada que o leitor use e conflita com a `design-taste-frontend`). Fica como decisão pendente (seção 8).

**Critério de aceite.** Estender `design-tokens-energia.test.ts` para `design-tokens.test.ts` cobrindo `src/components` e `src/app` inteiros e `public/obs/styles.css`: nenhum hexadecimal solto fora de `globals.css` e dos manifestos de logo; nenhuma propriedade `--cor-*` redefinida fora de `globals.css`; nenhum `font-size` abaixo de 0,75 rem fora de `print`; `tailwind.config.ts` sem hexadecimal. Playwright: zero textos abaixo de 12 px nas 37 rotas da seção 5 (hoje até 336). Contraste AA conferido pelos testes já existentes para os tokens de texto.

### Iniciativa 6. Kit de evidência compartilhado

**Objetivo.** Um componente por papel, com variantes, em `src/components/kit/`, e as cópias de domínio migradas. Nomes únicos na base.

**Evidência.** Seção 4.5, tabela por papel.

**O que fazer.** Criar o kit a partir do que já é o melhor exemplar de cada papel (regra: não reescrever o que funciona; extrair e parametrizar), nesta ordem, e migrar as cópias em seguida:

| Componente do kit | Base | Variantes | Substitui |
|---|---|---|---|
| `Numero` | `energia/Numero.tsx` (selo de natureza, "comprove este número", variante faixa) | `cartao`, `faixa`, `linha`; tamanhos g/m/p | `EntradaObservatorio.Numero`, `MedidaGas`, `Numeros` ×3, `NumerosJudiciario`, `FaixaResumo`, `PanoramaFaixa`, `DestaquesAgro`, `Destaques`, `.cn-/.edm-/.pv-/.cp-/.ce-numeros`, `.obs-metrics`, `.atlas-metric`, `.card.kpi` |
| `Figura` | `PainelEvidencia` (seis perguntas) com `SecaoDoPainel` | `completa` (seis perguntas), `simples` (título, subtítulo, fonte, tabela equivalente) | `Figura` (Território), `SecaoGas`+`FonteFigura`, `SecaoInflacao`, `SecaoCredito`, `Moldura` ×3, `Quadro`, `Bloco` ×2, `FiguraDidatica`, `chartFooter()` |
| `Tabela` | `energia/TabelaInterativa` (aria-sort, paginação, `tabela-scroll`) | `interativa`, `simples`, `comparativa` | `TabelaDados` ×2, `TabelaComparativa`, `TabelaSimples`, `TabelaGas`, `TabelaAgro`, tabelas locais do Território e da Eficiência, `.edm-/.pv-/.cn-/.cp-/.ce-tabela`, `table.data` |
| `Fonte` | `LiteralFonte` + `SobreEsteDado` (evidencia) | `linha` ("Fonte · período · captura"), `drawer` | `FonteFigura`, `FonteAgro`, `FonteIpca`, `Fonte` ×3, `FonteJudiciario`, `FonteDaMedida`, `Proveniencia`, `eficiencia/SobreEsteDado`, `.cn-/.edm-/.pv-fonte`, `.cp-source`, `fontePane()` |
| `Ausencia` | `evidencia/Indisponivel` | `bloco`, `linha`, `celula` ("sem dado" com motivo) | `saneamento/Indisponivel`, `SemValor`, `ForaDoEscopo`, `.edm-sem`, `.pv-sem`, `.ce-zero`, `EmptyState`, `loadingCard()` |
| `Termo` | `evidencia/Termo` + `TermoDica` | destino no glossário único (iniciativa 4) | `contas-publicas/artefatos/Termo`, `Siglas`, `termo()` da aplicação do Crédito |
| `Trilha` | iniciativa 1 | | seis implementações |
| `SecaoPergunta` | `SecaoDoPainel` + `ed-h2` | níveis de profundidade | `Secao*` ×8, `SectionHeading`, `sechead()` |
| `CartaoDestino` | `ParaVoce` (cartão) | `pergunta`, `painel`, `colecao` | `ListaPaineis`, `BlocoPergunta`, `ProximasPerguntas`, `ProximasInflacao`, `.cp-chapters`, `.ce-question-grid`, `.mapa-no`; os 14 `*LinkPainel` viram `LinkDoPainel` único |
| `Escolha` | `PldEscolha` | | `RedeEscolha`, `GeracaoEscolha`, `CargaEscolha`, `ContaEscolha`, `AguaEscolha` e os seis `*Lista` |
| `Rodape` | `Footer` | `colecao` (fontes, método, parceria técnica, inglês quando houver) | `RodapeEnergia`, `RodapeGas`, rodapés em linha das Contas |

Regras de migração: (a) migrar primeiro as três coleções em CSS copiado (Conectividade, Educação, Previdência), que são as mais simples e provam o kit; depois Saneamento, Gás, Combustíveis, Custo de vida, Contas, Território, Eficiência, Agro; a Energia por último, porque já é a base; (b) cada migração é um PR por coleção, com capturas antes e depois a 1440 e 390 e a matriz da rubrica da skill (§10); (c) regra de lint (`eslint` com `no-restricted-imports` e um teste de nomes) que reprova exportação com nome igual ao de um componente do kit fora de `src/components/kit`; (d) texto único para ausência ("Indisponível nesta publicação" com motivo) e para captura ("Capturado em", "Publicado em", "Referência"), definido em `src/lib/evidencia/textos.ts` e usado por `Fonte` e `Ausencia`.

**Critério de aceite.** Contagem por papel na tabela da seção 4.5 cai para 1 (mais variantes) em cada linha; nenhum par de exportações com o mesmo nome em `src/components`; `grep -rc "sem dado" src` cai para o componente `Ausencia`; os testes de componente da Energia (`energia-comp-*.test.ts`) passam a importar do kit; matriz de rubrica com nota mínima 8 em cada critério por coleção migrada, registrada em `docs/observatorios/AVALIACAO_PAGINAS.md`.

### Iniciativa 7. Consulta pessoal padronizada ("meu caso") com um só buscador de lugar

**Objetivo.** "Minha cidade", "meu estado", "minha capital", "minha distribuidora", "meu banco" têm um único componente de busca, um único índice por tipo de lugar, o mesmo estado na URL, o mesmo estado vazio, o mesmo bloco de resultado e o mesmo convite, com e sem conta.

**Evidência.** Seção 4.3 (nove buscas de município) e revisões de 20/10/2026 (metadado sem número no estado vazio da Conta de luz, metade vazia do Saneamento, régua decorativa do Gás).

**O que fazer.**

1. `src/components/kit/BuscaLugar.tsx` a partir de `saneamento/BuscaMunicipio.tsx` (combobox ARIA já correto), com `tipo: "municipio" | "uf" | "capital" | "distribuidora" | "banco"`. Índices: um arquivo por tipo em `public/lugares/{municipios,ufs,capitais,distribuidoras,bancos}.json`, todos em `ARQUIVOS_DAS_CONSULTAS` de `rotasPublicas.ts`; o de municípios substitui `saneamento/gold/indice.json` e `setor-eletrico/conta-de-luz/municipios.json` (os dois continuam servidos por redirecionamento até a migração terminar). O índice de municípios traz código IBGE, nome, UF e, por coluna opcional, o identificador que cada coleção precisa (distribuidora da Conta de luz, prestador do Saneamento).
2. Estado na URL sempre `?ibge=`, `?uf=`, `?capital=`, `?distribuidora=`, `?banco=`, com `history.replaceState`, para o recorte ser compartilhável e o "Salvar recorte" funcionar igual em toda consulta.
3. `ConsultaPessoal` (envelope): pergunta, `BuscaLugar`, estado vazio só com a frase (sem metadado antes do número), `Resultado` com `Numero` do kit, `Fonte` e, na versão aberta, `ConviteAperitivo`. Substituir as oito buscas independentes (`ContaBuscaMunicipio`, `QualidadeBuscaMunicipio`, as três dos mapas da Energia, `ConsultaMunicipalAlimentar`, `PainelMobilidade`, `SeletorTerritorioTrabalho`) e as quatro que envolvem a base (Território, Conectividade, Educação, Previdência), e os seletores de UF de Gás, Combustíveis e Custo de vida.
4. As sete versões aperitivo e os itens da leva 2 usam `ConsultaPessoal`; o contrato de `aperitivo.test.ts` e `leva2.test.ts` não muda.
5. Geolocalização: não. A skill pede honestidade e o Saneamento já declara "Sem localização automática". Manter.

**Critério de aceite.** Uma só implementação de combobox de lugar em `src`; teste que abre as sete páginas aperitivo e as consultas da leva 2 sem sessão e confere que a busca, o estado vazio, o resultado e o convite têm a mesma estrutura de DOM; nenhuma requisição cai no login (reusar a checagem de `consultas-abertas.test.ts`); teclado e leitor de tela conferidos numa consulta de cada tipo (registrar em `AVALIACAO_PAGINAS.md`).

### Iniciativa 8. Crédito dentro do sistema: casca primeiro, vistas depois

**Objetivo.** Quem entra no Crédito não sente que mudou de site. A casca (navegação, cabeçalho de página, tokens, tipografia, ferramentas da conta, trilha, busca) passa a ser a da plataforma antes de qualquer migração de vista; as vistas migram depois na ordem do uso medido (já previsto na Onda 3 da banca).

**Evidência.** Seção 4.8.

**O que fazer (casca, agora).**

1. A barra lateral (`public/obs/index.html:57-140`, 8 grupos, 42 itens) é substituída por `NavegacaoColecao` gerada do registro, como já acontece com a barra comum (`scripts/barra-spa.mjs`): linha 1 com os grupos do Crédito (Começar, Ciclo do crédito, Instituições e funding, Produtos e preços, Território e pessoas, Risco e cobrança, Pagamentos e conduta, Referência) e linha 2 com as vistas do grupo ativo. A barra lateral some; o conteúdo ocupa a largura da plataforma (`max-w-page`).
2. `pageHead()` (`app.js`) passa a produzir o mesmo HTML de `RotuloContexto` + H1 + frase + `Fonte` linha; `sechead()` produz `SecaoPergunta`; `chartFooter()` produz `Fonte`; `loadingCard()` produz `Ausencia`; `.card.kpi` produz `Numero`. Como a aplicação é HTML gerado por template, a forma mais segura é um módulo `public/obs/kit.js` que escreve o mesmo markup e as mesmas classes do kit React, e um teste (`src/tests/credito-kit.test.ts`) que compara o HTML gerado por `kit.js` com o HTML renderizado pelos componentes React para os mesmos dados.
3. `styles.css`: aliases de token para `var(--cor-*)` (iniciativa 5), escala tipográfica da plataforma, `.navlabel` e `.tagline` aposentados, `down good`/`up bad` (julgamento por cor, perto da linha 8051 do `app.js`) substituídos por seta neutra com texto "em relação a …".
4. Ferramentas da conta na aplicação: `FerramentasConta` renderizado pela barra gerada (o `app.js` já consulta `/api/auth/eu`), com salvar recorte lendo o `hash` da vista, citar e avisar.
5. `#view-mapa` com HTML no servidor: o mapa do observatório vira página Next (`/observatorio/map` servida por `src/app/observatorio/map/page.tsx` com o molde da iniciativa 4), e a aplicação passa a ser o destino das vistas, não da entrada. Isso tira o H1 injetado e trocado duas vezes.
6. Imagem social do Crédito gerada por `cartaoSocial` numa rota aberta (iniciativa 9).

**O que não mudar.** URLs das vistas, golds, `embed.html`, a ordem de migração das vistas (fica para a Onda 3, pelo uso medido).

**Critério de aceite.** Captura de `/observatorio/map` e de duas vistas a 1440 e 390 sem barra lateral, com a navegação em duas linhas e as ferramentas da conta; `credito-kit.test.ts` verde; nenhuma classe `down good` ou `up bad`; `/observatorio/map` com H1 no HTML do servidor; textos abaixo de 12 px nas vistas igual a zero.

### Iniciativa 9. Política única de imagem, identidade social e logos

**Objetivo.** Imagem com função em toda entrada, ou em nenhuma, com a mesma proporção, a mesma legenda, a mesma moldura; identidade social por observatório; logos com um só componente e um só leitor de manifesto.

**Evidência.** Seção 4.7.

**O que fazer.**

1. Decisão de política (proposta): toda entrada de coleção leva uma gravura em faixa 2:1 na `Escala` do molde (iniciativa 4), à direita do H1 no desktop e acima no celular; toda entrada de observatório leva o tríptico da sua coleção principal recortado em quadrados, sem esticar; páginas abertas (aperitivo e portas) não levam imagem, para a primeira tela ficar com a pergunta e o número. Gravura nova só quando a existente não serve; as dos trípticos OBEE e Estadual (já geradas, nunca usadas) entram na Eficiência e nas Contas Estaduais; Gás, Saneamento, Agro, Território, Combustíveis, Conectividade, Educação, Custo de vida e Previdência ficam sem gravura até o dono aprovar novas, e o molde reserva o espaço com a `Escala` em largura total (nenhuma moldura vazia).
2. `Gravura` no kit: `<figure>` com `next/image` (sempre otimizado, `sizes` declarado), proporção fixa por variante (`faixa` 2:1, `quadro` 1:1), moldura `--gravura-fundo` definida em `globals.css` (um valor só), legenda única "Ilustração conceitual gerada por IA; não representa dados." em `src/lib/evidencia/textos.ts`, `alt` descritivo na paisagem de abertura e vazio nas decorativas. Substituir `ArteFoto`, `ArteTriptico`, `GravuraEnergia`, o `<img>` da home e o `<img>` de `atlas.js`. Apagar `TrilhasEstado.tsx` (nunca montado), `judiciario-por-dentro.webp` e os seletores mortos de `observatorios-gravuras.css` (`.energia-porta*`, `.observatorio-gravuras`, `.energia-cenario-texto`). A legenda da home passa a dizer que são geradas por IA. `agro.svg` sai da home (estilo diferente) e o azulejo do Agro usa o mesmo tratamento dos outros ou fica só tipográfico.
3. Identidade social: `cartaoSocial` (`src/lib/og.tsx`) ganha uma variante por observatório (nome, pergunta, acento) e cada entrada e porta declara `opengraph-image.tsx` numa rota aberta (a regra `IMAGEM_SOCIAL` de `rotasPublicas.ts` herda o acesso da página; para páginas com conta, a imagem social precisa de exceção explícita, porque o rastreador não tem sessão). Criar `public/favicon.ico` e `apple-icon` a partir do monograma.
4. Logos: um leitor `src/lib/logos.ts` para os três manifestos (mesmo esquema; o da Energia é a referência), um componente `LogoEmpresa` no kit (a partir de `ListadasLogo`), usado em Energia, Saneamento e Conectividade, e, quando o dono quiser, em Crédito (bancos), pelo mesmo contrato de CNPJ.
5. Herói escuro: só o painel lateral das Contas e a régua das capitais usam fundo escuro, com o token `--cor-painel-escuro`; o aperitivo "Minha capital" perde a grade de fundo e passa ao herói claro do molde, para as sete páginas abertas serem iguais.

**Critério de aceite.** Teste que reprova gravura fora de `Gravura`, legenda diferente da única, imagem em `public` sem referência no código, `next/image` em rota fechada sem `unoptimized` ou sem exceção; imagem social de cada observatório e de cada porta acessível sem sessão (teste de rota); `favicon.ico` presente; capturas das entradas com gravura a 1440 e 390 sem corte, sem imagem quebrada e sem moldura vazia.

### Iniciativa 10. Orçamento de celular, tabelas e harness de medição no CI

**Objetivo.** As mesmas tarefas em 390 px sem perda silenciosa, com limites medidos a cada PR.

**Evidência.** Seção 4.6 e tabela da seção 5.

**O que fazer.**

1. Levar `scripts/ux-medidas.mjs` (entregue com este parecer) para o CI como teste de navegador (`src/tests/ux-orcamentos.test.ts`), com os orçamentos das iniciativas 2 e 4 e mais estes: zero textos abaixo de 12 px; zero imagens quebradas; H1 em até duas linhas a 1440 e três a 390; nenhuma tabela com rolagem própria sem a indicação perceptível (`data-rolavel` já existe em `globals.css`) e sem a primeira coluna fixa; nenhuma página com mais de 250 links à vista fora de `<details>` (hoje `/setor-eletrico` tem 472).
2. Tabelas no celular: `Tabela` do kit (iniciativa 6) implementa a regra da skill: identificação e medidas essenciais sempre visíveis, demais colunas em rolagem só da tabela, com sombra de borda e primeira coluna fixa (o `.pv-tabela-rolagem` já faz isso a 760 px; vira o padrão). Conferir visualmente as sete páginas com mais de 80 elementos além da largura (seção 4.6) e registrar na `AVALIACAO_PAGINAS.md`.
3. Cromo no celular: além da iniciativa 2, a faixa de parceria técnica e a de idioma não ocupam linha própria abaixo de 640 px (idioma vai para o seletor da marca; parceria vai para o rodapé da coleção ou para a linha 2).
4. `Recolhido` (já existe em `home/Recolhido.tsx`) vira componente do kit e passa a ser o único jeito de recolher seção longa, com o resumo em uma linha e o conteúdo no HTML.
5. Alvos de toque: teste de DOM que reprova link ou botão com menos de 44 px de altura em `nav` e em cartões (regra já aplicada nos cabeçalhos em 2026-07; estender).
6. Leitor de tela: uma rodada manual (NVDA ou VoiceOver) nas seis entradas e numa consulta pessoal, com o resultado em `AVALIACAO_PAGINAS.md`. Não dá para automatizar; é a única lacuna aberta desde a banca.

**Critério de aceite.** `ux-orcamentos.test.ts` verde nas 37 rotas da seção 5 mais as 28 entradas de coleção; tabela da seção 5 refeita com todas as alturas dentro do orçamento e todos os "textos abaixo de 12 px" em zero; registro do leitor de tela.

## 7. Sequência e dependências

| Onda | Iniciativas | Entrega verificável |
|---|---|---|
| A (vocabulário e navegação) | 1, 5, 2, 3 | Toda página com a mesma hierarquia de nomes, a mesma navegação em duas linhas, busca na barra, tokens únicos. Capturas das 28 entradas a 1440 e 390 e os testes novos verdes |
| B (molde e kit) | 6 (três coleções copiadas primeiro), 4, 7 | Kit publicado e usado por Conectividade, Educação, Previdência, Saneamento, Gás e Contas; entradas no molde com orçamento; consultas pessoais com um só buscador |
| C (identidade) | 8 (casca), 9, 10, 6 (coleções restantes) | Crédito com a casca da plataforma; imagens e identidade social; CI com orçamentos; Energia, Eficiência e Agro no kit |

Cada iniciativa é um ou mais PRs pequenos por coleção, nunca um PR único de plataforma (a Onda 1 da banca foi um PR único e dificultou a revisão). Cada PR: capturas antes e depois, conferência logado e deslogado, matriz da rubrica da skill (§10) e a lista do que mudou nos testes e por quê. Merge só com autorização do dono; deploy conferido antes de dizer "no ar" (skill §13).

## 8. Decisões pendentes do dono

1. **Rótulos em caixa alta, numeração 01 02 03, filetes, destaque colorido no título** (conflito registrado em 20/10/2026 com a `design-taste-frontend`). Recomendação: manter rótulos a 12 px e filetes como identidade; tirar a numeração dos cartões; manter o destaque em bronze só no H1 da home.
2. **Parceria técnica no cabeçalho ou no rodapé da coleção.** Recomendação: rodapé da coleção, para o orçamento de cromo; se ficar no cabeçalho, ocupa o canto direito da linha 2.
3. **Imagem em toda entrada ou em nenhuma.** Recomendação: faixa 2:1 em toda entrada de coleção com gravura aprovada, sem moldura vazia onde não houver; aperitivos e portas sem imagem.
4. **Menus suspensos da Energia e do Saneamento.** A iniciativa 2 os substitui por duas linhas; é mudança de hábito para quem já usa. Recomendação: fazer, com o índice completo preservado na entrada e na busca.
5. **Mapa do Crédito como página Next** (iniciativa 8, item 5). Muda a casca de uma rota muito usada por especialistas. Recomendação: fazer, mantendo a URL.
6. **Uso anônimo ligado** para a busca e as consultas medirem o que o leitor procura (`MEDICAO_DE_USO.md`, seção 6). Sem isso, a priorização seguinte continua por critério e não por uso.

## 9. Como conferir

```bash
# dependências e scripts de predev (obrigatórios: sem eles /eficiencia-estatal e a aplicação do Crédito falham)
npm ci && node scripts/materializar-assistencia.mjs && node scripts/materializar-seguranca-alimentar.mjs && node scripts/materializar-trabalho-renda.mjs && node scripts/minify-obs.mjs
# servidor local com banco em memória
COOKIE_SECRET=dev-secret-para-capturas DATABASE_URL=pglite-memory: npx next dev -p 3111
# medidas e capturas (sem sessão: "-"; com sessão: o valor do cookie scrutiniums_session)
node scripts/ux-medidas.mjs http://localhost:3111 /tmp/ux - / /perguntas/familias /setor-eletrico/conta-de-luz
node scripts/ux-medidas.mjs http://localhost:3111 /tmp/ux "<cookie>" /app/observatorios /setor-eletrico /saneamento
```

Para a sessão de desenvolvimento, o fluxo de cadastro pela API funciona em modo simulado: `POST /api/onboarding/email/start`, `POST /api/onboarding/phone/start` (o código aparece no log do servidor como `[dev-verify]`), `POST /api/onboarding/phone/check`, `POST /api/onboarding/profile` com `password`, `cpf` válido, `perfilUso: "cidadao"` e `uf`. O cookie `scrutiniums_session` sai no `phone/check`.

## 10. O que este parecer não propõe

- Mudar qualquer URL, contrato de gold, pipeline ou regra de acesso. O princípio do aperitivo, a lista `APERITIVOS`, a `LEVA_2` e os testes que os protegem ficam como estão.
- Abrir painel sem conta, retirar informação básica do cadastro, criar nota composta, ou qualquer decisão já tomada pelo dono em 19 e 20/10/2026.
- Trocar framework, biblioteca de gráficos ou fontes. O kit é extraído do que já existe.
- Esvaziar páginas para parecerem limpas. Todo orçamento de comprimento se cumpre recolhendo, nunca apagando.
