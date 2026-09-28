# Arquitetura atual da Scrutiniums

Auditoria feita em 28/09/2026 sobre o commit `8574fd3a2` (branch `main`), antes de qualquer mudança para a plataforma de dois observatórios. Registro do que existe, do que é maduro e do que se reaproveita.

## 1. Stack

| Camada | Tecnologia | Onde |
| --- | --- | --- |
| Aplicação | Next.js 14 (App Router, Server Components), TypeScript estrito | `src/app` |
| Estilo | Tailwind 3 com tokens em `tailwind.config.ts` e CSS vars em `src/app/globals.css` | |
| Tipografia | Playfair Display (serifa), Inter (texto), Archivo Narrow (rótulos), auto hospedadas | `src/fonts`, `src/app/layout.tsx` |
| Gráficos | Recharts (Next) e SVG próprio (SPA) | `src/components/dados`, `public/obs/app.js` |
| Banco | Drizzle ORM pg-core; PGlite em dev e testes, node-postgres em produção | `src/lib/db.ts`, `src/lib/schema.ts` |
| Testes | vitest (92 arquivos, 1.085 testes na linha de base) e unittest Python | `src/tests`, `pipeline/tests`, `pesquisa/tests` |
| Deploy | Vercel, disparado por push em `main` | |
| Dados | Pipeline Python só com biblioteca padrão (mais `pypdf`), camadas bronze, silver e gold | `pipeline/` |

## 2. Autenticação e autorização

* Login principal por e-mail e senha (`/entrar`, `POST /api/auth/login`, scrypt em `src/lib/password.ts`); SMS como alternativa e recuperação (`/entrar/sms`, Twilio Verify).
* Sessão em banco (`sessions`, token só como hash) e cookie assinado `scrutiniums_session`, verificado na borda por `src/middleware.ts`, que protege apenas `/app/*`.
* Onboarding retomável (`src/lib/onboarding.ts`): `nextStepPath(COMPLETE)` hoje leva a `/observatorio`. `safeInternalPath` valida o destino `?de=`.
* Administração por `ADMIN_EMAILS` (`src/lib/admin.ts`); `/app/admin` responde 404 real para quem não é admin.

## 3. Rotas públicas e área autenticada

| Rota | Natureza |
| --- | --- |
| `/` | Home institucional; usuário com sessão é redirecionado a `/observatorio` |
| `/observatorio/*` | SPA do Crédito servida por `src/app/observatorio/[[...rota]]/route.ts` com `<head>` por aba (`src/lib/observatorioHead.ts`, catálogo `src/lib/data/observatorioAbas.ts`) |
| `/observatorio-do-credito` | Vitrine editorial estática do Crédito |
| `/dados`, `/dados/[slug]` | Indicadores públicos do crédito (BCB/SGS), estáticos |
| `/resumo`, `/imprensa`, `/glossario` | Páginas públicas estáticas |
| `/entrar`, `/cadastro/*` | Autenticação e onboarding |
| `/app/conta`, `/app/admin` | Área autenticada (grupo `(foco)`); `/app` redireciona a `/observatorio` (`next.config.mjs`) |
| `/metodologia`, `/fontes` | Redirecionam à metodologia viva da SPA |

## 4. Design system

* Paleta carvão, marfim, papel, bronze, mineral e linha; regra "nenhum hexadecimal solto em componente" (`ARCHITECTURE.md`).
* Primitivas: `Logo`, `SectionHeading`/`PageTitle`, `States` (skeleton, vazio, erro), `Button`, `BotaoLink`, `Field`, `Alert`.
* A SPA tem tema próprio em `public/obs/styles.css` com valores duplicados à mão; o acento da SPA (`#8f6644`) difere levemente do bronze do Next (`#966B48`). O Next não tem modo escuro.

## 5. Mecanismos de evidência já existentes (SPA do Crédito)

| Mecanismo | Implementação |
| --- | --- |
| Selos de natureza | `BADGES`/`badge()` com observado, calculado, estimado, previsão, cenário, experimental, demo, descontinuada |
| Fonte | `srcLine()` e `chartFooter()` (fonte, período, unidade, nota, link e embed) |
| Metodologia | `guiaPagina()` com "por que importa, como ler, o que não permite concluir"; `renderMethod()` com catálogo, model cards e linhagem |
| Glossário | `GLOSSARIO` com marcação automática de verbetes; `src/lib/data/glossario.ts` no Next |
| Data de referência | `meta.json.vintages` por família de fonte, exibida por `pageVintage()` |
| Ausência | formatadores devolvem "–"; stub `{disponivel:false, ok:false, error}` do pipeline; faixa "Fonte em pane" |
| Download | exportação universal em XLSX e CSV por painel |
| Linhagem | `pipeline/lineage_map.py` gera o mapa fonte → gold → aba, travado por teste |

## 6. Pipeline e atualização

* `pipeline/run.py` coleta (orçamento de tempo), `pipeline/gold.py` constrói a gold com escrita atômica e stubs de falha, `meta.json` e `lineage.json` ao final.
* Bronze imutável com sha256 e metadados de requisição; silver SQLite guarda o valor vigente e registra revisões em `revisions`. Não há consulta "como estava na data T".
* Workflow diário `atualizar-dados.yml`: cache de silver e bronze, sentinela de regressão (`scripts/sanidade_gold.py`), suíte de testes antes do commit, push que dispara o deploy.
* Previsão existente (`pipeline/models/forecast.py`): ensemble com backtest walk forward e bandas empíricas, recalculado a cada execução, sem arquivo imutável de previsões publicadas.

## 7. Telemetria, logs e monitoramento

* `product_events` sem PII; visitas por seção via `POST /api/telemetria` com allowlist fechada (`src/lib/telemetry.ts`) e prefixo textual `obs:`. Não existe dimensão de portal ou domínio.
* Achado da auditoria: seções existentes da SPA (pix, judicial, pgfn, desenrola, penetracao, moradia, consignado, presmun, regulacao, sobre) e os eventos `obs:conceito:*` ficam fora da allowlist e são descartados em silêncio.
* Monitoramento de dados: sentinela de regressão, issues automáticas, `scripts/vigilancia.py`.

## 8. O que se reaproveita integralmente

Autenticação, sessão, onboarding, conta e preferências; banco e migração idempotente; tokens, fontes e primitivas de UI; padrão de página estática que lê gold no build; convenções do pipeline (bronze com sha256, escrita atômica, stub de falha, sentinela, testes antes do commit); SEO (sitemap, robots, metadados); a disciplina editorial da `docs/CONSTITUICAO.md` (evidência e inferência separadas, ausência declarada).

## 9. Limites que pesam no novo domínio

* `meta.json`, `rsync --delete` de um único diretório de gold e `lineage_map` são específicos do Crédito: o domínio Energia precisa de diretório de gold próprio.
* O silver do Crédito não guarda vintages completas: previsão auditável exige tabela de observações por vintage.
* A SPA é um monólito de 1,25 MB com menu em HTML estático: o Setor Elétrico não deve ser construído dentro dela.
