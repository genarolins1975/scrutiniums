# Prompt: Iniciativa 1, molde único de página de painel (kit de evidência)

Data: 23/10/2026. Origem: `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md`, seção 5, I1. Base: `main` em `b825eb9e3`. Destinatário: o modelo que vai implantar (Codex, GPT, Claude ou outro). Cole o texto abaixo da linha inteiro, sem cortar as seções de guardrails, de testes e de aceite.

---

## 1. Papel e regra de ouro

Você vai dar a todas as páginas de painel da Scrutiniums a mesma anatomia, feita dos mesmos componentes, como as 19 páginas de entrada já têm (`EntradaColecao`). Hoje cada domínio desenha a própria abertura, o próprio número, a própria tabela e o próprio gráfico; o leitor que vai de uma coleção a outra reaprende a ler. O trabalho é de interface e de componentes: nenhum número, série, cálculo, fonte, período ou texto decidido pelo dono muda. O que muda é onde cada coisa fica, como se parece e qual componente a desenha.

Guardrails, sem exceção:

1. Ler inteiros, antes de qualquer código: `CLAUDE.md`, `AGENTS.md`, `.claude/skills/observatorio-layout/SKILL.md` e, com o PR #362 integrado, os anexos `arquiteturas.md`, `componentes-e-graficos.md`, `identidade-visual.md`, `navegacao.md` e `tema-acessibilidade-exemplos.md`; `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`; `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md` (seções 3, 4 e 5). Carregar as skills `emil-design-eng`, `impeccable` e `design-taste-frontend` (em conflito, prevalece a `observatorio-layout`).
2. Nunca apagar, pular ou afrouxar teste. Teste que fixa o desenho anterior muda de propósito, com a justificativa no PR e os invariantes preservados (natureza, período e prova de cada número, links válidos, teto de HTML).
3. Conteúdo não é apagado. O que não cabe vai para `Recolhido` (`src/components/observatorios/Recolhido.tsx`), com o conteúdo inteiro no HTML.
4. Nada de card com ícone, sombra, gradiente, cor como único portador de significado, verde ou vermelho como julgamento, número gigante como decoração, texto abaixo de 12 px, data em formato ISO ou com hora UTC na tela. Datas em `dd/mm/aaaa` ou `mmm/aaaa`.
5. Um PR por grupo (seção 5), base `main`, sem empilhar. Merge só com autorização explícita do dono na conversa. Nunca rebase, amend ou force push em branch que não é sua.
6. Antes de empurrar: `npm run verificar:pr` verde e `npm run evidencias` nas páginas alteradas. Um push validado vale mais que três especulativos.
7. Decisões pendentes do dono (seção 8) não se implementam sem resposta; o que já foi decidido (seção 8) não se reabre.
8. Comentários de código, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência.

## 2. Antes de começar

- Sessão nova: `bash scripts/preparar-sessao.sh` (dependências, derivados, Chromium compatível, heap de 4 GB). Nas sessões do Claude Code o hook já o chama.
- Build de produção para os testes de UX: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`. Os testes `ux-orcamentos-cromo`, `ux-orcamentos-comprimento`, `ux-texto-minimo` e `entrada-molde` só rodam com `.next/BUILD_ID`; no CI, `EXIGIR_BUILD_HTML=1`.
- Comandos: `npm run verificar:rapido` (lint, tipos, cobertura bilíngue e testes afetados), `npm run verificar:pr` (o que o CI roda), `npm run evidencias -- --rotas /a /b --saida docs/ux-AAAA-MM-DD/<tema> --larguras 390,1440 --modos com`.
- Inventário de tradução: `node scripts/cobertura-i18n.mjs --check`; o relatório não é versionado; conflito nele se resolve apagando.
- O Setor Elétrico tem irmã em inglês (`/en/setor-eletrico/*`). Todo componente do kit aceita `idioma` e os textos fixos do kit saem em `tx(pt, en)` (`src/lib/energia/idioma.ts`); nomes de observatório e coleção ficam em português, marcados com `<Nome>`.

## 3. O que existe e o que você vai construir

### 3.1 O que já é padrão e não muda

- Barra comum (`CabecalhoPlataforma` sobre `BarraPlataforma`), trilha (`Trilha`), navegação de coleção (`NavegacaoColecao`, catálogo em `src/lib/observatorios/navegacaoColecao.ts`), rótulo acima do H1 (`RotuloContexto`), faixa de frescor (`FaixaFrescor`), busca (`BuscaPlataforma`), fim de página (`ParaIrAlem`, `RodapeColecao`, `Footer`): a Iniciativa 4 do parecer mexe neles, você não.
- Molde das entradas (`src/components/observatorios/EntradaColecao.tsx`), `NumeroEscala`, `ModeloDidatico` (das entradas), `SeloProntidao`, `Recolhido`, `SeloComConta`, `ExportacaoComConta`.
- Tokens e escala: só `src/app/globals.css` define cor; classes `.t-h1`, `.t-h2`, `.t-h3`, `.t-lead`, `.t-corpo`, `.t-tabela`, `.t-meta`, `.rotulo` (12 px, caixa alta), `.numero-g`, `.numero-m`, `.numero-p`. Conferido por `src/tests/design-tokens.test.ts`.
- Kit de evidência existente em `src/components/evidencia/`: `SeloNatureza` (observado, calculado, estimado, previsto, cenário), `SobreEsteDado` (proveniência da série), `Indisponivel` (ausência nunca vira zero), `Termo`, `Unidade`, `ModoProfundidade`, `PainelEvidencia`.

### 3.2 O que não é padrão (inventário de 23/10/2026, `main` em `b825eb9e3`)

| Peça | Hoje | Onde |
|---|---|---|
| Abertura de página | 9 componentes: `CabecalhoModulo` (75 usos, Setor Elétrico), 4 `Abertura`, `AberturaGas`, `AberturaCredito`, `AberturaAgro`, `AberturaJudiciario` | `src/components/<domínio>/` |
| Faixa de números | 19 funções exportadas com nome em `Numero*`, `Faixa*`, `Destaque*`, `Resposta*`, `Escala*` (fora `FaixaFrescor`) | idem |
| Tabela | 9 componentes `Tabela*` em 3 domínios; `<table` escrita à mão em arquivos de 16 pastas | idem |
| Gráfico | 52 arquivos com `<svg viewBox` próprio; nenhuma biblioteca | idem |
| Regra editorial | `PainelEvidencia` em 10 arquivos (todos do Setor Elétrico); `SeloNatureza` em 34 (33 do Setor Elétrico) | |
| Prontidão escrita à mão | "RECORTE PARCIAL" no rótulo de `/contas-publicas/execucao`; numeração "01 ·" nas Contas; chips "1 2 3" no Saneamento | |
| Datas fora do padrão | "Updated on October 02, 2026" em `/gas-natural/precos` | |

Capturas que mostram a diferença de anatomia entre cinco domínios: `docs/ux-2026-10-23/evidencias/setor_eletrico_pld-1440-com-sessao-primeira-tela.jpg`, `eficiencia_estatal_saude_capitais-...`, `contas_publicas_execucao-...`, `gas_natural_precos-...`, `agronegocio_prato-...`.

### 3.3 O que o Setor Elétrico já tem e vira o kit

O Setor Elétrico é o domínio que cumpre o design system. O kit nasce dos componentes dele, movidos para `src/components/painel/` e generalizados (sem dependência de `src/lib/energia/*` além do idioma e do formato de número, que também se movem para `src/lib/painel/`).

| Componente de hoje | Vira no kit | O que generalizar |
|---|---|---|
| `src/components/energia/CabecalhoModulo.tsx` (forma com `lead`) | `AberturaPainel` | tirar o modo antigo (sem `lead`); `recorte`, `fonte`, `limite` e `acao` viram obrigatórios ou tipados; o bloco "Fontes, datas e siglas" continua recolhido |
| `src/components/energia/Numero.tsx` e `FaixaMetricas.tsx`, com `NumeroEscala` | `NumeroIndicador` e `FaixaNumeros` | um só componente de número para painel e entrada; `fonte`, `periodo` e `natureza` obrigatórios por tipo; "Comprove este número" opcional (`evidencia` ou `sobDemanda`); ausência com motivo |
| `src/components/evidencia/PainelEvidencia.tsx` | `FiguraAnalitica` | pergunta como título, subtítulo "indicador · unidade · universo", gráfico, leitura guiada, tabela equivalente obrigatória, fonte e "não permite concluir" obrigatórios; as outras perguntas editoriais opcionais |
| `src/components/energia/TabelaDados.tsx` e `TabelaInterativa.tsx` | `TabelaDados` | ordenação com estado visível, zero, ausência e inelegibilidade distintos, rolagem só na tabela no celular, CSV com `ExportacaoComConta` |
| `src/components/energia/Didatica.tsx` (`ParaLer`, `LeituraGuiada`) | `ParaLer`, `LeituraGuiada` | sem mudança de forma; o `ModeloDidatico` de lá se funde com o das entradas (um só, o das entradas, que exige a lista "deixa de fora") |
| `GraficoLinhas`, `GraficoBarras`, `GraficoPontos`, `GraficoDispersao`, `GraficosArea` | `GraficoLinhas`, `GraficoBarras`, `GraficoPontos`, `GraficoDispersao`, `GraficoArea` | contrato único (seção 4.9); paleta só de `--serie-*` |
| `ModoProfundidade` (Entender, Analisar, Auditar) | continua em `src/components/evidencia/`, opcional no molde | nada |

Os arquivos antigos passam a reexportar o kit (`export { AberturaPainel as CabecalhoModulo } from "@/components/painel"`) até a última migração, para o Setor Elétrico não quebrar no PR do kit; saem no último PR.

## 4. O kit: especificação

### 4.1 Pasta e nomes

`src/components/painel/`: `PaginaPainel.tsx`, `AberturaPainel.tsx`, `NumeroIndicador.tsx`, `FaixaNumeros.tsx`, `FiguraAnalitica.tsx`, `TabelaDados.tsx`, `Controles.tsx`, `ParaLer.tsx`, `LeituraGuiada.tsx`, `Grafico*.tsx`, `index.ts`. `src/lib/painel/`: `tipos.ts` (os tipos abaixo), `formato.ts` (número e data em português do Brasil, movido de `src/lib/energia/formato.ts`), `recorte.ts` (estado na URL).

### 4.2 `PaginaPainel`, o molde

Renderizado no servidor, `<main id="conteudo" data-painel="<rota>">`, com as fatias nesta ordem, cada uma num elemento com `data-fatia`:

1. `abertura` (`AberturaPainel`): rótulo do grupo quando a página está num grupo da navegação (ex.: "Preços e mercado"), H1 com até 60 caracteres, lead com até 220, linha de recorte ("período · universo · unidade · fonte curta"), uma frase de limite ("não permite concluir ..."), a primeira ação quando a página tem uma (busca de lugar, seletor de capital ou estado, seletor de exercício). O bloco "Fontes, datas e siglas" recolhido, no HTML.
2. `numeros` (`FaixaNumeros` com 1 a 4 `NumeroIndicador`).
3. `figuras` (uma ou mais `FiguraAnalitica`).
4. `tabelas` (`TabelaDados`), quando a página tem tabela que não é a equivalente de uma figura.
5. `controles` (`Controles`), sempre imediatamente antes do conteúdo que afeta; pode aparecer mais de uma vez (um por bloco afetado), nunca "flutuando" no topo da página sem conteúdo abaixo.
6. `notas` (`ParaLer`): glossário no ponto de uso, uma ou duas frases por termo, com exemplo calculado quando houver.
7. `metodo`: um só `<details>` no fim, com método, fontes, downloads (com `SeloComConta`) e `FaixaFrescor` variante método.
8. `fim`: o fim de página de hoje (`ParaIrAlem` e `RodapeColecao`), até a Iniciativa 4 fundir os dois; o molde só marca a posição.

Assinatura (TypeScript, abreviada):

```ts
type PaginaPainelProps = {
  rota: string;                       // endereço público; RotuloContexto e o teste leem por ele
  abertura: AberturaProps;            // seção 4.3
  numeros?: readonly NumeroProps[];   // 1 a 4
  notaNumeros?: ReactNode;            // ressalva da faixa inteira
  figuras?: ReactNode;                // só FiguraAnalitica e Recolhido
  tabelas?: ReactNode;                // só TabelaDados e Recolhido
  notas?: ParaLerProps;
  metodo: ReactNode;                  // obrigatório
  frescorMetodo?: ReactNode;
  profundidade?: boolean;             // mostra ModoProfundidade abaixo dos números
  idioma?: "pt" | "en";
  principal?: boolean;                // false quando o layout da coleção já abre o <main> (Agronegócio)
};
```

### 4.3 `AberturaPainel`

```ts
type AberturaProps = {
  grupo?: string;                     // "Preços e mercado"; nunca "01 ·", nunca estado de prontidão escrito à mão
  titulo: ReactNode;                  // H1, até 60 caracteres de texto
  lead: ReactNode;                    // até 220 caracteres
  recorte: { periodo: string; universo: string; unidade?: string; fonte: string };
  limite: ReactNode;                  // "não permite concluir ..."
  acao?: ReactNode;                   // a primeira ação do leitor
  fontesDatasSiglas?: ReactNode;      // recolhido
  siglas?: readonly string[];
  prontidao?: "parcial" | "piloto";   // vira SeloProntidao ao lado do grupo; nunca texto solto
};
```

Forma: filete de 3 px na cor do acento da coleção, H1 em `.t-h1`, lead em `.t-lead`, recorte em `.t-meta`, limite em `.t-corpo` com o prefixo fixo "Não permite concluir:", ação com rótulo visível. Nada mais antes dos números.

### 4.4 `NumeroIndicador` e `FaixaNumeros`

```ts
type NumeroProps = {
  rotulo: string;
  valor: number | null;               // null é ausência; nunca 0 no lugar de ausência
  formato?: "inteiro" | "decimal" | "percentual" | "reais" | "texto";
  casas?: number;
  valorTexto?: string;                // quando o valor já vem formatado (entradas, portas)
  unidade: string;
  periodo: string;                    // "set/2026", "30/09/2026", "12 meses até set/2026"
  recorte?: string;                   // "Nordeste", "famílias com renda até 2 salários"
  fonte: string;                      // obrigatório; curto
  natureza: Natureza;                 // obrigatório; SeloNatureza
  variacao?: { valor: number; base: string; unidade: "pp" | "%" | "absoluta" };  // "+2,53 R$/MWh em relação ao dia anterior"
  motivoAusencia?: string;            // obrigatório quando valor é null (o tipo exige: união discriminada)
  nota?: ReactNode;
  comprove?: Evidencia | { sobDemanda: ... };   // "Comprove este número", opcional
  href?: string;                      // "Ver no painel", só nas entradas e portas (SeloComConta automático)
  tamanho?: "g" | "m" | "p";          // classes .numero-g/.numero-m/.numero-p; "g" só para o principal do bloco
};
```

Forma: valor em serifa com algarismos tabulares, unidade em `.t-meta` ao lado, abaixo "recorte · período · selo", depois a variação em palavras ("alta", "queda"; nunca cor de julgamento), depois a fonte. `FaixaNumeros` desenha de 1 a 4 lado a lado separados por filetes, sem cartões, 2 por linha a 390 px. `NumeroEscala` das entradas passa a ser um alias de `NumeroIndicador` com `tamanho="g"` e `href`; o teste `entrada-molde` continua lendo `data-numero-escala` e `data-prova-numero`, que o novo componente também escreve.

### 4.5 `FiguraAnalitica`

```ts
type FiguraProps = {
  id: string;
  pergunta: string;                   // título, em pergunta ou conclusão factual
  subtitulo: string;                  // "indicador · unidade · universo"
  natureza: Natureza;
  children: ReactNode;                // um Grafico* do kit (ou MapaBrasil, quando a Iniciativa 5 existir)
  leitura?: ReactNode;                // LeituraGuiada: uma frase factual do mesmo contrato do gráfico, sem causa
  tabela: { colunas: string[]; linhas: (string | number | null)[][]; csv?: string; titulo?: string };  // obrigatória
  proveniencia: Proveniencia;         // obrigatória; abre SobreEsteDado
  naoConcluir: ReactNode;             // obrigatório
  porQueImporta?: ReactNode; oQueMudou?: ReactNode; comoInterpretar?: ReactNode;
  ressalva?: ReactNode;               // limitação material, sempre à vista, nunca em tooltip
  download?: { href: string; rotulo: string };   // rota de servidor fechada; SeloComConta automático
  nivel?: "entender" | "analisar" | "auditar";
  nivelTitulo?: 2 | 3;
};
```

Forma: título em `.t-h2` ou `.t-h3`, subtítulo em `.t-meta`, gráfico com largura total do bloco (não limitado à largura de texto), leitura guiada logo abaixo, "Tabela equivalente" em `<details>` com `TabelaDados`, rodapé com fonte (link "Sobre este dado"), ressalva e download. `naoConcluir` sempre visível no rodapé da figura.

### 4.6 `TabelaDados`

Props de hoje (`titulo`, `colunas`, `linhas`, `csv`, `limite`, `casas`) mais: `ordenavel?: boolean` (estado de ordenação visível no cabeçalho, com `aria-sort`), `ausencia?: Record<string, string>` (como mostrar null, "não elegível", "não publicado": sempre texto, nunca traço sem legenda), `fixarPrimeiraColuna?: boolean`, `rolagem: "tabela"` (padrão: no celular a tabela rola dentro do próprio bloco com sombra de borda indicando mais colunas; a página nunca rola na horizontal). Números à direita, algarismos tabulares, cabeçalho semântico (`<th scope>`). Exportação só por `ExportacaoComConta`.

### 4.7 `Controles` e estado na URL

```ts
type ControlesProps = {
  rotulo: string;                     // nome acessível do grupo ("Recorte da comparação")
  children: ReactNode;                // <select>, <input>, BuscaLugar; cada um com <label> visível
  limpar?: { href: string };          // link para o estado padrão
  resumo?: ReactNode;                 // "Mostrando 26 capitais, exercício 2025"
};
```

Todo controle escreve o recorte na URL (`?cap=`, `?uf=`, `?exercicio=`, `?ibge=`), lido no servidor para o HTML sair já no recorte pedido, e carregado de uma página a outra da mesma coleção pelo mecanismo `levar` da navegação (`src/lib/observatorios/navegacaoPura.ts`, `src/lib/eficiencia/temas.ts`). Sem JavaScript, a página mostra o recorte padrão e uma nota `<noscript>` (padrão já existe em `src/app/eficiencia-estatal/saude-capitais/layout.tsx`). Link compartilhado reproduz o recorte: é critério de aceite. Botões "Compartilhar recorte" por domínio saem; o "Salvar recorte" da barra (`FerramentasConta`) é o único.

### 4.8 `ParaLer` e `LeituraGuiada`

Sem mudança de forma em relação a `src/components/energia/Didatica.tsx`. `ParaLer` é a fatia `notas`; `LeituraGuiada` vive dentro de `FiguraAnalitica`.

### 4.9 Gráficos

Família `Grafico*` com contrato único (`src/lib/painel/tipos.ts`):

- `series`: `{ id, nome, pontos: { x: string | number; y: number | null }[] }[]`; `y: null` é lacuna na linha, nunca zero nem interpolação.
- `eixoY`: `{ unidade; zero?: boolean }`; barras sempre começam em zero (o tipo força `zero: true` em `GraficoBarras`).
- Rótulo direto no fim de cada linha; legenda só quando há mais de quatro séries; texto nunca na cor da série; cores só de `--serie-*` e `--escala-*` (tokens de `globals.css`), ordem fixa.
- A 390 px: menos marcas de eixo e anotações opcionais, nunca texto abaixo de 12 px nem gráfico encolhido até a ilegibilidade; o SVG tem `role="img"` e `aria-label` com a pergunta; a tabela equivalente é a alternativa textual.
- Previsão tracejada com faixa; cenário pontilhado; `prefers-reduced-motion` respeitado (sem animação de entrada).
- Nenhuma biblioteca nova. Os cinco gráficos do Setor Elétrico viram os cinco do kit; os demais 47 arquivos com SVG próprio migram para eles nos PRs de grupo, ou, quando a figura é um mapa, esperam o `MapaBrasil` da Iniciativa 5 (nesse caso a figura entra em `FiguraAnalitica` com o SVG antigo dentro, marcado `data-mapa-legado`, para o teste contar o que falta).

### 4.10 Tipos que impedem o erro

Em `src/lib/painel/tipos.ts`: `NumeroProps` é união discriminada (`valor: number` sem `motivoAusencia` ou `valor: null` com `motivoAusencia`); `fonte`, `periodo`, `natureza` são `string`/`Natureza` sem `?`; `FiguraProps.tabela`, `proveniencia` e `naoConcluir` sem `?`; `AberturaProps.recorte.fonte` e `limite` sem `?`; `prontidao` só pelos valores de `SeloProntidao`. Um painel sem "não permite concluir" não compila (regra do design system).

### 4.11 CSS e tokens

Todo texto do kit usa `.t-*`, `.numero-*` ou `.rotulo`; nenhum `font-size` novo. Nenhum hexadecimal, nenhum `--cor-*` redefinido. Os aliases de coleção (`--obs-*`, `--cp-*`, `--ce-*`, `--cn-*`, `--edm-*`, `--pv-*`, `--atlas-*`, `--gravura-*`, `--ink`, `--line`, `--muted`, `--paper`) saem de `globals.css`, `public/observatorios.css` e dos CSS por domínio à medida que cada grupo migra; `design-tokens.test.ts` passa a reprovar cada alias quando o grupo correspondente estiver no molde.

## 5. Plano de PRs

Um PR por linha, base `main`, nesta ordem. Título "Iniciativa 1, PR N: <nome>".

| PR | Nome | Conteúdo | Páginas |
|---|---|---|---|
| 0 | Kit | `src/components/painel/`, `src/lib/painel/`, `src/tests/painel-molde.test.ts`, `src/tests/suporte/paineis-molde.ts` (`NO_MOLDE_PAINEL` e `A_MIGRAR` com o grupo de cada página), reexportações nos arquivos antigos do Setor Elétrico. Três páginas de prova migradas, uma de cada tipo: `/setor-eletrico/pld` (números e figuras), `/setor-eletrico/qualidade` (busca de lugar e tabela) e `/setor-eletrico/conta-de-luz` com sessão (consulta com controles) | 3 |
| 1 | Grupo 1, os destinos mais procurados | Os destinos do bloco "Para você" das 12 entradas e o primeiro destino depois de "Início" de cada uma das 28 navegações de coleção, fora as entradas já no molde (`NO_MOLDE` de `src/tests/suporte/entradas-molde.ts`) e as vistas da aplicação do Crédito (`/observatorio/*`, Iniciativa 2). Lista exata na seção 5.1 | 32 |
| 2 | Grupo 2, Eficiência Estatal | Os 13 temas de `src/lib/eficiencia/temas.ts` (cerca de 69 rotas sob `/eficiencia-estatal`, 90 componentes em `src/components/eficiencia/`), em dois PRs se o diff passar de 60 arquivos: 2a (trabalho e renda, assistência, segurança alimentar, habitação, cultura), 2b (saúde, educação nas capitais, segurança pública, judiciário, acesso à justiça, saneamento nas capitais, mobilidade, meio ambiente, energia e conectividade, índice de resultados) | ~69 |
| 3 | Grupo 3, Contas Federais, Saneamento, Gás e Agronegócio | `/contas-publicas/*` (7 rotas e os capítulos dinâmicos), `/saneamento/*` (28), `/gas-natural/*` (12), `/agronegocio/*` (19) | ~66 |
| 4 | Grupo 4, painéis próprios dos observatórios | `/territorio/*` (7), `/conectividade`, `/educacao-municipal`, `/contas-publicas/previdencia`, `/custo-de-vida/*` (2), `/combustiveis/*` (2), `/contas-publicas-estaduais`: as páginas abaixo das entradas e as consultas com sessão | ~15 |
| 5 | Grupo 5, resto do Setor Elétrico e retirada dos antigos | As rotas de `/setor-eletrico/*` (80) ainda fora do molde; retirada de `CabecalhoModulo`, `Numero`, `FaixaMetricas`, `PainelEvidencia`, `TabelaDados`/`TabelaInterativa` de `energia/` e das reexportações; `A_MIGRAR` vazio; aliases de token fora; teste de importação proibida ligado | ~60 |

Entre cada PR, integrar o `main` na branch (merge, não rebase) e regenerar o que for gerado com a ferramenta do repositório.

### 5.1 Lista do Grupo 1 (32 páginas, calculada em 23/10/2026 de `paraVoce.ts` e `navegacaoDaColecao`)

```
/agronegocio/atlas
/agronegocio/clima-ambiente
/agronegocio/prato
/agronegocio/tamanho
/combustiveis/no-meu-estado
/contas-publicas/metas
/contas-publicas/por-area
/eficiencia-estatal/assistencia-social/necessidades
/eficiencia-estatal/cultura/rede
/eficiencia-estatal/educacao-municipal-capitais
/eficiencia-estatal/energia-conectividade
/eficiencia-estatal/habitacao/deficit
/eficiencia-estatal/indice-de-resultados
/eficiencia-estatal/judiciario/panorama
/eficiencia-estatal/meio-ambiente-clima/riscos
/eficiencia-estatal/mobilidade-transporte/tempo
/eficiencia-estatal/saude-capitais
/eficiencia-estatal/saude-capitais/gastos
/eficiencia-estatal/seguranca-publica/estados
/eficiencia-estatal/trabalho-renda/acesso-ao-trabalho
/gas-natural/gas-de-cozinha
/gas-natural/gnv-e-gas-encanado
/observatorio-do-credito/quanto-meu-banco-cobra
/observatorio-do-credito/simulador-da-parcela
/saneamento/municipio
/saneamento/preco-regulado/simulador
/saneamento/tarifa-social
/setor-eletrico/conta-de-luz
/setor-eletrico/inclusao-energetica/tarifa-social
/setor-eletrico/qualidade
/territorio/desastres
/territorio/queimadas
```

Observações: as páginas com versão aperitivo (`/setor-eletrico/conta-de-luz`, `/saneamento/municipio`, `/gas-natural/gas-de-cozinha`, `/contas-publicas/previdencia`, `/conectividade`, `/educacao-municipal`) migram só na versão com sessão (o painel completo); a versão aperitivo segue no molde `EntradaColecao` tipo `aperitivo`. `/saneamento/municipio` com sessão é a busca; a ficha `/saneamento/municipio/[id]` entra no Grupo 3. Páginas de consulta (`/combustiveis/no-meu-estado`, os simuladores) usam `AberturaPainel` com `acao` e o resultado em `FaixaNumeros` e `FiguraAnalitica`; o envelope `Consulta` é da Iniciativa 5 e não bloqueia este grupo.

## 6. Testes

### 6.1 Novo: `src/tests/painel-molde.test.ts`

Mesma infraestrutura de `src/tests/entrada-molde.test.ts`: `subirServidor` e `htmlDe` de `src/tests/suporte/servidor-producao.ts` (build de produção, banco PGlite temporário, sessão real; só roda com `.next/BUILD_ID`, reprova sem build quando `EXIGIR_BUILD_HTML=1`). Para cada rota de `NO_MOLDE_PAINEL`, com sessão:

- `<main data-painel="<rota>">` único; fatias conhecidas e na ordem (`abertura`, `numeros`, `figuras`, `tabelas`, `controles`, `notas`, `metodo`, `fim`; `controles` pode repetir);
- um só H1, com até 60 caracteres de texto; lead com até 220;
- `abertura` com `data-recorte` (período, universo, fonte) e `data-limite`;
- todo `[data-numero-indicador]` com `data-natureza`, `data-prova-numero` (fonte · período) e, quando `data-ausente`, o motivo;
- toda `[data-figura-analitica]` com `data-grafico` (ou `data-mapa-legado`), tabela equivalente (`<details>` com `<table>`), `data-proveniencia` e `data-nao-concluir`;
- nenhum `<table>` fora de `TabelaDados` (`data-tabela-dados`) ou da tabela equivalente;
- um só `<details data-fatia="metodo">`, última fatia antes de `fim`;
- nenhum texto visível com data ISO (`\d{4}-\d{2}-\d{2}`) ou "UTC"; nenhuma das formas antigas de prontidão (regex de `entrada-molde.test.ts`); nenhum rótulo de seção começando com dois algarismos e ponto médio ("01 ·") enquanto a decisão 7 da seção 8 estiver pendente;
- nenhum `data-view` ou `onclick` em link de navegação; links de recorte (`?cap=` etc.) resolvem a mesma página com o recorte (uma amostra por grupo: o HTML com `?cap=2704302` contém a capital escolhida no resumo dos controles).

Inventário: toda rota de painel do registro (`paineis()` de `src/lib/observatorios/registro.ts`, mais as rotas de `src/app` abaixo das entradas, listadas por `scripts/rotas-do-app.mjs`) está em `NO_MOLDE_PAINEL`, em `A_MIGRAR` (com o número do grupo) ou na lista de exceções com motivo (entradas no `NO_MOLDE` das entradas, versões aperitivo, aplicação do Crédito, páginas de método e glossário, páginas de dados). Nenhuma rota esquecida.

### 6.2 Estáticos

- Importação proibida (ligado no PR 5; na forma de `A_MIGRAR` antes): nenhum arquivo fora de `src/components/painel/` importa `CabecalhoModulo`, `Abertura*`, `Numeros*`, `FaixaMetricas`, `FaixaMedidas`, `FaixaResumo`, `Destaques*`, `Respostas*`, `Tabela*` de domínio, `PainelEvidencia` de `evidencia/`, `Grafico*` de domínio.
- `design-tokens.test.ts`: aliases retirados reprovados por grupo; nenhum `font-size` novo (já existe).
- `vocabulario.test.ts`: nada muda aqui (é a Iniciativa 4).

### 6.3 Testes que mudam de propósito

Os testes por domínio que fixam a ordem de seções, títulos ou classes do desenho anterior (ex.: `energia-conta.test.ts`, `saneamento-entrada.test.ts`, `obee-*.test.ts`, `contas-publicas-*.test.ts`) mudam com a migração, preservando os invariantes: natureza, período e prova de cada número, links válidos, textos decididos pelo dono, teto de HTML. Cada mudança de teste vai listada no PR com o motivo. Nunca `skip`, `todo` ou `only`.

## 7. Critério de aceite

Por página migrada (tabela no PR, uma linha por página):

| Medida | Exigido | Como medir |
|---|---|---|
| Molde | passa em `painel-molde.test.ts` | teste |
| Axe (WCAG 2.1 A e AA) | 0 violações a 1440 e 390 | `npm run evidencias` |
| Rolagem horizontal da página | 0 | `npm run evidencias` |
| Cromo até o conteúdo | até 230 px a 1440 e 200 a 390 | `npm run evidencias` (já medido) |
| HTML entregue | até 500 KB, ou exceção declarada no PR até a Iniciativa 4 tratar o peso | `stat .next/server/app/<rota>.html` |
| Texto mínimo | nenhum abaixo de 12 px | `ux-texto-minimo` (acrescentar as rotas do grupo) |
| Recorte na URL | link copiado reproduz o recorte | teste da amostra e conferência manual |
| Rubrica da skill (seção 10) | nota mínima 8 em cada um dos oito critérios, autoavaliação registrada; "não verificado" onde faltar evidência | tabela no PR |
| Antes e depois | capturas a 390 e 1440 px, primeira tela e página inteira | `docs/ux-AAAA-MM-DD/painel-grupo-N/` |

Por PR: `npm run verificar:pr` verde; nenhum número, série ou texto decidido pelo dono alterado (diff dos dados: zero); contagem de componentes retirados e de páginas no molde antes e depois na descrição; evidências versionadas na pasta do PR; descrição no modelo da seção 10.

Do conjunto (fim do PR 5): `A_MIGRAR` vazio; zero componente de abertura, número, faixa, tabela ou gráfico fora do kit (fora os mapas marcados `data-mapa-legado`, que a Iniciativa 5 troca); aliases de token fora; `PainelEvidencia` e `SeloNatureza` em toda página de painel.

## 8. Decisões já tomadas e decisões pendentes

Já decididas pelo dono (não reabrir): rótulos em caixa alta a 12 px ficam; numeração "01, 02, 03" saiu dos cartões da home e das portas (22/10/2026); filetes de 3 px na cor do observatório ficam; destaque colorido no título só no H1 da home; "seguir sempre o padrão de comprimento" (22/10/2026); cadastro e inglês fora do escopo; o Setor Elétrico é a referência do design system; o Crédito é a referência de entrada didática.

Pendentes (seção 8 do parecer; sem resposta, aplicar o padrão indicado e deixar a troca para um PR curto):

- Numeração de seções nos painéis (decisão 7): padrão deste prompt é sem numeração; se o dono mantiver, `AberturaPainel` e `FiguraAnalitica` ganham `numero?: number` desenhado pelo kit, nunca escrito no título.
- Gravuras e envelope `Consulta` (Iniciativa 5): não bloqueiam; as figuras raster de hoje ficam onde estão, fora do molde, marcadas `data-figura-legado`.
- Fim de página único e rótulo acima do H1 (Iniciativa 4): o molde só marca a fatia `fim` e usa o `RotuloContexto` como está.

## 9. O que não fazer

- Não migrar a aplicação do Crédito (`public/obs`, `/observatorio/*`): é a Iniciativa 2.
- Não criar segundo componente de número, abertura, tabela ou gráfico "para um caso especial"; o caso especial vira prop do kit ou `Recolhido`.
- Não mudar contratos de dado, leitores de gold, cálculos, arredondamentos, períodos ou fontes; problema de dado vai para issue, nunca para CSS.
- Não abrir rota fechada, não mexer em `src/lib/rotasPublicas.ts`, não tocar na política de acesso.
- Não instalar biblioteca de gráfico, de tabela ou de animação.
- Não resolver conflito em arquivo gerado editando o arquivo; regenerar com a ferramenta do repositório.
- Não entregar um PR com mais de um grupo nem com melhorias "de carona" fora do molde.

## 10. Como relatar

Descrição de cada PR, nesta ordem: o que muda para o leitor (duas frases); páginas migradas (lista com link); componentes retirados e criados (contagem antes e depois); verificações (`verificar:pr`, `painel-molde`, `evidencias`, com data e máquina); tabela de aceite da seção 7; testes que mudaram de propósito e por quê; riscos; pendências reais; "Merge só com autorização explícita do dono". Capturas antes e depois em `docs/ux-AAAA-MM-DD/painel-grupo-N/` com `evidencias.md`.

Ao fim de cada PR, uma mensagem de uma tela para o dono, que lê pelo celular: o que o leitor ganha, links das rotas migradas no preview da Vercel, o estado real (PR aberto, CI verde ou vermelho, o que falta) e uma pergunta só quando houver decisão dele pendente.
