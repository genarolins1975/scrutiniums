# Prompt: acelerar o ciclo de implementação da Scrutiniums

Data: 22/10/2026. Autor do diagnóstico: sessão Claude Code no repositório `genarolins1975/scrutiniums`, commit `590b6a5c7` do main. Destinatário: o modelo que vai executar (Codex, GPT, Claude ou outro). Cole o texto abaixo da linha inteiro, sem cortar as seções de guardrails e de critérios de aceite.

---

## 1. Papel e regra de ouro

Você vai reduzir o tempo que uma implementação leva neste repositório, do primeiro comando da sessão até o CI verde, sem retirar nenhuma verificação. O trabalho é de infraestrutura de desenvolvimento: nada do que o leitor do site vê pode mudar (HTML gerado, CSS, textos, dados, rotas, acesso). Se um pacote exigir mudança visível, pare e pergunte ao dono.

Antes de começar, leia inteiros `CLAUDE.md`, `AGENTS.md` e `.claude/skills/observatorio-layout/SKILL.md` (seções 9, 12 e 13 regem PR, entrega e produção). Leia também `.github/workflows/ci.yml`, `vitest.config.ts`, `package.json`, `scripts/vitest-worktree-setup.mjs`, `docs/i18n/COBERTURA.md` e `scripts/cobertura-i18n.mjs`.

Guardrails, sem exceção:

1. Nunca apagar, pular, marcar como `skip`, `todo` ou `only`, nem afrouxar teste, asserção, `--check` ou passo do CI. Nunca `continue-on-error`. Nunca remover a verificação obrigatória do HTML gerado (`EXIGIR_BUILD_HTML=1`), o passo "Árvore versionada permanece limpa" nem o `--check` do inventário de tradução.
2. A suíte completa, com todos os passos de hoje, continua rodando em todo push no `main`, no `workflow_run` do pipeline de dados e no cron diário. Filtro de caminho e paralelização valem para `pull_request`; o `main` segue integral.
3. Arquivo gerado se regenera com a ferramenta do repositório, nunca à mão (`docs/i18n/cobertura.json` com `node scripts/cobertura-i18n.mjs`; golds de energia com `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta`; `public/obs/index.html` com `node scripts/barra-spa.mjs`).
4. Nenhuma dependência nova sem medida que a justifique no PR. Preferir recursos nativos do Vitest 4, do Next 14.2 e do GitHub Actions.
5. Um PR por pacote, pequeno e revisável. Merge só com autorização explícita do dono na conversa. Nunca rebase, amend ou force push em branch que não é sua.
6. Comentários de código, mensagens de commit e descrições de PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência (veja os comentários de `ci.yml`).
7. Todo PR traz medição antes e depois, com o comando usado, a máquina (CI ou local, número de vCPU) e a data. Sem número, o pacote não está pronto.

## 2. Diagnóstico já feito (não repita; confira só o que mudou)

Evidência colhida em 22/10/2026, com a fonte de cada número.

### 2.1 CI de pull request: 20 min 39 s em um único job serial

Fonte: run 1196 do workflow CI, job "testes", 19:02:13 a 19:22:52 UTC, PR da branch `claude/fluxo-dinheiro-publico` (`https://github.com/genarolins1975/scrutiniums/actions/runs/39836407594`).

| Passo | Duração | Observação |
|---|---|---|
| checkout | 30 s | repositório de 393 MB em `.git`, 549 MB em `public/` |
| `npm ci` | 26 s | cache do npm já ativo |
| Chromium (Playwright) | 19 s | sem cache do navegador |
| Lint | 35 s | |
| Tipos (`tsc --noEmit`) | 67 s | |
| Testes Python (pipeline, pesquisa, eficiência) | 3 min 38 s | roda em todo PR, mesmo de interface pura |
| Três verificações do OBEE | 7 s | |
| Build de produção | 4 min 16 s | 365 rotas de página e 80 de API; sem cache de `.next/cache` entre runs |
| Fluxos e telas do Judiciário | 3 min 43 s | roda em todo PR, mesmo sem tocar no Judiciário |
| Cobertura bilíngue `--check` | 4 s | |
| Vitest completo | 5 min 30 s | 361 arquivos, sem shard |

Tudo é sequencial num job só. Lint, tipos, Python e OBEE não dependem do build; Vitest e Judiciário dependem do build e são independentes entre si.

Em paralelo a esse job, o workflow "Interface do Agronegócio" (`agro-interface.yml`) dispara em qualquer mudança em `src/**` e leva 11 min 17 s, com um segundo build completo (4 min 42 s) e 4 min 52 s de verificação (run `39795855613`, 22/10/2026). Não está no caminho crítico, mas dobra os minutos consumidos e falha de forma independente.

Dos 12 últimos runs de CI concluídos em PRs (22/10/2026), 4 foram cancelados por novo push durante a execução (33 %). O padrão é empurrar, esperar, empurrar um commit de correção ou de regeneração, e recomeçar.

### 2.2 Arquivo gerado versionado que conflita em quase todo merge

Fonte: `git log` dos últimos 300 commits do main em 22/10/2026.

- 34 commits são só "Inventário de tradução regenerado" (`docs/i18n/cobertura.json`, 1.930 linhas, 63 KB).
- 39 commits são merges do `main` para dentro de branches de trabalho.
- Os quatro PRs abertos hoje (#340, #341, #343, #344) são empilhados e cada merge entre eles registrou conflito em `docs/i18n/cobertura.json` (texto das mensagens de merge).
- O commit diário do pipeline de dados (`5de4e785c`) altera 3.875 arquivos em `public/`; toda branch aberta antes dele diverge nesse volume.

Quem lê o relatório versionado: sete testes em `src/tests/i18n-*cobertura*.test.ts` e o passo `--check` do CI. O gerador leva 4 s e, segundo `docs/i18n/COBERTURA.md`, só depende de fontes de código.

### 2.3 Suíte de testes: pesada por construção

Fonte: contagens no repositório em 22/10/2026.

| Medida | Valor |
|---|---|
| Arquivos de teste em `src/tests` | 361 (80.705 linhas) |
| Só o Setor Elétrico | 84 arquivos, 40.466 linhas |
| Maior arquivo | `energia-conta.test.ts`: 2.614 linhas, 610 asserções literais em 132 casos |
| Arquivos que renderizam páginas React no teste (`renderToStaticMarkup`) | 124 |
| Arquivos que leem `public/` | 165 (22 varrem pastas recursivamente) |
| Arquivos que leem o build em `.next` | 25 |
| Arquivos com PGlite (banco em memória) | 15, mas `pool: "forks"` vale para todos os 361 |
| Arquivos que abrem o Chromium | 10 |
| Arquivos com timeout ampliado à mão | 14 |

Cada arquivo nasce num processo novo (`pool: "forks"`), reimporta React e Next e relê os JSONs de que precisa. Não há cache de JSON entre testes nem seleção de testes afetados antes do push.

### 2.4 Sessão nova de agente: sem preparação automática

- Não existe `.claude/settings.json` nem hook de início de sessão. Cada sessão em nuvem clona 393 MB de `.git` mais 549 MB de `public/`, instala dependências e precisa lembrar de materializar os derivados (`pretest`) e minificar a SPA. O histórico registra falhas por ENOENT exatamente por esquecer isso (comentários em `scripts/vitest-worktree-setup.mjs` e em `ci.yml`).
- Localmente, nesta máquina de 4 vCPU em 22/10/2026: `npm ci` 29 s (com cache de proxy); `tsc --noEmit` e `npm run lint` medidos na seção 2.6.

### 2.5 Custo de contexto das instruções

As quatro skills obrigatórias somam 122 KB só nos `SKILL.md` (`observatorio-layout` 45 KB em 316 linhas, `design-taste-frontend` 38 KB, `emil-design-eng` 27 KB, `impeccable` 12 KB), mais 730 KB de referências disponíveis. A skill da casa mistura regras permanentes com um diário de decisões datadas, listas de rotas e nomes de componentes. Isso é decisão do dono (20/10/2026) e não se altera sem ele; o pacote P7 só prepara a proposta.

### 2.6 Medições locais (4 vCPU, 15 GB, 22/10/2026)

Máquina: contêiner de sessão em nuvem, 4 vCPU, 15 GB de memória, clone limpo do main em `590b6a5c7`, sem `.next`.

| Comando | Tempo de parede | Observação |
|---|---|---|
| `npm ci` | 29 s | com cache de proxy; primeiro `npm ci` da sessão |
| `npx tsc --noEmit` | 2 min 24 s | 1.898 arquivos TS/TSX, 363 mil linhas; no CI, 67 s |
| `npm run lint` | 1 min 08 s | no CI, 35 s |
| `npx vitest run` sem build e sem `pretest` | 3 min 56 s de parede, 12 min 00 s de CPU | 361 arquivos, 7.941 testes coletados, 7.595 passaram, 345 pulados por falta do build (comportamento previsto), 1 falha em `energia-inicial` com erro opaco (verde no CI do main, logo ambiental), 3 arquivos sem Chromium, 3 com ENOENT em `app.min.js` |

Leitura: um agente que roda "lint + tipos" antes de cada push gasta 3 min 30 s só nisso, por push, em 4 vCPU. Sem seleção de testes afetados, a suíte inteira vem por cima.

Dois achados da suíte local que orientam P4 e P5:

- **62 % da CPU da suíte fica fora dos corpos de teste.** O relatório JSON do Vitest soma 272 s de execução dos 361 arquivos; a CPU total foi 720 s. A diferença (448 s) é subir um processo por arquivo, transformar e importar React, Next e os módulos da página, e coletar os testes. É o custo do `pool: "forks"` com isolamento para todos os arquivos, quando só 15 precisam dele.
- **Os erros de ambiente são exatamente os documentados no repositório.** Três arquivos falharam por `ENOENT` em `public/obs/app.min.js` (a suíte foi chamada com `npx vitest run`, sem o `pretest`) e três porque o Playwright 1.64.1 procura a revisão 1248 do Chromium headless, que não é a instalada em `PLAYWRIGHT_BROWSERS_PATH`. Um agente novo tropeça nos dois no primeiro teste.

Dez arquivos mais lentos pelo corpo de teste (sem contar a subida do processo):

| Arquivo | Tempo | Testes |
|---|---|---|
| `obee-mobilidade.test.ts` | 9,6 s | 14 |
| `saneamento-entrada.test.ts` | 9,2 s | 21 |
| `energia-inicial.test.ts` | 7,5 s | 44 |
| `git-worktree-guard.test.ts` | 7,4 s | 4 |
| `cadastro-perfil-uso.test.ts` | 6,6 s | 30 |
| `educacao.test.ts` | 6,1 s | 21 |
| `energia-territorio.test.ts` | 6,0 s | 65 |
| `saneamento-mundo.test.ts` | 5,4 s | 21 |
| `previdencia.test.ts` | 5,4 s | 26 |
| `trabalho-renda-dados.test.ts` | 5,1 s | 6 |

Nenhum arquivo domina: o ganho está na sobrecarga por arquivo e no paralelismo, não em um teste isolado.

## 3. Metas mensuráveis

| Meta | Hoje | Alvo |
|---|---|---|
| Caminho crítico do CI num PR típico de interface | 20 min 39 s | até 10 min, sem passo retirado |
| Minutos de runner por PR de interface (CI + Agro) | cerca de 32 min | até 20 min |
| Verificação local antes do push, para mudança em uma página | não existe como comando único | um comando, até 3 min |
| Conflito em arquivo gerado ao integrar o `main` | frequente | zero intervenção manual |
| Sessão nova pronta para testar | manual, sujeita a ENOENT | um comando idempotente, até 2 min após o clone |
| Evidência de página para o PR (capturas, cromo, acessibilidade, login) | scripts dispersos | um comando por lista de rotas |

## 4. Pacotes de trabalho, em ordem

Execute na ordem. P1 e P2 primeiro: maior ganho por esforço. Cada pacote é um PR com título "Ciclo: <nome do pacote>".

### P1. CI em paralelo, com cache e filtro de caminho

O que fazer em `.github/workflows/ci.yml`:

1. Um job inicial `mudancas` que classifica os arquivos alterados do PR (pode ser `git diff --name-only origin/${{ github.base_ref }}...HEAD` num script `scripts/ci/classificar-mudancas.mjs`, sem action de terceiros) e publica saídas booleanas: `interface` (`src/**`, `public/**` fora de golds, `scripts/*.mjs`), `python` (`pipeline/**`, `pesquisa/**`, `scripts/**/*.py`, `data/**`, `docs/obee/**`), `judiciario` (rotas e libs do Judiciário, `scripts/obee/judiciario-verificacao.mjs`, `public/eficiencia/judiciario/**`), `i18n` (`src/**`, `config/i18n*`, `docs/i18n/**`, `scripts/i18n/**`). Em `push`, `workflow_run` e `schedule`, todas as saídas são verdadeiras.
2. Jobs em paralelo, cada um com `npm ci` (cache do npm já existe) e com o passo de árvore limpa ao final:
   - `estatico`: `minify-obs`, lint, tipos, `cobertura-i18n --check`, `compileall`, `test_publicar_gold`. Sempre roda.
   - `python`: testes Python e as três verificações do OBEE. Roda se `python` ou fora de `pull_request`.
   - `testes`: matriz `shard: [1/2, 2/2]` (ajuste para 3 se a medição pedir). Cada shard faz o build com cache de `.next/cache` (`actions/cache@v4`, chave por `package-lock.json` e hash de `src/**`, `next.config.mjs`, `tailwind.config.ts`; chave de restauração parcial por lockfile) e roda `npx vitest run --shard=${{ matrix.shard }}` com `EXIGIR_BUILD_HTML=1`. O teste `html-gerado` cai num shard só, o que é correto. Sempre roda.
   - `judiciario`: build (mesmo cache) e `node scripts/obee/judiciario-verificacao.mjs`, com o artefato de evidência. Roda se `judiciario` ou fora de `pull_request`.
3. Cache do Chromium do Playwright (`~/.cache/ms-playwright`, chave pela versão do `playwright` no lockfile) nos jobs que o usam.
4. Avalie subir ou não `.next` como artefato entre o build e os shards. Meça as duas formas (rebuild com cache em cada shard contra upload e download do artefato) e fique com a mais rápida; registre a medida no PR.
5. Manter `concurrency` com `cancel-in-progress: true` e `timeout-minutes` proporcional a cada job.
6. Em `agro-interface.yml`, restringir `paths` de `src/**` ao que a verificação do Agronegócio realmente percorre (rotas, libs, componentes e testes do Agro; confirme lendo `scripts/agro/verificacao.mjs`). O `push` no `main` continua integral.

Critério de aceite:

- Tabela no PR mapeando cada um dos 22 passos de hoje para o job e passo novo. Nenhum passo some; os que ganham filtro dizem qual saída de `mudancas` os liga e que no `main` rodam sempre.
- Caminho crítico medido no próprio PR (que altera só `.github/**` e `scripts/ci/**`, logo deve exercitar o caminho "mínimo") e numa branch de teste que altera uma página de `src/app/<tema>/page.tsx`: até 10 min.
- Um push no `main` após o merge mostra todos os jobs executados.
- `git diff --exit-code` ao final de cada job que gera arquivos.

### P2. Um comando antes do push

Em `package.json` e documentado em `CLAUDE.md` (seção "Comandos do repositório") e `AGENTS.md`:

- `npm run preparar`: materializadores de assistência, segurança alimentar e trabalho e renda, mais `minify-obs`. Hoje isso está espalhado em `predev`, `prebuild` e `pretest`; manter os hooks, apontando para o mesmo script.
- `npm run verificar:rapido`: lint, `tsc --noEmit`, `node scripts/cobertura-i18n.mjs --check` e testes afetados: `npx vitest run --changed origin/main` (Vitest 4 segue o grafo de importação). Como muitos testes leem JSON de `public/` por caminho e não por `import`, complemente com `scripts/mapear-testes-gold.mjs` (já existe um inventário lexical teste → gold): se um arquivo de dado mudou, inclua os testes que o citam. Documente a limitação: o comando é um filtro; o CI é a verdade.
- `npm run verificar:pr`: exatamente o que o CI faz, na mesma ordem, build incluído, com `EXIGIR_BUILD_HTML=1`, para reproduzir uma falha de CI sem empurrar commit atrás de commit.
- `npm run testes:lentos`: `vitest run --reporter=json --outputFile=<arquivo>` e um script curto que imprime os 30 arquivos mais lentos. Serve ao P4 e às medições futuras.

Critério de aceite: `verificar:rapido` em até 3 min, medido em 4 vCPU, numa branch que altera uma página; os três comandos documentados; nenhum hook `pre*` perdido.

### P3. Fim do conflito em arquivo gerado

Alvo principal: `docs/i18n/cobertura.json`. Opções, em ordem de preferência:

- (a) O relatório deixa de ser versionado. Os sete testes passam a chamar o gerador em memória (exportar de `scripts/cobertura-i18n.mjs` ou de `scripts/i18n/*.mjs` uma função `gerarRelatorio()` que devolve o objeto, sem gravar). O CI continua com o `--check` da forma que fizer sentido (comparar a geração atual com a saída em memória é tautológico; nesse caso, o passo vira "gerador roda sem erro e testes conferem o relatório"). O relatório para leitura humana sai como artefato do CI e por `node scripts/cobertura-i18n.mjs --stdout`.
- (b) Se o dono quiser manter o relatório no git como evidência, declarar em `.gitattributes` um merge driver (`docs/i18n/cobertura.json merge=regenerar`) cujo comando é o próprio gerador, e configurar `merge.regenerar.driver` no `scripts/preparar-sessao.sh` do P5. O GitHub não executa merge driver; isso resolve o fluxo local dos agentes, que é onde o conflito aparece hoje.

Faça (a) salvo instrução contrária; descreva (b) no PR como alternativa. Levante no mesmo PR os demais gerados versionados que conflitam em PRs de interface (`public/obs/index.html` da SPA, versões em `styles.css?v=` e `observatorios.css?v=`) e proponha tratamento, sem executar ainda.

Critério de aceite: integrar o `main` numa branch que alterou textos de duas páginas não deixa conflito em arquivo gerado, ou o resolve sem ação manual; os sete testes continuam cobrindo o que cobriam (listar caso a caso); `docs/i18n/COBERTURA.md` atualizado.

### P4. Suíte Vitest mais rápida, com os mesmos testes

1. Medir primeiro com `npm run testes:lentos` (P2) e colar no PR a tabela dos 30 arquivos mais lentos, com o total de arquivos, testes e tempo de parede. Referência: 8.905 testes em 359 arquivos passaram no PR #338 em 22/10/2026.
2. Alavancas, para medir uma a uma e manter só o que paga (a seção 2.6 mostra que 62 % da CPU é subida de processo e importação, não corpo de teste):
   - `projects` do Vitest: um projeto `banco` (os 15 arquivos com PGlite, `pool: "forks"`, isolados) e um projeto `interface` (os demais, `pool: "threads"`); um projeto `navegador` (os 10 com Chromium), que só roda quando `.next` existe ou no CI.
   - `maxWorkers` e `fileParallelism` ajustados aos 4 vCPU do runner.
   - Cache de JSON por worker: um helper `src/tests/support/dados.ts` com `lerJson(caminho)` memoizado, aplicado aos 22 arquivos que varrem `public/` recursivamente e aos 30 mais lentos. Sem alterar o que é verificado.
   - Materialização no `globalSetup` só quando a semente mudou (hash já existe nos materializadores).
   - Shard no CI (P1).
3. Não mexer na lista de asserções. O que um teste verifica permanece igual; muda só como ele carrega e executa.

Critério de aceite: tempo de parede da suíte completa local reduzido em pelo menos 30 % com o mesmo número de arquivos e de testes, zero `skip` novo; cada shard do CI em até 4 min.

### P5. Sessão nova pronta com um comando

1. `scripts/preparar-sessao.sh`, idempotente: `npm ci --prefer-offline --no-audit --no-fund` só se `node_modules` faltar ou o lockfile tiver mudado (guardar o hash em `node_modules/.lockfile-hash`); `npm run preparar`; conferir se a revisão do Chromium que o Playwright do lockfile espera existe (`npx playwright install chromium` quando faltar, ou `CHROMIUM_PATH` apontando para um binário compatível), porque em 22/10/2026 a sessão tinha um Chromium de outra revisão e três arquivos de teste caíram por isso; configurar o merge driver se o P3 adotou (b); imprimir os três comandos do P2.
2. `.claude/settings.json` com hook `SessionStart` chamando o script (tipo `command`, `timeout` de 300 s). A pasta `.claude/` está no `.gitignore`, mas as skills já são versionadas à força; adicione o arquivo com `git add -f` e explique no PR.
3. Uma linha em `CLAUDE.md` e em `AGENTS.md` para agentes que não leem hooks: "rode `bash scripts/preparar-sessao.sh` antes de qualquer teste".

Critério de aceite: clone limpo, script, `npm run verificar:rapido` sem ENOENT, em até 2 min depois do clone (medir e registrar).

### P6. Pacote de evidências com um comando

`npm run evidencias -- --rotas /a /b --saida <pasta>`: sobe `next start` sobre o build existente com `COOKIE_SECRET` efêmero (como `scripts/obee/judiciario-verificacao.mjs` já faz), gera para cada rota, com e sem sessão: capturas a 390, 768 e 1440 px, medida de cromo (`scripts/ux-cromo.mjs`), auditoria axe (`scripts/auditoria-wcag.mjs`), erros de console e lista de requisições que caíram no login. Grava uma tabela Markdown pronta para colar no PR, no formato das pastas `docs/ux-2026-10-21/`. Reutilize os scripts existentes; não duplique lógica.

Critério de aceite: três rotas em até 5 min depois do build; saída conferida pelo dono numa rota aberta e numa com conta.

### P7. Propostas para decisão do dono (preparar, não executar)

Entregar como um documento `docs/CICLO_PROPOSTAS_2026-10.md`, curto, com custo e ganho medidos. Nada aqui entra sem aprovação explícita.

1. Skill da casa em núcleo e anexos: `observatorio-layout/SKILL.md` com as regras permanentes (direção, contrato editorial, componentes, gramática de gráficos, processo, rubrica, PR à produção) em até 15 KB; decisões datadas, listas de rotas e nomes de componentes em anexos por tema (`decisoes/acesso.md`, `decisoes/navegacao.md`, `decisoes/busca.md`), carregados quando o tema é tocado. Prepare a divisão em branch de rascunho com um script que prove que cada frase do original está no núcleo ou num anexo.
2. Política para testes de texto literal: asserção de texto só para decisão de texto do dono; testes novos preferem invariantes (natureza, período e prova de cada número, links válidos, estrutura). Vale para o que nasce; não reescreve o existente.
3. Dados pesados fora do histórico do git: `public/` com 549 MB e `docs/obee` com 116 MB tornam o clone e o checkout lentos em toda sessão e em todo job. Alternativas: golds publicadas como asset de release ou repositório de dados próprio, baixadas por script no build e no CI. Muda o deploy da Vercel; é decisão do dono. Medir o tempo de clone hoje e o projetado.

## 5. Como entregar

- Um PR por pacote, branch `claude/ciclo-p<N>-<nome>` (ou o prefixo do seu agente), base `main`, sem empilhar.
- Descrição do PR com: o que muda para quem implementa; tabela antes e depois (comando, máquina, data); mapa de verificações antigas para novas (nenhuma perdida); riscos; pendências reais; "Merge só com autorização explícita do dono".
- Verifique localmente com `npm run verificar:pr` antes de empurrar. Um push validado vale mais que três especulativos: é o padrão de cancelamento de 33 % que queremos encerrar.
- Ao final do P6, uma mensagem de uma tela para o dono, que lê pelo celular: metas da seção 3 com o valor alcançado em cada linha, links dos PRs e a próxima decisão dele (P7).

## 6. O que não fazer

- Não trocar framework de teste, bundler ou versão do Next para ganhar tempo.
- Não desligar `pool: "forks"` para os testes com PGlite; o comentário em `vitest.config.ts` explica o porquê.
- Não mover testes para "noturno" ou "opcional" em PR: tudo o que roda hoje em PR continua rodando em PR, exceto o que o filtro de caminho prova irrelevante para a mudança, e mesmo isso roda no `main`.
- Não resolver conflito de arquivo gerado editando o arquivo.
- Não abrir mais de um pacote por PR, nem incluir melhorias de interface "de carona".
