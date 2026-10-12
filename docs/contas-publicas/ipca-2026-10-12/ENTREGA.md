# Comparações fiscais corrigidas pelo IPCA

Continuação da fase 4 do relatório de melhoria. Base: `6d9a90fa8782b96afceb3084b32361c5096a9122` (PR #160). Escopo restrito ao comparador do panorama fiscal e à documentação/download de sua fonte.

## Entrega

- Quarta opção de escala: corrigido pelo IPCA, ao lado de nominal, por habitante e % do PIB.
- Mesmo intervalo em cada ano: 2024 × 2023 completos; 2025 × 2024 completos; janeiro–julho de 2026 × janeiro–julho de 2025.
- Base comum de preços: julho de 2026, último mês da edição RTN integrada. Não acompanha automaticamente a data do sistema.
- Maior despesa, maior mudança em magnitude e participações recalculadas na escala selecionada. A participação real divide grupo corrigido pelo total corrigido.
- Taxas nominal e real identificadas separadamente em cada grupo. CSV contém valores nas duas bases, taxas, unidades e mês-base. Sem arredondamento antes dos cálculos.
- Índices oficiais e proveniência em `/contas-publicas/ipca.json`; acesso pelo catálogo e comparador.

## Contrato de dados

IBGE/SIDRA, tabela 1737, variável 2266, número-índice do IPCA nacional (dezembro/1993 = 100). Arquivo bruto e manifesto em `data/contas-publicas/ipca-2026-10-12/`. São 43 meses, de janeiro/2023 a julho/2026. O SHA256 está no manifesto. Publicação da série na API não identificada: `null`, sem inferência a partir da captura.

Transformação: para cada fluxo mensal `V(m)`, calcula-se `V(m) × I(julho/2026) / I(m)`. Somam-se depois os meses corrigidos. O índice do próprio mês representa a base de preços do fluxo; esta operação não é a calculadora de atualização contratual a partir do início do mês. Não se aplica a inflação de dezembro ao total anual e não se anualizam meses disponíveis.

O importador recusa hash divergente, unidade/variável/território incompatível, recortes não exclusivos, mês ausente e índice não positivo ou não finito. O motor recusa também fluxos duplicados, ausentes ou não finitos e base indisponível. Falhas não substituem a última versão válida. Build sem rede para dados.

IPCA mede preços de consumo das famílias, não uma cesta de compras do governo. Não inferir volume de serviços, qualidade ou eficiência de crescimento real. São cálculos Scrutiniums sobre RTN e IBGE, não uma série real oficial do Tesouro. A opção real não é combinada com % do PIB. As séries existentes e o painel de custos não foram modificados.

Referência institucional: https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html

## Verificação antes do PR

- 53 testes TypeScript do domínio aprovados, incluindo identidade fiscal, soma das categorias, janela parcial, invariância das taxas à troca da base comum, distinção entre zero e ausência e unidades do CSV.
- 10 testes Python dos importadores IPCA e denominadores aprovados. Os 6 testes do importador IPCA e a reprodução do snapshot também são executados pelo teste TypeScript para entrarem no CI existente.
- TypeScript, lint dos arquivos alterados e build de produção (558 páginas) aprovados.
- Revisão da interface no preview e CI completo são etapas posteriores à criação do PR. Nenhuma conformidade integral de acessibilidade é presumida pelos testes automáticos.
