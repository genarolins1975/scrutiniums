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
- `sintese_regras_diario.csv` aparece como reprovado em `publicacao.json`, mas o validador julgou uma versão anterior do arquivo: o arquivo servido tem 0 linhas fora do padrão de 8 colunas. A página (Visão geral, Analisar, "Arquivos para baixar e o estado de cada um") diz as duas coisas junto do link, sem tocar em `publicacao.json`. Pedido ao pipeline: revalidar o arquivo final (ou invalidar o selo quando a impressão digital muda).
- Link da Visão geral para a Qualidade: `/setor-eletrico/qualidade#expurgos` (seção "Quanto do tempo sem energia fica fora do apurado?"). Se a Qualidade mudar essa âncora, o link do cartão do DEC precisa acompanhar.

## 8. Rodada 2: pedidos compartilhados novos

- `src/components/energia/Comparador.tsx`: com o limite atingido, depois de escolher ou remover, a consulta zera mas `aberto` continua verdadeiro, e a lista abre sozinha com as 50 primeiras opções, todas bloqueadas (em Minha região, os 50 municípios de RO). Proposta: `setAberto(false)` em `alternar` quando o limite é atingido e só listar opções com consulta não vazia ou com a seta para baixo.
- `src/components/energia/GraficoLinhas.tsx`: `tracejada` é um padrão só. Para distinguir mais de duas séries sem depender do tom (Rede, Preço), propor `traco: "continuo" | "tracejado" | "pontilhado"`; e dar mais peso à linha de zero quando `zeroNoEixo` (Rede). A Visão geral alterna contínuo e tracejado e usa rótulo direto na Rede.
- `src/components/evidencia/PainelEvidencia.tsx`: `porQueImporta` é obrigatório no tipo mesmo quando a página põe a razão no `lead`. Território ainda passa o texto (recolhido, abre em Analisar); a Visão geral usa `PainelVisao` próprio sem o bloco. Proposta: tornar o campo opcional.

## 9. Rodada 2: dados e pipeline (nada foi alterado na gold, na coleta nem no pipeline)

- Território, índice defasado: 3 dos 19 insumos (`agua_detalhe.json`, `expansao.json`, `transicao.json`) foram regerados depois do índice, e o sha256 declarado em `territorio.json` não é o do arquivo servido. A página recalcula o sha256 na montagem e diz, por arquivo, "confere" ou "o arquivo mudou depois do índice (regerado em ...)"; um teste compara o declarado com o servido. Pendência do pipeline: regerar o índice (só roda com o pipeline) e, ao fim da execução, comparar o sha256 dos insumos com os arquivos publicados e falhar a publicação se divergirem.
- Território, perdas: a gold deve trazer em `distribuidoras[].indicadores.perdas` o `origem_injetada` (publicada, requerida ou mista) e a perda sobre a injetada publicada. A página lê `perdas_distribuidoras.csv` e só usa a linha se a taxa dela confere com a da gold.
- Território, unidades consumidoras: a mediana pesada usa `qualidade.ucs`. A gold deveria publicar o peso por distribuidora (e a cobertura) para cada indicador do quadro.
- Território, localidade isolada: `ufs[].municipios_com_localidade_isolada` soma 89 e inclui os 73 fora do SIN; `distribuidoras[].area.com_localidade_isolada` é disjunto de `fora_do_sin`. Publicar os dois campos separados também na UF (a página subtrai: 16 dentro do SIN).
- Território, MMGD estimada do ONS: o mês (ago/2026) só está em `submercados[].indicadores.mmgd_ons.periodo`; incluí-lo em `referencias`.
- Território, texto com nome interno na gold (`condicao`, `regra`, `limitacoes`, `bloqueios`, `controles`): estados `'provado'`, `'fora_do_sin'`, "estado 1 (confirmado)", "gold", "pipeline", `WMS_Webmap_EPE_Data`. A página traduz em `textoLegivel` (`territorio.ts`); o ideal é a gold escrever em palavras. A palavra "provada" também: a página usa "conferida" e escreve o teste (dois dias, 15 MWmed).
- Território, capturas brutas (EPE, IBGE, ONS): citadas por caminho interno e não publicadas; o serviço da EPE pode exigir credencial. A página diz que a captura bruta não é pública. Pendência: publicar a captura com o sha256 ou registrar o bloqueio na gold com a data.
- Visão geral, `sintese_multiplos.csv`: não traz a mediana da EAR nem as faixas que o gráfico mostra; o rótulo do link já diz isso. Incluir as colunas.
- Visão geral, DEC: o texto de cobertura da gold ("3150 conjuntos de 98 distribuidoras") mistura universos: 102 distribuidoras enviaram DEC, 98 têm os 12 meses (3.146 conjuntos, os que têm limite) e 4 são de ano parcial (4 conjuntos). A página concilia no cartão (`textoUniversoDec`); corrigir `cobertura` e `universo` na gold.
- Visão geral, faixa térmica: "janelas de 7 dias dos 365 dias anteriores" são 365 janelas que terminam de 7 a 371 dias antes do dia de referência, sem sobreposição com a janela do número. A gold deve dizer isso no rótulo da referência (ou trazer o primeiro e o último dia). A página escreve a janela no cartão.
- Visão geral, PLD só em média diária: a dispersão horária do dia (30/09: de R$ 57,31, com 10 horas no piso, a R$ 577,20) não está na síntese; decidir se a Visão geral a mostra.
- Visão geral, tarifa: a mediana é simples (R$ 0,8212/kWh); pesada pelas unidades consumidoras dá R$ 0,8437/kWh, e a fonte viva da ANEEL já tem 103 distribuidoras. A página diz que a mediana é simples e depende do arquivo; a pesada está na tabela de quartis de Minha região.
- Visão geral, CMO semanal: o rótulo da semana é a data final da semana operativa; a natureza (resultado de modelo do ONS, DECOMP) agora vem à vista na regra.

## 10. Rodada 2: pendências declaradas nos meus arquivos (não couberam)

- Minha região: zoom do mapa por roda do mouse e por teclado (o arrasto já move o mapa aproximado); teste de daltonismo; exportação só da ficha; série temporal por indicador; ficha ainda cita sigla técnica (MMGD, TE, TUSD, REH) sem a explicação ao lado; usinas do município só em Analisar; medição de caixas como teste automático no repositório (fica um script de Playwright fora dele, e o contrato de grade está em `energia-territorio.test.ts`).
- Visão geral: cartão de Preço continua alto (cerca de 850 px) com gráfico de 200 px; faixas de Preço e Geração largas; PLD, Água e Carga seguem com dois critérios explicados em nota (a Carga ganhou janelas com um critério só); 29 fichas Comprove; composição da geração, evolução dos indicadores de consumidor, recorte regional e seleção de entidade; links em linha (VisaoAtencao) com 15 a 17 px em 390; código da regra (`código ear_faixa`) ainda aparece em Analisar.

