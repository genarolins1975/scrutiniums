# Saldos da execução e alteração da dotação

A ficha estadual passa a responder como a autorização anual se distribui entre pagamentos e saldos dos estágios. Usa exclusivamente os sete valores fiscais já conferidos nas 27 UFs para 2025; não amplia a contagem dos cinco indicadores ou das 162 observações originais.

## Contrato

As parcelas mutuamente exclusivas são: paga; liquidada menos paga; empenhada menos liquidada; dotação atualizada menos empenhada. A soma deve recompor a dotação atualizada. Todas usam a mesma escala, com base zero, e o mesmo denominador percentual. Valores negativos ou não finitos impedem a visualização. A mudança orçamentária é dotação atualizada menos inicial; o percentual só existe com dotação inicial positiva.

Os saldos não demonstram atraso, economia, desperdício ou qualidade do serviço. Não representam o estoque completo de restos a pagar. A alteração da dotação é líquida e não identifica créditos, cancelamentos e remanejamentos brutos. Mantêm-se o perímetro, o período e as fontes do RREO 01 arquivado: janeiro a dezembro, exceto intra-orçamentárias e refinanciamento destacado, reais nominais, sem pagamentos de restos de exercícios anteriores.

## Interface e exportação

A nova seção integra a ficha, acompanha os seletores existentes de UF e ano e preserva o estado compartilhável na URL. Gráfico de composição, legenda com valores/percentuais, mudança da dotação, tabela exata e CSV. A tabela e o CSV incluem a diferença da dotação. O CSV contém URLs, caminhos dos arquivos e hashes. Exercícios sem execução conferida mantêm o estado de ausência; o endpoint responde 404, sem substituir silenciosamente por 2025. Recortes inválidos retornam 400.

## Verificação

- 20 testes TypeScript aprovados, incluindo conservação das quatro parcelas nas 27 UFs, ausência de 2026, recorte inválido e exportação com proveniência.
- `tsc --noEmit` e lint dos módulos alterados aprovados; `git diff --check` sem erros.
- Inspeção visual pendente: o navegador disponível foi redirecionado ao login da Vercel. Não se atribui nota estética, aprovação responsiva ou conformidade de acessibilidade sem essa inspeção.
- A etapa educacional permanece bloqueada pela obtenção das planilhas oficiais, documentada em FASE_4A_EDUCACAO.md. Não houve merge ou publicação em produção.
