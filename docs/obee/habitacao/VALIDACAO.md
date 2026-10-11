# Revisão de Habitação

## Contrato editorial

Os cinco painéis distinguem estimativas de déficit de domicílios inadequados. Cada percentual identifica o denominador. Cor não atribui julgamento de gestão. Não se combinam unidades contratadas, entregas, gasto e variação de déficit. A edição não oferece série histórica harmonizada nem cobertura municipal.

## Evidências e limites

- Conferência numérica por dois leitores de XLSX: 990 células, sem divergência.
- Divergência PI/CE preservada; denominador da tabela de renda validado por regressão.
- Total fundiário conferido na tabela 30 e separado de fundiária exclusiva.
- Quatro testes Python: integridade, reprodução byte a byte, divergências e níveis territoriais.
- Dez testes TypeScript novos: universos, totais, percentuais, divergências, sobreposição, denominador inválido, CSV e proveniência.
- Roteiro visual e funcional executável em `scripts/obee/habitacao-verificacao.mjs`; resultados finais no PR.

A verificação de acessibilidade automatizada cobre o conteúdo principal, não uma certificação WCAG integral. Não foi executada sessão com leitor de tela real. Ampliação CSS de texto não equivale ao zoom nativo. Não se chama esta autoavaliação de revisão independente.
