# Revisão editorial de Crédito e Energia

Escopo: componentes de apresentação compartilhados pelos dois observatórios, abertura de Energia e guia transversal do Crédito. A revisão não abrangeu individualmente todas as páginas, gráficos ou explicações. Merge autorizado pelo usuário em 10/10/2026; a validação visual permanece pendente.

## Diagnóstico e alterações

- Aberturas escuras e contagens da estrutura recebiam peso de informação principal. Aberturas agora usam papel, tinta e linha de destaque; as contagens têm escala secundária.
- Cabeçalhos de módulo e catálogos repetiam caixas. Foram substituídos por linhas e alinhamentos; os painéis analíticos mantêm suas áreas funcionais.
- Texto de orientação e limites no Crédito ficavam recolhidos. Ambos ficam visíveis, e a contextualização adicional permanece expansível.
- Revisão de saldo versus concessões, PF/PJ e comparação histórica no Crédito; revisão da introdução e da leitura das réguas e unidades na Energia.
- Espaçamento, tabelas, largura de leitura, foco e movimento reduzido recebem regras com escopo explícito. O OBEE não recebe os seletores novos.

## Preservação

Nenhum contrato de dados, valor, consulta, unidade de série, exportação, filtro ou cálculo foi alterado. Os textos são derivados dos conceitos já presentes no projeto. Não foram acrescentados indicadores ou benchmarks.

## Verificação

- JavaScript: `node --check` aprovado nos dois arquivos alterados.
- TypeScript: `tsc --noEmit` aprovado.
- Build de produção: `npm run build` concluído com compilação, lint, checagem de tipos e geração de páginas.
- 69 testes aprovados: design-tokens-energia, energia-interface-r2, energia-estrutura-r9.
- 65 testes aprovados: energia-estrutura-r7, energia-conteudo-r8, energia-interface-r2 (há sobreposição entre as duas execuções).
- A versão publicada foi inspecionada no navegador em Crédito/Pulso e Energia/Início; essa inspeção não comprova a renderização do código modificado.

## Bloqueio visual e rubrica

O navegador remoto não alcançou o servidor local. O Chromium local estava ausente e seu download não produziu um arquivo válido. Portanto, a renderização nova, 320/390/768/1440 px, zoom 200%, modo escuro, teclado e interações não foram validados visualmente.

Para Início/Crédito, módulos/Crédito, Início/Energia e módulos/Energia: direção de arte, hierarquia, tipografia, densidade, didática visual, comparabilidade visual, interação e responsividade estão **não verificados** na versão alterada. Não se atribui nota 9 sem evidência. A melhoria é uma proposta implementada, ainda em revisão, não uma certificação de excelência de todos os painéis.

Próximo gate: disponibilizar uma prévia de revisão e conferir início, meio e fim de páginas representativas com gráficos, tabela, filtros e ressalvas nas quatro larguras, incluindo ausência de dados e nomes longos. Depois, continuar a auditoria individual das demais páginas e textos como acompanhamento da entrega.

## Entrega

Alterações na branch `feat/layout-credito-energia`. Após o bloqueio inicial da gravação no GitHub, o usuário autorizou explicitamente o merge em 10/10/2026. O histórico do PR registra envio, CI e resultado do merge; a autorização não substitui a validação visual pendente.
