# Pedidos da família Geração (rotas /setor-eletrico/geracao, /geracao/termica, /geracao/restricoes e /geracao/capacidade)

Registro dos pedidos ao coordenador: arquivo sem uso (para apagar no fim, com o servidor parado), mudanças em componentes ou textos compartilhados, equivalências para a matriz de preservação e o que ficou fora do meu escopo. Nenhum pedido bloqueia a família: cada página segue com a melhor solução local, descrita no item.

## 0. Arquivo sem uso, para o coordenador apagar

Nenhum arquivo foi apagado por este executor, conforme a regra do servidor de desenvolvimento.

- `src/components/energia/GeracaoLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, por meio de `GeracaoSeguir` (em `GeracaoPagina.tsx`), com o mesmo botão "Copiar link deste painel". Nenhum teste nem documento o cita.
- `docs/observatorios/energia/modulos/geracao.md` não cita componentes, mas a lista "Aberto" (abertura sem verbo, comparação de 30 e 365 dias sem aviso de sazonalidade, quantis no Entender de Capacidade, título de Restrições com padrão só eólico, termos da térmica sem definição, rótulos de natureza) descreve a interface anterior. A migração tratou cada um (abertura com pergunta e resposta na primeira tela; aviso de sazonalidade sob a comparação de janelas; só a mediana marcada no histograma de Capacidade; Restrições com a faixa das duas fontes; lista visível do que cada motivo de despacho quer dizer; selo de natureza com texto "pelo ONS, não medição"). Vale atualizar o documento quando o coordenador fechar o módulo.

## 1. Texto de outros arquivos que ainda traz a pergunta anterior da abertura

A abertura passou a se chamar "De onde vem a eletricidade?", a pergunta da tela 05 da galeria. É também a pergunta de P021 no registro dos painéis (`PAINEIS_GERACAO`, em `src/lib/energia/geracao.ts`), usada no título da página, na descrição da faixa de páginas e no link "Próxima pergunta" das outras páginas. O painel da abertura ganhou título descritivo ("Participação de cada fonte na geração"), como o de Água e clima. Dois textos de outros arquivos trazem a pergunta anterior:

- `src/lib/energia/navegacao.ts`, linha 111: a pergunta do módulo no menu é "De onde vem a eletricidade e quais fontes estão sendo usadas?". Sugestão: "De onde vem a eletricidade?".
- `src/lib/energia/transicao.ts`, linha 209 (`LIGACAO_GERACAO.pergunta`: "Quais fontes atenderam a carga?"), usada como texto do link para a Geração em `transicao/page.tsx` (linha 56) e em `transicao/emissoes/page.tsx` (linha 481). Sugestão: "De onde vem a eletricidade?" (o teste de Transição só confere o `href`).

## 2. Bloco "Período, universo e unidade" repetido em cada família

`GeracaoRecorte` (em `GeracaoControles.tsx`) escreve o mesmo `dl` de `data-recorte-painel` que outras famílias escrevem com componentes locais. Concordo com o pedido da família Perdas (item 4 de `perdas.md`): um `RecortePainel` compartilhado com `periodo`, `universo` e `unidade`. Quando existir, trocar `GeracaoRecorte` por ele.

## 3. Barras horizontais que distinguem medição, estimativa e previsão

`GraficoBarras` desenha toda barra com a mesma marca. A direção da tela 05 pede que a MMGD (estimativa do ONS) e as térmicas Tipo III (previsão do ONS) se distingam da medição na própria barra, por forma e por texto, não só por cor. Local: `src/components/energia/GeracaoBarrasFontes.tsx` (`BarrasPorFonte`: lista de linhas com nome, barra e valor; medição em barra cheia, estimativa e previsão em barra vazada com contorno tracejado, o `SeloNatureza` e o texto "pelo ONS, não medição" ao lado do nome; marca "cobertura da fonte alterada"; eixo com zero; setas, Home e End percorrem as barras; um único tab stop; vira lista de leitura sem `onSelecionar`). Proposta: uma propriedade opcional por categoria em `GraficoBarras` (por exemplo `natureza` em cada linha de dados, com preenchimento vazado e contorno tracejado) para que as outras famílias com dado estimado ou previsto (Carga, Rede, Transição) não precisem de um componente próprio.

## 4. Primeira tela das filhas: altura do cabeçalho

Nas três filhas, o título e a faixa de métricas deixam o começo da figura principal entre y=764 e y=832 em 1440 por 900 (a abertura, sem a faixa de navegação local, chega a y=732). Duas linhas do `CabecalhoModulo` custam altura que poderia voltar à figura:

- o `h1` quebra em duas linhas a partir de nove palavras ("Quanto as térmicas geraram e por que foram acionadas?"), por causa do `max-w` do título; com uma largura um pouco maior caberia em uma linha (cerca de 48 px);
- `recorte` e `fonte` ficam em linhas separadas quando somam mais de cerca de 190 caracteres (cerca de 34 px). Alternativa: a linha "Fontes, datas e siglas" ao lado do `recorte`, e a `fonte` na linha seguinte só quando não couber.

Local: encurtei o `recorte` da capacidade e a nota da faixa de restrições e de térmica; as duas figuras da capacidade ficam à direita da resposta curta a partir de 1280 px, e o título da primeira passou a caber numa linha para que as barras das duas figuras fiquem alinhadas linha com linha.

## 5. `Numero variante="faixa"` com unidade longa quebra a linha da medida

Quando a unidade de uma taxa vem da evidência ("% da geração possível estimada"), ela quebra em duas linhas e a faixa fica 38 px mais alta que as vizinhas. Resolvi passando `unidade="da geração possível"` (o selo "Estimado" e a nota da faixa já dizem que é estimativa). Proposta: o `Numero` aceitar uma unidade curta ou quebrar a unidade abaixo do valor só quando faltar espaço, sem puxar as medidas vizinhas.

## 6. Achados de conteúdo e de dado, vistos e não corrigidos

- `natureza_pct` (medição, previsão Tipo III, estimativa da MMGD) só existe para o perímetro com a MMGD. No perímetro sem MMGD a barra de natureza continua no perímetro com MMGD, e o título diz isso. Se a gold passar a publicar a natureza sem a MMGD, a barra pode seguir o perímetro.
- A gold só traz evidência ("Comprove este número") para o total de 30 dias, a MMGD, a eólica e o gás. A participação da fonte principal na faixa (hidráulica) é lida do mesmo seletor do gráfico, mas fica sem ficha de prova; as fichas da eólica e do gás ficam na composição completa.
- A soma exibida das 11 participações é 100,01% na janela de 30 dias do SIN e 99,99% na de 365 dias: dentro da tolerância de 0,05 ponto do controle publicado, dita na página (diferença de arredondamento de duas casas, não de dado).
- Biomassa, óleo e outras térmicas têm cobertura reduzida na fonte (biomassa com 17 identificadores com valor em ago/2026 contra 63 em ago/2025): saem da comparação entre janelas e da variação de 365 dias, com o motivo dito; a participação delas continua publicada na composição completa, com a ressalva.
- Texto de `textoDozeMeses` (`geracao.ts`) e a nota da participação anual (`geracao-tabelas.ts`) usavam "porque"; trocados por dois pontos, sem mudar número nem regra.
- `src/lib/energia/geracao.ts` e `geracao-tabelas.ts` só ganharam seletores (composição, cinco maiores, fechamento, comparação entre janelas, fonte principal, partes da natureza, datas do módulo, cobertura mensal), além dos três textos acima; nenhum cálculo existente mudou.

## 7. Equivalências para a matriz de preservação

(preenchido abaixo, depois da conferência mecânica)
