# Saúde: auditoria das tabelas de captura–recaptura

Revisão de 12/10/2026. **As duas planilhas oficiais examinadas não fornecem o recorte municipal necessário. Saúde permanece fora do escore.** Esta etapa amplia a busca de evidências registrada em [PRECISAO_SAUDE.md](PRECISAO_SAUDE.md).

## O que foi encontrado

A [apresentação do Ministério da Saúde](https://svs.aids.gov.br/daent/acesso-a-informacao/acoes-e-programas/captura-recaptura/apresentacao/) descreve a comparação dos registros do MS e do Registro Civil para estimar eventos não captados. Informa a adoção de captura–recaptura em substituição à busca ativa e anuncia divulgação municipal inicialmente para todas as capitais e municípios com pelo menos 300 mil habitantes. Esse anúncio motivou a inspeção dos arquivos, mas não foi tratado como confirmação da disponibilidade de dados municipais.

O [catálogo de indicadores](https://svs.aids.gov.br/daent/acesso-a-informacao/acoes-e-programas/captura-recaptura/mortalidade/) oferecia os arquivos abaixo. Eles foram baixados integralmente, com verificação de todas as abas e dos rótulos territoriais, incluindo a ausência de abas ocultas. Há 33 territórios por aba: Brasil, cinco regiões e 27 UFs. O cabeçalho territorial é `UF`.

| Arquivo e aba | Anos presentes | Recorte efetivamente encontrado | Uso no OBEE |
|---|---|---|---|
| [Cobertura SIM Infantil](https://svs.aids.gov.br/daent/acesso-a-informacao/acoes-e-programas/captura-recaptura/mortalidade/cobertura-SIM.xlsx) | 2015–2023 | Brasil, regiões e UFs | Contexto de registro infantil; sem transferência para capitais |
| Cobertura SIM Total, no mesmo arquivo | 2015–2023 | Brasil, regiões e UFs | Contexto de todas as idades; sem substituição de óbitos infantis |
| [TMI](https://svs.aids.gov.br/daent/acesso-a-informacao/acoes-e-programas/captura-recaptura/mortalidade/taxa-mortalidade-infantil.xlsx) | 2000–2024 | Brasil, regiões e UFs | Taxa corrigida contextual; sem substituir a taxa municipal registrada |

O snapshot preserva os 297 valores do triênio 2021–2023 nessas três abas, com células e notas da fonte. **São 297 valores contextuais e nenhuma célula de cobertura infantil municipal elegível neste conjunto de arquivos.** Isso não significa cobertura zero dos sistemas, nem prova inexistência de dados municipais em outras publicações.

## Decisão de integração

- Não associar territórios por nome. `São Paulo` e `Rio de Janeiro` representam estados nessas planilhas; nomes iguais aos das capitais não autorizam a junção.
- Não aplicar cobertura estadual aos óbitos municipais. Não usar cobertura de todas as idades como cobertura infantil.
- Não calcular o triênio pela média simples das taxas anuais corrigidas. Para uma razão de somas corrigida, são necessários os eventos e nascimentos corrigidos compatíveis, ou pesos/denominadores documentados.
- A auditoria preserva `health_score=null`, `score_eligible=false`, `correction_applied=false` e `publication_ready=false`. Não altera os cinco indicadores, pesos ou escores existentes.

O validador rejeita revisão silenciosa de arquivo, alteração de anos, métrica ou unidade, duplicatas, valores ausentes/fora do domínio e mudança de nível geográfico. Esses controles auditam a edição examinada; não constituem um mecanismo automático de aprovação de futuras fontes municipais.

## Próxima aquisição delimitada

| Etapa | Critério para encerrar |
|---|---|
| Obter a publicação municipal anunciada pelo MS | Arquivo oficial com código IBGE, município de residência, óbitos de menores de um ano e anos identificados |
| Compatibilizar 2021–2023 | Evidência para as 26 capitais nos três anos, ou revisão explícita do contrato temporal antes de comparar resultados |
| Validar correção e agregação | Cobertura específica ou eventos corrigidos, nascimentos compatíveis, definições, versão, precisão publicada e limites do método |
| Avaliar inclusão na cesta | Revisão de validade do desfecho materno-infantil e sensibilidade da nova cesta; referência versionada separada da v2 |

Se a fonte municipal estiver disponível apenas para outro período, não extrapolar fatores nem escolher uma janela em função da ordenação obtida. A aquisição deve abrir uma nova decisão metodológica. Não há prazo de publicação municipal confirmado nesta revisão. A frente de Saúde pode seguir sem impedir o desenvolvimento dos demais capítulos.

## Evidências e reprodução

Entradas: `pipeline/eficiencia_resultados/seed/saude/ms-captura-recaptura-2026-10-12.json`. Resultado: [saude-captura-recaptura-auditoria.json](saude-captura-recaptura-auditoria.json).

| Arquivo adquirido | SHA-256 |
|---|---|
| cobertura-SIM.xlsx | `dd3cd353f48d63ec589e67460fead6e85cb578c43b3f1d9916acfa3f4406636c` |
| taxa-mortalidade-infantil.xlsx | `a8cfccad239f134747e1fbfd41051f079dc267a6cb0d736812e69a349a9f0706` |

Revisão congelada e testes sem rede, somente com biblioteca padrão:

```sh
python3 -m pipeline.eficiencia_resultados.captura_recaptura --output /tmp/saude-captura-recaptura-auditoria.json
python3 -m unittest pipeline.eficiencia_resultados.test_captura_recaptura
```

Reextração opcional, com `openpyxl`, após baixar os dois XLSX oficiais no diretório indicado:

```sh
python3 -m pipeline.eficiencia_resultados.captura_recaptura --downloads /tmp/obee-saude-captura --output /tmp/ms-captura-recaptura-reproduzido.json
```

Os hashes devem corresponder à edição auditada. Uma atualização da fonte exige nova revisão, não substituição automática do snapshot. O extrator lê os XLSX; não os modifica. Os testes de escopo foram incorporados ao comando Python da CI.
