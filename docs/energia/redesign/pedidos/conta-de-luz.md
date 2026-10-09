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
- `TabelaInterativa`: a tabela do ranking (17 colunas, 25 linhas por página) pesa 33 kB no HTML da principal, mesmo no nível Entender, em que fica oculta. É uma escolha local (`ContaTarifas.tsx`, seleção sincronizada com o gráfico): pode virar sob demanda com `ContaSobDemanda`, ao custo de um clique a mais no Analisar. Não foi feito, porque quem escolhe Analisar espera a tabela já aberta.
- Decisões de produto, se a meta de 600 kB valer para as duas páginas, medidas sobre o HTML de hoje: ranking de barras sob demanda (um clique, como as tabelas), já que a faixa de pontos mostra todas as distribuidoras, tira 65,7 kB da principal e 82,8 kB da filha; com a tabela do ranking também sob demanda, a principal fica em torno de 582 kB e a filha em torno de 539 kB. Sem essas duas decisões, as páginas ficam em 681 kB e 622 kB (medida de 09/10/2026, depois das mudanças compartilhadas do último commit do coordenador).

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
