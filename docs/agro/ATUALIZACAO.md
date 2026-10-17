# Atualização e recuperação

## Reproduzir a edição aceita, sem rede

```sh
python3 -m pipeline.agro.run --check
python3 -m pipeline.agro.dicionario --check
node scripts/agro/catalogo.mjs --check
python3 -m unittest pipeline.tests.test_agro
```

Para regenerar, retire `--check` dos três primeiros comandos, nessa ordem. O catálogo usa Vite já instalado, sem nova dependência. `manifesto.json` fixa hashes de snapshot, dicionário e CSVs gerados em Python; o catálogo separado confere pelo gerador Node. A geometria é a malha oficial de UFs já preservada no módulo de Energia, fixada também no manifesto de fontes. Nunca desenhar substituto aproximado.

As sete fontes congeladas estão em `pipeline/agro/seed`, gzip determinístico `mtime=0`, com hash do original, hash comprimido e último commit que alterou o original. Data de preservação não é coleta nova. A reprodução não atualiza automaticamente os calendários, licenças ou contratos; essa conferência faz parte da revisão de edição.

## Coleta oficial da economia (automática)

```sh
python3 -m pipeline.agro.economia --coleta
python3 -m pipeline.agro.run
python3 -m pipeline.agro.dicionario
python3 -m unittest pipeline.tests.test_agro
```

A coleta consulta o IBGE (SIDRA 1846, 5932 e 6588, pela API v3) e o Comex Stat (exportações por capítulo e país, soja em grão, fertilizantes e defensivos importados), normaliza e valida tudo antes de gravar. Cada fonte vira uma semente em `pipeline/agro/seed` (`cnt.json.gz`, `lspa.json.gz`, `comex.json.gz`) com a consulta, a resposta integral, o sha256 e a data de captura em `coletas.json`. Resposta idêntica à integrada mantém o manifesto e não gera commit. O Comex Stat limita a frequência: a coleta espera 11 segundos entre consultas e leva cerca de dois minutos.

Validações que bloqueiam a publicação: setores que não somam o valor adicionado, trimestres não consecutivos, taxas e valores terminando em trimestres diferentes, produto do LSPA sem estimativa do último mês, ano ou mês ausente no Comex Stat, acumulado do ano diferente da soma dos meses, país ou linha duplicada.

O workflow `atualizar-agro.yml` roda nos dias 9 e 24 de cada mês, publica no `main` só com os testes verdes e retém a publicação reprovada. Pode ser disparado manualmente, inclusive sem coleta para só reconstruir a gold.

## Preparar atualização das fontes preservadas

Depois que uma nova fonte de origem for conferida e versionada pelo seu módulo responsável:

```sh
python3 -m pipeline.agro.preservar --destino /tmp/agro-candidato --data AAAA-MM-DD
```

O helper rejeita destino existente e original diferente do commit declarado, valida as sete fontes, reconcilia os agregados e calcula as cinco saídas antes de disponibilizar o candidato. Não modifica seed nem gold aceitos. Revise diferenças, períodos, unidades, licenças, cobertura e compatibilidade; só então substitua o seed em branch de atualização e regenere os derivados. Fonte incompleta ou falha de validação preserva a última edição aceita. A gravação do gerador é atômica **por arquivo**, não uma transação de vários arquivos; a publicação conjunta ocorre pelo commit/deploy.

## Capturar produção oficial: trabalho ainda parcial

`python3 -m pipeline.agro.capturar --help` descreve o capturador de candidatos PAM 5457/PPM 3939/74. Ele consulta metadados e períodos antes dos valores, limita tentativas e volume, preserva resposta e manifesto e distingue toneladas, hectares, cabeças, litros e mil litros. Testes sintéticos ficam somente nos testes.

**Este capturador ainda não está integrado ao gerador publicado.** Em 17/10/2026 a API do IBGE passou a responder neste ambiente (a coleta da economia usa o mesmo domínio), mas a captura de PAM/PPM por estado ainda não foi rodada, conciliada e aprovada.

Após liberação efetiva: capturar metadados e originais, validar chaves únicas, unidades, municípios/UF/BR, safras, calendários, ausência/zero e revisão; reconciliar amostra com publicação oficial; implementar integração do candidato no normalizador e testes com original real fixado. Só depois ativar mapas/séries agrícolas e retirar os respectivos bloqueios do catálogo. Carne exige validar Abate separadamente de rebanho PPM; não supor integração existente. Custos Conab, proteção, agricultura familiar, ambiente e FAOSTAT continuam com tarefas próprias, não são resolvidos pelo capturador PAM/PPM. O Comex Stat já é coletado pelo módulo da economia.

Não agendar a coleta de PAM/PPM nem anunciar atualização automática da produção por estado antes dessa integração. Dados pagos, scraping não autorizado e licenças não confirmadas não são alternativas presumidas.

## Recuperação

Falha de coleta: não promover candidato, conservar seed e gold da edição aceita. Falha em derivadas: restaurar o commit aceito dos seeds, regenerar todos os derivados e comparar o manifesto; não editar JSON/CSV manualmente. Regressão de interface: reverter o commit via PR e gates normais, confirmar deploy do novo SHA. Evitar restauração parcial de fonte sem seu manifesto, dicionário, catálogo ou cobertura.

Gates: lint, tipos, Python, build, Vitest com HTML obrigatório, inventário i18n e `scripts/agro/verificacao.mjs`. CI do Agronegócio mantém screenshots, CSVs e PDF no artefato `agronegocio-interface`; não contém dados de contas reais. Não enviar valores digitados para analytics.

A captura candidata exige exatamente cada indicador solicitado × ano solicitado × Brasil/27 UFs, por produto. A falta de uma variável, de uma célula territorial ou a inclusão de ano extra interrompe o processo antes de gravar qualquer arquivo. Células presentes com sinal oficial de ausência/supressão continuam distintas de células omitidas. IDs duplicados de variável nos metadados são rejeitados. Testes isolados conferem também a preservação de um candidato anterior em caso de resposta incompleta; isso não libera nem integra a fonte online.
