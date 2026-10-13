# Riscos do setor elétrico — análise e laboratórios

Rota: `/setor-eletrico/transicao/riscos`. Revisão editorial: outubro de 2026.

## Problema e mudança

A versão anterior apresentava cinco textos introdutórios e duas identidades físicas. A nova análise conecta engenharia, exposição contratual, continuidade, resultado econômico e liquidez. Preserva os dois indicadores ONS e suas evidências, mas não os usa para calibrar exemplos sintéticos.

Conteúdo: dez famílias de exposição, filtro por perspectiva, três cadeias de choques conjuntos, quatro laboratórios, oito definições técnicas e roteiro de diligência. A página usa exclusivamente os tokens, fontes e infraestrutura React/URL do projeto, sem dependência nova.

## Curadoria e limites de atribuição

O catálogo reproduzível está em `src/lib/energia/riscos-referencias.ts`, com URL, edição, contribuição e uso local. Foram consultadas fontes primárias: McKinsey (merchant risk, 2018; storage valuation, 2025), BCG (flexibilidade, 2026), DNV (avaliação de armazenamento, página sem data), Modo Energy (risco de sobreoferta BESS na Alemanha, janeiro de 2026), WTW/Willis (seguros e financiamento de renováveis, janeiro de 2025), IEA (resiliência 2022, segurança 2021, energia e IA 2026), NERC (LTRA edição 2025, publicada em 2026) e NIST (SP 800-82r3 final, 2023). Referências ONS, EPE e DOE anteriores são preservadas quando relacionadas ao conteúdo.

No caso WTW, o servidor rejeitou a leitura integral e somente o resumo público indexado foi utilizado, explicitamente identificado. Modo foi usado apenas no trecho público. Não houve acesso a conteúdo restrito. Revisão 4 do NIST em consulta não é tratada como final. Artigos antigos sustentam conceitos, não preços, cenários ou regras atuais. Não se atribui às fontes aprovação ou validação dos nossos simuladores.

Não foram importadas taxas de perda, preços europeus, previsões de receita de baterias ou critérios norte-americanos de adequação para ativos brasileiros. Cenários e cálculos são próprios e identificados como hipotéticos. Nenhum rating de empresa, forecast de PLD, probabilidade de apagão no SIN ou perda climática por ativo é publicado.

## Contratos dos modelos

Implementação pura: `src/lib/energia/riscos-modelos.ts`. Todos os valores de entrada são finitos; grandezas físicas, percentuais e denominadores têm validação própria. Cálculos não arredondam parcelas, apenas apresentação.

### Receita e dívida

`G = Q0 × recurso × (1 − corte)`; `Pcapt = P × captura`.

- Volume fixo com perfil plano: `R = G × Pcapt + Q0 × h × (K − P)`.
- Venda proporcional à produção: `R = G × [h × K + (1 − h) × Pcapt]`.
- `CFADS = R − OPEX caixa − outras saídas informadas`.
- `DSCR = CFADS / (juros + principal)`; sem serviço da dívida, resultado ausente/não aplicável.
- `dR/dP = G × captura − Q0 × h`, fixo; `G × (1 − h) × captura`, proporcional, demais parâmetros constantes.

A receita física a mercado mais ajuste contratual é uma identidade financeira estilizada, não uma reprodução da CCEE. No fixo, o preço do hedge é a média temporal do mesmo mercado e a entrega é plana. No proporcional, o contrato cobre somente energia efetivamente gerada. Não há basis, ressarcimentos, perdas, encargos, indexação, MRE/GSF ou insolvência no cálculo. Outras saídas representam tributos, CAPEX de manutenção e capital de giro, sem duplicar OPEX. O DSCR é anual e não prova cobertura mensal nem covenant.

Comparação de contratos, narrativa de cenário ativo, barras assinadas com subtotais identificados e matriz 4×4 de preço/corte preservam premissas comuns. Três cenários conjuntos não têm probabilidades. O exemplo independente de preço capturado distingue ponderação por horas e por MWh, devolvendo fator ausente se preço de referência não positivo.

### Bateria

Energia útil na saída AC. Potência igual na carga e descarga; rendimento de ida e volta. Ciclos efetivos = mínimo(ciclos programados; 8.760/(duração descarga + duração carga)) × disponibilidade. O limite usa capacidade inicial, conservador quando há degradação.

`Saída(t) = capacidade inicial × (1 − degradação)^(t−1) × ciclos efetivos`; entrada = saída/eficiência. Degradação inicia no segundo ano.

Caixa = venda − compra − custo variável − OPEX fixo. CAPEX no instante zero, fluxos no fim do ano, preços e custos reais constantes, taxa real. VPL antes de impostos e dívida, sem valor residual, reposição ou receitas adicionais. Preço de venda de equilíbrio = (CAPEX + VP das compras e custos)/VP dos MWh de saída. Sem energia, preço de equilíbrio ausente, nunca infinito.

Margem bruta por ciclo permanece visível e diferenciada do fluxo anual e do VPL. Sensibilidade de venda ±30% não supõe distribuição probabilística. Serviços adicionais requerem elegibilidade e co-otimização; seus máximos não são somados.

### Interrupção e seguro

Um evento binário por ano, severidade fixa condicional; probabilidade do leitor. Dano material + dias × margem perdida (após custos evitados). Seguro hipotético: franquia exclusiva do dano, espera em dias exclusiva de interrupção e limite compartilhado. Indenização nunca excede perda bruta. Sem cobertura BI, somente dano elegível. Retida = bruta − indenização. Média anual = p × retida. Adaptação reduz dano e duração na mesma proporção, sem alterar probabilidade ou apólice.

Sem estimação de ameaça/vulnerabilidade, PML, VaR ou retorno climático; sem prêmios ou custo de adaptação. Perda bruta não é denominada pico de necessidade de caixa. Custo social e perda empresarial não são somados. A fórmula não representa uma apólice real.

### Data center

TI × uso × PUE; ano de 8.760 h. Pico deve ser ≥ média. Conexão em MW é hipótese técnica, não aprovação de acesso. Atraso em meses uniformes reduz primeiro ano sem alterar regime anual. Redução no evento desloca energia que é integralmente recuperada depois, sobre carga média, sem ganho ou perda energética. PUE é constante. Se eventos + recuperação excedem as horas do ano, a interface sinaliza agenda inviável. Não há avaliação de estabilidade, potência firme, disponibilidade hídrica ou SLA.

## Interação e reprodução

Todos os parâmetros e perspectiva são persistidos na URL usando `useEstadoUrl`. Cada laboratório exporta JSON com versão, natureza do cenário, URL, entradas e saídas integrais. Valores não válidos não substituem o modelo por zero. Controles numéricos complementam sliders. Métodos e tabelas completas usam `details`; ressalvas materiais ficam visíveis. Tabelas largas têm rolagem local e região nomeada.

## Verificação

- 30 testes numéricos em `energia-riscos-modelos.test.ts`: conservação, reconciliação, sinal do hedge, preço de equilíbrio, casos extremos, seguro, adaptação, recuperação de carga e entradas inválidas.
- Os 15 testes anteriores de leitura integrada permanecem.
- Lint, TypeScript, suíte Energia, build e inspeção responsiva: resultados registrados após execução, abaixo.
- Capturas antes/depois em `docs/energia-riscos/`.

A autoavaliação visual não equivale a revisão independente. Testes automatizados não demonstram conformidade integral com WCAG nem validação econômica dos modelos.
