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
