# Arquitetura de dados do domínio Energia

## Cadeia

```
SOURCE            CCEE, ONS, ANEEL (catálogo CKAN e arquivos primários)
  ↓ captura       arquivo original + sha256 + url + capturado_em + publicado_em (quando a fonte informa)
RAW / BRONZE      data/energia/bronze/<dataset>/<recurso>/<capturado_em>.<sha12>.<ext>   (imutável)
  ↓ normalização  parse determinístico, unidades e códigos de submercado padronizados
NORMALIZED/SILVER data/energia/silver/energia.db  (observações por vintage, append only)
  ↓ agregação     regras publicadas (médias, percentis, participações)
ANALYTICS / GOLD  public/energia/gold/*.json  (+ public/energia/series/*.csv)
  ↓
INDICATOR         objeto Indicador com natureza, valor, período e Proveniencia
  ↓
VISUALIZATION     páginas /setor-eletrico/*   |   MODEL (features por vintage)
```

## Silver com vintages

```sql
vintages(vintage_id PK, dataset, recurso, url, capturado_em, publicado_em, sha256, bytes, origem)
observacoes(dataset, serie, ref, valor, vintage_id, PRIMARY KEY(dataset, serie, ref, vintage_id))
```

* Uma observação só ganha nova linha quando o valor muda em relação à última vintage: revisões ficam registradas, nunca sobrescritas.
* `como_estava_em(serie, T)` devolve, para cada `ref`, o valor da vintage mais recente com `capturado_em ≤ T`. Toda feature de modelo e todo backtest usam essa consulta.
* Valor ausente não gera linha. `NULL` não vira zero em nenhuma etapa.

## Datas distinguidas

| Campo | Significado |
| --- | --- |
| `ref` | período a que o valor se refere (hora, dia, semana operativa) |
| `publicado_em` | quando a fonte publicou (metadado `last_modified` do recurso CKAN, quando existe) |
| `capturado_em` | quando a Scrutiniums baixou o arquivo |
| `cutoff` | instante máximo de informação admitido por uma previsão |
| `emitido_em` | quando a previsão foi registrada |

## Fontes integradas nesta fase

| Dataset | Órgão | Granularidade | Série gold |
| --- | --- | --- | --- |
| PLD_HORARIO (recursos 2021 a 2026) | CCEE | horária por submercado | `pld.json` |
| EAR diário por subsistema | ONS | diária | `hidrologia.json` |
| ENA diário por subsistema | ONS | diária | `hidrologia.json` |
| Carga de energia diária | ONS | diária | `carga.json` |
| Balanço de energia nos subsistemas | ONS | horária, agregada por dia | `geracao.json` |
| Intercâmbios entre subsistemas | ONS | horária, agregada por dia | `rede.json` |
| CMO semanal | ONS | semana operativa | `cmo.json` |

**Acesso à CCEE.** O acesso automatizado ao portal de dados abertos da CCEE é instável: respondeu 403 ("Acesso bloqueado") em tentativas manuais na manhã de 28/09/2026 (não registradas no log de coletas) e aceitou a coleta direta do pipeline às 10h55 UTC do mesmo dia (registrada em `coletas` e em `meta.json`). A série de 2021 a 2025 vem das capturas primárias do projeto PLD de 27/09/2026 15:44 UTC, versionadas em `pipeline/energia/seed/ccee_pld_horario/` com sha256 por arquivo e o `package_show` original; o arquivo de 2026 vem da coleta direta de 28/09/2026. O coletor direto (`pipeline/energia/fontes/ccee.py`) tenta a fonte a cada execução; falha vira registro de pane, nunca dado. Conferência cruzada: as 76.032 horas de 2022-11 a 2024-12 coincidem exatamente com o snapshot `snap_bootstrap_20260927T154527Z` do artefato PLD r4.

## Gold: contrato mínimo

Todo arquivo gold do domínio tem `dominio: "energia"`, `gerado_em`, `versao_pipeline`, `disponivel` e, para cada indicador, um objeto `Proveniencia` (ver `MODELO_AUDITABILIDADE.md`). Falha de construção grava stub `{disponivel:false, motivo, ultima_execucao}` e mantém a publicação anterior pela sentinela.

## Execução

* `python3 pipeline/energia/run.py` (coleta, silver, gold) e `--sem-coleta` para reconstruir a gold do estado atual.
* Workflow diário próprio `atualizar-energia.yml`, separado do Crédito, com cache de `data/energia`, testes antes do commit e publicação em `public/energia`.
* Dependências: somente biblioteca padrão, como o restante do pipeline.

## Validações automáticas da camada

* Toda série da gold tem natureza, fonte, unidade e período; métrica calculada tem fórmula.
* Nenhum ponto ausente é serializado como zero (valores faltantes são `null`).
* sha256 de cada captura CCEE confere com o manifesto.
* Dado observado não pode ter referência além do horizonte de publicação declarado do dataset: PLD até o fim do dia seguinte à captura (o PLD de cada hora é publicado na véspera); CMO semanal até a semana operativa seguinte; demais séries ONS até a data da captura.

## Riscos operacionais registrados na auditoria

* Persistência do histórico: bronze e silver (`data/energia`) vivem no cache do GitHub Actions, fora do git. Se o cache expirar, a gold publicada continua correta, mas o registro de vintages e revisões anteriores se perde e a detecção de revisões recomeça do zero. Encaminhamento: armazenamento durável (bucket versionado ou release com o banco SQLite compactado) a decidir pelo responsável pela plataforma.
* Coleta da CCEE: o portal recusou a coleta automatizada (HTTP 403) na manhã de 28/09/2026 e a aceitou horas depois. A coleta é tentada em cada execução; o resultado da última tentativa entra em `meta.json` e nos textos de limitação, sem frase fixa.
* Horizonte de publicação: implementado em `pipeline/energia/validacoes.py`; referência além do horizonte recusa a gold e mantém a anterior no ar.

