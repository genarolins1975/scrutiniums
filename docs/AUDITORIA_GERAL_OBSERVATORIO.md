# Auditoria geral do Observatório Brasileiro de Crédito

**Data:** 4 de agosto de 2026
**Escopo:** as 31 rotas da aplicação, os 39 arquivos gold publicados, o pipeline de
dados e o front-end. Método: inventário a partir do código (não do menu), auditoria
funcional instrumentada no navegador, reconciliação de dados entre painéis e contra as
fontes primárias, e auditoria de qualidade de código — com correção dos problemas
encontrados, não apenas registro.

---

## 1. Resumo executivo

**31 rotas auditadas** (28 de menu + 3 de detalhe), 39 golds varridos, 6 APIs primárias
reconciliadas, ~8.700 linhas de front-end revisadas. Resultado global: **nenhum dado
incorreto publicado** — todas as reconciliações contra warehouse e fontes primárias
fecharam exatas ou dentro de arredondamento declarado. Os problemas encontrados foram de
funcionalidade e acabamento, não de número.

| | Encontrados | Corrigidos |
|---|---:|---:|
| P0 (dado errado, quebra total) | 1 | 1 |
| P1 (falha funcional ou risco real) | 6 | 6 |
| P2 (inconsistência, rotulagem, duplicação) | 9 | 6 |
| P3 (refinamento) | 6 | 1 |

O único P0 era uma **regressão da própria rodada de design**: a consolidação de tokens
converteu o `font-weight: 100 900` das seis declarações `@font-face` em
`font-weight: var(--fw-light) 900`, que é inválido em descritor — o navegador descartava
o descritor e o matching de pesos das fontes variáveis quebrava silenciosamente.
Detectado pela auditoria de código, corrigido e verificado no navegador
(`document.fonts` reporta `100 900` nas três famílias).

O P1 funcional mais relevante: **a busca de município da Penetração era inutilizável** —
selecionava (e re-renderizava a página, destruindo o próprio campo) ao primeiro prefixo
de três letras. Digitar "Pau D'Arco" era impossível: em "pau" a caixa já zerava.
Reescrita com datalist de sugestões e seleção só no Enter; as buscas do Pix e do painel
de produto, que matavam o foco a cada tecla, ganharam preservação de foco e cursor.

## 2. Inventário de rotas

A aplicação tem **31 rotas** no roteador, das quais 28 aparecem no menu e 3 são páginas
de detalhe parametrizadas, corretamente fora dele: `inst/` (página da instituição),
`sector/` (página do setor) e `product/` (painel do produto). Todos os 31 renderizadores
existem e nenhum renderizador está órfão de rota.

| Rota | Finalidade | Fontes principais |
|---|---|---|
| `/overview` | Visão geral do crédito | SGS, IF.data |
| `/credit` | Pulso do crédito, séries | SGS |
| `/sectors` e `/sectors/{id}` | Risco setorial | IF.data por CNAE |
| `/recoveries` | Recuperações e falências | DataJud, DJEN |
| `/institutions` e `/institutions/{cod}` | Universo e página da IF | IF.data, txjuros |
| `/open-finance` | Open Finance | Diretório de participantes |
| `/scenarios` | Cenários | modelos próprios |
| `/alerts` | Central de alertas, 4 famílias | consolidação interna |
| `/research` | Exportação e pesquisa | — |
| `/methodology` | Metodologia viva | — |
| `/products` e `/products/{slug}` | Produtos de crédito | IF.data rel. 123/128 |
| `/compare` | Comparador de instituições | IF.data |
| `/market` | Mercado e valor | B3, CVM |
| `/leading-signals` | Sinais antecedentes | FIDC, regimes |
| `/search-trends` | Tendências de busca | Google Trends (exportação manual) |
| `/credit-panorama` | Panorama SCR | SCR.data |
| `/bets-financial-risk` | Bets e risco financeiro | SGS, pesquisas |
| `/financial-fraud` | Fraudes | BCB |
| `/interest-rates` | Taxas por instituição | txjuros |
| `/pix` | Pix e meios de pagamento | BCB Pix, SPI |
| `/lawsuits` | Ações judiciais | DataJud, DJEN |
| `/federal-tax-debt` | Dívida Ativa da União | PGFN |
| `/desenrola` | Desenrola Brasil | BCB (base do Desenrola no SCR) |
| `/credit-penetration` | Penetração e gap municipal | ESTBAN, Censo 2022 |
| `/housing-credit` | Moradia e crédito habitacional | Censo 2022, ESTBAN, Mercado Imobiliário |
| `/payroll-lending-aging` | Consignado, previdência e envelhecimento | MPS, SCR, SGS, consumidor.gov.br |
| `/about`, `/suggestions` | Institucional | — |

## 3. Auditoria funcional — resultado da varredura instrumentada

Executada no navegador, a 1440 px, tema claro e escuro, com medição por script — não por
inspeção visual.

**O que passou:**

- As 28 views de menu renderizam sem `undefined`, `NaN` ou `[object Object]` no texto,
  sem travar em estado de carregamento, e com **zero erros de console** na navegação
  completa.
- As três páginas de detalhe abrem pelo caminho real do usuário: a página da instituição
  pelo botão "página completa" (testada com Itaú), o painel do produto pelo cartão
  (testado com cartão de crédito PF).
- A **exportação universal** coleta as tabelas corretamente em todas as páginas testadas:
  moradia 9 abas/247 linhas, consignado 10/210, Pix 13/629, Desenrola 8/237, penetração
  4/74, instituições 1/31.
- Os **filtros respondem em combinação**, não só no estado inicial: na penetração,
  região Nordeste reduz o crédito analisado de R$ 4,76 tri para R$ 444,0 bi; trocar o
  método do gap de modelo para pares reduz o gap de R$ 208,8 bi para R$ 47,3 bi; limpar
  os filtros restaura exatamente o estado inicial. O filtro persiste na URL
  (`?range=24`) e é restaurável.
- **Municípios com apóstrofo** (Alta Floresta D'Oeste, Pau D'Arco...) não quebram os
  handlers de clique: os `onclick` gerados usam o código IBGE numérico, e o nome só
  entra em `aria-label`, escapado por `attr()`. Clique testado, perfil abre.
- Estado sem dado: view exibe carregamento/indisponibilidade em vez de quebrar.

**Artefatos do ambiente de teste, não bugs:** `POST /api/telemetria` devolve 501 e
`GET /api/admin/eu` devolve 404 no servidor estático local porque são endpoints da
plataforma Next, ausentes fora dela. Ambos têm tratamento gracioso e existem em
produção.

**Achados:**

| # | Achado | Gravidade | Situação |
|---|---|---|---|
| F1 | Chave de JSON com acento (`perfil_benefício`) no gold do consignado | P2 | **Corrigido**: `perfil_beneficio` no pipeline, no front e nos testes |
| F2 | Gold do consignado sem dicionário de indicadores — as ressalvas de "valor líquido" e "órgão pagador" não viajavam com o dado | P1 | **Corrigido**: 6 verbetes no payload; os testes-guarda armaram (72 passam) |
| F3 | `inst/C0010069.json` buscado duas vezes ao abrir a página da IF | P3 | registrado |
| F4 | KPI "Sem dependência bancária" na régua da penetração é de cobertura nacional e não responde ao filtro de região, embora esteja ao lado de KPIs que respondem | P3 | registrado (o rótulo declara o universo) |
| F5 | ~24 MB transferidos ao navegar todas as páginas em servidor local sem compressão; em produção o CDN comprime (os golds municipais de 6–7 MB caem para ~1 MB) | P2 | registrado, com recomendação |

## 4. Reconciliação de dados entre painéis e contra as fontes

**Veredito: nenhum P0 e nenhum P1 de dados.** A varredura sistemática dos 36 golds não
encontrou NaN, Infinity, duplicata de código IBGE ou CNPJ, percentual estourado real ou
composição que não feche.

**Consistência entre painéis, verificada exata:**
- Consignado PF no SCR (R$ 796.078.927.459, 2026-05) idêntico em `consignado.json`,
  `juros.json` e nas duas matrizes do `panorama.json`, e igual ao warehouse ao centavo.
  SGS 20579 (R$ 785,5 bi, 2026-06) difere por fonte e data-base — declarado nos avisos
  do próprio gold. A fatia de aposentados (R$ 159.941.111.837) bate entre
  `panorama.json` e `consignado.json` dígito a dígito.
- ESTBAN: verbete 160 (R$ 7.118.325.930.312) e verbete 169 (R$ 1.664.641.153.001)
  idênticos entre gold e warehouse.
- População 203.080.756, adultos 154.346.198, domicílios 72.461.369 e renda domiciliar
  anual R$ 3.971.531.442.318,59 — exatos em todos os cruzamentos entre `penetracao`,
  `moradia` e `consignado`.
- Os dois conceitos de inadimplência (SGS 21082/21084 vs carteira arrastada do SCR)
  nunca aparecem sob o mesmo rótulo; o `panorama.json` declara a diferença no próprio
  payload.

**Reconciliação contra 6 fontes primárias:** SGS 20578/20579 idênticos; txjuros Olinda
(n=36, min 18,85, mediana 24,38, máx 34,55) idêntico; Desenrola dígito a dígito
(2.685.590 operações, R$ 4.517.389.451,58, 73 conglomerados); benefícios do INSS com o
resíduo de exatamente 346 (Boa Esperança do Norte/MT, documentado); Pix com divergência
de 0,0000034% por revisão da fonte posterior à coleta — autocorrige na recarga diária;
SGS 20539/21084 do Pulso idênticos.

**Correções desta seção:** o conceito de `carteira` no `juros.json` dizia "estoque da
modalidade", mas o SCR não separa as modalidades do txjuros — as três variantes de
consignado compartilham a carteira do produto inteiro (R$ 796 bi ≠ R$ 282 bi da
modalidade INSS). Texto corrigido no pipeline e no gold publicado. A `janela.fim`,
hardcoded nula, passou a ser preenchida do warehouse (efetiva na próxima rodada do CI,
que detém a tabela). E a cobertura da Penetração não fechava o universo: com saldo
(2.914) + sem dependência (2.654) = 5.568 ≠ 5.570 — os dois municípios com agência e
saldo zero (Santa Lúcia/SP e Santa Maria da Serra/SP) não caíam em rótulo nenhum. O
gold ganhou o terceiro estado, `com_dependencia_sem_saldo`, e o universo fecha.

## 5. Qualidade de código

Auditados `app.js` (8.671 linhas), `styles.css` e `index.html`.

**O que está bem:** os 105 handlers globais são únicos, sem colisão entre abas; os 30
renderizadores principais guardam seus datasets na entrada; `fetch` e `JSON.parse` têm
catch em todos os caminhos; formatação de número centralizada no objeto `fmt`, sem
vírgula decimal manual; zero `console.log` esquecidos; os `onclick` de município
interpolam código IBGE, nunca nome — apóstrofos não quebram clique (verificado no
navegador com Alta Floresta D'Oeste).

**Corrigido nesta auditoria:**
- P0: `font-weight` inválido nas seis `@font-face` (regressão da consolidação de tokens).
- P1: busca da Penetração reescrita (datalist + Enter); buscas do Pix e do produto com
  preservação de foco e cursor através do re-render.
- P1: guard de `ibcc` nulo na Visão geral (TypeError com filtro de segmento salvo) e de
  `bancos` no RJ.
- P2: seis famílias de CSS morto removidas (`.morkpi`, `.cgcorr`, `.descomp`, `.desdl` e
  media queries órfãs); `DES_SELOS` e `PX_DEFAULT_INSTS` mortos removidos; o selo
  "contextual" do `penSelo` mapeava para a classe de série descontinuada (com riscado) —
  ganhou classe própria `.ctx`; `download()` sem `revokeObjectURL` vazava object URLs.
- P2: chave `perfil_benefício` acentuada renomeada para `perfil_beneficio` (gold, front
  e testes) — funcionava por coincidência de normalização Unicode.

**Registrado sem correção (P2/P3):** seis funções de selo e quatro escalas de mapa
quase-duplicadas (vocabulários deliberados, renderização unificável); três blocos de
mapa municipal copiados; dois helpers de download; cinco reimplementações inline de
escape CSV; buscas que não normalizam acento (`searchInst`, `cmpAdd`); estado
fragmentado em singletons por aba; `index.html` sem `og:image`, `canonical` e preload
de fontes; latente do `pxSet('setor')` que remove apóstrofo do valor mas compara com o
original.

## 6. Correções desta auditoria

| # | Gravidade | Correção | Verificação |
|---|---|---|---|
| 1 | P0 | `font-weight: 100 900` restaurado nas 6 `@font-face` | `document.fonts` reporta a faixa nas 3 famílias |
| 2 | P1 | Busca da Penetração: datalist + seleção no Enter | Digitado "pau", input sobrevive, 3 Pau D'Arco sugeridos, Enter seleciona 2207793 |
| 3 | P1 | Foco preservado nas buscas do Pix e do produto (`comFocoPreservado`) | código; testes verdes |
| 4 | P1 | Guard de `ibcc` nulo na Visão geral | código |
| 5 | P1 | Guard de `credores.bancos` no RJ | código |
| 6 | P1 | Dicionário de indicadores no gold do consignado (6 verbetes: líquido, órgão pagador, créditos≠pessoas...) | testes-guarda armaram; 72 passam |
| 7 | P2 | Conceito de carteira no `juros.json` corrigido (produto ≠ modalidade) | gold publicado |
| 8 | P2 | `janela.fim` do txjuros preenchida do warehouse | pipeline; efetiva no CI |
| 9 | P2 | Cobertura da Penetração fecha o universo (terceiro estado, 2 municípios) | 2.914+2.654+2=5.570 ✓ |
| 10 | P2 | `perfil_beneficio` sem acento em gold, front e testes | build + testes |
| 11 | P2 | CSS morto (6 famílias) e JS morto (2 consts) removidos | grep zero |
| 12 | P2 | Selo "contextual" com classe própria, sem riscado | CSS |
| 13 | P2 | `revokeObjectURL` no helper de download | código |

512 testes passam após todas as correções. Navegação completa refeita: 28 views limpas,
zero erros de console, filtros com restauração exata, exportação coletando as tabelas.

## 7. Pendências e recomendações

**Pendências resolvidas em rodada subsequente (v0.53):**
1. **Selos e escalas consolidados** — renderização única `seloChip` com vocabulário por
   página (os dicionários deliberados sobrevivem; a divergência acidental de classe não);
   `cgEscala` delega em `penEscala` com cor parametrizada, preservando o bronze dos mapas
   de penetração e moradia e as duas paletas do consignado.
2. **Acento normalizado** nas quatro buscas que só casavam minúscula (instituições,
   comparador, municípios do Pix, matriz do produto) — "Itau" acha "Itaú".
3. **Densidade** — no Desenrola, matriz de viabilidade, dicionário e notas de selo
   viraram `<details>` fechados; no consignado, a linha do tempo regulatória (19 eventos)
   dobrou e o dicionário do gold ganhou renderização, também dobrado.
4. **Tabelas em celular** — visualização móvel própria: abaixo de 700px, tabelas de
   cabeçalho simples com 5+ colunas empilham cada linha num bloco titulado com par
   rótulo:valor (o rótulo vem do cabeçalho, anotado uma vez por tabela). Tabelas
   estreitas e de cabeçalho mesclado continuam tabelas, que é o formato certo para elas.
   Armadilha encontrada e tratada: `innerText` de cabeçalho dentro de `<details>` fechado
   é vazio — a anotação usa `textContent`. 20 tabelas empilhadas em 7 páginas, zero sem
   rótulo, verificado a 390px.
5. **index.html** — preload dos dois woff2 latin, `canonical`, `og:url`, `twitter:card` e
   `og:image` (1200×630 gerada na identidade da plataforma, 72 KB).
6. **Busca dupla da página da IF** — a promessa em voo entra no cache; dois renders em
   sequência deixam de disparar a mesma requisição.
7. **Golds municipais divididos** — o array de 5.570 municípios sai do corpo e vai para
   `{nome}_mun.json` (penetração 7,2 MB, consignado 6,6 MB, moradia 2,4 MB), deixando os
   corpos com 125–155 KB. A razão é granularidade de cache: municípios mudam na data-base
   mensal, agregados e séries na rodada diária. O front costura via `costuraMunicipios` e
   continua compatível com golds antigos de array embutido; os testes costuram do mesmo
   jeito.

**Pendências que permanecem (P3):**
- KPI de cobertura nacional na régua da penetração não responde ao filtro de região
  (o rótulo declara o universo — decisão mantida).
- Uma largura inline restante no app.js, em contexto onde a remoção quebraria o layout.
- Consolidar os três blocos de mapa municipal copiados (pen/mor/cg) num componente.

**Limitações por indisponibilidade de dados (não são defeitos):** carteira municipal de
consignado não existe em fonte pública; beneficiários (pessoas) só existem por UF; valor
bruto de benefícios não existe por município; Censo 2022 não coletou aluguel nem
prestação; SCR público não tem detalhamento municipal.

**Contra regressões:**
- Os testes de gold travam totais, reconciliação e o resíduo de 346 — perda silenciosa
  de coletor vira falha de teste.
- A regra de medida de leitura é global; página nova herda sem opt-in.
- Toda mudança de CSS em massa por regex deve rodar `document.fonts`/getComputedStyle no
  navegador antes do commit — o P0 desta auditoria nasceu exatamente de uma regex.
- O checklist de layout medido (memória do projeto) permanece obrigatório antes de
  qualquer entrega.
