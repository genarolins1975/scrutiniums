# Prompt para o Codex: Fase 1 do roadmap do comitê (estabilizar e decidir)

Data: 25/10/2026. Base: `main` em `e2487b49`. Origem: `docs/COMITE_2026-10-25.md`, seção 8, Fase 1 (26/10 a 08/11/2026), na branch `claude/comite-2026-10-25` até ser integrado.

## Como usar

Uma tarefa do Codex por pacote, cada uma com um PR. Cole o texto inteiro abaixo da linha e troque `PACOTE` na primeira linha pela letra do pacote.

| Pacote | Tema | Quando lançar |
|---|---|---|
| E | Setor Elétrico: vínculo inferido visível e retrato vencido como ressalva | Depois do merge do PR #379 |
| C | Crédito: 0,00% do BCO RNX e tipo 4 do Desenrola | Já |
| P | Política de privacidade completa | Já |
| I | Seletor de idioma só onde há tradução | Já |
| D | Fila única de decisões do dono | Já |

Ficam fora do Codex: o merge do PR #379 (decisão do dono), a triagem das issues de vigília (exige acesso às issues do GitHub) e as ações de configuração do dono (seção 6 do texto).

---

**Execute somente o pacote PACOTE.**

## 1. Papel, objetivo e regras

Você vai executar um pacote da Fase 1 do roadmap do comitê de 25/10/2026 da Scrutiniums, plataforma de observatórios de dados públicos brasileiros (Next.js 14, TypeScript, Drizzle, pipeline em Python). A Fase 1 recoloca o Setor Elétrico e o Crédito em dia, mostra ao leitor o que a operação ainda não conferiu, fecha a lacuna da política de privacidade, alinha o seletor de idioma com o que está traduzido e organiza a fila de decisões do dono.

Antes de começar, leia inteiros:

1. `AGENTS.md` e `CLAUDE.md` na raiz. O `CLAUDE.md` vale para qualquer agente.
2. O núcleo de `.claude/skills/observatorio-layout/SKILL.md` e, pelo índice do topo, os anexos do tema tocado.
3. Nos pacotes E, I e P, que mexem em texto exibido ou interface: `.claude/skills/emil-design-eng/SKILL.md`, `.claude/skills/impeccable/SKILL.md` e `.claude/skills/design-taste-frontend/SKILL.md`. São regra do dono para todo trabalho de interface; em conflito, prevalece a `observatorio-layout`. Se algum arquivo faltar, diga isso no PR.
4. `docs/COMITE_2026-10-25.md` (se não estiver no seu checkout, está na branch `claude/comite-2026-10-25`).
5. `OPERACOES.md` e, no pacote do seu tema, `docs/confiabilidade-2026-10-24/energia/README.md` ou `docs/confiabilidade-2026-10-24/credito/README.md`.

Preparação do ambiente: `bash scripts/preparar-sessao.sh` antes de qualquer teste (dependências, derivados, Chromium do Playwright e heap do Node). `npx tsc --noEmit` e `npm run build` precisam de `NODE_OPTIONS=--max-old-space-size=4096`; os scripts `verificar:*` já passam isso.

Regras sem exceção:

1. Nunca apagar, pular, afrouxar ou marcar como `skip`, `todo` ou `only` um teste para obter verde. Mudar o que um teste exige só quando a regra mudou por decisão do dono, citando a decisão e a data no comentário do teste.
2. Ausência nunca vira zero nem estimativa. Dado da fonte que muda de contrato é retido ou declarado, nunca corrigido em silêncio.
3. Arquivo gerado se regenera com a ferramenta do repositório: golds do Setor Elétrico com `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta`; `docs/i18n/cobertura.json` nunca é versionado.
4. Asserção de texto literal só para texto decidido pelo dono, com a decisão citada; teste novo prefere invariantes (natureza, período e prova de cada número, links válidos, ausência de `undefined`, `NaN` e data crua).
5. Antes de abrir o PR: `npm run verificar:rapido` e `npm run verificar:pr`. Se o ambiente não tiver Chromium, rede ou memória para alguma etapa, diga no PR qual etapa não rodou e por quê; não declare verde o que não rodou.
6. Um PR, com título em português e a descrição nesta ordem: "O que muda para o leitor", "Evidência antes e depois", "Comandos rodados e resultado", "Decisão do dono pendente" (se houver) e "O que não foi verificado".
7. **Não faça merge.** O merge é do dono.
8. Textos, comentários, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência. Não alterar `CLAUDE.md`, `AGENTS.md` nem a skill sem pedido do dono.
9. Não mexer em `src/lib/rotasPublicas.ts` nem em regra de acesso: nenhuma rota muda de fechada para aberta neste trabalho.

## 2. Estado de partida (medido em 25/10/2026; confira só o que mudou)

| Item | Estado |
|---|---|
| Setor Elétrico | 24 dias sem publicação diária; 6 execuções agendadas de 20 a 25/10 retidas pelos testes. O PR #379 (CI verde em 24/10) corrige as causas: separa os "retratos" (testes que fixam números de uma captura datada da fonte) da barreira de publicação e liga o SIGA da ANEEL, que deixou de trazer CNPJ em 23/10, pelo nome da captura anterior confirmado pelo cadastro de agentes |
| Crédito | Dez grupos retidos desde 22/10 porque `src/tests/credito-consultas.test.ts` reprova o 0,00% ao ano que o BCB publica para o BCO RNX S.A. (crédito pessoal não consignado prefixado, semana de 02 a 08/10/2026). Desenrola retido desde 18/10 por `TIPO_DESENROLA` 4 em 2.396 linhas de 05 a 08/2026, tipo que a documentação do BCB (11/09/2026) não descreve |
| Privacidade | `src/app/privacidade/page.tsx` não lista CPF, UF, perfil de uso nem os campos profissionais; `PRIVACY_VERSION` = `2026-10-23` em `src/lib/versoesPoliticas.ts` |
| Idioma | A home inglesa (`/en`) tem 96% do texto em português, corretamente marcado com `lang="pt-BR"` e o aviso "Portuguese only"; o seletor "Inglês" aparece na barra da home |
| Decisões | Pelo menos 12 decisões do dono em aberto, espalhadas por documentos; a mais antiga de 07/2026 |

## 3. Pacotes

### E. Setor Elétrico: vínculo inferido visível e retrato vencido como ressalva

Pré-condição: o PR #379 está no `main` (procure `pipeline/tests/retrato.py` e `scripts/testes-retrato.mjs`). Se não estiver, pare e diga isso.

**Parte 1. Vínculo inferido visível.** Na página de Empresas do Setor Elétrico e no método do Setor Elétrico, o leitor distingue o vínculo societário lido na fonte do vínculo inferido pela captura anterior do SIGA: estado próprio "vínculo inferido pela captura de DD/MM/AAAA", com a contagem de parcelas em cada estado, lida da gold. Se a gold ainda não expõe o estado, acrescente-o no módulo `pipeline/energia/modulos/empresas.py` e regenere com `executar_modulo.py empresas --sem-coleta`.

**Parte 2. Retrato vencido vira ressalva.** Regra decidida pelo dono:

- 24/10/2026: retrato que diverge da gold do dia não barra a publicação; vira issue de reconferência.
- 25/10/2026: se a divergência não for reconferida em 7 dias, ela aparece ao leitor como ressalva no método e na faixa de frescor do Setor Elétrico, **sem reter a gold**.

Implemente:

1. **Estado durável.** O passo "Retratos da gold do dia" de `.github/workflows/atualizar-energia.yml` grava, junto da gold, um arquivo de estado (sugestão: `public/energia/gold/retratos.json`, incluído no manifesto) com, por retrato: identificador estável (arquivo e nome do teste), descrição (`de_que`), data da primeira divergência, data da última execução que ainda divergia e, quando o teste os expuser, valor fixado e valor da gold do dia. A data da primeira divergência só muda quando o retrato volta a passar; retrato que passa sai da lista. `scripts/testes-retrato.mjs` produz os dados; a escrita do arquivo não depende de a gold ter sido publicada ou retida.
2. **Prazo único.** Divergência vencida: primeira divergência com 7 dias ou mais em relação ao dia de quem lê (horário de Brasília). O prazo fica em `src/lib/frescor/limiares.json`, lido também pelo Python.
3. **Faixa de frescor.** Em `src/components/frescor/` (FaixaFrescor e FaixaFrescorCliente), o domínio `energia` ganha uma linha quando houver divergência vencida: "Conferência pendente desde DD/MM/AAAA: N números fixados de uma captura anterior da fonte divergem da captura atual." A situação de frescor (em dia ou atrasado) não muda; a linha não muda cor nem status, não usa vermelho e não julga.
4. **Método.** No método do Setor Elétrico e na lista por fonte do rodapé de método, seção "Conferências pendentes" com cada divergência vencida: o que o número fixava, a data do retrato, o valor fixado, o valor atual (ou "não exposto pelo teste") e desde quando diverge. Sem divergência vencida, a seção não aparece. Versão inglesa do Setor Elétrico com a mesma regra.
5. **Reconferência.** Procedimento em `OPERACOES.md`: atualizar um retrato é um commit que muda o número fixado e a data do retrato depois de recontagem independente na captura nova; o próximo `npm run testes:retrato` limpa a entrada.
6. **Issue.** O corpo da issue "Setor Elétrico: retratos divergem da gold do dia; reconferir" diz, por retrato, quantos dias faltam para a ressalva aparecer ao leitor.
7. **Testes por invariantes:** estado persistido entre duas execuções sintéticas; primeira divergência preservada; entrada removida quando o retrato volta a passar; linha e seção ausentes com 6 dias e presentes com 7; status de frescor inalterado; nada de `undefined`, `NaN` ou data crua; inglês com a mesma regra.
8. **Evidência de página:** `npm run evidencias -- --rotas /setor-eletrico /setor-eletrico/metodologia --saida docs/ux-AAAA-MM-DD/retratos`, com e sem divergência vencida (estado sintético num build local).

### C. Crédito: 0,00% do BCO RNX e tipo 4 do Desenrola (decisão do dono pendente, D2)

Implemente a recomendação do comitê; o PR diz que o merge espera a decisão D2.

1. **0,00%.** O valor é da fonte e o grupo deve publicar. Em "Quanto meu banco cobra?" (`src/lib/credito/juros.ts` e a página `/observatorio-do-credito/quanto-meu-banco-cobra`), instituição com 0,00% ao ano numa modalidade fica fora da posição, da mediana exibida como comparação e da distribuição, com a nota "Valor de 0,00% informado pelo banco à fonte nesta semana; fora da comparação." A taxa continua visível para esse banco, com a mesma nota. O teste de `src/tests/credito-consultas.test.ts` que hoje reprova o 0,00% passa a exigir a regra nova (nunca 0,00% comparado sem a nota), citando a decisão D2 do dono no comentário. Confirme, rodando os testes de conteúdo sobre a gold atual, que essa era a única causa da retenção dos dez grupos; se houver outra, descreva-a no PR sem corrigi-la por fora do escopo.
2. **Tipo 4.** Em `pipeline/sources/desenrola.py`, linhas com `TIPO_DESENROLA` fora de `TIPOS` deixam de reter o arquivo inteiro: são separadas, contadas e preservadas no bronze; os tipos 1 a 3 seguem a validação atual e são publicados com a ressalva "N linhas de um tipo não descrito na documentação do BCB (AAAA-MM a AAAA-MM) ficaram de fora". Qualquer outra falha de validação continua retendo o arquivo inteiro. Teste em `pipeline/tests/` com o caso real (tipos 1 a 4 misturados) e com tipo desconhecido junto de outra falha (retém tudo).
3. Em `OPERACOES.md`, registrar as duas consultas que o dono fará ao BCB (0,00% e tipo 4).

### P. Política de privacidade completa (decisão do dono pendente, D4)

1. Em `src/app/privacidade/page.tsx`, listar todos os dados coletados, conferidos contra `src/lib/schema.ts` e os formulários de `src/components/onboarding/` e `src/components/conta/`: email, telefone, CPF (finalidade única: uma conta por pessoa; nunca exibido por inteiro), UF, perfil de uso, tipo de instituição, área e cargo (só nos perfis profissionais), recortes salvos, alertas assinados, termos de busca guardados por 30 dias e a contagem agregada de uso.
2. Para cada grupo: finalidade, base legal proposta, prazo de retenção e com quem é compartilhado (Twilio, Resend, Vercel), a partir de `docs/observatorios/MEDICAO_DE_USO.md` e do código. Onde o código não define retenção, escreva "a definir" no PR e não invente prazo na página.
3. Nova `PRIVACY_VERSION` com a data do PR.
4. Não mudar como o CPF é guardado (fica para a Fase 3); a política descreve o estado atual.
5. O PR diz que a base legal é proposta e precisa de leitura jurídica do dono.

### I. Seletor de idioma só onde há tradução

1. Localizar o seletor de idioma (`src/components/layout/CabecalhoPlataforma.tsx` e vizinhos) e as páginas inglesas para onde ele leva.
2. O seletor "Inglês" só aparece em página cuja irmã inglesa tenha menos da metade do texto visível marcado com `lang="pt-BR"`. Hoje isso significa: aparece no Setor Elétrico; não aparece na home nem nas páginas abertas sem tradução (decisão 3 do dono, 19/10/2026: inglês na 1.0 só na home e no Setor Elétrico; a home será traduzida no item 4.3 do roadmap). As páginas `/en` continuam existindo e acessíveis pelo endereço.
3. Teste sobre o build que mede a proporção de texto marcado `pt-BR` em cada destino do seletor e reprova destino acima de 50%.
4. Evidência a 390 e 1440 px, com e sem sessão (`npm run evidencias`).

### D. Fila única de decisões do dono

1. Criar `docs/DECISOES_PENDENTES.md` com uma linha por decisão: número, tema, data de entrada, recomendação, documento de origem e estado. Semear com D1 a D8 de `docs/COMITE_2026-10-25.md`, os itens da leva 2 com `aprovadaEm: null` em `src/lib/rotasPublicas.ts`, as decisões abertas de `docs/confiabilidade-2026-10-24/*/README.md` e as pendências de configuração de `OPERACOES.md`. Cada linha cita o arquivo e a linha de origem.
2. Seção "Histórico" no mesmo arquivo para decisões tomadas, com a data e onde foram aplicadas. Semear com as decisões já registradas em `docs/BANCA_2026-10-19.md` e `docs/CICLO_PROPOSTAS_2026-10.md`.
3. Script `scripts/decisoes-pendentes.mjs` que lista as decisões abertas há mais de 7 dias (saída 0 sempre; é informativo), com teste.
4. No PR, propor ao dono uma linha no `CLAUDE.md` dizendo que toda decisão pedida por agente entra nesse arquivo. Não alterar o `CLAUDE.md`.

## 4. Critério de aceite do pacote

| Pacote | Critério |
|---|---|
| E | Vínculo inferido e lido distintos na página de Empresas e no método; com estado sintético de 7 dias, linha na faixa e seção no método; com 6 dias, nenhuma das duas; status de frescor igual nos dois casos; evidência de página anexada |
| C | Testes de conteúdo do Crédito aprovam a gold atual com a nota do 0,00%; Desenrola com tipos 1 a 3 aprovado e tipo 4 contado na ressalva |
| P | Todo campo de `users` e das tabelas da conta aparece na política ou tem justificativa no PR; versão nova |
| I | Nenhum link "Inglês" leva a página com mais da metade do texto em português; teste verde |
| D | Arquivo com todas as decisões encontradas, cada uma com origem; script e teste verdes |

## 5. Entrega

Mensagem final curta: o que muda para o leitor, o estado real (PR aberto, verificações que passaram e que não rodaram), as rotas afetadas e a decisão que falta do dono, se houver.

## 6. Ações do dono (o Codex não executa)

**Ligar os emails** (resumo e alertas falham desde 13/10 por falta do segredo):

1. Gerar um valor aleatório de 32 caracteres ou mais.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret: `BOLETIM_SECRET` com o valor.
3. Vercel → projeto → Settings → Environment Variables (Production): `BOLETIM_SECRET` com o mesmo valor; conferir `RESEND_API_KEY` e `MAIL_FROM`, com o domínio do remetente verificado no Resend.
4. Novo deploy de produção na Vercel.
5. GitHub → Actions → "Resumo do crédito por e-mail" → Run workflow. Esperado: execução verde e email recebido.

**Rotacionar segredos** (pedido desde 07/2026):

1. Twilio: Console → Account → API keys & tokens → gerar Auth Token secundário, promover a principal e atualizar `TWILIO_AUTH_TOKEN` na Vercel.
2. `COOKIE_SECRET`: valor novo na Vercel. Efeito: todas as sessões caem e os links de confirmação e de saída já enviados deixam de valer. Fazer em horário de pouco uso.
3. Novo deploy; entrar de novo e conferir login por senha e por SMS.
4. Registrar a data das rotações em `OPERACOES.md`.

**Decisões:** merge do PR #379 (D1); D2 no PR do pacote C; D4 no PR do pacote P.
