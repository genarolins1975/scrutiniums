# DICIONARIO_DADOS_FRAUDES.md — dicionário do gold `fraudes.json`

Arquivo canônico: `pipeline/curated/fraudes.json` (copiado a `data/gold/fraudes.json` pelo pipeline; servido em `public/obs/data/gold/fraudes.json`). Versão: campo `versao` (semver). Snapshot verificável: histórico git + `gerado_em`. Checksum: `git hash-object pipeline/curated/fraudes.json`.

## Campos raiz
| Campo | Descrição |
|---|---|
| gerado_em / corte_pesquisa / versao / atualizacao | vintage, corte (31/07/2026), semver, processo de atualização |
| niveis | hierarquia A..E |
| sintese | KPIs do topo (conceito + status + nível por item) |
| series | estelionato, med, perdas_febraban, serasa_tentativas, incidentes_ciberneticos |
| tipos | tipos de fraude com frequência/perda média/recuperação e nível POR CÉLULA |
| cadeia | elos exposição→fraude→liquidez→crédito→inadimplência com grau de evidência |
| perfil | grupos mais afetados (associações) + lacunas declaradas |
| subnotificacao | camadas reportado/contestado/estimado/declarado + gap |
| explorador | comparador com séries de crédito (pulse.json) e marcos regulatórios |
| mitigacao | camadas de recuperação com eficácia conhecida |
| estudos / timeline / metodologia / links_apoio | biblioteca, linha do tempo 2012-2026, metodologia, canais oficiais |

## Definição operacional de fraude nesta aba
Evento em que terceiro obtém recurso ou crédito da vítima por engano, engenharia social ou acesso indevido, no contexto financeiro digital ou presencial. Cada fonte recorta o fenômeno de forma própria (BO, contestação MED, reporte bancário, declaração em survey); o campo `conceito` de cada item declara o recorte. Não existe "número único de fraude no Brasil".

## Regras invariantes (testadas)
1. **Tentativa vs perda**: `serasa_tentativas.conceito` contém "tentativa"; nenhum item de tentativa usa unidade monetária de perda.
2. **Bruto vs líquido**: MED separa `valor_contestado` (bruto) de `taxa_recuperacao`; perda líquida nunca é inferida sem devolução conhecida.
3. **Deduplicação**: nenhum campo do JSON soma valores de fontes distintas (matriz de duplicidade em FONTES_FRAUDES.md).
4. **Status × nível**: `status: imprensa` → nível ≠ A; `status: oficial` → URL de órgão público.
5. **Séries**: refs ordenadas e únicas; anual permanece anual (interpolação proibida); `quebra_metodologica: true` obrigatório no MED.
6. **Timeline**: datas em [2012-08-01, corte], URL https, status confirmado|parcial.

## Unidades
estelionato: ocorrências/ano · med: R$ bi e % · perdas_febraban: R$ bi/ano · serasa_tentativas: milhões de tentativas · incidentes_ciberneticos: contagem. Valores monetários nominais (sem deflacionamento nesta versão; deflacionar exigiria escolher índice e seria transformação adicional documentada).

## Periodicidade e status de atualização
| Bloco | Periodicidade | Atualização |
|---|---|---|
| estelionato | anual (Anuário FBSP, julho) | manual |
| med | mensal na fonte (D+30) | manual → automática planejada via API olinda no pipeline |
| perdas_febraban | anual | manual |
| serasa_tentativas | mensal na fonte | manual seletiva |
| incidentes_ciberneticos | semestral (REF) | manual |
| séries de crédito do explorador | mensal (SGS) | automática (pipeline diário) |

Sem dado público → a UI exibe "dado público consolidado ainda não disponível". Placeholders e dados sintéticos são proibidos (sem modo demo).
