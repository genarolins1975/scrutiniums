# Catálogo de fontes do setor elétrico

Objetivo de longo prazo: registrar todos os dados gratuitos relevantes do setor elétrico brasileiro, integrando por prioridade. O catálogo vivo é `public/energia/gold/catalogo.json`, gerado por `pipeline/energia/catalogo.py` a partir dos metadados oficiais (API CKAN de cada portal) mais as entradas registradas à mão em `pipeline/energia/catalogo_manual.json`. A página `/setor-eletrico/dados` o apresenta.

## Estados

| Estado | Critério |
| --- | --- |
| `CATALOGADO` | existência e metadados registrados (título, órgão, URL, licença, frequência) |
| `EM INTEGRAÇÃO` | coletor em desenvolvimento ou bloqueado por acesso |
| `INTEGRADO` | coletado pelo pipeline com bronze, sha256 e silver |
| `VALIDADO` | integrado e com validações automáticas passando (forma, unidades, cobertura, revisões) |
| `UTILIZADO EM INDICADOR` | alimenta indicador publicado |
| `UTILIZADO EM MODELO` | alimenta modelo registrado (qualquer estado) |

Os estados são cumulativos: um dataset `UTILIZADO EM INDICADOR` passou por todos os anteriores. `metadados_verificados` indica se o registro veio da API oficial (`true`) ou de cadastro manual ainda não conferido (`false`).

## Integrados nesta fase

| Dataset | Órgão | Licença | Estado |
| --- | --- | --- | --- |
| PLD_HORARIO (2021 a 2026) | CCEE | CC-BY-4.0 | UTILIZADO EM INDICADOR; UTILIZADO EM MODELO (pesquisa PLD) |
| EAR diário por subsistema | ONS | CC-BY | UTILIZADO EM INDICADOR |
| ENA diário por subsistema | ONS | CC-BY | UTILIZADO EM INDICADOR |
| Carga de energia diária | ONS | CC-BY | UTILIZADO EM INDICADOR |
| Balanço de energia nos subsistemas | ONS | CC-BY | UTILIZADO EM INDICADOR |
| Intercâmbios entre subsistemas | ONS | CC-BY | UTILIZADO EM INDICADOR |
| CMO semanal | ONS | CC-BY | UTILIZADO EM INDICADOR |

## Prioridade de catalogação e integração

1. **CCEE**: PLD horário (integrado), preços médios, contabilização, MRE e GSF, encargos (ESS), agentes, consumo por classe. Bloqueio de acesso a partir do ambiente de construção registrado.
2. **ONS** (85 conjuntos no portal): hidrologia por REE, bacia e reservatório; geração por usina; térmica por motivo de despacho; CVU; constrained-off eólico e fotovoltaico; CMO semi horário; capacidade instalada; indicadores de confiabilidade.
3. **ANEEL**: MMGD por distribuidora e município; tarifas TE e TUSD; DEC e FEC; resultado de leilões; RALIE (expansão); SIGA (capacidade outorgada).
4. **EPE**: PDE, anuário estatístico de energia elétrica, balanço energético nacional.
5. **MME**: boletins de monitoramento do sistema, portarias.
6. **Hidrologia e clima**: ANA (HidroWeb, SAR), INMET (estações).
7. **CVM e B3**: demonstrações e fatos relevantes das companhias do setor.
8. **ANP e IBGE**: combustíveis para térmicas, atividade econômica e população.

## Regras

* Fonte secundária nunca substitui a primária disponível sem declaração do motivo no registro (`motivo_fonte_secundaria`).
* Licença e condições de uso são registradas por dataset e exibidas na proveniência.
* Mudanças metodológicas declaradas pela fonte entram como `quebras` do dataset (ex.: carga do ONS passa a incluir estimativa de MMGD a partir de 29/04/2023).
* Dataset catalogado nunca alimenta número publicado; só `INTEGRADO` ou acima.
