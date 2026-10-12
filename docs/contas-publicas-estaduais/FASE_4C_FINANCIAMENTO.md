# Fase 4C — financiamento e composição de receitas

A ficha das 27 UFs passa a explicar a composição das receitas de 2025 e publica CE-10 (margem corrente) e CE-14 (participação das transferências correntes). São sete medidas com observação primária: 189 observações anuais de 2025 e 27 observações parciais de dívida de 2026, totalizando 216. As outras 41 medidas continuam sem observação publicada.

Esta etapa reutiliza as mesmas 81 respostas preservadas do Tesouro. Não modifica arquivos originais, hashes, tratamento do DF, coletor educacional nem saldos das etapas anteriores.

## Contratos e limites

- CE-10 = 100 × (receitas correntes arrecadadas − despesas correntes liquidadas) / receitas correntes arrecadadas.
- CE-14 = 100 × transferências correntes arrecadadas / receitas correntes arrecadadas.
- Fonte: RREO Anexo 01, sexto bimestre de 2025, esfera estadual, conta e estágio contábil explícitos.
- O perímetro exclui receitas e despesas intra-orçamentárias; refinanciamento é destacado fora dele.
- Correntes e capital devem reconciliar com a arrecadação total do perímetro, com tolerância de R$ 0,02.
- A composição corrente contém receita tributária, contribuições, transferências e um residual agrupado. O residual abrange receitas patrimoniais, agropecuárias, industriais, de serviços e outras correntes; não corresponde apenas à conta “Outras Receitas Correntes”.
- Ausências, duplicidades, valores não finitos, receitas correntes não positivas e composição negativa impedem publicação. Zero observado e margem negativa são preservados.
- Receitas correntes não equivalem à RCL. Margem corrente não equivale a caixa disponível ou resultado primário. Essas medidas não representam, isoladamente, eficiência, eficácia ou autonomia.
- O comparador mantém o DF separado por padrão, filtros compartilháveis e mediana do grupo. Não se imputam valores de 2025 em 2026.

## Interface e exportação

A ficha apresenta o total arrecadado, correntes e capital; composição com valores e percentuais; barras de receitas e despesas na mesma escala; e cálculo da margem. Os detalhes abrem a tabela de valores, código contábil, fonte, arquivo original e SHA-256. O CSV específico contém sete campos, margem em reais e duas razões com fórmulas e proveniência. Catálogo, matriz, comparador e downloads gerais incorporam as novas observações.

## Validação

- 43 testes Python aprovados, incluindo oito contratos novos: reconciliação nas 27 UFs, sentinela PE, ausência e duplicidade de campos, linhas intra-orçamentárias, margem negativa, zero real e identidade da fonte.
- 23 testes TypeScript aprovados, incluindo composição, comparador e exportação.
- Consolidação reproduzida: 81 capturas, 216 observações; tipos e lint dos módulos aprovados.
- A inspeção visual da nova prévia será registrada após a implantação; não está implícita nos testes acima.
- Contratos, recaptura fiscal e captura educacional permanecem no workflow do PR; falhas de fonte continuam visíveis.

## Educação

O pipeline educacional permanece preparatório. A captura oficial falhou por erros de conexão/certificado, documentados em `evidencias/educacao-captura-20261012.json`. Não se desabilitou a verificação TLS, não se substituíram estados por capitais e não se publicou resultado educacional sem a fonte.

A entrega permanece em PR de rascunho e prévia. Não houve merge nem publicação em produção.
