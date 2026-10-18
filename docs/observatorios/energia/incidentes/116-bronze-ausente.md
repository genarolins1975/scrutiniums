# Golds e vintages sem bronze — issue #116

Auditoria em 18/10/2026, sobre `main` d0f184cab. Referência: [issue #116](https://github.com/genarolins1975/scrutiniums/issues/116). Este documento distingue a correção da construção das golds da aprovação dos testes que autorizam a publicação. A issue continua aberta; este PR não faz merge nem confirma publicação em produção.

## Evidência

### Cache e release

Os logs das execuções de `atualizar-energia.yml` mostram:

| Data UTC da execução | Run | Estado restaurado |
|---|---|---|
| 02/10/2026 | [36956062169](https://github.com/genarolins1975/scrutiniums/actions/runs/36956062169) | cache `energia-estado-36805398481` |
| 03/10/2026 | [37089237496](https://github.com/genarolins1975/scrutiniums/actions/runs/37089237496) | cache `energia-estado-36956062169` |
| 04/10/2026 | [37172261659](https://github.com/genarolins1975/scrutiniums/actions/runs/37172261659) | cache `energia-estado-37089237496` |
| 05/10/2026 | [37254978178](https://github.com/genarolins1975/scrutiniums/actions/runs/37254978178) | cache `energia-estado-37172261659` |
| 06/10/2026 | [37408274731](https://github.com/genarolins1975/scrutiniums/actions/runs/37408274731) | cache `energia-estado-37254978178` |
| 07/10/2026 | [37563076587](https://github.com/genarolins1975/scrutiniums/actions/runs/37563076587) | cache `energia-estado-37408274731` |
| 08/10/2026 | [37719964861](https://github.com/genarolins1975/scrutiniums/actions/runs/37719964861) | cache `energia-estado-37563076587` |
| 09 a 14/10/2026 | runs do workflow no intervalo, consultados pela API do Actions | restauração não alcançada; não são evidência de cache miss |
| 15/10/2026 | [38667375474](https://github.com/genarolins1975/scrutiniums/actions/runs/38667375474) | cache `energia-estado-37719964861`; execução cancelada |
| 16/10/2026 | [38836062390](https://github.com/genarolins1975/scrutiniums/actions/runs/38836062390/job/116765355442) | **cache ausente; silver restaurado da release** |
| 17/10/2026 | [38991067297](https://github.com/genarolins1975/scrutiniums/actions/runs/38991067297) | cache `energia-estado-38836062390` |
| 18/10/2026 | [39086602200](https://github.com/genarolins1975/scrutiniums/actions/runs/39086602200) | cache `energia-estado-38991067297` |

Prova da causa no [job de 16/10](https://github.com/genarolins1975/scrutiniums/actions/runs/38836062390/job/116765355442#step:5:1):

```text
2026-10-16T01:37:38.2959405Z Cache not found for input keys: energia-estado-38836062390, energia-estado-
2026-10-16T01:37:38.3063113Z gh release download energia-estado ... --pattern "energia-silver.db.gz" ...
2026-10-16T01:37:38.3065494Z ... --pattern "energia-silver-familias.tar.gz" ...
```

O passo seguinte iniciou a coleta às 01:38:17 UTC. Na mesma execução, a construção falhou ao abrir o bronze da previsão climática e do histórico do RALIE. Os logs posteriores mostram os mesmos caminhos ausentes da previsão e da rede da EPE, embora o cache tenha sido restaurado.

A [release energia-estado](https://github.com/genarolins1975/scrutiniums/releases/tag/energia-estado), consultada em 18/10/2026, continha apenas `energia-silver.db.gz` e `energia-silver-familias.tar.gz`, publicados naquele dia. O silver foi baixado dessa release e consultado com SQLite. As linhas confirmadas:

| Silver | Dataset/recurso | Captura UTC registrada | Caminho bronze registrado |
|---|---|---|---|
| `ons_hidrologia.db` | `clima_previsao / previsao_20261006T0000Z` | 07/10/2026 02:55:31 | `derivado/clima_previsao/previsao_20261006T0000Z/20261007T025531Z.ba879f36c971.json.gz` |
| `aneel_geracao.db` | `epe_webmap_rede / linhas-transmissao-existente.geojson` | 02/10/2026 04:17:45 | `epe/epe_webmap_rede/linhas-transmissao-existente.geojson/20261002T041745Z.a475463324b7.json.gz` |
| `aneel_geracao.db` | `epe_webmap_rede / linhas-transmissao-planejada.geojson` | 02/10/2026 04:18:01 | `epe/epe_webmap_rede/linhas-transmissao-planejada.geojson/20261002T041801Z.7af9583fea37.json.gz` |

Os caminhos acima são relativos a `data/energia/bronze/`. Esses arquivos não vieram na release. A previsão não teve vintage mais recente no silver consultado. O RALIE, por sua vez, recebeu novas vintages em 17/10/2026, como já sugeria o desaparecimento desse erro no comentário do dia seguinte.

### Outras golds e bloqueios à publicação

Os comentários completos da issue e os logs, sem o truncamento visual do GitHub, registram:

- 16/10/2026: `agua_detalhe.json`, `expansao.json` (RALIE), `empresas.json` (Polímero), `publicacao.json` (evidência sem chaves/consulta) e `territorio.json` da Energia (malha IBGE).
- 17/10/2026: mesmos módulos; em Expansão a falha já era a rede EPE.
- 18/10/2026: Água, Expansão, Publicação e Território da Energia; Empresas não aparece na lista de regressões.

Fonte: comentários [16/10](https://github.com/genarolins1975/scrutiniums/issues/116#issuecomment-6206627816), [17/10](https://github.com/genarolins1975/scrutiniums/issues/116#issuecomment-6228249492) e [18/10](https://github.com/genarolins1975/scrutiniums/issues/116#issuecomment-6244472873).

**A construção não é o único bloqueio.** O passo de testes da execução de 18/10 também falhou e reverteu toda `public/energia`. Exemplos registrados nesse log:

- `conta-cpf-browser.test.ts`: Chromium não instalado. O workflow passa a instalá-lo pelo mesmo comando do CI.
- `energia-carga.test.ts`: diferença contra `carga_diaria.csv` e respostas numéricas diferentes das esperadas.
- `energia-mercado.test.ts` e testes de conteúdo: expectativa de InfoMercado anterior ao boletim presente na gold reconstruída.
- Testes de conta/qualidade/regulação e limites de tamanho de HTML/JSON também falharam.

Essas reprovações de conteúdo não são classificadas como infraestrutura, não foram ignoradas e não têm suas expectativas alteradas neste PR. A suíte completa continua sendo obrigatória no workflow. A próxima publicação depende também de ela aprovar a gold reconstruída. A falha própria de evidência de `publicacao.json` e os módulos territoriais não são corrigidos aqui.

### Mercado

O [log de 07/10/2026](https://github.com/genarolins1975/scrutiniums/actions/runs/37563076587) aponta para a concatenação de `nota_ag`, inicialmente `None` quando não há séries mensais de agentes. O código de `main` ainda continha esse caminho; não há commit anterior que o tenha eliminado. O teste novo reproduziu o mesmo `TypeError` antes da correção. O caso deixa a nota e o período ausentes explícitos, sem tomar o calendário da EPE como período de dados inexistentes da CCEE.

No log de 18/10, `mercado.json` foi construída sem essa exceção: ter séries da CCEE evita o ramo problemático. Isso não provava que a causa estava corrigida. A reconstrução local também identificou páginas do MME sem bronze; a leitura dessas páginas agora é opcional e declara a verificação indisponível, sem inferir ausência de PDFs ou exigência de login.

## Inferência e limites da conclusão

A sequência cache ausente → silver sem bronze → referências órfãs está comprovada para 16/10/2026. Não há evidência nos logs consultados que atribua o despejo daquele cache especificamente ao limite de armazenamento. O tamanho aproximado e os incidentes anteriores já documentados nos comentários do workflow motivam preservar a política de cache, mas não são prova do agente que removeu essa chave.

A recaptura com conteúdo idêntico pode recuperar um caminho por sha256; ela não pode recriar uma previsão antiga que a fonte já não oferece. Portanto, depender só desse mecanismo não resolve o estado órfão atual.

## Recomendação implementada: linhas a + b + c

- **a — bronze durável:** `pipeline/energia/estado_bronze.py` usa somente a biblioteca padrão e empacota um superset verificável dos recursos usados pelas golds: a última vintage **disponível** de cada recurso em cada silver. O manifesto registra recurso, banco, captura, sha256 e recursos sem bronze. O tar em fluxo é dividido em assets com no máximo **1.900.000.000 bytes** (limite definido no código desta correção, inferior ao [limite de asset do GitHub de 2 GiB](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)). Não entra no cache: todos os arquivos de empacotamento/download ficam em `/tmp`. Referências a seeds já versionados são listadas em `externos`, sem serem copiadas para o pacote de bronze. Nomes de partes incluem hash; o manifesto sobe por último. As partes anteriores são removidas somente depois disso. A restauração confere todos os tamanhos e hashes antes de extrair e aceita apenas arquivos regulares sob `data/energia/bronze`.
- **b — recaptura:** o coletor CKAN e os atalhos de coleta de Expansão/rodadas climáticas só pulam uma captura recente se seu bronze existir. Resposta nova registra a vintage normal; resposta idêntica recupera o arquivo sem alterar a data original. Nenhuma vintage órfã ou observação histórica é apagada.
- **c — fallback honesto:** a seleção de conteúdo diferente ocorre explicitamente no consumidor, nunca dentro de `abre_bronze`. Água escolhe a rodada disponível, conserva emissão/captura e mantém a rejeição por idade já existente. A consulta de valores termina na captura escolhida. Sem rodada, o bloco fica indisponível com motivo. O mapa de bacias também é opcional. Expansão seleciona a rede EPE disponível com sua captura e sha256; sem as camadas, não calcula km. Se faltar algum dos históricos necessários do RALIE, mantém os blocos atuais e de transmissão e declara as análises históricas indisponíveis: contagens desconhecidas são `null`, não zero. O histórico mensal é limitado às capturas dos Parquet usados. Conferência sem bronze aparece como não executada, nunca aprovada.

`gerado_em` permanece a data de construção do documento. Emissão, captura, referência e indisponibilidade estão nos blocos e nas proveniências. Não há mudança de navegação ou de interface; os formatadores de Expansão já aceitam `null` para datas e contagens.

## Regeneração e números

Em 18/10/2026 foram executados, com o silver real da release:

```sh
python3 pipeline/energia/executar_modulo.py agua --sem-coleta
python3 pipeline/energia/executar_modulo.py expansao --sem-coleta
python3 pipeline/energia/executar_modulo.py mercado --sem-coleta
```

As construções ficaram disponíveis após a correção. O ambiente local não recebeu bronze da release e o proxy bloqueou a recaptura da ANEEL/EPE com HTTP 403; a reconstrução local é, portanto, uma simulação real da recuperação a partir de apenas silver. Não se substitui a publicação versionada por esse estado local incompleto. Os JSON/CSV gerados foram comparados e preservados como evidência de execução local, fora do commit.

| Bloco | Referência da publicação em `main` | Referência reconstruída | Motivo da diferença |
|---|---|---|---|
| Água: EAR, ENA e reservatórios | 29/09/2026 | 16/10/2026 | Novas observações ONS do silver da release de 18/10 |
| Água: precipitação | 14/09/2026 | 14/09/2026 | Sem avanço de cobertura nesse silver |
| Água: temperatura | 27/09/2026 | 03/10/2026 | Novas observações NASA/POWER no silver |
| Expansão: SIGA | 30/09/2026 | 15/10/2026 | Novo retrato ANEEL no silver |
| Expansão: RALIE atual | 18/09/2026 | 16/10/2026 | Novo retrato ANEEL no silver |
| Rede EPE e histórico RALIE na simulação sem bronze | Capturas anteriores publicadas | Indisponíveis, com motivo | Nenhum arquivo bruto local; não se estimaram medidas |

Fonte das referências: `dias_referencia`/`referencias` das golds versionadas e reconstruídas, conferidas em 18/10/2026. Os cálculos com bronze disponível continuam protegidos pelas reconciliações existentes; os novos testes usam o mesmo silver e removem apenas as referências brutas que estão sob teste.

## Conferências locais — 18/10/2026

Resultados dos comandos desta sessão, sem alterar testes existentes:

- `python3 -m unittest discover -s pipeline/tests -t .`: **1.999 testes**, verde, com seis skips existentes; pyarrow disponível no ambiente Python.
- `test_energia_bronze_orfao`: **17 testes novos** aprovados, incluindo as reproduções de Água, Expansão e Mercado, recaptura, fallback sem mistura de vintages, bytes preservados, divisão de assets, corrupção e seeds versionados.
- `npx tsc --noEmit`, `npm run lint` e `npm run build`: verdes.
- `npx vitest run --maxWorkers=2`: **316 arquivos**, **7.878 testes aprovados**, um skip existente; Chromium local indicado por `I18N_CHROMIUM_EXECUTABLE`.
- `node scripts/cobertura-i18n.mjs --check`: verde, inventário sem mudança necessária.
- Workflow carregado como YAML; cada bloco `run` conferido com `bash -n`: verdes.
- Empacotamento executado sobre o silver real da release: passou. Por ser a restauração local sem bronze, seus arquivos ausentes aparecem no manifesto, em vez de interromper a cópia; os seeds existentes ficam separados.

Os números de testes acima têm como fonte as saídas dessas execuções de 18/10/2026; não são medidas do setor elétrico.

## Próxima execução e aceite operacional

Depois de eventual merge autorizado pelo dono, a execução agendada deve recapturar a EPE mesmo com tentativa recente, reconstruir Água apesar da previsão órfã, restaurar os históricos disponíveis ou declarar sua ausência, e criar o primeiro backup de bronze na release. Uma perda posterior do cache deve recuperar também esse bronze.

Somente a execução agendada confirma o acesso real às fontes naquele instante, o tamanho e upload efetivos dos assets, a aprovação da gold do dia por toda a suíte e o commit de `agua_detalhe.json` e `expansao.json`. Falhas atuais de conteúdo podem continuar retendo o commit inteiro: este PR não as mascara nem altera o pipeline do Crédito.

A issue #116 permanece aberta até esse commit agendado ser conferido. Não usar `Closes #116` no PR.
