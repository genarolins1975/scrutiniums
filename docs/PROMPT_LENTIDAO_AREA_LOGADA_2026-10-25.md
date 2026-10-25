# Prompt: lentidão da abertura da área logada (Scrutiniums)

Cole o texto abaixo no ChatGPT (ou Codex) com acesso ao repositório `genarolins1975/scrutiniums`.

---

Uma implementação desta correção já existe na branch `claude/ecstatic-cerf-mfvl4a`. Se ela ainda não estiver no `main`, comece por ela: revise contra o critério de aceite abaixo, corrija o que faltar e só reescreva se encontrar defeito. Se não existir, implemente do zero.

Você vai corrigir a causa principal da lentidão da página de abertura da área logada da Scrutiniums, `/app/observatorios` ("Encontre o painel"), destino de todo login. Trabalhe no repositório `genarolins1975/scrutiniums` (Next.js 14, App Router, Drizzle, Postgres em produção na Vercel, PGlite em desenvolvimento e testes). Leia antes `CLAUDE.md` (ou `AGENTS.md`) na raiz e siga os comandos de verificação descritos ali.

## Diagnóstico já feito (25/10/2026, build do commit a82e140dd)

1. A página em si é leve: no servidor local com sessão, 48 a 77 ms aquecida; HTML de 41 kB comprimido; nenhuma tarefa longa no navegador.
2. Causa principal: `src/lib/db.ts`, função `createDb()`, chama `migrate(db)` na primeira conexão de cada instância da função serverless. São 30 comandos de esquema executados em sequência (CREATE TABLE/INDEX IF NOT EXISTS, seis `ALTER TABLE users ADD COLUMN IF NOT EXISTS`, um bloco DO e um `UPDATE users`). Com latência simulada por ida ao banco, isso custou 1,3 s a 30 ms e 3,6 s a 120 ms, antes do primeiro byte. A área logada tem pouco tráfego, então boa parte das visitas cai em instância nova. Além disso, `ALTER TABLE` adquire trava exclusiva da tabela mesmo quando a coluna já existe.
3. Causas secundárias (não são o objeto desta tarefa): `getSessionUser` (`src/lib/session.ts`) roda três vezes por requisição sem `cache()` do React; as datas de frescor do mapa leem 16,6 MB de JSON por instância (`src/lib/frescor/dominios.ts`); funções em `iad1` com região do banco não confirmada.

## O que fazer

1. Manter `migrate(db)` exportada e idempotente (o teste `src/tests/conta-ferramentas.test.ts` a reaplica duas vezes).
2. Criar `garantirEsquema(db)` e usá-la em `createDb()` no lugar de `migrate(db)`:
   a. uma consulta confere se a versão atual do esquema já está registrada numa tabela `esquema_versoes (versao TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL)`;
   b. registrada, retorna sem mais nenhuma consulta;
   c. ausente (tabela inexistente ou outra versão), roda `migrate(db)`, cria a tabela se preciso e grava a versão com `ON CONFLICT DO NOTHING`.
3. A versão é a impressão digital (SHA-256, 16 caracteres) do conjunto de comandos, calculada no carregamento do módulo, para que qualquer mudança nos comandos dispare a migração sem número mantido à mão.
4. Não mudar nenhum comando de esquema nem o comportamento de `getDb()` (Promise única em `globalThis`, falha não cacheada).
5. Teste novo em `src/tests/db-esquema.test.ts` com PGlite em memória: (a) após `getDb()`, a versão está registrada; (b) `garantirEsquema` num banco em dia faz exatamente uma chamada a `execute`; (c) sem a tabela, ou com versão diferente, a migração roda e a versão atual fica registrada.

## Critério de aceite

1. `npm run verificar:rapido` verde e, antes do PR, `npm run verificar:pr` verde.
2. Medição antes e depois: com o build novo, `scripts/servidor-local.mjs` sobe o servidor; contar as consultas da primeira conexão de uma instância cujo banco já tem a versão registrada (esperado: 1 consulta de esquema em vez de 30).
3. PR com resumo do que muda para o leitor (abertura logada mais rápida na primeira visita a cada instância), a medição e o registro de que o `UPDATE users` de contas legadas passa a rodar só quando a versão muda (a página `/cadastro/acesso` já promove essas contas na chegada).
4. Merge só com autorização explícita do dono. Depois do merge, conferir o deploy da Vercel no commit do main e informar o horário.

## Fora do escopo

Cache de `getSessionUser`, pré cálculo das datas de frescor, região da função e rastreio de arquivos de `public/` no build. Liste como próximos passos no PR, sem implementar.
