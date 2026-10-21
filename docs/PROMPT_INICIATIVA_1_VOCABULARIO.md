# Prompt: Iniciativa 1 do parecer de UX, um só vocabulário

Cole o texto abaixo numa sessão nova do Claude Code (modelo Opus 5.5) aberta no repositório `genarolins1975/scrutiniums`, a partir do `main`.

---

Você vai implantar a **Iniciativa 1** do parecer `docs/PARECER_UX_2026-10-21.md` (seção 6, "Iniciativa 1. Um só vocabulário: seis observatórios, 28 coleções, páginas") na plataforma Scrutiniums. O parecer foi escrito por outro modelo a partir do commit `807870cc8`; confira cada afirmação dele contra o código atual antes de agir, não contra a descrição.

## Antes de começar

1. Leia inteiros, nesta ordem: `CLAUDE.md`, `.claude/skills/observatorio-layout/SKILL.md`, `docs/PARECER_UX_2026-10-21.md` (seções 1, 2, 3, 4.1, 6 Iniciativa 1, 7, 8 e 10), `docs/observatorios/REAGRUPAMENTO.md`.
2. Carregue as skills `emil-design-eng`, `impeccable` e `design-taste-frontend` (obrigatórias pelo `CLAUDE.md`). Se alguma não existir no ambiente, diga isso ao usuário antes de entregar; em conflito, prevalece a `observatorio-layout`.
3. Crie o branch `claude/iniciativa-1-vocabulario` a partir de `origin/main`.
4. Prepare o ambiente: `npm ci`, depois os scripts de `predev` (`node scripts/materializar-assistencia.mjs && node scripts/materializar-seguranca-alimentar.mjs && node scripts/materializar-trabalho-renda.mjs && node scripts/minify-obs.mjs`). Sem eles, `/eficiencia-estatal` com sessão e a aplicação do Crédito não renderizam. Servidor: `COOKIE_SECRET=dev-secret DATABASE_URL=pglite-memory: npx next dev -p 3111`. Sessão de desenvolvimento pela API em modo simulado: `POST /api/onboarding/email/start` (`{email, termsAccepted: true}`), `POST /api/onboarding/phone/start` (`{country: "BR", phone}`; o código aparece no log como `[dev-verify]`), `POST /api/onboarding/phone/check` (`{country, phone, code}`; devolve o cookie `scrutiniums_session`), `POST /api/onboarding/profile` (`{password, cpf válido, perfilUso: "cidadao", uf}`).
5. Medição: `node scripts/ux-medidas.mjs http://localhost:3111 <pasta> <cookie ou -> <rotas…>` (em ambiente de nuvem, `CHROMIUM_PATH=/opt/pw-browsers/chromium`).

## O problema que você resolve

Duas taxonomias competem em toda tela. O registro novo tem seis observatórios e 28 coleções (`src/lib/observatorios/lista.ts`, `registro.ts`). O registro antigo tem oito domínios chamados "Observatório Brasileiro de X" (`src/lib/dominios.ts`). O `REAGRUPAMENTO.md` (17/10/2026, aprovado pelo dono) decidiu que os antigos viram coleções com o mesmo nome. Hoje:

- O rodapé (`src/components/layout/Footer.tsx`) tem uma coluna com os seis observatórios e sete colunas com os domínios antigos sob `aria-label="Observatório Brasileiro de …"`.
- O seletor da barra ("Setor Elétrico ▾", `src/components/layout/SwitcherObservatorio.tsx:43`) e a barra gerada da aplicação do Crédito (`src/lib/observatorios/barraSpa.ts`) listam só os oito domínios: Combustíveis, Conectividade, Custo de vida e Educação nos municípios não aparecem; Famílias e Território e Clima aparecem sem coleção.
- As entradas se apresentam pelo nome antigo acima do H1: `src/app/setor-eletrico/page.tsx:812`, `src/app/saneamento/page.tsx:63`, `src/app/gas-natural/page.tsx:106`, `src/app/agronegocio/layout.tsx:8`, `src/app/eficiencia-estatal/layout.tsx:9`, H1 de `src/app/observatorio-do-credito/page.tsx:226`, marca da barra lateral do Crédito (`public/obs/index.html:45,52`).
- Nomes divergentes para a mesma coisa: "Crédito" e "Crédito e sistema financeiro"; "Contas Públicas Federais" e "Contas Federais"; "Contas Públicas Estaduais" e "Contas Estaduais"; "Judiciário" (`src/lib/opcoesObservatorios.ts:14`) e "Justiça"; "Inflação por cidade" (`src/app/custo-de-vida/layout.tsx:10`) e "Custo de vida". O texto de abertura da home (`src/i18n/pt.ts:14`) nomeia domínios e omite Famílias e Território.
- Trilha em seis implementações (`EntradaObservatorio.tsx:80`, `PaginaPorta.tsx:43`, sete páginas do Território em linha, `src/app/dados/[slug]`, `.edm-trilha`, `.cp-breadcrumb`, `.tr-breadcrumb`) com três raízes ("Observatórios", "Os seis observatórios", "Observatório dos Serviços Públicos") e três `aria-label` ("Trilha", "Você está em", "Caminho da página"); a maioria das páginas de coleção não tem trilha.
- `aria-label` das navegações de módulo variam ("Navegação do Observatório do Setor Elétrico", "Navegação da coleção Combustíveis", "Painéis de Trabalho e Renda", "Visões do módulo Saúde nas capitais", "Contas Públicas", "Navegação principal").

Confirme cada ponto com `grep` antes de mexer; linhas podem ter mudado.

## O que fazer, nesta ordem

1. **`src/lib/dominios.ts`.** Sem mudar `id`, `rotaRaiz`, `rotaApresentacao` nem `prefixosTelemetria`: `nome` passa a ser o nome da coleção igual ao de `lista.ts` ("Crédito e sistema financeiro", "Setor Elétrico", "Síntese das capitais" para `eficiencia`, "Contas Federais", "Contas Estaduais", "Saneamento", "Gás Natural", "Agronegócio"); um campo novo `nomeLegado` guarda o nome antigo, usado só por testes de regressão e por `/sobre`. Procure todo uso de `.nome` dos domínios (`grep -rn "\.nome\b" src/components src/app src/lib | grep -i domin`) e troque onde a tela mostra o nome.
2. **`src/lib/observatorios/lista.ts` vira a única fonte de coleções.** Em `Colecao`, acrescente `dominio?: DominioId` para as coleções com pipeline próprio. Troque `SwitcherObservatorio.tsx` e `barraSpa.ts` para listar `o.colecoes` (as 28) agrupadas pelos seis observatórios, com `aria-current` na atual (a atual é a coleção dona da rota: `donoDaRota` em `registro.ts`). Regenere a barra da aplicação com `node scripts/barra-spa.mjs`; o teste `cabecalho-movel` compara o arquivo com o gerado.
3. **Rodapé.** Em `Footer.tsx`, substitua as sete colunas de domínio por seis colunas, uma por observatório (`aria-label` = nome do observatório), cada uma com as suas coleções pelo nome do registro e, no fim da coluna, "Método" e "Glossário" da coleção quando existirem (as rotas de método e glossário estão em `src/lib/rotasPublicas.ts`, `PREFIXOS`, e nos catálogos de cada domínio). A coluna Institucional permanece. Mantenha a versão em inglês coerente (`src/i18n/paginas/layout.ts`); nomes de observatório e coleção são nomes de produto e ficam em português nas duas línguas, marcados com `<Nome>` como já se faz em `navCabecalho.ts`.
4. **Rótulo de contexto acima do H1.** Crie `src/components/layout/RotuloContexto.tsx`: recebe a rota (ou `colecao`/`observatorio`) e escreve "Observatório X · Coleção Y" e "· Página Z" quando não é a entrada da coleção, lido do registro. Use a classe `rotulo` existente. Substitua os rótulos em linha das entradas listadas acima e das versões aperitivo (`src/app/aperitivo/*`), de `contas-publicas` ("Contas Públicas / Governo Federal"), `contas-publicas-estaduais`, `custo-de-vida` ("Custo de vida · Inflação por cidade") e `educacao-municipal`.
5. **Trilha única.** Crie `src/components/layout/Trilha.tsx` com `aria-label="Você está em"`, raiz "Observatórios" (com sessão, link para `/app/observatorios`; sem sessão, para `/perguntas/<observatório>`; a presença de sessão já é resolvida no cliente por `useSessao` em `src/components/acesso/sessao.ts`, ou renderize os dois links e esconda um por sessão como faz `AcessoConta`), depois observatório, coleção e página, tudo lido do registro. Substitua as seis implementações e acrescente a trilha nas páginas de coleção que não têm (toda página sob `src/app/<coleção>/…` que use um `Cabecalho*` de domínio). Não crie trilha na home, em `/entrar`, `/cadastro` e `/app/*`.
6. **Rótulos das navegações e títulos.** Todo `nav` de navegação de módulo recebe `aria-label="Navegação da coleção X"` (X = nome do registro). `<title>` das páginas: "Página · Coleção · Scrutiniums"; onde o título já é montado por `generateMetadata`, ajuste o template em `src/app/layout.tsx` e nos layouts de coleção.
7. **Textos.** `src/i18n/pt.ts:14` passa a nomear os seis observatórios (e o par em `en.ts`); `opcoesObservatorios.ts` "Judiciário" vira "Justiça"; `custo-de-vida/layout.tsx` recebe "Custo de vida" como coleção e "Inflação por cidade" como página; a marca da barra lateral do Crédito (`public/obs/index.html:45,52`) vira "Crédito e sistema financeiro" com a frase "monitoramento · diagnóstico · previsão" mantida; o H1 de `/observatorio-do-credito` **não** muda nesta iniciativa (fica para a Iniciativa 4), mas o rótulo acima dele passa pelo `RotuloContexto`.
8. **Inglês.** Rode `node scripts/cobertura-i18n.mjs` e versione `docs/i18n/cobertura.json`. Nenhuma promessa de inglês fora da home e do Setor Elétrico (decisão do dono de 19/10/2026).
9. **Teste novo `src/tests/vocabulario.test.ts`** que reprova: a string "Observatório Brasileiro d" ou "Observatório do Agronegócio Brasileiro" em qualquer `.tsx` de `src/components` e `src/app` e em `public/obs/index.html` (exceções explícitas: `/sobre` e o campo `nomeLegado`); seletor da barra sem alguma das 28 coleções; coluna do rodapé cujo `aria-label` não seja nome de observatório; página de coleção (entradas de `src/lib/observatorios/inventario.ts`) sem `Trilha` no HTML do servidor; `nav` de módulo sem `aria-label` no padrão "Navegação da coleção ".
10. **Documentação.** Atualize `docs/observatorios/REAGRUPAMENTO.md` (situação da implementação) e a seção "Navegação e acesso" da skill `observatorio-layout` com uma linha sobre `RotuloContexto` e `Trilha`.

## O que não mudar

Nenhuma URL, nenhum `id` de domínio ou de coleção, nenhuma chave de telemetria, nenhum nome de arquivo de gold, nenhuma regra de acesso (`rotasPublicas.ts`, `APERITIVOS`, `LEVA_2`), nenhum contrato de dado. Não avance para as outras iniciativas (navegação de módulo, busca, molde, kit): se precisar tocar num `Cabecalho*` de domínio, mude só o `aria-label` e o rótulo de contexto. Não apague teste para passar; teste que fixa o desenho antigo muda de propósito, com o motivo no PR.

## Verificação antes do PR

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (os testes de navegador dependem do Chromium do Playwright), `npm run build`.
- No navegador, com e sem sessão, a 1440 e 390 px: a home, as seis portas `/perguntas/*`, `/app/observatorios`, as seis entradas de observatório, uma página de cada uma das 28 coleções (lista em `src/lib/observatorios/inventario.ts`) e `/observatorio/map`. Em cada uma, confira: o seletor lista as 28 coleções e marca a atual; o rodapé tem seis colunas de observatório; o rótulo de contexto e a trilha mostram o mesmo observatório e a mesma coleção que o seletor; nenhum "Observatório Brasileiro de" visível. Guarde capturas antes e depois (`scripts/ux-medidas.mjs`) e cite as pastas no PR.
- Rubrica da skill (§10) por página alterada: nota, rota, evidência e limitação remanescente.

## Entrega

1. Commits pequenos por passo (dominios, seletor, rodapé, rótulo, trilha, textos, teste, docs).
2. PR para `main` com: o que mudou para o leitor (três frases), a lista de arquivos por passo, as verificações feitas com e sem sessão, o que mudou nos testes e por quê, as pendências reais.
3. CI verde; responda cada thread de revisão automática. **Não faça merge sem autorização explícita do dono nesta conversa.** Depois do merge, confira o deploy da Vercel no commit do `main` antes de dizer "no ar" e entregue os links das rotas conferidas.
4. Resposta final curta, em português do Brasil, sem hífen nem travessão, com os links e o estado real (PR aberto, CI, mergeado, no ar), e uma pergunta só se houver decisão do dono pendente.

Critério de conclusão: o teste `vocabulario.test.ts` verde, a conferência manual registrada no PR e o critério de aceite da Iniciativa 1 do parecer cumprido ponto a ponto.
