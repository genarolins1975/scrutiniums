# Arquitetura — Scrutiniums

Registro das decisões técnicas da plataforma. Curto por intenção: cada seção documenta **o que** foi decidido, **por quê** e **como evoluir**.

## Stack

- **Next.js 14 (App Router) com Server Components.** Páginas públicas e painéis renderizam no servidor; JavaScript de cliente entra apenas onde há interatividade (formulários de onboarding, gráficos Recharts). Rotas de API em `src/app/api/**/route.ts`.
- **TypeScript estrito**, **Tailwind CSS** com design tokens, **Drizzle ORM (pg-core)** com **PGlite** em dev e **node-postgres** em produção, **vitest** para testes.

## Banco de dados: Drizzle (pg-core) — PGlite em dev, node-postgres em produção

- **Um único schema Postgres** (`src/lib/schema.ts`, `drizzle-orm/pg-core`, `TIMESTAMPTZ`/`BOOLEAN`) serve os dois ambientes. O antigo driver **better-sqlite3 foi removido**.
- **Produção (Vercel):** `DATABASE_URL=postgres://...` (ou `postgresql://`) usa `drizzle-orm/node-postgres` com `Pool` do `pg`; TLS habilitado quando a URL contém `sslmode=require` ou `PGSSL=1` (`ssl: { rejectUnauthorized: false }`).
- **Desenvolvimento:** sem `DATABASE_URL` (ou com `pglite://caminho`), usa `drizzle-orm/pglite` com **PGlite** (Postgres embarcado, sem instalar nada) persistido em `./.pglite`. Os testes usam `DATABASE_URL=pglite-memory:` (banco em memória por processo).
- **Acesso sempre via `getDb()`** (`src/lib/db.ts`): função async cujo singleton (Promise em `globalThis`) garante que a **migração idempotente** (`CREATE TABLE IF NOT EXISTS ...` e `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` para colunas adicionadas depois) rodou antes de qualquer consulta e sobrevive ao hot reload do Next. Toda a camada de dados (`session.ts`, `onboarding.ts`, `events.ts`, `audit.ts`) é assíncrona.
- **Por que não Prisma:** o Prisma exige download de engines binárias em tempo de build, bloqueado no ambiente de build desta plataforma. Drizzle não baixa nada.

### Modelo de dados (`src/lib/schema.ts`)

`users` (inclui `password_hash` scrypt, `NULL` em contas antigas sem senha), `verification_tokens` (somente **hash** de códigos, nunca em claro), `sessions` (token de sessão também só como hash), `audit_logs` (auditoria de mudanças sensíveis, detalhes sempre mascarados) e `product_events` (telemetria **sem PII**).

## Autenticação: e-mail + senha, com SMS como alternativa e recuperação

- **Login principal por e-mail + senha** (`/entrar` → `POST /api/auth/login`). A senha é criada na **etapa 3 do cadastro** (`/cadastro/perfil`, junto com empresa e cargo), depois da validação do telefone por SMS. Armazenamento: **scrypt do `node:crypto`** (`src/lib/password.ts`, sem dependência externa), formato autodescritivo `scrypt:N:r:p:saltHex:hashHex` com salt aleatório de 16 bytes e `N=16384, r=8, p=1`; verificação com `timingSafeEqual`. Limites: 8..72 caracteres. Senhas **nunca** aparecem em logs, eventos ou auditoria — só o hash é persistido.
- **SMS como entrada alternativa e recuperação** (`/entrar/sms` → `api/auth/entrar/start|check`, Twilio Verify no telefone verificado). Não há fluxo separado de "esqueci minha senha": quem esqueceu entra por SMS e **define uma nova senha em `/app/conta`** (`POST /api/conta/senha` — exige a senha atual quando existe; contas antigas sem senha definem direto; a troca gera `PASSWORD_CHANGED` na auditoria). A rota antiga `/entrar/verificar` redireciona para `/entrar/sms/verificar`.
- **A sessão nasce na confirmação do telefone durante o cadastro** (`phone/check` aprovado) **ou no login** (`api/auth/login` com senha, ou `entrar/check` por SMS). Antes disso, o usuário pendente é identificado pelo **cookie assinado com HMAC-SHA256** (`signedEmailCookie`: `onboarding_email` no cadastro, `login_phone` no login por SMS), nunca por URL.
- **Sessões em banco** (`sessions`) com token aleatório de 32 bytes entregue em **cookie httpOnly** (`secure` em produção, `SameSite=Lax`, 14 dias). Revogação server-side (logout e "encerrar todas as sessões") funciona de imediato, ao contrário de JWT puro.
- Enumeração de contas: `api/auth/login` responde o mesmo **401 genérico** ("E-mail ou senha inválidos.") para e-mail inexistente, conta sem senha e senha errada; `email/start` responde de forma genérica mesmo para e-mail já cadastrado; `entrar/start` só envia SMS quando o telefone pertence a uma conta verificada, mas responde sempre a mesma mensagem genérica.
- **Contas criadas antes da senha existir** (`password_hash NULL`): o login por senha responde o 401 genérico; o caminho é entrar por `/entrar/sms` e definir a senha em Conta.
- O código legado por e-mail (`startEmailVerification`/`checkEmailCode`, hash SHA-256, TTL 15 min, uso único, trava após 5 tentativas) permanece em `src/lib/onboarding.ts` coberto por testes, mas **nenhum fluxo o chama**.

## Verificação de telefone: Twilio Verify

- Integração **exclusivamente server-side** (`src/lib/twilio.ts`); o navegador nunca vê credenciais nem fala com a Twilio.
- **Modo dev simulado:** sem `TWILIO_*` configurado, o código é mantido em memória e registrado no log do servidor com telefone mascarado (`[dev-verify] código para +55 •• •••••-4321: 123456`). Nada é persistido; TTL de 10 minutos e limite de 5 tentativas espelham o comportamento real.
- Números são normalizados para E.164 com `libphonenumber-js` (`src/lib/phone.ts`) antes de qualquer chamada.

## Máquina de estados retomável do onboarding

```
EMAIL_PENDING → PHONE_PENDING → PROFILE_PENDING → ACCESS_PENDING → COMPLETE
                                                       ↓       ↑
                                                    WAITLIST ──┘
```

- O estado vive em `users.onboarding_status`. `nextStepPath` (`src/lib/onboarding.ts`) mapeia estado → rota (`/cadastro`, `/cadastro/telefone`, `/cadastro/perfil`, `/cadastro/acesso`, `/app`), então um usuário que abandona o fluxo **retoma exatamente de onde parou**. No modelo somente-SMS, `email/start` cria o usuário **direto em `PHONE_PENDING`** (o e-mail não é verificado); `EMAIL_PENDING` permanece apenas como estado legado, promovido a `PHONE_PENDING` no próximo `email/start`.
- **Código de acesso (acesso antecipado):** após o perfil, o usuário fica em `ACCESS_PENDING` e precisa informar um código de `ACCESS_CODES` (lista separada por vírgulas, comparação case-insensitive com trim em `src/lib/access.ts`; lista vazia → nenhum código válido). Código válido → `COMPLETE` (é aqui que `onboarding_completed` é emitido); "Não tenho código" → `WAITLIST` (lista de espera, evento `waitlist_joined`). `ACCESS_PENDING` e `WAITLIST` compartilham `/cadastro/acesso`: quem está na lista de espera pode entrar assim que receber um código.
- Invariantes: um usuário `COMPLETE` sempre tem `phone_verified_at` e `terms_accepted_at` preenchidos (`email_verified_at` só existe em contas legadas do fluxo antigo).

## Rate limiting

- Em memória com **backoff progressivo** (`src/lib/ratelimit.ts`): dentro da janela cada estouro dobra o bloqueio (`backoffBaseMs × 2^n`, teto em 2⁶). Políticas nomeadas em `POLICIES` (por telefone, por e-mail, por IP, intervalo mínimo de reenvio; o login por senha usa `loginPerEmail` — 8/15 min — e `loginPerIp` — 30/15 min).
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

## Observatório embutido

- **Rota**: `/observatorio` (e qualquer subrota, ex.: `/observatorio/credit-panorama`) serve a SPA estática do Observatório Brasileiro de Crédito via rewrites em `next.config.mjs` → `public/obs/index.html`. O roteamento entre as 16 abas é feito pela própria SPA (History API com prefixo `BASE = "/observatorio"` em `public/obs/app.js`).
- **Proteção**: `src/middleware.ts` exige o cookie `scrutiniums_session` para `/observatorio`, `/observatorio/*` e `/obs/*` — os JSONs analíticos em `/obs/data/gold/**` também ficam atrás do login. Sem cookie → redirect `/entrar?de=/observatorio`.
- **Origem dos dados**: arquivos estáticos da camada gold do pipeline do observatório (BCB/SGS, BCB/IF.data, IBGE, Ipeadata etc.), copiados para `public/obs/data/gold/`. Não há endpoints dinâmicos: a SPA só consome JSON estático.
- **Atualização futura**: reexecutar o pipeline do observatório e sobrescrever `public/obs/data/gold/`; se `app.js`/`index.html` mudarem, reaplicar o patch mínimo (constante `BASE`, helper `appPath()`, `DATA_BASE = "/obs/data/gold/"` e os caminhos absolutos `/obs/styles.css` e `/obs/app.js` no HTML).

## Variáveis de ambiente

| Variável | Propósito | Obrigatória? |
| --- | --- | --- |
| `DATABASE_URL` | Connection string do Postgres (`postgres://...`) em produção; vazio (PGlite em `./.pglite`), `pglite://caminho` ou `pglite-memory:` (testes) em dev. | Não em dev (padrão PGlite em `./.pglite`); **sim em produção**. |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio para o Verify. | Não em dev (sem ela, modo simulado); **sim em produção**. |
| `TWILIO_AUTH_TOKEN` | Token de autenticação da Twilio. | Idem acima. |
| `TWILIO_VERIFY_SERVICE_SID` | SID do serviço Twilio Verify (SMS). | Idem acima. As três precisam estar presentes juntas para sair do modo simulado. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Servidor SMTP para comunicações por e-mail (`src/lib/mailer.ts`); o login e a validação não dependem de e-mail. | Não em dev; em produção apenas se e-mails transacionais forem enviados. |
| `MAIL_FROM` | Remetente dos e-mails transacionais (ex.: `Scrutiniums <nao-responda@scrutiniums.com.br>`). | Junto com `SMTP_*` em produção. |
| `ACCESS_CODES` | Códigos de acesso antecipado, separados por vírgula (case-insensitive, com trim). Vazio/ausente → nenhum código válido; usuários vão para a lista de espera. | Não; sem ela o acesso fica fechado (todos em `WAITLIST`). |
| `COOKIE_SECRET` (ou `SESSION_SECRET`) | Segredo do HMAC dos cookies assinados de onboarding/login pendente (`onboarding_email`, `login_phone`). `COOKIE_SECRET` tem precedência; sem nenhum dos dois, usa fallback fixo **apenas aceitável em dev**. | Não em dev; **sim em produção** (defina pelo menos um, com valor aleatório longo). |

## Testes

`npx vitest run` (ou `npm test`). Configuração em `vitest.config.ts` (ambiente node, alias `@ → ./src`, pool `forks` para isolar um processo por arquivo). Testes de integração criam **bancos PGlite em memória por arquivo** via `DATABASE_URL=pglite-memory:` — o banco de desenvolvimento nunca é tocado.

## Atualização automática dos dados (GitHub Actions)

O pipeline Python vive em `pipeline/` (config em `config/`), com o
histórico acumulado semeado em `pipeline/seed/silver-seed.db.gz` (25 MB).
O workflow `.github/workflows/atualizar-dados.yml` roda diariamente às
06:00 (São Paulo): restaura o estado silver/bronze do cache do Actions
(ou semeia na primeira execução), coleta as fontes públicas, reconstrói a
camada gold e, havendo mudança, commita `public/obs/data` — o push
dispara o deploy da Vercel. Execução manual pela aba Actions
(workflow_dispatch), com opção `somente_gold` para reconstruir sem
coletar. O estado da CI evolui de forma independente do arquivo
histórico no Mac de origem, que permanece como arquivo-mestre.
