# PLD: governança de previsão

## Estado em 28/09/2026 (evidência)

Fonte: payload do artefato `PLD_PREVISOES_EXPLICADAS v1-previa-r4` (sha256 `5af8904bb0382d153b785911a99ec32bc27f5f7030f8c4aaf39d38ea8b7f449d`, gerado em 2026-09-28T01:34:26Z, código `1b6ba3d`).

| Item | Estado |
| --- | --- |
| Previsões numéricas publicadas | 0 |
| Rodadas internas registradas | 1: origem 2026-09-27, corte 2026-09-27T10:00Z, emitida 2026-09-27T19:10:13Z, modelo `B0-v1`, 28 células, 0 com número (motivo `SEM_PLD_CAPTURADO_ATE_O_CORTE`) |
| Promoção de modelo | nenhuma |
| Candidatos | B0 persistência, C1 mistura fixa, C2-P correção por preços, C2-H correção com hidrologia: todos em PESQUISA |
| Revisão da pesquisa | G0 a G3 aceitos; achado relevante G23-R1 pendente (C2 pode amplificar o sinal de preço; previsões mensais negativas na origem 30/11/2024) |
| Publicação da entrega de pesquisa (G4) | não enviada |
| Revisão do artefato | pendente; selo "prévia interna" |

**Decisão desta fase.** Os resultados numéricos da pesquisa (métricas, coberturas, comparações) **não** são publicados no portal enquanto G4 não for concluída e o dono não liberar. O registro de modelos traz estado, fórmula, dados, limitações declaradas pela pesquisa e ponteiros (caminho e sha256) para os arquivos de resultado; a página de cada modelo diz por que os números estão retidos. A rodada interna de 27/09 aparece como registro operacional (não é publicação) e demonstra o estado "indisponível".

## Estados do modelo

```
PESQUISA ──(gate V)──> VALIDAÇÃO ──(gate P)──> PRODUÇÃO ──> APOSENTADO
```

| Estado | Onde pode aparecer |
| --- | --- |
| PESQUISA | model card e área técnica, com selo; nunca como previsão |
| VALIDAÇÃO | área técnica, marcada; previsões apenas como "em validação", fora do bloco principal |
| PRODUÇÃO | única fonte do bloco "Para onde o PLD pode ir?" |
| APOSENTADO | histórico; previsões antigas continuam no arquivo |

**Gate V (pesquisa → validação):** backtest só com informação disponível no corte (vintages), comparação pareada contra benchmarks com incerteza (bootstrap por blocos), calibração medida em suporte comum, limitações e falhas documentadas, revisão independente ACEITO sem bloqueante.

**Gate P (validação → produção):** período prospectivo com rodadas registradas antes do realizado (mínimo definido no registro, proposta: 12 origens semanais), apuração publicada, calibração dentro da tolerância declarada ou faixa suprimida, aprovação do dono com data, versão de código e snapshot registrados.

## Regras de publicação (bloqueios por arquitetura)

`pipeline/energia/governanca.py` recusa a publicação e o teste `energia-governanca.test.ts` falha quando:

1. o modelo não está em PRODUÇÃO;
2. falta versão de modelo, versão de código ou snapshot;
3. alguma feature tem `capturado_em` posterior ao `cutoff`;
4. um registro já publicado muda de conteúdo (hash) sem ser uma nova versão com `substitui` e `motivo`;
5. quantis aparecem como "faixa de 80%" sem avaliação de calibração com status `CALIBRADO`;
6. um valor de CENÁRIO aparece como PREVISTO;
7. a ausência de previsão é serializada como número.

## Arquivo imutável de previsões

`public/energia/gold/previsoes/arquivo.json` (append only) e `atual.json`.

| Campo | Conteúdo |
| --- | --- |
| `forecast_id` | identificador único |
| `tipo` | `PUBLICACAO` (previsão oficial) ou `RODADA_INTERNA` |
| `emitido_em`, `cutoff`, `origem` | datas |
| `horizonte`, `entrega`, `submercado` | alvo (ex.: W1, semana operativa, SECO) |
| `modelo`, `versao_modelo`, `estado_modelo`, `versao_codigo`, `snapshot` | rastreio |
| `previsao`, `quantis`, `calibracao` | valores (nulos quando indisponível) |
| `status`, `motivo`, `alertas` | estado da célula |
| `sha256` | hash do conteúdo canônico do registro |
| `substitui`, `motivo_correcao` | apenas em correções |

A apuração (realizado, erro, métricas) é registrada em `apuracoes`, chaveada por `forecast_id`, sem tocar o registro original. Correção nunca sobrescreve: cria versão nova que aponta para a original. A página `/setor-eletrico/pld/previsoes` permite escolher qualquer data e ver exatamente o que a plataforma registrou naquele dia.

## Vintages e ausência de look-ahead

* Features vêm de `como_estava_em(serie, cutoff)` do silver com vintages.
* Para o PLD, o valor da hora h do dia D é publicado na véspera; a regra de elegibilidade da pesquisa (cenário `LAT1D`: dado elegível se o período terminou até um dia antes do corte) é mantida e registrada no model card.
* Revisões posteriores de fonte (ONS declara "consistência recorrente") ficam como vintages novas e não contaminam backtests anteriores.

## Benchmarks obrigatórios

Persistência (B0) e, quando aplicável, sazonal. A pergunta de avaliação é "o modelo adiciona informação em relação à referência simples?", respondida com diferença pareada e intervalo de confiança por blocos; skill score quando a métrica permite.

## Calibração

Regra proposta nesta fase, a ratificar pelo dono: faixa P10 a P90 só é chamada de "faixa de 80%" quando a cobertura empírica, em amostra fora do ajuste com n ≥ 100, fica entre 75% e 85%. Fora disso aparece como "faixa não calibrada: conteve X% dos realizados" ou é suprimida. Quantis nunca são apresentados como intervalo de confiança.

## Model card

Objetivo, unidade (R$/MWh nominal), frequência, horizonte, submercados, features, dados de treinamento, janela, cutoff, metodologia, benchmarks, backtest, métricas, calibração, limitações, falhas conhecidas, data de promoção, versão de código, snapshot, auditoria. Limitações e falhas encontradas na pesquisa permanecem registradas mesmo depois da promoção.
