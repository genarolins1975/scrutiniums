# Fase 4F — comparação da composição das despesas

A comparação estadual passa a incluir as seis categorias exclusivas da despesa liquidada: pessoal e encargos, juros, outras correntes, investimentos, inversões financeiras e amortização. Cada percentual usa o total liquidado do mesmo ente, período e perímetro. As parcelas recompõem 100% nas 27 UFs em 2025.

O seletor separa indicadores fiscais e composição da despesa. As medidas DESP-* são decomposições analíticas da base existente, não novos contratos CE nem novas observações do catálogo: permanecem sete indicadores e 216 observações. A mediana é não ponderada, recalculada no recorte regional; o DF permanece excluído por padrão. Ausências não viram zero.

Cada parcela da ficha leva à respectiva comparação. A tabela mostra numerador e denominador em reais nominais, além do percentual, diferença em pontos percentuais e fonte original. O CSV preserva as colunas existentes e acrescenta categoria_liquidada_BRL, total_liquidado_BRL e cod_conta; essas colunas ficam vazias para medidas fiscais que não sejam composição.

## Validação

- 29 testes TypeScript aprovados, incluindo reconciliação das seis parcelas nas 27 UFs, referência regional, DF, ausência de 2026, filtros e CSV.
- TypeScript completo e lint dos arquivos alterados aprovados no ambiente recuperado.
- Revisão anterior no navegador local: investimentos/Nordeste/2025 com nove estados; mediana 9,67%, Pernambuco 8,26% e diferença -1,40 p.p. A diferença usa valores sem arredondamento intermediário.
- Detalhes abertos por Enter, com numeradores e denominadores conferidos na tabela. Captura desktop revisada. Revisão visual estreita, zoom 200% e leitor de tela continuam pendentes.
- O ambiente foi trocado durante a etapa; alterações reaplicadas sobre 4da34013faa5b43acb770db2795def78e97a03fd e testes repetidos antes do commit.

Maior participação de uma despesa não implica eficiência. Investimentos não comprovam obras concluídas; a medida de pessoal do RREO não substitui o conceito legal da LRF. Nenhum novo dado educacional foi promovido.
