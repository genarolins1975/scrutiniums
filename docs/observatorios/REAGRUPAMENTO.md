# Reagrupamento da plataforma em seis observatórios

Proposta de 17/10/2026, aprovada pelo dono da plataforma na mesma data.
Situação da implementação no fim deste documento. Inventário lido dos catálogos do código em `main` nessa data:
`src/lib/data/observatorioAbas.ts`, `src/lib/energia/navegacao.ts`,
`src/lib/saneamento/capitulos.ts`, `src/lib/gas/navegacao.ts`,
`src/lib/contas-publicas/catalogo.ts`, `src/lib/eficiencia/dimensoes.ts`,
`src/lib/agro/modelo.ts` e as rotas de `src/app`.

## Decisões já tomadas

1. Seis observatórios, um para cada pergunta da camada aberta, no lugar dos
   oito atuais.
2. O Crédito se divide: o que fala da vida financeira das famílias vai para o
   Observatório das Famílias; o sistema financeiro fica no Observatório da
   Economia.
3. Os seis passam a ser os observatórios. Os atuais (Setor Elétrico, Saneamento,
   Gás Natural, Contas Federais e os demais) viram coleções dentro deles, com o
   mesmo nome. Motivo: uma palavra só para a unidade principal; "observatório
   dentro de área" criaria duas camadas com nomes que competem.
4. Camada aberta é aperitivo; a profundidade fica nos painéis com conta.

## Regras

1. **Cada painel tem um observatório dono.** Onde mais o tema aparecer, aparece
   como link ("Para ir além"), nunca como cópia.
2. **Endereços não mudam.** Nenhuma URL atual é renomeada ou removida; mudam
   navegação, entradas, trilhas e o registro de domínios. Links externos, busca
   e o sitemap continuam válidos.
3. **Coleções inteiras se preservam.** Setor Elétrico, Saneamento, Gás Natural,
   Contas Federais, Contas Estaduais e o núcleo do Crédito entram inteiros.
4. **Mesma arquitetura nos seis.** Página aberta (pergunta, três números com
   prova, convite) e entrada com conta (números de escala, diagrama do
   mecanismo, painéis agrupados por subpergunta, ficha do lugar, método). A
   entrada do Crédito é a referência.

## Os seis observatórios

| # | Observatório | Pergunta da camada aberta | Coleções |
|---|---|---|---|
| 1 | Observatório das Famílias | Quanto custa viver e quanto pesa a dívida das famílias? | Renda e trabalho; Dívida e crédito das famílias; Proteção social; Moradia; Custo de vida (links) |
| 2 | Observatório dos Serviços Públicos | Escola, saúde, segurança e justiça chegam a quem precisa? | Educação; Saúde; Segurança pública; Justiça; Cultura; Síntese das capitais |
| 3 | Observatório das Contas Públicas | De onde vem e para onde vai o dinheiro dos impostos? | Contas Federais; Contas Estaduais; Dívida e crédito dos governos |
| 4 | Observatório de Energia e Infraestrutura | De onde vêm a energia, a água e o transporte, e quanto custam? | Setor Elétrico; Gás Natural; Saneamento; Mobilidade; Conectividade |
| 5 | Observatório da Economia | O que o Brasil produz, vende ao mundo e financia? | Crédito e sistema financeiro; Pagamentos; Empresas e risco; Agronegócio |
| 6 | Observatório do Território e Clima | O que está mudando no ambiente e quem sente primeiro? | Desmatamento e emissões; Cidades e clima; links para secas, água e clima e transição |

## Mapa painel por painel

Legenda da última coluna: **dono** (o painel passa a morar aqui), **link**
(aparece aqui só como atalho; o dono está indicado), **duplicata** (dois painéis
tratam do mesmo tema; precisa de comparação de conteúdo antes de decidir).

### 1. Observatório das Famílias

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Renda e trabalho | Trabalho e renda (13 páginas) | `/eficiencia-estatal/trabalho-renda` | Eficiência Estatal | dono |
| Renda e trabalho | Emprego formal | `/observatorio/formal-employment` | Crédito | duplicata com `/eficiencia-estatal/trabalho-renda/emprego-formal` |
| Dívida e crédito das famílias | Consignado e aposentados | `/observatorio/payroll-lending-aging` | Crédito | dono |
| Dívida e crédito das famílias | Apostas e crédito das famílias | `/observatorio/bets-financial-risk` | Crédito | dono |
| Dívida e crédito das famílias | Golpes e fraudes | `/observatorio/financial-fraud` | Crédito | dono |
| Dívida e crédito das famílias | Desenrola Brasil | `/observatorio/desenrola` | Crédito | dono |
| Dívida e crédito das famílias | Clientes contra bancos na Justiça | `/observatorio/lawsuits` | Crédito | dono |
| Dívida e crédito das famílias | Bancos cobrando na Justiça | `/observatorio/debt-collection-lawsuits` | Crédito | dono |
| Dívida e crédito das famílias | Sanções e reclamações | `/observatorio/conduct-enforcement` | Crédito | dono |
| Proteção social | Assistência social e cuidado | `/eficiencia-estatal/assistencia-social` | Eficiência Estatal | dono |
| Proteção social | Segurança alimentar | `/eficiencia-estatal/seguranca-alimentar` | Eficiência Estatal | dono |
| Proteção social | Inclusão energética (tarifa social de luz) | `/setor-eletrico/inclusao-energetica` | Setor Elétrico | link (dono: Energia e Infraestrutura) |
| Proteção social | Conta e tarifa social da água | `/saneamento/tarifa-social` | Saneamento | link (dono: Energia e Infraestrutura) |
| Moradia | Habitação (déficit, aluguel, inadequação) | `/eficiencia-estatal/habitacao` | Eficiência Estatal | dono |
| Moradia | Crédito imobiliário e moradia | `/observatorio/housing-credit` | Crédito | dono |
| Custo de vida | Comida no prato | `/agronegocio/prato` | Agronegócio | dono |
| Custo de vida | Alimentos (capítulo) | `/agronegocio/alimentos-consumo` | Agronegócio | dono |
| Custo de vida | Gás de cozinha | `/gas-natural/gas-de-cozinha` | Gás Natural | link (dono: Energia e Infraestrutura) |
| Custo de vida | Conta de luz | `/setor-eletrico/conta-de-luz` | Setor Elétrico | link (dono: Energia e Infraestrutura) |
| Custo de vida | Preço regulado da água | `/saneamento/preco-regulado` | Saneamento | link (dono: Energia e Infraestrutura) |

### 2. Observatório dos Serviços Públicos

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Educação | Educação nas capitais | `/eficiencia-estatal/educacao-municipal-capitais` | Eficiência Estatal | dono |
| Saúde | Saúde nas capitais | `/eficiencia-estatal/saude-capitais` | Eficiência Estatal | dono |
| Saúde | Saúde e ambiente (doenças ligadas ao saneamento) | `/saneamento/saude-ambiente` | Saneamento | link (dono: Energia e Infraestrutura) |
| Segurança pública | Segurança pública | `/eficiencia-estatal/seguranca-publica` | Eficiência Estatal | dono |
| Justiça | Justiça e direitos (acesso à justiça) | `/eficiencia-estatal/acesso-justica` | Eficiência Estatal | dono |
| Justiça | Judiciário: filas e tempos | `/eficiencia-estatal/judiciario` | Eficiência Estatal | dono |
| Cultura | Cultura | `/eficiencia-estatal/cultura` | Eficiência Estatal | dono |
| Síntese das capitais | Índice experimental de resultados | `/eficiencia-estatal/laboratorio-cesta` | Eficiência Estatal | dono |
| Síntese das capitais | Entrada atual da Eficiência Estatal (comparação de capitais) | `/eficiencia-estatal` | Eficiência Estatal | dono (vira a entrada do observatório) |

### 3. Observatório das Contas Públicas

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Contas Federais | Panorama das contas | `/contas-publicas/panorama` | Contas Federais | dono |
| Contas Federais | Execução e previsibilidade | `/contas-publicas/execucao` | Contas Federais | dono |
| Contas Federais | Restos a pagar | `/contas-publicas/restos-a-pagar` | Contas Federais | dono |
| Contas Federais | Custos e produtividade | `/contas-publicas/custos` | Contas Federais | dono |
| Contas Federais | Metas e entregas | `/contas-publicas/metas` | Contas Federais | dono |
| Contas Federais | Planejamento, compras, investimentos, benefícios, equidade, riscos, avaliação | `/contas-publicas/<capítulo>` | Contas Federais | dono (método proposto, sem série; continua identificado assim) |
| Contas Estaduais | Estados lado a lado, ficha estadual, fichas de prova, cobertura, catálogo | `/contas-publicas-estaduais` | Contas Estaduais | dono |
| Dívida e crédito dos governos | Crédito a estados e municípios | `/observatorio/subnational-credit` | Crédito | dono |
| Dívida e crédito dos governos | Dívida com a União | `/observatorio/federal-tax-debt` | Crédito | dono |

### 4. Observatório de Energia e Infraestrutura

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Setor Elétrico | Os 21 destinos publicados (visão geral, minha região, água e clima, geração, carga, rede, PLD e modelos, mercado, leilões, conta de luz, perdas, qualidade, inclusão energética, empresas, expansão, transição, regulação, aprenda, dados, método) | `/setor-eletrico/*` | Setor Elétrico | dono, coleção inteira |
| Gás Natural | As 11 páginas (produção, aproveitamento, importação, preços na cadeia, gás de cozinha, GNV e gás encanado, mercado, infraestrutura, regulação, dados, método) | `/gas-natural/*` | Gás Natural | dono, coleção inteira |
| Saneamento | Os 14 capítulos e as ferramentas (meu município, comparar, Brasil no mundo, método) | `/saneamento/*` | Saneamento | dono, coleção inteira |
| Saneamento | Saneamento da Eficiência Estatal: água, esgoto, recursos | `/eficiencia-estatal/saneamento` | Eficiência Estatal | duplicata com a coleção Saneamento |
| Mobilidade | Mobilidade e transporte | `/eficiencia-estatal/mobilidade-transporte` | Eficiência Estatal | dono |
| Conectividade | Energia e conectividade | `/eficiencia-estatal/energia-conectividade` | Eficiência Estatal | duplicata parcial: a parte de energia com o Setor Elétrico; a de conectividade fica como dona |

### 5. Observatório da Economia

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Crédito e sistema financeiro | Mapa, visão geral, pulso do crédito, quem toma crédito e onde, estados, crédito por município | `/observatorio/{map,overview,credit,credit-panorama,states,credit-penetration}` | Crédito | dono |
| Crédito e sistema financeiro | Instituições, produtos, juros por instituição, comparar, quem entra e sai do SFN, captação, prazo da carteira, consórcios | `/observatorio/{institutions,products,interest-rates,compare,sfn-entries-exits,funding,loan-maturity,consortia}` | Crédito | dono |
| Crédito e sistema financeiro | Bancos na bolsa, bancos e mercado de capitais, FIDCs, rede, pessoas e auditoria | `/observatorio/{market,broad-credit,fidc-receivables,operational-indicators}` | Crédito | dono |
| Crédito e sistema financeiro | Crédito direcionado e BNDES, crédito rural | `/observatorio/{directed-credit-bndes,rural-credit}` | Crédito | dono; crédito rural é duplicata parcial com `/agronegocio/apoio` |
| Crédito e sistema financeiro | Sinais antecedentes, buscas no Google, cenários, central de alertas, marcos regulatórios, perguntas rápidas, método | `/observatorio/{leading-signals,search-trends,scenarios,alerts,regulacao,research,methodology}` | Crédito | dono |
| Pagamentos | Pix e pagamentos, Open Finance | `/observatorio/{pix,open-finance}` | Crédito | dono |
| Empresas e risco | Risco setorial, recuperações e falências | `/observatorio/{sectors,recoveries}` | Crédito | dono |
| Agronegócio | Tamanho, conjuntura, insumos, mercados, produtores, apoio público | `/agronegocio/{tamanho,conjuntura,insumos,mercados,produtores,apoio}` | Agronegócio | dono |
| Agronegócio | Atlas, comparador, cadeias, panorama, síntese, aprenda, glossário, método | `/agronegocio/{atlas,comparar,cadeias,panorama,sintese,aprenda,glossario,metodologia}` | Agronegócio | dono |
| Agronegócio | Capítulos produção, custos e renda, logística e mercados, empresas e trabalho, crédito e proteção, políticas e inclusão | `/agronegocio/<capítulo>` | Agronegócio | dono |

### 6. Observatório do Território e Clima

| Coleção | Painel atual | Rota | Origem | Situação |
|---|---|---|---|---|
| Desmatamento e emissões | Quanto se desmata e quanto o campo emite | `/agronegocio/ambiente` | Agronegócio | dono |
| Desmatamento e emissões | Capítulo clima e ambiente | `/agronegocio/clima-ambiente` | Agronegócio | dono |
| Cidades e clima | Meio ambiente e clima (drenagem, risco de inundação, resíduos) | `/eficiencia-estatal/meio-ambiente-clima` | Eficiência Estatal | dono |
| Cidades e clima | Secas e eventos extremos no abastecimento | `/saneamento/resiliencia` | Saneamento | link (dono: Energia e Infraestrutura) |
| Cidades e clima | Água e clima das hidrelétricas | `/setor-eletrico/agua-e-clima` | Setor Elétrico | link (dono: Energia e Infraestrutura) |
| Cidades e clima | Transição e ambiente (emissões da geração, solar distribuída) | `/setor-eletrico/transicao` | Setor Elétrico | link (dono: Energia e Infraestrutura) |

## Pontos que pedem atenção

1. **Território e Clima é o observatório mais fino:** três painéis próprios e
   três links. É também onde entram os próximos temas já listados como lacuna
   (queimadas, desastres da Defesa Civil, inventário oficial de emissões).
   Alternativa, se preferir não abrir um observatório fino: começar como
   coleção do Observatório da Economia e promovê-lo quando houver base.
2. **Quatro duplicatas** precisam de comparação de conteúdo antes de escolher o
   dono: emprego formal, saneamento da Eficiência Estatal, energia da Eficiência
   Estatal e crédito rural com o apoio público do Agro.
3. **O Crédito é uma aplicação própria** (JavaScript puro em `public/obs`) com
   menu de 44 abas. Dividi-lo entre dois observatórios exige que o menu interno
   mostre só a coleção corrente e leve à outra por link. É a maior obra técnica
   do reagrupamento.
4. **A apresentação pública do Crédito** (`/observatorio-do-credito`) é citada
   pela imprensa e indexada. Proposta: manter a rota e transformá-la na página
   aberta do Observatório da Economia, com redirecionamento só se você decidir.
5. **Telemetria e escolha pós login** usam os oito domínios atuais
   (`src/lib/dominios.ts`, cookie do observatório). A troca para seis precisa
   de mapeamento dos prefixos antigos para não quebrar as séries de uso.
6. **Home em inglês**: a versão parcial traduzida terá de ser refeita sobre a
   nova estrutura.

## Ordem de implementação proposta

1. **Registro único** (`src/lib/observatorios/`): cada rota com um único
   observatório dono, coleção e links; teste que falha se uma rota publicada
   não tiver dono ou tiver dois.
2. **Camada aberta** com as seis perguntas alinhadas aos seis observatórios
   (protótipo já salvo no branch `claude/jolly-mayer-39xduf`, a ajustar aos
   nomes acima).
3. **Cabeçalho e escolha pós login** com seis observatórios no lugar de oito.
4. **Entradas com conta** dos seis, no padrão do Crédito: números de escala,
   diagrama do mecanismo, painéis por subpergunta, ficha do lugar.
5. **Duplicatas** resolvidas uma a uma, com comparação de conteúdo.
6. **Menu interno do Crédito** dividido entre Famílias e Economia.
7. **Blocos "Para ir além"** no fim de cada painel, lidos do registro.

## Situação da implementação (18/10/2026)

| Etapa | Situação |
|---|---|
| 1. Registro único | Em produção desde 18/10/2026 (PR #271): `src/lib/observatorios/lista.ts` e `registro.ts`, com testes de posse |
| 2. Camada aberta | Em produção desde 18/10/2026 (PR #271): home com os seis observatórios e `/perguntas/<observatório>` |
| 3. Cabeçalho e escolha pós login | Cabeçalho público em produção (PR #271); escolha pós login pelos seis observatórios no PR #272 |
| 4. Entradas com conta | PR #272: `/observatorios/familias`, `/observatorios/servicos-publicos` e `/observatorios/territorio-e-clima`. Contas Públicas, Energia e Infraestrutura e Economia usam as entradas das coleções existentes |
| 5. Duplicatas | Comparação de conteúdo em andamento |
| 6. Menu interno do Crédito | Pendente |
| 7. Blocos "Para ir além" | Pendente |

Também pendentes: barras de navegação dentro dos painéis (`NavegacaoObservatorios` e a barra da aplicação do Crédito) e o rodapé, que ainda listam as oito coleções.

