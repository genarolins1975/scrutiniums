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

## Autoavaliação das páginas

Capturas completas em 390 e 1440 px inspecionadas; verificações de reflow também em 320 e 768 px e texto ampliado a 200%. Escalas das comparações partem de zero, incluem a referência nacional e exibem o limite superior; a composição nacional mantém 0–100%.

| Página | Arte | Hierarquia | Tipografia | Profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Panorama | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Déficit | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Aluguel e renda | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Condições da moradia | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |
| Dados e métodos | 9 | 9 | 9 | 9 | 9 | 9 | 8 | 9 |

Notas de autoavaliação, não garantia nem auditoria externa. Panorama distingue as duas perguntas e seus universos; déficit compara escala e composição; aluguel explicita limites de renda e diferenças PI/CE; condições da moradia não empilham categorias sobrepostas; métodos reúne downloads e ressalvas. A nota 8 em interação registra a limitação de não haver teste com leitor de tela e toque físico. Ações por teclado, filtros, histórico, downloads e contraste automatizado têm roteiro reproduzível.
