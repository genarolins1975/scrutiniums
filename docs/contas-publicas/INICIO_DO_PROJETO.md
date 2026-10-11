# Observatório Brasileiro de Contas Públicas — Governo Federal

## Entrega 0.1

Início autorizado em 11/10/2026. Entrega de estrutura e metodologia, sem séries fiscais integradas. Não apresentar como painel de resultados operacionais concluído.

- Rota `/contas-publicas`: introdução, percurso de gestão e mapa de 12 capítulos.
- Rota `/contas-publicas/[capitulo]`: 12 fichas temáticas com perguntas e indicadores.
- Rota `/contas-publicas/dados`: 24 indicadores pesquisáveis, fontes e download.
- Rota `/contas-publicas/metodologia`: regras de interpretação e referências.
- Rota `/contas-publicas/catalogo.json`: contrato exportável, sem observações.
- Navegação compartilhada entre observatórios inclui Contas Públicas.
- Sem novas dependências, escore, dados demonstrativos ou alteração dos demais painéis.

O catálogo tipado em `src/lib/contas-publicas/catalogo.ts` é a fonte única para as fichas, filtros e download. Fontes são candidatas: apontar um portal não certifica que todos os campos necessários estão disponíveis nele. Especialmente projetos, riscos fiscais, produtividade e territorialização exigem fontes complementares e auditoria de cobertura.

## Perímetros e identidade

Orçamento Fiscal e da Seguridade Social é o perímetro inicial de execução. Governo Central serve ao RTN. Governo Geral fica em comparação internacional separada. Investimentos de estatais não dependentes e riscos associados exigirão conjunto próprio. Financiador, executor e território beneficiário são dimensões diferentes.

Identidades mínimas: exercício, órgão, unidade orçamentária/gestora, função, subfunção, programa, ação, subtítulo, natureza, modalidade de aplicação, fonte, identificador de resultado primário e estágio. Preservar códigos de origem e versões de classificações. Programas, órgãos e produtos podem mudar de identidade entre exercícios; sem ponte homologada, sinalizar quebra.

## Contrato de observação a implementar na etapa de dados

Cada registro: indicador_id, valor (ou null), unidade, período inicial/final, perímetro, estágio, base de preços, classificação/versão, natureza (observado/calculado/estimado/previsto/cenário), status (disponível/ausente/inelegível/cobertura-insuficiente), justificativa, fonte_id, URL exata do recurso, publicação, captura UTC, hash SHA-256 do arquivo bruto, versão da transformação e cobertura.

Valor zero disponível não é null. Não finitos são inválidos. Datas desconhecidas permanecem null; nunca inferir publicação da data de captura. Ausência não recebe nota zero. Percentuais calculados precisam de numerador e denominador auditáveis; o valor não é truncado automaticamente em 100%. A função compararRecortes protege operações diretas no mesmo período, não substitui harmonização de séries históricas nem autoriza comparações internacionais.

## Próxima entrega: núcleo orçamentário conciliado

1. Homologar downloads/APIs SIOP e RTN. Registrar acesso, formatos, licença, calendário e cobertura dos campos. Não depender de automação de páginas gráficas quando houver arquivos oficiais.
2. Selecionar o último exercício encerrado com dados completos disponíveis e, separadamente, o exercício corrente até o último mês fechado. A seleção é derivada da fonte, não da data de execução do código.
3. Manter arquivos brutos imutáveis, normalização e camada de indicadores separadas. Publicação atômica somente após validação; preservar última versão válida em falha de atualização.
4. SIOP: dotação inicial, atualizada, empenhado líquido, liquidado e pago do exercício. RAP separado por origem e processamento; confirmar fonte complementar se o extrato não suportar essa granularidade.
5. RTN: receitas, despesas e resultado do mesmo perímetro. Não reconciliar RTN com execução orçamentária por igualdade simples: produzir ponte de regime, estágio, cobertura e ajustes.
6. Conciliação: soma de categorias com total oficial, chave única, unidade, período, revisões, completude e sinais. Tolerância definida por precisão publicada e registrada por fonte; não tolerância genérica arbitrária.
7. Fórmulas: executar com testes sobre amostras reais versionadas. Detecção de ano parcial, denominador inválido, revisões negativas e alterações de classificação.
8. Páginas de panorama, planejamento, execução e restos a pagar recebem gráficos, tabelas e CSV somente após passar as conciliações. Exibir cobertura e calendário próprios.

## Fases seguintes

| Fase | Entrega | Aceite |
|---|---|---|
| 2 | Núcleo orçamentário e fiscal | Totais conciliados, séries versionadas, tabelas e exportação |
| 3 | Três políticas-piloto: transferência, serviço direto, investimento | Relação documentada entre recursos, produtos, público e metas |
| 4 | Compras, investimentos, benefícios e território | Pares elegíveis, escopo comparável e fontes complementares homologadas |
| 5 | Avaliações e comparador internacional | Perímetros compatíveis, evidências classificadas e cobertura explícita |
| 6 | Eventual síntese multidimensional | Pesos, normalização, cobertura, sensibilidade e revisão metodológica |

## Produto e integração

Contas Públicas examina o financiamento e a gestão federal. OBEE examina serviços e resultados. Ligações futuras programa–política–serviço são muitos-para-muitos e devem informar contribuição federal sem atribuir causalidade automática. O catálogo atual usa o design system e o monograma existentes; não cria marca alternativa.

Esta fase é deliberadamente uma área de estruturação, com `noindex`, sem falsa aparência de atualização mensal. Integração à home comercial, metadados gerais e seletor autenticado fica para o primeiro núcleo com dados, evitando anunciar uma nova cobertura quantitativa que ainda não existe.

## Referências

- PEFA: https://www.pefa.org/node/119
- OCDE: https://www.oecd.org/en/publications/government-at-a-glance-2025_0efd0bcd-en/full-report.html
- FMI, transparência: https://www.imf.org/en/topics/fiscal-policies/fiscal-transparency
- FMI, PIMA: https://infrastructuregovern.imf.org/content/PIMA/Home/PimaTool/What-is-PIMA.html
- Open Budget Survey: https://internationalbudget.org/open-budget-survey/country-results/2025/brazil
- Canadá: https://www.canada.ca/en/government/system/government-wide-reporting-spending-operations/government-spending.html
- França: https://www.budget.gouv.fr/reperes/performance
- TCU: https://portal.tcu.gov.br/publicacoes-institucionais/cartilha-manual-ou-tutorial/referencial-de-controle-de-politicas-publicas

Essas referências fundamentam o desenho; não representam endosso, certificação ou avaliação oficial do observatório.

## Verificação

- TypeScript estrito do novo domínio e suas dependências: aprovado.
- Testes das regras de cálculo e integridade do catálogo: 4 testes aprovados.
- Servidor Next local: bloqueado pelo ambiente (`listen EPERM`), tanto em localhost quanto em interface geral. Não foi solicitada alteração de permissões.
- Renderização estática dos componentes reais: início, catálogo, metodologia e execução geraram HTML sem erro.
- Revisão visual e responsividade: não verificadas. Chrome automatizado não iniciou; a política do navegador recusou a abertura de arquivo local (`file:`). Não foram usadas rotas alternativas para contornar esse bloqueio.
- Build completo e navegação Next hidratada: não verificados localmente. CI do repositório e preview devem complementar antes de integração em produção.
- A avaliação estética não é independente e não recebe nota 9/10 sem evidência de todas as tarefas e estados.

Não foram executados merge ou deploy de produção nesta etapa.
