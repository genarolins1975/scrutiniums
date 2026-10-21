# Pedidos de mudança compartilhada: família Conta de luz

Rotas `/setor-eletrico/conta-de-luz` e `/setor-eletrico/conta-de-luz/reajustes-e-subsidios`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia as páginas: cada uma segue com a solução local descrita no item.

## 0. Arquivos sem uso para apagar no fim

Nenhum. Conferido pelas importações: os 17 arquivos `src/components/energia/Conta*.tsx` têm ao menos um importador (as duas páginas ou outro `Conta*`), e os componentes compartilhados que as páginas antigas importavam (`CabecalhoEnergia`, `CabecalhoModulo`, `GraficoBarras`, `Numero`, `RespostaCurta`, `TabelaInterativa`) seguem em uso. `ContaLinkPainel.tsx` perdeu só o componente interno que o `SeguirPainel` do sistema substituiu; o arquivo continua com `ContaLinkFiltros`. Nenhum arquivo foi apagado.

## 1. `NavegacaoLocal` aceitar `manter`

A faixa de páginas irmãs precisa levar a escolha de distribuidoras (`?dist=`, até quatro) de uma página à outra: quem escolheu a CEMIG-D no ranking chega aos reajustes com ela em destaque. O `NavegacaoLocal` monta `Link` com o endereço fixo. Local: `src/app/setor-eletrico/conta-de-luz/partes.tsx` (`Navegacao`) repete a marcação da faixa (`data-navegacao-local="faixa"`, `ol.nav-faixa`) com `ContaLinkFiltros`, que monta o endereço no toque, no foco ou no ponteiro. Proposta: `manter?: readonly string[]` em `NavegacaoLocal` (nomes dos parâmetros a levar, nas duas variantes), com um link de cliente pequeno; a Conta de luz então apaga a cópia da faixa.

## 2. `TabelaInterativa`: o rótulo "Recorte atual:"

`src/components/energia/TabelaInterativa.tsx`, linha 428. O rótulo "Recorte atual:" fica antes dos botões CSV e XLSX, que baixam as linhas filtradas, e aparece sempre que a tabela está aberta. "Atual" não é data aqui, mas é a palavra de tempo relativo que a regra editorial pede para evitar. Proposta: "Baixar o recorte:" ou "Recorte filtrado:".

## 3. Fichas "Comprove este número" que o gold não publica (pipeline)

Sem ficha hoje, e a página diz isso no ponto de uso em vez de inventar prova:

- Menor custo, mediana simples (R$/mês) e maior custo do perfil escolhido (100, 200 e 300 kWh). Só a tarifa mediana em R$/kWh tem ficha.
- O agregado de encargos setoriais (20,6% na tarifa média das distribuidoras com composição): o gold publica ficha só para a distribuidora de exemplo.
- A variação mediana em 60 e 120 meses (a ficha do gold é a de 12 meses).
- O efeito médio oficial de cada processo tarifário: não está no portal de dados abertos da ANEEL, e as páginas que o publicam recusaram a captura. A página diz isso logo abaixo da resposta e não usa valor de reserva.

Proposta: o pipeline emitir `evidencia` para cada um dos itens acima; a página passa a ligá-los sem outra mudança.

## 4. `GraficoBarras`

- Rolagem até a barra escolhida: com `alturaMaxima` a caixa mostra cerca de 12 barras de 81 (ou 102), e a escolha de uma distribuidora pode cair fora da vista. Local: `ContaTarifas.tsx` e `ContaReajustes.tsx` rolam a caixa com uma consulta ao DOM. Proposta: o componente rolar até `selecionado` quando ele muda.
- Ranking parcial por padrão (12 de 81): local, a faixa de pontos (`ContaPontos`) mostra as 81 e as 102 de uma vez. Proposta: prop de densidade (barra de 14 a 18 px) ou "mostrar todas".
- Marca "sem dado": caixa hachurada de 12 px fixos (`TAM_SEM_DADO`), igual para qualquer quantidade ausente, lida como um pedaço da barra. Na pilha de subsídios por categoria ela aparece em 7 das 14 colunas (2013 a 2019, com SCEE e Lei 14.299/2022 nulos no gold). Proposta: marca mais fina ou o rótulo "incompleta" sem caixa.
- Rótulos de 11 px no celular (valores, eixo e legenda: linhas 453, 492, 505, 544, 629 e 713 de `GraficoBarras.tsx`). Local: as figuras da família usam 12 px. Proposta: 12 px abaixo de 640 px.
- Cores repetidas entre gráficos vizinhos: os subsídios por categoria e o orçamento da CDE por grupo de despesa usam as mesmas posições da paleta com significados diferentes (a paleta de oito cores se esgota). Proposta: faixa de cores própria para cada gráfico empilhado da mesma página.

## 5. Componentes de apoio

- `ModoProfundidade` (linha 235): a descrição de cada nível está só em `title={m.dica}`, que o celular não mostra. Proposta: uma linha curta visível sob o seletor, ou `aria-describedby`.
- `LegendaSiglas` (linha 60): o `summary` "Mais 5 siglas" tem `min-h-[24px]`, abaixo dos 44 px de alvo de toque do guia.

## 6. Peso do HTML (meta 600 kB): o que sobra depois dos cortes locais

Medido no HTML servido pelo servidor de desenvolvimento, decodificado, com o fluxo RSC dentro:

| Página | Antes (produção) | Agora | DOM | Scripts e fluxo |
| --- | --- | --- | --- | --- |
| Conta de luz | 663.043 B | 681.301 B | 325.195 B | 356.106 B |
| Reajustes e subsídios | 584.943 B | 621.766 B | 313.721 B | 308.045 B |

O HTML servido caiu de 829.574 e 672.996 B (versão anterior aos cortes, já com o conteúdo das listas de aceitação) para esses valores, com props em tuplas em vez de objetos (`compactarVigentes`, `compactarComposicao`, `compactarDistribuidorasSim`, `compactarEntidades`, `compactarInfo`, `compactarLinhasTabela`), tabelas e municípios sob demanda (`ContaTabelaSobDemanda`, `municipios.json`) e rótulos reconstruídos no cliente. O acréscimo sobre a versão de produção vem do conteúdo pedido pelas avaliações (faixa de pontos de 81 e de 102, filtros e colunas de UF, tipo e UCs, série em reais, quotas, janelas de 60 e 120 meses). `src/tests/energia-conta.test.ts` trava o teto (475 kB e 420 kB de marcação mais props) para não regredir.

O que resta é compartilhado, em ordem de tamanho:

- `GraficoBarras`: cerca de 560 B de SVG por barra (`g role="button"` com `aria-label`, `rect` transparente, `path` e `text`). O ranking de 81 barras soma 65,7 kB de DOM com legenda e tabela equivalente; o de 102, 82,8 kB. Proposta: `class` no lugar dos atributos repetidos, um só alvo de toque por barra e, com `alturaMaxima`, montar só as barras perto da janela de rolagem.
- Props no fluxo de conteúdo que só aparece depois de abrir: `SobreEsteDado` (6 instâncias, 15,5 kB na principal), `DetalhesFechaveis` (8 instâncias, 11,4 kB) e `ComproveNumero` (10,7 kB na filha). Proposta: ler de um JSON estático na primeira abertura, como o histórico por distribuidora já faz.
- Atualizado na rodada 2 (seção 9): a tabela do ranking passou a abrir só ao pedido (em Analisar já nasce aberta), e o ranking de barras desenha as 12 primeiras (`limiteInicial`, do coordenador). Os números desta seção são os de antes dessas duas mudanças.

## 7. Achados de conteúdo e de dado vistos e não corrigidos

- `conta_subsidios_anual.csv` mistura linhas de categoria e de total (D2 da lista do coordenador). A página usa o gold (R$ 18,82 bilhões) e não o CSV.
- Gold de subsídios: `SCEE` e `Lei 14.299/2022` são nulos de 2013 a 2019, rubricas que ainda não existiam. A página mostra "sem dado (ausência, não zero)", que é a regra para nulo; dizer "não se aplica" exigiria o pipeline marcar a rubrica como inexistente no ano.
- Arredondamento (D3): as medianas que a página calcula (mesmo conjunto, janelas comuns) arredondam meio para cima sobre o decimal; o gold arredonda empates exatos pelo valor binário e difere R$ 0,01 em 23 de cerca de 190 meses da mediana mensal, só em empates. Os testes aceitam a diferença apenas nos empates.
- Versão do código com `+alterado` no gold (D4).
- Ressalvas do gold (`validacao.ressalvas`, 19) aparecem em Auditar como o pipeline escreveu, com números em formato inglês (-47.55) e nome de componente (`TE_CFURH`).
- A reclassificação de valores negativos de CFURH, de encargos para créditos, é inferência do pipeline (PRORET 7.1 não lido, acesso bloqueado). Segundo a avaliação técnica, os encargos ficam em 20,6% da tarifa média com a regra e em 18,7% sem ela. A página diz, na distribuidora em destaque, o que foi reclassificado e que os grupos são classificação do observatório; não mostra as duas leituras do agregado, que a avaliação sugeriu mostrar até o PRORET ser lido.
- Regras do simulador (desconto de classe, custo de disponibilidade, aplicação por parcela): sem texto oficial conferido, porque a REN 1.000/2021 respondeu 403 na captura. O cartão do resultado diz "regra parcialmente conferida". A tarifa Rural é igual à Residencial em 81 de 81 distribuidoras na fonte, e o desconto rural não está incluído no cálculo.
- Bandeira do simulador: set/2026 (amarela), a última acionada no arquivo. A de out/2026 pode ter sido publicada depois da captura de 30/09/2026.
- A ligação município e distribuidora vem de `territorio_municipios.csv` (relação oficial da ANEEL, com vínculo confirmado, só de geração distribuída ou sem confirmação); o texto do resultado diz quando o vínculo não está confirmado.
- Não feitos: exportar a memória de cálculo do simulador em CSV; ampliar o glossário curto (só três termos com link).

## 8. Anexo: onde cada visão do inventário (`visoes_antes.json`) ficou

Nenhuma visão foi removida. Nível: E é Entender, A é Analisar, U é Auditar.

Rota `/setor-eletrico/conta-de-luz`:

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel p047, "Quanto custa um perfil comparável em cada distribuidora?" | Abertura "Quanto custa o mesmo consumo?" (resposta e faixa de métricas) e painel "O mesmo consumo, da menor à maior tarifa" | E |
| Gráfico p047, barras do custo de 200 kWh com a mediana | Faixa de pontos das 81 (mediana, quartis, extremos e escolhidas) e ranking "Todas as distribuidoras, da mais barata à mais cara" (botão "Mostrar todas as 81") | E |
| Tabela p047, 81 linhas, CSV e XLSX, busca | Tabela do ranking, com UF, tipo e UCs, abaixo do ranking | A |
| Dados do gráfico em tabela (81 linhas) | Mesmo recolhível, no ranking | E |
| Dados do gráfico em tabela (191 linhas) e gráfico de linhas do histórico | "Como a tarifa de cada distribuidora evoluiu diante da mediana?"; a mediana nominal e em reais ganhou a versão "Como a mediana mudou desde nov/2010, com e sem a inflação?" | A (histórico), E (mediana) |
| Controles do histórico: distribuidoras (até 4), início e fim | Mesmo bloco, com "Ajustar início e fim" | A |
| Controles p047: perfil, leitura do ranking | Seletor de perfil junto à resposta; leitura (custo ou tarifa) no ranking | E |
| Controle de distribuidora | "Distribuidora em destaque", busca por município, filtros de tipo e UF e "Selecionadas" com "Limpar" | E |
| Painel p048 e gráfico de composição | "Para onde vai o valor da conta?": média, mediana e distribuidora em destaque, com a série "Arredondamento das partes" | E |
| Dados do gráfico em tabela (4 linhas) e controle de unidade (R$/MWh ou %) | Mesmos, junto ao gráfico; a composição das 80 abre sob demanda | E |
| Atípicas e conferências da composição | "Componentes de cada grupo, valores atípicos e conferências" | U |
| Painel p049 e controles (classe, consumo em número e em deslizante, ligação, bandeira) | "Como a minha conta varia com o consumo e o perfil?" com os mesmos controles; Rural e Demais mostram a tarifa usada | E |
| Gráfico de linhas p049 e Dados do gráfico em tabela (51 linhas) | Estimativa por consumo com marco do consumo escolhido, e o mesmo recolhível | E |
| Normas e casos de referência do simulador | "Normas conferidas e casos de referência" (100 casos sob demanda) | U |
| Resumo "O que mudou e quem financia os benefícios?" | Mesmo título, três respostas e link para a página filha | E |
| Três fichas "Comprove este número" | Ficha em cada número (tarifa mediana, exemplo de encargos e simulador), com procedimento externo | E |
| Baixar CSV (p047, p048, p049) | "Baixar os dados (4 arquivos)" | E |
| Validação, tarifa média avaliada e arquivos (12 downloads) | "Validação, tarifa média avaliada e arquivos": regras conferidas, 19 ressalvas, documentos oficiais e arquivos para download | U |
| Quem ficou fora do ranking | "Quem ficou fora do ranking e por quê" (34 linhas sob demanda) | U |
| Nível de profundidade | `ModoProfundidade` do sistema | todos |

Rota `/setor-eletrico/conta-de-luz/reajustes-e-subsidios`:

| Visão anterior | Nova localização | Nível |
| --- | --- | --- |
| Painel "A tarifa subiu mais que a inflação?" e janela de 12, 60 e 120 meses | Mesmo título; o cartão da mediana e a faixa de pontos de 102 seguem a janela | E |
| Gráfico de barras de 31/08/2025 a 31/08/2026 com IPCA e mediana | Ranking "Mostrar todas as 102" com as mesmas referências | E |
| Dados do gráfico em tabela (102 linhas) | Mesmo recolhível e "Mostrar a tabela da janela com a variação real" | E |
| Última mudança de cada distribuidora | "Mostrar a última mudança de cada distribuidora" (81, sob demanda) | A |
| Incorporações e conferência do IPCA | "Incorporações e conferência do IPCA" | U |
| Painel de bandeiras | "Quando a bandeira encareceu a conta?" com a grade por mês e ano; tabela mês a mês sob demanda e adicionais por resolução em A; conferência do acionamento em U | E, A, U |
| Painel de subsídios e CDE, dois gráficos e suas tabelas de 14 linhas | "Quem financia os descontos e benefícios da conta?": subsídios por categoria e orçamento da CDE, com alternância nominal e em reais, mais as quotas ano a ano | E |
| Tabela do orçamento da CDE por ano e subsídios por distribuidora | "Mostrar a tabela do orçamento da CDE por ano" (E, sob demanda) e "Mostrar os subsídios por distribuidora" (105, A) | E, A |
| Conferências dos subsídios e do orçamento | "Conferências dos subsídios e do orçamento da CDE" | U |
| Baixar CSV (reajustes, bandeiras, subsídios) e quatro fichas "Comprove" | "Baixar os dados" (3 e 2 arquivos) e uma ficha por número, com ficha só na janela de 12 meses | E |
| Nível de profundidade | `ModoProfundidade` do sistema | todos |


## 9. Rodada 2 (CORRECOES_U09.md): o que foi feito e o que fica pendente

Retomada após o limite de uso: o usuário pediu para concluir sem exigir nota 9. Estado de cada item, com o que depende de outro dono.

**Bloqueio (reajustes e subsídios): corrigido.** Com "Em reais" escolhido, o número de destaque, a frase de abertura e a resposta completa, o "o que mudou", a frase da CDE, a frase das quotas, a frase das categorias que caem a zero, o texto da unidade e as duas tabelas de dinheiro (orçamento da CDE por ano e subsídios por distribuidora, com título e nome de arquivo) falam em reais de ago/2026 (cada ano pelo seu fator), com o nominal dito ao lado. No modo nominal, tudo diz "nominais, na moeda da época". A ficha "Comprove este número" prova o valor nominal: em reais o número diz isso e manda escolher Nominais. Os arquivos para baixar trazem valores nominais, e o painel diz. Testes: `src/tests/energia-conta-reais.test.ts` renderiza a página inteira com o gancho da URL trocado por `?valores=real` (falharia com a página de antes, em que o número, a frase e o "o que mudou" não liam a escolha) e `energia-conta.test.ts` confere cada valor contra o gráfico, pela mesma conta feita por outro caminho.

| Item | Estado |
| --- | --- |
| Principal J: tabela de 81 linhas abria sozinha ao escolher distribuidora | Corrigido: `ContaSobDemanda` com `abreEm="analisar"`; em Entender só abre por pedido |
| Principal J: aba da página irmã ausente | Corrigido: `Navegacao` também na principal |
| Principal J e C: 34 fora do ranking só em Auditar, fora do seletor | Corrigido: linha em Entender com contagem e motivo (22 encerradas em 29/09/2026, 11 incorporadas, 1 sem tarifa há mais de 90 dias), seletor com as 23 que têm tarifa anterior, motivo e custo pela última tarifa |
| Principal F e G: universo incompleto, sem regra de completude | Corrigido: rótulo "entre as 81 com tarifa vigente", cobertura em distribuidoras (78,6%) e em UCs (99,76%, piso de 99% de Qualidade), o que muda nos extremos com a última tarifa das 22 (menor seria CODESAM, R$ 106,83); abaixo do piso a nota vira aviso (testado com dados sintéticos) |
| Principal F: régua que ordena | Corrigido: o ranking diz que ordena pela tarifa de aplicação, a base econômica vai na tabela (posição pela base e diferença) e na dica dos 15 pontos que diferem mais de 20%, marcados com † |
| Principal F: UCs de menor e maior; mediana sem peso | Corrigido: UCs ao lado do menor e do maior; mediana ponderada pelas UCs ao lado da simples |
| Principal I: três tracejados iguais em TE e TUSD; mediana das 81 com filtro | Corrigido localmente: uma linha só ("Mediana das 81", "todas" com filtro); quartis na faixa de pontos e na tabela. Pedido ao GraficoBarras abaixo |
| Principal I: legenda da composição lista o arredondamento como componente | Corrigido: "Ajuste de arredondamento (não é componente)" |
| Principal A e K: sombra branca em contêiner que não rola | Corrigido: `ContaRolavel` liga a sombra só quando rola |
| Principal K: rótulo truncado do seletor do simulador | Corrigido: "· referência", com a explicação sob o campo |
| Principal B: abertura não diz por que importa | Corrigido: razão no lead e linha `limite` à vista (kWh, TE e TUSD expandidos no lead) |
| Principal A e B: aviso repetido, blocos de três colunas, Entender de 3.950 palavras, REH, B1 e fio B sem definição | Pendente: o aviso saiu da nota da faixa (ficou no limite); os blocos de três colunas e as definições de REH, B1, fio B e "crédito lançado em componente de custo" não foram tratados |
| Principal G: regras da Tarifa Social e do Desconto Social não conferidas; CFURH | Pendente: texto da REN indisponível (403); sensibilidade da CFURH (20,6% contra 18,7%) não mostrada |
| Principal G: "tarifa média de 80" contra "tarifa média de fornecimento" | Pendente |
| Principal D: desigualdade entre regiões e peso na renda | Pendente: exige dado de renda que a gold não traz |
| Principal C: ranking só da classe B1 | Pendente: as demais classes existem só no simulador |
| Principal L: peso | Parcial: medida de markup mais props caiu de 443 KB para 380 KB (principal) e de 392 KB para 348 KB (reajustes), cerca de 590 KB e 550 KB servidos pelo fator de 1,54 a 1,59; o HTML servido não foi medido depois (servidor fora do ar); tetos do teste baixados para 395 KB e 365 KB e comentário falso corrigido |
| Filha J: ficha nas janelas de 60 e 120 meses | Pendente de pipeline (pedido abaixo); a página diz que só a de 12 meses tem ficha |
| Filha C: data e percentual da última mudança no Entender | Corrigido: linha por distribuidora escolhida (data, ato, variação com o verbo, IPCA desde a anterior) |
| Filha C, I e K: adicional de cada mês da grade só em texto oculto; células não focáveis | Corrigido: `ContaGradeDica` (mouse, foco, toque e setas, uma parada de tabulação, dica no `title` e em linha de estado) |
| Filha E e D: bandeira sem o efeito em reais; ligação com 150 ou 200 kWh | Corrigido: tabela do que cada bandeira acrescenta à conta de 100, 200 e 300 kWh (antes de tributos) |
| Filha I: IPCA e mediana com o mesmo traço | Corrigido localmente: o ranking de variações fica só com a linha do IPCA; a mediana está na faixa de pontos, no cartão da janela e na tabela |
| Filha F: quotas de 2026 comparadas com anos fechados sem ressalva no cartão | Corrigido: o cartão diz que é orçamento, que os anos antes também são, e que as receitas de 2026 ainda têm rubricas sem valor ou em zero |
| Filha G e L: Rural e Água zeram sem explicação; sem controle | Corrigido: `categoriasQueZeraram` acha as duas nos dados (desde 2024), a frase diz que a fonte não explica e que o observatório não confirmou a causa; testado com séries sintéticas |
| Filha E: sem série anual de reajuste contra a inflação | Pendente |
| Filha A: caixa do efeito médio antes do gráfico; lista de barras abre pelas menores variações | Pendente |
| Filha G: tabela de adicionais sem 10 de 141 meses | Pendente: dito em Auditar |
| Filha B, A, K: siglas e termos sem definição no ponto de uso, blocos repetidos, textos de 12 px | Pendente (parcial: o lead passou a expandir CDE) |
| H e L, as duas páginas: bruto sem publicação, código com alterações, revisões, reconciliação por títulos de notícia, só laboratório | Pendente de pipeline ou de outro dono |

Novos pedidos a componente compartilhado:

- `GraficoBarras`: estilo e rótulo por linha de referência (cheia, tracejada, pontilhada, com o nome no eixo). Hoje todas saem iguais, e o ranking mostra uma linha por gráfico para não confundir.
- `TabelaInterativa`: coluna do nome fixa em tabela larga (19 colunas, mais de 2.000 px em 390), e opção para não abrir sozinha quando a seleção vem de fora (a família a põe atrás de `ContaSobDemanda`).
- `globals.css`, `.dominio-energia div.tabela-scroll`: as faixas brancas da sombra aparecem sobre o fundo bege quando nada rola; a família usa `ContaRolavel`.
- `FaixaMetricas`: a nota fica em 12 px; a família passa um parágrafo de 14 px por dentro.

Pedidos ao pipeline (a página já diz o que falta):

- Tarifa seguinte das 22 distribuidoras com a vigência encerrada em 29/09/2026: recapturar e regerar a gold quando a ANEEL publicar os atos; hoje o ranking tem 81 de 103.
- Ficha "Comprove este número" para as janelas de 60 e 120 meses, para o menor, a mediana e o maior do perfil, e para o agregado de encargos.
- Rural e Água, esgoto e saneamento em quase zero desde 2024: nota regulatória ou estado da rubrica na fonte; SCEE e Lei 14.299/2022 nulos de 2013 a 2019 marcados como "não se aplica".
- Efeito médio de cada processo tarifário (a fonte recusou a captura); código sem `+alterado`; histórico de revisões (uma captura só); publicação do bruto identificado por sha256.

Equivalências novas: `docs/energia/redesign/pedidos/conta-de-luz.equivalencias.json`.
