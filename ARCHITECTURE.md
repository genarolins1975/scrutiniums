# Arquitetura — Scrutiniums

Registro das decisões técnicas da plataforma. Curto por intenção: cada seção documenta **o que** foi decidido, **por quê** e **como evoluir**.

## Stack

- **Next.js 14 (App Router) com Server Components.** Páginas públicas e painéis renderizam no servidor; JavaScript de cliente entra apenas onde há interatividade (formulários de onboarding, gráficos Recharts). Rotas de API em `src/app/api/**/route.ts`.
- **TypeScript estrito**, **Tailwind CSS** com design tokens, **Drizzle ORM (pg-core)** com **PGlite** em dev e **node-postgres** em produção, **vitest** para testes.

## Banco de dados: Drizzle (pg-core) — PGlite em dev, node-postgres em produção

- **Um único schema Postgres** (`src/lib/schema.ts`, `drizzle-orm/pg-core`, `TIMESTAMPTZ`/`BOOLEAN`) serve os dois ambientes. O antigo driver **better-sqlite3 foi removido**.
- **Produção (Vercel):** `DATABASE_URL=postgres://...` (ou `postgresql://`) usa `drizzle-orm/node-postgres` com `Pool` do `pg`; TLS habilitado quando a URL contém `sslmode=require` ou `PGSSL=1` (`ssl: { rejectUnauthorized: false }`).
- **Desenvolvimento:** sem `DATABASE_URL` (ou com `pglite://caminho`), usa `drizzle-orm/pglite` com **PGlite** (Postgres embarcado, sem instalar nada) persistido em `./.pglite`. Os testes usam `DATABASE_URL=pglite-memory:` (banco em memória por processo).
- **Acesso sempre via `getDb()`** (`src/lib/db.ts`): função async cujo singleton (Promise em `globalThis`) garante que a **migração idempotente** (`CREATE TABLE IF NOT EXISTS ...`) rodou antes de qualquer consulta e sobrevive ao hot reload do Next. Toda a camada de dados (`session.ts`, `onboarding.ts`, `events.ts`, `audit.ts`) é assíncrona.
- **Por que não Prisma:** o Prisma exige download de engines binárias em tempo de build, bloqueado no ambiente de build desta plataforma. Drizzle não baixa nada.

### Modelo de dados (`src/lib/schema.ts`)

`users`, `verification_tokens` (somente **hash** de códigos, nunca em claro), `sessions` (token de sessão também só como hash), `audit_logs` (auditoria de mudanças sensíveis, detalhes sempre mascarados) e `product_events` (telemetria **sem PII**).

## Autenticação passwordless

- **Sem senha:** o login e o cadastro usam código de 6 dígitos enviado por e-mail. Não há hash de senha para vazar nem fluxo de "esqueci minha senha" — **recuperação de acesso é o mesmo fluxo de login**.
- Códigos são gerados com `crypto.randomInt` (`generateOtp`) e persistidos **apenas como SHA-256** (`hashToken`), com TTL de 15 minutos, uso único (`used_at`) e trava após 5 tentativas (`attempts`).
- **Sessões em banco** (`sessions`) com token aleatório de 32 bytes entregue em **cookie httpOnly** (`secure` em produção, `SameSite=Lax`, 14 dias). Revogação server-side (logout e "encerrar todas as sessões") funciona de imediato, ao contrário de JWT puro.
- O e-mail pendente entre etapas trafega em **cookie assinado com HMAC-SHA256** (`signedEmailCookie`), nunca em URL.
- Enumeração de contas: `startEmailVerification` com propósito LOGIN/RECOVERY para e-mail inexistente não cria usuário e o chamador responde de forma genérica.

## Verificação de telefone: Twilio Verify

- Integração **exclusivamente server-side** (`src/lib/twilio.ts`); o navegador nunca vê credenciais nem fala com a Twilio.
- **Modo dev simulado:** sem `TWILIO_*` configurado, o código é mantido em memória e registrado no log do servidor com telefone mascarado (`[dev-verify] código para +55 •• •••••-4321: 123456`). Nada é persistido; TTL de 10 minutos e limite de 5 tentativas espelham o comportamento real.
- Números são normalizados para E.164 com `libphonenumber-js` (`src/lib/phone.ts`) antes de qualquer chamada.

## Máquina de estados retomável do onboarding

```
EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → COMPLETE
```

- O estado vive em `users.onboarding_status`. `nextStepPath` (`src/lib/onboarding.ts`) mapeia estado → rota (`/cadastro`, `/cadastro/telefone`, `/cadastro/perfil`, `/app`), então um usuário que abandona o fluxo **retoma exatamente de onde parou** em qualquer dispositivo.
- Invariantes: um usuário `COMPLETE` sempre tem `email_verified_at`, `phone_verified_at` e `terms_accepted_at` preenchidos (coberto por teste em `src/tests/state-machine.test.ts`).

## Rate limiting

- Em memória com **backoff progressivo** (`src/lib/ratelimit.ts`): dentro da janela cada estouro dobra o bloqueio (`backoffBaseMs × 2^n`, teto em 2⁶). Políticas nomeadas em `POLICIES` (por telefone, por e-mail, por IP, intervalo mínimo de reenvio).
- **Limitação consciente:** o `Map` é por processo. Em implantação multi-instância, trocar o armazenamento por Redis **mantendo a mesma interface** `checkRateLimit(key, policy)`.

## Design tokens e tipografia

- Tokens centralizados em `tailwind.config.ts` (paleta carvão/marfim/bronze/mineral, tracking de labels, raios) e **CSS vars** em `src/app/globals.css` (`--cor-*`, `--serie-*` para gráficos). Regra: **nenhum hexadecimal solto em componentes** — sempre token.
- **Fontes variáveis auto-hospedadas via Fontsource** (`@fontsource-variable/*`): o CDN do Google Fonts é indisponível no ambiente de build e o self-hosting é melhor para privacidade (nenhuma requisição de fonte a terceiros) e para estabilidade de layout.

## Painéis analíticos

- **Anatomia padrão** em `PanelShell` (`src/components/analytics/`): todo painel tem título, definição vinda do glossário, fonte, cobertura, frequência, limitações e exportação CSV — a mesma estrutura em Atividade, Risco e Regulatório.
- Paleta de séries em `CHART_SERIES` (`src/lib/format.ts`); o bronze (`CHART_HIGHLIGHT`) é reservado a destaque e **nunca** entra como série comum (coberto por teste).
- Dados de exemplo **determinísticos** (`src/lib/data/paineis.ts`): funções puras com ruído senoidal, sem `Math.random`, para render idêntico entre servidor e cliente.

## Glossário como fonte única

- `src/lib/data/glossario.ts` é a **única** origem de nome, definição, fórmula, interpretação, fonte, cobertura, frequência e limitações de cada indicador. Páginas e painéis consomem `getGlossaryEntry(slug)`; um conceito nunca tem duas definições na plataforma.

## Telemetria e auditoria

- **Eventos de produto sem PII** (`src/lib/events.ts`): apenas nome do evento e `user_id`; nunca e-mail, telefone, código, empresa ou cargo. Falha de telemetria nunca derruba o fluxo principal.
- **Auditoria** (`src/lib/audit.ts`) registra mudanças de contato e revogação de sessões; o campo `detail` só aceita dados mascarados (`maskEmail`, `maskPhone`).

## Variáveis de ambiente

| Variável | Propósito | Obrigatória? |
| --- | --- | --- |
| `DATABASE_URL` | Connection string do Postgres (`postgres://...`) em produção; vazio (PGlite em `./.pglite`), `pglite://caminho` ou `pglite-memory:` (testes) em dev. | Não em dev (padrão PGlite em `./.pglite`); **sim em produção**. |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio para o Verify. | Não em dev (sem ela, modo simulado); **sim em produção**. |
| `TWILIO_AUTH_TOKEN` | Token de autenticação da Twilio. | Idem acima. |
| `TWILIO_VERIFY_SERVICE_SID` | SID do serviço Twilio Verify (SMS). | Idem acima. As três precisam estar presentes juntas para sair do modo simulado. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Servidor SMTP para envio dos códigos por e-mail (`src/lib/mailer.ts`). | Não em dev (código vai para o log do servidor); **sim em produção**. |
| `MAIL_FROM` | Remetente dos e-mails transacionais (ex.: `Scrutiniums <nao-responda@scrutiniums.com.br>`). | Junto com `SMTP_*` em produção. |
| `COOKIE_SECRET` (ou `SESSION_SECRET`) | Segredo do HMAC dos cookies assinados de e-mail pendente. `COOKIE_SECRET` tem precedência; sem nenhum dos dois, usa fallback fixo **apenas aceitável em dev**. | Não em dev; **sim em produção** (defina pelo menos um, com valor aleatório longo). |

## Testes

`npx vitest run` (ou `npm test`). Configuração em `vitest.config.ts` (ambiente node, alias `@ → ./src`, pool `forks` para isolar um processo por arquivo). Testes de integração criam **bancos PGlite em memória por arquivo** via `DATABASE_URL=pglite-memory:` — o banco de desenvolvimento nunca é tocado.
