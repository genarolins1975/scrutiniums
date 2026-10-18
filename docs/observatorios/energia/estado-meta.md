# Metadados duráveis e histórico de capturas do Setor Elétrico

## Evidência

Conferência em 18/10/2026, sobre o `main` `003c1e80d`:

- `data/energia/meta` contém notas literais das fontes (`_meta_*.json`), listagens CKAN (`_ckan_*.json`) e a conferência do bronze. Os consumidores incluem `gold/comum.py`, `catalogo.py`, `run.py` e `modulos/dados.py`.
- A [release energia-estado](https://github.com/genarolins1975/scrutiniums/releases/tag/energia-estado), consultada pela API em 18/10/2026, não tinha asset `energia-meta-*`. O silver principal foi atualizado às 01:55:52 UTC; o arquivo de famílias, às 01:56:12 UTC. Fonte: `GET /repos/genarolins1975/scrutiniums/releases/tags/energia-estado`, campos `assets[].updated_at`.
- `snapshot_de` guarda todas as vintages; `run.py` repetia as listas completas em `fontes.*.capturas` e `fontes.*.historico`. O custo crescia com as coletas.

Medição local em **18/10/2026**, com o silver local derivado daquela release e sem novas coletas: **2.556.257 → 713.388 bytes (−72,09%)**. A comparação usa a **mesma gold corrigida para incluir todas as famílias**: o controle tem as listas integrais; a versão final tem resumo/amostra. Os demais campos são idênticos. Fonte: snapshots do silver, CSV integral e serialização `json.dumps(..., ensure_ascii=False, indent=1, allow_nan=False)`, como `base.escreve_gold`. Não se compara um universo com famílias omitidas a outro completo.

O CSV dessa comparação tem **778.274 bytes**, **4.490 registros históricos**, dos quais **3.593 vigentes por família/recurso**, em **154 datasets e 161 pares família/dataset**. Fonte: CSV conferido por multiconjunto contra todas as vintages das famílias declaradas, 18/10/2026. São contagens de registros de armazenamento, não eventos únicos nem indicadores do setor.

O registro atual reutiliza nomes de dataset em famílias distintas, por exemplo `aneel_siga` (`aneel_geracao`/`empresas`), `aneel_indqual_municipio` (`aneel_distribuicao`/`aneel_qualidade`) e `aneel_cde_custeio` (`aneel_tarifas`/`aneel_social`). A coleta interna usa chave **família/dataset**, evitando sobrescrita. A saída continua indexada por dataset para a ficha, mas reúne todos os registros com a família em cada linha e mantém as identificações originais em `snapshots_familias`. Não se inventa um snapshot único para famílias distintas. Downloads idênticos continuam contados por família, sem estimar eventos únicos a partir de logs que podem ter sido copiados.

A cópia local de conferência não contém os arquivos de bronze e de `meta` do cache do Actions. A reconstrução integral manteve, pela sentinela, as publicações anteriores de `empresas`, `leiloes`, `listadas`, `publicacao` e `territorio`. Isso limita a conferência local das fontes e não demonstra indisponibilidade dos portais. Nenhum desses módulos foi alterado nesta tarefa. A execução isolada de `executar_modulo.py rede --sem-coleta` também terminou disponível; comparada com a reconstrução anterior no mesmo estado, não apresentou diferenças numéricas, apenas carimbos de publicação. Golds e séries locais não entram no PR.

Para reproduzir a comparação de formato na mesma gold reconstruída: ler o novo `meta.json` e o CSV, agrupar as linhas por `dataset`, reconstituir `historico` integral e `capturas` com as linhas vigentes (ordenadas por recurso), remover apenas `resumo_capturas` e `historico_csv` (preservando a família em cada registro), e serializar os dois objetos como `base.escreve_gold`. Assim os carimbos e os demais campos permanecem iguais. A comparação não depende de executar a coleta duas vezes.

A reconstrução também gravou resultados internos de previsões em `data/energia/previsoes/validacao_interna`, fora do diretório de gold isolado. Esses artefatos novos foram transferidos para o diretório da conferência; os testes do repositório usam a publicação anterior. Não se alteraram os testes nem a lógica das previsões para acomodar resultados de estados diferentes.

## Inferência

Sem a pasta auxiliar, um silver íntegro não basta para reproduzir notas e catálogos. A falta de cópia durável permite que a expulsão do cache volte a reter a publicação nos testes de conteúdo. Esta tarefa não atribui uma perda específica do cache a um evento sem o log correspondente.

## Recomendação implementada

### Estado auxiliar

O workflow restaura a geração completa mais recente (`state=uploaded`) de `energia-meta-<UTC>-<run_id>-<attempt>.tar.gz`. Upload interrompido (`starter`) não encobre a última geração completa. `estado_meta.py` valida entradas regulares e caminhos antes de extrair; acrescenta somente arquivos ausentes. Cada arquivo é publicado atomicamente e sem sobrescrever bytes do cache.

A previsão também restaura meta da cópia durável antes da coleta, completando só ausentes, para construir suas golds com as notas da fonte mesmo quando o cache não contém a pasta. Os workflows mantêm filas separadas: uma atualização longa não atrasa nem substitui uma previsão pendente. A previsão retira temporariamente `meta` do payload de seu cache e a repõe no diretório de trabalho depois da gravação, inclusive em caso de falha. Assim não promove metadados de uma restauração antiga sobre a coleta de energia; na próxima restauração, só os ausentes vêm da cópia durável da energia. Os paths/versão do cache e os demais arquivos continuam iguais. A coleta noturna é a responsável pela geração canônica dos metadados da energia; notas de ONS regravadas somente pela previsão não a substituem.

Na primeira execução, se ainda não houver asset de meta e a previsão tiver a única cópia, ela cria `energia-meta-0-bootstrap-<run_id>-<attempt>.tar.gz` antes de retirar a pasta do cache, sem `--clobber`. O prefixo reservado ordena essa cópia abaixo das gerações UTC da energia, mesmo se o upload de uma previsão antiga terminar depois. A próxima cópia bem-sucedida da energia a remove junto com as gerações anteriores. Se a proteção falhar, não se poda nem substitui o cache; um warning informa o motivo e o commit das emissões continua independente. Testes executam os blocos reais, inclusive o caso de a energia publicar metadados novos enquanto a previsão ainda trabalha com uma restauração antiga.

A gravação tem passo próprio, depois do silver e antes de expor o cache novo. Poda e gravação do cache exigem sucesso das cópias do silver e de meta: se qualquer upload falhar, o cache anterior fica preservado e o silver já teve seu passo independente. Assim a previsão nunca recebe um cache novo da energia com metadados ainda sem cópia durável. O asset recebe nome novo, sem `--clobber`; só após o upload confirmado são removidas as gerações antigas de meta. Falha em meta produz warning e issue e preserva o silver já salvo. O arquivo temporário fica fora de `data/energia`; os caminhos do cache permanecem iguais. O limite preventivo é **1.900.000.000 bytes por asset**, declarado em `estado_meta.py`, abaixo do [limite de 2 GiB do GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), consultado em 18/10/2026. Pasta ausente ou vazia não substitui a geração anterior.

### Histórico publicado

`metadados.LIMITE_RECENTES = 10` limita **cada lista de cada fonte**. Dez registros oferecem contexto recente; a investigação completa continua na tabela da ficha e no CSV. O tamanho das listas JSON passa a depender da quantidade de fontes, sem crescer com os dias de coleta. Os testes sintéticos exigem menos de **15.000 bytes por fonte** para o `meta.json` do cenário e conferem a integridade do CSV. Esses limites são contratos de engenharia deste código, não medidas da fonte.

Cada fonte publica:

- `resumo_capturas.total_capturas`: pares família/recurso com registro vigente;
- `resumo_capturas.total_historico`: todos os registros de vintage, inclusive substituídos e cópias em famílias diferentes;
- `primeira` e `ultima`: extremos das datas de captura do histórico, nulos sem registros;
- `recapturas_sem_mudanca`: regra original do log, preservada por família; em dataset compartilhado, o total único não é estimado e as contagens ficam em `snapshots_familias`;
- `limite_recentes` e `historico_csv`: explicam o recorte e apontam o histórico completo.

`/energia/series/capturas_fontes.csv` preserva todas as linhas e as colunas anteriores do histórico (`recurso`, `sha256`, `capturado_em`, `publicado_em`, `origem`, `vigente`), acrescentando `dataset` e `familia` para identificar cada armazenamento da fonte. As capturas vigentes de cada família são exatamente as linhas `vigente=true`: não se duplica a mesma captura em duas listas no CSV. A ausência de publicação continua campo vazio. O arquivo consta de `arquivos.json` e do dicionário usado pelo manifesto final.

O CSV é congelado após as coletas temáticas e a coleta de catálogos do próprio Dados, antes de `valida_csvs` e da exportação/conferência do Parquet. O registro de Dados passou à ordem 98, depois de Minha região (97) e antes de Visão geral (também 98, ordenação pelo id). Isso mantém a dependência da Visão geral em `publicacao.json`. O orquestrador recusa fonte com dataset declarado depois dessa validação. `meta.json` reutiliza o mesmo resumo e não reescreve o CSV no fim. A escrita do histórico tem gate próprio: relê estritamente o CSV e compara cabeçalho, cada célula e a multiplicidade com as vintages, inclusive cabeçalho sem linhas quando não há captura. Também sincroniza e confere seu próprio Parquet quando atinge o limiar existente (e remove a versão gerada abaixo dele), para não deixar arquivo antigo mesmo se Dados retornar indisponível antes da exportação geral por falta de catálogo. Esse caminho também é testado com uma publicacao.json anterior: seus bytes e sua data permanecem iguais pela sentinela, enquanto os artefatos do histórico passam pelo gate independente. Um teste injeta perda de linha no CSV e exige reprovação antes da publicação. Um teste percorre os registros reais para proteger essa ordem; outro executa o orquestrador com captura temática e de catálogo sintéticas e as funções reais de validação e Parquet, tanto sem arquivo anterior como com CSV/Parquet antigos.

A redução ocorre só na representação pública de `meta.json`: `snapshot_de`, proveniências, cálculos e silver continuam completos. A ficha lê o CSV no servidor, uma vez por versão, e mantém a tabela integral. Nos datasets compartilhados, mostra a última tentativa de cada família com data, sucesso/falha e detalhe original; falta de registro não vira sucesso nem falha. Origens de reuso, agregação e cópia mantêm sua identificação, em vez de serem chamadas de coleta direta. Publicação anterior sem resumo continua legível até o primeiro ciclo novo. Na forma nova, CSV ausente, estrutura inválida ou contagem divergente falham explicitamente; uma amostra nunca aparece como histórico completo.

A reauditoria confere todas as linhas, calcula a captura mais recente por (família, recurso) independentemente da flag exportada, exige igualdade integral entre as capturas vigentes e o histórico vigente (inclusive multiplicidade) e fecha os totais com o resumo. O parser lê uma vez e usa índices, evitando buscas quadráticas e sem ampliar o timeout do teste.

## Próxima execução agendada

Após merge autorizado pelo dono, a execução deve criar o novo asset na release, publicar `meta.json` com resumo/amostra e o CSV completo, e não abrir issue de falha na cópia dos metadados. Só essa execução confirma upload com as credenciais do Actions e a integridade do estado real do cache. A restauração real após expulsão do cache se confirma num ciclo que precisar da cópia; os cenários de cache ausente e parcial já são cobertos executando o shell real com `gh` falso. Esta mudança não recupera retroativamente notas que já tenham desaparecido de todas as cópias.
