# Revisão e documentação da extensão

Build final: `YV2zK6pC7mvNhKA2c3aQW`, 25/10/2026. [Evidências](evidencias.md). Revisores independentes, somente leitura.

## Acabamento

Disposição final: **ship**. Os três achados foram classificados como **resolved**: barras públicas visíveis com o token `mineral`; abertura móvel com seleção, período, lucro, frase, comparação e primeiro degrau, cromo de 183 px dentro do teto de 200 px; comparação inicial por R$100 de rendas entre banco, agregado e mediana de pares, mesma janela e cobertura declarada. Nenhuma regressão material observada no lote. O parecer trata dessa lista, sem substituir os testes ou constituir certificação integral de acessibilidade.

## Documentação do sistema

Extensão ordinária, preservando a identidade existente. Não há PRODUCT.md ou DESIGN.md literal: a autoridade equivalente é a skill observatorio-layout e `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`, conforme ORIGEM.md do Impeccable. Não se criou documentação global paralela.

O módulo usa papel, carvão, bronze, mineral, superfície e linha do sistema; títulos herdam Playfair e corpo Inter. Controles nativos, filetes, cantos retos, foco explícito, movimento condicionado e ConviteAperitivo são reutilizados. Cascata vertical móvel, rubricas acionáveis, faixas tracejadas e comparação inicial são decisões desta superfície.

O documenter examinou contrato, JS/CSS/TSX, método, evidencias.md/json e capturas públicas/autenticadas. Registrou os resultados existentes de 12 combinações sem rolagem horizontal, violações axe, erros de console ou requisições indevidas ao login; não reexecutou testes. Não há raster novo no produto: as imagens são evidências de desenvolvimento.

Diferenças observadas: o módulo mantém tamanhos locais em px e destaque numérico sans, enquanto a norma global recomenda escala compartilhada e destaque em serifa. Isso não cria regra global; a origem temporal dessas diferenças não foi estabelecida. Drift documental preexistente: a tabela global ainda cita Crédito entre usos de painel escuro, embora o documento e styles.css registrem sua retirada. Registrado sem reparo fora do escopo.

## Verificação

- Pipeline completo: 2.479 testes, 11 pulados, sem falhas; camadas complementares também aprovadas.
- Cálculo bancário e reprodução da gold: 29 testes aprovados; seis DREs empíricas conciliadas com tolerância absoluta de R$1.
- Primeira execução de verificar:pr: lint, tipos, Python, build, cobertura bilíngue e 224 verificações do Judiciário aprovados. Vitest: 9.638 aprovados, 7 falhas, 12 pulados e 1 todo. Três falhas eram comprimento/posição da nova abertura; quatro eram limites de tempo em módulos existentes.
- Após correção e incorporação de main: novo build aprovado. Repetição com um worker: **63 testes aprovados**, incluindo os quatro arquivos antes reprovados e o painel de lucro. Não houve relaxamento dos limites de comprimento ou de tempo.
- As capturas finais incluem as três larguras, com e sem sessão. O painel sem conta redireciona ao login; a entrada pública permanece aberta.

- Filtro final `npm run verificar:rapido`: lint, tipos, derivados e cobertura bilíngue aprovados; **7.204 testes aprovados em 277 arquivos**, 12 pulados e 1 todo.
