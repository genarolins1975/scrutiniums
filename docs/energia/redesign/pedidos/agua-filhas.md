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

1.5 `Numero` e a ficha "Comprove": a linha "Revisões" por `revisoes` (S7) foi usada nas quatro páginas; nada mais a pedir.

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

`page.tsx`, `AguaArmazenamento.tsx`, `AguaPagina.tsx` e os seletores de `agua.ts` passaram a este executor depois do relatório das filhas. A abertura (lead, faixa do SIN, notas, capítulos) é a do coordenador; o resto foi aplicado assim. Na rodada 2 os capítulos do meio da página saíram (a faixa de abas ficou no alto, como nas filhas) e o bloco de baixo deixou de repetir os cartões do SIN: ver a seção 7.

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
- "Comparar bacias" (chuva) passou de Analisar para Entender, e a MLT de 15 de janeiro e de julho (afluência) virou uma grade de quatro painéis no Entender: são figuras que respondem a uma pergunta própria (regra de `SecaoDoPainel`). A tabela longa de cada uma segue em Analisar. Revisto na rodada 2: as duas voltaram a Analisar (a avaliação achou o Entender longo e com painéis de peso parecido); ver a seção 7.
- A correlação de Pearson foi mantida, com a ressalva visível; as alternativas dependem do item 2.6.
- Mãe: os números do recorte escolhido repetiam os da faixa do SIN quando o recorte é o SIN (o padrão). Substituído na rodada 2: com o SIN escolhido, a seção diz que os quatro números são os do alto e guarda só a nota de provisório; outro recorte traz os quatro dele.
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

## 7. Rodada 2 (CORRECOES_U03.md): feito, pendente e pedidos

Rodada encerrada por ordem do usuário, sem exigir nota 9: a família ficou consistente, e o que não coube está declarado abaixo. Nada foi apagado e nenhum componente compartilhado foi alterado. Novos arquivos da família: `AguaTabela.tsx` (tabela que não abre sozinha ao escolher uma entidade), `AguaRestaurar.tsx` (botão "Restaurar padrão", só aparece quando a URL tem escolha), `AguaPontes.tsx` (ligações neutras para Geração, PLD, Carga e Conta de luz). Equivalências: `agua-filhas.equivalencias.json` (66 de 66 visões das quatro rotas casadas, 0 a justificar).

7.1 Medidas em Entender (build do início da rodada contra o atual; 1440 e 390 px): topo da primeira figura da mãe 919 para 1.066 e 1.827 para 2.147; afluência 793 para 923 e 1.323 para 1.517; chuva 778 para 874 e 1.257 para 1.451; reservatórios 748 para 799 e 1.110 para 1.385. A figura desceu porque a mãe ganhou a faixa de abas (44 px) e porque o lead com o motivo de importar e a linha "Não permite concluir" somam linhas; a resposta e os quatro números seguem na primeira tela da mãe. Altura da página em 1440: mãe 5.072 para 5.332, afluência 4.768 para 4.477, chuva 7.245 para 7.350, reservatórios 5.860 para 6.555 (glossário, aviso de provisório e pontes). axe sem violações nas quatro páginas, em 1440 e 390, console limpo, tabela fechada depois de escolher entidade e Restaurar desfaz (testado nas quatro).

7.2 Corrigido (nas quatro páginas, salvo onde dito):
- Abertura com as cinco respostas: lead com o motivo de importar e `limite` ("Não permite concluir") à vista.
- Termos no ponto de uso: REE por extenso (mãe), mediana (mãe), MLT armazenável (afluência), MWmed, conjunto aberto, MLT implícita e PMO (definidos em Analisar), IMERG Late e Final, GEOS-IT, ECMWF e IFS (chuva), parte própria e a jusante, defluência e "fecham por construção" (reservatórios).
- Erros de definição da avaliação técnica: "MLT armazenável" (a referência é a MLT da ENA bruta: provado no CSV, `mlt_arm_implicita_mwmed` igual a `mlt_implicita_mwmed`; número, nota, resposta e ficha dizem isso); "parte própria" (energia que a água produz nas usinas do subsistema do reservatório; "a jusante", nas de outro subsistema, rio abaixo, com exemplo lido da gold; a frase do Norte diz "parte a jusante de Serra da Mesa"); 1 MWmês = 720 MWh com a fonte (glossário do ONS, Dados Relevantes 2010); IMERG calibrado só na versão Final; regra dos 25% também na coluna Posição ("não dita: a EAR máxima variou X na base"); aviso de provisório dos dados hidráulicos nos reservatórios (mesma estrutura dos avisos da EAR e da ENA); ficha da temperatura com as duas médias; linha "Revisões" das fichas de chuva e temperatura diz que a troca Late/GEOS-IT pelo produto final é revisão certa; "Sobre este dado" da EAR e da ENA mostra os dias revisados da tabela da página.
- "Observado": "derivada pelo ONS" junto dos selos (subtítulo dos painéis, notas de afluência e defluência); selo "Previsto" saiu do cabeçalho do mapa (a previsão tem a seção, o selo e a ficha dela).
- Tabela equivalente que não abre sozinha, "Restaurar padrão" (inclui a ordem dos pontos, agora na URL: `pts.ord` e `pts.dir`), faixa de abas na mãe, pontes neutras, frase de que a escolha dos recortes ou regiões comparados é independente, comparação de reservatórios que abre com os quatro maiores, janela de 30 dias dita uma vez, barra "Demais 35" em série própria (outra cor e legenda), vazão defluente grossa sob a turbinada fina, link "ir para a conta da água" com 44 px, glossário antes dos gráficos, legenda do mapa com papel, quatro cartões de natureza sem célula vazia, texto lateral do mapa em 14 px com a fonte recolhida, contorno visível de cada bacia, nota do erro do IMERG diante da classe central, linha da média do IMERG por dia no gráfico da previsão, nota sobre meses acima da média na temperatura, resumo de duas frases da MLT em Entender com as figuras em Analisar, bloco do SIN compacto na mãe, história antes da comparação na mãe, notas e legendas das páginas em 14 px.

7.3 Parcial ou pendente (com o motivo):
- Primeira figura na primeira tela de 1440 (mãe): não; subiu em vez de descer (7.1). Resposta e quatro números cabem; a figura começa abaixo da dobra.
- Texto de 12 px e eixos de 10 a 11 px: parcial. Os 12 px de `Numero`, `FaixaMetricas` e do rodapé de `PainelEvidencia` e os eixos dos gráficos são compartilhados (pedido S4).
- Mapa que satura no período seco (14 de 22 bacias na maior classe) e classes só em percentual: não feito (pediria classes novas ou um segundo modo de cor por percentil); os milímetros e o percentil seguem na dica, na tabela e na nota.
- Título da chuva ("relaciona com a água e com a demanda"): é a pergunta do contrato (Anexo A); o lead e o limite dizem o que a página entrega e onde a relação é medida.
- Página de chuva não ficou mais curta (7.1): a comparação de bacias foi para Analisar, mas as pontes e os quatro cartões ocuparam o lugar.
- Texto do método do quantil (tipo 7) e do percentil nas regras de Auditar: não feito.
- Leitor de tela real, LCP, INP e CLS e protocolo de medição (L): fora do alcance da família.
- Gráfico de pontos sem a faixa p10 a p90 (mãe e afluência), contraste de 2,3:1 do losango e dos conectores, `ModoProfundidade` com a descrição só ao pairar, três faixas de navegação antes do título, alvos de 17 px das siglas e de 32 px do "Comprove": compartilhados.

7.4 Pedidos ao pipeline (a página já diz o que falta):
- Fichas `evidencias` para a mediana do SIN e a variação de 30 dias (mãe), a mediana da janela e a ENA do dia (afluência) e a variação da EAR do subsistema e as parcelas (reservatórios): a gold só publica fichas para dez números, e `sobDemanda` precisa do JSON com a ficha.
- Faixa usual por data para a ENA semanal e para a EAR semanal em MWmês, e referência da data por reservatório (volume e balanço); ENA por REE e bacia em série e ENA mensal por bacia (chuva e ENA lado a lado).
- Variação de EAR dos demais reservatórios, CSV da decomposição e outras janelas que não 30 dias.
- CSV das séries dos gráficos (SIN mensal desde 2000, 120 dias, 78 semanas, MLT implícita) e cabeçalho dos CSV com unidade, fonte, captura e versão (hoje só colunas, `;` e ponto decimal).
- Climatologia da chuva (2001 a 2025) em CSV, temperatura por UF, viés Late/Final e GEOS-IT/MERRA-2, conferência da temperatura com estação, valor da anomalia de temperatura antes do arredondamento.
- Anos e dia da maior diferença na conferência de unidade da ENA; faixa com MLT fixa; código sem `+alterado` e roteiro de reprodução que não dependa de bronze e silver internos.

7.5 Pedidos a componentes compartilhados: S1 `TabelaInterativa` com `abrirAoSelecionar` (a família usa o `AguaTabela` enquanto isso); S2 `GraficoPontos` com faixa p10 a p90 opcional e conectores mais escuros; S3 `GraficoBarras` com cor por categoria (hoje, série própria empilhada: o rótulo de leitor de tela repete "total"); S4 `Numero`, `FaixaMetricas` e `PainelEvidencia` em 14 px, "Comprove" e siglas com 44 px; S5 `ModoProfundidade` com a descrição visível no toque; S6 hierarquia de títulos (um h2 e seções h3); S7 `SobreEsteDado` aceitar o texto de revisões da página (a família ajusta `revisoes_conhecidas`, e o rótulo "Mais recentes" fica impreciso: os exemplos são o dia da maior diferença de cada subsistema); S8 faixa de abas, barra do módulo e menu do site empilhados.

7.6 Equivalências novas: `docs/energia/redesign/pedidos/agua-filhas.equivalencias.json`, com os três gráficos antes sem título (mãe e chuva), a tabela escondida dos pontos (mãe), a série mensal (mãe), a grade de MLT de janeiro e julho de volta a Analisar (afluência), o gráfico único do balanço virado em três e as opções de controle com nomes por extenso (chuva e reservatórios).
