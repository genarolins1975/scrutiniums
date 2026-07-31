# Scrutiniums

Plataforma **gratuita** de inteligência analítica sobre setores da economia brasileira: painéis de atividade setorial, risco de crédito, sentimento regulatório e concentração de mercado, com metodologia aberta e glossário público. A **única exigência de acesso é o cadastro** — e-mail de contato, telefone verificado por SMS e perfil básico. Sem plano pago, sem cartão. Durante o **acesso antecipado**, a entrada na plataforma exige um **código de acesso** (`ACCESS_CODES`, lista separada por vírgulas); quem não tem código fica na **lista de espera** e será contatado quando o produto entrar em produção.

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
  components/          UI, layout, home, onboarding, conta e analytics (PanelShell etc.)
  lib/                 Núcleo: db, schema, crypto, phone, ratelimit, onboarding,
                       twilio, mailer, session, events, audit, format
    data/              glossario.ts (fonte única de definições) e paineis.ts (séries determinísticas)
  tests/               Testes unitários e de integração (vitest)
tailwind.config.ts     Design tokens
vitest.config.ts       Configuração de testes
```

## Convites da lista de espera

Quem completa o cadastro sem código de acesso fica em `WAITLIST`. O dono da plataforma (e-mails em `ADMIN_EMAILS`) acessa **`/app/admin`**, vê a lista de espera (e-mail, telefone mascarado e data de cadastro) e envia um convite por e-mail para toda a lista com um código de acesso — o código precisa constar em `ACCESS_CODES` para funcionar. O envio usa o Resend (`RESEND_API_KEY`/`MAIL_FROM`), é sequencial (com intervalo entre mensagens) e registra o evento `waitlist_invited` por convidado. Usuário autenticado que não é admin recebe 404 em `/app/admin` e 403 na API (`POST /api/admin/convites`).

## Observatório embutido

O Observatório Brasileiro de Crédito (SPA em JavaScript puro, 16 abas) roda embutido na plataforma em **`/observatorio`**. Os ativos estáticos (HTML, JS, CSS e os JSONs analíticos da camada gold, ~54 MB) vivem em `public/obs/`; rewrites no `next.config.mjs` servem `public/obs/index.html` para qualquer rota sob `/observatorio` (o roteamento fino é da própria SPA, via History API). Tanto `/observatorio` quanto `/obs/**` (inclusive os dados em `/obs/data/gold/**`) exigem a sessão da Scrutiniums (`src/middleware.ts`); sem cookie, redirect para `/entrar?de=/observatorio`. Para atualizar os dados no futuro, rode o pipeline do observatório e sincronize a saída `data/gold/` para `public/obs/data/gold/` (e os ativos `index.html`/`app.js`/`styles.css` se a SPA mudar, reaplicando o prefixo `/observatorio` e o `DATA_BASE=/obs/data/gold/`).

## Documentação

As decisões técnicas (banco, autenticação, máquina de estados do onboarding, rate limiting, tokens de design, telemetria sem PII) estão registradas em [ARCHITECTURE.md](./ARCHITECTURE.md).
