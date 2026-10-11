# Distribuição das capitais — 11/10/2026

Avanço da etapa de comparação do roadmap: cada uma das quatro perspectivas da entrada passa a mostrar todas as capitais com observação elegível, com destaque para o território e o comparador selecionados. A referência continua sendo a mediana simples das capitais, sem ponderação populacional.

## Leitura e interação

- Posição horizontal: valor original, na escala fixa de cada indicador. Altura: somente separação dos pontos para evitar colisões. Não é outra variável.
- Território: círculo preenchido; comparador: círculo vazado; demais capitais: círculos neutros. Seleção coincidente preserva as duas marcas.
- Linha tracejada e losango: mediana das capitais elegíveis, sem representar meta ou agregado nacional.
- Expansão nativa de cada tema: tabela das 26 capitais em ordem alfabética, com identificação textual das seleções. Funciona por teclado e sem depender de hover.
- Ausência e inelegibilidade ficam na tabela, sem ponto no gráfico. Zero elegível permanece visível na origem. Empates são empilhados, sem alteração dos valores.
- Período, unidade, universo, ressalvas, fonte e cobertura continuam visíveis. CSV integral de 104 observações, aprofundamentos e seletores existentes preservados.

Não foram alterados fontes, valores, escalas, fórmulas, URL de seleção, escore ou referências metodológicas. Não há ranking de eficiência nem série temporal criada a partir de períodos incompatíveis.

## Verificação desta entrega

Sete testes novos aprovados em cópia isolada dos arquivos atuais: integridade dos quatro conjuntos, coordenadas e colisões, ordem alfabética, empates e zero, seleção coincidente, ausência e inelegibilidade, tabela e notas. TypeScript da cópia isolada aprovado. Dependências locais reutilizadas; nenhuma dependência adicionada ao projeto.

Comando do teste no repositório: `npx vitest run src/tests/obee-distribuicao-atlas.test.ts`.

O CI da entrega anterior (`2577896`) foi confirmado como aprovado. Build e suíte completa da nova integração dependem do CI do novo commit; não foram executados localmente nesta entrega porque a clonagem completa não terminou. A revisão visual, responsividade, zoom e teclado no navegador continuam pendentes. A prévia Vercel requer autenticação recusada anteriormente; não houve nova solicitação nem mudança de proteção.

## Próximos marcos

1. Confirmar CI do novo commit e revisar visualmente a página, inclusive 320/390/768/1440 px, zoom 200%, teclado e tabelas expandidas.
2. Evoluir um capítulo com dados e referências validados. As 15 fichas de escore seguem sem referências aprovadas; a distribuição não resolve esse bloqueio.
3. Adicionar evolução temporal somente onde período, universo e denominadores forem compatíveis. As quatro medidas atuais não constituem uma série temporal comum.
4. Após validação da cesta, retomar escore por capítulo e agregado. Comparação internacional exige outra cesta harmonizada.

Esta entrega permanece em PR de rascunho, sem merge ou publicação em produção.

## Revisão de legibilidade — etapa seguinte

Os limites da escala foram retirados do SVG e colocados em texto HTML a 13 px, preservando o alinhamento horizontal de 8% e 92% do gráfico. Antes, o texto de 12 unidades dentro de um SVG de 400 unidades podia ficar abaixo de 9 px quando o gráfico encolhia em telas estreitas. Agora o texto não encolhe com a figura. Valores do par usam tamanho responsivo entre 20 e 26 px no celular; a tabela completa usa 14 px. Sem alterações em valores ou coordenadas dos pontos.

Sete testes existentes e tipos da cópia isolada novamente aprovados após o ajuste. Não se trata de homologação visual: a conexão do navegador falhou antes de abrir a prévia, com erro de carregamento da política de cabeçalhos, também após uma nova tentativa. Não houve login, alteração de proteção ou captura da página. CI da distribuição (`7673137`) confirmado aprovado nesta revisão; o ajuste de legibilidade terá seu próprio CI.

Pendentes para conclusão desta etapa: conferir a tela completa, expansões e seletores; medir reflow em 320/390/768/1440 px e zoom 200%; verificar foco e ordem de teclado no navegador. Os critérios de acabamento, responsividade e interação permanecem **não verificados visualmente**. A falha de acesso não deve ser confundida com aprovação desses critérios.

## Escolha do comparador na tabela

O nome de cada capital na tabela agora permite trocar o comparador dos quatro temas sem retornar ao topo. A cidade principal e os demais filtros são preservados. O componente Atlas encaminha a escolha ao mesmo `select` usado pelos controles centrais, mantendo os parâmetros da URL e o histórico. A alteração não navega para outro capítulo nem fecha a expansão.

Botões nativos com altura mínima de 44 px, foco explícito e nome acessível identificam a ação. `aria-pressed` indica o comparador atual. Cidade principal e comparador atual têm `aria-disabled` e proteção no evento, conservando o elemento no DOM; não criam nova entrada de histórico quando acionados. A frase curta do par é uma região de status. Sem callback, o componente oferece apenas a tabela de leitura, sem botões inoperantes.

Nove testes focados aprovados, incluindo acionamento das 26 opções nos quatro temas e estados após nova seleção. TypeScript da cópia de revisão, agora incluindo Atlas e suas dependências diretas, aprovado. Esses testes verificam eventos e renderização do componente; não substituem a verificação de foco, anúncio por leitor de tela, URL/histórico e interação no navegador, ainda pendente. Sem alterações de fontes, dados ou metodologia e sem publicação em produção.
