# Pedidos da família Água e clima (página mãe /setor-eletrico/agua-e-clima e filhas /afluencia, /chuva-e-temperatura e /reservatorios)

Registro dos pedidos ao coordenador: arquivo sem uso (para apagar no fim, com o servidor parado), mudanças em componentes compartilhados, pedidos de dado e de pipeline, o que foi aplicado na página mãe (P017), o que ficou sem solução e as equivalências para a matriz de preservação. Nenhum pedido bloqueia a família: cada página segue com a melhor solução local, descrita no item.

## 0. Arquivo sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/AguaLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel usa o `SeguirPainel` compartilhado (por `AguaPagina.tsx`). A linha 5 de `docs/observatorios/energia/modulos/agua.md` ainda o cita na lista de componentes do módulo; ao apagar o arquivo, tirar o nome dessa lista. Nenhum teste o cita.

## 1. Componentes compartilhados (nenhum foi alterado por este executor)

1.1 `NavegacaoLocal` (variante `faixa`) em 390 px: feito pelo coordenador (duas abas por linha, 87 px em vez de 173). As posições da primeira figura das filhas em 390 px, medidas antes dessa correção, caíram cerca de 86 px.

1.2 `PequenosMultiplos`, legenda repetida: feito pelo coordenador (legenda por rótulo e traço; a cor que muda entre painéis vira amostra neutra e a linha "A cor identifica o painel"). Aproveitado: a mãe usa os rótulos "EAR", "10º percentil da data" e "90º percentil da data" em todos os painéis, com a cor de cada recorte; a afluência usa "15 de janeiro" e "15 de julho"; a chuva usa "Chuva no mês" e "Média do mês". Cada legenda passou a ter duas ou três entradas, em vez de uma por painel.

1.3 A escolha de região, bacia ou reservatório não passa de uma aba da família para outra (só o nível de profundidade persiste). Cada página tem o seu esquema de parâmetros (`useEstadoUrl`) e nenhuma conhece o do vizinho; levar a escolha exigiria um mapa entre chaves no `NavegacaoLocal` ou no registro das páginas. Não fiz: toca as quatro páginas da família. Dentro de cada página a escolha fica na URL e o botão "Copiar link deste painel" leva o recorte.

1.4 Desempenho em celular emulado (achado técnico de CLS e TBT). O que cabia à página foi feito: o painel de séries diárias dos reservatórios reserva a altura antes de carregar (CLS de laboratório próximo de 0,0004 nas três filhas). O TBT vem do HTML (429 KB, 464 KB e 433 KB, com os três níveis de profundidade renderizados no servidor) e da hidratação dos gráficos; reduzir exigiria montar os níveis Analisar e Auditar só quando abertos (como o `SobreEsteDado` passou a fazer) ou desligar o `prefetch` dos links da faixa. É uma decisão do `ModoProfundidade` e do `NavegacaoLocal`, não da página.

1.5 `Numero` e a ficha "Comprove": a linha "Revisões" por `revisoes` (S7) foi usada nas três páginas; nada mais a pedir.

## 2. Dado e pipeline (a página trata o caso, com a limitação dita; a solução é no dado)

2.1 Afluência, faixa por data da ENA semanal. A série de 30 dias a cada 7 dias não tem faixa do 10º ao 90º percentil por data na gold (só a da janela mais recente). A página diz isso na seção "evolucao" e mostra a linha de 100% da MLT. Pedido: publicar P10, mediana e P90 da ENA de 30 dias por data, na mesma base da faixa atual.

2.2 Afluência, soma das usinas contra a ENA do subsistema. A tabela traz a fração de dias fora de 0,1% e a maior diferença, mas não diz em que dia nem em que período. Pedido: publicar a data e o período da maior diferença por subsistema.

2.3 Afluência, faixa com MLT fixa. A faixa em % da MLT mistura versões da MLT (dito na página); não há versão da faixa com a MLT atual aplicada a todo o histórico. Pedido: publicar a faixa também em MWmed ou com a MLT fixa, para separar mudança de ENA de mudança de MLT.

2.4 Afluência, diário de 2000 a 2021. A página passou a oferecer `ena_diario.csv` como arquivo ("série completa, a base da faixa usual"). O CSV diário do painel continua começando em 2022. Nada a pedir além de manter o arquivo na publicação.

2.5 Chuva, base diária de 2001 a 2015. A média e a faixa de 30 dias usam 2001 a 2025, mas o CSV diário público começa em 2016 (a nota da tabela diz isso, e que a média não se reproduz só com ele). Pedido: publicar a chuva diária desde 2001 ou a climatologia de 30 dias por data.

2.6 Chuva, associação com a ENA. A página usa a correlação de Pearson sobre anomalias percentuais e avisa que é sensível a meses secos. Pedido: publicar também Spearman e a correlação sobre anomalia padronizada (no Paranaíba os três valores diferem bastante).

2.7 Chuva, conferência com estações. A correlação de 0,95 em 402 pares agrupa bacias e meses e cobre o período de IMERG Final; a janela de destaque é de IMERG Late. Pedido: conferência separada do produto Late, com correlação por bacia.

2.8 Reservatórios, parcelas da EAR. A gold publica 10 das 45 parcelas do Sudeste/Centro-Oeste (as 5 maiores quedas e as 5 maiores altas por subsistema) e o total do subsistema. A página mostra a barra "Soma dos demais 35 reservatórios", obtida por diferença, e diz o que não é publicado. Pedido: CSV com a variação de EAR de todos os reservatórios, por subsistema e janela.

2.9 Reservatórios, volume fora de 0 a 100%. Seis dos 67 reservatórios terminam a janela acima de 100% (Garibaldi, Ernestina, São Roque, entre outros); nos CSV, 56 de 153 têm algum valor fora da faixa. A página marca o nome com "(volume acima de 100%)" e explica. Pedido: coluna de marca nos CSV (`agua_reservatorios.csv` e `agua_reservatorios_diario.csv`).

2.10 Reservatórios, referência histórica. Não há faixa da mesma data nem variação típica de 30 dias por reservatório; a página não diz se uma queda é comum para a época. Pedido: faixa por data (ou variação típica de 30 dias) por reservatório.

2.11 Fichas "Comprove" de EAR e ENA (D6 do coordenador): a interface já mostra o texto de revisões da tabela da página; no pipeline, alimentar a ficha com a comparação entre capturas. Reservatórios tem captura única, e a ficha diz isso (`REVISOES_CAPTURA_UNICA`).

2.12 Versão do código `+alterado` (D4): fica para a reconstrução final da gold com a árvore limpa.

2.13 Mãe, faixa por data em MWmês. A série do último ano (a cada 14 dias) e a faixa de cada data são publicadas só em % da EAR máxima; a faixa em MWmês existe só para o dia de referência (`p10_mwmes`, `p50_mwmes`, `p90_mwmes`). Por isso a alternância de unidade da figura principal vale para os pontos pareados e para a faixa da data, e o gráfico do último ano fica em %, com a frase dizendo isso. Pedido: publicar na série semanal a EAR e o 10º, 50º e 90º percentis da data em MWmês, para o gráfico alternar de unidade com a mesma faixa.

2.14 Mãe, tolerância dos eventos de capacidade. `agua_capacidade_eventos.csv` traz o resíduo de cada evento, mas não a tolerância aplicada nem o campo `fechado`; a regra (10 MWmês quando o dia anterior ainda tem valores inteiros, 0,05 depois) está só no código do pipeline. Pedido: as colunas `tolerancia_mwmes` e `fechado` no CSV. A página descreve a regra e os três eventos de 01/01/2018 (resíduos de +1,000, −2,998 e +2,997 MWmês) que só fecham pela tolerância larga.

2.15 Mãe, `ear_diario.csv`. O arquivo com a EAR diária em % por subsistema e o SIN calculado, de 2000 em diante (a base da faixa), existe em `public/energia/series/` mas não está em `downloads` da gold; a página o acrescenta à lista de arquivos. Pedido: incluí-lo em `downloads` do módulo na próxima coleta.

## 3. Página mãe (P017): o que foi aplicado

`page.tsx`, `AguaArmazenamento.tsx`, `AguaPagina.tsx` e os seletores de `agua.ts` passaram a este executor depois do relatório das filhas. A abertura (lead, faixa do SIN, notas, capítulos) é a do coordenador; o resto foi aplicado assim.

- Duas janelas do mesmo subsistema: `textoOutraJanelaNaArmazenamento` aparece sob os números do recorte escolhido (nos subsistemas, menos o SIN, que não tem decomposição), e `textoJanelasDaVariacao` entra em "O que mudou" para qualquer recorte.
- Arquivo `ear_diario.csv` na lista de arquivos do painel (rótulo: em % da EAR máxima, série completa, a base da faixa usual).
- A faixa do último ano diz que a base exclui o ano do próprio ponto (`textoBaseDaFaixa`, lida do período da base e das datas da série): 2001 a 2024 nos pontos de 2025 e 2001 a 2025 nos de 2026.
- Eventos de capacidade: regra da tolerância com o dia anterior e os eventos que só fecham por ela (`textoToleranciaEventos`), mais a explicação de entrada, saída e alteração e do que a fonte não diz (`TEXTO_TIPOS_DE_EVENTO`).
- "Observado": a etiqueta das datas diz que a EAR e a ENA são derivadas pelo ONS, e a legenda da figura repete (`TEXTO_EAR_DERIVADA`).
- Números do recorte escolhido (`MedidasArmazenamento`) abaixo da figura que controla a seleção: EAR do dia, mediana da data, energia armazenada e variação de 30 dias, com a ficha de prova só no SIN, a nota de provisório e a amplitude da EAR máxima quando passa do limite. A faixa de abertura ficou fixa no SIN, com "do SIN" em cada rótulo, e o nome acessível e o rótulo da faixa de baixo dizem que ela não segue o recorte.
- Figura principal com alternância de unidade (% da EAR máxima ou MWmês) nos pontos pareados e na nova figura da faixa da data (`AguaFaixaDaData`: a faixa do 10º ao 90º percentil, a mediana e a EAR do dia, na unidade escolhida). A tabela do gráfico de pontos fica escondida por CSS dentro da página (`[&_details]:hidden`), para a tabela equivalente da página ser a única porta; a unidade fica no cabeçalho da figura a partir de 1280 px e acima dela abaixo disso.
- Tabela equivalente com as colunas essenciais à vista (recorte e os dois valores da figura, na unidade escolhida), as demais em Analisar e no arquivo; a tabela deixou de rolar em 390 px.
- Cor por recorte igual em todos os gráficos (`corDoRecorte`: a do subsistema, e a da energia para o SIN, os REE e as bacias), inclusive nos pequenos múltiplos.
- Texto de estado exato no lugar de "em sem base" (`textoPeriodoDoRecorte`), nomes acentuados herdados do dicionário de `agua.ts`, e EAR e SIN por extenso no lead, com EAR, MLT e ENA na linha de siglas.
- Fichas de EAR e de capacidade com a linha de revisões que a página mostra (`textoRevisoesFichaEar`, `REVISOES_CAPACIDADE`), e provisório dito em palavras junto do primeiro número e sob os números do recorte (`textoEarProvisoria`).
- Capacidade alterada além do limite (`LIMITE_VARIACAO_CAPACIDADE`, 25%): a posição frente à faixa não é dita; o veredito traz a amplitude (vezes ou %) e a resposta completa traz a faixa em MWmês e em %. Valem o Uruguai (5,7 vezes), o Tietê (+38%), o Sul e o Sudeste/Centro-Oeste (+40% e +28%) e outros; o SIN (+23%) e o Norte (+24%) ficam abaixo do limite.

## 4. Decisões locais que diferem da sugestão das avaliações

- A faixa de medidas fica abaixo da figura principal, não antes dela. Motivo: ela acompanha a seleção da figura (recorte, bacia, período, reservatório), e a primeira tela de 390 px já perde 173 px com a faixa de navegação; com a faixa de medidas antes da figura, a resposta saía da primeira tela. A frase de resposta (o veredito) continua acima da figura.
- Fichas "Comprove" só onde a gold traz prova: o SIN (afluência); a bacia padrão em 30 dias e o SIN (chuva e temperatura); o resíduo do reservatório padrão e o fechamento (reservatórios). Para outro recorte a medida aparece sem ficha.
- "Comparar bacias" (chuva) passou de Analisar para Entender, e a MLT de 15 de janeiro e de julho (afluência) virou uma grade de quatro painéis no Entender: são figuras que respondem a uma pergunta própria (regra de `SecaoDoPainel`). A tabela longa de cada uma segue em Analisar.
- A correlação de Pearson foi mantida, com a ressalva visível; as alternativas dependem do item 2.6.
- Mãe: os números do recorte escolhido repetem os da faixa do SIN quando o recorte é o SIN (o padrão), porque a seção segue sempre a seleção; a repetição custa cerca de 270 px.
- Mãe: o limite de 25% para dizer a posição é regra editorial desta página (a gold marca só a variação acima de 5%); fica em `LIMITE_VARIACAO_CAPACIDADE`, com teste que o aplica a todos os recortes.
- Mãe: a faixa em MWmês só existe para o dia de referência; ver 2.13.
- Páginas mais longas no Entender (1440 e 390): afluência 3.537 para 4.775 px e 5.797 para 8.320 px; chuva e temperatura 6.471 para 7.272 px e 9.980 para 12.270 px; reservatórios 5.361 para 5.847 px e 7.526 para 8.748 px. O acréscimo vem das figuras pedidas pelas avaliações (diferença da MLT com lacunas, grade de janeiro e julho, balanço em três gráficos, faixa de medidas que acompanha a seleção). O achado de página longa em celular (chuva, 11.600 px na avaliação) não foi reduzido.

## 5. Achados de conteúdo e de dado, vistos e não corrigidos

- A bacia Santa Maria da Vitória não tem contorno na camada do mapa: fica fora do mapa e da tabela, e a página diz isso (`baciasSemChuva`).
- Os totais únicos (580 pontos e 97 células) não batem com a soma das tabelas (581 e 98): um ponto cai em duas bacias e uma célula serve ao DF e a Goiás. A página explica.
- Cinco reservatórios com EAR máxima positiva não têm balanço por falta de correspondência no cadastro (`sem_cadastro`); o seletor os marca "(sem balanço)" com o motivo exato.
- A versão da MLT tratada como "provisória" (de 04/11/2025 a 19/01/2026) é uma inferência do projeto, não um termo do ONS; a página diz "versão inferida como provisória".
- Abril, maio e junho de 2026 não têm relatório do PMO lido; a página lista os meses sem comparação.
- O ONS revisou a ENA depois da captura (a do Sudeste/Centro-Oeste em 29/09 foi de 28.669 para 29.672 MWmed na consulta de 09/10, e a ENA de 30 dias do SIN de 172,3% para 172,8%). A gold não traz essa revisão; a página marca os dias recentes como provisórios e a tabela de revisões mostra o que a recaptura já mudou.
- O CSV `ear_diario.csv` termina em 28/09, um dia antes do dia da página (29/09); a página o descreve como série completa, sem dar o último dia.
- Na mãe, a EAR máxima do Sudeste/Centro-Oeste e do Sul varia mais de 25% na base (+28% e +40%): o veredito deles deixou de dizer "dentro da faixa usual", e a tabela, em Analisar, segue com a posição publicada e a ressalva ao lado.
- `src/lib/energia/agua.ts` só ganhou seletores, textos e colunas; nenhum cálculo existente mudou.

## 6. Equivalências para a matriz de preservação

A comparação mecânica (`energia_visoes_compara.py`) marca quatro visões como "não localizada"; todas existem:

- Os três painéis "A água que chega está acima do normal?", "Como o clima se relaciona com a água e com a demanda?" e "Por que o armazenamento mudou?": a pergunta continua como título da página (h1); o título do painel passou a descrever a primeira figura, pela regra de que o título da primeira figura difere do da página.
- "MLT implícita de cada subsistema no dia 15 de janeiro e de julho, desde 2000" (afluência, Analisar): agora a grade de quatro painéis da seção `mlt` (Entender), com o título "... no dia 15 de janeiro e no dia 15 de julho, desde ..." e a tabela "Dados dos painéis em tabela (27 linhas, 4 painéis)"; a tabela por usina segue em `mlt-detalhes` (Analisar).

Mudanças de nível: a grade de janeiro e julho (antes um gráfico com a tabela de 54 linhas, em Analisar) passa ao Entender; o gráfico novo da diferença da MLT contra o PMO (com a tabela de 10 linhas) nasce no Entender, e o gráfico antigo de mês a mês do Sudeste/Centro-Oeste segue em Analisar; "Comparar bacias" e a tabela de seus quatro painéis de Analisar para Entender. Contagens: a tabela da decomposição passa de 10 para 11 linhas (acrescenta "Soma dos demais 35 reservatórios"); o gráfico de balanço de Serra da Mesa virou três gráficos (balanço, divisão da defluência, resíduo e transferência); fichas "Comprove" de afluência, antes 2 em Entender e 3 em Analisar e Auditar, agora 3 nos três níveis (a contagem "5 para 3" da matriz soma níveis); arquivos para baixar da afluência de 4 para 5 (`ena_diario.csv`); controles distintos da afluência de 15 para 16.

Mãe (rota `/agua-e-clima` na matriz): o comparador (`scripts/energia_visoes_compara.py`) marca duas visões como "não localizada" e uma terceira casada por semelhança; todas existem.

- O painel "Quanta energia está armazenada?" é o título da página (h1); o painel passou a se chamar "Cada região frente à mediana da mesma data" na migração da abertura.
- "Dados do gráfico em tabela (321 linhas)", de Analisar: existe no Entender, ligada ao gráfico mensal de EAR e capacidade (o gráfico, os pequenos múltiplos e as tabelas deles passaram de Analisar a Entender na migração da abertura, não neste trabalho).
- "Dados do gráfico em tabela (5 linhas)", dos pontos pareados: o gráfico continua com a tabela própria no HTML, escondida por CSS; a "Tabela equivalente ... 5 de 5 linhas" da página traz as mesmas cinco linhas e é a única porta.
- Contagens: controles distintos de 16 para 17 (a unidade da figura); arquivos de 4 para 5 (`ear_diario.csv`); fichas "Comprove" de 7 para 11 (a contagem soma os níveis; os números do recorte escolhido trazem de novo as duas fichas do SIN, e nenhuma ficha anterior saiu).
