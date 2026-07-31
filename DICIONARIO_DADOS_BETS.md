# DICIONARIO_DADOS_BETS.md — dicionário do gold `bets.json`

Arquivo canônico: `pipeline/curated/bets.json` (copiado a `data/gold/bets.json` pelo pipeline e servido em `public/obs/data/gold/bets.json`). Versão: campo `versao` (semver). Snapshot verificável: histórico git + campo `gerado_em`. Checksum: `git hash-object pipeline/curated/bets.json`.

## Campos raiz
| Campo | Tipo | Descrição |
|---|---|---|
| gerado_em | ISO datetime | data da curadoria (vintage do arquivo) |
| corte_pesquisa | date | data de corte da pesquisa (31/07/2026) |
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

## Transformações
Únicas transformações aplicadas a dados oficiais: (1) 2S2025 = ano − 1S (mesma fonte/conceito, status `calculado` com campo `derivacao`); (2) GGR médio mensal por apostador = GGR semestre ÷ apostadores ÷ 6 (status `calculado`, média declarada como média). Nenhuma outra derivação, payout implícito ou anualização.

## Periodicidade e status de atualização
| Bloco | Periodicidade esperada | Atualização |
|---|---|---|
| ggr_regulado, apostadores, arrecadacao | semestral (Panoramas SPA: fev e ago) | manual documentada |
| autoexclusao, bloqueios_ilegais | eventual (notícias gov.br) | manual |
| séries de crédito do explorador | mensal (SGS) | automática (pipeline diário) |
| estudos, timeline | eventual | manual |

Quando não houver dado público: a UI exibe "dado público ainda não disponível". Placeholders e dados sintéticos são proibidos nesta aba (não há modo demo).
