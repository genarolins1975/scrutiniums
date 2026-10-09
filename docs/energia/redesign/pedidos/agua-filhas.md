# Pedidos da família Água e clima, páginas filhas (rotas /setor-eletrico/agua-e-clima/afluencia, /chuva-e-temperatura e /reservatorios)

Registro dos pedidos ao coordenador: arquivo sem uso (para apagar no fim, com o servidor parado), mudanças em componentes compartilhados, pedidos de dado e de pipeline, notas para o dono da página mãe (P017), o que ficou sem solução e as equivalências para a matriz de preservação. Nenhum pedido bloqueia a família: cada página segue com a melhor solução local, descrita no item.

## 0. Arquivo sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/AguaLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel usa o `SeguirPainel` compartilhado (por `AguaPagina.tsx`). A linha 5 de `docs/observatorios/energia/modulos/agua.md` ainda o cita na lista de componentes do módulo; ao apagar o arquivo, tirar o nome dessa lista. Nenhum teste o cita.

## 1. Componentes compartilhados (nenhum foi alterado por este executor)

1.1 `NavegacaoLocal` (variante `faixa`) em 390 px. A faixa de páginas irmãs ocupa 173 px de altura empilhada (44 px em 1440) e fica antes do título. Com ela, o título termina em y=375 (afluência e reservatórios) e y=408 (chuva e temperatura), e a figura principal começa em y=1034, 1051 e 1308 (o mapa). Proposta: abaixo de 640 px, uma linha única com rolagem horizontal (ou uma lista de seleção). Devolve cerca de 130 px à primeira tela de todas as filhas, sem mexer em nada das páginas.

1.2 `PequenosMultiplos`, legenda repetida. A legenda agrupa as séries pelo `id`; quando os painéis usam ids próprios (uma série por painel, como "MLT implícita de 15 de janeiro e de 15 de julho" ou "chuva mensal por bacia"), a legenda lista uma entrada por painel. Local: cada série leva a região ou a bacia no rótulo e a cor da entidade (a mesma nos demais gráficos da página), de modo que nenhum rótulo se repete, ao custo de uma legenda mais longa. Proposta: agrupar a legenda por rótulo e cor, o que permite usar os mesmos rótulos nos painéis ("Chuva no mês", "Média do mês") e ter uma legenda de duas entradas.

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

## 3. Notas para o dono da página mãe (P017, `AguaArmazenamento.tsx` e `page.tsx`)

Itens da avaliação que repetem os das filhas e que a mãe pode resolver com o que está em `src/lib/energia/agua.ts` (só ganhou seletores):

- Duas janelas do mesmo subsistema: `textoOutraJanelaNaArmazenamento(entidade, decomposicoes)` devolve a frase para a página de armazenamento ("A página de reservatórios mostra ... de dd/mm a dd/mm, o último dia com EAR por reservatório. Aqui a janela é de 30 dias até dd/mm ..."), vazia quando as duas terminam no mesmo dia.
- Nomes sem acento: o dicionário de `nomeProprio` foi ampliado (São Roque, Tucuruí, Curuá-Una, Serra do Facão, Corumbá, Capim Branco, Água Vermelha, Barra Bonita, Ilha Solteira, Irapé e outros). A mãe herda sem mudança: o HTML dela já traz Tucuruí, São Roque, Curuá-Una e Serra do Facão.
- Faixa fora do painel: acrescentar `ear_diario.csv` aos arquivos da mãe, como a afluência fez com `ena_diario.csv`.
- Legenda da faixa anual: a base exclui o ano do ponto (2001 a 2024 nos pontos de 2025 e 2001 a 2025 nos de 2026), e hoje a legenda diz o mesmo período para todos.
- Eventos de 01/01/2018: três eventos com resíduo de 1,0, −2,998 e +2,997 MWmês aparecem como "dentro da tolerância"; vale escrever a regra do dia anterior e levar a tolerância ao CSV.
- Etiqueta "Observado": a legenda da afluência passou a dizer que a ENA é derivada pelo ONS (vazão natural reconstituída, convertida em energia), não medição direta. A EAR é derivada do mesmo modo e a frase serve.
- Cartões que não seguem o recorte: o padrão usado nas filhas é a faixa exportada (`MedidasAfluencia`, `MedidasClima`, `MedidasDecomposicao`, `MedidasBalanco`) abaixo da figura que controla a seleção.

## 4. Decisões locais que diferem da sugestão das avaliações

- A faixa de medidas fica abaixo da figura principal, não antes dela. Motivo: ela acompanha a seleção da figura (recorte, bacia, período, reservatório), e a primeira tela de 390 px já perde 173 px com a faixa de navegação; com a faixa de medidas antes da figura, a resposta saía da primeira tela. A frase de resposta (o veredito) continua acima da figura.
- Fichas "Comprove" só onde a gold traz prova: o SIN (afluência); a bacia padrão em 30 dias e o SIN (chuva e temperatura); o resíduo do reservatório padrão e o fechamento (reservatórios). Para outro recorte a medida aparece sem ficha.
- "Comparar bacias" (chuva) passou de Analisar para Entender, e a MLT de 15 de janeiro e de julho (afluência) virou uma grade de quatro painéis no Entender: são figuras que respondem a uma pergunta própria (regra de `SecaoDoPainel`). A tabela longa de cada uma segue em Analisar.
- A correlação de Pearson foi mantida, com a ressalva visível; as alternativas dependem do item 2.6.
- Páginas mais longas no Entender (1440 e 390): afluência 3.537 para 4.775 px e 5.797 para 8.320 px; chuva e temperatura 6.471 para 7.272 px e 9.980 para 12.270 px; reservatórios 5.361 para 5.847 px e 7.526 para 8.748 px. O acréscimo vem das figuras pedidas pelas avaliações (diferença da MLT com lacunas, grade de janeiro e julho, balanço em três gráficos, faixa de medidas que acompanha a seleção). O achado de página longa em celular (chuva, 11.600 px na avaliação) não foi reduzido.

## 5. Achados de conteúdo e de dado, vistos e não corrigidos

- A bacia Santa Maria da Vitória não tem contorno na camada do mapa: fica fora do mapa e da tabela, e a página diz isso (`baciasSemChuva`).
- Os totais únicos (580 pontos e 97 células) não batem com a soma das tabelas (581 e 98): um ponto cai em duas bacias e uma célula serve ao DF e a Goiás. A página explica.
- Cinco reservatórios com EAR máxima positiva não têm balanço por falta de correspondência no cadastro (`sem_cadastro`); o seletor os marca "(sem balanço)" com o motivo exato.
- A versão da MLT tratada como "provisória" (de 04/11/2025 a 19/01/2026) é uma inferência do projeto, não um termo do ONS; a página diz "versão inferida como provisória".
- Abril, maio e junho de 2026 não têm relatório do PMO lido; a página lista os meses sem comparação.
- O ONS revisou a ENA depois da captura (a do Sudeste/Centro-Oeste em 29/09 foi de 28.669 para 29.672 MWmed na consulta de 09/10, e a ENA de 30 dias do SIN de 172,3% para 172,8%). A gold não traz essa revisão; a página marca os dias recentes como provisórios e a tabela de revisões mostra o que a recaptura já mudou.
- `src/lib/energia/agua.ts` só ganhou seletores, textos e colunas; nenhum cálculo existente mudou.

## 6. Equivalências para a matriz de preservação

A comparação mecânica (`energia_visoes_compara.py`) marca quatro visões como "não localizada"; todas existem:

- Os três painéis "A água que chega está acima do normal?", "Como o clima se relaciona com a água e com a demanda?" e "Por que o armazenamento mudou?": a pergunta continua como título da página (h1); o título do painel passou a descrever a primeira figura, pela regra de que o título da primeira figura difere do da página.
- "MLT implícita de cada subsistema no dia 15 de janeiro e de julho, desde 2000" (afluência, Analisar): agora a grade de quatro painéis da seção `mlt` (Entender), com o título "... no dia 15 de janeiro e no dia 15 de julho, desde ..." e a tabela "Dados dos painéis em tabela (27 linhas, 4 painéis)"; a tabela por usina segue em `mlt-detalhes` (Analisar).

Mudanças de nível: a grade de janeiro e julho (antes um gráfico com a tabela de 54 linhas, em Analisar) passa ao Entender; o gráfico novo da diferença da MLT contra o PMO (com a tabela de 10 linhas) nasce no Entender, e o gráfico antigo de mês a mês do Sudeste/Centro-Oeste segue em Analisar; "Comparar bacias" e a tabela de seus quatro painéis de Analisar para Entender. Contagens: a tabela da decomposição passa de 10 para 11 linhas (acrescenta "Soma dos demais 35 reservatórios"); o gráfico de balanço de Serra da Mesa virou três gráficos (balanço, divisão da defluência, resíduo e transferência); fichas "Comprove" de afluência, antes 2 em Entender e 3 em Analisar e Auditar, agora 3 nos três níveis (a contagem "5 para 3" da matriz soma níveis); arquivos para baixar da afluência de 4 para 5 (`ena_diario.csv`); controles distintos da afluência de 15 para 16.
