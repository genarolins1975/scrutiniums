# Scrutiniums

Plataforma **gratuita** de inteligência analítica sobre o crédito e a economia brasileira: o Observatório Brasileiro de Crédito — carteira, inadimplência, instituições, produtos, Pix, bets e fraudes financeiras — com metodologia aberta, dados oficiais e glossário público. A **leitura do Observatório é aberta** — sem cadastro, indexável, compartilhável — para maximizar o uso e o alcance dos painéis. A **área de conta e os painéis personalizados** (`/app`) exigem cadastro — e-mail de contato, telefone verificado por SMS e perfil básico. Sem plano pago, sem cartão. Durante o **acesso antecipado**, a entrada nessa área exige um **código de acesso** (`ACCESS_CODES`, lista separada por vírgulas); quem não tem código fica na **lista de espera** e será contatado quando o produto entrar em produção.

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

Gente, rede física e auditoria das instituições financeiras, **exclusivamente de fontes estruturadas oficiais** — CVM/FRE (empregados por posição e região), CVM/FCA (auditor vigente e histórico) e BCB/ESTBAN (agências por banco e municípios atendidos, série mensal). Sem PDF, sem modelo de linguagem, sem estimativa: coleta idempotente (`pipeline/sources/operacional.py`), validações determinísticas com flags publicadas junto do dado (`pipeline/operacional.py`) e saída em `data/gold/operacional.json`, sincronizada diariamente para `public/obs/data/gold/` pelo workflow. Metodologia em [METODOLOGIA_OPERACIONAL.md](./METODOLOGIA_OPERACIONAL.md); fontes em [FONTES_OPERACIONAL.md](./FONTES_OPERACIONAL.md).

## Observatório embutido

O Observatório Brasileiro de Crédito (SPA em JavaScript puro, 16+ abas) roda embutido na plataforma em **`/observatorio`** e é **público para leitura** — sem cadastro, indexável por buscadores. Os ativos estáticos (HTML, JS, CSS e os JSONs analíticos da camada gold, ~54 MB) vivem em `public/obs/`; o route handler `src/app/observatorio/[[...rota]]/route.ts` serve `public/obs/index.html` para qualquer rota sob `/observatorio`, injetando metadados por aba (title, description, canonical, Open Graph e JSON-LD `Dataset`) a partir do catálogo `src/lib/data/observatorioAbas.ts` — o roteamento fino continua sendo da própria SPA, via History API. A área logada (`/app`) segue protegida pelo `src/middleware.ts`; no rodapé da SPA, o visitante vê "Entrar" e o usuário com sessão vê "Minha conta"/"Sair" (checagem via `GET /api/auth/eu`). A página pública **`/imprensa`** publica os números citáveis dos painéis de bets e fraudes com fonte primária e grau de evidência. Para atualizar os dados no futuro, rode o pipeline do observatório e sincronize a saída `data/gold/` para `public/obs/data/gold/` (e os ativos `index.html`/`app.js`/`styles.css` se a SPA mudar, reaplicando o prefixo `/observatorio` e o `DATA_BASE=/obs/data/gold/`).

## Documentação

As decisões técnicas (banco, autenticação, máquina de estados do onboarding, rate limiting, tokens de design, telemetria sem PII) estão registradas em [ARCHITECTURE.md](./ARCHITECTURE.md).
