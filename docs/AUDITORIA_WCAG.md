# Auditoria de acessibilidade — WCAG 2.1 nível AA

**Data:** 3 de agosto de 2026 · **Ferramenta:** axe-core 4.12.1 · **Escopo:** as 23 páginas
do Observatório Brasileiro de Crédito, nos temas claro e escuro (46 combinações página×tema).
**Versão auditada:** SPA 0.43.3 → corrigida em 0.44.3.

Critérios avaliados: conjuntos de regras `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`.

---

## Resultado

| Regra | Impacto | Antes (claro) | Antes (escuro) | Depois |
|---|---|---:|---:|---:|
| `color-contrast` — razão mínima de contraste | sério | 173 nós | 34 nós | **0** |
| `scrollable-region-focusable` — região rolável sem foco | sério | 20 nós | 19 nós | **0** |
| `nested-interactive` — interativo dentro de interativo | sério | 1 nó | 1 nó | **0** |

Depois das correções: **0 violações em 46 combinações página×tema, com 830 verificações
de regra aprovadas.** Nenhuma outra regra do conjunto AA foi violada nem antes nem depois.

---

## O que estava errado, e por quê

### 1. Contraste (207 nós) — seis tokens, não duzentos problemas

O volume assustava, mas a origem era estreita: seis variáveis do design system,
usadas como cor de texto sobre fundos claros. Corrigir caso a caso teria sido
trabalho perdido; corrigir o token resolveu todas as ocorrências de uma vez.

Cada substituição é um **escurecimento multiplicativo** — o matiz é preservado,
só a luminosidade cai. A identidade visual não muda perceptivelmente.

| Token | Antes | Depois | Pior razão antes | Depois | Onde aparecia |
|---|---|---|---:|---:|---|
| `--warning` | `#a2670c` | `#925d0b` | 3,91 | 4,63 | selos "estimado"/"demonstração", chips de qualidade, nível de alerta |
| `--unavail` | `#8b8d85` | `#6e6f69` | 3,16 | 4,61 | nível "informativo" dos alertas |
| `--teal` | `#0f7c8c` | `#0e707f` | 3,94 | 4,60 | selo "dado calculado", nível de confiança |
| `--accent` | `#966b48` | `#8f6644` | 4,40 | 4,76 | "entenda esta página", links |
| `--text-3` | `#6b6d6a` | `#636562` | 4,11 | 4,63 | texto auxiliar (`.src`), barra de filtros |
| `--pix` | `#0e8f80` | `#0a6d61` | 3,02 | 4,60 | seletor de instrumento no painel Pix |

Dois casos exigiram tratamento próprio:

- **Tokens de gráfico usados como texto.** `--c-line2`, `--c-line3` e `--c-gray` repetiam
  os valores antigos e pintam o texto comparativo da página Mercado. Foram alinhados aos
  tokens semânticos correspondentes — o que mantém a paleta coerente e fecha a brecha.
  O cinza do **tema escuro** sobreviveu à primeira rodada exatamente por essa divergência,
  e só apareceu na segunda varredura.
- **Tema escuro.** Ali a correção é o oposto: `--text-3` (`#94907f` → `#979382`) e
  `--unavail` (`#8a877c` → `#969387`) precisaram **clarear**.

### 2. Regiões roláveis inalcançáveis pelo teclado (39 nós) — WCAG 2.1.1

Tabelas largas e mapas de calor rolam na horizontal dentro de um contêiner. Com mouse
se arrasta; por teclado não havia como chegar às colunas da direita, porque o contêiner
não recebia foco.

A correção é em tempo de execução (`acessibilizaRolagem`, em `public/obs/app.js`) e só
marca o que **de fato rola**: pôr foco em contêiner que não rola criaria paradas de
tabulação vazias, que é o defeito oposto. Como o que rola em 375 px pode não rolar em
1440 px, a avaliação é refeita a cada render e a cada mudança de largura — um
`MutationObserver` cobre também os re-renders internos (filtro, aba, busca), para que
nenhuma página nova precise se lembrar disso.

### 3. Mapa do Brasil declarado como imagem única — WCAG 4.1.2

O SVG do mapa trazia `role="img"` e, dentro dele, 27 unidades da federação com
`tabindex="0"` e `role="link"`. `role="img"` afirma que aquilo é um gráfico único; os
filhos interativos contradiziam a afirmação. Passou a `role="group"`, mantendo o
`aria-label`. As UFs continuam focáveis e acionáveis por Enter/Espaço pelo mecanismo
já existente na SPA (`a11yEnhance` + o handler global de teclado).

---

## Como isso não regride

Em duas camadas, com divisão de trabalho explícita.

**Automática, a cada commit** — `src/tests/wcag-contraste.test.ts` (42 testes).
Lê `public/obs/styles.css`, extrai os tokens dos dois temas e **recalcula** a razão de
contraste de cada par (texto × fundo) que a interface de fato usa, incluindo os fundos
gerados por `color-mix`. Reprova abaixo de 4,5:1. O cálculo foi validado contra o axe:
para os valores antigos ele devolve 3,92 / 4,41 / 3,17 — as mesmas razões que o navegador
mediu. O arquivo também guarda as correções estruturais (foco em rolagem, `role` do mapa,
teclado em clicáveis não nativos, `lang` do documento).

Está aqui, e não no navegador, porque **o que regride é o token**: quem alterar uma cor
do `:root` descobre no `npm test`, sem subir servidor nem baixar Chromium.

**Sob demanda, no navegador** — a varredura completa com axe:

```bash
node scripts/auditoria-wcag.mjs
```

Sobe a SPA estática, publica o `axe-core` de `node_modules` na mesma origem (a página não
carrega CDN) e imprime o procedimento. O trecho a colar no console é `scripts/wcag-sweep.js`;
ele percorre as 23 páginas nos dois temas em cerca de um minuto e deixa o resultado
completo em `window.__wcagResultado`.

Contraste depende de layout renderizado, de `color-mix` resolvido e do tema aplicado.
Um DOM simulado responde "não sei" justamente no critério que mais reprova — por isso a
auditoria completa é de navegador, e por isso ela é registrada aqui em vez de fingir
rodar sozinha.

---

## O que esta auditoria **não** cobre

Ferramenta automática verifica uma fração do WCAG — a literatura da própria Deque estima
entre 30 % e 40 % dos critérios. Fica de fora, e continua sendo trabalho humano:

- **Ordem de foco e foco visível em percurso real.** As regras conferem se o elemento é
  focável, não se a sequência faz sentido para quem navega só com teclado.
- **Leitor de tela.** Nada aqui foi testado com NVDA, JAWS ou VoiceOver. Rótulo presente
  não é rótulo compreensível.
- **Qualidade dos textos alternativos.** O axe exige que exista; não julga se descreve.
  Os gráficos publicam alternativa tabular (`details.charttable`), o que é a resposta
  substantiva — mas a adequação de cada descrição não foi revisada uma a uma.
- **Zoom a 200 % e reflow (1.4.10)**, **espaçamento de texto (1.4.12)** e **movimento**
  não foram avaliados sistematicamente.
- **Páginas de detalhe** — ficha de instituição, ficha de setor, ficha de produto —
  não entram na varredura, que percorre a navegação principal. Compartilham os mesmos
  componentes e tokens, então herdam as correções de contraste, mas não foram medidas.
- **Contraste de elementos gráficos (1.4.11)**, como as linhas dos gráficos contra o
  fundo, exige 3:1 e não foi verificado separadamente — as cores de série passam nos
  4,5:1 de texto, que é mais estrito, mas a espessura e a sobreposição não foram medidas.

Declarar esses limites é parte do resultado. Uma auditoria que diz "aprovado" sem dizer
no que não olhou vale menos do que a lista do que falta.
