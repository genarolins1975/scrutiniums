# DICIONARIO_DADOS_BETS.md — dicionário do gold `bets.json`

Arquivo canônico: `pipeline/curated/bets.json` (copiado a `data/gold/bets.json` pelo pipeline e servido em `public/obs/data/gold/bets.json`). Versão: campo `versao` (semver). Snapshot verificável: histórico git + campo `gerado_em`. Checksum: `git hash-object pipeline/curated/bets.json`.

## Campos raiz
| Campo | Tipo | Descrição |
|---|---|---|
| gerado_em | ISO datetime | data da curadoria (vintage do arquivo) |
| corte_pesquisa | date | data de corte da pesquisa (06/08/2026) |
| versao | semver | versão do dado curado |
| atualizacao | obj | processo, próxima esperada, verificado_em |
| niveis | obj A..E | definição da hierarquia de evidência |
| sintese | lista | KPIs do topo |
| series | obj | séries oficiais (ver abaixo) |
| cadeia | obj | elos do mecanismo econômico com grau de evidência |
| perfil | obj | quem aposta, por população/método |
| vulnerabilidade | obj | grupos, restrições e proteções |
| explorador | obj | configuração do comparador bets × crédito |
| mercado_ilegal | obj | estimativas com método e interesse declarado |
| estudos | lista | biblioteca de evidências |
| timeline | lista | linha do tempo regulatória 2018-2026 |
| metodologia | obj | princípio, conceitos, roadmap, open finance, descartados |
| links_apoio | obj | autoexclusão e saúde (links discretos) |

## Item de `sintese`
| Campo | Regra |
|---|---|
| valor | numérico ou null (quando o dado é um intervalo textual, ex. 41% a 51%) |
| exibir | string mostrada no cartão |
| unidade / conceito | obrigatórios; conceito explicita o que o número mede E o que não mede |
| data_ref / publicado_em | período de referência ≠ data de publicação |
| nivel | A..E |
| status | oficial · calculado · estimativa · imprensa |
| fonte / url | fonte primária preferencial; https obrigatório |
| nota | divergências e atualizações posteriores |

## `series.*`
- `ggr_regulado.obs[]`: ref (2025-S1, 2025-S2, 2026-T1), periodo, v (R$ bi), nivel, status, url; `derivacao` obrigatória quando status=calculado. Unidade: R$ bilhões. Fórmula: GGR = apostas − prêmios. Semestral; **interpolação proibida** (testada).
- `apostadores.obs[]`: v (milhões) + `conceito` POR PONTO (contas/semestre ≠ CPFs/ano ≠ CPFs/trimestre). Não é série contínua.
- `pix_pre_regulacao`: `quebra_metodologica: true` obrigatório; faixa [18,21] R$ bi/mês; nunca concatenar com GGR (testado).
- `autoexclusao.obs[]`: acumulado em mil; motivos com bases distintas (documentado).
- `bloqueios_ilegais.obs[]`: mil URLs acumuladas; oficial vs imprensa por ponto.
- `arrecadacao.obs[]`: tributos, destinacoes, outorgas, taxa_fiscalizacao (R$ bi) — conceitos que não se somam ao GGR.

## `explorador`
- `indicadores[]`: chaves de `pulse.json` (SGS via pipeline; códigos em FONTES_BETS.md).
- `indicadores_ausentes[]`: identificados e ainda não integrados (com motivo).
- `eventos[]`: marcos regulatórios anotados nos gráficos (x = YYYY-MM-01).
- `min_obs_correlacao`: 8 — abaixo disso a UI exibe "sem evidência suficiente" e não calcula correlação.
- `rotulos_validos`: vocabulário permitido de leitura ("movimento conjunto", "associação contemporânea", "associação com defasagem", "sem evidência suficiente", "não implica causalidade").

## Gold auxiliar `epae.json` (automático, não curado)

A aba de bets carrega um segundo arquivo, **`epae.json`**, produzido pelo pipeline a partir da planilha oficial da EPAE (BCB). Ele não é curado à mão e não faz parte de `bets.json` — a separação é deliberada: `bets.json` é curadoria versionada, `epae.json` é coleta automática mensal.

Fonte: `pipeline/sources/epae.py` (bronze com hash → tabela `epae_fluxo` no silver) e `pipeline/epae.py` (gold).

| Campo | Tipo | Descrição |
|---|---|---|
| fonte | obj | nome, instrumento (Pix/SPI), url da planilha, página do BC, nivel (A), sha256 e data da coleta |
| secao | obj | codigo (R), rotulo, rotulo_fonte (string exata da planilha) e `abrange` |
| aviso / limitacoes | texto / lista | negam explicitamente a leitura "isto é volume de bets" |
| revisao | texto | o BC revisa m-1 a m-3 e fecha m-4 a cada divulgação |
| cobertura | obj | inicio, fim, meses |
| serie.obs[] | lista | ref (YYYY-MM), `pf_para_secao`, `secao_para_pf`, `liquido`, `tx_*` (milhões de transações), `pf_para_pj_total` |
| anuais[] | lista | soma por ano civil com `meses` e `completo`; ano incompleto **nunca** é anualizado |
| comparacao | obj | confronto entre o líquido observado (A, calculado) e o valor atribuído às bets pelo estudo Comsefaz/Cicef (D, estimativa) |

Unidades: valores em R$ bilhões; transações em milhões. Única derivação: `liquido = pf_para_secao − secao_para_pf`, aritmética sobre dois valores publicados, declarada como calculada.

**Limite que não pode ser perdido:** a menor abertura pública da EPAE é a SEÇÃO da CNAE. A seção R agrega academias, clubes, cinemas, parques, loterias e apostas; a série não isola bets nem separa operador autorizado de ilegal. Qualquer parcela atribuída a apostas é de terceiro e aparece rotulada como tal.

## Transformações
Únicas transformações aplicadas a dados oficiais: (1) 2S2025 = ano − 1S (mesma fonte/conceito, status `calculado` com campo `derivacao`); (2) GGR médio mensal por apostador = GGR semestre ÷ apostadores ÷ 6 (status `calculado`, média declarada como média). Nenhuma outra derivação, payout implícito ou anualização.

## Periodicidade e status de atualização
| Bloco | Periodicidade esperada | Atualização |
|---|---|---|
| ggr_regulado, apostadores, arrecadacao | semestral (Panoramas SPA: fev e ago) | manual documentada |
| autoexclusao, bloqueios_ilegais | eventual (notícias gov.br) | manual |
| séries de crédito do explorador | mensal (SGS) | automática (pipeline diário) |
| `epae.json` (seção R da CNAE) | mensal (BCB, com revisão dos 4 últimos meses) | automática (pipeline diário) |
| estudos, timeline | eventual | manual |

Quando não houver dado público: a UI exibe "dado público ainda não disponível". Placeholders e dados sintéticos são proibidos nesta aba (não há modo demo).
