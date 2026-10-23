# Design system da plataforma

Referência de toda a Scrutiniums (todos os observatórios, as páginas abertas, a conta e a aplicação do Crédito), desde a Iniciativa 5 do parecer de UX de 21/10/2026. Antes era o documento do Setor Elétrico.

A família visual é a da Scrutiniums: tipografia, grid, filetes, rótulos em caixa alta, espaço negativo. Cada observatório tem **um** acento. Nada de gradiente decorativo, neon, gauge sem régua ou tela de trading.

## Um só arquivo de tokens

* `src/app/globals.css` é o único lugar que define cor. Nenhum outro arquivo escreve hexadecimal nem redefine `--cor-*`; `src/tests/design-tokens.test.ts` reprova (escopo: `src/components`, `src/app`, `public/observatorios.css`, `public/observatorios-gravuras.css`, `public/obs/styles.css`, `public/obs/atlas.css`).
* `tailwind.config.ts` lê as variáveis (`var(--cor-…)`), sem hexadecimal. As cores usadas com modificador de opacidade (`bg-carvao/40`) leem a tripla RGB do mesmo token (`--cor-<nome>-rgb`), porque com `var()` puro o Tailwind 3 descarta a classe em silêncio; o teste confere tripla contra hexadecimal e reprova classe com opacidade em cor sem tripla.
* Derivados, regenerados por `node scripts/tokens-derivados.mjs` e conferidos pelo teste: `public/obs/tokens.css` (as mesmas variáveis para a aplicação do Crédito, que não carrega `globals.css`) e `src/lib/tokens.gerado.ts` (hexadecimais para a imagem social, que não lê CSS).
* Aliases de coleção (`--obs-*`, `--cp-*`, `--ce-*`, `--cn-*`, `--edm-*`, `--pv-*`, `--atlas-*`, `--gravura-*` e os `--ink`/`--line`/`--muted`/`--paper` dos módulos da Eficiência) têm uma linha cada e nenhum valor próprio; somem quando a Iniciativa 6 migrar os componentes.
* Dentro de um painel escuro com componentes de gráfico, a classe `.contexto-escuro` (em `globals.css`) troca os tokens de texto e linha pelos do painel, só na tela.

## Tokens de cor

Contraste medido sobre papel / marfim / superfície (branco). Texto pequeno pede 4,5:1; texto grande e elemento gráfico, 3:1.

| Token | Valor | Uso | Contraste |
| --- | --- | --- | --- |
| `papel` | `#faf8f2` | fundo de página, em todo `main` | fundo |
| `marfim` | `#f3efe5` | faixa ou superfície que pede um degrau de tom (seções alternadas da página inicial) | fundo |
| `superficie` | `#ffffff` | controles, menus, cartões de laboratório | fundo |
| `contexto` | `#e6eeee` | faixa de referência, seleção discreta, cabeçalho de tabela | fundo; texto só em carvão, carvão-muted e acento (mineral 4,4:1, usar `mineral-dark`) |
| `linha` | `#d8d2c6` | separador decorativo; campo de formulário usa borda em mineral | 1,4 / 1,3 / 1,5 |
| `carvao` | `#1a1d21` | texto e valor principal | 15,9 / 14,7 / 16,9 |
| `carvao-muted` | `#3d4147` | texto de apoio | 9,7 / 8,9 / 10,3 |
| `mineral` | `#6b6d6a` | metadado sobre papel, marfim e branco | 4,9 / 4,5 / 5,2 |
| `mineral-dark` | `#626762` | texto terciário sobre o contexto suave e as tintas claras | 5,4 / 5,0 / 5,8 |
| `destaque` | `#00697f` | série focal, link e seleção da barra comum (unifica `#09697a` e `#00697f`) | 5,9 / 5,5 / 6,3 |
| `bronze` | `#966b48` | acento da marca e das Famílias; só texto grande ou marcação | 4,4 / 4,1 / 4,7 |
| `bronze-dark` | `#7c5638` | texto em bronze, aviso sobre marfim | 6,1 / 5,6 / 6,5 |
| `energia` · `energia-dark` | `#0e6170` · `#0a4a56` | acento do Setor Elétrico | 6,7 · 9,3 sobre papel |
| `obee` · `obee-dark` · `obee-tinta` | `#00697f` · `#0b4f5e` · `#14243a` | acento e tinta da Eficiência Estatal | 5,9 · 8,6 · 14,7 sobre papel |
| `gas` · `gas-dark` | `#35598a` · `#2b4a78` | acento do Gás e dos Combustíveis | 6,7 · 8,4 sobre papel |
| `conect` · `conect-dark` | `#0f6b74` · `#0b535a` | acento da Conectividade | 5,9 · 8,2 sobre papel |
| `negativo` | `#65516f` | valor negativo sem vermelho (Contas Federais) | 6,7 / 6,2 / 7,1 |
| `comparacao` | `#806a45` | série de referência quando é preciso uma segunda cor; marcação | 4,9 / 4,5 / 5,2 |
| `erro` · `sucesso` · `aviso` | `#8c3b2e` · `#4f6b4e` · `#8a6d2f` | estados documentados; `aviso` não vai sobre marfim (4,2:1) | 7,1 · 5,6 · 4,6 sobre papel |
| `painel-escuro` | `#102e36` | fundo dos painéis escuros (Atlas, gravuras, Contas Estaduais, Crédito) | fundo |
| `painel-escuro-texto` · `-legenda` · `-acento` | `#f8f7f2` · `#c4d7d7` · `#a3e3d7` | texto, legenda e acento sobre o painel escuro | 13,4 · 9,6 · 9,9 sobre o painel |
| `painel-escuro-controle` · `-foco` | `#87a9af` · `#e5bf76` | borda de controle e anel de foco sobre o painel | 5,7 · 8,2 sobre o painel |
| `painel-escuro-linha` · `-superficie` · `-selecao` | `#557278` · `#214650` · `#37616b` | filete, realce e item selecionado sobre o painel | decorativos; texto sobre a seleção a 6,4:1 |

Séries de gráfico (`--serie-*`): 3:1 sobre papel e marfim, salvo `serie-solar` e `serie-5`, que exigem rótulo direto e tabela equivalente. Escalas de mapa (`--escala-*`, `--san-div-*`) nunca são cor de texto. A aplicação do Crédito lê a mesma paleta (eixo e grade em `--cor-linha` e `--cor-mineral`, alerta em `--cor-aviso`, selos em `--cor-natureza-*`, saldo negativo em `--cor-negativo`); os tokens `--cor-credito-*` e o tema escuro próprio saíram na Iniciativa 2 do parecer de UX de 23/10/2026, e `design-tokens.test.ts` reprova `--cor-credito-*`.

## Escala tipográfica

Uma escala só, com classes de papel (não de domínio), em `globals.css`. Serifa (Playfair Display) nos títulos e números; Inter no texto; Archivo Narrow nos rótulos. Os corpos também são variáveis (`--tipo-rotulo`, `--tipo-meta`, `--tipo-tabela`, `--tipo-corpo`, `--tipo-lead`, `--tipo-h3`, `--tipo-h2`, `--tipo-h1`, `--tipo-numero-p`, `--tipo-numero-m`, `--tipo-numero-g`): as classes abaixo leem delas e a aplicação do Crédito, que não carrega o CSS do Next, usa as mesmas pelo `public/obs/tokens.css` derivado. Nenhum `font-size` em pixel nas folhas da aplicação (`credito-casca.test.ts`).

| Classe | Corpo | Uso |
| --- | --- | --- |
| `.t-h1` | clamp(2 rem, 1,4 rem + 2,2 vw, 3,2 rem), entrelinha 1,1, peso 400 | título da página (`.ed-h1` é alias) |
| `.t-h2` | clamp(1,5 rem, 1,2 rem + 1 vw, 2,1 rem) | título de seção (`.ed-h2`) |
| `.t-h3` | 1,25 rem | subtítulo (`.ed-h3`) |
| `.t-lead` | 1 rem no celular, 1,0625 rem a partir de 768 px | abertura (`.ed-lead`) |
| `.t-corpo` | 1 rem, entrelinha 1,55 | texto corrido |
| `.t-tabela` | 0,875 rem | tabela |
| `.t-meta` | 0,8125 rem (13 px) | nota, fonte, ressalva, código |
| `.rotulo` | 0,75 rem (12 px), caixa alta, 0,14 em, Archivo Narrow, peso 400 | rótulo de seção e metadado em caixa alta |

**Piso de 12 px.** Nenhum texto visível abaixo de 12 px, em nenhuma página, inclusive rótulo de eixo de gráfico em SVG. Conferido no código por `design-tokens.test.ts` (nenhum `font-size` abaixo de 0,75 rem fora de `@media print`, nenhum `text-[…]` abaixo disso, nenhum `!text-[`) e no navegador por `src/tests/ux-texto-minimo.test.ts` (as 37 rotas da seção 5 do parecer mais `/cadastro`, a 1440 e 390 px, com e sem sessão). Para achar a origem de um texto pequeno: `node scripts/ux-texto-minimo.mjs <base> <cookie ou -> <saida.json> <rotas…>`.

**Decisão do dono de 22/10/2026** (conflito registrado em 20/10/2026 entre o sistema da casa e a `design-taste-frontend`): os rótulos em caixa alta espaçada ficam como identidade, a 12 px; a numeração 01, 02, 03 sai dos cartões da página inicial e das portas; o destaque colorido no título fica só no H1 da página inicial; os filetes de 3 px na cor do observatório ficam.

## Números de destaque

Três tamanhos só, sempre em serifa com `font-variant-numeric: lining-nums tabular-nums`: `.numero-g` (2,25 rem), `.numero-m` (1,75 rem), `.numero-p` (1,35 rem). As classes aceitam variantes (`numero-m sm:numero-g`). Números grandes só para o indicador principal de cada bloco; a hierarquia vem do título, não de um número gigante.

## Fundo de página

Papel em todo `main`. Branco só em superfícies funcionais (controles, menus, cartões de laboratório). Marfim só como degrau de tom entre faixas.

## Selos de natureza do dado

Forma, glifo, rótulo e cor ao mesmo tempo; cor nunca é o único portador.

| Selo | Glifo | Borda | Cor | Significado |
| --- | --- | --- | --- | --- |
| OBSERVADO | ● | contínua | `#1A1D21` | valor publicado diretamente pela fonte primária |
| CALCULADO | ◆ | contínua | `#4A5158` | transformação determinística feita pela Scrutiniums, com fórmula |
| ESTIMADO | ◐ | contínua | `#7A5A12` | procedimento estatístico |
| PREVISTO | ◌ | tracejada | `#5B3F8C` | período futuro, sempre com modelo e versão |
| CENÁRIO | ◇ | pontilhada | `#6B4F3A` | simulação condicional; nunca previsão |

Componente: `SeloNatureza` (`src/components/evidencia/SeloNatureza.tsx`). Todo número de indicador leva selo; o tipo `Indicador` torna `natureza` obrigatória.

## Regra editorial incorporada ao componente

Toda visualização relevante é um `PainelEvidencia` com seis campos obrigatórios, na ordem:

1. **O que estou vendo?** (título em forma de pergunta ou conclusão, e subtítulo `indicador · unidade`)
2. **Por que isso importa?**
3. **O que mudou?**
4. **Como devo interpretar?**
5. **O que NÃO posso concluir?**
6. **Qual é a fonte?** (proveniência completa, drawer "Sobre este dado")

A obrigatoriedade é de tipo (TypeScript): um painel sem "o que não posso concluir" não compila.

## Componentes de evidência (compartilhados)

| Componente | Função |
| --- | --- |
| `SeloNatureza` | selo da taxonomia |
| `SobreEsteDado` | drawer de proveniência (diálogo acessível, Esc fecha, foco preso) com os campos do `MODELO_AUDITABILIDADE.md` |
| `PainelEvidencia` | bloco editorial de seis perguntas com gráfico e rodapé de fonte |
| `Indisponivel` | estado de ausência: motivo, última execução, informação faltante, estado do pipeline. Nunca exibe zero |
| `NumeroIndicador` | número grande com selo, período, variação e posição histórica |
| `ModoProfundidade` | alternância Entender, Analisar, Auditar sobre a mesma página |
| `Termo` | sigla com dica curta e link para o verbete completo |

## Gráficos

* Um gráfico só entra se responde a uma pergunta escrita no título. Ex.: "Quanta água está chegando ao Sudeste/Centro-Oeste?" com subtítulo `ENA · % da MLT`.
* Todo gráfico tem unidade, período, fonte, data de referência, tooltip, link de metodologia e download quando pertinente.
* Paletas validadas com o verificador de daltonismo da skill de visualização (ordem fixa; separação CVD entre séries adjacentes acima de 8; visão normal acima de 15). A primeira proposta (tons terrosos) falhou no piso de croma e na separação CVD e foi substituída. Fontes, nesta ordem: hidráulica `#256ABF`, térmica `#D95926`, eólica `#17966A`, solar `#C98500` (solar abaixo de 3:1 exige rótulo direto e tabela). Submercados: SE/CO `#4A3AA7`, S `#17966A`, NE `#D95926`, N `#2A78D6`. O verde era `#199E70` até o redesenho de 2026: media 3,21:1 sobre o papel `#FAF8F2` e 2,97:1 sobre o marfim `#F3EFE5`, abaixo dos 3:1 de elemento gráfico (WCAG 1.4.11) neste segundo fundo, e passou a `#17966A` (3,53:1 e 3,26:1; distâncias CIEDE2000 para o laranja de 14,6 na protanopia e 18,4 na deuteranopia, e para o azul de 10,5 na tritanopia). Sempre com rótulo direto no fim da linha e legenda; texto nunca na cor da série.
* Ausência é lacuna na linha, nunca zero. Previsão tracejada com faixa; cenário pontilhado.

## Acessibilidade

WCAG 2.2 AA: contraste de texto 4,5:1, alvos de toque de 44 px, foco visível na cor do acento, `prefers-reduced-motion` respeitado, tabelas equivalentes para todo gráfico, dicas acessíveis por teclado e toque.

## Mobile

Narrativa preservada em coluna única; cartões de submercado em grade 2×2; tabelas viram listas de definição; nenhuma rolagem horizontal fora do Data Explorer; drawer de proveniência em tela cheia.
