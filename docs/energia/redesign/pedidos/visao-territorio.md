# Pedidos de mudança compartilhada: Visão geral e Território

Rotas `/setor-eletrico/visao-geral` e `/setor-eletrico/territorio`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia as páginas: elas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso para apagar no fim (regra do coordenador: não apagar com o servidor no ar)

- `src/components/energia/TerritorioLinkPainel.tsx`: só o `TerritorioSeguir` o importava, e nenhuma página usa mais o `TerritorioSeguir`. O rodapé do painel passou a usar o `SeguirPainel` compartilhado (mesmo botão "Copiar link deste painel", mesmo endereço).
- Exportações sem uso em `src/components/energia/TerritorioPagina.tsx`: `TerritorioAnalise`, `TerritorioAuditoria` e `TerritorioSeguir` (a página usa `SecaoDoPainel` e `SeguirPainel`).
- `src/tests/zz_tmp_visao_ctx.test.ts` e `src/tests/zz_tmp_visao_ctx2.test.ts`: testes temporários de impressão que usei para ler os textos gerados; estão com `it.skip` e a cobertura que importa está em `energia-visao.test.ts`.
- De uso cruzado, não é sem uso: `src/components/energia/VisaoLinkPainel.tsx` continua em `MercadoPainel.tsx` (e em `DadosPainel`, se ainda o importar). Na Visão geral deixou de ser usado.

## 1. `SobreEsteDado` monta o diálogo inteiro no HTML

Cada `SobreEsteDado` (rodapé do `PainelEvidencia`) escreve o conteúdo do diálogo no HTML do servidor. Em Minha região são 17 (o principal e 16 complementares): cerca de 118 kB de HTML e 44 kB do fluxo RSC, mais de um quinto dos 761 kB servidos (eram 840 kB antes da migração). Proposta: montar o conteúdo na primeira abertura, como o `ComproveNumero` já faz, e deixar no servidor só o botão e o título. É o que falta para a página passar de 600 kB servidos. Arquivos: `src/components/evidencia/SobreEsteDado.tsx` e, se preciso, `PainelEvidencia.tsx`.

## 2. `Numero variante="faixa"` não aceita a prova sob demanda

`ComproveNumero` aceita `sobDemanda` (URL do JSON e caminho), mas `Numero` só aceita `evidencia`, que leva o objeto inteiro (de 3 a 4 kB por número) para o HTML e para o fluxo RSC. Na Visão geral a faixa tem quatro medidas e a página já carrega a gold sob demanda; para não pesar, a prova vai dentro de `nota`, com `-my-2.5` para o botão de 44 px não somar altura. Proposta: `Numero` aceitar `sobDemanda` e pôr o botão na linha de contexto, ao lado do período e do selo. Arquivo: `src/components/energia/Numero.tsx`.

## 3. `GraficoLinhas`: cabeçalho de cerca de 100 px e dica sobre a legenda

- Com título, legenda interativa, legenda da faixa e "Valores em R$/MWh", o traçado começa uns 100 px abaixo do topo da figura. Em cartões de pequenos múltiplos, que já têm título e valor, o título do gráfico repete o do cartão. Proposta: prop `semTitulo` (o título continua como nome acessível) e a legenda da faixa na mesma linha da legenda das séries.
- A dica do cursor cobre a legenda quando o ponto está na parte de cima do gráfico (apontado na avaliação de produto). Proposta: abrir a dica para o lado em que não há legenda ou limitar a altura dela à área do traçado.

## 4. Tokens de cor de série

- `--serie-sm-s` (verde do Sul) tem 2,97:1 sobre a superfície do gráfico, abaixo dos 3:1 de elemento gráfico. Na Visão geral a linha do Sul usa `color-mix(in srgb, var(--serie-sm-s) 92%, #000)`, que passa dos 3:1 sem mudar de matiz. Proposta: escurecer o próprio token em `globals.css` e voltar a usá-lo direto, para a Sul ter a mesma cor no PLD e na Visão geral.
- `--serie-comp-1` a `--serie-comp-4` têm os mesmos matizes de `--serie-sm-*` (roxo, laranja, verde, azul). No painel de Rede, fronteiras e submercados da página de preço ficavam com as mesmas cores para entidades diferentes; a Visão geral passou a pintar as fronteiras com `--serie-1`, `--serie-3`, `--serie-4` e `--serie-2` (neutras). Proposta: separar os tokens de comparação dos de submercado.

## 5. `MapaCoropletico.tsx` não foi editado (é de cinco famílias)

O componente é usado por Inclusão, Transição, Qualidade e Expansão, então não mexi. Do que a avaliação pede ao mapa: uma parada de Tab com setas para percorrer as regiões, foco visível e alvos de toque ampliados; aproximar à seleção; agrupar pontos em zoom baixo. O mapa de Minha região é `TerritorioMapa.tsx` (meu) e também ainda não tem teclado nos polígonos nem agrupamento de pontos de usinas: ficou pendente (a escolha pelo teclado passa pela busca e pelas tabelas). Pedido: se o coordenador quiser o teclado no mapa, fazer uma vez no `MapaCoropletico` e eu o adoto no `TerritorioMapa`.

## 6. Barra "Profundidade" em 390 px

O coordenador já deixou a barra opaca e fora do caminho do foco. Em 390 px ela ainda perde o rótulo e a descrição de cada nível (a descrição fica só no `title`). Proposta: uma linha curta sob os botões com o que cada nível acrescenta. Arquivo: `src/components/evidencia/ModoProfundidade.tsx`.

## 7. Dados e pipeline (não alterei gold, pipeline nem coleta)

- `public/energia/series/sintese_multiplos.csv`: a EAR do SIN está com duas casas (61,65), arredondada pelo pipeline; a página lê a série `ear_diario.csv` com quatro casas (61,6473) para o gráfico, a tabela e a exportação da tabela, e o rótulo do link do CSV estático agora diz que ele traz sempre os 90 dias publicados e não muda com a janela. Para o arquivo estático fechar com a página, o pipeline de `sintese` precisa gravar a EAR sem o arredondamento intermediário.
- `territorio.json`, `bloqueios`: a camada 24 da EPE (WebMap) pode responder "Token Required" a quem consulta. A página diz isso em Auditar, em "O que não foi possível obter", mas o bloqueio formal precisa entrar na gold, com a data da tentativa.
- `territorio.json`, `ufs[].indicadores.capacidade.usinas` inclui os registros de até 10 kW (16.035 no país, 13.101 só no Pará). A página corrigiu a contagem por UF em `territorio.ts` (lê o arquivo de usinas no servidor, `territorio-servidor.ts`); o ideal é a gold publicar as duas contagens por UF.
- `sintese_regras_diario.csv` aparece como reprovado no validador do pipeline por causa de ponto e vírgula entre aspas no campo `detalhe`: falso positivo (o arquivo tem 20.981 linhas de 8 colunas); o ajuste é do validador.
- Link da Visão geral para a Qualidade: `/setor-eletrico/qualidade#expurgos` (seção "Quanto do tempo sem energia fica fora do apurado?"). Se a Qualidade mudar essa âncora, o link do cartão do DEC precisa acompanhar.
