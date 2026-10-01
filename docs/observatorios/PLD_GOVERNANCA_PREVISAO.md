# PLD: governança de previsão

## Estado em 30/09/2026 (evidência)

Até 28/09/2026 o repositório não tinha código de previsão nem construtor de variáveis: o registro de modelos e a rodada de 27/09/2026 foram transcritos do artefato externo de pesquisa `PLD_PREVISOES_EXPLICADAS v1-previa-r4` (sha256 `5af8904bb0382d153b785911a99ec32bc27f5f7030f8c4aaf39d38ea8b7f449d`, código de pesquisa `1b6ba3d`). Em 30/09/2026 o observatório passou a ter o próprio código (`pipeline/energia/previsoes/`), reexecutável a partir do silver com vintages. Método, números e evidências: `docs/observatorios/energia/modulos/previsoes.md`.

| Item | Estado |
| --- | --- |
| Previsão principal ("Para onde o PLD pode ir?") | sem número: nenhum modelo em PRODUÇÃO |
| Referência experimental B0 (seção 12.4 da especificação) | publicada, identificada como tal, sem faixa; primeira rodada: origem 30/09/2026, emitida às 23h31 UTC (manual e atrasada, registrada assim) |
| Rodada de 27/09/2026 (pesquisa) | 28 células sem número; causa reproduzida: no corte das 07h o sistema não tinha nenhuma captura do PLD (a primeira é das 15h44 UTC daquele dia) |
| Rotina diária | implementada e agendada (`.github/workflows/previsao-pld.yml`); ainda não comprovada por execução agendada real |
| Candidatos | C2-P e C2-H reimplementados (versões `C2-P-obs1`, `C2-H-obs1`) e avaliados; C1 sem configuração publicável, não reimplementado; todos em PESQUISA |
| Validação reproduzível do observatório | teste retrospectivo fora da amostra publicado em `previsoes_desempenho.json` (P016) |
| Resultados do artefato de pesquisa | continuam retidos (`publicacao_resultados.liberada = false`) |
| G4 | não concluível no repositório (código e arquivos da pesquisa fora dele); decisão do responsável |
| G23-R1 | documentado com evidência na reimplementação (coeficiente acima de 1 e previsões brutas fora da faixa); decisão revisável |

**Duas coisas diferentes com o nome "resultado".** Os resultados do artefato de pesquisa (métricas calculadas fora do repositório) seguem retidos até a G4 e a liberação formal pelo responsável. A validação do observatório é outra evidência: calculada pelo pipeline com código e dados públicos, reexecutável por qualquer pessoa, publicada porque o painel P016 a exige. Ela não aprova nem promove modelo e pode ser suspensa pelo responsável (`validacao_observatorio.publicar = false` no registro de modelos).

**Números de rodada interna dos candidatos.** A retenção também vale para rodada interna: enquanto `publicacao_resultados.liberada` for falso, o validador recusa número em registro `RODADA_INTERNA`, e a rotina diária não emite C2-P nem C2-H. O período prospectivo dos candidatos só começa depois da liberação formal. Valor não finito (NaN, infinito) é barrado em qualquer campo numérico, e faixa rotulada como 80% em qualquer grafia exige calibração CALIBRADO.

## Estados do modelo

```
PESQUISA ──(gate V)──> VALIDAÇÃO ──(gate P)──> PRODUÇÃO ──> APOSENTADO
```

| Estado | Onde pode aparecer |
| --- | --- |
| PESQUISA | model card e área técnica, com selo; nunca como previsão principal. B0, por regra própria da especificação, pode aparecer como referência experimental identificada |
| VALIDAÇÃO | área técnica, marcada; previsões apenas como "em validação", fora do bloco principal |
| PRODUÇÃO | única fonte do bloco "Para onde o PLD pode ir?" |
| APOSENTADO | histórico; previsões antigas continuam no arquivo |

**Gate V (pesquisa → validação):** teste retrospectivo só com informação disponível no corte (vintages e regra LAT1D), comparação pareada contra referências com incerteza (bootstrap por blocos), calibração medida em suporte comum, limitações e falhas documentadas, revisão independente ACEITO sem bloqueante. Os quatro primeiros itens estão publicados para C2-P e C2-H; falta a revisão independente.

**Gate P (validação → produção):** período prospectivo com rodadas registradas antes do realizado (mínimo definido no registro, proposta: 12 origens semanais), apuração publicada, calibração dentro da tolerância declarada ou faixa suprimida, aprovação do dono com data, versão de código e snapshot registrados.

## Regras de publicação (bloqueios por arquitetura)

`pipeline/energia/governanca.py` recusa a publicação e os testes (`energia-governanca.test.ts`, `pipeline/tests/test_energia_previsoes.py`) falham quando:

1. o modelo não está em PRODUÇÃO (registro `PUBLICACAO`);
2. falta versão de modelo, versão de código ou snapshot;
3. alguma feature tem `capturado_em` posterior ao `cutoff`;
4. um registro já publicado muda de conteúdo (hash) sem ser uma nova versão com `substitui` e `motivo`;
5. quantis aparecem como "faixa de 80%" sem avaliação de calibração com status `CALIBRADO`;
6. um valor de CENÁRIO aparece como PREVISTO;
7. a ausência de previsão é serializada como número;
8. um registro `REFERENCIA_EXPERIMENTAL` vem de modelo sem autorização no registro (só B0), sem as condições da seção 12.4 verificadas com evidência, sem o rótulo "referência experimental", sem versões, corte ou variáveis usadas, ou com quantis sem calibração CALIBRADO;
9. a cadeia de hashes do arquivo quebra (registro apagado, reordenado ou editado no meio).

## Arquivo imutável de previsões

Fonte versionada:

* `pipeline/energia/previsoes/arquivo.jsonl`: registros anteriores ao particionamento (rodada de 27/09/2026). Congelado.
* `pipeline/energia/previsoes/emissoes/AAAA-MM.jsonl`: registros novos, um arquivo por mês de inclusão, só com acréscimo no fim. Cada registro guarda em `anterior` o sha256 do registro anterior na ordem do arquivo (o primeiro aponta para o último registro de `arquivo.jsonl`).
* `pipeline/energia/previsoes/apuracoes.jsonl`: apurações registradas à mão (vazio). As apurações calculadas (realizado, erro) ficam em `previsoes_desempenho.json` e no CSV de emissões, sem tocar o registro original.

Publicação: `public/energia/gold/previsoes.json` (bloco principal `atual`, `referencia_experimental`, resumo das últimas rodadas, `arquivo` com os registros anteriores ao particionamento e `emissoes` com o índice das partições) e `public/energia/series/previsoes_emissoes_AAAA-MM.json` (cada mês, carregado sob demanda). O arquivo não entra inteiro numa gold: ele cresce 28 linhas por modelo por dia.

A cada construção, `pipeline/energia/gold/modelos.py` confere o sha256 de cada registro, a cadeia, o mês de cada partição e compara cada mês com a publicação anterior (nada some nem muda). Os testes também conferem os registros contra listas fixas de `forecast_id` e sha256 gravadas quando o registro entrou (`src/tests/fixtures/previsoes-publicadas.json` para a rodada de 27/09; `pipeline/tests/dados/energia_previsoes/emissoes_publicadas.json` para a de 30/09), o que detecta edição mesmo quando arquivo e gold mudam juntos no mesmo commit.

Regras aplicadas a todo registro: sha256 confere; natureza, se declarada, é PREVISTO; nenhuma marca de cenário; faixa de 80% só com calibração CALIBRADO; nenhuma feature capturada depois do corte (datas comparadas como instantes com fuso). Na interface, número de rodada interna nunca aparece como previsão; a referência experimental aparece com o rótulo próprio, fora do bloco principal. O filtro "ver o arquivo como estava em" usa a data de inclusão no arquivo (`registrado_no_portal_em`), não a de emissão pela rodada.

| Campo | Conteúdo |
| --- | --- |
| `forecast_id` | identificador único (`run_id:horizonte:submercado:modelo` nos registros novos) |
| `tipo` | `PUBLICACAO` (previsão oficial), `RODADA_INTERNA` ou `REFERENCIA_EXPERIMENTAL` |
| `emitido_em`, `cutoff`, `prazo`, `origem`, `atraso_min` | datas e atraso real |
| `execucao` | modo (agendada ou manual), executor, endereço da execução |
| `horizonte`, `entrega`, `submercado` | alvo (ex.: W1, semana de sábado a sábado, SE) |
| `modelo`, `versao_modelo`, `estado_modelo`, `versao_codigo`, `configuracao_sha256`, `snapshot` | rastreio |
| `features_usadas` | período, valor e `capturado_em` de cada dado usado |
| `previsao`, `previsao_bruta`, `limites`, `quantis`, `calibracao` | valores (nulos quando indisponível) |
| `fracao_conhecida`, `horas_capturadas_ate_corte` | separação entre PLD já publicado e previsão |
| `status`, `motivo`, `alertas` | estado da célula (inclusive falha e atraso) |
| `anterior`, `sha256` | encadeamento e hash do conteúdo canônico |
| `substitui`, `motivo_correcao` | apenas em correções |

## Vintages e ausência de look-ahead

* As variáveis vêm de `base.como_estava_em(serie, instante)` (`pipeline/energia/previsoes/variaveis.py`). Na rodada real o instante é o corte das 07h00; coleta posterior ao corte não entra.
* Regra LAT1D (elegibilidade): um período só é informação se terminou até 1 dia antes do corte. Ela vale no teste retrospectivo e na rodada real, para os dois usarem o mesmo conjunto de informação.
* O teste retrospectivo não tem capturas nas origens antigas (a primeira do PLD é de 27/09/2026): é reconstrução sob a hipótese LAT1D, com sensibilidade a LAT2D e LAT3D, e fica separado do prospectivo.
* Revisões posteriores de fonte (o ONS declara "consistência recorrente" em EAR e ENA) ficam como vintages novas e não contaminam rodadas registradas; no teste retrospectivo do C2-H o risco existe e a magnitude das revisões observadas é publicada.

## Benchmarks obrigatórios

Persistência (B0) e sazonal (S0, mesmo período um ano antes). A pergunta de avaliação é "o modelo adiciona informação em relação à referência simples?", respondida com diferença pareada de MAE e intervalo de 90% por bootstrap de blocos de calendário das origens, que mantém juntas as células das mesmas origens (horizontes sobrepostos).

## Calibração

Regra proposta, a ratificar pelo dono: faixa P10 a P90 só é chamada de "faixa de 80%" quando a cobertura empírica, em amostra fora do ajuste com n ≥ 100, fica entre 75% e 85%. O observatório conta n em entregas distintas, não em origens (origens vizinhas preveem a mesma entrega). Fora disso a faixa aparece como "faixa não calibrada: conteve X% dos realizados" ou é suprimida; na previsão atual ela é suprimida. Quantis nunca são apresentados como intervalo de confiança.

## Model card

Objetivo, unidade (R$/MWh nominal), frequência, horizonte, submercados, features, dados de treinamento, janela, cutoff, metodologia, benchmarks, backtest, métricas, calibração, limitações, falhas conhecidas, data de promoção, versão de código, snapshot, auditoria, coeficientes da última origem de ajuste (C2) e reexecução com tolerância. Limitações e falhas encontradas na pesquisa permanecem registradas mesmo depois da promoção.
