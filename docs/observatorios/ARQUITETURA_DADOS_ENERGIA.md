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

**Acesso à CCEE.** O portal de dados abertos e o servidor de download da CCEE respondem 403 ("Acesso bloqueado") a partir do ambiente de construção desta fase (medido em 28/09/2026). A série horária foi integrada a partir das capturas primárias do projeto PLD de 27/09/2026 15:44 UTC, versionadas em `pipeline/energia/seed/ccee_pld_horario/` com sha256 por arquivo e o `package_show` original. O coletor direto (`pipeline/energia/fontes/ccee.py`) tenta a fonte a cada execução; falha vira registro de pane, nunca dado. Conferência cruzada: as 76.032 horas de 2022-11 a 2024-12 coincidem exatamente com o snapshot `snap_bootstrap_20260927T154527Z` do artefato PLD r4.

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
