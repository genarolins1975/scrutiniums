# Metadados duráveis e histórico de capturas do Setor Elétrico

## Evidência

Conferência em 18/10/2026, sobre o `main` `003c1e80d`:

- `data/energia/meta` contém notas literais das fontes (`_meta_*.json`), listagens CKAN (`_ckan_*.json`) e a conferência do bronze. Os consumidores incluem `gold/comum.py`, `catalogo.py`, `run.py` e `modulos/dados.py`.
- A [release energia-estado](https://github.com/genarolins1975/scrutiniums/releases/tag/energia-estado), consultada pela API em 18/10/2026, não tinha asset `energia-meta-*`. O silver principal foi atualizado às 01:55:52 UTC; o arquivo de famílias, às 01:56:12 UTC. Fonte: `GET /repos/genarolins1975/scrutiniums/releases/tags/energia-estado`, campos `assets[].updated_at`.
- `snapshot_de` guarda todas as vintages; `run.py` repetia as listas completas em `fontes.*.capturas` e `fontes.*.historico`. O custo crescia com as coletas.

Medição local em 18/10/2026, com o silver local derivado daquela release e sem novas coletas durante a comparação: **2.202.127 → 565.096 bytes** no mesmo objeto de `meta.json` (**−74,34%**). Foram trocadas apenas as listas das fontes por resumo/amostra e acrescentado o endereço do CSV. Todos os outros campos do objeto e os demais atributos de cada fonte foram comparados e permaneceram iguais. Fonte: saída da reconstrução isolada e `len(json.dumps(..., ensure_ascii=False, indent=1).encode())`, a mesma serialização de `base.escreve_gold`.

O CSV dessa comparação tem **718.820 bytes**, **4.468 linhas históricas**, das quais **3.579 vigentes**, em **154 fontes**. Fonte: `capturas_fontes.csv` e soma dos resumos da mesma reconstrução, 18/10/2026. Essas contagens descrevem registros de captura; não são indicadores do setor.

A cópia local de conferência não contém os arquivos de bronze e de `meta` do cache do Actions. A reconstrução integral manteve, pela sentinela, as publicações anteriores de `empresas`, `leiloes`, `listadas`, `publicacao` e `territorio`. Isso limita a conferência local das fontes e não demonstra indisponibilidade dos portais. Nenhum desses módulos foi alterado nesta tarefa. A execução isolada de `executar_modulo.py rede --sem-coleta` também terminou disponível; comparada com a reconstrução anterior no mesmo estado, não apresentou diferenças numéricas, apenas carimbos de publicação. Golds e séries locais não entram no PR.

Para reproduzir a comparação de formato na mesma gold reconstruída: ler o novo `meta.json` e o CSV, agrupar as linhas por `dataset`, reconstituir `historico` integral e `capturas` com as linhas vigentes (ordenadas por recurso), remover apenas `resumo_capturas` e `historico_csv`, e serializar os dois objetos como `base.escreve_gold`. Assim os carimbos e os demais campos permanecem iguais. A comparação não depende de executar a coleta duas vezes.

A reconstrução também gravou resultados internos de previsões em `data/energia/previsoes/validacao_interna`, fora do diretório de gold isolado. Esses artefatos novos foram transferidos para o diretório da conferência; os testes do repositório usam a publicação anterior. Não se alteraram os testes nem a lógica das previsões para acomodar resultados de estados diferentes.

## Inferência

Sem a pasta auxiliar, um silver íntegro não basta para reproduzir notas e catálogos. A falta de cópia durável permite que a expulsão do cache volte a reter a publicação nos testes de conteúdo. Esta tarefa não atribui uma perda específica do cache a um evento sem o log correspondente.

## Recomendação implementada

### Estado auxiliar

O workflow restaura a geração completa mais recente (`state=uploaded`) de `energia-meta-<UTC>-<run_id>-<attempt>.tar.gz`. Upload interrompido (`starter`) não encobre a última geração completa. `estado_meta.py` valida entradas regulares e caminhos antes de extrair; acrescenta somente arquivos ausentes. Cada arquivo é publicado atomicamente e sem sobrescrever bytes do cache.

A gravação tem passo próprio, depois do silver. O asset recebe nome novo, sem `--clobber`; só após o upload confirmado são removidas as gerações antigas de meta. Falha em meta produz warning e issue e preserva o silver já salvo. O arquivo temporário fica fora de `data/energia`; os caminhos do cache permanecem iguais. O limite preventivo é **1.900.000.000 bytes por asset**, declarado em `estado_meta.py`, abaixo do [limite de 2 GiB do GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), consultado em 18/10/2026. Pasta ausente ou vazia não substitui a geração anterior.

### Histórico publicado

`metadados.LIMITE_RECENTES = 10` limita **cada lista de cada fonte**. Dez registros oferecem contexto recente; a investigação completa continua na tabela da ficha e no CSV. O tamanho das listas JSON passa a depender da quantidade de fontes, sem crescer com os dias de coleta. Os testes sintéticos exigem menos de **15.000 bytes por fonte** para o `meta.json` do cenário e conferem a integridade do CSV. Esses limites são contratos de engenharia deste código, não medidas da fonte.

Cada fonte publica:

- `resumo_capturas.total_capturas`: recursos com captura vigente;
- `resumo_capturas.total_historico`: todas as vintages integradas, inclusive substituídas;
- `primeira` e `ultima`: extremos das datas de captura do histórico, nulos sem registros;
- `recapturas_sem_mudanca`: contagem já calculada do log de coletas, preservada sem mudar a regra;
- `limite_recentes` e `historico_csv`: explicam o recorte e apontam o histórico completo.

`/energia/series/capturas_fontes.csv` preserva todas as linhas e as colunas anteriores do histórico (`recurso`, `sha256`, `capturado_em`, `publicado_em`, `origem`, `vigente`), acrescentando `dataset` para identificar a fonte. As capturas vigentes são exatamente as linhas `vigente=true`: não se duplica a mesma captura em duas listas no CSV. A ausência de publicação continua campo vazio. O arquivo consta de `arquivos.json` e do dicionário usado pelo manifesto final.

O CSV é congelado após as coletas temáticas e a coleta de catálogos do próprio Dados, antes de `valida_csvs` e da exportação/conferência do Parquet. O registro de Dados passou à ordem 98, depois de Minha região (97) e antes de Visão geral (também 98, ordenação pelo id). Isso mantém a dependência da Visão geral em `publicacao.json`. O orquestrador recusa fonte com dataset declarado depois dessa validação. `meta.json` reutiliza o resumo já validado e não reescreve o CSV no fim. Um teste percorre os registros reais para proteger essa ordem; outro executa o orquestrador com captura temática e de catálogo sintéticas e as funções reais de validação e Parquet, tanto sem arquivo anterior como com CSV/Parquet antigos.

A redução ocorre só na representação pública de `meta.json`: `snapshot_de`, proveniências, cálculos e silver continuam completos. A ficha lê o CSV no servidor, uma vez por versão, e mantém a tabela integral. Publicação anterior sem resumo continua legível até o primeiro ciclo novo. Na forma nova, CSV ausente, estrutura inválida ou contagem divergente falham explicitamente; uma amostra nunca aparece como histórico completo.

A reauditoria confere todas as linhas, calcula a captura mais recente por recurso independentemente da flag exportada, exige igualdade integral entre as capturas vigentes e o histórico vigente (inclusive multiplicidade) e fecha os totais com o resumo. O parser lê uma vez e usa índices, evitando buscas quadráticas e sem ampliar o timeout do teste.

## Próxima execução agendada

Após merge autorizado pelo dono, a execução deve criar o novo asset na release, publicar `meta.json` com resumo/amostra e o CSV completo, e não abrir issue de falha na cópia dos metadados. Só essa execução confirma upload com as credenciais do Actions e a integridade do estado real do cache. A restauração real após expulsão do cache se confirma num ciclo que precisar da cópia; os cenários de cache ausente e parcial já são cobertos executando o shell real com `gh` falso. Esta mudança não recupera retroativamente notas que já tenham desaparecido de todas as cópias.
