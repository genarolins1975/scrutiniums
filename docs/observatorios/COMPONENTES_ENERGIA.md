# Biblioteca de componentes do Setor Elétrico

Catálogo dos componentes de visualização, tabela, evidência e navegação do Observatório Brasileiro do Setor Elétrico (`/setor-eletrico/**`). Complementa o [design system](DESIGN_SYSTEM_OBSERVATORIOS.md) e as seções 7 e 8 da especificação (contrato de experiência e direção de design).

Os componentes ficam planos em `src/components/energia/` (o teste de tokens lê a pasta sem recursão). A lógica pura (escalas, classes, ordenação, CSV, projeção, quantis, datas) fica em `src/lib/energia/` e é testada em node, sem navegador.

## Regras comuns

Todas as peças abaixo seguem as mesmas regras. Quem cria um componente novo segue também.

**Ausência não é zero.** Três estados nunca se confundem: número (zero inclusive), ausência (`null` ou `undefined`, "sem dado") e "não se aplica" (`NAO_SE_APLICA`, de `@/lib/energia/escalas`). Ausência nunca é desenhada em zero: vira lacuna na linha, marca hachurada de tamanho fixo, célula hachurada ou o texto "sem dado". Zero é valor e recebe a cor da sua classe.

**Cores só por token.** Nenhum hexadecimal em componente: classes Tailwind ou `var(--cor-*)` e `var(--serie-*)`. Cor de série entra por prop como texto CSS (`"var(--serie-hidraulica)"`). Texto nunca usa `energia-soft`; sobre `energia-fundo`, só `carvao`, `carvao-muted`, `energia` e `energia-dark`. Cor nunca é o único portador: forma, hachura, traço e rótulo acompanham.

**Acessibilidade (WCAG 2.2 AA).**
- Alvos de 44 px.
- Foco visível na cor do acento, desenhado dentro do SVG quando o alvo é um `<g>`.
- Teclado completo: setas, Home e End, Enter ou Espaço para selecionar, Esc para fechar.
- Dica por foco, toque e ponteiro (nunca só hover). No toque, a dica fica aberta até um toque fora do gráfico.
- Região `aria-live` para o ponto ativo do ponteiro e para mudanças de seleção, ordem e filtro.
- Tabela equivalente em todo gráfico, com os mesmos números.
- Sem animação obrigatória (`motion-safe:` quando houver).

**SSR sem salto.** Os componentes "use client" renderizam HTML útil no servidor com largura padrão (760 px, 360 px por painel nos pequenos múltiplos) e altura fixa em pixels; a largura real é medida depois com `ResizeObserver`. `window` e `document` só aparecem em efeitos e manipuladores.

**Celular sem rolagem horizontal da página.** Rolagem horizontal, quando inevitável, fica dentro do componente (`.tabela-scroll`). Dicas flutuantes não usam `w-max`: a largura se ajusta ao espaço até a borda do gráfico (o teste `energia-comp-integracao` confere).

**Texto em pt-BR** com `src/lib/energia/formato.ts` (`num`, `pct`, `reais`, `sinal`, `dataBR`) ou com `formatarValor` e `formatarDiferenca` de `escalas.ts`, que arredondam antes do sinal (−0,04 com uma casa é "0,0", nunca "−0,0"). Sinal de menos tipográfico (U+2212). Sem travessão no texto visível.

### Fronteira entre servidor e cliente

Um módulo "use client" só exporta componentes, hooks e tipos (o teste `energia-comp-integracao` confere). Constantes e funções utilitárias vêm sempre das bibliotecas:

| Precisa de | Importe de |
| --- | --- |
| `NAO_SE_APLICA`, `quebrasFixas`, `quebrasQuantis`, `classificar`, `formatarValor` | `@/lib/energia/escalas` |
| `URL_GEO`, `agruparPorChave`, `CamadaGeo` | `@/lib/energia/geo` |
| `montaHistograma`, `percentilDe`, `resumo` | `@/lib/energia/distribuicao` |
| `campo`, `tiposUrl`, `buscaDeParametros` | `@/lib/energia/estadoUrl` |
| `LIMITE_COMPARACAO` | `@/lib/energia/tabela` |

Motivo: um valor importado de módulo cliente chega ao Server Component como referência de cliente. `URL_GEO.uf` lança erro no servidor, e um `NAO_SE_APLICA` usado numa classificação feita no servidor deixa de ser o texto que `classeDe` reconhece (a região vira "sem dado" em silêncio).

Props que são funções (`onSelecionar`, `onIntervalo`, `valores` e `renderizarItem` do Comparador, `onFiltro` e similares) não atravessam a fronteira: a página cria um pequeno componente cliente que guarda o estado e passa as funções. Dados, textos, `ReactNode` e objetos simples podem vir direto da página do servidor.

## Visão geral

| Componente | Forma (seção 8.2) | Lógica pura | Estado na URL |
| --- | --- | --- | --- |
| `GraficoLinhas` | tempo, com zoom, legenda interativa e cursor sincronizado | `series-temporais.ts`, `calendario.ts` | controlado (`intervalo`, `ocultas`) |
| `CursorSincronizado` | provedor do cursor comum entre séries | `series-temporais.ts` | `inicial` |
| `PequenosMultiplos` | tempo, um painel por entidade | `series-temporais.ts` | não |
| `GraficoBarras` | comparação e composição (barras de zero, agrupadas ou empilhadas) | `escalas.ts` | controlado (`selecionado`) |
| `GraficoPontos` | realizado × referência (pontos pareados) | `escalas.ts` | controlado (`ordem`, `selecionado`) |
| `GraficoDispersao` | relação entre duas medidas, sem causalidade | `dispersao.ts`, `distribuicao.ts` | não |
| `Histograma` | distribuição com quantis, valor atual e massa pontual | `distribuicao.ts` | não |
| `MapaCalor` | perfil hora × dia, mês × ano | `mapa-calor.ts` | não |
| `MapaCoropletico` | geografia sobre a malha oficial do IBGE | `geo.ts`, `mapa-coropletico.ts`, `escalas.ts` | controlado (`selecionado`) |
| `TabelaInterativa` | explorador de dados com busca, filtros, ordem e exportação | `tabela.ts`, `estadoUrl.ts` | própria (`chaveUrl`) |
| `Comparador` | até quatro entidades na mesma escala | `tabela.ts`, `escalas.ts`, `estadoUrl.ts` | própria (`chaveUrl`) |
| `Cronograma` | previsto e realizado por marco, com atraso contra data-base | `cronograma.ts`, `calendario.ts` | controlado (`estados`) |
| `LinhaDoTempo` | atos e eventos datados (publicação e vigência) | `linha-do-tempo.ts`, `calendario.ts` | controlado (`filtro`) |
| `Numero` | KPI com selo, período, variação e prova | `evidencia.ts` | não |
| `ComproveNumero` | ficha "Comprove este número" (seção 11.5) | `evidencia.ts` | não |
| `CabecalhoEnergia` | navegação em seis grupos (seção 5.1) | `navegacao.ts` | não |
| `useEstadoUrl` | hook de estado sincronizado com a URL | `estadoUrl.ts` | é o mecanismo |

## Séries temporais

### GraficoLinhas

Gráfico de linhas SVG: cruz e dica no ponteiro, setas do teclado, rótulo direto no fim de cada linha, legenda sempre presente e tabela equivalente montada ao abrir. Ausência é lacuna na linha. Um único eixo Y; os ticks usam as casas do passo (2,5 e 7,5, não 3 e 8). Sem as props opcionais o HTML é o mesmo de antes.

Props:
- Obrigatórias: `titulo`, `dados` (linhas com `chaveX` e uma coluna por série), `chaveX`, `series` (`{ id, rotulo, cor, sigla?, tracejada?, espessura? }[]`), `unidade`.
- Leitura: `casas` (1), `formatoX` (`"data" | "hora" | "mes" | "md" | "texto"`), `zeroNoEixo`, `banda` (`{ inferior, superior, rotulo, cor? }`), `marcos` (`{ x, rotulo }[]`), `altura` (300), `rotulosDiretos` (true), `tabelaAbertaInicial`.
- Zoom: `zoom`; `intervaloInicial`, ou o par controlado `intervalo` e `onIntervalo`. O intervalo é `{ inicio, fim }` em valores de `chaveX`; `null` é a série completa.
- Legenda interativa: `legendaInterativa`; `ocultasIniciais`, ou o par controlado `ocultas` e `onOcultas`; `escalaAoOcultar` (`"ajustar"` ou `"manter"`).
- Cursor: `sincronizarCursor` (true) e `grupoCursor` (padrão: a `chaveX`).

```tsx
<GraficoLinhas titulo="Quanta energia o SIN consumiu por dia?" dados={carga.serie} chaveX="d"
  series={[{ id: "sin", rotulo: "SIN", cor: "var(--serie-1)" }]} unidade="MWmed" casas={0}
  zoom intervalo={intervalo} onIntervalo={setIntervalo} legendaInterativa />
```

### CursorSincronizado

Provedor que alinha a cruz de vários `GraficoLinhas` e `PequenosMultiplos` pelo valor de X (a data, não o índice). Gráfico sem aquele ponto não mostra a cruz. Só o gráfico de origem abre a dica e fala no `aria-live`.

Props: `children`, `inicial?: { grupo, valor }`. Hook: `useCursorSincronizado(grupo)` devolve `{ cursor, publicar, limpar }` ou `null` sem provedor.

```tsx
<CursorSincronizado>
  <GraficoLinhas titulo="Carga" dados={c.serie} chaveX="d" series={SERIES} unidade="MWmed" />
  <GraficoLinhas titulo="Armazenamento" dados={h.serie} chaveX="d" series={SERIES_EAR} unidade="%" />
</CursorSincronizado>
```

### PequenosMultiplos

Grade de painéis pequenos sobre o mesmo eixo de tempo, alternativa a empilhar muitas linhas ou usar dois eixos. Escala compartilhada por padrão (aviso visível quando é livre). Um só ponto de Tab: esquerda e direita percorrem as datas, acima e abaixo trocam de painel. Painel sem valor mostra hachura e "sem dado no período".

Props:
- Obrigatórias: `titulo`, `dados`, `chaveX`, `paineis` (`{ id, titulo, series?, nota? }[]`), `unidade`.
- Opcionais: `casas`, `formatoX`, `escala` (`"compartilhada" | "livre"`), `zeroNoEixo`, `alturaPainel` (140), `colunas` (2, 3 ou 4), `cor`, `nivelTitulo` (3 ou 4), `sincronizarCursor`, `grupoCursor`, `tabelaAbertaInicial`.

```tsx
<PequenosMultiplos titulo="Carga por subsistema" dados={c.serie} chaveX="d" unidade="MWmed" casas={0}
  paineis={[{ id: "SE", titulo: "Sudeste/Centro-Oeste" }, { id: "S", titulo: "Sul" },
            { id: "NE", titulo: "Nordeste" }, { id: "N", titulo: "Norte" }]} colunas={4} />
```

## Comparação, referência e composição

### GraficoBarras

Barras verticais ou horizontais, simples, agrupadas ou empilhadas. Toda barra parte de zero; negativos vão para o outro lado da base. Empilhar só composição aditiva. Ausência é caixa hachurada curta na base; zero é traço de 2 px; pilha com parte ausente leva hachura na ponta e não mostra total ("incompleto"). No modo horizontal cada categoria tem 44 px ou mais e a área rola na vertical com o eixo fixo acima.

Props:
- Obrigatórias: `titulo`, `dados` (linhas), `chaveCategoria` (id estável), `series` (`{ id, rotulo, cor }[]`), `unidade`.
- Opcionais: `chaveRotulo`, `casas` (1), `orientacao` (`"vertical" | "horizontal"`), `empilhado`, `rotulosValor`, `referencias` (`{ valor, rotulo }[]`), `selecionado`, `onSelecionar`, `altura` (300, vertical), `alturaCategoria` (horizontal), `alturaMaxima` (480).

```tsx
<GraficoBarras titulo="Perdas por distribuidora" dados={linhas} chaveCategoria="sigla" chaveRotulo="nome"
  series={[{ id: "tecnica", rotulo: "Técnica", cor: "var(--serie-hidraulica)" },
           { id: "nao_tecnica", rotulo: "Não técnica", cor: "var(--serie-termica)" }]}
  unidade="GWh" orientacao="horizontal" empilhado referencias={[{ valor: 12, rotulo: "Média" }]}
  selecionado={sel} onSelecionar={setSel} />
```

### GraficoPontos

Pontos pareados por entidade: realizado (círculo cheio) e referência (losango vazado, maior, visível mesmo quando coincide). A diferença fica escrita em coluna própria, com sinal e sentido ("acima", "abaixo", "igual") decididos na precisão exibida. Sem cor de "bom" ou "ruim" (seção 10.4). Ordenação por rádios nativos mais botão de direção; nulos sempre no fim; a tabela segue a mesma ordem e marca `aria-sort`.

Props:
- Obrigatórias: `titulo`, `itens` (`{ id, rotulo, valor, referencia, detalhe? }[]`), `unidade`, `rotuloValor`, `rotuloReferencia`.
- Opcionais: `casas`, `unidadeDiferenca` (padrão "p.p." com `%`), `corValor`, `corReferencia`, `zeroNoEixo`, `ordemInicial`, ou o par controlado `ordem` e `onOrdenar`, `selecionado`, `onSelecionar`, `alturaLinha` (44), `alturaMaxima` (528).

```tsx
<GraficoPontos titulo="Perda realizada e referência regulatória" unidade="%"
  itens={dists.map((d) => ({ id: d.sigla, rotulo: d.nome, valor: d.perda, referencia: d.ref }))}
  rotuloValor="Perda realizada" rotuloReferencia="Referência regulatória"
  ordemInicial={{ por: "diferenca", direcao: "desc" }} selecionado={sel} onSelecionar={setSel} />
```

## Relação e distribuição

### GraficoDispersao

Dispersão entre duas medidas do mesmo conjunto de entidades. O rodapé com amostra (n), período e aviso de que associação não é causalidade é obrigatório no tipo. Sem reta por padrão; a reta publicada pelo pipeline é desenhada só no intervalo de X observado. Ponto sem X ou sem Y não é desenhado e entra no rodapé como "sem dado" (na tabela, ao fim). Até quatro destaques com rótulo direto. Ponteiro e toque escolhem o ponto mais próximo num raio de 22 px.

Props:
- Obrigatórias: `titulo`, `pontos` (`{ id, rotulo, x, y }[]`), `eixoX` e `eixoY` (`{ rotulo, unidade, casas?, incluirZero? }`), `rodape` (`{ periodo, avisoCausalidade, nota? }`).
- Opcionais: `entidade` (`{ singular, plural }`), `destacados` (até 4 ids), `reta` (`{ inclinacao, intercepto, rotulo, detalhe? }`), `altura` (340), `corPontos`, `corDestaque`.

```tsx
<GraficoDispersao titulo="Perdas e tarifa por distribuidora" pontos={pts}
  eixoX={{ rotulo: "Perdas não técnicas", unidade: "% do mercado BT" }}
  eixoY={{ rotulo: "Tarifa média", unidade: "R$/MWh", casas: 0 }}
  rodape={{ periodo: "2024", avisoCausalidade: "Associação não é causalidade." }}
  entidade={{ singular: "distribuidora", plural: "distribuidoras" }} destacados={["light"]} />
```

### Histograma

Histograma com marcadores de quantis (quantis iguais viram uma linha com rótulo conjunto), marcador do valor atual e barra própria hachurada para massa num ponto (horas no piso do PLD), cortada no topo com marca de corte quando achataria as demais. Classes de larguras diferentes usam densidade. As classes chegam prontas: calcule no servidor com `montaHistograma` e a série bruta não vai para o navegador.

Props:
- Obrigatórias: `titulo`, `dados` (`DistribuicaoHistograma`), `rotuloX`, `unidade`, `periodo`.
- Opcionais: `casas`, `contagem` (`{ singular, plural }`), `marcadores` (quantis), `valorAtual` (`{ valor, rotulo, percentil? }`), `altura` (280), `cor`, `corMassa`, `nota`.

```tsx
const dados = montaHistograma(horas, { largura: 25,
  massas: [{ valor: piso, rotulo: "piso regulatório", explicacao: "O PLD não fica abaixo do piso da ANEEL." }] });
<Histograma titulo="PLD horário, SE/CO" dados={dados} rotuloX="PLD horário" unidade="R$/MWh" casas={2}
  contagem={{ singular: "hora", plural: "horas" }} periodo="out/2025 a set/2026"
  valorAtual={{ valor: hoje, rotulo: "Hoje", percentil: percentilDe(hoje, horas) }} />
```

### MapaCalor

Grade hora × dia ou mês × ano como tabela com papel de grid: um ponto de Tab, setas nas duas direções, Home e End na linha, Ctrl+Home e Ctrl+End nos cantos, Page Up e Page Down por semana. O foco vai para a célula, que traz o valor em texto. Escala em classes explícitas (sequencial ou divergente), com rótulos "menos de X", "X a menos de Y" e "Y ou mais", a mesma redação de `escalas.ts`. Sem dado é hachura; "não se aplica" é célula vazia com borda tracejada; zero recebe a cor da sua classe. Escala com cor fora dos tokens, número errado de cores, centro fora do lugar ou matriz torta lança erro (falha o build em vez de publicar mapa errado).

Props:
- Obrigatórias: `titulo`, `linhas` e `colunas` (`{ id, rotulo, curto? }[]`), `nomeLinhas`, `nomeColunas`, `valores` (matriz; `null` para sem dado, `NAO_SE_APLICA` para combinação inexistente), `escala` (`{ tipo, limites, cores, rotulos?, centro? }`), `unidade`.
- Opcionais: `casas`, `passoRotuloColunas`, `periodo`, `nota`.

```tsx
<MapaCalor titulo="PLD por hora e dia" linhas={dias} colunas={horas} nomeLinhas="Dia" nomeColunas="Hora"
  valores={matriz} unidade="R$/MWh" casas={0} periodo="set/2026"
  escala={{ tipo: "sequencial", limites: [100, 200, 300],
    cores: ["var(--cor-energia-fundo)", "var(--cor-energia-soft)", "var(--cor-energia)", "var(--cor-energia-dark)"] }} />
```

## Geografia

### MapaCoropletico

Mapa coroplético sobre a malha oficial do IBGE (`public/energia/geo/uf.json` e `municipios.json`, geradas por `python -m pipeline.energia.geo` em Albers cônica equivalente, simplificação por arco compartilhado, sem perda de polígono). Legenda com unidade, método das classes e os três estados: sem dado é hachura, "não se aplica" é cinza liso com rótulo, zero leva a cor da classe (a legenda diz em qual). Clique ou toque seleciona; o teclado usa a busca (combobox que ignora acento e aceita sigla de UF e código IBGE), que acende a região e a dica. Zoom por botões, arrasto quando aproximado, "Restaurar". Tabela equivalente ordenável, com nulos no fim.

Props:
- Geometria: `geometria` (tem precedência) ou `fonteGeometria` (`URL_GEO.uf` ou `URL_GEO.municipios`, de `@/lib/energia/geo`). Para a camada municipal (1,3 MB), prefira `fonteGeometria`: por prop, a malha iria inteira no payload da página.
- Dados: `valores` (`Record<id, número | null | NAO_SE_APLICA>`), `cores` (só `var(--...)`), `classificacao` (de `escalas.ts`; padrão: quantis, uma classe por cor), `unidade`, `casas`, `rotuloRegiao`.
- Seleção: `selecionado` e `onSelecionar` (controlada) ou interna.
- Aparência: `corNaoSeAplica` (padrão `var(--cor-linha)`), `rotulos`, `contornos`, `altura` (520), `alturaCelular` (380), `escalaMaxima`, `periodo`, `nota`.

```tsx
import { NAO_SE_APLICA, quebrasFixas } from "@/lib/energia/escalas";
import { URL_GEO } from "@/lib/energia/geo";

<MapaCoropletico titulo="Perdas totais por UF" fonteGeometria={URL_GEO.uf} rotulos
  valores={{ "35": 12.3, "53": NAO_SE_APLICA, "12": null }} unidade="%"
  cores={["var(--cor-energia-fundo)", "var(--cor-energia-soft)", "var(--cor-energia)", "var(--cor-energia-dark)"]}
  classificacao={quebrasFixas([5, 10, 15], valoresDasUfs, { casas: 1 })} selecionado={sel} onSelecionar={setSel} />
```

Área de concessão por municípios: `agruparPorChave(camada.features, (f) => areaDe[f.id])` (de `@/lib/energia/geo`) monta grupos com o conjunto dos caminhos dos membros; a união sem divisas internas só existe no pipeline (`agrupa_por_chave`). Mapa por concessão não é mapa municipal por replicação de taxas (seção 8.3).

## Tabelas e comparação

### TabelaInterativa

Explorador de dados: colunas tipadas (texto, número com casas e unidade, percentual, data), ordenação com `aria-sort` e ausência sempre no fim, busca sem acento e sem caixa, filtros por coluna categórica com contagem por faceta e "sem dado" como opção própria, resumo visível dos filtros com remoção de cada um, paginação de 25 a 200 linhas e seleção sincronizável (seleção vinda de fora leva à página da linha). Exportação CSV e XLSX do recorte exibido, na ordem exibida, a partir da mesma matriz: CSV com `;`, ponto decimal, célula vazia para ausência, unidade no cabeçalho, BOM UTF-8; XLSX com aba "Dados" e aba "Sobre" (fonte, versão, recorte, dicionário). O arquivo guarda o valor completo, sem o arredondamento da tela.

Props:
- Obrigatórias: `titulo`, `colunas` (`{ id, rotulo, tipo, unidade?, casas?, categorica?, buscavel?, ordenavel? }[]`), `linhas`, `chaveLinha`, `fonte`, `versao`, `nomeArquivo`.
- Opcionais: `colunaRotulo`, `selecionado`, `onSelecionar`, `chaveUrl`, `buscaInicial`, `ordemInicial`, `tamanhoPagina` (25, 50, 100 ou 200), `dicaBusca`, `semLinhas`, `nota`.

Com `chaveUrl="perdas"`, os parâmetros ficam `perdas.q`, `perdas.ord`, `perdas.pag` e `perdas.f.<coluna>`. Busca e página substituem a entrada do histórico; ordem e filtros criam entrada nova (o voltar desfaz).

```tsx
<TabelaInterativa titulo="Perdas por distribuidora" colunas={COLS} linhas={linhas} chaveLinha="id"
  fonte="ANEEL, SAMP" versao={gold.periodo_referencia.fim} nomeArquivo="perdas-distribuidoras"
  chaveUrl="perdas" ordemInicial={{ coluna: "perda", direcao: "desc" }}
  selecionado={sel} onSelecionar={setSel} dicaBusca="Nome, código ou UF" />
```

### Comparador

Escolha de até quatro entidades (`LIMITE_COMPARACAO`) num combobox acessível de seleção múltipla, com fichas removíveis, limite visível e anunciado, e pequenos múltiplos na mesma escala: o domínio comum é calculado sobre os valores de todas as selecionadas e só delas, e é dito em texto.

Props:
- Obrigatórias: `rotulo`, `entidades` (`{ id, rotulo, detalhe?, sinonimos? }[]`).
- Opcionais: `max` (1 a 4), `selecionadas` (controlado, vence a URL), `padrao`, `onMudar(ids)` (também no voltar e avançar), `chaveUrl`, `buscaInicial`, `valores(id)`, `zeroNaEscala`, `unidade`, `dicaBusca`, `vazio`, e `children(ctx)` ou `renderizarItem(e, ctx)`. O `ctx` é `{ selecionadas, dominio, escala(faixa), max }`.

`valores`, `children` e `renderizarItem` são funções: use o Comparador dentro de um componente cliente da página.

```tsx
<Comparador rotulo="Distribuidoras para comparar" entidades={dists} chaveUrl="ent" unidade="GWh"
  valores={(id) => serie[id].map((p) => p.v)}
  renderizarItem={(e, ctx) => <MiniLinha dados={serie[e.id]} escala={ctx.escala([120, 0])} titulo={e.rotulo} />} />
```

## Cronogramas e eventos

### Cronograma

Uma linha por marco de cada item (usina, linha de transmissão), com previsto e realizado separados: previsão é círculo vazado (uma marca por previsão informada; a mais recente em traço mais grosso) e realizado é círculo cheio. Atraso só com `dataBase` declarada: a régua é a previsão vigente naquela data (losango). Marco sem previsão vigente na data-base diz "sem base", nunca atraso zero; deslocamento de previsão ainda não realizada leva "(prev.)". Data só com mês dá diferença em meses. O eixo de tempo é o de todos os itens, e filtrar não muda a escala.

Props:
- Obrigatórias: `titulo`, `itens` (`{ id, rotulo, estado, detalhe?, marcos }[]`; marco `{ id, rotulo, previsoes: [{ data, informadaEm, snapshot? }], realizado?, fonteRealizado? }`).
- Opcionais: `dataBase` (`{ data, rotulo }`), `rotuloFiltro` ("Estado"), `estadosIniciais`, ou o par controlado `estados` e `onEstados` (`null` é "todos"), `alturaMaxima` (560).

```tsx
<Cronograma titulo="Cronograma das usinas em construção" itens={usinas}
  dataBase={{ data: "2022-06-30", rotulo: "cronograma da outorga" }}
  rotuloFiltro="Estágio" estados={estagios} onEstados={setEstagios} />
```

### LinhaDoTempo

Eventos datados como lista ordenada semântica (`<ol>`, `<article>`, `<time>`), não como desenho. Publicação e vigência são campos distintos; a defasagem é escrita ("vigência 30 dias após a publicação", "vigência retroativa"). Filtro por categoria e por período, na data que a pessoa escolhe; eventos sem essa data ficam fora do recorte e a contagem diz quantos. Só endereço http(s) vira link.

Props:
- Obrigatórias: `titulo`, `eventos` (`{ id, titulo, categoria, publicacao, vigencia, fimVigencia?, resumo?, dispositivo?, orgao?, fonte }[]`), `categorias` (`{ id, rotulo }[]`).
- Opcionais: o par controlado `filtro` e `onFiltro` (`{ categorias, inicio, fim, base }`), ou `filtroInicial`; `ordem` (`"recentes" | "cronologica"`), `nivelTitulo`.

```tsx
<LinhaDoTempo titulo="Atos que mudaram o PLD" eventos={atos} ordem="cronologica"
  categorias={[{ id: "pld", rotulo: "PLD" }, { id: "tarifa", rotulo: "Tarifa" }]}
  filtro={filtro} onFiltro={setFiltro} />
```

## Evidência

### Numero

KPI sem estado (funciona em Server Component): rótulo, valor em pt-BR, unidade sem repetir o formato ("R$/MWh" com `formato="reais"` vira "/MWh"), período, selo de natureza, variação com glifo e palavra decidida sobre o valor arredondado, e o "Comprove este número" acoplado. Ausência é "sem dado" com hachura e o motivo. No máximo quatro por contexto (seção 7.1).

Props: `rotulo`, `natureza` (obrigatórias); `valor`, `formato` (`"num" | "reais" | "pct"`), `casas`, `unidade`, `periodo` (`Periodo` ou texto), `variacao` (`{ valor, casas?, sufixo?, referencia }`), `evidencia`, `motivoAusencia`, `nota`, `cor` (faixa superior, `var(--serie-*)`), `tamanho` (`"grande" | "medio"`), `endereco`. Sem `valor`, `unidade` e `periodo`, usa os da evidência.

```tsx
<Numero rotulo="Tarifa residencial mediana" natureza="CALCULADO" formato="reais" casas={2} evidencia={ev}
  variacao={{ valor: -3.25, sufixo: "%", referencia: "em relação ao mês anterior" }} cor="var(--serie-1)" />
```

### ComproveNumero

Link discreto (ou o próprio número, com `variante="valor"`) que abre a ficha de prova de UM número em dez seções: valor exibido e valor antes do arredondamento; recorte; fonte, arquivo e sha256 (e extração de PDF); chaves de origem ou consulta e manifesto; fórmula com numerador, denominador, pesos e exclusões; cobertura e ausências; versão e revisões; testes e reconciliação (glifo e palavra); download e passos de reprodução copiáveis; citação ABNT com a data de acesso do leitor. `<dialog>` nativo com foco preso, Esc fecha, foco volta ao botão; tela cheia no celular. Evidência que não passa em `problemasEvidencia` abre com aviso "Evidência incompleta". O conteúdo só é montado na primeira abertura.

Props: `evidencia` (`Evidencia`, gerada por `pipeline/energia/evidencia.py`), `variante` (`"link" | "valor"`), `rotulo`, `endereco`.

```tsx
<ComproveNumero evidencia={gold.evidencias.dec_brasil} />
<td><ComproveNumero variante="valor" evidencia={linha.evidencia} /></td>
```

`SobreEsteDado` descreve a série (fonte, frequência, cobertura, transformações); `ComproveNumero` prova um número. Um KPI que vem de uma série tem os dois.

## Navegação

### CabecalhoEnergia

Cabeçalho do observatório com a navegação em seis grupos (seção 5.1), toda renderizada no servidor e funcional sem JavaScript: em 1280 px ou mais, uma linha de grupos que abrem painéis com destino e pergunta; abaixo disso, um botão "Menu" com todos os destinos por seção; sempre, a faixa do grupo ativo (`id="modulos-energia"`, trazida à vista por `AtivoVisivel`). Destino sem página (`publicado: false`) nunca vira link: aparece como "Em preparação, ainda sem página". O destino atual leva `aria-current="page"`.

Props: `atual` (slug do destino em `DESTINOS_NAVEGACAO`).

```tsx
<CabecalhoEnergia atual="geracao" />
```

Ao publicar uma página de conta de luz, perdas, qualidade, inclusão energética ou transição, troque `publicado` para `true` em `src/lib/energia/navegacao.ts`: o teste `energia-comp-navegacao` falha nos dois sentidos (link sem página e página fora do menu).

## Estado na URL

`useEstadoUrl(esquema, { sincronizar?, buscaInicial?, atraso? })` devolve `[valores, definir]`. Seleção, filtro e ordem usam `pushState` (o voltar desfaz); digitação e página usam `replaceState` com espera de 300 ms. Voltar e avançar relêem a URL. Parâmetros alheios (`?modo=` do `ModoProfundidade`, `utm_*`) e o `#hash` ficam intactos. Valor inválido no link volta ao padrão; o padrão não é escrito na URL. O esquema precisa ser estável (constante de módulo).

Componentes controlados (`GraficoLinhas`, `GraficoPontos`, `MapaCoropletico`, `Cronograma`, `LinhaDoTempo`) guardam o estado na URL pela página, num componente cliente:

```tsx
"use client";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { URL_GEO } from "@/lib/energia/geo";

const ESQUEMA = {
  de: campo(tiposUrl.data(), "", { param: "de" }),
  ate: campo(tiposUrl.data(), "", { param: "ate" }),
  uf: campo(tiposUrl.texto({ max: 2 }), "", { param: "uf" }),
};

export function PainelPerdas(p: { serie: Linha[]; valores: Record<string, number | null>; linhas: LinhaTabela[] }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const selecionar = (id: string | null) => definir({ uf: id ?? "" });
  return (
    <>
      <GraficoLinhas titulo="Perdas ao longo do tempo" dados={p.serie} chaveX="d" series={SERIES} unidade="%"
        zoom intervalo={intervalo} onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })} />
      <MapaCoropletico titulo="Perdas por UF" fonteGeometria={URL_GEO.uf} valores={p.valores}
        cores={CORES} unidade="%" selecionado={v.uf || null} onSelecionar={selecionar} />
      <TabelaInterativa titulo="Perdas por UF" colunas={COLS} linhas={p.linhas} chaveLinha="uf" fonte="ANEEL"
        versao="2025" nomeArquivo="perdas-uf" chaveUrl="tab" selecionado={v.uf || null} onSelecionar={selecionar} />
    </>
  );
}
```

`buscaInicial` (com `buscaDeParametros(searchParams)`) faz o HTML do servidor sair já com o recorte do link, mas torna a página dinâmica; em página estática, deixe sem ele: a URL é lida antes da primeira pintura.

## Variáveis CSS sugeridas para `globals.css`

Nenhum componente depende delas hoje (todos funcionam com as variáveis que já existem). Elas dariam nome próprio a papéis que hoje reaproveitam outras cores. Ao adicioná-las, defina em `:root` de `src/app/globals.css`, confira as rampas com o verificador de daltonismo e ajuste os exemplos acima.

| Variável | Valor sugerido | Papel | Hoje usa |
| --- | --- | --- | --- |
| `--escala-seq-1` | `#D3E4E6` | sequencial, classe mais clara | `var(--cor-energia-fundo)` |
| `--escala-seq-2` | `#9CC3C9` | sequencial | (sem equivalente) |
| `--escala-seq-3` | `#5E98A3` | sequencial (igual a `energia-soft`) | `var(--cor-energia-soft)` |
| `--escala-seq-4` | `#2B6F7C` | sequencial | `var(--cor-energia)` |
| `--escala-seq-5` | `#0A4A56` | sequencial, mais escura (igual a `energia-dark`) | `var(--cor-energia-dark)` |
| `--escala-div-neg-2` | `#8C3B2E` | divergente, extremo negativo (igual a `erro`) | (sem equivalente) |
| `--escala-div-neg-1` | `#D08A6C` | divergente | (sem equivalente) |
| `--escala-div-centro` | `#E4E1DA` | divergente, classe neutra | (sem equivalente) |
| `--escala-div-pos-1` | `#7FB0B8` | divergente | (sem equivalente) |
| `--escala-div-pos-2` | `#0E6170` | divergente, extremo positivo (igual a `energia`) | (sem equivalente) |
| `--mapa-nao-se-aplica` | `#D8D2C6` (igual a `linha`) | "não se aplica" no mapa coroplético | `var(--cor-linha)` |
| `--cor-selecao` | mistura de 12% de `energia` | área do arrasto de zoom no `GraficoLinhas` | `color-mix(in srgb, var(--cor-energia) 12%, transparent)` |

Enquanto a escala divergente não tiver variáveis, o `MapaCalor` divergente aceita `color-mix(...)` sobre variáveis existentes (a validação aceita `var(--...)` e `color-mix` de `var(--...)`).

## Limitações conhecidas

- **Modo escuro:** não revisado em nenhum componente (a seção 8.1 só conta modo escuro como entregue se revisado).
- **Barras verticais com muitas categorias:** em tela estreita a faixa pode ficar com menos de 44 px de largura; para muitas categorias, use a orientação horizontal.
- **Largura de texto estimada:** os rótulos cortados com "…" usam uma estimativa, não uma medição; o nome completo está na dica, no `aria-label` e na tabela.
- **MapaCalor:** feito para cerca de 1.500 células; acima disso, agregue antes. No mouse, a célula tem 28 px (acima do mínimo AA de 24 px); em tela de toque, 44 px.
- **MapaCoropletico:**
  - sem pan pelo teclado (a busca centra a região escolhida);
  - com zoom, o toque arrasta o mapa em vez de rolar a página ("Restaurar" devolve a rolagem);
  - no agrupamento feito no cliente, as divisas internas continuam visíveis.
- **Classes arredondadas:** os cortes de quantis e intervalos iguais são arredondados às casas exibidas, mas o valor é classificado sem arredondar. Um valor que aparece igual ao corte (12,26 exibido como "12,3" com corte 12,3) cai na classe de baixo.
- **Tabelas no celular:** o design system pede lista de definição. As tabelas equivalentes e a `TabelaInterativa` rolam na horizontal dentro do componente (a página não transborda), com a primeira coluna fixa na `TabelaInterativa`.
- **TabelaInterativa:** o tamanho da página (25 a 200) não vai para a URL.
- **Comparador:** as props em função exigem um componente cliente na página.
- **Hook de URL:** a fiação de `useEstadoUrl` (popstate, espera, eventos entre instâncias) foi conferida em navegador fora do App Router; o vitest roda em node, sem DOM.
- **PequenosMultiplos:** não desenha marcos verticais nem banda.
- **Cronograma:** não marca "vencido sem registro", porque isso exigiria a data de hoje no HTML estático.


> Atualização do integrador (30/09/2026): as variáveis sugeridas acima (`--escala-seq-1..5`, `--escala-div-*`, `--mapa-nao-se-aplica`, `--cor-selecao`) e as cores de comparação `--serie-comp-1..4` foram acrescentadas a `src/app/globals.css`; use-as diretamente.
