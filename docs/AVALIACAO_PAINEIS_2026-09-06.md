# Avaliação completa dos painéis: técnica, layout e didática (06/09/2026)

Segunda avaliação do Observatório Brasileiro de Crédito, feita depois do fechamento da etapa anterior
(`AVALIACAO_PAINEIS_2026-09.md` §22, doze PRs, versão 0.97.0 em produção). Cobre quatro frentes: técnica,
layout, didática e reorganização, e termina com os painéis novos possíveis e o backlog priorizado. O que foi
aplicado nesta mesma etapa (versão 0.98.0) está marcado como **aplicado**; o resto é recomendação.

Convenção: cada achado separa **evidência** (o que foi medido ou lido, com fonte e data), **inferência** (o que
se conclui) e **recomendação** (o que fazer). Dado não medido é declarado como tal.

---

## 1. Escopo e método

| Frente | Como foi verificado | Referência |
|---|---|---|
| Layout | Varredura em Chromium (Playwright) das 44 vistas estáticas em 1440 px e 390 px sobre servidor local sem compressão, medindo erros de página, `NaN`, overflow horizontal, fontes abaixo de 11 px, palavras, tabelas, gráficos, presença de placar, síntese, subnav e guia | `scratchpad/crawl/result.json`, 06/09/2026 07:40 UTC, 88 renderizações |
| Técnica | Leitura de `public/obs/app.js` (1.148 KB), `pipeline/gold.py`, `pipeline/common.py`, `scripts/vigilancia.py`, workflows do GitHub Actions e histórico de execuções | repositório em `origin/main` 43c4e1eb, 06/09/2026 |
| Didática | Leitura de cada aba como leitor não especialista: cabeçalho, primeira dobra, guia, jargão, coerência entre menu, títulos e catálogo | mesma varredura, mais `observatorioAbas.ts` e `VIEW_TITLES` |
| Dados | Inventário dos 68 golds, vintages, marcadores demo e consistência entre painéis | §6 desta avaliação |

Inventário de partida (repositório, 06/09/2026): 46 rotas na SPA, 46 abas no catálogo, 68 golds publicados,
52 módulos de fonte, 51 coletores na execução diária, 50 funções `render*`, 78 arquivos de teste com 950
testes.

---

## 2. Diagnóstico técnico

### 2.1 P0: corrigir antes de qualquer painel novo

**T1. Refetch infinito no screener.**
Evidência: em `app.js` (≈ linha 2809 na versão 0.97.0) o screener testa `if (!S)` e dispara nova carga do gold
quando o objeto ainda não chegou; `fetchGold` resolve sem checar `response.ok`, então um 404 devolve HTML,
o parse falha e o ciclo recomeça a cada render. Inferência: em produção o custo é tráfego e CPU do leitor, e o
sintoma é "carregando" perpétuo quando um gold sai do ar. Recomendação: `fetchGold` rejeita em `!response.ok`
e memoriza a falha por vista; o render exibe faixa "fonte indisponível" em vez de refazer a chamada.

**T2. Crons de CI e vigilância disparam antes de o pipeline publicar.**
Evidência: os workflows de vigilância e de testes rodam por `schedule` fixo, enquanto a execução diária do
pipeline começou com atraso entre 3 h e 11 h em todas as execuções desde 27/08/2026 (histórico do GitHub
Actions consultado em 06/09/2026; mediana de duração 49 min, máximo 124 min). Inferência: a vigilância avalia
golds do dia anterior e pode alarmar sem causa ou silenciar quando há causa. Recomendação: encadear por
`workflow_run` do pipeline, mantendo o cron apenas como reserva.

**T3. Escrita de gold não atômica e builders sem proteção.**
Evidência: `write_gold` em `pipeline/common.py` grava direto no destino; `build_all` em `gold.py` chama cada
builder em sequência sem `try/except` individual. Inferência: uma exceção no meio da cadeia deixa golds
parciais publicados e interrompe os seguintes. Recomendação: gravar em arquivo temporário e renomear;
envolver cada builder, registrar a falha em `meta.json` e seguir para o próximo.

### 2.2 P1

**T4. Golds municipais acima de 6 MB.**
Evidência (tamanho em disco, 06/09/2026): `penetracao_mun.json` 7.502 KB, `consignado_mun.json` 6.799 KB,
`moradia_mun.json` 2.463 KB, `explorer.json` 2.203 KB, `rural_mun.json` 2.164 KB. Inferência: a página
municipal só precisa de um município por vez; o leitor baixa 5.570 fichas para ler uma. Recomendação:
particionar por UF (27 arquivos por gold) mantendo o agregado nacional em arquivo pequeno.

**T5. Auxiliares duplicados.**
Evidência: `_r`, `_share`, `_mes_menos`, `_mil` e `_dec` redefinidos em 12 builders do pipeline; `pct`, `n0`,
`brl` e `bi` redefinidos em 7 renderizadores da SPA, com `bi` em três escalas diferentes. Inferência: risco de
divergência silenciosa de unidade entre abas. Recomendação: um módulo `pipeline/fmt.py` e um bloco `fmt` único
na SPA; teste que proíbe redefinição.

**T6. Golds sem teste de contrato.**
Evidência: `market`, `npl`, `compare`, `trends`, `rj`, `exposures` e `quality` não têm arquivo `*-data.test.ts`.
Recomendação: teste mínimo por gold (chaves, vintage, ausência de `NaN`, unidade declarada).

**T7. Bundles minificados versionados no git.**
Evidência: `app.min.js`, `app-municipal.min.js` e `app-emergentes.min.js` são rastreados e mudam a cada
commit da SPA. Recomendação: gerar no build da Vercel e ignorar no git; o teste de tamanho do núcleo continua.

### 2.3 P2

- `esc()` em nomes de instituição vindos de gold (hoje concatenados sem escape).
- Mover `renderMarket` e `renderInstitutions` para chunks: o núcleo está em 599 KB, limite de 620 KB.
- Decimação no `lineChart` para séries acima de 600 pontos.
- Unificar o marcador de stub (`disponivel` e `ok` convivem).
- Política de retenção de histórico de golds em `data/gold/history`.

---

## 3. Layout

### 3.1 Medições (varredura 06/09/2026, 44 vistas, 1440 px e 390 px)

| Métrica | Resultado |
|---|---|
| Erros de página ou `NaN` | 0 em 88 renderizações |
| Overflow horizontal real a 390 px | 2 vistas (tabelas de Moradia e Consignado); os demais 5 casos são rolagem interna intencional (`heatgrid`) ou dropdown oculto |
| Vistas sem placar | 18 de 44 |
| Vistas sem síntese | 32 de 44 |
| Vistas sem subnav | 27 de 44 |
| Vistas sem guia | 2 (Sobre, Sugestões) |
| Textos abaixo de 11 px | Pix 626, Instituições 509, Buscas 242 (eixos de SVG e legendas de heatmap) |
| Maior página | Instituições, 32.341 palavras; Metodologia 7.737; Rede e pessoas 6.609 |
| Gráficos e tabelas | 449 gráficos, 287 tabelas |
| Tempo de render local | máximo 2,6 s (Rural), sem compressão |

### 3.2 Aplicado nesta etapa

- Tabelas `.card > table.data` passam a rolar dentro do cartão a 390 px; `.heatwrap` com rolagem horizontal
  própria; `overflow-wrap: anywhere` em texto corrido no celular. Resultado: zero overflow de página nas
  duas larguras na re-varredura do Mapa e das abas renomeadas.
- Página inicial nova (Mapa) com grade de sete passos que reflui de cinco colunas a uma.

### 3.3 Recomendações que ficam

- **Padrão de abertura único**: `pageHead` + placar de quatro números + síntese de três linhas + subnav em
  toda aba temática. Hoje o padrão vale nas abas novas (Rural em diante) e falta nas 18 sem placar.
- **Modo capítulo em Instituições** (32 mil palavras): a subnav fixa já existe; falta cortar a ficha em
  "resumo", "balanço", "rede" e "conduta" carregados sob demanda.
- **Eixos de SVG a 11 px** em Pix, Instituições e Buscas.
- **Contraste do modo escuro** nos selos de vintage e nas células de heatmap não foi medido nesta rodada.

---

## 4. Didática

### 4.1 Achados

| # | Achado | Evidência | Aplicado |
|---|---|---|---|
| A1 | Caixa mista nos rótulos do menu ("Panorama do Crédito" ao lado de "Crédito rural") | 24 rótulos com padrão diferente | sim: caixa de frase em todos |
| A2 | Rotas em inglês na URL pública (`/states`, `/products`, `/map`) | `ROUTES` | não: mudar rota quebra links indexados; manter e documentar |
| A3 | Título em inglês ou sigla sem expansão ("SFN", "Funding", "Open Finance", "Bets") | menu 0.97.0 | sim para Funding, Bets, Entrantes; "Open Finance" e "Pix" são nomes próprios |
| A4 | `pageHead` ausente em Visão geral, Juros, Sobre e Sugestões; título vindo do gold em Apostas e Golpes | varredura | parcial: catálogo e `VIEW_TITLES` unificados; `pageHead` fica para o padrão de abertura |
| A5 | Catálogo contradizia a aba (Visão geral prometia "cinco famílias", Estados listava blocos que não existem) | `observatorioAbas.ts` 0.97.0 | sim: 8 descrições corrigidas |
| A6 | Guia ausente em Sobre e Sugestões | varredura | sim em Sobre; Sugestões é formulário |
| A7 | "Fase 0", "Fase 2", "Fase 5" em texto público | 6 ocorrências em `app.js` | sim: removidas do texto visível; ficam só em comentários de código |
| A8 | Jargão sem verbete na primeira ocorrência: z-score, SCR, IF.data, SGS, S1 a S5, DataJud, IBCC, p50, txjuros, PIM, PMS, PMC | leitura das abas | parcial: legenda de selos e réguas no Mapa; glossário por aba fica no backlog |

### 4.2 Recomendação de padrão por aba antiga

Cada aba anterior à etapa de 05/09 recebe, na ordem: pergunta que responde (uma linha), quatro números com
data e fonte, síntese de três frases, gráfico principal, e só então método e ressalvas. As abas Pulso,
Panorama, Instituições, Comparar, Produtos, Cenários, Sinais antecedentes, Risco setorial e Recuperações são
as que mais se afastam desse padrão.

---

## 5. Reorganização aplicada (versão 0.98.0)

### 5.1 Página inicial "Mapa do Observatório"

Entrada padrão de `/observatorio` (rota `/observatorio/map`). Cinco blocos:

1. **O ciclo do crédito em sete passos**: de onde vem o dinheiro, quem empresta, o que se empresta e a que
   preço, para quem e onde, o que atrasa e o que vem, o que vira processo, quem vigia e o que muda. Cada
   passo lista as abas que o respondem; os 7 passos cobrem todas as abas temáticas (teste automatizado).
2. **Por pergunta**: as perguntas do guia de cada aba, agrupadas pelo menu.
3. **Trilhas por perfil**: analista de risco, jornalista ou pesquisador, gestor público.
4. **Como ler**: legenda dos selos de vintage, as três réguas que nunca se somam, ausência como nulo, meses
   parciais declarados, correções de unidade publicadas, "nunca ranking" em conduta.
5. **Fontes e datas**: tabela gerada de `meta.vintages` (8 famílias em 06/09/2026: SGS 2026-07, SCR 2026-07,
   IF.data 2026-03, B3 2026-09, FIDC 2026-08, DataJud 2026-07, Buscas 2026-06, txjuros 2026-08).

A aba "Visão geral" continua como painel de números; o Mapa é a página de orientação.

### 5.2 Menu em oito grupos

| Grupo | Abas |
|---|---|
| Começar | Mapa do Observatório, Visão geral, Central de alertas |
| Ciclo do crédito | Pulso do crédito, Quem toma crédito e onde, Sinais antecedentes, Cenários, Buscas no Google |
| Instituições e funding | Instituições, Comparar instituições, Quem entra e quem sai do SFN, Captação dos bancos, Rede, pessoas e auditoria, Bancos na bolsa |
| Produtos e preços | Produtos de crédito, Juros por instituição, Crédito rural, Crédito direcionado e BNDES, Bancos e mercado de capitais, Consórcios |
| Território e pessoas | Estados, Crédito por município, Crédito imobiliário e moradia, Consignado e aposentados, Emprego formal |
| Risco, cobrança e recuperação | Risco setorial, Bancos cobrando na Justiça, Recuperações e falências, Clientes contra bancos na Justiça, Dívida com a União, Desenrola |
| Pagamentos, conduta e fronteiras | Pix e pagamentos, Open Finance, Sanções e reclamações, Apostas e crédito das famílias, Golpes e fraudes |
| Referência | Marcos regulatórios, Metodologia e fontes, Sobre |

Regra testada: toda vista estática está em exatamente um grupo, nenhum grupo passa de 7 abas, rótulo do
menu igual a `VIEW_TITLES` e ao catálogo.

### 5.3 Renomeações

| Antes | Depois |
|---|---|
| Panorama do Crédito | Quem toma crédito e onde |
| Penetração e Gap | Crédito por município |
| Moradia e Habitação | Crédito imobiliário e moradia |
| Consignado e Envelhecimento | Consignado e aposentados |
| Entrantes e saídas do SFN | Quem entra e quem sai do SFN |
| Funding e captação | Captação dos bancos |
| Comparador | Comparar instituições |
| Indicadores operacionais | Rede, pessoas e auditoria |
| Mercado e Valor | Bancos na bolsa |
| Taxas de Juros por IF | Juros por instituição |
| Crédito ampliado e mercado de capitais | Bancos e mercado de capitais |
| Cobrança judicial de crédito | Bancos cobrando na Justiça |
| Ações judiciais | Clientes contra bancos na Justiça |
| Dívida Ativa da União | Dívida com a União |
| Bets e risco financeiro | Apostas e crédito das famílias |
| Fraudes e risco de crédito | Golpes e fraudes |
| Conduta e enforcement | Sanções e reclamações |
| Regulação do Crédito | Marcos regulatórios |
| Tendências de Busca | Buscas no Google |

Rotas, identificadores de vista e chaves de telemetria não mudaram; só o texto visível, o catálogo, o `<title>`
e as descrições. Links externos e o sitemap continuam válidos.

---

## 6. Painéis novos possíveis

### 6.1 Pendentes da avaliação anterior

| Painel | Fonte | Estado | Esforço |
|---|---|---|---|
| Condições de crédito pela ótica do ofertante (PTC) | BCB, Pesquisa Trimestral de Condições de Crédito | só PDF e planilha não estruturada; fora do padrão sem gate de leitura de documento | médio |
| Cadastro CNPJ (aberturas e baixas por CNAE e município) | Receita Federal | arquivo integral acima de 5 GB; viável só por agregação prévia fora do runner | alto |
| Seguro prestamista no custo do crédito | SUSEP, prêmios por ramo | CSV aberto; entra como camada em Juros por instituição | baixo |
| FIDC por lastro | CVM, informe mensal de FIDC (já coletado) | falta só o corte por tipo de lastro no builder | baixo |
| Informe diário de fundos | CVM | volume alto; só faz sentido para cotas de fundos de crédito | médio |

### 6.2 Método da auditoria de dados

Inventário por `ls` e leitura dos 68 JSON, cruzamento com `VIEW_DATA` da SPA, `gold.py`, `run.py`,
`config.json`, `vigilancia.py`, `sanidade_gold.py` e o silver local (parcial). Seis números conferidos entre
painéis. Sem acesso à fonte externa nesta rodada; o que depende dela está declarado.

### 6.3 Auditoria de dados (06/09/2026, golds publicados em `public/obs/data/gold`)

Inventário: 68 golds na raiz, mais `inst/` (1.422 fichas, 39 MB), `pano/` (27 UFs) e `prod/` (13 produtos).
`data/gold` e `public/obs/data/gold` idênticos arquivo a arquivo. Nenhum gold consumido pela SPA declara
`disponivel: false`. Achados, do mais grave ao menor:

**D1. Data base SCR 2026-07 possivelmente parcial.**
Evidência: `panorama.serie_br` cai de 7.636,4 bi (2026-06) para 7.573,9 bi (2026-07), menos 0,82% no mês,
com o DF em menos 11,3% (`pano/DF.json`) e SE em menos 9,1%; no mesmo intervalo o saldo do SGS sobe 0,26%
(`pulse`, série 2026-07). O coletor `scr_data` registrou `IncompleteRead` na execução de 05/09. Inferência:
carga truncada é a leitura mais provável; reclassificação concentrada em duas UFs é a alternativa. O painel
publica o número como observado, sem alerta. Recomendação (P0): recarregar 2026-07 com verificação de tamanho,
reconciliar por UF com as séries regionais do SGS e bloquear a publicação quando a soma cair acima de um limiar
com o coletor em falha.

**D2. IF.data congelado em 2026-03 por lista fixa.**
Evidência: `config.ifdata.anomes_candidates` termina em 202603 (verificado em `config/config.json`); cinco
coletores iteram só essa lista; idade da data base em 06/09/2026 é 158 dias, acima do prazo de 135 da
vigília. Inferência: mesmo com o BCB publicando o 2T26, nenhum coletor pedirá 202606. Recomendação (P0): gerar
os candidatos a partir da data corrente.

**D3. Dois golds não regenerados há semanas.**
Evidência: `compare.json` com `gerado_em` 2026-08-16 e `consignado.json` 2026-08-04, embora ambos os builders
rodem a cada execução; a pasta `cmp/` que `compare.py` escreve por instituição não existe em produção;
`scripts/sanidade_gold.py` restaura a última publicação quando o build regride. Inferência: os dois builders
falham no CI e a sentinela mascara a falha desde essas datas. Recomendação (P0): rodar os dois com traceback,
e fazer a sentinela registrar "restaurado há N dias" em `meta.json`.

**D4. `meta.json` incompleto.**
Evidência: 8 vintages publicados de 20 calculados em `gold.py`; 38 coletores em `fontes_status` de 51 em
`run.py` (meta de 05/09/2026 12:52 UTC, anterior às cargas locais das abas novas). `PRAZO_VINTAGE_DIAS` não
cobre fidc, pix, estban, openfinance, pgfn e desenrola. Inferência: a vigília está cega para 12 fontes até a
execução de 06/09 reescrever o meta. Recomendação (P0): conferir o meta de 06/09 e completar os prazos.

**D5. Fontes em falha declarada** (`meta.fontes_status`, 05/09/2026): IF.data com HTTP 500 em todos os
candidatos; `scr_data` com `IncompleteRead`; Desenrola com esquema mudado (7 colunas ausentes, dado parado em
2026-06); DJEN com HTTP 403 em todos os tribunais (zero casos reais de RJ); ranking do TST com HTML mudado;
Pilar 3 com falhas de parse em percentuais. Recomendação (P1): reescrever o mapeamento do Desenrola, tratar o
403 do DJEN e o parse do Pilar 3.

**D6. Conteúdo demonstrativo residual.**
Evidência: `rj.json` ainda carrega 5 casos fictícios, `exposicao_total_rmi`, `serie_pedidos_mensais` e
`componentes_setoriais` demo (172 KB públicos) que a SPA não referencia; `overview.confianca_motivo` e três
textos de `method.json` ainda dizem "dois componentes demonstrativos" quando `sectors.json` mostra um só
(capacidade financeira já observada pelo Caged até 2026-07); `app.js` mantém rótulos "Valores fictícios" no
fallback do Open Finance. Recomendação (P1): remover os campos do gold e gerar os textos a partir de
`sectors.json`.

**D7. Consistência entre painéis** (seis números conferidos):

| Número | Valores | Veredito |
|---|---|---|
| Carteira total | SGS 7.372,2 bi (2026-07); SCR 7.573,9 bi (2026-07); "empréstimos do SFN" em Ampliado 6.989,0 bi (2026-07); ESTBAN 12.739,9 bi (sede no DF) | três conceitos sem verbete único; SCR 2,7% acima do SGS |
| Inadimplência | SGS 4,88; SCR arrastada 4,74; mediana IF.data 4,75 (2026-03) | coerente e documentado em `meta.inad_conceitos` |
| Instituições no IF.data 2026-03 | 1.422 (`inst_index`, screener), 1.430 (`sfn`), 1.874 (`compare.universo`) | três definições sem nota |
| Saldo SCR por UF | SP 2.273,0 bi idêntico em panorama, ufs, cobranca e `pano/SP` | coerente |
| População nos per capita | 213,4 mi (SIDRA 6579, 2025) em panorama, consórcios, cobrança; 203,1 mi (Censo 2022) em rural e consignado | dois vintages; padronizar em `ufs.json` |
| Carteira do Itaú 2026-03 | 1.176,97 bi (`institutions`) e 1.172,35 bi (`npl`), 0,39% | dois relatórios do IF.data sem nota de origem |

Menores: `presenca_mun` com 5.571 municípios contra 5.570; consórcios com soma das UFs 330 cotas acima do
Brasil; `juros` repete a mesma carteira SCR nas três modalidades de consignado; Selic com data futura
(2026-09-16) em `pulse` e `quality`; uma série de empregados em `operacional` com ref 2026-12-31; 14 golds sem
`gerado_em`; `pix.chaves` parado em 2025-10-31.

### 6.4 Candidatos a partir do inventário

| # | Painel | Fonte | Esforço | Valor | Nota |
|---|---|---|---|---|---|
| 1 | Prazo e vencimentos da carteira | SCR.data, colunas de prazo já coletadas | baixo | alto | mesmo coletor e malha; responde à rolagem e ao refinanciamento |
| 2 | FIDC por lastro e classe de cota | CVM informe mensal, já em bronze | baixo | alto | elo entre Ampliado e Produtos |
| 3 | Condições de crédito pelo ofertante | BCB PTC, planilha oficial | baixo a médio | alto | único antecedente pelo lado da oferta; depende de aceitar XLSX como estruturado |
| 4 | Custo efetivo com prestamista | SUSEP SES | baixo | médio | camada em Juros por instituição |
| 5 | Demografia empresarial por CNAE e UF | Receita CNPJ | alto | alto | substitui o componente demonstrativo de estresse empresarial |
| 6 | Crédito subnacional | Tesouro, Sadipem e garantias honradas | médio | médio | certeza moderada sobre o dataset |
| 7 | Reclamações de crédito nos Procons | Senacon Sindec | médio | médio | complementa Sanções e reclamações; nunca ranking |
| 8 | Radar normativo automático | API de normas do BCB | baixo | médio | transforma a timeline curada em feed |

Fontes verificadas como não abertas ou inexistentes: Registrato, Serasa, SPC e Cadastro Positivo (privados ou
por login); endividamento mensal na PNAD (não existe; POF é decenal e PEIC é da CNC); FGTS estruturado.
Com certeza não confirmada nesta rodada: ANBIMA fundos de crédito, B3 renda fixa secundária, INSS consignado
por instituição.

---

## 7. Backlog priorizado

| Prio | Item | Seção | Esforço |
|---|---|---|---|
| P0 | Recarregar SCR 2026-07 e reconciliar por UF com o SGS; bloqueio por limiar com coletor em falha | D1 | baixo |
| P0 | Candidatos do IF.data gerados pela data corrente | D2 | trivial |
| P0 | Builders de Comparar e Consignado com traceback; sentinela declara "restaurado há N dias" | D3 | baixo |
| P0 | Meta completo (20 vintages, 51 coletores) e prazos de vigília para as 6 fontes sem prazo | D4 | baixo |
| P0 | `fetchGold` com `response.ok` e falha memorizada; screener sem refetch | T1 | baixo |
| P0 | Vigilância e CI por `workflow_run` do pipeline | T2 | baixo |
| P0 | `write_gold` atômico; builder protegido e falha registrada em `meta.json` | T3 | baixo |
| P1 | Desenrola (esquema), DJEN (403), TST e Pilar 3 (parse) | D5 | médio |
| P1 | Remover campos demo do `rj.json`; textos de método gerados de `sectors.json` | D6 | baixo |
| P1 | Um vintage populacional; verbete único para os três conceitos de carteira e as três contagens de IF | D7 | baixo |
| P1 | Particionar golds municipais por UF | T4 | médio |
| P1 | Padrão de abertura nas 18 abas sem placar | §3.3, §4.2 | médio |
| P1 | Auxiliares únicos de formatação no pipeline e na SPA | T5 | médio |
| P1 | Testes de contrato para os 7 golds sem teste | T6 | baixo |
| P1 | Glossário por aba na primeira ocorrência de jargão | A8 | médio |
| P2 | Painéis 1 e 2 do §6.4 (prazo da carteira; FIDC por lastro) | §6.4 | baixo |
| P2 | Bundles fora do git; chunks para Bancos na bolsa e Instituições | T7, §2.3 | médio |
| P2 | Modo capítulo em Instituições; eixos de SVG a 11 px | §3.3 | médio |
| P2 | Prestamista em Juros; radar normativo; PTC | §6.4 | baixo a médio |
| P3 | Cadastro CNPJ por agregação prévia; crédito subnacional; Procons | §6.4 | alto |

## 8. O que não foi verificado

- Produção na Vercel: compressão, cache e tempo de resposta continuam medidos só em servidor local.
- Contraste em modo escuro e navegação por teclado nas abas novas.
- Comportamento dos coletores novos no runner (a primeira execução com todos eles é a de 06/09/2026, 09:00
  UTC, ainda a conferir no fechamento desta etapa).
- Leitura real por usuário: não há dado de telemetria consultado nesta avaliação; as trilhas por perfil são
  inferência editorial, não medição.

---

## 9. Fechamento da etapa

Entregue nesta etapa (versão 0.98.0, um PR em `main`): página inicial "Mapa do Observatório" como entrada
padrão, menu em oito grupos, 19 renomeações de abas, catálogo e descrições corrigidos, textos "Fase N" fora do
público, guia em Sobre, correções de overflow no celular, teste `mapa-menu.test.ts` e este documento.

Validação: `node --check`, minificação (núcleo 599 KB de 620 KB), 950 testes em 78 arquivos, `tsc`, `next lint`,
`compileall`, renderização do Mapa e das abas renomeadas em Chromium a 1440 px e 390 px sem erro, `NaN` ou
overflow.

Próxima etapa recomendada: os sete P0 do §7 (quatro de dados, três técnicos), antes de qualquer painel novo.

---

## 10. Correções dos sete P0 (06/09/2026, manhã)

Um PR em `main` com os sete itens P0 do §7. O que cada um encontrou e o que mudou:

**D1. SCR 2026-07 não estava truncado: a queda está na fonte.**
Evidência: o zip `scrdata_2026.zip` baixado do BCB em 06/09/2026 08:56 UTC (105,7 MB, HTTP 200) traz o CSV de
2026-07 com 310.197 linhas e carteira de R$ 7.590,3 bi, contra 313.374 linhas e R$ 7.637,1 bi em 2026-06. O DF
cai de R$ 179,1 bi para R$ 159,1 bi (menos 11,2%) e SE de R$ 47,8 bi para R$ 42,6 bi no próprio arquivo do
BCB. O gold publicado (R$ 7.573,9 bi e DF R$ 158,8 bi) difere do arquivo atual em 0,2%: a fonte revisou o
mês depois da absorção. Inferência: reclassificação ou revisão concentrada em duas UFs, não carga parcial.
Aplicado: (a) o coletor registra por data-base o CRC do CSV dentro do zip, o número de linhas e a carteira
(`scr_carga`) e reabsorve a data-base quando a fonte revisa o arquivo; (b) piso de 90% das linhas da
data-base anterior, abaixo do qual nada é gravado e a falha fica declarada; (c) download em fluxo para disco
com retry, e `IncompleteRead` passa a ser retentado em `http_get`; (d) ano fechado com as 12 datas-base
registradas não é mais baixado (eram cerca de 200 MB por execução); (e) o Panorama publica o aviso
`uf_variacao_saldo` quando a carteira de uma UF varia 5% ou mais entre datas-base consecutivas, com a nota de
que pode ser revisão ou reclassificação na fonte. A reconciliação por UF com o SGS não foi feita: o SGS não
publica saldo por UF na mesma base conceitual do SCR.data, e a conferência contra o arquivo bruto bastou.

**D2. IF.data congelado por lista fixa.**
Aplicado: `config.ifdata.anomes_candidates` passa a ser `"auto:5"` e `load_config` resolve para os cinco fins
de trimestre mais recentes (em 06/09/2026: 202606, 202603, 202512, 202509, 202506). O Olinda respondeu HTTP 200
para 202603 e lista vazia para 202606 em 06/09/2026 09:03 UTC; o HTTP 500 de 05/09 foi transitório.

**D3. Comparar e Consignado.**
Comparar: reproduzido localmente. `institution_metrics` tem 60 linhas do Resumo de 2020 sem `CodInst`
(chave nula), e `c.startswith("C")` em `None` derrubava o builder. Aplicado: o builder ignora chave nula e o
coletor não grava linha sem `CodInst`. Consignado: o log do CI de 05/09 confirma o stub e a restauração pela
sentinela, sem traceback. Localmente, com previdência, censo, ESTBAN e o SCR recarregado, o builder conclui
com `ok: true` (09:07 UTC). A causa mais provável no CI é o corte triplo `scr_uf_ocup_produto` vazio: o silver
semeado trazia `scr_uf` de 2024 e 2025 sem o corte, e a idempotência por `scr_uf` impedia o preenchimento.
Com o registro de carga, a primeira execução reabsorve as 31 datas-base e preenche o corte. Se o stub
persistir, o traceback agora sai no log e em `meta.builders_falhos`. Sentinela: `sanidade_gold.py` grava em
`meta.json` a chave `restaurados` com o `gerado_em` da cópia restaurada e a idade em dias; a vigília de pane
acusa acima de 2 dias e acusa qualquer `builders_falhos`.

**D4. Meta e prazos.**
Aplicado: cinco vintages novos em `meta.json` (pix, estban, openfinance, pgfn, desenrola; fidc já existia) e
os seis prazos em `PRAZO_VINTAGE_DIAS`. Os 20 vintages e 51 coletores só aparecem no meta publicado a partir
da primeira execução do pipeline com este código.

**T1.** `fetchGold` rejeita resposta não ok e memoriza a falha em `GOLD_FALHAS`; o screener distingue "não
pedido" de "falhou" e mostra faixa de indisponibilidade em vez de refazer a chamada; o cache de UF do Panorama
marca voo e falha.

**T2.** `ci.yml` e `vigilancia.yml` disparam por `workflow_run` do pipeline; os crons ficam como reserva
(17:45 e 20:00/20:20 UTC). Na vigília por `workflow_run`, frescor e pane esperam 5 minutos pelo raw do main.

**T3.** `write_gold` grava em temporário e renomeia; 32 blocos `except` passam a usar `common.stub`, que
imprime o traceback, registra a falha e grava o stub com os dois marcadores (`disponivel` e `ok`); exposures,
Open Finance, RJ, antecedentes, regimes, alertas, visão geral, método e relatório ganharam proteção; o meta
publica `builders_falhos`. Pulso, IBCC, setores e instituições seguem sem proteção por serem base de tudo o
que vem depois.

**Validação.** `compileall`, `node --check`, minificação (núcleo 600 KB de 620 KB), `tsc`, `next lint`,
966 testes em 79 arquivos (16 novos em `p0-correcoes.test.ts`). Coletor do SCR exercitado localmente três
vezes: primeira carga (7 datas-base, 26 s), segunda com reabsorção por registro ausente, terceira sem
reabsorção.

**Não verificado.** Comportamento no runner: a primeira execução reabsorve 31 datas-base do SCR (estimativa de
3 a 4 minutos a mais); a causa do stub do Consignado no CI é inferência até a próxima execução; a vigília
por `workflow_run` só será exercitada quando o pipeline terminar.
