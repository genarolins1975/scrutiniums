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

## Situação da implementação (atualizada em 21/10/2026)

| Etapa | Situação |
|---|---|
| 1. Registro único | Em produção desde 18/10/2026 (PR #271): `src/lib/observatorios/lista.ts` e `registro.ts`, com testes de posse |
| 2. Camada aberta | Em produção desde 18/10/2026 (PR #271): home com os seis observatórios e `/perguntas/<observatório>` |
| 3. Cabeçalho e escolha pós login | Em produção (PRs #271 e #272): cabeçalho público, escolha pós login pelos seis observatórios, com último acesso e telemetria também nos atalhos de coleção |
| 4. Entradas com conta | Famílias, Serviços Públicos e Território e Clima em produção (PR #272). Contas Públicas ("Do imposto ao resultado"), Energia e Infraestrutura ("Da origem à sua casa") e Economia ("Do juro básico ao atraso") no PR seguinte. As entradas das coleções seguem como estão; `/observatorio-do-credito` não muda (decisão de 18/10/2026) |
| 5. Duplicatas | Decididas e em produção (PR #272; seção abaixo) |
| 6. Menu interno do Crédito | Em produção (PR #272): o menu de oito grupos fica; cada aba de Famílias ou Contas Públicas diz a que observatório pertence, com link para a entrada. Desde 23/10/2026 (Iniciativa 2 do parecer de UX de 23/10/2026, o Crédito na mesma casca) a barra lateral saiu: os oito grupos vivem em `GRUPOS_CREDITO` (`src/lib/credito/navegacao.ts`) e a aplicação mostra a navegação da coleção dona do endereço. A do Crédito tem Início, "Quanto meu banco cobra?", Começar, Ciclo do crédito, Instituições (Instituições e funding), Produtos e preços (com o Simulador da parcela), Território (Território e pessoas) e Marcos regulatórios, com Método e Glossário como atalhos; as páginas de Famílias, Contas Públicas, Pagamentos e Empresas ficam só na navegação da coleção delas, e "Risco, cobrança e recuperação" e "Pagamentos, conduta e fronteiras", que ficaram sem página do Crédito, saem da navegação (decisões do dono de 23/10/2026). O "Início do painel" (antes "Mapa do Observatório") continua listando os oito grupos, por pergunta |
| 7. Blocos "Para ir além" | Em produção (PR #272), no layout de toda coleção com páginas Next; barras dos painéis e rodapé pelos seis observatórios |
| Território e Clima, adensamento | Queimadas com pipeline e gold próprios (`/territorio/queimadas`, `docs/territorio/README.md`); desastres (Atlas Digital) e emissões oficiais (MCTI) nos próximos PRs |
| Um só vocabulário (Iniciativa 1 do parecer de UX de 21/10/2026) | Em PR (branch `claude/iniciativa-1-vocabulario`). Os oito domínios de `src/lib/dominios.ts` passam a se chamar como a coleção do registro (o nome antigo fica em `nomeLegado`, só para testes e `/sobre`); `lista.ts` é a única fonte de coleções (`dominio`, `metodo` e `glossario` por coleção). O seletor da barra e a barra da aplicação do Crédito listam as 28 coleções; o rodapé tem uma coluna por observatório; `RotuloContexto` escreve "Observatório X · Coleção Y · Página Z" acima do H1; a trilha "Você está em" (`Trilha`) vem logo abaixo da barra comum em toda página de coleção, inclusive em cada aba da aplicação do Crédito; seletor, abas e trilha resolvem a coleção pelo endereço também no navegador (`contextoPuro.ts`), porque o cabeçalho mora em layouts. Navegações de módulo com aria-label "Navegação da coleção X" e títulos "Página · Coleção · Scrutiniums". Teste `src/tests/vocabulario.test.ts`. Fica para a Iniciativa 4 o H1 de `/observatorio-do-credito` |

## Duplicatas: decisões de 18/10/2026

Comparação de conteúdo feita sobre as páginas, os componentes e as golds de cada par. Nenhuma página foi removida: a que vira atalho continua publicada e mostra o aviso "Painel mais completo" (`src/components/observatorios/PainelMaisCompleto.tsx`).

| Par | Decisão | Motivo | Divergência encontrada |
|---|---|---|---|
| Emprego formal: `/observatorio/formal-employment` × `/eficiencia-estatal/trabalho-renda/emprego-formal` | Dono: Crédito. A página da Eficiência Estatal fica com aviso | Mesma fonte (SGS 28763); o Crédito tem série mais longa, ajuste sazonal, admissões e desligamentos, 21 seções e 27 UFs | Capturas em datas diferentes: estoque de jul/2026 de 48.082.866 no Crédito (`public/obs/data/gold/emprego.json`) e 48.078.869 na Eficiência Estatal (`public/eficiencia/trabalho-renda/snapshot.json`); a Eficiência Estatal já tem ago/2026. A Eficiência Estatal chama a medida de variação do estoque, não de saldo |
| Saneamento: `/eficiencia-estatal/saneamento` × `/saneamento` | Dono: Saneamento para água, esgoto e recursos (avisos em `agua`, `esgoto` e `recursos`). Resíduos e drenagem, que só existem na Eficiência Estatal, passam ao Observatório do Território e Clima | Mesmos indicadores do SINISA, com diferença zero em 361 valores conferidos; o Saneamento é municipal e mais profundo | Investimento por habitante: a Eficiência Estatal separa água (R$ 70,56) e esgoto (R$ 72,68), cada um com o seu denominador; o Saneamento soma os dois. Construções diferentes, não erro |
| Energia: `/eficiencia-estatal/energia-conectividade` × `/setor-eletrico/inclusao-energetica` | Dono: Setor Elétrico para acesso, Tarifa Social, qualidade e tarifas (aviso nas abas de energia). O uso da internet fica na Eficiência Estatal | A Eficiência Estatal lê as mesmas golds do Setor Elétrico | Nenhuma |
| Crédito rural: `/observatorio/rural-credit` × `/agronegocio/apoio` | Os dois ficam, complementares: o Crédito é dono do volume contratado; o Agro, dos juros por programa e das subvenções | Medidas diferentes do mesmo tema | O valor mensal contratado nos microdados do Sicor (Agro, R$ 21,60 bi em jul/2026) difere da MDCR (Crédito, R$ 20,99 bi). O link do Agro para `/observatorio/rural`, rota inexistente, foi corrigido para `/observatorio/rural-credit`, e um teste passa a conferir todo link escrito para abas do Crédito |

Pendências de dado, situação em 18/10/2026:

- **Emprego do Crédito um mês atrás:** o pipeline do Crédito já gera ago/2026, idêntico à Eficiência Estatal nos 36 meses em comum (conferido sobre o estado de produção de 17/10). O mês não chega ao site porque a publicação diária da gold do Crédito (`.github/workflows/atualizar-dados.yml`) está retida desde 24/09/2026: qualquer teste de conteúdo reprovado em outro tema segura a gold inteira. Atualizar só `emprego.json` quebraria a coerência com `sectors.json` e `ufs.json`. A Eficiência Estatal não tem captura agendada de emprego.
- **Sicor × MDCR:** documentado em `/agronegocio/apoio`, junto à tabela de juros, com os dois valores do mesmo mês fechado.
- **Captura do Inep (Contas Estaduais):** cadeia TLS incompleta no servidor e conexão reiniciada na primeira tentativa; corrigido com o intermediário oficial versionado e novas tentativas (`docs/contas-publicas-estaduais/FASE_4A_EDUCACAO.md`).


## Decisões de 19/10/2026 (banca multidisciplinar)

Registro completo em `docs/BANCA_2026-10-19.md`. Em resumo:

- **Aberto e com conta:** aberto responde ao curioso sobre o seu caso, em modo de consulta; com conta fica a profundidade (séries completas, comparações, downloads, API, cenários, previsões, recortes salvos e alertas). Abertura rota por rota, com aprovação do dono; nenhuma rota foi aberta nesta data.
- **Retrato das capitais:** a nota composta sai da entrada da Eficiência Estatal e fica no painel.
- **Cadastro:** informações básicas continuam obrigatórias; a terceira etapa ganha perfil de uso e pede instituição, área e cargo só a perfis profissionais.
- **Inglês na 1.0:** só a home e o Setor Elétrico.
- **Gravuras:** revisar e melhorar quando necessário; layout sem defeito.
- **Expansão:** sem congelamento; painel novo entra pelo valor agregado, com o critério de conclusão da banca.
