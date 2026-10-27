# Resposta na entrada — adendo final de código

27/10/2026. Worktree `/workspace/scrutiniums-resposta-na-entrada`, diff ainda não commitado sobre `8a7cd80b27e5110f0024236fc73ae1fabb61de69`. Árvore mantida intacta durante `verificar:pr`. Não executei comandos de build, teste ou navegador. Este documento é uma conferência de fonte, não o resultado da execução em andamento.

**Os achados anteriores, inclusive os dois da última rodada, foram corrigidos no código. Não identifiquei novo bloqueio nesta reconferência focalizada. Execução dos testes e comportamento renderizado continuam fora do alcance desta revisão.**

A execução principal informa que interrompeu e registrou a tentativa anterior de `verificar:pr`, aplicou as correções e reiniciou a verificação; Python e build passaram, enquanto fluxos/Vitest ainda estavam em andamento no momento deste adendo. Esse estado é relato da execução principal, não resultado aferido por mim.

## Correções confirmadas no código

| Before | After | Why |
| --- | --- | --- |
| Percentual de fibra chamado genericamente de “informado à fonte”. | `PainelConectividade.tsx`, `ConsultaInicial`, define natureza individual: densidade publicada, fibra calculada e cobertura declarada; cada linha mantém o mês próprio. | O percentual de fibra voltou a ser apresentado como derivado, conforme `pipeline/conectividade/gold.py`. |
| Teste de Combustíveis procurava o título anterior. | `combustiveis.test.ts:92` usa `data-fatia="resposta"` e preserva a ordem até método. | A verificação protege o comportamento autorizado sem amarrá-lo à redação removida. |
| Medição aceitava o topo de um contêiner que podia começar pelo título. | `data-valor-resposta` marca o valor efetivo, inclusive ausência explícita; o teste novo mede sua base quando há resultado e largura ≥390 px. | Reduz a possibilidade de aprovar uma primeira tela com apenas o título do resultado. |
| Contexto nacional, território e régua alongavam a entrada. | Permanecem no HTML em `Recolhido`; resultados locais, fontes, períodos, unidades, notas e precisão continuam à vista. | A profundidade foi recolhida, sem excluir medidas ou mudar o cálculo. |

A jornada municipal passou a conferir `fibra_pct` da cidade e os meses de fixa/cobertura contra a gold. Precisão do relato: esse bloco de teste não contém asserção da palavra Anatel nem da natureza calculada; fonte e natureza foram verificadas estaticamente nesta revisão. Não dizer que a jornada automatizada já confirmou ambas.

## Achados finais resolvidos nesta reconferência

| Before | After | Why |
| --- | --- | --- |
| Dois contratos de inflação exigiam o título anterior “Inflação em 12 meses: Brasil…”. | `src/tests/inflacao.test.ts` delimita a resposta por `data-resposta-especifica` até `id="grupos-na-area"` e confere nela o valor acumulado nacional, o mês por extenso e “IBGE, IPCA”. A ordem começa em `data-fatia="resposta"`. Ambos os ajustes citam a decisão de 27/10/2026. | A verificação passou a proteger conteúdo e sequência da resposta sem exigir a redação removida. As demais verificações de valor, fonte e grupos foram mantidas. Conferido por leitura; não afirmo que o teste passou. |
| O wrapper do seletor de Combustíveis impunha `min-w-[10rem]`, capaz de exceder a área disponível quando a raiz chegasse a 32 px. | `PrecoNoEstado.tsx:53` usa `min-w-0 max-w-full basis-[10rem] flex-1 sm:flex-none`; o seletor permanece `w-full` e com alvo mínimo de 44 px. | O mínimo rígido que motivou o achado foi removido; a base flexível permite encolher no espaço disponível. A ocorrência final de transbordamento deve ser confirmada pelas execuções e capturas. |

`src/tests/resposta-na-entrada.test.ts:70` agora aplica `fontSize = "200%"` à raiz, volta ao topo e aguarda dois quadros antes de exigir que a largura do documento e do controle não exceda o viewport. A asserção integra as cinco rotas nas larguras 320, 390, 768 e 1440 px. Cada caso seguinte navega novamente, portanto a ampliação não contamina a medição normal da próxima rota. Isso adiciona uma barreira automatizada de transbordamento; não verifica por si só corte interno de texto, legibilidade, zoom nativo ou presença da fonte na primeira tela.

Os achados foram enviados à execução principal sem qualquer edição concorrente, e as correções foram conferidas por leitura. Não encontrei nova alteração de cálculo, universo, acesso ou perfil inferido nas mudanças examinadas.

## Revisão do script de evidências

`scripts/evidencias-resposta-entrada.mjs` usa o servidor local existente, banco temporário e sessão sintética. Não acessa nem modifica produção. Registra build, HEAD, data, quatro larguras, caixas do controle/resultado/valor, tamanho tipográfico, altura/largura do documento, axe, erros de página e visibilidade dos detalhes de Conectividade/Capitais. Captura a página normal, texto com raiz a 200% e uma simulação geométrica de reflow. O próprio cabeçalho distingue essa simulação de zoom nativo e leitor de tela, corretamente.

Limites importantes para interpretar a saída:

- O script **coleta evidências**, mas não reprova por `axe.length > 0`, `largura > viewport`, `detalhes.visivel === false` ou valor fora da primeira tela. Sucesso do processo não equivale a aprovação. É necessário inspecionar JSON e capturas.
- Ele mede controle, contêiner e primeiro valor. Não mede a caixa da fonte/período nem grava seu texto; presença e legibilidade da prova na primeira tela dependem da leitura das capturas. Os períodos têm cobertura parcial em testes separados.
- A verificação de foco faz `.focus()`, Tab e Shift+Tab, depois registra tag e estilo de contorno. Isso não prova foco após escolher município, legibilidade do contorno, ordem completa de teclado, operação das sugestões ou anúncio por leitor de tela.
- O axe roda no estado normal, antes da ampliação de texto e da abertura dos detalhes. Não cobre automaticamente esses estados posteriores.
- A simulação 720 × 450 acontece dentro da iteração de 1440 px. As verificações de detalhe feitas depois dela correspondem a esse viewport reduzido, apesar de o registro carregar `largura: 1440`; `normal` e `texto200` foram medidos antes da mudança. Ao relatar a expansão, identificar esse estado corretamente.
- Os cinco casos são escolhidos e autenticados. O script não cobre início sem escolha, URL inválida, ausência de dado, anônimo, retorno do login nem persistência dos litros.
- Robustez secundária: `chromium.launch()` acontece antes do `try/finally`; se o navegador não iniciar, `s.encerrar()` não será chamado. Isso pode deixar o servidor local e diretórios temporários até a limpeza do ambiente. Não afeta a leitura normal quando o navegador inicia, mas convém pôr a inicialização dentro do ciclo de limpeza numa revisão futura ou após a execução atual.

## O que permanece não verificado por esta revisão

1. Resultado final de `verificar:pr` e dos testes focalizados, inclusive as asserções corrigidas de inflação e as novas asserções com raiz a 200%.
2. Posição efetiva e legibilidade do primeiro valor **e da sua prova** em cada recorte; fonte no HTML não comprova fonte visível na primeira tela.
3. Reflow com texto a 200%, especialmente o seletor de Combustíveis; zoom nativo de navegador e leitor de tela.
4. Foco após navegação da busca, funcionamento completo das sugestões e expansão dos alvos que ficam dentro de `<details>` fechados.
5. Estados sem resultado, códigos inválidos, valores ausentes, variação com nomes longos e páginas com/sem sessão no build final.

O contrato geral está preservado por leitura: escolha e resposta antecedem o contexto; aprofundamentos continuam no HTML; fontes e períodos seguem as medidas; cálculos e acesso não foram alterados. Os achados finais estão resolvidos no código; o encerramento depende do resultado das verificações e da evidência renderizada da execução principal.
