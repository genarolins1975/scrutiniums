# Pedidos da família Geração (rotas /setor-eletrico/geracao, /geracao/termica, /geracao/restricoes e /geracao/capacidade)

Registro dos pedidos ao coordenador: arquivo sem uso (para apagar no fim, com o servidor parado), mudanças em componentes ou textos compartilhados, pedidos de dado e de pipeline, equivalências para a matriz de preservação e o que ficou fora do meu escopo. Nenhum pedido bloqueia a família: cada página segue com a melhor solução local, descrita no item. As avaliações independentes U04 (produto e técnica) foram tratadas dentro da família; o que depende de componente compartilhado, de dado ou de pipeline está nos itens 7 e 8.

## 0. Arquivo sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/GeracaoLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, por meio de `GeracaoSeguir` (em `GeracaoPagina.tsx`), com o mesmo botão "Copiar link deste painel". Nenhum teste nem documento o cita.
- `docs/observatorios/energia/modulos/geracao.md` não cita componentes, mas a lista "Aberto" (abertura sem verbo, comparação de 30 e 365 dias sem aviso de sazonalidade, quantis no Entender de Capacidade, título de Restrições com padrão só eólico, termos da térmica sem definição, rótulos de natureza) descreve a interface anterior. A migração tratou cada um (abertura com pergunta e resposta na primeira tela; aviso de sazonalidade sob a comparação de janelas; só a mediana marcada no histograma de Capacidade; Restrições com a faixa das duas fontes; lista visível do que cada motivo de despacho quer dizer; selo de natureza com texto "pelo ONS, não medição"). Vale atualizar o documento quando o coordenador fechar o módulo.

Arquivos novos da família (não substituem nenhum): `GeracaoBarrasFontes.tsx` (barras por fonte) e `GeracaoSerieRecente.tsx` (séries diária e horária lidas sob demanda).

## 1. Texto de outros arquivos que ainda traz a pergunta anterior da abertura

A abertura passou a se chamar "De onde vem a eletricidade?", a pergunta da tela 05 da galeria. É também a pergunta de P021 no registro dos painéis (`PAINEIS_GERACAO`, em `src/lib/energia/geracao.ts`), usada no título da página, na descrição da faixa de páginas e no link "Próxima pergunta" das outras páginas. O painel da abertura ganhou título descritivo ("Participação de cada fonte na geração"), como o de Água e clima. Dois textos de outros arquivos trazem a pergunta anterior:

- `src/lib/energia/navegacao.ts`, linha 111: a pergunta do módulo no menu é "De onde vem a eletricidade e quais fontes estão sendo usadas?". Sugestão: "De onde vem a eletricidade?".
- `src/lib/energia/transicao.ts`, linha 209 (`LIGACAO_GERACAO.pergunta`: "Quais fontes atenderam a carga?"), usada como texto do link para a Geração em `transicao/page.tsx` (linha 56) e em `transicao/emissoes/page.tsx` (linha 481). Sugestão: "De onde vem a eletricidade?" (o teste de Transição só confere o `href`).

## 2. Bloco "Período, universo e unidade" repetido em cada família

`GeracaoRecorte` (em `GeracaoControles.tsx`) escreve o mesmo `dl` de `data-recorte-painel` que outras famílias escrevem com componentes locais. Concordo com o pedido da família Perdas (item 4 de `perdas.md`): um `RecortePainel` compartilhado com `periodo`, `universo` e `unidade`. Quando existir, trocar `GeracaoRecorte` por ele.

## 3. Marca que distingue medição, estimativa e previsão nas barras

`GraficoBarras` desenha toda barra com a mesma marca. A direção da tela 05 pede que a MMGD (estimativa do ONS) e as térmicas Tipo III (previsão do ONS) se distingam da medição na própria barra, por forma e por texto, não só por cor. Local: `src/components/energia/GeracaoBarrasFontes.tsx` (`BarrasPorFonte`: lista de linhas com nome, barra e valor; medição em barra cheia, estimativa e previsão em barra vazada com contorno tracejado, o `SeloNatureza` e o texto "pelo ONS, não medição" ao lado do nome; marca "cobertura da fonte alterada"; eixo com zero; setas, Home e End percorrem as barras; um único tab stop; vira lista de leitura sem `onSelecionar`). Proposta: uma propriedade opcional por categoria em `GraficoBarras` (por exemplo `natureza` em cada linha de dados, com preenchimento vazado e contorno tracejado) para que as outras famílias com dado estimado ou previsto (Carga, Rede, Transição) não precisem de um componente próprio.

O gráfico mensal empilhado de 11 categorias (`GeracaoMatriz.tsx`, `GraficoBarras` com `empilhado`) ainda distingue as séries só por cor e legenda. A avaliação de produto (U04) simulou daltonismo e achou pares quase iguais (Solar MMGD e gás natural, óleo e biomassa, biomassa e outras térmicas). Local: as térmicas pequenas vêm somadas em "Demais térmicas" por padrão (menos camadas finas de cor parecida) e a legenda traz o nome de cada série. Proposta: propriedade opcional `padrao` (hachura) por série em `GraficoBarras` empilhado e em `GraficoLinhas`.

## 4. Primeira tela das filhas: altura do cabeçalho

Nas três filhas, o título e a faixa de métricas deixam o começo da figura principal abaixo de y=760 em 1440 por 900 (a abertura, sem a faixa de navegação local, fica mais acima; valores medidos no item 10). Duas linhas do `CabecalhoModulo` custam altura que poderia voltar à figura:

- o `h1` quebra em duas linhas a partir de nove palavras ("Quanto as térmicas geraram e por que foram acionadas?"), por causa do `max-w` do título; com uma largura um pouco maior caberia em uma linha (cerca de 48 px);
- `recorte` e `fonte` ficam em linhas separadas quando somam mais de cerca de 190 caracteres (cerca de 34 px). Alternativa: a linha "Fontes, datas e siglas" ao lado do `recorte`, e a `fonte` na linha seguinte só quando não couber.

Local: encurtei o `recorte` da capacidade e a nota da faixa de restrições e de térmica; as duas figuras da capacidade ficam à direita da resposta curta a partir de 1280 px, e o título da primeira passou a caber numa linha para que as barras das duas figuras fiquem alinhadas linha com linha.

## 5. `Numero variante="faixa"` com unidade longa quebra a linha da medida

Quando a unidade de uma taxa vem da evidência ("% da geração possível estimada"), ela quebra em duas linhas e a faixa fica 38 px mais alta que as vizinhas. Resolvi passando `unidade="da geração possível"` (o selo "Estimado" e a nota da faixa já dizem que é estimativa). Proposta: o `Numero` aceitar uma unidade curta ou quebrar a unidade abaixo do valor só quando faltar espaço, sem puxar as medidas vizinhas.

## 6. Achados de conteúdo e de dado, vistos e não corrigidos

Nada abaixo foi corrigido em silêncio: cada item está dito na própria página, ao lado do dado, e nenhum cálculo existente de `geracao.ts` ou de `geracao-tabelas.ts` mudou (as duas bibliotecas só ganharam seletores, textos e a tradução de vocabulário descrita no item 8).

Composição e matriz (`/geracao`):

- `natureza_pct` (medição, previsão Tipo III, estimativa da MMGD) só existe para o perímetro com a MMGD. No perímetro sem MMGD a barra de natureza continua no perímetro com MMGD, e o título diz isso.
- A gold só traz evidência ("Comprove este número") para o total de 30 dias, a MMGD, a eólica e o gás. A participação da fonte principal na faixa (hidráulica) é lida do mesmo seletor do gráfico, mas fica sem ficha de prova.
- A soma exibida das 11 participações é 100,01% na janela de 30 dias do SIN e 99,99% na de 365 dias: dentro da tolerância de 0,05 ponto do controle publicado, dita na página (diferença de arredondamento de duas casas, não de dado).
- Biomassa, óleo e outras térmicas têm cobertura reduzida na fonte (biomassa com 17 identificadores com valor em ago/2026 contra 63 em ago/2025): saem da comparação entre janelas e da variação de 365 dias, com o motivo dito e um bloco "Fora da comparação"; a participação delas continua publicada na composição completa, com a ressalva.
- A MMGD estimada entra em abr/2023 por 2 dos 30 dias e em 2023 cobre 247 dos 365 dias; 2021 e 2022 não têm estimativa. A média anual publicada (`mwmed.solar_mmgd`) é a contribuição ao ano inteiro; a tabela anual agora traz os dias com estimativa, a presença da MMGD no ano, a contribuição à média anual e a média dos dias com estimativa (3.875,8 MWmed em 2023, calculada na página como média do ano × dias do ano ÷ dias com estimativa; a avaliação técnica refez 3.875,7, diferença de 0,1 que vem do arredondamento da média publicada).
- A matriz horária publicada tem 8.760 linhas (365 dias) e a gold ainda rotula "últimos 366 dias" (pedido no item 8).
- Reconciliação com o Balanço: os dias conciliados são 49,8% na térmica e 78,5% na solar (Auditar mostra as tabelas); por isso o texto da gold "igual ao do Balanço" passou a "próximo ao do Balanço, com divergências listadas em Auditar" (item 8).

Térmica (`/geracao/termica`):

- Parcelas com CVU 0,00: 11 de 101 (óleo 8 de 23, gás 2 de 52, outras 1 de 1). Ficam como publicadas, nunca como ausência; a comparação avisa quando uma usina escolhida tem CVU 0 e a mediana por combustível não os retira.
- O universo pareado entre a térmica por motivo e a Geração por Usina cresce de 88 para 98 usinas (cobertura de 96,8% para 99,7%) ao longo da série; a nota "crescimento do universo" diz que a variação mensal mistura mudança de geração com entrada de usinas.
- O total da térmica por motivo (8.033 MWmed, 12 meses completos, térmicas despachadas pelo ONS com a nuclear) difere do da matriz efetiva (8.587 MWmed, 365 dias, categorias térmicas da Geração por Usina sem as térmicas Tipo III). A nota do painel diz a diferença de período e de universo e liga à composição da abertura; os dois totais não são somados nem confrontados como se fossem um só.
- O "não classificado" (total verificado menos a soma dos motivos, com sinal, como a fonte publica) fica fora das barras e dentro da tabela, com nota visível. O método do combustível (CEG da usina até 2025; campo do próprio conjunto desde 2026, e os 12 meses misturam os dois) também está em nota visível.
- Dias em que o Balanço registra a eólica de um subsistema abaixo de 10% da soma das usinas: 16/01/2026 (Nordeste), 07/03/2026 e 09/05/2026 (Nordeste e Sul), de `reconciliacao_balanco.maiores_divergencias`. As janelas de 7 dias que os incluem usam esse Balanço e podem ter a participação térmica distorcida; a página lista os dias junto da faixa usual e remete a Auditar. A faixa usual sem esses dias não foi recalculada (cálculo novo, fora do escopo de seletores) e o percentil 22,4 que a avaliação refez sem eles não foi reproduzido.

Restrições (`/geracao/restricoes`):

- Ressarcimento por restrição: o texto cita a norma lida (REN ANEEL nº 1.030/2022, em cópia de 08/01/2025). Alterações posteriores indicadas em fontes secundárias (Lei 15.269/2025 e Portaria Normativa MME 140/2026) não foram verificadas aqui e o texto diz isso.
- A taxa de restrição é estimativa do ONS (energia não gerada estimada sobre geração verificada mais a não gerada estimada), e a nota da faixa diz isso.
- Eólica e fotovoltaica não são o mesmo universo nem o mesmo período (usinas e conjuntos, início da série): a nota sob a resposta traz os dois e avisa que as duas taxas não se comparam como se fossem do mesmo conjunto.
- Base pequena: a tabela por subsistema avisa quando um subsistema tem poucas usinas.

Capacidade (`/geracao/capacidade`):

- ANEEL e ONS medem universos diferentes (biomassa: 18.050,9 MW cadastrados na ANEEL contra 4.211,9 MW no retrato do ONS; outras fontes: 166,0 MW contra 2.184,8 MW). A página mostra os dois lado a lado, sem somar nem comparar usina a usina, e a coluna "ONS como parcela da ANEEL" não é fator de capacidade.
- Cobertura parcial da potência: a biomassa tem fator de capacidade só para 1.794,2 MW dos 4.290,4 MW (41,8%); a nota fica junto do gráfico.
- Fator de capacidade acima de 100% aparece em 228 usina-meses (a tabela de extremos de Auditar lista os maiores); mantido como publicado, com a nota junto do gráfico mensal.
- Categorias com menos de 10 usinas ou conjuntos (nuclear, por exemplo) mostram uma barra por usina, sem mediana nem quartis: com poucas observações, a distribuição e os quantis enganam.

## 7. Mudanças compartilhadas pedidas depois das avaliações U04

Todas têm solução local, descrita em cada item; nenhuma bloqueia.

1. Selo "misto" em `Natureza` (`src/lib/energia/tipos.ts`, linha 8: OBSERVADO, CALCULADO, ESTIMADO, PREVISTO, CENARIO). O total do SIN com a MMGD soma medição, previsão e estimativa e hoje usa CALCULADO na faixa, com a composição dita na seção "Quanto da energia é medição, previsão ou estimativa?" ("soma três naturezas"). Proposta: um valor MISTO no tipo e no `SeloNatureza`, com o texto "medição, previsão e estimativa".
2. Descrição de coluna no dicionário do arquivo exportado. O dicionário do XLSX (`tabela.ts`, "Dicionário de colunas") traz só tipo, unidade e casas. Proposta: `descricao?: string` em `ColunaTabela`, que entra no dicionário e no cabeçalho de leitor de tela. Local: rótulos longos e descritivos nas colunas novas (por exemplo "MMGD estimada, média dos dias com estimativa").
3. `Histograma` com `marcadores={["mediana"]}`: o resumo em texto continua listando P10 a P90. Proposta: o resumo seguir os marcadores pedidos. Local: a frase de quartis da capacidade vem escrita ao lado e não cita a mediana como quantil; o teste exige só "Quantis (Mediana)".
4. Duas portas para a mesma tabela (`GraficoBarras`, `GraficoLinhas` e a `TabelaInterativa` da página): "Dados do gráfico em tabela (N linhas)" e "Ver a tabela completa (N linhas)", com precisão e colunas diferentes. Proposta: uma só porta, a tabela interativa, e a tabela do gráfico escondida (como Água e clima já faz com CSS).
5. Hachura ou padrão por série (item 3 acima).
6. "Sobre este dado" de Restrições descreve sempre as eólicas (10/2021 a 08/2026), mesmo com Fotovoltaicas escolhida no controle Fonte; a ficha das fotovoltaicas vem por um chip separado ("Restrições das fotovoltaicas"). O painel é um componente de servidor e o controle vive na URL, no cliente. Proposta: `PainelEvidencia` aceitar a proveniência por valor do controle e trocar o chip principal, ou rotular os dois chips pela fonte.
7. Verbetes de Aprenda para termos que a Geração usa com glosa local: despacho, ordem de mérito, inflexibilidade, razão elétrica, constrained-off, fator de capacidade e CVU. Local: lista visível do que cada motivo de despacho quer dizer (`GLOSA_MOTIVO`, em `geracao.ts`) e `Termo` nos demais.
8. Recorte por subsistema e por UF em Capacidade e Térmica. A gold publica a capacidade (por categoria) e a térmica por motivo e por combustível agregadas no SIN; só a matriz tem subsistemas (com as janelas de 30 e 365 dias) e só as restrições têm subsistema e UF. Local: as duas páginas dizem que o recorte é o SIN e não oferecem filtro que a base não sustenta. Pedido de dado no item 8.
9. Marcas do mapa de usinas sem foco individual (a lista das 10 maiores ao lado cumpre o teclado: um tab stop, setas, Home e End, e o foco na lista mostra a dica no mapa). Agrupar marcas sobrepostas pediria um componente de mapa novo; fica como proposta.
10. `CabecalhoModulo`: o bloco de fonte e datas ocupa linha própria (item 4).
11. Deslocamento de layout (CLS) medido pelos avaliadores: vem de componentes compartilhados e não foi tratado aqui. Nas páginas da família, as séries diária e horária lidas sob demanda reservam 16 rem de altura antes de chegar o dado.
12. `Termo`: a sigla com link para Aprenda (por exemplo "ESS" em Restrições) tem alvo de toque de 26 por 17 px dentro da frase. Passa pela exceção de links em linha (WCAG 2.5.8), mas é pequeno no celular em frase densa. Proposta: `padding` vertical do link no toque, sem mexer na altura da linha.

## 8. Pedidos ao pipeline e à gold

- Rótulo do arquivo horário: o CSV `geracao_matriz_horaria_12m.csv` tem 8.760 linhas (365 dias) e o `downloads[].rotulo` da gold diz "últimos 366 dias". `downloadsDoPainel` troca o texto na exibição (teste no arquivo da família). Corrigir na origem.
- Vocabulário interno em textos publicados pela gold que o leitor vê em Analisar e Auditar: `id_ons`, `ressalvas_universo`, `natureza_pct`, `natureza_mensal_sin`, `outros_por_ceg`, `matriz.universo`, `'quebras'`, `ons_pct_da_aneel`, `mwh_dos_ausentes_mesmo_mes_ano_anterior`, ids de categoria sem acento (`hidraulica`, `termica`, `eolica`) e a frase "igual ao do Balanço" (a reconciliação mostra 49,8% dos dias conciliados na térmica e 78,5% na solar). A página traduz na exibição por `emPortugues` (`geracao.ts`, com teste); a redação final deve vir da gold.
- Nomes das colunas do ONS (`val_verifinflexibilidade` e as demais) em texto de gold: na página só aparecem no dicionário de colunas dos motivos, em Auditar. As fórmulas das fichas "Comprove este número" (`Σ val_verifinflexibilidade ÷ Σ val_verifgeracao × 100`) seguem com os nomes das colunas, por serem a trilha de auditoria.
- Fichas "Comprove": algumas mostram "recurso não identificado" e ficam sem citação; o texto vem da gold. Pedido: nome do recurso e citação no `evidencias`.
- Perfil por hora do dia da restrição: a gold não o publica. Local: gráficos diário e mensal do corte, sem perfil horário.
- Maior corte simultâneo por dia: os gráficos (diário e mensal) e a tabela mensal trazem o valor, e o CSV diário tem a coluna `potencia_max_cortada_mw` por região, razão e origem. Pedido: confirmar se essa coluna é o corte simultâneo que a página rotula ("numa meia hora") e, se for, dar a ela esse nome no cabeçalho; se não for, publicar a série do corte simultâneo.
- Faixa usual da térmica sem os dias em que o Balanço difere das usinas: pedir à gold a coluna de dias conciliados na série de participação térmica de 7 dias.
- Recorte por subsistema e UF em Capacidade e Térmica (item 7.8) e série mensal por subsistema na matriz: a gold publica os subsistemas só nas janelas de 30 e 365 dias, e o gráfico mensal de 11 categorias é do SIN (a página diz isso e não oferece a série por subsistema).
- Descrição de coluna: os CSV estáticos de `public/energia/series` não trazem unidade nem descrição no cabeçalho, e o XLSX das tabelas tem dicionário só com tipo, unidade e casas (item 7.2).

## 9. Equivalências para a matriz de preservação

Conferência mecânica: `scripts/energia-visoes.mjs` nas quatro rotas (1440 px, três níveis) contra o inventário anterior das mesmas rotas (`dados/visoes_antes.json`) e `scripts/energia_visoes_compara.py`. Sem equivalência manual, o comparador casa 90 de 94 visões anteriores (painéis, gráficos, tabelas, resumos em tabela, mapas) e deixa 4 a justificar. Com as 11 equivalências abaixo: **94 de 94 casadas, 0 a justificar**, também com a versão do comparador que confere controles, opções, arquivos e fichas por nível (rodada de 09/10/2026, depois do commit d9c63150c). Contagens: controles 19 para 20 (abertura), 8 para 8 (capacidade), 5 para 5 (restrições), 9 para 12 (térmica); arquivos para baixar 5, 3, 2 e 3, iguais; fichas "Comprove este número" 4 para 4, 3 para 3, 2 para 4 e 2 para 2, nos três níveis. Visões novas, que não contam como perda: 16, 6, 8 e 9. As quatro linhas de "Dados do gráfico em tabela (N linhas)" que mudaram de contagem são o mesmo resumo de cada gráfico (o do gráfico de 30 contra 365 dias passou de 11 para 8 linhas, ver a primeira equivalência).

Onde está cada visão agora (id da seção na própria rota e nível):

- `/setor-eletrico/geracao`. Entender: `p021` (cinco maiores fontes e controles Região, Janela e Perímetro), `composicao` (composição completa de 11 categorias e a tabela equivalente de 11 linhas; antes o gráfico de 30 contra 365 dias fazia as duas coisas), `natureza` (medição, previsão e estimativa; a série mensal por natureza subiu de Analisar), `janelas` (30 contra 365 dias só das 8 categorias comparáveis, "Fora da comparação" e o aviso de sazonalidade), `doze-meses` (365 dias contra os 365 anteriores; subiu de Analisar), `historico-mensal` (gráfico mensal de 11 categorias e a tabela de 41 linhas). Analisar: `comparar-categorias` (comparador até 4 categorias, gráfico e tabela mensais da categoria), `recentes` (diária de 60 dias e horária de 72 horas, lidas sob demanda), `anos` (participação anual sem a MMGD e a MMGD à parte), `a11` (quebra de 29/04/2023). Auditar: `reconciliacao`, `universo`, `controles`, com as mesmas tabelas e filtros.
- `/setor-eletrico/geracao/capacidade`. Entender: `p024` (potência em operação e fator de capacidade por fonte, mais a tabela de 9 linhas), `distribuicao` (fator de capacidade entre usinas, com mediana marcada, e a tabela de menores e maiores), `capacidade-mensal` (fator e potência mês a mês, com o controle de categoria e de período). Analisar: `contexto-capacidade` (ANEEL e ONS, fator do painel e do ONS, MMGD). Auditar: `pareamento`, `regras-capacidade`.
- `/setor-eletrico/geracao/restricoes`. Entender: `p023` (energia não gerada por razão, com o controle Fonte), `taxa-e-corte` (taxa e maior corte simultâneo), `mapa-usinas` (mapa, lista das 10 maiores e a tabela de usinas, com a vista Usinas ou Brasil na URL). Analisar: `analise-restricoes` (dia e razão, razão e origem, subsistemas, detalhamento do ONS, maior corte por dia, filtros de subsistema, UF, razão e origem da coordenada). Auditar: `auditoria-eolica`, `auditoria-solar`, `regras-restricao`.
- `/setor-eletrico/geracao/termica`. Entender: `p022` (combustível e motivo, com a definição de cada motivo), `motivos-mensal` (série mensal por motivo), `termica` (participação térmica em janelas de 7 dias; as âncoras antigas `#termica` e `#termica-ctx` da abertura seguem por redirecionamento), `usinas` (as 10 e as 40 usinas, e a comparação de motivos aberta com 3 usinas). Analisar: `combustiveis-mensal` (comparador de combustíveis), `cvu` (CVU por combustível e por usina). Auditar: `universo-termica`, `regras-termica`.

Para `docs/energia/redesign/equivalencias.json`:

```json
{
  "/setor-eletrico/geracao": [
    {
      "antes": "painel|quais fontes atenderam a carga?",
      "depois": "painel|participação de cada fonte na geração",
      "justificativa": "A pergunta virou o título da página (H1 \"De onde vem a eletricidade?\") e o painel p021 ganhou título descritivo; mesmo id, mesmo nível (Entender); ganhou o gráfico das cinco maiores fontes e a composição completa de 11 categorias."
    },
    {
      "antes": "tabela-recolhida|dados do gráfico em tabela (11 linhas)",
      "depois": "tabela-recolhida|dados do gráfico em tabela (8 linhas)",
      "justificativa": "O gráfico de 30 contra 365 dias passou a comparar só as 8 categorias com universo comparável; as 3 de cobertura alterada ficam no bloco \"Fora da comparação\" e a composição completa de 11 categorias (gráfico de barras e tabela equivalente de 11 linhas) está em \"Como se divide toda a geração?\"."
    }
  ],
  "/setor-eletrico/geracao/capacidade": [
    {
      "antes": "painel|quanto está instalado e quanto produz?",
      "depois": "painel|potência instalada e fator de capacidade, fonte por fonte",
      "justificativa": "A pergunta virou o título da página (H1) e o painel p024 ganhou título descritivo; mesmo id, mesmo nível (Entender)."
    },
    {
      "antes": "grafico|potência em operação comercial por fonte, usinas despachadas pelo ons, 30/09/2026, em mw",
      "depois": "grafico|potência em operação por fonte, 30/09/2026, em mw",
      "justificativa": "Título mais curto: \"comercial\" e \"usinas despachadas pelo ONS\" foram para o recorte do cabeçalho e para a nota do gráfico; mesmas barras, mesma unidade."
    },
    {
      "antes": "grafico|potência em operação comercial, média de cada mês",
      "depois": "grafico|potência em operação comercial, média de cada mês, a partir do retrato de 30/09/2026",
      "justificativa": "O título ganhou a data do retrato de capacidade de onde parte a série; mesma série, mesmo nível."
    }
  ],
  "/setor-eletrico/geracao/restricoes": [
    {
      "antes": "painel|quanta geração eólica e solar foi restringida?",
      "depois": "painel|energia não gerada por razão oficial do ons",
      "justificativa": "A pergunta virou o título da página (H1) e o painel p023 ganhou título descritivo; mesmo id, mesmo nível (Entender)."
    },
    {
      "antes": "diagrama|ro",
      "depois": "diagrama|conj. caju (rn): 802,0 gwh não gerados, taxa 28,8%, confiabilidade (cnf)",
      "justificativa": "Mesmo mapa de usinas e conjuntos. O rastreador lia o primeiro título interno do SVG: antes era o da UF (RO, o primeiro polígono); agora a lista das 10 maiores fica ao lado e cada marca de usina traz o próprio título, então o primeiro é o de uma usina. O mapa continua no painel mapa-usinas, nos três níveis, com a vista Usinas ou Brasil na URL."
    }
  ],
  "/setor-eletrico/geracao/termica": [
    {
      "antes": "painel|quanto as térmicas geraram e por que foram acionadas?",
      "depois": "painel|geração térmica por combustível e motivo de despacho",
      "justificativa": "A pergunta virou o título da página (H1) e o painel p022 ganhou título descritivo; mesmo id, mesmo nível (Entender)."
    },
    {
      "antes": "grafico|parcela de cada motivo na geração da usina, 12 meses: angra ii",
      "depois": "grafico|parcela de cada motivo na geração da usina, 12 meses: angra ii, gna ii, do atlântico",
      "justificativa": "A comparação abre com a maior usina de cada um de 3 combustíveis (Angra II, GNA II e Do Atlântico); o controle \"Usinas para comparar\" segue com até 4 usinas."
    },
    {
      "antes": "tabela|tabela equivalente: parcela de cada motivo por usina. 2 de 2 linhas.",
      "depois": "tabela|tabela equivalente: parcela de cada motivo por usina. 4 de 4 linhas.",
      "justificativa": "A tabela equivalente tem uma coluna por usina da comparação (Angra II, GNA II e Do Atlântico por padrão) e uma linha por motivo com geração (4 em vez de 2)."
    },
    {
      "antes": "tabela-recolhida|dados do gráfico em tabela (2 linhas)",
      "depois": "tabela-recolhida|dados do gráfico em tabela (4 linhas)",
      "justificativa": "Mesmo resumo em tabela do gráfico de parcela por usina, agora com as 3 usinas da comparação aberta por padrão (4 motivos com geração em vez de 2)."
    }
  ]
}
```

## 10. Medidas finais da primeira tela e peso das páginas

Posição vertical do topo do primeiro gráfico (nível Entender, medida com `medidas.mjs`; o topo inclui o título da figura) e altura total da página:

| Rota | 1440 por 900 | 390 por 844 | Altura total (1440 e 390) | Peso servido |
| --- | --- | --- | --- | --- |
| `/geracao` (barras por fonte) | 791 | 1.609 | 7.063 e 11.442 | 499.436 B |
| `/geracao/capacidade` | 777 | 1.447 | 5.533 e 9.694 | 428.265 B |
| `/geracao/restricoes` | 835 | 1.624 | 4.180 e 7.373 | 511.450 B |
| `/geracao/termica` | 863 | 1.436 | 6.455 e 9.850 | 533.096 B |

Referência da família Água e clima, medida antes: 779 e 1.324. Em relação à primeira medida desta família (732 e 1.439 na abertura; 764 e 1.514 na capacidade; 822 e 1.581 nas restrições; 832 e 1.487 na térmica), a abertura subiu 59 px no desktop e 170 px no celular por causa do que as avaliações independentes pediram junto da resposta: segunda frase do lead, nota da faixa dizendo que as três medidas não mudam com Região, Janela e Perímetro, e o limite principal logo depois da resposta curta. As filhas variaram entre menos 67 px e mais 43 px. No celular as três medidas da faixa empilham e já ocupam a primeira tela; o gráfico começa depois dos filtros, que ficam antes da figura para que a figura mostre o recorte escolhido. Todos os pesos estão abaixo dos 600 kB do contrato.

Verificações mecânicas feitas nas quatro rotas, depois da última mudança de código:

- 48 combinações (3 níveis por 4 larguras: 1440, 768, 390 e 320 px): sem rolagem horizontal, sem elemento além da borda, sem erro de console e sem marcador "Lendo..." sobrando depois da rolagem.
- axe-core (WCAG 2.0 a 2.2 AA e boas práticas) em 24 combinações (3 níveis por 1440 e 390): nenhuma violação.
- Teclado: setas, Home, End e Enter percorrem as barras por fonte da abertura (um tab stop) e a lista das 10 maiores usinas do mapa; Enter grava `?cat=` e `?ru=`, e a vista Brasil grava `?vm=brasil`.
- Alvos de toque: os controles de escolha têm 44 px (o rádio é `sr-only` dentro de um rótulo de 44 px); só ficam abaixo disso o campo `sr-only` do `SeguirPainel` e a sigla com link (item 7.12).
- Texto: nenhum nome de campo (snake_case) em texto de leitor nem em nome acessível das quatro páginas (exceto o dicionário de colunas dos motivos da térmica, em Auditar), nenhum "hoje", "agora", "porque", julgamento ou travessão em Entender (testes em `energia-geracao.test.ts`).
- Testes: `energia-geracao.test.ts`, `energia-geracao-sob-demanda.test.ts` e `energia-interface-r2.test.ts` (105 testes) e `energia-conteudo-r8-M1.test.ts` (140 testes, inclui as quatro páginas) passam; `tsc --noEmit` do projeto sem erro; eslint sem aviso nos arquivos da família.
