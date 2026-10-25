# Prompt: Fase 1 do roadmap do comitê (estabilizar e decidir)

Data: 25/10/2026. Base: `main` em `e2487b49`. Origem: `docs/COMITE_2026-10-25.md`, seção 8, Fase 1 (26/10 a 08/11/2026). Destinatário: a sessão ou o modelo que vai executar (Claude Code, Codex ou outro), com acesso ao repositório `genarolins1975/scrutiniums`. Cole o texto abaixo da linha inteiro.

---

## 1. Papel, objetivo e regras

Você vai executar a Fase 1 do roadmap do comitê de 25/10/2026: recolocar o Setor Elétrico e o Crédito em dia, tornar visível ao leitor o que a operação ainda não conferiu, fechar a lacuna da política de privacidade, alinhar o seletor de idioma com o que está traduzido e organizar a fila de decisões do dono. A fase termina quando os critérios de aceite da seção 4 estiverem cumpridos em produção.

Antes de começar, leia inteiros:

1. `CLAUDE.md` (ou `AGENTS.md`) e o núcleo de `.claude/skills/observatorio-layout/SKILL.md`, com os anexos do tema tocado (pacotes P2, P4 e P5 mexem em interface: carregue também as skills `emil-design-eng`, `impeccable` e `design-taste-frontend`, conforme o `CLAUDE.md`; se faltarem no ambiente, diga isso antes de entregar).
2. `docs/COMITE_2026-10-25.md` (evidência, pareceres e decisões D1 a D8).
3. `OPERACOES.md`, `docs/confiabilidade-2026-10-24/energia/README.md` e `docs/confiabilidade-2026-10-24/credito/README.md`.
4. A descrição do PR #379 e o diff da branch `claude/blissful-sagan-8lt0jv`.

Regras sem exceção:

1. Nunca apagar, pular, afrouxar ou marcar como `skip`, `todo` ou `only` um teste para obter CI verde. Mudar o que um teste exige só quando a regra de negócio mudou por decisão do dono, citando a decisão no comentário do teste.
2. Ausência nunca vira zero nem estimativa. Dado da fonte que muda de contrato é retido ou declarado, nunca corrigido em silêncio.
3. Arquivo gerado se regenera com a ferramenta do repositório (golds do Setor Elétrico com `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta`; inventário de tradução nunca versionado).
4. Um PR por pacote, pequeno e revisável, com "O que muda para o leitor", evidência antes e depois e os comandos rodados. Antes de empurrar: `npm run verificar:rapido`; antes de pedir merge: `npm run verificar:pr`.
5. **Merge só com autorização explícita do dono na conversa.** Depois do merge, conferir o deploy da Vercel no commit do `main` e dizer o horário e os links das rotas, como manda a seção 13 da skill.
6. Nunca rebase, amend ou force push em branch que não seja sua. Para trazer o `main`, merge.
7. Textos, comentários, commits e PRs em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência.
8. Itens marcados "decisão do dono pendente" são implementados até o PR pronto e param ali: o PR diz qual decisão falta e qual é a recomendação do comitê.

## 2. Estado de partida (não refaça o diagnóstico; confira só o que mudou)

Medido em 25/10/2026 (fontes em `docs/COMITE_2026-10-25.md`, seção 2):

| Item | Estado |
|---|---|
| Setor Elétrico | 24 dias sem publicação diária; as 6 execuções agendadas de 20 a 25/10 retidas pelos testes. Causas diagnosticadas em 24/10; correção no PR #379, aberto e não integrado |
| Crédito | Desenrola e Judicial retidos desde 18/10; dez grupos retidos desde 22/10 porque `src/tests/credito-consultas.test.ts` reprova o 0,00% ao ano que o BCB publica para o BCO RNX S.A. (crédito pessoal não consignado prefixado, semana de 02 a 08/10/2026); Desenrola com `TIPO_DESENROLA` 4 em 2.396 linhas de 05 a 08/2026, tipo que a documentação do BCB (11/09/2026) não descreve |
| Notificações | `BOLETIM_SECRET` vazio no GitHub Actions desde 13/10; resumo e alertas por email falham |
| Privacidade | `src/app/privacidade/page.tsx` não lista CPF, UF, perfil de uso nem os campos profissionais; `PRIVACY_VERSION` = `2026-10-23` em `src/lib/versoesPoliticas.ts` |
| Idioma | A home inglesa tem 96% do texto em português, corretamente marcado com `lang="pt-BR"` e o aviso "Portuguese only"; o seletor "Inglês" aparece na barra da home |
| Issues | 11 abertas; #26 e #27 de 10/08; #89 e #112 de vigília genérica |

Confira o estado atual antes de cada pacote: `python3 scripts/vigilancia_frescor.py --relatorio`, a lista de PRs e issues abertos e as últimas execuções de `atualizar-energia.yml` e `atualizar-dados.yml`.

## 3. Pacotes, em ordem

### P1. Setor Elétrico de volta ao ar (item 1.1, parte 1)

1. Traga o `main` para a branch do PR #379 por merge, se ela estiver atrás, e rode `npm run verificar:pr`.
2. Confira contra a descrição do PR as duas salvaguardas do comitê que já devem estar lá: lista fechada de retratos (só os marcados com `@retrato` e `itRetrato`, cada um com a fonte e a data do retrato que fixa) e o vínculo do SIGA pelo nome da captura anterior confirmado pelo cadastro de agentes da ANEEL, nunca por semelhança.
3. Acrescente, no mesmo PR, só o que faltar para o leitor distinguir o vínculo inferido: na página de Empresas e no método do Setor Elétrico, o estado "vínculo inferido pela captura de DD/MM/AAAA", separado do vínculo lido na fonte, com a contagem de parcelas em cada estado. Se isso for maior que um ajuste de texto, faça em PR próprio logo depois do merge do #379 e não atrase a volta da publicação.
4. Peça ao dono a autorização de merge (decisão D1 recomendada pelo comitê e aceita pelo dono em 25/10, com a versão branda dos retratos).
5. Depois do merge, acompanhe as três execuções noturnas seguintes de `atualizar-energia.yml`. Se alguma reter, abra a issue de retenção com a causa por teste, reproduza com o artefato `energia-retida` e corrija na mesma linha do PR #379; não relaxe teste.

### P2. Retrato vencido vira ressalva ao leitor (item 1.1, parte 2; decisão do dono de 25/10/2026)

**Regra decidida.** Retrato que diverge da gold do dia não barra a publicação (decisão de 24/10). Se a divergência não for reconferida em 7 dias, ela passa a aparecer ao leitor como ressalva no método e na faixa de frescor do Setor Elétrico, **sem reter a gold** (decisão de 25/10, que substitui a proposta do comitê de voltar a bloquear).

Implemente, em PR próprio sobre o `main` depois do merge do #379:

1. **Estado durável das divergências.** O passo "Retratos da gold do dia" de `.github/workflows/atualizar-energia.yml` passa a gravar, junto da gold, um arquivo de estado (sugestão: `public/energia/gold/retratos.json`, incluído no manifesto) com, por retrato: identificador estável (arquivo e nome do teste), descrição (`de_que`), data da primeira divergência, data da última execução que ainda divergia e, quando o teste os expuser, valor fixado e valor da gold do dia. O estado sobrevive entre execuções: a data da primeira divergência só muda quando o retrato volta a passar. Retrato que passa sai da lista. `scripts/testes-retrato.mjs` produz os dados; a escrita do arquivo não pode depender da gold ter sido publicada ou retida.
2. **Prazo.** Uma divergência está vencida quando a data da primeira divergência tem 7 dias ou mais em relação ao dia de quem lê (horário de Brasília). Guarde o prazo em `src/lib/frescor/limiares.json`, lido também pelo Python, para não haver dois números.
3. **Faixa de frescor.** Em `src/components/frescor/` (FaixaFrescor e FaixaFrescorCliente), o domínio `energia` ganha uma linha própria quando houver divergência vencida: "Conferência pendente desde DD/MM/AAAA: N números fixados de uma captura anterior da fonte divergem da captura atual." A situação do domínio continua sendo a de frescor (em dia ou atrasado); a linha não muda a cor nem o status, não usa vermelho e não julga.
4. **Método.** No método do Setor Elétrico (e na lista por fonte do rodapé de método), uma seção "Conferências pendentes" lista cada divergência vencida: o que o número fixava, a data do retrato, o valor fixado, o valor atual (ou "não exposto pelo teste") e desde quando diverge. Sem divergência vencida, a seção não aparece.
5. **Reconferência.** Atualizar um retrato é um commit que muda o número fixado e a data do retrato, depois de recontagem independente na captura nova. O próximo `testes:retrato` limpa a entrada. Documente o procedimento em `OPERACOES.md`.
6. **Issue.** A issue "Setor Elétrico: retratos divergem da gold do dia; reconferir" passa a dizer, por retrato, quantos dias faltam para a ressalva aparecer ao leitor.
7. **Testes por invariantes** (política de 23/10/2026): estado persistido entre duas execuções sintéticas; data da primeira divergência preservada; entrada removida quando o retrato volta a passar; linha da faixa e seção do método presentes só com divergência vencida (6 dias: ausente; 7 dias: presente); status de frescor inalterado pela linha; nenhum `undefined`, `NaN` ou data crua; versão inglesa do Setor Elétrico com a mesma regra.
8. **Evidência de página:** `npm run evidencias -- --rotas /setor-eletrico /setor-eletrico/metodologia --saida docs/ux-AAAA-MM-DD/retratos`, com e sem divergência vencida (estado sintético num build local).

### P3. Crédito destravado (item 1.2; decisão do dono pendente, D2)

Recomendação do comitê, a confirmar com o dono antes do merge:

1. **0,00% do BCO RNX.** O valor é da fonte. Publicar os dez grupos. Em "Quanto meu banco cobra?" (`src/lib/credito/juros.ts` e a página da rota), instituição com taxa de 0,00% ao ano numa modalidade fica fora da posição, da mediana exibida como comparação e da distribuição, com a nota "Valor de 0,00% informado pelo banco à fonte nesta semana; fora da comparação." A taxa continua visível na ficha do banco com a mesma nota. O teste de `credito-consultas.test.ts` que hoje reprova o 0,00% passa a exigir a regra nova (nunca 0,00% comparado sem a nota), citando a decisão do dono no comentário.
2. **Tipo 4 do Desenrola.** Em `pipeline/sources/desenrola.py`, linhas com `TIPO_DESENROLA` fora de `TIPOS` deixam de reter o arquivo inteiro: são separadas, contadas e preservadas no bronze; os tipos 1 a 3 seguem a validação atual e são publicados com a ressalva "N linhas de um tipo não descrito na documentação do BCB (AAAA-MM a AAAA-MM) ficaram de fora". Qualquer outra falha de validação continua retendo o arquivo inteiro.
3. Registrar em `OPERACOES.md` as duas consultas que o dono fará ao BCB (0,00% e tipo 4), com a data.
4. Critério: dez grupos publicados na execução seguinte ao merge; Desenrola publicado com a ressalva; nenhum outro grupo retido por esses motivos.

### P4. Política de privacidade completa (item 1.5; decisão do dono pendente, D4)

1. Em `src/app/privacidade/page.tsx`, listar todos os dados que o cadastro e a conta coletam, conferidos contra `src/lib/schema.ts` e os formulários de `src/components/onboarding/`: email, telefone, CPF (finalidade única: uma conta por pessoa; nunca exibido por inteiro), UF, perfil de uso, tipo de instituição, área e cargo (só nos perfis profissionais), recortes salvos, alertas assinados, termos de busca guardados por 30 dias, e a contagem agregada de uso.
2. Para cada grupo: finalidade, base legal proposta, retenção e com quem é compartilhado (Twilio, Resend, Vercel), a partir de `docs/observatorios/MEDICAO_DE_USO.md`. Marcar no PR que a base legal é proposta e precisa de leitura jurídica do dono.
3. Nova `PRIVACY_VERSION` com a data, para distinguir o aceite antes e depois.
4. Não implementar o CPF em HMAC nesta fase (item 3.4); a política diz como o CPF é guardado hoje.
5. Merge só com o texto aprovado pelo dono.

### P5. Seletor de idioma só onde há tradução (item 1.6)

1. Localizar o seletor de idioma (`src/components/layout/CabecalhoPlataforma.tsx` e vizinhos) e as páginas inglesas para onde ele leva.
2. O seletor "Inglês" só aparece em página cuja irmã inglesa tenha menos da metade do texto visível marcado com `lang="pt-BR"`. Até a tradução da home (item 4.3 do roadmap; decisão 3 do dono de 19/10/2026), isso significa: aparece no Setor Elétrico, não aparece na home nem nas páginas abertas sem tradução. As páginas `/en` continuam existindo e acessíveis por endereço.
3. Teste que mede a proporção de texto marcado `pt-BR` em cada destino do seletor sobre o build e reprova destino acima de 50%.
4. Conferir com e sem sessão, a 390 e 1440 px.

### P6. Issues de vigília acionáveis (item 1.7)

Para #26, #27, #89 e #112 e qualquer outra issue de vigília aberta: ler o último comentário, conferir se a condição ainda existe e propor ao dono, numa tabela, fechar (com o motivo e a evidência), consolidar (em qual) ou manter (com a ação pedida). Fechar ou comentar só depois de "pode fechar" do dono.

### P7. Fila única de decisões do dono (item 1.8)

1. Criar `docs/DECISOES_PENDENTES.md` com uma linha por decisão: número, tema, data de entrada, recomendação, documento de origem e estado. Semear com D1 a D8 do comitê, os seis itens da leva 2 (`src/lib/rotasPublicas.ts`), as decisões abertas de `docs/confiabilidade-2026-10-24/*/README.md` e as pendências de configuração de `OPERACOES.md`.
2. Decisão tomada sai da tabela para um histórico no mesmo arquivo, com a data e onde foi aplicada.
3. Propor ao dono uma linha no `CLAUDE.md` dizendo que toda decisão pedida por agente entra nesse arquivo. Não alterar o `CLAUDE.md` sem a aprovação dele.

## 4. Ações do dono (o agente não executa; entregue este passo a passo a ele)

**Item 1.3. Ligar os emails.**

1. Gerar um valor aleatório de 32 caracteres ou mais.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret: nome `BOLETIM_SECRET`, o valor gerado.
3. Vercel → projeto → Settings → Environment Variables (Production): `BOLETIM_SECRET` com o mesmo valor; conferir `RESEND_API_KEY` e `MAIL_FROM`, com o domínio do remetente verificado no Resend.
4. Novo deploy de produção na Vercel para a variável valer.
5. GitHub → Actions → "Resumo do crédito por e-mail" → Run workflow. Esperado: execução verde e email recebido.

**Item 1.4. Rotacionar segredos** (pedido desde 07/2026).

1. Twilio: Console → Account → API keys & tokens → gerar um Auth Token secundário, promover a principal e atualizar `TWILIO_AUTH_TOKEN` na Vercel.
2. `COOKIE_SECRET`: gerar um valor novo e trocar na Vercel. Efeito: todas as sessões abertas caem e os links de confirmação e de saída já enviados deixam de valer. Fazer num horário de pouco uso.
3. Novo deploy de produção; entrar de novo e conferir o login por senha e por SMS.
4. Registrar a data das duas rotações em `OPERACOES.md` (ou pedir ao agente).

**Decisões D2 e D4.** Responder no PR de cada pacote (P3 e P4) se aceita a recomendação do comitê.

## 5. Critério de aceite da Fase 1

| Item | Critério | Como provar |
|---|---|---|
| 1.1 | Gold do Setor Elétrico publicada em 3 noites seguidas; faixa "em dia"; vínculo inferido visível; retrato vencido aparece como ressalva sem reter | `vigilancia_frescor.py --relatorio`; execuções do Actions; evidência de página do P2 |
| 1.2 | Dez grupos do Crédito e o Desenrola publicados, com as notas | `meta.json` com `grupos.*.gerado_em` posterior ao merge |
| 1.3 | Resumo e alertas com execução verde e email recebido | Actions; confirmação do dono |
| 1.4 | Datas das rotações em `OPERACOES.md` | Diff |
| 1.5 | Política nova publicada com versão nova | Página em produção |
| 1.6 | Nenhum link "Inglês" leva a página com mais da metade do texto em português | Teste do P5 verde |
| 1.7 | Issues de vigília fechadas, consolidadas ou com ação pedida | Lista de issues |
| 1.8 | `docs/DECISOES_PENDENTES.md` no `main`; nenhuma decisão com mais de 7 dias até 08/11 | Arquivo |

## 6. Entrega

Ao fim de cada pacote, uma mensagem curta ao dono: o que mudou para o leitor, o estado real (PR aberto, CI verde, mergeado, no ar com horário), os links das rotas afetadas e a única decisão que falta dele, se houver. Ao fim da fase, atualizar a seção 8 de `docs/COMITE_2026-10-25.md` com o estado de cada item da Fase 1, como a banca de 19/10 fez com as ondas.
