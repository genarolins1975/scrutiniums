# Scrutiniums

Plataforma **gratuita** de inteligência analítica sobre o crédito e a economia brasileira: o Observatório Brasileiro de Crédito — carteira, inadimplência, instituições, produtos, Pix, bets e fraudes financeiras — com metodologia aberta, dados oficiais e glossário público. **Os painéis exigem conta gratuita**: a página inicial, a apresentação do Crédito (`/observatorio-do-credito`), as páginas de método e glossário, as institucionais e o fluxo de entrada e cadastro são públicos; painéis, downloads, arquivos de dados, API, feeds RSS e gráficos incorporáveis exigem sessão. Desde 13/10/2026, a fronteira entre a vitrine pública e a área com conta é uma lista de rotas abertas em `src/lib/rotasPublicas.ts`, aplicada pelo `src/middleware.ts` e pelo sitemap; rota nova nasce fechada. Desde 19/10/2026 (estratégia "aberto e com conta", leva 1, aprovada pelo dono), cinco consultas pessoais também são abertas, em modo de consulta e pelo caminho exato: a Conta de luz (`/setor-eletrico/conta-de-luz` e a irmã `/en`), a ficha do município no Saneamento (`/saneamento/municipio` e `/saneamento/municipio/[código IBGE]`), o simulador da conta de água (`/saneamento/preco-regulado/simulador`), o retrato das capitais (`/eficiencia-estatal`) e o preço do botijão por estado (`/gas-natural/gas-de-cozinha`), além dos três arquivos que elas buscam no navegador (`/setor-eletrico/conta-de-luz/municipios.json`, `/saneamento/gold/indice.json` e `/energia/geo/uf.json`). Subpáginas, downloads, histórico por distribuidora e exportações continuam com conta e aparecem nessas páginas com o selo "com conta". O cadastro pede e-mail, telefone verificado por SMS, CPF e perfil básico, e a sessão só nasce depois do telefone verificado. Quem é barrado num painel volta a ele depois de entrar ou concluir o cadastro. Sem plano pago, sem cartão.

Desde setembro de 2026 a Scrutiniums é uma plataforma de observatórios sobre a mesma infraestrutura (sessão, telemetria, design system, sitemap): o **Observatório Brasileiro de Crédito**, o **Observatório Brasileiro do Setor Elétrico** (`/setor-eletrico`), o **Observatório Brasileiro de Eficiência Estatal** (`/eficiencia-estatal`), os de Contas Públicas Federais e Estaduais e o **Observatório Brasileiro de Gás Natural** (`/gas-natural`). O **Observatório do Agronegócio Brasileiro** (`/agronegocio`) acrescenta oito perguntas sobre o setor, oito capítulos e doze cadeias com produção por estado e exportação, com cobertura parcial explicitada. Quem entra com conta escolhe o observatório em `/app/observatorios` e troca pelo cabeçalho sem novo login.

## Stack

- **Next.js 14** (App Router, Server Components) + **TypeScript**
- **Tailwind CSS** com design tokens centralizados
- **Drizzle ORM (pg-core)** — **PGlite** (Postgres embarcado) em desenvolvimento, **node-postgres** em produção (ver [ARCHITECTURE.md](./ARCHITECTURE.md))
- Autenticação por **e-mail + senha** (hash **scrypt** do `node:crypto`, sem dependência externa); a senha é criada na **etapa 3 do cadastro**, após a validação do telefone por **código SMS** (Twilio Verify). O SMS permanece como **entrada alternativa e recuperação** (`/entrar/sms`): quem esqueceu a senha entra por SMS e define uma nova em Conta.
- **Recharts** para gráficos, **vitest** para testes

## Como rodar

```bash
npm install
npm run dev
```

Aplicação em `http://localhost:3000`. O banco de desenvolvimento é um PGlite (Postgres embarcado) criado e migrado automaticamente em `./.pglite` na primeira execução — não é preciso instalar Postgres.

**Modo de desenvolvimento simulado:** sem credenciais de Twilio configuradas, nenhum SMS é enviado — o código de verificação aparece **no console do servidor**, com destinatário mascarado:

```
[dev-verify] código para +55 •• •••••-4321: 654321
```

Use esse código para completar o cadastro e o login por SMS localmente. O login principal (e-mail + senha) não depende de Twilio.

## Configuração de produção

Defina as variáveis de ambiente (lista completa, com propósito e obrigatoriedade, em [ARCHITECTURE.md](./ARCHITECTURE.md#variáveis-de-ambiente)):

- **Twilio Verify (SMS):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_VERIFY_SERVICE_SID` — crie um serviço Verify no console da Twilio; com as três presentes, o modo simulado é desativado automaticamente. Usado na validação do telefone (cadastro) e no login alternativo/recuperação por SMS.
- **E-mail (Resend):** `RESEND_API_KEY` e `MAIL_FROM` — usados nos e-mails transacionais, inclusive nos convites da lista de espera (o login e a validação não dependem de e-mail). Em dev, sem a chave, o conteúdo aparece no log do servidor com o e-mail mascarado.
- **Administração:** `ADMIN_EMAILS` com os e-mails dos administradores separados por vírgula (case-insensitive, com trim). Vazio → ninguém é admin.
- **Segurança:** `COOKIE_SECRET` (ou `SESSION_SECRET`) com valor aleatório longo.
- **Acesso antecipado:** `ACCESS_CODES` com os códigos válidos separados por vírgula (case-insensitive, com trim). Vazio → ninguém entra; todos vão para a lista de espera.
- **Banco:** `DATABASE_URL` com a connection string do Postgres (ex.: `postgres://usuario:senha@host:5432/banco?sslmode=require`). Em dev, vazio (PGlite em `./.pglite`) ou `pglite://caminho`.

As credenciais existem apenas no servidor; o navegador nunca fala com Twilio ou Resend.

## Testes

```bash
npm test        # vitest run
npm run test:watch
```

Os testes de integração usam bancos PGlite **em memória** (`DATABASE_URL=pglite-memory:`, um por arquivo de teste) e nunca tocam o banco de desenvolvimento. Não é preciso servidor rodando.

## Estrutura de diretórios

```
src/
  app/                 Rotas (App Router): páginas públicas, /cadastro, /entrar, /app
    api/               Rotas de API (onboarding, auth, conta)
  components/          UI, layout, home, onboarding, conta e telemetria
  lib/                 Núcleo: db, schema, crypto, phone, ratelimit, onboarding,
                       twilio, mailer, session, events, audit, format
    data/              glossario.ts (fonte única de definições) e observatorioAbas.ts (metadados por aba)
  tests/               Testes unitários e de integração (vitest)
tailwind.config.ts     Design tokens
vitest.config.ts       Configuração de testes
```

## Convites da lista de espera

Quem completa o cadastro sem código de acesso fica em `WAITLIST`. O dono da plataforma (e-mails em `ADMIN_EMAILS`) acessa **`/app/admin`**, vê a lista de espera (e-mail, telefone mascarado e data de cadastro) e envia um convite por e-mail para toda a lista com um código de acesso — o código precisa constar em `ACCESS_CODES` para funcionar. O envio usa o Resend (`RESEND_API_KEY`/`MAIL_FROM`), é sequencial (com intervalo entre mensagens) e registra o evento `waitlist_invited` por convidado. Usuário autenticado que não é admin recebe 404 em `/app/admin` e 403 na API (`POST /api/admin/convites`).

## Boletim mensal

Uma vez por mês, quem se cadastrou **e aceitou comunicações** recebe por e-mail o resumo da **central de alertas** do Observatório: total de alertas ativos por família, os primeiros da ordenação da central (com nível, fonte e link para a aba pública) e as data-bases das fontes. O disparo é feito pelo workflow `boletim-mensal.yml` (dia 1 de cada mês) contra `POST /api/boletim/enviar`, autorizado por `BOLETIM_SECRET` — administradores logados também podem disparar manualmente. Uma guarda impede dois envios no mesmo mês. Todo e-mail traz link de saída assinado (sem login); a preferência também é gerenciável em **Conta → Boletim mensal**.

## Indicadores operacionais (Fase 0)

Gente, rede física e auditoria das instituições financeiras, **exclusivamente de fontes estruturadas oficiais** — CVM/FRE (empregados por posição e região), CVM/FCA (auditor vigente e histórico) e BCB/ESTBAN (agências por banco e municípios atendidos, série mensal). Sem PDF, sem modelo de linguagem, sem estimativa: coleta idempotente (`pipeline/sources/operacional.py`), validações determinísticas com flags publicadas junto do dado (`pipeline/operacional.py`) e saída em `data/gold/operacional.json`, sincronizada diariamente para `public/obs/data/gold/` pelo workflow. A aba pública fica em **`/observatorio/operational-indicators`**; as flags alimentam a família "Indicadores operacionais" da central de alertas (e, por ela, o boletim mensal), e a síntese citável entra na página **`/imprensa`**. Metodologia em [METODOLOGIA_OPERACIONAL.md](./METODOLOGIA_OPERACIONAL.md); fontes em [FONTES_OPERACIONAL.md](./FONTES_OPERACIONAL.md).

## Observatório embutido

O Observatório Brasileiro de Crédito (SPA em JavaScript puro, 16+ abas) roda embutido na plataforma em **`/observatorio`** e exige sessão, como os demais painéis (`src/lib/rotasPublicas.ts`). Os ativos estáticos (HTML, JS, CSS e os JSONs analíticos da camada gold, ~54 MB) vivem em `public/obs/`; o route handler `src/app/observatorio/[[...rota]]/route.ts` serve `public/obs/index.html` para qualquer rota sob `/observatorio`, injetando metadados por aba (title, description, canonical, Open Graph e JSON-LD `Dataset`) a partir do catálogo `src/lib/data/observatorioAbas.ts` — o roteamento fino continua sendo da própria SPA, via History API. A área logada (`/app`) e os painéis são protegidos pelo `src/middleware.ts`; no rodapé da SPA, o visitante vê "Entrar" e o usuário com sessão vê "Minha conta"/"Sair" (checagem via `GET /api/auth/eu`). A página pública **`/imprensa`** publica os números citáveis dos painéis de bets e fraudes com fonte primária e grau de evidência. Para atualizar os dados no futuro, rode o pipeline do observatório e sincronize a saída `data/gold/` para `public/obs/data/gold/` (e os ativos `index.html`/`app.js`/`styles.css` se a SPA mudar, reaplicando o prefixo `/observatorio` e o `DATA_BASE=/obs/data/gold/`).

## Observatório Brasileiro do Setor Elétrico

Domínio `energia`, em **`/setor-eletrico`**: página inicial com o Mapa do Observatório (como o Mapa do Crédito) e 12 módulos (Visão geral, PLD, Água e clima, Geração, Carga e consumo, Rede, Mercado, Empresas e ativos, Expansão, Regulação, Aprenda, Dados e metodologia), páginas estáticas geradas no build a partir da gold em `public/energia/gold/` e com CSVs em `public/energia/series/`. O pipeline fica em `pipeline/energia/` (bronze imutável com sha256, silver com vintages append only e consulta `como_estava_em` sem look-ahead, gold com proveniência por indicador) e roda pelo workflow `atualizar-energia.yml`:

```bash
python3 -m pipeline.energia.run                 # coleta ONS/CCEE e reconstrói a gold
python3 -m pipeline.energia.run --sem-coleta    # só reconstrói a partir do estado salvo
python3 -m unittest discover -s pipeline/tests -t .
```

A previsão do PLD segue governança explícita: modelos com estado (PESQUISA, VALIDAÇÃO, PRODUÇÃO, APOSENTADO) em `pipeline/energia/registro_modelos.json`, arquivo imutável em `pipeline/energia/previsoes/arquivo.jsonl` com sha256 por registro, e previsão principal exibida como indisponível, com motivo, enquanto nenhum modelo está em produção. Arquitetura, catálogo de fontes, modelo de auditabilidade e plano em [docs/observatorios/](./docs/observatorios/README.md).

## Observatório Brasileiro de Eficiência Estatal (etapa inicial)

Domínio `eficiencia`, em **`/eficiencia-estatal`**. Nesta etapa há um único painel publicado, **Educação municipal nas capitais** (`/eficiencia-estatal/educacao-municipal-capitais`): despesa liquidada na função Educação (Siconfi, DCA), matrículas da rede municipal e de escolas conveniadas (microdados do Censo Escolar), alunos por turma, aprovação, Ideb e Saeb (INEP), com passaporte de 16 campos por indicador, estados de dado explícitos e tabela auditável com exportação. O pipeline fica em `pipeline/eficiencia/` (biblioteca padrão; recortes versionados em `seed/` com sha256 e MD5 conferidos) e escreve `public/eficiencia/`:

```bash
python3 -m pipeline.eficiencia.run                   # reconstrói a gold a partir do seed (sem rede)
python3 -m unittest pipeline.tests.test_eficiencia
```

Regra editorial do domínio: apresenta indicadores, não conclusões sobre governos. Documentação, inventário, metodologia, validação e continuidade em [docs/obee/](./docs/obee/README.md). O OBEE está no registro de domínios (`src/lib/dominios.ts`) e, por ele, na home, no seletor de observatórios, na escolha pós login, no cabeçalho público e no rodapé.

## Observatório Brasileiro do Saneamento (primeira entrega)

Domínio `saneamento`, em **`/saneamento`**: catorze capítulos em cinco eixos (acesso e qualidade; preço regulado e conta das famílias; prestadores; investimento e planejamento; saúde, ambiente e resiliência), ficha de cada município e de cada prestador, comparadores de até quatro municípios ou prestadores com link compartilhável, simulador da conta com tabelas tarifárias verificadas nos atos dos reguladores e página pública de método. Fontes: SINISA 2025 (ano de referência 2024), Censos 2010 e 2022 e estimativa de população 2024 do IBGE, atos de cinco reguladores. Capítulos sem dado integrado aparecem como em preparação, com a dependência declarada. O pipeline fica em `pipeline/observatorio_saneamento/` (biblioteca padrão; originais com sha256 no seed) e escreve `public/saneamento/gold/`:

```bash
python3 -m pipeline.observatorio_saneamento.gold     # reconstrói a gold a partir do seed (sem rede)
python3 -m unittest pipeline.tests.test_observatorio_saneamento
```

Documentação, matriz de viabilidade, método e validação em [docs/saneamento/](./docs/saneamento/README.md).

## Observatório Brasileiro de Gás Natural

Domínio `gas`, em **`/gas-natural`**: inicial com o caminho do gás produzido até a oferta e dez páginas por pergunta (produção, aproveitamento, importação, preços na cadeia, gás de cozinha, GNV e gás encanado, abertura do mercado, infraestrutura, regulação, dados e método). O GLP do botijão tem página própria, separada do gás natural. O pipeline fica em `pipeline/gas/` (biblioteca padrão; seed versionado com sha256 de cada original) e escreve `public/gas/gold` e `public/gas/series`; roda pelo workflow `atualizar-gas.yml`:

```bash
python3 -m pipeline.gas.run             # reconstrói a gold a partir do seed (sem rede)
python3 -m pipeline.gas.run --coleta    # recoleta ANP, IBGE, BCB, Comex Stat e Banco Mundial
python3 -m unittest pipeline.tests.test_gas
```

Páginas, decisões de método e lacunas em [docs/gas/](./docs/gas/README.md).

## Judiciário brasileiro no OBEE

Módulo em `/eficiencia-estatal/judiciario`: recursos, tempos, filas, entrega, acesso e comparação, com 57 fichas (27 TJs, 6 TRFs e 24 TRTs), dados oficiais de 2025 e série financeira real de 2009–2025. Fonte: CNJ, Justiça em Números 2026; original e checksum conferidos em 17/10/2026. Sem nota própria de eficiência ou inferência de cumprimento do direito a partir de baixas. Histórico individual e despesa por TRF permanecem ausentes. Painéis e downloads exigem sessão; métodos são públicos.

```bash
python3 -m pipeline.judiciario.run
python3 -m pipeline.judiciario.run --check
python3 -m unittest pipeline.tests.test_judiciario
```

Contratos, cobertura, atualização e limites em [docs/obee/judiciario/](./docs/obee/judiciario/README.md). O capítulo de Acesso à Justiça mantém suas URLs e sua base de Defensorias.

## Documentação

As decisões técnicas (banco, autenticação, máquina de estados do onboarding, rate limiting, tokens de design, telemetria sem PII) estão registradas em [ARCHITECTURE.md](./ARCHITECTURE.md). A arquitetura da plataforma de dois observatórios e do domínio Energia está em [docs/observatorios/](./docs/observatorios/README.md).

## Agronegócio

Observatório próprio com atlas de crédito/ocupação por UF, comparador, sete fichas, oito capítulos, percursos, cenários e síntese imprimível. Dados preservados e hipóteses não se misturam: produção física, custos de referência, comércio e camadas ambientais ainda não foram integrados. Apenas método e glossário são públicos; painéis/downloads exigem conta. [Escopo, fontes, reprodução, catálogo e limites](docs/agro/README.md).

```sh
python3 -m pipeline.agro.run --check
python3 -m pipeline.agro.dicionario --check
node scripts/agro/catalogo.mjs --check
# depois de npm run build; pode usar I18N_CHROMIUM_EXECUTABLE para o Chromium local
node scripts/agro/verificacao.mjs
```
