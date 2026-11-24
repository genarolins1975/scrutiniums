# Figuras do Varejo

Figuras e artefatos da coleção Varejo, desenhados à mão (SVG e HTML, sem biblioteca). A ideia de direção de arte vem do assunto: **o cupom e a prateleira**. Toda página do Varejo (Brasil, Segmentos, Grupos, Fichas, Comparador) pode importar daqui.

## Regras que valem para todas

- **Número só de seletor.** Nenhuma figura calcula dado: recebe valores prontos de `src/lib/varejo/dados.ts` (ou `grupos.ts`, `comparador.ts`). Seletor novo entra lá, com teste em `src/tests/varejo.test.ts`.
- **Texto é HTML.** As linhas e áreas são SVG esticado (`preserveAspectRatio="none"` com `vector-effect: non-scaling-stroke`); rótulos, eixos e valores são HTML posicionado por cima. Por isso nada fica abaixo de 12 px, nem no celular. Não escreva `<text>` em SVG.
- **Cor só de token.** A escala e as cores das séries moram em `escala.ts` e apontam para tokens de `src/app/globals.css` (`--escala-varejo-*`, `--cor-gas`, `--serie-*`). Nenhum hexadecimal aqui.
- **Ausência não é zero.** Valor `null` vira estado dito ("sem dado", "sem valor publicado", traço fino, hachura), nunca barra de tamanho zero nem a cor do centro.
- **Toda figura tem equivalente.** Dentro de `FiguraAnalitica`, a tabela equivalente é a do kit; cada componente traz descrição acessível (`sr-only`, `aria-label` ou `role="img"`). Os que são figura principal de um bloco levam `data-grafico` (o molde de painel procura esse atributo); as miniaturas não.
- **Movimento.** Só `transform` e `opacity`, abaixo de 300 ms, curva de saída forte; `:active` com escala sutil; realce de hover só em `@media (hover: hover)`; nada anima em ação de teclado; `prefers-reduced-motion` respeitado.

## O que existe

| Arquivo | Componente | Para quê | Servidor ou cliente |
|---|---|---|---|
| `escala.ts` | `passoDivergente`, `corDoPasso`, `tintaDoPasso`, `cortesDaEscala`, `limiteSimetrico`, `COR_DA_PARTE`, `COR_VOLUME`, `COR_RECEITA` | A escala divergente única (queda em sépia, alta no azul, zero neutro, sete passos) e as cores fixas das séries e das partes do cupom | módulo puro |
| `geometria.ts` | `linear`, `eixo`, `caminho`, `areaEntre`, `marcasDeTempo` | Escalas, marcas redondas, caminho com lacuna, área entre duas séries cortada nos cruzamentos | módulo puro |
| `Cupom.tsx` | `Cupom` | "O cupom de R$ 100": cupom desenhado, seletor de lojas e barras na mesma régua. Recebe `PerfilCem` com `contaDoCupom` | cliente (a primeira loja sai do servidor) |
| `Tesoura.tsx` | `Tesoura` | Duas séries com a área entre elas preenchida, leitura por cursor, toque e teclado. Formato `indice` (receita × volume) ou `variacao` (estado × Brasil) | cliente (lê-se sem JavaScript) |
| `MosaicoCalor.tsx` | `MosaicoCalor` | Mosaico de calor linhas × meses com a faixa de difusão (quantas subiram, quantas caíram) no mesmo eixo | cliente |
| `Colunas.tsx` | `Colunas` | Colunas mês a mês a partir do zero, para diferença em p.p. ou variação com sinal | servidor |
| `Halteres.tsx` | `Halteres` | Real × nominal por linha, com a referência como linha vertical e a distância até ela em p.p. | servidor |
| `MapaBlocos.tsx` | `MapaBlocos`, `LegendaDivergente`, `GRADE_UF` | Mapa de blocos das 27 UFs (um quadrado por estado, sigla e valor dentro) e a legenda da escala | servidor |
| `Prateleira.tsx` | `Prateleira` | Etiquetas de gôndola clicáveis: nome, uma linha, minigráfico e o número no lugar do preço | servidor |
| `Proporcoes.tsx` | `QuadroDeCem`, `BarraDePartes`, `BarraDeUmaParte` | Parte no todo em cem blocos; composição de um total numa barra de 100% com lista; recorte de um total | servidor |
| `BarrasRotuladas.tsx` | `BarrasRotuladas` | Barras horizontais com nome e valor, a partir do zero (aceita negativos), com links e "ver todas" | servidor |
| `LinhaContexto.tsx` | `LinhaContexto` | Gráfico pequeno de uma série, para pequenos múltiplos alinhados | servidor |
| `Miniaturas.tsx` | `MicroSerie`, `MicroProporcao`, `MicroBarra`, `MicroBarras`, `MicroCupons`, `TesouraMini`, `MapaBlocosMini` | Miniaturas para números de escala, cartões de destino, etiquetas e a versão aberta | servidor |
| `geometria.ts` (2ª metade) | `mosaico`, `logaritmica` | Mosaico de áreas proporcionais (treemap "squarified") e escala logarítmica | módulo puro |
| `escala.ts` (2ª metade) | `corDoSegmento`, `HACHURA`, `HACHURA_AUSENCIA`, `COR_SUBIU`, `COR_DESCEU`, `COR_PARADO` | Fundo de cada segmento (`--segmento-varejo-*`), as duas hachuras (estimativa ou prejuízo; ausência) e os tons de subida e descida | módulo puro |
| `BlocosDeTamanho.tsx` | `BlocosDeTamanho` | "O tamanho de cada grupo": mosaico por segmento, bloco com logo, venda e parte na amostra; estimativa com moldura hachurada; lista de barras no celular | servidor |
| `Inclinacao.tsx` | `Inclinacao`, `textoDoMovimento` | Gráfico de inclinação entre a posição do ano anterior e a do exercício, com logos nas pontas e destaque de quem mais se moveu; lista com barra divergente no celular | servidor |
| `DispersaoLojas.tsx` | `DispersaoLojas` | Vendas × lojas em escala logarítmica, com diagonais de mesma venda por loja e rótulo direto; lista ordenada no celular; grupo sem lojas listado à parte | servidor |
| `QuadrosDoRanking.tsx` | `ReguaPlataformas`, `ParesDeListas`, `LideresDeSegmento`, `ConceitoEmEsquema` | Régua 1P/3P das plataformas, o mesmo grupo em duas listas na mesma régua, o líder dentro do segmento e o esquema das quatro medidas que não se somam | servidor |
| `MapaPresenca.tsx` | `MapaPresenca` | Os 27 blocos de `GRADE_UF` cheios onde o grupo atua; "todos" e "não divulgado" são estados próprios | servidor |
| `ColunasPequenas.tsx` | `ColunasPequenas`, `LegendaDasColunas` | Colunas pequenas a partir do zero para pequenos múltiplos: lacuna desenhada, abaixo do zero hachurado, ponto vazado (publicado) e cheio (reapresentado), par na mesma escala | servidor |
| `CuponsLadoALado.tsx` | `CuponsLadoALado`, `LinhaALinha` | Um cupom por companhia com logo e a barra de R$ 100 na mesma régua; cada parcela companhia a companhia, com a distância anotada | servidor |
| `CascataCaixa.tsx` | `CascataCaixa`, `LegendaDaCascata`, `dominioDasCascatas` | Cascata horizontal do caixa por R$ 100 de receita, com o passo do convênio hachurado e a linha ausente como estado | servidor |
| `PontosConectados.tsx` | `PontosConectados`, `MarcaDaCompanhia` | Uma linha por medida, marcas de forma diferente por companhia ligadas por um traço, eixo comum por unidade e a persistência em quadrinhos por exercício | servidor |

## Como usar (exemplos)

```tsx
// escala divergente: o mesmo passo no mapa, no mosaico e na legenda
const limite = limiteSimetrico(valores);
const passo = passoDivergente(valor, limite); // null quando não há valor
<span style={passo ? { background: corDoPasso(passo), color: tintaDoPasso(passo) } : undefined} />
<LegendaDivergente limite={limite} />

// cupom de uma ou mais companhias (Comparador, Ficha)
<Cupom perfis={perfisDoModelo(e).map((p) => ({ ...p, conta: contaDoCupom(p) }))} />

// mapa de blocos com link por estado
<MapaBlocos titulo="…" blocos={ufs.map((l) => ({ uf: l.uf, nome: l.nome, valor: l.volume, href }))} limite={limite} selecionado={uf} />

// tesoura de duas séries quaisquer (a diferença lida é a − b)
<Tesoura titulo="…" meses={meses} a={{ rotulo, valores, cor: COR_VOLUME }} b={{ rotulo: "Brasil", valores, cor: COR_RECEITA }} formato="variacao" base={0} rotuloArea="acima do Brasil" rotuloAreaAbaixo="abaixo do Brasil" />
```

## Onde cada uma aparece hoje

- `/varejo` (entrada): `Cupom` no `ModeloDidatico`; `MicroSerie`, `MicroBarra` e `MicroProporcao` nos números de escala (`microfiguras` de `EntradaColecao`); `TesouraMini`, `MapaBlocosMini`, `MicroBarras` e `MicroCupons` nos cartões de destino (`miniaturas` de `destinosDaColecao`).
- `/varejo` sem sessão (versão aberta): `TesouraMini` de 24 meses, só com os valores do começo e do fim.
- `/varejo/brasil`: `Tesoura` (índice), `Colunas` (diferença), `MosaicoCalor` (atividades e difusão), `QuadroDeCem`, `BarraDePartes` e `BarraDeUmaParte` (mercado), `LinhaContexto` (renda, preços e juros).
- `/varejo/segmentos`: `Halteres` (atividades e, com `?uf=`, atividades do estado), `Prateleira`, a ficha do segmento (`../SegmentoCurado.tsx`, com `BarrasRotuladas`), `MapaBlocos` com `BarrasRotuladas`, `Tesoura` (estado × Brasil e o segmento aberto), `BarraDePartes` (formas de venda).
- `/varejo/grupos`: `BlocosDeTamanho` (figura `ranking`), `Inclinacao` (`movimento`), `DispersaoLojas` (`modelos`), `LideresDeSegmento`, `ReguaPlataformas` com `ConceitoEmEsquema`, `ParesDeListas`; a busca responde com `CadeiaDaMarca` (`../BuscaGrupos.tsx`).
- `/varejo/grupos/[slug]`: logo no título e selo de posição na abertura; microfiguras nos quatro números (`MicroBarra`, `MicroSerie`); `MapaPresenca`; `RankingContraCvm` em duas barras na mesma régua; `BarrasRotuladas` na decomposição do crescimento; `Cupom` (figura `cupom`, a companhia e os pares do segmento); `ColunasPequenas` nas demonstrações e nas séries operacionais com três ou mais pontos comparáveis; a faixa do tempo e o trilho de `LinhaDoTempo` (`../FichaGrupo.tsx`).
- `/varejo/comparador`: `CuponsLadoALado` e `LinhaALinha` (figura `ponte`), `CascataCaixa` (figura `caixa`), `PontosConectados`.

## Logos nas figuras

Toda figura que nomeia uma companhia usa `<LogoEmpresa ... decorativo semLogo="placa" />` (`../LogoEmpresa.tsx`): o arquivo oficial do manifesto, ou, sem ele, a placa do mesmo tamanho com o nome curto na serifa da plataforma (`data-logo-ausente`). O nome vem sempre escrito ao lado, em texto; o logo nunca é o único rótulo. Bandeiras e plataformas sem entrada no manifesto ficam com a placa tipográfica ou só com o texto.
