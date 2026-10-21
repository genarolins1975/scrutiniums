# Guia de migração por família de páginas

Para quem implementa a migração de uma família de páginas do observatório de energia para o sistema editorial. Leia primeiro `DESIGN_SYSTEM.md` (componentes, tokens, receita) e `RUBRICA.md` (como o resultado será avaliado, por avaliadores independentes que você não vê).

## Exemplo completo: Água e clima

O commit que traz o sistema e a página de Água e clima é a referência. Estude `git show --stat HEAD` e estes arquivos:

- `src/app/setor-eletrico/agua-e-clima/page.tsx`: abertura com `lead`, `recorte`, `fonte`, `datas`, `metricas` (`FaixaMetricas` com `Numero variante="faixa"`); título da página igual à pergunta do painel; título próprio da primeira figura; `NotasDoPainel` passado ao corpo com `naoConcluirNoCorpo`; seções complementares visíveis.
- `src/components/energia/AguaPagina.tsx`: `AguaNavegacao` vira `NavegacaoLocal` (faixa nas filhas, nada na abertura), `AguaCapitulos` (capítulos na abertura), `AguaSeguir` delega ao `SeguirPainel`.
- `src/components/energia/AguaArmazenamento.tsx`: figura principal primeiro, recorte como legenda, `notas` e `aposPrincipal` como encaixes, complementos sem `data-nivel`.

## Regras de escopo

1. Edite só os arquivos da sua família (a lista vem na tarefa) e os testes dela. Componentes compartilhados estão congelados: `CabecalhoEnergia`, `CabecalhoModulo`, `FaixaMetricas`, `Numero`, `NavegacaoLocal`, `SecaoDoPainel`, `SeguirPainel`, `LinkDoPainel`, `DetalheDoNivel`, `PainelEvidencia`, `ModoProfundidade`, `SeloNatureza`, `globals.css`, `tailwind.config.ts`, layouts e `Footer`. Se precisar de uma mudança neles, descreva em `docs/energia/redesign/pedidos/<sua família>.md` (o que, por que, arquivo) e siga com a melhor solução local; a mudança compartilhada é do coordenador.
2. Não rode `next build`, `next dev` nem `git commit`, `checkout`, `stash`, `reset` ou `push`. O servidor de desenvolvimento já está no ar em `http://localhost:3200` e compila a rota na primeira visita. Não toque em `.next`, `.next-dev`, `next.config.mjs` nem `tsconfig.json`.
3. Não altere gold, pipeline, coleta, denominadores, elegibilidade nem a metodologia para resolver diferença visual. Pode criar seletores novos em `src/lib/energia/<módulo>.ts` quando a faixa de métricas ou uma frase precisar de um valor que já existe na gold; o seletor serve ao gráfico, à tabela e à exportação ao mesmo tempo. Erro material encontrado: pare, registre no relatório com evidência e não corrija em silêncio.
4. Nenhuma dependência nova. Nenhuma biblioteca de gráficos.
   O `tsc` do projeto usa o alvo padrão (ES5, sem `target` no `tsconfig.json`) e o `next build` checa também `src/tests`: não use a flag `u` ou `s` em expressão regular (`\p{L}`, ponto que atravessa linha; use `[A-Za-zÀ-ÿ]` e `[\s\S]`), nem `for (const [k, v] of mapa)` ou espalhamento de `Map` e `Set` (use `Array.from(mapa)` e `.forEach`). Antes de devolver, `flock -w 900 /tmp/energia-pesado.lock npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "arquivo-da-sua-familia"` não pode listar nada seu.
5. Nenhum número da galeria de referência vai para o código: tudo vem dos contratos reais.

## Preservação (contrato de ouro)

Cada visão que a página tem hoje continua existindo: gráficos, mapas, simuladores, tabelas, séries, comparações, explicações, estados bloqueados, filtros, referências, exportação e fichas "Comprove este número". O inventário mecânico está em `docs/energia/redesign/dados/visoes_antes.json` (campo `rotas[].visoes`, filtre pela sua rota). Pode mover, reordenar e promover de nível. Só pode consolidar duas visões redundantes se todas as dimensões, filtros e comparações continuarem na versão consolidada, com a equivalência registrada no relatório. Âncoras (`id`), rotas, parâmetros de URL, `data-resposta`, `data-nivel`, `data-grafico` e demais atributos que testes e instrumentos leem permanecem.

## Editorial

- Fatos, referências e limites; o leitor conclui. Nada de "bom", "ruim", "ineficiente", "risco baixo", "melhor", "pior", nem causalidade ("porque"), nem cor de aprovação ou reprovação.
- Não escreva "hoje", "agora" nem "atual" como data (o dado tem a própria data; testes do projeto barram "hoje"). Não escreva travessão nem hífen como separador de frase.
- Sem código de painel (P0xx), nome de campo, nome de arquivo, hash, "gold", "silver", "pipeline" em texto de Entender. Siglas expandidas no primeiro uso.
- Título de página: 5 a 9 palavras. Lead: uma ou duas frases. O título da primeira figura não repete o título da página.
- Ressalva essencial junto do dado. Definição de termo no ponto de uso, em texto visível (quando a definição está só em "Por que isso importa", que fica recolhido, traga-a para o `lead`, para as notas ou para um `Termo` visível).
- Mercado e quaisquer páginas com dado bloqueado: estado honesto (ver `DESIGN_SYSTEM.md`, seção 5), sem painel fictício.

## Procedimento

1. Leia as linhas da sua família no inventário de visões, a seção "Cobertura mínima por tema" do prompt de redesenho (`/root/.claude/uploads/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/fb47d436-Prompt_Claude_Redesenho_Completo_Energia_1.md`, linhas 329 a 356 e 133 a 172) e a tela correspondente da galeria (`bd6d4133-Mocks_Energia_22_Aberturas_1.html` no mesmo diretório: procure o `id` da abertura no array `pages` e a função de desenho do tipo; a galeria é direção de composição, não fonte de dados). Veja as capturas antes em `docs/energia/redesign/capturas/antes/<rota>__1440_dobra.webp`, `__390_dobra.webp` e, nas aberturas, `__1440_inteira.webp`.
2. Desenhe a abertura: título curto, `lead`, `recorte`, `fonte`, de 3 a 6 métricas dos seletores existentes (cada uma com período e referência), figura principal que apareça na primeira tela, seções complementares visíveis com pergunta própria, capítulos para as páginas irmãs.
3. Implemente com os componentes do sistema. Converta os auxiliares do módulo: `*Navegacao` para `NavegacaoLocal`, `*Seguir` para `SeguirPainel`, `*Analise` e `*Auditoria` para `SecaoDoPainel` (com ou sem `nivel`).
4. Confira no navegador, em 1440 por 900, 768, 390 por 844 e 320 px, nos três níveis (`?modo=analisar`, `?modo=auditar`): primeira tela com título, lead, métricas e o começo da figura principal; sem rolagem horizontal; sem texto cortado; sem erro no console; foco visível e ordem de Tab; controles com 44 px no toque. O auxiliar de captura é `node /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/foto.mjs <base> <rota> <largura> <saida.png> [modo] [inteira=0|1]` (grava a dobra ou a página inteira e imprime altura, rolagem horizontal e erros de console); `fatias.py` do mesmo diretório corta uma imagem longa em fatias para leitura. Escreva as imagens em uma pasta sua dentro de `scratchpad/`.
5. Rode os testes da família (`npx vitest run src/tests/energia-<família>*.test.ts` e os de conteúdo `src/tests/energia-conteudo-r8*.test.ts` que tocam suas páginas) e `npx tsc --noEmit`. Teste que descreve o desenho anterior (nome de classe, posição, abas) pode ser atualizado, com a razão no relatório. Teste de conteúdo, método, unidade, ausência, paridade ou risco não se afrouxa: se falhar, o conteúdo é que deve ser ajustado.
6. Relatório final (até 400 palavras) com: arquivos alterados; para cada visão do inventário, onde ela está agora (visão anterior, nova localização, nível); testes atualizados e por quê; medidas da primeira tela (posição vertical do primeiro gráfico em 1440 por 900 e em 390 por 844); pedidos de mudança compartilhada; achados de conteúdo ou de dado que você viu e não corrigiu; o que ficou pendente.

## Critério de pronto

A página (e suas filhas, quando houver) tem nota potencial 9 ou mais nos critérios A, B, C, D, I, J e K da rubrica: pergunta e informação principal reconhecíveis rapidamente, conceitos antes de serem necessários, tarefas da família bem atendidas, atenção a custo, continuidade, acesso e território quando o tema pede, gráficos escolhidos pela tarefa com referência visível, filtros que sincronizam tudo, teclado, 320 a 1440 px sem perda de informação. Os critérios técnicos (E, F, G, H, L) são avaliados por outro avaliador: não enfraqueça método para caber o layout.
