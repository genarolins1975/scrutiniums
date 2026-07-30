# Scrutiniums

Plataforma **gratuita** de inteligência analítica sobre setores da economia brasileira: painéis de atividade setorial, risco de crédito, sentimento regulatório e concentração de mercado, com metodologia aberta e glossário público. A **única exigência de acesso é o cadastro** — e-mail verificado, telefone verificado e perfil básico. Sem plano pago, sem cartão.

## Stack

- **Next.js 14** (App Router, Server Components) + **TypeScript**
- **Tailwind CSS** com design tokens centralizados
- **Drizzle ORM + better-sqlite3** (portável para PostgreSQL — ver [ARCHITECTURE.md](./ARCHITECTURE.md))
- Autenticação **passwordless** por código de e-mail; verificação de telefone via **Twilio Verify**
- **Recharts** para gráficos, **vitest** para testes

## Como rodar

```bash
npm install
npm run dev
```

Aplicação em `http://localhost:3000`. O banco SQLite (`dev.db`) é criado e migrado automaticamente na primeira execução.

**Modo de desenvolvimento simulado:** sem credenciais de Twilio e SMTP configuradas, nenhuma mensagem externa é enviada — os códigos de verificação (e-mail e SMS) aparecem **no console do servidor**, com destinatário mascarado:

```
[dev-mail] (EMAIL_VERIFY) código para g•••@g•••.com: 123456
[dev-verify] código para +55 •• •••••-4321: 654321
```

Use esses códigos para completar o cadastro e o login localmente.

## Configuração de produção

Defina as variáveis de ambiente (lista completa, com propósito e obrigatoriedade, em [ARCHITECTURE.md](./ARCHITECTURE.md#variáveis-de-ambiente)):

- **Twilio Verify (SMS):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_VERIFY_SERVICE_SID` — crie um serviço Verify no console da Twilio; com as três presentes, o modo simulado é desativado automaticamente.
- **E-mail (SMTP):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM`.
- **Segurança:** `COOKIE_SECRET` (ou `SESSION_SECRET`) com valor aleatório longo.
- **Banco:** `DATABASE_URL` (ex.: `file:./data/prod.db`; para PostgreSQL, siga as instruções de migração no ARCHITECTURE.md).

As credenciais existem apenas no servidor; o navegador nunca fala com Twilio ou SMTP.

## Testes

```bash
npm test        # vitest run
npm run test:watch
```

Os testes de integração usam bancos SQLite temporários (apagados ao final) e nunca tocam o `dev.db`. Não é preciso servidor rodando.

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

## Documentação

As decisões técnicas (banco, autenticação, máquina de estados do onboarding, rate limiting, tokens de design, telemetria sem PII) estão registradas em [ARCHITECTURE.md](./ARCHITECTURE.md).
