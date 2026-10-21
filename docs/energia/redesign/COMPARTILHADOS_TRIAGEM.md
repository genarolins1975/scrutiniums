# Triagem dos pedidos compartilhados do redesenho de Energia

Consolida os pedidos de mudança compartilhada dos 16 arquivos de `docs/energia/redesign/pedidos/` e diz, para cada um, se o código atual já o atende. A triagem foi feita só por leitura (Read, Grep, `git log`, `git show`, `git diff`, `jq` e dois scripts que apenas leem arquivos). Nenhum build, `tsc`, `vitest` nem servidor foi executado, e nenhum outro arquivo do repositório foi alterado.

## Estado de referência

* Branch `claude/kind-mayer-v9tpwi`, leitura de 09/10/2026. HEAD no fim da leitura: `baf5d722f` (11:52).
* Árvore de trabalho no fim da leitura: M src/app/globals.css; M src/app/setor-eletrico/layout.tsx; M src/components/energia/AguaPagina.tsx; M src/components/energia/GraficoBarras.tsx; M src/components/energia/GraficoLinhas.tsx; M src/components/energia/GraficoPontos.tsx; M src/components/energia/PequenosMultiplos.tsx; M src/lib/energia/agua.ts; ?? src/components/energia/AguaPontes.tsx; ?? src/components/energia/AguaRestaurar.tsx; ?? src/components/energia/AguaTabela.tsx; ?? src/components/energia/BaixarImagem.tsx; ?? src/components/energia/MarcaRolagem.tsx; ?? src/lib/energia/imagem-grafico.ts.
* As linhas de código citadas valem para o HEAD (conferidas com `git show HEAD:arquivo`). A árvore de trabalho tem mudanças ainda não commitadas, de outras tarefas, que não avaliei: o botão "Baixar imagem" nos gráficos (`BaixarImagem.tsx`, `imagem-grafico.ts`, mais `GraficoBarras.tsx`, `GraficoLinhas.tsx`, `GraficoPontos.tsx` e `PequenosMultiplos.tsx`), uma divisão da página de Água (`AguaPagina.tsx`, `agua.ts`, `AguaPontes.tsx`, `AguaRestaurar.tsx`, `AguaTabela.tsx`) e a sombra de borda das tabelas roláveis (`MarcaRolagem.tsx`, `layout.tsx`, `globals.css`). Grep por "imagem", "sombra" e "mancha" nos 16 pedidos não acha nada, então nenhum pedido depende do botão nem da sombra. A divisão da página de Água não foi lida, e as linhas sobre Água valem para o HEAD. Nos arquivos modificados as linhas da árvore podem estar deslocadas em relação às citadas.
* O HEAD era 944408dde quando a leitura começou. Entraram depois, durante a leitura: aaba39243 (impressão digital julgada nas validações de Dados, `versao_codigo` no catálogo, aviso de troca de sinal); 2040ef6cd (MapaCalor com aviso de rolagem e coluna inicial, marcos do GraficoLinhas quebrados, Numero com recorte); f55eb9beb (limite efetivo do GraficoBarras, explicação do `+alterado` na ficha do dado); de8747d3b (links sem prefetch nas páginas com listas longas, propriedade `limite` no CabecalhoModulo); f5c49d494 (foco do `main` não rola a página ao topo em `ModoProfundidade`, busca por município sem aviso falso, listas de definição do PLD que quebram linha, rótulo "Baixar CSV da série completa"; só deslocou linhas citadas aqui); baf5d722f (texto de apoio `.text-xs` a 13 px no domínio Energia em `globals.css`; relido em AC-12). Os estados valem para o HEAD acima; 944408dde e os commits anteriores de hoje (52c49ebd0, 6a6b6a47b, f0d07bc89 e outros) aparecem como evidência nas linhas.
* Dados publicados: `jq -r .gerado_em` em `public/energia/gold/*.json` dá datas de 30/09 a 06/10/2026 (o mais recente entre os módulos é `mercado.json`, de 06/10 às 20:02); só `avaliacao.json` e `manifesto.json` são de 09/10 às 03:07. O último commit que tocou `public/energia/gold` foi 51747baf8 (09/10, 03:08). Por isso o que o pipeline corrigiu hoje (f76fd68ef, 3474c7f0b, 07512da6e, aaba39243) existe no código e ainda não nos dados que o leitor vê.

## Método e convenções

* **Fonte dos pedidos.** Os 16 arquivos de `docs/energia/redesign/pedidos/` foram lidos inteiros, mais `_coordenador.md`. Os dois `*.equivalencias.json` (Aprenda e Dados) foram abertos. Equivalências não entram nas contagens, porque o coletor `scripts/energia_equivalencias_dos_pedidos.py` lê sozinho os blocos `json` dos pedidos e os `*.equivalencias.json`.
* **Unidade de contagem.** Uma linha consolidada por pedido. Pedidos iguais de famílias diferentes viram uma linha só, com todas as origens na coluna Origem e a quantidade de arquivos de pedido que o fizeram na coluna N (Transição e Expansão contam como uma família, porque é um arquivo). A coluna Origem usa o formato FAMÍLIA-seção, com a seção como está no arquivo (`MODELOS-C1` é o item 1 de "Mudanças em componentes compartilhados", que no original não tem número; `MODELOS-F` é "Fora do meu escopo").
* **O que não é pedido.** Achados sem solicitação, decisões locais, equivalências para a matriz de preservação e registros do que o executor aplicou ficam fora das tabelas e estão resumidos em "Registros sem pedido de mudança". Se um achado traz uma ação concreta (por exemplo, trocar uma frase em arquivo de outro dono), entrou como linha.
* **Estados.** ATENDIDO: o código atual faz o que se pede (arquivo, linha ou commit na evidência). PARCIAL: parte feita, e a evidência diz o que falta. ABERTO: nada feito. OBSOLETO: o código mudou ou a premissa não vale mais. RECUSADO: recusa registrada em `_coordenador.md`; não há nenhuma (Grep por "recus" nesse arquivo não acha nada), então o estado aparece com zero linhas.
* **Pipeline com gold atrasado.** Quando o código do pipeline já foi corrigido e os dados publicados ainda não foram regerados, o estado é PARCIAL (a correção só chega ao leitor depois de executar o módulo).
* **Esforço.** P: até 30 linhas de código. M: um componente com teste. G: mais de um componente ou decisão de produto. Para pipeline, "só regerar" é P porque não exige código.
* **Impacto.** Número de `page.tsx` de `src/app/setor-eletrico` (são 70, das quais 5 dinâmicas) cujo fecho de importações alcança o componente. Obtido com um script de leitura (`fecho.py`, no diretório temporário da sessão) que percorre os `import` sem executar o aplicativo; é uma contagem de alcance, não de uso efetivo. Para pipeline, as páginas do módulo (`find ... -name page.tsx` por pasta).
* **Risco de regressão.** Testes de `src/tests` que citam o arquivo pelo nome (Grep -l), ou o atributo de DOM do componente (por exemplo `data-faixa-metricas`), ou que renderizam as páginas afetadas. Nenhum teste foi executado.
* **Números de medida.** Pixels, kB, CLS e tempos que aparecem como "segundo o pedido" são medidas dos executores, não refeitas aqui (sem navegador nem servidor). Os demais números vêm de comando ou leitura de arquivo indicados na evidência: `git`, Grep, `jq` em `public/energia/gold`, `csv.reader` em `public/energia/series` e contagem de palavras feita à mão.

## Resumo em números

* **174 pedidos consolidados** (linhas das tabelas), que reúnem **223 ocorrências** nos 16 arquivos (soma das origens citadas; um mesmo item de um arquivo pode alimentar duas linhas).
* **Por estado:** ATENDIDO 34, PARCIAL 21, ABERTO 117, RECUSADO 0, OBSOLETO 2.
* **Abertos e parciais:** 138 linhas, com esforço, impacto e risco na seção própria.
* **Fundidos entre famílias:** 25 linhas foram pedidas por duas ou mais famílias; a maior fusão tem 9 famílias.

| Tipo | Linhas | ATENDIDO | PARCIAL | ABERTO | RECUSADO | OBSOLETO |
| --- | --- | --- | --- | --- | --- | --- |
| Defeito visual | 18 | 12 | 0 | 6 | 0 | 0 |
| Acessibilidade | 12 | 3 | 4 | 5 | 0 | 0 |
| Celular | 11 | 4 | 1 | 6 | 0 | 0 |
| Desempenho e peso | 12 | 2 | 3 | 7 | 0 | 0 |
| Conteúdo | 22 | 4 | 2 | 16 | 0 | 0 |
| Pipeline e dado | 59 | 0 | 10 | 48 | 0 | 1 |
| Navegação e texto | 17 | 9 | 1 | 6 | 0 | 1 |
| Limpeza de arquivo sem uso | 23 | 0 | 0 | 23 | 0 | 0 |
| **Total** | **174** | **34** | **21** | **117** | **0** | **2** |

## Tabelas por tipo

### 1. Defeito visual (VI, 18 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| VI-01 | GraficoBarras: rótulo de categoria truncado com espaço sobrando (coluna proporcional ou quebra em duas linhas) | `src/components/energia/GraficoBarras.tsx` | CARGA-1.1 | 1 | ATENDIDO | 944408dde: `duasLinhas` (L98), coluna lateral do tamanho do maior nome até 42% da largura e 260 px (L282), uso em L536. No celular, rótulo longo em coluna vira barra horizontal com o rótulo acima (`virouHorizontal`). |
| VI-02 | GraficoBarras: linha de referência e eixo cruzam rótulos de categoria e de valor no celular | `src/components/energia/GraficoBarras.tsx` | CARGA-1.2; INCLUSAO-3; MERCADO-3 | 3 | ATENDIDO | 944408dde: `traco()` (L619) corta a base e as referências na faixa do rótulo de cada categoria e nos rótulos de valor. O teste novo cobre o corte pelo rótulo de valor; o corte pela faixa de categoria não tem teste próprio. |
| VI-03 | GraficoBarras: aviso "mostra só parte" com todas as categorias desenhadas e botão que só troca o texto | `src/components/energia/GraficoBarras.tsx` | CARGA-1.2 | 1 | ATENDIDO | 944408dde e f55eb9beb: o aviso exige `h > limiteEfetivo` ou `limiteInicial`, e `limiteEfetivo` (L300) tira o limite quando sobra menos que uma categoria. Teste novo em `energia-comp-grafico-barras.test.ts`. Não revalidado em 390 px (sem navegador). |
| VI-04 | GraficoBarras: série nula por construção (ano parcial) sem hachura de ausência | `src/components/energia/GraficoBarras.tsx` | CARGA-1.3 | 1 | ATENDIDO | 944408dde: `SerieBarra.opcional` (L39), tratada como "não se aplica" na dica e na tabela; teste "série opcional". |
| VI-05 | GraficoBarras: marca "sem dado" de 12 px fixos lida como pedaço da barra (7 de 14 colunas na pilha de subsídios) | `src/components/energia/GraficoBarras.tsx` | CONTA-4 | 1 | ABERTO | `GraficoBarras.tsx:316` `TAM_SEM_DADO = 12`. `opcional` não serve aqui: a Conta mostra SCEE e Lei 14.299 nulos como lacuna ("sem dado, ausência, não zero", pedido CONTA-7). Os 7 de 14 são do pedido, não recontados. |
| VI-06 | Cores repetidas com significados diferentes entre gráficos vizinhos da mesma página (faixa de cores própria por gráfico empilhado) | src/lib/energia/conta.ts; paleta em globals.css | CONTA-4 | 1 | ABERTO | `conta.ts:64` a `70` (composição da conta) e `:96` a `99` (subsídios) usam os mesmos tokens (`serie-comp-1`, `serie-solar`, `serie-sm-n`, `serie-termica`) para coisas diferentes. S6 ("mesma cor por entidade") está "em curso" em `_coordenador.md`. |
| VI-07 | Verde do Sul abaixo de 3:1 sobre a superfície do gráfico: escurecer o token | `src/app/globals.css` | VISAO-4 | 1 | ATENDIDO | `--serie-sm-s: #17966a` (`globals.css:44`); o comentário de L35 a L38 registra 3,53:1 e 3,26:1 sobre os dois fundos (6a6b6a47b e 363bce3b2). |
| VI-08 | Separar os tokens de comparação (`--serie-comp-*`) dos de submercado (`--serie-sm-*`) | `src/app/globals.css` | VISAO-4 | 1 | ABERTO | `globals.css:67` a `70` repete os quatro valores de `--serie-sm-*` (`#4a3aa7`, `#d95926`, `#17966a`, `#2a78d6`). |
| VI-09 | PequenosMultiplos: legenda por rótulo e traço; sem bloco vazio com número ímpar de painéis | `src/components/energia/PequenosMultiplos.tsx` | AGUA-1.2; QUALIDADE-6 | 2 | ATENDIDO | S15 (6f8627958): `PequenosMultiplos.tsx:209` ("A cor identifica o painel"); teste em `energia-comp-pequenos-multiplos.test.ts` (+46 linhas). |
| VI-10 | GraficoPontos: texto de sentido configurável (referência que não é meta) | `src/components/energia/GraficoPontos.tsx` | PERDAS-2 | 1 | ATENDIDO | 52c49ebd0: `textoSentido` (L86). `PerdasRegulatorio.tsx:95` passa "maior que no trecho anterior" e equivalentes. |
| VI-11 | GraficoLinhas: título opcional e dica ao lado da cruz sem cobrir a legenda | `src/components/energia/GraficoLinhas.tsx` | VISAO-3 | 1 | ATENDIDO | 6a6b6a47b: `semTitulo` (L100); a legenda da faixa já entra na mesma lista da legenda das séries (blocos de legenda a partir da L567). |
| VI-12 | GraficoLinhas: legenda interativa que gastava cerca de 90 px | `src/app/globals.css` | QUALIDADE-4 | 1 | ATENDIDO | S5: `globals.css:317` a `322` (botões de 32 px com ponteiro fino acima de 768 px; 44 px no toque). |
| VI-13 | Numero faixa: unidade longa que quebra e engorda a faixa (unidade curta ou quebra abaixo do valor) | `src/components/energia/Numero.tsx` | GERACAO-5 | 1 | ABERTO | Grep: `Numero.tsx` não tem unidade curta nem quebra controlada da unidade. Geração contornou passando `unidade="da geração possível"`; a diferença de 38 px é do pedido, não remedida. |
| VI-14 | FaixaMetricas: nota na largura da faixa (e não na de leitura) a partir de 1024 px | `src/components/energia/FaixaMetricas.tsx` | MERCADO-2 | 1 | ABERTO | `FaixaMetricas.tsx:31` `max-w-prose2` na nota. Os 85 px do pedido não foram remedidos. |
| VI-15 | MapaCalor: valor escrito na célula quando cabe (propriedade mostrarValor) | `src/components/energia/MapaCalor.tsx` | PLD-3 | 1 | ABERTO | Grep: `MapaCalor.tsx` não tem `mostrarValor`; a célula mostra só a cor, e o valor está na tabela equivalente e na dica. |
| VI-16 | Numero faixa: campo de recorte separado do período | `src/components/energia/Numero.tsx` | INCLUSAO-4 | 1 | ATENDIDO | 2040ef6cd: `recorte` (`Numero.tsx:45`, L101), escrito antes do período com ponto médio; usado em `inclusao-energetica/page.tsx` e `orcamento/page.tsx`. |
| VI-17 | GraficoBarras: rolar a caixa até a barra escolhida | `src/components/energia/GraficoBarras.tsx` | CONTA-4 | 1 | ATENDIDO | 944408dde: efeito de rolagem em `GraficoBarras.tsx:189`; as duas Conta locais não precisam mais consultar o DOM. |
| VI-18 | GraficoBarras: ranking que abre com 12 de 81 barras (densidade ou mostrar todas) | `src/components/energia/GraficoBarras.tsx` | CONTA-4 | 1 | ATENDIDO | 944408dde: `limiteInicial` (L80) com botão "Mostrar todas as N" (L855); `limiteInicial={12}` em `ContaTarifas.tsx` (2 usos) e `ContaReajustes.tsx` (1). A opção de densidade (barra de 14 a 18 px) não foi feita; o pedido aceitava qualquer uma das duas. |

### 2. Acessibilidade (AC, 12 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 | `aria-current` com `page` só quando a rota é a da própria aba, e `true` para a seção que contém a página | `src/components/energia/NavegacaoLocal.tsx` | APRENDA-1.1 | 1 | ABERTO | `NavegacaoLocal.tsx:77` marca `aria-current="page"` sempre que `id === atual`. Em verbete e trilha (páginas netas) `AprendaPagina.tsx:34` passa a seção como atual. |
| AC-02 | Botões de profundidade com 44 px no celular | `src/components/evidencia/ModoProfundidade.tsx` | MODELOS-C1 | 1 | PARCIAL | `ModoProfundidade.tsx:240`: `min-h-[40px]` com `[@media(pointer:coarse)]:min-h-[44px]` (regra presente desde 9c89b68f5). Falta o 44 px sem ponteiro grosso (janela estreita, emulação sem toque). |
| AC-03 | Botão Comprove este número com 44 px no toque | src/app/globals.css (.ed-faixa [`data-comprove`]) | MODELOS-C2 | 1 | PARCIAL | `globals.css:391` a `392`: 2rem com ponteiro fino e 2.75rem com `pointer: coarse`. Falta o 44 px sem ponteiro grosso. |
| AC-04 | Resumo Mais N siglas com 44 px | `src/components/energia/LegendaSiglas.tsx` | CONTA-5; INCLUSAO-6; PLD-2; QUALIDADE-9 | 4 | PARCIAL | `LegendaSiglas.tsx:60`: `min-h-[24px]` com `[@media(pointer:coarse)]:min-h-[44px]` (07512da6e). Falta o 44 px sem ponteiro grosso, que é o pedido de Inclusão (abaixo de 768 px ou sempre). |
| AC-05 | Descrição de cada nível visível no celular, não só no title | `src/components/evidencia/ModoProfundidade.tsx` | CONTA-5; VISAO-6 | 2 | ATENDIDO | `ModoProfundidade.tsx:253`: parágrafo `data-descricao-nivel` visível abaixo de 768 px (52c49ebd0). |
| AC-06 | Nome acessível distinto nas notas de painéis da mesma página | src/components/evidencia/PainelEvidencia.tsx (NotasDoPainel) | PERDAS-1 | 1 | ATENDIDO | `NotasDoPainel` aceita `nome` (L140 a L151) e `PainelEvidencia` passa `nome={r.pergunta}` (L100). `perdas/page.tsx:265` e `:357` e `custo-e-contexto/page.tsx:160` e `:210` passam `nome`. `NotasDoPainelNomeadas` foi removido (52c49ebd0). |
| AC-07 | Capítulos dentro de painel com título h3, não h2 | `src/components/energia/NavegacaoLocal.tsx` | QUALIDADE-3 | 1 | ATENDIDO | S3 (eaac0d3ba): `nivelTitulo` 2 ou 3 em `NavegacaoLocal.tsx:40` e `:45`. Grep -rln `nivelTitulo={3}` em src: 9 arquivos. |
| AC-08 | Distinguir medição, estimativa e previsão na própria barra (propriedade natureza) | `src/components/energia/GraficoBarras.tsx` | GERACAO-3 | 1 | ABERTO | Grep: `GraficoBarras.tsx` não tem propriedade `natureza`. Geração resolveu localmente em `GeracaoBarrasFontes.tsx`. |
| AC-09 | Padrão (hachura) por série além da cor, em barras empilhadas e em linhas | GraficoBarras.tsx; GraficoLinhas.tsx | GERACAO-3; GERACAO-7.5 | 1 | ABERTO | Grep: nenhuma propriedade `padrao` em `GraficoBarras.tsx` nem em `GraficoLinhas.tsx`; a única hachura é a de "sem dado". |
| AC-10 | Alvo de toque maior nas siglas com link dentro de frase (Termo) | `src/components/evidencia/TermoDica.tsx` | GERACAO-7.12; QUALIDADE-9 | 2 | ABERTO | `TermoDica.tsx:43` e `:61`: a altura de 44 px só existe com a propriedade `alvo`; em texto corrido o link fica inline sem padding vertical. |
| AC-11 | Mapas: percorrer regiões e marcas pelo teclado e agrupar marcas sobrepostas | MapaCoropletico.tsx; TerritorioMapa.tsx; GeracaoMapaUsinas.tsx | VISAO-5; GERACAO-7.9 | 2 | ABERTO | `MapaCoropletico.tsx:844` ainda diz "pelo teclado, use a busca". Geração oferece a lista das 10 maiores usinas como porta de teclado (segundo o pedido, não retestado). |
| AC-12 | Texto de 11,5 px e fonte raiz a 200% (selos, chips, legendas) | src/app/globals.css e SVGs dos gráficos | CARGA-1.6 | 1 | PARCIAL | `globals.css:266` a `267` fixa `.dominio-energia .rotulo` em 0.75rem, e baf5d722f levou o texto de apoio (`.text-xs`) a 0.8125rem, 13 px (L270). Nos SVG: `fontSize="10"` (marcos do GraficoLinhas), `"11"` em GraficoPontos, Histograma e GraficoLinhas (Grep -o). O teste a 200% de fonte exige navegador e não foi feito. |

### 3. Celular (CE, 11 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| CE-01 | Faixa de abas em duas colunas no celular | src/app/globals.css; NavegacaoLocal.tsx | AGUA-1.1; PLD-2 | 2 | ATENDIDO | S14 (6f8627958): `globals.css:304` `ol.nav-faixa { column-gap: 0.25rem }`. `_coordenador.md` S14 registra 87 px para quatro abas e 132 px para cinco; não remedido aqui. |
| CE-02 | Variante compacta da faixa de métricas (duas colunas a partir de 360 px) | src/components/energia/FaixaMetricas.tsx; globals.css | DADOS-6; EMPRESAS-2 | 2 | ABERTO | `globals.css:348` a `351`: abaixo de 640 px a faixa tem uma coluna; `FaixaMetricas.tsx` não tem variante compacta. Medidas dos pedidos, não refeitas: primeira figura em y de 1171 a 1390 (Dados) e de 1416 a 1955 (Empresas), em 390 por 844. |
| CE-03 | Cabeçalho do módulo mais baixo: título em uma linha, recorte e fonte juntos | src/components/energia/CabecalhoModulo.tsx; globals.css | GERACAO-4 (7.10); PLD-2 | 2 | ABERTO | `CabecalhoModulo.tsx:83` `max-w-4xl` no h1; `globals.css:341` `.ed-meta` com flex-wrap. Alturas do pedido de PLD (257 px em 1440, cerca de 330 px em 390) não remedidas. de8747d3b ainda somou a linha `limite` ao cabeçalho. |
| CE-04 | Variante compacta do GraficoLinhas com zoom e legenda interativa | `src/components/energia/GraficoLinhas.tsx` | PLD-2 | 1 | PARCIAL | S5 reduziu a legenda (`globals.css:317` a `322`). Os botões de período, "Ajustar início e fim" e a linha de estado seguem empilhados (`GraficoLinhas.tsx`, bloco de zoom antes da L567). |
| CE-05 | MapaCalor: aviso de rolagem e coluna inicial na hora do pico | `src/components/energia/MapaCalor.tsx` | CARGA-1.5 | 1 | ATENDIDO | 2040ef6cd: `colunaInicial` (L63, L109) e `dataset.maisDireita` (L107); `CargaPerfil.tsx` passa a hora do pico mais frequente. |
| CE-06 | GraficoLinhas: rótulo de marco dentro da área do gráfico em 390 px | `src/components/energia/GraficoLinhas.tsx` | CARGA-1.4 | 1 | ATENDIDO | 2040ef6cd: `quebraEmLinhas` (L135) e `marcosVisiveis` com `ancora` start ou end e até três linhas (L354); teste em `energia-comp-grafico-linhas.test.ts`. |
| CE-07 | GraficoPontos no celular: altura da caixa, centralização vertical e piso de 11 px | `src/components/energia/GraficoPontos.tsx` | QUALIDADE-9 | 1 | ABERTO | `GraficoPontos.tsx` só mudou em 52c49ebd0 (textoSentido). Vista parcial de 11 em 51 linhas e faixa vazia de 136 px em 320 px são do pedido, não remedidas. |
| CE-08 | Histograma em 390 px: rótulo do limite cortado e P25, Mediana e P75 sobrepostos | `src/components/energia/Histograma.tsx` | QUALIDADE-9 | 1 | ABERTO | `Histograma.tsx` não mudou desde dcad322a4 (30/09). Grep -o `fontSize`: 11 em quatro pontos e 12 em dois. |
| CE-09 | GraficoBarras com texto de 12 px abaixo de 640 px | `src/components/energia/GraficoBarras.tsx` | CONTA-4 | 1 | ATENDIDO | `GraficoBarras.tsx:244`: `FS = w < 640 ? 12 : 11` (944408dde). |
| CE-10 | Cabeçalho do site em três camadas na inicial: fundir ou recolher | `src/components/energia/CabecalhoEnergia.tsx` | INICIAL-5 | 1 | ABERTO | `CabecalhoEnergia.tsx` mantém a barra superior (L36) e a navegação por grupos (L64), duas faixas; sem variante da inicial. Os 185 px e as 16 paradas de Tab são do pedido, não remedidos. |
| CE-11 | Tabela que vira lista de blocos no celular (TabelaAdaptativa) como componente do sistema | `src/components/energia/PrevisoesTabela.tsx` | MODELOS-C5 | 1 | ABERTO | Pedido opcional. O componente continua local a Previsões; `TabelaInterativa` não tem esse modo. |

### 4. Desempenho e peso (PE, 12 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| PE-01 | Sobre este dado: montar o corpo na primeira abertura | `src/components/evidencia/SobreEsteDado.tsx` | CONTA-6; QUALIDADE-8; PLD-4; VISAO-1 | 4 | ATENDIDO | S10 (7f779b175): `setMontado(true)` (L79) e `{montado && ...}` (L114). f55eb9beb acrescentou a explicação do sufixo `+alterado`. |
| PE-02 | Ficha Comprove lida só ao abrir (prova sob demanda) em vez do objeto inteiro no HTML e no fluxo | Numero.tsx; ComproveNumero.tsx e as páginas | CONTA-6; QUALIDADE-8; PLD-4; VISAO-2 | 4 | PARCIAL | O mecanismo existe (`ComproveNumero.sobDemanda`; `Numero.sobDemanda`, 6a6b6a47b). Grep: `sobDemanda` aparece em 9 arquivos (Visão geral, inicial, Geração); `evidencia={` aparece em 80 arquivos de src/app e src/components, entre eles os `page.tsx` de Inclusão (7 ocorrências), Qualidade (6), Expansão (5), Empresas (5) e Água e clima (5). |
| PE-03 | Menus do cabeçalho do site: não levar o conteúdo dos grupos ao HTML e ao fluxo de todas as páginas | src/components/energia/CabecalhoEnergia.tsx; layout/DetalhesFechaveis.tsx | CONTA-6; QUALIDADE-8 | 2 | ABERTO | `DetalhesFechaveis` é o menu do `CabecalhoEnergia` (L70 e L106), não um componente da Conta. 11,4 kB (Conta) e 22 kB (Qualidade) são medidas dos pedidos. |
| PE-04 | GraficoBarras: menos SVG por barra (classes em vez de atributos, alvo único, montar só as barras perto da janela) | `src/components/energia/GraficoBarras.tsx` | CONTA-6 | 1 | PARCIAL | `limiteInicial` monta só as 12 primeiras até o clique (3 usos, todos na Conta). Continuam: atributos repetidos por barra e dois alvos por barra. Os 560 B por barra são do pedido. |
| PE-05 | GraficoPontos: estilo por classe e defs compartilhados no lugar de atributos por marca | `src/components/energia/GraficoPontos.tsx` | QUALIDADE-8 | 1 | ABERTO | Sem alteração além de 52c49ebd0. O pedido mede cerca de 1 kB por ponto (55 kB no gráfico de DEC) e 148 kB de atributos `class` na página; não remedido. |
| PE-06 | MapaCalor: classes e variáveis CSS no lugar de atributos por célula | `src/components/energia/MapaCalor.tsx` | PLD-3 | 1 | ABERTO | Os 138 kB (Histórico) e 91 kB (Limites) são do pedido; não remedidos. A grade larga continua no HTML. |
| PE-07 | Termo: não levar o texto da definição ao HTML de cada ocorrência | src/components/evidencia/Termo.tsx; TermoDica.tsx | PLD-4 | 1 | ABERTO | `Termo.tsx:22` passa `dica` como prop do componente cliente em cada uso. Termo alcança 43 das 70 páginas. |
| PE-08 | Tabela do ranking da Conta sob demanda (decisão de produto) | `ContaTarifas.tsx` | CONTA-6 | 1 | ABERTO | Decisão: custa um clique no Analisar. Pesos do pedido (681.301 B e 621.766 B em 09/10, antes de 944408dde) não remedidos. Tetos de teste em `energia-conta.test.ts:2027` e `:2028`. |
| PE-09 | TabelaInterativa: tamanhos de página de 10 e 12 linhas | `src/components/energia/TabelaInterativa.tsx` | DADOS-5 | 1 | ATENDIDO | 944408dde: `tamanhoPagina?: 10 \| 12 \| 25 \| 50 \| 100 \| 200` (L75 a L76) e lista de tamanhos com o valor no início (L213). |
| PE-10 | Montar os níveis Analisar e Auditar só quando abertos | `src/components/evidencia/ModoProfundidade.tsx` | AGUA-1.4 | 1 | ABERTO | `ModoProfundidade.tsx` renderiza os três níveis (CSS os esconde). Pesos do pedido (429, 464 e 433 KB) não remedidos. |
| PE-11 | Desligar o prefetch dos links da faixa de abas | `src/components/energia/NavegacaoLocal.tsx` | AGUA-1.4 | 1 | PARCIAL | de8747d3b criou `LinkSemPrefetch.tsx` e o aplicou às páginas com listas longas (inicial, Visão geral, Território, catálogo, regras, distribuidoras, Aprenda). `NavegacaoLocal.tsx:1` continua com `next/link` padrão. |
| PE-12 | Deslocamento de layout (CLS) vindo de componentes compartilhados | não identificado | GERACAO-7.11 | 1 | ABERTO | O pedido não aponta componente nem medida. Não verificado: CLS exige navegador. |

### 5. Conteúdo (CO, 22 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| CO-01 | CabecalhoModulo sem seletor de profundidade: mostrar a legenda de siglas à vista (opção siglasVisiveis) | `src/components/energia/CabecalhoModulo.tsx` | APRENDA-1.3 | 1 | ABERTO | `CabecalhoModulo.tsx:90` abre "Fontes, datas e siglas" só em Auditar (`abreEm="auditar"`). O Aprenda não tem seletor e usa um cabeçalho próprio (`AprendaCabecalho`, em `AprendaPagina.tsx`, `AprendaVerbete.tsx` e na página de trilha). |
| CO-02 | Busca da inicial: resultado Conceito abre pela pergunta prática do verbete e reaproveita buscarVerbetes | BuscaObservatorio.tsx; home.ts | APRENDA-1.4 | 1 | ABERTO | Grep: `BuscaObservatorio.tsx` e `home.ts` não usam `perguntaPratica` nem `buscarVerbetes`; só `AprendaIndice.tsx:148` usa `buscarVerbetes`. |
| CO-03 | Verbetes ONS, CCEE, ANEEL, EPE, IBGE e Sistemas Isolados; Termo na linha de fontes da inicial e Sistemas Isolados no mapa | conceitos-instituicoes.ts; src/app/setor-eletrico/page.tsx | INICIAL-1; INICIAL-8 | 1 | PARCIAL | Feito pelo Aprenda (cbb5fbfeb): `aneel` (L50), `ons` (L92), `ccee` (L144), `epe` (L192), `ibge` (L225) e `sistemas-isolados` (L254), registrados em `conceitos-modulos.ts:21`. Falta: `page.tsx:634` ainda escreve a linha de fontes em texto simples; Grep não acha `sistemas-isolados` na inicial nem no mapa conceitual. |
| CO-04 | Dica do Termo com a frase em palavras simples antes da definição da fonte | `src/components/evidencia/Termo.tsx` | INICIAL-2 | 1 | ATENDIDO | S11 (8832a8d05): `Termo.tsx:14` a `20`, "Na fonte:" depois da frase simples. |
| CO-05 | Verbete DEC com a limitação sobre o apurado e os expurgos | `src/lib/energia/conteudo/conceitos-qualidade.ts` | INICIAL-7 | 1 | ATENDIDO | S13 (7f779b175): `conceitos-qualidade.ts:67` ("O DEC divulgado é o apurado: a regra exclui da conta ..."), sem número. |
| CO-06 | Verbetes de despacho, ordem de mérito, inflexibilidade, razão elétrica e fator de capacidade | `src/lib/energia/conteudo/conceitos-geracao.ts` | GERACAO-7.7 | 1 | ABERTO | `conceitos-geracao.ts` só tem `constrained-off` (L30); `cvu` está em `conceitos.ts:279`. Grep não acha os outros cinco slugs. Exige fonte primária (APRENDA-4 não os tratou). |
| CO-07 | Verbetes de Cadastro Único, MI Social, POF, PNAD e PASI | `src/lib/energia/conteudo/conceitos-inclusao.ts` | INCLUSAO-7 | 1 | ABERTO | `conceitos-inclusao.ts` só tem `tarifa-social` (L17). Grep não acha os cinco slugs. Exige fonte primária (APRENDA-4 não os tratou). |
| CO-08 | Verbete Perdas não técnicas: trocar "decorre principalmente de" por "inclui" | `src/lib/energia/conteudo/conceitos-perdas.ts` | PERDAS-6 | 1 | ABERTO | `conceitos-perdas.ts:81` mantém "decorre principalmente de furto, fraude e erros de medição e de faturamento". Texto conferido: decisão do dono do conteúdo. |
| CO-09 | Palavras que o guia evita em texto conferido (porque, regras atuais, representaria melhor) | evidencias-verbetes.ts:386; conceitos-geracao.ts:96; trilhas.ts:220 e :242; conceitos-agua.ts:142 | APRENDA-3 | 1 | ABERTO | Grep confirma as cinco ocorrências nas linhas indicadas pelo pedido. São achados do Aprenda, sem pedido explícito; ficam com o dono do conteúdo (fonte ou outro módulo). |
| CO-10 | Selo MISTO na natureza dos dados (medição, previsão e estimativa somadas) | src/lib/energia/tipos.ts; SeloNatureza | GERACAO-7.1 | 1 | ABERTO | `tipos.ts:8`: `Natureza` tem cinco valores (OBSERVADO, CALCULADO, ESTIMADO, PREVISTO, CENARIO). Decisão de produto. |
| CO-11 | RecortePainel compartilhado com período, universo e unidade | novo componente; 24 componentes de src/components/energia com `data-recorte-painel` | PERDAS-4; GERACAO-2 | 2 | ABERTO | Grep -rl `data-recorte-painel` em src: 26 arquivos (24 em src/components/energia, `conta-de-luz/partes.tsx` e `energia-agua.test.ts`). Não existe `RecortePainel`. |
| CO-12 | Arquivos exportados com metadados, unidade, descrição de coluna e decimal padronizado | src/lib/energia/tabela.ts; CSV de public/energia/series | GERACAO-7.2; GERACAO-8.9; CARGA-1.9 | 2 | ABERTO | `tabela.ts` não tem `descricao` em `ColunaTabela`. `TabelaInterativa.tsx:45` a `46`: só a planilha leva fonte, versão e dicionário. Cabeçalhos lidos de `agua_reservatorios.csv` e `geracao_restricao_diaria.csv`: nomes de coluna sem unidade. |
| CO-13 | Histograma: o resumo em texto segue os marcadores pedidos | `src/components/energia/Histograma.tsx` | GERACAO-7.3 | 1 | ABERTO | `Histograma.tsx:470` e vizinhas listam mínimo, P10, P25, mediana, P75, P90 e máximo sempre, mesmo com `marcadores={["mediana"]}`; só a legenda (L282) segue os marcadores. |
| CO-14 | Uma só porta para a mesma tabela (tabela do gráfico escondida quando há TabelaInterativa) | GraficoBarras.tsx; GraficoLinhas.tsx | GERACAO-7.4 | 1 | ABERTO | `GraficoBarras.tsx:868` e `GraficoLinhas.tsx:807` mantêm "Dados do gráfico em tabela"; só Água esconde por CSS (`AguaArmazenamento.tsx:288`). |
| CO-15 | PainelEvidencia: proveniência por valor do controle (ou dois chips rotulados pela fonte) | `src/components/evidencia/PainelEvidencia.tsx` | GERACAO-7.6 | 1 | ABERTO | `PainelEvidencia.tsx` recebe uma proveniência principal e `complementares` fixas; não há troca por valor de controle do cliente. |
| CO-16 | CapitulosComResposta compartilhado (resposta, número, limite e link por capítulo) | novo componente; NavegacaoLocal.tsx | EMPRESAS-1; MERCADO-1; TRANSICAO-1 | 3 | ABERTO | Grep `data-navegacao-local="capitulos"`: cinco cópias locais (`EmpresasPagina.tsx:64`, `ExpansaoPagina.tsx:76`, `MercadoPainel.tsx:224`, `TransicaoPagina.tsx:61` e `conta-de-luz/page.tsx:714`). `NavegacaoLocal` só aceita rótulo e descrição por item. |
| CO-17 | SeguirPainel: a lista de arquivos abre sozinha em Analisar e Auditar | `src/components/energia/SeguirPainel.tsx` | INCLUSAO-1 | 1 | ABERTO | `SeguirPainel.tsx:33` `abreEm="nunca"`; `DetalheDoNivel` já aceita `analisar`. |
| CO-18 | Regra de ordem de `[data-resposta]` não alcançar SecaoDoPainel (exceção explícita ou flex-col) | src/app/globals.css; SecaoDoPainel.tsx | QUALIDADE-5; INCLUSAO-2 | 2 | PARCIAL | S4: `RespostaCurta.depois` (L28, L30) e `globals.css:315`. `SecaoDoPainel.tsx:35` ainda usa `space-y-4`, então uma resposta direta nela sobe; a Inclusão contorna com `div`. |
| CO-19 | Links com parâmetro (?dist= ou ?mun=) levarem ao bloco de Qualidade que reage a ele | inicial page.tsx; territorio.ts; empresas.ts | QUALIDADE-2 | 1 | ABERTO | `page.tsx:545` ainda usa `ancora="p051"`; `territorio.ts:1177` e `:1185` e `empresas.ts:905` sem âncora. As âncoras existem: `comparar-distribuidoras` (`qualidade/page.tsx:691`) e `mapa-municipios` (L533). |
| CO-20 | Território aceitar ?busca= vindo da inicial | TerritorioExplorador.tsx; BuscaObservatorio.tsx | INICIAL-3 | 1 | ATENDIDO | 07512da6e: `TerritorioExplorador.tsx:251` lê `?busca=`; `BuscaObservatorio.tsx:123` monta o link com o texto digitado. |
| CO-21 | MapaCoropletico: detalhe por região na dica e na seleção ("maior de 22 conjuntos") | `src/components/energia/MapaCoropletico.tsx` | QUALIDADE-7 | 1 | ATENDIDO | 52c49ebd0: `detalheRegiao` (L113); `QualidadeMapa.tsx:208` o usa. |
| CO-22 | Rótulo vejaNoPortal do verbete de Rede e documentos com a pergunta antiga do P029 | conceitos-rede.ts; MATRIZ_PAINEIS.md; ESPECIFICACAO.md; modulos/rede.md | CARGA-1.8 | 1 | ABERTO | `conceitos-rede.ts:85` ainda diz "De onde vem a diferença de energia?"; também em `MATRIZ_PAINEIS.md:82`, `ESPECIFICACAO.md:1295` e `modulos/rede.md:27` e `:167`. `rede.ts:63` já usa a pergunta nova. Nenhum teste compara esse rótulo. |

### 6. Pipeline e dado (PD, 59 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| PD-01 | Água: publicar P10, mediana e P90 da ENA de 30 dias por data (série semanal) | agua_detalhe.py; agua_detalhe.json (afluencia) | AGUA-2.1 | 1 | ABERTO | `afluencia.serie_30d_semanal` só tem N, NE, S, SE, SIN, d0 e passo_dias; `p10_30d`, `p50_30d` e `p90_30d` existem só para o dia de referência (`afluencia.subsistemas[]`). Gold gerado em 2026-10-01T07:51:56Z. |
| PD-02 | Água: data e período da maior diferença entre a soma das usinas e a ENA do subsistema | `agua_detalhe.py` | AGUA-2.2 | 1 | ABERTO | O bloco de reconciliação por subsistema tem `dias`, `dias_dentro_0_1pct`, `max_dif_rel_pct` e um `exemplo` de um dia; não tem a data da maior diferença. |
| PD-03 | Água: faixa da ENA também em MWmed ou com a MLT fixa | `agua_detalhe.py` | AGUA-2.3 | 1 | ABERTO | `afluencia.subsistemas[]` tem `faixa_30d`, `p10_30d`, `p50_30d` e `p90_30d` (em % da MLT, segundo o pedido) e valores em MWmed só do dia (`ena_mwmed_dia`, `mlt_mwmed_dia`); não há série por data em MWmed nem com MLT fixa. |
| PD-04 | Água: chuva diária desde 2001 ou climatologia de 30 dias por data | agua_detalhe.py; agua_precipitacao_bacias_diario.csv | AGUA-2.5 | 1 | ABERTO | A primeira linha de dados de `agua_precipitacao_bacias_diario.csv` é 2016-01-01. |
| PD-05 | Água: publicar Spearman e correlação sobre anomalia padronizada | `agua_detalhe.py` | AGUA-2.6 | 1 | ABERTO | Grep por spearman em `agua_detalhe.json`: 0 ocorrências. |
| PD-06 | Água: conferência com estações separada do produto IMERG Late e por bacia | `agua_detalhe.py` | AGUA-2.7 | 1 | ABERTO | `clima.validacao_estacoes` tem bacias, correlacao_geral, pares, periodo e vies_geral_pct, sem recorte por produto. |
| PD-07 | Água: CSV com a variação de EAR de todos os reservatórios, por subsistema e janela | `agua_detalhe.py` | AGUA-2.8 | 1 | ABERTO | `reservatorios.decomposicao_ear[]` só traz `maiores_altas` e `maiores_quedas`; os downloads não têm CSV de todos os reservatórios nessa grandeza. |
| PD-08 | Água: coluna de marca para volume fora de 0 a 100% nos CSV de reservatórios | agua_reservatorios.csv; agua_reservatorios_diario.csv | AGUA-2.9 | 1 | ABERTO | O primeiro termina em `balanco_calculado;motivo_sem_balanco`; o diário tem 12 colunas (data a residuo_hm3). Nenhum tem marca de volume acima de 100%. |
| PD-09 | Água: faixa por data ou variação típica de 30 dias por reservatório | `agua_detalhe.py` | AGUA-2.10 | 1 | ABERTO | Os campos de `reservatorios.lista[]` não incluem faixa nem variação típica. |
| PD-10 | Água (mãe): EAR e P10, P50 e P90 da data em MWmês na série semanal | `agua_detalhe.py` | AGUA-2.13 | 1 | ABERTO | `armazenamento.subsistemas[].p10_mwmes`, `p50_mwmes` e `p90_mwmes` são do dia de referência; a série `semanal` (p10, p90) está em % da EAR máxima, segundo o pedido. |
| PD-11 | Água (mãe): colunas tolerancia_mwmes e fechado em agua_capacidade_eventos.csv | `agua_capacidade_eventos.csv` | AGUA-2.14 | 1 | ABERTO | O cabeçalho termina em `variacao_reservatorio_mwmes;residuo_evento_mwmes`. O gold JSON tem `tolerancia_mwmes` em 6 objetos (jq), mas o CSV não. |
| PD-12 | Água (mãe): ear_diario.csv na lista de downloads do módulo | agua_detalhe.py (downloads) | AGUA-2.15 | 1 | ABERTO | `public/energia/series/ear_diario.csv` existe (data;SE;S;NE;N;SIN_calculado), mas nenhum item de `downloads` do gold cita ear_diario ou ena_diario. |
| PD-13 | Fichas Comprove de EAR e ENA com a mesma comparação entre capturas da tabela de revisões (D6) | agua_detalhe.py (L3314 a L3525, segundo `_coordenador.md`) | AGUA-2.11; DADOS-2 | 2 | PARCIAL | Interface feita (S7, `Numero.revisoes`). No gold, `evidencias.ear_sin.revisoes` e `evidencias.ena_30d_sin.revisoes` ainda dizem "Nenhuma revisão detectada entre as capturas integradas. Verificação em 2026-10-01.". Reservatórios tem captura única e a ficha diz isso. |
| PD-14 | Gerar as bases com árvore limpa, sem o sufixo +alterado (D4) | todos os módulos; catalogo.py | AGUA-2.12; CONTA-7; DADOS-3 | 3 | ABERTO | 27 dos 32 arquivos de `public/energia/gold` terminam em `+alterado` (jq em `.versao_codigo`); quatro não (hidrologia, meta, pld, rede) e `catalogo.json` não tem o campo. f55eb9beb só explica o sufixo na ficha (`SobreEsteDado.tsx:167`). Fica para a publicação final. |
| PD-15 | Subsídios: coluna eh_total em conta_subsidios_anual.csv (D2) | conta.py; conta_subsidios_anual.csv | CONTA-7 | 1 | PARCIAL | 3474c7f0b: `COLUNAS_CSV_SUBS` inclui `eh_total` e há teste em `pipeline/tests/test_energia_conta.py`. O CSV publicado ainda tem o cabeçalho `ano;cnpj;sigla;categoria;montante;valor_rs;meses`. `_coordenador.md` ainda marca D2 como pendente. |
| PD-16 | Arredondar em decimal, meio para cima, no pipeline (D3) | base.py; gold/comum.py; conta.py | CONTA-7 | 1 | PARCIAL | 3474c7f0b: `arredonda_meio_para_cima` (`base.py:44`), usada por `escreve_csv` (L464) e por `gold/comum.py:33`; teste `pipeline/tests/test_energia_arredondamento.py`. `conta.json` (2026-09-30) ainda traz `"total": 701.75` com `"100": 70.17`, que a regra levaria a 70,18. `_coordenador.md` ainda marca D3 como pendente. |
| PD-17 | Texto das limitações do PLD e do teto estrutural com a REN 1.032/2022 (D7) | pld_detalhe.py; pld.json | PLD-5 | 1 | PARCIAL | 3474c7f0b reescreveu a nota do teto em `pld_detalhe.py` (art. 23, § 3º). Grep -c em `pld.json`: 5 linhas ainda com "não foram auditados nesta fase"; `pld_detalhe.json` não cita a REN 1.032. A interface troca a cláusula (`pld.ts:1986`, `:1993`, `:2002`). `_coordenador.md` marca D7 como pendente. |
| PD-18 | FEC: tirar do FEC o mês com menos de 95% das UCs (D1) | qualidade.py; qualidade_distribuidoras_mensal.csv | QUALIDADE-11 | 1 | PARCIAL | f76fd68ef: `aplica_controle_fec` (`qualidade.py:917`), `controle_cobertura_fec` (L1327) e coluna `controle_fec` prevista (L1888). O CSV mensal publicado termina em `controle_numcon`; `qualidade.json` é de 2026-10-01T05:53:21Z. `_coordenador.md` D1: a gold não pode ser refeita neste ambiente. |
| PD-19 | Qualidade: coluna meses_fec nos CSV anuais e fec_min e fec_max com conjuntos de 11 meses | qualidade.py; qualidade_conjuntos_anual_*.csv; qualidade_municipios.csv | QUALIDADE-11 | 1 | ABERTO | Os três CSV anuais têm `meses` e não `meses_fec`, embora `qualidade.py:1389` calcule `meses_fec`. `qualidade_municipios.csv` tem `fec_min;fec_max` sem tratamento dos conjuntos de 11 meses. |
| PD-20 | Qualidade: notas_fonte sem marcação crua e sem termos do processamento | qualidade.py; qualidade.json | QUALIDADE-10 | 1 | ABERTO | `qualidade.json`: 18 linhas com `__`, silver ou bronze; NumCon 32 vezes, dec_concessionarias 30 e fec_concessionarias 29 (Grep -c e -o). A página limpa em `qualidade.ts:2252` a `2271` (`paraLeitor`, `resumirTexto`, `limpaProveniencia`). |
| PD-21 | Fichas com as mesmas casas decimais que a página (valor_exibido) | carga.py; perdas.py; evidencia.py | CARGA-2.1; INICIAL-achados | 2 | ABERTO | `carga_detalhe.json`: "+11,4%" com `valor_calculo` 11.449784 e "+10,5%" com 10.539588. `perdas.json`: "14,7%" com `valor_calculo` 14.748264, enquanto a inicial e a Visão geral mostram 14,75%. |
| PD-22 | Carga: ficha do pico (P026) para o último dia publicado, ou dizer por que o dia é outro | `carga.py` | CARGA-2.2 | 1 | ABERTO | `carga_detalhe.json` traz "Pico horário da carga do SIN no dia" = "98.741 MWmed às 19h". Que a ficha prova 28/09/2026 e a série vai a 29/09/2026 é do pedido, não conferido. |
| PD-23 | Rede: consumidores atingidos, duração e UF por perturbação, e soma por região | `rede_detalhe.py` | CARGA-2.3 | 1 | ABERTO | `rede_detalhe.json`: os campos de perturbação (`cod_perturbacao`, `perturbacoes`, `maiores_perturbacoes`, `perturbacoes_recentes`) não incluem consumidores, duração nem UF (varredura de nomes com jq). |
| PD-24 | Rede: conferir se há mudança de arquivo ou de medida do ONS em 2026 que explique as 2.472 horas com resíduo | `investigação` | CARGA-2.4 | 1 | ABERTO | Sem dono nem artefato. As 2.472 horas e o intervalo de 01/01 a 14/05/2026 são do pedido, não conferidos. |
| PD-25 | Carga: ficha a07_reproducao sem a expressão interna "(reprodução do diagnóstico)" | `carga.py` | CARGA-2.6 | 1 | ABERTO | `carga_detalhe.json` ainda tem o indicador "Variação da carga do SIN em 7 dias contra os mesmos dias do ano anterior (reprodução do diagnóstico)". |
| PD-26 | Conta: marcar SCEE e Lei 14.299/2022 como inexistentes de 2013 a 2019 (hoje nulos) | `conta.py` | CONTA-7 | 1 | ABERTO | Pedido de Conta; a página mostra "sem dado (ausência, não zero)". Os nulos não foram conferidos nos dados. |
| PD-27 | Conta: ressalvas do gold com números em formato brasileiro e sem nome de componente | conta.py; conta.json | CONTA-7 | 1 | ABERTO | `conta.json` `validacao.ressalvas` ainda traz "ENEL CE: componente TE_CFURH de -47.55 R$/MWh (-6.8% da tarifa) ...". |
| PD-28 | Reexecutar o módulo Dados para refazer relatório de validação e publicação | `python3 pipeline/energia/executar_modulo.py dados --sem-coleta` | DADOS-1.1 | 1 | ABERTO | `publicacao.json` (2026-10-01T11:22): "Checagens automáticas reprovadas" = 3 de 2391; `dados_validacoes.csv` tem 3 linhas `reprovado` (empresas_financas_ajustes, mercado_nacional_mensal, sintese_regras_diario). Relidos com `csv.reader` e `;`: 0 linhas fora do padrão (12, 17 e 8 colunas; 111, 272 e 20.981 linhas). |
| PD-29 | Impressão digital do arquivo julgado em todas as checagens de CSV | validacoes.py; modulos/dados.py | DADOS-1.2 | 1 | PARCIAL | aaba39243: `checagem(..., sha256=)` e `sha256_arquivo` em `validacoes.py`; `dados.py` grava `sha256_julgado` em `dados_validacoes.csv`. A coluna só aparece depois de PD-28, e a interface (`validacoesDosCsv` L169, `estadoDoArquivo` L224 em `dados-servidor.ts`) ainda não a lê. |
| PD-30 | Incluir os 9 CSV do próprio módulo Dados no relatório de validação | validacoes.py; modulos/dados.py | DADOS-1.3 | 1 | ABERTO | Nenhuma mudança no código (aaba39243 não trata). Os nove nomes são do pedido; o manifesto não foi relido. |
| PD-31 | Validar valor fisicamente impossível (carga negativa) antes de guardar a observação, ou marcar a captura como incompleta | `validacoes.py` | DADOS-2 | 1 | PARCIAL | aaba39243 só acrescentou o aviso de troca de sinal na interface (`avisoDeSinal` em `dados-leitor.ts`); o pipeline não valida. |
| PD-32 | Gravar versao_codigo também em catalogo.json | `catalogo.py` | DADOS-3 | 1 | PARCIAL | aaba39243: `catalogo.py:733` grava o campo. `catalogo.json` (2026-10-01T11:22:00Z) ainda não o tem. |
| PD-33 | Campo rotulo (frase curta) de cada arquivo em arquivos.json | pipeline de arquivos.json | DADOS-4 | 1 | ABERTO | jq em `arquivos.json`: 0 objetos com `rotulo`. A interface passa a usar o campo na hora (segundo o pedido). |
| PD-34 | Fichas Comprove para medidas que hoje não têm evidência na gold | conta.py; empresas.py; pld_detalhe.py; transicao.py; expansao.py | CONTA-3; EMPRESAS-3; PLD-5; TRANSICAO-2 | 4 | ABERTO | Conta: `conta.json` tem 7 fichas; faltam menor e maior custo e mediana simples por perfil, o agregado de encargos e a variação de 60 e 120 meses. Empresas: medidas de abertura, DEC, FEC e B1 por distribuidora. PLD: média diária por submercado, estatísticas por período, amplitude fora dos últimos 12 meses. Transição e Expansão: listas de exceção nos testes (`energia-transicao.test.ts:655`, `energia-expansao.test.ts:550`, `energia-empresas.test.ts:754`) que exigem ficha em todo o resto. Inclusão (`energia-inclusao.test.ts:646`), Geração e Inicial registram lacunas parecidas sem pedir. |
| PD-35 | Empresas: preferir a sigla mais longa que começa com a sigla truncada em 16 caracteres | empresas.py (prioridade da sigla de exibição) | EMPRESAS-5 | 1 | ABERTO | `empresas.json` ainda traz CPFL-PIRATINING (2), CPFL SUL PAULIST (2), CPFL LESTE PAULI (2) e CERSAD DISTRIBUI (2), com as formas completas CPFL SUL PAULISTA e CERSAD DISTRIBUIDORA (1 cada); `conta.json` tem CPFL-PIRATINING em 8 linhas. |
| PD-36 | Geração: rótulo do arquivo horário (365 dias, não 366) | `geracao_detalhe.py` | GERACAO-8.1 | 1 | ABERTO | `geracao_detalhe.py:199` e `:3574` dizem "últimos 366 dias"; `geracao_matriz_horaria_12m.csv` tem 8.761 linhas (cabeçalho mais 8.760). A interface troca o texto em `geracao.ts:1895`. |
| PD-37 | Geração: vocabulário interno e a frase "igual ao do Balanço" nos textos da gold | `geracao_detalhe.py` | GERACAO-8.2 | 1 | ABERTO | `geracao_detalhe.py:1327` escreve "igual ao do Balanço"; `geracao_detalhe.json` tem 1 linha com a frase. A página traduz por `emPortugues` (`geracao.ts:112`). Os demais termos internos do pedido não foram buscados um a um. |
| PD-38 | Geração: fichas com "recurso não identificado" sem citação do recurso | evidencia.py; evidencias dos módulos | GERACAO-8.4 | 1 | ABERTO | O texto vem de `evidencia.py:193` e `evidencia.ts:269` quando falta `fonte.recurso`. Aparece em duas citações de `agua_detalhe.json` (L19655, L20140); em `geracao_detalhe.json` e `geracao.json` o Grep dá 0, então as fichas de Geração citadas pelo pedido não foram localizadas. |
| PD-39 | Geração: perfil por hora do dia das restrições | `geracao_detalhe.py` | GERACAO-8.5 | 1 | ABERTO | `geracao_restricao_diaria.csv` é diário (data, fonte, regiao, razao, origem e medidas); sem coluna de hora. |
| PD-40 | Geração: confirmar se potencia_max_cortada_mw é o corte simultâneo numa meia hora e nomear o cabeçalho | `geracao_detalhe.py` | GERACAO-8.6 | 1 | ABERTO | A coluna existe em `geracao_restricao_diaria.csv`; a página a rotula "numa meia hora" (`GeracaoRestricoes.tsx:224` e `:247`). Falta a confirmação do dono do pipeline. |
| PD-41 | Geração: coluna de dias conciliados na série de participação térmica de 7 dias | `geracao_detalhe.py` | GERACAO-8.7 | 1 | ABERTO | Pedido de Geração; a faixa usual sem os dias em que o Balanço difere das usinas não foi recalculada. Campo não procurado no gold. |
| PD-42 | Geração: recorte por subsistema e UF em Capacidade e Térmica, e série mensal por subsistema na matriz | `geracao_detalhe.py` | GERACAO-7.8; GERACAO-8.8 | 1 | ABERTO | Pedido de Geração; as duas páginas dizem que o recorte é o SIN. Não procurado no gold. |
| PD-43 | Inclusão: download da ficha da CDE aponta também para a série mensal por UF | inclusao.py; inclusao.json | INCLUSAO-7 | 1 | PARCIAL | 07512da6e: `inclusao.py:1864` agora lista `inclusao_municipios.csv` e `inclusao_cde_mensal_uf.csv`. `inclusao.json` ainda tem só `/energia/series/inclusao_municipios.csv` em `tarifa_social.proveniencia.cde.download`. |
| PD-44 | Inclusão: a pergunta da cobertura ("Quem pode estar ficando de fora?") enquadra a razão como exclusão | inclusao.py:2271; inclusao.json | INCLUSAO-7 | 1 | ABERTO | `inclusao.py:2271` e `inclusao.json` `cobertura.pergunta` mantêm o texto. A página o cita entre aspas e usa título neutro. |
| PD-45 | Perdas: nomear a origem do denominador, registrar a base alternativa e uma reconciliação de 2025 | perdas.py; evidencia.py | INICIAL-6 | 1 | ABERTO | `perdas.json`: `denominador.descricao` = "Σ energia injetada de referência (MWh)", valor 612653775,717 (`perdas.py:1511`). Solução local em `home-sinais.ts`: `denominadorDePerdas` (L236), `descreverDenominador` (L281), `evidenciaComDenominadorNomeado` (L317). |
| PD-46 | Regulação: cópia legível da Portaria 7.157/2026 da agenda regulatória | `regulacao.py` | MERCADO-6 | 1 | ABERTO | Dependência externa (HTTP 403 em leis.org, segundo o pedido); a página diz que as 59 atividades são as da versão original. Não verificado. |
| PD-47 | Regulação: texto do ato de 2021 (REH 2.828/2020) e de 2023 (REH 3.167/2022); data de publicação de 2021 | `regulacao.py` | MERCADO-6 | 1 | ABERTO | Dependência externa (texto do ato inacessível); a página diz isso por ato, em Analisar (pedido). Não verificado. |
| PD-48 | Previsões: textos do pipeline sem "até agora", "rodada atual", "CALIBRADO" e "melhor que a persistência" | previsoes.py; previsoes.json | MODELOS-F | 1 | PARCIAL | 3474c7f0b trocou as quatro expressões em `previsoes.py` ("até a data da coleta", "rodada mais recente", "calibrados", "erro menor que o da persistência"). `previsoes.json` é de 2026-10-01 e não foi regerado. Os códigos de estado em Auditar ficam por serem o nível técnico (pedido). |
| PD-49 | PLD: média e mediana nas horas separadas em regional.amplitude[] | `pld_detalhe.py` | PLD-5 | 1 | ABERTO | Grep: `media_nas_horas_separadas` e `mediana_nas_horas_separadas` não existem em `pld_detalhe.json` nem em `pld.json`. |
| PD-50 | PLD: contagem de horas junto de frac_abs_ate_1 em relacao_anual | `pld_detalhe.py` | PLD-5 | 1 | ABERTO | O bloco com `frac_abs_ate_1` em `pld_detalhe.json` traz quatro casas (ex. 0.0795) e `n`, sem contagem de horas por faixa. |
| PD-51 | PLD: fluxo nas fronteiras até o mesmo dia do preço | pld_detalhe.py; pld_horario_recente.json | PLD-5 | 1 | ABERTO | `pld_horario_recente.json` (2026-10-01T06:54:23Z): `t` vai de 2026-09-24T00:00 a 2026-09-30T23:00 (168 pontos); o último valor não nulo de `fluxo` está no índice 119, 2026-09-28T23:00. |
| PD-52 | PLD: integrar a série semanal de 2001 a 2020 (decisão de produto) | pld.py; catálogo | PLD-5 | 1 | ABERTO | Pedido de PLD: a série segue catalogada e não integrada; a referência histórica começa em janeiro de 2021. Não verificado no catálogo. |
| PD-53 | Expansão: previsão por ano sem as datas convencionais em bloco (2031) | `expansao.py` | TRANSICAO-5 | 1 | ABERTO | `expansao.json` tem `cronograma.previsoes_atuais.por_ano`; `sem_datas_em_bloco` só aparece em `atraso_previsto` e `deslizamento`. Verificação parcial: não achei a variante por ano. |
| PD-54 | Expansão: texto do RALIE sem "Parquet histórico" e sem nome de campo | `expansao.py` | TRANSICAO-5 | 1 | ABERTO | `expansao.json` tem 7 linhas com "Parquet histórico" (Grep -c). A página troca em `provenienciasDoLeitor` (`expansao.ts:1647`). |
| PD-55 | Transição: frase da quebra de jan/2025 do fator de emissão sem causalidade | `transicao.py` | TRANSICAO-5 | 1 | ABERTO | `transicao.json` tem 2 linhas com "podem ser menores por causa da base" (Grep -c). |
| PD-56 | Visão geral: EAR do SIN sem arredondamento intermediário em sintese_multiplos.csv | módulo sintese | VISAO-7 | 1 | ABERTO | `sintese_multiplos.csv` (91 linhas): `agua_SIN` com duas casas (ex. 71.71). A página lê `ear_diario.csv` para ter quatro. |
| PD-57 | Território: registrar na gold o bloqueio da camada 24 da EPE (Token Required) | territorio.py; territorio.json | VISAO-7 | 1 | ABERTO | Grep por "Token Required" em `territorio.json`: 0. `bloqueios` lista SIGEL, BDGD e WebMap da EPE, sem esse caso. |
| PD-58 | Território: publicar as duas contagens de usinas por UF (com e sem registros de até 10 kW) | `territorio.py` | VISAO-7 | 1 | ABERTO | `territorio.json`: soma de `ufs[].indicadores.capacidade.usinas` = 22.798 e Pará = 13.201 (jq). Os 16.035 e 13.101 de até 10 kW são do pedido, não conferidos. A página corrige lendo o arquivo de usinas no servidor (`territorio-servidor.ts`). |
| PD-59 | Ajustar o validador que reprova sintese_regras_diario.csv por ponto e vírgula entre aspas ("falso positivo") | `validacoes.py` | VISAO-7 | 1 | OBSOLETO | Premissa refutada por DADOS-1 e por leitura: `validacoes.py` lê com `csv.reader` e `;` (respeita aspas) e o arquivo atual tem 0 linhas fora do padrão; ele foi reescrito em 8086b52b3 (08/10), depois da validação de 01/10. A ação certa é PD-28. |

### 7. Navegação e texto (NT, 17 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| NT-01 | NavegacaoLocal e SeguirPainel levarem parâmetros de URL do módulo ao destino (manter ou preservar) | NavegacaoLocal.tsx; SeguirPainel.tsx | AGUA-1.3; CONTA-1; PERDAS-3 | 3 | ABERTO | Nenhum dos dois tem a propriedade. Soluções locais: `conta-de-luz/partes.tsx:37` copia a faixa; `PerdasLevaEscolha.tsx` é montado em 4 páginas (`perdas/page.tsx:227`, `composicao:128`, `regulatorio:158`, `custo-e-contexto:123`); Água não leva a escolha. |
| NT-02 | Pergunta do módulo Aprenda com 9 palavras, no mapa e no menu | mapa.ts:127; navegacao.ts:187 | APRENDA-1.2 | 1 | ABERTO | Os dois textos são "O que significam os conceitos e como se ligam aos números?" (11 palavras, contadas à mão). `AprendaPagina` lê de `PAGINAS_MAPA` e `energia-aprenda.test.ts:362` compara o título com o mapa (o pedido diz que o teste exige título, mapa e menu iguais). |
| NT-03 | Nomes oficiais atualizados no dicionário: CCEE (Lei 15.269) e IBGE (Fundação) | `src/lib/energia/siglas.ts` | APRENDA-1.5 | 1 | ABERTO | `siglas.ts:9` "Câmara de Comercialização de Energia Elétrica" e `:12` "Instituto Brasileiro de Geografia e Estatística". Decisão do coordenador, dita no pedido. |
| NT-04 | SIGLAS com PNAD, PASI, MDS e CV | `src/lib/energia/siglas.ts` | INCLUSAO-5 | 1 | ATENDIDO | 07512da6e: `siglas.ts:78` a `81`. |
| NT-05 | SIGLAS com DECOMP, DESSEM e NEWAVE (depois de ler a fonte primária) | `src/lib/energia/siglas.ts` | PLD-1 | 1 | ABERTO | Grep em `siglas.ts`: nenhuma das três. Bloqueado: o manual do CEPEL não foi lido. Os verbetes existem em `conceitos.ts` (`newave` L490, `decomp` L509, `dessem` L523). |
| NT-06 | Rótulo Início para a porta de entrada e resumos sem "agora" em navegacao.ts | `src/lib/energia/navegacao.ts` | INICIAL-4 | 1 | ATENDIDO | S12 (8832a8d05): `navegacao.ts:31` e `:96` "Início"; Grep por agora, hoje e atual no arquivo só acha comentários de código. Resta "agora" em `mapa.ts:712` (ver a seção de textos). |
| NT-07 | Perguntas do módulo Rede e Carga iguais aos títulos das páginas | mapa.ts; navegacao.ts | CARGA-1.7 | 1 | ATENDIDO | f0d07bc89: `mapa.ts:115` e `:116` e `navegacao.ts:112` e `:113` trazem "Quanto o sistema está consumindo?" e "Como a energia circula entre regiões?". |
| NT-08 | Pergunta de Geração no menu: "De onde vem a eletricidade?" | `src/lib/energia/navegacao.ts` | GERACAO-1 | 1 | ATENDIDO | f0d07bc89: `navegacao.ts:111`. |
| NT-09 | Texto do link para a Geração na Transição (LIGACAO_GERACAO.pergunta) | `src/lib/energia/transicao.ts` | GERACAO-1 | 1 | ABERTO | `transicao.ts:209` ainda tem "Quais fontes atenderam a carga?". O teste de Transição só confere o `href` (segundo o pedido). |
| NT-10 | Perguntas de Empresas e de Cadastro e ativos nos três arquivos de texto | mapa.ts; navegacao.ts; empresas/ativos/page.tsx | EMPRESAS-4 | 1 | PARCIAL | f0d07bc89: `mapa.ts`, `navegacao.ts:172` e `empresas.ts:72` já trazem "Quem atua no setor elétrico?" e "Quem são os donos dos ativos?". Resta `empresas/ativos/page.tsx:62`, título de metadata com "Quem opera quais ativos?". |
| NT-11 | Perguntas e promessas antigas de Perdas em navegacao.ts, mapa.ts, empresas, telemetria e especificação | `vários` | PERDAS-5 | 1 | ATENDIDO | f0d07bc89: `navegacao.ts:144` e `:145`, `mapa.ts:728`, `empresas/distribuidoras/page.tsx`, `telemetry.ts` e `ESPECIFICACAO.md:242` ajustados. Grep por "Onde se perde energia" e "Realizado diante" em src: nenhuma ocorrência. |
| NT-12 | Mercado e Regulação: perguntas do mapa e descrição da Regulação no menu | mapa.ts; navegacao.ts | MERCADO-4 | 1 | ATENDIDO | f0d07bc89: `mapa.ts:118` e `:121` com "Como a energia é contratada, alocada e liquidada?" e "Que regra vale em cada período?"; `navegacao.ts:41` "ANEEL, MME, Congresso e Presidência, com linha do tempo e documentos primários." |
| NT-13 | Galeria (tela 11) mostra o Mercado "em integração" | galeria (fora do repositório) | MERCADO-4 | 1 | OBSOLETO | O código concorda consigo mesmo: `navegacao.ts:38` `integrado: true` e `mapa.ts:118` `estado: "integrado"`. Grep por "galeria" não acha a galeria no repositório: não há o que mudar aqui. |
| NT-14 | Perguntas de Expansão e Transição em mapa.ts iguais às das telas | `src/lib/energia/mapa.ts` | TRANSICAO-3 | 1 | ATENDIDO | f0d07bc89: `mapa.ts:120` e `:126` com "O que está sendo construído?" e "Como a matriz está mudando?". |
| NT-15 | Rótulo "Previsão atual por submercado e entrega" no mapa | `src/lib/energia/mapa.ts` | MODELOS-C4 | 1 | ATENDIDO | f0d07bc89: `mapa.ts:483` "Rodada mais recente: referência B0 por submercado e entrega". |
| NT-16 | Títulos com 11 palavras (regra de 5 a 9): P026, P027, PERGUNTA_ONS e perguntas da gold de MRE e encargos | carga.ts:45 e :46; transicao.ts:178; mercado.json | CARGA-7; TRANSICAO-4; MERCADO-5 | 3 | ABERTO | Todos continuam com 11 ou 12 palavras (contadas à mão): `carga.ts:45`, `carga.ts:46`, `transicao.ts:178` (12) e as duas perguntas de `paineis[]` em `mercado.json`. Os pedidos tratam como decisão: testes de conteúdo fixam P026 e P027. |
| NT-17 | Rótulo "Recorte atual:" da tabela interativa | `src/components/energia/TabelaInterativa.tsx` | CONTA-2; MODELOS-C3 | 2 | ATENDIDO | 52c49ebd0: `TabelaInterativa.tsx:430` "Linhas mostradas:" e `:447` "fora dos filtros aplicados". Resta "o recorte atual não tem resultado" no anúncio de leitor de tela (L323). `energia-conta.test.ts:1143` e `energia-conteudo-r8-T1.test.ts:232` ainda removem "Recorte atual" do texto, agora sem efeito. |

### 8. Limpeza de arquivo sem uso (LI, 23 linhas)

| Id | Pedido | Alvo | Origem | N | Estado | Evidência ou o que falta |
| --- | --- | --- | --- | --- | --- | --- |
| LI-01 | Apagar AguaLinkPainel.tsx (o rodapé usa o SeguirPainel compartilhado) | `src/components/energia/AguaLinkPainel.tsx` | AGUA-0 | 1 | ABERTO | Grep por AguaLinkPainel em src, docs, scripts e pipeline: só a definição e `docs/observatorios/energia/modulos/agua.md:5`. Nenhum teste cita o nome. |
| LI-02 | Apagar CargaLinkPainel.tsx | `src/components/energia/CargaLinkPainel.tsx` | CARGA-0 | 1 | ABERTO | Sem importador. Citado em `modulos/carga.md:22` e `:234`. |
| LI-03 | Apagar RedeLinkPainel.tsx | `src/components/energia/RedeLinkPainel.tsx` | CARGA-0 | 1 | ABERTO | Sem importador. Citado em `modulos/rede.md:156` e `:175`. |
| LI-04 | Apagar RedeMapaFluxos.tsx (substituído por RedeEsquemaFluxos.tsx) | `src/components/energia/RedeMapaFluxos.tsx` | CARGA-0 | 1 | ABERTO | Sem importador. Citado em `modulos/rede.md:156`. |
| LI-05 | Apagar CatalogoFiltro.tsx (o catálogo usa ListaConsultavel e DadosCatalogo) | `src/components/energia/CatalogoFiltro.tsx` | DADOS-0 | 1 | ABERTO | Sem importador. Citado em `docs/observatorios/energia/BENCHMARKS.md:168` e `:190`. |
| LI-06 | Apagar EmpresasLinkPainel.tsx | `src/components/energia/EmpresasLinkPainel.tsx` | EMPRESAS-0 | 1 | ABERTO | Sem importador e sem menção em docs ou testes. |
| LI-07 | Apagar GeracaoLinkPainel.tsx | `src/components/energia/GeracaoLinkPainel.tsx` | GERACAO-0 | 1 | ABERTO | Sem importador e sem menção em docs ou testes. |
| LI-08 | Apagar InclusaoLinkPainel.tsx | `src/components/energia/InclusaoLinkPainel.tsx` | INCLUSAO-0 | 1 | ABERTO | Sem importador. Citado em `modulos/inclusao.md:18`, `:49`, `:262` e `:263`. |
| LI-09 | Apagar RegulacaoLinkPainel.tsx | `src/components/energia/RegulacaoLinkPainel.tsx` | MERCADO-0 | 1 | ABERTO | Sem importador. Citado em `modulos/regulacao.md:20`. `energia-regulacao.test.ts` varre a pasta por prefixo (L998, L1021) e tolera a remoção. |
| LI-10 | Apagar VisaoLinkPainel.tsx | `src/components/energia/VisaoLinkPainel.tsx` | MERCADO-0; VISAO-0 | 2 | ABERTO | Sem importador hoje (MercadoPainel.tsx deixou de importar o arquivo). O pedido de Visão e Território dizia que ele ainda era usado ali; o de Mercado e Regulação, que não. Citado em `docs/observatorios/energia/CONTINUIDADE.md:97`. |
| LI-11 | Apagar PrevisoesLinkPainel.tsx | `src/components/energia/PrevisoesLinkPainel.tsx` | MODELOS-0 | 1 | ABERTO | Sem importador. Citado em `modulos/previsoes.md:162`. `energia-previsoes.test.ts:904` varre por prefixo e tolera. |
| LI-12 | Apagar ArquivoPrevisoes.tsx e trocar o alvo do teste de governança | `src/components/energia/ArquivoPrevisoes.tsx` | MODELOS-0 | 1 | ABERTO | Sem importador, mas `src/tests/energia-governanca.test.ts:117` lê o arquivo (três expects, L118 a L120). Citado também em `modulos/previsoes.md:197`. O pedido propõe ler `previsoes.ts` e `PrevisoesArquivo.tsx`. |
| LI-13 | Apagar PerdasLinkPainel.tsx | `src/components/energia/PerdasLinkPainel.tsx` | PERDAS-0 | 1 | ABERTO | Sem importador. Citado em `modulos/perdas.md:18`. |
| LI-14 | Apagar PerdasLinkConsulta.tsx (a consulta aplicada vive em PerdasExplorador.tsx) | `src/components/energia/PerdasLinkConsulta.tsx` | PERDAS-0 | 1 | ABERTO | Sem importador. Citado em `modulos/perdas.md:18`. |
| LI-15 | Apagar PldLinkPainel.tsx | `src/components/energia/PldLinkPainel.tsx` | PLD-0 | 1 | ABERTO | Sem importador. Citado em `modulos/pld.md:3` e `:25`. `energia-pld.test.ts:318` varre por prefixo e tolera. |
| LI-16 | Apagar QualidadeLinkPainel.tsx | `src/components/energia/QualidadeLinkPainel.tsx` | QUALIDADE-0 | 1 | ABERTO | Sem importador. Citado em `modulos/qualidade.md:20`. |
| LI-17 | Apagar ExpansaoLinkPainel.tsx | `src/components/energia/ExpansaoLinkPainel.tsx` | TRANSICAO-0 | 1 | ABERTO | Sem importador. Citado em `modulos/expansao.md:21`. |
| LI-18 | Apagar TransicaoLinkPainel.tsx e tirar o nome da lista do teste de hexadecimal | `src/components/energia/TransicaoLinkPainel.tsx` | TRANSICAO-0 | 1 | ABERTO | Sem importador, mas `src/tests/energia-transicao.test.ts:645` lê o arquivo (lista de seis nomes). Citado em `modulos/transicao.md:20`. |
| LI-19 | Apagar TerritorioLinkPainel.tsx | `src/components/energia/TerritorioLinkPainel.tsx` | VISAO-0 | 1 | ABERTO | Ainda importado por `TerritorioPagina.tsx:4` e usado na L140, dentro de `TerritorioSeguir`. Só pode sair depois de LI-20. |
| LI-20 | Remover as exportações sem uso TerritorioSeguir, TerritorioAnalise e TerritorioAuditoria | `src/components/energia/TerritorioPagina.tsx` | VISAO-0 | 1 | ABERTO | Grep: `TerritorioSeguir` (L122), `TerritorioAnalise` (L62) e `TerritorioAuditoria` (L71) só aparecem onde são definidos. |
| LI-21 | Apagar o rascunho zz_tmp_aprenda_exec.test.ts | `src/tests/zz_tmp_aprenda_exec.test.ts` | APRENDA-0 | 1 | ABERTO | 4 linhas, um `it.skip`. Ignorado pelo git (`.git/info/exclude:9`, padrão `src/tests/zz_tmp_*`): apagar não gera diff. |
| LI-22 | Apagar zz_tmp_visao_ctx.test.ts e zz_tmp_visao_ctx2.test.ts | `src/tests/zz_tmp_visao_ctx*.test.ts` | VISAO-0 | 1 | ABERTO | 33 e 27 linhas, ambos com `it.skip`. Ignorados pelo git pelo mesmo padrão. |
| LI-23 | Ajustar os documentos de módulo que citam esses arquivos ou descrevem a interface anterior | docs/observatorios/energia/modulos/*.md; BENCHMARKS.md; CONTINUIDADE.md | AGUA-0; APRENDA-6; CARGA-0; DADOS-0; GERACAO-0; MERCADO-0; PERDAS-0; PLD-0; TRANSICAO-0 | 9 | ABERTO | Linhas que citam os arquivos estão em LI-01 a LI-18. Que `aprenda.md`, `geracao.md` e `pld.md` descrevem a interface anterior é dito nos pedidos; o conteúdo desses três documentos não foi relido nesta triagem. |

## Esforço, impacto e risco dos itens ABERTO e PARCIAL

Esforço P (até 30 linhas), M (um componente com teste) ou G (mais de um componente ou decisão de produto). Impacto em páginas de `src/app/setor-eletrico` (70 `page.tsx`). Testes: arquivos de `src/tests` que tocam o alvo; nenhum foi executado.

| Id | Estado | Esf. | Impacto | Testes que tocam o alvo |
| --- | --- | --- | --- | --- |
| VI-05 | ABERTO | M | 53 páginas (GraficoBarras); sentido nas 2 da Conta | energia-comp-grafico-barras, energia-celular-r10, energia-conta |
| VI-06 | ABERTO | M | 2 páginas da Conta (paleta em conta.ts:64 a 99) | energia-conta, design-tokens-energia |
| VI-08 | ABERTO | P | 37 arquivos fora de teste citam `serie-comp` (Grep -rl); trocar valores muda a cor em Expansão, Inclusão, Empresas, Conta, Transição e Perdas | design-tokens-energia, energia-empresas |
| VI-13 | ABERTO | P | 62 páginas (Numero); afeta as 4 de Geração | energia-comp-evidencia; `data-metrica`: energia-geracao e mais dez suítes |
| VI-14 | ABERTO | P | 59 páginas (FaixaMetricas); sentido em Mercado (1 abertura) | energia-mercado-pagina e as suítes com `data-faixa-metricas` |
| VI-15 | ABERTO | M | 5 páginas (MapaCalor) | energia-comp-mapa-calor |
| AC-01 | ABERTO | P | páginas do Aprenda com faixa de seções: 4 page.tsx, entre elas os verbetes e as 2 trilhas (NavegacaoLocal alcança 64 das 70) | energia-estrutura-r7, energia-estrutura-r9, energia-aprenda-redesenho, energia-aprenda, energia-aprenda-r7 |
| AC-02 | PARCIAL | P | 65 páginas (ModoProfundidade) | energia-estrutura-r7, energia-mapa, energia-interface-r2, energia-comp-estado-url |
| AC-03 | PARCIAL | P | 59 páginas (FaixaMetricas) | `data-comprove`: energia-expansao, energia-pld, energia-conteudo-r8-M2, energia-avaliacao, energia-aprenda-r7; CSS lido por energia-estrutura-r9 e energia-celular-r10 |
| AC-04 | PARCIAL | P | 70 páginas (LegendaSiglas) | energia-estrutura-r7, energia-estrutura-r9; `data-siglas`: energia-agua, energia-inclusao, energia-aprenda |
| AC-08 | ABERTO | M | 53 páginas (GraficoBarras); a necessidade declarada é de Geração (4) e, segundo o pedido, Carga, Rede e Transição | energia-comp-grafico-barras, energia-celular-r10, energia-conta, energia-geracao |
| AC-09 | ABERTO | G | 53 páginas (GraficoBarras) e 43 (GraficoLinhas) | energia-comp-grafico-barras, energia-comp-grafico-linhas, energia-celular-r10, energia-conta, energia-carga, energia-mapa, energia-interface-r2 |
| AC-10 | ABERTO | P | 43 páginas (Termo) | energia-reauditoria (cita Termo e TermoDica) |
| AC-11 | ABERTO | G | 8 páginas (MapaCoropletico), mais TerritorioMapa (1) e GeracaoMapaUsinas (1) | energia-comp-mapa-coropletico, energia-territorio, energia-geracao |
| AC-12 | PARCIAL | M | todas as páginas (texto e SVG); não contado | energia-celular-r10 e as suítes de componente; a medição exige navegador |
| CE-02 | ABERTO | M | 59 páginas (FaixaMetricas), todas na primeira tela do celular | `data-faixa-metricas` (12 suítes): energia-agua, energia-regulacao, energia-carga, energia-rede (L762 conta ed-faixa-grade), energia-empresas, energia-dados-r9, energia-pld, energia-inclusao, energia-conta, energia-mercado-pagina, energia-geracao, energia-qualidade |
| CE-03 | ABERTO | M | 67 páginas (CabecalhoModulo) | energia-estrutura-r7 (L56 a L61 fixam .cab-modulo), energia-estrutura-r9, energia-pld (L970) |
| CE-04 | PARCIAL | M | 43 páginas (GraficoLinhas) | energia-comp-grafico-linhas, energia-celular-r10, energia-interface-r2, energia-carga, energia-conta, energia-mapa |
| CE-07 | ABERTO | M | 13 páginas (GraficoPontos) | energia-comp-grafico-pontos, energia-celular-r10 |
| CE-08 | ABERTO | P | 2 páginas (Histograma) | energia-comp-histograma, energia-comp-distribuicao |
| CE-10 | ABERTO | G | 1 página (inicial); 70 se o cabeçalho mudar para todas | energia-comp-navegacao, energia-pld, energia-aprenda, energia-aprenda-r7, energia-inicial |
| CE-11 | ABERTO | G | 2 arquivos usam PrevisoesTabela (pld/modelos/page.tsx e PrevisoesArquivo.tsx); 59 páginas se subir para TabelaInterativa | energia-previsoes, energia-comp-tabela, energia-comp-estado-url |
| PE-02 | PARCIAL | G | 66 páginas (ComproveNumero); 80 arquivos passam `evidencia={` inline | energia-comp-evidencia, energia-aprenda-r7; suítes que contam fichas (energia-qualidade, energia-pld, energia-conta, energia-inclusao, energia-expansao, energia-transicao, energia-empresas); tetos de 600_000 B |
| PE-03 | ABERTO | M | 70 páginas (CabecalhoEnergia) | energia-comp-navegacao, energia-pld, energia-aprenda, energia-aprenda-r7 |
| PE-04 | PARCIAL | M | 53 páginas (GraficoBarras); 3 usos de limiteInicial | energia-comp-grafico-barras, energia-celular-r10, energia-conta (tetos L2027 e L2028) |
| PE-05 | ABERTO | M | 13 páginas (GraficoPontos) | energia-comp-grafico-pontos, energia-celular-r10, energia-qualidade (tetos L784 e L1731) |
| PE-06 | ABERTO | M | 5 páginas (MapaCalor) | energia-comp-mapa-calor |
| PE-07 | ABERTO | M | 43 páginas (Termo) | energia-reauditoria |
| PE-08 | ABERTO | M | 2 páginas (conta-de-luz e reajustes-e-subsidios) | energia-conta (tetos de 475_000 e 420_000 B) |
| PE-10 | ABERTO | G | 65 páginas (ModoProfundidade) | energia-estrutura-r7, energia-mapa, energia-interface-r2, energia-comp-estado-url |
| PE-11 | PARCIAL | P | 64 páginas (NavegacaoLocal) | energia-estrutura-r7 e energia-estrutura-r9 (de8747d3b acrescentou 21 linhas ali sobre LinkSemPrefetch) |
| PE-12 | ABERTO | não estimado | não identificado | não estimado |
| CO-01 | ABERTO | P | 4 page.tsx do Aprenda (índice, trilhas, verbete, trilha) | energia-estrutura-r9 (L105: recolher falso), energia-aprenda, energia-aprenda-r7 |
| CO-02 | ABERTO | M | 1 página (inicial) | energia-inicial, energia-mapa, energia-aprenda |
| CO-03 | PARCIAL | P | 1 página (inicial) | energia-inicial, energia-mapa, energia-aprenda-instituicoes |
| CO-06 | ABERTO | G | 1 verbete por termo mais as páginas de Geração que o citam | energia-aprenda, energia-aprenda-instituicoes, energia-geracao |
| CO-07 | ABERTO | G | 1 verbete por termo mais as páginas de Inclusão que o citam | energia-aprenda, energia-inclusao |
| CO-08 | ABERTO | P | 1 verbete e as 4 páginas de Perdas | energia-perdas, energia-aprenda |
| CO-09 | ABERTO | P | 4 arquivos de conteúdo | energia-conteudo-r8* e energia-aprenda |
| CO-10 | ABERTO | M | 62 páginas (Numero) e todas com SeloNatureza | tipos.ts: energia-agua, energia-carga, energia-inicial, energia-visao, energia-conteudo-r8-P, energia-pld |
| CO-11 | ABERTO | G | 26 arquivos com `data-recorte-painel` | energia-agua (usa o atributo) |
| CO-12 | ABERTO | M | 70 páginas (tabela.ts) e 59 (TabelaInterativa) | 17 suítes citam tabela.ts (energia-comp-tabela, energia-interface-r2 e as de cada módulo) |
| CO-13 | ABERTO | P | 2 páginas (Histograma) | energia-comp-histograma, energia-comp-distribuicao |
| CO-14 | ABERTO | G | 53 páginas (GraficoBarras) e 43 (GraficoLinhas); decisão de produto | energia-comp-grafico-barras, energia-comp-grafico-linhas; a contagem de visões "Dados do gráfico em tabela" da matriz de preservação muda |
| CO-15 | ABERTO | M | 64 páginas (PainelEvidencia); uso real em Geração restrições (1) | energia-reauditoria, energia-pld, energia-conta, energia-geracao |
| CO-16 | ABERTO | G | 5 arquivos locais; NavegacaoLocal alcança 64 páginas | `data-navegacao-local`: 14 suítes; energia-estrutura-r7, energia-estrutura-r9 |
| CO-17 | ABERTO | P | 64 páginas (SeguirPainel); o efeito só aparece onde há mais de um arquivo (não contado) | energia-regulacao, energia-empresas, energia-transicao, energia-visao, energia-mercado-pagina; `data-downloads`: energia-agua, energia-empresas |
| CO-18 | PARCIAL | M | 64 páginas (SecaoDoPainel e RespostaCurta) | `data-resposta`: 30 suítes; energia-conteudo-r8, energia-pld; CSS: energia-estrutura-r7 |
| CO-19 | ABERTO | P | 3 arquivos: inicial, Território e a ficha de empresas (empresas/[entidade]) | energia-territorio (L538, toContain), energia-mapa, energia-inicial, energia-empresas |
| CO-22 | ABERTO | P | 1 verbete e 4 documentos | energia-rede e energia-aprenda (L190 só confere o href) |
| PD-01 | ABERTO | M | 1 página (agua-e-clima/afluencia) | energia-agua, energia-gold-contrato |
| PD-02 | ABERTO | P | 1 página (afluencia) | energia-agua, energia-gold-contrato |
| PD-03 | ABERTO | M | 1 página (afluencia) | energia-agua, energia-gold-contrato |
| PD-04 | ABERTO | M | 1 página (chuva-e-temperatura) | energia-agua, energia-gold-contrato |
| PD-05 | ABERTO | M | 1 página (chuva-e-temperatura) | energia-agua |
| PD-06 | ABERTO | M | 1 página (chuva-e-temperatura) | energia-agua |
| PD-07 | ABERTO | M | 1 página (reservatorios) | energia-agua, energia-gold-contrato |
| PD-08 | ABERTO | P | 1 página (reservatorios) | energia-agua |
| PD-09 | ABERTO | M | 1 página (reservatorios) | energia-agua |
| PD-10 | ABERTO | M | 1 página (agua-e-clima) | energia-agua, energia-gold-contrato |
| PD-11 | ABERTO | P | 1 página (agua-e-clima) | energia-agua |
| PD-12 | ABERTO | P | 1 página (agua-e-clima) | energia-agua, energia-gold-contrato |
| PD-13 | PARCIAL | P | 4 páginas de Água e clima | energia-agua, energia-comp-evidencia |
| PD-14 | ABERTO | G | todas as páginas que mostram a versão (70); é processo de publicação | energia-dados-r9; energia-gold-contrato |
| PD-15 | PARCIAL | P | 2 páginas (Conta de luz); sem código novo, só regerar | energia-conta |
| PD-16 | PARCIAL | P | 2 páginas (Conta) e os CSV de todos os módulos que passam por escreve_csv; sem código novo, só regerar | energia-conta (aceita diferença só nos empates), energia-gold-contrato, pipeline/tests/test_energia_arredondamento.py |
| PD-17 | PARCIAL | P | 8 páginas de PLD; sem código novo, só regerar | energia-pld (as funções de substituição em pld.ts:1986 a 2002 ficam sem efeito) |
| PD-18 | PARCIAL | P | 1 página (qualidade); precisa do silver e do bronze de continuidade, ausentes neste ambiente | energia-qualidade, pipeline/tests/test_energia_qualidade.py |
| PD-19 | ABERTO | M | 1 página (qualidade) | energia-qualidade |
| PD-20 | ABERTO | M | 1 página (qualidade) | energia-qualidade |
| PD-21 | ABERTO | M | Carga (1 ficha), Perdas e inicial; evidencia.py serve a todos os módulos | energia-carga, energia-perdas, energia-inicial, energia-comp-evidencia |
| PD-22 | ABERTO | P | 1 página (carga/perfil-horario) | energia-carga |
| PD-23 | ABERTO | G | 1 página (rede/restricoes) | energia-rede |
| PD-24 | ABERTO | M | 1 página (rede/balanco-e-exterior) | energia-rede |
| PD-25 | ABERTO | P | 1 página (carga) | energia-carga |
| PD-26 | ABERTO | M | 1 página (conta-de-luz/reajustes-e-subsidios) | energia-conta |
| PD-27 | ABERTO | P | 1 página (conta-de-luz, Auditar) | energia-conta |
| PD-28 | ABERTO | P | 4 page.tsx de dados (índice, saude, reproducao e a ficha [dataset]); só executar | energia-dados-r9, energia-dados-interface, energia-conteudo-r8-D |
| PD-29 | PARCIAL | P | 2 páginas (dados/saude, dados/reproducao) | energia-dados-r9 |
| PD-30 | ABERTO | M | 1 página (dados/saude) | energia-dados-r9 |
| PD-31 | PARCIAL | M | 1 página (dados/saude) | energia-dados-r9 |
| PD-32 | PARCIAL | P | 1 página (dados/reproducao) | energia-dados-r9 |
| PD-33 | ABERTO | M | fichas dados/[dataset] (1 page.tsx dinâmico) | energia-dados-interface |
| PD-34 | ABERTO | G | Conta (2), Empresas (6), PLD (8), Transição (4) e Expansão (5) | energia-transicao (L655), energia-expansao (L550), energia-empresas (L754), energia-inclusao (L646), energia-conta, energia-pld |
| PD-35 | ABERTO | P | Empresas (6 page.tsx mais as fichas) e as páginas que mostram a sigla | energia-empresas, energia-conta |
| PD-36 | ABERTO | P | 1 página (geracao) | energia-geracao |
| PD-37 | ABERTO | M | 4 páginas de Geração | energia-geracao |
| PD-38 | ABERTO | M | fichas de Geração e Água | energia-comp-evidencia |
| PD-39 | ABERTO | G | 1 página (geracao/restricoes) | energia-geracao |
| PD-40 | ABERTO | P | 1 página (geracao/restricoes); é uma confirmação | energia-geracao |
| PD-41 | ABERTO | M | 1 página (geracao/termica) | energia-geracao |
| PD-42 | ABERTO | G | 2 páginas (geracao/capacidade, geracao/termica) | energia-geracao |
| PD-43 | PARCIAL | P | 1 página (inclusao-energetica/tarifa-social); só regerar | energia-inclusao |
| PD-44 | ABERTO | P | 1 página (inclusao-energetica/cobertura) | energia-inclusao (exige a pergunta no HTML) |
| PD-45 | ABERTO | M | inicial, Perdas (4) e Território | energia-inicial, energia-perdas |
| PD-46 | ABERTO | não estimado | 1 página (regulacao/consultas-e-agenda) | energia-regulacao |
| PD-47 | ABERTO | não estimado | regulacao (3 page.tsx) | energia-regulacao |
| PD-48 | PARCIAL | P | 3 páginas de Previsões e Modelos; só regerar | energia-previsoes, energia-pld |
| PD-49 | ABERTO | M | 1 página (pld/diferencas-regionais) | energia-pld |
| PD-50 | ABERTO | P | 1 página (pld/cmo-e-formacao) | energia-pld |
| PD-51 | ABERTO | M | 1 página (pld) | energia-pld |
| PD-52 | ABERTO | G | 1 página (pld/historico); decisão de produto | energia-pld |
| PD-53 | ABERTO | M | 1 página (expansao/cronograma) | energia-expansao |
| PD-54 | ABERTO | P | 5 páginas de Expansão (ficha Sobre este dado) | energia-expansao |
| PD-55 | ABERTO | P | 1 página (transicao/emissoes) | energia-transicao |
| PD-56 | ABERTO | P | 1 página (visao-geral) | energia-visao |
| PD-57 | ABERTO | P | 1 página (territorio) | energia-territorio |
| PD-58 | ABERTO | M | 1 página (territorio) | energia-territorio, energia-conteudo-r8-T1 |
| NT-01 | ABERTO | M | 10 page.tsx: Água (4), Conta (2), Perdas (4); NavegacaoLocal e SeguirPainel alcançam 64 | energia-perdas, energia-conta, energia-agua, energia-estrutura-r7, energia-estrutura-r9 |
| NT-02 | ABERTO | P | 4 page.tsx do Aprenda mais o menu e o mapa | energia-aprenda (L362), energia-mapa, energia-comp-navegacao |
| NT-03 | ABERTO | P | 70 páginas (siglas.ts); decisão do coordenador | energia-siglas, energia-aprenda-instituicoes, energia-conteudo-r8-M1, -M2, -R, -T2 |
| NT-05 | ABERTO | P | 70 páginas (siglas.ts); bloqueado pela fonte | energia-siglas, energia-estrutura-r7 (lista NOVAS), energia-conteudo-r8-M1 |
| NT-09 | ABERTO | P | 2 page.tsx de Transição (os dois links da Geração) | energia-transicao (só confere o href, segundo o pedido) |
| NT-10 | PARCIAL | P | 1 página (empresas/ativos) | energia-empresas |
| NT-16 | ABERTO | G | 5 pontos: carga.ts:45 e :46, transicao.ts:178 e as duas perguntas de mercado.json; decisão | energia-carga, energia-conteudo-r8*, energia-transicao, energia-mercado-pagina |
| LI-01 a LI-11, LI-13 a LI-17, LI-21, LI-22 | ABERTO | P | 0 páginas (fora do fecho das 70 page.tsx) | nenhum teste cita o nome; os testes por prefixo (energia-agua, -carga, -regulacao, -pld, -previsoes) e o energia-comp-integracao varrem a pasta e toleram a remoção |
| LI-12 | ABERTO | P | 0 páginas | energia-governanca (L117 a L120): trocar o alvo antes de apagar |
| LI-18 | ABERTO | P | 0 páginas | energia-transicao (L645): tirar o nome da lista antes de apagar |
| LI-19 | ABERTO | P | 0 páginas | depende de LI-20; energia-territorio e energia-conteudo-r8-T1 renderizam a página e não devem mudar |
| LI-20 | ABERTO | P | 0 páginas | os mesmos dois testes de página; nenhum importa as três exportações |
| LI-23 | ABERTO | P | 0 páginas | nenhum teste lê os documentos citados (Grep: só comentários); os dois que leem docs/ usam outros arquivos |

Três linhas ficaram sem esforço: PE-12 (o pedido não aponta componente nem medida) e PD-46 e PD-47 (dependem de achar a fonte legível, e sem ela não há base para dimensionar). Onde não há base para dimensionar, a coluna diz "não estimado" em vez de chutar P, M ou G.

## Registro do coordenador conferido no código

Os itens S1 a S15 e D5 de `_coordenador.md` foram conferidos contra o código atual. Eles servem de evidência para as linhas ATENDIDO acima.

| Id | Achado | Onde conferi | Resultado |
| --- | --- | --- | --- |
| S1 | Ano sem separador de milhar | `tabela.ts:83` (`ehColunaDeAno`) e `:89` | confere |
| S2 | Âncoras de verbetes e do cartão de Qualidade | `evidencias-verbetes.ts:146`, `:153`, `:160`, `:167`; `mapa.ts:528` a `530` | confere |
| S3 | `nivelTitulo` em NavegacaoLocal | `NavegacaoLocal.tsx:40` e `:45`; 9 arquivos usam `nivelTitulo={3}` | confere |
| S4 | `RespostaCurta depois` | `RespostaCurta.tsx:28` e `:30`; `globals.css:315` | confere |
| S5 | Legenda do GraficoLinhas mais baixa | `globals.css:317` a `322` | confere |
| S6 | Mesma cor para a mesma entidade | regra no guia | em curso; a regra não está em `GUIA_MIGRACAO.md` (ver achado 8) |
| S7 | `Numero revisoes` | `Numero.tsx:65` e `:94` | confere |
| S8 | Barra de profundidade opaca e sem cobrir o foco | `ModoProfundidade.tsx:221` (`bg-papel`) e `:164` (`aoFocar`) | confere |
| S9 | Seletor com quebra de linha e borda esmaecida em tabela larga | `ModoProfundidade.tsx:224` (`flex-wrap`) e `:240`; `TabelaInterativa.tsx:244`; `globals.css:158` | confere |
| S10 | Sobre este dado monta o corpo na primeira abertura | `SobreEsteDado.tsx:79` e `:114` | confere |
| S11 | Dica do Termo com palavras simples | `Termo.tsx:14` a `20` | confere |
| S12 | Início e resumos sem "agora" | `navegacao.ts:31` e `:96` | confere em navegacao.ts; resta "agora" em `mapa.ts:712` |
| S13 | Verbete DEC sobre expurgos | `conceitos-qualidade.ts:67` | confere |
| S14 | Faixa de abas em duas colunas no celular | `globals.css:304` | confere |
| S15 | PequenosMultiplos: legenda e grade | `PequenosMultiplos.tsx:209` | confere |
| D5 | Ruído de ponto flutuante no arquivo exportado | `tabela.ts:361` a `373` (`numeroMaquina`) | confere |
| D1, D2, D3, D4, D6, D7 | Itens de dado e pipeline | ver PD-18, PD-15, PD-16, PD-14, PD-13 e PD-17 | código feito em D1, D2, D3 e D7; D2, D3 e D7 seguem "pendente" no registro |

## Registros sem pedido de mudança

Itens dos pedidos que não pedem mudança compartilhada e por isso não entram nas contagens:

* **Água.** AGUA-1.5 (a linha de revisões de `Numero` está em uso, "nada mais a pedir"), AGUA-2.4 (manter `ena_diario.csv` na publicação), AGUA-3 a 6 (o que foi aplicado na página mãe, decisões locais, achados e equivalências).
* **Aprenda.** APRENDA-5 (equivalência registrada). APRENDA-6: criar verbetes de CVM, MCTI e CADE "se o coordenador pedir", sem pedido hoje.
* **Carga e Rede.** CARGA-2.5 (siglas FBTA, FJUSC e FNS+NESE do ATLS sem definição pública: "nada a corrigir"), CARGA-2.7 (erro funcional da escala Hora, já corrigido), CARGA-3 a 6 (equivalências, mapa das visões, testes e medidas) e CARGA-7 além do que virou linha.
* **Conta de luz.** CONTA-0 (nenhum arquivo a apagar; `ContaLinkPainel.tsx` continua em uso por `ContaLinkFiltros`), CONTA-7 nos pontos que dependem de fonte externa (PRORET 7.1 não lido, REN 1.000/2021 com resposta 403, bandeira de out/2026 possivelmente publicada depois da captura) e CONTA-8 (anexo da localização das visões).
* **Dados e Metodologia.** DADOS-7 (resolvido por componentes do coordenador) e a equivalência de visões.
* **Empresas.** EMPRESAS-5 (achados de nome, contagem e escopo) e EMPRESAS-6 (pendências da família).
* **Geração.** GERACAO-6 (achados), GERACAO-8.3 (nomes de coluna do ONS nas fórmulas das fichas, mantidos por serem a trilha de auditoria), GERACAO-9 e GERACAO-10.
* **Inicial.** Achados: a EAR de 28/09 na Visão geral e de 29/09 em Água e clima (duas golds, um dia de diferença) e o "2026, ano em curso" da Regulação no quadro de atualidade.
* **Mercado e Regulação.** MERCADO-4.2 (a "contratação" de contratos ainda não integrada; a página já diz isso).
* **Modelos e Previsões.** As equivalências e a nota de que testes de outras famílias falhavam na rodada do executor (`energia-pld`, `energia-conteudo-r8-R`, `energia-interface-r2`); não verificado agora, porque os testes não foram rodados.
* **Perdas.** PERDAS-7 (equivalências; a malha municipal carregada ao montar é decisão local).
* **PLD.** PLD-6 a PLD-8 (achados, medidas e matriz de preservação).
* **Qualidade.** QUALIDADE-1 (âncoras, já resolvido) e QUALIDADE-12 (equivalências).
* **Visão e Território.** O último ponto de VISAO-7: o link da Visão geral usa `/qualidade#expurgos`, e a âncora existe (`qualidade/page.tsx:494`, `id="expurgos"`).

## Achados que pedem decisão do coordenador

1. **`_coordenador.md` está desatualizado em quatro linhas.** D2 (coluna `eh_total`), D3 (arredondamento meio para cima) e D7 (nota do teto estrutural) aparecem como "pendente", mas o código foi feito em 3474c7f0b; D1 diz "código feito" e está certo. Em todos os quatro os dados publicados continuam os de 30/09 a 01/10 (PD-15, PD-16, PD-17 e PD-18). Decisão: quando e onde regerar os golds e CSV.
2. **Visão e Território e Dados discordam sobre o validador.** VISAO-7 diz que `sintese_regras_diario.csv` é falso positivo do validador. DADOS-1 mostra que o validador está certo e que os arquivos foram reescritos em 8086b52b3 (08/10) depois da validação de 01/10. Reli os três CSV com `csv.reader` e `;`: nenhuma linha fora do padrão. A ação é só reexecutar o módulo Dados (PD-28); PD-59 fica OBSOLETO.
3. **Três textos diferentes para Dados e Metodologia.** `mapa.ts:128` e `:129`, `navegacao.ts:188` e `:193` e os `h1` das páginas (`dados/page.tsx:124`, `metodologia/page.tsx:152`) dizem coisas distintas, e o comentário de `PAGINAS_MAPA` promete "igual ao título da página". Nenhum pedido trata disso.
4. **`mapa.ts:712` ainda diz "agora".** S12 limpou `navegacao.ts`; o card da Visão geral no mapa mantém "o que está acontecendo agora".
5. **Cinco arquivos sem uso que nenhum pedido listou.** `BarrasMix.tsx` e `lib/energia/referencias.ts` (sem referência em src nem em docs), `ModuloEmIntegracao.tsx` (um teste o lê), e `Cronograma.tsx` com `lib/energia/cronograma.ts` (biblioteca testada, sem página). Estão na seção "Arquivos sem uso para apagar".
6. **Ordem de remoção em Território.** `TerritorioLinkPainel.tsx` ainda é importado (`TerritorioPagina.tsx:4`); só pode sair depois das três exportações sem uso (LI-19 e LI-20).
7. **Três pedidos de alvo de toque foram atendidos só para ponteiro grosso** (AC-02, AC-03, AC-04). As medidas de 40, 32 e 24 px dos executores só se explicam por medição sem ponteiro grosso, porque com `pointer: coarse` o código já dá 44 px. Decisão: manter a regra por `pointer: coarse` ou valer abaixo de 768 px, como pedem Modelos e Inclusão.
8. **S6 cita uma regra que não achei.** `_coordenador.md` diz que "mesma cor por entidade" está no guia dos executores; Grep por cor e cores em `GUIA_MIGRACAO.md` só acha a linha 28 (sobre cor de aprovação). As paletas de `conta.ts:64` a `99` repetem tokens com significados diferentes (VI-06).
9. **Decisões de produto paradas.** Selo MISTO (CO-10), uma só porta para a tabela (CO-14), tabela do ranking da Conta sob demanda (PE-08), títulos com 11 palavras (NT-16), nomes oficiais de CCEE e IBGE (NT-03), série semanal do PLD de 2001 a 2020 (PD-52), cabeçalho da inicial (CE-10).
10. **Testes com resto morto.** `energia-conta.test.ts:1143` e `energia-conteudo-r8-T1.test.ts:232` ainda removem "Recorte atual" do texto, que não existe mais (NT-17).

## Não verificado

* **Medidas de navegador.** Posições da primeira tela, alturas de componente, CLS, TBT, pesos servidos em kB e o comportamento com fonte a 200% não foram refeitos; aparecem como "segundo o pedido". Os pesos de HTML da Conta (681.301 B e 621.766 B) são anteriores a 944408dde.
* **Testes.** Nenhum foi executado. As listas de risco são leitura de nomes e de atributos de DOM; não provam que passam ou falham. Também não verifiquei os testes que o pedido de Modelos disse que falhavam.
* **Campos de gold procurados só por nome de chave.** PD-41 e PD-42 (não procurados), PD-26 (nulos de SCEE e Lei 14.299 não conferidos), PD-22 (datas 28/09 e 29/09 são do pedido), PD-24, PD-30, PD-46, PD-47 e PD-52 (dependem de fonte ou decisão), PD-53 (verificação parcial) e PD-58 (a parte de até 10 kW).
* **Documentos.** Não reli `modulos/aprenda.md`, `modulos/geracao.md` nem `modulos/pld.md`; só sei, pelos pedidos, que descrevem a interface anterior.
* **Dez conjuntos `ccee:contrato_montante_*` em RECURSO VERIFICADO** (MERCADO-4.2): número do pedido, catálogo não relido.
* **Revalidação em 390 px.** VI-03 e VI-02 foram conferidos pelo código e pelos testes novos, não numa tela estreita.

## Ordem proposta

No máximo 15 itens, só ABERTO ou PARCIAL, do maior efeito sobre a qualidade percebida (primeira tela no celular, gráficos legíveis, acessibilidade, peso do HTML, números corretos) para o menor, com o menor risco primeiro em caso de empate.

1. **Regerar os golds e CSV com o código que já está commitado** (PD-13, PD-15, PD-16, PD-17, PD-18, PD-28, PD-29, PD-32, PD-43, PD-48). Números corretos sem escrever código: soma de subsídios que dobra, centavos de arredondamento, FEC da ELEKTRO, nota do teto do PLD e as três checagens "reprovadas" que já estão certas. Risco: os dados mudam, e D1 precisa do silver e do bronze de continuidade, que não estão neste ambiente.
2. **Faixa de métricas compacta no celular** (CE-02). A primeira figura fica entre y=1171 e y=1955 em 390 por 844 (medidas dos pedidos) porque cada medida ocupa uma linha; vale para 59 páginas. Esforço M, risco baixo.
3. **Alvo de 44 px abaixo de 768 px** (AC-02, AC-03, AC-04). Três regras de uma linha (65, 59 e 70 páginas) que hoje só valem com ponteiro grosso; é o piso de acessibilidade no toque. Risco baixo.
4. **aria-current certo nas páginas netas do Aprenda** (AC-01). Leitores de tela anunciam "página atual" na seção em vez do verbete ou do passo. Esforço P, risco baixo.
5. **Links com parâmetro levam ao bloco que reage a ele** (CO-19). Três arquivos e as âncoras já existem; o leitor chega à comparação ou ao mapa em vez do topo de Qualidade. Risco muito baixo.
6. **Lista de arquivos aberta em Analisar e Auditar** (CO-17). Uma linha em `SeguirPainel.tsx` (64 páginas); quem procura os dados não precisa abrir o bloco à mão.
7. **GraficoPontos e Histograma legíveis no celular** (CE-07, CE-08). Gráficos legíveis: caixa de 520 px que mostra 11 de 51 linhas, faixa vazia de 136 px e rótulos sobrepostos (medidas do pedido); 13 e 2 páginas. Esforço M.
8. **Ficha Comprove sob demanda onde ainda é inline** (PE-02, depois PE-04 e PE-05). Peso do HTML: 80 arquivos passam o objeto de evidência inline; o mecanismo já existe. É o item de peso com maior risco, porque as suítes contam fichas e travam tetos de 600_000 B.
9. **Menus do cabeçalho sob demanda** (PE-03). Alcança as 70 páginas (11,4 kB na Conta e 22 kB em Qualidade, segundo os pedidos). Esforço M, risco médio.
10. **Cabeçalho do módulo mais baixo** (CE-03). Primeira tela: título em uma linha e recorte junto da fonte; 67 páginas. Mexe em CSS fixado por `energia-estrutura-r7`.
11. **Forma e padrão além da cor** (AC-08, AC-09). Quem tem daltonismo não separa Solar MMGD de gás natural nem biomassa de outras térmicas (avaliação U04, segundo o pedido). Começa por Geração; esforço M a G.
12. **Textos de navegação e mapa** (NT-02, NT-09, NT-10 e a seção "Textos de navegação e mapa"). Alinhamento barato (uma linha cada) que tira três perguntas fora do título, o "agora" de `mapa.ts:712` e os três textos de Dados e Metodologia. Risco baixo (`energia-aprenda`, `energia-mapa`).
13. **Termo nas fontes da inicial e Sistemas Isolados no mapa** (CO-03). Os seis verbetes já existem; falta a troca em `page.tsx:634` e a nota no mapa. Esforço P, 1 página.
14. **Levar a escolha entre páginas irmãs** (NT-01). Três famílias têm soluções locais diferentes para o mesmo problema; vale para 10 `page.tsx`. Esforço M, risco médio (NavegacaoLocal alcança 64 páginas).
15. **Apagar os arquivos sem uso e ajustar os documentos** (LI-01 a LI-23). Limpeza sem efeito para o leitor; por último e com o servidor parado. Dois testes precisam mudar antes (`energia-governanca` e `energia-transicao`).

## Arquivos sem uso para apagar

Lista consolidada dos pedidos, com a checagem por Grep. Ordem sugerida, com o servidor parado: (1) remover de `TerritorioPagina.tsx` as exportações `TerritorioSeguir`, `TerritorioAnalise` e `TerritorioAuditoria`; (2) apagar `TerritorioLinkPainel.tsx`; (3) ajustar os dois testes que leem arquivos da lista; (4) apagar os demais; (5) ajustar os documentos.

| Arquivo | Pedido por | Importadores (Grep) | Testes que leem | Documentos a ajustar |
| --- | --- | --- | --- | --- |
| `AguaLinkPainel.tsx` | Água | nenhum | nenhum | `modulos/agua.md:5` |
| `CargaLinkPainel.tsx` | Carga e Rede | nenhum | nenhum | `modulos/carga.md:22`, `:234` |
| `RedeLinkPainel.tsx` | Carga e Rede | nenhum | nenhum | `modulos/rede.md:156`, `:175` |
| `RedeMapaFluxos.tsx` | Carga e Rede | nenhum | nenhum | `modulos/rede.md:156` |
| `CatalogoFiltro.tsx` | Dados | nenhum | nenhum | `BENCHMARKS.md:168`, `:190` |
| `EmpresasLinkPainel.tsx` | Empresas | nenhum | nenhum | nenhum |
| `GeracaoLinkPainel.tsx` | Geração | nenhum | nenhum | nenhum |
| `InclusaoLinkPainel.tsx` | Inclusão | nenhum | nenhum | `modulos/inclusao.md:18`, `:49`, `:262`, `:263` |
| `RegulacaoLinkPainel.tsx` | Mercado e Regulação | nenhum | nenhum pelo nome; `energia-regulacao` varre por prefixo (L998, L1021) e tolera | `modulos/regulacao.md:20` |
| `VisaoLinkPainel.tsx` | Mercado e Regulação; Visão e Território | nenhum | nenhum | `CONTINUIDADE.md:97` |
| `PrevisoesLinkPainel.tsx` | Modelos e Previsões | nenhum | nenhum pelo nome; `energia-previsoes:904` varre por prefixo e tolera | `modulos/previsoes.md:162` |
| `ArquivoPrevisoes.tsx` | Modelos e Previsões | nenhum | **`energia-governanca.test.ts:117`** (lê o arquivo; 3 expects, L118 a L120) | `modulos/previsoes.md:197` |
| `PerdasLinkPainel.tsx` | Perdas | nenhum | nenhum | `modulos/perdas.md:18` |
| `PerdasLinkConsulta.tsx` | Perdas | nenhum | nenhum | `modulos/perdas.md:18` |
| `PldLinkPainel.tsx` | PLD | nenhum | nenhum pelo nome; `energia-pld:318` varre por prefixo e tolera | `modulos/pld.md:3`, `:25` |
| `QualidadeLinkPainel.tsx` | Qualidade | nenhum | nenhum | `modulos/qualidade.md:20` |
| `ExpansaoLinkPainel.tsx` | Transição e Expansão | nenhum | nenhum | `modulos/expansao.md:21` |
| `TransicaoLinkPainel.tsx` | Transição e Expansão | nenhum | **`energia-transicao.test.ts:645`** (lista de seis nomes lida por `ler()`) | `modulos/transicao.md:20` |
| `TerritorioLinkPainel.tsx` | Visão e Território | **`TerritorioPagina.tsx:4` e `:140`** (dentro de `TerritorioSeguir`) | nenhum | nenhum |
| exportações `TerritorioSeguir` (L122), `TerritorioAnalise` (L62), `TerritorioAuditoria` (L71) de `TerritorioPagina.tsx` | Visão e Território | nenhum (só a definição) | nenhum | nenhum |
| `src/tests/zz_tmp_aprenda_exec.test.ts` | Aprenda | não aplicável | é um `it.skip` | ignorado pelo git (`.git/info/exclude:9`) |
| `src/tests/zz_tmp_visao_ctx.test.ts` e `zz_tmp_visao_ctx2.test.ts` | Visão e Território | não aplicável | dois `it.skip` | ignorados pelo git |

**Não apagar:** `ContaLinkPainel.tsx`. Perdeu só o componente interno, mas `ContaLinkFiltros` é importado por `conta-de-luz/page.tsx`, `reajustes-e-subsidios/page.tsx` e `partes.tsx`, e `energia-conta.test.ts:763` lista o arquivo.

**Checagem por Grep.** Padrão com os nomes da tabela (mais `ContaLinkPainel`, `BarrasMix`, `ModuloEmIntegracao`, `energia/referencias`, `lib/energia/cronograma` e `energia/Cronograma`) em `src`: além das definições, só aparecem as importações e leituras da tabela (`TerritorioPagina.tsx:4` e `:140`; `energia-governanca.test.ts:117`; `energia-transicao.test.ts:645`; `energia-estrutura-r9.test.ts:105`; duas negações em `energia-mercado-pagina.test.ts:384` e `energia-expansao.test.ts:608`; as importações de `Cronograma` em `energia-comp-cronograma.test.ts`). Em `docs`, `scripts`, `pipeline`, `public/energia/gold` e nos arquivos da raiz, `grep -w` só acha as linhas de documento da tabela (e os próprios pedidos, mais `_coordenador.md:39`). Um segundo teste, o fecho de importações a partir de todos os arquivos de `src/app` (333 candidatos em `src/components/energia`, `src/components/evidencia` e `src/lib/energia`), deixa sem importador exatamente 23 arquivos: os 18 componentes da tabela (todos menos `TerritorioLinkPainel.tsx`, que a importação de `TerritorioPagina.tsx` ainda alcança) e mais cinco que nenhum pedido listou, abaixo.

**Testes que precisariam mudar para apagar a lista dos pedidos**

* `src/tests/energia-governanca.test.ts` (L117 a L120): trocar o alvo da regra "número de rodada interna nunca aparece como previsão" para `previsoes.ts` (`tipo === "RODADA_INTERNA" && estadoModelo !== "PRODUCAO"` e `número retido`) e `PrevisoesArquivo.tsx` (`registrado_no_portal_em`), como propõe o pedido de Modelos.
* `src/tests/energia-transicao.test.ts` (L645): tirar `"TransicaoLinkPainel"` da lista do teste de hexadecimal.
* Sem mudança, mas com resto inócuo: `energia-conta.test.ts:1143` e `energia-conteudo-r8-T1.test.ts:232` removem "Recorte atual" de um texto que já não o tem.
* Os testes que varrem a pasta por prefixo (`energia-agua:1934`, `energia-carga:985`, `:1033`, `:1046`, `energia-regulacao:998`, `:1021`, `energia-pld:318`, `energia-previsoes:904`) e `energia-comp-integracao.test.ts:28` (um `it` por componente cliente) apenas passam a ter menos arquivos.

**Sem uso e fora dos pedidos** (achados do fecho de importações; decisão do coordenador)

| Arquivo | Situação | Testes |
| --- | --- | --- |
| `src/components/energia/BarrasMix.tsx` | 0 referências em `src` e em `docs` (Grep); último commit 03bc93a2b, de 28/09 | nenhum |
| `src/components/energia/ModuloEmIntegracao.tsx` | nenhuma importação; docs `modulos/mercado.md:178` e `modulos/dados.md:116` o citam | **`energia-estrutura-r9.test.ts:105`** lê o arquivo e exige `<CabecalhoModulo recolher={false}`; `energia-mercado-pagina.test.ts:384` e `energia-expansao.test.ts:608` só negam a string |
| `src/lib/energia/referencias.ts` | nenhuma importação (Grep por `energia/referencias`); último commit d1dcbf611, de 28/09 | nenhum |
| `src/components/energia/Cronograma.tsx` e `src/lib/energia/cronograma.ts` | só `energia-comp-cronograma.test.ts` os importa; `docs/observatorios/COMPONENTES_ENERGIA.md:61` e `:255` a `266` os documentam como biblioteca | `energia-comp-cronograma.test.ts`: é componente de biblioteca testado, sem página |

## Pipeline e dados

Itens que exigem mudança em `pipeline/energia` ou nos golds e CSV de `public/energia`, separados dos de interface. As linhas completas, com evidência, estão na tabela "Pipeline e dado" (PD). Aqui elas aparecem agrupadas pelo que falta fazer.

### Código já commitado, falta regerar o gold ou o CSV (10)

Não pedem código. Pedem executar os módulos com o código atual. D1 depende de silver e bronze de continuidade que não estão neste ambiente (`_coordenador.md`), e uma recoleta traria dados novos.

| Id | Mudança | Arquivo | Origem | Estado |
| --- | --- | --- | --- | --- |
| PD-13 | Fichas Comprove de EAR e ENA com a mesma comparação entre capturas da tabela de revisões (D6) | agua_detalhe.py (L3314 a L3525, segundo `_coordenador.md`) | AGUA-2.11; DADOS-2 | PARCIAL |
| PD-15 | Subsídios: coluna eh_total em conta_subsidios_anual.csv (D2) | conta.py; conta_subsidios_anual.csv | CONTA-7 | PARCIAL |
| PD-16 | Arredondar em decimal, meio para cima, no pipeline (D3) | base.py; gold/comum.py; conta.py | CONTA-7 | PARCIAL |
| PD-17 | Texto das limitações do PLD e do teto estrutural com a REN 1.032/2022 (D7) | pld_detalhe.py; pld.json | PLD-5 | PARCIAL |
| PD-18 | FEC: tirar do FEC o mês com menos de 95% das UCs (D1) | qualidade.py; qualidade_distribuidoras_mensal.csv | QUALIDADE-11 | PARCIAL |
| PD-28 | Reexecutar o módulo Dados para refazer relatório de validação e publicação | `python3 pipeline/energia/executar_modulo.py dados --sem-coleta` | DADOS-1.1 | ABERTO |
| PD-29 | Impressão digital do arquivo julgado em todas as checagens de CSV | validacoes.py; modulos/dados.py | DADOS-1.2 | PARCIAL |
| PD-32 | Gravar versao_codigo também em catalogo.json | `catalogo.py` | DADOS-3 | PARCIAL |
| PD-43 | Inclusão: download da ficha da CDE aponta também para a série mensal por UF | inclusao.py; inclusao.json | INCLUSAO-7 | PARCIAL |
| PD-48 | Previsões: textos do pipeline sem "até agora", "rodada atual", "CALIBRADO" e "melhor que a persistência" | previsoes.py; previsoes.json | MODELOS-F | PARCIAL |

### Mudança nova no pipeline (campo, coluna ou ficha) (32)

Cada item cita o arquivo gerado e o que ele não tem hoje.

| Id | Mudança | Arquivo | Origem | Estado |
| --- | --- | --- | --- | --- |
| PD-01 | Água: publicar P10, mediana e P90 da ENA de 30 dias por data (série semanal) | agua_detalhe.py; agua_detalhe.json (afluencia) | AGUA-2.1 | ABERTO |
| PD-02 | Água: data e período da maior diferença entre a soma das usinas e a ENA do subsistema | `agua_detalhe.py` | AGUA-2.2 | ABERTO |
| PD-03 | Água: faixa da ENA também em MWmed ou com a MLT fixa | `agua_detalhe.py` | AGUA-2.3 | ABERTO |
| PD-04 | Água: chuva diária desde 2001 ou climatologia de 30 dias por data | agua_detalhe.py; agua_precipitacao_bacias_diario.csv | AGUA-2.5 | ABERTO |
| PD-05 | Água: publicar Spearman e correlação sobre anomalia padronizada | `agua_detalhe.py` | AGUA-2.6 | ABERTO |
| PD-06 | Água: conferência com estações separada do produto IMERG Late e por bacia | `agua_detalhe.py` | AGUA-2.7 | ABERTO |
| PD-07 | Água: CSV com a variação de EAR de todos os reservatórios, por subsistema e janela | `agua_detalhe.py` | AGUA-2.8 | ABERTO |
| PD-08 | Água: coluna de marca para volume fora de 0 a 100% nos CSV de reservatórios | agua_reservatorios.csv; agua_reservatorios_diario.csv | AGUA-2.9 | ABERTO |
| PD-09 | Água: faixa por data ou variação típica de 30 dias por reservatório | `agua_detalhe.py` | AGUA-2.10 | ABERTO |
| PD-10 | Água (mãe): EAR e P10, P50 e P90 da data em MWmês na série semanal | `agua_detalhe.py` | AGUA-2.13 | ABERTO |
| PD-11 | Água (mãe): colunas tolerancia_mwmes e fechado em agua_capacidade_eventos.csv | `agua_capacidade_eventos.csv` | AGUA-2.14 | ABERTO |
| PD-12 | Água (mãe): ear_diario.csv na lista de downloads do módulo | agua_detalhe.py (downloads) | AGUA-2.15 | ABERTO |
| PD-19 | Qualidade: coluna meses_fec nos CSV anuais e fec_min e fec_max com conjuntos de 11 meses | qualidade.py; qualidade_conjuntos_anual_*.csv; qualidade_municipios.csv | QUALIDADE-11 | ABERTO |
| PD-21 | Fichas com as mesmas casas decimais que a página (valor_exibido) | carga.py; perdas.py; evidencia.py | CARGA-2.1; INICIAL-achados | ABERTO |
| PD-22 | Carga: ficha do pico (P026) para o último dia publicado, ou dizer por que o dia é outro | `carga.py` | CARGA-2.2 | ABERTO |
| PD-23 | Rede: consumidores atingidos, duração e UF por perturbação, e soma por região | `rede_detalhe.py` | CARGA-2.3 | ABERTO |
| PD-26 | Conta: marcar SCEE e Lei 14.299/2022 como inexistentes de 2013 a 2019 (hoje nulos) | `conta.py` | CONTA-7 | ABERTO |
| PD-30 | Incluir os 9 CSV do próprio módulo Dados no relatório de validação | validacoes.py; modulos/dados.py | DADOS-1.3 | ABERTO |
| PD-31 | Validar valor fisicamente impossível (carga negativa) antes de guardar a observação, ou marcar a captura como incompleta | `validacoes.py` | DADOS-2 | PARCIAL |
| PD-33 | Campo rotulo (frase curta) de cada arquivo em arquivos.json | pipeline de arquivos.json | DADOS-4 | ABERTO |
| PD-34 | Fichas Comprove para medidas que hoje não têm evidência na gold | conta.py; empresas.py; pld_detalhe.py; transicao.py; expansao.py | CONTA-3; EMPRESAS-3; PLD-5; TRANSICAO-2 | ABERTO |
| PD-39 | Geração: perfil por hora do dia das restrições | `geracao_detalhe.py` | GERACAO-8.5 | ABERTO |
| PD-41 | Geração: coluna de dias conciliados na série de participação térmica de 7 dias | `geracao_detalhe.py` | GERACAO-8.7 | ABERTO |
| PD-42 | Geração: recorte por subsistema e UF em Capacidade e Térmica, e série mensal por subsistema na matriz | `geracao_detalhe.py` | GERACAO-7.8; GERACAO-8.8 | ABERTO |
| PD-45 | Perdas: nomear a origem do denominador, registrar a base alternativa e uma reconciliação de 2025 | perdas.py; evidencia.py | INICIAL-6 | ABERTO |
| PD-49 | PLD: média e mediana nas horas separadas em regional.amplitude[] | `pld_detalhe.py` | PLD-5 | ABERTO |
| PD-50 | PLD: contagem de horas junto de frac_abs_ate_1 em relacao_anual | `pld_detalhe.py` | PLD-5 | ABERTO |
| PD-51 | PLD: fluxo nas fronteiras até o mesmo dia do preço | pld_detalhe.py; pld_horario_recente.json | PLD-5 | ABERTO |
| PD-53 | Expansão: previsão por ano sem as datas convencionais em bloco (2031) | `expansao.py` | TRANSICAO-5 | ABERTO |
| PD-56 | Visão geral: EAR do SIN sem arredondamento intermediário em sintese_multiplos.csv | módulo sintese | VISAO-7 | ABERTO |
| PD-57 | Território: registrar na gold o bloqueio da camada 24 da EPE (Token Required) | territorio.py; territorio.json | VISAO-7 | ABERTO |
| PD-58 | Território: publicar as duas contagens de usinas por UF (com e sem registros de até 10 kW) | `territorio.py` | VISAO-7 | ABERTO |

### Texto que o pipeline escreve e a interface hoje corrige ou limpa (10)

A página traduz ou limpa na exibição; a redação final deve vir da origem.

| Id | Mudança | Arquivo | Origem | Estado |
| --- | --- | --- | --- | --- |
| PD-20 | Qualidade: notas_fonte sem marcação crua e sem termos do processamento | qualidade.py; qualidade.json | QUALIDADE-10 | ABERTO |
| PD-25 | Carga: ficha a07_reproducao sem a expressão interna "(reprodução do diagnóstico)" | `carga.py` | CARGA-2.6 | ABERTO |
| PD-27 | Conta: ressalvas do gold com números em formato brasileiro e sem nome de componente | conta.py; conta.json | CONTA-7 | ABERTO |
| PD-35 | Empresas: preferir a sigla mais longa que começa com a sigla truncada em 16 caracteres | empresas.py (prioridade da sigla de exibição) | EMPRESAS-5 | ABERTO |
| PD-36 | Geração: rótulo do arquivo horário (365 dias, não 366) | `geracao_detalhe.py` | GERACAO-8.1 | ABERTO |
| PD-37 | Geração: vocabulário interno e a frase "igual ao do Balanço" nos textos da gold | `geracao_detalhe.py` | GERACAO-8.2 | ABERTO |
| PD-38 | Geração: fichas com "recurso não identificado" sem citação do recurso | evidencia.py; evidencias dos módulos | GERACAO-8.4 | ABERTO |
| PD-44 | Inclusão: a pergunta da cobertura ("Quem pode estar ficando de fora?") enquadra a razão como exclusão | inclusao.py:2271; inclusao.json | INCLUSAO-7 | ABERTO |
| PD-54 | Expansão: texto do RALIE sem "Parquet histórico" e sem nome de campo | `expansao.py` | TRANSICAO-5 | ABERTO |
| PD-55 | Transição: frase da quebra de jan/2025 do fator de emissão sem causalidade | `transicao.py` | TRANSICAO-5 | ABERTO |

### Decisão de produto, fonte externa, investigação ou processo (6)

Sem tarefa de código imediata.

| Id | Mudança | Arquivo | Origem | Estado |
| --- | --- | --- | --- | --- |
| PD-14 | Gerar as bases com árvore limpa, sem o sufixo +alterado (D4) | todos os módulos; catalogo.py | AGUA-2.12; CONTA-7; DADOS-3 | ABERTO |
| PD-24 | Rede: conferir se há mudança de arquivo ou de medida do ONS em 2026 que explique as 2.472 horas com resíduo | `investigação` | CARGA-2.4 | ABERTO |
| PD-40 | Geração: confirmar se potencia_max_cortada_mw é o corte simultâneo numa meia hora e nomear o cabeçalho | `geracao_detalhe.py` | GERACAO-8.6 | ABERTO |
| PD-46 | Regulação: cópia legível da Portaria 7.157/2026 da agenda regulatória | `regulacao.py` | MERCADO-6 | ABERTO |
| PD-47 | Regulação: texto do ato de 2021 (REH 2.828/2020) e de 2023 (REH 3.167/2022); data de publicação de 2021 | `regulacao.py` | MERCADO-6 | ABERTO |
| PD-52 | PLD: integrar a série semanal de 2001 a 2020 (decisão de produto) | pld.py; catálogo | PLD-5 | ABERTO |

### Pedido cuja premissa não vale (1)

Nenhuma ação própria.

| Id | Mudança | Arquivo | Origem | Estado |
| --- | --- | --- | --- | --- |
| PD-59 | Ajustar o validador que reprova sintese_regras_diario.csv por ponto e vírgula entre aspas ("falso positivo") | `validacoes.py` | VISAO-7 | OBSOLETO |

**Ordem prática.** (1) Executar os módulos do primeiro grupo e conferir, nos testes que fixam valores (`energia-gold-contrato`, `energia-conta`, `energia-qualidade`, `energia-pld`, `energia-previsoes`, `energia-dados-r9`), o que muda de verdade. (2) Só então abrir a interface do que depende da coluna nova: `validacoesDosCsv` e `estadoDoArquivo` em `dados-servidor.ts` (PD-29) e, depois de regerar o PLD, a retirada das funções que trocam a cláusula em `pld.ts:1986` a `2002` (PD-17). (3) D4, a versão do código sem `+alterado` (PD-14), fica por último, com a árvore limpa, depois de todas as correções.

## Textos de navegação e mapa

Desalinhamentos que ainda existem em `src/lib/energia/navegacao.ts`, `mapa.ts` e `siglas.ts` (e nos dois arquivos que repetem o texto para o leitor). Já estão alinhados, com commit: Início e resumos sem "agora" em `navegacao.ts` (S12), perguntas de Carga, Rede, Geração, Mercado, Regulação, Expansão, Transição, Empresas e Perdas, o rótulo de Previsões e a descrição da Regulação (f0d07bc89), e as siglas PNAD, PASI, MDS e CV (07512da6e).

| Onde | Texto atual | Desalinhamento | Origem |
| --- | --- | --- | --- |
| `mapa.ts:127`, `navegacao.ts:187` | "O que significam os conceitos e como se ligam aos números?" (11 palavras) | Pergunta do Aprenda acima das 9 palavras; o pedido sugere "O que cada conceito significa e onde aparece?". `energia-aprenda.test.ts:362` compara o título com o mapa, então os dois arquivos mudam juntos. | APRENDA-1.2 (NT-02) |
| `mapa.ts:128`, `navegacao.ts:188`, `dados/page.tsx:124` | mapa: "O que é público sobre o setor elétrico, e o que já está integrado?"; menu: `"De onde vêm os números e como reutilizá-los?"`; título: "Encontre a fonte e reproduza o número" | Três textos para a mesma página, apesar do comentário "igual ao título da página de destino" (`mapa.ts`, tipo `PaginaMapa`). | achado desta triagem |
| `mapa.ts:129`, `navegacao.ts:193`, `metodologia/page.tsx:152` | mapa: "Como os números são produzidos, e o que eles não dizem?"; menu: "Como calculamos e quais são os limites da análise?"; título: "Do arquivo ao número que você vê" | Idem para Metodologia. | achado desta triagem |
| `mapa.ts:712` | "o que está acontecendo agora, em frases com a evidência de cada número." | Palavra de tempo relativo na descrição da Visão geral; S12 limpou só `navegacao.ts`. | achado desta triagem (resto de INICIAL-4) |
| `transicao.ts:209` | "Quais fontes atenderam a carga?" (`LIGACAO_GERACAO.pergunta`) | Texto do link para a Geração nas páginas de Transição; a pergunta passou a "De onde vem a eletricidade?". | GERACAO-1 (NT-09) |
| `empresas/ativos/page.tsx:62` | título de metadata "Quem opera quais ativos? Usinas e linhas por CNPJ" | A pergunta de Cadastro e ativos mudou para "Quem são os donos dos ativos?" (`empresas.ts:72`). | EMPRESAS-4 (NT-10) |
| `siglas.ts:9` e `:12` | CCEE "Câmara de Comercialização de Energia Elétrica"; IBGE "Instituto Brasileiro de Geografia e Estatística" | Nomes que a Lei 15.269 (CCEE) e a lei do IBGE alteram, segundo o Aprenda; os verbetes `ccee` e `ibge` já dizem isso. Decisão do coordenador. | APRENDA-1.5 (NT-03) |
| `siglas.ts` | sem DECOMP, DESSEM e NEWAVE | Os verbetes existem (`conceitos.ts:509`, `:523`, `:490`), mas a expansão exige ler a fonte (manual do CEPEL). Bloqueado. | PLD-1 (NT-05) |
| `carga.ts:45`, `:46`, `transicao.ts:178`, `mercado.json` | perguntas de 11 e 12 palavras (P026, P027, PERGUNTA_ONS, MRE e GSF, encargos) | Regra de 5 a 9 palavras; testes de conteúdo fixam P026 e P027. Decisão. | CARGA-7; TRANSICAO-4; MERCADO-5 (NT-16) |
| `docs/observatorios/energia/ESPECIFICACAO.md:245`, `:1207`, `:1295`, `:1372`; `MATRIZ_PAINEIS.md:64`, `:82`, `:99`; `modulos/rede.md:27`, `:167` | perguntas originais de Empresas ("Quem participa do setor e como atua?"), P021, P029 e P036 | São o texto da especificação. O pedido de Carga (CARGA-1.8) quer a pergunta do P029 atualizada nesses documentos e em `conceitos-rede.ts:85`; os demais só se o coordenador quiser que a especificação siga as páginas. | CARGA-1.8 (CO-22) e os registros de EMPRESAS-4 e GERACAO-1 |
