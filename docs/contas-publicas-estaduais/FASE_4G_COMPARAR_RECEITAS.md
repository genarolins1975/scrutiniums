# Fase 4G — comparação das receitas correntes

A comparação passa a cobrir as quatro parcelas exclusivas das receitas correntes: impostos, taxas e contribuições de melhoria; contribuições; transferências correntes; e demais receitas correntes agrupadas. As categorias na ficha de financiamento levam ao comparador, mantendo UF e ano.

## Contrato

- Todas as parcelas usam receitas correntes arrecadadas do mesmo ente e exercício como denominador. Receitas de capital e ajustes de RCL não entram nessa base.
- As parcelas somam 100% em cada UF. As medianas por parcela não recompõem necessariamente 100%: não representam a composição de um estado típico.
- CE-14 conserva fórmula e valores e aparece uma única vez no grupo de receitas. REC-TRIBUTARIA, REC-CONTRIBUICOES e REC-DEMAIS são decomposições analíticas da base existente, não novos indicadores CE ou novas observações do catálogo.
- O residual é receitas correntes menos tributária, contribuições e transferências. Não é somente a conta Outras Receitas Correntes. Não recebe código contábil inventado.
- A mediana não ponderada respeita região e elegibilidade. O DF segue excluído por padrão. Não há reaproveitamento de 2025 em 2026; valores ausentes permanecem ausentes, e valores numéricos iguais a zero não são convertidos em ausência.
- Maior participação não demonstra autonomia, eficiência ou qualidade dos serviços.

## Interface e exportação

O seletor distingue indicadores fiscais, composição das receitas correntes e composição da despesa liquidada. A tabela usa Categoria arrecadada e Receitas correntes para as receitas, preservando os rótulos de liquidação para as despesas. As quatro categorias da ficha oferecem acesso por link, com alvos de pelo menos 44 px.

O CSV mantém as colunas anteriores e acrescenta categoria_arrecadada_BRL, receitas_correntes_BRL, campo_receita e formula_medida. Nas medidas de receita, as colunas monetárias de despesa ficam vazias. Fórmula, código da conta quando houver, fonte original, arquivo e SHA-256 permitem conferir a origem.

## Validação local em 12/10/2026

- 33 testes TypeScript aprovados, incluindo reconciliação das quatro parcelas nas 27 UFs, manutenção de CE-14, filtros, DF, ausência de 2026 e CSV com fórmula do residual.
- Renderização React verificada: grupo de receitas, CE-14 sem duplicação, rótulos monetários corretos e ressalva sobre RCL.
- Sentinela independente calculada da base: PE/2025, receita tributária = 46,184068691041304%; mediana Nordeste = 40,16776637085154%, nove estados. A interface apresenta 46,18% e 40,17%.
- Tipos e lint aprovados na implementação; nenhum arquivo fiscal original, snapshot ou contrato educacional alterado.
- A revisão visual não foi concluída: o servidor local iniciou, mas não ficou acessível ao navegador neste ambiente isolado. Responsividade 320/390/768/1440, zoom de 200%, teclado e leitor de tela não verificados nesta etapa. Não se atribui nota estética ou conformidade por renderização automatizada.

Os arquivos alterados foram comparados com a versão publicada. O PR é preparado sobre a árvore atual de main para preservar as entregas concorrentes dos demais observatórios. Esta etapa não inclui nova publicação em produção.
