# Gramática visual do Observatório do Setor Elétrico

Este documento fixa como o Observatório Brasileiro do Setor Elétrico escolhe, desenha e explica cada visual. Ele complementa o [design system](./DESIGN_SYSTEM_OBSERVATORIOS.md) (tokens, selos, painel de seis perguntas) e o [modelo de auditabilidade](./MODELO_AUDITABILIDADE.md). O teste `src/tests/energia-gramatica-visual.test.ts` confere as regras verificáveis por código.

## 1. Princípios

1. **Todo visual faz um trabalho nomeável.** Ele explica um conceito, localiza no espaço, compara, decompõe, mostra um fluxo, uma evolução, uma distribuição, um mecanismo ou uma incerteza, ou permite explorar. Um visual que não faz nenhum desses trabalhos sai da página.
2. **Uma página, um visual principal.** A página abre com a pergunta no título, uma resposta curta em prosa com selo de natureza e, em seguida, o visual principal. O restante vem em blocos na ordem: por que, decomposição, histórico, comparação, exploração, metodologia.
3. **Três profundidades sobre a mesma página.** Entender (visual principal e leitura), Analisar (decomposição, comparação, séries) e Auditar (proveniência, capturas, fórmulas). O modo fica na URL (`?modo=`), nunca esconde a fonte.
4. **O dado manda no visual, nunca o contrário.** Nenhum número é criado, suavizado ou interpolado para um gráfico funcionar. Ausência aparece como lacuna, hachura ou texto "sem dado", nunca como zero.
5. **Aproximação declarada.** Mapa esquemático diz que é esquemático. Ilustração de incerteza diz que não usa dados do PLD. Leitura usual do setor sem conferência documental leva esse rótulo.
6. **Setas não são causas.** Diagramas de formação e infográficos indicam ordem de leitura ou entrada de informação. O texto ao lado nega a leitura causal quando o desenho poderia sugerir uma.
7. **Animação só para fluxo, mudança ou tempo.** Nada se move para decorar. Toda animação para com `prefers-reduced-motion` e tem controle de pausa quando dura mais de um ciclo.
8. **Estado explorável na URL.** Camada, submercado, dia, janela, mês, horizonte, domínio, etapa, bloco e visão ficam em parâmetros de consulta gravados com `replaceState`, para que um link leve exatamente ao que se viu.
9. **Sempre há um caminho sem o visual.** Lista de regiões, tabela de dados, texto alternativo e navegação por teclado equivalem ao mapa, ao Sankey e ao infográfico.

## 2. Paleta semântica

Tokens em `tailwind.config.ts` e variáveis em `globals.css`. Nenhum hexadecimal solto em página ou componente do domínio.

| Série | Variável | Uso |
| --- | --- | --- |
| Hidráulica e água | `--serie-hidraulica` (azul) | EAR, ENA, geração hidráulica, tom `agua` do mapa |
| Solar | `--serie-solar` (âmbar) | geração solar, degrau solar |
| Eólica | `--serie-eolica` (verde teal) | geração eólica, tom `geracao` do mapa |
| Térmica | `--serie-termica` (terracota) | despacho térmico, participação térmica |
| Nuclear | `--serie-nuclear` (violeta reservado) | reservado para a desagregação futura da térmica |
| Biomassa | `--serie-biomassa` (verde) | reservado para a desagregação futura da térmica |
| Carga e rede | `--cor-energia` (teal do domínio) | carga, consumo, fluxos, fronteiras, tons `carga` e `rede` do mapa |
| PLD e preço | `--serie-pld` (vinho) e token `preco` | PLD, amplitude, tom `preco` do mapa, sparkline de preço |
| Referência | `--serie-referencia` | mediana, MLT, valor do ano anterior |
| Terreno do mapa | `--cor-mapa-terra`, `--cor-mapa-borda` | fundo e divisas do mapa esquemático |

Submercados mantêm a paleta já validada por daltonismo (SE/CO, S, NE, N). A cor nunca é o único portador: toda série tem rótulo direto no fim da linha e legenda em texto, e o selo de natureza combina forma, glifo e rótulo.

## 3. Mapa base do Brasil

`MapaBrasil` desenha um contorno esquemático do país com os quatro submercados (`src/lib/energia/geo.ts`: projeção equirretangular, 15 px por grau, caixa de 600 por 600). A divisão por estado segue a leitura usual do setor e a nota padrão declara que não foi conferida em documento do ONS ou da CCEE. Nenhum polígono de usina, município ou linha de transmissão foi integrado; enquanto isso, o mapa só carrega o que existe na gold: um valor por submercado e os fluxos entre as quatro fronteiras monitoradas pelo ONS.

Tons: `preco`, `agua`, `geracao`, `carga`, `rede`, `neutro`. A intensidade do preenchimento é uma mistura entre a série e o terreno, sempre com o valor escrito no chip e na lista lateral. Fluxos são arcos com espessura proporcional ao volume e tracejado em movimento no sentido do fluxo (`.fluxo-animado`), congelado com `prefers-reduced-motion`. Detalhes por região (sparkline, mix, texto) entram como nós React já renderizados no servidor.

`MapaVivo` empilha camadas (`?camada=`) sobre o mesmo mapa: no topo da Visão geral, Preço, Água, Geração, Carga e Rede; na página de Água, EAR e ENA.

## 4. Tipos de visual: quando usar, quando não usar

Cada tipo abaixo lista quando usar, quando não usar, interações, cores, tooltip e celular.

### Mapa (esquemático por submercado)

* **Usar** quando o dado varia por submercado ou subsistema: PLD, EAR, ENA, mix de geração, carga, saldo de intercâmbio.
* **Não usar** para dado nacional único (SIN), para série temporal longa ou para dados que não têm dimensão espacial na gold. Um mapa sem conteúdo espacial vale menos que um gráfico.
* **Interações**: clique ou teclado seleciona a região e abre o detalhe; camadas por abas; lista lateral equivalente com botões `aria-pressed`.
* **Cores**: tom do domínio misturado com o terreno; valor sempre escrito.
* **Tooltip**: chip fixo por região com valor e subtítulo; no celular o chip some e a lista assume.
* **Celular**: mapa em coluna única, chips ocultos, lista de regiões abaixo, fluxos listados em texto.

### Choropleth (por município ou estado)

* **Usar** só quando houver dado municipal ou estadual integrado (geração distribuída, consumo por UF, empreendimentos). Hoje não há; o mapa por submercado é o máximo honesto.
* **Não usar** com dado por submercado (quatro classes não formam um coropleto) nem para valores absolutos sem normalização.
* **Interações**: filtro temporal, hover com valor e posição no ranking, clique leva à ficha.
* **Cores**: escala sequencial de um só matiz, cinco a sete classes, legenda com cortes.
* **Tooltip**: nome, valor, unidade, data e fonte.
* **Celular**: lista ordenada substitui o mapa abaixo de 640 px.

### Mapa de símbolos (usinas, subestações)

* **Usar** quando houver coordenadas de ativos integradas: usinas por fonte e potência, subestações, projetos em expansão com data.
* **Não usar** como decoração; sem coordenadas verificadas o mapa não entra. A página de Geração e a de Expansão declaram a ausência.
* **Interações**: filtro por fonte e estado, escala de tempo para ver entradas em operação, clique abre a ficha do ativo.
* **Cores**: uma cor por fonte da paleta semântica; tamanho pelo porte.
* **Tooltip**: nome, fonte, potência, data de operação, agente, link para a fonte oficial.
* **Celular**: agrupar por estado com contagem e lista.

### Sankey (fonte para região)

* **Usar** para decomposição com dois eixos categóricos e um fluxo conservado: fonte para subsistema (`SankeyFontes`), no futuro geração para carga por região.
* **Não usar** quando o fluxo não se conserva (percentuais de bases diferentes), com mais de doze nós, ou quando uma tabela responde melhor. Um Sankey ruim é pior que uma boa tabela.
* **Interações**: janela temporal (`?janela=`: dia, 7 dias, 30 dias, 12 meses), hover destaca o laço com o valor e a participação.
* **Cores**: laço na cor da fonte; região em cinza neutro.
* **Tooltip**: fonte, região, MWmed, participação na região e na fonte, data.
* **Celular**: barras de mix por região substituem o Sankey; tabela sempre disponível.

### Waterfall (contribuição de modelo)

* **Usar** apenas quando existir um modelo em produção que decomponha a variação da previsão em contribuições. Deve ser rotulado "contribuição do modelo", nunca "causa".
* **Não usar** com o modelo em pesquisa, com decomposições não aditivas ou para explicar o PLD realizado (a CCEE não publica essa decomposição).
* **Interações**: seleção de rodada e horizonte, hover com valor de cada barra.
* **Cores**: positivo e negativo em dois tons do domínio, total em carvão.
* **Tooltip**: componente, contribuição, sinal, modelo e versão.
* **Celular**: barras horizontais.

Hoje a página do PLD mostra o lugar do waterfall com o texto "Por que a previsão mudou?" e declara que nenhum modelo está em produção.

### Linha

* **Usar** para série temporal contínua com poucas séries (até quatro), com rótulo direto no fim da linha.
* **Não usar** para categorias sem ordem, para mais de quatro séries (usar small multiples) ou para composição (usar área empilhada).
* **Interações**: hover com valor por série; marcos de regime (`marcos`) e faixas de período (`faixasX`); linha "ensina" com a definição e link para o verbete.
* **Cores**: paleta semântica; referência tracejada.
* **Tooltip**: data, cada série com unidade, marco quando existir, texto didático.
* **Celular**: eixo com poucos rótulos, tabela de dados dobrável.

### Área (composição no tempo)

* **Usar** para composição que soma 100 por cento ao longo do tempo (`EvolucaoMatriz`: hidráulica, térmica, eólica, solar por mês).
* **Não usar** para séries independentes (a leitura da altura de cada faixa é difícil) ou quando o total muda de regime sem marcação.
* **Interações**: reprodução com pausa, mês na URL (`?mes=`), comparação de dois meses, marco de mudança de regime.
* **Cores**: uma faixa por fonte, ordem fixa.
* **Tooltip**: mês, participação de cada fonte, total em MWmed e dias contados.
* **Celular**: reprodução desativada por padrão; comparador em lista.

### Fan chart (previsão com incerteza)

* **Usar** para previsão com faixas P10 a P90 a partir de um modelo em produção; o realizado à esquerda, o horizonte à direita.
* **Não usar** com faixa inventada, com um só cenário sem intervalo ou sem modelo registrado. Sem previsão, o horizonte fica hachurado e a legenda diz o motivo (`FanChart` com `previsao=null`).
* **Interações**: submercado e horizonte na URL, seleção de rodada, máquina do tempo para comparar previsões antigas com o realizado.
* **Cores**: realizado em cor do PLD, faixa em tom claro, mediana tracejada.
* **Tooltip**: data, P10, P50, P90, modelo, versão, sha256 da rodada.
* **Celular**: mesma figura em altura reduzida; tabela.

### Small multiples

* **Usar** para comparar a forma de várias séries na mesma escala de tempo: carga por subsistema, EAR por subsistema contra a faixa histórica.
* **Não usar** com escalas diferentes sem avisar (a página escreve "cada região na sua própria escala"), nem para menos de três painéis.
* **Interações**: hover sincronizado quando possível; cada painel com tabela própria.
* **Cores**: uma cor por região, fixa na plataforma.
* **Tooltip**: valor, data e variação sobre o período comparado.
* **Celular**: grade de dois por dois, depois coluna única.

### Heatmap (calendário)

* **Usar** para série diária longa em que padrão semanal e sazonal importam (`HeatmapCalendario`: carga do SIN em 12 meses).
* **Não usar** com dado esparso, com menos de oito semanas ou para valores que não têm ciclo.
* **Interações**: hover por dia; leitura escrita ao lado (maior, menor, média por dia da semana).
* **Cores**: escala sequencial do domínio, "sem dado" como quadrado tracejado.
* **Tooltip**: data, dia da semana, valor e unidade.
* **Celular**: rolagem horizontal contida dentro da figura; tabela dobrável.

### Scatter

* **Usar** para relação entre duas variáveis observadas (EAR contra PLD, ENA contra CMO) com o período colorido, sempre com o aviso de que correlação não é causa.
* **Não usar** para séries curtas, para variáveis com bases distintas ou como prova de mecanismo.
* **Interações**: brush por período, hover por ponto com data.
* **Cores**: tempo em escala sequencial; submercado por cor fixa.
* **Tooltip**: data, as duas variáveis, submercado.
* **Celular**: pontos maiores, menos rótulos.

Ainda não há scatter no portal: a plataforma evita o gráfico enquanto a leitura de causa não puder ser negada com a mesma força visual da correlação.

### Distribuição (percentil, faixa histórica)

* **Usar** para posicionar o valor de hoje na história: coluna de reservatório com P10, P50 e P90 (`ColunasReservatorio`), faixa do 10º ao 90º percentil no gráfico sazonal.
* **Não usar** com menos de cinco anos de histórico ou para variáveis com mudança de regime não marcada.
* **Interações**: hover com percentil e mediana; link para a regra de classificação.
* **Cores**: faixa em cinza claro, valor em cor do domínio.
* **Tooltip**: valor, percentil, mediana do mesmo dia do calendário, período da base.
* **Celular**: colunas em grade de dois por dois.

### Timeline (regulação e histórico de previsões)

* **Usar** para eventos datados com efeito declarado: normas, mudanças de regime, rodadas de previsão (`MaquinaDoTempo`).
* **Não usar** para séries contínuas ou quando a data do evento não é conhecida com precisão.
* **Interações**: cursor de tempo, filtro por tipo de evento, clique abre a fonte oficial.
* **Cores**: neutro; destaque na cor do domínio.
* **Tooltip**: data, ementa, órgão, link.
* **Celular**: lista cronológica vertical.

A timeline regulatória interativa fica para depois da integração dos atos normativos; a página de Regulação mostra o esquema do que será conferido.

### Grafo (rede de relações)

* **Usar** para propriedade e controle (grupo, empresa, ativo) quando os dados societários estiverem integrados.
* **Não usar** com mais de cinquenta nós sem filtro, para relações não verificadas ou como mapa decorativo.
* **Interações**: busca por empresa, expansão de nó, filtro por fonte.
* **Cores**: fonte da usina; grupo em cinza.
* **Tooltip**: nome, CNPJ quando público, participação, fonte oficial.
* **Celular**: árvore recolhível.

### Slope chart

* **Usar** para comparar duas datas em várias categorias: mix por fonte em dois meses, PLD por submercado em dois dias.
* **Não usar** com mais de oito categorias ou quando o meio do período importa.
* **Interações**: seleção das duas datas (o comparador de `EvolucaoMatriz` já faz em lista).
* **Cores**: sobe e desce em dois tons; categoria destacada em carvão.
* **Tooltip**: categoria, os dois valores, variação em pontos percentuais.
* **Celular**: lista com setas.

### Matriz (tabela de calor)

* **Usar** para dois eixos categóricos com valor: horizonte por submercado (`MaquinaDoTempo`), fonte por região.
* **Não usar** com muitas células vazias sem explicação; célula vazia recebe "sem número" ou "número retido", nunca fica em branco.
* **Interações**: seleção de linha ou coluna, ordenação.
* **Cores**: escala sequencial ou só texto quando o valor for ausente.
* **Tooltip**: valor, natureza, proveniência.
* **Celular**: cabeçalho fixo e rolagem contida.

### Diagrama de fluxo e infográfico estrutural

* **Usar** para mecanismo e estrutura: formação do preço (`DiagramaFormacao`), sistema da chuva ao consumidor (`InfograficoSistema`), linhagem dos dados (`LinhagemDados`), esteira de integração (`PipelineEstados`), estrutura de mercado (`EsquemaConceitual`).
* **Não usar** para sugerir causa entre etapas, com números inventados ou sem estado de conferência em cada nó.
* **Interações**: cada etapa é um botão; setas do teclado percorrem; painel abaixo traz definição, número de hoje com natureza, fonte e link para o módulo; etapa na URL (`?etapa=`).
* **Cores**: neutro; etapa ativa em fundo do domínio; estado de conferência em texto (conferido, leitura usual, pendente).
* **Tooltip**: substituído pelo painel de detalhe, acessível por teclado.
* **Celular**: grade de duas colunas, setas ocultas, painel em coluna única.

## 5. Componentes e correspondência com o brief

| Nome no brief | Componente | Onde |
| --- | --- | --- |
| MetricHero | `MetricaHero` | topo de todas as páginas integradas |
| InteractiveBrazilMap | `MapaBrasil`, `MapaVivo` | Visão geral, PLD, Água, Geração, Carga, Rede, microaulas |
| SourceDrawer, MethodologyDrawer | `SobreEsteDado`, `PainelEvidencia` | todo painel |
| ConceptTooltip | `Termo`, linha "ensina" de `GraficoLinhas` | textos e gráficos |
| SeasonalChart | `GraficoLinhas` com `formatoX="md"` e faixa P10 a P90 | Água |
| FlowDiagram | `DiagramaFormacao`, `InfograficoSistema`, `EsquemaConceitual`, `LinhagemDados` | PLD, Aprenda, módulos em integração, Dados |
| SankeyExplorer | `SankeyFontes` | Geração |
| ForecastFanChart | `FanChart`, `PrevisaoPld`, `ExplicadorIncerteza` | PLD |
| VintageSlider | `MaquinaDoTempo` | PLD |
| EntityMap | pendente (sem dado societário) | Empresas |
| TimelineExplorer | `MaquinaDoTempo`; regulação pendente | PLD, Regulação |
| EvidenceBadge | `SeloNatureza`, `Conferido` | todo número |
| InsightAnnotation | `marcos` e `faixasX` de `GraficoLinhas`, leitura do `HeatmapCalendario` | Água, Geração, Carga |
| ComparePanel | comparador de `EvolucaoMatriz`, comparação de 12 meses em Carga | Geração, Carga |
| DataDownload | `TabelaDados`, "Baixar CSV" do painel | todo painel |
| Sparkline, ícones | `Sparkline`, `IconeSetor` | métricas, blocos, mapas |
| Sistema em uma tela | `SistemaEmUmaTela` | Visão geral |
| Mapa conceitual | `MapaConceitual` | Aprenda |
| Data Explorer | `CatalogoFiltro`, `PipelineEstados` | Dados |

## 6. Vocabulário de URL

| Parâmetro | Valores | Componente |
| --- | --- | --- |
| `modo` | entender, analisar, auditar | `ModoProfundidade` |
| `camada` | preco, agua, geracao, carga, rede, ear, ena | `MapaVivo` |
| `bloco` | agua, geracao, transmissao, consumo, preco | `SistemaEmUmaTela` |
| `dia`, `submercado` | data ISO, N, NE, SE, S | `LinhaDoDia`, `PrevisaoPld` |
| `horizonte` | w1 a w4, m1 | `PrevisaoPld` |
| `janela` | dia, 7d, 30d, 12m | `SankeyFontes` |
| `mes` | AAAA-MM | `EvolucaoMatriz` |
| `visao` | mapa, fluxos, historico | `AbasVisoes` (Rede) |
| `dominio` | natureza, geracao, sistema, mercado, preco, consumidor | `MapaConceitual` |
| `etapa` | id da etapa | `InfograficoSistema`, `LinhagemDados` |

## 7. Celular

Coluna única, narrativa preservada, visual principal primeiro. Mapas escondem os chips e mostram a lista; Sankey vira barras de mix; grades de etapas quebram em duas colunas; sparklines nunca ultrapassam o contêiner; heatmap rola dentro da própria figura; nenhuma página tem rolagem horizontal (o script de captura mede `scrollWidth` menos `clientWidth` em 390 px e a auditoria exige zero).

## 8. Acessibilidade

Todo botão de região, camada, etapa ou aba tem `aria-pressed` e alvo de 44 px; o painel de detalhe usa `aria-live="polite"`; infográficos aceitam setas do teclado; toda figura tem tabela ou lista equivalente; contraste AA conferido por teste; `prefers-reduced-motion` congela fluxos, trajetórias e reproduções automáticas.

## 9. O que fica de fora, e por quê

Sem gauge, pizza, 3D, gradiente decorativo, glassmorphism, sombra pesada, neon ou grade de dezenas de cartões. Sem mapa de usinas, choropleth municipal, grafo societário, timeline regulatória ou waterfall até que os dados correspondentes estejam integrados com proveniência: cada um desses lugares mostra hoje o esquema do que será conferido e o estado do catálogo, sem número.
